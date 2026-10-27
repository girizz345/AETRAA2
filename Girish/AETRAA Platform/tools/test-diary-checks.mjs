// STEP 3 — the site diary: checked before it is submitted, chased when missing.
//
//   node tools/test-diary-checks.mjs
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { diaryChecks, offDays } from '../src/diary-checks.js';

let fails = 0, checks = 0;
const check = (n, c, d) => { checks++; console.log((c ? '  ok   ' : '  FAIL ') + n + (d && !c ? '  — ' + d : '')); if (!c) fails++; };
const todayUAE = () => new Date(Date.now() + 4 * 3600000).toISOString().slice(0, 10);
const shift = (d, n) => new Date(Date.parse(d + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);

// ---- the rules on their own
let c = diaryChecks({ staff: [], works: [], weather: '', prepared_by: '' }, {});
check('empty diary: four blockers', c.blockers.length === 4 && !c.ok, JSON.stringify(c.blockers));
c = diaryChecks({ staff: [], works: [], weather: 'Sunny', prepared_by: 'R', remarks: 'Site closed — Eid holiday' }, {});
check('a closed day explained in Remarks is fine', c.ok, JSON.stringify(c.blockers));
c = diaryChecks({ staff: [{ t: 'Mason', n: 10 }], works: [{ a: 'Blockwork L2' }], weather: 'Sunny', prepared_by: 'R', tomorrow: [{ a: 'x' }] },
  { prev_men: 40, prev_date: '2026-09-19', progress: [{}, {}, {}], photos: 0 });
check('headcount swing warned', c.warnings.some((w) => /change of more than half/.test(w)), JSON.stringify(c.warnings));
check('more progress than works lines warned', c.warnings.some((w) => /progress on 3 activities/.test(w)));
check('no photos warned', c.warnings.some((w) => /photos/.test(w)));
check('warnings do not block', c.ok);
c = diaryChecks({ staff: [], subs: [{ n: 'Sub', c: '12' }], works: [{ a: 'x' }], weather: 'Sunny', prepared_by: 'R', tomorrow: [{ a: 'y' }] }, { photos: 2 });
check('subcontractor gang counts as manpower', c.ok && !c.warnings.length, JSON.stringify(c));
check('Friday is the default day off', JSON.stringify(offDays({})) === '[5]');
check('a project can set its own days off', JSON.stringify(offDays({ diary_off_days: '5,6' })) === '[5,6]');

// ---- through the API
const db = new DatabaseSync(':memory:');
db.exec(readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));
function stmt(sql) {
  const st = db.prepare(sql); let args = [];
  const api = {
    bind(...a) { args = a; return api; },
    async all() { return { results: st.all(...args), success: true }; },
    async first(col) { const r = st.get(...args) ?? null; return col && r ? r[col] : r; },
    async run() { st.run(...args); return { success: true, meta: {} }; },
  };
  return api;
}
const env = {
  DB: { prepare: stmt, async batch(l) { for (const s of l) await s.run(); return []; }, async exec(s) { db.exec(s); } },
  OWNER_CODE: 'MASTERCODE-0123456789', LOGIN_TEST_CODE: '246810', AUTH_SECRET: 'x'.repeat(40),
};
const worker = (await import('../src/index.js')).default;
let cookie = '';
async function call(path, body) {
  const headers = {};
  if (cookie) headers.Cookie = cookie;
  if (body) headers['Content-Type'] = 'application/json';
  const res = await worker.fetch(new Request('http://localhost' + path, { method: body ? 'POST' : 'GET', headers, body: body ? JSON.stringify(body) : undefined }), env, { waitUntil() {} });
  const sc = res.headers.get('set-cookie');
  if (sc) cookie = sc.split(',').map((x) => x.split(';')[0].trim()).join('; ');
  const text = await res.text(); let json = null; try { json = JSON.parse(text); } catch (e) {}
  return { status: res.status, text, json };
}
const as = async (email) => { cookie = ''; return (await call('/api/signin/code', { email, code: '246810' })).json?.ok; };

