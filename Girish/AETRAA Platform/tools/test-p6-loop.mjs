// THE P6 LOOP, AND THE COMPANY EMAIL LOCK.
//
//   node tools/test-p6-loop.mjs [baseline.xer] [updated.xer]
//
// With no files it builds a small programme in memory; given two real .xer
// files (the second a later update of the first) it runs on those.
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { cleanDomains, emailAllowed } from '../src/org.js';

let fails = 0, checks = 0;
const check = (n, c, d) => { checks++; console.log((c ? '  ok   ' : '  FAIL ') + n + (d && !c ? '  — ' + d : '')); if (!c) fails++; };

/* --------------------------------------------------------------- email lock */
check('domains cleaned', JSON.stringify(cleanDomains('@NAF.ae, naf-group.com')) === '["naf.ae","naf-group.com"]');
check('a bad domain refused', !!cleanDomains('not a domain').error);
const org = { email_domains: '["naf.ae"]', email_allowed: '["dec.ae","joe@gmail.com"]' };
check('company address allowed', emailAllowed(org, 'pm@naf.ae'));
check('sub-domain allowed', emailAllowed(org, 'x@site.naf.ae'));
check('look-alike refused (evilnaf.ae)', !emailAllowed(org, 'x@evilnaf.ae'));
check('gmail refused', !emailAllowed(org, 'x@gmail.com'));
check('partner domain allowed', emailAllowed(org, 'eng@dec.ae'));
check('one named outside address allowed', emailAllowed(org, 'joe@gmail.com'));
check('an unlocked company takes anyone', emailAllowed({}, 'x@gmail.com'));

/* ------------------------------------------------------------------ worker */
const db = new DatabaseSync(':memory:');
db.exec(readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));
function stmt(sql) {
  const st = db.prepare(sql); let args = [];
  const api = {
    bind(...a) { args = a; return api; },
    async all() { return { results: st.all(...args), success: true }; },
    async first(col) { const r = st.get(...args) ?? null; return col && r ? r[col] : r; },
    async run() { const r = st.run(...args); return { success: true, meta: { changes: r.changes } }; },
  };
  return api;
}
const env = {
  DB: { prepare: stmt, async batch(l) { for (const s of l) await s.run(); return []; }, async exec(s) { db.exec(s); } },
  OWNER_CODE: 'MASTERCODE-0123456789', LOGIN_TEST_CODE: '246810', AUTH_SECRET: 'x'.repeat(40),
};
const worker = (await import('../src/index.js')).default;
const ctx = { waitUntil() {}, passThroughOnException() {} };
let cookie = '';
async function call(path, body, raw) {
  const headers = {};
  if (cookie) headers.Cookie = cookie;
  if (body) headers['Content-Type'] = 'application/json';
  const res = await worker.fetch(new Request('http://localhost' + path, { method: body ? 'POST' : 'GET', headers, body: body ? JSON.stringify(body) : undefined }), env, ctx);
  const sc = res.headers.get('set-cookie');
  if (sc) cookie = sc.split(',').map((c) => c.split(';')[0].trim()).join('; ');
  if (raw) return { status: res.status, bytes: new Uint8Array(await res.arrayBuffer()), headers: res.headers };
  const text = await res.text(); let json = null; try { json = JSON.parse(text); } catch (e) {}
  return { status: res.status, text, json };
}
const as = async (email) => { cookie = ''; const r = await call('/api/signin/code', { email, code: '246810' }); return r.json && r.json.ok; };
const b64 = (buf) => Buffer.from(buf).toString('base64');

await call('/api/login', { code: 'MASTERCODE-0123456789' });
const admin = cookie;

// ---- email lock through the API
let r = await call('/api/setup/onboard', {
  company: { name: 'NAF Contracting LLC', email_domains: 'naf.ae', email_allowed: 'dec.ae' },
  project: { name: 'Majan' }, principal: { name: 'M. Al Nuaimi', email: 'principal@gmail.com' } });
check('onboarding refuses a principal outside the domain', r.json && /Only @naf.ae/.test(r.json.error || ''), r.text.slice(0, 200));
r = await call('/api/setup/onboard', {
  company: { name: 'Bad Co', email_domains: 'not a domain' }, project: { name: 'X' } });
check('a bad domain stops onboarding before anything is written', r.status === 400 &&
  !db.prepare("SELECT id FROM orgs WHERE name = 'Bad Co'").get(), r.text.slice(0, 160));
