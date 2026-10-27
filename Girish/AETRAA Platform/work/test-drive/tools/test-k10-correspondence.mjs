// K10 · v5 A2: the correspondence register. An incoming letter logged with AI
// off (typed) and with AI on both reach the register; an outgoing reply closes
// it. The reader never logs, routes, replies or closes; the records a letter
// names are the ones it states; an Arabic letter is read and summarised in English (Ajay, decision 4).
//   node tools/test-k10-correspondence.mjs
import { db, env, mail, call, admin, as, check, done, onboard, xlsxText } from './_harness.mjs';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { findReferences, ruleFields, parseEml, isArabic, draftOf, parseLetter } from '../src/correspondence.js';

const b64 = (u8) => Buffer.from(u8).toString('base64');
const today = new Date(Date.now() + 4 * 3600000).toISOString().slice(0, 10);
const daysAgo = (n) => new Date(Date.parse(today) - n * 86400000).toISOString().slice(0, 10);
const addDays = (iso, n) => new Date(Date.parse(iso) + n * 86400000).toISOString().slice(0, 10);

// The fake model: answers, and keeps what it was sent.
const sent = [];
let ANSWER = null;
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  if (String(url).startsWith('https://api.anthropic.com/v1/messages')) {
    sent.push(JSON.parse(init.body));
    return new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(ANSWER) }], usage: { input_tokens: 500, output_tokens: 90 } }), { status: 200 });
  }
  return realFetch(url, init);
};
async function pdfLetter(lines) {
  const pdf = await PDFDocument.create({ updateMetadata: false });
  const page = pdf.addPage([595, 842]);
  const f = await pdf.embedFont(StandardFonts.Helvetica);
  lines.forEach((l, i) => page.drawText(l, { x: 50, y: 790 - i * 18, size: 11, font: f }));
  return new Uint8Array(await pdf.save({ useObjectStreams: false }));
}
const eml = (from, subject, date, body) => new TextEncoder().encode(
  'From: ' + from + '\r\nTo: dc@contractor.ae\r\nSubject: ' + subject + '\r\nDate: ' + date + '\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n' + body + '\r\n');

console.log('— reading by rule —');
const refs = findReferences('Further to RFI 1 and VO-05, see drawing A1-101 rev C and SUB-099. ISO 9001 applies. Ref: A1-101');
check('every record named, and drawing numbers apart from record refs', refs.records.map((x) => x.key).join() === 'RFI-1,SUB-99,VO-5' && refs.drawings.join() === 'A1-101', refs);
const rf = ruleFields('DAR CONSULT ENGINEERING\nOur Ref: DC/AET/0142\nDate: 14 September 2026\nSubject: Delay to Level 3 shop drawings\nYour Ref: LTR-001');
check('what the letter states plainly: their ref, date, subject', rf['Their reference'] === 'DC/AET/0142' && rf['Letter date'] === '2026-09-14' && rf.Subject === 'Delay to Level 3 shop drawings', rf);
check('a date that reads two ways is not taken by rule', !ruleFields('Date: 05/10/2026')['Letter date']);
const e = parseEml(eml('"Ahmed Saleh" <ahmed@client.ae>', 'Instruction to accelerate', 'Tue, 15 Sep 2026 09:12:00 +0400', 'Please accelerate.'));
check('an email’s headers are read by rule', ruleFields(e.text, e.headers).From === 'Ahmed Saleh' && ruleFields(e.text, e.headers)['Letter date'] === '2026-09-15' && e.text === 'Please accelerate.', ruleFields(e.text, e.headers));
check('Arabic is detected', isArabic('السادة المحترمين، نود إعلامكم بأن أعمال الموقع متأخرة') && !isArabic('Dear Sirs, the works are delayed'));
const dr = draftOf({ From: 'Ahmed Saleh' }, parseLetter(JSON.stringify({ from: 'Client Co', their_ref: 'CL/7', letter_date: '03/04/2026', subject: 'x', type: 'Fax', action_by: 'Planning', summary: 's', sure: { from: 'high' } })));
check('the rule’s value is kept; the AI only fills gaps, and a bad date, type or role is not used', dr.From.value === 'Ahmed Saleh' && dr.From.source === 'rule' && dr.From.ai === 'Client Co'
  && dr['Their reference'].source === 'ai' && !dr['Letter date'].value && !dr.Type.value && dr['Action by'].value === 'Planning', dr);

