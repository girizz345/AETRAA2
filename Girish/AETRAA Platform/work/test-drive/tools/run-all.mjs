// npm test — every tools/test-*.mjs, one after another, on any machine
// (paths through fileURLToPath, so a Windows drive or a space in the folder
// name is fine). Prints one line per file and exits non-zero if any fails.
//   node tools/run-all.mjs [filter]
import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const here = fileURLToPath(new URL('.', import.meta.url));
const want = process.argv[2] || '';
const files = readdirSync(here).filter((f) => /^test-.*\.mjs$/.test(f) && f.includes(want)).sort();
let bad = 0;
for (const f of files) {
  const t0 = Date.now();
  const r = spawnSync(process.execPath, [join(here, f)], { cwd: join(here, '..'), encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const out = (r.stdout || '') + (r.stderr || '');
  const sum = (out.match(/\d+ checks, \d+ failures[^\n]*/g) || []).pop() || ('exited ' + r.status);
  const ok = r.status === 0 && / 0 failures/.test(sum);
  if (!ok) bad++;
  console.log((ok ? 'ok    ' : 'FAIL  ') + f.padEnd(34) + sum + '  (' + Math.round((Date.now() - t0) / 1000) + ' s)');
  if (!ok) console.log(out.split('\n').filter((l) => /FAIL|Error/.test(l)).slice(0, 8).map((l) => '        ' + l.trim()).join('\n'));
}
console.log('\n' + files.length + ' files, ' + bad + ' failing');
process.exit(bad ? 1 : 0);
