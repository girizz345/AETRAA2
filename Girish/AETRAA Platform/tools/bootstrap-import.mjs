#!/usr/bin/env node
/**
 * Load the programme and its position into a freshly deployed app.
 *
 *   node tools/bootstrap-import.mjs <url> <owner code> <activities.csv> <progress.csv> ["Project name"] ["Ref"]
 *
 * Called automatically by install.sh; run it yourself any time you want to reload
 * a re-issued programme without going through the Admin page.
 */

import fs from 'fs';

const [url, code, actFile, progFile, name, ref] = process.argv.slice(2);
if (!url || !code || !actFile) {
  console.error('Usage: node tools/bootstrap-import.mjs <url> <owner code> <activities.csv> [progress.csv] ["name"] ["ref"]');
  process.exit(1);
}
const base = url.replace(/\/+$/, '');
// Optional: --project <id> targets one project when the app holds several.
const pi = process.argv.indexOf('--project');
let PROJ = pi > 0 ? process.argv[pi + 1] : null;
const q = (path) => path + (PROJ ? (path.includes('?') ? '&' : '?') + 'p=' + encodeURIComponent(PROJ) : '');

// The worker sets an HttpOnly session cookie; fetch() will not keep it for us, so hold it by hand.
let cookie = '';
async function call(path, body, method) {
  const r = await fetch(base + q(path), {
    method: method || (body === undefined ? 'GET' : 'POST'),
    headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: 'manual',
  });
  const setCookie = r.headers.get('set-cookie');
  if (setCookie) cookie = setCookie.split(';')[0];
  const text = await r.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text.slice(0, 200) }; }
  if (!r.ok) throw new Error(path + ' -> ' + r.status + ' ' + (json.error || json.raw || ''));
  return json;
}

const step = (s) => process.stdout.write('  ' + s.padEnd(38));
const ok = (s) => console.log('ok   ' + (s || ''));

try {
  step('signing in');
  const who = await call('/api/login', { code });
  if (who.role !== 'owner') throw new Error('that code is not the owner code (got "' + who.role + '")');
  ok();

  // A brand-new deployment has no project at all, and every /api/ route that
  // touches programme data refuses without one. So the project is made first,
  // and everything after it is aimed at that project by id.
  //
  // This used to post to /api/meta, which stopped existing when the app learned
  // to hold more than one project. An install done before that change worked;
  // one done after it failed at this line and left an empty app behind.
  step('finding the project');
  const list = await call('/api/projects');
  const live = (list.projects || []).filter((x) => !x.archived);
  const wanted = PROJ ? live.find((x) => x.id === PROJ) : live[0];
  let target = wanted ? wanted.id : null;
  if (target) {
    ok('using ' + target);
    if (name) {
      step('project details');
      await call('/api/project', { action: 'save', id: target, name, ref: ref || '' });
      ok(name);
    }
  } else {
    ok(live.length ? 'no project called "' + PROJ + '"' : 'none yet');
    step('creating it');
    // An id given on the command line is honoured, so a job can be "j179"
    // rather than a slug made out of forty characters of building description.
    const made = await call('/api/project', {
      action: 'create', id: PROJ || undefined, name: name || 'Project', ref: ref || '',
    });
    if (!made.id) throw new Error('the project was not created');
    target = made.id;
    ok(target + ' \u2014 ' + (name || 'Project'));
  }
  // Everything from here on is aimed at that project explicitly, so a second
  // project on the same app can never be written over by accident.
  PROJ = target;

  step('importing the programme');
  const a = await call('/api/import', { text: fs.readFileSync(actFile, 'utf8'), replace: true });
  ok(a.imported + ' activities');

  if (progFile && fs.existsSync(progFile)) {
    step('importing progress');
    const p = await call('/api/import-progress', {
      text: fs.readFileSync(progFile, 'utf8'), replace: true, submitted_by: 'programme import',
    });
    ok(p.imported + ' activities positioned');
  }

  console.log('\nLoaded into project "' + PROJ + '". Open ' + base +
              ' and sign in with your owner code.');
} catch (e) {
  console.error('\nImport failed: ' + e.message);
  console.error('The app is deployed — you can still load the CSVs by hand from ' + base + '/admin');
  process.exit(1);
}
