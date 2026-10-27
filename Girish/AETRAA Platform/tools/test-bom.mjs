// BOM budget / orders / GRN / the over-BOM warning.
//   node tools/test-bom.mjs
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { importBOM, listBOM, checkOrder, recordOrder, recordGRN, listMoves } from '../src/bom.js';

const db = new DatabaseSync(':memory:');
db.exec(readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));
const DB = { prepare(sql){ const st=db.prepare(sql); let a=[]; const api={bind(...x){a=x;return api;},
  async all(){return {results:st.all(...a)};}, async first(){return st.get(...a)??null;}, async run(){st.run(...a);return {success:true};}}; return api; } };
const env={DB};
let fails=0; const check=(n,c,d)=>{console.log((c?'  ok   ':'  FAIL ')+n+(d&&!c?'  — '+d:''));if(!c)fails++;};

// ---- import a BOM -------------------------------------------------------
const imp=await importBOM(env,'p1',[
  {ref:'M1', material:'Cement OPC 42.5', unit:'bag', budget_qty:10000, rate:14},
  {ref:'M2', material:'Rebar B500B',     unit:'ton', budget_qty:450,   rate:2600},
  {ref:'M3', material:'Blocks 200mm',    unit:'no',  budget_qty:60000, rate:3.2},
]);
check('import ok', imp.ok===true, JSON.stringify(imp));
check('3 lines', imp.lines===3);
// 10000*14 + 450*2600 + 60000*3.2 = 140000 + 1170000 + 192000 = 1,502,000
check('value computed', Math.round(imp.value)===1502000, String(imp.value));

// ---- the warning BEFORE any order --------------------------------------
let c=await checkOrder(env,'p1','Rebar B500B',100);
check('within budget = no warning', c.warning===false, JSON.stringify(c));
check('remaining reported', c.remaining===450, String(c.remaining));

c=await checkOrder(env,'p1','Rebar B500B',600);
check('over budget = WARNING', c.warning===true);
check('over_by correct', c.over_by===150, String(c.over_by));

c=await checkOrder(env,'p1','Imported Marble',20);
check('not in BOM = warning', c.warning===true && c.in_bom===false);

// ---- PM releases an order ----------------------------------------------
let o=await recordOrder(env,'p1',{material:'Rebar B500B',qty:300,ref:'MR-001'},'PM');
check('order recorded', o.ok===true);
check('order not warned (within)', o.warned===false, JSON.stringify(o));
let d=await listBOM(env,'p1');
let rebar=d.lines.find(l=>l.material==='Rebar B500B');
check('ordered 300', rebar.ordered_qty===300);
check('remaining 150', rebar.remaining===150, String(rebar.remaining));
check('not over yet', rebar.over===false);

// second order pushes past budget
o=await recordOrder(env,'p1',{material:'Rebar B500B',qty:200,ref:'MR-002'},'PM');
check('second order recorded', o.ok===true);
check('second order WARNED', o.warned===true, JSON.stringify(o));
check('warned over_by 50', o.over_by===50, String(o.over_by));
d=await listBOM(env,'p1');
rebar=d.lines.find(l=>l.material==='Rebar B500B');
check('ordered 500', rebar.ordered_qty===500);
check('line flagged over', rebar.over===true);
check('over_by 50 on line', rebar.over_by===50, String(rebar.over_by));
check('totals count over lines', d.totals.over_lines===1, String(d.totals.over_lines));

// ---- ordering something not in the BOM creates a visible zero-budget line
o=await recordOrder(env,'p1',{material:'Imported Marble',qty:20,unit:'m2',ref:'MR-003'},'PM');
check('off-BOM order recorded', o.ok===true);
check('off-BOM order warned', o.warned===true);
d=await listBOM(env,'p1');
const marble=d.lines.find(l=>l.material==='Imported Marble');
check('off-BOM line now visible', !!marble);
check('off-BOM shows zero budget', marble.budget_qty===0 && marble.ordered_qty===20);

// ---- GRN ----------------------------------------------------------------
let g=await recordGRN(env,'p1',{material:'Rebar B500B',qty:180,ref:'GRN-001'},'Store');
check('GRN recorded', g.ok===true, JSON.stringify(g));
check('received 180', g.received===180);
check('awaiting delivery 320', g.awaiting_delivery===320, String(g.awaiting_delivery));
check('no over-delivery', g.over_delivery===false);

g=await recordGRN(env,'p1',{material:'Nothing Ordered',qty:5},'Store');
check('GRN rejects unknown material', !!g.error);

// ---- the audit trail of moves ------------------------------------------
const moves=await listMoves(env,'p1');
check('moves logged', moves.length===4, 'moves='+moves.length);
check('over-order move carries over_by', moves.some(m=>m.kind==='order'&&m.over_by===50));

// ---- re-import keeps site history --------------------------------------
const imp2=await importBOM(env,'p1',[
  {ref:'M2', material:'Rebar B500B', unit:'ton', budget_qty:600, rate:2600},
]);
check('re-import ok', imp2.ok===true);
d=await listBOM(env,'p1');
rebar=d.lines.find(l=>l.material==='Rebar B500B');
check('budget updated to 600', rebar.budget_qty===600);
check('ordered history kept', rebar.ordered_qty===500, String(rebar.ordered_qty));
check('received history kept', rebar.received_qty===180, String(rebar.received_qty));
check('no longer over after budget raise', rebar.over===false);

// ---- guards -------------------------------------------------------------
check('rejects empty import', !!(await importBOM(env,'p1',[])).error);
check('rejects order with no qty', !!(await recordOrder(env,'p1',{material:'X',qty:0},'PM')).error);

console.log(fails?('\\n'+fails+' FAILED'):'\\nall passed');
process.exit(fails?1:0);