const { pid } = await onboard('Tower K10', 'TKA-0001', [['The DC', 'dc@tk10.test', ['dc']], ['The PM', 'pm@tk10.test', ['pm']], ['The QS', 'qs@tk10.test', ['commercial']],
  ['The Designer', 'design@tk10.test', ['design']], ['The Engineer', 'site@tk10.test', ['site']]]);
await onboard('Tower L10', 'TLA-0001', [['Other DC', 'dc@tl10.test', ['dc']]]);
await as('design@tk10.test');
const RFI = (await call('/api/records', { type: 'rfi', title: 'Slab edge detail', data: { Question: 'Which edge detail?' } })).json.ref;
await as('dc@tk10.test');
const sheet = await pdfLetter(['A1-101 drawing']);
await call('/api/drawing', { number: 'A1-101', kind: 'ifc', filename: 'A1-101.pdf', data: 'data:application/pdf;base64,' + b64(sheet) });

console.log('\n— incoming, AI off: read by rule, typed, logged —');
const L1 = await pdfLetter(['DAR CONSULT ENGINEERING', 'Our Ref: DC/AET/0142', 'Date: 14 September 2026', 'Subject: Delay to Level 3 shop drawings',
  'Dear Sirs,', 'Further to RFI 1 and drawing A1-101, the shop drawings under SUB-099 are late.', 'Your Ref: LTR-001']);
await as('site@tk10.test');
let r = await call('/api/letters/read', { filename: 'Dar letter 0142.pdf', data: b64(L1) });
check('a site engineer does not log letters', r.status === 403);
await as('dc@tk10.test');
const recs0 = db.prepare('SELECT COUNT(*) AS n FROM records').get().n;
r = await call('/api/letters/read', { filename: 'Dar letter 0142.pdf', data: b64(L1) });
const R1 = r.json;
check('DC drops the letter: its text read by rule', r.status === 200 && R1.draft['Their reference'].value === 'DC/AET/0142' && R1.draft['Their reference'].source === 'rule'
  && R1.draft.Subject.value === 'Delay to Level 3 shop drawings' && R1.draft['Letter date'].value === '2026-09-14', r.text.slice(0, 400));
check('the records it names: the RFI and A1-101 linked, SUB-099 not on this project', R1.refs.linked.map((x) => x.ref).join() === RFI + ',A1-101' && R1.refs.unmatched.some((x) => /SUB/.test(x.ref)), R1.refs);
check('with AI off it says so, and nothing went to a model', /not switched on/.test(R1.why) && sent.length === 0 && !R1.model);
check('reading logs nothing', db.prepare('SELECT COUNT(*) AS n FROM records').get().n === recs0);
r = await call('/api/records', { type: 'incoming', title: 'Delay to Level 3 shop drawings', read_id: R1.id,
  data: { From: 'Dar Consult (Engineer)', 'Their reference': 'DC/AET/0142', 'Letter date': '2026-09-14', 'Date received': today, Subject: 'Delay to Level 3 shop drawings', Type: 'Letter', 'Action by': 'Project Manager', 'Linked records': 'FAKE-1' } });
const IN1 = r.json.ref;
const rec1 = db.prepare('SELECT * FROM records WHERE ref = ?').get(IN1);
check('DC logs it, typed: IN-001, reply by the project’s period', r.status === 200 && IN1 === 'IN-001' && rec1.due === addDays(today, 7), r.text.slice(0, 200));
check('the records it names are the ones the reading found, not what the page sent', JSON.parse(rec1.data)['Linked records'] === RFI + ', A1-101', JSON.parse(rec1.data));
check('the letter itself is kept on the record', db.prepare("SELECT filename FROM attachments WHERE ref = ?").get(IN1).filename === 'Dar letter 0142.pdf');
const lr1 = db.prepare('SELECT * FROM letter_reads WHERE id = ?').get(R1.id);
check('the reading says which values were read and which typed', lr1.logged_ref === IN1 && JSON.parse(lr1.logged_from).fields['Their reference'] === 'rule' && JSON.parse(lr1.logged_from).fields.From === 'typed');
check('the action owner is told', mail.some((m) => /IN-001/.test(m.subject || '') && JSON.stringify(m.to).includes('pm@tk10.test')));
r = await call('/api/letters/read', { filename: 'again.pdf', data: b64(L1) });
check('the same letter dropped again: “already logged as IN-001”', r.json.kept && /IN-001/.test(r.json.already));
r = await call('/api/records', { type: 'incoming', title: 'x', read_id: R1.id, data: { From: 'x', 'Date received': today, Subject: 'x', 'Action by': 'Project Manager' } });
check('and it cannot be logged twice', r.status === 409);

