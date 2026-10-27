// What the project consumed, against what it built.
//
//   node tools/test-resources.mjs
//
// The arithmetic here goes into a cost decision, so it is worth being exact
// about: that a day recorded in both the diary and the manpower table is counted
// once, that free-text hours and quantities are read the way site actually types
// them, that money never leaks to somebody not entitled to it, and that a trade
// getting slower is detected from real figures rather than asserted.
//
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import {
  buildResources, spend, pctByTrade, loadRates, saveRate, withoutMoney,
  projectMaterials, DEFAULT_MATERIALS, key, shift, RECENT_DAYS,
} from '../src/resources.js';

const db = new DatabaseSync(':memory:');
db.exec(readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));
const DB = {
  prepare(sql) {
    const st = db.prepare(sql); let args = [];
    const api = { bind(...a) { args = a; return api; },
      async all() { return { results: st.all(...args) }; },
      async first() { return st.get(...args) ?? null; },
      async run() { st.run(...args); return { success: true }; } };
    return api;
  },
  async batch(l) { for (const s of l) await s.run(); return []; },
};
const env = { DB };
const PID = 'maj';

let fails = 0, ran = 0;
function check(name, cond, detail) {
  ran++;
  console.log((cond ? '  ok   ' : '  FAIL ') + name + (detail ? '  — ' + detail : ''));
  if (!cond) { fails++; process.exitCode = 1; }
}
const section = (t) => console.log('\n' + t);
const near = (a, b, tol = 0.01) => Math.abs((a || 0) - (b || 0)) <= tol;

/* ------------------------------------------------------------ the project */

const TODAY = '2026-09-15';
const roster = [
  { t: 'Steel Fixer' }, { t: 'Carpenter' }, { t: 'Block Mason' },
  { t: 'Electrician' }, { t: 'Site Engineer', indirect: true },
  { t: 'Watchman', indirect: true },
];
db.prepare(`INSERT INTO projects (id,name,sort_order,created_at,diary_trades,currency)
            VALUES (?,?,1,datetime('now'),?,'AED')`)
  .run(PID, 'Plot 6457759', JSON.stringify(roster));
const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(PID);

// Four trades in the programme, weighted so a slab outweighs a socket.
const ACTS = [
  ['A-1', 'Steel Fixer', 'Civil', 100], ['A-2', 'Steel Fixer', 'Civil', 100],
  ['A-3', 'Carpenter', 'Civil', 50], ['A-4', 'Block Mason', 'Civil', 50],
  ['M-1', 'Electrician', 'MEP', 20],
];
for (const [id, trade, grp, w] of ACTS) {
  db.prepare(`INSERT INTO activities (project_id,id,name,level,trade,trade_group,weight,sort_order)
              VALUES (?,?,?,1,?,?,?,1)`).run(PID, id, trade + ' ' + id, trade, grp, w);
}

let seq = 0;
function progress(id, pct, date) {
  seq++;
  db.prepare(`INSERT INTO updates (project_id,activity_id,report_date,pct,status,source,created_at)
              VALUES (?,?,?,?,?, 'site', ?)`)
    .run(PID, id, date, pct, pct >= 100 ? 'complete' : 'in_progress',
         date + 'T0' + (seq % 9) + ':00:00Z');
}
function diary(date, staff, plant, materials, subs) {
  db.prepare(`INSERT INTO diary (project_id,report_date,staff,plant,materials,subs,status,created_at)
              VALUES (?,?,?,?,?,?,'submitted',?)`)
    .run(PID, date, JSON.stringify(staff || []), JSON.stringify(plant || []),
         JSON.stringify(materials || []), JSON.stringify(subs || []), date + 'T18:00:00Z');
}
function manpowerRow(date, trade, n) {
  db.prepare(`INSERT INTO manpower (project_id,report_date,trade,headcount,created_at)
              VALUES (?,?,?,?,?)`).run(PID, date, trade, n, date + 'T18:00:00Z');
}

/* ---------------------------------------------------------- the key rule */

