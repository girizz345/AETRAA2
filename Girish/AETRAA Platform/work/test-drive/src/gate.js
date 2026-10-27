// THE GATE — one check, and every import passes it.
//
// A contractor who runs three projects and pays for one has an obvious move:
// file the other two into the project they bought. Nothing on the platform
// stopped them, because every importer decided for itself what it would accept.
//
// This is the one place that decides. It lives here rather than in each
// importer for the same reason stepPermission() lives in one place: an importer
// written in two years cannot forget to ask, because it has no other route to
// the register.
//
// Three verdicts, and the asymmetry between them is the whole design:
//
//   MATCH     positive agreement with the project      → file it
//   UNKNOWN   no evidence either way                   → file it, and say so
//   CONFLICT  positive evidence of a mismatch          → hold it
//
// A document is held when the gate can POINT AT THE REASON. It is never held
// because the gate is unsure. That asymmetry is not timidity: a gate that stops
// honest work twice is a gate the document controller routes around, and losing
// the register costs more than the freeloading it prevented.

import { cleanRules, classify } from './drawing-classify.js';
import { addColumns } from './db-cols.js';

export const VERDICTS = ['match', 'unknown', 'conflict'];

// A project's drawing rules, as classify() consumes them. Blank means the gate
// was never configured for this project — which is reported rather than hidden,
// because a gate nobody set up protects nothing and should not look as if it does.
export function rulesOf(project) {
  const raw = project && project.drawing_rules;
  if (!raw) return null;
  try {
    const list = JSON.parse(raw);
    if (!Array.isArray(list) || !list.length) return null;
    return cleanRules(list);
  } catch (e) {
    return null;
  }
}

export function configured(project) {
  return rulesOf(project) !== null;
}

// Other names this project answers to. A drawing stating "DIA-R-0270" belongs
// here; one stating "DIA-R-0271" does not.
export function aliasesOf(project) {
  const out = [];
  const add = (v) => {
    const s = String(v == null ? '' : v).trim().toUpperCase();
    if (s && s.length >= 3 && !out.includes(s)) out.push(s);
  };
  add(project && project.ref);
  add(project && project.name);
  try {
    const extra = JSON.parse((project && project.aliases) || '[]');
    if (Array.isArray(extra)) extra.forEach(add);
  } catch (e) { /* no aliases */ }
  return out;
}

// A project reference as a drawing office writes one: letters, digits and
// separators, at least one of each, long enough not to match a word.
const REF_RE = /\b[A-Z]{2,6}[-/][A-Z0-9]{1,4}[-/][0-9]{2,6}\b/g;

// References stated in a document's own text that are NOT this project's.
// Conservative on purpose: only shapes that really look like a project
// reference count, and only when this project has a reference to compare with.
export function foreignRefs(text, project) {
  const mine = aliasesOf(project);
  if (!mine.length) return [];
  const seen = [];
  const hay = String(text || '').toUpperCase();
  let m;
  REF_RE.lastIndex = 0;
  while ((m = REF_RE.exec(hay))) {
    const ref = m[0];
    if (mine.some((a) => a === ref || a.includes(ref) || ref.includes(a))) continue;
    if (!seen.includes(ref)) seen.push(ref);
  }
  return seen;
}

const verdict = (v, reason, evidence) => ({ verdict: v, reason: reason || '', evidence: evidence || null });

// ---------------------------------------------------------------- the project's identity
//
// Set once by the Admin at setup (P1, step 2a): the plot number(s), the contract
// number and the programme's project ID(s). Each is a list, because a project
// can sit on two plots or carry a client's and a contractor's contract number.
// A blank field is simply not checked — never treated as a mismatch.

// The kinds of document the check may HOLD. Anything else that names another
// project is filed with a note, not held: a letter or a catalogue can mention
// another job honestly; a drawing, a programme or a contract cannot.
export const HOLD_KINDS = ['drawing', 'programme', 'contract'];
export const NOT_PART = 'This document is not part of this project and cannot be attached.';

const listOf = (raw) => String(raw == null ? '' : raw)
  .split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean);
const digits = (s) => String(s || '').replace(/[^0-9]/g, '');
const token = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

export function identityOf(project) {
  const p = project || {};
  return {
    plots: listOf(p.plot_numbers).map(digits).filter((d) => d.length >= 3),
    contracts: listOf(p.contract_no).map(token).filter((t) => t.length >= 3),
    programmes: listOf(p.programme_ids).map(token).filter((t) => t.length >= 2),
  };
}

