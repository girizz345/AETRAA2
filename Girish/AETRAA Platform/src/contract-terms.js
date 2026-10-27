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

export const TERMS = {
  retention_pct:      { label: 'Retention',            unit: '%',    max: 100 },
  retention_cap_pct:  { label: 'Retention cap',        unit: '%',    max: 100 },
  advance_pct:        { label: 'Advance payment',      unit: '%',    max: 100 },
  payment_days:       { label: 'Payment period',       unit: 'days', max: 365 },
  rfi_reply_days:     { label: 'RFI reply period',     unit: 'days', max: 365 },
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
  const max = TERMS[key].max;
  if (n < 0 || (max != null && n > max)) return null;       // out of range is not a hit
  return n;
}

// Find every occurrence of every term. EVERY occurrence, not the first — because
// the same figure stated twice with different values is the case that matters,
// and a first-match-wins reader would hide it.
export function findTerms(text, pages) {
  const body = String(text || '');
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
        hits.push({ value, at, page: pageOf(pages, at), sentence: sentenceAround(body, at) });
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
      options: distinct.map((d) => ({ value: d.value, page: d.page, sentence: d.sentence })),
      page: conflicted ? null : distinct[0].page,
      sentence: conflicted ? null : distinct[0].sentence,
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
  return proposals;
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
