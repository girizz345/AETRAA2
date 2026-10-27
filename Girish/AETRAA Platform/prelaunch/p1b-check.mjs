// P1b: a whole project folder through the real intake API — combined sets split,
// numbers read from the sheet, duplicates archived, reports filed as documents.
// Al Warqa'a's own drawings and programme must be filed; another project's
// drawings and programmes parked, with the agreed message; the Admin warned
// after three. SQLite and PostgreSQL, 127.0.0.1 only.
//
//   node p1a-check.mjs [--backend sqlite|postgres]

import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, cpSync, readdirSync, statSync, existsSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import { join, dirname, resolve, basename } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { randomBytes } from 'node:crypto';
import { createServer } from 'node:net';

const HERE = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const arg = (k, d) => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : d);
const APP_SRC = resolve(arg('--app', join(HERE, '..', 'work', 'test-drive')));
const KINDS = argv.includes('--backend') ? [arg('--backend')] : ['sqlite', 'postgres'];
const D = join(homedir(), 'Documents');
const OWN_DIR = join(D, 'Claude/Projects/JBBC/4210529 - Al Warqa\'a (Iconic)');
const OTHER_DIRS = [join(D, 'Projects/JVC'), join(D, 'Projects/Menarat (Aldar AD)'), join(D, 'Projects/CLUSTER 3')];
const OWN_XER = join(D, 'Claude/Projects/JBBC-Iconic/Project Plan /J179 - Baseline Schedule (1).xer');
const OTHER_XER = join(homedir(), 'Downloads/MAJ-BL 114D.xer');

let fails = 0, passes = 0, backend = '';
const ok = (name, cond, detail) => {
  if (cond) { passes++; console.log(`  ok    [${backend}] ${name}`); }
  else { fails++; console.log(`  FAIL  [${backend}] ${name}${detail ? '  — ' + String(detail).slice(0, 300) : ''}`); }
};
const freePort = () => new Promise((r) => { const s = createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const walk = (d, o = []) => { for (const n of readdirSync(d)) { const p = join(d, n); const s = statSync(p); if (s.isDirectory()) walk(p, o); else if (/\.pdf$/i.test(n)) o.push({ p, size: s.size }); } return o; };
const smallest = (dir, n, re) => walk(dir).filter((f) => !re || re.test(f.p)).sort((a, b) => a.size - b.size).slice(0, n).map((f) => f.p);

function client(base) {
  let cookie = '';
  const api = {
    reset() { cookie = ''; }, cookie: () => cookie,
    async raw(method, path, body) {
      const r = await fetch(base + path, { method, redirect: 'manual',
        headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
        body: body === undefined ? undefined : JSON.stringify(body) });
      for (const c of r.headers.getSetCookie()) { const f = c.split(';')[0], n = f.split('=')[0];
        cookie = cookie.split('; ').filter((x) => x && x.split('=')[0] !== n).concat(/=$/.test(f) ? [] : [f]).join('; '); }
      return r;
    },
    async req(m, p, b) { const r = await api.raw(m, p, b); const t = await r.text(); let o; try { o = JSON.parse(t); } catch (e) { o = { _text: t.slice(0, 200) }; } o._status = r.status; return o; },
    get: (p) => api.req('GET', p), post: (p, b) => api.req('POST', p, b || {}),
  };
  return api;
}

async function boot(kind, work) {
  const port = await freePort();
  const APP = join(work, 'app');
  cpSync(APP_SRC, APP, { recursive: true, filter: (f) => !/\/\.git(\/|$)|\/local-data(\/|$)/.test(f) });
  const logs = [];
  if (kind === 'sqlite') {
    const data = join(work, 'sq');
    const child = spawn(process.execPath, ['local.mjs'], { cwd: APP, stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, PORT: String(port), AETRAA_LOCAL_DIR: data, ACS_CONNECTION_STRING: '', RESEND_KEY: '' } });
    child.stdout.on('data', (d) => logs.push(String(d))); child.stderr.on('data', (d) => logs.push(String(d)));
    for (let i = 0; i < 100 && !logs.join('').includes('owner code'); i++) await sleep(100);
    return { base: 'http://127.0.0.1:' + port, owner: JSON.parse(readFileSync(join(data, 'local.json'), 'utf8')).OWNER_CODE, logs,
      stop: async () => { child.kill(); await sleep(300); } };
  }
  const { PGlite } = await import('@electric-sql/pglite');
  const { PGLiteSocketServer } = await import('@electric-sql/pglite-socket');
  const pg = await PGlite.create(); const pgPort = await freePort();
  const srv = new PGLiteSocketServer({ db: pg, port: pgPort, host: '127.0.0.1' }); await srv.start();
  const owner = 'owner-' + randomBytes(12).toString('hex');
  const child = spawn(process.execPath, ['server.js'], { cwd: APP, stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, PORT: String(port), DATABASE_URL: `postgres://postgres:postgres@127.0.0.1:${pgPort}/postgres`,
      DB_SSL: 'off', DB_POOL_MAX: '1', AUTH_SECRET: randomBytes(32).toString('hex'), OWNER_CODE: owner, ACS_CONNECTION_STRING: '', RESEND_KEY: '' } });
  child.stdout.on('data', (d) => logs.push(String(d))); child.stderr.on('data', (d) => logs.push(String(d)));
  for (let i = 0; i < 200 && !logs.join('').includes('listening on'); i++) await sleep(100);
  return { base: 'http://127.0.0.1:' + port, owner, logs, stop: async () => { child.kill(); await sleep(500); try { await srv.stop(); await pg.close(); } catch (e) {} } };
}


