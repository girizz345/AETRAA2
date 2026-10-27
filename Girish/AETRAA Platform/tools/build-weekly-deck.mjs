// NAF Weekly Progress Report — modelled on the ARCO/DEC contractor WPR:
// document-submittal cover, project team & scope, executive summary with a
// progress donut, overall schedule by floor, two-week look-ahead, work done,
// workforce & plant, risks/issues, progress photos, and the inputs still
// needed to reach the full report. Written in plain project-manager English.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const PptxGenJS = require('pptxgenjs');

const NAF='/mnt/user-data/uploads/Documents/Site Progress Agent/NAF/assets/';
const PH='/tmp/dphotos/';
const uri=(p,m)=>`data:${m};base64,`+readFileSync(p).toString('base64');
const LOGO=uri(NAF+'logo-contractor.png','image/png'), CONS1=uri(NAF+'logo-consultant.png','image/png'), CONS2=uri(NAF+'logo-consultant2.jpg','image/jpeg');
const PHOTOS=['d12_0','d12_1','d12_2','d12_3','d12_4','d12_5'].map(n=>uri(PH+n+'.jpeg','image/jpeg'));

const INK='1A2230', NAVY='0B2138', ACC='1C4E80', ACC2='C9A24A', MUTED='6B7280', FAINT='9AA3B2',
      LINE='E3E6EB', SOFT='F6F7F9', WHITE='FFFFFF', GOOD='2E6B4F', WARN='B7791F';
const SERIF='Cambria', SANS='Arial';
const P=new PptxGenJS(); P.defineLayout({name:'W',width:13.333,height:7.5}); P.layout='W';
const ML=0.7, MR=12.63, CW=MR-ML;

const PROJECT='Proposed Building (G+3P+4+R) — Plot 6457759';
const REF='Wadi Al Safa 3, Dubai, UAE';
const WSRNO='WSR-037', WEEKNO='Week 37', WEEK='7–13 September 2026', WKEND='13 September 2026';
const CONTRACTOR='NAF Contracting L.L.C.', CONSULT='Algafry Consulting Architects & Engineers';
const RUN=`NAF · Plot 6457759 · ${WSRNO}`;

const tx=(s,t,o)=>s.addText(t,{isTextBox:true,margin:0,...o});
function chrome(s,heading,n){
  s.background={color:WHITE};
  s.addImage({data:LOGO,x:ML,y:0.42,w:1.45,h:1.45*103/524});
  tx(s,RUN,{x:6,y:0.5,w:6.63,h:0.3,align:'right',fontFace:SANS,fontSize:8.5,color:FAINT,charSpacing:1});
  s.addShape(P.ShapeType.line,{x:ML,y:1.02,w:CW,h:0,line:{color:LINE,width:1}});
  // proper section heading — uppercase, centred, as on a formal progress report
  tx(s,heading.toUpperCase(),{x:ML,y:1.35,w:CW,h:0.5,align:'center',fontFace:SANS,fontSize:19,bold:true,color:NAVY,charSpacing:1});
  s.addShape(P.ShapeType.line,{x:ML+CW/2-0.55,y:1.98,w:1.1,h:0,line:{color:ACC2,width:2}});
  s.addShape(P.ShapeType.line,{x:ML,y:7.06,w:CW,h:0,line:{color:LINE,width:1}});
  tx(s,`${CONTRACTOR}  ·  Weekly Progress Report  ·  Private & confidential`,{x:ML,y:7.14,w:9,h:0.26,fontFace:SANS,fontSize:8,color:FAINT});
  tx(s,`${WEEKNO}  ·  ${String(n).padStart(2,'0')}`,{x:9.6,y:7.14,w:3.03,h:0.26,align:'right',fontFace:SANS,fontSize:8,color:FAINT});
}
function ctable(s,x,y,w,headers,rows,colW,opt={}){
  const num=opt.numCols||[];
  const th=headers.map((h,i)=>({text:h,options:{bold:true,color:WHITE,fill:{color:NAVY},fontFace:SANS,fontSize:opt.hfs||10,align:num.includes(i)?'right':'left',valign:'middle'}}));
  const body=rows.map((r,ri)=>r.map((c,ci)=>({text:String(c),options:{fontFace:SANS,fontSize:opt.fs||10.5,color:INK,bold:ci===0&&opt.boldFirst,align:num.includes(ci)?'right':'left',valign:'middle',fill:{color:ri%2?SOFT:WHITE}}})));
  s.addTable([th,...body],{x,y,w,colW,rowH:opt.rowH||0.34,fontFace:SANS,autoPage:false,valign:'middle',border:{type:'solid',color:LINE,pt:0.5}});
}
function bullets(s,x,y,w,items,fs=13,h=3){
  tx(s,items.map(b=>({text:b,options:{bullet:{code:'2013',indent:18},color:INK,breakLine:true}})),
    {x,y,w,h,valign:'top',fontFace:SANS,fontSize:fs,lineSpacingMultiple:1.12,paraSpaceAfter:9});
}

