// K13 (A10) · v5 A10: an RFI prepared from a note and a photo — drafted with
// AI on, typed with AI off; nothing raised, routed or issued by the AI; the
// duplicate check before raising; the possible-variation flag to the QS; the
// RFI log by discipline.
//   node tools/test-k13-rfi.mjs
import { db, env, mail, call, admin, as, check, done, onboard } from './_harness.mjs';
import { buildXlsx } from '../src/xlsx.js';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { findRfiReferences, similarity } from '../src/rfi-prep.js';

const b64 = (u8) => Buffer.from(u8).toString('base64');
const today = new Date(Date.now() + 4 * 3600000).toISOString().slice(0, 10);
const inDays = (n) => new Date(Date.parse(today) + n * 86400000).toISOString().slice(0, 10);
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const words = (iso) => Number(iso.slice(8)) + ' ' + MON[Number(iso.slice(5, 7)) - 1] + ' ' + iso.slice(0, 4);
const sent = [];
let ANSWER = null;
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  if (String(url).startsWith('https://api.anthropic.com/v1/messages')) {
    sent.push(JSON.parse(init.body));
    return new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(ANSWER) }], usage: { input_tokens: 600, output_tokens: 200 } }), { status: 200 });
  }
  return realFetch(url, init);
};
async function pdf(pages) {
  const d = await PDFDocument.create({ updateMetadata: false }); const f = await d.embedFont(StandardFonts.Helvetica);
  for (const lines of pages) { const pg = d.addPage([595, 842]); lines.forEach((l, i) => pg.drawText(l, { x: 40, y: 800 - i * 15, size: 10, font: f })); }
  return new Uint8Array(await d.save({ useObjectStreams: false }));
}
const count = () => { try { return db.prepare("SELECT COUNT(*) AS n FROM records WHERE type = 'rfi'").get().n; } catch (e) { return 0; } };

console.log('— by rule —');
const refs = findRfiReferences('Duct clashes with beam on ST-210 at L5 grid E-7; ductwork per 23 31 00', { drawings: [{ number: 'ST-210', title: 'L5 beams' }], sections: [{ code: '23 31 00', title: 'HVAC DUCTWORK' }] });
check('a drawing named is found in the register, a spec section by its number; a grid is not a drawing', refs.drawings[0].number === 'ST-210' && refs.specs[0].code === '23 31 00' && !refs.unknown_drawings.length, refs);
check('similar words are similar', similarity('L5 beam duct clash grid E-7', 'Duct clashes with beam at L5 grid E-7') >= 0.5 && similarity('Paint colour', 'Duct clash at L5') === 0);

const { pid, oid } = await onboard('Tower K13', 'TKD-0001', [['The Designer', 'design@tk13.test', ['design']], ['The PM', 'pm@tk13.test', ['pm']], ['The DC', 'dc@tk13.test', ['dc']],
  ['The QS', 'qs@tk13.test', ['commercial']], ['The HSE', 'hse@tk13.test', ['hse']]]);
await onboard('Tower P13', 'TPD-0001', [['Other designer', 'design@tp13.test', ['design']]]);
await as('dc@tk13.test');
await call('/api/drawing', { number: 'ST-210', revision: 'B', title: 'L5 beam layout', kind: 'ifc', filename: 'ST-210.pdf', data: 'data:application/pdf;base64,' + b64(await pdf([['ST-210 L5 BEAM LAYOUT', 'BEAM B12 600 DEEP']])) });
let r = await call('/api/spec-index', { filename: 'Spec.pdf', data: b64(await pdf([['TABLE OF CONTENTS', '23 31 00 HVAC DUCTWORK 2'], ['SECTION 23 31 00 - HVAC DUCTWORK', '2.1 DUCTS', 'A. Galvanised steel ducts.']])) });
await as('design@tk13.test');
await call('/api/spec-index/confirm', { id: r.json.id });
const NOTE = 'The 300 mm supply duct clashes with beam B12 on ST-210 at level 5, grid E-7 — please confirm the duct routing (ductwork 23 31 00).';

