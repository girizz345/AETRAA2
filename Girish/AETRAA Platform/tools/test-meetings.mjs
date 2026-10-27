// STEP 8 — meeting minutes and the action tracker.
//
//   node tools/test-meetings.mjs
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
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
async function call(path, body, raw) {
  const headers = {};
  if (cookie) headers.Cookie = cookie;
  if (body) headers['Content-Type'] = 'application/json';
  const res = await worker.fetch(new Request('http://localhost' + path, { method: body ? 'POST' : 'GET', headers, body: body ? JSON.stringify(body) : undefined }), env, { waitUntil() {} });
  const sc = res.headers.get('set-cookie');
  if (sc) cookie = sc.split(',').map((x) => x.split(';')[0].trim()).join('; ');
  if (raw) return { status: res.status, bytes: new Uint8Array(await res.arrayBuffer()), headers: res.headers };
  const text = await res.text(); let json = null; try { json = JSON.parse(text); } catch (e) {}
  return { status: res.status, text, json, headers: res.headers };
}
const as = async (email) => { cookie = ''; return (await call('/api/signin/code', { email, code: '246810' })).json?.ok; };

await call('/api/login', { code: 'MASTERCODE-0123456789' });
let r = await call('/api/setup/onboard', { company: { name: 'NAF' }, project: { name: 'Tower A' }, principal: { name: 'M. Boss', email: 'boss@naf.ae' } });
const P = r.json.project_id;
for (const [n, e, f] of [['A. Haddad', 'pm@naf.ae', ['pm']], ['L. Park', 'dc@naf.ae', ['dc']], ['Q. Surveyor', 'qs@naf.ae', ['commercial']],
  ['D. Okafor', 'des@naf.ae', ['design']], ['P. Ray', 'plan@naf.ae', ['planning']], ['C. Consult', 'cons@naf.ae', ['consultant']]]) {
  await call('/api/person', { name: n, email: e, functions: f, projects: [P] });
}

// ---- who writes, who issues
await as('cons@naf.ae');
r = await call('/api/meeting', { type: 'progress', meeting_date: T });
check('a consultant login cannot write minutes', r.status === 403, r.text);
await as('pm@naf.ae');
r = await call('/api/meetings');
const team = r.json.team;
const idOf = (name) => team.find((u) => u.name === name).id;
check('the PM may write and issue', r.json.may.write && r.json.may.issue);
check('the team is offered as owners', team.length >= 6 && !!idOf('Q. Surveyor'));

// ---- a draft
const d1 = { type: 'progress', title: 'Progress meeting no. 1', meeting_date: shift(T, -14), start_time: '10:00', location: 'Site office', chair: 'A. Haddad',
  attendees: [{ name: 'A. Haddad', company: 'NAF (PM)', present: true }, { name: 'S. Rahman', company: 'Dar Consult (Engineer)', present: true },
    { name: 'K. Lee', company: 'Client', present: false }],
  items: [
    { subject: 'Programme', discussion: 'Revision 3 is late.', decision: 'NAF to submit Rev 3.',
      actions: [{ text: 'Submit programme Rev 3', owner_user_id: idOf('P. Ray'), due: shift(T, -7) },
                { text: 'Review Rev 3 within 14 days', owner_name: 'Engineer (Dar Consult)', due: shift(T, 7) }] },
    { subject: 'Payment', discussion: 'IPA-04 not certified.', actions: [{ text: 'Chase IPC-04', owner_user_id: idOf('Q. Surveyor'), due: shift(T, 3) }] },
  ] };
