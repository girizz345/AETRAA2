// K12 · v5 A7: THE MATERIAL SUBMITTAL PACKAGE, prepared from the supplier's
// catalogue and the specification, then submitted through S0 (K7).
//
//   1 The engineer starts "+ Material submittal" (or a due P3 item) and drops
//     the catalogue. The log line is "Being prepared"; the platform finds the
//     spec section (E13, G10's index — or a library specification and pages
//     the engineer picks), the BOQ line and the approved manufacturers.
//   2 The platform collects the section's clauses (deterministic). The AI
//     reads catalogue and specification and drafts the package: the form's
//     values, the compliance statement, the method statement, the technical
//     explanations. Package Rev 0; log "Ready for engineer review".
//   3 The engineer reviews on one screen — every line links to its source
//     page — edits anything, regenerates a section.
//   4 Completing it forms Rev 1; Rev 0 is kept.
//   5 Generate → Check → Confirm & submit: the package PDF (contents,
//     compliance, method statement, explanations, highlighted catalogue
//     pages, certificates) and the consultant's form are filed on a new
//     MAR-00x — then S0: the PM approves, Document Control issues, the reply
//     is read and confirmed, Code C opens the next revision (K7).
//   No QA/QC step for now; the PM can add one to the project's ladder.
//
// What the AI must never do (v5 A7): submit, approve or issue; invent a
// figure not in the catalogue or specification. So every figure a line gives
// is checked, here, against the text of the page it cites; a figure that is
// not there, or a quote that is not, flags the line for the engineer. A brand
// not on the approved list is labelled "Alternative / equivalent" — by rule,
// not by the AI. The AI's remarks on a deviation stay on the line when the
// engineer overrides it.

import { callModel, aiEnabled, AI_OFF_MESSAGE } from './ai.js';
import { pdfPageLines } from './pdf-text.js';
import { putFile, getFile } from './storage.js';
import { firstJson } from './ai-readers.js';

export const PKG_VERSION = 'a7-1';
export const COMPLIES = ['Y', 'N', 'Partly'];
export const DEFAULT_FORM_FIELDS = ['Material', 'Manufacturer / brand', 'Supplier', 'Country of origin', 'Model / type', 'Spec section', 'Application / location'];
const nowISO = () => new Date().toISOString();
const uid = (p) => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const clean = (s, n = 300) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, n);
const keepLines = (s, n = 8000) => String(s == null ? '' : s).replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ').trim().slice(0, n);
const parse = (v, d) => { try { const j = JSON.parse(v || ''); return j == null ? d : j; } catch (e) { return d; } };
async function sha256Hex(u8) {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', u8))].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/* ------------------------------------------------------------ the store */

let ready = false;
export async function ensurePackageTables(env) {
  if (ready) return true;
  try {
    await env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS material_package (
         id TEXT PRIMARY KEY, project_id TEXT NOT NULL, title TEXT, discipline TEXT, supplier TEXT, brand TEXT,
         spec TEXT, boq TEXT, approved TEXT, schedule_item TEXT, catalogue TEXT, certificates TEXT, inputs TEXT,
         sections TEXT, rev INTEGER, state TEXT, record_ref TEXT, revision_of TEXT, model TEXT,
         created_by TEXT, created_at TEXT, updated_by TEXT, updated_at TEXT)`
    ).run();
    await env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS material_package_rev (
         package_id TEXT NOT NULL, rev INTEGER NOT NULL, snapshot TEXT, kept_by TEXT, kept_at TEXT, note TEXT,
         PRIMARY KEY (package_id, rev))`
    ).run();
    ready = true;
    return true;
  } catch (e) { return false; }
}
const shape = (r) => (r ? { id: r.id, project_id: r.project_id, title: r.title, discipline: r.discipline, supplier: r.supplier, brand: r.brand,
  spec: parse(r.spec, {}), boq: parse(r.boq, null), approved: parse(r.approved, { names: [], or_equal: false }), schedule_item: r.schedule_item || null,
  catalogue: parse(r.catalogue, null), certificates: parse(r.certificates, []), inputs: parse(r.inputs, {}), sections: parse(r.sections, {}),
  rev: Number(r.rev || 0), state: r.state, record_ref: r.record_ref || null, revision_of: r.revision_of || null, model: r.model || null,
  created_by: r.created_by, created_at: r.created_at, updated_by: r.updated_by, updated_at: r.updated_at } : null);
export async function getPackage(env, pid, id) {
  await ensurePackageTables(env);
  return shape(await env.DB.prepare('SELECT * FROM material_package WHERE project_id = ? AND id = ?').bind(pid, String(id || '')).first());
}
export async function listPackages(env, pid) {
  await ensurePackageTables(env);
  const { results } = await env.DB.prepare('SELECT * FROM material_package WHERE project_id = ? ORDER BY created_at').bind(pid).all();
  return (results || []).map(shape);
}
async function savePkg(env, pkg, who) {
  await env.DB.prepare(`UPDATE material_package SET title = ?, discipline = ?, supplier = ?, brand = ?, approved = ?, certificates = ?, sections = ?,
      rev = ?, state = ?, record_ref = ?, model = ?, updated_by = ?, updated_at = ? WHERE project_id = ? AND id = ?`)
    .bind(pkg.title, pkg.discipline, pkg.supplier, pkg.brand, JSON.stringify(pkg.approved), JSON.stringify(pkg.certificates || []),
      JSON.stringify(pkg.sections || {}), pkg.rev, pkg.state, pkg.record_ref || null, pkg.model || null, clean(who, 120), nowISO(), pkg.project_id, pkg.id).run();
}

