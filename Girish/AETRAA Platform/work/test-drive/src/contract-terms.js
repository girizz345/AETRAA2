// THE SEVEN FIGURES — read from the contract, proposed, never applied.
//
// These are the numbers every payment certificate, every reply-by clock and
// every overdue flag on a project is computed from. Today somebody types them
// at onboarding from a contract open on the desk beside them. This reads them
// instead.
//
// THE RULE THAT GOVERNS THIS ENTIRE FILE:
//
//   No contract figure is ever auto-applied. Not one. Whatever the confidence,
//   however unambiguous the sentence, a term is a PROPOSAL the person confirms.
//
// That is the single exception to how the rest of the engine behaves, and it is
// deliberate. Everywhere else, a confident deterministic match is filed. Here a
// wrong answer is silent and expensive: nobody notices a retention rate that is
// one point out until the certificates have been issued for a year, and by then
// the arithmetic has been agreed by both sides.
//
// The second rule, which follows from the first:
//
//   Conflicts are surfaced, never resolved.
//
// Where retention appears in both the General and the Particular Conditions,
// BOTH are shown with their clauses and the person chooses. Lawyers know the
// Particular Conditions prevail. This engine does not know that, and must not
// behave as though it does — a rule of construction is not a regular expression.
//
// Every hit carries its page and the sentence it came from, because a number
// without its clause is exactly as useless as no number at all: the person
// still has to open the contract to check it.

// The ranges are spec §18's. A figure outside them is not proposed with a
// warning — it is not proposed at all: retention above 20% is a misread of some
// other number (UAE contracts run 5-10%), and a "56" lifted from a clause
// number is the classic payment-period error.
export const TERMS = {
  retention_pct:      { label: 'Retention',            unit: '%',    min: 0, max: 20 },
  retention_cap_pct:  { label: 'Retention cap',        unit: '%',    min: 0, max: 10 },
  advance_pct:        { label: 'Advance payment',      unit: '%',    min: 0, max: 30 },
  payment_days:       { label: 'Payment period',       unit: 'days', min: 1, max: 180 },
  rfi_reply_days:     { label: 'RFI reply period',     unit: 'days', min: 1, max: 180 },
  notice_clause:      { label: 'Notice clause',        unit: null },
  completion_date:    { label: 'Completion date',      unit: null },
};

export const TERM_KEYS = Object.keys(TERMS);

// A number as contracts write one: 10, 10.5, 5%, ten per cent is not attempted.
const NUM = '(\\d{1,3}(?:\\.\\d{1,2})?)';

