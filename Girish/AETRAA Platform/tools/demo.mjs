// THE LIVE DEMO.
//
//   node tools/demo.mjs
//
// Starts the real platform on your own machine with a whole Dubai project
// already in it — programme, BOQ, BOM, every register, a week of safety logs
// and a certified payment certificate — and prints the people you can sign in
// as. Nothing is mocked: this is the same code that deploys.
//
// The database lives in memory, so closing it throws the demo project away and
// starting it again builds a fresh one.
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { build } from 'esbuild';
import { seedDemo, TEAM } from './demo-seed.mjs';

const PORT = Number(process.env.PORT || 8788);
const quiet = process.argv.includes('--quiet');
const say = (s) => { if (!quiet) console.log(s); };

await build({
  entryPoints: [new URL('../src/index.js', import.meta.url).pathname],
  bundle: true, format: 'esm', platform: 'neutral',
  outfile: '/tmp/demo-worker.mjs', logLevel: 'silent',
});

const db = new DatabaseSync(':memory:');
db.exec(readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));
function stmt(sql) {
  const st = db.prepare(sql); let args = [];
  const api = { bind(...a) { args = a; return api; },
    async all() { return { results: st.all(...args), success: true }; },
    async first(c) { const r = st.get(...args) ?? null; return c && r ? r[c] : r; },
    async run() { st.run(...args); return { success: true, meta: {} }; },
    async raw() { return st.all(...args).map((r) => Object.values(r)); } };
  return api;
}
export const env = {
  DB: { prepare: stmt,
        async batch(l) { const o = []; for (const s of l) o.push(await s.run()); return o; },
        async exec(s) { db.exec(s); return { count: 1 }; } },
  OWNER_CODE: 'AETRAA-DEMO', LOGIN_TEST_CODE: '246810', SESSION_SECRET: 'demo-only-not-a-real-secret',
};
const worker = (await import('/tmp/demo-worker.mjs')).default;
const ctx = { waitUntil() {}, passThroughOnException() {} };

/* A tiny client so the seed goes in through the real API, not behind it. */
export function makeApi(base) {
  let cookie = '';
  const go = async (path, body, method) => {
    const req = new Request((base || 'http://demo') + path, {
      method: method || (body === undefined ? 'GET' : 'POST'),
      headers: Object.assign({ 'Content-Type': 'application/json' }, cookie ? { Cookie: cookie } : {}),
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const res = await worker.fetch(req, env, ctx);
    const sc = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
    if (sc.length) cookie = sc.map((c) => c.split(';')[0]).join('; ');
    const text = await res.text();
    try { return JSON.parse(text); } catch (e) { return { _text: text, _status: res.status }; }
  };
  return {
    get: (p) => go(p),
    post: (p, b) => go(p, b || {}),
    reset() { cookie = ''; },
    cookie: () => cookie,
    set(c) { cookie = c; },
  };
}

const api = makeApi();
say('\n  Building the demo project…');
const { PID } = await seedDemo(api, (s) => say('    · ' + s), env.OWNER_CODE);

const server = createServer(async (req, res) => {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const r = await worker.fetch(new Request('http://localhost:' + PORT + req.url, {
    method: req.method, headers: req.headers,
    body: (req.method === 'GET' || req.method === 'HEAD') ? undefined : Buffer.concat(chunks),
  }), env, ctx);
  res.statusCode = r.status;
  r.headers.forEach((v, k) => { if (k.toLowerCase() === 'set-cookie') res.appendHeader('set-cookie', v); else res.setHeader(k, v); });
  res.end(Buffer.from(await r.arrayBuffer()));
});

if (!process.argv.includes('--no-serve')) {
  server.listen(PORT, () => {
    console.log('\n  ┌──────────────────────────────────────────────────────────┐');
    console.log('  │  AETRAA — Project Management Module · DEMO                │');
    console.log('  └──────────────────────────────────────────────────────────┘\n');
    console.log('    Open:  http://localhost:' + PORT + '\n');
    console.log('    Sign in with any of these — the code is always 246810:\n');
    for (const [name, email, fns] of TEAM) {
      console.log('      ' + email.padEnd(24) + name.padEnd(16) + fns.join(' + '));
    }
    console.log('\n    AETRAA Admin (project setup): the master code is AETRAA-DEMO');
    console.log('    Project: NAF Tower — G+2P+12, Dubai Islands\n');
    console.log('    Ctrl-C to stop. The demo project is in memory and is not kept.\n');
  });
}

export { worker, ctx, PID, server };
