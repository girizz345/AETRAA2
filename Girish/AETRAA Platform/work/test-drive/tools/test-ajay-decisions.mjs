// What Ajay approved on 6 Oct 2026 (AETRAA-Decisions-for-Ajay.pdf, all "yes"),
// item by item, as each is built.
//   node tools/test-ajay-decisions.mjs
import { db, env, call, admin, as, check, done, onboard, mail, xlsxText, bulkOn } from './_harness.mjs';
import { unzipSync, strFromU8 } from 'fflate';
import { modelForTask } from '../src/ai.js';
import { createCanvas } from '@napi-rs/canvas';
import { PDFDocument, StandardFonts, PDFName, PDFHexString } from 'pdf-lib';
import { pdfText } from '../src/pdf-text.js';
import { ensureIndexTables } from '../src/project-index.js';
import { noticePeriod } from '../src/delays.js';
import { buildMsg } from './fixtures/msg-file.mjs';

// A fake model: answers the title-block reader (A1) with SHEET.
let SHEET = null, PHOTO = null, OBL = null, DEV = null;
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  if (String(url).startsWith('https://api.anthropic.com/v1/messages')) {
    const body = JSON.parse(init.body);
    const sys = String(body.system || '');
    const answer = /site photographs/.test(sys) ? PHOTO : /clause by clause/.test(sys) ? OBL : /TENDER issue/.test(sys) ? DEV : SHEET;
    return new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(answer) }], usage: { input_tokens: 300, output_tokens: 60 } }),
      { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
  return realFetch(url, init);
};

const today = new Date(Date.now() + 4 * 3600000).toISOString().slice(0, 10);
const { pid } = await onboard('Decision Tower', 'DT-01', [
  ['Dana DC', 'dc@dt.test', ['dc']], ['Pat PM', 'pm@dt.test', ['pm']], ['Sam Site', 'site@dt.test', ['site']],
  ['Quinn QA', 'qa@dt.test', ['qaqc']], ['Ash Assigned', 'ash@dt.test', ['site']], ['Dee DC2', 'dc2@dt.test', ['dc']],
  ['Quincy QS', 'qs@dt.test', ['commercial']]]);
// Spec §25: these tests have Document Control drop folders, so bulk loading is switched on for the project.
await bulkOn(pid);
let r;

console.log('\n— 6: RFIs on the bigger model —');
check('with Claude, RFI drafting uses Opus', modelForTask({}, 'a10-rfi', 'claude-sonnet-5-5', 'anthropic') === 'claude-opus-5-5');
check('on the subscription too', modelForTask({}, 'a10-rfi', 'claude-sonnet-5-5', 'subscription') === 'claude-opus-5-5');
check('a self-hosted model is left alone', modelForTask({}, 'a10-rfi', 'local-model', 'openai') === 'local-model');
check('AI_TASK_MODELS still overrides it', modelForTask({ AI_TASK_MODELS: 'a10-rfi=claude-sonnet-5-5' }, 'a10-rfi', 'x', 'anthropic') === 'claude-sonnet-5-5');
check('other tasks keep AI_MODEL', modelForTask({}, 'a1-sheet', 'claude-sonnet-5-5', 'anthropic') === 'claude-sonnet-5-5');

console.log('\n— 11: only DC and the person the PM assigns save the diary —');
const save = (extra) => call('/api/diary', { report_date: today, weather: 'Sunny', prepared_by: 'x', staff: [{ t: 'Engineer', n: 2, h: '8' }], ...(extra || {}) });
await as('site@dt.test');
r = await save();
check('a site engineer cannot save it', r.status === 403 && /Document Control or the person the Project Manager assigns/.test(r.json.error), r.text);
r = await call('/api/diary?date=' + today);
check('and is not offered Save', r.json.a12 && r.json.a12.may_save === false);
await as('dc@dt.test');
r = await save();
check('Document Control saves it', r.status === 200, r.text);
await as('pm@dt.test');
r = await save();
check('the PM does not save it', r.status === 403);
r = await call('/api/diary/assignee', { user_id: db.prepare("SELECT id FROM users WHERE email = 'ash@dt.test'").get().id });
check('the PM assigns Ash', r.status === 200, r.text);
r = await save({ submit: true });
check('the PM submits it', r.status === 200, r.text);
await as('ash@dt.test');
r = await call('/api/diary?date=' + today);
check('the assigned person is offered Save', r.json.a12.may_save === true);
r = await save({ report_date: '2026-09-01' });
check('and saves it', r.status === 200, r.text);

