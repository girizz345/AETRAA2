// Every page's inline script, parsed.
//
//   node tools/test-pages.mjs
//
// The pages are JavaScript inside a template literal that emits more JavaScript.
// That is a trap: a `\n` written in the source is turned into a real newline when
// the template is evaluated, which silently breaks the string literal it was
// meant to be inside. The page still serves with a 200 and a perfectly ordinary
// looking body, and simply does nothing in the browser.
//
// No API test catches that, because the API is fine. This does: it renders each
// page and asks the JavaScript engine to parse what actually comes out.

import vm from 'node:vm';
import { dashboardHTML } from '../src/html/dashboard.js';
import { siteHTML } from '../src/html/site.js';
import { loginHTML } from '../src/html/login.js';
import { adminHTML } from '../src/html/admin.js';
import { portfolioHTML } from '../src/html/portfolio.js';
import { reportsHTML } from '../src/html/reports.js';
import { issuesHTML, issueDocHTML } from '../src/html/issues.js';
import { diaryHTML, diarySheetHTML } from '../src/html/diary.js';
import { verifyHTML } from '../src/html/verify.js';
import { peopleHTML } from '../src/html/people.js';
import { resourcesHTML } from '../src/html/resources.js';
import { drawingsHTML } from '../src/html/drawings.js';
import { scheduleHTML } from '../src/html/schedule.js';

const PAGES = [
  ['dashboard (owner)', () => dashboardHTML('owner')],
  ['dashboard (lead)', () => dashboardHTML('lead')],
  ['site', () => siteHTML('site')],
  ['login', () => loginHTML('dashboard')],
  ['admin', () => adminHTML(false)],
  ['admin (empty)', () => adminHTML(true)],
  ['portfolio', () => portfolioHTML()],
  ['reports', () => reportsHTML('owner')],
  ['issues', () => issuesHTML('owner')],
  ['issue document', () => issueDocHTML('RFI-0001 — Request for Information', '<p>body</p>')],
  ['diary', () => diaryHTML('manager')],
  ['verify', () => verifyHTML('manager')],
  ['people', () => peopleHTML()],
  ['resources (owner, money)', () => resourcesHTML('owner', true)],
  ['resources (manager, no money)', () => resourcesHTML('manager', false)],
  ['design (manager, upload+approve)', () => drawingsHTML('manager', true, true)],
  ['design (lead, upload only)', () => drawingsHTML('lead', true, false)],
  ['design (site, read only)', () => drawingsHTML('site', false, false)],
  ['schedule', () => scheduleHTML('owner')],
];

let fails = 0, ran = 0;
const check = (name, cond, detail) => {
  ran++;
  console.log((cond ? '  ok   ' : '  FAIL ') + name + (detail ? '  — ' + detail : ''));
  if (!cond) { fails++; process.exitCode = 1; }
};

const SCRIPT_RE = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;

for (const [name, render] of PAGES) {
  let html;
  try { html = render(); }
  catch (err) { check(name + ' renders', false, err.message); continue; }

  let n = 0, bad = null;
  for (const m of html.matchAll(SCRIPT_RE)) {
    n++;
    const body = m[1];
    if (!body.trim()) continue;
    try {
      // Parsed, never run: these scripts expect a browser. A parse is what we want
      // anyway — a syntax error is the failure this file exists to catch.
      new vm.Script(body, { filename: `${name}#script${n}` });
    } catch (err) {
      bad = `script ${n}: ${err.message}`;
      break;
    }
  }
  check(`${name} — ${n} inline script${n === 1 ? '' : 's'} parse`, !bad, bad);

  // A stray unescaped backtick or ${ would have ended the template early; the
  // clearest symptom is a page that stops looking like a page.
  check(`${name} — closes its html`, /<\/html>\s*$/.test(html.trim()));
}

console.log(`\n${ran - fails}/${ran} passed`);
