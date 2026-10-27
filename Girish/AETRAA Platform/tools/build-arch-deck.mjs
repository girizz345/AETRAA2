// AETRAA — Post-Contract Management Platform: system architecture deck.
// Corporate house style (navy / gold, Cambria + Arial). Data-driven: the roles,
// kernel services and modules are arrays looped into slides.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const PptxGenJS = require('pptxgenjs');

const NAVY='0B2138', ACC='1C4E80', ACC2='C9A24A', INK='1A2230', MUTED='6B7280',
      FAINT='9AA3B2', LINE='E3E6EB', SOFT='F6F7F9', TINT='EAF0F6', WHITE='FFFFFF', GOOD='2E6B4F';
const SERIF='Cambria', SANS='Arial';
const P=new PptxGenJS(); P.defineLayout({name:'W',width:13.333,height:7.5}); P.layout='W';
const ML=0.7, MR=12.63, CW=MR-ML;
let PAGE=0;
const tx=(s,t,o)=>s.addText(t,{isTextBox:true,margin:0,...o});
const line=(s,x,y,w,c=LINE,pt=1)=>s.addShape(P.ShapeType.line,{x,y,w,h:0,line:{color:c,width:pt}});

function chrome(s,heading){
  PAGE++; s.background={color:WHITE};
  tx(s,'AETRAA',{x:ML,y:0.42,w:4,h:0.3,fontFace:SANS,fontSize:12,bold:true,color:NAVY,charSpacing:3});
  tx(s,'Post-Contract Management Platform',{x:6,y:0.46,w:6.63,h:0.3,align:'right',fontFace:SANS,fontSize:8.5,color:FAINT,charSpacing:1});
  line(s,ML,1.02,CW);
  tx(s,heading.toUpperCase(),{x:ML,y:1.32,w:CW,h:0.5,align:'center',fontFace:SANS,fontSize:19,bold:true,color:NAVY,charSpacing:1});
  line(s,ML+CW/2-0.55,1.95,1.1,ACC2,2);
  line(s,ML,7.06,CW);
  tx(s,'AETRAA · System Architecture · Confidential',{x:ML,y:7.14,w:9,h:0.26,fontFace:SANS,fontSize:8,color:FAINT});
  tx(s,String(PAGE).padStart(2,'0'),{x:12.0,y:7.14,w:0.63,h:0.26,align:'right',fontFace:SANS,fontSize:8,color:FAINT});
}
function bullets(s,x,y,w,items,fs=12,h=4){
  tx(s,items.map(b=>({text:b,options:{bullet:{code:'2013',indent:16},color:INK,breakLine:true}})),
    {x,y,w,h,valign:'top',fontFace:SANS,fontSize:fs,lineSpacingMultiple:1.1,paraSpaceAfter:7});
}
function cardGrid(s,y,items,cols,cardH,gap=0.25){
  const w=(CW-(cols-1)*gap)/cols;
  items.forEach((it,i)=>{
    const cx=ML+(i%cols)*(w+gap), cy=y+Math.floor(i/cols)*(cardH+gap);
    s.addShape(P.ShapeType.roundRect,{x:cx,y:cy,w,h:cardH,rectRadius:0.05,fill:{color:SOFT},line:{color:LINE,width:1}});
    tx(s,it.t,{x:cx+0.18,y:cy+0.14,w:w-0.36,h:0.34,fontFace:SANS,fontSize:12.5,bold:true,color:NAVY});
    if(it.d) tx(s,it.d,{x:cx+0.18,y:cy+0.5,w:w-0.36,h:cardH-0.6,fontFace:SANS,fontSize:9.5,color:MUTED,lineSpacingMultiple:1.05,valign:'top'});
  });
}
function imgSlide(heading,imgPath,caption){
  const s=P.addSlide(); chrome(s,heading);
  const ratio=1800/2800; let h=4.75, w=h/ratio; if(w>CW){w=CW;h=w*ratio;}
  const x=ML+(CW-w)/2, y=2.2;
  s.addShape(P.ShapeType.roundRect,{x:x-0.06,y:y-0.06,w:w+0.12,h:h+0.12,rectRadius:0.04,fill:{color:SOFT},line:{color:LINE,width:1}});
  s.addImage({path:imgPath,x,y,w,h});
  tx(s,caption,{x:ML,y:y+h+0.14,w:CW,h:0.4,align:'center',fontFace:SANS,fontSize:11,italic:true,color:MUTED});
}
// a module-detail slide (card grid of 6)
function moduleSlide(heading,tagline,cards){
  const s=P.addSlide(); chrome(s,heading);
  tx(s,tagline,{x:ML,y:2.2,w:CW,h:0.35,align:'center',fontFace:SERIF,fontSize:13,italic:true,color:ACC});
  cardGrid(s,2.7,cards,3,1.5,0.25);
}
// a discipline dashboard slide: what they SEE | what they DO
function roleSlide(role,kicker,see,doit,modules){
  const s=P.addSlide(); chrome(s,role);
  tx(s,kicker,{x:ML,y:2.25,w:CW,h:0.3,align:'center',fontFace:SERIF,fontSize:14,italic:true,color:ACC});
  const colW=(CW-0.5)/2;
  // headers
  s.addShape(P.ShapeType.rect,{x:ML,y:2.75,w:colW,h:0.4,fill:{color:NAVY}});
  tx(s,'ON THEIR DASHBOARD — WHAT THEY SEE',{x:ML+0.15,y:2.82,w:colW-0.3,h:0.28,fontFace:SANS,fontSize:10,bold:true,color:WHITE,charSpacing:1,valign:'middle'});
  s.addShape(P.ShapeType.rect,{x:ML+colW+0.5,y:2.75,w:colW,h:0.4,fill:{color:ACC}});
  tx(s,'WHAT THEY DO',{x:ML+colW+0.65,y:2.82,w:colW-0.3,h:0.28,fontFace:SANS,fontSize:10,bold:true,color:WHITE,charSpacing:1,valign:'middle'});
  bullets(s,ML,3.3,colW,see,11.5,3.2);
  bullets(s,ML+colW+0.5,3.3,colW,doit,11.5,3.2);
  tx(s,'KEY MODULES  ·  '+modules,{x:ML,y:6.55,w:CW,h:0.3,fontFace:SANS,fontSize:10,color:MUTED});
}

