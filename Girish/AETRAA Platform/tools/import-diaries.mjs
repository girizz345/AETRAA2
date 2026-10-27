// Reading a year of issued daily site diaries back into the database.
//
//   node tools/import-diaries.mjs <folder> [--write] [--overwrite]
//
// The diaries have been going out as Word documents since long before this app
// existed. That is a year of labour, plant and material records sitting in a
// folder, and it is the difference between a Resources page that starts in
// September and one that covers the job.
//
// It reads without being told the layout. Rather than assuming which table is
// which and which column holds what, it pulls every table out of the document
// and recognises a row by its content: a first cell that names a trade the
// roster knows, followed by a number. That survives somebody adding a column,
// reordering the sheet, or using last year's template.
//
// Nothing is written until you pass --write. Without it you get a report: what
// it found per day, what it could not read, and which dates are missing from the
// sequence — because a gap in the record is itself worth knowing before it
// matters in a claim.

import { readFileSync, readdirSync, writeFileSync, statSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';
import { join, basename, extname } from 'node:path';
import { DEFAULT_TRADES, DEFAULT_PLANT, DEFAULT_MATERIALS } from '../src/diary.js';

/* ------------------------------------------------------- reading the file */

// A .docx is a ZIP. No dependency for this: walk the central directory, find the
// one entry we want, inflate it.
function unzipEntry(buf, wanted) {
  // End of central directory: signature 0x06054b50, scanning back over any comment.
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0 && i > buf.length - 66000; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('not a zip file');
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);

  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('central directory is damaged');
    const method = buf.readUInt16LE(p + 10);
    const csize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const offset = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);

    if (name === wanted) {
      const lnameLen = buf.readUInt16LE(offset + 26);
      const lextraLen = buf.readUInt16LE(offset + 28);
      const start = offset + 30 + lnameLen + lextraLen;
      const raw = buf.subarray(start, start + csize);
      return method === 0 ? raw : inflateRawSync(raw);
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
  throw new Error(`${wanted} is not in this file`);
}

const unescapeXml = (s) => s
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
  .replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d))
  .replace(/&amp;/g, '&');

// Word splits a single word across runs whenever spell-check or formatting says
// so, so the text of a cell is every <w:t> in it, joined, not the first one.
const cellText = (xml) => {
  const parts = [];
  for (const m of xml.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)) parts.push(unescapeXml(m[1]));
  // A break or a new paragraph reads as a space, not as nothing.
  return parts.join('').replace(/\s+/g, ' ').trim();
};

// His template nests tables inside table cells. A lazy regex stops at the first
// closing tag and silently truncates the outer table, which is how a whole
// subcontractor record can vanish without anything looking wrong. So the walk
// counts depth: every block returned here is a real one, and a nested table is
// read in its own right rather than swallowed into the cell around it.
function blocks(xml, tag) {
  const tok = new RegExp(`<(/?)w:${tag}(?:\\s[^>]*?)?(/?)>`, 'g');
  const out = [];
  let depth = 0, from = 0, m;
  while ((m = tok.exec(xml))) {
    if (m[2] === '/') continue;                    // self-closing: not a block
    if (m[1] === '/') {
      depth--;
      if (depth === 0) out.push(xml.slice(from, m.index));
    } else {
      if (depth === 0) from = m.index + m[0].length;
      depth++;
    }
  }
  return out;
}

// Remove nested tables from a cell before reading its text, so the rows inside
// them are counted once — where they are — and not again as part of the cell.
const withoutNested = (xml) => {
  let out = xml, guard = 0;
  while (/<w:tbl[\s>]/.test(out) && guard++ < 20) {
    const inner = blocks(out, 'tbl');
    if (!inner.length) break;
    for (const b of inner) out = out.replace(b, ' ');
    out = out.replace(/<w:tbl(?:\s[^>]*)?>|<\/w:tbl>/g, ' ');
  }
  return out;
};

// Every row in the document, in the order a person reads them. Table boundaries
// do not matter to what follows — the headings decide what a row means — so the
// sheet is treated as one sequence of rows rather than a set of tables.
function allRows(xml) {
  const out = [];
  const walk = (frag, depth) => {
    for (const tr of blocks(frag, 'tr')) {
      out.push(blocks(tr, 'tc').map((tc) => cellText(withoutNested(tc))));
      // A nested table's rows are rows in their own right — the delivery record
      // and the works list live inside cells of the big one. Emitted after the
      // row that holds them, which is the order somebody reads them in.
      if (depth < 6 && /<w:tbl[\s>]/.test(tr)) {
        for (const inner of blocks(tr, 'tbl')) walk(inner, depth + 1);
      }
    }
  };
  walk(xml, 0);
  return out;
}

