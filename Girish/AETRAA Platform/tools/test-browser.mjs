// REAL BROWSER TEST. Serves the actual worker over HTTP, opens it in Chromium,
// signs a real person in, and inspects what is ACTUALLY ON THE SCREEN.
//
//   node tools/test-browser.mjs
//
// This is the check that the design's worked examples never reach a user.
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { deflateSync } from 'node:zlib';
import { build } from 'esbuild';
import { chromium } from 'playwright';

let fails = 0, checks = 0;
const check = (n, c, d) => { checks++; console.log((c ? '  ok   ' : '  FAIL ') + n + (d && !c ? '  — ' + d : '')); if (!c) fails++; };

await build({
  entryPoints: [new URL('../src/index.js', import.meta.url).pathname],
  bundle: true, format: 'esm', platform: 'neutral',
  outfile: '/tmp/browser-worker.mjs', logLevel: 'silent',
});

const db = new DatabaseSync(':memory:');
db.exec(readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));
function stmt(sql) {
  const st = db.prepare(sql); let args = [];
  const api = { bind(...a) { args = a; return api; },
    async all() { return { results: st.all(...args), success: true }; },
    async first(c) { const r = st.get(...args) ?? null; return c && r ? r[c] : r; },
    async run() { st.run(...args); return { success: true, meta: {} }; },
    async raw() { return st.all(...args).map((r) => Object.values(r)); } };
  return api;
}
const bucket = new Map();
const env = {
  DB: { prepare: stmt, async batch(l) { const o = []; for (const s of l) o.push(await s.run()); return o; }, async exec(s) { db.exec(s); return { count: 1 }; } },
  DRAWINGS: { async put(k, v) { bucket.set(k, new Uint8Array(v)); return { key: k }; },
    async get(k) { const v = bucket.get(k); return v ? { async arrayBuffer() { return v.buffer.slice(v.byteOffset, v.byteOffset + v.byteLength); } } : null; },
    async delete(k) { bucket.delete(k); } },
  OWNER_CODE: 'MASTERCODE', LOGIN_TEST_CODE: '246810', SESSION_SECRET: 'browser-test-secret',
};
const worker = (await import('/tmp/browser-worker.mjs')).default;
const ctx = { waitUntil() {}, passThroughOnException() {} };

// serve the worker over real HTTP so a browser can load it
const server = createServer(async (req, res) => {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const body = chunks.length ? Buffer.concat(chunks) : undefined;
  const url = 'http://localhost' + req.url;
  const r = await worker.fetch(new Request(url, {
    method: req.method, headers: req.headers,
    body: (req.method === 'GET' || req.method === 'HEAD') ? undefined : body,
  }), env, ctx);
  res.statusCode = r.status;
  r.headers.forEach((v, k) => { if (k.toLowerCase() === 'set-cookie') res.appendHeader('set-cookie', v); else res.setHeader(k, v); });
  res.end(Buffer.from(await r.arrayBuffer()));
});
await new Promise((ok) => server.listen(0, ok));
const PORT = server.address().port;
const BASE = 'http://localhost:' + PORT;
check('worker serves over real HTTP', !!PORT);

// seed a project + a real person through the real API
const api = async (path, body, cookie) => {
  const r = await fetch(BASE + path, { method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, cookie ? { Cookie: cookie } : {}), body: JSON.stringify(body) });
  const sc = r.headers.getSetCookie ? r.headers.getSetCookie() : [];
  return { json: await r.json().catch(() => null), cookie: sc.map((c) => c.split(';')[0]).join('; ') };
};
let a = await api('/api/login', { code: 'MASTERCODE' });
const admin = a.cookie;
a = await api('/api/setup/onboard', {
  company: { name: 'NAF Contracting LLC' },
  project: { name: 'NAF Tower', location: 'Dubai', currency: 'AED', retention_pct: 10, payment_days: 56 },
  principal: { name: 'M. Al Nuaimi', email: 'principal@naf.ae' },
}, admin);
const PID = a.json && a.json.project_id;
check('project seeded for the browser run', !!PID, String(PID));
const ROLES = [['principal','principal@naf.ae'],['pm','pm@naf.ae'],['planning','planner@naf.ae'],
  ['design','design@naf.ae'],['qaqc','qaqc@naf.ae'],['hse','hse@naf.ae'],
  ['commercial','commercial@naf.ae'],['dc','dc@naf.ae'],['site','civil@naf.ae'],['consultant','consultant@naf.ae']];
