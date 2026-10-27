// CAD FILES — spec §6 "CAD files — DWG and DXF", phase 7.
//
// A CAD file is the SOURCE of a drawing sheet, not a register row of its own:
// a register listing ST-101.pdf and ST-101.dwg as two drawings is a broken
// register. So a CAD file is paired to its sheet by number and revision and
// filed as that sheet's native source, in a CAD package with its xrefs.
//
//   · DXF is read: number, revision, title and scale from the title block
//     (titleblock.js). It outranks the file name, and a disagreement between
//     the two is flagged.
//   · DWG is stored and paired by its file name; its contents are not read
//     without a converter (decision D9: DXF only in v1).
//   · Where no PDF of the sheet exists, the CAD file becomes the sheet and is
//     marked "no PDF issued" — nothing can be issued to a consultant from it.
//   · A CAD file at a later revision than the issued PDF means someone drew
//     past the issued sheet: reported, not resolved. The PDF stays the sheet.
//   · Xrefs travel with the sheet; one not in the drop is listed as missing.
//   · Until files are out of the database (spec §12), a CAD file over the
//     drawing limit is "recognised, not stored", so nobody believes a CAD set
//     is safely filed when it is not.
//
// No geometry is read: no quantities, areas or layers.

import { titleBlockFromDxf, mergeWithFilename } from './titleblock.js';
import { fromFileName, MAX_BYTES } from './drawings.js';

const nowISO = () => new Date().toISOString();
const uid = (p) => p + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const str = (v, n = 300) => String(v == null ? '' : v).slice(0, n);
const safeJson = (s, f) => { try { const v = JSON.parse(s || ''); return v == null ? f : v; } catch (e) { return f; } };

