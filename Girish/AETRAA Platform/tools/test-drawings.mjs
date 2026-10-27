// The drawing register, and the link from an activity to the sheet it is built from.
//
//   node tools/test-drawings.mjs
//
// The thing that makes a register different from a shared folder is that it can
// say which revision is live. So most of what is checked here is about that:
// that issuing Rev C retires Rev B in the same breath, that Rev B stays readable
// and stamped, that deleting C puts B back rather than leaving a number with
// nothing current against it, and — above all — that a man opening a drawing
// from his activity cannot reach a superseded sheet by any route.
//
// The rest is the matching rule. 4,277 activities will not be attached by hand,
// so a wrong rule is not a small bug: it is a man building to somebody else's
// floor.
//
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import {
  KINDS, MAX_BYTES, key, applies, closeness, fromFileName,
  listDrawings, getDrawing, saveDrawing, removeDrawing, pin, forActivity, countsFor, reachFor,
  approveDrawing, rejectDrawing,
} from '../src/drawings.js';

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
  async batch(l) { for (const s of l) await s.run(); return []; },
};
const env = { DB };
const PID = 'p1';
const OTHER = 'p2';

let fails = 0, ran = 0;
function check(name, cond, detail) {
  ran++;
  console.log((cond ? '  ok   ' : '  FAIL ') + name + (detail ? '  — ' + detail : ''));
  if (!cond) { fails++; process.exitCode = 1; }
}
const section = (t) => console.log('\n' + t);

const pdf = (kb = 4) => 'data:application/pdf;base64,' + 'A'.repeat(kb * 1024);

/* ----------------------------------------------------------- the activities */

const ACTS = [
  ['A-1', 'Steel Fixer', 'Civil', 'Level 02'],
  ['A-2', 'Block Mason', 'Civil', 'Level 02'],
  ['A-3', 'Steel Fixer', 'Civil', 'Level 03'],
  ['M-1', 'Electrician', 'MEP', 'Level 02'],
  ['X-1', '', '', ''],                       // an activity nobody coded
];
for (const [id, trade, grp, floor] of ACTS) {
  db.prepare(`INSERT INTO activities (project_id,id,name,level,trade,trade_group,floor,sort_order)
              VALUES (?,?,?,1,?,?,?,1)`).run(PID, id, id + ' ' + (trade || 'general'), trade, grp, floor);
}
const act = (id) => db.prepare('SELECT * FROM activities WHERE project_id=? AND id=?').get(PID, id);

/* ------------------------------------------------------------- the register */

section('Putting a drawing in');
let d1;
{
  const r = await saveDrawing(env, PID, {
    number: 'AR-101', revision: 'B', title: 'Level 02 slab layout', kind: 'shop',
    discipline: 'Structural', trade: 'Steel Fixer', trade_group: 'Civil', floor: 'Level 02',
    data: pdf(),
  }, 'Sajan');
  check('it saves', r.ok === true, JSON.stringify(r));
  check('nothing was superseded, because nothing was there', !r.superseded);
  d1 = r.id;

  const row = await getDrawing(env, PID, d1);
  check('it comes back current', row.status === 'current', row.status);
  check('with who put it there and when', row.uploaded_by === 'Sajan' && !!row.uploaded_at);
  check('the mime type is taken off the file, not asked for', row.mime === 'application/pdf', row.mime);

  const bad = await saveDrawing(env, PID, { number: '', data: pdf() }, 'Sajan');
  check('a drawing with no number is refused', !!bad.error, bad.error);
  const empty = await saveDrawing(env, PID, { number: 'AR-999' }, 'Sajan');
  check('and one with neither a file nor a link', !!empty.error, empty.error);

  const big = await saveDrawing(env, PID, { number: 'AR-998', data: pdf(2000) }, 'Sajan');
  check('a file past what the database can hold is refused, and says so plainly',
    !!big.error && /too large/.test(big.error), big.error);
  check('and the message names the real limit rather than a round number',
    big.error.indexOf(String(Math.round(MAX_BYTES / 1024))) > 0, big.error);

  const junk = await saveDrawing(env, PID, { number: 'AR-997', data: 'not-a-data-url' }, 'Sajan');
  check('something that is not a file at all is refused', !!junk.error, junk.error);

  const linked = await saveDrawing(env, PID, {
    number: 'SPEC-03 30 00', title: 'Cast-in-place concrete', kind: 'spec',
    url: 'https://example.com/spec.pdf',
  }, 'Sajan');
  check('a link with no file is a perfectly good register entry', linked.ok === true, JSON.stringify(linked));
}

