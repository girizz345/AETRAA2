// P1 step 2a, the project check, through the real intake API.
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

for (const f of [OWN_DIR, ...OTHER_DIRS, OWN_XER, OTHER_XER]) if (!existsSync(f)) { console.error('missing test file: ' + f); process.exit(1); }
const ownDrawings = smallest(join(OWN_DIR, '01-ARCHITECTURAL', 'PDF'), 3);
// Sheets the earlier run read as drawings with text (IFC sets, -DR- numbers), not specs.
const otherDrawings = OTHER_DIRS.flatMap((d) => smallest(d, 2, /(\/IFC\/|-DR-|_DR_)/).filter((p) => !/SPEC/i.test(p)));

for (const kind of KINDS) {
  backend = kind;
  console.log('\n=== ' + kind + ' ===');
  const work = mkdtempSync(join(tmpdir(), 'aetraa-p1a-'));
  const srv = await boot(kind, work);
  try {
    const owner = client(srv.base);
    await owner.post('/api/login', { code: srv.owner });
    const { seedDemo } = await import(pathToFileURL(join(APP_SRC, 'tools', 'demo-seed.mjs')).href);
    const seeded = await seedDemo(client(srv.base), () => {}, srv.owner);
    const PID = seeded.PID;
    await owner.post('/api/login', { code: srv.owner });

    const set = await owner.post('/api/project', { action: 'identity', id: PID, plot_numbers: '4210529', programme_ids: 'J179', contract_no: '', aliases: 'ICONIC-2025-48' });
    ok('the Admin saves the project identity', set.ok, JSON.stringify(set));
    const back = await owner.get('/api/data?p=' + PID + '&project=' + PID);
    ok('…and it reads back', back.meta && back.meta.plot_numbers === '4210529' && back.meta.programme_ids === 'J179', JSON.stringify(back.meta || back).slice(0, 200));

    const bt = await owner.post('/api/intake/batch', { project_id: PID, scope: 'full' });
    const BID = bt.id || bt.batch_id;
    ok('intake batch opened', !!BID, JSON.stringify(bt).slice(0, 200));
    const scan = async (path, rel) => owner.post('/api/intake/scan', { project_id: PID, batch_id: BID,
      filename: basename(path), path: rel || basename(path), data: readFileSync(path).toString('base64') });

    const verdicts = {};
    for (const p of ownDrawings) { const s = await scan(p, 'Drawings/IFC/' + basename(p)); verdicts[basename(p)] = s; }
    for (const p of otherDrawings) { const s = await scan(p, 'Drawings/IFC/' + basename(p)); verdicts[basename(p)] = s; }
    const xs1 = await scan(OWN_XER, 'Programme/' + basename(OWN_XER));
    const xs2 = await scan(OTHER_XER, 'Programme/' + basename(OTHER_XER));

    for (const p of ownDrawings) { const v = verdicts[basename(p)]; ok('own drawing ' + basename(p) + ' matches the project', v.verdict === 'match', JSON.stringify(v).slice(0, 250)); }
    for (const p of otherDrawings) { const v = verdicts[basename(p)];
      ok('another project\'s drawing ' + basename(p) + ' is parked', v.verdict === 'conflict', JSON.stringify(v).slice(0, 250)); }
    ok('own programme J179 matches', xs1.verdict === 'match', JSON.stringify(xs1).slice(0, 250));
    ok('another project\'s programme is parked', xs2.verdict === 'conflict', JSON.stringify(xs2).slice(0, 250));

    const batch = await owner.get('/api/intake/batch?id=' + encodeURIComponent(BID));
    const items = batch.items || [];
    await owner.post('/api/intake/confirm', { batch_id: BID, decisions: items.map((i) => ({ id: i.id, decision: 'confirm' })) });
    const cm = await owner.post('/api/intake/commit', { project_id: PID, batch_id: BID, ids: items.map((i) => i.id) });
    const held = (cm.results || []).filter((r) => r.held).length;
    ok('commit parks all ' + (otherDrawings.length + 1) + ' of the other project\'s documents', held === otherDrawings.length + 1, JSON.stringify((cm.results || []).map((r) => r.held ? 'held' : (r.state || r.error))));
    const q = await owner.get('/api/quarantine?all=1');
    ok('the held queue lists them for the Admin, with the reason', (q.items || []).length >= otherDrawings.length + 1 && (q.items || []).every((i) => /cannot be attached/.test(i.reason)), JSON.stringify(q.items || []).slice(0, 300));
    ok('the Admin is warned about this tenant (3 or more parked)', (q.tenant_warnings || []).length === 1 && q.tenant_warnings[0].held >= 3, JSON.stringify(q.tenant_warnings));

    const PM = client(srv.base);
    await PM.post('/api/login', { code: seeded.CODES['pm@demo.aetraa.ae'] });
    const dec = await PM.post('/api/quarantine/decide', { id: (q.items || [])[0] && q.items[0].id, action: 'approve' });
    ok('the tenant\'s PM cannot release a parked document', dec._status === 403, JSON.stringify(dec));
  } catch (e) {
    ok('run completed', false, e && e.stack);
  } finally {
    await srv.stop();
  }
}
console.log(`\n${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
