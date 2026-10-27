// The shared-code fixes and the two gaps from the K handover (6 Oct 2026):
//   1  one RFI series: an issue needing information is INF-, its RFI a record
//   2  AI stamp readings wait for Document Control before they reach a sheet
//   3  a model per AI task (AI_TASK_MODELS)
//   4  the held list for AETRAA (/held), and the "batch interrupted" alert
//   node tools/test-shared-fixes.mjs
import { db, env, call, admin, as, check, done, onboard, mail, bulkOn } from './_harness.mjs';
import { putFile } from '../src/storage.js';
import { modelForTask } from '../src/ai.js';
import { parseStamp } from '../src/authority-sheet.js';
import { runBatchAlerts } from '../src/alerts.js';

// ---- a fake model: answers the stamp prompt, and records which model was asked
const asked = [];
let STAMP = null;
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  if (String(url).startsWith('https://api.anthropic.com/v1/messages')) {
    const body = JSON.parse(init.body);
    asked.push(body.model);
    return new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(STAMP) }], usage: { input_tokens: 500, output_tokens: 80 } }),
      { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
  return realFetch(url, init);
};

const { pid } = await onboard('Shared Tower', 'SHT-01', [
  ['Dana DC', 'dc@sht.test', ['dc']], ['Sam Site', 'site@sht.test', ['site']]]);
// Spec §25: these tests have Document Control drop folders, so bulk loading is switched on for the project.
await bulkOn(pid);
const other = await onboard('Other Tower', 'OTH-01', [['Olly DC', 'dc@oth.test', ['dc']]]);
let r;

console.log('\n— 1: one RFI series —');
await admin();
r = await call('/api/issue', { create: true, title: 'Slab edge detail at grid C', detail: 'Which detail applies at grid C/4?', type: 'rfi' });
check('an issue needing information is numbered INF, not RFI', r.status === 200 && r.json.ref === 'INF-0001', r.text);
const INF = r.json.ref;
r = await call('/api/issue?ref=' + INF);
check('the RFI page can read the issue', r.status === 200 && r.json.issue.title === 'Slab edge detail at grid C', r.text);
r = await call('/api/records', { type: 'rfi', title: 'Slab edge detail at grid C', data: { Subject: 'Slab edge detail at grid C', Question: 'Which detail applies at grid C/4?' }, from_issue: INF, not_duplicate: true });
check('the RFI raised from it is the project’s RFI-0001', r.status === 200 && r.json.ref === 'RFI-0001', r.text.slice(0, 200));
check('and the issue keeps its reference', db.prepare('SELECT rfi_ref FROM issues WHERE project_id = ? AND ref = ?').get(pid, INF).rfi_ref === 'RFI-0001');
r = await call('/api/records', { type: 'rfi', title: 'Again', data: { Subject: 'Again' }, from_issue: INF, not_duplicate: true });
check('a second RFI does not take the issue’s link', r.status === 200 && db.prepare('SELECT rfi_ref FROM issues WHERE project_id = ? AND ref = ?').get(pid, INF).rfi_ref === 'RFI-0001');
db.prepare("INSERT INTO issues (project_id, no, ref, type, title, status, raised_date) VALUES (?, 1, 'RFI-0001', 'rfi', 'An old one', 'issued', '2026-09-01')").run(other.pid);
r = await call('/api/issue?ref=RFI-0001');
check('an issue on another project is not read from this one', r.status === 404, r.status);
r = await call('/issues');
check('the issues page offers Raise the RFI', r.status === 200 && r.text.includes('Raise the RFI'));
r = await call('/rfi');
check('and the RFI page reads ?issue=', r.status === 200 && r.text.includes("get('issue')"));

