// K11 · v5 A5 (part of the daily diary): delivery notes and certificates,
// uploaded with the diary, read by rule and by AI, confirmed by the person.
// A certificate with an expiry produces an alert before it lapses; an expired
// one is filed and flagged, not refused. (A4, contract obligations, waits for
// Ajay — see CHANGES.)
//   node tools/test-k11-diary-docs.mjs
import { db, env, call, admin, as, check, done, onboard, xlsxText } from './_harness.mjs';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { ruleDelivery, ruleCert, draftDoc, parseDoc, certExpiries } from '../src/diary-docs.js';
import { runCertAlerts } from '../src/alerts.js';
import { certAlertPeople } from '../src/index.js';

const b64 = (u8) => Buffer.from(u8).toString('base64');
const today = new Date(Date.now() + 4 * 3600000).toISOString().slice(0, 10);
const addDays = (iso, n) => new Date(Date.parse(iso) + n * 86400000).toISOString().slice(0, 10);
const MON = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const words = (iso) => Number(iso.slice(8)) + ' ' + MON[Number(iso.slice(5, 7)) - 1] + ' ' + iso.slice(0, 4);
const DAY = addDays(today, -1);

const sent = [];
let ANSWER = null;
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  if (String(url).startsWith('https://api.anthropic.com/v1/messages')) {
    sent.push(JSON.parse(init.body));
    return new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(ANSWER) }], usage: { input_tokens: 400, output_tokens: 80 } }), { status: 200 });
  }
  return realFetch(url, init);
};
async function pdfDoc(lines) {
  const pdf = await PDFDocument.create({ updateMetadata: false });
  const page = pdf.addPage([595, 842]);
  const f = await pdf.embedFont(StandardFonts.Helvetica);
  lines.forEach((l, i) => page.drawText(l, { x: 50, y: 790 - i * 18, size: 11, font: f }));
  return new Uint8Array(await pdf.save({ useObjectStreams: false }));
}
const materials = () => JSON.parse(db.prepare('SELECT materials FROM diary WHERE project_id = ? AND report_date = ?').get(pid, DAY).materials || '[]');

console.log('— by rule —');
const rd = ruleDelivery('EMIRATES STEEL INDUSTRIES\nDelivery Note No: DN-55120\nDate: 14 September 2026\nRebar 16mm 12 ton');
check('a delivery note’s number and date are read by rule', rd.dn === 'DN-55120' && rd.date === '2026-09-14', rd);
const rc = ruleCert('LIFTING EQUIPMENT CERTIFICATE\nCertificate No: LC-2291\nDate of Examination: 01/03/2026\nNext Examination Due: 31 August 2026');
check('a certificate’s number and expiry by rule; a two-way issue date not taken', rc.number === 'LC-2291' && rc.expiry === '2026-08-31' && !rc.issued, rc);
const dc = draftDoc('certificate', { number: 'LC-2291' }, parseDoc('certificate', JSON.stringify({ type: 'crane cert', number: 'LC-2291', issued: '03/04/2026', expiry: '', subject: 'Tower crane TC-1', sure: {} })));
check('the AI fills gaps only; a type off the list and a two-way date are not used', dc.number.source === 'rule' && dc.type.value === 'Other' && dc.type.flags.length && !dc.issued.value && dc.issued.flags.length && dc.subject.value === 'Tower crane TC-1', dc);

const { pid, oid } = await onboard('Tower K11', 'TKB-0001', [['The Engineer', 'site@tk11.test', ['site']], ['The DC', 'dc@tk11.test', ['dc']], ['The HSE', 'hse@tk11.test', ['hse']],
  ['The PM', 'pm@tk11.test', ['pm']], ['The QS', 'qs@tk11.test', ['commercial']]]);
await onboard('Tower M11', 'TMB-0001', [['Other site', 'site@tm11.test', ['site']]]);
// The site engineer prepares the diary as the person the PM assigned
// (only DC and the assignee save it: Ajay, 6 Oct 2026, decision 11).
await admin(); await call('/api/diary/assignee', { user_id: db.prepare('SELECT id FROM users WHERE email = ?').get('site@tk11.test').id });
await as('site@tk11.test');
await call('/api/diary', { report_date: DAY, staff: [{ t: 'Site Engineer', n: 2, h: '8' }], works: [{ a: 'Rebar to L4 slab', q: '' }], weather: 'Sunny', prepared_by: 'The Engineer',
  materials: [{ m: 'Cement', q: '200', u: 'bag' }] });

