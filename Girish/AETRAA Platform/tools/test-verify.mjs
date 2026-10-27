// Exercises photographic proof and office verification: the 100% rule, the
// queue, what a verdict is worth once site reports again, and what site is told.
//
//   node tools/test-verify.mjs
//
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import {
  listQueue, photosFor, setVerdict, verifyCounts, verdictsFor, photoCounts, missingProof,
} from '../src/verify.js';
import { scopeSql } from '../src/access.js';

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

db.prepare("INSERT INTO projects (id,name,sort_order,created_at) VALUES (?,?,1,datetime('now'))")
  .run(PID, 'Plot 6457759');

const ACTS = [
  ['A-001', 'Steel Fixer', 'Civil'], ['A-002', 'Carpenter', 'Civil'],
  ['A-003', 'Block Mason', 'Civil'], ['M-001', 'HVAC Ducting', 'MEP'],
];
for (const [id, trade, group] of ACTS) {
  db.prepare(`INSERT INTO activities (project_id,id,name,level,trade,trade_group,floor,discipline,
                                      planned_start,planned_finish,weight,sort_order)
              VALUES (?,?,?,1,?,?,'Level 02','Construction','2026-08-01','2026-09-30',10,1)`)
    .run(PID, id, trade + ' to ' + id, trade, group);
}

let seq = 0;
function claim(id, pct, by = 'Rakesh', date = '2026-09-14', remarks = '') {
  seq++;
  db.prepare(`INSERT INTO updates (project_id,activity_id,report_date,pct,status,remarks,
                                   submitted_by,source,created_at)
              VALUES (?,?,?,?,?,?,?,'site',?)`)
    .run(PID, id, date, pct, pct >= 100 ? 'complete' : 'in_progress', remarks, by,
         '2026-09-14T' + String(6 + seq).padStart(2, '0') + ':00:00Z');
  return db.prepare('SELECT MAX(id) AS id FROM updates').get().id;
}
function photo(id, caption = '', date = '2026-09-14') {
  const pid2 = 'ph' + Math.random().toString(36).slice(2, 10);
  db.prepare(`INSERT INTO photos (id,project_id,activity_id,report_date,caption,mime,data,
                                  submitted_by,created_at)
              VALUES (?,?,?,?,?,'image/jpeg','data:image/jpeg;base64,AA','Rakesh',?)`)
    .run(pid2, PID, id, date, caption, date + 'T09:00:00Z');
  return pid2;
}

/* ------------------------------------------------------- 1. the 100% rule */
console.log('\nProof before a completion claim');

check('nothing is photographed to start with',
      (await missingProof(env, PID, ['A-001', 'A-002'])).length === 2);
photo('A-001', 'Steel fixed, L2 slab');
check('a photographed activity passes the rule',
      (await missingProof(env, PID, ['A-001'])).length === 0);
check('an unphotographed one is caught',
      (await missingProof(env, PID, ['A-001', 'A-002'])).join(',') === 'A-002');
check('the rule can be asked about nothing without complaining',
      (await missingProof(env, PID, [])).length === 0);

const counts = await photoCounts(env, PID, ACTS.map((a) => a[0]));
check('photo counts are per activity', counts['A-001'] === 1 && !counts['A-002'], JSON.stringify(counts));
photo('A-001', 'Second angle');
check('and they add up', (await photoCounts(env, PID, ['A-001']))['A-001'] === 2);

/* ----------------------------------------------------------- 2. the queue */
console.log('\nThe queue of claims');

claim('A-001', 100);
claim('A-002', 60);
claim('M-001', 45, 'Suresh');

let q = await listQueue(env, PID, { state: 'awaiting' });
check('every fresh claim is waiting', q.length === 3, q.map((r) => r.id).join(', '));
check('an activity site never reported is not in it', !q.some((r) => r.id === 'A-003'));
check('the claim carries who made it', q.find((r) => r.id === 'M-001').submitted_by === 'Suresh');
check('and how many photographs stand behind it',
      q.find((r) => r.id === 'A-001').photos === 2,
      q.map((r) => r.id + ':' + r.photos).join(', '));
check('a claim with no proof shows zero', q.find((r) => r.id === 'A-002').photos === 0);

check('claimed-complete only narrows it',
      (await listQueue(env, PID, { state: 'awaiting', complete: true })).length === 1);

// What the previous figure was, so the PM sees the jump rather than the total.
claim('A-002', 85);
q = await listQueue(env, PID, { state: 'awaiting' });
check('it shows what the figure was before', q.find((r) => r.id === 'A-002').before_pct === 60,
      'was ' + q.find((r) => r.id === 'A-002').before_pct + ', now ' + q.find((r) => r.id === 'A-002').pct);

// A scoped PM sees only his own.
const mepOnly = await listQueue(env, PID, { state: 'awaiting', scopeSql: scopeSql({ groups: ['MEP'] }, 'a') });
check('a scoped verifier sees only his trades', mepOnly.length === 1 && mepOnly[0].id === 'M-001');

/* -------------------------------------------------------- 3. the verdicts */
console.log('\nVerifying and querying');

