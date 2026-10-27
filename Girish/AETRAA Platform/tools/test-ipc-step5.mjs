// STEP 5 — the payment application: checks, the road to payment, and the pack.
//
//   node tools/test-ipc-step5.mjs
//
// Every figure below was worked out by hand first (see the comments).
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

let fails = 0, checks = 0;
const check = (n, c, d) => { checks++; console.log((c ? '  ok   ' : '  FAIL ') + n + (d && !c ? '  — ' + String(d).slice(0, 400) : '')); if (!c) fails++; };
const near = (a, b) => Math.abs(Number(a) - Number(b)) < 0.006;

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
  const res = await worker.fetch(new Request('http://localhost' + path, { method: body ? 'POST' : 'GET', headers, body: body ? JSON.stringify(body) : undefined }), env, { waitUntil() {} });
  const sc = res.headers.get('set-cookie');
  if (sc) cookie = sc.split(',').map((x) => x.split(';')[0].trim()).join('; ');
  if (raw) return { status: res.status, bytes: new Uint8Array(await res.arrayBuffer()), headers: res.headers };
  const text = await res.text(); let json = null; try { json = JSON.parse(text); } catch (e) {}
  return { status: res.status, text, json, headers: res.headers };
}
const as = async (email) => { cookie = ''; return (await call('/api/signin/code', { email, code: '246810' })).json?.ok; };

// ---------------------------------------------------------------- the set-up
await call('/api/login', { code: 'MASTERCODE-0123456789' });
const admin = cookie;
let r = await call('/api/setup/onboard', { company: { name: 'NAF Contracting' },
  project: { name: 'Tower A', currency: 'AED', retention_pct: 10, retention_limit_pct: 5, advance_pct: 10, payment_days: 56 },
  principal: { name: 'M. Boss', email: 'boss@naf.ae' } });
const P = r.json.project_id;
db.prepare("UPDATE projects SET contractor_name = 'NAF Contracting LLC', engineer_name = 'Dar Consult' WHERE id = ?").run(P);

r = await call('/api/setup/payment-terms?project=' + P);
check('payment terms: defaults before anything is set', r.json.terms.mos_pct === 80 && r.json.terms.vat_pct === 5 && r.json.terms.advance_received === false, r.text);
r = await call('/api/setup/payment-terms', { project_id: P, terms: { mos_pct: 180 } });
check('payment terms: 180% refused', r.status === 400 && /0 to 100/.test(r.json.error));
r = await call('/api/setup/payment-terms', { project_id: P, terms: { recovery_start_pct: 50, recovery_full_pct: 40 } });
check('payment terms: full recovery before it starts refused', r.status === 400);
r = await call('/api/setup/payment-terms', { project_id: P, terms: { retention_pct: 10, retention_cap_pct: 5, advance_pct: 10,
  advance_received: true, recovery_full_pct: 80, mos_pct: 80, vat_pct: 5, certify_days: 28, payment_days: 56 } });
check('payment terms saved', r.json.ok && r.json.terms.advance_received === true && r.json.terms.recovery_pct === 10, r.text);

// BOQ: contract 1,000,000
r = await call('/api/boq/import', { project_id: P, rows: [
  { section: 'Substructure', ref: 'S1', description: 'Excavation', unit: 'm3', qty: 1000, rate: 50 },       //  50,000
  { section: 'Substructure', ref: 'S2', description: 'Raft concrete', unit: 'm3', qty: 500, rate: 1000 },   // 500,000
  { section: 'Superstructure', ref: 'F1', description: 'Columns and slabs', unit: 'item', amount: 450000 },// 450,000
] });
check('BOQ imported', r.json.ok && r.json.value === 1000000, r.text);

for (const [n, e, f] of [['Q. Surveyor', 'qs@naf.ae', ['commercial']], ['A. Haddad', 'pm@naf.ae', ['pm']], ['L. Park', 'dc@naf.ae', ['dc']],
  ['F. Nair', 'fin@naf.ae', ['finance']], ['R. Kumar', 'site@naf.ae', ['site']], ['D. Okafor', 'des@naf.ae', ['design']]]) {
  await call('/api/person', { name: n, email: e, functions: f, projects: [P] });
}

