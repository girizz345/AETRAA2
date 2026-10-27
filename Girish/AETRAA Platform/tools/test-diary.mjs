// Exercises the daily diary: the roster and its totals, carry-forward from the
// previous day, saving, the manpower write-through, the printable sheet, and the
// Word file — which is checked by actually unzipping and parsing it.
//
//   node tools/test-diary.mjs      writes diary-sheet.html and diary.docx
//
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  loadDiary, saveDiary, listDiaries, totals, sumSubs, subsByPosition, shiftDay,
  DEFAULT_TRADES, DEFAULT_PLANT, WEATHER,
} from '../src/diary.js';
import { diaryHTML, photoPageHTML, diaryDocx, diaryFileName } from '../src/diary-doc.js';

const db = new DatabaseSync(':memory:');
db.exec(readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));
const DB = {
  prepare(sql) {
    const st = db.prepare(sql); let args = [];
    const api = { bind(...a) { args = a; return api; },
      async all() { return { results: st.all(...args) }; },
      async first() { return st.get(...args) ?? null; },
      async run() { st.run(...args); return { success: true }; } };
    return api;
  },
  async batch(list) { for (const s of list) await s.run(); return []; },
};
const env = { DB };
const PID = 'p1';

let fails = 0;
function check(name, cond, detail) {
  console.log((cond ? '  ok   ' : '  FAIL ') + name + (detail ? '  — ' + detail : ''));
  if (!cond) { fails++; process.exitCode = 1; }
}

db.prepare(`INSERT INTO projects (id, name, ref, sort_order, created_at)
            VALUES (?,?,?,1,datetime('now'))`)
  .run(PID, 'PROPOSED BUILDING (G + 3P + 4 + R) ON PLOT NO. 6457759',
       'WADI AL SAFA -3, DUBAI, UAE');
const project = () => db.prepare('SELECT * FROM projects WHERE id = ?').get(PID);

/* ------------------------------------------------- 1. the roster and totals */
console.log('\nThe roster');

const fresh = await loadDiary(env, PID, '2026-04-09', project());
check('it opens with the full trade roster', fresh.staff.length === DEFAULT_TRADES.length,
      fresh.staff.length + ' trades');
check('and the plant list', fresh.plant.length === DEFAULT_PLANT.length, fresh.plant.length + ' categories');
check('nothing is carried on the first ever day', !fresh.carried_from);
check('it opens as a new record', fresh.exists === false);

// The real numbers off the diary he issued on 09/04/2026.
const REAL = {
  'Project Manager': 1, 'MEP Engineer': 1, 'Senior project manager': 1, 'Surveyor': 1,
  'Surveyor Helper': 1, 'Safety Officer': 1, 'AC Foreman': 1, 'Document Controller': 1,
  'Post tension foreman': 1, 'AC Technician': 4, 'Mason': 3, 'Steel Fixer': 23,
  'Carpenter': 28, 'Helper': 24, 'Plumber': 2, 'MEP foreman': 1, 'Crane Operator': 1,
  'Bobcat operator': 1, 'Watchman': 2, 'Office Boy': 2, 'Block Work Foreman': 0,
  'Site Engineer': 1, 'Storekeeper': 1, 'Tower Crane operator': 1, 'Safety helper': 6,
  'PT worker': 10, 'Riger': 2, 'Charge in hand': 1, 'Planning Engineer': 1,
  'Block Mason': 7, 'Electrician': 5, 'Block work helper': 0, 'Scaffolder supply': 0,
};
const staff = fresh.staff.map((r) => ({ ...r, n: REAL[r.t] || 0 }));
const t = totals(staff, fresh.roster.trades);
check('grand total matches the issued diary', t.total === 135, t.total + ' (sheet says 135)');
check('productive manpower matches it too', t.productive === 124, t.productive + ' (sheet says 124)');
check('the difference is the indirect trades', t.indirect === 11, t.indirect + ' indirect');

/* ------------------------------------------------------------- 2. saving */
console.log('\nSaving a day');