// Each term declares the shapes it takes in a real contract. Several patterns
// per term, because a Particular Conditions amendment and a FIDIC general
// clause phrase the same figure entirely differently.
const PATTERNS = {
  retention_pct: [
    new RegExp('retention\\s+(?:money|percentage)?\\s*(?:of|at|shall\\s+be|is)?\\s*' + NUM + '\\s*(?:%|per\\s*cent)', 'i'),
    new RegExp(NUM + '\\s*(?:%|per\\s*cent)\\s+(?:shall\\s+be\\s+)?(?:deducted|retained|retention)', 'i'),
    new RegExp('percentage\\s+of\\s+retention[^.]{0,40}?' + NUM + '\\s*(?:%|per\\s*cent)', 'i'),
  ],
  retention_cap_pct: [
    new RegExp('(?:limit|maximum|cap|not\\s+exceed(?:ing)?)[^.]{0,60}?retention[^.]{0,40}?' + NUM + '\\s*(?:%|per\\s*cent)', 'i'),
    new RegExp('retention[^.]{0,60}?(?:limit(?:ed)?|maximum|cap(?:ped)?|not\\s+exceed(?:ing)?)[^.]{0,40}?' + NUM + '\\s*(?:%|per\\s*cent)', 'i'),
  ],
  advance_pct: [
    new RegExp('advance\\s+payment[^.]{0,60}?' + NUM + '\\s*(?:%|per\\s*cent)', 'i'),
    new RegExp(NUM + '\\s*(?:%|per\\s*cent)[^.]{0,40}?advance\\s+payment', 'i'),
    new RegExp('mobilisation\\s+(?:advance|payment)[^.]{0,60}?' + NUM + '\\s*(?:%|per\\s*cent)', 'i'),
  ],
  payment_days: [
    new RegExp('(?:payment|paid)[^.]{0,80}?within\\s+(\\d{1,3})\\s+days', 'i'),
    new RegExp('within\\s+(\\d{1,3})\\s+days[^.]{0,60}?(?:payment\\s+certificate|interim\\s+certificate)', 'i'),
    new RegExp('period\\s+for\\s+payment[^.]{0,40}?(\\d{1,3})\\s+days', 'i'),
  ],
  rfi_reply_days: [
    new RegExp('(?:request\\s+for\\s+information|\\bRFI\\b)[^.]{0,80}?within\\s+(\\d{1,3})\\s+days', 'i'),
    new RegExp('(?:respond|reply|response)[^.]{0,60}?within\\s+(\\d{1,3})\\s+days[^.]{0,40}?(?:request\\s+for\\s+information|\\bRFI\\b)', 'i'),
  ],
  notice_clause: [
    /(?:notice[^.]{0,60}?)(sub-?clause\s+\d{1,2}(?:\.\d{1,2}){0,3})/i,
    /(sub-?clause\s+20\.\d{1,2}(?:\.\d{1,2})?)/i,
  ],
  completion_date: [
    /time\s+for\s+completion[^.]{0,80}?(\d{1,2}\s+\w{3,9}\s+\d{4})/i,
    /completion\s+date[^.]{0,40}?(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i,
    /completion\s+date[^.]{0,40}?(\d{1,2}\s+\w{3,9}\s+\d{4})/i,
  ],
};

// The sentence a hit sits in, trimmed to something a person can read in the
// review panel without opening the contract. Sentence boundaries in a contract
// are unreliable — "Sub-Clause 20.2.1." ends with a full stop that ends nothing
// — so this takes a window and tidies it rather than pretending to parse prose.
export function sentenceAround(text, index, span = 220) {
  const s = String(text || '');
  let from = Math.max(0, index - span);
  let to = Math.min(s.length, index + span);
  const before = s.lastIndexOf('. ', index);
  if (before > from) from = before + 2;
  const after = s.indexOf('. ', index);
  if (after > -1 && after < to) to = after + 1;
  return s.slice(from, to).replace(/\s+/g, ' ').trim();
}

// Which page an offset falls on, given the page texts in order. Reported so the
// person can turn to it; where pages are not supplied, null rather than 1,
// because a wrong page number wastes more time than a missing one.
export function pageOf(pages, index) {
  if (!Array.isArray(pages) || !pages.length) return null;
  let seen = 0;
  for (let i = 0; i < pages.length; i++) {
    seen += String(pages[i] || '').length + 1;
    if (index < seen) return i + 1;
  }
  return pages.length;
}

function parseValue(key, raw) {
  if (key === 'notice_clause') {
    return String(raw).replace(/\s+/g, ' ').replace(/^sub-?clause/i, 'Sub-Clause').trim();
  }
  if (key === 'completion_date') return String(raw).trim();
  const n = Number(raw);
  if (!isFinite(n)) return null;
  const { min = 0, max } = TERMS[key];
  if (n < min || (max != null && n > max)) return null;     // out of range is not a hit
  return n;
}

// Arabic-Indic digits (٠-٩) and their Persian forms (۰-۹) read as numbers
// (spec §23): a retention written ١٠٪ must not be missed. One character for one
// character, so every offset — and so every page — stays where it was.
export function westernDigits(text) {
  return String(text || '')
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06F0))
    .replace(/٪/g, '%');
}

// The clause a figure sits under: the last clause heading before it, within a
// page or so. Reported beside the page and the sentence (spec §6, §14), so the
// person checking it turns straight to the clause.
export function clauseBefore(text, index) {
  const body = String(text || '');
  const re = () => /\b(Sub-?Clause|Clause|Article)\s+(\d{1,2}(?:\.\d{1,3}){0,3})(?![\d.]*\d)/gi;
  const name = (m) => (/^sub/i.test(m[1]) ? 'Sub-Clause' : /^art/i.test(m[1]) ? 'Article' : 'Clause') + ' ' + m[2];
  // A clause named in the figure's own sentence is its clause ("10% retention
  // under Clause 14.3", or "Sub-Clause 14.3 Retention ... 10%").
  const sStart = body.lastIndexOf('. ', index) + 1;
  const sEndAt = body.indexOf('. ', index);
  const sentence = body.slice(sStart, sEndAt > -1 ? sEndAt : Math.min(body.length, index + 300));
  const inS = [...sentence.matchAll(re())];
  if (inS.length) {
    const rel = index - sStart;
    const before = inS.filter((m) => m.index <= rel);
    return name(before.length ? before[before.length - 1] : inS[0]);
  }
  // Otherwise the heading it sits under: the last clause named before it.
  let m, last = null;
  const back = re();
  const prior = body.slice(Math.max(0, index - 2500), index);
  while ((m = back.exec(prior))) last = m;
  return last ? name(last) : null;
}

