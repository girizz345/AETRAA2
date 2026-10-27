// AETRAA PLATFORM — PRE-LAUNCH TEST, END TO END, ON THIS MACHINE ONLY.
//
//   cd "~/Documents/AETRAA Platform/prelaunch"
//   npm install            (once)
//   node run.mjs           newest release in ../releases, both databases, with browsers
//
// Options:
//   --release <file.tgz|folder>   test that release instead of the newest
//   --backend sqlite|postgres|both   which database to run it on (default both)
//   --no-browser                  skip the headless-Chrome pass
//   --xer <file.xer>              a real Primavera file for the programme import
//   --live-readonly               also GET the live site's public pages (no sign-in, no writes)
//
// What it does: unpacks the release into a temporary folder, starts it on
// 127.0.0.1 (local.mjs on SQLite, and server.js on PostgreSQL via PGlite),
// builds a whole project through the real API, then signs in as every seat and
// opens every page, every register, every report and every generated document,
// and checks each file is what it claims to be. Results go to results/<stamp>/.
//
// It never talks to https://app.aetraa.ae except with --live-readonly, and then
// only plain GETs of public pages. Every other request is refused unless its
// host is 127.0.0.1.

import { spawn, execFileSync } from 'node:child_process';
import { rmSync, mkdtempSync, mkdirSync, readdirSync, readFileSync, writeFileSync, existsSync, statSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve, basename } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { randomBytes } from 'node:crypto';
import { createServer } from 'node:net';
import { unzipSync, zipSync, strToU8, strFromU8 } from 'fflate';

const HERE = dirname(fileURLToPath(import.meta.url));
const PLATFORM = resolve(HERE, '..');
const LIVE = 'https://app.aetraa.ae';

/* ------------------------------------------------------------------ options */
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const flag = (k) => argv.includes(k);
const PROJECT_DB = opt('--project-db', null);
const ONLY = opt('--project', null);
const BACKENDS = (opt('--backend', 'both') === 'both') ? ['sqlite', 'postgres'] : [opt('--backend')];
const BROWSER = !flag('--no-browser');
const XER = opt('--xer', null);

function newestRelease() {
  const dir = join(PLATFORM, 'releases');
  const tgz = readdirSync(dir).filter((f) => /^aetraa-release-\d{8}-\d{4}\.tgz$/.test(f)).sort();
  if (!tgz.length) throw new Error('no release files in ' + dir);
  return join(dir, tgz[tgz.length - 1]);
}
const RELEASE = resolve(opt('--release', newestRelease()));
const STAMP = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 16);
const OUT = join(HERE, 'results', STAMP);
mkdirSync(OUT, { recursive: true });

/* ------------------------------------------------------------------ results */
const results = [];
let current = { backend: '-' };
function record(id, area, name, status, detail) {
  const r = { backend: current.backend, id, area, name, status, detail: detail ? String(detail).slice(0, 600) : '' };
  results.push(r);
  const mark = { pass: 'ok  ', fail: 'FAIL', untestable: 'n/a ', warn: 'warn' }[status] || status;
  console.log(`  ${mark}  [${current.backend}] ${id} ${name}${r.detail && status !== 'pass' ? '  — ' + r.detail : ''}`);
}
async function check(id, area, name, fn) {
  try {
    const r = await fn();
    if (r && typeof r === 'object' && r.status) record(id, area, name, r.status, r.detail);
    else record(id, area, name, 'pass', typeof r === 'string' ? r : '');
  } catch (e) {
    record(id, area, name, 'fail', (e && e.message) || e);
  }
}
const must = (cond, msg) => { if (!cond) throw new Error(msg); };

/* ------------------------------------------------------------------ helpers */
const freePort = () => new Promise((ok) => {
  const s = createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => ok(p)); });
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const safeName = (s) => String(s).replace(/[^A-Za-z0-9._-]+/g, '_').slice(0, 120);

function assertLocal(url) {
  const u = new URL(url);
  if (u.hostname !== '127.0.0.1') throw new Error('refusing to send a request to ' + u.host + ' — this harness only tests a local copy');
}

// One cookie jar per seat. Records every response so nothing fails quietly.
function client(base, label, log) {
  let cookie = '';
  const api = {
    label,
    reset() { cookie = ''; },
    cookie() { return cookie; },
    async raw(method, path, body, extraHeaders) {
      const url = base + path;
      assertLocal(url);
      const r = await fetch(url, {
        method,
        headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}), ...(extraHeaders || {}) },
        body: body === undefined ? undefined : JSON.stringify(body),
        redirect: 'manual',
      });
      for (const c of (r.headers.getSetCookie ? r.headers.getSetCookie() : [])) {
        const first = String(c).split(';')[0];
        if (!first) continue;
        const name = first.split('=')[0];
        cookie = cookie.split('; ').filter((x) => x && x.split('=')[0] !== name).concat(first).join('; ');
      }
      return r;
    },
    async req(method, path, body) {
      const r = await api.raw(method, path, body);
      const text = await r.text();
      let out;
      try { out = JSON.parse(text); } catch (e) { out = { _text: text.slice(0, 300) }; }
      if (out && typeof out === 'object' && !Array.isArray(out)) out._status = r.status;
      if (log) log.push({ who: label, method, path, status: r.status, error: out && out.error });
      return out;
    },
    get(path) { return api.req('GET', path); },
    post(path, body) { return api.req('POST', path, body || {}); },
    async bytes(path) {
      const r = await api.raw('GET', path);
      const b = new Uint8Array(await r.arrayBuffer());
      return { status: r.status, type: r.headers.get('content-type') || '', disp: r.headers.get('content-disposition') || '', bytes: b };
    },
  };
  return api;
}

/* ------------------------------------------------------------------ file validators */
function asZip(bytes) { try { return unzipSync(bytes); } catch (e) { return null; } }
function validate(kind, got, expect = {}) {
  must(got.status === 200, 'HTTP ' + got.status + ' ' + strFromU8(got.bytes.slice(0, 200)));
  must(got.bytes.length > 0, 'empty file');
  const text = () => strFromU8(got.bytes);
  if (kind === 'xlsx') {
    const z = asZip(got.bytes); must(z, 'not a zip — Excel will not open it');
    must(z['xl/workbook.xml'], 'zip has no xl/workbook.xml');
    const sheets = Object.keys(z).filter((k) => /^xl\/worksheets\/sheet\d+\.xml$/.test(k));
    must(sheets.length, 'workbook has no sheets');
    for (const s of sheets) must(/<worksheet[\s>]/.test(strFromU8(z[s])), s + ' is not a worksheet');
    const shared = z['xl/sharedStrings.xml'] ? strFromU8(z['xl/sharedStrings.xml']) : '';
    const all = shared + sheets.map((s) => strFromU8(z[s])).join('');
    if (expect.contains) for (const c of [].concat(expect.contains)) must(all.includes(c), 'workbook does not contain "' + c + '"');
    must(!/\{\{[^}]+\}\}/.test(all) || expect.allowTokens, 'unfilled {{placeholder}} left in workbook');
    return sheets.length + ' sheet(s), ' + got.bytes.length + ' bytes';
  }
  if (kind === 'docx') {
    const z = asZip(got.bytes); must(z, 'not a zip — Word will not open it');
    must(z['word/document.xml'], 'zip has no word/document.xml');
    const doc = strFromU8(z['word/document.xml']);
    must(/<w:document[\s>]/.test(doc), 'document.xml is not a Word document');
    if (expect.contains) for (const c of [].concat(expect.contains)) must(doc.includes(c), 'document does not contain "' + c + '"');
    must(!/\{\{[^}<]+\}\}/.test(doc), 'unfilled {{placeholder}} left in document');
    return got.bytes.length + ' bytes';
  }
  if (kind === 'doc') {            // Word-flavoured HTML, served as application/msword
    must(/msword|html/.test(got.type), 'content-type ' + got.type);
    const t = text(); must(/<html/i.test(t), 'not an HTML Word document');
    if (expect.contains) for (const c of [].concat(expect.contains)) must(t.includes(c), 'does not contain "' + c + '"');
    must(!/undefined|NaN|\[object Object\]/.test(t.replace(/<script[\s\S]*?<\/script>/g, '')), 'contains undefined / NaN / [object Object]');
    return got.bytes.length + ' bytes';
  }
  if (kind === 'html') {
    must(/html/.test(got.type), 'content-type ' + got.type);
    const t = text(); must(/<html|<!doctype|<div|<table/i.test(t), 'not HTML');
    const visible = t.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '');
    must(!/\bundefined\b|\bNaN\b|\[object Object\]/.test(visible.replace(/<[^>]+>/g, ' ')), 'page text contains undefined / NaN / [object Object]');
    if (expect.contains) for (const c of [].concat(expect.contains)) must(t.includes(c), 'does not contain "' + c + '"');
    return got.bytes.length + ' bytes';
  }
  if (kind === 'zip') {
    const z = asZip(got.bytes); must(z, 'not a valid zip');
    const names = Object.keys(z).filter((k) => !k.endsWith('/'));
    must(names.length >= (expect.min || 1), 'zip holds ' + names.length + ' files');
    for (const n of names) {
      if (/\.xlsx$/i.test(n)) must(asZip(z[n]) && asZip(z[n])['xl/workbook.xml'], n + ' inside the pack is not a valid workbook');
      if (/\.docx$/i.test(n)) must(asZip(z[n]) && asZip(z[n])['word/document.xml'], n + ' inside the pack is not a valid Word file');
    }
    return names.length + ' files: ' + names.slice(0, 8).join(', ');
  }
  if (kind === 'csv') {
    const t = text(); must(t.split('\n').length >= 2, 'CSV has no rows');
    return t.split('\n').length + ' lines';
  }
  throw new Error('no validator for ' + kind);
}
function keep(name, got) {
  const dir = join(OUT, current.backend, 'outputs'); mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, safeName(name)), got.bytes);
}

