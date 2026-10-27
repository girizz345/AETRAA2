// THE INTAKE ENDPOINTS, THROUGH THE REAL ROUTER.
//
//   node tools/test-intake-api.mjs
//
// The unit tests in test-intake.mjs prove the engine. These prove the door:
// that permission is checked at the SERVER on every path, that a scan through
// the real HTTP surface still writes no register row, and that a commit routes
// to the importers that already exist.
//
// The permission checks are the point. "The DC's batch is drawings-only" is
// only true if the server enforces it — a hidden upload button is not a
// permission, and anyone can post to an endpoint.
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';

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
  const req = new Request('https://x' + path, {
    method: method || (body ? 'POST' : 'GET'),
    headers, body: body ? JSON.stringify(body) : undefined,
  });
  const res = await worker.fetch(req, env, { waitUntil() {} });
  const sc = res.headers.get('set-cookie');
  if (sc) cookie = sc.split(';')[0];
  let j = null;
  try { j = await res.json(); } catch (e) {}
  return { status: res.status, body: j };
}

const b64 = (s) => Buffer.from(s, 'utf8').toString('base64');
const countRows = (t) => { try { return db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get().n; } catch (e) { return 0; } };

console.log('\n— signing in as AETRAA —');
{
  const r = await call('/api/login', { code: env.OWNER_CODE });
  check('the owner code signs in', r.status === 200, JSON.stringify(r.body));
}

// A project to drop files onto.
let pid = null;
console.log('\n— a project, with its numbering configured —');
{
  const r = await call('/api/setup/onboard', {
    company: { name: 'Contracting Company LLC', email_domain: 'contractor.ae' },
    project: { name: 'Tower A', ref: 'AET-001', location: 'UAE' },
    principal: { name: 'Project Director', email: 'pd@contractor.ae' },
  });
  pid = r.body && (r.body.project_id || (r.body.project && r.body.project.id));
  check('the project was created', !!pid, JSON.stringify(r.body).slice(0, 200));

  if (pid) {
    const rules = await call('/api/setup/rules?project=' + pid,
      { rules: [{ match: 'ST', on: 'number', discipline: 'Structural' }] });
    check('its drawing numbering is set', rules.status === 200, JSON.stringify(rules.body));
    const got = await call('/api/setup/rules?project=' + pid);
    check('and reads back as configured', got.body && got.body.configured === true, JSON.stringify(got.body));
  }
}

console.log('\n— open a batch —');
let batchId = null;
{
  const r = await call('/api/intake/batch', { project_id: pid });
  batchId = r.body && r.body.id;
  check('AETRAA gets a batch', r.status === 200 && !!batchId, JSON.stringify(r.body));
  check('and it is a full-scope batch', r.body.scope === 'full', r.body.scope);

  const bad = await call('/api/intake/batch', { project_id: 'nope' });
  check('an unknown project is refused', bad.status === 404, String(bad.status));
}

console.log('\n— scan through the real endpoint writes no register row —');
{
  const beforeD = countRows('drawings'), beforeL = countRows('library');

  const d = await call('/api/intake/scan', {
    batch_id: batchId, project_id: pid, filename: 'ST-101 Rev C.pdf', path: '/Drawings/',
    data: b64('sheet'), probe: { pages: 1, page: { width: 2384, height: 1684 }, drawingNumber: 'ST-101' },
  });
  check('a drawing scans', d.status === 200 && d.body.family === 'drawing', JSON.stringify(d.body));
  check('and matches the project’s numbering', d.body.verdict === 'match', d.body.verdict);

  const x = await call('/api/intake/scan', {
    batch_id: batchId, project_id: pid, filename: 'ME-900.pdf', path: '/Drawings/',
    data: b64('sheet2'), probe: { pages: 1, page: { width: 2384, height: 1684 }, drawingNumber: 'ME-900' },
  });
  check('another project’s numbering is a conflict', x.body.verdict === 'conflict', JSON.stringify(x.body));

  const m = await call('/api/intake/scan', {
    batch_id: batchId, project_id: pid, filename: 'O&M Chillers.pdf', path: '/Handover/',
    data: b64('manual'), probe: { pages: 120, page: { width: 595, height: 842 }, text: 'operation and maintenance' },
  });
  check('an O&M manual is recognised', m.body.family === 'handover', JSON.stringify(m.body));

  check('NO drawing row was written', countRows('drawings') === beforeD,
    beforeD + ' -> ' + countRows('drawings'));
  check('NO library row was written', countRows('library') === beforeL,
    beforeL + ' -> ' + countRows('library'));
}

