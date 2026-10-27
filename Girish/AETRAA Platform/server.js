// THE PLATFORM, RUNNING ON AN ORDINARY SERVER.
//
// On Cloudflare the worker's `fetch` is called by the platform. Here a plain
// Node HTTP server calls exactly the same function, with an `env` built from
// environment variables instead of bindings. The worker itself is unchanged —
// this file is the whole difference between the two deployments.
//
//   DATABASE_URL=postgres://user:pass@host:5432/aetraa \
//   AUTH_SECRET=... OWNER_CODE=... node server.js
//
// On Oracle Cloud, DATABASE_URL points at the PostgreSQL service and the
// S3_* variables point at Object Storage. Nothing else changes.

import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { makePostgres } from './src/db-postgres.js';
import worker from './src/index.js';

const PORT = Number(process.env.PORT || 8787);
const need = (k) => {
  const v = process.env[k];
  if (!v) {
    console.error('Refusing to start: ' + k + ' is not set.');
    process.exit(1);
  }
  return v;
};

/* ------------------------------------------------------------- the database */

const { Pool } = await import('pg');
const pool = new Pool({
  connectionString: need('DATABASE_URL'),
  max: Number(process.env.DB_POOL_MAX || 10),
  idleTimeoutMillis: 30000,
  // Oracle Cloud, like most managed PostgreSQL, requires TLS. The CA is
  // supplied where the provider gives one; otherwise the connection is still
  // encrypted but the certificate is not pinned, which is said plainly here
  // rather than hidden behind rejectUnauthorized:false.
  // A certificate kept on one line (as the Vault loader writes it) has its
  // line breaks as the two characters \n; put the real ones back.
  // DB_SSL=verify checks the server certificate against the public roots Node
  // already carries — right for Azure Database for PostgreSQL, whose
  // certificates chain to DigiCert / Microsoft roots, so no CA file is needed.
  ssl: process.env.DB_CA_CERT
    ? { ca: process.env.DB_CA_CERT.replace(/\\n/g, '\n'), rejectUnauthorized: true }
    : process.env.DB_SSL === 'off' ? false
    : process.env.DB_SSL === 'verify' ? { rejectUnauthorized: true }
    : { rejectUnauthorized: false },
});
pool.on('error', (e) => console.error('database pool error:', e.message));

if (process.env.DB_SSL !== 'off' && process.env.DB_SSL !== 'verify' && !process.env.DB_CA_CERT) {
  console.warn('DB_CA_CERT is not set: the database connection is encrypted but the ' +
               'server certificate is not verified. Set DB_CA_CERT before carrying real project data.');
}

// The app signs every sign-in cookie with AUTH_SECRET. It must be set, long and
// random: without it the app would fall back to a built-in development value
// that anyone could use to forge a sign-in. SESSION_SECRET is accepted as the
// same thing, because earlier notes called it that.
const authSecret = process.env.AUTH_SECRET || process.env.SESSION_SECRET;
if (!authSecret) { console.error('Refusing to start: AUTH_SECRET is not set.'); process.exit(1); }
if (authSecret.length < 32 || authSecret === 'dev-secret' || /change-me/i.test(authSecret)) {
  console.error('Refusing to start: AUTH_SECRET must be at least 32 random characters.');
  process.exit(1);
}
const ownerCode = need('OWNER_CODE');
if (ownerCode.length < 16) {
  console.error('Refusing to start: OWNER_CODE is the master key to every company — make it at least 16 random characters.');
  process.exit(1);
}

