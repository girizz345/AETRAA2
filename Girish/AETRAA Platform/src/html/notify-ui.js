// "Notify the team" and the bell — shared by the app shell and the drawings page.
//
//   window.notifyTeam({ ref, title, message, kind })  opens the dialog
//   window.__NOTIFY__ = { can: true|false, auto: true|false }
//       can  — this person may notify (Document Control, PM, Principal)
//       auto — offer it by itself after an upload (Document Control)
//
// The bell (#bellN, if the page has one) shows the unread count and opens the
// list. Plain ES5 with no backticks, no "${" and no backslashes: it is embedded
// in template literals and in String.raw.
export const NOTIFY_UI = `
<style>
#ntfDlg{border:1px solid #d0d5dd;border-radius:14px;padding:0;width:min(560px,94vw);max-height:88vh;color:#1d2433;background:#fff;box-shadow:0 18px 60px rgba(0,0,0,.25)}
#ntfDlg::backdrop{background:rgba(15,20,35,.45)}
#ntfDlg .h{padding:16px 20px 8px;font:600 17px system-ui,Arial,sans-serif}
#ntfDlg .b{padding:4px 20px 12px;font:14px/1.45 system-ui,Arial,sans-serif;overflow:auto;max-height:60vh}
#ntfDlg label.t{display:block;font-size:12px;color:#667;margin:10px 0 4px}
#ntfDlg input[type=text],#ntfDlg textarea{width:100%;box-sizing:border-box;font:inherit;padding:8px 10px;border:1px solid #d0d5dd;border-radius:8px}
#ntfDlg textarea{min-height:70px}
#ntfDlg .chips{display:flex;flex-wrap:wrap;gap:6px;margin:4px 0 8px}
#ntfDlg .chip{border:1px solid #c9ced8;border-radius:999px;padding:4px 10px;font-size:12.5px;cursor:pointer;background:#f5f6f8}
#ntfDlg .chip.on{background:#1f4e8c;border-color:#1f4e8c;color:#fff}
#ntfDlg .ppl{border:1px solid #e3e6ec;border-radius:9px;max-height:190px;overflow:auto}
#ntfDlg .ppl label{display:flex;gap:9px;align-items:center;padding:7px 10px;border-bottom:1px solid #eef0f3;cursor:pointer}
#ntfDlg .ppl label span{color:#778;font-size:12px}
#ntfDlg .f{display:flex;gap:8px;justify-content:flex-end;align-items:center;padding:12px 20px 16px;border-top:1px solid #eef0f3}
#ntfDlg button{font:inherit;font-size:14px;padding:8px 14px;border-radius:9px;border:1px solid #c9ced8;background:#f5f6f8;cursor:pointer}
#ntfDlg button.p{background:#1f4e8c;border-color:#1f4e8c;color:#fff}
#ntfDlg .m{font-size:13px;margin-right:auto;color:#667}
#ntfList{position:fixed;top:64px;right:18px;width:min(380px,92vw);max-height:70vh;overflow:auto;background:#fff;color:#1d2433;border:1px solid #d0d5dd;border-radius:12px;box-shadow:0 14px 44px rgba(0,0,0,.22);z-index:9999;font:14px/1.4 system-ui,Arial,sans-serif;display:none}
#ntfList .hd{display:flex;justify-content:space-between;align-items:center;padding:12px 14px;border-bottom:1px solid #eef0f3;font-weight:600}
#ntfList .hd a{font-weight:400;font-size:12.5px;color:#1f4e8c;cursor:pointer}
#ntfList .it{padding:10px 14px;border-bottom:1px solid #f0f1f4}
#ntfList .it.un{background:#f2f6fc}
#ntfList .it b{display:block;font-size:13.5px}
#ntfList .it div{font-size:12.5px;color:#556;margin-top:2px;white-space:pre-wrap}
#ntfList .it span{font-size:11.5px;color:#889}
#ntfList .none{padding:18px 14px;color:#778}
</style>
<dialog id="ntfDlg"><div class="h">Notify the team</div><div class="b">
  <label class="t">Subject</label><input type="text" id="ntfTitle">
  <label class="t">Message (optional)</label><textarea id="ntfMsg"></textarea>
  <label class="t">Who — pick a group, or people</label>
  <div class="chips" id="ntfChips"></div>
  <div class="ppl" id="ntfPpl"><div style="padding:10px;color:#778">Loading the project team…</div></div>
  <label style="display:flex;gap:8px;align-items:center;margin-top:10px" id="ntfEmailRow"><input type="checkbox" id="ntfEmail" checked> Also send by email</label>
</div><div class="f"><span class="m" id="ntfSay"></span><button id="ntfSkip">Not now</button><button class="p" id="ntfSend">Send</button></div></dialog>
<div id="ntfList"></div>
<script>
(function(){
  var CFG = window.__NOTIFY__ || {};
  var TEAM = [], FNS = [], CTX = {};
  function el(id){ return document.getElementById(id); }
  function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function say(t){ var m = el('ntfSay'); if (m) m.textContent = t || ''; }

  function paint(){
    var used = {};
    TEAM.forEach(function(u){ (u.functions || []).forEach(function(f){ used[f] = 1; }); });
    var chips = '<span class="chip" data-all="1">Whole project team</span>' + FNS.filter(function(f){ return used[f.id]; })
      .map(function(f){ return '<span class="chip" data-fn="' + esc(f.id) + '">' + esc(f.label) + '</span>'; }).join('');
    el('ntfChips').innerHTML = chips;
    el('ntfPpl').innerHTML = TEAM.length ? TEAM.map(function(u){
      return '<label><input type="checkbox" value="' + esc(u.id) + '" data-fns="' + esc((u.functions || []).join(' ')) + '"> ' +
        esc(u.name) + ' <span>' + esc((u.labels || []).join(' + ')) + '</span></label>';
    }).join('') : '<div style="padding:10px;color:#778">Nobody else is on this project yet.</div>';
  }
  function boxes(){ return Array.prototype.slice.call(el('ntfPpl').querySelectorAll('input[type=checkbox]')); }

  window.notifyTeam = function(ctx){
    if (!CFG.can) return;
    CTX = ctx || {};
    var d = el('ntfDlg'); if (!d || !d.showModal) return;
    el('ntfTitle').value = CTX.title || 'New from Document Control';
    el('ntfMsg').value = CTX.message || '';
    say('');
    el('ntfSend').disabled = false;
    d.showModal();
    fetch('/api/notify/team', { cache: 'no-store' }).then(function(r){ return r.ok ? r.json() : null; }).then(function(j){
      if (!j) { el('ntfPpl').innerHTML = '<div style="padding:10px;color:#b42318">Could not load the team.</div>'; return; }
      TEAM = j.team || []; FNS = j.functions || [];
      el('ntfEmailRow').style.display = j.email ? '' : 'none';
      el('ntfEmail').checked = !!j.email;
      paint();
    }).catch(function(){});
  };

  document.addEventListener('click', function(ev){
    var c = ev.target.closest && ev.target.closest('#ntfChips .chip');
    if (c) {
      var on = !c.classList.contains('on'); c.classList.toggle('on', on);
      if (c.getAttribute('data-all')) boxes().forEach(function(b){ b.checked = on; });
      else { var fn = c.getAttribute('data-fn');
        boxes().forEach(function(b){ if ((' ' + b.getAttribute('data-fns') + ' ').indexOf(' ' + fn + ' ') >= 0) b.checked = on; }); }
      return;
    }
    if (ev.target.id === 'ntfSkip') { el('ntfDlg').close(); return; }
    if (ev.target.id === 'ntfSend') {
      var people = boxes().filter(function(b){ return b.checked; }).map(function(b){ return b.value; });
      if (!people.length) { say('Pick at least one person.'); return; }
      ev.target.disabled = true; say('Sending…');
      fetch('/api/notify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
        people: people, title: el('ntfTitle').value, message: el('ntfMsg').value, ref: CTX.ref || '', kind: CTX.kind || 'upload',
        email: el('ntfEmail').checked && el('ntfEmailRow').style.display !== 'none' }) })
        .then(function(r){ return r.json(); }).then(function(j){
          if (j && j.ok) { say('Sent to ' + j.sent + (j.sent === 1 ? ' person' : ' people') + (j.emailed ? ', and emailed.' : '.'));
            setTimeout(function(){ try { el('ntfDlg').close(); } catch (e) {} }, 1200); }
          else { say((j && j.error) || 'Could not send.'); ev.target.disabled = false; }
        }).catch(function(){ say('Could not reach the server.'); ev.target.disabled = false; });
      return;
    }
    // the bell
    var bell = ev.target.closest && ev.target.closest('.bell');
    var list = el('ntfList');
    if (bell) { if (list.style.display === 'block') list.style.display = 'none'; else openList(); return; }
    if (list && list.style.display === 'block' && !ev.target.closest('#ntfList')) list.style.display = 'none';
    if (ev.target.id === 'ntfAllRead') {
      fetch('/api/notifications/read', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"all":true}' })
        .then(function(){ poll(); openList(); });
    }
  });

  // ---- the bell -------------------------------------------------------
  var LAST = { unread: 0, items: [] };
  function when(iso){ var d = Date.parse(iso); if (!d) return ''; var m = Math.round((Date.now() - d) / 60000);
    return m < 1 ? 'just now' : m < 60 ? m + ' min ago' : m < 1440 ? Math.round(m / 60) + ' h ago' : new Date(d).toLocaleDateString(); }
  function setCount(n){ var b = el('bellN'); if (!b) return; b.textContent = n > 0 ? String(n) : ''; b.style.display = n > 0 ? '' : 'none'; }
  function poll(){
    return fetch('/api/notifications', { cache: 'no-store' }).then(function(r){ return r.ok ? r.json() : null; })
      .then(function(j){ if (j) { LAST = j; setCount(j.unread); } }).catch(function(){});
  }
  function openList(){
    var list = el('ntfList');
    var items = LAST.items || [];
    list.innerHTML = '<div class="hd">Notifications' + (LAST.unread ? '<a id="ntfAllRead">Mark all read</a>' : '') + '</div>' +
      (items.length ? items.map(function(n){
        return '<div class="it' + (n.read_at ? '' : ' un') + '"><b>' + esc(n.title) + '</b>' +
          (n.message ? '<div>' + esc(n.message) + '</div>' : '') +
          '<span>' + esc(n.sent_by_name || '') + (n.project_name ? ' · ' + esc(n.project_name) : '') + ' · ' + esc(when(n.created_at)) + '</span></div>';
      }).join('') : '<div class="none">Nothing yet.</div>');
    list.style.display = 'block';
    var ids = items.filter(function(n){ return !n.read_at; }).map(function(n){ return n.id; });
    if (ids.length) fetch('/api/notifications/read', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: ids }) }).then(function(){ LAST.unread = 0; setCount(0); });
  }
  if (el('bellN')) { setCount(0); poll(); setInterval(poll, 60000); }

  // ---- offer it by itself after Document Control uploads something ----
  if (CFG.can && CFG.auto && window.fetch) {
    var realFetch = window.fetch;
    window.fetch = function(url, opts){
      var p = realFetch.apply(this, arguments);
      try {
        var u = String(url || ''), post = opts && String(opts.method || '').toUpperCase() === 'POST';
        var kind = /^.api.drawing(.|$)/.test(u) && u.indexOf('/api/drawing/') < 0 ? 'drawing'
                 : u.indexOf('/api/attachment') === 0 && u.indexOf('/api/attachments') !== 0 ? 'attachment' : '';
        if (post && kind) {
          p.then(function(r){ if (!r.ok) return;
            var body = {}; try { body = JSON.parse(opts.body || '{}'); } catch (e) {}
            var what = kind === 'drawing' ? ('Drawing ' + (body.number || '') + (body.revision ? ' rev ' + body.revision : '') + ' uploaded')
                                          : ('New file on ' + (body.ref || 'a record') + (body.filename ? ' — ' + body.filename : ''));
            clearTimeout(window.__ntfT);
            window.__ntfT = setTimeout(function(){
              window.notifyTeam({ ref: body.ref || body.number || '', kind: kind, title: what,
                message: (body.title ? body.title + '. ' : '') + 'Uploaded by Document Control — please review.' });
            }, 700);
          });
        }
      } catch (e) {}
      return p;
    };
  }
})();
</script>
`;
