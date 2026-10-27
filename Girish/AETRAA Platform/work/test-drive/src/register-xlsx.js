// Any register, as a real Excel workbook.
//
// The registers used to "export to Excel" by writing a comma-separated file
// with a .csv name. Excel opens it, so nobody complained loudly, but it is not
// a workbook: no column widths, no frozen header, no real dates to sort or
// filter on, no second sheet, and a title carrying a comma splits into two
// columns. A register is the document a contractor hands to a consultant or
// puts in front of a claim; it has to be the real thing.
//
// Two sheets come out of every register:
//   Register  — one row per item, the on-screen columns plus what the screen
//               has no room for: who raised it, when, who it is with now, and
//               how many days late it is.
//   Detail    — every field of every record's own form, one row per record, so
//               the RFI question or the NCR finding travels with the register.
//
// Dates are written as real Excel dates, so a column sorts and filters as a
// date rather than as text.

import { buildXlsx } from './xlsx.js';
import { fils, pctOf, toAED } from './money.js';
import { RECORD_TYPES } from './records.js';
import { FUNCTIONS } from './functions.js';

const c = (v, s) => ({ v, s });
const d = (v) => (v ? { date: String(v).slice(0, 10) } : '');
const todayUAE = () => new Date(Date.now() + 4 * 3600000).toISOString().slice(0, 10);

const dayDiff = (a, b) => Math.round((Date.parse(a + 'T00:00:00Z') - Date.parse(b + 'T00:00:00Z')) / 86400000);

// Register bucket -> { title, cols } — the same columns the screen shows, in
// the same order, so the workbook and the screen cannot drift apart.
// `pick(rec)` returns the middle columns; Ref and Title are always first.
export const REGISTERS = {
  submittals: { title: 'Submittal register', head: ['Type'], pick: (r) => [r.data.Discipline || r.data.Type || ''] },
  rfi:        { title: 'RFI register', head: ['Discipline', 'Priority'], pick: (r) => [r.data.Discipline || '', r.data.Priority || ''] },
  matapp:     { title: 'Material approvals', head: ['Supplier', 'Spec section'], pick: (r) => [r.data.Supplier || '', r.data['Spec section'] || ''] },
  authority:  { title: 'Authority approvals', head: ['Authority', 'Scope'], pick: (r) => [r.data.Authority || '', r.data.Scope || r.data.Type || ''] },
  letters:    { title: 'Correspondence register', head: ['Type', 'To / From'], pick: (r) => [r.data.Type || '', r.data.To || r.data.From || ''] },
  variations: { title: 'Variation register', head: ['Cause', 'Value (AED)'], pick: (r) => [r.data.Cause || r.data.Reason || '', num(r.data.Value || r.data.Amount)] },
  inspections:{ title: 'Inspection requests (WIR / MIR)', head: ['Discipline', 'Inspection date'], pick: (r) => [r.data.Discipline || '', d(r.data['Inspection date'])] },
  ncr:        { title: 'NCR register', head: ['Discipline', 'Severity'], pick: (r) => [r.data.Discipline || '', r.data.Severity || ''] },
  permits:    { title: 'Permits to work', head: ['Permit type', 'Location'], pick: (r) => [r.data.Type || r.data['Permit type'] || '', r.data.Location || ''] },
  hseobs:     { title: 'Observations & near-miss', head: ['Kind', 'Location'], pick: (r) => [r.data.Kind || r.data.Type || '', r.data.Location || ''] },
  mr:         { title: 'Material requests', head: ['Material', 'Quantity'], pick: (r) => [r.data.Material || '', r.data.Quantity || r.data.Qty || ''] },
  certs:      { title: 'Certificates & permits', head: ['Holder / plant', 'Valid until'], pick: (r) => [r.data.Holder || r.data.Plant || r.data['Serial / plant no'] || '', d(r.data['Valid until'] || r.data.Expires)] },
};

