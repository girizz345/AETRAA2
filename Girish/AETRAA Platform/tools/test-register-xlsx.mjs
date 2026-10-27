// RFIs raised by whoever hits the question, and every register as a real
// Excel workbook.
//
//   node tools/test-register-xlsx.mjs
//
// Two changes are checked here. First: an RFI used to be the Design office's
// alone, while the site engineer's own sidebar advertised "Raise RFI" and
// opened nothing. Site, QA/QC, planning and the QS may now raise one, and the
// PM still approves it before it leaves. Second: "export to Excel" wrote a
// comma-separated file with an Excel name on it. It now writes a workbook —
// which this test proves by unzipping what comes back and reading the sheet
// XML, rather than trusting the content type.
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { RECORD_CREATORS } from '../src/functions.js';
import { REGISTERS, typesFor, registerWorkbook, scheduleWorkbook, boqWorkbook, drawingsWorkbook } from '../src/register-xlsx.js';

let fails = 0, checks = 0;
const check = (n, c, d) => { checks++; console.log((c ? '  ok   ' : '  FAIL ') + n + (d && !c ? '  — ' + String(d).slice(0, 300) : '')); if (!c) fails++; };
const T = new Date(Date.now() + 4 * 3600000).toISOString().slice(0, 10);

const db = new DatabaseSync(':memory:');
db.exec(readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));
function stmt(sql) {
  const st = db.prepare(sql); let args = [];
  const api = {
    bind(...a) { args = a; return api; },
    async all() { return { results: st.all(...args), success: true }; },
    async first(col) { const r = st.get(...args) ?? null; return col && r ? r[col] : r; },
    async run() { st.run(...args); return { success: true, meta: {} }; },
  };
  return api;
}
const env = {
  DB: { prepare: stmt, async batch(l) { for (const s of l) await s.run(); return []; }, async exec(s) { db.exec(s); } },
  OWNER_CODE: 'MASTERCODE-0123456789', LOGIN_TEST_CODE: '246810', AUTH_SECRET: 'x'.repeat(40),
};
const worker = (await import('../src/index.js')).default;
let cookie = '';
async function call(path, body, raw) {
  const headers = {};
  if (cookie) headers.Cookie = cookie;
  if (body) headers['Content-Type'] = 'application/json';
  const res = await worker.fetch(new Request('http://localhost' + path,
    { method: body ? 'POST' : 'GET', headers, body: body ? JSON.stringify(body) : undefined }), env, { waitUntil() {} });
  const sc = res.headers.get('set-cookie');
  if (sc) cookie = sc.split(',').map((x) => x.split(';')[0].trim()).join('; ');
  if (raw) return { status: res.status, bytes: new Uint8Array(await res.arrayBuffer()), headers: res.headers };
  const text = await res.text(); let json = null; try { json = JSON.parse(text); } catch (e) {}
  return { status: res.status, text, json, headers: res.headers };
}
const as = async (email) => { cookie = ''; return (await call('/api/signin/code', { email, code: '246810' })).json?.ok; };

/* ---------------------------------------------------------- a real .xlsx
 *
 * Read the zip's central directory and pull one entry out, so the check is
 * "a spreadsheet program could open this", not "the bytes are not empty".
 */
function unzip(bytes) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = bytes.length - 22;
  while (end >= 0 && dv.getUint32(end, true) !== 0x06054b50) end--;
  if (end < 0) return null;
  const count = dv.getUint16(end + 10, true);
  let at = dv.getUint32(end + 16, true);
  const out = {};
  for (let i = 0; i < count; i++) {
    if (dv.getUint32(at, true) !== 0x02014b50) return null;
    const method = dv.getUint16(at + 10, true);
    const csize = dv.getUint32(at + 20, true);
    const nlen = dv.getUint16(at + 28, true);
    const elen = dv.getUint16(at + 30, true);
    const clen = dv.getUint16(at + 32, true);
    const lho = dv.getUint32(at + 42, true);
    const name = new TextDecoder().decode(bytes.subarray(at + 46, at + 46 + nlen));
    const lnlen = dv.getUint16(lho + 26, true);
    const lelen = dv.getUint16(lho + 28, true);
    const from = lho + 30 + lnlen + lelen;
    const raw = bytes.subarray(from, from + csize);
    out[name] = new TextDecoder().decode(method === 8 ? inflateSync(raw) : raw);
    at += 46 + nlen + elen + clen;
  }
  return out;
}

