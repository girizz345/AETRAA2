// The launch features once more on PostgreSQL (PGlite, in memory) through the
// platform's own adapter: accounts with passwords, guess counting, My files and
// the integrations door. Their atomic counters (ON CONFLICT … RETURNING,
// UPDATE … RETURNING) and upserts must hold on the live database too.
//   node tools/test-pg-launch.mjs        (needs ../../prelaunch's node_modules for PGlite)
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { makePostgres } from '../src/db-postgres.js';

const req = createRequire(new URL('../../../prelaunch/package.json', import.meta.url));
const { PGlite } = await import(pathToFileURL(req.resolve('@electric-sql/pglite')).href);
const pg = await PGlite.create();
const mail = [];
const env = { DB: makePostgres(pg), OWNER_CODE: 'MASTERCODE-0123456789', AUTH_SECRET: 'x'.repeat(40),
  RESEND_KEY: 'test', REPORT_FROM: 'AETRAA <no-reply@aetraa.test>', PASSWORD_ITERATIONS: '1000' };
await env.DB.exec(readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));
const q = async (sql, args = []) => (await pg.query(sql, args)).rows;

// Email goes nowhere; its subject carries the code.
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  if (String(url).includes('api.resend.com')) { mail.push(JSON.parse(init.body)); return new Response('{"id":"m"}', { status: 200 }); }
  return realFetch(url, init);
};
const lastCode = () => { const m = mail[mail.length - 1]; const x = m && /(\d{6}) —/.exec(m.subject); return x && x[1]; };

let fails = 0, checks = 0;
const check = (n, c, d) => { checks++; console.log((c ? '  ok   ' : '  FAIL ') + n + (d !== undefined && !c ? '  — ' + String(typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 300) : '')); if (!c) fails++; };
const worker = (await import('../src/index.js')).default;
const jar = new Map();
async function call(path, body, opts = {}) {
  const headers = { ...(opts.headers || {}) };
  const cookie = [...jar].map(([k, v]) => k + '=' + v).join('; ');
  if (cookie && !opts.noCookie) headers.Cookie = cookie;
  if (body && !opts.raw) headers['Content-Type'] = 'application/json';
  const res = await worker.fetch(new Request('http://localhost' + path, { method: body ? 'POST' : 'GET', headers,
    body: body ? (opts.raw ? body : JSON.stringify(body)) : undefined }), env, { waitUntil() {} });
  for (const sc of res.headers.getSetCookie()) {
    const [kv] = sc.split(';'); const i = kv.indexOf('='); const k = kv.slice(0, i).trim(), v = kv.slice(i + 1);
    if (!v || /Max-Age=0/i.test(sc)) jar.delete(k); else jar.set(k, v);
  }
  const text = await res.text(); let json = null; try { json = JSON.parse(text); } catch (e) {}
  return { status: res.status, text, json, headers: res.headers };
}
const out = async () => { await call('/api/logout'); jar.clear(); };
const enc = (s) => new TextEncoder().encode(s);

console.log('— accounts on PostgreSQL —');
let r = await call('/api/signup', { name: 'Lina Aziz', company: 'Aziz Build', email: 'lina@aziz.test', password: 'tall crane at dawn' });
check('sign up makes an account and signs in', r.status === 200 && r.json.ok, r.text);
const lina = (await q("SELECT * FROM users WHERE email = 'lina@aziz.test'"))[0];
check('the company is active, no approval', (await q('SELECT status, plan FROM orgs WHERE id = $1', [lina.org_id]))[0].status === 'active');
r = await call('/api/signup', { name: 'Lina Two', email: 'lina@aziz.test', password: 'another long phrase' });
check('the same email twice is refused', r.status === 409, r.text);
r = await call('/api/self/project', { name: 'Aziz Plaza', ref: 'AP-1' });
check('a self-serve project', r.status === 200 && r.json.id, r.text);
const pid = r.json.id;
await out();
r = await call('/api/login/password', { email: 'LINA@aziz.test', password: 'tall crane at dawn' });
check('password log-in', r.status === 200 && r.json.project === pid, r.text);
r = await call('/api/account');
check('the account reads back', r.status === 200 && r.json.company === 'Aziz Build' && r.json.has_password, r.text);

console.log('\n— counting guesses (ON CONFLICT … RETURNING) —');
await out();
const burst = [];
for (let i = 0; i < 14; i++) burst.push(call('/api/login/password', { email: 'lina@aziz.test', password: 'guess ' + i + ' of many' }));
const res = await Promise.all(burst);
check('14 parallel wrong passwords: at most 10 are even checked', res.filter((x) => x.status === 429).length >= 4, res.map((x) => x.status));
check('the count is exact', Number((await q("SELECT n FROM auth_throttle WHERE k LIKE 'login:email:%'"))[0].n) === 14, await q('SELECT * FROM auth_throttle'));
await q('DELETE FROM auth_throttle');