console.log('\n— AI off: by hand —');
await as('hse@tk13.test');
r = await call('/api/rfi/draft', { note: NOTE });
check('HSE does not raise RFIs', r.status === 403);
await as('design@tk13.test');
r = await call('/api/rfi');
check('the RFI form’s fields, with location and impact', r.status === 200 && ['Subject', 'Question', 'Drawing ref', 'Spec ref', 'Location', 'Impact', 'Reply needed by'].every((f) => r.json.fields.includes(f)) && r.json.ai_on === false, r.json.fields);
r = await call('/api/rfi/draft', { note: NOTE });
check('with AI off the references are still found by rule, and what is missing said', r.status === 200 && r.json.fields['Drawing ref'] === 'ST-210' && r.json.fields['Spec ref'] === '23 31 00'
  && /not switched on/.test(r.json.why) && r.json.missing.some((m) => /location/.test(m)) && r.json.missing.some((m) => /needed by/.test(m)) && sent.length === 0, r.text.slice(0, 400));
r = await call('/api/records', { type: 'rfi', title: 'L5 beam / duct clash at grid E-7', data: { Subject: 'L5 beam / duct clash at grid E-7', Discipline: 'MEP', Question: 'Duct clashes with beam B12 at L5 grid E-7 — confirm routing.', 'Drawing ref': 'ST-210', Location: 'L5 grid E-7', 'Reply needed by': inDays(7) } });
const R1 = r.json.ref;
check('typed and raised by the engineer: RFI-0001, at the PM', r.status === 200 && R1 === 'RFI-0001' && /PM|Prepared|Raised/.test(r.json.record.status), r.text.slice(0, 200));

console.log('\n— AI on: drafted, checked, never raised by the AI —');
env.ANTHROPIC_API_KEY = 'test-key';
ANSWER = { fields: { Subject: 'Duct and beam clash at level 5', Discipline: 'MEP', Question: 'The 300 mm supply duct clashes with beam B12 at level 5, grid E-7. Please confirm the duct routing.',
  'Drawing ref': 'ME-150', Location: 'Level 5, grid E-7', Impact: 'Duct installation at level 5 is on hold.', 'Reply needed by': words(inDays(5)), Priority: 'Urgent' },
  missing: ['The question could name the duct size on the drawing.'] };
