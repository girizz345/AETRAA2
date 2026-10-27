// END-TO-END: boots the REAL worker with a REAL database and calls its REAL
// HTTP endpoints. Everything else in tools/ tests modules in isolation; this
// tests the program.
//
//   node tools/test-live.mjs
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { build } from 'esbuild';

let fails = 0, checks = 0;
const check = (n, c, d) => { checks++; console.log((c ? '  ok   ' : '  FAIL ') + n + (d && !c ? '  — ' + d : '')); if (!c) fails++; };

// 1. bundle the worker exactly as it would deploy
await build({
  entryPoints: [new URL('../src/index.js', import.meta.url).pathname],
  bundle: true, format: 'esm', platform: 'neutral',
  outfile: '/tmp/live-worker.mjs', logLevel: 'silent',
});
console.log('  ok   worker bundles');
checks++;

// 2. a real D1-shaped database over node:sqlite, and an R2-shaped bucket
const db = new DatabaseSync(':memory:');
const schema = readFileSync(new URL('../schema.sql', import.meta.url), 'utf8');
db.exec(schema);
function stmt(sql) {
  const st = db.prepare(sql); let args = [];
  const api = {
    bind(...a) { args = a; return api; },
    async all() { return { results: st.all(...args), success: true }; },
    async first(col) { const r = st.get(...args) ?? null; return col && r ? r[col] : r; },
    async run() { st.run(...args); return { success: true, meta: {} }; },
    async raw() { return st.all(...args).map((r) => Object.values(r)); },
  };
  return api;
}
const bucket = new Map();
const env = {
  DB: {
    prepare: stmt,
    async batch(list) { const out = []; for (const s2 of list) out.push(await s2.run()); return out; },
    async exec(sql) { db.exec(sql); return { count: 1 }; },
  },
  DRAWINGS: {
    async put(k, v) { bucket.set(k, new Uint8Array(v)); return { key: k }; },
    async get(k) { const v = bucket.get(k); return v ? { async arrayBuffer() { return v.buffer.slice(v.byteOffset, v.byteOffset + v.byteLength); }, body: v } : null; },
    async delete(k) { bucket.delete(k); },
  },
  OWNER_CODE: 'MASTERCODE', LOGIN_TEST_CODE: '246810', SESSION_SECRET: 'test-secret-value',
};
const worker = (await import('/tmp/live-worker.mjs')).default;
const ctx = { waitUntil() {}, passThroughOnException() {} };
const tbl = db.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type='table'").get();
check('real schema loads', tbl.n > 10, 'tables=' + tbl.n);

const BASE = 'http://localhost';
let cookie = '';
async function call(path, opts = {}) {
  const headers = Object.assign({}, opts.headers || {});
  if (cookie) headers.Cookie = cookie;
  if (opts.body) headers['Content-Type'] = 'application/json';
  const res = await worker.fetch(new Request(BASE + path, { method: opts.method || 'GET', headers, body: opts.body }), env, ctx);
  const sc = res.headers.get('set-cookie');
  if (sc) cookie = sc.split(',').map((c) => c.split(';')[0].trim()).join('; ');
  const text = await res.text();
  let json = null; try { json = JSON.parse(text); } catch (e) {}
  return { status: res.status, text, json };
}

// 3. the app actually serves
let r = await call('/');
check('GET / responds', r.status === 200, 'status=' + r.status);
check('signed-out visitor gets a sign-in page', /sign in|Sign in|email/i.test(r.text));

// 4. AETRAA Admin logs in with the master code
r = await call('/api/login', { method: 'POST', body: JSON.stringify({ code: 'MASTERCODE' }) });
check('AETRAA Admin master login works', r.status === 200 && r.json && r.json.ok !== false, r.text.slice(0, 120));
r = await call('/');
check('Admin lands on the Setup console', /AETRAA Admin|Onboard a project/.test(r.text), r.text.slice(0, 200));

// 5. onboard a real client end to end over HTTP
r = await call('/api/setup/onboard', { method: 'POST', body: JSON.stringify({
  company: { name: 'NAF Contracting LLC', country: 'AE' },
  project: { name: 'NAF Tower', ref: 'DIA-R-0270', location: 'Dubai', client_name: 'DID',
    consultant_name: 'DEC', contractor_name: 'NAF', currency: 'AED',
    retention_pct: 10, retention_limit_pct: 5, payment_days: 56 },
  principal: { name: 'M. Al Nuaimi', email: 'principal@naf.ae' },
}) });
check('onboarding over HTTP', r.status === 200 && r.json && r.json.ok === true, r.text.slice(0, 200));
const PID = r.json && r.json.project_id;
check('project id returned', !!PID, String(PID));