function num(v) {
  const n = Number(String(v == null ? '' : v).replace(/[^0-9.\-]/g, ''));
  return isFinite(n) && String(v || '').trim() !== '' ? n : '';
}

// Which record types land in a given register bucket.
export function typesFor(bucket) {
  return Object.keys(RECORD_TYPES).filter((t) => RECORD_TYPES[t].reg === bucket);
}

// The step a record is sitting at, and whose it is — the same answer the
// record screen gives, so an exported register and the screen agree.
function pending(rec) {
  const wf = rec.workflow || [];
  const step = wf.find((s) => s && s.state !== 'done');
  if (!step) return { st: '', by: '' };
  const by = (step.by || []).map((f) => (FUNCTIONS[f] || {}).label || f).join(' or ');
  return { st: step.st || '', by };
}

// Who signed a record's first step: the person who raised it. An imported
// record was raised in the old system: whoever its log names, never the person
// who brought it in.
function raisedBy(rec) {
  if (rec.imported) { const d = rec.data || {}; return d['Raised by'] || d.From || d.Originator || d['Prepared by'] || ''; }
  const wf = rec.workflow || [];
  return (wf[0] && wf[0].state === 'done' && wf[0].who) || rec.created_by || '';
}
// K5 (spec §3): the marker every export carries for a record not raised here.
const ORIGIN = (rec) => (rec.imported ? 'imported — not raised on this platform' : '');
const raisedOn = (rec) => (rec.imported ? rec.original_date || '' : rec.created_at);
const statusOf = (rec, fallback) => (rec.imported
  ? 'Imported' + (rec.original_status ? ' — was "' + rec.original_status + '" in the old system' : '')
  : rec.status || fallback);

export function registerWorkbook(bucket, records, project, opts) {
  const spec = REGISTERS[bucket] || { title: 'Register', head: [], pick: () => [] };
  const today = (opts && opts.today) || todayUAE();
  const title = spec.title;
  const rows = [
    [c(title, 'title')],
    [c(((project || {}).name || '') + ((project || {}).ref ? ' · ' + project.ref : ''), 'muted')],
    [c('As at ' + today + ' · ' + records.length + (records.length === 1 ? ' item' : ' items'), 'muted')],
    [],
    ['Ref'].concat(spec.head, ['Item', 'Raised by', 'Raised on', 'Action by', 'Days late', 'Status', 'Waiting on', 'Origin'])
      .map((h) => c(h, 'head')),
  ];

  // Oldest reference last, as the screen shows them: newest first.
  const sorted = records.slice().sort((a, b) => String(b.ref || '').localeCompare(String(a.ref || '')));
  for (const r of sorted) {
    const p = pending(r);
    const open = !!p.st;
    const late = open && r.due && r.due < today ? dayDiff(today, r.due) : '';
    rows.push([c(r.ref, 'text')]
      .concat(spec.pick(r).map((v) => (v && v.date ? c(v, 'dateBox') : typeof v === 'number' ? c(v, 'num') : c(v, 'text'))))
      .concat([
        c(r.title || '', 'text'),
        c(raisedBy(r), 'text'),
        c(d(raisedOn(r)), 'dateBox'),
        c(d(r.due), 'dateBox'),
        late ? c(late, 'totalLabel') : c('', 'num'),
        c(statusOf(r, open ? p.st : 'Closed'), late ? 'totalLabel' : 'text'),
        c(open ? p.by : '—', 'text'),
        c(ORIGIN(r), r.imported ? 'muted' : 'text'),
      ]));
  }

  const width = rows[4].length;
  const cols = [14].concat(spec.head.map(() => 16), [52, 22, 12, 12, 10, 30, 24, 30]);

  const sheets = [{ name: 'Register', rows, freeze: 6, landscape: true, cols: cols.slice(0, width) }];

  // Sheet 2 — the form behind each record. Every field any record in this
  // register carries becomes a column, so nothing on the form is lost.
  const fields = [];
  for (const r of sorted) for (const k of Object.keys(r.data || {})) if (!fields.includes(k)) fields.push(k);
  if (fields.length) {
    const det = [
      [c(title + ' — full detail', 'title')],
      [],
      ['Ref', 'Item'].concat(fields).map((h) => c(h, 'head')),
    ];
    for (const r of sorted) {
      det.push([c(r.ref, 'text'), c(r.title || '', 'text')]
        .concat(fields.map((k) => {
          const v = (r.data || {})[k];
          if (v == null || v === '') return c('', 'text');
          return /^\d{4}-\d{2}-\d{2}$/.test(String(v)) ? c({ date: v }, 'dateBox') : c(String(v), 'text');
        })));
    }
    sheets.push({ name: 'Detail', rows: det, freeze: 4, landscape: true,
      cols: [14, 52].concat(fields.map(() => 28)) });
  }

  return buildXlsx(sheets, opts);
}

