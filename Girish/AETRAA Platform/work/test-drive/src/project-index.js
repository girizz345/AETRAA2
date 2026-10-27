// THE PROJECT INDEX — spec §29, phase 9.
//
// Filing a document puts it where someone can find it; the index makes what is
// inside it usable. It is a DERIVED store of facts with their source — not a
// copy of the documents — rebuilt from them at any time, and read when someone
// presses "Check and complete" on a draft letter.
//
// The rules that keep it safe (§29):
//   1. Nothing is inserted without being accepted; the writer may edit any
//      proposal first, or refuse it.
//   2. A clause is quoted verbatim or not at all — from the indexed contract,
//      with its number and page. A quotation the writer edits stops being a
//      quotation and is marked as their paraphrase.
//   3. The platform never advises on entitlement.
//   4. Date arithmetic is shown, never concluded ("day 41"), never "time-barred".
//   5. Every proposal is checkable in one click: it opens its source.
//   6. An empty index proposes nothing — never a generic FIDIC clause.
//
// Decisions D13–D15 are Ajay's to make; until he does, this follows the spec's
// own recommendations and says so: D13 clauses quoted verbatim; D14 an
// addendum's clause shown first, the earlier one kept and marked superseded;
// D15 the contractor's own team only — no consultant access.

import { pdfPages } from './pdf-text.js';
import { documentFile } from './library.js';
import { words } from './knowledge.js';
import { addColumns } from './db-cols.js';

export const INDEX_RULES = 'project-index-2026.10.06';
const nowISO = () => new Date().toISOString();
const str = (v, n = 300) => String(v == null ? '' : v).slice(0, n);
const safeJson = (s, f) => { try { const v = JSON.parse(s || ''); return v == null ? f : v; } catch (e) { return f; } };
const safe = async (fn, f) => { try { return await fn(); } catch (e) { return f; } };
const todayUAE = () => new Date(Date.now() + 4 * 3600000).toISOString().slice(0, 10);
const dayDiff = (a, b) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000);

