// THE PORTABLE FILE STORE.
//
// The point of this file is the move to Oracle Cloud. The same three calls have
// to put, fetch and remove a file on Cloudflare today and on Oracle later, with
// nothing above them changed. So all three drivers are exercised here, and the
// S3 one is exercised against a real HTTP server on a real socket — a signature
// that is merely plausible is worth nothing.
//
//   node tools/test-storage.mjs
import { DatabaseSync } from 'node:sqlite';
import { createServer } from 'node:http';
import {
  putFile, getFile, deleteFile, driverName, DRIVER_LABEL, s3Config, hasBucket,
  safeKey, bytesToB64, b64ToBytes, sigv4,
} from '../src/storage.js';

let fails = 0, checks = 0;
const check = (n, c, d) => { checks++; console.log((c ? '  ok   ' : '  FAIL ') + n + (d && !c ? '  — ' + d : '')); if (!c) fails++; };

// ---- a database, shaped the way D1 shapes one --------------------------
function makeDb() {
  const db = new DatabaseSync(':memory:');
  const stmt = (sql) => {
    const st = db.prepare(sql); let args = [];
    const api = { bind(...a) { args = a; return api; },
      async all() { return { results: st.all(...args), success: true }; },
      async first(c) { const r = st.get(...args) ?? null; return c && r ? r[c] : r; },
      async run() { st.run(...args); return { success: true, meta: {} }; } };
    return api;
  };
  return { prepare: stmt, async exec(s) { db.exec(s); return { count: 1 }; } };
}

// ======================================================================
// THE SIGNATURE ITSELF, pinned to AWS's own published worked example.
// If this one check fails, Oracle Cloud will reject every upload — and the
// store will quietly keep the file in the database instead, so nothing else
// in this file would notice. It is the most important check here.
// ======================================================================
{
  const v = await sigv4({
    accessKey: 'AKIAIOSFODNN7EXAMPLE',
    secretKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
    region: 'us-east-1', service: 's3',
    method: 'GET', path: '/test.txt',
    headers: {
      host: 'examplebucket.s3.amazonaws.com',
      range: 'bytes=0-9',
      'x-amz-content-sha256': 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      'x-amz-date': '20130524T000000Z',
    },
    payloadHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    amzDate: '20130524T000000Z',
  });
  check('SigV4 matches AWS\'s published worked example',
    v.signature === 'f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41',
    'got ' + v.signature);
  check('the signed-header list is built in the required order',
    v.signedHeaders === 'host;range;x-amz-content-sha256;x-amz-date', v.signedHeaders);

  // and a different secret must not produce the same signature
  const w = await sigv4({
    accessKey: 'AKIAIOSFODNN7EXAMPLE', secretKey: 'a-different-secret',
    region: 'us-east-1', service: 's3', method: 'GET', path: '/test.txt',
    headers: { host: 'examplebucket.s3.amazonaws.com', range: 'bytes=0-9',
      'x-amz-content-sha256': 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      'x-amz-date': '20130524T000000Z' },
    payloadHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    amzDate: '20130524T000000Z',
  });
  check('the secret actually takes part in the signature', w.signature !== v.signature);
}

const BYTES = new Uint8Array(3000);
for (let i = 0; i < BYTES.length; i++) BYTES[i] = (i * 7) % 256;
const same = (a, b) => a && b && a.length === b.length && a.every((v, i) => v === b[i]);

// ---- base64 round trip, including sizes that break the naive version ----
check('base64 round trip', same(b64ToBytes(bytesToB64(BYTES)), BYTES));
const BIG = new Uint8Array(200000).map((_, i) => i % 251);
check('base64 survives a large file', same(b64ToBytes(bytesToB64(BIG)), BIG), 'chunking');

// ---- keys cannot climb out of their prefix ------------------------------
check('a key is confined to its prefix', safeKey('a/../../etc/passwd') === 'a/etc/passwd', safeKey('a/../../etc/passwd'));
check('backslashes are normalised', safeKey('a\\b\\c.docx') === 'a/b/c.docx', safeKey('a\\b\\c.docx'));
check('odd characters are replaced, not passed on', safeKey('p/My File (1).docx') === 'p/My_File__1_.docx', safeKey('p/My File (1).docx'));
check('an empty key is refused', safeKey('///') === '');

