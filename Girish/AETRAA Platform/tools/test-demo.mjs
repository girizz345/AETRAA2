// THE DEMO FILE, OPENED FOR REAL.
//
// A demo that looks built and shows an empty project is worse than no demo.
// This opens AETRAA-Demo.html in a real browser, switches through every member
// of the team, and checks that each one sees their own real project data —
// and that a person who should not see the money still does not.
//
//   node tools/test-demo.mjs
import { chromium } from 'playwright';
import { existsSync } from 'node:fs';

let fails = 0, checks = 0;
const check = (n, c, d) => { checks++; console.log((c ? '  ok   ' : '  FAIL ') + n + (d && !c ? '  — ' + String(d).replace(/\n/g, ' | ').slice(0, 320) : '')); if (!c) fails++; };

const FILE = new URL('../demo/AETRAA-Demo.html', import.meta.url).pathname;
check('the demo file exists', existsSync(FILE), FILE);

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));

const open = async (email) => {
  await page.goto('file://' + FILE, { waitUntil: 'domcontentloaded' });
  if (email) {
    await page.evaluate((e) => localStorage.setItem('aetraa.demo.who', e), email);
    await page.goto('file://' + FILE, { waitUntil: 'domcontentloaded' });
  }
  // Wait for the app to have actually rendered rather than guessing a time —
  // the page navigates twice (once to set the viewer, once to load as them).
  await page.waitForFunction(() => document.body.innerText.length > 800, null, { timeout: 15000 })
    .catch(() => {});
  await page.waitForTimeout(900);
  return page.evaluate(() => document.body.innerText);
};

let t = await open(null);
check('it opens straight into the app, with no server', /NAF Tower/.test(t), t.slice(0, 200));
check('the demo bar is there', !!(await page.$('#demoWho')));
check('and it says plainly that saving does not work', /saving does not/i.test(t), t.slice(-300));

// ---- every person sees their own project -------------------------------
const PEOPLE = [
  ['principal@naf.ae', 'Principal'], ['pm@naf.ae', 'Project Manager'],
  ['planning@naf.ae', 'Planning'], ['civil@naf.ae', 'Site Engineer'],
  ['design@naf.ae', 'Design'], ['dc@naf.ae', 'Document Control'],
  ['qaqc@naf.ae', 'QA / QC'], ['hse@naf.ae', 'HSE'],
  ['qs@naf.ae', 'Commercial'], ['consultant@naf.ae', 'Consultant'],
];
for (const [email, label] of PEOPLE) {
  t = await open(email);
  check('[' + label + '] opens with their own identity and project', /NAF Tower/.test(t), t.slice(0, 160));
  check('[' + label + '] no counter is NaN or a dash-everything screen',
    !/NaN/.test(t), (t.match(/NaN\S*/g) || []).join(' '));
}

// ---- the data is really there ------------------------------------------
t = await open('design@naf.ae');
check('Design sees the real submittals on its dashboard',
  /External paint|formwork drawings|facade/i.test(t), t.slice(0, 500).replace(/\n/g, ' | '));
const rfiView = await page.evaluate(async () => {
  const l = Array.from(document.querySelectorAll('#nav a[data-nav]')).find((x) => /^RFI/i.test(x.getAttribute('data-nav')));
  if (!l) return '(no RFI link)';
  l.click(); await new Promise((r) => setTimeout(r, 700));
  return document.getElementById('leftcol').innerText;
});
check('and the RFI register holds the real RFIs', /duct clash/i.test(rfiView),
  rfiView.slice(0, 400).replace(/\n/g, ' | '));
t = await open('qaqc@naf.ae');
check('QA/QC sees the real NCRs', /Blockwork alignment|cube result/i.test(t), t.slice(0, 500));
t = await open('hse@naf.ae');
check('HSE sees the real permits', /Hot work|Lifting/i.test(t), t.slice(0, 500));
t = await open('civil@naf.ae');
check('the site engineer sees his own Civil activities', /slab|Blockwork/i.test(t), t.slice(0, 500));
check('and only his own discipline', !/chiller|switchgear/i.test(t), 'MEP work must not be on his list');

// the money, and who may not see it
t = await open('qs@naf.ae');
check('the QS sees the certified valuation', /AED/.test(t) && /Certified|IPA/i.test(t), t.slice(0, 400));
t = await open('civil@naf.ae');
check('the site engineer sees NO money at all', !/AED\s*[\d,]/.test(t),
  (t.match(/AED\s*[\d,]+/g) || []).join(' '));

// ---- the screens behind the sidebar ------------------------------------
t = await open('pm@naf.ae');
const nav = await page.evaluate(() =>
  Array.from(document.querySelectorAll('#nav a[data-nav]')).map((l) => l.getAttribute('data-nav')));
check('the sidebar is wired in the demo too', nav.length > 5, JSON.stringify(nav));
const reg = await page.evaluate(async () => {
  const l = Array.from(document.querySelectorAll('#nav a[data-nav]')).find((x) => /^Variation/.test(x.getAttribute('data-nav')));
  if (!l) return '(no variations link)';
  l.click(); await new Promise((r) => setTimeout(r, 900));
  return document.getElementById('leftcol').innerText;
});
check('a register opens and holds the real variations',
  /Podium landscape|LPG line|spandrel/i.test(reg), reg.slice(0, 300));

// the safety report, built by the real server and recorded
t = await open('hse@naf.ae');
const hse = await page.evaluate(async () => {
  openHse('weekly');
  await new Promise((r) => setTimeout(r, 900));
  return document.getElementById('dpane').innerText;
});
check('the safety report opens with the real week', /Toolbox talks/.test(hse), hse.slice(0, 300));
check('and its figures came from the logged week', /\b1[0-9]{2}\b|\b9[0-9]%/.test(hse), hse.slice(0, 400));
check('with no invented 142 days LTI-free', !/\b142\b/.test(hse), hse.slice(0, 300));

// ---- writing must be refused, and say why ------------------------------
const write = await page.evaluate(async () => {
  const r = await fetch('/api/records', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'rfi', title: 'x' }) });
  return { status: r.status, body: await r.text() };
});
check('saving is refused in the recording', write.status === 501, 'status=' + write.status);
check('and the refusal explains itself', /recording of the platform/i.test(write.body), write.body.slice(0, 160));

check('no JavaScript errors while going through all of that',
  errors.length === 0, errors.slice(0, 3).join(' | '));

await browser.close();
console.log('\n' + checks + ' checks, ' + fails + ' failures');
process.exit(fails ? 1 : 0);
