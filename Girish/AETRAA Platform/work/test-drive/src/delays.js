// A13 — DELAY AND EOT (v5: "not now"; built 6 Oct 2026 at Girish's request).
//
//   1  The platform flags a slip past the finish, or an issue marked as delay,
//      with its time-bar date.
//   2  Planning presses Prepare delay notice: the slip, its effect through the
//      logic, and the linked records are collected; the AI drafts the notice
//      and the EOT narrative.
//   3  Planning / PM edit and complete, 4  the Director signs, 5  DC issues it
//      to the consultant before the time bar; the register is updated.
//
// Register: event, notice date, time-bar date, days claimed, status.
//
// AI must never claim time or money, sign or send. The days claimed are a
// person's figure. Date arithmetic is shown — "the clause gives 28 days; the
// event is dated 3 March; today is day 41" — and never concluded: the
// platform does not say a notice is late, valid or time-barred.

import { livePeriod } from './obligations.js';
import { searchIndex } from './project-index.js';

const nowISO = () => new Date().toISOString();
const uid = () => 'dly_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const str = (v, n = 300) => String(v == null ? '' : v).slice(0, n);
const safe = async (fn, f) => { try { return await fn(); } catch (e) { return f; } };
const day10 = (v) => (v ? String(v).slice(0, 10) : null);
const addDays = (iso, n) => new Date(Date.parse(iso + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);
const dayDiff = (a, b) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000);
export const todayUAE = () => new Date(Date.now() + 4 * 3600000).toISOString().slice(0, 10);
export const STATES = ['flagged', 'drafting', 'completed', 'signed', 'issued', 'closed'];