for (const [fn, em] of ROLES) {
  if (em === 'principal@naf.ae') continue;            // created by onboarding
  await api('/api/person', { name: fn.toUpperCase() + ' user', email: em, functions: [fn],
    groups: fn === 'site' ? ['Civil'] : [], projects: [PID] }, admin);
}

// a real image file on disk, so the file input is exercised the way a phone
// camera would exercise it — not a fabricated path string.
const PHOTO = '/tmp/aetraa-site-photo.png';
{
  const T = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; T[n] = c; }
  const crc = (b) => { let r = 0xffffffff; for (const x of b) r = T[(r ^ x) & 255] ^ (r >>> 8); return (r ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const W = 32, H = 32;
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 2;
  const raw = Buffer.alloc(H * (1 + W * 3));
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const o = y * (1 + W * 3) + 1 + x * 3; raw[o] = x * 8; raw[o + 1] = y * 8; raw[o + 2] = 120;
  }
  writeFileSync(PHOTO, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
}

// ---- open it in a real browser ------------------------------------------
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));

await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
check('the app loads in a browser', (await page.title()).length > 0, await page.title());

// sign in as the Design user, the way a real person would
await page.evaluate(async () => {
  await fetch('/api/signin/code', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'design@naf.ae', code: '246810' }) });
});
await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);

const body = await page.evaluate(() => document.body.innerText);
check('a signed-in person sees their dashboard', /Design|Dashboard|Project/i.test(body), body.slice(0, 160));

// ---- THE POINT: no fabricated rows on screen ----------------------------
const GHOSTS = ['AR-412', 'SUB-074', 'SUB-076', 'MAR-046', 'ACT-118', 'ACT-120', 'IPA-05', 'IPC-04',
  'BOQ-A', 'NCR-014', 'WIR-221', 'PTW-209', 'CERT-LIFT-01', 'DEWA-SUB', 'VO-07', 'LTR-092'];
const present = GHOSTS.filter((g) => body.includes(g));
check('NO sample references anywhere on screen', present.length === 0, 'found: ' + present.join(', '));
check('no fabricated money on screen', !/AED\s*12\.4m|4\.41m|18\.40m/.test(body), body.slice(0, 200));

// registers say so honestly
const hasEmpty = /Nothing recorded on this project yet/.test(body);
check('empty registers state it plainly', hasEmpty || !/register/i.test(body), 'no empty-state text found');

// the honesty banner is visible
check('the "not every panel is connected" notice shows', /Not every panel is connected/i.test(body), body.slice(0, 200));

// ---- and real data DOES appear -----------------------------------------
await page.evaluate(async () => {
  await fetch('/api/records', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'submittal', title: 'External paint system', data: { Title: 'External paint system', Discipline: 'Architectural' } }) });
});
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);
const body2 = await page.evaluate(() => document.body.innerText);
check('a REAL record appears on screen', /External paint system/.test(body2), body2.slice(0, 300));
check('it is numbered SUB-001', /SUB-001/.test(body2), (body2.match(/SUB-\d+/) || ['none'])[0]);
check('still no sample rows beside it', GHOSTS.filter((g) => body2.includes(g)).length === 0);

// ---- EVERY role's dashboard must be free of fabrications ---------------
for (const [fn, em] of ROLES) {
  await page.evaluate(async (email) => {
    await fetch('/api/logout');
    await fetch('/api/signin/code', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, code: '246810' }) });
  }, em);
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1800);
  const t = await page.evaluate(() => document.body.innerText);
  const ghosts = GHOSTS.filter((g) => t.includes(g));
  check('[' + fn + '] no fabricated references on screen', ghosts.length === 0, 'found: ' + ghosts.join(', '));
}

// ---- P1: the site engineer's own loop, done through the screen ---------
// The programme goes in once. Everything after this is the site engineer
// working the page the way a man on the slab would.
await fetch(BASE + '/api/import', { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: admin },
  body: JSON.stringify({ replace: true, text:
    'ID,Activity,WBS,Planned Start,Planned Finish,Trade Group,Weight\n' +
    'A1000,L4 slab rebar,Structure,2026-11-02,2026-11-11,Civil,100\n' +
    'A1010,L4 slab formwork,Structure,2026-11-12,2026-11-20,Civil,100' }) });

await page.evaluate(async () => {
  await fetch('/api/logout');
  await fetch('/api/signin/code', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'civil@naf.ae', code: '246810' }) });
});
await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);