// Find every occurrence of every term. EVERY occurrence, not the first — because
// the same figure stated twice with different values is the case that matters,
// and a first-match-wins reader would hide it.
export function findTerms(text, pages) {
  const body = westernDigits(text);
  const out = {};
  for (const key of TERM_KEYS) {
    const hits = [];
    for (const re of (PATTERNS[key] || [])) {
      const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
      let m;
      while ((m = g.exec(body))) {
        const raw = m[1] != null ? m[1] : m[0];
        const value = parseValue(key, raw);
        if (value == null || value === '') continue;
        const at = m.index;
        if (hits.some((h) => Math.abs(h.at - at) < 8)) continue;   // same hit, two patterns
        hits.push({ value, at, page: pageOf(pages, at), sentence: sentenceAround(body, at),
                    clause: key === 'notice_clause' ? null : clauseBefore(body, at) });
        if (hits.length >= 6) break;
      }
      if (hits.length >= 6) break;
    }
    if (hits.length) out[key] = hits;
  }
  return out;
}

// Turn hits into proposals. A proposal is never ticked by default — the person
// ticks it — and where a term was found more than once with DIFFERENT values,
// every value is carried and the proposal is marked conflicted with nothing
// preselected.
export function proposeTerms(text, pages, current = {}) {
  const found = findTerms(text, pages);
  const proposals = [];

  for (const key of TERM_KEYS) {
    const hits = found[key] || [];
    const distinct = [];
    for (const h of hits) if (!distinct.some((d) => String(d.value) === String(h.value))) distinct.push(h);

    if (!distinct.length) {
      // A blank is a correct outcome, not a failure. The person types it, as
      // they do today.
      proposals.push({ key, label: TERMS[key].label, unit: TERMS[key].unit,
                       value: null, accepted: false, state: 'not_found',
                       note: 'not found in the contract — type it if you need it' });
      continue;
    }

    const conflicted = distinct.length > 1;
    const inUse = current[key];
    const disagrees = inUse != null && inUse !== '' &&
                      !distinct.some((d) => String(d.value) === String(inUse));

    proposals.push({
      key,
      label: TERMS[key].label,
      unit: TERMS[key].unit,
      // Nothing is preselected when the contract says two different things.
      value: conflicted ? null : distinct[0].value,
      options: distinct.map((d) => ({ value: d.value, page: d.page, sentence: d.sentence, clause: d.clause || null })),
      page: conflicted ? null : distinct[0].page,
      sentence: conflicted ? null : distinct[0].sentence,
      clause: conflicted ? null : (distinct[0].clause || null),
      accepted: false,                      // ALWAYS. Never ticked by default.
      state: conflicted ? 'conflict' : disagrees ? 'disagrees' : 'proposed',
      note: conflicted
        ? 'the contract states this more than once — choose which applies'
        : disagrees
          ? 'this project already uses ' + inUse + '. Certificates were computed from ' +
            'that figure, so changing it does not re-do them.'
          : null,
    });
  }
  // A cap above the retention rate is flagged, not refused (spec §18): UAE
  // practice is 10% of each certificate capped at 5% of the contract value.
  const rate = proposals.find((p) => p.key === 'retention_pct');
  const cap = proposals.find((p) => p.key === 'retention_cap_pct');
  if (rate && cap && rate.value != null && cap.value != null && Number(cap.value) > Number(rate.value)) {
    cap.flag = 'above_rate';
    cap.note = (cap.note ? cap.note + ' ' : '') + 'The cap (' + cap.value + '%) is above the retention rate (' +
      rate.value + '%). Caps are normally lower — check the clause before accepting it.';
  }
  return proposals;
}

