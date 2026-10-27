// STEP 4 — the weekly and monthly progress reports, from live data.
//
//   node tools/test-reports-step4.mjs
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { buildReport, reportHTML, reportWord } from '../src/report.js';

let fails = 0, checks = 0;
const check = (n, c, d) => { checks++; console.log((c ? '  ok   ' : '  FAIL ') + n + (d && !c ? '  — ' + String(d).slice(0, 300) : '')); if (!c) fails++; };
const T = new Date(Date.now() + 4 * 3600000).toISOString().slice(0, 10);
const shift = (d, n) => new Date(Date.parse(d + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);
const monday = (d) => shift(d, -((new Date(d + 'T00:00:00Z').getUTCDay() + 6) % 7));

const db = new DatabaseSync(':memory:');
db.exec(readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));
function stmt(sql) {
  const st = db.prepare(sql); let args = [];
  const api = {
    bind(...a) { args = a; return api; },
    async all() { return { results: st.all(...args), success: true }; },
    async first(col) { const r = st.get(...args) ?? null; return col && r ? r[col] : r; },
    async run() { st.run(...args); return { success: true, meta: {} }; },
  };
  return api;
}
const sent = [];
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  if (String(url).includes('api.resend.com')) {
    sent.push(JSON.parse(init.body));
    return new Response(JSON.stringify({ id: 'x' }), { status: 200 });
  }
  return realFetch(url, init);
};
const env = {
  DB: { prepare: stmt, async batch(l) { for (const s of l) await s.run(); return []; }, async exec(s) { db.exec(s); } },
  OWNER_CODE: 'MASTERCODE-0123456789', LOGIN_TEST_CODE: '246810', AUTH_SECRET: 'x'.repeat(40), RESEND_KEY: 're_test',
};
const worker = (await import('../src/index.js')).default;
let cookie = '';
async function call(path, body) {
  const headers = {};
  if (cookie) headers.Cookie = cookie;
  if (body) headers['Content-Type'] = 'application/json';
  const res = await worker.fetch(new Request('http://localhost' + path, { method: body ? 'POST' : 'GET', headers, body: body ? JSON.stringify(body) : undefined }), env, { waitUntil() {} });
  const sc = res.headers.get('set-cookie');
  if (sc) cookie = sc.split(',').map((x) => x.split(';')[0].trim()).join('; ');
  const text = await res.text(); let json = null; try { json = JSON.parse(text); } catch (e) {}
  return { status: res.status, text, json, headers: res.headers };
}
const as = async (email) => { cookie = ''; return (await call('/api/signin/code', { email, code: '246810' })).json?.ok; };

await call('/api/login', { code: 'MASTERCODE-0123456789' });
let r = await call('/api/setup/onboard', { company: { name: 'NAF' }, project: { name: 'Tower A' },
  principal: { name: 'M. Boss', email: 'boss@naf.ae' } });
const P = r.json.project_id;
db.prepare('UPDATE projects SET created_at = ? WHERE id = ?').run(shift(T, -60) + 'T00:00:00Z', P);
for (const [n, e, f] of [['PM', 'pm@naf.ae', ['pm']], ['Plan', 'plan@naf.ae', ['planning']], ['Des', 'des@naf.ae', ['design']],
  ['DC', 'dc@naf.ae', ['dc']], ['QA', 'qa@naf.ae', ['qaqc']], ['Site', 'site@naf.ae', ['site']]]) {
  await call('/api/person', { name: n, email: e, functions: f, projects: [P] });
}

// ---- a small programme: 60 days back to 60 days on
const act = db.prepare(`INSERT INTO activities (project_id, id, name, level, sort_order, discipline, planned_start, planned_finish, weight, source, kind, work_starts)
  VALUES (?,?,?,1,?,?,?,?,?,?,?,?)`);
act.run(P, 'A1', 'Excavation', 1, 'Civil', shift(T, -60), shift(T, -40), 0, 'programme', 'site', null);          // should be done
act.run(P, 'A2', 'Raft', 2, 'Structure', shift(T, -40), shift(T, -10), 0, 'programme', 'site', null);           // late to finish
act.run(P, 'A3', 'Columns L1', 3, 'Structure', shift(T, -5), shift(T, 15), 0, 'programme', 'site', null);       // late to start
act.run(P, 'A4', 'Blockwork L1', 4, 'Finishes', shift(T, 5), shift(T, 30), 0, 'programme', 'site', null);       // starts in window
act.run(P, 'A5', 'Screed L1', 5, 'Finishes', shift(T, 25), shift(T, 60), 0, 'programme', 'site', null);         // outside window
act.run(P, 'DRV-DRA-0', 'Shop drawings — Finishes', 6, 'Finishes', shift(T, -2), shift(T, -2), 0, 'derived', 'drawing', shift(T, 5));
const up = db.prepare(`INSERT INTO updates (project_id, activity_id, report_date, pct, status, submitted_by, source, created_at) VALUES (?,?,?,?,?,?,'site','x')`);
up.run(P, 'A1', shift(T, -45), 60, 'in_progress', 'Site');
up.run(P, 'A1', shift(T, -38), 100, 'complete', 'Site');
up.run(P, 'A2', shift(T, -30), 20, 'in_progress', 'Site');
up.run(P, 'A2', shift(T, -9), 70, 'delayed', 'Site');
up.run(P, 'A2', T, 80, 'delayed', 'Site');