const day1 = '2026-04-09';
const works = [
  { a: 'Slab 3 part 3 pour 4 PT work and steel work.', q: '32' },
  { a: 'Slab scaffolding work for first floor part 1.', q: '30' },
  { a: 'Pour 2 area steel and shutter work.', q: '27' },
  { a: 'Substation ground floor work.', q: '6' },
  { a: 'Ground floor back filling work.', q: '10' },
  { a: 'Groundfloor stiffener, beam, and column work.', q: '4' },
  { a: 'MEP height-level work at the ground floor.', q: '14' },
  { a: 'Housekeeping.', q: '6' },
];
const tomorrow = works.filter((w) => !/scaffolding/.test(w.a)).map((w) => ({ a: w.a, q: '' }));
const subs = [
  { n: 'SATYENDRA — Steel Fixer', s: '', l: '16' },
  { n: 'CARPENTER', s: '', l: '20' },
  { n: 'HABIBULLA CARPENTER', s: '', l: '5' },
  { n: 'STEEL FIXER', s: '', l: '5' },
  { n: 'AK PRESSTRESS PT', s: '', l: '10' },
  { n: 'AHMED AL BAGHDADY MASON', s: '', l: '7' },
  { n: 'Steel fixer', s: '', l: '2' },
];
const plant = fresh.plant.map((r) => ({
  ...r, n: { 'Boom Loader': 1, 'Bobcat': 1, 'Generator': 2, 'Steel cutting machine': 2,
             'Steel Bending Machine': 3 }[r.t] || 0,
}));

const saved = await saveDiary(env, PID, {
  report_date: day1, weather: 'Sunny', staff, plant, works, tomorrow, subs,
  materials: [{ m: 'Block', q: '900.00', u: 'NOS' }],
  remarks: 'Concrete pour held 2 hrs awaiting consultant inspection.',
  prepared_by: 'Rakesh — Site Engineer',
}, 'Rakesh — Site Engineer');
check('it saves', saved.ok === true);
check('and starts as a draft', saved.status === 'draft', saved.status);

check('subcontractor total adds up', sumSubs(subs) === 65, sumSubs(subs) + ' (sheet says 65)');

const back = await loadDiary(env, PID, day1, project());
check('it reads back as an existing record', back.exists === true);
check('the labour survives the round trip', back.totals.total === 135 && back.totals.productive === 124,
      back.totals.total + ' / ' + back.totals.productive);
check('the works survive', back.works.length === 8, back.works.length + ' lines');
check('the material delivery survives', back.materials[0].m === 'Block' && back.materials[0].q === '900.00');
check('the weather survives', back.weather === 'Sunny', back.weather);
check('rubbish weather is dropped', (await saveDiary(env, PID, {
  report_date: '2026-04-01', weather: 'Sunny, Volcano, Dusty', staff: [],
})).ok && (await loadDiary(env, PID, '2026-04-01', project())).weather === 'Sunny, Dusty');
check('a diary with no date is refused', !!(await saveDiary(env, PID, { staff: [] })).error);

// A save that leaves a section out must not wipe it — only what was sent is written.
await saveDiary(env, PID, { report_date: day1, remarks: 'Corrected remark.' }, 'PM');
const merged = await loadDiary(env, PID, day1, project());
check('a partial save changes only what it sent', merged.remarks === 'Corrected remark.');
check('and leaves the labour alone', merged.totals.total === 135, merged.totals.total + '');
check('and the weather', merged.weather === 'Sunny', merged.weather);
check('and the materials', merged.materials.length === 1);
await saveDiary(env, PID, {
  report_date: day1, remarks: 'Concrete pour held 2 hrs awaiting consultant inspection.',
}, 'Rakesh — Site Engineer');
check('an empty list is still a real change, not an omission',
      (await saveDiary(env, PID, { report_date: '2026-04-01', materials: [] })).ok);

/* ------------------------------------------ 3. the manpower write-through */
console.log('\nIt keeps the manpower record in step');

const mp = db.prepare('SELECT trade, headcount FROM manpower WHERE project_id=? AND report_date=?')
  .all(PID, day1);
check('manpower rows are written', mp.length > 0, mp.length + ' trades');
check('only trades with men on site', mp.every((r) => r.headcount > 0));
check('the total agrees with the diary',
      mp.reduce((s, r) => s + r.headcount, 0) === 135,
      mp.reduce((s, r) => s + r.headcount, 0) + '');
