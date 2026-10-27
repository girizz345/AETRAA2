// THE INTAKE REPORT — spec §30.
//
// Every batch issues a report: what went in, where each thing went, and what
// did not go in and why. Folders arrive in a mess; four hundred files land and
// most are filed. Without a report nobody learns which ones were not — and the
// files that did not go in are exactly the ones somebody must act on.
//
// Three forms of one set of facts: on screen (JSON), Excel (the working list,
// with the X1 header), and PDF (the record, filed to the library, class
// "report", one per batch and never overwritten).
//
// THE RECONCILIATION RULE: every file is in exactly one row of exactly one
// table, and the rows add up to the number of files in the batch. A report
// whose rows do not add up to its own header is a defect, so `reconciles` is
// computed, not assumed.

import { buildXlsx } from './xlsx.js';
import { FAMILIES } from './intake-classify.js';

const safeJson = (s, f) => { try { const v = JSON.parse(s || ''); return v == null ? f : v; } catch (e) { return f; } };

// Where each file ended up. One category per file, no file in two.
export const OUTCOMES = {
  filed:          { label: 'Filed',                       todo: 'Nothing. Check the register it went to if it looks odd.' },
  held:           { label: 'Held — another project',      todo: 'With AETRAA. Nothing for you to do.' },
  already:        { label: 'Already on the project',      todo: 'Nothing. They were here already, or are copies of a sheet that is.' },
  not_identified: { label: 'Not identified',              todo: 'Tell us what these are, or leave them out.' },
  needs_decision: { label: 'Needs a decision',            todo: 'Open the drop and decide: a number, a type, which programme.' },
  pending:        { label: 'Not filed yet',               todo: 'Open the drop and press File.' },
  unsupported:    { label: 'Unsupported type',            todo: 'Cannot be stored. Send these another way, or ask for a supported format.' },
  not_stored:     { label: 'Too large to store yet',      todo: 'CAD files: recognised, not stored until drawings move to object storage. Their PDFs are filed.' },
  draft:          { label: 'Drafts and superseded copies', todo: 'Left out on purpose. Include one only if it is the current issue.' },
  left_out:       { label: 'Left out by you',             todo: 'Nothing, unless one was left out by mistake.' },
  unreadable:     { label: 'Could not be filed',          todo: 'See the reason on each line: usually password-protected, damaged, or missing a number.' },
  rejected:       { label: 'Rejected by AETRAA',          todo: 'See the reason AETRAA gave.' },
  abandoned:      { label: 'Abandoned',                   todo: 'Nothing. The drop was abandoned before these were filed.' },
};
const NOT_ADDED = ['held', 'not_identified', 'needs_decision', 'pending', 'unsupported', 'not_stored', 'draft', 'left_out', 'unreadable', 'rejected', 'abandoned', 'already'];

export function outcomeOf(row) {
  const ex = row.extracted && typeof row.extracted === 'object' ? row.extracted : safeJson(row.extracted, {});
  switch (row.state) {
    case 'filed': return 'filed';
    case 'held': return 'held';
    case 'archived': return 'already';
    case 'failed': return 'unreadable';
    case 'rejected': return 'rejected';
    case 'abandoned': return 'abandoned';
    case 'skipped': return row.family === 'unsupported' ? 'unsupported' : ex.not_stored ? 'not_stored' : ex.draft ? 'draft' : 'left_out';
    default:
      if (row.family === 'unsupported') return 'unsupported';
      if (row.family === 'unknown') return 'not_identified';
      if (ex.needs_decision) return 'needs_decision';
      return 'pending';
  }
}

// How the engine decided, in words a person can check.
function howDecided(row, ex) {
  const bits = [];
  if (row.reason) bits.push(row.reason);
  if (ex.title_source) bits.push('title from ' + ex.title_source);
  if (ex.kind_source) bits.push('stage from ' + ex.kind_source);
  if (ex.number_source) bits.push('number ' + ex.number_source);
  return bits.join(' · ');
}

