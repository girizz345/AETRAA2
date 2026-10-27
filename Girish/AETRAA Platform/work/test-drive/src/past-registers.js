// K6 · v5 E12: PAST REGISTERS.
//
//   1 Document Control drops an RFI / submittal / material / NCR log (Excel) from the old system
//   2 its columns are mapped to the platform's (reference, subject, dates, status, code)
//     with a preview; DC fixes unmapped columns and odd statuses
//   3 confirming creates the records as imported (K5): closed, status Imported, the old
//     status and dates kept as facts, no clock anywhere
//
// THE E-PROGRAM CONDITION. The same file read under the same mapping always
// gives the same proposal; the proposal is kept against the file's SHA-256 and
// this reader's version, rows in sheet order; every row is reported as read,
// not read or held, with the reason, and the counts add up to the sheet.
// No AI here.
//
// WHAT IS HELD FOR DOCUMENT CONTROL (spec §18, §27), never guessed:
//   - a reference listed twice in the log (both rows)
//   - a reference already on this project (raised here, or imported before)
//   - a date that reads two ways (03/04/2025) when the log itself does not
//     settle which way round it writes dates — unless DC says so once
//   - a date that is not a date, or is after the day the log was read
//   - a status the platform does not know, until DC says what it means
// These are DC's to resolve on the screen; they are not the AETRAA held queue.

import { readBillFile } from './bills.js';
import { importRecords, RECORD_TYPES, ensureRecordsTable } from './records.js';
import { putFile, getFile } from './storage.js';

export const PAST_READER = 'past-registers-1';
export const LOG_TYPES = { rfi: 'RFI log', submittal: 'Submittal log', material: 'Material approval log', ncr: 'NCR log' };

