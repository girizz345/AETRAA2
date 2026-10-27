// STEP 10 — "Needs my attention": the right things reach the right person.
//
//   node tools/test-attention.mjs
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';

let fails = 0, checks = 0;
const check = (n, c, d) => { checks++; console.log((c ? '  ok   ' : '  FAIL ') + n + (d && !c ? '  — ' + String(d).slice(0, 400) : '')); if (!c) fails++; };
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
const sent = [];
globalThis.fetch = ((real) => async (url, init) => {
  if (String(url).includes('api.resend.com')) { sent.push(JSON.parse(init.body)); return new Response('{"id":"x"}', { status: 200 }); }
  return real(url, init);
})(globalThis.fetch);
const env = {
  DB: { prepare: stmt, async batch(l) { for (const s of l) await s.run(); return []; }, async exec(s) { db.exec(s); } },
  OWNER_CODE: 'MASTERCODE-0123456789', LOGIN_TEST_CODE: '246810', AUTH_SECRET: 'x'.repeat(40), RESEND_KEY: 're_test',
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
const att = async (email) => { await as(email); return (await call('/api/attention')).json; };
const refs = (a) => a.items.map((i) => i.ref);

await call('/api/login', { code: 'MASTERCODE-0123456789' });
const admin = cookie;
let r = await call('/api/setup/onboard', { company: { name: 'NAF' }, project: { name: 'Tower A' }, principal: { name: 'M. Boss', email: 'boss@naf.ae' } });
const P = r.json.project_id;
db.prepare('UPDATE projects SET created_at = ? WHERE id = ?').run(shift(T, -30) + 'T00:00:00Z', P);
await call('/api/boq/import', { project_id: P, rows: [{ section: 'S', ref: 'A1', qty: 1, rate: 1000 }] });
for (const [n, e, f] of [['A. Haddad', 'pm@naf.ae', ['pm']], ['L. Park', 'dc@naf.ae', ['dc']], ['Q. Surveyor', 'qs@naf.ae', ['commercial']],
  ['D. Okafor', 'des@naf.ae', ['design']], ['R. Kumar', 'site@naf.ae', ['site']], ['K. QA', 'qa@naf.ae', ['qaqc']], ['F. Nair', 'fin@naf.ae', ['finance']]]) {
  await call('/api/person', { name: n, email: e, functions: f, projects: [P] });
}

// ---- things waiting on people
await as('des@naf.ae');
const rfi = (await call('/api/records', { type: 'rfi', title: 'Beam clash', data: { 'Reply needed by': shift(T, -2) } })).json.ref;   // waits on the PM, overdue
await as('site@naf.ae');
const wir = (await call('/api/records', { type: 'wir', title: 'Slab pour' })).json.ref;                                             // waits on QA/QC
await as('dc@naf.ae');
const inc1 = (await call('/api/records', { type: 'incoming', data: { From: 'Dar', Subject: 'Programme', 'Action by': 'Contracts & Commercial', 'Date received': shift(T, -20) } })).json.ref;   // QS, overdue
const inc2 = (await call('/api/records', { type: 'incoming', data: { From: 'Client', Subject: 'Colour', 'Action by': 'Design & Documents' } })).json.ref;                               // Design, not late
await as('pm@naf.ae');
const team = (await call('/api/meetings')).json.team;
const idOf = (n) => team.find((u) => u.name === n).id;
await call('/api/meeting', { type: 'progress', meeting_date: T, attendees: [{ name: 'A', present: true }],
  items: [{ subject: 'x', actions: [{ text: 'Send the revised programme', owner_user_id: idOf('Q. Surveyor'), due: shift(T, 5) }] }] });
await call('/api/meeting/issue', { ref: 'PRG-001' });
// A payment application waiting on the PM
await as('qs@naf.ae');
const prop = (await call('/api/ipc/propose', { period_to: T })).json;
r = await call('/api/ipc', { lines: prop.lines.map((l) => ({ key: l.key, pct: 50 })), reviewed: true, period_from: shift(T, -10), period_to: T });
check('a payment application is prepared', r.status === 200, r.text);
// A diary missing, one left as a draft
await as('pm@naf.ae');
let dDraft = shift(T, -1); while (new Date(dDraft + 'T00:00:00Z').getUTCDay() === 5) dDraft = shift(dDraft, -1);
await call('/api/diary', { report_date: dDraft, weather: 'Sunny' });
// A drawing waiting for the PM's approval
db.prepare(`INSERT INTO drawings (project_id, id, number, revision, title, kind, status, uploaded_at) VALUES (?,?,?,?,?,?,?,?)`)
  .run(P, 'dw1', 'AR-101', 'B', 'GA plan', 'ifc', 'pending', shift(T, -5) + 'T08:00:00Z');
// A finished activity waiting for verification, and one queried back to site
db.prepare("INSERT INTO activities (project_id, id, name, level, sort_order) VALUES (?,?,?,1,1)").run(P, 'A100', 'Blockwork L2');
db.prepare("INSERT INTO activities (project_id, id, name, level, sort_order) VALUES (?,?,?,1,2)").run(P, 'A200', 'Screed L1');
const up = db.prepare("INSERT INTO updates (project_id, activity_id, report_date, pct, status, submitted_by, source, created_at) VALUES (?,?,?,?,?,?,'site','x')");
up.run(P, 'A100', shift(T, -6), 100, 'complete', 'R. Kumar');
up.run(P, 'A200', shift(T, -2), 60, 'in_progress', 'R. Kumar');
const upId = db.prepare("SELECT MAX(id) AS n FROM updates WHERE activity_id = 'A200'").get().n;
db.prepare(`CREATE TABLE IF NOT EXISTS verifications (project_id TEXT, activity_id TEXT, update_id INTEGER, status TEXT, note TEXT, by TEXT, at TEXT, PRIMARY KEY (project_id, activity_id))`).run();
db.prepare(`INSERT INTO verifications (project_id, activity_id, update_id, status, note, by, at) VALUES (?,?,?,?,?,?,?)`).run(P, 'A200', upId, 'queried', 'Photo shows 40%, not 60%', 'PM', T);

// ---- who sees what
let a = await att('pm@naf.ae');
check('PM: the RFI waiting on the PM, overdue', a.items.some((i) => i.ref === rfi && i.overdue && i.kind === 'record'), JSON.stringify(refs(a)));
check('PM: the payment application to approve', a.items.some((i) => i.kind === 'payment' && /Approve/.test(i.need)));
check('PM: the overdue incoming letter (it is late)', a.items.some((i) => i.ref === inc1 && i.overdue));
check('PM: not the incoming letter that is on time', !a.items.some((i) => i.ref === inc2));
check('PM: not the inspection (QA/QC\'s step)', !a.items.some((i) => i.ref === wir));
check('PM: the draft diary and the missing days', a.items.some((i) => i.kind === 'diary' && i.ref === dDraft && /draft/.test(i.need)) && a.items.some((i) => i.kind === 'diary' && /No diary/.test(i.need)));
check('PM: the drawing to approve', a.items.some((i) => i.kind === 'drawing' && /AR-101/.test(i.ref) && i.overdue));
check('PM: finished work to verify', a.items.some((i) => i.kind === 'verify' && i.count === 1));
check('overdue first', a.items.slice(0, a.overdue).every((i) => i.overdue) && a.overdue >= 4, JSON.stringify(a.items.map((i) => [i.ref, i.overdue])));
a = await att('qs@naf.ae');
check('QS: the incoming letter sent to Commercial, overdue', a.items.some((i) => i.ref === inc1 && i.kind === 'incoming' && i.overdue));
check('QS: the meeting action', a.items.some((i) => i.kind === 'action' && /revised programme/.test(i.title)));
check('QS: nothing that is not theirs', !a.items.some((i) => i.ref === rfi || i.ref === wir || i.kind === 'diary' || i.kind === 'drawing'), JSON.stringify(refs(a)));
a = await att('qa@naf.ae');
check('QA/QC: exactly the inspection', a.total === 1 && a.items[0].ref === wir, JSON.stringify(refs(a)));
a = await att('des@naf.ae');
check('Design: the incoming letter sent to Design', a.items.some((i) => i.ref === inc2) && !a.items.some((i) => i.ref === rfi), JSON.stringify(refs(a)));
a = await att('site@naf.ae');
check('Site: the claim queried back, with the office\'s note', a.items.some((i) => i.kind === 'queried' && /40%/.test(i.need)), JSON.stringify(a.items));
a = await att('fin@naf.ae');
check('Finance: nothing until something is certified', a.total === 0, JSON.stringify(refs(a)));

// ---- move things along, and the list follows
await as('pm@naf.ae');
await call('/api/ipc/advance', { ref: 'IPA-01', action: 'approve' });
a = await att('dc@naf.ae');
check('after approval: Document Control is asked to issue it', a.items.some((i) => i.kind === 'payment' && /Issue it/.test(i.need)), JSON.stringify(a.items.filter((i) => i.kind === 'payment')));
await call('/api/ipc/advance', { ref: 'IPA-01', action: 'issue', date: shift(T, -40 + 30) });
await call('/api/ipc/advance', { ref: 'IPA-01', action: 'certify', certified_amount: '400', date: shift(T, -1) });
a = await att('fin@naf.ae');
check('once certified: Finance is asked to record the payment', a.items.some((i) => i.kind === 'payment' && /Record the payment/.test(i.need)));
a = await att('pm@naf.ae');
check('…and the PM no longer has it to approve', !a.items.some((i) => i.kind === 'payment' && /Approve/.test(i.need)));

// ---- the morning email
cookie = admin;
await call('/api/project', { action: 'report', id: P, report_emails: 'pm@naf.ae', report_digest: true });
check('morning list switched on', db.prepare('SELECT report_digest FROM projects WHERE id = ?').get(P).report_digest === 1);
sent.length = 0;
const waits = [];
await worker.scheduled({ cron: '0 2 * * *', scheduledTime: Date.now() }, env, { waitUntil(p) { waits.push(p); } });
await Promise.all(waits);
const to = sent.map((m) => m.to[0]).sort();
check('each person with something waiting gets one email of their own', ['pm@naf.ae', 'qs@naf.ae', 'qa@naf.ae', 'fin@naf.ae', 'site@naf.ae'].every((e) => to.includes(e)) && new Set(to).size === to.length, JSON.stringify(to));
check('nobody gets an empty list', sent.every((m) => !/— 0 thing/.test(m.subject)));
const pmMail = sent.find((m) => m.to[0] === 'pm@naf.ae');
check('the PM\'s email lists the PM\'s items only', pmMail && pmMail.html.includes(rfi) && !pmMail.html.includes(wir) && /overdue/.test(pmMail.subject), pmMail && pmMail.subject);
const qaMail = sent.find((m) => m.to[0] === 'qa@naf.ae');
check('QA/QC\'s email has one item', qaMail && /Tower A — 1 thing needs you/.test(qaMail.subject), qaMail && qaMail.subject);
db.prepare('UPDATE projects SET report_digest = 0 WHERE id = ?').run(P);
sent.length = 0; waits.length = 0;
await worker.scheduled({ cron: '0 2 * * *', scheduledTime: Date.now() }, env, { waitUntil(p) { waits.push(p); } });
await Promise.all(waits);
check('switched off: nothing goes', sent.length === 0);

console.log('\n' + checks + ' checks, ' + fails + ' failures');
process.exit(fails ? 1 : 0);
