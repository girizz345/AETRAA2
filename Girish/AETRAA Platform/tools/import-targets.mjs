#!/usr/bin/env node
/**
 * Push a target list into a running app.
 *
 *   node tools/import-targets.mjs <url> <owner code> <targets.csv> ["Target name"] [YYYY-MM-DD]
 *
 * Replaces the whole target list. Progress is never touched — whether a line has
 * cleared is always read from what site has reported against that activity ID.
 */

import fs from 'fs';

const [url, code, file, name, deadline] = process.argv.slice(2);
if (!url || !code || !file) {
  console.error('Usage: node tools/import-targets.mjs <url> <owner code> <targets.csv> ["name"] [YYYY-MM-DD]');
  process.exit(1);
}
const base = url.replace(/\/+$/, '');
// Optional: --project <id> targets one project when the app holds several.
const pi = process.argv.indexOf('--project');
const PROJ = pi > 0 ? process.argv[pi + 1] : null;
const q = (path) => path + (PROJ ? (path.includes('?') ? '&' : '?') + 'p=' + encodeURIComponent(PROJ) : '');

let cookie = '';
async function call(path, body) {
  const r = await fetch(base + q(path), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
    body: JSON.stringify(body),
    redirect: 'manual',
  });
  const sc = r.headers.get('set-cookie');
  if (sc) cookie = sc.split(';')[0];
  const text = await r.text();
  let json; try { json = JSON.parse(text); } catch { json = { raw: text.slice(0, 200) }; }
  if (!r.ok) throw new Error(path + ' -> ' + r.status + ' ' + (json.error || json.raw || ''));
  return json;
}

const step = (s) => process.stdout.write('  ' + s.padEnd(34));

try {
  step('signing in');
  const who = await call('/api/login', { code });
  if (who.role !== 'owner') throw new Error('that code is not the owner code');
  console.log('ok');

  step('importing the target list');
  const res = await call('/api/import-targets', {
    text: fs.readFileSync(file, 'utf8'),
    target_name: name || '',
    target_deadline: deadline || '',
  });
  console.log('ok   ' + res.imported + ' lines, ' + res.matched + ' matched to the programme');
  if (res.imported !== res.matched) {
    console.log('\n  ' + (res.imported - res.matched) + ' line(s) carry activity IDs this programme does not hold.');
    console.log('  They will show on the target list but can never be reported against.');
  }
  console.log('\nOpen ' + base + ' — the Target tab is now the first thing you see.');
} catch (e) {
  console.error('\nImport failed: ' + e.message);
  console.error('You can still load the CSV by hand at ' + base + '/admin');
  process.exit(1);
}
