// Proves "the template is the form" (work/test-drive) with the consultant's own
// forms: upload reads fields and signature boxes; raising shows the form filled
// as it is typed; the approver sees it before signing; the signature lands in
// its box in the issued file. SQLite and PostgreSQL, 127.0.0.1 only.
//
//   node templates-check.mjs [--forms "<folder of .xlsx forms>"] [--backend sqlite|postgres] [--no-browser]

import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, mkdirSync, cpSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { randomBytes } from 'node:crypto';
import { createServer } from 'node:net';
import { unzipSync, strFromU8 } from 'fflate';

const HERE = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const arg = (k, d) => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : d);
const APP_SRC = resolve(arg('--app', join(HERE, '..', 'work', 'test-drive')));
const FORMS = resolve(arg('--forms', join(homedir(), 'Downloads', '00 Reference', 'AETRAA templates')));
const BROWSER = !argv.includes('--no-browser');
const KINDS = argv.includes('--backend') ? [arg('--backend')] : ['sqlite', 'postgres'];
const OUT = join(HERE, 'results', 'templates-' + new Date().toISOString().replace(/[:T]/g, '-').slice(0, 16));
mkdirSync(OUT, { recursive: true });

// Which consultant form serves which document type.
const ASSIGN = [
  ['rfi', 'Request for information (RFI).xlsx'],
  ['wir', 'Request for inspection and approval (RFIA).xlsx'],
  ['material', 'Material submittal.xlsx'],
  ['mir', 'Material inspection request (MIR).xlsx'],
  ['cvi', 'Confirmation of verbal instruction (CVI).xlsx'],
  ['transmittal', 'Transmittal of documents.xlsx'],
  ['transmittal_dwg', 'Transmittal of drawings.xlsx'],
];

let fails = 0, passes = 0, backend = '';
const ok = (name, cond, detail) => {
  if (cond) { passes++; console.log(`  ok    [${backend}] ${name}`); }
  else { fails++; console.log(`  FAIL  [${backend}] ${name}${detail ? '  — ' + String(detail).slice(0, 300) : ''}`); }
};
const freePort = () => new Promise((r) => { const s = createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function client(base) {
  let cookie = '';
  const api = {
    reset() { cookie = ''; }, cookie: () => cookie,
    async raw(method, path, body) {
      const r = await fetch(base + path, { method, redirect: 'manual',
        headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
        body: body === undefined ? undefined : JSON.stringify(body) });
      for (const c of r.headers.getSetCookie()) { const f = c.split(';')[0], n = f.split('=')[0];
        cookie = cookie.split('; ').filter((x) => x && x.split('=')[0] !== n).concat(/=$/.test(f) ? [] : [f]).join('; '); }
      return r;
    },
    async req(m, p, b) { const r = await api.raw(m, p, b); const t = await r.text(); let o; try { o = JSON.parse(t); } catch (e) { o = { _text: t.slice(0, 200) }; } o._status = r.status; return o; },
    get: (p) => api.req('GET', p), post: (p, b) => api.req('POST', p, b || {}),
  };
  return api;
}

async function boot(kind, work) {
  const port = await freePort();
  const APP = join(work, 'app');
  cpSync(APP_SRC, APP, { recursive: true, filter: (f) => !/\/\.git(\/|$)|\/local-data(\/|$)/.test(f) });
  const logs = [];
  if (kind === 'sqlite') {
    const data = join(work, 'sq');
    const child = spawn(process.execPath, ['local.mjs'], { cwd: APP, stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, PORT: String(port), AETRAA_LOCAL_DIR: data, ACS_CONNECTION_STRING: '', RESEND_KEY: '' } });
    child.stdout.on('data', (d) => logs.push(String(d))); child.stderr.on('data', (d) => logs.push(String(d)));
    for (let i = 0; i < 100 && !logs.join('').includes('owner code'); i++) await sleep(100);
    return { base: 'http://127.0.0.1:' + port, owner: JSON.parse(readFileSync(join(data, 'local.json'), 'utf8')).OWNER_CODE, logs,
      stop: async () => { child.kill(); await sleep(300); } };
  }
  const { PGlite } = await import('@electric-sql/pglite');
  const { PGLiteSocketServer } = await import('@electric-sql/pglite-socket');
  const pg = await PGlite.create(); const pgPort = await freePort();
  const srv = new PGLiteSocketServer({ db: pg, port: pgPort, host: '127.0.0.1' }); await srv.start();
  const owner = 'owner-' + randomBytes(12).toString('hex');
  const child = spawn(process.execPath, ['server.js'], { cwd: APP, stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, PORT: String(port), DATABASE_URL: `postgres://postgres:postgres@127.0.0.1:${pgPort}/postgres`,
      DB_SSL: 'off', DB_POOL_MAX: '1', AUTH_SECRET: randomBytes(32).toString('hex'), OWNER_CODE: owner, ACS_CONNECTION_STRING: '', RESEND_KEY: '' } });
  child.stdout.on('data', (d) => logs.push(String(d))); child.stderr.on('data', (d) => logs.push(String(d)));
  for (let i = 0; i < 200 && !logs.join('').includes('listening on'); i++) await sleep(100);
  return { base: 'http://127.0.0.1:' + port, owner, logs, stop: async () => { child.kill(); await sleep(500); try { await srv.stop(); await pg.close(); } catch (e) {} } };
}

