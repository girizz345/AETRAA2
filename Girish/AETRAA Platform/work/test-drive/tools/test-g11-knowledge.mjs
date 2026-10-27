// G11 / P1: the project knowledge base — the summary (read, missing, flagged,
// templates, tender vs IFC), links proposed by rules and decided by AETRAA,
// issued by AETRAA, approved by the PM, and reissues flagged to the PM.
//   node tools/test-g11-knowledge.mjs
import { db, call, admin, as, check, done, onboard, xlsxText } from './_harness.mjs';
import { words, tenderVsIfc, diffSnapshots } from '../src/knowledge.js';
import { DOC_TYPES } from '../src/templates-store.js';

console.log('— the rules —');
check('words drop the generic ones', JSON.stringify(words('Typical Floor Plan - Concrete Slab Reinforcement')) === JSON.stringify(['concrete', 'slab', 'reinforcement']));
const tv = tenderVsIfc([{ number: 'ST-1', kind: 'tender', revision: 'T1', title: 'Slab', status: 'current' }, { number: 'ST-1', kind: 'ifc', revision: 'A', title: 'Slab', status: 'current' },
  { number: 'ST-2', kind: 'ifc', revision: 'A', title: 'Beam', status: 'current' }, { number: 'AR-9', kind: 'tender', revision: 'T1', title: 'Old', status: 'current' }]);
check('tender vs IFC: changed, new at IFC, no IFC yet', tv.changed.length === 1 && tv.ifc_only[0].number === 'ST-2' && tv.tender_only[0].number === 'AR-9');
check('and it points to the Tender vs IFC page (decision 20)', /Tender vs IFC agent/.test(tv.note) && /\/deviations/.test(tv.note));
const ch = diffSnapshots({ drawings: { 'ST-1|ifc': { rev: 'A', title: 'Slab' } }, boq: { lines: 2, total: 100 }, programme: { activities: 5, data_date: 'x' }, spec: ['03 30 00'] },
  { drawings: { 'ST-1|ifc': { rev: 'B', title: 'Slab' }, 'ST-3|ifc': { rev: 'A', title: 'New' } }, boq: { lines: 3, total: 150 }, programme: { activities: 5, data_date: 'x' }, spec: ['03 30 00', '07 13 00'] });
check('a reissue is described: rev change, new sheet, BOQ, specification', ch.length === 4 && /rev A → rev B/.test(ch[0].what), ch);

const { pid } = await onboard('Tower K', 'TWK-0001', [['K PM', 'pm@towerk.test', ['pm']], ['K DC', 'dc@towerk.test', ['dc']]]);
const ins = db.prepare('INSERT INTO drawings (project_id, id, number, revision, title, kind, discipline, trade, floor, status, uploaded_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)');
ins.run(pid, 'd1', 'ST-101', 'T1', 'Ground floor concrete slab', 'tender', 'Structural', 'Concrete', 'Ground', 'current', '2026-09-01');
ins.run(pid, 'd2', 'ST-101', 'A', 'Ground floor concrete slab reinforcement', 'ifc', 'Structural', 'Concrete', 'Ground', 'current', '2026-09-02');
ins.run(pid, 'd3', 'AR-201', 'A', 'Basement waterproofing details', 'ifc', 'Architectural', 'Waterproofing', '', 'current', '2026-09-02');
await call('/api/boq', null);                       // creates the bill table
await admin();
await call('/api/boq/import', { project_id: pid, rows: [
  { section: 'Concrete', ref: 'C1', description: 'Reinforced concrete slab grade C40', unit: 'm3', qty: 100, rate: 500 },
  { section: 'Waterproofing', ref: 'W1', description: 'Sheet waterproofing membrane to basement walls', unit: 'm2', qty: 300, rate: 60 }] });
const ia = db.prepare('INSERT INTO activities (project_id, id, name, level, trade, floor, kind) VALUES (?,?,?,?,?,?,?)');
ia.run(pid, 'A100', 'Pour ground floor concrete slab', 1, 'Concrete', 'Ground', 'site');
ia.run(pid, 'A200', 'Apply basement waterproofing membrane', 1, 'Waterproofing', '', 'site');
await call('/api/spec-sections?project=' + pid);    // creates the specification tables
const is = db.prepare('INSERT INTO spec_section (id, project_id, index_id, code, title, discipline, page_from, page_to, manufacturers, or_equal, requirements) VALUES (?,?,?,?,?,?,?,?,?,?,?)');
is.run('s1', pid, 'x', '03 30 00', 'Cast-in-place concrete', 'Structural', 3, 4, '["Sika"]', 0, '{}');
is.run('s2', pid, 'x', '07 13 00', 'Sheet waterproofing', 'Architectural', 5, 6, '[]', 0, '{}');

