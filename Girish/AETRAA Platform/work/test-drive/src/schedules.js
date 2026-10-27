// P2-P5 — THE FOUR SCHEDULES (approved 5 Oct 2026).
//
//   P2  shop drawings          every section that asks for shop drawings,
//                              with the IFC drawings each is based on
//   P3  material submittals    every section asking for product data or
//                              samples, or naming manufacturers; matched to
//                              BOQ lines; COVERAGE GATES must be clear first
//   P4  method statements      every section asking for one, plus the high-
//                              risk work in the programme (lifting, hot work,
//                              excavation, working at height…), by package
//   P5  ITPs                   every section with testing or inspection
//                              clauses, its hold/witness points quoted, and
//                              the inspections planned from its activities
//
// Generated after the PM approves the knowledge base (P1 step 6), reviewed by
// the owning team, approved by the PM as the baseline, then tracked live
// through the common submittal flow (S0).
//
// THE DATE RULE (the same for all four). If the programme has its own
// activity for the item, its date is used, marked "from programme". Otherwise
// the date is worked back from the first construction activity that needs it:
// start − lead time − consultant review − one resubmission − preparation,
// marked "derived". Dates are computed when the schedule is read, from the
// programme as it stands, so every date moves when the programme is updated
// (E6). Defaults when the contract is silent: preparation 21 days, review 14,
// one resubmission 14. P3 lead times are entered by hand — no defaults.

import { liveSections } from './spec-index.js';
import { listDrawings } from './drawings.js';
import { responseDays } from './records.js';
import { words } from './knowledge.js';
import { addColumns } from './db-cols.js';