// A tiny Word template and a tiny Excel template carrying the platform's tokens.
function docxTemplate() {
  const body = ['{{ref}}', '{{title}}', '{{project_name}}', '{{date}}', '{{raised_by}}', '{{contractor}}']
    .map((t) => `<w:p><w:r><w:t xml:space="preserve">${t.replace(/[{}]/g, '').toUpperCase()}: ${t}</w:t></w:r></w:p>`).join('');
  return zipSync({
    '[Content_Types].xml': strToU8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'),
    '_rels/.rels': strToU8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'),
    'word/document.xml': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}</w:body></w:document>`),
  });
}
function xlsxTemplate() {
  const toks = ['{{ref}}', '{{title}}', '{{project_name}}', '{{date}}'];
  const ss = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${toks.length}" uniqueCount="${toks.length}">${toks.map((t) => `<si><t>${t}</t></si>`).join('')}</sst>`;
  const rows = toks.map((t, i) => `<row r="${i + 1}"><c r="A${i + 1}" t="s"><v>${i}</v></c></row>`).join('');
  return zipSync({
    '[Content_Types].xml': strToU8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/></Types>'),
    '_rels/.rels': strToU8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'),
    'xl/workbook.xml': strToU8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Form" sheetId="1" r:id="rId1"/></sheets></workbook>'),
    'xl/_rels/workbook.xml.rels': strToU8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/></Relationships>'),
    'xl/worksheets/sheet1.xml': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows}</sheetData></worksheet>`),
    'xl/sharedStrings.xml': strToU8(ss),
  });
}
// A one-page PDF, for the drawing register.
function tinyPdf() {
  const s = '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n';
  return Buffer.from(s);
}
const b64 = (u8) => Buffer.from(u8).toString('base64');

/* ------------------------------------------------------------------ the release */
function unpack() {
  const work = mkdtempSync(join(tmpdir(), 'aetraa-prelaunch-'));
  const app = join(work, 'app');
  mkdirSync(app);
  if (statSync(RELEASE).isDirectory()) cpSync(RELEASE, app, { recursive: true });
  else execFileSync('tar', ['xzf', RELEASE, '-C', app]);
  execFileSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['install', '--omit=dev', '--no-audit', '--no-fund', '--silent'], { cwd: app, stdio: 'ignore', shell: process.platform === 'win32' });
  return { work, app };
}

// The routes the release itself declares, so a new screen is tested the day it ships.
function routesOf(app) {
  const src = readFileSync(join(app, 'src', 'index.js'), 'utf8');
  const pages = new Set(), gets = new Set();
  for (const line of src.split('\n')) {
    for (const m of line.matchAll(/p === '(\/[a-z0-9\-/]*)'/g)) {
      const path = m[1];
      if (path.startsWith('/api/')) {
        if (/req\.method === 'POST'/.test(line) && !/req\.method === 'GET'/.test(line)) continue;
        gets.add(path);
      } else if (!/\.(png|ico|js|webmanifest)$/.test(path) && path !== '/brand-logo') pages.add(path);
    }
  }
  return { pages: [...pages].sort(), gets: [...gets].sort() };
}

/* ------------------------------------------------------------------ backends */
function waitFor(child, re, ms) {
  return new Promise((ok, no) => {
    let buf = '';
    const t = setTimeout(() => no(new Error('did not start within ' + ms / 1000 + 's:\n' + buf.slice(-800))), ms);
    const on = (d) => { buf += d; if (re.test(buf)) { clearTimeout(t); ok(buf); } };
    child.stdout.on('data', on); child.stderr.on('data', on);
    child.on('exit', (c) => { clearTimeout(t); no(new Error('exited ' + c + ':\n' + buf.slice(-800))); });
  });
}

async function startSqlite(app, work, dataDir, keepData) {
  const port = await freePort();
  // keepData: start on an existing database WITHOUT local.mjs re-running
  // schema.sql, whose DROP TABLE lines wipe projects, people and the programme
  // (see check A6). Only the harness's temporary copy of local.mjs is changed.
  let entry = 'local.mjs';
  if (keepData) {
    const src = readFileSync(join(app, 'local.mjs'), 'utf8');
    const line = "db.exec(readFileSync(join(HERE, 'schema.sql'), 'utf8'));";
    if (src.includes(line)) { writeFileSync(join(app, 'local-keep.mjs'), src.replace(line, 'if (fresh) ' + line)); entry = 'local-keep.mjs'; }
  }
  const data = dataDir || join(work, 'sqlite-data');
  const child = spawn(process.execPath, [entry], {
    cwd: app, env: { ...process.env, PORT: String(port), AETRAA_LOCAL_DIR: data,
      ACS_CONNECTION_STRING: '', RESEND_KEY: '', ANTHROPIC_API_KEY: '' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const logs = []; child.stdout.on('data', (d) => logs.push(String(d))); child.stderr.on('data', (d) => logs.push(String(d)));
  await waitFor(child, /owner code/, 30000);
  const conf = JSON.parse(readFileSync(join(data, 'local.json'), 'utf8'));
  return { base: 'http://127.0.0.1:' + port, owner: conf.OWNER_CODE, stop: () => child.kill('SIGTERM'), logs };
}

async function startPostgres(app) {
  const { PGlite } = await import('@electric-sql/pglite');
  const { PGLiteSocketServer } = await import('@electric-sql/pglite-socket');
  const pg = await PGlite.create();
  const pgPort = await freePort();
  const pgServer = new PGLiteSocketServer({ db: pg, port: pgPort, host: '127.0.0.1' });
  await pgServer.start();
  const port = await freePort();
  const owner = 'owner-' + randomBytes(12).toString('hex');
  const child = spawn(process.execPath, ['server.js'], {
    cwd: app,
    env: { ...process.env, PORT: String(port), DATABASE_URL: `postgres://postgres:postgres@127.0.0.1:${pgPort}/postgres`,
      DB_SSL: 'off', DB_POOL_MAX: '1', AUTH_SECRET: randomBytes(32).toString('hex'), OWNER_CODE: owner,
      PUBLIC_URL: 'http://127.0.0.1:' + port, ACS_CONNECTION_STRING: '', RESEND_KEY: '', ANTHROPIC_API_KEY: '' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const logs = []; child.stdout.on('data', (d) => logs.push(String(d))); child.stderr.on('data', (d) => logs.push(String(d)));
  await waitFor(child, /listening on/, 60000);
  for (let i = 0; i < 40; i++) {
    const ok = await fetch('http://127.0.0.1:' + port + '/healthz').then((r) => r.text()).catch(() => '');
    if (ok.trim() === 'ok') break;
    await sleep(250);
  }
  return {
    base: 'http://127.0.0.1:' + port, owner, logs,
    stop: async () => { child.kill('SIGTERM'); await sleep(500); try { await pgServer.stop(); await pg.close(); } catch (e) {} },
  };
}

/* ------------------------------------------------------------------ the test, on one backend */
async function runOn(backend, app, work) {
  current = { backend };
  console.log('\n=== ' + backend + ' ===');
  let srv;
  try {
    srv = backend === 'sqlite' ? await startSqlite(app, work) : await startPostgres(app);
    record('A1', 'Boot', 'release starts (' + (backend === 'sqlite' ? 'local.mjs' : 'server.js on PostgreSQL') + ')', 'pass', srv.base);
  } catch (e) {
    record('A1', 'Boot', 'release starts', 'fail', e.message);
    return;
  }
  const calls = [];
  const owner = client(srv.base, 'owner', calls);
  const { pages, gets } = routesOf(app);

  try {
    await check('A2', 'Boot', 'owner code signs in', async () => {
      const r = await owner.post('/api/login', { code: srv.owner });
      must(r.ok, JSON.stringify(r));
    });
    await check('A3', 'Boot', 'file storage round-trips (/api/storage)', async () => {
      const r = await owner.get('/api/storage');
      must(r.working, JSON.stringify(r));
      return r.label || r.configured;
    });
    await check('A4', 'Boot', 'wrong code is refused', async () => {
      const c = client(srv.base, 'stranger');
      const r = await c.post('/api/login', { code: 'not-a-real-code-123' });
      must(r._status === 401, 'status ' + r._status);
    });

    /* ---------------- B. building a whole project through the real API */
    const seedMod = await import(pathToFileURL(join(app, 'tools', 'demo-seed.mjs')).href);
    const { seedDemo, TEAM, DEMO } = seedMod;
    const seedApi = client(srv.base, 'seed', calls);
    let seeded = null;
    const before = calls.length;
    await check('B1', 'Setup workflow', 'onboard company + project, team, programme, BOQ, BOM, registers, HSE log, IPC chain (demo seed)', async () => {
      seeded = await seedDemo(seedApi, () => {}, srv.owner);
      must(seeded && seeded.PID, 'no project id');
      return 'project ' + seeded.PID;
    });
    const seedCalls = calls.slice(before);
    const bad = seedCalls.filter((c) => c.status >= 400);
    record('B2', 'Setup workflow', 'every seed call accepted (' + seedCalls.length + ' calls)', bad.length ? 'fail' : 'pass',
      bad.slice(0, 6).map((c) => `${c.who} ${c.method} ${c.path} → ${c.status} ${c.error || ''}`).join(' | '));
    if (!seeded) throw new Error('cannot continue without a project');
    const PID = seeded.PID, OID = seeded.OID;

    // Codes for everybody, as demo-live.mjs does.
    const codes = { ...(seeded.CODES || {}) };
    await owner.post('/api/login', { code: srv.owner });
    const people = (await owner.get('/api/people?org=' + OID)).people || [];
    for (const p of people) {
      if (!p.email || codes[p.email]) continue;
      const r = await owner.post('/api/person', { org: OID, id: p.id, name: p.name, email: p.email,
        functions: p.functions || [], projects: p.projects || [], new_code: true });
      if (r && r.code) codes[p.email] = r.code;
    }
    const seats = {};
    for (const [name, email, fns] of TEAM) {
      await check('C1', 'Sign-in', 'seat signs in: ' + name, async () => {
        must(codes[email], 'no personal code was issued');
        const c = client(srv.base, name, calls);
        const r = await c.post('/api/login', { code: codes[email] });
        must(r.ok, JSON.stringify(r));
        seats[name] = { api: c, email, fns, code: codes[email], id: (people.find((p) => p.email === email) || {}).id };
      });
    }
    const S = (n) => seats[n] && seats[n].api;
    const PM = S('Project Manager'), DC = S('Document Controller'), QS = S('Quantity Surveyor'),
      CIVIL = S('Site Engineer — Civil'), DESIGN = S('Design Manager'), HSE = S('HSE Officer'),
      PLAN = S('Planning Engineer'), QAQC = S('QA/QC Engineer'), CONS = S('Consultant (read-only)');

    /* ---------------- D. every screen, as every seat */
    const pageStatus = {};
    const roles = [['AETRAA Admin (owner)', owner], ...Object.entries(seats).map(([n, s]) => [n, s.api])];
    for (const [name, api] of roles) {
      const opened = [], refused = [], broken = [];
      pageStatus[name] = {};
      for (const path of pages) {
        const q = name.startsWith('AETRAA') && path !== '/setup' ? path + '?p=' + PID : path;
        const r = await api.raw('GET', q);
        const t = await r.text();
        pageStatus[name][path] = r.status;
        if (r.status >= 500) broken.push(path + ' ' + r.status);
        else if (r.status === 200) {
          if (/<title>[^<]*(error|exception)/i.test(t) || /Internal Server Error|could not complete that request/i.test(t)) broken.push(path + ' error text');
          else opened.push(path);
        } else refused.push(path + ' ' + r.status);
      }
      record('D1', 'Dashboards', 'every page answers for ' + name + ' (' + opened.length + ' open, ' + refused.length + ' refused)',
        broken.length ? 'fail' : 'pass', broken.join(', '));
    }
    // Refusals that matter: the setup console is AETRAA's alone.
    await check('D2', 'Access', 'setup console is not usable by a client seat', async () => {
      for (const n of ['Principal', 'Project Manager', 'Consultant (read-only)']) {
        const r = await S(n).get('/api/setup/companies');
        must(r._status >= 400, n + ' got /api/setup/companies with ' + r._status);
      }
    });

    /* ---------------- E. every GET endpoint the release declares, as PM and owner */
    const skip = new Set(['/api/logout', '/api/storage']);
    for (const [name, api, suffix] of [['Project Manager', PM, ''], ['AETRAA Admin (owner)', owner, '?p=' + PID]]) {
      const five = [];
      for (const path of gets) {
        if (skip.has(path)) continue;
        const r = await api.raw('GET', path + suffix);
        await r.arrayBuffer();
        if (r.status >= 500) five.push(path + ' ' + r.status);
      }
      record('E1', 'API', 'no GET endpoint crashes for ' + name + ' (' + gets.length + ' endpoints)', five.length ? 'fail' : 'pass', five.join(', '));
    }

    /* ---------------- F. reports and registers (generators) */
    const projName = DEMO.project;
    const thisMonth = new Date().toISOString().slice(0, 7);
    const lastMonth = new Date(Date.now() - 31 * 86400000).toISOString().slice(0, 7);
    const today = new Date().toISOString().slice(0, 10);
    const monday = (() => { const d = new Date(); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return d.toISOString().slice(0, 10); })();
    const reports = [['daily', today], ['weekly', monday], ['monthly', thisMonth], ['monthly', lastMonth], ['lookahead', today], ['programme', today], ['hse', thisMonth]];
    for (const [kind, key] of reports) {
      for (const fmt of ['html', 'doc']) {
        await check('F1', 'Reports', `${kind} report ${key} as ${fmt}`, async () => {
          const who = kind === 'hse' ? HSE : PM;
          const got = await who.bytes(`/api/report?kind=${kind}&key=${key}${fmt === 'doc' ? '&format=doc' : ''}`);
          keep(`report-${kind}-${key}.${fmt === 'doc' ? 'doc' : 'html'}`, got);
          return validate(fmt === 'doc' ? 'doc' : 'html', got, { contains: projName.split(' ')[0] });
        });
      }
    }
    await check('F2', 'Reports', 'AI narrative is off without a key and says so', async () => {
      const r = await PM.post('/api/ai/report-narrative', { kind: 'weekly', key: monday });
      must(r._status < 500, 'status ' + r._status);
      return r.disabled ? 'disabled, as expected with no key' : JSON.stringify(r).slice(0, 120);
    });
    const regs = ['submittals', 'rfi', 'matapp', 'authority', 'letters', 'variations', 'inspections', 'ncr', 'permits', 'hseobs', 'mr', 'certs', 'drawings', 'boq'];
    for (const reg of regs) {
      await check('F3', 'Registers', 'register workbook: ' + reg, async () => {
        const got = await PM.bytes('/api/register/xlsx?reg=' + reg);
        if (reg === 'drawings' && got.status === 404) return { status: 'warn', detail: 'no drawing register yet (checked again after G4)' };
        keep('register-' + reg + '.xlsx', got);
        return validate('xlsx', got);
      });
      if (!['drawings', 'boq'].includes(reg)) {
        await check('F4', 'Registers', 'schedule workbook: ' + reg, async () => {
          const got = await PM.bytes('/api/register/schedule.xlsx?reg=' + reg);
          keep('schedule-' + reg + '.xlsx', got);
          return validate('xlsx', got);
        });
      }
    }
    await check('F5', 'Registers', 'CSV export of the programme', async () => {
      const got = await PM.bytes('/api/export');
      keep('export.csv', got);
      return validate('csv', got);
    });
    await check('F6', 'Programme', 'P6 progress workbook and review workbook', async () => {
      const a = await PLAN.bytes('/api/programme/p6-progress'); keep('p6-progress.xlsx', a);
      const b = await PLAN.bytes('/api/programme/p6-review'); keep('p6-review.xlsx', b);
      return validate('xlsx', a) + ' / ' + validate('xlsx', b);
    });

    /* ---------------- IPC: the documents the seed's certificate produced */
    const ipcs = ((await QS.get('/api/ipc')).certificates || []);
    await check('F7', 'Payment', 'interim payment certificate reached "certified"', async () => {
      must(ipcs.length, 'no application exists');
      const c = ipcs[0];
      must(/certif/i.test(c.status || ''), 'status is ' + c.status);
      return c.ref + ' ' + c.status + ' net ' + c.net;
    });
    if (ipcs.length) {
      const ref = encodeURIComponent(ipcs[0].ref);
      await check('F8', 'Payment', 'IPC BOQ valuation workbook', async () => { const g = await QS.bytes('/api/ipc/xlsx?ref=' + ref); keep('ipc.xlsx', g); return validate('xlsx', g); });
      await check('F9', 'Payment', 'IPC covering letter (Word)', async () => { const g = await QS.bytes('/api/ipc/doc?ref=' + ref); keep('ipc.doc', g); return validate('doc', g, { contains: ipcs[0].ref }); });
      await check('F10', 'Payment', 'IPC full pack (.zip)', async () => { const g = await QS.bytes('/api/ipc/pack?ref=' + ref); keep('ipc-pack.zip', g); return validate('zip', g, { min: 2 }); });
      await check('F11', 'Payment', 'a second application while the first is open, or a bad period, is blocked', async () => {
        const r = await QS.post('/api/ipc/check', { lines: [], period_from: today, period_to: '2099-01-01' });
        must(r.blockers && r.blockers.length, 'no blockers for a future period: ' + JSON.stringify(r).slice(0, 200));
        return r.blockers[0];
      });
    }

    /* ---------------- G. workflows beyond the seed */
    // Templates: Word and Excel consultant forms filled from a record.
    const recs = ((await PM.get('/api/records')).records || []);
    const rfi = recs.find((r) => r.type === 'rfi');
    const wir = recs.find((r) => r.type === 'wir');
    await check('G1', 'Templates', 'Word template upload + RFI filled in the consultant format', async () => {
      must(rfi, 'no RFI on the project');
      const up = await owner.post('/api/setup/template', { project_id: PID, doc_type: 'rfi', filename: 'RFI form.docx', file_b64: b64(docxTemplate()) });
      must(!up.error, 'upload: ' + up.error);
      const got = await PM.bytes('/api/record/doc?ref=' + encodeURIComponent(rfi.ref));
      keep('template-' + rfi.ref + '.docx', got);
      return validate('docx', got, { contains: [rfi.ref, DEMO.project.split(' ')[0]] });
    });
    await check('G2', 'Templates', 'Excel template upload + WIR filled in the consultant format', async () => {
      must(wir, 'no WIR on the project');
      const up = await owner.post('/api/setup/template', { project_id: PID, doc_type: 'wir', filename: 'WIR form.xlsx', file_b64: b64(xlsxTemplate()) });
      must(!up.error, 'upload: ' + up.error);
      const got = await PM.bytes('/api/record/doc?ref=' + encodeURIComponent(wir.ref));
      keep('template-' + wir.ref + '.xlsx', got);
      return validate('xlsx', got, { contains: wir.ref });
    });
    await check('G3', 'Templates', 'a record with no template says so, not a crash', async () => {
      const ncr = recs.find((r) => r.type === 'ncr');
      const r = await PM.get('/api/record/doc?ref=' + encodeURIComponent(ncr.ref));
      must(r._status === 404 && /template/i.test(r.error || ''), JSON.stringify(r).slice(0, 160));
    });

    // Drawings: Design uploads, PM approves, register workbook.
    await check('G4', 'Drawings', 'Design uploads a sheet, PM approves, drawing register exports', async () => {
      await owner.post('/api/setup/rules?p=' + PID, { prefixes: ['AR', 'ST', 'ME'] }).catch(() => {});
      const up = await DESIGN.post('/api/drawing', { number: 'AR-101', title: 'Ground floor plan', revision: 'A', kind: 'ifc',
        filename: 'AR-101.pdf', data: 'data:application/pdf;base64,' + b64(tinyPdf()) });
      must(!up.error, 'upload: ' + up.error);
      const list = await PM.get('/api/drawings');
      const d = (list.drawings || []).find((x) => x.number === 'AR-101');
      must(d, 'uploaded sheet is not in the register' + (up.held ? ' (it was held by the numbering gate)' : ''));
      if (d.status !== 'current') {
        const a = await PM.post('/api/drawing/approve', { id: d.id });
        must(!a.error, 'approve: ' + a.error);
      }
      const got = await PM.bytes('/api/register/xlsx?reg=drawings');
      keep('register-drawings.xlsx', got);
      return validate('xlsx', got, { contains: 'AR-101' });
    });

    // Minutes and the action tracker.
    await check('G5', 'Minutes', 'DC drafts minutes, issues them, action is numbered, PM closes it, Word downloads', async () => {
      const pmId = seats['Project Manager'].id;
      const d = await DC.post('/api/meeting', { type: 'progress', title: 'Progress meeting', meeting_date: today, start_time: '10:00',
        location: 'Site office', chair: 'Project Manager',
        attendees: [{ name: 'Project Manager', company: DEMO.company }, { name: 'Consulting Engineer', company: DEMO.engineer }],
        items: [{ subject: 'Programme', discussion: 'L4 slab behind', decision: 'Recovery plan',
          actions: [{ text: 'Issue recovery programme', owner_user_id: pmId, due: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10) }] }] });
      must(d.ref, 'draft: ' + JSON.stringify(d).slice(0, 200));
      const iss = await DC.post('/api/meeting/issue', { ref: d.ref });
      must(!iss.error, 'issue: ' + iss.error);
      const acts = (await PM.get('/api/actions?mine=1')).actions || [];
      must(acts.length, 'PM has no actions after issue');
      const cl = await PM.post('/api/action', { ref: acts[0].ref, close: true, note: 'Issued rev 1' });
      must(!cl.error, 'close: ' + cl.error);
      const doc = await PM.bytes('/api/meeting/doc?ref=' + d.ref); keep('minutes-' + d.ref + '.doc', doc);
      const xl = await PM.bytes('/api/actions/xlsx'); keep('actions.xlsx', xl);
      return validate('doc', doc, { contains: d.ref }) + ' / ' + validate('xlsx', xl);
    });

    // Incoming letter → reply → closes itself.
    await check('G6', 'Correspondence', 'DC logs an incoming letter; the issued reply closes it', async () => {
      const inc = await DC.post('/api/records', { type: 'incoming', title: 'Engineer instruction on facade', data: {
        Subject: 'Engineer instruction on facade', From: DEMO.engineer, 'Their reference': 'CE-L-044',
        'Letter date': today, 'Date received': today, Type: 'Instruction', 'Action by': 'commercial' } });
      must(inc.ref, 'log: ' + JSON.stringify(inc).slice(0, 200));
      const rep = await QS.post('/api/records', { type: 'letter', title: 'Reply — facade instruction', data: {
        Subject: 'Reply — facade instruction', Type: 'Reply', To: 'Consultant', Body: 'Acknowledged.', 'In reply to': inc.ref } });
      must(rep.ref, 'reply: ' + JSON.stringify(rep).slice(0, 200));
      for (let i = 0; i < 6; i++) {
        const r = (await PM.get('/api/record?ref=' + encodeURIComponent(rep.ref))).record || {};
        if (/issued|closed|replied/i.test(r.status || '')) break;
        const who = /dc|document/i.test(JSON.stringify((r.workflow || [])[r.step || 0] || {})) ? DC : PM;
        const a = await who.post('/api/record/advance', { ref: rep.ref, action: 'advance' });
        if (a.error) { const b2 = await DC.post('/api/record/advance', { ref: rep.ref, action: 'advance' }); if (b2.error) throw new Error('advance: ' + a.error + ' / ' + b2.error); }
      }
      const after = (await PM.get('/api/record?ref=' + encodeURIComponent(inc.ref))).record || {};
      must(/repl|closed/i.test(after.status || ''), 'incoming letter is still ' + after.status);
      return inc.ref + ' → ' + after.status;
    });

    // Site diary.
    // Ajay, 6 Oct 2026 (decision 11): the diary is saved by Document Control or
    // the person the PM assigns; the PM submits it.
    await check('G7', 'Site diary', 'Document Control saves a diary; the PM submits it; Word and print versions download', async () => {
      const refused = await CIVIL.post('/api/diary', { report_date: today, weather: 'Sunny' });
      must(refused.error, 'a site engineer who is not assigned could still save the diary');
      const s = await DC.post('/api/diary', { report_date: today, weather: 'Sunny', prepared_by: 'Site Engineer — Civil', staff: [{ t: 'Site engineer', n: 2, h: '10' }],
        works: [{ a: 'L4 slab rebar', q: '40%' }], tomorrow: [{ a: 'L4 slab pour prep', q: '' }] });
      must(!s.error, 'save: ' + s.error);
      const sub = await PM.post('/api/diary', { report_date: today, submit: true, prepared_by: 'Site Engineer — Civil' });
      const docx = await PM.bytes('/diary/docx?date=' + today); keep('diary.docx', docx);
      const html = await PM.bytes('/diary/doc?date=' + today); keep('diary.html', html);
      const v = validate('docx', docx) + ' / ' + validate('html', html);
      return sub.error ? { status: 'warn', detail: 'submit held as draft (blockers listed): ' + sub.error.slice(0, 200) + ' — files: ' + v } : v;
    });

    // Issues log.
    await check('G8', 'Issues', 'site raises an issue; office issues it; issue notice renders', async () => {
      const c = await CIVIL.post('/api/issue', { create: true, title: 'Late drawings for L5 MEP', reason: 'Design information', detail: 'Waiting on ME-150' });
      must(c.ref, 'raise: ' + JSON.stringify(c).slice(0, 200));
      const u = await PM.post('/api/issue', { ref: c.ref, action: 'issue' });
      must(!u.error, 'issue: ' + u.error);
      const g = await PM.bytes('/issues/doc?ref=' + c.ref); keep('issue-' + c.ref + '.html', g);
      return validate('html', g, { contains: c.ref });
    });

    // Every record workflow moved to its end by whoever owns each step.
    await check('G9', 'Workflows', 'every register type can be walked to the end of its workflow', async () => {
      const all = ((await PM.get('/api/records')).records || []);
      const byType = {};
      for (const r of all) if (!byType[r.type]) byType[r.type] = r;
      const stuck = [];
      const tryAll = [PM, DC, QAQC, HSE, QS, CIVIL, DESIGN, S('Principal')];
      for (const r0 of Object.values(byType)) {
        let r = r0, moves = 0;
        for (let i = 0; i < 10; i++) {
          const cur = (await PM.get('/api/record?ref=' + encodeURIComponent(r.ref))).record;
          if (!cur || (cur.workflow && (cur.step || 0) >= cur.workflow.length - 1 && /closed|approved|issued|complete|code|recorded|done/i.test(cur.status || ''))) break;
          let moved = false;
          for (const who of tryAll) {
            const body = { ref: r.ref, action: 'advance', code: 'A', note: 'harness', result: 'Approved' };
            const a = await who.post('/api/record/advance', body);
            if (!a.error) { moved = true; moves++; break; }
          }
          if (!moved) break;
          const again = (await PM.get('/api/record?ref=' + encodeURIComponent(r.ref))).record;
          if (again && again.status === cur.status && again.step === cur.step) break;
        }
        const end = (await PM.get('/api/record?ref=' + encodeURIComponent(r.ref))).record || {};
        const terminal = /closed|approved|issued|replied|complete|certified|recorded|code [ab]/i.test(end.status || '');
        if (!moves && !terminal) stuck.push(r.type + ' (' + r.ref + ' stuck at "' + end.status + '")');
      }
      if (stuck.length) return { status: 'warn', detail: 'no seat could move: ' + stuck.join('; ') };
      return Object.keys(byType).length + ' types moved';
    });

    // Access rules that protect the client.
    await check('G10', 'Access', 'consultant (read-only) cannot raise records, payments or drawings', async () => {
      const a = await CONS.post('/api/records', { type: 'rfi', title: 'x', data: { Subject: 'x' } });
      const b = await CONS.post('/api/ipc', {});
      const c = await CONS.post('/api/drawing', { number: 'AR-999', data: 'data:application/pdf;base64,' + b64(tinyPdf()) });
      const ok = [a, b, c].every((r) => r._status >= 400);
      must(ok, 'statuses ' + [a, b, c].map((r) => r._status).join(','));
    });
    await check('G11', 'Access', 'a site engineer cannot approve payment or drawings', async () => {
      const a = await CIVIL.post('/api/ipc/advance', { ref: ipcs[0] && ipcs[0].ref, action: 'approve' });
      const b = await CIVIL.post('/api/drawing/approve', { id: 'x' });
      must(a._status >= 400 && b._status >= 400, 'statuses ' + a._status + ',' + b._status);
    });

    // Modules: switch one off, the server refuses it; on again, nothing lost.
    await check('G12', 'Modules', 'switching Commercial off hides and refuses it; on again keeps every record', async () => {
      const cur = await owner.get('/api/setup/modules?project=' + PID);
      const list = Array.isArray(cur.enabled) ? cur.enabled : [];
      const key = list.find((m) => /commerc/i.test(m));
      if (!key) return { status: 'warn', detail: 'could not read module list: ' + JSON.stringify(cur).slice(0, 200) };
      const off = await owner.post('/api/setup/modules', { project_id: PID, modules: list.filter((m) => m !== key) });
      must(!off.error, 'off: ' + off.error);
      const refused = await QS.get('/api/boq');
      const on = await owner.post('/api/setup/modules', { project_id: PID, modules: list });
      must(!on.error, 'on: ' + on.error);
      const back = await QS.get('/api/boq');
      must(refused._status >= 400, 'BOQ still served with Commercial off (' + refused._status + ')');
      must(back._status === 200, 'BOQ not back after switching on (' + back._status + ')');
    });

    // Programme from a real Primavera file.
    await check('G13', 'Programme', 'Primavera .xer preview and import', async () => {
      if (!XER || !existsSync(XER)) return { status: 'untestable', detail: 'no --xer file given' };
      const file = b64(readFileSync(XER));
      const pv = await owner.post('/api/setup/xer/preview', { project_id: PID, file_b64: file });
      must(!pv.error, 'preview: ' + pv.error);
      const cm = await owner.post('/api/setup/xer/commit', { project_id: PID, file_b64: file });
      must(!cm.error, 'commit: ' + cm.error);
      const st = await PLAN.get('/api/programme/status');
      must(st.activities > 0, 'no activities after import');
      return basename(XER) + ': ' + st.activities + ' activities';
    });

    // Intake: a folder dropped in, scanned, nothing written until commit.
    await check('G14', 'Intake', 'folder intake: open batch, scan files, read back', async () => {
      const bt = await owner.post('/api/intake/batch', { project_id: PID, scope: 'full' });
      must(bt.id || bt.batch_id, 'batch: ' + JSON.stringify(bt).slice(0, 200));
      const id = bt.id || bt.batch_id;
      const files = [['Drawings/AR-102 First floor plan Rev A.pdf', tinyPdf()], ['Contract/Particular Conditions.txt', Buffer.from('Retention 10% limited to 5% of the Contract Price. Advance payment 10%.')]];
      for (const [path, bytes] of files) {
        const s = await owner.post('/api/intake/scan', { project_id: PID, batch_id: id, filename: basename(path), path, data: b64(bytes) });
        must(!s.error, 'scan ' + path + ': ' + s.error);
      }
      const got = await owner.get('/api/intake/batch?id=' + encodeURIComponent(id));
      must(!got.error, got.error);
      return 'batch ' + id + ' read back';
    });

    await check('G15', 'Dashboards', '"Needs my attention" answers for every seat', async () => {
      const badA = [];
      for (const [n, s] of Object.entries(seats)) {
        const r = await s.api.get('/api/attention');
        if (r._status !== 200) badA.push(n + ' ' + r._status);
      }
      must(!badA.length, badA.join(', '));
    });
    await check('G16', 'Notifications', 'DC notifies the team; PM sees it under the bell', async () => {
      const n = await DC.post('/api/notify', { functions: ['pm'], title: 'Harness notice', message: 'test' });
      must(!n.error, 'notify: ' + n.error);
      const list = await PM.get('/api/notifications');
      must(JSON.stringify(list).includes('Harness notice'), 'PM did not get it');
    });
    await check('G17', 'Go-live', 'AETRAA Admin takes the project live', async () => {
      const r = await owner.post('/api/setup/golive', { project_id: PID });
      must(!r.error, r.error);
      return r.already ? 'already live' : 'live';
    });

    // Email: a local copy must not send.
    await check('G18', 'Email', 'email is off locally and the platform says so', async () => {
      const r = await owner.get('/api/email-check');
      must(r._status < 500, 'status ' + r._status);
      return JSON.stringify(r).slice(0, 140);
    });

    /* ---------------- H. what a person sees, in a real browser */
    if (BROWSER) await browserPass(srv.base, roles, pages, pageStatus, PID,
      async (name) => ({ path: '/api/login', data: { code: name.startsWith('AETRAA') ? srv.owner : seats[name].code } }));

    // Server-side errors logged while all of this ran.
    const errs = srv.logs.join('').split('\n').filter((l) => /error|exception|unhandled/i.test(l) && !/ExperimentalWarning|SQLite is an experimental/i.test(l));
    record('A5', 'Boot', 'server log has no errors during the run', errs.length ? 'warn' : 'pass', errs.slice(0, 5).join(' | '));
    writeFileSync(join(OUT, backend + '-server.log'), srv.logs.join(''));
    writeFileSync(join(OUT, backend + '-calls.json'), JSON.stringify(calls, null, 1));
  } catch (e) {
    record('Z', 'Harness', 'run stopped', 'fail', e.stack || e.message);
  } finally {
    await srv.stop();
  }
  if (backend === 'sqlite') {
    await sleep(800);
    await check('A6', 'Boot', 'local.mjs restarts on its own database and the projects are still there', async () => {
      let again;
      try { again = await startSqlite(app, work); }
      catch (e) { throw new Error('restart failed: ' + e.message.split('\n').filter((l) => /Error|exists/.test(l)).slice(0, 2).join(' ')); }
      try {
        const c = client(again.base, 'owner');
        must((await c.post('/api/login', { code: again.owner })).ok, 'owner cannot sign in after restart');
        const n = ((await c.get('/api/projects')).projects || []).length;
        must(n > 0, 'no projects after restart');
        return n + ' project(s) kept';
      } finally { again.stop(); }
    });
  }
}

/* ------------------------------------------------------------------ H. the browser pass */
async function browserPass(base, roles, pages, pageStatus, PID, loginFor) {
  let chromium;
  try { ({ chromium } = await import('playwright-core')); } catch (e) { record('H0', 'Browser', 'headless Chrome', 'untestable', 'playwright-core not installed'); return; }
  let browser;
  try { browser = await chromium.launch({ channel: 'chrome', headless: true }); }
  catch (e) { record('H0', 'Browser', 'headless Chrome', 'untestable', 'Google Chrome not found: ' + e.message.split('\n')[0]); return; }
  const shots = join(OUT, current.backend, 'screens'); mkdirSync(shots, { recursive: true });
  for (const [name] of roles) {
    for (const mobile of [false, true]) {
      if (mobile && !/Site Engineer — Civil|Project Manager|AETRAA/.test(name)) continue;
      const ctx = await browser.newContext(mobile ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } : { viewport: { width: 1440, height: 900 } });
      const how = await loginFor(name);
      const lr = await ctx.request.post(base + how.path, { data: how.data });
      if (!lr.ok()) { record('H1', 'Browser', name + ' signs in', 'fail', 'HTTP ' + lr.status()); await ctx.close(); continue; }
      const problems = [];
      let n = 0;
      for (const path of pages) {
        if (pageStatus[name][path] !== 200) continue;
        if (/\/docx?$/.test(path)) continue;      // downloads, checked as files in F/G
        if (mobile && !['/', '/site', '/diary', '/home', '/project', '/setup'].includes(path)) continue;
        const page = await ctx.newPage();
        const errs = [];
        page.on('pageerror', (e) => errs.push('JS error: ' + e.message.split('\n')[0]));
        page.on('console', (m) => { if (m.type() === 'error' && !/favicon|Failed to load resource: the server responded with a status of 40\d/.test(m.text())) errs.push('console: ' + m.text().slice(0, 160)); });
        page.on('response', (r) => { if (r.status() >= 500) errs.push('HTTP ' + r.status() + ' ' + new URL(r.url()).pathname); });
        const url = base + (name.startsWith('AETRAA') && path !== '/setup' ? path + '?p=' + PID : path);
        try {
          await page.goto(url, { waitUntil: 'load', timeout: 20000 });
          await page.waitForTimeout(1500);
          const txt = (await page.evaluate(() => document.body ? document.body.innerText : '')) || '';
          if (txt.trim().length < 20) errs.push('blank page');
          if (/\bundefined\b|\bNaN\b|\[object Object\]/.test(txt)) errs.push('shows undefined/NaN on screen: "' + (txt.match(/.{0,40}(\bundefined\b|\bNaN\b|\[object Object\]).{0,40}/) || [''])[0].replace(/\s+/g, ' ') + '"');
          await page.screenshot({ path: join(shots, safeName(name + (mobile ? '-mobile' : '') + path) + '.png'), fullPage: false });
        } catch (e) { errs.push('did not load: ' + e.message.split('\n')[0]); }
        if (errs.length) problems.push(path + ': ' + [...new Set(errs)].slice(0, 3).join('; '));
        n++;
        await page.close();
      }
      record('H1', 'Browser', `${name}${mobile ? ' (phone)' : ''}: ${n} pages drawn without errors`, problems.length ? 'fail' : 'pass', problems.slice(0, 6).join(' || '));
      await ctx.close();
    }
  }
  await browser.close();
}


