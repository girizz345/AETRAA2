// The daily site diary — the sheet that goes to the Consultant every day.
//
// It is stored as one record per project per day, not written out as a document
// and forgotten. That is the whole point: a diary kept as data is a labour and
// events record you can read back a year later, and the document is a print of
// it rather than the thing itself.
//
// The labour record is also written into the manpower table, so the dashboard
// and the monthly report keep working off one set of numbers.

import { addColumns } from './db-cols.js';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const dnum = (d) => (d && DATE_RE.test(d) ? Date.parse(d + 'T00:00:00Z') / 86400000 : null);

// K8 (v5 E15, "Manpower by trade and day"): the manpower log carries the
// subcontractors' gangs too, marked by whose they are. Own staff rows have no
// subcontractor; a save of either kind replaces only its own kind of row.
let MP_SUB = false;
export async function ensureManpowerSub(env) {
  if (!MP_SUB) MP_SUB = await addColumns(env, 'manpower', [['subcontractor', 'TEXT']]);
  return MP_SUB;
}
// K13 (v5 A12): the diary has a problems field — anything that held the work
// up or needs the office — on the screen and on both prints.
let PROBLEMS = false;
export async function ensureDiaryProblems(env) {
  if (!PROBLEMS) PROBLEMS = await addColumns(env, 'diary', [['problems', 'TEXT']]);
  return PROBLEMS;
}
const dstr = (n) => new Date(n * 86400000).toISOString().slice(0, 10);
export const shiftDay = (d, n) => dstr(dnum(d) + n);

const MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December'];
const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

export function longDate(d) {
  if (!d || !DATE_RE.test(d)) return d || '';
  const [y, m, day] = d.split('-');
  return `${Number(day)} ${MONTHS[Number(m) - 1]} ${y}`;
}
export function slashDate(d) {
  if (!d || !DATE_RE.test(d)) return d || '';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}
export const dayName = (d) => (DATE_RE.test(d || '') ? DAYS[new Date(d + 'T00:00:00Z').getUTCDay()] : '');

/* ------------------------------------------------------------- the roster */