console.log('\n— 2: stamp readings wait for a person —');
check('a printed date that could be read two ways is left for DC', parseStamp('{"approved":true,"authority":"Dubai Municipality","approval_date":"2026-05-12","date_as_printed":"12/05/2026"}').approval_date === '');
check('one that can only be day first is read', parseStamp('{"approved":true,"authority":"Dubai Municipality","date_as_printed":"25/05/2026"}').approval_date === '2026-05-25');
await putFile(env, 'test/stamp-1.pdf', new TextEncoder().encode('%PDF-1.4 stamp'), 'application/pdf');
r = await call('/api/intake/batch', { project_id: pid });
const BID = r.json.id;
db.prepare("INSERT INTO drawings (project_id, id, number, kind, status) VALUES (?, 'dw_1', 'A-101', 'ifc', 'current')").run(pid);
const add = (id, state, ex, target) => db.prepare('INSERT INTO intake_item (id, batch_id, project_id, filename, family, state, extracted, file_key, target_id) VALUES (?,?,?,?,?,?,?,?,?)')
  .run(id, BID, pid, id + '.pdf', 'drawing', state, JSON.stringify(ex), 'test/stamp-1.pdf', target || null);
add('st_filed', 'filed', { needs_stamp: true, kind: 'other', number: 'A-101' }, 'dw_1');
add('st_nonum', 'failed', { needs_number: true });
add('st_none', 'proposed', { needs_stamp: true, kind: 'authority', authority: 'DM' });
env.ANTHROPIC_API_KEY = 'test-key';
STAMP = { approved: true, authority: 'Dubai Municipality', approval_no: '455359-3-3', approval_date: '', date_as_printed: '25/05/2026', drawing_number: 'A-102', drawing_title: 'FIRST FLOOR', where: 'bottom right', confidence: 'high' };
r = await call('/api/intake/stamps', { batch_id: BID, limit: 2 });
check('the AI reads two stamps', r.status === 200 && r.json.read === 2, r.text);
STAMP = { approved: false, authority: '', confidence: 'medium' };
r = await call('/api/intake/stamps', { batch_id: BID, limit: 5 });
const ex = (id) => JSON.parse(db.prepare('SELECT extracted FROM intake_item WHERE id = ?').get(id).extracted);
const st = (id) => db.prepare('SELECT state FROM intake_item WHERE id = ?').get(id).state;
check('the filed sheet’s register entry is untouched', db.prepare("SELECT kind FROM drawings WHERE id = 'dw_1'").get().kind === 'ifc');
check('its reading waits, not applied', ex('st_filed').stamp_pending === true && !ex('st_filed').approval_no && ex('st_filed').kind === 'other', ex('st_filed'));
check('the sheet without a number stays failed until confirmed', st('st_nonum') === 'failed' && ex('st_nonum').needs_number === true);
check('a "no stamp" on an authority sheet waits too', ex('st_none').stamp_pending === true);
r = await call('/api/intake/batch?id=' + BID);
check('the drop shows which readings wait', r.json.items.filter((i) => i.stamp_pending).length === 3, r.json.items.map((i) => i.stamp_pending));
r = await call('/api/intake/stamps/confirm', { batch_id: BID, items: [{ id: 'st_filed', accept: true, approval_date: '25-05-2026' }] });
check('a date not YYYY-MM-DD is refused, and the reading still waits', r.json.errors.length === 1 && ex('st_filed').stamp_pending === true, r.text);
r = await call('/api/intake/stamps/confirm', { batch_id: BID, items: [{ id: 'st_filed', accept: true }, { id: 'st_nonum', accept: true, number: 'A-102' }, { id: 'st_none', accept: false }] });
check('DC confirms two and rejects one', r.status === 200 && r.json.applied === 2 && r.json.rejected === 1, r.text);
const dw = db.prepare("SELECT kind, authority, approval_no, approval_date FROM drawings WHERE id = 'dw_1'").get();
check('only now the register shows the approval', dw.kind === 'authority' && dw.authority === 'DM' && dw.approval_no === '455359-3-3' && dw.approval_date === '2026-05-25', dw);
check('with who confirmed it', /confirmed by AETRAA Admin/.test(ex('st_filed').kind_source), ex('st_filed').kind_source);
check('the typed number goes back to be filed', st('st_nonum') === 'confirmed' && ex('st_nonum').number === 'A-102' && /typed by/.test(ex('st_nonum').number_source));
check('the rejected reading is marked, and the sheet left for a decision', ex('st_none').stamp.rejected_by && ex('st_none').needs_decision === true);
r = await call('/api/intake/stamps/confirm', { batch_id: BID, items: [{ id: 'st_filed', accept: true }] });
check('a reading is confirmed once', r.json.applied === 0 && r.json.errors.length === 1);
await as('dc@oth.test');
r = await call('/api/intake/stamps/confirm', { batch_id: BID, items: [{ id: 'st_filed', accept: true }] });
check('another project’s DC cannot confirm here', r.status === 404, r.status);
await as('site@sht.test');
r = await call('/api/intake/stamps/confirm', { batch_id: BID, items: [] });
check('nor can a site engineer', r.status === 403, r.status);

