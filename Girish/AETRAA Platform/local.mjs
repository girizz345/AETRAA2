// AETRAA ON YOUR OWN MACHINE.
//
//   node local.mjs
//
// Then open the address it prints. That is the whole setup: no database to
// install, no Docker, no configuration. Node 22 carries SQLite inside it, so
// the only thing this needs is Node itself.
//
// WHY RUN IT LOCALLY AT ALL
//
// Intake. Four hundred drawings dropped onto the hosted platform is four
// hundred uploads over a UAE office line; dropped onto this, the files never
// leave the machine they are already on. Setting up a project from a folder is
// the one job where local is plainly better, and it is the job you do most at
// the start of a project.
//
// It is also where to try things. A folder that classifies badly, a numbering
// scheme you are still working out, a contract whose terms come back wrong —
// none of that belongs on the live server in front of a client.
//
// WHAT IS AND IS NOT THE SAME AS THE SERVER
//
// The application is byte-for-byte the same: this file builds an `env` and
// calls the same worker `src/index.js` that runs in production. Only three
// things differ, and all three are consequences of being a single machine:
//
//   database   SQLite in a local file, rather than PostgreSQL
//   files      kept in that same file, rather than object storage
//   email      off unless you configure it, so nothing is sent by accident
//
// TWO THINGS TO BE CLEAR ABOUT
//
// This is a SEPARATE platform, not a window onto the live one. Projects you
// create here exist here. Nothing syncs. That is deliberate — a local tool that
// quietly wrote to the live database would be the most dangerous thing in this
// repository.
//
// It listens on 127.0.0.1 ONLY. Not on your network, not on the office wifi.
// The owner code is the master key to everything on it, and a development
// server with a master key must not be reachable from another machine.

import { createServer } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 8788);       // not 8787: never clash with a real server
const DATA = process.env.AETRAA_LOCAL_DIR || join(HERE, 'local-data');
const DB_FILE = join(DATA, 'aetraa.db');
const CONF_FILE = join(DATA, 'local.json');

if (!existsSync(DATA)) mkdirSync(DATA, { recursive: true });

/* ---------------------------------------------------------------- settings
 *
 * Generated once and kept, so the owner code does not change under you every
 * time you restart — and so nobody has to invent a secret to get started. */
let conf = {};
if (existsSync(CONF_FILE)) {
  try { conf = JSON.parse(readFileSync(CONF_FILE, 'utf8')); } catch (e) { conf = {}; }
}
let changed = false;
if (!conf.OWNER_CODE) { conf.OWNER_CODE = 'local-' + randomBytes(6).toString('hex'); changed = true; }
if (!conf.AUTH_SECRET) { conf.AUTH_SECRET = randomBytes(32).toString('hex'); changed = true; }
if (changed) writeFileSync(CONF_FILE, JSON.stringify(conf, null, 2));

/* ---------------------------------------------------------------- database
 *
 * The same adapter shape the test suite uses, so the worker cannot tell the
 * difference between this and PostgreSQL. */
const db = new DatabaseSync(DB_FILE);
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

const fresh = !existsSync(DB_FILE) || !db.prepare(
  "SELECT count(*) AS n FROM sqlite_master WHERE type='table' AND name='projects'").get().n;
db.exec(readFileSync(join(HERE, 'schema.sql'), 'utf8'));

