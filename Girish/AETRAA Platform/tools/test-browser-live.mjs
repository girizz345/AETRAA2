// EVERY DASHBOARD, EVERY COUNTER, EVERY SIDEBAR LINK.
//
// The design ships a literal for every headline number and every sidebar badge
// — 48 drawings, 87% first-time pass, 142 days LTI-free, "RFIs 7" — and around
// a hundred sidebar links with no href and no handler. This file checks, in a
// real browser and for every role, that the numbers on screen come from this
// project and that no link is dead.
//
//   node tools/test-browser-live.mjs
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
  outfile: '/tmp/live-browser-worker.mjs', logLevel: 'silent',
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
const env = {
  DB: { prepare: stmt, async batch(l) { const o = []; for (const s of l) o.push(await s.run()); return o; },
        async exec(s) { db.exec(s); return { count: 1 }; } },
  OWNER_CODE: 'MASTERCODE', LOGIN_TEST_CODE: '246810', SESSION_SECRET: 'live-browser',
};
const worker = (await import('/tmp/live-browser-worker.mjs')).default;
const ctx = { waitUntil() {}, passThroughOnException() {} };
const server = createServer(async (req, res) => {
  const chunks = []; for await (const c of req) chunks.push(c);
  const r = await worker.fetch(new Request('http://localhost' + req.url, {
    method: req.method, headers: req.headers,
    body: (req.method === 'GET' || req.method === 'HEAD') ? undefined : Buffer.concat(chunks) }), env, ctx);
  res.statusCode = r.status;
  r.headers.forEach((v, k) => { if (k.toLowerCase() === 'set-cookie') res.appendHeader('set-cookie', v); else res.setHeader(k, v); });
  res.end(Buffer.from(await r.arrayBuffer()));
});
await new Promise((ok) => server.listen(0, ok));
const BASE = 'http://localhost:' + server.address().port;

const api = async (path, body, cookie) => {
  const r = await fetch(BASE + path, { method: 'POST',
    headers: Object.assign({ 'Content-Type': 'application/json' }, cookie ? { Cookie: cookie } : {}),
    body: JSON.stringify(body) });
  const sc = r.headers.getSetCookie ? r.headers.getSetCookie() : [];
  return { json: await r.json().catch(() => null), cookie: sc.map((c) => c.split(';')[0]).join('; ') };
};
let a = await api('/api/login', { code: 'MASTERCODE' });
const admin = a.cookie;
a = await api('/api/setup/onboard', {
  company: { name: 'NAF Contracting LLC' },
  project: { name: 'NAF Tower', location: 'Dubai', currency: 'AED', retention_pct: 10, payment_days: 56 },
  principal: { name: 'M. Al Nuaimi', email: 'principal@naf.ae' } }, admin);
const PID = a.json.project_id;
const ROLES = [['pm', 'pm@naf.ae'], ['planning', 'planner@naf.ae'], ['design', 'design@naf.ae'],
  ['dc', 'dc@naf.ae'], ['qaqc', 'qaqc@naf.ae'], ['hse', 'hse@naf.ae'],
  ['commercial', 'commercial@naf.ae'], ['procurement', 'proc@naf.ae'], ['finance', 'fin@naf.ae'],
  ['site', 'civil@naf.ae'], ['consultant', 'consultant@naf.ae'], ['subcon', 'sub@naf.ae']];
for (const [fn, em] of ROLES) {
  await api('/api/person', { name: fn.toUpperCase() + ' user', email: em, functions: [fn],
    groups: fn === 'site' ? ['Civil'] : [], projects: [PID] }, admin);
}
// real material for the counters to count
await fetch(BASE + '/api/import', { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: admin },
  body: JSON.stringify({ replace: true, text:
    'ID,Activity,WBS,Planned Start,Planned Finish,Trade Group,Weight\n' +
    'A1000,L4 slab rebar,Structure,2026-11-02,2026-11-11,Civil,100\n' +
    'A1010,L4 formwork,Structure,2026-11-12,2026-11-20,Civil,100' }) });