console.log('\n— incoming, AI on: the AI fills what the rules did not —');
env.ANTHROPIC_API_KEY = 'test-key';
ANSWER = { from: 'Client Co LLC — Ahmed Saleh', their_ref: 'CL/0007', letter_date: '15 Sep 2026', subject: 'Instruction to accelerate', type: 'Instruction',
  action_by: 'Contracts & Commercial', summary: 'The client instructs acceleration of the Level 3 works.\nThey ask for a revised programme within 7 days.', language: 'en',
  sure: { from: 'high', their_ref: 'medium', letter_date: 'high', subject: 'high' } };
const M2 = eml('"Ahmed Saleh" <ahmed@client.ae>', 'Instruction to accelerate', 'Tue, 15 Sep 2026 09:12:00 +0400',
  'Our ref CL-0007 is noted. We instruct you to accelerate the Level 3 works and to send a revised programme within 7 days. RFI-001 refers.');
r = await call('/api/letters/read', { filename: 'Client instruction.eml', data: b64(M2) });
const R2 = r.json;
check('the email is read: From, date and subject by rule', R2.draft.From.value === 'Ahmed Saleh' && R2.draft.From.source === 'rule' && R2.draft['Letter date'].value === '2026-09-15', R2.draft);
check('the AI’s different “From” is shown, not used', R2.draft.From.ai === 'Client Co LLC — Ahmed Saleh' && R2.draft.From.flags.some((f) => /kept/.test(f)));
check('the AI fills their ref, who acts and the summary (an .eml is an Email by rule)', R2.draft['Their reference'].value === 'CL/0007' && R2.draft['Their reference'].source === 'ai'
  && R2.draft.Type.value === 'Email' && R2.draft.Type.source === 'rule' && R2.draft.Type.ai === 'Instruction' && R2.draft['Action by'].value === 'Contracts & Commercial' && /acceleration/.test(R2.draft.Summary.value), R2.draft);
check('a text letter goes to the model as its text, not as the file', sent.length === 1 && typeof sent[0].messages[0].content === 'string' && /accelerate the Level 3/.test(sent[0].messages[0].content));
check('the AI logged nothing', !db.prepare("SELECT ref FROM records WHERE ref = 'IN-002'").get());
r = await call('/api/records', { type: 'incoming', title: 'Instruction to accelerate', read_id: R2.id,
  data: { From: R2.draft.From.value, 'Their reference': R2.draft['Their reference'].value, 'Letter date': R2.draft['Letter date'].value, 'Date received': today,
    Subject: R2.draft.Subject.value, Type: R2.draft.Type.value, 'Action by': R2.draft['Action by'].value, Summary: 'Accelerate Level 3; revised programme in 7 days.' } });
const IN2 = r.json.ref;
const from2 = JSON.parse(db.prepare('SELECT logged_from FROM letter_reads WHERE id = ?').get(R2.id).logged_from);
check('logged with AI on: IN-002, and “read by AI, confirmed by …” kept', r.status === 200 && IN2 === 'IN-002' && from2.fields['Action by'] === 'ai' && from2.fields.Summary === 'typed' && from2.fields.From === 'rule' && from2.confirmed_by === 'The DC' && from2.model);
check('the QS (Contracts & Commercial) is told', mail.some((m) => /IN-002/.test(m.subject || '') && JSON.stringify(m.to).includes('qs@tk10.test')));
ANSWER = { from: 'Dubai Municipality', their_ref: '٤٥/ب/٢٠٢٦', letter_date: '١٦/٠٩/٢٠٢٦', subject: 'Building permit: drawings to be updated', subject_original: 'إشعار', type: 'Notice', action_by: 'Design', summary: 'The building permit needs the drawings updated before the end of this month.', language: 'ar', date_calendar: 'gregorian', sure: { from: 'high', their_ref: 'high', letter_date: 'high', subject: 'medium' } };
const before = sent.length;
r = await call('/api/letters/read', { filename: 'municipality.eml', data: b64(eml('info@dm.gov.ae', 'إشعار', 'Wed, 16 Sep 2026 10:00:00 +0400', 'السادة المحترمين، نود إعلامكم بأن تصريح البناء يتطلب تحديث المخططات قبل نهاية الشهر الحالي وشكرا')) });
// Ajay, 6 Oct 2026 (decision 4): an Arabic letter is read and summarised in English by AI, each value marked as translated.
check('an Arabic letter is read by AI with the Arabic instructions', r.status === 200 && sent.length === before + 1 && /written in Arabic/.test(sent[sent.length - 1].messages[0].content.map ? JSON.stringify(sent[sent.length - 1].messages[0].content) : String(sent[sent.length - 1].messages[0].content)) && r.json.language === 'ar', r.text.slice(0, 300));
check('summarised in English, marked as translated, the Arabic subject kept', /drawings updated/.test(r.json.draft.Summary.value) && (r.json.draft.Subject.flags || []).some((f) => /translated from Arabic/.test(f)) && (r.json.draft.Subject.flags || []).some((f) => /إشعار/.test(f)));
check('Arabic-Indic digits read by rule: the date and their reference', r.json.draft['Letter date'].value === '2026-09-16' && /45\/ب\/2026/.test(r.json.draft['Their reference'].value || ''), r.json.draft);
ANSWER = { from: 'Consultant', their_ref: 'X/1', letter_date: '03/04/2026', subject: 'Site visit', type: 'Notice', action_by: 'Site Engineer', summary: 'A visit.', language: 'en', sure: {} };
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
r = await call('/api/letters/read', { filename: 'scan.png', data: b64(png) });
check('a scan goes to the model as the picture', sent[sent.length - 1].messages[0].content[0].type === 'image');
check('a date that reads two ways is not taken from the AI', !r.json.draft['Letter date'].value && (r.json.draft['Letter date'].flags || []).some((f) => /or/.test(f)));