// Programme: Substructure 60%, Superstructure 10% by end of July
const act = db.prepare("INSERT INTO activities (project_id, id, name, level, sort_order, wbs, weight, kind, planned_start, planned_finish) VALUES (?,?,?,1,?,?,1,'site',?,?)");
act.run(P, 'A1', 'Raft', 1, 'Substructure', '2026-06-01', '2026-08-15');
act.run(P, 'A2', 'Frame', 2, 'Superstructure', '2026-07-01', '2026-12-31');
const up = db.prepare("INSERT INTO updates (project_id, activity_id, report_date, pct, source, created_at) VALUES (?,?,?,?,'site','x')");
up.run(P, 'A1', '2026-07-28', 60); up.run(P, 'A2', '2026-07-28', 10);
up.run(P, 'A1', '2026-08-28', 100); up.run(P, 'A2', '2026-08-28', 85);

// A variation approved by the client (Code A), and one not
await as('qs@naf.ae');
const vo1 = (await call('/api/records', { type: 'variation', title: 'Additional waterproofing', data: { 'Estimated cost (AED)': '20,000' } })).json.ref;
const vo2 = (await call('/api/records', { type: 'variation', title: 'Coral pond', data: { 'Estimated cost (AED)': '75000' } })).json.ref;
await as('pm@naf.ae'); await call('/api/record/advance', { ref: vo1, action: 'advance' });
await as('boss@naf.ae'); await call('/api/record/advance', { ref: vo1, action: 'advance' });
await as('dc@naf.ae'); await call('/api/record/advance', { ref: vo1, action: 'advance' });
await call('/api/record/advance', { ref: vo1, action: 'advance', status: 'Code A — Approved' });
r = await call('/api/attachment', { ref: vo1, filename: 'VO-01 client instruction.pdf', mime: 'application/pdf', file_b64: Buffer.from('%PDF-1.4 vo').toString('base64') });
check('variation back-up attached', r.json && r.json.ok, r.text);

// An inspection approved in July, with its record sheet
await as('site@naf.ae');
const wir = (await call('/api/records', { type: 'wir', title: 'Raft pre-pour' })).json.ref;
db.prepare(`UPDATE records SET step = 3, status = 'Code A — Approved', cls = 'ok', workflow = ? WHERE ref = ? AND project_id = ?`)
  .run(JSON.stringify([{ st: 'Raised', state: 'done', when: '2026-07-10 09:00' }, { st: 'QA', state: 'done', when: '2026-07-10 10:00' },
    { st: 'Issued', issue: true, state: 'done', when: '2026-07-10 11:00' }, { st: 'Result', reply: true, state: 'done', when: '2026-07-11 08:00' }]), wir, P);
await as('dc@naf.ae');
await call('/api/attachment', { ref: wir, filename: 'WIR signed.pdf', mime: 'application/pdf', file_b64: Buffer.from('%PDF-1.4 wir').toString('base64') });
// Two photos in July, one in September
const jpg = 'data:image/jpeg;base64,' + Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 0xff, 0xd9]).toString('base64');
const ph = db.prepare('INSERT INTO photos (id, project_id, activity_id, report_date, caption, mime, data, submitted_by, created_at) VALUES (?,?,?,?,?,?,?,?,?)');
ph.run('ph1', P, 'A1', '2026-07-12', 'Raft rebar', 'image/jpeg', jpg, 'R', 'x');
ph.run('ph2', P, 'A1', '2026-07-20', 'Raft pour', 'image/jpeg', jpg, 'R', 'x');
ph.run('ph3', P, 'A1', '2026-09-02', 'Later', 'image/jpeg', jpg, 'R', 'x');

// ---------------------------------------------------------------- who may
await as('site@naf.ae');
check('Site has no payment access', (await call('/api/ipc')).status === 403);
await as('des@naf.ae');
check('Design has no payment access', (await call('/api/ipc')).status === 403);
await as('fin@naf.ae');
r = await call('/api/ipc');
check('Finance sees payments, may pay, may not raise', r.status === 200 && r.json.may.pay && !r.json.may.raise, JSON.stringify(r.json && r.json.may));
r = await call('/api/ipc', { lines: [], reviewed: true, period_from: '2026-07-01', period_to: '2026-07-31' });
check('Finance cannot raise', r.status === 403);

// ---------------------------------------------------------------- the proposal
await as('qs@naf.ae');
r = await call('/api/ipc/propose', { period_to: '2026-07-31' });
const prop = r.json;
check('proposal lists the complete BOQ', prop.lines.length === 3, r.text);
check('proposal reads the programme as at the period end', prop.lines.find((l) => l.ref === 'S2').proposed_pct === 60 && prop.lines.find((l) => l.ref === 'F1').proposed_pct === 10);
check('proposed work: 550,000×60% + 450,000×10% = 375,000', near(prop.totals.proposed_work_done, 375000), prop.totals.proposed_work_done);
check('only the approved variation is offered as approved', prop.variations.find((v) => v.ref === vo1).approved && !prop.variations.find((v) => v.ref === vo2).approved);

