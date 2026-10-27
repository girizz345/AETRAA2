// K4: E16 — a consultant's Word form read for its fields and signature boxes
// as E10 reads an Excel one; filled and signed at issue; placeholders nothing
// fills listed by name; macro-enabled forms refused; the same file always read
// the same way, with the result kept against its SHA-256 and the extractor.
//   node tools/test-k4-word-forms.mjs
import { db, call, admin, as, check, done, onboard } from './_harness.mjs';
import { rfiForm, tokenForm, docx, table, row, cell, para } from './fixtures/word-forms.mjs';
import { readWordSheet, extractWordFields, prepareWordForm } from '../src/template-word.js';
import { buildXlsx } from '../src/xlsx.js';
import { strToU8, unzipSync, zipSync } from 'fflate';

const b64 = (u8) => Buffer.from(u8).toString('base64');
const textAt = (bytes, ref) => { const s = readWordSheet(bytes); const c = Object.values(s.cells).find((x) => x.ref === ref); return c ? c.text : null; };
const allText = (bytes) => Object.values(readWordSheet(bytes).cells).map((c) => c.text).join(' | ');

console.log('— reading a Word form (E16) —');
const form = rfiForm();
const ex = extractWordFields(form);
const by = Object.fromEntries(ex.fields.map((f) => [f.token, f]));
check('eight fields from its tables', ex.ok && ex.fields.length === 8, ex.fields.map((f) => f.cell + ':' + f.token));
check('the platform fills project, reference and date', by.project_name.auto && by.ref.auto && by.date.auto && by.ref.cell === 'D2');
check('the person is asked for discipline, subject, description, location, attachments', ['discipline', 'subject', 'description', 'location_of_works', 'attachments'].every((t) => by[t] && !by[t].auto));
check('a label across the table owns the box under it', by.description.cell === 'A6' && by.description.long === true);
check('the value beside a label is its box, not a label (“Old subject…”)', by.subject.cell === 'B4');
check('the last job’s names and the consultant’s old answers are cleared', JSON.stringify(ex.clear) === JSON.stringify(['B9', 'D9', 'B11', 'B12']), ex.clear);
check('every row is reported read or not, with the reason', ex.read.some((x) => !x.read && x.why === 'a signature row') && ex.read.some((x) => !x.read && x.why === 'the consultant’s part'));
check('each field is marked as the extractor’s (the A6 boundary)', ex.fields.every((f) => f.by === 'extractor'));
check('the same file is read the same way twice', JSON.stringify(extractWordFields(form).fields) === JSON.stringify(ex.fields));
const plain = docx(table(2, row(cell('Subject'), cell('Old subject')), row(cell('Discipline'), cell('MEP'))));
const px = extractWordFields(plain);
check('a plain two-column label | value table: “Old subject” is a value, not a label', px.fields.map((f) => f.cell + ':' + f.token).join(' ') === 'B1:subject B2:discipline', px.fields);
const prepared = prepareWordForm(form, ex.fields, ex.clear);
check('the writer puts each token in its box and clears the last job', textAt(prepared, 'B4') === '{{subject}}' && textAt(prepared, 'A6') === '{{description}}' && textAt(prepared, 'B9') === '' && !/Old subject|J\. Old|A\. Engineer/.test(allText(prepared)));
check('and keeps the cell’s formatting', /<w:tcW w:w="2400"/.test(new TextDecoder().decode(unzipSync(prepared)['word/document.xml'])));

console.log('\n— through the platform —');
const { pid } = await onboard('Tower W', 'TWW-0001', [['The DC', 'dc@towerw.test', ['dc']], ['The PM', 'pm@towerw.test', ['pm']], ['The Designer', 'design@towerw.test', ['design']]]);
await as('dc@towerw.test');
let r = await call('/api/templates/upload', { doc_type: 'rfi', filename: 'Consultant RFI.docx', file_b64: b64(form) });
check('DC uploads the Word form: fields, boxes and the record of the read', r.status === 200 && r.json.format === 'docx' && r.json.fields.length === 8 && r.json.inputs === 5
  && r.json.sign_boxes === 2 && r.json.extractor === 'e16-1' && r.json.field_count === 8 && r.json.needs_ai === false && !r.json.unknown_tokens.length, r.text.slice(0, 300));
const row1 = db.prepare("SELECT sha256, extractor, field_count, read_report FROM templates WHERE project_id = ? AND doc_type = 'rfi'").get(pid);
check('kept against the file’s SHA-256 and the extractor version', /^[0-9a-f]{64}$/.test(row1.sha256) && row1.extractor === 'e16-1' && Number(row1.field_count) === 8 && JSON.parse(row1.read_report).length > 5);
r = await call('/api/templates/upload', { doc_type: 'rfi', filename: 'Consultant RFI.docx', file_b64: b64(form) });
check('the same file again: the same hash and the same fields', db.prepare("SELECT sha256, fields FROM templates WHERE project_id = ? AND doc_type = 'rfi'").get(pid).sha256 === row1.sha256 && r.json.fields.length === 8);
r = await call('/api/templates');
const t = r.json.templates.find((x) => x.doc_type === 'rfi');
check('the list shows the fields, so Fields and Signature boxes are offered', t.has_fields && t.inputs.length === 5 && t.format === 'docx');
r = await call('/api/templates/review?type=rfi');
check('the review draws the Word form with clickable cells', r.status === 200 && /data-cell="B4"/.test(r.json.html) && r.json.fields.length === 8);
r = await call('/templates');
check('the templates page opens', r.status === 200);

