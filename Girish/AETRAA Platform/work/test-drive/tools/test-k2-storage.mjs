// K2: files out of PostgreSQL (spec §12, §16 phase 0, §8).
//   - the Azure Blob driver: Shared Key signing pinned against a request the
//     official Azure SDK signed, then a round trip through a Blob server that
//     checks every signature
//   - a drawing (register screen), a site photo, a template and an attachment
//     round-trip through Blob
//   - the move of files already in the database: a dry run that changes
//     nothing, then the move, each file read back before the database copy goes
//   - a failing store: the file is kept in the database and counted as fallen back
//   - what each project holds; clearing a project deletes its stored files;
//     a drawing cannot be pointed at another company's file
//   node tools/test-k2-storage.mjs
// (Also checked by hand against Azurite and @azure/storage-blob 12.34; see CHANGES.)
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { zipSync, strToU8 } from 'fflate';
import { db, env, call, admin, as, check, done, onboard } from './_harness.mjs';
import { azureSign, azureConfig, driverName } from '../src/storage.js';
import { saveTemplate, getTemplateBytes, ensureTemplatesTable } from '../src/templates-store.js';
import { ensureQuarantineTable } from '../src/quarantine.js';

const sha = (u8) => createHash('sha256').update(Buffer.from(u8)).digest('hex');
const b64 = (u8) => Buffer.from(u8).toString('base64');
const KEY = 'Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==';

console.log('— Shared Key signing, pinned —');
// A PUT signed by @azure/storage-blob 12.34.0 (captured on 6 Oct 2026).
const pinned = await azureSign({ account: 'myaccount', key: KEY, method: 'PUT', path: '/aetraa/drawings/proj-a/dwg_9/A-1.pdf',
  headers: { 'x-ms-version': '2026-10-06', 'x-ms-blob-content-type': 'application/pdf', 'x-ms-blob-type': 'BlockBlob',
    'x-ms-client-request-id': '3cd2a2dc-36f1-4488-9702-4a0e2674fb50', 'x-ms-date': 'Tue, 06 Oct 2026 11:23:41 GMT' },
  contentLength: 5, contentType: 'application/octet-stream' });
check('the signature is the one the Azure SDK computed for the same request', pinned.authorization === 'SharedKey myaccount:xaeRSf1zAP164zzLcq0E+doH3CrUDh9sv0uZ1ND1kr0=', pinned.authorization);
check('a connection string is read', (() => { const c = azureConfig({ AZURE_STORAGE_CONNECTION_STRING: 'DefaultEndpointsProtocol=https;AccountName=acc;AccountKey=' + KEY + ';EndpointSuffix=core.windows.net', AZURE_STORAGE_CONTAINER: 'c' });
  return c && c.account === 'acc' && c.endpoint === 'https://acc.blob.core.windows.net'; })());
check('nothing configured → the database, as before', driverName({}) === 'database');