const nowISO = () => new Date().toISOString();
const uid = (p) => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const clean = (s) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
const norm = (s) => clean(s).toLowerCase().replace(/[.:#]+/g, ' ').replace(/\s+/g, ' ').trim();
const parse = (v, d) => { try { const j = JSON.parse(v || ''); return j == null ? d : j; } catch (e) { return d; } };

/* ------------------------------------------------------------ the log's words */

// Platform field ← header words. A log's own running number ("Sr", "S.No") is
// never the reference.
export const LOG_FIELDS = {
  ref:         { label: 'Reference', words: [/^(rfi|sub(mittal)?|mar|ma|mat(erial)?|ncr|doc(ument)?|transmittal)\s*(no|number|ref|reference)?$/, /^ref(erence)?(\s*no|\s*number)?$/, /^(our|document)\s*ref/] },
  subject:     { label: 'Subject', words: [/^subject/, /^title/, /^description/, /^material/, /^item$/, /^details/, /^non.?conformance/] },
  raised:      { label: 'Date raised / submitted', words: [/^date\s*(raised|submitted|of submission|sent)?$/, /^(raised|submitted|submission|sent)(\s*(on|date))?$/, /^date of (raising|submittal)/] },
  issued:      { label: 'Date issued', words: [/^(date\s*)?issued(\s*(on|date))?$/, /^date of issue/] },
  reply_due:   { label: 'Reply due', words: [/^reply\s*(due|by)/, /^due(\s*date)?$/, /^required\s*by/, /^response\s*(due|required)/, /^target\s*date/] },
  replied:     { label: 'Date replied / returned', words: [/^(date\s*)?(replied|returned|answered|closed)(\s*(on|date))?$/, /^(reply|response|return)\s*date/, /^date of (reply|response|return)/] },
  status:      { label: 'Status', words: [/^status/, /^current status/, /^action/] },
  code:        { label: 'Consultant code', words: [/^code$/, /^(consultant|approval|action|review)\s*code/] },
  discipline:  { label: 'Discipline', words: [/^discipline/, /^trade$/, /^dept/] },
  revision:    { label: 'Revision', words: [/^rev(ision)?(\s*no)?$/] },
  remarks:     { label: 'Remarks', words: [/^remarks?/, /^comments?/, /^notes?$/] },
};
const DATE_FIELDS = ['raised', 'issued', 'reply_due', 'replied'];

// What an old status means. Unknown ones are held until DC says (STATUS_VERSION).
export const STATUS_VERSION = 'status-1';
const STATUS_WORDS = [
  [/^(code\s*)?a\b|^approved$|^approved as submitted|^no objection/i, 'Code A — Approved'],
  [/^(code\s*)?b\b|approved as noted|approved with comments|approved subject to/i, 'Code B — Approved as noted'],
  [/^(code\s*)?c\b|revise and resubmit|revise & resubmit|resubmit/i, 'Code C — Revise & resubmit'],
  [/^(code\s*)?d\b|^rejected|not approved/i, 'Code D — Rejected'],
  [/^(open|pending|under review|awaiting( reply| response)?|submitted|in progress|issued|with consultant)$/i, 'Open'],
  [/^(closed|answered|replied|responded|returned|complete(d)?|done)$/i, 'Closed — answered'],
  [/^(withdrawn|cancelled|canceled|superseded|void)$/i, 'Withdrawn'],
];
export const STATUS_CHOICES = ['Code A — Approved', 'Code B — Approved as noted', 'Code C — Revise & resubmit', 'Code D — Rejected', 'Open', 'Closed — answered', 'Withdrawn'];
export function statusOf(raw, map) {
  const s = clean(raw);
  if (!s) return { value: null };
  if (map && map[s] != null) return { value: map[s] === 'keep' ? s : map[s] };
  const hit = STATUS_WORDS.find(([re]) => re.test(s));
  return hit ? { value: hit[1] } : { unknown: s };
}

/* ------------------------------------------------------------ dates */

const pad = (n) => String(n).padStart(2, '0');
const iso = (y, m, d) => {
  const t = Date.UTC(y, m - 1, d);
  const x = new Date(t);
  return x.getUTCFullYear() === y && x.getUTCMonth() === m - 1 && x.getUTCDate() === d ? y + '-' + pad(m) + '-' + pad(d) : null;
};
const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };
// A cell as a date: Excel serial (1900 or 1904), ISO, dd/mm/yyyy or mm/dd/yyyy,
// "3-Apr-2025". Returns { date } or { both: [dmy, mdy] } or { bad }.
export function readDate(raw, opts = {}) {
  const s = clean(raw);
  if (!s) return {};
  if (/^\d+(\.\d+)?$/.test(s)) {
    const n = Math.floor(Number(s));
    if (n > 3000 && n < 80000) {
      const base = opts.date1904 ? Date.UTC(1904, 0, 1) : Date.UTC(1899, 11, 30);
      const d = new Date(base + n * 86400000);
      return { date: d.toISOString().slice(0, 10) };
    }
    return { bad: s };
  }
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s].*)?$/);
  if (m) { const d = iso(+m[1], +m[2], +m[3]); return d ? { date: d } : { bad: s }; }
  m = s.match(/^(\d{1,2})[-\s/.]([A-Za-z]{3,9})[-\s/.,]+(\d{2,4})$/);
  const mon = m && (MONTHS[m[2].slice(0, 4).toLowerCase()] || MONTHS[m[2].slice(0, 3).toLowerCase()]);
  if (mon) {
    const y = +m[3] < 100 ? 2000 + +m[3] : +m[3];
    const d = iso(y, mon, +m[1]);
    return d ? { date: d } : { bad: s };
  }
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (m) {
    const a = +m[1], b = +m[2], y = +m[3] < 100 ? 2000 + +m[3] : +m[3];
    const dmy = iso(y, b, a), mdy = iso(y, a, b);
    if (opts.order === 'dmy') return dmy ? { date: dmy } : { bad: s };
    if (opts.order === 'mdy') return mdy ? { date: mdy } : { bad: s };
    if (dmy && mdy && dmy !== mdy) return { both: [dmy, mdy], dmyOnly: false };
    if (dmy || mdy) return { date: dmy || mdy, proves: dmy && !mdy ? 'dmy' : !dmy && mdy ? 'mdy' : null };
    return { bad: s };
  }
  return { bad: s };
}

/* ------------------------------------------------------------ mapping */

