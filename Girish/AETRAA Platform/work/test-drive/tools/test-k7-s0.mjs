// K7 · v5 S0 and E14: a submittal raised, returned, resubmitted, approved,
// issued by email (To, Cc, the filled form, the files, DC's name), answered
// with a code read from the returned form; Code C opening Rev 1 with the
// comments as Design's checklist; the PM held until every comment is answered.
//   node tools/test-k7-s0.mjs
import { db, env, mail, call, admin, as, check, done, onboard } from './_harness.mjs';
import { buildXlsx } from '../src/xlsx.js';
import { readReturnedSheet, codeOf } from '../src/s0.js';
import { readSheet } from '../src/template-preview.js';
import { rfiForm } from './fixtures/word-forms.mjs';

const b64 = (u8) => Buffer.from(u8).toString('base64');
const status = (ref) => (db.prepare('SELECT status FROM records WHERE ref = ?').get(ref) || {}).status;
const today = new Date(Date.now() + 4 * 3600000).toISOString().slice(0, 10);

console.log('— codes —');
check('codes are read from what DC picks or types', codeOf('Code B — Approved as noted') === 'B' && codeOf('C') === 'C' && codeOf('Rejected') === 'D' && codeOf('Answered / noted') === 'answered' && codeOf('Z') === null);

console.log('\n— raised, returned, resubmitted, approved —');
const { pid } = await onboard('Tower S0', 'TS0-0001', [['The Designer', 'design@ts0.test', ['design']], ['The PM', 'pm@ts0.test', ['pm']], ['The DC', 'dc@ts0.test', ['dc']]]);
const designer = db.prepare("SELECT id FROM users WHERE email = 'design@ts0.test'").get().id;
await as('dc@ts0.test');
await call('/api/templates/upload', { doc_type: 'submittal', filename: 'Submittal form.docx', file_b64: b64(rfiForm()) });
await as('design@ts0.test');
let r = await call('/api/records', { type: 'submittal', title: 'Rebar shop drawings L3', data: { Subject: 'Rebar shop drawings L3', Discipline: 'Structural' } });
const S1 = r.json.ref;
check('Design raises it: “Prepared”, and who raised it is kept', r.status === 200 && status(S1) === 'Prepared' && db.prepare('SELECT originator_id FROM records WHERE ref = ?').get(S1).originator_id === designer, status(S1));
await as('pm@ts0.test');
r = await call('/api/record/advance', { ref: S1, action: 'reject' });
check('the PM cannot send it back without saying why', r.status === 400 && /say what Design must change/.test(r.json.error), r.text);
r = await call('/api/record/advance', { ref: S1, action: 'reject', note: 'Show lap lengths on every sheet' });
check('returned with the comment: “Returned to Design”', r.status === 200 && status(S1) === 'Returned to Design');
r = await call('/api/record/advance', { ref: S1, action: 'advance' });
check('the PM cannot approve what is with Design', r.status === 409 && /returned to Design/.test(r.json.error), r.text);
await as('design@ts0.test');
r = await call('/api/attention');
check('it is in the designer’s Needs my attention', (r.json.items || []).some((i) => i.ref === S1 && /Returned to Design/.test(i.need)), r.text.slice(0, 300));
r = await call('/api/s0/resubmit', { ref: S1, note: '' });
check('a resubmission says what changed', r.status === 400);
r = await call('/api/s0/resubmit', { ref: S1, note: 'Lap lengths added to all sheets' });
check('Design resubmits: back to “Prepared”', r.status === 200 && status(S1) === 'Prepared');
await as('pm@ts0.test');
r = await call('/api/record/advance', { ref: S1, action: 'advance' });
check('the PM approves: “Approved internally”', r.status === 200 && status(S1) === 'Approved internally', r.text);

