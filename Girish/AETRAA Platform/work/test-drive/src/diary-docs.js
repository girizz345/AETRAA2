// K11 · v5 A5 (agreed 5 Oct 2026: part of the daily diary): DELIVERY NOTES AND
// CERTIFICATES, uploaded with the day's diary by site or Document Control.
//
//   1 The person uploads the delivery note or certificate on the diary day.
//   2 Its text is read where it has some, and what it states plainly is read
//     by rule (the delivery-note number and date; the certificate number, the
//     issue and expiry dates). The AI reads the rest: the supplier and each
//     item, quantity, unit and batch; the certificate's type, issuer and what
//     it covers — filling only what the rules left empty.
//   3 The person confirms. A delivery note's items go into the diary's
//     "Delivery of materials" (with the supplier, note number and batch); a
//     certificate is filed in the certificates register, its expiry as the
//     record's date — an expired certificate is filed and flagged, never
//     refused; one with no expiry found is listed as such (spec §6).
//   Expiry alerts: on the attention list of HSE and the PM, and an email once
//   a certificate is within 30 days of expiry and once when it has expired.
//
// What the AI must never do (v5 A5): receive goods or accept a certificate by
// itself. It reads; the person's confirmation is what writes. Matching to the
// MIR, the order, the BOM and the plant list is deferred (A5's 5 Oct comment).

import { callModel, aiEnabled, AI_OFF_MESSAGE } from './ai.js';
import { letterText } from './correspondence.js';
import { dateOf, firstJson } from './ai-readers.js';
import { putFile } from './storage.js';

export const DOC_READER = 'a5-read-1', A5_PROMPT = 'a5-1';
export const CERT_TYPES = ['Lifting equipment', 'Plant / machinery', 'Operator / competency', 'Material test', 'Mill certificate', 'Calibration', 'Insurance', 'Other'];
export const EXPIRY_LEAD_DAYS = 30;
const nowISO = () => new Date().toISOString();
const todayUAE = () => new Date(Date.now() + 4 * 3600000).toISOString().slice(0, 10);
const uid = (p) => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const clean = (s, n = 300) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, n);
const parse = (v, d) => { try { const j = JSON.parse(v || ''); return j == null ? d : j; } catch (e) { return d; } };
const ISO = /^\d{4}-\d{2}-\d{2}$/;
async function sha256Hex(u8) {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', u8))].map((b) => b.toString(16).padStart(2, '0')).join('');
}
const SURE = (v) => (['high', 'medium', 'low'].includes(String(v || '').toLowerCase()) ? String(v).toLowerCase() : 'low');

/* ------------------------------------------------------------ by rule */