let se = await page.evaluate(() => document.body.innerText);
check('site engineer sees their own activity', /L4 slab rebar/.test(se), se.slice(0, 300));
// The row is keyed on the planner's activity code, not the WBS section name.
check('the row carries the activity code, not the WBS', /A1000/.test(se) && !/Structure · L4 slab rebar/.test(se),
  (se.match(/\S+ · L4 slab rebar/) || ['no row'])[0]);

// open it — the live panel must appear for a real P6 code, not just "ACT-…"
await page.click('[data-open="A1000"]');
await page.waitForTimeout(800);
check('the update panel opens for a real activity', !!(await page.$('#livePanel')));
check('there is a progress slider', !!(await page.$('#pcRange')));
check('there is a real photograph field', !!(await page.$('#pcPhoto')));

// slide it to 60 and save
await page.$eval('#pcRange', (el) => { el.value = '60'; el.dispatchEvent(new Event('input', { bubbles: true })); });
await page.click('#pcSave');
await page.waitForTimeout(2000);
se = await page.evaluate(() => document.body.innerText);
check('saved progress shows on the row', /60%/.test(se), (se.match(/\d+%/g) || []).slice(0, 6).join(' '));

// now try to finish it with NO photograph — the server must refuse, and the
// refusal must reach the man's screen rather than being swallowed.
await page.click('[data-open="A1000"]');
await page.waitForTimeout(800);
await page.click('#pcFinish');
await page.waitForTimeout(2000);
const refusal = await page.$eval('#pcMsg', (el) => el.textContent).catch(() => '');
check('finishing without a photograph is refused ON SCREEN', /photograph is needed/i.test(refusal), refusal || '(no message)');
const stillOpen = await page.evaluate(() => document.body.innerText);
check('and it did NOT go to the PM', /60%/.test(stillOpen), (stillOpen.match(/\d+%/g) || []).slice(0, 6).join(' '));

// attach a photograph and finish properly
await page.setInputFiles('#pcPhoto', PHOTO);
await page.click('#pcFinish');
await page.waitForTimeout(3000);
se = await page.evaluate(() => document.body.innerText);
check('with a photograph attached it goes through', /100%|Sent to PM/.test(se), se.slice(0, 300));
const shots = await (await fetch(BASE + '/api/data', { headers: { Cookie: admin } })).json();
check('the photograph really reached the server', (shots.photos || []).length >= 1, String((shots.photos || []).length));

// ---- P1: attachments, through the screen -------------------------------
// The design drew a drop zone that did nothing. A WIR goes to the consultant
// "with all attachments", so this proves a real file goes up, is listed,
// downloads, and can be taken off again.
await page.click('[data-new="wir"]');
await page.waitForTimeout(700);
check('the inspection form opens', !!(await page.$('#dpane .frm')));
const picker = await page.$('#dpane input[type=file]');
check('the dead drop zone is now a real file field', !!picker,
  'the design drew a box that submitted the name of a file nobody could open');
check('and the drop zone is gone', (await page.$('#dpane .filebox')) === null);

await page.$eval('#dpane .frm .f input,#dpane .frm .f textarea',
  (el) => { el.value = 'L5 slab pre-pour inspection'; });
await page.setInputFiles('#dpane input[type=file]', PHOTO);
await page.click('[data-gen="wir"]');
await page.waitForTimeout(3000);
let made = await page.evaluate(() => document.body.innerText);
check('the inspection is created', /created and routed/i.test(made), made.slice(0, 300));
check('and it says the file went with it', /1 file attached/i.test(made), made.slice(0, 400));