let ready = false;
export async function ensureCadTable(env) {
  if (ready) return true;
  try {
    await env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS cad_package (
         id TEXT PRIMARY KEY, project_id TEXT NOT NULL, drawing_id TEXT, number TEXT, revision TEXT,
         primary_key TEXT, filename TEXT, xref_keys TEXT, missing_xrefs TEXT, format TEXT, bytes INTEGER,
         title_block TEXT, flags TEXT, added_by TEXT, added_at TEXT)`
    ).run();
    ready = true;
    return true;
  } catch (e) { return false; }
}

// Whether a CAD file can be stored here at all (spec §12).
export function cadStorable(driver, size) {
  return driver !== 'database' || Number(size) <= MAX_BYTES;
}
export const NOT_STORED = 'recognised, not stored — exceeds the current file limit until drawings are moved to object storage';

// The xrefs a DXF names: BLOCK entries flagged as external references (group
// 70 bit 4 or 8), with their path on group 1.
export function dxfXrefs(text) {
  const lines = String(text || '').split(/\r\n|\r|\n/);
  const out = [];
  let inBlock = false, flags = 0, path = '', name = '';
  const flush = () => { if (inBlock && (flags & 4 || flags & 8) && (path || name)) out.push({ name, path }); inBlock = false; flags = 0; path = ''; name = ''; };
  for (let i = 0; i + 1 < lines.length; i += 2) {
    const code = lines[i].trim(), val = String(lines[i + 1] || '').trim();
    if (code === '0') { flush(); if (val.toUpperCase() === 'BLOCK') inBlock = true; continue; }
    if (!inBlock) continue;
    if (code === '70') flags = Number(val) || 0;
    else if (code === '1') path = val;
    else if (code === '2' && !name) name = val;
  }
  flush();
  const base = (p) => String(p).split(/[\\/]/).pop();
  return [...new Map(out.map((x) => [base(x.path || x.name).toLowerCase(), { name: x.name, file: base(x.path || x.name) }])).values()];
}

// What a CAD file says about itself.
export function readCad(filename, bytes) {
  const ext = (String(filename).match(/\.([a-z0-9]+)$/i) || [])[1] || '';
  const named = (() => { try { return fromFileName(filename) || {}; } catch (e) { return {}; } })();
  if (ext.toLowerCase() !== 'dxf') {
    return { format: 'dwg', number: named.number || '', revision: named.revision || '', title: named.title || '',
             read_from: 'file name', xrefs: [], note: 'DWG contents are not read without a converter (DXF is)' };
  }
  const text = new TextDecoder('latin1').decode(bytes);
  const face = (() => { try { return titleBlockFromDxf(text); } catch (e) { return null; } })();
  const merged = mergeWithFilename(face, named);
  return { format: 'dxf', number: merged.number || '', revision: merged.revision || '', title: merged.title || '',
           scale: merged.scale || '', read_from: face && (face.number || face.title) ? 'DXF title block' : 'file name',
           conflicts: merged.conflicts || [], xrefs: dxfXrefs(text), title_block: face ? { number: face.number, revision: face.revision, title: face.title, scale: face.scale } : null };
}

// A revision order good enough to say "later": letters, then numbers, then P/C prefixes.
export function laterRevision(a, b) {
  const k = (r) => { const s = String(r || '').toUpperCase().replace(/^REV\.?\s*/, ''); const m = /^([A-Z]*)(\d*)$/.exec(s); return m ? [m[1], Number(m[2] || 0)] : [s, 0]; };
  const [pa, na] = k(a), [pb, nb] = k(b);
  if (pa !== pb) return pa > pb;
  return na > nb;
}

// File one CAD item: package it, pair it to its sheet, or make it the sheet.
// `others` are the other CAD file names in the same drop (for the xrefs).
export async function fileCad(env, pid, item, bytes, fileKey, others, who, saveSheet) {
  await ensureCadTable(env);
  const cad = readCad(item.filename, bytes || new Uint8Array(0));
  if (!cad.number) return { error: 'no drawing number could be read from this CAD file — type it on the review screen' };
  const flags = [];
  if (cad.conflicts && cad.conflicts.length) flags.push('title block and file name disagree: ' + cad.conflicts.map((c) => c.field || c).join(', '));
  const present = new Set((others || []).map((n) => String(n).toLowerCase()));
  const missing = cad.xrefs.filter((x) => !present.has(x.file.toLowerCase())).map((x) => x.file);
  const found = cad.xrefs.filter((x) => present.has(x.file.toLowerCase())).map((x) => x.file);
  // The sheet: the live PDF of the same number.
  const sheet = await env.DB.prepare(
    "SELECT id, revision, r2_key, data, url FROM drawings WHERE project_id = ? AND number = ? AND status IN ('current','pending') ORDER BY uploaded_at DESC LIMIT 1"
  ).bind(pid, cad.number).first().catch(() => null);
  let drawingId = sheet ? sheet.id : null;
  if (sheet && cad.revision && sheet.revision && laterRevision(cad.revision, sheet.revision)) {
    flags.push('the CAD file is at rev ' + cad.revision + ', past the issued sheet (rev ' + sheet.revision + '): the issued PDF stays the sheet');
  }
  if (!sheet) {
    // No PDF: the CAD file becomes the sheet, marked as such.
    const r = await saveSheet({ number: cad.number, revision: cad.revision, title: cad.title, kind: item.kind || 'other', r2_key: fileKey,
      filename: item.filename });
    if (r && r.error) return r;
    drawingId = r && r.id;
    flags.push('no PDF issued — nothing can be issued to a consultant from a CAD file');
  }
  const id = uid('cad');
  await env.DB.prepare(
    `INSERT INTO cad_package (id, project_id, drawing_id, number, revision, primary_key, filename, xref_keys, missing_xrefs, format, bytes, title_block, flags, added_by, added_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).bind(id, pid, drawingId, cad.number, cad.revision || null, fileKey, str(item.filename, 300), JSON.stringify(found), JSON.stringify(missing),
         cad.format, bytes ? bytes.length : 0, JSON.stringify(cad.title_block), JSON.stringify(flags), str(who, 120), nowISO()).run();
  return { ok: true, id, drawing_id: drawingId, paired: !!sheet, missing_xrefs: missing, flags,
           where: sheet ? 'the CAD package of ' + cad.number + (missing.length ? ' (' + missing.length + ' xrefs missing)' : '')
                        : 'the drawing register as ' + cad.number + ' (no PDF issued)' };
}

export async function listCad(env, pid) {
  await ensureCadTable(env);
  const r = await env.DB.prepare('SELECT * FROM cad_package WHERE project_id = ? ORDER BY number, added_at').bind(pid).all();
  return (r.results || []).map((x) => ({ ...x, xref_keys: safeJson(x.xref_keys, []), missing_xrefs: safeJson(x.missing_xrefs, []),
    title_block: safeJson(x.title_block, null), flags: safeJson(x.flags, []) }));
}
