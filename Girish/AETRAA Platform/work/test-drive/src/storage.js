// ONE FILE STORE, FOUR DRIVERS.
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
//   azure     AZURE_STORAGE_* are configured      — Azure Blob Storage (K2), the
//             live server's store: files out of PostgreSQL (spec §12, D1)
//   bucket    an R2 binding is present            — Cloudflare, today
//   s3        S3_ENDPOINT + keys are configured   — Oracle Cloud Object Storage
//             (OCI Object Storage speaks S3, as do MinIO and AWS itself)
//   database  none is configured                  — anywhere, with no setup
//
// The driver is chosen per call from the environment, so the same package
// deploys to both platforms and picks the right one on the way up.
//
// K2 also keeps an INDEX of every stored file (stored_files: key, project,
// area, size, driver), whichever store holds it. An object store cannot be
// asked "how much does this project hold" cheaply, and a file the configured
// store refused — kept in the database instead, so nothing is lost — must be
// visible rather than quietly refilling the database (fell_back = 1).

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

// Azure Blob Storage. Either the separate settings or one connection string
// (the form the Azure portal and Azurite hand out):
//   AZURE_STORAGE_ACCOUNT, AZURE_STORAGE_CONTAINER, and
//   AZURE_STORAGE_KEY (Shared Key, signed here) or AZURE_STORAGE_SAS (a SAS token),
//   AZURE_STORAGE_ENDPOINT optional (default https://<account>.blob.core.windows.net)
//   AZURE_STORAGE_CONNECTION_STRING = AccountName=…;AccountKey=…;BlobEndpoint=…
export function azureConfig(env) {
  const e = env || {};
  const cs = {};
  for (const part of String(e.AZURE_STORAGE_CONNECTION_STRING || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) cs[part.slice(0, i).trim()] = part.slice(i + 1).trim();
  }
  const account = String(e.AZURE_STORAGE_ACCOUNT || cs.AccountName || '');
  const container = String(e.AZURE_STORAGE_CONTAINER || '');
  const key = String(e.AZURE_STORAGE_KEY || cs.AccountKey || '');
  const sas = String(e.AZURE_STORAGE_SAS || cs.SharedAccessSignature || '').replace(/^\?/, '');
  if (!account || !container || (!key && !sas)) return null;
  const endpoint = String(e.AZURE_STORAGE_ENDPOINT || cs.BlobEndpoint
    || ((cs.DefaultEndpointsProtocol || 'https') + '://' + account + '.blob.' + (cs.EndpointSuffix || 'core.windows.net'))).replace(/\/+$/, '');
  return { account, container, key, sas, endpoint };
}

// Which driver this environment will use. Named so the setup console can say
// plainly where a project's files are going.
export function driverName(env) {
  if (azureConfig(env)) return 'azure';
  if (s3Config(env)) return 's3';
  if (hasBucket(env)) return 'bucket';
  return 'database';
}

export const DRIVER_LABEL = {
  azure: 'object storage (Azure Blob)',
  s3: 'object storage (S3-compatible)',
  bucket: 'object storage (R2)',
  database: 'the database',
};

// ---------------------------------------------------------------- azure driver
// Shared Key, signed by hand (as sigv4 is for S3): the string to sign is the
// verb, the twelve standard headers (only Content-Length and Content-Type are
// ever set here), the x-ms-* headers in order, and /<account><path>. Pinned in
// tools/test-k2-storage.mjs against a signature the official Azure SDK
// produced for the same request, because a signature that is merely
// well-shaped is refused by the store and the file quietly lands in the
// database instead.
export const AZURE_VERSION = '2021-08-06';