// Columns added after the original schema. Adding one is safe to try every
// time: SQLite refuses a duplicate harmlessly.
for (const [table, col, type] of [
  ['projects', 'drawing_rules', 'TEXT'],
  ['projects', 'aliases', 'TEXT'],
  ['projects', 'intake_state', 'TEXT'],
]) {
  try { db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${type}`); } catch (e) { /* already there */ }
}

function prepare(sql) {
  let st;
  try { st = db.prepare(sql); }
  catch (e) {
    // A statement this database cannot parse must fail where it is USED, not
    // here — the worker catches those and carries on, and throwing at prepare
    // time would take the whole request down instead.
    const err = e;
    const dead = {
      bind() { return dead; },
      async all() { throw err; },
      async first() { throw err; },
      async run() { throw err; },
    };
    return dead;
  }
  let args = [];
  const api = {
    bind(...a) { args = a.map(norm); return api; },
    async all() { return { results: st.all(...args), success: true }; },
    async first(col) { const r = st.get(...args) ?? null; return col && r ? r[col] : r; },
    async run() { const r = st.run(...args); return { success: true, meta: { changes: r.changes } }; },
  };
  return api;
}

// node:sqlite takes null, number, bigint, string and Uint8Array. Anything else
// — a boolean, a Date, an object someone passed by accident — is converted
// here rather than throwing halfway through a request.
function norm(v) {
  if (v === undefined || v === null) return null;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'object' && !(v instanceof Uint8Array)) return JSON.stringify(v);
  return v;
}

const env = {
  DB: {
    prepare,
    async batch(list) { const out = []; for (const s of list) out.push(await s.run()); return out; },
    async exec(sql) { db.exec(sql); return { success: true }; },
  },
  OWNER_CODE: conf.OWNER_CODE,
  AUTH_SECRET: conf.AUTH_SECRET,
  PUBLIC_URL: 'http://127.0.0.1:' + PORT,
  DATA_REGION: 'local',
  // Email stays off unless it is deliberately configured. A local copy that
  // could send a sign-in code to a real client is a bad surprise.
  ...(process.env.ACS_CONNECTION_STRING ? { ACS_CONNECTION_STRING: process.env.ACS_CONNECTION_STRING } : {}),
  ...(process.env.REPORT_FROM ? { REPORT_FROM: process.env.REPORT_FROM } : {}),
  ...(process.env.RESEND_KEY ? { RESEND_KEY: process.env.RESEND_KEY } : {}),
  ...(process.env.ANTHROPIC_API_KEY ? { ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY } : {}),
  ...(process.env.AI_MODEL ? { AI_MODEL: process.env.AI_MODEL } : {}),
};

const worker = (await import('./src/index.js')).default;

/* ---------------------------------------------------------------- the server */
const server = createServer(async (req, res) => {
  try {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const body = chunks.length ? Buffer.concat(chunks) : undefined;
    const request = new Request('http://127.0.0.1:' + PORT + req.url, {
      method: req.method,
      headers: req.headers,
      body: (req.method === 'GET' || req.method === 'HEAD') ? undefined : body,
    });
    const out = await worker.fetch(request, env, {
      waitUntil(p) { Promise.resolve(p).catch(() => {}); }, passThroughOnException() {},
    });
    res.statusCode = out.status;
    out.headers.forEach((v, k) => {
      // Secure cookies are dropped by the browser over plain http, which would
      // make signing in silently impossible on localhost.
      if (k.toLowerCase() === 'set-cookie') res.appendHeader('set-cookie', v.replace(/;\s*Secure/ig, ''));
      else res.setHeader(k, v);
    });
    res.end(Buffer.from(await out.arrayBuffer()));
  } catch (e) {
    console.error(req.method + ' ' + req.url + ' —', (e && e.message) || e);
    if (!res.headersSent) { res.statusCode = 500; res.setHeader('Content-Type', 'application/json'); }
    res.end(JSON.stringify({ error: 'the local server could not complete that request' }));
  }
});

// 127.0.0.1 and nothing else. See the note at the top of this file.
server.listen(PORT, '127.0.0.1', () => {
  const line = '─'.repeat(58);
  console.log('\n' + line);
  console.log('  AETRAA — running on this machine only');
  console.log(line);
  console.log('  open        http://127.0.0.1:' + PORT + '/setup');
  console.log('  intake      http://127.0.0.1:' + PORT + '/intake');
  console.log('');
  console.log('  owner code  ' + conf.OWNER_CODE);
  console.log('  database    ' + DB_FILE + (fresh ? '   (new)' : ''));
  console.log('  email       ' + (env.ACS_CONNECTION_STRING || env.RESEND_KEY ? 'configured' : 'off'));
  console.log(line);
  console.log('  This is separate from your live platform. Nothing syncs.');
  console.log('  Stop it with Ctrl+C.\n');
});

for (const sig of ['SIGTERM', 'SIGINT']) {
  process.on(sig, () => {
    console.log('\nstopping — your data stays in ' + DB_FILE);
    server.close(() => { try { db.close(); } catch (e) {} process.exit(0); });
  });
}