// open it from the register and check the file is really there
const wirRef = (made.match(/WIR-\d+/) || [])[0];
check('it carries a WIR number', !!wirRef, made.slice(0, 200));
await page.click('[data-close="1"]');
await page.waitForTimeout(500);
await page.evaluate((ref) => openDetail(ref), wirRef);
await page.waitForTimeout(1500);
const attName = await page.$eval('#attList .att .fn', (el) => el.textContent).catch(() => '');
check('the file is listed against the record', /aetraa-site-photo\.png/.test(attName), attName || '(nothing listed)');
const href = await page.$eval('#attList .att .fn', (el) => el.getAttribute('href')).catch(() => '');
check('and it is a real link to the file', /^\/attachment\//.test(href), href);

const dl = await page.evaluate(async (u) => {
  const r = await fetch(u);
  return { status: r.status, cd: r.headers.get('content-disposition') || '', len: (await r.arrayBuffer()).byteLength };
}, href);
check('the file downloads from the browser', dl.status === 200 && dl.len > 0, JSON.stringify(dl));
check('served as a download, never inline', /^attachment;/.test(dl.cd), dl.cd);

// an activity has nothing to attach to, and must not be offered an upload
await page.evaluate(() => closeDetail());
await page.evaluate(() => openDetail('A1010'));
await page.waitForTimeout(800);
const actBody = await page.evaluate(() => document.body.innerText);
check('an activity is NOT offered an upload that goes nowhere',
  (await page.$('#attAdd')) === null && /not to this/i.test(actBody),
  'a drop zone with nothing behind it is how this started');

// ---- P1: record actions, on screen -------------------------------------
// The site engineer raised the WIR; he must not be offered a button that signs
// it off, because the server would refuse it anyway.
await page.evaluate(() => closeDetail());
await page.evaluate((ref) => openDetail(ref), wirRef);
await page.waitForTimeout(1200);
check('the man who raised it is NOT offered Approve',
  (await page.$('#recApprove')) === null,
  'a button the server refuses is worse than no button');
const seMsg = await page.$eval('#recMsg', (el) => el.textContent).catch(() => '');
check('and it says plainly why', /not part of your access/i.test(seMsg), seMsg);
check('but he CAN still produce the document', !!(await page.$('#recDoc')));

// a missing template must name what is missing, not just fail
await page.click('#recDoc');
await page.waitForTimeout(1500);
const noTpl = await page.$eval('#recMsg', (el) => el.textContent).catch(() => '');
check('a missing template is NAMED on screen', /template/i.test(noTpl) && /inspection|WIR/i.test(noTpl), noTpl);

// now the PM, who can approve
await page.evaluate(async () => {
  await fetch('/api/logout');
  await fetch('/api/signin/code', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'pm@naf.ae', code: '246810' }) });
});
await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);
await page.evaluate((ref) => openDetail(ref), wirRef);
await page.waitForTimeout(1200);
check('the PM IS offered Approve & sign', !!(await page.$('#recApprove')));
check('and Reject', !!(await page.$('#recReject')));

const statusBefore = await page.evaluate(() => {
  const el = document.querySelector('#dpane .dtop .pill,#dpane .dtop [class*=pill]');
  return el ? el.textContent : '';
});
await page.click('#recApprove');
await page.waitForTimeout(2500);
const afterText = await page.evaluate(() => document.body.innerText);
const statusAfter = await page.evaluate(() => {
  const el = document.querySelector('#dpane .dtop .pill,#dpane .dtop [class*=pill]');
  return el ? el.textContent : '';
});
check('approving really moves the record', statusAfter !== statusBefore,
  '"' + statusBefore + '" → "' + statusAfter + '"');
check('and the PM is named on the step', /A\. Haddad|PM user/i.test(afterText),
  'the step has to carry the name of the man who signed it');

// the server agrees — not just the screen
const srv = await page.evaluate(async (ref) => {
  const d = await (await fetch('/api/record?ref=' + ref)).json();
  return d.record ? { status: d.record.status, step: d.record.step } : null;
}, wirRef);
check('the SERVER recorded the approval', srv && srv.step >= 1, JSON.stringify(srv));

// ---- P1: the Bill of Materials, on screen ------------------------------
// The PM is already signed in from the section above.
await fetch(BASE + '/api/bom/import', { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: admin },
  body: JSON.stringify({ project_id: PID, rows: [
    { material: 'C40 ready-mix concrete', unit: 'm3', budget_qty: 1250, rate: 240 },
    { material: 'Solid block 200mm', unit: 'no', budget_qty: 38000, rate: 3.1 },
  ] }) });

await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1200);
await page.evaluate(() => { state.role = 'procurement'; state.readonly = false; render(); });
await page.waitForTimeout(2500);
let bom = await page.evaluate(() => document.body.innerText);
check('the BOM shows the real materials', /C40 ready-mix concrete/.test(bom) && /Solid block 200mm/.test(bom),
  bom.slice(0, 300));
check('and none of the design\'s invented ones', !/Gypsum board|Rebar T16/.test(bom),
  (bom.match(/Gypsum board|Rebar T16/) || ['clean'])[0]);
check('the caption no longer claims an over-BOM order is BLOCKED',
  /not blocked/i.test(bom) && !/is blocked until/i.test(bom),
  'the agreed rule is that it warns and records, never blocks');

