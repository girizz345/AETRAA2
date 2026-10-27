// K3: who is told what about held documents and storage (spec §22), each rule
// driven both ways with a clock, and nothing sent twice.
//   node tools/test-k3-alerts.mjs
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { db, env, mail, call, admin, as, check, done, onboard, bulkOn } from './_harness.mjs';
import { runAdminAlerts, isoWeek } from '../src/alerts.js';
import { hold } from '../src/quarantine.js';

const b64 = (u8) => Buffer.from(u8).toString('base64');
async function sheet(number) {
  const d = await PDFDocument.create(); const f = await d.embedFont(StandardFonts.Helvetica);
  d.addPage([2384, 1684]).drawText('DRAWING NO ' + number, { x: 1900, y: 60, size: 18, font: f });
  return d.save({ useObjectStreams: false });
}
const day = (n) => new Date(Date.now() + 4 * 3600000 + n * 86400000).toISOString().slice(0, 10);
const adminMail = () => mail.filter((m) => [].concat(m.to).includes('admin@aetraa.test'));
const sent = [];
const mailer = async (to, subject, html) => { sent.push({ to, subject, html }); return null; };
const sentNow = (fn) => { const n = sent.length; return async () => { await fn(); return sent.slice(n); }; };

console.log('— the first hold on a project: AETRAA is told at once —');
const { pid, oid } = await onboard('Tower H', 'TWH-0001', [['The DC', 'dc@towerh.test', ['dc']], ['The Designer', 'design@towerh.test', ['design']], ['The PM', 'pm@towerh.test', ['pm']]]);
// Spec §25: these tests have Document Control drop folders, so bulk loading is switched on for the project.
await bulkOn(pid);
await admin();
await call('/api/setup/rules?project=' + pid, { rules: [{ match: 'ST', discipline: 'Structural' }, { match: 'AR', discipline: 'Architectural' }] });
const designer = db.prepare("SELECT id FROM users WHERE email = 'design@towerh.test'").get().id;
const dcUser = db.prepare("SELECT id FROM users WHERE email = 'dc@towerh.test'").get().id;
await as('design@towerh.test');
let m0 = adminMail().length;
let r = await call('/api/drawing', { number: 'XX-1', revision: 'A', title: 'Not ours', kind: 'ifc', filename: 'XX-1.pdf', data: 'data:application/pdf;base64,' + b64(await sheet('XX-1')) });
check('a single upload under another scheme is held', r.status === 200 && r.json.held === true, r.text.slice(0, 200));
const q1 = r.json.quarantine_id;
check('AETRAA is emailed at once (a held single upload told nobody before)', adminMail().length === m0 + 1 && /1 document\(s\) held on Tower H/.test(adminMail().at(-1).subject), adminMail().map((m) => m.subject));
check('the uploader is recorded, so they can be told the decision', db.prepare('SELECT held_by_id FROM quarantine WHERE id = ?').get(q1).held_by_id === designer);
r = await call('/api/drawing', { number: 'XX-2', revision: 'A', title: 'Not ours either', kind: 'ifc', filename: 'XX-2.pdf', data: 'data:application/pdf;base64,' + b64(await sheet('XX-2')) });
const q2 = r.json.quarantine_id;
check('a second hold while the first waits is not emailed at once', r.json.held && adminMail().length === m0 + 1);

console.log('\n— intake: a hold already in the queue is not news —');
await as('dc@towerh.test');
r = await call('/api/intake/batch', { project_id: pid, expect_files: 1 });
const batch = r.json.id;
await call('/api/intake/scan', { batch_id: batch, project_id: pid, filename: 'ZZ-109 Rev A.pdf', path: '/IFC Drawings', data: b64(await sheet('ZZ-109')) });
const items = (await call('/api/intake/batch?id=' + batch)).json.items;
r = await call('/api/intake/commit', { batch_id: batch, ids: items.map((i) => i.id) });
const zz = r.json.results.find((x) => x.held);
check('the intake drop is held', !!zz, r.text.slice(0, 300));
check('no email at once: others are waiting on this project', adminMail().length === m0 + 1);
r = await call('/api/intake/commit', { batch_id: batch, ids: items.map((i) => i.id) });
check('pressing Commit again sends nothing (it re-sent before)', r.json.results[0].already === true && adminMail().length === m0 + 1, r.json.results);