/* ------------------------------------------------------------ deterministic parts */

// A specification's clauses: a line that starts with a clause number (2.1,
// 2.1.3, 1.02 A, A., 1)) opens a clause, which runs to the next one. Lines
// before the first number are the heading. Never split on a guess: text with
// no clause numbers is one clause.
const CLAUSE_START = /^\s*((?:\d{1,2}\.){1,3}\d{0,2}[A-Z]?|[A-Z]\.|\d{1,2}\)|PART\s+\d)\s+(\S.*)$/;
export function clausesOf(pages, fromPage = 1) {
  const out = [];
  let cur = null, parent = '';
  pages.forEach((t, i) => {
    for (const line of String(t || '').split('\n')) {
      const m = line.match(CLAUSE_START);
      if (m && !/^\d+\.\d+\s*(mm|m|kg|n|%|kn|mpa)\b/i.test(m[2])) {
        if (cur) out.push(cur);
        // A lettered or bracketed clause is known by its parent too ("2.2 A"),
        // since every clause has its own A, B, C.
        const raw = m[1].replace(/\.$/, '');
        if (/^\d/.test(raw) && raw.includes('.')) parent = raw;
        const no = /^([A-Z]|\d{1,2}\))$/.test(raw) && parent ? parent + ' ' + raw : raw;
        cur = { no, text: m[2].trim(), page: fromPage + i };
      } else if (cur && line.trim()) {
        cur.text = (cur.text + ' ' + line.trim()).slice(0, 1500);
      }
    }
  });
  if (cur) out.push(cur);
  if (!out.length) {
    const all = pages.map((t) => String(t || '')).join(' ').replace(/\s+/g, ' ').trim();
    if (all) out.push({ no: '—', text: all.slice(0, 3000), page: fromPage });
  }
  return out.slice(0, 120);
}

