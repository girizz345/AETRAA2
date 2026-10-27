// STEP 10 — "Needs my attention": everything waiting on one person, in one list.
//
// It reads what every other part of the platform already knows and asks, for
// each, one question: is the next move this person's? Nothing is stored here.
//
//   records      the next step of any record (submittal, RFI, MS, WIR, NCR,
//                permit, material request, variation, letter…) that belongs
//                to one of the person's functions. The PM and the Principal
//                hold every folder, so they see the steps that name them —
//                not every step on the project.
//   incoming     letters sent to the person's function for a reply
//   actions      meeting actions they own
//   payments     applications at the step they take (approve, issue, record
//                the certificate, record payment), and certificates past due
//   diary        working days with no submitted diary (PM and Document Control)
//   drawings     drawings waiting for the PM's approval
//   progress     finished work site has claimed, waiting to be verified (PM),
//                and claims the office queried back to site (site engineer)
//   bills        a BOQ or BOM upload waiting for its check (QS, Procurement),
//                materials not matched to the BOQ (Procurement), and a bill
//                waiting for the PM's approval (K1, v5 E7/E8)
//
// Each item says what is needed, by when, and where to go to do it. Overdue
// first, then by date.

import { listRecords, pendingStep } from './records.js';
import { FUNCTIONS } from './functions.js';
import { listIPC, mayIPC } from './ipc.js';
import { listActions } from './meetings.js';
import { diaryStatus } from './diary-checks.js';
import { listDrawings } from './drawings.js';
import { listQueue } from './verify.js';
import { getKb, kbChanges } from './knowledge.js';
import { dueItems } from './schedules.js';
import { billState } from './bills.js';
import { S0_TYPES, openComments } from './s0.js';
import { certExpiries } from './diary-docs.js';

const todayUAE = () => new Date(Date.now() + 4 * 3600000).toISOString().slice(0, 10);
const LABEL = { rfi: 'RFI', submittal: 'Submittal', ms: 'Method statement', material: 'Material approval', authority: 'Authority NOC',
  letter: 'Letter', incoming: 'Incoming letter', variation: 'Variation', wir: 'Inspection', mir: 'Material inspection', ncr: 'NCR',
  obs: 'HSE observation', incident: 'Incident', ptw: 'Permit to work', mr: 'Material request', cert: 'Certificate' };
const days = (a, b) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000);