check('the carpenters are right', (mp.find((r) => r.trade === 'Carpenter') || {}).headcount === 28);

// Re-saving must replace, not add to, the day's manpower.
await saveDiary(env, PID, { report_date: day1, weather: 'Sunny', staff, plant, works, tomorrow, subs }, 'x');
check('re-saving does not double the manpower',
      db.prepare('SELECT COUNT(*) AS n FROM manpower WHERE project_id=? AND report_date=?')
        .get(PID, day1).n === mp.length);

/* ------------------------------------------------------ 4. carry forward */
console.log('\nThe next day');

const day2 = '2026-04-10';
const next = await loadDiary(env, PID, day2, project());
check('it says where it was filled in from', next.carried_from === day1, next.carried_from);
check('the roster comes with yesterday\'s numbers',
      totals(next.staff, next.roster.trades).total === 135);
check('the plant comes across', next.plant.filter((r) => r.n).length === 5);
check('the subcontractors come across', next.subs.length === 7);
check("yesterday's tomorrow becomes today's works",
      next.works.length === tomorrow.length && next.works[0].a === tomorrow[0].a,
      next.works.length + ' lines');
check('with the men left blank to be typed fresh', next.works.every((w) => w.q === ''));
check('materials do not carry — a delivery is a one-off', next.materials.length === 0);
check('and tomorrow starts empty', next.tomorrow.length === 0);
check('weather never carries', next.weather === '');

// A gap in the record: Friday off, then Saturday.
const day4 = '2026-04-13';
const afterGap = await loadDiary(env, PID, day4, project());
check('after a gap it carries from the last diary kept, not yesterday',
      afterGap.carried_from === day1, afterGap.carried_from);

// Manpower typed on the Manpower tab wins over yesterday's carried numbers.
db.prepare(`INSERT INTO manpower (project_id, report_date, trade, headcount, submitted_by, created_at)
            VALUES (?,?,?,?,?,?)`).run(PID, '2026-04-14', 'Carpenter', 31, 'site', '2026-04-14T13:00:00Z');
const seeded = await loadDiary(env, PID, '2026-04-14', project());
check("today's own manpower beats yesterday's carried figures",
      (seeded.staff.find((r) => r.t === 'Carpenter') || {}).n === 31 &&
      (seeded.staff.find((r) => r.t === 'Steel Fixer') || {}).n === 0,
      'carpenters 31, steel fixers reset to 0');

/* ------------------------------------------- 4b. subcontractors, by gang */
console.log('\nSub-contractor labour, one line per gang');
{
  const gangs = [
    { n: 'Falcon Aluminium', t: 'Aluminium work', p: 'Foreman',  c: '1',  h: '10' },
    { n: 'Falcon Aluminium', t: 'Aluminium work', p: 'Skilled',  c: '8',  h: '10' },
    { n: 'Al Gafry Masonry', t: 'Block Mason',    p: 'Helper',   c: '12', h: '9'  },
  ];
  const day = '2026-04-15';
  await saveDiary(env, PID, { report_date: day, weather: 'Sunny', subs: gangs }, 'Rakesh');
  const back = await loadDiary(env, PID, day, project());

  check('a gang keeps who it works for, its trade and its position',
    back.subs.length === 3 && back.subs[0].t === 'Aluminium work' && back.subs[0].p === 'Foreman',
    JSON.stringify(back.subs[0]));
  check('and the hours it worked', back.subs[2].h === '9', back.subs[2].h);
  check('the men total across the gangs', back.subTotal === 21, String(back.subTotal));

  const split = subsByPosition(back.subs);
  check('supervision is counted apart from labour',
    split.supervision === 1 && split.labour === 20, JSON.stringify(split));
  check('and the men are attributed to the firm that sent them',
    split.by_sub['Falcon Aluminium'] === 9 && split.by_sub['Al Gafry Masonry'] === 12,
    JSON.stringify(split.by_sub));
  check('and to the trade they worked in',
    split.by_trade['Aluminium work'] === 9, JSON.stringify(split.by_trade));

  // Months of diaries were issued before the gang line existed. They still total.
  const old = [{ n: 'SATYENDRA', s: '1', l: '16' }];
  await saveDiary(env, PID, { report_date: '2026-04-16', subs: old }, 'Rakesh');
  const legacy = await loadDiary(env, PID, '2026-04-16', project());
  check('an older two-number line is not rewritten on the way in',
    legacy.subs[0].l === '16' && legacy.subs[0].s === '1', JSON.stringify(legacy.subs[0]));
  check('and still totals', legacy.subTotal === 17, String(legacy.subTotal));
  check('with its split read from the two numbers',
    subsByPosition(legacy.subs).supervision === 1, JSON.stringify(subsByPosition(legacy.subs)));

  check('the two shapes add up together in one figure',
    sumSubs(back.subs.concat(legacy.subs)) === 38,
    String(sumSubs(back.subs.concat(legacy.subs))));

  const roster = back.roster;
  check('the positions are offered to choose from',
    roster.positions.includes('Foreman') && roster.positions.includes('Helper'),
    String((roster.positions || []).length) + ' positions');
  check('and every subcontractor already named on the job',
    roster.subcontractors.includes('Falcon Aluminium'),
    JSON.stringify(roster.subcontractors));
}

