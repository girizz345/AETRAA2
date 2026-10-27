// MODULES — a project gets only the modules ticked for it.
//
//   node tools/test-modules.mjs
//
// The catalogue, the onboarding step, the server-side wall (a switched-off
// module is refused, not merely hidden), records by module, the identity the app
// shell boots with, switching a module back on without losing data, and every
// project set up before modules existed keeping everything.
//
// Runs the real worker against the real schema in an in-memory SQLite.
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import {
  MODULES, MODULE_IDS, cleanModules, modulesOf, moduleForPath, recordTypeOn, setupStepsOn, dashboardsOff,
} from '../src/modules.js';
import { RECORD_CREATORS } from '../src/functions.js';

let fails = 0, checks = 0;
const check = (n, c, d) => { checks++; console.log((c ? '  ok   ' : '  FAIL ') + n + (d && !c ? '  — ' + d : '')); if (!c) fails++; };

/* ------------------------------------------------------------------ unit */

check('catalogue has eleven modules', MODULES.length === 11, String(MODULES.length));
check('every module id is a dashboard name', MODULE_IDS.every((id) =>
  ['planning','site','dc','design','qaqc','hse','commercial','procurement','finance','subcon','consultant'].includes(id)));
check('clean drops unknown ids and repeats', JSON.stringify(cleanModules(['hse', 'nope', 'hse', 'commercial'])) === '["hse","commercial"]');
check('clean refuses a non-list', cleanModules('hse') === null);
check('a project with no list has everything (legacy)', modulesOf({ modules: null }).length === MODULE_IDS.length);
check('a blank list means base only', modulesOf({ modules: '[]' }).length === 0);
check('unreadable list falls back to everything', modulesOf({ modules: '{oops' }).length === MODULE_IDS.length);
check('BOQ API belongs to commercial', moduleForPath('/api/boq/import') === 'commercial');
check('IPC API belongs to commercial', moduleForPath('/api/ipc') === 'commercial');
check('BOM API belongs to procurement', moduleForPath('/api/bom/check') === 'procurement');
check('HSE API belongs to hse', moduleForPath('/api/hse/log') === 'hse');
check('drawings API belongs to dc', moduleForPath('/api/drawings/for') === 'dc');
check('a prefix is not a match on its own (/api/bomb)', moduleForPath('/api/bomb') === null);
check('core API is never gated', moduleForPath('/api/data') === null && moduleForPath('/api/records') === null);
check('every record type has a home', Object.keys(RECORD_CREATORS).every((t) =>
  MODULES.some((m) => m.records.includes(t)) || t === 'letter'), 'unhomed: ' +
  Object.keys(RECORD_CREATORS).filter((t) => !MODULES.some((m) => m.records.includes(t)) && t !== 'letter'));
check('NCR off without QA/QC', recordTypeOn(['hse'], 'ncr') === false);
check('incoming letters come with Document Control', recordTypeOn(['dc'], 'incoming') && !recordTypeOn(['design', 'commercial'], 'incoming'));
check('NCR on with QA/QC', recordTypeOn(['qaqc'], 'ncr') === true);
check('letter on with commercial only', recordTypeOn(['commercial'], 'letter') === true);
check('letter off with neither', recordTypeOn(['hse'], 'letter') === false);
check('BOQ step needed only with commercial', setupStepsOn(['commercial']).includes('boq') && !setupStepsOn(['hse']).includes('boq'));
check('templates needed with design or dc', setupStepsOn(['dc']).includes('templates') && setupStepsOn(['design']).includes('templates'));
check('dashboards off = the rest', JSON.stringify(dashboardsOff(['hse'])) === JSON.stringify(MODULE_IDS.filter((x) => x !== 'hse')));

/* ------------------------------------------------------------- through HTTP */

const db = new DatabaseSync(':memory:');
db.exec(readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));
function stmt(sql) {
  const st = db.prepare(sql); let args = [];
  const api = {
    bind(...a) { args = a; return api; },
    async all() { return { results: st.all(...args), success: true }; },
    async first(col) { const r = st.get(...args) ?? null; return col && r ? r[col] : r; },
    async run() { st.run(...args); return { success: true, meta: {} }; },
    async raw() { return st.all(...args).map((r) => Object.values(r)); },
  };
  return api;
}
const env = {
  DB: { prepare: stmt,
    async batch(list) { const out = []; for (const s of list) out.push(await s.run()); return out; },
    async exec(sql) { db.exec(sql); return { count: 1 }; } },
  OWNER_CODE: 'MASTERCODE-0123456789', LOGIN_TEST_CODE: '246810', AUTH_SECRET: 'x'.repeat(40),
};
const worker = (await import('../src/index.js')).default;
const ctx = { waitUntil() {}, passThroughOnException() {} };
let cookie = '';
async function call(path, opts = {}) {
  const headers = Object.assign({}, opts.headers || {});
  if (cookie) headers.Cookie = cookie;
  if (opts.body) headers['Content-Type'] = 'application/json';
  const res = await worker.fetch(new Request('http://localhost' + path, { method: opts.method || 'GET', headers, body: opts.body }), env, ctx);
  const sc = res.headers.get('set-cookie');
  if (sc) cookie = sc.split(',').map((c) => c.split(';')[0].trim()).join('; ');
  const text = await res.text();
  let json = null; try { json = JSON.parse(text); } catch (e) {}
  return { status: res.status, text, json, headers: res.headers };
}
const post = (path, body) => call(path, { method: 'POST', body: JSON.stringify(body) });