// ---- records through the real workflow
await as('des@naf.ae');
const rfi = (await call('/api/records', { type: 'rfi', title: 'Beam clash L5' })).json.ref;
const sub = (await call('/api/records', { type: 'submittal', title: 'Formwork drawings' })).json.ref;
await as('pm@naf.ae');
await call('/api/record/advance', { ref: rfi, action: 'advance' });
await call('/api/record/advance', { ref: sub, action: 'advance' });
await as('dc@naf.ae');
await call('/api/record/advance', { ref: rfi, action: 'advance' });                                  // issued
await call('/api/record/advance', { ref: rfi, action: 'advance', status: 'Code A — Approved' });      // reply recorded, closed
await call('/api/record/advance', { ref: sub, action: 'advance' });                                  // issued, with consultant
await as('qa@naf.ae');
const ncr = (await call('/api/records', { type: 'ncr', title: 'Honeycombing' })).json.ref;
db.prepare('UPDATE records SET due = ? WHERE ref = ? AND project_id = ?').run(shift(T, -3), ncr, P);     // overdue
// a record raised long ago, still open
const old = (await call('/api/records', { type: 'ncr', title: 'Cube failure' })).json.ref;
db.prepare('UPDATE records SET submitted = ?, created_at = ?, due = ? WHERE ref = ? AND project_id = ?')
  .run(shift(T, -50), shift(T, -50) + 'T08:00:00Z', shift(T, -43), old, P);

db.prepare(`INSERT INTO drawings (project_id, id, number, revision, title, kind, status, uploaded_at, approved_at) VALUES (?,?,?,?,?,?,?,?,?)`)
  .run(P, 'd1', 'ST-210', 'C', 'L5 slab', 'ifc', 'current', T + 'T08:00:00Z', T + 'T09:00:00Z');

// ---- diary: today submitted, one earlier working day as a draft
await as('pm@naf.ae');
await call('/api/diary', { report_date: T, weather: 'Sunny', prepared_by: 'R', staff: [{ t: 'Mason', n: 10 }],
  works: [{ a: 'Raft', q: '1' }], tomorrow: [{ a: 'Raft' }], submit: true });
let dDraft = shift(T, -1); while (new Date(dDraft + 'T00:00:00Z').getUTCDay() === 5) dDraft = shift(dDraft, -1);
await call('/api/diary', { report_date: dDraft, weather: 'Cloudy' });

// ================================================================ the weekly
const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(P);
const w = await buildReport(env, P, project, 'weekly', T);
check('weekly runs Monday to Sunday', w.from === monday(T) && w.periodTo === shift(monday(T), 6), w.from + ' ' + w.periodTo);
check('a week still running is reported to today', w.to === T && w.running === (T < w.periodTo));
check('derived items are not site progress', w.now.total === 5, w.now.total);
const last = w.curve.points.filter((p) => p.date <= w.to).pop();
check('S-curve ends on the report date', last.date === w.to);
check('S-curve actual at the end equals the report figure', Math.abs(last.actual - w.now.pct) < 1e-9, last.actual + ' vs ' + w.now.pct);
check('S-curve planned at the end equals the programme position', Math.abs(last.planned - w.now.planned) < 1e-9);
check('S-curve plan reaches 100% at the programme finish', Math.abs(w.curve.points[w.curve.points.length - 1].planned - 100) < 1e-9);
check('actual line starts at the first progress', w.curve.first_actual === shift(T, -45) &&
  w.curve.points.filter((p) => p.date < shift(T, -45)).every((p) => p.actual === null));