/* ================= 1 COVER ================= */
let s=P.addSlide(); s.background={color:NAVY};
tx(s,'AETRAA',{x:ML,y:0.75,w:8,h:0.4,fontFace:SANS,fontSize:14,bold:true,color:'9FB2C9',charSpacing:4});
line(s,ML,2.55,1.1,ACC2,2);
tx(s,'Post-Contract Management Platform',{x:ML,y:2.75,w:11.7,h:0.6,fontFace:SANS,fontSize:15,color:'9FB2C9'});
tx(s,'System Architecture',{x:ML,y:3.3,w:11.7,h:1.1,fontFace:SERIF,fontSize:44,bold:true,color:WHITE});
tx(s,'A single register kernel, role-based dashboards, template-driven set-up, signed workflows and a live activity layer — for a professional UAE main contractor.',
  {x:ML,y:4.7,w:11.4,h:1.0,fontFace:SANS,fontSize:14,color:'B9C6D6',lineSpacingMultiple:1.3});
line(s,ML,6.35,CW,'23405F',1);
tx(s,'Design document · for review before build',{x:ML,y:6.55,w:8,h:0.3,fontFace:SANS,fontSize:11,color:'6E86A3'});

/* ================= 2 EXECUTIVE OVERVIEW ================= */
s=P.addSlide(); chrome(s,'What this platform is');
bullets(s,ML,2.35,CW,[
  'One system for the whole post-contract phase — the technical, contractual, commercial, procurement, quality, HSE and subcontractor sides — instead of a folder of spreadsheets and email threads.',
  'Built on one shared register kernel: every module (RFIs, letters, variations, IPC, LPO/GRN, NCRs …) is a numbered, status-driven, signed register, so they behave the same and link to each other.',
  'Template-driven: when a project is won, you run one set-up — parties, logos, numbering, templates, workflows — and every document the project produces comes out in your format.',
  'Signed workflows: each review and approval is captured with the person’s signature, or a valid e-signature where there is none.',
  'Live: every discipline opens a dashboard showing exactly what is theirs to see and to act on, updated as the team works.',
  'Multi-tenant SaaS: each contractor is walled off in its own tenant; the same platform serves many projects and many companies.',
],13,4.4);

/* ================= 3 THE LANDSCAPE ================= */
s=P.addSlide(); chrome(s,'The post-contract landscape');
tx(s,'The functions a professional contractor runs after award — every one becomes a role with its own dashboard.',
  {x:ML,y:2.2,w:CW,h:0.4,align:'center',fontFace:SERIF,fontSize:13,italic:true,color:ACC});
cardGrid(s,2.75,[
  {t:'Project management',d:'Overall control, approvals, client interface'},
  {t:'Planning',d:'Programme, progress, look-ahead, EOT'},
  {t:'Site engineering',d:'Execution by discipline — Civil, MEP, Finishing'},
  {t:'QA / QC',d:'Inspections, NCRs, materials, test records'},
  {t:'Document control',d:'Drawings, submittals, transmittals, numbering'},
  {t:'Commercial / QS',d:'BOQ, variations, IPC, cost-value'},
  {t:'Procurement',d:'Material requests, LPOs, deliveries'},
  {t:'Finance',d:'LPO recording, GRN payment, cash flow'},
  {t:'HSE',d:'Incidents, permits, toolbox talks, statistics'},
  {t:'Contracts / claims',d:'Correspondence, notices, EOT, risk'},
  {t:'Subcontractor mgmt',d:'Packages, progress, valuation, compliance'},
  {t:'Client / Consultant',d:'Read-only + approvals, external'},
],4,1.02,0.22);