let r = await post('/api/login', { code: 'MASTERCODE-0123456789' });
check('AETRAA Admin signs in', r.status === 200, r.text.slice(0, 120));
const admin = cookie;

r = await call('/api/setup/modules');
check('catalogue served to the Admin', r.json && r.json.modules && r.json.modules.length === 11 && r.json.core.length === 1);

// A project with only HSE and Commercial.
r = await post('/api/setup/onboard', {
  company: { name: 'NAF Contracting LLC', country: 'AE' },
  project: { name: 'Tower A', currency: 'AED', modules: ['hse', 'commercial', 'bogus'] },
  principal: { name: 'M. Al Nuaimi', email: 'principal@naf.ae' },
});
check('onboard with modules', r.json && r.json.ok === true, r.text.slice(0, 200));
const A = r.json && r.json.project_id;
check('modules returned, unknown dropped', r.json && JSON.stringify(r.json.modules) === '["hse","commercial"]', JSON.stringify(r.json && r.json.modules));

r = await call('/api/setup/modules?project=' + A);
check('project modules read back', r.json && JSON.stringify(r.json.enabled) === '["hse","commercial"]');
check('setup steps for it: BOQ yes, BOM no', r.json && r.json.setup_steps.includes('boq') && !r.json.setup_steps.includes('bom'));

// A second project under the same company, with no list sent: everything (as before).
r = await post('/api/setup/onboard', { company_id: r.json && (await call('/api/setup/companies')).json.companies[0].id,
  project: { name: 'Tower B' } });
const B = r.json && r.json.project_id;
check('second project without a list', !!B && r.json.ok, r.text.slice(0, 160));
r = await call('/api/setup/modules?project=' + B);
check('no list sent = every module', r.json && r.json.enabled.length === 11);

// People: a PM on both, an HSE officer on A, a QA/QC engineer on A.
for (const p of [
  { name: 'A. Haddad', email: 'pm@naf.ae', functions: ['pm'], projects: [A, B] },
  { name: 'S. Farouk', email: 'hse@naf.ae', functions: ['hse'], projects: [A] },
  { name: 'Q. Rahman', email: 'qa@naf.ae', functions: ['qaqc'], projects: [A, B] },
]) {
  r = await post('/api/person', p);
  check('Admin adds ' + p.email, r.status === 200 && !(r.json && r.json.error), r.text.slice(0, 160));
}

// Admin loads a BOQ into A (commercial is on).
r = await post('/api/boq/import', { project_id: A, rows: [{ section: 'Structure', ref: 'C1', qty: 1, rate: 1000 }] });
check('BOQ loads into A', r.json && r.json.ok === true, r.text.slice(0, 160));

// ---- the PM on project A
cookie = '';
r = await post('/api/signin/code', { email: 'pm@naf.ae', code: '246810' });
check('PM signs in', r.json && r.json.ok === true, r.text.slice(0, 160));
await call('/api/project?p=' + A);

r = await call('/api/boq?p=' + A);
check('A: commercial on → BOQ opens', r.status === 200, 'status=' + r.status + ' ' + r.text.slice(0, 120));
r = await call('/api/hse/log?p=' + A);
check('A: HSE on → HSE log opens', r.status !== 403, 'status=' + r.status);
r = await call('/api/bom?p=' + A);
check('A: procurement OFF → BOM refused', r.status === 403 && /Procurement/.test(r.json && r.json.error), r.text.slice(0, 160));
r = await call('/api/drawings?p=' + A);
check('A: drawings OFF → register refused', r.status === 403, 'status=' + r.status);
r = await call('/api/diary/list?p=' + A);
check('A: site diary OFF → refused', r.status === 403, 'status=' + r.status);
r = await call('/api/data?p=' + A);
check('A: the core still opens', r.status === 200, 'status=' + r.status);

