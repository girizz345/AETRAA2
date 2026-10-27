// Every feature of G1-G15 once more, end to end on PostgreSQL (PGlite, in
// memory) through the platform's own adapter (src/db-postgres.js) — the live
// server runs on PostgreSQL, and SQL that works on SQLite does not always.
//   node tools/test-pg-girish.mjs        (needs ../../prelaunch's node_modules for PGlite)
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { zipSync } from 'fflate';
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
async function pdf(pages, size = [595, 842]) {
  const d = await PDFDocument.create(); const f = await d.embedFont(StandardFonts.Helvetica);
  for (const lines of pages) { const pg2 = d.addPage(size); let y = size[1] - 40; for (const l of lines) { pg2.drawText(l, { x: 40, y, size: 9, font: f }); y -= 13; } }
  return d.save({ useObjectStreams: false });
}

console.log('— set-up on PostgreSQL —');
await admin();
let r = await call('/api/setup/onboard', { company: { name: 'PG Co LLC' }, project: { name: 'PG Tower', ref: 'PGT-0001' }, principal: { name: 'PG Principal', email: 'principal@pg.test' } });
const pid = r.json && r.json.project_id;
check('a project on PostgreSQL', !!pid, r.text);
const oid = (await q('SELECT org_id FROM projects WHERE id = $1', [pid]))[0].org_id;
await q("UPDATE projects SET setup_state = 'live', client_name = 'Client', engineer_name = 'Consult', contractor_name = 'Build', contract_ref = 'C-1', data_date = '2026-10-01' WHERE id = $1", [pid]);
for (const [n, e, f] of [['PG PM', 'pm@pg.test', ['pm']], ['PG DC', 'dc@pg.test', ['dc']], ['PG Design', 'design@pg.test', ['design']]]) {
  await call('/api/person', { org: oid, name: n, email: e, functions: f, projects: [pid] });
}
await call('/api/setup/rules?project=' + pid, { rules: [{ match: 'ST', discipline: 'Structural' }] });

console.log('\n— G13 X1 —');
r = await call('/api/register/xlsx?reg=rfi&project=' + pid);
check('a register downloads with the X1 header', r.status === 200 && r.text.includes('Client: Client') && r.text.includes('Downloaded by: AETRAA Admin'), r.status);

console.log('\n— G2-G8 intake —');
r = await call('/api/intake/batch', { project_id: pid, expect_files: 6 });
const bat = r.json.id;
check('a batch opens', r.status === 200 && !!bat, r.text);
r = await call('/api/intake/batch', { project_id: pid });
check('one batch at a time', r.status === 409, r.status);
const sheet = await pdf([['DRAWING NO ST-101']], [2384, 1684]);
const contract = readFileSync(new URL('./fixtures/contract-test.pdf', import.meta.url));
const xer = (id) => new TextEncoder().encode('ERMHDR\t19.12\n%T\tPROJECT\n%F\tproj_id\tproj_short_name\n%R\t1\t' + id + '\n%E\n');
for (const [path, name, bytes] of [['/IFC Drawings', 'ST-101 Rev A.pdf', sheet], ['/Contract', 'Contract.pdf', new Uint8Array(contract)], ['/Programme', 'A.xer', xer('A')],
  ['/Programme', 'B.xer', xer('B')], ['/Misc', 'setup.exe', new Uint8Array([77, 90])], ['', 'pack.zip', zipSync({ 'readme.txt': new TextEncoder().encode('hi') })]]) {
  r = await call('/api/intake/scan', { batch_id: bat, project_id: pid, filename: name, path, data: b64(bytes) });
  if (r.status !== 200) check('scan ' + name, false, r.text);
}
let items = (await call('/api/intake/batch?id=' + bat)).json.items;
check('the batch reads on PostgreSQL, in a fixed order', items.length === 6 && items[0].path <= items[items.length - 1].path, items.map((i) => i.path + '/' + i.filename));
check('the .exe is listed as unsupported', items.some((i) => i.filename === 'setup.exe' && i.family === 'unsupported' && i.state === 'skipped'));
check('two programmes need a decision', items.filter((i) => i.family === 'programme' && i.group === 'decide').length === 2);
r = await call('/api/intake/commit', { batch_id: bat, ids: items.map((i) => i.id) });
check('commit runs', r.status === 200, r.text.slice(0, 200));
r = await call('/api/intake/report?batch=' + bat);
check('the report reconciles', r.status === 200 && r.json.reconciles === true, r.text.slice(0, 200));
r = await call('/api/intake/report?batch=' + bat + '&format=pdf');
check('the report PDF', r.status === 200 && new TextDecoder('latin1').decode(r.bytes.slice(0, 4)) === '%PDF');
check('audit rows per file', Number((await q("SELECT COUNT(*) AS n FROM audit WHERE project_id = $1 AND action = 'intake.classified'", [pid]))[0].n) >= 6);
r = await call('/api/intake/abandon', { batch_id: bat });
check('abandon', r.status === 200, r.text);
r = await call('/api/intake/folders?batch=' + bat);
check('folder proposals', r.status === 200, r.text);
r = await call('/api/intake/folder-map', { project_id: pid, entries: [{ pattern: 'Programme', family: 'programme', times_seen: 2 }] });
check('remember a folder', r.status === 200, r.text);
r = await call('/api/intake/history?project=' + pid);
check('intake history', r.status === 200 && r.json.batches.length === 1);