/* ================= 4 ARCHITECTURE AT A GLANCE ================= */
s=P.addSlide(); chrome(s,'Architecture at a glance');
const layers=[
  ['ROLE DASHBOARDS','PM · Planning · Site · QA/QC · Doc Control · QS · Procurement · Finance · HSE · Contracts · Subcontractor · Client',ACC],
  ['MODULES','Drawings · RFIs · Submittals · Letters · MoM · Variations · IPC · LPO→GRN→Payment · NCR · Inspections · HSE · Subcontractor',NAVY],
  ['SHARED KERNEL','Numbering · Status engine · Attachments · Cross-refs · Audit / activity feed · Parties · Permissions · Templates · Workflow · Signatures',ACC2],
  ['DATA + STORAGE','Database (D1 today → PostgreSQL on the UAE server) · Object storage for files & signatures (R2 → S3)','6B7280'],
];
let ly=2.45;
for(const[t,d,c]of layers){
  s.addShape(P.ShapeType.roundRect,{x:ML,y:ly,w:CW,h:1.0,rectRadius:0.06,fill:{color:c==='6B7280'?SOFT:TINT},line:{color:c,width:1.5}});
  tx(s,t,{x:ML+0.25,y:ly+0.14,w:3.2,h:0.7,fontFace:SANS,fontSize:13,bold:true,color:c==='6B7280'?INK:c,valign:'middle'});
  tx(s,d,{x:ML+3.6,y:ly+0.14,w:CW-3.9,h:0.72,fontFace:SANS,fontSize:10.5,color:INK,valign:'middle',lineSpacingMultiple:1.05});
  ly+=1.15;
}
tx(s,'Each layer sits on the one below. The kernel is built once; every module and every dashboard inherits it — which is what keeps the whole platform buildable and consistent.',
  {x:ML,y:7.0-0.0,w:CW,h:0.0,fontFace:SANS,fontSize:1,color:WHITE}); // spacer noop

/* ================= 5 THE KERNEL ================= */
s=P.addSlide(); chrome(s,'The register kernel');
tx(s,'Ten shared services, built once, used by every module.',{x:ML,y:2.2,w:CW,h:0.35,align:'center',fontFace:SERIF,fontSize:13,italic:true,color:ACC});
cardGrid(s,2.7,[
  {t:'1 · Numbering',d:'Per-project, per-type refs — RFI-0001, VO-07, IPC-05, LTR-OUT-0012'},
  {t:'2 · Status engine',d:'Each module’s own lifecycle, enforced and stamped'},
  {t:'3 · Attachments',d:'Any item carries files, held in object storage'},
  {t:'4 · Cross-references',d:'RFI → variation → IPC threaded together'},
  {t:'5 · Audit / activity',d:'Every change logged — powers history and the live feed'},
  {t:'6 · Parties',d:'Employer, consultant, contractor, subs as pick-lists'},
  {t:'7 · Permissions',d:'Role + trade/floor scope; money-gated commercial'},
  {t:'8 · Templates',d:'Documents rendered to your format from tokens'},
  {t:'9 · Workflow',d:'Ordered review/approve steps by role'},
  {t:'10 · Signatures',d:'Stored signature, or e-signature at approval'},
],5,1.05,0.22);

/* ================= 6 TEMPLATES / SETUP ================= */
s=P.addSlide(); chrome(s,'Template-driven project set-up');
tx(s,'Won a project? One set-up, and every document comes out in your format.',{x:ML,y:2.2,w:CW,h:0.35,align:'center',fontFace:SERIF,fontSize:13,italic:true,color:ACC});
const colW=(CW-0.5)/2;
s.addShape(P.ShapeType.rect,{x:ML,y:2.8,w:colW,h:0.4,fill:{color:NAVY}});
tx(s,'THE ONE-TIME SET-UP WIZARD',{x:ML+0.15,y:2.87,w:colW-0.3,h:0.28,fontFace:SANS,fontSize:10,bold:true,color:WHITE,charSpacing:1,valign:'middle'});
s.addShape(P.ShapeType.rect,{x:ML+colW+0.5,y:2.8,w:colW,h:0.4,fill:{color:ACC}});
tx(s,'THE TEMPLATE LIBRARY',{x:ML+colW+0.65,y:2.87,w:colW-0.3,h:0.28,fontFace:SANS,fontSize:10,bold:true,color:WHITE,charSpacing:1,valign:'middle'});
bullets(s,ML,3.35,colW,[
  'Parties, logos and contract references',
  'Numbering pattern per module (your project code)',
  'Which modules are active',
  'Which template each module uses',
  'The review/approval workflow per module',
  'Roles and who fills them',
],11.5,3);
bullets(s,ML+colW+0.5,3.35,colW,[
  'Org-level library of document templates — RFI form, letter, transmittal, GRN, IPC, NCR',
  'Tokens filled from the item: {{project.name}}, {{item.ref}}, {{signatures.pm}}',
  'Reused across projects, overridden per project where a client needs their own format',
  'Output to PDF (print) and Word where needed',
],11.5,3);

