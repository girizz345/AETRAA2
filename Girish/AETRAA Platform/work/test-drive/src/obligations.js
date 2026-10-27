// A4 — CONTRACT OBLIGATIONS (v5 A4; Ajay, 6 Oct 2026, decision 1: the AI reads
// the whole contract, not only the seven terms).
//
//   1  QS (or AETRAA) presses Find clauses. The extraction program splits the
//      contract by clause (the project index, project-index.js clausesFrom);
//      the AI reads each clause and lists its obligations: the words that
//      state it (quoted), who it binds, what kind it is (notice, time bar,
//      delay, variation, payment, claim, other) and its period.
//   2  QS edits and confirms each line.
//   3  The Principal approves; approved obligations are live — their periods
//      are used for the notice clock (A13) and are there for reply-by clocks.
//
// What the AI must never do (v5 A4): change payment terms or any confirmed
// figure. So a quotation that is not, word for word, in the clause is dropped;
// a period is kept only where its number is in that quotation; a confirmed or
// approved line is never touched by a later run; and nothing here writes to
// the payment terms (G1) or to any project figure.

import { callModel, aiEnabled, AI_OFF_MESSAGE } from './ai.js';
import { searchIndex } from './project-index.js';
import { firstJson } from './ai-readers.js';

const nowISO = () => new Date().toISOString();
const uid = () => 'obl_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const clean = (s, n = 300) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, n);
const safeJson = (s, f) => { try { const v = JSON.parse(s || ''); return v == null ? f : v; } catch (e) { return f; } };
export const KINDS = ['notice', 'time_bar', 'delay', 'variation', 'payment', 'claim', 'other'];
export const BINDS = ['contractor', 'employer', 'engineer', 'both'];
export const OBLIGATIONS_PROMPT = 'a4-1';

let ready = false;
export async function ensureObligations(env) {
  if (ready) return;
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS contract_obligation (
       id TEXT PRIMARY KEY, project_id TEXT NOT NULL, clause_key TEXT, clause_heading TEXT, doc_source TEXT, page INTEGER,
       quote TEXT, binds TEXT, kind TEXT, period_days INTEGER, period_text TEXT, trigger_text TEXT, summary TEXT,
       state TEXT, model TEXT, flags TEXT, confirmed_by TEXT, confirmed_at TEXT, approved_by TEXT, approved_at TEXT,
       created_at TEXT, updated_at TEXT)`
  ).run();
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_obl_p ON contract_obligation(project_id, state)').run();
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS obligation_scan (project_id TEXT NOT NULL, clause_key TEXT NOT NULL, doc_source TEXT NOT NULL, scanned_at TEXT,
       PRIMARY KEY (project_id, clause_key, doc_source))`
  ).run();
  ready = true;
}

const norm = (s) => String(s || '').replace(/[“”"‘’']/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
const NUMWORDS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, fourteen: 14, fifteen: 15, twenty: 20,
  'twenty-one': 21, 'twenty one': 21, 'twenty-eight': 28, 'twenty eight': 28, thirty: 30, forty: 40, 'forty-two': 42, 'forty two': 42, fifty: 50,
  'fifty-six': 56, 'fifty six': 56, sixty: 60, ninety: 90 };
// The number a period quotes — "28 days", "twenty-eight (28) days" — read from
// the quotation itself, never from the AI's figure.
export function periodIn(quote) {
  const q = String(quote || '').toLowerCase();
  const m = q.match(/\b(\d{1,3})\s*\)?\s*(calendar\s+|working\s+)?days?\b/);
  if (m) return Number(m[1]);
  for (const [w, n] of Object.entries(NUMWORDS).sort((a, b) => b[0].length - a[0].length)) if (new RegExp('\\b' + w + '\\s+(calendar\\s+|working\\s+)?days?\\b').test(q)) return n;
  return null;
}

const SYSTEM = 'You read a construction contract clause by clause for a quantity surveyor, who checks every line before it is used. '
  + 'List only obligations the clause itself states. Quote the clause\'s own words exactly, character for character. Never paraphrase a quotation, '
  + 'never invent a period, never state an obligation the words do not contain. Answer with JSON only.';
