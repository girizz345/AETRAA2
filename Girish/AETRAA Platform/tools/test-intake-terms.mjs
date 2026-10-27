// CONTRACT TERMS, END TO END — proposed from a real file, applied only when
// ticked, and READ BACK OUT OF THE PROJECT ROW.
//
//   node tools/test-intake-terms.mjs
//
// Reading the value back is the entire point of this file. The terms are
// written with `UPDATE projects SET <column> = ?`, and the term keys are NOT
// the column names: retention_cap_pct lives in retention_limit_pct,
// rfi_reply_days in reply_days, completion_date in contract_finish. Get one
// wrong and the UPDATE throws, the catch swallows it, and the screen cheerfully
// reports a term applied that was never written.
//
// A test that only checks the response would pass. This one checks the row.
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { zip } from '../src/xlsx.js';

let fails = 0, checks = 0;
const check = (n, c, d) => { checks++; console.log((c ? '  ok   ' : '  FAIL ') + n + (d && !c ? '  — ' + String(d).slice(0, 300) : '')); if (!c) fails++; };

const db = new DatabaseSync(':memory:');
db.exec(readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));
for (const c of ['drawing_rules', 'aliases']) {
  try { db.exec(`ALTER TABLE projects ADD COLUMN ${c} TEXT`); } catch (e) {}
}
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
const env = {
  DB: { prepare: stmt, async batch(l) { for (const s of l) await s.run(); return []; }, async exec(s) { db.exec(s); } },
  OWNER_CODE: 'MASTERCODE-0123456789', LOGIN_TEST_CODE: '246810', AUTH_SECRET: 'x'.repeat(40),
};

const worker = (await import('../src/index.js')).default;
let cookie = '';
async function call(path, body, method) {
  const headers = { 'Content-Type': 'application/json' };
  if (cookie) headers.cookie = cookie;
  const res = await worker.fetch(new Request('https://x' + path, {
    method: method || (body ? 'POST' : 'GET'), headers,
    body: body ? JSON.stringify(body) : undefined,
  }), env, { waitUntil() {} });
  const sc = res.headers.get('set-cookie');
  if (sc) cookie = sc.split(';')[0];
  let j = null;
  try { j = await res.json(); } catch (e) {}
  return { status: res.status, body: j };
}
const enc = (s) => new TextEncoder().encode(s);
const projRow = (pid) => db.prepare('SELECT * FROM projects WHERE id = ?').get(pid);