/* ================= 7 WORKFLOW ================= */
s=P.addSlide(); chrome(s,'Workflow & approvals');
tx(s,'A workflow is an ordered set of steps; an item cannot advance until the current step is signed off.',
  {x:ML,y:2.2,w:CW,h:0.35,align:'center',fontFace:SERIF,fontSize:13,italic:true,color:ACC});
const wf=[['Drawing / RFI','Engineer → PM → (Consultant)'],['GRN','Storekeeper → Engineer → PM'],
  ['Variation','QS → PM → Consultant → Client'],['IPC','QS → PM → Consultant certifies → Finance'],
  ['Letter / Notice','Drafter → PM → issued (reply clock starts)']];
let wy=2.85;
for(const[m,flow]of wf){
  s.addShape(P.ShapeType.roundRect,{x:ML,y:wy,w:CW,h:0.62,rectRadius:0.05,fill:{color:SOFT},line:{color:LINE,width:1}});
  tx(s,m,{x:ML+0.2,y:wy,w:3.0,h:0.62,fontFace:SANS,fontSize:12.5,bold:true,color:NAVY,valign:'middle'});
  tx(s,flow,{x:ML+3.3,y:wy,w:CW-3.5,h:0.62,fontFace:SANS,fontSize:12,color:INK,valign:'middle'});
  wy+=0.74;
}
tx(s,'Every step writes to the audit stream and appears on the assignee’s dashboard as “awaiting you” — with a due date and an overdue flag.',
  {x:ML,y:6.55,w:CW,h:0.4,fontFace:SANS,fontSize:11,italic:true,color:MUTED});

/* ================= 8 SIGNATURES ================= */
s=P.addSlide(); chrome(s,'Signatures & e-signatures');
const colW2=(CW-0.5)/2;
s.addShape(P.ShapeType.roundRect,{x:ML,y:2.5,w:colW2,h:3.6,rectRadius:0.06,fill:{color:SOFT},line:{color:LINE,width:1}});
tx(s,'Stored signature',{x:ML+0.25,y:2.7,w:colW2-0.5,h:0.4,fontFace:SERIF,fontSize:16,bold:true,color:NAVY});
bullets(s,ML+0.25,3.2,colW2-0.5,[
  'Each user uploads their signature once, held in object storage',
  'On approval it is stamped into the document’s sign-off block automatically',
  'The finished RFI / letter / GRN / IPC carries real signatures',
],11.5,2.6);
s.addShape(P.ShapeType.roundRect,{x:ML+colW2+0.5,y:2.5,w:colW2,h:3.6,rectRadius:0.06,fill:{color:TINT},line:{color:ACC,width:1}});
tx(s,'E-signature fallback',{x:ML+colW2+0.75,y:2.7,w:colW2-0.5,h:0.4,fontFace:SERIF,fontSize:16,bold:true,color:ACC});
bullets(s,ML+colW2+0.75,3.2,colW2-0.5,[
  'No signature on file? Sign at the moment — draw or type your name',
  'A defensible record is kept: name, role, timestamp, method, and a one-time email confirmation',
  'Supported by the UAE Electronic Transactions Law for this kind of approval',
],11.5,2.6);
tx(s,'For anything that must hold up contractually, your counsel confirms the e-sign wording; a certified provider (UAE Pass / DocuSign) can be added if a client requires it.',
  {x:ML,y:6.35,w:CW,h:0.5,fontFace:SANS,fontSize:10.5,italic:true,color:MUTED});

/* ================= 9 MODULE MAP ================= */
s=P.addSlide(); chrome(s,'The module map');
const groups=[
  ['Technical & document',['Shop / IFC / tender drawings','RFIs','Material submittals (MAR)','Transmittals & distribution']],
  ['Quality & HSE',['Inspection requests (WIR / MIR)','NCRs','HSE — incidents, permits, TBT','Test & cube records']],
  ['Contractual',['Correspondence (letters in/out)','Notices','Minutes of meeting / actions','EOT & claims, risk register']],
  ['Commercial',['Variations (VO)','IPC / valuations','Cost-value reconciliation','Subcontractor valuations']],
  ['Procurement & finance',['Material requests','LPO','GRN','Invoice match & payment']],
  ['Subcontractor',['Subcontract register','Sub progress & manpower','Sub payment & retention','Compliance & KPI']],
];
const gW=(CW-2*0.25)/3;
groups.forEach((g,i)=>{
  const gx=ML+(i%3)*(gW+0.25), gy=2.4+Math.floor(i/3)*2.25;
  s.addShape(P.ShapeType.roundRect,{x:gx,y:gy,w:gW,h:2.05,rectRadius:0.06,fill:{color:WHITE},line:{color:LINE,width:1}});
  s.addShape(P.ShapeType.rect,{x:gx,y:gy,w:gW,h:0.42,fill:{color:NAVY}});
  tx(s,g[0].toUpperCase(),{x:gx+0.15,y:gy+0.07,w:gW-0.3,h:0.3,fontFace:SANS,fontSize:10.5,bold:true,color:WHITE,charSpacing:1,valign:'middle'});
  bullets(s,gx+0.15,gy+0.55,gW-0.3,g[1],10.5,1.4);
});