section('Issuing the next revision');
let d2;
{
  const r = await saveDrawing(env, PID, {
    number: 'AR-101', revision: 'C', title: 'Level 02 slab layout', kind: 'shop',
    trade: 'Steel Fixer', trade_group: 'Civil', floor: 'Level 02', data: pdf(),
  }, 'Sajan');
  d2 = r.id;
  check('the new revision is current', (await getDrawing(env, PID, d2)).status === 'current');
  check('the one before it is superseded in the same breath',
    (await getDrawing(env, PID, d1)).status === 'superseded');
  check('and points at what replaced it, so the trail is walkable',
    (await getDrawing(env, PID, d1)).superseded_by === d2);
  check('the save says what it retired, so the man who did it is told',
    r.superseded === 'B', String(r.superseded));

  const cur = (await listDrawings(env, PID, { status: 'current' })).filter((d) => d.number === 'AR-101');
  check('exactly one revision of a number is ever live', cur.length === 1, String(cur.length));

  const all = await listDrawings(env, PID);
  check('the superseded one is still in the register, not deleted',
    all.some((d) => d.id === d1), String(all.length));
  check('the register does not carry the file bytes around with it',
    all.every((d) => d.data === undefined) && all.find((d) => d.id === d2).has_file === 1);
}

section('Correcting a drawing already in');
{
  const r = await saveDrawing(env, PID, { id: d2, number: 'AR-101', revision: 'C',
    title: 'Level 02 slab layout (revised beam)', trade: 'Steel Fixer', floor: 'Level 02' }, 'Sajan');
  check('editing a drawing edits it', r.ok === true && r.id === d2);
  const row = await getDrawing(env, PID, d2);
  check('the title changed', /revised beam/.test(row.title), row.title);
  check('and the file it was uploaded with is still there', !!row.data);
  check('correcting a tag does not quietly empty what the file is',
    row.mime === 'application/pdf' && row.size > 0, row.mime + ' ' + row.size);
  check('correcting a typo does not supersede anything',
    (await getDrawing(env, PID, d1)).superseded_by === d2);
}

section('A sheet backed by object storage (R2), not the database');
{
  const r = await saveDrawing(env, PID, {
    number: 'IF-900', revision: 'A', title: 'A big IFC sheet', kind: 'ifc',
    trade: 'Steel Fixer', floor: 'Level 02',
    r2_key: 'p1/ifc/IF-900-abc123.pdf', mime: 'application/pdf', size: 8_400_000,
  }, 'Ajay');
  check('it saves with no file bytes in the database', r.ok === true, JSON.stringify(r));
  const row = await getDrawing(env, PID, r.id);
  check('the row carries the key, not the bytes', row.r2_key === 'p1/ifc/IF-900-abc123.pdf' && !row.data);
  check('the size is kept for the register', row.size === 8_400_000);
  const listed = (await listDrawings(env, PID)).find((d) => d.id === r.id);
  check('and it counts as having a file, so an Open link is offered', listed.has_file === 1);
  check('an 8 MB sheet — far past the database cap — is accepted, because it is not in the database',
    row.size > MAX_BYTES);
  await removeDrawing(env, PID, r.id);
}

/* --------------------------------------------------- the engineer/PM approval gate */

