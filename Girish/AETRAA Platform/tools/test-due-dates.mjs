// STEP 2 — due dates, from the project's own terms.
//
//   node tools/test-due-dates.mjs
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { RESPONSE_DEFAULTS, responseDays, RECORD_TYPES } from '../src/records.js';

let fails = 0, checks = 0;
const check = (n, c, d) => { checks++; console.log((c ? '  ok   ' : '  FAIL ') + n + (d && !c ? '  — ' + d : '')); if (!c) fails++; };
const todayUAE = () => new Date(Date.now() + 4 * 3600000).toISOString().slice(0, 10);
const plus = (n) => new Date(Date.parse(todayUAE() + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);

// ---- the rules
check('every record type with a reply has a default', Object.keys(RECORD_TYPES).filter((t) => t !== 'cert').every((t) => RESPONSE_DEFAULTS[t]));
check('kinds issued by DC run from issue', ['rfi', 'submittal', 'ms', 'material', 'authority', 'letter', 'variation', 'wir', 'mir']
  .every((t) => RESPONSE_DEFAULTS[t].from === 'issue' && RECORD_TYPES[t].wf.some((s) => s.issue)));
check('internal kinds run from raised', ['ncr', 'obs', 'incident', 'ptw', 'mr']
  .every((t) => RESPONSE_DEFAULTS[t].from === 'raised' && !RECORD_TYPES[t].wf.some((s) => s.issue)));
check('RFI uses the project reply days', responseDays({ reply_days: 10 }, 'rfi').days === 10);
check('a project override wins', responseDays({ reply_days: 10, response_days: '{"rfi":5,"submittal":21}' }, 'rfi').days === 5 &&
  responseDays({ response_days: '{"submittal":21}' }, 'submittal').days === 21);
check('bad override text falls back to default', responseDays({ response_days: '{oops' }, 'ncr').days === 7);

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
  if (sc) cookie = sc.split(',').map((c) => c.split(';')[0].trim()).join('; ');
  const text = await res.text(); let json = null; try { json = JSON.parse(text); } catch (e) {}
  return { status: res.status, text, json };
}
const as = async (email) => { cookie = ''; return (await call('/api/signin/code', { email, code: '246810' })).json?.ok; };
const rec = (ref) => db.prepare('SELECT due, due_basis, status FROM records WHERE ref = ?').get(ref);

await call('/api/login', { code: 'MASTERCODE-0123456789' });
const admin = cookie;
let r = await call('/api/setup/onboard', { company: { name: 'NAF' }, project: { name: 'Tower', reply_days: 10 } });
const P = r.json.project_id;
for (const [n, e, f] of [['PM', 'pm@naf.ae', ['pm']], ['Des', 'des@naf.ae', ['design']], ['DC', 'dc@naf.ae', ['dc']], ['QA', 'qa@naf.ae', ['qaqc']]]) {
  await call('/api/person', { name: n, email: e, functions: f, projects: [P] });
}

// RFI: no date typed → no due until issued; issued → today + project's 10 days
await as('des@naf.ae');
const rfi = (await call('/api/records', { type: 'rfi', title: 'Beam clash' })).json.ref;
check('RFI raised without a date has no due yet', rec(rfi).due === null, JSON.stringify(rec(rfi)));
await as('pm@naf.ae'); await call('/api/record/advance', { ref: rfi, action: 'advance' });
check('…still none after PM approval (the consultant has not got it)', rec(rfi).due === null);
await as('dc@naf.ae'); r = await call('/api/record/advance', { ref: rfi, action: 'advance' });
check('issued → due today + 10 (project RFI reply days)', rec(rfi).due === plus(10), JSON.stringify(rec(rfi)));
check('…and says why', /10 days from issue/.test(rec(rfi).due_basis || ''), rec(rfi).due_basis);
check('the API returns it', r.json.due === plus(10));

// A date typed when raising always wins
await as('des@naf.ae');
const rfi2 = (await call('/api/records', { type: 'rfi', title: 'Handrail', data: { 'Reply needed by': '2026-12-01' } })).json.ref;
await as('pm@naf.ae'); await call('/api/record/advance', { ref: rfi2, action: 'advance' });
await as('dc@naf.ae'); await call('/api/record/advance', { ref: rfi2, action: 'advance' });
check('an entered date is kept through issue', rec(rfi2).due === '2026-12-01' && rec(rfi2).due_basis === 'entered', JSON.stringify(rec(rfi2)));

// NCR: runs from raised
await as('qa@naf.ae');
const ncr = (await call('/api/records', { type: 'ncr', title: 'Honeycombing' })).json.ref;
check('NCR due 7 days from raised', rec(ncr).due === plus(7) && /from raised/.test(rec(ncr).due_basis), JSON.stringify(rec(ncr)));

// Admin changes the periods
cookie = admin;
r = await call('/api/setup/response-days?project=' + P);
check('periods listed with defaults', r.json.periods.submittal.days === 14 && r.json.periods.rfi.days === 10);
r = await call('/api/setup/response-days', { project_id: P, periods: { submittal: 21, ncr: 0 } });
check('0 days refused', r.status === 400, r.text);
r = await call('/api/setup/response-days', { project_id: P, periods: { submittal: 21, ncr: 5 } });
check('saved', r.json.ok && r.json.periods.submittal === 21);
await as('des@naf.ae');
const sub = (await call('/api/records', { type: 'submittal', title: 'Formwork' })).json.ref;
await as('pm@naf.ae'); await call('/api/record/advance', { ref: sub, action: 'advance' });
await as('dc@naf.ae'); await call('/api/record/advance', { ref: sub, action: 'advance' });
check('submittal issued → +21 (project override)', rec(sub).due === plus(21), JSON.stringify(rec(sub)));
await as('qa@naf.ae');
const ncr2 = (await call('/api/records', { type: 'ncr', title: 'Cube failure' })).json.ref;
check('NCR now +5', rec(ncr2).due === plus(5));
check('records already issued keep their date', rec(rfi).due === plus(10));

// The register sees it
await as('pm@naf.ae');
r = await call('/api/records');
const s = r.json.records.find((x) => x.ref === sub);
check('register row carries due and basis', s.due === plus(21) && /21 days from issue/.test(s.due_basis), JSON.stringify(s).slice(0, 200));
cookie = '';
r = await call('/api/setup/response-days?project=' + P);
check('only the AETRAA Admin changes periods', r.status === 401);

console.log('\n' + checks + ' checks, ' + fails + ' failures');
process.exit(fails ? 1 : 0);