console.log('\n— an emailed code under a burst (UPDATE … RETURNING) —');
r = await call('/api/signin/start', { email: 'lina@aziz.test' });
const code = lastCode();
check('a code is emailed', r.status === 200 && /^\d{6}$/.test(code || ''), mail[mail.length - 1]);
const wrong = String((Number(code) + 1) % 1000000).padStart(6, '0');
const b2 = [];
for (let i = 0; i < 20; i++) b2.push(call('/api/signin/code', { email: 'lina@aziz.test', code: wrong }, { noCookie: true }));
await Promise.all(b2);
r = await call('/api/signin/code', { email: 'lina@aziz.test', code });
const tries = Number((await q('SELECT MAX(tries) AS t FROM sign_in_codes WHERE user_id = $1', [lina.id]))[0].t);
check('20 parallel guesses use at most the five tries', tries <= 5, tries);
check('and then even the right code is spent', r.status === 401, r.text);

console.log('\n— password reset —');
await q('DELETE FROM auth_throttle');
await call('/api/password/reset/start', { email: 'lina@aziz.test' });
r = await call('/api/password/reset/complete', { email: 'lina@aziz.test', code: lastCode(), password: 'quiet site at night' });
check('reset with the emailed code', r.status === 200 && r.json.ok, r.text);

console.log('\n— My files on PostgreSQL —');
const up = (folder, name, bytes) => call('/api/myfiles/upload?folder=' + encodeURIComponent(folder) + '&name=' + encodeURIComponent(name), bytes,
  { raw: true, headers: { 'Content-Type': 'application/octet-stream', 'Content-Length': String(bytes.length) } });
r = await up('/Drawings', 'L1.pdf', enc('%PDF-1.4 level one'));
check('a file uploads', r.status === 200 && r.json.ok, r.text);
const fid = r.json.id;
r = await up('/Drawings', 'L1.pdf', enc('%PDF-1.4 level one, rev B'));
check('the same name replaces it (one row)', r.status === 200 && Number((await q('SELECT COUNT(*) AS n FROM user_files WHERE user_id = $1', [lina.id]))[0].n) === 1, r.text);
r = await call('/api/myfiles?folder=' + encodeURIComponent('/Drawings'));
check('it lists, with its usage', r.status === 200 && r.json.files.length === 1 && r.json.usage.files === 1, r.text);
r = await call('/api/myfiles/rename', { id: r.json.files[0].id, name: 'Level 1.pdf' });
check('rename', r.status === 200, r.text);
r = await call('/api/myfiles/search?q=level');
check('search', r.status === 200 && r.json.files.length === 1, r.text);
const id1 = r.json.files[0].id;
r = await call('/api/myfiles/move', { id: id1, folder: '/Archive' });
check('move', r.status === 200, r.text);
r = await call('/api/myfiles/file?id=' + id1);
check('it opens', r.status === 200 && r.text.includes('rev B'));
r = await call('/api/myfiles/delete', { id: id1 });
check('delete', r.status === 200 && Number((await q('SELECT COUNT(*) AS n FROM user_files'))[0].n) === 0, r.text);
void fid;

console.log('\n— the integrations door on PostgreSQL —');
r = await call('/api/integrations/keys', { name: 'Revit add-in', scopes: ['read', 'write'] });
check('a key is made', r.status === 200 && /^aet_/.test(r.json.key || ''), r.text);
const KEY = r.json.key;
const v1 = (path, body) => call(path, body, { noCookie: true, headers: { Authorization: 'Bearer ' + KEY } });
r = await v1('/api/v1/projects');
check('the key lists the projects', r.status === 200 && r.json.projects[0].id === pid, r.text);
r = await v1('/api/v1/projects/' + pid + '/inbox', { source: 'revit', kind: 'quantities', title: 'L1 slabs', external_id: 'L1-slab', data: { m3: 120 } });
check('an item arrives', r.status === 201, r.text);
const item = r.json.id;
r = await v1('/api/v1/projects/' + pid + '/inbox', { source: 'revit', kind: 'quantities', title: 'L1 slabs (B)', external_id: 'L1-slab', data: { m3: 124 } });
check('the same external_id updates it', r.status === 200 && r.json.id === item && Number((await q('SELECT COUNT(*) AS n FROM integration_inbox'))[0].n) === 1, r.text);
r = await call('/api/v1/inbox/' + item + '/file?name=L1.ifc', enc('ISO-10303-21;'), { noCookie: true, raw: true,
  headers: { Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/octet-stream', 'Content-Length': '13' } });
check('a file goes with it', r.status === 200, r.text);
r = await call('/api/integrations?project=' + pid);
check('the team sees it', r.status === 200 && r.json.inbox.length === 1 && r.json.inbox[0].title === 'L1 slabs (B)', r.text);
r = await call('/api/integrations/item/status', { id: item, status: 'reviewed' });
check('and marks it reviewed', r.status === 200, r.text);

console.log('\n' + checks + ' checks, ' + fails + ' failures (PostgreSQL)');
process.exit(fails ? 1 : 0);
