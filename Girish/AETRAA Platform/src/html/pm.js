import { THEME_CSS } from './theme.js';
import { HEAD_LINKS, PWA_BOOT, BRAND_CSS, BRAND_MARK } from './shared.js';

// The Project Manager / Project Director dashboard.
//
// The PM runs the job: the site engineer marks an activity finished, and it
// counts toward progress and payment only once the PM verifies the work and
// signs it off. Nothing goes out until the PM approves it — the contractor
// prepares, the PM approves, and it is submitted to the consultant/Engineer for
// their action; the client releases payment.
//
// Wired live: sign-off queue (/api/verify, and the sign-off/ query buttons post
// straight back to it), the programme (/api/data), drawings to approve
// (/api/drawings, status=pending) and RFIs/notices out (/api/issues).

export const pmHTML = () => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Project Manager · AETRAA</title>
${HEAD_LINKS}
<style>${THEME_CSS}${BRAND_CSS}
.wrap { max-width: 1320px; }
.bar { background: var(--surface); border: 1px solid var(--border); border-left: 3px solid var(--series-1);
       border-radius: 10px; padding: 12px 16px; margin: 0 0 16px; font-size: 13.5px; color: var(--ink-2); line-height: 1.5; }
.bar b { color: var(--ink); }
.kpis { display: grid; gap: 12px; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); margin: 0 0 18px; }
.kpi { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 14px 16px; box-shadow: var(--shadow); }
.kpi .v { font-size: 26px; font-weight: 600; letter-spacing: -0.02em; line-height: 1.1; }
.kpi .l { font-size: 12px; color: var(--muted); margin-top: 3px; }
.kpi.act .v { color: var(--series-1); }
.kpi.bad .v { color: var(--critical); }
.kpi.warn .v { color: var(--serious); }
.kpi.good .v { color: var(--good-text); }
.cols { display: grid; gap: 16px; grid-template-columns: 1.7fr 1fr; align-items: start; }
@media (max-width: 900px) { .cols { grid-template-columns: 1fr; } }
.card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 16px 18px; box-shadow: var(--shadow); margin: 0 0 16px; }
.card.hi { border-left: 3px solid var(--gold, var(--serious)); }
.card h2 { font-size: 15px; display: flex; justify-content: space-between; align-items: baseline; margin: 0 0 12px; }
.card h2 .r { font-size: 12px; color: var(--muted); font-weight: 400; }
table { width: 100%; border-collapse: collapse; font-size: 13px; }
th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; color: var(--muted); font-weight: 600; padding: 6px 8px; border-bottom: 1px solid var(--border); }
td { padding: 8px; border-bottom: 1px solid var(--grid); vertical-align: middle; }
.ref { font-size: 11.5px; color: var(--muted); font-variant-numeric: tabular-nums; }
.pill { font-size: 11px; padding: 2px 9px; border-radius: 999px; display: inline-block; background: var(--grid); color: var(--ink-2); white-space: nowrap; }
.pill.late { background: color-mix(in srgb, var(--critical) 16%, transparent); color: var(--critical); }
.pill.warn { background: color-mix(in srgb, var(--serious) 18%, transparent); color: var(--serious); }
.pill.wp { background: color-mix(in srgb, var(--series-1) 16%, transparent); color: var(--series-1); }
.pill.done { background: color-mix(in srgb, var(--good-text) 16%, transparent); color: var(--good-text); }
.btnrow { display: flex; gap: 6px; }
.b { font: inherit; font-size: 12px; padding: 5px 11px; border-radius: 8px; border: 1px solid var(--border); background: var(--surface-2); color: var(--ink); cursor: pointer; }
.b:hover { background: var(--grid); }
.b.prim { background: var(--series-1); border-color: var(--series-1); color: #fff; }
.b.prim:hover { filter: brightness(1.06); }
.b.warn { border-color: var(--serious); color: var(--serious); }
.actbar { display: flex; flex-wrap: wrap; gap: 8px; }
.actbar a.b { text-decoration: none; }
.mini { font-size: 12px; color: var(--muted); margin-top: 10px; line-height: 1.5; }
.mbar { height: 6px; width: 80px; border-radius: 3px; background: var(--grid); overflow: hidden; display: inline-block; vertical-align: middle; }
.mbar i { display: block; height: 100%; background: var(--series-1); }
.feed { display: grid; gap: 9px; }
.feed .it { display: flex; gap: 9px; align-items: baseline; font-size: 13px; }
.feed .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--muted); flex: none; margin-top: 5px; }
.feed .dot.g { background: var(--good-text); } .feed .dot.a { background: var(--serious); } .feed .dot.r { background: var(--critical); }
.feed .w { font-size: 11px; color: var(--muted); margin-left: auto; white-space: nowrap; }
.empty { color: var(--muted); font-size: 13px; padding: 6px 0; }
.loading { color: var(--muted); padding: 24px; text-align: center; }
</style>
</head>
<body>
<div class="topbar"><div class="topbar-in">
  ${BRAND_MARK}
  <div class="brand"><h1>Project Manager</h1><div class="sub" id="sub">the job you run</div></div>
  <div class="spacer"></div>
  <button class="btn" id="themeBtn" title="Light / dark">◐</button>
  <a class="btn" href="/drawings">Design</a>
  <a class="btn" href="/schedule">Programme</a>
  <a class="btn" href="/resources">Resources</a>
  <a class="btn" href="/reports">Reports</a>
  <a class="btn" href="/api/logout">Sign out</a>