export async function azureSign({ account, key, method, path, headers, contentLength, contentType }) {
  const xms = Object.keys(headers).map((h) => h.toLowerCase()).filter((h) => h.startsWith('x-ms-')).sort();
  const lower = {};
  for (const h of Object.keys(headers)) lower[h.toLowerCase()] = String(headers[h]).trim().replace(/\s+/g, ' ');
  const stringToSign = [
    method, '', '', contentLength ? String(contentLength) : '', '', contentType || '', '', '', '', '', '', '',
  ].join('\n') + '\n' + xms.map((h) => h + ':' + lower[h] + '\n').join('') + '/' + account + path;
  const raw = Uint8Array.from(atob(key), (ch) => ch.charCodeAt(0));
  const k = await crypto.subtle.importKey('raw', raw, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', k, enc(stringToSign)));
  let bin = '';
  for (const b of sig) bin += String.fromCharCode(b);
  return { stringToSign, authorization: 'SharedKey ' + account + ':' + btoa(bin) };
}

async function azureFetch(cfg, method, key, body, contentType) {
  const url = new URL(cfg.endpoint + '/' + cfg.container + '/' + key);
  const path = url.pathname;                         // already encoded; keys are safeKey()'d
  const payload = body ? new Uint8Array(body) : null;
  const headers = { 'x-ms-date': new Date().toUTCString(), 'x-ms-version': AZURE_VERSION };
  if (method === 'PUT') { headers['x-ms-blob-type'] = 'BlockBlob'; headers['Content-Type'] = contentType || 'application/octet-stream'; }
  if (cfg.key) {
    const s = await azureSign({ account: cfg.account, key: cfg.key, method, path, headers,
      contentLength: payload ? payload.length : 0, contentType: method === 'PUT' ? headers['Content-Type'] : '' });
    headers.Authorization = s.authorization;
  }
  const target = cfg.key ? url.toString() : url.toString() + '?' + cfg.sas;
  return fetch(target, { method, headers, body: method === 'PUT' ? payload : undefined });
}

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

// ---------------------------------------------------------------- the index
// Keys are built as <area>/<project id>/…, so the project is read off the key.

let indexReady = false;
export async function ensureFileIndex(env) {
  if (indexReady) return true;
  try {
    await env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS stored_files (
         key TEXT PRIMARY KEY, project_id TEXT, area TEXT, size REAL, mime TEXT,
         driver TEXT, fell_back INTEGER DEFAULT 0, created_at TEXT)`
    ).run();
    await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_stored_files_p ON stored_files(project_id, area)').run();
    indexReady = true;
    return true;
  } catch (e) { return false; }
}
export function keyParts(key) {
  const parts = safeKey(key).split('/');
  return { area: parts[0] || '', project_id: parts.length > 2 ? parts[1] : null };
}
async function indexPut(env, k, size, mime, driver, fellBack) {
  if (!(await ensureFileIndex(env))) return;
  const { area, project_id } = keyParts(k);
  try {
    await env.DB.prepare('DELETE FROM stored_files WHERE key = ?').bind(k).run();
    await env.DB.prepare('INSERT INTO stored_files (key, project_id, area, size, mime, driver, fell_back, created_at) VALUES (?,?,?,?,?,?,?,?)')
      .bind(k, project_id, area, size, mime, driver, fellBack ? 1 : 0, nowISO()).run();
  } catch (e) { /* the file is stored; the index is a convenience */ }
}

// ---------------------------------------------------------------- the API
// Three calls. Everything above this line is how, not what.

// Into one named store only — for the move out of the database, which must
// know the file reached object storage and never fall back.
export async function putFileTo(env, driver, key, bytes, contentType) {
  const k = safeKey(key);
  const u8 = new Uint8Array(bytes || []);
  const mime = String(contentType || 'application/octet-stream');
  try {
    if (driver === 'azure') {
      const cfg = azureConfig(env);
      const r = cfg ? await azureFetch(cfg, 'PUT', k, u8, mime) : null;
      if (!r || !r.ok) return { error: 'the Azure store refused it' + (r ? ' (' + r.status + ')' : '') };
    } else if (driver === 's3') {
      const cfg = s3Config(env);
      const r = cfg ? await signedFetch(cfg, 'PUT', k, u8, mime) : null;
      if (!r || !r.ok) return { error: 'the S3 store refused it' + (r ? ' (' + r.status + ')' : '') };
    } else if (driver === 'bucket') {
      if (!hasBucket(env)) return { error: 'no bucket' };
      await env.DRAWINGS.put(k, u8, { httpMetadata: { contentType: mime } });
    } else return { error: 'not an object store: ' + driver };
  } catch (e) { return { error: 'the store could not be reached: ' + (e && e.message || e) }; }
  await indexPut(env, k, u8.length, mime, driver, false);
  return { ok: true, driver, key: k, size: u8.length };
}

// From one named store only — so the move out of the database can prove the
// object store holds the file before the database copy is removed.
export async function getFileFrom(env, driver, key) {
  const k = safeKey(key);
  try {
    if (driver === 'azure') {
      const cfg = azureConfig(env);
      const r = cfg ? await azureFetch(cfg, 'GET', k, null, null) : null;
      return r && r.ok ? new Uint8Array(await r.arrayBuffer()) : null;
    }
    if (driver === 's3') {
      const cfg = s3Config(env);
      const r = cfg ? await signedFetch(cfg, 'GET', k, null, null) : null;
      return r && r.ok ? new Uint8Array(await r.arrayBuffer()) : null;
    }
    if (driver === 'bucket' && hasBucket(env)) {
      const o = await env.DRAWINGS.get(k);
      return o ? new Uint8Array(await o.arrayBuffer()) : null;
    }
  } catch (e) { /* unreachable */ }
  return null;
}

export async function putFile(env, key, bytes, contentType) {
  const k = safeKey(key);
  if (!k) return { error: 'no key' };
  const u8 = new Uint8Array(bytes || []);
  if (!u8.length) return { error: 'no file received' };
  const mime = String(contentType || 'application/octet-stream');
  const wanted = driverName(env);

  // An object store first; a failure falls through — a file the platform
  // cannot store is worse than a file in the wrong place, so the database keeps
  // it rather than losing it. It is recorded as having fallen back.
  if (azureConfig(env)) {
    const r = await putFileTo(env, 'azure', k, u8, mime);
    if (r.ok) return r;
  }
  const cfg = s3Config(env);
  if (cfg) {
    try {
      const r = await signedFetch(cfg, 'PUT', k, u8, mime);
      if (r.ok) { await indexPut(env, k, u8.length, mime, 's3', wanted !== 's3'); return { ok: true, driver: 's3', key: k, size: u8.length }; }
    } catch (e) { /* fall through */ }
  }
  if (hasBucket(env)) {
    try {
      await env.DRAWINGS.put(k, u8, { httpMetadata: { contentType: mime } });
      await indexPut(env, k, u8.length, mime, 'bucket', wanted !== 'bucket');
      return { ok: true, driver: 'bucket', key: k, size: u8.length };
    } catch (e) { /* fall through */ }
  }
  await ensureFilesTable(env);
  try {
    await env.DB.prepare(`DELETE FROM files WHERE key = ?`).bind(k).run();
    await env.DB.prepare(`INSERT INTO files (key, mime, size, data, created_at) VALUES (?,?,?,?,?)`)
      .bind(k, mime, u8.length, bytesToB64(u8), nowISO()).run();
  } catch (e) { return { error: 'could not store the file' }; }
  await indexPut(env, k, u8.length, mime, 'database', wanted !== 'database');
  return { ok: true, driver: 'database', key: k, size: u8.length, ...(wanted !== 'database' ? { fell_back: true } : {}) };
}

// Read a file back. It is looked for wherever it might be, in the order it
// would have been written, so a store that changed under a live project still
// serves what was put there before the change.
export async function getFile(env, key) {
  const k = safeKey(key);
  if (!k) return null;

  const az = azureConfig(env);
  if (az) {
    try {
      const r = await azureFetch(az, 'GET', k, null, null);
      if (r.ok) {
        return {
          bytes: new Uint8Array(await r.arrayBuffer()),
          mime: r.headers.get('content-type') || 'application/octet-stream',
          driver: 'azure',
        };
      }
    } catch (e) { /* look elsewhere */ }
  }
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
  // A file shared with a test-drive copy still belongs to the real project:
  // the copy's row goes, the file stays (src/testdrive.js).
  try {
    const held = await env.DB.prepare('SELECT 1 AS x FROM testdrive_keys WHERE key = ?').bind(k).first();
    if (held) return { ok: true, held: true };
  } catch (e) { /* no test drive has ever run here */ }
  const az = azureConfig(env);
  if (az) { try { await azureFetch(az, 'DELETE', k, null, null); } catch (e) {} }
  const cfg = s3Config(env);
  if (cfg) { try { await signedFetch(cfg, 'DELETE', k, null, null); } catch (e) {} }
  if (hasBucket(env) && typeof env.DRAWINGS.delete === 'function') {
    try { await env.DRAWINGS.delete(k); } catch (e) {}
  }
  await ensureFilesTable(env);
  try { await env.DB.prepare(`DELETE FROM files WHERE key = ?`).bind(k).run(); } catch (e) {}
  if (await ensureFileIndex(env)) { try { await env.DB.prepare('DELETE FROM stored_files WHERE key = ?').bind(k).run(); } catch (e) {} }
  return { ok: true };
}

// Every stored file of a project in the given areas ("drawings", "library",
// …) — from the index, and from the database's own files table for anything
// stored before the index existed. For clearing or deleting a project, so no
// file outlives its record (spec §12).
export async function deleteProjectFiles(env, pid, areas) {
  if (!pid) return { deleted: 0 };
  const keys = new Set();
  for (const a of areas || []) {
    const prefix = safeKey(a) + '/' + safeKey(pid) + '/';
    if (await ensureFileIndex(env)) {
      try {
        const { results } = await env.DB.prepare('SELECT key FROM stored_files WHERE key LIKE ?').bind(prefix + '%').all();
        for (const r of results || []) if (r.key.startsWith(prefix)) keys.add(r.key);   // LIKE's _ is a wildcard
      } catch (e) { /* none */ }
    }
    await ensureFilesTable(env);
    try {
      const { results } = await env.DB.prepare('SELECT key FROM files WHERE key LIKE ?').bind(prefix + '%').all();
      for (const r of results || []) if (r.key.startsWith(prefix)) keys.add(r.key);
    } catch (e) { /* none */ }
  }
  let n = 0;
  for (const k of keys) { const r = await deleteFile(env, k); if (r.ok && !r.held) n++; }
  return { deleted: n };
}