const nowISO = () => new Date().toISOString();
const uid = (p) => p + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const str = (v, n = 300) => String(v == null ? '' : v).slice(0, n);
const safeJson = (s, f) => { try { const v = JSON.parse(s || ''); return v == null ? f : v; } catch (e) { return f; } };
const safe = async (fn, f) => { try { return await fn(); } catch (e) { return f; } };
const addDays = (iso, n) => new Date(Date.parse(String(iso).slice(0, 10) + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);
const todayUAE = () => new Date(Date.now() + 4 * 3600000).toISOString().slice(0, 10);

export const SCHEDULES = {
  shop:     { code: 'P2', label: 'Shop drawing schedule', record: 'submittal', reviewers: ['design'], lead: 'optional',
              columns: ['Sr', 'Discipline', 'Shop drawing', 'Based on IFC drawing', 'Spec section', 'Planned submit', 'Actual submit', 'Rev', 'Consultant code', 'Status'] },
  material: { code: 'P3', label: 'Material submittal schedule', record: 'material', reviewers: ['design', 'procurement'], lead: 'required',
              columns: ['Sr', 'Discipline', 'Description', 'Spec section', 'Supplier', 'Brand', 'Planned submit', 'Submitted date', 'Rev', 'Code', 'Status'] },
  ms:       { code: 'P4', label: 'Method statement schedule', record: 'ms', reviewers: ['site', 'qaqc', 'hse'], lead: 'none',
              columns: ['Sr', 'Discipline', 'Work package / activity', 'Spec section', 'Planned submit', 'Submitted date', 'Rev', 'Code', 'Status'] },
  itp:      { code: 'P5', label: 'ITP schedule', record: 'submittal', reviewers: ['qaqc'], lead: 'none',
              columns: ['Sr', 'Discipline', 'ITP', 'Spec section', 'Hold/witness points', 'Planned submit', 'Submitted date', 'Rev', 'Code', 'Status'] },
};
export const DEFAULTS = { preparation: 21, review: 14, resubmission: 14 };

// Work that always needs its own method statement (P4).
const HIGH_RISK = [
  [/\b(lift(ing)?|crane|hoist|rigging)\b/i, 'Lifting operations'],
  [/\b(hot\s*work|weld(ing)?|cutting|brazing)\b/i, 'Hot work'],
  [/\b(excavat\w*|trench\w*|shoring|dewater\w*)\b/i, 'Excavation'],
  [/\b(work(ing)?\s+at\s+height|scaffold\w*|facade|cladding|roofing)\b/i, 'Working at height'],
  [/\b(demolition|break(ing)?\s+out)\b/i, 'Demolition'],
  [/\b(confined\s+space|manhole|tank\s+entry)\b/i, 'Confined space'],
  [/\b(concret(e|ing)|pour(ing)?)\b/i, 'Concreting'],
  [/\b(formwork|falsework)\b/i, 'Formwork'],
  [/\b(test(ing)?\s+and\s+commission\w*|commissioning)\b/i, 'Testing and commissioning'],
];

let ready = false;
export async function ensureScheduleTables(env) {
  if (ready) return true;
  try {
    await env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS schedule_item (
         id TEXT PRIMARY KEY, project_id TEXT NOT NULL, schedule TEXT NOT NULL, sr INTEGER, discipline TEXT,
         description TEXT, spec_code TEXT, based_on TEXT, boq_ref TEXT, supplier TEXT, brand TEXT,
         activity_id TEXT, activities TEXT, lead_days INTEGER, hold_points TEXT, source TEXT, source_key TEXT,
         basis TEXT, state TEXT, record_ref TEXT, manual_submit TEXT, risk_draft TEXT,
         created_at TEXT, updated_by TEXT, updated_at TEXT)`
    ).run();
    await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_sched_item_p ON schedule_item(project_id, schedule)').run();
    await env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS schedule_meta (
         project_id TEXT NOT NULL, schedule TEXT NOT NULL, state TEXT, baseline TEXT,
         generated_at TEXT, approved_by TEXT, approved_at TEXT, PRIMARY KEY (project_id, schedule))`
    ).run();
    await env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS schedule_resolution (
         project_id TEXT NOT NULL, schedule TEXT NOT NULL, gate_key TEXT NOT NULL, resolution TEXT,
         decided_by TEXT, decided_at TEXT, PRIMARY KEY (project_id, schedule, gate_key))`
    ).run();
    await addColumns(env, 'schedule_item', [['notes', 'TEXT']]);
    ready = true;
    return true;
  } catch (e) { return false; }
}

// ---------------------------------------------------------------- the inputs
async function inputs(env, pid) {
  const secs = (await safe(() => liveSections(env, pid), [])) || [];
  const drawings = ((await safe(() => listDrawings(env, pid, {}), [])) || []).filter((d) => d.status === 'current');
  const acts = ((await safe(() => env.DB.prepare(
    'SELECT id, name, wbs, trade, floor, discipline, planned_start, planned_finish, kind, source, level FROM activities WHERE project_id = ?'
  ).bind(pid).all(), { results: [] })).results) || [];
  const boq = ((await safe(() => env.DB.prepare('SELECT id, ref, section, description FROM boq WHERE project_id = ?').bind(pid).all(), { results: [] })).results) || [];
  const links = ((await safe(() => env.DB.prepare("SELECT * FROM kb_link WHERE project_id = ? AND state = 'confirmed'").bind(pid).all(), { results: [] })).results) || [];
  const project = await safe(() => env.DB.prepare('SELECT * FROM projects WHERE id = ?').bind(pid).first(), null);
  return { secs, drawings, acts, boq, links, project };
}
const linked = (links, fk, fr, tk) => links.filter((l) => l.from_kind === fk && l.from_ref === fr && l.to_kind === tk).map((l) => l.to_ref);
const linkedTo = (links, tk, tr, fk) => links.filter((l) => l.to_kind === tk && l.to_ref === tr && l.from_kind === fk).map((l) => l.from_ref);

// The construction activities that need what a section covers: through the
// confirmed links (section → BOQ → activity), else by shared words with the
// section title. Site activities only, earliest first.
function activitiesFor(sec, I) {
  const site = I.acts.filter((a) => (a.kind || 'site') === 'site' && (a.level == null || a.level > 0) && a.planned_start);
  const viaBoq = new Set(linked(I.links, 'spec', sec.code, 'boq').flatMap((r) => linked(I.links, 'boq', r, 'activity')));
  let hits = site.filter((a) => viaBoq.has(a.id));
  if (!hits.length) {
    const sw = words(sec.title);
    hits = site.filter((a) => words(a.name + ' ' + (a.trade || '')).some((w) => sw.includes(w)));
  }
  return hits.sort((a, b) => (a.planned_start < b.planned_start ? -1 : a.planned_start > b.planned_start ? 1 : (a.id < b.id ? -1 : 1)));
}

// ---------------------------------------------------------------- generation
export function proposeItems(I) {
  const out = [];
  const push = (schedule, x) => out.push({ schedule, ...x });
  for (const s of I.secs) {
    const rq = s.requirements || {};
    const acts = activitiesFor(s, I);
    const first = acts[0] ? acts[0].id : null;
    if ((rq.shop_drawings || []).length) {
      const viaLinks = linkedTo(I.links, 'spec', s.code, 'drawing');
      const sw = words(s.title);
      const based = viaLinks.length ? viaLinks : I.drawings.filter((d) => d.kind === 'ifc' && words(d.title).some((w) => sw.includes(w))).map((d) => d.number);
      push('shop', { discipline: s.discipline, description: 'Shop drawings — ' + s.title, spec_code: s.code, based_on: [...new Set(based)].sort(),
        activity_id: first, source: 'spec', source_key: 'shop|' + s.code,
        basis: 'spec ' + s.code + ' p.' + rq.shop_drawings[0].page + ': "' + rq.shop_drawings[0].sentence.slice(0, 160) + '"' });
    }
    const pd = (rq.product_data || []).concat(rq.samples || []);
    if (pd.length || (s.manufacturers || []).length) {
      const boqRef = linked(I.links, 'spec', s.code, 'boq')[0] || null;
      push('material', { discipline: s.discipline, description: s.title, spec_code: s.code, boq_ref: boqRef,
        brand: '', supplier: '', activity_id: first, source: 'spec', source_key: 'material|' + s.code,
        notes: (s.manufacturers || []).length ? 'Named in the spec: ' + s.manufacturers.join(', ') + (s.or_equal ? ' (or equal)' : '') : '',
        basis: pd.length ? 'spec ' + s.code + ' p.' + pd[0].page + ': "' + pd[0].sentence.slice(0, 160) + '"' : 'spec ' + s.code + ' names manufacturers' });
    }
    if ((rq.method_statement || []).length) {
      push('ms', { discipline: s.discipline, description: 'Method statement — ' + s.title, spec_code: s.code, activity_id: first,
        source: 'spec', source_key: 'ms|' + s.code, basis: 'spec ' + s.code + ' p.' + rq.method_statement[0].page + ': "' + rq.method_statement[0].sentence.slice(0, 160) + '"' });
    }
    const ti = (rq.testing || []).concat(rq.inspection || []);
    if (ti.length) {
      const holds = ti.filter((h) => /\b(hold|witness)\b/i.test(h.sentence)).map((h) => ({ page: h.page, quote: h.sentence.slice(0, 300) }));
      push('itp', { discipline: s.discipline, description: 'ITP — ' + s.title, spec_code: s.code, activity_id: first,
        activities: acts.slice(0, 30).map((a) => a.id), hold_points: holds, source: 'spec', source_key: 'itp|' + s.code,
        basis: 'spec ' + s.code + ' p.' + ti[0].page + ': "' + ti[0].sentence.slice(0, 160) + '"' });
    }
  }
  // P4: high-risk work in the programme, one method statement per kind of work and trade.
  const groups = new Map();
  for (const a of I.acts.filter((x) => (x.kind || 'site') === 'site' && (x.level == null || x.level > 0))) {
    for (const [re, label] of HIGH_RISK) {
      if (!re.test(a.name)) continue;
      const k = label + '|' + (a.trade || a.wbs || '');
      const g = groups.get(k) || { label, trade: a.trade || '', acts: [] };
      g.acts.push(a); groups.set(k, g);
    }
  }
  for (const [k, g] of [...groups.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    const acts = g.acts.filter((a) => a.planned_start).sort((a, b) => (a.planned_start < b.planned_start ? -1 : 1));
    push('ms', { discipline: g.trade, description: 'Method statement — ' + g.label + (g.trade ? ' (' + g.trade + ')' : ''), spec_code: '',
      activity_id: acts[0] ? acts[0].id : (g.acts[0] && g.acts[0].id), source: 'activity', source_key: 'ms|risk|' + k,
      basis: g.acts.length + ' programme activities: ' + g.acts.slice(0, 3).map((a) => a.id + ' ' + a.name).join('; ') });
  }
  return out;
}

export async function generateSchedules(env, pid, who) {
  await ensureScheduleTables(env);
  const kb = await safe(() => env.DB.prepare('SELECT state FROM kb WHERE project_id = ?').bind(pid).first(), null);
  if (!kb || kb.state !== 'approved') return { error: 'The schedules are generated after the PM approves the knowledge base (P1).' };
  const I = await inputs(env, pid);
  const proposals = proposeItems(I);
  const have = new Set(((await env.DB.prepare('SELECT source_key FROM schedule_item WHERE project_id = ?').bind(pid).all()).results || []).map((x) => x.source_key));
  const counts = {};
  for (const sch of Object.keys(SCHEDULES)) {
    const max = await env.DB.prepare('SELECT COALESCE(MAX(sr),0) AS n FROM schedule_item WHERE project_id = ? AND schedule = ?').bind(pid, sch).first();
    let sr = Number(max && max.n) || 0;
    counts[sch] = 0;
    for (const p of proposals.filter((x) => x.schedule === sch)) {
      if (have.has(p.source_key)) continue;       // a later run adds what is new; it never undoes a review
      sr++;
      await env.DB.prepare(
        `INSERT INTO schedule_item (id, project_id, schedule, sr, discipline, description, spec_code, based_on, boq_ref, supplier, brand,
           activity_id, activities, lead_days, hold_points, source, source_key, basis, state, notes, created_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
      ).bind(uid('sch'), pid, sch, sr, str(p.discipline, 60), str(p.description, 300), str(p.spec_code, 20), JSON.stringify(p.based_on || []),
             p.boq_ref || null, str(p.supplier, 120), str(p.brand, 120), p.activity_id || null, JSON.stringify(p.activities || []), null,
             JSON.stringify(p.hold_points || []), p.source, p.source_key, str(p.basis, 400), 'proposed', str(p.notes, 400), nowISO()).run();
      counts[sch]++;
    }
    await env.DB.prepare(
      `INSERT INTO schedule_meta (project_id, schedule, state, generated_at) VALUES (?,?,?,?)
       ON CONFLICT (project_id, schedule) DO UPDATE SET generated_at = excluded.generated_at`
    ).bind(pid, sch, 'draft', nowISO()).run();
  }
  return { ok: true, added: counts };
}

