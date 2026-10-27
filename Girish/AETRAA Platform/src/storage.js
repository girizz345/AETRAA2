// ONE FILE STORE, THREE DRIVERS.
//
// Every file the platform keeps — drawings, consultant templates, the
// attachments on a submittal or an inspection — goes through here, by a key.
// Nothing above this file knows or cares where the bytes actually land.
//
// That is the whole point. The platform runs on Cloudflare today and moves to
// Oracle Cloud in the UAE later, and the move must not be a rewrite. The file
// records themselves stay in ordinary SQL, which carries across to PostgreSQL
// untouched; only the driver underneath changes, and it changes by
// configuration, not by code.
//
//   bucket    an R2 binding is present            — Cloudflare, today
//   s3        S3_ENDPOINT + keys are configured   — Oracle Cloud Object Storage
//             (OCI Object Storage speaks S3, as do MinIO and AWS itself)
//   database  neither is configured               — anywhere, with no setup
//
// The driver is chosen per call from the environment, so the same package
// deploys to both platforms and picks the right one on the way up.

const nowISO = () => new Date().toISOString();

// ---------------------------------------------------------------- helpers

export function bytesToB64(bytes) {
  const u8 = new Uint8Array(bytes);
  if (typeof btoa === 'function') {
    let s = '';
    // chunked, or a large file blows the argument limit
    for (let i = 0; i < u8.length; i += 0x8000) {
      s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
    }
    return btoa(s);
  }
  return Buffer.from(u8).toString('base64');
}

export function b64ToBytes(b64) {
  const clean = String(b64 || '').replace(/^data:[^,]*,/, '');
  if (typeof atob === 'function') {
    const bin = atob(clean);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  return new Uint8Array(Buffer.from(clean, 'base64'));
}

const enc = (s) => new TextEncoder().encode(s);
const hex = (buf) => Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');

async function sha256Hex(bytes) {
  return hex(await crypto.subtle.digest('SHA-256', bytes));
}
async function hmac(key, msg) {
  const k = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, enc(msg)));
}

// A key is ours to build, so it is kept to characters every store accepts and
// can never climb out of its own prefix.
export function safeKey(key) {
  return String(key || '')
    .replace(/\\/g, '/')
    .split('/')
    .filter((p) => p && p !== '.' && p !== '..')
    .map((p) => p.replace(/[^A-Za-z0-9._-]/g, '_'))
    .join('/');
}

// ---------------------------------------------------------------- which driver

export function s3Config(env) {
  const e = env || {};
  if (!e.S3_ENDPOINT || !e.S3_BUCKET || !e.S3_ACCESS_KEY || !e.S3_SECRET_KEY) return null;
  return {
    endpoint: String(e.S3_ENDPOINT).replace(/\/+$/, ''),
    bucket: String(e.S3_BUCKET),
    region: String(e.S3_REGION || 'us-east-1'),
    accessKey: String(e.S3_ACCESS_KEY),
    secretKey: String(e.S3_SECRET_KEY),
  };
}

export function hasBucket(env) {
  return !!(env && env.DRAWINGS && typeof env.DRAWINGS.put === 'function');
}

// Which driver this environment will use. Named so the setup console can say
// plainly where a project's files are going.
export function driverName(env) {
  if (s3Config(env)) return 's3';
  if (hasBucket(env)) return 'bucket';
  return 'database';
}

export const DRIVER_LABEL = {
  s3: 'object storage (S3-compatible)',
  bucket: 'object storage (R2)',
  database: 'the database',
};

// ---------------------------------------------------------------- s3 driver
// Signature Version 4, path-style. Path-style is what Oracle Cloud Object
// Storage and MinIO expect, and AWS still accepts it.

// Signing is kept separate from sending, so it can be pinned against AWS's own
// published worked example. A signature that is merely well-shaped is useless:
// the object store rejects it, the file quietly goes to the database instead,
// and nobody finds out until the database is full.
export async function sigv4({ accessKey, secretKey, region, service, method, path, headers, payloadHash, amzDate }) {
  const dateStamp = amzDate.slice(0, 8);
  const lower = {};
  for (const k of Object.keys(headers)) lower[k.toLowerCase()] = String(headers[k]).trim();

  const names = Object.keys(lower).sort();
  const canonicalHeaders = names.map((n) => n + ':' + lower[n] + '\n').join('');
  const signedHeaders = names.join(';');
  const canonicalRequest = [method, path, '', canonicalHeaders, signedHeaders, payloadHash].join('\n');

  const scope = [dateStamp, region, service, 'aws4_request'].join('/');
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, await sha256Hex(enc(canonicalRequest))].join('\n');

  let k = await hmac(enc('AWS4' + secretKey), dateStamp);
  k = await hmac(k, region);
  k = await hmac(k, service);
  k = await hmac(k, 'aws4_request');
  const signature = hex(await hmac(k, stringToSign));

  return {
    signature,
    signedHeaders,
    authorization: 'AWS4-HMAC-SHA256 Credential=' + accessKey + '/' + scope +
      ', SignedHeaders=' + signedHeaders + ', Signature=' + signature,
  };
}