</div></div>

<div class="wrap">
  <div class="bar">Signed in as <b>Project Manager</b> — you run the job. You sign off the work the site reports as finished, and nothing goes out until you approve it: the contractor prepares it, you approve, it is submitted to the consultant / Engineer <b>for their action</b>, and the client releases payment.</div>
  <div class="kpis" id="kpis"><div class="loading">Loading the project…</div></div>
  <div class="cols">
    <div>
      <div class="card"><h2>Activities finished — awaiting your sign-off <span class="r" id="soN"></span></h2><div id="signoff"><div class="loading">Loading…</div></div>
        <div class="mini">The site engineer marks an activity finished; it counts toward progress and payment only once you verify the work and sign it off. Query it back if the work is not right.</div></div>
      <div class="card"><h2>Programme — in progress &amp; pending <span class="r" id="progAsOf"></span></h2><div id="programme"><div class="loading">Loading…</div></div>
        <div class="mini">Live from what the site engineers report. Activities flagged delayed / at-risk / on-hold are shown first.</div></div>
    </div>
    <div>
      <div class="card hi"><h2>Prepare &amp; issue <span class="r">contractor → consultant</span></h2>
        <div class="actbar">
          <a class="b prim" href="/drawings">Drawings &amp; submittals</a>
          <a class="b" href="/issues">＋ RFI / notice</a>
          <a class="b" href="/reports">Progress report</a>
        </div>
        <div class="mini">You are not limited to what the team sends up — originate a submission or an RFI and issue it. Every action is logged against your name.</div></div>
      <div class="card"><h2>To approve &amp; out with the consultant <span class="r" id="outN"></span></h2><div id="out"><div class="loading">Loading…</div></div>
        <div class="mini">Drawings uploaded by the team wait here for your approval; RFIs and notices already issued are with the consultant for reply.</div></div>
      <div class="card"><h2>Live from site</h2><div id="feed" class="feed"><div class="loading">Loading…</div></div></div>
    </div>
  </div>
</div>
<div class="toast" id="toast"></div>

<script>
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function one(n){return (Math.round((n||0)*10)/10).toFixed(1);}
function r0(n){return Math.round(n||0);}
function fmt(s){if(!s)return '—';var d=new Date(String(s).slice(0,10)+'T00:00:00Z');if(isNaN(d))return '—';var m=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];return String(d.getUTCDate()).padStart(2,'0')+' '+m[d.getUTCMonth()]+' '+String(d.getUTCFullYear()).slice(2);}
function ago(ts){if(!ts)return '';var mins=Math.floor((Date.now()-Date.parse(ts))/60000);if(!isFinite(mins))return '';if(mins<1)return 'just now';if(mins<60)return mins+'m';var h=Math.floor(mins/60);if(h<24)return h+'h';var d=Math.floor(h/24);return d+'d';}
function toast(m){var t=document.getElementById('toast');t.textContent=m;t.classList.add('show');setTimeout(function(){t.classList.remove('show');},2600);}

var DATA=null, VER=null;

function statusOf(a){
  var c=(DATA.current||{})[a.id]||{};
  var pct=c.pct||0; var st=(c.status||'').toLowerCase();
  if(st==='delayed'||st==='at_risk'||st==='on_hold') return {pct:pct,cls:'late',txt:st==='on_hold'?'On hold':(st==='delayed'?'Delayed':'At risk'),risk:true};
  if(pct>=100) return {pct:100,cls:'done',txt:'Complete'};
  if(pct>0) return {pct:pct,cls:'wp',txt:'In progress'};
  return {pct:0,cls:'warn',txt:'Not started'};
}
function sec(a){return a.trade_group||a.discipline||a.trade||'—';}

