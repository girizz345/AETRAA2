// The K-series work (K1–K13) once more, end to end on PostgreSQL (PGlite, in
// memory) through the platform's own adapter (src/db-postgres.js) — the live
// server runs on PostgreSQL, and SQL that works on SQLite does not always.
// Each task adds its section here as it is built.
//   node tools/test-pg-k-series.mjs       (needs ../../prelaunch's node_modules for PGlite)
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { makePostgres } from '../src/db-postgres.js';
import { buildXlsx } from '../src/xlsx.js';

const req = createRequire(new URL('../../../prelaunch/package.json', import.meta.url));
const { PGlite } = await import(pathToFileURL(req.resolve('@electric-sql/pglite')).href);
const pg = await PGlite.create();
const env = { DB: makePostgres(pg), OWNER_CODE: 'MASTERCODE-0123456789', LOGIN_TEST_CODE: '246810', AUTH_SECRET: 'x'.repeat(40) };
await env.DB.exec(readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));
const q = async (sql, args = []) => (await pg.query(sql, args)).rows;

let fails = 0, checks = 0;
const check = (n, c, d) => { checks++; console.log((c ? '  ok   ' : '  FAIL ') + n + (d !== undefined && !c ? '  — ' + String(typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 300) : '')); if (!c) fails++; };
const worker = (await import('../src/index.js')).default;
let cookie = '';
async function call(path, body) {
  const headers = {}; if (cookie) headers.Cookie = cookie; if (body) headers['Content-Type'] = 'application/json';
  const res = await worker.fetch(new Request('http://localhost' + path, { method: body ? 'POST' : 'GET', headers, body: body ? JSON.stringify(body) : undefined }), env, { waitUntil() {} });
  const sc = res.headers.get('set-cookie'); if (sc) cookie = sc.split(',').map((x) => x.split(';')[0].trim()).join('; ');
  const bytes = new Uint8Array(await res.arrayBuffer()); const text = new TextDecoder().decode(bytes);
  let json = null; try { json = JSON.parse(text); } catch (e) {}
  return { status: res.status, text, json, bytes };
}
const admin = async () => { cookie = ''; await call('/api/login', { code: env.OWNER_CODE }); };
const as = async (email) => { cookie = ''; return (await call('/api/signin/code', { email, code: '246810' })).json?.ok; };
const b64 = (u8) => Buffer.from(u8).toString('base64');

console.log('— set-up on PostgreSQL —');
await admin();
let r = await call('/api/setup/onboard', { company: { name: 'PK Co LLC' }, project: { name: 'PK Tower', ref: 'PKT-0001' }, principal: { name: 'PK Principal', email: 'principal@pk.test' } });
const pid = r.json && r.json.project_id;
check('a project on PostgreSQL', !!pid, r.text);
const oid = (await q('SELECT org_id FROM projects WHERE id = $1', [pid]))[0].org_id;
await q("UPDATE projects SET setup_state = 'live' WHERE id = $1", [pid]);
for (const [n, e, f] of [['The QS', 'qs@pk.test', ['commercial']], ['The Buyer', 'buyer@pk.test', ['procurement']], ['The PM', 'pm@pk.test', ['pm']]]) {
  await call('/api/person', { org: oid, name: n, email: e, functions: f, projects: [pid] });
}

console.log('\n— K1 E7/E8 the BOQ and the BOM —');
// A AED 60m bill: past what a 4-byte integer holds in fils.
const H = ['Ref', 'Description', 'Unit', 'Qty', 'Rate', 'Amount'];
const bill = buildXlsx([{ name: 'Bill 1', rows: [H,
  ['1.1', 'Concrete grade C40 in slab', 'm3', 100000, 600.01, 60001000],
  ['1.2', 'Hardcore filling', 'm3', 20, 30, 650],
  ['1.3', 'Paint', 'm2', 0.1, 1000, 100], ['1.4', 'Skirting', 'm', 0.2, 1000, 200]] }]);