console.log('\n— the daily digest, once a day —');
let out = await sentNow(() => runAdminAlerts(env, day(0), mailer))();
const dig = out.find((x) => /more document\(s\) held/.test(x.subject));
check('one digest with the holds not already sent', out.length === 1 && dig && /XX-2/.test(dig.html) && /ZZ-109/.test(dig.html) && !/XX-1\.pdf/.test(dig.html), out.map((x) => x.subject));
out = await sentNow(() => runAdminAlerts(env, day(0), mailer))();
check('running it again the same day sends nothing', out.length === 0, out.map((x) => x.subject));

console.log('\n— held more than 3 days: daily until cleared —');
db.prepare('UPDATE quarantine SET held_at = ? WHERE id = ?').run(new Date(Date.now() - 4 * 86400000).toISOString(), q1);
out = await sentNow(() => runAdminAlerts(env, day(1), mailer, { now: Date.now() + 86400000 }))();
const old = out.find((x) => /held more than 3 days/.test(x.subject));
check('an item held 4 days is reported', old && /XX-1/.test(old.html), out.map((x) => x.subject));
out = await sentNow(() => runAdminAlerts(env, day(1), mailer, { now: Date.now() + 86400000 }))();
check('once that day', !out.some((x) => /more than 3 days/.test(x.subject)));
out = await sentNow(() => runAdminAlerts(env, day(2), mailer, { now: Date.now() + 2 * 86400000 }))();
check('and again the next day while it waits', out.some((x) => /more than 3 days/.test(x.subject)));
env.HELD_REMIND_DAYS = '10';
out = await sentNow(() => runAdminAlerts(env, day(3), mailer, { now: Date.now() + 3 * 86400000 }))();
check('the threshold is a setting (D5 is open): at 10 days a 7-day hold is not yet due', !out.some((x) => /held more than/.test(x.subject)), out.map((x) => x.subject));
delete env.HELD_REMIND_DAYS;

console.log('\n— more than 20 held on one project: once, then weekly —');
for (let i = 0; i < 19; i++) await hold(env, pid, { org_id: oid, kind: 'drawing', filename: 'QQ-' + i + '.pdf', number: 'QQ-' + i, reason: 'test' }, { name: 'x' });
const nowHeld = db.prepare("SELECT COUNT(*) AS n FROM quarantine WHERE project_id = ? AND status = 'held'").get(pid).n;
out = await sentNow(() => runAdminAlerts(env, day(4), mailer, { now: Date.now() + 4 * 86400000 }))();
check(nowHeld + ' held → one email', nowHeld > 20 && out.filter((x) => /documents held on Tower H/.test(x.subject)).length === 1, out.map((x) => x.subject));
const sameWeek = isoWeek(day(4)) === isoWeek(day(5)) ? day(5) : day(4);
out = await sentNow(() => runAdminAlerts(env, sameWeek, mailer, { now: Date.now() + 5 * 86400000 }))();
check('not again in the same week', !out.some((x) => /documents held on Tower H/.test(x.subject)));
out = await sentNow(() => runAdminAlerts(env, day(11), mailer, { now: Date.now() + 11 * 86400000 }))();
check('again the next week', out.filter((x) => /documents held on Tower H/.test(x.subject)).length === 1, out.map((x) => x.subject));