export function clausePrompt(batch) {
  return 'For each clause below, list its obligations: something a party must do, or must do within a time, or loses if it does not. For each:\n'
    + '- clause: the clause key as given\n'
    + '- quote: the words of the clause that state it, copied exactly (one sentence or less)\n'
    + '- binds: who it binds — contractor, employer, engineer or both\n'
    + '- kind: notice, time_bar, delay, variation, payment, claim or other\n'
    + '- period_days: the number of days it allows, only if the quote states it, else null\n'
    + '- trigger: what starts the period, in a few words, else ""\n'
    + '- summary: the obligation in one short line\n'
    + 'A clause with no obligation gives none. Answer with JSON only: {"obligations":[{"clause":"","quote":"","binds":"","kind":"","period_days":null,"trigger":"","summary":""}]}\n\n'
    + batch.map((c) => '=== ' + c.key + ' — ' + c.heading + ' (page ' + c.page + ')\n' + c.text).join('\n\n');
}

// The AI's lines, checked against the clause they quote.
export function checkLines(lines, byKey) {
  const out = [];
  for (const l of Array.isArray(lines) ? lines : []) {
    const c = byKey.get(clean(l && l.clause, 80));
    if (!c) continue;
    const quote = clean(l.quote, 600);
    const flags = [];
    if (!quote || !norm(c.text).includes(norm(quote))) continue;     // not the clause's own words: dropped
    let days = periodIn(quote);
    if (l.period_days != null && Number(l.period_days) !== days) flags.push(days == null ? 'the AI gave a period of ' + l.period_days + ' days that the quotation does not state — left blank' : 'the AI gave ' + l.period_days + ' days; the quotation states ' + days);
    const kind = KINDS.includes(String(l.kind)) ? String(l.kind) : 'other';
    const binds = BINDS.includes(String(l.binds).toLowerCase()) ? String(l.binds).toLowerCase() : '';
    if (!binds) flags.push('who it binds was not clear — say who');
    out.push({ clause_key: c.key, clause_heading: c.heading, doc_source: c.doc_source, page: c.page, quote, binds, kind, period_days: days,
      period_text: days != null ? days + ' days' : '', trigger_text: clean(l.trigger, 200), summary: clean(l.summary, 300), flags });
  }
  return out;
}