// ---- a Blob server that refuses any request whose signature is wrong
const blobs = new Map();
let refused = 0, up = true;
const server = createServer(async (req, res) => {
  const chunks = []; for await (const c of req) chunks.push(c);
  const body = Buffer.concat(chunks);
  if (!up) { req.socket.destroy(); return; }
  const url = new URL(req.url, 'http://x');
  const xms = Object.fromEntries(Object.entries(req.headers).filter(([k]) => k.startsWith('x-ms-')));
  const want = await azureSign({ account: 'devstoreaccount1', key: KEY, method: req.method, path: url.pathname, headers: xms,
    contentLength: body.length, contentType: req.method === 'PUT' ? req.headers['content-type'] : '' });
  if (req.headers.authorization !== want.authorization || !req.headers['x-ms-date'] || !req.headers['x-ms-version']) { refused++; res.writeHead(403); return res.end('AuthenticationFailed'); }
  const k = url.pathname.replace(/^\/devstoreaccount1\/aetraa-files\//, '');
  if (req.method === 'PUT') {
    if (req.headers['x-ms-blob-type'] !== 'BlockBlob') { res.writeHead(400); return res.end('MissingRequiredHeader'); }
    blobs.set(k, { bytes: body, type: req.headers['content-type'] }); res.writeHead(201); return res.end();
  }
  if (req.method === 'GET') {
    const b = blobs.get(k); if (!b) { res.writeHead(404); return res.end('BlobNotFound'); }
    res.writeHead(200, { 'content-type': b.type }); return res.end(b.bytes);
  }
  if (req.method === 'DELETE') { const had = blobs.delete(k); res.writeHead(had ? 202 : 404); return res.end(); }
  res.writeHead(405); res.end();
});
await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
const PORT = server.address().port;
const AZ = { AZURE_STORAGE_ACCOUNT: 'devstoreaccount1', AZURE_STORAGE_KEY: KEY, AZURE_STORAGE_CONTAINER: 'aetraa-files',
  AZURE_STORAGE_ENDPOINT: 'http://127.0.0.1:' + PORT + '/devstoreaccount1' };

console.log('\n— before: everything in the database —');
const { pid } = await onboard('Tower S', 'TWS-0001', [['The PM', 'pm@towers.test', ['pm']], ['The Site', 'site@towers.test', ['site']]]);
const other = await onboard('Tower T', 'TWT-0001', [['Other PM', 'pm@towert.test', ['pm']]]);
const PDF = new TextEncoder().encode('%PDF-1.4 ground floor plan ' + 'x'.repeat(3000));
const JPG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4, 5, 0xff, 0xd9]);
await as('pm@towers.test');
let r = await call('/api/drawing', { number: 'AR-100', revision: 'A', title: 'Site plan', kind: 'ifc', filename: 'AR-100.pdf', data: 'data:application/pdf;base64,' + b64(PDF) });
check('a register upload is filed', r.status === 200 && r.json.ok, r.text.slice(0, 200));
let row = db.prepare("SELECT data, r2_key FROM drawings WHERE project_id = ? AND number = 'AR-100'").get(pid);
check('its bytes go through the file store, not drawings.data', row.data === null && row.r2_key.startsWith('drawings/' + pid + '/'), row);
// Rows from before K2: bytes in drawings.data, photos.data, a held payload, a template blob.
await ensureQuarantineTable(env);
await ensureTemplatesTable(env);
db.prepare("INSERT INTO drawings (project_id, id, number, revision, title, kind, status, mime, data, uploaded_at) VALUES (?,?,?,?,?,?,?,?,?,?)")
  .run(pid, 'dwg_old', 'ST-200', 'B', 'Old slab', 'ifc', 'current', 'application/pdf', 'data:application/pdf;base64,' + b64(PDF), '2026-09-01');
await call('/api/photo', { activity_id: 'A1', caption: 'warm-up', data: 'data:image/jpeg;base64,' + b64(JPG) });
db.prepare("INSERT INTO photos (id, project_id, activity_id, report_date, caption, mime, data, submitted_by, created_at) VALUES (?,?,?,?,?,?,?,?,?)")
  .run('ph_old', pid, 'A1', '2026-09-02', 'Old pour', 'image/jpeg', 'data:image/jpeg;base64,' + b64(JPG), 'site', '2026-09-02T08:00:00Z');
db.prepare("INSERT INTO quarantine (id, project_id, kind, filename, number, payload, status, held_at) VALUES (?,?,?,?,?,?,?,?)")
  .run('q_old', pid, 'drawing', 'XX-1.pdf', 'XX-1', JSON.stringify({ number: 'XX-1', data: 'data:application/pdf;base64,' + b64(PDF) }), 'held', '2026-09-03');
const DOCX = zipSync({ '[Content_Types].xml': strToU8('<Types/>'), 'word/document.xml': strToU8('<w:document><w:body><w:p><w:r><w:t>{{Project}}</w:t></w:r></w:p></w:body></w:document>') });
db.prepare("INSERT INTO templates (id, project_id, doc_type, filename, r2_key, blob, tokens, size, uploaded_by, uploaded_at) VALUES (?,?,?,?,?,?,?,?,?,?)")
  .run('tpl_old', pid, 'rfi', 'RFI form.docx', null, b64(DOCX), '[]', DOCX.length, 'AETRAA', '2026-09-04');

await admin();
r = await call('/api/storage/move');
const counts0 = Object.fromEntries(r.json.sources.map((s) => [s.source, s.count]));
check('the dry run counts every file still in the database, by kind', r.status === 200 && r.json.dry_run && counts0.drawings === 1 && counts0.photos === 1 && counts0.held === 1 && counts0.templates === 1 && counts0.files >= 2, counts0);
check('with no object store it says there is nowhere to move them', r.json.can_move === false && /No object store/.test(r.json.why_not));
r = await call('/api/storage/move', { confirm: 'move' });
check('and the move is refused', r.status === 400, r.text);