await api('/api/records', { type: 'rfi', title: 'Duct clash at L5', data: { Subject: 'Duct clash at L5' } }, admin);
await api('/api/records', { type: 'ncr', title: 'Blockwork alignment' }, admin);
await api('/api/records', { type: 'ptw', title: 'Hot work L2' }, admin);

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('dialog', (d) => d.accept());
await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });

const seeAs = async (email) => {
  await page.evaluate(async (e) => {
    await fetch('/api/logout');
    await fetch('/api/signin/code', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: e, code: '246810' }) });
  }, email);
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2400);
};

// ---- every headline counter must come from this project ------------------
// These are the design's literals. Not one of them can be computed from a
// project holding two activities and three records, so any of them on screen
// is somebody else's number.
const INVENTED = /\b(48|87%|142|312|910k|12\.4m|66\.1m|4\.41m|18\.40m|61%|67%|39,140|38,000|1,250)\b/;

for (const [role, email] of [['principal', 'principal@naf.ae']].concat(ROLES)) {
  await seeAs(email);
  const kpis = await page.evaluate(() =>
    Array.from(document.getElementById('kpis').children).map((k) => k.innerText.replace(/\n/g, ' ')));
  check('[' + role + '] headline counters are this project’s',
    !kpis.some((k) => INVENTED.test(k)), kpis.filter((k) => INVENTED.test(k)).join(' ; '));
  check('[' + role + '] and none of them is NaN', !kpis.some((k) => /NaN/.test(k)), kpis.join(' | '));
}

// the counters actually track the data
await seeAs('design@naf.ae');
let txt = await page.evaluate(() => document.getElementById('kpis').innerText);
check('the Design counter shows the ONE real RFI', /1[\s\S]{0,24}RFI/i.test(txt), txt.replace(/\n/g, ' '));
await api('/api/records', { type: 'rfi', title: 'Second RFI', data: { Subject: 'Second RFI' } }, admin);
await seeAs('design@naf.ae');
txt = await page.evaluate(() => document.getElementById('kpis').innerText);
check('and it becomes two when a second is raised', /2[\s\S]{0,24}RFI/i.test(txt), txt.replace(/\n/g, ' '));

// ---- sidebar badges ------------------------------------------------------
await seeAs('pm@naf.ae');
const badges = await page.evaluate(() =>
  Array.from(document.querySelectorAll('#nav a')).map((l) => {
    const b = l.querySelector('.bdg');
    return { label: l.getAttribute('data-nav'), badge: b ? b.textContent : null };
  }));
check('sidebar badges are no longer the design’s literals',
  !badges.some((b) => b.badge && ['7', '3', '5', '2', '4', '9', '48'].includes(b.badge) &&
    !['RFIs', 'NCRs', 'Variations', 'Inspections', 'Submittals', 'Decisions to me', 'Team & access'].includes(b.label)),
  JSON.stringify(badges.filter((b) => b.badge)));
const rfiBadge = badges.find((b) => b.label === 'RFIs');
check('the RFI badge counts the real RFIs', rfiBadge && rfiBadge.badge === '2',
  JSON.stringify(rfiBadge));
const ncrBadge = badges.find((b) => b.label === 'NCRs');
check('the NCR badge counts the real NCRs', ncrBadge && ncrBadge.badge === '1', JSON.stringify(ncrBadge));

