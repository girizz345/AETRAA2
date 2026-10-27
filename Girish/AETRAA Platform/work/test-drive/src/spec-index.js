// E13 — THE SPECIFICATION INDEX (approved 5 Oct 2026, deterministic).
//
// A bound specification of 600 pages is useless until every section can be
// found by number and title. This splits it into sections — number, title,
// pages — lists the manufacturers each section names, and keeps the sentences
// that set requirements (shop drawings, product data, samples, method
// statements, testing, inspection) with their page, for the four schedules
// (P2-P5), the material package (A7) and RFIs (A10).
//
// THE SPLITTING RULE (spec §6): split by section where the structure can be
// read — a table of contents, or explicit section headings such as
// "SECTION 03 30 00" — and where it cannot, the whole document stays one
// unindexed entry with the reason. A wrongly split specification sends
// someone to the wrong clause, which is worse than scrolling.
//
// No AI. Pages with no text (scans) are reported as not read. The same file
// gives the same index under the same extractor version.

import { addColumns } from './db-cols.js';

const nowISO = () => new Date().toISOString();
const uid = (p) => p + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const str = (v, n = 300) => String(v == null ? '' : v).slice(0, n);
const safeJson = (s, f) => { try { const v = JSON.parse(s || ''); return v == null ? f : v; } catch (e) { return f; } };
export const SPEC_EXTRACTOR = 'spec-index-2026.10.06';

// MasterFormat divisions and the discipline each belongs to.
const DIVISION = {
  '01': 'General', '02': 'Civil', '03': 'Structural', '04': 'Architectural', '05': 'Structural', '06': 'Architectural',
  '07': 'Architectural', '08': 'Architectural', '09': 'Architectural', '10': 'Architectural', '11': 'Architectural',
  '12': 'Architectural', '13': 'Architectural', '14': 'Mechanical', '21': 'Fire protection', '22': 'Plumbing',
  '23': 'Mechanical', '25': 'Mechanical', '26': 'Electrical', '27': 'Electrical', '28': 'Electrical',
  '31': 'Civil', '32': 'Civil', '33': 'Civil', '34': 'Civil',
};

const MF = '(\\d{2})\\s?(\\d{2})\\s?(\\d{2})';               // 03 30 00 or 033000
const TITLE = '([A-Z][A-Z0-9 ,&/()\\-\\u2013]{3,80}?)';
const code6 = (a, b, c) => a + ' ' + b + ' ' + c;
const cleanTitle = (t) => String(t || '').replace(/\s+/g, ' ').replace(/[\s\-–.,:]+$/, '').trim();

// The table of contents: a page that says so, with code-title(-page) entries.
export function readContents(pages) {
  const entries = [], seen = new Set();
  let tocPages = [];
  pages.forEach((t, i) => {
    if (!/\b(table\s+of\s+contents|contents|index\s+of\s+sections)\b/i.test(String(t).slice(0, 600))) return;
    const re = new RegExp('\\b' + MF + '\\s*[-\\u2013:]?\\s*' + TITLE + '(?=\\s+(?:\\d{1,4}\\b|\\d{2}\\s?\\d{2}\\s?\\d{2}\\b|$))', 'g');
    let m, n = 0;
    while ((m = re.exec(t))) {
      const code = code6(m[1], m[2], m[3]);
      if (seen.has(code)) continue;
      seen.add(code); n++;
      entries.push({ code, title: cleanTitle(m[4]), from: 'contents' });
    }
    if (n) tocPages.push(i + 1);
  });
  return { entries, toc_pages: tocPages };
}