console.log('\n— 12: no works section —');
await as('dc@dt.test');
r = await call('/diary');
check('the diary screen has no Description of works', r.status === 200 && !/Description of works/.test(r.text) && r.text.includes('Expected works tomorrow'));
db.prepare("UPDATE diary SET works = ? WHERE project_id = ? AND report_date = ?").run(JSON.stringify([{ a: 'Old works line', q: '3' }]), pid, today);
r = await call('/diary/doc?date=' + today);
check('nor the printed sheet', r.status === 200 && !/DESCRIPTION OF WORKS/.test(r.text) && !/Old works line/.test(r.text) && /EXPECTED WORKS TOMORROW/.test(r.text));
r = await call('/diary/docx?date=' + today);
const docXml = strFromU8(unzipSync(r.bytes)['word/document.xml']);
check('nor the Word copy', !/DESCRIPTION OF WORKS/.test(docXml) && /EXPECTED WORKS TOMORROW/.test(docXml));
check('an old diary keeps its works lines in the record', /Old works line/.test(db.prepare('SELECT works FROM diary WHERE project_id = ? AND report_date = ?').get(pid, today).works));

console.log('\n— 13: a DC continues their own drop —');
r = await call('/api/intake/batch', {});
const B = r.json.id;
r = await call('/api/intake/batch?id=' + B);
check('the drop is marked as theirs', r.json.mine === true);
await as('dc2@dt.test');
r = await call('/api/intake/batch', {});
check('another drop on the project is refused, naming the open one', r.status === 409 && r.json.open_batch === B, r.text);
r = await call('/api/intake/batch?id=' + B);
check('and it is not theirs to continue', r.json.mine === false);
await admin();
r = await call('/files');
check('the Document control page offers to continue or abandon', r.text.includes('offerContinue') && r.text.includes('/api/intake/abandon'));

console.log('\n— 9: Document Control records the Engineer’s inspection result —');
await as('qa@dt.test');
r = await call('/api/records', { type: 'wir', title: 'Level 3 slab rebar', data: { Description: 'Level 3 slab rebar' } });
check('QA/QC raises a WIR', r.status === 200, r.text.slice(0, 200));
const W = r.json.ref;
const steps = r.json.record.workflow.map((s) => s.st + ':' + s.by.join('/'));
check('its last step is Document Control’s', /Inspection result recorded by Document Control:dc$/.test(steps[steps.length - 1]), steps);
r = await call('/api/record/advance', { ref: W, action: 'advance' });
check('QA/QC checks the work is ready', r.status === 200, r.text.slice(0, 200));
await as('dc@dt.test');
r = await call('/api/s0?ref=' + W);
check('the WIR is on the submittal desk for DC to issue', r.status === 200 && r.json.may.issue === true, r.text.slice(0, 200));
r = await call('/api/s0/issue', { ref: W, outside: true, note: 'Handed to the Engineer on site' });
check('DC issues it', r.status === 200, r.text.slice(0, 200));
await as('qa@dt.test');
r = await call('/api/s0/reply', { ref: W, code: 'A', replied_on: today, comments: [] });
check('QA/QC no longer records the result', r.status === 403, r.status + ' ' + r.text.slice(0, 120));
await as('dc@dt.test');
r = await call('/api/s0?ref=' + W);
check('DC is offered to record it (and to read a scanned one with AI)', r.json.may.reply === true);
r = await call('/api/s0/reply', { ref: W, code: 'B', replied_on: today, comments: ['Cover blocks at bay 4'] });
check('DC records the result', r.status === 200, r.text.slice(0, 200));

console.log('\n— 8: the consultant’s actions, into our tracker once DC confirms —');
const pmId = db.prepare("SELECT id FROM users WHERE email = 'pm@dt.test'").get().id;
await as('dc@dt.test');
r = await call('/api/meeting/consultant/record', { type: 'progress', title: 'Progress meeting 7 (Engineer)', meeting_date: today, their_ref: 'ENG-MOM-07',
  attendees: [{ name: 'Engineer Rep', company: 'Dar Consult', present: true }],
  items: [{ no: '1', subject: 'Facade', discussion: 'Mock-up', decision: '', actions: [
    { text: 'Submit the revised facade mock-up', owner_name: 'Contractor PM', due: '', suggested_owner_user_id: pmId },
    { text: 'Engineer to confirm the colour', owner_name: 'Engineer', due: '' }] }] });
