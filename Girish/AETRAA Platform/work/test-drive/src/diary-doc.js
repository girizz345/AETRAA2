// The diary as a document — the printable sheet, and the Word file.
//
// Both are built from the same record, so they can never say different things.
// The HTML is the exact layout that is issued; the .docx carries the same
// content in the same order for anyone who needs to change wording first.

import { WEATHER, totals, sumSubs, slashDate, longDate, dayName } from './diary.js';

// A gang line carries a position and a count. A line from an older diary, or
// read out of an issued Word sheet, carries staff and labour instead — and both
// have to print, because the folder of issued diaries has months of each.
const isGang = (r) => r && r.c !== undefined && r.c !== null && r.c !== '';
const subPosition = (r) => (isGang(r) ? (r.p || '')
  : (Number(r.s) > 0 && Number(r.l) > 0 ? 'Staff + labour'
    : Number(r.s) > 0 ? 'Eng / Foreman' : Number(r.l) > 0 ? 'Labour' : ''));
const subCount = (r) => {
  if (!r) return '';
  const n = isGang(r) ? Number(r.c) : (Number(r.s) || 0) + (Number(r.l) || 0);
  return n ? String(n) : '';
};

const esc = (v) =>
  String(v === null || v === undefined ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const n0 = (v) => (Number(v) ? String(Number(v)) : '');
const pad = (arr, to) => [...arr, ...Array(Math.max(0, to - arr.length)).fill(null)];

/* ============================================================ the sheet */

const RULE = '#7a869c';
const INK = '#111827';

export function diaryHTML(project, d) {
  const roster = d.roster || { trades: [], plant: [] };
  const t = d.totals || totals(d.staff || [], roster.trades);
  const subTotal = d.subTotal === undefined ? sumSubs(d.subs || []) : d.subTotal;
  const weather = String(d.weather || '').split(',').map((s) => s.trim()).filter(Boolean);

  const cell = `border:1px solid ${RULE};padding:2px 4px;font-size:8.5pt;line-height:1.25;`;
  const head = cell + 'background:#e9edf4;font-weight:700;text-align:center;font-size:8pt;';
  const numc = cell + 'text-align:center;width:26px;';

  // The labour record is two columns of the same table, as on the sheet.
  const staff = d.staff || [];
  const half = Math.ceil(staff.length / 2);
  const left = staff.slice(0, half);
  const right = pad(staff.slice(half), left.length);

  const logo = (src, w) => (src
    ? `<img src="${esc(src)}" style="max-height:34px;max-width:${w}px;object-fit:contain;">`
    : '');

  const listRows = (rows, min, cols) => {
    const out = pad((rows || []).slice(0, Math.max(min, (rows || []).length)), min);
    return out.map((r, i) => `<tr>
      <td style="${numc}">${r ? i + 1 : ''}</td>
      ${cols(r)}
    </tr>`).join('');
  };

  return `<div class="sheet-in" style="font-family:Arial,Helvetica,sans-serif;color:${INK};">

  <table style="width:100%;border-collapse:collapse;margin-bottom:4px;">
    <tr>
      <td style="width:28%;text-align:left;vertical-align:middle;">${logo(project.logo_consultant, 180)}
        ${project.logo_consultant2 ? '<div style="font-size:7pt;color:#667;margin:2px 0">&amp;</div>' + logo(project.logo_consultant2, 180) : ''}</td>
      <td style="text-align:center;vertical-align:middle;padding:0 6px;">
        <div style="font-size:13pt;font-weight:700;letter-spacing:.04em;">DAILY SITE DIARY</div>
        <div style="font-size:8pt;font-weight:700;margin-top:2px;">PROGRESS REPORT</div>
      </td>
      <td style="width:28%;text-align:right;vertical-align:middle;">${logo(project.logo_contractor, 190)}</td>
    </tr>
  </table>

  <table style="width:100%;border-collapse:collapse;margin-bottom:5px;">
    <tr>
      <td style="${cell}font-size:8pt;"><b>Project:</b> ${esc(project.name || '')}${project.ref ? ' — ' + esc(project.ref) : ''}</td>
      <td style="${cell}font-size:8pt;width:150px;text-align:right;"><b>Day:</b> ${esc(dayName(d.report_date))} &nbsp; ${esc(slashDate(d.report_date))}</td>
    </tr>
  </table>

  <table style="width:100%;border-collapse:collapse;table-layout:fixed;">
   <tr>
    <!-- ============ left: labour ============ -->
    <td style="width:52%;vertical-align:top;padding-right:5px;">
      <div style="${head}border-bottom:0;padding:3px;">ON SITE STAFF &amp; LABOUR RECORD</div>
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="${head}width:22px;">No.</td><td style="${head}">TRADE</td>
          <td style="${head}width:30px;">No.</td><td style="${head}width:32px;">Hrs</td>
          <td style="${head}width:22px;">No.</td><td style="${head}">TRADE</td>
          <td style="${head}width:30px;">No.</td><td style="${head}width:32px;">Hrs</td>
        </tr>
        ${left.map((r, i) => {
          const o = right[i];
          return `<tr>
            <td style="${numc}">${i + 1}</td><td style="${cell}">${esc(r.t)}</td>
            <td style="${cell}text-align:center;font-weight:600;">${n0(r.n)}</td><td style="${cell}text-align:center;">${esc(r.h || '')}</td>
            <td style="${numc}">${o ? half + i + 1 : ''}</td><td style="${cell}">${o ? esc(o.t) : ''}</td>
            <td style="${cell}text-align:center;font-weight:600;">${o ? n0(o.n) : ''}</td><td style="${cell}text-align:center;">${o ? esc(o.h || '') : ''}</td>
          </tr>`;
        }).join('')}
        <tr>
          <td colspan="5" style="${cell}text-align:right;font-weight:700;">GRAND TOTAL</td>
          <td colspan="3" style="${cell}text-align:center;font-weight:700;font-size:10pt;">${t.total}</td>
        </tr>
        <tr>
          <td colspan="5" style="${cell}text-align:right;font-weight:700;">Productive Manpower</td>
          <td colspan="3" style="${cell}text-align:center;font-weight:700;font-size:10pt;">${t.productive}</td>
        </tr>
      </table>

      <div style="${head}margin-top:5px;padding:3px;">SUB-CONTRACTOR LABOUR</div>
      <table style="width:100%;border-collapse:collapse;">
        <tr><td style="${head}">SUB-CONTRACTOR</td>
            <td style="${head}width:88px;">TRADE</td>
            <td style="${head}width:74px;">POSITION</td>
            <td style="${head}width:34px;">NO.</td>
            <td style="${head}width:34px;">HRS</td></tr>
        ${pad((d.subs || []), 6).map((r) => `<tr>
          <td style="${cell}">${r ? esc(r.n) : '&nbsp;'}</td>
          <td style="${cell}">${r ? esc(r.t || '') : ''}</td>
          <td style="${cell}">${r ? esc(subPosition(r)) : ''}</td>
          <td style="${cell}text-align:center;">${r ? esc(subCount(r)) : ''}</td>
          <td style="${cell}text-align:center;">${r ? esc(r.h || '') : ''}</td></tr>`).join('')}
        <tr><td colspan="3" style="${cell}text-align:right;font-weight:700;">SUB-CONTRACTOR TOTAL</td>
            <td colspan="2" style="${cell}text-align:center;font-weight:700;">${subTotal}</td></tr>
      </table>
    </td>

    <!-- ============ right: weather, plant, materials ============ -->
    <td style="width:48%;vertical-align:top;">
      <table style="width:100%;border-collapse:collapse;margin-bottom:5px;">
        <tr>
          <td style="${head}width:62px;">WEATHER</td>
          ${WEATHER.map((w) => `<td style="${cell}text-align:center;${weather.includes(w) ? 'background:#dbeafe;font-weight:700;' : 'color:#7a869c;'}">
            ${weather.includes(w) ? '&#10003; ' : ''}${esc(w)}</td>`).join('')}
        </tr>
      </table>

      <div style="${head}padding:3px;">ON SITE PLANT &amp; EQUIPMENT</div>
      <table style="width:100%;border-collapse:collapse;">
        <tr><td style="${head}width:22px;">No.</td><td style="${head}">CATEGORY</td>
            <td style="${head}width:30px;">No.</td><td style="${head}width:32px;">Hrs</td></tr>
        ${(d.plant || []).map((r, i) => `<tr>
          <td style="${numc}">${i + 1}</td><td style="${cell}">${esc(r.t)}</td>
          <td style="${cell}text-align:center;font-weight:600;">${n0(r.n)}</td>
          <td style="${cell}text-align:center;">${esc(r.h || '')}</td></tr>`).join('')}
      </table>

      <div style="${head}margin-top:5px;padding:3px;">DELIVERY OF MATERIALS</div>
      <table style="width:100%;border-collapse:collapse;">
        <tr><td style="${head}width:22px;">No.</td><td style="${head}">MATERIAL</td>
            <td style="${head}width:52px;">Qty.</td><td style="${head}width:44px;">Unit</td></tr>
        ${listRows(d.materials, 6, (r) => `
          <td style="${cell}">${r ? esc(r.m) + (r.s || r.dn || r.b ? ' <span style="color:#555">(' + esc([r.s, r.dn ? 'DN ' + r.dn : '', r.b ? 'batch ' + r.b : ''].filter(Boolean).join(', ')) + ')</span>' : '') : '&nbsp;'}</td>
          <td style="${cell}text-align:center;">${r ? esc(r.q) : ''}</td>
          <td style="${cell}text-align:center;">${r ? esc(r.u) : ''}</td>`)}
      </table>
    </td>
   </tr>
  </table>

  <table style="width:100%;border-collapse:collapse;table-layout:fixed;margin-top:5px;">
   <tr>
    <td style="vertical-align:top;">
      <div style="${head}padding:3px;">EXPECTED WORKS TOMORROW</div>
      <table style="width:100%;border-collapse:collapse;">
        <tr><td style="${head}width:22px;">No.</td><td style="${head}">ACTIVITY</td><td style="${head}width:44px;">Qty.</td></tr>
        ${listRows(d.tomorrow, 9, (r) => `
          <td style="${cell}">${r ? esc(r.a) : '&nbsp;'}</td>
          <td style="${cell}text-align:center;">${r ? esc(r.q) : ''}</td>`)}
      </table>
    </td>
   </tr>
  </table>

  ${(d.remarks || d.problems || d.visitors) ? `<table style="width:100%;border-collapse:collapse;margin-top:5px;">
    ${d.remarks ? `<tr><td style="${head}width:80px;">REMARKS</td><td style="${cell}white-space:pre-wrap;">${esc(d.remarks)}</td></tr>` : ''}
    ${d.problems ? `<tr><td style="${head}width:80px;">PROBLEMS</td><td style="${cell}white-space:pre-wrap;">${esc(d.problems)}</td></tr>` : ''}
    ${d.visitors ? `<tr><td style="${head}width:80px;">VISITORS</td><td style="${cell}white-space:pre-wrap;">${esc(d.visitors)}</td></tr>` : ''}
  </table>` : ''}

  <table style="width:100%;border-collapse:collapse;margin-top:6px;">
    <tr>
      <td style="${cell}width:50%;height:54px;vertical-align:top;">
        <div style="font-size:8pt;"><b>Submission:</b> Daily Report ${esc(slashDate(d.report_date))}</div>
        <div style="font-size:8pt;margin-top:3px;">Signed by: Project Manager${d.prepared_by ? ' — ' + esc(d.prepared_by) : ''}</div>
        <div style="font-size:8pt;margin-top:16px;">Signature:</div>
      </td>
      <td style="${cell}width:50%;height:54px;vertical-align:top;">
        <div style="font-size:8pt;"><b>AGREED:</b></div>
        <div style="font-size:8pt;margin-top:3px;">Signed by:</div>
        <div style="font-size:8pt;margin-top:16px;">Signature:</div>
      </td>
    </tr>
  </table>
</div>`;
}

// The photo page — what site attached that day, with the time each was taken.
export function photoPageHTML(project, day, photos) {
  if (!photos || !photos.length) return '';
  const cell = photos.map((p) => {
    const time = p.created_at
      ? new Date(p.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Dubai' })
      : '';
    return `<td style="width:33.33%;padding:5px;vertical-align:top;">
      <img src="/photo/${esc(p.id)}" style="width:100%;height:auto;border:1px solid #7a869c;display:block;">
      <div style="font-size:7.5pt;margin-top:2px;line-height:1.3;">
        ${time ? 'Time: ' + esc(time) + '<br>' : ''}Date: ${esc(slashDate(day))}
        ${p.caption ? '<br>' + esc(p.caption) : ''}
        ${p.activity_name ? '<br>Activity: ' + esc(p.activity_name) : ''}${p.location ? '<br>Location: ' + esc(p.location) : ''}
      </div></td>`;
  });
  const rows = [];
  for (let i = 0; i < cell.length; i += 3) {
    rows.push('<tr>' + cell.slice(i, i + 3).join('') +
      Array(Math.max(0, 3 - cell.slice(i, i + 3).length)).fill('<td style="width:33.33%"></td>').join('') + '</tr>');
  }
  return `<div class="sheet-in" style="font-family:Arial,Helvetica,sans-serif;">
    <div style="font-size:12pt;font-weight:700;text-align:center;margin-bottom:6px;">PHOTOS</div>
    <div style="font-size:8.5pt;text-align:center;margin-bottom:8px;">${esc(project.name || '')} &nbsp;·&nbsp; ${esc(slashDate(day))}</div>
    <table style="width:100%;border-collapse:collapse;table-layout:fixed;">${rows.join('')}</table>
  </div>`;
}

/* ============================================================== the .docx */

// A .docx is a ZIP of XML. Workers have no zlib, but ZIP allows stored (uncompressed)
// entries and Word opens those happily — so the archive is written by hand.
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function zip(files) {
  const enc = new TextEncoder();
  const parts = [], central = [];
  let offset = 0;

  const u16 = (n) => [n & 0xFF, (n >>> 8) & 0xFF];
  const u32 = (n) => [n & 0xFF, (n >>> 8) & 0xFF, (n >>> 16) & 0xFF, (n >>> 24) & 0xFF];

  for (const f of files) {
    const name = enc.encode(f.name);
    const data = typeof f.data === 'string' ? enc.encode(f.data) : f.data;
    const crc = crc32(data);
    const local = new Uint8Array([
      0x50, 0x4b, 0x03, 0x04, ...u16(20), ...u16(0), ...u16(0), ...u16(0), ...u16(0),
      ...u32(crc), ...u32(data.length), ...u32(data.length),
      ...u16(name.length), ...u16(0),
    ]);
    parts.push(local, name, data);
    central.push(new Uint8Array([
      0x50, 0x4b, 0x01, 0x02, ...u16(20), ...u16(20), ...u16(0), ...u16(0), ...u16(0), ...u16(0),
      ...u32(crc), ...u32(data.length), ...u32(data.length),
      ...u16(name.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(offset),
    ]), name);
    offset += local.length + name.length + data.length;
  }

  let cdSize = 0;
  for (const c of central) cdSize += c.length;
  const end = new Uint8Array([
    0x50, 0x4b, 0x05, 0x06, ...u16(0), ...u16(0),
    ...u16(files.length), ...u16(files.length), ...u32(cdSize), ...u32(offset), ...u16(0),
  ]);

  const all = [...parts, ...central, end];
  let total = 0;
  for (const p of all) total += p.length;
  const out = new Uint8Array(total);
  let at = 0;
  for (const p of all) { out.set(p, at); at += p.length; }
  return out;
}

const xesc = (v) =>
  String(v === null || v === undefined ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');

const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';

function p(text, opts = {}) {
  const { bold, size = 17, align, shade, after = 0 } = opts;
  return `<w:p><w:pPr>${align ? `<w:jc w:val="${align}"/>` : ''}` +
    `<w:spacing w:before="0" w:after="${after}" w:line="200" w:lineRule="atLeast"/>` +
    (shade ? `<w:shd w:val="clear" w:fill="${shade}"/>` : '') +
    `</w:pPr><w:r><w:rPr>${bold ? '<w:b/>' : ''}<w:sz w:val="${size}"/><w:szCs w:val="${size}"/>` +
    `<w:rFonts w:ascii="Arial" w:hAnsi="Arial"/></w:rPr><w:t xml:space="preserve">${xesc(text)}</w:t></w:r></w:p>`;
}

function tc(text, opts = {}) {
  const { w = 1000, bold, align, shade, span } = opts;
  return `<w:tc><w:tcPr><w:tcW w:w="${w}" w:type="dxa"/>` +
    (span ? `<w:gridSpan w:val="${span}"/>` : '') +
    (shade ? `<w:shd w:val="clear" w:color="auto" w:fill="${shade}"/>` : '') +
    `<w:vAlign w:val="center"/></w:tcPr>${p(text, { bold, align, size: 16 })}</w:tc>`;
}

function table(rows, widths) {
  const grid = widths.map((w) => `<w:gridCol w:w="${w}"/>`).join('');
  const border = (s) => `<w:${s} w:val="single" w:sz="4" w:space="0" w:color="7A869C"/>`;
  // Percentage width, so the tables fill the page whatever the margins are —
  // the cell widths below then act as proportions.
  return `<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/><w:tblLayout w:type="fixed"/><w:tblBorders>` +
    ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map(border).join('') +
    `</w:tblBorders><w:tblCellMar>` +
    `<w:top w:w="20" w:type="dxa"/><w:left w:w="60" w:type="dxa"/>` +
    `<w:bottom w:w="20" w:type="dxa"/><w:right w:w="60" w:type="dxa"/>` +
    `</w:tblCellMar></w:tblPr><w:tblGrid>${grid}</w:tblGrid>` +
    rows.map((r) => `<w:tr>${r}</w:tr>`).join('') + '</w:tbl>';
}

const HEAD_FILL = 'E9EDF4';

export function diaryDocx(project, d, opts = {}) {
  const roster = d.roster || { trades: [], plant: [] };
  const t = d.totals || totals(d.staff || [], roster.trades);
  const subTotal = d.subTotal === undefined ? sumSubs(d.subs || []) : d.subTotal;
  const weather = String(d.weather || '').split(',').map((s) => s.trim()).filter(Boolean);

  const body = [];
  body.push(p('DAILY SITE DIARY — PROGRESS REPORT', { bold: true, size: 26, align: 'center', after: 40 }));
  body.push(p(project.name || '', { bold: true, size: 18, align: 'center', after: 20 }));
  body.push(p(`${dayName(d.report_date)}  ·  ${slashDate(d.report_date)}` +
              (project.ref ? '   ·   ' + project.ref : ''), { size: 17, align: 'center', after: 120 }));

  // Labour
  body.push(p('ON SITE STAFF & LABOUR RECORD', { bold: true, size: 19, after: 40 }));
  const staff = d.staff || [];
  const half = Math.ceil(staff.length / 2);
  const sRows = [
    ['No.', 'TRADE', 'No.', 'Hrs', 'No.', 'TRADE', 'No.', 'Hrs']
      .map((h, i) => tc(h, { bold: true, align: 'center', shade: HEAD_FILL, w: [400, 2400, 500, 500, 400, 2400, 500, 500][i] })).join(''),
  ];
  for (let i = 0; i < half; i++) {
    const l = staff[i], r = staff[half + i];
    sRows.push(
      tc(String(i + 1), { w: 400, align: 'center' }) + tc(l ? l.t : '', { w: 2400 }) +
      tc(l && l.n ? String(l.n) : '', { w: 500, align: 'center', bold: true }) + tc(l ? l.h || '' : '', { w: 500, align: 'center' }) +
      tc(r ? String(half + i + 1) : '', { w: 400, align: 'center' }) + tc(r ? r.t : '', { w: 2400 }) +
      tc(r && r.n ? String(r.n) : '', { w: 500, align: 'center', bold: true }) + tc(r ? r.h || '' : '', { w: 500, align: 'center' })
    );
  }
  sRows.push(tc('GRAND TOTAL', { span: 5, w: 4200, align: 'right', bold: true }) +
             tc(String(t.total), { span: 3, w: 3400, align: 'center', bold: true }));
  sRows.push(tc('Productive Manpower', { span: 5, w: 4200, align: 'right', bold: true }) +
             tc(String(t.productive), { span: 3, w: 3400, align: 'center', bold: true }));
  body.push(table(sRows, [400, 2400, 500, 500, 400, 2400, 500, 500]));
  body.push(p('', { after: 100 }));

  // Weather
  body.push(table([
    tc('WEATHER', { bold: true, w: 1200, shade: HEAD_FILL }) +
    WEATHER.map((w) => tc((weather.includes(w) ? '✓ ' : '') + w,
      { w: 1400, align: 'center', bold: weather.includes(w), shade: weather.includes(w) ? 'DBEAFE' : undefined })).join(''),
  ], [1200, 1400, 1400, 1400, 1400, 1400]));
  body.push(p('', { after: 100 }));

  // Plant
  body.push(p('ON SITE PLANT & EQUIPMENT', { bold: true, size: 19, after: 40 }));
  body.push(table([
    ['No.', 'CATEGORY', 'No.', 'Hrs'].map((h, i) =>
      tc(h, { bold: true, align: 'center', shade: HEAD_FILL, w: [500, 5000, 700, 700][i] })).join(''),
    ...(d.plant || []).map((r, i) =>
      tc(String(i + 1), { w: 500, align: 'center' }) + tc(r.t, { w: 5000 }) +
      tc(r.n ? String(r.n) : '', { w: 700, align: 'center', bold: true }) + tc(r.h || '', { w: 700, align: 'center' })),
  ], [500, 5000, 700, 700]));
  body.push(p('', { after: 100 }));

  // Materials
  body.push(p('DELIVERY OF MATERIALS', { bold: true, size: 19, after: 40 }));
  body.push(table([
    ['No.', 'MATERIAL', 'Qty.', 'Unit'].map((h, i) =>
      tc(h, { bold: true, align: 'center', shade: HEAD_FILL, w: [500, 4600, 1000, 800][i] })).join(''),
    ...pad(d.materials || [], 4).map((r, i) =>
      tc(r ? String(i + 1) : '', { w: 500, align: 'center' }) + tc(r ? r.m + (r.s || r.dn || r.b ? ' (' + [r.s, r.dn ? 'DN ' + r.dn : '', r.b ? 'batch ' + r.b : ''].filter(Boolean).join(', ') + ')' : '') : '', { w: 4600 }) +
      tc(r ? r.q : '', { w: 1000, align: 'center' }) + tc(r ? r.u : '', { w: 800, align: 'center' })),
  ], [500, 4600, 1000, 800]));
  body.push(p('', { after: 100 }));

  // Tomorrow. No works section (v5 A12; Ajay, 6 Oct 2026, decision 12).
  for (const [title, rows, min] of [
    ['EXPECTED WORKS TOMORROW', d.tomorrow, 6],
  ]) {
    body.push(p(title, { bold: true, size: 19, after: 40 }));
    body.push(table([
      ['No.', 'ACTIVITY', 'Qty.'].map((h, i) =>
        tc(h, { bold: true, align: 'center', shade: HEAD_FILL, w: [500, 5600, 800][i] })).join(''),
      ...pad(rows || [], min).map((r, i) =>
        tc(r ? String(i + 1) : '', { w: 500, align: 'center' }) + tc(r ? r.a : '', { w: 5600 }) +
        tc(r ? r.q : '', { w: 800, align: 'center', bold: true })),
    ], [500, 5600, 800]));
    body.push(p('', { after: 100 }));
  }

  // Subcontractors
  body.push(p('SUB-CONTRACTOR LABOUR', { bold: true, size: 19, after: 40 }));
  const SUBW = [3300, 1900, 1500, 700, 700];
  body.push(table([
    ['SUB-CONTRACTOR', 'TRADE', 'POSITION', 'NO.', 'HRS'].map((h, i) =>
      tc(h, { bold: true, align: 'center', shade: HEAD_FILL, w: SUBW[i] })).join(''),
    ...pad(d.subs || [], 4).map((r) =>
      tc(r ? r.n : '', { w: SUBW[0] }) +
      tc(r ? r.t || '' : '', { w: SUBW[1] }) +
      tc(r ? subPosition(r) : '', { w: SUBW[2] }) +
      tc(r ? subCount(r) : '', { w: SUBW[3], align: 'center' }) +
      tc(r ? r.h || '' : '', { w: SUBW[4], align: 'center' })),
    tc('SUB-CONTRACTOR TOTAL', { span: 3, w: 6700, align: 'right', bold: true }) +
      tc(String(subTotal), { span: 2, w: 1400, align: 'center', bold: true }),
  ], SUBW));
  body.push(p('', { after: 100 }));

  if (d.remarks) {
    body.push(p('REMARKS', { bold: true, size: 19, after: 40 }));
    for (const line of String(d.remarks).split('\n')) body.push(p(line, { size: 17 }));
    body.push(p('', { after: 100 }));
  }
  if (d.problems) {
    body.push(p('PROBLEMS', { bold: true, size: 19, after: 40 }));
    for (const line of String(d.problems).split('\n')) body.push(p(line, { size: 17 }));
    body.push(p('', { after: 100 }));
  }
  if (d.visitors) {
    body.push(p('VISITORS', { bold: true, size: 19, after: 40 }));
    for (const line of String(d.visitors).split('\n')) body.push(p(line, { size: 17 }));
    body.push(p('', { after: 100 }));
  }

  body.push(table([
    tc(`Submission: Daily Report ${slashDate(d.report_date)}`, { w: 4450, bold: true }) +
      tc('AGREED:', { w: 4450, bold: true }),
    tc(`Signed by: Project Manager${d.prepared_by ? ' — ' + d.prepared_by : ''}`, { w: 4450 }) +
      tc('Signed by:', { w: 4450 }),
    tc('Signature:', { w: 4450 }) + tc('Signature:', { w: 4450 }),
  ], [4450, 4450]));

  const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document ${W}><w:body>${body.join('')}
<w:sectPr><w:pgSz w:w="11906" w:h="16838"/>
<w:pgMar w:top="680" w:right="680" w:bottom="680" w:left="680" w:header="0" w:footer="0" w:gutter="0"/>
</w:sectPr></w:body></w:document>`;

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`;

  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

  const docRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles ${W}><w:docDefaults><w:rPrDefault><w:rPr>
<w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="17"/><w:szCs w:val="17"/>
</w:rPr></w:rPrDefault><w:pPrDefault><w:pPr>
<w:spacing w:after="0" w:line="200" w:lineRule="atLeast"/></w:pPr></w:pPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>
</w:styles>`;

  return zip([
    { name: '[Content_Types].xml', data: contentTypes },
    { name: '_rels/.rels', data: rels },
    { name: 'word/document.xml', data: document },
    { name: 'word/_rels/document.xml.rels', data: docRels },
    { name: 'word/styles.xml', data: styles },
  ]);
}

export const diaryFileName = (project, day, ext) =>
  `Daily Site Diary ${slashDate(day).replace(/\//g, '-')}${project.ref ? ' - ' + String(project.ref).replace(/[^\w -]/g, '') : ''}.${ext}`;
