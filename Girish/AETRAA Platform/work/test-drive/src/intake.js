// PROJECT INTAKE — drop a folder, and the project sets itself up.
//
// Four steps, and only the fourth writes anything:
//
//   1 DROP     a folder, sub-folders and all
//   2 SCAN     classify and extract — NOTHING is written to any register
//   3 REVIEW   five groups, on one screen
//   4 COMMIT   files what was confirmed; conflicts go to the held queue
//
// THE GUARANTEE THAT MATTERS: scan writes no register row. It records what it
// found as intake_item rows and stores the bytes, and that is all. Until a
// person presses commit, the project is exactly as it was. There is a test that
// asserts this by counting register rows either side of a scan, because it is
// the promise the whole screen rests on and it would be easy to break by
// accident while adding a routing case.
//
// COMMIT IS RESUMABLE, NOT ATOMIC. Four hundred drawings cannot be one
// transaction on a 1 GB server. If it stops at item 300, the first 299 are
// filed and re-running the same folder picks up where it stopped — which is
// also why every item carries its sha256: an identical file already filed on
// this project is recognised rather than duplicated.
//
// A DROP IS NEVER THE WHOLE PROJECT AGAIN. After the first, a drop is a delta.
// Twelve drawings arriving in month eight does not imply the other 388 were
// withdrawn, and nothing is ever removed, superseded or closed because it was
// absent from a later drop. This is an in-tray, not a sync tool — which is
// exactly the assumption a sync tool gets wrong.

import { classifyFile, groupOf, summarise, FAMILIES, templateTypeOf } from './intake-classify.js';
import { DOC_TYPES } from './templates-store.js';
import { checkIncoming, ensureGateColumns, readable } from './gate.js';
import { pdfText } from './pdf-text.js';
import { addColumns } from './db-cols.js';
import { readPdfSheets, pdfPage, textKey, validNumber } from './sheet-reader.js';
import { authorityFromPath, authorityName, authorityCode, parseStamp, STAMP_PROMPT, STAMP_SYSTEM } from './authority-sheet.js';
import { callModel, aiEnabled, AI_OFF_MESSAGE } from './ai.js';
import { getFile, deleteFile } from './storage.js';
import { ensureAuthorityColumns } from './drawings.js';
import { hold, getHeld } from './quarantine.js';
import { addDocument, CLASSES } from './library.js';
import { putFile } from './storage.js';
import { readTitleBlock, mergeWithFilename, titleBlockFromDxf } from './titleblock.js';
import { kindFrom } from './drawing-classify.js';
import { SECTION_BY_ID } from './sections.js';
import { fromFileName } from './drawings.js';
import { probe as probeFile } from './intake-probe.js';
import { buildReport, reportPdf } from './intake-report.js';
import { cadStorable, NOT_STORED } from './cad.js';
import { driverName } from './storage.js';
import { unzipSync } from 'fflate';

// Reading a title block must never cost the operator the rest of the folder: a
// malformed PDF in four hundred is normal, and the file still has to be filed
// by its name. Every failure degrades to "nothing found".
function safeFace(filename, bytes) {
  try { return readTitleBlock(filename, bytes); } catch (e) { return null; }
}

function safeName(filename) {
  try { return fromFileName(filename) || {}; } catch (e) { return {}; }
}

function safeDxfFace(dxfText) {
  try { return titleBlockFromDxf(dxfText); } catch (e) { return null; }
}

const nowISO = () => new Date().toISOString();
const uid = (p) => p + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const str = (v, n = 300) => String(v == null ? '' : v).slice(0, n);

// Which intake family a library class belongs to, so a file dropped on a
// library section is routed by the same code path as one the engine placed
// there itself — one route in, not two that can drift apart.
const FAMILY_FOR_CLASS = {
  contract: 'contract', bond: 'contract', insurance: 'contract',
  specification: 'specification', payment: 'commercial',
  o_and_m: 'manual', warranty: 'manual',
  survey: 'report', photo: 'photo', report: 'report', other: 'unknown',
};
const familyForClass = (cls) => FAMILY_FOR_CLASS[cls] || 'unknown';

// What the gate reads of a file whose probe gives no text. A Primavera .xer is
// plain text, so its PROJECT table (the programme's project ID) is read directly.
// A drawing or contract PDF is read with pdf.js (pdf-text.js), annotations
// included, because its words are not in the raw bytes the probe sees.
async function gateText(family, filename, bytes, probe) {
  if (!bytes || !bytes.length) return (probe && probe.text) || '';
  if (family === 'programme') {
    try { return new TextDecoder('latin1').decode(bytes.subarray(0, 2000000)); } catch (e) { return ''; }
  }
  if ((family === 'drawing' || family === 'contract') && /\.pdf$/i.test(String(filename || ''))) {
    return pdfText(bytes, { pages: 2 });
  }
  return (probe && probe.text) || '';
}

// A drawing number, loosely: letters and digits with a separator, no spaces,
// no colon. Rejects what title blocks hand back by mistake — a scale ("1:75"),
// a paper size ("A1"), a title ("ALUMINUM WINDOWS TYPICAL DETAILS") — while
// keeping long schemes such as SIMR3-BW-UAI-ZZ-ZZ-00-PL-DR-00001.
function plausibleNumber(n) {
  const s = String(n || '').trim();
  return /^[A-Za-z0-9][A-Za-z0-9._/-]{2,60}$/.test(s) && /\d/.test(s) && /[-_./]/.test(s) && !/:/.test(s);
}

export const BATCH_STATES = ['scanning', 'reviewing', 'committing', 'partly_committed', 'done', 'abandoned'];
export const ITEM_STATES = ['proposed', 'confirmed', 'filed', 'held', 'rejected', 'skipped', 'failed', 'archived', 'abandoned'];

// THE EXTRACTOR'S VERSION. Every result is stored against the file's SHA-256 and
// this version (the condition of the E-programs' approval, and spec §27 rule 7):
// the same file under the same version gives the stored result, and a change to
// any rule that alters output must bump it, so a past result is never silently
// re-derived under different rules.
export const EXTRACTOR_VERSION = 'intake-2026.10.06';

// Spec §12. Each refuses with its own message rather than truncating a batch.
export const LIMITS = {
  files: 1000,                       // beyond this the review screen is unusable
  bytes: 2 * 1024 * 1024 * 1024,     // a whole drawing set, not a whole server
  held: 500,                         // past this something is wrong: the project is flagged
  open_hours: 24,                    // an untouched batch stops blocking the project after this
  zip_files: 500, zip_bytes: 500 * 1024 * 1024, zip_depth: 2,
};
const fmt = (n) => Number(n).toLocaleString('en-GB');
export const MSG = {
  batch_open: 'Someone is already loading documents into this project. Only one at a time, so nothing gets filed twice.',
  too_many: (n) => 'This folder has ' + fmt(n) + ' files and the limit is ' + fmt(LIMITS.files) + '. Split it — drawings first is usually easiest.',
  too_big: (b) => 'This folder is ' + (b / 1073741824).toFixed(1) + ' GB and the limit for one drop is 2 GB. Split it into smaller drops.',
};

let ready = false;
export async function ensureIntakeTables(env) {
  if (ready) return true;
  try {
    await env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS intake_batch (
         id TEXT PRIMARY KEY, project_id TEXT NOT NULL, org_id TEXT,
         started_by TEXT, started_at TEXT, finished_at TEXT,
         status TEXT, file_count INTEGER, summary TEXT, scope TEXT, section TEXT)`
    ).run();
    // Added after the table shipped: a batch opened ON a section files into it.
    // A database that already has the column throws at PREPARE, not at run, so
    // this needs a real try — a .catch() on the promise never sees it.
    await addColumns(env, 'intake_batch', [['section', 'TEXT']]);
    await env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS intake_item (
         id TEXT PRIMARY KEY, batch_id TEXT NOT NULL, project_id TEXT,
         filename TEXT, path TEXT, bytes INTEGER, sha256 TEXT,
         family TEXT, record_type TEXT, verdict TEXT, reason TEXT,
         evidence TEXT, extracted TEXT, state TEXT, target_id TEXT,
         file_key TEXT, error TEXT, decided_by TEXT, decided_at TEXT)`
    ).run();
    await env.DB.prepare(
      `CREATE INDEX IF NOT EXISTS idx_intake_item_batch ON intake_item(batch_id, state)`
    ).run();
    // The fingerprint of a sheet's words (sheet-reader.js textKey), so the same
    // drawing arriving twice in different files is archived, not filed twice.
    // And dkey, number|revision|stage of a drawing: two sheets with the same
    // key are the same document as far as a register is concerned.
    await addColumns(env, 'intake_item', [['text_sha', 'TEXT'], ['dkey', 'TEXT'], ['extractor', 'TEXT'], ['filed_to', 'TEXT']]);
    await addColumns(env, 'intake_batch', [['updated_at', 'TEXT'], ['report_id', 'TEXT'], ['report_summary', 'TEXT'], ['started_by_id', 'TEXT']]);
    await addColumns(env, 'projects', [['intake_flag', 'TEXT']]);
    // What the extractor read from a file, against its SHA-256 and the
    // extractor version: the same file always gives the same result.
    await env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS extraction_cache (
         key TEXT PRIMARY KEY, sha256 TEXT, extractor TEXT, result TEXT, created_at TEXT)`
    ).run();
    await env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS folder_map (
         id TEXT PRIMARY KEY, org_id TEXT NOT NULL, pattern TEXT, family TEXT,
         record_type TEXT, times_seen INTEGER, learned_from TEXT,
         confirmed_by TEXT, confirmed_at TEXT)`
    ).run();
    ready = true;
    return true;
  } catch (e) { return false; }
}

// ---------------------------------------------------------------- scope
//
// A Document Controller's batch is drawings-only, and that is enforced HERE,
// at scan time, on the server. Hiding the upload button is not a permission —
// a DC-opened batch rejects a .xer, a BOQ or a contract with an explanation
// naming what the platform admin does, rather than filing it quietly.
export const SCOPES = {
  full: null,                                   // AETRAA Admin: everything
  drawings: ['drawing', 'cad', 'specification'],
};

