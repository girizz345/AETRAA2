// Where a project's consultant templates live.
//
// One template per document type per project, replaced on re-upload. Bytes go
// to object storage when a bucket is bound, and otherwise ride in the database
// (a blank Word form is small), so template upload is never blocked by storage
// not being set up yet.

import { extractTokens } from './template.js';
import { putFile, getFile, deleteFile, bytesToB64, b64ToBytes, driverName } from './storage.js';

const nowISO = () => new Date().toISOString();
const uid = (p) => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const str = (v, n = 200) => String(v == null ? '' : v).slice(0, n);

// The document types a template can be attached to.
export const DOC_TYPES = {
  submittal: 'Submittal', ms: 'Method statement', material: 'Material submittal', rfi: 'RFI',
  wir: 'Inspection request (WIR)', mir: 'Material inspection (MIR)',
  ncr: 'NCR', variation: 'Variation', letter: 'Letter',
  ipc: 'Payment application (IPA/IPC)', transmittal: 'Transmittal',
  ptw: 'Permit to work',
};

const MAX_TEMPLATE = 5 * 1024 * 1024;         // 5 MB — a blank form is far smaller

// Kept exported here because callers already import them from this module.
// They live in the file store now, which is the one place that knows how bytes
// are carried.
export { b64ToBytes, bytesToB64 };

export async function ensureTemplatesTable(env) {
  try {
    await env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS templates (
         id TEXT PRIMARY KEY, project_id TEXT NOT NULL, doc_type TEXT,
         filename TEXT, r2_key TEXT, blob TEXT, tokens TEXT, size INTEGER,
         uploaded_by TEXT, uploaded_at TEXT)`
    ).run();
    await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_tpl_p ON templates(project_id)`).run();
    return true;
  } catch (e) { return false; }
}

// Save (or replace) the template for one document type on one project.
export async function saveTemplate(env, pid, docType, filename, bytes, who) {
  if (!pid) return { error: 'which project?' };
  if (!DOC_TYPES[docType]) return { error: 'unknown document type' };
  if (!bytes || !bytes.length) return { error: 'no file received' };
  if (bytes.length > MAX_TEMPLATE) return { error: 'that file is too large for a template' };

  // It must be a readable Word file, and we record what placeholders it holds.
  const t = extractTokens(bytes);
  if (t.error) return { error: t.error };

  await ensureTemplatesTable(env);
  const id = uid('tpl_');

  // Where the bytes go is the file store's business, not this module's. The
  // key is recorded; the driver that holds it can change under a live project.
  const key = 'templates/' + pid + '/' + docType + '/' + id + '.docx';
  const put = await putFile(env, key,
    bytes, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  if (put.error) return { error: put.error };

  try {
    const old = await env.DB.prepare(`SELECT r2_key FROM templates WHERE project_id = ? AND doc_type = ?`)
      .bind(pid, docType).first();
    if (old && old.r2_key) { try { await deleteFile(env, old.r2_key); } catch (e) {} }
    await env.DB.prepare(`DELETE FROM templates WHERE project_id = ? AND doc_type = ?`).bind(pid, docType).run();
    await env.DB.prepare(
      `INSERT INTO templates (id,project_id,doc_type,filename,r2_key,blob,tokens,size,uploaded_by,uploaded_at)
       VALUES (?,?,?,?,?,?,?,?,?,?)`
    ).bind(id, pid, docType, str(filename, 200), put.key, null,
           JSON.stringify(t.tokens || []), bytes.length, str(who, 120), nowISO()).run();
  } catch (e) { return { error: 'could not save the template' }; }

  return { ok: true, id, doc_type: docType, tokens: t.tokens || [], stored: put.driver };
}

export async function listTemplates(env, pid) {
  await ensureTemplatesTable(env);
  try {
    const { results } = await env.DB.prepare(
      `SELECT id, project_id, doc_type, filename, r2_key, tokens, size, uploaded_by, uploaded_at
         FROM templates WHERE project_id = ? ORDER BY doc_type`
    ).bind(pid).all();
    // A row with no key predates the file store and holds its bytes itself.
    // Anything else is in whichever store this environment is configured for.
    const here = driverName(env);
    return (results || []).map((r) => ({
      ...r, tokens: JSON.parse(r.tokens || '[]'), stored: r.r2_key ? here : 'database',
    }));
  } catch (e) { return []; }
}

// Fetch the template bytes for a document type, wherever they were put.
export async function getTemplateBytes(env, pid, docType) {
  await ensureTemplatesTable(env);
  let row = null;
  try {
    row = await env.DB.prepare(
      `SELECT * FROM templates WHERE project_id = ? AND doc_type = ?`
    ).bind(pid, docType).first();
  } catch (e) { return null; }
  if (!row) return null;
  if (row.r2_key) {
    const f = await getFile(env, row.r2_key);
    if (f) return { bytes: f.bytes, row };
  }
  // Templates uploaded before the file store existed kept their bytes in the
  // row itself. They are still served, so an upgrade loses nobody's form.
  if (row.blob) return { bytes: b64ToBytes(row.blob), row };
  return null;
}

export async function deleteTemplate(env, pid, docType) {
  await ensureTemplatesTable(env);
  try {
    const row = await env.DB.prepare(`SELECT * FROM templates WHERE project_id = ? AND doc_type = ?`)
      .bind(pid, docType).first();
    if (row && row.r2_key) {
      try { await deleteFile(env, row.r2_key); } catch (e) { /* the row still goes */ }
    }
    await env.DB.prepare(`DELETE FROM templates WHERE project_id = ? AND doc_type = ?`).bind(pid, docType).run();
  } catch (e) { return { error: 'could not remove the template' }; }
  return { ok: true };
}
