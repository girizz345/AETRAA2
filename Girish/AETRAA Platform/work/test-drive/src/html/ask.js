import { THEME_CSS } from './theme.js';
import { HEAD_LINKS, BRAND_CSS, BRAND_MARK, SWITCHER_CSS } from './shared.js';

// A14 as a conversation: the AETRAA Assistant. Questions about the project are
// answered from its own records — only the ones this person may see — with a
// link to every record used. The conversation is kept in this browser tab only
// (v5 A14: answers are not stored); the server re-checks access on every message.
export const askHTML = () => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>AETRAA Assistant</title>
${HEAD_LINKS}
<script>
// In the chat button's panel: no top bar, and a record opens in its own tab
// rather than inside the small panel.
if (location.search.indexOf('embed=1') >= 0) {
  document.documentElement.className += ' embed';
  var bs = document.createElement('base'); bs.target = '_blank'; document.head.appendChild(bs);
}
</script>
<style>${THEME_CSS}${BRAND_CSS}${SWITCHER_CSS}
/* Inside the chat button's panel: the panel has its own header. */
.embed .topbar { display: none; }
.embed .wrap { padding-top: 10px; }
.embed .intro { font-size: var(--fs-secondary); padding: 10px 12px; }
.embed .msg { max-width: 94%; }
.wrap { max-width: 860px; padding-bottom: 150px; }
.sub { font-size: var(--fs-secondary); color: var(--muted); }
.intro { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 12px 16px; margin-bottom: 14px; font-size: var(--fs-body); }
.intro ul { margin: 6px 0 0 18px; padding: 0; }
.msgs { display: flex; flex-direction: column; gap: 10px; }
.msg { max-width: 88%; border-radius: 12px; padding: 10px 14px; font-size: var(--fs-body); line-height: 1.5; white-space: pre-wrap; overflow-wrap: anywhere; }
.msg.me { align-self: flex-end; background: var(--surface-2); border: 1px solid var(--border); }
.msg.bot { align-self: flex-start; background: var(--surface); border: 1px solid var(--border); }
.msg.refused { color: var(--muted); font-style: italic; border-left: 3px solid var(--warning); }
.msg.err { border-left: 3px solid var(--critical); }
.msg .note { display: block; margin-top: 6px; font-size: var(--fs-secondary); color: var(--muted); font-style: normal; }
.msg ul { margin: 6px 0 0 18px; padding: 0; font-size: var(--fs-secondary); white-space: normal; }
.msg a { color: inherit; }
.bar { position: fixed; left: 0; right: 0; bottom: 0; background: var(--plane, var(--surface)); border-top: 1px solid var(--border); padding: 10px 16px; }
.bar-in { max-width: 860px; margin: 0 auto; display: flex; gap: 8px; align-items: flex-end; }
.bar textarea { flex: 1; min-height: 44px; max-height: 140px; font: inherit; padding: 8px 10px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface-2); color: var(--ink); resize: vertical; }
.bar .meta { max-width: 860px; margin: 4px auto 0; display: flex; justify-content: space-between; gap: 8px; }
.linkbtn { background: none; border: 0; padding: 0; color: var(--muted); font: inherit; font-size: var(--fs-secondary); text-decoration: underline; cursor: pointer; }
@media (max-width: 600px) { .msg { max-width: 100%; } .brand .sub { display: none; } }
</style>
</head>
<body>
<div class="topbar"><div class="topbar-in">
  ${BRAND_MARK}
  <div class="brand"><h1>AETRAA Assistant</h1><div class="sub">Ask the project — answers from its own records</div></div>
  <div class="spacer"></div>
  <a class="btn" href="/">Dashboard</a>
  <a class="btn" href="/api/logout">Sign out</a>
</div></div>
<div class="wrap">
  <div class="intro">
    Ask about your project — your drawings, submittals, RFIs, inspections, letters, diary, programme — or how to use AETRAA. For example:
    <ul><li>Which RFIs about the substation are still open?</li><li>What did the consultant say about SUB-004?</li><li>How do I raise a submittal?</li></ul>
    <p class="sub">Only the records your role can open are searched, and every answer links to them. Nothing is changed. The conversation stays in this browser tab.</p>
  </div>
  <div class="msgs" id="msgs" aria-live="polite"></div>