console.log('\n— Azure configured —');
Object.assign(env, AZ);
check('the driver is Azure Blob', driverName(env) === 'azure');
r = await call('/api/storage');
check('the self-test round-trips through Blob', r.status === 200 && r.json.working && r.json.wrote_to === 'azure', r.text);
r = await call('/api/storage/move');
const before = r.json.total;
check('the dry run changes nothing', r.json.can_move === true && before.count === Object.values(counts0).reduce((a, b) => a + b, 0)
  && db.prepare("SELECT data FROM drawings WHERE id = 'dwg_old'").get().data !== null && blobs.size === 0, r.json.total);
r = await call('/api/storage/move', { limit: 5 });
check('the move needs confirm: "move"', r.status === 400, r.status);
r = await call('/api/storage/move', { confirm: 'move', limit: 100 });
check('every file is moved, none failed', r.status === 200 && r.json.moved === before.count && !r.json.failed.length && r.json.finished && r.json.remaining.count === 0, r.text.slice(0, 300));
check('the database copies are gone', db.prepare('SELECT COUNT(*) AS n FROM files').get().n === 0
  && db.prepare("SELECT data FROM drawings WHERE id = 'dwg_old'").get().data === null
  && db.prepare("SELECT data FROM photos WHERE id = 'ph_old'").get().data === ''
  && !/data:/.test(db.prepare("SELECT payload FROM quarantine WHERE id = 'q_old'").get().payload)
  && db.prepare("SELECT blob FROM templates WHERE id = 'tpl_old'").get().blob === null);
const oldKey = db.prepare("SELECT r2_key FROM drawings WHERE id = 'dwg_old'").get().r2_key;
check('the old drawing is in Blob with the same bytes', blobs.has(oldKey) && sha(blobs.get(oldKey).bytes) === sha(PDF), oldKey);
const heldKey = db.prepare("SELECT file_key FROM quarantine WHERE id = 'q_old'").get().file_key;
check('the held drawing’s payload names its key', blobs.has(heldKey) && JSON.parse(db.prepare("SELECT payload FROM quarantine WHERE id = 'q_old'").get().payload).r2_key === heldKey);
await as('pm@towers.test');
r = await call('/dwg/dwg_old');
check('the moved drawing is served from Blob', r.status === 200 && sha(r.bytes) === sha(PDF));
r = await call('/photo/ph_old');
check('the moved photo is served from Blob', r.status === 200 && sha(r.bytes) === sha(JPG));
const tb = await getTemplateBytes(env, pid, 'rfi');
check('the moved template reads back from Blob', tb && sha(tb.bytes) === sha(DOCX));
r = await call('/api/storage/move', { confirm: 'move' });
check('running it again moves nothing', r.status === 401 || (r.json && r.json.moved === 0), r.status);

console.log('\n— new files go to Blob: a drawing, a photo, a template, an attachment —');
const n0 = blobs.size;
r = await call('/api/drawing', { number: 'AR-101', revision: 'A', title: 'GF plan', kind: 'ifc', filename: 'AR-101.pdf', data: 'data:application/pdf;base64,' + b64(PDF) });
const k101 = db.prepare("SELECT r2_key FROM drawings WHERE project_id = ? AND number = 'AR-101'").get(pid).r2_key;
check('a drawing uploaded on the register goes to Blob', r.status === 200 && blobs.has(k101));
r = await call('/dwg/' + r.json.id);
check('and comes back from it', r.status === 200 && sha(r.bytes) === sha(PDF));
await as('site@towers.test');
r = await call('/api/photo', { activity_id: 'A2', caption: 'Rebar', data: 'data:image/jpeg;base64,' + b64(JPG) });
const pk = db.prepare('SELECT file_key, data FROM photos WHERE id = ?').get(r.json.id);
check('a site photo goes to Blob', r.status === 200 && pk.data === '' && blobs.has(pk.file_key), pk);
r = await call('/photo/' + r.json.id);
check('and is served from it', r.status === 200 && sha(r.bytes) === sha(JPG));
r = await saveTemplate(env, pid, 'submittal', 'Submittal form.docx', DOCX, 'AETRAA');
const tk = db.prepare("SELECT r2_key FROM templates WHERE project_id = ? AND doc_type = 'submittal'").get(pid).r2_key;
check('a template goes to Blob', !r.error && blobs.has(tk), r);
await as('pm@towers.test');
r = await call('/api/records', { type: 'ncr', title: 'Honeycombing', data: { 'Non-conformance': 'Honeycombing' } });
const ncr = r.json.ref;
r = await call('/api/attachment', { ref: ncr, filename: 'photo.pdf', mime: 'application/pdf', file_b64: b64(PDF) });
check('an attachment goes to Blob', r.status === 200 && [...blobs.keys()].some((k) => k.startsWith('attachments/' + pid + '/')), r.text.slice(0, 200));
r = await call('/api/attachments?ref=' + ncr);
const att = (r.json.attachments || [])[0];
r = await call('/attachment/' + encodeURIComponent(att.id));
check('and downloads from it', r.status === 200 && sha(r.bytes) === sha(PDF), r.status);
check('nothing new went to the database', db.prepare('SELECT COUNT(*) AS n FROM files').get().n === 0 && blobs.size >= n0 + 4);