await call('/api/login', { code: 'MASTERCODE-0123456789' });
let r = await call('/api/setup/onboard', { company: { name: 'NAF' }, project: { name: 'Tower' } });
const P = r.json.project_id;
// the project has been on the platform for a month
db.prepare('UPDATE projects SET created_at = ? WHERE id = ?').run(shift(todayUAE(), -30) + 'T00:00:00Z', P);
await call('/api/person', { name: 'PM', email: 'pm@naf.ae', functions: ['pm'], projects: [P] });
await call('/api/person', { name: 'R. Kumar', email: 'site@naf.ae', functions: ['site'], projects: [P] });
const T = todayUAE();
db.prepare("INSERT INTO activities (project_id, id, name, level, sort_order) VALUES (?,?,?,1,1)").run(P, 'A100', 'Blockwork L2');
db.prepare("INSERT INTO activities (project_id, id, name, level, sort_order) VALUES (?,?,?,1,2)").run(P, 'A200', 'Screed L1');
const up = db.prepare("INSERT INTO updates (project_id, activity_id, report_date, pct, status, submitted_by, source, created_at) VALUES (?,?,?,?,?,?,'site',?)");
up.run(P, 'A100', T, 40, 'in_progress', 'R. Kumar', 'x');
up.run(P, 'A100', T, 55, 'in_progress', 'R. Kumar', 'x');   // latest of the day wins
up.run(P, 'A200', T, 100, 'complete', 'R. Kumar', 'x');

await as('pm@naf.ae');
r = await call('/api/diary?date=' + T);
check('a new diary comes with its checks', r.json.checks && r.json.checks.blockers.length >= 3, JSON.stringify(r.json.checks));
check('…and knows site reported 2 activities today', r.json.context.progress === 2, JSON.stringify(r.json.context));
r = await call('/api/diary/progress?date=' + T);
check('progress lines: latest per activity, with names', r.json.progress.length === 2 &&
  r.json.progress.find((x) => x.id === 'A100').pct === 55 && r.json.progress.find((x) => x.id === 'A200').name === 'Screed L1', JSON.stringify(r.json));

r = await call('/api/diary', { report_date: T, weather: 'Sunny', submit: true });
check('submitting an incomplete diary is refused', r.status === 400 && r.json.saved === true && /cannot be submitted/.test(r.json.error), r.text.slice(0, 200));
check('…it is kept as a draft', db.prepare('SELECT status, weather FROM diary WHERE project_id = ? AND report_date = ?').get(P, T).status === 'draft');
check('…with what was typed', db.prepare('SELECT weather FROM diary WHERE project_id = ? AND report_date = ?').get(P, T).weather === 'Sunny');

r = await call('/api/diary', { report_date: T, weather: 'Sunny', prepared_by: 'R. Kumar',
  staff: [{ t: 'Mason', n: 12 }, { t: 'Helper', n: 20 }], works: [{ a: 'Blockwork L2 — 55%', q: '12' }, { a: 'Screed L1 — 100% (completed)', q: '8' }],
  tomorrow: [{ a: 'Blockwork L2', q: '12' }], submit: true });
check('a complete diary submits', r.status === 200 && r.json.status === 'submitted', r.text.slice(0, 200));

await as('site@naf.ae');
r = await call('/api/diary', { report_date: T, weather: 'Sunny', submit: true });
check('site still cannot submit (office only)', r.status === 401);

// a draft yesterday (or two days back if yesterday was Friday), nothing on an earlier working day
const work = (d) => new Date(d + 'T00:00:00Z').getUTCDay() !== 5;
let dDraft = shift(T, -1); while (!work(dDraft)) dDraft = shift(dDraft, -1);
let dMiss = shift(dDraft, -1); while (!work(dMiss)) dMiss = shift(dMiss, -1);
await as('pm@naf.ae');
await call('/api/diary', { report_date: dDraft, weather: 'Cloudy' });
r = await call('/api/diary/status?days=14');
const byDate = Object.fromEntries(r.json.days.map((x) => [x.date, x.status]));
check('14 days listed', r.json.days.length === 14 && r.json.days[13].date === T);
check('today submitted', byDate[T] === 'submitted', JSON.stringify(byDate));
check('draft shown as draft', byDate[dDraft] === 'draft');
check('a working day with nothing is missing', byDate[dMiss] === 'missing');
check('Fridays are days off', r.json.days.filter((x) => new Date(x.date + 'T00:00:00Z').getUTCDay() === 5).every((x) => x.status === 'off'));
check('counts: missing and drafts (not today)', r.json.missing >= 1 && r.json.draft === 1, JSON.stringify({ m: r.json.missing, d: r.json.draft }));

db.prepare('UPDATE projects SET created_at = ? WHERE id = ?').run(T + 'T08:00:00Z', P);
r = await call('/api/diary/status?days=14');
check('days before the project existed are not "missing"', r.json.missing === 0, JSON.stringify(r.json.days.map((x) => x.status)));
console.log('\n' + checks + ' checks, ' + fails + ' failures');
process.exit(fails ? 1 : 0);