const allText = (xml) => {
  const paras = [];
  for (const p of xml.matchAll(/<w:p(?:\s[^>]*)?>([\s\S]*?)<\/w:p>/g)) {
    const t = cellText(p[1]);
    if (t) paras.push(t);
  }
  return paras;
};

/* --------------------------------------------------------------- the date */

const pad = (n) => String(n).padStart(2, '0');
const iso = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const weekdayOf = (isoDate) => WEEKDAYS[new Date(isoDate + 'T00:00:00Z').getUTCDay()];

// Day-first, because that is how the Gulf writes a date and how his sheets are
// written. 9-04-2026 on a sheet issued in April is the 9th of April. Where a
// figure cannot be a month the reading is unambiguous and we say so; where it
// could be either, it is reported so somebody can check rather than guessed at.
function readDate(text) {
  let m = text.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/);
  if (m) return { date: iso(+m[1], +m[2], +m[3]), sure: true };

  m = text.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})\b/);
  if (m) {
    const a = +m[1], b = +m[2];
    if (a > 12 && b <= 12) return { date: iso(+m[3], b, a), sure: true };   // must be day-first
    if (b > 12 && a <= 12) return { date: iso(+m[3], a, b), sure: true };   // must be month-first
    // 03-03 reads the same either way, so there is nothing to be unsure about.
    if (a === b) return { date: iso(+m[3], b, a), sure: true };
    return { date: iso(+m[3], b, a), sure: false };
  }

  m = text.match(/\b(\d{1,2})\s+([A-Za-z]{3,})\s+(\d{4})\b/);
  if (m) {
    const mi = MONTHS.indexOf(m[2].slice(0, 3).toLowerCase());
    if (mi >= 0) return { date: iso(+m[3], mi + 1, +m[1]), sure: true };
  }
  return null;
}

/* ------------------------------------------------- recognising the rows */

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');

// "Is this cell a number?" and "is there a number in this cell?" are different
// questions. Ready-mix concrete C40 contains a number and is not one, and a
// material rejected for that reason is a delivery silently lost.
const isNumber = (v) => /^-?\d+(\.\d+)?$/.test(String(v === null || v === undefined ? '' : v).replace(/,/g, '').trim());

const number = (v) => {
  const s = String(v === null || v === undefined ? '' : v).replace(/,/g, '');
  const m = s.match(/-?\d+(\.\d+)?/);
  if (!m) return null;
  const n = Number(m[0]);
  return Number.isFinite(n) ? n : null;
};

// His sheet runs two trades across a single row, each behind a serial number:
//
//   No. | TRADE        | No. | Hrs | No. | TRADE     | No. | Hrs
//   1   | Steel Fixer  | 14  | 8   | 2   | Carpenter | 9   | 10
//
// So a row is not one record. Every cell that names something the roster knows
// starts a record, and the numbers between it and the next known name belong to
// it. Nothing depends on the column count, the serial column, or how many trades
// somebody decided to fit across the page.
const HEADERISH =
  /^(total|grand total|grand|productive|productive manpower|sub-?contractor|remark|remarks|weather|date|day|trade|trades|category|activity|material|materials|description|signed|signature|submission|agreed|qty|quantity|unit|hrs|hours|no\.?|s\.?no|sr\.?|item|labour|prepared by)$/i;

// The sheet is not a set of tidy tables, one per subject. Labour and plant share
// one wide table; deliveries and the works description have their own headings,
// sometimes in their own table and sometimes further down the same one. So the
// reader follows the headings the way a person reading the sheet would: a heading
// switches what the rows beneath it mean, until the next heading.
function sectionOf(row) {
  const flat = row.map(norm).filter(Boolean);
  if (!flat.length) return null;
  const joined = flat.join(' ');
  if (/subcontractor/.test(joined)) return 'subs';
  if (/deliveryofmaterials|^material$|material$/.test(joined) ||
      (flat.some((c) => /^material/.test(c)) && flat.some((c) => /^qty|^quantity/.test(c)))) return 'material';
  if (/descriptionofworks|expectedworks/.test(joined) ||
      flat.some((c) => c === 'activity')) return 'works';
  if (flat.some((c) => c === 'trade' || c === 'category') ||
      /onsitestaff|onsiteplant|labourrecord/.test(joined)) return 'crew';
  return null;
}

