// ATTACHMENTS — the files that hang off a record.
//
// A Work Inspection Request goes to the consultant "with all attachments", and
// until now the platform had none: the forms showed a file field that submitted
// the name of a file nobody could ever open again. This is that gap closed.
//
// An attachment belongs to one record on one project. The bytes go to the file
// store, so they follow the same route to Oracle as everything else; only the
// row describing them lives here, in ordinary SQL.

import { putFile, getFile, deleteFile, driverName } from './storage.js';

const nowISO = () => new Date().toISOString();
const uid = () => 'att_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const str = (v, n = 200) => String(v == null ? '' : v).slice(0, n);

export const MAX_ATTACHMENT = 25 * 1024 * 1024;        // 25 MB
export const MAX_PER_RECORD = 40;

// What a construction record actually carries. Anything executable is refused —
// a platform that emails a consultant a file it accepted without looking is a
// platform that delivers whatever someone uploaded to it.
export const ALLOWED = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'text/plain': 'txt', 'text/csv': 'csv',
  'application/zip': 'zip',
  'image/vnd.dwg': 'dwg', 'application/acad': 'dwg', 'image/vnd.dxf': 'dxf',
  'application/octet-stream': 'file',                  // what a browser calls a .dwg
};

const BLOCKED_EXT = /\.(exe|msi|bat|cmd|com|scr|pif|jar|js|mjs|vbs|ps1|sh|app|dmg|deb|rpm|html?|svg)$/i;

export function checkUpload(filename, mime, size) {
  const name = str(filename, 200).replace(/[\\/]/g, '_').trim();
  if (!name) return { error: 'that file has no name' };
  if (BLOCKED_EXT.test(name)) return { error: 'that kind of file cannot be attached' };
  if (!size) return { error: 'that file is empty' };
  if (size > MAX_ATTACHMENT) {
    return { error: 'that file is larger than 25 MB — send it as a drawing, or split it' };
  }
  const m = str(mime, 120).toLowerCase().split(';')[0].trim();
  if (m && !ALLOWED[m]) return { error: 'that kind of file cannot be attached' };
  return { ok: true, name, mime: m || 'application/octet-stream' };
}

