// THE PROJECT LIBRARY — where a document goes when it is not a drawing and not
// a workflow record.
//
// Until now the platform had four places a document could land: the drawing
// register, a record in the workflow engine, an attachment hanging off a
// record, and the template store. A contract belongs to none of them. Nor does
// a performance bond, an insurance policy, an O&M manual, a warranty, a
// standalone specification or a survey report — all real, all needed, none of
// them a drawing or something with an approval ladder.
//
// So they had nowhere to go, and "every document has a destination" could not
// be true. This is that destination: a filed document with a class, a title, a
// date, a reference and its file. No workflow, no approval, no reply-by — a
// filing cabinet that is searchable, exportable and linkable.
//
// What it deliberately is NOT: a general document store. Anything with a
// register of its own belongs in that register, where its dates are watched.

import { putFile, getFile, deleteFile } from './storage.js';

const nowISO = () => new Date().toISOString();
const uid = () => 'lib_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const str = (v, n = 300) => String(v == null ? '' : v).slice(0, n);

// The classes, and what each is for. Narrower than the fourteen document
// families: a family says what a file IS on the way in, a class says which
// shelf it sits on afterwards.
export const CLASSES = {
  contract: 'Contract & conditions',
  bond: 'Bond / guarantee',
  insurance: 'Insurance',
  specification: 'Specification',
  payment: 'Payment application / certificate',
  o_and_m: 'O&M manual',
  warranty: 'Warranty',
  survey: 'Survey / investigation',
  photo: 'Photograph',
  report: 'Report / correspondence',
  other: 'Other',
};

export const MAX_LIBRARY_BYTES = 25 * 1024 * 1024;         // as an attachment

let ready = false;
export async function ensureLibraryTable(env) {
  if (ready) return true;
  try {
    await env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS library (
         id TEXT PRIMARY KEY, project_id TEXT NOT NULL, org_id TEXT,
         class TEXT, title TEXT, reference TEXT, doc_date TEXT,
         filename TEXT, mime TEXT, bytes INTEGER, sha256 TEXT, file_key TEXT,
         added_by TEXT, added_at TEXT, source TEXT,
         links TEXT, note TEXT, language TEXT, unread_reason TEXT)`
    ).run();
    await env.DB.prepare(
      `CREATE INDEX IF NOT EXISTS idx_library_project ON library(project_id, class)`
    ).run();
    ready = true;
    return true;
  } catch (e) { return false; }
}

function shape(r) {
  let links = [];
  try { links = JSON.parse(r.links || '[]'); } catch (e) {}
  return {
    id: r.id, project_id: r.project_id, org_id: r.org_id || null,
    class: r.class, class_label: CLASSES[r.class] || r.class,
    title: r.title, reference: r.reference || null, doc_date: r.doc_date || null,
    filename: r.filename, mime: r.mime || null, bytes: r.bytes || 0,
    sha256: r.sha256 || null, has_file: !!r.file_key,
    added_by: r.added_by, added_at: r.added_at, source: r.source || 'upload',
    links: Array.isArray(links) ? links : [],
    note: r.note || null, language: r.language || null,
    // A document filed but not read — a legacy .doc, an Arabic-only PDF. It is
    // findable, and the reason it was not read is on it rather than implied.
    unread_reason: r.unread_reason || null,
  };
}

async function sha256Hex(bytes) {
  try {
    const d = await crypto.subtle.digest('SHA-256', bytes);
    return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch (e) { return null; }
}

// File a document. `bytes` is a Uint8Array; the file store decides where the
// bytes actually land, so this carries across when they move off the database.
export async function addDocument(env, pid, doc, who) {
  const ok = await ensureLibraryTable(env);
  if (!ok) return { error: 'the library is not available on this database' };

  const cls = CLASSES[doc.class] ? doc.class : 'other';
  const title = str(doc.title, 300).trim();
  if (!title) return { error: 'that document needs a title' };

  const bytes = doc.bytes instanceof Uint8Array ? doc.bytes : null;
  if (bytes && bytes.length > MAX_LIBRARY_BYTES) {
    return { error: `that file is ${Math.round(bytes.length / 1048576)} MB and the limit is ` +
                    `${Math.round(MAX_LIBRARY_BYTES / 1048576)} MB` };
  }

  const id = uid();
  let key = null, hash = null;
  if (bytes) {
    hash = await sha256Hex(bytes);
    // The same file already on this project is not filed twice. Dropping a
    // folder again is the normal case, not an error.
    try {
      const dup = await env.DB.prepare(
        'SELECT id, title FROM library WHERE project_id = ? AND sha256 = ?'
      ).bind(pid, hash).first();
      if (dup) return { ok: true, id: dup.id, already: true, title: dup.title };
    } catch (e) { /* no index yet */ }
    key = 'library/' + pid + '/' + id;
    const put = await putFile(env, key, bytes, doc.mime || 'application/octet-stream');
    if (!put || put.error) return { error: 'that file could not be stored' };
  }

  try {
    await env.DB.prepare(
      `INSERT INTO library (id, project_id, org_id, class, title, reference, doc_date,
         filename, mime, bytes, sha256, file_key, added_by, added_at, source, links, note,
         language, unread_reason)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
    ).bind(
      id, pid, str(doc.org_id, 60) || null, cls, title,
      str(doc.reference, 120) || null, str(doc.doc_date, 10) || null,
      str(doc.filename, 300) || title, str(doc.mime, 120) || null,
      bytes ? bytes.length : 0, hash, key,
      str((who && who.name) || who || '', 120), nowISO(),
      doc.source === 'intake' ? 'intake' : 'upload',
      JSON.stringify(Array.isArray(doc.links) ? doc.links.slice(0, 50) : []),
      str(doc.note, 600) || null,
      str(doc.language, 20) || null,
      str(doc.unread_reason, 200) || null
    ).run();
  } catch (e) {
    if (key) { try { await deleteFile(env, key); } catch (e2) {} }
    return { error: 'could not file that document' };
  }
  return { ok: true, id, class: cls, title };
}