// Within a crew row: every cell naming something the roster knows starts a
// record, and the numbers between it and the next known name belong to it. His
// sheet runs two trades and two plant categories across one row, so a row is
// never one record.
function crewRow(cells, known, found, unread) {
  const hits = [];
  for (let i = 0; i < cells.length; i++) {
    const hit = known.get(norm(cells[i]));
    if (hit) hits.push({ i, hit });
  }
  for (let i = 0; i < cells.length; i++) {
    const c = cells[i];
    if (!c || isNumber(c) || known.get(norm(c)) || HEADERISH.test(c)) continue;
    if (isNumber(cells[i + 1] || '')) unread.push(c);
  }
  for (let h = 0; h < hits.length; h++) {
    const from = hits[h].i + 1;
    const to = h + 1 < hits.length ? hits[h + 1].i : cells.length;
    // The serial number in front of the NEXT name is not this one's hours.
    const between = cells.slice(from, Math.max(from, h + 1 < hits.length ? to - 1 : to));
    const nums = between.map(number).filter((n) => n !== null && n >= 0);
    if (!nums.length) continue;
    const n = nums[0];
    const hrs = nums.length > 1 && nums[1] > 0 && nums[1] <= 24 ? nums[1] : null;
    const hit = hits[h].hit;
    if (n > 0) found.push({ t: hit.name, kind: hit.kind, n, h: hrs === null ? '' : String(hrs) });
  }
}

// Deliveries cannot be matched against a list — the whole point is that site
// writes what arrived, in whatever words the delivery note used.
function materialRow(cells) {
  let c = cells.filter(Boolean);
  if (c.length > 2 && /^\d{1,3}$/.test(c[0])) c = c.slice(1);     // serial column
  if (c.length < 2) return null;
  const name = c[0];
  if (!name || isNumber(name) || HEADERISH.test(name)) return null;
  const qty = c.slice(1).find((x) => isNumber(x));
  if (qty === undefined) return null;
  const unit = c.slice(1).filter((x) => x !== qty).find((x) => !isNumber(x) && x.length <= 14) || '';
  return { m: name, q: String(number(qty)), u: unit };
}

// A subcontractor's own staff and labour are manpower on this site, and on some
// months they are a third of it.
function subRow(cells) {
  let c = cells.filter(Boolean);
  if (c.length > 2 && /^\d{1,3}$/.test(c[0])) c = c.slice(1);
  if (c.length < 2) return null;
  const name = c[0];
  if (!name || isNumber(name) || HEADERISH.test(name)) return null;
  const nums = c.slice(1).filter(isNumber).map(Number);
  if (!nums.length || !nums.some((n) => n > 0)) return null;
  return { n: name, s: String(nums[0] || 0), l: String(nums.length > 1 ? nums[1] : 0) };
}

/* ------------------------------------------------------------ one document */