// The trades as they appear on the sheet, in order. "indirect" marks the ones
// that are on site but not putting work in place — that is what separates the
// grand total from productive manpower.
export const DEFAULT_TRADES = [
  { t: 'Project Manager', indirect: true },
  { t: 'MEP Engineer', indirect: true },
  { t: 'Senior project manager', indirect: true },
  { t: 'Surveyor', indirect: true },
  { t: 'Surveyor Helper' },
  { t: 'Safety Officer', indirect: true },
  { t: 'AC Foreman' },
  { t: 'Document Controller', indirect: true },
  { t: 'Post tension foreman' },
  { t: 'AC Technician' },
  { t: 'Mason' },
  { t: 'Steel Fixer' },
  { t: 'Carpenter' },
  { t: 'Helper' },
  { t: 'Plumber' },
  { t: 'MEP foreman' },
  { t: 'Crane Operator' },
  { t: 'Bobcat operator' },
  { t: 'Watchman', indirect: true },
  { t: 'Office Boy' },
  { t: 'Block Work Foreman' },
  { t: 'Site Engineer', indirect: true },
  { t: 'Storekeeper', indirect: true },
  { t: 'Tower Crane operator' },
  { t: 'Safety helper' },
  { t: 'PT worker' },
  { t: 'Riger' },
  { t: 'Charge in hand' },
  { t: 'Planning Engineer', indirect: true },
  { t: 'Block Mason' },
  { t: 'Electrician' },
  { t: 'Block work helper' },
  { t: 'Scaffolder supply' },
  // Found on the issued sheets when a year of them was read back in. They were
  // never on the typed roster, so a man-day of each was being lost.
  { t: 'Foreman' },
  { t: 'Civil Foreman' },
  { t: 'Boom loader operator' },
  { t: 'Excavator operator' },
  { t: 'Painter' },
  { t: 'AC Worker' },
  { t: 'Block Work Mason' },
  { t: 'Welder' },
  { t: 'Wooden Cutter' },
  { t: 'Cutter' },
  { t: 'Draft man', indirect: true },
  { t: 'Site foreman' },
  { t: 'Carpenter foreman' },
  { t: 'Steel foreman' },
  { t: 'Steel fixer Foreman' },
  { t: 'Plumbing Foreman' },
  { t: 'Labor supply Foreman' },
  { t: 'Company Carpenter' },
  { t: 'Company Mason' },
  { t: 'Mason Helper' },
  { t: 'Block Helper' },
  { t: 'Carpenter helper' },
  { t: 'MEP helpers' },
  { t: 'Column Mason' },
  { t: 'Block worker' },
  { t: 'Upstand worker' },
  { t: 'Scaffolder' },
  { t: 'Trucker operator' },
  { t: 'Mobile Crane Operator' },
  { t: 'Tiles workers' },
  { t: 'Ceiling painter' },
  { t: 'Cocreate worker' },
  // Scopes the sheet lists in the labour column rather than by trade — usually a
  // labour-supply gang. They are men on site and the sheet's own grand total
  // counts them, so they are counted here too.
  { t: 'Fire Fighting /Fire Alarm' },
  { t: 'Fire Fighting' },
  { t: 'Aluminium work' },
  { t: 'Aluminium door fixing' },
  { t: 'Water proofing work' },
  { t: 'Water Proofing' },
  { t: 'Waterproof' },
  { t: 'Floor grinding' },
  { t: 'Ceiling grinding' },
  { t: 'Floor Coat' },
  { t: 'Plaster' },
  { t: 'Plastering' },
  { t: 'Plastering Mason' },
  { t: 'HVAC' },
  { t: 'MEP' },
  { t: 'AC' },
  { t: 'AC Installation' },
  { t: 'Post tension' },
  { t: 'PT' },
  { t: 'GRP lining' },
  { t: 'Metal works' },
  { t: 'Garbage chute' },
  { t: 'Hoist Setting' },
  { t: 'Crane section fixing' },
  { t: 'Safety work' },
  // Written as one row covering two gangs. Counted once, under the name on the
  // sheet, rather than split on a guess about who was which.
  { t: 'Steel fixer helper & carpenter' },
  { t: 'Steel foreman& Carpenter foreman' },
  { t: 'Carpenter foreman & Steel foreman' },
  { t: 'Carpenter & steel foreman' },
  { t: 'Carpenter & Steel fixer Helper' },
  { t: 'Carpenter, steel fixer, and foreman' },
  { t: 'Steel fixer & carpenter' },
];

// What a man is on site as, rather than what trade he is in. A subcontractor
// sends a foreman and eight masons; both are "Block Mason" by trade, and the
// difference between them is the difference between supervision and labour —
// which is exactly the split that matters when the cost of a day is questioned.
export const DEFAULT_POSITIONS = [
  'Engineer', 'Foreman', 'Supervisor', 'Chargehand', 'Skilled', 'Semi-skilled',
  'Helper', 'Operator', 'Driver', 'Safety officer', 'Storekeeper', 'Watchman',
];

export const DEFAULT_PLANT = [
  'Boom Loader', 'Bending machine', 'Bobcat', 'Generator', 'Excavator',
  'Power plot machine', 'Steel cutting machine', 'Hydraulic breaker hammer',
  'AIR Compressor', 'Steel Bending Machine', 'Water Pump', 'Mobile crane',
  'Truck mounted concrete pump', 'Roller', 'Steel compactor', 'Roller compactor',
  // Likewise found on the sheets themselves. The last three are site facilities
  // rather than machines, but they are logged on the plant record and they cost
  // money, so they are counted where they are written.
  'JCB', 'Bulldozer', 'Compressor', 'Dewatering machine', 'Tower Light',
  'Power flot', 'Trucks', 'Fire pump', 'Tri pod',
  'Portacabin', 'Toilet block', 'Water tank', 'Passenger hoist', 'Crane',
];