const env = {
  DB: makePostgres(pool),
  // Secrets and configuration, from the environment rather than from bindings.
  // The names on the left are the ones the app reads (the same as on Cloudflare).
  AUTH_SECRET: authSecret,
  OWNER_CODE: ownerCode,
  MANAGER_CODE: process.env.MANAGER_CODE || undefined,
  SITE_CODE: process.env.SITE_CODE || undefined,
  VIEW_CODE: process.env.VIEW_CODE || undefined,
  LOGIN_TEST_CODE: process.env.LOGIN_TEST_CODE || undefined,
  RESEND_KEY: process.env.RESEND_KEY || process.env.RESEND_API_KEY || undefined,
  REPORT_FROM: process.env.REPORT_FROM || process.env.MAIL_FROM || undefined,
  // Azure Communication Services — email inside the customer's own tenant.
  // The connection string from the portal carries both halves; the two may
  // also be set apart when a secret store prefers that.
  ACS_CONNECTION_STRING: process.env.ACS_CONNECTION_STRING || undefined,
  ACS_ENDPOINT: process.env.ACS_ENDPOINT || undefined,
  ACS_KEY: process.env.ACS_KEY || undefined,
  ACS_API_VERSION: process.env.ACS_API_VERSION || undefined,
  ACS_DISABLE_TRACKING: process.env.ACS_DISABLE_TRACKING || undefined,
  DATA_REGION: process.env.DATA_REGION || undefined,
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || undefined,
  AI_BASE_URL: process.env.AI_BASE_URL || undefined,
  AI_PROVIDER: process.env.AI_PROVIDER || undefined,
  AI_API_KEY: process.env.AI_API_KEY || undefined,
  AI_MODEL: process.env.AI_MODEL || undefined,
  // Object storage, S3-compatible — Oracle Cloud Object Storage speaks it.
  S3_ENDPOINT: process.env.S3_ENDPOINT || undefined,
  S3_BUCKET: process.env.S3_BUCKET || undefined,
  S3_REGION: process.env.S3_REGION || undefined,
  S3_ACCESS_KEY: process.env.S3_ACCESS_KEY || undefined,
  S3_SECRET_KEY: process.env.S3_SECRET_KEY || undefined,
};

const acsSet = !!(env.ACS_CONNECTION_STRING || (env.ACS_ENDPOINT && env.ACS_KEY));
if (acsSet) {
  console.log('Email: Azure Communication Services.');
  if (!env.REPORT_FROM) {
    console.warn('REPORT_FROM is not set. Azure has no shared sender, so nothing will send until ' +
                 'a sender on a connected domain is given.');
  }
} else if (env.RESEND_KEY) {
  console.log('Email: Resend.');
} else {
  console.warn('No email is configured: nothing will be sent — sign-in codes and reports included.');
}
if (env.LOGIN_TEST_CODE) {
  console.warn('LOGIN_TEST_CODE is set. Anyone who knows it can sign in as anyone. ' +
               'Unset it before real people use this.');
}

/* --------------------------------------------------------------- migrations */

// The schema is applied on start if the database is empty. An existing
// database is left exactly as it is — this never drops or alters a table.
async function ensureSchema() {
  const { rows } = await pool.query(
    `SELECT COUNT(*) AS n FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'projects'`
  );
  if (Number(rows[0].n) > 0) { console.log('schema: already present'); return; }
  const file = new URL('./schema.sql', import.meta.url).pathname;
  if (!existsSync(file)) { console.error('schema: schema.sql not found'); process.exit(1); }
  await env.DB.exec(readFileSync(file, 'utf8'));
  console.log('schema: created');
}

/* ------------------------------------------------------------ the scheduler
 *
 * On Cloudflare the cron triggers in wrangler.toml call worker.scheduled().
 * Here a timer does, checking every minute and firing on the same schedule:
 * a daily report each evening, a weekly one on Monday morning and last month's
 * on the morning of the 1st, in the
 * project's own timezone rather than the server's.
 */