/* ------------------------------------------------------------------ YOUR projects, on a copy of their database */
//
//   node run.mjs --project-db "../local-data/aetraa.db" [--project "<name or id>"]
//
// For a project you have set up locally (all documents in, all steps done):
// copies the database to a temporary folder — the original is never opened for
// writing — starts the release on the copy, and for each project checks its
// readiness, every page as every person on it, every report and register, and
// every consultant template you uploaded, filled from one of its own records.
async function projectMode(app, work) {
  current = { backend: 'project' };
  console.log('\n=== your projects (on a copy of ' + PROJECT_DB + ') ===');
  const data = join(work, 'project-data');
  mkdirSync(data, { recursive: true });
  for (const ext of ['', '-wal', '-shm']) {
    if (existsSync(PROJECT_DB + ext)) cpSync(PROJECT_DB + ext, join(data, 'aetraa.db' + ext));
  }
  let srv;
  try { srv = await startSqlite(app, work, data, true); record('A1', 'Boot', 'release starts on a copy of your database', 'pass', srv.base); }
  catch (e) { record('A1', 'Boot', 'release starts on a copy of your database', 'fail', e.message); return; }
  const calls = [];
  const owner = client(srv.base, 'owner', calls);
  const { pages } = routesOf(app);
  try {
    must((await owner.post('/api/login', { code: srv.owner })).ok, 'owner sign-in failed');
    let projects = ((await owner.get('/api/projects')).projects || []).filter((x) => !x.archived);
    if (ONLY) projects = projects.filter((x) => x.id === ONLY || String(x.name || '').toLowerCase().includes(ONLY.toLowerCase()));
    if (!projects.length) { record('P0', 'Projects', 'projects found in the database', 'fail', ONLY ? 'none matches "' + ONLY + '"' : 'the database holds no projects yet — set one up first'); return; }
    record('P0', 'Projects', projects.length + ' project(s) to test', 'pass', projects.map((x) => x.name).join(', '));

    for (const proj of projects) {
      const PID = proj.id, tag = proj.name || PID;
      current = { backend: 'project: ' + tag };
      const q = (path) => path + (path.includes('?') ? '&' : '?') + 'p=' + PID;

      await check('P1', 'Readiness', 'setup checklist (/api/project-check)', async () => {
        const r = await owner.get('/api/project-check?project=' + PID);
        must(r._status === 200, JSON.stringify(r).slice(0, 200));
        const gaps = JSON.stringify(r).match(/"(missing|todo|gaps|problems)":\[[^\]]+\]/g);
        return gaps ? { status: 'warn', detail: gaps.join(' ').slice(0, 500) } : 'nothing reported missing';
      });
      await check('P2', 'Readiness', 'project is live', async () => {
        const st = proj.setup_state || (await owner.get(q('/api/project'))).setup_state;
        return st === 'draft' ? { status: 'warn', detail: 'still a draft — go-live not pressed' } : (st || 'live');
      });

      // Every person on the project, signed in on the copy.
      const people = ((await owner.get('/api/people' + (proj.org_id ? '?org=' + proj.org_id : ''))).people || [])
        .filter((u) => (u.projects || []).includes(PID) && u.status !== 'suspended');
      const seats = {};
      for (const u of people) {
        await check('P3', 'Sign-in', 'signs in: ' + u.name + ' (' + (u.functions || []).join(', ') + ')', async () => {
          const c = client(srv.base, u.name, calls);
          const login = async () => {
            const iss = await owner.post('/api/signin/issue', { user_id: u.id, org: u.org_id });
            if (iss.code) {
              const r = await c.post('/api/signin/code', { email: u.email, code: iss.code });
              must(r.ok || !r.error, 'email-code sign-in: ' + JSON.stringify(r).slice(0, 160));
              return { path: '/api/signin/code', fresh: true };
            }
            const pc = await owner.post('/api/person', { org: u.org_id, id: u.id, name: u.name, email: u.email,
              functions: u.functions || [], projects: u.projects || [], new_code: true });
            must(pc.code, 'could not get a code: ' + (iss.error || pc.error));
            const r = await c.post('/api/login', { code: pc.code });
            must(r.ok, 'personal-code sign-in: ' + JSON.stringify(r).slice(0, 160));
            return { path: '/api/login', code: pc.code };
          };
          const how = await login();
          await c.post('/api/project', { project: PID }).catch(() => {});
          seats[u.name] = { api: c, user: u, how };
        });
      }
      if (!people.length) record('P3', 'Sign-in', 'people on the project', 'warn', 'nobody is on this project yet');

      // Every page, as the owner and as every person.
      const pageStatus = {};
      const roles = [['AETRAA Admin (owner)', owner], ...Object.entries(seats).map(([n, s]) => [n, s.api])];
      for (const [name, api] of roles) {
        const broken = []; let open = 0;
        pageStatus[name] = {};
        for (const path of pages) {
          const r = await api.raw('GET', name.startsWith('AETRAA') && path !== '/setup' ? q(path) : path);
          const t = await r.text();
          pageStatus[name][path] = r.status;
          if (r.status >= 500 || (r.status === 200 && /Internal Server Error|could not complete that request/i.test(t))) broken.push(path + ' ' + r.status);
          else if (r.status === 200) open++;
        }
        record('P4', 'Dashboards', name + ': every page answers (' + open + ' open)', broken.length ? 'fail' : 'pass', broken.join(', '));
        if (!name.startsWith('AETRAA')) {
          const a = await api.get('/api/attention');
          record('P4', 'Dashboards', name + ': "Needs my attention"', a._status === 200 ? 'pass' : 'fail',
            a._status === 200 ? ((a.items || a.list || []).length + ' items') : 'HTTP ' + a._status);
        }
      }

      // Reports.
      const today = new Date().toISOString().slice(0, 10), month = today.slice(0, 7);
      const monday = (() => { const d = new Date(); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return d.toISOString().slice(0, 10); })();
      for (const [kind, key] of [['daily', today], ['weekly', monday], ['monthly', month], ['lookahead', today], ['programme', today], ['hse', month]]) {
        for (const fmt of ['html', 'doc']) {
          await check('P5', 'Reports', `${kind} report as ${fmt}`, async () => {
            const got = await owner.bytes(q(`/api/report?kind=${kind}&key=${key}${fmt === 'doc' ? '&format=doc' : ''}`));
            keep(`${safeName(tag)}-report-${kind}.${fmt === 'doc' ? 'doc' : 'html'}`, got);
            return validate(fmt === 'doc' ? 'doc' : 'html', got);
          });
        }
      }
      // Registers.
      for (const reg of ['submittals', 'rfi', 'matapp', 'authority', 'letters', 'variations', 'inspections', 'ncr', 'permits', 'hseobs', 'mr', 'certs', 'drawings', 'boq']) {
        await check('P6', 'Registers', 'register workbook: ' + reg, async () => {
          const got = await owner.bytes(q('/api/register/xlsx?reg=' + reg));
          if (got.status === 404 || got.status === 403) return { status: 'warn', detail: strFromU8(got.bytes).slice(0, 160) };
          keep(`${safeName(tag)}-register-${reg}.xlsx`, got);
          return validate('xlsx', got);
        });
      }
      await check('P7', 'Programme', 'programme loaded and P6 progress workbook', async () => {
        const st = await owner.get(q('/api/programme/status'));
        if (!st.activities) return { status: 'warn', detail: 'no programme activities — upload the .xer' };
        const got = await owner.bytes(q('/api/programme/p6-progress'));
        return st.activities + ' activities; ' + validate('xlsx', got);
      });

      // Every consultant template you uploaded, filled from one of this project's records.
      const tp = await owner.get('/api/setup/templates?project=' + PID);
      const tpls = (tp.templates || []);
      if (!tpls.length) record('P8', 'Templates', 'consultant templates uploaded', 'warn', 'none uploaded for this project');
      const recs = ((await owner.get(q('/api/records'))).records || []);
      for (const t of tpls) {
        const type = t.doc_type || t.type;
        await check('P8', 'Templates', 'template fills: ' + (tp.doc_types && tp.doc_types[type] || type) + ' (' + (t.filename || '') + ')', async () => {
          let rec = recs.find((r) => r.type === type);
          if (!rec && type !== 'ipc' && !/transmittal|cvi/.test(type)) {
            const made = await owner.post(q('/api/records'), { type, title: 'Pre-launch test — ' + type, data: { Subject: 'Pre-launch test', Title: 'Pre-launch test' } });
            if (made.ref) rec = { ref: made.ref, type };
          }
          if (!rec) return { status: 'untestable', detail: 'no ' + type + ' record on the project to fill it from' };
          const got = await owner.bytes(q('/api/record/doc?ref=' + encodeURIComponent(rec.ref)));
          const fmt = /spreadsheet/.test(got.type) ? 'xlsx' : 'docx';
          keep(`${safeName(tag)}-template-${type}.${fmt}`, got);
          return rec.ref + ': ' + validate(fmt, got, { contains: rec.ref });
        });
      }
      // Payment certificates on the project.
      const ipcs = ((await owner.get(q('/api/ipc'))).certificates || []);
      for (const c of ipcs) {
        await check('P9', 'Payment', 'IPC documents: ' + c.ref, async () => {
          const r = encodeURIComponent(c.ref);
          const a = await owner.bytes(q('/api/ipc/xlsx?ref=' + r)), b = await owner.bytes(q('/api/ipc/doc?ref=' + r)), z = await owner.bytes(q('/api/ipc/pack?ref=' + r));
          keep(`${safeName(tag)}-${c.ref}.zip`, z);
          return validate('xlsx', a) + ' / ' + validate('doc', b) + ' / ' + validate('zip', z);
        });
      }

      if (BROWSER) {
        await browserPass(srv.base, roles, pages, pageStatus, PID, async (name) => {
          if (name.startsWith('AETRAA')) return { path: '/api/login', data: { code: srv.owner } };
          const s = seats[name];
          if (s.how.code) return { path: '/api/login', data: { code: s.how.code } };
          const iss = await owner.post('/api/signin/issue', { user_id: s.user.id, org: s.user.org_id });
          return { path: '/api/signin/code', data: { email: s.user.email, code: iss.code } };
        });
      }
    }
    const errs = srv.logs.join('').split('\n').filter((l) => /error|exception|unhandled/i.test(l) && !/ExperimentalWarning|SQLite is an experimental/i.test(l));
    current = { backend: 'project' };
    record('A5', 'Boot', 'server log has no errors during the run', errs.length ? 'warn' : 'pass', errs.slice(0, 5).join(' | '));
    writeFileSync(join(OUT, 'project-server.log'), srv.logs.join(''));
  } catch (e) {
    record('Z', 'Harness', 'run stopped', 'fail', e.stack || e.message);
  } finally {
    await srv.stop();
  }
}