const lines1 = prop.lines.map((l) => ({ key: l.key, pct: l.ref === 'S1' ? 100 : l.proposed_pct }));
const base1 = { lines: lines1, variations: [{ ref: vo1, pct: 50 }], mos: [{ material: 'Rebar T20', unit: 't', qty: 10, rate: 2500, ref: 'GRN-014' }],
  period_from: '2026-07-01', period_to: '2026-07-31' };

// ---------------------------------------------------------------- the checks
const blockersOf = async (b) => (await call('/api/ipc/check', b)).json.blockers.join(' | ');
check('over 100% is stopped', /not a percentage/.test(await blockersOf({ ...base1, lines: [{ key: lines1[0].key, pct: 120 }] })));
check('an unapproved variation is stopped', /not approved by the client/.test(await blockersOf({ ...base1, variations: [{ ref: vo2, pct: 100 }] })));
check('materials without a rate are stopped', /needs a quantity and a rate/.test(await blockersOf({ ...base1, mos: [{ material: 'Blocks', qty: 5 }] })));
check('a period ending in the future is stopped', /cannot end after today/.test(await blockersOf({ ...base1, period_to: '2099-01-31' })));
check('no period is stopped', /Enter the period/.test(await blockersOf({ ...base1, period_from: '', period_to: '' })));
r = await call('/api/ipc/check', base1);
check('a good valuation has no blockers', r.json.ok && !r.json.blockers.length, JSON.stringify(r.json.blockers));
check('…and warns that S1 is claimed ahead of the programme', r.json.warnings.some((w) => /ahead of the programme/.test(w)), JSON.stringify(r.json.warnings));
check('…and mentions the variation not yet approved', r.json.warnings.some((w) => /not approved yet/.test(w)));
r = await call('/api/ipc', base1);
check('not raised until the QS ticks the review', r.status === 400 && /QS must review/.test(r.json.error));

// ---------------------------------------------------------------- IPA-01
r = await call('/api/ipc', { ...base1, reviewed: true, reviewed_by: 'Q. Surveyor' });
const a1 = r.json;
check('IPA-01 prepared', r.status === 200 && a1.ref === 'IPA-01' && /Prepared/.test(a1.status), r.text);
// work 50,000 + 300,000 + 45,000 = 395,000; VO 20,000×50% = 10,000; MOS 25,000×80% = 20,000
check('work done 395,000', near(a1.work_done, 395000), a1.work_done);
check('variations 10,000', near(a1.variations, 10000));
check('materials on site 20,000 (80% of 25,000)', near(a1.materials_on_site, 20000));
check('gross 425,000', near(a1.gross, 425000));
check('retention 10% = 42,500 (cap 51,000 not reached)', near(a1.retention, 42500) && !a1.retention_capped);
check('advance recovered 10% of 405,000 = 40,500', near(a1.advance_recovery, 40500), a1.advance_recovery);
check('net 342,000, VAT 17,100, total 359,100', near(a1.net, 342000) && near(a1.vat, 17100) && near(a1.total_due, 359100), JSON.stringify([a1.net, a1.vat, a1.total_due]));
r = await call('/api/ipc', { ...base1, reviewed: true, period_from: '2026-08-01', period_to: '2026-08-31' });
check('a second application waits until IPA-01 is approved and issued', r.status === 400 && /still being approved/.test(r.json.error), r.text);
await call('/api/attachment', { ref: 'IPA-01', filename: 'Take-off sheets.pdf', mime: 'application/pdf', file_b64: Buffer.from('%PDF-1.4 takeoff').toString('base64') });