section('The engineer uploads; the PM approves');
{
  // Establish a live approved sheet the normal (PM) way.
  const live = await saveDrawing(env, PID, {
    number: 'AR-201', revision: 'A', title: 'Level 03 slab', kind: 'shop',
    trade: 'Steel Fixer', trade_group: 'Civil', floor: 'Level 03', data: pdf(),
  }, 'Ajay');                                    // no opts => PM path
  check('a PM upload is live at once', (await getDrawing(env, PID, live.id)).status === 'current');
  check('and is recorded as approved by whoever uploaded it',
    (await getDrawing(env, PID, live.id)).approved_by === 'Ajay');

  // The engineer now submits a new revision.
  const sub = await saveDrawing(env, PID, {
    number: 'AR-201', revision: 'B', title: 'Level 03 slab (beam revised)', kind: 'shop',
    trade: 'Steel Fixer', trade_group: 'Civil', floor: 'Level 03', data: pdf(),
  }, 'Rakesh', { canApprove: false });          // engineer path
  check('an engineer upload lands pending, not live', sub.pending === true && sub.status === 'pending', JSON.stringify(sub));
  check('and it says so back to the caller', (await getDrawing(env, PID, sub.id)).status === 'pending');

  check('the live revision is NOT retired by a pending upload — site does not move',
    (await getDrawing(env, PID, live.id)).status === 'current');
  const a3 = act('A-3');
  const shown = await forActivity(env, PID, a3);
  const ar201 = shown.filter((d) => d.number === 'AR-201');
  check('a man on that activity still sees only the live Rev A',
    ar201.length === 1 && ar201[0].revision === 'A', JSON.stringify(ar201.map((d) => d.revision)));

  // Now the PM approves Rev B.
  const ap = await approveDrawing(env, PID, sub.id, 'Ajay');
  check('approval succeeds and reports what it retired', ap.ok === true && ap.superseded === 'A', JSON.stringify(ap));
  check('Rev B is now live', (await getDrawing(env, PID, sub.id)).status === 'current');
  check('with the PM recorded as approver', (await getDrawing(env, PID, sub.id)).approved_by === 'Ajay');
  check('Rev A is superseded in the same breath', (await getDrawing(env, PID, live.id)).status === 'superseded');
  check('and points at what replaced it', (await getDrawing(env, PID, live.id)).superseded_by === sub.id);
  const shown2 = await forActivity(env, PID, a3);
  check('now the man is given Rev B',
    shown2.filter((d) => d.number === 'AR-201')[0].revision === 'B');
  check('exactly one AR-201 is ever live',
    (await listDrawings(env, PID, { status: 'current' })).filter((d) => d.number === 'AR-201').length === 1);
}

section('The PM sends one back');
{
  const sub = await saveDrawing(env, PID, {
    number: 'AR-201', revision: 'C', title: 'Level 03 slab (wrong grid)', kind: 'shop',
    trade: 'Steel Fixer', floor: 'Level 03', data: pdf(),
  }, 'Rakesh', { canApprove: false });
  const rej = await rejectDrawing(env, PID, sub.id, 'Ajay', 'Grid lines do not match structural.');
  check('rejecting succeeds', rej.ok === true, JSON.stringify(rej));
  const row = await getDrawing(env, PID, sub.id);
  check('the sheet is marked rejected', row.status === 'rejected');
  check('with the reason kept for the engineer', /grid lines/i.test(row.reject_note), row.reject_note);
  check('the live revision is untouched by a rejection',
    (await listDrawings(env, PID, { status: 'current' })).filter((d) => d.number === 'AR-201')[0].revision === 'B');
  check('a rejected sheet reaches no activity',
    !(await forActivity(env, PID, act('A-3'))).some((d) => d.id === sub.id));
  check('approving cannot be done to a live sheet',
    !!(await approveDrawing(env, PID, (await listDrawings(env, PID, { status: 'current' }))
        .find((d) => d.number === 'AR-201').id, 'Ajay')).already);
}