export function buildReport(batch, items, project) {
  const rows = (items || []).map((r) => {
    const ex = r.extracted && typeof r.extracted === 'object' ? r.extracted : safeJson(r.extracted, {});
    const outcome = outcomeOf({ ...r, extracted: ex });
    return {
      file: r.filename, folder: r.path || '', family: r.family,
      taken_to_be: FAMILIES[r.family] || r.family,
      filed_to: outcome === 'filed' ? (r.filed_to || FAMILIES[r.family] || r.family) : '',
      reference: [ex.number, ex.revision ? 'rev ' + ex.revision : ''].filter(Boolean).join(' ') || ex.reference || '',
      how: howDecided(r, ex), outcome, error: r.error || '',
      gaps: [
        r.family === 'drawing' && outcome === 'filed' && !ex.revision ? 'no revision read' : '',
        r.family === 'drawing' && outcome === 'filed' && !ex.title ? 'no title read' : '',
        ex.face_unreadable ? 'title block unreadable' : '',
        ex.name_conflicts && ex.name_conflicts.length ? 'file name and title block disagree' : '',
        ex.result_changed ? 'read differently from an earlier reading of the same file' : '',
      ].filter(Boolean),
      needs: outcome === 'needs_decision' ? (ex.choose_programme ? 'choose which programme is the baseline'
        : ex.needs_number ? 'type the drawing number' : r.family === 'template' ? 'pick the document type'
        : r.family === 'logo' ? 'say whose logo it is' : 'decide what it is') : '',
    };
  });
  const counts = {};
  for (const k of Object.keys(OUTCOMES)) counts[k] = 0;
  for (const r of rows) counts[r.outcome]++;
  const total = rows.length;
  const sum = Object.values(counts).reduce((a, b) => a + b, 0);
  const notAdded = NOT_ADDED.filter((k) => counts[k]).map((k) => ({
    outcome: k, label: OUTCOMES[k].label, count: counts[k], todo: OUTCOMES[k].todo,
    files: rows.filter((r) => r.outcome === k).map((r) => ({ file: r.file, folder: r.folder, why: r.error || r.how })),
  }));
  const summary = total + ' files · ' + counts.filed + ' filed · ' + counts.held + ' held · ' +
    counts.already + ' already on the project · ' + counts.needs_decision + ' need a decision · ' +
    counts.not_identified + ' not identified · ' + (counts.unsupported + counts.draft + counts.left_out) + ' left out' +
    (counts.unreadable ? ' · ' + counts.unreadable + ' could not be filed' : '') +
    (counts.pending ? ' · ' + counts.pending + ' not filed yet' : '');
  return {
    batch: { id: batch.id, started_by: batch.started_by, started_at: batch.started_at, finished_at: batch.finished_at,
             status: batch.status, scope: batch.scope },
    project: { id: project && project.id, name: project && project.name, ref: project && project.ref },
    total, counts, summary, reconciles: sum === total,
    added: rows.filter((r) => r.outcome === 'filed'),
    not_added: notAdded,
    needs_decision: rows.filter((r) => r.outcome === 'needs_decision').map((r) => ({ file: r.file, folder: r.folder, needs: r.needs })),
    could_not_tell: rows.filter((r) => r.gaps.length).map((r) => ({ file: r.file, folder: r.folder, gaps: r.gaps })),
    rows,
  };
}

// The working list: sortable, filterable, sendable to whoever chases the gaps.
export function reportWorkbook(rep, opts) {
  const c = (v, s) => ({ v, s });
  const head = (cols) => cols.map((h) => c(h, 'head'));
  const sum = [[c('Intake report', 'title')], [c(rep.summary, 'muted')], [],
    head(['Where the files went', 'Files', 'What to do'])];
  for (const k of Object.keys(OUTCOMES)) {
    if (rep.counts[k]) sum.push([c(OUTCOMES[k].label, 'text'), c(rep.counts[k], 'num'), c(OUTCOMES[k].todo, 'text')]);
  }
  sum.push([c('Total', 'totalLabel'), c(rep.total, 'total'), c(rep.reconciles ? 'Every file accounted for.' : 'DOES NOT RECONCILE', 'totalLabel')]);
  const added = [[c('Added', 'title')], [], head(['File', 'Folder it came from', 'Taken to be', 'Filed to', 'Reference given', 'How it was decided'])];
  for (const r of rep.added) added.push([r.file, r.folder, r.taken_to_be, r.filed_to, r.reference, r.how].map((v) => c(v || '', 'text')));
  const not = [[c('Not added', 'title')], [], head(['Reason', 'File', 'Folder', 'Why', 'What to do'])];
  for (const g of rep.not_added) for (const f of g.files) not.push([g.label, f.file, f.folder, f.why, g.todo].map((v) => c(v || '', 'text')));
  const dec = [[c('Needs a decision', 'title')], [], head(['File', 'Folder', 'What is needed'])];
  for (const r of rep.needs_decision) dec.push([r.file, r.folder, r.needs].map((v) => c(v || '', 'text')));
  const gap = [[c('What the engine could not tell you', 'title')], [], head(['File', 'Folder', 'Missing'])];
  for (const r of rep.could_not_tell) gap.push([r.file, r.folder, r.gaps.join('; ')].map((v) => c(v || '', 'text')));
  return buildXlsx([
    { name: 'Summary', rows: sum, freeze: 5, cols: [34, 10, 70] },
    { name: 'Added', rows: added, freeze: 4, landscape: true, cols: [40, 30, 22, 30, 18, 60] },
    { name: 'Not added', rows: not, freeze: 4, landscape: true, cols: [26, 40, 30, 50, 50] },
    { name: 'Needs a decision', rows: dec, freeze: 4, cols: [40, 30, 40] },
    { name: 'Could not tell', rows: gap, freeze: 4, cols: [40, 30, 50] },
  ], opts);
}

