// K13 (A11) · v5 A11: minutes from typed notes or a scanned sheet — drafted
// with AI on, written by hand with AI off; the AI never issues minutes or
// assigns an action (each proposed owner is confirmed by a person); two series
// on their own templates; the consultant's issued minutes read and recorded as
// theirs, their actions kept in the minute; the tracker in v5's columns.
//   node tools/test-k13-minutes.mjs
import { db, env, mail, call, admin, as, check, done, onboard, xlsxText } from './_harness.mjs';
import { buildXlsx } from '../src/xlsx.js';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { shapeMinutes } from '../src/minutes-ai.js';
import { unzipSync, strFromU8 } from 'fflate';
const unzipText = (u8) => Object.values(unzipSync(u8)).map((b) => strFromU8(b)).join(' ');

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
    return new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(ANSWER) }], usage: { input_tokens: 800, output_tokens: 300 } }), { status: 200 });
  }
  return realFetch(url, init);
};
const actionsCount = () => { try { return db.prepare('SELECT COUNT(*) AS n FROM actions').get().n; } catch (e) { return 0; } };

console.log('— the owners proposed, matched by name —');
const team = [{ id: 'u1', name: 'Ravi Kumar' }, { id: 'u2', name: 'The PM' }];
const sm = shapeMinutes({ items: [{ subject: 'Slab pour', actions: [{ text: 'Book the pump', owner: 'Ravi', due: '20 Oct 2026' }, { text: 'Confirm cover', owner: 'Engineer (Dar)', due: '03/04/2026' }] }] }, team);
check('an owner named in the notes is matched to the team, one not on it kept by name — both only proposed', sm.items[0].actions[0].owner_user_id === 'u1' && sm.items[0].actions[0].proposed && !sm.items[0].actions[1].owner_user_id && sm.items[0].actions[1].owner_name === 'Engineer (Dar)');
check('a date that reads two ways is left for the person', sm.items[0].actions[0].due === '2026-10-20' && !sm.items[0].actions[1].due && /or/.test(sm.items[0].actions[1].due_note));

const { pid } = await onboard('Tower K13M', 'TKM-0001', [['The DC', 'dc@tk13m.test', ['dc']], ['The PM', 'pm@tk13m.test', ['pm']], ['Ravi Kumar', 'ravi@tk13m.test', ['site']], ['The Finance', 'fin@tk13m.test', ['finance']]]);
const ravi = db.prepare("SELECT id FROM users WHERE email = 'ravi@tk13m.test'").get().id;
await onboard('Tower Q13M', 'TQM-0001', [['Other DC', 'dc@tq13m.test', ['dc']]]);

console.log('\n— AI off: by hand, as before —');
await as('dc@tk13m.test');
let r = await call('/api/meetings');
check('the series are offered; AI off', r.json.series.consultant && r.json.series.company && r.json.ai_on === false);
r = await call('/api/meeting/ai-draft', { type: 'progress', notes: 'Pump booked by Ravi.' });
check('with AI off, preparing is refused and nothing is written', r.status === 400 && r.json.disabled);
r = await call('/api/meeting', { type: 'internal', title: 'Internal 1', meeting_date: today, attendees: [{ name: 'The DC', present: true }], items: [{ subject: 'Site logistics', decision: 'Gate 2 for deliveries' }] });
check('an internal meeting written by hand: the company series', r.status === 200 && db.prepare('SELECT series FROM meetings WHERE ref = ?').get(r.json.ref).series === 'company');
const INT1 = r.json.ref;
r = await call('/api/meeting/issue', { ref: INT1 });
check('and issued by hand', r.status === 200, r.text.slice(0, 200));

console.log('\n— AI on: drafted, owners confirmed by a person, then issued —');
env.ANTHROPIC_API_KEY = 'test-key';
ANSWER = { title: 'Progress meeting 4', meeting_date: words(today), location: 'Site office', chair: 'The PM',
  attendees: [{ name: 'The PM', company: 'Contractor', present: true }, { name: 'Ravi Kumar', company: 'Contractor', present: true }, { name: 'A. Engineer', company: 'Dar Consult', present: true }],
  items: [{ subject: 'L4 slab pour', discussion: 'Pour planned for Thursday.', decision: 'Pour on Thursday, subject to inspection.',
    actions: [{ text: 'Book the concrete pump', owner: 'Ravi', due: words(inDays(3)) }, { text: 'Inspect the L4 reinforcement', owner: 'A. Engineer (Dar)', due: words(inDays(2)) }] }] };