console.log('\n— a delivery note, AI off —');
const DN1 = await pdfDoc(['EMIRATES STEEL INDUSTRIES', 'Delivery Note No: DN-55120', 'Date: ' + words(DAY), 'Rebar 16mm   12   ton   Heat H-7781']);
await as('qs@tk11.test');
let r = await call('/api/diary/docs/read', { day: DAY, kind: 'delivery', filename: 'DN-55120.pdf', data: b64(DN1) });
check('a QS does not upload site documents', r.status === 403);
await as('site@tk11.test');
r = await call('/api/diary/docs/read', { day: DAY, kind: 'delivery', filename: 'DN-55120.pdf', data: b64(DN1) });
const N1 = r.json;
check('site uploads the delivery note: number and date read, AI off said so', r.status === 200 && N1.draft.dn.value === 'DN-55120' && N1.draft.dn.source === 'rule' && /not switched on/.test(N1.why) && sent.length === 0, r.text.slice(0, 300));
check('nothing is received yet', materials().length === 1);
r = await call('/api/diary/docs/confirm', { id: N1.id, supplier: 'Emirates Steel', dn: 'DN-55120', items: [{ m: 'Steel reinforcement 16mm', q: 'twelve', u: 'ton' }] });
check('a quantity that is not a number is refused', r.status === 400 && /not a number/.test(r.json.error));
r = await call('/api/diary/docs/confirm', { id: N1.id, supplier: 'Emirates Steel', dn: 'DN-55120', items: [{ m: 'Steel reinforcement 16mm', q: '12', u: 'ton', b: 'H-7781' }] });
let mats = materials();
check('confirmed: the line is in the day’s deliveries with supplier, note number, batch and source', r.status === 200 && mats.length === 2
  && mats[1].m === 'Steel reinforcement 16mm' && mats[1].s === 'Emirates Steel' && mats[1].dn === 'DN-55120' && mats[1].b === 'H-7781' && mats[1].src === N1.id, mats);
const dd = db.prepare('SELECT * FROM diary WHERE project_id = ? AND report_date = ?').get(pid, DAY);
check('the rest of the diary is as it was (staff, works, weather, cement, prepared by)', JSON.parse(dd.staff)[0].n === 2 && JSON.parse(dd.works)[0].a === 'Rebar to L4 slab' && dd.weather === 'Sunny'
  && mats[0].m === 'Cement' && dd.prepared_by === 'The Engineer');
r = await call('/api/diary/docs/confirm', { id: N1.id, supplier: 'x', items: [{ m: 'x', q: '1', u: 'x' }] });
check('a delivery note is confirmed once', r.status === 409);
r = await call('/api/diary/docs/read', { day: DAY, kind: 'delivery', filename: 'again.pdf', data: b64(DN1) });
check('the same note uploaded again says it was confirmed', r.json.kept && /already confirmed/.test(r.json.already));
r = await call('/diary/doc?date=' + DAY);
check('the printed diary shows the supplier and note', r.status === 200 && r.text.includes('Emirates Steel') && r.text.includes('DN DN-55120'));

console.log('\n— a delivery note, AI on, into a submitted diary —');
env.ANTHROPIC_API_KEY = 'test-key';
ANSWER = { supplier: 'Al Ain Readymix LLC', dn_no: 'RMX-9001', date: words(DAY), items: [{ material: 'Ready-mix concrete C40', qty: 36, unit: 'm3', batch: 'B-12' }, { material: 'Ready-mix concrete C20', qty: 6, unit: 'm3', batch: '' }], sure: { supplier: 'high', dn_no: 'high', date: 'high' } };
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
await as('dc@tk11.test');
r = await call('/api/diary/docs/read', { day: DAY, kind: 'delivery', filename: 'readymix photo.png', data: b64(png) });
const N2 = r.json;
check('DC uploads a photo: it goes to the AI as the picture', r.status === 200 && sent.length === 1 && sent[0].messages[0].content[0].type === 'image', r.text.slice(0, 200));
check('the AI read the supplier and two lines; nothing received yet', N2.draft.supplier.value === 'Al Ain Readymix LLC' && N2.draft.supplier.source === 'ai' && N2.draft.items.length === 2 && materials().length === 2);
await as('pm@tk11.test');
r = await call('/api/diary', { report_date: DAY, submit: true });
check('the PM submits the diary', r.status === 200 && r.json.status === 'submitted', r.text.slice(0, 200));
await as('dc@tk11.test');
r = await call('/api/diary/docs/confirm', { id: N2.id, supplier: 'Al Ain Readymix LLC', dn: 'RMX-9001', items: [{ m: 'Ready-mix concrete C40', q: '36', u: 'm3', b: 'B-12' }, { m: 'Ready-mix concrete C20', q: '6', u: 'm3' }] });
check('a submitted diary is not changed without a reason', r.status === 400 && r.json.submitted);
r = await call('/api/diary/docs/confirm', { id: N2.id, reason: 'The readymix note came in late', supplier: 'Al Ain Readymix LLC', dn: 'RMX-9001', items: [{ m: 'Ready-mix concrete C40', q: '36', u: 'm3', b: 'B-12' }, { m: 'Ready-mix concrete C20', q: '6', u: 'm3' }] });
mats = materials();
check('with one, revised: both lines added, the version as submitted kept', r.status === 200 && r.json.revised && mats.length === 4 && db.prepare('SELECT COUNT(*) AS n FROM diary_versions WHERE project_id = ? AND report_date = ?').get(pid, DAY).n === 1, r.text);
check('“read by AI, confirmed by …”: the supplier was the AI’s', JSON.parse(db.prepare('SELECT applied FROM diary_docs WHERE id = ?').get(N2.id).applied).how.supplier === 'ai');