console.log('\n— G1 terms —');
const b2 = (await call('/api/intake/batch', { project_id: pid })).json.id;
await call('/api/intake/scan', { batch_id: b2, project_id: pid, filename: 'Contract.pdf', path: '/Contract', data: b64(contract) });
r = await call('/api/intake/terms?batch=' + b2);
const terms = r.json.terms || [];
check('terms read with clause and page', terms.some((t) => t.key === 'retention_pct' && t.value === 10 && t.clause === 'Sub-Clause 14.3' && t.page === 3), r.text.slice(0, 300));
r = await call('/api/intake/terms', { project_id: pid, batch_id: b2, terms: terms.map((t) => ({ ...t, accepted: t.key === 'retention_pct' })) });
check('applied and evidence kept', r.status === 200 && Number((await q('SELECT COUNT(*) AS n FROM term_evidence WHERE project_id = $1', [pid]))[0].n) === terms.length, r.text);
await call('/api/intake/abandon', { batch_id: b2 });
await as('principal@pg.test');
r = await call('/api/terms/approve', {});
check('the Principal approves the terms', r.status === 200 && r.json.state === 'approved', r.text);

console.log('\n— G9 drawing lists, G10 specification —');
await as('dc@pg.test');
const list = buildXlsx([{ name: 'L', rows: [['Drawing No', 'Title', 'Rev'], ['ST-101', 'Plan', 'B'], ['ST-102', 'Section', 'A']] }]);
r = await call('/api/drawing-lists', { filename: 'list.xlsx', data: b64(list) });
const lid = r.json && r.json.id;
check('a drawing list is read', r.status === 200 && r.json.comparison.counts.missing === 1, r.text.slice(0, 300));
await call('/api/drawing-lists/confirm', { id: lid, exclude: [] });
const spec = await pdf([['TABLE OF CONTENTS', '03 30 00 CAST-IN-PLACE CONCRETE 2'], ['SECTION 03 30 00 - CAST-IN-PLACE CONCRETE', 'A. Submit shop drawings for reinforcement.',
  'B. Submit product data for admixtures.', 'C. Notify the Engineer at the hold point for inspection.', '2.1 MANUFACTURERS: 1. Sika 2. Fosroc']]);