/* ================= 10 ROLE DASHBOARDS INTRO ================= */
s=P.addSlide(); chrome(s,'Role dashboards');
tx(s,'Every discipline signs in to one thing that is theirs — what to see, and what to act on.',
  {x:ML,y:2.5,w:CW,h:0.5,align:'center',fontFace:SERIF,fontSize:16,italic:true,color:ACC});
bullets(s,ML+1.5,3.4,CW-3,[
  'The same data, shown twelve different ways — each role sees its own slice, at its own scope (trade, floor, package).',
  'The left of each screen is the picture; the right is the queue — the items awaiting that person’s action, with due dates.',
  'Money is shown only to those entitled to see it; the site and read-only roles never receive the figures, even in the data.',
  'The pages that follow show, per discipline, what appears on the dashboard and what the person does.',
],13,3);

/* ================= DASHBOARD DESIGN (mockups) ================= */
imgSlide('Dashboard design — Project Manager',
  '/tmp/dash-pm.png',
  'The PM sees the whole job and the queue awaiting their signature. Left: the picture. Right: what to act on, now.');
imgSlide('Dashboard design — QA / QC',
  '/tmp/dash-qa.png',
  'The same platform, the QA/QC slice — inspection pipeline, the NCR register, and the approvals awaiting the inspector. One click switches role.');

/* ================= 11+ ROLE SLIDES ================= */
const ROLES=[
 ['Project Director / Project Manager','Command & control — the whole job on one screen',
  ['Overall % complete vs the programme, and forecast finish vs the contract date','Everything awaiting their approval, across every module','Top risks, overdue RFIs, open NCRs, delay events','Cash position — certified vs received, this month’s IPC','This week’s exceptions and the activity feed'],
  ['Approve drawings, RFIs, variations, GRNs and IPC at their step — signed','Sign off the day and the week','Set targets and issue instructions','Escalate and direct; interface with the client'],
  'All modules · approvals · reports'],
 ['Planning Engineer','The programme, and where the job is really going',
  ['Baseline vs actual S-curve and % complete','Critical path and the driving activities','2–3 week look-ahead and float erosion','Delay events and the EOT tracker'],
  ['Status the programme from what site reports','Run what-if impacts on the critical path','Issue the look-ahead; log delays with evidence','Build the EOT from the CPM and the record'],
  'Programme / CPM · progress · look-ahead · EOT'],
 ['Site Engineer — Civil / MEP / Finishing','The work front, scoped to their trade and floors',
  ['Their activities and % by floor and trade','The live, approved drawings for their scope','Open RFIs, WIRs and NCRs on their area','Today’s manpower and the diary'],
  ['Submit daily progress with photos','Raise RFIs, inspection requests, access & material requests','Close out NCRs on their area','Keep the daily diary'],
  'Progress · drawings · RFIs · inspections · diary'],
 ['QA / QC Engineer','Quality, held as a register not a memory',
  ['WIR / MIR pipeline — raised, approved, failed','The NCR register and its ageing','Material approvals (MAR) status','ITPs and pending cube / test results'],
  ['Raise and close inspection requests','Issue and close NCRs — signed','Approve materials against spec','Record test and cube results'],
  'Inspections · NCRs · submittals · test records'],
 ['Document Controller','The single source of truth for every sheet and letter',
  ['Drawings register — current revision and superseded','Submittals log and transmittals','Correspondence and distribution status','Numbering and revision control'],
  ['Register and distribute drawings and submittals','Issue transmittals','Maintain numbering and control revisions','Route documents to the right people'],
  'Drawings · submittals · transmittals · correspondence'],
 ['Commercial / Quantity Surveyor','The money, tied to what has actually been built',
  ['BOQ vs progress — earned value','Variation register with cost and time impact','IPC status — applied vs certified','Subcontractor valuations and cost-value reconciliation'],
  ['Prepare the IPC and valuations','Price and submit variations','Value subcontractor work and apply retention','Reconcile cost against value'],
  'Variations · IPC · BOQ · subcontractor valuations'],
 ['Procurement / Buyer','From a need on site to a purchase order',
  ['Material requests awaiting a PO','The LPO log and delivery dates','The long-lead tracker','Vendor list and GRNs awaiting'],
  ['Raise the LPO to the vendor','Chase deliveries and update ETAs','Manage vendors and quotes','Hand over to finance and store'],
  'Material requests · LPO · vendors · deliveries'],
 ['Finance / Accounts','The purse, released only against approved work',
  ['LPOs committed and advances paid','GRNs approved and awaiting payment','Invoices — the 3-way match','Payables, receivables and cash flow'],
  ['Record the LPO and commit the value','Release payment on an approved GRN + invoice','Track client IPC receipts and retention','Report the cash position'],
  'LPO · GRN · invoices · payments · cash flow'],
 ['HSE Officer','Safety, as a live record and a statistic',
  ['Incidents, near-misses and LTIs','Toolbox talks and attendance','Permits to work','Man-hours and AFR / LTIR rates'],
  ['Log incidents and near-misses','Record toolbox talks and permits','Raise HSE observations','Produce the HSE statistics'],
  'HSE · permits · inspections · statistics'],
 ['Contracts / Claims Manager','The contract, defended in writing and on time',
  ['Correspondence register with reply clocks','Notices issued and received','EOT and claims status','The risk register and key contractual dates'],
  ['Draft and issue letters and notices — signed','Run the reply clocks','Build the EOT from the CPM and records','Maintain the risk register'],
  'Correspondence · notices · EOT · risk'],
];
for(const r of ROLES) roleSlide(r[0],r[1],r[2],r[3],r[4]);

