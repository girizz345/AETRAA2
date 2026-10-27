// WHO SIGNS WHAT — each workflow step has an owner; Document Control issues;
// and Document Control can notify the team.
//
//   node tools/test-workflow.mjs
//
// The real worker, the real schema, an in-memory SQLite.
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { RECORD_TYPES, pendingStep } from '../src/records.js';
import { RECORD_CREATORS } from '../src/functions.js';

let fails = 0, checks = 0;
const check = (n, c, d) => { checks++; console.log((c ? '  ok   ' : '  FAIL ') + n + (d && !c ? '  — ' + d : '')); if (!c) fails++; };

/* ---------------------------------------------------------------- the table */
for (const [type, t] of Object.entries(RECORD_TYPES)) {
  check(type + ': every step has an owner', t.wf.every((s) => Array.isArray(s.by) && s.by.length));
  check(type + ': raised by who may raise it', (RECORD_CREATORS[type] || []).every((f) => t.wf[0].by.includes(f)) ||
    t.wf[0].by.every((f) => (RECORD_CREATORS[type] || []).includes(f)), JSON.stringify([t.wf[0].by, RECORD_CREATORS[type]]));
}
for (const type of ['submittal', 'ms', 'material', 'rfi', 'authority', 'letter', 'variation', 'wir', 'mir']) {
  const wf = RECORD_TYPES[type].wf;
  const iss = wf.findIndex((s) => s.issue);
  check(type + ': Document Control issues it', iss > 0 && wf[iss].by.join() === 'dc');
  const pm = wf.findIndex((s, i) => i > 0 && (s.by.includes('pm') || s.by.includes('qaqc') || s.by.includes('principal')));
  check(type + ': it is approved before it is issued', pm > 0 && pm < iss, JSON.stringify(wf.map((s) => s.st)));
}
check('no step issues without DC', Object.values(RECORD_TYPES).every((t) => t.wf.every((s) => !s.issue || s.by.join() === 'dc')));

/* ----------------------------------------------------------------- the API */
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
const ctx = { waitUntil() {}, passThroughOnException() {} };
let cookie = '';
async function call(path, opts = {}) {
  const headers = Object.assign({}, opts.headers || {});
  if (cookie) headers.Cookie = cookie;
  if (opts.body) headers['Content-Type'] = 'application/json';
  const res = await worker.fetch(new Request('http://localhost' + path, { method: opts.method || 'GET', headers, body: opts.body }), env, ctx);
  const sc = res.headers.get('set-cookie');
  if (sc) cookie = sc.split(',').map((c) => c.split(';')[0].trim()).join('; ');
  const text = await res.text();
  let json = null; try { json = JSON.parse(text); } catch (e) {}
  return { status: res.status, text, json };
}
const post = (path, body) => call(path, { method: 'POST', body: JSON.stringify(body) });
const as = async (email) => { cookie = ''; const r = await post('/api/signin/code', { email, code: '246810' }); return r.json && r.json.ok; };

await post('/api/login', { code: 'MASTERCODE-0123456789' });
const admin = cookie;
let r = await post('/api/setup/onboard', { company: { name: 'NAF Contracting LLC' }, project: { name: 'Tower A' } });
const A = r.json.project_id;
r = await post('/api/setup/onboard', { company: { name: 'Other Co' }, project: { name: 'Elsewhere' } });
const OTHER_ORG = r.json.company_id;
const oid = (await call('/api/setup/companies')).json.companies.find((c) => c.name === 'NAF Contracting LLC').id;
const people = [
  ['A. Haddad', 'pm@naf.ae', ['pm']], ['D. Okafor', 'design@naf.ae', ['design']], ['L. Park', 'dc@naf.ae', ['dc']],
  ['Q. Rahman', 'qa@naf.ae', ['qaqc']], ['S. Farouk', 'hse@naf.ae', ['hse']], ['R. Kumar', 'site@naf.ae', ['site']],
];
for (const [name, email, functions] of people) {
  r = await post('/api/person?org=' + oid, { org: oid, name, email, functions, projects: [A] });
  check('Admin adds ' + email, r.status === 200 && !(r.json && r.json.error), r.text.slice(0, 160));
}
cookie = admin;
r = await post('/api/person?org=' + OTHER_ORG, { org: OTHER_ORG, name: 'X. Outsider', email: 'x@other.ae', functions: ['pm'] });