export function guessMapping(header) {
  const map = {};
  const cells = header.map(norm);
  for (const [field, def] of Object.entries(LOG_FIELDS)) {
    for (let i = 0; i < cells.length; i++) {
      if (!cells[i] || Object.values(map).includes(i)) continue;
      if (def.words.some((re) => re.test(cells[i]))) { map[field] = i; break; }
    }
  }
  return map;
}
function headerRow(rows) {
  let best = null;
  for (let i = 0; i < Math.min(rows.length, 25); i++) {
    const words = rows[i].cells.filter((x) => clean(x) && isNaN(Number(String(x).replace(/,/g, ''))));
    if (words.length < 2) continue;
    const map = guessMapping(rows[i].cells);
    const score = Object.keys(map).length + (map.ref != null ? 3 : 0);
    if (!best || score > best.score) best = { index: i, score, map };
  }
  return best;
}
// The log's type from its references, when DC has not said.
function typeFromRefs(refs) {
  const n = { rfi: 0, submittal: 0, material: 0, ncr: 0 };
  for (const r of refs) {
    const s = String(r).toUpperCase();
    if (/\bRFI\b/.test(s)) n.rfi++;
    else if (/\bNCR\b/.test(s)) n.ncr++;
    else if (/\b(MAR|MA|MAT)\b/.test(s)) n.material++;
    else if (/\b(SUB|SD|SH)\b/.test(s)) n.submittal++;
  }
  const best = Object.entries(n).sort((a, b) => b[1] - a[1])[0];
  return best[1] ? best[0] : null;
}
const PREFIXES = { rfi: ['RFI'], submittal: ['SUB', 'SD', 'SH', 'SDS', 'MS'], material: ['MAR', 'MA', 'MAT', 'MTS'], ncr: ['NCR'] };
function otherTypeRef(type, ref) {
  const s = String(ref).toUpperCase();
  for (const [t, pre] of Object.entries(PREFIXES)) {
    if (t === type) continue;
    if (pre.some((p) => new RegExp('(^|[^A-Z])' + p + '([^A-Z]|$)').test(s)) && !PREFIXES[type].some((p) => new RegExp('(^|[^A-Z])' + p + '([^A-Z]|$)').test(s))) return t;
  }
  return null;
}

/* ------------------------------------------------------------ the proposal */