// ---- EVERY sidebar link, on EVERY dashboard, must do something -----------
// Links are re-queried each time, because render() redraws the sidebar and a
// reference taken before that is a detached node that silently does nothing.
let totalLinks = 0, deadLinks = [];
for (const [role, email] of [['principal', 'principal@naf.ae']].concat(ROLES)) {
  await seeAs(email);
  const labels = await page.evaluate(() =>
    Array.from(document.querySelectorAll('#nav a[data-nav]')).map((l) => l.getAttribute('data-nav')));
  check('[' + role + '] every sidebar link is labelled for routing', labels.length > 0 && labels.every(Boolean),
    JSON.stringify(labels));
  for (const label of labels) {
    const res = await page.evaluate(async (lb) => {
      // A link may switch dashboard, which redraws the sidebar. Restore the
      // starting dashboard after every click or the next link is not there to
      // be clicked — which reads as "dead" when it is nothing of the kind.
      const home = state.role;
      // A link may change the column, switch dashboard, OR open the detail
      // overlay. Measuring only the column reads an opened report as dead.
      const det = document.getElementById('detail');
      const sig = () => state.role + '|' + document.getElementById('pageTitle').textContent +
        '|' + document.getElementById('leftcol').innerHTML.length +
        '|' + (det && !det.classList.contains('hide') ? det.innerHTML.length : 0);
      const before = sig();
      const link = document.querySelector('#nav a[data-nav="' + lb.replace(/"/g, '\\"') + '"]');
      if (!link) return { ok: false, why: 'link vanished' };
      link.click();
      await new Promise((r) => setTimeout(r, 140));
      const after = sig();
      const title = document.getElementById('pageTitle').textContent;
      // Clicking the dashboard you are already standing on is not dead — it
      // takes you there and marks the link. This has to be read BEFORE the
      // reset below, which clears the highlight and redraws the sidebar.
      const fresh = document.querySelector('#nav a[data-nav="' + lb.replace(/"/g, '\\"') + '"]');
      const marked = !!(fresh && fresh.classList.contains('on'));
      try { closeDetail(); } catch (e) {}
      state.navView = null; state.navLabel = null;
      state.role = home; state.readonly = false;
      try { render(); } catch (e) {}
      await new Promise((r) => setTimeout(r, 60));
      return { ok: before !== after || marked || /^Dashboard$/i.test(lb),
               title, why: before + ' -> ' + after + (marked ? ' (marked active)' : '') };
    }, label);
    totalLinks++;
    if (!res.ok) deadLinks.push(role + ' / ' + label + ' [' + (res.why || '') + ']');
  }
}
check('EVERY sidebar link across every dashboard does something',
  deadLinks.length === 0, deadLinks.length + ' dead:\n    ' + deadLinks.slice(0, 12).join('\n    '));
console.log('  (' + totalLinks + ' sidebar links exercised)');

// a link with nothing behind it answers honestly rather than going quiet
await seeAs('pm@naf.ae');
const notYet = await page.evaluate(async () => {
  const l = document.querySelector('#nav a[data-nav="Minutes"]');
  if (!l) return null;
  l.click();
  await new Promise((r) => setTimeout(r, 200));
  return document.getElementById('leftcol').innerText;
});
check('a link with no feature behind it says so plainly',
  notYet && /not part of this project yet/i.test(notYet), (notYet || '').slice(0, 160));
check('and it offers a way back', !!(await page.$('[data-navback]')));

// a register link really opens that register
await seeAs('dc@naf.ae');
const opened = await page.evaluate(async () => {
  // Each dashboard names the link its own way — "RFIs", "RFI register",
  // "RFIs to answer". Take whichever this one has.
  const l = Array.from(document.querySelectorAll('#nav a[data-nav]'))
    .find((x) => /^RFI/i.test(x.getAttribute('data-nav')));
  if (!l) return { title: '(no RFI link on this dashboard)', body: '' };
  l.click();
  await new Promise((r) => setTimeout(r, 250));
  return { title: document.getElementById('pageTitle').textContent,
           body: document.getElementById('leftcol').innerText };
});
check('a register link opens that register', /RFI register/i.test(opened.title), opened.title);

// and the Design office, which OWNS RFIs, can reach its own register
await seeAs('design@naf.ae');
const designHasRfi = await page.evaluate(() =>
  Array.from(document.querySelectorAll('#nav a[data-nav]')).some((x) => /^RFI/i.test(x.getAttribute('data-nav'))));
check('the office that RAISES RFIs can reach the RFI register', designHasRfi,
  'the design gave Design no RFI link at all');
check('and the real RFI is in it', /Duct clash at L5/.test(opened.body), opened.body.slice(0, 200));

// ---- THE SAFETY REPORT ---------------------------------------------------
// The design's version invented 108 men on site, 96% PPE and 142 days LTI-free,
// and said it came from the HSE registers. This is a safety record.
await seeAs('hse@naf.ae');
let hse = await page.evaluate(async () => {
  openHse('weekly');
  await new Promise((r) => setTimeout(r, 1200));
  return document.getElementById('dpane').innerText;
});
check('the safety report carries NO invented figure',
  !/108|96%|142|\b14\b.*permits|18 inductions/.test(hse),
  (hse.match(/108|96%|142/g) || []).join(' '));
check('it says plainly that it is incomplete', /This report is incomplete/i.test(hse), hse.slice(0, 250));
check('and names what has not been logged', /Toolbox talks/.test(hse) && /PPE compliance/.test(hse),
  hse.slice(0, 300));
check('with no incident recorded it does NOT claim days LTI-free',
  /no lost-time injury has been recorded/i.test(hse),
  'the design claimed 142 days on a project with no safety record at all');
check('the permit raised earlier is listed as open', /PTW|Hot work L2/.test(hse), hse.slice(0, 400));

// keep a log, and the report changes
await page.evaluate(async () => {
  await fetch('/api/hse/log', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ men_on_site: 42, toolbox_talks: 1, toolbox_attended: 20,
      inductions: 2, ppe_checked: 40, ppe_compliant: 39 }) });
});
hse = await page.evaluate(async () => {
  closeDetail(); openHse('weekly');
  await new Promise((r) => setTimeout(r, 1200));
  return document.getElementById('dpane').innerText;
});
check('once logged, the real toolbox talk appears', /Toolbox talks[\s\S]{0,40}1/.test(hse), hse.slice(0, 400));
check('PPE is computed from the real sample', /98%/.test(hse), (hse.match(/\d+%/g) || []).join(' '));
check('and the sample it came from is shown', /39 of 40/.test(hse), hse.slice(0, 500));
check('the report no longer calls itself incomplete for those lines',
  !/Toolbox talks, /.test(hse), hse.slice(0, 250));

// the log is HSE's book
const logGate = await page.evaluate(async () => {
  await fetch('/api/logout');
  await fetch('/api/signin/code', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'civil@naf.ae', code: '246810' }) });
  const r = await fetch('/api/hse/log', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ men_on_site: 999 }) });
  return r.status;
});
check('a site engineer cannot write in the safety log', logGate === 403, 'status=' + logGate);

