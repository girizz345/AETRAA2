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



// Authority-approved drawings: a DM-portal download (DCD and Telephone folders)
// and two IFC sheets, with the AI reading the stamps on Ajay's subscription.
const ROOT = join(D, 'Claude/Projects/JBBC-Iconic');
const pick = [
  '01. DM/1. 12-05-2026/DCD/smoke_layout1768323308485.pdf',
  '01. DM/1. 12-05-2026/Telephone/telephone1774261637944.pdf',
  '01. DM/1. 12-05-2026/Arch/staircase_details1770821436961.pdf',
  'Drawings/IFC Drawings/IFC Drawings /01-ARCHITECTURE/A0-01 GROUND FLOOR PLAN.pdf',
].map((r) => join(ROOT, r)).filter((p) => existsSync(p));
for (const kind of KINDS) {
  backend = kind;
  console.log('\n=== ' + kind + ' === ' + pick.length + ' files');
  const work = mkdtempSync(join(tmpdir(), 'aetraa-auth-'));
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
    for (const p of pick) await owner.post('/api/intake/scan', { project_id: PID, batch_id: BID, filename: basename(p), path: p.slice(ROOT.length + 1), data: readFileSync(p).toString('base64') });
    let b = await owner.get('/api/intake/batch?id=' + encodeURIComponent(BID));
    const auth = (b.items || []).filter((i) => i.kind === 'authority');
    const byAuth = {}; auth.forEach((i) => byAuth[i.authority] = (byAuth[i.authority] || 0) + 1);
    console.log('  from folders: ' + JSON.stringify(byAuth) + '; waiting for stamp: ' + (b.items || []).filter((i) => i.needs_stamp).length);
    ok('DM-portal sheets are proposed as authority approved, by folder', auth.length >= 10 && byAuth.DCD > 0 && byAuth['DU-ETIS'] > 0 && byAuth.DM > 0, JSON.stringify(byAuth));
    ok('the IFC sheet is not', (b.items || []).some((i) => /A0-01/.test(i.number || i.filename) && i.kind === 'ifc'), JSON.stringify((b.items || []).filter((i) => /GROUND FLOOR/.test(i.filename)).map((i) => i.kind)));
    const t0 = Date.now(); let left = 1, rounds = 0;
    while (left > 0 && rounds < 60) { const r = await owner.post('/api/intake/stamps', { batch_id: BID, limit: 3 }); if (r.error) { ok('stamps read', false, r.error); break; } left = r.remaining; rounds++; }
    // The readings are proposals: Document Control confirms each (as read) before
    // anything reaches the sheet or the register.
    b = await owner.get('/api/intake/batch?id=' + encodeURIComponent(BID));
    const pending = (b.items || []).filter((i) => i.stamp_pending);
    for (let i = 0; i < pending.length; i += 20) await owner.post('/api/intake/stamps/confirm', { batch_id: BID, items: pending.slice(i, i + 20).map((x) => ({ id: x.id, accept: true })) });
    b = await owner.get('/api/intake/batch?id=' + encodeURIComponent(BID));
    const read = (b.items || []).filter((i) => i.stamp && !i.stamp.error);
    const conf = {}; read.forEach((i) => conf[(i.stamp.approved ? 'approved ' : 'no stamp ') + i.authority + ' ' + i.stamp.confidence] = (conf[(i.stamp.approved ? 'approved ' : 'no stamp ') + i.authority + ' ' + i.stamp.confidence] || 0) + 1);
    console.log('  AI read ' + read.length + ' stamps in ' + Math.round((Date.now() - t0) / 1000) + ' s: ' + JSON.stringify(conf));
    console.log('  e.g. ' + read.slice(0, 4).map((i) => i.number + ' ' + i.authority + ' ' + i.approval_no + ' ' + i.approval_date).join(' | '));
    ok('the AI read a stamp on every authority sheet', read.length >= auth.length, read.length + ' of ' + auth.length);
    ok('approval number 455359-3-3 read from the DM stamp', read.some((i) => i.approval_no === '455359-3-3'), JSON.stringify(read.slice(0, 3).map((i) => i.approval_no)));
    const ids = (b.items || []).map((i) => i.id);
    for (let i = 0; i < ids.length; i += 10) await owner.post('/api/intake/commit', { project_id: PID, batch_id: BID, ids: ids.slice(i, i + 10) });
    const sec = await owner.get('/api/section?project=' + PID + '&p=' + PID + '&id=dwg.authority');
    console.log('  section: ' + JSON.stringify(sec).slice(0, 300));
    const reg = await owner.get('/api/drawings?p=' + PID + '&project=' + PID);
    const list = reg.drawings || [];
    ok('filed under Authority approved, with the approval number', list.some((d) => d.kind === 'authority'), JSON.stringify(list.map((d) => d.kind)));
    ok('the IFC A0-01 is still current', list.some((d) => d.kind === 'ifc' && d.status === 'current'), JSON.stringify(list.filter((d) => d.kind === 'ifc')));
    const usage = await owner.get('/api/ai/status?p=' + PID + '&project=' + PID);
    console.log('  AI usage: ' + JSON.stringify(usage).slice(0, 300));
  } catch (e) { ok('run completed', false, e && e.stack); }
  finally { await srv.stop(); }
}
console.log(`\n${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