section('The lock — once approved, only the PM changes it');
{
  const liveB = (await listDrawings(env, PID, { status: 'current' })).find((d) => d.number === 'AR-201');
  // An engineer cannot edit an approved sheet.
  const blocked = await saveDrawing(env, PID, { id: liveB.id, number: 'AR-201', revision: 'B',
    title: 'sneaky edit', trade: 'Steel Fixer', floor: 'Level 03' }, 'Rakesh', { canApprove: false });
  check('an engineer editing an approved sheet is refused', !!blocked.error && /project manager/.test(blocked.error), blocked.error);
  check('and the title is unchanged', !/sneaky/.test((await getDrawing(env, PID, liveB.id)).title));

  // The engineer submits a fresh pending sheet, then someone else cannot touch it.
  const mine = await saveDrawing(env, PID, { number: 'AR-202', revision: 'A', title: 'mine',
    kind: 'shop', trade: 'Steel Fixer', floor: 'Level 03', data: pdf() }, 'Rakesh', { canApprove: false });
  const other = await saveDrawing(env, PID, { id: mine.id, number: 'AR-202', revision: 'A',
    title: 'not yours', trade: 'Steel Fixer', floor: 'Level 03' }, 'Sunil', { canApprove: false });
  check('another engineer cannot edit a pending sheet that is not theirs',
    !!other.error && /someone else/.test(other.error), other.error);
  // But the uploader can, and the PM can.
  const own = await saveDrawing(env, PID, { id: mine.id, number: 'AR-202', revision: 'A',
    title: 'my correction', trade: 'Steel Fixer', floor: 'Level 03' }, 'Rakesh', { canApprove: false });
  check('the engineer who uploaded it can still correct it while pending', own.ok === true);
  const pm = await saveDrawing(env, PID, { id: mine.id, number: 'AR-202', revision: 'A',
    title: 'PM correction', trade: 'Steel Fixer', floor: 'Level 03' }, 'Ajay');
  check('and the PM can change anything', pm.ok === true &&
    /PM correction/.test((await getDrawing(env, PID, mine.id)).title));
  // Clean up so later reach/tenancy counts are unaffected.
  await removeDrawing(env, PID, mine.id);
  for (const d of await listDrawings(env, PID)) if (d.number === 'AR-201') await removeDrawing(env, PID, d.id);
}

/* --------------------------------------------------------- what an activity sees */

section('What a man on an activity is shown');
{
  const list = await forActivity(env, PID, act('A-1'));
  const numbers = list.map((d) => d.number);
  check('his own trade and floor is there', numbers.includes('AR-101'), JSON.stringify(numbers));
  check('the specification, which is tagged to nothing, is there too',
    numbers.includes('SPEC-03 30 00'), JSON.stringify(numbers));
  check('and it is the current revision he is given',
    list.find((d) => d.number === 'AR-101').revision === 'C');
  check('the superseded one is not reachable from the activity at all',
    !list.some((d) => d.id === d1));

  const other = await forActivity(env, PID, act('M-1'));
  check('an electrician is not shown the steel fixer’s slab layout',
    !other.some((d) => d.number === 'AR-101'), JSON.stringify(other.map((d) => d.number)));
  check('but the specification reaches him, because it reaches everybody',
    other.some((d) => d.number === 'SPEC-03 30 00'));

  const floorUp = await forActivity(env, PID, act('A-3'));
  check('the same trade on another floor is not shown a floor-tagged sheet',
    !floorUp.some((d) => d.number === 'AR-101'), JSON.stringify(floorUp.map((d) => d.number)));
}

section('A drawing tagged to a group rather than a trade');
{
  await saveDrawing(env, PID, { number: 'ST-GA-01', title: 'General arrangement',
    kind: 'ifc', trade_group: 'Civil', data: pdf() }, 'Sajan');
  const civil = await forActivity(env, PID, act('A-2'));
  check('every civil activity gets it', civil.some((d) => d.number === 'ST-GA-01'));
  const mep = await forActivity(env, PID, act('M-1'));
  check('and no MEP one does', !mep.some((d) => d.number === 'ST-GA-01'));
  check('an activity with no trade coded still gets what is tagged to nothing',
    (await forActivity(env, PID, act('X-1'))).some((d) => d.number === 'SPEC-03 30 00'));
}

section('The order they come in');
{
  const list = await forActivity(env, PID, act('A-1'));
  check('the sheet for this trade on this floor is first',
    list[0].number === 'AR-101', JSON.stringify(list.map((d) => d.number)));
  check('a group-wide drawing outranks a specification tagged to nothing',
    list.findIndex((d) => d.number === 'ST-GA-01') <
    list.findIndex((d) => d.number === 'SPEC-03 30 00'), JSON.stringify(list.map((d) => d.number)));
}