async function loadAll(){
  var [rd,rv]=await Promise.all([fetch('/api/data',{cache:'no-store'}),fetch('/api/verify',{cache:'no-store'})]);
  if(rd.status===401){location.href='/';return;}
  DATA=rd.ok?await rd.json():{activities:[],current:{},recent:[]};
  VER=rv.ok?await rv.json():{migrated:false,claims:[],counts:{}};
  document.getElementById('sub').textContent=(DATA.meta&&DATA.meta.project_name)||'the job you run';
  renderKpis(); renderSignoff(); renderProgramme(); renderFeed(); loadOut();
}

function renderKpis(){
  var acts=DATA.activities||[];
  var inprog=0,notst=0,risk=0,w=0,e=0;
  acts.forEach(function(a){var s=statusOf(a);var wt=a.weight||1;w+=wt;e+=s.pct*wt;if(s.risk)risk++;else if(s.pct>=100){}else if(s.pct>0)inprog++;else notst++;});
  var overall=w?e/w:0;
  var awaiting=(VER.counts&&VER.counts.awaiting_complete)||0;
  var kp=[['bad',String(awaiting),'To sign off'],
          ['act',String(inprog),'In progress'],
          ['',String(notst),'Not started'],
          ['warn',String(risk),'At risk / delayed'],
          ['warn','—','Drawings to approve','dwgApprove'],
          ['',one(overall)+'%','Complete']];
  document.getElementById('kpis').innerHTML=kp.map(function(k){return '<div class="kpi '+k[0]+'"'+(k[3]?' id="'+k[3]+'"':'')+'><div class="v">'+k[1]+'</div><div class="l">'+k[2]+'</div></div>';}).join('');
}

function renderSignoff(){
  var box=document.getElementById('signoff');
  if(!VER.migrated){box.innerHTML='<div class="empty">Sign-off is not switched on for this project yet.</div>';document.getElementById('soN').textContent='';return;}
  var claims=(VER.claims||[]).filter(function(c){return (c.pct||0)>=100;});
  document.getElementById('soN').textContent=claims.length?String(claims.length):'';
  if(!claims.length){box.innerHTML='<div class="empty">Nothing waiting — you are all caught up on sign-offs.</div>';return;}
  box.innerHTML='<table><tr><th>Ref</th><th>Activity</th><th>Section</th><th>Floor</th><th>Reported</th><th></th></tr>'+
    claims.map(function(c){return '<tr data-a="'+esc(c.id)+'"><td class="ref">'+esc(c.wbs||c.id)+'</td><td>'+esc(c.name)+'</td><td>'+esc(c.trade_group||c.trade||'—')+'</td><td>'+esc(c.floor||'—')+'</td><td class="ref">'+fmt(c.report_date)+'</td>'+
      '<td><div class="btnrow"><button class="b prim" data-sign="'+esc(c.id)+'">Sign off</button><button class="b warn" data-query="'+esc(c.id)+'">Query</button></div></td></tr>';}).join('')+'</table>';
  box.querySelectorAll('[data-sign]').forEach(function(el){el.addEventListener('click',function(){verify(el.dataset.sign,'verified');});});
  box.querySelectorAll('[data-query]').forEach(function(el){el.addEventListener('click',function(){var note=prompt('What is wrong with it? (the site engineer sees this)');if(note&&note.trim())verify(el.dataset.query,'queried',note.trim());});});
}