await as('qs@pk.test');
r = await call('/api/bills/upload', { kind: 'boq', filename: 'BOQ.xlsx', data: b64(bill) });
check('a bill is read and checked', r.status === 200 && r.json.line_count === 4 && r.json.flags_open === 1 && r.json.total === '60,001,950.00', r.text.slice(0, 300));
const id = r.json.id;
r = await call('/api/bills/accept', { id, all: true, note: 'Agreed at tender' });
check('a flag is accepted with a reason', r.status === 200 && r.json.flags_open === 0, r.text.slice(0, 200));
r = await call('/api/bills/commit', { id });
check('imported, and waiting for the PM', r.status === 200 && r.json.state === 'pending' && r.json.value === 60001950, r.text);
r = await call('/api/bills');
check('its state', r.status === 200 && r.json.boq.state === 'pending' && r.json.boq.lines === 4 && r.json.boq.total === '60,001,950.00', r.text.slice(0, 300));
r = await call('/api/boq');
check('the register total to the fil', r.json.totals.value === 60001950, r.json.totals);
r = await call('/api/ipc/propose', {});
check('no IPC while it waits', r.status === 400 && /waiting for the PM/.test(r.json.error), r.text);
await as('pm@pk.test');
r = await call('/api/bills/approve', { kind: 'boq' });
check('the PM approves', r.status === 200 && r.json.state === 'approved', r.text);
r = await call('/api/attention');
check('Needs my attention builds', r.status === 200, r.text.slice(0, 200));
await as('buyer@pk.test');
const bom = new TextEncoder().encode('Material,Unit,Budget qty,BOQ ref\n"Ready-mix concrete, C40",m3,100000,1.1\nHardcore,m3,25,\nScaffold tube,m,400,\n');
r = await call('/api/bills/upload', { kind: 'bom', filename: 'BOM.csv', data: b64(bom) });
r = await call('/api/bills/commit', { id: r.json.id });
check('the BOM is imported and matched', r.status === 200 && r.json.matched === 1 && r.json.proposed === 1, r.text);
r = await call('/api/bills/match', { confirm_all: true });
r = await call('/api/bills/match', { mkey: 'scaffold tube', not_in_boq: 'Temporary works' });
check('every material resolved', r.status === 200 && r.json.matching.open === 0, r.text.slice(0, 300));
await as('pm@pk.test');
r = await call('/api/bills/approve', { kind: 'bom' });
check('the BOM approved', r.status === 200, r.text);
await as('buyer@pk.test');
await call('/api/bom/order', { material: 'Hardcore', qty: '0.1' });
await call('/api/bom/order', { material: 'Hardcore', qty: '0.2' });
r = await call('/api/bom');
check('0.1 + 0.2 ordered is 0.3', r.json.lines.find((l) => l.mkey === 'hardcore').ordered_qty === 0.3, r.json.lines);
await admin();
r = await call('/api/setup/payment-terms?project=' + pid);
check('the contract sum in fils', r.status === 200 && r.json.contract === 60001950, r.text.slice(0, 200));
r = await call('/api/admin-home');
check('the admin home builds', r.status === 200, r.text.slice(0, 200));

console.log('\n— K5 imported records —');
await call('/api/person', { org: oid, name: 'The DC', email: 'dc@pk.test', functions: ['dc'], projects: [pid] });
await call('/api/person', { org: oid, name: 'The Designer', email: 'design@pk.test', functions: ['design'], projects: [pid] });
await as('dc@pk.test');
r = await call('/api/records/import', { records: [
  { type: 'rfi', ref: 'J179-RFI-ARC-0042', title: 'Slab edge', original_date: '2025-10-01', original_status: 'Open', data: { 'Required reply by': '2025-10-08' }, imported_from: { file: 'log.xlsx', row: 3 } },
  { type: 'incident', ref: 'INC-003', title: 'Fall', original_date: '2026-10-01', data: { Type: 'Lost-time injury' } }] });
check('records imported on PostgreSQL', r.status === 200 && r.json.imported.length === 2 && r.json.highest.rfi.next === 'RFI-0043', r.text.slice(0, 300));
r = await call('/api/records/import', { records: [{ type: 'rfi', ref: 'j179-rfi-arc-0042' }] });
check('a reference is never filed twice', r.status === 400 && r.json.refused[0].duplicate === true, r.text.slice(0, 200));
r = await call('/api/attention');
check('no attention item for it', r.status === 200 && !(r.json.items || []).some((i) => /0042/.test(i.ref)), r.text.slice(0, 200));
r = await call('/api/record/advance', { ref: 'J179-RFI-ARC-0042', action: 'advance' });
check('nothing is signed on it', r.status === 403, r.status);
await as('pm@pk.test');
for (const k of ['weekly', 'monthly', 'hse']) {
  r = await call('/api/report?kind=' + k);
  check('the ' + k + ' report builds with it on PostgreSQL', r.status === 200 && !/RFI-ARC-0042|INC-003/.test(r.text), r.status);
}
await as('dc@pk.test');
await as('design@pk.test');
r = await call('/api/records', { type: 'rfi', title: 'New', data: { Subject: 'New' } });
check('the next live RFI is above it', r.status === 200 && r.json.ref === 'RFI-0043', r.text.slice(0, 200));
await as('dc@pk.test');
r = await call('/api/records/take-over', { ref: 'J179-RFI-ARC-0042' });
check('taken over as a new live record', r.status === 200 && r.json.ref === 'RFI-0044' && r.json.record.due === null, r.text.slice(0, 200));
r = await call('/api/register/xlsx?reg=rfi');
check('the register export marks it', r.status === 200 && new TextDecoder().decode(r.bytes).includes('imported — not raised on this platform'), r.status);