// ---------------------------------------------------------------- dates
// The date rule, worked out for one item from the programme as it is now.
export function plannedDates(item, ctx) {
  const sch = SCHEDULES[item.schedule];
  const review = ctx.review[item.schedule] || DEFAULTS.review;
  if (item.manual_submit) return { submit: item.manual_submit, approval: addDays(item.manual_submit, review), source: 'set by hand' };
  // The programme's own activity for this item: a submission/approval activity
  // sharing a word with the item.
  const iw = words(item.description + ' ' + (item.spec_title || ''));
  const own = ctx.deliverables.find((a) => words(a.name).filter((w) => iw.includes(w)).length >= 1 &&
    (item.schedule !== 'material' || /material|approval|submittal|sample/i.test(a.name)) &&
    (item.schedule !== 'shop' || /shop|drawing/i.test(a.name)) &&
    (item.schedule !== 'ms' || /method/i.test(a.name)) && (item.schedule !== 'itp' || /\bitp\b|inspection|test/i.test(a.name)));
  if (own && own.planned_start) return { submit: own.planned_start.slice(0, 10), approval: (own.planned_finish || addDays(own.planned_start, review)).slice(0, 10), source: 'from programme', activity: own.id };
  const act = item.activity_id ? ctx.acts.get(item.activity_id) : null;
  if (!act || !act.planned_start) return { submit: null, approval: null, source: 'no activity linked', note: 'link the first activity that needs it' };
  let lead = Number(item.lead_days);
  if (!Number.isFinite(lead) || item.lead_days == null || item.lead_days === '') {
    if (sch.lead === 'required') return { submit: null, approval: null, source: 'lead time needed', note: 'enter the procurement lead time (there is no default)' };
    lead = 0;
  }
  const need = act.planned_start.slice(0, 10);
  const submit = addDays(need, -(lead + review + DEFAULTS.resubmission + DEFAULTS.preparation));
  return { submit, approval: addDays(submit, review), source: 'derived', need, rule: need + ' − ' + lead + ' lead − ' + review + ' review − ' +
           DEFAULTS.resubmission + ' resubmission − ' + DEFAULTS.preparation + ' preparation' };
}

