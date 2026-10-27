// K8 · v5 E15: TIMESHEETS → THE DIARY'S MANPOWER AND THE HSE MAN-HOURS.
//
//   1 Site / HSE drops a subcontractor's daily timesheet (Excel or CSV)
//   2 the platform reads trade, headcount and hours; Site reviews, and the
//     diary's gang lines for that subcontractor and day are filled — from which
//     the manpower log and the HSE man-hours follow
//   3 the PM submits the diary (as before)
//
// A timesheet is laid out one of two ways, both read:
//   per worker   Name | Trade | Hours (or Normal + OT, or Time in / Time out)
//   per trade    Trade | No. | Hours (per man) — or Total hours
// Workers of one trade on different hours become separate gang lines (3 masons
// × 9 h, 2 masons × 7.5 h), so the man-hours are exact, never averaged.
//
// THE E-PROGRAM CONDITION: deterministic; every sheet and row reported as read,
// not read or held, with the reason; the result kept against the file's
// SHA-256 and this reader's version. No AI. Nothing guessed: a date that reads
// two ways, a row with no trade or no hours, a timesheet with no
// subcontractor named — each is held for the person, never filled from
// somewhere else (spec §18). The date never defaults to today (§27 rule 2).
// Hours are kept to the hundredth (§27 rule 5).

import { readBillFile } from './bills.js';
import { readDate } from './past-registers.js';
import { toScaled } from './money.js';
import { putFile } from './storage.js';