console.log('\n— K2 files out of PostgreSQL —');
{
  const { createServer } = await import('node:http');
  const { azureSign } = await import('../src/storage.js');
  const KEY = 'Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==';
  const blobs = new Map();
  let bad = 0;
  const srv = createServer(async (req, res) => {
    const ch = []; for await (const c of req) ch.push(c);
    const body = Buffer.concat(ch), u = new URL(req.url, 'http://x');
    const xms = Object.fromEntries(Object.entries(req.headers).filter(([k]) => k.startsWith('x-ms-')));
    const want = await azureSign({ account: 'devstoreaccount1', key: KEY, method: req.method, path: u.pathname, headers: xms, contentLength: body.length, contentType: req.method === 'PUT' ? req.headers['content-type'] : '' });
    if (req.headers.authorization !== want.authorization) { bad++; res.writeHead(403); return res.end(); }
    const k = u.pathname.replace(/^\/devstoreaccount1\/f\//, '');
    if (req.method === 'PUT') { blobs.set(k, body); res.writeHead(201); return res.end(); }
    if (req.method === 'GET') { if (!blobs.has(k)) { res.writeHead(404); return res.end(); } res.writeHead(200); return res.end(blobs.get(k)); }
    if (req.method === 'DELETE') { blobs.delete(k); res.writeHead(202); return res.end(); }
  });
  await new Promise((ok) => srv.listen(0, '127.0.0.1', ok));
  const PDF = new TextEncoder().encode('%PDF-1.4 ' + 'y'.repeat(2000));
  await q("INSERT INTO drawings (project_id, id, number, revision, title, kind, status, mime, data, uploaded_at) VALUES ($1,'dwg_pg','ST-1','A','Old','ifc','current','application/pdf',$2,'2026-09-01')",
    [pid, 'data:application/pdf;base64,' + b64(PDF)]);
  await admin();
  r = await call('/api/storage/capacity');
  check('the database size comes from pg_database_size', r.status === 200 && r.json.database.how === 'pg_database_size' && r.json.database.bytes > 0, r.json.database);
  Object.assign(env, { AZURE_STORAGE_ACCOUNT: 'devstoreaccount1', AZURE_STORAGE_KEY: KEY, AZURE_STORAGE_CONTAINER: 'f',
    AZURE_STORAGE_ENDPOINT: 'http://127.0.0.1:' + srv.address().port + '/devstoreaccount1' });
  r = await call('/api/storage/move');
  check('the dry run on PostgreSQL', r.status === 200 && r.json.can_move && r.json.sources.find((s) => s.source === 'drawings').count === 1, r.text.slice(0, 300));
  r = await call('/api/storage/move', { confirm: 'move' });
  check('the move on PostgreSQL', r.status === 200 && r.json.moved >= 1 && !r.json.failed.length && r.json.remaining.count === 0, r.text.slice(0, 300));
  const row = (await q("SELECT data, r2_key FROM drawings WHERE id = 'dwg_pg'"))[0];
  check('the drawing row keeps only the key', row.data === null && blobs.has(row.r2_key));
  r = await call('/api/storage/capacity');
  const mine = r.json.projects.find((x) => x.id === pid);
  check('what the project holds, on PostgreSQL', mine && mine.bytes_object_store >= PDF.length && mine.bytes_in_database === 0 && mine.records >= 3, mine);
  await as('pm@pk.test');
  r = await call('/dwg/dwg_pg');
  check('served from Blob', r.status === 200 && r.bytes.length === PDF.length);
  check('every request was correctly signed', bad === 0);
  for (const k of Object.keys(env)) if (k.startsWith('AZURE_')) delete env[k];
  srv.close();
}

console.log('\n— K3 held-document and storage alerts —');
{
  const { runAdminAlerts, once } = await import('../src/alerts.js');
  const { hold } = await import('../src/quarantine.js');
  env.PLATFORM_EMAILS = 'admin@aetraa.test';
  const sent = [];
  const mailer = async (to, subject) => { sent.push(subject); return null; };
  let r1 = await once(env, 'test.rule', 'x', 'p1', null, () => null);
  let r2 = await once(env, 'test.rule', 'x', 'p1', null, () => null);
  check('a message is logged once; the second attempt is refused by the key', r1.sent === true && r2.skipped === true, [r1, r2]);
  const failing = await once(env, 'test.rule', 'x', 'p2', null, () => ({ error: 'mail down' }));
  const retry = await once(env, 'test.rule', 'x', 'p2', null, () => null);
  check('a failed send is not logged, so the next run tries again', !!failing.error && retry.sent === true);
  for (let i = 0; i < 22; i++) await hold(env, pid, { org_id: oid, kind: 'drawing', filename: 'PG-' + i + '.pdf', number: 'PG-' + i, reason: 'test' }, { name: 'x' });
  await q("UPDATE quarantine SET held_at = $1 WHERE filename = 'PG-0.pdf'", [new Date(Date.now() - 5 * 86400000).toISOString()]);
  const today = new Date(Date.now() + 4 * 3600000).toISOString().slice(0, 10);
  await runAdminAlerts(env, today, mailer);
  check('the daily run on PostgreSQL: digest, over 3 days, over 20', sent.some((s) => /more document/.test(s)) && sent.some((s) => /more than 3 days/.test(s)) && sent.some((s) => /22 documents held/.test(s)), sent);
  const n = sent.length;
  await runAdminAlerts(env, today, mailer);
  check('and nothing twice', sent.length === n, sent.slice(n));
}

console.log('\n— K4 Word forms (E16) —');
{
  const { rfiForm } = await import('./fixtures/word-forms.mjs');
  const { readWordSheet } = await import('../src/template-word.js');
  await as('dc@pk.test');
  r = await call('/api/templates/upload', { doc_type: 'rfi', filename: 'RFI.docx', file_b64: b64(rfiForm()) });
  check('a Word form is read and stored on PostgreSQL', r.status === 200 && r.json.field_count === 8 && r.json.extractor === 'e16-1', r.text.slice(0, 200));
  const t = (await q("SELECT sha256, field_count, unknown_tokens FROM templates WHERE project_id = $1 AND doc_type = 'rfi'", [pid]))[0];
  check('with its SHA-256 and field count', /^[0-9a-f]{64}$/.test(t.sha256) && Number(t.field_count) === 8 && t.unknown_tokens === '[]', t);
  await as('design@pk.test');
  r = await call('/api/records', { type: 'rfi', title: 'Edge', data: { Subject: 'Edge detail', Discipline: 'Structural' } });
  const ref = r.json.ref;
  await as('dc@pk.test');
  r = await call('/api/record/doc?ref=' + encodeURIComponent(ref));
  const cellsOut = r.status === 200 ? Object.values(readWordSheet(r.bytes).cells) : [];
  check('and issued, filled', r.status === 200 && cellsOut.some((c) => c.ref === 'B4' && c.text === 'Edge detail') && cellsOut.some((c) => c.ref === 'D2' && c.text === ref), r.status);
}

console.log('\n— K6 past registers (E12) —');
{
  await as('dc@pk.test');
  const rows = [['RFI No', 'Subject', 'Date Raised', 'Status']];
  for (let i = 100; i < 140; i++) rows.push(['RFI-0' + i, 'Old question ' + i, '13/0' + (1 + (i % 9)) + '/2025', i % 2 ? 'Closed' : 'Open']);
  rows.push(['RFI-0100', 'Twice', '14/01/2025', 'Open']);
  let r = await call('/api/past-registers/read', { filename: 'Old RFI log.xlsx', data: b64(buildXlsx([{ name: 'Log', rows }])) });
  check('a log read and kept on PostgreSQL', r.status === 200 && r.json.counts.rows === 41 && r.json.counts.held === 2 && r.json.counts.read === 39 && r.json.adds_up, r.text.slice(0, 300));
  r = await call('/api/past-registers/confirm', { id: r.json.id });
  check('confirmed as imported records', r.status === 200 && r.json.created === 39, r.text.slice(0, 200));
  const n = (await q("SELECT COUNT(*) AS n FROM records WHERE project_id = $1 AND imported = 1 AND imported_from LIKE '%Old RFI log%'", [pid]))[0].n;
  check('39 imported rows on PostgreSQL', Number(n) === 39, n);
  r = await call('/api/past-registers/read', { filename: 'Old RFI log.xlsx', data: b64(buildXlsx([{ name: 'Log', rows }])) });
  check('a second import finds them already here', r.json.counts.already === 39 && r.json.counts.read === 0, r.json.counts);
}

console.log('\n— K7 S0 submittals —');
{
  await call('/api/person', { org: oid, name: 'The PM2', email: 'pm2@pk.test', functions: ['pm'], projects: [pid] });
  await as('design@pk.test');
  let r = await call('/api/records', { type: 'submittal', title: 'Shop drawings', data: { Subject: 'Shop drawings' } });
  const S = r.json.ref;
  await as('pm@pk.test');
  r = await call('/api/record/advance', { ref: S, action: 'reject', note: 'Add the bar schedule' });
  check('returned to Design on PostgreSQL', r.status === 200 && r.json.status === 'Returned to Design', r.text.slice(0, 200));
  await as('design@pk.test');
  await call('/api/s0/resubmit', { ref: S, note: 'Bar schedule added' });
  await as('pm@pk.test');
  await call('/api/record/advance', { ref: S, action: 'advance' });
  await as('dc@pk.test');
  r = await call('/api/s0/issue', { ref: S, outside: true, note: 'Transmittal T-1' });
  check('issued', r.status === 200 && /^Issued for approval/.test(r.json.status), r.text.slice(0, 200));
  const today = new Date(Date.now() + 4 * 3600000).toISOString().slice(0, 10);
  r = await call('/api/s0/reply', { ref: S, code: 'C', replied_on: today, comments: ['Revise laps', 'Add marks'] });
  check('Code C opens Rev 1 with its checklist on PostgreSQL', r.status === 200 && r.json.revision === S + ' Rev 1', r.text.slice(0, 200));
  await as('pm@pk.test');
  r = await call('/api/record/advance', { ref: S + ' Rev 1', action: 'advance' });
  check('the PM is held while comments are open', r.status === 409 && r.json.open_comments === 2, r.text.slice(0, 200));
}

console.log('\n— K8 timesheets (E15) —');
{
  await admin();
  await call('/api/person', { org: oid, name: 'The Engineer', email: 'site@pk.test', functions: ['site'], projects: [pid] });
  // The diary is saved by Document Control (Ajay, 6 Oct 2026, decision 11).
  await as('dc@pk.test');
  const DAY = '2026-09-15';
  await call('/api/diary', { report_date: DAY, staff: [{ t: 'Site Engineer', n: 2, h: '8' }], weather: 'Sunny' });
  await as('site@pk.test');
  const sheet = buildXlsx([{ name: 'S', rows: [['Company: Gulf Masonry LLC'], ['Date: 15-Sep-2026'], ['Trade', 'No.', 'Hours'], ['Mason', 3, 7.5], ['Helper', 2, 8.25]] }]);
  let r = await call('/api/diary/timesheets/read', { filename: 'Gulf.xlsx', data: b64(sheet) });
  check('a timesheet is read and kept on PostgreSQL', r.status === 200 && r.json.groups[0].man_hours === 39 && /^[0-9a-f]{64}$/.test(r.json.sha256), r.text.slice(0, 300));
  const tid = r.json.id;
  r = await call('/api/diary/timesheets/read', { filename: 'Gulf.xlsx', data: b64(sheet) });
  check('the same sheet again is the kept read', r.json.id === tid && r.json.kept === true);
  r = await call('/api/diary/timesheets/apply', { id: tid });
  await call('/api/diary/timesheets/apply', { id: tid });
  check('applied to the diary, twice, adding nothing', r.status === 200 && (await q("SELECT count(*)::int AS n FROM manpower WHERE project_id = $1 AND report_date = $2 AND subcontractor = 'Gulf Masonry LLC'", [pid, DAY]))[0].n === 2, r.text.slice(0, 200));
  const { hseFigures } = await import('../src/hse-monthly.js');
  const proj = (await q('SELECT * FROM projects WHERE id = $1', [pid]))[0];
  const hf = await hseFigures(env, pid, proj, '2026-09-01', '2026-09-30');
  check('exact man-hours on PostgreSQL: 16 + 22.5 + 16.5 = 55', hf.man_hours.period === 55, hf.man_hours);
  r = await call('/api/diary/manpower.xlsx?from=2026-09-01&to=2026-09-30');
  check('the manpower log downloads', r.status === 200 && new TextDecoder().decode(r.bytes).includes('Gulf Masonry LLC'));
}

console.log('\n— K9 AI readers (A1, A3) —');
{
  // A fake model, as in test-k9-ai-readers.mjs.
  const realFetch = globalThis.fetch;
  let answer = null;
  globalThis.fetch = async (u, init) => String(u).startsWith('https://api.anthropic.com/')
    ? new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(answer) }], usage: { input_tokens: 10, output_tokens: 10 } }), { status: 200 })
    : realFetch(u, init);
  env.ANTHROPIC_API_KEY = 'test';
  const { createCanvas } = await import('@napi-rs/canvas');
  const { PDFDocument } = await import('pdf-lib');
  const cv = createCanvas(600, 424); const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 600, 424); g.fillStyle = '#000'; g.fillText('A1-701', 500, 400);
  const pdf = await PDFDocument.create(); const pg1 = pdf.addPage([2384, 1684]);
  pg1.drawImage(await pdf.embedPng(await cv.encode('png')), { x: 0, y: 0, width: 2384, height: 1684 });
  const scan = await pdf.save();
  await as('dc@pk.test');
  let r = await call('/api/drawing', { number: 'A1-701', kind: 'ifc', filename: 'A1-701.pdf', data: 'data:application/pdf;base64,' + b64(scan) });
  const D = r.json.id;
  check('a scan on PostgreSQL', (await q('SELECT scanned FROM drawings WHERE id = $1', [D]))[0].scanned === 1);
  answer = { number: { value: 'A1-701', sure: 'high' }, revision: { value: 'B', sure: 'high' }, title: { value: 'ROOF PLAN', sure: 'high' }, date: { value: '14/03/2026', sure: 'high' }, discipline: { value: '', sure: 'low' } };
  r = await call('/api/ai/sheet', { drawing_id: D });
  check('A1 read and kept apart on PostgreSQL', r.status === 200 && (await q('SELECT state FROM ai_proposals WHERE id = $1', [r.json.id]))[0].state === 'proposed', r.text.slice(0, 200));
  r = await call('/api/ai/sheet/confirm', { id: r.json.id, fields: { title: 'ai', revision: 'ai', date: 'ai' } });
  const row = (await q('SELECT title, revision, sheet_date, read_by_ai, status FROM drawings WHERE id = $1', [D]))[0];
  check('confirmed by DC: on the sheet with where each came from, still pending', r.status === 200 && row.title === 'ROOF PLAN' && row.sheet_date === '2026-03-14' && JSON.parse(row.read_by_ai).fields.title === 'ai' && row.status === 'pending', row);
  await as('design@pk.test');
  const made = await call('/api/records', { type: 'submittal', title: 'Roof membrane', data: { Subject: 'Roof membrane' } });
  await as('pm@pk.test'); await call('/api/record/advance', { ref: made.json.ref, action: 'advance' });
  await as('dc@pk.test'); await call('/api/s0/issue', { ref: made.json.ref, outside: true, note: 'Transmittal T-2' });
  const S = (await q("SELECT ref FROM records WHERE project_id = $1 AND ref = $2 AND status LIKE 'Issued%'", [pid, made.json.ref]))[0];
  if (S) {
    r = await call('/api/s0/read-reply', { ref: S.ref, filename: 'stamped.pdf', mime: 'application/pdf', data: b64(scan) });
    const today = new Date(Date.now() + 4 * 3600000).toISOString().slice(0, 10);
    answer = { reference: S.ref, code: 'A', date: today, comments: [], code_sure: 'high', date_sure: 'high' };
    r = await call('/api/s0/ai-read', { ref: S.ref, attachment_id: r.json.attachment_id });
    const id = r.json.id;
    r = await call('/api/s0/ai-confirm', { ref: S.ref, id });
    check('A3 confirmed with one click on PostgreSQL', r.status === 200 && r.json.code === 'A', r.text.slice(0, 200));
  } else check('an issued submittal to reply to', false);
  delete env.ANTHROPIC_API_KEY;
  globalThis.fetch = realFetch;
}