let ready = false;
export async function ensureDelayTable(env) {
  if (ready) return;
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS delay_event (
       id TEXT PRIMARY KEY, project_id TEXT NOT NULL, source TEXT, ref TEXT, description TEXT, event_date TEXT,
       slip_days INTEGER, effect TEXT, notice_days INTEGER, notice_basis TEXT, time_bar_date TEXT,
       notice_draft TEXT, eot_narrative TEXT, days_claimed INTEGER, status TEXT, letter_ref TEXT, notice_date TEXT,
       signed_by TEXT, signed_at TEXT, completed_by TEXT, completed_at TEXT, created_at TEXT, updated_at TEXT)`
  ).run();
  ready = true;
}

// The notice period, from the contract as indexed: the project's notice clause,
// or a notice/claims clause, "within N days". None found means none assumed.
export async function noticePeriod(env, pid) {
  // A4 (decision 1): an approved obligation's period governs where there is one —
  // the notice of a delay or claim, a time bar — read from its own quotation.
  const ob = await livePeriod(env, pid, ['notice', 'time_bar', 'claim', 'delay']);
  if (ob) return { days: Number(ob.period_days), basis: ob.clause_key + ', page ' + (ob.page || '—') + ': “' + String(ob.quote).slice(0, 160) + '” (approved obligation)', clause: { key: ob.clause_key, page: ob.page }, obligation: ob.id };
  const proj = await safe(() => env.DB.prepare('SELECT notice_clause FROM projects WHERE id = ?').bind(pid).first(), null);
  const clauses = ((await safe(() => searchIndex(env, pid, '', 'clause'), [])) || []).filter((c) => !c.superseded_by);
  const key = proj && proj.notice_clause ? String(proj.notice_clause).replace(/^sub-?clause/i, 'Sub-Clause') : null;
  const pick = (key && clauses.find((c) => c.key === key)) || clauses.find((c) => c.topics.includes('notice') && (c.topics.includes('claims') || c.topics.includes('delay')));
  const m = pick && /within\s+(\d{1,3})\s+days/i.exec(pick.text);
  return m ? { days: Number(m[1]), basis: pick.key + ', page ' + pick.page + ': “' + pick.text.slice(Math.max(0, m.index - 80), m.index + 60).trim() + '”', clause: pick }
           : { days: null, basis: 'no notice period was found in the indexed contract — the time bar cannot be dated until it is', clause: pick || null };
}

// Step 1: what has slipped. A critical activity whose latest forecast finish
// (from the last P6 update) is after its baseline finish; the project's
// forecast completion after the contract completion; an issue with delay days.
export async function scanDelays(env, pid) {
  await ensureDelayTable(env);
  const np = await noticePeriod(env, pid);
  const acts = ((await safe(() => env.DB.prepare(
    'SELECT id, name, planned_finish, p6_early_finish, p6_total_float, actual_finish FROM activities WHERE project_id = ? AND COALESCE(level,1) > 0'
  ).bind(pid).all(), { results: [] })).results) || [];
  const links = ((await safe(() => env.DB.prepare('SELECT from_id, to_id FROM links WHERE project_id = ?').bind(pid).all(), { results: [] })).results) || [];
  const succ = new Map();
  for (const l of links) { if (!succ.has(l.from_id)) succ.set(l.from_id, []); succ.get(l.from_id).push(l.to_id); }
  const downstream = (id) => { const seen = new Set(), q = [id]; while (q.length && seen.size < 500) { const x = q.shift(); for (const y of succ.get(x) || []) if (!seen.has(y)) { seen.add(y); q.push(y); } } return [...seen]; };
  const found = [];
  for (const a of acts) {
    const base = day10(a.planned_finish), fc = day10(a.actual_finish || a.p6_early_finish);
    if (!base || !fc) continue;
    const slip = dayDiff(base, fc);
    if (slip > 0 && (a.p6_total_float == null || Number(a.p6_total_float) <= 0)) {
      const ds = downstream(a.id);
      found.push({ source: 'programme', ref: a.id, description: a.id + ' ' + a.name + ' forecast to finish ' + slip + ' days after its baseline (' + base + ' → ' + fc + ')',
        event_date: base, slip_days: slip, effect: ds.length + ' activities follow it in the logic' + (ds.length ? ': ' + ds.slice(0, 8).join(', ') + (ds.length > 8 ? '…' : '') : '') });
    }
  }
  const proj = await safe(() => env.DB.prepare('SELECT contract_finish FROM projects WHERE id = ?').bind(pid).first(), null);
  const cf = day10(proj && proj.contract_finish);
  const latest = acts.map((a) => day10(a.p6_early_finish)).filter(Boolean).sort().pop();
  if (cf && latest && latest > cf) found.push({ source: 'completion', ref: 'COMPLETION', description: 'Forecast completion ' + latest + ' is ' + dayDiff(cf, latest) + ' days after the contract completion date ' + cf,
    event_date: cf, slip_days: dayDiff(cf, latest), effect: 'the completion date' });
  const iss = ((await safe(() => env.DB.prepare("SELECT ref, title, raised_date, impact_days, activity_id FROM issues WHERE project_id = ? AND COALESCE(impact_days,0) > 0 AND COALESCE(status,'') NOT IN ('withdrawn')").bind(pid).all(), { results: [] })).results) || [];
  for (const i of iss) found.push({ source: 'issue', ref: i.ref, description: i.ref + ' ' + i.title + ' — marked as delay (' + i.impact_days + ' days)' + (i.activity_id ? ' on ' + i.activity_id : ''),
    event_date: day10(i.raised_date), slip_days: Math.round(Number(i.impact_days) || 0), effect: i.activity_id ? 'activity ' + i.activity_id : '' });
  let added = 0;
  for (const f of found) {
    const have = await env.DB.prepare('SELECT id, status FROM delay_event WHERE project_id = ? AND source = ? AND ref = ?').bind(pid, f.source, f.ref).first();
    const bar = f.event_date && np.days ? addDays(f.event_date, np.days) : null;
    if (have) {
      // Keep a flag up to date until somebody starts on it; never rewrite one in hand.
      if (have.status === 'flagged') await env.DB.prepare('UPDATE delay_event SET description = ?, slip_days = ?, effect = ?, notice_days = ?, notice_basis = ?, time_bar_date = ?, updated_at = ? WHERE id = ?')
        .bind(str(f.description, 400), f.slip_days, str(f.effect, 400), np.days, str(np.basis, 600), bar, nowISO(), have.id).run();
      continue;
    }
    await env.DB.prepare(
      `INSERT INTO delay_event (id, project_id, source, ref, description, event_date, slip_days, effect, notice_days, notice_basis, time_bar_date, status, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
    ).bind(uid(), pid, f.source, f.ref, str(f.description, 400), f.event_date, f.slip_days, str(f.effect, 400), np.days, str(np.basis, 600), bar, 'flagged', nowISO(), nowISO()).run();
    added++;
  }
  return { ok: true, found: found.length, added, notice_days: np.days };
}

// The arithmetic, shown and never concluded.
export function clockNote(ev, today = todayUAE()) {
  if (!ev.event_date) return 'The event has no date yet.';
  if (!ev.notice_days) return 'The event is dated ' + ev.event_date + '. ' + (ev.notice_basis || 'No notice period was found in the contract.');
  return 'The clause gives ' + ev.notice_days + ' days from the event. The event is dated ' + ev.event_date + '. Today is ' + today + ' — day ' + dayDiff(ev.event_date, today) +
    '. The notice period ends ' + ev.time_bar_date + '.';
}

export async function listDelays(env, pid) {
  await ensureDelayTable(env);
  const rows = (await env.DB.prepare('SELECT * FROM delay_event WHERE project_id = ? ORDER BY COALESCE(time_bar_date, event_date), ref').bind(pid).all()).results || [];
  return rows.map((r) => ({ ...r, clock: clockNote(r) }));
}
export async function getDelay(env, pid, id) {
  await ensureDelayTable(env);
  const r = await env.DB.prepare('SELECT * FROM delay_event WHERE project_id = ? AND id = ?').bind(pid, String(id)).first();
  return r ? { ...r, clock: clockNote(r) } : null;
}