check('DC records the consultant’s minutes', r.status === 200 && r.json.status === 'recorded', r.text.slice(0, 200));
const CM = r.json.ref;
r = await call('/api/meeting?ref=' + CM);
check('their actions stay text, with the reading’s suggested owner kept', r.json.meeting.items[0].actions[0].suggested_owner_user_id === pmId && !r.json.meeting.items[0].actions[0].owner_user_id);
check('nothing is in our tracker yet', db.prepare('SELECT COUNT(*) AS n FROM actions WHERE project_id = ?').get(pid).n === 0);
await as('qa@dt.test');
r = await call('/api/meeting/consultant/track', { ref: CM, actions: [{ item_no: '1', index: 0, owner_user_id: pmId, due: '2026-12-01' }] });
check('QA/QC cannot add them to the tracker', r.status === 403);
await as('dc@dt.test');
r = await call('/api/meeting/consultant/track', { ref: CM, actions: [{ item_no: '1', index: 0, owner_user_id: pmId }] });
check('an action needs a date', r.json.created.length === 0 && /give it a date/.test(r.json.errors[0]), r.text);
r = await call('/api/meeting/consultant/track', { ref: CM, actions: [{ item_no: '1', index: 0, owner_user_id: pmId, due: '2026-12-01' }, { item_no: '1', index: 1, owner_name: 'Engineer (Dar Consult)', due: '2026-11-20' }] });
check('DC confirms two into our tracker', r.status === 200 && r.json.created.length === 2 && r.json.created[0].ref === 'AI-001', r.text.slice(0, 200));
const act = db.prepare("SELECT * FROM actions WHERE project_id = ? AND ref = 'AI-001'").get(pid);
check('owned by the PM, dated, and saying where it came from', act.owner_user_id === pmId && act.due === '2026-12-01' && /consultant’s minutes .*ENG-MOM-07.*confirmed by Dana DC/.test(act.history), act.history);
r = await call('/api/meeting/consultant/track', { ref: CM, actions: [{ item_no: '1', index: 0, owner_user_id: pmId, due: '2026-12-01' }] });
check('an action is added once', r.json.created.length === 0 && /already in the tracker as AI-001/.test(r.json.errors[0]));
r = await call('/api/meeting?ref=' + CM);
check('the minute shows where each went', r.json.meeting.items[0].actions.map((a) => a.tracked_ref).join() === 'AI-001,AI-002');

console.log('\n— 16: outside attendees, and the minutes sent to them —');
const mailBefore = mail.length;
r = await call('/api/meeting', { type: 'progress', title: 'Progress meeting 8', meeting_date: today,
  attendees: [{ name: 'Dana DC', company: 'Contractor', present: true }, { name: 'Eng Rep', company: 'Dar Consult', email: 'Rep@Dar.test', present: true },
    { name: 'Client Rep', company: 'Owner LLC', email: 'not an email', present: true }],
  items: [{ subject: 'Programme', discussion: 'Look-ahead', decision: 'Agreed', actions: [{ text: 'Update the look-ahead', owner_user_id: pmId, due: '2026-12-15' }] }] });
check('minutes saved with an outside attendee’s email', r.status === 200 && r.json.meeting.attendees[1].email === 'rep@dar.test' && !r.json.meeting.attendees[2].email, r.text.slice(0, 200));
const M8 = r.json.ref;
r = await call('/api/meetings');
check('the outside contact is kept for next time', (r.json.contacts || []).some((c) => c.email === 'rep@dar.test' && c.company === 'Dar Consult'), r.json.contacts);
r = await call('/api/meeting/send', { ref: M8 });
check('draft minutes are not sent', r.status === 400 && /Issue the minutes first/.test(r.json.error));
r = await call('/api/meeting/issue', { ref: M8 });
check('DC issues them', r.status === 200, r.text.slice(0, 200));
r = await call('/api/meeting/send', { ref: M8 });
const sentM = mail.slice(mailBefore).find((x) => /minutes/.test(x.subject || '') && (x.to || []).includes('rep@dar.test'));
check('and sends them to the outside attendee', r.status === 200 && r.json.to.length === 1 && !!sentM, r.text.slice(0, 200));
check('with the minutes attached', sentM && (sentM.attachments || []).length === 1 && /PRG-\d+ minutes\.doc/.test(sentM.attachments[0].filename), sentM && sentM.attachments);
check('and the sending is kept on the minute', db.prepare('SELECT sent_log FROM meetings WHERE project_id = ? AND ref = ?').get(pid, M8).sent_log.includes('rep@dar.test'));
await as('qa@dt.test');
r = await call('/api/meeting/send', { ref: M8 });
check('QA/QC does not send minutes', r.status === 403);

console.log('\n— 3: a scan whose title block states another project is held —');
const scan = async (label) => {
  const cv = createCanvas(1192, 842); const g = cv.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, 1192, 842); g.fillStyle = '#000'; g.font = '16px sans-serif'; g.fillText(label, 965, 610);
  const pdf = await PDFDocument.create({ updateMetadata: false });
  pdf.addPage([2384, 1684]).drawImage(await pdf.embedPng(await cv.encode('png')), { x: 0, y: 0, width: 2384, height: 1684 });
  return 'data:application/pdf;base64,' + Buffer.from(await pdf.save({ useObjectStreams: false })).toString('base64');
};
await admin();
r = await call('/api/project', { action: 'identity', id: pid, plot_numbers: '4210529' });
check('the project’s plot number is set', r.status === 200, r.text.slice(0, 160));
await as('dc@dt.test');
const up = async (n) => (await call('/api/drawing', { number: n, kind: 'ifc', filename: n + '.pdf', data: await scan(n) })).json;
const D1 = (await up('A1-301')).id, D2 = (await up('A1-302')).id, D3 = (await up('A1-303')).id, D4 = (await up('A1-304')).id;
check('DC uploads four scanned sheets, each waiting for the PM', [D1, D2, D3, D4].every(Boolean) && db.prepare("SELECT COUNT(*) AS n FROM drawings WHERE project_id = ? AND status = 'pending'").get(pid).n >= 4);
env.ANTHROPIC_API_KEY = 'test-key';
const sheetSays = (project, sure) => { SHEET = { number: { value: 'A1-301', sure: 'high' }, revision: { value: 'A', sure: 'high' }, title: { value: 'PLAN', sure: 'high' },
  date: { value: '', sure: 'low' }, discipline: { value: '', sure: 'low' }, project: { value: project, sure } }; };