console.log('\n— K10 correspondence register (A2) —');
{
  const { PDFDocument, StandardFonts } = await import('pdf-lib');
  const pdf = await PDFDocument.create(); const pg1 = pdf.addPage([595, 842]); const f = await pdf.embedFont(StandardFonts.Helvetica);
  ['ENGINEER LETTER', 'Our Ref: ENG/PK/0009', 'Date: 14 September 2026', 'Subject: Access to Level 2'].forEach((l, i) => pg1.drawText(l, { x: 50, y: 790 - i * 18, size: 11, font: f }));
  const letter = await pdf.save();
  await as('dc@pk.test');
  let r = await call('/api/letters/read', { filename: 'eng 0009.pdf', data: b64(letter) });
  check('a letter read by rule on PostgreSQL', r.status === 200 && r.json.draft['Their reference'].value === 'ENG/PK/0009', r.text.slice(0, 200));
  const today = new Date(Date.now() + 4 * 3600000).toISOString().slice(0, 10);
  r = await call('/api/records', { type: 'incoming', title: 'Access to Level 2', read_id: r.json.id,
    data: { From: 'The Engineer', 'Their reference': 'ENG/PK/0009', 'Date received': today, Subject: 'Access to Level 2', 'Action by': 'Project Manager' } });
  const IN = r.json.ref;
  check('logged from the reading', r.status === 200 && (await q('SELECT logged_ref FROM letter_reads WHERE logged_ref = $1', [IN])).length === 1, r.text.slice(0, 200));
  r = await call('/api/letters/outgoing', { to: 'The Engineer', subject: 'Access to Level 2 — reply', issued_on: today, in_reply_to: IN, filename: 'signed.pdf', data: b64(letter) });
  check('an outgoing letter logged by DC closes it on PostgreSQL', r.status === 200 && r.json.replied_to.includes(IN), r.text.slice(0, 200));
  r = await call('/api/letters');
  check('the register on PostgreSQL', r.status === 200 && r.json.letters.find((x) => x.ref === IN).answered_by === r.json.letters.find((x) => x.dir === 'Out' && x.their_ref === 'ENG/PK/0009').ref);
}

