// THE TITLE BLOCK — reading a drawing's own face, not its file name.
//
// Until now a drawing's number, revision and title were read from the FILE NAME
// and nowhere else. That is why a set can arrive with 160 numbers and 160 blank
// titles: the numbers were in the names, the titles were not. A register with no
// titles is half a register — nobody searches for "A0-07", they search for
// "ground floor setting out".
//
// The title block is the one place every discipline agrees to write those
// fields, so it is the right source. This file reads it from the two formats
// that actually carry text:
//
//   DXF   group-code pairs. Title blocks are usually a block INSERT carrying
//         ATTRIB entities — tag and value, structured, no guessing at all.
//         This is the most accurate path on the platform and the cheapest.
//
//   PDF   text lives in content streams, normally Flate-compressed. Inflate
//         them, walk the text operators, and every string arrives with the
//         coordinates it is drawn at. Coordinates are what make a title block
//         findable: it sits in the bottom-right corner of the sheet.
//
// WHAT THIS DELIBERATELY DOES NOT DO:
//
//   DWG   a closed binary format. There is no honest way to read it here, and
//         a guess dressed as an extraction is worse than an admission. A .dwg
//         yields nothing but its file name until somebody exports a DXF.
//
//   OCR   a scanned sheet carries no text. Inflating its content stream returns
//         an image, and no amount of parsing turns pixels into a title. Those
//         sheets come back with nothing found, which is honest, and the review
//         screen already handles an item a person has to look at.
//
// THE ORDER THAT MATTERS: title block first, file name second. The face of the
// drawing is what the consultant issued and what the site will quote back. A
// file name is whoever-last-saved-it's opinion, and is routinely wrong — the
// same sheet arrives as "A0-07.pdf", "A0-07 rev C.pdf" and "Copy of A0-07.pdf"
// in one folder. Where both are readable and they disagree, the face wins and
// the disagreement is reported, because a mismatch is usually a filing error
// somebody wants to know about.

import { inflateSync, strFromU8 } from 'fflate';

const safe = (fn, fallback) => { try { return fn(); } catch (e) { return fallback; } };

// PDF's FlateDecode is zlib — a two-byte header, the deflate data, an Adler-32.
// The bundled fflate exposes raw inflate only, so the header is stripped here
// rather than by reaching for a second compression library.
//
// A zlib header is identified the way the format says: the low nibble of the
// first byte is 8 for deflate, and the two bytes together are a multiple of 31.
// Some writers emit raw deflate with no header at all, so if the header is not
// there — or inflating past it fails — the bytes are tried as raw deflate
// before giving up.
export function inflatePdfStream(u8) {
  if (!u8 || u8.length < 3) return null;
  const looksZlib = (u8[0] & 0x0f) === 8 && ((u8[0] << 8) | u8[1]) % 31 === 0;
  if (looksZlib) {
    const out = safe(() => inflateSync(u8.subarray(2)), null);
    if (out) return out;
  }
  return safe(() => inflateSync(u8), null);
}

// A sheet has a few hundred strings on it; a specification has hundreds of
// thousands. Nothing here is allowed to walk a whole book looking for a title
// block that is not there.
const MAX_ITEMS = 4000;
const MAX_STREAM = 4 * 1024 * 1024;
const MAX_STREAMS = 12;

/* ------------------------------------------------------------------ fields */

// What a title block calls each field, in the order a match should be tried.
// Longer, more specific labels first so "DRAWING NUMBER" is not eaten by "NO".
//
// These are matched against ATTRIB tags (DWG_NO, DRAWING_TITLE) and against
// label text on the sheet ("DRAWING No.", "Title:"), so both the punctuation
// and the separators are stripped before comparing.
const FIELD_LABELS = {
  number: [
    'drawingnumber', 'drawingno', 'drawingnum', 'dwgnumber', 'dwgno', 'dwgnum',
    'drgnumber', 'drgno', 'sheetnumber', 'sheetno', 'documentnumber', 'docno',
    'drawingref', 'refno', 'number', 'dwg', 'drgno',
  ],
  title: [
    'drawingtitle', 'sheettitle', 'drawingname', 'titleofdrawing', 'title',
  ],
  revision: ['revisionno', 'revision', 'revno', 'rev', 'issue', 'amendment'],
  scale: ['scales', 'scale'],
  date: ['dateissued', 'issuedate', 'drawndate', 'date'],
  discipline: ['discipline', 'department', 'section'],
  // What the sheet was issued FOR. A title block almost always says, and it is
  // the only honest source for the stage — the same number is re-issued at
  // tender, at IFC and as-built, so the number can never tell them apart.
  status: [
    'purposeofissue', 'issuepurpose', 'issuedfor', 'drawingstatus',
    'suitabilitycode', 'suitability', 'statuscode', 'status', 'purpose',
  ],
  drawnBy: ['drawnby', 'drawn', 'preparedby'],
  checkedBy: ['checkedby', 'checked'],
  approvedBy: ['approvedby', 'approved'],
};

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');

