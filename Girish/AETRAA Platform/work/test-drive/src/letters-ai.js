// A9 — LETTERS AND REPLIES (v5: "later"; built 6 Oct 2026 at Girish's request).
//
//   1  PM / QS presses Draft reply on an incoming letter, or Draft letter. The
//      extraction pulls the clause (the project index, §29) and the references;
//      the AI drafts: subject, references, body, clause cited, enclosures.
//   2  The author edits and completes it — a new revision each completion.
//   3  PM / Director signs, 4  DC issues and logs LTR-00x and closes the
//      incoming letter it answers: the letter record's own workflow, unchanged.
//
// AI must never sign, issue or send. And it must not put words in the
// contract's mouth: any quotation in a draft that is not, character for
// character, in the indexed contract is flagged for the author to remove.
// With AI off, a plain skeleton is drafted from the same facts.

import { searchIndex } from './project-index.js';
import { words } from './knowledge.js';

const nowISO = () => new Date().toISOString();
const uid = () => 'ldr_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const str = (v, n = 300) => String(v == null ? '' : v).slice(0, n);
const safeJson = (s, f) => { try { const v = JSON.parse(s || ''); return v == null ? f : v; } catch (e) { return f; } };
const safe = async (fn, f) => { try { return await fn(); } catch (e) { return f; } };
export const FIELDS = ['Subject', 'References', 'Body', 'Clause cited', 'Enclosures'];

