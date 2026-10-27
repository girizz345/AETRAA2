// Proves the Test drive (work/test-drive): a copy is made, every role can act
// on it, the real project is never touched, and ending it — or going live —
// deletes every trace. Runs on SQLite and PostgreSQL, on 127.0.0.1 only.
//
//   node testdrive-check.mjs [--app ../work/test-drive] [--no-browser]

import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, mkdirSync, cpSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { randomBytes } from 'node:crypto';
import { createServer } from 'node:net';
import { zipSync, strToU8 } from 'fflate';

const DOCX = Buffer.from(zipSync({
  '[Content_Types].xml': strToU8('<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'),
  '_rels/.rels': strToU8('<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'),
  'word/document.xml': strToU8('<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>{{ref}} {{title}}</w:t></w:r></w:p></w:body></w:document>'),
})).toString('base64');

const HERE = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const APP_SRC = resolve(argv.includes('--app') ? argv[argv.indexOf('--app') + 1] : join(HERE, '..', 'work', 'test-drive'));
const BROWSER = !argv.includes('--no-browser');
const OUT = join(HERE, 'results', 'testdrive-' + new Date().toISOString().replace(/[:T]/g, '-').slice(0, 16));
mkdirSync(OUT, { recursive: true });

let fails = 0, passes = 0, backend = '';
const ok = (name, cond, detail) => {
  if (cond) { passes++; console.log(`  ok    [${backend}] ${name}`); }
  else { fails++; console.log(`  FAIL  [${backend}] ${name}${detail ? '  — ' + String(detail).slice(0, 300) : ''}`); }
};
const freePort = () => new Promise((r) => { const s = createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function client(base) {
  let cookie = '';
  const jar = (r) => { for (const c of r.headers.getSetCookie()) { const f = c.split(';')[0], n = f.split('=')[0];
    cookie = cookie.split('; ').filter((x) => x && x.split('=')[0] !== n).concat(/=$/.test(f) ? [] : [f]).join('; '); } };
  const api = {
    reset() { cookie = ''; }, cookie: () => cookie,
    async raw(method, path, body) {
      if (new URL(base).hostname !== '127.0.0.1') throw new Error('local only');
      const r = await fetch(base + path, { method, redirect: 'manual',
        headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
        body: body === undefined ? undefined : JSON.stringify(body) });
      jar(r); return r;
    },
    async req(method, path, body) {
      const r = await api.raw(method, path, body);
      const t = await r.text(); let o; try { o = JSON.parse(t); } catch (e) { o = { _text: t.slice(0, 200) }; }
      if (o && typeof o === 'object') o._status = r.status; return o;
    },
    get: (p) => api.req('GET', p), post: (p, b) => api.req('POST', p, b || {}),
  };
  return api;
}

async function boot(kind, work) {
  const port = await freePort();
  // server.js finds schema.sql through a URL path, which breaks on a folder with
  // a space in its name ("AETRAA Platform"), so the app runs from a copy.
  const APP = join(work, 'app');
  cpSync(APP_SRC, APP, { recursive: true, filter: (f) => !/\/\.git(\/|$)|\/local-data(\/|$)/.test(f) });
  if (kind === 'sqlite') {
    const data = join(work, 'sq');
    const child = spawn(process.execPath, ['local.mjs'], { cwd: APP, stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, PORT: String(port), AETRAA_LOCAL_DIR: data, ACS_CONNECTION_STRING: '', RESEND_KEY: '' } });
    const logs = []; child.stdout.on('data', (d) => logs.push(String(d))); child.stderr.on('data', (d) => logs.push(String(d)));
    for (let i = 0; i < 100 && !logs.join('').includes('owner code'); i++) await sleep(100);
    const owner = JSON.parse(readFileSync(join(data, 'local.json'), 'utf8')).OWNER_CODE;
    return { base: 'http://127.0.0.1:' + port, owner, logs, stop: async () => { child.kill(); await sleep(300); } };
  }
  const { PGlite } = await import('@electric-sql/pglite');
  const { PGLiteSocketServer } = await import('@electric-sql/pglite-socket');
  const pg = await PGlite.create(); const pgPort = await freePort();
  const srv = new PGLiteSocketServer({ db: pg, port: pgPort, host: '127.0.0.1' }); await srv.start();
  const owner = 'owner-' + randomBytes(12).toString('hex');
  const child = spawn(process.execPath, ['server.js'], { cwd: APP, stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, PORT: String(port), DATABASE_URL: `postgres://postgres:postgres@127.0.0.1:${pgPort}/postgres`,
      DB_SSL: 'off', DB_POOL_MAX: '1', AUTH_SECRET: randomBytes(32).toString('hex'), OWNER_CODE: owner, ACS_CONNECTION_STRING: '', RESEND_KEY: '' } });
  const logs = []; child.stdout.on('data', (d) => logs.push(String(d))); child.stderr.on('data', (d) => logs.push(String(d)));
  for (let i = 0; i < 200 && !logs.join('').includes('listening on'); i++) await sleep(100);
  return { base: 'http://127.0.0.1:' + port, owner, logs,
    stop: async () => { child.kill(); await sleep(500); try { await srv.stop(); await pg.close(); } catch (e) {} } };
}