/* ------------------------------------------------------------------ live, read only */
async function liveReadonly() {
  current = { backend: 'live (read-only)' };
  console.log('\n=== live, read-only GETs ===');
  for (const path of ['/', '/healthz', '/manifest.webmanifest', '/demo']) {
    await check('L1', 'Live', 'GET ' + LIVE + path, async () => {
      const r = await fetch(LIVE + path, { method: 'GET', redirect: 'manual' });
      const t = await r.text();
      if (r.status >= 500) throw new Error('HTTP ' + r.status);
      return 'HTTP ' + r.status + ', ' + t.length + ' bytes';
    });
  }
}

/* ------------------------------------------------------------------ main */
console.log('AETRAA pre-launch test');
console.log('  release : ' + RELEASE);
console.log('  results : ' + OUT);
current = { backend: 'all' };
let unpacked;
try {
  unpacked = unpack();
  record('A0', 'Boot', 'release unpacks and installs its packages', 'pass', basename(RELEASE));
} catch (e) {
  record('A0', 'Boot', 'release unpacks and installs its packages', 'fail', e.message);
}
if (unpacked && PROJECT_DB) await projectMode(unpacked.app, unpacked.work);
else if (unpacked) for (const b of BACKENDS) await runOn(b, unpacked.app, unpacked.work);
if (unpacked) { try { rmSync(unpacked.work, { recursive: true, force: true }); } catch (e) {} }
if (flag('--live-readonly')) await liveReadonly();

