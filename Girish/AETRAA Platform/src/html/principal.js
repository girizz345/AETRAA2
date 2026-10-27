import { THEME_CSS } from './theme.js';
import { HEAD_LINKS, PWA_BOOT, BRAND_CSS, BRAND_MARK, SWITCHER_CSS } from './shared.js';

// The Principal (owner) master dashboard.
//
// One screen that opens on the whole portfolio and lets the Principal drill in:
//   portfolio  ->  a project's overview  ->  a discipline section  ->  an activity.
// Every number is real, pulled from /api/portfolio and, on drill-in, /api/data.
// Nothing here is day-to-day work; it is the owner's line of sight and the
// decisions that have climbed to him.

export const principalHTML = () => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Principal · AETRAA</title>
${HEAD_LINKS}
<style>${THEME_CSS}${BRAND_CSS}${SWITCHER_CSS}
.wrap { max-width: 1280px; }
.bar { background: var(--surface); border: 1px solid var(--border); border-left: 3px solid var(--series-1);
       border-radius: 10px; padding: 12px 16px; margin: 0 0 16px; font-size: 13.5px; color: var(--ink-2); line-height: 1.5; }
.bar b { color: var(--ink); }
.kpis { display: grid; gap: 12px; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); margin: 0 0 18px; }
.kpi { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 14px 16px; box-shadow: var(--shadow); }
.kpi .v { font-size: 26px; font-weight: 600; letter-spacing: -0.02em; line-height: 1.1; }
.kpi .l { font-size: 12px; color: var(--muted); margin-top: 3px; }
.kpi.act .v { color: var(--series-1); }
.kpi.bad .v { color: var(--critical); }
.kpi.warn .v { color: var(--serious); }
.kpi.good .v { color: var(--good-text); }
.cols { display: grid; gap: 16px; grid-template-columns: 1.6fr 1fr; align-items: start; }
@media (max-width: 900px) { .cols { grid-template-columns: 1fr; } }
.card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 16px 18px;
        box-shadow: var(--shadow); margin: 0 0 16px; }
.card h2 { font-size: 15px; display: flex; justify-content: space-between; align-items: baseline; margin: 0 0 12px; }
.card h2 .r { font-size: 12px; color: var(--muted); font-weight: 400; }
.pf { display: grid; gap: 12px; }
.pcard { display: block; text-decoration: none; color: inherit; cursor: pointer;
         background: var(--surface-2); border: 1px solid var(--border); border-radius: 10px;
         padding: 14px 16px; border-left: 3px solid var(--series-1); }
.pcard:hover { background: var(--grid); }
.pcard.risk { border-left-color: var(--critical); }
.pcard.warn { border-left-color: var(--serious); }
.pcard.quiet { border-left-color: var(--muted); opacity: .7; }
.pcard h3 { font-size: 15px; line-height: 1.3; margin: 0; }
.pcard .ref { font-size: 12px; color: var(--muted); margin-top: 1px; }
.meter { height: 8px; border-radius: 4px; background: var(--grid); overflow: hidden; margin: 12px 0 6px; }
.meter i { display: block; height: 100%; border-radius: 4px; background: var(--series-1); }
.meter i.gold { background: var(--gold, var(--serious)); }
.meter i.good { background: var(--good-text); }
.pctline { display: flex; justify-content: space-between; align-items: baseline; font-size: 12px; color: var(--ink-2); font-variant-numeric: tabular-nums; }
.pctline b { font-size: 18px; color: var(--ink); font-weight: 600; }
.tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
.tag { font-size: 11px; padding: 2px 8px; border-radius: 999px; background: var(--grid); color: var(--ink-2); }
.tag.r { background: color-mix(in srgb, var(--critical) 16%, transparent); color: var(--critical); }
.tag.a { background: color-mix(in srgb, var(--serious) 18%, transparent); color: var(--serious); }
.tag.g { background: color-mix(in srgb, var(--good-text) 16%, transparent); color: var(--good-text); }
.bars { display: grid; gap: 10px; }
.brow { font-size: 12.5px; }
.brow .lab { display: flex; justify-content: space-between; margin-bottom: 3px; }
.brow .lab span:last-child { font-variant-numeric: tabular-nums; font-weight: 600; }
.attn { display: grid; gap: 8px; }
.attn a { display: block; text-decoration: none; color: inherit; cursor: pointer;
          border: 1px solid var(--border); border-left: 3px solid var(--serious); border-radius: 8px; padding: 10px 12px; background: var(--surface-2); }