// The materials that carry the money on a UAE building job. The unit is fixed
// with the material on purpose: a delivery booked in tonnes against a material
// measured in cubic metres is worse than no figure at all.
export const DEFAULT_MATERIALS = [
  { m: 'Ready-mix concrete C25', u: 'm³' },
  { m: 'Ready-mix concrete C32', u: 'm³' },
  { m: 'Ready-mix concrete C40', u: 'm³' },
  { m: 'Ready-mix concrete C50', u: 'm³' },
  { m: 'Steel reinforcement', u: 'ton' },
  { m: 'Post-tension strand', u: 'ton' },
  { m: 'Hollow block 200mm', u: 'no' },
  { m: 'Hollow block 150mm', u: 'no' },
  { m: 'Hollow block 100mm', u: 'no' },
  { m: 'Cement', u: 'bag' },
  { m: 'Sand', u: 'm³' },
  { m: 'Aggregate', u: 'm³' },
  { m: 'Plywood / shuttering', u: 'sheet' },
  { m: 'Timber', u: 'm' },
  { m: 'Waterproofing membrane', u: 'm²' },
  { m: 'Thermal insulation', u: 'm²' },
  { m: 'Floor tiles', u: 'm²' },
  { m: 'Paint', u: 'L' },
  { m: 'GI duct', u: 'm²' },
  { m: 'Copper pipe', u: 'm' },
  { m: 'uPVC pipe', u: 'm' },
  { m: 'Cable', u: 'm' },
  { m: 'Conduit', u: 'm' },
  { m: 'Cable tray', u: 'm' },
];

export const WEATHER = ['Sunny', 'Cloudy', 'Rainy', 'Windy', 'Dusty'];

const parse = (v, fallback) => {
  if (!v) return fallback;
  try { const j = JSON.parse(v); return Array.isArray(j) ? j : fallback; } catch (e) { return fallback; }
};

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : 0;
};
const clean = (v, max = 200) => String(v === null || v === undefined ? '' : v).trim().slice(0, max);

/* ------------------------------------------------------------ the totals */

// Grand total is everyone on site. Productive leaves out the indirect trades —
// that is the pair of numbers the Consultant reads first.
export function totals(staff, roster) {
  const indirect = new Set(roster.filter((r) => r.indirect).map((r) => r.t));
  let total = 0, productive = 0;
  for (const r of staff) {
    const n = num(r.n);
    total += n;
    if (!indirect.has(r.t)) productive += n;
  }
  return { total, productive, indirect: total - productive };
}
// Men on site working for a subcontractor.
//
// The diary used to hold one line per subcontractor with two numbers on it —
// staff and labour. It now holds one line per gang: who they work for, what
// trade, what position, how many. Both shapes are counted here, because there
// are months of issued diaries in the old one and they still have to total.
export const sumSubs = (subs) =>
  (subs || []).reduce((s, r) => s + (r.c !== undefined && r.c !== null && r.c !== ''
    ? num(r.c)
    : num(r.s) + num(r.l)), 0);

// The same men, split by what they were there as. A day where a subcontractor
// sent nine men and one of them was a foreman is a different day from one where
// he sent nine men and no supervision at all.
export function subsByPosition(subs, positions = DEFAULT_POSITIONS) {
  const supervision = new Set(['Engineer', 'Foreman', 'Supervisor', 'Safety officer']);
  const out = { total: 0, supervision: 0, labour: 0, by_sub: {}, by_trade: {} };
  for (const r of subs || []) {
    const n = r.c !== undefined && r.c !== null && r.c !== ''
      ? num(r.c) : num(r.s) + num(r.l);
    if (!n) continue;
    out.total += n;
    // An old-shape row carries its own split; a new one is read off the position.
    if (r.c !== undefined && r.c !== null && r.c !== '') {
      if (supervision.has(r.p)) out.supervision += n; else out.labour += n;
    } else {
      out.supervision += num(r.s); out.labour += num(r.l);
    }
    const who = clean(r.n, 160) || '(not named)';
    out.by_sub[who] = (out.by_sub[who] || 0) + n;
    if (r.t) out.by_trade[r.t] = (out.by_trade[r.t] || 0) + n;
  }
  return out;
}

/* ----------------------------------------------------------- reading it */

// Who has been on this job before. Read from the diaries themselves rather than
// kept in a separate list, so it cannot drift out of date and nobody has to
// maintain it.
async function knownSubs(env, pid) {
  try {
    const { results } = await env.DB.prepare(
      `SELECT subs FROM diary WHERE project_id = ? AND COALESCE(subs,'') NOT IN ('','[]')
        ORDER BY report_date DESC LIMIT 200`
    ).bind(pid).all();
    const seen = new Map();
    for (const row of results || []) {
      for (const r of parse(row.subs, [])) {
        const n = clean(r && r.n, 160);
        if (n) seen.set(n.toLowerCase(), n);
      }
    }
    return [...seen.values()].sort((a, b) => a.localeCompare(b));
  } catch (err) {
    return [];
  }
}

