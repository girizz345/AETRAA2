// The two intake fixes of 6 Oct 2026, through the real router.
//   node tools/test-intake-fixes.mjs
//   1. Another company's DC cannot open, scan, confirm or read stamps on a
//      project or batch that is not theirs.
//   2. Contract terms are read from a compressed PDF, with the real page.
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';

let fails = 0, checks = 0;
const check = (n, c, d) => { checks++; console.log((c ? '  ok   ' : '  FAIL ') + n + (d && !c ? '  — ' + String(d).slice(0, 300) : '')); if (!c) fails++; };

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
const admin = async () => { cookie = ''; await call('/api/login', { code: env.OWNER_CODE }); };
const as = async (email) => { cookie = ''; return (await call('/api/signin/code', { email, code: '246810' })).json?.ok; };

// Two companies, each with a project and a Document Controller.
await admin();
let r = await call('/api/setup/onboard', { company: { name: 'Company A LLC' },
  project: { name: 'Tower A', ref: 'AAA-0001' }, principal: { name: 'A Principal', email: 'p@a.test' } });
const PA = r.json.project_id, OA = db.prepare('SELECT org_id FROM projects WHERE id = ?').get(r.json.project_id).org_id;
r = await call('/api/person', { org: OA, name: 'A DC', email: 'dc@a.test', functions: ['dc'], projects: [PA] });
check('A’s DC is added', r.status === 200, r.text);
r = await call('/api/setup/onboard', { company: { name: 'Company B LLC' },
  project: { name: 'Tower B', ref: 'BBB-0001' }, principal: { name: 'B Principal', email: 'p@b.test' } });
const PB = r.json.project_id, OB = db.prepare('SELECT org_id FROM projects WHERE id = ?').get(r.json.project_id).org_id;
r = await call('/api/person', { org: OB, name: 'B DC', email: 'dc@b.test', functions: ['dc'], projects: [PB] });
check('B’s DC is added', r.status === 200, r.text);
check('two projects in two companies', !!PA && !!PB && PA !== PB);
// Draft projects take no sign-ins; go-live itself is not what is under test here.
db.prepare("UPDATE projects SET setup_state = 'live' WHERE id IN (?, ?)").run(PA, PB);
// Spec §25: company B's DC drops drawings, so bulk loading is switched on for B's project.
{ const row = db.prepare('SELECT modules FROM projects WHERE id = ?').get(PB); let on = [];
  try { const j = JSON.parse(row.modules || 'null'); on = Array.isArray(j) ? j : (j && j.on) || []; } catch (e) { on = []; }
  db.prepare('UPDATE projects SET modules = ? WHERE id = ?').run(JSON.stringify({ v: 3, on: on.concat(['bulkload']) }), PB); }

// Company A's own batch, opened by AETRAA.
r = await call('/api/intake/batch', { project_id: PA });
const batchA = r.json && r.json.id;
check('AETRAA opens a batch on Tower A', r.status === 200 && !!batchA, r.text);

console.log('\n— company B’s DC against company A —');
check('B’s DC signs in', await as('dc@b.test'));
r = await call('/api/intake/batch', { project_id: PA });
check('cannot open a batch on A’s project', r.status === 403, r.status + ' ' + r.text);
r = await call('/api/intake/scan', { batch_id: batchA, project_id: PA, filename: 'X-1.pdf', data: 'eA==' });
check('cannot scan into A’s project', r.status === 403, r.status + ' ' + r.text);
r = await call('/api/intake/scan', { batch_id: batchA, project_id: PB, filename: 'X-1.pdf', data: 'eA==' });
check('cannot scan into A’s batch under its own project id', r.status === 404, r.status + ' ' + r.text);
r = await call('/api/intake/confirm', { batch_id: batchA, items: [{ id: 'x' }] });
check('cannot confirm items in A’s batch', r.status === 404, r.status + ' ' + r.text);
r = await call('/api/intake/stamps', { batch_id: batchA });
check('cannot run the AI stamp reader on A’s batch', r.status === 404, r.status + ' ' + r.text);
r = await call('/api/intake/batch?id=' + batchA);
check('cannot read A’s batch', r.status === 403, r.status + ' ' + r.text);
const itemsInA = db.prepare('SELECT COUNT(*) AS n FROM intake_item WHERE batch_id = ?').get(batchA).n;
check('nothing was written into A’s batch', itemsInA === 0, itemsInA);

console.log('\n— and their own project still works —');
r = await call('/api/intake/batch', {});
const batchB = r.json && r.json.id;
check('B’s DC opens a batch on their own project', r.status === 200 && !!batchB, r.text);
r = await call('/api/intake/scan', { batch_id: batchB, filename: 'ST-101.pdf', path: '/Drawings/', data: 'eA==' });
check('and scans into it', r.status === 200 && r.json && r.json.ok, r.status + ' ' + r.text);

console.log('\n— contract terms from a compressed PDF —');
await admin();
const pdf = readFileSync(new URL('./fixtures/contract-test.pdf', import.meta.url));
check('the test contract’s text is compressed (old reader saw nothing)', !pdf.includes(Buffer.from('Retention')));
r = await call('/api/intake/scan', { batch_id: batchA, project_id: PA, filename: 'Contract Agreement.pdf',
  path: '/Contract/', data: pdf.toString('base64') });
check('the contract scans as a contract', r.status === 200 && r.json.family === 'contract', r.text);
r = await call('/api/intake/terms?batch=' + batchA);
const ret = (r.json && r.json.terms || []).find((t) => t.key === 'retention_pct');
const notice = (r.json && r.json.terms || []).find((t) => t.key === 'notice_clause');
check('the contract was read', r.json && r.json.read === true, r.text);
check('retention 10% is proposed', ret && ret.value === 10, JSON.stringify(ret));
check('on page 3, where it is written', ret && ret.page === 3, JSON.stringify(ret));
check('with its sentence', ret && /Retention money shall be 10%/.test(ret.sentence || ''), JSON.stringify(ret));
check('and not ticked', ret && ret.accepted === false);
check('the notice clause is found too', notice && /20\.2\.1/.test(String(notice.value)), JSON.stringify(notice));

console.log('\n' + checks + ' checks, ' + fails + ' failures');
process.exit(fails ? 1 : 0);