check('actual never runs past the report date', w.curve.points.filter((p) => p.date > w.to).every((p) => p.actual === null));
check('look-ahead: late to start', w.look.late.map((a) => a.id).join() === 'A3', JSON.stringify(w.look.late));
check('look-ahead: due to start', w.look.starting.map((a) => a.id).join() === 'A4');
check('look-ahead: due to finish', w.look.finishing.map((a) => a.id).join() === 'A3');
check('look-ahead: the drawing needed first, overdue', w.look.needed.length === 1 && w.look.needed[0].overdue && w.look.needed[0].work_starts === shift(T, 5));
const tot = w.regs.totals;
const rfiRow = w.regs.types.find((t) => t.type === 'rfi'), subRow = w.regs.types.find((t) => t.type === 'submittal'), ncrRow = w.regs.types.find((t) => t.type === 'ncr');
check('registers: raised this week', tot.raised === 3, JSON.stringify(tot));
check('registers: two issued, one reply', tot.issued === 2 && tot.replied === 1);
check('registers: RFI closed, submittal with the consultant', rfiRow.closed === 1 && rfiRow.open === 0 && subRow.with_consultant === 1 && subRow.open === 1);
check('registers: both NCRs open, both overdue', ncrRow.open === 2 && ncrRow.overdue === 2, JSON.stringify(ncrRow));
check('overdue list is worst first', w.regs.overdue[0].ref === old && w.regs.overdue[0].days === 43);
check('reply recorded shows the code', w.regs.replies[0].ref === rfi && /Code A/.test(w.regs.replies[0].reply));
check('drawing issued this week', w.drawings.length === 1 && w.drawings[0].number === 'ST-210');
check('diary: today submitted', w.diary.submitted === 1 && w.diary.days.find((x) => x.date === T).status === 'submitted');
{ // the draft day, in whichever week it falls
  const dw = await buildReport(env, P, db.prepare('SELECT * FROM projects WHERE id = ?').get(P), 'weekly', dDraft);
  check('diary: a draft is listed as not submitted', dw.diary.draft >= 1 &&
    dw.diary.missing_dates.some((x) => x.date === dDraft && x.status === 'draft'), JSON.stringify(dw.diary));
  // A week still running is reported up to today, not to Sunday, so the window
  // holds a Friday only once Friday has come. Asserting there is always one
  // made this fail Monday to Thursday and pass at the weekend — a red suite
  // four days out of seven, for nothing. What is actually being checked is
  // that every day is counted once, as working or as off, and that a Friday
  // inside the window is counted as off.
  // A Friday nobody worked is a day off. A Friday somebody wrote a diary for
  // is a day that was worked, and must not be excused as a day off — so only
  // the unworked Fridays are counted here.
  const idleFridays = dw.diary.days.filter((x) =>
    new Date(x.date + 'T00:00:00Z').getUTCDay() === 5 && x.status !== 'submitted' && x.status !== 'draft').length;
  check('diary: every day is counted once, either working or off',
    dw.diary.working + dw.diary.off === dw.diary.days.length, JSON.stringify(dw.diary));
  check('diary: an unworked Friday is a day off, not a missing diary',
    dw.diary.off >= idleFridays, JSON.stringify({ off: dw.diary.off, idleFridays }));
}

// ---- last week: nothing raised or issued then; the old NCR was already open and overdue
const pw = await buildReport(env, P, project, 'weekly', shift(monday(T), -7));
check('last week: not running', !pw.running && pw.to === pw.periodTo);
check('last week: records raised this week are not in it', pw.regs.totals.raised === 0 && pw.regs.totals.issued === 0);
check('last week: the old NCR was open and overdue then', pw.regs.totals.open === 1 && pw.regs.totals.overdue === 1, JSON.stringify(pw.regs.totals));
check('last week: diary days all accounted for', pw.diary.days.length === 7 && pw.diary.days.every((x) => x.status !== 'today'));

// ---- the monthly
const mo = await buildReport(env, P, project, 'monthly', T.slice(0, 7));
check('monthly covers the month', mo.from === T.slice(0, 7) + '-01' && mo.kind === 'monthly');
const html = reportHTML(mo);
for (const h of ['Planned against actual', 'Three-week look-ahead', 'Registers', 'Documents issued and replies received', 'Site diary']) {
  check('monthly has "' + h + '"', html.includes(h));
}
check('no stray ${SPAN} left in the text', !/\$\{SPAN\}/.test(html) && !reportHTML(w).includes('${'));
check('the weekly never says "month"', !/during the month|this month/.test(reportHTML(w)));
check('S-curve drawn as SVG', /<svg[^>]*aria-label="Planned against actual progress"/.test(html));
const word = reportWord(mo);
check('Word file has no SVG but keeps the figures', !/<svg/.test(word) && word.includes('Week ending') || word.includes('Month end'));

