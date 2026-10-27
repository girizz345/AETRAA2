// Every page speaks the theme: no typed-in colours, only the seven type sizes,
// only the platform's own fonts. src/html/theme.js holds the palette and the
// scale; a page names a role (var(--text-2), var(--fs-secondary)), never a value.
//   node tools/check-theme.mjs           strict on the converted pages, a tally for the rest
//   node tools/check-theme.mjs --all     strict on every page (the end of the rollout)
//
// Not checked: app.js (generated from dashboard-design.html — waits on
// gen-app.mjs), theme.js and shared.js (where the tokens and shared parts
// live), fonts.js and icons.js (data).
import { readdirSync, readFileSync } from 'node:fs';

// Every page is converted (26 Oct 2026), so every page is held to it. app.js
// is checked too: it was restyled by hand onto the same tokens.
const CONVERTED = null;
// Where the tokens live, data files, and the web-app manifest (whose colours
// must be literal, for the phone's splash screen).
const SKIP = ['theme.js', 'shared.js', 'fonts.js', 'icons.js', 'art.js', 'pwa.js'];
const SIZES = new Set([11, 13, 15, 17, 24, 32, 40]);              // label … display
const FAMILIES = /^(var\(--font\)|var\(--font-ui\)|var\(--font-display\)|var\(--mono\)|inherit)$/;
const NAMED = /\b(?:color|background(?:-color)?|border(?:-[a-z]+)?|outline|fill|stroke)\s*:\s*[^;'"}]*(?<![-\w])(white|black|red|green|blue|navy|gray|grey|orange|yellow|gold)\b/i;
// Allowed on purpose: a canvas is drawn like paper (a signature on white), and
// a drawn signature keeps its script face.
const EXEMPT = /fillStyle|strokeStyle|Segoe Script/;

const all = process.argv.includes('--all');
const dir = new URL('../src/html/', import.meta.url);

function problems(src) {
  // Data URIs (images, the button arrow) carry their own colour syntax.
  const s = src.replace(/data:[a-z]+\/[^'")\s]+/gi, '');
  const out = [];
  s.split('\n').forEach((line, i) => {
    if (EXEMPT.test(line)) return;
    const at = (what) => out.push('line ' + (i + 1) + ': ' + what);
    for (const m of line.matchAll(/[:(,=]\s*['"]?(#[0-9a-fA-F]{3,8})\b(?![\w-])/g)) at('typed colour ' + m[1]);
    for (const m of line.matchAll(/\b((?:rgba?|hsla?)\([^)]*\))/g)) at('typed colour ' + m[1]);
    const nm = NAMED.exec(line); if (nm) at('named colour ' + nm[1]);
    for (const m of line.matchAll(/font-size\s*:\s*([0-9.]+)(px|rem|em|pt)/g)) {
      if (m[2] !== 'px' || !SIZES.has(Number(m[1]))) at('font-size ' + m[1] + m[2] + ' is not on the scale');
    }
    for (const m of line.matchAll(/\bfont\s*:\s*([^;'"}]+)/g)) {
      const v = m[1].trim();
      if (v === 'inherit') continue;
      const px = /([0-9.]+)px/.exec(v);
      if (px && !SIZES.has(Number(px[1]))) at('font ' + v + ' — size not on the scale');
      if (/[a-z]/i.test(v.replace(/var\([^)]*\)/g, '').replace(/\b(inherit|normal|italic|[0-9.]+px|\/)\b/g, ''))) {
        at('font shorthand names a family (' + v + ') — use font-family: var(--font)');
      }
    }
    for (const m of line.matchAll(/font-family\s*:\s*([^;'"}]+)/g)) {
      if (!FAMILIES.test(m[1].replace(/\s*!important\s*$/, '').trim())) at('font-family ' + m[1].trim());
    }
  });
  return out;
}

let fails = 0, checks = 0;
const tally = [];
for (const f of readdirSync(dir).filter((x) => x.endsWith('.js') && !SKIP.includes(x)).sort()) {
  const found = problems(readFileSync(new URL(f, dir), 'utf8'));
  const strict = all || !CONVERTED || CONVERTED.includes(f);
  if (strict) {
    checks++;
    if (found.length) {
      fails++;
      console.log('  FAIL ' + f);
      found.slice(0, 12).forEach((p) => console.log('         ' + p));
      if (found.length > 12) console.log('         … and ' + (found.length - 12) + ' more');
    } else console.log('  ok   ' + f);
  } else if (found.length) tally.push([f, found.length]);
}
if (tally.length) {
  console.log('\nNot yet converted (' + tally.length + ' pages, ' + tally.reduce((a, b) => a + b[1], 0) + ' places):');
  console.log('  ' + tally.sort((a, b) => b[1] - a[1]).map(([f, n]) => f + ' ' + n).join(' · '));
}
console.log('\n' + checks + ' checks, ' + fails + ' failures');
process.exit(fails ? 1 : 0);
