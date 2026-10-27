// THE HAND-OFFS, CLICKED THROUGH AS EACH PERSON WOULD.
//
//   node sandbox.mjs          (in one Terminal — leave it running)
//   node uat-flows.mjs        (in another)          add --show to watch it
//
// Signs in on the sandbox as the test people at uat.example, each in their own
// browser window, and does the work through the real screens: the site engineer
// types a percentage and presses Submit, the PM opens their dashboard and signs
// it off, Design raises an RFI from its form, the PM approves it, Document
// Control issues it and records the consultant's answer, and so on. Every step
// is checked from the next person's screen, not from the database.
//
// Only ever talks to the sandbox on 127.0.0.1. Results and a screenshot of each
// step go to results/uat-<date-time>/.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const HERE = dirname(fileURLToPath(import.meta.url));
const SB = JSON.parse(readFileSync(join(HERE, 'sandbox-data', 'sandbox.json'), 'utf8'));
const BASE = SB.base;
if (new URL(BASE).hostname !== '127.0.0.1') throw new Error('uat-flows only runs against the local sandbox');
const SHOW = process.argv.includes('--show');
const STAMP = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 16);
const OUT = join(HERE, 'results', 'uat-' + STAMP);
mkdirSync(OUT, { recursive: true });
const RUN = STAMP.slice(11).replace('-', ':');          // tags this run's records

const results = [];
let shotN = 0;
function rec(flow, step, status, detail) {
  results.push({ flow, step, status, detail: detail ? String(detail).slice(0, 400) : '' });
  console.log(`  ${status === 'pass' ? 'ok  ' : status === 'fail' ? 'FAIL' : 'warn'}  ${flow} — ${step}${detail && status !== 'pass' ? '  — ' + detail : ''}`);
}
const must = (c, m) => { if (!c) throw new Error(m); };

const browser = await chromium.launch({ channel: 'chrome', headless: !SHOW, slowMo: SHOW ? 250 : 0 });

// Each person in their own window, signed in through the sign-in screen.
const people = {};
async function as(seat) {
  if (people[seat]) return people[seat];
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  page.on('dialog', (d) => page._answer ? d.accept(page._answer.shift && page._answer.length ? page._answer.shift() : '') : d.accept());
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message.split('\n')[0]));
  await page.goto(BASE + '/');
  await page.locator('input[type=password]').first().fill(SB.seats[seat].code);
  await page.keyboard.press('Enter');
  await page.waitForURL((u) => !/\/$/.test(u.pathname) || true, { timeout: 10000 });
  await page.waitForTimeout(1500);
  people[seat] = { page, ctx, errors };
  return people[seat];
}
async function shot(page, name) {
  await page.screenshot({ path: join(OUT, String(++shotN).padStart(2, '0') + '-' + name.replace(/[^A-Za-z0-9]+/g, '-') + '.png') });
}
async function step(flow, name, fn) {
  try { const d = await fn(); rec(flow, name, d && d.warn ? 'warn' : 'pass', d && d.warn ? d.warn : d); return true; }
  catch (e) { rec(flow, name, 'fail', e.message.split('\n')[0]); return false; }
}
const api = async (page, path, body) => page.evaluate(async ([p, b]) => {
  const r = await fetch(p, b ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) } : {});
  return r.json();
}, [path, body || null]);
const dash = async (page) => { await page.goto(BASE + '/'); await page.waitForLoadState('load'); await page.waitForTimeout(1500); };

// On the site screen: open the trade that holds this activity.
async function openActivity(page, id) {
  await page.goto(BASE + '/site'); await page.waitForTimeout(1000);
  const who = page.locator('#who');
  if (!(await who.inputValue())) await who.fill('UAT Site Engineer');
  if (await page.locator(`.act[data-id="${id}"]`).count()) return;
  const trades = page.locator('button.trade');
  const n = await trades.count();
  for (let i = 0; i < n; i++) {
    await page.locator('button.trade').nth(i).click();
    await page.waitForTimeout(500);
    if (await page.locator(`.act[data-id="${id}"]`).count()) return;
    await page.getByRole('button', { name: 'Change' }).click();
    await page.waitForTimeout(300);
  }
  throw new Error('activity ' + id + ' is not on this engineer\'s site screen');
}