section('Trade names from two places that were never made to agree');
{
  check('case and punctuation are flattened',
    key('Steel Fixer') === key('steel-fixer') && key('Steel Fixer') === key('STEELFIXER'));
  check('different trades stay different', key('Steel Fixer') !== key('Steel Fixing'));
  check('nothing is an empty key', key(null) === '' && key(undefined) === '');
}

section('The material list');
{
  check('a project with none set gets the built-in list',
    projectMaterials({}).length === DEFAULT_MATERIALS.length);
  check('every built-in material carries a unit',
    DEFAULT_MATERIALS.every((m) => m.m && m.u));
  check('concrete is in cubic metres, steel in tonnes',
    DEFAULT_MATERIALS.find((m) => /C40/.test(m.m)).u === 'm³' &&
    DEFAULT_MATERIALS.find((m) => /reinforcement/.test(m.m)).u === 'ton');
  check("a project's own list wins",
    projectMaterials({ materials: JSON.stringify([{ m: 'Sand', u: 'm³' }]) }).length === 1);
  check('a corrupt list falls back rather than throwing',
    projectMaterials({ materials: '{not json' }).length === DEFAULT_MATERIALS.length);
}

/* ------------------------------------------------------- counting a day */

section('Counting what was on site');
{
  diary('2026-09-01',
    [{ t: 'Steel Fixer', n: 10, h: '8' }, { t: 'Carpenter', n: 6, h: '10' },
     { t: 'Site Engineer', n: 1, h: '8' }],
    [{ t: 'Tower crane', n: 1, h: '8' }, { t: 'Excavator', n: 2, h: '6' }],
    [{ m: 'Ready-mix concrete C40', q: '120', u: 'm³' }],
    [{ n: 'Falcon Aluminium', s: '1', l: '8' }]);

  const s = await spend(env, PID, project, '2000-01-01', TODAY);
  check('men are counted as men', s.labour[key('Steel Fixer')].days === 10);
  check('hours multiply by heads', s.labour[key('Carpenter')].hours === 60, '6 men × 10 h');
  check('plant is counted as plant-days', s.plant[key('Excavator')].days === 2);
  check('plant hours multiply too', s.plant[key('Excavator')].hours === 12);
  check('a delivery is a quantity and a count',
    s.material[key('Ready-mix concrete C40')].qty === 120 &&
    s.material[key('Ready-mix concrete C40')].deliveries === 1);
  check("a subcontractor's staff and labour are one figure",
    s.subs['Falcon Aluminium'] === 9);
  check('the day is recorded once', s.daysKept.length === 1);
}

section('Free text, as site actually types it');
{
  diary('2026-09-02',
    [{ t: 'Steel Fixer', n: '12', h: '8 hrs' }, { t: 'Block Mason', n: 4, h: '' }],
    [], [{ m: 'Steel reinforcement', q: '1,250 kg', u: 'kg' }], []);

  const s = await spend(env, PID, project, '2026-09-02', '2026-09-02');
  check('a headcount typed as text still counts', s.labour[key('Steel Fixer')].days === 12);
  check('"8 hrs" is eight hours', s.labour[key('Steel Fixer')].hours === 96);
  check('a blank hours box is a working day, not zero',
    s.labour[key('Block Mason')].hours === 32, '4 × 8');
  check('a thousands comma is not a decimal point',
    s.material[key('Steel reinforcement')].qty === 1250);
}

section('A day in both the diary and the manpower table is counted once');
{
  // The diary writes through to manpower, so 09-01 exists in both.
  manpowerRow('2026-09-01', 'Steel Fixer', 10);
  manpowerRow('2026-09-01', 'Carpenter', 6);
  // 08-28 predates the diary and exists only in manpower.
  manpowerRow('2026-08-28', 'Steel Fixer', 5);

  const s = await spend(env, PID, project, '2000-01-01', TODAY);
  check('the doubled day is not doubled', s.labour[key('Steel Fixer')].days === 27,
    '10 + 12 + 5, not 37');
  check('a day only in the manpower table is still counted',
    s.daysKept.includes('2026-08-28'));
  check('and it is the earliest day on record', s.daysKept[0] === '2026-08-28');
}