async function signedFetch(cfg, method, key, body, contentType) {
  const host = cfg.endpoint.replace(/^https?:\/\//, '');
  const proto = cfg.endpoint.startsWith('http://') ? 'http://' : 'https://';
  const path = '/' + encodeURI(cfg.bucket) + '/' + encodeURI(key).replace(/\+/g, '%2B');

  const payload = body ? new Uint8Array(body) : new Uint8Array(0);
  const payloadHash = await sha256Hex(payload);
  const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');   // 20260919T080000Z

  const headers = { host, 'x-amz-content-sha256': payloadHash, 'x-amz-date': amzDate };
  if (contentType && method === 'PUT') headers['content-type'] = contentType;

  const signed = await sigv4({
    accessKey: cfg.accessKey, secretKey: cfg.secretKey, region: cfg.region, service: 's3',
    method, path, headers, payloadHash, amzDate,
  });

  headers.Authorization = signed.authorization;
  delete headers.host;                       // fetch sets Host itself

  return fetch(proto + host + path, {
    method,
    headers,
    body: method === 'PUT' ? payload : undefined,
  });
}

// ---------------------------------------------------------------- database driver

export async function ensureFilesTable(env) {
  try {
    await env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS files (
         key TEXT PRIMARY KEY, mime TEXT, size INTEGER, data TEXT, created_at TEXT)`
    ).run();
    return true;
  } catch (e) { return false; }
}

// ---------------------------------------------------------------- the API
// Three calls. Everything above this line is how, not what.

export async function putFile(env, key, bytes, contentType) {
  const k = safeKey(key);
  if (!k) return { error: 'no key' };
  const u8 = new Uint8Array(bytes || []);
  if (!u8.length) return { error: 'no file received' };
  const mime = String(contentType || 'application/octet-stream');

  const cfg = s3Config(env);
  if (cfg) {
    try {
      const r = await signedFetch(cfg, 'PUT', k, u8, mime);
      if (r.ok) return { ok: true, driver: 's3', key: k, size: u8.length };
      // fall through — a file the platform cannot store is worse than a file
      // in the wrong place, so the database keeps it rather than losing it.
    } catch (e) { /* fall through */ }
  }
  if (hasBucket(env)) {
    try {
      await env.DRAWINGS.put(k, u8, { httpMetadata: { contentType: mime } });
      return { ok: true, driver: 'bucket', key: k, size: u8.length };
    } catch (e) { /* fall through */ }
  }
  await ensureFilesTable(env);
  try {
    await env.DB.prepare(`DELETE FROM files WHERE key = ?`).bind(k).run();
    await env.DB.prepare(`INSERT INTO files (key, mime, size, data, created_at) VALUES (?,?,?,?,?)`)
      .bind(k, mime, u8.length, bytesToB64(u8), nowISO()).run();
  } catch (e) { return { error: 'could not store the file' }; }
  return { ok: true, driver: 'database', key: k, size: u8.length };
}

// Read a file back. It is looked for wherever it might be, in the order it
// would have been written, so a store that changed under a live project still
// serves what was put there before the change.
export async function getFile(env, key) {
  const k = safeKey(key);
  if (!k) return null;

  const cfg = s3Config(env);
  if (cfg) {
    try {
      const r = await signedFetch(cfg, 'GET', k, null, null);
      if (r.ok) {
        return {
          bytes: new Uint8Array(await r.arrayBuffer()),
          mime: r.headers.get('content-type') || 'application/octet-stream',
          driver: 's3',
        };
      }
    } catch (e) { /* look elsewhere */ }
  }
  if (hasBucket(env)) {
    try {
      const obj = await env.DRAWINGS.get(k);
      if (obj) {
        return {
          bytes: new Uint8Array(await obj.arrayBuffer()),
          mime: (obj.httpMetadata && obj.httpMetadata.contentType) || 'application/octet-stream',
          driver: 'bucket',
        };
      }
    } catch (e) { /* look elsewhere */ }
  }
  await ensureFilesTable(env);
  try {
    const row = await env.DB.prepare(`SELECT mime, data FROM files WHERE key = ?`).bind(k).first();
    if (row && row.data) {
      return { bytes: b64ToBytes(row.data), mime: row.mime || 'application/octet-stream', driver: 'database' };
    }
  } catch (e) { /* nothing */ }
  return null;
}

// Removal is attempted everywhere, because a file that survives its record is
// the one that turns up in the wrong hands later.
export async function deleteFile(env, key) {
  const k = safeKey(key);
  if (!k) return { ok: true };
  const cfg = s3Config(env);
  if (cfg) { try { await signedFetch(cfg, 'DELETE', k, null, null); } catch (e) {} }
  if (hasBucket(env) && typeof env.DRAWINGS.delete === 'function') {
    try { await env.DRAWINGS.delete(k); } catch (e) {}
  }
  await ensureFilesTable(env);
  try { await env.DB.prepare(`DELETE FROM files WHERE key = ?`).bind(k).run(); } catch (e) {}
  return { ok: true };
}
