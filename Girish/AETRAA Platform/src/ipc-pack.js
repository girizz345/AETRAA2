// STEP 5 — the payment application pack.
//
//   ipcWorkbook      the complete BOQ valuation in Excel: every BOQ line, with
//                    previous %, cumulative % and this period's %, their values
//                    as live formulas, section totals, and the summary,
//                    variations, materials on site, previous certificates and
//                    retention / advance statements on their own sheets
//   ipcDocument      the covering letter, summary and statements as a Word file
//   buildIpcPack     all of it in one .zip with the files that go with it: the
//                    progress report for the period, the period's photographs,
//                    the approved inspections, each variation's back-up and the
//                    supporting documents attached to the application
//
// Everything comes from the application as it was saved, so a pack rebuilt a
// year later is the same pack.

import { buildXlsx, zip } from './xlsx.js';
import { listAttachments, getAttachment } from './attachments.js';
import { buildPeriodReport, reportWord } from './report.js';
import { stage } from './ipc.js';

const enc = new TextEncoder();
const num0 = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const esc = (v) => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const money = (v) => (Number(v) || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const parse = (v, d) => { try { const j = JSON.parse(v || ''); return j == null ? d : j; } catch (e) { return d; } };
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pd = (d) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d || ''); return m ? `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}` : (d || ''); };
const safeName = (s) => String(s || 'file').replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '-').replace(/\s+/g, ' ').trim().slice(0, 120) || 'file';
const MAX_PACK = 150 * 1024 * 1024;       // a pack larger than this is split by the QS, not the server

/* --------------------------------------------------------------- figures */

// The waterfall of one application, from its saved row.
function figuresOf(ipc) {
  const f = (ipc.detail && ipc.detail.figures) || {};
  return {
    contract: num0(f.contract),
    work_done: num0(ipc.work_done), variations: num0(ipc.variations), mos: num0(ipc.materials_on_site),
    gross: num0(ipc.gross), retention: num0(ipc.retention), advance: num0(ipc.advance_recovery),
    due_to_date: num0(ipc.certified_to_date), previous: num0(ipc.previous), net: num0(ipc.net),
    vat: num0(ipc.vat), total: num0(ipc.total_due != null ? ipc.total_due : num0(ipc.net) + num0(ipc.vat)),
    retention_cap: num0(f.retention_cap), vat_pct: num0((ipc.detail && ipc.detail.terms || {}).vat_pct),
    retention_pct: num0(ipc.retention_pct),
  };
}
// The applications that count, up to and including this one.
function historyTo(history, ipc) {
  return history.filter((h) => stage(h) !== 'returned' && (h.no < ipc.no || h.id === ipc.id))
    .sort((a, b) => a.no - b.no || (a.rev || 0) - (b.rev || 0));
}

/* ------------------------------------------------------------ the Excel */

