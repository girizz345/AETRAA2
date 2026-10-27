#!/usr/bin/env node
/**
 * Turn a Primavera P6 .xer export into the two CSV files the app imports.
 *
 *   node tools/xer-to-csv.mjs "MAJ-BL 114D.xer"
 *
 * Writes, beside the .xer:
 *   <name>.activities.csv   the programme  -> Admin page, "Load the programme"
 *   <name>.progress.csv     the position   -> Admin page, "Load progress from the programme"
 *
 * Options:
 *   --trade-codes "04. Tradewise - Civil,05. Tradewise - MEP"   which activity code types carry the trade
 *   --floor-code  "03. Floor"                                   which one carries the floor / zone
 *   --disc-code   "01. Decipline"                               which one carries the discipline
 *   --construction-only                                         drop everything except Construction
 *
 * Run it with no options first — it prints the activity code types it found in your file,
 * so you can see what to point it at if the defaults don't match.
 */

import fs from 'fs';
import path from 'path';

/* --------------------------------------------------------------- reading */

function readXER(file) {
  // P6 writes Windows-1252, not UTF-8.
  const text = new TextDecoder('windows-1252').decode(fs.readFileSync(file))
    .replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const tables = {};
  let cur = null, fields = null;
  for (const line of text.split('\n')) {
    if (!line) continue;
    const p = line.split('\t');
    if (p[0] === '%T') { cur = p[1].trim(); tables[cur] = []; fields = null; }
    else if (p[0] === '%F') fields = p.slice(1).map((f) => f.trim());
    else if (p[0] === '%R' && cur && fields) {
      const v = p.slice(1);
      const row = {};
      fields.forEach((f, i) => { row[f] = (v[i] ?? '').trim(); });
      tables[cur].push(row);
    }
  }
  return tables;
}

const d10 = (s) => (s && s.length >= 10 ? s.slice(0, 10) : '');
const csvCell = (v) => {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};
const csv = (cols, rows) =>
  [cols.join(','), ...rows.map((r) => cols.map((c) => csvCell(r[c])).join(','))].join('\n') + '\n';

/* ------------------------------------------------------------ arguments */

const argv = process.argv.slice(2);
const file = argv.find((a) => !a.startsWith('--'));
const opt = (name, dflt) => {
  const i = argv.indexOf('--' + name);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : dflt;
};
const flag = (name) => argv.includes('--' + name);

if (!file) {
  console.error('Usage: node tools/xer-to-csv.mjs <file.xer> [options] — see the top of this file.');
  process.exit(1);
}

const T = readXER(file);
for (const need of ['TASK', 'PROJWBS']) {
  if (!T[need] || !T[need].length) { console.error('This file has no ' + need + ' table — is it a P6 .xer export?'); process.exit(1); }
}

/* --------------------------------------------------- activity code maps */

const codeTypes = {};                                   // type id -> type name
for (const r of T.ACTVTYPE || []) codeTypes[r.actv_code_type_id] = r.actv_code_type;
const codeVals = {};                                    // code id -> [type name, value name]
for (const r of T.ACTVCODE || []) codeVals[r.actv_code_id] = [codeTypes[r.actv_code_type_id], r.actv_code_name];
const taskCodes = {};                                   // task id -> { type name: value }
for (const r of T.TASKACTV || []) {
  const c = codeVals[r.actv_code_id];
  if (!c || !c[0]) continue;
  (taskCodes[r.task_id] = taskCodes[r.task_id] || {})[c[0]] = c[1];
}

console.log('Activity code types in this file:');
for (const n of Object.values(codeTypes)) console.log('   ' + n);

const tradeTypes = opt('trade-codes', '04. Tradewise - Civil,05. Tradewise - MEP')
  .split(',').map((s) => s.trim()).filter(Boolean);
const floorType = opt('floor-code', '03. Floor');
const discType = opt('disc-code', '01. Decipline');

// The trade group is the tail of the code type name: "04. Tradewise - Civil" -> "Civil"
const groupOf = (typeName) => {
  const m = typeName.match(/-\s*([^-]+)$/);
  return m ? m[1].trim() : typeName.replace(/^\d+\.\s*/, '');
};

/* ------------------------------------------------------------ WBS paths */

const W = {};
for (const r of T.PROJWBS) W[r.wbs_id] = r;
const pathCache = {};
function wbsPath(id, depth = 0) {
  if (pathCache[id]) return pathCache[id];
  const r = W[id];
  if (!r || depth > 20) return [];
  const parent = W[r.parent_wbs_id] ? wbsPath(r.parent_wbs_id, depth + 1) : [];
  return (pathCache[id] = parent.concat([r.wbs_name]));
}