r = await call('/api/spec-index', { filename: 'Spec.pdf', data: b64(spec) });
const six = r.json && r.json.id;
check('a specification is indexed', r.status === 200 && r.json.result.split === true, r.text.slice(0, 300));
await as('pm@pg.test');
r = await call('/api/drawing-lists/approve', { id: lid });
check('the PM approves the list', r.status === 200 && r.json.result.awaited === 2, r.text);
await as('design@pg.test');
r = await call('/api/spec-index/confirm', { id: six });
check('Design confirms the index', r.status === 200 && r.json.sections === 1, r.text);
const secs = (await call('/api/spec-sections')).json.sections;
r = await call('/api/spec-sections/file?id=' + secs[0].id);
check('a section as its own PDF', r.status === 200);

console.log('\n— G11 knowledge base, G12 schedules —');
await q("INSERT INTO activities (project_id, id, name, level, trade, kind, source, planned_start, planned_finish) VALUES ($1,'A1','Pour concrete slab',1,'Concrete','site','programme','2027-03-01','2027-03-05')", [pid]);
await admin();
await call('/api/boq/import', { project_id: pid, rows: [{ section: 'Concrete', ref: 'C1', description: 'Concrete admixture', unit: 'm3', qty: 1, rate: 1 }] });
r = await call('/api/knowledge/links/propose', { project_id: pid });
check('links proposed', r.status === 200, r.text);
const lk = await q('SELECT id FROM kb_link WHERE project_id = $1', [pid]);
r = await call('/api/knowledge/links/decide', { project_id: pid, ids: lk.map((x) => x.id), decision: 'confirm' });
check('links decided', r.status === 200 && r.json.decided === lk.length, r.text);
r = await call('/api/knowledge/issue', { project_id: pid });
check('knowledge base issued', r.status === 200, r.text.slice(0, 200));
await as('pm@pg.test');
r = await call('/api/knowledge/approve', {});
check('approved, and the schedules generated', r.status === 200 && r.json.schedules && r.json.schedules.shop >= 1, r.text);
r = await call('/api/schedules?s=material');
check('P3 reads with its gates', r.status === 200 && r.json.gates && typeof r.json.gates.open === 'number', r.text.slice(0, 200));
await as('design@pg.test');
for (const g of (r.json.gates.gates || [])) await call('/api/schedules/gate', { key: g.key, resolution: 'covered' });
r = await call('/api/schedules/gate', { key: 'boq:C1', resolution: 'covered again' });
check('a gate cleared twice (upsert)', r.status === 200, r.text);
const item = (await call('/api/schedules?s=material')).json.items[0];
r = await call('/api/schedules/item', { schedule: 'material', id: item.id, lead_days: 20 });
check('an item edited', r.status === 200, r.text);
await as('pm@pg.test');
r = await call('/api/schedules/approve', { schedule: 'material' });
check('P3 approved', r.status === 200, r.text);
r = await call('/api/schedules/xlsx?s=material');
check('P3 Excel with the data date', r.status === 200 && r.text.includes('Programme data date: 2026-10-01'));

console.log('\n— G14 ask, G15 index and CAD —');
r = await call('/api/ask', { question: 'What about the concrete admixture?' });
check('ask the project', r.status === 200 && (r.json.sources || []).length >= 1, r.text.slice(0, 200));
r = await call('/api/index/rebuild', {});
check('the index rebuilds', r.status === 200, r.text);
r = await call('/api/index/check', { draft: 'We hereby give notice about the concrete works delay that commenced on 3 March 2026. See RFI-9999.' });
check('check and complete', r.status === 200 && r.json.proposals.some((p) => p.kind === 'missing'), r.text.slice(0, 200));
r = await call('/api/index/confirm', { draft: 'x', proposals: r.json.proposals, decisions: [], final_text: 'x' });
check('a letter confirmed', r.status === 200, r.text);
r = await call('/api/cad-packages');
check('CAD packages list', r.status === 200, r.text);
r = await call('/api/attention');
check('Needs my attention still works', r.status === 200, r.text.slice(0, 200));