// The record: a plain PDF, filed to the library. Standard fonts only, so any
// character the font cannot draw is replaced rather than failing the report.
export async function reportPdf(rep, header) {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const W = 595, H = 842, M = 40, LH = 12;
  let page = doc.addPage([W, H]), y = H - M;
  const clean = (s) => String(s == null ? '' : s).replace(/[^\x20-\x7E -ÿ–—‘’“”•…]/g, '?');
  const need = (h) => { if (y - h < M) { page = doc.addPage([W, H]); y = H - M; } };
  const text = (s, opts = {}) => {
    const f = opts.bold ? bold : font, size = opts.size || 9, maxW = W - 2 * M - (opts.indent || 0);
    const words = clean(s).split(/\s+/);
    let line = '';
    const out = [];
    for (const w of words) {
      const t = line ? line + ' ' + w : w;
      if (f.widthOfTextAtSize(t, size) > maxW && line) { out.push(line); line = w; } else line = t;
    }
    if (line) out.push(line);
    for (const l of out) {
      need(size + 3);
      page.drawText(l, { x: M + (opts.indent || 0), y: y - size, size, font: f, color: opts.grey ? rgb(0.35, 0.38, 0.45) : rgb(0.1, 0.12, 0.18) });
      y -= size + 3;
    }
  };
  const gapY = (n) => { y -= n; };
  text('Intake report', { bold: true, size: 16 }); gapY(4);
  const h = header || {};
  text('Project: ' + (h.project || rep.project.name || '') + (h.ref || rep.project.ref ? '  ·  ' + (h.ref || rep.project.ref) : ''));
  text('Drop ' + rep.batch.id + ', run by ' + (rep.batch.started_by || '—') + ' on ' + String(rep.batch.started_at || '').slice(0, 16).replace('T', ' '));
  text('As at: ' + (h.as_at || new Date().toISOString().slice(0, 16).replace('T', ' ')), { grey: true });
  gapY(6); text(rep.summary, { bold: true });
  text(rep.reconciles ? 'Every file is accounted for: the rows below add up to ' + rep.total + '.'
    : 'WARNING: the rows do not add up to the number of files. This is a defect — report it.', { grey: !!rep.reconciles });
  gapY(8); text('Added (' + rep.added.length + ')', { bold: true, size: 11 });
  for (const r of rep.added) text(r.file + '  —  ' + r.taken_to_be + ' → ' + r.filed_to + (r.reference ? '  (' + r.reference + ')' : '') + (r.folder ? '  from ' + r.folder : ''), { indent: 8 });
  for (const g of rep.not_added) {
    gapY(8); text(g.label + ' (' + g.count + ') — ' + g.todo, { bold: true, size: 11 });
    for (const f of g.files) text(f.file + (f.folder ? '  (' + f.folder + ')' : '') + (f.why ? '  —  ' + f.why : ''), { indent: 8 });
  }
  if (rep.could_not_tell.length) {
    gapY(8); text('What the engine could not tell you (' + rep.could_not_tell.length + ')', { bold: true, size: 11 });
    for (const r of rep.could_not_tell) text(r.file + '  —  ' + r.gaps.join('; '), { indent: 8 });
  }
  gapY(10);
  text('This report says what happened. It does not say the project is correctly set up, that the drawing register is complete, or that anything is fit for use.', { grey: true });
  return await doc.save();
}
