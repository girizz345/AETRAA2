// THE CONTRACT TERMS: WHAT THE CONTRACT SAID, WHO ACCEPTED IT, WHO APPROVED IT.
//
// E9 step 3 (approved 5 Oct 2026): the Principal approves the payment terms
// before they are used. Terms applied from a contract are therefore "pending"
// until the Principal approves them, and no application for payment is raised
// on pending terms — every certificate for the life of the job is computed
// from these figures.
//
// Spec §14: every proposal is kept with its evidence — the value, the clause,
// the page, the sentence, and the person who accepted it — and so is every
// proposal that was corrected or refused. "Why is retention 5% and not 10%?"
// is then answered by a clause, a sentence and a name.

import { addColumns } from './db-cols.js';

const nowISO = () => new Date().toISOString();
const uid = () => 'tev_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const str = (v, n = 300) => String(v == null ? '' : v).slice(0, n);

let ready = false;
export async function ensureTermsTables(env) {
  if (ready) return true;
  try {
    await addColumns(env, 'projects', [
      ['terms_state', 'TEXT'], ['terms_applied_by', 'TEXT'], ['terms_applied_at', 'TEXT'],
      ['terms_approved_by', 'TEXT'], ['terms_approved_at', 'TEXT'],
    ]);
    await env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS term_evidence (
         id TEXT PRIMARY KEY, project_id TEXT NOT NULL, org_id TEXT, batch_id TEXT,
         term TEXT, state TEXT, proposed TEXT, value TEXT, clause TEXT, page INTEGER,
         sentence TEXT, options TEXT, decided_by TEXT, decided_at TEXT)`
    ).run();
    await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_term_evidence_p ON term_evidence(project_id, term)').run();
    ready = true;
    return true;
  } catch (e) { return false; }
}

// One row per proposal shown to the person, whatever they did with it.
export async function recordEvidence(env, proj, rows, who, batchId) {
  await ensureTermsTables(env);
  let n = 0;
  for (const r of rows || []) {
    try {
      await env.DB.prepare(
        `INSERT INTO term_evidence (id, project_id, org_id, batch_id, term, state, proposed, value, clause, page,
           sentence, options, decided_by, decided_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
      ).bind(uid(), proj.id, proj.org_id || null, str(batchId, 60) || null, str(r.key, 40), str(r.state, 20),
             r.proposed == null ? null : str(r.proposed, 120), r.value == null ? null : str(r.value, 120),
             r.clause ? str(r.clause, 60) : null, Number.isFinite(Number(r.page)) && r.page ? Number(r.page) : null,
             r.sentence ? str(r.sentence, 600) : null, JSON.stringify(r.options || []),
             str(who, 120), nowISO()).run();
      n++;
    } catch (e) { /* one lost row must not cost the rest */ }
  }
  return n;
}

// Terms were changed from a contract: they wait for the Principal.
export async function markPending(env, pid, who) {
  await ensureTermsTables(env);
  await env.DB.prepare(
    `UPDATE projects SET terms_state = 'pending', terms_applied_by = ?, terms_applied_at = ?,
       terms_approved_by = NULL, terms_approved_at = NULL WHERE id = ?`
  ).bind(str(who, 120), nowISO(), pid).run();
}

export async function approveTerms(env, pid, who) {
  await ensureTermsTables(env);
  const p = await env.DB.prepare('SELECT terms_state FROM projects WHERE id = ?').bind(pid).first();
  if (!p) return { error: 'no such project' };
  if (p.terms_state !== 'pending') return { ok: true, already: true, state: p.terms_state || 'none' };
  await env.DB.prepare(
    "UPDATE projects SET terms_state = 'approved', terms_approved_by = ?, terms_approved_at = ? WHERE id = ?"
  ).bind(str(who, 120), nowISO(), pid).run();
  return { ok: true, state: 'approved' };
}

// The current position, and the evidence behind each term (latest first).
export async function termsStatus(env, pid) {
  await ensureTermsTables(env);
  const p = await env.DB.prepare(
    `SELECT terms_state, terms_applied_by, terms_applied_at, terms_approved_by, terms_approved_at,
            retention_pct, retention_limit_pct, advance_pct, payment_days, reply_days, notice_clause, contract_finish
       FROM projects WHERE id = ?`
  ).bind(pid).first();
  if (!p) return null;
  let evidence = [];
  try {
    const { results } = await env.DB.prepare(
      'SELECT * FROM term_evidence WHERE project_id = ? ORDER BY decided_at DESC'
    ).bind(pid).all();
    evidence = (results || []).map((r) => ({ ...r, options: safeJson(r.options, []) }));
  } catch (e) { evidence = []; }
  return {
    state: p.terms_state || 'none',
    applied_by: p.terms_applied_by || null, applied_at: p.terms_applied_at || null,
    approved_by: p.terms_approved_by || null, approved_at: p.terms_approved_at || null,
    values: {
      retention_pct: p.retention_pct, retention_cap_pct: p.retention_limit_pct, advance_pct: p.advance_pct,
      payment_days: p.payment_days, rfi_reply_days: p.reply_days, notice_clause: p.notice_clause,
      completion_date: p.contract_finish,
    },
    evidence,
  };
}

export const PENDING_MESSAGE = 'The payment terms read from the contract are waiting for the Principal’s approval. ' +
  'An application for payment cannot be raised on them until the Principal approves them.';

function safeJson(s, f) { try { const v = JSON.parse(s || ''); return v == null ? f : v; } catch (e) { return f; } }
