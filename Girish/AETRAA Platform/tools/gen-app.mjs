// Generate src/html/app.js — the live app shell — from the design prototype
// dashboard-design.html, so the live app IS the design (same look, same
// sidebar navigation, every window), booted with the real signed-in user and
// fed live programme data.
import { readFileSync, writeFileSync } from 'node:fs';
import { NOTIFY_UI } from '../src/html/notify-ui.js';

let html = readFileSync(new URL('../dashboard-design.html', import.meta.url), 'utf8');

// 0) Strip the design's worked-example table rows.
//
// The dashboards embed literal rows — row('ACT-118', [...]), row('SUB-074', …) —
// inside their HTML. They are indistinguishable from real documents on screen
// and invite someone to chase them, so they are removed from the source before
// it is embedded. Rows built from real data call row(x.ref, …) with a variable
// and are therefore untouched. A bracket-aware scan is used rather than a
// regular expression so a stray ] inside a cell cannot truncate the wrong span.
const SAMPLE_REF = /^(ACT|SUB|MAR|AR|ST|TN|LTR|IPA|IPC|WIR|MIR|NCR|PTW|CERT|VO|EOT|DEWA|DCD|DM|RTA|RFI|BOQ|MR|OBS|INC|USR|AUTH|GRN)-/;
function stripSampleRows(src) {
  let out = '', i = 0, removed = 0;
  while (i < src.length) {
    const at = src.indexOf("row('", i);
    if (at === -1) { out += src.slice(i); break; }
    const q = src.indexOf("'", at + 5);
    const ref = src.slice(at + 5, q);
    if (q === -1 || !SAMPLE_REF.test(ref)) { out += src.slice(i, at + 5); i = at + 5; continue; }
    // walk forward from row( balancing brackets, respecting quoted strings
    let j = at + 3, depth = 0, quote = null, started = false;
    for (; j < src.length; j++) {
      const c = src[j];
      if (quote) { if (c === '\\') { j++; continue; } if (c === quote) quote = null; continue; }
      if (c === "'" || c === '"') { quote = c; continue; }
      if (c === '(' || c === '[') { depth++; started = true; continue; }
      if (c === ')' || c === ']') { depth--; if (started && depth === 0) { j++; break; } }
    }
    let end = j;
    while (end < src.length && /\s/.test(src[end])) end++;
    if (src[end] === '+') end++;                  // drop the concatenation too
    out += src.slice(i, at);
    i = end; removed++;
  }
  return { src: out, removed };
}
const stripped = stripSampleRows(html);
html = stripped.src;
console.log('  stripped ' + stripped.removed + ' worked-example rows from the design');

// 1) Boot straight into the app: hide the demo landing, show the app.
html = html.replace('<div class="login" id="login">', '<div class="login hide" id="login">');
html = html.replace('<div class="app hide" id="app">', '<div class="app" id="app">');
// Method statements: their own register number (MS-001) and their own template.
// Raised from the Design dashboard beside a submittal, and from the site
// engineer's and QA/QC's action bars.
{
  const n0 = html.length;
  html = html.replace('<button class="prim" data-new="submittal">＋ Submittal</button>',
    '<button class="prim" data-new="submittal">＋ Submittal</button><button class="prim" data-new="ms">＋ Method statement</button>');
  html = html.replace('<button class="prim" data-new="mr">＋ Order material</button>',
    '<button class="prim" data-new="mr">＋ Order material</button><button data-new="ms">＋ Method statement</button>');
  html = html.replace('<button data-new="ncrform">＋ NCR</button>',
    '<button data-new="ncrform">＋ NCR</button><button data-new="ms">＋ Method statement</button>');
  if (html.length === n0) throw new Error('method statement buttons: design markup not found');
}