/* ------------------------------------------------------- 5. the register */
console.log('\nThe diaries kept');

const list = await listDiaries(env, PID, '2026-04-01', '2026-04-30');
check('every saved day is listed',
  list.some((r) => r.report_date === day1) && list.some((r) => r.report_date === '2026-04-01'),
  list.map((r) => r.report_date).join(', '));
check('with the headcount', (list.find((r) => r.report_date === day1) || {}).men === 135);
check('and the subcontractor count', (list.find((r) => r.report_date === day1) || {}).subs === 65);

await saveDiary(env, PID, { report_date: day1, staff, plant, works, tomorrow, subs, submit: true }, 'PM');
check('marking it submitted sticks', (await loadDiary(env, PID, day1, project())).status === 'submitted');
await saveDiary(env, PID, { report_date: day1, staff, plant, works, tomorrow, subs }, 'PM');
check('and a later save cannot quietly un-submit it',
      (await loadDiary(env, PID, day1, project())).status === 'submitted');

/* --------------------------------------------------------- 6. the sheet */
console.log('\nThe printable sheet');

db.prepare('UPDATE projects SET logo_contractor = ? WHERE id = ?')
  .run('data:image/png;base64,iVBORw0KGgo=', PID);
const d1 = await loadDiary(env, PID, day1, project());
const sheet = diaryHTML(project(), d1);
writeFileSync(new URL('../test-output/diary-sheet.html', import.meta.url),
  `<!doctype html><meta charset="utf-8"><body style="margin:0;padding:14px;background:#fff">${sheet}</body>`);