const oid = db.prepare("SELECT id FROM orgs WHERE name = 'NAF Contracting LLC'").get().id;
r = await call('/api/setup/project', { company_id: oid, project: { name: 'Majan' } });
const P = r.json.id;
for (const [n, e, f, ok] of [['M. Al Nuaimi', 'principal@naf.ae', ['principal'], true], ['A. Haddad', 'pm@naf.ae', ['pm'], true],
  ['V. Menon', 'plan@naf.ae', ['planning'], true], ['R. Kumar', 'site@naf.ae', ['site'], true],
  ['Consultant', 'eng@dec.ae', ['consultant'], true], ['Personal', 'someone@gmail.com', ['site'], false]]) {
  r = await call('/api/person', { name: n, email: e, functions: f, projects: [P] });
  check((ok ? 'allowed: ' : 'refused: ') + e, ok ? (r.status === 200 && !(r.json && r.json.error)) : /Only @naf.ae/.test((r.json && r.json.error) || ''), r.text.slice(0, 160));
}
await as('pm@naf.ae');
r = await call('/api/person', { name: 'Gmail Guy', email: 'g@gmail.com', functions: ['site'], projects: [P] });
check('the PM cannot add a Gmail address either', /Only @naf.ae/.test((r.json && r.json.error) || ''), r.text.slice(0, 160));
cookie = admin;
r = await call('/api/setup/company-email', { company_id: oid, email_domains: 'naf.ae', email_allowed: 'dec.ae, g@gmail.com' });
check('admin allows one outside address', r.json && r.json.ok && r.json.email_allowed.includes('g@gmail.com'));
await as('pm@naf.ae');
r = await call('/api/person', { name: 'Gmail Guy', email: 'g@gmail.com', functions: ['site'], projects: [P] });
check('…and now the PM can add it', r.status === 200 && !(r.json && r.json.error), r.text.slice(0, 160));

// ---- the programme
const base = process.argv[2], upd = process.argv[3];
if (!base || !upd) { console.log('\n  (no .xer files given — skipping the P6 part)\n' + checks + ' checks, ' + fails + ' failures'); process.exit(fails ? 1 : 0); }
cookie = admin;
r = await call('/api/setup/xer/commit', { project_id: P, file_b64: b64(readFileSync(base)) });
check('admin imports the baseline', r.json && r.json.ok, r.text.slice(0, 200));
const acts = db.prepare("SELECT COUNT(*) AS n FROM activities WHERE project_id = ? AND source = 'programme'").get(P).n;
const links = db.prepare('SELECT COUNT(*) AS n FROM links WHERE project_id = ?').get(P).n;
const cals = db.prepare('SELECT COUNT(*) AS n FROM calendars WHERE project_id = ?').get(P).n;
check('baseline: activities, logic and calendars loaded', acts > 100 && links > 100 && cals > 0, `acts=${acts} links=${links} cals=${cals}`);
const withFloat = db.prepare('SELECT COUNT(*) AS n FROM activities WHERE project_id = ? AND p6_early_finish IS NOT NULL').get(P).n;
check('baseline: P6 forecast dates on activities', withFloat > 100, String(withFloat));

// site reports progress on a few activities
const ids = db.prepare("SELECT id FROM activities WHERE project_id = ? AND source = 'programme' ORDER BY sort_order LIMIT 60").all(P).map((x) => x.id);
const ins = db.prepare("INSERT INTO updates (project_id, activity_id, report_date, pct, actual_start, actual_finish, status, submitted_by, created_at) VALUES (?,?,?,?,?,?,?,?,?)");
ins.run(P, ids[0], '2025-10-10', 100, '2025-09-01', '2025-10-10', 'complete', 'R. Kumar', 'x');   // verified below
ins.run(P, ids[1], '2025-10-10', 100, '2025-09-01', '2025-10-09', 'complete', 'R. Kumar', 'x');   // not verified
ins.run(P, ids[2], '2025-10-10', 40, '2025-10-01', null, 'in_progress', 'R. Kumar', 'x');
ins.run(P, ids[3], '2025-10-10', 70, '2025-09-20', null, 'in_progress', 'R. Kumar', 'x');         // queried below
ins.run(P, ids[29], '2025-10-10', 20, '2025-10-05', null, 'in_progress', 'R. Kumar', 'x');        // will be removed by P6
db.prepare("INSERT INTO verifications (project_id, activity_id, status, by, at) VALUES (?,?,?,?,?)").run(P, ids[0], 'verified', 'A. Haddad', 'x');
db.prepare("INSERT INTO verifications (project_id, activity_id, status, by, at, note) VALUES (?,?,?,?,?,?)").run(P, ids[3], 'queried', 'A. Haddad', 'x', 'photo please');