console.log('\n— a store that fails —');
up = false;
r = await call('/api/drawing', { number: 'AR-102', revision: 'A', title: 'L1 plan', kind: 'ifc', filename: 'AR-102.pdf', data: 'data:application/pdf;base64,' + b64(PDF) });
check('the upload is kept, in the database, rather than lost', r.status === 200 && db.prepare('SELECT COUNT(*) AS n FROM files').get().n === 1);
up = true;
await admin();
r = await call('/api/storage/capacity');
check('and the storage screen counts it as fallen back', r.status === 200 && r.json.fell_back.files === 1 && r.json.database.files_still_in_database === 1, r.json.fell_back);
r = await call('/api/storage/move', { confirm: 'move' });
check('the next move takes it across', r.json.moved === 1 && db.prepare('SELECT COUNT(*) AS n FROM files').get().n === 0);
r = await call('/api/storage/capacity');
const mine = r.json.projects.find((x) => x.id === pid);
check('what the project holds: drawings, records, photos, bytes, last activity', mine && mine.drawings === 4 && mine.records === 1 && mine.photos === 3
  && mine.bytes_object_store > 3 * PDF.length && mine.bytes_in_database === 0 && !!mine.last_activity, mine);
check('the database size is reported against its limit', r.json.database.bytes > 0 && r.json.database.limit_gb === 32 && r.json.database.used_pct !== null && r.json.driver === 'azure', r.json.database);
check('the fallback is no longer counted once moved', r.json.fell_back.files === 0);
r = await call('/storage');
check('the Storage page opens for AETRAA', r.status === 200 && r.text.includes('Moving files out of the database'));
await as('pm@towers.test');
r = await call('/api/storage/capacity');
check('and for nobody else', r.status === 401, r.status);

console.log('\n— keys are claims; deleting a project deletes its files —');
const theirKey = 'library/' + other.pid + '/secret';
blobs.set(theirKey, { bytes: Buffer.from('COMPANY T CONFIDENTIAL'), type: 'text/plain' });
r = await call('/api/drawing', { number: 'AR-999', revision: 'A', title: 'x', kind: 'ifc', r2_key: theirKey });
check('a drawing cannot be pointed at another company’s file', r.status === 400 && /not on this project/.test(r.json.error), r.text);
const id101 = db.prepare("SELECT id FROM drawings WHERE project_id = ? AND number = 'AR-101'").get(pid).id;
r = await call('/api/drawing', { remove: true, id: id101 });
check('removing a register upload removes its file', r.status === 200 && !blobs.has(k101));
await admin();
const proj = db.prepare('SELECT name FROM projects WHERE id = ?').get(pid);
r = await call('/api/project', { id: pid, action: 'clear-documents', confirm_name: proj.name });
const left = [...blobs.keys()].filter((k) => /^(drawings|library|attachments|intake)\//.test(k) && k.split('/')[1] === pid);
check('clearing the documents deletes their stored files', r.status === 200 && r.json.files_deleted >= 3 && !left.length, { status: r.status, body: r.text.slice(0, 200), left });
check('photos and templates stay (they are not documents)', blobs.has(pk.file_key) && blobs.has(tk));
r = await call('/api/project', { id: pid, action: 'delete', confirm_name: proj.name });
check('deleting the project deletes the rest', r.status === 200 && ![...blobs.keys()].some((k) => k.split('/')[1] === pid), [...blobs.keys()]);
check('another company’s files are untouched', blobs.has(theirKey));
check('every request the store saw was correctly signed', refused === 0, refused);
server.close();
done();
