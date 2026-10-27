// A9 (letters and replies) and A13 (delay and EOT).
//   node tools/test-a9-a13.mjs
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { db, env, call, admin, as, check, done, onboard, xlsxText } from './_harness.mjs';

const b64 = (u8) => Buffer.from(u8).toString('base64');
async function pdf(pages) {
  const d = await PDFDocument.create(); const f = await d.embedFont(StandardFonts.Helvetica);
  for (const lines of pages) { const pg = d.addPage([595, 842]); let y = 800; for (const l of lines) { pg.drawText(l, { x: 40, y, size: 9, font: f }); y -= 13; } }
  return d.save({ useObjectStreams: false });
}
const today = new Date(Date.now() + 4 * 3600000).toISOString().slice(0, 10);
const addDays = (iso, n) => new Date(Date.parse(iso + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);

const { pid } = await onboard('Tower D', 'TWD-0009', [['D PM', 'pm@towerd9.test', ['pm']], ['D Plan', 'plan@towerd9.test', ['planning']], ['D DC', 'dc@towerd9.test', ['dc']], ['D QA', 'qa@towerd9.test', ['qaqc']]]);
const contract = await pdf([['CONDITIONS'], ['PARTICULAR CONDITIONS.', 'Sub-Clause 20.2.1 Notice of Claim The Contractor shall give notice to the Engineer within 28 days after becoming aware of the event.']]);
db.prepare("UPDATE projects SET notice_clause = 'Sub-Clause 20.2.1', engineer_name = 'Consult Co' WHERE id = ?").run(pid);
await as('pm@towerd9.test');
await call('/api/library', { class: 'contract', title: 'Contract', filename: 'Contract.pdf', data: 'data:application/pdf;base64,' + b64(contract) });
await admin();
await call('/api/records?project=' + pid);
const ir = db.prepare('INSERT INTO records (id, project_id, type, no, ref, title, status, data, workflow, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)');
ir.run('r1', pid, 'incoming', 14, 'IN-014', 'Delay to substation energisation', 'With PM — reply by 2026-10-20', '{"From":"Consult Co"}', '[]', '2026-10-01');
ir.run('r2', pid, 'rfi', 42, 'RFI-0042', 'Substation energisation date', 'With consultant', '{}', '[]', '2026-09-01');
await call('/api/index/rebuild', { project_id: pid });

console.log('— A9: letters —');
await as('qa@towerd9.test');
let r = await call('/api/letters/draft', { incoming_ref: 'IN-014' });
check('QA/QC does not draft letters', r.status === 403);
await as('pm@towerd9.test');
r = await call('/api/letters/draft', { incoming_ref: 'IN-999' });
check('an incoming letter that does not exist is refused', r.status === 404);
r = await call('/api/letters/draft', { incoming_ref: 'IN-014' });
check('with AI off, a skeleton from the facts', r.status === 200 && r.json.ai === false && /^Re: Delay to substation/.test(r.json.fields.Subject), r.text.slice(0, 300));
check('it cites the incoming letter and the related RFI', /IN-014 dated 2026-10-01/.test(r.json.fields.References) && /RFI-0042/.test(r.json.fields.References), r.json.fields.References);
check('and the notice clause from the indexed contract', /Sub-Clause 20\.2\.1 \(Notice of Claim\), page 2/.test(r.json.fields['Clause cited']), r.json.fields['Clause cited']);
check('revision 0', r.json.rev === 0);
const thread = r.json.thread;

env.ANTHROPIC_API_KEY = 'test';
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  if (String(url).startsWith('https://api.anthropic.com/')) {
    const body = { Subject: 'Re: Delay to substation energisation', References: 'IN-014; RFI-0042; LTR-777', Clause: '',
      Body: 'We refer to IN-014. Sub-Clause 20.2.1 states “The Contractor shall give notice to the Engineer within 28 days after becoming aware of the event.” ' +
        'The contract also says “the Employer shall pay all costs of delay in full without question”.', 'Clause cited': 'Sub-Clause 20.2.1', Enclosures: '' };
    return new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(body) }], usage: { input_tokens: 10, output_tokens: 10 } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
  return realFetch(url, init);
};
r = await call('/api/letters/draft', { incoming_ref: 'IN-014', note: 'say the delay is not ours' });
check('with AI on, the AI drafts it', r.status === 200 && r.json.ai === true, r.text.slice(0, 200));
check('a quotation that is word for word in the contract passes', !r.json.warnings.some((w) => /within 28 days/.test(w)));
check('an invented quotation is flagged', r.json.warnings.some((w) => /not, word for word, in the indexed contract/.test(w) && /without question/.test(w)), r.json.warnings);
check('an invented reference is flagged', r.json.warnings.some((w) => /LTR-777 is not on this project/.test(w)));
delete env.ANTHROPIC_API_KEY; globalThis.fetch = realFetch;
const t2 = r.json.thread;
r = await call('/api/letters/draft/raise', { thread: t2 });
check('a draft with warnings is not raised without the author confirming', r.status === 400 && r.json.warnings.length >= 2);
r = await call('/api/letters/draft/save', { thread: t2, fields: { Subject: 'Re: Delay to substation energisation', References: 'IN-014; RFI-0042',
  Body: 'We refer to IN-014. The delay arises from the late energisation raised in RFI-0042.', 'Clause cited': 'Sub-Clause 20.2.1', Enclosures: '' } });