// ---------------------------------------------------------------- along the road
const adv = (b) => call('/api/ipc/advance', b);
await as('dc@naf.ae');
r = await adv({ ref: 'IPA-01', action: 'approve' });
check('Document Control cannot approve', r.status === 400 || r.status === 403, r.text);
await as('pm@naf.ae');
r = await adv({ ref: 'IPA-01', action: 'issue' });
check('the PM cannot issue before approving', r.status === 400 && /not the next step/.test(r.json.error), r.text);
r = await adv({ ref: 'IPA-01', action: 'approve' });
check('the PM approves', r.status === 200 && /^Approved/.test(r.json.status), r.text);
r = await adv({ ref: 'IPA-01', action: 'issue' });
check('the PM does not issue — Document Control does', r.status === 403, r.text);
await as('dc@naf.ae');
r = await adv({ ref: 'IPA-01', action: 'issue', date: '2026-08-03' });
check('Document Control issues it', r.status === 200 && /^Issued/.test(r.json.status) && r.json.application.submitted === '2026-08-03' && r.json.application.certify_by === '2026-08-31', r.text);
r = await adv({ ref: 'IPA-01', action: 'certify' });
check('certificate needs the certified amount', r.status === 400 && /net amount/.test(r.json.error));
r = await adv({ ref: 'IPA-01', action: 'certify', certified_amount: '330,000', engineer_ref: 'IPC-01', date: '2026-08-25' });
check('the Engineer\'s certificate is recorded', r.status === 200 && /^Certified/.test(r.json.status) && r.json.application.certified_net === 330000, r.text);
check('…with the difference called out', /12,000.00 less/.test(r.json.note), r.json.note);
check('…and the payment date from the contract (56 days)', r.json.application.payment_by === '2026-10-20', r.json.application.payment_by);
const billed = db.prepare("SELECT billed_pct FROM boq WHERE project_id = ? AND ref = 'S1'").get(P).billed_pct;
check('the BOQ carries the certified % forward', billed === 100, billed);
r = await adv({ ref: 'IPA-01', action: 'pay', paid_amount: 200000 });
check('DC cannot record payment', r.status === 403);
await as('fin@naf.ae');
r = await adv({ ref: 'IPA-01', action: 'pay', paid_amount: 200000, date: '2026-09-01' });
check('Finance: part paid', r.status === 200 && r.json.status === 'Part paid', r.text);
r = await adv({ ref: 'IPA-01', action: 'pay', paid_amount: 146500, date: '2026-09-10' });
check('Finance: paid in full (330,000 + 5% VAT = 346,500)', r.status === 200 && r.json.status === 'Paid', r.text);

// ---------------------------------------------------------------- IPA-02
await as('qs@naf.ae');
r = await call('/api/ipc/propose', { period_to: '2026-08-31' });
const prop2 = r.json;
check('next period suggested from the day after IPA-01', prop2.period.from === '2026-08-01', JSON.stringify(prop2.period));
check('previous % is what was certified', prop2.lines.find((l) => l.ref === 'S1').prev_pct === 100 && prop2.lines.find((l) => l.ref === 'S2').prev_pct === 60);
check('previous figure is the Engineer\'s, not ours', prop2.previous.certified_to_date === 330000, JSON.stringify(prop2.previous));
const lines2 = prop2.lines.map((l) => ({ key: l.key, pct: l.ref === 'S1' ? 100 : l.ref === 'S2' ? 100 : 90 }));
const base2 = { lines: lines2, variations: [{ ref: vo1, pct: 100 }], mos: [], period_from: '2026-08-01', period_to: '2026-08-31', reviewed: true };
check('going below the certified % needs a reason', /below the 100% already certified/.test(await blockersOf({ ...base2, lines: [{ key: lines2[0].key, pct: 90 }] })));
r = await call('/api/ipc/check', { ...base2, lines: [{ key: lines2[0].key, pct: 90, note: 'Engineer measured 900 m3' }, ...lines2.slice(1)] });
check('…and with the reason it is allowed', !r.json.blockers.some((b) => /S1/.test(b)), JSON.stringify(r.json.blockers));
check('an overlapping period is stopped', /overlaps IPA-01/.test(await blockersOf({ ...base2, period_from: '2026-07-15' })));
check('changing "previous" needs a reason', /say why/.test(await blockersOf({ ...base2, previous: 342000 })));
r = await call('/api/ipc', base2);
const a2 = r.json;
// work 50,000 + 500,000 + 405,000 = 955,000 (95.5% ≥ 80%: advance fully recovered = 100,000)
// VO 20,000; gross 975,000; retention 97,500 capped at 5% × 1,020,000 = 51,000
// due 975,000 − 51,000 − 100,000 = 824,000; previous 330,000; net 494,000; VAT 24,700
check('IPA-02: work 955,000', r.status === 200 && near(a2.work_done, 955000), r.text);
check('IPA-02: retention capped at 51,000', near(a2.retention, 51000) && a2.retention_capped);
check('IPA-02: advance fully recovered 100,000', near(a2.advance_recovery, 100000));
check('IPA-02: previous is the certified 330,000', near(a2.previous, 330000));
check('IPA-02: net 494,000 + VAT 24,700', near(a2.net, 494000) && near(a2.vat, 24700), JSON.stringify([a2.net, a2.vat]));
check('IPA-02: says the advance is now fully recovered', a2.checks.warnings.some((w) => /fully recovered/.test(w)));