console.log('\n— K11 delivery notes and certificates with the diary (A5) —');
{
  const { PDFDocument, StandardFonts } = await import('pdf-lib');
  const mk = async (lines) => { const pdf = await PDFDocument.create(); const pg1 = pdf.addPage([595, 842]); const f = await pdf.embedFont(StandardFonts.Helvetica);
    lines.forEach((l, i) => pg1.drawText(l, { x: 50, y: 790 - i * 18, size: 11, font: f })); return pdf.save(); };
  const today = new Date(Date.now() + 4 * 3600000).toISOString().slice(0, 10);
  const day = new Date(Date.parse(today) - 86400000).toISOString().slice(0, 10);
  const exp = new Date(Date.parse(today) + 10 * 86400000).toISOString().slice(0, 10);
  await as('site@pk.test');
  let r = await call('/api/diary/docs/read', { day, kind: 'delivery', filename: 'dn.pdf', data: b64(await mk(['Delivery Note No: DN-PK-1', 'Blockwork 200mm 500 nos'])) });
  check('a delivery note read on PostgreSQL', r.status === 200 && r.json.draft.dn.value === 'DN-PK-1', r.text.slice(0, 200));
  r = await call('/api/diary/docs/confirm', { id: r.json.id, supplier: 'Block Co', dn: 'DN-PK-1', items: [{ m: 'Blockwork 200mm', q: '500', u: 'nos' }] });
  const mats = JSON.parse((await q('SELECT materials FROM diary WHERE project_id = $1 AND report_date = $2', [pid, day]))[0].materials);
  check('confirmed into the diary with its note on PostgreSQL', r.status === 200 && mats.some((m) => m.dn === 'DN-PK-1' && m.s === 'Block Co'), r.text.slice(0, 200));
  r = await call('/api/diary/docs/read', { day, kind: 'certificate', filename: 'cert.pdf', data: b64(await mk(['Certificate No: PK-C-9'])) });
  r = await call('/api/diary/docs/confirm', { id: r.json.id, type: 'Lifting equipment', number: 'PK-C-9', subject: 'Hoist H-2', expiry: exp });
  check('a certificate filed with its expiry on PostgreSQL', r.status === 200 && (await q('SELECT due FROM records WHERE project_id = $1 AND ref = $2', [pid, r.json.ref]))[0].due === exp, r.text.slice(0, 200));
  const { certExpiries } = await import('../src/diary-docs.js');
  check('and listed as expiring', (await certExpiries(env, pid, today)).some((c) => c.ref === r.json.ref && c.state === 'expiring' && c.days === 10));
}

