// WHAT IS THIS FILE? — the classifier, and nothing else.
//
// A contractor's folder holds four hundred files, half of them named
// Scan_0012.pdf. Before anything can be extracted, routed or filed, the engine
// has to answer one question per file: what IS this?
//
// The answer is reached by deterministic cascades — extension first, then a
// per-extension ladder of tests. The rule that governs the whole file:
//
//   A test that matches names itself. A test that does not match says nothing.
//
// So every classification carries the reason it was reached, and a file that
// matches nothing comes back 'unknown' rather than guessed into a family. An
// unidentified file is listed for a person; it is never discarded and never
// assumed. Two hundred unidentified files is a signal that this contractor's
// folder tree needs configuring — not a failure to paper over.
//
// WHY THIS IS SEPARATE FROM intake.js: classification is pure. Same inputs,
// same answer, on Tuesday and on Friday, with no database and no network. That
// makes it testable line by line, which matters because every wrong answer here
// becomes a document filed in the wrong place on somebody's live project.
//
// WHERE THE MODEL FITS: nowhere in this file. A model may later PROPOSE a
// family for a file this returns 'unknown' for; it may never override one these
// tests placed. The deterministic path is the spine.

// The fourteen families, plus 'unknown'. A family says what a file IS on the
// way in; the library's classes say which shelf it lands on. They are different
// vocabularies on purpose and do not map one to one.
export const FAMILIES = {
  drawing: 'Drawing',
  specification: 'Specification',
  contract: 'Contract',
  programme: 'Programme',
  commercial: 'BOQ / BOM',
  payment: 'Payment application or certificate',
  technical: 'Submittal / material approval / method statement',
  quality: 'Inspection / NCR / test certificate',
  hse: 'HSE record',
  authority: 'Authority NOC or approval',
  correspondence: 'Letter',
  minutes: 'Transmittal or meeting minutes',
  site: 'Diary / survey / photograph',
  handover: 'O&M manual / warranty',
  template: 'Blank consultant form',
  logo: 'Logo',
  cad: 'CAD file',
  archive: 'Zip archive',
  unsupported: 'Unsupported type',
  unknown: 'Not identified',
};

// ---------------------------------------------------------------- what may be stored at all
//
// Spec §19. The attachment check tests the MIME type, and a browser sends an
// empty or generic one for many files, so a type on no list used to pass. Intake
// therefore checks the EXTENSION as well: a file whose extension is on neither
// list is listed as unsupported and never stored. Executables are refused by
// name whatever their MIME type, and a macro-enabled .docm is unsupported (an
// .xlsm is read for its data only, never its macros).
export const ALLOWED_EXT = ['pdf', 'dwg', 'dxf', 'xer', 'mpp', 'xlsx', 'xlsm', 'xls', 'csv', 'docx', 'doc', 'rtf',
  'jpg', 'jpeg', 'heic', 'png', 'msg', 'eml', 'zip', 'txt'];
export const BLOCKED_EXT = ['exe', 'msi', 'bat', 'cmd', 'com', 'scr', 'pif', 'jar', 'js', 'mjs', 'vbs', 'ps1', 'sh',
  'app', 'dmg', 'deb', 'rpm', 'html', 'htm', 'svg', 'docm', 'dotm', 'xlam', 'lnk', 'dll', 'hta', 'wsf'];

export function supportedExt(filename) {
  const ext = extensionOf(filename);
  if (!ext) return { ok: false, reason: 'a file with no extension cannot be stored' };
  if (BLOCKED_EXT.includes(ext)) return { ok: false, reason: '.' + ext + ' files cannot be uploaded' };
  if (!ALLOWED_EXT.includes(ext)) return { ok: false, reason: '.' + ext + ' is not a type the platform stores' };
  return { ok: true, ext };
}

// ---------------------------------------------------------------- drafts and superseded copies
//
// Spec §17: a file whose name says draft, superseded or void is listed
// separately and NOT filed by default. A superseded document filed as current
// is the most damaging single error this engine can make.
const DRAFT_RE = /(^|[^a-z])(draft|superseded|void|obsolete|cancelled|canceled)([^a-z]|$)/i;
export function draftWord(filename, path) {
  const name = String(filename || '').replace(/\.[a-z0-9]{1,5}$/i, '');
  const m = DRAFT_RE.exec(name) || DRAFT_RE.exec(String(path || ''));
  return m ? m[2].toLowerCase() : null;
}