// Returned by the PM → the same number again, Rev 1
await as('pm@naf.ae');
r = await adv({ ref: 'IPA-02', action: 'return' });
check('a return needs a reason', r.status === 400 && /why/.test(r.json.error));
r = await adv({ ref: 'IPA-02', action: 'return', note: 'Hold F1 at 85% — slab L6 not poured' });
check('the PM returns it', r.status === 200 && r.json.status === 'Returned by the PM');
await as('qs@naf.ae');
r = await call('/api/ipc', { ...base2, lines: lines2.map((l, i) => (i === 2 ? { ...l, pct: 85 } : l)) });
check('re-raised as IPA-02 Rev 1', r.status === 200 && r.json.ref === 'IPA-02 Rev 1', r.text);

// ---------------------------------------------------------------- the documents
r = await call('/api/ipc/xlsx?ref=IPA-01', null, true);
check('Excel download', r.status === 200 && /spreadsheetml/.test(r.headers.get('content-type')) && r.bytes[0] === 0x50 && r.bytes[1] === 0x4b);
mkdirSync(new URL('../test-output/', import.meta.url), { recursive: true });
writeFileSync(new URL('../test-output/step5-IPA-01.xlsx', import.meta.url), r.bytes);
const xml = Buffer.from(r.bytes).toString('latin1');
check('Excel: six sheets', ['Summary', 'BOQ Valuation', 'Variations', 'Materials on site', 'Certificates', 'Retention &amp; advance'].every((n) => xml.includes(`name="${n}"`)));
check('Excel: values are live formulas', /<f>F\d+\*I\d+<\/f>/.test(xml) && /<f>'BOQ Valuation'!J\d+<\/f>/.test(xml));
check('Excel: every BOQ line is in it', ['Excavation', 'Raft concrete', 'Columns and slabs'].every((t) => xml.includes(t)));
r = await call('/api/ipc/doc?ref=IPA-01', null, true);
const doc = Buffer.from(r.bytes).toString('utf8');
check('application letter: net and total', doc.includes('342,000.00') && doc.includes('359,100.00') && doc.includes('Dar Consult'), doc.slice(0, 200));
r = await call('/api/ipc/pack?ref=IPA-01', null, true);
check('pack download is a zip', r.status === 200 && r.headers.get('content-type') === 'application/zip' && /IPA-01 - Tower A\.zip/.test(r.headers.get('content-disposition')), r.headers.get('content-disposition'));
writeFileSync(new URL('../test-output/step5-IPA-01-pack.zip', import.meta.url), r.bytes);
const names = [];
{ // read the zip's central directory
  const b = Buffer.from(r.bytes);
  let i = b.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  let off = b.readUInt32LE(i + 16), n = b.readUInt16LE(i + 10);
  for (let k = 0; k < n; k++) { const len = b.readUInt16LE(off + 28); names.push(b.slice(off + 46, off + 46 + len).toString('utf8')); off += 46 + len + b.readUInt16LE(off + 30) + b.readUInt16LE(off + 32); }
}
const has = (re) => names.some((x) => re.test(x));
check('pack: the letter', has(/^IPA-01 - Tower A\/01 Payment application IPA-01\.doc$/), names.join('\n'));
check('pack: the Excel', has(/02 BOQ valuation IPA-01\.xlsx$/));
check('pack: the progress report for the period', has(/03 Progress report 2026-07-01 to 2026-07-31\.doc$/));
check('pack: July\'s two photos, not September\'s', names.filter((x) => /04 Photographs\//.test(x)).length === 2 && !has(/Later/));
check('pack: the approved inspection with its sheet', has(new RegExp('05 Inspections/' + wir + '/WIR signed\\.pdf$')));
check('pack: the variation\'s back-up', has(new RegExp('06 Variations/' + vo1 + '/VO-01 client instruction\\.pdf$')));
check('pack: the QS\'s take-off sheets', has(/07 Supporting documents\/Take-off sheets\.pdf$/));
const letter = Buffer.from(r.bytes).toString('utf8');
check('the letter lists the contents', /Contents of this submission/.test(letter) && /Progress photographs for the period \(2\)/.test(letter));
check('the letter lists the approved inspection', letter.includes(wir) && /Inspections approved in the period/.test(letter));

console.log('\n' + checks + ' checks, ' + fails + ' failures');
process.exit(fails ? 1 : 0);