// Explicit headings: "SECTION 03 30 00 - CAST-IN-PLACE CONCRETE" near the top
// of a page, or a letter section ("SECTION D - CONCRETE") for CESMM/POMI bills.
export function readHeadings(pages, skip = []) {
  const out = [];
  pages.forEach((t, i) => {
    if (skip.includes(i + 1)) return;
    const head = String(t).slice(0, 500);
    let m = new RegExp('\\bSECTION\\s+' + MF + '\\s*[-\\u2013:]?\\s*' + TITLE + '(?=\\s|$)').exec(head)
      || new RegExp('^\\s*' + MF + '\\s*[-\\u2013:]\\s*' + TITLE + '(?=\\s|$)').exec(head);
    if (m) { out.push({ code: code6(m[1], m[2], m[3]), title: cleanTitle(m[4]), page: i + 1 }); return; }
    m = /\bSECTION\s+([A-Z]{1,2})\s*[-–:]\s*([A-Z][A-Z0-9 ,&/()\-]{3,60}?)(?=\s{2}|\s+[a-z]|\s+[A-Z][a-z]|$)/.exec(head);
    if (m) out.push({ code: m[1], title: cleanTitle(m[2]), page: i + 1 });
  });
  // A heading repeated on every page of a section (a running header) starts
  // the section once, at its first page.
  return out.filter((h, k) => k === 0 || out[k - 1].code !== h.code);
}

// Manufacturers a section names, after the words that introduce them.
const MAKER_TRIGGER = /(acceptable|approved|available|listed)?\s*(manufacturers?|makes?|suppliers?|brands?)\s*(:|include|are|shall be|subject to compliance[^:]{0,80}:)|provide\s+products\s+by\s+one\s+of\s+the\s+following\s*:?/gi;
export function readManufacturers(text) {
  const t = String(text || '');
  const names = [];
  let m, orEqual = false;
  MAKER_TRIGGER.lastIndex = 0;
  while ((m = MAKER_TRIGGER.exec(t))) {
    const tail = t.slice(m.index + m[0].length, m.index + m[0].length + 400);
    const stop = tail.search(/\b(PART\s+\d|\d\.\d{1,2}\s+[A-Z]|EXECUTION|INSTALLATION|SUBMITTALS|QUALITY\s+ASSURANCE)\b/);
    const seg = stop > 0 ? tail.slice(0, stop) : tail;
    if (/or\s+(approved\s+)?equal|approved\s+equivalent|or\s+equivalent/i.test(seg)) orEqual = true;
    for (const part of seg.split(/\s+[a-z]\.\s+|\s+\d{1,2}[.)]\s+|;|•|,\s*(?=[A-Z])/)) {
      const name = part.replace(/\s*\(.*$/, '').replace(/\s+or\s+(approved\s+)?(equal|equivalent).*$/i, '')
        .replace(/[.;:,\s]+$/, '').trim();
      if (name.length < 2 || name.length > 60) continue;
      if (!/^[A-Z0-9]/.test(name) || /^(or|and|the|any|other|approved|equal|equivalent)\b/i.test(name)) continue;
      if (/\b(shall|must|will|provide|comply|submit)\b/i.test(name)) continue;
      if (!names.includes(name)) names.push(name);
      if (names.length >= 20) break;
    }
  }
  return { names, or_equal: orEqual };
}