async function projectRoster(env, pid, project) {
  const p = project || {};
  const trades = parse(p.diary_trades, null);
  const plant = parse(p.diary_plant, null);
  const materials = parse(p.materials, null);
  const positions = parse(p.diary_positions, null);
  return {
    positions: positions && positions.length ? positions : DEFAULT_POSITIONS,
    // Every subcontractor already named on this job, so the name is typed once
    // and picked from then on — which is what lets their men be totalled rather
    // than counted separately under three spellings.
    subcontractors: await knownSubs(env, pid),
    trades: trades && trades.length ? trades : DEFAULT_TRADES,
    plant: plant && plant.length ? plant : DEFAULT_PLANT.map((t) => ({ t })),
    // The project's material list, so a delivery can be picked rather than
    // spelt afresh every day. Anything unusual can still be typed.
    materials: materials && materials.length ? materials : DEFAULT_MATERIALS,
  };
}

async function readRow(env, pid, day) {
  try {
    return await env.DB.prepare('SELECT * FROM diary WHERE project_id = ? AND report_date = ?')
      .bind(pid, day).first();
  } catch (err) {
    return undefined;   // table not there yet
  }
}

// The previous day that actually has a diary — not simply yesterday, because
// Fridays and holidays leave gaps.
async function previousRow(env, pid, day) {
  try {
    return await env.DB.prepare(
      `SELECT * FROM diary WHERE project_id = ? AND report_date < ?
        ORDER BY report_date DESC LIMIT 1`
    ).bind(pid, day).first();
  } catch (err) {
    return null;
  }
}

// What a new day opens with. Yesterday's roster and plant carry forward with
// their numbers, and yesterday's "expected works tomorrow" becomes today's
// description of works — which is the whole reason that column is on the sheet.
function carryForward(prev, roster) {
  const prevStaff = Object.fromEntries(parse(prev && prev.staff, []).map((r) => [r.t, r]));
  const prevPlant = Object.fromEntries(parse(prev && prev.plant, []).map((r) => [r.t, r]));
  return {
    staff: roster.trades.map((r) => ({ t: r.t, n: num((prevStaff[r.t] || {}).n), h: (prevStaff[r.t] || {}).h || '' })),
    plant: roster.plant.map((r) => ({ t: r.t, n: num((prevPlant[r.t] || {}).n), h: (prevPlant[r.t] || {}).h || '' })),
    subs: parse(prev && prev.subs, []).map((r) => (r.c !== undefined
      ? { n: r.n, t: r.t || '', p: r.p || '', c: r.c || '', h: r.h || '' }
      : { n: r.n, t: '', p: '', c: String(num(r.s) + num(r.l) || ''), h: '' })),
    works: parse(prev && prev.tomorrow, []).filter((r) => clean(r.a)).map((r) => ({ a: r.a, q: '' })),
    materials: [],
    tomorrow: [],
    weather: '',
    carried_from: prev ? prev.report_date : null,
  };
}

// A stored diary row, as the sheet and the page read it. One function for the
// diary as it stands and for any earlier version of it, so a kept version
// prints exactly the way it printed on the day it was submitted.
function shapeRow(row, roster, day) {
  const staff = parse(row.staff, []);
  const subs = parse(row.subs, []);
  return {
    roster,
    exists: true,
    report_date: day,
    weather: row.weather || '',
    staff,
    plant: parse(row.plant, []),
    materials: parse(row.materials, []),
    works: parse(row.works, []),
    tomorrow: parse(row.tomorrow, []),
    subs,
    remarks: row.remarks || '',
    visitors: row.visitors || '',
    problems: row.problems || '',
    prepared_by: row.prepared_by || '',
    status: row.status || 'draft',
    submitted_at: row.submitted_at || null,
    updated_at: row.updated_at || null,
    totals: totals(staff, roster.trades),
    subTotal: sumSubs(subs),
  };
}