const meetingsBefore = db.prepare('SELECT COUNT(*) AS n FROM meetings').get().n;
await as('fin@tk13m.test');
r = await call('/api/meeting/ai-draft', { type: 'progress', notes: 'x' });
check('Finance does not write minutes', r.status === 403);
await as('dc@tk13m.test');
r = await call('/api/meeting/ai-draft', { type: 'progress', notes: 'Progress meeting 4 today in the site office. PM chaired. Ravi to book the pump by Thursday; Engineer to inspect L4 rebar.' });
const D = r.json.draft;
check('the AI prepares the minutes from the typed notes', r.status === 200 && D.items.length === 1 && D.attendees.length === 3 && D.meeting_date === today, r.text.slice(0, 300));
check('Ravi is proposed from the team, the Engineer by name; both wait for a person', D.items[0].actions[0].owner_user_id === ravi && D.items[0].actions[0].proposed && D.items[0].actions[1].owner_name === 'A. Engineer (Dar)' && D.items[0].actions[1].proposed);
check('nothing was saved by the AI', db.prepare('SELECT COUNT(*) AS n FROM meetings').get().n === meetingsBefore);
r = await call('/api/meeting', { type: 'progress', title: D.title, meeting_date: D.meeting_date, location: D.location, chair: D.chair, attendees: D.attendees, items: D.items });
const PRG = r.json.ref;
check('the person saves the draft: a consultant meeting, the proposals kept', r.status === 200 && db.prepare('SELECT series FROM meetings WHERE ref = ?').get(PRG).series === 'consultant' && r.json.meeting.items[0].actions.every((a) => a.proposed));
r = await call('/api/meeting/issue', { ref: PRG });
check('not issued while an owner the AI proposed is unconfirmed — the AI never assigns', r.status === 400 && /confirm the owner the AI proposed/.test(r.json.error), r.text.slice(0, 200));
check('no action exists yet', actionsCount() === 0);
const confirmed = r.json.checks ? D.items.map((it) => ({ ...it, actions: it.actions.map((a) => ({ ...a, confirmed: true })) })) : null;
r = await call('/api/meeting', { ref: PRG, type: 'progress', title: D.title, meeting_date: D.meeting_date, location: D.location, chair: D.chair, attendees: D.attendees, items: confirmed });
const mails = mail.length;
r = await call('/api/meeting/issue', { ref: PRG });
check('owners confirmed by the person: issued, actions numbered', r.status === 200 && r.json.created.length === 2 && actionsCount() === 2, r.text.slice(0, 200));
check('the owner on the platform is told', mail.slice(mails).some((m) => JSON.stringify(m.to).includes('ravi@tk13m.test')));

console.log('\n— the consultant’s template for their meetings —');
await call('/api/templates/upload', { doc_type: 'minutes_consultant', filename: 'Consultant MOM.xlsx', file_b64: b64(buildXlsx([{ name: 'MOM', rows: [
  ['MINUTES OF MEETING', '', '', 'Form MOM-01'], ['Meeting:', '{{meeting_ref}}'], ['Date:', '{{meeting_date}}'], ['Attendees:', '{{attendees}}'], ['Items:', '{{items}}'], ['Actions:', '{{actions}}']] }])) });
r = await call('/api/meeting/doc?ref=' + PRG);
let x = unzipText(r.bytes);
check('a consultant meeting’s minutes go out on the consultant’s template', r.status === 200 && /spreadsheetml/.test(r.headers.get('content-type')) && x.includes(PRG) && x.includes('Book the concrete pump') && x.includes('AI-001'), r.headers.get('content-type'));
r = await call('/api/meeting/doc?ref=' + INT1);
check('an internal one, with no company template set up, on the platform’s own layout', r.status === 200 && /msword/.test(r.headers.get('content-type')));