// 2) The live-boot script: real identity, real project list, live programme
//    data, real logout. Plain ES5, no backticks / ${ so it survives the
//    template literal below.
const BOOT = `
<script>window.__ME__ = __ME_JSON__;</script>
<script>
(function(){
  var ME = window.__ME__ || {};
  if(!ME.email){ return; }
  // Replace the design's demo accounts with the real signed-in user; real
  // teammates are added by loadPeople() below.
  try{ Object.keys(ACCOUNTS).forEach(function(k){ delete ACCOUNTS[k]; }); }catch(e){}
  try{
    ACCOUNTS[ME.email] = {name:ME.name, av:ME.av, title:ME.title, roles:ME.roles,
      multi:(ME.roles && ME.roles.length>1), siteDiscipline:ME.siteDiscipline};
  }catch(e){}
  // Notify the team: Document Control, the PM and the Principal may; Document
  // Control is offered it by itself after every upload.
  window.__NOTIFY__ = { can: !!ME.mayNotify, auto: (ME.roles || []).indexOf('dc') >= 0 };
  // The P6 loop — download progress for P6, upload the updated .xer — lives on
  // its own page; Planning, the PM and the Principal reach it from the sidebar.
  try{
    var planner=(ME.roles||[]).some(function(r){ return r==='planning'||r==='pm'||r==='principal'; });
    if(planner){
      ['planning','pm','principal'].forEach(function(k){
        if(NAV[k] && NAV[k][0] && NAV[k][0][1]) NAV[k][0][1].push(['⇅','P6 update & export','']);
      });
    }
  }catch(e){}
  // ---- MODULES: what this project has switched on ------------------------
  // A module that is off loses its dashboard and its entries in the Principal's
  // and PM's sidebars. The server refuses its API as well; this only keeps the
  // screen honest about it.
  try{
    var OFF={}; (ME.dashOff||[]).forEach(function(d){ OFF[d]=1; });
    if(Object.keys(OFF).length){
      var baseAccessFor=accessFor;
      accessFor=function(email){ return baseAccessFor(email).filter(function(v){ return !OFF[v[0]]; }); };
      var NAV_MODULE={'Cashflow / IPC':'commercial','Claims & variations':'commercial','Quality (portfolio)':'qaqc',
        'Safety (portfolio)':'hse','Look-ahead':'planning','Drawings':'dc','RFIs':'design','Submittals':'design',
        'Inspections':'qaqc','NCRs':'qaqc','Variations':'commercial','IPC / payments':'commercial','HSE':'hse',
        'Subcontractors':'subcon','Letters':['design','commercial']};
      var navOff=function(label){ var m=NAV_MODULE[label]; if(!m) return false;
        return (typeof m==='string') ? !!OFF[m] : m.every(function(x){ return OFF[x]; }); };
      ['principal','pm'].forEach(function(k){
        if(!NAV[k]) return;
        NAV[k]=NAV[k].map(function(g){ return [g[0], g[1].filter(function(it){ return !navOff(it[1]); })]; })
                     .filter(function(g){ return g[1].length; });
      });
    }
    // Nobody is left on a blank screen: a person whose only function is switched
    // off for this project is told so, and can still switch project.
    if(!accessFor(ME.email).length){
      window.__NO_MODULE__=true;
      document.addEventListener('DOMContentLoaded',function(){
        var box=document.createElement('div');
        box.setAttribute('style','max-width:520px;margin:12vh auto;padding:28px;border:1px solid #ccd;border-radius:14px;font:15px/1.5 system-ui;background:#fff;color:#222');
        box.innerHTML='<h2 style="margin:0 0 10px;font-size:18px">Not switched on for this project</h2>'+
          '<p>Your role on <b>'+String(ME.projectName||'this project').replace(/</g,'&lt;')+'</b> belongs to a module this project does not use. '+
          'Ask your Project Manager, or pick another project.</p>'+
          ((ME.projects||[]).length>1 ? '<p>'+ME.projects.map(function(p){ return '<a href="#" data-goproj="'+p.id+'" style="display:inline-block;margin:4px 8px 0 0">'+String(p.name).replace(/</g,'&lt;')+'</a>'; }).join('')+'</p>' : '')+
          '<p><a href="/api/logout">Sign out</a></p>';
        document.body.innerHTML=''; document.body.appendChild(box);
        box.addEventListener('click',function(ev){ var a=ev.target.closest('[data-goproj]'); if(!a) return; ev.preventDefault();
          fetch('/api/project?p='+encodeURIComponent(a.getAttribute('data-goproj')),{cache:'no-store'}).then(function(){ location.reload(); }); });
      });
    }
  }catch(e){}
  // ---- P0: NO INVENTED DATA EVER REACHES A REAL USER ---------------------
  // The design prototype ships worked examples in every register, activity list
  // and record. On a live project those are fabrications, and the register
  // "Export to Excel" would write them into a file someone could send to a
  // consultant. Everything is emptied here, before the first render; only real
  // data loaded from the project is allowed to put anything back.
  function clearSampleData(){
    try{ if(typeof REG!=='undefined'){ Object.keys(REG).forEach(function(k){ REG[k].rows=[]; }); } }catch(e){}
    try{ if(typeof ACTIVITIES!=='undefined'){ ACTIVITIES.length=0; } }catch(e){}
    try{ if(typeof PROJECTS!=='undefined'){ Object.keys(PROJECTS).forEach(function(k){ delete PROJECTS[k]; }); } }catch(e){}
    try{ if(typeof RECORDS!=='undefined'){ Object.keys(RECORDS).forEach(function(k){ delete RECORDS[k]; }); } }catch(e){}
  }
  clearSampleData();
  // The activity feeds and sign-off queues are written into the design as
  // literal examples (DEWA-SUB overdue, SUB-074 returned, ACT-118 to sign off).
  // They carry references that look real and invite someone to act on them, so
  // both generators are silenced until they are fed by the project.
  try{
    if(typeof feed==='function'){
      window.__feedReal=feed;
      window.feed=function(){ return '<div class="mini">No activity recorded on this project yet.</div>'; };
    }
  }catch(e){}
  try{
    // The real item renderer is kept for queues built from live records.
    if(typeof q==='function'){ window.__qReal=q; window.q=function(){ return ''; }; }
  }catch(e){}
  // Headline counters written into the design as literals — "AED 66.1m certified
  // to date", "AED 4.41m IPA-05 (net)" — are invented money against invented
  // documents. Counters computed from live data are plain numbers and percentages,
  // so anything carrying a currency or a document reference is blanked instead.
  try{
    if(typeof kpi==='function'){
      var _kpi_orig=kpi;
      var FAKE=/AED|\\b(IPA|IPC|VO|SUB|ACT|MAR|WIR|NCR|LTR)-\\d+/;
      window.kpi=function(v,l,c){
        if(FAKE.test(String(v))||FAKE.test(String(l))){
          return _kpi_orig('—', String(l).replace(/\\b[A-Z]{2,4}-\\d+\\b/g,'').replace(/\\s+/g,' ').trim()||'—', '');
        }
        return _kpi_orig(v,l,c);
      };
    }
  }catch(e){}
  // An empty register must say so, not show an empty grid that looks broken.
  try{
    if(typeof regTable==='function'){
      var _regTable_orig=regTable;
      window.regTable=function(kind){
        if(kind==='drawings'){ if(!LIVE.drawTried) drawFetch().then(function(){ try{render();}catch(e){} }); applyDrawingRows(); }
        if(kind==='boq'){ if(!BOQ_TRIED) boqFetch().then(function(){ try{render();}catch(e){} }); applyBoqRows(); }
        // The payments register is the live IPC screen, wherever it is opened from.
        if(kind==='ipc' && typeof window.__ipcView==='function') return window.__ipcView();
        var r=(typeof REG!=='undefined')?REG[kind]:null;
        if(r && (!r.rows || !r.rows.length)){
          return '<div class="card"><h2>'+r.title+'</h2>'+
            '<div class="mini">Nothing recorded on this project yet. Items appear here as they are raised.</div></div>';
        }
        return _regTable_orig(kind);
      };
    }
  }catch(e){}
  function initials(n){ var p=String(n||'').trim().split(/\\s+/); return (((p[0]||'')[0]||'')+((p[1]||'')[0]||'')).toUpperCase()||'U'; }
  var ROLE_FROM={owner:'principal',manager:'pm',lead:'planning',site:'site',view:'consultant'};
  function fnLabel(k){ return (typeof ROLE!=='undefined'&&ROLE[k])?ROLE[k].label:k; }
  // Real people -> ACCOUNTS, so the Team & Access list shows the actual team.
  function loadPeople(){
    return fetch('/api/people',{cache:'no-store'}).then(function(r){return r.ok?r.json():null;}).then(function(d){
      if(d&&d.people){ d.people.forEach(function(u){ if(!u.email) return;
        var fns=(u.functions&&u.functions.length)?u.functions:[ROLE_FROM[u.role]||'consultant'];
        ACCOUNTS[u.email]={name:u.name, av:initials(u.name), title:fns.map(fnLabel).join(' + '),
          roles:fns, multi:fns.length>1, siteDiscipline:(u.scope&&u.scope.groups&&u.scope.groups[0])||'', _id:u.id, _status:u.status};
      }); }
    }).catch(function(){});
  }
  // Function label (as the invite form lists it) -> function key.
  var FN_BY_LABEL={'Principal':'principal','Project Manager':'pm','Planning':'planning','Planning Engineer':'planning',
    'Site Engineer':'site','Document Control':'dc','Design':'design','Design & Documents':'design',
    'QA/QC':'qaqc','QA / QC':'qaqc','HSE':'hse','Commercial':'commercial','Contracts & Commercial':'commercial',
    'Procurement':'procurement','Finance':'finance','Subcontractor':'subcon','Subcontractors':'subcon','Consultant':'consultant'};
  // Real projects in the locked selector.
  try{
    var sel=document.getElementById('projSel');
    if(sel && ME.projects && ME.projects.length){
      sel.innerHTML=ME.projects.map(function(p){return '<option value="'+p.id+'">'+String(p.name).replace(/</g,'&lt;')+'</option>';}).join('');
      var pn=document.getElementById('projName'); if(pn) pn.textContent=ME.projectName||ME.projects[0].name;
      sel.addEventListener('change',function(){ fetch('/api/project?p='+encodeURIComponent(this.value),{cache:'no-store'}).then(function(){location.reload();}); });
    }
    var ps=document.getElementById('projSub'); if(ps && ME.projectSub) ps.textContent=ME.projectSub;
  }catch(e){}
  // Real sign-out.
  try{ var lo=document.getElementById('logout'); if(lo){ lo.addEventListener('click',function(ev){ ev.stopImmediatePropagation(); ev.preventDefault(); location.href='/api/logout'; }, true); } }catch(e){}
  // Live programme -> the design's ACTIVITIES array, so the progress-driven
  // panels (Planning, Site, PM, Principal progress) show real numbers.
  function mapAct(d){
    if(!d || !d.activities) return;
    // ref is the planner's own activity code, because that is what /api/update
    // is keyed on. Using the WBS here put the section name on every row and
    // sent an id the server has never heard of.
    var live=d.activities.filter(function(a){ return Number(a.level==null?1:a.level) > 0; })
      .map(function(a){
      var c=(d.current||{})[a.id]||{}; var pct=c.pct||0; var st=(''+(c.status||'')).toLowerCase();
      var tag=(st==='delayed'||st==='at_risk'||st==='on_hold')?'critical':'';
      return {ref:a.id, name:a.name, floor:a.floor||a.wbs||'', pct:pct,
              disc:a.trade_group||a.discipline||a.trade||'Other', tag:tag,
              wbs:a.wbs||'', start:a.planned_start||'', finish:a.planned_finish||'',
              status:st||''};
    });
    if(live.length && typeof ACTIVITIES!=='undefined'){ ACTIVITIES.length=0; Array.prototype.push.apply(ACTIVITIES, live); }
  }

  // ---- LIVE RECORDS ENGINE ----------------------------------------------
  // Which "＋ New …" form maps to which stored record type.
  var FORM_TO_TYPE = {submittal:'submittal', material:'material', rfi:'rfi', wir:'wir', mir:'mir',
    ncrform:'ncr', variation:'variation', letter:'letter', ptw:'ptw', obs:'obs', incident:'incident', mr:'mr', cert:'cert', ms:'ms', incoming:'incoming'};
  // The method statement form (the design had none: they were filed as submittals).
  try{
    if(typeof FORMS!=='undefined' && !FORMS.ms){
      FORMS.ms={ title:'New method statement', ref:'MS-', to:'Consultant (issued by Document Control)',
        fields:[['Title','text','',1],['Activity / scope of work','textarea','',1],
          ['Discipline','select','Civil|Structural|Architectural|MEP|Finishes|Facade|External works',0],
          ['Location','text','',0],['Related ITP','text','',0],['Risk assessment ref','text','',0],
          ['Required approval by','date','',0],['Attachments (method statement, risk assessment)','file','',1]],
        wf:['Method statement prepared','QA/QC & HSE review','PM approves to submit','Document Control issues to consultant','Consultant status recorded (Code A/B/C)'] };
    }
  }catch(e){}
  // STEP 7: incoming correspondence, logged by Document Control, and a reply
  // letter that says which incoming letter it answers.
  try{
    if(typeof FORMS!=='undefined' && !FORMS.incoming){
      FORMS.incoming={ title:'Log incoming letter', ref:'IN-', to:'the person it is sent to for action',
        fields:[['From','text','',1],['Their reference','text','',0],['Letter date','date','',0],['Date received','date','',0],
          ['Subject','text','',1],['Type','select','Letter|Instruction|Notice|Email|Transmittal|Other',0],
          ['Action by','select','Project Manager|Contracts & Commercial|Design & Documents|Planning|QA / QC|HSE|Site Engineer|Procurement|Finance|Document Control|Principal|For information only',0],
          ['Reply by','date','',0],['Scanned letter','file','',1]],
        wf:['Logged by Document Control','Reply issued, or closed with the reason'] };
    }
    // STEP 9: every classification the monthly HSE figures count, the day it
    // happened (not the day it was typed in), and the days lost.
    if(typeof FORMS!=='undefined' && FORMS.incident && !FORMS.incident.fields.some(function(f){ return f[0]==='Date of incident'; })){
      FORMS.incident.fields[0] = ['Type','select','Near-miss|First aid|Medical treatment|Restricted work|Lost-time injury|Fatality|Property damage|Environmental|Dangerous occurrence',0];
      FORMS.incident.fields.splice(1, 0, ['Date of incident','date','',1], ['Days lost (lost-time injury)','text','',0]);
    }
    if(typeof FORMS!=='undefined' && FORMS.letter && !FORMS.letter.fields.some(function(f){ return f[0]==='In reply to'; })){
      FORMS.letter.fields.splice(3, 0, ['In reply to','text','',0]);
    }
  }catch(e){}
  // Which register table (REG bucket) each record type appears in.
  // Every record type must land in a register. Variations, material requests
  // and RFIs used to save perfectly well and then appear nowhere — raised,
  // numbered, stored, and invisible to the person who had to act on them.
  var TYPE_TO_REG = {submittal:'submittals', material:'matapp', wir:'inspections', mir:'inspections',
    ncr:'ncr', letter:'letters', ptw:'permits', obs:'hseobs', incident:'hseobs', authority:'authority',
    variation:'variations', rfi:'rfi', mr:'mr', cert:'certs', ms:'submittals', incoming:'letters'};
  function pick(o){ for(var i=1;i<arguments.length;i++){ if(o && o[arguments[i]]) return o[arguments[i]]; } return ''; }
  function daysSince(iso){ if(!iso) return ''; var d=Math.floor((Date.now()-Date.parse(iso))/86400000); return isFinite(d)?(d+' d'):''; }
  // Build a REG row (matching each register's own cell() field names) from a record.
  // How long an open record has been waiting on its current step, in days,
  // from when the last step was signed.
  function waitingDays(r){
    var wf=r.workflow||[], last='';
    for(var i=0;i<wf.length;i++){ if(wf[i]&&wf[i].state==='done'&&/^[0-9]{4}-[0-9]{2}-[0-9]{2}/.test(String(wf[i].when||''))) last=String(wf[i].when).slice(0,10); }
    if(!last) last=r.sub||'';
    var t=Date.parse(last); if(!isFinite(t)) return null;
    return Math.max(0, Math.floor((Date.parse(liveToday())-t)/86400000));
  }
  function recRow(r, bucket){
    var d=r.data||{};
    var row={ref:r.ref, sub:r.sub, due:r.due, st:r.status, cls:r.cls, _rec:r};
    // Step 2: every open row says how long it has waited, and an overdue one says so first.
    if(!isClosed(r)){
      var wd=waitingDays(r);
      var late=r.due && r.due < liveToday();
      if(late){ row.st='Overdue · '+(r.status||''); row.cls='late'; }
      if(wd!==null && wd>0) row.st=row.st+' · '+wd+'d';
    }
    if(bucket==='submittals'){ row.title=pick(d,'Title')||r.title; row.type=(r.type==='ms'?'Method statement':(pick(d,'Type','Discipline')||'Submittal')); }
    else if(bucket==='matapp'){ row.title=pick(d,'Material')||r.title; row.type=pick(d,'Spec section'); }
    else if(bucket==='inspections'){ row.title=pick(d,'Activity / element','Material / batch')||r.title; row.type=pick(d,'Discipline')||(r.type==='mir'?'Material':'Civil'); }
    else if(bucket==='ncr'){ row.title=pick(d,'Non-conformance')||r.title; row.age=daysSince(r.created_at); }
    else if(bucket==='letters'){
      row.title=pick(d,'Subject')||r.title;
      row.type = r.type==='incoming' ? ('In · '+(pick(d,'From')||'')+(pick(d,'Their reference')?' · '+pick(d,'Their reference'):''))
        : (pick(d,'Type')||'Letter')+' (out)'+(pick(d,'In reply to')?' · re '+pick(d,'In reply to'):'');
    }
    else if(bucket==='permits'){ row.title=pick(d,'Activity / type')||r.title; row.type=pick(d,'Location'); }
    else if(bucket==='hseobs'){ row.title=pick(d,'Finding','What happened')||r.title; row.risk=pick(d,'Risk','Type')||(r.type==='incident'?'Incident':'Low'); }
    else if(bucket==='authority'){ row.title=pick(d,'Authority')||r.title; row.type=pick(d,'Scope','Ref')||r.title; }
    else if(bucket==='variations'){
      row.title=pick(d,'Description')||r.title;
      row.val=pick(d,'Estimated cost (AED)')||'—';
      var t=pick(d,'Time effect (days)');
      row.time=t?('+'+String(t).replace(/^\\+/,'')+' d'):'—';
    }
    else if(bucket==='rfi'){
      row.title=pick(d,'Subject')||r.title;
      row.type=pick(d,'Discipline')||'—';
      row.pri=pick(d,'Priority')||'Normal';
    }
    else if(bucket==='certs'){
      row.title=pick(d,'Certificate')||r.title;
      row.type=pick(d,'Issued by')||'\u2014';
      row.due=pick(d,'Expires')||r.due||null;
    }
    else if(bucket==='mr'){
      row.title=pick(d,'Material')||r.title;
      row.qty=pick(d,'Quantity')||'—';
      row.forloc=pick(d,'For (location)')||'—';
    }
    else { row.title=r.title; row.type=r.type.toUpperCase(); }
    return row;
  }
  // Two registers the design never had, because the design never showed these
  // records anywhere. Built to the same shape as its own.
  function addMissingRegisters(){
    if(typeof REG==='undefined') return;
    if(!REG.rfi){
      REG.rfi={ title:'RFI register', sched:true,
        cols:['Ref','Subject','Discipline','Priority','Reply by','Status'],
        csvCols:['Ref','Subject','Discipline','Priority','Reply by','Status'],
        note:'Requests for information raised to the consultant. An RFI with no reply is a decision nobody has taken — the reply-by date is what makes it chaseable.',
        rows:[],
        cell:function(x){return ['<span class="ref">'+x.ref+'</span>',x.title,x.type||'—',
          (x.pri==='Urgent'?pill('Urgent','late'):(x.pri||'Normal')),x.due||'—',pill(x.st,x.cls)];},
        csv:function(x){return [x.ref,x.title,x.type||'',x.pri||'',x.due||'',x.st];} };
    }
    if(!REG.mr){
      REG.mr={ title:'Material requests', sched:true,
        cols:['Ref','Material','Quantity','For','Needed by','Status'],
        csvCols:['Ref','Material','Quantity','For','Needed by','Status'],
        note:'Raised by site without sight of the budget. The PM checks each one against the Bill of Materials before releasing it.',
        rows:[],
        cell:function(x){return ['<span class="ref">'+x.ref+'</span>',x.title,x.qty||'—',
          x.forloc||'—',x.due||'—',pill(x.st,x.cls)];},
        csv:function(x){return [x.ref,x.title,x.qty||'',x.forloc||'',x.due||'',x.st];} };
    }
  }
  addMissingRegisters();
  // And put them where the people who work them actually sit.
  // The Drawing register and the priced BOQ both have a server module and an
  // endpoint, and neither was ever routed into the register it belongs in — so
  // both read "Nothing recorded on this project yet" for ever, while the
  // counter above them claimed 48 drawings.
  var BOQ = null, BOQ_TRIED = false;
  function boqFetch(){
    BOQ_TRIED = true;
    return fetch('/api/boq', { cache: 'no-store' })
      .then(function(r){ return r.ok ? r.json() : { lines: [] }; })
      .then(function(d){ BOQ = d || { lines: [] }; applyBoqRows(); })
      .catch(function(){ BOQ = { lines: [] }; });
  }
  function applyBoqRows(){
    if (!BOQ || typeof REG === 'undefined' || !REG.boq) return;
    REG.boq.rows = (BOQ.sections || BOQ.lines || []).map(function(l){
      var billed = l.billed_pct != null ? l.billed_pct : 0;
      return { ref: l.ref || l.section || '', title: l.section || l.description || '',
               val: moneyShort(l.amount), billed: Math.round(billed) + '%',
               st: billed >= 100 ? 'Billed in full' : (billed > 0 ? 'Part billed' : 'Not billed'),
               cls: billed >= 100 ? 'ok' : (billed > 0 ? 'wp' : '') };
    });
  }
  function applyDrawingRows(){
    if (!LIVE.drawings || typeof REG === 'undefined' || !REG.drawings) return;
    REG.drawings.rows = LIVE.drawings.map(function(d){
      var late = /revise|rejected|superseded/i.test(d.status || '');
      return { ref: d.number + (d.revision ? ' Rev ' + d.revision : ''),
               title: d.title || '',
               type: (d.kind || 'Drawing') + (d.revision ? ' \u00b7 Rev ' + d.revision : ''),
               sub: (d.uploaded_at || '').slice(0, 10) || null,
               due: null,
               st: d.status || 'Current',
               cls: late ? 'late' : (/current|approved/i.test(d.status || '') ? 'ok' : 'wp'),
               _id: d.id };
    });
  }

  function installMissingRegisters(){
    if(typeof render!=='function') return;
    var orig=render;
    window.render=function(){
      orig.apply(this, arguments);
      var left=document.getElementById('leftcol');
      if(!left || typeof regTable!=='function') return;
      var r=state.role;
      var want=[];
      // RFIs are Design & Documents' work; Document Control and the consultant
      // watch them; the PM sees everything.
      if(r==='design'||r==='dc'||r==='consultant'||r==='pm'||r==='principal') want.push('rfi');
      // Material requests land with the PM and are turned into orders by Procurement.
      if(r==='procurement'||r==='pm'||r==='principal'||r==='commercial') want.push('mr');
      want.forEach(function(k){
        if(left.querySelector('[data-reg="'+k+'"]')) return;
        var d=document.createElement('div');
        d.setAttribute('data-reg', k);
        d.innerHTML=regTable(k);
        left.appendChild(d);
      });
    };
  }
  // Which refs are real, stored records. Attachments belong only to these — an
  // activity code or one of the design's own references has nothing to attach to.
  var RECBYREF = {};
  function applyRecords(recs){
    var buckets={};
    recs.forEach(function(r){ RECBYREF[r.ref]=r; });
    LIVE.records = recs.slice();
    recs.forEach(function(r){ var b=TYPE_TO_REG[r.type]; if(!b||typeof REG==='undefined'||!REG[b]) return; (buckets[b]=buckets[b]||[]).push(recRow(r,b)); });
    Object.keys(buckets).forEach(function(b){ REG[b].rows=buckets[b]; });
    // Detail map for openDetail()
    if(typeof RECORDS!=='undefined'){
      recs.forEach(function(r){
        var d=r.data||{}; var facts=[['Reference',r.ref],['Status',r.status]];
        Object.keys(d).forEach(function(k){ if(d[k]&&typeof d[k]!=='object') facts.push([k,String(d[k])]); });
        if(r.due) facts.push(['Action by',r.due]);
        if(r.created_by) facts.push(['Raised by',r.created_by]);
        RECORDS[r.ref]={ title:r.title, type:r.type.toUpperCase(), status:r.status, sc:r.cls,
          facts:facts, desc:pick(d,'Question','Body','What happened','Basis of claim','Description','Precautions taken')||'—',
          links:[], att:[],
          wf:(r.workflow||[]).map(function(s){return {st:s.st,who:s.who,state:s.state,when:s.when,sig:(s.state==='done'?[s.who,'',s.when]:null)};}),
          audit:[[r.created_by||'—','created '+r.ref,(r.created_at||'').slice(0,10)]] };
      });
    }
  }
  function loadRecords(){
    return fetch('/api/records',{cache:'no-store'}).then(function(r){return r.ok?r.json():null;})
      .then(function(d){ if(d&&d.records&&d.records.length){ try{applyRecords(d.records);}catch(e){} } })
      .catch(function(){});
  }
  // Make every "＋ New …" form actually save a real, numbered record.
  function wireCreate(){
    if(typeof genConfirm==='undefined') return;
    window.genConfirm=function(kind){
      var f=(typeof FORMS!=='undefined')?FORMS[kind]:null;
      if(!f){ return; }
      // read the form fields (shared by all create forms)
      var data={}; var pane=document.getElementById('dpane');
      var fs=pane?pane.querySelectorAll('.frm .f'):[];
      for(var i=0;i<f.fields.length && i<fs.length;i++){
        var inp=fs[i].querySelector('input,select,textarea');
        // A file field's value is "C:\fakepath\thing.pdf" — a lie, and the very
        // thing that used to be saved instead of the file. The files themselves
        // are collected below and uploaded once the record has a reference.
        if(inp && inp.type==='file') continue;
        data[f.fields[i][0]]= inp? inp.value : '';
      }
      // The design marks its required fields but never checked them, and it did
      // not matter while every field arrived pre-filled with an example. With
      // the examples gone, an untouched form would save an empty document.
      var missing=[];
      for(var q=0;q<f.fields.length && q<fs.length;q++){
        var fq=f.fields[q];
        if(!fq[3]) continue;                       // not required
        if(fq[1]==='file') continue;               // attachments are optional
        var iq=fs[q].querySelector('input,select,textarea');
        if(iq && iq.type==='file') continue;
        if(!iq || !String(iq.value||'').trim()) missing.push(fq[0]);
      }
      if(missing.length){
        // Shown in the form, beside the fields it is about — not in a browser
        // alert box that says nothing about where to look.
        var warnId='formNeeds';
        var old=document.getElementById(warnId); if(old) old.parentNode.removeChild(old);
        var bar=pane?pane.querySelector('.actbar'):null;
        var html='<div class="dwarn" id="'+warnId+'">Still needed before this can be raised: <b>'+
          missing.join('</b>, <b>')+'</b>.</div>';
        if(bar) bar.insertAdjacentHTML('beforebegin', html);
        else if(pane) pane.querySelector('.dbody').insertAdjacentHTML('afterbegin', html);
        // and mark the fields themselves
        for(var z=0;z<f.fields.length && z<fs.length;z++){
          var iz=fs[z].querySelector('input,select,textarea');
          if(!iz) continue;
          iz.style.borderColor = (missing.indexOf(f.fields[z][0])>=0) ? 'var(--bad)' : '';
        }
        return;
      }
      // Grab the chosen files now: the pane is replaced the moment this saves.
      var picked=[];
      if(pane){
        var pk=pane.querySelectorAll('input[type=file]');
        for(var j=0;j<pk.length;j++){
          for(var m=0;m<pk[j].files.length;m++) picked.push(pk[j].files[m]);
        }
      }
      // Team & Access: create a real user.
      if(kind==='assign'){
        var name=data['Full name']||''; var email=data['Email address']||'';
        if(!email){ alert('An email address is needed to invite someone.'); return; }
        var fn=FN_BY_LABEL[data['Function(s)']]||'consultant';
        var disc=data['Discipline (if site engineer)']||'';
        var groups=(disc && disc!=='—')?[disc]:[];
        var projs=(data['Projects']==='All projects')?[]:(ME.projectId?[ME.projectId]:[]);
        fetch('/api/person',{method:'POST',headers:{'Content-Type':'application/json'},
          body:JSON.stringify({name:name,email:email,functions:[fn],groups:groups,projects:projs})})
          .then(function(r){return r.json();}).then(function(res){
            if(res&&(res.ok||res.id||!res.error)){ loadPeople().then(function(){ try{render();}catch(e){} showCreated({title:'Person assigned',ref:email}); }); }
            else { alert((res&&res.error)||'Could not save the person.'); }
          }).catch(function(){ alert('Could not save the person.'); });
        return;
      }
      // Everything else is a record.
      var rtype=FORM_TO_TYPE[kind];
      if(!rtype){ return; }
      var title=data[f.fields[0][0]]||f.title;
      var wf=f.wf||null;
      fetch('/api/records',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:rtype,title:title,data:data,workflow:wf})})
        .then(function(r){return r.json();}).then(function(res){
          if(!(res&&res.ok)){ alert((res&&res.error)||'Could not save — check you are signed in.'); return; }
          try{ localStorage.removeItem(draftKey(kind)); }catch(e){}
          // The record exists and is numbered; now its files go against that number.
          return uploadAttachments(res.ref, picked, null).then(function(up){
            return loadRecords().then(function(){
              try{render();}catch(e){}
              showCreated(f,res.ref,up);
            });
          });
        }).catch(function(){ alert('Could not save.'); });
    };
  }
  function showCreated(f, ref, up){
    var pane=document.getElementById('dpane'); if(!pane) return;
    // If a file did not make it, say so here rather than let the man walk away
    // believing his inspection went out with its checklist on it.
    var att='';
    if(up && (up.done || (up.failed && up.failed.length))){
      att='<div class="note"><div class="sechd">Attachments</div>'+
        (up.done?'<div class="mini">'+up.done+' file'+(up.done===1?'':'s')+' attached to '+ref+'.</div>':'')+
        (up.failed && up.failed.length
          ? '<div class="mini" style="color:var(--bad)">Not attached: '+up.failed.join(', ')+
            ' — open '+ref+' from the register and try again.</div>'
          : '')+'</div>';
    }
    pane.innerHTML='<div class="dtop"><div class="dhrow"><div><div class="dh">'+ref+' created</div>'+
      '<div class="dref">'+f.title+' · saved to this project &amp; routed</div></div>'+
      '<button class="dclose" data-close="1">✕</button></div></div>'+
      '<div class="dbody"><div class="note"><div class="gensuccess"><div class="tick">✓</div>'+
      '<div style="font-size:15px;font-weight:700">'+ref+' created and routed for approval</div>'+
      '<div class="mini" style="margin-top:6px">Numbered, saved, and now shown in the register. Open the register to see it and move it through its workflow.</div></div></div>'+
      att+
      '<div class="actbar"><button class="prim" data-close="1">Done</button></div></div>';
    var dt=document.getElementById('detail'); if(dt) dt.classList.remove('hide');
  }

  // (The old "panels not connected" banner is gone: every panel on every
  // dashboard now reads this project’s own data.)

  // ---- P1: the PM sign-off flow, live -----------------------------------
  // The site engineer marks an activity finished; it reaches the PM here, and
  // only a real sign-off moves it on. This replaces the design's worked example
  // with the project's actual queue and makes the buttons do their job.
  var VERIFY = null;
  function loadVerify(){
    return fetch('/api/verify',{cache:'no-store'})
      .then(function(r){ return r.ok?r.json():null; })
      .then(function(d){ VERIFY = d; })
      .catch(function(){ VERIFY = null; });
  }
  function esc2(s){ return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];}); }
  function signoffTable(){
    if(!VERIFY || !VERIFY.migrated){
      return '<div class="mini">Sign-off is not switched on for this project yet.</div>';
    }
    var claims=(VERIFY.claims||[]).filter(function(c){ return (c.pct||0)>=100; });
    if(!claims.length) return '<div class="mini">Nothing waiting — every finished activity has been signed off.</div>';
    return '<table><tr><th>Ref</th><th>Activity</th><th>Section</th><th>Floor</th><th>Reported</th><th></th></tr>'+
      claims.map(function(c){
        return '<tr><td><span class="ref">'+esc2(c.wbs||c.id)+'</span></td>'+
          '<td>'+esc2(c.name)+'</td><td>'+esc2(c.trade_group||c.trade||'—')+'</td>'+
          '<td>'+esc2(c.floor||'—')+'</td><td class="mini">'+esc2(c.report_date||'')+'</td>'+
          '<td><button class="prim" data-signoff="'+esc2(c.id)+'">Sign off</button> '+
          '<button class="ovr" data-query="'+esc2(c.id)+'">Query</button></td></tr>';
      }).join('')+'</table>';
  }
  function pmProgrammeTable(){
    var open=(typeof ACTIVITIES!=='undefined'?ACTIVITIES:[]).filter(function(a){ return a.pct<100; })
      .sort(function(x,y){ return (/critical/.test(y.tag||'')?1:0)-(/critical/.test(x.tag||'')?1:0) || y.pct-x.pct; });
    if(!open.length) return '<div class="mini">No open activities — load the programme to see them here.</div>';
    return '<table><tr><th>Ref</th><th>Activity</th><th>Discipline</th><th>Floor</th><th>%</th><th>Status</th></tr>'+
      open.slice(0,40).map(function(a){
        var cls=/critical/.test(a.tag||'')?'late':(a.pct>0?'wp':'warn');
        var txt=/critical/.test(a.tag||'')?'Critical':(a.pct>0?'In progress':'Not started');
        return '<tr><td><span class="ref">'+esc2(a.ref)+'</span></td><td>'+esc2(a.name)+'</td>'+
          '<td>'+esc2(a.disc||'—')+'</td><td>'+esc2(a.floor||'—')+'</td><td>'+Math.round(a.pct)+'</td>'+
          '<td>'+pill(txt,cls)+'</td></tr>';
      }).join('')+'</table>'+
      (open.length>40?'<div class="mini">Showing the 40 most pressing of '+open.length+' open activities.</div>':'');
  }
  function installLivePM(){
    if(typeof DASH==='undefined') return;
    DASH.pm = function(){
      var acts=(typeof ACTIVITIES!=='undefined'?ACTIVITIES:[]);
      var counts=(VERIFY&&VERIFY.counts)||{};
      var awaiting=counts.awaiting_complete||0;
      var inprog=acts.filter(function(a){return a.pct>0&&a.pct<100;}).length;
      var notst=acts.filter(function(a){return a.pct===0;}).length;
      var crit=acts.filter(function(a){return /critical/.test(a.tag||'');}).length;
      var overall=acts.length?Math.round(acts.reduce(function(s,a){return s+a.pct;},0)/acts.length):0;
      return {cols:6,
        bar:'Signed in as <b>Project Manager</b> — you run the job. You sign off the work the site reports as finished, and nothing goes out until you approve it: the contractor prepares it, you approve, it is submitted to the consultant / Engineer <b>for their action</b>, and the client releases payment.',
        kpis:[[String(awaiting),'To sign off','bad'],[String(inprog),'In progress','act'],
              [String(notst),'Not started',''],[String(crit),'Critical','warn'],
              [String((VERIFY&&VERIFY.counts&&VERIFY.counts.queried)||0),'Queried back',''],
              [overall+'%','Complete','']],
        left:'<div class="card"><h2>Activities finished — awaiting your sign-off <span class="r">'+awaiting+'</span></h2>'+
            signoffTable()+
            '<div class="mini">The site engineer marks an activity finished; it counts toward progress and payment only once you verify the work. Query it back if it is not right — the engineer sees your note.</div></div>'+
          '<div class="card"><h2>Programme — in progress &amp; pending <span class="r">live from site</span></h2>'+
            pmProgrammeTable()+'</div>',
        right:'<div class="card" style="border-left:3px solid var(--gold)"><h2>Raise it yourself — PM override <span class="r">direct</span></h2>'+
            '<div class="mini" style="margin:0 0 10px">You are not limited to what the team sends up. Originate a submission or an RFI and issue it directly. Every direct action is logged against your name.</div>'+
            '<div class="actbar"><button class="prim" data-new="submittal">＋ New submission</button>'+
            '<button data-new="rfi">＋ RFI</button><button data-new="letter">＋ Letter</button></div></div>'+
          '<div class="card"><h2>Live from site</h2>'+feed()+'</div>'};
    };
  }
  // the buttons
  function verifyPost(aid, status, note){
    var body={activity_id:aid, status:status};
    if(note) body.note=note;
    return fetch('/api/verify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})
      .then(function(r){ return r.json().catch(function(){return {};}); })
      .then(function(d){
        if(d && d.error){ alert(d.error); return; }
        return loadVerify().then(function(){ try{ render(); }catch(e){} });
      })
      .catch(function(){ alert('Could not reach the server.'); });
  }
  document.addEventListener('click', function(ev){
    var s=ev.target.closest('[data-signoff]');
    if(s){ ev.preventDefault(); s.disabled=true; verifyPost(s.getAttribute('data-signoff'),'verified'); return; }
    var qb=ev.target.closest('[data-query]');
    if(qb){ ev.preventDefault();
      var note=prompt('What is wrong with it? The site engineer sees this.');
      if(note && note.trim()) verifyPost(qb.getAttribute('data-query'),'queried',note.trim());
      return; }
  }, true);

  // ---- P1: the site engineer updates their own activity ------------------
  // The other half of the sign-off loop. The engineer slides the percentage,
  // attaches the completion photographs, and sends it to the PM. A claim of
  // 100% without a photograph is refused by the server, and that refusal is
  // shown here rather than swallowed.
  function shrinkPhoto(file, cb){
    var rd=new FileReader();
    rd.onload=function(e){
      var img=new Image();
      img.onload=function(){
        var max=1200, w=img.width, h=img.height;
        if(w>max){ h=Math.round(h*max/w); w=max; }
        var c=document.createElement('canvas'); c.width=w; c.height=h;
        c.getContext('2d').drawImage(img,0,0,w,h);
        try{ cb(c.toDataURL('image/jpeg',0.72)); }catch(err){ cb(null); }
      };
      img.onerror=function(){ cb(null); };
      img.src=e.target.result;
    };
    rd.readAsDataURL(file);
  }
  function refreshProgramme(){
    return fetch('/api/data',{cache:'no-store'})
      .then(function(r){ return r.ok?r.json():null; })
      .then(function(d){ try{ mapAct(d); }catch(e){} })
      .catch(function(){});
  }
  function livePanel(a){
    var done=a.pct>=100;
    return '<div class="note" id="livePanel" style="border-left:3px solid '+(done?'var(--good)':'var(--gold)')+'">'+
      '<div class="sechd">'+(done?'Finished — with the PM':'Update this activity')+'</div>'+
      (done
        ? '<div class="mini">You marked this 100% and it is with the PM to verify and sign off.</div>'
        : '<div class="frm"><div class="f full"><label>Progress — <b id="pcOut">'+Math.round(a.pct)+'</b>%</label>'+
            '<input id="pcRange" type="range" min="0" max="100" value="'+Math.round(a.pct)+'"></div>'+
          '<div class="f full"><label>Photographs <span class="mini">— required to close the activity</span></label>'+
            '<input id="pcPhoto" type="file" accept="image/*" multiple></div></div>'+
          '<div class="actbar"><button class="prim" id="pcSave">Save progress</button>'+
          '<button class="ovr" id="pcFinish">Mark finished &amp; send to PM</button></div>'+
          '<div class="mini" id="pcMsg" style="margin-top:8px"></div>')+
      '</div>';
  }
  function wirePanel(a){
    var rng=document.getElementById('pcRange'); if(!rng) return;
    var out=document.getElementById('pcOut'), msg=document.getElementById('pcMsg');
    rng.addEventListener('input',function(){ out.textContent=this.value; });
    function say(t,bad){ if(msg){ msg.textContent=t; msg.style.color=bad?'var(--bad)':'var(--faint)'; } }
    function uploadPhotos(){
      var inp=document.getElementById('pcPhoto');
      var files=(inp&&inp.files)?Array.prototype.slice.call(inp.files):[];
      if(!files.length) return Promise.resolve(0);
      say('Uploading '+files.length+' photograph'+(files.length>1?'s':'')+'…');
      return files.reduce(function(chain,f){
        return chain.then(function(n){
          return new Promise(function(done){
            shrinkPhoto(f,function(dataUrl){
              if(!dataUrl) return done(n);
              fetch('/api/photo',{method:'POST',headers:{'Content-Type':'application/json'},
                body:JSON.stringify({activity_id:a.ref, data:dataUrl, caption:a.name})})
                .then(function(){ done(n+1); }).catch(function(){ done(n); });
            });
          });
        });
      }, Promise.resolve(0));
    }
    function post(pct){
      return fetch('/api/update',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({activity_id:a.ref, pct:pct})})
        .then(function(r){ return r.json().then(function(d){ return {status:r.status, d:d}; }); });
    }
    function after(){ return refreshProgramme().then(function(){ try{ render(); }catch(e){} try{ closeDetail(); }catch(e){} }); }
    document.getElementById('pcSave').addEventListener('click',function(){
      var b=this; b.disabled=true; say('Saving…');
      uploadPhotos().then(function(){ return post(Number(rng.value)); }).then(function(res){
        if(res.d && res.d.error){ say(res.d.error,true); b.disabled=false; return; }
        after();
      }).catch(function(){ say('Could not reach the server.',true); b.disabled=false; });
    });
    document.getElementById('pcFinish').addEventListener('click',function(){
      var b=this; b.disabled=true; say('Sending to the PM…');
      uploadPhotos().then(function(){ return post(100); }).then(function(res){
        if(res.status===422 || (res.d && res.d.needs_photo)){
          say('A photograph is needed before this can be marked complete — attach one above, then try again.',true);
          b.disabled=false; return;
        }
        if(res.d && res.d.error){ say(res.d.error,true); b.disabled=false; return; }
        after();
      }).catch(function(){ say('Could not reach the server.',true); b.disabled=false; });
    });
  }
  // ---- P1: attachments, for real ----------------------------------------
  // The design drew a drop zone that did nothing, and every form carried one.
  // A WIR goes to the consultant "with all attachments", so these have to be
  // real files: uploaded, listed, downloadable, removable.
  var ATT_MAX = 25 * 1024 * 1024;
  function attIcon(m){
    m = String(m || '');
    if (m.indexOf('image/') === 0) return '▣';
    if (m.indexOf('pdf') >= 0) return '▤';
    if (m.indexOf('word') >= 0 || m.indexOf('msword') >= 0) return '▥';
    if (m.indexOf('sheet') >= 0 || m.indexOf('excel') >= 0) return '▦';
    return '▤';
  }
  function readB64(file, cb){
    var rd = new FileReader();
    rd.onload = function(e){
      var s = String(e.target.result || '');
      cb(s.slice(s.indexOf(',') + 1));
    };
    rd.onerror = function(){ cb(null); };
    rd.readAsDataURL(file);
  }
  // Uploaded one at a time on purpose: a site engineer on a phone would rather
  // see four of five arrive than have the whole lot fail together.
  function uploadAttachments(ref, files, say){
    var list = Array.prototype.slice.call(files || []);
    if (!list.length) return Promise.resolve({ done: 0, failed: [] });
    var failed = [];
    return list.reduce(function(chain, f, i){
      return chain.then(function(done){
        if (f.size > ATT_MAX) { failed.push(f.name + ' (over 25 MB)'); return done; }
        if (say) say('Attaching ' + (i + 1) + ' of ' + list.length + ' — ' + f.name + '…');
        return new Promise(function(next){
          readB64(f, function(b64){
            if (!b64) { failed.push(f.name); return next(done); }
            fetch('/api/attachment', { method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ref: ref, filename: f.name, mime: f.type || '', file_b64: b64 }) })
              .then(function(r){ return r.json().catch(function(){ return {}; }); })
              .then(function(d){
                if (d && d.ok) next(done + 1);
                else { failed.push(f.name + (d && d.error ? ' — ' + d.error : '')); next(done); }
              })
              .catch(function(){ failed.push(f.name); next(done); });
          });
        });
      });
    }, Promise.resolve(0)).then(function(done){ return { done: done, failed: failed }; });
  }
  function attRowHTML(a){
    return '<div class="att" data-att="' + a.id + '">' +
      '<span class="fi">' + attIcon(a.mime) + '</span>' +
      '<a class="fn" href="/attachment/' + a.id + '">' + esc(a.filename) + '</a>' +
      '<span class="fs">' + esc(a.size_text || '') + '</span>' +
      '<button class="btn" data-attdel="' + a.id + '" title="Remove this file">✕</button></div>';
  }
  function esc(s){
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  // Swap the design's dead drop zone for a real file field on every create form.
  function installLiveFormUploads(){
    if (typeof openNewForm !== 'function') return;
    var orig = openNewForm;
    window.openNewForm = function(kind){
      orig(kind);
      try { restoreDraft(kind); } catch (e) {}
      var boxes = document.querySelectorAll('#dpane .filebox');
      for (var i = 0; i < boxes.length; i++) {
        var b = boxes[i];
        var holder = document.createElement('div');
        holder.innerHTML = '<input type="file" class="attpick" multiple>' +
          '<div class="mini" style="margin-top:6px">Drawings, PDFs, photographs, Word or Excel. Up to 25 MB each. ' +
          'They are uploaded when you generate this document.</div>';
        b.parentNode.replaceChild(holder, b);
      }
    };
  }
  function installLiveAttachments(){
    if (typeof openDetail !== 'function') return;
    var orig = openDetail;
    window.openDetail = function(ref){
      orig(ref);
      // Only a stored record carries attachments. An activity code or a design
      // reference has none, and must not be offered an upload that goes nowhere.
      var rec = RECBYREF[ref];
      var body = document.querySelector('#dpane .dbody');
      if (!body) return;
      var card = null, notes = body.querySelectorAll('.note');
      for (var i = 0; i < notes.length; i++) {
        var h = notes[i].querySelector('.sechd');
        if (h && /^Attachments/.test(h.textContent || '')) { card = notes[i]; break; }
      }
      if (!card) return;
      if (!rec) {
        card.innerHTML = '<div class="sechd">Attachments</div>' +
          '<div class="mini">Files are attached to submittals, inspections, NCRs and the rest — not to this.</div>';
        return;
      }
      card.innerHTML = '<div class="sechd">Attachments</div>' +
        '<div id="attList"><div class="mini">Loading…</div></div>' +
        (state.readonly ? '' :
          '<div style="margin-top:10px"><input type="file" id="attAdd" multiple>' +
          '<div class="mini" id="attMsg" style="margin-top:6px">Up to 25 MB each.</div></div>');
      refreshAttachments(ref);
      var add = document.getElementById('attAdd');
      if (add) add.addEventListener('change', function(){
        var msg = document.getElementById('attMsg');
        var say = function(t){ if (msg) msg.textContent = t; };
        var files = this.files; var self = this;
        uploadAttachments(ref, files, say).then(function(r){
          self.value = '';
          say(r.failed.length
            ? (r.done ? r.done + ' attached. ' : '') + 'Could not attach: ' + r.failed.join(', ')
            : r.done + ' file' + (r.done === 1 ? '' : 's') + ' attached.');
          refreshAttachments(ref);
        });
      });
    };
  }
  function refreshAttachments(ref){
    var box = document.getElementById('attList'); if (!box) return;
    fetch('/api/attachments?ref=' + encodeURIComponent(ref), { cache: 'no-store' })
      .then(function(r){ return r.json(); })
      .then(function(d){
        var list = (d && d.attachments) || [];
        box.innerHTML = list.length
          ? list.map(attRowHTML).join('')
          : '<div class="mini">Nothing attached yet.</div>';
      })
      .catch(function(){ box.innerHTML = '<div class="mini">Could not load the attachments.</div>'; });
  }
  // Removing one, from wherever it is listed.
  document.addEventListener('click', function(ev){
    var d = ev.target.closest ? ev.target.closest('[data-attdel]') : null;
    if (!d) return;
    ev.preventDefault(); ev.stopImmediatePropagation();
    var row = d.closest('.att');
    var name = row ? (row.querySelector('.fn') || {}).textContent : 'this file';
    if (!confirm('Remove ' + name + ' from this record?')) return;
    fetch('/api/attachment', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ remove: d.getAttribute('data-attdel') }) })
      .then(function(r){ return r.json(); })
      .then(function(res){
        if (res && res.ok) { if (row) row.remove(); var b = document.getElementById('attList');
          if (b && !b.querySelector('.att')) b.innerHTML = '<div class="mini">Nothing attached yet.</div>'; }
        else alert((res && res.error) || 'Could not remove that file.');
      })
      .catch(function(){ alert('Could not remove that file.'); });
  }, true);

  // ---- P1: record actions ------------------------------------------------
  // The design's buttons said "Approve & sign" and did nothing. These move the
  // record along its real workflow, and produce the real Word document from the
  // template uploaded for this project.
  // Whether this person may approve THIS kind of record. The answer is computed
  // by the server from the one access matrix and sent with the identity, so a
  // button can never appear for something the API would refuse — nor be hidden
  // for something it would allow, which is how QA/QC ended up unable to close
  // its own NCR.
  function mayApprove(rec){
    var t = rec && rec.type;
    if (!t) return false;
    // The server says whether THIS step is this person's (each step has an owner).
    if (typeof rec.can_act === 'boolean') return rec.can_act;
    return (ME.mayApprove || []).indexOf(t) >= 0;
  }
  // A "＋ New …" button for something the API will refuse is a trap. The design
  // puts each button on its own dashboard, but one email can hold several
  // functions and the Principal and PM see every dashboard, so the button has
  // to be checked against what this person may actually raise.
  function installRaiseGuard(){
    if (typeof render !== 'function') return;
    var orig = render;
    window.render = function(){
      orig.apply(this, arguments);
      var may = ME.mayRaise || [];
      var btns = document.querySelectorAll('[data-new]');
      for (var i = 0; i < btns.length; i++) {
        var kind = btns[i].getAttribute('data-new');
        if (kind === 'assign') continue;              // people, not records
        var type = FORM_TO_TYPE[kind];
        if (!type) continue;
        if (may.indexOf(type) < 0 && btns[i].parentNode) btns[i].parentNode.removeChild(btns[i]);
      }
    };
  }

  // Every register, as a real workbook rather than a comma-separated file with
  // an Excel name on it. The server builds it from the live project, so what
  // downloads is what the register holds — not what this browser happens to
  // have rendered — with real dates that sort as dates, a frozen header, and a
  // second sheet carrying every field of every record's own form.
  function excelDownload(path, btn){
    var label = btn && btn.textContent;
    var done = function(){ if (btn) { btn.disabled = false; btn.textContent = label; } };
    if (btn) { btn.disabled = true; btn.textContent = 'Building…'; }
    fetch(path, { cache: 'no-store' })
      .then(function(r){
        var ct = r.headers.get('Content-Type') || '';
        if (!r.ok || ct.indexOf('json') >= 0) {
          return r.json().catch(function(){ return {}; }).then(function(j){
            alert((j && j.error) || 'That register could not be exported.');
            done();
          });
        }
        var name = 'register.xlsx';
        var m = /filename="([^"]+)"/.exec(r.headers.get('Content-Disposition') || '');
        if (m) name = m[1];
        return r.blob().then(function(b){
          var a = document.createElement('a');
          a.href = URL.createObjectURL(b); a.download = name;
          document.body.appendChild(a); a.click();
          setTimeout(function(){ try { URL.revokeObjectURL(a.href); a.remove(); } catch (e) {} }, 2000);
          done();
        });
      })
      .catch(function(){ alert('Could not reach the server.'); done(); });
  }
  function installRealExcelExport(){
    window.downloadRegister = function(kind){
      excelDownload('/api/register/xlsx?reg=' + encodeURIComponent(kind),
        document.querySelector('[data-xls="' + kind + '"]'));
    };
    // The generated schedule shipped with three buttons that did nothing. It
    // gets the one that does: the same rows, as dates, in a workbook.
    if (typeof openSchedule === 'function') {
      var origSched = openSchedule;
      window.openSchedule = function(kind){
        origSched(kind);
        try {
          var bar = document.querySelector('#dpane .actbar');
          if (bar) bar.innerHTML = '<button class="prim" data-xlssched="' + kind + '">⬇ Excel</button>';
        } catch (e) {}
      };
    }
    document.addEventListener('click', function(ev){
      var s = ev.target.closest && ev.target.closest('[data-xlssched]');
      if (!s) return;
      ev.preventDefault();
      excelDownload('/api/register/schedule.xlsx?reg=' + encodeURIComponent(s.getAttribute('data-xlssched')), s);
    });
  }

  function installLiveRecordActions(){
    if (typeof openDetail !== 'function') return;
    var orig = openDetail;
    window.openDetail = function(ref){
      orig(ref);
      var rec = RECBYREF[ref];
      var body = document.querySelector('#dpane .dbody');
      if (!rec || !body) return;
      // Find the workflow card and replace the design's dead action bar.
      var notes = body.querySelectorAll('.note'), card = null;
      for (var i = 0; i < notes.length; i++) {
        var h = notes[i].querySelector('.sechd');
        if (h && /Workflow/i.test(h.textContent || '')) { card = notes[i]; break; }
      }
      if (!card) return;
      var bar = card.querySelector('.actbar');
      if (bar) bar.remove();
      var mini = card.querySelector('.mini');
      if (mini) mini.remove();

      var closed = rec.next_step === null || (rec.next_step === undefined && /closed|approved|rejected/i.test(rec.status || ''));
      var mine = mayApprove(rec) && !closed && !state.readonly;
      var html = '<div class="actbar" id="recBar">';
      // STEP 7: an incoming letter is answered by a reply letter, or closed with a reason.
      var links = '';
      if (rec.type === 'incoming') {
        var reps = LIVE.records.filter(function(x){ return x.type === 'letter' && String((x.data || {})['In reply to'] || '').toUpperCase().indexOf(ref) >= 0; });
        links = reps.length ? '<div class="mini" style="margin:0 0 8px">Reply: ' + reps.map(function(x){ return '<a data-open="' + esc(x.ref) + '" style="cursor:pointer;text-decoration:underline">' + esc(x.ref) + '</a> (' + esc(x.status || '') + ')'; }).join(', ') + '</div>' : '';
      } else if (rec.type === 'letter' && (rec.data || {})['In reply to']) {
        links = '<div class="mini" style="margin:0 0 8px">In reply to ' + esc(rec.data['In reply to']) + '</div>';
      }
      if (mine && rec.type === 'incoming') {
        if ((ME.mayRaise || []).indexOf('letter') >= 0) html += '<button class="prim" id="recReply">Draft reply</button>';
        html += '<button id="recNoReply">Close — no reply needed</button>';
      } else if (mine && rec.next_is_reply) {
        // The consultant is not on the platform: DC records the reply they sent.
        html += '<select id="recCode" style="padding:6px 8px;border-radius:8px">' +
          ['Code A — Approved','Code B — Approved as noted','Code C — Revise & resubmit','Code D — Rejected','Answered / noted']
            .map(function(c){ return '<option>' + esc(c) + '</option>'; }).join('') + '</select>' +
          '<button class="prim" id="recApprove">Record consultant reply</button>';
      } else if (mine) {
        html += '<button class="prim" id="recApprove">' + (rec.next_is_issue ? 'Issue' : 'Approve &amp; sign') + '</button>' +
                '<button class="warn" id="recReject">Reject</button>';
      }
      if (rec.due && !closed) {
        var lateDue = rec.due < liveToday();
        html = '<div class="mini" style="margin:0 0 8px;' + (lateDue ? 'color:var(--bad);font-weight:600' : '') + '">' +
          (lateDue ? 'Overdue — was due ' : 'Due ') + esc(rec.due) +
          (rec.due_basis ? ' · ' + esc(rec.due_basis === 'entered' ? 'date entered when raised' : rec.due_basis) : '') + '</div>' + html;
      }
      html = links + html;
      html += '<button id="recDoc">Generate document</button>' +
        (ME.mayNotify ? '<button id="recNotify">Notify team</button>' : '') + '</div>' +
        '<div class="mini" id="recMsg" style="margin-top:8px">' +
        (closed ? 'This record is closed — ' + esc(rec.status || '') + '.'
          : (mine
             ? (rec.next_is_issue ? 'Issuing records it as sent to the consultant under your name. You can notify the team next.'
                : rec.next_is_reply ? 'Pick the status the consultant returned and attach their reply to this record.'
                : 'Approving moves it to the next step and records your name against it.')
             : 'Waiting on: <b>' + esc(rec.next_step || rec.status || 'the next step') + '</b>' +
               ((rec.next_by && rec.next_by.length) ? ' — ' + esc(rec.next_by.join(' or ')) : '') + '.'))
        + '</div>';
      card.insertAdjacentHTML('beforeend', html);
      wireRecordActions(ref);
    };
  }
  function wireRecordActions(ref){
    var msg = document.getElementById('recMsg');
    var say = function(t, bad){ if (msg) { msg.textContent = t; msg.style.color = bad ? 'var(--bad)' : ''; } };

    function advance(action, label){
      var bar = document.getElementById('recBar');
      if (bar) Array.prototype.forEach.call(bar.querySelectorAll('button'), function(b){ b.disabled = true; });
      say(label + '…');
      var code = document.getElementById('recCode');
      var wasIssue = !!(RECBYREF[ref] && RECBYREF[ref].next_is_issue);
      fetch('/api/record/advance', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(code && action === 'advance' ? { ref: ref, action: action, status: code.value } : { ref: ref, action: action }) })
        .then(function(r){ return r.json().then(function(d){ return { s: r.status, d: d }; }); })
        .then(function(res){
          if (res.d && res.d.error) {
            say(res.d.error, true);
            if (bar) Array.prototype.forEach.call(bar.querySelectorAll('button'), function(b){ b.disabled = false; });
            return;
          }
          // Re-read from the server rather than guessing the new state.
          return loadRecords().then(function(){
            try { render(); } catch (e) {}
            openDetail(ref);
            // Document Control has just issued it: offer to tell the team.
            if (wasIssue && action === 'advance' && window.notifyTeam) {
              var r0 = RECBYREF[ref] || {};
              window.notifyTeam({ ref: ref, title: ref + ' issued — ' + (r0.title || ''),
                message: ref + ' (' + (r0.title || '') + ') has been issued to the consultant.' });
            }
          });
        })
        .catch(function(){
          say('Could not reach the server.', true);
          if (bar) Array.prototype.forEach.call(bar.querySelectorAll('button'), function(b){ b.disabled = false; });
        });
    }

    var nt = document.getElementById('recNotify');
    if (nt) nt.addEventListener('click', function(){
      var r0 = RECBYREF[ref] || {};
      if (window.notifyTeam) window.notifyTeam({ ref: ref, kind: 'record', title: ref + ' — ' + (r0.title || ''),
        message: ref + ' (' + (r0.title || '') + ') — ' + (r0.status || '') + '.' });
    });
    var ap = document.getElementById('recApprove');
    if (ap) ap.addEventListener('click', function(){ advance('advance', 'Signing'); });
    var rp = document.getElementById('recReply');
    if (rp) rp.addEventListener('click', function(){
      var r0 = RECBYREF[ref] || {}, d0 = r0.data || {};
      openNewForm('letter');
      var fs = document.querySelectorAll('#dpane .frm .f');
      for (var i = 0; i < fs.length; i++) {
        var lb = (fs[i].querySelector('label') || {}).textContent || '', inp = fs[i].querySelector('input,select,textarea');
        if (!inp) continue;
        if (lb === 'In reply to') inp.value = ref;
        else if (lb === 'Subject') inp.value = 'Re: ' + (r0.title || '') + (d0['Their reference'] ? ' (your ref ' + d0['Their reference'] + ')' : '');
        else if (lb === 'Type') inp.value = 'Response';
        else if (lb === 'To') inp.value = /client|employer|owner/i.test(d0.From || '') ? 'Client' : 'Consultant';
        else if (lb === 'Required issue by' && r0.due) inp.value = r0.due;
      }
    });
    var nr = document.getElementById('recNoReply');
    if (nr) nr.addEventListener('click', function(){
      var why = prompt('Why is no reply needed? (e.g. answered at the progress meeting, for information)', '');
      if (!why) return;
      say('Closing…');
      fetch('/api/record/advance', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ref: ref, action: 'advance', note: why }) })
        .then(function(r){ return r.json(); })
        .then(function(d){
          if (d && d.error) { say(d.error, true); return; }
          return loadRecords().then(function(){ try { render(); } catch (e) {} openDetail(ref); });
        }).catch(function(){ say('Could not reach the server.', true); });
    });
    var rj = document.getElementById('recReject');
    if (rj) rj.addEventListener('click', function(){
      if (!confirm('Reject ' + ref + '? It goes back with your name against the rejection.')) return;
      advance('reject', 'Rejecting');
    });

    var dc = document.getElementById('recDoc');
    if (dc) dc.addEventListener('click', function(){
      var b = this; b.disabled = true;
      say('Producing the document…');
      // A missing template comes back as JSON, not a file. Telling the man his
      // download failed is useless; he needs to know WHICH template is missing.
      fetch('/api/record/doc?ref=' + encodeURIComponent(ref))
        .then(function(r){
          var ct = r.headers.get('content-type') || '';
          if (ct.indexOf('json') >= 0) {
            return r.json().then(function(d){
              say((d && d.error) || 'That document could not be produced.', true);
              b.disabled = false;
            });
          }
          return r.blob().then(function(blob){
            var u = URL.createObjectURL(blob);
            var a = document.createElement('a');
            a.href = u; a.download = ref + '.docx';
            document.body.appendChild(a); a.click(); a.remove();
            setTimeout(function(){ URL.revokeObjectURL(u); }, 4000);
            say('Produced in this project’s format and downloaded as ' + ref + '.docx.');
            b.disabled = false;
          });
        })
        .catch(function(){ say('Could not reach the server.', true); b.disabled = false; });
    });
  }

  // ---- P1: the Bill of Materials, live -----------------------------------
  // The budget the site engineer never sees. He raises a material request; it
  // lands with the PM, who sees this and is told plainly when releasing it goes
  // past the BOM. It does NOT block — the design's own caption claimed it did,
  // which was never the agreed rule. A PM who is stopped by software finds a way
  // around the software; a PM who is told the truth is on the record.
  var BOM = null, BOM_TRIED = false;
  function bomFetch(){
    BOM_TRIED = true;
    return fetch('/api/bom', { cache: 'no-store' })
      .then(function(r){ return r.ok ? r.json() : { lines: [], denied: true }; })
      .then(function(d){ BOM = d || { lines: [] }; return BOM; })
      .catch(function(){ BOM = { lines: [] }; return BOM; });
  }
  function n2(v){
    var n = Number(v || 0);
    return (Math.round(n * 1000) / 1000).toLocaleString();
  }
  function bomLineHTML(l){
    var over = l.over;
    var cls = over ? 'late' : (l.remaining <= (l.budget_qty || 0) * 0.05 ? 'warn' : 'ok');
    var label = over ? 'Over BOM' : (cls === 'warn' ? 'Near limit' : 'OK');
    return '<tr><td>' + esc(l.material) + '</td>' +
      '<td>' + n2(l.budget_qty) + ' ' + esc(l.unit || '') + '</td>' +
      '<td>' + n2(l.ordered_qty) + '</td>' +
      '<td>' + n2(l.received_qty) + '</td>' +
      '<td style="color:' + (over ? 'var(--bad)' : 'inherit') + '">' +
        (over ? '−' + n2(l.over_by) : '+' + n2(l.remaining)) + '</td>' +
      '<td>' + pill(label, cls) + '</td>' +
      '<td>' + n2(l.awaiting_delivery) + '</td></tr>';
  }
  function bomCardHTML(){
    if (!BOM) return '<div class="card"><h2>Bill of Materials</h2><div class="mini">Loading…</div></div>';
    if (BOM.denied) {
      return '<div class="card"><h2>Bill of Materials</h2>' +
        '<div class="mini">The material budget is not part of your access. ' +
        'Raise a material request and the PM releases it against the BOM.</div></div>';
    }
    var lines = BOM.lines || [];
    if (!lines.length) {
      return '<div class="card"><h2>Bill of Materials — order control</h2>' +
        '<div class="mini">No Bill of Materials has been loaded for this project yet. ' +
        'It is uploaded at project setup, and every order is then drawn against it.</div></div>';
    }
    var overN = lines.filter(function(l){ return l.over; }).length;
    return '<div class="card"><h2>Bill of Materials — order control ' +
      '<span class="r">' + (overN ? overN + ' over BOM' : lines.length + ' materials') + '</span></h2>' +
      '<table><tr><th>Material</th><th>BOM</th><th>Ordered</th><th>Received</th>' +
      '<th>Balance</th><th>Status</th><th>Awaiting</th></tr>' +
      lines.map(bomLineHTML).join('') + '</table>' +
      '<div class="mini">The BOM is the approved material budget. Every release draws against it. ' +
      'An order that takes the ordered quantity past the allowance is <b>not blocked</b> — you are ' +
      'warned, and the overrun is recorded against your name.</div></div>' +
      bomActionsHTML(lines) + bomMovesHTML();
  }
  function bomActionsHTML(lines){
    if (state.readonly) return '';
    var opts = lines.map(function(l){
      return '<option value="' + esc(l.material) + '">' + esc(l.material) + ' (' + esc(l.unit || '') + ')</option>';
    }).join('');
    return '<div class="card"><h2>Release an order / record a delivery</h2>' +
      '<div class="frm">' +
        '<div class="f"><label>Material</label><select id="bomMat">' + opts + '</select></div>' +
        '<div class="f"><label>Quantity</label><input id="bomQty" type="text" placeholder="e.g. 250"></div>' +
        '<div class="f full"><label>Reference (LPO / GRN number)</label><input id="bomRef" type="text" placeholder="LPO-118"></div>' +
      '</div>' +
      '<div class="actbar"><button class="prim" id="bomOrder">Check &amp; release order</button>' +
      '<button id="bomGrn">Record delivery received</button></div>' +
      '<div id="bomWarn" style="margin-top:10px"></div>' +
      '<div class="mini" id="bomMsg" style="margin-top:6px"></div></div>';
  }
  function bomMovesHTML(){
    var moves = (BOM && BOM.moves) || [];
    if (!moves.length) return '';
    return '<div class="card"><h2>Recent movements</h2><table>' +
      '<tr><th>When</th><th>Material</th><th>What</th><th>Qty</th><th>Ref</th><th>By</th></tr>' +
      moves.slice(0, 20).map(function(m){
        return '<tr><td>' + esc(String(m.at || '').slice(0, 10)) + '</td>' +
          '<td>' + esc(m.material) + '</td>' +
          '<td>' + (m.kind === 'grn' ? 'Received' : 'Ordered') +
            (m.over_by > 0 ? ' <span style="color:var(--bad)">over by ' + n2(m.over_by) + '</span>' : '') + '</td>' +
          '<td>' + n2(m.qty) + '</td><td>' + esc(m.ref || '') + '</td><td>' + esc(m.by || '') + '</td></tr>';
      }).join('') + '</table></div>';
  }
  function wireBOM(){
    var msgEl = document.getElementById('bomMsg'), warnEl = document.getElementById('bomWarn');
    if (!msgEl) return;
    var say = function(t, bad){ msgEl.textContent = t; msgEl.style.color = bad ? 'var(--bad)' : ''; };
    var mat = function(){ var e = document.getElementById('bomMat'); return e ? e.value : ''; };
    var qty = function(){ var e = document.getElementById('bomQty'); return e ? e.value : ''; };
    var ref = function(){ var e = document.getElementById('bomRef'); return e ? e.value : ''; };

    function refresh(){ return bomFetch().then(function(){ try { render(); } catch (e) {} }); }

    var ord = document.getElementById('bomOrder');
    if (ord) ord.addEventListener('click', function(){
      if (!qty() || Number(String(qty()).replace(/[, ]/g, '')) <= 0) { say('How much?', true); return; }
      say('Checking against the BOM…'); warnEl.innerHTML = '';
      fetch('/api/bom/check', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ material: mat(), qty: qty() }) })
        .then(function(r){ return r.json(); })
        .then(function(c){
          if (c && c.error) { say(c.error, true); return; }
          // The warning is shown BEFORE anything is released, and releasing it
          // anyway is a deliberate second click, not a slip.
          warnEl.innerHTML = '<div class="note" style="border-left:3px solid ' +
            (c.warning ? 'var(--bad)' : 'var(--good)') + '">' +
            '<div class="sechd">' + (c.warning ? 'This goes past the Bill of Materials' : 'Within the Bill of Materials') + '</div>' +
            '<div class="mini">' + esc(c.message) + '</div>' +
            '<div class="actbar" style="margin-top:8px">' +
            '<button class="' + (c.warning ? 'warn' : 'prim') + '" id="bomConfirm">' +
            (c.warning ? 'Release anyway — record the overrun against my name' : 'Release this order') +
            '</button><button id="bomCancel">Cancel</button></div></div>';
          say('');
          document.getElementById('bomCancel').addEventListener('click', function(){
            warnEl.innerHTML = ''; say('Not released.');
          });
          document.getElementById('bomConfirm').addEventListener('click', function(){
            this.disabled = true; say('Releasing…');
            fetch('/api/bom/order', { method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ material: mat(), qty: qty(), ref: ref() }) })
              .then(function(r){ return r.json(); })
              .then(function(res){
                if (res && res.error) { say(res.error, true); return; }
                warnEl.innerHTML = '';
                return refresh().then(function(){
                  var m = document.getElementById('bomMsg');
                  if (m) m.textContent = 'Released' + (res.over_by > 0
                    ? ' — over the BOM by ' + n2(res.over_by) + ', and recorded as such.' : '.');
                });
              })
              .catch(function(){ say('Could not reach the server.', true); });
          });
        })
        .catch(function(){ say('Could not reach the server.', true); });
    });

    var grn = document.getElementById('bomGrn');
    if (grn) grn.addEventListener('click', function(){
      if (!qty() || Number(String(qty()).replace(/[, ]/g, '')) <= 0) { say('How much arrived?', true); return; }
      this.disabled = true; say('Recording the delivery…');
      var self = this;
      fetch('/api/bom/grn', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ material: mat(), qty: qty(), ref: ref() }) })
        .then(function(r){ return r.json(); })
        .then(function(res){
          self.disabled = false;
          if (res && res.error) { say(res.error, true); return; }
          return refresh().then(function(){
            var m = document.getElementById('bomMsg');
            if (m) m.textContent = 'Delivery recorded against the BOM.';
          });
        })
        .catch(function(){ self.disabled = false; say('Could not reach the server.', true); });
    });
  }
  function installLiveBOM(){
    if (typeof render !== 'function') return;
    var orig = render;
    window.render = function(){
      orig.apply(this, arguments);
      var cards = document.querySelectorAll('.card');
      for (var i = 0; i < cards.length; i++) {
        var h = cards[i].querySelector('h2');
        if (!h || !/^Bill of Materials/.test(h.textContent || '')) continue;
        var holder = document.createElement('div');
        holder.innerHTML = bomCardHTML();
        cards[i].parentNode.replaceChild(holder, cards[i]);
        wireBOM();
        // Fetched once. Without the guard a refused or empty response would
        // send render → fetch → render round and round for ever.
        if (!BOM_TRIED) bomFetch().then(function(){ try { render(); } catch (e) {} });
        break;
      }
    };
  }

  // ---- P1: interim payment, live -----------------------------------------
  // The hybrid we agreed: the platform proposes each section's percentage from
  // the programme, and the QS edits it before anything is raised. A valuation
  // the QS has not looked at cannot become an application — the server refuses
  // it, and so does this screen.
  var IPC = null, IPC_TRIED = false, PROP = null, PROP_EDIT = {}, VO_SEL = {}, MOS = [], IPC_CHECK = null;
  function money(v){
    var n = Number(v || 0);
    return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  // Redraw in place: the payments screen may be the dashboard's card or the
  // register opened from the menu, which render() alone would throw away.
  function ipcRedraw(){
    try {
      if (state.navView && state.navView.reg === 'ipc' && typeof window.__showRegister === 'function') window.__showRegister('ipc');
      else render();
    } catch (e) {}
  }
  function ipcToday(){ return new Date(Date.now() + 4 * 3600000).toISOString().slice(0, 10); }
  function ipcFetch(){
    IPC_TRIED = true;
    return fetch('/api/ipc', { cache: 'no-store' })
      .then(function(r){ return r.ok ? r.json() : { certificates: [], denied: true }; })
      .then(function(d){ IPC = d || { certificates: [] }; return IPC; })
      .catch(function(){ IPC = { certificates: [] }; return IPC; });
  }
  var IPC_ACT = { approve: 'Approve', 'return': 'Return to QS', issue: 'Issue to the Engineer',
    certify: 'Record the Engineer’s certificate', engineer_return: 'Engineer returned it', pay: 'Record payment' };
  function ipcCertsHTML(){
    var cs = (IPC && IPC.certificates) || [], may = (IPC && IPC.may) || {};
    if (!cs.length) {
      return '<div class="card"><h2>Payment applications (IPA / IPC)</h2>' +
        '<div class="mini">Nothing applied for on this project yet. ' +
        (may.raise ? 'Propose a valuation below; you review every line, and it becomes the first application.' : 'The QS raises the first application.') + '</div></div>';
    }
    return '<div class="card"><h2>Payment applications (IPA / IPC) <span class="r">' + cs.length + '</span></h2>' +
      '<table><tr><th>Ref</th><th>Period</th><th style="text-align:right">Applied (net)</th><th style="text-align:right">Certified</th>' +
      '<th>Status</th><th>Next date</th><th>Documents</th><th></th></tr>' +
      cs.map(function(c){
        var acts = '';
        if (!state.readonly) (c.next_actions || []).forEach(function(a){
          if (may[a]) acts += '<button class="btn" data-ipc="' + a + '" data-ref="' + esc(c.ref) + '">' + IPC_ACT[a] + '</button> ';
        });
        if (!state.readonly && c.stage !== 'paid' && c.stage !== 'returned') acts += '<button class="btn" data-ipcattach="' + esc(c.ref) + '" title="Take-off sheets, day-works, delivery notes, the Engineer’s certificate">Attach file</button>';
        var q = encodeURIComponent(c.ref);
        var next = c.stage === 'issued' ? 'certify by ' + esc(c.certify_by || '') : (c.stage === 'certified' || c.stage === 'part') ? 'pay by ' + esc(c.payment_by || '') : '';
        return '<tr><td><b>' + esc(c.ref) + '</b></td><td>' + esc((c.period_from || '') + ' – ' + (c.period_to || '')) + '</td>' +
          '<td style="text-align:right">' + money(c.net) + '</td>' +
          '<td style="text-align:right">' + (c.certified_net != null && c.certified_net !== '' ? money(c.certified_net) : '—') + '</td>' +
          '<td>' + pill(c.status, c.cls || '') + (c.return_note ? '<div class="mini">' + esc(c.return_note) + '</div>' : '') + '</td>' +
          '<td class="mini">' + next + '</td>' +
          '<td class="mini"><a href="/api/ipc/pack?ref=' + q + '">Full pack (.zip)</a><br><a href="/api/ipc/xlsx?ref=' + q + '">BOQ (Excel)</a> · <a href="/api/ipc/doc?ref=' + q + '">Letter</a></td>' +
          '<td>' + acts + '</td></tr>';
      }).join('') + '</table>' +
      '<div class="mini">QS prepares → PM approves → Document Control issues to the Engineer → the team records the Engineer’s certificate → Finance records the payment. ' +
      'The next application’s “previous” is always the Engineer’s certified figure.</div></div>';
  }
  function lineVal(l){ var e = PROP_EDIT[l.key]; return e && e.pct != null ? e.pct : l.proposed_pct; }
  function lineNote(l){ var e = PROP_EDIT[l.key]; return e && e.note ? e.note : ''; }
  function propLineHTML(l){
    var pct = lineVal(l);
    return '<tr' + (l.linked ? '' : ' style="background:rgba(200,160,30,.07)"') + '>' +
      '<td>' + esc(l.ref || '') + '</td><td>' + esc(l.description || '') + '</td>' +
      '<td style="text-align:right">' + money(l.amount) + '</td>' +
      '<td style="text-align:right">' + (l.prev_pct || 0) + '%</td>' +
      '<td style="text-align:right" class="mini">' + (l.programme_pct == null ? '—' : l.programme_pct + '%') + '</td>' +
      '<td><input class="ipcpct" data-line="' + esc(l.key) + '" type="text" value="' + pct + '" style="width:64px;text-align:right"></td>' +
      '<td style="text-align:right" data-val="' + esc(l.key) + '">' + money(l.amount * pct / 100) + '</td>' +
      '<td><input class="ipcnote" data-line="' + esc(l.key) + '" type="text" value="' + esc(lineNote(l)) + '" placeholder="note" style="width:130px"></td></tr>';
  }
  function propLinesHTML(){
    var out = '', sec = null;
    (PROP.lines || []).forEach(function(l){
      if (l.section !== sec) { sec = l.section; out += '<tr><td colspan="8" style="background:var(--surface-2,#eef3f9)"><b>' + esc(sec || '(no section)') + '</b></td></tr>'; }
      out += propLineHTML(l);
    });
    return out;
  }
  function voHTML(){
    var vs = PROP.variations || [];
    if (!vs.length) return '<div class="mini">No variations with a value on this project.</div>';
    return '<table><tr><th></th><th>Ref</th><th>Description</th><th style="text-align:right">Amount</th><th>% complete</th><th>Status</th></tr>' +
      vs.map(function(v){
        var on = VO_SEL[v.ref] != null;
        return '<tr' + (v.approved ? '' : ' style="opacity:.55"') + '><td>' + (v.approved ? '<input type="checkbox" class="ipcvo" data-ref="' + esc(v.ref) + '"' + (on ? ' checked' : '') + '>' : '') + '</td>' +
          '<td>' + esc(v.ref) + '</td><td>' + esc(v.title || '') + '</td><td style="text-align:right">' + money(v.amount) + '</td>' +
          '<td>' + (v.approved ? '<input class="ipcvopct" data-ref="' + esc(v.ref) + '" type="text" value="' + (on ? VO_SEL[v.ref] : 100) + '" style="width:60px;text-align:right">' : '') + '</td>' +
          '<td class="mini">' + (v.approved ? 'approved' : 'not approved — cannot be claimed') + '</td></tr>';
      }).join('') + '</table>';
  }
  function mosHTML(){
    return '<table><tr><th>Material</th><th>Unit</th><th>Qty</th><th>Rate</th><th>Delivery note / GRN</th><th></th></tr>' +
      MOS.map(function(m, i){
        var f = function(k, w){ return '<input class="ipcmos" data-i="' + i + '" data-k="' + k + '" type="text" value="' + esc(m[k] || '') + '" style="width:' + w + 'px">'; };
        return '<tr><td>' + f('material', 180) + '</td><td>' + f('unit', 50) + '</td><td>' + f('qty', 70) + '</td><td>' + f('rate', 80) + '</td><td>' + f('ref', 110) + '</td>' +
          '<td><button class="btn" data-mosdel="' + i + '">Remove</button></td></tr>';
      }).join('') + '</table><div class="actbar"><button id="ipcMosAdd">Add a material</button></div>' +
      '<div class="mini">Delivered to site and not yet built in. Paid at ' + ((PROP.terms || {}).mos_pct || 80) + '% of cost under this contract.</div>';
  }
  function checkHTML(){
    var c = IPC_CHECK;
    if (!c) return '<div class="mini">Press “Check the valuation” to see the money and anything that would stop it.</div>';
    var f = c.figures || {};
    var rows = [['Work done to date', f.work_done], ['Approved variations', f.variations], ['Materials on site', f.materials_on_site],
      ['Gross valuation to date', f.gross, 1], ['Less retention', -f.retention], ['Less advance recovered to date', -f.advance_to_date],
      ['Total due to date', f.due_to_date, 1], ['Less previous certificate (' + (f.previous_basis || '') + ')', -f.previous],
      ['Net this application', f.net, 1], ['VAT', f.vat], ['Total payable', f.total_due, 1]];
    return (c.blockers && c.blockers.length ? '<div class="dwarn" style="border-color:var(--bad)"><b>Stops it being raised:</b><ul style="margin:6px 0 0 16px">' +
        c.blockers.map(function(b){ return '<li>' + esc(b) + '</li>'; }).join('') + '</ul></div>' : '') +
      (c.warnings && c.warnings.length ? '<div class="dwarn"><b>For the QS and the PM to read:</b><ul style="margin:6px 0 0 16px">' +
        c.warnings.map(function(b){ return '<li>' + esc(b) + '</li>'; }).join('') + '</ul></div>' : '') +
      '<ul class="facts">' + rows.map(function(r){ return '<li><span class="k">' + (r[2] ? '<b>' + esc(r[0]) + '</b>' : esc(r[0])) + '</span><span class="v">' + (r[2] ? '<b>' + money(r[1]) + '</b>' : money(r[1])) + '</span></li>'; }).join('') + '</ul>';
  }
  function propHTML(){
    var may = (IPC && IPC.may) || {};
    if (!may.raise || state.readonly) return '';
    if (!PROP) {
      return '<div class="card"><h2>New application — QS valuation</h2>' +
        '<div class="frm"><div class="f"><label>Period to</label><input id="ipcTo0" type="date" value="' + ipcToday() + '"></div></div>' +
        '<div class="actbar"><button class="prim" id="ipcPropose">Propose from progress</button></div>' +
        '<div class="mini" id="ipcMsg" style="margin-top:8px">Every BOQ line is proposed from the programme progress of its section at the period end, and never below what is already certified. ' +
        'Nothing is raised until you have been through it.</div></div>';
    }
    if (PROP.error) {
      return '<div class="card"><h2>New application — QS valuation</h2>' +
        '<div class="mini" style="color:var(--bad)">' + esc(PROP.error) + '</div>' +
        '<div class="actbar"><button id="ipcDiscard">Back</button></div></div>';
    }
    var t = PROP.totals || {}, per = PROP.period || {};
    return '<div class="card"><h2>New application — QS valuation ' +
      (PROP.unlinked ? '<span class="r">' + PROP.unlinked + ' need your figure</span>' : '') + '</h2>' +
      (PROP.unlinked ? '<div class="dwarn">' + PROP.unlinked + ' BOQ line' + (PROP.unlinked === 1 ? ' has' : 's have') +
          ' no programme section to read from, so ' + (PROP.unlinked === 1 ? 'it is' : 'they are') + ' carried forward at the certified % and highlighted — set them yourself.</div>' : '') +
      '<div class="frm"><div class="f"><label>Period from</label><input id="ipcFrom" type="date" value="' + esc(per.from || '') + '"></div>' +
        '<div class="f"><label>Period to</label><input id="ipcTo" type="date" value="' + esc(per.to || '') + '"></div></div>' +
      '<div class="sechd" style="margin-top:10px">The complete BOQ — cumulative % to date</div>' +
      '<table><tr><th>Item</th><th>Description</th><th style="text-align:right">Amount</th><th style="text-align:right">Certified</th>' +
      '<th style="text-align:right">Programme</th><th>To date %</th><th style="text-align:right">Value</th><th>Note</th></tr>' + propLinesHTML() + '</table>' +
      '<div class="mini">Contract ' + money(t.contract) + ' · work to date <b id="ipcWork">' +
        money((PROP.lines || []).reduce(function(sum, x){ return sum + x.amount * lineVal(x) / 100; }, 0)) + '</b>. ' +
        'Going below the certified % needs a note on that line.</div>' +
      '<div class="sechd" style="margin-top:14px">Variations</div>' + voHTML() +
      '<div class="sechd" style="margin-top:14px">Materials on site</div>' + mosHTML() +
      '<div class="sechd" style="margin-top:14px">Check</div><div id="ipcCheck">' + checkHTML() + '</div>' +
      '<div class="actbar"><button id="ipcCheckBtn">Check the valuation</button></div>' +
      '<label style="display:flex;gap:8px;align-items:flex-start;margin-top:12px;font-size:13px">' +
        '<input type="checkbox" id="ipcReviewed" style="margin-top:3px">' +
        '<span>I have been through every line above and the percentages are mine.</span></label>' +
      '<div class="actbar" style="margin-top:8px"><button class="prim" id="ipcRaise">Raise the application</button><button id="ipcDiscard">Discard</button></div>' +
      '<div class="mini" id="ipcMsg" style="margin-top:8px"></div></div>';
  }
  function ipcBody(){
    var val = function(id){ var e = document.getElementById(id); return e ? e.value : ''; };
    return {
      lines: (PROP.lines || []).map(function(l){ return { key: l.key, pct: lineVal(l), note: lineNote(l) }; }),
      variations: Object.keys(VO_SEL).map(function(r){ return { ref: r, pct: VO_SEL[r] }; }),
      mos: MOS.filter(function(m){ return m.material || m.qty || m.rate; }),
      period_from: val('ipcFrom'), period_to: val('ipcTo'),
    };
  }
  function ipcPost(url, body){
    return fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      .then(function(r){ return r.json().then(function(j){ return { ok: r.ok, j: j }; }); });
  }
  function wireIPC(){
    var say = function(t, bad){ var m = document.getElementById('ipcMsg'); if (m) { m.textContent = t; m.style.color = bad ? 'var(--bad)' : ''; } };
    var prop = document.getElementById('ipcPropose');
    if (prop) prop.addEventListener('click', function(){
      this.disabled = true; say('Reading progress against the BOQ…');
      var to = (document.getElementById('ipcTo0') || {}).value || '';
      ipcPost('/api/ipc/propose', { period_to: to }).then(function(x){
        PROP = x.j; PROP_EDIT = {}; VO_SEL = {}; MOS = []; IPC_CHECK = null;
        if (PROP && PROP.period && to) PROP.period.to = to;
        ipcRedraw();
      }).catch(function(){ say('Could not reach the server.', true); });
    });
    // Kept in state, so adding a materials row (which redraws the card) keeps them.
    ['ipcFrom', 'ipcTo'].forEach(function(id){
      var el = document.getElementById(id);
      if (el && PROP) el.addEventListener('input', function(){ PROP.period = PROP.period || {}; PROP.period[id === 'ipcFrom' ? 'from' : 'to'] = this.value; IPC_CHECK = null; });
    });
    var byKey = function(k){ return (PROP.lines || []).filter(function(l){ return l.key === k; })[0]; };
    document.querySelectorAll('.ipcpct').forEach(function(inp){
      inp.addEventListener('input', function(){
        var k = this.getAttribute('data-line'), l = byKey(k); if (!l) return;
        var v = Number(String(this.value).replace(/[^0-9.]/g, ''));
        PROP_EDIT[k] = PROP_EDIT[k] || {}; PROP_EDIT[k].pct = isFinite(v) ? v : 0;
        var cell = document.querySelector('[data-val="' + k + '"]'); if (cell) cell.textContent = money(l.amount * PROP_EDIT[k].pct / 100);
        var tot = (PROP.lines || []).reduce(function(s, x){ return s + x.amount * lineVal(x) / 100; }, 0);
        var w = document.getElementById('ipcWork'); if (w) w.textContent = money(tot);
        IPC_CHECK = null;
      });
    });
    document.querySelectorAll('.ipcnote').forEach(function(inp){
      inp.addEventListener('input', function(){ var k = this.getAttribute('data-line'); PROP_EDIT[k] = PROP_EDIT[k] || {}; PROP_EDIT[k].note = this.value; });
    });
    document.querySelectorAll('.ipcvo').forEach(function(cb){
      cb.addEventListener('change', function(){
        var r = this.getAttribute('data-ref'), pctEl = document.querySelector('.ipcvopct[data-ref="' + r + '"]');
        if (this.checked) VO_SEL[r] = Number(pctEl ? pctEl.value : 100) || 0; else delete VO_SEL[r];
      });
    });
    document.querySelectorAll('.ipcvopct').forEach(function(inp){
      inp.addEventListener('input', function(){ var r = this.getAttribute('data-ref'); if (VO_SEL[r] != null) VO_SEL[r] = Number(this.value) || 0; });
    });
    document.querySelectorAll('.ipcmos').forEach(function(inp){
      inp.addEventListener('input', function(){ var i = Number(this.getAttribute('data-i')); if (MOS[i]) MOS[i][this.getAttribute('data-k')] = this.value; });
    });
    var add = document.getElementById('ipcMosAdd');
    if (add) add.addEventListener('click', function(){ MOS.push({ material: '', unit: '', qty: '', rate: '', ref: '' }); ipcRedraw(); });
    document.querySelectorAll('[data-mosdel]').forEach(function(b){
      b.addEventListener('click', function(){ MOS.splice(Number(this.getAttribute('data-mosdel')), 1); ipcRedraw(); });
    });
    var dis = document.getElementById('ipcDiscard');
    if (dis) dis.addEventListener('click', function(){ PROP = null; PROP_EDIT = {}; VO_SEL = {}; MOS = []; IPC_CHECK = null; ipcRedraw(); });
    var chk = document.getElementById('ipcCheckBtn');
    if (chk) chk.addEventListener('click', function(){
      var b = this; b.disabled = true;
      ipcPost('/api/ipc/check', ipcBody()).then(function(x){
        IPC_CHECK = x.j; var el = document.getElementById('ipcCheck'); if (el) el.innerHTML = checkHTML(); b.disabled = false;
      }).catch(function(){ say('Could not reach the server.', true); b.disabled = false; });
    });
    var raise = document.getElementById('ipcRaise');
    if (raise) raise.addEventListener('click', function(){
      var rev = document.getElementById('ipcReviewed');
      if (!rev || !rev.checked) { say('Tick the line above first — an application cannot be raised on a valuation nobody has been through.', true); return; }
      var b = this; b.disabled = true; say('Raising the application…');
      var body = ipcBody(); body.reviewed = true; body.reviewed_by = ME.name;
      ipcPost('/api/ipc', body).then(function(x){
        if (!x.ok) {
          IPC_CHECK = x.j.checks ? { blockers: x.j.checks.blockers, warnings: x.j.checks.warnings, figures: x.j.figures || {} } : IPC_CHECK;
          var el = document.getElementById('ipcCheck'); if (el && IPC_CHECK) el.innerHTML = checkHTML();
          say(x.j.error || 'It was not raised.', true); b.disabled = false; return;
        }
        var res = x.j;
        PROP = null; PROP_EDIT = {}; VO_SEL = {}; MOS = []; IPC_CHECK = null;
        return ipcFetch().then(function(){
          ipcRedraw();
          var m = document.getElementById('ipcMsg');
          if (m) m.textContent = res.ref + ' prepared — net ' + money(res.net) + '. It now goes to the PM to approve.';
        });
      }).catch(function(){ say('Could not reach the server.', true); b.disabled = false; });
    });
  }
  // Each step along the road, from the applications list.
  document.addEventListener('click', function(ev){
    var t = ev.target.closest ? ev.target.closest('[data-ipc]') : null;
    if (!t) return;
    ev.preventDefault(); ev.stopImmediatePropagation();
    var action = t.getAttribute('data-ipc'), ref = t.getAttribute('data-ref');
    var body = { ref: ref, action: action };
    if (action === 'approve') { if (!confirm('Approve ' + ref + ' for Document Control to issue?')) return; }
    else if (action === 'return' || action === 'engineer_return') {
      var why = prompt('Why is ' + ref + ' being returned?', ''); if (!why) return; body.note = why;
    } else if (action === 'issue') {
      var d = prompt('Date ' + ref + ' was issued to the Engineer (YYYY-MM-DD)', ipcToday()); if (!d) return; body.date = d;
    } else if (action === 'certify') {
      var amt = prompt('Net amount the Engineer certified on ' + ref + ' (before VAT)', ''); if (!amt) return;
      body.certified_amount = amt;
      body.engineer_ref = prompt('The Engineer’s certificate number', '') || '';
      body.date = prompt('Date of the certificate (YYYY-MM-DD)', ipcToday()) || ipcToday();
    } else if (action === 'pay') {
      var paid = prompt('Amount received against ' + ref, ''); if (!paid) return;
      body.paid_amount = paid;
      body.date = prompt('Date received (YYYY-MM-DD)', ipcToday()) || ipcToday();
    }
    t.disabled = true;
    ipcPost('/api/ipc/advance', body).then(function(x){
      if (!x.ok) { alert(x.j.error || 'That did not work.'); t.disabled = false; return; }
      if (x.j.note) alert(x.j.note);
      return ipcFetch().then(function(){ ipcRedraw(); });
    }).catch(function(){ alert('Could not reach the server.'); t.disabled = false; });
  }, true);
  // Supporting documents attached to an application go into its pack.
  document.addEventListener('click', function(ev){
    var t = ev.target.closest ? ev.target.closest('[data-ipcattach]') : null;
    if (!t) return;
    ev.preventDefault(); ev.stopImmediatePropagation();
    var ref = t.getAttribute('data-ipcattach');
    var inp = document.createElement('input'); inp.type = 'file'; inp.multiple = true;
    inp.addEventListener('change', function(){
      var files = Array.prototype.slice.call(inp.files || []);
      var done = 0, bad = [];
      files.forEach(function(f){
        var rd = new FileReader();
        rd.onload = function(){
          var b64 = String(rd.result || '').split(',')[1] || '';
          ipcPost('/api/attachment', { ref: ref, filename: f.name, mime: f.type || 'application/octet-stream', file_b64: b64 })
            .then(function(x){ if (!x.ok) bad.push(f.name + ': ' + (x.j.error || 'refused')); })
            .catch(function(){ bad.push(f.name); })
            .then(function(){ done++; if (done === files.length) alert(bad.length ? 'Not attached — ' + bad.join('; ') : files.length + ' file' + (files.length === 1 ? '' : 's') + ' attached to ' + ref + '. They go into its pack.'); });
        };
        rd.readAsDataURL(f);
      });
    });
    inp.click();
  }, true);
  window.__ipcView = function(){
    if (!IPC_TRIED) ipcFetch().then(function(){ ipcRedraw(); });
    if (IPC && IPC.denied) return '<div class="card"><h2>Payment applications</h2><div class="mini">Payment is not part of your access.</div></div>';
    setTimeout(function(){ try { wireIPC(); } catch (e) {} }, 0);
    return ipcCertsHTML() + propHTML();
  };
  function installLiveIPC(){
    if (typeof render !== 'function') return;
    var orig = render;
    window.render = function(){
      orig.apply(this, arguments);
      var cards = document.querySelectorAll('.card');
      for (var i = 0; i < cards.length; i++) {
        var h = cards[i].querySelector('h2');
        if (!h || !/^Payment certificates/.test(h.textContent || '')) continue;
        if (IPC && IPC.denied) {
          cards[i].innerHTML = '<h2>Payment certificates</h2>' +
            '<div class="mini">Payment is not part of your access.</div>';
          break;
        }
        var holder = document.createElement('div');
        holder.innerHTML = ipcCertsHTML() + propHTML();
        cards[i].parentNode.replaceChild(holder, cards[i]);
        wireIPC();
        if (!IPC_TRIED) ipcFetch().then(function(){ try { render(); } catch (e) {} });
        break;
      }
    };
  }

  /* ==================================================================
   * THE DESIGN'S OWN FICTION, REMOVED AT SOURCE.
   *
   * These are not missing features. They are the design prototype's worked
   * examples still behaving as if they were this project's data, and each one
   * was verified on screen before it was fixed here.
   * ================================================================== */

  // 1. The date. The design froze TODAY at 2026-09-13, so every "overdue" flag
  //    in every register was computed against a fixed day in the past.
  try { window.TODAY = new Date().toISOString().slice(0, 10); } catch (e) {}

  // 2. The create forms shipped pre-filled with the design's examples, and
  //    genConfirm reads whatever is in the field. Pressing Generate on an
  //    untouched form raised a REAL, numbered, routed RFI reading "300mm duct
  //    clashes with beam B12 at L5". The options of a select are the choices,
  //    not a default, so those stay.
  // The certificate register had no form at all — the design listed lifting
  // gear and operator licences that nobody could ever add to.
  function addMissingForms(){
    if (typeof FORMS === 'undefined' || FORMS.cert) return;
    FORMS.cert = { title: 'Log a certificate', ref: '', to: 'HSE',
      fields: [['Certificate', 'text', '', 1], ['Issued by', 'text', '', 1],
               ['Serial / plant no', 'text', '', 0], ['Issued', 'date', '', 0],
               ['Expires', 'date', '', 1],
               ['Certificate (PDF)', 'file', '', 1]],
      wf: ['Logged', 'Checked by HSE', 'Valid on site'] };
    try { FORM_TO_TYPE.cert = 'cert'; } catch (e) {}
  }
  addMissingForms();

  function blankFormDefaults(){
    if (typeof FORMS === 'undefined') return;
    Object.keys(FORMS).forEach(function(k){
      (FORMS[k].fields || []).forEach(function(f){
        if (f[1] === 'select' || f[1] === 'file') return;
        f[2] = '';
      });
      // The form header promised a reference the server had not allocated yet.
      FORMS[k].ref = '';
    });
  }
  blankFormDefaults();

  // 3. The design draws its own update panel for any ref starting "ACT-", so a
  //    programme using those codes showed TWO panels — and the design's one
  //    threw the engineer's input away.
  try { if (typeof activityPanel === 'function') window.activityPanel = function(){ return ''; }; } catch (e) {}

  // 4. The project switcher rewrote the project name from a hardcoded list of
  //    three, so choosing a project renamed it to somebody else's — and a
  //    fourth project threw. The generator's own switcher is the only one.
  try {
    var _ps = document.getElementById('projSel');
    if (_ps && _ps.parentNode) {
      var _clone = _ps.cloneNode(true);            // drops the design's listener
      _ps.parentNode.replaceChild(_clone, _ps);
    }
  } catch (e) {}

  // 5. The Principal's portfolio was three fabricated projects — two of them
  //    OTHER COMPANIES. A client seeing another client's project on their own
  //    dashboard is the end of the conversation, so this is replaced with the
  //    company's real projects, from the server.
  var PORT = null, PORT_TRIED = false;
  function portFetch(){
    PORT_TRIED = true;
    return fetch('/api/portfolio', { cache: 'no-store' })
      .then(function(r){ return r.ok ? r.json() : { projects: [] }; })
      .then(function(d){ PORT = d || { projects: [] }; return PORT; })
      .catch(function(){ PORT = { projects: [] }; return PORT; });
  }
  function portfolioHTML(){
    if (!PORT) return '<div class="card"><h2>Projects</h2><div class="mini">Loading…</div></div>';
    var ps = PORT.projects || [];
    if (!ps.length) {
      return '<div class="card"><h2>Projects</h2>' +
        '<div class="mini">No project has been set up for your company yet. ' +
        'AETRAA sets each one up before the team is given access.</div></div>';
    }
    return '<div class="card"><h2>Projects <span class="r">' + ps.length +
      (ps.length === 1 ? ' project' : ' projects') + '</span></h2><div class="pf">' +
      ps.map(function(p){
        var st = p.stats || {};
        var pct = Math.round((st.pct || 0) * 100);
        var tags = [];
        if (st.flagged) tags.push([st.flagged + ' flagged', 'r']);
        if (st.target_missed) tags.push([st.target_missed + ' target missed', 'a']);
        if (!st.activities) tags.push(['no programme yet', 'a']);
        return pcard(p.id, esc(p.name || 'Project'), esc(p.ref || p.location || ''), pct,
          st.last_finish ? fmtd(st.last_finish) : '—', tags);
      }).join('') + '</div></div>' +
      '<div class="card"><h2>Progress by project <span class="r">from the programme</span></h2>' +
      bars(ps.map(function(p){ return [p.name || 'Project', Math.round(((p.stats || {}).pct || 0) * 100)]; })) +
      '<div class="mini">Each figure is the weighted progress of that project’s own programme. ' +
      'Nothing here is an estimate.</div></div>';
  }
  function installLivePortfolio(){
    if (typeof render !== 'function') return;
    var orig = render;
    window.render = function(){
      orig.apply(this, arguments);
      if (state.role !== 'principal' || state.pview) return;
      var left = document.getElementById('leftcol');
      if (!left) return;
      var cards = left.querySelectorAll('.card');
      // The design's first two cards on this dashboard are the fabricated
      // portfolio and its consolidated-progress bars.
      var first = null, second = null;
      for (var i = 0; i < cards.length; i++) {
        var h = cards[i].querySelector('h2');
        if (!h) continue;
        if (/^Projects/.test(h.textContent || '') && !first) first = cards[i];
        else if (/^Consolidated progress|^Progress by project/.test(h.textContent || '') && !second) second = cards[i];
      }
      if (!first) return;
      if (second && second.parentNode) second.parentNode.removeChild(second);
      var holder = document.createElement('div');
      holder.innerHTML = portfolioHTML();
      first.parentNode.replaceChild(holder, first);
      if (!PORT_TRIED) portFetch().then(function(){ try { render(); } catch (e) {} });
    };
  }

  // 6. An empty programme divided by zero, so Planning showed "NaN%" for actual
  //    progress and variance. Caught at the counter and on the page, because a
  //    number nobody can read is worse than an empty one.
  function installNaNGuard(){
    if (typeof render !== 'function') return;
    var orig = render;
    window.render = function(){
      orig.apply(this, arguments);
      ['kpis', 'leftcol', 'rightcol', 'rolebar'].forEach(function(id){
        var root = document.getElementById(id);
        if (!root) return;
        var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
        var n, hits = [];
        while ((n = w.nextNode())) { if (n.nodeValue && n.nodeValue.indexOf('NaN') >= 0) hits.push(n); }
        hits.forEach(function(x){ x.nodeValue = x.nodeValue.replace(/NaN%?/g, '—'); });
      });
    };
  }

  /* ==================================================================
   * ONE PLACE THAT KNOWS THE REAL COUNTS.
   *
   * Every headline counter and every sidebar badge in the design is a literal
   * — 48 drawings, 87% first-time pass, 142 days LTI-free, 7 RFIs. On a live
   * project those are somebody else's numbers. Everything below is computed
   * from what this project actually holds, and anything that CANNOT honestly
   * be computed shows an em dash rather than a plausible figure.
   * ================================================================== */
  var LIVE = { records: [], drawings: null, drawTried: false };

  function liveToday(){ return new Date().toISOString().slice(0, 10); }
  // Closed is what the server says: no step left to sign. (Guessing from the
  // status text read "Code C — Revise & resubmit" as open and "Approved" as shut.)
  function isClosed(r){
    if (r && r.next_step === null) return true;
    if (r && typeof r.next_step === 'string') return false;
    return /closed|approved|rejected|paid|certified|issued|complete/i.test(r.status || '');
  }
  // 'letter' counts both directions: letters we send and incoming letters (Step 7).
  function ofType(t){ return LIVE.records.filter(function(r){ return r.type === t || (t === 'letter' && r.type === 'incoming'); }); }
  function openOf(t){ return ofType(t).filter(function(r){ return !isClosed(r); }); }
  function overdueOf(t){
    var d = liveToday();
    return openOf(t).filter(function(r){ return r.due && r.due < d; });
  }
  function nOrDash(n){ return (n === null || n === undefined || isNaN(n)) ? '—' : String(n); }
  function pctOrDash(n){ return (n === null || n === undefined || isNaN(n)) ? '—' : (Math.round(n) + '%'); }

  function actStats(){
    var a = (typeof ACTIVITIES !== 'undefined') ? ACTIVITIES : [];
    if (!a.length) return { total: 0, done: 0, running: 0, pct: null, flagged: 0 };
    var done = 0, running = 0, sum = 0, flagged = 0;
    a.forEach(function(x){
      sum += x.pct || 0;
      if (x.pct >= 100) done++;
      else if (x.pct > 0) running++;
      if (/critical/.test(x.tag || '')) flagged++;
    });
    return { total: a.length, done: done, running: running, pct: sum / a.length, flagged: flagged };
  }
  function peopleCount(){
    try { return Object.keys(ACCOUNTS).length; } catch (e) { return 0; }
  }
  function drawFetch(){
    LIVE.drawTried = true;
    return fetch('/api/drawings', { cache: 'no-store' })
      .then(function(r){ return r.ok ? r.json() : { drawings: [] }; })
      .then(function(d){ LIVE.drawings = (d && d.drawings) || []; })
      .catch(function(){ LIVE.drawings = []; });
  }
  function drawStats(){
    var d = LIVE.drawings;
    if (!d) return { total: null, current: null, awaiting: null };
    return {
      total: d.length,
      current: d.filter(function(x){ return /current|approved/i.test(x.status || ''); }).length,
      awaiting: d.filter(function(x){ return /await|review|submitted/i.test(x.status || ''); }).length,
    };
  }
  function moneyShort(v){
    var n = Number(v || 0);
    if (!n) return '—';
    if (n >= 1e6) return (n / 1e6).toFixed(2) + 'm';
    if (n >= 1e3) return Math.round(n / 1e3) + 'k';
    return String(Math.round(n));
  }
  function ipcStats(){
    var cs = (IPC && IPC.certificates) || null;
    if (!cs) return { certified: null, latestNet: null, open: null };
    var certified = cs.filter(function(c){ return /certified|paid/i.test(c.status || ''); })
      .reduce(function(s, c){ return s + (c.net || 0); }, 0);
    var latest = cs[0] || null;
    return { certified: certified, latestNet: latest ? latest.net : null,
             open: cs.filter(function(c){ return !/paid/i.test(c.status || ''); }).length };
  }
  function bomStats(){
    if (!BOM || BOM.denied) return { lines: null, over: null, awaiting: null };
    var l = BOM.lines || [];
    return { lines: l.length, over: l.filter(function(x){ return x.over; }).length,
             awaiting: l.filter(function(x){ return (x.awaiting_delivery || 0) > 0; }).length };
  }

  // The KPI row for each dashboard, from real data only.
  function liveKpis(role){
    var A = actStats(), D = drawStats(), I = ipcStats(), B = bomStats();
    var cur = (typeof CURRENCY !== 'undefined') ? CURRENCY : 'AED';
    switch (role) {
      case 'principal': {
        var ps = (PORT && PORT.projects) || null;
        var pf = ps && ps.length
          ? ps.reduce(function(s, p){ return s + ((p.stats || {}).pct || 0); }, 0) / ps.length * 100
          : null;
        return [[nOrDash(ps ? ps.length : null), ps && ps.length === 1 ? 'Live project' : 'Live projects', 'act'],
                [pctOrDash(pf), 'Portfolio complete', ''],
                [nOrDash(LIVE.records.filter(function(r){ return !isClosed(r); }).length), 'Open items', ''],
                [I.certified === null ? '—' : cur + ' ' + moneyShort(I.certified), 'Certified to date', 'good']];
      }
      case 'pm':
        return [[nOrDash(A.total || null), 'Activities', 'act'],
                [pctOrDash(A.pct), 'Progress', ''],
                [nOrDash(A.done), 'Awaiting sign-off', 'warn'],
                [nOrDash(LIVE.records.filter(function(r){ return !isClosed(r); }).length), 'Open records', ''],
                [nOrDash(LIVE.records.filter(function(r){ return r.due && r.due < liveToday() && !isClosed(r); }).length), 'Overdue', 'bad'],
                [nOrDash(peopleCount()), 'People', '']];
      case 'planning':
        return [[nOrDash(A.total || null), 'Activities', 'act'],
                [pctOrDash(A.pct), 'Actual (live)', ''],
                [nOrDash(A.running), 'In progress', ''],
                [nOrDash(A.done), 'Complete', 'good'],
                [nOrDash(A.flagged), 'Flagged', 'bad']];
      case 'design':
        return [[nOrDash(D.total), 'Drawings', 'act'],
                [nOrDash(D.awaiting), 'With consultant', 'warn'],
                [nOrDash(openOf('submittal').length), 'Submittals open', ''],
                [nOrDash(openOf('rfi').length), 'RFIs open', ''],
                [nOrDash(overdueOf('rfi').length + overdueOf('submittal').length), 'Overdue', 'bad'],
                [nOrDash(openOf('material').length), 'Material approvals', '']];
      case 'dc':
        return [[nOrDash(D.total), 'Drawings', ''],
                [nOrDash(ofType('submittal').length), 'Submittals', ''],
                [nOrDash(ofType('rfi').length), 'RFIs', ''],
                [nOrDash(ofType('letter').length), 'Letters', ''],
                [nOrDash(LIVE.records.length), 'Records in total', 'act']];
      case 'qaqc': {
        var wir = ofType('wir').concat(ofType('mir'));
        var closedWir = wir.filter(isClosed).length;
        return [[nOrDash(wir.filter(function(r){ return !isClosed(r); }).length), 'Inspections open', 'act'],
                [nOrDash(openOf('ncr').length), 'NCRs open', 'bad'],
                [nOrDash(ofType('ncr').length), 'NCRs raised', ''],
                [wir.length ? pctOrDash(closedWir / wir.length * 100) : '—', 'Inspections closed', ''],
                [nOrDash(overdueOf('wir').length), 'Overdue', 'warn']];
      }
      case 'hse':
        return [[nOrDash(openOf('ptw').length), 'Permits live', 'act'],
                [nOrDash(openOf('obs').length), 'Observations open', 'warn'],
                [nOrDash(ofType('incident').length), 'Incidents recorded', ofType('incident').length ? 'bad' : 'good'],
                [nOrDash(ofType('obs').length), 'Observations raised', ''],
                [nOrDash(overdueOf('obs').length), 'Overdue', 'bad']];
      case 'commercial':
        return [[I.certified === null ? '—' : cur + ' ' + moneyShort(I.certified), 'Certified to date', 'good'],
                [I.latestNet === null ? '—' : cur + ' ' + moneyShort(I.latestNet), 'Latest application', 'act'],
                [nOrDash(openOf('variation').length), 'Variations open', 'warn'],
                [nOrDash(B.over), 'Over BOM', B.over ? 'bad' : ''],
                [nOrDash(openOf('letter').length), 'Letters open', ''],
                [nOrDash(I.open), 'Certificates open', '']];
      case 'procurement':
        return [[nOrDash(openOf('mr').length), 'Requests to action', 'act'],
                [nOrDash(B.over), 'Over BOM', B.over ? 'bad' : ''],
                [nOrDash(B.awaiting), 'Awaiting delivery', 'warn'],
                [nOrDash(B.lines), 'BOM lines', ''],
                [nOrDash(ofType('mr').length), 'Requests in total', '']];
      case 'finance':
        return [[I.latestNet === null ? '—' : cur + ' ' + moneyShort(I.latestNet), 'Latest application', 'act'],
                [I.certified === null ? '—' : cur + ' ' + moneyShort(I.certified), 'Certified to date', 'good'],
                [nOrDash(I.open), 'Certificates open', 'warn'],
                [nOrDash(B.awaiting), 'Deliveries awaited', '']];
      case 'consultant': {
        var withThem = LIVE.records.filter(function(r){ return !isClosed(r); });
        return [[nOrDash(withThem.length), 'Items with you', 'act'],
                [nOrDash(withThem.filter(function(r){ return r.due && r.due < liveToday(); }).length), 'Overdue', 'bad'],
                [pctOrDash(A.pct), 'Progress reported', '']];
      }
      case 'subcon':
        return [[nOrDash(LIVE.records.filter(function(r){ return !isClosed(r); }).length), 'Open items', 'act'],
                [pctOrDash(A.pct), 'Progress', '']];
      case 'team':
        return [[nOrDash(peopleCount()), 'People', 'act'],
                [nOrDash((ME.projects || []).length), 'Projects', ''],
                [nOrDash(13), 'Functions', '']];
      default:
        return null;                                   // leave the design's row alone
    }
  }
  function installLiveKpis(){
    if (typeof render !== 'function') return;
    var orig = render;
    window.render = function(){
      orig.apply(this, arguments);
      if (state.pview) return;
      var k = liveKpis(state.role);
      if (!k) return;
      var row = document.getElementById('kpis');
      if (!row) return;
      row.style.gridTemplateColumns = 'repeat(' + k.length + ',1fr)';
      row.innerHTML = k.map(function(x){ return kpi(x[0], x[1], x[2]); }).join('');
      if (!LIVE.drawTried && (state.role === 'design' || state.role === 'dc' || state.role === 'pm')) {
        drawFetch().then(function(){ try { render(); } catch (e) {} });
      }
      if (!BOM_TRIED && (state.role === 'commercial' || state.role === 'procurement' || state.role === 'finance')) {
        bomFetch().then(function(){ try { render(); } catch (e) {} });
      }
      if (!IPC_TRIED && (state.role === 'commercial' || state.role === 'finance' || state.role === 'principal')) {
        ipcFetch().then(function(){ try { render(); } catch (e) {} });
      }
      if (!PORT_TRIED && state.role === 'principal') {
        portFetch().then(function(){ try { render(); } catch (e) {} });
      }
    };
  }

  // The sidebar badges were literals too — "RFIs 7" on a project with none.
  var NAV_COUNT = {
    'RFIs': function(){ return openOf('rfi').length; },
    'RFI register': function(){ return ofType('rfi').length; },
    'RFIs to answer': function(){ return openOf('rfi').length; },
    'Raise RFI': function(){ return null; },
    'Submittals': function(){ return openOf('submittal').length; },
    'Submittal register': function(){ return ofType('submittal').length; },
    'Submittals to review': function(){ return openOf('submittal').length; },
    'Inspections': function(){ return openOf('wir').length + openOf('mir').length; },
    'Inspections (WIR/MIR)': function(){ return openOf('wir').length + openOf('mir').length; },
    'NCRs': function(){ return openOf('ncr').length; },
    'NCR register': function(){ return ofType('ncr').length; },
    'NCRs on me': function(){ return openOf('ncr').length; },
    'Variations': function(){ return openOf('variation').length; },
    'Variation register': function(){ return ofType('variation').length; },
    'Claims & variations': function(){ return openOf('variation').length; },
    'Letters': function(){ return openOf('letter').length; },
    'Contractual letters': function(){ return openOf('letter').length; },
    'Correspondence diary': function(){ return ofType('letter').length; },
    'Permits to work': function(){ return openOf('ptw').length; },
    'Observations / near-miss': function(){ return openOf('obs').length; },
    'Incidents': function(){ return ofType('incident').length; },
    'Material requests': function(){ return openOf('mr').length; },
    'Material approvals': function(){ return openOf('material').length; },
    'Decisions to me': function(){ return LIVE.records.filter(function(r){ return !isClosed(r); }).length; },
    'Drawings': function(){ return (drawStats().total === null) ? null : drawStats().total; },
    'Drawing register': function(){ return drawStats().total; },
    'Bill of Materials': function(){ return bomStats().over || null; },
    'Team & access': function(){ return peopleCount(); },
    'Projects (fixed)': function(){ return (ME.projects || []).length; },
  };
  function installLiveNavBadges(){
    if (typeof drawNav !== 'function') return;
    var orig = drawNav;
    window.drawNav = function(){
      // Recompute every badge from this project before the design draws it.
      try {
        Object.keys(NAV).forEach(function(rk){
          NAV[rk].forEach(function(grp){
            grp[1].forEach(function(item){
              if (item[2] === 'on') return;
              var f = NAV_COUNT[item[1]];
              if (!f) { item[2] = ''; return; }          // no honest source — no badge
              var n = f();
              item[2] = (n === null || n === undefined || !n) ? '' : String(n);
            });
          });
        });
      } catch (e) {}
      orig.apply(this, arguments);
    };
  }

  /* ==================================================================
   * THE SIDEBAR. Around a hundred links across fourteen dashboards, none of
   * which did anything: no href, no handler, nothing listening. Every one of
   * them now goes somewhere, and where the platform genuinely has nothing
   * behind a link it says so plainly instead of swallowing the click.
   * ================================================================== */
  var NAV_TARGET = {
    // --- registers -------------------------------------------------------
    'Drawings': { reg: 'drawings' }, 'Drawing register': { reg: 'drawings' },
    'Drawings on site': { reg: 'drawings' }, 'Shop drawings': { reg: 'drawings' },
    'IFC — current': { reg: 'drawings' }, 'Tender': { reg: 'drawings' },
    'Drawing approvals': { reg: 'drawings' },
    'Submittals': { reg: 'submittals' }, 'Submittal register': { reg: 'submittals' },
    'Submittals to review': { reg: 'submittals' }, 'Transmittals': { reg: 'submittals' },
    'RFIs': { reg: 'rfi' }, 'RFI register': { reg: 'rfi' }, 'RFIs to answer': { reg: 'rfi' },
    'Inspections': { reg: 'inspections' }, 'Inspections (WIR/MIR)': { reg: 'inspections' },
    'Witness inspections': { reg: 'inspections' }, 'Sub inspections': { reg: 'inspections' },
    'Safety inspection': { reg: 'inspections' },
    'NCRs': { reg: 'ncr' }, 'NCR register': { reg: 'ncr' }, 'NCRs on me': { reg: 'ncr' },
    'Quality audits': { reg: 'ncr' },
    'Variations': { reg: 'variations' }, 'Variation register': { reg: 'variations' },
    'Claims & variations': { reg: 'variations' }, 'Claims & EoT': { reg: 'variations' },
    'Delay & EoT': { reg: 'variations' },
    'Letters': { reg: 'letters' }, 'Contractual letters': { reg: 'letters' },
    'Correspondence diary': { reg: 'letters' }, 'Incoming / outgoing': { reg: 'letters' },
    'Notices & obligations': { reg: 'letters' },
    'Permits to work': { reg: 'permits' },
    'Observations / near-miss': { reg: 'hseobs' }, 'Incidents': { reg: 'hseobs' },
    'Material approvals': { reg: 'matapp' },
    'Material requests': { reg: 'mr' }, 'Procurement log': { reg: 'mr' },
    'Authority approvals': { reg: 'authority' }, 'Authority safety': { reg: 'authority' },
    'BOQ / cost plan': { reg: 'boq' }, 'Cost value reconciliation': { reg: 'boq' },
    'IPC / payments': { reg: 'ipc' }, 'Payments in (IPC)': { reg: 'ipc' },
    'Certify IPC': { reg: 'ipc' }, 'Cashflow / IPC': { reg: 'ipc' }, 'Cashflow': { reg: 'ipc' },
    'Test records': { reg: 'certs' }, 'ITP / checklists': { reg: 'certs' },
    'Certificates': { reg: 'certs' },
    'Toolbox / induction': { reg: 'certs' },
    // --- other dashboards ------------------------------------------------
    'Dashboard': { dash: 'self' },
    'All projects': { dash: 'principal' }, 'Consolidated progress': { dash: 'principal' },
    'Team & access': { dash: 'team' }, 'Roles & permissions': { dash: 'team' },
    'HSE': { dash: 'hse' }, 'Safety (portfolio)': { dash: 'hse' },
    'HSE statistics': { act: 'hse:weekly' }, 'Sub HSE compliance': { act: 'hse:weekly' },
    'Subcontractors': { dash: 'subcon' },
    'Bill of Materials': { bom: 1 },
    'Purchase orders (LPO)': { moves: 'order', t: 'Purchase orders' },
    'Deliveries / GRN': { moves: 'grn', t: 'Deliveries received' },
    'GRN — receive': { moves: 'grn', t: 'Deliveries received' },
    'GRN \u2192 invoice match': { moves: 'grn', t: 'Deliveries received' },
    'Suppliers': { moves: 'all', t: 'Supply movements' },
    'Quality (portfolio)': { dash: 'qaqc' }, 'QA reports': { act: 'report:weekly' },
    'Programme': { prog: 'all' }, 'Baseline programme': { prog: 'all' },
    'P6 update & export': { page: '/programme' },
    'Minutes': { page: '/minutes' }, 'Action tracker': { page: '/minutes?tab=actions' },
    'Progress update': { dash: 'site' },
    'Look-ahead': { prog: 'lookahead' }, '3-week look-ahead': { prog: 'lookahead' },
    'Critical path': { prog: 'critical' },
    'S-curve / earned value': { prog: 'curve' },
    'Payments out': { moves: 'all', t: 'Supply movements' },
    'Supplier invoices': { moves: 'all', t: 'Supply movements' },
    'GRN → invoice match': { moves: 'grn', t: 'Deliveries received' },
    'Manpower & plant': { manpower: 1 }, 'Daily diary': { diary: 1 },
    // --- things that DO something ----------------------------------------
    'Weekly report': { act: 'report:weekly' }, 'Monthly report': { act: 'report:monthly' },
    'Reports': { act: 'report:weekly' },
    'Monthly HSE': { act: 'report:hse' },
    'Raise RFI': { form: 'rfi' }, 'Raise inspection (WIR)': { form: 'wir' },
    'Invite / assign': { form: 'assign' },
    'Generate schedule': { act: 'sched:submittals' },
    'Decisions to me': { open: 1 }, 'NCRs on me': { reg: 'ncr' },
    'Awaiting your action': { open: 1 },
    'Projects (fixed)': { dash: 'team' },
    'Distribution matrix': { dash: 'team' },
    'All projects': { portfolio: 1 },
    'Consolidated progress': { prog: 'curve' },
    'Reports': { act: 'report:weekly' },
  };
  // Links whose feature genuinely does not exist yet. Named, so the click is
  // answered honestly rather than ignored.
  var NAV_NOTYET = {
    'Sub valuations': 'Subcontractor accounts are not kept on this platform yet \u2014 there is no subcontract, no valuation and no payment record behind this.',
    'Subcontractor valuations': 'Subcontractor accounts are not kept on this platform yet \u2014 there is no subcontract, no valuation and no payment record behind this.',
    'Sub programme': 'Subcontractor programmes are not held separately \u2014 the project programme is the only one on this platform.',
    'Contract documents': 'The contract document set has not been loaded for this project.',
    'Tender ↔ IFC deviations': 'The tender-to-IFC comparison is not set up on this project.',
  };

  function regExists(k){ return typeof REG !== 'undefined' && REG[k]; }
  function showRegister(kind){
    if (!regExists(kind)) return false;
    state.navView = { reg: kind };
    var L = document.getElementById('leftcol'), R = document.getElementById('rightcol');
    if (!L) return false;
    setWide(true);
    L.innerHTML = '<div class="card" style="border-left:3px solid var(--blue)">' +
      '<div class="mini"><a data-navback="1" style="cursor:pointer;text-decoration:underline">‹ back to ' +
      esc(ROLE[state.role].page) + '</a></div></div>' + regTable(kind);
    if (R) R.innerHTML = '';
    document.getElementById('pageTitle').textContent = REG[kind].title;
    return true;
  }
  window.__showRegister = showRegister;
  function showNotYet(label, why){
    var L = document.getElementById('leftcol'), R = document.getElementById('rightcol');
    if (!L) return;
    state.navView = { note: label };
    setWide(true);
    L.innerHTML = '<div class="card"><h2>' + esc(label) + '</h2>' +
      '<div class="mini">' + esc(why) + ' Nothing is shown here rather than something invented. ' +
      'Tell AETRAA if this project needs it.</div>' +
      '<div class="actbar" style="margin-top:10px"><button data-navback="1">‹ Back</button></div></div>';
    if (R) R.innerHTML = '';
    document.getElementById('pageTitle').textContent = label;
  }
  // The programme, as a screen. The design has no programme view of its own —
  // it only ever showed the planner's dashboard — so links like "Baseline
  // programme", "Critical path" and "3-week look-ahead" had nowhere to go.
  function showProgramme(mode, label){
    var acts = (typeof ACTIVITIES !== 'undefined') ? ACTIVITIES.slice() : [];
    var title = label || 'Programme';
    var note = 'Every activity in this project’s programme, as imported.';
    if (mode === 'critical') {
      acts = acts.filter(function(a){ return /critical/.test(a.tag || ''); });
      note = 'Activities the programme has flagged. Nothing here is inferred — ' +
             'it is what the imported status says.';
    } else if (mode === 'lookahead') {
      var from = liveToday();
      var to = new Date(Date.now() + 21 * 86400000).toISOString().slice(0, 10);
      acts = acts.filter(function(a){
        return a.pct < 100 && ((a.start && a.start <= to) || (a.finish && a.finish >= from && a.finish <= to));
      });
      note = 'What is due to be worked in the next three weeks, from the programme dates.';
    } else if (mode === 'curve') {
      note = 'Progress against the programme, by section. The bar is the weighted ' +
             'percentage each section has actually reported.';
    }
    var L = document.getElementById('leftcol'), R = document.getElementById('rightcol');
    if (!L) return;
    state.navView = { prog: mode };
    setWide(true);
    if (!acts.length) {
      L.innerHTML = backBar() + '<div class="card"><h2>' + esc(title) + '</h2>' +
        '<div class="mini">' + (typeof ACTIVITIES !== 'undefined' && ACTIVITIES.length
          ? 'Nothing matches this view right now.'
          : 'No programme has been imported for this project yet. AETRAA loads the ' +
            'Primavera file at project setup, and every date on the platform comes from it.') +
        '</div></div>';
      if (R) R.innerHTML = '';
      document.getElementById('pageTitle').textContent = title;
      return;
    }
    if (mode === 'curve') {
      var bySec = {};
      acts.forEach(function(a){
        var k = a.wbs || a.disc || 'Other';
        (bySec[k] = bySec[k] || []).push(a.pct || 0);
      });
      L.innerHTML = backBar() + '<div class="card"><h2>' + esc(title) + '</h2>' +
        bars(Object.keys(bySec).map(function(k){
          var v = bySec[k];
          return [k, Math.round(v.reduce(function(s, x){ return s + x; }, 0) / v.length)];
        })) + '<div class="mini">' + note + '</div></div>';
    } else {
      L.innerHTML = backBar() + '<div class="card"><h2>' + esc(title) +
        ' <span class="r">' + acts.length + '</span></h2>' +
        '<table><tr><th>Activity</th><th>Section</th><th>Start</th><th>Finish</th>' +
        '<th>Discipline</th><th style="text-align:right">Progress</th></tr>' +
        acts.map(function(a){
          return '<tr class="click" data-open="' + esc(a.ref) + '">' +
            '<td><span class="ref">' + esc(a.ref) + '</span> ' + esc(a.name) + '</td>' +
            '<td>' + esc(a.wbs || '—') + '</td>' +
            '<td>' + (a.start ? fmtd(a.start) : '—') + '</td>' +
            '<td>' + (a.finish ? fmtd(a.finish) : '—') + '</td>' +
            '<td>' + esc(a.disc || '—') + '</td>' +
            '<td style="text-align:right">' + Math.round(a.pct || 0) + '%</td></tr>';
        }).join('') + '</table><div class="mini">' + note + '</div></div>';
    }
    if (R) R.innerHTML = '';
    document.getElementById('pageTitle').textContent = title;
  }
  // Everything open, in one list, oldest deadline first.
  function showDecisions(){
    var open = LIVE.records.filter(function(r){ return !isClosed(r); });
    open.sort(function(x, y){ return String(x.due || '9999').localeCompare(String(y.due || '9999')); });
    var L = document.getElementById('leftcol'), R = document.getElementById('rightcol');
    if (!L) return;
    state.navView = { decisions: 1 };
    setWide(true);
    var d = liveToday();
    L.innerHTML = backBar() + '<div class="card"><h2>Open items <span class="r">' + open.length + '</span></h2>' +
      (open.length
        ? '<table><tr><th>Ref</th><th>What</th><th>Type</th><th>Action by</th><th>Status</th></tr>' +
          open.map(function(r){
            var late = r.due && r.due < d;
            return '<tr class="click" data-open="' + esc(r.ref) + '">' +
              '<td><span class="ref">' + esc(r.ref) + '</span></td><td>' + esc(r.title) + '</td>' +
              '<td>' + esc(String(r.type || '').toUpperCase()) + '</td>' +
              '<td' + (late ? ' style="color:var(--bad)"' : '') + '>' + (r.due ? fmtd(r.due) : '—') + '</td>' +
              '<td>' + pill(r.status, r.cls || '') + '</td></tr>';
          }).join('') + '</table>'
        : '<div class="mini">Nothing is open on this project.</div>') +
      '<div class="mini">Everything raised on this project that has not been closed, ' +
      'soonest deadline first. Overdue dates are red.</div></div>';
    if (R) R.innerHTML = '';
    document.getElementById('pageTitle').textContent = 'Open items';
  }
  function backBar(){
    return '<div class="card" style="border-left:3px solid var(--blue);padding:10px 14px">' +
      '<div class="mini"><a data-navback="1" style="cursor:pointer;text-decoration:underline">‹ back to ' +
      esc(ROLE[state.role].page) + '</a></div></div>';
  }

  // Focused, full-width versions of panels that otherwise only exist as a card
  // on a dashboard — so a sidebar link to them is not a click that changes
  // nothing because you are already looking at it.
  function showFull(html, title){
    var L = document.getElementById('leftcol'), R = document.getElementById('rightcol');
    if (!L) return;
    state.navView = { full: title };
    setWide(true);
    L.innerHTML = backBar() + html;
    if (R) R.innerHTML = '';
    document.getElementById('pageTitle').textContent = title;
  }
  function showBOMFull(){
    if (!BOM_TRIED) { bomFetch().then(function(){ showBOMFull(); }); }
    showFull(bomCardHTML(), 'Bill of Materials');
    try { wireBOM(); } catch (e) {}
  }
  function showMoves(kind, title){
    if (!BOM_TRIED) { bomFetch().then(function(){ showMoves(kind, title); }); }
    var moves = ((BOM && BOM.moves) || []).filter(function(m){
      return kind === 'all' ? true : (kind === 'grn' ? m.kind === 'grn' : m.kind !== 'grn');
    });
    showFull('<div class="card"><h2>' + esc(title) + ' <span class="r">' + moves.length + '</span></h2>' +
      (moves.length
        ? '<table><tr><th>Date</th><th>Material</th><th>Quantity</th><th>Reference</th><th>By</th></tr>' +
          moves.map(function(m){
            return '<tr><td>' + esc(String(m.at || '').slice(0, 10)) + '</td><td>' + esc(m.material) + '</td>' +
              '<td>' + n2(m.qty) + (m.over_by > 0 ? ' <span style="color:var(--bad)">(over by ' +
                n2(m.over_by) + ')</span>' : '') + '</td>' +
              '<td>' + esc(m.ref || '—') + '</td><td>' + esc(m.by || '') + '</td></tr>';
          }).join('') + '</table>'
        : '<div class="mini">Nothing recorded against the Bill of Materials yet.</div>') +
      '<div class="mini">Every release and every delivery is drawn against the BOM and kept here.</div></div>',
      title);
  }
  var MANPOWER = null, MP_TRIED = false;
  function showManpower(){
    if (!MP_TRIED) {
      MP_TRIED = true;
      fetch('/api/data', { cache: 'no-store' }).then(function(r){ return r.ok ? r.json() : null; })
        .then(function(d){ MANPOWER = (d && d.manpower) || []; showManpower(); })
        .catch(function(){ MANPOWER = []; showManpower(); });
    }
    var m = MANPOWER || [];
    showFull('<div class="card"><h2>Manpower &amp; plant <span class="r">' + m.length + '</span></h2>' +
      (m.length
        ? '<table><tr><th>Date</th><th>Trade</th><th>Men</th><th>Plant</th><th>Notes</th></tr>' +
          m.slice(0, 200).map(function(x){
            return '<tr><td>' + esc(x.report_date || '') + '</td><td>' + esc(x.trade || '') + '</td>' +
              '<td>' + nOrDash(x.men) + '</td><td>' + esc(x.plant || '—') + '</td>' +
              '<td>' + esc(x.remarks || '') + '</td></tr>';
          }).join('') + '</table>'
        : '<div class="mini">No manpower has been returned on this project yet. ' +
          'It is recorded with the daily return from site.</div>') + '</div>', 'Manpower & plant');
  }
  var DIARY = null, DIARY_TRIED = false;
  function showDiary(){
    if (!DIARY_TRIED) {
      DIARY_TRIED = true;
      fetch('/api/diary', { cache: 'no-store' }).then(function(r){ return r.ok ? r.json() : null; })
        .then(function(d){ DIARY = d || {}; showDiary(); })
        .catch(function(){ DIARY = {}; showDiary(); });
    }
    var d = DIARY || {};
    var rows = (d.entries || d.rows || []);
    showFull('<div class="card"><h2>Daily diary <span class="r">' +
      esc(d.date || liveToday()) + '</span></h2>' +
      (rows.length
        ? '<table><tr><th>Item</th><th>Entry</th></tr>' + rows.map(function(r){
            return '<tr><td>' + esc(r.label || r.k || '') + '</td><td>' + esc(r.value || r.v || '') + '</td></tr>';
          }).join('') + '</table>'
        : '<div class="mini">Nothing has been entered in the site diary for today. ' +
          'The diary is kept by site and checked by the office.</div>') + '</div>', 'Daily diary');
  }
  function showPortfolioFull(){
    if (!PORT_TRIED) { portFetch().then(function(){ showPortfolioFull(); }); }
    showFull(portfolioHTML(), 'All projects');
  }

  function navGo(label){
    state.navLabel = label;
    var t = NAV_TARGET[label];
    if (!t) {
      if (NAV_NOTYET[label]) { showNotYet(label, NAV_NOTYET[label]); return; }
      showNotYet(label, 'This screen is not connected on this project.');
      return;
    }
    if (t.dash === 'self') { state.navView = null; render(); return; }
    if (t.page) { location.href = t.page; return; }
    if (t.prog) { showProgramme(t.prog, label); return; }
    if (t.open) { showDecisions(); return; }
    if (t.bom) { showBOMFull(); return; }
    if (t.moves) { showMoves(t.moves, t.t || label); return; }
    if (t.manpower) { showManpower(); return; }
    if (t.diary) { showDiary(); return; }
    if (t.portfolio) { showPortfolioFull(); return; }
    if (t.dash) {
      // Only where this person's access actually reaches.
      var lvl = null;
      try {
        (accessFor(state.email) || []).forEach(function(v){ if (v[0] === t.dash) lvl = v[1]; });
      } catch (e) {}
      if (!lvl) { showNotYet(label, 'That folder is not part of your access.'); return; }
      state.navView = null;
      state.role = t.dash;
      state.navLabel = label;
      state.readonly = (lvl === 'read');
      render();
      return;
    }
    if (t.reg) {
      if (!showRegister(t.reg)) showNotYet(label, 'That register is not set up on this project.');
      return;
    }
    if (t.form) {
      state.navView = null; render();
      try { openNewForm(t.form); } catch (e) {}
      return;
    }
    if (t.act) {
      var parts = t.act.split(':');
      state.navView = null; render();
      try {
        if (parts[0] === 'report') openReport(parts[1]);
        else if (parts[0] === 'hse') openHse(parts[1]);
        else if (parts[0] === 'sched') openSchedule(parts[1]);
        else if (parts[0] === 'decisions' || parts[0] === 'people' || parts[0] === 'projects') {
          // these are already on the dashboard the person is standing on
        }
      } catch (e) {}
      return;
    }
  }
  // RFIs are raised by whoever hits the question — Design, site, QA/QC,
  // planning or the QS — but the design drew the register into one sidebar
  // only, and gave site a dead "Raise RFI" link that opened nothing. Everyone
  // who may raise one gets the register they raised it into.
  function addMissingNavLinks(){
    if (typeof NAV === 'undefined') return;
    try {
      var reg = NAV.design && NAV.design[0] && NAV.design[0][1];
      if (reg && !reg.some(function(i){ return /^RFI/.test(i[1]); })) {
        reg.splice(2, 0, ['\u270E', 'RFI register', '']);
      }
      // "Raise RFI" opened nothing: raising is the ＋ RFI button on the
      // dashboard, and the sidebar link belongs to the register it lands in.
      ['site', 'qaqc', 'planning', 'commercial'].forEach(function(role){
        var groups = NAV[role];
        if (!groups || !groups.length) return;
        var found = false;
        groups.forEach(function(g){
          (g[1] || []).forEach(function(i){
            if (/^Raise RFI$/.test(i[1])) { i[1] = 'RFI register'; found = true; }
            else if (/^RFI/.test(i[1])) found = true;
          });
        });
        if (!found) groups[0][1].push(['\u270E', 'RFI register', '']);
      });
      var hse = NAV.hse && NAV.hse[0] && NAV.hse[0][1];
      if (hse && !hse.some(function(i){ return /Certificates/.test(i[1]); })) {
        hse.push(['\u25C8', 'Certificates', '']);
      }
      // Document Control issues the payment application to the Engineer and
      // records the certificate, so it needs the payments register.
      // Step 8: Document Control writes and issues minutes.
      var dcctl = NAV.dc && NAV.dc[2] && NAV.dc[2][1];
      if (dcctl && !dcctl.some(function(i){ return /Minutes/.test(i[1]); })) dcctl.push(['\u2630', 'Minutes', '']);
      var dcreg = NAV.dc && NAV.dc[1] && NAV.dc[1][1];
      if (dcreg && !dcreg.some(function(i){ return /IPC/.test(i[1]); })) {
        dcreg.push(['₳', 'IPC / payments', '']);
      }
      var site = NAV.site && NAV.site[0] && NAV.site[0][1];
      if (site && !site.some(function(i){ return /Material requests/.test(i[1]); })) {
        site.push(['\uD83D\uDED2', 'Material requests', '']);
      }
    } catch (e) {}
  }
  addMissingNavLinks();

  /* ==================================================================
   * THE SAFETY REPORT. The design's version invented every figure in it —
   * 108 men on site, 96% PPE, 142 days LTI-free, 0 incidents — and told the
   * reader it came from the HSE registers. This one is built by the server
   * from the permits, observations and incidents actually raised, plus the
   * daily log somebody has to keep. A figure nobody entered stays blank and
   * the report says so at the top, because a client reads a blank as a zero.
   * ================================================================== */
  function hseStatHTML(s){
    var v = (s.v === null || s.v === undefined) ? '<span style="color:var(--muted)">—</span>' : esc(String(s.v));
    return '<li><span class="k">' + esc(s.k) + '</span><span class="v">' + v +
      (s.note ? ' <span class="mini" style="font-weight:400">(' + esc(s.note) + ')</span>' : '') +
      '</span></li>';
  }
  function hseReportHTML(d){
    var title = d.period === 'daily' ? 'Daily HSE update' : 'Weekly HSE report';
    var head = d.period === 'daily' ? esc(d.to) : esc(d.from) + ' → ' + esc(d.to);
    return '<div class="dtop"><div class="crumb"><a data-close="1">HSE</a> › ' + title + '</div>' +
      '<div class="dhrow"><div><div class="dh">' + title + '</div>' +
      '<div class="dref">' + esc(d.project || '') + ' · ' + head + '</div></div>' +
      '<button class="dclose" data-close="1">✕</button></div></div>' +
      '<div class="dbody">' +
      (d.missing && d.missing.length
        ? '<div class="dwarn"><b>This report is incomplete.</b> Nothing has been logged for: ' +
          esc(d.missing.join(', ')) + '. Those lines are blank rather than zero — ' +
          'do not issue this until the log is kept for the period.</div>'
        : '') +
      '<div class="note"><div class="sechd">' + head +
      (d.days_logged != null ? ' · ' + d.days_logged + (d.days_logged === 1 ? ' day logged' : ' days logged') : '') +
      '</div><ul class="facts">' + (d.stats || []).map(hseStatHTML).join('') + '</ul></div>' +
      '<div class="note"><div class="sechd">Open observations</div>' +
      ((d.open_observations || []).length
        ? '<table><tr><th>Ref</th><th>Finding</th><th>Risk</th><th>Status</th></tr>' +
          d.open_observations.map(function(o){
            return '<tr class="click" data-open="' + esc(o.ref) + '"><td><span class="ref">' + esc(o.ref) +
              '</span></td><td>' + esc(o.title) + '</td><td>' + esc(o.risk) + '</td><td>' +
              pill(o.status, o.cls || '') + '</td></tr>';
          }).join('') + '</table>'
        : '<div class="mini">No observation is open.</div>') + '</div>' +
      '<div class="note"><div class="sechd">Permits open</div>' +
      ((d.permits_open || []).length
        ? '<table><tr><th>Ref</th><th>Permit</th><th>Status</th></tr>' +
          d.permits_open.map(function(o){
            return '<tr class="click" data-open="' + esc(o.ref) + '"><td><span class="ref">' + esc(o.ref) +
              '</span></td><td>' + esc(o.title) + '</td><td>' + pill(o.status, o.cls || '') + '</td></tr>';
          }).join('') + '</table>'
        : '<div class="mini">No permit is open.</div>') + '</div>' +
      ((d.incidents || []).length
        ? '<div class="note"><div class="sechd">Incidents in this period</div>' +
          '<table><tr><th>Ref</th><th>What</th><th>Type</th><th>Status</th></tr>' +
          d.incidents.map(function(o){
            return '<tr class="click" data-open="' + esc(o.ref) + '"><td><span class="ref">' + esc(o.ref) +
              '</span></td><td>' + esc(o.title) + '</td><td>' + esc(o.type) + '</td><td>' + esc(o.status) + '</td></tr>';
          }).join('') + '</table></div>'
        : '') +
      '<div class="actbar"><button class="prim" data-print="hse">Print / save as PDF</button>' +
      '<button data-hselog="1">Keep today’s log</button></div>' +
      '<div class="mini">Built from this project’s permits, observations and incidents, ' +
      'and from the daily log. Nothing on this page is estimated.</div></div>';
  }
  function installLiveHse(){
    if (typeof openHse !== 'function') return;
    window.openHse = function(kind){
      var pane = document.getElementById('dpane');
      if (!pane) return;
      pane.innerHTML = '<div class="dbody"><div class="mini">Building the report…</div></div>';
      document.getElementById('detail').classList.remove('hide');
      fetch('/api/hse?period=' + (kind === 'daily' ? 'daily' : 'weekly'), { cache: 'no-store' })
        .then(function(r){ return r.ok ? r.json() : null; })
        .then(function(d){
          if (!d) { pane.innerHTML = '<div class="dbody"><div class="mini">Could not build the report.</div></div>'; return; }
          pane.innerHTML = hseReportHTML(d);
        })
        .catch(function(){
          pane.innerHTML = '<div class="dbody"><div class="mini">Could not reach the server.</div></div>';
        });
    };
  }
  // The log itself — the only place the numbers nobody else records get in.
  function hseLogForm(){
    return '<div class="dtop"><div class="dhrow"><div><div class="dh">Today’s safety log</div>' +
      '<div class="dref">' + liveToday() + '</div></div>' +
      '<button class="dclose" data-close="1">✕</button></div></div>' +
      '<div class="dbody"><div class="note"><div class="sechd">What was counted today</div>' +
      '<div class="frm">' +
        '<div class="f"><label>Date</label><input id="hlDate" type="date" value="' + liveToday() + '"></div>' +
        '<div class="f"><label>Men on site</label><input id="hlMen" type="text"></div>' +
        '<div class="f"><label>Man-hours (from the time sheets)</label><input id="hlMh" type="text"></div>' +
        '<div class="f"><label>Toolbox talks held</label><input id="hlTalks" type="text"></div>' +
        '<div class="f"><label>Total attended</label><input id="hlAtt" type="text"></div>' +
        '<div class="f"><label>Inductions</label><input id="hlInd" type="text"></div>' +
        '<div class="f"><label>PPE — people checked</label><input id="hlChk" type="text"></div>' +
        '<div class="f"><label>PPE — of those, compliant</label><input id="hlOk" type="text"></div>' +
        '<div class="f full"><label>Notes</label><textarea id="hlNote"></textarea></div>' +
      '</div>' +
      '<div class="mini">Leave a box empty if it was not counted. An empty box stays blank in the ' +
      'report; it is never read as zero.</div>' +
      '<div class="actbar" style="margin-top:10px"><button class="prim" id="hlSave">Save the log</button></div>' +
      '<div class="mini" id="hlMsg" style="margin-top:8px"></div></div></div>';
  }
  function openHseLog(){
    var pane = document.getElementById('dpane');
    if (!pane) return;
    pane.innerHTML = hseLogForm();
    document.getElementById('detail').classList.remove('hide');
    var msg = document.getElementById('hlMsg');
    document.getElementById('hlSave').addEventListener('click', function(){
      var b = this; b.disabled = true; msg.textContent = 'Saving…'; msg.style.color = '';
      var v = function(id){ var e = document.getElementById(id); return e && e.value !== '' ? e.value : null; };
      fetch('/api/hse/log', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ log_date: v('hlDate'), men_on_site: v('hlMen'), man_hours: v('hlMh'),
          toolbox_talks: v('hlTalks'), toolbox_attended: v('hlAtt'), inductions: v('hlInd'),
          ppe_checked: v('hlChk'), ppe_compliant: v('hlOk'), notes: v('hlNote') }) })
        .then(function(r){ return r.json(); })
        .then(function(res){
          if (res && res.error) { msg.textContent = res.error; msg.style.color = 'var(--bad)'; b.disabled = false; return; }
          msg.textContent = 'Logged for ' + res.log_date + '.';
        })
        .catch(function(){ msg.textContent = 'Could not reach the server.'; msg.style.color = 'var(--bad)'; b.disabled = false; });
    });
  }
  document.addEventListener('click', function(ev){
    var t = ev.target.closest ? ev.target.closest('[data-hselog]') : null;
    if (!t) return;
    ev.preventDefault(); ev.stopImmediatePropagation();
    openHseLog();
  }, true);

  /* ==================================================================
   * "Download PDF" appeared on the report, the schedule and the HSE panels
   * and did nothing at all. It now prints the panel itself — which is how a
   * person actually gets a PDF out of a web page, and it carries exactly what
   * is on screen rather than a second document that could say something else.
   * ================================================================== */
  function printPane(titleText){
    var pane = document.getElementById('dpane');
    if (!pane) return;
    var css = '';
    try {
      css = Array.prototype.slice.call(document.querySelectorAll('style'))
        .map(function(s){ return s.textContent; }).join('\\n');
    } catch (e) {}
    var w = window.open('', '_blank');
    if (!w) { alert('Your browser blocked the print window. Allow pop-ups for this site and try again.'); return; }
    var proj = (ME.projectName || '') + (ME.projectSub ? ' · ' + ME.projectSub : '');
    w.document.write('<!doctype html><html><head><meta charset="utf-8"><title>' +
      esc(titleText || 'AETRAA') + '</title><style>' + css +
      'body{background:#fff;padding:24px;} .dclose,.actbar,[data-navback]{display:none!important;}' +
      '.dtop{position:static;} @page{margin:14mm;}</style></head><body>' +
      '<div style="font-size:12px;color:#667;margin-bottom:10px">' + esc(proj) +
      ' · produced ' + liveToday() + ' by ' + esc(ME.name || '') + '</div>' +
      pane.innerHTML + '</body></html>');
    w.document.close();
    setTimeout(function(){ try { w.focus(); w.print(); } catch (e) {} }, 350);
  }
  document.addEventListener('click', function(ev){
    var t = ev.target.closest ? ev.target.closest('[data-print]') : null;
    if (!t) return;
    ev.preventDefault(); ev.stopImmediatePropagation();
    var h = document.querySelector('#dpane .dh');
    printPane(h ? h.textContent : 'AETRAA');
  }, true);

  // The design's own report and schedule panels carry dead buttons of their
  // own. They are relabelled and wired as the panel is opened.
  function wirePanelButtons(){
    var pane = document.getElementById('dpane');
    if (!pane) return;
    var bars = pane.querySelectorAll('.actbar');
    for (var i = 0; i < bars.length; i++) {
      var btns = bars[i].querySelectorAll('button');
      for (var j = 0; j < btns.length; j++) {
        var b = btns[j];
        if (b.getAttribute('data-print') || b.id || b.getAttribute('data-close') ||
            b.getAttribute('data-gen') || b.getAttribute('data-new')) continue;
        var label = (b.textContent || '').trim();
        if (/download pdf|print/i.test(label)) {
          b.setAttribute('data-print', '1');
          b.textContent = 'Print / save as PDF';
        } else if (/^email/i.test(label)) {
          b.setAttribute('data-emailout', '1');
        } else if (/export to programme|p6|msp/i.test(label)) {
          b.setAttribute('data-exportcsv', '1');
          b.textContent = 'Export (CSV for P6 / MSP)';
        } else if (/save draft/i.test(label)) {
          b.setAttribute('data-savedraft', '1');
        } else {
          // Anything still unaccounted for is removed rather than left looking
          // live. The list is static, so the index is NOT stepped back.
          if (b.parentNode) b.parentNode.removeChild(b);
        }
      }
    }
  }

  // STEP 4 — the report buttons open the real report, built on the server from
  // the programme, site progress, the registers and the diary. (The design's
  // own openReport drew a mock-up with fixed numbers.)
  var REP = { kind: '', key: '' };
  var REP_TITLE = { weekly: 'Weekly progress report', monthly: 'Monthly progress report',
    lookahead: '3-week look-ahead', programme: 'Programme — current status', hse: 'Monthly HSE report' };
  function repDefaultKey(kind){
    var t = new Date(Date.now() + 4 * 3600000).toISOString().slice(0, 10);
    return (kind === 'monthly' || kind === 'hse') ? t.slice(0, 7) : t;
  }
  function repQuery(){ return 'kind=' + REP.kind + '&key=' + encodeURIComponent(REP.key); }
  function repCanSend(){
    var f = ((typeof ME !== 'undefined' && ME) ? ME.roles : null) || [];
    return f.indexOf('principal') >= 0 || f.indexOf('pm') >= 0 || f.indexOf('planning') >= 0 || (REP.kind === 'hse' && f.indexOf('hse') >= 0);
  }
  function drawReport(){
    var pane = document.getElementById('dpane');
    if (!pane) return;
    var k = REP.kind, ranged = (k === 'weekly' || k === 'monthly' || k === 'hse'), byMonth = (k === 'monthly' || k === 'hse');
    pane.innerHTML =
      '<div class="dtop"><div class="crumb"><a data-close="1">Reports</a> › ' + REP_TITLE[k] + '</div>' +
      '<div class="dhrow"><div><div class="dh">' + REP_TITLE[k] + '</div><div class="dref" id="repWhen">' +
      (byMonth ? esc(REP.key) : ranged ? 'Week containing ' + esc(REP.key) : 'As at ' + esc(REP.key)) + '</div></div>' +
      '<button class="dclose" data-close="1">✕</button></div></div>' +
      '<div class="dbody">' +
      (ranged ? '<div class="actbar"><button id="repPrev">‹ Previous ' + (byMonth ? 'month' : 'week') + '</button>' +
        '<button id="repNext">Next ' + (byMonth ? 'month' : 'week') + ' ›</button></div>' : '') +
      '<div id="repPaper" style="background:#fff;color:#1b2437;border:1px solid var(--line,#e3e9f2);border-radius:10px;padding:18px;margin:10px 0;overflow-x:auto">' +
      '<div class="mini">Building the report…</div></div>' +
      '<div class="actbar"><button class="prim" id="repPdf">Print / save as PDF</button><button id="repWord">Download Word</button>' +
      (ranged && repCanSend() ? '<button id="repEmail">Email to the project list</button>' : '') + '</div>' +
      '<div class="mini" id="repMsg">Built from the programme, site progress, the registers and the site diary — nothing on it is typed by hand.</div>' +
      '</div>';
    var det = document.getElementById('detail'); if (det) det.classList.remove('hide');
    var want = repQuery();
    fetch('/api/report?' + want, { cache: 'no-store' }).then(function(r){
      if (!r.ok) throw new Error(r.status === 401 ? 'Reports are open to the PM, Principal, Planning, Document Control and Commercial.' : 'The report could not be built.');
      return r.text();
    }).then(function(h){
      if (repQuery() !== want) return;               // moved on while it was building
      var paperEl = document.getElementById('repPaper'); if (paperEl) paperEl.innerHTML = h;
    }).catch(function(e){
      var paperEl = document.getElementById('repPaper'); if (paperEl) paperEl.innerHTML = '<div class="mini">' + esc(e.message || 'Offline — try again.') + '</div>';
    });
  }
  function repStep(n){
    if (REP.kind === 'monthly' || REP.kind === 'hse') {
      var p = REP.key.split('-');
      REP.key = new Date(Date.UTC(Number(p[0]), Number(p[1]) - 1 + n, 1)).toISOString().slice(0, 7);
    } else {
      REP.key = new Date(Date.parse(REP.key + 'T00:00:00Z') + n * 7 * 86400000).toISOString().slice(0, 10);
    }
    drawReport();
  }
  function installLiveReports(){
    window.openReport = function(kind){
      if (!REP_TITLE[kind]) kind = 'weekly';
      if (REP.kind !== kind) { REP.kind = kind; REP.key = repDefaultKey(kind); }
      drawReport();
    };
    document.addEventListener('click', function(ev){
      var b = ev.target.closest ? ev.target.closest('#repPrev,#repNext,#repPdf,#repWord,#repEmail') : null;
      if (!b) return;
      ev.preventDefault(); ev.stopImmediatePropagation();
      if (b.id === 'repPrev') return repStep(-1);
      if (b.id === 'repNext') return repStep(1);
      if (b.id === 'repWord') { window.location.href = '/api/report?' + repQuery() + '&format=doc'; return; }
      if (b.id === 'repPdf') { window.open('/reports?' + repQuery() + '&print=1', '_blank'); return; }
      if (b.id === 'repEmail') {
        var msg = document.getElementById('repMsg');
        b.disabled = true; if (msg) msg.textContent = 'Sending…';
        fetch('/api/report-email', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ kind: REP.kind, key: REP.key }) })
          .then(function(r){ return r.json().then(function(j){ return { ok: r.ok, j: j }; }); })
          .then(function(x){
            if (msg) msg.textContent = x.ok ? 'Sent to ' + x.j.sent + ' address' + (x.j.sent === 1 ? '' : 'es') + ' on the project report list.'
              : (x.j.error || 'It did not go.');
            b.disabled = false;
          }).catch(function(){ if (msg) msg.textContent = 'Offline — it did not go.'; b.disabled = false; });
      }
    }, true);
  }
  function installPanelButtons(){
    ['openReport', 'openSchedule', 'openHse', 'openDetail', 'openNewForm'].forEach(function(fn){
      if (typeof window[fn] !== 'function') return;
      var orig = window[fn];
      window[fn] = function(){
        var r = orig.apply(this, arguments);
        try { wirePanelButtons(); } catch (e) {}
        return r;
      };
    });
  }

  // "Email to PM & client" had no handler and there is no outbound mail set up
  // on this deployment. Rather than pretend, it hands the whole thing to the
  // person's own mail client, where they can see it before it goes.
  document.addEventListener('click', function(ev){
    var t = ev.target.closest ? ev.target.closest('[data-emailout]') : null;
    if (!t) return;
    ev.preventDefault(); ev.stopImmediatePropagation();
    var pane = document.getElementById('dpane');
    var h = pane ? pane.querySelector('.dh') : null;
    var subject = (ME.projectName || 'Project') + ' — ' + (h ? h.textContent : 'report') +
      ' — ' + liveToday();
    var body = '';
    try {
      body = (pane.querySelector('.dbody') || pane).innerText
        .replace(/\\n{3,}/g, '\\n\\n').slice(0, 1800);
    } catch (e) {}
    body += '\\n\\n—\\nProduced by ' + (ME.name || '') + ' on ' + liveToday() + ' from AETRAA.';
    location.href = 'mailto:?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
  }, true);

  // "Export to programme (P6 / MSP)" was dead. A .xer is a proprietary format
  // and writing one badly is worse than not writing one; a dated CSV is what
  // both P6 and MS Project actually import.
  function downloadText(name, text, mime){
    var blob = new Blob([text], { type: mime || 'text/csv;charset=utf-8' });
    var u = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = u; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function(){ URL.revokeObjectURL(u); }, 4000);
  }
  function csvCell(v){
    var s = String(v == null ? '' : v);
    return /[",\\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  document.addEventListener('click', function(ev){
    var t = ev.target.closest ? ev.target.closest('[data-exportcsv]') : null;
    if (!t) return;
    ev.preventDefault(); ev.stopImmediatePropagation();
    var acts = (typeof ACTIVITIES !== 'undefined') ? ACTIVITIES : [];
    if (!acts.length) { alert('There is no programme on this project to export.'); return; }
    var rows = [['Activity ID', 'Activity Name', 'WBS', 'Start', 'Finish', 'Trade', 'Percent Complete']];
    acts.forEach(function(a){
      rows.push([a.ref, a.name, a.wbs || '', a.start || '', a.finish || '', a.disc || '', Math.round(a.pct || 0)]);
    });
    downloadText((ME.projectName || 'programme').replace(/[^\\w]+/g, '-') + '-' + liveToday() + '.csv',
      rows.map(function(r){ return r.map(csvCell).join(','); }).join('\\n'));
  }, true);

  // "Save draft" did nothing. A draft must not burn a document number, so it
  // is kept in this browser until it is actually raised, and says so.
  function draftKey(kind){ return 'aetraa.draft.' + (ME.projectId || 'p') + '.' + kind; }
  document.addEventListener('click', function(ev){
    var t = ev.target.closest ? ev.target.closest('[data-savedraft]') : null;
    if (!t) return;
    ev.preventDefault(); ev.stopImmediatePropagation();
    var pane = document.getElementById('dpane');
    var gen = pane ? pane.querySelector('[data-gen]') : null;
    var kind = gen ? gen.getAttribute('data-gen') : null;
    if (!kind) return;
    var vals = [];
    pane.querySelectorAll('.frm .f').forEach(function(f){
      var i = f.querySelector('input,select,textarea');
      vals.push(i && i.type !== 'file' ? i.value : '');
    });
    try {
      localStorage.setItem(draftKey(kind), JSON.stringify({ at: nowStamp(), vals: vals }));
      var m = document.createElement('div');
      m.className = 'mini';
      m.style.marginTop = '8px';
      m.textContent = 'Kept as a draft in this browser. It has no reference number until you raise it, ' +
        'and it will not follow you to another device.';
      t.parentNode.parentNode.appendChild(m);
      t.disabled = true;
    } catch (e) {
      alert('This browser will not keep a draft (private browsing, or storage is blocked).');
    }
  }, true);
  function nowStamp(){ try { return new Date().toISOString(); } catch (e) { return ''; } }
  // A kept draft is offered back the next time the same form is opened.
  function restoreDraft(kind){
    var raw = null;
    try { raw = localStorage.getItem(draftKey(kind)); } catch (e) { return; }
    if (!raw) return;
    var d = null;
    try { d = JSON.parse(raw); } catch (e) { return; }
    if (!d || !d.vals) return;
    var pane = document.getElementById('dpane');
    var fs = pane ? pane.querySelectorAll('.frm .f') : [];
    for (var i = 0; i < fs.length && i < d.vals.length; i++) {
      var inp = fs[i].querySelector('input,select,textarea');
      if (inp && inp.type !== 'file' && d.vals[i]) inp.value = d.vals[i];
    }
    var bar = pane.querySelector('.actbar');
    if (bar) bar.insertAdjacentHTML('beforebegin',
      '<div class="mini" style="margin-bottom:8px">A draft kept in this browser on ' +
      esc(String(d.at).slice(0, 10)) + ' has been put back into the form. ' +
      '<a data-dropdraft="' + esc(kind) + '" style="cursor:pointer;text-decoration:underline">Discard it</a></div>');
  }
  document.addEventListener('click', function(ev){
    var t = ev.target.closest ? ev.target.closest('[data-dropdraft]') : null;
    if (!t) return;
    ev.preventDefault(); ev.stopImmediatePropagation();
    try { localStorage.removeItem(draftKey(t.getAttribute('data-dropdraft'))); } catch (e) {}
    try { openNewForm(t.getAttribute('data-dropdraft')); } catch (e) {}
  }, true);

  /* ==================================================================
   * THE LAST INVENTED PANELS.
   *
   * Four cards survived everything above because they are neither a register,
   * a counter, nor a row the stripper recognised: Document Control's
   * "Registers at a glance", the Finance cashflow bars, a contractual notice
   * deadline, and a subcontractor valuation. Each is replaced with the real
   * thing where one exists, and removed with an explanation where it does not.
   * ================================================================== */
  function cardByHeading(re){
    var cards = document.querySelectorAll('#leftcol .card, #rightcol .card');
    for (var i = 0; i < cards.length; i++) {
      var h = cards[i].querySelector('h2');
      if (h && re.test(h.textContent || '')) return cards[i];
    }
    return null;
  }
  function replaceCard(re, html){
    var c = cardByHeading(re);
    if (!c) return false;
    var d = document.createElement('div');
    d.innerHTML = html;
    c.parentNode.replaceChild(d, c);
    return true;
  }
  function registersAtAGlanceHTML(){
    var D = drawStats();
    var d = liveToday();
    var since = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    var line = function(name, type){
      var all = ofType(type);
      return [name,
        nOrDash(all.filter(function(r){ return !isClosed(r); }).length),
        nOrDash(all.filter(function(r){ return (r.sub || '') >= since; }).length),
        overdueOf(type).length ? '<span class="pill late">' + overdueOf(type).length + '</span>' : '—'];
    };
    var rows = [
      ['Drawings', nOrDash(D.current), nOrDash(D.total), '—'],
      line('RFIs', 'rfi'), line('Submittals', 'submittal'), line('Letters', 'letter'),
      line('Inspections', 'wir'), line('NCRs', 'ncr'),
    ];
    return '<div class="card"><h2>Registers at a glance</h2>' +
      '<table><tr><th>Register</th><th>Open</th><th>Last 30 days</th><th>Overdue</th></tr>' +
      rows.map(function(r){
        return '<tr><td>' + r[0] + '</td><td>' + r[1] + '</td><td>' + r[2] + '</td><td>' + r[3] + '</td></tr>';
      }).join('') + '</table>' +
      '<div class="mini">Counted from this project’s own registers. An em dash means nothing ' +
      'of that kind has been recorded here.</div></div>';
  }
  function cashflowHTML(){
    var I = ipcStats(), B = bomStats();
    var cur = 'AED';
    if (I.certified === null && !B.lines) {
      return '<div class="card"><h2>Money</h2><div class="mini">Nothing has been certified and ' +
        'no Bill of Materials has been loaded, so there is no cashflow to show yet.</div></div>';
    }
    return '<div class="card"><h2>Money — this project</h2><ul class="facts">' +
      '<li><span class="k">Certified to date</span><span class="v">' +
        (I.certified === null ? '—' : cur + ' ' + moneyShort(I.certified)) + '</span></li>' +
      '<li><span class="k">Latest application (net)</span><span class="v">' +
        (I.latestNet === null ? '—' : cur + ' ' + moneyShort(I.latestNet)) + '</span></li>' +
      '<li><span class="k">Certificates not yet paid</span><span class="v">' + nOrDash(I.open) + '</span></li>' +
      '<li><span class="k">Deliveries awaited</span><span class="v">' + nOrDash(B.awaiting) + '</span></li>' +
      '</ul><div class="mini">A cashflow forecast needs supplier payment terms, which this ' +
      'platform does not hold. These are the figures it can stand behind.</div></div>';
  }
  // ---- Step 1 helpers: live queues and panels ---------------------------
  var TYPE_TAG = { submittal:'SUB', ms:'MS', material:'MAR', rfi:'RFI', authority:'NOC', letter:'LTR', incoming:'IN',
    variation:'VO', wir:'WIR', mir:'MIR', ncr:'NCR', ptw:'PTW', obs:'OBS', incident:'INC', mr:'MR', cert:'CERT' };
  var TYPE_CLS = { variation:'vo', ncr:'ncr', ptw:'hse', obs:'hse', incident:'hse', cert:'hse' };
  // Records whose next step belongs to one of these functions.
  function pendingOn(fns){
    return LIVE.records.filter(function(r){
      if (isClosed(r)) return false;
      return (r.next_by_fns || []).some(function(f){ return fns.indexOf(f) >= 0; });
    });
  }
  function qItem(r){
    var today = liveToday();
    var late = r.due && r.due < today;
    var sub = (r.next_step || r.status || '') + (r.due ? ' · due ' + r.due : '');
    return window.__qReal(r.ref, TYPE_TAG[r.type] || 'REC', TYPE_CLS[r.type] || '', esc(r.ref + ' — ' + (r.title || '')), esc(sub),
      late ? 'Overdue' : '', false);
  }
  function queueCard(title, list, empty){
    var today = liveToday();
    list = list.slice().sort(function(a, b){
      var la = a.due && a.due < today ? 0 : 1, lb = b.due && b.due < today ? 0 : 1;
      if (la !== lb) return la - lb;
      return String(a.due || '9999').localeCompare(String(b.due || '9999'));
    });
    return '<div class="card"><h2>' + title + ' <span class="r">' + list.length + '</span></h2>' +
      (list.length ? list.slice(0, 8).map(qItem).join('') +
        (list.length > 8 ? '<div class="mini">and ' + (list.length - 8) + ' more — see the registers.</div>' : '')
        : '<div class="mini">' + esc(empty) + '</div>') + '</div>';
  }
  function mrTableHTML(){
    var mrs = openOf('mr');
    if (!mrs.length) return '<div class="card"><h2>Material requests → LPO</h2><div class="mini">No material request is open.</div></div>';
    return '<div class="card"><h2>Material requests → LPO <span class="r">' + mrs.length + ' open</span></h2>' +
      '<table><tr><th>Ref</th><th>Material</th><th>For</th><th>Status</th></tr>' +
      mrs.map(function(r){ var d = r.data || {};
        return '<tr data-open="' + esc(r.ref) + '"><td><span class="ref">' + esc(r.ref) + '</span></td><td>' +
          esc(d.Material || r.title || '') + '</td><td>' + esc(d['Needed for'] || d.For || d.Location || '') + '</td><td>' +
          esc(r.next_step || r.status || '') + '</td></tr>'; }).join('') + '</table></div>';
  }
  function financeQueueHTML(){
    var cs = ((IPC && IPC.certificates) || []).filter(function(c){ return c.stage === 'certified' || c.stage === 'part'; });
    if (!cs.length) return '<div class="card"><h2>To action</h2><div class="mini">No certified payment is waiting to be booked as received.</div></div>';
    return '<div class="card"><h2>To action <span class="r">' + cs.length + '</span></h2>' +
      cs.map(function(c){ return window.__qReal(c.ref, 'IPC', 'ipc', esc(c.ref + ' — record payment received'),
        esc((c.stage === 'part' ? 'Part paid' : 'Certified') + (c.certified_net != null ? ' · net ' + money(c.certified_net) : '') + (c.payment_by ? ' · due ' + c.payment_by : '')), '', false); }).join('') + '</div>';
  }
  function grnCardHTML(){
    var moves = ((BOM && BOM.moves) || []).filter(function(m){ return m.kind === 'grn'; });
    if (!moves.length) return '<div class="card"><h2>Deliveries received (GRN)</h2><div class="mini">No delivery has been received ' +
      'against the Bill of Materials yet. Supplier invoices are not held on this platform, so the invoice match is done in your accounts system.</div></div>';
    return '<div class="card"><h2>Deliveries received (GRN) <span class="r">' + moves.length + '</span></h2><table>' +
      '<tr><th>When</th><th>Material</th><th>Qty</th><th>Ref</th><th>Received by</th></tr>' +
      moves.slice(0, 15).map(function(m){ return '<tr><td>' + esc(String(m.at || '').slice(0, 10)) + '</td><td>' + esc(m.material) +
        '</td><td>' + n2(m.qty) + '</td><td>' + esc(m.ref || '') + '</td><td>' + esc(m.by || '') + '</td></tr>'; }).join('') +
      '</table><div class="mini">Supplier invoices are not held on this platform — match them to these GRNs in your accounts system.</div></div>';
  }
  function consultantDeskHTML(list){
    if (!list.length) return '<div class="card"><h2>On your desk</h2><div class="mini">Nothing is with the consultant. ' +
      'The consultant is not signed in to this platform: Document Control issues documents and records the replies.</div></div>';
    var today = liveToday();
    return '<div class="card"><h2>With the consultant <span class="r">' + list.length + '</span></h2><table>' +
      '<tr><th>Ref</th><th>Item</th><th>Issued</th><th>Reply due</th></tr>' +
      list.map(function(r){ var late = r.due && r.due < today;
        return '<tr data-open="' + esc(r.ref) + '"><td><span class="ref">' + esc(r.ref) + '</span></td><td>' + esc(r.title || '') +
          '</td><td>' + esc(r.issued_on || '') + '</td><td>' + (r.due ? pill(r.due, late ? 'late' : 'wp') : '—') + '</td></tr>'; }).join('') +
      '</table></div>';
  }
  // The look-ahead: what is due to START in the next N days (and has not), plus
  // anything that should already have started and has not — by programme date.
  function lookAheadHTML(days){
    var acts = (typeof ACTIVITIES !== 'undefined') ? ACTIVITIES : [];
    if (!acts.length) return '<div class="card"><h2>3-week look-ahead</h2><div class="mini">No programme has been loaded for this project yet.</div></div>';
    var today = liveToday(), end = new Date(Date.parse(today) + days * 86400000).toISOString().slice(0, 10);
    var late = acts.filter(function(a){ return a.start && a.start < today && !(Number(a.pct) > 0); });
    var soon = acts.filter(function(a){ return a.start && a.start >= today && a.start <= end && !(Number(a.pct) >= 100); })
      .sort(function(a, b){ return a.start.localeCompare(b.start); });
    var row2 = function(a, lateFlag){ return '<tr data-open="' + esc(a.ref) + '"><td><span class="ref">' + esc(a.ref) + '</span></td><td>' +
      esc(a.name) + '</td><td>' + esc(a.disc || '') + '</td><td>' + (lateFlag ? pill(a.start + ' — not started', 'late') : esc(a.start)) + '</td></tr>'; };
    return '<div class="card"><h2>3-week look-ahead <span class="r">' + soon.length + ' starting · to ' + esc(end) + '</span></h2>' +
      (soon.length ? '<table><tr><th>Ref</th><th>Activity</th><th>Disc.</th><th>Starts</th></tr>' +
        soon.slice(0, 40).map(function(a){ return row2(a, false); }).join('') + '</table>' +
        (soon.length > 40 ? '<div class="mini">and ' + (soon.length - 40) + ' more.</div>' : '')
        : '<div class="mini">Nothing is due to start in the next ' + days + ' days.</div>') +
      (late.length ? '<div class="mini" style="margin-top:10px"><b>' + late.length + '</b> activit' + (late.length === 1 ? 'y was' : 'ies were') +
        ' due to start before today and ha' + (late.length === 1 ? 's' : 've') + ' no progress reported.</div>' : '') + '</div>';
  }
  // Planned progress today, from each activity's planned start and finish.
  function plannedPctToday(list){
    var t = Date.parse(liveToday()), n = 0, sum = 0;
    list.forEach(function(a){
      var s = Date.parse(a.start), f = Date.parse(a.finish);
      if (!isFinite(s) || !isFinite(f)) return;
      n++;
      if (t >= f) sum += 100; else if (t > s) sum += Math.round(100 * (t - s) / Math.max(86400000, f - s));
    });
    return n ? Math.round(sum / n) : null;
  }
  function disciplineProgressHTML(){
    var acts = (typeof ACTIVITIES !== 'undefined') ? ACTIVITIES : [];
    if (!acts.length) return '<div class="card"><h2>Progress by discipline</h2><div class="mini">No programme has been loaded for this project yet.</div></div>';
    var avg = function(l){ return l.length ? Math.round(l.reduce(function(s, x){ return s + (Number(x.pct) || 0); }, 0) / l.length) : 0; };
    var discs = {};
    acts.forEach(function(a){ var d = a.disc || 'Other'; (discs[d] = discs[d] || []).push(a); });
    var names = Object.keys(discs).sort(function(a, b){ return discs[b].length - discs[a].length; }).slice(0, 8);
    var overall = avg(acts), planned = plannedPctToday(acts);
    var rows = [['Overall (actual)', overall, 'var(--gold)']].concat(names.map(function(d){ return [esc(d), avg(discs[d])]; }));
    if (planned !== null) rows.push(['Planned to date', planned, 'var(--faint)']);
    var gap = planned === null ? null : overall - planned;
    return '<div class="card"><h2>Progress by discipline <span class="r">live from site</span></h2>' + bars(rows) +
      '<div class="mini">Actual is the average reported progress of each discipline’s activities; planned to date is where the ' +
      'same activities should be today by their programme dates.' +
      (gap === null ? '' : ' Currently <b>' + (gap >= 0 ? gap + '% ahead of' : (-gap) + '% behind') + '</b> plan.') + '</div></div>';
  }
  // Today's diary: what Document Control issued and what replies were recorded.
  function correspondenceTodayHTML(){
    var day = liveToday(), rows = [];
    LIVE.records.forEach(function(r){
      (r.workflow || []).forEach(function(s, i){
        if (!s || String(s.when || '').slice(0, 10) !== day || s.state !== 'done') return;
        if (r.type === 'incoming' && i === 0) { rows.push([String(s.when).slice(11, 16), r.ref, 'Incoming', (r.title || '') + ' — from ' + ((r.data || {}).From || '')]); return; }
        if (s.issue) rows.push([String(s.when).slice(11, 16), r.ref, 'Outgoing', r.title || '']);
        else if (s.reply) rows.push([String(s.when).slice(11, 16), r.ref, 'Incoming', (r.title || '') + ' — ' + (r.status || '')]);
      });
    });
    rows.sort(function(a, b){ return a[0].localeCompare(b[0]); });
    return '<div class="card"><h2>Correspondence diary <span class="r">' + esc(day) + '</span></h2>' +
      (rows.length ? '<table><tr><th>Time</th><th>Ref</th><th>Direction</th><th>Subject</th></tr>' +
        rows.map(function(x){ return '<tr data-open="' + esc(x[1]) + '"><td>' + esc(x[0]) + '</td><td><span class="ref">' + esc(x[1]) +
          '</span></td><td>' + esc(x[2]) + '</td><td>' + esc(x[3]) + '</td></tr>'; }).join('') + '</table>'
        : '<div class="mini">Nothing issued or received today.</div>') + '</div>';
  }
  // ---- STEP 7: incoming letters waiting for a reply ------------------------
  function incomingCardHTML(){
    var today = liveToday();
    var open = LIVE.records.filter(function(r){ return r.type === 'incoming' && !isClosed(r); })
      .sort(function(a, b){ return String(a.due || '9999').localeCompare(String(b.due || '9999')); });
    var late = open.filter(function(r){ return r.due && r.due < today; }).length;
    var canLog = !state.readonly && (ME.mayRaise || []).indexOf('incoming') >= 0;
    return '<div class="card" id="incomingCard"><h2>Incoming — replies due' +
      (open.length ? ' <span class="r"' + (late ? ' style="color:var(--bad)"' : '') + '>' + open.length + ' open' + (late ? ' · ' + late + ' overdue' : '') + '</span>' : '') + '</h2>' +
      (canLog ? '<div class="actbar" style="margin-bottom:8px"><button class="prim" data-new="incoming">＋ Log incoming letter</button></div>' : '') +
      (open.length ? '<table><tr><th>Ref</th><th>From</th><th>Subject</th><th>With</th><th>Reply by</th></tr>' +
        open.slice(0, 12).map(function(r){
          var d = r.data || {}, isLate = r.due && r.due < today;
          return '<tr data-open="' + esc(r.ref) + '"><td><span class="ref">' + esc(r.ref) + '</span></td><td>' + esc(d.From || '') +
            '</td><td>' + esc(r.title || '') + '</td><td>' + esc((r.next_by || []).slice(0, 1).join('')) + '</td><td>' +
            (isLate ? pill('Overdue · ' + r.due, 'late') : esc(r.due || '—')) + '</td></tr>'; }).join('') + '</table>' +
          (open.length > 12 ? '<div class="mini">and ' + (open.length - 12) + ' more in the letters register.</div>' : '')
        : '<div class="mini">No incoming letter is waiting for a reply.</div>') + '</div>';
  }
  // ---- STEP 10: needs my attention ------------------------------------------
  var ATT = null, ATT_TRIED = false;
  var ATT_ICON = { record: '✎', incoming: '✉', action: '☰', payment: '₳', diary: '▤', drawing: '▥', verify: '✓', queried: '?' };
  function attFetch(){
    ATT_TRIED = true;
    return fetch('/api/attention', { cache: 'no-store' }).then(function(r){ return r.ok ? r.json() : null; })
      .then(function(d){ ATT = d || { items: [], total: 0, overdue: 0 }; }).catch(function(){ ATT = { items: [], total: 0, overdue: 0 }; });
  }
  function attRow(i, n){
    return '<tr data-attn="' + n + '" style="cursor:pointer"><td style="width:22px;color:var(--faint)">' + (ATT_ICON[i.kind] || '•') + '</td><td><b>' + esc(i.title) + '</b>' +
      '<div class="mini" style="margin:2px 0 0">' + esc(i.need) + '</div></td><td style="white-space:nowrap;text-align:right">' +
      (i.overdue ? pill(i.due ? 'Overdue · ' + i.due : 'Overdue', 'late') : (i.due ? esc(i.due) : '')) + '</td></tr>';
  }
  function attCardHTML(){
    var a = ATT || { items: [], total: 0, overdue: 0 };
    return '<div class="card" id="attCard"><h2>Needs my attention' + (a.total ? ' <span class="r"' + (a.overdue ? ' style="color:var(--bad)"' : '') + '>' +
      a.total + (a.overdue ? ' · ' + a.overdue + ' overdue' : '') + '</span>' : '') + '</h2>' +
      (a.total ? '<table>' + a.items.slice(0, 6).map(function(i, n){ return attRow(i, n); }).join('') + '</table>' +
        (a.total > 6 ? '<div class="actbar" style="margin-top:6px"><button id="attAll">Show all ' + a.total + '</button></div>' : '')
        : '<div class="mini">Nothing is waiting on you on this project.</div>') + '</div>';
  }
  function attOpen(n){
    var i = (ATT && ATT.items || [])[n]; if (!i) return;
    if (i.open && i.open.ref) { if (typeof openDetail === 'function') openDetail(i.open.ref); return; }
    if (i.reg === 'ipc' && typeof window.__showRegister === 'function') { window.__showRegister('ipc'); return; }
    if (i.page) location.href = i.page;
  }
  function attAllPane(){
    var pane = document.getElementById('dpane'); if (!pane || !ATT) return;
    pane.innerHTML = '<div class="dtop"><div class="dhrow"><div><div class="dh">Needs my attention</div><div class="dref">' + ATT.total + ' item' + (ATT.total === 1 ? '' : 's') +
      (ATT.overdue ? ' · ' + ATT.overdue + ' overdue' : '') + ' · ' + esc(ATT.today || '') + '</div></div><button class="dclose" data-close="1">✕</button></div></div>' +
      '<div class="dbody"><table>' + ATT.items.map(function(i, n){ return attRow(i, n); }).join('') + '</table>' +
      '<div class="mini" style="margin-top:8px">Everything on this project whose next move is yours — records to sign, letters to answer, meeting actions, payment applications, diaries, drawings and progress to verify.</div></div>';
    document.getElementById('detail').classList.remove('hide');
  }
  document.addEventListener('click', function(ev){
    var r = ev.target.closest ? ev.target.closest('[data-attn]') : null;
    if (r && (r.closest('#attCard') || r.closest('#dpane'))) { ev.preventDefault(); ev.stopImmediatePropagation(); attOpen(Number(r.getAttribute('data-attn'))); return; }
    var go = ev.target.closest ? ev.target.closest('[data-href]') : null;
    if (go) { ev.preventDefault(); ev.stopImmediatePropagation(); location.href = go.getAttribute('data-href'); return; }
    var all = ev.target.closest ? ev.target.closest('#attAll') : null;
    if (all) { ev.preventDefault(); ev.stopImmediatePropagation(); attAllPane(); }
  }, true);
  // ---- STEP 8: my meeting actions -----------------------------------------
  var ACTS = null, ACTS_ALL = null, ACTS_TRIED = false;
  function actionsFetch(){
    ACTS_TRIED = true;
    var boss = (ME.roles || []).some(function(r){ return r === 'pm' || r === 'principal' || r === 'dc'; });
    return Promise.all([
      fetch('/api/actions?mine=1&status=open', { cache: 'no-store' }).then(function(r){ return r.ok ? r.json() : null; }).catch(function(){ return null; }),
      boss ? fetch('/api/actions?status=overdue', { cache: 'no-store' }).then(function(r){ return r.ok ? r.json() : null; }).catch(function(){ return null; }) : Promise.resolve(null),
    ]).then(function(x){ ACTS = (x[0] && x[0].actions) || []; ACTS_ALL = x[1] ? (x[1].actions || []) : null; });
  }
  function actionsCardHTML(){
    var mine = ACTS || [], today = liveToday();
    var late = mine.filter(function(a){ return a.due && a.due < today; }).length;
    return '<div class="card" id="actionsCard"><h2>My meeting actions' + (mine.length ? ' <span class="r"' + (late ? ' style="color:var(--bad)"' : '') + '>' + mine.length + ' open' + (late ? ' · ' + late + ' overdue' : '') + '</span>' : '') + '</h2>' +
      (mine.length ? '<table><tr><th>Ref</th><th>Action</th><th>Due</th><th>From</th></tr>' + mine.slice(0, 6).map(function(a){
        return '<tr><td><span class="ref">' + esc(a.ref) + '</span></td><td>' + esc(a.text) + '</td><td>' + (a.due < today ? pill(a.due, 'late') : esc(a.due)) + '</td><td>' + esc(a.meeting_ref) + '</td></tr>'; }).join('') + '</table>'
        : '<div class="mini">Nothing from any meeting is waiting on you.</div>') +
      (ACTS_ALL ? '<div class="mini" style="margin-top:8px">' + (ACTS_ALL.length ? '<b style="color:var(--bad)">' + ACTS_ALL.length + '</b> action' + (ACTS_ALL.length === 1 ? ' is' : 's are') + ' overdue on this project.' : 'No meeting action on this project is overdue.') + '</div>' : '') +
      '<div class="actbar" style="margin-top:8px"><button data-href="/minutes?tab=actions&filter=' + (mine.length ? 'mine' : 'open') + '">Open the action tracker</button></div></div>';
  }
  // ---- site diary card -----------------------------------------------------
  var DIARY_ST = null, DIARY_TRIED = false;
  function diaryCardHTML(){
    var j = DIARY_ST, col = { submitted: 'var(--good)', draft: 'var(--gold)', missing: 'var(--bad)', off: 'var(--faint)', today: 'var(--blue)' };
    var lbl = { submitted: 'submitted', draft: 'draft — not submitted', missing: 'no diary', off: 'day off', today: 'today' };
    return '<div class="card" id="diaryCard"><h2>Site diary — last 14 days' + (j.missing ? ' <span class="r" style="color:var(--bad)">' + j.missing + ' missing</span>' : '') + '</h2>' +
      '<div style="display:flex;gap:3px;flex-wrap:wrap;margin:4px 0 8px">' + j.days.map(function(x){
        return '<a href="/diary" title="' + esc(x.date + ' — ' + lbl[x.status]) + '" style="width:22px;height:22px;border-radius:5px;display:inline-block;background:' +
          col[x.status] + ';opacity:' + (x.status === 'off' ? '.35' : '1') + '"></a>'; }).join('') + '</div>' +
      '<div class="mini">' + (j.missing ? '<b>' + j.missing + '</b> working day' + (j.missing === 1 ? '' : 's') + ' with no diary. ' : 'No working day is missing a diary. ') +
      (j.draft ? '<b>' + j.draft + '</b> saved but not submitted. ' : '') + 'Green submitted · amber draft · red missing · grey day off (' +
      esc((j.off_days || []).join(', ') || 'none') + '). <a href="/diary">Open the diary</a></div></div>';
  }
  // ---- activity feed ------------------------------------------------------
  function ago(stamp){                       // 'YYYY-MM-DD HH:MM' (UAE) or an ISO time
    var t = /T/.test(stamp) ? Date.parse(stamp) : Date.parse(String(stamp).replace(' ', 'T') + ':00+04:00');
    if (!isFinite(t)) return '';
    var m = Math.round((Date.now() - t) / 60000);
    if (m < 1) return 'now'; if (m < 60) return m + 'm'; if (m < 1440) return Math.round(m / 60) + 'h';
    if (m < 2880) return 'y’day'; return Math.round(m / 1440) + 'd';
  }
  function siteEvents(){
    return (window.__RECENT || []).map(function(u){
      var a = (typeof actByRef === 'function') ? actByRef(u.activity_id) : null;
      var pct = Number(u.pct) || 0;
      return { t: u.created_at || u.report_date, cls: pct >= 100 ? 'g' : (/delay|risk|hold/.test(u.status || '') ? 'r' : 'a'),
        ref: u.activity_id, text: ((a && a.name) || u.activity_id) + ' → ' + pct + '%' + (u.submitted_by ? ' (' + u.submitted_by + ')' : '') };
    });
  }
  function recordEvents(types){
    var out = [];
    LIVE.records.forEach(function(r){
      if (types !== 'all' && types[0] !== 'issue' && types.indexOf(r.type) < 0) return;
      (r.workflow || []).forEach(function(s, i){
        if (!s || s.state !== 'done' || !/^[0-9]{4}-[0-9]{2}-[0-9]{2}/.test(String(s.when || ''))) return;
        if (types[0] === 'issue' && !s.issue && !s.reply) return;
        out.push({ t: s.when, cls: i === 0 ? 'a' : (s.issue ? 'g' : ''), ref: r.ref,
          text: (i === 0 ? 'raised — ' + (r.title || '') : s.st) + (s.who ? ' · ' + s.who : '') });
      });
    });
    return out;
  }
  function liveFeedHTML(kind){
    var ev = [];
    if (kind === 'none') return '<div class="mini">No subcontractor workflow is kept on this platform yet.</div>';
    if (kind === 'ipc') {
      ev = ((IPC && IPC.certificates) || []).map(function(c){ return { t: c.created_at || '', cls: /Paid/.test(c.status) ? 'g' : '', ref: c.ref, text: c.status || '' }; });
    } else if (kind === 'site') ev = siteEvents();
    else if (kind === 'all') ev = siteEvents().concat(recordEvents('all'));
    else ev = recordEvents(kind);
    ev = ev.filter(function(e){ return e.t; }).sort(function(a, b){
      var ta = /T/.test(a.t) ? Date.parse(a.t) : Date.parse(String(a.t).replace(' ', 'T') + ':00+04:00');
      var tb = /T/.test(b.t) ? Date.parse(b.t) : Date.parse(String(b.t).replace(' ', 'T') + ':00+04:00');
      return (tb || 0) - (ta || 0); }).slice(0, 8);
    if (!ev.length) return '<div class="mini">Nothing recorded yet.</div>';
    return window.__feedReal(ev.map(function(e){ return [e.cls, esc(e.ref), esc(e.text), ago(e.t), e.ref]; }));
  }
  function installLastPanels(){
    if (typeof render !== 'function') return;
    var orig = render;
    window.render = function(){
      orig.apply(this, arguments);
      if (state.navView) return;
      try {
        replaceCard(/^Registers at a glance/, registersAtAGlanceHTML());
        // ---- Step 1: every "waiting on you" queue from the project's own records
        replaceCard(/^Decisions waiting on you/, queueCard('Decisions waiting on you', pendingOn(['principal']),
          'Nothing is waiting on the Principal. Variations reach you for director approval, and letters for signature.'));
        replaceCard(/^To transmit/, queueCard('To issue / record', LIVE.records.filter(function(r){
            return !isClosed(r) && (r.next_by_fns || []).indexOf('dc') >= 0; }),
          'Nothing to issue or record. Documents reach Document Control once the PM has approved them.'));
        replaceCard(/^Awaiting your action/, queueCard('Awaiting your action', pendingOn(['qaqc']),
          'Nothing is waiting on QA/QC.'));
        replaceCard(/^Needs you now/, queueCard('Needs you now', pendingOn(['hse']),
          'Nothing is waiting on HSE.'));
        if (state.role === 'procurement') {
          replaceCard(/^To action/, queueCard('To action', pendingOn(['procurement']),
            'No material request is waiting for an LPO.'));
          replaceCard(/^Material requests/, mrTableHTML());
        }
        if (state.role === 'finance') {
          replaceCard(/^To action/, financeQueueHTML());
          replaceCard(/^Payment gate/, grnCardHTML());
        }
        if (state.role === 'subcon') {
          replaceCard(/^Needs you/, '<div class="card"><h2>Needs you</h2><div class="mini">No workflow is routed to ' +
            'subcontractors on this platform yet, so nothing is waiting here.</div></div>');
          replaceCard(/^Subcontractor packages/, '<div class="card"><h2>Subcontractor packages</h2><div class="mini">' +
            'Subcontract packages are not kept on this platform yet — nothing is shown rather than packages nobody set up.</div></div>');
        }
        if (state.role === 'consultant') {
          var withC = LIVE.records.filter(function(r){ return r.with_consultant && !isClosed(r); });
          replaceCard(/^On your desk/, consultantDeskHTML(withC));
          replaceCard(/^Inspections to witness/, queueCard('Inspections to witness',
            withC.filter(function(r){ return r.type === 'wir' || r.type === 'mir'; }),
            'No inspection request is with the consultant.'));
          replaceCard(/^Approvals waiting on you/, queueCard('With the consultant for approval',
            withC.filter(function(r){ return r.type !== 'wir' && r.type !== 'mir'; }),
            'Nothing is with the consultant. Items appear here once Document Control has issued them.'));
        }
        if (state.role === 'planning') {
          replaceCard(/^Progress by discipline/, disciplineProgressHTML());
          replaceCard(/^3-week look-ahead/, lookAheadHTML(21));
          replaceCard(/^Delay &|^Delay and/, '<div class="card"><h2>Delay &amp; EoT</h2><div class="mini">' +
            'No delay events recorded on this project.</div></div>');
        }
        if (state.role === 'dc') replaceCard(/^Correspondence diary/, correspondenceTodayHTML());
        // Step 10: what needs this person, at the top of every dashboard.
        if (!state.navView && !state.readonly && !document.getElementById('attCard')) {
          if (!ATT_TRIED) attFetch().then(function(){ try { render(); } catch (e) {} });
          var lcA = document.getElementById('leftcol');
          if (lcA && ATT) lcA.insertAdjacentHTML('afterbegin', attCardHTML());
        }
        // Step 9: the monthly HSE report, beside the daily update on the HSE dashboard.
        if (state.role === 'hse' && !state.navView) {
          var dh = document.querySelector('[data-hse="daily"]');
          if (dh && !document.querySelector('[data-report="hse"]')) dh.insertAdjacentHTML('afterend', '<button class="prim" data-report="hse">Monthly HSE report</button>');
        }
        // Step 8: meeting actions — anyone who owns one sees it; the PM, Principal and DC see what is overdue.
        if (!state.navView && !document.getElementById('actionsCard')) {
          if (!ACTS_TRIED) actionsFetch().then(function(){ try { render(); } catch (e) {} });
          var boss8 = state.role === 'pm' || state.role === 'principal' || state.role === 'dc';
          var rcA = document.getElementById('rightcol');
          if (rcA && ACTS && (ACTS.length || boss8)) rcA.insertAdjacentHTML('beforeend', actionsCardHTML());
        }
        // Step 7: incoming letters waiting on a reply — Document Control logs them, the PM watches them.
        if ((state.role === 'dc' || state.role === 'pm') && !state.navView && !document.getElementById('incomingCard')) {
          var rcIn = document.getElementById('rightcol');
          if (rcIn) rcIn.insertAdjacentHTML('afterbegin', incomingCardHTML());
        }
        // Step 3: the site diary, last 14 days — on the PM's, Document Control's and site's dashboards.
        if (state.role === 'pm' || state.role === 'dc' || state.role === 'site') {
          if (!DIARY_TRIED) { DIARY_TRIED = true; fetch('/api/diary/status?days=14', { cache: 'no-store' })
            .then(function(r){ return r.ok ? r.json() : null; }).then(function(j){ DIARY_ST = j; try { render(); } catch (e) {} }).catch(function(){}); }
          var rc = document.getElementById('rightcol');
          if (rc && DIARY_ST && !document.getElementById('diaryCard')) rc.insertAdjacentHTML('afterbegin', diaryCardHTML());
        }
        // Activity feeds: what actually happened on this project, newest first.
        var FEEDS = {
          pm: [/^Live from site/, 'site'], planning: [/^Live from site/, 'site'], site: [/^Recent/, 'site'],
          consultant: [/^Recent from site/, 'site'],
          principal: [/^Across all projects/, 'all'],
          dc: [/^Distribution activity/, ['issue']],
          design: [/^Live activity/, ['submittal','ms','material','rfi','authority','letter']],
          qaqc: [/^Live activity/, ['wir','mir','ncr','material','ms','rfi']],
          hse: [/^Safety activity/, ['ptw','obs','incident','cert','ms']],
          commercial: [/^Live activity/, ['variation','letter','rfi']],
          procurement: [/^Supply activity/, ['mr']],
          finance: [/^Ledger activity/, 'ipc'],
          subcon: [/^Subcontractor activity/, 'none'],
        };
        var fd = FEEDS[state.role];
        if (fd) { var fc = cardByHeading(fd[0]); if (fc) { var h2 = fc.querySelector('h2');
          replaceCard(fd[0], '<div class="card"><h2>' + (h2 ? h2.innerHTML : 'Activity') + '</h2>' + liveFeedHTML(fd[1]) + '</div>'); } }
        replaceCard(/^Cashflow/, cashflowHTML());
        // A subcontractor valuation with no subcontract behind it.
        replaceCard(/^Sub valuations due/,
          '<div class="card"><h2>Subcontractor valuations</h2><div class="mini">' +
          'Subcontract accounts are not kept on this platform — there is no subcontract, ' +
          'no package value and no valuation behind this. Nothing is shown rather than ' +
          'a figure nobody can stand behind.</div></div>');
        // The contractual notice deadline was written against a variation that
        // does not exist. A real one is computed from the real variations.
        var cc = cardByHeading(/^Claims|^Notices|^Contract/);
        if (cc) {
          var m = cc.querySelector('.mini');
          if (m && /Notice for EoT-02/.test(m.textContent || '')) {
            var vs = openOf('variation');
            m.innerHTML = vs.length
              ? 'A notice period runs from the event, not from the variation being priced. ' +
                'There ' + (vs.length === 1 ? 'is 1 open variation' : 'are ' + vs.length + ' open variations') +
                ' on this project — check each against the contract’s notice clause.'
              : 'No variation is open on this project, so no notice period is running.';
          }
        }
      } catch (e) {}
    };
  }
  // Every record detail used to claim it belonged to a project from the design.
  function installGenericRecordFix(){
    if (typeof genericRecord !== 'function') return;
    var orig = genericRecord;
    window.genericRecord = function(ref){
      var r = orig(ref);
      try {
        (r.facts || []).forEach(function(f){
          if (f[0] === 'Project') f[1] = ME.projectName || '—';
        });
        // and it must not show an attachment nobody uploaded
        r.att = [];
        r.desc = 'This reference is not a record held on this project. It may belong to ' +
          'another project, or it may be a reference from a document rather than from the platform.';
        r.wf = [];
        r.links = [];
      } catch (e) {}
      return r;
    };
  }

  // Team & Access carried an "Edit" button on every row with no handler —
  // access could not in fact be edited. It opens the person's access for the
  // people who may change it, and is removed for everyone else.
  function installTeamEdit(){
    if (typeof render !== 'function') return;
    var orig = render;
    window.render = function(){
      orig.apply(this, arguments);
      var btns = document.querySelectorAll('#leftcol .abtn, #rightcol .abtn');
      for (var i = 0; i < btns.length; i++) {
        var b = btns[i];
        if ((b.textContent || '').trim() !== 'Edit') continue;
        // querySelectorAll returns a STATIC list: removing a node does not
        // shorten it, so stepping the index back re-visits a detached node
        // and throws on its null parent.
        if (!ME.canAssign) { if (b.parentNode) b.parentNode.removeChild(b); continue; }
        var tr = b.closest ? b.closest('tr') : null;
        var em = tr ? (tr.textContent.match(/[\w.+-]+@[\w.-]+\.\w+/) || [])[0] : null;
        if (!em) { if (b.parentNode) b.parentNode.removeChild(b); continue; }
        b.setAttribute('data-editperson', em);
      }
    };
  }
  document.addEventListener('click', function(ev){
    var t = ev.target.closest ? ev.target.closest('[data-editperson]') : null;
    if (!t) return;
    ev.preventDefault(); ev.stopImmediatePropagation();
    var acc = ACCOUNTS[t.getAttribute('data-editperson')] || {};
    var pane = document.getElementById('dpane');
    if (!pane) return;
    pane.innerHTML = '<div class="dtop"><div class="dhrow"><div><div class="dh">' +
      esc(acc.name || t.getAttribute('data-editperson')) + '</div>' +
      '<div class="dref">' + esc(t.getAttribute('data-editperson')) + '</div></div>' +
      '<button class="dclose" data-close="1">\u2715</button></div></div>' +
      '<div class="dbody"><div class="note"><div class="sechd">Access</div><ul class="facts">' +
      '<li><span class="k">Functions</span><span class="v">' + esc(acc.title || '\u2014') + '</span></li>' +
      (acc.siteDiscipline ? '<li><span class="k">Discipline</span><span class="v">' + esc(acc.siteDiscipline) + '</span></li>' : '') +
      '<li><span class="k">Status</span><span class="v">' + esc(acc._status || 'active') + '</span></li>' +
      '</ul><div class="mini">To change what someone holds, invite them again with the ' +
      'functions they should have \u2014 the invitation updates the person rather than ' +
      'creating a second one.</div>' +
      '<div class="actbar" style="margin-top:10px"><button class="prim" data-new="assign">Change access</button>' +
      '<button data-close="1">Close</button></div></div></div>';
    document.getElementById('detail').classList.remove('hide');
  }, true);

  function installNavigation(){
    if (typeof drawNav !== 'function') return;
    var orig = drawNav;
    window.drawNav = function(){
      orig.apply(this, arguments);
      // The design emits bare <a> elements. Label them so a click can be routed.
      var links = document.querySelectorAll('#nav a');
      for (var i = 0; i < links.length; i++) {
        var span = links[i].querySelector('span');
        var txt = span ? span.textContent.replace(/^[^\\w]*\\s*/, '').trim() : '';
        // strip the leading icon glyph
        var ic = links[i].querySelector('.ic');
        if (ic) txt = span.textContent.replace(ic.textContent, '').trim();
        links[i].setAttribute('data-nav', txt);
        links[i].style.cursor = 'pointer';
        if (state.navLabel && txt === state.navLabel) links[i].classList.add('on');
      }
    };
    document.addEventListener('click', function(ev){
      var back = ev.target.closest ? ev.target.closest('[data-navback]') : null;
      if (back) {
        ev.preventDefault(); ev.stopImmediatePropagation();
        state.navView = null; state.navLabel = null;
        try { render(); } catch (e) {}
        return;
      }
      var a = ev.target.closest ? ev.target.closest('#nav a[data-nav]') : null;
      if (!a) return;
      ev.preventDefault(); ev.stopImmediatePropagation();
      navGo(a.getAttribute('data-nav'));
    }, true);
  }

  function installLiveActivityPanel(){
    if(typeof openDetail!=='function') return;
    var _openDetail_orig=openDetail;
    window.openDetail=function(ref){
      _openDetail_orig(ref);
      // The design only offers its panel for refs beginning "ACT-"; a real
      // programme uses the planner's own activity codes, so match the live list.
      var a=(typeof actByRef==='function')?actByRef(ref):null;
      if(!a) return;
      var body=document.querySelector('#dpane .dbody');
      if(!body) return;
      if(!document.getElementById('livePanel')) body.insertAdjacentHTML('afterbegin', livePanel(a));
      wirePanel(a);
    };
  }

  function boot(){ try{ var lg=document.getElementById('login'); if(lg) lg.classList.add('hide'); }catch(e){} try{ wireCreate(); }catch(e){} try{ installLivePM(); }catch(e){} try{ installLiveActivityPanel(); }catch(e){} try{ installLiveAttachments(); }catch(e){} try{ installLiveRecordActions(); }catch(e){} try{ installLiveBOM(); }catch(e){} try{ installLiveIPC(); }catch(e){} try{ installMissingRegisters(); }catch(e){} try{ installRaiseGuard(); }catch(e){} try{ installRealExcelExport(); }catch(e){} try{ installLivePortfolio(); }catch(e){} try{ installNaNGuard(); }catch(e){} try{ installLiveKpis(); }catch(e){} try{ installLiveNavBadges(); }catch(e){} try{ installNavigation(); }catch(e){} try{ installLiveHse(); }catch(e){} try{ installLiveReports(); }catch(e){} try{ installPanelButtons(); }catch(e){} try{ installLastPanels(); }catch(e){} try{ installGenericRecordFix(); }catch(e){} try{ installTeamEdit(); }catch(e){} try{ installLiveFormUploads(); }catch(e){} if(!window.__NO_MODULE__){ try{ signIn(ME.email); }catch(e){} } }
  fetch('/api/data',{cache:'no-store'})
    .then(function(r){ return r.ok?r.json():null; })
    .then(function(d){ try{ mapAct(d); }catch(e){} try{ window.__RECENT=(d && d.recent) || []; }catch(e){} return loadRecords(); })
    .then(function(){ return loadPeople(); })
    .then(function(){ return loadVerify(); })
    .then(boot).catch(boot);
})();
</script>
`;

html = html.replace('</body>', BOOT + '\n' + NOTIFY_UI + '\n</body>');

// 3) Emit the module. String.raw keeps every backslash in the CSS/JS verbatim;
//    the prototype has no backticks or ${ so the template literal is safe.
const out =
`// AUTO-GENERATED from dashboard-design.html by tools/gen-app.mjs — do not edit by hand.
// The live application shell: the signed-off dashboard design, booted with the
// real signed-in user and fed live data. Regenerate with: node tools/gen-app.mjs
const TEMPLATE = String.raw\`${html}\`;
export const appHTML = (meJson) => TEMPLATE.replace('__ME_JSON__', meJson);
`;

writeFileSync(new URL('../src/html/app.js', import.meta.url), out);
console.log('wrote src/html/app.js (' + out.length + ' bytes)');