console.log('\n— K12 material submittal package (A7) —');
{
  const { PDFDocument, StandardFonts } = await import('pdf-lib');
  const mk = async (pages) => { const d = await PDFDocument.create(); const f = await d.embedFont(StandardFonts.Helvetica);
    for (const lines of pages) { const pg = d.addPage([595, 842]); lines.forEach((l, i) => pg.drawText(l, { x: 40, y: 800 - i * 15, size: 10, font: f })); } return d.save(); };
  await as('dc@pk.test');
  let r = await call('/api/library', { class: 'specification', title: 'Spec', filename: 'spec.pdf', mime: 'application/pdf', data: 'data:application/pdf;base64,' + b64(await mk([['SECTION 09 91 00 - PAINTING', '2.2 EXTERIOR', 'A. VOC content shall not exceed 50 g/l.']])) }).catch(() => null);
  const lib = (await q("SELECT id FROM library WHERE project_id = $1 AND class = 'specification' AND file_key IS NOT NULL ORDER BY added_at DESC", [pid]))[0];
  await as('design@pk.test');
  if (lib) {
    r = await call('/api/material/start', { title: 'Emulsion paint', brand: 'Jotun', spec: { library_id: lib.id, from: 1, to: 1, code: '09 91 00' }, approved: ['Jotun'],
      catalogue: { filename: 'cat.pdf', data: b64(await mk([['VOC content: 45 g/l']])) } });
    const id = r.json.id;
    check('a package started on PostgreSQL', r.status === 200 && !!id, r.text.slice(0, 200));
    await call('/api/material/edit', { id, compliance: [{ clause: '2.2 A', requirement: 'VOC content shall not exceed 50 g/l', submitted: 'VOC content 45 g/l', complies: 'Y', deviation: '', page: 1, quote: 'VOC content: 45 g/l' }] });
    r = await call('/api/material/complete', { id });
    check('completed, Rev 0 kept on PostgreSQL', r.status === 200 && (await q('SELECT rev FROM material_package_rev WHERE package_id = $1', [id])).length === 1, r.text.slice(0, 200));
    r = await call('/api/material/submit', { id });
    check('submitted as a MAR with its package on PostgreSQL', r.status === 200 && /^MAR-/.test(r.json.ref) && (await q('SELECT COUNT(*)::int AS n FROM attachments WHERE ref = $1', [r.json.ref]))[0].n === 1, r.text.slice(0, 200));
  } else check('a library specification to start from', false, 'no library row');
}

