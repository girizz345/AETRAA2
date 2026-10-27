// Template storage: save / list / fetch / delete, with and without a bucket.
//   node tools/test-templates-store.mjs
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { zipSync, strToU8 } from 'fflate';
import { saveTemplate, listTemplates, getTemplateBytes, deleteTemplate, b64ToBytes, bytesToB64, DOC_TYPES } from '../src/templates-store.js';
import { fillTemplate } from '../src/template.js';

const db = new DatabaseSync(':memory:');
db.exec(readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));
const DB = { prepare(sql){ const st=db.prepare(sql); let a=[]; const api={bind(...x){a=x;return api;},
  async all(){return {results:st.all(...a)};}, async first(){return st.get(...a)??null;}, async run(){st.run(...a);return {success:true};}}; return api; } };

let fails=0; const check=(n,c,d)=>{console.log((c?'  ok   ':'  FAIL ')+n+(d&&!c?'  — '+d:''));if(!c)fails++;};

// a tiny but valid .docx
const CT='<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>';
function docx(text){
  const doc=`<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>${text}</w:t></w:r></w:p></w:body></w:document>`;
  return zipSync({'[Content_Types].xml':strToU8(CT),'word/document.xml':strToU8(doc)},{level:6});
}
const FORM = docx('Submittal {{ref}} — {{title}} for {{project_name}}');

// ---- base64 round trip ---------------------------------------------------
check('base64 round trip', (()=>{ const b=bytesToB64(FORM); const back=b64ToBytes(b); return back.length===FORM.length && back[0]===FORM[0]; })());

// ---- 1. no bucket bound: stored in the database -------------------------
const envNoBucket = { DB };
let s = await saveTemplate(envNoBucket, 'p1', 'submittal', 'DEC-Submittal.docx', FORM, 'AETRAA Admin');
check('saves without a bucket', s.ok===true, JSON.stringify(s));
check('falls back to the database', s.stored==='database', s.stored);
check('records the placeholders found', ['ref','title','project_name'].every(t=>s.tokens.includes(t)), JSON.stringify(s.tokens));

let list = await listTemplates(envNoBucket,'p1');
check('listed', list.length===1 && list[0].doc_type==='submittal');
check('list carries tokens', list[0].tokens.includes('ref'));
check('list reports where it is stored', list[0].stored==='database');

let got = await getTemplateBytes(envNoBucket,'p1','submittal');
check('fetched back from the database', !!got && got.bytes.length===FORM.length);

// and it still fills correctly after a storage round trip
const f = fillTemplate(got.bytes, { ref:'SUB-001', title:'Paint', project_name:'NAF Tower' });
check('round-tripped template still fills', f.ok===true && !!f.bytes, JSON.stringify(f&&f.error));

// ---- 2. re-upload replaces, never duplicates ----------------------------
s = await saveTemplate(envNoBucket,'p1','submittal','DEC-Submittal-RevB.docx', docx('{{ref}} rev B'), 'AETRAA Admin');
check('re-upload ok', s.ok===true);
list = await listTemplates(envNoBucket,'p1');
check('replaced not duplicated', list.length===1, 'count='+list.length);
check('new filename stored', list[0].filename==='DEC-Submittal-RevB.docx');

// ---- 3. a second document type lives alongside --------------------------
await saveTemplate(envNoBucket,'p1','rfi','DEC-RFI.docx', docx('RFI {{ref}}'), 'AETRAA Admin');
list = await listTemplates(envNoBucket,'p1');
check('two document types', list.length===2, 'count='+list.length);

// ---- 4. projects are separate ------------------------------------------
await saveTemplate(envNoBucket,'p2','submittal','Other.docx', docx('{{ref}}'), 'AETRAA Admin');
check('other project unaffected', (await listTemplates(envNoBucket,'p1')).length===2);
check('second project has its own', (await listTemplates(envNoBucket,'p2')).length===1);

// ---- 5. with a bucket bound: stored in the bucket -----------------------
const bucket = new Map();
const envBucket = { DB, DRAWINGS: {
  async put(k,v){ bucket.set(k, new Uint8Array(v)); },
  async get(k){ const v=bucket.get(k); return v?{ async arrayBuffer(){ return v.buffer.slice(v.byteOffset, v.byteOffset+v.byteLength); } }:null; },
  async delete(k){ bucket.delete(k); },
} };
s = await saveTemplate(envBucket,'p3','wir','WIR.docx', docx('WIR {{ref}} {{Location}}'), 'AETRAA Admin');
check('saves to the bucket', s.ok===true && s.stored==='bucket', JSON.stringify(s));
check('bucket actually holds it', bucket.size===1);
got = await getTemplateBytes(envBucket,'p3','wir');
check('fetched back from the bucket', !!got && got.bytes.length>0);
check('bucket copy still fills', fillTemplate(got.bytes,{ref:'WIR-1',Location:'L5'}).ok===true);

// ---- 6. delete ----------------------------------------------------------
check('delete ok', (await deleteTemplate(envBucket,'p3','wir')).ok===true);
check('gone from the list', (await listTemplates(envBucket,'p3')).length===0);
check('removed from the bucket too', bucket.size===0);

// ---- 7. refusals --------------------------------------------------------
check('refuses a non-docx', !!(await saveTemplate(envNoBucket,'p1','submittal','x.docx', strToU8('not a zip'),'A')).error);
check('refuses an unknown document type', !!(await saveTemplate(envNoBucket,'p1','nonsense','x.docx', FORM,'A')).error);
check('refuses an empty file', !!(await saveTemplate(envNoBucket,'p1','rfi','x.docx', new Uint8Array(0),'A')).error);
check('refuses with no project', !!(await saveTemplate(envNoBucket,'','rfi','x.docx', FORM,'A')).error);
check('missing template returns nothing', (await getTemplateBytes(envNoBucket,'p1','ipc'))===null);
check('doc types published', !!DOC_TYPES.submittal && !!DOC_TYPES.ipc);

console.log(fails?('\n'+fails+' FAILED'):'\nall passed');
process.exit(fails?1:0);