console.log('\n— storage over 80% —');
out = await sentNow(() => runAdminAlerts(env, day(12), mailer, { now: Date.now() + 12 * 86400000 }))();
check('not while the database is nearly empty', !out.some((x) => /database is/.test(x.subject)));
env.DATABASE_LIMIT_GB = '0.000001';
out = await sentNow(() => runAdminAlerts(env, day(12), mailer, { now: Date.now() + 12 * 86400000 }))();
check('over the limit → told, with what to do', out.some((x) => /the database is \d/.test(x.subject) && /Azure Blob|Storage screen/.test(x.html)), out.map((x) => x.subject));
out = await sentNow(() => runAdminAlerts(env, day(12), mailer, { now: Date.now() + 12 * 86400000 }))();
check('once a day', !out.some((x) => /database is/.test(x.subject)));
delete env.DATABASE_LIMIT_GB;

console.log('\n— the decision, to whoever loaded it —');
await admin();
const before = mail.length;
r = await call('/api/quarantine/decide', { ids: [q1], action: 'approve' });
check('approving a held single upload files it', r.status === 200 && r.json.filed.length === 1, r.text.slice(0, 200));
const toDesigner = mail.slice(before).filter((m) => [].concat(m.to).includes('design@towerh.test'));
check('the designer is emailed that it was approved and filed', toDesigner.length === 1 && /approved and filed to the drawing register/.test(toDesigner[0].html), toDesigner.map((m) => m.subject));
r = await call('/api/quarantine/decide', { ids: [q2], action: 'reject' });
check('a rejection needs the reason', r.status === 400 && /say why/.test(r.json.error));
r = await call('/api/quarantine/decide', { ids: [q2], action: 'reject', note: 'This is Tower Z’s set, not this project’s' });
const rej = mail.slice(before).filter((m) => [].concat(m.to).includes('design@towerh.test')).at(-1);
check('the designer is told the rejection in the Admin’s own words', r.status === 200 && /rejected/.test(rej.html) && /Tower Z/.test(rej.html));
await as('design@towerh.test');
r = await call('/api/notifications');
const bell = (r.json.notifications || r.json.items || []).filter((n) => n.kind === 'held');
check('and on the bell, both', bell.length === 2 && bell.some((n) => /approved/.test(n.title)) && bell.some((n) => /rejected/.test(n.title)), r.text.slice(0, 300));

console.log('\n— an intake hold approved is filed now, and its loader told —');
const qz = zz.quarantine_id;
check('the intake hold records the DC as its loader', db.prepare('SELECT held_by_id FROM quarantine WHERE id = ?').get(qz).held_by_id === dcUser);
await admin();
const b2 = mail.length;
r = await call('/api/quarantine/decide', { ids: [qz], action: 'approve' });
check('approving it files it straight away, through intake, past the gate', r.status === 200 && r.json.filed.length === 1 && /drawing register/.test(r.json.filed[0].where || ''), r.text.slice(0, 300));
check('it is on the register, not held again', db.prepare("SELECT COUNT(*) AS n FROM drawings WHERE project_id = ? AND number LIKE 'ZZ-109%'").get(pid).n === 1
  && db.prepare("SELECT COUNT(*) AS n FROM quarantine WHERE project_id = ? AND filename LIKE 'ZZ-109%'").get(pid).n === 1);
check('the intake item says filed', db.prepare('SELECT state FROM intake_item WHERE id = ?').get(zz.id).state === 'filed');
const toDc = mail.slice(b2).filter((m) => [].concat(m.to).includes('dc@towerh.test'));
check('the DC who loaded it is told where it went', toDc.length === 1 && /approved and filed to the drawing register/.test(toDc[0].html), toDc.map((m) => m.html));

console.log('\n— the 06:00 run —');
const jobs = [];
const before6 = db.prepare('SELECT COUNT(*) AS n FROM notify_log').get().n;
await (await import('../src/index.js')).default.scheduled({ cron: '0 2 * * *' }, env, { waitUntil: (p) => jobs.push(p) });
await Promise.all(jobs);
check('the scheduler runs the alerts, and every rule is logged', jobs.length >= 2 && db.prepare('SELECT COUNT(*) AS n FROM notify_log').get().n >= before6);
done();
