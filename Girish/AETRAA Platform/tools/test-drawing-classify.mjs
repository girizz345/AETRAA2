// SORTING DRAWINGS INTO SECTIONS.
//
// The one thing this must never do is put a drawing in the wrong discipline —
// a Structural sheet filed under MEP is built from by the wrong trade. So the
// test cares as much about what is REFUSED (left unsorted) as what is placed.
//
//   node tools/test-drawing-classify.mjs
import { classify, classifyBatch, cleanRules, DEFAULT_RULES } from '../src/drawing-classify.js';

let fails = 0, checks = 0;
const check = (n, c, d) => { checks++; console.log((c ? '  ok   ' : '  FAIL ') + n + (d && !c ? '  — ' + d : '')); if (!c) fails++; };
const C = (f) => classify(f, DEFAULT_RULES);

// ---- number, revision, title come off the name --------------------------
let r = C('ST-1203_Rev-C_L4-slab-rebar.pdf');
check('reads the number', r.number === 'ST-1203', r.number);
check('reads the revision', r.revision === 'C', r.revision);
check('reads a title', /slab rebar/i.test(r.title), r.title);
check('places it in Structure', r.discipline === 'Structural' && r.trade_group === 'Civil', JSON.stringify(r));
check('and reads the floor', r.floor === 'Level 4', r.floor);

// ---- each discipline lands where it belongs -----------------------------
check('ME- is MEP', C('ME-150 duct layout.pdf').trade_group === 'MEP');
check('EL- is MEP / Electrical', C('EL-220-Rev-A.pdf').discipline === 'Electrical');
check('AR- is Architecture', C('AR-405 GA plan.pdf').trade_group === 'Architecture');
check('C- is Civil', C('C-012 setting out.pdf').trade_group === 'Civil');
check('FP- is fire protection under MEP', C('FP-003 sprinkler.pdf').trade_group === 'MEP');

// ---- the kind is read from the words in the name ------------------------
check('IFC in the name is an IFC drawing', C('ST-1203-IFC.pdf').kind === 'ifc', C('ST-1203-IFC.pdf').kind);
check('tender in the name is a tender drawing', C('AR-405 tender issue.pdf').kind === 'tender');
check('a shop drawing is the default for a bare sheet', C('ME-150.pdf').kind === 'shop', C('ME-150.pdf').kind);
check('a sketch is recognised', C('SK-12 detail.pdf').kind === 'sketch', C('SK-12 detail.pdf').kind);

// ---- longest prefix wins ------------------------------------------------
check('ST beats S', C('ST-100.pdf').discipline === 'Structural', C('ST-100.pdf').discipline);
check('a bare S- is still Structural', C('S-100.pdf').discipline === 'Structural');
check('a bare A- is Architectural', C('A-100.pdf').discipline === 'Architectural');

// ---- THE ONES THAT MUST NOT BE GUESSED ----------------------------------
r = C('scan_0001.pdf');
check('a junk filename is NOT placed in a section', !r.matched && !r.discipline, JSON.stringify(r));
check('and it explains itself', !!r.reason, r.reason);
r = C('site-photo.jpg');
check('a name with no number at all is not placed', !C('site-photo.jpg').matched);
check('and says no number could be read', /no drawing number/i.test(C('site-photo.jpg').reason),
  C('site-photo.jpg').reason);
r = C('ZZ-999 mystery.pdf');
check('an unknown prefix is NOT placed', !r.matched, JSON.stringify(r));
check('and says which prefix missed', /ZZ/.test(r.reason), r.reason);
check('an unplaced drawing carries no discipline at all', !r.discipline,
  'a half-guess is worse than none — it would be filed and built from');

// ---- floors -------------------------------------------------------------
check('Level 02 reads as Level 2', C('AR-2-02 plan.pdf').floor === 'Level 2' || C('AR-200 Level 02.pdf').floor === 'Level 2',
  C('AR-200 Level 02.pdf').floor);
check('basement reads', C('ST-B1-slab.pdf').floor === 'Basement 1', C('ST-B1-slab.pdf').floor);
check('podium reads', C('ME-podium-hvac.pdf').floor === 'Podium');
check('roof reads', C('PL-roof-drainage.pdf').floor === 'Roof');

// ---- a project's own rules override the defaults ------------------------
const own = [{ match: 'DWG', discipline: 'General', trade_group: 'Civil' }];
check('a project can define its own prefix', classify('DWG-01 site.pdf', own).matched === true);
check('and the defaults no longer apply under its rules',
  classify('ME-150.pdf', own).matched === false,
  'only the rules given are used, so a project cannot be surprised by a default');
check('a rule with no discipline is dropped, not honoured',
  cleanRules([{ match: 'X' }, { match: 'Y', discipline: 'Yard', trade_group: 'Civil' }]).length === 1);

// ---- the batch summary --------------------------------------------------
const files = [
  'ST-1000 raft.pdf', 'ST-1010 columns.pdf', 'ST-1020-IFC.pdf',
  'ME-150 hvac.pdf', 'EL-200 power.pdf',
  'AR-400 GA.pdf', 'AR-401 elevations.pdf',
  'scan_0002.pdf', 'ZZ-1 unknown.pdf',
];
const b = classifyBatch(files, DEFAULT_RULES);
check('the batch counts what sorted', b.counts.sorted === 7, String(b.counts.sorted));
check('and what did not', b.counts.unsorted === 2, String(b.counts.unsorted));
check('and totals them', b.total === 9);
check('the section breakdown is right',
  b.counts.by_section.Civil === 3 && b.counts.by_section.MEP === 2 && b.counts.by_section.Architecture === 2,
  JSON.stringify(b.counts.by_section));
check('every unsorted item explains itself',
  b.unsorted.every((u) => u.reason && !u.discipline), JSON.stringify(b.unsorted.map((u) => u.reason)));

// ---- a realistic mixed drop, mostly sorting itself ----------------------
const drop = [];
for (let i = 0; i < 40; i++) drop.push('ST-' + (1000 + i) + '_Rev-' + (i % 3 === 0 ? 'B' : 'A') + '.pdf');
for (let i = 0; i < 25; i++) drop.push('ME-' + (100 + i) + '.pdf');
for (let i = 0; i < 20; i++) drop.push('AR-' + (400 + i) + '-IFC.pdf');
for (let i = 0; i < 3; i++) drop.push('photo' + i + '.jpg');   // will not sort
const bd = classifyBatch(drop, DEFAULT_RULES);
check('a realistic 88-file drop sorts 85 by rule alone', bd.counts.sorted === 85, String(bd.counts.sorted));
check('and leaves exactly the 3 unnameable ones', bd.counts.unsorted === 3, String(bd.counts.unsorted));

console.log('\n' + checks + ' checks, ' + fails + ' failures');
process.exit(fails ? 1 : 0);