// 6. the Principal can actually sign in with the email that was created
const adminCookie = cookie; cookie = '';
r = await call('/api/signin/code', { method: 'POST', body: JSON.stringify({ email: 'principal@naf.ae', code: '246810' }) });
check('Principal signs in by email', r.status === 200 && r.json && r.json.ok === true, r.text.slice(0, 160));
check('Principal gets the owner role', r.json && r.json.role === 'owner', JSON.stringify(r.json));
const principalCookie = cookie;

// 7. THE RULE: a Principal must NOT be able to create a project
r = await call('/api/project', { method: 'POST', body: JSON.stringify({ action: 'create', name: 'Sneaky Project' }) });
check('a Principal CANNOT create a project', r.status === 403 && r.json && r.json.error,
  'status=' + r.status + ' body=' + r.text.slice(0, 120));
{ const save = cookie; cookie = adminCookie;
  const ra = await call('/api/project', { method: 'POST', body: JSON.stringify({ action: 'create', name: 'Admin Project' }) });
  check('but the AETRAA Admin still CAN', ra.status === 200 && ra.json && ra.json.ok === true, 'status=' + ra.status + ' ' + ra.text.slice(0, 120));
  cookie = save; }

// 8. back as Admin: import a BOQ over HTTP
cookie = adminCookie;
r = await call('/api/boq/import', { method: 'POST', body: JSON.stringify({ project_id: PID, rows: [
  { section: 'Structure', ref: 'C1', qty: 1, rate: 10000000 },
  { section: 'MEP', ref: 'M1', qty: 1, rate: 5000000 },
] }) });
check('BOQ imports over HTTP', r.status === 200 && r.json && r.json.ok === true, r.text.slice(0, 160));
check('BOQ value correct', r.json && r.json.value === 15000000, String(r.json && r.json.value));

// 9. import a BOM, then the over-BOM warning through the API
r = await call('/api/bom/import', { method: 'POST', body: JSON.stringify({ project_id: PID, rows: [
  { ref: 'M1', material: 'Rebar B500B', unit: 'ton', budget_qty: 100, rate: 2600 },
] }) });
check('BOM imports over HTTP', r.status === 200 && r.json && r.json.ok === true, r.text.slice(0, 160));

r = await call('/api/bom/check?project=' + PID, { method: 'POST', body: JSON.stringify({ material: 'Rebar B500B', qty: 150 }) });
check('over-BOM warning returned by the API', r.json && r.json.warning === true, r.text.slice(0, 200));
check('warning states the overrun', r.json && r.json.over_by === 50, String(r.json && r.json.over_by));

// 10. a site engineer must NOT reach the BOM
cookie = '';
await call('/api/person', { method: 'POST', headers: { Cookie: adminCookie }, body: JSON.stringify({}) });
cookie = adminCookie;
r = await call('/api/person', { method: 'POST', body: JSON.stringify({
  name: 'R. Kumar', email: 'civil@naf.ae', functions: ['site'], groups: ['Civil'], projects: [PID] }) });
check('Admin creates a site engineer', r.status === 200 && !(r.json && r.json.error), r.text.slice(0, 160));
r = await call('/api/person', { method: 'POST', body: JSON.stringify({
  name: 'A. Haddad', email: 'pm@naf.ae', functions: ['pm'], groups: [], projects: [PID] }) });
check('Admin creates a Project Manager', r.status === 200 && !(r.json && r.json.error), r.text.slice(0, 160));
cookie = '';
r = await call('/api/signin/code', { method: 'POST', body: JSON.stringify({ email: 'civil@naf.ae', code: '246810' }) });
check('site engineer signs in', r.json && r.json.ok === true, r.text.slice(0, 160));
r = await call('/api/bom');
check('site engineer is REFUSED the BOM', r.status === 403, 'status=' + r.status + ' ' + r.text.slice(0, 120));

// 11. records: create one over HTTP and read it back
r = await call('/api/records', { method: 'POST', body: JSON.stringify({
  type: 'wir', title: 'L5 slab pre-pour', data: { 'Activity / element': 'L5 slab', Discipline: 'Civil' } }) });
