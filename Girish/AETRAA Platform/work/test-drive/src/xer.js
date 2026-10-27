// Reading a Primavera P6 .xer into a project programme.
//
// The .xer is the spine of a project: it carries the activities, their dates,
// the WBS they hang off, and (when the planner coded them) the trade, floor and
// discipline. From it we take three things:
//
//   1. the activities themselves, assigned to a discipline via the WBS
//   2. the deliverables the programme ALREADY contains (drawing submissions,
//      material approvals, procurement) — real planner dates, used as they are
//   3. the deliverables it does NOT contain, derived backwards from the work
//      using lead times — clearly marked as derived, never passed off as real
//
// The .xer format: tab-delimited, %T table, %F field names, %R row.

const MS_DAY = 86400000;
const d10 = (s) => (s && String(s).length >= 10 ? String(s).slice(0, 10) : '');
const addDays = (iso, n) => {
  if (!iso) return '';
  const t = Date.parse(iso + 'T00:00:00Z');
  if (!isFinite(t)) return '';
  return new Date(t + n * MS_DAY).toISOString().slice(0, 10);
};

// P6 writes Windows-1252. Workers' TextDecoder may not carry that label, so
// fall back to a byte-for-byte read, which is right for the characters that
// actually appear in activity names.
export function decodeXer(bytes) {
  const u8 = new Uint8Array(bytes);
  try { return new TextDecoder('windows-1252').decode(u8); }
  catch (e) {
    let s = '';
    for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]);
    return s;
  }
}

export function parseXER(text) {
  const clean = String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const tables = {};
  let cur = null, fields = null;
  for (const line of clean.split('\n')) {
    if (!line) continue;
    const p = line.split('\t');
    if (p[0] === '%T') { cur = p[1] ? p[1].trim() : ''; tables[cur] = []; fields = null; }
    else if (p[0] === '%F') fields = p.slice(1).map((f) => f.trim());
    else if (p[0] === '%R' && cur && fields) {
      const v = p.slice(1), row = {};
      fields.forEach((f, i) => { row[f] = (v[i] == null ? '' : String(v[i]).trim()); });
      tables[cur].push(row);
    }
  }
  return tables;
}

// What kind of thing is this activity? Order matters: a "material approval"
// is a material item, not procurement, even though both mention supply.
export function classifyActivity(name) {
  const s = String(name || '').toLowerCase();
  if (/(shop|working)\s*(drawing|dwg)|drawing\s*(submission|submittal|approval)|submit.*(drawing|dwg)|ifc\b|design submission|method statement/.test(s)) return 'drawing';
  if (/material\s*(submittal|submission|approval)|\bmar\b|sample|mock[- ]?up|prequalif/.test(s)) return 'material';
  if (/procure|procurement|\blpo\b|purchase order|fabricat|manufactur|deliver|delivery|supply|off[- ]?site/.test(s)) return 'procurement';
  return 'site';
}

// Discipline from the WBS path, using the mapping the Admin confirmed on upload.
// The branch key is the first path element below the project root.
export function branchOf(path) {
  const p = (path || []).filter(Boolean);
  if (!p.length) return '';
  return p.length > 1 ? p[1] : p[0];
}