console.log('\n— A9 letters, A13 delays —');
await q("INSERT INTO records (id, project_id, type, no, ref, title, status, data, workflow, created_at) VALUES ('ri', $1, 'incoming', 1, 'IN-001', 'Concrete delay', 'Open', '{}', '[]', '2026-10-01')", [pid]);
r = await call('/api/letters/draft', { incoming_ref: 'IN-001' });
check('a letter drafted', r.status === 200 && r.json.rev === 0, r.text.slice(0, 200));
r = await call('/api/letters/draft/save', { thread: r.json.thread, fields: { Subject: 'Re: Concrete delay', Body: 'Text', References: 'IN-001' } });
check('a revision completed', r.status === 200 && r.json.rev === 1, r.text);
await q("UPDATE activities SET p6_early_finish = '2027-03-20', p6_total_float = 0 WHERE project_id = $1 AND id = 'A1'", [pid]);
r = await call('/api/delays/scan', {});
check('delays scanned', r.status === 200 && r.json.found >= 1, r.text);
const dl = (await call('/api/delays')).json.delays[0];
r = await call('/api/delays/prepare', { id: dl.id });
check('a delay notice prepared', r.status === 200 && !!r.json.notice, r.text.slice(0, 200));
r = await call('/api/delays/xlsx');
check('the delay register downloads', r.status === 200);

console.log('\n— shared fixes: one RFI series, stamps confirmed, held list, interrupted drops —');
await admin();
r = await call('/api/issue', { create: true, title: 'Grid C detail', detail: 'Which detail?', type: 'rfi' });
check('an information issue is INF-', r.status === 200 && /^INF-/.test(r.json.ref), r.text);
const inf = r.json.ref;
r = await call('/api/records', { type: 'rfi', title: 'Grid C detail', data: { Subject: 'Grid C detail' }, from_issue: inf, not_duplicate: true });
check('its RFI is linked back', r.status === 200 && (await q('SELECT rfi_ref FROM issues WHERE project_id = $1 AND ref = $2', [pid, inf]))[0].rfi_ref === r.json.ref, r.text.slice(0, 200));
r = await call('/api/intake/batch', { project_id: pid });
const sb = r.json.id;
await q("INSERT INTO intake_item (id, batch_id, project_id, filename, family, state, extracted) VALUES ('pst', $1, $2, 's.pdf', 'drawing', 'proposed', $3)",
  [sb, pid, JSON.stringify({ kind: 'other', stamp_pending: true, stamp: { approved: true, authority: 'DM', approval_no: '1-2-3', approval_date: '2026-05-25', confidence: 'high' } })]);