// The figures in a piece of text: 1,200 and 1200 are one figure; 40N/mm2 has 40 and 2.
const normNum = (n) => (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(n) ? n.replace(/,/g, '') : n.replace(',', '.')).replace(/^0+(?=\d)/, '');
export function numbersIn(s) {
  return [...new Set((String(s || '').match(/\d+(?:[.,]\d+)*/g) || []).map(normNum))];
}
const flat = (s) => String(s || '').toLowerCase().replace(/[\s ]+/g, ' ').replace(/[“”"']/g, '').trim();
// Every figure in `claim` must be printed in `source`; the quote must be its words.
export function figureCheck(claim, source) {
  const have = new Set(numbersIn(source));
  return numbersIn(claim).filter((n) => !have.has(n));
}
export function quoteOn(quote, source) {
  const q = flat(quote);
  return !q || flat(source).includes(q);
}

// A brand on the approved list (the spec section's manufacturers, and any the
// engineer adds) is approved; any other is "Alternative / equivalent" — a
// label only, never a claim that it is equal.
export function brandStatus(brand, approved) {
  const b = clean(brand).toLowerCase();
  if (!b) return { label: '', approved: false };
  const hit = (approved && approved.names || []).find((n) => { const x = String(n).toLowerCase(); return x && (x.includes(b) || b.includes(x)); });
  return hit ? { label: 'Approved manufacturer (' + hit + ')', approved: true } : { label: 'Alternative / equivalent', approved: false };
}

// Every line checked against its sources. Flags are recomputed after every
// edit and every regeneration: the engineer sees exactly what does not stand.
export function checkSections(pkg) {
  const cat = pkg.inputs.catalogue_pages || [], specText = (pkg.inputs.spec_pages || []).map((p) => p.text).join('\n');
  const catAll = cat.join('\n');
  const pageText = (n) => (Number.isInteger(n) && n >= 1 && n <= cat.length ? cat[n - 1] : null);
  const s = pkg.sections || {};
  for (const r of s.compliance || []) {
    const flags = [];
    const pt = pageText(Number(r.page));
    const nothing = !r.page || Number(r.page) === 0;
    if (!nothing && pt === null) flags.push('page ' + r.page + ' is not in the catalogue');
    else if (!nothing && !String(pt || '').trim()) flags.push('catalogue page ' + r.page + ' has no text (a scan) — check it by eye');
    else if (!nothing) {
      const miss = figureCheck(r.submitted, pt);
      if (miss.length) flags.push((miss.length === 1 ? 'figure ' : 'figures ') + miss.join(', ') + ' not on catalogue page ' + r.page);
      if (r.quote && !quoteOn(r.quote, pt)) flags.push('the quoted words are not on catalogue page ' + r.page);
    }
    const missSpec = figureCheck(r.requirement, specText);
    if (missSpec.length) flags.push((missSpec.length === 1 ? 'figure ' : 'figures ') + missSpec.join(', ') + ' not in the specification');
    if (!COMPLIES.includes(r.complies)) flags.push('say whether it complies (Y, N or Partly)');
    if ((r.complies === 'N' || r.complies === 'Partly') && !clean(r.deviation)) flags.push('a deviation needs saying what differs');
    r.flags = flags;
  }
  for (const f of (s.form && s.form.fields) || []) {
    const miss = figureCheck(f.value, catAll + '\n' + specText);
    f.flags = miss.length ? [(miss.length === 1 ? 'figure ' : 'figures ') + miss.join(', ') + ' not in the catalogue or specification'] : [];
  }
  for (const k of ['method', 'explanations']) {
    if (!s[k]) continue;
    const miss = figureCheck(s[k].text, catAll + '\n' + specText);
    s[k].flags = miss.length ? [(miss.length === 1 ? 'figure ' : 'figures ') + miss.join(', ') + ' not in the catalogue or specification'] : [];
  }
  s.brand = { name: pkg.brand || '', ...brandStatus(pkg.brand, pkg.approved) };
  pkg.sections = s;
  const open = (s.compliance || []).filter((r) => r.flags.length).length
    + ((s.form && s.form.fields) || []).filter((f) => f.flags.length).length
    + ['method', 'explanations'].filter((k) => s[k] && s[k].flags.length).length;
  return { open };
}

/* ------------------------------------------------------------ step 1: start */

//   body: { title, discipline, supplier, brand, spec: { code } | { library_id, from, to }, boq_ref,
//           approved (typed names), schedule_item, catalogue: { filename, bytes }, certificates: [{ filename, bytes }] }
//   ctx: { section(code), library(id), boqLine(ref), scheduleItem(id), who, revision_of }
export async function createPackage(env, pid, body, ctx) {
  await ensurePackageTables(env);
  const title = clean(body.title, 160);
  if (!title) return { error: 'Say what material this submittal is for.' };
  const cat = body.catalogue;
  if (!cat || !cat.bytes || !cat.bytes.length) return { error: 'Drop the supplier’s catalogue (PDF).' };
  if (!/\.pdf$/i.test(cat.filename || '')) return { error: 'The catalogue must be a PDF, so each line can open its page.' };
  if (cat.bytes.length > 25 * 1024 * 1024) return { error: 'That catalogue is larger than 25 MB.' };
  // The spec section: E13's (G10) where the specification is indexed, else a
  // library specification and the pages the engineer names (spec §6: never a
  // split on a guess).
  let spec = null, specBytes = null;
  // A library specification named with its pages is that (its section number
  // only a label); a section number alone is looked up in the spec index.
  if (body.spec && body.spec.code && !body.spec.library_id) {
    const sec = await ctx.section(String(body.spec.code));
    if (!sec) return { error: 'There is no confirmed spec section ' + body.spec.code + ' on this project.' };
    const f = sec.library_id ? await ctx.library(sec.library_id) : null;
    if (!f) return { error: 'The specification for ' + sec.code + ' could not be read back from the library.' };
    spec = { code: sec.code, title: sec.title, discipline: sec.discipline || '', library_id: sec.library_id, from: sec.page_from, to: sec.page_to, from_index: true };
    specBytes = f.bytes;
    if (!body.approved || !body.approved.length) body.approved = sec.manufacturers || [];
    body.or_equal = !!sec.or_equal;
  } else if (body.spec && body.spec.library_id) {
    const from = Math.max(1, Math.round(Number(body.spec.from) || 0)), to = Math.round(Number(body.spec.to) || 0);
    if (!from || !to || to < from || to - from > 60) return { error: 'Give the specification pages for this material (from and to, up to 60 pages).' };
    const f = await ctx.library(String(body.spec.library_id));
    if (!f) return { error: 'There is no such specification in this project’s library.' };
    spec = { code: clean(body.spec.code, 20), title: clean(body.spec.title, 120), library_id: String(body.spec.library_id), from, to, from_index: false };
    specBytes = f.bytes;
  } else return { error: 'Say which specification section it answers — from the spec index, or a library specification and its pages.' };
  const allSpec = await pdfPageLines(specBytes, { pages: spec.to });
  if (!allSpec.length) return { error: 'The specification could not be read.' };
  const specPages = allSpec.slice(spec.from - 1, spec.to).map((text, i) => ({ page: spec.from + i, text }));
  if (!specPages.some((p) => p.text.trim())) return { error: 'Those specification pages have no text (a scan) — their clauses cannot be collected.' };
  let boq = null;
  if (body.boq_ref) {
    const b = await ctx.boqLine(String(body.boq_ref));
    if (!b) return { error: 'There is no BOQ line ' + body.boq_ref + ' on this project.' };
    boq = { ref: b.ref, description: b.description };
  }
  let item = null;
  if (body.schedule_item) {
    item = await ctx.scheduleItem(String(body.schedule_item));
    if (!item) return { error: 'There is no such item on the material submittal schedule (P3).' };
    if (item.record_ref) return { error: 'That schedule item is already submitted as ' + item.record_ref + '.' };
  }
  const catPages = await pdfPageLines(cat.bytes, { pages: 400 });
  if (!catPages.length) return { error: 'The catalogue could not be read as a PDF.' };
  const id = uid('mp_');
  const put = await putFile(env, 'material/' + pid + '/' + id + '/catalogue.pdf', cat.bytes, 'application/pdf');
  if (!put || put.error) return { error: 'The catalogue could not be stored: ' + ((put && put.error) || 'unknown') };
  const certs = [];
  for (const c of (body.certificates || []).slice(0, 20)) {
    if (!c || !c.bytes || !c.bytes.length) continue;
    const ext = (String(c.filename || '').match(/\.(pdf|png|jpe?g)$/i) || [])[1];
    if (!ext) return { error: c.filename + ': a certificate must be a PDF or a picture (PNG, JPEG).' };
    const k = await putFile(env, 'material/' + pid + '/' + id + '/cert-' + certs.length + '.' + ext.toLowerCase(), c.bytes, 'application/octet-stream');
    if (k && k.ok) certs.push({ filename: clean(c.filename, 160), key: k.key, sha256: await sha256Hex(c.bytes) });
  }
  const approved = { names: [...new Set((body.approved || []).map((x) => clean(x, 80)).filter(Boolean))], or_equal: !!body.or_equal };
  const inputs = { catalogue_pages: catPages, spec_pages: specPages, clauses: clausesOf(specPages.map((p) => p.text), spec.from),
    catalogue_sha256: await sha256Hex(cat.bytes), spec_sha256: await sha256Hex(specBytes), unread_catalogue_pages: catPages.map((t, i) => (t.trim() ? null : i + 1)).filter(Boolean) };
  const pkg = { id, project_id: pid, title, discipline: clean(body.discipline || spec.discipline || (item && item.discipline), 60), supplier: clean(body.supplier || (item && item.supplier), 120),
    brand: clean(body.brand || (item && item.brand), 120), spec, boq, approved, schedule_item: item ? item.id : null,
    catalogue: { filename: clean(cat.filename, 160), key: put.key, pages: catPages.length }, certificates: certs, inputs,
    sections: { compliance: [], form: { fields: [] }, method: null, explanations: null, history: [] }, rev: 0, state: 'preparing' };
  checkSections(pkg);
  await env.DB.prepare(`INSERT INTO material_package (id, project_id, title, discipline, supplier, brand, spec, boq, approved, schedule_item, catalogue, certificates,
      inputs, sections, rev, state, revision_of, created_by, created_at, updated_by, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .bind(id, pid, pkg.title, pkg.discipline, pkg.supplier, pkg.brand, JSON.stringify(spec), boq ? JSON.stringify(boq) : null, JSON.stringify(approved), pkg.schedule_item,
      JSON.stringify(pkg.catalogue), JSON.stringify(certs), JSON.stringify(inputs), JSON.stringify(pkg.sections), 0, 'preparing', ctx.revision_of || null,
      clean(ctx.who, 120), nowISO(), clean(ctx.who, 120), nowISO()).run();
  return getPackage(env, pid, id);
}

/* ------------------------------------------------------------ step 2: the AI's draft */

const PKG_SYSTEM = 'You prepare a construction material submittal for a design engineer, who checks every line before it is '
  + 'submitted. Use only the specification clauses and the catalogue pages given. Never invent a figure, a standard, a '
  + 'brand or a page: every figure you give must be printed on the page you cite. You never submit, approve or issue. '
  + 'Answer with JSON only.';
function sources(pkg, catLimit = 40000) {
  const cl = pkg.inputs.clauses.map((c) => '[' + c.no + '] (spec page ' + c.page + ') ' + c.text).join('\n');
  let cat = '';
  pkg.inputs.catalogue_pages.forEach((t, i) => { if (cat.length < catLimit) cat += '\n[Catalogue page ' + (i + 1) + ']\n' + (t || '(no text on this page)') + '\n'; });
  return 'Material: ' + pkg.title + (pkg.brand ? ' — brand ' + pkg.brand : '') + (pkg.supplier ? ', supplier ' + pkg.supplier : '') + '\n'
    + 'Specification section ' + (pkg.spec.code || '') + ' ' + (pkg.spec.title || '') + ' — its clauses:\n' + cl + '\n\n'
    + 'The supplier\'s catalogue:' + cat + '\n';
}
const PROMPTS = {
  compliance: () => 'Give the compliance statement: one row for each specification clause that sets a requirement this product must meet.\n'
    + 'Each row: {"clause": the clause number in brackets above, "requirement": what the clause requires (copy its figures), "submitted": what the catalogue offers for it (copy its figures), '
    + '"complies": "Y", "N" or "Partly", "deviation": "" or what differs, "page": the catalogue page number it is on, "quote": the catalogue\'s own words for it, short and exact}.\n'
    + 'If the catalogue does not state it: "submitted": "not stated in the catalogue", "complies": "N", "page": 0, "quote": "".\n'
    + 'Answer with JSON only: {"rows":[]}',
  form: (fields) => 'Give the value of each field of the consultant\'s material approval form, from the catalogue (the specification for the spec reference): '
    + JSON.stringify(fields) + '.\nAnswer with JSON only: {"fields":[{"name":"","value":"","page":0}]} — "page" is the catalogue page the value is on, 0 if it is not from the catalogue.',
  method: () => 'Write the method statement for the delivery, storage, handling and installation of this material, only as the catalogue and specification describe it, as numbered steps. '
    + 'Answer with JSON only: {"text":"","pages":[]} — "pages" are the catalogue pages it is taken from.',
  explanations: () => 'Write the technical explanations an engineer reviewing this submittal needs: what the product is, how it meets the specification, and any deviation, in short paragraphs. '
    + 'Answer with JSON only: {"text":"","pages":[]}',
};
export const SECTIONS = Object.keys(PROMPTS);

// Draft (or regenerate) sections with the AI. What the AI wrote before is
// kept in the section's history; nothing is submitted.
//   ctx: { who, formFields }
export async function draftSections(env, pid, pkg, which, ctx) {
  if (!aiEnabled(env)) return { error: AI_OFF_MESSAGE, disabled: true };
  if (pkg.state === 'submitted') return { error: 'This package is submitted — revise it to change it.' };
  const want = (which && which.length ? which : SECTIONS).filter((k) => SECTIONS.includes(k));
  const src = sources(pkg);
  const s = pkg.sections;
  const done = [];
  for (const k of want) {
    const ans = await callModel(env, { task: 'a7-' + k, system: PKG_SYSTEM + ' [section: ' + k + ']',
      prompt: src + '\n' + PROMPTS[k](ctx.formFields || DEFAULT_FORM_FIELDS), max_tokens: 6000, temperature: 0, project_id: pid, who: ctx.who });
    if (ans.error) return { error: k + ': ' + ans.error, done };
    const j = firstJson(ans.text);
    if (!j) return { error: k + ': the model’s answer could not be read — nothing in that section was changed', done };
    s.history = (s.history || []).concat([{ section: k, at: nowISO(), model: ans.model, by: clean(ctx.who, 120) }]).slice(-50);
    if (k === 'compliance') {
      const prev = new Map((s.compliance || []).map((r) => [r.clause, r]));
      s.compliance = (Array.isArray(j.rows) ? j.rows : []).slice(0, 120).map((r) => {
        const row = { clause: clean(r.clause, 20), requirement: clean(r.requirement, 600), submitted: clean(r.submitted, 600),
          complies: COMPLIES.includes(String(r.complies)) ? String(r.complies) : (String(r.complies).toUpperCase() === 'YES' ? 'Y' : String(r.complies).toUpperCase() === 'NO' ? 'N' : ''),
          deviation: clean(r.deviation, 600), page: Math.max(0, Math.round(Number(r.page) || 0)), quote: clean(r.quote, 300), source: 'ai', model: ans.model };
        row.ai_remark = row.complies !== 'Y' ? (row.deviation || 'does not comply') : '';
        const old = prev.get(row.clause);
        if (old && old.override) row.override = old.override;          // the engineer's override survives a regeneration
        const cl = pkg.inputs.clauses.find((c) => c.no === row.clause);
        row.spec_page = cl ? cl.page : null;
        return row;
      });
    } else if (k === 'form') {
      s.form = { fields: (Array.isArray(j.fields) ? j.fields : []).slice(0, 40).map((f) => ({ name: clean(f.name, 80), value: clean(f.value, 300), page: Math.max(0, Math.round(Number(f.page) || 0)), source: 'ai' })).filter((f) => f.name), model: ans.model };
    } else {
      s[k] = { text: keepLines(j.text, 8000), pages: (Array.isArray(j.pages) ? j.pages : []).map((n) => Math.round(Number(n))).filter((n) => n > 0).slice(0, 40), source: 'ai', model: ans.model };
    }
    pkg.model = ans.model;
    done.push(k);
  }
  checkSections(pkg);
  if (pkg.state === 'preparing') pkg.state = 'ready';
  await savePkg(env, pkg, ctx.who);
  return { ok: true, done, package: pkg };
}

/* ------------------------------------------------------------ step 3: the engineer's edits */

// What the engineer changed, by section. A compliance row the engineer marks
// differently from the AI keeps the AI's remark and records the override.
export async function editPackage(env, pid, pkg, body, who) {
  if (pkg.state === 'submitted') return { error: 'This package is submitted — revise it to change it.' };
  const s = pkg.sections;
  if (Array.isArray(body.compliance)) {
    const prev = new Map((s.compliance || []).map((r, i) => [i, r]));
    s.compliance = body.compliance.slice(0, 120).map((r, i) => {
      const old = r && r.i != null ? prev.get(Number(r.i)) : null;
      const row = { clause: clean(r.clause, 20), requirement: clean(r.requirement, 600), submitted: clean(r.submitted, 600),
        complies: COMPLIES.includes(r.complies) ? r.complies : '', deviation: clean(r.deviation, 600), page: Math.max(0, Math.round(Number(r.page) || 0)),
        quote: clean(r.quote, 300), source: old ? old.source : 'typed', model: old ? old.model : null, ai_remark: old ? old.ai_remark || '' : '' };
      if (old && old.source === 'ai' && old.complies && row.complies !== old.complies) {
        row.override = { from: old.complies, to: row.complies, note: clean(r.override_note, 300), by: clean(who, 120), at: nowISO() };
        if (!row.override.note) return { error: 'Clause ' + row.clause + ': the AI said “' + old.complies + '” — say why you changed it.' };
      } else if (old && old.override) row.override = old.override;
      if (old && old.source === 'ai' && ['requirement', 'submitted', 'deviation', 'page', 'quote'].some((k) => String(old[k]) !== String(row[k]))) row.source = 'ai, edited';
      const cl = pkg.inputs.clauses.find((c) => c.no === row.clause);
      row.spec_page = cl ? cl.page : null;
      return row;
    });
    const bad = s.compliance.find((x) => x.error);
    if (bad) return { error: bad.error };
  }
  if (body.form && Array.isArray(body.form.fields)) {
    const prev = new Map(((s.form && s.form.fields) || []).map((f) => [f.name, f]));
    s.form = { ...(s.form || {}), fields: body.form.fields.slice(0, 40).map((f) => { const o = prev.get(clean(f.name, 80));
      const v = clean(f.value, 300); return { name: clean(f.name, 80), value: v, page: Math.max(0, Math.round(Number(f.page) || 0)), source: o && o.value === v ? o.source : 'typed' }; }).filter((f) => f.name) };
  }
  for (const k of ['method', 'explanations']) {
    if (body[k] && typeof body[k].text === 'string') {
      const o = s[k] || {};
      s[k] = { text: keepLines(body[k].text, 8000), pages: o.pages || [], source: o.text === keepLines(body[k].text, 8000) ? o.source : 'typed', model: o.model || null };
    }
  }
  if (typeof body.brand === 'string') pkg.brand = clean(body.brand, 120);
  if (typeof body.supplier === 'string') pkg.supplier = clean(body.supplier, 120);
  if (Array.isArray(body.approved)) pkg.approved = { ...pkg.approved, names: [...new Set(body.approved.map((x) => clean(x, 80)).filter(Boolean))] };
  checkSections(pkg);
  await savePkg(env, pkg, who);
  return { ok: true, package: pkg };
}
export async function addCertificate(env, pid, pkg, file, who) {
  if (pkg.state === 'submitted') return { error: 'This package is submitted — revise it to change it.' };
  const ext = (String(file.filename || '').match(/\.(pdf|png|jpe?g)$/i) || [])[1];
  if (!ext) return { error: 'A certificate must be a PDF or a picture (PNG, JPEG).' };
  const k = await putFile(env, 'material/' + pid + '/' + pkg.id + '/cert-' + (pkg.certificates || []).length + '-' + Date.now().toString(36) + '.' + ext.toLowerCase(), file.bytes, 'application/octet-stream');
  if (!k || !k.ok) return { error: 'The certificate could not be stored.' };
  pkg.certificates = (pkg.certificates || []).concat([{ filename: clean(file.filename, 160), key: k.key, sha256: await sha256Hex(file.bytes) }]);
  await savePkg(env, pkg, who);
  return { ok: true, certificates: pkg.certificates.length };
}

/* ------------------------------------------------------------ step 4: complete */

// The package as it stands becomes the next revision; the one before is kept
// whole (Rev 0, the AI's draft, when Rev 1 is formed).
export async function completePackage(env, pid, pkg, who) {
  if (pkg.state === 'submitted') return { error: 'This package is already submitted.' };
  const s = pkg.sections || {};
  if (!(s.compliance || []).length) return { error: 'The compliance statement has no lines yet.' };
  const chk = checkSections(pkg);
  if (chk.open) return { error: chk.open + ' line' + (chk.open === 1 ? ' is' : 's are') + ' still flagged — correct each (or its figure) before completing the package.', open: chk.open };
  await env.DB.prepare('INSERT INTO material_package_rev (package_id, rev, snapshot, kept_by, kept_at, note) VALUES (?,?,?,?,?,?) ON CONFLICT (package_id, rev) DO NOTHING')
    .bind(pkg.id, pkg.rev, JSON.stringify({ sections: s, brand: pkg.brand, supplier: pkg.supplier, approved: pkg.approved, state: pkg.state }), clean(who, 120), nowISO(),
      pkg.rev === 0 && pkg.model ? 'the AI’s draft (' + pkg.model + ')' : 'as it stood').run();
  pkg.rev += 1;
  pkg.state = 'complete';
  await savePkg(env, pkg, who);
  return { ok: true, rev: pkg.rev, package: pkg };
}
export async function packageRevs(env, pkgId) {
  await ensurePackageTables(env);
  const { results } = await env.DB.prepare('SELECT rev, kept_by, kept_at, note FROM material_package_rev WHERE package_id = ? ORDER BY rev').bind(pkgId).all();
  return results || [];
}

/* ------------------------------------------------------------ step 5: the package PDF */

// Contents, the compliance statement, the method statement, the technical
// explanations, the catalogue pages the lines cite (each figure and quote
// highlighted), the certificates — one PDF.
export async function packagePdf(env, pkg, project, ref) {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
  const out = await PDFDocument.create({ updateMetadata: false });
  const font = await out.embedFont(StandardFonts.Helvetica), bold = await out.embedFont(StandardFonts.HelveticaBold);
  const W = 595, H = 842, M = 40;
  const MAP = { '≥': '>=', '≤': '<=', '−': '-', '→': '->', '•': '-', '‘': "'", '’': "'", '“': '"', '”': '"' };
  const ok = new Map();
  const safe = (s) => [...String(s == null ? '' : s)].map((ch) => {
    if (MAP[ch]) return MAP[ch];
    if (ok.has(ch)) return ok.get(ch);
    let v = ch; try { font.encodeText(ch); } catch (e) { v = '?'; }
    ok.set(ch, v); return v;
  }).join('');
  let page, y;
  const newPage = () => { page = out.addPage([W, H]); y = H - M; };
  const wrap = (txt, f, size, width) => {
    const lines = [];
    for (const para of safe(txt).split('\n')) {
      let cur = '';
      for (const w of para.split(' ')) {
        const t = cur ? cur + ' ' + w : w;
        if (f.widthOfTextAtSize(t, size) > width && cur) { lines.push(cur); cur = w; } else cur = t;
      }
      lines.push(cur);
    }
    return lines;
  };
  const para = (txt, f = font, size = 10) => {
    for (const l of wrap(txt, f, size, W - 2 * M)) { if (y < M + size) newPage(); page.drawText(l, { x: M, y, size, font: f }); y -= size + 4; }
  };
  const starts = [];
  const section = (title) => { newPage(); starts.push({ title, page: out.getPageCount() }); para(title, bold, 14); y -= 6; };
  // 1 contents, written last
  const contents = out.addPage([W, H]);
  // 2 the compliance statement
  section('Compliance statement');
  const cols = [['Spec clause', 52], ['Requirement', 120], ['Submitted (from the catalogue)', 120], ['Complies', 44], ['Deviation', 125], ['Cat. page', 44]];
  const row = (cells, f, size) => {
    const wrapped = cells.map((c, i) => wrap(c, f, size, cols[i][1] - 6));
    const h = Math.max(...wrapped.map((w) => w.length)) * (size + 3) + 6;
    if (y - h < M) { newPage(); }
    let x = M;
    wrapped.forEach((ls, i) => { ls.forEach((l, k) => page.drawText(l, { x: x + 3, y: y - (k + 1) * (size + 3), size, font: f })); x += cols[i][1]; });
    page.drawLine({ start: { x: M, y: y - h }, end: { x: W - M, y: y - h }, thickness: 0.4, color: rgb(0.7, 0.7, 0.7) });
    y -= h;
  };
  row(cols.map((c) => c[0]), bold, 8);
  for (const r of pkg.sections.compliance || []) {
    const remark = r.override && r.ai_remark && flat(r.ai_remark) !== flat(r.deviation) ? ' — AI remark: ' + r.ai_remark : '';
    row([r.clause, r.requirement, r.submitted, r.complies + (r.override ? ' (engineer: ' + r.override.note + ')' : ''), r.deviation + remark, r.page ? String(r.page) : '—'], font, 8);
  }
  // 3 method statement, 4 explanations
  section('Method statement'); para((pkg.sections.method || {}).text || '(none)');
  section('Technical explanations'); para((pkg.sections.explanations || {}).text || '(none)');
  // 5 the catalogue pages cited, highlighted
  const cited = [...new Set((pkg.sections.compliance || []).map((r) => Number(r.page)).filter((n) => n > 0)
    .concat(((pkg.sections.form || {}).fields || []).map((f) => Number(f.page)).filter((n) => n > 0)))].sort((a, b) => a - b);
  const catFile = pkg.catalogue && pkg.catalogue.key ? await getFile(env, pkg.catalogue.key).catch(() => null) : null;
  if (catFile && cited.length) {
    const src = await PDFDocument.load(catFile.bytes, { ignoreEncryption: true });
    const items = await pdfPageLines(catFile.bytes, { pages: Math.max(...cited), items: true });
    const valid = cited.filter((n) => n <= src.getPageCount());
    const copies = await out.copyPages(src, valid.map((n) => n - 1));
    starts.push({ title: 'Catalogue pages cited (highlighted)', page: out.getPageCount() + 1 });
    copies.forEach((p, k) => {
      out.addPage(p);
      const n = valid[k];
      const marks = (pkg.sections.compliance || []).filter((r) => Number(r.page) === n);
      const want = new Set(marks.flatMap((r) => numbersIn(r.submitted)));
      const quotes = marks.map((r) => flat(r.quote)).filter(Boolean);
      for (const it of ((items[n - 1] || {}).items || [])) {
        const s = flat(it.s);
        if (!s) continue;
        const hit = numbersIn(it.s).some((x) => want.has(x)) || quotes.some((q) => q.includes(s) && s.length > 2);
        if (hit) p.drawRectangle({ x: it.x - 1, y: it.y - it.h * 0.25, width: Math.max(it.w, 6) + 2, height: it.h * 1.3, color: rgb(1, 0.92, 0.2), opacity: 0.35 });
      }
    });
  }
  // 6 certificates
  const certStart = out.getPageCount() + 1;
  let certs = 0;
  for (const c of pkg.certificates || []) {
    const f = await getFile(env, c.key).catch(() => null);
    if (!f) continue;
    try {
      if (/\.pdf$/i.test(c.filename)) {
        const d = await PDFDocument.load(f.bytes, { ignoreEncryption: true });
        (await out.copyPages(d, d.getPageIndices())).forEach((p) => out.addPage(p));
      } else {
        const img = /\.png$/i.test(c.filename) ? await out.embedPng(f.bytes) : await out.embedJpg(f.bytes);
        const p = out.addPage([W, H]); const sc = Math.min((W - 2 * M) / img.width, (H - 2 * M) / img.height, 1);
        p.drawImage(img, { x: M, y: H - M - img.height * sc, width: img.width * sc, height: img.height * sc });
      }
      certs++;
    } catch (e) { /* a certificate that cannot be read is listed, not dropped silently */ }
  }
  if (certs) starts.push({ title: 'Certificates (' + certs + ')', page: certStart });
  // the contents page
  page = contents; y = H - M;
  para('Material submittal' + (ref ? ' ' + ref : '') + ' — Rev ' + pkg.rev, bold, 16);
  para(pkg.title, bold, 12);
  para(((project && project.name) || '') + ((project && project.ref) ? ' · ' + project.ref : ''));
  para('Specification: ' + (pkg.spec.code || '') + ' ' + (pkg.spec.title || '') + ' · BOQ: ' + ((pkg.boq && pkg.boq.ref) || '—'));
  para('Supplier: ' + (pkg.supplier || '—') + ' · Brand: ' + (pkg.brand || '—') + (pkg.sections.brand && pkg.sections.brand.label ? ' (' + pkg.sections.brand.label + ')' : ''));
  y -= 10;
  para('Contents', bold, 12);
  para('1. The consultant’s form — issued with this package');
  starts.forEach((s, i) => para((i + 2) + '. ' + s.title + ' .......... page ' + s.page));
  return new Uint8Array(await out.save({ useObjectStreams: false }));
}

/* ------------------------------------------------------------ the log, the ladder */

// The material submittal log, by discipline (v5 A7): Sr, Discipline,
// Description, Supplier, Brand, Submitted, Rev, Status — packages being
// prepared and the MARs they became.
export async function materialLog(env, pid) {
  const pkgs = await listPackages(env, pid);
  let recs = [];
  try { recs = (await env.DB.prepare("SELECT ref, title, status, data, workflow, step, rev, issued_on, submitted, imported FROM records WHERE project_id = ? AND type = 'material'").bind(pid).all()).results || []; }
  catch (e) { recs = []; }
  const byRef = new Map(pkgs.filter((p) => p.record_ref).map((p) => [p.record_ref, p]));
  const STATE = { preparing: 'Being prepared', ready: 'Ready for engineer review', complete: 'Rev {rev} — ready to submit' };
  const rows = [];
  for (const p of pkgs) {
    if (p.record_ref) continue;
    rows.push({ ref: '', package: p.id, discipline: p.discipline || '', description: p.title, supplier: p.supplier, brand: p.brand, submitted: '', rev: String(p.rev),
      status: (STATE[p.state] || p.state).replace('{rev}', p.rev) });
  }
  for (const r of recs) {
    const d = parse(r.data, {}), p = byRef.get(r.ref);
    rows.push({ ref: r.ref, package: p ? p.id : null, discipline: d.Discipline || (p && p.discipline) || '', description: r.title, supplier: d.Supplier || (p && p.supplier) || '',
      brand: d.Brand || (p && p.brand) || '', submitted: String(r.issued_on || '').slice(0, 10) || String(r.submitted || '').slice(0, 10), rev: d.Rev || String(r.rev || 0),
      status: Number(r.imported) ? 'Imported — ' + r.status : r.status });
  }
  rows.sort((a, b) => String(a.discipline).localeCompare(String(b.discipline)) || String(a.ref || '~').localeCompare(String(b.ref || '~'), 'en', { numeric: true }) || String(a.description).localeCompare(String(b.description)));
  rows.forEach((r, i) => { r.sr = i + 1; });
  return rows;
}

const OLD_DEFAULT = ['Submitted', 'QA/QC checks against spec', 'PM approves to submit', 'Document Control issues to consultant', 'Consultant approval recorded'];
const QAQC_STEP = { st: 'QA/QC checks against spec', by: ['qaqc'], issue: false, reply: false };
// A project still carrying the shipped ladder from before A7 (with QA/QC),
// never changed by anyone, takes A7's ladder: no QA/QC step. A ladder a person
// set is left as it is.
export async function settleMaterialLadder(env, pid, ladderNow) {
  try {
    const r = await env.DB.prepare("SELECT steps, changed_by FROM project_workflow WHERE project_id = ? AND type = 'material'").bind(pid).first();
    if (!r || r.changed_by !== 'AETRAA') return null;
    const steps = parse(r.steps, []);
    if (steps.map((s) => s.st).join('|') !== OLD_DEFAULT.join('|')) return null;
    const next = steps.filter((s) => s.st !== QAQC_STEP.st);
    await env.DB.prepare("UPDATE project_workflow SET steps = ?, template_id = 'to-engineer' WHERE project_id = ? AND type = 'material'").bind(JSON.stringify(next), pid).run();
    return next;
  } catch (e) { return null; }
}
// The PM adds (or takes out) the QA/QC step on this project's material ladder.
//   save(steps) → saveWorkflow
export function materialSteps(current, on) {
  const steps = (current || []).filter((s) => s.st !== QAQC_STEP.st);
  if (on) steps.splice(1, 0, { ...QAQC_STEP });
  return steps;
}
