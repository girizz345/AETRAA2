// A TEST PLATFORM YOU CAN CLICK THROUGH AS EVERY ROLE.
//
//   node sandbox.mjs            start it (first time: builds the test project)
//   node sandbox.mjs --fresh    throw the test data away and build it again
//   node sandbox.mjs --release ../work/<candidate>.tgz   run a candidate release instead
//
// Runs the newest release from ../releases on http://127.0.0.1:8790, on its
// own database in prelaunch/sandbox-data/ — never your real local-data, never
// the live site. Email is off: nobody is ever sent anything.
//
// It builds one test company and project with a test person in every seat.
// Their addresses are at uat.example, a domain reserved for testing that can
// never receive mail. Each person has a sign-in code, printed on the card below
// and saved in sandbox-data/CARD.txt. Open two browser windows (one normal, one
// private) to be two people at once: the site engineer in one, the PM in the
// other.
//
// Restarting keeps everything: the release's own local.mjs re-runs schema.sql
// on every start, which deletes projects and people (reported as A6), so this
// starts a copy of it that only builds the schema on an empty database.

import { spawn, execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PLATFORM = resolve(HERE, '..');
const PORT = Number(process.env.PORT || 8790);
const BASE = 'http://127.0.0.1:' + PORT;
const DATA = join(HERE, 'sandbox-data');
const APP = join(DATA, 'app');
const DOMAIN = 'uat.example';

if (process.argv.includes('--fresh')) rmSync(DATA, { recursive: true, force: true });
mkdirSync(DATA, { recursive: true });

// ---- the release, unpacked once (or again when a newer one appears)
const rels = readdirSync(join(PLATFORM, 'releases')).filter((f) => /^aetraa-release-\d{8}-\d{4}\.tgz$/.test(f)).sort();
// --release <file.tgz> runs a candidate instead of the newest in releases/.
const relArg = process.argv.includes('--release') ? resolve(process.argv[process.argv.indexOf('--release') + 1]) : null;
const release = relArg || rels[rels.length - 1];
const stampFile = join(DATA, 'release.txt');
if (!existsSync(stampFile) || readFileSync(stampFile, 'utf8').trim() !== release) {
  rmSync(APP, { recursive: true, force: true });
  mkdirSync(APP, { recursive: true });
  execFileSync('tar', ['xzf', relArg || join(PLATFORM, 'releases', release), '-C', APP]);
  execFileSync('npm', ['install', '--omit=dev', '--no-audit', '--no-fund', '--silent'], { cwd: APP, stdio: 'ignore' });
  writeFileSync(stampFile, release);
}
const line = "db.exec(readFileSync(join(HERE, 'schema.sql'), 'utf8'));";
const local = readFileSync(join(APP, 'local.mjs'), 'utf8');
writeFileSync(join(APP, 'local-keep.mjs'), local.includes(line) ? local.replace(line, 'if (fresh) ' + line) : local);

// ---- start it
const child = spawn(process.execPath, ['local-keep.mjs'], {
  cwd: APP, stdio: ['ignore', 'pipe', 'pipe'],
  env: { ...process.env, PORT: String(PORT), AETRAA_LOCAL_DIR: join(DATA, 'db'),
    ACS_CONNECTION_STRING: '', RESEND_KEY: '', ANTHROPIC_API_KEY: '' },
});
let started = false;
child.stderr.on('data', (d) => { if (!/ExperimentalWarning|experimental feature|--trace-warnings/.test(String(d))) process.stderr.write(d); });
child.stdout.on('data', (d) => { if (/owner code/.test(String(d))) started = true; if (process.env.SANDBOX_VERBOSE) process.stdout.write(d); });
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { child.kill('SIGTERM'); setTimeout(() => process.exit(0), 300); });
child.on('exit', (c) => { if (!started) console.error('the platform did not start (exit ' + c + ')'); process.exit(c || 0); });
for (let i = 0; i < 100 && !started; i++) await new Promise((r) => setTimeout(r, 100));
const OWNER = JSON.parse(readFileSync(join(DATA, 'db', 'local.json'), 'utf8')).OWNER_CODE;

// ---- a cookie-jar client
let cookie = '';
const api = {
  async req(method, path, body) {
    const r = await fetch(BASE + path, { method, redirect: 'manual',
      headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body) });
    for (const c of r.headers.getSetCookie()) {
      const f = c.split(';')[0], n = f.split('=')[0];
      cookie = cookie.split('; ').filter((x) => x && x.split('=')[0] !== n).concat(f).join('; ');
    }
    const t = await r.text(); let o; try { o = JSON.parse(t); } catch (e) { o = { _text: t.slice(0, 200) }; }
    o._status = r.status; return o;
  },
  get(p) { return api.req('GET', p); }, post(p, b) { return api.req('POST', p, b || {}); },
};
const must = (what, r) => { if (!r || r.error || r._status >= 400) throw new Error(what + ': ' + JSON.stringify(r).slice(0, 200)); return r; };

// Seats: [label, local part, functions, trade groups]
export const SEATS = [
  ['Principal',              'principal',  ['principal'],  []],
  ['Project Manager',        'pm',         ['pm'],         []],
  ['Planning Engineer',      'planning',   ['planning'],   []],
  ['Site Engineer — Civil',  'site.civil', ['site'],       ['Civil']],
  ['Site Engineer — MEP',    'site.mep',   ['site'],       ['MEP']],
  ['Design Manager',         'design',     ['design'],     []],
  ['Document Controller',    'dc',         ['dc'],         []],
  ['QA/QC Engineer',         'qaqc',       ['qaqc'],       []],
  ['HSE Officer',            'hse',        ['hse'],        []],
  ['Quantity Surveyor',      'qs',         ['commercial', 'procurement', 'finance'], []],
  ['Consultant (read-only)', 'consultant', ['consultant'], []],
];
const email = (part) => 'uat.' + part + '@' + DOMAIN;

