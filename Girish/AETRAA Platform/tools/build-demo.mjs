// THE DEMO, AS ONE FILE YOU CAN OPEN.
//
//   node tools/build-demo.mjs
//
// Builds the seeded demo project, then walks the real platform as every member
// of the team and records what the real server answers to every call each of
// their screens makes. The answers are baked into a single HTML file alongside
// the real application, so the whole thing opens offline with no install and
// no server — and every screen shows exactly what the real platform produced.
//
// It is a recording, so it is read-only: raising a document or approving one
// needs the live platform. The file says so plainly rather than letting anyone
// press a button that quietly does nothing.
import { writeFileSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { build } from 'esbuild';
import { seedDemo, TEAM } from './demo-seed.mjs';

const OUT = process.argv[2] || new URL('../demo/AETRAA-Demo.html', import.meta.url).pathname;

await build({
  entryPoints: [new URL('../src/index.js', import.meta.url).pathname],
  bundle: true, format: 'esm', platform: 'neutral',
  outfile: '/tmp/builddemo-worker.mjs', logLevel: 'silent',
});
const db = new DatabaseSync(':memory:');
db.exec(readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));
function stmt(sql) {
  const st = db.prepare(sql); let args = [];
  const a = { bind(...x) { args = x; return a; },
    async all() { return { results: st.all(...args), success: true }; },
    async first(c) { const r = st.get(...args) ?? null; return c && r ? r[c] : r; },
    async run() { st.run(...args); return { success: true, meta: {} }; },
    async raw() { return st.all(...args).map((r) => Object.values(r)); } };
  return a;
}
const env = {
  DB: { prepare: stmt, async batch(l) { const o = []; for (const s of l) o.push(await s.run()); return o; },
        async exec(s) { db.exec(s); return { count: 1 }; } },
  OWNER_CODE: 'AETRAA-DEMO', LOGIN_TEST_CODE: '246810', SESSION_SECRET: 'demo-build',
};
const worker = (await import('/tmp/builddemo-worker.mjs')).default;
const ctx = { waitUntil() {}, passThroughOnException() {} };

let cookie = '';
const go = async (path, body, method) => {
  const res = await worker.fetch(new Request('http://demo' + path, {
    method: method || (body === undefined ? 'GET' : 'POST'),
    headers: Object.assign({ 'Content-Type': 'application/json' }, cookie ? { Cookie: cookie } : {}),
    body: body === undefined ? undefined : JSON.stringify(body),
  }), env, ctx);
  const sc = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
  if (sc.length) cookie = sc.map((c) => c.split(';')[0]).join('; ');
  const text = await res.text();
  return { status: res.status, text };
};
const api = {
  get: (p) => go(p).then((r) => { try { return JSON.parse(r.text); } catch (e) { return { _text: r.text, _status: r.status }; } }),
  post: (p, b) => go(p, b || {}).then((r) => { try { return JSON.parse(r.text); } catch (e) { return { _text: r.text, _status: r.status }; } }),
  reset() { cookie = ''; }, cookie: () => cookie, set(c) { cookie = c; },
};

console.log('  building the demo project…');
await seedDemo(api, (s) => console.log('    · ' + s), env.OWNER_CODE);

/* ---- record what each person's screens ask for ------------------------- */
// Every GET the app makes while a person is signed in. Recorded per person,
// because two people must never be shown the same thing — that is the whole
// point of the access matrix.
const READS = [
  '/api/data', '/api/records', '/api/people', '/api/portfolio', '/api/projects',
  '/api/boq', '/api/bom', '/api/ipc', '/api/drawings', '/api/issues',
  '/api/hse?period=weekly', '/api/hse?period=daily', '/api/hse/log',
  '/api/verify', '/api/resources', '/api/trades', '/api/audit', '/api/diary',
  '/api/report?kind=weekly', '/api/report?kind=daily', '/api/impact',
];

const captures = {};
const pages = {};
for (const [name, email] of TEAM) {
  api.reset();
  const si = await api.post('/api/signin/code', { email, code: '246810' });
  if (si && si.error) { console.log('    ! could not sign in as ' + email); continue; }
  const mine = {};
  for (const path of READS) {
    const r = await go(path);
    if (r.status < 400) mine[path] = r.text;
  }
  // records by type, as the registers ask for them
  for (const t of ['submittal', 'rfi', 'wir', 'ncr', 'ptw', 'obs', 'variation', 'letter', 'mr', 'cert', 'material']) {
    const r = await go('/api/records?type=' + t);
    if (r.status < 400) mine['/api/records?type=' + t] = r.text;
  }
  captures[email] = mine;
  const page = await go('/');
  pages[email] = page.text;
  console.log('    · recorded ' + Object.keys(mine).length + ' answers for ' + email);
}

/* ---- build the file ----------------------------------------------------- */
// The app HTML is the same for everyone except the identity injected into it,
// so one copy is kept and the identity is swapped when the viewer changes.
const anyPage = pages['pm@naf.ae'] || Object.values(pages)[0];
const ME_RE = /window\.__ME__ = ([\s\S]*?);<\/script>/;
const identities = {};
for (const [email, html] of Object.entries(pages)) {
  const m = html.match(ME_RE);
  if (m) identities[email] = m[1];
}
const shell = anyPage.replace(ME_RE, 'window.__ME__ = window.__DEMO_ME__;</script>');