export function buildProgramme(tables, opts) {
  const o = opts || {};
  const T = tables || {};
  if (!T.TASK || !T.TASK.length) return { error: 'that .xer has no activities (no TASK table)' };
  if (!T.PROJWBS) return { error: 'that .xer has no WBS (no PROJWBS table)' };

  // WBS paths
  const W = {};
  for (const r of T.PROJWBS) W[r.wbs_id] = r;
  const cache = {};
  const pathOf = (id, depth = 0) => {
    if (cache[id]) return cache[id];
    const r = W[id];
    if (!r || depth > 20) return [];
    const parent = W[r.parent_wbs_id] ? pathOf(r.parent_wbs_id, depth + 1) : [];
    return (cache[id] = parent.concat([r.wbs_name]));
  };

  // activity codes (trade / floor / discipline), when the planner used them
  const codeTypes = {}, codeVals = {}, taskCodes = {};
  for (const r of T.ACTVTYPE || []) codeTypes[r.actv_code_type_id] = r.actv_code_type;
  for (const r of T.ACTVCODE || []) codeVals[r.actv_code_id] = [codeTypes[r.actv_code_type_id], r.actv_code_name];
  for (const r of T.TASKACTV || []) {
    const v = codeVals[r.actv_code_id];
    if (!v) continue;
    (taskCodes[r.task_id] = taskCodes[r.task_id] || {})[v[0]] = v[1];
  }

  const dataDate = d10((T.PROJECT && T.PROJECT[0] &&
    (T.PROJECT[0].last_recalc_date || T.PROJECT[0].plan_start_date)) || '') ||
    new Date().toISOString().slice(0, 10);

  const map = o.disciplineByBranch || {};
  const activities = [];
  const branchSet = new Map();
  const counts = { site: 0, drawing: 0, material: 0, procurement: 0 };
  let order = 0;

  for (const t of T.TASK) {
    const path = pathOf(t.wbs_id);
    const branch = branchOf(path);
    const section = path.length > 2 ? path[2] : (path[1] || path[0] || '');
    const codes = taskCodes[t.task_id] || {};

    const ps = d10(t.target_start_date) || d10(t.early_start_date);
    const pf = d10(t.target_end_date) || d10(t.early_end_date);
    const days = ps && pf ? Math.max(1, Math.round((Date.parse(pf) - Date.parse(ps)) / MS_DAY) + 1) : 1;
    const isMilestone = t.task_type === 'TT_Mile' || t.task_type === 'TT_FinMile';
    // Prefer a cost-loaded weight; fall back to duration so the weighted
    // average still means something on an unloaded programme.
    const cost = Number(t.target_cost || t.total_cost || 0);
    const weight = cost > 0 ? cost : (isMilestone ? 0.25 : days);

    const kind = classifyActivity(t.task_name);
    counts[kind]++;
    if (branch) {
      const b = branchSet.get(branch) || { branch, activities: 0, discipline: map[branch] || '' };
      b.activities++; branchSet.set(branch, b);
    }

    activities.push({
      id: t.task_code || ('A' + String(++order).padStart(4, '0')),
      name: t.task_name || '',
      wbs: section,
      branch,
      path,
      planned_start: ps,
      planned_finish: pf,
      weight,
      kind,                                   // site | drawing | material | procurement
      discipline: map[branch] || codes['Discipline'] || codes['Decipline'] || '',
      trade: codes['Trade'] || '',
      floor: codes['Floor'] || '',
      milestone: isMilestone,
      source: 'programme',
    });
  }

  return {
    ok: true, dataDate, activities,
    branches: [...branchSet.values()].sort((a, b) => b.activities - a.activities),
    counts,
    unassigned: activities.filter((a) => !a.discipline).length,
  };
}