// Which field, if any, a tag or label names. Exact match first, then prefix —
// "DRAWING NO." normalises to "drawingno", "DRAWING No:" to the same, and
// "DRAWINGNOREF" should still find it.
export function fieldForLabel(label) {
  const n = norm(label);
  if (!n || n.length > 40) return null;
  for (const [field, labels] of Object.entries(FIELD_LABELS)) {
    if (labels.includes(n)) return field;
  }
  // A near-match: the same label with punctuation or a short suffix on it
  // ("DRAWING No. REF"). The extra is capped, because without a cap a VALUE
  // reads as a label — "ISSUED FOR CONSTRUCTION" starts with "issued for", so
  // the status box's own answer was being discarded as if it were another
  // question.
  const SLACK = 6;
  for (const [field, labels] of Object.entries(FIELD_LABELS)) {
    for (const l of labels) {
      if (l.length < 5) continue;
      if (n === l) return field;
      if (n.length <= l.length + SLACK && (n.startsWith(l) || n.endsWith(l))) return field;
    }
  }
  return null;
}

// A value that is really a label, an empty box, or a placeholder nobody filled.
const JUNK = /^(n\/?a|none|nil|tbc|tba|xx+|--+|\.\.+|\?+|0+)$/i;

function cleanValue(v) {
  const s = String(v == null ? '' : v)
    .replace(/\s+/g, ' ')
    .replace(/^[\s:\-–—=]+/, '')
    .replace(/[\s:\-–—=]+$/, '')
    .trim();
  if (!s || s.length > 200) return '';
  if (JUNK.test(s)) return '';
  return s;
}

/* ------------------------------------------------------------- the stage */

// WHICH SECTION A SHEET BELONGS IN IS WRITTEN ON THE SHEET.
//
// Tender, IFC, shop and as-built are the same drawing number four times over.
// Nothing in the number distinguishes them, and a file name only does when the
// office bothered to type it — which, on the folders that actually arrive, is
// most of the time not at all. So this reads the words: the "PURPOSE OF ISSUE"
// or "STATUS" box of the title block first, and failing that any stamp
// anywhere on the face.
//
// Order matters. "AS BUILT" is tested before IFC because an as-built sheet is
// normally still stamped "ISSUED FOR CONSTRUCTION" underneath, and the later
// stage is the true one.
export const STAGE_PHRASES = [
  [/\bas[ _-]*built\b|\bas[ _-]*constructed\b|\brecord\s+drawing/i, 'asbuilt'],
  [/\bifc\b|\bgfc\b|issued?\s*for\s*construction|good\s*for\s*construction|construction\s*issue/i, 'ifc'],
  [/\bift\b|issued?\s*for\s*tender|for\s*tender\b|tender\s*(issue|drawing|set|stage)|for\s*bid(ding)?\b/i, 'tender'],
  [/\bifa\b|shop\s*drawing|issued?\s*for\s*approval|for\s*approval\b|\bfabrication\s*drawing/i, 'shop'],
  [/\bspecification\b/i, 'spec'],
  [/\bsketch\b|\bsk[ _-]?\d/i, 'sketch'],
];

// The stage named by a piece of text, or '' when it names none. Never guesses:
// silence here means the caller falls back to the folder, then the file name,
// and finally leaves the sheet unfiled for a person — which is the correct
// outcome, and the opposite of dropping every sheet into Shop.
export function stageFromText(text) {
  const s = String(text || '');
  if (!s) return '';
  for (const [re, stage] of STAGE_PHRASES) if (re.test(s)) return stage;
  return '';
}