r = await call('/api/meeting', { ...d1, meeting_date: shift(T, 2) });
check('a draft saves', r.status === 200 && r.json.ref === 'PRG-001', r.text);
const ref1 = r.json.ref;
r = await call('/api/meeting/issue', { ref: ref1 });
check('cannot issue minutes of a meeting still to come', r.status === 400 && /future/.test(r.json.error), r.text);
r = await call('/api/meeting', { ...d1, ref: ref1, items: [{ subject: 'Programme', actions: [{ text: 'Submit Rev 3' }] }] });
r = await call('/api/meeting/issue', { ref: ref1 });
check('an action with no owner or date is stopped', r.status === 400 && r.json.checks.blockers.some((b) => /who is to do it/.test(b)) && r.json.checks.blockers.some((b) => /give it a date/.test(b)), JSON.stringify(r.json.checks));
r = await call('/api/meeting', { ...d1, ref: ref1 });
check('saved again with the real content', r.status === 200 && r.json.meeting.items.length === 2 && r.json.meeting.attendees.length === 3);
check('the owner picked from the team keeps the name', r.json.meeting.items[0].actions[0].owner_name === 'P. Ray');
r = await call('/api/meeting?ref=' + ref1);
check('the draft passes its checks', r.json.checks.ok, JSON.stringify(r.json.checks));

await as('des@naf.ae');
r = await call('/api/meeting/issue', { ref: ref1 });
check('Design may write minutes but not issue them', r.status === 403, r.text);

await as('dc@naf.ae');
r = await call('/api/meeting/issue', { ref: ref1 });
check('Document Control issues them', r.status === 200 && r.json.created.length === 3, r.text);
check('actions are numbered AI-001 to AI-003', r.json.created.map((a) => a.ref).join() === 'AI-001,AI-002,AI-003');
check('the two owners on the platform are told', r.json.notified === 2, r.json.notified);
r = await call('/api/meeting', { ...d1, ref: ref1 });
check('issued minutes cannot be edited', r.status === 400 && /not edited/.test(r.json.error));
r = await call('/api/meeting/discard', { ref: ref1 });
check('…or deleted', r.status === 400);

await as('plan@naf.ae');
r = await call('/api/notifications');
check('the planner\'s bell has the action', r.json.unread === 1 && /PRG-001 minutes issued — 1 action for you/.test(r.json.items[0].title), JSON.stringify(r.json.items && r.json.items[0]));
r = await call('/api/actions?mine=1&status=open');
check('"Mine" shows only the planner\'s action', r.json.actions.length === 1 && r.json.actions[0].ref === 'AI-001' && r.json.actions[0].overdue === true);
r = await call('/api/action', { ref: 'AI-003', close: true, note: 'x' });
check('someone else\'s action cannot be closed', r.status === 403);
r = await call('/api/action', { ref: 'AI-001', close: true });
check('closing needs a note', r.status === 400 && /note/.test(r.json.error));
r = await call('/api/action', { ref: 'AI-001', due: shift(T, -1), note: 'x' });
check('a new date already past is refused', r.status === 400);

// ---- the next meeting: matters arising
await as('pm@naf.ae');
r = await call('/api/meeting', { type: 'progress', title: 'Progress meeting no. 2', meeting_date: T, attendees: [{ name: 'A. Haddad', present: true }],
  items: [{ subject: 'Look-ahead', discussion: 'Three weeks reviewed.' }] });
const ref2 = r.json.ref;
check('the next progress meeting is PRG-002', ref2 === 'PRG-002');
check('it opens with the three actions still open, earliest date first', (r.json.meeting.arising_open || []).map((a) => a.ref).join() === 'AI-001,AI-003,AI-002', JSON.stringify(r.json.meeting.arising_open));
r = await call('/api/meeting', { ref: ref2, meeting_date: T, attendees: [{ name: 'A. Haddad', present: true }], items: [{ subject: 'Look-ahead' }],
  arising: [{ ref: 'AI-001', decision: 'close' }, { ref: 'AI-003', decision: 'redate' }] });
r = await call('/api/meeting/issue', { ref: ref2 });
check('closing or re-dating an earlier action needs a reason (and a date)', r.status === 400 &&
  r.json.checks.blockers.some((b) => /AI-001: say why it is closed/.test(b)) && r.json.checks.blockers.some((b) => /AI-003: give the new date/.test(b)), JSON.stringify(r.json.checks));