// ---- an RFI, end to end
check('design signs in', await as('design@naf.ae'));
r = await post('/api/records', { type: 'rfi', title: 'Beam / duct clash at L5', workflow: ['Raised', 'Closed'] });
check('design raises an RFI', r.status === 200 && r.json.ok, r.text.slice(0, 160));
const RFI = r.json.ref;
const stored = JSON.parse(db.prepare('SELECT workflow FROM records WHERE ref = ?').get(RFI).workflow);
check('a workflow sent by the browser is ignored', stored.length === 4 && stored[2].st.includes('Document Control'), JSON.stringify(stored.map((s) => s.st)));
r = await post('/api/record/advance', { ref: RFI, action: 'advance' });
check('design CANNOT sign "PM approves"', r.status === 403 && /Project Manager/.test(r.json.error), r.text.slice(0, 160));
r = await call('/api/records?type=rfi');
check('design sees it waiting on the PM', r.json.records[0].can_act === false && r.json.records[0].next_by.includes('Project Manager'), JSON.stringify(r.json.records[0].next_by));

await as('dc@naf.ae');
r = await post('/api/record/advance', { ref: RFI, action: 'advance' });
check('DC cannot issue before the PM approves', r.status === 403, r.text.slice(0, 160));

await as('pm@naf.ae');
r = await post('/api/record/advance', { ref: RFI, action: 'advance' });
check('the PM approves', r.status === 200 && /Document Control/.test(r.json.status), r.text.slice(0, 160));

await as('design@naf.ae');
r = await post('/api/record/advance', { ref: RFI, action: 'advance' });
check('design CANNOT issue it', r.status === 403, r.text.slice(0, 120));

await as('dc@naf.ae');
r = await call('/api/records?type=rfi');
check('DC sees it is theirs to issue', r.json.records[0].can_act === true && r.json.records[0].next_is_issue === true);
r = await post('/api/record/advance', { ref: RFI, action: 'advance' });
check('DC issues it', r.status === 200, r.text.slice(0, 160));
r = await call('/api/records?type=rfi');
check('next: DC records the consultant reply', r.json.records[0].next_is_reply === true && r.json.records[0].can_act === true);
r = await post('/api/record/advance', { ref: RFI, action: 'close' });
check('DC cannot close a record early', r.status === 403, r.text.slice(0, 120));
r = await post('/api/record/advance', { ref: RFI, action: 'advance', status: 'Answered / noted' });
check('DC records the reply', r.status === 200 && r.json.status === 'Answered / noted', r.text.slice(0, 160));
r = await post('/api/record/advance', { ref: RFI, action: 'advance' });
check('nothing after the last step', r.status === 403 && /closed/.test(r.json.error), r.text.slice(0, 120));
const wf = JSON.parse(db.prepare('SELECT workflow FROM records WHERE ref = ?').get(RFI).workflow);
check('each step carries who signed it', wf[1].who === 'A. Haddad' && wf[2].who === 'L. Park' && wf[3].who === 'L. Park', JSON.stringify(wf.map((s) => s.who)));

// ---- a method statement
await as('site@naf.ae');
r = await post('/api/records', { type: 'ms', title: 'L5 slab pour', data: { Title: 'L5 slab pour' } });
check('site raises a method statement', r.status === 200 && /^MS-\d{3}$/.test(r.json.ref), r.text.slice(0, 160));
const MS = r.json.ref;
r = await post('/api/record/advance', { ref: MS, action: 'advance' });
check('site cannot review its own MS', r.status === 403);
await as('hse@naf.ae');
r = await post('/api/record/advance', { ref: MS, action: 'advance' });
check('HSE reviews it', r.status === 200, r.text.slice(0, 120));
r = await post('/api/record/advance', { ref: MS, action: 'advance' });
check('HSE cannot then approve for the PM', r.status === 403);
await as('pm@naf.ae');
r = await post('/api/record/advance', { ref: MS, action: 'advance' });
check('PM approves the MS', r.status === 200 && /Document Control/.test(r.json.status), r.text.slice(0, 160));

