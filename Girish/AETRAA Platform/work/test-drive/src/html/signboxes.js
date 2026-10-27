// THE SIGNATURE-BOX PICKER, shared by the Setup console and the Documents tab.
//
// A consultant's form is drawn as it is (src/template-preview.js) and each
// workflow step is given the cell its signature goes in, by clicking it. The
// boxes were already read when the form was uploaded; this confirms or moves
// them. Calls window.onSignBoxesSaved(label) after a save.
export const SIGNBOX_JS = String.raw`function sbEsc(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }

// ---- where each signature goes on a consultant's form ----
// The form is drawn as it is; each workflow step is given the cell its
// signature goes in, by clicking the cell. Read once when the form was
// uploaded (every NAME & SIGN box found), confirmed here.
var SB=null;
function openSignBoxes(pid, type, label){
  var ov=document.getElementById('sbOverlay');
  if(!ov){
    ov=document.createElement('div'); ov.id='sbOverlay';
    ov.style.cssText='position:fixed;inset:0;background:var(--scrim);z-index:99;display:flex;align-items:flex-start;justify-content:center;overflow:auto;padding:24px';
    document.body.appendChild(ov);
  }
  ov.hidden=false; ov.style.display='flex';
  ov.innerHTML='<div style="background:var(--surface);border-radius:12px;max-width:1300px;width:100%;padding:16px 18px">Loading the form...</div>';
  fetch('/api/template/form?project='+encodeURIComponent(pid)+'&p='+encodeURIComponent(pid)+'&type='+encodeURIComponent(type)+'&pick=1',{cache:'no-store'})
    .then(function(r){return r.json();}).then(function(d){
      if(!d.has){ ov.innerHTML='<div style="background:var(--surface);border-radius:12px;padding:18px">No template for that document.</div>'; return; }
      SB={pid:pid,type:type,steps:Object.assign({},(d.sign_map&&d.sign_map.steps)||{}),list:d.steps||[],picking:null,sug:(d.sign_map&&d.sign_map.suggested)||[],ai:(d.sign_map&&d.sign_map.ai)||[]};
      if(!document.getElementById('sbCss')){ var st=document.createElement('style'); st.id='sbCss'; st.textContent=d.css||''; document.head.appendChild(st); }
      ov.innerHTML='<div style="background:var(--surface);border-radius:12px;max-width:1340px;width:100%;padding:16px 18px">'+
        '<div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap"><h2 style="margin:0;font-size:var(--fs-body)">Signature boxes — '+sbEsc(label)+'</h2>'+
        '<span class="hint">'+sbEsc(d.filename||'')+'</span><span style="flex:1"></span>'+
        '<button class="btn prim" id="sbSave">Save</button><button class="btn" id="sbClose">Close</button></div>'+
        '<div id="sbErr" style="color:var(--bad-ink);font-size:var(--fs-secondary)"></div><div class="hint" style="margin:6px 0 12px">Press <b>Choose</b> beside a step, then click the cell on the form where that person signs. '+
        (SB.sug.length?'The form has '+SB.sug.length+' signature boxes (outlined).':'No NAME &amp; SIGN boxes were found; choose any cell.')+
        (SB.ai.length?' '+SB.ai.length+' more were proposed by AI and kept by Document Control (outlined in blue): '+SB.ai.map(function(a){ return sbEsc(a.label)+' '+sbEsc(a.cell); }).join(', ')+'.':'')+
        ' Steps left blank are not signed on this form.</div>'+
        '<div style="display:grid;grid-template-columns:300px 1fr;gap:14px;align-items:start">'+
        '<div id="sbSteps"></div><div class="tp-wrap" id="sbForm">'+(d.html||'')+'</div></div></div>';
      paintSB();
      document.getElementById('sbClose').onclick=function(){ ov.style.display='none'; };
      document.getElementById('sbSave').onclick=async function(){
        var r=await fetch((window.SIGNBOX_SAVE_URL||'/api/setup/template-signs')+'?p='+encodeURIComponent(SB.pid),{method:'POST',headers:{'Content-Type':'application/json'},
          body:JSON.stringify({project_id:SB.pid,doc_type:SB.type,steps:SB.steps})});
        var j=await r.json();
        if(j.ok){ ov.style.display='none'; if(window.onSignBoxesSaved) window.onSignBoxesSaved(label); }
        else { var e=document.getElementById('sbErr'); if(e){ e.textContent=j.error||'Could not save.'; } }
      };
      document.getElementById('sbForm').addEventListener('click',function(ev){
        var td=ev.target.closest('[data-cell]'); if(!td||SB.picking==null) return;
        SB.steps[SB.picking]=td.getAttribute('data-cell'); SB.picking=null; paintSB();
      });
    });
}
function paintSB(){
  var cellOf=function(i){ return SB.steps[i]||''; };
  document.getElementById('sbSteps').innerHTML=SB.list.map(function(s){
    var c=cellOf(s.i);
    return '<div style="border:1px solid var(--border);border-radius:8px;padding:8px 10px;margin-bottom:6px'+(SB.picking===s.i?';outline:2px solid var(--accent)':'')+'">'+
      '<div style="font-size:var(--fs-secondary)"><b>'+(s.i+1)+'. '+sbEsc(s.st)+'</b></div>'+
      '<div class="hint">'+(c?'Signs in cell <b>'+sbEsc(c)+'</b>':'Not signed on the form')+'</div>'+
      '<button class="btn" data-pick="'+s.i+'" style="margin-top:4px">'+(SB.picking===s.i?'Click a cell on the form':'Choose')+'</button> '+
      (c?'<button class="btn" data-clear="'+s.i+'">Clear</button>':'')+'</div>';
  }).join('');
  document.querySelectorAll('#sbSteps [data-pick]').forEach(function(b){ b.onclick=function(){ SB.picking=Number(b.dataset.pick); paintSB(); }; });
  document.querySelectorAll('#sbSteps [data-clear]').forEach(function(b){ b.onclick=function(){ delete SB.steps[b.dataset.clear]; paintSB(); }; });
  var form=document.getElementById('sbForm');
  form.querySelectorAll('td.tp-chosen').forEach(function(td){ td.classList.remove('tp-chosen'); td.title=''; if(td.dataset.orig!=null) td.innerHTML=td.dataset.orig; });
  SB.sug.forEach(function(ref){ var td=form.querySelector('[data-cell="'+ref+'"]'); if(td) td.style.boxShadow='inset 0 0 0 2px #c98a00'; });
  SB.ai.forEach(function(a){ var td=form.querySelector('[data-cell="'+a.cell+'"]'); if(td){ td.style.boxShadow='inset 0 0 0 2px #2f6fd6'; if(!td.title) td.title='Proposed by AI: '+a.label; } });
  Object.keys(SB.steps).forEach(function(i){
    var td=form.querySelector('[data-cell="'+SB.steps[i]+'"]');
    if(td){ if(td.dataset.orig==null) td.dataset.orig=td.innerHTML; td.classList.add('tp-chosen'); td.title='Step '+(Number(i)+1); td.innerHTML='<b>Step '+(Number(i)+1)+'</b> <small>'+sbEsc((SB.list[i]||{}).st||'')+'</small>'; }
  });
}
`;
