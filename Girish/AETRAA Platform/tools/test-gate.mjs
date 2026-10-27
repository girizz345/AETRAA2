// THE GATE, THE QUARANTINE AND THE PROJECT LIBRARY.
//
//   node tools/test-gate.mjs
//
// A contractor running three projects and paying for one has an obvious move:
// file the other two into the project they bought. These are the checks that
// say they cannot — and, just as important, the checks that say honest work is
// never held, because a gate that stops real work twice is one the document
// controller routes around.
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { checkIncoming, rulesOf, configured, widenedRules, foreignRefs, prefixOf } from '../src/gate.js';
import { groupByReason } from '../src/quarantine.js';
import { CLASSES } from '../src/library.js';

let fails = 0, checks = 0;
const check = (n, c, d) => { checks++; console.log((c ? '  ok   ' : '  FAIL ') + n + (d && !c ? '  — ' + String(d).slice(0, 300) : '')); if (!c) fails++; };

const db = new DatabaseSync(':memory:');
db.exec(readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));
try { db.exec('ALTER TABLE projects ADD COLUMN drawing_rules TEXT'); } catch (e) {}
try { db.exec('ALTER TABLE projects ADD COLUMN aliases TEXT'); } catch (e) {}
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
  const headers = {};
  if (cookie) headers.Cookie = cookie;
  if (body) headers['Content-Type'] = 'application/json';
  const res = await worker.fetch(new Request('http://localhost' + path,
    { method: method || (body ? 'POST' : 'GET'), headers, body: body ? JSON.stringify(body) : undefined }), env, { waitUntil() {} });
  const sc = res.headers.get('set-cookie');
  if (sc) cookie = sc.split(',').map((x) => x.split(';')[0].trim()).join('; ');
  const text = await res.text(); let json = null; try { json = JSON.parse(text); } catch (e) {}
  return { status: res.status, text, json };
}
const as = async (email) => { cookie = ''; return (await call('/api/signin/code', { email, code: '246810' })).json?.ok; };
const pdf = (n = 200) => 'data:application/pdf;base64,' + Buffer.alloc(n, 7).toString('base64');

/* ===================================== the match test, in isolation */
const proj = { id: 'p1', ref: 'DIA-R-0270', name: 'Residential Tower',
  drawing_rules: JSON.stringify([
    { match: 'ST', on: 'number', discipline: 'Structural', trade_group: 'Civil' },
    { match: 'ME', on: 'number', discipline: 'MEP', trade_group: 'MEP' }]) };

check('a project with rules is configured', configured(proj) && rulesOf(proj).length === 2);
check('a project without rules is not', !configured({ id: 'p2', ref: 'X-1' }));

check('a drawing on the scheme MATCHES',
  checkIncoming(proj, { kind: 'drawing', number: 'ST-101', filename: 'ST-101 rev C.pdf' }).verdict === 'match');
check('a drawing off the scheme CONFLICTS',
  checkIncoming(proj, { kind: 'drawing', number: 'SUB-101', filename: 'SUB-101.pdf' }).verdict === 'conflict');
check('the conflict says which schemes this project uses',
  /ST, ME/.test(checkIncoming(proj, { kind: 'drawing', number: 'SUB-101', filename: 'SUB-101.pdf' }).reason));

// P5: hold for a reason, never by default.
check('an unconfigured project holds NOTHING, it only says so',
  checkIncoming({ id: 'p2', ref: 'X-1' }, { kind: 'drawing', number: 'ZZ-9', filename: 'ZZ-9.pdf' }).verdict === 'unknown');
check('a drawing with no readable number is UNKNOWN, not held',
  checkIncoming(proj, { kind: 'drawing', number: '', filename: 'Scan_0012.pdf' }).verdict === 'unknown');
check('a document that is not a drawing is UNKNOWN',
  checkIncoming(proj, { kind: 'contract', filename: 'Conditions.pdf' }).verdict === 'unknown');

/* ---- a foreign project reference beats everything */
check('a document naming another project CONFLICTS',
  checkIncoming(proj, { kind: 'contract', filename: 'x.pdf', text: 'Project DIA-R-0271 conditions' }).verdict === 'conflict');
check('a document naming THIS project does not',
  checkIncoming(proj, { kind: 'contract', filename: 'x.pdf', text: 'Project DIA-R-0270 conditions' }).verdict === 'unknown');