check('a record is created over HTTP', r.status === 200 && r.json && r.json.ok === true, r.text.slice(0, 200));
const WIR = r.json && r.json.ref;
check('record numbered', /^WIR-\d+$/.test(String(WIR)), String(WIR));
r = await call('/api/records');
check('record reads back', r.json && (r.json.records || []).some((x) => x.ref === WIR), r.text.slice(0, 160));

// 12. the document generation route (no template uploaded yet -> must say so)
r = await call('/api/record/doc?ref=' + WIR);
check('doc route answers without a template', r.status === 404 && /template/i.test(r.text), 'status=' + r.status + ' ' + r.text.slice(0, 140));

// 13. IPC access control: a site engineer must not reach payment
r = await call('/api/ipc');
check('site engineer is REFUSED payment', r.status === 403, 'status=' + r.status);

// 14. attachments, over HTTP — the WIR "with all attachments" requirement.
{
  const b64 = Buffer.from(new Uint8Array(20000).map((_, i) => (i * 11) % 256)).toString('base64');
  r = await call('/api/attachment', { method: 'POST', body: JSON.stringify({
    ref: WIR, filename: 'L4 slab pre-pour.pdf', mime: 'application/pdf', file_b64: b64 }) });
  check('the site engineer can attach a file to their WIR', r.status === 200 && r.json && r.json.ok === true, r.text.slice(0, 200));
  const AID = r.json && r.json.id;

  r = await call('/api/attachments?ref=' + WIR);
  check('it is listed against the record', r.json && (r.json.attachments || []).length === 1, r.text.slice(0, 200));
  check('with a size a person can read', r.json && /KB|MB|B$/.test((r.json.attachments[0] || {}).size_text || ''),
    r.json && r.json.attachments[0] && r.json.attachments[0].size_text);

  r = await call('/api/record?ref=' + WIR);
  check('and it travels with the record itself', r.json && (r.json.attachments || []).length === 1, r.text.slice(0, 200));

  const res = await worker.fetch(new Request('http://x/attachment/' + AID, { headers: { Cookie: cookie } }), env, ctx);
  check('the file downloads', res.status === 200, 'status=' + res.status);
  check('it is served as a DOWNLOAD, never inline',
    /^attachment;/.test(res.headers.get('content-disposition') || ''), res.headers.get('content-disposition'));
  check('and the browser is told not to sniff it',
    res.headers.get('x-content-type-options') === 'nosniff', res.headers.get('x-content-type-options'));
  check('the bytes are the ones that went up', (await res.arrayBuffer()).byteLength === 20000);

  // an executable must not get in, whatever it calls itself
  r = await call('/api/attachment', { method: 'POST', body: JSON.stringify({
    ref: WIR, filename: 'invoice.pdf.exe', mime: 'application/pdf', file_b64: b64 }) });
  check('an executable is REFUSED over HTTP too', r.status === 400, 'status=' + r.status + ' ' + r.text.slice(0, 140));
}

// 15. record actions. Approving is the office's act — the man who raised the
// inspection must not be able to sign it off himself.
r = await call('/api/record/advance', { method: 'POST', body: JSON.stringify({ ref: WIR, action: 'advance' }) });
check('a site engineer CANNOT approve his own inspection', r.status === 403,
  'status=' + r.status + ' ' + r.text.slice(0, 160));
r = await call('/api/record?ref=' + WIR);
const beforeStatus = r.json && r.json.record && r.json.record.status;

cookie = '';
r = await call('/api/signin/code', { method: 'POST', body: JSON.stringify({ email: 'pm@naf.ae', code: '246810' }) });
check('the PM signs in', r.json && r.json.ok === true, r.text.slice(0, 160));
r = await call('/api/record/advance', { method: 'POST', body: JSON.stringify({ ref: WIR, action: 'advance' }) });
check('the PM CAN approve it', r.status === 200 && r.json && r.json.ok === true, r.text.slice(0, 200));
r = await call('/api/record?ref=' + WIR);
check('and the record really moved', r.json && r.json.record && r.json.record.status !== beforeStatus,
  beforeStatus + ' → ' + (r.json && r.json.record && r.json.record.status));
// The step carries the name of the man who signed it, not his job title —
// that is the whole reason for accounts.
check('with the approver NAMED against the step',
  r.json && (r.json.record.workflow || []).some((s) => (s.who || '').includes('A. Haddad')),
  JSON.stringify((r.json && r.json.record.workflow) || []).slice(0, 220));

