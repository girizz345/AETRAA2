// K9 · v5 A1, A3, A6: the AI readers. The model reads; a person commits.
// A fake model stands in for the API here (each call is checked for what was
// sent); tools/k9-subscription.mjs runs the same three on the Claude
// subscription.
//   node tools/test-k9-ai-readers.mjs
import { db, env, call, admin, as, check, done, onboard } from './_harness.mjs';
import { buildXlsx } from '../src/xlsx.js';
import { createCanvas } from '@napi-rs/canvas';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { revCompare, dateOf, checkSheet, parseSheet } from '../src/ai-readers.js';

const b64 = (u8) => Buffer.from(u8).toString('base64');
const today = new Date(Date.now() + 4 * 3600000).toISOString().slice(0, 10);
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const todayWords = Number(today.slice(8)) + ' ' + MON[Number(today.slice(5, 7)) - 1] + ' ' + today.slice(0, 4);

// ---- the fake model: answers by task, and keeps every request it was sent
const sent = [];
const ANSWER = { a1: null, a3: null, a6: null };
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  if (String(url).startsWith('https://api.anthropic.com/v1/messages')) {
    const body = JSON.parse(init.body);
    sent.push(body);
    const sys = String(body.system || '');
    const a = /title block/.test(sys) ? ANSWER.a1 : /returned submittal/.test(sys) ? ANSWER.a3 : ANSWER.a6;
    return new Response(JSON.stringify({ content: [{ type: 'text', text: typeof a === 'string' ? a : JSON.stringify(a) }], usage: { input_tokens: 900, output_tokens: 120 } }),
      { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
  return realFetch(url, init);
};
const aiOn = () => { env.ANTHROPIC_API_KEY = 'test-key'; };
const aiOff = () => { delete env.ANTHROPIC_API_KEY; };
const sheetAnswer = (o) => ({ number: { value: o.number || '', sure: 'high' }, revision: { value: o.revision || '', sure: 'high' },
  title: { value: o.title || '', sure: 'medium' }, date: { value: o.date || '', sure: 'high' }, discipline: { value: o.discipline || '', sure: 'medium' } });

// ---- a scanned A1 sheet: one picture, no text; its title block bottom right
async function scannedSheet(lines) {
  const W = 1192, H = 842;
  const cv = createCanvas(W, H); const g = cv.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, W, H); g.fillStyle = '#000';
  g.font = '40px sans-serif'; g.fillText('SECRET FLOOR PLAN BODY', 100, 300);
  g.font = '16px sans-serif';
  lines.forEach((l, i) => g.fillText(l, Math.round(W * 0.81), Math.round(H * 0.72) + 24 * i));
  const png = await cv.encode('png');
  const pdf = await PDFDocument.create({ updateMetadata: false });
  const page = pdf.addPage([2384, 1684]);
  page.drawImage(await pdf.embedPng(png), { x: 0, y: 0, width: 2384, height: 1684 });
  return new Uint8Array(await pdf.save({ useObjectStreams: false }));
}
async function textSheet() {
  const pdf = await PDFDocument.create({ updateMetadata: false });
  const page = pdf.addPage([2384, 1684]);
  const f = await pdf.embedFont(StandardFonts.Helvetica);
  page.drawText('GENERAL ARRANGEMENT GROUND FLOOR PLAN WITH ALL NOTES AND DIMENSIONS', { x: 100, y: 800, size: 20, font: f });
  page.drawText('DRAWING NO: A1-500   REV: A   DATE: 01/02/2026', { x: 1900, y: 100, size: 14, font: f });
  return new Uint8Array(await pdf.save({ useObjectStreams: false }));
}
const dataUrl = (u8) => 'data:application/pdf;base64,' + b64(u8);

console.log('— the checks around the model —');
check('revisions of one series are ordered, two series are not', revCompare('C', 'D') < 0 && revCompare('P2', 'P1') > 0 && revCompare('03', '01') > 0 && revCompare('P2', 'C1') === null);
check('a date that reads two ways is put to the person', dateOf('03/04/2026', '2026-10-06').blocks && /2026-04-03 or 2026-03-04/.test(dateOf('03/04/2026', '2026-10-06').why));
check('“14/03/2026”, “March 14, 2026” and “14 Mar 2026” read one way', dateOf('14/03/2026', '2026-10-06').iso === '2026-03-14' && dateOf('March 14, 2026', '2026-10-06').iso === '2026-03-14' && dateOf('14 Mar 2026', '2026-10-06').iso === '2026-03-14');
const ck = checkSheet(parseSheet(JSON.stringify(sheetAnswer({ number: 'A1-101', title: 'GROUND FLOOR PLAN', revision: 'B' }))),
  { current: { number: 'A1-101', title: 'GF PLAN' }, sources: { title: 'file name' }, revisionsByNumber: { 'A1-101': [{ revision: 'C' }] } });
check('a value already there is kept, the AI’s differing one flagged, never taken', ck.title.kept === 'GF PLAN' && !ck.title.may_take && ck.title.flags.some((f) => /differs/.test(f.why)));
check('an older revision than the register’s is flagged', ck.revision.flags.some((f) => /older than Rev C/.test(f.why)) && ck.revision.may_take);
check('a scale is not a drawing number', checkSheet(parseSheet(JSON.stringify(sheetAnswer({ number: '1:100' }))), {}).number.flags.some((f) => f.blocks));

const { pid, oid } = await onboard('Tower K9', 'TK9-0001', [['The DC', 'dc@tk9.test', ['dc']], ['The PM', 'pm@tk9.test', ['pm']],
  ['The Designer', 'design@tk9.test', ['design']], ['The Engineer', 'site@tk9.test', ['site']]]);
const other = await onboard('Tower Q9', 'TQ9-0001', [['Other DC', 'dc@tq9.test', ['dc']]]);
const props = () => db.prepare('SELECT COUNT(*) AS n FROM ai_proposals').get().n;

console.log('\n— A1 with AI off —');
aiOff();
const scan1 = await scannedSheet(['DRAWING TITLE:', 'GROUND FLOOR PLAN', 'DRAWING NO: A1-101', 'REV: C', 'DATE: 14/03/2026', 'ARCHITECTURAL']);
await as('dc@tk9.test');
let r = await call('/api/drawing', { number: 'A1-101', kind: 'ifc', filename: 'A1-101.pdf', data: dataUrl(scan1) });
check('DC uploads a scanned sheet: it waits for the PM', r.status === 200 && r.json.status === 'pending', r.text.slice(0, 200));
const D1 = r.json.id;
r = await call('/api/drawings');
let row = r.json.drawings.find((d) => d.id === D1);
check('the register knows it for a scan', Number(row.scanned) === 1);
check('with AI off the register offers no Read with AI', r.json.ai_read === false);
r = await call('/api/ai/sheet', { drawing_id: D1 });
check('and the route says AI is off, writing nothing', r.status === 400 && r.json.disabled === true && db.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE name = 'ai_proposals'").get().n === 1 && props() === 0, r.text);
// The stamp reader: AI off is not a reading — the sheet stays waiting.
await admin();
r = await call('/api/intake/batch', { project_id: pid });
const BID = r.json.id;
db.prepare("INSERT INTO intake_item (id, batch_id, project_id, filename, family, state, extracted) VALUES ('it_k9', ?, ?, 'DM approved.pdf', 'drawing', 'proposed', ?)").run(BID, pid, JSON.stringify({ needs_stamp: true, kind: 'authority' }));
r = await call('/api/intake/stamps', { batch_id: BID });
check('the stamp reader with AI off refuses and marks nothing as tried', r.status === 400 && r.json.disabled && JSON.parse(db.prepare("SELECT extracted FROM intake_item WHERE id = 'it_k9'").get().extracted).needs_stamp === true, r.text);

console.log('\n— A1: read, then confirmed by DC —');
aiOn();
ANSWER.a1 = sheetAnswer({ number: 'A1-101', revision: 'C', title: 'GROUND FLOOR PLAN', date: '14/03/2026', discipline: 'Architectural' });
await as('site@tk9.test');
r = await call('/api/ai/sheet', { drawing_id: D1 });
check('a site engineer cannot read sheets with AI', r.status === 403);
await as('dc@tq9.test');
r = await call('/api/ai/sheet', { drawing_id: D1 });
check('another company’s DC cannot reach the sheet', r.status === 404, r.status);
await as('dc@tk9.test');
r = await call('/api/drawings');
check('with AI on, DC is offered Read with AI', r.json.ai_read === true);
const before = sent.length;
r = await call('/api/ai/sheet', { drawing_id: D1 });
const A = r.json;
check('DC reads the scan with AI', r.status === 200 && A.id && A.model, r.text.slice(0, 300));
const req1 = sent[before];
const blocks = req1 && req1.messages[0].content;
check('only the title-block corner went: one PNG image, no PDF', blocks && blocks.filter((x) => x.type === 'image').length === 1 && blocks[0].source.media_type === 'image/png' && !blocks.some((x) => x.type === 'document'));
const sentPng = Buffer.from(blocks[0].source.data, 'base64');
// The right 22% by the bottom 36% of a 2384 × 1684 sheet: 524 × 606 in shape.
check('the image is the corner’s shape, not the sheet’s', Math.abs(A.sent.width / A.sent.height - (0.22 * 2384) / (0.36 * 1684)) < 0.02 && !JSON.stringify(req1).includes(b64(scan1).slice(100, 200)), A.sent);
check('each value comes back with how sure, and the checks', A.fields.title.ai === 'GROUND FLOOR PLAN' && A.fields.title.sure === 'medium' && A.fields.date.iso === '2026-03-14' && A.fields.title.may_take);
check('the number DC typed is kept, not offered', A.fields.number.kept === 'A1-101' && !A.fields.number.may_take);
row = db.prepare('SELECT * FROM drawings WHERE id = ?').get(D1);
check('nothing reached the sheet yet', !row.title && !row.revision && !row.sheet_date && !row.read_by_ai);
check('the call is logged with its cost', db.prepare("SELECT COUNT(*) AS n FROM ai_usage WHERE task = 'a1-sheet' AND ok = 1").get().n === 1);
r = await call('/api/ai/corner?id=' + A.id);
check('the corner that was sent can be shown to the person checking', r.status === 200 && r.bytes[1] === 0x50 && r.bytes[2] === 0x4e && r.bytes.length === sentPng.length);
r = await call('/api/ai/sheet/confirm', { id: A.id, fields: { number: 'ai', title: 'ai' } });
check('a value already there cannot be taken from the AI — nothing saved', r.status === 400 && /number: a value is already there/.test(r.json.error) && !db.prepare('SELECT title FROM drawings WHERE id = ?').get(D1).title, r.text);
r = await call('/api/ai/sheet/confirm', { id: A.id, fields: { title: 'ai', revision: { value: 'D' }, date: 'ai', discipline: 'ai' } });
check('DC confirms the title, date and discipline and types the revision', r.status === 200 && r.json.state === 'pending', r.text);
row = db.prepare('SELECT * FROM drawings WHERE id = ?').get(D1);
const prov = JSON.parse(row.read_by_ai || '{}');
check('the sheet carries them, each with where it came from', row.title === 'GROUND FLOOR PLAN' && row.revision === 'D' && row.sheet_date === '2026-03-14' && row.discipline === 'Architectural'
  && prov.fields.title === 'ai' && prov.fields.revision === 'typed' && prov.confirmed_by === 'The DC' && prov.model, row);
check('and still waits for the PM — the AI approves nothing', row.status === 'pending');
r = await call('/api/ai/sheet/confirm', { id: A.id, fields: { title: 'ai' } });
check('a reading is confirmed once', r.status === 409);
await as('pm@tk9.test');
r = await call('/api/drawing/approve', { id: D1 });
check('the PM approves it into the register', r.status === 200 && db.prepare('SELECT status FROM drawings WHERE id = ?').get(D1).status === 'current');
r = await call('/api/drawings');
row = r.json.drawings.find((d) => d.id === D1);
check('the register shows “read by AI, confirmed by …” and the sheet’s date', JSON.parse(row.read_by_ai).confirmed_by === 'The DC' && row.sheet_date === '2026-03-14');
await as('dc@tk9.test');
r = await call('/api/ai/sheet', { drawing_id: D1 });
check('an approved sheet is not read again — it is the PM’s', r.status === 400 && /approved/.test(r.json.error));

console.log('\n— A1: what is not guessed —');
const scan2 = await scannedSheet(['DRAWING NO: A1-101', 'REV: B', 'DATE: 03/04/2026']);
r = await call('/api/drawing', { number: 'A1-101', kind: 'ifc', filename: 'A1-101 B.pdf', data: dataUrl(scan2) });
const D2 = r.json.id;
ANSWER.a1 = sheetAnswer({ number: 'A1-101', revision: 'B', title: 'GROUND FLOOR PLAN', date: '03/04/2026' });
r = await call('/api/ai/sheet', { drawing_id: D2 });
const B2 = r.json;
check('a date that reads two ways is held for DC', B2.fields.date.flags.some((f) => f.blocks && /2026-04-03 or 2026-03-04/.test(f.why)) && !B2.fields.date.may_take);
check('a revision older than the register’s is flagged', B2.fields.revision.flags.some((f) => /older than Rev D/.test(f.why)));
r = await call('/api/ai/sheet/confirm', { id: B2.id, fields: { date: 'ai' } });
check('the two-way date cannot be taken with a tick', r.status === 400 && /date/.test(r.json.error));
r = await call('/api/ai/sheet/confirm', { id: B2.id, fields: { date: { value: '2026-04-03' }, revision: 'ai' } });
check('DC says which day — typed, and marked so', r.status === 200 && JSON.parse(db.prepare('SELECT read_by_ai FROM drawings WHERE id = ?').get(D2).read_by_ai).fields.date === 'typed');
r = await call('/api/drawing', { number: 'A1-500', kind: 'ifc', filename: 'A1-500.pdf', data: dataUrl(await textSheet()) });
const D3 = r.json.id;
check('a sheet with text is not a scan', Number(db.prepare('SELECT scanned FROM drawings WHERE id = ?').get(D3).scanned || 0) === 0);
r = await call('/api/ai/sheet', { drawing_id: D3 });
check('and is not sent to the AI — E4 reads it', r.status === 400 && /scans only/.test(r.json.error));
ANSWER.a1 = 'I could not read this sheet, sorry.';
const scan3 = await scannedSheet(['DRAWING NO: A1-102']);
r = await call('/api/drawing', { number: 'A1-102', kind: 'ifc', filename: 'A1-102.pdf', data: dataUrl(scan3) });
const D4 = r.json.id;
r = await call('/api/ai/sheet', { drawing_id: D4 });
check('an answer that is not the agreed shape changes nothing', r.status === 400 && /could not be read/.test(r.json.error) && !db.prepare('SELECT read_by_ai FROM drawings WHERE id = ?').get(D4).read_by_ai);

console.log('\n— A1 in a drop: filed, then the PM —');
await admin();
r = await call('/api/intake/scan', { project_id: pid, batch_id: BID, filename: 'Scan 0007.pdf', path: 'IFC Drawings', data: b64(await scannedSheet(['DRAWING NO: A1-104'])) });
const IT0 = r.json.id;
ANSWER.a1 = sheetAnswer({ number: 'A1-104' });
r = await call('/api/ai/sheet', { item_id: IT0 });
check('a number read from the file name is a value read by rule: kept, the AI’s flagged', r.json.fields.number.kept === 'SCAN-0007' && !r.json.fields.number.may_take && r.json.fields.number.flags.some((f) => /differs from SCAN-0007/.test(f.why)), r.json.fields && r.json.fields.number);
r = await call('/api/intake/scan', { project_id: pid, batch_id: BID, filename: 'scanned sheet.pdf', path: 'IFC Drawings', data: b64(await scannedSheet(['DRAWING NO: A1-103', 'REV: A'])) });
const IT = r.json.id;
let it = JSON.parse(db.prepare('SELECT extracted FROM intake_item WHERE id = ?').get(IT).extracted);
check('intake marks a scan, with no number to file it by', it.scanned === true && it.needs_number === true, it);
r = await call('/api/intake/batch?id=' + BID);
check('the review shows it as a scan', r.json.items.find((x) => x.id === IT).scanned === true);
ANSWER.a1 = sheetAnswer({ number: 'A1-103', revision: 'A', title: 'FIRST FLOOR PLAN', date: todayWords });
r = await call('/api/ai/sheet', { item_id: IT });
const C1 = r.json;
check('the AETRAA Admin reads it with AI', r.status === 200 && C1.fields.number.may_take && C1.fields.date.iso === today, r.text.slice(0, 300));
check('nothing is applied to the item yet', !JSON.parse(db.prepare('SELECT extracted FROM intake_item WHERE id = ?').get(IT).extracted).number);
check('the title made from the file name is kept; the AI’s is not offered', C1.fields.title.kept === 'scanned sheet' && !C1.fields.title.may_take);
r = await call('/api/ai/sheet/confirm', { id: C1.id, fields: { number: 'ai', revision: 'ai', title: { value: 'FIRST FLOOR PLAN' }, date: 'ai' } });
it = JSON.parse(db.prepare('SELECT extracted FROM intake_item WHERE id = ?').get(IT).extracted);
check('confirmed: the item has its number, marked “AI, confirmed by …”', r.status === 200 && it.number === 'A1-103' && /AI, confirmed by AETRAA Admin/.test(it.number_source) && it.needs_number === false && it.ai_read.fields.number === 'ai', it);
r = await call('/api/intake/commit', { batch_id: BID, ids: [IT] });
const filed = db.prepare("SELECT * FROM drawings WHERE project_id = ? AND number = 'A1-103'").get(pid);
check('filed by the Admin, it still waits for the PM (A1 step 3)', filed && filed.status === 'pending' && filed.title === 'FIRST FLOOR PLAN' && filed.sheet_date === today && Number(filed.scanned) === 1
  && JSON.parse(filed.read_by_ai).fields.number === 'ai' && JSON.parse(filed.read_by_ai).fields.title === 'typed', filed);

console.log('\n— A3: a stamped reply —');
await as('design@tk9.test');
r = await call('/api/records', { type: 'submittal', title: 'Rebar shop drawings L3', data: { Subject: 'Rebar shop drawings L3' } });
const S1 = r.json.ref;
await as('pm@tk9.test');
await call('/api/record/advance', { ref: S1, action: 'advance' });
await as('dc@tk9.test');
r = await call('/api/s0/issue', { ref: S1, outside: true, note: 'Transmittal T-9' });
check('the submittal is issued', r.status === 200, r.text.slice(0, 200));
const replyPdf = await scannedSheet(['CODE C - REVISE AND RESUBMIT']);
r = await call('/api/s0/read-reply', { ref: S1, filename: 'Returned SUB stamped.pdf', mime: 'application/pdf', data: b64(replyPdf) });
const ATT = r.json.attachment_id;
check('DC uploads the stamped reply on the record', r.status === 200 && ATT);
aiOff();
r = await call('/api/s0?ref=' + encodeURIComponent(S1));
check('with AI off the desk does not offer it', r.json.ai_on === false);
r = await call('/api/s0/ai-read', { ref: S1, attachment_id: ATT });
check('and the route says so', r.status === 400 && r.json.disabled);
aiOn();
ANSWER.a3 = { reference: S1, code: 'C', code_words: 'Revise and resubmit', date: todayWords, code_sure: 'high', date_sure: 'high',
  comments: [{ text: 'Show lap lengths on every bar', about: 'S-201', discipline: 'Structural' }, { text: 'Bar marks to BS 8666', about: 'Clause 3.2', discipline: '' }] };
await as('pm@tk9.test');
r = await call('/api/s0/ai-read', { ref: S1, attachment_id: ATT });
check('the PM does not record replies — Document Control does', r.status === 403);
await as('dc@tk9.test');
r = await call('/api/s0/ai-read', { ref: S1, attachment_id: 'nope' });
check('only a reply uploaded on this record is read', r.status === 404);
const before3 = sent.length;
r = await call('/api/s0/ai-read', { ref: S1, attachment_id: ATT });
const R3 = r.json;
check('DC reads the reply with AI: the code, the date, each comment with its drawing or clause', r.status === 200 && R3.code === 'C' && R3.replied_on === today && R3.comments.length === 2 && R3.comments[0].about === 'S-201' && R3.may_confirm, r.text.slice(0, 300));
check('the reply went as uploaded (a PDF document)', sent[before3].messages[0].content[0].type === 'document');
check('nothing is recorded yet', !db.prepare('SELECT code FROM records WHERE ref = ?').get(S1).code && /^Issued for approval/.test(db.prepare('SELECT status FROM records WHERE ref = ?').get(S1).status));
ANSWER.a3 = { ...ANSWER.a3, reference: 'SUB-099' };
r = await call('/api/s0/ai-read', { ref: S1, attachment_id: ATT });
const Rx = r.json;
check('a reply that reads as another record’s is not offered for one click', !Rx.may_confirm && Rx.flags.some((f) => /SUB-099, not/.test(f.why)));
r = await call('/api/s0/ai-confirm', { ref: S1, id: Rx.id });
check('and is refused if pressed anyway', r.status === 400 && /SUB-099/.test(r.json.error));
ANSWER.a3 = { ...ANSWER.a3, reference: S1, date: '03/04/2026' };
r = await call('/api/s0/ai-read', { ref: S1, attachment_id: ATT });
check('a reply date that reads two ways is not applied', !r.json.may_confirm && r.json.flags.some((f) => /or/.test(f.why) && f.part === 'date'));
r = await call('/api/s0/ai-confirm', { ref: S1, id: R3.id });
check('DC confirms with one click: Code C recorded, Rev 1 opened', r.status === 200 && r.json.code === 'C' && r.json.revision === S1 + ' Rev 1' && r.json.read_by_ai, r.text.slice(0, 300));
const cm = db.prepare('SELECT text, about, discipline FROM record_comments WHERE ref = ? ORDER BY at, id').all(S1 + ' Rev 1');
check('the comments are Design’s checklist, each with its drawing or clause and discipline', cm.length === 2 && cm[0].about === 'S-201' && cm[0].discipline === 'Structural' && cm[1].about === 'Clause 3.2', cm);
r = await call('/api/s0/ai-confirm', { ref: S1, id: R3.id });
check('the same reading is not applied twice', r.status >= 400);

console.log('\n— A6: a form the extractor could not place —');
const odd = buildXlsx([{ name: 'Form', rows: [
  ['notice of inspection — please fill in every part of this form before the inspection takes place on site', '', '', 'Form WIR-01'],
  ['', ''], ['the works to be inspected are described in the space provided to the right of this text', ''],
  ['', ''], ['any further information the consultant should know about the works goes in the box beside this', ''],
  ['', ''], ['', ''], ['signed for and on behalf of the contractor in the box to the right of this line of text', '']] }]);
await as('dc@tk9.test');
r = await call('/api/templates/upload', { doc_type: 'wir', filename: 'Odd WIR.xlsx', file_b64: b64(odd) });
check('the form is kept, and the extractor found fewer than two fields', r.status === 200 && r.json.field_count < 2, r.text.slice(0, 300));
aiOff();
r = await call('/api/templates');
check('with AI off no Find fields with AI', r.json.ai_fields === false && r.json.templates.find((t) => t.doc_type === 'wir').needs_ai === true);
r = await call('/api/templates/ai-fields', { doc_type: 'wir' });
check('and the route says so', r.status === 400 && r.json.disabled);
aiOn();
ANSWER.a6 = { fields: [{ cell: 'B3', label: 'Works to be inspected', long: true }, { cell: 'B5', label: 'Further information' },
  { cell: 'A1', label: 'Title' }, { cell: 'Z99', label: 'Far away' }, { cell: 'B3', label: 'Again' }],
  signatures: [{ cell: 'B8', label: 'Contractor' }] };
await as('pm@tk9.test');
r = await call('/api/templates/ai-fields', { doc_type: 'wir' });
check('the PM keeps templates but A6 is Document Control’s', r.status === 403);
await as('dc@tk9.test');
const before6 = sent.length;
r = await call('/api/templates/ai-fields', { doc_type: 'wir' });
const F = r.json;
check('DC finds fields with AI: two kept, three dropped with the reason', r.status === 200 && F.fields.length === 2 && F.signatures.length === 1 && F.dropped.length === 3
  && F.dropped.some((d) => d.cell === 'A1' && /has text/.test(d.why)) && F.dropped.some((d) => /outside the form/.test(d.why)) && F.dropped.some((d) => /twice/.test(d.why)), r.text.slice(0, 400));
const q6 = sent[before6];
check('the cell text and positions went, not the file', typeof q6.messages[0].content === 'string' && /A3: "the works to be inspected/.test(q6.messages[0].content) && !JSON.stringify(q6).includes('UEsDB'));
let tpl = db.prepare("SELECT fields, sign_map, field_count FROM templates WHERE project_id = ? AND doc_type = 'wir'").get(pid);
check('the form is unchanged until DC saves', !(JSON.parse(tpl.fields || '[]') || []).length);
r = await call('/api/templates/fields', { doc_type: 'wir', proposal_id: F.id, ai_signs: ['B8'],
  fields: [{ cell: 'B3', label: 'Works to be inspected', long: true }, { cell: 'B5', label: 'More information' }, { cell: 'B2', label: 'Location' }] });
tpl = db.prepare("SELECT fields, sign_map FROM templates WHERE project_id = ? AND doc_type = 'wir'").get(pid);
const fl = JSON.parse(tpl.fields), sm = JSON.parse(tpl.sign_map);
check('DC saves: the AI’s fields marked as proposed by AI, DC’s own as DC’s', r.status === 200 && fl.find((f) => f.cell === 'B3').by === 'ai' && fl.find((f) => f.cell === 'B5').label === 'More information' && fl.find((f) => f.cell === 'B2').by === 'person', fl);
check('the signature box DC kept is offered for the steps', sm.ai.length === 1 && sm.ai[0].cell === 'B8' && sm.ai[0].label === 'Contractor');
r = await call('/api/templates/fields', { doc_type: 'wir', proposal_id: F.id, fields: [] });
check('an AI draft is saved once', r.status === 409);
r = await call('/api/templates/fields', { doc_type: 'wir', fields: fl });
check('a later edit by hand keeps the AI’s signature box', JSON.parse(db.prepare("SELECT sign_map FROM templates WHERE project_id = ? AND doc_type = 'wir'").get(pid).sign_map).ai[0].cell === 'B8');
const read = buildXlsx([{ name: 'RFI', rows: [['REQUEST FOR INFORMATION', '', '', 'Form RFI-01'], ['Project:', ''], ['Subject:', ''], ['Description:', ''], ['Date:', '']] }]);
r = await call('/api/templates/upload', { doc_type: 'rfi', filename: 'RFI.xlsx', file_b64: b64(read) });
check('a form the extractor read (two fields or more)…', r.status === 200 && r.json.field_count >= 2, r.text.slice(0, 200));
r = await call('/api/templates/ai-fields', { doc_type: 'rfi' });
check('…is never changed by the AI', r.status === 400 && /does not change it/.test(r.json.error));

console.log('\n— the project’s AI switch —');
await admin();
await call('/api/setup/modules', { project_id: pid, modules: ['core', 'planning', 'site', 'design', 'dc', 'registers', 'gate'] });
await as('dc@tk9.test');
r = await call('/api/ai/sheet', { drawing_id: D4 });
check('with the AI module off, A1 is refused', r.status === 403 && /AI assistance/.test(r.json.error), r.text);
r = await call('/api/drawings');
check('and the register offers no Read with AI', r.json.ai_read === false);
r = await call('/api/templates/ai-fields', { doc_type: 'wir' });
check('nor A6', r.status === 403);
check('every call went through the one door and was logged', db.prepare("SELECT COUNT(*) AS n FROM ai_usage WHERE task IN ('a1-sheet','a3-reply','a6-fields')").get().n === sent.length);
done();