/* ===================================================================== 1 */
// Site reports progress; it appears on the PM's dashboard.
{
  const F = '1 Site progress → PM sees it';
  const site = await as('Site Engineer — Civil');
  await step(F, 'site engineer sets Ground floor slab to 50% and presses Submit', async () => {
    await openActivity(site.page, 'A130');
    await site.page.locator('.act[data-id="A130"] [data-set="50"]').click();
    await site.page.locator('#submit').click();
    await site.page.getByText(/sent to the office/i).waitFor({ timeout: 8000 });
    await shot(site.page, 'site-submitted-50');
  });
  const pm = await as('Project Manager');
  await step(F, 'PM dashboard shows A130 at 50% from the site engineer', async () => {
    await dash(pm.page);
    const txt = await pm.page.locator('body').innerText();
    must(/Ground floor slab → 50%/.test(txt), 'not in "Live from site"');
    await shot(pm.page, 'pm-sees-50');
  });
  await step(F, 'site engineer cannot report an MEP activity (outside their trade)', async () => {
    const r = await api(site.page, '/api/update', { activity_id: 'A220', pct: 10 });
    must(r.error, 'the server accepted a Civil engineer updating an MEP activity');
    const shown = await site.page.locator('.act[data-id="A220"]').count();
    return shown ? { warn: 'refused by the server, but the MEP activity is still offered on the Civil engineer\'s screen' } : 'refused';
  });
}

/* ===================================================================== 2 */
// Finished work: photo + 100% → PM signs off → site sees "Verified".
{
  const F = '2 Completion → PM sign-off';
  const site = await as('Site Engineer — Civil');
  await step(F, 'site engineer tries 100% with no photo and is stopped', async () => {
    await openActivity(site.page, 'A120');
    await site.page.locator('.act[data-id="A120"] [data-set="100"]').click();
    await site.page.locator('#submit').click();
    await site.page.getByText(/photograph/i).first().waitFor({ timeout: 8000 });
    await shot(site.page, 'site-100-needs-photo');
  });
  await step(F, 'site engineer photographs the activity and sends 100%', async () => {
    await openActivity(site.page, 'A120');
    await site.page.locator('.act[data-id="A120"] [data-cam]').click();
    await site.page.locator('#actCam').setInputFiles(join(HERE, 'sandbox-data', 'app', 'assets', 'logo-contractor.png'));
    await site.page.waitForTimeout(2500);
    await site.page.locator('.act[data-id="A120"] [data-set="100"]').click();
    await site.page.locator('#submit').click();
    await site.page.getByText(/sent to the office/i).waitFor({ timeout: 8000 });
    await shot(site.page, 'site-100-with-photo');
  });
  const pm = await as('Project Manager');
  await step(F, 'PM sees it waiting for sign-off and signs it off', async () => {
    await dash(pm.page);
    const btn = pm.page.locator('[data-signoff="A120"]');
    must(await btn.count(), 'A120 is not in "Activities finished — awaiting your sign-off"');
    await shot(pm.page, 'pm-awaiting-signoff');
    await btn.click();
    await pm.page.waitForTimeout(1500);
    must(!(await pm.page.locator('[data-signoff="A120"]').count()), 'still listed after sign-off');
  });
  await step(F, 'the "awaiting sign-off" tile agrees with the list', async () => {
    await dash(pm.page);
    const listed = await pm.page.locator('[data-signoff]').count();
    const tile = await pm.page.evaluate(() => {
      const el = [...document.querySelectorAll('*')].find((e) => /^AWAITING\s*SIGN-OFF$/i.test((e.innerText || '').trim()));
      const box = el && el.parentElement; return box ? box.innerText : '';
    });
    const n = Number((tile.match(/\d+/) || [])[0]);
    must(n === listed, `tile says ${n}, the list holds ${listed}`);
    return n + ' and ' + listed;
  });
  await step(F, 'site engineer sees "Verified by" on the activity', async () => {
    await site.page.goto(BASE + '/site'); await site.page.waitForTimeout(800);
    const done = site.page.getByRole('button', { name: 'Show done' });
    await openActivity(site.page, 'A110').catch(() => {});
    if (await done.count()) await done.click();
    await site.page.waitForTimeout(500);
    const card = site.page.locator('.act[data-id="A120"]');
    must(await card.count(), 'A120 not shown (even with Show done)');
    must(/Verified by/i.test(await card.innerText()), 'no "Verified by" on the card');
    await shot(site.page, 'site-sees-verified');
  });
}

