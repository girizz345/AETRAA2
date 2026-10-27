// THE WHOLE PLATFORM, ON REAL POSTGRESQL.
//
// This is the test that makes the Oracle move a configuration change rather
// than a leap of faith. It boots the REAL worker with the PostgreSQL adapter
// instead of D1 and drives it through the whole job over HTTP — onboarding,
// the programme, records, attachments, the BOM, interim payment, the safety
// log — against an actual PostgreSQL engine (PGlite, which is PostgreSQL
// compiled to WebAssembly), not a mock that agrees with whatever it is told.
//
//   node tools/test-postgres.mjs
import { readFileSync } from 'node:fs';
import { build } from 'esbuild';
import { PGlite } from '@electric-sql/pglite';
import { makePostgres, toPg, portSql } from '../src/db-postgres.js';

let fails = 0, checks = 0;
const check = (n, c, d) => { checks++; console.log((c ? '  ok   ' : '  FAIL ') + n + (d && !c ? '  — ' + d : '')); if (!c) fails++; };

/* ---- the rewriting, before anything is trusted to it -------------------- */
check('a plain placeholder becomes $1', toPg('SELECT * FROM t WHERE a = ?').text === 'SELECT * FROM t WHERE a = $1');
check('several are numbered in order',
  toPg('WHERE a = ? AND b = ? AND c = ?').text === 'WHERE a = $1 AND b = $2 AND c = $3');
check('a question mark INSIDE a string is left alone',
  toPg("SELECT * FROM t WHERE a = ? AND b = 'why?'").text === "SELECT * FROM t WHERE a = $1 AND b = 'why?'",
  toPg("SELECT * FROM t WHERE a = ? AND b = 'why?'").text);
check('an escaped quote does not end the string early',
  toPg("WHERE a = 'it''s a ? here' AND b = ?").text === "WHERE a = 'it''s a ? here' AND b = $1",
  toPg("WHERE a = 'it''s a ? here' AND b = ?").text);
check('a quoted identifier is left alone',
  toPg('SELECT "odd?name" FROM t WHERE a = ?').text === 'SELECT "odd?name" FROM t WHERE a = $1');
check('a line comment is left alone',
  toPg('SELECT a -- why?\nFROM t WHERE b = ?').text === 'SELECT a -- why?\nFROM t WHERE b = $1');
check('a block comment is left alone',
  toPg('SELECT a /* ? */ FROM t WHERE b = ?').text === 'SELECT a /* ? */ FROM t WHERE b = $2'
    ? false : toPg('SELECT a /* ? */ FROM t WHERE b = ?').text === 'SELECT a /* ? */ FROM t WHERE b = $1',
  toPg('SELECT a /* ? */ FROM t WHERE b = ?').text);
check('SQLite date(\'now\') becomes CURRENT_DATE', /CURRENT_DATE/.test(portSql("WHERE d < date('now')")));
check('AUTOINCREMENT becomes a real sequence',
  /BIGSERIAL PRIMARY KEY/.test(portSql('id INTEGER PRIMARY KEY AUTOINCREMENT')),
  portSql('id INTEGER PRIMARY KEY AUTOINCREMENT'));

/* ---- a real PostgreSQL, the real schema -------------------------------- */
const pg = await PGlite.create();
const DB = makePostgres(pg);
await DB.exec(readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));
check('the platform schema builds on PostgreSQL', true);

// the three tables that used AUTOINCREMENT must actually auto-number
await DB.prepare(`INSERT INTO updates (project_id, activity_id, report_date, pct, source, created_at)
                  VALUES (?,?,?,?,?,?)`).bind('p1', 'A1', '2026-09-20', 50, 'site', new Date().toISOString()).run();
await DB.prepare(`INSERT INTO updates (project_id, activity_id, report_date, pct, source, created_at)
                  VALUES (?,?,?,?,?,?)`).bind('p1', 'A2', '2026-09-20', 60, 'site', new Date().toISOString()).run();
const ids = await DB.prepare('SELECT id FROM updates ORDER BY id').all();
check('an AUTOINCREMENT key really auto-numbers on PostgreSQL',
  ids.results.length === 2 && ids.results[1].id > ids.results[0].id,
  JSON.stringify(ids.results));