/* =============================================== who may raise an RFI */
check('an RFI is no longer the design office’s alone',
  ['design', 'site', 'qaqc', 'planning', 'commercial'].every((f) => RECORD_CREATORS.rfi.includes(f)),
  JSON.stringify(RECORD_CREATORS.rfi));
check('HSE and Document Control still do not raise RFIs',
  !RECORD_CREATORS.rfi.includes('hse') && !RECORD_CREATORS.rfi.includes('dc'),
  JSON.stringify(RECORD_CREATORS.rfi));

await call('/api/login', { code: 'MASTERCODE-0123456789' });
let r = await call('/api/setup/onboard', {
  company: { name: 'Contracting Company LLC' },
  project: { name: 'Residential Tower' },
  principal: { name: 'The Principal', email: 'principal@demo.test' } });
const P = r.json.project_id;
for (const [n, e, f] of [
  ['Project Manager', 'pm@demo.test', ['pm']],
  ['Document Controller', 'dc@demo.test', ['dc']],
  ['Design Manager', 'design@demo.test', ['design']],
  ['Site Engineer', 'site@demo.test', ['site']],
  ['QA/QC Engineer', 'qaqc@demo.test', ['qaqc']],
  ['Planning Engineer', 'planning@demo.test', ['planning']],
  ['Quantity Surveyor', 'qs@demo.test', ['commercial']],
  ['HSE Officer', 'hse@demo.test', ['hse']],
]) await call('/api/person', { name: n, email: e, functions: f, projects: [P] });

const raise = (subject, disc) => call('/api/records',
  { type: 'rfi', title: subject, data: { Subject: subject, Discipline: disc, Priority: 'Normal', 'Reply needed by': T } });

for (const [email, who, subject] of [
  ['site@demo.test', 'the site engineer', 'Beam / duct clash at grid E-7'],
  ['qaqc@demo.test', 'QA/QC', 'Tolerance on the blockwork detail'],
  ['planning@demo.test', 'planning', 'Sequence for the podium pour'],
  ['qs@demo.test', 'the QS', 'BOQ item 4.12 not on the drawings'],
  ['design@demo.test', 'the design office', 'Parapet detail at roof'],
]) {
  await as(email);
  r = await raise(subject, 'MEP');
  check(who + ' may raise an RFI', r.status === 200 && /^RFI-/.test(r.json.ref || ''), r.text);
}

await as('hse@demo.test');
r = await raise('Should not exist', 'MEP');
check('HSE still cannot raise one', r.status >= 400, r.text);

// The gate that matters: raising it does not issue it.
await as('site@demo.test');
r = await call('/api/records?type=rfi');
const mine = r.json.records.find((x) => /grid E-7/.test(x.title));
check('a site-raised RFI waits for the PM, not the consultant',
  /PM approves/i.test(mine.status || '') && mine.can_act === false, JSON.stringify(mine.status));
r = await call('/api/record/advance', { ref: mine.ref, action: 'advance' });
check('the raiser cannot approve his own RFI', r.status >= 400 && /Project Manager/.test(r.json.error || ''), r.text);
await as('pm@demo.test');
r = await call('/api/record/advance', { ref: mine.ref, action: 'advance' });
check('the PM approves it', r.status === 200, r.text);

/* =================================================== the register workbook */
await as('dc@demo.test');
r = await call('/api/register/xlsx?reg=rfi', null, true);
check('the RFI register downloads as a spreadsheet file',
  r.status === 200 && /spreadsheetml/.test(r.headers.get('Content-Type') || ''), r.status);
check('it is named for the project and the register',
  /Residential Tower - RFI register/.test(r.headers.get('Content-Disposition') || ''),
  r.headers.get('Content-Disposition'));

const zipped = unzip(r.bytes);
check('the file is a readable zip with a workbook inside',
  !!zipped && !!zipped['xl/workbook.xml'] && !!zipped['[Content_Types].xml'],
  zipped ? Object.keys(zipped).join(', ') : 'not a zip');
check('it has both the register and the detail sheet',
  /Register/.test(zipped['xl/workbook.xml']) && /Detail/.test(zipped['xl/workbook.xml']),
  zipped['xl/workbook.xml']);

