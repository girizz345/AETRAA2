// Reading a P6 .xer: activities, WBS→discipline, classification, derived deliverables.
//   node tools/test-xer.mjs
import { parseXER, buildProgramme, classifyActivity, branchOf, deriveDeliverables, DEFAULT_LEADS, decodeXer, saveProgramme } from '../src/xer.js';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';

let fails = 0;
const check = (n, c, d) => { console.log((c ? '  ok   ' : '  FAIL ') + n + (d && !c ? '  — ' + d : '')); if (!c) fails++; };

// ---- a synthetic but structurally real .xer ------------------------------
const rows = [];
const T = (name, fields, data) => {
  rows.push('%T\t' + name);
  rows.push('%F\t' + fields.join('\t'));
  for (const d of data) rows.push('%R\t' + fields.map((f) => (d[f] == null ? '' : d[f])).join('\t'));
};
T('PROJECT', ['proj_id', 'last_recalc_date'], [{ proj_id: '1', last_recalc_date: '2026-09-01 00:00' }]);
T('PROJWBS', ['wbs_id', 'parent_wbs_id', 'wbs_name'], [
  { wbs_id: '1', parent_wbs_id: '', wbs_name: 'NAF Tower' },
  { wbs_id: '2', parent_wbs_id: '1', wbs_name: 'Structure' },
  { wbs_id: '3', parent_wbs_id: '1', wbs_name: 'MEP' },
  { wbs_id: '4', parent_wbs_id: '2', wbs_name: 'Level 4' },
  { wbs_id: '5', parent_wbs_id: '3', wbs_name: 'Level 1' },
]);
T('ACTVTYPE', ['actv_code_type_id', 'actv_code_type'], [{ actv_code_type_id: '10', actv_code_type: 'Floor' }]);
T('ACTVCODE', ['actv_code_id', 'actv_code_type_id', 'actv_code_name'], [{ actv_code_id: '100', actv_code_type_id: '10', actv_code_name: 'Level 4' }]);
T('TASKACTV', ['task_id', 'actv_code_id'], [{ task_id: 't1', actv_code_id: '100' }]);
T('TASK', ['task_id', 'task_code', 'task_name', 'wbs_id', 'task_type', 'target_start_date', 'target_end_date', 'target_cost'], [
  // Structure / Level 4 — site work, cost loaded
  { task_id: 't1', task_code: 'A1000', task_name: 'L4 slab rebar fixing', wbs_id: '4', task_type: 'TT_Task', target_start_date: '2026-11-02 08:00', target_end_date: '2026-11-11 17:00', target_cost: '250000' },
  { task_id: 't2', task_code: 'A1010', task_name: 'L4 slab concrete pour', wbs_id: '4', task_type: 'TT_Task', target_start_date: '2026-11-12 08:00', target_end_date: '2026-11-14 17:00', target_cost: '150000' },
  // Structure already HAS a shop drawing activity — real planner date
  { task_id: 't3', task_code: 'A0900', task_name: 'Submit shop drawings - L4 slab', wbs_id: '4', task_type: 'TT_Task', target_start_date: '2026-09-05 08:00', target_end_date: '2026-09-05 17:00', target_cost: '' },
  // MEP / Level 1 — site work only, no deliverables in the programme
  { task_id: 't4', task_code: 'A2000', task_name: 'L1 MEP first fix containment', wbs_id: '5', task_type: 'TT_Task', target_start_date: '2026-12-01 08:00', target_end_date: '2026-12-20 17:00', target_cost: '' },
  // a milestone
  { task_id: 't5', task_code: 'M100', task_name: 'Structure complete', wbs_id: '2', task_type: 'TT_Mile', target_start_date: '2027-01-10 08:00', target_end_date: '2027-01-10 08:00', target_cost: '' },
  // procurement + material activities that DO exist
  { task_id: 't6', task_code: 'P100', task_name: 'Procure & deliver FCU units', wbs_id: '5', task_type: 'TT_Task', target_start_date: '2026-10-01 08:00', target_end_date: '2026-11-20 17:00', target_cost: '' },
  { task_id: 't7', task_code: 'MA10', task_name: 'Material approval - waterproofing', wbs_id: '4', task_type: 'TT_Task', target_start_date: '2026-09-20 08:00', target_end_date: '2026-10-10 17:00', target_cost: '' },
]);
const XER = rows.join('\n');