async function counts(owner, pid) {
  const recs = (await owner.get('/api/records?p=' + pid)).records || [];
  const st = await owner.get('/api/programme/status?p=' + pid);
  const ipc = (await owner.get('/api/ipc?p=' + pid)).certificates || [];
  return { records: recs.length, refs: recs.map((r) => r.ref).sort().join(','), activities: st.activities, ipc: ipc.length };
}

const KINDS = argv.includes('--backend') ? [argv[argv.indexOf('--backend') + 1]] : ['sqlite', 'postgres'];
for (const kind of KINDS) {
  backend = kind;
  console.log('\n=== ' + kind + ' ===');
  const work = mkdtempSync(join(tmpdir(), 'aetraa-td-'));
  const srv = await boot(kind, work);
  try {
    const owner = client(srv.base);
    ok('owner signs in', (await owner.post('/api/login', { code: srv.owner })).ok);
    const { seedDemo } = await import(pathToFileURL(join(APP_SRC, 'tools', 'demo-seed.mjs')).href);
    const seeded = await seedDemo(client(srv.base), () => {}, srv.owner);
    const PID = seeded.PID;
    // The demo seed takes the project live; the test drive is a pre-go-live step.
    await owner.post('/api/login', { code: srv.owner });
    const before = await counts(owner, PID);
    ok('demo project built', before.records > 10, JSON.stringify(before));

    const tup = await owner.post('/api/setup/template', { project_id: PID, doc_type: 'rfi', filename: 'RFI.docx', file_b64: DOCX });
    ok('a consultant template on the real project', !tup.error, JSON.stringify(tup));
    const rfiRef = ((await owner.get('/api/records?p=' + PID)).records || []).find((x) => x.type === 'rfi').ref;
    const st0 = await owner.get('/api/testdrive?project=' + PID);
    ok('no test drive at first', st0.running === false, JSON.stringify(st0));
    const st = await owner.post('/api/testdrive/start', { project_id: PID });
    ok('start makes a copy with test people', st.ok && st.personas && st.personas.length >= 8 && st.rows_copied > 50,
      JSON.stringify(st).slice(0, 300));
    const TID = st.test_id;
    const roles = Object.fromEntries((st.personas || []).map((x) => [x.role, x]));

    const home = await owner.get('/api/admin-home');
    ok('the copy is hidden from the admin project list', !JSON.stringify(home).includes(TID));

    // Acting as the PM on the copy.
    let r = await owner.post('/api/testdrive/as', { project_id: PID, role: 'pm' });
    ok('switch to the test PM', r.ok, JSON.stringify(r));
    const me = await owner.get('/api/projects');
    ok('signed in as the test PM, on the copy only', me.me && /TEST/.test(me.me.name) && me.current === TID &&
      (me.projects || []).every((x) => x.id === TID), JSON.stringify(me).slice(0, 300));
    const copyCounts = await counts(owner, TID);
    ok('the copy holds the same registers and programme', copyCounts.refs === before.refs && copyCounts.activities === before.activities,
      JSON.stringify({ before, copyCounts }).slice(0, 300));
    const letter = await owner.post('/api/records', { type: 'letter', title: 'TEST letter', data: { Subject: 'TEST letter', Type: 'Notice', To: 'Consultant', Body: 'test' } });
    ok('PM prepares a letter on the copy', !!letter.ref, JSON.stringify(letter));
    const adv = await owner.post('/api/record/advance', { ref: letter.ref, action: 'advance' });
    ok('PM signs it', !adv.error, JSON.stringify(adv));

    // Document Control issues it.
    r = await owner.post('/api/testdrive/as', { project_id: PID, role: 'dc' });
    ok('switch to the test Document Controller', r.ok, JSON.stringify(r));
    const rec = (await owner.get('/api/record?ref=' + encodeURIComponent(letter.ref))).record || {};
    const adv2 = await owner.post('/api/record/advance', { ref: letter.ref, action: 'advance' });
    const rec2 = (await owner.get('/api/record?ref=' + encodeURIComponent(letter.ref))).record || {};
    ok('DC moves the PM\'s letter on', !adv2.error && rec2.status !== rec.status, (adv2.error || '') + ' ' + rec.status + ' → ' + rec2.status);

    // Every role's dashboard opens on the copy.
    const bad = [];
    for (const role of Object.keys(roles)) {
      await owner.post('/api/testdrive/as', { project_id: PID, role });
      const page = await owner.raw('GET', '/');
      const t = await page.text();
      if (page.status !== 200 || !/TEST —/.test(t)) bad.push(role + ' ' + page.status);
      const att = await owner.get('/api/attention');
      if (att._status !== 200) bad.push(role + ' attention ' + att._status);
    }
    ok('every role\'s dashboard opens on the copy', !bad.length, bad.join(', '));

    // A setup screen hands the Admin their own session back.
    await owner.post('/api/testdrive/as', { project_id: PID, role: 'pm' });
    const h = await owner.raw('GET', '/handover?p=' + PID);
    ok('opening a setup screen restores the Admin', h.status === 302 && /smsess=/.test(h.headers.get('set-cookie') || ''), h.status);
    const back = await owner.get('/api/admin-home');
    ok('…and the Admin can use the setup console again', back._status === 200, back._status);

    // The real project has not moved.
    const during = await counts(owner, PID);
    ok('the real project is untouched while the test runs', JSON.stringify(during) === JSON.stringify(before),
      JSON.stringify({ before, during }).slice(0, 300));
    const audit = await owner.get('/api/audit?project=' + PID);
    ok('the test\'s actions are not in the real project\'s audit trail', !JSON.stringify(audit).includes('TEST letter'));

    const del = await owner.post('/api/setup/template', { project_id: TID, remove: true, doc_type: 'rfi' });
    ok('the template can be deleted on the copy', !del.error, JSON.stringify(del));
    const still = await owner.raw('GET', '/api/record/doc?p=' + PID + '&ref=' + encodeURIComponent(rfiRef));
    ok('…and the real project still has its template file', still.status === 200 && /wordprocessingml/.test(still.headers.get('content-type') || ''), still.status);
    const realPeople = (await owner.get('/api/people?org=' + seeded.OID)).people || [];
    ok('test people are not in the real team list', realPeople.length > 5 && !realPeople.some((p) => /test-drive\.invalid/.test(p.email || '')));
    // End: everything goes.
    await owner.post('/api/testdrive/as', { project_id: PID, role: 'pm' });
    const tp = (await owner.get('/api/people')).people || [];
    ok('inside the test, the team is the test people', tp.length >= 8 && tp.every((p) => /test-drive\.invalid/.test(p.email || '')), tp.length);
    const personaCookie = owner.cookie().split('; ').find((c) => c.startsWith('smsess='));
    const end = await owner.post('/api/testdrive/end', { project_id: PID });
    ok('end deletes the copy', end.ok && end.removed > 50 && end.people === st.personas.length, JSON.stringify(end));
    const after = await counts(owner, PID);
    ok('the real project is exactly as before', JSON.stringify(after) === JSON.stringify(before), JSON.stringify({ before, after }).slice(0, 300));
    const gone = await owner.get('/api/project?p=' + TID);
    ok('the copy no longer exists', gone._status === 404, JSON.stringify(gone).slice(0, 200));
    const ghost = await fetch(srv.base + '/api/projects', { headers: { Cookie: personaCookie } });
    ok('the test people are deleted (their sign-in no longer works)', ghost.status === 401, ghost.status);
    const st2 = await owner.get('/api/testdrive?project=' + PID);
    ok('and the test drive reads as not running', st2.running === false);

    // Go-live deletes a running test too (needs a draft project).
    const on = await owner.post('/api/setup/onboard', { company: { name: 'TD Draft Co', plan: 'demo', email_domains: ['tddraft.example'] },
      project: { name: 'TD Draft Tower', ref: 'TDD-1', currency: 'AED', setup_state: 'draft' }, principal: { name: 'TD Principal', email: 'p@tddraft.example' } });
    const DPID = on.project_id;
    await owner.post('/api/import?p=' + DPID, { replace: true, text: 'ID,Activity,WBS,Planned Start,Planned Finish,Trade Group,Weight\nX1,Test,W,2026-10-01,2026-10-20,Civil,1' });
    const s3 = await owner.post('/api/testdrive/start', { project_id: DPID });
    ok('a draft project can be test-driven', s3.ok && s3.running, JSON.stringify(s3).slice(0, 200));
    // Sign every dashboard off so go-live is allowed, then go live.
    const hv = await owner.get('/api/handover?project=' + DPID);
    for (const row of hv.rows || []) await owner.post('/api/handover', { action: 'sign', project_id: DPID, dash: row.dash, as: row.as });
    const live = await owner.post('/api/setup/golive', { project_id: DPID });
    const s4 = await owner.get('/api/testdrive?project=' + DPID);
    const left = await owner.get('/api/project?p=' + DPID + '--test');
    ok('go-live deletes the test copy', live.ok && !live.already && s4.running === false && left._status === 404,
      JSON.stringify({ live, s4 }).slice(0, 300));

    // In a real browser: the window, the tabs, the app inside them.
    if (BROWSER) {
      const { chromium } = await import('playwright-core');
      const b = await chromium.launch({ channel: 'chrome', headless: true });
      const ctx = await b.newContext({ viewport: { width: 1400, height: 900 } });
      const page = await ctx.newPage();
      const errs = []; page.on('pageerror', (e) => errs.push(e.message));
      await page.goto(srv.base + '/');
      await page.locator('input[type=password]').first().fill(srv.owner);
      await page.keyboard.press('Enter'); await page.waitForTimeout(1500);
      await page.goto(srv.base + '/handover?p=' + PID); await page.waitForTimeout(1500);
      ok('the setup tabs include Test, before Handover', await page.locator('#abTabs a', { hasText: /^Test$/ }).count() === 1);
      await page.screenshot({ path: join(OUT, kind + '-1-handover.png') });
      await page.locator('#abTabs a', { hasText: /^Test$/ }).click(); await page.waitForTimeout(1200);
      ok('the Test tab opens in the setup screens', /\/testdrive/.test(page.url()) && await page.locator('#abTabs a.on', { hasText: 'Test' }).count() === 1);
      await page.getByRole('button', { name: 'Start testing' }).click();
      await page.locator('.role').first().waitFor({ timeout: 20000 });
      ok('starting lists every position down the left', await page.locator('.role').count() >= 8);
      await page.locator('.role', { hasText: 'Project Manager' }).first().click();
      await page.waitForTimeout(2500);
      const f = page.frameLocator('iframe');
      ok('picking Project Manager shows their dashboard on the test copy', await f.getByText(/TEST —/).first().count() > 0);
      await page.screenshot({ path: join(OUT, kind + '-2-pm.png') });
      await page.locator('.role', { hasText: 'Document Control' }).first().click();
      await page.waitForTimeout(2500);
      ok('picking Document Control switches the person', await f.getByText(/Document Control/).first().count() > 0);
      await page.screenshot({ path: join(OUT, kind + '-3-dc.png') });
      page.once('dialog', (d) => d.accept());
      await page.getByRole('button', { name: 'Complete test' }).click();
      await page.waitForTimeout(2500);
      ok('Complete test deletes the test data', /Test complete/.test(await page.locator('#msg').innerText()));
      await page.screenshot({ path: join(OUT, kind + '-4-complete.png') });
      const st5 = await page.evaluate(async (pidX) => (await fetch('/api/testdrive?project=' + pidX)).json(), PID);
      ok('…and nothing is left running', st5.running === false, JSON.stringify(st5).slice(0, 120));
      await page.locator('#abTabs a', { hasText: 'Handover' }).click(); await page.waitForTimeout(1500);
      ok('the other setup tabs work as the Admin again', /handover/.test(page.url()) && await page.getByText('Open the Test tab').count() > 0);
      ok('no script errors in the window', !errs.length, errs.slice(0, 2).join('; '));
      await b.close();
    }
    const serverErrs = srv.logs.join('').split('\n').filter((l) => /error/i.test(l) && !/Experimental|SQLite is an/i.test(l));
    ok('server log has no errors', !serverErrs.length, serverErrs.slice(0, 3).join(' | '));
  } catch (e) {
    ok('run completed', false, e.stack + '\n' + srv.logs.join('').slice(-1500));
  } finally {
    writeFileSync(join(OUT, kind + '-server.log'), srv.logs.join(''));
    await srv.stop();
    rmSync(work, { recursive: true, force: true });
  }
}
console.log(`\n${passes} pass, ${fails} fail — screenshots in ${OUT}`);
process.exit(fails ? 1 : 0);