// release WITHIN budget
await page.selectOption('#bomMat', { label: 'C40 ready-mix concrete (m3)' });
await page.fill('#bomQty', '200');
await page.fill('#bomRef', 'LPO-001');
await page.click('#bomOrder');
await page.waitForTimeout(1500);
let warn = await page.$eval('#bomWarn', (el) => el.textContent).catch(() => '');
check('a within-budget order says so before releasing', /within the bill of materials/i.test(warn), warn.slice(0, 160));
check('and nothing is released until a second, deliberate click', !!(await page.$('#bomConfirm')));
await page.click('#bomConfirm');
await page.waitForTimeout(2500);
bom = await page.evaluate(() => document.body.innerText);
check('the release is recorded', /LPO-001/.test(bom), bom.slice(0, 400));

// now release OVER budget — the whole point of this screen
await page.selectOption('#bomMat', { label: 'C40 ready-mix concrete (m3)' });
await page.fill('#bomQty', '1200');
await page.fill('#bomRef', 'LPO-002');
await page.click('#bomOrder');
await page.waitForTimeout(1500);
warn = await page.$eval('#bomWarn', (el) => el.textContent).catch(() => '');
check('going past the BOM is WARNED before release', /goes past the bill of materials/i.test(warn), warn.slice(0, 200));
check('and the warning states by how much', /exceeds the BOM by 150\b/.test(warn), warn.slice(0, 250));
const btnText = await page.$eval('#bomConfirm', (el) => el.textContent).catch(() => '');
check('releasing it anyway is named for what it is',
  /record the overrun against my name/i.test(btnText), btnText);

await page.click('#bomConfirm');
await page.waitForTimeout(2500);
bom = await page.evaluate(() => document.body.innerText);
check('it is NOT blocked — the PM can still release it', /LPO-002/.test(bom), bom.slice(0, 400));
check('and the line is marked over BOM', /Over BOM/.test(bom), bom.slice(0, 400));
const srvBom = await page.evaluate(async () => (await (await fetch('/api/bom')).json()));
check('the server recorded the overrun against the move',
  (srvBom.moves || []).some((m) => m.ref === 'LPO-002' && m.over_by > 0),
  JSON.stringify((srvBom.moves || []).map((m) => [m.ref, m.over_by])));

// a delivery lands against it
await page.fill('#bomQty', '900');
await page.fill('#bomRef', 'GRN-001');
await page.click('#bomGrn');
await page.waitForTimeout(2500);
const srvBom2 = await page.evaluate(async () => (await (await fetch('/api/bom')).json()));
const conc = (srvBom2.lines || []).find((l) => /C40/.test(l.material));
check('a delivery is recorded against the line', conc && conc.received_qty === 900, JSON.stringify(conc && conc.received_qty));
check('and what is still awaiting delivery is shown', conc && conc.awaiting_delivery === 500,
  String(conc && conc.awaiting_delivery));

// and the site engineer must never see the budget
await page.evaluate(async () => {
  await fetch('/api/logout');
  await fetch('/api/signin/code', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'civil@naf.ae', code: '246810' }) });
});
await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2000);
const seSees = await page.evaluate(async () => {
  const r = await fetch('/api/bom');
  return { status: r.status, body: document.body.innerText };
});
check('a site engineer is REFUSED the material budget', seSees.status === 403, 'status=' + seSees.status);
check('and no budget figure is on his screen', !/1,250|38,000/.test(seSees.body),
  'he raises a request; he does not see what it is allowed to cost');

// back to the PM for the sign-off section below
await page.evaluate(async () => {
  await fetch('/api/logout');
  await fetch('/api/signin/code', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'pm@naf.ae', code: '246810' }) });
});

// ---- P1: interim payment, on screen ------------------------------------
// The BOQ's sections are the programme's WBS, so one section values from real
// progress and one does not — which is the case that matters.
await fetch(BASE + '/api/boq/import', { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: admin },
  body: JSON.stringify({ project_id: PID, rows: [
    { ref: 'B1', section: 'Structure', description: 'Reinforced concrete frame', amount: 4000000 },
    { ref: 'B2', section: 'Finishes', description: 'Internal finishes', amount: 1000000 },
  ] }) });

await page.evaluate(async () => {
  await fetch('/api/logout');
  await fetch('/api/signin/code', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'commercial@naf.ae', code: '246810' }) });
});
await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);
let ipc = await page.evaluate(() => document.body.innerText);
check('the QS sees no certificates yet, and it says so', /Nothing applied for on this project yet/.test(ipc),
  ipc.slice(0, 300));