console.log('\n— the consultant’s issued minutes, read and recorded as theirs —');
const pdf = await PDFDocument.create({ updateMetadata: false }); const f = await pdf.embedFont(StandardFonts.Helvetica); const pg = pdf.addPage([595, 842]);
['DAR CONSULT — MINUTES OF MEETING MOM-07', 'Date: ' + words(today), '1. Facade mock-up: Approved subject to sealant colour.', 'Action: Contractor to submit sealant colour samples by next week.'].forEach((l, i) => pg.drawText(l, { x: 40, y: 800 - i * 16, size: 10, font: f }));
const consultantPdf = new Uint8Array(await pdf.save({ useObjectStreams: false }));
ANSWER = { their_ref: 'MOM-07', title: 'Dar Consult progress meeting 7', meeting_date: words(today), attendees: [{ name: 'A. Engineer', company: 'Dar Consult', present: true }],
  items: [{ subject: 'Facade mock-up', decision: 'Approved subject to sealant colour.', actions: [{ text: 'Submit sealant colour samples', owner: 'Contractor', due: words(inDays(7)) }] }] };
const n0 = sent.length;
r = await call('/api/meeting/consultant/read', { file: { filename: 'MOM-07.pdf', data: b64(consultantPdf) } });
const C = r.json.draft;
check('read: their reference, the date, the decision and their action', r.status === 200 && C.their_ref === 'MOM-07' && C.items[0].decision && C.items[0].actions.length === 1 && !C.items[0].actions[0].proposed, r.text.slice(0, 300));
check('a text PDF went to the model as text', typeof sent[n0].messages[0].content === 'string' && /MOM-07/.test(sent[n0].messages[0].content));
r = await call('/api/meeting/consultant/record', { type: 'progress', title: C.title, meeting_date: C.meeting_date, their_ref: C.their_ref, attendees: C.attendees, items: C.items, file: { filename: 'MOM-07.pdf', data: b64(consultantPdf) } });
const REC = r.json.ref;
const recRow = db.prepare('SELECT * FROM meetings WHERE ref = ? AND project_id = ?').get(REC, pid);
check('recorded as the consultant’s minutes, their reference kept, the file on it', r.status === 200 && recRow.status === 'recorded' && recRow.their_ref === 'MOM-07' && recRow.series === 'consultant'
  && db.prepare('SELECT COUNT(*) AS n FROM attachments WHERE ref = ?').get(REC).n === 1, r.text);
check('their action stays text in the minute — nothing in our tracker (spec §6)', actionsCount() === 2 && JSON.parse(recRow.items)[0].actions[0].text === 'Submit sealant colour samples');
r = await call('/api/meeting/issue', { ref: REC });
check('and it is not issued by us', r.status === 400 && /consultant’s minutes/.test(r.json.error));
r = await call('/api/meetings');
check('the list shows it as theirs', r.json.meetings.some((m) => m.ref === REC && m.status === 'recorded' && m.their_ref === 'MOM-07'));

console.log('\n— the tracker, and the walls —');
r = await call('/api/actions/xlsx');
x = xlsxText(r.bytes);
check('the tracker in v5’s columns: No, Meeting, Action, Owner, Due, Status, Closed on', ['No', 'Meeting', 'Action', 'Owner', 'Due', 'Status', 'Closed on'].every((h) => x.includes('>' + h + '<')) && x.indexOf('>Meeting<') < x.indexOf('>Action<'));
await as('dc@tq13m.test');
r = await call('/api/meetings');
check('another company sees none of it', r.json.meetings.length === 0);
await admin();
await call('/api/setup/modules', { project_id: pid, modules: ['core', 'planning', 'site', 'design', 'dc', 'registers', 'gate', 'meetings'] });
await as('dc@tk13m.test');
r = await call('/api/meeting/ai-draft', { type: 'progress', notes: 'x' });
check('with the AI module off, preparing is refused', r.status === 403);
check('every AI call went through the one door', db.prepare("SELECT COUNT(*) AS n FROM ai_usage WHERE task LIKE 'a11-%'").get().n === sent.length);
done();