// The stage of a whole sheet: its status box if it has one, else anything
// stamped on the face. Returns { stage, stage_source } so the review screen can
// say WHY a sheet landed where it did.
export function stageOf(face) {
  const f = face || {};
  const fromStatus = stageFromText(f.status);
  if (fromStatus) return { stage: fromStatus, stage_source: 'title block status' };
  const fromFace = stageFromText(f.face_text);
  if (fromFace) return { stage: fromFace, stage_source: 'stamp on the sheet' };
  return { stage: '', stage_source: '' };
}

/* --------------------------------------------------------------------- DXF */

// DXF is a flat list of (group code, value) pairs, two lines each. Everything
// is found by walking that list once and watching for entity starts (code 0).
//
// An ATTRIB carries its tag on code 2 and its value on code 1, which is exactly
// the pair a title block field is. That is the whole trick: where a consultant
// drew their title block as a proper block with attributes — which is normal
// CAD practice — the fields read out perfectly with no geometry involved.
export function parseDxf(text) {
  const out = { attribs: [], texts: [], entities: 0 };
  const src = String(text || '');
  if (!src || src.length < 16) return out;

  // Split on any line ending; DXF from Windows CAD is CRLF, from scripts LF.
  const lines = src.split(/\r\n|\r|\n/);
  let entity = null, tag = '', value = '', x = null, y = null, hadValue = false;

  const flush = () => {
    if (!entity) return;
    if (entity === 'ATTRIB' || entity === 'ATTDEF') {
      if (tag && hadValue) out.attribs.push({ tag, value, x, y });
    } else if (entity === 'TEXT' || entity === 'MTEXT') {
      if (hadValue && value) out.texts.push({ text: value, x, y });
    }
    entity = null; tag = ''; value = ''; x = null; y = null; hadValue = false;
  };

  for (let i = 0; i + 1 < lines.length; i += 2) {
    const code = lines[i].trim();
    const val = lines[i + 1];
    if (code === '0') {
      flush();
      const t = String(val || '').trim().toUpperCase();
      if (t === 'ATTRIB' || t === 'ATTDEF' || t === 'TEXT' || t === 'MTEXT') {
        entity = t;
        out.entities++;
      }
      continue;
    }
    if (!entity) continue;
    if (code === '1') { value = mtext(val); hadValue = true; }
    else if (code === '2') { tag = String(val || '').trim(); }
    else if (code === '3') { value = mtext(val) + value; hadValue = true; } // MTEXT overflow comes first
    else if (code === '10') { const n = Number(val); if (Number.isFinite(n)) x = n; }
    else if (code === '20') { const n = Number(val); if (Number.isFinite(n)) y = n; }
    if (out.attribs.length + out.texts.length > MAX_ITEMS) break;
  }
  flush();
  return out;
}

// MTEXT carries formatting inline: \P is a line break, {\fArial|b0;...} wraps a
// run, \~ is a hard space. Strip it to the words a person would read.
function mtext(v) {
  return String(v == null ? '' : v)
    .replace(/\\P/gi, ' ')
    .replace(/\\~/g, ' ')
    .replace(/\\[A-Za-z][^;\\]*;/g, '')
    .replace(/[{}]/g, '')
    .replace(/\\\\/g, '\\')
    .replace(/\s+/g, ' ')
    .trim();
}

export function titleBlockFromDxf(text) {
  const parsed = parseDxf(text);
  const found = {};
  const evidence = [];

  // 1. Attributes, the reliable path.
  for (const a of parsed.attribs) {
    const field = fieldForLabel(a.tag);
    if (!field || found[field]) continue;
    const v = cleanValue(a.value);
    if (!v) continue;
    found[field] = v;
    evidence.push({ field, via: 'attrib', tag: a.tag });
  }

  // 2. Loose text, where the title block was drawn rather than blocked. Labels
  //    and values are separate TEXT entities, so pair them by position.
  if (Object.keys(found).length < 2 && parsed.texts.length) {
    const byLabel = pairByPosition(parsed.texts);
    for (const [field, v] of Object.entries(byLabel)) {
      if (found[field]) continue;
      found[field] = v;
      evidence.push({ field, via: 'text' });
    }
  }

  const out = { ...found, source: 'dxf', evidence, items: parsed.attribs.length + parsed.texts.length };
  out.face_text = faceText(
    parsed.attribs.map((a) => a.value).concat(parsed.texts.map((t) => t.text))
  );
  Object.assign(out, stageOf(out));
  return out;
}