// ============ 1  DOCUMENT SUBMITTAL ============
let s=P.addSlide(); s.background={color:WHITE};
tx(s,'DOCUMENT SUBMITTAL',{x:ML,y:0.55,w:CW,h:0.4,align:'center',fontFace:SANS,fontSize:15,bold:true,color:NAVY,charSpacing:2});
// party logos row
const cellW=CW/3;
[['CONTRACTOR',LOGO,103/524],['LEAD CONSULTANT',CONS1,72/233],['CONSULTANT',CONS2,123/714]].forEach(([lab,img,r],i)=>{
  const x=ML+i*cellW;
  s.addShape(P.ShapeType.rect,{x,y:1.15,w:cellW,h:1.25,fill:{color:WHITE},line:{color:LINE,width:1}});
  tx(s,lab,{x:x+0.1,y:1.24,w:cellW-0.2,h:0.25,align:'center',fontFace:SANS,fontSize:8.5,bold:true,color:MUTED,charSpacing:1});
  const iw=Math.min(1.9,1.0/r*0.9); s.addImage({data:img,x:x+(cellW-iw)/2,y:1.62,w:iw,h:iw*r});
});
// meta table
ctable(s,ML,2.65,CW,['Field','Detail'],[
  ['Project',PROJECT.replace(' — ',', ')],['Employer','Employer (New Water Park)'],
  ['Consultant',CONSULT],['Contractor',CONTRACTOR],
  ['Document no.','NAF-P1-WPR-0037'],['Revision','00'],['Date of issue','14 September 2026'],
  ['Description','Weekly Progress Report — week ending 13-Sep-2026'],
],[3.0,CW-3.0],{rowH:0.36,boldFirst:true});
// approval codes
tx(s,'APPROVAL STATUS',{x:ML,y:6.15,w:CW,h:0.3,fontFace:SANS,fontSize:10,bold:true,color:ACC,charSpacing:2});
const codes=[['A','Approved'],['B','Approved with comments'],['C','Revise & resubmit'],['D','Rejected']];
let cx=ML;
codes.forEach(([c,l])=>{ s.addShape(P.ShapeType.rect,{x:cx,y:6.5,w:0.24,h:0.24,fill:{color:WHITE},line:{color:INK,width:1}});
  tx(s,`${c} — ${l}`,{x:cx+0.32,y:6.48,w:3.0,h:0.3,fontFace:SANS,fontSize:11,color:INK}); cx+=3.05;});
tx(s,'Submitted in conformance with the contract drawings and specification unless otherwise stated.',
  {x:ML,y:7.05,w:CW,h:0.3,fontFace:SANS,fontSize:9.5,italic:true,color:MUTED});

// ============ 2  TITLE ============
s=P.addSlide(); s.background={color:NAVY};
tx(s,'NAF CONTRACTING L.L.C.',{x:ML,y:0.7,w:10,h:0.3,fontFace:SANS,fontSize:11,bold:true,color:'9FB2C9',charSpacing:3});
s.addShape(P.ShapeType.line,{x:ML,y:2.5,w:1.1,h:0,line:{color:ACC2,width:2}});
tx(s,'Weekly Progress Report',{x:ML,y:2.7,w:11,h:0.5,fontFace:SANS,fontSize:15,color:'9FB2C9'});
tx(s,PROJECT,{x:ML,y:3.25,w:11.7,h:1.5,fontFace:SERIF,fontSize:38,bold:true,color:WHITE,lineSpacingMultiple:1.0});
tx(s,REF,{x:ML,y:4.75,w:11,h:0.4,fontFace:SANS,fontSize:15,color:'B9C6D6'});
tx(s,`${WSRNO}   ·   ${WEEKNO}   ·   ${WEEK}`,{x:ML,y:5.28,w:11,h:0.4,fontFace:SANS,fontSize:13,bold:true,color:'D8C79A',charSpacing:1});
s.addShape(P.ShapeType.line,{x:ML,y:6.35,w:CW,h:0,line:{color:'23405F',width:1}});
tx(s,'PREPARED BY',{x:ML,y:6.55,w:4,h:0.25,fontFace:SANS,fontSize:8.5,bold:true,color:'6E86A3',charSpacing:2});
tx(s,CONTRACTOR,{x:ML,y:6.8,w:5,h:0.3,fontFace:SANS,fontSize:12,color:WHITE});
tx(s,'FOR APPROVAL BY',{x:4.8,y:6.55,w:4,h:0.25,fontFace:SANS,fontSize:8.5,bold:true,color:'6E86A3',charSpacing:2});
tx(s,CONSULT,{x:4.8,y:6.8,w:7,h:0.3,fontFace:SANS,fontSize:12,color:WHITE});