export async function loadDiary(env, pid, day, project) {
  const roster = await projectRoster(env, pid, project);
  const row = await readRow(env, pid, day);
  if (row === undefined) return { missing: true, roster };

  if (row) return shapeRow(row, roster, day);

  // Nothing saved for this day yet — open it filled in from the last one.
  const prev = await previousRow(env, pid, day);
  const seed = carryForward(prev, roster);

  // If site already logged manpower for this date on the Manpower tab, that
  // wins over yesterday's numbers — it is today's actual count.
  try {
    await ensureManpowerSub(env);
    const { results } = await env.DB.prepare(
      "SELECT trade, headcount FROM manpower WHERE project_id = ? AND report_date = ? AND COALESCE(subcontractor, '') = ''"
    ).bind(pid, day).all();
    const today = Object.fromEntries((results || []).map((r) => [r.trade, r.headcount]));
    if (Object.keys(today).length) {
      seed.staff = seed.staff.map((r) => (today[r.t] !== undefined ? { ...r, n: num(today[r.t]) } : { ...r, n: 0 }));
      for (const [t, n] of Object.entries(today)) {
        if (!seed.staff.some((r) => r.t === t)) seed.staff.push({ t, n: num(n), h: '' });
      }
    }
  } catch (e) { /* manpower is optional */ }

  return {
    roster, exists: false, report_date: day, ...seed,
    remarks: '', visitors: '', problems: '', prepared_by: '', status: 'draft',
    totals: totals(seed.staff, roster.trades),
    subTotal: sumSubs(seed.subs),
  };
}

/* ----------------------------------------------------------- writing it */

