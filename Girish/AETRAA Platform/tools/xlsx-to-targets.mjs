#!/usr/bin/env node
/**
 * Turn a target-list workbook — the "Remaining work by <date>" sheet set — into the
 * one CSV the app imports on the Admin page.
 *
 *   node tools/xlsx-to-targets.mjs "1 Remaining Work by 8 November.xlsx"
 *
 * Writes <name>.targets.csv beside it.
 *
 * It expects each sheet (other than a "Start Here" cover) to hold a header row
 * beginning "Activity ID", then one row per line of work:
 *
 *   Activity ID | Work to be done | Level | Days of work left | Start | Finish by | Done
 *
 * The sheet name becomes the target group. No npm packages — an .xlsx is a zip of
 * XML, and this reads it directly.
 */

import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

/* ------------------------------------------------------------- zip reader */

function readZip(file) {
  const buf = fs.readFileSync(file);
  // End of central directory: signature 0x06054b50, scanned from the back.
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0 && i > buf.length - 66000; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('not a zip / xlsx file');
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);

  const files = {};
  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) break;
    const method = buf.readUInt16LE(p + 10);
    const compSize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localOff = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);

    // Local header: the name/extra lengths there can differ from the central ones.
    const lNameLen = buf.readUInt16LE(localOff + 26);
    const lExtraLen = buf.readUInt16LE(localOff + 28);
    const dataStart = localOff + 30 + lNameLen + lExtraLen;
    const raw = buf.subarray(dataStart, dataStart + compSize);
    files[name] = method === 0 ? raw : zlib.inflateRawSync(raw);

    p += 46 + nameLen + extraLen + commentLen;
  }
  return files;
}

/* ------------------------------------------------------------- xml helpers */

const unescapeXml = (s) => s
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
  .replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d))
  .replace(/&amp;/g, '&');

function sharedStrings(xml) {
  if (!xml) return [];
  const out = [];
  for (const si of xml.toString('utf8').split('<si>').slice(1)) {
    // A string can be split across several <t> runs.
    let text = '';
    const re = /<t[^>]*>([\s\S]*?)<\/t>/g;
    let m;
    while ((m = re.exec(si))) text += m[1];
    out.push(unescapeXml(text));
  }
  return out;
}

const colOf = (ref) => {
  const letters = ref.replace(/\d+/g, '');
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
};

function sheetRows(xml, strings) {
  const rows = [];
  for (const rowXml of xml.toString('utf8').split(/<row[\s>]/).slice(1)) {
    const cells = [];
    const re = /<c r="([A-Z]+\d+)"([^>]*)>([\s\S]*?)<\/c>|<c r="([A-Z]+\d+)"([^>]*)\/>/g;
    let m;
    while ((m = re.exec(rowXml))) {
      const ref = m[1] || m[4];
      const attrs = m[2] || m[5] || '';
      const inner = m[3] || '';
      const type = (attrs.match(/t="([^"]+)"/) || [])[1];
      let value = '';
      if (type === 'inlineStr') {
        const t = inner.match(/<t[^>]*>([\s\S]*?)<\/t>/);
        value = t ? unescapeXml(t[1]) : '';
      } else {
        const v = inner.match(/<v>([\s\S]*?)<\/v>/);
        const raw = v ? v[1] : '';
        value = type === 's' ? (strings[Number(raw)] ?? '') : unescapeXml(raw);
      }
      cells[colOf(ref)] = value;
    }
    rows.push(cells);
  }
  return rows;
}

// Excel stores dates as a serial number counted from 1899-12-30.
function serialToDate(v) {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 20000 || n > 80000) return '';
  return new Date(Date.UTC(1899, 11, 30) + n * 86400000).toISOString().slice(0, 10);
}
function asDate(v) {
  if (v === undefined || v === null || v === '') return '';
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const serial = serialToDate(s);
  if (serial) return serial;
  const t = Date.parse(s);
  return Number.isNaN(t) ? '' : new Date(t).toISOString().slice(0, 10);
}

