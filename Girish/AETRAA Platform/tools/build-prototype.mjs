// Build the reviewable prototype from the APPROVED dashboard design.
//
// It is the signed-off design, unchanged, with the AETRAA Admin onboarding
// journey added in front of it so the whole platform reads in the order it is
// actually used: set a project up, then each role works in it.
//
//   node tools/build-prototype.mjs   ->  prototype.html
import { readFileSync, writeFileSync } from 'node:fs';

const src = readFileSync(new URL('../dashboard-design.html', import.meta.url), 'utf8');
const style = src.slice(src.indexOf('<style>') + 7, src.indexOf('</style>'));
const body = src.slice(src.indexOf('<body>') + 6, src.indexOf('</body>'));

// ---- the AETRAA Admin journey, injected into the design's own engine -------
const ADMIN = `
<script>
/* ============================================================
   AETRAA Admin — the project setup journey.
   Added to the approved design so the prototype shows the whole
   platform in the order it is used.
   ============================================================ */
/* accessFor() only returns dashboards listed in ALLDASH, so the new one is
   registered there first or the Admin silently falls through to Principal. */
ALLDASH.unshift('aetraa');
ROLE.aetraa = {label:'AETRAA Admin', icon:'◆', page:'AETRAA Admin — project setup'};
ACCESS.aetraa = [['aetraa','full']].concat(
  ALLDASH.filter(function(r){return r!=='aetraa';}).map(function(r){return [r,'read'];}));
ACCOUNTS['admin@aetraa.ae'] = {name:'AETRAA Admin', av:'AA', title:'Provider — onboards every client', roles:['aetraa']};

NAV.aetraa = [
  ['Onboarding', [['◆','Project setup','on'],['▣','Companies & projects','3'],['⧉','Team & access','']]],
  ['Then the project runs', [['★','Principal',''],['▦','Project Manager',''],['◷','Planning',''],['⛏','Site engineers',''],
    ['▥','Design & documents',''],['✓','QA / QC',''],['◈','HSE',''],['₳','Contracts & commercial','']]],
];

var SETUP_STEPS = [
  {n:1, k:'company',   t:'Company, project & contract terms', d:'Create the client company, the project, and the commercial terms the whole platform reads — retention, advance, payment days, notice clause.', done:true},
  {n:2, k:'xer',       t:'Programme — upload the .xer',       d:'The Primavera file becomes the project spine: activities per discipline, plus drawing, material and procurement dates.', done:true},
  {n:3, k:'boq',       t:'Priced BOQ',                        d:'The contract bill. Feeds the commercial register and the IPC valuation.', done:true},
  {n:4, k:'bom',       t:'Bill of Materials',                 d:'Budget quantities. Site orders against these, and the PM is warned when an order exceeds them.', done:true},
  {n:5, k:'brand',     t:'Branding',                          d:'Client, consultant and contractor marks, printed on this project\\'s documents.', done:true},
  {n:6, k:'templates', t:'Consultant document templates',     d:'The consultant\\'s own Word forms. Every submittal, RFI, WIR and IPC is produced in their exact format.', done:true},
  {n:7, k:'authority', t:'Authorities',                       d:'The NOCs this project must clear, by emirate — plus any the design team adds.', done:true},
  {n:8, k:'team',      t:'Team & access',                     d:'Assign people by email. Each function opens only its own dashboards.', done:true},
  {n:9, k:'live',      t:'Go live',                           d:'The project is live for its team. The Principal reviews it afterwards.', done:false},
];

function stepRow(s){
  return '<div class="strow" data-setup="'+s.k+'">'+
    '<div class="snum'+(s.done?' done':'')+'">'+(s.done?'✓':s.n)+'</div>'+
    '<div class="sbody"><b>'+s.t+'</b><div class="mini">'+s.d+'</div></div>'+
    '<div class="sgo">open ›</div></div>';
}

DASH.aetraa = function(){
  return {cols:4,
    bar:'Signed in as <b>AETRAA Admin</b> — the provider. You set every project up: the company, the programme, the bill, the materials, the consultant\\'s forms and the team. Nobody inside a client company can add a project; that is yours alone.',
    kpis:[['3','Client companies','act'],['4','Projects live',''],['9','Setup steps',''],['—','All set up by you','']],
    left:'<div class="card"><h2>Project setup <span class="r">in the order it is done</span></h2>'+
        '<div class="mini" style="margin:0 0 12px">This is the whole onboarding. Click any step to see the screen.</div>'+
        SETUP_STEPS.map(stepRow).join('')+'</div>'+
      '<div class="card"><h2>What the client sees afterwards</h2>'+
        '<div class="mini">Once you finish, the project is live and every function opens its own dashboard, built from what you loaded: the programme drives the site engineers\\' activities and the design and procurement dates; the BOQ drives the valuation; the BOM drives the material warnings; the templates drive every document issued. Switch account at the top right to see each one.</div></div>',
    right:'<div class="card"><h2>Companies &amp; projects <span class="r">locked</span></h2>'+
        '<table><tr><th>Company</th><th>Project</th><th>State</th></tr>'+
        '<tr><td><b>NAF Contracting</b></td><td>G+3P+4+R — Plot 6457759</td><td>'+pill('Live','ok')+'</td></tr>'+
        '<tr><td><b>JBBC</b></td><td>Commercial Tower</td><td>'+pill('Live','ok')+'</td></tr>'+
        '<tr><td><b>Al Barari Dev</b></td><td>Villa Compound</td><td>'+pill('Live','ok')+'</td></tr>'+
        '<tr><td><b>NAF Contracting</b></td><td>Majan Warehouse</td><td>'+pill('In setup','warn')+'</td></tr>'+
        '</table><div class="mini">Projects are added here and nowhere else — a Principal cannot create one.</div></div>'+
      '<div class="card"><h2>The model</h2><div class="mini">'+
        '<b>AETRAA (you)</b> → <b>Company</b> → <b>Principal</b> → <b>PM · engineers · QA/QC · HSE · consultant</b>.<br><br>'+
        'One platform, one UAE database, every company walled off from every other.</div></div>'};
};

/* ---- the setup screens ---- */
var SETUP_PANES = {
  company: {title:'Company, project & contract terms', body:
    '<div class="note"><div class="sechd">Company (client)</div><div class="frm">'+
      '<div class="f full"><label>Company</label><input value="NAF Contracting LLC"></div></div></div>'+
    '<div class="note"><div class="sechd">Project</div><div class="frm">'+
      '<div class="f full"><label>Project name</label><input value="G+3P+4+R — Plot 6457759"></div>'+
      '<div class="f"><label>Reference</label><input value="DIA-R-0270"></div>'+
      '<div class="f"><label>Location / emirate</label><input value="Dubai"></div>'+
      '<div class="f"><label>Client / employer</label><input value="Dubai Islands Development"></div>'+
      '<div class="f"><label>Consultant / Engineer</label><input value="DEC"></div>'+
      '<div class="f"><label>Contractor</label><input value="NAF Contracting"></div>'+
      '<div class="f"><label>Contract completion</label><input value="2026-11-08"></div></div></div>'+
    '<div class="note"><div class="sechd">Commercial terms — read by the IPC</div><div class="frm">'+
      '<div class="f"><label>Retention %</label><input value="10"></div>'+
      '<div class="f"><label>Retention cap %</label><input value="5"></div>'+
      '<div class="f"><label>Advance %</label><input value="10"></div>'+
      '<div class="f"><label>Payment period (days)</label><input value="56"></div>'+
      '<div class="f"><label>Notice clause</label><input value="Sub-Clause 20.2.1"></div>'+
      '<div class="f"><label>RFI reply (days)</label><input value="7"></div></div></div>'+
    '<div class="note"><div class="sechd">Principal — the client\\'s top person</div><div class="frm">'+
      '<div class="f"><label>Name</label><input value="M. Al Nuaimi"></div>'+
      '<div class="f"><label>Email (their sign-in)</label><input value="principal@naf.ae"></div></div></div>'+
    '<div class="actbar"><button class="prim">Create project &amp; go live</button></div>'},

  xer: {title:'Programme — Primavera .xer', body:
    '<div class="tmplnote">Nothing is saved until you have reviewed what the file contains.</div>'+
    '<div class="note"><div class="sechd">MAJ-BL 114D.xer — what was found</div>'+
      '<ul class="facts"><li><span class="k">Activities</span><span class="v">1,284</span></li>'+
      '<li><span class="k">Date range</span><span class="v">12 Mar 2026 → 8 Nov 2027</span></li>'+
      '<li><span class="k">Site work</span><span class="v">1,040</span></li>'+
      '<li><span class="k">Drawing submissions</span><span class="v">96</span></li>'+
      '<li><span class="k">Material approvals</span><span class="v">64</span></li>'+
      '<li><span class="k">Procurement</span><span class="v">84</span></li></ul></div>'+
    '<div class="note"><div class="sechd">WBS branches → discipline</div>'+
      '<div class="mini" style="margin:0 0 8px">This decides which site engineer sees which activities.</div>'+
      '<table><tr><th>WBS branch</th><th>Activities</th><th>Discipline</th></tr>'+
      '<tr><td><b>Structure</b></td><td>430</td><td><select><option selected>Civil</option><option>MEP</option><option>Architecture</option></select></td></tr>'+
      '<tr><td><b>MEP</b></td><td>388</td><td><select><option>Civil</option><option selected>MEP</option><option>Architecture</option></select></td></tr>'+
      '<tr><td><b>Finishes</b></td><td>301</td><td><select><option>Civil</option><option>MEP</option><option selected>Architecture</option></select></td></tr>'+
      '<tr><td><b>Facade</b></td><td>165</td><td><select><option>Civil</option><option>MEP</option><option>Architecture</option><option selected>Facade</option></select></td></tr>'+
      '</table></div>'+
    '<div class="dwarn"><b>114 dates will be derived.</b> The programme has no drawing or material activity for MEP or Facade, so those dates are calculated backwards from when the work starts — shop drawings 56 days before, material submittal 42 days, delivery 7 days. They are <b>assumptions until your planner accepts them</b> and are labelled <b>derived</b> everywhere they appear.</div>'+
    '<div class="actbar"><button class="prim">Load this programme into the project</button></div>'},

  boq: {title:'Priced BOQ', body:
    '<div class="note"><div class="sechd">NAF-BOQ-Rev3.xlsx</div>'+
      '<div class="mini">Ready: <b>248 lines</b> · total <b>48,200,000</b> AED. Re-importing replaces the bill.</div></div>'+
    '<div class="note"><div class="sechd">Rolled up by section</div><table><tr><th>Section</th><th>Value AED</th><th>Lines</th></tr>'+
      '<tr><td>Preliminaries</td><td>3,200,000</td><td>12</td></tr>'+
      '<tr><td>Concrete works</td><td>18,400,000</td><td>86</td></tr>'+
      '<tr><td>Masonry &amp; blockwork</td><td>4,100,000</td><td>31</td></tr>'+
      '<tr><td>Electrical</td><td>9,800,000</td><td>64</td></tr>'+
      '<tr><td>Finishes</td><td>12,700,000</td><td>55</td></tr></table>'+
      '<div class="mini">The valuation proposes each line\\'s % from live progress; the QS reviews it before anything is claimed.</div></div>'+
    '<div class="actbar"><button class="prim">Import BOQ</button></div>'},

  bom: {title:'Bill of Materials', body:
    '<div class="note"><div class="sechd">NAF-BOM-Rev2.xlsx</div>'+
      '<div class="mini">Ready: <b>96 materials</b> · value <b>7,480,000</b> AED. Re-importing updates budgets and <b>keeps</b> what site has already ordered and received.</div></div>'+
    '<div class="note"><div class="sechd">Budget quantities</div><table><tr><th>Ref</th><th>Material</th><th>Unit</th><th>Budget</th></tr>'+
      '<tr><td class="ref">M-001</td><td>Cement OPC 42.5</td><td>bag</td><td>10,000</td></tr>'+
      '<tr><td class="ref">M-002</td><td>Rebar B500B</td><td>ton</td><td>450</td></tr>'+
      '<tr><td class="ref">M-003</td><td>Blocks 200mm</td><td>no</td><td>60,000</td></tr>'+
      '<tr><td class="ref">M-004</td><td>Waterproofing membrane</td><td>m²</td><td>8,200</td></tr></table>'+
      '<div class="mini">Site raises a material request without ever seeing these figures. The PM sees them, and is warned when an order would take the ordered quantity past the budget.</div></div>'+
    '<div class="actbar"><button class="prim">Import BOM</button></div>'},

  brand: {title:'Branding', body:
    '<div class="note"><div class="sechd">Logos for this project</div><div class="frm">'+
      '<div class="f"><label>Client / employer</label><div class="filebox">⬆ Dubai Islands Development.png</div></div>'+
      '<div class="f"><label>Consultant / Engineer</label><div class="filebox">⬆ DEC.png</div></div>'+
      '<div class="f"><label>Contractor</label><div class="filebox">⬆ NAF Contracting.png</div></div>'+
      '<div class="f"><label>Second consultant</label><div class="filebox">⬆ optional</div></div></div>'+
      '<div class="mini">Shrunk in the browser, so any size file is fine. These marks are printed on this project\\'s documents and reports.</div></div>'+
    '<div class="actbar"><button class="prim">Save branding</button></div>'},

  templates: {title:'Consultant document templates', body:
    '<div class="tmplnote">Upload the consultant\\'s own blank Word form. In Word, type a placeholder where a value belongs — <b>{{ref}}</b>, <b>{{title}}</b>, <b>{{date}}</b> — or any field label from the form itself, like <b>{{Discipline}}</b>.</div>'+
    '<div class="note"><div class="sechd">Uploaded for this project</div>'+
      '<table><tr><th>Document</th><th>File</th><th>Placeholders found</th></tr>'+
      '<tr><td><b>Submittal</b></td><td class="mini">DEC-Submittal-F-012.docx</td><td class="mini">{{ref}} {{title}} {{date}} {{Discipline}} {{Spec section}}</td></tr>'+
      '<tr><td><b>RFI</b></td><td class="mini">DEC-RFI-F-004.docx</td><td class="mini">{{ref}} {{Subject}} {{Question}} {{Reply needed by}}</td></tr>'+
      '<tr><td><b>Inspection (WIR)</b></td><td class="mini">DEC-WIR-F-021.docx</td><td class="mini">{{ref}} {{Activity / element}} {{Location}} {{date}}</td></tr>'+
      '<tr><td><b>Payment application</b></td><td class="mini">DEC-IPA-F-100.docx</td><td class="mini">{{ref}} {{Period}} {{Amount}} {{contractor}}</td></tr>'+
      '</table><div class="mini">Every document the platform issues for this project comes out in that exact format. Word splits typed placeholders across runs — the engine stitches them back before filling.</div></div>'+
    '<div class="actbar"><button class="prim">Upload template</button></div>'},

  authority: {title:'Authorities', body:
    '<div class="note"><div class="sechd">Dubai — suggested from the project location</div>'+
      '<table><tr><th style="width:34px"></th><th>Authority</th><th>Scope</th><th>Action by</th></tr>'+
      '<tr><td>✓</td><td><b>DEWA</b></td><td class="mini">Power &amp; water — substation, connection, NOC</td><td>2026-09-10</td></tr>'+
      '<tr><td>✓</td><td><b>Dubai Municipality</b></td><td class="mini">Building permit, drainage, completion</td><td>2026-08-30</td></tr>'+
      '<tr><td>✓</td><td><b>Dubai Civil Defence</b></td><td class="mini">Fire &amp; life safety design and completion</td><td>2026-09-20</td></tr>'+
      '<tr><td>✓</td><td><b>RTA</b></td><td class="mini">Access, road works, hoarding NOC</td><td>2026-09-25</td></tr>'+
      '<tr><td>—</td><td><b>Trakhees</b></td><td class="mini">Free-zone permit — not applicable here</td><td>—</td></tr>'+
      '</table><div class="mini">Add your own for anything the list does not cover — a master-developer NOC, a free-zone body. Each becomes a tracked item with its own reference, action date and status.</div></div>'+
    '<div class="actbar"><button class="prim">Add to project</button></div>'},

  team: {title:'Team & access', body:
    '<div class="note"><div class="sechd">Assign a person by email</div><div class="frm">'+
      '<div class="f"><label>Full name</label><input value="R. Kumar"></div>'+
      '<div class="f"><label>Email</label><input value="civil@naf.ae"></div>'+
      '<div class="f"><label>Function</label><select><option selected>Site Engineer</option><option>Project Manager</option><option>Planning</option><option>QA/QC</option></select></div>'+
      '<div class="f"><label>Discipline</label><select><option selected>Civil</option><option>MEP</option><option>Architecture</option></select></div></div>'+
      '<div class="mini">A site engineer sees only their own discipline\\'s activities, and never the BOM.</div></div>'+
    '<div class="note"><div class="sechd">On this project</div><table><tr><th>Name</th><th>Email</th><th>Function</th></tr>'+
      '<tr><td>M. Al Nuaimi</td><td class="ref">principal@naf.ae</td><td>Principal</td></tr>'+
      '<tr><td>M. Said</td><td class="ref">pm@naf.ae</td><td>Project Manager</td></tr>'+
      '<tr><td>V. Menon</td><td class="ref">planner@naf.ae</td><td>Planning</td></tr>'+
      '<tr><td>R. Kumar</td><td class="ref">civil@naf.ae</td><td>Site Engineer · Civil</td></tr>'+
      '<tr><td>K. Nair</td><td class="ref">commercial@naf.ae</td><td>Commercial + Procurement + Finance</td></tr>'+
      '</table></div>'+
    '<div class="actbar"><button class="prim">Invite / assign email</button></div>'},

  live: {title:'Go live', body:
    '<div class="note"><div class="gensuccess"><div class="tick">✓</div>'+
      '<div style="font-size:15px;font-weight:700;color:var(--navy)">The project is live</div>'+
      '<div class="mini" style="margin-top:6px">Its team can sign in with their email. The Principal reviews the setup afterwards — it is not a gate.</div></div></div>'+
    '<div class="note"><div class="sechd">What is now running</div><ul class="facts">'+
      '<li><span class="k">Site engineers</span><span class="v">their own discipline\\'s activities</span></li>'+
      '<li><span class="k">Design</span><span class="v">drawing &amp; material submission dates</span></li>'+
      '<li><span class="k">Procurement</span><span class="v">approval, LPO and delivery dates</span></li>'+
      '<li><span class="k">Planning</span><span class="v">the programme, updating live</span></li>'+
      '<li><span class="k">PM</span><span class="v">sign-off and approval queues</span></li>'+
      '<li><span class="k">Commercial</span><span class="v">BOQ, BOM, variations, payment</span></li>'+
      '<li><span class="k">Principal</span><span class="v">the portfolio, drilling down</span></li>'+
      '</ul><div class="mini">Switch account at the top right to walk each one.</div></div>'},
};

function openSetup(k){
  var s = SETUP_PANES[k]; if(!s) return;
  var step = SETUP_STEPS.filter(function(x){return x.k===k;})[0] || {n:'',t:s.title};
  document.getElementById('dpane').innerHTML =
    '<div class="dtop"><div class="crumb"><a data-close="1">AETRAA Admin</a> › Project setup › Step '+step.n+'</div>'+
      '<div class="dhrow"><div><div class="dh">'+s.title+'</div>'+
      '<div class="dref">Step '+step.n+' of 9 · NAF Contracting — G+3P+4+R</div></div>'+
      '<button class="dclose" data-close="1">✕</button></div></div>'+
    '<div class="dbody">'+s.body+'</div>';
  document.getElementById('detail').classList.remove('hide');
}
document.addEventListener('click', function(ev){
  var st = ev.target.closest('[data-setup]');
  if(st){ openSetup(st.getAttribute('data-setup')); }
}, true);

/* The account list was built before this file loaded — rebuild it with the
   AETRAA Admin at the top, because that is where the walkthrough starts. */
(function(){
  var box = document.getElementById('accList'); if(!box) return;
  var first = 'admin@aetraa.ae';
  var order = [first].concat(Object.keys(ACCOUNTS).filter(function(e){ return e !== first; }));
  box.innerHTML = order.map(function(e){
    var a = ACCOUNTS[e];
    var fn = a.roles.map(function(r){ return ROLE[r].label; }).join(' + ');
    return '<div class="acc'+(e===first?' startHere':'')+'" data-email="'+e+'">'+
      (e===first?'<span class="startTag">START HERE</span>':'')+
      '<b>'+a.name+'</b><span class="em">'+e+'</span>'+
      '<div class="fn">'+(a.multi?'▶ ':'')+fn+'</div></div>';
  }).join('');
})();
</script>
<style>
.strow{display:flex;gap:12px;align-items:flex-start;padding:11px 12px;border:1px solid var(--line);
  border-radius:9px;margin-bottom:8px;cursor:pointer;background:var(--card)}
.strow:hover{background:var(--hover,rgba(0,0,0,.03))}
.snum{width:26px;height:26px;border-radius:50%;flex:none;display:flex;align-items:center;justify-content:center;
  font-size:12px;font-weight:700;background:var(--faint);color:#fff}
.snum.done{background:var(--good)}
.sbody{flex:1}
.sbody b{font-size:13.5px}
.sgo{font-size:11px;color:var(--faint);white-space:nowrap;align-self:center}
.protobar{background:#8a1c1c;color:#fff;padding:7px 14px;font-size:12px;text-align:center;letter-spacing:.02em}
.protobar b{color:#fff}
.acc.startHere{border-color:var(--gold);box-shadow:0 0 0 2px rgba(200,160,60,.18)}
.startTag{display:inline-block;font-size:9px;letter-spacing:.09em;font-weight:800;color:#8a6d1c;
  background:rgba(200,160,60,.18);padding:2px 6px;border-radius:4px;margin-bottom:5px}
</style>
`;

// A prototype must never be mistaken for the live platform.
const BANNER = `<div class="protobar"><b>PROTOTYPE</b> — the approved design, walked end to end. Every figure here is a worked example, not a real project.</div>`;

const out = `<title>AETRAA Platform Walkthrough</title>
<style>
html,body{margin:0;padding:0}
${style}
</style>
${BANNER}
${body}
${ADMIN}
`;

writeFileSync(new URL('../test-output/prototype.html', import.meta.url), out);
console.log('wrote prototype.html (' + out.length + ' bytes)');

// A standalone copy: a complete HTML document that opens by double-clicking it,
// works offline, and can be emailed on. In a normal browser the register
// "Excel" buttons actually download, which the artifact viewer blocks.
const standalone = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>AETRAA Platform Walkthrough</title>
<style>
html,body{margin:0;padding:0}
${style}
</style>
</head>
<body>
${BANNER}
${body}
${ADMIN}
</body>
</html>
`;
writeFileSync(new URL('../demo/AETRAA-Platform-Walkthrough.html', import.meta.url), standalone);
console.log('wrote AETRAA-Platform-Walkthrough.html (' + standalone.length + ' bytes)');