// K10 (v5 A2): the correspondence register — incoming and outgoing in one
// sheet, overdue first, in the columns v5 lists (rows from correspondence.js
// correspondenceRegister, so the screen and the workbook are the same list).
export const CORRESPONDENCE_COLS = ['Ref', 'In/Out', 'Date', 'From / To', 'Their ref', 'Subject', 'Action by', 'Reply-by', 'Answered by', 'Status'];
export function correspondenceWorkbook(list, project, opts) {
  const today = (opts && opts.today) || todayUAE();
  const late = list.filter((x) => x.overdue).length;
  const rows = [
    [c('Correspondence register', 'title')],
    [c(((project || {}).name || '') + ((project || {}).ref ? ' · ' + project.ref : ''), 'muted')],
    [c('As at ' + today + ' · ' + list.length + (list.length === 1 ? ' letter' : ' letters') + (late ? ' · ' + late + ' overdue' : ''), 'muted')],
    [],
    CORRESPONDENCE_COLS.map((h) => c(h, 'head')),
  ];
  for (const x of list) {
    const st = x.overdue ? 'totalLabel' : 'text';
    rows.push([c(x.ref, 'text'), c(x.dir, 'text'), c(d(x.date), 'dateBox'), c(x.from_to, 'text'), c(x.their_ref, 'text'), c(x.subject, 'text'),
      c(x.action_by, 'text'), x.reply_by ? c(d(x.reply_by), 'dateBox') : c('', 'text'), c(x.answered_by, 'text'),
      c((x.overdue ? 'Overdue ' + x.days_late + (x.days_late === 1 ? ' day — ' : ' days — ') : '') + x.status, st)]);
  }
  const det = [[c('Correspondence register — what each letter says and names', 'title')], [], ['Ref', 'Summary', 'Linked records', 'In reply to'].map((h) => c(h, 'head'))];
  for (const x of list) det.push([c(x.ref, 'text'), c(x.summary || '', 'text'), c(x.linked || '', 'text'), c(x.in_reply_to || '', 'text')]);
  return buildXlsx([{ name: 'Register', rows, freeze: 6, landscape: true, cols: [12, 8, 12, 30, 18, 46, 22, 12, 26, 40] },
    { name: 'Detail', rows: det, freeze: 4, landscape: true, cols: [12, 70, 40, 20] }], opts);
}