// ---- the panel buttons that used to do nothing ---------------------------
await seeAs('hse@naf.ae');
const btns = await page.evaluate(async () => {
  openHse('weekly');
  await new Promise((r) => setTimeout(r, 1200));
  return Array.from(document.querySelectorAll('#dpane .actbar button')).map((b) => ({
    text: b.textContent.trim(),
    wired: !!(b.getAttribute('data-print') || b.getAttribute('data-hselog') ||
              b.getAttribute('data-emailout') || b.getAttribute('data-exportcsv') || b.id),
  }));
});
check('every button on the safety report is wired', btns.length > 0 && btns.every((b) => b.wired),
  JSON.stringify(btns));
check('and one of them is a real print/PDF', btns.some((b) => /print|PDF/i.test(b.text)), JSON.stringify(btns));

await seeAs('planner@naf.ae');
const rbtns = await page.evaluate(async () => {
  openReport('weekly');
  await new Promise((r) => setTimeout(r, 600));
  return Array.from(document.querySelectorAll('#dpane .actbar button')).map((b) => ({
    text: b.textContent.trim(),
    wired: !!(b.getAttribute('data-print') || b.getAttribute('data-emailout') ||
              b.getAttribute('data-exportcsv') || b.getAttribute('data-savedraft') || b.id),
  }));
});
check('every button on the progress report is wired too', rbtns.length > 0 && rbtns.every((b) => b.wired),
  JSON.stringify(rbtns));