await page.click('#ipcPropose');
await page.waitForTimeout(2500);
ipc = await page.evaluate(() => document.body.innerText);
check('a valuation is proposed from the programme', /Structure/.test(ipc) && /Finishes/.test(ipc), ipc.slice(0, 400));
check('the section WITH programme progress is valued from it', /from the programme/.test(ipc), ipc.slice(0, 400));
check('the section WITHOUT a link is flagged, not silently zeroed',
  /no programme link/.test(ipc) && /set it yourself/.test(ipc),
  'a QS who does not know a figure was guessed will sign it');

// The hybrid we agreed: the programme proposes, the QS decides. The programme
// says 50% here (one activity of two signed off). The QS says 75%. The QS wins.
const proposedPct = await page.$eval('.ipcpct', (el) => el.value);
check('the programme proposed the figure', proposedPct === '50', 'proposed ' + proposedPct + '%');
const before = await page.$eval('#ipcWork', (el) => el.textContent);
await page.$eval('.ipcpct', (el) => { el.value = '75'; el.dispatchEvent(new Event('input', { bubbles: true })); });
await page.waitForTimeout(400);
const after = await page.$eval('#ipcWork', (el) => el.textContent);
check('the QS overriding it re-values live', before !== after, before + ' → ' + after);

// THE GATE: nothing can be raised on a valuation nobody has been through
await page.click('#ipcRaise');
await page.waitForTimeout(1200);
const gate = await page.$eval('#ipcMsg', (el) => el.textContent).catch(() => '');
check('an unreviewed valuation is REFUSED on screen',
  /cannot be raised on a valuation nobody has been through/i.test(gate), gate);
const noneYet = await page.evaluate(async () => (await (await fetch('/api/ipc')).json()).certificates.length);
check('and nothing was raised', noneYet === 0, String(noneYet));

// review it, then raise
await page.check('#ipcReviewed');
await page.fill('#ipcMat', '50000');
await page.fill('#ipcTo', '2026-09-30');
await page.click('#ipcRaise');
await page.waitForTimeout(3000);
ipc = await page.evaluate(() => document.body.innerText);
check('a reviewed valuation becomes an application', /IPA-01/.test(ipc), ipc.slice(0, 400));

const cert = await page.evaluate(async () => (await (await fetch('/api/ipc')).json()).certificates[0]);
check('the QS’s figure is what was valued, NOT the programme’s',
  cert && cert.work_done === 3000000,
  'work done ' + (cert && cert.work_done) + ' — 75% of the 4m section, not the 50% the programme proposed');
check('materials on site are carried', cert && cert.materials_on_site === 50000, String(cert && cert.materials_on_site));
check('retention is deducted at the contract rate',
  cert && cert.retention_pct === 10 && cert.retention > 0,
  'retention ' + (cert && cert.retention) + ' at ' + (cert && cert.retention_pct) + '%');
check('and the net is gross less retention', cert && Math.abs(cert.net - (cert.gross - cert.retention)) < 0.01,
  'gross ' + (cert && cert.gross) + ' − retention ' + (cert && cert.retention) + ' = net ' + (cert && cert.net));
check('the payment date is computed from the contract terms',
  cert && /^\d{4}-\d{2}-\d{2}$/.test(cert.payment_by || ''), cert && cert.payment_by);

// certify it
// One dialog handler for the whole run — a second one races the first and
// Playwright throws "Cannot accept dialog which is already handled".
let lastDialog = '';
page.on('dialog', (d) => { lastDialog = d.message(); d.accept(); });
await page.click('[data-ipc="certify"]');
await page.waitForTimeout(2500);
const certified = await page.evaluate(async () => (await (await fetch('/api/ipc')).json()).certificates[0]);
check('the Engineer can certify it', /Certified/.test(certified.status), certified.status);
check('and the screen then offers Mark paid, not Certify again', !!(await page.$('[data-ipc="pay"]')));

// and a site engineer must never reach any of this
await page.evaluate(async () => {
  await fetch('/api/logout');
  await fetch('/api/signin/code', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'civil@naf.ae', code: '246810' }) });
});
await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2000);
const seIpc = await page.evaluate(async () => {
  const r = await fetch('/api/ipc');
  return { status: r.status, body: document.body.innerText };
});
check('a site engineer is REFUSED payment', seIpc.status === 403, 'status=' + seIpc.status);
check('and no money is on his screen', !/4,000,000|2,000,000/.test(seIpc.body), 'no valuation figures');

// back to the PM for the sign-off section below
await page.evaluate(async () => {
  await fetch('/api/logout');
  await fetch('/api/signin/code', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'pm@naf.ae', code: '246810' }) });
});