console.log('\n— certificates: filed, flagged, alerted before they lapse —');
const exp20 = addDays(today, 20);
ANSWER = { type: 'Lifting equipment', number: 'LC-2291', issued_by: 'Bureau Veritas', issued: words(addDays(today, -160)), expiry: words(exp20), subject: 'Tower crane TC-1 (serial 44120)', sure: { number: 'high', issued: 'high', expiry: 'high' } };
const C1 = await pdfDoc(['LIFTING EQUIPMENT CERTIFICATE', 'Certificate No: LC-2291', 'Next Examination Due: ' + words(exp20), 'Tower crane TC-1']);
await as('site@tk11.test');
r = await call('/api/diary/docs/read', { day: DAY, kind: 'certificate', filename: 'TC-1 cert.pdf', data: b64(C1) });
const K1 = r.json;
check('site uploads a crane certificate: number and expiry by rule, the rest by AI', r.status === 200 && K1.draft.number.source === 'rule' && K1.draft.expiry.value === exp20 && K1.draft.expiry.source === 'rule'
  && K1.draft.type.value === 'Lifting equipment' && K1.draft.issued_by.value === 'Bureau Veritas', r.text.slice(0, 300));
check('a text certificate went to the model as text', typeof sent[sent.length - 1].messages[0].content === 'string');
check('nothing is filed yet', (() => { try { return !db.prepare("SELECT ref FROM records WHERE type = 'cert' AND project_id = ?").get(pid); } catch (e) { return true; } })());
r = await call('/api/diary/docs/confirm', { id: K1.id, type: 'Lifting equipment', number: 'LC-2291', issued_by: 'Bureau Veritas', subject: 'Tower crane TC-1 (serial 44120)', issued: addDays(today, -160), expiry: exp20 });
const CERT1 = r.json.ref;
const c1 = db.prepare('SELECT * FROM records WHERE ref = ? AND project_id = ?').get(CERT1, pid);
check('site files it (A5): CERT-001, its expiry the record’s date, the copy kept, HSE still checks it', r.status === 200 && c1.due === exp20 && JSON.parse(c1.data).Expires === exp20
  && db.prepare('SELECT COUNT(*) AS n FROM attachments WHERE ref = ?').get(CERT1).n === 1 && /HSE/.test(c1.status) && c1.step === 0, c1);
await as('hse@tk11.test');
r = await call('/api/attention');
let it = (r.json.items || []).find((x) => x.kind === 'cert' && x.ref === CERT1);
check('before it lapses, HSE is alerted: “Expires on … (in 20 days)”', it && /Expires on .* \(in 20 days\)/.test(it.need) && !it.overdue, r.json.items);
await as('pm@tk11.test');
check('and the PM', ((await call('/api/attention')).json.items || []).some((x) => x.kind === 'cert' && x.ref === CERT1));
await as('site@tk11.test');
check('not the site engineer', !((await call('/api/attention')).json.items || []).some((x) => x.kind === 'cert'));
const told = [];
const mailer = async (to, s, h) => { told.push({ to, s }); return { ok: true }; };
let out = await runCertAlerts(env, today, mailer, certAlertPeople(env));
check('the morning alert emails HSE and the PM once', told.length === 1 && told[0].to.includes('hse@tk11.test') && told[0].to.includes('pm@tk11.test') && /expires on/.test(told[0].s), told);
out = await runCertAlerts(env, today, mailer, certAlertPeople(env));
check('and not again the next morning', told.length === 1);