// Everything written on the face, as one bounded string, for the stage stamp to
// be found in. Bounded because a specification sheet can carry a hundred
// thousand words and none of them is a title block.
const MAX_FACE_TEXT = 20000;
function faceText(list) {
  let s = '';
  for (const v of list || []) {
    const t = String(v == null ? '' : v).trim();
    if (!t) continue;
    s += t + ' \n';
    if (s.length > MAX_FACE_TEXT) break;
  }
  return s.slice(0, MAX_FACE_TEXT);
}

/* --------------------------------------------------------------------- PDF */

// Pull every Flate-compressed content stream out of a PDF and inflate it.
//
// This does not parse PDF properly and does not need to: a content stream is
// delimited by the literal words `stream` and `endstream`, and what sits between
// them is bytes. The object header before it says whether it is Flate. Anything
// that fails to inflate is skipped — an image, an embedded font, a stream using
// a filter we do not handle — because one unreadable stream must not cost us the
// other eleven.
export function pdfStreams(bytes) {
  const out = [];
  if (!bytes || !bytes.length) return out;
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);

  // latin1 view for searching; byte offsets stay valid because latin1 is 1:1.
  let head = '';
  try {
    const CHUNK = 0x8000;
    for (let i = 0; i < u8.length; i += CHUNK) {
      head += String.fromCharCode.apply(null, u8.subarray(i, Math.min(i + CHUNK, u8.length)));
    }
  } catch (e) { return out; }

  let at = 0;
  while (out.length < MAX_STREAMS) {
    const s = head.indexOf('stream', at);
    if (s < 0) break;
    const e = head.indexOf('endstream', s);
    if (e < 0) break;
    at = e + 9;

    // Only Flate streams; the object dictionary sits just before `stream`.
    const dict = head.slice(Math.max(0, s - 400), s);
    if (!/FlateDecode/.test(dict)) continue;

    // Skip the EOL after the `stream` keyword: CRLF or LF, never CR alone.
    let from = s + 6;
    if (head[from] === '\r') from++;
    if (head[from] === '\n') from++;
    let to = e;
    if (head[to - 1] === '\n') to--;
    if (head[to - 1] === '\r') to--;
    if (to <= from || to - from > MAX_STREAM) continue;

    const raw = inflatePdfStream(u8.subarray(from, to));
    const inflated = raw ? safe(() => strFromU8(raw), null) : null;
    if (inflated) out.push(inflated);
  }
  return out;
}