console.log('\n— issued by email —');
r = await call('/api/s0/issue', { ref: S1, to: 'consultant@eng.test' });
check('the PM does not issue it — Document Control does', r.status === 403, r.status);
await as('design@ts0.test');
await call('/api/attachment', { ref: S1, filename: 'Rebar sheets.pdf', mime: 'application/pdf', file_b64: b64(new TextEncoder().encode('%PDF-1.4 rebar')) });
await call('/api/attachment', { ref: S1, filename: 'Huge scan.pdf', mime: 'application/pdf', file_b64: b64(new Uint8Array(7.5 * 1024 * 1024)) });
await as('dc@ts0.test');
r = await call('/api/s0/issue-list', { to: 'consultant@eng.test', cc: 'qs@contractor.test, not-an-address' });
check('the project’s To / Cc refuse a non-address', r.status === 400 && /not-an-address/.test(r.json.error));
r = await call('/api/s0/issue-list', { to: 'consultant@eng.test', cc: 'qs@contractor.test' });
check('and keep good ones', r.status === 200 && r.json.cc[0] === 'qs@contractor.test');
r = await call('/api/s0?ref=' + encodeURIComponent(S1));
const atts = r.json.attachments;
check('the desk offers the issue to DC, with the list and the files', r.json.may.issue && r.json.issue_list.to[0] === 'consultant@eng.test' && atts.length === 2);
const small = atts.find((a) => /Rebar/.test(a.filename)).id, huge = atts.find((a) => /Huge/.test(a.filename)).id;
r = await call('/api/s0/issue', { ref: S1, attachments: [small, huge] });
check('over the size an email can carry: refused, nothing marked issued', r.status === 413 && /7 MB/.test(r.json.error) && status(S1) === 'Approved internally', r.text.slice(0, 200));
const key = env.RESEND_KEY; delete env.RESEND_KEY;
r = await call('/api/s0/issue', { ref: S1, attachments: [small] });
check('with email off it says so, and offers issuing by hand', r.status === 400 && r.json.email_off === true);
env.RESEND_KEY = key;
const m0 = mail.length;
r = await call('/api/s0/issue', { ref: S1, cc: 'qs@contractor.test, pm@ts0.test', attachments: [small] });
const sent = mail.slice(m0)[0];
check('issued by email', r.status === 200 && !!sent, r.text.slice(0, 200));
check('to the consultant, Cc as edited on the issue', JSON.stringify(sent.to) === '["consultant@eng.test"]' && JSON.stringify(sent.cc) === '["qs@contractor.test","pm@ts0.test"]');
check('from the platform address with DC’s name, replies to DC', /^The DC \(Document Control\) via AETRAA </.test(sent.from) && sent.reply_to === 'dc@ts0.test', [sent.from, sent.reply_to]);
check('with the consultant’s form filled, and the chosen file', (sent.attachments || []).map((a) => a.filename).join('|') === S1 + '.docx|Rebar sheets.pdf', (sent.attachments || []).map((a) => a.filename));
check('“Issued for approval” with the date, and the reply-by clock running', status(S1) === 'Issued for approval ' + today && !!db.prepare('SELECT due FROM records WHERE ref = ?').get(S1).due);

console.log('\n— the reply, read from the returned form (E14) —');
const returned = (code, ref, date) => buildXlsx([{ name: 'Form', rows: [
  ['SHOP DRAWING SUBMITTAL'], ['Submittal No:', ref], ['Subject:', 'Rebar shop drawings L3'], [],
  ['CONSULTANT’S RESPONSE'], [code === 'A' ? 'X' : '', 'Code A - Approved'], [code === 'B' ? 'X' : '', 'Code B - Approved as noted'],
  [code === 'C' ? '✓' : '', 'Code C - Revise & resubmit'], [code === 'D' ? 'X' : '', 'Code D - Rejected'],
  ['Date:', date], ['Comments:', '1. Lap lengths to be 50d\n2. Show bar marks on section B-B']] }]);
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const form = returned('C', S1, Number(today.slice(8, 10)) + '-' + MON[Number(today.slice(5, 7)) - 1] + '-' + today.slice(0, 4));
const p1 = readReturnedSheet(readSheet(form), { ref: S1 });
const p2 = readReturnedSheet(readSheet(form), { ref: S1 });
check('the ticked code, the date, the comments and the reference are read', p1.code === 'C' && p1.replied_on === today && p1.comments.length === 2 && p1.ref_ok, p1);
check('the same form reads the same way twice', JSON.stringify(p1) === JSON.stringify(p2));
const two = readReturnedSheet(readSheet(buildXlsx([{ name: 'F', rows: [['CONSULTANT’S RESPONSE'], ['X', 'Code A - Approved'], ['X', 'Code B - Approved as noted']] }])), { ref: S1 });
check('two codes ticked are not guessed', two.code === null && two.read.some((x) => /more than one code/.test(x.why)));
await as('dc@ts0.test');
r = await call('/api/s0/read-reply', { ref: S1, filename: 'Reply SUB.xlsx', data: b64(returned('C', 'SUB-999', '01/01/2026')) });
check('a returned form for another submittal is refused (and kept on the record)', r.status === 409 && /SUB-999/.test(r.json.error));
r = await call('/api/s0/read-reply', { ref: S1, filename: 'Reply.xlsx', data: b64(form) });
const P = r.json;
check('DC uploads the reply: a proposal, kept against its hash', r.status === 200 && P.proposal.code === 'C' && /^[0-9a-f]{64}$/.test(P.sha256), r.text.slice(0, 300));
r = await call('/api/s0/reply', { ref: S1, code: 'Z', replied_on: today, comments: [] });
check('a code that is not A–D is refused', r.status === 400 && /A, B, C or D/.test(r.json.error));
r = await call('/api/s0/reply', { ref: S1, code: 'C', replied_on: today, comments: [] });
check('a Code C needs its comments', r.status === 400 && /comments/.test(r.json.error));
const m1 = mail.length;
r = await call('/api/s0/reply', { ref: S1, code: P.proposal.code, replied_on: P.proposal.replied_on || today, comments: P.proposal.comments, attachment_id: P.attachment_id, read_id: P.read_id });
const REV = S1 + ' Rev 1';
check('Code C recorded; the next revision opened', r.status === 200 && r.json.code === 'C' && r.json.revision === REV && status(S1) === 'Code C — Revise & resubmit', r.text.slice(0, 300));
check('the proposal and DC’s confirmation are both kept', !!db.prepare('SELECT confirmed FROM reply_reads WHERE id = ?').get(P.read_id).confirmed);
const told = mail.slice(m1)[0];
check('the reply goes to the originator, the PM and the Cc list, with the reply attached', told && told.to.includes('design@ts0.test') && told.to.includes('pm@ts0.test') && (told.cc || []).includes('qs@contractor.test') && (told.attachments || [])[0].filename === 'Reply.xlsx', told && [told.to, told.cc]);
const rev = db.prepare('SELECT * FROM records WHERE ref = ?').get(REV);
check('Rev 1 has the same number, links back, and keeps the originator', rev && rev.no === db.prepare('SELECT no FROM records WHERE ref = ?').get(S1).no && rev.revision_of === S1 && rev.originator_id === designer && Number(rev.rev) === 1);
const cms = db.prepare("SELECT * FROM record_comments WHERE ref = ? AND state = 'open'").all(REV);
check('its checklist is the consultant’s two comments', cms.length === 2 && /Lap lengths/.test(cms[0].text));