// Step 2: what the draft is made from.
export async function delayContext(env, pid, ev) {
  const np = await noticePeriod(env, pid);
  const words = String(ev.description || '').toLowerCase().replace(/[^a-z0-9 -]/g, ' ').split(/\s+/).filter((w) => w.length >= 4);
  const recs = ((await safe(() => env.DB.prepare("SELECT ref, type, title, status, created_at FROM records WHERE project_id = ? AND type IN ('rfi','letter','incoming','cvi','variation','ncr')").bind(pid).all(), { results: [] })).results) || [];
  const linked = recs.map((r) => ({ r, s: words.filter((w) => String(r.title).toLowerCase().includes(w)).length + (String(r.title).includes(ev.ref) ? 3 : 0) }))
    .filter((x) => x.s >= 1).sort((a, b) => b.s - a.s).slice(0, 6).map((x) => x.r);
  return { notice: np, linked };
}

export function skeletonNotice(ev, ctx, project) {
  const clause = ctx.notice.clause;
  return {
    notice: 'To: ' + ((project && project.engineer_name) || 'the Engineer') + '\n\nSubject: Notice — ' + ev.description + '\n\n' +
      'We give notice of the following event: ' + ev.description + ', first dated ' + (ev.event_date || '[date]') + '.' +
      (clause ? '\n\nThis notice is given under ' + clause.key + ' (' + clause.heading + ').' : '') +
      (ctx.linked.length ? '\n\nReferences: ' + ctx.linked.map((r) => r.ref + ' (' + String(r.created_at || '').slice(0, 10) + ')').join(', ') + '.' : '') +
      '\n\n[Describe the effect and what is reserved.]',
    narrative: 'Event: ' + ev.description + '.\nEffect through the programme: ' + (ev.effect || '—') + '.\nRecords: ' +
      (ctx.linked.map((r) => r.ref + ' ' + r.title).join('; ') || 'none found') + '.\n[Cause, effect and the extension sought — the days are the planner’s figure.]',
  };
}

export const DELAY_SYSTEM = 'You draft a contractor\'s delay notice and extension-of-time narrative for a planner to edit. You never claim time or money, never state a number of days claimed, ' +
  'never sign or send, and never say a notice is valid, late or time-barred. Use only the facts and records given; quote a clause only exactly as given.';
export function delayPrompt(ev, ctx, project) {
  return 'Answer as JSON only: {"notice": "...", "narrative": "..."}.\n\nEVENT: ' + ev.description + '\nFIRST DATED: ' + (ev.event_date || '—') +
    '\nEFFECT THROUGH THE LOGIC: ' + (ev.effect || '—') + '\nNOTICE CLAUSE: ' + (ctx.notice.clause ? ctx.notice.clause.key + ' "' + ctx.notice.clause.heading + '": ' + ctx.notice.clause.text : 'none indexed') +
    '\nRECORDS: ' + ctx.linked.map((r) => r.ref + ' (' + String(r.created_at || '').slice(0, 10) + ', ' + r.status + '): ' + r.title).join('; ') +
    '\nADDRESSEE: ' + ((project && project.engineer_name) || 'the Engineer');
}

// Steps 3-5.
export async function saveDraft(env, pid, id, body, who) {
  const ev = await getDelay(env, pid, id);
  if (!ev) return { error: 'no such delay event' };
  if (['signed', 'issued', 'closed'].includes(ev.status)) return { error: 'this notice is ' + ev.status + ' and can no longer be edited' };
  const claimed = body.days_claimed === '' || body.days_claimed == null ? null : Math.round(Number(body.days_claimed));
  if (claimed != null && (!Number.isFinite(claimed) || claimed < 0 || claimed > 3650)) return { error: 'days claimed is a number of days' };
  const complete = !!body.complete;
  await env.DB.prepare(`UPDATE delay_event SET notice_draft = ?, eot_narrative = ?, days_claimed = ?, status = ?, completed_by = ?, completed_at = ?, updated_at = ? WHERE id = ?`)
    .bind(str(body.notice, 20000), str(body.narrative, 30000), claimed, complete ? 'completed' : 'drafting', complete ? str(who, 120) : null, complete ? nowISO() : null, nowISO(), ev.id).run();
  return { ok: true, status: complete ? 'completed' : 'drafting' };
}
export async function signDelay(env, pid, id, who) {
  const ev = await getDelay(env, pid, id);
  if (!ev) return { error: 'no such delay event' };
  if (ev.status !== 'completed') return { error: 'Planning / the PM complete the notice before the Director signs it.' };
  await env.DB.prepare("UPDATE delay_event SET status = 'signed', signed_by = ?, signed_at = ?, updated_at = ? WHERE id = ?").bind(str(who, 120), nowISO(), nowISO(), ev.id).run();
  return { ok: true, status: 'signed' };
}
export async function markIssued(env, pid, id, letterRef) {
  await env.DB.prepare("UPDATE delay_event SET status = 'issued', letter_ref = ?, notice_date = ?, updated_at = ? WHERE project_id = ? AND id = ?")
    .bind(letterRef, todayUAE(), nowISO(), pid, String(id)).run();
}
