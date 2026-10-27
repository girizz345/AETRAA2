// The open issues from the launch check (Girish/AETRAA-Launch-Open-Issues.pdf),
// as each is fixed.
//   node tools/test-launch-fixes.mjs
import { db, env, call, admin, as, check, done, onboard, mail } from './_harness.mjs';
import { syncProjectModules } from '../src/parties.js';
import { getProjectModules } from '../src/modules.js';

const { pid } = await onboard('Launch Tower', 'LT-01', [['Dana DC', 'dc@lt.test', ['dc']], ['Sam Site', 'site@lt.test', ['site']], ['Pat PM', 'pm@lt.test', ['pm']]]);
let r;

console.log('\n— 3 and 5: bulk drawing loading by Document Control, switched on per project (spec D2, §25) —');
check('a new project does not have bulk loading on', !(await getProjectModules(env, pid)).includes('bulkload'));
await as('dc@lt.test');
r = await call('/api/intake/batch', {});
check('so its DC cannot open a drop', r.status === 403 && /Bulk drawing loading/.test(r.json.error), r.text);
r = await call('/intake');
check('nor open the drop page', !/Project intake/.test(r.text));
r = await call('/api/drawings');
check('and the drawings page does not offer it', r.json.bulk_load === false);
await admin();
const mods = await getProjectModules(env, pid);
r = await call('/api/setup/modules', { project_id: pid, modules: mods.concat(['bulkload']) });
check('AETRAA switches it on for this project', r.status === 200 && (await getProjectModules(env, pid)).includes('bulkload'), r.text.slice(0, 200));
await as('dc@lt.test');
r = await call('/api/drawings');
check('now the drawings page offers "Drop a folder"', r.json.bulk_load === true);
r = await call('/intake');
check('the drop page opens for the DC', r.status === 200 && /Project intake/.test(r.text));
r = await call('/api/intake/batch', { scope: 'full' });
check('and a drop is drawings-only, whatever the page asks', r.status === 200 && r.json.scope === 'drawings', r.text);
await call('/api/intake/abandon', { batch_id: r.json.id });
await as('site@lt.test');
r = await call('/api/intake/batch', {});
check('a site engineer still cannot drop', r.status === 403, r.status);
await syncProjectModules(env, pid);
check('the switch survives a change of the project’s parties', (await getProjectModules(env, pid)).includes('bulkload'));
const other = await onboard('Other Tower', 'OT-01', [['Olly DC', 'dc@ot.test', ['dc']]]);
await as('dc@ot.test');
r = await call('/api/intake/batch', {});
check('and it is per project: another project’s DC is still refused', r.status === 403);
r = await call('/api/intake/batch', { project_id: pid });
check('and cannot drop into this project', r.status === 403);

console.log('\n— 4: DC sends the diary where the contract requires it (v5 A12 step 3) —');
const day = new Date(Date.now() + 4 * 3600000 - 86400000).toISOString().slice(0, 10);
await as('dc@lt.test');
r = await call('/api/diary', { report_date: day, weather: 'Sunny', prepared_by: 'Dana DC', staff: [{ t: 'Engineer', n: 3, h: '8' }] });
check('DC saves the day’s diary', r.status === 200, r.text.slice(0, 160));
r = await call('/api/diary/send', { date: day });
check('a diary not yet submitted is not sent', r.status === 400 && /not submitted yet/.test(r.json.error), r.text);
r = await call('/api/diary/send-to', { to: 'engineer@dar.test, not-an-email' });
check('a wrong address is refused', r.status === 400 && /not-an-email/.test(r.json.error));
r = await call('/api/diary/send-to', { to: 'Engineer@Dar.test' });
check('DC sets who the diary goes to', r.status === 200 && r.json.to[0] === 'engineer@dar.test');
await as('pm@lt.test');
r = await call('/api/diary', { report_date: day, submit: true });
check('the PM submits it', r.status === 200, r.text.slice(0, 200));
await call('/api/obligations');
db.prepare("INSERT INTO contract_obligation (id, project_id, clause_key, page, quote, binds, kind, state, flags, created_at) VALUES ('ob_d', ?, 'Sub-Clause 6.10', 22, 'The Contractor shall submit daily records of the Contractor''s Personnel and Equipment to the Engineer', 'contractor', 'other', 'approved', '[]', '2026-10-07')").run(pid);
await as('dc@lt.test');
r = await call('/api/diary?date=' + day);
check('the diary shows the contract clause that asks for daily records', r.json.a12.send.basis && r.json.a12.send.basis.clause === 'Sub-Clause 6.10' && r.json.a12.send.may_send === true, r.json.a12 && r.json.a12.send);
await as('site@lt.test');
r = await call('/api/diary/send', { date: day });
check('a site engineer does not send it', r.status === 403);
await as('dc@lt.test');
const before = mail.length;
r = await call('/api/diary/send', { date: day });
const sentD = mail.slice(before).find((x) => (x.to || []).includes('engineer@dar.test'));
check('DC sends it to the Engineer, the Word copy attached', r.status === 200 && sentD && (sentD.attachments || []).length === 1 && /\.docx$/.test(sentD.attachments[0].filename), r.text.slice(0, 200));
check('saying which clause it is under', sentD && /Sub-Clause 6\.10/.test(sentD.html));
r = await call('/api/diary?date=' + day);
check('and the sending is kept on the day', (r.json.a12.send.log || []).length === 1 && r.json.a12.send.log[0].by === 'Dana DC');

console.log('\n— 6: an old RFI-000x issue is linked to its RFI the same way as a new INF one —');
db.prepare("INSERT INTO issues (project_id, no, ref, type, title, detail, status, raised_date) VALUES (?, 7, 'RFI-0007', 'rfi', 'Old: lintel detail', 'Which lintel at D/4?', 'issued', '2026-09-01')").run(pid);
await admin();
r = await call('/api/records', { type: 'rfi', title: 'Lintel detail', data: { Subject: 'Lintel detail', Question: 'Which lintel at D/4?' }, from_issue: 'RFI-0007', not_duplicate: true });
check('an RFI raised from the old issue is linked back to it', r.status === 200 && db.prepare("SELECT rfi_ref FROM issues WHERE project_id = ? AND ref = 'RFI-0007'").get(pid).rfi_ref === r.json.ref, r.text.slice(0, 160));

console.log('\n— 9 to 15: the launch check reads what this server has —');
r = await call('/api/launch-check');
const li = (k) => (r.json.items || []).find((x) => x.key === k) || {};
check('AETRAA gets the launch check', r.status === 200 && Array.isArray(r.json.items), r.text.slice(0, 200));
check('email set here: OK', li('email').state === 'ok');
check('no AI key here: missing, saying what to set', li('ai').state === 'missing' && /ANTHROPIC_API_KEY/.test(li('ai').todo));
check('the test sign-in code is set here: flagged', li('login_test_code').state === 'missing');
check('no PUBLIC_URL here: flagged', li('public_url').state === 'missing');
check('the file store answered a write and a read', /written, read back and deleted/.test(li('storage').detail));
check('the image library loads', li('canvas').state === 'ok');
check('no secret is shown', !JSON.stringify(r.json).includes(env.OWNER_CODE) && !JSON.stringify(r.json).includes('test-key'));
r = await call('/launch-check');
check('the page opens, linked from AETRAA’s home', r.status === 200 && /Launch check/.test(r.text) && (await call('/')).text.includes('/launch-check'));
await as('dc@lt.test');
r = await call('/api/launch-check');
check('nobody else sees it', r.status === 401);

done();