export function ipcWorkbook(ipc, project, history) {
  const p = project || {};
  const cur = p.currency || 'AED';
  const F = figuresOf(ipc);
  const lines = ipc.lines || [];
  const detail = ipc.detail || {};
  const T = detail.terms || {};
  const c = (v, s) => ({ v, s });
  const fx = (f, v, s) => ({ f, v, s });
  const head = (...h) => h.map((x) => c(x, 'head'));

  // ---- BOQ Valuation: the complete bill, grouped by section
  const V = [];
  V.push([c(`${ipc.ref} — complete BOQ valuation`, 'title')]);
  V.push([c('Project', 'bold'), p.name || '', '', c('Contract ref', 'bold'), p.ref || '']);
  V.push([c('Period', 'bold'), `${pd(ipc.period_from)} to ${pd(ipc.period_to)}`, '', c('Currency', 'bold'), cur]);
  V.push([c('The cumulative % (yellow) is the claim. Every value is a formula — change a % and the whole sheet, and the Summary, recalculate.', 'muted')]);
  V.push([]);
  V.push(head('Item', 'Description', 'Unit', 'Qty', 'Rate', 'Amount', 'Previous %', 'Previous value',
    'Cumulative %', 'Cumulative value', 'This period %', 'This period value', 'Balance to complete', 'Programme %', 'Note'));
  const headerRow = V.length;
  const subtotalRows = [];
  const groups = [];
  for (const l of lines) {
    const g = groups[groups.length - 1];
    if (g && g.section === l.section) g.lines.push(l); else groups.push({ section: l.section, lines: [l] });
  }
  let tot = { F: 0, H: 0, J: 0, L: 0, M: 0 };
  for (const g of groups) {
    V.push([c(g.section || '(no section)', 'section'), ...Array(14).fill(c('', 'section'))]);
    const first = V.length + 1;
    let s = { F: 0, H: 0, J: 0, L: 0, M: 0 };
    for (const l of g.lines) {
      const r = V.length + 1;
      const amt = num0(l.amount), prev = num0(l.prev_pct) / 100, cum = num0(l.pct) / 100;
      const byRate = l.qty && l.rate && Math.abs(num0(l.qty) * num0(l.rate) - amt) < 0.01;
      const vals = { F: amt, H: amt * prev, J: amt * cum, L: amt * cum - amt * prev, M: amt - amt * cum };
      for (const k of Object.keys(s)) s[k] += vals[k];
      V.push([
        c(l.ref || '', 'text'), c(l.description || '', 'text'), c(l.unit || '', 'text'),
        c(l.qty ? num0(l.qty) : '', 'num'), c(l.rate ? num0(l.rate) : '', 'money'),
        byRate ? fx(`D${r}*E${r}`, amt, 'money') : c(amt, 'money'),
        c(prev, 'pct'), fx(`F${r}*G${r}`, vals.H, 'money'),
        c(cum, 'input'), fx(`F${r}*I${r}`, vals.J, 'money'),
        fx(`I${r}-G${r}`, cum - prev, 'pct'), fx(`J${r}-H${r}`, vals.L, 'money'),
        fx(`F${r}-J${r}`, vals.M, 'money'),
        l.programme_pct == null ? c('', 'text') : c(num0(l.programme_pct) / 100, 'pct'),
        c(l.note || '', 'text'),
      ]);
    }
    const last = V.length, r = V.length + 1;
    const sum = (col) => fx(`SUM(${col}${first}:${col}${last})`, s[col], 'total');
    V.push([c('', 'totalLabel'), c(`Total — ${g.section || '(no section)'}`, 'totalLabel'), c('', 'totalLabel'), c('', 'totalLabel'), c('', 'totalLabel'),
      sum('F'), fx(`IF(F${r}=0,0,H${r}/F${r})`, s.F ? s.H / s.F : 0, 'totalPct'), sum('H'),
      fx(`IF(F${r}=0,0,J${r}/F${r})`, s.F ? s.J / s.F : 0, 'totalPct'), sum('J'),
      fx(`I${r}-G${r}`, (s.F ? s.J / s.F : 0) - (s.F ? s.H / s.F : 0), 'totalPct'), sum('L'), sum('M'), c('', 'totalLabel'), c('', 'totalLabel')]);
    subtotalRows.push(r);
    for (const k of Object.keys(tot)) tot[k] += s[k];
  }
  V.push([]);
  const G = V.length + 1;
  const gsum = (col) => fx(subtotalRows.length ? subtotalRows.map((r) => col + r).join('+') : '0', tot[col], 'total');
  V.push([c('', 'totalLabel'), c('TOTAL — CONTRACT WORKS', 'totalLabel'), c('', 'totalLabel'), c('', 'totalLabel'), c('', 'totalLabel'),
    gsum('F'), fx(`IF(F${G}=0,0,H${G}/F${G})`, tot.F ? tot.H / tot.F : 0, 'totalPct'), gsum('H'),
    fx(`IF(F${G}=0,0,J${G}/F${G})`, tot.F ? tot.J / tot.F : 0, 'totalPct'), gsum('J'),
    fx(`I${G}-G${G}`, (tot.F ? tot.J / tot.F : 0) - (tot.F ? tot.H / tot.F : 0), 'totalPct'), gsum('L'), gsum('M'), c('', 'totalLabel'), c('', 'totalLabel')]);

  // ---- Variations
  const vos = detail.variations || [];
  const VO = [[c(`${ipc.ref} — approved variations`, 'title')], [],
    head('Ref', 'Description', 'Approved amount', '% complete', 'Value to date', 'Basis')];
  const voFirst = VO.length + 1;
  let voTot = 0;
  for (const v of vos) {
    const r = VO.length + 1, val = num0(v.amount) * num0(v.pct) / 100;
    voTot += val;
    VO.push([c(v.ref, 'text'), c(v.title || '', 'text'), c(num0(v.amount), 'money'), c(num0(v.pct) / 100, 'input'),
      fx(`C${r}*D${r}`, val, 'money'), c(v.agreed ? 'Agreed amount' : 'Estimated cost', 'text')]);
  }
  const voT = VO.length + 1;
  VO.push([c('', 'totalLabel'), c('Total approved variations', 'totalLabel'),
    fx(vos.length ? `SUM(C${voFirst}:C${voT - 1})` : '0', vos.reduce((s, v) => s + num0(v.amount), 0), 'total'), c('', 'totalLabel'),
    fx(vos.length ? `SUM(E${voFirst}:E${voT - 1})` : '0', voTot, 'total'), c('', 'totalLabel')]);
  if (!vos.length) VO.push([c('No variations are claimed in this application.', 'muted')]);

  // ---- Materials on site
  const mos = detail.mos || [];
  const M = [[c(`${ipc.ref} — materials on site`, 'title')],
    [c(`Delivered to site and not yet built in, paid at ${num0(T.mos_pct || 0)}% of cost.`, 'muted')],
    head('Material', 'Unit', 'Qty', 'Rate', 'Cost', '% paid', 'Value', 'Delivery note / GRN')];
  const mFirst = M.length + 1;
  let mTot = 0;
  for (const m of mos) {
    const r = M.length + 1, cost = num0(m.qty) * num0(m.rate), val = cost * num0(m.paid_pct) / 100;
    mTot += val;
    M.push([c(m.material, 'text'), c(m.unit || '', 'text'), c(num0(m.qty), 'num'), c(num0(m.rate), 'money'),
      fx(`C${r}*D${r}`, cost, 'money'), c(num0(m.paid_pct) / 100, 'pct'), fx(`E${r}*F${r}`, val, 'money'), c(m.ref || '', 'text')]);
  }
  const mT = M.length + 1;
  M.push([c('', 'totalLabel'), c('', 'totalLabel'), c('', 'totalLabel'), c('Total', 'totalLabel'),
    fx(mos.length ? `SUM(E${mFirst}:E${mT - 1})` : '0', mos.reduce((s, m) => s + num0(m.qty) * num0(m.rate), 0), 'total'), c('', 'totalLabel'),
    fx(mos.length ? `SUM(G${mFirst}:G${mT - 1})` : '0', mTot, 'total'), c('', 'totalLabel')]);
  if (!mos.length) M.push([c('No materials on site are claimed in this application.', 'muted')]);

  // ---- Summary, tied to the other sheets
  const ret = F.retention_pct / 100;
  const S = [[c(`Interim payment application ${ipc.ref}`, 'title')],
    [c('Project', 'bold'), p.name || ''], [c('Contract ref', 'bold'), p.ref || ''],
    [c('Contractor', 'bold'), p.contractor_name || ''], [c('Engineer', 'bold'), p.engineer_name || ''],
    [c('Period', 'bold'), `${pd(ipc.period_from)} to ${pd(ipc.period_to)}`],
    [c('Currency', 'bold'), cur], [],
    head('', 'Amount')];
  const row = (label, cell, style) => { S.push([c(label, style || 'text'), cell]); return S.length; };
  const rC = row('Contract sum (BOQ)', fx(`'BOQ Valuation'!F${G}`, tot.F, 'money'));
  const rW = row('Work done to date', fx(`'BOQ Valuation'!J${G}`, tot.J, 'money'));
  const rV = row('Approved variations to date', fx(`Variations!E${voT}`, voTot, 'money'));
  const rM = row('Materials on site', fx(`'Materials on site'!G${mT}`, mTot, 'money'));
  const gross = tot.J + voTot + mTot;
  const rG = row('Gross valuation to date', fx(`B${rW}+B${rV}+B${rM}`, gross, 'total'), 'totalLabel');
  const capTxt = F.retention_cap ? `, capped at ${money(F.retention_cap)}` : '';
  const retVal = F.retention_cap ? Math.min(gross * ret, F.retention_cap) : gross * ret;
  const rR = row(`Less retention to date (${F.retention_pct}%${capTxt})`,
    fx(F.retention_cap ? `-MIN(B${rG}*${ret},${F.retention_cap})` : `-B${rG}*${ret}`, -retVal, 'money'));
  const rA = row('Less advance payment recovered to date', c(-F.advance, 'money'));
  const due = gross - retVal - F.advance;
  const rD = row('Total due to date', fx(`B${rG}+B${rR}+B${rA}`, due, 'total'), 'totalLabel');
  const rP = row('Less total certified on the previous certificate', c(-F.previous, 'money'));
  const net = due - F.previous;
  const rN = row('NET AMOUNT OF THIS APPLICATION', fx(`B${rD}+B${rP}`, net, 'total'), 'totalLabel');
  const vatPct = F.vat_pct / 100;
  const rT = row(`VAT ${F.vat_pct}%`, fx(`IF(B${rN}>0,B${rN}*${vatPct},0)`, net > 0 ? net * vatPct : 0, 'money'));
  row('TOTAL PAYABLE INCLUDING VAT', fx(`B${rN}+B${rT}`, net + (net > 0 ? net * vatPct : 0), 'total'), 'totalLabel');
  S.push([]);
  S.push([c('Status', 'bold'), ipc.status || '']);
  if (ipc.certified_net != null && ipc.certified_net !== '') {
    S.push([c('Certified by the Engineer (net, before VAT)', 'bold'), c(num0(ipc.certified_net), 'money')]);
    S.push([c('Engineer’s certificate ref / date', 'bold'), `${ipc.engineer_ref || '—'} · ${pd(ipc.certified_at)}`]);
  }
  if (num0(ipc.paid_amount)) S.push([c('Received', 'bold'), c(num0(ipc.paid_amount), 'money')]);

  // ---- Previous certificates, retention and advance statements
  const H = historyTo(history, ipc);
  const P = [[c('Statement of applications and certificates', 'title')], [],
    head('Ref', 'Period from', 'Period to', 'Applied — net', 'Certified — net', 'Certified to date', 'Received', 'Status')];
  for (const h of H) {
    const certified = h.certified_net != null && h.certified_net !== '';
    P.push([c(h.ref, 'text'), c({ date: h.period_from }, 'dateBox'), c({ date: h.period_to }, 'dateBox'), c(num0(h.net), 'money'),
      certified ? c(num0(h.certified_net), 'money') : c('awaiting', 'text'),
      certified ? c(num0(h.certified_to_date_eng != null ? h.certified_to_date_eng : h.certified_to_date), 'money') : c('', 'text'),
      num0(h.paid_amount) ? c(num0(h.paid_amount), 'money') : c('', 'text'), c(h.status || '', 'text')]);
  }
  const R = [[c('Retention and advance payment recovery', 'title')],
    [c(`Retention ${F.retention_pct}%${capTxt}. Advance ${money(num0(T.advance_amount))}${T.advance_received ? '' : ' (not marked as received)'}, recovered at ${num0(T.recovery_pct)}% of work valued${num0(T.recovery_start_pct) ? ' above ' + T.recovery_start_pct + '% of the contract' : ''}, in full by ${num0(T.recovery_full_pct)}%.`, 'muted')],
    head('Ref', 'Gross to date', 'Retention to date', 'Retention this application', 'Advance recovered to date', 'Advance recovered this application')];
  let pr = 0, pa = 0;
  for (const h of H) {
    R.push([c(h.ref, 'text'), c(num0(h.gross), 'money'), c(num0(h.retention), 'money'), c(num0(h.retention) - pr, 'money'),
      c(num0(h.advance_recovery), 'money'), c(num0(h.advance_recovery) - pa, 'money')]);
    pr = num0(h.retention); pa = num0(h.advance_recovery);
  }

  return buildXlsx([
    { name: 'Summary', rows: S, cols: [52, 22] },
    { name: 'BOQ Valuation', rows: V, freeze: headerRow + 1, landscape: true,
      cols: [10, 48, 7, 11, 13, 16, 11, 16, 12, 16, 11, 16, 16, 11, 30] },
    { name: 'Variations', rows: VO, landscape: true, cols: [12, 50, 18, 12, 18, 16] },
    { name: 'Materials on site', rows: M, landscape: true, cols: [36, 8, 11, 13, 16, 9, 16, 22] },
    { name: 'Certificates', rows: P, landscape: true, cols: [16, 13, 13, 18, 18, 18, 18, 36] },
    { name: 'Retention & advance', rows: R, landscape: true, cols: [16, 18, 18, 22, 22, 26] },
  ]);
}

