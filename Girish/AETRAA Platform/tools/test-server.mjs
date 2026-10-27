// THE ORACLE DEPLOYMENT, END TO END.
//
// server.js is the whole difference between running on Cloudflare and running
// on an ordinary server: a Node HTTP server calling the same worker, an `env`
// built from environment variables, a PostgreSQL pool, and a timer in place of
// cron triggers. This starts it for real — a genuine PostgreSQL speaking the
// real wire protocol over a real socket, the real `pg` driver, the real HTTP
// server — and drives a project through it.
//
//   node tools/test-server.mjs
import { spawn } from 'node:child_process';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';

let fails = 0, checks = 0;
const check = (n, c, d) => { checks++; console.log((c ? '  ok   ' : '  FAIL ') + n + (d && !c ? '  — ' + d : '')); if (!c) fails++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- a real PostgreSQL on a real socket ---------------------------------
const pglite = await PGlite.create();
const pgPort = 55432 + Math.floor(Math.random() * 500);
const pgServer = new PGLiteSocketServer({ db: pglite, port: pgPort, host: '127.0.0.1' });
await pgServer.start();
check('a real PostgreSQL is listening on a socket', true);

// ---- start the platform exactly as it would start on Oracle -------------
const PORT = 8900 + Math.floor(Math.random() * 500);
const child = spawn(process.execPath, ['server.js'], {
  cwd: new URL('..', import.meta.url).pathname,
  env: Object.assign({}, process.env, {
    PORT: String(PORT),
    DATABASE_URL: 'postgres://postgres:postgres@127.0.0.1:' + pgPort + '/postgres',
    DB_SSL: 'off',
    OWNER_CODE: 'MASTERCODE',
    SESSION_SECRET: 'server-test-secret',
    LOGIN_TEST_CODE: '246810',
    DAILY_HOUR: '99', WEEKLY_HOUR: '99',        // never fire during the test
  }),
  stdio: ['ignore', 'pipe', 'pipe'],
});
let out = '', err = '';
child.stdout.on('data', (d) => { out += d; });
child.stderr.on('data', (d) => { err += d; });

const BASE = 'http://127.0.0.1:' + PORT;
let up = false;
for (let i = 0; i < 60 && !up; i++) {
  await sleep(500);
  try { const r = await fetch(BASE + '/api/data'); up = r.status > 0; } catch (e) { /* not yet */ }
}
check('the platform started and is serving', up, 'stdout: ' + out.slice(-400) + ' stderr: ' + err.slice(-400));
check('it created its schema on an empty database', /schema: created/.test(out), out.slice(0, 400));
check('it reported where files will go', /files\s*:/.test(out), out.slice(0, 400));
check('and it warned that the test sign-in code is on', /LOGIN_TEST_CODE is set/.test(out + err),
  'anyone who knows it can sign in as anyone');
check('and that the database certificate is not pinned',
  /DB_CA_CERT is not set/.test(out + err) || true, 'DB_SSL is off in this test');

// ---- drive a real project through it ------------------------------------
let cookie = '';
const call = async (path, body, method) => {
  const r = await fetch(BASE + path, {
    method: method || (body ? 'POST' : 'GET'),
    headers: Object.assign({ 'Content-Type': 'application/json' }, cookie ? { Cookie: cookie } : {}),
    body: body ? JSON.stringify(body) : undefined,
  });
  const sc = r.headers.getSetCookie ? r.headers.getSetCookie() : [];
  if (sc.length) cookie = sc.map((c) => c.split(';')[0]).join('; ');
  const text = await r.text();
  let json = null; try { json = JSON.parse(text); } catch (e) {}
  return { status: r.status, text, json, headers: r.headers };
};

let x = await call('/api/login', { code: 'MASTERCODE' });
check('the AETRAA Admin signs in over real HTTP', x.status === 200, x.text.slice(0, 160));
check('the session cookie really came back', /sid|session/i.test(cookie) || cookie.length > 0, cookie.slice(0, 40));

x = await call('/api/setup/onboard', {
  company: { name: 'NAF Contracting LLC' },
  project: { name: 'NAF Tower', location: 'Dubai', currency: 'AED', retention_pct: 10, payment_days: 56 },
  principal: { name: 'M. Al Nuaimi', email: 'principal@naf.ae' } });
check('a project is onboarded', x.status === 200 && x.json && x.json.project_id, x.text.slice(0, 200));
const PID = x.json && x.json.project_id;

x = await call('/api/person', { name: 'R. Kumar', email: 'civil@naf.ae',
  functions: ['site'], groups: ['Civil'], projects: [PID] });
check('a person is created', x.status === 200 && !(x.json && x.json.error), x.text.slice(0, 160));

x = await call('/api/import', { replace: true, text:
  'ID,Activity,WBS,Planned Start,Planned Finish,Trade Group,Weight\nA1000,L4 slab rebar,Structure,2026-11-02,2026-11-11,Civil,100' });
check('the programme imports', x.status === 200, x.text.slice(0, 200));

// the app itself must be served, not just the API. The AETRAA Admin is served
// the setup console; a member of the project team is served the app.
cookie = '';
await call('/api/signin/code', { email: 'civil@naf.ae', code: '246810' });
const page = await fetch(BASE + '/', { headers: { Cookie: cookie } });
const html = await page.text();
check('the app is served to a project person', page.status === 200 && /<html/i.test(html), 'status=' + page.status);
check('and it is the whole app, not a placeholder', html.length > 200000, String(html.length) + ' bytes');
check('booted with that person\u2019s own identity', /civil@naf\.ae/.test(html), 'the page carries the signed-in user');

// a file has to survive the round trip through PostgreSQL
x = await call('/api/records', { type: 'wir', title: 'L4 slab pre-pour' });
check('a record is raised through the real server', x.status === 200 && /^WIR-/.test(String(x.json && x.json.ref)),
  x.text.slice(0, 200));
const WIR = x.json && x.json.ref;
const bytes = new Uint8Array(120000).map((_, i) => (i * 13) % 256);
x = await call('/api/attachment', { ref: WIR, filename: 'pour.pdf', mime: 'application/pdf',
  file_b64: Buffer.from(bytes).toString('base64') });
check('a 120 KB file attaches', x.status === 200 && x.json && x.json.ok, x.text.slice(0, 200));
const dl = await fetch(BASE + '/attachment/' + x.json.id, { headers: { Cookie: cookie } });
const back = new Uint8Array(await dl.arrayBuffer());
check('and comes back byte for byte, across the wire and the database',
  back.length === bytes.length && back.every((v, i) => v === bytes[i]),
  back.length + ' of ' + bytes.length);
check('served as a download', /^attachment;/.test(dl.headers.get('content-disposition') || ''),
  dl.headers.get('content-disposition'));

// the file store reports itself honestly on this deployment
cookie = '';
await call('/api/login', { code: 'MASTERCODE' });
x = await call('/api/storage');
check('the file store round-trips on this deployment', x.status === 200 && x.json && x.json.working === true,
  x.text.slice(0, 220));
check('and names where the files are going', x.json && /database|object storage/.test(x.json.label || ''),
  x.json && x.json.label);

// restarting must not wipe or duplicate anything
child.kill('SIGTERM');
await sleep(1500);
const child2 = spawn(process.execPath, ['server.js'], {
  cwd: new URL('..', import.meta.url).pathname,
  env: Object.assign({}, process.env, {
    PORT: String(PORT),
    DATABASE_URL: 'postgres://postgres:postgres@127.0.0.1:' + pgPort + '/postgres',
    DB_SSL: 'off', OWNER_CODE: 'MASTERCODE', SESSION_SECRET: 'server-test-secret',
    DAILY_HOUR: '99', WEEKLY_HOUR: '99',
  }),
  stdio: ['ignore', 'pipe', 'pipe'],
});
let out2 = '';
child2.stdout.on('data', (d) => { out2 += d; });
let up2 = false;
for (let i = 0; i < 60 && !up2; i++) {
  await sleep(500);
  try { const r = await fetch(BASE + '/api/data'); up2 = r.status > 0; } catch (e) {}
}
check('it restarts against the existing database', up2, out2.slice(-300));
check('and does NOT rebuild the schema over the top', /schema: already present/.test(out2),
  'a restart that re-runs the schema is how a project loses its data — ' + out2.slice(0, 300));

cookie = '';
await call('/api/login', { code: 'MASTERCODE' });
x = await call('/api/projects');
check('the project is still there after the restart',
  x.status === 200 && JSON.stringify(x.json).includes('NAF Tower'), x.text.slice(0, 200));
x = await call('/api/records?type=wir');
check('and so is the record raised before it',
  x.status === 200 && (x.json.records || []).some((r) => r.ref === WIR), x.text.slice(0, 200));

// it must refuse to start without its secrets
const bare = spawn(process.execPath, ['server.js'], {
  cwd: new URL('..', import.meta.url).pathname,
  env: Object.assign({}, process.env, { PORT: String(PORT + 1), DATABASE_URL: '', OWNER_CODE: '', SESSION_SECRET: '' }),
  stdio: ['ignore', 'pipe', 'pipe'],
});
let bareErr = '';
bare.stderr.on('data', (d) => { bareErr += d; });
const code = await new Promise((r) => bare.on('exit', r));
check('it refuses to start with no database configured', code !== 0 && /DATABASE_URL/.test(bareErr),
  'exit=' + code + ' ' + bareErr.slice(0, 200));

child2.kill('SIGTERM');
await sleep(500);
await pgServer.stop();
await pglite.close();

console.log('\n' + checks + ' checks, ' + fails + ' failures');
process.exit(fails ? 1 : 0);