/* --------------------------------------------------- progress it bought */

section('Progress, weighted');
{
  progress('A-1', 50, '2026-09-01');
  progress('A-2', 50, '2026-09-01');
  progress('A-3', 100, '2026-09-01');
  progress('A-4', 0, '2026-09-01');
  progress('M-1', 100, '2026-08-10');   // finished before the recent window opens

  const p = await pctByTrade(env, PID, TODAY);
  check('two activities at 50% make a trade 50%', near(p[key('Steel Fixer')].pct, 50));
  check('a finished trade is 100%', near(p[key('Carpenter')].pct, 100));
  check('an untouched trade is 0%', near(p[key('Block Mason')].pct, 0));
  check('the trade group comes with it', p[key('Steel Fixer')].group === 'Civil');
  check('completed activities are counted', p[key('Carpenter')].done === 1);

  const before = await pctByTrade(env, PID, '2026-08-31');
  check('as at a date before any of it, nothing is complete',
    near(before[key('Steel Fixer')].pct, 0) && near(before[key('Carpenter')].pct, 0));
}

section('Effort per point of progress');
{
  const d = await buildResources(env, PID, project, { to: TODAY });
  const sf = d.labour.by_trade.find((t) => t.trade === 'Steel Fixer');
  check('the trade is matched to the programme', sf.in_programme === true);
  check('man-days are the sum of the days', sf.man_days === 27);
  check('27 man-days for 50% is 0.54 per point', near(sf.per_point, 0.54));
  check('projected at completion is twice what is spent',
    near(sf.projected, 54), String(sf.projected));

  const bm = d.labour.by_trade.find((t) => t.trade === 'Block Mason');
  check('a trade at 0% gets no per-point figure rather than infinity',
    bm.per_point === null && bm.projected === null);

  const eng = d.labour.by_trade.find((t) => t.trade === 'Site Engineer');
  check('an indirect trade is marked as such', eng.indirect === true);
  check('and is left out of direct man-days',
    d.labour.direct_man_days === d.labour.man_days - d.labour.indirect_man_days);
  check('the subcontractor days are separate from our own',
    d.labour.sub_man_days === 9 &&
    d.labour.total_man_days === d.labour.man_days + 9);
}

section('A trade getting slower');
{
  // A month of heavy labour on a trade that was already finished before it.
  for (let i = 1; i <= 10; i++) {
    diary(shift(TODAY, -i), [{ t: 'Electrician', n: 8, h: '8' }], [], [], []);
  }

  const d = await buildResources(env, PID, project, { to: TODAY });
  const el = d.labour.by_trade.find((t) => t.trade === 'Electrician');
  check('the recent labour is picked up', el.recent_days === 80, String(el.recent_days));
  check('no progress gained means no recent rate is claimed',
    el.recent_per_point === null);
  check('and it is reported as labour with nothing to show for it',
    d.warnings.some((w) => /Electrician/.test(w) && /no progress/i.test(w)),
    JSON.stringify(d.warnings));
}

