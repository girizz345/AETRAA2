// Word consultant forms for the E16 tests, built as a consultant sends them:
// the last job's values still typed in, no {{placeholders}}, labels in tables.
import { zipSync, strToU8 } from 'fflate';

const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export const run = (t, bold) => '<w:r>' + (bold ? '<w:rPr><w:b/><w:sz w:val="20"/></w:rPr>' : '<w:rPr><w:sz w:val="20"/></w:rPr>') + '<w:t xml:space="preserve">' + esc(t) + '</w:t></w:r>';
export const para = (t, bold) => '<w:p><w:pPr><w:jc w:val="left"/></w:pPr>' + (t ? run(t, bold) : '') + '</w:p>';
// cell(text, { span, bold, vmerge: 'restart' | 'continue' })
export const cell = (t, o = {}) => '<w:tc><w:tcPr><w:tcW w:w="2400" w:type="dxa"/>'
  + (o.span ? '<w:gridSpan w:val="' + o.span + '"/>' : '')
  + (o.vmerge === 'restart' ? '<w:vMerge w:val="restart"/>' : o.vmerge === 'continue' ? '<w:vMerge/>' : '')
  + '</w:tcPr>' + String(t).split('\n').map((l) => para(l, o.bold)).join('') + '</w:tc>';
export const row = (...cells) => '<w:tr>' + cells.join('') + '</w:tr>';
export const table = (cols, ...rows) => '<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/></w:tblPr><w:tblGrid>'
  + Array.from({ length: cols }, () => '<w:gridCol w:w="2400"/>').join('') + '</w:tblGrid>' + rows.join('') + '</w:tbl>';
export function docx(bodyXml, extra = {}) {
  return zipSync({
    '[Content_Types].xml': strToU8('<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'),
    'word/document.xml': strToU8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ' + W + '><w:body>' + bodyXml + '<w:sectPr/></w:body></w:document>'),
    ...extra,
  });
}

// A consultant's RFI form, last used on another job.
export function rfiForm() {
  return docx(
    para('REQUEST FOR INFORMATION', true)
    + table(4,
      row(cell('Project:', { bold: true }), cell('Old Tower Residences'), cell('RFI No:', { bold: true }), cell('RFI-0099')),
      row(cell('Date:', { bold: true }), cell('01/01/2025'), cell('Discipline:', { bold: true }), cell('Structural')),
      row(cell('Subject:', { bold: true }), cell('Old subject from the last job', { span: 3 })),
      row(cell('Description of required information', { span: 4, bold: true })),
      row(cell('The previous job’s question\nover two lines', { span: 4 })),
      row(cell('Location of the works:', { bold: true }), cell('Basement 2, grid C', { span: 3 })),
      row(cell('Attachments', { bold: true }), cell('Drawing ST-101', { span: 3 })),
      row(cell('Raised by (Name & Signature):', { bold: true }), cell('J. Old'), cell('Date:', { bold: true }), cell('02/01/2025')))
    + para('FOR CONSULTANT’S USE', true)
    + table(2,
      row(cell('Consultant’s response:', { bold: true }), cell('Answered last time')),
      row(cell('Signature:', { bold: true }), cell('A. Engineer'))));
}

// A form that already uses {{tokens}} and has no label table.
export function tokenForm() {
  return docx(para('TRANSMITTAL') + para('Ref: {{ref}}') + para('Subject: {{subject}}') + para('Remarks: {{remarks}} and {{site_contact}}')
    + para('Signed {{sign:1}} on {{sign_date:1}}; approved {{sign:9}}') + para('Old style <<drawing_list>> here'));
}
