// The AETRAA Assistant's checks (tools/_assistant-cases.mjs) once more on
// PostgreSQL (PGlite, in memory) through the platform's own adapter — the live
// server runs on PostgreSQL.
//   node tools/test-pg-assistant.mjs     (needs ../../prelaunch's node_modules for PGlite)
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { makePostgres } from '../src/db-postgres.js';
import { run } from './_assistant-cases.mjs';

const req = createRequire(new URL('../../../prelaunch/package.json', import.meta.url));
const { PGlite } = await import(pathToFileURL(req.resolve('@electric-sql/pglite')).href);
const pg = await PGlite.create();
const env = { DB: makePostgres(pg), OWNER_CODE: 'MASTERCODE-0123456789', LOGIN_TEST_CODE: '246810', AUTH_SECRET: 'x'.repeat(40) };
await env.DB.exec(readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));

let fails = 0, checks = 0;
const check = (n, c, d) => { checks++; console.log((c ? '  ok   ' : '  FAIL ') + n + (d !== undefined && !c ? '  — ' + String(typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 300) : '')); if (!c) fails++; };
const worker = (await import('../src/index.js')).default;
let cookie = '';
async function call(path, body) {
  const headers = {}; if (cookie) headers.Cookie = cookie; if (body) headers['Content-Type'] = 'application/json';
  const res = await worker.fetch(new Request('http://localhost' + path, { method: body ? 'POST' : 'GET', headers, body: body ? JSON.stringify(body) : undefined }), env, { waitUntil() {} });
  const sc = res.headers.get('set-cookie'); if (sc) cookie = sc.split(',').map((x) => x.split(';')[0].trim()).join('; ');
  const text = new TextDecoder().decode(new Uint8Array(await res.arrayBuffer()));
  let json = null; try { json = JSON.parse(text); } catch (e) {}
  return { status: res.status, text, json };
}
const admin = async () => { cookie = ''; await call('/api/login', { code: env.OWNER_CODE }); };
const as = async (email) => { cookie = ''; return (await call('/api/signin/code', { email, code: '246810' })).json?.ok; };
// The same SQL the cases write (with ? placeholders), through the adapter.
const sql = async (q, args = []) => ((await env.DB.prepare(q).bind(...args).all()).results) || [];
async function onboard(name, ref, people = []) {
  await admin();
  const slug = name.toLowerCase().replace(/[^a-z]+/g, '');
  const r = await call('/api/setup/onboard', { company: { name: name + ' LLC' }, project: { name, ref }, principal: { name: name + ' Principal', email: 'principal@' + slug + '.test' } });
  const pid = r.json && r.json.project_id;
  const oid = (await sql('SELECT org_id FROM projects WHERE id = ?', [pid]))[0].org_id;
  await sql("UPDATE projects SET setup_state = 'live' WHERE id = ?", [pid]);
  for (const [n, e, f] of people) await call('/api/person', { org: oid, name: n, email: e, functions: f, projects: [pid] });
  return { pid, oid };
}

await run({ env, call, admin, as, onboard, sql, check });
console.log('\n' + checks + ' checks, ' + fails + ' failures');
process.exit(fails ? 1 : 0);