export function readDiaryDocx(buf, filename) {
  const xml = unzipEntry(buf, 'word/document.xml').toString('utf8');
  const rows = allRows(xml);
  const paras = allText(xml);

  // The filename is the most reliable date on the sheet — it is what the person
  // issuing it typed deliberately. The document's own text is the fallback.
  const fromName = readDate(basename(filename, extname(filename)));
  const fromDoc = paras.slice(0, 12).map(readDate).find(Boolean) ||
                  rows.flat().map(readDate).find(Boolean) || null;
  let date = fromName || fromDoc;

  // 05-04-2026 is the 5th of April or the 4th of May and the file cannot say
  // which. The sheet itself can: it prints the day of the week. Only one of the
  // two readings falls on that day, so the ambiguity is settled by the document
  // rather than by a rule of thumb, and nobody has to check a hundred filenames.
  if (date && date.sure === false) {
    const said = paras.slice(0, 15).join(' ').toLowerCase();
    const day = WEEKDAYS.find((w) => said.includes(w));
    if (day) {
      const m = String(date.date).split('-');
      const swapped = `${m[0]}-${m[2]}-${m[1]}`;
      const a = weekdayOf(date.date) === day;
      const b = weekdayOf(swapped) === day;
      if (a && !b) date = { ...date, sure: true, from_weekday: true };
      else if (b && !a) date = { date: swapped, sure: true, from_weekday: true };
    }
  }

  // His sheet puts the labour record and the plant record side by side in ONE
  // wide table — trades on the left, categories on the right, seventeen empty
  // cells between them. So a table cannot be labelled as one thing or the other;
  // every name is looked up in both rosters at once and routed by what it is.
  const known = new Map();
  for (const t of DEFAULT_TRADES) known.set(norm(t.t), { kind: 'labour', name: t.t });
  for (const t of DEFAULT_PLANT) if (!known.has(norm(t))) known.set(norm(t), { kind: 'plant', name: t });
  for (const m of DEFAULT_MATERIALS) known.delete(norm(m.m));

  const staff = [], plant = [], materials = [], subs = [], unread = [];
  const stated = {};
  let truncated = false;
  const seenRow = new Set();
  let mode = 'crew';
  for (const row of rows) {
    const cells = row.map((c) => String(c || '').trim());
    const heading = sectionOf(cells);
    if (heading) { mode = heading; continue; }
    if (!cells.some(Boolean)) continue;

    // The template repeats the works block, and a nested table can present the
    // same row twice. Reading a row once is right; twice would double a day.
    const sig = mode + '|' + cells.join('\u0001');
    if (seenRow.has(sig)) continue;
    seenRow.add(sig);

    // The sheet states its own answer. Reading it lets every day be checked
    // against what the person who signed it said was on site, which is the only
    // independent check there is on any of this.
    const label = cells.find((c) => c && !isNumber(c));
    if (label) {
      const flat = norm(label);
      const nums = cells.map(number).filter((n) => n !== null && n > 0);
      if (nums.length) {
        if (/^grandtotal/.test(flat)) { if (stated.total) { truncated = true; break; } stated.total = nums[0]; }
        else if (/^productive/.test(flat)) stated.productive = nums[0];
        else if (/^subcontractortotal/.test(flat)) stated.subs = nums[0];
      }
    }

    // Under the subcontractor heading the sheet lists gangs by trade — "CARPENTER
    // 18" is eighteen of somebody else's carpenters, not eighteen more of ours.
    // So inside a section the heading wins, and only a row that looks
    // unmistakably like the labour record (two or more names on it) takes us back.
    const found = [], maybe = [];
    crewRow(cells, known, found, maybe);
    const crewish = found.length >= 2;

    if (mode === 'subs' && !crewish) {
      const sub = subRow(cells);
      if (sub) subs.push(sub);
      continue;
    }
    if (mode === 'material' && !crewish) {
      const m = materialRow(cells);
      if (m) materials.push(m);
      continue;
    }
    if (found.length) {
      for (const f of found) (f.kind === 'plant' ? plant : staff).push(f);
      if (mode === 'crew') unread.push(...maybe);
      mode = 'crew';
      continue;
    }
    if (mode === 'crew') unread.push(...maybe);
  }

  // A trade can appear twice on a sheet — once per shift, or split by floor.
  const merge = (list, k) => {
    const by = new Map();
    for (const r of list) {
      const e = by.get(norm(r[k]));
      if (!e) { by.set(norm(r[k]), { ...r }); continue; }
      if (k === 'n') { e.s = String(Number(e.s) + Number(r.s)); e.l = String(Number(e.l) + Number(r.l)); }
      else { e.n += r.n; if (!e.h) e.h = r.h; }
    }
    return [...by.values()];
  };

  return {
    file: basename(filename),
    date: date ? date.date : null,
    date_sure: date ? date.sure !== false : false,
    date_from: fromName ? 'filename' : fromDoc ? 'document' : null,
    staff: merge(staff, 't'),
    plant: merge(plant, 't'),
    subs: merge(subs, 'n'),
    materials,
    unread: [...new Set(unread)],
    stated,
    truncated,
    men: staff.reduce((s, r) => s + r.n, 0),
    sub_men: subs.reduce((s, r) => s + Number(r.s || 0) + Number(r.l || 0), 0),
    machines: plant.reduce((s, r) => s + r.n, 0),
    rows: rows.length,
  };
}

/* ------------------------------------------------------------- the folder */