// ======================================================================
// DRIVER 1 — the database. No bucket, no keys: it must still work.
// ======================================================================
{
  const env = { DB: makeDb() };
  check('with nothing configured the driver is the database', driverName(env) === 'database', driverName(env));
  const put = await putFile(env, 'proj1/attach/a.pdf', BYTES, 'application/pdf');
  check('[database] a file is stored', put.ok && put.driver === 'database', JSON.stringify(put));
  const got = await getFile(env, 'proj1/attach/a.pdf');
  check('[database] the same bytes come back', same(got && got.bytes, BYTES));
  check('[database] the type comes back', got && got.mime === 'application/pdf', got && got.mime);
  await putFile(env, 'proj1/attach/a.pdf', BIG, 'application/pdf');
  const re = await getFile(env, 'proj1/attach/a.pdf');
  check('[database] re-writing a key replaces it', same(re && re.bytes, BIG), 'size ' + (re && re.bytes.length));
  await deleteFile(env, 'proj1/attach/a.pdf');
  check('[database] a removed file is gone', (await getFile(env, 'proj1/attach/a.pdf')) === null);
  check('[database] an empty file is refused', !!(await putFile(env, 'p/x', new Uint8Array(0), 'text/plain')).error);
}

// ======================================================================
// DRIVER 2 — an R2 binding, the way Cloudflare presents one.
// ======================================================================
{
  const bucket = new Map();
  const env = {
    DB: makeDb(),
    DRAWINGS: {
      async put(k, v, o) { bucket.set(k, { v: new Uint8Array(v), o }); return { key: k }; },
      async get(k) { const e = bucket.get(k); return e ? {
        httpMetadata: (e.o && e.o.httpMetadata) || {},
        async arrayBuffer() { return e.v.buffer.slice(e.v.byteOffset, e.v.byteOffset + e.v.byteLength); } } : null; },
      async delete(k) { bucket.delete(k); },
    },
  };
  check('with a bucket bound the driver is the bucket', driverName(env) === 'bucket', driverName(env));
  check('hasBucket sees it', hasBucket(env));
  const put = await putFile(env, 'proj1/tpl/wir.docx', BYTES, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  check('[bucket] a file is stored in the bucket, not the database', put.ok && put.driver === 'bucket', JSON.stringify(put));
  const got = await getFile(env, 'proj1/tpl/wir.docx');
  check('[bucket] the same bytes come back', same(got && got.bytes, BYTES));
  check('[bucket] it really is in the bucket', bucket.has('proj1/tpl/wir.docx'));
  await deleteFile(env, 'proj1/tpl/wir.docx');
  check('[bucket] a removed file is gone from the bucket', !bucket.has('proj1/tpl/wir.docx'));
  check('[bucket] and cannot be read back', (await getFile(env, 'proj1/tpl/wir.docx')) === null);

  // A bucket that fails must not lose the file.
  const broken = { DB: makeDb(), DRAWINGS: { async put() { throw new Error('bucket down'); },
    async get() { return null; }, async delete() {} } };
  const p2 = await putFile(broken, 'p/keep.pdf', BYTES, 'application/pdf');
  check('[bucket] a failing bucket falls back to the database', p2.ok && p2.driver === 'database', JSON.stringify(p2));
  check('[bucket] and the file is still readable', same((await getFile(broken, 'p/keep.pdf') || {}).bytes, BYTES));
}

// ======================================================================
// DRIVER 3 — S3-compatible, against a real server. This is the Oracle path.
// ======================================================================
{
  const store = new Map();
  const seen = [];
  const srv = createServer(async (req, res) => {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    seen.push({ method: req.method, url: req.url, auth: req.headers.authorization || '',
                sha: req.headers['x-amz-content-sha256'] || '', date: req.headers['x-amz-date'] || '' });
    const key = decodeURIComponent(req.url.replace(/^\/[^/]+\//, ''));
    if (req.method === 'PUT') { store.set(key, { b: Buffer.concat(chunks), t: req.headers['content-type'] }); res.statusCode = 200; return res.end(); }
    if (req.method === 'GET') {
      const e = store.get(key);
      if (!e) { res.statusCode = 404; return res.end('no'); }
      res.setHeader('Content-Type', e.t || 'application/octet-stream');
      return res.end(e.b);
    }
    if (req.method === 'DELETE') { store.delete(key); res.statusCode = 204; return res.end(); }
    res.statusCode = 405; res.end();
  });
  await new Promise((ok) => srv.listen(0, ok));
  const PORT = srv.address().port;

  const env = {
    DB: makeDb(),
    S3_ENDPOINT: 'http://127.0.0.1:' + PORT,
    S3_BUCKET: 'aetraa-uae',
    S3_REGION: 'me-dubai-1',
    S3_ACCESS_KEY: 'AKIAEXAMPLEKEY',
    S3_SECRET_KEY: 'sUpErSeCrEtKeY/EXAMPLE',
  };
  check('S3 settings are recognised', !!s3Config(env));
  check('S3 wins over everything else', driverName(env) === 's3', driverName(env));
  check('the label names it plainly', /S3-compatible/.test(DRIVER_LABEL.s3), DRIVER_LABEL.s3);
  check('one missing setting means no S3', s3Config({ ...env, S3_SECRET_KEY: '' }) === null);

  const put = await putFile(env, 'proj1/attach/inspection photo.jpg', BYTES, 'image/jpeg');
  check('[s3] a file is stored over the wire', put.ok && put.driver === 's3', JSON.stringify(put));
  check('[s3] it reached the server', store.size === 1, [...store.keys()].join(','));
  check('[s3] the key was made safe first', [...store.keys()][0] === 'proj1/attach/inspection_photo.jpg', [...store.keys()][0]);

  const req = seen[0];
  check('[s3] the request was signed', /^AWS4-HMAC-SHA256 Credential=/.test(req.auth), req.auth.slice(0, 40));
  check('[s3] the credential scope names the region and service',
    req.auth.includes('/me-dubai-1/s3/aws4_request'), req.auth.slice(0, 120));
  check('[s3] the payload hash was sent', /^[0-9a-f]{64}$/.test(req.sha), req.sha);
  check('[s3] the signature is 64 hex characters',
    /, Signature=[0-9a-f]{64}$/.test(req.auth), req.auth.slice(-80));
  check('[s3] the bucket is in the path, not the host',
    req.url.startsWith('/aetraa-uae/'), req.url);

  const got = await getFile(env, 'proj1/attach/inspection photo.jpg');
  check('[s3] the same bytes come back', same(got && got.bytes, BYTES));
  check('[s3] the type comes back', got && got.mime === 'image/jpeg', got && got.mime);
  check('[s3] reading it was signed too', /^AWS4-HMAC-SHA256/.test(seen[1].auth));

  check('[s3] a file that is not there reads as nothing', (await getFile(env, 'proj1/nope.jpg')) === null);

  await deleteFile(env, 'proj1/attach/inspection photo.jpg');
  check('[s3] a removed file is gone from the server', store.size === 0);

  // If the object store is unreachable the file must still be kept.
  const down = { DB: makeDb(), S3_ENDPOINT: 'http://127.0.0.1:1', S3_BUCKET: 'b',
    S3_ACCESS_KEY: 'a', S3_SECRET_KEY: 'b' };
  const p = await putFile(down, 'p/urgent.pdf', BYTES, 'application/pdf');
  check('[s3] an unreachable store does NOT lose the file', p.ok && p.driver === 'database', JSON.stringify(p));
  check('[s3] and it reads back', same((await getFile(down, 'p/urgent.pdf') || {}).bytes, BYTES));

  srv.close();
}

// ======================================================================
// THE MIGRATION ITSELF — a file written on Cloudflare must still be
// readable once the same project is pointed at Oracle's object storage.
// ======================================================================
{
  const db = makeDb();
  const before = { DB: db };                                   // no bucket: database driver
  await putFile(before, 'proj1/attach/old-contract.pdf', BYTES, 'application/pdf');

  const after = { DB: db, S3_ENDPOINT: 'http://127.0.0.1:1', S3_BUCKET: 'aetraa-uae',
    S3_ACCESS_KEY: 'a', S3_SECRET_KEY: 'b' };                  // now pointed at object storage
  check('the environment changed driver', driverName(before) === 'database' && driverName(after) === 's3');
  const got = await getFile(after, 'proj1/attach/old-contract.pdf');
  check('a file stored BEFORE the move is still readable AFTER it', same(got && got.bytes, BYTES),
    'this is the migration, and it must never lose a document');
}

console.log('\n' + checks + ' checks, ' + fails + ' failures');
process.exit(fails ? 1 : 0);