// ---- P1: the three record types that used to vanish --------------------
// A variation, a material request and an RFI all saved perfectly well and then
// appeared in no register at all. Raised, numbered, stored, and invisible to
// the person who had to act on them.
{
  const mk = async (type, title, data) => (await api('/api/records', { type, title, data }, admin)).json;
  const vo = await mk('variation', 'Coral pond civil works',
    { Description: 'Coral pond civil works', 'Estimated cost (AED)': '214,000', 'Time effect (days)': '12' });
  const mr = await mk('mr', 'Screed 30N',
    { Material: 'Screed 30N', Quantity: '150 m3', 'For (location)': 'Podium 3', 'Needed by': '2026-10-05' });
  const rfi = await mk('rfi', 'L5 beam / duct clash',
    { Subject: 'L5 beam / duct clash', Discipline: 'MEP', Priority: 'Urgent', 'Reply needed by': '2026-09-30' });
  check('a variation is numbered', /^VO-\d+$/.test(String(vo && vo.ref)), String(vo && vo.ref));
  check('a material request is numbered', /^MR-\d+$/.test(String(mr && mr.ref)), String(mr && mr.ref));
  check('an RFI is numbered', /^RFI-\d+$/.test(String(rfi && rfi.ref)), String(rfi && rfi.ref));

  // the QS must see the variation in the variation register
  await page.evaluate(async () => {
    await fetch('/api/logout');
    await fetch('/api/signin/code', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'commercial@naf.ae', code: '246810' }) });
  });
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  const qs = await page.evaluate(() => document.body.innerText);
  check('the variation APPEARS in the variation register', qs.includes(vo.ref) && /Coral pond civil works/.test(qs),
    'it used to save and then show nowhere');
  check('with its cost and time effect', /214,000/.test(qs) && /\+12 d/.test(qs), qs.slice(qs.indexOf(vo.ref), qs.indexOf(vo.ref) + 120));
  check('and the material request reaches Commercial too', qs.includes(mr.ref), mr.ref);

  // the Design office must see the RFI
  await page.evaluate(async () => {
    await fetch('/api/logout');
    await fetch('/api/signin/code', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'design@naf.ae', code: '246810' }) });
  });
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  const dsn = await page.evaluate(() => document.body.innerText);
  check('the RFI APPEARS in the Design office’s RFI register', dsn.includes(rfi.ref) && /L5 beam \/ duct clash/.test(dsn),
    dsn.slice(0, 300));
  check('an urgent RFI is marked urgent', /Urgent/.test(dsn), 'an RFI with no reply is a decision nobody has taken');
  check('and it carries its reply-by date', /2026-09-30/.test(dsn), 'without a date it cannot be chased');

  // Procurement must see the material request
  await page.evaluate(async () => {
    await fetch('/api/logout');
    await fetch('/api/signin/code', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'pm@naf.ae', code: '246810' }) });
  });
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  await page.evaluate(() => { state.role = 'procurement'; state.readonly = false; render(); });
  await page.waitForTimeout(2000);
  const proc = await page.evaluate(() => document.body.innerText);
  check('the material request APPEARS for Procurement', proc.includes(mr.ref) && /Screed 30N/.test(proc),
    proc.slice(0, 300));
  check('with the quantity and where it is for', /150 m3/.test(proc) && /Podium 3/.test(proc),
    proc.slice(proc.indexOf(mr.ref), proc.indexOf(mr.ref) + 120));

  // and each one opens as a real record with its workflow
  await page.evaluate((r) => openDetail(r), vo.ref);
  await page.waitForTimeout(1000);
  const det = await page.evaluate(() => document.body.innerText);
  check('a register row opens the real record', /Coral pond civil works/.test(det) && /Workflow/i.test(det),
    det.slice(0, 200));
  check('and it can be attached to and approved like any other', !!(await page.$('#attAdd')) && !!(await page.$('#recDoc')));
  await page.evaluate(() => closeDetail());

  // the site engineer raised the MR and must still not see the budget with it
  await page.evaluate(async () => {
    await fetch('/api/logout');
    await fetch('/api/signin/code', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'civil@naf.ae', code: '246810' }) });
  });
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  const seText = await page.evaluate(() => document.body.innerText);
  check('the site engineer still sees no material budget beside his request',
    !/38,000|1,250 m3/.test(seText), 'he raises it; the PM checks it against the BOM');

  await page.evaluate(async () => {
    await fetch('/api/logout');
    await fetch('/api/signin/code', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'pm@naf.ae', code: '246810' }) });
  });
}

