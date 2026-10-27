// K2: site photographs in the file store.
//
// A photo used to be a base64 data URL in photos.data, in PostgreSQL. Spec
// §12 and §6: photographs are what fills the database, and they belong in the
// file store with everything else. A photo now goes to the store under
// photos/<project>/<id>.<ext> and the row keeps the key (photos.file_key);
// photos.data is left as '' (the column is NOT NULL in the schema). A photo
// stored before this change still reads from photos.data until the move out of
// the database (src/file-move.js) takes it across.

import { addColumns } from './db-cols.js';
import { putFile, getFile, b64ToBytes } from './storage.js';

let COLS = false;
export async function ensurePhotoColumns(env) {
  if (!COLS) COLS = await addColumns(env, 'photos', [['file_key', 'TEXT'], ['size', 'REAL']]);
  return COLS;
}

const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic', 'image/gif': 'gif' };
export const photoKey = (pid, id, mime) => 'photos/' + pid + '/' + id + '.' + (EXT[mime] || 'jpg');

// Store a photo sent as a data URL. Returns the key, or an error.
export async function storePhoto(env, pid, id, dataUrl) {
  const s = String(dataUrl || '');
  const mime = s.slice(5, s.indexOf(';'));
  const bytes = b64ToBytes(s);
  if (!bytes.length) return { error: 'the photo arrived empty' };
  const put = await putFile(env, photoKey(pid, id, mime), bytes, mime);
  return put.error ? { error: put.error } : { key: put.key, size: put.size, mime };
}

// A photo's bytes, wherever they are.
export async function photoBytes(env, row) {
  if (!row) return null;
  if (row.file_key) {
    const f = await getFile(env, row.file_key);
    return f ? { mime: row.mime || f.mime, bytes: f.bytes } : null;
  }
  const m = /^data:([^;,]+);base64,(.*)$/s.exec(String(row.data || ''));
  return m ? { mime: m[1], bytes: b64ToBytes(m[2]) } : null;
}