// ---- drawings: design and DC upload; HSE does not
await as('hse@naf.ae');
r = await post('/api/drawing', { number: 'ST-210', revision: 'C', title: 'L5 slab', kind: 'ifc', url: 'https://example.com/st210.pdf' });
check('HSE CANNOT upload a drawing', r.status === 403, 'status=' + r.status + ' ' + r.text.slice(0, 120));
await as('dc@naf.ae');
r = await post('/api/drawing', { number: 'ST-210', revision: 'C', title: 'L5 slab', kind: 'ifc', url: 'https://example.com/st210.pdf' });
check('DC uploads a drawing', r.status === 200 && r.json && r.json.ok, 'status=' + r.status + ' ' + r.text.slice(0, 160));

// ---- notify the team
r = await call('/api/notify/team');
check('DC gets the project team', r.status === 200 && r.json.team.length === 5 && !r.json.team.some((u) => u.name === 'L. Park'),
  r.text.slice(0, 200));
check('outsiders are not on it', !r.json.team.some((u) => /Outsider/.test(u.name)));
const byName = Object.fromEntries(r.json.team.map((u) => [u.name, u.id]));
r = await post('/api/notify', { people: [byName['R. Kumar'], byName['Q. Rahman']], title: 'ST-210 rev C uploaded', message: 'Use rev C from today.', ref: 'ST-210', email: true });
check('DC notifies two people', r.status === 200 && r.json.sent === 2, r.text.slice(0, 160));
check('no email without a key (and no error)', r.json.emailed === false);
r = await post('/api/notify', { functions: ['qaqc'], title: 'QA only' });
check('by function', r.status === 200 && r.json.sent === 1, r.text.slice(0, 120));
r = await post('/api/notify', { people: ['usr_nobody'], title: 'x' });
check('nobody real picked → refused', r.status === 400);
const outsider = db.prepare("SELECT id FROM users WHERE email = 'x@other.ae'").get();
if (outsider) {
  r = await post('/api/notify', { people: [outsider.id], title: 'leak' });
  check('another company\'s person cannot be notified', r.status === 400);
}

await as('site@naf.ae');
r = await call('/api/notifications');
check('site has one unread', r.json.unread === 1 && r.json.items[0].title === 'ST-210 rev C uploaded', r.text.slice(0, 200));
check('with who sent it and the project', r.json.items[0].sent_by_name === 'L. Park' && r.json.items[0].project_name === 'Tower A');
r = await post('/api/notify', { all: true, title: 'site tries' });
check('site CANNOT notify the team', r.status === 403);
await post('/api/notifications/read', { ids: [ (await call('/api/notifications')).json.items[0].id ] });
check('marked read', (await call('/api/notifications')).json.unread === 0);

await as('qa@naf.ae');
check('QA has two', (await call('/api/notifications')).json.unread === 2);
await post('/api/notifications/read', { all: true });
check('mark all read', (await call('/api/notifications')).json.unread === 0);
await as('hse@naf.ae');
check('HSE got none', (await call('/api/notifications')).json.unread === 0);

// the shell is told who may notify
await as('dc@naf.ae');
r = await call('/');
check('DC shell: may notify', /"mayNotify":true/.test(r.text));
check('the bell and dialog are in the page', r.text.includes('id="ntfDlg"') && r.text.includes('bellN'));
await as('site@naf.ae');
r = await call('/');
check('site shell: may not notify', /"mayNotify":false/.test(r.text));

console.log('\n' + checks + ' checks, ' + fails + ' failures');
process.exit(fails ? 1 : 0);
