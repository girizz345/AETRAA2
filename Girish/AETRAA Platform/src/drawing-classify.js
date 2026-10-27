// SORTING A HEAP OF DRAWINGS INTO THEIR SECTIONS.
//
// A drawing office hands over a folder of a few hundred files. Each one has to
// land in the right section — Structure, MEP, Architecture — with its number,
// revision and kind (Tender / IFC / Shop) read off, so it appears on the right
// register and reaches the right activity. Doing that by hand, one upload at a
// time, is the job nobody does, which is why drawing registers rot.
//
// This is the brain both bulk tools share: the browser folder-upload and the
// Python CLI. It is deterministic — the same file always sorts the same way —
// and it OWNS UP when it cannot place a file rather than guessing a section. An
// unplaced drawing is filed as "unsorted" for a person (or the optional AI
// step) to place, never dropped into the wrong discipline where it would be
// built from.

import { fromFileName, KINDS } from './drawings.js';

// The rules, in the order they are tried. Each maps a drawing-number prefix (or
// a filename pattern) to a section. THESE ARE DEFAULTS — every project overrides
// them, because one office's "S-" is another's "ST-". A rule is
//   { match, discipline, trade_group, kind? }
// where `match` is a prefix on the parsed drawing NUMBER (preferred) or, with
// `on:'name'`, a substring of the whole filename.
export const DEFAULT_RULES = [
  // Structure / Civil
  { match: 'ST', discipline: 'Structural', trade_group: 'Civil' },
  { match: 'S',  discipline: 'Structural', trade_group: 'Civil' },
  { match: 'C',  discipline: 'Civil',      trade_group: 'Civil' },
  { match: 'CIV',discipline: 'Civil',      trade_group: 'Civil' },
  { match: 'INF',discipline: 'Infrastructure', trade_group: 'Civil' },
  // Architecture
  { match: 'AR', discipline: 'Architectural', trade_group: 'Architecture' },
  { match: 'A',  discipline: 'Architectural', trade_group: 'Architecture' },
  { match: 'ID', discipline: 'Interior',      trade_group: 'Architecture' },
  { match: 'LA', discipline: 'Landscape',     trade_group: 'Architecture' },
  { match: 'FA', discipline: 'Facade',        trade_group: 'Architecture' },
  { match: 'FAC',discipline: 'Facade',        trade_group: 'Architecture' },
  // MEP
  { match: 'ME', discipline: 'Mechanical', trade_group: 'MEP' },
  { match: 'M',  discipline: 'Mechanical', trade_group: 'MEP' },
  { match: 'HV', discipline: 'HVAC',       trade_group: 'MEP' },
  { match: 'EL', discipline: 'Electrical', trade_group: 'MEP' },
  { match: 'E',  discipline: 'Electrical', trade_group: 'MEP' },
  { match: 'PL', discipline: 'Plumbing',   trade_group: 'MEP' },
  { match: 'P',  discipline: 'Plumbing',   trade_group: 'MEP' },
  { match: 'FP', discipline: 'Fire protection', trade_group: 'MEP' },
  { match: 'FF', discipline: 'Fire fighting',   trade_group: 'MEP' },
  { match: 'FA-',discipline: 'Fire alarm',      trade_group: 'MEP' },  // note: FA also facade; kept after
  { match: 'DR', discipline: 'Drainage',   trade_group: 'MEP' },
  { match: 'LV', discipline: 'ELV / Low voltage', trade_group: 'MEP' },
];

// The kind (Tender / IFC / Shop / Spec) read from the filename, since the same
// number is issued at each stage. The number prefix cannot tell these apart, so
// this reads words the office actually writes into the name.
const KIND_HINTS = [
  [/\b(if[c]?|issued[ _-]?for[ _-]?construction)\b/i, 'ifc'],
  [/\b(tender|ift|issued[ _-]?for[ _-]?tender)\b/i, 'tender'],
  [/\b(shop|sd|shop[ _-]?drawing)\b/i, 'shop'],
  [/\b(spec|specification)\b/i, 'spec'],
  [/\b(sk|sketch)\b/i, 'sketch'],
];

