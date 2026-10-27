// Exercises per-discipline access: the scope maths, the SQL it produces, what a
// scoped code can read and write, and the day review.
//
// The check that matters is the negative one — that a code scoped to MEP cannot
// reach a civil activity by any route, not merely that the page hides it.
//
//   node tools/test-access.mjs
//
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import {
  ROLES, readScope, isFullScope, describeScope, scopeSql, tradeInScope, activitiesInScope,
  listCodes, getCode, findByHash, saveCode, deleteCode, reviewDay, getReview, listReviews,
} from '../src/access.js';

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
const PID = 'p1';

let fails = 0;
function check(name, cond, detail) {
  console.log((cond ? '  ok   ' : '  FAIL ') + name + (detail ? '  — ' + detail : ''));
  if (!cond) { fails++; process.exitCode = 1; }
}

// A stand-in for the Worker's hash. Only has to be stable within this test.
const sha256 = async (v) => 'h:' + String(v);

db.prepare("INSERT INTO projects (id,name,sort_order,created_at) VALUES (?,?,1,datetime('now'))")
  .run(PID, 'Plot 6457759');

// A programme coded the way the P6 file codes it: Civil and MEP trade groups.
const ACTS = [
  ['C-001', 'Steel Fixer', 'Civil'], ['C-002', 'Carpenter', 'Civil'],
  ['C-003', 'Block Mason', 'Civil'], ['C-004', 'Plastering', 'Civil'],
  ['M-001', 'HVAC Ducting', 'MEP'], ['M-002', 'Electrical', 'MEP'],
  ['M-003', 'Plumbing', 'MEP'],
  ['L-001', 'Lift Installation', 'Specialist'],
  ['X-001', 'Housekeeping', ''],
];
for (const [id, trade, group] of ACTS) {
  db.prepare(`INSERT INTO activities (project_id,id,name,level,trade,trade_group,discipline,
                                      planned_start,planned_finish,weight,sort_order)
              VALUES (?,?,?,1,?,?,'Construction','2026-08-01','2026-09-30',10,1)`)
    .run(PID, id, trade + ' work ' + id, trade, group);
  db.prepare(`INSERT INTO updates (project_id,activity_id,report_date,pct,submitted_by,source,created_at)
              VALUES (?,?,'2026-09-10',?, 'site','site','2026-09-10T13:00:00Z')`)
    .run(PID, id, group === 'MEP' ? 40 : 70);
}

/* ------------------------------------------------------------ 1. the maths */
console.log('\nScope arithmetic');

check('no groups and no trades means the whole project', isFullScope({ groups: [], trades: [] }));
check('and so does nothing at all', isFullScope(null));
check('a group scope is not full', !isFullScope({ groups: ['MEP'], trades: [] }));
check('it describes itself in words', describeScope({ groups: ['Civil'], trades: [] }) === 'Civil',
      describeScope({ groups: ['Civil'], trades: ['Lift Installation'] }));
check('full scope says so', describeScope({ groups: [], trades: [] }) === 'the whole project');

const mep = { groups: ['MEP'], trades: [] };
const civ = { groups: ['Civil'], trades: [] };
check('a trade in the group is in scope', tradeInScope(mep, 'HVAC Ducting', 'MEP'));
check('a trade in another group is not', !tradeInScope(mep, 'Carpenter', 'Civil'));
check('a named trade outside the group is still in scope',
      tradeInScope({ groups: ['MEP'], trades: ['Lift Installation'] }, 'Lift Installation', 'Specialist'));
check('full scope lets everything through', tradeInScope({ groups: [], trades: [] }, 'anything', 'any'));

const sql = scopeSql(mep, 'a');
check('it builds a bindable clause', sql.sql.includes('?') && sql.args.length === 1, sql.sql);
check('full scope builds a clause that matches everything',
      scopeSql({ groups: [], trades: [] }).sql === '1=1');

/* ------------------------------------------------- 2. what it actually hides */
console.log('\nWhat a scoped code can reach');

const allowedMep = await activitiesInScope(env, PID, mep, ACTS.map((a) => a[0]));
check('MEP reaches its own three', allowedMep.size === 3, [...allowedMep].join(', '));
check('and not a civil one', !allowedMep.has('C-001'));
check('and not the ungrouped one', !allowedMep.has('X-001'));

const allowedCiv = await activitiesInScope(env, PID, civ, ACTS.map((a) => a[0]));
check('Civil reaches its own four', allowedCiv.size === 4, [...allowedCiv].join(', '));
check('the two disciplines do not overlap',
      [...allowedCiv].every((id) => !allowedMep.has(id)));

const both = { groups: ['MEP'], trades: ['Lift Installation'] };
check('a group plus a named trade reaches both',
      (await activitiesInScope(env, PID, both, ACTS.map((a) => a[0]))).size === 4);