section('A trade genuinely slowing down');
{
  const P2 = 'p2';
  db.prepare(`INSERT INTO projects (id,name,sort_order,created_at) VALUES (?,?,2,datetime('now'))`)
    .run(P2, 'Second project');
  db.prepare(`INSERT INTO activities (project_id,id,name,level,trade,trade_group,weight,sort_order)
              VALUES (?,'B-1','Blockwork',1,'Block Mason','Civil',100,1)`).run(P2);
  const p2 = db.prepare('SELECT * FROM projects WHERE id = ?').get(P2);

  // Early: 40 man-days bought 40 points. Late: 40 man-days bought 10.
  for (let i = 0; i < 10; i++) {
    db.prepare(`INSERT INTO diary (project_id,report_date,staff,status,created_at)
                VALUES (?,?,?,'submitted',?)`)
      .run(P2, shift(TODAY, -90 + i), JSON.stringify([{ t: 'Block Mason', n: 4, h: '8' }]), 'x');
  }
  db.prepare(`INSERT INTO updates (project_id,activity_id,report_date,pct,source,created_at)
              VALUES (?,'B-1',?,40,'site',?)`).run(P2, shift(TODAY, -80), 'a');
  for (let i = 0; i < 10; i++) {
    db.prepare(`INSERT INTO diary (project_id,report_date,staff,status,created_at)
                VALUES (?,?,?,'submitted',?)`)
      .run(P2, shift(TODAY, -10 + i), JSON.stringify([{ t: 'Block Mason', n: 4, h: '8' }]), 'y');
  }
  db.prepare(`INSERT INTO updates (project_id,activity_id,report_date,pct,source,created_at)
              VALUES (?,'B-1',?,50,'site',?)`).run(P2, shift(TODAY, -1), 'b');

  const d = await buildResources(env, P2, p2, { to: TODAY });
  const bm = d.labour.by_trade.find((t) => t.trade === 'Block Mason');
  check('overall it is 1.6 man-days a point', near(bm.per_point, 1.6), String(bm.per_point));
  check('lately it is 4 man-days a point', near(bm.recent_per_point, 4), String(bm.recent_per_point));
  check('so it is reported as getting worse', bm.trend === 'worse', bm.trend);
  check('and the projection is the whole job at the overall rate',
    near(bm.projected, 160), String(bm.projected));
}

/* ----------------------------------------------------------- the money */

section('Rates');
{
  check('no rates table yet is null, not an error',
    (await loadRates({ DB: { prepare() { throw new Error('no such table: rates'); } } }, PID)) === null);

  check('a rate needs a kind', !!(await saveRate(env, PID, { name: 'Steel Fixer', rate: 90 })).error);
  check('a rate needs a name', !!(await saveRate(env, PID, { kind: 'labour', rate: 90 })).error);
  check('a rate needs to be a number',
    !!(await saveRate(env, PID, { kind: 'labour', name: 'Steel Fixer', rate: 'ninety' })).error);
  check('a negative rate is refused',
    !!(await saveRate(env, PID, { kind: 'labour', name: 'Steel Fixer', rate: -5 })).error);

  await saveRate(env, PID, { kind: 'labour', name: 'Steel Fixer', rate: 90 });
  await saveRate(env, PID, { kind: 'labour', name: 'Carpenter', rate: 100 });
  await saveRate(env, PID, { kind: 'plant', name: 'Excavator', rate: 800 });
  await saveRate(env, PID, { kind: 'material', name: 'Ready-mix concrete C40', rate: 230, unit: 'm³' });

  const r = await loadRates(env, PID);
  check('rates are stored and found case-insensitively',
    r.labour[key('steel fixer')].rate === 90);
  await saveRate(env, PID, { kind: 'labour', name: 'Steel Fixer', rate: 95 });
  check('saving again changes it rather than duplicating',
    (await loadRates(env, PID)).labour[key('Steel Fixer')].rate === 95);
  await saveRate(env, PID, { kind: 'labour', name: 'Carpenter', rate: 0 });
  check('a rate of zero removes it', !(await loadRates(env, PID)).labour[key('Carpenter')]);
  await saveRate(env, PID, { kind: 'labour', name: 'Carpenter', rate: 100 });
}

section('The money');
{
  const d = await buildResources(env, PID, project, { to: TODAY });
  const sf = d.labour.by_trade.find((t) => t.trade === 'Steel Fixer');
  check('labour costs man-days × the day-rate', near(sf.cost, 27 * 95), String(sf.cost));
  const ex = d.plant.by_type.find((p) => p.type === 'Excavator');
  check('plant costs plant-days × the day-rate', near(ex.cost, 2 * 800));
  const c40 = d.materials.by_item.find((m) => /C40/.test(m.material));
  check('material costs quantity × the unit rate', near(c40.cost, 120 * 230));
  check('the currency comes off the project', d.currency === 'AED');

  const unpriced = d.labour.by_trade.filter((t) => t.man_days > 0 && !t.rate);
  check('trades with no rate are named, not silently valued at nothing',
    unpriced.length > 0 && d.warnings.some((w) => /no day-rate/.test(w)));
}

