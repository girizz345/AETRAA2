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
import { stageFromText } from './titleblock.js';

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

// Abbreviations an office types into a FILE NAME but would never stamp on the
// face of a sheet. Tried only after the sheet's own words have been asked.
//
// The bare word "if" is deliberately NOT here. It used to be — `/\b(if[c]?)\b/`
// — and it matched the English word, so "Roof plan if revised.pdf" and dozens
// like it were filed as Issued For Construction.
const NAME_HINTS = [
  [/\b(sd|shdw)\b/i, 'shop'],
  [/\b(spec)\b/i, 'spec'],
  [/\b(sk)\b/i, 'sketch'],
  [/\b(ab|asb)\b/i, 'asbuilt'],
];

// WHICH SECTION A SHEET BELONGS IN, and how confident we are of it.
//
// Three sources, in the order a document controller would trust them:
//
//   1 THE SHEET'S OWN FACE  — the "PURPOSE OF ISSUE" box, or a stamp on it.
//     This is the only authoritative one, because it is what the engineer who
//     sealed the sheet wrote.
//   2 THE FOLDER IT ARRIVED IN — "03 - IFC Drawings/". An office that sorts
//     its own issue folders is telling us something real.
//   3 THE FILE NAME — the weakest, and the one that used to be the only one.
//
// When none of the three says anything, the answer is 'other' and NOT 'shop'.
// A sheet of unknown stage sitting in Shop is a lie the register then tells
// everybody downstream; a sheet in Other is a question somebody can answer in
// one click.
export function kindFrom(opts = {}) {
  const face = opts.face || {};
  if (face.stage && KINDS.includes(face.stage)) {
    return { kind: face.stage, kind_source: face.stage_source || 'title block', from_face: true };
  }

  // The folder, without the file's own name, so this really is the folder.
  const path = String(opts.path || '');
  const folder = path.replace(/[^/\\]*$/, '').replace(/[\\/_-]+/g, ' ');
  const byFolder = stageFromText(folder);
  if (byFolder) return { kind: byFolder, kind_source: 'folder "' + folder.trim() + '"' };

  const name = String(opts.filename || '').replace(/[_-]+/g, ' ');
  const byName = stageFromText(name);
  if (byName) return { kind: byName, kind_source: 'file name' };
  for (const [re, k] of NAME_HINTS) if (re.test(name)) return { kind: k, kind_source: 'file name' };

  return { kind: 'other', kind_source: '' };
}

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
export function classify(filename, rules, opts = {}) {
  const rr = cleanRules(rules);
  const parsed = fromFileName(filename);          // { number, revision, title }
  const name = String(filename || '');

  const stage = kindFrom({ filename: name, path: opts.path, face: opts.face });
  let kind = stage.kind;

  const out = {
    filename: name,
    number: parsed.number || '',
    revision: parsed.revision || '',
    title: parsed.title || '',
    kind,
    kind_source: stage.kind_source,
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
      // A project rule may name a stage, but never over the sheet's own face.
      if (r.kind && !stage.from_face) {
        out.kind = r.kind; out.kind_source = 'project rule ' + r.match;
      }
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
      // A project rule may name a stage, but never over the sheet's own face.
      if (r.kind && !stage.from_face) {
        out.kind = r.kind; out.kind_source = 'project rule ' + r.match;
      }
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