// ============ 3  TEAM & SCOPE ============
s=P.addSlide(); chrome(s,'Project Team & Scope',3);
ctable(s,ML,2.95,CW,['Role','Party'],[
  ['Employer','Employer — New Water Park (project owner)'],
  ['Consultant / Engineer',CONSULT],
  ['Main contractor',CONTRACTOR+' — civil, MEP and finishing works'],
],[3.4,CW-3.4],{rowH:0.4,boldFirst:true});
tx(s,'SUBCONTRACTORS ON SITE THIS WEEK',{x:ML,y:4.5,w:CW,h:0.3,fontFace:SANS,fontSize:10,bold:true,color:ACC,charSpacing:2});
ctable(s,ML,4.85,CW,['Subcontractor','Package','On site'],[
  ['AK Presstress','Post-tensioning','2 staff'],
  ['Ciginetex','Fire fighting & fire alarm','10 workers'],
  ['Inches & Feet','Aluminium & glazing','16 workers'],
  ['Excel Star Tech','Garbage chute',' — '],
],[4.2,5.6,CW-9.8],{rowH:0.36,boldFirst:true,numCols:[]});

// ============ 4  EXECUTIVE SUMMARY ============
s=P.addSlide(); chrome(s,'Executive Summary',4);
// donut
s.addChart(P.ChartType.doughnut,[{name:'progress',labels:['Complete','Remaining'],values:[63,37]}],{
  x:0.55,y:2.95,w:3.2,h:3.2,holeSize:64,showLegend:false,showValue:false,
  chartColors:[ACC,'E3E6EB'],showTitle:false,dataBorder:{pt:0,color:WHITE}});
tx(s,'63%',{x:0.55,y:4.15,w:3.2,h:0.7,align:'center',fontFace:SERIF,fontSize:34,bold:true,color:NAVY});
tx(s,'complete',{x:0.55,y:4.8,w:3.2,h:0.3,align:'center',fontFace:SANS,fontSize:11,color:MUTED});
// mini facts
ctable(s,4.05,2.95,3.4,['Measure','Value'],[
  ['Actual progress','63%'],['Activities done','2,284 / 4,277'],['Contract finish','8 Nov 2026'],['Programme cut','1 Sep 2026'],
],[2.0,1.4],{rowH:0.42,fs:10,hfs:9,boldFirst:false,numCols:[1]});
// narrative
bullets(s,7.7,2.95,4.93,[
  'Site pushed hard on finishes — plaster, paint and aluminium across Podium 3, the staircases and the 4th floor.',
  'The frame is nearly closed out: 4th-floor upstands poured, boundary-wall tie-beam cast, parapet steel and shuttering set at upper roof.',
  'On the 1st-floor terrace we ran the water test and carried on waterproofing; fire sealant and firefighting moved ahead on the 2nd and 3rd floors.',
  'We averaged 149 men a day, peaking at 174 — mostly helpers and aluminium crews. No injuries or lost time all week.',
  'The programme on record is still the 1 September cut, so we will re-issue an updated one this week.',
],11,3.9);