export function allowedInScope(scope, family) {
  const allow = SCOPES[scope === 'drawings' ? 'drawings' : 'full'];
  // An unsupported file is listed in any batch (never stored), so the person
  // sees what was left out and why.
  return !allow || allow.includes(family) || family === 'unknown' || family === 'unsupported';
}

// ---------------------------------------------------------------- batches

// The batch already open on this project, if any: one that is still being
// scanned, reviewed or committed and was touched in the last day. Older ones
// stop blocking (somebody walked away), but they can still be reopened.
export async function openBatchOn(env, pid) {
  const since = new Date(Date.now() - LIMITS.open_hours * 3600000).toISOString();
  try {
    return await env.DB.prepare(
      `SELECT id, started_by, started_at, updated_at FROM intake_batch
        WHERE project_id = ? AND status IN ('scanning','reviewing','committing','partly_committed')
          AND COALESCE(updated_at, started_at) >= ? LIMIT 1`
    ).bind(pid, since).first();
  } catch (e) { return null; }
}

export async function touchBatch(env, batchId) {
  try { await env.DB.prepare('UPDATE intake_batch SET updated_at = ? WHERE id = ?').bind(nowISO(), String(batchId)).run(); }
  catch (e) { /* cosmetic */ }
}

export async function openBatch(env, pid, who, opts = {}) {
  const ok = await ensureIntakeTables(env);
  if (!ok) return { error: 'intake is not available on this database' };
  // Spec §12: refused up front, with the number, rather than half-loaded.
  const nFiles = Number(opts.expect_files) || 0, nBytes = Number(opts.expect_bytes) || 0;
  if (nFiles > LIMITS.files) return { error: MSG.too_many(nFiles), code: 'limit' };
  if (nBytes > LIMITS.bytes) return { error: MSG.too_big(nBytes), code: 'limit' };
  const open = await openBatchOn(env, pid);
  if (open) {
    return { error: MSG.batch_open + ' It was started by ' + (open.started_by || 'someone') + ' — continue it, or abandon it first.',
             code: 'batch_open', open_batch: open.id };
  }
  const id = uid('bat');
  try {
    await env.DB.prepare(
      `INSERT INTO intake_batch (id, project_id, org_id, started_by, started_at, status,
         file_count, summary, scope, section, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)`
    ).bind(id, pid, str(opts.org_id, 60) || null, str((who && who.name) || who || '', 120),
           nowISO(), 'scanning', 0, '{}', opts.scope === 'drawings' ? 'drawings' : 'full',
           str(opts.section, 40) || null, nowISO()).run();
  } catch (e) { return { error: 'could not open a batch' }; }
  // Who ran it, so they can be told if its filing stops part-way (spec §22).
  if (who && who.id) await env.DB.prepare('UPDATE intake_batch SET started_by_id = ? WHERE id = ?').bind(String(who.id), id).run().catch(() => {});
  return { ok: true, id, scope: opts.scope === 'drawings' ? 'drawings' : 'full',
           section: str(opts.section, 40) || null };
}

export async function getBatch(env, id) {
  const ok = await ensureIntakeTables(env);
  if (!ok) return null;
  try {
    const b = await env.DB.prepare('SELECT * FROM intake_batch WHERE id = ?').bind(String(id)).first();
    if (!b) return null;
    // No ORDER BY here on purpose: 'rowid' is SQLite-only and PostgreSQL has no
    // equivalent without a real ordinal column. A plain scan of a table nobody
    // deletes from returns rows in insertion order in practice on both engines,
    // which is all this list needs.
    const { results } = await env.DB.prepare(
      'SELECT * FROM intake_item WHERE batch_id = ?'
    ).bind(String(id)).all();
    // Spec §27 rule 4: a fixed order — the full path, compared character by
    // character, never the locale's ordering and never insertion order.
    const key = (r) => String(r.path || '') + '/' + String(r.filename || '');
    const items = (results || []).slice().sort((a, b) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0)).map(shapeItem);
    return { ...b, summary: safeJson(b.summary, {}), items, counts: summarise(items) };
  } catch (e) { return null; }
}

function safeJson(s, fallback) {
  try { const v = JSON.parse(s || ''); return v == null ? fallback : v; } catch (e) { return fallback; }
}

function shapeItem(r) {
  const extracted = safeJson(r.extracted, {});
  const it = {
    id: r.id, batch_id: r.batch_id, filename: r.filename, path: r.path || '',
    bytes: r.bytes || 0, sha256: r.sha256 || null,
    family: r.family, family_label: FAMILIES[r.family] || r.family,
    record_type: r.record_type || null,
    verdict: r.verdict, reason: r.reason || '',
    evidence: safeJson(r.evidence, null), extracted,
    state: r.state, target_id: r.target_id || null, error: r.error || null,
    needs_decision: !!extracted.needs_decision,
    already_filed: !!extracted.already_filed,
    is_revision: !!extracted.is_revision,
    needs_number: !!extracted.needs_number,
    number: extracted.number || '',
    from_set: extracted.from_set || null,
    kind: extracted.kind || '',
    authority: extracted.authority || '',
    approval_no: extracted.approval_no || '',
    approval_date: extracted.approval_date || '',
    stamp: extracted.stamp || null,
    needs_stamp: !!extracted.needs_stamp,
    stamp_pending: !!extracted.stamp_pending,
    // K9: a scan, offered to the AI reader (A1), and what it read once confirmed.
    scanned: !!extracted.scanned,
    revision: extracted.revision || '',
    title: extracted.title || '',
    sheet_date: extracted.sheet_date || '',
    ai_read: extracted.ai_read || null,
    duplicate_of: extracted.duplicate_of || null,
    draft: extracted.draft || null,
    not_stored: !!extracted.not_stored,
    choose_programme: !!extracted.choose_programme,
    unsupported: r.family === 'unsupported',
    filed_to: r.filed_to || null,
    extractor: r.extractor || null,
  };
  it.group = groupOf(it);
  return it;
}