console.log('\n— 3: a model per task —');
const tm = { AI_TASK_MODELS: 'a10-rfi=claude-opus-5-5, schedule-=claude-haiku-4-5-20251001' };
check('a task named exactly gets its model', modelForTask(tm, 'a10-rfi', 'X') === 'claude-opus-5-5');
check('a prefix covers its tasks', modelForTask(tm, 'schedule-material', 'X') === 'claude-haiku-4-5-20251001');
check('any other task keeps AI_MODEL', modelForTask(tm, 'a1-sheet', 'X') === 'X' && modelForTask({}, 'a10-rfi', 'X') === 'X');
env.AI_TASK_MODELS = 'authority-stamp=claude-haiku-4-5-20251001';
await admin();
db.prepare("INSERT INTO intake_item (id, batch_id, project_id, filename, family, state, extracted, file_key) VALUES ('st_m', ?, ?, 'm.pdf', 'drawing', 'proposed', ?, 'test/stamp-1.pdf')").run(BID, pid, JSON.stringify({ needs_stamp: true, kind: 'other' }));
asked.length = 0;
await call('/api/intake/stamps', { batch_id: BID });
check('the stamp reader is sent to its own model', asked[0] === 'claude-haiku-4-5-20251001', asked);
check('and the usage log says which', db.prepare("SELECT model FROM ai_usage WHERE task = 'authority-stamp' ORDER BY created_at DESC LIMIT 1").get().model === 'claude-haiku-4-5-20251001');
delete env.AI_TASK_MODELS; delete env.ANTHROPIC_API_KEY;

console.log('\n— 4a: the held list —');
await call('/api/quarantine');
const q = (id, p, prefix) => db.prepare("INSERT INTO quarantine (id, project_id, kind, filename, number, prefix, reason, file_key, held_at, held_by, status) VALUES (?,?,?,?,?,?,?,?,?,?, 'held')")
  .run(id, p, 'drawing', id + '.pdf', prefix + '-1', prefix, 'numbered under a scheme this project does not use', 'test/stamp-1.pdf', new Date(Date.now() - 4 * 86400000).toISOString(), 'Dana DC');
q('q1', pid, 'SUB'); q('q2', pid, 'SUB'); q('q3', other.pid, 'XX');
r = await call('/held');
check('AETRAA opens the held list', r.status === 200 && r.text.includes('Held documents'));
r = await call('/api/quarantine?all=1');
check('every project’s held items, grouped, with project names', r.json.items.length === 3 && r.json.groups[0].count === 2 && r.json.projects[pid] === 'Shared Tower', r.json.groups);
check('without the replay payload', r.json.items.every((i) => i.payload === undefined));
r = await call('/api/quarantine/file?id=q3');
check('AETRAA can open a held file', r.status === 200 && new TextDecoder().decode(r.bytes).startsWith('%PDF'), r.status);
r = await call('/api/quarantine/decide', { ids: ['q1', 'q2'], action: 'reject' });
check('a rejection needs a reason', r.status === 400 && r.json.errors.length === 2 && r.json.errors.every((e) => /say why/.test(e.error)), r.text);
await as('dc@sht.test');
r = await call('/api/quarantine?all=1');
check('a DC sees only their own project’s held items', r.json.items.length === 2 && r.json.may_decide === false, r.json.items.length);
r = await call('/api/quarantine/file?id=q3');
check('and cannot open another project’s held file', r.status === 404, r.status);
r = await call('/api/quarantine/file?id=q1');
check('but can open their own', r.status === 200);
r = await call('/api/quarantine/decide', { ids: ['q1'], action: 'approve' });
check('and cannot decide', r.status === 403);
r = await call('/');
await admin();
r = await call('/');
check('AETRAA’s home links the held list', r.text.includes('href="/held"'));