// Only what the caller actually sent is written. A save that leaves out the
// remarks must not wipe yesterday's remarks — the page always posts the whole
// form, but nothing else should have to.
export async function saveDiary(env, pid, body, who) {
  const day = DATE_RE.test(body.report_date || '') ? body.report_date : null;
  if (!day) return { error: 'which day is this diary for?' };

  const rows = (v, map, keep) => (Array.isArray(v) ? v : []).map(map).filter(keep);
  const field = {};
  const has = (k) => body[k] !== undefined && body[k] !== null;

  if (has('staff')) {
    field.staff = rows(body.staff, (r) => ({ t: clean(r.t, 120), n: num(r.n), h: clean(r.h, 12) }), (r) => r.t);
  }
  if (has('plant')) {
    field.plant = rows(body.plant, (r) => ({ t: clean(r.t, 120), n: num(r.n), h: clean(r.h, 12) }), (r) => r.t);
  }
  if (has('materials')) {
    // K11 (v5 A5): a delivery confirmed from its delivery note also carries the
    // supplier, the note number, the batch and the note it came from.
    field.materials = rows(body.materials,
      (r) => ({ m: clean(r.m, 160), q: clean(r.q, 24), u: clean(r.u, 24),
        ...(r.s ? { s: clean(r.s, 120) } : {}), ...(r.dn ? { dn: clean(r.dn, 40) } : {}),
        ...(r.b ? { b: clean(r.b, 40) } : {}), ...(r.src ? { src: clean(r.src, 40) } : {}) }), (r) => r.m);
  }
  for (const k of ['works', 'tomorrow']) {
    if (has(k)) field[k] = rows(body[k], (r) => ({ a: clean(r.a, 400), q: clean(r.q, 16) }), (r) => r.a);
  }
  if (has('subs')) {
    // A gang line carries a count; a line from an older diary, or from the Word
    // reader, carries staff and labour instead. Whichever shape arrives is the
    // shape kept — normalising one into the other would throw away the split on
    // the way in, and it is the split that answers the question later.
    field.subs = rows(body.subs, (r) => {
      const row = {
        n: clean(r.n, 160),
        t: clean(r.t, 120),
        p: clean(r.p, 60),
      };
      if (r.c !== undefined && r.c !== null && r.c !== '') {
        row.c = clean(r.c, 12);
        row.h = clean(r.h, 12);
      } else {
        row.s = clean(r.s, 12);
        row.l = clean(r.l, 12);
      }
      return row;
    }, (r) => r.n);
  }

  const text = {};
  if (has('weather')) {
    text.weather = String(body.weather).split(',').map((s) => s.trim())
      .filter((s) => WEATHER.includes(s)).join(', ');
  }
  if (has('remarks')) text.remarks = clean(body.remarks, 3000);
  if (has('visitors')) text.visitors = clean(body.visitors, 1000);
  if (has('problems') && await ensureDiaryProblems(env)) text.problems = clean(body.problems, 3000);
  const by = clean(body.prepared_by, 120) || clean(who, 120);
  if (by) text.prepared_by = by;

  const submitted = !!body.submit;
  const stamp = new Date().toISOString();

  const cols = { ...text };
  for (const [k, v] of Object.entries(field)) cols[k] = JSON.stringify(v);
  cols.updated_at = stamp;
  if (submitted) { cols.status = 'submitted'; cols.submitted_at = stamp; }

  /* A SUBMITTED DIARY IS NOT OVERWRITTEN. IT IS REVISED.
   *
   * The diary as submitted is the contemporaneous record — the thing a delay
   * claim, an Engineer's query or an arbitrator reads to find out what was on
   * site that day. It could be changed afterwards, and the change replaced it:
   * nothing kept what had been submitted, and nothing recorded that it had
   * been changed at all. A record that can be rewritten without trace is not
   * evidence of anything.
   *
   * So before a submitted diary is changed, the version as it stood is kept —
   * whole, with who changed it, when, and the reason given. The diary itself
   * still shows the corrected figures, because the correction may be right;
   * what changes is that the original can always be produced beside it. */
  let revised = null;
  const before = await readRow(env, pid, day);
  if (before && before.status === 'submitted') {
    const changes = Object.keys(cols).filter((k) => !['updated_at', 'submitted_at', 'status'].includes(k))
      .some((k) => String(before[k] == null ? '' : before[k]) !== String(cols[k] == null ? '' : cols[k]));
    // Who is changing it, which is not necessarily who prepared it: the site
    // engineer writes the diary, the office corrects it, and it is the office
    // whose name belongs on the correction.
    if (changes) revised = await keepVersion(env, pid, day, before,
      clean(body.changed_by, 120) || by || 'unknown', clean(body.reason, 500));
  }

  const names = Object.keys(cols);
  const all = ['project_id', 'report_date', 'created_at', 'status', ...names.filter((n) => n !== 'status')];
  const values = [pid, day, stamp, cols.status || 'draft',
                  ...names.filter((n) => n !== 'status').map((n) => cols[n])];

  // A diary that has been issued stays issued — a later correction does not
  // quietly turn it back into a draft.
  const updates = names.filter((n) => n !== 'status')
    .map((n) => `${n}=excluded.${n}`)
    .concat(["status=CASE WHEN excluded.status='submitted' THEN 'submitted' ELSE diary.status END"]);

  await env.DB.prepare(
    `INSERT INTO diary (${all.join(', ')}) VALUES (${all.map(() => '?').join(',')})
     ON CONFLICT(project_id, report_date) DO UPDATE SET ${updates.join(', ')}`
  ).bind(...values).run();

  // Keep the manpower record in step, so the dashboard chart and the monthly
  // report read the same numbers site typed here.
  await ensureManpowerSub(env);
  if (field.staff) {
    const withMen = field.staff.filter((r) => r.n > 0);
    const stmts = [
      env.DB.prepare("DELETE FROM manpower WHERE project_id = ? AND report_date = ? AND COALESCE(subcontractor, '') = ''").bind(pid, day),
      ...withMen.map((r) => env.DB.prepare(
        `INSERT INTO manpower (project_id, report_date, trade, headcount, plant, submitted_by, created_at)
         VALUES (?,?,?,?,?,?,?)`
      ).bind(pid, day, r.t, r.n, null, by || 'diary', stamp)),
    ];
    for (let i = 0; i < stmts.length; i += 40) await env.DB.batch(stmts.slice(i, i + 40));
  }
  // K8: the subcontractors' gangs, in the same log, marked as theirs.
  if (field.subs) {
    const gangs = field.subs.filter((r) => r.c !== undefined && num(r.c) > 0);
    const stmts = [
      env.DB.prepare("DELETE FROM manpower WHERE project_id = ? AND report_date = ? AND COALESCE(subcontractor, '') <> ''").bind(pid, day),
      ...gangs.map((r) => env.DB.prepare(
        `INSERT INTO manpower (project_id, report_date, trade, headcount, plant, submitted_by, created_at, subcontractor)
         VALUES (?,?,?,?,?,?,?,?)`
      ).bind(pid, day, r.t || r.p || 'Labour', num(r.c), null, by || 'diary', stamp, r.n)),
    ];
    for (let i = 0; i < stmts.length; i += 40) await env.DB.batch(stmts.slice(i, i + 40));
  }

  const now = await readRow(env, pid, day);
  return { ok: true, report_date: day, status: (now && now.status) || 'draft',
           ...(revised ? { revised: true, kept_version: revised } : {}) };
}