// Plot numbers a document states, only where it labels them as a plot:
// "PLOT NO. 4210529", "Plot No: 421-0529", "PLOT 4210529". A bare number is
// never read as a plot — it could be anything.
const PLOT_RE = /\bPLOT\s*(?:NO\.?|NUMBER|NUM\.?|#)?\s*[:.\-]?\s*([0-9][0-9 \-/]{2,14}[0-9])/gi;
export function statedPlots(text) {
  const out = [];
  let m;
  PLOT_RE.lastIndex = 0;
  const hay = String(text || '');
  while ((m = PLOT_RE.exec(hay))) {
    const d = digits(m[1]);
    if (d.length >= 3 && !out.includes(d)) out.push(d);
  }
  return out.sort();
}

// Contract numbers a document states: "CONTRACT NO. ABC/123/2026".
const CONTRACT_RE = /\bCONTRACT\s*(?:NO\.?|NUMBER|REF(?:ERENCE)?\.?)\s*[:.\-]?\s*([A-Z0-9][A-Z0-9/\-.]{2,30}[A-Z0-9])/gi;
export function statedContracts(text) {
  const out = [];
  let m;
  CONTRACT_RE.lastIndex = 0;
  const hay = String(text || '');
  while ((m = CONTRACT_RE.exec(hay))) {
    const t = token(m[1]);
    if (t.length >= 3 && /[0-9]/.test(t) && !out.includes(t)) out.push(t);
  }
  return out.sort();
}

// The project ID a Primavera .xer states: the PROJECT table's proj_short_name.
export function xerProjectIds(text) {
  const lines = String(text || '').split(/\r?\n/);
  const out = [];
  let inProject = false, fields = null;
  for (const line of lines) {
    if (line.startsWith('%T')) { inProject = line.split('\t')[1] === 'PROJECT'; fields = null; continue; }
    if (!inProject) continue;
    const cells = line.split('\t');
    if (cells[0] === '%F') { fields = cells.slice(1); continue; }
    if (cells[0] === '%R' && fields) {
      const i = fields.indexOf('proj_short_name');
      const t = i >= 0 ? token(cells[i + 1]) : '';
      if (t && !out.includes(t)) out.push(t);
    }
  }
  return out.sort();
}

// The project's plot number anywhere on the sheet, however it is spaced or
// hyphenated ("4210529", "421-0529", "421 0529"), as a whole number only.
export function showsPlot(text, plots) {
  const hay = String(text || '');
  return plots.some((p) => {
    const body = p.split('').join('[\\s\\-/.]?');
    return new RegExp('(^|[^0-9])' + body + '(?![0-9])').test(hay);
  });
}
// Enough text to judge by. A scanned sheet has none.
export function readable(text) {
  return String(text || '').replace(/\s+/g, '').length >= 50;
}

// What this document says that is not this project. Each entry is evidence a
// person can see: what was stated, where, and what this project is.
export function identityMismatches(project, item) {
  const it = item || {};
  const id = identityOf(project);
  const text = String(it.text || '');
  const found = [];

  const plots = statedPlots(text);
  if (id.plots.length && plots.length && !plots.some((p) => id.plots.includes(p))) {
    found.push({ field: 'plot', stated: plots[0], project: id.plots.join(', '),
      says: 'It states plot ' + plots[0] + '; this project is plot ' + id.plots.join(' / ') + '.' });
  }
  const cons = statedContracts(text);
  if (id.contracts.length && cons.length && !cons.some((c) => id.contracts.includes(c))) {
    found.push({ field: 'contract', stated: cons[0], project: id.contracts.join(', '),
      says: 'It states contract ' + cons[0] + '; this project is contract ' + id.contracts.join(' / ') + '.' });
  }
  if (String(it.kind) === 'programme') {
    const ids = xerProjectIds(text);
    if (id.programmes.length && ids.length && !ids.some((x) => id.programmes.some((p) => x.startsWith(p) || p.startsWith(x)))) {
      found.push({ field: 'programme', stated: ids[0], project: id.programmes.join(', '),
        says: 'The programme is for project ' + ids[0] + '; this project is ' + id.programmes.join(' / ') + '.' });
    }
  }
  const foreign = foreignRefs(text, project);
  if (foreign.length) {
    // Weak: on real drawing text this pattern also matches drawing numbers and
    // the consultant's own job number, so it is noted but never holds alone.
    found.push({ field: 'reference', weak: true, stated: foreign[0], project: project.ref || project.name || '',
      says: 'It names project ' + foreign[0] + '; this project is ' + (project.ref || project.name) + '.' });
  }
  return found;
}

// THE CHECK.
//
//   project  the row, carrying its rules, reference and identity
//   item     { kind, number, filename, text? }
//
// Returns one verdict. It writes nothing and decides nothing beyond the
// verdict — the caller refuses to file a conflict, and the caller is the only
// route to the register.
export function checkIncoming(project, item) {
  const it = item || {};
  const kind = String(it.kind || '');

  // The document stating another plot, contract, programme or project beats
  // everything else. A drawing, a programme or a contract is held; any other
  // kind is filed with the finding noted, never held.
  const id = identityOf(project);

  // A drawing that shows this project's plot number belongs here, whatever
  // else is written on it (a location plan names the plots around it).
  if (kind === 'drawing' && id.plots.length && showsPlot(it.text, id.plots)) {
    return verdict('match', 'Shows this project\'s plot number.', { plot: id.plots.join(', ') });
  }

  const wrong = identityMismatches(project, it);
  const strong = wrong.filter((w) => !w.weak);
  if (strong.length) {
    const evidence = { mismatches: wrong, stated_ref: strong[0].stated, project_ref: project.ref || null };
    if (HOLD_KINDS.includes(kind)) {
      return verdict('conflict', NOT_PART + ' ' + strong.map((w) => w.says).join(' '), evidence);
    }
    return verdict('unknown', 'Filed with a note: ' + strong.map((w) => w.says).join(' '), evidence);
  }
  const note = wrong.length ? ' Noted: ' + wrong.map((w) => w.says).join(' ') : '';

  if (kind === 'programme' && id.programmes.length) {
    return verdict('match', 'The programme\'s project ID matches this project.' + note, { programme: id.programmes.join(', ') });
  }

  if (kind !== 'drawing') return verdict('unknown', 'Nothing on this kind of document identifies a project.' + note);

  // A drawing shows the plot it is for. Tested on Al Warqa'a: 246 of its 247
  // readable sheets carry the plot number, and none of 48 sheets from four other
  // projects did. So where the project's plot is set, a readable drawing that
  // shows it belongs here, and one that does not is parked for the Admin.
  // A sheet with no readable text (a scan) is never parked for this: it says
  // nothing either way, and the AI reader (A1) looks at it instead.
  if (id.plots.length) {
    if (readable(it.text) && project.identity_strict !== 0 && String(project.identity_strict) !== '0') {
      return verdict('conflict',
        NOT_PART + ' It does not show this project\'s plot number (' + id.plots.join(' / ') + ').',
        { mismatches: [{ field: 'plot', stated: '', project: id.plots.join(', '),
          says: 'The plot number ' + id.plots.join(' / ') + ' does not appear on the sheet.' }] });
    }
  }

  const rules = rulesOf(project);
  if (!rules) {
    return verdict('unknown',
      'This project has no drawing numbering set up, so the number was not checked.',
      { configured: false });
  }

  const number = String(it.number || '').trim();
  if (!number) {
    return verdict('unknown', 'No drawing number could be read, so there was nothing to check.',
      { configured: true });
  }

  const c = classify(it.filename || number, rules);
  if (c.matched) {
    return verdict('match', 'Number matches ' + c.reason + '.',
      { prefix: prefixOf(number), rule: c.reason, discipline: c.discipline });
  }

  // The number was readable and matched no rule this project uses. That is the
  // signal the gate exists for: another project's drawings are numbered under
  // another project's scheme.
  return verdict('conflict',
    NOT_PART + ' ' + number + ' is numbered under a scheme this project does not use (' +
      rules.map((r) => r.match).slice(0, 4).join(', ') + ').',
    { prefix: prefixOf(number), known: rules.map((r) => r.match) });
}

// The leading letters of a drawing number — what a rule matches on, and what
// the held queue groups by so one decision covers a hundred sheets.
export function prefixOf(number) {
  const m = String(number || '').toUpperCase().match(/^([A-Z]+)/);
  return m ? m[1] : '';
}

// Approving a held drawing AND teaching the project its rule, so the same hold
// never happens again. Without this the gate is a treadmill: a subcontractor
// numbering shop drawings SUB- on a project set up for ST- and ME- generates a
// hold on every single sheet, forever.
export function widenedRules(project, prefix, discipline, tradeGroup) {
  const p = String(prefix || '').toUpperCase().trim();
  if (!p) return null;
  const existing = rulesOf(project) || [];
  if (existing.some((r) => r.match === p)) return null;          // already known
  const rule = {
    match: p,
    on: 'number',
    discipline: String(discipline || 'Unsorted').trim() || 'Unsorted',
    trade_group: String(tradeGroup || '').trim(),
  };
  return cleanRules(existing.concat([rule]));
}

// Projects made before the gate existed have no column for its rules. Adding it
// is safe to try every time — SQLite and PostgreSQL both refuse a duplicate
// harmlessly — and it is only tried once per running instance, the same way
// ensureModulesColumn() works.
let columnsChecked = false;
export async function ensureGateColumns(env) {
  if (columnsChecked) return;
  // addColumns (db-cols.js): looked up first, so no failed statement — on
  // PostgreSQL a failed SELECT here left drawing_rules missing and the rules
  // unsaveable. Marked done only once the projects table was found.
  columnsChecked = await addColumns(env, 'projects', ['drawing_rules', 'aliases', 'plot_numbers', 'contract_no', 'programme_ids', 'identity_strict'].map((c) => [c, 'TEXT']));
}