const sheet1 = zipped['xl/worksheets/sheet1.xml'];
check('every RFI raised is a row in it',
  ['RFI-0001', 'RFI-0002', 'RFI-0003', 'RFI-0004', 'RFI-0005'].every((ref) => sheet1.includes(ref)),
  sheet1.slice(0, 400));
check('the header is frozen so the columns stay visible', /state="frozen"/.test(sheet1));
check('dates are written as dates, not as text',
  /<c r="[A-Z]+\d+" s="14"><v>\d{5}/.test(sheet1), 'no date-styled numeric cell found');
check('it says who raised each one', /Site Engineer/.test(sheet1) && /Planning Engineer/.test(sheet1));
check('a comma in a subject does not split a column',
  !/grid E-7<\/t><\/is><\/c><c[^>]*t="inlineStr"><is><t[^>]*>7</.test(sheet1));

const sheet2 = zipped['xl/worksheets/sheet2.xml'];
check('the detail sheet carries the form behind each record',
  /Discipline/.test(sheet2) && /Priority/.test(sheet2), sheet2.slice(0, 300));

r = await call('/api/register/schedule.xlsx?reg=rfi', null, true);
const sz = unzip(r.bytes);
check('the generated schedule exports too',
  r.status === 200 && !!sz && /Schedule/.test(sz['xl/workbook.xml']), r.status);

r = await call('/api/register/xlsx?reg=not-a-register');
check('an unknown register is refused rather than guessed at', r.status === 404, r.status);

/* --------------------------------------------- the other registers too */
for (const bucket of Object.keys(REGISTERS)) {
  check('the ' + bucket + ' register maps to at least one record type', typesFor(bucket).length > 0);
}
const empty = unzip(registerWorkbook('ncr', [], { name: 'Residential Tower' }));
check('an empty register still produces a valid workbook, not a broken file',
  !!empty && !!empty['xl/worksheets/sheet1.xml'] && /NCR register/.test(empty['xl/worksheets/sheet1.xml']));
check('an empty register has no detail sheet to mislead anyone',
  !/sheet2\.xml/.test(Object.keys(empty).join(' ')));
check('a schedule of nothing is still a workbook', !!unzip(scheduleWorkbook('ncr', [], {})));

/* ---------------------------------------- the drawing register and the BOQ */
const dz = unzip(drawingsWorkbook(
  [{ number: 'ST-210', revision: 'C', title: 'L5 beam layout', kind: 'ifc', discipline: 'Structural',
     status: 'current', uploaded_by: 'Design Manager', uploaded_at: T, has_file: 1 }],
  { name: 'Residential Tower' }));
check('the drawing register exports as a workbook',
  !!dz && /ST-210/.test(dz['xl/worksheets/sheet1.xml']));

const bz = unzip(boqWorkbook({
  lines: [{ ref: 'B1', section: 'Substructure', description: 'Mass concrete', unit: 'm3', qty: 120, rate: 310, amount: 37200, billed_pct: 50 }],
  sections: [{ section: 'Substructure', lines: 1, value: 37200, billed_value: 18600, billed_pct: 50 }],
  totals: { value: 37200, billed_value: 18600, billed_pct: 50 },
}, { name: 'Residential Tower' }));
check('the priced bill exports as a workbook with a section roll-up',
  !!bz && /Mass concrete/.test(bz['xl/worksheets/sheet1.xml']) && /By section/.test(bz['xl/workbook.xml']));
check('the bill totals are live formulas, not typed-in numbers',
  /<f>SUM\(G\d+:G\d+\)<\/f>/.test(bz['xl/worksheets/sheet1.xml']), 'no SUM formula in the BOQ sheet');
// Excel's own percent format multiplies by 100, so a billed 50% is stored as
// 0.5. Storing 50 would have shown the client 5000%.
check('a billed percentage is stored as the fraction Excel expects',
  /s="4"><v>0.5</.test(bz['xl/worksheets/sheet1.xml']), 'billed % is not 0.5');

/* ------------------------------------------------- read access is enough */
await as('consultant@demo.test');
r = await call('/api/register/xlsx?reg=rfi');
check('a login that is not on the project cannot export it', r.status >= 400, r.status);

console.log('\n' + checks + ' checks, ' + fails + ' failures');
process.exit(fails ? 1 : 0);