check('ordinary prose is not mistaken for a project reference',
  foreignRefs('Please see clause 20.2.1 and the attached programme', proj).length === 0,
  JSON.stringify(foreignRefs('Please see clause 20.2.1 and the attached programme', proj)));
check('a drawing on the scheme is not held because a foreign-looking string appears',
  checkIncoming(proj, { kind: 'drawing', number: 'ST-101', filename: 'ST-101.pdf' }).verdict === 'match');

/* ---- widening */
const wide = widenedRules(proj, 'SUB', 'Architectural', 'Architecture');
check('widening adds the rule that would have matched', wide.some((r) => r.match === 'SUB'));
check('widening keeps the rules already there', wide.length === 3);
check('widening a prefix already known changes nothing', widenedRules(proj, 'ST', 'Structural') === null);
const widened = { ...proj, drawing_rules: JSON.stringify(wide) };
check('after widening, the same sheet files',
  checkIncoming(widened, { kind: 'drawing', number: 'SUB-102', filename: 'SUB-102.pdf' }).verdict === 'match');

check('prefixes are read for grouping', prefixOf('SUB-101') === 'SUB' && prefixOf('ST-1') === 'ST');
const grouped = groupByReason([
  { id: 'a', kind: 'drawing', prefix: 'SUB', reason: 'r', project_id: 'p', filename: 'a.pdf' },
  { id: 'b', kind: 'drawing', prefix: 'SUB', reason: 'r', project_id: 'p', filename: 'b.pdf' },
  { id: 'c', kind: 'drawing', prefix: 'FA', reason: 'r2', project_id: 'p', filename: 'c.pdf' }]);
check('held items group by reason so one decision covers many',
  grouped.length === 2 && grouped[0].count === 2, JSON.stringify(grouped.map((g) => g.count)));

/* ===================================== end to end, through the API */
await call('/api/login', { code: 'MASTERCODE-0123456789' });
let r = await call('/api/setup/onboard', {
  company: { name: 'Contracting Company LLC' }, project: { name: 'Residential Tower', ref: 'DIA-R-0270' },
  principal: { name: 'The Principal', email: 'principal@demo.test' } });
const P = r.json.project_id;
for (const [n, e, f] of [
  ['Project Manager', 'pm@demo.test', ['pm']],
  ['Document Controller', 'dc@demo.test', ['dc']],
  ['Design Manager', 'design@demo.test', ['design']],
  ['Consultant', 'cons@demo.test', ['consultant']],
]) await call('/api/person', { name: n, email: e, functions: f, projects: [P] });

// Before rules are set, the gate says so rather than pretending to protect.
r = await call('/api/setup/rules?project=' + P);
check('the gate reports itself as not configured', r.json.configured === false, r.text);

r = await call('/api/setup/rules', { project: P, rules: [
  { match: 'ST', discipline: 'Structural', trade_group: 'Civil' },
  { match: 'ME', discipline: 'MEP', trade_group: 'MEP' }] });
check('the numbering scheme saves', r.status === 200 && r.json.rules.length === 2, r.text);

await as('dc@demo.test');
r = await call('/api/drawing', { number: 'ST-101', revision: 'A', title: 'L5 beam layout',
  kind: 'ifc', data: pdf(), filename: 'ST-101 rev A.pdf' });
check('a drawing on the scheme is filed', r.status === 200 && r.json.id && !r.json.held, r.text);

r = await call('/api/drawing', { number: 'SUB-101', revision: 'A', title: "Subcontractor's shop drawing",
  kind: 'shop', data: pdf(), filename: 'SUB-101.pdf' });
check('a drawing off the scheme is HELD, not filed', r.status === 200 && r.json.held === true, r.text);
check('the hold is not an error — the sender is told what happened',
  !r.json.error && /does not use/.test(r.json.reason || ''), r.text);
const qid = r.json.quarantine_id;

r = await call('/api/drawings');
check('the held sheet is in NO register', !(r.json.drawings || []).some((d) => d.number === 'SUB-101'),
  JSON.stringify((r.json.drawings || []).map((d) => d.number)));

r = await call('/api/quarantine');
check('the document controller can see it is held, and why',
  r.json.items.length === 1 && /SUB-101/.test(r.json.items[0].filename), r.text);
check('but may not decide it', r.json.may_decide === false);