/* ===================================================================== 3 */
// PM queries a completion back; the site engineer sees the note.
{
  const F = '3 PM queries a completion back';
  const pm = await as('Project Manager');
  const site = await as('Site Engineer — Civil');
  await step(F, 'site engineer photographs Ground floor slab and sends 100%', async () => {
    await openActivity(site.page, 'A130');
    await site.page.locator('.act[data-id="A130"] [data-cam]').click();
    await site.page.locator('#actCam').setInputFiles(join(HERE, 'sandbox-data', 'app', 'assets', 'logo-contractor.png'));
    await site.page.waitForTimeout(2500);
    await site.page.locator('.act[data-id="A130"] [data-set="100"]').click();
    await site.page.locator('#submit').click();
    await site.page.getByText(/sent to the office/i).waitFor({ timeout: 8000 });
  });
  await step(F, 'PM presses Query on it and writes why', async () => {
    await dash(pm.page);
    const q = pm.page.locator('[data-query="A130"]');
    must(await q.count(), 'A130 is not waiting for sign-off');
    pm.page._answer = ['UAT: photo does not show the top of the slab'];
    await q.click(); await pm.page.waitForTimeout(1500);
    pm.page._answer = null;
    globalThis.QID = 'A130';
    must(!(await pm.page.locator('[data-query="A130"]').count()), 'still waiting for sign-off after the query');
  });
  await step(F, 'site engineer sees "Queried by" with the PM\'s note', async () => {
    const id = globalThis.QID; must(id, 'no activity was queried');
    await openActivity(site.page, id).catch(() => {});
    const done = site.page.getByRole('button', { name: 'Show done' });
    if (!(await site.page.locator(`.act[data-id="${id}"]`).count()) && await done.count()) await done.click();
    const card = site.page.locator(`.act[data-id="${id}"]`);
    must(await card.count(), id + ' is not on the site screen');
    const t = await card.innerText();
    must(/Queried by/i.test(t) && /top of the slab/.test(t), 'note not shown: ' + t.slice(0, 120));
    await shot(site.page, 'site-sees-query');
  });
}

/* ===================================================================== 4 */
// A register record walked along its workflow, each step by its owner, on screen.
async function walk(F, ref, chain) {
  for (const [seat, expect] of chain) {
    const who = await as(seat);
    const ok = await step(F, `${seat}: opens ${ref}, presses "${expect}"`, async () => {
      await dash(who.page);
      const link = who.page.getByText(ref, { exact: false }).first();
      if (await link.count()) await link.click(); else await who.page.evaluate((r) => window.openDetail && window.openDetail(r), ref);
      await who.page.waitForTimeout(1000);
      if (!(await who.page.locator('#recBar').count())) await who.page.evaluate((r) => window.openDetail && window.openDetail(r), ref);
      await who.page.waitForTimeout(500);
      const btn = who.page.locator('#recApprove, #recReply, #recNoReply').first();
      if (!(await btn.count())) {
        const msg = await who.page.locator('#recMsg').innerText().catch(() => '(no workflow card)');
        throw new Error(`no action button for ${seat} — screen says: ${msg}`);
      }
      const label = (await btn.innerText()).trim();
      if (await who.page.locator('#recCode').count()) await who.page.locator('#recCode').selectOption({ index: 0 });
      await btn.click();
      await who.page.waitForTimeout(1800);
      // The issue step offers "Notify the team": close it if it opened.
      await who.page.keyboard.press('Escape').catch(() => {});
      const msg = await who.page.locator('#recMsg').innerText().catch(() => '');
      must(!/not part of|refused|error|could not/i.test(msg), msg);
      await shot(who.page, `${ref}-${seat}`);
      return label + ' → ' + (msg || '').slice(0, 80);
    });
    if (!ok) return false;
  }
  return true;
}
{
  const F = '4 RFI: Design → PM → DC → consultant answer';
  const design = await as('Design Manager');
  let ref = null;
  await step(F, 'Design fills the New RFI form and presses Generate & route', async () => {
    await dash(design.page);
    await design.page.getByRole('button', { name: '＋ RFI' }).click();
    await design.page.getByPlaceholder('Subject').fill('UAT ' + RUN + ': sleeve size at grid C-4');
    await design.page.locator('textarea').first().fill('Confirm sleeve diameter for 150mm CHW through basement wall.');
    await design.page.getByPlaceholder('Drawing ref').fill('ME-110');
    await design.page.getByRole('button', { name: /Generate & route/ }).click();
    const h = design.page.getByText(/RFI-\d+ created/).first();
    await h.waitFor({ timeout: 8000 });
    ref = ((await h.innerText()).match(/RFI-\d+/) || [])[0];
    await shot(design.page, 'rfi-created');
    return ref;
  });
  if (ref) {
    await walk(F, ref, [['Project Manager', 'Approve & sign'], ['Document Controller', 'Issue'], ['Document Controller', 'Record consultant reply']]);
    await step(F, 'the RFI ends closed / answered in the register', async () => {
      const r = await api((await as('Project Manager')).page, '/api/record?ref=' + ref);
      const st = (r.record || {}).status || '';
      must(/answer|closed|code|approved|noted/i.test(st), 'status is "' + st + '"');
      return st;
    });
  }
}