// ---- the registers that were permanently empty --------------------------
// The Drawing register and the priced BOQ each had a server module and an
// endpoint, and neither was ever routed in, so both read "nothing recorded"
// for ever while the counter above claimed 48 drawings.
await fetch(BASE + '/api/boq/import', { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: admin },
  body: JSON.stringify({ project_id: PID, rows: [
    { ref: 'B1', section: 'Structure', description: 'RC frame', amount: 4000000 },
    { ref: 'B2', section: 'Finishes', description: 'Internal finishes', amount: 1000000 } ] }) });
await seeAs('commercial@naf.ae');
const boqView = await page.evaluate(async () => {
  const l = Array.from(document.querySelectorAll('#nav a[data-nav]')).find((x) => /BOQ/i.test(x.getAttribute('data-nav')));
  if (!l) return '(no BOQ link)';
  l.click(); await new Promise((r) => setTimeout(r, 900));
  return document.getElementById('leftcol').innerText;
});
check('the priced BOQ register shows the real bill',
  /Structure/.test(boqView) && /Finishes/.test(boqView), boqView.slice(0, 250));
check('and no longer says nothing is recorded', !/Nothing recorded on this project/.test(boqView),
  boqView.slice(0, 200));

// ---- the last invented panels -------------------------------------------
await seeAs('dc@naf.ae');
const dcBody = await page.evaluate(() => document.getElementById('leftcol').innerText);
check('Document Control\u2019s "registers at a glance" is no longer invented',
  !/48 current|12 new|\b23\b/.test(dcBody), (dcBody.match(/48 current|12 new/g) || []).join(' '));
const glance = await page.evaluate(() => {
  const c = Array.from(document.querySelectorAll('.card'))
    .find((x) => /Registers at a glance/.test((x.querySelector('h2') || {}).textContent || ''));
  return c ? c.innerText : '(card not found)';
});
check('and it counts the real registers', /RFIs/.test(glance) && /Submittals/.test(glance), glance.slice(0, 300));
check('the RFI line shows the real count, not 7',
  /RFIs\s+2\b/.test(glance.replace(/\n/g, ' ')) || !/\b7\b/.test(glance),
  glance.replace(/\n/g, ' ').slice(0, 200));

await seeAs('fin@naf.ae');
const finBody = await page.evaluate(() => document.getElementById('leftcol').innerText);
check('the Finance cashflow bars are gone', !/Suppliers out|Net position/.test(finBody),
  (finBody.match(/Suppliers out|Net position/g) || []).join(' '));
check('and it says why rather than drawing an invented chart',
  /platform does not hold|no cashflow to show/i.test(finBody), finBody.slice(0, 300));

await seeAs('sub@naf.ae');
const subBody = await page.evaluate(() => document.body.innerText);
check('the invented subcontractor valuation is gone', !/910k|Inches & Feet/.test(subBody),
  (subBody.match(/910k|Inches & Feet/g) || []).join(' '));

// a reference that is not a record must not claim a project it has nothing to do with
await seeAs('pm@naf.ae');
const ghost = await page.evaluate(async () => {
  openDetail('AR-999');
  await new Promise((r) => setTimeout(r, 400));
  return document.getElementById('dpane').innerText;
});
check('an unknown reference does not claim the design\u2019s project',
  !/6457759/.test(ghost), ghost.slice(0, 200));
check('and does not show an attachment nobody uploaded',
  !/AR-999 document\.pdf/.test(ghost), ghost.slice(0, 300));
check('it says plainly it is not a record on this project',
  /not a record held on this project/i.test(ghost), ghost.slice(0, 300));

check('no JavaScript errors anywhere in all of that', errors.length === 0, errors.slice(0, 2).join(' | '));

await browser.close();
server.close();
console.log('\n' + checks + ' checks, ' + fails + ' failures');
process.exit(fails ? 1 : 0);