// ---------------------------------------------------------------- the company's folder map
//
// Spec §4: a mapping the company confirmed ("/05 MAR/ is material approvals")
// decides a file in a folder of that name. Only confirmed mappings are ever
// passed in; a proposal never classifies anything.
export function folderMapHit(path, map) {
  if (!Array.isArray(map) || !map.length) return null;
  const segs = String(path || '').split(/[\\/]+/).map((x) => x.trim().toLowerCase()).filter(Boolean);
  for (let i = segs.length - 1; i >= 0; i--) {
    const hit = map.find((m) => m && m.pattern && String(m.pattern).trim().toLowerCase() === segs[i]);
    if (hit) return hit;
  }
  return null;
}

// Which phase files each family. A family whose phase is not yet built is still
// classified and still listed — it simply routes to the library or is reported
// as recognised-but-not-stored, rather than silently vanishing.
export const PHASE_OF = {
  programme: 5, commercial: 5, template: 5, logo: 5, contract: 8,
  drawing: 4, specification: 4, cad: 7,
  payment: 6, technical: 6, quality: 6, hse: 6, authority: 6,
  correspondence: 6, minutes: 6, site: 6,
  handover: 3, unknown: 0,
};

const lower = (s) => String(s == null ? '' : s).toLowerCase();

export function extensionOf(filename) {
  const m = lower(filename).match(/\.([a-z0-9]{1,5})$/);
  return m ? m[1] : '';
}

const verdict = (family, reason, extra) =>
  ({ family, reason, record_type: null, ...(extra || {}) });

// ---------------------------------------------------------------- folder hints
//
// A tidy tree already encodes the answer: /04 Submittals/, /Test Certificates/,
// /IFC Drawings/Structural/. When it is there it is the cheapest signal there
// is.
//
// BUT A TIDY TREE IS THE LUCKY CASE. Real folders arrive flat — four hundred
// files in one directory — or named after people, or dates, or nothing. So a
// folder name is a hint used WHEN IT IS DECISIVE and ignored when it is not. A
// folder called "04 Submittals" decides; one called "Ahmed" or "New folder"
// contributes nothing and the next test runs.
//
// Every test after this one is written assuming there is no useful folder name
// at all. A folder tree makes the engine better; its absence never makes it
// fail.
const FOLDER_HINTS = [
  [/\b(ifc|issued\s*for\s*construction|tender|shop)\s*(drawing|dwg)/, 'drawing'],
  [/\b(drawing|dwg)s?\b/, 'drawing'],
  [/\bspec(ification)?s?\b/, 'specification'],
  [/\bcontract|conditions\s+of\s+contract|agreement\b/, 'contract'],
  [/\b(boq|bill\s+of\s+quantit)/, 'commercial'],
  [/\b(ipc|payment|valuation|invoice)/, 'payment'],
  [/\b(submittal|material\s+approval|method\s+statement|rfi)/, 'technical'],
  [/\b(test\s*cert|certificate|ncr|inspection|itp|qa\s*\/?\s*qc|quality)/, 'quality'],
  [/\b(hse|safety|permit|incident)/, 'hse'],
  [/\b(noc|authority|dewa|dcd|civil\s*defence|municipalit|trakhees)/, 'authority'],
  [/\b(letter|correspondence|incoming|outgoing)/, 'correspondence'],
  [/\b(minute|transmittal|mom)\b/, 'minutes'],
  [/\b(photo|picture|image|site\s*record|diary|survey)/, 'site'],
  [/\b(o\s*&\s*m|o\s*and\s*m|operation\s*(and|&)\s*maintenance|warrant|handover|as[-\s]*built)/, 'handover'],
  [/\b(template|blank\s*form|forms?)\b/, 'template'],
  [/\blogos?\b/, 'logo'],
];

// Folder names that carry no information. Named explicitly so that "New folder"
// never reads as a family and never suppresses a later test.
const EMPTY_FOLDER = /^(new folder.*|folder\s*\d*|untitled.*|misc|other|temp|tmp|scan(ned)?|docs?|documents?|files?|\d{1,4}|[a-z]{1,4}|.{0,2})$/i;

export function folderHint(path) {
  const parts = String(path || '').split(/[\\/]+/).filter(Boolean);
  // Deepest folder first: /Drawings/Structural/ is more specific than /Drawings/.
  for (let i = parts.length - 1; i >= 0; i--) {
    const seg = parts[i].trim();
    if (!seg || EMPTY_FOLDER.test(seg)) continue;
    const hay = lower(seg);
    for (const [re, fam] of FOLDER_HINTS) {
      if (re.test(hay)) return { family: fam, segment: seg };
    }
  }
  return null;
}