check('full scope reaches everything',
      (await activitiesInScope(env, PID, { groups: [], trades: [] }, ACTS.map((a) => a[0]))).size === ACTS.length);

// The one that matters: an id that does not belong to the project at all.
check('an activity from nowhere is refused',
      !(await activitiesInScope(env, PID, mep, ['NOT-A-REAL-ID'])).has('NOT-A-REAL-ID'));

/* --------------------------------------------------------- 3. the SQL path */
console.log('\nThe same scope applied in SQL');

async function scopedRows(scope) {
  const s = scopeSql(scope, 'a');
  const { results } = await env.DB.prepare(
    `SELECT a.id FROM activities a WHERE a.project_id = ? AND ${s.sql}`
  ).bind(PID, ...s.args).all();
  return (results || []).map((r) => r.id);
}
check('the SQL clause returns the same set as the id check',
      (await scopedRows(mep)).sort().join(',') === [...allowedMep].sort().join(','));
check('civil the same', (await scopedRows(civ)).length === 4);
check('full scope returns the lot', (await scopedRows({ groups: [], trades: [] })).length === ACTS.length);

// Scoping the target list and the update feed uses the same subquery shape.
const s2 = scopeSql(mep, 'a');
const { results: feed } = await env.DB.prepare(
  `SELECT activity_id FROM updates WHERE project_id = ?
     AND activity_id IN (SELECT a.id FROM activities a WHERE a.project_id = ? AND ${s2.sql})`
).bind(PID, PID, ...s2.args).all();
check('the update feed scopes to the same activities', feed.length === 3,
      feed.map((r) => r.activity_id).join(', '));

/* ----------------------------------------------------------- 4. the codes */
console.log('\nHanding out codes');

const a = await saveCode(env, PID, {
  label: 'Civil / Architecture — Rakesh', role: 'lead', groups: ['Civil'], code: 'MAJ-CIV-AAAA-BBBB',
}, sha256);
check('a scoped code is created', !!a.ok && a.id.startsWith('ac_'), a.id);

const b = await saveCode(env, PID, {
  label: 'MEP — Suresh', role: 'lead', groups: ['MEP'], code: 'MAJ-MEP-CCCC-DDDD',
}, sha256);
check('a second one too', !!b.ok);

const pm = await saveCode(env, PID, {
  label: 'PM — Ajay', role: 'manager', groups: ['Civil'], code: 'MAJ-PM-EEEE-FFFF',
}, sha256);
check('a manager code is created', !!pm.ok);

const list = await listCodes(env, PID);
check('all three are listed', list.length === 3, list.map((c) => c.label).join(' | '));
check('a manager is never scoped, whatever was ticked',
      isFullScope(list.find((c) => c.role === 'manager').scope));
check('a lead keeps its scope',
      describeScope(list.find((c) => c.label.startsWith('MEP')).scope) === 'MEP');

check('a code with no label is refused',
      !!(await saveCode(env, PID, { label: '  ', role: 'lead', code: 'abcdefgh' }, sha256)).error);
check('a short code is refused',
      !!(await saveCode(env, PID, { label: 'X', role: 'lead', code: 'short' }, sha256)).error);
check('a new code without the code itself is refused',
      !!(await saveCode(env, PID, { label: 'X', role: 'lead' }, sha256)).error);

const found = await findByHash(env, await sha256('MAJ-MEP-CCCC-DDDD'));
check('signing in finds it by hash', found && found.id === b.id);
check('and it carries the project', found.project_id === PID);
check('and the role', found.role === 'lead');
check('a wrong code finds nothing', !(await findByHash(env, await sha256('nope'))));
check('the code itself is never stored', !JSON.stringify(list).includes('CCCC-DDDD'));

/* ------------------------------------------------------ 5. withdrawing one */
console.log('\nWithdrawing');

await saveCode(env, PID, { id: b.id, label: 'MEP — Suresh', role: 'lead', groups: ['MEP'], active: false }, sha256);
check('a withdrawn code no longer signs anyone in',
      !(await findByHash(env, await sha256('MAJ-MEP-CCCC-DDDD'))));
check('and an existing session cannot resolve it either', !(await getCode(env, b.id)));
check('the other code is untouched', !!(await getCode(env, a.id)));
check('it is still listed, marked withdrawn',
      (await listCodes(env, PID)).find((c) => c.id === b.id).active === false);

await saveCode(env, PID, { id: b.id, label: 'MEP — Suresh', role: 'lead', groups: ['MEP'], active: true }, sha256);
check('restoring it works again', !!(await findByHash(env, await sha256('MAJ-MEP-CCCC-DDDD'))));

// Re-scoping takes effect without re-issuing the code.
await saveCode(env, PID, { id: b.id, label: 'MEP — Suresh', role: 'lead',
                           groups: ['MEP'], trades: ['Lift Installation'] }, sha256);