sheetSays('RESIDENTIAL TOWER, PLOT No. 3345120', 'high');
r = await call('/api/ai/sheet', { drawing_id: D1 });
check('a title block stating another plot is held for AETRAA', r.status === 200 && r.json.held && /plot 3345120; this project is plot 4210529/.test(r.json.held.reason), r.text.slice(0, 300));
check('the sheet leaves the PM’s approval list', db.prepare('SELECT status FROM drawings WHERE id = ?').get(D1).status === 'held');
const q1 = db.prepare("SELECT * FROM quarantine WHERE project_id = ? AND payload LIKE ?").get(pid, '%' + D1 + '%');
check('and is on the held list, saying the AI read it', q1 && q1.status === 'held' && /read by AI, high/.test(q1.reason), q1);
r = await call('/api/ai/sheet', { drawing_id: D1 });
check('a held sheet is not read again', r.status === 400 && /held for AETRAA/.test(r.json.error), r.text);
sheetSays('RESIDENTIAL TOWER, PLOT No. 4210529', 'high');
r = await call('/api/ai/sheet', { drawing_id: D2 });
check('this project’s own plot is not held', r.status === 200 && !r.json.held && r.json.project_check && r.json.project_check.holds === false);
sheetSays('PLOT 3345120', 'low');
r = await call('/api/ai/sheet', { drawing_id: D3 });
check('a barely legible reading is flagged, not held', r.status === 200 && !r.json.held && r.json.project_check.reason && db.prepare('SELECT status FROM drawings WHERE id = ?').get(D3).status === 'pending');
sheetSays('PLOT 9000001', 'medium');
r = await call('/api/ai/sheet', { drawing_id: D4 });
check('another one held', !!r.json.held);
await admin();
r = await call('/api/quarantine/decide', { ids: [q1.id], action: 'approve' });
check('AETRAA releases the first: back to the PM', r.status === 200 && db.prepare('SELECT status FROM drawings WHERE id = ?').get(D1).status === 'pending', r.text.slice(0, 200));
const q4 = db.prepare("SELECT id FROM quarantine WHERE project_id = ? AND payload LIKE ?").get(pid, '%' + D4 + '%').id;
r = await call('/api/quarantine/decide', { ids: [q4], action: 'reject', note: 'This is the Al Barsha tower set' });
const d4 = db.prepare('SELECT status, reject_note FROM drawings WHERE id = ?').get(D4);
check('and rejects the other: sent back with the reason', r.status === 200 && d4.status === 'rejected' && /Al Barsha/.test(d4.reject_note), d4);
delete env.ANTHROPIC_API_KEY;

console.log('\n— 15: Outlook .msg letters are read —');
await as('dc@dt.test');
const msg = buildMsg({ subject: 'RE: Slab edge detail at grid C', body: 'Dear Sirs,\nOur Ref: DAR/ENG/0457\nWe refer to ' + W + ' and confirm detail 4.\nRegards',
  senderName: 'Eng Rep', senderEmail: 'rep@dar.test', to: 'Dana DC', sent: new Date('2026-09-16T06:00:00Z') });
r = await call('/api/letters/read', { filename: 'Engineer reply.msg', data: Buffer.from(msg).toString('base64') });
check('a .msg is read like an .eml', r.status === 200 && r.json.format === 'msg' && !/kept but not read/.test(r.json.why || ''), r.text.slice(0, 300));
check('sender, subject, date and their reference, by rule', r.json.draft.From.value === 'Eng Rep' && r.json.draft.Subject.value === 'Slab edge detail at grid C'
  && r.json.draft['Letter date'].value === '2026-09-16' && r.json.draft['Their reference'].value === 'DAR/ENG/0457', r.json.draft);