check('the author completes a new revision, and the warnings clear', r.status === 200 && r.json.rev === 1 && r.json.warnings.length === 0, r.text);
r = await call('/api/letters/draft/raise', { thread: t2 });
check('it is raised as a letter', r.status === 200 && /^LTR-/.test(r.json.ref) && /signs it/.test(r.json.note), r.text);
const ltr = db.prepare('SELECT data, workflow FROM records WHERE project_id = ? AND ref = ?').get(pid, r.json.ref);
check('replying to IN-014, at its first step (PM / Director signs next)', JSON.parse(ltr.data)['In reply to'] === 'IN-014' && /PM \/ Director signs/.test(ltr.workflow));
r = await call('/api/letters/drafts');
check('the drafts are listed with their revisions', r.json.drafts.some((d) => d.thread === t2 && d.revisions === 2 && d.record_ref));

console.log('\n— A13: delays —');
const ia = db.prepare('INSERT INTO activities (project_id, id, name, level, planned_finish, p6_early_finish, p6_total_float) VALUES (?,?,?,?,?,?,?)');
const ev = addDays(today, -10);
ia.run(pid, 'A1', 'Energise substation', 1, ev, addDays(ev, 30), 0);
ia.run(pid, 'A2', 'Commission chillers', 1, addDays(ev, 20), addDays(ev, 50), 0);
ia.run(pid, 'A3', 'Paint stair core', 1, addDays(ev, 5), addDays(ev, 9), 40);
db.prepare("INSERT INTO links (project_id, from_id, to_id, type) VALUES (?, 'A1', 'A2', 'FS')").run(pid);
db.prepare('INSERT INTO issues (project_id, no, ref, type, title, raised_date, status, impact_days) VALUES (?,?,?,?,?,?,?,?)').run(pid, 1, 'ACC-0001', 'access', 'Access to plot blocked', ev, 'issued', 5);
await as('dc@towerd9.test');
r = await call('/api/delays/scan', {});
check('Document Control does not scan', r.status === 403);
await as('plan@towerd9.test');
r = await call('/api/delays/scan', {});
check('Planning scans: the critical slips and the delay-marked issue', r.status === 200 && r.json.added === 3 && r.json.notice_days === 28, r.text);
r = await call('/api/delays');
const a1 = r.json.delays.find((d) => d.ref === 'A1');
check('a non-critical slip is not flagged', !r.json.delays.some((d) => d.ref === 'A3'));
check('the end of the notice period is the event date + 28 days', a1.time_bar_date === addDays(ev, 28) && a1.notice_days === 28, a1);
check('the effect through the logic is shown', /1 activities follow it in the logic: A2/.test(a1.effect), a1.effect);
check('the arithmetic is shown', a1.clock === 'The clause gives 28 days from the event. The event is dated ' + ev + '. Today is ' + today + ' — day 10. The notice period ends ' + addDays(ev, 28) + '.', a1.clock);
r = await call('/api/attention');
check('flagged delays are in Planning’s Needs my attention', (r.json.items || []).some((i) => i.kind === 'delay' && /notice period ends/.test(i.need)));
r = await call('/api/delays/scan', {});
check('a second scan adds nothing', r.json.added === 0);
r = await call('/api/delays/prepare', { id: a1.id });
check('Prepare drafts the notice and narrative from the facts (AI off: skeleton)', r.status === 200 && /Notice — A1 Energise substation/.test(r.json.notice) && /Sub-Clause 20\.2\.1/.test(r.json.notice) && /Effect through the programme/.test(r.json.narrative), r.text.slice(0, 300));
check('nothing anywhere concludes a time bar or validity', !/time-?barred|is valid|out of time|late notice/i.test(JSON.stringify((await call('/api/delays')).json)));
r = await call('/api/delays/save', { id: a1.id, notice: 'Notice text', narrative: 'Narrative', days_claimed: 30, complete: true });
check('Planning completes it with their days claimed', r.status === 200 && r.status === 200 && r.json.status === 'completed');
r = await call('/api/delays/sign', { id: a1.id });
check('Planning does not sign it', r.status === 403);
await as('principal@towerd.test');   // onboard() names the Principal after the project
r = await call('/api/delays/issue', { id: a1.id });
check('the Director cannot issue it (DC issues)', r.status === 403);
r = await call('/api/delays/sign', { id: a1.id });
check('the Director signs it', r.status === 200 && r.json.status === 'signed', r.text);
await as('dc@towerd9.test');
const acc = (await call('/api/delays')).json.delays.find((d) => d.ref === 'ACC-0001');
r = await call('/api/delays/issue', { id: acc.id });
check('an unsigned notice cannot be issued', r.status === 400);
r = await call('/api/delays/issue', { id: a1.id });
check('Document Control issues it, logged as a letter', r.status === 200 && /^LTR-/.test(r.json.ref), r.text);
const after = (await call('/api/delays')).json.delays.find((d) => d.id === a1.id);
check('the register shows the notice, its date and days claimed', after.status === 'issued' && after.letter_ref === r.json.ref && after.notice_date === today && after.days_claimed === 30);
await as('plan@towerd9.test');
r = await call('/api/delays/save', { id: a1.id, notice: 'x' });
check('an issued notice can no longer be edited', r.status === 400);
r = await call('/api/delays/xlsx');
check('the register downloads with the X1 header', r.status === 200 && xlsxText(r.bytes).includes('Delay / EOT register') && xlsxText(r.bytes).includes('Downloaded by: D Plan'));
r = await call('/letters'); const r2 = await call('/delays');
check('both pages open', r.status === 200 && r2.status === 200);
done();