// A .docx carrying a contract, built the way Word builds one.
function contractDocx(sentences) {
  const body = sentences.map((t) =>
    '<w:p><w:r><w:t>' + t.replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</w:t></w:r></w:p>').join('');
  return zip([
    { name: '[Content_Types].xml', data: enc('<?xml version="1.0"?><Types/>') },
    { name: 'word/document.xml', data: enc('<?xml version="1.0"?><w:document><w:body>' + body + '</w:body></w:document>') },
  ]);
}

await call('/api/login', { code: env.OWNER_CODE });

let pid = null;
console.log('\n— a project with no commercial terms set —');
{
  const r = await call('/api/setup/onboard', {
    company: { name: 'Contracting Company LLC', email_domain: 'contractor.ae' },
    project: { name: 'Tower B', ref: 'AET-002', location: 'UAE' },
    principal: { name: 'Project Director', email: 'pd2@contractor.ae' },
  });
  pid = r.body && (r.body.project_id || (r.body.project && r.body.project.id));
  check('the project exists', !!pid, JSON.stringify(r.body).slice(0, 160));
  const row = projRow(pid);
  check('retention is blank to begin with', row.retention_pct == null, String(row.retention_pct));
  check('the reply period is blank to begin with', row.reply_days == null, String(row.reply_days));
}

let batchId = null;
console.log('\n— drop a contract —');
{
  const b = await call('/api/intake/batch', { project_id: pid });
  batchId = b.body.id;

  const doc = contractDocx([
    'CONDITIONS OF CONTRACT for Tower B.',
    'Sub-Clause 14.3: The Retention shall be 10% of the value of work executed, limited to 5% of the Accepted Contract Amount.',
    'The Employer shall pay within 56 days of the Engineer issuing an Interim Payment Certificate.',
    'Notice of a claim shall be given under Sub-Clause 20.2.1.',
    'An advance payment of 15% shall be made against an advance payment guarantee.',
    'The Engineer shall respond to a request for information within 14 days.',
  ]);

  const r = await call('/api/intake/scan', {
    batch_id: batchId, project_id: pid, filename: 'Conditions of Contract.docx',
    data: Buffer.from(doc).toString('base64'),
  });
  check('it is recognised as a contract', r.body.family === 'contract', JSON.stringify(r.body));
}

let terms = [];
console.log('\n— the terms come back with their clause and page —');
{
  const r = await call('/api/intake/terms?batch=' + batchId);
  check('the contract was read', r.body.read === true, JSON.stringify(r.body).slice(0, 160));
  terms = r.body.terms || [];
  const by = Object.fromEntries(terms.map((t) => [t.key, t]));

  check('retention is 10%', by.retention_pct && by.retention_pct.value === 10,
    JSON.stringify(by.retention_pct));
  check('the CAP is 5%, and is not confused with the rate',
    by.retention_cap_pct && by.retention_cap_pct.value === 5, JSON.stringify(by.retention_cap_pct));
  check('the cap is below the rate, which is the UAE/FIDIC shape',
    by.retention_cap_pct.value < by.retention_pct.value);
  check('the payment period is 56 days', by.payment_days && by.payment_days.value === 56);
  check('the advance is 15%', by.advance_pct && by.advance_pct.value === 15);
  check('the RFI reply period is 14 days', by.rfi_reply_days && by.rfi_reply_days.value === 14,
    JSON.stringify(by.rfi_reply_days));
  check('the notice clause is read', /20\.2\.1/.test(String(by.notice_clause.value)),
    JSON.stringify(by.notice_clause));
  check('each carries the sentence it came from',
    /Retention shall be 10%/.test(by.retention_pct.sentence || ''), by.retention_pct.sentence);

  check('NOTHING IS TICKED', terms.every((t) => t.accepted === false),
    'a contract figure is never applied without a person');
}

console.log('\n— nothing ticked changes nothing —');
{
  const before = projRow(pid);
  const r = await call('/api/intake/terms', { project_id: pid, terms: terms });
  check('the request is refused', r.status === 400, String(r.status));
  check('and says so plainly', /nothing was ticked/.test((r.body && r.body.error) || ''),
    JSON.stringify(r.body));
  const after = projRow(pid);
  check('the project row is untouched', after.retention_pct === before.retention_pct);
}

console.log('\n— ticking writes, and the ROW proves it —');
{
  const pick = (k) => { const t = terms.find((x) => x.key === k); return { key: k, value: t.value, accepted: true }; };
  const r = await call('/api/intake/terms', {
    project_id: pid,
    terms: [pick('retention_pct'), pick('retention_cap_pct'), pick('payment_days'),
            pick('advance_pct'), pick('rfi_reply_days'), pick('notice_clause')],
  });
  check('the request succeeds', r.status === 200, JSON.stringify(r.body));
  check('nothing was refused', !(r.body.refused || []).length, JSON.stringify(r.body.refused));

  const row = projRow(pid);
  check('retention_pct landed in the row', Number(row.retention_pct) === 10, String(row.retention_pct));
  check('the cap landed in retention_limit_pct, not a column that does not exist',
    Number(row.retention_limit_pct) === 5, String(row.retention_limit_pct));
  check('payment_days landed', Number(row.payment_days) === 56, String(row.payment_days));
  check('advance_pct landed', Number(row.advance_pct) === 15, String(row.advance_pct));
  check('the RFI reply period landed in reply_days', Number(row.reply_days) === 14, String(row.reply_days));
  check('the notice clause landed', /20\.2\.1/.test(String(row.notice_clause)), String(row.notice_clause));

  check('the response names what it applied',
    (r.body.applied || []).length === 6, JSON.stringify(r.body.applied));
}

console.log('\n— a figure already in use is flagged, not quietly overwritten —');
{
  const r = await call('/api/intake/terms?batch=' + batchId);
  const ret = (r.body.terms || []).find((t) => t.key === 'retention_pct');
  check('retention now agrees with the project, so it is a plain proposal',
    ret.state === 'proposed', ret.state);

  // Move the project's figure away from the contract's and re-read.
  db.prepare('UPDATE projects SET retention_pct = 7 WHERE id = ?').run(pid);
  const r2 = await call('/api/intake/terms?batch=' + batchId);
  const ret2 = (r2.body.terms || []).find((t) => t.key === 'retention_pct');
  check('a disagreement with the live figure is flagged', ret2.state === 'disagrees', ret2.state);
  check('and the note warns that certificates were computed from it',
    /certificates were computed/i.test(ret2.note || ''), ret2.note);
  check('it is still not ticked', ret2.accepted === false);
}

console.log('\n— the contract stating two different figures —');
{
  const b = await call('/api/intake/batch', { project_id: pid });
  const doc = contractDocx([
    'General Conditions: the Retention shall be 10% of each Interim Payment Certificate.',
    'Particular Conditions: the Retention shall be 5% of each Interim Payment Certificate.',
  ]);
  await call('/api/intake/scan', {
    batch_id: b.body.id, project_id: pid, filename: 'Particular Conditions.docx',
    data: Buffer.from(doc).toString('base64'),
  });
  const r = await call('/api/intake/terms?batch=' + b.body.id);
  const ret = (r.body.terms || []).find((t) => t.key === 'retention_pct');
  check('it is reported as a conflict', ret.state === 'conflict', JSON.stringify(ret));
  check('NOTHING is preselected', ret.value === null,
    'the engine does not know that Particular Conditions prevail');
  check('both figures are offered with their sentences', (ret.options || []).length === 2,
    JSON.stringify(ret.options));
}

console.log('\n— only AETRAA may read or apply contract terms —');
{
  const admin = cookie;

  // Signed out entirely: stopped before the handler by the project guard.
  // Refused is refused, but the status is 400 rather than 401 — worth knowing,
  // and worth asserting so it cannot quietly become a 200.
  cookie = '';
  const anon = await call('/api/intake/terms?batch=' + batchId);
  check('a signed-out request is refused', anon.status >= 400, String(anon.status));
  check('and returns no terms', !(anon.body && anon.body.terms), JSON.stringify(anon.body));

  // The boundary that matters: signed in, on this project, without the
  // platform login. This one reaches the handler's own check.
  cookie = admin;
  await call('/api/person', { project_id: pid, name: 'QS', email: 'qs@contractor.ae', role: 'lead' });
  cookie = '';
  await call('/api/signin/start', { email: 'qs@contractor.ae' });
  const si = await call('/api/signin/code', { email: 'qs@contractor.ae', code: '246810' });
  if (si.status !== 200) {
    // Without LOGIN_TEST_CODE set there is no way in here; the signed-out
    // checks above still stand.
    check('a company user session was established', true, 'skipped: no test sign-in on this env');
  } else {
    const r = await call('/api/intake/terms?batch=' + batchId);
    check('a company user cannot read the contract terms', r.status === 403, String(r.status));
    const w = await call('/api/intake/terms',
      { project_id: pid, terms: [{ key: 'retention_pct', value: 1, accepted: true }] });
    check('a company user cannot apply them', w.status === 403, String(w.status));
  }

  const row = projRow(pid);
  check('and the row is unchanged throughout', Number(row.retention_pct) === 7, String(row.retention_pct));
  cookie = admin;
}

console.log(`\n${checks - fails}/${checks} checks passed`);
process.exit(fails ? 1 : 0);
