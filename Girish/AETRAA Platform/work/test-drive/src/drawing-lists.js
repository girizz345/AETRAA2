// E11 — DRAWING LISTS (approved 5 Oct 2026, deterministic).
//
// The designer's or consultant's drawing list (Excel) says which sheets exist
// and at what revision. Compared with the register it shows:
//
//   missing   listed, but no sheet of that number is in the register — the sheet
//             has not been received. On the PM's approval it becomes "awaited".
//   changed   in the register, but the list gives another revision (or title):
//             the listed revision is awaited.
//   not listed  in the register but not on the list: shown, nothing done to it.
//   same      listed and in the register at the listed revision.
//
// Steps: DC drops the list → reviews the comparison → PM approves → the
// register gains the awaited sheets. When the real sheet arrives through any
// route, its "awaited" placeholder is retired (drawings.js saveDrawing).
//
// No AI. The same file always gives the same comparison against the same
// register: every row is reported as read or not read, with the reason, and
// the output is sorted by drawing number.

import { addColumns } from './db-cols.js';

const nowISO = () => new Date().toISOString();
const uid = (p) => p + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const str = (v, n = 300) => String(v == null ? '' : v).slice(0, n);
const safeJson = (s, f) => { try { const v = JSON.parse(s || ''); return v == null ? f : v; } catch (e) { return f; } };
export const LIST_EXTRACTOR = 'drawing-list-2026.10.06';