let ready = false;
export async function ensureIndexTables(env) {
  if (ready) return true;
  try {
    await env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS index_entry (
         id TEXT PRIMARY KEY, project_id TEXT NOT NULL, kind TEXT, key TEXT, heading TEXT, text TEXT, topics TEXT,
         doc_source TEXT, page INTEGER, quote TEXT, occurred_on TEXT, superseded_by TEXT, built_at TEXT, rules_version TEXT, rtype TEXT, rstatus TEXT)`
    ).run();
    await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_index_entry_p ON index_entry(project_id, kind, key)').run();
    await env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS index_link (
         id TEXT PRIMARY KEY, project_id TEXT NOT NULL, from_id TEXT, to_id TEXT, relation TEXT,
         confidence_basis TEXT, confirmed_by TEXT)`
    ).run();
    await env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS letter_check (
         id TEXT PRIMARY KEY, project_id TEXT NOT NULL, draft TEXT, proposals TEXT, decisions TEXT,
         final_text TEXT, confirmed_by TEXT, confirmed_at TEXT)`
    ).run();
    await addColumns(env, 'index_entry', [['rtype', 'TEXT'], ['rstatus', 'TEXT']]);
    ready = true;
    return true;
  } catch (e) { return false; }
}

const TOPICS = {
  notice: /\bnotice|notif/i, retention: /\bretention/i, eot: /extension\s+of\s+time|\beot\b/i, variation: /\bvariation/i,
  payment: /\bpayment|\bcertificate|\binterim/i, lds: /liquidated\s+damages|delay\s+damages/i, suspension: /\bsuspen/i,
  claims: /\bclaim/i, delay: /\bdelay/i, time_bar: /\btime[-\s]?bar|\bwithin\s+\d+\s+days/i,
};
const topicsOf = (t) => Object.keys(TOPICS).filter((k) => TOPICS[k].test(t));

// Clauses in a contract's pages: a clause starts where "Sub-Clause 20.2.1" or
// "Clause 14.3" opens a sentence and is followed by a capitalised heading, and
// runs to the next such start. A reference inside a sentence ("in accordance
// with Sub-Clause 20.1") does not start a clause.
export function clausesFrom(pages) {
  const starts = [];
  pages.forEach((t, i) => {
    const re = /(^|[.:;]\s+|\s{2,})((?:Sub-?Clause|Clause)\s+(\d{1,2}(?:\.\d{1,3}){0,3}))\s+([A-Z][A-Za-z'’&,\- ]{2,70}?)(?=[.:]|\s{2}|\s+[A-Z][a-z]+\s+[a-z])/g;
    let m;
    while ((m = re.exec(t))) {
      // The heading is the title-case run; the first word of the clause's own
      // sentence ("The Contractor shall…") is not part of it.
      let heading = m[4].trim();
      while (/\s(The|A|An|Where|If|Each|Any|All|Unless|When|Within|Subject|Following|Upon|Every|No)$/.test(heading)) heading = heading.replace(/\s\S+$/, '');
      starts.push({ page: i + 1, at: m.index + m[1].length, label: m[2].replace(/^sub-?clause/i, 'Sub-Clause').replace(/^clause/i, 'Clause'), num: m[3], heading });
    }
  });
  const out = [];
  for (let k = 0; k < starts.length; k++) {
    const s = starts[k], n = starts[k + 1];
    const page = pages[s.page - 1];
    const end = n && n.page === s.page ? n.at : page.length;
    const text = page.slice(s.at, Math.min(end, s.at + 2000)).replace(/\s+/g, ' ').trim();
    out.push({ key: s.label, num: s.num, heading: s.heading, page: s.page, text });
  }
  return out;
}

// ---------------------------------------------------------------- rebuild
export async function rebuildIndex(env, pid) {
  await ensureIndexTables(env);
  await env.DB.prepare('DELETE FROM index_entry WHERE project_id = ?').bind(pid).run();
  await env.DB.prepare("DELETE FROM index_link WHERE project_id = ? AND confirmed_by IS NULL").bind(pid).run();
  const entries = [];
  const add = (e) => { if (!e.doc_source) return; entries.push(e); };   // an entry that cannot name its source is not written
  // contract clauses, oldest document first, so a later addendum supersedes
  const docs = ((await safe(() => env.DB.prepare("SELECT id, title, filename, added_at FROM library WHERE project_id = ? AND class = 'contract' ORDER BY added_at, id").bind(pid).all(), { results: [] })).results) || [];
  const byKey = new Map();
  for (const d of docs) {
    if (!/\.pdf$/i.test(d.filename || '')) continue;
    const f = await documentFile(env, pid, d.id);
    if (!f) continue;
    const pages = await pdfPages(f.bytes, { pages: 400 });
    for (const c of clausesFrom(pages)) {
      const e = { id: 'ix_' + pid.slice(-6) + '_' + entries.length, kind: 'clause', key: c.key, heading: c.heading, text: c.text, topics: topicsOf(c.heading + ' ' + c.text),
        doc_source: 'library:' + d.id, doc_title: d.title, page: c.page, quote: c.text.slice(0, 600), occurred_on: String(d.added_at || '').slice(0, 10) };
      const prev = byKey.get(c.key);
      if (prev && prev.doc_source !== e.doc_source) prev.superseded_by = e.id;   // D14: the later one governs; the earlier is kept
      byKey.set(c.key, e);
      add(e);
    }
  }
  // records and correspondence
  const recs = ((await safe(() => env.DB.prepare('SELECT ref, type, title, status, data, created_at, updated_at FROM records WHERE project_id = ? ORDER BY ref').bind(pid).all(), { results: [] })).results) || [];
  for (const r of recs) {
    const data = safeJson(r.data, {});
    const kind = r.type === 'letter' || r.type === 'incoming' ? 'correspondence' : 'record';
    const text = r.title + '. ' + Object.entries(data).filter(([k, v]) => v && String(v).length < 400).map(([k, v]) => k + ': ' + v).join('; ');
    add({ id: 'ix_' + pid.slice(-6) + '_' + entries.length, kind, key: r.ref, heading: r.title, text: text.slice(0, 1500), topics: topicsOf(text),
      doc_source: 'record:' + r.ref, page: null, quote: r.title, occurred_on: String(r.created_at || '').slice(0, 10), type: r.type, status: r.status, data });
    if (r.type === 'cvi') add({ id: 'ix_' + pid.slice(-6) + '_' + entries.length, kind: 'event', key: r.ref, heading: 'Instruction: ' + r.title, text: 'Verbal instruction confirmed in ' + r.ref,
      topics: ['variation'], doc_source: 'record:' + r.ref, page: null, quote: r.title, occurred_on: String(r.created_at || '').slice(0, 10) });
    if (/\bcode\s*A\b|approved/i.test(r.status || '')) add({ id: 'ix_' + pid.slice(-6) + '_' + entries.length, kind: 'event', key: r.ref, heading: 'Approved: ' + r.title,
      text: r.ref + ' ' + r.status, topics: [], doc_source: 'record:' + r.ref, page: null, quote: r.status, occurred_on: String(r.updated_at || r.created_at || '').slice(0, 10) });
  }
  // minutes
  const mins = ((await safe(() => env.DB.prepare("SELECT ref, title, meeting_date, items FROM meetings WHERE project_id = ? AND status = 'issued'").bind(pid).all(), { results: [] })).results) || [];
  for (const m of mins) add({ id: 'ix_' + pid.slice(-6) + '_' + entries.length, kind: 'minute', key: m.ref, heading: m.title, text: String(m.items || '').slice(0, 1500), topics: topicsOf(String(m.items || '')),
    doc_source: 'meeting:' + m.ref, page: null, quote: m.title, occurred_on: m.meeting_date || '' });
  // drawings
  const dwg = ((await safe(() => env.DB.prepare("SELECT number, revision, title, discipline, uploaded_at, approved_at FROM drawings WHERE project_id = ? AND status = 'current'").bind(pid).all(), { results: [] })).results) || [];
  for (const d of dwg) add({ id: 'ix_' + pid.slice(-6) + '_' + entries.length, kind: 'drawing', key: d.number, heading: d.title || '', text: d.number + ' rev ' + (d.revision || '—') + ' ' + (d.title || '') + ' ' + (d.discipline || ''),
    topics: [], doc_source: 'drawing:' + d.number, page: null, quote: d.number + ' rev ' + (d.revision || '—'), occurred_on: String(d.approved_at || d.uploaded_at || '').slice(0, 10) });
  // commercial
  const boq = ((await safe(() => env.DB.prepare('SELECT ref, description, qty, unit, rate, amount FROM boq WHERE project_id = ?').bind(pid).all(), { results: [] })).results) || [];
  for (const l of boq) add({ id: 'ix_' + pid.slice(-6) + '_' + entries.length, kind: 'commercial', key: 'BOQ ' + (l.ref || ''), heading: l.description, text: l.description + ': ' + l.qty + ' ' + (l.unit || '') + ' × ' + l.rate + ' = ' + l.amount,
    topics: ['payment'], doc_source: 'boq:' + (l.ref || ''), page: null, quote: l.description, occurred_on: '' });
  const ipc = ((await safe(() => env.DB.prepare('SELECT ref, period_to, net, stage FROM ipc WHERE project_id = ?').bind(pid).all(), { results: [] })).results) || [];
  for (const c of ipc) add({ id: 'ix_' + pid.slice(-6) + '_' + entries.length, kind: 'commercial', key: c.ref, heading: 'Application ' + c.ref, text: c.ref + ' period to ' + c.period_to + ', net ' + c.net + ', ' + c.stage,
    topics: ['payment'], doc_source: 'ipc:' + c.ref, page: null, quote: c.ref, occurred_on: c.period_to || '' });

  const built = nowISO();
  for (const e of entries) {
    await env.DB.prepare(
      `INSERT INTO index_entry (id, project_id, kind, key, heading, text, topics, doc_source, page, quote, occurred_on, superseded_by, built_at, rules_version, rtype, rstatus)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
    ).bind(e.id, pid, e.kind, str(e.key, 80), str(e.heading, 200), str(e.text, 2000), JSON.stringify(e.topics || []), e.doc_source,
           e.page, str(e.quote, 600), e.occurred_on || null, e.superseded_by || null, built, INDEX_RULES, e.type || null, e.status ? str(e.status, 120) : null).run();
  }
  // stated links: a letter that says what it replies to
  const byRef = new Map(entries.filter((e) => e.kind === 'correspondence' || e.kind === 'record').map((e) => [e.key, e]));
  let links = 0;
  for (const e of entries) {
    const said = e.data && (e.data['In reply to'] || e.data['Reply to'] || e.data['Your ref']);
    for (const ref of String(said || '').split(/[,;\s]+/).filter(Boolean)) {
      const to = byRef.get(ref.trim());
      if (!to) continue;
      await env.DB.prepare('INSERT INTO index_link (id, project_id, from_id, to_id, relation, confidence_basis) VALUES (?,?,?,?,?,?)')
        .bind('il_' + e.id + '_' + to.id, pid, e.id, to.id, 'replies_to', 'stated').run();
      links++;
    }
  }
  return { ok: true, entries: entries.length, clauses: entries.filter((e) => e.kind === 'clause').length, links, built_at: built };
}