async function dateContext(env, pid, project) {
  const acts = ((await safe(() => env.DB.prepare('SELECT id, name, planned_start, planned_finish, kind, source FROM activities WHERE project_id = ?').bind(pid).all(), { results: [] })).results) || [];
  const review = {};
  for (const [k, v] of Object.entries(SCHEDULES)) review[k] = (responseDays(project, v.record) || {}).days || DEFAULTS.review;
  return {
    acts: new Map(acts.map((a) => [a.id, a])), review,
    deliverables: acts.filter((a) => (a.kind && a.kind !== 'site' && a.source !== 'derived') || /\b(submi(t|ssion)|approval)\b/i.test(a.name))
      .sort((a, b) => (a.id < b.id ? -1 : 1)),
  };
}

// The live state of an item from the record raised for it (S0).
function liveState(rec) {
  if (!rec) return { status: 'not raised', actual_submit: null, code: '', rev: '' };
  const wf = safeJson(rec.workflow, []);
  const issued = wf.find((s) => s && s.issue && s.state === 'done');
  const code = (String(rec.status || '').match(/\bcode\s*([ABCD])\b/i) || [])[1] || (safeJson(rec.data, {}).Code || '');
  const data = safeJson(rec.data, {});
  return { status: rec.status || 'raised', actual_submit: (issued && (issued.at || issued.when) ? String(issued.at || issued.when).slice(0, 10) : (rec.submitted || '').slice(0, 10)) || null,
           code: String(code || '').toUpperCase(), rev: data.Rev || data.Revision || '' };
}