export async function attentionFor(env, pid, project, me, fns, role) {
  const today = todayUAE();
  const f = fns || [];
  const boss = f.includes('pm') || f.includes('principal') || role === 'owner' || role === 'manager';
  const items = [];
  const add = (x) => items.push({ due: null, overdue: false, ...x });
  const safe = async (fn) => { try { return await fn(); } catch (e) { return null; } };

  // ---- records whose next step is theirs
  const recs = (await safe(() => listRecords(env, pid))) || [];
  for (const r of recs) {
    // K5: an imported record is never anybody's next move. (It has no pending
    // step either; this says so outright rather than relying on that.)
    if (r.imported) continue;
    // K7 (S0): returned to Design, or a revision with the consultant's comments
    // still open, is Design's move — not the approver's.
    if (r.returned || (r.rev && S0_TYPES.includes(r.type))) {
      const open = r.returned ? 0 : (await safe(() => openComments(env, pid, r.ref)) || []).length;
      if (r.returned || open) {
        const mineD = (me && r.originator_id === me.id) || f.includes('design');
        if (mineD) {
          add({ kind: 'record', ref: r.ref, title: (LABEL[r.type] || r.type) + ' · ' + r.ref + ' ' + (r.title || ''),
            need: r.returned ? 'Returned to Design — revise it and resubmit' : open + ' consultant comment' + (open === 1 ? '' : 's') + ' to answer before the PM approves',
            due: null, overdue: false, page: '/s0?ref=' + encodeURIComponent(r.ref) });
        }
        continue;
      }
    }
    const next = pendingStep(r);
    if (!next || !Array.isArray(next.by)) continue;
    let mine;
    if (r.type === 'incoming') {
      // The first owner is the one it was sent to; the PM watches only the late ones.
      mine = f.includes(next.by[0]) || (boss && !!r.due && r.due < today);
    } else {
      mine = next.by.some((x) => f.includes(x));
    }
    if (!mine) continue;
    const late = !!r.due && r.due < today;
    add({
      kind: r.type === 'incoming' ? 'incoming' : 'record', ref: r.ref, type: r.type,
      title: r.ref + ' · ' + (r.title || ''),
      need: (LABEL[r.type] || r.type) + ' — ' + (r.type === 'incoming' ? 'reply, or close it with the reason' : (next.issue ? 'issue it' : next.reply ? 'record the reply' : next.st)),
      due: r.due || null, overdue: late, open: { ref: r.ref },
    });
  }

  // ---- meeting actions they own
  if (me && me.id) {
    for (const a of (await safe(() => listActions(env, pid, { mine: me.id, status: 'open' }))) || []) {
      add({ kind: 'action', ref: a.ref, title: 'Meeting action · ' + a.text, need: 'Do it, then close it with a note',
        due: a.due, overdue: a.overdue, page: '/minutes?tab=actions&filter=mine' });
    }
  }

  // ---- payment applications at their step
  for (const c of (await safe(() => listIPC(env, pid))) || []) {
    const st = c.stage;
    const pay = { page: null, reg: 'ipc' };
    if (st === 'prepared' && mayIPC('approve', f, role) && (f.includes('pm') || f.includes('principal') || role === 'manager' || role === 'owner')) {
      add({ kind: 'payment', ref: c.ref, title: 'Payment application · ' + c.ref, need: 'Approve it (or return it to the QS)', ...pay });
    } else if (st === 'approved' && f.includes('dc')) {
      add({ kind: 'payment', ref: c.ref, title: 'Payment application · ' + c.ref, need: 'Issue it to the Engineer', ...pay });
    } else if (st === 'issued' && (f.includes('dc') || f.includes('commercial'))) {
      const late = !!c.certify_by && c.certify_by < today;
      add({ kind: 'payment', ref: c.ref, title: 'Payment application · ' + c.ref,
        need: late ? 'The Engineer is late certifying — chase, then record the certificate' : 'Record the Engineer’s certificate when it arrives',
        due: c.certify_by || null, overdue: late, ...pay });
    } else if ((st === 'certified' || st === 'part') && (f.includes('finance') || boss)) {
      const late = !!c.payment_by && c.payment_by < today;
      if (f.includes('finance') || late) {
        add({ kind: 'payment', ref: c.ref, title: 'Payment certificate · ' + c.ref,
          need: late ? 'Payment is overdue — chase the client' : 'Record the payment when it is received',
          due: c.payment_by || null, overdue: late, ...pay });
      }
    }
  }

  // ---- the site diary (PM and Document Control)
  if (boss || f.includes('dc')) {
    const st = await safe(() => diaryStatus(env, pid, project, today, 14));
    if (st) {
      const past = st.days.filter((d) => d.date !== today);
      for (const d of past.filter((x) => x.status === 'draft')) {
        add({ kind: 'diary', ref: d.date, title: 'Site diary · ' + d.day + ' ' + d.date + ' (draft)',
          need: 'Check the draft and submit it', due: d.date, overdue: true, page: '/diary?date=' + d.date });
      }
      // Missing days are one line, not one each: the list is for deciding what to do next.
      const missing = past.filter((x) => x.status === 'missing');
      if (missing.length) {
        add({ kind: 'diary', ref: missing[0].date, title: `Site diary · ${missing.length} working day${missing.length === 1 ? '' : 's'} with no diary`,
          need: 'No diary — write up ' + missing.slice(0, 5).map((x) => x.day + ' ' + x.date).join(', ') + (missing.length > 5 ? '…' : ''),
          due: missing[0].date, overdue: true, page: '/diary?date=' + missing[missing.length - 1].date, count: missing.length });
      }
    }
  }

  // ---- drawings waiting for approval (the PM and the Principal approve drawings)
  if (boss) {
    const ds = (await safe(() => listDrawings(env, pid, { status: 'pending' }))) || [];
    for (const d of ds) {
      if (Number(d.imported)) continue;              // K5: an imported sheet waits on nobody
      const waited = d.uploaded_at ? days(String(d.uploaded_at).slice(0, 10), today) : 0;
      add({ kind: 'drawing', ref: d.number + (d.revision ? ' rev ' + d.revision : ''), title: 'Drawing · ' + d.number + ' ' + (d.title || ''),
        need: 'Approve it for site, or send it back', due: null, overdue: waited > 3, waited, page: '/drawings' });
    }
  }

  // ---- progress: finished work to verify (PM), queried claims back to site
  if (boss) {
    const q = (await safe(() => listQueue(env, pid, { state: 'awaiting', complete: true, limit: 200 }))) || [];
    if (q.length) {
      const oldest = q.map((x) => x.report_date).filter(Boolean).sort()[0] || today;
      add({ kind: 'verify', ref: q.length + ' finished', title: `Site has finished ${q.length} activit${q.length === 1 ? 'y' : 'ies'} waiting for you to verify`,
        need: 'Check the photographs and verify, or query back', due: oldest, overdue: days(oldest, today) > 3, page: '/verify', count: q.length });
    }
  }
  if (f.includes('site')) {
    const q = (await safe(() => listQueue(env, pid, { state: 'queried', limit: 200 }))) || [];
    for (const x of q) {
      add({ kind: 'queried', ref: x.id, title: 'Progress queried · ' + (x.name || x.id), need: 'The office queried this: ' + (x.verdict_note || 'see the note') + ' — correct it or add proof',
        due: null, overdue: false, page: '/site' });
    }
  }

  // ---- schedule items due within a week, or late (P2-P5 step 5), for the owning team
  for (const d of (await safe(() => dueItems(env, pid, f))) || []) {
    add({ kind: 'schedule', ref: d.count + ' due', title: d.label + ': ' + d.count + ' item' + (d.count === 1 ? '' : 's') + ' due within a week' + (d.late ? ' (' + d.late + ' late)' : ''),
      need: 'Raise them from the schedule and submit', due: d.first, overdue: d.late > 0, page: '/schedules' });
  }

  // ---- delays flagged and not yet issued (A13), for Planning and the PM, with
  // the end of the notice period — shown, never concluded.
  if (f.includes('planning') || f.includes('pm')) {
    const ds = ((await safe(() => env.DB.prepare("SELECT id, ref, description, time_bar_date, status FROM delay_event WHERE project_id = ? AND status IN ('flagged','drafting','completed')").bind(pid).all())) || {}).results || [];
    for (const d of ds) add({ kind: 'delay', ref: d.ref, title: 'Delay · ' + d.description,
      need: (d.status === 'completed' ? 'Completed — waiting for the Director to sign' : 'Prepare the delay notice') + (d.time_bar_date ? '. The notice period ends ' + d.time_bar_date : ''),
      due: d.time_bar_date || null, overdue: !!(d.time_bar_date && days(today, d.time_bar_date) <= 7), page: '/delays' });
  }

  // ---- A4 contract obligations: lines for the QS to confirm, then the Principal to approve
  if (f.includes('commercial') || f.includes('principal')) {
    const ob = await safe(() => env.DB.prepare("SELECT state, COUNT(*) AS n FROM contract_obligation WHERE project_id = ? AND state IN ('proposed', 'confirmed') GROUP BY state").bind(pid).all());
    const by = Object.fromEntries((((ob && ob.results) || [])).map((r) => [r.state, Number(r.n)]));
    if (f.includes('commercial') && by.proposed) add({ kind: 'obligations', ref: by.proposed + ' to confirm', title: 'Contract obligations found in the contract',
      need: 'Check each line against its clause and confirm it, or reject it', due: null, overdue: false, page: '/obligations' });
    if (f.includes('principal') && by.confirmed) add({ kind: 'obligations', ref: by.confirmed + ' to approve', title: 'Contract obligations confirmed by the QS',
      need: 'Approve them — their periods then drive the notice clock', due: null, overdue: false, page: '/obligations' });
  }

  // ---- the knowledge base (P1): waiting for the PM, or changed since approval
  if (f.includes('pm')) {
    const kb = await safe(() => getKb(env, pid));
    if (kb && kb.state === 'issued') {
      const since = String(kb.issued_at || '').slice(0, 10) || today;
      add({ kind: 'knowledge', ref: 'Knowledge base', title: 'The project knowledge base was issued by AETRAA',
        need: 'Review what was read, what is missing and the links, and approve it — the schedules wait for it',
        due: since, overdue: days(since, today) > 3, page: '/knowledge' });
    } else if (kb && kb.state === 'approved') {
      const ch = await safe(() => kbChanges(env, pid));
      if (ch && ch.changes && ch.changes.length) {
        add({ kind: 'knowledge', ref: ch.changes.length + ' changes', title: 'Reissued documents changed the knowledge base',
          need: ch.changes.slice(0, 2).map((c) => c.what).join('; ') + (ch.changes.length > 2 ? ' and ' + (ch.changes.length - 2) + ' more' : ''),
          due: null, overdue: false, page: '/knowledge' });
      }
    }
  }

  // ---- payment terms read from the contract, waiting for the Principal (E9 step 3)
  if (f.includes('principal')) {
    const t = await safe(() => env.DB.prepare('SELECT terms_state, terms_applied_at FROM projects WHERE id = ?').bind(pid).first());
    if (t && t.terms_state === 'pending') {
      const since = String(t.terms_applied_at || '').slice(0, 10) || today;
      add({ kind: 'terms', ref: 'Payment terms', title: 'Payment terms read from the contract',
        need: 'Check each figure against its clause and approve them — no application for payment can be raised until you do',
        due: since, overdue: days(since, today) > 3, page: '/terms' });
    }
  }

  // ---- K1: the priced BOQ and the BOM (v5 E7, E8)
  const bs = await safe(() => billState(env, pid));
  for (const k of bs ? ['boq', 'bom'] : []) {
    const s = bs[k], noun = k === 'bom' ? 'bill of materials' : 'priced BOQ';
    const importer = k === 'bom' ? (f.includes('procurement') || f.includes('commercial')) : f.includes('commercial');
    const open = k === 'bom' && s.matching ? s.matching.open : 0;
    const since = String(s.imported_at || '').slice(0, 10) || today;
    if (importer && s.checking) {
      const up = String(s.checking.created_at || '').slice(0, 10) || today;
      add({ kind: 'bill', ref: k === 'bom' ? 'BOM check' : 'BOQ check', title: 'The ' + noun + ' uploaded on ' + up + ' is waiting to be checked',
        need: s.checking.flags_open ? s.checking.flags_open + ' flagged line' + (s.checking.flags_open === 1 ? '' : 's') + ' to fix or accept, then import it' : 'Nothing is flagged — import it',
        due: up, overdue: days(up, today) > 3, page: '/bills' });
    }
    if (importer && s.state === 'pending' && open) {
      add({ kind: 'bill', ref: 'BOM matching', title: open + ' material' + (open === 1 ? '' : 's') + ' not yet matched to a BOQ line',
        need: 'Confirm each match, link it to a BOQ line, or say it is not in the BOQ — the PM approves after',
        due: since, overdue: days(since, today) > 3, page: '/bills' });
    }
    if (f.includes('pm') && s.state === 'pending' && !open) {
      add({ kind: 'bill', ref: k === 'bom' ? 'BOM' : 'BOQ', title: 'The ' + noun + ' is waiting for your approval',
        need: k === 'boq' ? 'Check it and approve it — no payment application is valued against it until you do'
          : 'Check it and approve it — orders and deliveries are recorded against it once you do',
        due: since, overdue: days(since, today) > 3, page: '/bills' });
    }
  }

  // ---- K11 (v5 A5): certificates by their expiry — HSE's register, and the PM.
  // Expired, within 30 days of expiry, or no expiry found (spec §6). One
  // brought in from the old system carries no clock (K5).
  if (f.includes('hse') || boss) {
    const ce = (await safe(() => certExpiries(env, pid, today))) || [];
    for (const c of ce) {
      add({ kind: 'cert', ref: c.ref, title: 'Certificate · ' + c.ref + ' ' + (c.title || ''),
        need: c.state === 'expired' ? 'Expired on ' + c.expiry + ' — renew it, or take what it covers out of use'
          : c.state === 'expiring' ? 'Expires on ' + c.expiry + ' (in ' + c.days + ' day' + (c.days === 1 ? '' : 's') + ') — arrange the renewal'
          : 'No expiry date was found on it — check the certificate and enter its expiry',
        due: c.expiry || today, overdue: c.state === 'expired' });
    }
  }

  items.sort((a, b) => (b.overdue - a.overdue) || String(a.due || '9999').localeCompare(String(b.due || '9999')) || String(a.ref).localeCompare(String(b.ref)));
  const count = (k) => items.filter((i) => i.kind === k).length;
  return {
    items, total: items.length, overdue: items.filter((i) => i.overdue).length,
    by_kind: { record: count('record'), incoming: count('incoming'), action: count('action'), payment: count('payment'),
      diary: count('diary'), drawing: count('drawing'), verify: count('verify'), queried: count('queried'), terms: count('terms'), knowledge: count('knowledge'), schedule: count('schedule'), bill: count('bill'), delay: count('delay'), cert: count('cert') },
    who: me ? me.name : role, roles: f.map((x) => (FUNCTIONS[x] || {}).label || x), today,
  };
}

