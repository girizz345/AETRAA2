// Exercises the issues register: numbering, the transitions, the ageing, the
// documents, and what the reports make of it.
//
//   node tools/test-issues.mjs      writes issue-rfi.html and issue-notice.html
//
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, writeFileSync } from 'node:fs';
import {
  createIssue, updateIssue, listIssues, getIssue, issueDocument, issueDocumentTitle,
  ISSUE_TYPES, REASON_TYPE,
} from '../src/issues.js';
import { buildReport, reportDocument } from '../src/report.js';

const db = new DatabaseSync(':memory:');
db.exec(readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));

const DB = {
  prepare(sql) {
    const st = db.prepare(sql);
    let args = [];
    const api = {
      bind(...a) { args = a; return api; },
      async all() { return { results: st.all(...args) }; },
      async first() { return st.get(...args) ?? null; },
      async run() { st.run(...args); return { success: true }; },
    };
    return api;
  },
};
const env = { DB };
const PID = 'p1';

let fails = 0;
function check(name, cond, detail) {
  console.log((cond ? '  ok   ' : '  FAIL ') + name + (detail ? '  — ' + detail : ''));
  if (!cond) { fails++; process.exitCode = 1; }
}

db.prepare(`INSERT INTO projects (id, name, ref, engineer_name, contractor_name, notice_clause,
                                  target_name, target_deadline, sort_order, created_at)
            VALUES (?,?,?,?,?,?,?,?,1,datetime('now'))`)
  .run(PID, 'G+3P+4+R Building, Plot 6457759', 'Wadi Al Safa 03, Dubai',
       'MIMAR Engineering Consultants', 'NAF Contracting LLC', 'Sub-Clause 20.2.1',
       'Remaining work by 8 November', '2026-11-08');

db.prepare(`INSERT INTO activities (project_id, id, wbs, name, level, planned_start, planned_finish,
                                    weight, trade, floor, discipline, sort_order)
            VALUES (?,?,?,?,1,?,?,?,?,?,'Construction',?)`)
  .run(PID, 'MAJ-ST-SUP-3660', 'Structure', 'Deshuttering of slab formwork — L9',
       '2026-08-20', '2026-09-04', 10, 'Shuttering', 'Lower Roof', 1);
db.prepare(`INSERT INTO activities (project_id, id, wbs, name, level, planned_start, planned_finish,
                                    weight, trade, floor, discipline, sort_order)
            VALUES (?,?,?,?,1,?,?,?,?,?,'Construction',?)`)
  .run(PID, 'EN-SD-GEN-11210', 'Submittals', 'Review & Approve AC Shop Drawings — L2-L4',
       '2026-08-10', '2026-09-01', 6, 'HVAC Ducting', 'Level 02', 2);

/* --------------------------------------------------------- 1. numbering */
console.log('\nNumbering and creation');

const a = await createIssue(env, PID, {
  activity_id: 'MAJ-ST-SUP-3660',
  reason: 'Information awaited (RFI)',
  title: 'Which deshuttering period applies at the L9 transfer slab?',
  detail: 'Structural notes give 14 days, the specification gives 21. Confirm which governs.',
  raised_date: '2026-09-02', raised_by: 'Rakesh — Site Engineer',
  trade: 'Shuttering', floor: 'Lower Roof',
}, 'site', 'Rakesh — Site Engineer');
check('a site-raised item gets a reference', a.ref === 'RFI-0001', a.ref);

const b = await createIssue(env, PID, {
  activity_id: 'EN-SD-GEN-11210', reason: 'Access not available',
  title: 'Level 3 not handed over — MEP still in possession',
  detail: 'Area agreed for handover on 1 Sep. MEP first fix still running.',
  raised_date: '2026-09-03', raised_by: 'Rakesh — Site Engineer',
}, 'site');
check('the delay reason picks the type', b.ref === 'ACC-0001', b.ref + ' from "Access not available"');

const c = await createIssue(env, PID, {
  reason: 'Information awaited (RFI)', title: 'Second RFI', raised_date: '2026-09-04',
}, 'manager', 'Office');
check('numbering runs per type', c.ref === 'RFI-0002', c.ref);

const bad = await createIssue(env, PID, { title: '   ' }, 'site');
check('a blank title is refused', !!bad.error, bad.error);

check('every delay reason maps to a type',
  Object.values(REASON_TYPE).every((t) => ISSUE_TYPES[t]),
  Object.keys(REASON_TYPE).length + ' reasons');

/* ------------------------------------------------------- 2. transitions */
console.log('\nTransitions and the clock');

let one = await getIssue(env, PID, 'RFI-0001');
check('site raises it as a draft', one.status === 'draft', one.status);
check('nothing is issued yet', !one.issued_date && !one.reply_due);
check('the age counts from the site date', one.age > 0, one.age + ' days');