console.log('\n— K13 (A10) RFIs —');
{
  await as('design@pk.test');
  let r = await call('/api/records', { type: 'rfi', title: 'Podium drainage outlet clash', data: { Subject: 'Podium drainage outlet clash', Discipline: 'Plumbing', Question: 'Drainage outlet clashes with podium beam at grid C-4 — confirm the outlet position.' } });
  check('an RFI raised on PostgreSQL', r.status === 200, r.text.slice(0, 200));
  r = await call('/api/records', { type: 'rfi', title: 'Podium drainage outlet clash grid C-4', data: { Subject: 'Podium drainage outlet clash grid C-4', Question: 'Drainage outlet clashes with podium beam at grid C-4 — confirm the outlet position.' } });
  check('the duplicate check on PostgreSQL', r.status === 409 && r.json.duplicates.length >= 1, r.text.slice(0, 200));
  r = await call('/api/rfi');
  check('the RFI log on PostgreSQL', r.status === 200 && r.json.log.some((x) => x.subject === 'Podium drainage outlet clash' && x.discipline === 'Plumbing'));
}

console.log('\n— K13 (A11) minutes —');
{
  await as('dc@pk.test');
  const today = new Date(Date.now() + 4 * 3600000).toISOString().slice(0, 10);
  let r = await call('/api/meeting', { type: 'progress', title: 'Progress 1', meeting_date: today, attendees: [{ name: 'The DC', present: true }],
    items: [{ subject: 'Pour', actions: [{ text: 'Book the pump', owner_name: 'The Engineer', due: today, proposed: true, proposed_owner: 'Engineer' }] }] });
  const ref = r.json.ref;
  check('a consultant-series draft with a proposed owner on PostgreSQL', r.status === 200 && (await q('SELECT series FROM meetings WHERE ref = $1', [ref]))[0].series === 'consultant', r.text.slice(0, 200));
  r = await call('/api/meeting/issue', { ref });
  check('not issued until the owner is confirmed', r.status === 400 && /confirm the owner/.test(r.json.error));
  r = await call('/api/meeting/consultant/record', { type: 'progress', title: 'Their minutes', meeting_date: today, their_ref: 'MOM-1', attendees: [{ name: 'X', present: true }], items: [{ subject: 'A', actions: [{ text: 'theirs' }] }] });
  check('the consultant’s minutes recorded on PostgreSQL', r.status === 200 && (await q('SELECT status, their_ref FROM meetings WHERE ref = $1', [r.json.ref]))[0].status === 'recorded', r.text.slice(0, 200));
}