section('Where the rule is wrong, a pin wins');
{
  const before = await forActivity(env, PID, act('M-1'));
  check('to start with, the electrician does not see it', !before.some((d) => d.number === 'AR-101'));

  const r = await pin(env, PID, d2, 'M-1', 'Ajay');
  check('it pins', r.ok && r.pinned === true, JSON.stringify(r));
  const after = await forActivity(env, PID, act('M-1'));
  check('now he does', after.some((d) => d.number === 'AR-101'));
  check('and it is at the top, because somebody said so by hand',
    after[0].number === 'AR-101' && after[0].pinned === true,
    JSON.stringify(after.map((d) => d.number)));

  check('pinning the same sheet twice is not an error and not a duplicate',
    (await pin(env, PID, d2, 'M-1', 'Ajay')).ok === true &&
    (await forActivity(env, PID, act('M-1'))).filter((d) => d.id === d2).length === 1);

  await pin(env, PID, d2, 'M-1', 'Ajay', true);
  check('unpinning takes it away again',
    !(await forActivity(env, PID, act('M-1'))).some((d) => d.number === 'AR-101'));

  check('pinning something that is not a drawing is refused',
    !!(await pin(env, PID, 'dwg_nothing', 'A-1', 'Ajay')).error);
  check('and pinning to no activity at all', !!(await pin(env, PID, d2, '', 'Ajay')).error);
}

section('The count on the button');
{
  await pin(env, PID, d2, 'M-1', 'Ajay');
  const acts = ACTS.map(([id]) => act(id));
  const counts = await countsFor(env, PID, acts);
  const byHand = {};
  for (const a of acts) {
    const n = (await forActivity(env, PID, a)).length;
    if (n) byHand[a.id] = n;
  }
  check('the count is the list, done cheaply',
    JSON.stringify(counts) === JSON.stringify(byHand),
    JSON.stringify(counts) + ' vs ' + JSON.stringify(byHand));
  check('an activity with nothing against it is simply absent, not zero',
    !('X-1' in counts) || counts['X-1'] > 0);
  check('asking about no activities costs nothing',
    JSON.stringify(await countsFor(env, PID, [])) === '{}');
  await pin(env, PID, d2, 'M-1', 'Ajay', true);
}

section('What a drawing reaches, which is the only check on a tag being right');
{
  const reg = await listDrawings(env, PID, { status: 'current' });
  const reach = await reachFor(env, PID, reg);
  const ga = reg.find((d) => d.number === 'ST-GA-01');
  const spec = reg.find((d) => d.number === 'SPEC-03 30 00');
  check('a sheet tagged to nothing reaches every activity',
    reach[spec.id].activities === ACTS.length, JSON.stringify(reach[spec.id]));
  check('one tagged to a group reaches that group only',
    reach[ga.id].activities === 3, JSON.stringify(reach[ga.id]));

  const orphan = await saveDrawing(env, PID, { number: 'AR-500', title: 'Nowhere',
    trade: 'Stonemason', data: pdf() }, 'Sajan');
  const r2 = await reachFor(env, PID, await listDrawings(env, PID, { status: 'current' }));
  check('a trade nobody spelled that way in the programme reaches nothing, ' +
        'and the register can say so', r2[orphan.id].activities === 0,
    JSON.stringify(r2[orphan.id]));
  await removeDrawing(env, PID, orphan.id);

  check('a superseded sheet has no reach at all', !(reach[d1] && reach[d1].activities));
}

/* ------------------------------------------------------------ taking one out */

section('Taking a drawing out');
{
  await pin(env, PID, d2, 'A-1', 'Ajay');
  const r = await removeDrawing(env, PID, d2);
  check('it goes', r.ok === true && !(await getDrawing(env, PID, d2)));
  check('the revision it superseded becomes live again, rather than leaving the ' +
        'number with nothing current against it',
    (await getDrawing(env, PID, d1)).status === 'current');
  check('and stops pointing at a drawing that no longer exists',
    (await getDrawing(env, PID, d1)).superseded_by === null);
  check('the pin goes with it, so no activity links to nothing',
    !(await forActivity(env, PID, act('A-1'))).some((d) => d.id === d2));
  check('removing something that is not there says so',
    !!(await removeDrawing(env, PID, 'dwg_nothing')).error);
}