// ============ 5  OVERALL SCHEDULE BY FLOOR ============
s=P.addSlide(); chrome(s,'Overall Progress by Floor',5);
ctable(s,ML,2.95,CW,['Level','Activities','% complete','Where it stands'],[
  ['Podium 01','164','53%','Finishes and MEP well advanced'],
  ['Podium 02','148','50%','Finishes and MEP in progress'],
  ['Podium 03','96','47%','Painting and external works live'],
  ['Ground floor','289','45%','Blockwork done, finishes underway'],
  ['Level 01','222','40%','Plaster and MEP first-fix progressing'],
  ['Level 02','220','29%','Blockwork and plaster in progress'],
  ['Level 03','220','21%','Blockwork and MEP first-fix'],
  ['Level 04','220','16%','Upstands poured, plaster starting'],
  ['Lower roof','250','3%','Parapet steel and shuttering begun'],
],[2.2,1.6,1.6,CW-5.4],{rowH:0.375,boldFirst:true,numCols:[1,2]});

// ============ 6  LOOK-AHEAD ============
s=P.addSlide(); chrome(s,'Two-Week Look-Ahead',6);
ctable(s,ML,2.95,CW,['#','Activity','Target'],[
  ['1','Podium 3, external and elevation painting','Complete'],
  ['2','Elevation 1 & 2 — bracket and fins fixing','80%'],
  ['3','4th-floor tiling and sub-frame fixing','Advance'],
  ['4','Upper-roof parapet steel and shuttering','Complete'],
  ['5','Boundary-wall tie-beam — concrete','Complete'],
  ['6','2nd / 3rd-floor fire sealant and firefighting','Advance'],
  ['7','Staircase plastering to the upper levels','Advance'],
  ['8','Re-cut and re-issue the updated programme','This week'],
],[0.7,CW-3.2,2.5],{rowH:0.42,boldFirst:false,numCols:[]});
tx(s,'Targets are the crew’s plan for the fortnight; the re-issued programme will firm up the dates against the 8 November finish.',
  {x:ML,y:6.5,w:CW,h:0.4,fontFace:SANS,fontSize:10.5,italic:true,color:MUTED});

// ============ 7  WORK COMPLETED ============
s=P.addSlide(); chrome(s,'Work Completed This Week',7);
const worksByDisc=[
  ['Structure / concrete',['4th-floor upstand concrete','Boundary-wall tie-beam — block & concrete','Upper-roof parapet steel & shuttering']],
  ['Finishes',['4th-floor wall & ceiling plaster','Staircase plastering','Podium 3 / external / elevation painting','4th-floor tiling']],
  ['Façade',['Elevation 1 & 2 bracket & fins fixing','4th-floor sub-frame fixing']],
  ['Waterproofing',['1st-floor terrace water testing, waterproofing & repair']],
  ['Fire / MEP',['2nd & 3rd-floor fire sealant','3rd-floor firefighting works']],
];
{ const rows=[]; for(const[d,it]of worksByDisc) it.forEach((x,i)=>rows.push([i===0?d:'',x]));
  ctable(s,ML,2.95,CW,['Discipline','Activity completed 7–13 September'],rows,[3.1,CW-3.1],{rowH:0.355,boldFirst:true,fs:11.5}); }

// ============ 8  WORKFORCE & PLANT ============
s=P.addSlide(); chrome(s,'Workforce & Plant',8);
ctable(s,ML,2.95,5.5,['Day','On site','Productive'],
  [['Mon 07','174','165'],['Tue 08','174','165'],['Wed 09','138','129'],['Thu 10','135','126'],['Fri 11','139','130'],['Sat 12','133','124'],['Week total','893','—'],['Peak','174','—'],['Average / day','149','140']],
  [2.2,1.65,1.65],{rowH:0.315,numCols:[1,2]});
s.addChart(P.ChartType.bar,[{name:'avg/day',labels:['PT worker','Electrician','Scaffolder','Block worker','Upstand','HVAC','Safety','Plaster','Fire fighting','Painter','Aluminium','Helper'],values:[3,4,5,5,5,6,6,6,7,9,16,36]}],{
  x:6.6,y:2.75,w:6.03,h:3.5,barDir:'bar',showTitle:true,title:'Top trades — average men per day',titleColor:NAVY,titleFontFace:SANS,titleFontSize:11,titleAlign:'left',
  showLegend:false,showValue:true,dataLabelPosition:'outEnd',dataLabelColor:MUTED,dataLabelFontSize:9,
  chartColors:[ACC],catAxisLabelColor:INK,catAxisLabelFontFace:SANS,catAxisLabelFontSize:9,
  valAxisHidden:true,valGridLine:{style:'none'},catGridLine:{style:'none'},barGapWidthPct:40});