</div>
<div class="bar">
  <div class="bar-in">
    <textarea id="q" rows="1" maxlength="600" placeholder="Ask about your project or AETRAA…" aria-label="Your question"></textarea>
    <button class="btn prim" id="go">Send</button>
  </div>
  <div class="meta"><span class="sub" id="left"></span><button class="linkbtn" id="clear">New conversation</button></div>
</div>
<script>
var KEY = 'aetraa-assistant', TURNS = 6;
var chat = [];
try { chat = JSON.parse(sessionStorage.getItem(KEY) || '[]') || []; } catch (e) { chat = []; }
function save(){ try { sessionStorage.setItem(KEY, JSON.stringify(chat.slice(-40))); } catch (e) {} }
function esc(s){ return String(s == null ? '' : s).replace(/[&<>"]/g, function(c){ return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]; }); }
// Each [REF] the answer cites becomes a link to that record.
function linked(text, sources){
  var at = {}; (sources || []).forEach(function(s){ at[s.ref] = s.link; });
  return esc(text).replace(/\\[([^\\]]{1,40})\\]/g, function(m, r){ return at[r] ? '<a href="' + esc(at[r]) + '">[' + r + ']</a>' : m; });
}
function render(){
  var box = document.getElementById('msgs');
  box.innerHTML = chat.map(function(m){
    if (m.role === 'user') return '<div class="msg me">' + esc(m.text) + '</div>';
    var cls = 'msg bot' + (m.refused ? ' refused' : '') + (m.error ? ' err' : '');
    return '<div class="' + cls + '">' + (m.text ? linked(m.text, m.sources) : '') +
      (m.note ? '<span class="note">' + esc(m.note) + '</span>' : '') +
      (m.sources && m.sources.length ? '<span class="note">' + (m.ai ? 'Records used:' : 'What matches:') + '</span><ul>' +
        m.sources.map(function(s){ return '<li><a href="' + esc(s.link) + '">' + esc(s.label) + '</a></li>'; }).join('') + '</ul>' : '') + '</div>';
  }).join('');
  window.scrollTo(0, document.body.scrollHeight);
}
// What goes back to the server: the last turns, leaving out refused ones.
function history(){
  var out = [];
  for (var i = 0; i < chat.length; i++) {
    var m = chat[i], next = chat[i + 1];
    if (m.role === 'user' && next && (next.refused || next.error)) { i++; continue; }
    if (m.role === 'user' || m.text) out.push({ role: m.role, text: m.text || '' });
  }
  return out.slice(-TURNS);
}
async function send(){
  var q = document.getElementById('q'), b = document.getElementById('go');
  var text = q.value.trim(); if (!text || b.disabled) return;
  var hist = history();
  chat.push({ role: 'user', text: text }); q.value = ''; b.disabled = true;
  chat.push({ role: 'assistant', text: '', note: 'Looking…' }); render();
  var d;
  try {
    var r = await fetch('/api/ask/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question: text, history: hist }) });
    d = await r.json();
  } catch (e) { d = { error: 'The assistant could not be reached. Try again.' }; }
  chat.pop();
  if (d.error) chat.push({ role: 'assistant', text: '', note: d.error, error: true });
  else chat.push({ role: 'assistant', text: d.reply || '', note: d.note || '', refused: !!d.refused, ai: !!d.ai, sources: d.sources || [] });
  if (d.limit) document.getElementById('left').textContent = Math.max(0, d.limit - (d.used || 0)) + ' of ' + d.limit + ' questions left today';
  b.disabled = false; save(); render(); q.focus();
}
document.getElementById('go').addEventListener('click', send);
document.getElementById('q').addEventListener('keydown', function(e){ if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } });
document.getElementById('clear').addEventListener('click', function(){ chat = []; save(); render(); });
// In the chat button's panel, Esc closes the panel.
if (window.parent !== window) document.addEventListener('keydown', function(e){ if (e.key === 'Escape') window.parent.postMessage('aetraa-chat-close', location.origin); });
render();
</script>
</body>
</html>`;
