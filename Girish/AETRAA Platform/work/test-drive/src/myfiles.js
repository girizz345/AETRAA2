// MY FILES — each person's own private file space, like any drive.
//
// A project's documents are shared with its team (src/library.js,
// src/attachments.js). These are not: they belong to one person, are seen by
// that person only, and follow them across projects. From here a file can be
// attached to a record on a project they are on, which copies it there.
//
// THE BYTES go to the platform's file store (src/storage.js): Azure Blob on the
// live server (AZURE_STORAGE_*), else S3-compatible storage, else the database.
// Each file's key is myfiles/<company>/<person>/<id> — nothing in the key comes
// from the file's own name.
//
// WHO SEES WHAT. Every query here carries the owner's id, so a file id from
// somebody else's list opens nothing, renames nothing, deletes nothing.
//
// WHAT MAY BE KEPT. Anything a person works with — drawings, models (RVT, IFC,
// NWD, DWG …), spreadsheets, photographs, archives — except what a browser or
// an operating system would run: programs, scripts, web pages and SVG. Nothing
// is ever shown inside the platform's own pages except a PDF or a picture.

import { putFile, getFile, deleteFile } from './storage.js';

const nowISO = () => new Date().toISOString();
const uid = () => 'mf_' + crypto.randomUUID().replace(/-/g, '').slice(0, 16);

export const MYFILES_DEFAULT_QUOTA_MB = 2048;
export const MYFILES_DEFAULT_MAX_MB = 100;

const BLOCKED = /\.(exe|msi|bat|cmd|com|scr|pif|jar|js|mjs|cjs|vbs|vbe|wsf|ps1|psm1|sh|bash|app|dmg|deb|rpm|apk|html?|xhtml|svgz?|php|asp|aspx|jsp|hta|lnk|reg|dll|so|py)$/i;

// What may open in the browser (always with nosniff): a PDF and a picture.
const INLINE = { pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif' };

export const quotaBytes = (env) => Math.max(1, Number(env && env.MYFILES_QUOTA_MB) || MYFILES_DEFAULT_QUOTA_MB) * 1048576;
export const maxFileBytes = (env) => Math.max(1, Number(env && env.MYFILES_MAX_MB) || MYFILES_DEFAULT_MAX_MB) * 1048576;

let READY = false;
export async function ensureMyFiles(env) {
  if (READY) return;
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS user_files (
       id         TEXT PRIMARY KEY,
       user_id    TEXT NOT NULL,
       org_id     TEXT,
       folder     TEXT NOT NULL,
       name       TEXT NOT NULL,
       mime       TEXT,
       size       INTEGER NOT NULL,
       sha256     TEXT,
       file_key   TEXT NOT NULL,
       created_at TEXT,
       updated_at TEXT
     )`
  ).run();
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_user_files_owner ON user_files (user_id, folder)').run();
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS user_folders (
       user_id    TEXT NOT NULL,
       path       TEXT NOT NULL,
       created_at TEXT,
       PRIMARY KEY (user_id, path)
     )`
  ).run();
  READY = true;
}

/* ------------------------------------------------------------- names */