export async function searchIndex(env, pid, q, kind) {
  await ensureIndexTables(env);
  const rows = ((kind ? await env.DB.prepare('SELECT * FROM index_entry WHERE project_id = ? AND kind = ?').bind(pid, kind).all()
                      : await env.DB.prepare('SELECT * FROM index_entry WHERE project_id = ?').bind(pid).all()).results) || [];
  const all = rows.map((r) => ({ ...r, topics: safeJson(r.topics, []), type: r.rtype || null, status: r.rstatus || null }));
  if (!q) return all;
  const qw = words(q);
  return all.map((r) => ({ r, s: words(r.key + ' ' + r.heading + ' ' + r.text).filter((w) => qw.includes(w)).length }))
    .filter((x) => x.s).sort((a, b) => b.s - a.s).map((x) => x.r).slice(0, 50);
}

export const linkFor = (src) => {
  const [k, v] = String(src || '').split(':');
  if (k === 'record') return '/api/record/doc?ref=' + encodeURIComponent(v);
  if (k === 'library') return '/api/library/file?id=' + encodeURIComponent(v);
  if (k === 'drawing') return '/drawings?q=' + encodeURIComponent(v);
  if (k === 'meeting') return '/minutes';
  if (k === 'boq') return '/api/register/xlsx?reg=boq';
  if (k === 'ipc') return '/api/ipc/xlsx?ref=' + encodeURIComponent(v);
  return '#';
};