r = await call('/api/intake/stamps/confirm', { batch_id: sb, items: [{ id: 'pst', accept: true }] });
check('a stamp reading confirmed', r.status === 200 && r.json.applied === 1 && JSON.parse((await q("SELECT extracted FROM intake_item WHERE id = 'pst'"))[0].extracted).approval_no === '1-2-3', r.text);
await call('/api/quarantine');
await q("INSERT INTO quarantine (id, project_id, kind, filename, prefix, reason, held_at, status) VALUES ('pq', $1, 'drawing', 'X-1.pdf', 'X', 'foreign numbering', $2, 'held')", [pid, new Date().toISOString()]);
r = await call('/api/quarantine?all=1');
check('the held list, with project names', r.status === 200 && r.json.items.length >= 1 && !!r.json.projects[pid], r.text.slice(0, 200));
r = await call('/held');
check('the held page opens', r.status === 200);
for (let i = 0; i < 3; i++) await q("INSERT INTO intake_item (id, batch_id, project_id, filename, family, state, extracted) VALUES ($1, $2, $3, 'x.pdf', 'drawing', $4, '{}')", ['pbi' + i, sb, pid, i ? 'filed' : 'confirmed']);
await q("UPDATE intake_batch SET status = 'partly_committed', updated_at = $1 WHERE id = $2", ['2026-01-01T00:00:00Z', sb]);
const { runBatchAlerts } = await import('../src/alerts.js');
env.PLATFORM_EMAILS = 'admin@aetraa.test';
const sentPg = [];
const ba = await runBatchAlerts(env, Date.now(), (to, s) => { sentPg.push(s); return Promise.resolve(null); });
console.log('\n— Ajay’s decisions on PostgreSQL —');
r = await call('/api/meeting', { type: 'progress', title: 'PG meeting', meeting_date: '2026-10-01', attendees: [{ name: 'Out Side', company: 'Dar', email: 'out@dar.test', present: true }], items: [{ subject: 'A', discussion: 'B' }] });
check('minutes with an outside attendee saved', r.status === 200, r.text.slice(0, 200));
await call('/api/meeting', { ref: r.json.ref, type: 'progress', title: 'PG meeting', meeting_date: '2026-10-01', attendees: [{ name: 'Out Side', company: 'Dar Consult', email: 'out@dar.test', present: true }], items: [{ subject: 'A', discussion: 'B' }] });
r = await call('/api/meetings');
check('the contact kept once, updated (upsert)', (r.json.contacts || []).filter((c) => c.email === 'out@dar.test').length === 1 && r.json.contacts.find((c) => c.email === 'out@dar.test').company === 'Dar Consult', r.json.contacts);
r = await call('/api/meeting/consultant/record', { type: 'progress', title: 'Their minutes', meeting_date: '2026-10-01', attendees: [{ name: 'E', present: true }], items: [{ no: '1', subject: 'S', actions: [{ text: 'Do it', owner_name: 'Contractor' }] }] });
r = await call('/api/meeting/consultant/track', { ref: r.json.ref, actions: [{ item_no: '1', index: 0, owner_name: 'Contractor', due: '2026-12-01' }] });
check('a consultant’s action confirmed into the tracker', r.status === 200 && r.json.created.length === 1, r.text.slice(0, 200));
await q("INSERT INTO photos (id, project_id, report_date, caption, mime, data, created_at) VALUES ('pgph', $1, '2026-10-01', 'c', 'image/png', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', '2026-10-01T08:00:00Z')", [pid]);
r = await call('/api/diary/photos?date=2026-10-01');
check('the day’s photos and live activities', r.status === 200 && r.json.photos.length === 1 && Array.isArray(r.json.activities), r.text.slice(0, 200));
r = await call('/api/diary/photos/confirm', { id: 'pgph', caption: 'Blockwork L2', location: 'L2' });
check('a photo caption confirmed', r.status === 200 && (await q("SELECT caption FROM photos WHERE id = 'pgph'"))[0].caption === 'Blockwork L2', r.text);
r = await call('/diary/doc?date=2026-10-01');
check('the printed diary with its photo page', r.status === 200 && /Location: L2/.test(r.text));

{ const saved = cookie; cookie = '';
  r = await call('/api/login', { code: 'wrong-code-123456' });
  check('a wrong code is refused, not a server error (?1 parameters on PostgreSQL)', r.status === 401, r.status + ' ' + r.text.slice(0, 100));
  cookie = saved; }
{ const g = await call('/api/setup/rules?project=' + pid);
  r = await call('/api/setup/rules?project=' + pid, { rules: (g.json.defaults || []).slice(0, 3) });
  check('a project’s drawing numbering rules are saved (the column is there on PostgreSQL)', r.status === 200 && r.json.ok && (await q('SELECT drawing_rules FROM projects WHERE id = $1', [pid]))[0].drawing_rules, r.status + ' ' + r.text.slice(0, 160)); }
r = await call('/api/hse/log', { log_date: '2026-10-01', men_on_site: 40, man_hours: 400, toolbox_talks: 1, toolbox_attended: 38 });
check('the HSE daily log saves, with man-hours (the column is there on PostgreSQL)', r.status === 200 && r.json.ok, r.status + ' ' + r.text.slice(0, 160));
r = await call('/api/diary/send-to', { to: 'engineer@dar.test' });
check('who the diary goes to is saved', r.status === 200 && r.json.to[0] === 'engineer@dar.test', r.text.slice(0, 160));
r = await call('/api/diary?date=2026-10-01');
check('the diary carries its sending details', r.status === 200 && r.json.a12 && r.json.a12.send && r.json.a12.send.to[0] === 'engineer@dar.test', r.text.slice(0, 200));
{ const { getProjectModules: gpm } = await import('../src/modules.js');
  const m0 = await gpm(env, pid);
  r = await call('/api/setup/modules', { project_id: pid, modules: m0.concat(['bulkload']) });
  check('bulk loading switched on for a project', r.status === 200 && (await gpm(env, pid)).includes('bulkload'), r.text.slice(0, 160)); }