export async function listLibrary(env, pid, opts = {}) {
  const ok = await ensureLibraryTable(env);
  if (!ok) return null;
  const where = ['project_id = ?'], args = [pid];
  if (opts.class && CLASSES[opts.class]) { where.push('class = ?'); args.push(opts.class); }
  try {
    const { results } = await env.DB.prepare(
      `SELECT id, project_id, org_id, class, title, reference, doc_date, filename, mime,
              bytes, sha256, file_key, added_by, added_at, source, links, note, language, unread_reason
         FROM library WHERE ${where.join(' AND ')} ORDER BY added_at DESC`
    ).bind(...args).all();
    return (results || []).map(shape);
  } catch (e) { return null; }
}

export async function getDocument(env, pid, id) {
  const ok = await ensureLibraryTable(env);
  if (!ok) return null;
  try {
    const r = await env.DB.prepare('SELECT * FROM library WHERE project_id = ? AND id = ?')
      .bind(pid, String(id)).first();
    return r ? shape(r) : null;
  } catch (e) { return null; }
}

export async function documentFile(env, pid, id) {
  try {
    const r = await env.DB.prepare('SELECT file_key, mime, filename FROM library WHERE project_id = ? AND id = ?')
      .bind(pid, String(id)).first();
    if (!r || !r.file_key) return null;
    const bytes = await getFile(env, r.file_key);
    if (!bytes) return null;
    return { bytes, mime: r.mime || 'application/octet-stream', filename: r.filename || 'document' };
  } catch (e) { return null; }
}

// Counts by class, for the screen and for the "what this project holds" view.
export async function librarySummary(env, pid) {
  const rows = await listLibrary(env, pid);
  if (rows === null) return null;
  const by = {};
  let bytes = 0;
  for (const r of rows) {
    by[r.class] = (by[r.class] || 0) + 1;
    bytes += r.bytes || 0;
  }
  return { total: rows.length, bytes, by_class: by, classes: CLASSES };
}
