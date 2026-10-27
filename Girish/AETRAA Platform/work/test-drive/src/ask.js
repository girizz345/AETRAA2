// A14 — ASK THE PROJECT (approved 5 Oct 2026).
//
// Anyone on the project asks a question; the answer comes from the project's
// own records, with links to the records used.
//
//   · Only what the person may already see: each source belongs to a
//     dashboard, and a source is searched only if the person's roles open that
//     dashboard (and, for records, only the workflows they are on).
//   · Read-only. Nothing is changed, and the answer is not stored.
//   · Daily limit: the PM 30 questions, everyone else 20.
//   · Every question is logged with its cost.
//
// The records are found by rules (shared words with the question). The AI —
// when one is configured — only writes the answer from those records and may
// cite only their references; with AI off the matching records are listed.

import { levelFor, userFunctions, onStream } from './functions.js';
import { words } from './knowledge.js';
import { liveSections } from './spec-index.js';
import { listDrawings } from './drawings.js';
import { addColumns } from './db-cols.js';

const nowISO = () => new Date().toISOString();
const uid = () => 'ask_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const safe = async (fn, f) => { try { return await fn(); } catch (e) { return f; } };
const safeJson = (s, f) => { try { const v = JSON.parse(s || ''); return v == null ? f : v; } catch (e) { return f; } };
export const LIMIT = { pm: 30, other: 20 };

// Which dashboard each record type is seen on.
const TYPE_DASH = {
  submittal: 'design', ms: 'design', material: 'design', rfi: 'design', authority: 'design', cvi: 'design',
  letter: 'dc', incoming: 'dc', variation: 'commercial', ipc: 'commercial', mr: 'procurement',
  wir: 'qaqc', mir: 'qaqc', ncr: 'qaqc', ptw: 'hse', obs: 'hse', incident: 'hse', cert: 'hse',
};
export function maySee(user, dash, isAdmin) {
  if (isAdmin) return true;
  if (!user) return false;
  if (levelFor(user, dash)) return true;
  // Site and QA/QC work from inspections; Planning reads the site dashboard.
  if (dash === 'qaqc' && levelFor(user, 'site')) return true;
  return false;
}