let ready = false;
export async function ensureListTables(env) {
  if (ready) return true;
  try {
    await env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS drawing_lists (
         id TEXT PRIMARY KEY, project_id TEXT NOT NULL, filename TEXT, sha256 TEXT, extractor TEXT,
         rows TEXT, comparison TEXT, state TEXT, uploaded_by TEXT, uploaded_at TEXT,
         confirmed_by TEXT, confirmed_at TEXT, approved_by TEXT, approved_at TEXT, result TEXT)`
    ).run();
    await addColumns(env, 'drawings', [['awaited_from', 'TEXT']]);
    ready = true;
    return true;
  } catch (e) { return false; }
}

// Which column is which, from the header row. Deterministic: the first header
// cell matching each pattern, in this order.
const COLS = {
  number: /^(drawing|dwg|sheet)?\s*(no\.?|number|num|#|ref(erence)?)$|^drawing\s*no|^dwg\s*no|^sheet\s*no|^number$/i,
  title: /^(drawing\s*)?(title|description|name)$/i,
  revision: /^(rev(ision)?|rev\.?\s*no\.?|current\s*rev(ision)?)$/i,
  date: /^(rev(ision)?\s*)?date$|^issue\s*date$|^date\s*of\s*issue$/i,
  discipline: /^(discipline|trade|package)$/i,
  status: /^(status|issue\s*status|purpose(\s*of\s*issue)?|suitability)$/i,
};
export function mapListColumns(header) {
  const at = {};
  const cells = (header || []).map((h) => String(h || '').replace(/\s+/g, ' ').trim());
  for (const [k, re] of Object.entries(COLS)) {
    const i = cells.findIndex((c, j) => re.test(c) && !Object.values(at).includes(j));
    if (i >= 0) at[k] = i;
  }
  return at;
}

const normNo = (s) => String(s || '').trim().toUpperCase().replace(/\s+/g, '');
const normRev = (s) => String(s || '').trim().toUpperCase().replace(/^REV\.?\s*/, '');

// Every row read or not read, with the reason.
export function readList(header, rows) {
  const at = mapListColumns(header);
  if (at.number == null) return { error: 'No drawing number column was found. The header needs a column such as "Drawing No".', columns: at, rows: [] };
  const out = [], seen = new Set();
  (rows || []).forEach((r, i) => {
    const cell = (k) => (at[k] == null ? '' : str(r[at[k]], 200).trim());
    const number = normNo(cell('number'));
    const row = { line: i + 1, number, title: cell('title'), revision: normRev(cell('revision')), date: cell('date'),
                  discipline: cell('discipline'), status: cell('status') };
    if (!number) { out.push({ ...row, read: false, reason: 'no drawing number on this line' }); return; }
    if (!/\d/.test(number) || number.length < 3) { out.push({ ...row, read: false, reason: '"' + number + '" does not look like a drawing number' }); return; }
    if (seen.has(number)) { out.push({ ...row, read: false, reason: number + ' is listed twice; the first line is used' }); return; }
    seen.add(number);
    out.push({ ...row, read: true });
  });
  return { columns: at, rows: out };
}

// The comparison with the register's live sheets.
export function compareList(listRows, register, previousNumbers) {
  const live = new Map();
  for (const d of register || []) {
    if (d.status === 'current' || d.status === 'awaited') {
      const k = normNo(d.number);
      const prev = live.get(k);
      if (!prev || d.status === 'current') live.set(k, d);
    }
  }
  const prevSet = new Set((previousNumbers || []).map(normNo));
  const missing = [], changed = [], same = [], fresh = [];
  const listed = new Set();
  for (const r of listRows.filter((x) => x.read)) {
    listed.add(r.number);
    if (previousNumbers && previousNumbers.length && !prevSet.has(r.number)) fresh.push(r.number);
    const d = live.get(r.number);
    if (!d) { missing.push(r); continue; }
    if (d.status === 'awaited') { (normRev(d.revision) === r.revision ? same : changed).push({ ...r, register_revision: d.revision || '', register_status: 'awaited' }); continue; }
    const revDiff = r.revision && normRev(d.revision) !== r.revision;
    const titleDiff = r.title && d.title && r.title.trim().toLowerCase() !== String(d.title).trim().toLowerCase();
    if (revDiff || titleDiff) changed.push({ ...r, register_revision: d.revision || '', register_title: d.title || '', revision_changed: !!revDiff, title_changed: !!titleDiff });
    else same.push(r);
  }
  const notListed = [...live.values()].filter((d) => d.status === 'current' && !listed.has(normNo(d.number)))
    .map((d) => ({ number: d.number, revision: d.revision || '', title: d.title || '' }));
  const byNo = (a, b) => (a.number < b.number ? -1 : a.number > b.number ? 1 : 0);
  return { missing: missing.sort(byNo), changed: changed.sort(byNo), same: same.sort(byNo), not_listed: notListed.sort(byNo),
           new_on_list: fresh.sort(), counts: { missing: missing.length, changed: changed.length, same: same.length, not_listed: notListed.length } };
}

export async function saveList(env, pid, filename, sha, read, comparison, who) {
  await ensureListTables(env);
  const id = uid('dl');
  await env.DB.prepare(
    `INSERT INTO drawing_lists (id, project_id, filename, sha256, extractor, rows, comparison, state, uploaded_by, uploaded_at)
     VALUES (?,?,?,?,?,?,?,?,?,?)`
  ).bind(id, pid, str(filename, 300), sha, LIST_EXTRACTOR, JSON.stringify(read), JSON.stringify(comparison), 'proposed',
         str(who, 120), nowISO()).run();
  return id;
}

export async function getList(env, pid, id) {
  await ensureListTables(env);
  const r = await env.DB.prepare('SELECT * FROM drawing_lists WHERE id = ? AND project_id = ?').bind(String(id), pid).first();
  return r ? { ...r, rows: safeJson(r.rows, {}), comparison: safeJson(r.comparison, {}), result: safeJson(r.result, null) } : null;
}

export async function listLists(env, pid) {
  await ensureListTables(env);
  const { results } = await env.DB.prepare(
    'SELECT id, filename, state, uploaded_by, uploaded_at, confirmed_by, confirmed_at, approved_by, approved_at, comparison FROM drawing_lists WHERE project_id = ? ORDER BY uploaded_at DESC'
  ).bind(pid).all();
  return (results || []).map((r) => ({ ...r, comparison: undefined, counts: (safeJson(r.comparison, {}).counts) || {} }));
}

// The numbers of the last approved list, so "new on this list" can be shown.
export async function previousNumbers(env, pid) {
  await ensureListTables(env);
  const r = await env.DB.prepare(
    "SELECT rows FROM drawing_lists WHERE project_id = ? AND state = 'approved' ORDER BY approved_at DESC LIMIT 1"
  ).bind(pid).first().catch(() => null);
  return r ? (safeJson(r.rows, {}).rows || []).filter((x) => x.read).map((x) => x.number) : [];
}

// DC confirms the changes (step 2); sheets the DC unticks are left out.
export async function confirmList(env, pid, id, exclude, who) {
  const l = await getList(env, pid, id);
  if (!l) return { error: 'no such drawing list' };
  if (l.state === 'approved') return { error: 'this list is already approved' };
  const ex = new Set((exclude || []).map(normNo));
  const c = l.comparison;
  c.excluded = [...ex];
  await env.DB.prepare('UPDATE drawing_lists SET comparison = ?, state = ?, confirmed_by = ?, confirmed_at = ? WHERE id = ?')
    .bind(JSON.stringify(c), 'confirmed', str(who, 120), nowISO(), l.id).run();
  return { ok: true, state: 'confirmed', excluded: c.excluded.length };
}

// PM approves (step 3): the register gains the awaited sheets.
export async function approveList(env, pid, id, who) {
  const l = await getList(env, pid, id);
  if (!l) return { error: 'no such drawing list' };
  if (l.state === 'approved') return { ok: true, already: true, result: l.result };
  if (l.state !== 'confirmed') return { error: 'Document Control confirms the changes before the PM approves them.' };
  const c = l.comparison, ex = new Set(c.excluded || []);
  let added = 0;
  const now = nowISO();
  for (const r of [...(c.missing || []), ...(c.changed || [])]) {
    if (ex.has(r.number) || !r.read) continue;
    // One awaited placeholder per number: a later list replaces an earlier one.
    await env.DB.prepare("DELETE FROM drawings WHERE project_id = ? AND number = ? AND status = 'awaited'").bind(pid, r.number).run();
    await env.DB.prepare(
      `INSERT INTO drawings (project_id, id, number, revision, title, kind, discipline, status, uploaded_by, uploaded_at, awaited_from)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`
    ).bind(pid, uid('dwg'), r.number, r.revision || null, r.title || null, 'ifc', r.discipline || null, 'awaited',
           str(who, 120), now, l.id).run();
    added++;
  }
  const result = { awaited: added, excluded: ex.size };
  await env.DB.prepare('UPDATE drawing_lists SET state = ?, approved_by = ?, approved_at = ?, result = ? WHERE id = ?')
    .bind('approved', str(who, 120), now, JSON.stringify(result), l.id).run();
  return { ok: true, state: 'approved', result };
}