// ---- parsing ------------------------------------------------------------
const tables = parseXER(XER);
check('parses tables', !!tables.TASK && !!tables.PROJWBS);
check('reads all activities', tables.TASK.length === 7, 'n=' + (tables.TASK || []).length);
check('reads field names', tables.TASK[0].task_name === 'L4 slab rebar fixing');
check('handles CRLF', parseXER(XER.replace(/\n/g, '\r\n')).TASK.length === 7);
check('decodeXer returns text', typeof decodeXer(new TextEncoder().encode('%T\tX')) === 'string');

// ---- classification -----------------------------------------------------
check('classifies site work', classifyActivity('L4 slab rebar fixing') === 'site');
check('classifies shop drawings', classifyActivity('Submit shop drawings - L4 slab') === 'drawing');
check('classifies material approval', classifyActivity('Material approval - waterproofing') === 'material');
check('classifies procurement', classifyActivity('Procure & deliver FCU units') === 'procurement');
check('material beats procurement wording', classifyActivity('Material submittal for supply of blocks') === 'material');
check('IFC counts as a drawing item', classifyActivity('IFC drawings issued') === 'drawing');

// ---- WBS branch ---------------------------------------------------------
check('branch is the level below the project', branchOf(['NAF Tower', 'Structure', 'Level 4']) === 'Structure');
check('branch of a shallow path', branchOf(['NAF Tower']) === 'NAF Tower');

// ---- building the programme, before any mapping is confirmed ------------
let prog = buildProgramme(tables, {});
check('builds ok', prog.ok === true, JSON.stringify(prog.error));
check('data date read', prog.dataDate === '2026-09-01', prog.dataDate);
check('all activities built', prog.activities.length === 7);
check('branches surfaced for review', prog.branches.map(b => b.branch).sort().join(',') === 'MEP,Structure', JSON.stringify(prog.branches));
check('branch activity counts', prog.branches.find(b => b.branch === 'Structure').activities === 5, JSON.stringify(prog.branches));
check('counts by kind', prog.counts.site === 4 && prog.counts.drawing === 1 && prog.counts.material === 1 && prog.counts.procurement === 1, JSON.stringify(prog.counts));
check('unassigned flagged when no mapping', prog.unassigned === 7, String(prog.unassigned));

// ---- with the discipline mapping the Admin confirms ---------------------
prog = buildProgramme(tables, { disciplineByBranch: { Structure: 'Civil', MEP: 'MEP' } });
check('discipline applied from WBS', prog.activities.find(a => a.id === 'A1000').discipline === 'Civil');
check('MEP branch mapped', prog.activities.find(a => a.id === 'A2000').discipline === 'MEP');
check('nothing unassigned once mapped', prog.unassigned === 0, String(prog.unassigned));

// ---- weights ------------------------------------------------------------
check('cost used as weight when loaded', prog.activities.find(a => a.id === 'A1000').weight === 250000);
check('duration used when no cost', prog.activities.find(a => a.id === 'A2000').weight === 20, String(prog.activities.find(a => a.id === 'A2000').weight));
check('milestone weighted low', prog.activities.find(a => a.id === 'M100').weight === 0.25);

// ---- dates and section --------------------------------------------------
const a1 = prog.activities.find(a => a.id === 'A1000');
check('dates trimmed to day', a1.planned_start === '2026-11-02' && a1.planned_finish === '2026-11-11');
check('section from WBS', a1.wbs === 'Level 4', a1.wbs);
check('floor code read', a1.floor === 'Level 4', a1.floor);
check('source marked as programme', a1.source === 'programme');

// ---- derivation: only fills the gaps ------------------------------------
const derived = deriveDeliverables(prog.activities, DEFAULT_LEADS);
const forStructure = derived.filter(d => d.discipline === 'Civil');
const forMEP = derived.filter(d => d.discipline === 'MEP');
check('does NOT re-derive the drawing the programme has', !forStructure.some(d => d.kind === 'drawing'), JSON.stringify(forStructure.map(d => d.kind)));
check('does NOT re-derive the material item it has', !forStructure.some(d => d.kind === 'material'));
check('DOES derive the missing procurement for Structure', forStructure.some(d => d.kind === 'procurement'));
check('derives the two missing for MEP', forMEP.some(d=>d.kind==='drawing') && forMEP.some(d=>d.kind==='material'), JSON.stringify(forMEP.map(d => d.kind)));
check('does NOT re-derive MEP procurement (programme has it)', !forMEP.some(d => d.kind === 'procurement'), JSON.stringify(forMEP.map(d => d.kind)));
check('a milestone never forms its own deliverables', !derived.some(d => d.derived_from === 'Structure'), JSON.stringify(derived.map(d=>d.derived_from)));
check('everything derived is marked derived', derived.every(d => d.source === 'derived'));