check('re-scoping applies to the same code',
      (await activitiesInScope(env, PID, readScope(await getCode(env, b.id)), ACTS.map((x) => x[0]))).size === 4);
check('and the code still works', !!(await findByHash(env, await sha256('MAJ-MEP-CCCC-DDDD'))));

check('changing a code replaces the hash',
      (await saveCode(env, PID, { id: a.id, label: 'Civil — Rakesh', role: 'lead',
                                  groups: ['Civil'], code: 'MAJ-CIV-NEWN-EWWW' }, sha256)).ok &&
      !!(await findByHash(env, await sha256('MAJ-CIV-NEWN-EWWW'))) &&
      !(await findByHash(env, await sha256('MAJ-CIV-AAAA-BBBB'))));

check('deleting one leaves the rest', (await deleteCode(env, PID, pm.id)).ok &&
      (await listCodes(env, PID)).length === 2);
check('deleting an unknown one is refused', !!(await deleteCode(env, PID, 'ac_nope')).error);

// A code belonging to another project must not be editable from this one.
db.prepare("INSERT INTO projects (id,name,sort_order,created_at) VALUES ('p2','Other',2,datetime('now'))").run();
const other = await saveCode(env, 'p2', { label: 'Other PM', role: 'manager', code: 'OTH-PM-1234-5678' }, sha256);
check('a code from another project cannot be changed from here',
      !!(await saveCode(env, PID, { id: other.id, label: 'hijacked', role: 'manager' }, sha256)).error);
check('nor deleted', !!(await deleteCode(env, PID, other.id)).error);
check('and it is not listed here', !(await listCodes(env, PID)).some((c) => c.id === other.id));

/* ------------------------------------------------------- 6. the day review */
console.log('\nSigning off the day');

check('nothing is reviewed to start with', !(await getReview(env, PID, '2026-09-10')));
const rv = await reviewDay(env, PID, '2026-09-10', 'Ajay', 'Checked against the diary.');
check('the PM can sign a day off', rv.ok && rv.reviewed === true);
const got = await getReview(env, PID, '2026-09-10');
check('it records who', got.reviewed_by === 'Ajay');
check('and when', !!got.reviewed_at);
check('and the note', /Checked against the diary/.test(got.note));
check('signing off twice does not duplicate it',
      (await reviewDay(env, PID, '2026-09-10', 'Ajay')).ok &&
      (await listReviews(env, PID, '2026-09-01', '2026-09-30')).length === 1);
check('undoing it removes the record',
      (await reviewDay(env, PID, '2026-09-10', 'Ajay', '', true)).ok &&
      !(await getReview(env, PID, '2026-09-10')));
await reviewDay(env, PID, '2026-09-11', 'Ajay');
await reviewDay(env, PID, '2026-09-12', 'Ajay');
check('a range lists them', (await listReviews(env, PID, '2026-09-11', '2026-09-12')).length === 2);
check('and another project sees none', (await listReviews(env, 'p2', '2026-09-01', '2026-09-30')).length === 0);

/* ------------------------------------ 7. a database that has not been migrated */
console.log('\nA database without the new tables');
const plain = new DatabaseSync(':memory:');
plain.exec(readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));
plain.exec('DROP TABLE access_codes');
plain.exec('DROP TABLE day_review');
const env2 = { DB: { prepare(sql) {
  const st = plain.prepare(sql); let args = [];
  const api = { bind(...a) { args = a; return api; },
    async all() { return { results: st.all(...args) }; },
    async first() { return st.get(...args) ?? null; },
    async run() { st.run(...args); return { success: true }; } };
  return api;
}, async batch(l) { for (const s of l) await s.run(); return []; } } };
check('listing codes says "not set up" rather than throwing', (await listCodes(env2, 'p1')) === null);
check('signing in falls through quietly', (await findByHash(env2, 'anything')) === null);
check('resolving a session code falls through too', (await getCode(env2, 'ac_x')) === null);
check('reviews report not-migrated', (await listReviews(env2, 'p1', '2026-09-01', '2026-09-30')) === null);
check('and reading one does not throw', (await getReview(env2, 'p1', '2026-09-10')) === undefined);

console.log('\nRoles');
check('every role is defined', ['manager', 'lead', 'site', 'view'].every((r) => ROLES[r]));
check('only the manager reviews the day',
      ROLES.manager.review && !ROLES.lead.review && !ROLES.site.review && !ROLES.view.review);
check('site gets no dashboard', !ROLES.site.dashboard && ROLES.lead.dashboard);
check('read-only cannot submit', !ROLES.view.submit && ROLES.lead.submit);

console.log(fails ? `\n${fails} check(s) failed.\n` : '\nAll checks passed.\n');