console.log('\n— raised, signed and issued on the consultant’s Word form —');
await as('design@towerw.test');
r = await call('/api/template/form?type=rfi');
check('the New form asks for the form’s own fields', r.json.has && r.json.fields.map((f) => f.label).join('|') === 'Discipline|Subject|Description of required information|Location of the works|Attachments', r.json.fields);
r = await call('/api/records', { type: 'rfi', title: 'Slab edge at grid C', data: { Subject: 'Slab edge at grid C', Discipline: 'Structural',
  'Description of required information': 'Please confirm the edge detail at C/4.', 'Location of the works': 'Level 3', Attachments: 'Sketch SK-01' } });
const ref = r.json.ref;
await as('pm@towerw.test');
r = await call('/api/record/advance', { ref, action: 'advance' });
check('the PM signs it', r.status === 200, r.text);
r = await call('/api/record/doc?ref=' + encodeURIComponent(ref));
check('the document is issued as a Word file', r.status === 200 && /wordprocessingml/.test(r.headers.get('content-type') || ''), r.status);
const out = r.bytes;
check('the platform’s values are in their boxes', textAt(out, 'D2') === ref && textAt(out, 'B2') === 'Tower W');
check('the person’s values are in theirs', textAt(out, 'B4') === 'Slab edge at grid C' && textAt(out, 'D3') === 'Structural' && textAt(out, 'A6') === 'Please confirm the edge detail at C/4.' && textAt(out, 'B8') === 'Sketch SK-01');
check('the PM’s signature is in its box', /The PM — e-signed \d\d\/\d\d\/\d{4}/.test(textAt(out, 'B9') || ''), textAt(out, 'B9'));
check('nothing of the last job is left', !/Old Tower|Old subject|J\. Old|A\. Engineer|Answered last time|RFI-0099/.test(allText(out)));
r = await call('/api/record/preview?ref=' + encodeURIComponent(ref));
check('the preview shows the signature in place', r.status === 200 && /The PM/.test(r.json.html) && /tp-script/.test(r.json.html));

console.log('\n— DC changes a field; it is rebuilt from the original —');
await as('dc@towerw.test');
const fields = db.prepare("SELECT fields FROM templates WHERE project_id = ? AND doc_type = 'rfi'").get(pid).fields;
const changed = JSON.parse(fields).map((f) => (f.token === 'attachments' ? { ...f, label: 'Enclosures', token: 'enclosures' } : f));
r = await call('/api/templates/fields', { doc_type: 'rfi', fields: changed });
const after = JSON.parse(db.prepare("SELECT fields FROM templates WHERE project_id = ? AND doc_type = 'rfi'").get(pid).fields);
check('the renamed field is DC’s; the rest stay the extractor’s', r.status === 200 && after.find((f) => f.token === 'enclosures').by === 'person' && after.find((f) => f.token === 'subject').by === 'extractor', after.map((f) => f.token + ':' + f.by));

console.log('\n— placeholders nothing fills, by name —');
r = await call('/api/templates/upload', { doc_type: 'transmittal', filename: 'Transmittal.docx', file_b64: b64(tokenForm()) });
const unk = (r.json.unknown_tokens || []).map((u) => u.token);
check('a {{tokens}} Word form keeps working as before (no table, no fields)', r.status === 200 && !r.json.fields && r.json.tokens.includes('remarks'), r.text.slice(0, 200));
check('<<old style>> placeholders are named', unk.includes('<<drawing_list>>'), unk);
r = await call('/api/templates/upload', { doc_type: 'ncr', filename: 'NCR.docx', file_b64: b64(docx(para('NCR {{ref}} signed {{sign:1}} and {{sign:7}}'))) });
check('a signature for a step the workflow does not have is named', (r.json.unknown_tokens || []).some((u) => u.token === 'sign:7') && !(r.json.unknown_tokens || []).some((u) => u.token === 'sign:1'), r.json.unknown_tokens);
const xls = buildXlsx([{ name: 'Form', rows: [['RFI No:', 'RFI-0001'], ['Subject:', 'Old one'], [], [], ['', '', '', '', 'copy to {{stray_note}}']] }]);
r = await call('/api/templates/upload', { doc_type: 'material', filename: 'MAR.xlsx', file_b64: b64(xls) });
check('on a form with fields, a stray {{token}} that is not a field is named', r.status === 200 && (r.json.unknown_tokens || []).some((u) => u.token === 'stray_note'), r.json.unknown_tokens);
r = await call('/api/templates');
check('and the list carries what prints blank', r.json.templates.find((x) => x.doc_type === 'material').unknown_tokens.length >= 1);

console.log('\n— refused —');
const macro = zipSync({ ...unzipSync(form), 'word/vbaProject.bin': strToU8('macro') });
r = await call('/api/templates/upload', { doc_type: 'wir', filename: 'WIR.docx', file_b64: b64(macro) });
check('a macro-enabled form, whatever it is named', r.status === 400 && /macros/.test(r.json.error), r.text);
r = await call('/api/templates/upload', { doc_type: 'wir', filename: 'WIR.pdf', file_b64: b64(new TextEncoder().encode('%PDF-1.4 form')) });
// PDF forms are accepted since Ajay's decision 14 (tools/test-ajay-decisions.mjs); a broken one is refused.
check('a PDF that cannot be read is refused', r.status === 400 && /PDF could not be read/.test(r.json.error), r.text);

console.log('\n— the A6 boundary —');
r = await call('/api/templates/upload', { doc_type: 'mir', filename: 'MIR.docx', file_b64: b64(docx(table(2, row(cell('Material:', { bold: true }), cell('Old cement'))))) });
check('a form with fewer than two fields read is marked for A6', r.status === 200 && r.json.field_count === 1 && r.json.needs_ai === true, r.text.slice(0, 200));
done();
