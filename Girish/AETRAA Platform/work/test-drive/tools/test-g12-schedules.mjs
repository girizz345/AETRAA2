// G12 / P2-P5: the four schedules — generated from the specification,
// drawings and programme after the knowledge base is approved; the date rule;
// review by the owning team; P3 coverage gates; PM baseline; live tracking
// through the record raised from an item.
//   node tools/test-g12-schedules.mjs
import { db, call, admin, as, check, done, onboard, xlsxText } from './_harness.mjs';
import { plannedDates, DEFAULTS } from '../src/schedules.js';

const addDays = (iso, n) => new Date(Date.parse(iso + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);
const today = new Date(Date.now() + 4 * 3600000).toISOString().slice(0, 10);

console.log('— the date rule —');
const ctx = { acts: new Map([['A1', { id: 'A1', name: 'Pour slab', planned_start: '2027-03-01' }]]), deliverables: [],
  review: { shop: 14, material: 14, ms: 14, itp: 14 } };
let d = plannedDates({ schedule: 'shop', description: 'Shop drawings — concrete', activity_id: 'A1' }, ctx);
check('derived: start − review − resubmission − preparation', d.source === 'derived' && d.submit === addDays('2027-03-01', -(14 + 14 + 21)), d);
d = plannedDates({ schedule: 'material', description: 'Concrete admixture', activity_id: 'A1' }, ctx);
check('P3 with no lead time gives no date and asks for one', d.submit === null && d.source === 'lead time needed', d);
d = plannedDates({ schedule: 'material', description: 'Concrete admixture', activity_id: 'A1', lead_days: 30 }, ctx);
check('P3 with a lead time is derived', d.submit === addDays('2027-03-01', -(30 + 14 + 14 + 21)));
d = plannedDates({ schedule: 'shop', description: 'Shop drawings — concrete' }, ctx);
check('no linked activity, no date', d.submit === null && d.source === 'no activity linked');
ctx.deliverables = [{ id: 'D1', name: 'Submit concrete shop drawings', planned_start: '2027-01-10', planned_finish: '2027-01-24' }];
d = plannedDates({ schedule: 'shop', description: 'Shop drawings — concrete', activity_id: 'A1' }, ctx);
check('the programme’s own activity wins, marked "from programme"', d.source === 'from programme' && d.submit === '2027-01-10' && d.approval === '2027-01-24', d);
check('a date set by hand is used and said so', plannedDates({ schedule: 'shop', description: 'x', manual_submit: '2027-02-02' }, ctx).source === 'set by hand');
check('defaults are 21 / 14 / 14', DEFAULTS.preparation === 21 && DEFAULTS.review === 14 && DEFAULTS.resubmission === 14);

console.log('\n— generated after the knowledge base —');
const { pid } = await onboard('Tower P', 'TWP-0001', [['P PM', 'pm@towerp.test', ['pm']], ['P Design', 'design@towerp.test', ['design']], ['P QA', 'qa@towerp.test', ['qaqc']]]);
await admin();
await call('/api/spec-sections?project=' + pid);
const req = (o) => JSON.stringify(o);
const is = db.prepare('INSERT INTO spec_section (id, project_id, index_id, code, title, discipline, page_from, page_to, manufacturers, or_equal, requirements) VALUES (?,?,?,?,?,?,?,?,?,?,?)');
is.run('s1', pid, 'x', '03 30 00', 'Cast-in-place concrete', 'Structural', 3, 4, '["Fosroc","Sika"]', 1, req({
  shop_drawings: [{ page: 3, sentence: 'Submit shop drawings for reinforcement placing.' }],
  product_data: [{ page: 3, sentence: 'Submit product data for admixtures.' }],
  testing: [{ page: 4, sentence: 'The Contractor shall carry out cube tests.' }],
  inspection: [{ page: 4, sentence: 'Notify the Engineer at the hold point before each pour for inspection.' }] }));
is.run('s2', pid, 'x', '07 13 00', 'Sheet waterproofing', 'Architectural', 5, 6, '[]', 0, req({ method_statement: [{ page: 5, sentence: 'Submit a method statement for membrane application.' }] }));
const ia = db.prepare('INSERT INTO activities (project_id, id, name, level, trade, floor, kind, source, planned_start, planned_finish) VALUES (?,?,?,?,?,?,?,?,?,?)');
ia.run(pid, 'A100', 'Pour ground floor concrete slab', 1, 'Concrete', 'Ground', 'site', 'programme', '2027-03-01', '2027-03-05');
ia.run(pid, 'A110', 'Pour first floor concrete slab', 1, 'Concrete', 'First', 'site', 'programme', '2027-04-01', '2027-04-05');
ia.run(pid, 'A200', 'Apply basement waterproofing membrane', 1, 'Waterproofing', '', 'site', 'programme', '2027-02-01', '2027-02-10');
ia.run(pid, 'A300', 'Tower crane erection and lifting', 1, 'Plant', '', 'site', 'programme', '2027-01-15', '2027-01-20');
db.prepare('INSERT INTO drawings (project_id, id, number, revision, title, kind, discipline, status, uploaded_at) VALUES (?,?,?,?,?,?,?,?,?)')
  .run(pid, 'd1', 'ST-101', 'A', 'Ground floor concrete slab reinforcement', 'ifc', 'Structural', 'current', '2026-09-01');
await call('/api/boq/import', { project_id: pid, rows: [{ section: 'Concrete', ref: 'C1', description: 'Concrete admixture grade C40', unit: 'm3', qty: 1, rate: 1 },
  { section: 'Prelims', ref: 'P1', description: 'Site office rental', unit: 'month', qty: 12, rate: 1 }] });
db.prepare("UPDATE projects SET data_date = '2026-10-01' WHERE id = ?").run(pid);

let r = await call('/api/schedules/generate', { project_id: pid });
check('nothing is generated before the knowledge base is approved', r.status === 400 && /after the PM approves the knowledge base/.test(r.json.error), r.text);
await call('/api/knowledge/issue', { project_id: pid });
await as('pm@towerp.test');
r = await call('/api/knowledge/approve', {});
check('approving the knowledge base generates the schedules', r.status === 200 && r.json.schedules && r.json.schedules.shop === 1 && r.json.schedules.material === 1, r.text);

const sched = async (s) => (await call('/api/schedules?s=' + s)).json;
let P2 = await sched('shop');
check('P2: one shop drawing item for 03 30 00, quoting the clause', P2.items.length === 1 && P2.items[0].spec_code === '03 30 00' && /p\.3/.test(P2.items[0].basis));
check('based on the IFC drawing that shares its words', JSON.stringify(P2.items[0].based_on) === JSON.stringify(['ST-101']), P2.items[0].based_on);
check('linked to the first activity that needs it', P2.items[0].activity_id === 'A100', P2.items[0].activity_id);
check('its date is derived from that activity', P2.items[0].date_source === 'derived' && P2.items[0].planned_submit === addDays('2027-03-01', -49), P2.items[0]);
let P3 = await sched('material');
check('P3: the material item asks for a lead time', P3.items[0].planned_submit === null && P3.items[0].date_source === 'lead time needed');
check('and notes the manufacturers the spec names', /Fosroc, Sika \(or equal\)/.test(P3.items[0].notes));
const P4 = await sched('ms');
check('P4: the spec’s method statement and the high-risk lifting work', P4.items.some((i) => i.spec_code === '07 13 00') && P4.items.some((i) => /Lifting operations/.test(i.description)), P4.items.map((i) => i.description));
const P5 = await sched('itp');
check('P5: an ITP with the hold point quoted', P5.items.length === 1 && P5.items[0].hold_points.some((h) => /hold point before each pour/.test(h.quote)));
check('and the inspections planned from its activities', P5.items[0].inspections.length >= 2 && P5.items[0].inspections[0].planned === '2027-03-01', P5.items[0].inspections);

console.log('\n— review, programme updates, gates, approval —');
r = await call('/api/schedules/item', { schedule: 'shop', id: P2.items[0].id, lead_days: 10 });
check('the PM does not edit the shop drawing schedule (Design does)', r.status === 403, r.status);
await as('design@towerp.test');
r = await call('/api/schedules/item', { schedule: 'material', id: P3.items[0].id, lead_days: 30 });
check('Design enters the lead time', r.status === 200);
P3 = await sched('material');
check('and the date appears', P3.items[0].planned_submit === addDays('2027-03-01', -(30 + 49)), P3.items[0]);
db.prepare("UPDATE activities SET planned_start = '2027-03-15' WHERE project_id = ? AND id = 'A100'").run(pid);
P2 = await sched('shop');
check('a programme update moves the date', P2.items[0].planned_submit === addDays('2027-03-15', -49), P2.items[0].planned_submit);
ia.run(pid, 'D10', 'Submit concrete shop drawings', 1, '', '', 'drawing', 'programme', '2027-01-05', '2027-01-19');
P2 = await sched('shop');
check('a programme activity for the item takes over', P2.items[0].date_source === 'from programme' && P2.items[0].planned_submit === '2027-01-05');
r = await call('/api/schedules/item', { schedule: 'shop', description: 'Shop drawings — embedded plates', spec_code: '03 30 00' });
check('Design adds an item', r.status === 200);

check('P3 has coverage gaps', P3.gates.open >= 1 && P3.gates.gates.some((g) => g.key === 'boq:P1'), P3.gates);
await as('pm@towerp.test');
r = await call('/api/schedules/approve', { schedule: 'material' });
check('the PM cannot approve P3 while a gap is open', r.status === 400 && /coverage gaps are still open/.test(r.json.error), r.text);
await as('design@towerp.test');
for (const g of P3.gates.gates.filter((x) => !x.resolved)) {
  r = await call('/api/schedules/gate', { key: g.key, resolution: g.key === 'boq:P1' ? 'prelims — not a material' : 'covered by item 1' });
}
r = await call('/api/schedules/gate', { key: 'boq:P1', resolution: '' });
check('a gap is never cleared without a reason', r.status === 400);
await as('pm@towerp.test');
r = await call('/api/schedules/approve', { schedule: 'material' });
check('with the gaps cleared, the PM approves P3', r.status === 200 && r.json.state === 'approved', r.text);
r = await call('/api/schedules/approve', { schedule: 'shop' });
check('and P2', r.status === 200);
P2 = await sched('shop');
check('the baseline date is kept beside the live one', P2.items[0].baseline_submit === P2.items[0].planned_submit && P2.state === 'approved');

console.log('\n— live tracking —');
await as('design@towerp.test');
r = await call('/api/schedules/raise', { id: P2.items[0].id });
check('Design raises the submittal from the item', r.status === 200 && /^SUB-/.test(r.json.ref), r.text);
P2 = await sched('shop');
check('the schedule follows the record', P2.items[0].record_ref === r.json.ref && P2.items[0].status !== 'not raised', P2.items[0].status);
const added = (await sched('shop')).items.find((i) => /embedded plates/.test(i.description));
await call('/api/schedules/item', { schedule: 'shop', id: added.id, manual_submit: addDays(today, -1) });
r = await call('/api/attention');
check('items due soon or late are in Design’s Needs my attention', (r.json.items || []).some((i) => i.kind === 'schedule' && i.page === '/schedules'), (r.json.items || []).map((i) => i.kind));
r = await call('/api/schedules/xlsx?s=itp');
if (!(r.status === 200 && xlsxText(r.bytes).includes('Programme data date: 2026-10-01'))) console.log('   xlsx:', r.status, r.text.slice(0, 200), xlsxText(r.bytes).match(/Programme data date[^<]*/));
check('a schedule downloads with the X1 header and the data date', r.status === 200 && xlsxText(r.bytes).includes('Programme data date: 2026-10-01') && xlsxText(r.bytes).includes('sheet name="Inspections"'));
r = await call('/api/schedules/ai-propose', { schedule: 'shop' });
check('with AI off, the AI pass says so', r.status === 200 && r.json.disabled === true, r.text);
r = await call('/schedules');
check('the page opens', r.status === 200 && r.text.includes('Schedules'));
done();