// K13 (v5 A10): the RFI log, by discipline — Sr, Discipline, Subject, Raised,
// Issued, Reply by, Answered, Days open, Status, Variation flag (rows from
// rfi-prep.js rfiLog, the same list the RFI page shows).
export function rfiWorkbook(list, project, opts) {
  const today = (opts && opts.today) || todayUAE();
  const rows = [
    [c('RFI log', 'title')],
    [c(((project || {}).name || '') + ((project || {}).ref ? ' · ' + project.ref : ''), 'muted')],
    [c('As at ' + today + ' · ' + list.length + (list.length === 1 ? ' RFI' : ' RFIs'), 'muted')],
    [],
    // v5's ten, then who raised it and (K5) its origin.
    ['Sr', 'Ref', 'Discipline', 'Subject', 'Raised', 'Issued', 'Reply by', 'Answered', 'Days open', 'Status', 'Variation flag', 'Raised by', 'Origin'].map((h) => c(h, 'head')),
  ];
  for (const x of list) {
    rows.push([c(x.sr, 'num'), c(x.ref, 'text'), c(x.discipline, 'text'), c(x.subject, 'text'), c(d(x.raised), 'dateBox'), c(d(x.issued), 'dateBox'),
      c(d(x.reply_by), 'dateBox'), c(d(x.answered), 'dateBox'), x.days_open === '' ? c('', 'text') : c(x.days_open, 'num'), c(x.status, 'text'), c(x.variation, x.variation ? 'totalLabel' : 'text'),
      c(x.raised_by || '', 'text'), c(x.origin || '', x.origin ? 'muted' : 'text')]);
  }
  return buildXlsx([{ name: 'RFI log', rows, freeze: 6, landscape: true, cols: [6, 12, 16, 44, 12, 12, 12, 12, 9, 30, 30, 20, 30] }], opts);
}

// The drawing register is not held as records — it has its own table, with
// revisions and an approval state — so it gets its own sheet rather than being
// forced through the record shape.
export function drawingsWorkbook(drawings, project, opts) {
  const today = (opts && opts.today) || todayUAE();
  const rows = [
    [c('Drawing register', 'title')],
    [c(((project || {}).name || '') + ' · as at ' + today, 'muted')],
    [],
    ['Number', 'Rev', 'Title', 'Kind', 'Discipline', 'Floor / zone', 'Status',
     'Uploaded by', 'Uploaded', 'Approved by', 'Approved', 'File', 'Origin'].map((h) => c(h, 'head')),
  ];
  for (const g of drawings) {
    const imp = !!Number(g.imported || 0);
    rows.push([
      c(g.number || '', 'text'), c(g.revision || '', 'text'), c(g.title || '', 'text'),
      c(g.kind || '', 'text'), c(g.discipline || g.trade || '', 'text'), c(g.floor || '', 'text'),
      c(g.status || '', g.status === 'superseded' ? 'muted' : 'text'),
      c(g.uploaded_by || '', 'text'), c(d(imp && g.original_date ? g.original_date : g.uploaded_at), 'dateBox'),
      c(g.approved_by || '', 'text'), c(d(g.approved_at), 'dateBox'),
      c(g.has_file ? 'yes' : 'no', 'text'),
      c(imp ? 'imported — not raised on this platform' : '', imp ? 'muted' : 'text'),
    ]);
  }
  return buildXlsx([{ name: 'Drawings', rows, freeze: 5, landscape: true,
    cols: [18, 7, 52, 12, 14, 14, 14, 20, 12, 20, 12, 8, 30] }], opts);
}