console.log('\n— overdue first —');
env.ANTHROPIC_API_KEY = undefined; delete env.ANTHROPIC_API_KEY;
r = await call('/api/records', { type: 'incoming', title: 'Notice of late access', data: { From: 'Client Co', 'Date received': daysAgo(10), 'Reply by': daysAgo(3), Subject: 'Notice of late access', 'Action by': 'Project Manager' } });
const IN3 = r.json.ref;
r = await call('/api/records', { type: 'incoming', title: 'Copy of minutes', data: { From: 'Consultant', 'Date received': today, Subject: 'Copy of minutes', 'Action by': 'For information only' } });
r = await call('/api/letters');
const L = r.json.letters;
check('the register: overdue first', L[0].ref === IN3 && L[0].overdue && L[0].days_late === 3 && r.json.overdue === 1, L.map((x) => x.ref + (x.overdue ? '!' : '')));
const row1 = L.find((x) => x.ref === IN1);
check('the ten columns for an incoming letter', row1.dir === 'In' && row1.date === today && row1.from_to === 'Dar Consult (Engineer)' && row1.their_ref === 'DC/AET/0142'
  && row1.action_by === 'Project Manager' && row1.reply_by === addDays(today, 7) && row1.answered_by === '' && /reply by/.test(row1.status), row1);
check('a letter for information has no reply-by', L.find((x) => x.subject === 'Copy of minutes').reply_by === '' && L.find((x) => x.subject === 'Copy of minutes').action_by === 'For information');
r = await call('/api/records/import', { records: [{ type: 'incoming', ref: 'IN-090', title: 'Engineer’s letter on access', original_date: daysAgo(60), original_status: 'Awaiting reply',
  data: { From: 'Engineer', 'Reply by': daysAgo(50) } }] });
r = await call('/api/letters');
const imp = r.json.letters.find((x) => x.ref === 'IN-090');
check('a letter brought in from the old system is listed, never overdue (K5)', imp && !imp.overdue && /^Imported/.test(imp.status) && r.json.overdue === 1, imp);
await as('dc@tl10.test');
r = await call('/api/letters');
check('another company sees none of it', r.status === 200 && r.json.letters.length === 0);