r = await post('/api/records?p=' + A, { type: 'ncr', title: 'Honeycombing at C3' });
check('A: NCR refused (QA/QC off)', r.status === 403, 'status=' + r.status + ' ' + r.text.slice(0, 120));
r = await post('/api/records?p=' + A, { type: 'variation', title: 'Extra slab' });
check('A: variation allowed (commercial on)', r.status !== 403, 'status=' + r.status + ' ' + r.text.slice(0, 120));

r = await call('/?p=' + A);
const me = JSON.parse((r.text.match(/window\.__ME__ = (\{[\s\S]*?\});<\/script>/) || [])[1] || '{}');
check('A: shell boots with the modules', JSON.stringify(me.modules) === '["hse","commercial"]', JSON.stringify(me.modules));
check('A: shell told to hide QA/QC and Drawings', (me.dashOff || []).includes('qaqc') && (me.dashOff || []).includes('dc'));
check('A: PM may not raise an NCR on screen', !(me.mayRaise || []).includes('ncr'));
check('A: PM may raise a variation on screen', (me.mayRaise || []).includes('variation'));

// ---- the same PM on project B (everything on)
await call('/api/project?p=' + B);
r = await call('/api/bom?p=' + B);
check('B: BOM opens (all modules)', r.status !== 403, 'status=' + r.status);
r = await post('/api/records?p=' + B, { type: 'ncr', title: 'Cube failure' });
check('B: NCR allowed', r.status !== 403, 'status=' + r.status);
const pmCookie = cookie;

// ---- QA/QC engineer on A has nothing to open there
cookie = '';
await post('/api/signin/code', { email: 'qa@naf.ae', code: '246810' });
await call('/api/project?p=' + A);
r = await call('/?p=' + A);
const qa = JSON.parse((r.text.match(/window\.__ME__ = (\{[\s\S]*?\});<\/script>/) || [])[1] || '{}');
check('QA/QC on A: shell knows QA/QC is off', (qa.dashOff || []).includes('qaqc'));
check('QA/QC on A: the not-switched-on screen is in the page', /Not switched on for this project/.test(r.text));

// ---- switch QA/QC on for A, then off again: the NCR raised on B is untouched,
//      and one raised on A survives the round trip.
cookie = admin;
r = await post('/api/setup/modules', { project_id: A, modules: ['hse', 'commercial', 'qaqc'] });
check('Admin switches QA/QC on for A', r.json && r.json.ok && r.json.modules.includes('qaqc'), r.text.slice(0, 160));
cookie = pmCookie;
await call('/api/project?p=' + A);
r = await post('/api/records?p=' + A, { type: 'ncr', title: 'Honeycombing at C3' });
check('A: NCR now allowed', r.status !== 403, 'status=' + r.status + ' ' + r.text.slice(0, 120));
const ncrs = () => db.prepare("SELECT COUNT(*) AS n FROM records WHERE project_id = ? AND type = 'ncr'").get(A).n;
const before = ncrs();
check('A: the NCR is stored', before === 1, String(before));
cookie = admin;
await post('/api/setup/modules', { project_id: A, modules: ['hse', 'commercial'] });
check('switching QA/QC off deletes nothing', ncrs() === before);
cookie = pmCookie;
r = await call('/api/records?p=' + A + '&type=ncr');
check('…but the NCR is not handed out while it is off', r.status === 403 || !(r.json && r.json.records && r.json.records.length),
  'status=' + r.status + ' ' + r.text.slice(0, 120));
cookie = admin;
await post('/api/setup/modules', { project_id: A, modules: ['hse', 'commercial', 'qaqc'] });
check('switched back on: the NCR is still there', ncrs() === before);

// ---- guards
r = await post('/api/setup/modules', { project_id: 'nope', modules: ['hse'] });
check('unknown project refused', r.status === 400);
r = await post('/api/setup/modules', { project_id: A, modules: 'hse' });
check('a non-list refused', r.status === 400);
cookie = pmCookie;
r = await post('/api/setup/modules', { project_id: A, modules: MODULE_IDS });
check('a PM cannot change modules', r.status === 401 || r.status === 403, 'status=' + r.status);
r = await call('/api/setup/modules');
check('a PM cannot read the setup catalogue', r.status === 401 || r.status === 403, 'status=' + r.status);

// ---- security headers ride on everything
check('HSTS on every response', !!r.headers.get('strict-transport-security'));
r = await call('/');
check('CSP on pages', /frame-ancestors 'self'/.test(r.headers.get('content-security-policy') || ''));

console.log('\n' + checks + ' checks, ' + fails + ' failures');
process.exit(fails ? 1 : 0);