check('a verdict on nothing is refused', !!(await setVerdict(env, PID, { activity_id: '' }, 'Ajay')).error);
check('verifying an activity site never claimed is refused',
      !!(await setVerdict(env, PID, { activity_id: 'A-003', status: 'verified' }, 'Ajay')).error);
check('a query with no reason is refused',
      !!(await setVerdict(env, PID, { activity_id: 'A-001', status: 'queried', note: '  ' }, 'Ajay')).error);

const v = await setVerdict(env, PID, { activity_id: 'A-001', status: 'verified' }, 'Ajay');
check('verifying works', v.ok && v.status === 'verified');
q = await listQueue(env, PID, { state: 'awaiting' });
check('it leaves the queue', !q.some((r) => r.id === 'A-001'), q.map((r) => r.id).join(', '));
check('and appears under verified',
      (await listQueue(env, PID, { state: 'verified' })).some((r) => r.id === 'A-001'));

const qd = await setVerdict(env, PID,
  { activity_id: 'A-002', status: 'queried', note: 'That is not 85 — the west bay is untouched.' }, 'Ajay');
check('querying works', qd.ok && qd.status === 'queried');
check('it shows under queried',
      (await listQueue(env, PID, { state: 'queried' })).some((r) => r.id === 'A-002'));
check('with the reason kept',
      /west bay/.test((await listQueue(env, PID, { state: 'queried' })).find((r) => r.id === 'A-002').verdict_note));
check('and who gave it',
      (await listQueue(env, PID, { state: 'queried' })).find((r) => r.id === 'A-002').verdict_by === 'Ajay');

/* --------------------------------- 4. a verdict is only good for its claim */
console.log('\nA verdict stands only against the claim it was given for');

claim('A-001', 100, 'Rakesh', '2026-09-15');
q = await listQueue(env, PID, { state: 'awaiting' });
check('reporting again puts a verified activity back in the queue',
      q.some((r) => r.id === 'A-001'));
check('and it no longer counts as verified',
      !(await listQueue(env, PID, { state: 'verified' })).some((r) => r.id === 'A-001'));

// Site answering a query: they re-report, which clears the query from their list.
let told = await verdictsFor(env, PID, ['A-001', 'A-002']);
check('site is told about the outstanding query', told['A-002'] && told['A-002'].status === 'queried');
check('but not about a verdict they have already answered', !told['A-001'],
      'A-001 was re-reported after being verified');

claim('A-002', 70, 'Rakesh', '2026-09-15', 'Corrected — west bay not started.');
told = await verdictsFor(env, PID, ['A-002']);
check('answering the query clears it from site\'s list', !told['A-002']);
check('and it returns to the office queue',
      (await listQueue(env, PID, { state: 'awaiting' })).some((r) => r.id === 'A-002'));
check('no longer under queried',
      !(await listQueue(env, PID, { state: 'queried' })).some((r) => r.id === 'A-002'));

/* ---------------------------------------------------------- 5. the counts */
console.log('\nThe counts on the button and in the report');

const c = await verifyCounts(env, PID);
check('awaiting is counted', c.awaiting >= 1, JSON.stringify(c));
check('claimed-complete-and-unchecked is counted separately', c.awaiting_complete >= 1);
check('the four numbers cover every claimed activity',
      c.awaiting + c.verified + c.queried ===
      (await listQueue(env, PID, { state: '' })).length,
      `${c.awaiting}+${c.verified}+${c.queried}`);

const scoped = await verifyCounts(env, PID, scopeSql({ groups: ['MEP'] }, 'a'));
check('counts respect a scope', scoped.awaiting === 1, JSON.stringify(scoped));

/* ---------------------------------------------------------- 6. the photos */
console.log('\nThe proof beside the claim');

photo('M-001', 'Ducting run, L2 corridor');
const pics = await photosFor(env, PID, ['A-001', 'M-001']);
check('photos come back grouped by activity',
      pics['A-001'].length === 2 && pics['M-001'].length === 1);
check('with their caption', /corridor/.test(pics['M-001'][0].caption));
check('newest first', pics['A-001'][0].created_at >= pics['A-001'][1].created_at);
check('asking for none is harmless', Object.keys(await photosFor(env, PID, [])).length === 0);

/* ---------------------------------------- 7. a database without the table */
console.log('\nA database that has not been migrated');
const plain = new DatabaseSync(':memory:');
plain.exec(readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));
plain.exec('DROP TABLE verifications');
plain.prepare("INSERT INTO projects (id,name,sort_order,created_at) VALUES ('p1','T',1,datetime('now'))").run();
const env2 = { DB: { prepare(sql) {
  const st = plain.prepare(sql); let args = [];
  const api = { bind(...a) { args = a; return api; },
    async all() { return { results: st.all(...args) }; },
    async first() { return st.get(...args) ?? null; },
    async run() { st.run(...args); return { success: true }; } };
  return api;
}, async batch(l) { for (const s of l) await s.run(); return []; } } };
check('counts report not-migrated rather than throwing', (await verifyCounts(env2, 'p1')) === null);
check('and site is simply told nothing', Object.keys(await verdictsFor(env2, 'p1', ['A-001'])).length === 0);

console.log(fails ? `\n${fails} check(s) failed.\n` : '\nAll checks passed.\n');