const cardFile = join(DATA, 'CARD.txt');
if (!existsSync(cardFile)) {
  console.log('Building the test project (first start)…');
  must('owner sign-in', await api.post('/api/login', { code: OWNER }));
  const on = must('onboarding', await api.post('/api/setup/onboard', {
    company: { name: 'UAT Test Contracting LLC', plan: 'demo', email_domains: [DOMAIN] },
    project: { name: 'UAT Test Tower', location: 'Dubai, UAE', ref: 'UAT-001', currency: 'AED',
      retention_pct: 10, retention_limit_pct: 5, payment_days: 56, contract_completion: '2027-06-30',
      engineer_name: 'UAT Consulting Engineer', contractor_name: 'UAT Test Contracting LLC', client_name: 'UAT Client' },
    principal: { name: 'UAT Principal', email: email('principal') },
  }));
  const PID = on.project_id, OID = on.company_id;
  for (const [label, part, functions, groups] of SEATS) {
    if (part === 'principal') continue;
    must('adding ' + label, await api.post('/api/person', { org: OID, name: 'UAT ' + label, email: email(part), functions, groups, projects: [PID] }));
  }
  // A programme that is mid-way, so there is something to report against.
  const day = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
  const acts = [
    ['A100', 'Excavation & shoring', 'Substructure', -120, -60, 'Civil', 100],
    ['A110', 'Raft foundation', 'Substructure', -60, -20, 'Civil', 150],
    ['A120', 'Basement slab & columns', 'Substructure', -25, 10, 'Civil', 140],
    ['A130', 'Ground floor slab', 'Superstructure', 5, 35, 'Civil', 120],
    ['A140', 'Typical floors L1–L4', 'Superstructure', 30, 120, 'Civil', 300],
    ['A200', 'Underground MEP services', 'MEP', -50, -10, 'MEP', 80],
    ['A210', 'MEP 1st fix — basement', 'MEP', -15, 30, 'MEP', 120],
    ['A220', 'LV room & switchgear', 'MEP', 20, 70, 'MEP', 90],
    ['A300', 'Blockwork — basement', 'Architecture', -10, 40, 'Architecture', 100],
    ['A310', 'Facade mock-up & approval', 'Facade', 0, 45, 'Architecture', 60],
  ];
  const csv = ['ID,Activity,WBS,Planned Start,Planned Finish,Trade Group,Weight']
    .concat(acts.map((a) => [a[0], a[1], a[2], day(a[3]), day(a[4]), a[5], a[6]].join(','))).join('\n');
  must('programme', await api.post('/api/import?p=' + PID, { replace: true, text: csv }));
  must('BOQ', await api.post('/api/boq/import', { project_id: PID, rows: [
    { ref: 'A', section: 'Preliminaries', description: 'Site set-up, staff, plant', amount: 2500000 },
    { ref: 'B', section: 'Substructure', description: 'Shoring, excavation, raft, basement', amount: 9800000 },
    { ref: 'C', section: 'Superstructure', description: 'RC frame', amount: 12600000 },
    { ref: 'D', section: 'MEP', description: 'Mechanical, electrical, plumbing', amount: 11200000 },
    { ref: 'E', section: 'Architecture', description: 'Blockwork, finishes, facade', amount: 8900000 },
  ] }));
  must('BOM', await api.post('/api/bom/import', { project_id: PID, rows: [
    { material: 'C40/20 ready-mix concrete', unit: 'm3', budget_qty: 6400, rate: 245 },
    { material: 'Reinforcement T12–T32', unit: 't', budget_qty: 980, rate: 2750 },
    { material: 'Solid block 200mm', unit: 'no', budget_qty: 21000, rate: 3.1 },
  ] }));
  // Earlier progress, as the office recorded it (no photo rule for the office).
  for (const [id, pct] of [['A100', 100], ['A110', 100], ['A120', 40], ['A200', 100], ['A210', 25], ['A300', 15]]) {
    await api.post('/api/update?p=' + PID, { activity_id: id, pct });
  }
  await api.post('/api/setup/golive', { project_id: PID });

  // A code for every seat.
  const people = (await api.get('/api/people?org=' + OID)).people || [];
  const rows = [];
  for (const [label, part, functions, groups] of SEATS) {
    const u = people.find((p) => p.email === email(part));
    if (!u) continue;
    // groups goes back with it: a save without them clears the person's trade limits.
    const r = await api.post('/api/person', { org: OID, id: u.id, name: u.name, email: u.email,
      functions: u.functions || functions, groups, projects: u.projects || [PID], new_code: true });
    rows.push([label, u.email, r.code || '(none — ' + (r.error || '?') + ')']);
  }
  const card = ['AETRAA UAT SANDBOX — test people only, nobody real is ever emailed',
    'Open ' + BASE + ' and sign in with a code below.', '',
    ...rows.map(([l, e, c]) => (l + ' '.repeat(26)).slice(0, 26) + (e + ' '.repeat(34)).slice(0, 34) + c),
    '', 'AETRAA Admin (setup console ' + BASE + '/setup)   owner code: ' + OWNER,
    'Project: UAT Test Tower (' + PID + ')'].join('\n');
  writeFileSync(cardFile, card + '\n');
  writeFileSync(join(DATA, 'sandbox.json'), JSON.stringify({ base: BASE, owner: OWNER, project: PID, org: OID,
    seats: Object.fromEntries(rows.map(([l, e, c]) => [l, { email: e, code: c }])) }, null, 2));
}

console.log('\n' + readFileSync(cardFile, 'utf8'));
console.log('Running on ' + BASE + ' — Ctrl+C to stop. Everything is kept for next time.');