let ready = false;
export async function ensurePastTables(env) {
  if (ready) return true;
  try {
    await env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS past_import (
         id TEXT PRIMARY KEY, project_id TEXT NOT NULL, org_id TEXT, type TEXT, filename TEXT, sha256 TEXT,
         reader TEXT, sheet TEXT, mapping TEXT, status_map TEXT, date_order TEXT, read_at TEXT,
         state TEXT, counts TEXT, rows TEXT, sheets TEXT, header_row INTEGER, file_key TEXT,
         created_by TEXT, created_at TEXT, confirmed_by TEXT, confirmed_at TEXT, created_count INTEGER)`
    ).run();
    await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_past_import_p ON past_import(project_id, sha256)').run();
    await ensureRecordsTable(env);
    ready = true;
    return true;
  } catch (e) { return false; }
}

async function sha256Hex(u8) {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', u8))].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Read the log under a mapping. Pure apart from the project's existing
// references (for collisions), which are passed in.
export function proposeRows(book, sheetName, opts, existing) {
  const sheets = (book.sheets || []).map((s) => ({ name: s.name, rows: s.rows.filter((r) => r.cells.some((x) => clean(x))).length }));
  const sh = (book.sheets || []).find((s) => s.name === sheetName) || (book.sheets || []).find((s) => headerRow(s.rows)) || (book.sheets || [])[0];
  if (!sh) return { error: 'that workbook has no sheets' };
  const h = headerRow(sh.rows);
  if (!h) return { error: 'no header row was found on the sheet "' + sh.name + '" — the log needs a row naming its columns (RFI No, Subject, Date, Status…)' };
  const header = sh.rows[h.index].cells.map(clean);
  const mapping = { ...h.map, ...(opts.mapping || {}) };
  for (const k of Object.keys(mapping)) if (mapping[k] == null || mapping[k] === '' || mapping[k] < 0) delete mapping[k];
  const at = (cells, f) => (mapping[f] == null ? '' : clean(cells[mapping[f]]));
  const refs = sh.rows.slice(h.index + 1).map((r) => at(r.cells, 'ref')).filter(Boolean);
  const type = opts.type && LOG_TYPES[opts.type] ? opts.type : typeFromRefs(refs);
  if (!type) return { error: 'say which log this is — RFI, submittal, material approval or NCR', need_type: true, header, sheets, sheet: sh.name };
  // The log settles its own date order when any date can only be read one way.
  let order = opts.date_order === 'dmy' || opts.date_order === 'mdy' ? opts.date_order : null;
  if (!order) {
    const proofs = new Set();
    for (const r of sh.rows.slice(h.index + 1)) for (const f of DATE_FIELDS) {
      const d = readDate(at(r.cells, f), { date1904: book.date1904 });
      if (d.proves) proofs.add(d.proves);
    }
    if (proofs.size === 1) order = [...proofs][0];
  }
  const readAt = opts.read_at;
  const counts = { rows: 0, read: 0, not_read: 0, held: 0, already: 0, blank: 0 };
  const seen = new Map();
  const rows = [];
  for (const r of sh.rows.slice(h.index + 1)) {
    if (!r.cells.some((x) => clean(x))) { counts.blank++; continue; }
    counts.rows++;
    const out = { row: r.n, ref: at(r.cells, 'ref'), subject: at(r.cells, 'subject') };
    rows.push(out);
    if (!out.ref) { out.outcome = 'not read'; out.why = out.subject ? 'a heading — no reference' : 'no reference'; continue; }
    const other = otherTypeRef(type, out.ref);
    if (other) { out.outcome = 'not read'; out.why = 'a ' + LOG_TYPES[other].replace(/ log$/, '') + ' reference in the ' + LOG_TYPES[type]; continue; }
    const k = out.ref.toLowerCase();
    if (seen.has(k)) {
      out.outcome = 'held'; out.why = out.ref + ' is listed twice in this log (rows ' + seen.get(k).row + ' and ' + r.n + ')';
      const first = seen.get(k);
      if (first.outcome === 'read') { first.outcome = 'held'; first.why = out.why; }
      continue;
    }
    seen.set(k, out);
    const ex = existing.get(k);
    if (ex) {
      if (ex.imported && opts.sha256 && ex.sha256 === opts.sha256) { out.outcome = 'already'; out.why = 'already imported from this log'; }
      else { out.outcome = 'held'; out.why = out.ref + ' is already on this project (' + (ex.imported ? 'imported before' : 'raised here') + ')'; }
      continue;
    }
    // Dates.
    const dates = {}, problems = [];
    for (const f of DATE_FIELDS) {
      const raw = at(r.cells, f);
      if (!raw) continue;
      const d = readDate(raw, { date1904: book.date1904, order });
      if (d.both) problems.push(LOG_FIELDS[f].label + ' "' + raw + '" reads as ' + d.both[0] + ' or ' + d.both[1] + ' — say how this log writes dates');
      else if (d.bad) problems.push(LOG_FIELDS[f].label + ' "' + raw + '" is not a date');
      else if (d.date && readAt && d.date > readAt.slice(0, 10) && f !== 'reply_due') problems.push(LOG_FIELDS[f].label + ' ' + d.date + ' is after the day this log was read');
      else if (d.date) dates[f] = d.date;
    }
    // Status and code.
    const st = statusOf(at(r.cells, 'status'), opts.status_map);
    const cd = at(r.cells, 'code') ? statusOf(at(r.cells, 'code'), opts.status_map) : { value: null };
    // A consultant's code the platform knows settles it, whatever the status column says.
    if (st.unknown && !(cd.value && /^Code/.test(cd.value))) problems.push('the status "' + st.unknown + '" is not one the platform knows — say what it means');
    if (cd.unknown) problems.push('the code "' + cd.unknown + '" is not one the platform knows — say what it means');
    out.dates = dates;
    out.status = (cd.value && /^Code/.test(cd.value) ? cd.value : st.value) || null;
    out.extra = {};
    for (const f of ['discipline', 'revision', 'remarks']) if (at(r.cells, f)) out.extra[f] = at(r.cells, f);
    if (problems.length) { out.outcome = 'held'; out.why = problems.join('; '); continue; }
    out.outcome = 'read';
  }
  for (const x of rows) counts[x.outcome === 'not read' ? 'not_read' : x.outcome]++;
  const unknownStatuses = [...new Set(sh.rows.slice(h.index + 1).flatMap((r) => [at(r.cells, 'status'), at(r.cells, 'code')])
    .map((s) => statusOf(s, opts.status_map)).filter((x) => x.unknown).map((x) => x.unknown))].sort();
  // The highest reference per prefix in the log, and the gaps in its sequence (spec §18).
  const nums = rows.filter((x) => x.ref).map((x) => ({ ref: x.ref, m: String(x.ref).toUpperCase().match(/^([A-Z]+)[-\s]*0*(\d+)$/) })).filter((x) => x.m);
  const byPre = {};
  for (const x of nums) (byPre[x.m[1]] || (byPre[x.m[1]] = new Set())).add(Number(x.m[2]));
  const sequence = Object.entries(byPre).map(([p, set]) => {
    const list = [...set].sort((a, b) => a - b);
    const gaps = [];
    for (let i = 1; i <= list[list.length - 1] && gaps.length < 50; i++) if (!set.has(i)) gaps.push(i);
    return { prefix: p, highest: list[list.length - 1], count: list.length, missing: gaps };
  });
  return {
    type, sheet: sh.name, sheets, header_row: sh.rows[h.index].n, header, mapping, date_order: order, date_order_settled: !!order,
    counts, rows, unknown_statuses: unknownStatuses, sequence,
    adds_up: counts.read + counts.not_read + counts.held + counts.already === counts.rows,
  };
}

async function existingRefs(env, pid) {
  const { results } = await env.DB.prepare('SELECT ref, imported, imported_from FROM records WHERE project_id = ?').bind(pid).all();
  const m = new Map();
  for (const r of results || []) m.set(String(r.ref).toLowerCase(), { imported: !!Number(r.imported || 0), sha256: (parse(r.imported_from, {}) || {}).sha256 || null });
  return m;
}

// DC drops the log: read it, keep the proposal. The same file under the same
// mapping returns the proposal already kept for it.
export async function readLog(env, pid, input, who) {
  await ensurePastTables(env);
  let bytes = input.bytes, fileKey = input.file_key || null;
  if (!bytes && fileKey) { const f = await getFile(env, fileKey); bytes = f && f.bytes; }
  if (!bytes || !bytes.length) return { error: 'no file received' };
  const book = readBillFile(input.filename, bytes);
  if (book.error) return { error: book.error };
  const sha = await sha256Hex(bytes);
  const proj = await env.DB.prepare('SELECT org_id FROM projects WHERE id = ?').bind(pid).first();
  const readAt = nowISO();
  const opts = { type: input.type, mapping: input.mapping, status_map: input.status_map, date_order: input.date_order, sha256: sha, read_at: readAt };
  const p = proposeRows(book, input.sheet, opts, await existingRefs(env, pid));
  if (p.error) return p;
  const extra = { unknown_statuses: p.unknown_statuses, sequence: p.sequence, header: p.header, adds_up: p.adds_up, date_order_settled: p.date_order_settled };
  // The same file, read the same way: the proposal already kept for it.
  const same = await env.DB.prepare("SELECT id, rows, mapping, status_map, date_order, type, sheet FROM past_import WHERE project_id = ? AND sha256 = ? AND reader = ? AND state = 'proposed'")
    .bind(pid, sha, PAST_READER + '+' + STATUS_VERSION).all().then((x) => x.results || []).catch(() => []);
  const hit = same.find((x) => x.rows === JSON.stringify(p.rows) && x.mapping === JSON.stringify(p.mapping) && x.type === p.type && x.sheet === p.sheet
    && (x.date_order || null) === (p.date_order || null) && x.status_map === JSON.stringify(input.status_map || {}));
  if (hit) return { ...(await getLog(env, pid, hit.id)), ...extra, kept: true };
  // The log itself is kept, so a remap needs no second upload.
  if (!fileKey) {
    const put = await putFile(env, 'past/' + pid + '/' + sha.slice(0, 16) + '/' + String(input.filename || 'log.xlsx').replace(/[^\w.\- ]+/g, '_').slice(0, 120), bytes,
      /\.csv$/i.test(input.filename || '') ? 'text/csv' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    if (put.ok) fileKey = put.key;
  }
  const id = uid('past_');
  await env.DB.prepare(
    `INSERT INTO past_import (id, project_id, org_id, type, filename, sha256, reader, sheet, mapping, status_map, date_order, read_at,
       state, counts, rows, sheets, header_row, file_key, created_by, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).bind(id, pid, proj && proj.org_id, p.type, String(input.filename || '').slice(0, 200), sha, PAST_READER + '+' + STATUS_VERSION, p.sheet,
    JSON.stringify(p.mapping), JSON.stringify(input.status_map || {}), p.date_order, readAt, 'proposed',
    JSON.stringify(p.counts), JSON.stringify(p.rows), JSON.stringify(p.sheets), p.header_row, fileKey, String(who || ''), readAt).run();
  return { ...(await getLog(env, pid, id)), ...extra };
}

export async function getLog(env, pid, id) {
  await ensurePastTables(env);
  const r = await env.DB.prepare('SELECT * FROM past_import WHERE project_id = ? AND id = ?').bind(pid, String(id || '')).first();
  if (!r) return null;
  return {
    id: r.id, type: r.type, type_label: LOG_TYPES[r.type], filename: r.filename, sha256: r.sha256, reader: r.reader, sheet: r.sheet,
    sheets: parse(r.sheets, []), header_row: r.header_row, mapping: parse(r.mapping, {}), status_map: parse(r.status_map, {}),
    date_order: r.date_order, state: r.state, counts: parse(r.counts, {}), rows: parse(r.rows, []), file_key: r.file_key || null,
    created_by: r.created_by, created_at: r.created_at, confirmed_by: r.confirmed_by, confirmed_at: r.confirmed_at, created_count: r.created_count,
  };
}

export async function listLogs(env, pid) {
  await ensurePastTables(env);
  const { results } = await env.DB.prepare('SELECT id, type, filename, state, counts, created_by, created_at, confirmed_at, created_count FROM past_import WHERE project_id = ? ORDER BY created_at DESC').bind(pid).all();
  return (results || []).map((r) => ({ ...r, type_label: LOG_TYPES[r.type], counts: parse(r.counts, {}) }));
}

// DC fixes the mapping, the statuses or the date order: read again from the
// same stored proposal's file (sent again by the screen) under the new choices.
export async function remapLog(env, pid, id, input, who) {
  const cur = await getLog(env, pid, id);
  if (!cur) return { error: 'no such log on this project' };
  if (cur.state !== 'proposed') return { error: 'that log has already been imported' };
  const r = await readLog(env, pid, { filename: cur.filename, file_key: input.bytes ? null : cur.file_key, ...input, type: input.type || cur.type, sheet: input.sheet || cur.sheet,
    mapping: input.mapping || cur.mapping, status_map: { ...cur.status_map, ...(input.status_map || {}) }, date_order: input.date_order || cur.date_order }, who);
  if (r && !r.error && r.id !== cur.id) {
    if (r.sha256 !== cur.sha256) {
      if (!r.kept) await env.DB.prepare('DELETE FROM past_import WHERE id = ?').bind(r.id).run();
      return { error: 'that is a different file from the one read first — drop it as a new log' };
    }
    await env.DB.prepare("UPDATE past_import SET state = 'replaced' WHERE id = ?").bind(cur.id).run();
  }
  return r;
}

// DC confirms: every row read becomes an imported record (K5), closed. Held
// and not-read rows create nothing. Safe to run twice.
export async function confirmLog(env, pid, id, who) {
  const cur = await getLog(env, pid, id);
  if (!cur) return { error: 'no such log on this project' };
  if (cur.state === 'confirmed') return { ok: true, already: true, created: 0, message: 'This log was imported already.' };
  if (cur.state !== 'proposed') return { error: 'that reading was replaced by a newer one — confirm the newest' };
  const toMake = cur.rows.filter((r) => r.outcome === 'read');
  const list = toMake.map((r) => ({
    type: cur.type, ref: r.ref, title: r.subject || r.ref,
    original_date: r.dates.raised || r.dates.issued || null,
    original_status: r.status || null,
    data: Object.fromEntries(Object.entries({
      Subject: r.subject, 'Date raised': r.dates.raised, 'Date issued': r.dates.issued, 'Reply due': r.dates.reply_due,
      'Date replied': r.dates.replied, Discipline: r.extra.discipline, Revision: r.extra.revision, Remarks: r.extra.remarks,
    }).filter(([, v]) => v)),
    imported_from: { file: cur.filename, sheet: cur.sheet, row: r.row, sha256: cur.sha256, reader: cur.reader, past_import: cur.id },
  }));
  const res = list.length ? await importRecords(env, pid, list, who) : { imported: [], refused: [] };
  await env.DB.prepare("UPDATE past_import SET state = 'confirmed', confirmed_by = ?, confirmed_at = ?, created_count = ? WHERE id = ?")
    .bind(String(who || ''), nowISO(), res.imported.length, cur.id).run();
  const all = cur.counts.rows;
  return { ok: true, created: res.imported.length, refused: res.refused, highest: res.highest || {},
    message: res.imported.length ? res.imported.length + ' record' + (res.imported.length === 1 ? '' : 's') + ' imported into the ' + LOG_TYPES[cur.type].replace(/ log$/, ' register') + '.'
      : 'Nothing to add: ' + (cur.counts.already === all ? 'all ' + all + ' rows are already on this project.' : 'no row of this log was read.') };
}