ANSWER = { type: 'Operator / competency', number: 'OP-77', issued_by: 'TUV', issued: '', expiry: '', subject: 'Crane operator R. Kumar', sure: {} };
r = await call('/api/diary/docs/read', { day: DAY, kind: 'certificate', filename: 'operator card.png', data: b64(Buffer.concat([png, Buffer.from('1')])) });
const K2 = r.json;
r = await call('/api/diary/docs/confirm', { id: K2.id, type: 'Operator / competency', number: 'OP-77', issued_by: 'TUV', subject: 'Crane operator R. Kumar', issued: addDays(today, -400), expiry: addDays(today, -5) });
const CERT2 = r.json.ref;
check('an expired certificate is filed and flagged, not refused', r.status === 200 && r.json.flag === 'expired on ' + addDays(today, -5) && JSON.parse(db.prepare('SELECT data FROM records WHERE ref = ? AND project_id = ?').get(CERT2, pid).data).Flag === r.json.flag, r.text);
r = await call('/api/diary/docs/read', { day: DAY, kind: 'certificate', filename: 'harness test.pdf', data: b64(await pdfDoc(['HARNESS TEST REPORT', 'Report No: HT-12'])) });
r = await call('/api/diary/docs/confirm', { id: r.json.id, type: 'Material test', number: 'HT-12', subject: 'Full-body harnesses x 20' });
const CERT3 = r.json.ref;
check('one with no expiry is filed as “expiry not found”', r.status === 200 && r.json.flag === 'expiry not found');
r = await call('/api/diary/docs/read', { day: DAY, kind: 'certificate', filename: 'bad.pdf', data: b64(await pdfDoc(['CERT', 'Certificate No: X-1'])) });
r = await call('/api/diary/docs/confirm', { id: r.json.id, type: 'Calibration', number: 'X-1', issued: addDays(today, -10), expiry: addDays(today, -20) });
check('an expiry before the issue date is refused', r.status === 400 && /not after the date of issue/.test(r.json.error));
await as('hse@tk11.test');
const items = (await call('/api/attention')).json.items || [];
const ix = (ref) => items.findIndex((x) => x.kind === 'cert' && x.ref === ref);
check('HSE’s list: the expired one overdue and ahead of the one still valid; the one with no expiry asks for it', ix(CERT2) >= 0 && items[ix(CERT2)].overdue && /Expired on/.test(items[ix(CERT2)].need) && ix(CERT2) < ix(CERT1)
  && items.some((x) => x.ref === CERT3 && /No expiry date/.test(x.need)), items.map((x) => x.ref + ':' + x.need));
out = await runCertAlerts(env, today, mailer, certAlertPeople(env));
check('the expired one is emailed once too', told.length === 2 && /has expired/.test(told[1].s));
r = await call('/api/records', { type: 'cert', title: 'Scaffold inspection tag', data: { Certificate: 'Scaffold tag', 'Issued by': 'In-house', Expires: addDays(today, 7) } });
check('a certificate HSE types on the form takes its “Expires” as its date (it had none)', r.status === 200 && db.prepare('SELECT due FROM records WHERE ref = ? AND project_id = ?').get(r.json.ref, pid).due === addDays(today, 7));
r = await call('/api/register/xlsx?reg=certs');
check('the certificates Excel shows the expiry and what it covers', r.status === 200 && xlsxText(r.bytes).includes('Tower crane TC-1 (serial 44120)'));
r = await call('/api/records/import', { records: [{ type: 'cert', ref: 'CERT-090', title: 'Old crane cert', original_date: addDays(today, -400), original_status: 'Valid', data: { Expires: addDays(today, -100) } }] });
check('a certificate brought in from the old system carries no alert (K5)', !(await certExpiries(env, pid, today)).some((c) => c.ref === 'CERT-090'));

console.log('\n— walls —');
await as('site@tm11.test');
r = await call('/api/diary/docs/confirm', { id: K1.id, type: 'x', number: 'y' });
check('another company cannot reach a document', r.status === 404);
await admin();
await call('/api/setup/modules', { project_id: pid, modules: ['core', 'planning', 'site', 'design', 'dc', 'registers', 'gate'] });
await as('site@tk11.test');
r = await call('/api/diary/docs/read', { day: DAY, kind: 'certificate', filename: 'late.pdf', data: b64(await pdfDoc(['CERT', 'Certificate No: LATE-1'])) });
const K4 = r.json;
check('with the AI module off it is read by rule only', r.status === 200 && /not switched on for this project/.test(K4.why) && K4.draft.number.value === 'LATE-1');
r = await call('/api/diary/docs/confirm', { id: K4.id, type: 'Calibration', number: 'LATE-1' });
check('with HSE off, a certificate is not filed', r.status === 403 && /HSE/.test(r.json.error));
r = await call('/diary');
check('the diary page carries the upload card', r.status === 200 && r.text.includes('Delivery notes and certificates'));
check('every AI call went through the one door', db.prepare("SELECT COUNT(*) AS n FROM ai_usage WHERE task IN ('a5-delivery','a5-certificate')").get().n === sent.length);
done();
