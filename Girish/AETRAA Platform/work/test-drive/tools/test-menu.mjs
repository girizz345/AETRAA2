// src/html/app.js is generated from dashboard-design.html by Ajay's
// tools/gen-app.mjs, which is not in this folder. Menu entries were added to
// app.js directly from 6 Oct (see docs/app-js-direct-edits.patch). If app.js is
// regenerated without carrying them back, this test fails — so nobody loses a
// page from the menu without noticing.
//   node tools/test-menu.mjs
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../src/html/app.js', import.meta.url), 'utf8');
let fails = 0, checks = 0;
const check = (n, c) => { checks++; console.log((c ? '  ok   ' : '  FAIL ') + n); if (!c) fails++; };

// [menu label, the page it opens] — every page added since 6 Oct.
const ENTRIES = [
  ['Ask the project', '/ask'], ['Draft a letter', '/letters'], ['Delays & EOT', '/delays'], ['Delay & EoT', '/delays'],
  ['Payment terms', '/terms'], ['Specification index', '/spec'], ['Knowledge base', '/knowledge'], ['Schedules', '/schedules'],
  ['Contract obligations', '/obligations'], ['Tender ↔ IFC deviations', '/deviations'],
  ['Past registers', '/past-registers'], ['Incoming / outgoing', '/correspondence'],
];
for (const [label, page] of ENTRIES) {
  const inMenu = src.includes("'" + label + "',''") || src.includes("'" + label + "','");
  const routed = new RegExp("'" + label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + "'\\s*:\\s*\\{\\s*page:\\s*'" + page + "'").test(src)
    || new RegExp("label === '" + label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + "'\\) \\{ location\\.href = '" + page).test(src);
  check(label + ' is in the menu and opens ' + page, inMenu && routed);
}
check('the module switches hide the new entries with their module', /'Payment terms':'commercial'/.test(src) && /'Delays & EOT':'planning'/.test(src));
check('Tender ↔ IFC deviations is no longer "not set up"', !/'Tender ↔ IFC deviations': 'The tender-to-IFC comparison is not set up/.test(src));

console.log('\n' + checks + ' checks, ' + fails + ' failures');
process.exit(fails ? 1 : 0);