// Write a built programme (activities + derived deliverables) onto a project.
// Replacing wipes the old programme first; otherwise existing rows are updated
// in place so a re-upload of a revised .xer does not lose anything else.
export async function saveProgramme(env, pid, rows, opts) {
  if (!pid) return { error: 'which project?' };
  if (!Array.isArray(rows) || !rows.length) return { error: 'nothing to save' };
  const o = opts || {};
  try {
    if (o.replace) await env.DB.prepare('DELETE FROM activities WHERE project_id = ?').bind(pid).run();
    let n = 0, order = 0;
    const seen = new Set();
    for (const a of rows) {
      let id = String(a.id || ('A' + String(++order).padStart(4, '0')));
      while (seen.has(id)) id = id + '_';
      seen.add(id);
      await env.DB.prepare(
        `INSERT INTO activities
           (project_id,id,wbs,name,level,planned_start,planned_finish,weight,
            trade,trade_group,floor,discipline,phase,sort_order,act_type,
            kind,source,derive_note,work_starts)
         VALUES (?,?,?,?,1,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
         ON CONFLICT(project_id,id) DO UPDATE SET
           wbs=excluded.wbs, name=excluded.name,
           planned_start=excluded.planned_start, planned_finish=excluded.planned_finish,
           weight=excluded.weight, trade=excluded.trade, trade_group=excluded.trade_group,
           floor=excluded.floor, discipline=excluded.discipline, phase=excluded.phase,
           sort_order=excluded.sort_order, act_type=excluded.act_type,
           kind=excluded.kind, source=excluded.source,
           derive_note=excluded.derive_note, work_starts=excluded.work_starts`
      ).bind(
        pid, id, String(a.wbs || ''), String(a.name || ''),
        a.planned_start || null, a.planned_finish || null,
        Number(a.weight) || 0,
        String(a.trade || ''), String(a.discipline || ''), String(a.floor || ''),
        String(a.discipline || ''), String(a.kind || 'site'), ++n,
        a.milestone ? 'TT_Mile' : 'TT_Task',
        String(a.kind || 'site'), String(a.source || 'programme'),
        a.note || null, a.work_starts || null
      ).run();
    }
    return { ok: true, saved: n };
  } catch (e) { return { error: 'could not save the programme: ' + (e && e.message || e) }; }
}

// How far ahead of the work each deliverable has to happen, in days.
export const DEFAULT_LEADS = {
  drawing_submit: 56,        // shop drawings submitted 8 weeks before the work
  drawing_review: 14,        // consultant review allowance
  material_submit: 42,       // material submittal 6 weeks before the work
  material_approval: 21,     // approval allowance
  delivery_before: 7,        // on site a week before the work starts
};

// For every discipline+section of real work, make sure there is a drawing,
// material and procurement deliverable. Anything the programme already has is
// left alone; only the gaps are filled, and those are marked derived.
export function deriveDeliverables(activities, leads) {
  const L = Object.assign({}, DEFAULT_LEADS, leads || {});
  const groups = new Map();
  const have = new Set();

  for (const a of activities || []) {
    const key = (a.discipline || 'Unassigned') + '||' + (a.wbs || '');
    // A milestone is not work: it needs no shop drawings, no material and no
    // procurement of its own, so it never forms a group to derive against.
    if (a.kind === 'site' && !a.milestone) {
      const g = groups.get(key) || { key, discipline: a.discipline || 'Unassigned', section: a.wbs || '', start: a.planned_start, count: 0 };
      if (a.planned_start && (!g.start || a.planned_start < g.start)) g.start = a.planned_start;
      g.count++; groups.set(key, g);
    } else {
      have.add(key + '||' + a.kind);
    }
  }

  const out = [];
  for (const g of groups.values()) {
    if (!g.start) continue;
    const want = [
      { kind: 'drawing', date: addDays(g.start, -L.drawing_submit),
        title: 'Shop drawings — ' + (g.section || g.discipline),
        note: 'Submit ' + L.drawing_submit + ' days before the work; ' + L.drawing_review + ' days for review.' },
      { kind: 'material', date: addDays(g.start, -L.material_submit),
        title: 'Material submittal — ' + (g.section || g.discipline),
        note: 'Submit ' + L.material_submit + ' days before the work; ' + L.material_approval + ' days for approval.' },
      { kind: 'procurement', date: addDays(g.start, -L.delivery_before),
        title: 'Procure & deliver — ' + (g.section || g.discipline),
        note: 'On site ' + L.delivery_before + ' days before the work starts.' },
    ];
    for (const w of want) {
      if (have.has(g.key + '||' + w.kind)) continue;      // the programme already has it
      out.push({
        id: 'DRV-' + w.kind.slice(0, 3).toUpperCase() + '-' + out.length,
        name: w.title, wbs: g.section, discipline: g.discipline,
        planned_start: w.date, planned_finish: w.date,
        kind: w.kind, weight: 0, source: 'derived', note: w.note,
        derived_from: g.section || g.discipline, work_starts: g.start,
      });
    }
  }
  return out;
}
