// Interim payment: hybrid valuation proposal, the certificate formula, the cycle.
//   node tools/test-ipc.mjs
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { importBOQ } from '../src/commercial.js';
import { saveProgramme } from '../src/xer.js';
import { ensureRecordsTable, createRecord, advanceRecord } from '../src/records.js';
import { proposeValuation, createIPC, sectionProgress, approvedVariations, IPC_PACK } from '../src/ipc.js';

const db = new DatabaseSync(':memory:');
db.exec(readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));
const DB = { prepare(sql){ const st=db.prepare(sql); let a=[]; const api={bind(...x){a=x;return api;},
  async all(){return {results:st.all(...a)};}, async first(){return st.get(...a)??null;}, async run(){st.run(...a);return {success:true};}}; return api; } };
const env={DB};
let fails=0; const check=(n,c,d)=>{console.log((c?'  ok   ':'  FAIL ')+n+(d&&!c?'  — '+d:''));if(!c)fails++;};

const PROJECT = { id:'p1', name:'NAF Tower', retention_pct:10, retention_limit_pct:5, payment_days:56, currency:'AED' };

// ---- a priced BOQ -------------------------------------------------------
await importBOQ(env,'p1',[
  {section:'Structure', ref:'C1', description:'Slabs',  qty:1, rate:10000000},
  {section:'MEP',       ref:'M1', description:'HVAC',   qty:1, rate:5000000},
  {section:'Finishes',  ref:'F1', description:'Paint',  qty:1, rate:5000000},
]);   // contract 20,000,000

// ---- a programme, with progress ----------------------------------------
await saveProgramme(env,'p1',[
  {id:'A1', name:'Slab works',  wbs:'Structure', discipline:'Civil', weight:100, kind:'site', planned_start:'2026-01-01'},
  {id:'A2', name:'HVAC install',wbs:'MEP',       discipline:'MEP',   weight:100, kind:'site', planned_start:'2026-02-01'},
],{replace:true});
// site reports 60% on Structure, 20% on MEP
const upd=(aid,pct)=>db.prepare(`INSERT INTO updates (project_id,activity_id,report_date,pct,source,created_at) VALUES (?,?,?,?,'site',?)`).run('p1',aid,'2026-03-01',pct,'2026-03-01T00:00:00Z');
upd('A1',60); upd('A2',20);

const prog = await sectionProgress(env,'p1');
check('section progress from programme', prog['structure']===60 && prog['mep']===20, JSON.stringify(prog));

// ---- the proposal -------------------------------------------------------
const prop = await proposeValuation(env,'p1',PROJECT);
check('proposal ok', prop.ok===true, JSON.stringify(prop.error));
check('one line per BOQ line', prop.lines.length===3);
const st=prop.lines.find(l=>l.section==='Structure');
check('Structure proposed from progress', st.proposed_pct===60, String(st.proposed_pct));
check('Structure marked as programme-linked', st.source==='programme');
const fin=prop.lines.find(l=>l.section==='Finishes');
check('unlinked line flagged for the QS', fin.linked===false && /QS to set/.test(fin.source), fin.source);
check('unlinked counted', prop.unlinked===1);
// 10m*60% + 5m*20% + 5m*0% = 6,000,000 + 1,000,000 = 7,000,000
check('proposed work done', prop.totals.proposed_work_done===7000000, String(prop.totals.proposed_work_done));
check('contract total', prop.totals.contract===20000000);

// ---- the QS review gate -------------------------------------------------
const noReview = await createIPC(env,'p1',PROJECT,{ lines: prop.lines.map(l=>({amount:l.amount,pct:l.proposed_pct})) },'QS');
check('REFUSES a certificate without QS review', !!noReview.error, JSON.stringify(noReview));
check('refusal explains why', /QS must review/.test(noReview.error||''), noReview.error);

// ---- certificates -------------------------------------------------------
// The money, the checks, the road to payment and the pack are tested in
// tools/test-ipc-step5.mjs (Step 5 replaced the typed-in variations and advance
// figures with approved variation records and the contract's recovery terms).
const r1 = await createIPC(env,'p1',PROJECT,{ lines: prop.lines.map(l=>({key:l.key,pct:l.proposed_pct})), reviewed:true },'QS');
check('a certificate needs its period', /Enter the period/.test(r1.error||''), r1.error);

// ---- variations come from approved records only ------------------------
await ensureRecordsTable(env);
const v1 = await createRecord(env,'p1',{type:'variation',title:'Coral pond',data:{'Estimated cost (AED)':'214000'}},'QS');
const v2 = await createRecord(env,'p1',{type:'variation',title:'Facade upgrade',data:{'Estimated cost (AED)':'880000'}},'QS');
let vars = await approvedVariations(env,'p1');
check('variations listed', vars.length===2);
check('none approved while in workflow', vars.every(v=>v.approved===false), JSON.stringify(vars.map(v=>v.approved)));
// push one to the end of its workflow, the client's reply recorded as Code A
for (let i=0;i<3;i++) await advanceRecord(env,'p1',{ref:v1.ref},'Director');
await advanceRecord(env,'p1',{ref:v1.ref,status:'Code A — Approved'},'DC');
vars = await approvedVariations(env,'p1');
check('approved variation detected', vars.find(v=>v.ref===v1.ref).approved===true, JSON.stringify(vars));
check('unapproved stays out', vars.find(v=>v.ref===v2.ref).approved===false);

// ---- guards -------------------------------------------------------------
check('rejects a valuation with no BOQ', !!(await createIPC(env,'p_none',PROJECT,{lines:[],reviewed:true,period_from:'2026-01-01',period_to:'2026-01-31'},'QS')).error);
check('proposal needs a BOQ', !!(await proposeValuation(env,'p_none',PROJECT)).error);
check('the pack lists the agreed documents', IPC_PACK.some(d=>d.id==='valuation') && IPC_PACK.some(d=>d.id==='photos'));

console.log(fails?('\n'+fails+' FAILED'):'\nall passed');
process.exit(fails?1:0);