r = await call('/api/meeting', { ref: ref2, meeting_date: T, attendees: [{ name: 'A. Haddad', present: true }], items: [{ subject: 'Look-ahead' }],
  arising: [{ ref: 'AI-001', decision: 'close', note: 'Rev 3 submitted under LTR-004' }, { ref: 'AI-003', decision: 'redate', due: shift(T, 10), note: 'Engineer asked for the IPA backup first' }] });
r = await call('/api/meeting?ref=' + ref2);
check('a meeting with no new actions is flagged, not stopped', r.json.checks.ok && r.json.checks.warnings.some((w) => /No actions came out/.test(w)), JSON.stringify(r.json.checks));
r = await call('/api/meeting/issue', { ref: ref2 });
check('PRG-002 issued', r.status === 200, r.text);
r = await call('/api/actions');
const A = Object.fromEntries(r.json.actions.map((a) => [a.ref, a]));
check('AI-001 closed at the meeting, with the note', A['AI-001'].status === 'closed' && /LTR-004/.test(A['AI-001'].closed_note));
check('AI-003 re-dated, first date kept', A['AI-003'].due === shift(T, 10) && A['AI-003'].first_due === shift(T, 3) && A['AI-003'].carried === 1);
check('AI-002 (the Engineer\'s) carried forward', A['AI-002'].status === 'open' && A['AI-002'].carried === 1 && /carried forward at PRG-002/.test(A['AI-002'].history.map((h) => h.what).join()));
r = await call('/api/meeting?ref=' + ref2);
check('PRG-002 records what it decided about each earlier action', r.json.meeting.arising.length === 3 && r.json.meeting.arising.find((a) => a.ref === 'AI-001').decision === 'close');

// A different kind of meeting has its own series and its own matters arising
r = await call('/api/meeting', { type: 'design', meeting_date: T, attendees: [{ name: 'D. Okafor', present: true }], items: [{ subject: 'Façade' }] });
check('a design meeting is DES-001, with no progress-meeting actions', r.json.ref === 'DES-001' && (r.json.meeting.arising_open || []).length === 0);
r = await call('/api/meeting/discard', { ref: 'DES-001' });
check('a draft can be discarded', r.status === 200);

// The owner closes their own action
await as('qs@naf.ae');
r = await call('/api/action', { ref: 'AI-003', close: true, note: 'IPC-04 received 18 Sep' });
check('the owner closes their action with a note', r.status === 200 && r.json.action.status === 'closed' && r.json.action.closed_by === 'Q. Surveyor');

// ---- documents and the report
await as('pm@naf.ae');
r = await call('/api/meeting/doc?ref=' + ref1, null, true);
const doc = Buffer.from(r.bytes).toString('utf8');
check('minutes download as Word', /msword/.test(r.headers.get('content-type')) && doc.includes('Submit programme Rev 3') && doc.includes('AI-001') && /Apologies:.*K\. Lee/.test(doc));
r = await call('/api/meeting/doc?ref=' + ref2 + '&view=1');
check('PRG-002 shows matters arising with the decisions', /Matters arising/.test(r.text) && /Re-dated/.test(r.text) && /Rev 3 submitted under LTR-004/.test(r.text));
r = await call('/api/actions/xlsx', null, true);
check('action log downloads as Excel', r.status === 200 && r.bytes[0] === 0x50 && /Action log - Tower A\.xlsx/.test(r.headers.get('content-disposition')));
mkdirSync(new URL('../test-output/', import.meta.url), { recursive: true });
writeFileSync(new URL('../test-output/step8-action-log.xlsx', import.meta.url), r.bytes);
const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(P);
const w = await buildReport(env, P, project, 'monthly', T.slice(0, 7));
check('the monthly report counts actions', w.actions && w.actions.raised === 3 && w.actions.closed === 2 && w.actions.open === 1, JSON.stringify(w.actions));
check('…and the Engineer\'s late action is not overdue yet (due in a week)', w.actions.overdue.length === 0);
check('…rendered', /Meeting actions/.test(reportHTML(w)));
r = await call('/minutes');
check('the minutes page opens', r.status === 200 && /Meetings &amp; actions/.test(r.text));

console.log('\n' + checks + ' checks, ' + fails + ' failures');
process.exit(fails ? 1 : 0);
