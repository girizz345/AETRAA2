// Where a project's consultant templates live.
//
// One template per document type per project, replaced on re-upload. Bytes go
// to object storage when a bucket is bound, and otherwise ride in the database
// (a blank Word form is small), so template upload is never blocked by storage
// not being set up yet.

import { extractTokens, formatOf, FORMATS } from './template.js';
import { putFile, getFile, deleteFile, bytesToB64, b64ToBytes, driverName } from './storage.js';
import { RECORD_TYPES } from './records.js';
import { captureSignBoxes, ensureSignColumn } from './template-forms.js';

const nowISO = () => new Date().toISOString();
const uid = (p) => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const str = (v, n = 200) => String(v == null ? '' : v).slice(0, n);

// The document types a template can be attached to.
//
// One slot per form the consultant issues. The two transmittals are separate
// because they are separate forms — a drawing transmittal lists drawing numbers
// and revisions, a document transmittal lists document descriptions and copies,
// and a consultant who receives the wrong one sends it back.
export const DOC_TYPES = {
  submittal: 'Submittal', ms: 'Method statement', material: 'Material submittal', rfi: 'RFI',
  wir: 'Inspection request (WIR/RFIA)', mir: 'Material inspection (MIR)',
  ncr: 'NCR', variation: 'Variation', letter: 'Letter',
  ipc: 'Payment application (IPA/IPC)',
  transmittal: 'Transmittal of documents', transmittal_dwg: 'Transmittal of drawings',
  cvi: 'Confirmation of verbal instruction (CVI)',
  ptw: 'Permit to work',
  // K13 (v5 A11): the two series of minutes, each on its own template.
  minutes_consultant: 'Minutes — the consultant’s meetings', minutes_company: 'Minutes — internal meetings (company template)',
};

// A consultant's Excel form carries the two company logos, so it is heavier
// than a blank Word page: the ICONIC set runs to a quarter of a megabyte each.
const MAX_TEMPLATE = 5 * 1024 * 1024;

// Which format a stored template is, read off the key or the name it was
// uploaded under. Only ever one of the two; anything else never got in.
const formatFromName = (n) => (/\.xlsx$/i.test(String(n || '')) ? 'xlsx'
  : /\.docx$/i.test(String(n || '')) ? 'docx' : null);

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

  // It must be a readable Word or Excel form, and we record what placeholders
  // it holds.
  const t = extractTokens(bytes);
  if (t.error) return { error: t.error };
  const fmt = FORMATS[t.format] || FORMATS.docx;

  await ensureTemplatesTable(env);
  const id = uid('tpl_');

  // Where the bytes go is the file store's business, not this module's. The
  // key is recorded; the driver that holds it can change under a live project.
  // The extension on the key is how a template uploaded before this module
  // knew about Excel still reads back as the Word form it is.
  const key = 'templates/' + pid + '/' + docType + '/' + id + '.' + fmt.ext;
  const put = await putFile(env, key, bytes, fmt.mime);
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

  // Read where the form is signed, the moment it is assigned (template-forms.js).
  let signs = null;
  try {
    await ensureSignColumn(env);
    signs = captureSignBoxes(bytes, (RECORD_TYPES[docType] || {}).wf || []);
    await env.DB.prepare('UPDATE templates SET sign_map = ? WHERE id = ?').bind(JSON.stringify(signs), id).run();
  } catch (e) { /* the template stands; signature boxes can be set by hand */ }

  // A FORM WITH NO PLACEHOLDERS IS THE QUIET FAILURE WORTH NAMING. It uploads
  // cleanly, it looks set up, and then every document issued from it carries
  // whatever was typed into the blank the consultant sent — most often the
  // project and reference of whatever job the form was last used on.
  const tokens = t.tokens || [];
  const warning = tokens.length ? null
    : 'This form holds no {{placeholders}}, so nothing will be filled in — every '
      + 'document issued from it will come out exactly as uploaded. Type {{ref}}, '
      + '{{date}}, {{project_name}} and the rest into the cells they belong in.';
  return { ok: true, id, doc_type: docType, format: t.format, tokens, warning, stored: put.driver,
    sign_boxes: signs ? signs.suggested.length : 0 };
}

export async function listTemplates(env, pid) {
  await ensureTemplatesTable(env);
  try {
    const { results } = await env.DB.prepare(
      `SELECT * FROM templates WHERE project_id = ? ORDER BY doc_type`
    ).bind(pid).all();
    // A row with no key predates the file store and holds its bytes itself.
    // Anything else is in whichever store this environment is configured for.
    const here = driverName(env);
    return (results || []).map(({ blob, ...r }) => ({
      ...r, tokens: JSON.parse(r.tokens || '[]'), sign_map: (() => { try { return JSON.parse(r.sign_map || 'null'); } catch (e) { return null; } })(), stored: r.r2_key ? here : 'database',
      format: formatFromName(r.r2_key) || formatFromName(r.filename) || 'docx',
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