/* --------------------------------------------------- the application */

const TD = 'border:1px solid #d0d7e2;padding:6px 8px;font:13px Arial,Helvetica,sans-serif;vertical-align:top;';
const TH = TD + 'background:#212d51;color:#fff;font-weight:bold;text-align:left;';
const TR = TD + 'text-align:right;white-space:nowrap;';
const H2 = 'font:bold 15px Arial,Helvetica,sans-serif;color:#212d51;margin:22px 0 8px;';
const P_ = 'font:13px/1.55 Arial,Helvetica,sans-serif;color:#1b2437;margin:0 0 8px;';
const tbl = (head, rows, right = []) => `<table style="border-collapse:collapse;width:100%;margin:4px 0 8px;">
  <tr>${head.map((h, i) => `<th style="${TH}${right.includes(i) ? 'text-align:right;' : ''}">${esc(h)}</th>`).join('')}</tr>
  ${rows.map((r) => `<tr>${r.map((v, i) => `<td style="${right.includes(i) ? TR : TD}">${v}</td>`).join('')}</tr>`).join('')}</table>`;

export function ipcDocumentHTML(ipc, project, history, extra) {
  const p = project || {};
  const cur = p.currency || 'AED';
  const F = figuresOf(ipc);
  const detail = ipc.detail || {};
  const T = detail.terms || {};
  const x = extra || {};
  const date = ipc.submitted || (ipc.created_at || '').slice(0, 10);
  const out = [];
  out.push(`<div style="border-bottom:2px solid #212d51;padding-bottom:10px;margin-bottom:14px;">
    <div style="font:bold 11px Arial;letter-spacing:.12em;text-transform:uppercase;color:#17b9e4;">Interim payment application</div>
    <div style="font:bold 20px Arial;color:#212d51;margin-top:4px;">${esc(p.name || 'Project')}</div>
    <div style="${P_}color:#6a7590;margin:2px 0 0;">${esc([p.ref, ipc.ref, pd(date)].filter(Boolean).join(' · '))}</div></div>`);

  out.push(`<p style="${P_}">To: ${esc(p.engineer_name || 'The Engineer')}<br>From: ${esc(p.contractor_name || 'The Contractor')}<br>Date: ${esc(pd(date))}</p>`);
  out.push(`<p style="${P_}"><b>Subject: Interim Payment Application No. ${ipc.no}${ipc.rev ? ' (Revision ' + ipc.rev + ')' : ''} — work to ${esc(pd(ipc.period_to))}</b></p>`);
  out.push(`<p style="${P_}">We submit our interim payment application No. ${ipc.no} for the period ${esc(pd(ipc.period_from))} to ${esc(pd(ipc.period_to))}, in the net amount of <b>${cur} ${money(F.net)}</b>${F.vat ? `, plus VAT of ${cur} ${money(F.vat)}, a total of <b>${cur} ${money(F.net + F.vat)}</b>` : ''}. The valuation of every item of the Bill of Quantities, the statements and the supporting documents listed below are enclosed.</p>`);
  out.push(`<p style="${P_}">We request your certificate within ${num0(T.certify_days) || 28} days of receipt, in accordance with the Contract.</p>`);

  out.push(`<h2 style="${H2}">1. Summary</h2>`);
  out.push(tbl(['', 'Amount (' + cur + ')'], [
    ['Contract sum', money(F.contract || 0)],
    ['Work done to date', money(F.work_done)],
    ['Approved variations to date', money(F.variations)],
    ['Materials on site', money(F.mos)],
    ['<b>Gross valuation to date</b>', `<b>${money(F.gross)}</b>`],
    [`Less retention (${F.retention_pct}%${F.retention_cap ? ', capped at ' + money(F.retention_cap) : ''})`, '(' + money(F.retention) + ')'],
    ['Less advance payment recovered to date', '(' + money(F.advance) + ')'],
    ['<b>Total due to date</b>', `<b>${money(F.due_to_date)}</b>`],
    ['Less total certified on the previous certificate', '(' + money(F.previous) + ')'],
    ['<b>Net amount of this application</b>', `<b>${money(F.net)}</b>`],
    [`VAT ${F.vat_pct}%`, money(F.vat)],
    ['<b>Total payable including VAT</b>', `<b>${money(F.net + F.vat)}</b>`],
  ], [1]));
  if (F.contract) out.push(`<p style="${P_}color:#6a7590;">Work done is ${(F.work_done / F.contract * 100).toFixed(2)}% of the contract sum. The complete valuation is in the enclosed Excel file.</p>`);

  const H = historyTo(history, ipc);
  out.push(`<h2 style="${H2}">2. Previous applications and certificates</h2>`);
  out.push(H.length > 1 ? tbl(['Ref', 'Period', 'Applied — net', 'Certified — net', 'Received', 'Status'],
    H.filter((h) => h.id !== ipc.id).map((h) => [esc(h.ref), esc(pd(h.period_from) + ' – ' + pd(h.period_to)), money(h.net),
      h.certified_net != null && h.certified_net !== '' ? money(h.certified_net) : 'awaiting', num0(h.paid_amount) ? money(h.paid_amount) : '—', esc(h.status)]), [2, 3, 4])
    : `<p style="${P_}">This is the first application.</p>`);

  out.push(`<h2 style="${H2}">3. Retention and advance payment</h2>`);
  let pr = 0, pa = 0;
  out.push(tbl(['Ref', 'Retention to date', 'This application', 'Advance recovered to date', 'This application'],
    H.map((h) => { const row = [esc(h.ref), money(h.retention), money(num0(h.retention) - pr), money(h.advance_recovery), money(num0(h.advance_recovery) - pa)];
      pr = num0(h.retention); pa = num0(h.advance_recovery); return row; }), [1, 2, 3, 4]));
  if (num0(T.advance_amount)) {
    out.push(`<p style="${P_}color:#6a7590;">Advance payment ${cur} ${money(T.advance_amount)}; recovered to date ${money(F.advance)}; balance ${money(num0(T.advance_amount) - F.advance)}.</p>`);
  }

  out.push(`<h2 style="${H2}">4. Variations</h2>`);
  const vos = detail.variations || [];
  out.push(vos.length ? tbl(['Ref', 'Description', 'Approved amount', '% complete', 'Value to date'],
    vos.map((v) => [esc(v.ref), esc(v.title), money(v.amount), num0(v.pct).toFixed(1) + '%', money(v.value)]), [2, 3, 4])
    : `<p style="${P_}">No variations are claimed in this application.</p>`);

  out.push(`<h2 style="${H2}">5. Materials on site</h2>`);
  const mos = detail.mos || [];
  out.push(mos.length ? tbl(['Material', 'Qty', 'Rate', 'Cost', 'Paid at', 'Value', 'Delivery note / GRN'],
    mos.map((m) => [esc(m.material), esc(m.qty + ' ' + (m.unit || '')), money(m.rate), money(m.cost), num0(m.paid_pct) + '%', money(m.value), esc(m.ref || '—')]), [2, 3, 4, 5])
    : `<p style="${P_}">No materials on site are claimed in this application.</p>`);

  out.push(`<h2 style="${H2}">6. Inspections approved in the period</h2>`);
  const w = x.inspections || [];
  out.push(w.length ? tbl(['Ref', 'Subject', 'Result', 'Recorded'], w.map((r) => [esc(r.ref), esc(r.title), esc(r.status), esc(pd(r.date))]))
    : `<p style="${P_}">No inspection requests were approved in the period.</p>`);

  if (x.contents) {
    out.push(`<h2 style="${H2}">7. Contents of this submission</h2>`);
    out.push(tbl(['Document', 'File', ''], x.contents.map((cRow) => [esc(cRow.what), esc(cRow.file || '—'),
      cRow.missing ? `<span style="color:#b6761d;">${esc(cRow.missing)}</span>` : 'enclosed'])));
  }

  out.push(`<h2 style="${H2}">Prepared and approved</h2>`);
  out.push(tbl(['', 'Name', 'Date'], [
    ['Prepared by (Quantity Surveyor)', esc(ipc.reviewed_by || ipc.created_by || ''), esc(pd((ipc.created_at || '').slice(0, 10)))],
    ['Approved by (Project Manager)', esc(ipc.approved_by || '—'), esc(pd((ipc.approved_at || '').slice(0, 10)) || '—')],
    ['Issued by (Document Control)', esc(ipc.issued_by || '—'), esc(pd(ipc.submitted) || '—')],
  ]));
  return `<div style="font-family:Arial,Helvetica,sans-serif;color:#1b2437;max-width:900px;margin:0 auto;">${out.join('\n')}</div>`;
}