let ready = false;
async function ensureAskTable(env) {
  if (ready) return;
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS ask_log (id TEXT PRIMARY KEY, project_id TEXT, user_id TEXT, who TEXT, question TEXT,
       sources INTEGER, ai INTEGER, cost_usd REAL, created_at TEXT)`
  ).run();
  // The assistant (assistant.js): what became of each message, and the tokens
  // it cost — a pay-per-use bill is built from these.
  await addColumns(env, 'ask_log', [['outcome', 'TEXT'], ['input_tokens', 'INTEGER'], ['output_tokens', 'INTEGER'], ['task', 'TEXT']]);
  ready = true;
}

const todayUAE = () => new Date(Date.now() + 4 * 3600000).toISOString().slice(0, 10);
export async function usedToday(env, pid, userKey) {
  await ensureAskTable(env);
  const since = new Date(Date.parse(todayUAE() + 'T00:00:00Z') - 4 * 3600000).toISOString();
  // A greeting to the assistant ("hi", "thanks") is logged but is not a question.
  const r = await env.DB.prepare("SELECT COUNT(*) AS n FROM ask_log WHERE project_id = ? AND user_id = ? AND created_at >= ? AND (outcome IS NULL OR outcome <> 'small-talk')").bind(pid, userKey, since).first();
  return Number(r && r.n) || 0;
}
export const limitFor = (user, isAdmin) => (isAdmin || (user && userFunctions(user).includes('pm')) ? LIMIT.pm : LIMIT.other);

// Everything the person may see that shares words with the question, best first.
// A plural matches its singular ("submittals" finds a submittal, "RFIs" an RFI).
const one = (w) => (w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w);
// words() keeps four letters and up; these shorter ones mean something here.
const SHORT = new Set(['rfi', 'wir', 'mir', 'ncr', 'ipc', 'boq', 'bom', 'ptw', 'eot', 'itp', 'noc', 'grn', 'lpo', 'mep', 'ifc', 'hse', 'cvi']);
const terms = (text) => [...new Set(words(text).map(one)
  .concat(String(text || '').toLowerCase().split(/[^a-z0-9]+/).map(one).filter((w) => SHORT.has(w))))];
// What each record type is called, so "which submittals…" finds them by type
// as well as by what they say.
const TYPE_WORDS = {
  submittal: 'submittal', ms: 'method statement', material: 'material submittal approval', rfi: 'rfi request information',
  authority: 'authority approval noc', cvi: 'confirmation verbal instruction', letter: 'letter outgoing correspondence',
  incoming: 'letter incoming correspondence', variation: 'variation', ipc: 'ipc payment application certificate',
  mr: 'material request', wir: 'wir inspection request work', mir: 'mir material inspection request', ncr: 'ncr non-conformance',
  ptw: 'permit work', obs: 'observation safety', incident: 'incident accident near-miss', cert: 'certificate',
};
// …and what the record is, said at the start of its text for the model.
const TYPE_LABEL = {
  submittal: 'Submittal', ms: 'Method statement', material: 'Material submittal', rfi: 'RFI', authority: 'Authority approval',
  cvi: 'CVI', letter: 'Outgoing letter', incoming: 'Incoming letter', variation: 'Variation', ipc: 'Payment application (IPC)',
  mr: 'Material request', wir: 'Work inspection request (WIR)', mir: 'Material inspection request (MIR)', ncr: 'NCR',
  ptw: 'Permit to work', obs: 'HSE observation', incident: 'Incident', cert: 'Certificate',
};
export async function findSources(env, pid, user, isAdmin, question) {
  const qw = terms(question);
  const refsInQ = (String(question).toUpperCase().match(/\b[A-Z]{2,5}-?\d{1,5}[A-Z]?\b/g) || []);
  const out = [];
  const score = (text, ref) => {
    const w = terms(text);
    let n = qw.filter((x) => w.includes(x)).length;
    if (ref && refsInQ.some((r) => r.replace('-', '') === String(ref).toUpperCase().replace(/[-\s]/g, ''))) n += 5;
    return n;
  };
  // records
  const recs = ((await safe(() => env.DB.prepare('SELECT ref, type, title, status, data, due, created_at FROM records WHERE project_id = ?').bind(pid).all(), { results: [] })).results) || [];
  for (const r of recs) {
    const dash = TYPE_DASH[r.type];
    if (!dash || !maySee(user, dash, isAdmin) || (!isAdmin && user && !onStream(user, r.type))) continue;
    const data = safeJson(r.data, {});
    const text = r.ref + ' ' + (TYPE_WORDS[r.type] || r.type) + ' ' + r.title + ' ' + r.status + ' ' + Object.values(data).join(' ');
    const s = score(text, r.ref);
    if (s) out.push({ kind: 'record', ref: r.ref, label: r.ref + ' · ' + r.title, score: s, link: '/api/record/doc?ref=' + encodeURIComponent(r.ref),
      text: ((TYPE_LABEL[r.type] ? TYPE_LABEL[r.type] + ': ' : '') + r.title + ' — status: ' + (r.status || '') + (r.due ? ', due ' + r.due : '') + '. ' + Object.entries(data).map(([k, v]) => k + ': ' + v).join('; ')).slice(0, 700) });
  }
  // the knowledge base
  if (maySee(user, 'design', isAdmin) || maySee(user, 'qaqc', isAdmin)) {
    for (const s of (await safe(() => liveSections(env, pid), [])) || []) {
      const reqs = Object.entries(s.requirements || {}).flatMap(([k, v]) => v.map((h) => k + ' (p.' + h.page + '): ' + h.sentence));
      const sc = score(s.code + ' ' + s.title + ' ' + (s.manufacturers || []).join(' ') + ' ' + reqs.join(' '), s.code.replace(/\s/g, ''));
      if (sc) out.push({ kind: 'spec', ref: s.code, label: 'Spec ' + s.code + ' · ' + s.title, score: sc, link: '/api/spec-sections/file?id=' + encodeURIComponent(s.id),
        text: (s.title + '. Pages ' + s.page_from + '–' + s.page_to + '. Manufacturers: ' + ((s.manufacturers || []).join(', ') || 'none named') + '. ' + reqs.slice(0, 6).join(' ')).slice(0, 900) });
    }
  }
  if (maySee(user, 'design', isAdmin)) {
    for (const d of ((await safe(() => listDrawings(env, pid, {}), [])) || []).filter((x) => x.status === 'current' || x.status === 'awaited')) {
      const sc = score(d.number + ' ' + (d.title || '') + ' ' + (d.discipline || ''), d.number);
      if (sc) out.push({ kind: 'drawing', ref: d.number, label: d.number + (d.revision ? ' rev ' + d.revision : '') + ' · ' + (d.title || ''), score: sc,
        link: '/drawings?q=' + encodeURIComponent(d.number), text: (d.title || '') + ', ' + (d.kind || '') + ', ' + (d.status === 'awaited' ? 'awaited (not received)' : 'current') });
    }
  }
  if (maySee(user, 'commercial', isAdmin)) {
    for (const l of ((await safe(() => env.DB.prepare('SELECT ref, section, description, unit, qty, rate, amount, billed_pct FROM boq WHERE project_id = ?').bind(pid).all(), { results: [] })).results) || []) {
      const sc = score(l.description + ' ' + (l.section || ''), l.ref);
      if (sc) out.push({ kind: 'boq', ref: String(l.ref || ''), label: 'BOQ ' + (l.ref || '') + ' · ' + l.description, score: sc, link: '/api/register/xlsx?reg=boq',
        text: l.description + ': ' + l.qty + ' ' + (l.unit || '') + ' at ' + l.rate + ' = ' + l.amount + ', billed ' + (l.billed_pct || 0) + '%' });
    }
    const p = await safe(() => env.DB.prepare('SELECT * FROM projects WHERE id = ?').bind(pid).first(), null);
    if (p && qw.some((w) => ['retention', 'advance', 'payment', 'notice', 'completion', 'terms', 'contract'].includes(w))) {
      out.push({ kind: 'terms', ref: 'Payment terms', label: 'Contract payment terms', score: 2, link: '/terms',
        text: 'Retention ' + (p.retention_pct ?? '—') + '% (cap ' + (p.retention_limit_pct ?? '—') + '%), advance ' + (p.advance_pct ?? '—') + '%, payment ' + (p.payment_days ?? '—') +
          ' days, notice clause ' + (p.notice_clause || '—') + ', completion ' + (p.contract_finish || '—') + ' (' + (p.terms_state || 'not read from a contract') + ').' });
    }
  }
  if (maySee(user, 'planning', isAdmin) || maySee(user, 'site', isAdmin)) {
    for (const a of ((await safe(() => env.DB.prepare('SELECT id, name, planned_start, planned_finish, status FROM activities WHERE project_id = ? AND COALESCE(level,1) > 0').bind(pid).all(), { results: [] })).results) || []) {
      const sc = score(a.id + ' ' + a.name, a.id);
      if (sc) out.push({ kind: 'activity', ref: a.id, label: a.id + ' · ' + a.name, score: sc, link: '/programme',
        text: a.name + ': planned ' + (a.planned_start || '—') + ' to ' + (a.planned_finish || '—') + ', ' + (a.status || 'not started') });
    }
  }
  return out.sort((a, b) => b.score - a.score || (a.label < b.label ? -1 : 1)).slice(0, 12);
}

//   extra: { outcome, input_tokens, output_tokens, task } — the assistant's.
export async function logQuestion(env, pid, userKey, who, question, sources, ai, cost, extra) {
  await ensureAskTable(env);
  const x = extra || {};
  await env.DB.prepare('INSERT INTO ask_log (id, project_id, user_id, who, question, sources, ai, cost_usd, created_at, outcome, input_tokens, output_tokens, task) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)')
    .bind(uid(), pid, userKey, String(who || '').slice(0, 120), String(question).slice(0, 600), sources, ai ? 1 : 0, cost == null ? null : Number(cost), nowISO(),
      x.outcome || null, x.input_tokens == null ? null : Number(x.input_tokens), x.output_tokens == null ? null : Number(x.output_tokens), x.task || null).run();
}

export const ASK_SYSTEM = 'You answer questions about one construction project using only the numbered sources given. ' +
  'Cite the sources you used by their reference in square brackets, e.g. [RFI-0042]. If the sources do not answer the question, say so plainly. Never invent a figure, date or reference.';
export function askPrompt(question, sources) {
  return 'SOURCES:\n' + sources.map((s) => '[' + s.ref + '] ' + s.label + ' — ' + s.text).join('\n') + '\n\nQUESTION: ' + question;
}