export const TS_READER = 'timesheets-1';
const nowISO = () => new Date().toISOString();
const uid = (p) => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const clean = (s) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
const norm = (s) => clean(s).toLowerCase().replace(/[.:#]+/g, ' ').replace(/\s+/g, ' ').trim();
const parse = (v, d) => { try { const j = JSON.parse(v || ''); return j == null ? d : j; } catch (e) { return d; } };
const hund = (v) => toScaled(v, 2);                 // hours in hundredths
const H = (c) => c / 100;

const WORDS = {
  name:     [/^(name|employee( name)?|worker( name)?|labour(er)? name|staff name|full name)$/],
  id:       [/^(emp(loyee)? (no|id)|id( no)?|badge( no)?|labour card( no)?|staff (no|id))$/],
  trade:    [/^(trade|designation|position|category|craft|skill|occupation|profession)$/],
  count:    [/^(no|nos|number|qty|quantity|head ?count|manpower|men|workers|strength|no of (men|workers|labou?r))$/],
  hours:    [/^(hours|hrs|normal( hours| hrs)?|nh|working hours|hours worked|hrs ?\/ ?day|hours per man|hrs per man)$/],
  ot:       [/^(ot|o t|overtime|ot hours|ot hrs|extra hours)$/],
  total:    [/^(total( hours| hrs)?|man ?-?hours|m ?\/ ?h|mh|total man ?-?hours)$/],
  time_in:  [/^(time in|in|start( time)?|from)$/],
  time_out: [/^(time out|out|finish( time)?|end( time)?|to)$/],
};
function mapHeader(cells) {
  const map = {};
  const n = cells.map(norm);
  for (const [f, res] of Object.entries(WORDS)) {
    for (let i = 0; i < n.length; i++) {
      if (!n[i] || Object.values(map).includes(i)) continue;
      if (res.some((re) => re.test(n[i]))) { map[f] = i; break; }
    }
  }
  return map;
}
function headerOf(rows) {
  let best = null;
  for (let i = 0; i < Math.min(rows.length, 25); i++) {
    const m = mapHeader(rows[i].cells);
    if (m.trade == null) continue;
    const figs = ['count', 'hours', 'ot', 'total', 'time_in'].filter((f) => m[f] != null).length;
    if (!figs) continue;
    const score = figs * 2 + (m.name != null || m.id != null ? 1 : 0);
    if (!best || score > best.score) best = { index: i, map: m, score };
  }
  return best;
}

// "07:00", "7:30", "0730", or an Excel time fraction (0.2916…), as hundredths of an hour.
export function timeOf(raw) {
  const s = clean(raw);
  if (!s) return null;
  if (/^0?\.\d+$|^0$/.test(s)) return Math.round(Number(s) * 2400);
  let m = s.match(/^(\d{1,2})[:.](\d{2})(?:\s*([ap])\.?m\.?)?$/i) || s.match(/^(\d{2})(\d{2})$/);
  if (!m) return null;
  let h = Number(m[1]); const min = Number(m[2]);
  if (m[3]) { if (/p/i.test(m[3]) && h < 12) h += 12; if (/a/i.test(m[3]) && h === 12) h = 0; }
  if (h > 24 || min > 59) return null;
  return Math.round((h * 60 + min) * 100 / 60);
}

// Who and when, from the cells above the header ("Subcontractor: Al Noor
// Scaffolding", "Date: 06/10/2026"), or one cell holding both label and value.
function metaOf(rows, upto) {
  const out = { sub: '', date: '' };
  for (const r of rows.slice(0, upto)) {
    const cs = r.cells.map(clean);
    for (let i = 0; i < cs.length; i++) {
      const c = cs[i];
      if (!c) continue;
      const one = c.match(/^(sub[\s-]*contractor|company|contractor|supplier|agency|firm)\s*(name)?\s*:\s*(.+)$/i);
      if (one && !out.sub) out.sub = one[3].trim();
      else if (/^(sub[\s-]*contractor|company|contractor|supplier|agency|firm)\s*(name)?\s*:?$/i.test(c) && !out.sub) out.sub = cs.slice(i + 1).find(Boolean) || '';
      const d1 = c.match(/^date\s*:\s*(.+)$/i);
      if (d1 && !out.date) out.date = d1[1].trim();
      else if (/^date\s*:?$/i.test(c) && !out.date) out.date = cs.slice(i + 1).find(Boolean) || '';
    }
  }
  return out;
}

// Read one workbook. opts: { subcontractor, day, date_order } — what the
// person says, which wins over what the sheet says.
export function readTimesheet(book, opts = {}) {
  const groups = [], sheets = [];
  for (const sh of book.sheets || []) {
    const h = headerOf(sh.rows);
    if (!h) { sheets.push({ name: sh.name, read: false, why: sh.rows.length ? 'no header with a trade and hours or a headcount' : 'empty' }); continue; }
    const meta = metaOf(sh.rows, h.index);
    const at = (cells, f) => (h.map[f] == null ? '' : clean(cells[h.map[f]]));
    const perWorker = h.map.count == null;
    const sub = clean(opts.subcontractor) || meta.sub;
    // The day: the person's, or the sheet's own — never today by default.
    let day = null, dayWhy = null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(opts.day || '')) day = opts.day;
    else if (meta.date) {
      const d = readDate(meta.date, { date1904: book.date1904, order: opts.date_order });
      if (d.date) day = d.date;
      else if (d.both) dayWhy = 'the date "' + meta.date + '" reads as ' + d.both[0] + ' or ' + d.both[1] + ' — say which';
      else dayWhy = 'the date "' + meta.date + '" is not a date';
    } else dayWhy = 'the sheet does not say which day — say which';
    const rows = [], lines = new Map();
    for (const r of sh.rows.slice(h.index + 1)) {
      if (!r.cells.some((x) => clean(x))) continue;
      const trade = at(r.cells, 'trade');
      const first = clean(r.cells.find((x) => clean(x)) || '');
      if (/^(total|grand total|sub[\s-]*total)\b/i.test(first) || /^(total|grand total)\b/i.test(trade)) { rows.push({ row: r.n, outcome: 'not read', why: 'a total row' }); continue; }
      if (/\b(sign(ature|ed)?|prepared by|checked by|approved by|verified by)\b/i.test(r.cells.map(clean).join(' '))) { rows.push({ row: r.n, outcome: 'not read', why: 'a signature row' }); continue; }
      if (!trade) { rows.push({ row: r.n, outcome: 'held', why: 'no trade on this row' }); continue; }
      let count, perMan, why = null;
      if (perWorker) {
        count = 1;
        const tot = hund(at(r.cells, 'total'));
        const hrs = hund(at(r.cells, 'hours')), ot = hund(at(r.cells, 'ot'));
        const tin = timeOf(at(r.cells, 'time_in')), tout = timeOf(at(r.cells, 'time_out'));
        if (tot != null) perMan = tot;
        else if (hrs != null || ot != null) perMan = (hrs || 0) + (ot || 0);
        else if (tin != null && tout != null) perMan = tout >= tin ? tout - tin : tout + 2400 - tin;
        else why = at(r.cells, 'hours') || at(r.cells, 'total') ? 'the hours read "' + (at(r.cells, 'hours') || at(r.cells, 'total')) + '"' : 'no hours on this row';
      } else {
        count = Number(at(r.cells, 'count'));
        if (!Number.isInteger(count) || count <= 0) { rows.push({ row: r.n, outcome: 'held', why: 'the headcount reads "' + at(r.cells, 'count') + '"' }); continue; }
        const hrs = hund(at(r.cells, 'hours')), ot = hund(at(r.cells, 'ot')), tot = hund(at(r.cells, 'total'));
        if (hrs != null || ot != null) perMan = (hrs || 0) + (ot || 0);
        else if (tot != null) {
          if (tot % count) why = 'the total hours (' + H(tot) + ') do not divide evenly among ' + count + ' men — give the hours per man';
          else perMan = tot / count;
        } else why = 'no hours on this row';
      }
      if (why) { rows.push({ row: r.n, outcome: 'held', why, trade }); continue; }
      if (perMan <= 0 || perMan > 2400) { rows.push({ row: r.n, outcome: 'held', why: H(perMan) + ' hours is not a day’s work', trade }); continue; }
      rows.push({ row: r.n, outcome: 'read', trade, count, hours: H(perMan) });
      const k = trade.toLowerCase() + '|' + perMan;
      const l = lines.get(k) || { trade, count: 0, hours_c: perMan };
      l.count += count; lines.set(k, l);
    }
    const ls = [...lines.values()].sort((a, b) => a.trade.localeCompare(b.trade) || a.hours_c - b.hours_c)
      .map((l) => ({ trade: l.trade, count: l.count, hours: H(l.hours_c), man_hours: H(l.count * l.hours_c) }));
    const held = [];
    if (!sub) held.push('the timesheet does not name the subcontractor — say whose it is');
    if (!day) held.push(dayWhy);
    groups.push({ sheet: sh.name, layout: perWorker ? 'one row per worker' : 'one row per trade', subcontractor: sub || null, day, held, lines: ls,
      men: ls.reduce((s, l) => s + l.count, 0), man_hours: H(ls.reduce((s, l) => s + Math.round(l.man_hours * 100), 0)), rows,
      counts: { read: rows.filter((x) => x.outcome === 'read').length, held: rows.filter((x) => x.outcome === 'held').length, not_read: rows.filter((x) => x.outcome === 'not read').length } });
    sheets.push({ name: sh.name, read: true, header_row: sh.rows[h.index].n, layout: perWorker ? 'per worker' : 'per trade' });
  }
  return { groups, sheets };
}

/* ------------------------------------------------------------ kept, and applied */

let ready = false;
export async function ensureTimesheetTables(env) {
  if (ready) return true;
  try {
    await env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS timesheet_reads (
         id TEXT PRIMARY KEY, project_id TEXT NOT NULL, sha256 TEXT, reader TEXT, filename TEXT, file_key TEXT,
         opts TEXT, groups TEXT, sheets TEXT, state TEXT, applied TEXT, by TEXT, at TEXT, applied_by TEXT, applied_at TEXT)`
    ).run();
    ready = true;
    return true;
  } catch (e) { return false; }
}
async function sha256Hex(u8) {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', u8))].map((b) => b.toString(16).padStart(2, '0')).join('');
}
export async function readAndKeep(env, pid, input, who) {
  await ensureTimesheetTables(env);
  const book = readBillFile(input.filename, input.bytes);
  if (book.error) return { error: book.error };
  const sha = await sha256Hex(input.bytes);
  const opts = { subcontractor: clean(input.subcontractor), day: input.day || '', date_order: input.date_order || '' };
  const optsKey = JSON.stringify(opts);
  const same = await env.DB.prepare('SELECT id FROM timesheet_reads WHERE project_id = ? AND sha256 = ? AND reader = ? AND opts = ? ORDER BY at DESC')
    .bind(pid, sha, TS_READER, optsKey).first().catch(() => null);
  if (same) return { ...(await getRead(env, pid, same.id)), kept: true };
  const r = readTimesheet(book, opts);
  if (!r.groups.length) return { error: 'no timesheet was found in that file — it needs a header row with a trade and the hours or a headcount', sheets: r.sheets };
  const put = await putFile(env, 'timesheets/' + pid + '/' + sha.slice(0, 16) + '/' + clean(input.filename).replace(/[^\w.\- ]+/g, '_').slice(0, 120), input.bytes,
    /\.csv$/i.test(input.filename || '') ? 'text/csv' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  const id = uid('ts_');
  await env.DB.prepare('INSERT INTO timesheet_reads (id, project_id, sha256, reader, filename, file_key, opts, groups, sheets, state, by, at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)')
    .bind(id, pid, sha, TS_READER, clean(input.filename).slice(0, 200), put.ok ? put.key : null, optsKey, JSON.stringify(r.groups), JSON.stringify(r.sheets), 'read', String(who || ''), nowISO()).run();
  return getRead(env, pid, id);
}
export async function getRead(env, pid, id) {
  await ensureTimesheetTables(env);
  const r = await env.DB.prepare('SELECT * FROM timesheet_reads WHERE project_id = ? AND id = ?').bind(pid, String(id || '')).first();
  if (!r) return null;
  return { id: r.id, filename: r.filename, sha256: r.sha256, reader: r.reader, opts: parse(r.opts, {}), groups: parse(r.groups, []), sheets: parse(r.sheets, []),
    state: r.state, applied: parse(r.applied, null), by: r.by, at: r.at, applied_by: r.applied_by, applied_at: r.applied_at };
}
export async function listReads(env, pid, day) {
  await ensureTimesheetTables(env);
  const { results } = await env.DB.prepare('SELECT * FROM timesheet_reads WHERE project_id = ? ORDER BY at DESC LIMIT 200').bind(pid).all();
  return (results || []).map((r) => ({ id: r.id, filename: r.filename, state: r.state, at: r.at, by: r.by, groups: parse(r.groups, []).map((g) => ({ subcontractor: g.subcontractor, day: g.day, men: g.men, man_hours: g.man_hours, held: g.held })) }))
    .filter((r) => !day || r.groups.some((g) => g.day === day));
}

// Site applies: for each subcontractor and day read, the diary's gang lines for
// that subcontractor are replaced by the timesheet's (never added to), the
// rest of the diary saved exactly as it stands. A submitted diary is revised
// with the reason, its earlier version kept (diary.js).
//   ctx: { loadDiary(day), saveDiary(body), who }
export async function applyRead(env, pid, id, body, ctx) {
  const rd = await getRead(env, pid, id);
  if (!rd) return { error: 'no such timesheet on this project' };
  const groups = rd.groups.filter((g) => g.lines.length);
  if (!groups.length) return { error: 'nothing was read from that timesheet to put in the diary' };
  const held = groups.filter((g) => g.held.length);
  if (held.length) return { error: held.map((g) => g.sheet + ': ' + g.held.join('; ')).join(' · '), held: true };
  const done = [];
  for (const g of groups) {
    const d = await ctx.loadDiary(g.day);
    if (d.missing) return { error: 'the diary is not set up on this project' };
    if (d.status === 'submitted' && !clean(body && body.reason)) {
      return { error: 'the diary for ' + g.day + ' is already submitted — say why it is changed; the version as submitted is kept', submitted: true, day: g.day };
    }
    const others = (d.subs || []).filter((s) => clean(s.n).toLowerCase() !== clean(g.subcontractor).toLowerCase());
    const mine = g.lines.map((l) => ({ n: g.subcontractor, t: l.trade, p: '', c: String(l.count), h: String(l.hours) }));
    const r = await ctx.saveDiary({ report_date: g.day, staff: d.staff, plant: d.plant, works: d.works, tomorrow: d.tomorrow, materials: d.materials,
      subs: others.concat(mine), weather: d.weather, remarks: d.remarks, visitors: d.visitors, prepared_by: d.prepared_by,
      changed_by: ctx.who, reason: clean(body && body.reason) || undefined });
    if (r.error) return r;
    done.push({ subcontractor: g.subcontractor, day: g.day, lines: mine.length, men: g.men, man_hours: g.man_hours, revised: !!r.revised });
  }
  await env.DB.prepare("UPDATE timesheet_reads SET state = 'applied', applied = ?, applied_by = ?, applied_at = ? WHERE id = ?")
    .bind(JSON.stringify(done), String(ctx.who || ''), nowISO(), rd.id).run();
  return { ok: true, applied: done };
}