// Step 1: a few clauses at a time, so a long contract is read in steps and the
// page shows progress. A clause read before is not read again.
export async function findObligations(env, pid, opts = {}) {
  await ensureObligations(env);
  if (!aiEnabled(env)) return { error: AI_OFF_MESSAGE, disabled: true };
  const clauses = ((await searchIndex(env, pid, '', 'clause')) || []).filter((c) => !c.superseded_by && String(c.doc_source || '').startsWith('library:'));
  if (!clauses.length) return { error: 'No contract clauses are indexed on this project yet. File the contract (PDF) in the library and rebuild the project index first.' };
  const done = new Set((((await env.DB.prepare('SELECT clause_key, doc_source FROM obligation_scan WHERE project_id = ?').bind(pid).all()).results) || []).map((r) => r.clause_key + '|' + r.doc_source));
  const todo = clauses.filter((c) => !done.has(c.key + '|' + c.doc_source));
  const n = Math.max(1, Math.min(Number(opts.clauses) || 12, 30));
  const batch = todo.slice(0, n);
  if (!batch.length) return { ok: true, added: 0, read: 0, remaining: 0, total: clauses.length };
  const ans = await callModel(env, { task: 'a4-obligations', system: SYSTEM, prompt: clausePrompt(batch), max_tokens: 6000, temperature: 0, project_id: pid, who: opts.who || '' });
  if (ans.error) return { error: ans.error, disabled: !!ans.disabled };
  const j = firstJson(ans.text);
  if (!j || !Array.isArray(j.obligations)) return { error: 'The model’s answer could not be read — nothing was changed; try again.' };
  const byKey = new Map(batch.map((c) => [c.key, c]));
  const lines = checkLines(j.obligations, byKey);
  const at = nowISO();
  for (const l of lines) {
    // The same words of the same clause, already listed (in any state), are not listed twice.
    const same = await env.DB.prepare('SELECT id FROM contract_obligation WHERE project_id = ? AND clause_key = ? AND doc_source = ? AND quote = ?').bind(pid, l.clause_key, l.doc_source, l.quote).first();
    if (same) continue;
    await env.DB.prepare(`INSERT INTO contract_obligation (id, project_id, clause_key, clause_heading, doc_source, page, quote, binds, kind, period_days, period_text, trigger_text, summary,
        state, model, flags, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .bind(uid(), pid, l.clause_key, clean(l.clause_heading, 200), l.doc_source, l.page, l.quote, l.binds, l.kind, l.period_days, l.period_text, l.trigger_text, l.summary,
        'proposed', ans.model || '', JSON.stringify(l.flags), at, at).run();
  }
  for (const c of batch) await env.DB.prepare('INSERT INTO obligation_scan (project_id, clause_key, doc_source, scanned_at) VALUES (?,?,?,?) ON CONFLICT (project_id, clause_key, doc_source) DO NOTHING').bind(pid, c.key, c.doc_source, at).run();
  const dropped = (j.obligations || []).length - lines.length;
  return { ok: true, read: batch.length, added: lines.length, dropped, remaining: todo.length - batch.length, total: clauses.length, model: ans.model };
}

export async function listObligations(env, pid) {
  await ensureObligations(env);
  const rows = ((await env.DB.prepare('SELECT * FROM contract_obligation WHERE project_id = ? ORDER BY clause_key, created_at').bind(pid).all()).results) || [];
  return rows.map((r) => ({ ...r, flags: safeJson(r.flags, []) }));
}

// Step 2: QS's edit and confirmation of one line, or its rejection. A period
// QS types is theirs; a quotation is never edited (it is the contract's words).
export async function confirmObligation(env, pid, b, who) {
  await ensureObligations(env);
  const r = await env.DB.prepare('SELECT * FROM contract_obligation WHERE project_id = ? AND id = ?').bind(pid, clean(b.id, 60)).first();
  if (!r) return { error: 'no such obligation on this project', status: 404 };
  if (r.state === 'approved') return { error: 'That obligation is approved; it is not changed. A new contract document supersedes it.', status: 400 };
  const at = nowISO();
  if (b.reject) {
    await env.DB.prepare("UPDATE contract_obligation SET state = 'rejected', confirmed_by = ?, confirmed_at = ?, updated_at = ? WHERE project_id = ? AND id = ?").bind(clean(who, 120), at, at, pid, r.id).run();
    return { ok: true, state: 'rejected' };
  }
  const binds = BINDS.includes(String(b.binds || r.binds)) ? String(b.binds || r.binds) : '';
  if (!binds) return { error: 'Say who it binds.', status: 400 };
  const kind = KINDS.includes(String(b.kind || r.kind)) ? String(b.kind || r.kind) : 'other';
  let days = b.period_days === '' || b.period_days === null ? null : b.period_days !== undefined ? Number(b.period_days) : r.period_days;
  if (days != null && (!Number.isInteger(days) || days < 0 || days > 3650)) return { error: 'The period is a whole number of days.', status: 400 };
  await env.DB.prepare(`UPDATE contract_obligation SET binds = ?, kind = ?, period_days = ?, period_text = ?, trigger_text = ?, summary = ?, state = 'confirmed',
      confirmed_by = ?, confirmed_at = ?, updated_at = ? WHERE project_id = ? AND id = ?`)
    .bind(binds, kind, days, days != null ? days + ' days' : '', clean(b.trigger_text !== undefined ? b.trigger_text : r.trigger_text, 200),
      clean(b.summary !== undefined ? b.summary : r.summary, 300), clean(who, 120), at, at, pid, r.id).run();
  return { ok: true, state: 'confirmed' };
}

// Step 3: the Principal approves every confirmed line; from then on they are live.
export async function approveObligations(env, pid, who) {
  await ensureObligations(env);
  const at = nowISO();
  const n = await env.DB.prepare("SELECT COUNT(*) AS n FROM contract_obligation WHERE project_id = ? AND state = 'confirmed'").bind(pid).first();
  if (!Number(n && n.n)) return { error: 'Nothing is confirmed yet — QS confirms each line first.', status: 400 };
  await env.DB.prepare("UPDATE contract_obligation SET state = 'approved', approved_by = ?, approved_at = ?, updated_at = ? WHERE project_id = ? AND state = 'confirmed'").bind(clean(who, 120), at, at, pid).run();
  const left = await env.DB.prepare("SELECT COUNT(*) AS n FROM contract_obligation WHERE project_id = ? AND state = 'proposed'").bind(pid).first();
  return { ok: true, approved: Number(n.n), still_proposed: Number(left && left.n) || 0 };
}

// For A13 and the reply-by clocks: the approved obligation of a kind that binds
// the contractor, with a period — the notice of a delay or a claim first.
export async function livePeriod(env, pid, kinds) {
  try {
    await ensureObligations(env);
    const list = ((await env.DB.prepare("SELECT * FROM contract_obligation WHERE project_id = ? AND state = 'approved' AND period_days IS NOT NULL").bind(pid).all()).results) || [];
    for (const k of kinds) {
      const hit = list.find((o) => o.kind === k && (o.binds === 'contractor' || o.binds === 'both'));
      if (hit) return hit;
    }
  } catch (e) { /* none */ }
  return null;
}