// Every proposal, as the evidence kept for it (spec §14): what the contract
// said, what the person did with it, and who. A corrected or refused proposal
// is kept as well — a later dispute is informed by knowing the contract said
// something that read as 10% somewhere.
export function termEvidence(proposals, applied) {
  const out = [];
  for (const p of proposals || []) {
    if (!p || !TERMS[p.key]) continue;
    const options = Array.isArray(p.options) ? p.options : [];
    const proposed = p.proposed != null ? p.proposed : (options.length === 1 ? options[0].value : null);
    const taken = applied && Object.prototype.hasOwnProperty.call(applied, p.key) ? applied[p.key] : null;
    let state = 'refused';
    if (p.state === 'not_found' && taken == null) state = 'not_found';
    else if (taken != null) state = proposed != null && String(proposed) === String(taken) ? 'accepted' : 'edited';
    const src = options.find((o) => String(o.value) === String(taken)) || options[0] || {};
    out.push({ key: p.key, state, proposed: proposed == null ? null : String(proposed), value: taken == null ? null : String(taken),
      options: options.map((o) => ({ value: o.value, page: o.page || null, clause: o.clause || null })),
      clause: p.clause || src.clause || null, page: p.page || src.page || null,
      sentence: p.sentence || src.sentence || null });
  }
  return out;
}

// What actually gets written, once a person has ticked and confirmed. Anything
// not explicitly accepted is dropped — an untouched proposal changes nothing.
export function acceptedTerms(proposals) {
  const out = {};
  for (const p of proposals || []) {
    if (!p || !p.accepted) continue;
    if (p.value == null || p.value === '') continue;
    if (!TERMS[p.key]) continue;
    out[p.key] = p.value;
  }
  return out;
}

/* ============================================================ WHO THE PARTIES ARE

   The same discipline as the figures above, applied to the three names on the
   first page: found, quoted with the sentence they came from, and never applied
   without somebody confirming them.

   WHY IT IS WORTH READING AT ALL. The parties used to be three empty boxes an
   admin typed into from memory, which is how a project ends up with the
   Engineer's trading name in one place and their legal name in another, and a
   transmittal addressed to a company that appears nowhere in the contract. The
   names are on the first page of every contract, in about four shapes, and
   reading them is cheap.

   HOW IT READS THEM. Not with one large pattern over the whole sentence — that
   was tried, and it swallowed "of the one part and" into the contractor's name.
   Instead it anchors on the party word, which is unambiguous, and then walks
   outward token by token collecting the ones that look like part of a company
   name, stopping dead at the first ordinary lowercase word. A company name is a
   run of capitals; "and", "between" and "of" are not, and that boundary is far
   more reliable than any amount of regular expression.

   WHAT IT WILL NOT DO. It does not guess. A contract whose preamble is a scan
   returns nothing and the screen says so, rather than offering a blank to be
   filled in silently. Where a party is named twice with two different names,
   both are returned, because that is exactly the case a person needs to see. */

// The words a contract uses for each party. The first is the usual one; the
// rest are also accepted, and which one was matched is reported back so the
// screen can say "found as: Client".
const PARTY_WORDS = {
  developer:  ['employer', 'client', 'owner', 'developer'],
  consultant: ['engineer', 'consultant'],
  contractor: ['contractor'],
};

// Words that end a name. A company name is a run of capitalised tokens; the
// moment an ordinary lowercase word appears, the name stopped one token ago.
const STOP_WORD = /^(?:and|of|the|a|an|to|for|by|with|in|on|at|as|is|are|was|were|be|been|shall|will|may|its|his|her|their|this|that|these|those|between|among|whereas|hereinafter|herein|hereby|referred|called|known|party|parties|part|one|other|first|second|address|registered|having|office|incorporated|represented|acting|trading|namely)$/i;

// A token that can sit inside a company name: starts with a capital or a digit,
// or is a legal suffix written in dots.
const NAME_TOKEN = /^[A-Z0-9][A-Za-z0-9&.,'’\-/()]*$/;

// Trailing punctuation goes, EXCEPT the full stop that is part of "L.L.C." —
// stripping that one turns a legal name into something that does not match the
// company's own letterhead, and a transmittal addressed to "L.L.C" is wrong in
// a way people notice.
function clean(s) {
  let t = String(s || '').replace(/^[\s,;:\-–—]+/, '').trim();
  t = t.replace(/[\s,;:\-–—]+$/, '');
  while (/\.$/.test(t) && !/(?:^|\.)[A-Za-z]\.$/.test(t)) t = t.slice(0, -1).replace(/[\s,;:]+$/, '');
  return t;
}

// A name is not one letter, not a whole paragraph, and not the party word back
// again — that last one is the regex eating its own tail.
function usable(name, words) {
  const s = clean(name);
  if (s.length < 3 || s.length > 120) return '';
  const bare = s.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!bare) return '';
  if (words.some((w) => bare === w.replace(/[^a-z0-9]/g, ''))) return '';
  if (!/[A-Z]/.test(s)) return '';
  return s;
}