console.log('\n— the SERVER reads the file; the browser is not trusted —');
{
  const { buildXlsx } = await import('../src/xlsx.js');
  const wb = buildXlsx([{ name: 'BOQ', rows: [
    ['Section', 'Ref', 'Description', 'Unit', 'Qty', 'Rate', 'Amount'],
    ['A', '1.1', 'Concrete', 'm3', 100, 350, 35000]] }]);
  const data = Buffer.from(wb).toString('base64');

  // No probe supplied at all: the server must work it out from the bytes.
  const r = await call('/api/intake/scan', {
    batch_id: batchId, project_id: pid, filename: 'Priced BOQ.xlsx', data,
  });
  check('a real workbook is classified with no help from the browser',
    r.body.family === 'commercial', JSON.stringify(r.body));

  // A browser claiming something else must not be believed.
  const lie = await call('/api/intake/scan', {
    batch_id: batchId, project_id: pid, filename: 'Priced BOQ 2.xlsx', data,
    probe: { header: ['nothing'], rowCount: 0, text: 'conditions of contract retention' },
  });
  check('a browser-supplied probe does not override the real bytes',
    lie.body.family === 'commercial', JSON.stringify(lie.body));
}

console.log('\n— the review screen reads the batch —');
let items = [];
{
  const r = await call('/api/intake/batch?id=' + batchId);
  check('the batch reads back', r.status === 200, String(r.status));
  items = (r.body && r.body.items) || [];
  check('with every file scanned so far', items.length === 5, String(items.length));
  check('and a summary in five groups', r.body.counts && r.body.counts.total === items.length,
    JSON.stringify(r.body.counts));
  check('the conflict is counted as held', r.body.counts.held === 1, JSON.stringify(r.body.counts));
  check('every item says why it was classified as it was',
    items.every((i) => (i.reason || '').length > 0));
}

console.log('\n— commit files, holds, and routes —');
{
  const lib = items.find((i) => i.family === 'handover');
  const conflict = items.find((i) => i.verdict === 'conflict');
  const drawing = items.find((i) => i.family === 'drawing' && i.verdict === 'match');

  const beforeD = countRows('drawings');
  const r = await call('/api/intake/commit', { batch_id: batchId, ids: [lib.id, conflict.id, drawing.id] });
  check('commit returns a result per item', r.body.results && r.body.results.length === 3,
    JSON.stringify(r.body).slice(0, 200));

  const by = Object.fromEntries(r.body.results.map((x) => [x.id, x]));
  check('the O&M manual reached the library', by[lib.id].ok && /library/.test(by[lib.id].where || ''),
    JSON.stringify(by[lib.id]));
  check('a library row now exists', countRows('library') >= 1);
  check('the conflict was HELD, not filed', by[conflict.id].held === true, JSON.stringify(by[conflict.id]));
  check('and its reason travelled with it', !!by[conflict.id].reason);
  check('the matching drawing reached the register', by[drawing.id].ok === true, JSON.stringify(by[drawing.id]));
  check('so the register grew by exactly one', countRows('drawings') === beforeD + 1,
    beforeD + ' -> ' + countRows('drawings'));

  const held = await call('/api/quarantine?all=1');
  check('the held item is in the Admin queue',
    (held.body.items || []).some((h) => /ME-900/.test(h.filename || '')), JSON.stringify(held.body).slice(0, 200));
}

console.log('\n— re-dropping the same folder is safe —');
{
  const r = await call('/api/intake/commit', { batch_id: batchId, ids: items.map((i) => i.id) });
  check('every already-filed item is a no-op',
    r.body.results.filter((x) => x.already || x.state === 'held').length >= 2,
    JSON.stringify(r.body.results));
  check('and no duplicate library rows appeared', countRows('library') === 1, String(countRows('library')));
}

console.log('\n— the permission boundary, enforced at the server —');
{
  const adminCookie = cookie;

  // A real site person on this project: may view the register, may not load
  // drawings. Created through the normal route so the session is a real one.
  const made = await call('/api/person', {
    project_id: pid, name: 'Site Engineer', email: 'site@contractor.ae', role: 'site',
  });
  cookie = '';
  await call('/api/signin/start', { email: 'site@contractor.ae' });
  const site = await call('/api/signin/code', { email: 'site@contractor.ae', code: env.LOGIN_TEST_CODE });
  if (site.status !== 200) {
    check('a non-admin session could be established', false,
      JSON.stringify({ made: made.body, signin: site.body }).slice(0, 250));
  } else {
    const b = await call('/api/intake/batch', { project_id: pid });
    check('site cannot open an intake batch', b.status === 403, String(b.status));
    const s = await call('/api/intake/scan', { batch_id: batchId, project_id: pid, filename: 'x.pdf' });
    check('site cannot scan', s.status === 403, String(s.status));
    const c = await call('/api/intake/commit', { batch_id: batchId, ids: [] });
    check('site cannot commit', c.status === 403, String(c.status));
    const rules = await call('/api/setup/rules?project=' + pid, { rules: [{ match: 'ZZ' }] });
    check('site cannot change the numbering rules', rules.status === 403 || rules.status === 401,
      String(rules.status));
  }
  cookie = adminCookie;
}