/* ------------------------------------------------------------ the rows */

const MS_DAY = 86400000;
const activities = [], progress = [];
const dataDate = d10((T.PROJECT && T.PROJECT[0] && (T.PROJECT[0].last_recalc_date || T.PROJECT[0].plan_start_date)) || '')
  || new Date().toISOString().slice(0, 10);

const STATUS = { TK_Complete: 'complete', TK_Active: 'in_progress', TK_NotStart: 'not_started' };
const sections = new Map();
let order = 0, dropped = 0;

for (const t of T.TASK) {
  const c = taskCodes[t.task_id] || {};
  const disc = c[discType] || '';
  if (flag('construction-only') && disc !== 'Construction') { dropped++; continue; }

  let trade = '', group = '';
  for (const tt of tradeTypes) {
    if (c[tt]) { trade = c[tt]; group = groupOf(tt); break; }
  }

  const p = wbsPath(t.wbs_id);
  const phase = p.length > 1 ? p[1] : '';
  const section = p.length > 2 ? p[2] : phase;

  const ps = d10(t.target_start_date) || d10(t.early_start_date);
  const pf = d10(t.target_end_date) || d10(t.early_end_date);
  const days = ps && pf ? Math.max(1, Math.round((Date.parse(pf) - Date.parse(ps)) / MS_DAY) + 1) : 1;
  const isMilestone = t.task_type === 'TT_Mile' || t.task_type === 'TT_FinMile';

  if (section && !sections.has(section)) {
    sections.set(section, { id: 'SEC-' + String(sections.size + 1).padStart(3, '0'), phase: phase });
  }

  activities.push({
    'ID': t.task_code,
    'WBS': section,
    'Activity': t.task_name,
    'Level': 1,
    'Planned Start': ps,
    'Planned Finish': pf,
    'Weight': isMilestone ? 0.25 : days,
    'Trade': trade,
    'Trade Group': group,
    'Floor': c[floorType] || '',
    'Discipline': disc,
    'Phase': phase,
    'Responsible': '',
    '_order': ++order,
  });

  const status = STATUS[t.status_code] || '';
  const pct = status === 'complete' ? 100
    : status === 'not_started' ? 0
    : (t.phys_complete_pct !== '' ? Number(t.phys_complete_pct) : '');
  progress.push({
    'ID': t.task_code,
    'Report Date': dataDate,
    '%': pct,
    'Actual Start': d10(t.act_start_date),
    'Actual Finish': d10(t.act_end_date),
    'Status': status,
  });
}

// section heading rows, placed before the first activity of each section
const headings = [];
for (const [name, meta] of sections) {
  headings.push({
    'ID': meta.id, 'WBS': name, 'Activity': name.toUpperCase(), 'Level': 0,
    'Planned Start': '', 'Planned Finish': '', 'Weight': '', 'Trade': '', 'Trade Group': '',
    'Floor': '', 'Discipline': '', 'Phase': meta.phase, 'Responsible': '', '_order': 0,
  });
}
const bySection = new Map();
for (const a of activities) {
  if (!bySection.has(a.WBS)) bySection.set(a.WBS, []);
  bySection.get(a.WBS).push(a);
}
const out = [];
for (const h of headings) { out.push(h); out.push(...(bySection.get(h.WBS) || [])); }
for (const a of activities) if (!a.WBS) out.push(a);

const cols = ['ID','WBS','Activity','Level','Planned Start','Planned Finish','Weight',
              'Trade','Trade Group','Floor','Discipline','Phase','Responsible'];
const base = file.replace(/\.xer$/i, '');
fs.writeFileSync(base + '.activities.csv', csv(cols, out));
fs.writeFileSync(base + '.progress.csv', csv(['ID','Report Date','%','Actual Start','Actual Finish','Status'], progress));

const tradeCount = new Map();
for (const a of activities) if (a.Trade) tradeCount.set(a.Trade, (tradeCount.get(a.Trade) || 0) + 1);
const pending = progress.filter((p) => p.Status !== 'complete').length;

console.log('\nProject     ' + ((T.PROJECT && T.PROJECT[0] && T.PROJECT[0].proj_short_name) || '(unnamed)'));
console.log('Data date   ' + dataDate);
console.log('Activities  ' + activities.length + (dropped ? '  (' + dropped + ' dropped by --construction-only)' : ''));
console.log('Pending     ' + pending);
console.log('Sections    ' + sections.size);
console.log('Trades      ' + tradeCount.size);
console.log('\nWritten:');
console.log('  ' + path.basename(base) + '.activities.csv');
console.log('  ' + path.basename(base) + '.progress.csv');