/* ===================================================================== 5 */
// Every other register: raised by its owner, then walked on screen to the end.
const RAISE = [
  ['Design Manager', 'submittal', 'Submittal', { Title: 'UAT paint system', Discipline: 'Architectural' }],
  ['Design Manager', 'material', 'Material approval', { Material: 'UAT rebar batch', 'Spec section': '03 21 00' }],
  ['QA/QC Engineer', 'wir', 'Inspection request (WIR)', { 'Activity / element': 'UAT basement slab', Discipline: 'Civil', 'Inspection date': new Date().toISOString().slice(0, 10) }],
  ['QA/QC Engineer', 'ncr', 'NCR', { 'Non-conformance': 'UAT honeycombing at C-4', Location: 'Basement', Severity: 'Minor', Disposition: 'Repair' }],
  ['HSE Officer', 'ptw', 'Permit to work', { 'Activity / type': 'Hot work', Location: 'Basement', 'Valid until': new Date(Date.now() + 86400000).toISOString().slice(0, 10), 'Fire watch / standby': 'Assigned', 'Precautions taken': 'Extinguisher' }],
  ['Quantity Surveyor', 'variation', 'Variation', { Description: 'UAT extra sleeves', Origin: 'Instruction', 'Estimated cost (AED)': '12,000', 'Time effect (days)': '0' }],
  ['Site Engineer — Civil', 'mr', 'Material request', { Material: 'UAT screed', Quantity: '20 m3', 'For (location)': 'Basement', 'Needed by': new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10) }],
];
for (const [seat, type, label, data] of RAISE) {
  const F = '5 ' + label + ' workflow';
  const who = await as(seat);
  const r = await api(who.page, '/api/records', { type, title: 'UAT ' + RUN + ' ' + label, data });
  if (!r.ref) { rec(F, seat + ' raises it', 'fail', JSON.stringify(r).slice(0, 200)); continue; }
  rec(F, seat + ' raises ' + r.ref, 'pass');
  // Walk it: whoever the record says is next, until it closes.
  for (let i = 0; i < 8; i++) {
    const pmPage = (await as('Project Manager')).page;
    const cur = (await api(pmPage, '/api/record?ref=' + r.ref)).record || {};
    if (!cur.next_step) { rec(F, 'reaches the end: ' + cur.status, 'pass'); break; }
    // The step's owner does it, as on a real job — not the PM, who may sign anything.
    const nextStep = (cur.workflow || []).find((w) => w.state !== 'done') || {};
    const FN_SEAT = { site: 'Site Engineer — Civil', qaqc: 'QA/QC Engineer', dc: 'Document Controller', pm: 'Project Manager',
      principal: 'Principal', hse: 'HSE Officer', commercial: 'Quantity Surveyor', procurement: 'Quantity Surveyor',
      finance: 'Quantity Surveyor', design: 'Design Manager', planning: 'Planning Engineer' };
    const owner = (nextStep.by || []).find((f) => FN_SEAT[f]);
    const next = owner ? FN_SEAT[owner] : 'Project Manager';
    const ok = await walk(F, r.ref, [[next, cur.next_step]]);
    if (!ok) break;
  }
}