// A folder is a path: "/", "/Site photos", "/Site photos/Level 3".
export function cleanFolder(v) {
  const parts = String(v == null ? '/' : v).split('/')
    .map((s) => s.replace(/[\u0000-\u001f\\:*?"<>|]/g, '').trim().slice(0, 80))
    .filter((s) => s && s !== '.' && s !== '..');
  if (parts.length > 12) return null;
  return '/' + parts.join('/');
}

export function cleanName(v) {
  const n = String(v || '').replace(/[\u0000-\u001f\\/:*?"<>|]/g, '_').replace(/^\.+/, '').trim().slice(0, 180);
  return n || null;
}

const extOf = (name) => ((/\.([a-z0-9]{1,8})$/i.exec(name) || [])[1] || '').toLowerCase();

export function fileProblem(name, size, env) {
  if (!name) return 'That file has no name.';
  if (BLOCKED.test(name)) return 'That kind of file (programs, scripts, web pages) cannot be kept here.';
  if (!size) return 'That file is empty.';
  if (size > maxFileBytes(env)) return 'That file is larger than ' + Math.round(maxFileBytes(env) / 1048576) + ' MB.';
  return null;
}

// What the browser is told a file is. A PDF or a picture may open in a tab; anything else downloads.
export function serveAs(name) {
  const e = extOf(name);
  return INLINE[e] ? { mime: INLINE[e], inline: true } : { mime: 'application/octet-stream', inline: false };
}

async function sha256hex(bytes) {
  const h = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/* -------------------------------------------------------------- reading */

export async function usage(env, uidv) {
  await ensureMyFiles(env);
  const r = await env.DB.prepare('SELECT COALESCE(SUM(size), 0) AS used, COUNT(*) AS n FROM user_files WHERE user_id = ?').bind(uidv).first();
  return { used: Number(r && r.used) || 0, files: Number(r && r.n) || 0, quota: quotaBytes(env) };
}

export async function listFolder(env, uidv, folder) {
  await ensureMyFiles(env);
  const f = cleanFolder(folder);
  if (!f) return { error: 'That folder path is too deep.' };
  const { results: files } = await env.DB.prepare(
    'SELECT id, folder, name, mime, size, created_at, updated_at FROM user_files WHERE user_id = ? AND folder = ? ORDER BY name'
  ).bind(uidv, f).all();
  // Sub-folders: those made empty, and those that have files somewhere below.
  const prefix = f === '/' ? '/' : f + '/';
  const { results: deeper } = await env.DB.prepare(
    `SELECT DISTINCT folder AS path FROM user_files WHERE user_id = ? AND folder LIKE ?
     UNION SELECT path FROM user_folders WHERE user_id = ? AND path LIKE ?`
  ).bind(uidv, prefix + '%', uidv, prefix + '%').all();
  const subs = new Set();
  for (const r of deeper || []) {
    const rest = String(r.path).slice(prefix.length);
    if (rest) subs.add(rest.split('/')[0]);
  }
  return { folder: f, folders: [...subs].sort((a, b) => a.localeCompare(b)), files: files || [], usage: await usage(env, uidv) };
}

export async function findFiles(env, uidv, q) {
  await ensureMyFiles(env);
  const needle = '%' + String(q || '').toLowerCase().replace(/[%_]/g, '').slice(0, 80) + '%';
  const { results } = await env.DB.prepare(
    'SELECT id, folder, name, mime, size, created_at, updated_at FROM user_files WHERE user_id = ? AND LOWER(name) LIKE ? ORDER BY updated_at DESC LIMIT 200'
  ).bind(uidv, needle).all();
  return results || [];
}

export async function getOwnFile(env, uidv, id) {
  await ensureMyFiles(env);
  return env.DB.prepare('SELECT * FROM user_files WHERE id = ? AND user_id = ?').bind(String(id || ''), uidv).first();
}

export async function readOwnFile(env, uidv, id) {
  const row = await getOwnFile(env, uidv, id);
  if (!row) return null;
  const f = await getFile(env, row.file_key);
  const bytes = f && (f.bytes || f);
  if (!bytes || !bytes.length) return { row, bytes: null };
  return { row, bytes };
}

/* -------------------------------------------------------------- writing */

export async function addFile(env, me, folder, name, bytes) {
  await ensureMyFiles(env);
  const f = cleanFolder(folder);
  if (!f) return { error: 'That folder path is too deep.' };
  const n = cleanName(name);
  const bad = fileProblem(n, bytes ? bytes.length : 0, env);
  if (bad) return { error: bad };
  const u = await usage(env, me.id);
  if (u.used + bytes.length > u.quota) {
    return { error: 'Your files would be over your ' + Math.round(u.quota / 1048576) + ' MB. Delete some first.', quota: true };
  }
  // The same name in the same folder is replaced, as a drive does.
  const same = await env.DB.prepare('SELECT id, file_key FROM user_files WHERE user_id = ? AND folder = ? AND name = ?')
    .bind(me.id, f, n).first();
  const id = same ? same.id : uid();
  const key = 'myfiles/' + (me.org_id || 'none') + '/' + me.id + '/' + id + '-' + Date.now().toString(36);
  const put = await putFile(env, key, bytes, serveAs(n).mime);
  if (!put || put.error) return { error: 'The file could not be stored. Try again.' };
  const fileKey = put.key || key;
  const at = nowISO();
  if (same) {
    await env.DB.prepare('UPDATE user_files SET file_key = ?, size = ?, sha256 = ?, mime = ?, updated_at = ? WHERE id = ? AND user_id = ?')
      .bind(fileKey, bytes.length, await sha256hex(bytes), serveAs(n).mime, at, id, me.id).run();
    try { await deleteFile(env, same.file_key); } catch (e) { /* the old bytes; the record now points at the new */ }
  } else {
    await env.DB.prepare(
      `INSERT INTO user_files (id, user_id, org_id, folder, name, mime, size, sha256, file_key, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`
    ).bind(id, me.id, me.org_id || null, f, n, serveAs(n).mime, bytes.length, await sha256hex(bytes), fileKey, at, at).run();
  }
  return { ok: true, id, folder: f, name: n, size: bytes.length, replaced: !!same };
}

export async function renameFile(env, uidv, id, name) {
  const row = await getOwnFile(env, uidv, id);
  if (!row) return { error: 'No such file.' };
  const n = cleanName(name);
  if (!n) return { error: 'Give it a name.' };
  if (BLOCKED.test(n)) return { error: 'That kind of name (a program or script) cannot be used.' };
  const clash = await env.DB.prepare('SELECT id FROM user_files WHERE user_id = ? AND folder = ? AND name = ? AND id != ?')
    .bind(uidv, row.folder, n, row.id).first();
  if (clash) return { error: 'There is already a file called that in this folder.' };
  await env.DB.prepare('UPDATE user_files SET name = ?, mime = ?, updated_at = ? WHERE id = ? AND user_id = ?')
    .bind(n, serveAs(n).mime, nowISO(), row.id, uidv).run();
  return { ok: true };
}

export async function moveFile(env, uidv, id, folder) {
  const row = await getOwnFile(env, uidv, id);
  if (!row) return { error: 'No such file.' };
  const f = cleanFolder(folder);
  if (!f) return { error: 'That folder path is too deep.' };
  const clash = await env.DB.prepare('SELECT id FROM user_files WHERE user_id = ? AND folder = ? AND name = ? AND id != ?')
    .bind(uidv, f, row.name, row.id).first();
  if (clash) return { error: 'There is already a file called that in that folder.' };
  await env.DB.prepare('UPDATE user_files SET folder = ?, updated_at = ? WHERE id = ? AND user_id = ?').bind(f, nowISO(), row.id, uidv).run();
  return { ok: true };
}

export async function removeFile(env, uidv, id) {
  const row = await getOwnFile(env, uidv, id);
  if (!row) return { error: 'No such file.' };
  await env.DB.prepare('DELETE FROM user_files WHERE id = ? AND user_id = ?').bind(row.id, uidv).run();
  try { await deleteFile(env, row.file_key); } catch (e) { /* the record is gone; the store tidies later */ }
  return { ok: true };
}

export async function makeFolder(env, uidv, path) {
  await ensureMyFiles(env);
  const f = cleanFolder(path);
  if (!f || f === '/') return { error: 'Give the folder a name.' };
  try {
    await env.DB.prepare('INSERT INTO user_folders (user_id, path, created_at) VALUES (?,?,?)').bind(uidv, f, nowISO()).run();
  } catch (e) { /* already there */ }
  return { ok: true, path: f };
}

// Only an empty folder is removed, so nothing is deleted by accident.
export async function removeFolder(env, uidv, path) {
  await ensureMyFiles(env);
  const f = cleanFolder(path);
  if (!f || f === '/') return { error: 'That folder cannot be removed.' };
  const has = await env.DB.prepare('SELECT 1 AS x FROM user_files WHERE user_id = ? AND (folder = ? OR folder LIKE ?) LIMIT 1')
    .bind(uidv, f, f + '/%').first();
  if (has) return { error: 'That folder still has files in it. Move or delete them first.' };
  await env.DB.prepare('DELETE FROM user_folders WHERE user_id = ? AND (path = ? OR path LIKE ?)').bind(uidv, f, f + '/%').run();
  return { ok: true };
}

// A person leaving takes nothing with them, and leaves nothing behind.
export async function removeAllFor(env, uidv) {
  await ensureMyFiles(env);
  const { results } = await env.DB.prepare('SELECT id, file_key FROM user_files WHERE user_id = ?').bind(uidv).all();
  for (const r of results || []) { try { await deleteFile(env, r.file_key); } catch (e) { /* best effort */ } }
  await env.DB.prepare('DELETE FROM user_files WHERE user_id = ?').bind(uidv).run();
  await env.DB.prepare('DELETE FROM user_folders WHERE user_id = ?').bind(uidv).run();
  return { ok: true, removed: (results || []).length };
}
