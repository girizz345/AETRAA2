// THE INTAKE AND SETUP PAGES, IN A REAL BROWSER.
//
//   node tools/test-browser-intake.mjs
//
// The unit and API tests prove the engine and the door. This proves the screen:
// that the page loads, that its script runs without throwing, and that the
// things a person actually needs to see are on it.
//
// It matters because a page with one JavaScript error looks fine in a diff and
// is dead in a browser, and nothing else in the suite would catch it.
//
// The pages are served over HTTP rather than set as content, because they fetch
// relative URLs and those do not resolve on about:blank.
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { intakeHTML } from '../src/html/intake.js';
import { setupHTML } from '../src/html/setup.js';
import { catalogue } from '../src/modules.js';

const json = (res, o) => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
const srv = createServer((req, res) => {
  const u = req.url.split('?')[0];
  if (u === '/intake') { res.writeHead(200, { 'Content-Type': 'text/html' }); return res.end(intakeHTML()); }
  if (u === '/setup') { res.writeHead(200, { 'Content-Type': 'text/html' }); return res.end(setupHTML()); }
  if (u === '/api/projects') return json(res, { projects: [{ id: 'p1', name: 'Tower A', ref: 'AET-001' }] });
  if (u === '/api/setup/rules') return json(res, { configured: false, rules: [] });
  if (u === '/api/setup/companies') return json(res, { companies: [], projects: [] });
  if (u === '/api/setup/modules') return json(res, catalogue());
  if (u.endsWith('.js') || u.endsWith('/sw.js')) {
    res.writeHead(200, { 'Content-Type': 'application/javascript' }); return res.end('/* stub */');
  }
  if (u.endsWith('manifest.webmanifest') || u.endsWith('/manifest.json')) {
    res.writeHead(200, { 'Content-Type': 'application/manifest+json' }); return res.end('{}');
  }
  return json(res, { ok: true, projects: [], companies: [] });
});
await new Promise((r) => srv.listen(0, r));
const base = 'http://127.0.0.1:' + srv.address().port;

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
let bad = 0;
const say = (n, ok, d) => { console.log((ok ? '  ok   ' : '  FAIL ') + n + (ok ? '' : '  — ' + d)); if (!ok) bad++; };

const pg = await b.newPage();
const errs = [];
pg.on('pageerror', (e) => errs.push(e.message));
pg.on('console', (m) => { if (m.type() === 'error' && !/favicon|manifest|sw\.js/.test(m.text())) errs.push(m.text()); });

await pg.goto(base + '/intake', { waitUntil: 'networkidle' });
const opts = await pg.$$eval('#proj option', (o) => o.map((x) => x.textContent.trim()));
say('the project list loads', opts.some((t) => /Tower A/.test(t)), JSON.stringify(opts));
await pg.selectOption('#proj', 'p1');
await pg.waitForTimeout(500);
say('an unconfigured gate is announced', await pg.$eval('#gateWarn', (e) => e.className.includes('on')), 'no warning');
say('the drop zone is there', !!(await pg.$('#drop')));
say('the review card starts hidden', !(await pg.$eval('#reviewCard', (e) => e.className.includes('on'))));
say('the terms card starts hidden', !(await pg.$eval('#termsCard', (e) => e.className.includes('on'))));
say('clicking the drop zone opens a file picker', await pg.evaluate(() => {
  let opened = false;
  const p = document.getElementById('picker');
  p.click = () => { opened = true; };
  document.getElementById('drop').click();
  return opened;
}));
say('the intake page throws no script errors', errs.length === 0, JSON.stringify(errs).slice(0, 300));

const pg2 = await b.newPage();
await pg2.route('**/cdnjs.cloudflare.com/**', (r) =>
  r.fulfill({ status: 200, contentType: 'application/javascript', body: 'window.XLSX={};' }));
const errs2 = [];
pg2.on('pageerror', (e) => errs2.push(e.message));
pg2.on('console', (m) => { if (m.type() === 'error' && !/favicon|manifest|sw\.js|cdnjs/.test(m.text())) errs2.push(m.text()); });
await pg2.goto(base + '/setup', { waitUntil: 'domcontentloaded' });
await pg2.waitForTimeout(1200);
say('the numbering rules card is on the setup page', !!(await pg2.$('#rules_save')));
say('the draft button is there', !!(await pg2.$('#goDraft')));
say('there is a link to intake', await pg2.$eval('a[href="/intake"]', (e) => !!e).catch(() => false));
say('adding a prefix renders a row', await pg2.evaluate(() => {
  document.getElementById('rule_match').value = 'ST';
  document.getElementById('rule_disc').value = 'Structural';
  document.getElementById('rule_add').click();
  return /ST/.test(document.getElementById('rules_rows').innerHTML);
}));
say('the setup page throws no script errors', errs2.length === 0, JSON.stringify(errs2).slice(0, 300));

await b.close(); srv.close();
console.log(bad ? '\n' + bad + ' FAILED' : '\nall passed');
process.exit(bad ? 1 : 0);