export async function ensureAttachmentsTable(env) {
  try {
    await env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS attachments (
         id TEXT PRIMARY KEY, project_id TEXT NOT NULL, ref TEXT NOT NULL,
         filename TEXT, mime TEXT, size INTEGER, storage_key TEXT,
         uploaded_by TEXT, uploaded_at TEXT)`
    ).run();
    await env.DB.prepare(
      `CREATE INDEX IF NOT EXISTS idx_att_pr ON attachments(project_id, ref)`
    ).run();
    return true;
  } catch (e) { return false; }
}

export function humanSize(n) {
  const b = Number(n) || 0;
  if (b < 1024) return b + ' B';
  if (b < 1024 * 1024) return Math.round(b / 1024) + ' KB';
  return (b / (1024 * 1024)).toFixed(b < 10 * 1024 * 1024 ? 1 : 0) + ' MB';
}

export async function addAttachment(env, pid, ref, filename, mime, bytes, who) {
  if (!pid) return { error: 'which project?' };
  const r = str(ref, 60);
  if (!r) return { error: 'an attachment has to belong to something' };
  const u8 = new Uint8Array(bytes || []);
  const ok = checkUpload(filename, mime, u8.length);
  if (ok.error) return ok;

  await ensureAttachmentsTable(env);
  try {
    const n = await env.DB.prepare(`SELECT COUNT(*) AS n FROM attachments WHERE project_id = ? AND ref = ?`)
      .bind(pid, r).first('n');
    if ((n || 0) >= MAX_PER_RECORD) {
      return { error: 'that record already has ' + MAX_PER_RECORD + ' attachments' };
    }
  } catch (e) { /* the table was just made; carry on */ }

  const id = uid();
  const put = await putFile(env, 'attachments/' + pid + '/' + r + '/' + id, u8, ok.mime);
  if (put.error) return { error: put.error };

  try {
    await env.DB.prepare(
      `INSERT INTO attachments (id,project_id,ref,filename,mime,size,storage_key,uploaded_by,uploaded_at)
       VALUES (?,?,?,?,?,?,?,?,?)`
    ).bind(id, pid, r, ok.name, ok.mime, u8.length, put.key, str(who, 120), nowISO()).run();
  } catch (e) {
    // The row is what makes the file findable. Without it the bytes are litter.
    try { await deleteFile(env, put.key); } catch (e2) {}
    return { error: 'could not record that attachment' };
  }

  return {
    ok: true, id, ref: r, filename: ok.name, mime: ok.mime,
    size: u8.length, size_text: humanSize(u8.length), stored: put.driver,
  };
}

export async function listAttachments(env, pid, ref) {
  await ensureAttachmentsTable(env);
  try {
    const q = ref
      ? env.DB.prepare(
          `SELECT id, ref, filename, mime, size, uploaded_by, uploaded_at
             FROM attachments WHERE project_id = ? AND ref = ? ORDER BY uploaded_at, id`
        ).bind(pid, str(ref, 60))
      : env.DB.prepare(
          `SELECT id, ref, filename, mime, size, uploaded_by, uploaded_at
             FROM attachments WHERE project_id = ? ORDER BY uploaded_at DESC, id LIMIT 500`
        ).bind(pid);
    const { results } = await q.all();
    return (results || []).map((a) => ({ ...a, size_text: humanSize(a.size) }));
  } catch (e) { return []; }
}

// How many files each record carries, for the registers — one query, not one
// per row, because a register can be hundreds of lines long.
export async function attachmentCounts(env, pid) {
  await ensureAttachmentsTable(env);
  try {
    const { results } = await env.DB.prepare(
      `SELECT ref, COUNT(*) AS n FROM attachments WHERE project_id = ? GROUP BY ref`
    ).bind(pid).all();
    const out = {};
    for (const r of results || []) out[r.ref] = r.n;
    return out;
  } catch (e) { return {}; }
}

export async function getAttachment(env, pid, id) {
  await ensureAttachmentsTable(env);
  let row = null;
  try {
    row = await env.DB.prepare(`SELECT * FROM attachments WHERE id = ? AND project_id = ?`)
      .bind(str(id, 60), pid).first();
  } catch (e) { return null; }
  if (!row) return null;
  const f = await getFile(env, row.storage_key);
  if (!f) return null;
  return { bytes: f.bytes, mime: row.mime || f.mime, filename: row.filename, row };
}

export async function removeAttachment(env, pid, id) {
  await ensureAttachmentsTable(env);
  try {
    const row = await env.DB.prepare(`SELECT * FROM attachments WHERE id = ? AND project_id = ?`)
      .bind(str(id, 60), pid).first();
    if (!row) return { error: 'no such attachment' };
    await env.DB.prepare(`DELETE FROM attachments WHERE id = ? AND project_id = ?`)
      .bind(row.id, pid).run();
    try { await deleteFile(env, row.storage_key); } catch (e) {}
    return { ok: true, id: row.id, ref: row.ref };
  } catch (e) { return { error: 'could not remove that attachment' }; }
}

// Everything on a project, for the record. Used when a record is deleted and
// when a project is wound up.
export async function removeAllFor(env, pid, ref) {
  await ensureAttachmentsTable(env);
  try {
    const { results } = await env.DB.prepare(
      `SELECT id, storage_key FROM attachments WHERE project_id = ? AND ref = ?`
    ).bind(pid, str(ref, 60)).all();
    for (const r of results || []) { try { await deleteFile(env, r.storage_key); } catch (e) {} }
    await env.DB.prepare(`DELETE FROM attachments WHERE project_id = ? AND ref = ?`)
      .bind(pid, str(ref, 60)).run();
    return { ok: true, removed: (results || []).length };
  } catch (e) { return { error: 'could not clear those attachments' }; }
}

export function storageNote(env) {
  return driverName(env);
}
