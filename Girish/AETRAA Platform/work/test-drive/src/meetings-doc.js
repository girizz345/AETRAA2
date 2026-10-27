// STEP 8 — the documents: the minutes as a Word file, the action log in Excel.

import { buildXlsx } from './xlsx.js';
import { MEETING_TYPES } from './meetings.js';

const esc = (v) => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pd = (d) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d || ''); return m ? `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}` : (d || ''); };
const nl = (t) => esc(t).replace(/\n/g, '<br>');

const TD = 'border:1px solid #d0d7e2;padding:6px 8px;font:12.5px/1.45 Arial,Helvetica,sans-serif;vertical-align:top;';
const TH = TD + 'background:#212d51;color:#fff;font-weight:bold;text-align:left;';
const H2 = 'font:bold 14px Arial,Helvetica,sans-serif;color:#212d51;margin:20px 0 8px;';
const P_ = 'font:12.5px/1.5 Arial,Helvetica,sans-serif;color:#1b2437;margin:0 0 6px;';
const tbl = (head, rows, widths) => `<table style="border-collapse:collapse;width:100%;margin:4px 0 8px;">
  <tr>${head.map((h, i) => `<th style="${TH}${widths && widths[i] ? 'width:' + widths[i] + ';' : ''}">${esc(h)}</th>`).join('')}</tr>
  ${rows.map((r) => `<tr>${r.map((v) => `<td style="${TD}">${v}</td>`).join('')}</tr>`).join('')}</table>`;
const DECISION = { close: 'Closed', redate: 'Re-dated', carry: 'Carried forward' };

export function minutesHTML(m, project) {
  const p = project || {};
  const t = MEETING_TYPES[m.type] || {};
  const out = [];
  out.push(`<div style="border-bottom:2px solid #212d51;padding-bottom:10px;margin-bottom:12px;">
    <div style="font:bold 11px Arial;letter-spacing:.12em;text-transform:uppercase;color:#17b9e4;">Minutes of meeting${m.status === 'draft' ? ' — DRAFT, not issued' : ''}</div>
    <div style="font:bold 19px Arial;color:#212d51;margin-top:4px;">${esc(m.title || t.label || 'Meeting')}</div>
    <div style="${P_}color:#6a7590;margin:2px 0 0;">${esc([p.name, p.ref, m.ref].filter(Boolean).join(' · '))}</div></div>`);
  out.push(tbl(['Date', 'Time', 'Location', 'Chaired by'], [[esc(pd(m.meeting_date)), esc(m.start_time || ''), esc(m.location || ''), esc(m.chair || '')]]));

  const present = (m.attendees || []).filter((a) => a.present), apologies = (m.attendees || []).filter((a) => !a.present);
  out.push(`<h2 style="${H2}">Attendance</h2>`);
  out.push(tbl(['Present', 'Company / role'], present.map((a) => [esc(a.name), esc(a.company)]), ['50%']));
  if (apologies.length) out.push(`<p style="${P_}"><b>Apologies:</b> ${apologies.map((a) => esc(a.name + (a.company ? ' (' + a.company + ')' : ''))).join(', ')}</p>`);

  const arising = m.status === 'draft' ? (m.arising_open || []).map((a) => {
    const d = (m.arising || []).find((x) => x.ref === a.ref) || { decision: 'carry' };
    return { ref: a.ref, text: a.text, owner_name: a.owner_name, due: a.due, from: a.meeting_ref, decision: d.decision, note: d.note, new_due: d.due };
  }) : (m.arising || []);
  if (arising.length) {
    out.push(`<h2 style="${H2}">1. Matters arising — actions from previous meetings</h2>`);
    out.push(tbl(['Ref', 'Action', 'By', 'Was due', 'Status at this meeting'], arising.map((a) => [
      `<b>${esc(a.ref)}</b><br><span style="color:#6a7590">${esc(a.from || '')}</span>`, nl(a.text), esc(a.owner_name), esc(pd(a.due)),
      esc(DECISION[a.decision] || a.decision) + (a.decision === 'redate' && a.new_due ? ' to ' + esc(pd(a.new_due)) : '') + (a.note ? ' — ' + nl(a.note) : ''),
    ]), ['10%', '40%', '15%', '11%']));
  }
  out.push(`<h2 style="${H2}">${arising.length ? '2' : '1'}. Items discussed</h2>`);
  out.push(tbl(['No', 'Item', 'Action by', 'Date'], (m.items || []).flatMap((it) => {
    const body = `<b>${esc(it.subject)}</b>` + (it.discussion ? `<br>${nl(it.discussion)}` : '') +
      (it.decision ? `<br><b>Agreed:</b> ${nl(it.decision)}` : '');
    const acts = it.actions || [];
    const rows = [[esc(it.no), body, acts.length ? '' : 'Note', '']];
    acts.forEach((a) => rows.push(['', `<b>${esc(a.ref || 'Action')}:</b> ${nl(a.text)}`, esc(a.owner_name), esc(pd(a.due))]));
    return rows;
  }), ['6%', '64%', '18%', '12%']));
  if (m.next_meeting) out.push(`<p style="${P_}"><b>Next meeting:</b> ${esc(m.next_meeting)}</p>`);
  out.push(`<p style="${P_}color:#6a7590;margin-top:14px;">Prepared by ${esc(m.prepared_by || '')}${m.issued_by ? '; issued by ' + esc(m.issued_by) + ' on ' + esc(pd(m.issued_at)) : ''}. ` +
    `Any correction to these minutes is to be raised at, and recorded in, the next meeting.</p>`);
  return `<div style="font-family:Arial,Helvetica,sans-serif;color:#1b2437;max-width:900px;margin:0 auto;">${out.join('\n')}</div>`;
}