/* ------------------------------------------------------------- the tenancy */

section('One project cannot see another’s drawings');
{
  db.prepare(`INSERT INTO activities (project_id,id,name,level,trade,trade_group,floor,sort_order)
              VALUES (?,?,?,1,?,?,?,1)`).run(OTHER, 'B-1', 'their steel', 'Steel Fixer', 'Civil', 'Level 02');
  await saveDrawing(env, OTHER, { number: 'AR-101', revision: 'A', title: 'Somebody else’s slab',
    trade: 'Steel Fixer', floor: 'Level 02', data: pdf() }, 'them');

  const mine = await listDrawings(env, PID);
  check('the register is per project', !mine.some((d) => /Somebody/.test(d.title || '')));
  const theirs = await forActivity(env, OTHER,
    db.prepare('SELECT * FROM activities WHERE project_id=? AND id=?').get(OTHER, 'B-1'));
  check('and so is what an activity is shown',
    theirs.length === 1 && /Somebody/.test(theirs[0].title), JSON.stringify(theirs.map((d) => d.title)));
  check('the same number in two projects is two drawings, not a clash',
    (await listDrawings(env, PID)).some((d) => d.number === 'AR-101'));
}

/* --------------------------------------------------------- the matching rule */

section('The rule itself, on the awkward spellings');
{
  const a = { trade: 'Steel Fixer', trade_group: 'Civil', floor: 'Level 02' };
  check('case and punctuation do not make two floors',
    applies({ floor: 'level-02' }, a) && applies({ floor: 'LEVEL 02' }, a));
  check('a blank tag is everywhere, not nowhere', applies({}, a));
  check('a trade that does not match is out', !applies({ trade: 'Painter' }, a));
  check('a floor that does not match is out', !applies({ floor: 'Level 03' }, a));
  check('a trade match with a wrong floor is still out',
    !applies({ trade: 'Steel Fixer', floor: 'Roof' }, a));
  check('a trade tag beats a group tag — a sheet named for a trade is not a ' +
        'group drawing',
    !applies({ trade: 'Painter', trade_group: 'Civil' }, a));
  check('trade and floor together rank above trade alone',
    closeness({ trade: 'Steel Fixer', floor: 'Level 02' }, a) >
    closeness({ trade: 'Steel Fixer' }, a));
  check('and trade alone above a group', closeness({ trade: 'Steel Fixer' }, a) >
    closeness({ trade_group: 'Civil' }, a));
  check('an untagged sheet ranks last', closeness({}, a) === 0);
  check('key() flattens the two spellings to one', key('Level 02') === key('level-02'));
}

section('What the file name already tells you');
{
  const cases = [
    ['AR-101 Rev C Ground Floor Plan.pdf', 'AR-101', 'C'],
    ['SK-12_R2.pdf', 'SK-12', '2'],
    ['ST 204 rev.B  Raft detail.pdf', 'ST-204', 'B'],
    ['MEP-1004-01 Revision 3.pdf', 'MEP-1004-01', '3'],
  ];
  for (const [name, number, revision] of cases) {
    const got = fromFileName(name);
    check(name, got.number === number && got.revision === revision, JSON.stringify(got));
  }
  const plain = fromFileName('slab detail.pdf');
  check('a file named by a human is left alone rather than guessed at',
    !plain.number && plain.title === 'slab detail', JSON.stringify(plain));
  check('a title is pulled out of the rest',
    fromFileName('AR-101 Rev C Ground Floor Plan.pdf').title === 'Ground Floor Plan',
    fromFileName('AR-101 Rev C Ground Floor Plan.pdf').title);
  check('nothing at all does not throw', JSON.stringify(fromFileName('')) === '{}');
}

section('Before the tables exist');
{
  const dead = { DB: { prepare() { throw new Error('no such table: drawings'); } } };
  check('the register says so rather than breaking the page',
    (await listDrawings(dead, PID)) === null);
  check('an activity simply has no drawings', (await forActivity(dead, PID, act('A-1'))).length === 0);
  check('and the counts are empty', JSON.stringify(await countsFor(dead, PID, [act('A-1')])) === '{}');
}

console.log(`\n${ran - fails}/${ran} passed`);