const before = count();
r = await call('/api/rfi/draft', { note: 'Different clash: chilled water pipe hits slab edge at L7', photo: { filename: 'site.png', data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==' } });
const D1 = r.json;
check('the AI drafts the fields from the note and the photo (sent as a picture)', r.status === 200 && D1.fields.Question && D1.fields.Location === 'Level 5, grid E-7' && D1.model && sent[0].messages[0].content[0].type === 'image', r.text.slice(0, 300));
check('the needed-by date read one way, as a date', D1.fields['Reply needed by'] === inDays(5));
check('its wording check is listed, beside what the rules find missing', D1.missing.some((m) => /duct size/.test(m)) && D1.missing.some((m) => /no drawing in the register/.test(m)));
check('nothing was raised by the AI', count() === before);
check('an RFI asks, never answers: the AI is told so', /never propose a solution/.test(sent[0].system));
ANSWER = { ...ANSWER, fields: { ...ANSWER.fields, Subject: 'L5 beam duct clash grid E-7', Question: 'Duct clashes with beam B12 at L5 grid E-7 — confirm routing.' } };
r = await call('/api/rfi/draft', { note: NOTE });
check('the drawing reference is the register’s (ST-210), not the AI’s', r.json.fields['Drawing ref'] === 'ST-210');
check('an RFI already asked is named before raising', r.json.duplicates.some((x) => x.ref === R1));
r = await call('/api/records', { type: 'rfi', title: 'L5 beam duct clash grid E-7', data: { Subject: 'L5 beam duct clash grid E-7', Question: 'Duct clashes with beam B12 at L5 grid E-7 — confirm routing.', 'Drawing ref': 'ST-210' } });
check('raising it is stopped with the duplicate named', r.status === 409 && r.json.duplicates[0].ref === R1 && /Raise it anyway/.test(r.json.error));
r = await call('/api/records', { type: 'rfi', title: 'L5 beam duct clash grid E-7', not_duplicate: true, data: { Subject: 'L5 beam duct clash grid E-7', Question: 'Duct clashes with beam B12 at L5 grid E-7 — confirm routing.', 'Drawing ref': 'ST-210' } });
check('…and raised when the engineer says so', r.status === 200 && r.json.ref === 'RFI-0002');
db.prepare("INSERT INTO issues (project_id, no, ref, type, title, detail, status, raised_date) VALUES (?, 1, 'RFI-0001', 'rfi', 'Facade bracket spacing at podium', 'Confirm bracket spacing at podium facade', 'issued', ?)").run(pid, today);
r = await call('/api/rfi/duplicates', { subject: 'Facade bracket spacing podium', question: 'Confirm the bracket spacing at the podium facade' });
check('the issues register’s RFIs are searched too', r.json.duplicates.some((x) => /issues register/.test(x.why)));

console.log('\n— a proposal box on the consultant’s form is left blank —');
await as('dc@tk13.test');
await call('/api/templates/upload', { doc_type: 'rfi', filename: 'RFI form.xlsx', file_b64: b64(buildXlsx([{ name: 'RFI', rows: [['REQUEST FOR INFORMATION', '', '', 'Form RFI-01'],
  ['Subject:', ''], ['Question:', ''], ["Contractor's proposed solution:", ''], ['Location:', ''], ['Date:', '']] }])) });
await as('design@tk13.test');
r = await call('/api/rfi');
check('the consultant’s form decides the fields', r.json.has_form && r.json.fields.some((f) => /proposed solution/i.test(f)), r.json.fields);
const n0 = sent.length;
r = await call('/api/rfi/draft', { note: NOTE });
check('the proposal box is left blank and not asked of the AI', r.json.left_blank.some((f) => /proposed solution/i.test(f)) && !/proposed solution/i.test(sent[n0].messages[0].content.slice(sent[n0].messages[0].content.indexOf('Fill the fields'))) && !Object.keys(r.json.fields).some((f) => /proposed/i.test(f)));

console.log('\n— S0, and the possible-variation flag to the QS —');
await as('pm@tk13.test');
await call('/api/record/advance', { ref: R1, action: 'advance' });
await as('dc@tk13.test');
r = await call('/api/s0/issue', { ref: R1, outside: true, note: 'T-7' });
check('DC issues RFI-0001', r.status === 200, r.text.slice(0, 200));
const mails = mail.length;
r = await call('/api/s0/reply', { ref: R1, code: 'answered', replied_on: today, comments: ['Re-route the duct below the beam; add a new drop at grid E-6'], variation: 'the re-route adds a drop and 4 m of duct' });
const rec1 = db.prepare('SELECT data FROM records WHERE ref = ? AND project_id = ?').get(R1, pid);
check('answered, and flagged as a possible variation on the record', r.status === 200 && /^Possible variation — the re-route/.test(JSON.parse(rec1.data)['Variation flag']), r.text.slice(0, 200));
check('the QS is told', mail.slice(mails).some((m) => JSON.stringify(m.to).includes('qs@tk13.test') && /possible variation/i.test(m.subject)));
check('nothing is created in the variation register', count() >= 2 && (() => { try { return !db.prepare("SELECT ref FROM records WHERE type = 'variation' AND project_id = ?").get(pid); } catch (e) { return true; } })());

console.log('\n— the RFI log, by discipline —');
r = await call('/api/rfi');
const L = r.json.log;
const l1 = L.find((x) => x.ref === R1);
check('Sr, Discipline, Subject, Raised, Issued, Reply by, Answered, Days open, Status, Variation flag', l1 && l1.discipline === 'MEP' && l1.raised === today && l1.issued === today && l1.reply_by && l1.answered === today
  && l1.days_open === 0 && /Answered/.test(l1.status) && /Possible variation/.test(l1.variation) && L.every((x, i) => x.sr === i + 1), l1);
r = await call('/api/register/xlsx?reg=rfi');
const x = new TextDecoder().decode(r.bytes);
check('and in Excel', r.status === 200 && x.includes('RFI log') && x.includes('Variation flag') && x.includes('Days open'));
await as('design@tp13.test');
r = await call('/api/rfi');
check('another company sees none of it', r.json.log.length === 0);
await as('design@tk13.test');
r = await call('/rfi');
check('the page opens', r.status === 200 && r.text.includes('RFI log'));
check('every AI call went through the one door', db.prepare("SELECT COUNT(*) AS n FROM ai_usage WHERE task = 'a10-rfi'").get().n === sent.length);
done();