/* ---------------------------------------------------------------- convert */

const file = process.argv[2];
if (!file) {
  console.error('Usage: node tools/xlsx-to-targets.mjs <target list.xlsx>');
  process.exit(1);
}

const zip = readZip(file);
const strings = sharedStrings(zip['xl/sharedStrings.xml']);

// sheet name -> worksheet xml, via workbook.xml and its rels
const wb = (zip['xl/workbook.xml'] || Buffer.from('')).toString('utf8');
const rels = (zip['xl/_rels/workbook.xml.rels'] || Buffer.from('')).toString('utf8');
// Attribute order varies between the tools that write .xlsx files, so pull each
// attribute out of the tag rather than assuming a fixed order.
const attr = (tag, name) => (tag.match(new RegExp(name.replace(':', '\\:') + '="([^"]*)"')) || [])[1];

const relTarget = {};
for (const m of rels.matchAll(/<Relationship\b[^>]*\/?>/g)) {
  const id = attr(m[0], 'Id'), target = attr(m[0], 'Target');
  if (id && target) relTarget[id] = target.replace(/^\/?xl\//, '').replace(/^\.\//, '');
}
const sheets = [];
for (const m of wb.matchAll(/<sheet\b[^>]*\/?>/g)) {
  const name = attr(m[0], 'name'), rid = attr(m[0], 'r:id') || attr(m[0], 'id');
  const target = relTarget[rid];
  if (!name || !target) continue;
  const key = ['xl/' + target, target].find((k) => zip[k]);
  if (key) sheets.push({ name: unescapeXml(name), xml: zip[key] });
}
if (!sheets.length) throw new Error('no worksheets found in that file');

const HEAD = ['ID', 'Target Group', 'Work', 'Level', 'Days Left', 'Start', 'Finish By', 'Order'];
const out = [];
let order = 0, skippedSheets = [];

for (const sh of sheets) {
  const rows = sheetRows(sh.xml, strings);
  const headIdx = rows.findIndex((r) => String(r[0] || '').trim().toLowerCase() === 'activity id');
  if (headIdx < 0) { skippedSheets.push(sh.name); continue; }
  for (const r of rows.slice(headIdx + 1)) {
    const id = String(r[0] || '').trim();
    if (!id) continue;
    order++;
    out.push({
      'ID': id,
      'Target Group': sh.name,
      'Work': String(r[1] || '').trim(),
      'Level': String(r[2] || '').trim().replace(/^-$/, ''),
      'Days Left': r[3] === undefined || r[3] === '' ? '' : Number(r[3]),
      'Start': asDate(r[4]),
      'Finish By': asDate(r[5]),
      'Order': order,
    });
  }
}
if (!out.length) throw new Error('no rows found — is there a header row starting "Activity ID"?');

const csvCell = (v) => {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};
const base = file.replace(/\.xlsx$/i, '');
fs.writeFileSync(base + '.targets.csv',
  [HEAD.join(','), ...out.map((r) => HEAD.map((c) => csvCell(r[c])).join(','))].join('\n') + '\n');

const fins = out.map((r) => r['Finish By']).filter(Boolean).sort();
const groups = {};
for (const r of out) groups[r['Target Group']] = (groups[r['Target Group']] || 0) + 1;
const days = out.reduce((s, r) => s + (Number(r['Days Left']) || 0), 0);

console.log('Lines        ' + out.length);
console.log('Groups       ' + Object.keys(groups).length);
console.log('Finish by    ' + (fins[0] || '?') + '  ->  ' + (fins[fins.length - 1] || '?'));
console.log('Days of work ' + Math.round(days));
if (skippedSheets.length) console.log('Skipped      ' + skippedSheets.join(', ') + '  (no "Activity ID" header)');
console.log('\nWritten: ' + path.basename(base) + '.targets.csv');
console.log('Import it on the Admin page under "Load a target list".');