// Things this harness cannot reach from a laptop, stated rather than skipped silently.
current = { backend: 'all' };
for (const [id, what, why] of [
  ['U1', 'Sign-in codes by email (Azure Communication Services)', 'sends real email; needs the live ACS connection string. Check by hand on the live site with one internal address.'],
  ['U2', 'Scheduled sends: daily 18:00, weekly Mon 07:00, monthly 1st 08:00, 06:00 digest', 'driven by the server clock and email; the report bodies they send are covered by F1.'],
  ['U3', 'AI report narrative with a real key', 'needs ANTHROPIC_API_KEY and spends money; only the switched-off path is tested (F2).'],
  ['U4', 'Azure object storage for files', 'needs the live S3/Blob credentials; locally files go in the database. After deploy, sign in as owner and open /api/storage — it must say working: true.'],
  ['U5', 'Azure hosting, DNS, TLS for app.aetraa.ae', 'infrastructure, not code; use --live-readonly after deploy.'],
  ['U6', 'Installing as a phone app (PWA)', 'needs a real phone over HTTPS.'],
]) record(id, 'Untestable here', what, 'untestable', why);

/* ------------------------------------------------------------------ report */
writeFileSync(join(OUT, 'results.json'), JSON.stringify({ release: RELEASE, when: new Date().toISOString(), results }, null, 1));
const count = (s) => results.filter((r) => r.status === s).length;
const lines = ['# AETRAA pre-launch test', '', `Release: \`${basename(RELEASE)}\`  `, `Run: ${new Date().toISOString()}  `,
  `**${count('pass')} pass · ${count('fail')} fail · ${count('warn')} warn · ${count('untestable')} untestable**`, '',
  '| Backend | ID | Area | Check | Result | Detail |', '|---|---|---|---|---|---|',
  ...results.map((r) => `| ${r.backend} | ${r.id} | ${r.area} | ${r.name.replace(/\|/g, '/')} | ${r.status.toUpperCase()} | ${r.detail.replace(/\|/g, '/').replace(/\n/g, ' ')} |`)];
writeFileSync(join(OUT, 'summary.md'), lines.join('\n') + '\n');
console.log('\n' + '='.repeat(60));
console.log(`${count('pass')} pass, ${count('fail')} fail, ${count('warn')} warn, ${count('untestable')} untestable`);
console.log('results: ' + join(OUT, 'summary.md'));
process.exit(count('fail') ? 1 : 0);