// Walk a content stream's text operators and return every string with the
// position it is drawn at.
//
// Only the translation part of the text matrix is tracked (e f of `Tm`, and the
// offsets of `Td`/`TD`/`T*`). Rotation and scale are ignored: a title block is
// drawn upright, and carrying the full matrix would cost a great deal to place
// the handful of rotated strings a sheet has, all of which are usually the
// border notes we do not want anyway.
export function textItemsFromContent(content) {
  const items = [];
  const src = String(content || '');
  if (!src) return items;

  let x = 0, y = 0, lineX = 0, lineY = 0, leading = 0, inText = false;

  // Operators arrive as `args op`. Tokenise on whitespace but keep ( ) strings
  // and < > hex strings whole, honouring backslash escapes inside strings.
  const re = /\((?:\\.|[^\\()])*\)|<[0-9A-Fa-f\s]*>|\[|\]|[-+]?[\d.]+|\/[^\s/<>\[\]()]+|[A-Za-z'"*]+/g;
  let m, args = [];
  while ((m = re.exec(src)) !== null) {
    const t = m[0];
    if (items.length > MAX_ITEMS) break;

    if (t === 'BT') { inText = true; x = y = lineX = lineY = 0; args = []; continue; }
    if (t === 'ET') { inText = false; args = []; continue; }

    if (t === 'Tm' && args.length >= 6) {
      lineX = x = Number(args[args.length - 2]) || 0;
      lineY = y = Number(args[args.length - 1]) || 0;
      args = []; continue;
    }
    if ((t === 'Td' || t === 'TD') && args.length >= 2) {
      const dx = Number(args[args.length - 2]) || 0;
      const dy = Number(args[args.length - 1]) || 0;
      if (t === 'TD') leading = -dy;
      lineX = x = lineX + dx;
      lineY = y = lineY + dy;
      args = []; continue;
    }
    if (t === 'TL' && args.length >= 1) { leading = Number(args[args.length - 1]) || 0; args = []; continue; }
    if (t === 'T*') { lineY = y = lineY - leading; x = lineX; args = []; continue; }

    if (t === 'Tj' || t === "'" || t === '"') {
      if (t !== 'Tj') { lineY = y = lineY - leading; x = lineX; }
      const s = pdfString(args[args.length - 1]);
      if (s && inText) items.push({ text: s, x, y });
      args = []; continue;
    }
    if (t === 'TJ') {
      // The array form: strings interleaved with kerning numbers. Join the
      // strings; a large negative kern is a space the font did not draw.
      let s = '';
      for (const a of args) {
        if (typeof a === 'string' && (a.startsWith('(') || a.startsWith('<'))) s += pdfString(a);
        else if (Number(a) < -180) s += ' ';
      }
      s = s.replace(/\s+/g, ' ').trim();
      if (s && inText) items.push({ text: s, x, y });
      args = []; continue;
    }

    // Any other operator ends the argument run; letters that are not an
    // operator we handle still clear it, which is what we want.
    if (/^[A-Za-z]/.test(t) && t !== 'Tf') { args = []; continue; }
    args.push(t);
    if (args.length > 64) args = args.slice(-16);
  }
  return items;
}

// ( ... ) literal or < ... > hex, to the characters a person reads.
function pdfString(tok) {
  const t = String(tok || '');
  if (t.startsWith('(')) {
    const body = t.slice(1, -1);
    let s = '';
    for (let i = 0; i < body.length; i++) {
      const c = body[i];
      if (c !== '\\') { s += c; continue; }
      const n = body[++i];
      if (n === 'n') s += '\n';
      else if (n === 'r') s += '\r';
      else if (n === 't') s += '\t';
      else if (n === 'b' || n === 'f') s += ' ';
      else if (n >= '0' && n <= '7') {
        let oct = n;
        while (oct.length < 3 && body[i + 1] >= '0' && body[i + 1] <= '7') oct += body[++i];
        s += String.fromCharCode(parseInt(oct, 8));
      } else s += n;
    }
    return s.replace(/[\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim();
  }
  if (t.startsWith('<')) {
    const hex = t.slice(1, -1).replace(/\s+/g, '');
    let s = '';
    // UTF-16BE is common for text drawn from a Unicode font; a 4-hex-digit
    // group whose high byte is 0 is really latin1, which is the usual case.
    for (let i = 0; i + 3 < hex.length; i += 4) {
      const code = parseInt(hex.slice(i, i + 4), 16);
      if (Number.isFinite(code) && code > 8) s += String.fromCharCode(code);
    }
    if (!s) {
      for (let i = 0; i + 1 < hex.length; i += 2) {
        const code = parseInt(hex.slice(i, i + 2), 16);
        if (Number.isFinite(code) && code > 8) s += String.fromCharCode(code);
      }
    }
    return s.replace(/\s+/g, ' ').trim();
  }
  return '';
}

export function titleBlockFromPdf(bytes) {
  const streams = pdfStreams(bytes);
  let items = [];
  for (const s of streams) {
    items = items.concat(textItemsFromContent(s));
    if (items.length > MAX_ITEMS) break;
  }
  if (!items.length) {
    return { source: 'pdf', evidence: [], items: 0, scanned: true };
  }
  const found = pairByPosition(items);
  const out = {
    ...found,
    source: 'pdf',
    evidence: Object.keys(found).map((field) => ({ field, via: 'text' })),
    items: items.length,
  };
  out.face_text = faceText(items.map((i) => i.text));
  Object.assign(out, stageOf(out));
  return out;
}

/* ------------------------------------------------- pairing labels to values */

// Given positioned strings, find the fields.
//
// Two passes, because title blocks are built two ways:
//
//   "DRAWING No.  A0-07"      label and value are separate strings, side by
//                             side — pair them by position
//
//   "DRAWING No.: A0-07"      one string carrying both — split on the colon
//
// Position beats distance-in-the-list: strings arrive in drawing order, which
// is font order, not reading order. Two fields drawn with the same font are
// adjacent in the stream even when they sit at opposite corners of the sheet.
export function pairByPosition(items) {
  const found = {};
  const placed = items.filter((i) => Number.isFinite(i.x) && Number.isFinite(i.y));
  const list = placed.length ? placed : items;

  // Pass 1 — one string carrying "label: value".
  for (const it of list) {
    const t = String(it.text || '');
    const m = t.match(/^([^:]{2,40}?)\s*[::]\s*(.+)$/);
    if (!m) continue;
    const field = fieldForLabel(m[1]);
    if (!field || found[field]) continue;
    const v = cleanValue(m[2]);
    if (v) found[field] = v;
  }

  // Pass 2 — label and value as neighbours. The value is the nearest string to
  // the right on the same line, or failing that the nearest below: those are the
  // only two layouts a title block uses.
  if (placed.length) {
    const labels = [];
    for (const it of placed) {
      const field = fieldForLabel(it.text);
      if (field) labels.push({ field, it });
    }
    // Size of the sheet tells us what "near" means; a title block cell is a
    // small fraction of the sheet, so scale the tolerances to it.
    const xs = placed.map((p) => p.x), ys = placed.map((p) => p.y);
    const w = Math.max(1, Math.max(...xs) - Math.min(...xs));
    const h = Math.max(1, Math.max(...ys) - Math.min(...ys));
    // How far apart a label and its value may sit. Scaled to the sheet, but
    // with a floor that matters: where only the title block carries text, the
    // spread of the items IS the title block, and a tolerance derived from it
    // alone comes out smaller than the gap between a label and its own value.
    // The floors are in PDF points — 150pt is about 50mm, wider than any
    // title-block cell and far narrower than a sheet.
    const sameLine = Math.max(2, h * 0.012);
    const nearX = Math.max(150, w * 0.45);
    const nearY = Math.max(30, h * 0.08);

    for (const { field, it } of labels) {
      if (found[field]) continue;
      let best = null, bestScore = Infinity;
      for (const c of placed) {
        if (c === it) continue;
        const v = cleanValue(c.text);
        if (!v || fieldForLabel(c.text)) continue;      // another label, not a value
        const dx = c.x - it.x, dy = c.y - it.y;
        let score = Infinity;
        if (Math.abs(dy) <= sameLine && dx > 0 && dx <= nearX) score = dx;
        else if (dy < 0 && -dy <= nearY && Math.abs(dx) <= nearX) score = nearX + (-dy);
        if (score < bestScore) { bestScore = score; best = v; }
      }
      if (best) found[field] = best;
    }
  }
  return found;
}

/* ------------------------------------------------------------- the entry */

// Read whatever the file's own face says. Returns {} for a format that carries
// no readable text, which the caller treats as "fall back to the file name".
export function readTitleBlock(filename, bytes) {
  const ext = String(filename || '').toLowerCase().match(/\.([a-z0-9]{1,5})$/);
  const e = ext ? ext[1] : '';
  if (!bytes || !bytes.length) return {};

  if (e === 'dxf') {
    const text = safe(() => (typeof bytes === 'string' ? bytes : strFromU8(bytes)), '');
    return safe(() => titleBlockFromDxf(text), {}) || {};
  }
  if (e === 'pdf') return safe(() => titleBlockFromPdf(bytes), {}) || {};

  // .dwg is binary and closed; say so rather than pretend.
  if (e === 'dwg') return { source: 'dwg', unreadable: 'DWG is a closed binary format — export a DXF to read its title block', evidence: [] };
  return {};
}

// Merge what the face says with what the file name says, and report where they
// disagree. The face wins; the disagreement is kept because it usually means a
// file was named wrongly, which somebody wants to know before it is filed.
export function mergeWithFilename(face, fromName) {
  const out = { number: '', revision: '', title: '', source: 'filename', conflicts: [] };
  const f = face || {}, n = fromName || {};
  for (const k of ['number', 'revision', 'title']) {
    const a = cleanValue(f[k]), b = cleanValue(n[k]);
    if (a && b && norm(a) !== norm(b)) out.conflicts.push({ field: k, title_block: a, filename: b });
    out[k] = a || b || '';
  }
  for (const k of ['scale', 'date', 'discipline', 'status', 'drawnBy', 'checkedBy', 'approvedBy']) {
    const a = cleanValue(f[k]);
    if (a) out[k] = a;
  }
  // The stage the sheet itself declares. Kept separate from the fields above
  // because it survives even when no number or title could be read: a scanned
  // sheet stamped IFC still belongs in IFC.
  if (f.stage) { out.stage = f.stage; out.stage_source = f.stage_source || 'title block'; }
  if (f.number || f.title || f.revision) out.source = f.source || 'titleblock';
  if (f.unreadable) out.unreadable = f.unreadable;
  return out;
}