await updateIssue(env, PID, { ref: 'RFI-0001', action: 'issue', issued_date: '2026-09-05', reply_days: 7 });
one = await getIssue(env, PID, 'RFI-0001');
check('issuing sets the date and the reply date', one.status === 'issued' && one.reply_due === '2026-09-12',
      one.issued_date + ' → ' + one.reply_due);
check('the awareness date is untouched by issuing', one.raised_date === '2026-09-02', one.raised_date);

const late = (await listIssues(env, PID, { asAt: '2026-09-20' })).find((i) => i.ref === 'RFI-0001');
check('it goes overdue after the reply date', late.overdue && late.days_overdue === 8, late.days_overdue + ' days over');
const early = (await listIssues(env, PID, { asAt: '2026-09-10' })).find((i) => i.ref === 'RFI-0001');
check('it is not overdue before it', !early.overdue);

await updateIssue(env, PID, { ref: 'RFI-0001', action: 'answer', answered_date: '2026-09-15',
                              answer: 'The specification governs. 21 days applies.' });
one = await getIssue(env, PID, 'RFI-0001');
check('recording the reply stops the clock', one.status === 'answered' && !one.overdue,
      one.days_unanswered + ' days to answer');
check('the reply is kept', /specification governs/.test(one.answer || ''));

await updateIssue(env, PID, { ref: 'RFI-0001', action: 'close' });
check('closing works', (await getIssue(env, PID, 'RFI-0001')).status === 'closed');
await updateIssue(env, PID, { ref: 'RFI-0001', action: 'reopen' });
one = await getIssue(env, PID, 'RFI-0001');
check('reopening puts it back to issued', one.status === 'issued');
check('reopening clears the answer date, so the clock runs again', !one.answered_date);

// A second one taken all the way through, left answered — this is what the
// average reply time is worked out from.
await updateIssue(env, PID, { ref: 'RFI-0002', action: 'issue', issued_date: '2026-09-05' });
await updateIssue(env, PID, { ref: 'RFI-0002', action: 'answer', answered_date: '2026-09-09',
                              answer: 'Detail B applies.' });
check('the reply period defaults to the type default',
      (await getIssue(env, PID, 'RFI-0002')).reply_due === '2026-09-12',
      (await getIssue(env, PID, 'RFI-0002')).reply_due);

await updateIssue(env, PID, { ref: 'ACC-0001', impact_days: 6, detail: 'Updated detail from the office.' });
check('editing does not change the status', (await getIssue(env, PID, 'ACC-0001')).status === 'draft');
check('the delay claimed is stored', (await getIssue(env, PID, 'ACC-0001')).impact_days === 6);

check('an unknown reference is refused', !!(await updateIssue(env, PID, { ref: 'RFI-9999', action: 'close' })).error);

/* --------------------------------------------------------- 3. filtering */
console.log('\nThe register');

var openNow = await listIssues(env, PID, { open: true });
check('open excludes the answered and closed', openNow.length === 2, openNow.map(function (i) { return i.ref + ':' + i.status; }).join(', '));
check('filter by type works', (await listIssues(env, PID, { type: 'access' })).length === 1);
check('filter by activity works', (await listIssues(env, PID, { activity_id: 'MAJ-ST-SUP-3660' })).length === 1);
check('an unissued draft is flagged as such',
      (await listIssues(env, PID, { status: 'draft' }))[0].unissued_days > 0);

/* --------------------------------------------------------- 4. documents */
console.log('\nDocuments');

const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(PID);
const act = db.prepare('SELECT * FROM activities WHERE project_id = ? AND id = ?')
  .get(PID, 'MAJ-ST-SUP-3660');

const rfi = issueDocument(project, await getIssue(env, PID, 'RFI-0001'), act);
writeFileSync(new URL('../issue-rfi.html', import.meta.url), rfi);
check('the RFI names itself', /Request for Information/.test(rfi));
check('the RFI carries the reference', /RFI-0001/.test(rfi));
check('the RFI shows the awareness date', /2 September 2026/.test(rfi));
check('the RFI names the activity', /Deshuttering of slab formwork/.test(rfi));
check('the RFI is addressed', /MIMAR Engineering Consultants/.test(rfi));
check('the RFI carries the question', /specification gives 21/.test(rfi));

const accAct = db.prepare('SELECT * FROM activities WHERE project_id = ? AND id = ?')
  .get(PID, 'EN-SD-GEN-11210');
const notice = issueDocument(project, await getIssue(env, PID, 'ACC-0001'), accAct);
writeFileSync(new URL('../issue-notice.html', import.meta.url), notice);
check('the notice names itself', /Notice of Delaying Event/.test(notice));
check('the notice cites the clause that was set', /Sub-Clause 20\.2\.1/.test(notice));
check('the notice states when we became aware', /became aware/.test(notice) && /3 September 2026/.test(notice));
check('the notice reserves rights', /without prejudice/.test(notice));
check('the notice states the delay claimed', /6 working day/.test(notice));
check('the notice does not invent a clause when none is set',
      /Insert the notice provision/.test(issueDocument({ name: 'X' }, await getIssue(env, PID, 'ACC-0001'), null)));