const TZ_OFFSET_MIN = Number(process.env.TZ_OFFSET_MIN || 240);   // UAE is UTC+4
let lastFired = '';
function tick() {
  if (typeof worker.scheduled !== 'function') return;
  const local = new Date(Date.now() + TZ_OFFSET_MIN * 60000);
  const stamp = local.toISOString().slice(0, 13);                 // to the hour
  if (stamp === lastFired) return;
  const hour = local.getUTCHours();
  const dow = local.getUTCDay();
  const daily = hour === Number(process.env.DAILY_HOUR || 18);
  const weekly = dow === 1 && hour === Number(process.env.WEEKLY_HOUR || 7);
  const monthly = local.getUTCDate() === 1 && hour === Number(process.env.MONTHLY_HOUR || 8);
  const digest = hour === Number(process.env.DIGEST_HOUR || 6);          // each person's morning list
  if (!daily && !weekly && !monthly && !digest) return;
  lastFired = stamp;
  const cron = digest ? '0 2 * * *' : monthly ? '0 4 1 * *' : weekly ? '0 3 * * 1' : '0 14 * * *';
  console.log('scheduled: firing ' + cron + ' at local ' + local.toISOString());
  Promise.resolve(worker.scheduled({ cron, scheduledTime: Date.now() }, env, {
    waitUntil(p) { return p; }, passThroughOnException() {},
  })).catch((e) => console.error('scheduled run failed:', e && e.message));
}

/* ------------------------------------------------------------------ the HTTP */

const server = createServer(async (req, res) => {
  const started = Date.now();
  // The load balancer's health check: is this instance up AND can it reach the
  // database? Answered here, before the app, and never cached.
  if (req.url === '/healthz') {
    try {
      await pool.query('SELECT 1');
      res.writeHead(200, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' }); res.end('ok');
    } catch (e) {
      res.writeHead(503, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' }); res.end('database unreachable');
    }
    return;
  }
  try {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const body = chunks.length ? Buffer.concat(chunks) : undefined;
    // Behind a load balancer the scheme arrives in a header; the worker builds
    // absolute URLs (sign-in links) from it, so getting it wrong sends people
    // to http:// links.
    const proto = String(req.headers['x-forwarded-proto'] || '').split(',')[0] ||
                  (process.env.PUBLIC_URL || '').split(':')[0] || 'http';
    const host = req.headers.host || 'localhost:' + PORT;
    const request = new Request(proto + '://' + host + req.url, {
      method: req.method,
      headers: req.headers,
      body: (req.method === 'GET' || req.method === 'HEAD') ? undefined : body,
    });
    const out = await worker.fetch(request, env, {
      waitUntil(p) { Promise.resolve(p).catch(() => {}); }, passThroughOnException() {},
    });
    res.statusCode = out.status;
    out.headers.forEach((v, k) => {
      if (k.toLowerCase() === 'set-cookie') res.appendHeader('set-cookie', v);
      else res.setHeader(k, v);
    });
    res.end(Buffer.from(await out.arrayBuffer()));
  } catch (e) {
    console.error(req.method + ' ' + req.url + ' failed after ' + (Date.now() - started) + 'ms:', e);
    if (!res.headersSent) { res.statusCode = 500; res.setHeader('Content-Type', 'application/json'); }
    res.end(JSON.stringify({ error: 'the server could not complete that request' }));
  }
});

await ensureSchema();
server.listen(PORT, () => {
  console.log('AETRAA listening on ' + PORT);
  console.log('  database : ' + String(process.env.DATABASE_URL).replace(/:[^:@/]+@/, ':***@'));
  console.log('  files    : ' + (process.env.S3_BUCKET ? 'object storage (' + process.env.S3_BUCKET + ')' : 'the database'));
});
setInterval(tick, 60000);

// Finish what is in flight before going down, so a deploy does not cut a
// request in half.
for (const sig of ['SIGTERM', 'SIGINT']) {
  process.on(sig, () => {
    console.log(sig + ' — finishing in-flight requests');
    server.close(() => pool.end().then(() => process.exit(0)));
    setTimeout(() => process.exit(0), 10000).unref();
  });
}