const esc = (v) => "'" + String(v).replace(/'/g, "''") + "'";

function sqlFor(pid, d, overwrite) {
  const lines = [];
  const j = (v) => esc(JSON.stringify(v));
  // Only the three things that carry cost. The narrative in an old sheet stays
  // in the Word file it was issued from; nothing here pretends to reproduce it.
  if (overwrite) {
    lines.push(
      `INSERT INTO diary (project_id, report_date, staff, plant, materials, subs, status, created_at, updated_at)\n` +
      ` VALUES (${esc(pid)}, ${esc(d.date)}, ${j(d.staff)}, ${j(d.plant)}, ${j(d.materials)}, ${j(d.subs)}, 'imported', ` +
      `datetime('now'), datetime('now'))\n` +
      ` ON CONFLICT(project_id, report_date) DO UPDATE SET staff=excluded.staff, ` +
      `plant=excluded.plant, materials=excluded.materials, updated_at=excluded.updated_at;`);
    lines.push(`DELETE FROM manpower WHERE project_id = ${esc(pid)} AND report_date = ${esc(d.date)};`);
  } else {
    // A day already in the app was typed by somebody and wins over a document.
    lines.push(
      `INSERT OR IGNORE INTO diary (project_id, report_date, staff, plant, materials, subs, status, created_at, updated_at)\n` +
      ` VALUES (${esc(pid)}, ${esc(d.date)}, ${j(d.staff)}, ${j(d.plant)}, ${j(d.materials)}, ${j(d.subs)}, 'imported', ` +
      `datetime('now'), datetime('now'));`);
    lines.push(`DELETE FROM manpower WHERE project_id = ${esc(pid)} AND report_date = ${esc(d.date)}\n` +
      ` AND NOT EXISTS (SELECT 1 FROM diary WHERE project_id = ${esc(pid)} ` +
      `AND report_date = ${esc(d.date)} AND status != 'imported');`);
  }
  for (const r of d.staff) {
    lines.push(
      `INSERT INTO manpower (project_id, report_date, trade, headcount, submitted_by, created_at)\n` +
      ` VALUES (${esc(pid)}, ${esc(d.date)}, ${esc(r.t)}, ${r.n}, 'imported diary', datetime('now'));`);
  }
  return lines.join('\n');
}

function gaps(dates) {
  if (dates.length < 2) return [];
  const d0 = (s) => Date.parse(s + 'T00:00:00Z') / 86400000;
  const ds = (n) => new Date(n * 86400000).toISOString().slice(0, 10);
  const have = new Set(dates);
  const out = [];
  let run = null;
  for (let d = d0(dates[0]); d <= d0(dates[dates.length - 1]); d++) {
    if (have.has(ds(d))) { if (run) { out.push(run); run = null; } }
    else if (run) run.to = ds(d);
    else run = { from: ds(d), to: ds(d) };
  }
  if (run) out.push(run);
  return out;
}

function main() {
  const args = process.argv.slice(2);
  const folder = args.find((a) => !a.startsWith('--'));
  const write = args.includes('--write');
  const overwrite = args.includes('--overwrite');
  // No default. A wrong project id writes a year of records into a project that
  // does not exist, where they are invisible and look like nothing happened —
  // which is exactly what a silent default caused the first time.
  const pidArg = args.find((a) => a.startsWith('--project='));
  const pid = pidArg ? pidArg.split('=')[1] : null;

  if (!folder) {
    console.log('Usage: node tools/import-diaries.mjs <folder> --project=<id> [--write] [--overwrite]');
    process.exit(1);
  }
  if (write && !pid) {
    console.log('\nWhich project? Pass --project=<id>. Open /api/projects in the app to see the ids,');
    console.log('or run import-history.sh instead, which reads it from the database for you.\n');
    process.exit(1);
  }

  // The reports sit one folder per date, so this walks down rather than reading a
  // flat list. Word's lock files (~$…) and autosave temporaries are not reports.
  const walk = (dir, depth = 0) => {
    let out = [];
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.name.startsWith('~$') || e.name.startsWith('.')) continue;
      const full = join(dir, e.name);
      if (e.isDirectory()) { if (depth < 4) out = out.concat(walk(full, depth + 1)); }
      else if (/\.docx$/i.test(e.name)) out.push(full);
    }
    return out;
  };

  let files;
  try {
    files = walk(folder).sort();
  } catch (e) {
    console.log(`Cannot read ${folder} — ${e.message}`);
    process.exit(1);
  }
  if (!files.length) {
    console.log(`No .docx files in ${folder}.`);
    process.exit(1);
  }

  console.log(`\nReading ${files.length} document${files.length === 1 ? '' : 's'} from ${folder}\n`);

  const read = [], bad = [];
  for (const path of files) {
    const f = basename(path);
    let d;
    try { d = readDiaryDocx(readFileSync(path), path); }
    catch (e) { bad.push({ file: f, why: e.message }); continue; }

    if (!d.date) { bad.push({ file: f, why: 'no date anywhere in the file or its name' }); continue; }
    if (!d.staff.length && !d.plant.length && !d.materials.length && !d.subs.length) {
      bad.push({ file: f, why: `nothing recognised in ${d.rows} rows` });
      continue;
    }
    d.path = path;
    d.folder = basename(join(path, '..'));
    read.push(d);
  }

  // Day-first or month-first is not a guess to be made file by file. Most of these
  // filenames settle it on their own — a 24 cannot be a month — so the ones that
  // could be read either way follow whatever the rest of the folder proves.
  let dayFirst = 0, monthFirst = 0;
  for (const d of read) {
    const m = basename(d.file, extname(d.file)).match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})\b/);
    if (!m) continue;
    if (+m[1] > 12 && +m[2] <= 12) dayFirst++;
    else if (+m[2] > 12 && +m[1] <= 12) monthFirst++;
  }
  const convention = dayFirst && !monthFirst ? 'day-first'
    : monthFirst && !dayFirst ? 'month-first' : null;
  if (convention === 'day-first') for (const d of read) if (!d.date_sure) d.date_sure = 'by convention';

  // The same sheet is often copied into more than one dated folder. Keep the copy
  // that sits in the folder its own date names — that is the one somebody filed
  // deliberately — and say what was set aside rather than calling it unreadable.
  const dup = [];
  const byDate = new Map();
  // Which copy is the real one: the one filed under its own date, named without
  // "Copy", and with the most on it. A sheet somebody duplicated and never
  // finished should not beat the one that was issued.
  const score = (d) =>
    (readDate(d.folder) && readDate(d.folder).date === d.date ? 8 : 0) +
    (d.date_from === 'filename' ? 4 : 0) +
    (/copy|\(\d\)/i.test(d.file) ? -6 : 0) +
    Math.min(3, (d.men + d.machines + d.materials.length + d.sub_men) / 20);
  for (const d of read) {
    const held = byDate.get(d.date);
    if (!held) { byDate.set(d.date, d); continue; }
    const loser = score(d) > score(held) ? held : d;
    const winner = loser === held ? d : held;
    byDate.set(d.date, winner);
    dup.push({ file: loser.file, folder: loser.folder, kept: winner.file, date: d.date });
  }

  const good = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));

  const w = (s, n) => String(s).padEnd(n);
  console.log(w('DATE', 12) + w('MEN', 6) + w('SUBS', 6) + w('PLANT', 7) + w('MATERIALS', 11) + 'FILE');
  for (const d of good) {
    console.log(w(d.date, 12) + w(d.men, 6) + w(d.sub_men, 6) + w(d.machines, 7) +
      w(d.materials.length, 11) + d.file + (d.date_sure ? '' : '   ← check this date'));
  }

  // Each sheet prints its own GRAND TOTAL. That is the signature of whoever
  // issued it, and it is the only independent check there is on what was read.
  // A day that disagrees is not loaded — a resource record quietly four percent
  // light is worse than a gap, because a gap announces itself.
  const TOLERANCE = 2;
  const agreed = [], off = [], unchecked = [];
  for (const d of good) {
    if (!d.stated.total) unchecked.push(d);
    else if (Math.abs(d.stated.total - d.men) <= TOLERANCE) agreed.push(d);
    else off.push(d);
  }
  const loadable = agreed.concat(unchecked).sort((a, b) => a.date.localeCompare(b.date));

  if (off.length) {
    console.log(`\n${off.length} of ${good.length} days do not match the grand total printed on ` +
      `their own sheet, so they are left out. Their documents are untouched:`);
    for (const d of off.slice(0, 12)) {
      console.log(`  ${w(d.date, 12)} sheet says ${w(d.stated.total, 6)} read ${w(d.men, 6)} ${d.file}`);
    }
    if (off.length > 12) console.log(`  … and ${off.length - 12} more`);
  }
  if (agreed.length) {
    console.log(`\n${agreed.length} day${agreed.length === 1 ? '' : 's'} agree with the total ` +
      `printed on the sheet${TOLERANCE ? ` (within ${TOLERANCE})` : ''}.`);
  }
  if (unchecked.length) {
    console.log(`${unchecked.length} day${unchecked.length === 1 ? '' : 's'} print no grand total, ` +
      `so there is nothing to check them against. They are loaded as read.`);
  }

  console.log(`\n${good.length} day${good.length === 1 ? '' : 's'} read` +
              (dup.length ? `, ${dup.length} duplicate${dup.length === 1 ? '' : 's'} set aside` : '') +
              (bad.length ? `, ${bad.length} not read` : ''));
  if (good.length) {
    console.log(`  ${good[0].date} to ${good[good.length - 1].date}`);
    console.log(`  ${good.reduce((s, d) => s + d.men, 0)} man-days of our own, ` +
                `${good.reduce((s, d) => s + d.sub_men, 0)} subcontract, ` +
                `${good.reduce((s, d) => s + d.machines, 0)} plant-days, ` +
                `${good.reduce((s, d) => s + d.materials.length, 0)} material lines`);
  }

  if (bad.length) {
    console.log('\nNot read:');
    for (const b of bad.slice(0, 20)) console.log(`  ${w(b.file, 44)} ${b.why}`);
    if (bad.length > 20) console.log(`  … and ${bad.length - 20} more`);
  }

  if (dup.length) {
    console.log(`\n${dup.length} file${dup.length === 1 ? '' : 's'} hold the same day as another ` +
      `— a copy left in the wrong folder. The one filed under its own date was kept:`);
    for (const d of dup.slice(0, 10)) {
      console.log(`  ${w(d.date, 12)} kept ${d.kept}${d.folder ? `, set aside the copy in ${d.folder}` : ''}`);
    }
    if (dup.length > 10) console.log(`  … and ${dup.length - 10} more, all the same shape`);
  }

  if (convention) {
    const settled = good.filter((d) => d.date_sure === 'by convention').length;
    if (settled) {
      console.log(`\nEvery filename that can only be read one way is ${convention}, so the ` +
        `${settled} that could have been read either way were taken the same way.`);
    }
  }
  const unsure = good.filter((d) => !d.date_sure);
  if (unsure.length) {
    console.log(`\n${unsure.length} date${unsure.length === 1 ? '' : 's'} could be read two ways. ` +
      `Check these before writing:`);
    for (const d of unsure.slice(0, 20)) console.log(`  ${w(d.date, 12)} ${d.file}`);
  }

  const unknown = [...new Set(good.flatMap((d) => d.unread))];
  if (unknown.length) {
    console.log(`\n${unknown.length} row${unknown.length === 1 ? '' : 's'} named something not on ` +
      `the roster, so ${unknown.length === 1 ? 'it was' : 'they were'} skipped:`);
    for (const u of unknown.slice(0, 25)) console.log(`  ${u}`);
    if (unknown.length > 25) console.log(`  … and ${unknown.length - 25} more`);
    console.log('  Add them to the roster in Admin and run this again to pick them up.');
  }

  const missing = gaps(loadable.map((d) => d.date));
  if (missing.length) {
    const days = missing.reduce((s, g) =>
      s + (Date.parse(g.to) - Date.parse(g.from)) / 86400000 + 1, 0);
    console.log(`\n${days} day${days === 1 ? '' : 's'} between ${loadable[0].date} and ` +
      `${loadable[loadable.length - 1].date} have no record. Fridays and holidays will be most of ` +
      `this, but the app will say so rather than pretend the record is complete:`);
    for (const g of missing.slice(0, 15)) {
      console.log('  ' + (g.from === g.to ? g.from : `${g.from} → ${g.to}`));
    }
    if (missing.length > 15) console.log(`  … and ${missing.length - 15} more stretches`);
  }

  if (!write) {
    console.log('\nNothing has been written. Re-run with --write once the above looks right.\n');
    return;
  }

  const sql = loadable.map((d) => sqlFor(pid, d, overwrite)).join('\n');
  const out = join(folder, 'import.sql');
  writeFileSync(out, sql + '\n');
  console.log(`\nWrote ${out}  (${loadable.length} days, project "${pid}")`);
  console.log('Load it with:\n');
  console.log(`  npx wrangler d1 execute site-monitor --remote --file="${out}"\n`);
  if (!overwrite) {
    console.log('Days already in the app are left exactly as they are. Pass --overwrite to');
    console.log('replace them with what the documents say.\n');
  }
}

if (import.meta.url === `file://${process.argv[1]}`) main();
