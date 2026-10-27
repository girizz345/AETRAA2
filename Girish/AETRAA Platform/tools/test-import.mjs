// Reading issued daily diaries back out of Word.
//
//   node tools/test-import.mjs
//
// The test writes real .docx files with the app's own writer and reads them back,
// so the whole path is exercised: the ZIP, the Word XML, the table recognition
// and the arithmetic. Then it throws at the reader the things a year of real
// sheets will actually contain — a reordered table, an extra column, a trade
// nobody put on the roster, a date written three ways, a file that is not a
// document at all.
//
import { writeFileSync, mkdirSync, rmSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { diaryDocx } from '../src/diary-doc.js';
import { DEFAULT_TRADES, DEFAULT_PLANT } from '../src/diary.js';
import { readDiaryDocx } from './import-diaries.mjs';

let fails = 0, ran = 0;
function check(name, cond, detail) {
  ran++;
  console.log((cond ? '  ok   ' : '  FAIL ') + name + (detail ? '  — ' + detail : ''));
  if (!cond) { fails++; process.exitCode = 1; }
}
const section = (t) => console.log('\n' + t);

const DIR = '/tmp/claude-0/diary-test';
rmSync(DIR, { recursive: true, force: true });
mkdirSync(DIR, { recursive: true });

const project = { name: 'Plot 6457759', ref: 'MAJ-BL 114D' };
const roster = { trades: DEFAULT_TRADES, plant: DEFAULT_PLANT.map((t) => ({ t })) };

function sheet(date, over = {}) {
  const d = {
    report_date: date,
    roster,
    weather: 'Sunny, Dusty',
    staff: [
      { t: 'Steel Fixer', n: 14, h: '8' },
      { t: 'Carpenter', n: 9, h: '10' },
      { t: 'Block Mason', n: 6, h: '8' },
      { t: 'Site Engineer', n: 2, h: '8' },
      { t: 'Watchman', n: 2, h: '12' },
    ],
    plant: [
      { t: 'Mobile crane', n: 1, h: '8' },
      { t: 'Excavator', n: 2, h: '6' },
      { t: 'Bobcat', n: 1, h: '8' },
    ],
    materials: [
      { m: 'Ready-mix concrete C40', q: '120', u: 'm³' },
      { m: 'Steel reinforcement', q: '24', u: 'ton' },
    ],
    works: [{ a: 'Raft slab reinforcement, Zone B', q: '14' }],
    tomorrow: [{ a: 'Continue raft slab', q: '16' }],
    subs: [{ n: 'Falcon Aluminium', s: '1', l: '8' }],
    remarks: 'Concrete pour completed at 14:30.',
    visitors: 'Consultant site visit 10:00',
    prepared_by: 'Site Engineer',
    ...over,
  };
  const buf = diaryDocx(project, d);
  return Buffer.from(buf);
}

/* ------------------------------------------------------------ round trip */

section('A sheet the app itself issued, read back');
let r;
{
  const path = join(DIR, 'DAILY SITE DIARY 09-04-2026.docx');
  writeFileSync(path, sheet('2026-04-09'));
  r = readDiaryDocx(readFileSync(path), path);

  check('the file opens at all', !!r, r && r.file);
  check('the date is read', r.date === '2026-04-09', r.date);
  check('and taken from the filename, which is what somebody typed on purpose',
    r.date_from === 'filename', r.date_from);
  check('every trade on the sheet comes back', r.staff.length === 5, String(r.staff.length));
  check('the headcounts are the headcounts',
    r.staff.find((s) => s.t === 'Steel Fixer').n === 14);
  check('the hours come with them',
    r.staff.find((s) => s.t === 'Carpenter').h === '10',
    r.staff.find((s) => s.t === 'Carpenter').h);
  check('men on site total 33', r.men === 33, String(r.men));
  check('the plant comes back', r.plant.length === 3, String(r.plant.length));
  check('with its counts', r.plant.find((p) => p.t === 'Excavator').n === 2);
  check('plant-days total 4', r.machines === 4, String(r.machines));
  check('the materials come back', r.materials.length === 2, JSON.stringify(r.materials));
  check('a material whose name contains a number is not mistaken for one',
    r.materials.some((m) => m.m === 'Ready-mix concrete C40'), JSON.stringify(r.materials));
  const c40 = r.materials.find((m) => /C40/.test(m.m)) || {};
  check('with quantity and unit', c40.q === '120' && c40.u === 'm³', JSON.stringify(c40));
  check('nothing was left unread', r.unread.length === 0, JSON.stringify(r.unread));
}

section('What is taken, and what is deliberately not');
{
  // A subcontractor's own men are manpower on this site — on some months a third
  // of it — so they come across. The narrative does not: it stays in the Word
  // file it was issued from rather than being half-reproduced here.
  check('subcontractor labour is read', r.subs.length === 1, JSON.stringify(r.subs));
  check('with its staff and labour split', r.subs[0].n === 'Falcon Aluminium' &&
    Number(r.subs[0].s) + Number(r.subs[0].l) === 9, JSON.stringify(r.subs[0]));
  check('and totalled', r.sub_men === 9, String(r.sub_men));
  check('no works description', r.works === undefined);
  check('no remarks', r.remarks === undefined);
  check('no weather', r.weather === undefined);
}

/* ------------------------------------------------------------- the dates */

section('A date written the way different people write it');
{
  const cases = [
    ['DAILY SITE DIARY 9-04-2026.docx', '2026-04-09', true],
    ['DAILY SITE DIARY 09/04/2026.docx', '2026-04-09', true],
    ['Daily report 22-11-2025.docx', '2025-11-22', true],
    ['DSR 2026-04-09.docx', '2026-04-09', true],
    ['Site diary 9 April 2026.docx', '2026-04-09', true],
    ['diary 30-04-2026.docx', '2026-04-30', true],
  ];
  for (const [name, want] of cases) {
    const path = join(DIR, name.replace(/\//g, '-'));
    writeFileSync(path, sheet('2026-04-09'));
    // The filename is what decides; pass the original spelling through.
    const got = readDiaryDocx(readFileSync(path), name);
    check(`${name} → ${want}`, got.date === want, got.date);
  }

  const amb = readDiaryDocx(sheet('2026-04-09'), 'diary 05-04-2026.docx');
  check('a date that could be read two ways takes day-first', amb.date === '2026-04-05', amb.date);
  check('and says it is not sure, so somebody checks it', amb.date_sure === false);

  const clear = readDiaryDocx(sheet('2026-04-09'), 'diary 22-04-2026.docx');
  check('a day past the twelfth cannot be a month, so that one is certain',
    clear.date === '2026-04-22' && clear.date_sure === true);

  const noName = readDiaryDocx(sheet('2026-04-09'), 'scan0042.docx');
  check('with nothing in the filename it falls back to the sheet itself',
    noName.date === '2026-04-09' && noName.date_from === 'document', noName.date);
}

/* -------------------------------------------------- a year of real sheets */

section('The shapes a year of real sheets actually contains');
{
  const twice = readDiaryDocx(sheet('2026-04-09', {
    staff: [
      { t: 'Steel Fixer', n: 8, h: '8' },     // day shift
      { t: 'Steel Fixer', n: 6, h: '8' },     // night shift, same trade again
      { t: 'Carpenter', n: 9, h: '8' },
    ],
  }), 'x 09-04-2026.docx');
  check('a trade listed twice is added, not overwritten',
    twice.staff.find((s) => s.t === 'Steel Fixer').n === 14,
    String(twice.staff.find((s) => s.t === 'Steel Fixer').n));

  // Somebody added a trade to their copy of the template and never told anyone.
  const odd = readDiaryDocx(sheet('2026-04-09', {
    roster: { trades: DEFAULT_TRADES.concat([{ t: 'Shuttering Carpenter' }]),
              plant: roster.plant },
    staff: [
      { t: 'STEEL FIXER', n: 14, h: '8' },
      { t: 'block  mason', n: 6, h: '8' },
      { t: 'Shuttering Carpenter', n: 4, h: '8' },
    ],
  }), 'x 09-04-2026.docx');
  check('case and spacing do not matter',
    odd.staff.find((s) => s.t === 'Steel Fixer').n === 14 &&
    odd.staff.find((s) => s.t === 'Block Mason').n === 6);
  check('a trade nobody put on the roster is skipped, not guessed at',
    !odd.staff.some((s) => /Shuttering/i.test(s.t)));
  check('and it is named in the report so you can add it',
    odd.unread.includes('Shuttering Carpenter'), JSON.stringify(odd.unread));

  const zero = readDiaryDocx(sheet('2026-04-09', {
    staff: [{ t: 'Steel Fixer', n: 14, h: '8' }, { t: 'Plumber', n: 0, h: '' }],
  }), 'x 09-04-2026.docx');
  check('a trade with nobody on it is not a row', zero.staff.length === 1);

  const offRoster = readDiaryDocx(sheet('2026-04-09', {
    plant: [{ t: 'Tower crane', n: 1, h: '8' }, { t: 'Excavator', n: 2, h: '8' }],
  }), 'x 09-04-2026.docx');
  check('a machine not on the standard list is skipped rather than guessed at',
    !offRoster.plant.some((p) => /Tower/i.test(p.t)), JSON.stringify(offRoster.plant));
  check('and named in the report so you can add it',
    offRoster.unread.includes('Tower crane'), JSON.stringify(offRoster.unread));

  const noPlant = readDiaryDocx(sheet('2026-04-09', { plant: [], materials: [] }),
                                'x 09-04-2026.docx');
  check('a day with no plant and no deliveries still reads its labour',
    noPlant.staff.length === 5 && noPlant.plant.length === 0 && noPlant.materials.length === 0);
}

section('Files that are not what they claim to be');
{
  let threw = false;
  try { readDiaryDocx(Buffer.from('this is not a zip'), 'x.docx'); } catch (e) { threw = /zip/i.test(e.message); }
  check('something that is not a zip says so', threw);

  threw = false;
  try {
    // A perfectly valid, perfectly empty zip.
    const empty = Buffer.alloc(22);
    empty.writeUInt32LE(0x06054b50, 0);
    readDiaryDocx(empty, 'x.docx');
  } catch (e) { threw = /not in this file/i.test(e.message); }
  check('a zip with no document.xml says so rather than returning nothing', threw);
}

/* ------------------------------------------------------------ the totals */

section('A month of sheets');
{
  let men = 0, plant = 0;
  const dates = [];
  for (let d = 1; d <= 20; d++) {
    if (d % 7 === 5) continue;                   // Fridays off, so the run has gaps
    const date = '2026-04-' + String(d).padStart(2, '0');
    const n = 10 + (d % 5);
    const got = readDiaryDocx(sheet(date, {
      staff: [{ t: 'Steel Fixer', n, h: '8' }],
      plant: [{ t: 'Excavator', n: 1, h: '8' }],
      materials: [],
    }), `DAILY SITE DIARY ${String(d).padStart(2, '0')}-04-2026.docx`);
    check('day ' + d + ' reads', got.date === date && got.men === n,
      got.date + ' ' + got.men);
    men += got.men; plant += got.machines; dates.push(got.date);
  }
  check('the month adds up', men > 0 && plant === dates.length, `${men} man-days, ${plant} plant-days`);
  check('and the missing Fridays are simply absent, not zero',
    dates.length === 17, String(dates.length));
}

console.log(`\n${ran - fails}/${ran} passed`);
rmSync(DIR, { recursive: true, force: true });
