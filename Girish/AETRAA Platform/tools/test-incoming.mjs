// STEP 7 — incoming correspondence: logged, owned, answered, chased.
//
//   node tools/test-incoming.mjs
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { buildReport, reportHTML } from '../src/report.js';

let fails = 0, checks = 0;
const check = (n, c, d) => { checks++; console.log((c ? '  ok   ' : '  FAIL ') + n + (d && !c ? '  — ' + String(d).slice(0, 300) : '')); if (!c) fails++; };
const T = new Date(Date.now() + 4 * 3600000).toISOString().slice(0, 10);
const shift = (d, n) => new Date(Date.parse(d + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);

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
const rec = (ref) => db.prepare('SELECT * FROM records WHERE ref = ?').get(ref);
const log = (data) => call('/api/records', { type: 'incoming', title: data.Subject, data });

await call('/api/login', { code: 'MASTERCODE-0123456789' });
const admin = cookie;
let r = await call('/api/setup/onboard', { company: { name: 'NAF' }, project: { name: 'Tower A' }, principal: { name: 'M. Boss', email: 'boss@naf.ae' } });
const P = r.json.project_id;
for (const [n, e, f] of [['A. Haddad', 'pm@naf.ae', ['pm']], ['L. Park', 'dc@naf.ae', ['dc']], ['Q. Surveyor', 'qs@naf.ae', ['commercial']],
  ['D. Okafor', 'des@naf.ae', ['design']], ['R. Kumar', 'site@naf.ae', ['site']]]) {
  await call('/api/person', { name: n, email: e, functions: f, projects: [P] });
}

// ---- who logs
await as('site@naf.ae');
r = await log({ From: 'Dar', Subject: 'x', 'Action by': 'Project Manager' });
check('Site cannot log incoming letters', r.status === 403, r.text);
await as('des@naf.ae');
check('Design cannot log incoming letters', (await log({ From: 'Dar', Subject: 'x', 'Action by': 'Project Manager' })).status === 403);

// ---- logging, and its checks
await as('dc@naf.ae');
r = await log({ From: 'Dar', Subject: 'x', 'Date received': shift(T, 2), 'Action by': 'Project Manager' });
check('received in the future is refused', r.status === 400 && /future/.test(r.json.error), r.text);
r = await log({ From: 'Dar', Subject: 'x', 'Letter date': shift(T, -1), 'Date received': shift(T, -3), 'Action by': 'Project Manager' });
check('a letter dated after it arrived is refused', r.status === 400 && /dated after/.test(r.json.error));
r = await log({ Subject: 'x', 'Action by': 'Project Manager' });
check('"From" is needed', r.status === 400 && /who it is from/.test(r.json.error));
r = await log({ From: 'Dar', Subject: 'x', 'Action by': 'Tea boy' });
check('an unknown role is refused', r.status === 400 && /not a role/.test(r.json.error));

const rec1 = shift(T, -2);
r = await log({ From: 'Dar Consult (Engineer)', 'Their reference': 'DAR/TWR/L-118', 'Letter date': shift(T, -3), 'Date received': rec1,
  Subject: 'Programme revision required', Type: 'Instruction', 'Action by': 'Contracts & Commercial' });
check('IN-001 logged', r.status === 200 && r.json.ref === 'IN-001', r.text);
let x = rec('IN-001');
check('reply due 7 days from receipt', x.due === shift(rec1, 7) && /7 days from receipt/.test(x.due_basis), JSON.stringify([x.due, x.due_basis]));
check('dated as received, not as logged', x.submitted === rec1);
check('sent to Contracts & Commercial (and the PM / DC)', JSON.parse(x.workflow)[1].by.join() === 'commercial,pm,dc' && /With Contracts & Commercial/.test(x.status), x.status);
check('the action owner is told', r.json.notified && r.json.notified.ok && r.json.notified.sent === 1, JSON.stringify(r.json.notified));
await as('qs@naf.ae');
r = await call('/api/notifications');
check('…and it is in the QS\'s bell', r.json.unread === 1 && /IN-001 received from Dar Consult/.test(r.json.items[0].title), JSON.stringify(r.json).slice(0, 300));

await as('dc@naf.ae');
r = await log({ From: 'Client', Subject: 'Holiday notice', 'Action by': 'For information only' });
x = rec(r.json.ref);
check('for information: filed and closed, no reply date', x.status === 'Filed — for information' && x.step === 1 && !x.due && x.cls === 'ok', JSON.stringify(x));
r = await log({ From: 'DEWA', Subject: 'Substation NOC comments', 'Action by': 'Design & Documents', 'Reply by': shift(T, 3) });
check('a reply-by date typed in wins', rec(r.json.ref).due === shift(T, 3) && rec(r.json.ref).due_basis === 'entered');
const in3 = r.json.ref;
const oldRcv = shift(T, -20);
r = await log({ From: 'Dar Consult (Engineer)', Subject: 'Site safety — hoarding', 'Date received': oldRcv, 'Action by': 'Project Manager' });
const in4 = r.json.ref;
check('an old letter logged late is overdue at once', rec(in4).due === shift(oldRcv, 7) && rec(in4).due < T);

// ---- the project's own reply period
cookie = admin;
r = await call('/api/setup/response-days?project=' + P);
check('incoming shows in the response periods, from receipt', r.json.periods.incoming && r.json.periods.incoming.from === 'received' && r.json.periods.incoming.days === 7);
await call('/api/setup/response-days', { project_id: P, periods: { incoming: 10 } });
await as('dc@naf.ae');
r = await log({ From: 'Client', Subject: 'Façade colour', 'Date received': T, 'Action by': 'Project Manager' });
check('…and the project can change it (10 days)', rec(r.json.ref).due === shift(T, 10));
const in5 = r.json.ref;

// ---- answering it
await as('des@naf.ae');
r = await call('/api/record/advance', { ref: 'IN-001', action: 'advance', note: 'x' });
check('someone it was not sent to cannot close it', r.status === 403, r.text);
await as('qs@naf.ae');
r = await call('/api/record/advance', { ref: 'IN-001', action: 'advance' });
check('closing without a reply needs a reason', r.status === 400 && /why no reply/.test(r.json.error));
r = await call('/api/record/advance', { ref: 'IN-001', action: 'reject' });
check('an incoming letter is not "rejected"', r.status === 400);
r = await call('/api/records', { type: 'letter', title: 'Re: programme', data: { Subject: 'Re: programme', 'In reply to': 'IN-099' } });
check('a reply to a letter that does not exist is refused', r.status === 400 && /no incoming letter IN-099/.test(r.json.error), r.text);
r = await call('/api/records', { type: 'letter', title: 'Re: programme revision', data: { Subject: 'Re: programme revision', Type: 'Response', 'In reply to': 'in-1' } });
check('reply drafted, linked to IN-001', r.status === 200 && r.json.record.data['In reply to'] === 'IN-001', r.text);
const ltr = r.json.ref;
check('drafting does not close the incoming letter', !/Replied/.test(rec('IN-001').status));
await as('pm@naf.ae');
await call('/api/record/advance', { ref: ltr, action: 'advance' });                  // PM signs
check('signing does not close it either — only issue does', !/Replied/.test(rec('IN-001').status));
await as('dc@naf.ae');
r = await call('/api/record/advance', { ref: ltr, action: 'advance' });              // DC issues
check('issuing the reply closes IN-001', r.status === 200 && (r.json.replied_to || []).join() === 'IN-001', r.text);
x = rec('IN-001');
check('…as "Replied — LTR-001 issued"', new RegExp('^Replied — ' + ltr + ' issued ' + T).test(x.status) && x.cls === 'ok' && x.step === 1, x.status);
check('…signed by Document Control', /L\. Park/.test(JSON.parse(x.workflow)[1].who));

await as('des@naf.ae');
r = await call('/api/record/advance', { ref: in3, action: 'advance', note: 'Answered at the design coordination meeting on ' + T });
check('the owner closes with a reason', r.status === 200 && /^Closed — no reply needed: Answered at the design/.test(rec(in3).status), r.text);

// ---- the registers and the report
await as('pm@naf.ae');
r = await call('/api/records?type=incoming');
const list = r.json.records;
check('the register lists every incoming letter', list.length === 5, list.length);
check('the late one is overdue and still with the PM', list.find((l) => l.ref === in4).due < T && list.find((l) => l.ref === in4).next_by.includes('Project Manager'));
const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(P);
const mo = await buildReport(env, P, project, 'monthly', T.slice(0, 7));
const incRow = mo.regs.types.find((t) => t.type === 'incoming');
check('monthly report: incoming letters counted', incRow && incRow.label === 'Incoming letter', JSON.stringify(incRow));
check('monthly report: the overdue letter is in the overdue list', mo.regs.overdue.some((o) => o.ref === in4));
check('monthly report: letters received are listed with who sent them', (mo.regs.received || []).some((o) => o.ref === 'IN-001' && /Dar Consult/.test(o.from)));
check('…and rendered', /Received/.test(reportHTML(mo)) && reportHTML(mo).includes('DAR/TWR/L-118'));

console.log('\n' + checks + ' checks, ' + fails + ' failures');
process.exit(fails ? 1 : 0);
