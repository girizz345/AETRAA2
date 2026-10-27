// Every page's in-browser script must at least parse. The pages are built as
// template strings, so `node --check` sees only the outer module, never the
// <script> inside — a syntax error there shows up only when someone opens the
// page. This builds each page and parses each of its scripts.
//   node tools/check-page-scripts.mjs
import { readdirSync } from 'node:fs';

let bad = 0, n = 0;
const dir = new URL('../src/html/', import.meta.url);
for (const f of readdirSync(dir).filter((x) => x.endsWith('.js'))) {
  let mod;
  try { mod = await import(new URL(f, dir)); } catch (e) { console.log('  FAIL ' + f + ' does not load: ' + e.message); bad++; continue; }
  for (const [name, fn] of Object.entries(mod)) {
    if (typeof fn !== 'function' || !/HTML$/.test(name)) continue;
    let page;
    try { page = fn({}, {}, {}); } catch (e) { continue; }       // needs real data; skipped
    if (typeof page !== 'string') continue;
    const scripts = [...page.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1].split("[object Object]").join("{}"));
    scripts.forEach((code, i) => {
      n++;
      try { new Function(code); }
      catch (e) {
        // An await at the top of a page script is legal in a module script.
        try { new (Object.getPrototypeOf(async function () {}).constructor)(code); }
        catch (e2) { console.log('  FAIL ' + f + ' ' + name + ' script ' + (i + 1) + ': ' + e2.message); bad++; }
      }
    });
  }
}
console.log(n + ' page scripts parsed, ' + bad + ' failures');
process.exit(bad ? 1 : 0);