export function ipcDocumentWord(ipc, project, history, extra) {
  return `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><title>${esc(ipc.ref)} — ${esc((project || {}).name || '')}</title>
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]-->
<style>@page Section1 { size: 595.3pt 841.9pt; margin: 36pt 32pt; } div.Section1 { page: Section1; } table { border-collapse: collapse; }</style></head>
<body><div class="Section1">${ipcDocumentHTML(ipc, project, history, extra)}</div></body></html>`;
}

/* --------------------------------------------------- what goes with it */

// Inspection requests (WIR / MIR) whose result was recorded in the period and
// that passed.
async function approvedInspections(env, pid, from, to) {
  try {
    const { results } = await env.DB.prepare(
      `SELECT ref, title, status, workflow, step FROM records WHERE project_id = ? AND type IN ('wir','mir') ORDER BY ref`
    ).bind(pid).all();
    const out = [];
    for (const r of results || []) {
      const wf = parse(r.workflow, []);
      if ((r.step || 0) < wf.length - 1) continue;                   // still open
      if (!/approved|code a|code b|pass|accepted/i.test(r.status || '') || /reject|code c|code d|fail/i.test(r.status || '')) continue;
      const when = String((wf[wf.length - 1] || {}).when || '').slice(0, 10);
      if (when && when >= from && when <= to) out.push({ ref: r.ref, title: r.title, status: r.status, date: when });
    }
    return out;
  } catch (e) { return []; }
}