console.log('\n— the PM is held until every comment is answered —');
await as('pm@ts0.test');
r = await call('/api/record/advance', { ref: REV, action: 'advance' });
check('the PM cannot approve Rev 1 yet', r.status === 409 && r.json.open_comments === 2, r.text);
await as('design@ts0.test');
r = await call('/api/attention');
check('the comments are the designer’s to-do', (r.json.items || []).some((i) => i.ref === REV && /2 consultant comments/.test(i.need)));
r = await call('/api/s0/answer', { ref: REV, id: cms[0].id, answer: '' });
check('an answer needs words', r.status === 400);
await call('/api/s0/answer', { ref: REV, id: cms[0].id, answer: 'Laps revised to 50d on all sheets' });
r = await call('/api/s0/answer', { ref: REV, id: cms[1].id, answer: 'Section B-B is not on these sheets', not_applicable: true });
check('every comment answered (one does not apply)', r.status === 200 && r.json.open === 0);
await as('pm@ts0.test');
r = await call('/api/record/advance', { ref: REV, action: 'advance' });
check('then the PM approves it', r.status === 200 && status(REV) === 'Approved internally', r.text);
await as('dc@ts0.test');
r = await call('/api/s0/issue', { ref: REV, outside: true, note: '' });
check('issued by hand needs to say how', r.status === 400);
r = await call('/api/s0/issue', { ref: REV, outside: true, note: 'Hand-delivered with transmittal T-014' });
check('issued by hand, recorded with the date', r.status === 200 && status(REV) === 'Issued for approval ' + today);
r = await call('/api/s0/reply', { ref: REV, code: 'B', replied_on: today, comments: ['Note the cover to links'] });
check('Code B: closed, its comment kept, no new revision', r.status === 200 && r.json.code === 'B' && !r.json.revision && db.prepare("SELECT state FROM record_comments WHERE ref = ?").all(REV).some((c) => c.state === 'kept'));

console.log('\n— Code D, an RFI, and the tracker —');
await as('design@ts0.test');
const S2 = (await call('/api/records', { type: 'submittal', title: 'Waterproofing', data: { Subject: 'Waterproofing' } })).json.ref;
await as('pm@ts0.test'); await call('/api/record/advance', { ref: S2, action: 'advance' });
await as('dc@ts0.test'); await call('/api/record/advance', { ref: S2, action: 'advance' });
check('the drawer’s Issue button records it as issued by hand', status(S2) === 'Issued for approval ' + today);
r = await call('/api/s0/reply', { ref: S2, code: 'D', replied_on: today, comments: ['Product not to specification'] });
check('Code D also opens the next revision (S0 step 6)', r.status === 200 && r.json.revision === S2 + ' Rev 1');
await as('design@ts0.test');
const R1 = (await call('/api/records', { type: 'rfi', title: 'Slab edge', data: { Subject: 'Slab edge' } })).json.ref;
await as('pm@ts0.test'); await call('/api/record/advance', { ref: R1, action: 'advance' });
await as('dc@ts0.test'); await call('/api/record/advance', { ref: R1, action: 'advance' });
r = await call('/api/record/advance', { ref: R1, action: 'advance', status: 'Answered / noted' });
check('an RFI is “Answered”, from the drawer as before', r.status === 200 && status(R1) === 'Answered', r.text);
r = await call('/api/register/xlsx?reg=submittals');
const x = new TextDecoder().decode(r.bytes);
check('the tracker export carries the S0 status', x.includes('Code C — Revise &amp; resubmit') && x.includes('Code B — Approved as noted'));
r = await call('/s0?ref=' + encodeURIComponent(S1));
check('the submittal desk page opens', r.status === 200 && r.text.includes('Submittal desk'));
done();