// derived dates are the work start minus the lead time
const mepDraw = forMEP.find(d => d.kind === 'drawing');
check('drawing derived 56 days before the work', mepDraw.planned_start === '2026-10-06', mepDraw.planned_start + ' (work starts 2026-12-01)');
check('derived item records the work it came from', mepDraw.work_starts === '2026-12-01');
const civProc = forStructure.find(d => d.kind === 'procurement');
check('delivery derived 7 days before the work', civProc.planned_start === '2026-10-26', civProc.planned_start + ' (work starts 2026-11-02)');
check('derived items carry an explanation', !!mepDraw.note && mepDraw.note.includes('56'));

// lead times are adjustable
const custom = deriveDeliverables(prog.activities, { drawing_submit: 90 });
check('lead times can be overridden', custom.find(d => d.discipline === 'MEP' && d.kind === 'drawing').planned_start === '2026-09-02');

// ---- guards -------------------------------------------------------------
check('rejects a file with no activities', !!buildProgramme({ PROJWBS: [] }, {}).error);
check('rejects a file with no WBS', !!buildProgramme({ TASK: [{}] }, {}).error);
check('empty text parses to nothing', Object.keys(parseXER('')).length === 0);

// ---- saving the programme to a project ---------------------------------
const db = new DatabaseSync(':memory:');
db.exec(readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));
const DB = { prepare(sql){ const st=db.prepare(sql); let a=[]; const api={bind(...x){a=x;return api;},
  async all(){return {results:st.all(...a)};}, async first(){return st.get(...a)??null;}, async run(){st.run(...a);return {success:true};}}; return api; } };
const env = { DB };
const all = prog.activities.concat(derived);
let sv = await saveProgramme(env, 'p1', all, { replace: true });
check('programme saved', sv.ok === true, JSON.stringify(sv));
check('saved every line', sv.saved === all.length, sv.saved + ' of ' + all.length);

const stored = (await DB.prepare('SELECT * FROM activities WHERE project_id = ? ORDER BY sort_order').bind('p1').all()).results;
check('rows in the database', stored.length === all.length);
const rebar = stored.find(r => r.id === 'A1000');
check('discipline stored', rebar.discipline === 'Civil');
check('kind stored', rebar.kind === 'site');
check('source stored as programme', rebar.source === 'programme');
check('weight stored', rebar.weight === 250000);
const drv = stored.find(r => r.source === 'derived');
check('derived rows stored', !!drv);
check('derived carries its explanation', !!drv.derive_note && !!drv.work_starts);
check('site engineer can filter by discipline', stored.filter(r => r.discipline === 'MEP' && r.kind === 'site').length >= 1);
check('design can filter drawings', stored.filter(r => r.kind === 'drawing').length >= 1);

// re-upload of a revised programme updates in place
const revised = prog.activities.map(a => a.id === 'A1000' ? { ...a, planned_start: '2026-11-09' } : a);
sv = await saveProgramme(env, 'p1', revised, { replace: false });
check('re-upload ok', sv.ok === true);
const again = await DB.prepare('SELECT * FROM activities WHERE project_id = ? AND id = ?').bind('p1','A1000').first();
check('revised date updated in place', again.planned_start === '2026-11-09', again.planned_start);
check('no duplicate rows', (await DB.prepare('SELECT COUNT(*) AS n FROM activities WHERE project_id = ?').bind('p1').first()).n === all.length);

check('save rejects no project', !!(await saveProgramme(env, '', all, {})).error);
check('save rejects empty', !!(await saveProgramme(env, 'p1', [], {})).error);

console.log(fails ? ('\n' + fails + ' FAILED') : '\nall passed');
process.exit(fails ? 1 : 0);