.attn a:hover { background: var(--grid); }
.attn a.r { border-left-color: var(--critical); }
.attn .t { font-size: 13.5px; font-weight: 500; }
.attn .s { font-size: 12px; color: var(--muted); margin-top: 2px; }
.empty { color: var(--muted); font-size: 13px; padding: 6px 0; }
.crumbs { display: flex; align-items: center; gap: 8px; font-size: 13px; margin: 0 0 14px; flex-wrap: wrap; }
.crumbs a { color: var(--series-1); cursor: pointer; text-decoration: none; }
.crumbs a:hover { text-decoration: underline; }
.crumbs .sep { color: var(--muted); }
.crumbs b { color: var(--ink); }
table { width: 100%; border-collapse: collapse; font-size: 13px; }
th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; color: var(--muted); font-weight: 600; padding: 6px 8px; border-bottom: 1px solid var(--border); }
td { padding: 8px; border-bottom: 1px solid var(--grid); vertical-align: middle; }
tr.click { cursor: pointer; }
tr.click:hover td { background: var(--surface-2); }
.ref { font-size: 11.5px; color: var(--muted); font-variant-numeric: tabular-nums; }
.pill { font-size: 11px; padding: 2px 9px; border-radius: 999px; display: inline-block; background: var(--grid); color: var(--ink-2); white-space: nowrap; }
.pill.late { background: color-mix(in srgb, var(--critical) 16%, transparent); color: var(--critical); }
.pill.warn { background: color-mix(in srgb, var(--serious) 18%, transparent); color: var(--serious); }
.pill.wp { background: color-mix(in srgb, var(--series-1) 16%, transparent); color: var(--series-1); }
.pill.done { background: color-mix(in srgb, var(--good-text) 16%, transparent); color: var(--good-text); }
.mini { font-size: 12px; color: var(--muted); margin-top: 10px; line-height: 1.5; }
.mbar { height: 6px; width: 90px; border-radius: 3px; background: var(--grid); overflow: hidden; display: inline-block; vertical-align: middle; }
.mbar i { display: block; height: 100%; background: var(--series-1); }
.hide { display: none !important; }
.loading { color: var(--muted); padding: 30px; text-align: center; }
</style>
</head>
<body>
<div class="topbar"><div class="topbar-in">
  ${BRAND_MARK}
  <div class="brand"><h1>Principal</h1><div class="sub" id="sub">every project you are running</div></div>
  <div class="spacer"></div>
  <button class="btn" id="themeBtn" title="Light / dark">◐</button>
  <a class="btn" href="/people">People</a>
  <a class="btn" href="/admin">Admin</a>
  <a class="btn" href="/api/logout">Sign out</a>
</div></div>

<div class="wrap">
  <!-- PORTFOLIO VIEW -->
  <div id="portfolio">
    <div class="bar">Signed in as <b>Principal</b> — every project, every discipline, and every decision that has climbed to you. Nothing here needs day-to-day work; it needs a decision or an eye.</div>
    <div class="kpis" id="kpis"><div class="loading">Loading your portfolio…</div></div>
    <div class="cols">
      <div>
        <div class="card"><h2>Projects <span class="r">click any to drill in</span></h2><div class="pf" id="pf"><div class="empty">Loading…</div></div></div>
        <div class="card"><h2>Consolidated progress <span class="r">weighted % complete</span></h2><div class="bars" id="bars"><div class="empty">Loading…</div></div></div>
      </div>
      <div>
        <div class="card"><h2>Needs your attention <span class="r" id="attnN"></span></h2><div class="attn" id="attn"><div class="empty">Loading…</div></div>
          <div class="mini">Projects carrying flagged activities or a missed target date. Open one to see exactly what and where.</div></div>
      </div>
    </div>
  </div>

  <!-- DRILL-DOWN VIEW -->
  <div id="drill" class="hide">
    <div class="crumbs" id="crumbs"></div>
    <div id="drillBody"><div class="loading">Loading…</div></div>
  </div>
</div>

<div class="toast" id="toast"></div>