// ---- AETRAA → P6
await as('site@naf.ae');
r = await call('/api/programme/p6-progress', null, true);
check('site cannot take progress out for P6', r.status === 403);
await as('plan@naf.ae');
r = await call('/api/programme/p6-progress', null, true);
check('planner downloads progress for P6', r.status === 200 && /spreadsheetml/.test(r.headers.get('content-type')) && r.bytes[0] === 0x50, 'status=' + r.status);
check('four rows sent (queried one held back)', r.headers.get('x-rows') === '4', r.headers.get('x-rows'));
mkdirSync(new URL('../test-output/', import.meta.url), { recursive: true });
writeFileSync(new URL('../test-output/progress-for-P6.xlsx', import.meta.url), r.bytes);
const rv = await call('/api/programme/p6-review', null, true);
writeFileSync(new URL('../test-output/progress-review.xlsx', import.meta.url), rv.bytes);
check('review sheet downloads', rv.status === 200 && rv.headers.get('x-rows') === '5', rv.headers.get('x-rows'));

// ---- P6 → AETRAA
r = await call('/api/programme/preview', { file_b64: b64(readFileSync(upd)) });
check('planner previews the update', r.json && r.json.ok, r.text.slice(0, 200));
const s = r.json.summary;
console.log('     summary:', JSON.stringify({ dd: s.data_date, fin: s.forecast_finish, act: s.activities, done: s.completed_since_last,
  later: s.finish_later, neg: s.negative_float, removedWithRecords: s.removed_with_site_records, overlap: s.overlap_pct }));
check('one added, one removed', s.activities.added === 1 && s.activities.removed === 1, JSON.stringify(s.activities));
check('the removed one had site records — said so', s.removed_with_site_records === 1);
check('completions counted', s.completed_since_last >= 19, String(s.completed_since_last));
check('slips found', s.finish_later >= 15 && s.biggest_slips[0].days === 14, JSON.stringify(s.biggest_slips[0]));
check('preview wrote nothing', db.prepare("SELECT COUNT(*) AS n FROM activities WHERE project_id = ? AND id = 'NEW-ACT-001'").get(P).n === 0);
const updatesBefore = db.prepare('SELECT COUNT(*) AS n FROM updates WHERE project_id = ?').get(P).n;
r = await call('/api/programme/commit', { file_b64: b64(readFileSync(upd)) });
check('planner applies the update', r.json && r.json.ok, r.text.slice(0, 200));
check('new activity is on the programme', db.prepare("SELECT COUNT(*) AS n FROM activities WHERE project_id = ? AND id = 'NEW-ACT-001'").get(P).n === 1);
check('removed activity is off the programme', db.prepare('SELECT COUNT(*) AS n FROM activities WHERE project_id = ? AND id = ?').get(P, ids[29]).n === 0);
check('…but its site records are kept', db.prepare('SELECT COUNT(*) AS n FROM updates WHERE project_id = ? AND activity_id = ?').get(P, ids[29]).n === 1);
check('no site update lost', db.prepare('SELECT COUNT(*) AS n FROM updates WHERE project_id = ?').get(P).n === updatesBefore);
const done = db.prepare('SELECT status, actual_finish FROM activities WHERE project_id = ? AND id = ?').get(P, ids[5]);
check('P6 status and actuals copied', done.status === 'complete' && /^2025-10-10/.test(done.actual_finish || ''), JSON.stringify(done));
check('derived deliverables kept', db.prepare("SELECT COUNT(*) AS n FROM activities WHERE project_id = ? AND source = 'derived'").get(P).n > 0);

// a different project's file is refused
const other = process.argv[4];
if (other) {
  r = await call('/api/programme/commit', { file_b64: b64(readFileSync(other)) });
  check('another project\'s .xer is refused', r.status === 400 && /different project/.test(r.json.error || ''), r.text.slice(0, 200));
}
await as('site@naf.ae');
r = await call('/api/programme/commit', { file_b64: b64(readFileSync(upd)) });
check('site cannot update the programme', r.status === 403);
r = await call('/programme');
check('site does not get the programme page', !/P6 update &amp; export/.test(r.text));
await as('plan@naf.ae');
r = await call('/programme');
check('planner gets the programme page', /Download progress for P6/.test(r.text));
r = await call('/');
check('planner sidebar has "P6 update & export"', /P6 update & export/.test(r.text));

console.log('\n' + checks + ' checks, ' + fails + ' failures');
process.exit(fails ? 1 : 0);
