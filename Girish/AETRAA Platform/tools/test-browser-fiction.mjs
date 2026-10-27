// THE DESIGN'S OWN FICTION — pinned so it can never come back.
//
// The live app is generated FROM the design prototype, which ships worked
// examples throughout. Each fault below was found on screen in a real browser
// and then fixed in the generator. This file exists so that regenerating the
// app from a revised design cannot quietly reintroduce any of them.
//
//   node tools/test-browser-fiction.mjs
//
// It runs in its own browser session on purpose: the main browser test grew
// long enough that Chromium was dying part-way through a single run.
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
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


// ---- open it in a real browser ------------------------------------------
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('dialog', (d) => d.accept());

// give the project one activity so the programme-driven panels have something
await fetch(BASE + '/api/import', { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: admin },
  body: JSON.stringify({ replace: true, text:
    'ID,Activity,WBS,Planned Start,Planned Finish,Trade Group,Weight\nA1000,L4 slab rebar,Structure,2026-11-02,2026-11-11,Civil,100' }) });

await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });   // an origin to fetch from

const seeAs = async (email) => {
  await page.evaluate(async (e) => {
    await fetch('/api/logout');
    await fetch('/api/signin/code', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: e, code: '246810' }) });
  }, email);
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2200);
  return page.evaluate(() => document.body.innerText);
};

// THE WORST ONE: the Principal was shown three projects, two of them other
// companies'. A client seeing another client's project ends the conversation.
let t = await seeAs('principal@naf.ae');
check('the Principal sees NO other company’s project',
  !/JBBC|Al Barari|Business Bay/.test(t),
  (t.match(/JBBC|Al Barari|Business Bay/) || ['clean'])[0]);
check('and no fabricated plot number anywhere', !/6457759/.test(t));
check('the Principal DOES see their own real project', /NAF Tower/.test(t), t.slice(0, 300));
check('with progress read from the programme, not invented',
  !/Portfolio is 4% behind the combined baseline/.test(t));

// an empty programme divided by zero
t = await seeAs('planner@naf.ae');
check('no NaN reaches the screen', !/NaN/.test(t), (t.match(/NaN\S*/g) || []).slice(0, 3).join(' '));

// the frozen clock
const today = await page.evaluate(() => (typeof TODAY === 'string' ? TODAY : null));
check('the app uses today’s real date, not the design’s frozen one',
  today === new Date().toISOString().slice(0, 10), 'TODAY=' + today);

// the pre-filled forms that saved themselves as real documents
await seeAs('design@naf.ae');
await page.evaluate(() => openNewForm('rfi'));
await page.waitForTimeout(700);
const prefilled = await page.evaluate(() =>
  Array.from(document.querySelectorAll('#dpane .frm input[type=text], #dpane .frm textarea'))
    .map((i) => i.value).filter(Boolean));
check('create forms open EMPTY, not pre-filled with the design’s examples',
  prefilled.length === 0, 'still pre-filled: ' + prefilled.join(' | '));

// and an empty required field is refused rather than saved
const countBefore = await page.evaluate(async () => (await (await fetch('/api/records')).json()).records.length);
await page.click('[data-gen="rfi"]');
await page.waitForTimeout(1200);
const needs = await page.$eval('#formNeeds', (el) => el.textContent).catch(() => '');
check('an empty required field is refused, not saved', /Still needed/.test(needs), needs || '(no warning)');
check('and the warning names the fields, in the form itself',
  /Subject/.test(needs) && /Question/.test(needs), needs);
const countAfter = await page.evaluate(async () => (await (await fetch('/api/records')).json()).records.length);
check('and nothing was written', countAfter === countBefore, countBefore + ' → ' + countAfter);
await page.evaluate(() => { try { closeDetail(); } catch (e) {} });

// the duplicate update panel that silently discarded the engineer's input
const dup = await page.evaluate(() =>
  (typeof activityPanel === 'function' ? activityPanel('ACT-118') : 'gone'));
check('the design’s dead activity panel no longer renders', dup === '',
  'a programme using ACT- codes showed two panels, one of which threw the input away');




check('no JavaScript errors while proving all of this', errors.length === 0, errors.slice(0, 2).join(' | '));

await browser.close();
server.close();
console.log('\n' + checks + ' checks, ' + fails + ' failures');
process.exit(fails ? 1 : 0);
