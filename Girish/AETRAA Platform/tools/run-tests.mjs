// EVERYTHING, IN ONE COMMAND.
//
//   npm test              every test
//   npm test -- --fast    everything except the browser runs (which are slow)
//
// The browser runs open a real Chromium and take a few minutes between them.
// They are the only check on what is actually drawn on a screen, so they are
// part of `npm test` and not an optional extra.
import { readdirSync } from 'node:fs';
import { spawn } from 'node:child_process';

const here = new URL('.', import.meta.url).pathname;
const fast = process.argv.includes('--fast');

const all = readdirSync(here)
  .filter((f) => /^test-.*\.mjs$/.test(f))
  .sort();
const browser = all.filter((f) => f.includes('browser'));
const rest = all.filter((f) => !f.includes('browser'));
const list = fast ? rest : rest.concat(browser);

const run = (file) => new Promise((done) => {
  const started = Date.now();
  const p = spawn(process.execPath, [here + file], { stdio: ['ignore', 'pipe', 'pipe'] });
  let out = '';
  p.stdout.on('data', (d) => { out += d; });
  p.stderr.on('data', (d) => { out += d; });
  p.on('exit', (code) => {
    // Each suite prints its own total. Trust that over counting "ok" lines —
    // a suite that only reports failures would otherwise read as zero checks.
    const badN = (out.match(/^ {2}FAIL/gm) || []).length;
    const summary = (out.match(/^(\d+) checks, \d+ failures/m) || [])[1];
    const passed = (out.match(/^(\d+)\/\d+ passed/m) || [])[1];
    const okN = (out.match(/^ {2}ok {3}/gm) || []).length;
    const checks = Number(summary || passed || okN || 0);
    const secs = ((Date.now() - started) / 1000).toFixed(0);
    done({ file, code, checks, fails: badN, secs, out });
  });
});

let totalChecks = 0, totalFails = 0;
const broken = [];
console.log('');
for (const file of list) {
  const r = await run(file);
  totalChecks += r.checks;
  totalFails += r.fails;
  const bad = r.code !== 0 || r.fails > 0;
  if (bad) broken.push(r);
  console.log(
    (bad ? '  FAIL  ' : '  ok    ') +
    file.replace(/^test-|\.mjs$/g, '').padEnd(22) +
    String(r.checks).padStart(5) + ' checks' +
    (r.fails ? '  ' + r.fails + ' FAILED' : '') +
    '   ' + r.secs + 's'
  );
}

if (broken.length) {
  console.log('\n' + '-'.repeat(60));
  for (const b of broken) {
    console.log('\n' + b.file + ':');
    const lines = b.out.split('\n').filter((l) => /^ {2}FAIL|Error|error:/.test(l));
    console.log(lines.slice(0, 12).map((l) => '  ' + l.trim()).join('\n') || '  exited ' + b.code);
  }
}

console.log('\n' + '='.repeat(60));
console.log(totalChecks + ' checks across ' + list.length + ' suites, ' + totalFails + ' failures' +
  (fast ? '  (browser runs skipped)' : ''));
process.exit(totalFails || broken.length ? 1 : 0);
