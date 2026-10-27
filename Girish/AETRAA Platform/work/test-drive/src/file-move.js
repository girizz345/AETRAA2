// K2: what each project holds, and moving files out of PostgreSQL.
//
// Spec §12: the live server keeps every file in PostgreSQL (32 GB, shared by
// every company), and bulk loading stays off until files are out of it.
// Spec §8: AETRAA sees, per project, the drawings, records, storage and last
// activity, and the platform total.
//
// TWO PARTS.
//
//   capacity(env)   per project: drawings, records, library documents, photos,
//                   bytes in the object store and bytes still in the database,
//                   last activity; and the platform: the database's own size
//                   against its limit, the object store's total, and how many
//                   files fell back to the database because the object store
//                   refused them. (K3's "storage over 80%" alert reads this.)
//
//   planMove(env)   THE DRY RUN: every file still held in PostgreSQL — the
//                   files table, drawings uploaded on the register screen,
//                   site photos, held drawings, templates — counted and sized,
//                   per project. Nothing is changed.
//   runMove(env)    the move, a batch at a time (an AETRAA Admin presses it,
//                   after the dry run): each file is written to the object
//                   store, READ BACK and compared byte for byte (SHA-256), and
//                   only then is the database copy removed. A file that fails
//                   stays exactly where it was and is reported. Running it again
//                   carries on where it stopped.
//
// Once moved, a file is protected by the object store's own soft delete and
// versioning, not the database's 7-day restore (deploy/azure/STORAGE.md).

import { driverName, DRIVER_LABEL, putFileTo, getFileFrom, b64ToBytes, ensureFilesTable, ensureFileIndex, keyParts, safeKey } from './storage.js';
import { photoKey, ensurePhotoColumns } from './photos.js';

const parse = (v, d) => { try { const j = JSON.parse(v || ''); return j == null ? d : j; } catch (e) { return d; } };
const num = (v) => Number(v) || 0;
async function rows(env, sql, ...args) {
  try { const { results } = await env.DB.prepare(sql).bind(...args).all(); return results || []; } catch (e) { return []; }
}
async function one(env, sql, ...args) {
  try { return await env.DB.prepare(sql).bind(...args).first(); } catch (e) { return null; }
}
// A base64 data URL's length → the file's own size.
const fromB64 = (n) => Math.floor(num(n) * 3 / 4);
const isTest = (pid) => /--test$/.test(String(pid || ''));
const EXT = { 'application/pdf': 'pdf', 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };
const mimeOfUrl = (s) => String(s || '').slice(5, String(s || '').indexOf(';'));
const sha = async (u8) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', u8))].map((b) => b.toString(16).padStart(2, '0')).join('');

export const SOURCE_LABEL = {
  files: 'Files in the database store (attachments, library, templates, intake, bills)',
  drawings: 'Drawings uploaded on the register screen',
  photos: 'Site photographs',
  held: 'Held drawings (with AETRAA)',
  templates: 'Consultant templates kept inline',
};

/* ------------------------------------------------------------ the dry run */

async function legacy(env) {
  await ensureFilesTable(env);
  await ensurePhotoColumns(env).catch(() => {});
  const files = (await rows(env, 'SELECT key, size FROM files')).map((r) => ({ id: r.key, project_id: keyParts(r.key).project_id, bytes: num(r.size) }));
  const drawings = (await rows(env, 'SELECT id, project_id, LENGTH(data) AS n FROM drawings WHERE data IS NOT NULL'))
    .map((r) => ({ id: r.id, project_id: r.project_id, bytes: fromB64(r.n) }));
  const photos = (await rows(env, "SELECT id, project_id, LENGTH(data) AS n FROM photos WHERE data IS NOT NULL AND data <> ''"))
    .map((r) => ({ id: r.id, project_id: r.project_id, bytes: fromB64(r.n) }));
  const held = (await rows(env, "SELECT id, project_id, payload FROM quarantine WHERE payload LIKE '%data:%'"))
    .map((r) => ({ r, p: parse(r.payload, {}) })).filter((x) => typeof x.p.data === 'string' && x.p.data.startsWith('data:'))
    .map((x) => ({ id: x.r.id, project_id: x.r.project_id, bytes: fromB64(x.p.data.length) }));
  const templates = (await rows(env, "SELECT id, project_id, LENGTH(blob) AS n FROM templates WHERE blob IS NOT NULL AND blob <> '' AND (r2_key IS NULL OR r2_key = '')"))
    .map((r) => ({ id: r.id, project_id: r.project_id, bytes: fromB64(r.n) }));
  return { files, drawings, photos, held, templates };
}