export function minutesWord(m, project) {
  return `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><title>${esc(m.ref)} — ${esc(m.title || '')}</title>
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]-->
<style>@page Section1 { size: 595.3pt 841.9pt; margin: 36pt 32pt; } div.Section1 { page: Section1; } table { border-collapse: collapse; }</style></head>
<body><div class="Section1">${minutesHTML(m, project)}</div></body></html>`;
}

// The whole action log, one row per action, open ones first.
// K13 (v5 A11): the values a minutes template is filled with — the consultant's
// for their meetings, the company's for internal ones. Lists go in as lines.
export function minutesValues(m, project) {
  const present = (m.attendees || []).filter((a) => a.present), apologies = (m.attendees || []).filter((a) => !a.present);
  const items = (m.items || []);
  const acts = items.flatMap((it) => (it.actions || []).map((a) => (a.ref ? a.ref + ': ' : '') + a.text + (a.owner_name ? ' — ' + a.owner_name : '') + (a.due ? ', by ' + pd(a.due) : '')));
  const arising = (m.arising || []).map((a) => a.ref + ' ' + (a.text || '') + ' — ' + (DECISION[a.decision] || a.decision || '') + (a.note ? ': ' + a.note : ''));
  return {
    meeting_ref: m.ref, meeting_title: m.title || '', meeting_date: pd(m.meeting_date), time: m.start_time || '', location: m.location || '', chair: m.chair || '',
    their_ref: m.their_ref || '', attendees: present.map((a) => a.name + (a.company ? ' (' + a.company + ')' : '')).join('\n'),
    apologies: apologies.map((a) => a.name).join('\n'),
    items: items.map((it) => it.no + '. ' + it.subject + (it.discussion ? '\n' + it.discussion : '') + (it.decision ? '\nAgreed: ' + it.decision : '')).join('\n\n'),
    decisions: items.filter((it) => it.decision).map((it) => it.no + '. ' + it.decision).join('\n'),
    actions: acts.join('\n'), matters_arising: arising.join('\n'), next_meeting: m.next_meeting || '',
    prepared_by: m.prepared_by || '', issued_by: m.issued_by || '', issued_on: pd(m.issued_at),
  };
}

// The action tracker, in v5 A11's columns first (No, Meeting, Action, Owner,
// Due, Status, Closed on), then the first date, how often it was carried, and
// the closing note.
export function actionsWorkbook(actions, project, opts) {
  const c = (v, s) => ({ v, s });
  const today = new Date(Date.now() + 4 * 3600000).toISOString().slice(0, 10);
  const rows = [[c(`Action log — ${(project || {}).name || ''}`, 'title')], [c('As at ' + pd(today), 'muted')], [],
    ['No', 'Meeting', 'Action', 'Owner', 'Due', 'Status', 'Closed on', 'First due', 'Times carried', 'Closing note'].map((h) => c(h, 'head'))];
  const sorted = actions.slice().sort((a, b) => (a.status === b.status ? String(a.due).localeCompare(String(b.due)) : a.status === 'open' ? -1 : 1));
  for (const a of sorted) {
    const late = a.status === 'open' && a.due && a.due < today;
    rows.push([c(a.ref, 'text'), c(a.meeting_ref, 'text'), c(a.text, 'text'), c(a.owner_name || '', 'text'), c({ date: a.due }, 'dateBox'),
      c(a.status === 'open' ? (late ? 'OVERDUE' : 'Open') : 'Closed', late ? 'totalLabel' : 'text'),
      a.closed_at ? c({ date: a.closed_at }, 'dateBox') : c('', 'text'),
      c({ date: a.first_due || a.due }, 'dateBox'), c(Number(a.carried) || 0, 'num'), c(a.closed_note || '', 'text')]);
  }
  return buildXlsx([{ name: 'Actions', rows, freeze: 5, landscape: true, cols: [10, 12, 60, 22, 12, 11, 12, 12, 9, 50] }], opts);
}