// The floor / level, if the name says it. "L4", "Level 02", "B1", "podium",
// "roof", "ground". Left blank rather than guessed.
function floorFromName(name) {
  // Underscores are word characters, so "_L4" has no boundary before the L.
  // A drawing office types underscores where others type spaces.
  const s = String(name || '').replace(/_/g, ' ');
  let m = s.match(/\b(?:level|lvl|l)[ _-]?(\d{1,2})\b/i);
  if (m) return 'Level ' + Number(m[1]);
  m = s.match(/\b(b(?:asement)?)[ _-]?(\d{1,2})\b/i);
  if (m) return 'Basement ' + Number(m[2]);
  if (/\bpodium\b/i.test(s)) return 'Podium';
  if (/\broof\b/i.test(s)) return 'Roof';
  if (/\b(ground|gf)\b/i.test(s)) return 'Ground';
  return '';
}

// Normalise a rules list from a project (or the default). Bad entries are
// dropped rather than allowed to misfile — a rule with no discipline is not a
// rule.
export function cleanRules(list) {
  const src = Array.isArray(list) && list.length ? list : DEFAULT_RULES;
  return src
    .map((r) => ({
      match: String(r.match || '').toUpperCase().trim(),
      on: r.on === 'name' ? 'name' : 'number',
      discipline: String(r.discipline || '').trim(),
      trade_group: String(r.trade_group || '').trim(),
      kind: KINDS.includes(r.kind) ? r.kind : null,
    }))
    .filter((r) => r.match && r.discipline)
    // Longest prefix first, so "ST" wins over "S" and "FA-" over "FA".
    .sort((a, b) => b.match.length - a.match.length);
}

// The prefix of a drawing number: the letters, and a trailing '-' if the number
// carries one, so a rule can be written as "FA-" to beat "FA".
function numberPrefix(number) {
  const m = String(number || '').toUpperCase().match(/^([A-Z]+-?)/);
  return m ? m[1] : '';
}

// Classify ONE file. Returns everything saveDrawing wants, plus `matched` so the
// caller knows whether this was placed by a rule or left for a person/AI.
export function classify(filename, rules) {
  const rr = cleanRules(rules);
  const parsed = fromFileName(filename);          // { number, revision, title }
  const name = String(filename || '');

  // kind
  let kind = 'shop';                              // a bare sheet from site is a shop drawing
  for (const [re, k] of KIND_HINTS) { if (re.test(name)) { kind = k; break; } }

  const out = {
    filename: name,
    number: parsed.number || '',
    revision: parsed.revision || '',
    title: parsed.title || '',
    kind,
    floor: floorFromName(name),
    discipline: '',
    trade_group: '',
    matched: false,
    reason: '',
  };

  // A file we cannot even read a number from is not sortable by rule at all.
  if (!out.number) { out.reason = 'no drawing number could be read from the name'; return out; }

  const prefix = numberPrefix(out.number);
  // number-prefix rules
  for (const r of rr) {
    if (r.on !== 'number') continue;
    if (prefix === r.match || prefix === r.match + '-' || prefix.replace(/-$/, '') === r.match.replace(/-$/, '')) {
      out.discipline = r.discipline; out.trade_group = r.trade_group;
      if (r.kind) out.kind = r.kind;
      out.matched = true; out.reason = 'number prefix ' + r.match;
      return out;
    }
  }
  // filename-substring rules (a fallback for offices that do not prefix numbers)
  const upper = name.toUpperCase();
  for (const r of rr) {
    if (r.on !== 'name') continue;
    if (upper.includes(r.match)) {
      out.discipline = r.discipline; out.trade_group = r.trade_group;
      if (r.kind) out.kind = r.kind;
      out.matched = true; out.reason = 'name contains ' + r.match;
      return out;
    }
  }
  out.reason = 'number prefix "' + prefix + '" matches no rule';
  return out;
}

// Classify a whole list, and split it the way the tools present it: what sorted,
// and what needs a human or the AI step. A summary counts each section so the
// person sees "142 sorted — 88 Structure, 31 MEP, 23 Architecture — 6 unsorted"
// before anything is committed.
export function classifyBatch(filenames, rules) {
  const sorted = [], unsorted = [];
  for (const f of filenames || []) {
    const c = classify(f, rules);
    (c.matched ? sorted : unsorted).push(c);
  }
  const bySection = {};
  for (const c of sorted) {
    const k = c.trade_group || c.discipline || 'Other';
    bySection[k] = (bySection[k] || 0) + 1;
  }
  return {
    total: (filenames || []).length,
    sorted, unsorted,
    counts: { sorted: sorted.length, unsorted: unsorted.length, by_section: bySection },
  };
}