console.log('\n— a BOQ actually reaches the bill, with the right money in it —');
{
  const { buildXlsx } = await import('../src/xlsx.js');
  const wb = buildXlsx([{ name: 'BOQ', rows: [
    ['Section', 'Ref', 'Description', 'Unit', 'Qty', 'Rate', 'Amount'],
    ['A', '1.1', 'Concrete C40 in foundations', 'm3', 100, 350, 35000],
    ['', '1.2', 'Formwork to foundations', 'm2', 200, 90, 18000],
    ['', '', 'SUBTOTAL', '', '', '', 53000],
    ['B', '2.1', 'Blockwork 200mm', 'm2', 450, 55, 24750],
  ] }]);
  const b = await call('/api/intake/batch', { project_id: pid });
  const sc = await call('/api/intake/scan', {
    batch_id: b.body.id, project_id: pid, filename: 'Priced BOQ.xlsx',
    data: Buffer.from(wb).toString('base64'),
  });
  check('the workbook is recognised as commercial', sc.body.family === 'commercial', JSON.stringify(sc.body));

  const rev = await call('/api/intake/batch?id=' + b.body.id);
  const item = (rev.body.items || []).find((i) => i.family === 'commercial');
  const r = await call('/api/intake/commit', { batch_id: b.body.id, ids: [item.id] });
  check('it files to the priced BOQ', r.body.results[0].ok && /priced BOQ/.test(r.body.results[0].where || ''),
    JSON.stringify(r.body.results[0]));

  const lines = db.prepare('SELECT * FROM boq WHERE project_id = ? ORDER BY sort_order').all(pid);
  check('THREE lines landed, not zero', lines.length === 3, String(lines.length));
  check('the subtotal was not imported as an item',
    !lines.some((l) => /subtotal/i.test(l.description)), JSON.stringify(lines.map((l) => l.description)));
  check('the first line carries its real figures',
    lines[0].qty === 100 && lines[0].rate === 350 && lines[0].amount === 35000, JSON.stringify(lines[0]));
  check('the continuation line with a blank section is NOT shifted',
    lines[1].unit === 'm2' && lines[1].qty === 200 && lines[1].rate === 90, JSON.stringify(lines[1]));
  check('the bill totals what the workbook says',
    lines.reduce((t, l) => t + l.amount, 0) === 77750,
    String(lines.reduce((t, l) => t + l.amount, 0)));

  // The failure that started all this: a workbook with no readable lines must
  // say so, not report success on an empty import.
  const empty = buildXlsx([{ name: 'S', rows: [['Notes'], ['nothing here']] }]);
  const b2 = await call('/api/intake/batch', { project_id: pid });
  await call('/api/intake/scan', { batch_id: b2.body.id, project_id: pid,
    filename: 'Notes.xlsx', data: Buffer.from(empty).toString('base64') });
  const rev2 = await call('/api/intake/batch?id=' + b2.body.id);
  const it2 = rev2.body.items[0];
  if (it2 && it2.family === 'commercial') {
    const r2 = await call('/api/intake/commit', { batch_id: b2.body.id, ids: [it2.id] });
    check('a workbook with no priced lines fails with an explanation',
      !r2.body.results[0].ok && /no priced lines/.test(r2.body.results[0].error || ''),
      JSON.stringify(r2.body.results[0]));
  } else {
    check('a workbook with no priced lines is not taken for a BOQ', true);
  }
}

console.log('\n— draft first, and going live is a deliberate act —');
{
  const r = await call('/api/setup/onboard', {
    company_id: null,
    company: { name: 'Second Contractor LLC', email_domain: 'two.ae' },
    project: { name: 'Tower C', ref: 'AET-003', setup_state: 'draft' },
    principal: { name: 'Director', email: 'd@two.ae' },
  });
  const dpid = r.body && r.body.project_id;
  check('a draft project can be created', !!dpid, JSON.stringify(r.body).slice(0, 160));

  const row = db.prepare('SELECT setup_state FROM projects WHERE id = ?').get(dpid);
  check('and it really is a draft in the row', row.setup_state === 'draft', row.setup_state);

  const live = await call('/api/setup/golive', { project_id: dpid });
  check('it can be taken live', live.status === 200 && live.body.state === 'live',
    JSON.stringify(live.body));
  const after = db.prepare('SELECT setup_state FROM projects WHERE id = ?').get(dpid);
  check('the row says live', after.setup_state === 'live', after.setup_state);

  const again = await call('/api/setup/golive', { project_id: dpid });
  check('taking an already-live project live is a no-op, not an error',
    again.body.already === true, JSON.stringify(again.body));

  check('the warning about an unconfigured gate is carried',
    Array.isArray(live.body.warnings), JSON.stringify(live.body.warnings));
}

console.log('\n— the intake page is AETRAA-only —');
{
  const admin = cookie;
  const ok = await worker.fetch(new Request('https://x/intake', { headers: { cookie: admin } }), env, { waitUntil() {} });
  const okText = await ok.text();
  check('AETRAA gets the intake page', /Project intake|Drop the folder/.test(okText), String(ok.status));

  const anon = await worker.fetch(new Request('https://x/intake'), env, { waitUntil() {} });
  const anonText = await anon.text();
  check('a stranger gets the sign-in page instead',
    !/Drop the folder/.test(anonText), anonText.slice(0, 120));
  cookie = admin;
}

console.log(`\n${checks - fails}/${checks} checks passed`);
process.exit(fails ? 1 : 0);