// An expiry is in the future by nature, so no "after today" check here — the
// date of issue is checked against today when the person confirms.
const dateAfter = (t, re) => { const m = String(t || '').match(re); if (!m) return { }; const d = dateOf(m[1].replace(/[,.;]+$/, ''), '2999-12-31'); return d.iso && !d.blocks ? { iso: d.iso } : { why: d.why || '' }; };
export function ruleDelivery(text) {
  const t = String(text || ''), out = {};
  const dn = t.match(/\b(?:delivery\s*note|d\.?\s?n\.?|delivery\s*order)\s*(?:no\.?|number|#)?\s*[:.\-]?\s*([A-Z0-9][A-Z0-9/\-]{2,30})/i);
  if (dn && /\d/.test(dn[1])) out.dn = dn[1];
  const d = dateAfter(t, /(?:^|\n)\s*(?:delivery\s*)?date\s*[:.\-]\s*([^\n]{6,30})/i);
  if (d.iso) out.date = d.iso;
  return out;
}
export function ruleCert(text) {
  const t = String(text || ''), out = {};
  const no = t.match(/\b(?:certificate|cert\.?|report)\s*(?:no\.?|number|#)\s*[:.\-]?\s*([A-Z0-9][A-Z0-9/\-]{2,30})/i);
  if (no && /\d/.test(no[1])) out.number = no[1];
  const ex = dateAfter(t, /\b(?:expiry(?:\s*date)?|expires(?:\s*on)?|valid\s*(?:until|till|up\s*to|upto)|date\s*of\s*expiry|next\s*(?:inspection|examination|calibration)\s*(?:due|date)?)\s*[:.\-]?\s*([^\n]{6,30})/i);
  if (ex.iso) out.expiry = ex.iso; else if (ex.why) out.expiry_why = ex.why;
  const is = dateAfter(t, /\b(?:date\s*of\s*issue|issue\s*date|issued\s*(?:on)?|date\s*of\s*(?:inspection|examination|test|calibration))\s*[:.\-]?\s*([^\n]{6,30})/i);
  if (is.iso) out.issued = is.iso;
  return out;
}

/* ------------------------------------------------------------ the AI's reading */

const DOC_SYSTEM = 'You read a delivery note or a certificate received on a construction site, for the site engineer or '
  + 'document controller, who checks every value before anything is recorded. Copy what is written; never guess a number, '
  + 'a quantity or a date; never convert or reorder a date. You never receive goods or accept a certificate. Answer with JSON only.';
const DELIVERY_PROMPT = 'This is a delivery note. Give:\n'
  + '- supplier: who delivered (the company)\n- dn_no: the delivery note number, as written\n- date: the delivery date, exactly as written\n'
  + '- items: each line delivered: {"material": as written, "qty": the quantity as a number, "unit": as written, "batch": batch, heat or lot number or ""}\n'
  + '- sure: "high", "medium" or "low" for supplier, dn_no and date\n'
  + 'Answer with JSON only: {"supplier":"","dn_no":"","date":"","items":[],"sure":{"supplier":"low","dn_no":"low","date":"low"}}';
const CERT_PROMPT = 'This is a certificate. Give:\n'
  + '- type: one of ' + CERT_TYPES.join(', ') + '\n- number: the certificate number, as written\n- issued_by: who issued it\n'
  + '- issued: the date of issue or of the inspection/test, exactly as written\n- expiry: the expiry, "valid until" or next-inspection date, exactly as written, or "" if none is stated\n'
  + '- subject: what it covers (the plant or equipment and its serial or ID, the person, or the material and its heat/batch number)\n'
  + '- sure: "high", "medium" or "low" for number, issued and expiry\n'
  + 'Answer with JSON only: {"type":"","number":"","issued_by":"","issued":"","expiry":"","subject":"","sure":{"number":"low","issued":"low","expiry":"low"}}';

export function parseDoc(kind, text) {
  const j = firstJson(text);
  if (!j || typeof j !== 'object') return null;
  const s = j.sure && typeof j.sure === 'object' ? j.sure : {};
  if (kind === 'delivery') {
    return { supplier: clean(j.supplier, 120), dn_no: clean(j.dn_no, 40), date: clean(j.date, 40),
      items: (Array.isArray(j.items) ? j.items : []).slice(0, 40).map((x) => ({ m: clean(x && x.material, 120), q: clean(x && x.qty, 20), u: clean(x && x.unit, 12), b: clean(x && x.batch, 40) })).filter((x) => x.m),
      sure: { supplier: SURE(s.supplier), dn_no: SURE(s.dn_no), date: SURE(s.date) } };
  }
  return { type: clean(j.type, 40), number: clean(j.number, 60), issued_by: clean(j.issued_by, 120), issued: clean(j.issued, 40), expiry: clean(j.expiry, 40),
    subject: clean(j.subject, 160), sure: { number: SURE(s.number), issued: SURE(s.issued), expiry: SURE(s.expiry) } };
}

// Rules first; the AI fills what they left; a two-way date or a value outside
// the lists is shown with the reason and not used.
export function draftDoc(kind, rule, ai, today = todayUAE()) {
  const field = (r, a, sure, check) => {
    let v = a || '', flags = [];
    if (v && check) { const c = check(v); if (c.why) flags.push(c.why); v = c.value || ''; }
    if (r) return { value: r, source: 'rule', ...(v && String(v).toUpperCase() !== String(r).toUpperCase() ? { ai: v, flags: flags.concat(['the AI read “' + v + '”; the value read by rule is kept']) } : flags.length ? { flags } : {}) };
    return v ? { value: v, source: 'ai', sure: sure || 'medium', ...(flags.length ? { flags } : {}) } : { value: '', source: '', ...(flags.length ? { flags } : {}) };
  };
  const asDate = (v) => { const d = dateOf(v, '2999-12-31'); return d.blocks ? { why: d.why } : { value: d.iso }; };
  if (kind === 'delivery') {
    const a = ai || { items: [], sure: {} };
    return { supplier: field('', a.supplier, a.sure.supplier), dn: field(rule.dn, a.dn_no, a.sure.dn_no), date: field(rule.date, a.date, a.sure.date, asDate),
      items: (a.items || []).map((x) => ({ ...x, source: 'ai' })) };
  }
  const a = ai || { sure: {} };
  const out = {
    type: field('', a.type, 'medium', (v) => { const t = CERT_TYPES.find((x) => x.toLowerCase() === String(v).toLowerCase()); return t ? { value: t } : { why: '“' + v + '” is not one of the types', value: 'Other' }; }),
    number: field(rule.number, a.number, a.sure.number), issued_by: field('', a.issued_by, 'medium'),
    issued: field(rule.issued, a.issued, a.sure.issued, asDate), expiry: field(rule.expiry, a.expiry, a.sure.expiry, asDate),
    subject: field('', a.subject, 'medium'),
  };
  if (rule.expiry_why && !out.expiry.value) out.expiry.flags = (out.expiry.flags || []).concat([rule.expiry_why]);
  return out;
}

/* ------------------------------------------------------------ kept */

let ready = false;
export async function ensureDiaryDocs(env) {
  if (ready) return true;
  try {
    await env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS diary_docs (
         id TEXT PRIMARY KEY, project_id TEXT NOT NULL, day TEXT, kind TEXT, filename TEXT, file_key TEXT, sha256 TEXT, reader TEXT,
         rule TEXT, ai TEXT, model TEXT, draft TEXT, why TEXT, state TEXT, applied TEXT, cert_ref TEXT,
         by TEXT, at TEXT, confirmed_by TEXT, confirmed_at TEXT)`
    ).run();
    await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_diary_docs ON diary_docs(project_id, day)').run();
    ready = true;
    return true;
  } catch (e) { return false; }
}
const shapeDoc = (r) => (r ? { id: r.id, day: r.day, kind: r.kind, filename: r.filename, file_key: r.file_key, sha256: r.sha256, reader: r.reader,
  rule: parse(r.rule, {}), ai: parse(r.ai, null), model: r.model || null, draft: parse(r.draft, {}), why: r.why || '', state: r.state,
  applied: parse(r.applied, null), cert_ref: r.cert_ref || null, by: r.by, at: r.at, confirmed_by: r.confirmed_by, confirmed_at: r.confirmed_at } : null);
export async function getDiaryDoc(env, pid, id) {
  await ensureDiaryDocs(env);
  return shapeDoc(await env.DB.prepare('SELECT * FROM diary_docs WHERE project_id = ? AND id = ?').bind(pid, String(id || '')).first());
}
export async function listDiaryDocs(env, pid, day) {
  await ensureDiaryDocs(env);
  const { results } = await env.DB.prepare('SELECT * FROM diary_docs WHERE project_id = ? AND day = ? ORDER BY at').bind(pid, String(day || '')).all();
  return (results || []).map(shapeDoc);
}
export async function decideDoc(env, pid, id, state, applied, certRef, who) {
  await env.DB.prepare('UPDATE diary_docs SET state = ?, applied = ?, cert_ref = ?, confirmed_by = ?, confirmed_at = ? WHERE project_id = ? AND id = ?')
    .bind(state, applied == null ? null : JSON.stringify(applied), certRef || null, clean(who, 120), nowISO(), pid, String(id)).run();
}

// Step 2: read it. Keeps the file and the reading; receives nothing, files
// nothing. The same file uploaded again is the reading already kept.
//   input: { day, kind: 'delivery'|'certificate', filename, bytes }   ctx: { who, useAi }
export async function readDiaryDoc(env, pid, input, ctx) {
  await ensureDiaryDocs(env);
  const kind = input.kind === 'certificate' ? 'certificate' : input.kind === 'delivery' ? 'delivery' : null;
  if (!kind) return { error: 'Say whether it is a delivery note or a certificate.' };
  if (!ISO.test(String(input.day || ''))) return { error: 'Which diary day is it for?' };
  if (input.day > todayUAE()) return { error: 'That diary day is in the future.' };
  const bytes = new Uint8Array(input.bytes || []);
  if (!bytes.length) return { error: 'that file is empty' };
  if (bytes.length > 25 * 1024 * 1024) return { error: 'that file is larger than 25 MB' };
  const sha = await sha256Hex(bytes);
  const same = await env.DB.prepare('SELECT id FROM diary_docs WHERE project_id = ? AND sha256 = ? AND kind = ? ORDER BY at DESC').bind(pid, sha, kind).first().catch(() => null);
  if (same) {
    const r = await getDiaryDoc(env, pid, same.id);
    return { ...r, kept: true, ...(r.state === 'confirmed' ? { already: 'This ' + (kind === 'delivery' ? 'delivery note' : 'certificate') + ' was already confirmed on ' + r.day + (r.cert_ref ? ' as ' + r.cert_ref : '') + '.' } : {}) };
  }
  const t = await letterText(bytes, input.filename);
  if (!t.format || t.format === 'msg' || t.format === 'eml') return { error: 'Upload the ' + (kind === 'delivery' ? 'delivery note' : 'certificate') + ' as a PDF, Word file or a photo (PNG or JPEG).' };
  const rule = kind === 'delivery' ? ruleDelivery(t.text) : ruleCert(t.text);
  let ai = null, model = null, why = '';
  if (!aiEnabled(env) || ctx.useAi === false) why = aiEnabled(env) ? 'AI is not switched on for this project — type the details' : AI_OFF_MESSAGE;
  else {
    const docs = t.scan ? [{ bytes, media_type: t.format === 'pdf' ? 'application/pdf' : t.format === 'png' ? 'image/png' : 'image/jpeg' }] : [];
    const ans = await callModel(env, { task: kind === 'delivery' ? 'a5-delivery' : 'a5-certificate', system: DOC_SYSTEM,
      prompt: (t.scan ? '' : 'The document:\n"""\n' + t.text.slice(0, 16000) + '\n"""\n\n') + (kind === 'delivery' ? DELIVERY_PROMPT : CERT_PROMPT),
      documents: docs, max_tokens: 1500, temperature: 0, project_id: pid, who: ctx.who });
    if (ans.error) why = 'the AI could not read it (' + ans.error + ') — type the details';
    else { ai = parseDoc(kind, ans.text); model = ans.model; if (!ai) why = 'the AI’s answer could not be read — type the details'; }
  }
  const draft = draftDoc(kind, rule, ai);
  const id = uid('dd_');
  const ext = (String(input.filename || '').match(/\.([a-z0-9]{1,5})$/i) || [])[1] || 'bin';
  const put = await putFile(env, 'diary/' + pid + '/' + input.day + '/' + id + '.' + ext.toLowerCase(), bytes, 'application/octet-stream');
  await env.DB.prepare(`INSERT INTO diary_docs (id, project_id, day, kind, filename, file_key, sha256, reader, rule, ai, model, draft, why, state, by, at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .bind(id, pid, input.day, kind, clean(input.filename, 200), put && put.ok ? put.key : null, sha, DOC_READER, JSON.stringify(rule),
      ai ? JSON.stringify(ai) : null, model, JSON.stringify(draft), why, 'read', clean(ctx.who, 120), nowISO()).run();
  return getDiaryDoc(env, pid, id);
}

/* ------------------------------------------------------------ what the person confirms */

// A delivery note's lines, as the person left them: into the diary's
// "Delivery of materials", each carrying the supplier, note number, batch and
// where it came from.
export function settleDelivery(doc, body) {
  const supplier = clean(body.supplier, 120), dn = clean(body.dn, 40);
  const items = (Array.isArray(body.items) ? body.items : []).slice(0, 40).map((x) => ({ m: clean(x && x.m, 120), q: clean(x && x.q, 20), u: clean(x && x.u, 12), b: clean(x && x.b, 40) }))
    .filter((x) => x.m);
  if (!items.length) return { error: 'Give at least one material delivered.' };
  const bad = items.find((x) => x.q && !/^\d+(\.\d+)?$/.test(x.q.replace(/,/g, '')));
  if (bad) return { error: bad.m + ': the quantity “' + bad.q + '” is not a number.' };
  const read = doc.draft || {};
  const fromAi = (k, v) => !!(read[k] && read[k].source === 'ai' && v && clean(read[k].value).toUpperCase() === v.toUpperCase());
  return { rows: items.map((x) => ({ m: x.m, q: x.q.replace(/,/g, ''), u: x.u, ...(supplier ? { s: supplier } : {}), ...(dn ? { dn } : {}), ...(x.b ? { b: x.b } : {}), src: doc.id })),
    how: { supplier: fromAi('supplier', supplier) ? 'ai' : supplier ? 'typed' : '', dn: read.dn && read.dn.source && clean(read.dn.value) === dn ? read.dn.source : dn ? 'typed' : '' } };
}
// A certificate as the person confirmed it, for the certificates register.
// Expired: filed and flagged. No expiry: filed as "expiry not found".
export function settleCert(doc, body, today = todayUAE()) {
  const type = clean(body.type, 40), number = clean(body.number, 60), issuedBy = clean(body.issued_by, 120), subject = clean(body.subject, 160);
  const issued = String(body.issued || '').slice(0, 10), expiry = String(body.expiry || '').slice(0, 10);
  if (!type) return { error: 'Say what kind of certificate it is.' };
  if (!number && !subject) return { error: 'Give the certificate number, or what it covers.' };
  if (issued && !ISO.test(issued)) return { error: 'Give the date of issue as a date.' };
  if (expiry && !ISO.test(expiry)) return { error: 'Give the expiry as a date.' };
  if (issued && issued > today) return { error: 'The date of issue is after today.' };
  if (issued && expiry && expiry <= issued) return { error: 'The expiry (' + expiry + ') is not after the date of issue (' + issued + ').' };
  const flag = !expiry ? 'expiry not found' : expiry < today ? 'expired on ' + expiry : '';
  const read = doc.draft || {};
  const how = {};
  for (const [k, v] of Object.entries({ type, number, issued_by: issuedBy, issued, expiry, subject })) {
    if (!v) continue;
    const d = read[k] || {};
    how[k] = d.value && clean(d.value).toUpperCase() === String(v).toUpperCase() ? d.source || 'typed' : 'typed';
  }
  return { title: type + (number ? ' ' + number : '') + (subject ? ' — ' + subject : ''), flag, how,
    data: { Certificate: type, 'Certificate no': number, 'Issued by': issuedBy, 'Serial / plant no': subject, Issued: issued, Expires: expiry, 'Valid until': expiry,
      'Received with the diary of': doc.day, ...(flag ? { Flag: flag } : {}) } };
}

/* ------------------------------------------------------------ expiry */

// Certificates by their expiry: expired, expiring within the lead time, or
// with no expiry found. A certificate brought in from the old system carries
// no clock (K5) and is left out.
export async function certExpiries(env, pid, today = todayUAE(), lead = EXPIRY_LEAD_DAYS) {
  let rows = [];
  try {
    const r = await env.DB.prepare("SELECT ref, title, data, imported, status FROM records WHERE project_id = ? AND type = 'cert'").bind(pid).all();
    rows = r.results || [];
  } catch (e) { rows = []; }
  const out = [];
  const until = new Date(Date.parse(today) + lead * 86400000).toISOString().slice(0, 10);
  for (const r of rows) {
    if (Number(r.imported)) continue;
    const d = parse(r.data, {});
    const ex = String(d.Expires || d['Valid until'] || '').slice(0, 10);
    if (!ISO.test(ex)) { out.push({ ref: r.ref, title: r.title, state: 'not found', expiry: '' }); continue; }
    const days = Math.round((Date.parse(ex) - Date.parse(today)) / 86400000);
    if (ex < today) out.push({ ref: r.ref, title: r.title, state: 'expired', expiry: ex, days });
    else if (ex <= until) out.push({ ref: r.ref, title: r.title, state: 'expiring', expiry: ex, days });
  }
  return out.sort((a, b) => String(a.expiry || '0000').localeCompare(String(b.expiry || '0000')) || a.ref.localeCompare(b.ref));
}

// The delivery note's lines into the day's diary: lines from this note
// replace the ones it gave before (never added to twice); every other part of
// the diary is saved as it stands. A submitted diary is revised with the
// reason, its version as submitted kept (diary.js).
//   ctx: { loadDiary(day), saveDiary(body), who, reason }
export async function applyDelivery(doc, rows, ctx) {
  const d = await ctx.loadDiary(doc.day);
  if (d.missing) return { error: 'the diary is not set up on this project' };
  if (d.status === 'submitted' && !clean(ctx.reason)) {
    return { error: 'the diary for ' + doc.day + ' is already submitted — say why it is changed; the version as submitted is kept', submitted: true };
  }
  const others = (d.materials || []).filter((m) => m && m.m && m.src !== doc.id);
  const r = await ctx.saveDiary({ report_date: doc.day, staff: d.staff, plant: d.plant, works: d.works, tomorrow: d.tomorrow, subs: d.subs,
    materials: others.concat(rows), weather: d.weather, remarks: d.remarks, visitors: d.visitors, prepared_by: d.prepared_by,
    changed_by: ctx.who, reason: clean(ctx.reason) || undefined });
  if (r.error) return r;
  return { ok: true, lines: rows.length, revised: !!r.revised };
}