/* ------------------------------------------------ the versions that were kept */

let versionsReady = false;
export async function ensureDiaryVersions(env) {
  if (versionsReady) return true;
  try {
    await env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS diary_versions (
         project_id TEXT NOT NULL, report_date TEXT NOT NULL, version INTEGER NOT NULL,
         kept_at TEXT, kept_by TEXT, reason TEXT, submitted_at TEXT, row TEXT,
         PRIMARY KEY (project_id, report_date, version))`
    ).run();
    versionsReady = true;
    return true;
  } catch (e) { return false; }
}

// Version 1 is the diary as first submitted; each later one is what it said
// just before the next change. Numbered, never overwritten, never deleted.
async function keepVersion(env, pid, day, row, who, reason) {
  if (!(await ensureDiaryVersions(env))) return null;
  // PostgreSQL returns MAX() as a string. Number() or "1" + 1 is "11".
  const last = await env.DB.prepare(
    'SELECT MAX(version) AS v FROM diary_versions WHERE project_id = ? AND report_date = ?'
  ).bind(pid, day).first().catch(() => null);
  const v = (Number(last && last.v) || 0) + 1;
  await env.DB.prepare(
    `INSERT INTO diary_versions (project_id, report_date, version, kept_at, kept_by, reason, submitted_at, row)
     VALUES (?,?,?,?,?,?,?,?)`
  ).bind(pid, day, v, new Date().toISOString(), String(who || '').slice(0, 120), reason || null,
         row.submitted_at || null, JSON.stringify(row)).run();
  return v;
}

export async function listDiaryVersions(env, pid, day) {
  if (!(await ensureDiaryVersions(env))) return [];
  try {
    const { results } = await env.DB.prepare(
      `SELECT version, kept_at, kept_by, reason, submitted_at FROM diary_versions
        WHERE project_id = ? AND report_date = ? ORDER BY version`
    ).bind(pid, day).all();
    return (results || []).map((r) => ({ ...r, version: Number(r.version) }));
  } catch (e) { return []; }
}

// One kept version, shaped exactly as the diary is — so it prints as it did.
export async function loadDiaryVersion(env, pid, day, version, project) {
  if (!(await ensureDiaryVersions(env))) return null;
  const r = await env.DB.prepare(
    'SELECT row, version, kept_at, kept_by, reason FROM diary_versions WHERE project_id = ? AND report_date = ? AND version = ?'
  ).bind(pid, day, Number(version)).first().catch(() => null);
  if (!r) return null;
  let row = null;
  try { row = JSON.parse(r.row); } catch (e) { return null; }
  const roster = await projectRoster(env, pid, project);
  return { ...shapeRow(row, roster, day),
           kept: { version: Number(r.version), kept_at: r.kept_at, kept_by: r.kept_by, reason: r.reason } };
}

export async function listDiaries(env, pid, from, to) {
  try {
    const { results } = await env.DB.prepare(
      `SELECT report_date, weather, status, prepared_by, staff, subs, works, updated_at
         FROM diary WHERE project_id = ? AND report_date BETWEEN ? AND ?
        ORDER BY report_date DESC LIMIT 200`
    ).bind(pid, from, to).all();
    return (results || []).map((r) => {
      const staff = parse(r.staff, []);
      return {
        report_date: r.report_date, weather: r.weather, status: r.status,
        prepared_by: r.prepared_by, updated_at: r.updated_at,
        men: staff.reduce((s, x) => s + num(x.n), 0),
        subs: sumSubs(parse(r.subs, [])),
        works: parse(r.works, []).length,
      };
    });
  } catch (err) {
    return null;
  }
}