const bar = `
<div id="demoBar" style="position:fixed;left:0;right:0;bottom:0;z-index:9999;
  background:#10243f;color:#fff;font:13px/1.45 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
  padding:9px 16px;display:flex;gap:14px;align-items:center;flex-wrap:wrap;
  box-shadow:0 -2px 10px rgba(0,0,0,.25)">
  <b style="letter-spacing:.3px">AETRAA — demo</b>
  <span style="opacity:.75">NAF Tower — G+2P+12 · Dubai Islands</span>
  <label style="margin-left:auto;display:flex;gap:7px;align-items:center">
    <span style="opacity:.75">Signed in as</span>
    <select id="demoWho" style="padding:5px 8px;border-radius:6px;border:0;font:inherit;min-width:250px"></select>
  </label>
  <span style="opacity:.65">Recorded from the real platform — reading works, saving does not.</span>
</div>
<style>body{padding-bottom:46px}</style>
<script>
(function(){
  var IDS = window.__DEMO_IDENTITIES__, TEAM = window.__DEMO_TEAM__;
  function boot(){
    var sel = document.getElementById('demoWho');
    if (!sel) return;
    TEAM.forEach(function(t){
      if (!IDS[t[1]]) return;
      var o = document.createElement('option');
      o.value = t[1];
      o.textContent = t[0] + ' — ' + t[2].join(' + ');
      sel.appendChild(o);
    });
    try { sel.value = localStorage.getItem('aetraa.demo.who') || 'pm@naf.ae'; } catch(e){}
    sel.addEventListener('change', function(){
      try { localStorage.setItem('aetraa.demo.who', this.value); } catch(e){}
      location.reload();
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
</script>`;

const head = '<script>' +
  'window.__DEMO_CAPTURES__ = ' + JSON.stringify(captures) + ';' +
  'window.__DEMO_IDENTITIES__ = {' +
    Object.entries(identities).map(([k, v]) => JSON.stringify(k) + ':' + v).join(',') + '};' +
  'window.__DEMO_TEAM__ = ' + JSON.stringify(TEAM.map((t) => [t[0], t[1], t[2]])) + ';' +
  'window.__DEMO_ME__ = (function(){' +
  '  var w; try { w = localStorage.getItem("aetraa.demo.who"); } catch(e){}' +
  '  return window.__DEMO_IDENTITIES__[w] || window.__DEMO_IDENTITIES__["pm@naf.ae"] ||' +
  '         window.__DEMO_IDENTITIES__[Object.keys(window.__DEMO_IDENTITIES__)[0]];' +
  '})();' +
  // THE SHIM MUST BE HERE, NOT AT THE END OF THE BODY.
  // The application's scripts run in document order and start fetching as soon
  // as they execute. A shim injected before </body> is installed AFTER those
  // calls have already gone out and failed, which renders every register empty
  // while the data sits in the file unused.
  'var __realFetch = window.fetch;' +
  'window.fetch = function(input, init){' +
  '  var url = String((input && input.url) || input || "");' +
  '  var path = url.replace(/^[a-z]+:\\/\\/[^/]*/i, "");' +
  '  var method = ((init && init.method) || (input && input.method) || "GET").toUpperCase();' +
  '  var who; try { who = localStorage.getItem("aetraa.demo.who"); } catch(e){}' +
  '  var mine = window.__DEMO_CAPTURES__[who] || window.__DEMO_CAPTURES__["pm@naf.ae"] || {};' +
  '  if (method === "GET" && mine[path] !== undefined) {' +
  '    return Promise.resolve(new Response(mine[path], { status: 200, headers: { "Content-Type": "application/json" } }));' +
  '  }' +
  '  if (path.indexOf("/api/") === 0 || path.indexOf("/attachment/") === 0) {' +
  '    if (method !== "GET") {' +
  '      return Promise.resolve(new Response(JSON.stringify({ error:' +
  '        "This is a recording of the platform, so nothing can be saved here. " +' +
  '        "Run the live demo to raise, approve and certify." }),' +
  '        { status: 501, headers: { "Content-Type": "application/json" } }));' +
  '    }' +
  '    return Promise.resolve(new Response(JSON.stringify({ error: "not recorded in this demo" }),' +
  '      { status: 404, headers: { "Content-Type": "application/json" } }));' +
  '  }' +
  '  return __realFetch.apply(this, arguments);' +
  '};' +
  '</script>';

// The app's own JavaScript contains the strings "</head>" and "</body>" — the
// print function builds a whole document out of them. A plain .replace() takes
// the FIRST match, which is inside that string literal, and injecting there
// breaks the script silently: the page still renders, but as the raw design
// with none of the live behaviour installed.
//
// The real </head> is the first one (the head precedes every script); the real
// </body> is the last one.
function injectAtFirst(src, marker, text) {
  const i = src.indexOf(marker);
  if (i < 0) throw new Error('no ' + marker + ' in the page');
  return src.slice(0, i) + text + src.slice(i);
}
function injectAtLast(src, marker, text) {
  const i = src.lastIndexOf(marker);
  if (i < 0) throw new Error('no ' + marker + ' in the page');
  return src.slice(0, i) + text + src.slice(i);
}
let html = shell.replace('<title>', '<title>AETRAA Demo — ');
html = injectAtFirst(html, '</head>', head);
html = injectAtLast(html, '</body>', bar);

writeFileSync(OUT, html);
const mb = (Buffer.byteLength(html) / 1048576).toFixed(1);
console.log('\n  wrote ' + OUT + '  (' + mb + ' MB)');
console.log('  open it in any browser — no server, no install.\n');