async function verify(aid,status,note){
  var body={activity_id:aid,status:status};
  if(note)body.note=note;
  var r=await fetch('/api/verify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  var d=await r.json().catch(function(){return {};});
  if(!r.ok||d.error){toast(d.error||'Could not save');return;}
  toast(status==='verified'?'Signed off':'Queried back to site');
  var rv=await fetch('/api/verify',{cache:'no-store'});VER=rv.ok?await rv.json():VER;
  renderKpis();renderSignoff();
}

function renderProgramme(){
  var box=document.getElementById('programme');
  var acts=(DATA.activities||[]).map(function(a){return {a:a,s:statusOf(a)};})
    .filter(function(x){return x.s.pct<100;})
    .sort(function(x,y){return (y.s.risk?1:0)-(x.s.risk?1:0) || (y.s.pct-x.s.pct);});
  if(DATA.meta) document.getElementById('progAsOf').textContent='as at '+fmt(DATA.generated_at);
  if(!acts.length){box.innerHTML='<div class="empty">No open activities — everything on the programme is complete or none is loaded.</div>';return;}
  box.innerHTML='<table><tr><th>Ref</th><th>Activity</th><th>Section</th><th>Floor</th><th>Progress</th><th>Status</th></tr>'+
    acts.slice(0,60).map(function(x){var a=x.a,s=x.s;return '<tr><td class="ref">'+esc(a.wbs||a.id)+'</td><td>'+esc(a.name)+'</td><td>'+esc(sec(a))+'</td><td>'+esc(a.floor||a.level||'—')+'</td>'+
      '<td><span class="mbar"><i style="width:'+Math.max(0,Math.min(100,s.pct))+'%"></i></span> '+r0(s.pct)+'%</td><td><span class="pill '+s.cls+'">'+s.txt+'</span></td></tr>';}).join('')+'</table>'+
    (acts.length>60?'<div class="mini">Showing the 60 most pressing of '+acts.length+' open activities.</div>':'');
}

function renderFeed(){
  var box=document.getElementById('feed');
  var rec=(DATA.recent||[]).slice(0,10);
  if(!rec.length){box.innerHTML='<div class="empty">No site updates yet.</div>';return;}
  var byId={}; (DATA.activities||[]).forEach(function(a){byId[a.id]=a;});
  box.innerHTML=rec.map(function(u){var a=byId[u.activity_id]||{};var pct=u.pct||0;var dot=pct>=100?'g':(String(u.status||'').match(/delay|risk|hold/)?'r':'a');
    return '<div class="it"><span class="dot '+dot+'"></span><span>'+esc(a.name||u.activity_id||'Activity')+' → '+r0(pct)+'%'+(u.submitted_by?' <span class="ref">('+esc(u.submitted_by)+')</span>':'')+'</span><span class="w">'+ago(u.created_at||u.report_date)+'</span></div>';}).join('');
}

async function loadOut(){
  var box=document.getElementById('out');
  var pending=[], rfis=[];
  try{var rd=await fetch('/api/drawings',{cache:'no-store'});if(rd.ok){var d=await rd.json();(d.drawings||[]).forEach(function(x){if(x.status==='pending')pending.push(x);});}}catch(e){}
  try{var ri=await fetch('/api/issues?open=1',{cache:'no-store'});if(ri.ok){var di=await ri.json();(di.issues||[]).forEach(function(x){if(x.status==='issued')rfis.push(x);});}}catch(e){}
  document.getElementById('outN').textContent=(pending.length+rfis.length)?String(pending.length+rfis.length):'';
  if(document.getElementById('dwgApprove')) document.getElementById('dwgApprove').querySelector('.v').textContent=String(pending.length);
  var html='';
  if(pending.length){html+='<table><tr><th>Drawing</th><th>Rev</th><th>Kind</th><th></th></tr>'+
    pending.slice(0,12).map(function(x){return '<tr><td>'+esc(x.number||x.title||'—')+'<div class="ref">'+esc(x.title||'')+'</div></td><td>'+esc(x.revision||'—')+'</td><td><span class="pill warn">to approve</span></td><td><a class="b" href="/drawings">Review</a></td></tr>';}).join('')+'</table>';}
  if(rfis.length){html+='<div class="mini" style="margin:12px 0 6px;color:var(--ink-2)"><b>Out with the consultant — awaiting reply</b></div><table><tr><th>Ref</th><th>Subject</th><th>Age</th></tr>'+
    rfis.slice(0,12).map(function(x){return '<tr><td class="ref">'+esc(x.ref||x.type||'—')+'</td><td>'+esc(x.subject||x.title||'—')+'</td><td class="'+(x.overdue?'':'')+'">'+(x.overdue?'<span class="pill late">overdue</span>':(x.age!=null?x.age+'d':'—'))+'</td></tr>';}).join('')+'</table>';}
  box.innerHTML=html||'<div class="empty">Nothing to approve, and nothing waiting on the consultant.</div>';
}

document.getElementById('themeBtn').addEventListener('click',function(){var cur=document.documentElement.getAttribute('data-theme');var next=cur==='dark'?'light':cur==='light'?'':'dark';if(next)document.documentElement.setAttribute('data-theme',next);else document.documentElement.removeAttribute('data-theme');try{localStorage.setItem('sm-theme',JSON.stringify(next));}catch(e){}});
try{var sv=localStorage.getItem('sm-theme');if(sv)document.documentElement.setAttribute('data-theme',JSON.parse(sv));}catch(e){}
loadAll();
${PWA_BOOT}
</script>
</body>
</html>`;