const ROOT = join(D, 'Claude/Projects/JBBC-Iconic');
const walkAll = (d, o = []) => { for (const n of readdirSync(d)) { if (n.startsWith('.')) continue; const p = join(d, n); const s = statSync(p); if (s.isDirectory()) walkAll(p, o); else o.push(p); } return o; };
const files = walkAll(ROOT).filter((p) => statSync(p).size < 40 * 1024 * 1024).sort();
const runs = [];
for (const kind of KINDS) {
  backend = kind;
  console.log('\n=== ' + kind + ' === ' + files.length + ' files');
  const work = mkdtempSync(join(tmpdir(), 'aetraa-p1b-'));
  const srv = await boot(kind, work);
  try {
    const owner = client(srv.base);
    await owner.post('/api/login', { code: srv.owner });
    const { seedDemo } = await import(pathToFileURL(join(APP_SRC, 'tools', 'demo-seed.mjs')).href);
    const seeded = await seedDemo(client(srv.base), () => {}, srv.owner);
    const PID = seeded.PID;
    await owner.post('/api/login', { code: srv.owner });
    await owner.post('/api/project', { action: 'identity', id: PID, plot_numbers: '4210529', programme_ids: 'J179' });
    const bt = await owner.post('/api/intake/batch', { project_id: PID, scope: 'full' });
    const BID = bt.id || bt.batch_id;
    let splits = 0, errs = 0;
    for (const p of files) {
      const rel = p.slice(ROOT.length + 1);
      const s = await owner.post('/api/intake/scan', { project_id: PID, batch_id: BID, filename: basename(p), path: rel, data: readFileSync(p).toString('base64') });
      if (s.split) splits++;
      if (s.error) { errs++; console.log('  scan error', rel, s.error); }
    }
    const batch = await owner.get('/api/intake/batch?id=' + encodeURIComponent(BID));
    const items = batch.items || [];
    const c = batch.counts || {};
    console.log('  counts', JSON.stringify(c));
    const byFam = {}; items.forEach((i) => { const k = i.family + '/' + i.group; byFam[k] = (byFam[k] || 0) + 1; });
    console.log('  by family/group', JSON.stringify(byFam));
    ok('combined sets split (' + splits + ')', splits >= 25, splits);
    ok('no scan errors', errs === 0, errs);
    ok('nothing parked (all Al Warqa\'a)', (c.held || 0) === 0, c.held);
    ok('duplicates archived', (c.archived || 0) > 100, c.archived);
    ok('A4 reports filed as documents', items.some((i) => /SOIL REPORT/.test(i.filename) && i.family === 'report'), '');
    const noNum = items.filter((i) => i.needs_number);
    console.log('  sheets needing a number: ' + noNum.length + '  e.g. ' + noNum.slice(0, 6).map((i) => i.filename).join(' | '));
    const cm = { filed: 0, archived: 0, failed: [] };
    const ids = items.map((i) => i.id);
    for (let i = 0; i < ids.length; i += 10) {
      const r = await owner.post('/api/intake/commit', { project_id: PID, batch_id: BID, ids: ids.slice(i, i + 10) });
      for (const x of r.results || []) { if (x.archived) cm.archived++; else if (x.ok && x.state === 'filed') cm.filed++; else if (!x.ok) cm.failed.push(x.error); }
    }
    const fails = {}; cm.failed.forEach((e) => fails[e] = (fails[e] || 0) + 1);
    console.log('  commit: filed ' + cm.filed + ', archived ' + cm.archived + ', not filed ' + JSON.stringify(fails));
    const reg = await owner.get('/api/drawings?p=' + PID + '&project=' + PID);
    const list = reg.drawings || reg.items || [];
    const nums = list.map((d) => d.number);
    const junk = nums.filter((n) => /:|^A\d$|\s/.test(n));
    console.log('  register: ' + list.length + ' sheets, ' + new Set(nums).size + ' distinct numbers; junk numbers: ' + JSON.stringify(junk.slice(0, 10)));
    ok('no junk numbers in the register (scale, paper size, title)', junk.length === 0, JSON.stringify(junk.slice(0, 10)));
    const nk = {}; list.forEach((d) => { const k = d.number + ' ' + d.kind; (nk[k] = nk[k] || []).push(d.revision || '-'); });
    const rep = Object.entries(nk).filter(([k, v]) => v.length > 1);
    console.log('  same number+stage more than once: ' + rep.length + '  e.g. ' + rep.slice(0, 8).map(([k, v]) => k + '×' + v.length + '(' + v.join(',') + ')').join('  '));
    const badT = list.filter((d) => !d.title || /\d{10,}| sheet \d+$/i.test(d.title));
    console.log('  titles from the file name or missing: ' + badT.length + '  e.g. ' + badT.slice(0, 5).map((d) => d.number + ' "' + d.title + '"').join(' | '));
    console.log('  sample titles: ' + list.filter((_, i) => i % 40 === 0).map((d) => d.number + ' ' + (d.revision || '-') + ' "' + d.title + '"').join(' | '));
    ok('titles come from the title block (fewer than 8% from file names)', badT.length < list.length * 0.08, badT.length + ' of ' + list.length);
    const kinds = {}; list.forEach((d) => kinds[d.kind] = (kinds[d.kind] || 0) + 1); console.log('  by stage ' + JSON.stringify(kinds));
    console.log('  unidentified: ' + items.filter((i) => i.group === 'unidentified').map((i) => i.path).slice(0, 20).join(' | '));
    runs.push(JSON.stringify(c));
  } catch (e) { ok('run completed', false, e && e.stack); }
  finally { await srv.stop(); }
}
if (runs.length > 1) ok('same counts on both databases (deterministic)', runs.every((r) => r === runs[0]), runs.join(' vs '));
console.log(`\n${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
