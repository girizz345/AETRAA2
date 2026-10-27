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

import { classifyFile, groupOf, summarise, FAMILIES } from './intake-classify.js';
import { checkIncoming, ensureGateColumns } from './gate.js';
import { hold } from './quarantine.js';
import { addDocument, CLASSES } from './library.js';
import { putFile } from './storage.js';

const nowISO = () => new Date().toISOString();
const uid = (p) => p + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const str = (v, n = 300) => String(v == null ? '' : v).slice(0, n);

export const BATCH_STATES = ['scanning', 'reviewing', 'committing', 'partly_committed', 'done', 'abandoned'];
export const ITEM_STATES = ['proposed', 'confirmed', 'filed', 'held', 'rejected', 'skipped', 'failed'];

let ready = false;
export async function ensureIntakeTables(env) {
  if (ready) return true;
  try {
    await env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS intake_batch (
         id TEXT PRIMARY KEY, project_id TEXT NOT NULL, org_id TEXT,
         started_by TEXT, started_at TEXT, finished_at TEXT,
         status TEXT, file_count INTEGER, summary TEXT, scope TEXT)`
    ).run();
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
  return !allow || allow.includes(family) || family === 'unknown';
}

// ---------------------------------------------------------------- batches

export async function openBatch(env, pid, who, opts = {}) {
  const ok = await ensureIntakeTables(env);
  if (!ok) return { error: 'intake is not available on this database' };
  const id = uid('bat');
  try {
    await env.DB.prepare(
      `INSERT INTO intake_batch (id, project_id, org_id, started_by, started_at, status,
         file_count, summary, scope) VALUES (?,?,?,?,?,?,?,?,?)`
    ).bind(id, pid, str(opts.org_id, 60) || null, str((who && who.name) || who || '', 120),
           nowISO(), 'scanning', 0, '{}', opts.scope === 'drawings' ? 'drawings' : 'full').run();
  } catch (e) { return { error: 'could not open a batch' }; }
  return { ok: true, id, scope: opts.scope === 'drawings' ? 'drawings' : 'full' };
}

export async function getBatch(env, id) {
  const ok = await ensureIntakeTables(env);
  if (!ok) return null;
  try {
    const b = await env.DB.prepare('SELECT * FROM intake_batch WHERE id = ?').bind(String(id)).first();
    if (!b) return null;
    const { results } = await env.DB.prepare(
      'SELECT * FROM intake_item WHERE batch_id = ? ORDER BY rowid'
    ).bind(String(id)).all();
    const items = (results || []).map(shapeItem);
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

  let c;
  try {
    c = classifyFile({ filename, path }, probe || {});
  } catch (e) {
    c = { family: 'unknown', reason: 'the file could not be read', record_type: null };
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
  let g = { verdict: 'unknown', reason: '', evidence: null };
  try {
    g = checkIncoming(project, {
      kind: c.family === 'drawing' ? 'drawing' : c.family,
      number: c.number || (c.extracted && c.extracted.number) || '',
      filename, text: (probe && probe.text) || '',
    });
  } catch (e) { /* gate unavailable: unknown, which files and says so */ }

  let key = null;
  if (bytes && bytes.length) {
    key = 'intake/' + project.id + '/' + uid('f');
    const put = await putFile(env, key, bytes, file.mime || 'application/octet-stream');
    if (!put || put.error) key = null;
  }

  const extracted = {
    ...(c.number ? { number: c.number } : {}),
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
    needs_decision:
      (c.family === 'logo' && !c.party) ||
      (c.family === 'template' && !c.template_type) ||
      (c.family === 'commercial' && !c.commercial_kind) ||
      false,
  };

  const id = uid('itm');
  try {
    await env.DB.prepare(
      `INSERT INTO intake_item (id, batch_id, project_id, filename, path, bytes, sha256,
         family, record_type, verdict, reason, evidence, extracted, state, file_key)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
    ).bind(id, batchId, project.id, filename, path, bytes ? bytes.length : 0, sha,
           c.family, c.record_type || null, g.verdict,
           str(c.reason, 300) + (g.verdict === 'conflict' ? ' · ' + str(g.reason, 300) : ''),
           JSON.stringify(g.evidence || null), JSON.stringify(extracted), 'proposed', key).run();
  } catch (e) { return { error: 'could not record that file' }; }

  try {
    await env.DB.prepare('UPDATE intake_batch SET file_count = file_count + 1 WHERE id = ?')
      .bind(batchId).run();
  } catch (e) { /* count is cosmetic */ }

  return { ok: true, id, family: c.family, family_label: FAMILIES[c.family] || c.family,
           verdict: g.verdict, reason: c.reason, already_filed: already,
           group: groupOf({ ...extracted, family: c.family, verdict: g.verdict }) };
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
      const extracted = { ...safeJson(row.extracted, {}), ...(d.extracted || {}) };
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
  return { ok: true, changed, errors };
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

    const extracted = safeJson(row.extracted, {});

    // A conflict never files. It goes to the queue with the reason attached, so
    // the Admin decides rather than the engine.
    if (row.verdict === 'conflict') {
      try {
        const held = await hold(env, row.project_id, {
          item_id: row.id, file_key: row.file_key, filename: row.filename,
          kind: row.family, reason: row.reason, evidence: safeJson(row.evidence, null),
        }, who);
        await setItem(env, id, 'held', held && held.id, null);
        out.push({ id, ok: true, held: true, quarantine_id: held && held.id, reason: row.reason });
      } catch (e) {
        await setItem(env, id, 'failed', null, 'could not hold this item');
        out.push({ id, ok: false, error: 'could not hold this item' });
      }
      continue;
    }

    try {
      const r = await fileOne(env, row, extracted, project, who, routes);
      if (r && r.error) {
        // A failure is recorded on the item and the loop continues. One bad
        // file never costs the operator the rest of the batch.
        await setItem(env, id, 'failed', null, r.error);
        out.push({ id, ok: false, error: r.error });
      } else {
        await setItem(env, id, 'filed', (r && r.target_id) || null, null);
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
  return { ok: true, results: out };
}

async function setItem(env, id, state, targetId, error) {
  try {
    await env.DB.prepare('UPDATE intake_item SET state = ?, target_id = ?, error = ? WHERE id = ?')
      .bind(state, targetId || null, error || null, id).run();
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
async function fileOne(env, row, extracted, project, who, routes) {
  const fam = row.family;
  const pid = row.project_id;
  const bytes = routes.getBytes ? await routes.getBytes(row.file_key) : null;

  if (fam === 'programme') {
    if (!routes.programme) return { error: 'the programme importer is not wired in' };
    const r = await routes.programme(pid, bytes, row.filename);
    return r && r.error ? r : { where: 'the programme', target_id: null };
  }

  if (fam === 'commercial') {
    const kind = extracted.commercial_kind === 'bom' ? 'bom' : 'boq';
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
      return r && r.error ? r : { where: 'the bill of materials (' + rows.length + ' lines)' };
    }
    if (!routes.boq) return { error: 'the BOQ importer is not wired in' };
    const r = await routes.boq(pid, rows);
    return r && r.error ? r : { where: 'the priced BOQ (' + rows.length + ' lines)' };
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

  if (fam === 'drawing') {
    if (!routes.drawing) return { error: 'the drawing register is not wired in' };
    const r = await routes.drawing(pid, { ...extracted, filename: row.filename, r2_key: row.file_key }, who);
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

  const out = [];
  for (const r of rows) {
    const seg = String(r.path).split(/[\\/]+/).filter(Boolean).pop();
    if (!seg) continue;
    out.push({ pattern: seg, family: r.family, times_seen: r.n, confirmed: false });
  }
  return out;
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