function sheetText(bytes) {
  const z = unzipSync(new Uint8Array(bytes));
  return Object.keys(z).filter((k) => /^xl\/(sharedStrings|worksheets\/sheet\d+)\.xml$/.test(k)).map((k) => strFromU8(z[k])).join('');
}

if (!existsSync(FORMS)) { console.error('no forms folder: ' + FORMS); process.exit(1); }
for (const kind of KINDS) {
  backend = kind;
  console.log('\n=== ' + kind + ' ===');
  const work = mkdtempSync(join(tmpdir(), 'aetraa-tpl-'));
  const srv = await boot(kind, work);
  try {
    const owner = client(srv.base);
    await owner.post('/api/login', { code: srv.owner });
    const { seedDemo } = await import(pathToFileURL(join(APP_SRC, 'tools', 'demo-seed.mjs')).href);
    const seeded = await seedDemo(client(srv.base), () => {}, srv.owner);
    const PID = seeded.PID, CODES = seeded.CODES;
    await owner.post('/api/login', { code: srv.owner });

    // 1. Assigning the forms: fields and signature boxes are read at once.
    for (const [type, file] of ASSIGN) {
      const b64 = readFileSync(join(FORMS, file)).toString('base64');
      const r = await owner.post('/api/setup/template', { project_id: PID, doc_type: type, filename: file, file_b64: b64 });
      ok(`${file} assigned to ${type}: ${(r.tokens || []).length} fields, ${r.sign_boxes} signature boxes read`,
        r.ok && (r.tokens || []).length > 3 && r.sign_boxes > 0, JSON.stringify(r).slice(0, 200));
    }
    const labels = ['Subject', 'Discipline', 'Question', 'Drawing ref', 'Priority', 'Reply needed by'];
    const form = await owner.get('/api/template/form?p=' + PID + '&project=' + PID + '&type=rfi&labels=' + encodeURIComponent(labels.join('|')));
    ok('the RFI form asks only for what the standard form lacks', form.has && form.extra.some((e) => /location of works/i.test(e.label))
      && !form.extra.some((e) => /^(subject|description|reference)$/i.test(e.label)), JSON.stringify(form.extra));
    ok('a first signature box is set for the PM\'s approval', form.sign_map && form.sign_map.steps && form.sign_map.steps['1'],
      JSON.stringify(form.sign_map));

    // 2. Raising an RFI, as Design: the template preview, then the record.
    const design = client(srv.base);
    await design.post('/api/login', { code: CODES['design@demo.aetraa.ae'] });
    const pv = await design.post('/api/template/preview', { type: 'rfi', title: 'Strap beam vs DEWA trench',
      data: { Subject: 'Strap beam vs DEWA trench', Question: 'Confirm which is revised: strap beam or DEWA trench.', 'Drawing ref': 'S1-01', 'Location of works': 'Substation area' } });
    ok('the preview is the consultant\'s form, filled', pv.has && /Strap beam vs DEWA trench/.test(pv.html) && /Substation area/.test(pv.html)
      && /S1-01/.test(pv.html) && /REQUEST FOR INFORMATION/.test(pv.html), (pv.error || '') + String(pv.html || '').slice(0, 120));
    ok('the raiser\'s own name is already on it', /tp-script/.test(pv.html) === false || /Design Manager/.test(pv.html));
    const rec = await design.post('/api/records', { type: 'rfi', title: 'Strap beam vs DEWA trench',
      data: { Subject: 'Strap beam vs DEWA trench', Discipline: 'Structural', Question: 'Confirm which is revised: strap beam or DEWA trench.', 'Drawing ref': 'S1-01', 'Location of works': 'Substation area' } });
    ok('RFI raised', !!rec.ref, JSON.stringify(rec));

    // 3. The PM sees it before signing, with the box marked; signs; it lands there.
    const pm = client(srv.base);
    await pm.post('/api/login', { code: CODES['pm@demo.aetraa.ae'] });
    const before = await pm.get('/api/record/preview?ref=' + encodeURIComponent(rec.ref));
    ok('the PM sees the document before signing, with their box marked', before.has && before.your_box && /Your signature goes here/.test(before.html),
      JSON.stringify({ has: before.has, your_box: before.your_box }));
    const adv = await pm.post('/api/record/advance', { ref: rec.ref, action: 'advance' });
    ok('PM signs', !adv.error, JSON.stringify(adv));
    const after = await pm.get('/api/record/preview?ref=' + encodeURIComponent(rec.ref));
    ok('the PM\'s signature now shows in the box', /tp-script">Project Manager</.test(after.html), String(after.html || '').match(/tp-sig[^]{0,200}/)?.[0]);
    const cell = form.sign_map.steps['1'];
    const file = await pm.raw('GET', '/api/record/doc?ref=' + encodeURIComponent(rec.ref));
    const bytes = new Uint8Array(await file.arrayBuffer());
    writeFileSync(join(OUT, kind + '-' + rec.ref + '.xlsx'), bytes);
    const xml = file.status === 200 ? sheetText(bytes) : '';
    ok('the issued Excel file carries the signature in cell ' + cell, new RegExp('<c r="' + cell + '"[^>]*t="inlineStr"><is><t[^>]*>Project Manager — e-signed').test(xml), file.status);
    ok('…and the typed fields, with no {{placeholder}} left', /Substation area/.test(xml) && /Strap beam/.test(xml) && !/\{\{/.test(xml));

    // 4. The Admin moves a signature box; the next document follows it.
    const moved = await owner.post('/api/setup/template-signs?p=' + PID, { project_id: PID, doc_type: 'rfi', steps: { 1: cell, 2: 'D24' } });
    ok('the Admin sets Document Control\'s box', moved.ok && moved.steps['2'] === 'D24', JSON.stringify(moved));
    const dc = client(srv.base);
    await dc.post('/api/login', { code: CODES['dc@demo.aetraa.ae'] });
    const dcv = await dc.get('/api/record/preview?ref=' + encodeURIComponent(rec.ref));
    ok('Document Control is shown their box (D24) before issuing', dcv.your_box && /Your signature goes here/.test(dcv.html), JSON.stringify({ your_box: dcv.your_box }));
    await dc.post('/api/record/advance', { ref: rec.ref, action: 'advance' });
    const f2 = await dc.raw('GET', '/api/record/doc?ref=' + encodeURIComponent(rec.ref));
    const x2 = sheetText(new Uint8Array(await f2.arrayBuffer()));
    ok('after issue the file has both signatures in their boxes', new RegExp('<c r="D24"[^>]*><is><t[^>]*>Document Controller — e-signed').test(x2)
      && new RegExp('<c r="' + cell + '"[^>]*><is><t[^>]*>Project Manager').test(x2));

    // 4b. A submittal is issued on the Transmittal of drawings; a test copy uses the real forms.
    const sub = await design.get('/api/template/form?type=submittal&labels=Title');
    ok('a Submittal uses the Transmittal of drawings form', sub.has && /drawings/i.test(sub.filename || ''), sub.filename);
    const td = await owner.post('/api/testdrive/start', { project_id: PID });
    await owner.post('/api/testdrive/as', { project_id: PID, role: 'design' });
    const inTest = await owner.get('/api/template/form?type=rfi&labels=Subject');
    ok('inside the test copy the RFI uses the project\'s form', td.ok && inTest.has === true, JSON.stringify(inTest).slice(0, 120));
    await owner.post('/api/testdrive/end', { project_id: PID });
    await owner.post('/api/login', { code: srv.owner });

    // 5. A type with no template keeps the plain form.
    const none = await design.get('/api/template/form?type=letter');
    ok('a document type with no template is unchanged', none.has === false);

    // 6. In a browser: the form with the template beside it; the preview before signing; the box picker.
    if (BROWSER) {
      const { chromium } = await import('playwright-core');
      const b = await chromium.launch({ channel: 'chrome', headless: true });
      const errs = [];
      const as = async (code) => {
        const ctx = await b.newContext({ viewport: { width: 1500, height: 950 } });
        const page = await ctx.newPage(); page.on('pageerror', (e) => errs.push(e.message));
        await page.goto(srv.base + '/'); await page.locator('input[type=password]').first().fill(code);
        await page.keyboard.press('Enter'); await page.waitForTimeout(2000); return page;
      };
      const p1 = await as(CODES['design@demo.aetraa.ae']);
      await p1.getByRole('button', { name: '＋ RFI' }).first().click();
      await p1.locator('#tplLive .tp-sheet').waitFor({ timeout: 15000 });
      ok('the New RFI form shows the consultant\'s form beside it', await p1.locator('.tpl-split').count() === 1);
      ok('the form\'s button says Generate, not "route for approval"', (await p1.locator('[data-gen]').first().innerText()).trim() === 'Generate');
      ok('the three steps show across the top, step 1 current', /1\. Fill in/.test(await p1.locator('.tpl-steps').first().innerText()));
      ok('…asking for the form\'s own fields', /Subject description/i.test((await p1.locator('#dpane .frm .f label').allInnerTexts()).join('|')));
      await p1.locator('.frm .f').first().locator('input,textarea').first().fill('Sleeve size at grid C-4');
      await p1.waitForTimeout(1500);
      ok('typing appears on the form', /Sleeve size at grid C-4/.test(await p1.locator('#tplLive').innerHTML()));
      await p1.screenshot({ path: join(OUT, kind + '-1-new-rfi.png') });
      // Check before it is raised: Generate shows the document; Edit goes back; Submit raises it.
      await p1.locator('.frm .f textarea').first().fill('Please confirm the sleeve diameter for the 150mm CHW pipe.');
      const rfisBefore = ((await owner.get('/api/records?p=' + PID)).records || []).filter((x) => x.type === 'rfi').length;
      await p1.locator('[data-gen]').first().click();
      await p1.locator('#tplCheck .tp-sheet').waitFor({ timeout: 15000 }).catch(() => {});
      ok('the check offers Edit and Confirm & submit for approval', /Confirm & submit for approval/.test(await p1.locator('#tplSubmit').innerText()));
      ok('Generate shows the filled form to check, full size', await p1.locator('#tplReview').isVisible() && await p1.locator('#tplCheck .tp-sheet').count() === 1);
      ok('…and nothing is raised yet', ((await owner.get('/api/records?p=' + PID)).records || []).filter((x) => x.type === 'rfi').length === rfisBefore);
      await p1.screenshot({ path: join(OUT, kind + '-1b-check-before-submit.png') });
      await p1.locator('#tplEdit').click();
      ok('Edit goes back to the form with what was typed', await p1.locator('.frm .f').first().locator('input,textarea').first().inputValue() === 'Sleeve size at grid C-4');
      await p1.locator('.frm .f').first().locator('input,textarea').first().fill('Sleeve size at grid C-5');
      await p1.locator('[data-gen]').first().click();
      await p1.locator('#tplCheck .tp-sheet').waitFor({ timeout: 15000 }).catch(() => {});
      ok('the check shows the edit', /Sleeve size at grid C-5/.test(await p1.locator('#tplCheck').innerHTML()));
      await p1.locator('#tplSubmit').click();
      await p1.waitForTimeout(2500);
      const nowRfis = ((await owner.get('/api/records?p=' + PID)).records || []).filter((x) => x.type === 'rfi');
      ok('Confirm & submit raises it, once', nowRfis.length === rfisBefore + 1 && nowRfis.some((x) => /C-5/.test(x.title)), nowRfis.length + ' vs ' + rfisBefore);
      const p2 = await as(CODES['pm@demo.aetraa.ae']);
      await p2.evaluate(async (r) => { await window.loadRecords?.(); window.openDetail(r); }, (await owner.get('/api/records?p=' + PID)).records.filter((x) => x.type === 'rfi' && x.status && /PM/.test(x.status))[0]?.ref || rec.ref);
      await p2.locator('#tplRec .tp-sheet').waitFor({ timeout: 15000 }).catch(() => {});
      ok('the PM sees the form inside the record before signing', await p2.locator('#tplRec .tp-sheet').count() === 1);
      await p2.screenshot({ path: join(OUT, kind + '-2-pm-before-signing.png') });
      const p3 = await as(srv.owner);
      await p3.goto(srv.base + '/files?p=' + PID + '&s=fig.template'); await p3.waitForTimeout(2500);
      const sb = p3.locator('[data-signs="rfi"]');
      if (await sb.count()) {
        const why = await sb.evaluate((el) => { const out = []; for (let e = el; e; e = e.parentElement) { const cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden' || e.hidden) out.push((e.id || e.className || e.tagName) + ':' + cs.display); } return out.join(' > '); });
        if (why) console.log('    hidden by: ' + why);
        await p3.screenshot({ path: join(OUT, kind + '-3a-setup.png'), fullPage: true });
        await sb.click(); await p3.locator('#sbForm .tp-sheet').waitFor({ timeout: 15000 });
        ok('Documents → templates shows the form to choose each signature box', await p3.locator('#sbSteps [data-pick]').count() >= 3);
        await p3.screenshot({ path: join(OUT, kind + '-3-signature-boxes.png') });
      } else ok('Documents → templates has a Signature boxes button for the RFI form', false, 'button not found');
      ok('no script errors', !errs.length, errs.slice(0, 2).join('; '));
      await b.close();
    }
    const se = srv.logs.join('').split('\n').filter((l) => /error/i.test(l) && !/Experimental|SQLite is an/i.test(l));
    ok('server log has no errors', !se.length, se.slice(0, 3).join(' | '));
  } catch (e) {
    ok('run completed', false, e.stack);
  } finally {
    writeFileSync(join(OUT, kind + '-server.log'), srv.logs.join(''));
    await srv.stop();
    rmSync(work, { recursive: true, force: true });
  }
}
console.log(`\n${passes} pass, ${fails} fail — ${OUT}`);
process.exit(fails ? 1 : 0);