/* ================= SUBCONTRACTOR — ROLE ================= */
roleSlide('Subcontractor Coordinator','The packages that build the job, managed as one',
  ['The subcontract register — package, value, % complete','Subcontractor manpower on site, from the diary','Sub submittals and RFIs routed through you','Sub payment / valuation status, and compliance & KPI'],
  ['Onboard subcontractors and hold their subcontract','Track package progress against the main programme','Route sub submittals and RFIs to the consultant','Value sub work, apply retention, flag compliance & performance'],
  'Subcontractor register · valuation · compliance · KPI');

/* ================= SUBCONTRACTOR — MODULE DETAIL ================= */
s=P.addSlide(); chrome(s,'Subcontractor management');
tx(s,'Each package runs as a mini-contract inside the main one — back-to-back, and rolled up.',
  {x:ML,y:2.2,w:CW,h:0.35,align:'center',fontFace:SERIF,fontSize:13,italic:true,color:ACC});
cardGrid(s,2.7,[
  {t:'Register',d:'Package scope, subcontract value, dates, retention %, back-to-back terms'},
  {t:'Progress',d:'% per package, contribution to the main programme, manpower from the diary'},
  {t:'Commercial',d:'Sub payment application → valuation → certificate → payment; retention & back-charges'},
  {t:'Submittals & RFIs',d:'Raised by the sub, routed through the main contractor to the consultant'},
  {t:'Compliance',d:'Trade licence, insurance, WPS / labour, third-party certs, HSE induction'},
  {t:'Performance / KPI',d:'Progress adherence, NCRs against the sub, HSE, delivery reliability'},
],3,1.5,0.25);

/* ================= QA / QC & INSPECTION RECORDS ================= */
moduleSlide('QA / QC & inspection records','Quality held as a signed record — request, inspect, close.',[
  {t:'Inspection requests',d:'WIR / MIR raised by site, booked to the consultant, approved / conditional / failed — with the inspector’s signature'},
  {t:'Material approvals (MAR)',d:'Submittal → review → approved / approved-with-comments / rejected, with the resubmission chain kept'},
  {t:'NCR register',d:'Raised (auto on a failed inspection), corrective action, re-inspection, close-out — each step signed'},
  {t:'ITPs & checklists',d:'Inspection & test plans and pour / installation checklists tied to the activity'},
  {t:'Test & cube records',d:'7-day / 28-day concrete cubes and material tests, results logged against the pour'},
  {t:'Approval history',d:'Every inspection and approval carries who, when and the signature — the quality dossier at handover'},
]);

/* ================= HSE RECORDS ================= */
moduleSlide('HSE — records, approvals & inspections','Safety as a live register and a defensible statistic.',[
  {t:'Incidents & near-misses',d:'Logged with photos, investigation and close-out; LTIs flagged'},
  {t:'Permits to work',d:'Hot work, confined space, excavation, lifting — requested, approved & signed, time-boxed'},
  {t:'Toolbox talks',d:'Topic, attendees and sign-in sheet captured each day'},
  {t:'HSE inspections & observations',d:'Site walk findings raised, assigned and closed — like an NCR for safety'},
  {t:'Statistics',d:'Man-hours, AFR and LTIR computed automatically for the report'},
  {t:'Environmental & authority',d:'COSHH, waste, authority HSE visits and their sign-offs'},
]);

/* ================= AUTHORITY & PERMITS ================= */
moduleSlide('Authority records & permits','Every NOC and permit, tracked from submission to sign-off.',[
  {t:'NOC / permit register',d:'DEWA, DCD, DM, Civil Defence, DDA, RTA, Trakhees — one register per authority'},
  {t:'Submission → approval',d:'Planned vs actual submission and approval dates, with the current status'},
  {t:'Inspections & bookings',d:'Authority inspections booked, results and re-inspections recorded'},
  {t:'Energisation & connections',d:'Power-on, water, telecom, drainage connections tracked to live'},
  {t:'Completion certificates',d:'BCC / building completion, fire clearance and handover NOCs'},
  {t:'Expiry & renewals',d:'Permit validity and renewal alerts so nothing lapses mid-works'},
]);

