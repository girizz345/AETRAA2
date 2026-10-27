// Shared set-up for the tests in this folder: an in-memory SQLite database
// with the real schema, the real router called through worker.fetch, and the
// sign-in helpers. Each test imports what it needs:
//
//   import { db, env, call, admin, as, check, done, onboard } from './_harness.mjs';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';

let fails = 0, checks = 0;
export const check = (n, c, d) => {
  checks++;
  console.log((c ? '  ok   ' : '  FAIL ') + n + (d !== undefined && !c ? '  — ' + String(typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 300) : ''));
  if (!c) fails++;
};
export const done = () => { console.log('\n' + checks + ' checks, ' + fails + ' failures'); process.exit(fails ? 1 : 0); };

export const db = new DatabaseSync(':memory:');
db.exec(readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));
function stmt(sql) {
  const st = db.prepare(sql); let args = [];
  const api = {
    bind(...a) { args = a; return api; },
    async all() { return { results: st.all(...args), success: true }; },
    async first(col) { const r = st.get(...args) ?? null; return col && r ? r[col] : r; },
    async run() { const r = st.run(...args); return { success: true, meta: { changes: r.changes } }; },
  };
  return api;
}
export const mail = [];
export const env = {
  DB: { prepare: stmt, async batch(l) { for (const s of l) await s.run(); return []; }, async exec(s) { db.exec(s); } },
  OWNER_CODE: 'MASTERCODE-0123456789', LOGIN_TEST_CODE: '246810', AUTH_SECRET: 'x'.repeat(40),
  PLATFORM_EMAILS: 'admin@aetraa.test',
  RESEND_KEY: 'test-key', REPORT_FROM: 'AETRAA <no-reply@aetraa.test>',
};
// Mail the platform sends (through Resend) is captured here, never sent.
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  if (String(url).startsWith('https://api.resend.com/')) {
    try { mail.push(JSON.parse(init.body)); } catch (e) { mail.push({ raw: init && init.body }); }
    return new Response(JSON.stringify({ id: 'test-' + mail.length }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
  return realFetch(url, init);
};
const worker = (await import('../src/index.js')).default;
let cookie = '';
// Cookies kept the way a browser keeps them: a response's cookies are merged in
// by name, and one sent empty or with Max-Age=0 is dropped. (Replacing the whole
// jar lost the session whenever a response set only the project cookie.)
function keepCookies(res) {
  const set = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie()
    : (res.headers.get('set-cookie') || '').split(/,(?=\s*\w+=)/).filter(Boolean);
  if (!set.length) return;
  const jar = new Map(cookie ? cookie.split('; ').map((kv) => [kv.slice(0, kv.indexOf('=')), kv.slice(kv.indexOf('=') + 1)]) : []);
  for (const c of set) {
    const [kv, ...attrs] = c.split(';');
    const i = kv.indexOf('='), name = kv.slice(0, i).trim(), value = kv.slice(i + 1).trim();
    if (!value || attrs.some((a) => /^\s*max-age\s*=\s*0\s*$/i.test(a))) jar.delete(name); else jar.set(name, value);
  }
  cookie = [...jar].map(([k, v]) => k + '=' + v).join('; ');
}
export async function call(path, body, method) {
  const headers = {};
  if (cookie) headers.Cookie = cookie;
  if (body) headers['Content-Type'] = 'application/json';
  const res = await worker.fetch(new Request('http://localhost' + path,
    { method: method || (body ? 'POST' : 'GET'), headers, body: body ? JSON.stringify(body) : undefined }), env, { waitUntil() {} });
  keepCookies(res);
  const buf = new Uint8Array(await res.arrayBuffer());
  const text = new TextDecoder().decode(buf);
  let json = null; try { json = JSON.parse(text); } catch (e) {}
  return { status: res.status, text, json, bytes: buf, headers: res.headers };
}
// Raw bytes as the body (a file upload), with the same session as call().
export async function callRaw(path, bytes, headers = {}) {
  const h = { 'Content-Type': 'application/octet-stream', 'Content-Length': String(bytes.length), ...headers };
  if (cookie) h.Cookie = cookie;
  const res = await worker.fetch(new Request('http://localhost' + path, { method: 'POST', headers: h, body: bytes }), env, { waitUntil() {} });
  const buf = new Uint8Array(await res.arrayBuffer());
  const text = new TextDecoder().decode(buf);
  let json = null; try { json = JSON.parse(text); } catch (e) {}
  return { status: res.status, text, json, bytes: buf, headers: res.headers };
}
export const admin = async () => { cookie = ''; await call('/api/login', { code: env.OWNER_CODE }); };
export const as = async (email) => { cookie = ''; return (await call('/api/signin/code', { email, code: '246810' })).json?.ok; };

// Spec §25: switch bulk drawing loading on for a project (as AETRAA does on Modules).
export async function bulkOn(pid) {
  const row = db.prepare('SELECT modules FROM projects WHERE id = ?').get(pid);
  let on = []; try { const j = JSON.parse(row.modules || 'null'); on = Array.isArray(j) ? j : (j && j.on) || []; } catch (e) { on = []; }
  if (!on.includes('bulkload')) on.push('bulkload');
  db.prepare('UPDATE projects SET modules = ? WHERE id = ?').run(JSON.stringify({ v: 3, on }), pid);
}

// A company with one live project and the people given; returns ids.
export async function onboard(name, ref, people = []) {
  await admin();
  const slug = name.toLowerCase().replace(/[^a-z]+/g, '');
  const r = await call('/api/setup/onboard', { company: { name: name + ' LLC' },
    project: { name, ref }, principal: { name: name + ' Principal', email: 'principal@' + slug + '.test' } });
  const pid = r.json && r.json.project_id;
  const oid = pid ? db.prepare('SELECT org_id FROM projects WHERE id = ?').get(pid).org_id : null;
  // Draft projects take no sign-ins; go-live is not what these tests are about.
  if (pid) db.prepare("UPDATE projects SET setup_state = 'live' WHERE id = ?").run(pid);
  for (const [n, e, f] of people) await call('/api/person', { org: oid, name: n, email: e, functions: f, projects: [pid] });
  return { pid, oid };
}

// The text of every part of an .xlsx (the writer stores it uncompressed).
export function xlsxText(bytes) { return new TextDecoder('utf-8').decode(bytes); }