tx(s,'Plant ran all six days — two tower/mobile cranes, passenger hoist, generators and steel bending/cutting machines; breaker, compressor and roller stood down (no earthworks scope).',
  {x:ML,y:6.4,w:CW,h:0.5,fontFace:SANS,fontSize:10.5,italic:true,color:MUTED,lineSpacingMultiple:1.1});

// ============ 9  RISKS & ISSUES ============
s=P.addSlide(); chrome(s,'Risks, Issues & Concerns',9);
ctable(s,ML,2.95,CW,['Priority','Issue','What we are doing','Owner'],[
  ['Medium','The programme still reads 1 September, so the forecast finish can’t be pinned to 8 November yet','Re-cut with September actuals and re-issue this week','NAF'],
  ['Low','Finishing trades are stacking up on the 4th floor and staircases','Split the work by zone so they stay out of each other’s way','NAF'],
  ['Low','Cube results still to come on this week’s upstand and tie-beam pours','Tracking the 7- and 28-day breaks in the inspection register','NAF / DEC'],
],[1.1,4.6,4.2,CW-9.9],{rowH:0.72,boldFirst:true,fs:10.5});

// ============ 10  PROGRESS PHOTOS ============
s=P.addSlide(); chrome(s,'Progress Photos',10);
{ const n=PHOTOS.length, gap=0.14, pw=(CW-(n-1)*gap)/n, ph=pw*603/452, y=3.2;
  PHOTOS.forEach((d,i)=>{ const x=ML+i*(pw+gap); s.addImage({data:d,x,y,w:pw,h:ph}); });
  tx(s,'Daily site diary, 7–13 September 2026',{x:ML,y:3.2+pw*603/452+0.12,w:CW,h:0.3,align:'center',fontFace:SANS,fontSize:10,italic:true,color:MUTED}); }

// ============ 11  INPUTS NEEDED ============
s=P.addSlide(); chrome(s,'Information Required to Complete the Report',11);
bullets(s,ML,2.95,CW,[
  'Procurement status — the LPOs, vendors, countries of origin and expected delivery dates for the long-lead items.',
  'Payment status — the interim applications, amounts, certified figures and dates, so the commercial position is in the pack.',
  'Authority approvals — the NOC / permit tracker (DEWA, DCD, DM, Civil Defence) with submission and approval dates.',
  'Minutes of the week’s progress meeting — the action items, owners and target dates, carried week to week.',
],13,2.6);
tx(s,'Give me these once and the report carries them forward automatically each week — the app already handles progress, workforce, look-ahead and photos.',
  {x:ML,y:5.9,w:CW,h:0.6,fontFace:SANS,fontSize:11.5,color:INK,lineSpacingMultiple:1.2});

// ============ 12  SIGN-OFF ============
s=P.addSlide(); chrome(s,'Approval',12);
const cols=[['Prepared by',CONTRACTOR,'Project Manager'],['Reviewed by',CONTRACTOR,'Planning / Technical'],['Approved by',CONSULT,'Consultant / Engineer']];
let sx=ML, sw=(CW-2*0.4)/3;
for(const[role,org,title]of cols){
  tx(s,role.toUpperCase(),{x:sx,y:3.1,w:sw,h:0.3,fontFace:SANS,fontSize:9.5,bold:true,color:ACC,charSpacing:2});
  tx(s,org,{x:sx,y:3.42,w:sw,h:0.6,fontFace:SERIF,fontSize:13,bold:true,color:NAVY,lineSpacingMultiple:1.0});
  tx(s,title,{x:sx,y:4.0,w:sw,h:0.3,fontFace:SANS,fontSize:10.5,color:MUTED});
  s.addShape(P.ShapeType.line,{x:sx,y:5.2,w:sw-0.3,h:0,line:{color:INK,width:1}});
  tx(s,'Signature & date',{x:sx,y:5.28,w:sw,h:0.3,fontFace:SANS,fontSize:9.5,color:FAINT});
  sx+=sw+0.4;
}
tx(s,`${WSRNO}  ·  ${WEEKNO}  ·  week ending ${WKEND}`,{x:ML,y:6.4,w:CW,h:0.4,fontFace:SANS,fontSize:10.5,color:MUTED});

await P.writeFile({fileName:'/mnt/user-data/outputs/NAF-Weekly-Progress-Report.pptx'});
console.log('written');