// ---------------------------------------------------------------- scan
//
// One file. Classifies, runs the gate, stores the bytes, records the proposal.
// Writes no register row — see the guarantee at the top of this file.
//
// A file that fails to parse FAILS ALONE. It never aborts the batch, because a
// single corrupt PDF in four hundred must not cost the operator the other 399.
export async function scanFile(env, batchId, project, file, probe, who) {
  const ok = await ensureIntakeTables(env);
  if (!ok) return { error: 'intake is not available on this database' };
  const batch = await env.DB.prepare('SELECT * FROM intake_batch WHERE id = ?').bind(String(batchId)).first();
  if (!batch) return { error: 'unknown batch' };

  const filename = str(file.filename, 300);
  const path = str(file.path, 600);
  const bytes = file.bytes instanceof Uint8Array ? file.bytes : null;

  // Spec §12: the batch's own limits, checked as it fills (sheets split out of
  // one set belong to the file already counted).
  if (!file.from_set) {
    try {
      const n = await env.DB.prepare(
        'SELECT COUNT(*) AS n, COALESCE(SUM(bytes), 0) AS b FROM intake_item WHERE batch_id = ?'
      ).bind(String(batchId)).first();
      const add = bytes ? bytes.length : 0;
      if (n && Number(n.n) >= LIMITS.files) return { error: MSG.too_many(Number(n.n) + 1), code: 'limit' };
      if (n && Number(n.b) + add > LIMITS.bytes) return { error: MSG.too_big(Number(n.b) + add), code: 'limit' };
    } catch (e) { /* first file */ }
  }
  await touchBatch(env, batchId);

  // The company's confirmed folder map (spec §4): applied, never proposed here.
  const folderMap = project && project.org_id ? await folderMapFor(env, project.org_id) : [];

  let c;
  try {
    c = classifyFile({ filename, path }, { ...(probe || {}), folderMap });
  } catch (e) {
    c = { family: 'unknown', reason: 'the file could not be read', record_type: null };
  }

  // A ZIP IS OPENED, WITHIN LIMITS, AND EVERY FILE IN IT IS READ ON ITS OWN.
  // Spec §19: "expand whatever arrives" is how a server dies. The entries are
  // counted and their sizes added up BEFORE anything is inflated, and a zip
  // over any limit is refused whole, with the reason.
  if (c.family === 'archive' && bytes && bytes.length) {
    const depth = Number(file.zip_depth || 0) + 1;
    const z = expandZip(bytes, depth);
    if (z.error) {
      c = { ...c, family: 'unsupported', reason: z.error };
    } else {
      const results = [];
      const inside = (path ? path + '/' : '') + filename;
      for (const e of z.entries) {
        let pr = {};
        try { pr = probeFile(e.name, e.bytes) || {}; } catch (err) { pr = {}; }
        const num = safeName(e.name).number;
        results.push(await scanFile(env, batchId, project,
          { filename: e.name, path: inside + (e.dir ? '/' + e.dir : ''), mime: '', bytes: e.bytes, zip_depth: depth },
          { ...pr, ...(num ? { drawingNumber: num } : {}) }, who));
      }
      return { ok: true, expanded: true, files: z.entries.length, items: results, family: 'archive',
               family_label: FAMILIES.archive, reason: 'a .zip of ' + z.entries.length + ' files, each read on its own' };
    }
  }

  // DROPPED ON A SECTION, IT GOES IN THAT SECTION.
  //
  // A batch opened on "IFC drawings" is a person saying, in the only way a
  // person can say it, what these files are. Nothing the engine reads off a
  // name or a folder should argue with that — it is the one piece of evidence
  // that came from somebody who actually knows.
  //
  // What the extractor still does is everything else: the number, the revision,
  // the title off the title block. The section answers "where", never "what is
  // written on it", so this makes the drop reliable without making it blind.
  // An unsupported file is never stored, whatever section it was dropped on.
  const forced = batch.section && c.family !== 'unsupported' ? SECTION_BY_ID[batch.section] : null;
  if (forced && forced.store === 'drawings') {
    c = { ...c, family: 'drawing', forced_section: forced.id };
  } else if (forced && forced.store === 'library') {
    c = { ...c, family: familyForClass(forced.key), library_class: forced.key, forced_section: forced.id };
  } else if (forced && forced.store === 'figures') {
    /* THE THREE SECTIONS THAT ARE READ INTO ROWS, NOT FILED AS DOCUMENTS.
     *
     * A drop on the Priced BOQ used to be refused outright, with a message
     * sending the admin to the Setup screen to import it there — the jump back
     * to the admin page he reported. The importers were never the problem:
     * they are the ones below, already wired into commit. The section simply
     * never told the engine that a file dropped on it IS a BOQ.
     *
     * So it does now, the same way a drawing section does: the drop says what
     * the file is, and the matching extractor reads it. A workbook dropped on
     * the BOQ is read as the BOQ even if its header would have suggested a
     * bill of materials; the person who dropped it knows which it is. */
    if (forced.key === 'boq') {
      c = { ...c, family: 'commercial', commercial_kind: 'boq', forced_section: forced.id };
    } else if (forced.key === 'programme') {
      c = { ...c, family: 'programme', forced_section: forced.id };
    } else if (forced.key === 'template') {
      // Which document it is the template for: what the admin picked, or else
      // what its name says. Only a type the template store accepts is kept —
      // anything else would be refused on filing, after the drop looked fine.
      const picked = DOC_TYPES[file.template_type] ? file.template_type : null;
      const named = templateTypeOf(filename, path);
      c = { ...c, family: 'template', forced_section: forced.id,
            template_type: picked || (DOC_TYPES[named] ? named : null) };
    }
  }

  // THE FACE OF THE DRAWING BEATS ITS FILE NAME.
  //
  // classifyFile reads the name, because that is all it has and it is enough to
  // decide the family. But a drawing carries its own number, revision and title
  // in its title block, and that is what the consultant issued and what site
  // will quote back. A file name is whoever-last-saved-it's opinion: the same
  // sheet arrives as "A0-07.pdf", "A0-07 rev C.pdf" and "Copy of A0-07.pdf" in
  // one folder, and only one of those carries a title at all.
  //
  // So for a drawing we open it. Where the face is readable it wins; where it
  // is not — a scan, a .dwg — the name still files the sheet exactly as before,
  // which is why this can be added without changing what already worked. A
  // disagreement between the two is recorded rather than resolved silently,
  // because it usually means a file was named wrongly.
  // A DWG IS A DRAWING, NOT AN "OTHER".
  //
  // Until now a .dwg was classified `cad` and filed to the library under Other:
  // the register never saw it, and nothing read its face. On a site that issues
  // DWG without a PDF — which happens — that meant the drawing simply was not in
  // the drawing register.
  //
  // DWG cannot be parsed here. It can be CONVERTED, by a tool on the server, to
  // the DXF this platform already reads well — and a DXF title block is block
  // attributes, which is the most accurate extraction of any format we handle.
  // The DXF exists only for the length of that read and is never stored.
  //
  // Where there is no converter, or the file will not convert, the DWG stays
  // exactly where it was. Nothing regresses; a machine with a converter simply
  // does better than one without.
  if (c.family === 'cad' && bytes && bytes.length && typeof env.CONVERT_CAD === 'function') {
    const conv = await env.CONVERT_CAD(bytes, filename).catch(() => null);
    if (conv && conv.dxf) {
      const dxfFace = safeDxfFace(conv.dxf);
      if (dxfFace && (dxfFace.number || dxfFace.title)) {
        // It reads as a sheet, so it belongs in the register with the rest.
        c = { ...c, family: 'drawing', cad_face: dxfFace, cad_converter: conv.converter };
      } else {
        c = { ...c, cad_reason: 'converted, but no title block fields could be read' };
      }
    } else if (conv && conv.error) {
      c = { ...c, cad_reason: conv.error };
    }
  }

  // A DRAWING PDF IS READ SHEET BY SHEET (sheet-reader.js).
  //   · a report on A4 paper is filed as a document, not a drawing
  //   · a combined set is split into one entry per sheet, each read on its own
  //   · each sheet's number is read from its title block corner
  // A file in a drawings folder that is not a drawing format (a register in
  // Excel, a .dgn) is not filed as a drawing either.
  let sheet = null;
  const isPdf = /\.pdf$/i.test(filename);
  // A PDF the name and folder could not place is opened too: its paper and its
  // title block say whether it is a drawing or a report.
  // A sheet split out of a set already read as drawings stays a drawing, even
  // when its own corner carries no number (it then waits for one on review).
  if (file.from_set && file.from_set.family === 'drawing' && c.family === 'unknown') {
    c = { ...c, family: 'drawing', reason: 'a sheet of ' + file.from_set.filename };
  }
  const unplacedPdf = c.family === 'unknown' && isPdf && !forced;
  if ((c.family === 'drawing' || unplacedPdf) && bytes && bytes.length && !c.cad_face) {
    if (!isPdf && !/\.(dwg|dxf|png|jpe?g|tiff?)$/i.test(filename)) {
      c = { ...c, family: 'report', library_class: 'other',
            reason: 'not a drawing file (.' + (filename.split('.').pop() || '?').toLowerCase() + '), kept as a document' };
    } else if (isPdf) {
      const read = await readPdfSheets(bytes, { maxPages: 120 });
      const pages = read.pages || [];
      if (unplacedPdf && pages.some((pg) => pg.paper === 'sheet' && pg.number)) {
        c = { ...c, family: 'drawing', reason: 'a drawing sheet: its title block carries a drawing number' };
      }
      if (c.family !== 'drawing' && !(pages.length && pages.every((pg) => pg.paper === 'document'))) {
        // Still unplaced: left for a person, exactly as before.
      } else if (pages.length && pages.every((pg) => pg.paper === 'document')) {
        const survey = /soil|geotech|survey|investigation|topograph/i.test(filename + ' ' + path);
        c = { ...c, family: 'report', library_class: survey ? 'survey' : 'report',
              reason: 'A4 pages: a ' + (survey ? 'survey or investigation' : 'report') + ', not a drawing' };
      } else if (read.numPages > 1 && !file.from_set) {
        // One entry per sheet. Each page goes through this same function as a
        // file of its own, so every rule (project check, number, duplicates)
        // applies to it exactly as to a sheet dropped alone.
        const stem = filename.replace(/\.pdf$/i, '');
        const results = [];
        for (let i = 0; i < read.numPages && i < 120; i++) {
          let one = null;
          try { one = await pdfPage(bytes, i); } catch (e) { one = null; }
          if (!one) { results.push({ ok: false, error: 'sheet ' + (i + 1) + ' could not be copied out' }); continue; }
          results.push(await scanFile(env, batchId, project,
            { filename: stem + ' - sheet ' + (i + 1) + '.pdf', path, mime: 'application/pdf', bytes: one,
              from_set: { filename, page: i + 1, of: read.numPages, family: 'drawing' } }, {}, who));
        }
        return { ok: true, split: true, sheets: read.numPages, truncated: read.truncated,
                 items: results, family: 'drawing', family_label: FAMILIES.drawing,
                 reason: 'a combined set of ' + read.numPages + ' sheets, read one by one' };
      } else if (pages.length) {
        sheet = pages[0];
      }
    }
  }

  if (c.family === 'drawing') {
    // What the NAME says, read with the register's own reader so intake and the
    // manual upload screen never disagree about what a number looks like. Until
    // now this arrived from the caller's probe, which meant a caller that did
    // not compute it filed a sheet with no number at all.
    const named = safeName(filename);
    // A converted DWG already has its face read; anything else is opened here.
    const face = c.cad_face
      || (bytes && bytes.length ? safeFace(filename, bytes) : null);
    const merged = mergeWithFilename(face, named);

    // WHICH SECTION THIS SHEET GOES IN.
    //
    // This was the hole: intake read the title block beautifully and then filed
    // every single sheet without a `kind`, so saveDrawing() applied its default
    // and the entire drop landed in Shop drawings. Reading the face was useless
    // while nothing carried the answer here.
    //
    // The sheet's own stamp first, then the folder it arrived in, then the file
    // name — and 'other' when none of them says, so it shows up as a question
    // rather than as a wrong answer.
    const stage = forced && forced.store === 'drawings'
      ? { kind: forced.key, kind_source: 'dropped on ' + forced.label }
      // kindFrom reads the folder as everything before the last "/" — it is
      // written for a full path. Intake's path is the folder alone, so the
      // file name goes on the end; otherwise "/IFC Drawings" lost its own name
      // and every sheet in it came out as "other".
      : kindFrom({ filename, path: (path ? path.replace(/[\\/]+$/, '') + '/' : '') + filename, face: merged });
    c = { ...c, kind: stage.kind, kind_source: stage.kind_source };
    // A sheet nothing gave a stage to, arriving in an authority's folder (a
    // DM-portal download), is that authority's approved drawing. Its stamp is
    // read by AI afterwards (/api/intake/stamps) and confirmed by a person.
    if (!forced && (!c.kind || c.kind === 'other')) {
      const auth = authorityFromPath(path);
      if (auth) c = { ...c, kind: 'authority', authority: auth, kind_source: 'folder (' + authorityName(auth) + ')' };
    }

    // A title-block "number" that is really a scale ("1:75"), a paper size
    // ("A1") or a title is not a number. The sheet's own corner is the better
    // source, and the file name the last.
    if (merged.number && !plausibleNumber(merged.number)) { delete merged.number; }
    const corner = sheet && sheet.number && validNumber(sheet.number) ? sheet.number : '';
    if (corner) { merged.number = corner; merged.source = 'the title block corner'; }
    if (!merged.number && named.number && plausibleNumber(named.number)) merged.number = named.number;
    // The title and revision printed in the title block's own boxes beat a
    // title made from the file name ("ac floor plans1770821668412 sheet 9").
    // A title still made from the file name loses the portal's timestamp and
    // the "sheet N" a split adds ("cover sheet1778156251920" → "cover sheet").
    if (merged.title && merged.source !== 'title block') {
      merged.title = String(merged.title).replace(/\d{10,}/g, ' ').replace(/\bsheet\s+\d+\s*$/i, ' ').replace(/\s+/g, ' ').trim();
    }
    if (sheet && sheet.fields) {
      if (sheet.fields.title) { merged.title = sheet.fields.title; merged.source = 'the title block'; }
      if (sheet.fields.revision) merged.revision = sheet.fields.revision;
    }
    if (merged.number || merged.title || merged.revision) {
      c = {
        ...c,
        number: merged.number || '',
        revision: merged.revision || c.revision || '',
        title: merged.title || c.title || '',
        ...(merged.scale ? { scale: merged.scale } : {}),
        ...(merged.discipline ? { discipline: merged.discipline } : {}),
        title_source: merged.source,
        ...(merged.conflicts && merged.conflicts.length ? { name_conflicts: merged.conflicts } : {}),
        ...(merged.unreadable ? { face_unreadable: merged.unreadable } : {}),
      };
    }
  }

  if (!allowedInScope(batch.scope, c.family)) {
    return {
      ok: true, skipped: true, family: c.family,
      reason: 'This batch is for drawings. A ' + (FAMILIES[c.family] || c.family).toLowerCase() +
              ' is loaded by the platform administrator through Project intake.',
    };
  }

  const sha = bytes ? await sha256Hex(bytes) : null;

  // The same file already filed on this project is recognised, not duplicated.
  // Re-dropping a folder is the normal case, not an error.
  let already = false;
  if (sha) {
    try {
      const dup = await env.DB.prepare(
        `SELECT id FROM intake_item WHERE project_id = ? AND sha256 = ? AND state = 'filed' LIMIT 1`
      ).bind(project.id, sha).first();
      already = !!dup;
    } catch (e) { /* first run */ }
  }

  // The gate. Drawings are the only family it can positively judge today; for
  // everything else a stated foreign project reference is still a conflict.
  await ensureGateColumns(env).catch(() => {});
  const gateReadable = sheet ? sheet.text : await gateText(c.family, filename, bytes, probe);

  // DUPLICATES ARE ARCHIVED, NOT FILED TWICE.
  // The same file (its fingerprint), or the same drawing in another file (the
  // fingerprint of its words), already on this project — filed, or proposed
  // earlier in a drop — is kept in the archive with a pointer to the original.
  const textSha = c.family === 'drawing' && gateReadable && gateReadable.length >= 200
    ? await sha256Hex(new TextEncoder().encode(textKey(gateReadable))) : null;
  let duplicateOf = null, dupWhy = '';
  try {
    duplicateOf = await env.DB.prepare(
      `SELECT id, filename, path FROM intake_item
        WHERE project_id = ? AND state IN ('proposed', 'confirmed', 'filed', 'held')
          AND (sha256 = ? OR (text_sha IS NOT NULL AND text_sha = ?)) LIMIT 1`
    ).bind(project.id, sha || '-', textSha || '-').first();
    if (duplicateOf) dupWhy = 'the same sheet';
  } catch (e) { duplicateOf = null; }
  // The same number, revision and stage already proposed or filed is the same
  // document to a register, even when the file differs (re-plotted, re-saved).
  // Not for authority sheets: the same sheet approved again on another date is
  // a new approval, not a copy.
  const dkey = c.family === 'drawing' && c.number && c.revision && c.kind && c.kind !== 'authority' && c.kind !== 'other'
    ? (c.number + '|' + c.revision + '|' + c.kind).toUpperCase() : null;
  if (!duplicateOf && dkey) {
    try {
      duplicateOf = await env.DB.prepare(
        `SELECT id, filename, path FROM intake_item
          WHERE project_id = ? AND state IN ('proposed', 'confirmed', 'filed', 'held') AND dkey = ? LIMIT 1`
      ).bind(project.id, dkey).first();
      if (duplicateOf) dupWhy = 'the same number, revision and stage (' + c.number + ' rev ' + c.revision + ')';
    } catch (e) { duplicateOf = null; }
  }
  let g = { verdict: 'unknown', reason: '', evidence: null };
  try {
    g = checkIncoming(project, {
      kind: c.family === 'drawing' ? 'drawing' : c.family,
      number: c.number || (c.extracted && c.extracted.number) || '',
      filename, text: gateReadable,
    });
  } catch (e) { /* gate unavailable: unknown, which files and says so */ }

  // TWO PROGRAMMES IN ONE DROP ARE A DECISION (spec §6). A programme silently
  // replacing a baseline destroys every delay position computed from it, so
  // both are marked and neither is filed until the other is left out.
  let otherProgrammes = [];
  if (c.family === 'programme' && !duplicateOf) {
    try {
      const { results } = await env.DB.prepare(
        "SELECT id, extracted FROM intake_item WHERE batch_id = ? AND family = 'programme' AND state IN ('proposed', 'confirmed')"
      ).bind(String(batchId)).all();
      otherProgrammes = results || [];
    } catch (e) { otherProgrammes = []; }
    for (const o of otherProgrammes) {
      const ex = safeJson(o.extracted, {});
      ex.choose_programme = true; ex.needs_decision = true;
      try { await env.DB.prepare('UPDATE intake_item SET extracted = ? WHERE id = ?').bind(JSON.stringify(ex), o.id).run(); } catch (e) { /* listed anyway */ }
    }
  }

  // An unsupported file is listed, never stored (spec §19). A CAD file over the
  // drawing limit is "recognised, not stored" until files move out of the
  // database (spec §6, §12).
  const unsupported = c.family === 'unsupported';
  const notStored = c.family === 'cad' && !!bytes && !cadStorable(driverName(env), bytes.length);
  let key = null;
  if (bytes && bytes.length && !unsupported && !notStored) {
    key = 'intake/' + project.id + '/' + uid('f');
    const put = await putFile(env, key, bytes, file.mime || 'application/octet-stream');
    if (!put || put.error) key = null;
  }

  const extracted = {
    ...(c.number ? { number: c.number } : {}),
    // Read off the title block where there was one. The review screen shows
    // these, so a wrong title is corrected before it is filed rather than after.
    ...(c.title ? { title: c.title } : {}),
    ...(c.revision ? { revision: c.revision } : {}),
    ...(c.scale ? { scale: c.scale } : {}),
    ...(c.discipline ? { discipline: c.discipline } : {}),
    ...(c.title_source ? { title_source: c.title_source } : {}),
    // The section this sheet belongs in, and where that was read from, so the
    // review screen can show it and a person can correct it before filing.
    ...(c.kind ? { kind: c.kind } : {}),
    ...(c.kind_source ? { kind_source: c.kind_source } : {}),
    ...(c.authority ? { authority: c.authority } : {}),
    // Sheets whose approval stamp the AI should read: authority sheets, and
    // sheets with no stage at all (the stamp may be the only thing that says).
    ...(c.family === 'drawing' && (c.kind === 'authority' || c.kind === 'other') && !duplicateOf ? { needs_stamp: true } : {}),
    ...(c.name_conflicts ? { name_conflicts: c.name_conflicts } : {}),
    // Why a DWG could not be read, in the operator's words rather than a silent
    // fallback to the file name.
    ...(c.cad_reason ? { cad_reason: c.cad_reason } : {}),
    ...(c.cad_converter ? { cad_converter: c.cad_converter } : {}),
    ...(c.reference ? { reference: c.reference } : {}),
    ...(c.template_type ? { template_type: c.template_type } : {}),
    ...(c.commercial_kind ? { commercial_kind: c.commercial_kind } : {}),
    ...(c.library_class ? { library_class: c.library_class } : {}),
    ...(c.unread_reason ? { unread_reason: c.unread_reason } : {}),
    ...(c.party ? { party: c.party } : {}),
    ...(c.tokens ? { tokens: c.tokens } : {}),
    ...(probe && probe.rows ? { row_count: probe.rows.length } : {}),
    already_filed: already,
    // A decision is needed where the engine has a family but not enough to file
    // it without a person: a logo whose party is unnamed, a template whose type
    // could not be read, a drawing with no discipline.
    ...(file.from_set ? { from_set: file.from_set } : {}),
    ...(duplicateOf ? { archived: true, duplicate_of: { id: duplicateOf.id, filename: duplicateOf.filename, path: duplicateOf.path } } : {}),
    // A drawing with no number cannot be filed; a person types it on the review
    // screen (or, later, the AI reader proposes it).
    ...(c.family === 'drawing' && !c.number && !duplicateOf ? { needs_number: true } : {}),
    // K9 (v5 A1): a scan — a sheet with no text the title-block reader (E4)
    // could read, or a picture. Offered to "Read with AI"; nothing is read here.
    ...(c.family === 'drawing' && !duplicateOf && ((isPdf && sheet && !readable(sheet.text)) || /\.(png|jpe?g|tiff?)$/i.test(filename)) ? { scanned: true } : {}),
    ...(c.draft_like && !duplicateOf ? { draft: c.draft_like } : {}),
    ...(notStored ? { not_stored: true } : {}),
    ...(c.by_folder_map ? { by_folder_map: true } : {}),
    ...(otherProgrammes.length ? { choose_programme: true } : {}),
    needs_decision:
      (c.family === 'drawing' && !c.number && !duplicateOf) ||
      (c.family === 'logo' && !c.party) ||
      (c.family === 'template' && !c.template_type) ||
      (c.family === 'commercial' && !c.commercial_kind) ||
      otherProgrammes.length > 0 ||
      false,
  };

  // THE SAME FILE GIVES THE SAME RESULT (spec §27; the E-programs' condition).
  // The first reading of a file under this extractor version is kept against
  // its SHA-256; a later reading that differs is flagged as a fault rather
  // than quietly replacing it.
  if (sha && !unsupported) {
    const sig = JSON.stringify({ family: c.family, kind: extracted.kind || '', number: extracted.number || '',
      revision: extracted.revision || '', title: extracted.title || '', discipline: extracted.discipline || '' });
    const ckey = await sha256Hex(new TextEncoder().encode([sha, EXTRACTOR_VERSION, path, batch.section || '',
      JSON.stringify(folderMap.map((m) => [m.pattern, m.family])), file.from_set ? file.from_set.page : ''].join('|')));
    try {
      const prior = await env.DB.prepare('SELECT result FROM extraction_cache WHERE key = ?').bind(ckey).first();
      if (prior && prior.result !== sig) extracted.result_changed = true;
      else if (!prior) {
        await env.DB.prepare('INSERT INTO extraction_cache (key, sha256, extractor, result, created_at) VALUES (?,?,?,?,?)')
          .bind(ckey, sha, EXTRACTOR_VERSION, sig, nowISO()).run();
      }
    } catch (e) { /* the result still stands */ }
  }

  // What the item starts as: archived (a duplicate), left out (unsupported, or
  // a draft nobody has chosen to include), or proposed.
  const startState = duplicateOf ? 'archived' : (unsupported || notStored || extracted.draft) ? 'skipped' : 'proposed';
  const leftOut = notStored ? NOT_STORED : unsupported ? c.reason + ' — listed, not stored'
    : extracted.draft ? 'the name says "' + extracted.draft + '": left out unless you include it' : '';

  const id = uid('itm');
  try {
    await env.DB.prepare(
      `INSERT INTO intake_item (id, batch_id, project_id, filename, path, bytes, sha256,
         family, record_type, verdict, reason, evidence, extracted, state, file_key, text_sha, target_id, dkey, extractor)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
    ).bind(id, batchId, project.id, filename, path, bytes ? bytes.length : 0, sha,
           c.family, c.record_type || null, unsupported ? 'unknown' : g.verdict,
           duplicateOf
             ? str('Duplicate of ' + (duplicateOf.path || duplicateOf.filename) + ' (' + dupWhy + '): kept in the archive, not filed again', 600)
             : leftOut ? str(leftOut, 600)
             : str(c.reason, 300) + (g.verdict === 'conflict' ? ' · ' + str(g.reason, 300) : ''),
           JSON.stringify(g.evidence || null), JSON.stringify(extracted),
           startState, key, textSha, duplicateOf ? duplicateOf.id : null, dkey, EXTRACTOR_VERSION).run();
  } catch (e) { return { error: 'could not record that file' }; }

  try {
    await env.DB.prepare('UPDATE intake_batch SET file_count = file_count + 1 WHERE id = ?')
      .bind(batchId).run();
  } catch (e) { /* count is cosmetic */ }

  return { ok: true, id, family: c.family, family_label: FAMILIES[c.family] || c.family,
           verdict: unsupported ? 'unknown' : g.verdict, reason: leftOut || c.reason, already_filed: already,
           state: startState,
           ...(unsupported ? { unsupported: true } : {}),
           ...(extracted.draft ? { draft: extracted.draft } : {}),
           ...(duplicateOf ? { archived: true, duplicate_of: duplicateOf.id } : {}),
           ...(c.number ? { number: c.number } : {}),
           group: groupOf({ ...extracted, family: c.family, verdict: g.verdict, state: startState }) };
}

// ---------------------------------------------------------------- zips
//
// Counted and sized from the central directory first; inflated only when the
// whole archive is inside the limits. A zip bomb is a few kilobytes that
// expands to terabytes, so the decision is made before anything is expanded.
export function expandZip(bytes, depth = 1) {
  if (depth > LIMITS.zip_depth) {
    return { error: 'a zip inside a zip ' + (depth - 1) + ' levels deep is not opened (the limit is ' + LIMITS.zip_depth + ')' };
  }
  const wanted = (n) => !/\/$/.test(n) && !/(^|\/)(__MACOSX|\.DS_Store)(\/|$)/.test(n) && !/(^|\/)\.[^/]/.test(n);
  let count = 0, total = 0;
  try {
    unzipSync(new Uint8Array(bytes), { filter: (f) => { if (wanted(f.name)) { count++; total += Number(f.originalSize) || 0; } return false; } });
  } catch (e) { return { error: 'the zip could not be opened — it may be damaged or password-protected' }; }
  if (count > LIMITS.zip_files) return { error: 'the zip holds ' + fmt(count) + ' files and the limit is ' + fmt(LIMITS.zip_files) + ' — unzip it and drop the folder instead' };
  if (total > LIMITS.zip_bytes) return { error: 'the zip expands to ' + Math.round(total / 1048576) + ' MB and the limit is ' + Math.round(LIMITS.zip_bytes / 1048576) + ' MB — unzip it and drop the folder instead' };
  let files;
  try { files = unzipSync(new Uint8Array(bytes), { filter: (f) => wanted(f.name) }); }
  catch (e) { return { error: 'the zip could not be opened — it may be damaged or password-protected' }; }
  let actual = 0;
  const entries = [];
  for (const name of Object.keys(files).sort()) {
    actual += files[name].length;
    if (actual > LIMITS.zip_bytes) return { error: 'the zip expands past ' + Math.round(LIMITS.zip_bytes / 1048576) + ' MB — unzip it and drop the folder instead' };
    const parts = name.split('/');
    entries.push({ name: parts.pop(), dir: parts.join('/'), bytes: files[name] });
  }
  return { entries };
}

async function sha256Hex(bytes) {
  try {
    const d = await crypto.subtle.digest('SHA-256', bytes);
    return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch (e) { return null; }
}

// ---------------------------------------------------------------- confirm
//
// The person's corrections. Writes to intake_item only — never to a register.
export async function confirmItems(env, batchId, decisions, who) {
  const ok = await ensureIntakeTables(env);
  if (!ok) return { error: 'intake is not available on this database' };
  let changed = 0;
  const errors = [];
  for (const d of (decisions || []).slice(0, 500)) {
    const id = str(d && d.id, 60);
    if (!id) continue;
    try {
      const row = await env.DB.prepare('SELECT * FROM intake_item WHERE id = ? AND batch_id = ?')
        .bind(id, String(batchId)).first();
      if (!row) { errors.push({ id, error: 'unknown item' }); continue; }
      // Never stored, so never filed: an unsupported type cannot be included.
      if (row.family === 'unsupported' && d.state !== 'skipped') {
        errors.push({ id, error: row.reason || 'that type of file cannot be stored' }); continue;
      }
      if (['filed', 'held', 'archived', 'abandoned'].includes(row.state)) {
        errors.push({ id, error: 'that file is already ' + row.state }); continue;
      }
      const extracted = { ...safeJson(row.extracted, {}), ...(d.extracted || {}) };
      // A number typed on the review screen: kept only if it looks like one.
      if (d.extracted && 'number' in d.extracted) {
        const n = str(d.extracted.number, 60).trim().toUpperCase();
        if (!plausibleNumber(n)) { errors.push({ id, error: 'that does not look like a drawing number' }); continue; }
        extracted.number = n; extracted.needs_number = false; extracted.number_source = 'typed on review';
      }
      if (d.family || d.extracted) extracted.needs_decision = false;
      const state = d.state === 'skipped' ? 'skipped' : 'confirmed';
      await env.DB.prepare(
        `UPDATE intake_item SET family = ?, record_type = ?, extracted = ?, state = ?,
           decided_by = ?, decided_at = ? WHERE id = ?`
      ).bind(str(d.family, 40) || row.family, str(d.record_type, 40) || row.record_type,
             JSON.stringify(extracted), state,
             str((who && who.name) || who || '', 120), nowISO(), id).run();
      changed++;
    } catch (e) { errors.push({ id, error: 'could not record that decision' }); }
  }
  await touchBatch(env, batchId);
  return { ok: true, changed, errors };
}

// ---------------------------------------------------------------- abandon
//
// Spec §13: a batch can be abandoned before commit. Nothing was written, so
// nothing is undone — but the files uploaded for scanning are deleted, because
// an abandoned batch must not quietly consume storage. Anything already filed
// or held stays exactly where it is; this engine has no delete of its own for
// the registers, by design.
export async function abandonBatch(env, batchId, who) {
  const ok = await ensureIntakeTables(env);
  if (!ok) return { error: 'intake is not available on this database' };
  const b = await env.DB.prepare('SELECT * FROM intake_batch WHERE id = ?').bind(String(batchId)).first();
  if (!b) return { error: 'no such batch' };
  if (b.status === 'abandoned') return { ok: true, already: true };
  let rows = [];
  try {
    rows = (await env.DB.prepare(
      "SELECT id, file_key FROM intake_item WHERE batch_id = ? AND state IN ('proposed', 'confirmed', 'skipped', 'failed')"
    ).bind(String(batchId)).all()).results || [];
  } catch (e) { rows = []; }
  let deleted = 0;
  for (const r of rows) {
    if (r.file_key) { try { await deleteFile(env, r.file_key); deleted++; } catch (e) { /* counted as kept */ } }
    try { await env.DB.prepare("UPDATE intake_item SET state = 'abandoned', file_key = NULL WHERE id = ?").bind(r.id).run(); } catch (e) {}
  }
  await env.DB.prepare('UPDATE intake_batch SET status = ?, finished_at = ?, updated_at = ? WHERE id = ?')
    .bind('abandoned', nowISO(), nowISO(), String(batchId)).run();
  return { ok: true, items: rows.length, files_deleted: deleted, by: str((who && who.name) || who || '', 120) };
}

// ---------------------------------------------------------------- commit
//
// Files confirmed items. Per item, never per batch — four hundred drawings in
// one request would exhaust the server — so the browser walks the batch in
// chunks and this returns a result for each.
//
// `routes` is injected rather than imported so this module stays testable
// without dragging in the whole importer stack, and so the caller (index.js)
// keeps ownership of what each importer is called with.
export async function commitItems(env, batchId, ids, project, who, routes = {}) {
  const ok = await ensureIntakeTables(env);
  if (!ok) return { error: 'intake is not available on this database' };

  const out = [];
  for (const rawId of (ids || []).slice(0, 100)) {
    const id = str(rawId, 60);
    let row;
    try {
      row = await env.DB.prepare('SELECT * FROM intake_item WHERE id = ? AND batch_id = ?')
        .bind(id, String(batchId)).first();
    } catch (e) { row = null; }
    if (!row) { out.push({ id, ok: false, error: 'unknown item' }); continue; }

    // Already done, or deliberately left out. Re-running a folder must be safe.
    if (row.state === 'filed') { out.push({ id, ok: true, already: true, state: 'filed' }); continue; }
    if (row.state === 'skipped') { out.push({ id, ok: true, skipped: true, state: 'skipped' }); continue; }
    // A duplicate stays in the archive: stored, listed, never filed again.
    if (row.state === 'archived') { out.push({ id, ok: true, archived: true, state: 'archived' }); continue; }
    if (row.state === 'abandoned') { out.push({ id, ok: false, error: 'that drop was abandoned' }); continue; }
    if (row.family === 'unsupported') { out.push({ id, ok: true, skipped: true, state: 'skipped' }); continue; }

    // Two programmes in one drop: neither is filed until one is left out.
    if (row.family === 'programme') {
      let others = 0;
      try {
        others = Number((await env.DB.prepare(
          "SELECT COUNT(*) AS n FROM intake_item WHERE batch_id = ? AND family = 'programme' AND id <> ? AND state IN ('proposed', 'confirmed', 'filed')"
        ).bind(String(batchId), id).first() || {}).n) || 0;
      } catch (e) { others = 0; }
      if (others) {
        out.push({ id, ok: false, needs_decision: true,
          error: 'Two programmes are in this drop. Leave out the one that is not the baseline, then file the other.' });
        continue;
      }
    }

    const extracted = safeJson(row.extracted, {});

    // A conflict never files on its own — it goes to the queue with the
    // reason attached, so the Admin decides rather than the engine. But a
    // re-run (retry after a fix, or a second commit pass) must not raise a
    // second hold for the same file forever: once this exact item already has
    // a decision, that decision is what governs, not the stale verdict.
    // Without this check, an Admin approving a held item that came through
    // intake accomplished nothing — the underlying intake row stayed 'held'
    // and the next commit attempt just opened a duplicate hold instead of
    // filing it.
    if (row.verdict === 'conflict') {
      const prior = row.target_id ? await getHeld(env, row.target_id) : null;
      if (prior && prior.status === 'approved') {
        // Fall through to file it below, exactly as an unheld item would —
        // past the gate this time (K3): the Admin has just judged it, and
        // sending it back through the same check held it a second time,
        // silently, with nothing reaching the register.
        row = { ...row, _approved_hold: true };
      } else if (prior && prior.status === 'rejected') {
        await setItem(env, id, 'rejected', row.target_id, prior.note || 'rejected by AETRAA Admin');
        out.push({ id, ok: false, rejected: true, quarantine_id: row.target_id, error: prior.note || 'rejected' });
        continue;
      } else if (row.state === 'held' && row.target_id) {
        // Already sitting in the queue awaiting a decision — leave it there.
        // `already`: not a new hold, so nobody is told about it a second time (K3).
        out.push({ id, ok: true, held: true, already: true, quarantine_id: row.target_id, reason: row.reason });
        continue;
      } else {
        try {
          const held = await hold(env, row.project_id, {
            org_id: (project && project.org_id) || null,
            item_id: row.id, file_key: row.file_key, filename: row.filename,
            kind: row.family, reason: row.reason, evidence: safeJson(row.evidence, null),
          }, who);
          if (!held || held.error) {
            await setItem(env, id, 'failed', null, (held && held.error) || 'could not hold this item');
            out.push({ id, ok: false, held_limit: !!(held && held.held_limit), error: (held && held.error) || 'could not hold this item' });
            continue;
          }
          await setItem(env, id, 'held', held.id, null);
          out.push({ id, ok: true, held: true, quarantine_id: held.id, reason: row.reason });
        } catch (e) {
          await setItem(env, id, 'failed', null, 'could not hold this item');
          out.push({ id, ok: false, error: 'could not hold this item' });
        }
        continue;
      }
    }

    try {
      const r = await fileOne(env, row, extracted, project, who, routes);
      if (r && r.error) {
        // A failure is recorded on the item and the loop continues. One bad
        // file never costs the operator the rest of the batch.
        await setItem(env, id, 'failed', null, r.error);
        out.push({ id, ok: false, error: r.error });
      } else {
        await setItem(env, id, 'filed', (r && r.target_id) || null, null, (r && r.where) || row.family);
        out.push({ id, ok: true, state: 'filed', where: (r && r.where) || row.family,
                   target_id: (r && r.target_id) || null });
      }
    } catch (e) {
      const msg = String((e && e.message) || e).slice(0, 200);
      await setItem(env, id, 'failed', null, msg);
      out.push({ id, ok: false, error: msg });
    }
  }

  await refreshBatchStatus(env, batchId);
  await touchBatch(env, batchId);
  return { ok: true, results: out };
}

async function setItem(env, id, state, targetId, error, filedTo) {
  try {
    await env.DB.prepare('UPDATE intake_item SET state = ?, target_id = ?, error = ?, filed_to = COALESCE(?, filed_to) WHERE id = ?')
      .bind(state, targetId || null, error || null, filedTo ? String(filedTo).slice(0, 300) : null, id).run();
  } catch (e) { /* the result is still returned to the caller */ }
}

async function refreshBatchStatus(env, batchId) {
  try {
    const { results } = await env.DB.prepare(
      'SELECT state, COUNT(*) AS n FROM intake_item WHERE batch_id = ? GROUP BY state'
    ).bind(String(batchId)).all();
    const by = {};
    for (const r of results || []) by[r.state] = r.n;
    const pending = (by.proposed || 0) + (by.confirmed || 0);
    const status = pending ? 'partly_committed' : 'done';
    await env.DB.prepare(
      'UPDATE intake_batch SET status = ?, summary = ?, finished_at = ? WHERE id = ?'
    ).bind(status, JSON.stringify(by), pending ? null : nowISO(), String(batchId)).run();
  } catch (e) { /* cosmetic */ }
}

// ---------------------------------------------------------------- routing
//
// Every family has a destination, and the destinations already exist. Intake
// finds files and proposes; it calls the same code the manual screens call, so
// a fix to an importer fixes both paths at once.
// KEEPING THE FILE THE FIGURES CAME FROM.
//
// An import reads a workbook into rows and, until now, threw the workbook away.
// For a spreadsheet of contact names that would be fine. For a PRICED BILL it is
// not: the bill the contractor submitted is a contract document, and two years
// later, in a dispute over a rate, "our parser read 412.50" is not an answer.
// The file as issued is the answer. The same holds for the programme — a .xer is
// the submission, and the activities read out of it are a convenience.
//
// So the rows go to the register AND the original is filed. If the copy fails —
// a workbook over the library's size cap, say — the import still stands and the
// reason is reported: losing the record is bad, losing the bill as well because
// we insisted on both is worse.
const SOURCE_CLASS = { boq: 'contract', bom: 'other', programme: 'contract' };

async function keepSource(env, pid, row, bytes, what, who) {
  if (!bytes || !bytes.length) return null;
  try {
    const r = await addDocument(env, pid, {
      class: SOURCE_CLASS[what] || 'other',
      title: SOURCE_LABEL[what] || 'Imported file',
      filename: row.filename,
      bytes,
      source: 'intake',
      note: 'the file the ' + (SOURCE_NOUN[what] || 'import') + ' was read from, kept as issued',
    }, who);
    return r && r.error ? { error: r.error } : { ok: true, id: r && r.id };
  } catch (e) { return { error: 'could not keep the source file' }; }
}

const SOURCE_LABEL = {
  boq: 'Priced BOQ — as submitted',
  bom: 'Budget quantities — as submitted',
  programme: 'Programme — as submitted',
};
const SOURCE_NOUN = { boq: 'priced BOQ', bom: 'bill of materials', programme: 'programme' };

async function fileOne(env, row, extracted, project, who, routes) {
  const fam = row.family;
  const pid = row.project_id;
  const bytes = routes.getBytes ? await routes.getBytes(row.file_key) : null;

  if (fam === 'programme') {
    if (!routes.programme) return { error: 'the programme importer is not wired in' };
    const r = await routes.programme(pid, bytes, row.filename);
    if (r && r.error) return r;
    const kept = await keepSource(env, pid, row, bytes, 'programme', who);
    // What the importer says it did, not a fixed phrase — a folder drop cannot
    // ask which discipline each WBS branch is, and that has to reach the screen
    // rather than be left for somebody to notice.
    return { where: ((r && r.where) || 'the programme')
                  + (kept && kept.ok ? ', and the file kept in the library' : ''),
             target_id: null,
             ...(kept && kept.error ? { source_warning: kept.error } : {}) };
  }

  if (fam === 'commercial') {
    const kind = extracted.commercial_kind === 'bom' ? 'bom' : 'boq';
    // K1: the bill is read and checked (v5 E7/E8) before anything is imported.
    if (routes.bill) {
      const r = await routes.bill(pid, kind, row.filename, bytes,
        { file_key: row.file_key, batch_id: row.batch_id, item_id: row.id });
      if (r && r.error) return r;
      const kept = await keepSource(env, pid, row, bytes, kind, who);
      return { where: r.where + (kept && kept.ok ? ', and the workbook kept in the library' : ''),
               target_id: r.import_id || null,
               ...(kept && kept.error ? { source_warning: kept.error } : {}) };
    }
    // The rows are read from the STORED FILE at commit time rather than kept
    // on the intake row. A bill runs to thousands of lines; copying them into
    // intake_item would double the storage and let the two drift apart. The
    // bytes are the truth, and they are right here.
    const rows = routes.rowsOf ? await routes.rowsOf(row.filename, bytes, kind) : (extracted.rows || []);
    if (!rows || !rows.length) {
      return { error: 'no priced lines could be read from that workbook — check it has a header row ' +
                      'with Description, Qty and Rate' };
    }
    if (kind === 'bom') {
      if (!routes.bom) return { error: 'the BOM importer is not wired in' };
      const r = await routes.bom(pid, rows);
      if (r && r.error) return r;
      const kept = await keepSource(env, pid, row, bytes, 'bom', who);
      return { where: 'the bill of materials (' + rows.length + ' lines)'
                    + (kept && kept.ok ? ', and the workbook kept in the library' : ''),
               ...(kept && kept.error ? { source_warning: kept.error } : {}) };
    }
    if (!routes.boq) return { error: 'the BOQ importer is not wired in' };
    const r = await routes.boq(pid, rows);
    if (r && r.error) return r;
    const kept = await keepSource(env, pid, row, bytes, 'boq', who);
    return { where: 'the priced BOQ (' + rows.length + ' lines)'
                  + (kept && kept.ok ? ', and the workbook kept in the library' : ''),
             ...(kept && kept.error ? { source_warning: kept.error } : {}) };
  }

  if (fam === 'template') {
    if (!routes.template) return { error: 'the template store is not wired in' };
    const t = extracted.template_type;
    if (!t) return { error: 'this template has no document type set' };
    const r = await routes.template(pid, t, row.filename, bytes);
    return r && r.error ? r : { where: 'the templates' };
  }

  if (fam === 'logo') {
    if (!routes.branding) return { error: 'branding is not wired in' };
    if (!extracted.party) return { error: 'this logo has no party set' };
    const r = await routes.branding(pid, extracted.party, bytes, row.filename);
    return r && r.error ? r : { where: 'branding' };
  }

  // A CAD file is a sheet's native source: packaged, paired, or the sheet itself.
  if (fam === 'cad') {
    if (!routes.cad) return { error: 'CAD filing is not wired in' };
    let others = [];
    try {
      others = ((await env.DB.prepare("SELECT filename FROM intake_item WHERE batch_id = ? AND family = 'cad' AND id <> ?").bind(row.batch_id, row.id).all()).results || []).map((x) => x.filename);
    } catch (e) { others = []; }
    const r = await routes.cad(pid, { filename: row.filename, kind: extracted.kind }, bytes, row.file_key, others);
    if (r && r.error) return r;
    return { where: r.where, target_id: r.drawing_id || r.id };
  }

  if (fam === 'drawing') {
    if (!routes.drawing) return { error: 'the drawing register is not wired in' };
    const r = await routes.drawing(pid, { ...extracted, filename: row.filename, r2_key: row.file_key }, who,
      row._approved_hold ? { gate: false } : undefined);
    if (r && r.error) return r;
    if (r && r.held) return { where: 'the held queue', target_id: r.quarantine_id };
    return { where: 'the drawing register', target_id: (r && r.id) || null };
  }

  // Everything else has a home in the library. That is the whole point of the
  // library existing: "every document has a destination" has to be true, or
  // intake quietly leaves things out — which is the failure this replaces.
  const cls = extracted.library_class || LIBRARY_CLASS_OF[fam] || 'other';
  const r = await addDocument(env, pid, {
    class: CLASSES[cls] ? cls : 'other',
    title: titleFrom(row.filename),
    filename: row.filename,
    bytes: bytes || null,
    reference: extracted.reference || null,
    source: 'intake',
    note: row.path ? 'from ' + row.path : null,
    unread_reason: extracted.unread_reason || null,
  }, who);
  if (r && r.error) return { error: r.error };
  return { where: 'the library', target_id: r && r.id };
}

const LIBRARY_CLASS_OF = {
  contract: 'contract', specification: 'specification', payment: 'payment',
  handover: 'o_and_m', site: 'report', correspondence: 'report', minutes: 'report',
  authority: 'report', quality: 'report', hse: 'report', technical: 'report',
  cad: 'other', unknown: 'other',
};

function titleFrom(filename) {
  return String(filename || 'document').replace(/\.[a-z0-9]{1,5}$/i, '').replace(/[_-]+/g, ' ').trim()
    || 'document';
}

// ---------------------------------------------------------------- folder map
//
// A contractor uses the same tree on every project. When twenty files from
// /05 MAR/ are placed as material approvals, that mapping is worth remembering
// — the second project then onboards far more cleanly than the first.
//
// Per COMPANY, never per project. Proposed, never silent: a mapping applies
// only once someone confirms it, because there is no confidence score here and
// no threshold — the engine's only verdicts are match, unknown and conflict.
export async function learnFolders(env, batchId, oid) {
  const ok = await ensureIntakeTables(env);
  if (!ok || !oid) return [];
  let rows = [];
  try {
    const { results } = await env.DB.prepare(
      `SELECT path, family, COUNT(*) AS n FROM intake_item
        WHERE batch_id = ? AND state IN ('confirmed','filed') AND COALESCE(path,'') <> ''
        GROUP BY path, family HAVING COUNT(*) >= 3`
    ).bind(String(batchId)).all();
    rows = results || [];
  } catch (e) { return []; }

  const known = (await folderMapFor(env, oid)).map((m) => String(m.pattern || '').trim().toLowerCase());
  const out = [];
  for (const r of rows) {
    const seg = String(r.path).split(/[\\/]+/).filter(Boolean).pop();
    if (!seg || r.family === 'unknown' || r.family === 'unsupported') continue;
    if (known.includes(seg.trim().toLowerCase())) continue;          // already remembered
    if (out.some((o) => o.pattern === seg)) continue;               // one family per folder
    out.push({ pattern: seg, family: r.family, family_label: FAMILIES[r.family] || r.family, times_seen: r.n, confirmed: false, batch_id: batchId });
  }
  return out;
}

// The company's remembered folders, visible and editable (spec §4).
export async function listFolderMap(env, oid) {
  const ok = await ensureIntakeTables(env);
  if (!ok || !oid) return [];
  try {
    const { results } = await env.DB.prepare(
      'SELECT id, pattern, family, record_type, times_seen, confirmed_by, confirmed_at FROM folder_map WHERE org_id = ? ORDER BY pattern'
    ).bind(oid).all();
    return (results || []).map((r) => ({ ...r, family_label: FAMILIES[r.family] || r.family }));
  } catch (e) { return []; }
}

export async function removeFolderMap(env, oid, id) {
  const ok = await ensureIntakeTables(env);
  if (!ok) return { error: 'intake is not available on this database' };
  try {
    await env.DB.prepare('DELETE FROM folder_map WHERE id = ? AND org_id = ?').bind(String(id), String(oid)).run();
    return { ok: true };
  } catch (e) { return { error: 'could not remove that folder' }; }
}

// THE REPORT, FILED (spec §30). Issued when a commit settles — also on a
// partial commit — and kept in the library, one per state of the batch and
// never overwritten. A batch whose outcome has not changed since its last
// report does not file a duplicate.
export async function fileReport(env, batchId, project, who, header) {
  const b = await getBatch(env, batchId);
  if (!b || !project) return null;
  const rep = buildReport(b, b.items, project);
  const sig = JSON.stringify(rep.counts);
  if (b.report_summary === sig) return { ok: true, unchanged: true, id: b.report_id, report: rep };
  let pdf;
  try { pdf = await reportPdf(rep, header); } catch (e) { return { error: 'the report could not be drawn', report: rep }; }
  const when = new Date(Date.now() + 4 * 3600000).toISOString().slice(0, 16).replace('T', ' ');
  const r = await addDocument(env, project.id, {
    class: 'report', title: 'Intake report — ' + when + ' — ' + rep.total + ' files',
    filename: 'Intake report ' + batchId + ' ' + when.replace(/[: ]/g, '-') + '.pdf',
    bytes: pdf, source: 'intake', reference: batchId, note: rep.summary,
  }, who);
  if (!r || r.error) return { error: (r && r.error) || 'the report could not be filed', report: rep };
  try {
    await env.DB.prepare('UPDATE intake_batch SET report_id = ?, report_summary = ? WHERE id = ?')
      .bind(r.id, sig, String(batchId)).run();
  } catch (e) { /* the report is filed either way */ }
  return { ok: true, id: r.id, report: rep };
}

export async function saveFolderMap(env, oid, entries, who) {
  const ok = await ensureIntakeTables(env);
  if (!ok) return { error: 'intake is not available on this database' };
  let saved = 0;
  for (const e of (entries || []).slice(0, 100)) {
    if (!e || !e.pattern || !e.family) continue;
    try {
      await env.DB.prepare(
        `INSERT INTO folder_map (id, org_id, pattern, family, record_type, times_seen,
           learned_from, confirmed_by, confirmed_at) VALUES (?,?,?,?,?,?,?,?,?)`
      ).bind(uid('fm'), oid, str(e.pattern, 120), str(e.family, 40),
             str(e.record_type, 40) || null, Number(e.times_seen) || 1,
             str(e.batch_id, 60) || null, str((who && who.name) || who || '', 120), nowISO()).run();
      saved++;
    } catch (err) { /* duplicate or unavailable */ }
  }
  return { ok: true, saved };
}

export async function folderMapFor(env, oid) {
  const ok = await ensureIntakeTables(env);
  if (!ok || !oid) return [];
  try {
    const { results } = await env.DB.prepare(
      'SELECT pattern, family, record_type FROM folder_map WHERE org_id = ? AND confirmed_by IS NOT NULL'
    ).bind(oid).all();
    return results || [];
  } catch (e) { return []; }
}

// ---------------------------------------------------------------- approval stamps (AI)
//
// Reads the approval stamp on the batch's authority sheets (and on sheets with
// no stage), a few per call so the page can show progress and a slow model
// never holds one request for minutes. Each answer is kept on the item: the
// authority, approval number and date, where the stamp is and how sure the AI
// is. Nothing is applied by this — Document Control confirms each reading
// (confirmStamps) before it reaches the sheet or the register.
export async function readStamps(env, batchId, opts = {}) {
  const ok = await ensureIntakeTables(env);
  if (!ok) return { error: 'intake is not available on this database' };
  // K9: with AI off nothing is read — and nothing is marked as tried, so the
  // sheets are still offered once AI is switched on.
  if (!aiEnabled(env)) return { error: AI_OFF_MESSAGE, disabled: true };
  // Read three at a time, side by side: on the subscription each sheet takes
  // about 12 seconds, so 180 sheets one by one would take over half an hour.
  const limit = Math.max(1, Math.min(Number(opts.limit) || 3, 10));
  // Filed sheets are included: reading a stamp after filing updates the
  // register, so pressing "File" before the stamps are read loses nothing.
  // Sheets that failed for want of a number are included too: the AI reads
  // the number off the title block and the sheet can then be filed.
  let rows = [];
  try {
    const r = await env.DB.prepare(
      `SELECT * FROM intake_item WHERE batch_id = ? AND family = 'drawing'
          AND state IN ('proposed', 'confirmed', 'filed', 'failed')`
    ).bind(String(batchId)).all();
    rows = (r.results || []).filter((x) => {
      const e = safeJson(x.extracted, {});
      return e.needs_stamp || (x.state === 'failed' && e.needs_number && !e.number_by_ai_tried);
    });
  } catch (e) { rows = []; }
  const todo = rows.length;
  const results = await Promise.all(rows.slice(0, limit).map((row) => readOneStamp(env, row, opts)));
  const errors = results.filter((x) => x.error).length;
  return { ok: true, read: results.length - errors, remaining: Math.max(0, todo - (results.length - errors)), results };
}

async function readOneStamp(env, row, opts) {
  const ex = safeJson(row.extracted, {});
  let bytes = null;
  try { const f = row.file_key ? await getFile(env, row.file_key) : null; bytes = f && (f.bytes || f); } catch (e) { bytes = null; }
  if (!bytes || !bytes.length) {
    ex.needs_stamp = false; ex.number_by_ai_tried = true; ex.stamp = { error: 'the sheet could not be read back' };
  } else {
    const ans = await callModel(env, { task: 'authority-stamp', system: STAMP_SYSTEM, prompt: STAMP_PROMPT,
      documents: [{ bytes: new Uint8Array(bytes), media_type: 'application/pdf' }], max_tokens: 1200,
      project_id: row.project_id, who: (opts.who && opts.who.name) || '' });
    // K9: AI switched off is not a reading — the sheet stays waiting.
    if (ans.error) return { id: row.id, error: ans.error, ...(ans.disabled ? { disabled: true } : {}) };
    const st = parseStamp(ans.text) || { approved: false, confidence: 'low', error: 'the answer could not be read' };
    ex.stamp = st;
    ex.needs_stamp = false;
    ex.number_by_ai_tried = true;
    // The reading is a PROPOSAL (spec §4, §27): nothing reaches the sheet or
    // the register until Document Control confirms or corrects it
    // (confirmStamps). A stamp that says nothing to apply needs no one.
    const offersNumber = ex.needs_number && st.drawing_number && plausibleNumber(st.drawing_number);
    ex.stamp_pending = !!((st.approved && st.authority) || offersNumber || (ex.kind === 'authority' && !st.approved));
  }
  await env.DB.prepare('UPDATE intake_item SET extracted = ? WHERE id = ?').bind(JSON.stringify(ex), row.id).run();
  return { id: row.id, pending: !!ex.stamp_pending, stamp: ex.stamp };
}

// Document Control's word on each AI stamp reading: accepted as read, corrected
// (the values typed), or rejected. Only then does the sheet change — its
// authority, approval number and date, a missing number — and, if it is
// already filed, the register. Each value says where it came from.
//   decisions: [{ id, accept: true|false, authority?, approval_no?, approval_date?, number? }]
export async function confirmStamps(env, batchId, decisions, who) {
  const ok = await ensureIntakeTables(env);
  if (!ok) return { error: 'intake is not available on this database' };
  const name = str((who && who.name) || who || '', 120);
  let applied = 0, rejected = 0;
  const errors = [];
  for (const dcs of (decisions || []).slice(0, 200)) {
    const row = await env.DB.prepare('SELECT * FROM intake_item WHERE id = ? AND batch_id = ?').bind(str(dcs && dcs.id, 60), String(batchId)).first().catch(() => null);
    if (!row) { errors.push({ id: dcs && dcs.id, error: 'no such sheet in this drop' }); continue; }
    const ex = safeJson(row.extracted, {});
    const st = ex.stamp || {};
    if (!ex.stamp_pending) { errors.push({ id: row.id, error: 'nothing waiting to be confirmed on this sheet' }); continue; }
    ex.stamp_pending = false;
    if (!dcs.accept) {
      ex.stamp = { ...st, rejected_by: name, rejected_at: nowISO() };
      if (ex.kind === 'authority' && !st.approved) ex.needs_decision = true;
      rejected++;
    } else {
      const typed = (k) => dcs[k] != null && String(dcs[k]).trim() !== '';
      const date = typed('approval_date') ? String(dcs.approval_date).trim() : (st.approval_date || '');
      if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) { ex.stamp_pending = true; errors.push({ id: row.id, error: 'the approval date must be YYYY-MM-DD' }); continue; }
      const auth = typed('authority') ? authorityCode(dcs.authority) || str(dcs.authority, 40) : st.authority;
      if (auth && (st.approved || typed('authority'))) {
        if (ex.authority && ex.authority !== auth) ex.folder_authority = ex.authority;
        ex.kind = 'authority';
        ex.authority = auth;
        ex.approval_no = typed('approval_no') ? str(dcs.approval_no, 60) : (st.approval_no || ex.approval_no || '');
        ex.approval_date = date || ex.approval_date || '';
        ex.kind_source = (typed('authority') || typed('approval_no') || typed('approval_date') ? 'approval stamp, corrected by ' : 'approval stamp (AI), confirmed by ') + name;
        ex.needs_decision = false;
      } else if (ex.kind === 'authority' && !st.approved) {
        ex.needs_decision = true;
      }
      const num = typed('number') ? String(dcs.number).trim().toUpperCase() : st.drawing_number;
      if (ex.needs_number && num && plausibleNumber(num)) {
        ex.number = num; ex.needs_number = false;
        ex.number_source = typed('number') ? 'typed by ' + name : 'title block (AI), confirmed by ' + name;
        if (st.drawing_title && !ex.title) ex.title = st.drawing_title;
      }
      ex.stamp = { ...st, confirmed_by: name, confirmed_at: nowISO() };
      applied++;
    }
    // A failed sheet that now has its number goes back to be filed.
    const state = row.state === 'failed' && ex.number && !ex.needs_number ? 'confirmed' : row.state;
    await env.DB.prepare('UPDATE intake_item SET extracted = ?, state = ?, error = ? WHERE id = ?')
      .bind(JSON.stringify(ex), state, state === 'confirmed' ? null : row.error, row.id).run();
    // Already in the register: bring its authority, approval number and date up to date.
    if (dcs.accept && row.state === 'filed' && row.target_id && ex.kind === 'authority') {
      try {
        await ensureAuthorityColumns(env);
        await env.DB.prepare(
          `UPDATE drawings SET kind = 'authority', authority = ?, approval_no = ?, approval_date = ?
            WHERE project_id = ? AND id = ?`
        ).bind(ex.authority || null, ex.approval_no || null, ex.approval_date || null, row.project_id, row.target_id).run();
      } catch (e) { /* the register keeps what it had */ }
    }
  }
  return { ok: true, applied, rejected, errors };
}


// ---------------------------------------------------------------- A1, on a sheet in a drop
//
// K9 (v5 A1): the AI's reading of a scanned sheet's title block is a proposal
// kept on its own (ai-readers.js). Only the values Document Control confirmed
// or typed reach the item, each with where it came from; a value read by rule
// is never replaced by the AI's (the person may type over it). The sheet then
// files as any other — and waits for the PM (drawings.js saveDrawing).
export async function getItemOn(env, pid, id) {
  await ensureIntakeTables(env);
  const row = await env.DB.prepare('SELECT * FROM intake_item WHERE id = ? AND project_id = ?').bind(String(id || ''), String(pid || '')).first();
  return row || null;
}
// What the item says now, field by field, and where each value came from —
// what the AI's reading is checked against.
export function itemSheetValues(row) {
  const ex = safeJson(row.extracted, {});
  const src = (s, d) => String(s || d).replace(/^the /, '');
  return {
    current: { number: ex.number || '', revision: ex.revision || '', title: ex.title || '', date: ex.sheet_date || '', discipline: ex.discipline || '' },
    sources: { number: src(ex.number_source, 'file name'), revision: src(ex.revision_source, 'file name'), title: src(ex.title_source, 'file name'),
      date: src(ex.date_source, 'sheet'), discipline: src(ex.discipline_source, 'file name') },
  };
}
export async function applySheetToItem(env, row, values, how, prov, who) {
  if (['filed', 'held', 'archived', 'abandoned', 'skipped'].includes(row.state)) {
    return { error: 'that sheet is already ' + row.state + ' — the AI’s reading is applied before filing' };
  }
  const ex = safeJson(row.extracted, {});
  const name = str((who && who.name) || who || '', 120);
  for (const [f, v] of Object.entries(values)) {
    ex[f === 'date' ? 'sheet_date' : f] = v;
    ex[f + '_source'] = how[f] === 'ai' ? 'title block (AI, confirmed by ' + name + ')' : 'typed by ' + name;
  }
  if (values.number) { ex.needs_number = false; if (row.family === 'drawing') ex.needs_decision = false; }
  ex.ai_read = prov;
  const state = row.state === 'failed' && !(ex.number && !ex.needs_number) ? 'failed' : 'confirmed';
  await env.DB.prepare('UPDATE intake_item SET extracted = ?, state = ?, error = ?, decided_by = ?, decided_at = ? WHERE id = ?')
    .bind(JSON.stringify(ex), state, state === 'confirmed' ? null : row.error, name, nowISO(), row.id).run();
  return { ok: true, id: row.id, state };
}