console.log('\n— the summary —');
let r = await call('/api/knowledge?project=' + pid);
const s = r.json.summary;
check('what was read: drawings, BOQ, specification', s.read.drawings.current === 3 && s.read.boq.lines === 2 && s.read.specification.sections === 2, s.read);
check('what is missing: no contract, no programme data, templates', s.missing.some((m) => /No contract/.test(m)) && s.missing.some((m) => /templates are missing/.test(m)), s.missing);
check('tender vs IFC lists ST-101', s.tender_vs_ifc.changed.some((x) => x.number === 'ST-101'));
check('templates found and missing are listed', Array.isArray(s.templates.found) && s.templates.missing.length === Object.keys(DOC_TYPES).length);
check('the state is draft', r.json.state === 'draft');

console.log('\n— links —');
r = await call('/api/knowledge/links/propose', { project_id: pid });
check('links are proposed by rules', r.status === 200 && r.json.proposed >= 4, r.text);
const links = db.prepare("SELECT * FROM kb_link WHERE project_id = ? AND state = 'proposed'").all(pid);
const has = (fk, fr, tk, tr) => links.some((l) => l.from_kind === fk && l.from_ref === fr && l.to_kind === tk && l.to_ref === tr);
check('IFC slab drawing → concrete section', has('drawing', 'ST-101', 'spec', '03 30 00'));
check('waterproofing section → waterproofing BOQ line', has('spec', '07 13 00', 'boq', 'W1'));
check('concrete BOQ line → slab activity', has('boq', 'C1', 'activity', 'A100'));
check('drawing → activity where trade and floor agree', has('drawing', 'ST-101', 'activity', 'A100'));
check('the tender sheet is not linked', !links.some((l) => l.from_label.includes('T1')) && !has('drawing', 'ST-101', 'spec', '07 13 00'));
check('every link carries its basis', links.every((l) => /shared words|trade\/floor/.test(l.basis)));
const ids = links.map((l) => l.id);
r = await call('/api/knowledge/links/decide', { project_id: pid, ids: ids.slice(0, -1), decision: 'confirm' });
await call('/api/knowledge/links/decide', { project_id: pid, ids: ids.slice(-1), decision: 'reject' });
check('AETRAA confirms and rejects', r.json.decided === ids.length - 1);
r = await call('/api/knowledge/links/propose', { project_id: pid });
check('proposing again does not bring back a decided link', r.json.proposed === 0, r.text);
is.run('s3', pid, 'x', '14 21 00', 'Electric traction elevators', 'Mechanical', 7, 8, '[]', 0, '{}');
r = await call('/api/knowledge/ai-links', { project_id: pid });
check('with AI off, the AI pass says so and changes nothing', r.status === 200 && r.json.disabled === true, r.text);

console.log('\n— issue and approve —');
await as('pm@towerk.test');
r = await call('/api/knowledge/issue', {});
check('the PM cannot issue it', r.status === 403);
r = await call('/api/knowledge/approve', {});
check('nor approve it before AETRAA issues it', r.status === 400 && /issues the knowledge base/.test(r.json.error), r.text);
await admin();
r = await call('/api/knowledge/issue', { project_id: pid });
check('AETRAA issues it', r.status === 200 && r.json.state === 'issued' && r.json.version === 1, r.text.slice(0, 200));
await as('pm@towerk.test');
r = await call('/api/attention');
check('the PM sees it in Needs my attention', (r.json.items || []).some((i) => i.kind === 'knowledge' && i.page === '/knowledge'));
await as('dc@towerk.test');
r = await call('/api/knowledge/approve', {});
check('Document Control cannot approve it', r.status === 403);
await as('pm@towerk.test');
r = await call('/api/knowledge/approve', {});
check('the PM approves it', r.status === 200 && r.json.state === 'approved', r.text);
r = await call('/api/knowledge');
check('approved, with no changes yet', r.json.state === 'approved' && r.json.changes.length === 0, r.json.changes);

console.log('\n— a reissue (step 7) —');
db.prepare("UPDATE drawings SET status = 'superseded' WHERE id = 'd2'").run();
ins.run(pid, 'd4', 'ST-101', 'B', 'Ground floor concrete slab reinforcement', 'ifc', 'Structural', 'Concrete', 'Ground', 'current', '2026-10-05');
r = await call('/api/knowledge');
check('the reissued sheet is listed for the PM', r.json.changes.some((c) => /ST-101 reissued: rev A → rev B/.test(c.what)), r.json.changes);
r = await call('/api/attention');
check('and is in Needs my attention', (r.json.items || []).some((i) => i.kind === 'knowledge' && /reissued/.test(i.need)));
r = await call('/api/knowledge/review-changes', {});
r = await call('/api/knowledge');
check('once reviewed, the list is clear', r.json.changes.length === 0);
r = await call('/api/knowledge/xlsx');
check('the summary downloads as Excel with the X1 header', r.status === 200 && xlsxText(r.bytes).includes('Knowledge base summary') && xlsxText(r.bytes).includes('Downloaded by: K PM'));
r = await call('/knowledge');
check('the page opens', r.status === 200 && r.text.includes('Knowledge base'));
done();