console.log('\n— 4b: a drop whose filing stopped —');
db.prepare("UPDATE intake_batch SET status = 'done' WHERE id = ?").run(BID);      // one open drop per project
await as('dc@sht.test');
r = await call('/api/intake/batch', {});
const B2 = r.json && r.json.id;
const dcId = db.prepare("SELECT id FROM users WHERE email = 'dc@sht.test'").get().id;
check('the drop knows who ran it', db.prepare('SELECT started_by_id FROM intake_batch WHERE id = ?').get(B2).started_by_id === dcId);
for (let i = 0; i < 5; i++) db.prepare("INSERT INTO intake_item (id, batch_id, project_id, filename, family, state, extracted) VALUES (?,?,?,?, 'drawing', ?, '{}')").run('bi' + i, B2, pid, 'S-' + i + '.pdf', i < 3 ? 'filed' : 'confirmed');
db.prepare("UPDATE intake_batch SET status = 'partly_committed', updated_at = ? WHERE id = ?").run(new Date().toISOString(), B2);
const m0 = mail.length;
let a = await runBatchAlerts(env, Date.now(), (to, s, h) => { mail.push({ to, subject: s, html: h }); return Promise.resolve(null); });
check('nothing while it may still be running', a.told === 0 && mail.length === m0, a);
a = await runBatchAlerts(env, Date.now() + 20 * 60000, (to, s, h) => { mail.push({ to, subject: s, html: h }); return Promise.resolve(null); });
const sentNow = mail.slice(m0);
const toDc = sentNow.find((x) => x.to[0] === 'dc@sht.test'), toAetraa = sentNow.find((x) => x.to[0] === 'admin@aetraa.test');
check('after 15 quiet minutes whoever ran it is emailed', a.told === 1 && toDc && /stopped at 3 of 5/i.test(toDc.subject) && /AETRAA has been told/.test(toDc.html) && /offered to continue/.test(toDc.html), sentNow);
check('and AETRAA, with the link that continues it', toAetraa && toAetraa.html.includes('/intake?batch=' + encodeURIComponent(B2)), toAetraa);
check('and on the bell', db.prepare("SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND kind = 'intake'").get(dcId).n === 1);
a = await runBatchAlerts(env, Date.now() + 40 * 60000, (to, s, h) => { mail.push({ to, subject: s, html: h }); return Promise.resolve(null); });
check('told once', a.told === 0 && mail.length === m0 + 2 && db.prepare("SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND kind = 'intake'").get(dcId).n === 1);
let fails = 0;
db.prepare("UPDATE intake_batch SET status = 'partly_committed' WHERE id = ?").run(BID);
await runBatchAlerts(env, Date.now() + 20 * 60000, () => { fails++; return Promise.resolve({ error: 'mail down' }); });
const bells = db.prepare("SELECT COUNT(*) AS n FROM notifications WHERE kind = 'intake'").get().n;
await runBatchAlerts(env, Date.now() + 40 * 60000, () => { fails++; return Promise.resolve({ error: 'mail down' }); });
check('a failed email is tried again without a second bell', fails >= 2 && db.prepare("SELECT COUNT(*) AS n FROM notifications WHERE kind = 'intake'").get().n === bells, fails);
await admin();
r = await call('/intake');
check('the intake page offers to continue where it stopped', r.text.includes('Continue where it stopped') && r.text.includes('href="/held"'));

done();