// The morning email: the same list, as plain HTML an inbox shows well.
export function attentionEmail(a, project, origin) {
  const esc = (v) => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const rows = a.items.slice(0, 40).map((i) => `<tr>
    <td style="padding:6px 8px;border-bottom:1px solid #e3e9f2;font:13px Arial;color:${i.overdue ? '#c8322b' : '#1b2437'};white-space:nowrap">${i.overdue ? 'Overdue' : esc(i.due || '')}</td>
    <td style="padding:6px 8px;border-bottom:1px solid #e3e9f2;font:13px Arial"><b>${esc(i.title)}</b><br><span style="color:#6a7590">${esc(i.need)}</span></td></tr>`).join('');
  return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:720px">
    <div style="font:bold 11px Arial;letter-spacing:.12em;text-transform:uppercase;color:#17b9e4">Needs your attention today</div>
    <div style="font:bold 18px Arial;color:#212d51;margin:4px 0 2px">${esc((project || {}).name || 'Project')}</div>
    <div style="font:13px Arial;color:#6a7590;margin-bottom:12px">${a.total} item${a.total === 1 ? '' : 's'}${a.overdue ? `, <b style="color:#c8322b">${a.overdue} overdue</b>` : ''} for ${esc(a.who)}.</div>
    <table style="border-collapse:collapse;width:100%">${rows}</table>
    ${a.items.length > 40 ? `<p style="font:12px Arial;color:#6a7590">and ${a.items.length - 40} more.</p>` : ''}
    ${origin ? `<p style="margin-top:14px"><a href="${esc(origin)}/" style="font:bold 13px Arial;color:#212d51">Open AETRAA</a></p>` : ''}
  </div>`;
}