check('and the records it names are linked', (r.json.refs.linked || []).some((x) => x.ref === W), r.json.refs);
const big = buildMsg({ subject: 'Long email', ansiSubject: true, body: 'Line of text. '.repeat(400) + 'Our Ref: LONG/77', senderEmail: 'x@client.test' });
r = await call('/api/letters/read', { filename: 'long.msg', data: Buffer.from(big).toString('base64') });
check('a long one (body outside the mini stream, 8-bit subject) too', r.status === 200 && r.json.draft.Subject.value === 'Long email' && r.json.draft['Their reference'].value === 'LONG/77', r.json.draft);
r = await call('/api/letters/read', { filename: 'broken.msg', data: Buffer.from('not a compound file at all, just text that pretends').toString('base64') });
check('a .msg that cannot be opened is kept, saying so', r.status === 200 && /could not be opened/.test(r.json.why), r.text.slice(0, 200));

console.log('\n— 2: diary photos captioned and tagged by AI, confirmed by a person —');
db.prepare("INSERT INTO activities (project_id, id, name, level, planned_start, planned_finish, floor, trade) VALUES (?, 'A100', 'Level 3 slab rebar', 1, ?, ?, 'L3', 'Rebar')").run(pid, today, today);
db.prepare("INSERT INTO activities (project_id, id, name, level, planned_start, planned_finish) VALUES (?, 'A900', 'Landscaping', 1, '2028-01-01', '2028-02-01')").run(pid);
const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
await as('site@dt.test');
const P1 = (await call('/api/photo', { data: png, report_date: today, caption: 'L3 slab' })).json.id;
const P2 = (await call('/api/photo', { data: png, report_date: today })).json.id;
check('site uploads two photos', !!P1 && !!P2);
await as('dc@dt.test');
r = await call('/api/diary/photos?date=' + today);
check('the diary lists the day’s photos and the live activities only', r.json.photos.length === 2 && r.json.activities.some((a) => a.id === 'A100') && !r.json.activities.some((a) => a.id === 'A900') && r.json.may.confirm === true, r.text.slice(0, 300));
r = await call('/api/diary/photos/suggest', { date: today });
check('with AI off, nothing is suggested', r.status === 400 && r.json.disabled);
env.ANTHROPIC_API_KEY = 'test-key';
PHOTO = { caption: 'Rebar fixing to level 3 slab', activity_id: 'A100', location: 'Level 3, grid C', sure: 'high' };
r = await call('/api/diary/photos/suggest', { date: today, limit: 1 });
check('the AI suggests for one photo', r.status === 200 && r.json.read === 1 && r.json.remaining === 1, r.text.slice(0, 200));
PHOTO = { caption: 'Landscaping works', activity_id: 'A900', location: '', sure: 'high' };
r = await call('/api/diary/photos/suggest', { date: today });
check('an activity not live around the day is dropped', r.json.results[0].activity_id === '' && r.json.results[0].dropped === 'A900' && r.json.results[0].sure === 'low', r.json.results);
const ph1 = db.prepare('SELECT * FROM photos WHERE id = ?').get(P1);
check('nothing reaches the photo yet: its caption, activity and location are untouched', ph1.caption === 'L3 slab' && !ph1.activity_id && !ph1.location && ph1.ai_caption === 'Rebar fixing to level 3 slab' && ph1.ai_state === 'proposed', ph1);
await as('site@dt.test');
r = await call('/api/diary/photos/confirm', { id: P1, caption: 'x', activity_id: 'A100' });
check('a site engineer does not confirm captions', r.status === 403);
await as('dc@dt.test');
r = await call('/api/diary/photos/confirm', { id: P1, caption: 'Rebar fixing to level 3 slab', activity_id: 'ZZZ' });
check('an activity not on the programme is refused', r.status === 400 && /not an activity/.test(r.json.error));
r = await call('/api/diary/photos/confirm', { id: P1, caption: 'Rebar fixing to level 3 slab', activity_id: 'A100', location: 'Level 3, grid C-D' });
const ph1b = db.prepare('SELECT * FROM photos WHERE id = ?').get(P1);
check('DC confirms, correcting the location', r.status === 200 && ph1b.caption === 'Rebar fixing to level 3 slab' && ph1b.activity_id === 'A100' && ph1b.location === 'Level 3, grid C-D' && ph1b.confirmed_by === 'Dana DC', ph1b);
r = await call('/api/diary/photos/confirm', { id: P2, reject: true });
check('and sets the other suggestion aside', r.status === 200 && db.prepare('SELECT ai_state FROM photos WHERE id = ?').get(P2).ai_state === 'rejected');
r = await call('/diary/doc?date=' + today);
check('the printed photo page carries the activity and location', /Activity: Level 3 slab rebar/.test(r.text) && /Location: Level 3, grid C-D/.test(r.text));
delete env.ANTHROPIC_API_KEY;