// the shape the whole platform depends on
const one = await DB.prepare('SELECT pct FROM updates WHERE activity_id = ?').bind('A2').first();
check('.first() returns the row', one && Number(one.pct) === 60, JSON.stringify(one));
const col = await DB.prepare('SELECT pct FROM updates WHERE activity_id = ?').bind('A2').first('pct');
check('.first(col) returns the value', Number(col) === 60, String(col));
const none = await DB.prepare('SELECT pct FROM updates WHERE activity_id = ?').bind('nope').first();
check('.first() with no row is null, not undefined', none === null, String(none));
const r = await DB.prepare('UPDATE updates SET pct = ? WHERE activity_id = ?').bind(70, 'A2').run();
check('.run() reports what it changed', r.success === true && r.meta.changes === 1, JSON.stringify(r.meta));
const raw = await DB.prepare('SELECT activity_id, pct FROM updates ORDER BY id').raw();
check('.raw() returns arrays', Array.isArray(raw[0]) && raw[0][0] === 'A1', JSON.stringify(raw[0]));
const undef = await DB.prepare('SELECT * FROM updates WHERE delay_reason IS NOT DISTINCT FROM ?').bind(undefined).all();
check('undefined binds as null rather than throwing', Array.isArray(undef.results), 'PostgreSQL rejects undefined');

// a batch must be all-or-nothing
try {
  await DB.batch([
    DB.prepare('INSERT INTO meta (key, value) VALUES (?,?)').bind('a', '1'),
    DB.prepare('INSERT INTO meta (key, value) VALUES (?,?)').bind('a', '2'),   // duplicate key
  ]);
} catch (e) { /* expected */ }
const metaN = await DB.prepare('SELECT COUNT(*) AS n FROM meta WHERE key = ?').bind('a').first('n');
check('a failed batch leaves NOTHING behind', Number(metaN) === 0,
  'half a batch is worse than none — got ' + metaN);

/* ---- and now the real worker, over HTTP, on that PostgreSQL ------------- */
await build({
  entryPoints: [new URL('../src/index.js', import.meta.url).pathname],
  bundle: true, format: 'esm', platform: 'neutral',
  outfile: '/tmp/pg-worker.mjs', logLevel: 'silent',
});
const worker = (await import('/tmp/pg-worker.mjs')).default;
const ctx = { waitUntil() {}, passThroughOnException() {} };
const env = {
  DB: makePostgres(await (async () => { const p = await PGlite.create(); return p; })()),
  OWNER_CODE: 'MASTERCODE', LOGIN_TEST_CODE: '246810', SESSION_SECRET: 'pg-test',
};
await env.DB.exec(readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));

let cookie = '';
const call = async (path, init) => {
  const res = await worker.fetch(new Request('http://x' + path, Object.assign({
    headers: Object.assign({ 'Content-Type': 'application/json' }, cookie ? { Cookie: cookie } : {}),
  }, init || {})), env, ctx);
  const sc = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
  if (sc.length) cookie = sc.map((c) => c.split(';')[0]).join('; ');
  const text = await res.text();
  let json = null; try { json = JSON.parse(text); } catch (e) {}
  return { status: res.status, text, json };
};

let x = await call('/api/login', { method: 'POST', body: JSON.stringify({ code: 'MASTERCODE' }) });
check('[pg] the AETRAA Admin signs in', x.status === 200, x.text.slice(0, 140));
const adminCookie = cookie;

x = await call('/api/setup/onboard', { method: 'POST', body: JSON.stringify({
  company: { name: 'NAF Contracting LLC' },
  project: { name: 'NAF Tower', location: 'Dubai', currency: 'AED', retention_pct: 10, payment_days: 56 },
  principal: { name: 'M. Al Nuaimi', email: 'principal@naf.ae' } }) });
check('[pg] a company and project are onboarded', x.status === 200 && x.json && x.json.project_id, x.text.slice(0, 200));
const PID = x.json.project_id;