export async function planMove(env) {
  const target = driverName(env);
  const L = await legacy(env);
  const sources = Object.keys(L).map((k) => ({ source: k, label: SOURCE_LABEL[k], count: L[k].length, bytes: L[k].reduce((s, x) => s + x.bytes, 0) }));
  const byProject = {};
  for (const k of Object.keys(L)) for (const x of L[k]) {
    const p = x.project_id || '(no project)';
    const b = byProject[p] || (byProject[p] = { project_id: p, count: 0, bytes: 0 });
    b.count++; b.bytes += x.bytes;
  }
  const total = sources.reduce((s, x) => ({ count: s.count + x.count, bytes: s.bytes + x.bytes }), { count: 0, bytes: 0 });
  return {
    dry_run: true, target, target_label: DRIVER_LABEL[target],
    can_move: target !== 'database',
    why_not: target === 'database' ? 'No object store is configured, so there is nowhere to move them to. Set AZURE_STORAGE_* (deploy/azure/STORAGE.md) and run the dry run again.' : null,
    sources, total, by_project: Object.values(byProject).sort((a, b) => b.bytes - a.bytes),
  };
}

/* ------------------------------------------------------------ the move */

export async function runMove(env, opts = {}) {
  const target = driverName(env);
  if (target === 'database') return { error: 'No object store is configured — there is nowhere to move the files to.' };
  const limit = Math.max(1, Math.min(500, num(opts.limit) || 100));
  const maxBytes = Math.max(1, num(opts.max_bytes) || 100 * 1024 * 1024);
  let moved = 0, bytes = 0;
  const failed = [], done = { files: 0, drawings: 0, photos: 0, held: 0, templates: 0 };
  const room = () => moved < limit && bytes < maxBytes;

  // Write, read back, compare. Only a verified copy lets the database copy go.
  const place = async (key, u8, mime) => {
    const put = await putFileTo(env, target, key, u8, mime);
    if (put.error) return put;
    const back = await getFileFrom(env, target, put.key);
    if (!back || back.length !== u8.length || (await sha(back)) !== (await sha(u8))) return { error: 'what the store returned did not match what was sent' };
    return put;
  };
  const fail = (source, id, error) => failed.push({ source, id, error: String(error).slice(0, 200) });

  // 1. the database store's own files table
  await ensureFilesTable(env);
  for (const r of await rows(env, 'SELECT key, mime, data FROM files ORDER BY key LIMIT ?', limit)) {
    if (!room()) break;
    if (!r.data) continue;
    const u8 = b64ToBytes(r.data);
    const put = await place(r.key, u8, r.mime);
    if (put.error) { fail('files', r.key, put.error); continue; }
    await env.DB.prepare('DELETE FROM files WHERE key = ?').bind(r.key).run();
    moved++; bytes += u8.length; done.files++;
  }
  // 2. drawings uploaded on the register screen
  for (const r of room() ? await rows(env, 'SELECT id, project_id, number, revision, data FROM drawings WHERE data IS NOT NULL ORDER BY id LIMIT ?', limit) : []) {
    if (!room()) break;
    const mime = mimeOfUrl(r.data);
    const u8 = b64ToBytes(r.data);
    const name = (String(r.number || 'drawing').replace(/[^\w.-]+/g, '_') + (r.revision ? '_Rev_' + String(r.revision).replace(/[^\w.-]+/g, '_') : '')) + '.' + (EXT[mime] || 'bin');
    const put = await place('drawings/' + r.project_id + '/' + r.id + '/' + name, u8, mime);
    if (put.error) { fail('drawings', r.id, put.error); continue; }
    await env.DB.prepare('UPDATE drawings SET r2_key = ?, size = ?, data = NULL WHERE project_id = ? AND id = ?').bind(put.key, u8.length, r.project_id, r.id).run();
    moved++; bytes += u8.length; done.drawings++;
  }
  // 3. site photographs
  await ensurePhotoColumns(env).catch(() => {});
  for (const r of room() ? await rows(env, "SELECT id, project_id, mime, data FROM photos WHERE data IS NOT NULL AND data <> '' ORDER BY id LIMIT ?", limit) : []) {
    if (!room()) break;
    const mime = mimeOfUrl(r.data) || r.mime || 'image/jpeg';
    const u8 = b64ToBytes(r.data);
    const put = await place(photoKey(r.project_id, r.id, mime), u8, mime);
    if (put.error) { fail('photos', r.id, put.error); continue; }
    await env.DB.prepare("UPDATE photos SET file_key = ?, size = ?, data = '' WHERE project_id = ? AND id = ?").bind(put.key, u8.length, r.project_id, r.id).run();
    moved++; bytes += u8.length; done.photos++;
  }
  // 4. held drawings: the payload keeps the key, never the file
  for (const r of room() ? await rows(env, "SELECT id, project_id, filename, number, payload FROM quarantine WHERE payload LIKE '%data:%' ORDER BY id LIMIT ?", limit) : []) {
    if (!room()) break;
    const p = parse(r.payload, {});
    if (typeof p.data !== 'string' || !p.data.startsWith('data:')) continue;
    const mime = mimeOfUrl(p.data);
    const u8 = b64ToBytes(p.data);
    const name = safeKey(String(r.filename || r.number || 'drawing').replace(/[^\w.\- ]+/g, '_')) || 'drawing';
    const put = await place('drawings/' + r.project_id + '/held-' + r.id + '/' + name, u8, mime);
    if (put.error) { fail('held', r.id, put.error); continue; }
    delete p.data;
    p.r2_key = put.key; p.mime = mime; p.size = u8.length;
    await env.DB.prepare('UPDATE quarantine SET payload = ?, file_key = ? WHERE id = ?').bind(JSON.stringify(p), put.key, r.id).run();
    moved++; bytes += u8.length; done.held++;
  }
  // 5. templates kept inline
  for (const r of room() ? await rows(env, "SELECT id, project_id, doc_type, filename, blob FROM templates WHERE blob IS NOT NULL AND blob <> '' AND (r2_key IS NULL OR r2_key = '') ORDER BY id LIMIT ?", limit) : []) {
    if (!room()) break;
    const ext = (/\.(docx|xlsx|doc|xls)$/i.exec(String(r.filename || '')) || [, 'docx'])[1].toLowerCase();
    const u8 = b64ToBytes(r.blob);
    const put = await place('templates/' + r.project_id + '/' + (r.doc_type || 'doc') + '/' + r.id + '.' + ext, u8, ext === 'xlsx' || ext === 'xls'
      ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    if (put.error) { fail('templates', r.id, put.error); continue; }
    await env.DB.prepare('UPDATE templates SET r2_key = ?, blob = NULL WHERE id = ?').bind(put.key, r.id).run();
    moved++; bytes += u8.length; done.templates++;
  }
  const after = await planMove(env);
  return { ok: true, target, moved, bytes, by_source: done, failed, remaining: after.total, finished: after.total.count === 0 || after.total.count === failed.length };
}

/* ------------------------------------------------------------ capacity */

export async function databaseBytes(env) {
  const pg = await one(env, 'SELECT pg_database_size(current_database()) AS n');
  if (pg && pg.n != null) return { bytes: num(pg.n), how: 'pg_database_size' };
  const pc = await one(env, 'PRAGMA page_count');
  const ps = await one(env, 'PRAGMA page_size');
  if (pc && ps) return { bytes: num(Object.values(pc)[0]) * num(Object.values(ps)[0]), how: 'page_count × page_size' };
  return { bytes: null, how: 'not available on this database' };
}

export async function capacity(env) {
  await ensureFileIndex(env);
  const projects = (await rows(env, 'SELECT id, name, org_id, archived FROM projects')).filter((p) => !isTest(p.id));
  const orgs = Object.fromEntries((await rows(env, 'SELECT id, name FROM orgs')).map((o) => [o.id, o.name]));
  const by = (list, k = 'n') => Object.fromEntries(list.map((r) => [r.project_id, num(r[k])]));
  const dr = await rows(env, "SELECT project_id, COUNT(*) AS n, SUM(CASE WHEN status = 'current' THEN 1 ELSE 0 END) AS live FROM drawings GROUP BY project_id");
  const rec = await rows(env, 'SELECT project_id, COUNT(*) AS n FROM records GROUP BY project_id');
  const lib = await rows(env, 'SELECT project_id, COUNT(*) AS n FROM library GROUP BY project_id');
  const ph = await rows(env, 'SELECT project_id, COUNT(*) AS n FROM photos GROUP BY project_id');
  const last = await rows(env, 'SELECT project_id, MAX(at) AS t FROM audit WHERE project_id IS NOT NULL GROUP BY project_id');
  const obj = await rows(env, "SELECT project_id, area, driver, COUNT(*) AS n, SUM(size) AS b FROM stored_files WHERE driver <> 'database' GROUP BY project_id, area, driver");
  const L = await legacy(env);
  const inDb = {};
  for (const k of Object.keys(L)) for (const x of L[k]) {
    const p = x.project_id || '';
    inDb[p] = (inDb[p] || 0) + x.bytes;
  }
  const objBy = {};
  for (const r of obj) {
    const o = objBy[r.project_id || ''] || (objBy[r.project_id || ''] = { files: 0, bytes: 0, by_area: {} });
    o.files += num(r.n); o.bytes += num(r.b);
    o.by_area[r.area] = (o.by_area[r.area] || 0) + num(r.b);
  }
  const D = by(dr), Dl = by(dr, 'live'), R = by(rec), Lb = by(lib), P = by(ph);
  const lastAt = Object.fromEntries(last.map((r) => [r.project_id, r.t]));
  const list = projects.map((p) => ({
    id: p.id, name: p.name, company: orgs[p.org_id] || '', archived: !!num(p.archived),
    drawings: D[p.id] || 0, drawings_live: Dl[p.id] || 0, records: R[p.id] || 0, library: Lb[p.id] || 0, photos: P[p.id] || 0,
    bytes_object_store: (objBy[p.id] || {}).bytes || 0, files_object_store: (objBy[p.id] || {}).files || 0, by_area: (objBy[p.id] || {}).by_area || {},
    bytes_in_database: inDb[p.id] || 0,
    last_activity: lastAt[p.id] || null,
  })).sort((a, b) => (b.bytes_object_store + b.bytes_in_database) - (a.bytes_object_store + a.bytes_in_database));

  const db = await databaseBytes(env);
  const limitGb = num(env.DATABASE_LIMIT_GB) || 32;
  const limitBytes = limitGb * 1024 * 1024 * 1024;
  const fellBack = await one(env, "SELECT COUNT(*) AS n, SUM(size) AS b FROM stored_files WHERE fell_back = 1 AND driver = 'database'");
  const objTotal = obj.reduce((s, r) => ({ files: s.files + num(r.n), bytes: s.bytes + num(r.b) }), { files: 0, bytes: 0 });
  const driver = driverName(env);
  return {
    driver, driver_label: DRIVER_LABEL[driver],
    database: { bytes: db.bytes, how: db.how, limit_gb: limitGb, used_pct: db.bytes == null ? null : Math.round(db.bytes * 1000 / limitBytes) / 10,
      files_still_in_database: Object.values(L).reduce((s, l) => s + l.length, 0),
      bytes_files_in_database: Object.values(inDb).reduce((s, b) => s + b, 0) },
    object_store: objTotal,
    fell_back: { files: num(fellBack && fellBack.n), bytes: num(fellBack && fellBack.b) },
    projects: list,
  };
}