// One schedule, as it stands today.
export async function readSchedule(env, pid, schedule) {
  await ensureScheduleTables(env);
  if (!SCHEDULES[schedule]) return null;
  const project = await safe(() => env.DB.prepare('SELECT * FROM projects WHERE id = ?').bind(pid).first(), null);
  const ctx = await dateContext(env, pid, project);
  const secs = new Map(((await safe(() => liveSections(env, pid), [])) || []).map((s) => [s.code, s]));
  const meta = (await env.DB.prepare('SELECT * FROM schedule_meta WHERE project_id = ? AND schedule = ?').bind(pid, schedule).first()) || { state: 'draft' };
  const baseline = safeJson(meta.baseline, {});
  const rows = (await env.DB.prepare("SELECT * FROM schedule_item WHERE project_id = ? AND schedule = ? AND state <> 'removed' ORDER BY sr").bind(pid, schedule).all()).results || [];
  const refs = rows.map((r) => r.record_ref).filter(Boolean);
  const recs = new Map();
  for (const ref of refs) {
    const rec = await safe(() => env.DB.prepare('SELECT * FROM records WHERE project_id = ? AND ref = ?').bind(pid, ref).first(), null);
    if (rec) recs.set(ref, rec);
  }
  const today = todayUAE();
  const items = rows.map((r) => {
    const sec = secs.get(r.spec_code);
    const it = { ...r, based_on: safeJson(r.based_on, []), activities: safeJson(r.activities, []), hold_points: safeJson(r.hold_points, []), spec_title: sec ? sec.title : '' };
    const d = plannedDates(it, ctx);
    const live = liveState(recs.get(r.record_ref));
    const act = r.activity_id ? ctx.acts.get(r.activity_id) : null;
    const inspections = schedule === 'itp' ? it.activities.map((id) => ctx.acts.get(id)).filter(Boolean)
      .map((a) => ({ activity: a.id, name: a.name, planned: (a.planned_start || '').slice(0, 10) })) : [];
    return { ...it, planned_submit: d.submit, planned_approval: d.approval, date_source: d.source, date_note: d.note || d.rule || '',
             activity_name: act ? act.name : '', baseline_submit: baseline[r.id] || null, ...live,
             late: !!(d.submit && d.submit < today && !live.actual_submit), inspections };
  });
  return { schedule, ...SCHEDULES[schedule], state: meta.state || 'draft', approved_by: meta.approved_by || null, approved_at: meta.approved_at || null,
           generated_at: meta.generated_at || null, items, data_date: (project && project.data_date) || null };
}