async function photosIn(env, pid, from, to) {
  try {
    const { results } = await env.DB.prepare(
      `SELECT id, activity_id, report_date, caption, mime, data FROM photos
        WHERE project_id = ? AND report_date BETWEEN ? AND ? ORDER BY report_date, created_at LIMIT 300`
    ).bind(pid, from, to).all();
    return results || [];
  } catch (e) { return []; }
}

function dataUrlBytes(d) {
  const m = /^data:([^;,]+);base64,(.*)$/s.exec(String(d || ''));
  if (!m) return null;
  const bin = atob(m[2]);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return { mime: m[1], bytes: u8 };
}
const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic' };

export async function buildIpcPack(env, pid, project, ipc, history) {
  const p = project || {};
  const root = safeName(`${ipc.ref} - ${p.name || 'Project'}`) + '/';
  const files = [];
  let total = 0;
  const skipped = [];
  const add = (name, bytes) => {
    if (total + bytes.length > MAX_PACK) { skipped.push(name); return false; }
    files.push({ name: root + name, data: bytes }); total += bytes.length; return true;
  };
  const used = new Set();
  const unique = (name) => { let n = name, i = 2; while (used.has(n)) { n = name.replace(/(\.[^.]*)?$/, ` (${i++})$1`); } used.add(n); return n; };
  const contents = [];

  // Excel first — it is the heart of the application.
  const xlsxName = `02 BOQ valuation ${safeName(ipc.ref)}.xlsx`;
  add(xlsxName, ipcWorkbook(ipc, p, history));
  contents.push({ what: 'Complete BOQ valuation, summary, variations, materials on site, certificates, retention and advance (Excel)', file: xlsxName });

  // The progress report for the same period.
  let reportName = '';
  try {
    const rep = await buildPeriodReport(env, pid, p, ipc.period_from, ipc.period_to);
    reportName = `03 Progress report ${ipc.period_from} to ${ipc.period_to}.doc`;
    add(reportName, enc.encode(reportWord(rep)));
    contents.push({ what: 'Progress report for the period (programme, S-curve, registers, site diary)', file: reportName });
  } catch (e) {
    contents.push({ what: 'Progress report for the period', missing: 'could not be produced — no valid period' });
  }

  // Photographs from site in the period.
  const photos = await photosIn(env, pid, ipc.period_from, ipc.period_to);
  let nPhotos = 0;
  for (const ph of photos) {
    const d = dataUrlBytes(ph.data);
    if (!d) continue;
    const name = unique(`04 Photographs/${ph.report_date} ${safeName(ph.activity_id || '')} ${safeName(ph.caption || ph.id).slice(0, 60)}`.replace(/\s+/g, ' ').trim() + '.' + (EXT[d.mime] || 'jpg'));
    if (add(name, d.bytes)) nPhotos++;
  }
  contents.push(nPhotos ? { what: `Progress photographs for the period (${nPhotos})`, file: '04 Photographs/' }
    : { what: 'Progress photographs for the period', missing: 'none were taken in the period' });

  // Approved inspections, with their attachments.
  const inspections = await approvedInspections(env, pid, ipc.period_from, ipc.period_to);
  let nInsp = 0;
  for (const w of inspections) {
    for (const a of await listAttachments(env, pid, w.ref)) {
      const f = await getAttachment(env, pid, a.id);
      if (f && add(unique(`05 Inspections/${safeName(w.ref)}/${safeName(a.filename)}`), new Uint8Array(f.bytes))) nInsp++;
    }
  }
  contents.push(inspections.length
    ? { what: `Approved inspection requests (${inspections.length}), listed in section 6${nInsp ? ', with ' + nInsp + ' attachment' + (nInsp === 1 ? '' : 's') : ''}`, file: nInsp ? '05 Inspections/' : '' }
    : { what: 'Approved inspection requests (WIR/MIR)', missing: 'none approved in the period' });

  // Each claimed variation's back-up.
  const vos = (ipc.detail && ipc.detail.variations) || [];
  let nVo = 0;
  for (const v of vos) {
    for (const a of await listAttachments(env, pid, v.ref)) {
      const f = await getAttachment(env, pid, a.id);
      if (f && add(unique(`06 Variations/${safeName(v.ref)}/${safeName(a.filename)}`), new Uint8Array(f.bytes))) nVo++;
    }
  }
  if (vos.length) contents.push({ what: `Variation back-up (${vos.length} variation${vos.length === 1 ? '' : 's'})`, file: nVo ? '06 Variations/' : '', missing: nVo ? '' : 'no documents attached to the variations' });

  // What the QS attached to the application: take-off sheets, day-works, delivery notes.
  const own = await listAttachments(env, pid, ipc.ref);
  let nOwn = 0;
  for (const a of own) {
    const f = await getAttachment(env, pid, a.id);
    if (f && add(unique(`07 Supporting documents/${safeName(a.filename)}`), new Uint8Array(f.bytes))) nOwn++;
  }
  contents.push(nOwn ? { what: `Measurement sheets, day-works and other supporting documents (${nOwn})`, file: '07 Supporting documents/' }
    : { what: 'Measurement sheets, day-works and other supporting documents', missing: 'none attached to the application' });

  if (skipped.length) contents.push({ what: `${skipped.length} file(s) left out`, missing: 'the pack reached 150 MB — send these separately' });

  // The letter goes in last, because it lists everything above.
  const docName = `01 Payment application ${safeName(ipc.ref)}.doc`;
  contents.unshift({ what: 'Covering letter, summary, statements and this list', file: docName });
  files.unshift({ name: root + docName, data: enc.encode(ipcDocumentWord(ipc, p, history, { inspections, contents })) });

  return { bytes: zip(files), filename: safeName(`${ipc.ref} - ${p.name || 'Project'}`) + '.zip', contents, files: files.length, skipped };
}
