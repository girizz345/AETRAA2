// The consultant-template engine: read a .docx, find its placeholders, fill them.
//   node tools/test-template.mjs
//
// Builds real .docx files in memory (including one where Word has split a
// placeholder across runs, which is what actually happens in practice).
import { zipSync, unzipSync, strToU8, strFromU8 } from 'fflate';
import { repairXml, extractTokens, fillTemplate, buildValues } from '../src/template.js';

let fails = 0;
const check = (n, c, d) => { console.log((c ? '  ok   ' : '  FAIL ') + n + (d && !c ? '  — ' + d : '')); if (!c) fails++; };

const RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`;
const CT = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`;

const para = (runs) => '<w:p>' + runs.map((t) => '<w:r><w:t>' + t + '</w:t></w:r>').join('') + '</w:p>';
function docx(bodyParas, extraParts) {
  const doc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${bodyParas.join('')}</w:body></w:document>`;
  const files = { '[Content_Types].xml': strToU8(CT), '_rels/.rels': strToU8(RELS), 'word/document.xml': strToU8(doc) };
  for (const k of Object.keys(extraParts || {})) files[k] = strToU8(extraParts[k]);
  return zipSync(files, { level: 6 });
}
const bodyText = (bytes) => strFromU8(unzipSync(bytes)['word/document.xml']);

// ---- 1. a clean template ------------------------------------------------
const clean = docx([
  para(['Submittal {{ref}}']),
  para(['Title: {{title}}  Date: {{date}}']),
  para(['Discipline: {{Discipline}}']),
]);
let t = extractTokens(clean);
check('reads a docx', t.ok === true, JSON.stringify(t));
check('finds all tokens', ['ref', 'title', 'date', 'Discipline'].every((x) => t.tokens.includes(x)), JSON.stringify(t.tokens));
check('no duplicates', t.tokens.length === 4, JSON.stringify(t.tokens));

// ---- 2. Word's split runs (the real-world case) -------------------------
// "{{ref}}" typed in Word commonly lands as "{{re" | "f}}" in separate runs.
const split = docx([ para(['Submittal {{re', 'f}} issued']), para(['{{ti', 'tle', '}}']) ]);
check('repairXml stitches a split token', repairXml('<w:t>{{re</w:t><w:t>f}}</w:t>').includes('{{ref}}'));
t = extractTokens(split);
check('finds tokens split across runs', t.ok && t.tokens.includes('ref') && t.tokens.includes('title'), JSON.stringify(t.tokens));

// ---- 3. filling ---------------------------------------------------------
let f = fillTemplate(clean, { ref: 'SUB-001', title: 'L4 formwork drawings', date: '2026-09-19', Discipline: 'Structural' });
check('fill ok', f.ok === true, JSON.stringify(f && f.error));
let txt = bodyText(f.bytes);
check('ref substituted', txt.includes('SUB-001'));
check('title substituted', txt.includes('L4 formwork drawings'));
check('field-by-label substituted', txt.includes('Structural'));
check('no placeholders left', !txt.includes('{{'), txt.slice(0, 200));
check('reports what it filled', f.filled.length === 4, JSON.stringify(f.filled));

// filling the split-run template
f = fillTemplate(split, { ref: 'RFI-0007', title: 'Beam clash' });
txt = bodyText(f.bytes);
check('split token filled', txt.includes('RFI-0007') && txt.includes('Beam clash'), txt.slice(0, 200));

// ---- 4. case / space insensitivity --------------------------------------
const loose = docx([ para(['{{ Spec Section }} / {{REF}}']) ]);
f = fillTemplate(loose, { 'spec section': '03 11 00', ref: 'SUB-9' });
txt = bodyText(f.bytes);
check('matches ignoring case and spacing', txt.includes('03 11 00') && txt.includes('SUB-9'), txt.slice(0, 200));

// ---- 5. unmapped tokens print blank, never "{{x}}" ----------------------
const partial = docx([ para(['{{ref}} — {{not_supplied}}']) ]);
f = fillTemplate(partial, { ref: 'X-1' });
txt = bodyText(f.bytes);
check('unmapped prints blank', txt.includes('X-1') && !txt.includes('{{'), txt.slice(0, 200));
check('reports what was missing', f.missing.includes('not_supplied'), JSON.stringify(f.missing));

// ---- 6. XML-unsafe values must not corrupt the document -----------------
const amp = docx([ para(['{{title}}']) ]);
f = fillTemplate(amp, { title: 'Steel & Glass <Phase 2> "A"' });
txt = bodyText(f.bytes);
check('escapes & < > safely', txt.includes('Steel &amp; Glass &lt;Phase 2&gt;'), txt.slice(0, 200));
check('document still unzips', (() => { try { unzipSync(f.bytes); return true; } catch (e) { return false; } })());

// ---- 7. headers and footers are filled too ------------------------------
const hdr = docx([ para(['body {{ref}}']) ], {
  'word/header1.xml': `<?xml version="1.0"?><w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:r><w:t>{{project_name}}</w:t></w:r></w:p></w:hdr>`,
});
t = extractTokens(hdr);
check('reads tokens in the header', t.tokens.includes('project_name'), JSON.stringify(t.tokens));
f = fillTemplate(hdr, { ref: 'A', project_name: 'NAF Tower' });
check('header filled', strFromU8(unzipSync(f.bytes)['word/header1.xml']).includes('NAF Tower'));
check('other parts preserved', !!unzipSync(f.bytes)['[Content_Types].xml']);

// ---- 8. buildValues maps a record + project -----------------------------
const v = buildValues(
  { ref: 'SUB-003', title: 'Paint', created_by: 'A. Imran', created_at: '2026-09-19T08:00:00Z',
    data: { Discipline: 'Architectural', 'Spec section': '09 91 00' } },
  { name: 'NAF Tower', engineer_name: 'DEC', contractor_name: 'NAF', client_name: 'DID', currency: 'AED' }
);
check('standard values mapped', v.ref === 'SUB-003' && v.consultant === 'DEC' && v.contractor === 'NAF');
check('project name mapped', v.project_name === 'NAF Tower');
check('form fields exposed by label', v.Discipline === 'Architectural' && v['Spec section'] === '09 91 00');
check('date derived from the record', v.date === '2026-09-19');

// ---- 9. refusals --------------------------------------------------------
check('refuses a non-docx', !!extractTokens(strToU8('hello there')).error);
check('refuses a zip that is not a docx', !!extractTokens(zipSync({ 'a.txt': strToU8('x') })).error);
check('fill refuses a non-docx', !!fillTemplate(strToU8('nope'), {}).error);

console.log(fails ? ('\n' + fails + ' FAILED') : '\nall passed');
process.exit(fails ? 1 : 0);