// ---- P1: the access matrix, ON SCREEN ----------------------------------
// A button for something the API will refuse is a trap. The buttons shown must
// be exactly what the server accepts — in both directions.
{
  const signIn = async (email) => {
    await page.evaluate(async (e) => {
      await fetch('/api/logout');
      await fetch('/api/signin/code', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: e, code: '246810' }) });
    }, email);
    await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2200);
  };
  const newButtons = () => page.evaluate(() =>
    Array.from(document.querySelectorAll('[data-new]')).map((b) => b.getAttribute('data-new')));

  await signIn('hse@naf.ae');
  let btns = await newButtons();
  check('HSE is offered its own permits and observations',
    btns.includes('ptw') && btns.includes('obs'), btns.join(','));
  check('HSE is NOT offered a variation or a submittal',
    !btns.includes('variation') && !btns.includes('submittal'), btns.join(','));

  await signIn('qaqc@naf.ae');
  btns = await newButtons();
  check('QA/QC is offered NCRs and inspections',
    btns.includes('ncrform') && btns.includes('wir'), btns.join(','));
  check('QA/QC is NOT offered a permit to work', !btns.includes('ptw'), btns.join(','));

  await signIn('design@naf.ae');
  btns = await newButtons();
  check('Design is offered submittals and RFIs',
    btns.includes('submittal') && btns.includes('rfi'), btns.join(','));
  check('Design is NOT offered an NCR or a permit',
    !btns.includes('ncrform') && !btns.includes('ptw'), btns.join(','));

  // QA/QC must be able to close its own NCR on screen — the jam this clears
  await signIn('qaqc@naf.ae');
  const ncr = (await api('/api/records', { type: 'ncr', title: 'Blockwork alignment L3' }, admin)).json;
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2200);
  await page.evaluate((r) => openDetail(r), ncr.ref);
  await page.waitForTimeout(1200);
  check('QA/QC IS offered Approve on its own NCR', !!(await page.$('#recApprove')),
    'until now only the PM could move any record, which stops the job');
  await page.click('#recApprove');
  await page.waitForTimeout(2500);
  const moved = await page.evaluate(async (r) =>
    (await (await fetch('/api/record?ref=' + r)).json()).record, ncr.ref);
  check('and it really moved', moved && moved.step >= 1, JSON.stringify(moved && moved.status));

  // but QA/QC must NOT be offered approval on HSE's permit
  const ptw = (await api('/api/records', { type: 'ptw', title: 'Hot work L2' }, admin)).json;
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2200);
  await page.evaluate((r) => openDetail(r), ptw.ref);
  await page.waitForTimeout(1200);
  check('QA/QC is NOT offered Approve on HSE’s permit', (await page.$('#recApprove')) === null);
  const why = await page.$eval('#recMsg', (el) => el.textContent).catch(() => '');
  check('and the screen says so rather than going quiet', /not part of your access/i.test(why), why);

  await page.evaluate(async () => {
    await fetch('/api/logout');
    await fetch('/api/signin/code', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'pm@naf.ae', code: '246810' }) });
  });
}

// ---- P1: and the PM picks it up ----------------------------------------
await page.evaluate(async () => {
  await fetch('/api/logout');
  await fetch('/api/signin/code', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'pm@naf.ae', code: '246810' }) });
});
await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);
let pm = await page.evaluate(() => document.body.innerText);
check('PM sees the finished activity awaiting sign-off', /L4 slab rebar/.test(pm), pm.slice(0, 300));
const btn = await page.$('[data-signoff]');
check('the Sign off button is really there', !!btn);

if (btn) {
  await btn.click();
  await page.waitForTimeout(1500);
  pm = await page.evaluate(() => document.body.innerText);
  check('after signing off, the queue clears', /every finished activity has been signed off|Nothing waiting/.test(pm) || !/L4 slab rebar/.test(pm), pm.slice(0, 300));
  // and the server agrees
  const v = await (await fetch(BASE + '/api/verify', { headers: { Cookie: admin } })).json();
  check('the server recorded the sign-off', (v.counts && v.counts.verified) >= 1, JSON.stringify(v.counts));
}

check('no JavaScript errors on the page', errors.length === 0, errors.slice(0, 2).join(' | '));

await browser.close();
server.close();
console.log('\n' + checks + ' checks, ' + fails + ' failures');
process.exit(fails ? 1 : 0);