// ---------------------------------------------------------------- check and complete
const MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
function datesIn(text, today) {
  const out = [];
  const re = /\b(\d{1,2})(?:st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?(?:\s+(\d{4}))?\b/gi;
  let m;
  while ((m = re.exec(text))) {
    const y = m[3] ? Number(m[3]) : Number(today.slice(0, 4));
    const d = new Date(Date.UTC(y, MONTHS[m[2].toLowerCase().slice(0, 3)], Number(m[1])));
    if (!isNaN(d)) out.push({ said: m[0], iso: d.toISOString().slice(0, 10), at: m.index });
  }
  const iso = /\b(\d{4})-(\d{2})-(\d{2})\b/g;
  while ((m = iso.exec(text))) out.push({ said: m[0], iso: m[0], at: m.index });
  return out;
}

export async function checkDraft(env, pid, draft, today = todayUAE()) {
  await ensureIndexTables(env);
  const text = String(draft || '');
  const entries = (await searchIndex(env, pid, '')).filter((e) => !e.superseded_by || e.kind !== 'clause');
  const clauses = entries.filter((e) => e.kind === 'clause');
  const recs = entries.filter((e) => e.kind === 'record' || e.kind === 'correspondence');
  const proposals = [];
  let n = 0;
  const push = (p) => proposals.push({ id: 'p' + (++n), ...p });
  const sentenceAt = (at) => { const s = text.lastIndexOf('.', at - 1) + 1; const e = text.indexOf('.', at); return text.slice(s, e < 0 ? text.length : e + 1).trim(); };
  const cite = (e) => ({ kind: e.kind, ref: e.key, link: linkFor(e.doc_source), page: e.page, quote: e.quote });

  // 1. references the draft names: checked, and cited properly
  const named = [...new Set((text.match(/\b[A-Z]{2,5}-\d{1,5}[A-Z]?\b/g) || []))];
  for (const ref of named) {
    const e = recs.find((x) => x.key === ref);
    if (e) push({ kind: 'reference', says: ref, found: e.heading, basis: 'stated', anchor: text.indexOf(ref),
      propose: ref + ' (' + (e.occurred_on ? 'raised ' + e.occurred_on + ', ' : '') + (e.heading || '') + ')', source: cite(e) });
    else push({ kind: 'missing', says: ref, found: null, anchor: text.indexOf(ref), propose: null, flag: 'There is no ' + ref + ' on this project — this reference cannot be checked.' });
  }
  // clauses the draft names: quoted verbatim, or flagged when the contract is indexed and has no such clause
  for (const m of text.matchAll(/\b(Sub-?Clause|Clause)\s+(\d{1,2}(?:\.\d{1,3}){0,3})/gi)) {
    const key = (/^sub/i.test(m[1]) ? 'Sub-Clause ' : 'Clause ') + m[2];
    const e = clauses.find((c) => c.key === key);
    if (e) push({ kind: 'clause', says: m[0], found: e.heading, basis: 'stated', verbatim: true, anchor: m.index,
      propose: key + ' (' + e.heading + '), page ' + e.page + ': “' + e.quote + '”', source: cite(e) });
    else if (clauses.length) push({ kind: 'missing', says: m[0], anchor: m.index, propose: null, flag: key + ' is not in the indexed contract.' });
  }
  // 2. a notice: this contract's notice clause, quoted
  const notice = /(hereby\s+give\s+notice|give\s+(you\s+)?notice|notice\s+is\s+(hereby\s+)?given|we\s+notify\s+you)/i.exec(text);
  if (notice) {
    const proj = await safe(() => env.DB.prepare('SELECT notice_clause FROM projects WHERE id = ?').bind(pid).first(), null);
    const key = proj && proj.notice_clause ? String(proj.notice_clause).replace(/^sub-?clause/i, 'Sub-Clause') : null;
    const e = (key && clauses.find((c) => c.key === key)) || clauses.find((c) => c.topics.includes('notice') && c.topics.includes('claims'));
    if (e && !proposals.some((p) => p.kind === 'clause' && p.source.ref === e.key)) {
      push({ kind: 'clause', says: notice[0], found: e.heading, basis: 'stated', verbatim: true, anchor: notice.index,
        propose: 'Notice is given under ' + e.key + ' (' + e.heading + '), page ' + e.page + ': “' + e.quote + '”', source: cite(e) });
    }
    // 4. the arithmetic, shown and not concluded
    const per = e && /within\s+(\d{1,3})\s+days/i.exec(e.text);
    const d = datesIn(text, today)[0];
    if (per && d) {
      const day = dayDiff(d.iso, today);
      push({ kind: 'arithmetic', says: d.said, basis: 'stated', anchor: d.at, propose: null,
        note: 'The clause gives ' + per[1] + ' days from the event. You have dated the event ' + d.iso + '. Today is ' + today + ' — day ' + day + '.', source: cite(e) });
    }
  }
  // 3. vague references: replaced by checkable ones, or flagged
  const draftWords = words(text);
  for (const m of text.matchAll(/(as\s+previously\s+advised|our\s+(earlier|previous|recent)\s+(correspondence|letter)s?|your\s+(instruction|letter|email)|further\s+to\s+(your|our)\s+\w+)/gi)) {
    const near = sentenceAt(m.index);
    const sw = words(near).length ? words(near) : draftWords;
    const want = /instruction/i.test(m[0]) ? ['cvi', 'incoming'] : ['letter', 'incoming'];
    const cands = recs.filter((r) => want.includes(r.type)).map((r) => ({ r, s: words(r.heading + ' ' + r.text).filter((w) => sw.includes(w)).length }))
      .filter((x) => x.s).sort((a, b) => b.s - a.s).slice(0, 3);
    if (cands.length) for (const c of cands) push({ kind: 'reference', says: m[0], found: c.r.heading, basis: 'inferred', anchor: m.index,
      propose: c.r.key + ' dated ' + (c.r.occurred_on || '—') + ' (' + c.r.heading + ')', note: 'Possibly related — confirm before it goes in.', source: cite(c.r) });
    else push({ kind: 'missing', says: m[0], anchor: m.index, propose: null, flag: 'Which letter? This reference cannot be checked: nothing on the project matches it.' });
  }
  // 5. a claim for cost: the variation and the BOQ items it touches
  if (/(additional\s+cost|extra\s+cost|claim\s+for|cost\s+of\s+the|variation)/i.test(text)) {
    const com = entries.filter((e) => e.kind === 'commercial' || (e.kind === 'record' && e.type === 'variation'))
      .map((e) => ({ e, s: words(e.heading + ' ' + e.text).filter((w) => draftWords.includes(w)).length })).filter((x) => x.s).sort((a, b) => b.s - a.s).slice(0, 3);
    for (const c of com) push({ kind: 'commercial', says: 'cost', found: c.e.heading, basis: 'inferred', anchor: -1, propose: c.e.text, note: 'Figures with their source.', source: cite(c.e) });
  }
  // 6. distribution, where the draft names nobody
  if (!/\b(dear|attention|attn|to:|cc[:\s])/i.test(text)) {
    const proj = await safe(() => env.DB.prepare('SELECT engineer_name, client_name FROM projects WHERE id = ?').bind(pid).first(), null);
    if (proj && (proj.engineer_name || proj.client_name)) push({ kind: 'distribution', says: '', basis: 'stated', anchor: 0,
      propose: 'To: ' + (proj.engineer_name || proj.client_name) + (proj.engineer_name && proj.client_name ? '; cc: ' + proj.client_name : ''), note: 'From the parties set up for this project.', source: { kind: 'project', ref: 'Parties', link: '/parties' } });
  }
  // records on the draft's subject that it does not mention (possibly related)
  if (draftWords.length >= 3) {
    const subj = recs.filter((r) => !named.includes(r.key)).map((r) => ({ r, s: words(r.heading).filter((w) => draftWords.includes(w)).length }))
      .filter((x) => x.s >= 2).sort((a, b) => b.s - a.s).slice(0, 3);
    for (const c of subj) if (!proposals.some((p) => p.source && p.source.ref === c.r.key)) push({ kind: 'reference', says: '', found: c.r.heading, basis: 'inferred', anchor: -1,
      propose: c.r.key + ' (' + (c.r.occurred_on || '—') + ', ' + c.r.heading + (c.r.status ? ', ' + c.r.status : '') + ')', note: 'Possibly related — on the same subject. Confirm before it goes in.', source: cite(c.r) });
  }
  return { proposals, index_entries: entries.length, empty: entries.length === 0,
           note: entries.length ? 'Nothing is added unless you accept it. This does not say the letter is complete, correct or contractually sufficient.'
                                : 'The project index is empty, so nothing is proposed. Build it first.' };
}

// The writer's decisions, recorded with the letter (§29 "What is recorded").
// An edited verbatim quotation is recorded as the writer's paraphrase.
export async function confirmLetter(env, pid, draft, proposals, decisions, finalText, who) {
  await ensureIndexTables(env);
  const byId = new Map((proposals || []).map((p) => [p.id, p]));
  const rec = (decisions || []).map((d) => {
    const p = byId.get(d.id) || {};
    let choice = ['accept', 'edit', 'refuse'].includes(d.choice) ? d.choice : 'refuse';
    let paraphrase = false;
    if (choice === 'edit' && p.verbatim && String(d.text || '') !== String(p.propose || '')) paraphrase = true;
    return { id: d.id, kind: p.kind, source: p.source || null, proposed: p.propose || null, choice, text: choice === 'edit' ? str(d.text, 2000) : null, paraphrase };
  });
  const id = 'lc_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  await env.DB.prepare('INSERT INTO letter_check (id, project_id, draft, proposals, decisions, final_text, confirmed_by, confirmed_at) VALUES (?,?,?,?,?,?,?,?)')
    .bind(id, pid, str(draft, 20000), JSON.stringify(proposals || []), JSON.stringify(rec), str(finalText, 30000), str(who, 120), nowISO()).run();
  return { ok: true, id, accepted: rec.filter((r) => r.choice === 'accept').length, edited: rec.filter((r) => r.choice === 'edit').length,
           refused: rec.filter((r) => r.choice === 'refuse').length, paraphrased: rec.filter((r) => r.paraphrase).length };
}