// ---------------------------------------------------------------- tokens
//
// A file carrying {{token}} or <<token>> and no data rows is a blank form,
// whatever its extension. Template detection is by CONTENT, never by extension
// — a consultant's inspection checklist is Excel on most UAE jobs, and those
// are the documents issued most often.
const TOKEN_RE = /\{\{\s*[\w .#/-]{1,60}\s*\}\}|<<\s*[\w .#/-]{1,60}\s*>>/g;

export function tokensIn(text) {
  const out = [];
  const hay = String(text || '');
  let m;
  TOKEN_RE.lastIndex = 0;
  while ((m = TOKEN_RE.exec(hay))) {
    const t = m[0].replace(/^[{<]+|[}>]+$/g, '').trim();
    if (t && !out.includes(t)) out.push(t);
    if (out.length >= 80) break;
  }
  return out;
}

// The twelve document types the template store already knows, matched from the
// filename or folder. A template whose type cannot be read is still filed — the
// person picks the type from the existing list.
// THE NAMES HERE ARE THE TEMPLATE STORE'S NAMES, and nothing else.
//
// This list used to answer with its own vocabulary — 'inspection', 'method',
// 'payment' — while the template store (DOC_TYPES in templates-store.js) only
// accepts 'wir', 'ms', 'ipc'. So a template recognised perfectly from its name
// was then refused on filing with "unknown document type": the reader and the
// store had never been checked against each other. test-intake.mjs now checks
// that every answer here is a key the store accepts.
//
// Forms the store has no slot for — minutes, a diary, an authority NOC — give
// no type, so they are asked about rather than filed under the wrong one.
// Order matters: the specific before the general ("material inspection" is an
// MIR, not a WIR; "material submittal" is not a plain submittal).
const TEMPLATE_TYPE = [
  [/\brfi\b|request\s*for\s*information/, 'rfi'],
  [/\bmir\b|material\s*inspection/, 'mir'],
  [/material\s*(approval|submittal)|\bmar\b|\bmas\b/, 'material'],
  [/method\s*statement|\bms\b/, 'ms'],
  // A verbal instruction written down. Before the transmittals and the
  // inspections because the consultant's file name for it ("CONFIRMATION OF
  // VERBAL INSTRUCTION") carries no word either of them would claim, but the
  // misspelling "CONFORMATION" that these forms actually ship with must match.
  [/\bcvi\b|conf[io]rmation\s*of\s*verbal|verbal\s*instruction/, 'cvi'],
  // The drawing transmittal before the document one: both say "transmittal",
  // and only one of them says drawings.
  [/transmittal.*(drawing|dwg|shop\s*dwg)|(drawing|dwg)\s*transmittal/, 'transmittal_dwg'],
  [/transmittal/, 'transmittal'],
  [/\bwir\b|\brfia\b|work\s*inspection|inspection/, 'wir'],
  [/\bncr\b|non[-\s]*conformance/, 'ncr'],
  [/variation|\bvo\b/, 'variation'],
  [/payment|\bipc\b|\bipa\b/, 'ipc'],
  [/permit|\bptw\b/, 'ptw'],
  [/\bsubmittal\b/, 'submittal'],
  [/\bletter\b/, 'letter'],
];

export function templateTypeOf(filename, path) {
  const hay = lower(filename) + ' ' + lower(path);
  for (const [re, t] of TEMPLATE_TYPE) if (re.test(hay)) return t;
  return null;
}

// ---------------------------------------------------------------- spreadsheets
//
// A spreadsheet is not only a BOQ. A contractor's folder holds snag lists,
// manpower histograms, cashflows, risk registers, document registers, testing
// schedules and blank inspection forms — all .xlsx. The first worksheet's
// header row decides, in this order.
export function classifySpreadsheet({ header = [], rowCount = 0, tokens = [], filename = '', path = '' }) {
  const cells = header.map((h) => lower(h).replace(/\s+/g, ' ').trim());
  const has = (...names) => names.some((n) => cells.some((c) => c.includes(n)));

  // Tokens and no data: a blank form. Tested before BOQ, because a blank
  // inspection checklist can carry Qty and Rate column headings and would
  // otherwise be imported as a priced bill with no lines.
  if (tokens.length && rowCount === 0) {
    return verdict('template', 'placeholder tokens and no data rows',
      { template_type: templateTypeOf(filename, path), tokens });
  }

  if (has('budget qty', 'budget quantity') || (has('budget') && has('material'))) {
    return verdict('commercial', 'header names Budget Qty', { commercial_kind: 'bom' });
  }
  if ((has('rate') && has('amount')) || (has('section') && has('qty') && has('rate'))) {
    return verdict('commercial', 'header names Rate and Amount', { commercial_kind: 'boq' });
  }
  if (has('ref') && has('description') && has('status') && rowCount > 5) {
    return verdict('site', 'snag or defect list header', { library_class: 'report' });
  }
  if (cells.some((c) => /(certificate|test\s*result|cube|compaction|mill\s*cert)/.test(c))) {
    return verdict('quality', 'certificate or test wording in the header');
  }
  if (tokens.length) {
    return verdict('template', 'placeholder tokens present',
      { template_type: templateTypeOf(filename, path), tokens });
  }
  return verdict('unknown', 'no recognised header row');
}

// ---------------------------------------------------------------- word
const CONTRACT_PHRASES =
  /(retention|sub-?clause|time\s+for\s+completion|conditions\s+of\s+contract|liquidated\s+damages|defects\s+liability|advance\s+payment)/i;
const SPEC_SECTION = /\b\d{2}\s?\d{2}\s?\d{2}\b|\bsection\s+\d{2}\s?\d{2}/i;
const LETTERHEAD = /(our\s+ref|your\s+ref|\bsubject\s*:|\bre\s*:|dear\s+(sir|madam|mr|ms))/i;
const METHOD_WORDS = /(method\s+statement|inspection\s+and\s+test\s+plan|\bitp\b|risk\s+assessment)/i;
const MINUTES_WORDS = /(minutes\s+of\s+meeting|attendees|present\s*:|apologies)/i;

export function classifyWord({ text = '', tokens = [], filename = '', path = '' }) {
  if (tokens.length) {
    return verdict('template', 'placeholder tokens present',
      { template_type: templateTypeOf(filename, path), tokens });
  }
  if (CONTRACT_PHRASES.test(text)) return verdict('contract', 'contract phrases in the text');
  if (LETTERHEAD.test(text)) return verdict('correspondence', 'letterhead block and reference');
  if (SPEC_SECTION.test(text)) return verdict('specification', 'specification section numbering');
  if (METHOD_WORDS.test(text)) return verdict('technical', 'method statement or ITP wording');
  if (MINUTES_WORDS.test(text)) return verdict('minutes', 'meeting heading and attendee list');
  return verdict('unknown', 'no recognised content markers');
}

// ---------------------------------------------------------------- pdf
//
// PDF is the hard case and the common one: a drawing, a specification, a
// contract, an RFI, a bond and an O&M manual are all PDFs. Extension tells you
// nothing, so PDF gets its own cascade and the first test that matches wins.
const RECORD_REF = [
  [/\bRFI[-\s]?(\d{1,5})\b/i, 'rfi'],
  [/\bSUB[-\s]?(\d{1,5})\b/i, 'submittal'],
  [/\bNCR[-\s]?(\d{1,5})\b/i, 'ncr'],
  [/\bMAR[-\s]?(\d{1,5})\b/i, 'material'],
  [/\b(WIR|MIR)[-\s]?(\d{1,5})\b/i, 'inspection'],
  [/\bIPC[-\s]?(\d{1,5})\b/i, 'payment'],
];

const CERT_WORDS = /(test\s+certificate|calibration|mill\s+certificate|compaction|cube\s+test|certificate\s+of\s+(fitness|calibration))/i;
const AUTHORITY_WORDS = /\b(dewa|dcd|civil\s+defence|dubai\s+municipality|\brta\b|etisalat|\bdu\b|trakhees|\bnoc\b)\b/i;

// A drawing is one to three pages at A1 or A0. A specification is hundreds of
// A4 pages. A certificate is one or two A4 pages. Page geometry separates the
// three biggest families before a single character of text is read — which is
// what makes the engine usable on scanned sheets that carry no text at all.
const A3_LONG_EDGE_PT = 1190;          // 420mm — anything longer is a drawing sheet

export function looksLikeSheet(page) {
  if (!page || !page.width || !page.height) return false;
  return Math.max(page.width, page.height) >= A3_LONG_EDGE_PT;
}

export function classifyPdf({ filename = '', path = '', pages = 0, page = null, text = '', drawingNumber = null }) {
  // The number, whenever one was read, travels with EVERY drawing verdict —
  // not only the one that was reached by reading it.
  //
  // This is not tidiness. The number is the gate's single strong signal: it is
  // the only test that reliably catches another project's drawings, because
  // another project's drawings genuinely are numbered differently. Drop it
  // because a folder happened to decide first and the gate has nothing to
  // check, so it returns UNKNOWN and files the sheet. The result is a gate that
  // silently does nothing on precisely the projects with a tidy folder tree —
  // which is most of the ones where someone bothered to set it up.
  const asDrawing = (reason, extra) =>
    verdict('drawing', reason, { ...(drawingNumber ? { number: drawingNumber } : {}), ...(extra || {}) });

  // Folder name first — but only when it is decisive (see folderHint).
  const hint = folderHint(path);
  if (hint && hint.family !== 'template') {
    if (hint.family === 'drawing') return asDrawing('the folder "' + hint.segment + '" says so', { by_folder: true });
    return verdict(hint.family, 'the folder "' + hint.segment + '" says so', { by_folder: true });
  }

  if (drawingNumber) return asDrawing('a drawing number in the filename');

  if (looksLikeSheet(page) && pages > 0 && pages <= 3) {
    return asDrawing('one to three sheet-sized pages');
  }

  // Scanned PDFs carry no text. Where geometry said drawing we already
  // returned; otherwise there is genuinely nothing to read, and saying so is
  // more useful than guessing from the filename.
  const body = String(text || '');
  if (!body.trim()) {
    return verdict('unknown', pages > 0
      ? 'no text in the file — it is probably a scan'
      : 'nothing could be read from the file');
  }

  for (const [re, rt] of RECORD_REF) {
    const m = body.match(re);
    if (m) {
      const fam = rt === 'ncr' || rt === 'inspection' ? 'quality'
        : rt === 'payment' ? 'payment' : 'technical';
      return verdict(fam, 'a ' + rt.toUpperCase() + ' reference in the text',
        { record_type: rt, reference: m[0].toUpperCase().replace(/\s+/g, '-') });
    }
  }
  if (CONTRACT_PHRASES.test(body) && pages >= 5) return verdict('contract', 'contract phrases in the text');
  if (SPEC_SECTION.test(body) && pages >= 10) return verdict('specification', 'specification section numbering');
  if (CERT_WORDS.test(body)) return verdict('quality', 'certificate wording', { record_type: 'cert' });
  if (AUTHORITY_WORDS.test(body) && /\bnoc\b|approval|permit/i.test(body)) {
    return verdict('authority', 'an authority named with approval wording');
  }
  if (LETTERHEAD.test(body)) return verdict('correspondence', 'letterhead block and a date');
  if (MINUTES_WORDS.test(body)) return verdict('minutes', 'meeting heading and attendee list');
  return verdict('unknown', 'no recognised content markers');
}

// ---------------------------------------------------------------- images
const LOGO_WORDS = /\b(logo|logos|brand|letterhead)\b/i;
const PARTY_OF = [[/client|employer|owner/i, 'client'], [/consultant|engineer|architect/i, 'consultant'],
                  [/contractor|builder/i, 'contractor']];

export function classifyImage({ filename = '', path = '' }) {
  const hay = filename + ' ' + path;
  if (LOGO_WORDS.test(hay)) {
    // Never guessed. The wrong logo on an issued document is worse than none,
    // so an unnamed logo is listed as an unassigned image for a person to place.
    let party = null;
    for (const [re, p] of PARTY_OF) if (re.test(hay)) { party = p; break; }
    return verdict('logo', 'the filename says logo', { party });
  }
  const hint = folderHint(path);
  if (hint && hint.family === 'site') return verdict('site', 'a photographs folder', { library_class: 'photo' });
  return verdict('unknown', 'an image that names neither a logo nor a photo folder');
}

// ---------------------------------------------------------------- the top level
//
// Extension picks the cascade; the cascade picks the family. `probe` carries
// whatever the caller could cheaply read — header row, text sample, page
// geometry, tokens — and every field of it is optional. A caller that can read
// nothing still gets a classification, it is just more often 'unknown'.
export function classifyFile(file, probe = {}) {
  const filename = String((file && file.filename) || '');
  const path = String((file && file.path) || '');
  const ext = extensionOf(filename);

  const draft = draftWord(filename, path);
  const place = (v) => ({
    ...v,
    filename, path, ext,
    phase: PHASE_OF[v.family] || 0,
    family_label: FAMILIES[v.family] || v.family,
    ...(draft && v.family !== 'unsupported' ? { draft_like: draft } : {}),
  });

  const sup = supportedExt(filename);
  if (!sup.ok) return place(verdict('unsupported', sup.reason));
  if (ext === 'zip') return place(verdict('archive', 'a .zip file — opened, and every file in it read on its own'));
  if (ext === 'xer') return place(verdict('programme', 'a .xer file'));

  const mapped = folderMapHit(path, probe.folderMap);
  if (mapped && FAMILIES[mapped.family] && mapped.family !== 'unknown') {
    return place(verdict(mapped.family, 'your company files the folder "' + mapped.pattern + '" as ' +
      (FAMILIES[mapped.family] || mapped.family).toLowerCase(),
      { by_folder_map: true, ...(mapped.record_type ? { record_type: mapped.record_type } : {}) }));
  }
  if (ext === 'mpp') {
    return place(verdict('unknown',
      'MS Project files cannot be read — export the programme from P6 as .xer'));
  }
  if (ext === 'dwg' || ext === 'dxf') {
    return place(verdict('cad', 'a CAD file', { cad_format: ext }));
  }
  if (['xlsx', 'xlsm', 'xls', 'csv'].includes(ext)) {
    const v = classifySpreadsheet({ ...probe, filename, path });
    // .xls is the pre-2007 binary format, still common from older consultants.
    // Where it cannot be read it is FILED TO THE LIBRARY UNREAD rather than
    // dropped — findable, with the reason it was not read written on it.
    if (v.family === 'unknown' && (ext === 'xls' || probe.unreadable)) {
      return place(verdict('handover', 'could not be read',
        { library_class: 'other', unread_reason: 'legacy .xls format — not read' }));
    }
    return place(v);
  }
  if (['docx', 'doc', 'rtf'].includes(ext)) {
    if (ext !== 'docx') {
      // Never guessed from the filename alone. Filed, marked unread, listed.
      return place(verdict('handover', 'a legacy Word format the platform cannot read',
        { library_class: 'other', unread_reason: 'legacy ' + ext + ' format — not read' }));
    }
    return place(classifyWord({ ...probe, filename, path }));
  }
  if (['jpg', 'jpeg', 'heic', 'png'].includes(ext)) {
    return place(classifyImage({ filename, path }));
  }
  if (ext === 'msg' || ext === 'eml') {
    return place(verdict('correspondence', 'an email file'));
  }
  if (ext === 'pdf') return place(classifyPdf({ ...probe, filename, path }));

  return place(verdict('unknown', ext ? 'a .' + ext + ' file the engine does not recognise'
                                      : 'a file with no extension'));
}

// The five groups of the review screen. This is the whole design in one
// function: what a person must decide, separated from what they need only to
// notice.
export const GROUPS = ['ready', 'unverified', 'decide', 'held', 'unidentified', 'left_out', 'archived'];

export function groupOf(item) {
  if (!item) return 'unidentified';
  if (item.archived || item.state === 'archived') return 'archived';
  // Left out: unsupported types (never stored), and drafts or superseded copies
  // nobody has chosen to include (spec §17, §19).
  if (item.family === 'unsupported' || (item.draft && item.state === 'skipped') || (item.not_stored && item.state === 'skipped')) return 'left_out';
  if (item.verdict === 'conflict') return 'held';
  if (item.family === 'unknown') return 'unidentified';
  if (item.needs_decision) return 'decide';
  if (item.verdict === 'unknown') return 'unverified';
  return 'ready';
}

// The summary line the review screen leads with. On a later drop the
// interesting numbers are not "380 ready" but "12 revisions, 3 new, 38 already
// filed" — a DC who cannot see at a glance that a drop is mostly revisions will
// either re-file everything or stop checking.
export function summarise(items) {
  const out = { total: 0, ready: 0, unverified: 0, decide: 0, held: 0, unidentified: 0, left_out: 0, archived: 0,
                already_filed: 0, revisions: 0, fresh: 0 };
  for (const it of items || []) {
    out.total++;
    out[groupOf(it)]++;
    if (it.already_filed) out.already_filed++;
    else if (it.is_revision) out.revisions++;
    else out.fresh++;
  }
  return out;
}