// ---- the two short reports
const la = await buildReport(env, P, project, 'lookahead', T);
check('look-ahead report', la.look.starting.length === 1 && reportHTML(la).includes('Blockwork L1'));
const ps = await buildReport(env, P, project, 'programme', T);
check('programme status: late finishes listed', ps.late.map((a) => a.name).join() === 'Raft' && ps.late[0].days === 10, JSON.stringify(ps.late));
check('programme status renders', reportHTML(ps).includes('Past their planned finish'));

// ================================================================ through the API
await as('plan@naf.ae');
r = await call('/api/report?kind=weekly&key=' + T);
check('Planning can open the weekly (was locked out before)', r.status === 200 && r.text.includes('Registers'), r.status);
r = await call('/api/report?kind=monthly&key=' + T.slice(0, 7) + '&format=doc');
check('Word download', r.status === 200 && /msword/.test(r.headers.get('content-type')) &&
  /attachment; filename="Tower-A_monthly_\d{4}-\d{2}\.doc"/.test(r.headers.get('content-disposition')), r.headers.get('content-disposition'));
r = await call('/reports?kind=weekly&key=' + T + '&print=1');
check('Reports page opens for Planning', r.status === 200 && r.text.includes('fromLink'));
r = await call('/api/report-email', { kind: 'weekly', key: T });
check('no list set: nothing sent, says why', r.status === 400 && /no recipients/.test(r.json.error));
db.prepare("UPDATE projects SET report_emails = 'pm@naf.ae, client@x.ae' WHERE id = ?").run(P);
r = await call('/api/report-email', { kind: 'weekly', key: T });
check('Planning sends the weekly to the project list', r.status === 200 && r.json.sent === 2 && sent.length === 1, r.text);
check('…with the full week in the subject', sent[0].subject.includes('weekly report') && /Registers/.test(sent[0].html), sent[0].subject);
await as('des@naf.ae');
r = await call('/api/report?kind=weekly&key=' + T);
check('Design cannot open reports', r.status === 401);
r = await call('/api/report-email', { kind: 'weekly', key: T });
check('Design cannot send them', r.status === 401);
await as('site@naf.ae');
r = await call('/api/report?kind=weekly&key=' + T);
check('Site cannot open reports', r.status === 401);

// ---- the monthly send on the 1st
await as('boss@naf.ae');
r = await call('/api/project', { action: 'report', id: P, report_emails: 'pm@naf.ae', report_daily: false, report_weekly: true, report_monthly: true });
const row = db.prepare('SELECT report_monthly, report_weekly FROM projects WHERE id = ?').get(P);
check('monthly send switched on from settings', r.status === 200 && row.report_monthly === 1 && row.report_weekly === 1, r.text);
sent.length = 0;
const waits = [];
await worker.scheduled({ cron: '0 4 1 * *', scheduledTime: Date.now() }, env, { waitUntil(p) { waits.push(p); } });
await Promise.all(waits);
const lastMonth = new Date(Date.now() + 4 * 3600000 - 86400000).toISOString().slice(0, 7);
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
check('the 1st sends last month\'s report', sent.length === 1 && sent[0].subject.includes('monthly report ' + MONTHS[Number(lastMonth.slice(5)) - 1]), JSON.stringify(sent.map((s) => s.subject)));
db.prepare('UPDATE projects SET report_monthly = 0 WHERE id = ?').run(P);
sent.length = 0; waits.length = 0;
await worker.scheduled({ cron: '0 4 1 * *', scheduledTime: Date.now() }, env, { waitUntil(p) { waits.push(p); } });
await Promise.all(waits);
check('switched off: nothing goes', sent.length === 0);

// an empty project still produces a report, no crash
cookie = ''; await call('/api/login', { code: 'MASTERCODE-0123456789' });
r = await call('/api/setup/onboard', { company: { name: 'Empty' }, project: { name: 'Empty' } });
const e = await buildReport(env, r.json.project_id, db.prepare('SELECT * FROM projects WHERE id = ?').get(r.json.project_id), 'weekly', T);
const eh = reportHTML(e);
check('empty project: says there is no programme', e.curve === null && eh.includes('No programme with planned dates'));

mkdirSync(new URL('../test-output/', import.meta.url), { recursive: true });
writeFileSync(new URL('../test-output/step4-weekly.html', import.meta.url), '<!doctype html><meta charset="utf-8"><body style="padding:24px">' + reportHTML(w) + '</body>');
writeFileSync(new URL('../test-output/step4-monthly.doc', import.meta.url), word);
console.log('\n' + checks + ' checks, ' + fails + ' failures');
process.exit(fails ? 1 : 0);