// Walk backwards from the end of `tail`, collecting name tokens.
function nameBefore(tail) {
  const toks = String(tail || '').replace(/\s+/g, ' ').trim().split(' ');
  const out = [];
  for (let i = toks.length - 1; i >= 0 && out.length < 8; i--) {
    const t = clean(toks[i]);
    if (!t) { if (out.length) break; else continue; }
    if (STOP_WORD.test(t) || !NAME_TOKEN.test(t)) break;
    out.unshift(t);
  }
  return out.join(' ');
}

// Walk forwards from the start of `rest`, collecting name tokens. Stops at a
// line break as well as at a stop word: a labelled contract ("Employer: X")
// puts the next field on the next line.
function nameAfter(rest) {
  const line = String(rest || '').split(/[\n\r]/)[0];
  const toks = line.replace(/\s+/g, ' ').trim().split(' ');
  const out = [];
  for (let i = 0; i < toks.length && out.length < 8; i++) {
    const t = clean(toks[i]);
    if (!t) { if (out.length) break; else continue; }
    if (STOP_WORD.test(t) || !NAME_TOKEN.test(t)) break;
    out.push(t);
  }
  return out.join(' ');
}

// Every place a party word is used as a definition, with where to look for the
// name relative to it.
function anchorsFor(word) {
  const W = word.replace(/\s+/g, '\\s+');
  const Q = '["“”‘’\']?';
  return [
    // … ICONIC PROPERTIES L.L.C. (hereinafter called "the Employer")
    { re: new RegExp('\\(\\s*(?:hereinafter\\s+)?(?:duly\\s+)?(?:referred\\s+to\\s+as|called|known\\s+as|the)?\\s*' +
                     Q + '\\s*(?:the\\s+)?' + W + '\\s*' + Q + '\\s*\\)', 'gi'), look: 'before' },
    // … ICONIC PROPERTIES L.L.C., hereinafter the Employer,
    { re: new RegExp(',\\s*hereinafter\\s+(?:referred\\s+to\\s+as\\s+|called\\s+)?' +
                     Q + '(?:the\\s+)?' + W + Q, 'gi'), look: 'before' },
    // Employer: ICONIC PROPERTIES L.L.C.   /   Name of the Employer — …
    { re: new RegExp('(?:name\\s+of\\s+)?(?:the\\s+)?' + W + '\\s*[:\\-–—]\\s*', 'gi'), look: 'after' },
    // ICONIC PROPERTIES L.L.C. as the Employer
    { re: new RegExp('\\s+(?:as|acting\\s+as)\\s+(?:the\\s+)?' + W + '\\b', 'gi'), look: 'before' },
  ];
}

// Every candidate name for every party, each with its page and its sentence.
export function findParties(text, pages) {
  const body = String(text || '');
  const out = {};
  for (const party of Object.keys(PARTY_WORDS)) {
    const words = PARTY_WORDS[party];
    const seen = {}, hits = [];
    for (const word of words) {
      for (const { re, look } of anchorsFor(word)) {
        re.lastIndex = 0;
        let m, guard = 0;
        while ((m = re.exec(body)) && guard++ < 300 && hits.length < 4) {
          if (m.index === re.lastIndex) re.lastIndex++;       // never spin on an empty match
          const raw = look === 'before'
            ? nameBefore(body.slice(Math.max(0, m.index - 180), m.index))
            : nameAfter(body.slice(m.index + m[0].length, m.index + m[0].length + 180));
          const name = usable(raw, words);
          if (!name) continue;
          const key = name.toLowerCase().replace(/[^a-z0-9]/g, '');
          if (seen[key]) continue;
          seen[key] = 1;
          hits.push({
            name,
            said_as: word,
            page: pageOf(pages, m.index),
            sentence: sentenceAround(body, m.index),
          });
        }
        if (hits.length >= 4) break;
      }
      if (hits.length >= 4) break;
    }
    out[party] = hits;
  }
  return out;
}

// The one name to put in the box, per party: the first candidate, or ''. The
// rest stay on the screen as alternatives, because the choice is the person's.
export function proposeParties(text, pages) {
  const found = findParties(text, pages);
  const out = {};
  for (const party of Object.keys(found)) {
    const list = found[party];
    out[party] = {
      name: list.length ? list[0].name : '',
      said_as: list.length ? list[0].said_as : '',
      page: list.length ? list[0].page : null,
      sentence: list.length ? list[0].sentence : '',
      alternatives: list.slice(1).map((h) => h.name),
      found: list.length > 0,
    };
  }
  return out;
}