// rejecting is recorded as a rejection, not as progress
r = await call('/api/records', { method: 'POST', body: JSON.stringify({ type: 'ncr', title: 'Blockwork alignment' }) });
const NCR = r.json && r.json.ref;
r = await call('/api/record/advance', { method: 'POST', body: JSON.stringify({ ref: NCR, action: 'reject' }) });
check('a record can be rejected', r.status === 200 && /reject/i.test(String(r.json && r.json.status)),
  r.text.slice(0, 160));

// the document route: a missing template must NAME what is missing
r = await call('/api/record/doc?ref=' + WIR);
check('a missing template is named, not just "failed"',
  r.status === 404 && /template.*(inspection|wir)/i.test(r.text), r.text.slice(0, 200));

// and with a template uploaded, a real .docx comes back
{
  const { zipSync, strToU8 } = await import('fflate');
  const docXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' +
    '<w:p><w:r><w:t>Inspection {{ref}} on {{project_name}} — {{title}}</w:t></w:r></w:p>' +
    '</w:body></w:document>';
  const docx = zipSync({
    '[Content_Types].xml': strToU8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'),
    '_rels/.rels': strToU8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'),
    'word/document.xml': strToU8(docXml),
  });
  cookie = '';
  await call('/api/login', { method: 'POST', body: JSON.stringify({ code: 'MASTERCODE' }) });
  const adminCookie = cookie;
  r = await call('/api/setup/template', { method: 'POST', body: JSON.stringify({
    project_id: PID, doc_type: 'wir', filename: 'NAF WIR.docx',
    file_b64: Buffer.from(docx).toString('base64') }) });
  check('the consultant WIR template uploads', r.status === 200 && r.json && r.json.ok === true, r.text.slice(0, 200));

  const res = await worker.fetch(new Request('http://x/api/record/doc?ref=' + WIR, { headers: { Cookie: adminCookie } }), env, ctx);
  check('the document is produced', res.status === 200, 'status=' + res.status);
  check('it is a Word file', /wordprocessingml/.test(res.headers.get('content-type') || ''), res.headers.get('content-type'));
  check('named after the record', /filename="WIR-\d+\.docx"/.test(res.headers.get('content-disposition') || ''),
    res.headers.get('content-disposition'));
  const bytes = new Uint8Array(await res.arrayBuffer());
  check('it is a real .docx, not an error page', bytes[0] === 0x50 && bytes[1] === 0x4b, 'PK header');
  const { unzipSync, strFromU8 } = await import('fflate');
  const inner = strFromU8(unzipSync(bytes)['word/document.xml']);
  check('the placeholders were actually filled', inner.includes(WIR) && inner.includes('NAF Tower'),
    inner.slice(inner.indexOf('<w:t>'), inner.indexOf('<w:t>') + 160));
  check('and no placeholder survived into the document', !/\{\{\w+\}\}/.test(inner),
    (inner.match(/\{\{\w+\}\}/) || ['none'])[0]);
}