section('Money is a separate permission');
{
  const full = await buildResources(env, PID, project, { to: TODAY });
  const open = withoutMoney(full);
  check('the totals survive', open.labour.man_days === full.labour.man_days);
  check('but no cost is left at the top', open.labour.cost === undefined &&
    open.plant.cost === undefined && open.materials.cost === undefined);
  check('nor on any trade', open.labour.by_trade.every((t) => t.cost === undefined && t.rate === undefined));
  check('nor on any plant or material',
    open.plant.by_type.every((p) => p.cost === undefined) &&
    open.materials.by_item.every((m) => m.cost === undefined));
  check('and it does not claim to be priced', open.priced === false);
  check('the rate warnings go with it', !open.warnings.some((w) => /rate/i.test(w)));
  check('the JSON carries no number that was a cost',
    !JSON.stringify(open).includes('"cost"') && !JSON.stringify(open).includes('"rate"'));
}

/* ---------------------------------------------------- what it cannot say */

section('What these figures cannot tell you');
{
  // The misspelling that actually happens: a delivery that will never add up
  // with the same material typed properly.
  diary('2026-09-03', [], [], [{ m: 'Redi-mix concrete C-40', q: '80', u: 'm3' }], []);
  const d = await buildResources(env, PID, project, { to: TODAY });
  check('missing days are counted and named',
    d.warnings.some((w) => /have no record at all/.test(w)), JSON.stringify(d.warnings));
  check('a material not on the list is flagged, with what to do',
    d.warnings.some((w) => /material list/.test(w) && /Admin/.test(w)));

  const st = d.materials.by_item.find((m) => /reinforcement/i.test(m.material));
  check('a delivery of a listed material is matched to the list', st.listed === true);
  check('and still totalled at what was delivered', st.qty === 1250);
  const odd = d.materials.by_item.find((m) => /Redi-mix/.test(m.material));
  check('a misspelt one is kept, as typed, and marked off-list',
    odd && odd.listed === false && odd.qty === 80);
  check('the two spellings are NOT silently merged',
    d.materials.by_item.filter((m) => /C.?40/i.test(m.material)).length === 2);

  const empty = 'p3';
  db.prepare(`INSERT INTO projects (id,name,sort_order,created_at) VALUES (?,?,3,datetime('now'))`)
    .run(empty, 'Nothing yet');
  const none = await buildResources(env, empty,
    db.prepare('SELECT * FROM projects WHERE id = ?').get(empty), { to: TODAY });
  check('a project with nothing recorded says so plainly',
    none.warnings.some((w) => /nothing to total/.test(w)));
  check('and returns zeroes rather than failing', none.labour.man_days === 0);
}

section('Months');
{
  const d = await buildResources(env, PID, project, { to: TODAY });
  check('months come back in order',
    d.months.every((m, i, a) => !i || a[i - 1].month <= m.month));
  check('August is there, before the diary started', d.months.some((m) => m.month === '2026-08'));
  check('and carries its man-days', d.months.find((m) => m.month === '2026-08').man_days === 5);
}

section('Nothing here falls over on a database that has not been migrated');
{
  const bare = {
    DB: {
      prepare(sql) {
        if (/diary|rates/.test(sql)) throw new Error('no such table');
        return DB.prepare(sql);
      },
    },
  };
  const d = await buildResources(bare, PID, project, { to: TODAY });
  check('it still totals what the manpower table holds', d.labour.man_days > 0);
  check('and says the money is not set up', d.priced === false &&
    d.warnings.some((w) => /Rates have not been set up/.test(w)));
}

console.log(`\n${ran - fails}/${ran} passed`);