/* ================= CLIENT / CONSULTANT ================= */
roleSlide('Client / Consultant (external)','A window in, and a place to approve',
  ['A read-only dashboard — progress, look-ahead and photos','Everything awaiting their approval — drawings, RFIs, variations, IPC','The reports, as issued'],
  ['Approve, comment or reject at their workflow step — with an e-signature','Raise the reply that starts or stops a clock','Download the reports'],
  'Approvals · reports · read-only dashboard');

/* ================= PROCUREMENT CHAIN ================= */
s=P.addSlide(); chrome(s,'Procurement to payment — the chain');
const chain=[['Material\nRequest','Site / Engineer'],['LPO','Procurement'],['Finance\nrecords','Finance'],
  ['GRN on\ndelivery','Storekeeper'],['Engineer\napproves','Engineer'],['PM\napproves','PM'],['Payment\nreleased','Finance']];
const bw=1.55, bh=1.0, gapx=(CW-chain.length*bw)/(chain.length-1);
let bx=ML;
chain.forEach((c,i)=>{
  const y=3.1;
  s.addShape(P.ShapeType.roundRect,{x:bx,y,w:bw,h:bh,rectRadius:0.06,fill:{color:i%2?TINT:SOFT},line:{color:ACC,width:1.2}});
  tx(s,c[0],{x:bx,y:y+0.14,w:bw,h:0.55,align:'center',fontFace:SANS,fontSize:11.5,bold:true,color:NAVY,valign:'middle',lineSpacingMultiple:0.95});
  tx(s,c[1],{x:bx,y:y+0.68,w:bw,h:0.28,align:'center',fontFace:SANS,fontSize:8.5,color:MUTED});
  if(i<chain.length-1) tx(s,'→',{x:bx+bw,y:y+0.3,w:gapx,h:0.4,align:'center',fontFace:SANS,fontSize:18,bold:true,color:ACC2});
  bx+=bw+gapx;
});
tx(s,'Each hop is a signed workflow step; the items are cross-linked, so opening any one shows the whole chain and where it stands — live.',
  {x:ML,y:4.6,w:CW,h:0.5,align:'center',fontFace:SANS,fontSize:12,color:INK});
bullets(s,ML+1.5,5.2,CW-3,[
  'Optionally begins from a BOM shortfall, so the need is quantified, not guessed',
  'Invoice is 3-way matched to the LPO and the approved GRN before payment',
  'Retention, advances and back-charges carried through to the payment',
],11,1.6);

/* ================= CROSS-MODULE FLOW ================= */
s=P.addSlide(); chrome(s,'How the modules connect');
tx(s,'The cross-reference spine is what makes it a system, not a set of lists.',
  {x:ML,y:2.2,w:CW,h:0.35,align:'center',fontFace:SERIF,fontSize:13,italic:true,color:ACC});
const flow=[['Drawing (Rev C)',ACC],['RFI — clash',ACC],['Variation — +12 days, cost',NAVY],['CPM prices the delay',ACC2],['IPC — this month’s value',NAVY],['Payment',GOOD]];
let fy=3.0;
flow.forEach((f,i)=>{
  s.addShape(P.ShapeType.roundRect,{x:ML+2.5,y:fy,w:CW-5,h:0.52,rectRadius:0.05,fill:{color:SOFT},line:{color:f[1],width:1.4}});
  tx(s,f[0],{x:ML+2.5,y:fy,w:CW-5,h:0.52,align:'center',fontFace:SANS,fontSize:12.5,bold:true,color:INK,valign:'middle'});
  if(i<flow.length-1) tx(s,'↓',{x:ML+CW/2-0.2,y:fy+0.5,w:0.4,h:0.24,align:'center',fontFace:SANS,fontSize:14,bold:true,color:ACC2});
  fy+=0.74;
});
tx(s,'A contractual letter can be issued off any of these, clause-referenced, with its reply clock running.',
  {x:ML,y:fy+0.05,w:CW,h:0.4,align:'center',fontFace:SANS,fontSize:11,italic:true,color:MUTED});

/* ================= LIVE UPDATES ================= */
s=P.addSlide(); chrome(s,'The live layer');
const live=[
  ['1 · Server-authoritative','Every page reads current data on load — never stale. You have this today.',SOFT,LINE],
  ['2 · Auto-refresh','Dashboards and registers poll every ~20s and repaint what changed. Feels live, works now, near-zero cost.',TINT,ACC],
  ['3 · Real-time push','Instant updates over WebSocket — on the UAE / Node server, or Durable Objects on Cloudflare. For shared live boards; add later.',SOFT,LINE],
];
let vy=2.5;
for(const[t,d,bg,bc]of live){
  s.addShape(P.ShapeType.roundRect,{x:ML,y:vy,w:CW,h:1.15,rectRadius:0.06,fill:{color:bg},line:{color:bc,width:1.4}});
  tx(s,t,{x:ML+0.25,y:vy+0.16,w:CW-0.5,h:0.4,fontFace:SERIF,fontSize:15,bold:true,color:NAVY});
  tx(s,d,{x:ML+0.25,y:vy+0.58,w:CW-0.5,h:0.5,fontFace:SANS,fontSize:11.5,color:INK,lineSpacingMultiple:1.05});
  vy+=1.3;
}
tx(s,'All three feed one activity stream off the audit log — “RFI-0012 answered”, “VO-07 approved”, “IPC-05 certified” — shown live and, for your own items, pushed to email or phone.',
  {x:ML,y:6.5,w:CW,h:0.5,fontFace:SANS,fontSize:11,italic:true,color:MUTED});