/* ===================================================================== 6 */
// Payment: QS raises, PM approves, DC issues, QS records the certificate, Finance the payment.
{
  const F = '6 IPC: QS → PM → DC → certificate → paid';
  const qs = await as('Quantity Surveyor');
  let ref = null;
  await step(F, 'QS prepares the application (valued from programme progress)', async () => {
    const p = await api(qs.page, '/api/ipc/propose', {});
    must(p.lines, 'no proposal: ' + JSON.stringify(p).slice(0, 160));
    const to = new Date().toISOString().slice(0, 10), from = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const r = await api(qs.page, '/api/ipc', { lines: p.lines.map((l) => ({ ...l, pct: l.proposed_pct || 0, note: 'UAT' })), reviewed: true,
      reviewed_by: 'UAT QS', materials_on_site: 0, period_from: from, period_to: to });
    must(r.ref, r.error || JSON.stringify(r).slice(0, 200));
    ref = r.ref; return ref + ' net ' + r.net;
  });
  const press = async (seat, action, answers) => {
    const who = await as(seat);
    return step(F, `${seat}: presses ${action} on ${ref}`, async () => {
      await dash(who.page);
      const link = who.page.getByText(/IPC \/ payments|Payments|IPC/).first();
      if (await link.count()) await link.click();
      await who.page.waitForTimeout(1200);
      const btn = who.page.locator(`[data-ipc="${action}"][data-ref="${ref}"]`);
      must(await btn.count(), `no "${action}" button on ${seat}'s payments screen`);
      who.page._answer = answers ? [...answers] : null;
      await btn.click(); await who.page.waitForTimeout(1800);
      who.page._answer = null;
      await shot(who.page, `${ref}-${action}`);
      const c = ((await api(who.page, '/api/ipc')).certificates || []).find((x) => x.ref === ref) || {};
      return c.status;
    });
  };
  if (ref) {
    (await press('Project Manager', 'approve'))
      && (await press('Document Controller', 'issue', [new Date().toISOString().slice(0, 10)]))
      && (await press('Quantity Surveyor', 'certify', ['1000000', 'UAT-IPC-01', new Date().toISOString().slice(0, 10)]))
      && (await press('Quantity Surveyor', 'pay', ['1000000', new Date().toISOString().slice(0, 10)]));
  }
}

/* ===================================================================== 7 */
// Every person's "Needs my attention" and screen, after all of that.
for (const seat of Object.keys(SB.seats)) {
  const who = await as(seat);
  await step('7 Every dashboard after the run', seat + ' — dashboard opens with no script errors', async () => {
    await dash(who.page);
    await shot(who.page, 'dashboard-' + seat);
    must(!who.errors.length, who.errors.slice(0, 2).join('; '));
  });
}

await browser.close();
const n = (s) => results.filter((r) => r.status === s).length;
writeFileSync(join(OUT, 'results.json'), JSON.stringify(results, null, 1));
writeFileSync(join(OUT, 'summary.md'), ['# UAT hand-offs on the sandbox', '', `**${n('pass')} pass · ${n('fail')} fail · ${n('warn')} warn**`, '',
  '| Flow | Step | Result | Detail |', '|---|---|---|---|',
  ...results.map((r) => `| ${r.flow} | ${r.step.replace(/\|/g, '/')} | ${r.status.toUpperCase()} | ${r.detail.replace(/\|/g, '/')} |`)].join('\n') + '\n');
console.log(`\n${n('pass')} pass, ${n('fail')} fail, ${n('warn')} warn — ${join(OUT, 'summary.md')}`);
process.exit(n('fail') ? 1 : 0);