// ---------------------------------------------------------------- P3 coverage gates
// Every one must be clear before the PM can approve the material schedule:
// pages not read, requirement hits with no item, sections naming vendors with
// no item, BOQ lines with no item, and (when the AI has read the IFC sheets)
// finishes with no item. A person clears each, with a reason.
export async function coverageGates(env, pid) {
  await ensureScheduleTables(env);
  const I = await inputs(env, pid);
  const items = (await env.DB.prepare("SELECT spec_code, boq_ref, description FROM schedule_item WHERE project_id = ? AND schedule = 'material' AND state <> 'removed'").bind(pid).all()).results || [];
  const res = new Map(((await env.DB.prepare("SELECT gate_key, resolution, decided_by FROM schedule_resolution WHERE project_id = ? AND schedule = 'material'").bind(pid).all()).results || [])
    .map((r) => [r.gate_key, r]));
  const covered = new Set(items.map((i) => i.spec_code).filter(Boolean));
  const coveredBoq = new Set(items.map((i) => i.boq_ref).filter(Boolean));
  const linkedBoq = new Set(I.links.filter((l) => l.from_kind === 'spec' && l.to_kind === 'boq' && covered.has(l.from_ref)).map((l) => l.to_ref));
  const gates = [];
  const ix = await safe(() => env.DB.prepare("SELECT result FROM spec_index WHERE project_id = ? AND state = 'confirmed'").bind(pid).all(), { results: [] });
  for (const r of ix.results || []) for (const pg of (safeJson(r.result, {}).unread_pages || [])) gates.push({ key: 'page:' + pg, gate: 'Pages not read', what: 'Specification page ' + pg + ' has no text (a scan) — read it by hand' });
  for (const s of I.secs) {
    const rq = s.requirements || {};
    if (((rq.product_data || []).length || (rq.samples || []).length) && !covered.has(s.code)) gates.push({ key: 'hit:' + s.code, gate: 'Requirement with no item', what: s.code + ' ' + s.title + ' asks for product data or samples' });
    if ((s.manufacturers || []).length && !covered.has(s.code)) gates.push({ key: 'vendor:' + s.code, gate: 'Approved vendors with no item', what: s.code + ' names ' + s.manufacturers.join(', ') });
  }
  for (const l of I.boq) {
    const ref = String(l.ref || l.id);
    if (!coveredBoq.has(ref) && !linkedBoq.has(ref)) gates.push({ key: 'boq:' + ref, gate: 'BOQ line with no item', what: ref + ' ' + (l.description || '') });
  }
  const finishes = ((await safe(() => env.DB.prepare('SELECT number, contents FROM kb_drawing_contents WHERE project_id = ?').bind(pid).all(), { results: [] })).results) || [];
  const descs = items.map((i) => String(i.description).toLowerCase());
  for (const f of finishes) for (const m of (safeJson(f.contents, {}).materials || [])) {
    if (!descs.some((d) => words(m).some((w) => d.includes(w)))) gates.push({ key: 'finish:' + f.number + ':' + m, gate: 'IFC finish with no item', what: m + ' (shown on ' + f.number + ')' });
  }
  const out = gates.map((g) => ({ ...g, resolved: res.has(g.key), resolution: res.get(g.key) ? res.get(g.key).resolution : null, by: res.get(g.key) ? res.get(g.key).decided_by : null }));
  return { gates: out, open: out.filter((g) => !g.resolved).length };
}