// 16. THE ACCESS MATRIX, over real HTTP. The module test proves the table;
// this proves the API actually consults it.
{
  cookie = adminCookie;
  for (const [name, email, fns] of [
    ['Design', 'design@naf.ae', ['design']],
    ['QA/QC', 'qaqc@naf.ae', ['qaqc']],
    ['HSE', 'hse@naf.ae', ['hse']],
  ]) {
    r = await call('/api/person', { method: 'POST', body: JSON.stringify({
      name: name + ' user', email, functions: fns, groups: [], projects: [PID] }) });
  }

  const as = async (email) => {
    cookie = '';
    await call('/api/signin/code', { method: 'POST', body: JSON.stringify({ email, code: '246810' }) });
  };
  const raise = (type) => call('/api/records', { method: 'POST',
    body: JSON.stringify({ type, title: 'matrix probe ' + type }) });

  await as('design@naf.ae');
  r = await raise('submittal');
  check('[HTTP] Design CAN raise a submittal', r.status === 200 && r.json && r.json.ok, r.text.slice(0, 140));
  r = await raise('ptw');
  check('[HTTP] Design canNOT raise a permit to work', r.status === 403, 'status=' + r.status + ' ' + r.text.slice(0, 140));
  check('[HTTP] and the refusal NAMES who can', /HSE/.test(r.text), r.text.slice(0, 160));
  r = await raise('ncr');
  check('[HTTP] Design canNOT raise an NCR', r.status === 403, 'status=' + r.status);

  await as('hse@naf.ae');
  r = await raise('ptw');
  check('[HTTP] HSE CAN raise a permit to work', r.status === 200 && r.json && r.json.ok, r.text.slice(0, 140));
  const PTW = r.json && r.json.ref;
  r = await raise('variation');
  check('[HTTP] HSE canNOT raise a variation', r.status === 403, 'status=' + r.status);

  await as('qaqc@naf.ae');
  r = await raise('ncr');
  check('[HTTP] QA/QC CAN raise an NCR', r.status === 200 && r.json && r.json.ok, r.text.slice(0, 140));
  const NCR2 = r.json && r.json.ref;
  // the jam this also clears: QA/QC closing its own NCR
  r = await call('/api/record/advance', { method: 'POST', body: JSON.stringify({ ref: NCR2, action: 'advance' }) });
  check('[HTTP] QA/QC CAN now close its own NCR', r.status === 200 && r.json && r.json.ok,
    'until now only the PM could move any record — ' + r.text.slice(0, 140));
  // but not somebody else's permit
  r = await call('/api/record/advance', { method: 'POST', body: JSON.stringify({ ref: PTW, action: 'advance' }) });
  check('[HTTP] QA/QC canNOT sign HSE’s permit', r.status === 403, 'status=' + r.status + ' ' + r.text.slice(0, 140));

  // the PM holds every folder
  await as('pm@naf.ae');
  r = await call('/api/record/advance', { method: 'POST', body: JSON.stringify({ ref: PTW, action: 'advance' }) });
  check('[HTTP] the PM CAN approve anything', r.status === 200 && r.json && r.json.ok, r.text.slice(0, 140));

  // a record that does not exist must not be approvable into existence
  r = await call('/api/record/advance', { method: 'POST', body: JSON.stringify({ ref: 'NOPE-999', action: 'advance' }) });
  check('[HTTP] approving a record that does not exist is refused', r.status === 404, 'status=' + r.status);

  // and a made-up record type cannot be smuggled in
  r = await raise('not_a_real_type');
  check('[HTTP] an unknown record type is refused', r.status >= 400, 'status=' + r.status + ' ' + r.text.slice(0, 140));

  // the AETRAA Admin is never locked out of his own platform
  cookie = '';
  await call('/api/login', { method: 'POST', body: JSON.stringify({ code: 'MASTERCODE' }) });
  r = await raise('ptw');
  check('[HTTP] the AETRAA Admin is NOT locked out by the matrix', r.status === 200 && r.json && r.json.ok,
    'he signs in with the master code and has no user row at all — ' + r.text.slice(0, 140));
}

// 17. the file store, over HTTP. This is the call that has to be trusted at
// go-live on Oracle, so it is checked here on the real worker.
cookie = '';
await call('/api/signin/code', { method: 'POST', body: JSON.stringify({ email: 'civil@naf.ae', code: '246810' }) });
r = await call('/api/storage');
check('a site engineer cannot probe the file store', r.status === 401, 'status=' + r.status);

cookie = '';
r = await call('/api/login', { method: 'POST', body: JSON.stringify({ code: 'MASTERCODE' }) });
r = await call('/api/storage');
check('the file store reports itself to the AETRAA Admin', r.status === 200, 'status=' + r.status + ' ' + r.text.slice(0, 160));
check('and it really round-trips a file', r.json && r.json.working === true, r.text.slice(0, 200));
check('it names the driver in plain words', r.json && /database|object storage/.test(r.json.label || ''), r.json && r.json.label);
check('nothing is left behind after the probe', r.json && r.json.round_trip && r.json.round_trip.removed === true, r.text.slice(0, 200));

// and the failure that matters: configured for object storage, but it is not
// reachable. The platform must say so rather than quietly using the database.
{
  const bad = { ...env, S3_ENDPOINT: 'http://127.0.0.1:1', S3_BUCKET: 'aetraa-uae',
    S3_ACCESS_KEY: 'a', S3_SECRET_KEY: 'b' };
  const res = await worker.fetch(new Request('http://x/api/storage', { headers: { Cookie: cookie } }), bad, ctx);
  const j = await res.json().catch(() => ({}));
  check('a misconfigured object store is REPORTED, not hidden',
    j.configured === 's3' && j.wrote_to !== 's3' && typeof j.note === 'string' && j.note.length > 10,
    JSON.stringify(j).slice(0, 240));
  check('and it is NOT called working just because the file survived',
    j.working === false && res.status === 500, 'working=' + j.working + ' status=' + res.status);
}

console.log('\n' + checks + ' checks, ' + fails + ' failures');
process.exit(fails ? 1 : 0);