/* ================= PERMISSIONS / MONEY ================= */
s=P.addSlide(); chrome(s,'Permissions & the money line');
bullets(s,ML,2.5,CW,[
  'Roles are configurable per project — the fixed five (owner, manager, engineer, site, view) plus procurement, finance, storekeeper, QS / commercial, and the external client / consultant.',
  'Every person is scoped: a site engineer sees only their trades and floors; a subcontractor coordinator only their packages.',
  'Workflow steps point at roles, so the right person is asked at the right moment — and only they can sign that step.',
  'Commercial modules (variations, IPC, payments, valuations) are money-gated: the figures never reach an unentitled role, even in the raw data — extending the money-stripping already in the system.',
  'Everything a person does is signed and logged, so the record shows not just what happened but who authorised it.',
],13,3.8);

/* ================= SAAS / HOSTING ================= */
s=P.addSlide(); chrome(s,'Multi-tenant SaaS & where it runs');
bullets(s,ML,2.5,CW,[
  'One platform, many tenants: each contractor is walled off by a tenant boundary on every record and enforced at the query layer — the pattern already proven by the project-scope enforcement.',
  'Each tenant runs many projects; each project is set up once from templates and workflows.',
  'Files and signatures live in object storage — R2 today, S3-compatible on the UAE server.',
  'The database is portable (D1 is SQLite; the SQL runs unchanged on PostgreSQL), so the move to a UAE-hosted server is a deployment step, not a rewrite.',
  'Design the kernel — templates, workflow, signatures, tenancy — now, so nothing has to be rebuilt when the platform grows or moves.',
],13,3.8);

/* ================= ROADMAP ================= */
s=P.addSlide(); chrome(s,'Build roadmap');
const road=[
  ['1','Kernel v1','Numbering · attachments · cross-refs · audit / activity feed · parties · permissions'],
  ['2','Kernel v2','Templates + set-up wizard · workflow engine · signatures / e-sign'],
  ['3','RFIs','Promote from Issues — proves the kernel, workflow and signatures on real data'],
  ['4','Letters + MoM','Correspondence and actions — pure register, high value'],
  ['5','Procurement chain','Material request → LPO → GRN → invoice → payment (multi-role workflow)'],
  ['6','Variations → IPC','The commercial modules, money-gated, linked to the CPM'],
  ['7','Subcontractor','Register, valuation, compliance, KPI'],
  ['8','Live + real-time','Activity feed & auto-refresh now; WebSocket push after the UAE move'],
];
let ry=2.4;
for(const[n,t,d]of road){
  s.addShape(P.ShapeType.ellipse,{x:ML,y:ry,w:0.5,h:0.5,fill:{color:NAVY}});
  tx(s,n,{x:ML,y:ry,w:0.5,h:0.5,align:'center',fontFace:SANS,fontSize:14,bold:true,color:WHITE,valign:'middle'});
  tx(s,t,{x:ML+0.75,y:ry,w:3.2,h:0.5,fontFace:SANS,fontSize:13,bold:true,color:NAVY,valign:'middle'});
  tx(s,d,{x:ML+4.0,y:ry,w:CW-4.0,h:0.5,fontFace:SANS,fontSize:11,color:INK,valign:'middle'});
  ry+=0.585;
}

/* ================= CLOSING ================= */
s=P.addSlide(); s.background={color:NAVY};
line(s,ML,2.6,1.1,ACC2,2);
tx(s,'The principle',{x:ML,y:2.8,w:11,h:0.4,fontFace:SANS,fontSize:14,color:'9FB2C9'});
tx(s,'Build the kernel once.\nEvery module and every dashboard inherits it.',
  {x:ML,y:3.3,w:11.6,h:1.6,fontFace:SERIF,fontSize:30,bold:true,color:WHITE,lineSpacingMultiple:1.05});
tx(s,'Next: lock this architecture, then the data model and a phased build plan for sign-off.',
  {x:ML,y:5.3,w:11,h:0.5,fontFace:SANS,fontSize:14,color:'B9C6D6'});

await P.writeFile({fileName:'/mnt/user-data/outputs/AETRAA-Post-Contract-Architecture.pptx'});
console.log('written', PAGE, 'content pages +2');