console.log('\n— 14: PDF reference forms —');
const fillable = async () => {
  const d = await PDFDocument.create(); const pg = d.addPage([595, 842]); const f = await d.embedFont(StandardFonts.Helvetica);
  pg.drawText('WORK INSPECTION REQUEST', { x: 50, y: 800, size: 14, font: f });
  const form = d.getForm();
  const add = (name, y, h, tip) => { const t = form.createTextField(name); t.addToPage(pg, { x: 160, y, width: 300, height: h || 16 }); if (tip) t.acroField.dict.set(PDFName.of('TU'), PDFHexString.fromText(tip)); };
  add('loc', 700, 16, 'Location'); add('Inspection_Description', 670); add('Raised_Signature', 560, 28); add('QA_Signature', 520, 28);
  return d.save();
};
await as('dc@dt.test');
r = await call('/api/templates/upload', { doc_type: 'wir', filename: 'Engineer WIR.pdf', file_b64: Buffer.from(await fillable()).toString('base64') });
check('DC uploads the consultant’s fillable PDF WIR form', r.status === 200 && r.json.format === 'pdf' && r.json.extractor === 'e16-pdf-1', r.text.slice(0, 300));
check('its fields read, the tooltip as the label', r.json.fields.map((f) => f.label).join('|') === 'Location|Inspection Description', r.json.fields);
check('its two signature boxes given to the first two steps', JSON.stringify(r.json.signs) === '["Raised_Signature","QA_Signature"]'
  && JSON.parse(db.prepare("SELECT sign_map FROM templates WHERE project_id = ? AND doc_type = 'wir'").get(pid).sign_map).steps[1] === 'QA_Signature');