<script>
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function one(n){return (Math.round((n||0)*10)/10).toFixed(1);}
function r0(n){return Math.round(n||0);}
function fmt(s){if(!s)return '—';var d=new Date(String(s).slice(0,10)+'T00:00:00Z');if(isNaN(d))return '—';var m=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];return String(d.getUTCDate()).padStart(2,'0')+' '+m[d.getUTCMonth()]+' '+String(d.getUTCFullYear()).slice(2);}
function ago(ts){if(!ts)return 'never';var mins=Math.floor((Date.now()-Date.parse(ts))/60000);if(!isFinite(mins))return 'never';if(mins<1)return 'just now';if(mins<60)return mins+' min ago';var h=Math.floor(mins/60);if(h<24)return h+(h===1?' hour ago':' hours ago');var d=Math.floor(h/24);return d+(d===1?' day ago':' days ago');}

var PORT=null;            // portfolio payload
var PROJ={};              // pid -> project (from portfolio)

async function loadPortfolio(){
  var r=await fetch('/api/portfolio',{cache:'no-store'});
  if(r.status===401){location.href='/';return;}
  PORT=await r.json();
  var live=PORT.projects.filter(function(p){return !p.archived;});
  PORT.projects.forEach(function(p){PROJ[p.id]=p;});
  document.getElementById('sub').textContent=live.length+(live.length===1?' project':' projects')+(PORT.projects.length>live.length?' · '+(PORT.projects.length-live.length)+' archived':'');

  if(!PORT.projects.length){
    document.getElementById('kpis').innerHTML='';
    document.getElementById('pf').innerHTML='<div class="empty">No projects yet. Create one on the Admin page and load its programme.</div>';
    document.getElementById('bars').innerHTML='<div class="empty">—</div>';
    document.getElementById('attn').innerHTML='<div class="empty">—</div>';
    return;
  }

  // KPIs (real, weighted)
  var totalW=0, earned=0, flagged=0, missed=0;
  live.forEach(function(p){var s=p.stats;var w=s.activities||1;totalW+=w;earned+=(s.pct||0)*w;flagged+=s.flagged||0;missed+=s.target_missed||0;});
  var portfolioPct=totalW?earned/totalW:0;
  var kp=[['act',String(live.length),live.length===1?'Live project':'Live projects'],
          ['',one(portfolioPct)+'%','Portfolio complete'],
          [flagged?'bad':'good',String(flagged),'Flagged activities'],
          [missed?'bad':'good',String(missed),'Missed target dates']];
  document.getElementById('kpis').innerHTML=kp.map(function(k){return '<div class="kpi '+k[0]+'"><div class="v">'+k[1]+'</div><div class="l">'+k[2]+'</div></div>';}).join('');

  // Project cards
  document.getElementById('pf').innerHTML=PORT.projects.map(function(p){
    var s=p.stats; var pct=s.pct||0;
    var stale=s.last_update?(Date.now()-Date.parse(s.last_update))>3*86400000:true;
    var cls=p.archived?'quiet':(s.target_missed>0?'risk':((s.flagged>0||stale)?'warn':''));
    var tags=[];
    if(s.flagged>0) tags.push(['r',s.flagged+' flagged']);
    if(s.target_missed>0) tags.push(['r',s.target_missed+' missed']);
    if(!tags.length && !p.archived) tags.push(['g','on track']);
    tags.push(['a','ends '+fmt(s.last_finish||p.contract_completion)]);
    tags.push(['', (s.site_updates||0)+' site updates']);
    return '<div class="pcard '+cls+'" data-p="'+esc(p.id)+'">'+
      '<h3>'+esc(p.name)+(p.archived?' <span class="ref">(archived)</span>':'')+'</h3>'+
      '<div class="ref">'+esc(p.ref||'')+'</div>'+
      '<div class="meter"><i style="width:'+Math.max(0,Math.min(100,pct))+'%"></i></div>'+
      '<div class="pctline"><span><b>'+one(pct)+'%</b> complete</span><span>'+r0(s.complete)+' of '+r0(s.activities)+' activities · updated '+ago(s.last_update)+'</span></div>'+
      '<div class="tags">'+tags.map(function(t){return '<span class="tag '+t[0]+'">'+esc(t[1])+'</span>';}).join('')+'</div>'+
    '</div>';
  }).join('');
  document.querySelectorAll('#pf .pcard').forEach(function(el){el.addEventListener('click',function(){openProject(el.dataset.p);});});

  // Consolidated bars
  document.getElementById('bars').innerHTML='<div class="brow"><div class="lab"><span><b>Portfolio</b></span><span>'+one(portfolioPct)+'%</span></div><div class="meter"><i class="gold" style="width:'+Math.max(0,Math.min(100,portfolioPct))+'%"></i></div></div>'+
    live.map(function(p){var pct=p.stats.pct||0;return '<div class="brow"><div class="lab"><span>'+esc(p.name)+'</span><span>'+one(pct)+'%</span></div><div class="meter"><i style="width:'+Math.max(0,Math.min(100,pct))+'%"></i></div></div>';}).join('');

  // Needs attention
  var attn=live.filter(function(p){return (p.stats.flagged>0)||(p.stats.target_missed>0);})
    .sort(function(a,b){return (b.stats.target_missed-a.stats.target_missed)||(b.stats.flagged-a.stats.flagged);});
  document.getElementById('attnN').textContent=attn.length?String(attn.length):'';
  document.getElementById('attn').innerHTML=attn.length?attn.map(function(p){
    var s=p.stats; var parts=[];
    if(s.target_missed>0) parts.push(s.target_missed+' missed target'+(s.target_missed>1?'s':''));
    if(s.flagged>0) parts.push(s.flagged+' flagged activit'+(s.flagged>1?'ies':'y'));
    return '<a class="'+(s.target_missed>0?'r':'')+'" data-p="'+esc(p.id)+'"><div class="t">'+esc(p.name)+'</div><div class="s">'+parts.join(' · ')+' — open to see where</div></a>';
  }).join(''):'<div class="empty">Nothing is flagged across your projects right now.</div>';
  document.querySelectorAll('#attn a').forEach(function(el){el.addEventListener('click',function(){openProject(el.dataset.p);});});
}