check('it names itself', /DAILY SITE DIARY/.test(sheet));
check('it carries the project', /6457759/.test(sheet));
check('it shows the day and date', /Thursday/.test(sheet) && /09\/04\/2026/.test(sheet));
check('the grand total is on it', />135</.test(sheet));
check('so is productive manpower', />124</.test(sheet));
check('the subcontractor total is on it', />65</.test(sheet));
check('weather is ticked, not just listed', /&#10003; Sunny/.test(sheet));
check('the material delivery is there', /900\.00/.test(sheet) && /NOS/.test(sheet));
check('works and tomorrow are both there',
      /DESCRIPTION OF WORKS/.test(sheet) && /EXPECTED WORKS TOMORROW/.test(sheet));
check('the signature block is there', /AGREED/.test(sheet) && /Signature/.test(sheet));
check('the logo is printed', /data:image\/png/.test(sheet));
check('no undefined or NaN', !/undefined|NaN/.test(sheet));

const pics = photoPageHTML(project(), day1,
  [{ id: 'a1', caption: 'Slab 3 steel', created_at: '2026-04-09T04:48:00Z' }]);
check('the photo page carries the time it was taken', /Time: 08:48/.test(pics), pics.match(/Time: [\d:]+/));
check('and the date', /09\/04\/2026/.test(pics));
check('no photos means no photo page', photoPageHTML(project(), day1, []) === '');

/* ---------------------------------------------------------- 7. the .docx */
console.log('\nThe Word file');

const bytes = diaryDocx(project(), d1);
// A real filesystem path, not a file:// URL. The moment this folder lives
// somewhere with a space in its name — "Site Progress Agent", say — the URL
// carries %20 and every shell command below is handed a file that does not
// exist. The failure looks like a broken .docx, which is a long way from the
// truth and costs an hour to work out.
const path = fileURLToPath(new URL('../test-output/diary.docx', import.meta.url));
writeFileSync(path, bytes);
check('it produces a file', bytes.length > 3000, (bytes.length / 1024).toFixed(1) + ' KB');
check('it starts with the zip signature', bytes[0] === 0x50 && bytes[1] === 0x4b);

// The only test that matters: can a zip reader actually open it?
let names = '';
try {
  names = execSync('python3 -c "import zipfile,sys;z=zipfile.ZipFile(sys.argv[1]);print(z.testzip());print(chr(10).join(z.namelist()))" ' +
    JSON.stringify(path), { encoding: 'utf8' });
} catch (e) { names = 'BROKEN: ' + e.message; }
check('a zip reader opens it without errors', names.startsWith('None'), names.split('\n')[0]);
check('it holds the parts Word needs',
      ['[Content_Types].xml', '_rels/.rels', 'word/document.xml', 'word/styles.xml']
        .every((n) => names.includes(n)));

let docXml = '';
try {
  docXml = execSync('python3 -c "import zipfile,sys;print(zipfile.ZipFile(sys.argv[1]).read(chr(119)+chr(111)+chr(114)+chr(100)+chr(47)+chr(100)+chr(111)+chr(99)+chr(117)+chr(109)+chr(101)+chr(110)+chr(116)+chr(46)+chr(120)+chr(109)+chr(108)).decode())" ' +
    JSON.stringify(path), { encoding: 'utf8' });
} catch (e) { docXml = ''; }
check('the document parses as XML', (() => {
  try {
    execSync('python3 -c "import zipfile,sys,xml.dom.minidom as m;m.parseString(zipfile.ZipFile(sys.argv[1]).read(chr(119)+chr(111)+chr(114)+chr(100)+chr(47)+chr(100)+chr(111)+chr(99)+chr(117)+chr(109)+chr(101)+chr(110)+chr(116)+chr(46)+chr(120)+chr(109)+chr(108)))" ' +
      JSON.stringify(path), { encoding: 'utf8' });
    return true;
  } catch (e) { return false; }
})());
check('it carries the labour figures', docXml.includes('>135<') && docXml.includes('>124<'));
check('it carries the works', docXml.includes('Slab 3 part 3 pour 4 PT work'));
check('it carries the subcontractors', docXml.includes('AK PRESSTRESS PT'));
check('it carries the remarks', docXml.includes('awaiting consultant inspection'));
check('the weather is ticked', docXml.includes('✓ Sunny'));
check('the ampersand in a heading is escaped, not raw',
      docXml.includes('ON SITE STAFF &amp; LABOUR RECORD') && !/[^p]&[^a#lgq]/.test(docXml));

check('the file is named after the day',
      diaryFileName(project(), day1, 'docx').startsWith('Daily Site Diary 09-04-2026'),
      diaryFileName(project(), day1, 'docx'));

/* ------------------------------------ 8. a database without the table */
console.log('\nA database that has not been migrated');
const plain = new DatabaseSync(':memory:');
plain.exec(readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));
plain.exec('DROP TABLE diary');
plain.prepare("INSERT INTO projects (id,name,sort_order,created_at) VALUES ('p1','T',1,datetime('now'))").run();
const env2 = { DB: { prepare(sql) {
  const st = plain.prepare(sql); let args = [];
  const api = { bind(...a) { args = a; return api; },
    async all() { return { results: st.all(...args) }; },
    async first() { return st.get(...args) ?? null; },
    async run() { st.run(...args); return { success: true }; } };
  return api;
}, async batch(l) { for (const s of l) await s.run(); return []; } } };
const none = await loadDiary(env2, 'p1', '2026-04-09', { id: 'p1', name: 'T' });
check('it says so rather than throwing', none.missing === true);
check('and listing returns nothing rather than failing',
      (await listDiaries(env2, 'p1', '2026-04-01', '2026-04-30')) === null);

console.log(fails ? `\n${fails} check(s) failed.\n` : '\nAll checks passed.\n');