x = await call('/api/person', { method: 'POST', body: JSON.stringify({
  name: 'R. Kumar', email: 'civil@naf.ae', functions: ['site'], groups: ['Civil'], projects: [PID] }) });
check('[pg] a person is created', x.status === 200 && !(x.json && x.json.error), x.text.slice(0, 160));
x = await call('/api/person', { method: 'POST', body: JSON.stringify({
  name: 'A. Haddad', email: 'pm@naf.ae', functions: ['pm'], groups: [], projects: [PID] }) });
check('[pg] and a PM', x.status === 200 && !(x.json && x.json.error), x.text.slice(0, 160));

x = await call('/api/import', { method: 'POST', body: JSON.stringify({ replace: true, text:
  'ID,Activity,WBS,Planned Start,Planned Finish,Trade Group,Weight\n' +
  'A1000,L4 slab rebar,Structure,2026-11-02,2026-11-11,Civil,100\n' +
  'A1010,L4 formwork,Structure,2026-11-12,2026-11-20,Civil,100' }) });
check('[pg] the programme imports', x.status === 200, x.text.slice(0, 200));

x = await call('/api/boq/import', { method: 'POST', body: JSON.stringify({ project_id: PID, rows: [
  { ref: 'B1', section: 'Structure', description: 'RC frame', amount: 4000000 } ] }) });
check('[pg] the priced BOQ imports', x.status === 200 && !(x.json && x.json.error), x.text.slice(0, 200));

x = await call('/api/bom/import', { method: 'POST', body: JSON.stringify({ project_id: PID, rows: [
  { material: 'C40 ready-mix concrete', unit: 'm3', budget_qty: 1250, rate: 240 } ] }) });
check('[pg] the Bill of Materials imports', x.status === 200 && !(x.json && x.json.error), x.text.slice(0, 200));

// the site engineer does their job
cookie = '';
await call('/api/signin/code', { method: 'POST', body: JSON.stringify({ email: 'civil@naf.ae', code: '246810' }) });
x = await call('/api/data');
check('[pg] a signed-in engineer gets their project', x.status === 200 && x.json && x.json.activities.length === 2,
  x.text.slice(0, 200));
x = await call('/api/records', { method: 'POST', body: JSON.stringify({
  type: 'wir', title: 'L4 slab pre-pour', data: { 'Activity / element': 'L4 slab' } }) });
check('[pg] a record is raised and numbered', x.status === 200 && /^WIR-\d+$/.test(String(x.json && x.json.ref)),
  x.text.slice(0, 200));
const WIR = x.json.ref;

const b64 = Buffer.from(new Uint8Array(30000).map((_, i) => (i * 7) % 256)).toString('base64');
x = await call('/api/attachment', { method: 'POST', body: JSON.stringify({
  ref: WIR, filename: 'pre-pour.pdf', mime: 'application/pdf', file_b64: b64 }) });
check('[pg] a file attaches', x.status === 200 && x.json && x.json.ok, x.text.slice(0, 200));
const res = await worker.fetch(new Request('http://x/attachment/' + x.json.id, { headers: { Cookie: cookie } }), env, ctx);
check('[pg] and comes back whole from PostgreSQL',
  res.status === 200 && (await res.arrayBuffer()).byteLength === 30000, 'status=' + res.status);

x = await call('/api/update', { method: 'POST', body: JSON.stringify({ activity_id: 'A1000', pct: 60 }) });
check('[pg] progress is reported', x.status === 200, x.text.slice(0, 160));

// the office does its job
cookie = '';
await call('/api/signin/code', { method: 'POST', body: JSON.stringify({ email: 'pm@naf.ae', code: '246810' }) });
x = await call('/api/record/advance', { method: 'POST', body: JSON.stringify({ ref: WIR, action: 'advance' }) });
check('[pg] the PM approves it', x.status === 200 && x.json && x.json.ok, x.text.slice(0, 200));
x = await call('/api/bom/check', { method: 'POST', body: JSON.stringify({ material: 'C40 ready-mix concrete', qty: 1400 }) });
check('[pg] the over-BOM warning still fires', x.json && x.json.warning === true && x.json.over_by === 150,
  x.text.slice(0, 200));