export async function resolveGate(env, pid, key, resolution, who) {
  await ensureScheduleTables(env);
  if (!String(resolution || '').trim()) return { error: 'say how it is covered, or why it needs no item' };
  await env.DB.prepare(
    `INSERT INTO schedule_resolution (project_id, schedule, gate_key, resolution, decided_by, decided_at) VALUES (?,?,?,?,?,?)
     ON CONFLICT (project_id, schedule, gate_key) DO UPDATE SET resolution = excluded.resolution, decided_by = excluded.decided_by, decided_at = excluded.decided_at`
  ).bind(pid, 'material', str(key, 200), str(resolution, 300), str(who, 120), nowISO()).run();
  return { ok: true };
}

// ---------------------------------------------------------------- review and approval
const EDITABLE = ['discipline', 'description', 'spec_code', 'supplier', 'brand', 'activity_id', 'lead_days', 'manual_submit', 'boq_ref', 'notes'];
export async function editItem(env, pid, id, body, who) {
  await ensureScheduleTables(env);
  const it = await env.DB.prepare('SELECT * FROM schedule_item WHERE id = ? AND project_id = ?').bind(String(id), pid).first();
  if (!it) return { error: 'no such item' };
  const sets = [], args = [];
  for (const k of EDITABLE) {
    if (!(k in body)) continue;
    let v = body[k];
    if (k === 'lead_days') { v = v === '' || v == null ? null : Math.round(Number(v)); if (v != null && (!Number.isFinite(v) || v < 0 || v > 730)) return { error: 'a lead time is 0 to 730 days' }; }
    else if (k === 'manual_submit') { v = v ? String(v).slice(0, 10) : null; if (v && !/^\d{4}-\d{2}-\d{2}$/.test(v)) return { error: 'a date is YYYY-MM-DD' }; }
    else v = v == null ? null : str(v, 300);
    sets.push(k + ' = ?'); args.push(v);
  }
  if (body.remove) { sets.push("state = 'removed'"); }
  else if (body.confirm) { sets.push("state = 'confirmed'"); }
  if (!sets.length) return { error: 'nothing to change' };
  sets.push('updated_by = ?', 'updated_at = ?'); args.push(str(who, 120), nowISO());
  await env.DB.prepare('UPDATE schedule_item SET ' + sets.join(', ') + ' WHERE id = ? AND project_id = ?').bind(...args, String(id), pid).run();
  return { ok: true };
}