// The sentences that set what must be submitted, tested or inspected.
const REQUIREMENTS = {
  shop_drawings: /\bshop\s+drawings?\b/i,
  product_data: /\b(product\s+data|technical\s+data\s+sheets?|manufacturer'?s?\s+literature|data\s+sheets?)\b/i,
  samples: /\bsamples?\b/i,
  mock_up: /\bmock[-\s]?ups?\b/i,
  method_statement: /\bmethod\s+statements?\b/i,
  testing: /\b(test(s|ing)?|cube|compaction|pressure\s+test|commissioning)\b/i,
  inspection: /\b(inspection|hold\s+point|witness(\s+point)?)\b/i,
};
export function readRequirements(pageTexts, fromPage) {
  const out = {};
  for (const k of Object.keys(REQUIREMENTS)) out[k] = [];
  pageTexts.forEach((t, i) => {
    const sentences = String(t).split(/(?<=[.;])\s+(?=[A-Z0-9])/);
    for (const s of sentences) {
      if (s.length < 15 || s.length > 600) continue;
      for (const [k, re] of Object.entries(REQUIREMENTS)) {
        if (re.test(s) && /\b(submit|shall|provide|required|perform|carry out|notify)\b/i.test(s) && out[k].length < 8) {
          out[k].push({ page: fromPage + i, sentence: s.trim() });
        }
      }
    }
  });
  return out;
}

// The whole index from the page texts. `pages` is one string per page.
export function buildIndex(pages) {
  const n = pages.length;
  const unread = pages.map((t, i) => (String(t || '').trim() ? null : i + 1)).filter(Boolean);
  if (!n) return { split: false, reason: 'no pages could be read', sections: [], unread_pages: [], pages: 0 };
  if (unread.length === n) return { split: false, reason: 'no page has text — a scanned specification is filed whole, not indexed', sections: [], unread_pages: unread, pages: n };
  const toc = readContents(pages);
  const heads = readHeadings(pages, toc.toc_pages);
  let starts = [];
  let method = '';
  if (toc.entries.length) {
    // Every contents entry is located at the first page whose heading names it.
    method = 'contents';
    for (const e of toc.entries) {
      const h = heads.find((x) => x.code === e.code);
      starts.push({ code: e.code, title: e.title || (h && h.title) || '', page: h ? h.page : null });
    }
  } else if (heads.length >= 2) {
    method = 'headings';
    starts = heads.map((h) => ({ code: h.code, title: h.title, page: h.page }));
  } else {
    return { split: false, reason: 'neither a table of contents nor section headings could be read — filed whole, not split on a guess',
             sections: [], unread_pages: unread, pages: n };
  }
  const located = starts.filter((s) => s.page).sort((a, b) => a.page - b.page);
  const sections = starts.map((s) => {
    if (!s.page) return { code: s.code, title: s.title, page_from: null, page_to: null, located: false,
                          discipline: DIVISION[s.code.slice(0, 2)] || '', note: 'listed in the contents, but its first page was not found' };
    const k = located.indexOf(s);
    const to = k + 1 < located.length ? located[k + 1].page - 1 : n;
    const texts = pages.slice(s.page - 1, to);
    const makers = readManufacturers(texts.join(' '));
    return { code: s.code, title: s.title, page_from: s.page, page_to: Math.max(s.page, to), located: true,
             discipline: /^\d/.test(s.code) ? (DIVISION[s.code.slice(0, 2)] || '') : '',
             manufacturers: makers.names, or_equal: makers.or_equal,
             requirements: readRequirements(texts, s.page) };
  });
  const sorted = sections.slice().sort((a, b) => (a.code < b.code ? -1 : a.code > b.code ? 1 : 0));
  return { split: true, method, toc_pages: toc.toc_pages, sections: sorted, unread_pages: unread, pages: n,
           not_located: sections.filter((s) => !s.located).length };
}

// ---------------------------------------------------------------- storage
let ready = false;
export async function ensureSpecTables(env) {
  if (ready) return true;
  try {
    await env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS spec_index (
         id TEXT PRIMARY KEY, project_id TEXT NOT NULL, library_id TEXT, filename TEXT, sha256 TEXT,
         extractor TEXT, state TEXT, result TEXT, created_by TEXT, created_at TEXT,
         confirmed_by TEXT, confirmed_at TEXT)`
    ).run();
    await env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS spec_section (
         id TEXT PRIMARY KEY, project_id TEXT NOT NULL, index_id TEXT, code TEXT, title TEXT,
         discipline TEXT, page_from INTEGER, page_to INTEGER, manufacturers TEXT, or_equal INTEGER,
         requirements TEXT, library_id TEXT)`
    ).run();
    await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_spec_section_p ON spec_section(project_id, code)').run();
    await addColumns(env, 'spec_index', [['note', 'TEXT']]);
    ready = true;
    return true;
  } catch (e) { return false; }
}

export async function saveIndex(env, pid, src, result, who) {
  await ensureSpecTables(env);
  const id = uid('spx');
  await env.DB.prepare(
    `INSERT INTO spec_index (id, project_id, library_id, filename, sha256, extractor, state, result, created_by, created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?)`
  ).bind(id, pid, src.library_id || null, str(src.filename, 300), src.sha256 || null, SPEC_EXTRACTOR, 'proposed',
         JSON.stringify(result), str(who, 120), nowISO()).run();
  return id;
}