x = await call('/api/bom/order', { method: 'POST', body: JSON.stringify({ material: 'C40 ready-mix concrete', qty: 1400, ref: 'LPO-001' }) });
check('[pg] and the order is recorded with its overrun', x.status === 200 && x.json && x.json.over_by === 150,
  x.text.slice(0, 200));

x = await call('/api/hse/log', { method: 'POST', body: JSON.stringify({
  men_on_site: 42, toolbox_talks: 1, toolbox_attended: 20, ppe_checked: 40, ppe_compliant: 39 }) });
check('[pg] the safety log is kept', x.status === 200 && x.json && x.json.ok, x.text.slice(0, 200));
x = await call('/api/hse?period=weekly');
check('[pg] and the safety report is built from it', x.status === 200 &&
  (x.json.stats || []).some((s) => s.k === 'PPE compliance' && s.v === '98%'),
  JSON.stringify((x.json && x.json.stats) || []).slice(0, 220));

// interim payment — the numbers that matter most
cookie = adminCookie;
x = await call('/api/ipc/propose', { method: 'POST', body: '{}' });
check('[pg] a valuation is proposed from the programme', x.status === 200 && x.json && x.json.lines.length === 1,
  x.text.slice(0, 220));
const lines = x.json.lines.map((l) => ({ id: l.id, ref: l.ref, section: l.section, amount: l.amount, pct: 75 }));
x = await call('/api/ipc', { method: 'POST', body: JSON.stringify({ lines, reviewed: true, reviewed_by: 'QS' }) });
check('[pg] the certificate is raised', x.status === 200 && x.json && x.json.ref === 'IPA-01', x.text.slice(0, 220));
check('[pg] the money is right', x.json && x.json.work_done === 3000000 &&
  Math.abs(x.json.net - (x.json.gross - x.json.retention)) < 0.01,
  'work ' + (x.json && x.json.work_done) + ' gross ' + (x.json && x.json.gross) +
  ' retention ' + (x.json && x.json.retention) + ' net ' + (x.json && x.json.net));

// the walls between companies must hold on PostgreSQL too
x = await call('/api/setup/onboard', { method: 'POST', body: JSON.stringify({
  company: { name: 'Other Contractor LLC' },
  project: { name: 'Other Tower', location: 'Dubai', currency: 'AED' },
  principal: { name: 'Someone Else', email: 'boss@other.ae' } }) });
const OTHER = x.json && x.json.project_id;
cookie = '';
await call('/api/signin/code', { method: 'POST', body: JSON.stringify({ email: 'pm@naf.ae', code: '246810' }) });
x = await call('/api/boq?project=' + OTHER);
check('[pg] one company cannot read another’s bill',
  x.status !== 200 || !(x.json && x.json.lines && x.json.lines.length), 'status=' + x.status + ' ' + x.text.slice(0, 140));

// Every other endpoint that carries a GROUP BY — the reports, the resource
// views and the trade breakdowns. SQLite tolerates a bare column in a GROUP BY
// and PostgreSQL does not, so each one is actually called rather than read.
cookie = adminCookie;
for (const [name, path] of [
  ['the daily report', '/api/report?kind=daily'],
  ['the weekly report', '/api/report?kind=weekly'],
  ['resources', '/api/resources'],
  ['trades', '/api/trades'],
  ['site data', '/api/site-data?trade=Civil'],
  ['the drawings register', '/api/drawings'],
  ['the issues register', '/api/issues'],
  ['the diary', '/api/diary'],
  ['the audit trail', '/api/audit'],
  ['the schedule impact', '/api/impact'],
]) {
  const y = await call(path);
  check('[pg] ' + name + ' runs on PostgreSQL', y.status < 500,
    'status=' + y.status + ' ' + y.text.slice(0, 180));
}

x = await call('/api/verify');
check('[pg] the verification summary still works', x.status === 200, x.text.slice(0, 160));
x = await call('/api/portfolio');
check('[pg] the portfolio still works', x.status === 200 || x.status === 401,
  'status=' + x.status + ' ' + x.text.slice(0, 300));

console.log('\n' + checks + ' checks, ' + fails + ' failures');
process.exit(fails ? 1 : 0);