export async function addItem(env, pid, schedule, body, who) {
  await ensureScheduleTables(env);
  if (!SCHEDULES[schedule]) return { error: 'no such schedule' };
  if (!String(body.description || '').trim()) return { error: 'an item needs a description' };
  const max = await env.DB.prepare('SELECT COALESCE(MAX(sr),0) AS n FROM schedule_item WHERE project_id = ? AND schedule = ?').bind(pid, schedule).first();
  const id = uid('sch');
  await env.DB.prepare(
    `INSERT INTO schedule_item (id, project_id, schedule, sr, discipline, description, spec_code, activity_id, lead_days, source, source_key, basis, state, created_at, updated_by)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).bind(id, pid, schedule, (Number(max && max.n) || 0) + 1, str(body.discipline, 60), str(body.description, 300), str(body.spec_code, 20),
         body.activity_id || null, body.lead_days === '' || body.lead_days == null ? null : Math.round(Number(body.lead_days)),
         'manual', 'manual|' + id, 'added by ' + str(who, 120), 'confirmed', nowISO(), str(who, 120)).run();
  return { ok: true, id };
}

// The PM approves the schedule as the baseline. P3 is refused while a coverage
// gate is open.
export async function approveSchedule(env, pid, schedule, who) {
  await ensureScheduleTables(env);
  if (!SCHEDULES[schedule]) return { error: 'no such schedule' };
  if (schedule === 'material') {
    const g = await coverageGates(env, pid);
    if (g.open) return { error: g.open + ' coverage gaps are still open. Design / Procurement clear each one before the PM can approve the material schedule.', open: g.open };
  }
  const s = await readSchedule(env, pid, schedule);
  if (!s.items.length) return { error: 'the schedule has no items' };
  const baseline = Object.fromEntries(s.items.map((i) => [i.id, i.planned_submit]));
  await env.DB.prepare("UPDATE schedule_item SET state = 'confirmed' WHERE project_id = ? AND schedule = ? AND state = 'proposed'").bind(pid, schedule).run();
  await env.DB.prepare(
    `INSERT INTO schedule_meta (project_id, schedule, state, baseline, approved_by, approved_at) VALUES (?,?,?,?,?,?)
     ON CONFLICT (project_id, schedule) DO UPDATE SET state = excluded.state, baseline = excluded.baseline, approved_by = excluded.approved_by, approved_at = excluded.approved_at`
  ).bind(pid, schedule, 'approved', JSON.stringify(baseline), str(who, 120), nowISO()).run();
  return { ok: true, state: 'approved', items: s.items.length };
}

// Items due within a week, or late, on approved schedules — for the owners'
// Needs my attention (P2 step 5).
export async function dueItems(env, pid, fns) {
  await ensureScheduleTables(env);
  const out = [];
  const soon = addDays(todayUAE(), 7);
  for (const [k, v] of Object.entries(SCHEDULES)) {
    if (!v.reviewers.some((r) => (fns || []).includes(r))) continue;
    const meta = await env.DB.prepare('SELECT state FROM schedule_meta WHERE project_id = ? AND schedule = ?').bind(pid, k).first();
    if (!meta || meta.state !== 'approved') continue;
    const s = await readSchedule(env, pid, k);
    const due = s.items.filter((i) => i.planned_submit && i.planned_submit <= soon && !i.actual_submit);
    if (due.length) out.push({ schedule: k, label: v.label, count: due.length, late: due.filter((i) => i.late).length, first: due.map((i) => i.planned_submit).sort()[0] });
  }
  return out;
}

export const AI_SYSTEM = 'You help build construction submittal schedules from a specification. You only use the sections given. You never invent section numbers.';
export function aiPrompt(schedule, sections, existing) {
  const what = { shop: 'shop drawings the contractor must produce', material: 'materials and products that need approval', ms: 'method statements for work methods', itp: 'inspection and test plans' }[schedule];
  return 'From these specification sections, propose the ' + what + ' that are not already listed. Answer as JSON only: ' +
    '{"items": [{"spec_code": "<exactly as given>", "description": "..."}]}.\n\nSECTIONS:\n' +
    sections.map((s) => s.code + ' | ' + s.title).join('\n') + '\n\nALREADY LISTED:\n' + existing.map((e) => e.spec_code + ' | ' + e.description).join('\n');
}
export const RISK_SYSTEM = 'You draft construction risk assessments for an HSE officer to check. Plain, specific, no invented figures.';
export const riskPrompt = (item) => 'Draft a risk assessment for this method statement: "' + item.description + '"' +
  (item.basis ? ' (' + item.basis + ')' : '') + '. List the main hazards, who is at risk, the controls, and the residual risk, as short lines.';