console.log('\n— outgoing: issued here, stored; signed outside, logged by DC —');
await as('design@tk10.test');
r = await call('/api/records', { type: 'letter', title: 'Response to delay letter', data: { Subject: 'Response to delay letter', To: 'Consultant', Type: 'Response', Body: 'We refer to your letter DC/AET/0142.', 'In reply to': 'IN-001' } });
const LT1 = r.json.ref;
await as('pm@tk10.test');
await call('/api/record/advance', { ref: LT1, action: 'advance' });
check('signed by the PM, IN-001 is still open', db.prepare('SELECT status FROM records WHERE ref = ?').get(IN1).status.startsWith('With'));
await as('dc@tk10.test');
r = await call('/api/record/advance', { ref: LT1, action: 'advance' });
check('DC issues the reply: IN-001 closed', r.status === 200 && r.json.replied_to.includes('IN-001') && /^Replied — LTR-001 issued/.test(db.prepare('SELECT status FROM records WHERE ref = ?').get(IN1).status), r.text.slice(0, 300));
const kept = db.prepare("SELECT * FROM attachments WHERE ref = ? AND filename LIKE '%as issued%'").get(LT1);
check('and the letter as issued is stored on it', kept && kept.filename === LT1 + ' as issued.pdf' && r.json.stored === kept.filename, kept);
r = await call('/api/letters');
let L2 = r.json.letters;
check('the register: IN-001 answered by LTR-001; LTR-001 out, with their ref', L2.find((x) => x.ref === IN1).answered_by === LT1 && L2.find((x) => x.ref === LT1).dir === 'Out'
  && L2.find((x) => x.ref === LT1).their_ref === 'DC/AET/0142' && L2.find((x) => x.ref === LT1).date === today && L2.find((x) => x.ref === LT1).from_to === 'Consultant');
const signed = await pdfLetter(['Signed letter to the client']);
await as('pm@tk10.test');
r = await call('/api/letters/outgoing', { to: 'Client Co', subject: 'Programme revision', issued_on: daysAgo(1), in_reply_to: IN2, filename: 'signed.pdf', data: b64(signed) });
check('the PM does not log what DC issued', r.status === 403);
await as('dc@tk10.test');
r = await call('/api/letters/outgoing', { to: 'Client Co', subject: 'Programme revision', issued_on: daysAgo(1), in_reply_to: IN2 });
check('an outgoing letter is not logged without its signed copy', r.status === 400 && /signed copy/.test(r.json.error));
r = await call('/api/letters/outgoing', { to: 'Client Co', subject: 'Programme revision', issued_on: addDays(today, 2), in_reply_to: IN2, filename: 'signed.pdf', data: b64(signed) });
check('nor issued in the future', r.status === 400);
r = await call('/api/letters/outgoing', { to: 'Client Co', subject: 'Programme revision', issued_on: daysAgo(1), in_reply_to: 'IN-099', filename: 'signed.pdf', data: b64(signed) });
check('nor in reply to a letter not on this project', r.status === 400 && /IN-099/.test(r.json.error));
r = await call('/api/letters/outgoing', { to: 'Client Co', subject: 'Programme revision', issued_on: daysAgo(1), our_ref: 'TKA/OUT/77', signed_by: 'The Principal',
  in_reply_to: IN2, filename: 'Programme revision signed.pdf', data: b64(signed) });
const LT2 = r.json.ref;
const lt2 = db.prepare('SELECT * FROM records WHERE ref = ?').get(LT2);
check('DC logs a letter signed outside the platform: issued, its copy kept', r.status === 200 && /^Issued .* logged by Document Control/.test(lt2.status) && !lt2.due
  && db.prepare('SELECT filename FROM attachments WHERE ref = ?').get(LT2).filename === 'Programme revision signed.pdf', r.text.slice(0, 300));
check('and it closes the letter it answers, on the day it went', r.json.replied_to.includes(IN2) && db.prepare('SELECT status FROM records WHERE ref = ?').get(IN2).status === 'Replied — ' + LT2 + ' issued ' + daysAgo(1));
r = await call('/api/letters');
L2 = r.json.letters;
check('the register: IN-002 answered by LTR-002, LTR-002 dated the day it was issued', L2.find((x) => x.ref === IN2).answered_by === LT2 && L2.find((x) => x.ref === LT2).date === daysAgo(1) && L2.find((x) => x.ref === LT2).their_ref === 'CL/0007');

console.log('\n— the Excel, the page —');
r = await call('/api/letters/register.xlsx');
let x = xlsxText(r.bytes);
check('the register downloads: its columns, overdue first, with the project header', r.status === 200 && x.includes('Correspondence register') && x.includes('Answered by') && x.includes('Reply-by')
  && x.indexOf(IN3) < x.indexOf(IN1) && x.includes('Overdue 3 days') && x.includes('TKA-0001'));
r = await call('/api/register/xlsx?reg=letters');
x = xlsxText(r.bytes);
check('the dashboard’s letters Excel is the same register', r.status === 200 && x.includes('Answered by') && x.includes(LT2));
r = await call('/correspondence');
check('the page opens', r.status === 200 && r.text.includes('Correspondence register'));
check('every AI call went through the one door and was logged', db.prepare("SELECT COUNT(*) AS n FROM ai_usage WHERE task = 'a2-letter'").get().n === sent.length);
done();