console.log('\n— K13 (A12) site diary —');
{
  const { runDiaryReminders } = await import('../src/diary-ai.js');
  const { diaryReminderDeps } = await import('../src/index.js');
  const today = new Date(Date.now() + 4 * 3600000).toISOString().slice(0, 10);
  await q('UPDATE projects SET diary_off_days = $1 WHERE id = $2', [String((new Date(today + 'T00:00:00Z').getUTCDay() + 3) % 7), pid]);
  const dcId = (await q("SELECT id FROM users WHERE email = 'dc@pk.test'"))[0].id;
  await as('pm@pk.test');
  let r = await call('/api/diary/assignee', { user_id: dcId });
  check('the PM assigns who prepares the diary on PostgreSQL', r.status === 200 && (await q('SELECT diary_assignee FROM projects WHERE id = $1', [pid]))[0].diary_assignee === dcId, r.text.slice(0, 200));
  const to = [];
  const deps = { ...diaryReminderDeps(env), mailer: async (list) => { to.push(...list); return { ok: true }; } };
  await runDiaryReminders(env, today, 'evening', deps);
  const again = await runDiaryReminders(env, today, 'evening', deps);
  check('the 6 pm reminder to the assignee on PostgreSQL, once', to.length === 1 && to[0] === 'dc@pk.test' && again.some((x) => x.project === pid && x.skipped), JSON.stringify(to));
  await as('dc@pk.test');
  r = await call('/api/diary', { report_date: today, weather: 'Sunny', staff: [{ t: 'Mason', n: 4 }], prepared_by: 'The DC', problems: 'Crane down 1 hr' });
  check('a problem saved on PostgreSQL', r.status === 200 && (await q('SELECT problems FROM diary WHERE project_id = $1 AND report_date = $2', [pid, today]))[0].problems === 'Crane down 1 hr', r.text.slice(0, 200));
}

console.log('\n' + checks + ' checks, ' + fails + ' failures (PostgreSQL)');
process.exit(fails ? 1 : 0);