r = await call('/api/quarantine/decide', { id: qid, action: 'approve' });
check('the contractor cannot release a held document', r.status === 403, r.text);

/* ---- only the Admin decides, and widening stops it recurring */
await call('/api/login', { code: 'MASTERCODE-0123456789' });
r = await call('/api/quarantine/decide', { id: qid, action: 'reject' });
check('a rejection with no reason is refused', r.status === 400 && /say why/.test(r.json.error || ''), r.text);

r = await call('/api/quarantine/decide', { id: qid, action: 'approve_widen',
  discipline: 'Architectural', trade_group: 'Architecture' });
check('approve-and-widen files it', r.status === 200 && r.json.filed.length === 1, r.text);
check('and teaches the project the rule', (r.json.widened_rule || []).some((x) => x.match === 'SUB'), r.text);

await as('dc@demo.test');
r = await call('/api/drawings');
check('the approved sheet is now in the register', (r.json.drawings || []).some((d) => d.number === 'SUB-101'));

r = await call('/api/drawing', { number: 'SUB-102', revision: 'A', title: 'Another shop drawing',
  kind: 'shop', data: pdf(), filename: 'SUB-102.pdf' });
check('the NEXT sheet of the same shape is not held again',
  r.status === 200 && !r.json.held && r.json.id, r.text);

/* ---- the test that protects the gate from a future change */
check('the single-drawing upload path is the gated path',
  readFileSync(new URL('../src/drawings.js', import.meta.url), 'utf8').includes('checkIncoming('),
  'the gate must live inside saveDrawing, not beside a caller');

/* ===================================== the project library */
r = await call('/api/library', { class: 'contract', title: 'Conditions of Contract',
  reference: 'DIA-R-0270/C', doc_date: '2026-01-15', filename: 'conditions.pdf',
  mime: 'application/pdf', data: pdf(400) });
check('a contract can be filed — it had nowhere to go before', r.status === 200 && r.json.id, r.text);

r = await call('/api/library', { class: 'bond', title: 'Performance bond', data: pdf(120) });
check('so can a bond', r.status === 200 && r.json.id, r.text);

r = await call('/api/library', { class: 'contract', title: 'Conditions again', data: pdf(400) });
check('the same file is not filed twice', r.json.already === true, r.text);

r = await call('/api/library', { class: 'contract', title: '' });
check('a document without a title is refused', r.status === 400, r.text);

r = await call('/api/library');
check('the library lists what is filed', r.json.documents.length === 2, r.text);
check('it is grouped by class for the screen',
  r.json.summary.by_class.contract === 1 && r.json.summary.by_class.bond === 1, JSON.stringify(r.json.summary));
check('every class has a label a person can read',
  Object.keys(CLASSES).every((k) => CLASSES[k] && CLASSES[k].length > 3));

const docId = r.json.documents.find((d) => d.class === 'contract').id;
const res = await worker.fetch(new Request('http://localhost/api/library/file?id=' + docId,
  { headers: { Cookie: cookie } }), env, { waitUntil() {} });
check('the filed document can be opened again',
  res.status === 200 && (res.headers.get('Content-Type') || '').includes('pdf'), res.status);

await as('cons@demo.test');
r = await call('/api/library', { class: 'report', title: 'Something from the consultant', data: pdf(50) });
check('a read-only login files nothing', r.status === 403, r.text);
r = await call('/api/library');
check('but may read the library', r.status === 200 && r.json.documents.length === 2, r.text);

/* ---- tenant isolation: another company cannot reach any of it */
await call('/api/login', { code: 'MASTERCODE-0123456789' });
r = await call('/api/setup/onboard', {
  company: { name: 'Another Contractor LLC' }, project: { name: 'Other Tower', ref: 'OTH-R-0001' },
  principal: { name: 'Other Principal', email: 'principal@other.test' } });
const P2 = r.json.project_id;
await call('/api/person', { name: 'Other DC', email: 'dc@other.test', functions: ['dc'], projects: [P2] });
await as('dc@other.test');
r = await call('/api/library');
check('another company sees none of the first project’s library',
  (r.json.documents || []).length === 0, r.text);
r = await call('/api/quarantine');
check('nor any of its held items', (r.json.items || []).length === 0, r.text);

console.log('\n' + checks + ' checks, ' + fails + ' failures');
process.exit(fails ? 1 : 0);