r = await call('/api/launch-check');
check('the launch check runs on PostgreSQL', r.status === 200 && (r.json.items || []).find((x) => x.key === 'database').detail === 'PostgreSQL', r.text.slice(0, 200));
r = await call('/api/obligations');
check('the obligations register opens', r.status === 200 && Array.isArray(r.json.obligations), r.text.slice(0, 200));
const scanSql = 'INSERT INTO obligation_scan (project_id, clause_key, doc_source, scanned_at) VALUES (?,?,?,?) ON CONFLICT (project_id, clause_key, doc_source) DO NOTHING';
await env.DB.prepare(scanSql).bind(pid, 'Sub-Clause 20.1', 'library:x', '2026-10-07').run();
await env.DB.prepare(scanSql).bind(pid, 'Sub-Clause 20.1', 'library:x', '2026-10-07').run();
check('a clause is marked read once (ON CONFLICT DO NOTHING)', (await q('SELECT COUNT(*)::int AS n FROM obligation_scan WHERE project_id = $1', [pid]))[0].n === 1);
await q("INSERT INTO contract_obligation (id, project_id, clause_key, page, quote, binds, kind, period_days, period_text, state, flags, created_at) VALUES ('ob1', $1, 'Sub-Clause 20.1', 41, 'give notice within 28 days', 'contractor', 'notice', 28, '28 days', 'proposed', '[]', '2026-10-07')", [pid]);
r = await call('/api/obligations/confirm', { id: 'ob1', binds: 'contractor', kind: 'notice', period_days: 28 });
const r3 = await call('/api/obligations/approve', {});
check('an obligation confirmed and approved', r.status === 200 && r3.status === 200 && r3.json.approved === 1, r.text + r3.text);
const { noticePeriod: npPg } = await import('../src/delays.js');
check('the notice clock reads it', (await npPg(env, pid)).days === 28);
r = await call('/api/attention');
check('Needs my attention still works with the obligations', r.status === 200, r.text.slice(0, 200));
r = await call('/api/deviations/run', {});
check('the Tender vs IFC run (nothing to pair here)', r.status === 200 && r.json.compared.length === 0, r.text.slice(0, 200));
await q("INSERT INTO tifc_pair (id, project_id, number, state, regions, text_added, text_removed, compared_at) VALUES ('tp1', $1, 'A-1', 'compared', '[]', '[]', '[]', '2026-10-07')", [pid]);
await q("INSERT INTO tifc_deviation (id, project_id, pair_id, number, what, kind, variation, source, decision, created_at) VALUES ('td1', $1, 'tp1', 'A-1', 'Door moved', 'other', 0, 'text', 'proposed', '2026-10-07')", [pid]);
r = await call('/api/deviations');
check('the deviations list', r.status === 200 && r.json.pairs.length === 1 && r.json.deviations.length === 1, r.text.slice(0, 200));
r = await call('/api/deviations/decide', { id: 'td1', decision: 'no_impact' });
check('a deviation decided', r.status === 200 && (await q("SELECT decision FROM tifc_deviation WHERE id = 'td1'"))[0].decision === 'no_impact', r.text);
r = await call('/api/deviations/xlsx');
check('the deviations download', r.status === 200);

check('an interrupted drop is found and told once', ba.told === 1 && sentPg.length === 1 && (await runBatchAlerts(env, Date.now(), () => Promise.resolve(null))).told === 0, JSON.stringify(ba) + ' ' + sentPg);

console.log('\n' + checks + ' checks, ' + fails + ' failures (PostgreSQL)');
await pg.close();
process.exit(fails ? 1 : 0);