// ---- drill-down --------------------------------------------------------
function show(view){document.getElementById('portfolio').classList.toggle('hide',view!=='portfolio');document.getElementById('drill').classList.toggle('hide',view!=='drill');window.scrollTo(0,0);}
function backToPortfolio(){show('portfolio');}

var DATA=null;    // /api/data for the open project
var CURPID=null;

function statusOf(a){
  var c=(DATA.current||{})[a.id]||{};
  var pct=c.pct||0; var st=(c.status||'').toLowerCase();
  if(st==='delayed'||st==='at_risk'||st==='on_hold') return {pct:pct,cls:'late',txt:st==='on_hold'?'On hold':(st==='delayed'?'Delayed':'At risk')};
  if(pct>=100) return {pct:100,cls:'done',txt:'Complete'};
  if(pct>0) return {pct:pct,cls:'wp',txt:'In progress'};
  return {pct:0,cls:'warn',txt:'Not started'};
}
function sectionKey(a){return a.trade_group||a.discipline||a.trade||'Other';}

async function openProject(pid){
  CURPID=pid; DATA=null; show('drill');
  document.getElementById('crumbs').innerHTML='<a id="cbHome">Portfolio</a><span class="sep">›</span><b>'+esc((PROJ[pid]||{}).name||'Project')+'</b>';
  document.getElementById('cbHome').addEventListener('click',backToPortfolio);
  document.getElementById('drillBody').innerHTML='<div class="loading">Opening '+esc((PROJ[pid]||{}).name||'project')+'…</div>';
  // switch the session to this project, then load its full data
  await fetch('/api/project?p='+encodeURIComponent(pid),{cache:'no-store'});
  var r=await fetch('/api/data',{cache:'no-store'});
  if(!r.ok){document.getElementById('drillBody').innerHTML='<div class="empty">Could not load this project\\'s data.</div>';return;}
  DATA=await r.json();
  renderOverview();
}

function renderOverview(){
  var acts=DATA.activities||[];
  var p=PROJ[CURPID]||{}; var s=p.stats||{};
  // group by section
  var groups={};
  acts.forEach(function(a){var k=sectionKey(a);(groups[k]=groups[k]||[]).push(a);});
  var keys=Object.keys(groups).sort();
  var overall=(function(){var w=0,e=0;acts.forEach(function(a){var wt=a.weight||1;w+=wt;e+=(statusOf(a).pct)*wt;});return w?e/w:0;})();

  var kp=[['act',one(overall)+'%','Actual complete'],
          ['',String(acts.length),'Activities'],
          ['bad',String(acts.filter(function(a){return statusOf(a).cls==='late';}).length),'Flagged / at risk'],
          ['',fmt(s.last_finish||p.contract_completion),'Programme ends']];

  var secHtml=keys.map(function(k){
    var arr=groups[k];
    var w=0,e=0,flag=0,done=0;
    arr.forEach(function(a){var st=statusOf(a);var wt=a.weight||1;w+=wt;e+=st.pct*wt;if(st.cls==='late')flag++;if(st.pct>=100)done++;});
    var pct=w?e/w:0;
    return '<tr class="click" data-sec="'+esc(k)+'"><td><b>'+esc(k)+'</b></td>'+
      '<td>'+arr.length+'</td>'+
      '<td>'+done+'</td>'+
      '<td class="'+(flag?'':'')+'">'+(flag?'<span class="pill late">'+flag+' flagged</span>':'<span class="ref">none</span>')+'</td>'+
      '<td><span class="mbar"><i style="width:'+Math.max(0,Math.min(100,pct))+'%"></i></span> '+one(pct)+'%</td>'+
      '<td class="ref">open ›</td></tr>';
  }).join('');

  var flaggedActs=acts.filter(function(a){return statusOf(a).cls==='late';}).slice(0,40);
  var flagHtml=flaggedActs.length?('<table><tr><th>Ref</th><th>Activity</th><th>Section</th><th>Floor</th><th>%</th><th>Status</th></tr>'+
    flaggedActs.map(function(a){var st=statusOf(a);return '<tr class="click" data-act="'+esc(a.id)+'"><td class="ref">'+esc(a.wbs||a.id)+'</td><td>'+esc(a.name)+'</td><td>'+esc(sectionKey(a))+'</td><td>'+esc(a.floor||a.level||'—')+'</td><td>'+r0(st.pct)+'</td><td><span class="pill '+st.cls+'">'+st.txt+'</span></td></tr>';}).join('')+'</table>'):'<div class="empty">Nothing flagged on this project.</div>';

  document.getElementById('drillBody').innerHTML=
    '<div class="kpis">'+kp.map(function(k){return '<div class="kpi '+k[0]+'"><div class="v">'+k[1]+'</div><div class="l">'+k[2]+'</div></div>';}).join('')+'</div>'+
    '<div class="cols"><div>'+
      '<div class="card"><h2>Overview by discipline <span class="r">click a section to open it</span></h2>'+
        (keys.length?'<table><tr><th>Section</th><th>Activities</th><th>Done</th><th>Flags</th><th>Progress</th><th></th></tr>'+secHtml+'</table>':'<div class="empty">No programme loaded for this project yet.</div>')+
        '<div class="mini">Weighted from the activities the site engineers update. Open a section for its activities, then an activity for its history and photos.</div></div>'+
    '</div><div>'+
      '<div class="card"><h2>Flagged &amp; at-risk <span class="r">'+flaggedActs.length+'</span></h2>'+flagHtml+
        '<div class="mini">Every activity a site engineer marked delayed, at risk or on hold — across all disciplines on this project.</div></div>'+
    '</div></div>';

  document.querySelectorAll('#drillBody tr[data-sec]').forEach(function(el){el.addEventListener('click',function(){renderSection(el.dataset.sec);});});
  document.querySelectorAll('#drillBody tr[data-act]').forEach(function(el){el.addEventListener('click',function(){renderActivity(el.dataset.act);});});
}

function renderSection(sec){
  var p=PROJ[CURPID]||{};
  var arr=(DATA.activities||[]).filter(function(a){return sectionKey(a)===sec;});
  document.getElementById('crumbs').innerHTML='<a id="cbHome">Portfolio</a><span class="sep">›</span><a id="cbProj">'+esc(p.name||'Project')+'</a><span class="sep">›</span><b>'+esc(sec)+'</b>';
  document.getElementById('cbHome').addEventListener('click',backToPortfolio);
  document.getElementById('cbProj').addEventListener('click',renderOverview);
  var rows=arr.map(function(a){var st=statusOf(a);
    return '<tr class="click" data-act="'+esc(a.id)+'"><td class="ref">'+esc(a.wbs||a.id)+'</td><td>'+esc(a.name)+'</td><td>'+esc(a.floor||a.level||'—')+'</td>'+
      '<td><span class="mbar"><i style="width:'+Math.max(0,Math.min(100,st.pct))+'%"></i></span> '+r0(st.pct)+'%</td>'+
      '<td><span class="pill '+st.cls+'">'+st.txt+'</span></td>'+
      '<td class="ref">'+fmt(a.planned_finish)+'</td></tr>';
  }).join('');
  document.getElementById('drillBody').innerHTML='<div class="card"><h2>'+esc(sec)+' — activities <span class="r">'+arr.length+'</span></h2>'+
    (arr.length?'<table><tr><th>Ref</th><th>Activity</th><th>Floor</th><th>Progress</th><th>Status</th><th>Planned finish</th></tr>'+rows+'</table>':'<div class="empty">No activities in this section.</div>')+
    '<div class="mini">Click an activity for its update history and site photographs.</div></div>';
  document.querySelectorAll('#drillBody tr[data-act]').forEach(function(el){el.addEventListener('click',function(){renderActivity(el.dataset.act);});});
  window.scrollTo(0,0);
}

function renderActivity(aid){
  var p=PROJ[CURPID]||{};
  var a=(DATA.activities||[]).find(function(x){return String(x.id)===String(aid);});
  if(!a){renderOverview();return;}
  var sec=sectionKey(a); var st=statusOf(a);
  var hist=(DATA.history||[]).filter(function(h){return String(h.activity_id)===String(aid);});
  var pics=(DATA.photos||[]).filter(function(ph){return String(ph.activity_id)===String(aid);});
  document.getElementById('crumbs').innerHTML='<a id="cbHome">Portfolio</a><span class="sep">›</span><a id="cbProj">'+esc(p.name||'Project')+'</a><span class="sep">›</span><a id="cbSec">'+esc(sec)+'</a><span class="sep">›</span><b>'+esc(a.name)+'</b>';
  document.getElementById('cbHome').addEventListener('click',backToPortfolio);
  document.getElementById('cbProj').addEventListener('click',renderOverview);
  document.getElementById('cbSec').addEventListener('click',function(){renderSection(sec);});

  var facts=[['Reference',esc(a.wbs||a.id)],['Section',esc(sec)],['Floor / level',esc(a.floor||a.level||'—')],
             ['Responsible',esc(a.responsible||'—')],['Planned start',fmt(a.planned_start)],['Planned finish',fmt(a.planned_finish)],
             ['Progress',r0(st.pct)+'%'],['Status','<span class="pill '+st.cls+'">'+st.txt+'</span>']];
  var histHtml=hist.length?('<table><tr><th>Date</th><th>%</th><th>Note</th><th>By</th></tr>'+hist.slice().reverse().map(function(h){return '<tr><td>'+fmt(h.report_date)+'</td><td>'+r0(h.pct)+'</td><td>'+esc(h.note||h.comment||'—')+'</td><td class="ref">'+esc(h.submitted_by||h.source||'—')+'</td></tr>';}).join('')+'</table>'):'<div class="empty">No update history recorded yet.</div>';
  var picHtml=pics.length?('<div class="tags" style="margin-top:10px">'+pics.slice(0,12).map(function(ph){return '<span class="tag">📷 '+esc(ph.caption||fmt(ph.report_date))+'</span>';}).join('')+'</div>'):'<div class="empty">No photographs attached.</div>';

  document.getElementById('drillBody').innerHTML='<div class="cols"><div>'+
    '<div class="card"><h2>'+esc(a.name)+'</h2><table>'+facts.map(function(f){return '<tr><td style="color:var(--muted);width:40%">'+f[0]+'</td><td>'+f[1]+'</td></tr>';}).join('')+'</table></div>'+
    '<div class="card"><h2>Update history <span class="r">'+hist.length+'</span></h2>'+histHtml+'</div>'+
    '</div><div>'+
    '<div class="card"><h2>Site photographs <span class="r">'+pics.length+'</span></h2>'+picHtml+
      '<div class="mini">Photographs the site engineer attached when reporting progress and on completion.</div></div>'+
    '</div></div>';
  window.scrollTo(0,0);
}

// theme + boot
document.getElementById('themeBtn').addEventListener('click',function(){var cur=document.documentElement.getAttribute('data-theme');var next=cur==='dark'?'light':cur==='light'?'':'dark';if(next)document.documentElement.setAttribute('data-theme',next);else document.documentElement.removeAttribute('data-theme');try{localStorage.setItem('sm-theme',JSON.stringify(next));}catch(e){}});
try{var sv=localStorage.getItem('sm-theme');if(sv)document.documentElement.setAttribute('data-theme',JSON.parse(sv));}catch(e){}
loadPortfolio();
${PWA_BOOT}
</script>
</body>
</html>`;
