// Authorities per emirate → authority records on the project.
//   node tools/test-authorities.mjs
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { AUTHORITIES, emirateFor, seedAuthorities } from '../src/authorities.js';
import { createRecord, listRecords, ensureRecordsTable } from '../src/records.js';

const db = new DatabaseSync(':memory:');
db.exec(readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));
const DB = { prepare(sql){ const st=db.prepare(sql); let a=[]; const api={bind(...x){a=x;return api;},
  async all(){return {results:st.all(...a)};}, async first(){return st.get(...a)??null;}, async run(){st.run(...a);return {success:true};}}; return api; } };
const env={DB};
let fails=0; const check=(n,c,d)=>{console.log((c?'  ok   ':'  FAIL ')+n+(d&&!c?'  — '+d:''));if(!c)fails++;};

// ---- the library --------------------------------------------------------
check('Dubai list present', (AUTHORITIES['Dubai']||[]).length>=8);
check('Abu Dhabi list present', (AUTHORITIES['Abu Dhabi']||[]).some(a=>a.code==='ADDC'));
check('Sharjah has SEWA', (AUTHORITIES['Sharjah']||[]).some(a=>a.code==='SEWA'));
check('federal list present', (AUTHORITIES['Federal / any emirate']||[]).some(a=>a.code==='GCAA'));
check('every entry has code/name/scope', Object.values(AUTHORITIES).every(l=>l.every(a=>a.code&&a.name&&a.scope)));

// ---- emirate detection --------------------------------------------------
check('detects Dubai', emirateFor('Wadi Al Safa 3, Dubai')==='Dubai');
check('detects Abu Dhabi', emirateFor('Al Reem Island, Abu Dhabi')==='Abu Dhabi');
check('detects Sharjah', emirateFor('Muwaileh, Sharjah')==='Sharjah');
check('detects RAK by abbreviation', emirateFor('Al Hamra, RAK')==='Ras Al Khaimah');
check('defaults to Dubai when unknown', emirateFor('')==='Dubai');

// ---- seeding ------------------------------------------------------------
await ensureRecordsTable(env);
const res = await seedAuthorities(env,'p1',[
  {code:'DEWA', name:'DEWA', scope:'Power & water — substation', due:'2026-09-10'},
  {code:'DCD',  name:'Dubai Civil Defence', scope:'Fire & life safety'},
], createRecord, 'AETRAA Admin');
check('seeded ok', res.ok===true, JSON.stringify(res));
check('two added', res.added.length===2);
check('refs issued', res.added.every(a=>/^AUTH-\d+$/.test(a.ref)), JSON.stringify(res.added));

const recs = await listRecords(env,'p1','authority');
check('records stored', recs.length===2);
const dewa = recs.find(r=>r.title==='DEWA');
check('authority name kept', !!dewa);
check('scope stored', dewa.data.Scope==='Power & water — substation');
check('code stored', dewa.data.Code==='DEWA');
check('action date carried to due', dewa.due==='2026-09-10', String(dewa.due));
check('has a workflow', Array.isArray(dewa.workflow) && dewa.workflow.length>0);
check('opens in a live state', !!dewa.status);

// adding more later appends rather than replacing
const more = await seedAuthorities(env,'p1',[{code:'RTA',name:'RTA',scope:'Access NOC'}], createRecord,'AETRAA Admin');
check('later addition ok', more.ok===true);
check('now three', (await listRecords(env,'p1','authority')).length===3);

// a custom authority the design team invents is accepted
const custom = await seedAuthorities(env,'p1',[{code:'MASTER',name:'Master developer — Emaar',scope:'Community NOC'}], createRecord,'AETRAA Admin');
check('custom authority accepted', custom.ok===true);
check('custom stored', (await listRecords(env,'p1','authority')).some(r=>r.title==='Master developer — Emaar'));

// projects stay separate
check('other project empty', (await listRecords(env,'p2','authority')).length===0);

// ---- guards -------------------------------------------------------------
check('rejects empty selection', !!(await seedAuthorities(env,'p1',[],createRecord,'A')).error);
check('rejects no project', !!(await seedAuthorities(env,'',[{name:'X'}],createRecord,'A')).error);
check('skips nameless entries', !!(await seedAuthorities(env,'p1',[{code:'X'}],createRecord,'A')).error);

console.log(fails?('\n'+fails+' FAILED'):'\nall passed');
process.exit(fails?1:0);