await as('qa@dt.test');
r = await call('/api/template/form?type=wir');
check('raising a WIR asks for the form’s fields', r.status === 200 && JSON.stringify(r.json).includes('Inspection Description'), r.text.slice(0, 200));
r = await call('/api/records', { type: 'wir', title: 'Level 4 columns', data: { Location: 'Level 4, grid B', 'Inspection Description': 'Column rebar before casting' } });
const W2 = r.json.ref;
await call('/api/record/advance', { ref: W2, action: 'advance' });
r = await call('/api/record/doc?ref=' + encodeURIComponent(W2));
check('the issued document is the PDF form', r.status === 200 && /application\/pdf/.test(r.headers.get('content-type')) && /\.pdf"/.test(r.headers.get('content-disposition')), r.status + ' ' + r.text.slice(0, 120));
const issuedText = await pdfText(r.bytes);
check('filled with the values and every signature so far', /Level 4, grid B/.test(issuedText) && /Column rebar before casting/.test(issuedText) && /Quinn QA — e-signed/.test(issuedText), issuedText);
check('and flattened, so it cannot be edited', (await PDFDocument.load(r.bytes)).getForm().getFields().length === 0);
r = await call('/api/record/preview?ref=' + encodeURIComponent(W2));
check('the preview draws the filled form', r.status === 200 && /data:image\/png;base64/.test(r.text), r.text.slice(0, 160));
await as('dc@dt.test');
const flat = await (async () => { const d = await PDFDocument.create(); const pg = d.addPage([595, 842]); const f = await d.embedFont(StandardFonts.Helvetica);
  pg.drawText('NON-CONFORMANCE REPORT', { x: 50, y: 800, size: 14, font: f }); pg.drawText('Location:', { x: 50, y: 700, size: 10, font: f });
  pg.drawText('Finding:', { x: 50, y: 680, size: 10, font: f }); pg.drawText('Signature:', { x: 50, y: 600, size: 10, font: f }); return d.save(); })();
r = await call('/api/templates/upload', { doc_type: 'ncr', filename: 'NCR.pdf', file_b64: Buffer.from(flat).toString('base64') });
check('a flat PDF form: a box beside each label it states', r.status === 200 && r.json.flat === true && r.json.fields.map((f) => f.label).join('|') === 'Location|Finding' && r.json.signs[0] === 'signature', r.text.slice(0, 300));
r = await call('/api/templates/upload', { doc_type: 'ncr', filename: 'bad.pdf', file_b64: Buffer.from('%PDF-1.4 nothing').toString('base64') });
check('a PDF that cannot be read is refused', r.status === 400 && /could not be read/.test(r.json.error));

console.log('\n— 1: contract obligations (A4) — the AI reads every clause, QS confirms, the Principal approves —');
await as('qs@dt.test');
r = await call('/api/obligations/find', {});
check('with AI off, nothing is found', r.status === 400 && r.json.disabled);
env.ANTHROPIC_API_KEY = 'test-key';
r = await call('/api/obligations/find', {});
check('with no indexed contract, QS is told to index it first', r.status === 400 && /No contract clauses are indexed/.test(r.json.error), r.text);
await ensureIndexTables(env);
const clause = (key, heading, text, page) => db.prepare("INSERT INTO index_entry (id, project_id, kind, key, heading, text, topics, doc_source, page, quote, built_at) VALUES (?, ?, 'clause', ?, ?, ?, '[]', 'library:doc1', ?, ?, ?)")
  .run('ix_' + key.replace(/\W/g, ''), pid, key, heading, text, page, text.slice(0, 600), new Date().toISOString());
clause('Sub-Clause 20.1', 'Contractor’s Claims', 'If the Contractor considers himself to be entitled to any extension of the Time for Completion, the Contractor shall give notice to the Engineer within twenty-eight (28) days after the Contractor became aware of the event or circumstance.', 41);
clause('Sub-Clause 14.7', 'Payment', 'The Employer shall pay to the Contractor the amount certified in each Interim Payment Certificate within 56 days after the Engineer receives the Statement.', 33);
OBL = { obligations: [
  { clause: 'Sub-Clause 20.1', quote: 'the Contractor shall give notice to the Engineer within twenty-eight (28) days after the Contractor became aware of the event or circumstance', binds: 'contractor', kind: 'notice', period_days: 28, trigger: 'becoming aware of the event', summary: 'Notice of a claim within 28 days' },
  { clause: 'Sub-Clause 20.1', quote: 'the Contractor must notify the Engineer immediately', binds: 'contractor', kind: 'notice', period_days: 0 },
  { clause: 'Sub-Clause 14.7', quote: 'The Employer shall pay to the Contractor the amount certified in each Interim Payment Certificate within 56 days after the Engineer receives the Statement', binds: 'employer', kind: 'payment', period_days: 60, trigger: 'the Engineer receiving the Statement', summary: 'Payment of IPCs' }] };
r = await call('/api/obligations/find', { clauses: 12 });
check('the AI reads both clauses: two obligations, one quotation that is not the contract’s words dropped', r.status === 200 && r.json.read === 2 && r.json.added === 2 && r.json.dropped === 1 && r.json.remaining === 0, r.text);
r = await call('/api/obligations');
const pay = r.json.obligations.find((o) => o.kind === 'payment'), note = r.json.obligations.find((o) => o.kind === 'notice');
check('a period is read from the quotation, not the AI’s figure', note.period_days === 28 && pay.period_days === 56 && pay.flags.some((f) => /gave 60 days; the quotation states 56/.test(f)), r.json.obligations);
check('both wait for the QS', r.json.obligations.every((o) => o.state === 'proposed'));
r = await call('/api/attention');
check('the QS has them in Needs my attention', JSON.stringify(r.json).includes('/obligations'), r.text.slice(0, 200));
r = await call('/api/obligations/find', {});
check('a clause read once is not read again', r.json.read === 0 && r.json.remaining === 0);
await as('site@dt.test');
r = await call('/api/obligations/confirm', { id: note.id, binds: 'contractor' });
check('a site engineer cannot confirm an obligation', r.status === 403);
await as('qs@dt.test');
r = await call('/api/obligations/confirm', { id: note.id, binds: 'contractor', kind: 'notice', period_days: 28 });
const r2 = await call('/api/obligations/confirm', { id: pay.id, binds: 'employer', kind: 'payment', period_days: 56 });
check('QS confirms both', r.status === 200 && r2.status === 200, r.text + r2.text);
r = await call('/api/obligations/approve', {});
check('the QS cannot approve them', r.status === 403);
await as('principal@decisiontower.test');
r = await call('/api/obligations/approve', {});
check('the Principal approves: live', r.status === 200 && r.json.approved === 2, r.text);
const np = await noticePeriod(env, pid);
check('the notice clock (A13) now runs on the approved obligation', np.days === 28 && /Sub-Clause 20.1.*approved obligation/.test(np.basis), np);
await as('qs@dt.test');
r = await call('/api/obligations/confirm', { id: note.id, binds: 'both' });
check('an approved obligation is not changed', r.status === 400 && /approved/.test(r.json.error));
r = await call('/obligations');
check('the register page opens', r.status === 200 && r.text.includes('Contract obligations'));
delete env.ANTHROPIC_API_KEY;

console.log('\n— 20: the Tender vs IFC deviations agent —');
const sheet = async (title, lines, extraBox) => {
  const d = await PDFDocument.create(); const pg = d.addPage([842, 595]); const f = await d.embedFont(StandardFonts.Helvetica);
  pg.drawRectangle({ x: 80, y: 120, width: 320, height: 220, borderWidth: 2 }); pg.drawText(title, { x: 80, y: 360, size: 14, font: f });
  lines.forEach((l, i) => pg.drawText(l, { x: 440, y: 300 - i * 16, size: 9, font: f }));
  if (extraBox) pg.drawRectangle({ x: 500, y: 90, width: 160, height: 110, borderWidth: 2 });
  return 'data:application/pdf;base64,' + Buffer.from(await d.save({ useObjectStreams: false })).toString('base64');
};
await as('dc@dt.test');
const dw = async (number, kind, title, lines, box) => (await call('/api/drawing', { number, kind, title, filename: number + '.pdf', data: await sheet(title, lines, box) })).json;
await dw('T-A-101', 'tender', 'GROUND FLOOR PLAN', ['WALL TYPE W1 200MM BLOCK']);
await dw('A-101', 'ifc', 'GROUND FLOOR PLAN', ['WALL TYPE W1 200MM BLOCK', 'NEW STORE ROOM'], true);
await dw('A-102', 'tender', 'FIRST FLOOR PLAN', ['WALL TYPE W2']);
await dw('A-102', 'ifc', 'FIRST FLOOR PLAN', ['WALL TYPE W2']);
await dw('A-103', 'ifc', 'ROOF PLAN', ['PARAPET']);
await dw('A-199', 'tender', 'OLD SITE PLAN', ['TO BE OMITTED']);
await as('site@dt.test');
r = await call('/api/deviations/run', {});
check('a site engineer does not run the comparison', r.status === 403);
await as('pm@dt.test');
r = await call('/api/deviations/run', { limit: 5 });
check('the PM runs it: two pairs compared', r.status === 200 && r.json.compared.length === 2 && r.json.ifc_only >= 1 && r.json.tender_only === 1, r.text.slice(0, 300));
r = await call('/api/deviations');
const p101 = r.json.pairs.find((p) => p.number === 'A-101'), p102 = r.json.pairs.find((p) => p.number === 'A-102');
check('T-A-101 is paired with A-101 by its number without the stage mark', p101 && p101.paired_by === 'number without stage marks');
check('the identical sheet shows no change', p102 && p102.state === 'no_change' && p102.change_pct === 0, p102);
check('the changed one: an area found, the new note found', p101.state === 'compared' && p101.change_pct > 0 && p101.regions.length >= 1 && p101.text_added.includes('NEW STORE ROOM'), p101);
check('with AI off, the changed line is a deviation to decide', r.json.deviations.some((x) => x.pair_id === p101.id && x.source === 'text' && /NEW STORE ROOM/.test(x.what) && x.decision === 'proposed'));
check('the sheets with no partner are listed', r.json.ifc_only.some((d) => d.number === 'A-103') && r.json.tender_only.some((d) => d.number === 'A-199'));
r = await call('/api/deviations/overlay?id=' + p101.id);
check('the overlay image is served', r.status === 200 && /image\/png/.test(r.headers.get('content-type')));
r = await call('/api/deviations/run', {});
check('a pair compared once is not compared again', r.json.compared.length === 0);
const dv = (await call('/api/deviations')).json.deviations.find((x) => x.pair_id === p101.id);
await as('qs@dt.test');
r = await call('/api/deviations/decide', { id: dv.id, decision: 'variation' });
check('a possible variation needs a note for the QS', r.status === 400 && /Say what the variation is/.test(r.json.error));
r = await call('/api/deviations/decide', { id: dv.id, decision: 'variation', note: 'Store room added at grid E — not in the tender scope' });
check('the QS marks it a possible variation', r.status === 200 && db.prepare('SELECT decision, decided_by FROM tifc_deviation WHERE id = ?').get(dv.id).decided_by === 'Quincy QS');
r = await call('/api/deviations/xlsx');
check('the deviations download, with the X1 header', r.status === 200 && /Store room added/.test(xlsxText(r.bytes)) && /Downloaded by: Quincy QS/.test(xlsxText(r.bytes)));
await as('dc@dt.test');
await dw('A-104', 'tender', 'SECTION A-A', ['SLAB 200 THK']);
await dw('A-104', 'ifc', 'SECTION A-A', ['SLAB 250 THK'], true);
env.ANTHROPIC_API_KEY = 'test-key';
DEV = { summary: 'The slab is thicker and a plant room is added.', deviations: [{ what: 'Slab thickness 200 mm → 250 mm', where: 'section A-A, level 2', kind: 'dimension', variation: true },
  { what: 'Plant room added at the east end', where: 'bottom right', kind: 'scope_added', variation: true }] };
await as('pm@dt.test');
r = await call('/api/deviations/run', {});
const v2 = (await call('/api/deviations')).json;
const p104 = v2.pairs.find((p) => p.number === 'A-104');
check('with AI on, the AI describes the deviations of the changed pair', p104 && p104.model && /thicker/.test(p104.summary) && v2.deviations.filter((x) => x.pair_id === p104.id && x.source === 'ai').length === 2, p104);
check('marked as possible variations, still for a person to decide', v2.deviations.filter((x) => x.pair_id === p104.id).every((x) => x.variation === 1 && x.decision === 'proposed'));
delete env.ANTHROPIC_API_KEY;
r = await call('/deviations');
check('the page opens', r.status === 200 && r.text.includes('Tender vs IFC'));
r = await call('/api/knowledge');
check('the knowledge base pairs the sheets the same way and points to the page', r.status !== 200 || !r.json.snapshot || /deviations/.test(JSON.stringify(r.json)));

done();