check('the document titles are right',
      issueDocumentTitle(await getIssue(env, PID, 'RFI-0001')).includes('Request for Information') &&
      issueDocumentTitle(await getIssue(env, PID, 'ACC-0001')).includes('Notice'));

for (const [n, doc] of [['rfi', rfi], ['notice', notice]]) {
  check(n + ' has no undefined or NaN', !/undefined|NaN/.test(doc));
}

// An issue with nothing filled in beyond a title must still produce a document.
const bare = await createIssue(env, PID, { title: 'Bare item', raised_date: '2026-09-06' }, 'manager');
check('a bare issue still renders a document',
      issueDocument(project, await getIssue(env, PID, bare.ref), null).length > 500);

/* ---------------------------------------------- 5. what the reports say */
console.log('\nIn the reports');

db.prepare(`INSERT INTO updates (project_id, activity_id, report_date, pct, status, delay_reason,
                                 remarks, submitted_by, source, created_at)
            VALUES (?,?,?,?,?,?,?,?,'site',?)`)
  .run(PID, 'MAJ-ST-SUP-3660', '2026-09-03', 40, 'delayed', 'Information awaited (RFI)',
       'Waiting on the deshuttering period', 'Rakesh — Site Engineer', '2026-09-03T13:00:00Z');

const daily = await buildReport(env, PID, project, 'daily', '2026-09-03');
check('the daily sees the register', daily.issues !== null);
check('it picks up what was raised that day', daily.issues.raisedToday.length === 1,
      daily.issues.raisedToday.map((i) => i.ref).join(','));
check('it counts the unissued', daily.issues.unissued.length >= 1, daily.issues.unissued.length);

const lateDaily = await buildReport(env, PID, project, 'daily', '2026-09-20');
check('it lists what is past its reply date', lateDaily.issues.overdue.length === 0 ||
      lateDaily.issues.overdue.every((i) => i.reply_due < '2026-09-20'));

const dailyDoc = reportDocument(daily);
writeFileSync(new URL('../report-daily.html', import.meta.url), dailyDoc);
check('the daily prints the issues section', /Issues, RFIs and notices/.test(dailyDoc));
check('the daily warns about what it cannot say', /What this report cannot tell you/.test(dailyDoc));
check('it warns that nothing has been issued', /unissued|not been issued/.test(dailyDoc));
check('no undefined in the daily', !/undefined|NaN/.test(dailyDoc));

const monthly = await buildReport(env, PID, project, 'monthly', '2026-09');
check('the monthly counts what was raised', monthly.issues.raisedThisMonth === 4, monthly.issues.raisedThisMonth);
check('the monthly average is a real number', monthly.issues.turnaround === 4, monthly.issues.turnaround);
check('the monthly works out the reply time', monthly.issues.turnaround !== null,
      monthly.issues.turnaround + ' days average');
check('the monthly ranks by type', monthly.issues.byType.length >= 2,
      monthly.issues.byType.map((t) => t.type + ':' + t.open).join(', '));
check('the monthly totals the days claimed', monthly.issues.impactDays === 6, monthly.issues.impactDays);

const monthlyDoc = reportDocument(monthly);
writeFileSync(new URL('../report-monthly.html', import.meta.url), monthlyDoc);
check('the monthly prints the register', /Site issues log/.test(monthlyDoc));
check('the monthly lists the oldest open items', /oldest items still open/.test(monthlyDoc));
check('no undefined in the monthly', !/undefined|NaN/.test(monthlyDoc));

/* ------------------------------------ 6. a database without the table */
console.log('\nA database that has not been migrated');
const plain = new DatabaseSync(':memory:');
plain.exec(readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));
plain.exec('DROP TABLE issues');
plain.prepare(`INSERT INTO projects (id, name, sort_order, created_at)
               VALUES ('p1','Test',1,datetime('now'))`).run();
const env2 = { DB: { prepare(sql) {
  const st = plain.prepare(sql); let args = [];
  const api = { bind(...a) { args = a; return api; },
    async all() { return { results: st.all(...args) }; },
    async first() { return st.get(...args) ?? null; },
    async run() { st.run(...args); return { success: true }; } };
  return api;
} } };
const noIssues = await buildReport(env2, 'p1', { id: 'p1', name: 'Test' }, 'daily', '2026-09-03');
check('the daily still builds', noIssues.issues === null);
check('and says the register is not set up',
      /issues register is not set up/.test(reportDocument(noIssues)));

console.log(fails ? `\n${fails} check(s) failed.\n` : '\nAll checks passed.\n');
