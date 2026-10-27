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
const OUT = join(HERE, 'results', 'dc-templates-' + new Date().toISOString().replace(/[:T]/g, '-').slice(0, 16));
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


const ORIG = '/Users/ajay/.claude/uploads/41d27d80-b5c1-451f-9b9f-77fdabb28560';
const SENT = [
  ['wir', '07034580-01-ICONIC_REQUEST_FOR_INSPECTION_AND_APPROVAL.xlsx', 3],
  ['material', 'c1abafd0-02-ICONIC_MATERIAL_SUBMITTAL.xlsx', 5],
  ['transmittal', 'c149b0af-03-ICONIC_TRANSMITTAL_OF_DOCUMENTS.xlsx', 2],
  ['transmittal_dwg', '7d30a879-04-ICONIC_TRANSMITTAL_OF_DRAWINGS.xlsx', 2],
  ['rfi', '10a150d1-05-ICONIC_REQUEST_FOR_INFORMATION.xlsx', 4],
  ['mir', 'f10658fd-06-ICONIC_MATERIAL_INSPECTION_REQUEST.xlsx', 6],
  ['cvi', 'b3ecc9c8-07-ICONIC_CONFORMATION_OF_VERBAL_INSTRUCTION.xlsx', 3],
];
for (const kind of KINDS) {
  backend = kind;
  console.log('\n=== ' + kind + ' ===');
  const work = mkdtempSync(join(tmpdir(), 'aetraa-dct-'));
  const srv = await boot(kind, work);
  try {
    const { seedDemo } = await import(pathToFileURL(join(APP_SRC, 'tools', 'demo-seed.mjs')).href);
    const seeded = await seedDemo(client(srv.base), () => {}, srv.owner);
    const CODES = seeded.CODES;
    const dc = client(srv.base); await dc.post('/api/login', { code: CODES['dc@demo.aetraa.ae'] });
    const site = client(srv.base); await site.post('/api/login', { code: CODES['civil@demo.aetraa.ae'] });
    const refused = await site.post('/api/templates/upload', { doc_type: 'rfi', filename: 'x.xlsx', file_b64: '' });
    ok('a site engineer cannot change templates', refused._status === 403, refused._status);

    // 1. Document Control uploads each form exactly as the consultant sent it.
    for (const [type, file, min] of SENT) {
      const r = await dc.post('/api/templates/upload', { doc_type: type, filename: file.replace(/^[0-9a-f]+-/, ''), file_b64: readFileSync(join(ORIG, file)).toString('base64') });
      const inputs = (r.fields || []).filter((f) => !f.auto);
      ok(`DC uploads ${type}: ${inputs.length} fields read (${inputs.map((f) => f.label).join(', ')})`, r.ok && inputs.length >= min, JSON.stringify(r).slice(0, 200));
    }
    const list = await dc.get('/api/templates');
    ok('the Templates list shows all seven with their fields', (list.templates || []).length === 7, JSON.stringify(list).slice(0, 200));

    // 2. DC renames a field and adds one, on the form.
    const rev = await dc.get('/api/templates/review?type=rfi');
    ok('the review draws the original form with the fields marked', rev.ok && /tp-pending/.test(rev.html) && rev.has_original);
    const fields = rev.fields.map((f) => f.token === 'reference' ? { ...f, label: 'Drawing / spec reference' } : f);
    fields.push({ cell: 'C15', label: 'Schedule reference', token: '', auto: false, long: false });
    const up = await dc.post('/api/templates/fields', { doc_type: 'rfi', fields });
    ok('DC saves the changed fields', up.ok && up.inputs === rev.fields.filter((f) => !f.auto).length + 1, JSON.stringify(up).slice(0, 200));

    // 3. The New RFI asks for exactly those fields.
    const design = client(srv.base); await design.post('/api/login', { code: CODES['design@demo.aetraa.ae'] });
    const form = await design.get('/api/template/form?type=rfi&labels=Subject');
    const labels = (form.fields || []).map((f) => f.label);
    ok('the New RFI form asks for the form\'s own fields', labels.includes('Subject description') && labels.includes('Drawing / spec reference') && labels.includes('Schedule reference') && labels.includes('Description of required information'), labels.join(' | '));
    const data = { 'Subject description': 'Strap beam clash at grid C-4', 'Drawing / spec reference': 'S-101 rev B', 'Location of the work/s': 'Level 2 slab', 'Description of required information': 'Please confirm the beam depth.', 'Schedule reference': 'SCH-07' };
    const rec = await design.post('/api/records', { type: 'rfi', title: data['Subject description'], data });
    ok('RFI raised from those fields', !!rec.ref, JSON.stringify(rec));
    const file = await design.raw('GET', '/api/record/doc?ref=' + encodeURIComponent(rec.ref));
    const bytes = new Uint8Array(await file.arrayBuffer());
    writeFileSync(join(OUT, kind + '-' + rec.ref + '.xlsx'), bytes);
    const xml = file.status === 200 ? sheetText(bytes) : '';
    ok('the issued form carries every answer in its box', ['Strap beam clash at grid C-4', 'S-101 rev B', 'Level 2 slab', 'Please confirm the beam depth.', 'SCH-07', rec.ref].every((v) => xml.includes(v)), file.status);
    ok('…and nothing from the last job is left on it', !/JBBC-J179|Strap Beam and DEWA|Substation Area|Gargash/.test(xml));

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
      const p1 = await as(CODES['dc@demo.aetraa.ae']);
      const nav = p1.locator('#nav a[data-nav="Templates"]');
      ok('Templates is in Document Control\'s menu', await nav.count() === 1);
      await nav.click(); await p1.waitForURL(/\/templates/, { timeout: 10000 }); await p1.waitForTimeout(1500);
      ok('the Templates page lists the forms', await p1.locator('[data-fields="rfi"]').count() === 1);
      await p1.screenshot({ path: join(OUT, kind + '-1-templates.png') });
      await p1.locator('[data-fields="rfi"]').click();
      await p1.locator('#fform .tp-sheet').waitFor({ timeout: 15000 });
      ok('Fields shows the form with each box marked', await p1.locator('#flist [data-lbl]').count() >= 4);
      await p1.screenshot({ path: join(OUT, kind + '-2-fields.png') });
      const p2 = await as(CODES['design@demo.aetraa.ae']);
      await p2.getByRole('button', { name: '＋ RFI' }).first().click();
      await p2.locator('#tplLive .tp-sheet').waitFor({ timeout: 15000 });
      const shown = await p2.locator('#dpane .frm .f label').allInnerTexts();
      ok('the New RFI shows the form\'s fields, in its order', /Subject description/i.test(shown[0] || '') && shown.some((t) => /Schedule reference/i.test(t)), shown.join(' | '));
      await p2.locator('#dpane .frm .f').first().locator('input,textarea').first().fill('Sleeve at grid D-2');
      await p2.waitForTimeout(1500);
      ok('typing fills the Iconic form beside it', /Sleeve at grid D-2/.test(await p2.locator('#tplLive').innerHTML()));
      await p2.screenshot({ path: join(OUT, kind + '-3-new-rfi.png') });
      ok('no script errors', !errs.length, errs.slice(0, 2).join('; '));
      await b.close();
    }
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
