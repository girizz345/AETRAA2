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

// THE CHECK.
//
//   project  the row, carrying its rules and reference
//   item     { kind, number, filename, text? }
//
// Returns one verdict. It writes nothing and decides nothing beyond the
// verdict — the caller refuses to file a conflict, and the caller is the only
// route to the register.
export function checkIncoming(project, item) {
  const it = item || {};
  const kind = String(it.kind || '');

  // A foreign project reference stated in the document beats everything else:
  // it is the document naming a project that is not this one.
  const foreign = foreignRefs(it.text, project);
  if (foreign.length) {
    return verdict('conflict',
      'This document names project ' + foreign[0] + '. This project is ' + (project.ref || project.name) + '.',
      { stated_ref: foreign[0], project_ref: project.ref || null });
  }

  if (kind !== 'drawing') return verdict('unknown', 'Nothing on this kind of document identifies a project.');

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
    number + ' is numbered under a scheme this project does not use (' +
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
  for (const col of ['drawing_rules', 'aliases']) {
    try {
      await env.DB.prepare(`SELECT ${col} FROM projects LIMIT 1`).first();
    } catch (e) {
      try { await env.DB.prepare(`ALTER TABLE projects ADD COLUMN ${col} TEXT`).run(); }
      catch (e2) { /* already there, or this database will not take it */ }
    }
  }
  columnsChecked = true;
}