let ready = false;
export async function ensureDraftTable(env) {
  if (ready) return;
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS letter_draft (
       id TEXT PRIMARY KEY, project_id TEXT NOT NULL, thread TEXT, rev INTEGER, incoming_ref TEXT,
       fields TEXT, warnings TEXT, source TEXT, record_ref TEXT, created_by TEXT, created_at TEXT)`
  ).run();
  ready = true;
}

// The facts a letter is drafted from: the incoming letter, the clauses and the
// records on the same subject. Rules only — the same facts every time.
export async function draftContext(env, pid, incomingRef, subject) {
  const inc = incomingRef ? await safe(() => env.DB.prepare("SELECT ref, title, status, data, created_at FROM records WHERE project_id = ? AND ref = ? AND type = 'incoming'").bind(pid, incomingRef).first(), null) : null;
  const topic = [subject || '', inc ? inc.title + ' ' + Object.values(safeJson(inc.data, {})).join(' ') : ''].join(' ');
  const proj = await safe(() => env.DB.prepare('SELECT name, ref, engineer_name, client_name, notice_clause FROM projects WHERE id = ?').bind(pid).first(), {});
  const all = await safe(() => searchIndex(env, pid, ''), []);
  const tw = words(topic);
  const clauses = all.filter((e) => e.kind === 'clause' && !e.superseded_by)
    .map((e) => ({ e, s: words(e.heading + ' ' + e.text).filter((w) => tw.includes(w)).length + (proj && proj.notice_clause && e.key === String(proj.notice_clause).replace(/^sub-?clause/i, 'Sub-Clause') && /notice|delay|claim/i.test(topic) ? 3 : 0) }))
    .filter((x) => x.s).sort((a, b) => b.s - a.s).slice(0, 3).map((x) => x.e);
  const related = all.filter((e) => (e.kind === 'record' || e.kind === 'correspondence') && (!inc || e.key !== inc.ref))
    .map((e) => ({ e, s: words(e.heading + ' ' + e.text).filter((w) => tw.includes(w)).length })).filter((x) => x.s >= 2)
    .sort((a, b) => b.s - a.s).slice(0, 5).map((x) => x.e);
  return { incoming: inc ? { ref: inc.ref, title: inc.title, data: safeJson(inc.data, {}), date: String(inc.created_at || '').slice(0, 10) } : null,
           project: proj || {}, clauses, related, topic: topic.trim() };
}

// A skeleton from the facts alone — what the author gets with AI off.
export function skeleton(ctx, subject) {
  const inc = ctx.incoming;
  return {
    Subject: inc ? 'Re: ' + inc.title : str(subject, 200),
    References: [inc ? inc.ref + ' dated ' + inc.date : '', ...ctx.related.map((r) => r.key + (r.occurred_on ? ' dated ' + r.occurred_on : ''))].filter(Boolean).join('\n'),
    Body: (inc ? 'We refer to your letter ' + inc.ref + ' dated ' + inc.date + '.\n\n' : '') + '[Write the letter here.]',
    'Clause cited': ctx.clauses.map((c) => c.key + ' (' + c.heading + '), page ' + c.page).join('\n'),
    Enclosures: '',
  };
}

export const DRAFT_SYSTEM = 'You draft construction contract correspondence for a contractor. You write a draft for a person to edit; you never sign, issue or send. ' +
  'Use only the facts, references and clause texts given. A clause may only be quoted exactly as given, in quotation marks, with its number and page. ' +
  'Never invent a reference, date, figure or clause. Never state that the contractor is entitled to anything or that a notice is valid.';
export function draftPrompt(ctx, subject, note) {
  return 'Draft a letter as JSON only: {"Subject": "...", "References": "...", "Body": "...", "Clause cited": "...", "Enclosures": "..."}.\n\n' +
    (ctx.incoming ? 'INCOMING LETTER ' + ctx.incoming.ref + ' (' + ctx.incoming.date + '): ' + ctx.incoming.title + '. ' +
      Object.entries(ctx.incoming.data).map(([k, v]) => k + ': ' + v).join('; ') + '\n\n' : '') +
    (subject ? 'SUBJECT: ' + subject + '\n' : '') + (note ? 'WHAT THE AUTHOR WANTS TO SAY: ' + note + '\n' : '') +
    '\nCLAUSES (quote exactly or not at all):\n' + ctx.clauses.map((c) => c.key + ' "' + c.heading + '" page ' + c.page + ': ' + c.text).join('\n') +
    '\n\nRELATED RECORDS:\n' + ctx.related.map((r) => r.key + ' (' + (r.occurred_on || '—') + '): ' + r.heading).join('\n') +
    '\n\nPARTIES: to ' + (ctx.project.engineer_name || 'the Engineer') + (ctx.project.client_name ? ', copy ' + ctx.project.client_name : '');
}

// Quotations the draft attributes to the contract must be in the contract.
export function checkQuotes(fields, clauses) {
  const text = Object.values(fields || {}).join('\n');
  const quotes = [...text.matchAll(/[“"]([^”"]{25,})[”"]/g)].map((m) => m[1].trim());
  const hay = (clauses || []).map((c) => String(c.text).replace(/\s+/g, ' '));
  const out = [];
  for (const q of quotes) {
    const norm = q.replace(/\s+/g, ' ');
    if (!hay.some((h) => h.includes(norm))) out.push('This quotation is not, word for word, in the indexed contract — remove it or quote the clause exactly: “' + q.slice(0, 120) + (q.length > 120 ? '…' : '') + '”');
  }
  // References the draft names that are not on the project.
  return out;
}
export async function checkRefs(env, pid, fields) {
  const text = Object.values(fields || {}).join('\n');
  const refs = [...new Set(text.match(/\b(RFI|LTR|IN|SUB|MS|MAR|NCR|WIR|MIR|VO|VAR|CVI|AUTH)-\d{1,5}\b/g) || [])];
  const out = [];
  for (const r of refs) {
    const hit = await safe(() => env.DB.prepare('SELECT ref FROM records WHERE project_id = ? AND ref = ?').bind(pid, r).first(), null);
    if (!hit) out.push(r + ' is not on this project — check the reference.');
  }
  return out;
}

export async function saveRevision(env, pid, thread, incomingRef, fields, warnings, source, who) {
  await ensureDraftTable(env);
  const t = thread || uid();
  const max = await env.DB.prepare('SELECT COALESCE(MAX(rev), -1) AS n FROM letter_draft WHERE project_id = ? AND thread = ?').bind(pid, t).first();
  const rev = (max && max.n != null ? Number(max.n) : -1) + 1;     // the first is revision 0
  const clean = {};
  for (const k of FIELDS) clean[k] = str((fields || {})[k], k === 'Body' ? 20000 : 2000);
  await env.DB.prepare('INSERT INTO letter_draft (id, project_id, thread, rev, incoming_ref, fields, warnings, source, created_by, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)')
    .bind(uid(), pid, t, rev, incomingRef || null, JSON.stringify(clean), JSON.stringify(warnings || []), source, str(who, 120), nowISO()).run();
  return { thread: t, rev };
}

export async function listThreads(env, pid) {
  await ensureDraftTable(env);
  const rows = (await env.DB.prepare('SELECT * FROM letter_draft WHERE project_id = ? ORDER BY thread, rev').bind(pid).all()).results || [];
  const by = new Map();
  for (const r of rows) by.set(r.thread, { ...r, fields: safeJson(r.fields, {}), warnings: safeJson(r.warnings, []), revisions: ((by.get(r.thread) || {}).revisions || 0) + 1 });
  return [...by.values()].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
}
export async function latest(env, pid, thread) {
  await ensureDraftTable(env);
  const r = await env.DB.prepare('SELECT * FROM letter_draft WHERE project_id = ? AND thread = ? ORDER BY rev DESC LIMIT 1').bind(pid, thread).first();
  return r ? { ...r, fields: safeJson(r.fields, {}), warnings: safeJson(r.warnings, []) } : null;
}
