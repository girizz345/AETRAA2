// BOQ import / roll-up / billing — against the real schema, D1-shimmed.
//   node tools/test-commercial.mjs
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { importBOQ, listBOQ, setBilled } from '../src/commercial.js';

const db = new DatabaseSync(':memory:');
db.exec(readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));
const DB = { prepare(sql){ const st=db.prepare(sql); let a=[]; const api={bind(...x){a=x;return api;},
  async all(){return {results:st.all(...a)};}, async first(){return st.get(...a)??null;}, async run(){st.run(...a);return {success:true};}}; return api; } };
const env = { DB };
let fails=0; const check=(n,c,d)=>{console.log((c?'  ok   ':'  FAIL ')+n+(d&&!c?'  — '+d:''));if(!c)fails++;};

// import a small priced bill (amount derived from qty*rate where blank)
const rows=[
  {section:'Preliminaries', ref:'A', description:'Prelims', unit:'sum', qty:1, rate:3200000, billed_pct:62},
  {section:'Concrete works', ref:'C1', description:'Slabs', unit:'m3', qty:2000, rate:1500, billed_pct:71},
  {section:'Concrete works', ref:'C2', description:'Columns', unit:'m3', qty:400, rate:1600, billed_pct:71},
  {section:'Electrical', ref:'R', description:'LV', unit:'sum', qty:1, rate:9800000, billed_pct:22},
];
const imp=await importBOQ(env,'p1',rows);
check('import ok', imp.ok===true, JSON.stringify(imp));
check('4 lines', imp.lines===4);
// total = 3.2m + 3.0m + 0.64m + 9.8m = 16.64m
check('value rolled', Math.round(imp.value)===16640000, String(imp.value));

const d=await listBOQ(env,'p1');
check('lines listed', d.lines.length===4);
check('sections rolled', d.sections.length===3);
const conc=d.sections.find(s=>s.section==='Concrete works');
check('concrete value', Math.round(conc.value)===3640000, String(conc && conc.value));
check('concrete billed 71%', conc.billed_pct===71, String(conc && conc.billed_pct));
check('portfolio billed value', d.totals.billed_value>0);

// re-import replaces (not appends)
const imp2=await importBOQ(env,'p1',[{section:'X',ref:'X1',qty:1,rate:100}]);
check('re-import ok', imp2.ok===true);
const d2=await listBOQ(env,'p1');
check('replaced not appended', d2.lines.length===1, 'lines='+d2.lines.length);

// set billed on a section
await setBilled(env,'p1',{section:'X',billed_pct:50});
const d3=await listBOQ(env,'p1');
check('billed updated', d3.lines[0].billed_pct===50);

// guards
check('rejects no rows', !!(await importBOQ(env,'p1',[])).error);
check('rejects no project', !!(await importBOQ(env,'',rows)).error);

console.log(fails?('\\n'+fails+' FAILED'):'\\nall passed');
process.exit(fails?1:0);
