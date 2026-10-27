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

  items.sort((a, b) => (b.overdue - a.overdue) || String(a.due || '9999').localeCompare(String(b.due || '9999')) || String(a.ref).localeCompare(String(b.ref)));
  const count = (k) => items.filter((i) => i.kind === k).length;
  return {
    items, total: items.length, overdue: items.filter((i) => i.overdue).length,
    by_kind: { record: count('record'), incoming: count('incoming'), action: count('action'), payment: count('payment'),
      diary: count('diary'), drawing: count('drawing'), verify: count('verify'), queried: count('queried') },
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