// The priced bill: every line, then the section roll-up the screen shows, with
// the totals as live formulas so a QS can change a percentage and watch it move.
export function boqWorkbook(boq, project, opts) {
  const today = (opts && opts.today) || todayUAE();
  const lines = (boq && boq.lines) || [];
  const rows = [
    [c('Bill of Quantities (priced)', 'title')],
    [c(((project || {}).name || '') + ' · as at ' + today, 'muted')],
    [],
    ['Ref', 'Section', 'Description', 'Unit', 'Quantity', 'Rate (AED)', 'Amount (AED)',
     'Billed %', 'Billed value (AED)'].map((h) => c(h, 'head')),
  ];
  const first = rows.length + 1;
  for (const l of lines) {
    const r = rows.length + 1;
    rows.push([
      c(l.ref || '', 'text'), c(l.section || '', 'text'), c(l.description || l.item || '', 'text'),
      c(l.unit || '', 'text'), c(Number(l.qty) || 0, 'num'), c(Number(l.rate) || 0, 'money'),
      // K1: the Amount is the bill's own, as imported and approved — a value,
      // not E×F. A line the QS accepted with a reason (a lump sum, an agreed
      // figure) would otherwise show a different amount here than every
      // certificate was valued on.
      c(Number(l.amount) || 0, 'money'),
      // A percentage is stored as the fraction Excel's own "0.00%" format
      // expects; writing 50 here would read as 5000%.
      c((Number(l.billed_pct) || 0) / 100, 'pct'),
      // Rounded to the fil per line, then summed — the platform's own rule.
      { v: toAED(pctOf(fils(l.amount) || 0, l.billed_pct || 0)), f: `ROUND(G${r}*H${r},2)`, s: 'money' },
    ]);
  }
  const last = rows.length;
  if (lines.length) {
    rows.push([c('', 'total'), c('', 'total'), c('Total', 'totalLabel'), c('', 'total'), c('', 'total'), c('', 'total'),
      { v: (boq.totals || {}).value || 0, f: `SUM(G${first}:G${last})`, s: 'total' },
      c('', 'total'),
      { v: (boq.totals || {}).billed_value || 0, f: `SUM(I${first}:I${last})`, s: 'total' }]);
  }
  const sheets = [{ name: 'BOQ', rows, freeze: 5, landscape: true,
    cols: [12, 22, 60, 8, 12, 14, 16, 10, 18] }];
  const secs = (boq && boq.sections) || [];
  if (secs.length) {
    const sr = [[c('BOQ — by section', 'title')], [],
      ['Section', 'Lines', 'Value (AED)', 'Billed %', 'Billed value (AED)'].map((h) => c(h, 'head'))];
    for (const s of secs) {
      sr.push([c(s.section, 'text'), c(s.lines || 0, 'num'), c(s.value || 0, 'money'),
        c((Number(s.billed_pct) || 0) / 100, 'pct'), c(s.billed_value || 0, 'money')]);
    }
    sheets.push({ name: 'By section', rows: sr, freeze: 4, cols: [30, 8, 18, 10, 20] });
  }
  return buildXlsx(sheets, opts);
}

// The generated schedule — the same rows the Gantt is drawn from, as dates a
// planner can paste into a programme.
export function scheduleWorkbook(bucket, records, project, opts) {
  const spec = REGISTERS[bucket] || { title: 'Register' };
  const today = (opts && opts.today) || todayUAE();
  const withDates = records.filter((r) => r.due || r.created_at);
  const rows = [
    [c(spec.title + ' — submission schedule', 'title')],
    [c(((project || {}).name || '') + ' · as at ' + today, 'muted')],
    [],
    ['Ref', 'Item', 'Raised on', 'Action by', 'Duration (days)', 'Days late', 'Status'].map((h) => c(h, 'head')),
  ];
  for (const r of withDates.slice().sort((a, b) => String(a.due || '').localeCompare(String(b.due || '')))) {
    const from = String(raisedOn(r) || '').slice(0, 10);
    const to = String(r.due || '').slice(0, 10);
    const span = from && to ? dayDiff(to, from) : '';
    const p = pending(r);
    const late = p.st && to && to < today ? dayDiff(today, to) : '';
    rows.push([c(r.ref, 'text'), c(r.title || '', 'text'), c(d(from), 'dateBox'), c(d(to), 'dateBox'),
      span === '' ? c('', 'num') : c(span, 'num'),
      late ? c(late, 'totalLabel') : c('', 'num'),
      c(r.imported ? statusOf(r) + ' · ' + ORIGIN(r) : (r.status || (p.st || 'Closed')), late ? 'totalLabel' : 'text')]);
  }
  return buildXlsx([{ name: 'Schedule', rows, freeze: 5, landscape: true, cols: [14, 52, 13, 13, 15, 11, 30] }], opts);
}