export async function getIndex(env, pid, id) {
  await ensureSpecTables(env);
  const r = await env.DB.prepare('SELECT * FROM spec_index WHERE id = ? AND project_id = ?').bind(String(id), pid).first();
  return r ? { ...r, result: safeJson(r.result, {}) } : null;
}

export async function listIndexes(env, pid) {
  await ensureSpecTables(env);
  const { results } = await env.DB.prepare(
    'SELECT id, library_id, filename, state, created_by, created_at, confirmed_by, confirmed_at, result FROM spec_index WHERE project_id = ? ORDER BY created_at DESC'
  ).bind(pid).all();
  return (results || []).map((r) => {
    const res = safeJson(r.result, {});
    return { ...r, result: undefined, split: !!res.split, sections: (res.sections || []).length, pages: res.pages || 0,
             unread_pages: (res.unread_pages || []).length, reason: res.reason || null };
  });
}

// Design confirms the index (E13 step 2): its sections go live, replacing any
// earlier live index built from the same document.
export async function confirmIndex(env, pid, id, who, edits) {
  const ix = await getIndex(env, pid, id);
  if (!ix) return { error: 'no such index' };
  const res = ix.result || {};
  // Design may correct a title or a discipline before confirming.
  for (const e of edits || []) {
    const s = (res.sections || []).find((x) => x.code === e.code);
    if (s && typeof e.title === 'string' && e.title.trim()) s.title = str(e.title, 120).trim();
    if (s && typeof e.discipline === 'string') s.discipline = str(e.discipline, 60).trim();
  }
  if (ix.library_id) {
    const old = (await env.DB.prepare("SELECT id FROM spec_index WHERE project_id = ? AND library_id = ? AND state = 'confirmed' AND id <> ?")
      .bind(pid, ix.library_id, ix.id).all()).results || [];
    for (const o of old) {
      await env.DB.prepare('DELETE FROM spec_section WHERE index_id = ?').bind(o.id).run();
      await env.DB.prepare("UPDATE spec_index SET state = 'replaced' WHERE id = ?").bind(o.id).run();
    }
  }
  await env.DB.prepare('DELETE FROM spec_section WHERE index_id = ?').bind(ix.id).run();
  let n = 0;
  for (const s of res.sections || []) {
    await env.DB.prepare(
      `INSERT INTO spec_section (id, project_id, index_id, code, title, discipline, page_from, page_to, manufacturers, or_equal, requirements, library_id)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`
    ).bind(uid('sps'), pid, ix.id, s.code, s.title || '', s.discipline || '', s.page_from, s.page_to,
           JSON.stringify(s.manufacturers || []), s.or_equal ? 1 : 0, JSON.stringify(s.requirements || {}), ix.library_id || null).run();
    n++;
  }
  await env.DB.prepare('UPDATE spec_index SET state = ?, result = ?, confirmed_by = ?, confirmed_at = ? WHERE id = ?')
    .bind('confirmed', JSON.stringify(res), str(who, 120), nowISO(), ix.id).run();
  return { ok: true, state: 'confirmed', sections: n };
}

// The live sections, for search and for the schedules. `q` matches the number
// or the title.
export async function liveSections(env, pid, q) {
  await ensureSpecTables(env);
  const { results } = await env.DB.prepare('SELECT * FROM spec_section WHERE project_id = ? ORDER BY code').bind(pid).all();
  const all = (results || []).map((r) => ({ ...r, manufacturers: safeJson(r.manufacturers, []), requirements: safeJson(r.requirements, {}), or_equal: !!r.or_equal }));
  if (!q) return all;
  const k = String(q).toLowerCase().replace(/\s+/g, '');
  return all.filter((s) => s.code.replace(/\s+/g, '').toLowerCase().includes(k) || String(s.title).toLowerCase().includes(String(q).toLowerCase()));
}

// One section as its own PDF: the pages it spans, copied out of the document.
export async function sectionPdf(bytes, from, to) {
  const { PDFDocument } = await import('pdf-lib');
  const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const out = await PDFDocument.create();
  const idx = [];
  for (let i = from - 1; i < Math.min(to, src.getPageCount()); i++) idx.push(i);
  const pages = await out.copyPages(src, idx);
  pages.forEach((p) => out.addPage(p));
  return out.save();
}
