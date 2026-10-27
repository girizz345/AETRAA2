// AUTO-GENERATED from dashboard-design.html by tools/gen-app.mjs — do not edit by hand.
// The live application shell: the signed-off dashboard design, booted with the
// real signed-in user and fed live data. Regenerate with: node tools/gen-app.mjs
//
// RESTYLED BY HAND, 26 Oct 2026 (Girish: "change the main dashboards and
// everything"): the stylesheet, the head markup, the icons and a few inline
// colours. docs/app-js-restyle.md lists every change, to be carried into
// dashboard-design.html / gen-app.mjs when those arrive — regenerating
// without them undoes the new look.
import { THEME_TOKENS } from './theme.js';
import { icon, symbolIcons } from './icons.js';
import { BUILDING_ART } from './art.js';
const TEMPLATE = String.raw`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>AETRAA Dashboards</title>
<style>
${THEME_TOKENS}
  /* The design's own names, pointed at the theme (src/html/theme.js), so the
     script's inline var(--navy) / var(--gold) … follow both themes. */
  :root{
    --navy: var(--text); --navy2: var(--surface-2); --blue: var(--accent-text); --blue2: var(--accent);
    --gold: var(--accent); --faint: var(--text-2); --soft: var(--surface-2); --white: var(--surface);
    --tint: color-mix(in srgb, var(--accent) 16%, transparent);
  }
  *{box-sizing:border-box}
  html{background:var(--void);}
  body{margin:var(--s4);min-height:calc(100vh - 2 * var(--s4));border:1px solid var(--line);border-radius:22px;
    background:radial-gradient(1000px 560px at 85% 0%,var(--glow),transparent 70%),linear-gradient(180deg,var(--frame-1),var(--frame-2) 70%);
    font-family:var(--font);font-size:var(--fs-body);line-height:var(--lh-body);font-synthesis:none;
    color:var(--text);-webkit-font-smoothing:antialiased;}
  @media(max-width:600px){body{margin:0;border:0;border-radius:0;min-height:100vh;}}
  a{color:inherit}
  b,strong{font-weight:500;}
  button{font:inherit;cursor:pointer;}
  .hide{display:none !important;}
  .ic svg,svg.ic{display:block;}
  :focus-visible{outline:2px solid var(--accent);outline-offset:2px;}

  /* ============ LOGIN ============ */
  .login{min-height:calc(100vh - 2 * var(--s4));display:flex;align-items:center;justify-content:center;padding:var(--s5);position:relative;overflow:hidden;border-radius:22px;}
  .lcard{position:relative;background:var(--glass);-webkit-backdrop-filter:var(--blur);backdrop-filter:var(--blur);
    border:1px solid var(--line-strong);border-radius:var(--r-frame);width:100%;max-width:880px;overflow:hidden;display:grid;grid-template-columns:1fr 1fr;}
  .lleft{padding:var(--s6);}
  .lbrand{font-weight:400;letter-spacing:.3em;color:var(--text);font-size:var(--fs-headline);}
  .ltag{color:var(--text-2);font-size:var(--fs-secondary);margin-top:var(--s1);}
  .lh{font-size:var(--fs-display);line-height:var(--lh-display);font-weight:300;text-transform:uppercase;letter-spacing:-.02em;color:var(--text);margin:var(--s6) 0 var(--s3);}
  .lp{color:var(--text-2);font-size:var(--fs-secondary);line-height:var(--lh-secondary);font-weight:300;margin-bottom:var(--s5);}
  .lfield{display:block;font-size:var(--fs-label);line-height:var(--lh-label);text-transform:uppercase;letter-spacing:.1em;color:var(--text-2);font-weight:500;margin:0 0 var(--s2);}
  .lin{width:100%;min-height:44px;padding:0 var(--s3);border:1px solid var(--line);border-radius:var(--r-control);font:inherit;font-size:var(--fs-body);background:var(--surface-2);color:var(--text);margin-bottom:var(--s4);}
  .lin:focus{outline:none;border-color:var(--accent);box-shadow:0 0 0 3px color-mix(in srgb,var(--accent) 25%,transparent);}
  .lbtn{width:100%;min-height:44px;background:var(--accent);color:var(--on-accent);border:0;border-radius:var(--r-control);font-weight:500;font-size:var(--fs-body);}
  .lnote{font-size:var(--fs-secondary);color:var(--text-2);margin-top:var(--s4);line-height:var(--lh-secondary);font-weight:300;}
  .lright{background:color-mix(in srgb,var(--surface-2) 60%,transparent);border-left:1px solid var(--line);padding:var(--s6) var(--s5);}
  .lright h3{color:var(--text-2);font-size:var(--fs-label);letter-spacing:.1em;text-transform:uppercase;font-weight:500;margin:0 0 var(--s1);}
  .lright p{font-size:var(--fs-secondary);color:var(--text-2);margin:0 0 var(--s4);line-height:var(--lh-secondary);font-weight:300;}
  .acc{background:none;border:1px solid var(--line);border-radius:var(--r-card);padding:var(--s3) var(--s4);margin-bottom:var(--s2);cursor:pointer;}
  .acc:hover{border-color:var(--line-strong);background:var(--surface-2);}
  .acc b{color:var(--text);font-size:var(--fs-secondary);display:block;font-weight:400;}
  .acc .em{color:var(--text-2);font-size:var(--fs-secondary);font-family:var(--mono);}
  .acc .fn{color:var(--accent-text);font-size:var(--fs-secondary);margin-top:2px;}
  .login .loginart{position:absolute;inset:0;color:var(--text-2);opacity:.5;pointer-events:none;}
  .login .loginart .art{position:absolute;right:-4%;bottom:-6%;width:62%;height:auto;}

  /* ============ APP SHELL ============ */
  .app{display:grid;grid-template-columns:256px minmax(0,1fr);min-height:calc(100vh - 2 * var(--s4));}
  .side{color:var(--text-2);display:flex;flex-direction:column;position:sticky;top:var(--s4);height:calc(100vh - 2 * var(--s4));
    border-right:1px solid var(--line);border-radius:22px 0 0 22px;background:color-mix(in srgb,var(--bg) 88%,transparent);}
  .brand{padding:var(--s5) var(--s5) var(--s4);font-weight:500;letter-spacing:.3em;color:var(--accent-text);font-size:var(--fs-headline);display:flex;align-items:center;gap:var(--s2);}
  .brand .dot{width:6px;height:6px;border-radius:50%;background:var(--accent);}
  .proj{margin:0 var(--s4) var(--s3);background:none;border:1px solid var(--line);border-radius:var(--r-card);padding:var(--s3);
    font-size:var(--fs-label);line-height:var(--lh-label);letter-spacing:.1em;text-transform:uppercase;color:var(--text-2);font-weight:500;}
  .proj b{display:block;color:var(--text);font-size:var(--fs-secondary);line-height:var(--lh-secondary);margin-top:var(--s1);font-weight:400;letter-spacing:0;text-transform:none;}
  .proj select{margin-top:var(--s2);width:100%;min-height:36px;background:var(--surface-2);color:var(--text);border:1px solid var(--line);border-radius:var(--r-control);padding:0 var(--s2);font:inherit;font-size:var(--fs-secondary);letter-spacing:0;text-transform:none;}
  .proj div[style]{letter-spacing:0;text-transform:none;font-weight:400;}
  .nav{flex:1;overflow:auto;padding:var(--s1) var(--s3) var(--s4);}
  .nav::-webkit-scrollbar{width:6px;} .nav::-webkit-scrollbar-thumb{background:var(--line);border-radius:6px;}
  .nsec{font-size:var(--fs-label);line-height:var(--lh-label);letter-spacing:.1em;color:var(--text-2);text-transform:uppercase;font-weight:500;margin:var(--s5) var(--s3) var(--s2);}
  .nav a{position:relative;display:flex;align-items:center;justify-content:space-between;gap:var(--s2);min-height:38px;padding:0 var(--s3);border-radius:var(--r-control);
    color:var(--text-2);text-decoration:none;font-size:var(--fs-secondary);line-height:var(--lh-secondary);margin-bottom:2px;cursor:pointer;}
  .nav a > span:first-child{display:flex;align-items:center;gap:var(--s3);min-width:0;}
  .nav a .ic{width:16px;height:16px;flex:0 0 16px;display:inline-flex;align-items:center;justify-content:center;opacity:.9;}
  .nav a:hover{color:var(--text);background:color-mix(in srgb,var(--text) 5%,transparent);}
  .nav a.on{background:color-mix(in srgb,var(--text) 9%,transparent);color:var(--text);font-weight:500;}
  .nav a.on::before{content:"";position:absolute;left:-12px;top:50%;width:3px;height:18px;margin-top:-9px;border-radius:var(--r-pill);background:var(--accent);}
  .nav a .bdg{font-family:var(--mono);font-variant-numeric:tabular-nums;color:var(--text-2);font-size:var(--fs-label);border:1px solid var(--line);border-radius:var(--r-pill);padding:0 7px;line-height:18px;}
  .nav a.on .bdg{border-color:var(--line-strong);}
  .nav a .bdg.hot{background:var(--accent);border-color:transparent;color:var(--on-accent);}
  .me{padding:var(--s4);border-top:1px solid var(--line);font-size:var(--fs-secondary);display:flex;align-items:center;gap:var(--s3);}
  .me .av{width:36px;height:36px;border-radius:50%;border:1px solid var(--line-strong);color:var(--text);font-weight:400;display:flex;align-items:center;justify-content:center;font-size:var(--fs-label);letter-spacing:.06em;flex:0 0 auto;}
  .me b{color:var(--text);display:block;font-size:var(--fs-secondary);font-weight:400;}
  .me span{color:var(--text-2);font-size:var(--fs-label);}
  .me .out{margin-left:auto;color:var(--text-2);font-size:var(--fs-secondary);text-decoration:none;cursor:pointer;border:1px solid var(--line);border-radius:var(--r-pill);padding:4px 12px;white-space:nowrap;}
  .me .out:hover{color:var(--text);border-color:var(--line-strong);}

  .main{display:flex;flex-direction:column;min-width:0;}
  /* The header: the one strongly frosted surface — sticky, compact, the page's
     title in plain words with the project line under it. */
  .top{position:sticky;top:0;z-index:6;padding:var(--s4) var(--s6);display:flex;align-items:center;gap:var(--s4);flex-wrap:wrap;
    border-bottom:1px solid var(--line);border-radius:0 22px 0 0;
    background:var(--glass);-webkit-backdrop-filter:var(--blur);backdrop-filter:var(--blur);}
  .top .topart{display:none;}
  .top > div:first-child{position:relative;display:flex;flex-direction:column;gap:2px;min-width:0;flex:1 1 320px;}
  .top h1{margin:0;font-size:var(--fs-title);line-height:var(--lh-title);font-weight:600;letter-spacing:-.015em;color:var(--text);}
  .top .sub{color:var(--text-2);font-size:var(--fs-secondary);line-height:var(--lh-secondary);font-weight:400;}
  .hats{position:relative;margin-left:auto;display:flex;gap:var(--s2);align-items:center;flex-wrap:wrap;}
  .hatlbl{font-size:var(--fs-label);color:var(--text-2);text-transform:uppercase;letter-spacing:.1em;font-weight:500;margin-right:var(--s1);}
  .hats button{display:inline-flex;align-items:center;gap:var(--s2);min-height:40px;font-size:var(--fs-secondary);font-weight:400;padding:0 var(--s4);border-radius:var(--r-pill);border:1px solid var(--line);background:none;color:var(--text-2);}
  .hats button .ic{width:16px;height:16px;display:inline-flex;}
  .hats button:hover{color:var(--text);border-color:var(--line-strong);}
  .hats button.on{background:var(--card-light);color:var(--on-card-light);border-color:transparent;}
  .viewsel{min-height:40px;font:inherit;font-size:var(--fs-secondary);padding:0 var(--s5) 0 var(--s3);border-radius:var(--r-control);border:1px solid var(--line);background:var(--surface-2);color:var(--text);max-width:240px;}
  .robar{background:color-mix(in srgb,var(--warn-ink) 12%,transparent);border:0;border-radius:var(--r-card);padding:var(--s3) var(--s4);margin:0 0 var(--s4);font-size:var(--fs-secondary);color:var(--text);}
  .robar b{color:var(--warn-ink);}
  .bell{position:relative;width:44px;height:44px;border-radius:50%;border:1px solid var(--line-strong);background:none;display:flex;align-items:center;justify-content:center;color:var(--text);cursor:pointer;}
  .bell:hover{background:var(--surface-2);}
  .bell b{position:absolute;top:-2px;right:-2px;background:var(--accent);color:var(--on-accent);font-size:var(--fs-label);font-weight:500;border-radius:var(--r-pill);padding:1px 6px;font-family:var(--mono);}
  .tbtn{position:relative;width:44px;height:44px;border-radius:50%;border:1px solid var(--line-strong);background:none;display:flex;align-items:center;justify-content:center;color:var(--text);}
  .tbtn:hover{background:var(--surface-2);}
  .wrap{padding:var(--s5) var(--s6) var(--s7);overflow:auto;}
  /* What this person does here: one line under the header, not a box. */
  #rolebar{font-size:var(--fs-body);line-height:1.55;font-weight:400;color:var(--text-2);margin:0 0 var(--s5);max-width:90ch;background:none;border:0;padding:0;}
  #rolebar b{color:var(--text);font-weight:500;}
  #rolebar:empty{display:none;}

  /* Four figure cards: label and icon tile on top, the number below. */
  .kpis{display:grid;gap:var(--s4);margin-bottom:var(--s5);grid-template-columns:repeat(4,minmax(0,1fr)) !important;}
  .kpi{background:var(--card);border:1px solid var(--line);border-radius:var(--r-frame);padding:var(--s5);display:flex;flex-direction:column;gap:var(--s4);min-width:0;}
  .kpi .kh{display:flex;align-items:flex-start;justify-content:space-between;gap:var(--s2);}
  .kpi .l{font-size:var(--fs-secondary);line-height:var(--lh-secondary);color:var(--text-2);font-weight:400;}
  .kpi .ki{width:32px;height:32px;flex:0 0 32px;border-radius:var(--r-control);background:var(--surface-2);border:1px solid var(--line);color:var(--text-2);display:inline-flex;align-items:center;justify-content:center;}
  .kpi .v{font-size:var(--fs-number);line-height:var(--lh-number);font-weight:600;color:var(--text);font-variant-numeric:tabular-nums;letter-spacing:-.02em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
  .kpi.act .v{color:var(--accent-text);} .kpi.warn .v{color:var(--warn-ink);} .kpi.bad .v{color:var(--bad-ink);} .kpi.good .v{color:var(--good-ink);}
  .kpi.bad .ki{color:var(--bad-ink);background:color-mix(in srgb,var(--bad-ink) 12%,transparent);border-color:transparent;}
  .kpi.good .ki{color:var(--good-ink);background:color-mix(in srgb,var(--good-ink) 12%,transparent);border-color:transparent;}
  .kpi.act .ki{color:var(--accent-text);background:color-mix(in srgb,var(--accent) 14%,transparent);border-color:transparent;}
  .kpi.warn .ki{color:var(--warn-ink);background:color-mix(in srgb,var(--warn-ink) 12%,transparent);border-color:transparent;}

  /* The queue takes the wide column; decisions and activity sit in the narrow one beside it. */
  .cols{display:grid;grid-template-columns:minmax(0,2fr) minmax(0,1fr);gap:var(--s5);align-items:start;}
  .card{background:var(--card);border:1px solid var(--line);border-radius:var(--r-frame);padding:var(--s5);margin-bottom:var(--s5);}
  .card h2{margin:0 0 var(--s4);font-size:var(--fs-headline);line-height:var(--lh-headline);color:var(--text);font-weight:600;letter-spacing:-.01em;}
  .card h2 .r{float:right;color:var(--text-2);font-weight:400;letter-spacing:0;font-size:var(--fs-secondary);margin-top:2px;}
  /* A card the design edged in gold is a featured one: frosted, with a champagne edge. */
  .card[style*="border-left:3px solid var(--gold)"]{border:1px solid color-mix(in srgb,var(--accent) 45%,transparent) !important;
    background:var(--glass);-webkit-backdrop-filter:var(--blur);backdrop-filter:var(--blur);}
  .card[style*="border-left:3px solid var(--gold)"] h2{color:var(--accent-text);}
  /* The queue: each item a quiet rounded row. */
  .card table:has(tr[data-attn]){border-collapse:separate;border-spacing:0 var(--s2);margin-top:calc(-1 * var(--s2));}
  tr[data-attn] td{background:color-mix(in srgb,var(--surface-2) 55%,transparent);border-top:1px solid var(--line);border-bottom:1px solid var(--line);height:56px;}
  tr[data-attn] td:first-child{border-left:1px solid var(--line);border-radius:var(--r-card) 0 0 var(--r-card);padding-left:var(--s4);}
  tr[data-attn] td:last-child{border-right:1px solid var(--line);border-radius:0 var(--r-card) var(--r-card) 0;padding-right:var(--s4);}
  tr[data-attn]:hover td{background:var(--surface-2);border-color:var(--line-strong);}

  .bar{display:flex;align-items:center;gap:var(--s3);margin:var(--s3) 0;font-size:var(--fs-secondary);}
  .bar .nm{width:110px;color:var(--text);}
  .bar .track{flex:1;height:4px;background:var(--line);border-radius:var(--r-pill);overflow:hidden;}
  .bar .fill{height:100%;background:var(--accent);border-radius:var(--r-pill);}
  .bar .pc{width:44px;text-align:right;color:var(--text-2);font-variant-numeric:tabular-nums;font-family:var(--mono);}

  .q{display:flex;gap:var(--s3);padding:var(--s3) var(--s2);margin:0 calc(-1 * var(--s2));border-bottom:1px solid var(--line);cursor:pointer;border-radius:var(--r-control);}
  .q:last-child{border-bottom:0;} .q:hover{background:var(--surface-2);}
  .q .tag{flex:0 0 auto;font-size:var(--fs-label);line-height:var(--lh-label);font-weight:500;letter-spacing:.06em;border-radius:var(--r-pill);padding:3px 9px;height:fit-content;
    background:var(--tint);color:var(--accent-text);font-family:var(--mono);}
  .q .tag.vo{background:color-mix(in srgb,var(--warn-ink) 15%,transparent);color:var(--warn-ink);}
  .q .tag.ipc{background:color-mix(in srgb,var(--good-ink) 15%,transparent);color:var(--good-ink);}
  .q .tag.ncr{background:color-mix(in srgb,var(--bad-ink) 15%,transparent);color:var(--bad-ink);}
  .q .tag.hse{background:color-mix(in srgb,var(--warn-ink) 15%,transparent);color:var(--warn-ink);}
  .q .tag.dwg{background:var(--surface-2);color:var(--text-2);}
  .q .bd{flex:1;min-width:0;}
  .q .ti{font-size:var(--fs-body);line-height:var(--lh-body);font-weight:400;color:var(--text);}
  .q .mt{font-size:var(--fs-secondary);color:var(--text-2);margin-top:2px;font-weight:300;}
  .q .btn{align-self:center;display:inline-flex;align-items:center;min-height:34px;font-size:var(--fs-secondary);font-weight:400;border:1px solid var(--line-strong);color:var(--text);background:none;border-radius:var(--r-pill);padding:0 var(--s3);white-space:nowrap;}
  .q .btn:hover{background:var(--surface-2);}
  .q .btn.sign{background:var(--accent);color:var(--on-accent);border-color:transparent;}
  .q .due{font-size:var(--fs-secondary);color:var(--bad-ink);font-weight:400;margin-top:2px;}
  .q .chev{align-self:center;color:var(--text-2);}

  .feed{list-style:none;margin:0;padding:0;}
  .feed li{display:flex;gap:var(--s3);padding:var(--s3) 0;border-bottom:1px solid var(--line);font-size:var(--fs-secondary);cursor:pointer;}
  .feed li:last-child{border-bottom:0;} .feed li:hover .t{color:var(--accent-text);}
  .feed .dot{flex:0 0 auto;width:6px;height:6px;border-radius:50%;background:var(--accent);margin-top:7px;}
  .feed .dot.g{background:var(--good);}.feed .dot.a{background:var(--warn);}.feed .dot.r{background:var(--bad);}
  .feed .t{color:var(--text);font-weight:400;} .feed .w{color:var(--text-2);font-weight:300;}
  .feed .ago{margin-left:auto;color:var(--text-2);font-size:var(--fs-label);white-space:nowrap;font-family:var(--mono);}

  table{width:100%;border-collapse:collapse;font-size:var(--fs-secondary);line-height:var(--lh-secondary);}
  th{text-align:left;font-size:var(--fs-label);line-height:var(--lh-label);letter-spacing:.1em;text-transform:uppercase;color:var(--text-2);font-weight:500;padding:var(--s2) var(--s3) var(--s3);border-bottom:1px solid var(--line);}
  td{padding:var(--s3);border-bottom:1px solid var(--line);color:var(--text);vertical-align:middle;height:44px;}
  tr:last-child td{border-bottom:0;}
  tr.click{cursor:pointer;} tr.click:hover td{background:var(--surface-2);}
  .pill{display:inline-flex;align-items:center;gap:4px;font-size:var(--fs-secondary);line-height:var(--lh-secondary);font-weight:400;border-radius:var(--r-pill);padding:1px 10px;white-space:nowrap;background:var(--surface-2);color:var(--text-2);}
  .pill.ok{background:color-mix(in srgb,var(--good-ink) 15%,transparent);color:var(--good-ink);}
  .pill.wp{background:var(--tint);color:var(--accent-text);}
  .pill.late{background:color-mix(in srgb,var(--bad-ink) 15%,transparent);color:var(--bad-ink);}
  .pill.warn{background:color-mix(in srgb,var(--warn-ink) 15%,transparent);color:var(--warn-ink);}
  .mini{font-size:var(--fs-secondary);color:var(--text-2);margin-top:var(--s2);line-height:var(--lh-secondary);font-weight:300;}
  .ref{font-family:var(--mono);color:var(--accent-text);font-weight:400;font-variant-numeric:tabular-nums;}

  /* portfolio (principal) */
  .pf{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:var(--s4);}
  .pcard{border:1px solid var(--line);border-radius:var(--r-card);padding:var(--s4);cursor:pointer;background:none;}
  .pcard:hover{border-color:var(--line-strong);background:var(--surface-2);}
  .pcard .pn{font-weight:400;color:var(--text);font-size:var(--fs-headline);line-height:var(--lh-headline);}
  .pcard .pl{font-size:var(--fs-secondary);color:var(--text-2);margin:2px 0 var(--s3);}
  .pcard .pr{display:flex;justify-content:space-between;font-size:var(--fs-secondary);color:var(--text-2);margin-top:var(--s2);}
  .pcard .pr b{color:var(--text);font-weight:400;}
  .track2{height:4px;background:var(--line);border-radius:var(--r-pill);overflow:hidden;margin:var(--s1) 0;}
  .track2 .fill{height:100%;border-radius:var(--r-pill);background:var(--accent);}
  .chips{display:flex;gap:var(--s1);flex-wrap:wrap;margin-top:var(--s3);}
  .chip{font-size:var(--fs-secondary);line-height:var(--lh-secondary);font-weight:400;border-radius:var(--r-pill);padding:0 10px;background:var(--surface-2);color:var(--text-2);}
  .chip.r{background:color-mix(in srgb,var(--bad-ink) 15%,transparent);color:var(--bad-ink);}
  .chip.a{background:color-mix(in srgb,var(--warn-ink) 15%,transparent);color:var(--warn-ink);}
  .chip.g{background:color-mix(in srgb,var(--good-ink) 15%,transparent);color:var(--good-ink);}
  /* principal drill-down */
  .pcrumb{display:flex;align-items:center;gap:var(--s2);font-size:var(--fs-secondary);color:var(--text-2);margin:0 0 var(--s4);}
  .pcrumb a{color:var(--accent-text);cursor:pointer;text-decoration:none;}
  .pcrumb .sep{color:var(--text-2);}
  .pcrumb .cur{color:var(--text);}
  .phead{display:flex;align-items:flex-end;gap:var(--s4);background:none;border:0;border-bottom:1px solid var(--line);border-radius:0;padding:0 0 var(--s5);margin-bottom:var(--s5);}
  .phead .pt{font-size:var(--fs-title);line-height:var(--lh-title);color:var(--text);font-weight:300;text-transform:uppercase;letter-spacing:-.01em;}
  .phead .psub{font-size:var(--fs-secondary);color:var(--text-2);margin-top:var(--s1);font-weight:300;}
  .phead .pbig{margin-left:auto;text-align:right;}
  .phead .pbig .n{font-size:var(--fs-number);line-height:var(--lh-number);font-weight:300;color:var(--accent-text);}
  .phead .pbig .l{font-size:var(--fs-label);color:var(--text-2);text-transform:uppercase;letter-spacing:.1em;margin-top:var(--s1);font-weight:500;}
  .ptiles{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:var(--s4);margin-bottom:var(--s5);}
  .ptile{border:1px solid var(--line);border-radius:var(--r-frame);padding:var(--s5);background:var(--glass);-webkit-backdrop-filter:var(--blur);backdrop-filter:var(--blur);cursor:pointer;}
  .ptile:hover{border-color:var(--line-strong);}
  .ptile .th{display:flex;align-items:center;gap:var(--s3);margin-bottom:var(--s4);}
  .ptile .ic{width:36px;height:36px;border-radius:var(--r-control);border:1px solid var(--line);background:none;color:var(--text-2);display:flex;align-items:center;justify-content:center;flex:0 0 auto;}
  .ptile .tt{font-size:var(--fs-secondary);font-weight:400;color:var(--text);}
  .ptile .stat{font-size:var(--fs-number);line-height:var(--lh-number);font-weight:300;color:var(--text);}
  .ptile .sub{font-size:var(--fs-secondary);color:var(--text-2);margin-top:var(--s1);font-weight:300;}
  .ptile .flag{float:right;font-size:var(--fs-secondary);font-weight:400;border-radius:var(--r-pill);padding:0 10px;}
  .ptile .flag.r{background:color-mix(in srgb,var(--bad-ink) 15%,transparent);color:var(--bad-ink);}
  .ptile .flag.a{background:color-mix(in srgb,var(--warn-ink) 15%,transparent);color:var(--warn-ink);}
  .ptile .flag.g{background:color-mix(in srgb,var(--good-ink) 15%,transparent);color:var(--good-ink);}
  .backbtn{border:1px solid var(--line);background:none;border-radius:var(--r-pill);min-height:36px;padding:0 var(--s4);font-size:var(--fs-secondary);color:var(--text-2);margin-bottom:var(--s4);}
  .backbtn:hover{color:var(--text);border-color:var(--line-strong);}

  /* ============ DETAIL (drill-through) ============ */
  .detail{position:fixed;inset:0;background:var(--scrim);display:flex;justify-content:flex-end;z-index:30;padding:var(--s4);}
  .dpane{width:min(780px,94vw);background:linear-gradient(180deg,var(--frame-1),var(--frame-2));border:1px solid var(--line-strong);border-radius:var(--r-frame);height:100%;overflow:auto;}
  .dtop{background:color-mix(in srgb,var(--frame-1) 80%,transparent);-webkit-backdrop-filter:var(--blur);backdrop-filter:var(--blur);border-bottom:1px solid var(--line);padding:var(--s5) var(--s5) var(--s4);position:sticky;top:0;z-index:2;}
  .crumb{font-size:var(--fs-label);letter-spacing:.1em;text-transform:uppercase;color:var(--text-2);margin-bottom:var(--s2);font-weight:500;}
  .crumb a{color:var(--accent-text);cursor:pointer;text-decoration:none;}
  .dhrow{display:flex;align-items:flex-start;gap:var(--s3);}
  .dh{font-size:var(--fs-title);line-height:var(--lh-title);color:var(--text);font-weight:300;margin:0;}
  .dref{font-family:var(--mono);font-size:var(--fs-secondary);color:var(--text-2);margin-top:var(--s1);}
  .dclose{margin-left:auto;border:1px solid var(--line-strong);background:none;border-radius:50%;width:40px;height:40px;flex:0 0 40px;font-size:var(--fs-headline);color:var(--text);}
  .dclose:hover{background:var(--surface-2);}
  .dbody{padding:var(--s5);}
  .dgrid{display:grid;grid-template-columns:minmax(0,1.3fr) minmax(0,1fr);gap:var(--s4);align-items:start;}
  .facts{list-style:none;margin:0;padding:0;}
  .facts li{display:flex;justify-content:space-between;gap:var(--s3);padding:var(--s2) 0;border-bottom:1px solid var(--line);font-size:var(--fs-secondary);}
  .facts li:last-child{border-bottom:0;}
  .facts .k{color:var(--text-2);} .facts .v{color:var(--text);font-weight:400;text-align:right;}
  .desc{font-size:var(--fs-body);line-height:1.6;color:var(--text);font-weight:300;}
  /* workflow ladder */
  .ladder{list-style:none;margin:0;padding:0;position:relative;}
  .ladder li{position:relative;padding:0 0 var(--s4) 28px;}
  .ladder li:before{content:'';position:absolute;left:7px;top:18px;bottom:0;width:1px;background:var(--line-strong);}
  .ladder li:last-child:before{display:none;}
  .ladder .node{position:absolute;left:1px;top:3px;width:13px;height:13px;border-radius:50%;border:1px solid var(--line-strong);background:var(--frame-2);}
  .ladder .node.done{background:var(--good);border-color:transparent;} .ladder .node.now{background:var(--accent);border-color:transparent;box-shadow:0 0 0 4px color-mix(in srgb,var(--accent) 22%,transparent);} .ladder .node.wait{background:none;}
  .ladder .st{font-size:var(--fs-secondary);font-weight:400;color:var(--text);}
  .ladder .who{font-size:var(--fs-secondary);color:var(--text-2);margin-top:1px;font-weight:300;}
  .ladder .when{font-size:var(--fs-label);color:var(--text-2);margin-top:1px;font-family:var(--mono);}
  .sig{margin-top:var(--s2);display:inline-flex;align-items:center;gap:var(--s2);border:1px solid var(--line);border-radius:var(--r-control);padding:var(--s1) var(--s3);background:var(--card-light);color:var(--on-card-light);}
  /* The one place a script face stays: a drawn signature. */
  .sig .script{font-family:'Segoe Script','Brush Script MT',cursive;font-size:18px;color:var(--on-card-light);transform:rotate(-3deg);}
  .sig .esign{font-family:'Segoe Script','Brush Script MT',cursive;font-size:17px;color:var(--on-card-light);}
  .sig .sm{font-size:var(--fs-label);color:var(--on-card-light);opacity:.75;line-height:1.3;}
  .sigwait{margin-top:var(--s2);font-size:var(--fs-secondary);color:var(--warn-ink);background:color-mix(in srgb,var(--warn-ink) 14%,transparent);border-radius:var(--r-pill);padding:2px 12px;display:inline-block;}
  .actbar{margin-top:var(--s3);display:flex;gap:var(--s2);flex-wrap:wrap;}
  .actbar button{display:inline-flex;align-items:center;gap:var(--s2);min-height:44px;border-radius:var(--r-pill);padding:0 var(--s4);font-size:var(--fs-secondary);font-weight:400;border:1px solid var(--line-strong);background:none;color:var(--text);}
  .actbar button:hover{background:var(--surface-2);}
  .actbar button.prim{background:var(--accent);color:var(--on-accent);border-color:transparent;border-radius:var(--r-control);font-size:var(--fs-body);font-weight:500;}
  .actbar button.warn{border-color:color-mix(in srgb,var(--bad-ink) 50%,transparent);color:var(--bad-ink);}
  .actbar button.ovr{border-color:var(--accent);color:var(--accent-text);background:none;}
  .ovrtag{display:inline-block;font-size:var(--fs-label);font-weight:500;background:var(--tint);color:var(--accent-text);border-radius:var(--r-pill);padding:1px 8px;margin-left:var(--s2);letter-spacing:.06em;}
  .ladder .node.ovr{background:var(--accent);border-color:transparent;}
  /* register schedule button + gantt */
  .schbtn{font-size:var(--fs-secondary);font-weight:400;border:1px solid var(--line-strong);color:var(--text);background:none;border-radius:var(--r-pill);padding:2px 10px;margin-left:var(--s2);}
  .schbtn.add{border-color:var(--accent);color:var(--accent-text);}
  .grow{display:grid;grid-template-columns:200px 1fr;gap:var(--s3);align-items:center;padding:var(--s1) 0;border-bottom:1px solid var(--line);}
  .grow:last-child{border-bottom:0;}
  .glabel{font-size:var(--fs-secondary);color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
  .gtrack{position:relative;height:16px;background:color-mix(in srgb,var(--surface-2) 70%,transparent);border-radius:var(--r-pill);}
  .gbar{position:absolute;top:4px;height:8px;border-radius:var(--r-pill);background:var(--accent);}
  .gbar.late{background:var(--bad);} .gbar.ok{background:var(--good);} .gbar.wp{background:var(--accent);} .gbar.warn{background:var(--warn);}
  .gnow{position:absolute;top:-4px;bottom:-4px;width:0;border-left:1px dashed var(--text);z-index:2;}
  .gaxis span{position:absolute;font-size:var(--fs-label);color:var(--text-2);font-family:var(--mono);}
  /* create-from-template form */
  .tmplnote{background:var(--card-light);color:var(--on-card-light);border:0;border-radius:var(--r-card);padding:var(--s3) var(--s4);font-size:var(--fs-secondary);margin-bottom:var(--s4);line-height:var(--lh-secondary);}
  .frm{display:grid;grid-template-columns:1fr 1fr;gap:var(--s3);}
  .frm .f{display:flex;flex-direction:column;gap:var(--s1);}
  .frm .f.full{grid-column:1 / 3;}
  .frm label{font-size:var(--fs-secondary);color:var(--text-2);font-weight:400;}
  .frm input,.frm select,.frm textarea{border:1px solid var(--line);border-radius:var(--r-control);min-height:44px;padding:0 var(--s3);font:inherit;font-size:var(--fs-body);background:var(--surface-2);color:var(--text);width:100%;}
  .frm textarea{min-height:88px;padding:var(--s3);resize:vertical;}
  .frm input:focus,.frm select:focus,.frm textarea:focus{outline:none;border-color:var(--accent);box-shadow:0 0 0 3px color-mix(in srgb,var(--accent) 25%,transparent);}
  .filebox{border:1px dashed var(--line-strong);border-radius:var(--r-card);padding:var(--s4);font-size:var(--fs-secondary);color:var(--text-2);text-align:center;}
  .wfprev{margin:0;padding-left:var(--s4);font-size:var(--fs-secondary);color:var(--text);}
  .wfprev li{padding:2px 0;}
  .gensuccess{text-align:center;padding:var(--s6) var(--s3);}
  .gensuccess .tick{width:56px;height:56px;border-radius:50%;border:1px solid var(--good-ink);color:var(--good-ink);font-size:24px;display:flex;align-items:center;justify-content:center;margin:0 auto var(--s4);}
  /* site engineer — simple activity list */
  .actrow{display:grid;grid-template-columns:minmax(0,1fr) 150px 48px 112px;gap:var(--s4);align-items:center;padding:var(--s3) var(--s2);margin:0 calc(-1 * var(--s2));border-bottom:1px solid var(--line);cursor:pointer;border-radius:var(--r-control);}
  .actrow:last-child{border-bottom:0;} .actrow:hover{background:var(--surface-2);}
  .actrow .an{font-size:var(--fs-body);font-weight:400;color:var(--text);}
  .actrow .af{font-size:var(--fs-secondary);color:var(--text-2);margin-top:2px;font-weight:300;}
  .actrow .track{height:4px;background:var(--line);border-radius:var(--r-pill);overflow:hidden;}
  .actrow .track .fill{height:100%;border-radius:var(--r-pill);background:var(--accent);}
  .actrow .apc{font-size:var(--fs-body);font-weight:300;color:var(--text);text-align:right;font-variant-numeric:tabular-nums;font-family:var(--mono);}
  .abtn{min-height:36px;font-size:var(--fs-secondary);font-weight:400;border:1px solid var(--line-strong);color:var(--text);background:none;border-radius:var(--r-pill);padding:0 var(--s3);white-space:nowrap;}
  .abtn:hover{background:var(--surface-2);}
  .abtn.done{border-color:color-mix(in srgb,var(--good-ink) 50%,transparent);color:var(--good-ink);}
  .links a{display:flex;align-items:center;gap:var(--s2);padding:var(--s2) 0;border-bottom:1px solid var(--line);font-size:var(--fs-secondary);cursor:pointer;text-decoration:none;}
  .links a:last-child{border-bottom:0;} .links a:hover{color:var(--accent-text);}
  .links .lt{font-size:var(--fs-label);font-weight:500;background:var(--tint);color:var(--accent-text);border-radius:var(--r-pill);padding:1px 8px;font-family:var(--mono);}
  .att{display:flex;align-items:center;gap:var(--s3);padding:var(--s2) 0;border-bottom:1px solid var(--line);font-size:var(--fs-secondary);}
  .att:last-child{border-bottom:0;}
  .att .fi{width:32px;height:32px;border-radius:var(--r-control);border:1px solid var(--line);color:var(--text-2);display:flex;align-items:center;justify-content:center;font-size:var(--fs-label);}
  .att .fn{flex:1;} .att .fs{color:var(--text-2);font-size:var(--fs-label);font-family:var(--mono);}
  .audit{list-style:none;margin:0;padding:0;font-size:var(--fs-secondary);}
  .audit li{padding:var(--s2) 0;border-bottom:1px solid var(--line);color:var(--text-2);font-weight:300;}
  .audit li:last-child{border-bottom:0;} .audit b{color:var(--text);font-weight:400;}
  .sechd{font-size:var(--fs-label);line-height:var(--lh-label);text-transform:uppercase;letter-spacing:.1em;color:var(--text-2);font-weight:500;margin:0 0 var(--s3);}
  .note{background:var(--glass);border:1px solid var(--line);border-radius:var(--r-card);padding:var(--s4);margin-bottom:var(--s4);}
  .dwarn{background:color-mix(in srgb,var(--bad-ink) 12%,transparent);border:0;border-radius:var(--r-card);padding:var(--s3) var(--s4);margin-bottom:var(--s4);font-size:var(--fs-secondary);color:var(--text);line-height:var(--lh-secondary);}
  .dwarn b{color:var(--bad-ink);font-weight:500;}
  /* BOM meter */
  .bomrow{margin:var(--s3) 0;}
  .bomrow .bh{display:flex;justify-content:space-between;font-size:var(--fs-secondary);margin-bottom:var(--s1);}
  .bomrow .bh b{color:var(--text);font-weight:400;} .bomrow .bh span{color:var(--text-2);}
  .bommeter{height:6px;background:var(--line);border-radius:var(--r-pill);overflow:hidden;position:relative;}
  .bommeter .rec{position:absolute;left:0;top:0;bottom:0;background:var(--good);}
  .bommeter .ord{position:absolute;left:0;top:0;bottom:0;background:var(--accent);opacity:.55;}
  .bommeter .lim{position:absolute;top:-2px;bottom:-2px;width:2px;background:var(--text);}
  .bommeter.over .ord{background:var(--bad);opacity:.7;}

  /* The faces: Bebas Neue for the titles, the wordmark and the big figures
     (one weight, never bolded); Roboto Slab for everything else — the menu,
     tables, fields, buttons, pills and all the text. */
  .brand,.lbrand,.top h1,.lh,.kpi .v,.phead .pt,.phead .pbig .n,.ptile .stat,.dh,.gensuccess h2{
    font-family:var(--font-display);font-weight:400;letter-spacing:.02em;text-transform:none;}
  .brand{font-size:var(--fs-d4);line-height:1;letter-spacing:.14em;}
  .lbrand{font-size:var(--fs-d4);letter-spacing:.14em;}
  .top h1{font-size:var(--fs-d3);line-height:1;}
  .lh{font-size:var(--fs-d1);line-height:.95;}
  .kpi .v{font-size:var(--fs-d2);line-height:1;letter-spacing:.01em;}
  .phead .pt{font-size:var(--fs-d2);line-height:1;} .phead .pbig .n{font-size:var(--fs-d2);line-height:1;}
  .ptile .stat{font-size:var(--fs-d3);line-height:1;} .dh{font-size:var(--fs-d3);line-height:1;}
  table,th,td,button,input,select,textarea,.nav,.nsec,.bdg,.pill,.chip,.q .tag,.links .lt,.hats,.hatlbl,.viewsel,
  .frm label,.lfield,.lin,.lbtn,.proj,.me,.sechd,.crumb,.ovrtag,.sigwait,.schbtn,.abtn,.backbtn,.att .fs,.feed .ago{
    font-family:var(--font-ui);}
  .ref,.dref,.acc .em{font-family:var(--mono);}
  @media(max-width:900px){.top h1{font-size:var(--fs-d4);}.kpi .v{font-size:var(--fs-d3);}.lh{font-size:var(--fs-d2);}.brand{font-size:var(--fs-title);}}

  /* Buttons the live screens draw in tables and cards: pills, the main one sand. */
  td button,.main .card button:not([class]),.dpane button:not([class]){display:inline-flex;align-items:center;gap:var(--s1);min-height:32px;margin:2px 0;
    border-radius:var(--r-pill);padding:0 var(--s3);font-size:var(--fs-secondary);font-weight:400;border:1px solid var(--line-strong);background:none;color:var(--text);white-space:nowrap;}
  td button:hover,.main .card button:not([class]):hover,.dpane button:not([class]):hover{background:var(--surface-2);}
  td button.prim{background:var(--accent);color:var(--on-accent);border-color:transparent;}
  td button.ovr{border-color:var(--accent);color:var(--accent-text);background:none;}
  td button.warn{border-color:color-mix(in srgb,var(--bad-ink) 50%,transparent);color:var(--bad-ink);}
  @media (pointer:coarse){td button{min-height:44px;}}
  td .ic svg,td svg.ic{display:inline-block;color:var(--text-2);}
  /* Grid columns may shrink below their content; a wide table scrolls inside its card. */
  .app > *,.cols > *,.main,.wrap,.side,.nav{min-width:0;}
  .card{overflow-x:auto;}

  @media (prefers-reduced-motion: no-preference){
    .nav a,.q,.feed li,.pcard,.ptile,.acc,.hats button,.actbar button,.abtn,.bell,.tbtn,tr.click td,.actrow{transition:background-color .18s ease-out,border-color .18s ease-out,color .18s ease-out;}
  }
  @media(max-width:900px){
    .cols{grid-template-columns:1fr;}.dgrid{grid-template-columns:1fr;}.pf{grid-template-columns:1fr;}.ptiles{grid-template-columns:1fr 1fr;}
    .lcard{grid-template-columns:1fr;}.lright{display:none;}
    /* The sidebar becomes a strip across the top that scrolls sideways on its own. */
    .app{grid-template-columns:1fr;}
    .side{position:sticky;top:0;z-index:10;height:auto;border-right:0;border-bottom:1px solid var(--line);border-radius:22px 22px 0 0;flex-direction:row;flex-wrap:wrap;align-items:center;}
    .brand{padding:var(--s3) var(--s4);}
    .proj{margin:var(--s2) var(--s4);flex:1 1 200px;padding:var(--s2) var(--s3);}
    .proj div[style]{display:none;}
    .nav{flex:1 1 100%;display:flex;gap:var(--s1);overflow-x:auto;padding:0 var(--s3) var(--s3);}
    .nav .nsec{display:none;}
    .nav a{flex:0 0 auto;white-space:nowrap;min-height:40px;}
    .nav a.on::before{left:50%;top:auto;bottom:3px;width:16px;height:3px;margin:0 0 0 -8px;}
    .me{display:none;}
    .top{border-radius:0;padding:var(--s5) var(--s4) var(--s4);min-height:0;}
    .top .topart{width:80%;opacity:.22;}
    .wrap{padding:var(--s4) var(--s4) var(--s6);}
    .kpis{grid-template-columns:repeat(2,minmax(0,1fr)) !important;row-gap:var(--s4);}
    .top{position:relative;}
    .kpis{grid-template-columns:repeat(2,minmax(0,1fr)) !important;}
    .hats{width:100%;margin-left:0;}
    .viewsel{max-width:none;flex:1 1 auto;min-height:44px;}
    #projSel{min-height:44px;}
    td button,.main .card button:not([class]),.dpane button:not([class]){min-height:44px;}
    .actrow{grid-template-columns:minmax(0,1fr) 48px;}
    .actrow .track,.actrow .abtn{grid-column:1 / -1;}
    .frm{grid-template-columns:1fr;} .frm .f.full{grid-column:auto;}
    .grow{grid-template-columns:120px 1fr;}
  }
  @media(max-width:600px){
    .side{border-radius:0;}
    .ptiles{grid-template-columns:1fr;}
    .detail{padding:0;} .dpane{width:100vw;border-radius:0;border:0;}
    .q{flex-wrap:wrap;} .q .btn{margin-left:auto;}
    table{display:block;overflow-x:auto;}
  }
</style>
</head>
<body>

<!-- ================= LOGIN ================= -->
<div class="login hide" id="login">
  <div class="loginart" aria-hidden="true">${BUILDING_ART}</div>
  <div class="lcard">
    <div class="lleft">
      <div class="lbrand"><span>AETRAA</span></div>
      <div class="ltag">Construction management platform</div>
      <div class="lh">Sign in</div>
      <div class="lp">Everyone signs in with their <b>email address</b>. Your email decides which dashboards you see — one person can hold several functions.</div>
      <label class="lfield">Email address</label>
      <input class="lin" id="email" placeholder="you@company.ae" autocomplete="off">
      <label class="lfield">Password</label>
      <input class="lin" type="password" id="pw" placeholder="••••••••" value="demo">
      <button class="lbtn" id="loginBtn">Sign in</button>
      <div class="lnote">Prototype — pick a sample account on the right to sign in instantly. No real password needed.</div>
    </div>
    <div class="lright">
      <h3>Sample accounts</h3>
      <p>Notice the last two: one email, several functions. That is the point.</p>
      <div id="accList"></div>
    </div>
  </div>
</div>

<!-- ================= APP ================= -->
<div class="app" id="app">
  <aside class="side">
    <div class="brand"><span class="dot"></span>AETRAA</div>
    <div class="proj">Project
      <b id="projName">Sample project</b>
      <select id="projSel">
        <option>Sample project</option>
        <option>Commercial Tower — JBBC</option>
        <option>Villa Compound — Project three</option>
      </select>
      <div id="projNote" style="display:flex;gap:6px;align-items:center;font-size:var(--fs-label);line-height:var(--lh-label);color:var(--text-2);margin-top:var(--s2)">${icon('lock', 12)} Projects are set up by AETRAA</div>
    </div>
    <nav class="nav" id="nav"></nav>
    <div class="me">
      <div class="av" id="meAv">AM</div>
      <div><b id="meName">—</b><span id="meRole">—</span></div>
      <span class="out" id="logout">Sign out</span>
    </div>
  </aside>

  <div class="main">
    <div class="top">
      <div>
        <h1 id="pageTitle">Dashboard</h1>
        <div class="sub" id="projSub">Dubai, UAE · Week 37 · 7–13 Sep 2026</div>
      </div>
      <div class="hats" id="hats"></div>
      <button class="tbtn" id="themeBtn" type="button" title="Light / dark" aria-label="Switch between light and dark">${icon('contrast', 18)}</button>
      <div class="bell" role="button" tabindex="0" aria-label="Notifications">${icon('bell', 18)}<b id="bellN">6</b></div>
      <div class="topart" aria-hidden="true">${BUILDING_ART}</div>
    </div>
    <div class="wrap">
      <div class="rolebar" id="rolebar"></div>
      <div class="kpis" id="kpis"></div>
      <div class="cols">
        <div id="leftcol"></div>
        <div id="rightcol"></div>
      </div>
    </div>
  </div>
</div>

<!-- ================= DETAIL ================= -->
<div class="detail hide" id="detail"><div class="dpane" id="dpane"></div></div>

<script>
/* =========================================================================
   1.  IDENTITY — everything is keyed on EMAIL.
       One email can carry several functions (roles). The topbar shows a
       "hat" switch only for the functions that email holds.
   ========================================================================= */
var ACCOUNTS = {
  'ajay@aetraa.ae':      {name:'Ajay Mattappilly', av:'AM', title:'Founder / Director', roles:['principal']},
  'said.pm@site.ae':     {name:'M. Said',          av:'MS', title:'Project Manager',    roles:['pm']},
  'menon.plan@site.ae':  {name:'V. Menon',         av:'VM', title:'Planning Engineer',  roles:['planning']},
  'george.dc@site.ae':   {name:'P. George',        av:'PG', title:'Document Control + Design',
                          roles:['dc','design'], multi:true},
  'farouk.hse@site.ae':  {name:'A. Farouk',        av:'AF', title:'HSE Officer',        roles:['hse']},
  'consultant@dec.ae':   {name:'DEC — Consultant', av:'DC', title:'Engineer (Consultant)',roles:['consultant']},
  // --- the two that prove the point: one login, several functions ---
  'rahman@site.ae':      {name:'S. Rahman',        av:'SR', title:'QA/QC + Site Engineer (Civil)',
                          roles:['qaqc','site'], multi:true, siteDiscipline:'Civil'},
  'imran.site@site.ae':  {name:'A. Imran',         av:'AI', title:'Site Engineer (MEP)',
                          roles:['site'], siteDiscipline:'MEP'},
  'das.site@site.ae':    {name:'R. Das',           av:'RD', title:'Site Engineer (Architecture)',
                          roles:['site'], siteDiscipline:'Architecture'},
  'nair@site.ae':        {name:'K. Nair',          av:'KN', title:'Commercial + Procurement + Finance',
                          roles:['commercial','procurement','finance'], multi:true},
};

/* function registry: label + sidebar nav for each discipline */
var ROLE = {
  principal:  {label:'Principal',        icon:'★', page:'Principal dashboard'},
  pm:         {label:'Project Manager',  icon:'▦', page:'Project Manager'},
  planning:   {label:'Planning',         icon:'◷', page:'Planning'},
  site:       {label:'Site Engineer',    icon:'⛏', page:'Site Engineer'},
  dc:         {label:'Document Control', icon:'▤', page:'Document Controller'},
  design:     {label:'Design & Documents', icon:'▥', page:'Design & Documents'},
  qaqc:       {label:'QA / QC',          icon:'✓', page:'QA / QC'},
  hse:        {label:'HSE',              icon:'◈', page:'HSE'},
  commercial: {label:'Contracts & Commercial', icon:'₳', page:'Contracts & Commercial'},
  procurement:{label:'Procurement',      icon:'🛒', page:'Procurement'},
  finance:    {label:'Finance',          icon:'▮', page:'Finance'},
  contracts:  {label:'Contracts',        icon:'⚖', page:'Contracts & Claims'},
  subcon:     {label:'Subcontractors',   icon:'⧉', page:'Subcontractor coord.'},
  consultant: {label:'Consultant',       icon:'◉', page:'Consultant / Client'},
  team:       {label:'Team & Access',     icon:'⧉', page:'Team & Access'},
};

/* ---- access matrix: who can open which dashboards, and at what level ----
   full = view + edit their folder; read = view (and export/report) only. */
var ALLDASH=['principal','pm','planning','site','dc','design','qaqc','hse','commercial','procurement','finance','subcon','consultant','team'];
var noTeam=function(e){return e[0]!=='team';};                                   // team & access is Principal/PM only
var ACCESS={
  principal: ALLDASH.map(function(r){return [r,'full'];}),                       // owner — everything, incl. assigning people
  pm:        ALLDASH.map(function(r){return [r,'full'];}),                       // PM — everything, incl. assigning people
  dc:        ALLDASH.map(function(r){return [r, r==='dc'?'full':'read'];}).filter(noTeam),      // doc control — see all + reports
  commercial:ALLDASH.map(function(r){return [r, r==='commercial'?'full':'read'];}).filter(noTeam), // contracts/commercial — read all, own full
  design:    [['design','full']],                                               // design — its own tab
  site:      [['site','full'],['design','read']],                               // discipline — own tab + read design
  planning:  [['planning','full'],['design','read'],['site','read']],           // planning — read design + read discipline
  qaqc:      [['qaqc','full']],
  hse:       [['hse','full']],
  procurement:[['procurement','full']],
  finance:   [['finance','full']],
  subcon:    [['subcon','full']],
  consultant:[['consultant','full']],
};
/* THE SERVER'S ANSWER WINS.
 *
 * The matrix above is what the platform ships with, and it is still here for
 * the design preview, which has no server. But a real project's roles belong to
 * its Principal — he may have given the Supervisor the Site dashboard, or added
 * a role that never existed here. So when the server has resolved the access
 * for the signed-in person from THAT project's own catalogue, that is the
 * answer, and this table is not consulted at all.
 *
 * Keeping both in step by hand is what would go wrong otherwise: the sidebar
 * would offer a dashboard the API then refuses, or hide one the person holds. */
function accessFor(email){
  if (typeof ME !== 'undefined' && ME && Array.isArray(ME.access) && ME.access.length
      && email === ME.email) return ME.access;
  var acc=ACCOUNTS[email]||{}; var map={};
  (acc.roles||[]).forEach(function(role){(ACCESS[role]||[[role,'full']]).forEach(function(e){ if(map[e[0]]!=='full') map[e[0]]=e[1]; });});
  var full=[],read=[];
  ALLDASH.forEach(function(r){ if(map[r]==='full') full.push([r,'full']); else if(map[r]==='read') read.push([r,'read']); });
  return full.concat(read);
}
function levelOf(views,r){for(var i=0;i<views.length;i++)if(views[i][0]===r)return views[i][1];return 'full';}

/* sidebar per function — [section, [ [icon,label,badge], ... ] ] */
var NAV = {
  principal:[
    ['PORTFOLIO',[['★','All projects','on'],['▦','Consolidated progress',''],['⚑','Decisions to me','4']]],
    ['MONEY',[['₳','Cashflow / IPC',''],['⚖','Claims & variations',''],['₳','Payment terms',''],['⚖','Contract obligations','']]],
    ['ASSURANCE',[['✓','Quality (portfolio)',''],['◈','Safety (portfolio)','']]],
    ['PEOPLE',[['⧉','Team & access',''],['▤','Reports',''],['▧','Templates','']]],
  ],
  pm:[
    ['MAIN',[['▦','Dashboard','on'],['▤','Programme',''],['◷','Look-ahead',''],['?','Ask the project','']]],
    ['TECHNICAL',[['▥','Drawings',''],['✎','RFIs','7'],['⇪','Submittals','3'],['✓','Inspections','5'],['⚠','NCRs','2']]],
    ['CONTRACTUAL',[['✉','Letters',''],['✎','Draft a letter',''],['☰','Minutes',''],['⚖','Variations','4'],['⚖','Delays & EOT',''],['⚖','Contract obligations',''],['₳','IPC / payments','']]],
    ['SITE',[['◈','HSE',''],['⧉','Subcontractors','']]],
    ['SETUP',[['▧','Templates','']]],
  ],
  planning:[
    ['MAIN',[['◷','Dashboard','on'],['▤','Baseline programme',''],['◑','Progress update',''],['◷','3-week look-ahead','']]],
    ['ANALYSIS',[['◭','Delay & EoT','2'],['⤢','S-curve / earned value',''],['⚑','Critical path','']]],
    ['REPORTS',[['▤','Weekly report',''],['▤','Monthly report','']]],
  ],
  site:[
    ['MAIN',[['⛏','Dashboard','on'],['✎','Daily diary',''],['👷','Manpower & plant','']]],
    ['WORK',[['✓','Raise inspection (WIR)','3'],['▥','Drawings on site',''],['✎','Raise RFI',''],['⚠','NCRs on me','1']]],
    ['MATERIAL',[['🛒','Material requests',''],['⇥','GRN — receive','']]],
  ],
  design:[
    ['REGISTERS',[['▥','Dashboard','on'],['▥','Drawing register',''],['⇪','Submittals','3'],['◮','Authority approvals','1'],['▤','Specification index',''],['▤','Knowledge base','']]],
    ['DRAWINGS',[['▥','Tender',''],['▥','IFC — current',''],['▥','Shop drawings','2'],['◭','Tender ↔ IFC deviations','']]],
    ['OUTPUT',[['⏱','Generate schedule',''],['⏱','Schedules',''],['⇪','Transmittals','']]],
  ],
  dc:[
    ['MAIN',[['▤','Dashboard','on'],['✎','Correspondence diary','9']]],
    ['REGISTERS',[['✉','Incoming / outgoing',''],['▥','Drawing register',''],['⇪','Submittal register','3'],['✎','RFI register','7'],['⚖','Variation register','']]],
    ['CONTROL',[['⇪','Transmittals',''],['◮','Distribution matrix',''],['▧','Templates',''],['⇩','Past registers','']]],
  ],
  qaqc:[
    ['MAIN',[['✓','Dashboard','on'],['✓','Inspections (WIR/MIR)','5']]],
    ['QUALITY',[['⚠','NCR register','2'],['🧪','Material approvals','3'],['🧫','Test records',''],['▤','ITP / checklists','']]],
    ['AUDIT',[['◉','Quality audits',''],['▤','QA reports','']]],
  ],
  hse:[
    ['MAIN',[['◈','Dashboard','on'],['✎','Safety inspection',''],['⚠','Observations / near-miss','4']]],
    ['RECORDS',[['◈','Permits to work','3'],['🚑','Incidents',''],['🎓','Toolbox / induction',''],['◮','Authority safety','']]],
    ['REPORTS',[['▤','HSE statistics',''],['▤','Monthly HSE','']]],
  ],
  commercial:[
    ['MAIN',[['₳','Dashboard','on']]],
    ['COMMERCIAL',[['▤','BOQ / cost plan',''],['▤','Bill of Materials','1'],['₳','IPC / payments',''],['⚖','Variations','4']]],
    ['CONTRACT',[['✉','Contractual letters','3'],['✎','Draft a letter',''],['₳','Payment terms',''],['⚖','Contract obligations',''],['◭','Tender ↔ IFC deviations',''],['⚖','Claims & EoT','2'],['◭','Cost value reconciliation',''],['⇥','Subcontractor valuations','2']]],
  ],
  procurement:[
    ['MAIN',[['🛒','Dashboard','on'],['▤','Bill of Materials','1'],['🛒','Material requests','5'],['⌸','Purchase orders (LPO)','']]],
    ['SUPPLY',[['⇥','Deliveries / GRN','3'],['⏱','Procurement log',''],['⧉','Suppliers','']]],
  ],
  finance:[
    ['MAIN',[['▮','Dashboard','on'],['₳','Payments in (IPC)',''],['⌸','Payments out','']]],
    ['LEDGER',[['⇥','GRN → invoice match','3'],['▤','Supplier invoices',''],['◭','Cashflow','']]],
  ],
  contracts:[
    ['MAIN',[['⚖','Dashboard','on'],['✉','Contractual letters','3'],['⚖','Claims & EoT','2']]],
    ['REGISTERS',[['⚖','Variation register',''],['◭','Notices & obligations',''],['▤','Contract documents','']]],
  ],
  subcon:[
    ['MAIN',[['⧉','Dashboard','on'],['⧉','Subcontractors',''],['⇥','Sub valuations','2']]],
    ['MANAGE',[['✓','Sub inspections',''],['◈','Sub HSE compliance',''],['▤','Sub programme','']]],
  ],
  consultant:[
    ['MAIN',[['◉','Dashboard','on'],['✎','RFIs to answer','4'],['⇪','Submittals to review','3']]],
    ['APPROVE',[['▥','Drawing approvals',''],['✓','Witness inspections','2'],['₳','Certify IPC',''],['⚖','Variations','']]],
  ],
  team:[
    ['ADMIN',[['⧉','Team & access','on'],['✉','Invite / assign','']]],
    ['SETTINGS',[['▤','Projects (fixed)',''],['◮','Roles & permissions','']]],
  ],
};

/* =========================================================================
   2.  HELPERS
   ========================================================================= */
// A figure card: its label and icon tile on top, the number below.
function kpiSym(l){
  l=String(l||'').toLowerCase();
  if(/overdue|ncr|late|over bom|missing/.test(l)) return '⚠';
  if(/sign|verified|inspection|closed|clean/.test(l)) return '✓';
  if(/progress|%|complete|activit/.test(l)) return '◑';
  if(/certif|applica|aed|payment|ipc|money|cost/.test(l)) return '₳';
  if(/variation|claim|eot|delay/.test(l)) return '⚖';
  if(/drawing/.test(l)) return '▥';
  if(/permit|observ|hse|safe/.test(l)) return '◈';
  if(/incident/.test(l)) return '🚑';
  if(/bom|deliver|request|order/.test(l)) return '🛒';
  if(/people|team|function/.test(l)) return '⧉';
  if(/project/.test(l)) return '★';
  if(/letter|record|document|diary/.test(l)) return '▤';
  return '▦';
}
function kpi(v,l,c){return '<div class="kpi '+(c||'')+'"><div class="kh"><span class="l">'+l+'</span><span class="ki">'+ico(kpiSym(l))+'</span></div><div class="v">'+v+'</div></div>';}
// Four figures at the top: the first three a role lists, and its overdue count
// when it has one further down; otherwise the first four.
function fourKpis(k){
  if(!k || k.length<=4) return k;
  var od=-1; k.forEach(function(x,i){ if(od<0 && /overdue/i.test(x[1])) od=i; });
  return od>=3 ? k.slice(0,3).concat([k[od]]) : k.slice(0,4);
}
function bars(rows){return rows.map(function(r){return '<div class="bar"><div class="nm">'+r[0]+'</div><div class="track"><div class="fill" style="width:'+r[1]+'%;background:'+(r[2]||'var(--blue)')+'"></div></div><div class="pc">'+r[1]+'%</div></div>';}).join('');}
/* queue item — clickable, opens the record's detail screen */
function q(ref,tag,cls,ti,mt,due,sign){
  var open = ref ? ' data-open="'+ref+'"' : '';
  return '<div class="q"'+open+'><div class="tag '+(cls||'')+'">'+tag+'</div><div class="bd"><div class="ti">'+ti+'</div><div class="mt">'+mt+'</div>'+(due?'<div class="due">'+due+'</div>':'')+'</div>'+
    (sign?'<button class="btn sign" data-open="'+ref+'">Approve &amp; sign</button>':'<span class="chev">›</span>')+'</div>';
}
function feed(items){return '<ul class="feed">'+items.map(function(i){
  var open = i[4]?' data-open="'+i[4]+'"':'';
  return '<li'+open+'><span class="dot '+i[0]+'"></span><span><span class="t">'+i[1]+'</span> <span class="w">'+i[2]+'</span></span><span class="ago">'+i[3]+'</span></li>';
}).join('')+'</ul>';}
function row(ref,cells){return '<tr class="'+(ref?'click':'')+'"'+(ref?' data-open="'+ref+'"':'')+'>'+cells.map(function(c){return '<td>'+c+'</td>';}).join('')+'</tr>';}
function pill(t,c){return '<span class="pill '+c+'">'+t+'</span>';}
/* project card on the principal dashboard — clickable */
function pcard(id,name,loc,pct,fin,chips){
  return '<div class="pcard" data-proj="'+id+'"><div class="pn">'+name+'</div><div class="pl">'+loc+'</div>'+
    '<div class="track2"><div class="fill" style="width:'+pct+'%"></div></div>'+
    '<div class="pr"><span>'+pct+'% complete</span><span>Finish <b>'+fin+'</b></span></div>'+
    '<div class="chips">'+chips.map(function(c){return '<span class="chip '+(c[1]||'')+'">'+c[0]+'</span>';}).join('')+'</div></div>';
}

/* =========================================================================
   3.  DASHBOARDS — one per function
       Each returns { kpis, left, right }.  gridCols sets KPI columns.
   ========================================================================= */
/* =========================================================================
   3a.  DESIGN & DOCUMENTS — drawing / submittal / authority registers,
        each showing action-required date, status and delay, with a one-click
        schedule generator. Authorities are project-configurable.
   ========================================================================= */
var TODAY='2026-09-13';
function daysLate(iso){return Math.round((Date.parse(TODAY)-Date.parse(iso))/86400000);}
function fmtd(iso){if(!iso)return '—';var m=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];var d=new Date(iso+'T00:00:00Z');return d.getUTCDate()+' '+m[d.getUTCMonth()];}
function isLate(x){return x.due && daysLate(x.due)>0 && !/Approved|Current|Reference|Issued|NOC issued/.test(x.st);}

var REG = {
 drawings:{ title:'Drawing register', cols:['Ref','Title','Type / Rev','Action by','Status'],
   rows:[
    {ref:'AR-412',title:'4th floor RCP',type:'Shop · Rev C',sub:'2026-09-13',due:'2026-09-18',st:'With consultant',cls:'wp'},
    {ref:'SUB-074',title:'Facade brackets',type:'Shop · Rev A',sub:'2026-09-05',due:'2026-09-12',st:'Revise & resubmit',cls:'late'},
    {ref:'ST-208',title:'L4 slab rebar',type:'IFC · Rev B',sub:'2026-08-20',due:'2026-08-25',st:'Current',cls:'ok'},
    {ref:'AR-208',title:'Staircase details',type:'IFC · Rev C',sub:'2026-09-01',due:null,st:'Current',cls:'ok'},
    {ref:'AR-355',title:'Coral pond GA',type:'IFC · Rev A',sub:'2026-09-05',due:null,st:'Current',cls:'ok'},
    {ref:'TN-101',title:'Tender GA set',type:'Tender',sub:null,due:null,st:'Reference',cls:'wp'},
   ]},
 submittals:{ title:'Submittal register', cols:['Ref','Item','Type','Action by','Status'],
   rows:[
    {ref:'SUB-076',title:'External paint',type:'Material',sub:'2026-09-10',due:'2026-09-16',st:'Under review',cls:'wp'},
    {ref:'MAR-046',title:'External paint — spec',type:'Material',sub:'2026-09-12',due:'2026-09-17',st:'PM to endorse',cls:'warn'},
    {ref:'SUB-078',title:'L4 formwork drawings',type:'Technical',sub:'2026-09-13',due:'2026-09-18',st:'PM to approve',cls:'warn'},
    {ref:'SUB-070',title:'Method statement — concrete',type:'Technical',sub:'2026-08-28',due:'2026-09-04',st:'Approved',cls:'ok'},
    {ref:'MAR-041',title:'Rebar mill certs',type:'Material',sub:'2026-08-15',due:'2026-08-22',st:'Approved',cls:'ok'},
   ]},
 authority:{ title:'Authority approvals', authority:true, cols:['Authority','Ref','Action by','Status'],
   rows:[
    {ref:'DEWA-SUB',title:'DEWA',type:'DEWA — substation',sub:'2026-08-01',due:'2026-09-10',st:'NOC awaited',cls:'late'},
    {ref:'DCD-DES',title:'Civil Defence',type:'DCD — design',sub:'2026-07-15',due:'2026-08-30',st:'Approved',cls:'ok'},
    {ref:'DM-DRN',title:'Municipality',type:'DM — drainage',sub:'2026-08-20',due:'2026-09-20',st:'Under review',cls:'wp'},
    {ref:'RTA-NOC',title:'RTA',type:'RTA — access NOC',sub:'2026-09-01',due:'2026-09-25',st:'Submitted',cls:'wp'},
   ]},
};
REG.drawings.note='Each row shows the action-required date and status; overdue items are flagged red. Filter by Tender · IFC · Shop; only the latest approved revision shows on site.';
REG.submittals.note='Material and technical submittals. Each shows the action-required date, status and delay; overdue flagged red.';
REG.authority.note='Each row shows the action-required date and status; overdue flagged red. Authorities are configured per project by the design team — add whichever apply to the location and emirate.';

/* ---- Contracts & Commercial registers ---- */
REG.boq={ title:'Bill of Quantities (priced)', sched:false,
  cols:['Ref','Section','BOQ value','Billed','Status'],
  csvCols:['Ref','Section','BOQ value AED','Billed %','Status'],
  note:'The priced contract bill — value certified against each section. Feeds the IPC valuation and the cost-value reconciliation.',
  rows:[
    {ref:'BOQ-A',title:'Preliminaries',val:'3.20m',billed:'62%',st:'On track',cls:'ok'},
    {ref:'BOQ-C',title:'Concrete works',val:'18.40m',billed:'71%',st:'On track',cls:'ok'},
    {ref:'BOQ-M',title:'Masonry & blockwork',val:'4.10m',billed:'48%',st:'On track',cls:'ok'},
    {ref:'BOQ-R',title:'Electrical (R)',val:'9.80m',billed:'22%',st:'Behind',cls:'warn'},
    {ref:'BOQ-F',title:'Finishes',val:'12.60m',billed:'8%',st:'Not started',cls:'wp'},
  ],
  cell:function(x){return ['<span class="ref">'+x.ref+'</span>',x.title,'AED '+x.val,x.billed,pill(x.st,x.cls)];},
  csv:function(x){return [x.ref,x.title,x.val,x.billed,x.st];} };

REG.ipc={ title:'Payment certificates (IPA / IPC)', sched:true,
  cols:['Ref','Period','Amount','Payment by','Status'],
  csvCols:['Ref','Period','Amount AED','Payment by','Status'],
  note:'Contractor application (IPA) → Engineer certifies (28 days) → client pays (56 days). Generate the payment schedule to see the cashflow.',
  rows:[
    {ref:'IPA-05',title:'September application',val:'4.41m',sub:'2026-09-12',due:'2026-11-07',st:'Certified — client to pay',cls:'wp'},
    {ref:'IPC-04',title:'August',val:'3.70m',sub:'2026-08-12',due:'2026-10-05',st:'Paid',cls:'ok'},
    {ref:'IPC-03',title:'July',val:'3.10m',sub:'2026-07-12',due:'2026-09-05',st:'Paid',cls:'ok'},
  ],
  cell:function(x){return ['<span class="ref">'+x.ref+'</span>',x.title,'AED '+x.val,dueCell(x),pill(x.st,x.cls)];},
  csv:function(x){return [x.ref,x.title,x.val,x.due||'',x.st];} };

REG.variations={ title:'Variation register', sched:false,
  cols:['Ref','Description','Cost','Time','Status'],
  csvCols:['Ref','Description','Cost AED','Time','Status'],
  note:'Every variation, priced with its time effect. Approved VOs roll into the IPC; open ones may carry an EoT claim.',
  rows:[
    {ref:'VO-07',title:'Coral pond civil',val:'214,000',time:'+12 d',st:'PM review',cls:'wp'},
    {ref:'VO-06',title:'LPG line diversion',val:'96,500',time:'+4 d',st:'With client',cls:'warn'},
    {ref:'VO-05',title:'Boundary wall extra',val:'310,000',time:'—',st:'Approved',cls:'ok'},
    {ref:'VO-04',title:'LED screen structure',val:'480,000',time:'+8 d',st:'Pricing',cls:'wp'},
  ],
  cell:function(x){return ['<span class="ref">'+x.ref+'</span>',x.title,'AED '+x.val,x.time,pill(x.st,x.cls)];},
  csv:function(x){return [x.ref,x.title,x.val,x.time,x.st];} };

/* ---- QA/QC registers ---- */
REG.inspections={ title:'Inspection requests (WIR / MIR)', sched:true,
  cols:['Ref','Location','Type','Action by','Status'],
  csvCols:['Ref','Location','Type','Action by','Status'],
  note:'Work and material inspection requests, raised in the project WIR format. A failed inspection auto-raises an NCR and notifies site.',
  rows:[
    {ref:'WIR-221',title:'L4 slab — pre-pour',type:'Civil',sub:'2026-09-13',due:'2026-09-14',st:'Awaiting',cls:'wp'},
    {ref:'WIR-222',title:'L2 blockwork',type:'Civil',sub:'2026-09-13',due:'2026-09-15',st:'Awaiting',cls:'wp'},
    {ref:'MIR-088',title:'FCU batch 12',type:'Material',sub:'2026-09-11',due:null,st:'Approved',cls:'ok'},
    {ref:'WIR-219',title:'Podium 3 waterproofing',type:'Civil',sub:'2026-09-11',due:'2026-09-11',st:'Failed',cls:'late'},
  ],
  cell:function(x){return ['<span class="ref">'+x.ref+'</span>',x.title,x.type,dueCell(x),pill(x.st,x.cls)];},
  csv:function(x){return [x.ref,x.title,x.type,x.due||'',x.st];} };
REG.ncr={ title:'NCR register', sched:false,
  cols:['Ref','Issue','Age','Status'], csvCols:['Ref','Issue','Age','Status'],
  note:'Non-conformances. A failed inspection raises one automatically; close-out needs QA verification.',
  rows:[
    {ref:'NCR-014',title:'Blockwork alignment, L3 Zone C',age:'5 d',st:'Open',cls:'late'},
    {ref:'NCR-013',title:'Waterproofing lap, Podium 3',age:'9 d',st:'Reinspect',cls:'wp'},
  ],
  cell:function(x){return ['<span class="ref">'+x.ref+'</span>',x.title,x.age,pill(x.st,x.cls)];},
  csv:function(x){return [x.ref,x.title,x.age,x.st];} };
REG.matapp={ title:'Material approvals', sched:true,
  cols:['Ref','Material','Spec','Action by','Status'], csvCols:['Ref','Material','Spec','Action by','Status'],
  note:'Material approval requests checked against spec, then submitted to the consultant for approval.',
  rows:[
    {ref:'MAR-046',title:'External paint (Spot Lite)',type:'09 91 00',sub:'2026-09-12',due:'2026-09-17',st:'PM to endorse',cls:'warn'},
    {ref:'MAR-041',title:'Rebar mill certs',type:'03 21 00',sub:'2026-08-15',due:null,st:'Approved',cls:'ok'},
  ],
  cell:function(x){return ['<span class="ref">'+x.ref+'</span>',x.title,x.type,dueCell(x),pill(x.st,x.cls)];},
  csv:function(x){return [x.ref,x.title,x.type,x.due||'',x.st];} };

/* ---- HSE registers ---- */
REG.permits={ title:'Permits to work', sched:true,
  cols:['Ref','Activity','Zone','Valid until','Status'], csvCols:['Ref','Activity','Zone','Valid until','Status'],
  note:'Live permits to work. Each expires automatically at its end time and must be closed out; a new permit is raised in the project format with attachments.',
  rows:[
    {ref:'PTW-209',title:'Hot work — welding',type:'Level 2',sub:'2026-09-13',due:'2026-09-14',st:'Awaiting HSE sign',cls:'warn'},
    {ref:'PTW-208',title:'Hot work — welding',type:'Level 4',sub:'2026-09-13',due:'2026-09-13',st:'Expires today 17:00',cls:'warn'},
    {ref:'PTW-207',title:'Confined space — sump',type:'Podium',sub:'2026-09-12',due:'2026-09-16',st:'Valid',cls:'ok'},
    {ref:'PTW-206',title:'Lifting — crane',type:'Level 4',sub:'2026-09-12',due:'2026-09-18',st:'Valid',cls:'ok'},
  ],
  cell:function(x){return ['<span class="ref">'+x.ref+'</span>',x.title,x.type,dueCell(x),pill(x.st,x.cls)];},
  csv:function(x){return [x.ref,x.title,x.type,x.due||'',x.st];} };
REG.certs={ title:'Certificates & permits — backup', sched:true,
  cols:['Ref','Certificate','Issued by','Expires','Status'], csvCols:['Ref','Certificate','Issued by','Expires','Status'],
  note:'Third-party certificates, operator licences and inspection tags — with the certificate PDF attached to each. Expiring items are flagged so nothing lapses on site.',
  rows:[
    {ref:'CERT-LIFT-01',title:'Lifting gear — chains & slings',type:'ThirdParty Cert Co',sub:'2026-02-01',due:'2026-08-30',st:'EXPIRED',cls:'late'},
    {ref:'CERT-SCAF-04',title:'Scaffold inspection tag',type:'Scaffold inspector',sub:'2026-09-07',due:'2026-09-14',st:'Expiring',cls:'warn'},
    {ref:'CERT-CRANE-02',title:'Mobile crane — 3rd party',type:'ThirdParty Cert Co',sub:'2026-07-15',due:'2026-10-15',st:'Valid',cls:'ok'},
    {ref:'CERT-OPR-11',title:'Crane operator licence',type:'RTA',sub:'2026-01-10',due:'2026-09-30',st:'Valid',cls:'ok'},
    {ref:'CERT-FA-03',title:'First-aider certificate',type:'DHA',sub:'2026-01-01',due:'2027-01-01',st:'Valid',cls:'ok'},
  ],
  cell:function(x){return ['<span class="ref">'+x.ref+'</span>',x.title,x.type,dueCell(x),pill(x.st,x.cls)];},
  csv:function(x){return [x.ref,x.title,x.type,x.due||'',x.st];} };
REG.hseobs={ title:'Observations & near-miss', sched:false,
  cols:['Ref','Finding','Risk','Status'], csvCols:['Ref','Finding','Risk','Status'],
  note:'Safety observations and near-misses. High-risk items stop the work until closed with photo evidence.',
  rows:[
    {ref:'OBS-051',title:'Edge protection missing — L2',risk:'High',st:'Open',cls:'late'},
    {ref:'NM-009',title:'Near-miss — dropped tool',risk:'Medium',st:'Investigating',cls:'warn'},
    {ref:'OBS-050',title:'Housekeeping — L1 corridor',risk:'Low',st:'Assigned',cls:'wp'},
  ],
  cell:function(x){return ['<span class="ref">'+x.ref+'</span>',x.title,x.risk,pill(x.st,x.cls)];},
  csv:function(x){return [x.ref,x.title,x.risk,x.st];} };

REG.letters={ title:'Contractual letters', sched:true,
  cols:['Ref','Subject','Type','Action by','Status'],
  csvCols:['Ref','Subject','Type','Action by','Status'],
  note:'Incoming and outgoing contractual correspondence. Notices are date-critical — overdue actions are flagged red.',
  rows:[
    {ref:'LTR-092',title:'EoT notice — coral pond',type:'Notice (out)',sub:'2026-09-13',due:'2026-09-19',st:'Director to sign',cls:'warn'},
    {ref:'LTR-091',title:'Delay in IFC — facade',type:'Notice (out)',sub:'2026-09-10',due:'2026-09-16',st:'Draft',cls:'wp'},
    {ref:'LTR-090',title:'Client — facade colour approval',type:'Incoming',sub:'2026-09-11',due:null,st:'Logged',cls:'ok'},
    {ref:'LTR-089',title:'Reply — client LD warning',type:'Response',sub:'2026-09-05',due:null,st:'Issued',cls:'ok'},
  ],
  cell:function(x){return ['<span class="ref">'+x.ref+'</span>',x.title,x.type,dueCell(x),pill(x.st,x.cls)];},
  csv:function(x){return [x.ref,x.title,x.type,x.due||'',x.st];} };

function dueCell(x){var late=isLate(x);return x.due?(fmtd(x.due)+(late?' <b style="color:var(--bad)">· '+daysLate(x.due)+'d late</b>':'')):'—';}
function regTable(kind){
  var r=REG[kind];
  var btns='<button class="schbtn" data-xls="'+kind+'">${icon('download', 14)} Excel</button>'+
    (r.sched===false?'':'<button class="schbtn" data-sched="'+kind+'">${icon('timer', 14)} Generate schedule</button>')+
    (r.authority?'<button class="schbtn add" data-open="AUTH-NEW">+ Add authority</button>':'');
  var head='<div class="card"><h2>'+r.title+' <span class="r">'+btns+'</span></h2>';
  var cols=r.cols.map(function(c){return '<th>'+c+'</th>';}).join('');
  var body=r.rows.map(function(x){
    var cells = r.cell ? r.cell(x)
      : (r.authority
        ? ['<b>'+x.title+'</b><div class="mini" style="margin:2px 0 0">'+x.type+'</div>','<span class="ref">'+x.ref+'</span>',dueCell(x),pill(x.st,x.cls)]
        : ['<span class="ref">'+x.ref+'</span>',x.title,x.type,dueCell(x),pill(x.st,x.cls)]);
    return row(x.ref,cells);
  }).join('');
  return head+'<table><tr>'+cols+'</tr>'+body+'</table><div class="mini">'+
    (r.note||'Each row shows the action-required date and status; overdue items are flagged red.')+'</div></div>';
}

/* one-click schedule generator — builds a Gantt from any register */
function openSchedule(kind){
  var r=REG[kind];
  var rows=r.rows.filter(function(x){return x.sub||x.due;});
  var start=Date.parse('2026-07-01'), end=Date.parse('2026-10-15'), span=end-start;
  var pct=function(iso){return 100*(Date.parse(iso)-start)/span;};
  var nowP=pct(TODAY);
  var axis=[['Jul','2026-07-01'],['Aug','2026-08-01'],['Sep','2026-09-01'],['Oct','2026-10-01']]
    .map(function(m){return '<span style="left:'+pct(m[1])+'%">'+m[0]+'</span>';}).join('');
  var bars=rows.map(function(x){
    var s=x.sub?pct(x.sub):pct(x.due)-2, e=x.due?pct(x.due):pct(x.sub)+3;
    var w=Math.max(1.5,e-s), late=isLate(x);
    return '<div class="grow"><div class="glabel"><span class="ref">'+x.ref+'</span> '+x.title+'</div>'+
      '<div class="gtrack"><div class="gnow" style="left:'+nowP+'%"></div>'+
      '<div class="gbar '+(late?'late':x.cls)+'" style="left:'+s+'%;width:'+w+'%"></div></div></div>';
  }).join('');
  document.getElementById('dpane').innerHTML=
    '<div class="dtop"><div class="crumb"><a data-close="1">Design & Documents</a> › Generated schedule</div>'+
      '<div class="dhrow"><div><div class="dh">'+r.title+' — schedule</div>'+
      '<div class="dref">Auto-generated from the register · '+rows.length+' items · dashed line = today</div></div>'+
      '<button class="dclose" data-close="1">×</button></div></div>'+
    '<div class="dbody"><div class="note">'+
      '<div class="grow" style="border-bottom:2px solid var(--line)"><div class="glabel" style="font-weight:700">Item</div><div class="gtrack" style="background:none"><div class="gaxis" style="position:relative;height:14px">'+axis+'</div></div></div>'+
      bars+
      '<div class="mini" style="margin-top:10px">Bars run from submission to the action-required date. Red = overdue. This is generated in one click from the live register — export it to P6 / MS Project or PDF and it stays linked, so as dates move the schedule updates.</div>'+
    '</div>'+
    '<div class="actbar"><button class="prim">Export to programme (P6 / MSP)</button><button>Download PDF</button><button class="ovr">Add to project programme</button></div>'+
    '</div>';
  document.getElementById('detail').classList.remove('hide');
}

/* register → downloadable Excel.
   The live app replaces this with a real .xlsx built by the server (see
   installRealExcelExport in tools/gen-app.mjs). What follows is the design
   prototype's own fallback, so the static mock still does something when it
   is opened with no server behind it. */
function downloadRegister(kind){
  var r=REG[kind];
  var cols = r.csvCols || (r.authority ? ['Authority','Scope','Ref','Submitted','Action by','Status'] : ['Ref','Title','Type','Submitted','Action by','Status']);
  var lines=[cols.join(',')];
  r.rows.forEach(function(x){
    var v = r.csv ? r.csv(x) : (r.authority ? [x.title,x.type,x.ref,x.sub||'',x.due||'',x.st] : [x.ref,x.title,x.type,x.sub||'',x.due||'',x.st]);
    lines.push(v.map(function(c){return '"'+String(c).replace(/"/g,'""')+'"';}).join(','));
  });
  try{
    var blob=new Blob([lines.join('\n')],{type:'text/csv'});
    var a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=kind+'-register.csv';
    document.body.appendChild(a); a.click(); a.remove();
  }catch(e){ alert('Register exported ('+r.rows.length+' rows).'); }
}

/* create-from-template: the per-project form that generates the doc + workflow */
var FORMS = {
  submittal:{ title:'New submittal', ref:'SUB-080', to:'DEC · Consultant',
    fields:[['Title','text','L5 slab formwork drawings',1],['Discipline','select','Structural|Architectural|MEP|Facade',0],
      ['Spec section','text','03 11 00',0],['Submit to','select','DEC · Consultant|Client',0],
      ['Required reply by','date','2026-09-25',0],['Attachments','file','',1]],
    wf:['Prepared by contractor','PM approve to submit','Transmitted to consultant','Consultant returns status'] },
  rfi:{ title:'New RFI', ref:'RFI-0036', to:'DEC · Consultant',
    fields:[['Subject','text','L5 beam / duct clash',1],['Discipline','select','MEP|Structural|Architectural|Facade',0],
      ['Question','textarea','300mm duct clashes with beam B12 at L5 — please confirm routing.',1],
      ['Drawing ref','text','ME-150 / ST-210',0],['Priority','select','Normal|Urgent',0],['Reply needed by','date','2026-09-22',0]],
    wf:['Raised by contractor','PM approve to issue','Transmitted to consultant','Consultant to answer'] },
  material:{ title:'New material submittal', ref:'MAR-047', to:'DEC · Consultant',
    fields:[['Material','text','Waterproofing membrane',1],['Supplier','text','Sika',0],['Spec section','text','07 13 00',0],
      ['Samples','select','Provided|To follow',0],['Links to BOM line','text','Waterproofing',0],['Required approval by','date','2026-09-24',0]],
    wf:['Submitted by contractor','QA checks spec','PM endorse','Consultant approval → releases LPO'] },
  wir:{ title:'Raise inspection request (WIR)', ref:'WIR-223', to:'DEC · Consultant',
    fields:[['Activity / element','text','L5 slab — pre-pour',1],['Location','text','Level 5',0],
      ['Discipline','select','Civil|Structural|MEP|Architectural|Finishes',0],['Inspection date & time','date','2026-09-16',0],
      ['ITP / checklist','select','ITP-C-04 Concrete|ITP-A-02 Masonry|ITP-M-01 MEP|ITP-W-03 Waterproofing',0],
      ['Attachments (drawing, checklist, photos)','file','',1]],
    wf:['Raised by engineer','QA/QC inspects','Consultant witnesses','Approved to proceed'] },
  mir:{ title:'Raise material inspection (MIR)', ref:'MIR-089', to:'DEC · Consultant',
    fields:[['Material / batch','text','FCU units — batch 13',1],['Delivery / GRN ref','text','GRN-043',0],
      ['Spec section','text','23 82 00',0],['Inspection date','date','2026-09-16',0],
      ['Approved material ref','text','MAR-046',0],['Attachments (delivery note, certs, photos)','file','',1]],
    wf:['Raised by engineer','QA/QC inspects','Approved / rejected'] },
  assign:{ title:'Invite / assign a person', ref:'USR-NEW', to:'New user',
    fields:[['Full name','text','',0],['Email address','text','',1],
      ['Function(s)','select','Project Manager|Planning|Site Engineer|Document Control|Design|QA/QC|HSE|Commercial|Procurement|Finance|Subcontractor|Consultant',0],
      ['Discipline (if site engineer)','select','—|Civil|MEP|Architecture|Structural',0],
      ['Projects','select','All projects',0]],
    wf:['Assigned by Principal / PM','Invite email sent','User signs in with their email'] },
  ptw:{ title:'Raise permit to work', ref:'PTW-210', to:'HSE Officer',
    fields:[['Activity / type','select','Hot work|Confined space|Lifting|Excavation|Working at height|Energised electrical',0],
      ['Location','text','Level 2, Zone A',1],['Valid until','date','2026-09-16',0],['Fire watch / standby','select','Assigned|Not required',0],
      ['Precautions taken','textarea','Extinguisher, screens, combustibles cleared',1],['Attachments (JSA, gas test, certs)','file','',1]],
    wf:['Requested by site','HSE review & sign','Work proceeds under permit','Close out at end of shift'] },
  obs:{ title:'Raise HSE observation', ref:'OBS-052', to:'Site Engineer',
    fields:[['Finding','text','',1],['Location','text','',0],['Risk','select','Low|Medium|High',0],['Action required','text','',1],['Photo','file','',1]],
    wf:['Raised by HSE','Assigned to site','Rectified','HSE verifies & closes'] },
  incident:{ title:'Report incident / near-miss', ref:'INC-010', to:'HSE Officer',
    fields:[['Type','select','Near-miss|First aid|Property damage|Lost-time injury',0],['Location','text','',0],
      ['What happened','textarea','',1],['Immediate action','textarea','',1],['Photos','file','',1]],
    wf:['Reported','Investigation','Corrective action','Closed & recorded'] },
  mr:{ title:'New material request', ref:'MR-060', to:'Project Manager',
    fields:[['Material','text','',1],['Quantity','text','',0],['For (location)','text','',0],['Needed by','date','',0],['Notes','text','',1]],
    wf:['Raised by site','PM reviews (checks against BOM)','Procurement raises LPO'] },
  ncrform:{ title:'Raise NCR', ref:'NCR-015', to:'Site Engineer',
    fields:[['Non-conformance','text','',1],['Location','text','',0],['Severity','select','Minor|Major',0],
      ['Disposition','select','Rework|Repair|Use-as-is (concession)|Reject',0],['Evidence','file','',1]],
    wf:['Raised by QA/QC','Site rectifies','QA/QC verifies & closes'] },
  variation:{ title:'New variation', ref:'VO-08', to:'Client',
    fields:[['Description','text','',1],['Origin','select','Instruction|RFI|Site condition|Design change',0],
      ['Estimated cost (AED)','text','',0],['Time effect (days)','text','',0],
      ['Basis of claim','textarea','',1],['Supporting docs','file','',1]],
    wf:['Priced by QS','PM review','Director approval','Client instruction'] },
  letter:{ title:'New letter', ref:'LTR-094', to:'Client',
    fields:[['Subject','text','',1],['Type','select','Notice|Response|General',0],['To','select','Client|Consultant',0],
      ['Body','textarea','',1],['Required issue by','date','',0]],
    wf:['Drafted','PM / Director sign','Issued & logged'] },
};
function openNewForm(kind){
  // K12 (v5 A7): a material submittal is prepared as a package — catalogue,
  // spec section, compliance statement — on its own page.
  if(kind==='material'){ location.href='/material'; return; }
  // K13 (v5 A10): an RFI is prepared from a note and a photo on its own page.
  if(kind==='rfi'){ location.href='/rfi'; return; }
  var f=FORMS[kind]; if(!f) return;
  var fields=f.fields.map(function(x){
    var lbl=x[0], t=x[1], val=x[2], full=x[3];
    var input;
    if(t==='select') input='<select>'+val.split('|').map(function(o){return '<option>'+o+'</option>';}).join('')+'</select>';
    else if(t==='textarea') input='<textarea>'+val+'</textarea>';
    else if(t==='file') input='<div class="filebox">${icon('upload', 14)} Drop files or browse — drawings, PDFs, samples</div>';
    else if(t==='date') input='<input type="date" value="'+val+'">';
    else input='<input type="text" value="'+val+'" placeholder="'+(val?'':lbl)+'">';
    return '<div class="f'+(full?' full':'')+'"><label>'+lbl+'</label>'+input+'</div>';
  }).join('');
  document.getElementById('dpane').innerHTML=
    '<div class="dtop"><div class="crumb"><a data-close="1">'+ROLE[state.role].page+'</a> › Create › '+f.title+'</div>'+
      '<div class="dhrow"><div><div class="dh">'+f.title+'</div><div class="dref">'+f.ref+' · using this project\'s template</div></div>'+
      '<button class="dclose" data-close="1">×</button></div></div>'+
    '<div class="dbody">'+
      '<div class="tmplnote">You are filling <b>this project\'s configured format</b>. On Generate, the numbered document is produced in this layout and routed through the workflow below — no re-typing, no chasing.</div>'+
      '<div class="note"><div class="sechd">'+f.title+' — details</div><div class="frm">'+fields+'</div></div>'+
      '<div class="note"><div class="sechd">Approval workflow that will start</div><ol class="wfprev">'+
        f.wf.map(function(s){return '<li>'+s+'</li>';}).join('')+'</ol>'+
        '<div class="mini">Routed to '+f.to+' after internal approval. Each step is signed; e-signature where none is on file.</div></div>'+
      '<div class="actbar"><button class="prim" data-gen="'+kind+'">Generate &amp; route for approval</button><button>Save draft</button></div>'+
    '</div>';
  document.getElementById('detail').classList.remove('hide');
}
function genConfirm(kind){
  var f=FORMS[kind];
  document.getElementById('dpane').innerHTML=
    '<div class="dtop"><div class="crumb"><a data-close="1">'+ROLE[state.role].page+'</a> › Create › '+f.title+'</div>'+
      '<div class="dhrow"><div><div class="dh">'+f.ref+' generated</div><div class="dref">'+f.title+' · workflow started</div></div>'+
      '<button class="dclose" data-close="1">×</button></div></div>'+
    '<div class="dbody"><div class="note"><div class="gensuccess"><div class="tick">✓</div>'+
      '<div style="font-size:15px;font-weight:700;color:var(--navy)">'+f.ref+' created and routed for approval</div>'+
      '<div class="mini" style="margin-top:6px">Produced in this project\'s template format, logged in the register, and sent to the first approver. It now appears in their sign-off queue.</div></div></div>'+
      '<div class="note"><div class="sechd">Workflow now running</div>'+ladderHTML(f.wf.map(function(s,i){return {st:s,who:i===0?'You':'Assigned',state:i===0?'done':(i===1?'now':'wait'),when:i===0?'just now':'',sig:i===0?['You','Design & Documents','just now']:null};}))+'</div>'+
      '<div class="actbar"><button class="prim" data-close="1">Done</button></div>'+
    '</div>';
}

/* planner reports — generated live from the activities the site engineers update */
function openReport(kind){
  var overall=Math.round(ACTIVITIES.reduce(function(s,a){return s+a.pct;},0)/ACTIVITIES.length);
  var moved=ACTIVITIES.filter(function(a){return a.pct>0&&a.pct<100;});
  var done=ACTIVITIES.filter(function(a){return a.pct>=100;});
  var crit=ACTIVITIES.filter(function(a){return /critical/.test(a.tag);});
  var pending=ACTIVITIES.filter(function(a){return a.pct===0;});
  var titles={weekly:'Weekly progress report',monthly:'Monthly progress report',lookahead:'3-week look-ahead',programme:'Programme — current status'};
  var rowsT=function(arr,showpct){return '<table><tr><th>Ref</th><th>Activity</th><th>Floor</th>'+(showpct?'<th>%</th>':'<th>Status</th>')+'</tr>'+
     arr.map(function(a){return row(a.ref,['<span class="ref">'+a.ref+'</span>',a.name,a.floor,showpct?a.pct+'%':(a.tag||'planned')]);}).join('')+'</table>';};
  var body;
  if(kind==='lookahead'){
    body='<div class="note"><div class="sechd">Starting in the next 3 weeks</div>'+rowsT(pending,false)+
      '<div class="mini">Pulled from the programme; constraints (drawings, materials, permits, inspections) are checked against each before it can start.</div></div>';
  } else {
    body='<div class="note"><div class="sechd">Progress summary</div>'+
        '<ul class="facts"><li><span class="k">Actual complete</span><span class="v">'+overall+'%</span></li>'+
        '<li><span class="k">Planned</span><span class="v">67%</span></li>'+
        '<li><span class="k">Variance</span><span class="v" style="color:var(--bad)">'+(overall-67)+'%</span></li>'+
        '<li><span class="k">Forecast</span><span class="v" style="color:var(--warn)">+2 weeks</span></li></ul></div>'+
      '<div class="note"><div class="sechd">Progressed this period ('+moved.length+')</div>'+rowsT(moved,true)+'</div>'+
      '<div class="note"><div class="sechd">Completed &amp; signed off ('+done.length+')</div>'+rowsT(done,true)+'</div>'+
      '<div class="note"><div class="sechd">Critical &amp; at risk ('+crit.length+')</div>'+rowsT(crit,true)+'</div>';
  }
  document.getElementById('dpane').innerHTML=
    '<div class="dtop"><div class="crumb"><a data-close="1">Planning</a> › '+titles[kind]+'</div>'+
      '<div class="dhrow"><div><div class="dh">'+titles[kind]+'</div><div class="dref">Generated from live site progress · '+TODAY+'</div></div>'+
      '<button class="dclose" data-close="1">×</button></div></div>'+
    '<div class="dbody">'+body+
      '<div class="actbar"><button class="prim">Download PDF</button><button>Email to client &amp; PM</button><button class="ovr">Log as submittal</button></div>'+
      '<div class="mini">Everything above is pulled straight from the activities the site engineers update — no re-keying. Same engine runs the daily, weekly and monthly reports.</div>'+
    '</div>';
  document.getElementById('detail').classList.remove('hide');
}

/* HSE daily update / weekly report */
function openHse(kind){
  var daily = kind==='daily';
  var title = daily?'Daily HSE update':'Weekly HSE report';
  var stats = daily
    ? [['Men on site','108'],['Toolbox talks','2 (22 + 18 attended)'],['PPE compliance','96%'],['Permits live','3'],['Observations raised','2'],['Incidents','0']]
    : [['Days LTI-free','142'],['Permits issued','14'],['Observations','9 (7 closed)'],['Near-misses','1'],['Toolbox talks','11'],['Inductions','18']];
  var body='<div class="note"><div class="sechd">'+(daily?'Today — 13 Sep 2026':'Week 37 — 7–13 Sep 2026')+'</div>'+
    '<ul class="facts">'+stats.map(function(s){return '<li><span class="k">'+s[0]+'</span><span class="v">'+s[1]+'</span></li>';}).join('')+'</ul></div>'+
    '<div class="note"><div class="sechd">Open observations</div><table><tr><th>Ref</th><th>Finding</th><th>Risk</th><th>Status</th></tr>'+
    REG.hseobs.rows.map(function(x){return row(x.ref,['<span class="ref">'+x.ref+'</span>',x.title,x.risk,pill(x.st,x.cls)]);}).join('')+'</table></div>'+
    '<div class="note"><div class="sechd">Certificates expiring / expired</div><table><tr><th>Ref</th><th>Certificate</th><th>Expires</th></tr>'+
    REG.certs.rows.filter(function(x){return x.cls!=='ok';}).map(function(x){return row(x.ref,['<span class="ref">'+x.ref+'</span>',x.title,dueCell(x)]);}).join('')+'</table></div>';
  document.getElementById('dpane').innerHTML=
    '<div class="dtop"><div class="crumb"><a data-close="1">HSE</a> › '+title+'</div>'+
      '<div class="dhrow"><div><div class="dh">'+title+'</div><div class="dref">Generated from the HSE registers · '+TODAY+'</div></div>'+
      '<button class="dclose" data-close="1">×</button></div></div>'+
    '<div class="dbody">'+body+
      '<div class="actbar"><button class="prim">Download PDF</button><button>Email to PM &amp; client</button></div>'+
      '<div class="mini">Pulled from the permits, observations and certificate registers — no re-keying.</div></div>';
  document.getElementById('detail').classList.remove('hide');
}

/* =========================================================================
   3b.  PRINCIPAL DRILL-DOWN — all projects → a project → a section → an item
   ========================================================================= */
var PROJECTS = {
naf:{ name:'Sample project', sub:'Sample contractor · Dubai',
  pct:'63%', pctl:'Complete',
  kpis:[['63.0%','Complete','act'],['+2 wks','Forecast slip','warn'],['AED 66.1m','Certified','good'],['2','NCRs open','bad'],['142','Days LTI-free','good'],['5','Decisions pending','warn']],
  decisions:[
    ['VO-07','VO','vo','VO-07 — Coral pond civil','AED 214k · +12 days · PM & QS signed','Escalated to you',true],
    ['IPA-05','IPC','ipc','IPA-05 — approve to submit','Sept application AED 4.41m · to the Engineer','',true],
    ['AR-412','DWG','dwg','AR-412 Rev C — 4th floor RCP','Shop drawing · approve to submit','',true],
    ['ACT-117','ACT','','ACT-117 — L3 slab (finished on site)','PM sign-off escalated · verify completion','',true],
    ['MR-059','BOM','ncr','MR-059 — extra blockwork','Over BOM by 60 no · needs approval','Over BOM',false],
  ],
  sections:[
    {key:'progress',icon:'◷',title:'Progress & Programme',stat:'63%',sub:'Planned 67% · +2 wks slip · 4 critical',flag:['Behind','a'],
      body:'<div class="card"><h2>Progress by floor</h2>'+bars([['Podium 01',53],['Podium 02',50],['Ground',45],['Level 01',40],['Level 02',29],['Level 04',16],['Lower roof',3]])+
        '<div class="mini">4% behind the baseline, carried on the podium slabs. Programme due a re-cut this week.</div></div>'+
        '<div class="card"><h2>Critical &amp; in-progress activities <span class="r">14 in progress · 4 critical</span></h2><table><tr><th>Ref</th><th>Activity</th><th>%</th><th>Status</th></tr>'+
        
        
        
        
        '</table></div>'},
    {key:'design',icon:'▥',title:'Design & Drawings',stat:'48',sub:'Current drawings · 3 to approve',flag:['3 pending','a'],
      body:'<div class="card"><h2>Drawing register <span class="r">latest revisions only</span></h2><table><tr><th>Ref</th><th>Title</th><th>Rev</th><th>Status</th></tr>'+
        
        
        
        '</table></div>'},
    {key:'technical',icon:'✎',title:'RFIs & Submittals',stat:'7',sub:'RFIs open · 3 submittals',flag:['2 overdue','r'],
      body:'<div class="card"><h2>Open RFIs</h2><table><tr><th>Ref</th><th>Subject</th><th>With</th><th>Status</th></tr>'+
        
        
        '</table></div><div class="card"><h2>Submittals</h2><table><tr><th>Ref</th><th>Item</th><th>Status</th></tr>'+
        '</table></div>'},
    {key:'quality',icon:'✓',title:'Quality (QA/QC)',stat:'2',sub:'NCRs open · 87% first-time pass',flag:['2 NCR','r'],
      body:'<div class="card"><h2>Inspections (WIR/MIR)</h2><table><tr><th>Ref</th><th>Location</th><th>Status</th></tr>'+
        
        
        '</table></div><div class="card"><h2>NCR register</h2><table><tr><th>Ref</th><th>Issue</th><th>Status</th></tr>'+
        
        '</table></div>'},
    {key:'safety',icon:'◈',title:'Safety (HSE)',stat:'142',sub:'Days LTI-free · 4 observations',flag:['1 high','r'],
      body:'<div class="card"><h2>Permits to work</h2><table><tr><th>Ref</th><th>Activity</th><th>Status</th></tr>'+
        '</table></div>'+
        '<div class="card"><h2>Observations</h2><table><tr><th>Ref</th><th>Finding</th><th>Status</th></tr>'+
        '</table></div>'},
    {key:'commercial',icon:'₳',title:'Commercial',stat:'AED 4.41m',sub:'IPC-05 · 4 variations open',flag:['IPC ready','g'],
      body:'<div class="card"><h2>Variations</h2><table><tr><th>Ref</th><th>Description</th><th>Cost</th><th>Status</th></tr>'+
        
        
        '</table></div><div class="card"><h2>Payment</h2><table><tr><th>Ref</th><th>Valuation</th><th>Status</th></tr>'+
        '</table></div>'},
    {key:'procurement',icon:'🛒',title:'Procurement & BOM',stat:'1',sub:'Over BOM · 3 deliveries due',flag:['Over BOM','r'],
      body:'<div class="card"><h2>Bill of Materials — order control</h2><table><tr><th>Material</th><th>BOM</th><th>Ordered</th><th>Balance</th><th>Status</th></tr>'+
        row('BOM-block',['Solid block 200mm','38,000','39,200','−1,200',pill('Over BOM','late')])+
        row('BOM-rebar',['Rebar T16–T25','420 t','405','+15',pill('Near limit','warn')])+
        row('BOM-conc',['C40 ready-mix','1,250','1,180','+70',pill('OK','ok')])+
        '</table></div><div class="card"><h2>Material requests</h2><table><tr><th>Ref</th><th>Material</th><th>Status</th></tr>'+
        '</table></div>'},
    {key:'documents',icon:'▤',title:'Documents',stat:'9',sub:'In the diary today',flag:null,
      body:'<div class="card"><h2>Correspondence diary</h2><table><tr><th>Ref</th><th>Direction</th><th>Subject</th></tr>'+
        
        '</table></div>'},
    {key:'subcon',icon:'⧉',title:'Subcontractors',stat:'6',sub:'Packages · 1 behind',flag:['1 behind','a'],
      body:'<div class="card"><h2>Packages</h2><table><tr><th>Package</th><th>Sub</th><th>Progress</th><th>Status</th></tr>'+
        
        '</table></div>'},
  ]},
jbbc:{ name:'Commercial Tower — JBBC', sub:'JBBC · Business Bay, Dubai · Finish 14 Mar 2027',
  pct:'42%', pctl:'Complete',
  kpis:[['42.0%','Complete','act'],['On track','Forecast',''],['AED 38.4m','Certified','good'],['0','NCRs open','good'],['On track','Programme','good'],['1','Decisions pending','warn']],
  decisions:[
    ['VO-11','VO','vo','VO-11 — facade upgrade','AED 880k · client-driven change','',false],
  ],
  sections:[
    {key:'progress',icon:'◷',title:'Progress & Programme',stat:'42%',sub:'On the baseline',flag:['On track','g'],
      body:'<div class="card"><h2>Progress by level</h2>'+bars([['L1–L4',100,'var(--good)'],['L5–L8',64],['L9 (current)',30],['Facade',12]])+'</div>'},
    {key:'commercial',icon:'₳',title:'Commercial',stat:'AED 880k',sub:'VO-11 facade upgrade pending',flag:['1 VO','a'],
      body:'<div class="card"><h2>Variations</h2><table><tr><th>Ref</th><th>Description</th><th>Cost</th><th>Status</th></tr>'+
        '</table></div>'},
    {key:'quality',icon:'✓',title:'Quality (QA/QC)',stat:'0',sub:'No open NCRs',flag:['Clean','g'],
      body:'<div class="card"><h2>NCR register</h2><div class="mini">No open non-conformances on this project.</div></div>'},
    {key:'safety',icon:'◈',title:'Safety (HSE)',stat:'210',sub:'Days LTI-free',flag:['Clean','g'],
      body:'<div class="card"><h2>Safety</h2><div class="mini">210 days LTI-free. No open high-risk observations.</div></div>'},
  ]},
barari:{ name:'Villa Compound — Project three', sub:'Private · Project three · 9 villas · Finish 30 Sep 2026',
  pct:'78%', pctl:'Complete',
  kpis:[['78.0%','Complete','act'],['Snagging','Stage',''],['1','NCRs open','bad'],['1','Villa handed over','good'],['On track','Forecast','good'],['1','Final IPC','warn']],
  decisions:[
    ['IPC-FINAL','IPC','ipc','IPC-FINAL — final account','Final valuation in preparation','',false],
  ],
  sections:[
    {key:'progress',icon:'◷',title:'Progress & Handover',stat:'78%',sub:'Into snagging · villa 7 handed over',flag:['Snagging','a'],
      body:'<div class="card"><h2>Villas</h2>'+bars([['Villas 1–6',100,'var(--good)'],['Villa 7 (handed)',100,'var(--good)'],['Villas 8–9',62]])+'</div>'},
    {key:'quality',icon:'✓',title:'Quality (QA/QC)',stat:'1',sub:'1 NCR open · snag list running',flag:['1 NCR','r'],
      body:'<div class="card"><h2>Snag list</h2><div class="mini">Snagging in progress across villas 8–9; one NCR open on external works.</div></div>'},
    {key:'commercial',icon:'₳',title:'Commercial',stat:'Final',sub:'Final IPC in preparation',flag:['Final IPC','g'],
      body:'<div class="card"><h2>Payment</h2><table><tr><th>Ref</th><th>Valuation</th><th>Status</th></tr>'+
        '</table></div>'},
  ]},
};

function renderPrincipalOverview(pid){
  var p=PROJECTS[pid];
  document.getElementById('rolebar').innerHTML=
    '<div class="pcrumb"><a data-pnav="root">★ All projects</a><span class="sep">›</span><span class="cur">'+p.name+'</span></div>';
  document.getElementById('rolebar').className='';
  document.getElementById('kpis').style.gridTemplateColumns='';
  document.getElementById('kpis').innerHTML=fourKpis(p.kpis).map(function(k){return kpi(k[0],k[1],k[2]);}).join('');
  setWide(true);
  var dec=(p.decisions||[]);
  var decCard = dec.length ?
    '<div class="card" style="border-left:3px solid var(--gold)"><h2>⚑ Needs your decision <span class="r">'+dec.length+' flagged to you</span></h2>'+
      dec.map(function(x){return q(x[0],x[1],x[2],x[3],x[4],x[5],x[6]);}).join('')+'</div>' : '';
  document.getElementById('leftcol').innerHTML=
    '<div class="phead"><div><div class="pt">'+p.name+'</div><div class="psub">'+p.sub+'</div></div>'+
      '<div class="pbig"><div class="n">'+p.pct+'</div><div class="l">'+p.pctl+'</div></div></div>'+
    decCard+
    '<div style="font-size:11px;text-transform:uppercase;letter-spacing:.7px;color:var(--muted);font-weight:700;margin:0 0 10px;">Open a section for the detail</div>'+
    '<div class="ptiles">'+p.sections.map(function(s){
      var flag=s.flag?'<span class="flag '+s.flag[1]+'">'+s.flag[0]+'</span>':'';
      return '<div class="ptile" data-section="'+pid+':'+s.key+'"><div class="th"><span class="ic">'+ico(s.icon)+'</span><span class="tt">'+s.title+'</span></div>'+
        '<div class="stat">'+s.stat+flag+'</div><div class="sub">'+s.sub+'</div></div>';
    }).join('')+'</div>';
  document.getElementById('rightcol').innerHTML='';
}

function renderPrincipalSection(pid,key){
  var p=PROJECTS[pid]; var s=p.sections.filter(function(x){return x.key===key;})[0];
  document.getElementById('rolebar').innerHTML=
    '<div class="pcrumb"><a data-pnav="root">★ All projects</a><span class="sep">›</span>'+
    '<a data-pnav="proj:'+pid+'">'+p.name+'</a><span class="sep">›</span><span class="cur">'+s.title+'</span></div>';
  document.getElementById('rolebar').className='';
  document.getElementById('kpis').innerHTML='';
  document.getElementById('kpis').style.gridTemplateColumns='';
  setWide(true);
  document.getElementById('leftcol').innerHTML=
    '<div class="phead"><div><div class="pt">'+s.title+'</div><div class="psub">'+p.name+'</div></div></div>'+
    '<div class="mini" style="margin:-6px 0 12px">Click any row to open the record — its full detail, workflow and signatures.</div>'+
    s.body;
  document.getElementById('rightcol').innerHTML='';
}

function setWide(on){
  var cols=document.querySelector('.cols');
  cols.style.display=on?'block':'grid';
}

/* simple activity row for the site engineer — progress bar + update/finished */
function actRow(ref,name,floor,pct,tag){
  var col = pct>=100?'var(--good)':(/critical/.test(tag||'')?'var(--gold)':'var(--blue)');
  return '<div class="actrow" data-open="'+ref+'"><div><div class="an">'+ref+' · '+name+'</div>'+
    '<div class="af">'+floor+(tag?' · '+tag:'')+'</div></div>'+
    '<div class="track"><div class="fill" style="width:'+pct+'%;background:'+col+'"></div></div>'+
    '<div class="apc">'+pct+'%</div>'+
    '<button class="abtn'+(pct>=100?' done':'')+'">'+(pct>=100?'Sent to PM':'Update ›')+'</button></div>';
}

// Team & access, the right-hand column: this person's projects, whether the
// company may add one itself, and the last access changes from the audit.
function teamRightLive(){
  var me = window.__ME__ || {}, ps = me.projects || [];
  var esc1 = function(s){ return String(s == null ? '' : s).replace(/[&<>"]/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); };
  var rows = ps.length ? ps.map(function(p){ return row('', ['<b>' + esc1(p.name) + '</b>', '<span class="ref">' + esc1(p.id) + '</span>', pill(p.id === me.projectId ? 'Open' : 'Live', 'ok')]); }).join('')
    : '<tr><td colspan="3" class="mini">No projects yet.</td></tr>';
  setTimeout(function(){
    var addBox = document.getElementById('teamAdd'), feedBox = document.getElementById('teamFeed');
    fetch('/api/account', { cache: 'no-store' }).then(function(r){ return r.ok ? r.json() : null; }).then(function(a){
      if (!addBox) return;
      addBox.innerHTML = a && a.may_create_project
        ? '<div class="actbar" style="margin-top:10px"><a class="abtn" href="/welcome" style="text-decoration:none">+ New project</a></div>'
        : '<div class="mini">New projects on this account are set up by AETRAA.</div>';
    }).catch(function(){});
    fetch('/api/audit', { cache: 'no-store' }).then(function(r){ return r.ok ? r.json() : null; }).then(function(j){
      if (!feedBox) return;
      var acc = ((j && j.entries) || []).filter(function(e){ return /^(person|user|access|code|signup|apikey|password)/.test(String(e.action || '')); }).slice(0, 6);
      feedBox.innerHTML = acc.length ? feed(acc.map(function(e){
        var ago = e.at || e.created_at || ''; return ['g', esc1(e.who || ''), esc1(String(e.action || '').replace(/[._]/g, ' ') + (e.detail ? ' — ' + e.detail : '')), ago ? new Date(ago).toLocaleDateString() : ''];
      })) : '<div class="mini">No access changes recorded yet.</div>';
    }).catch(function(){ if (feedBox) feedBox.innerHTML = '<div class="mini">The access log could not be read.</div>'; });
  }, 0);
  return '<div class="card"><h2>Projects <span class="r">' + ps.length + '</span></h2><table><tr><th>Project</th><th>ID</th><th>Status</th></tr>' + rows + '</table>' +
    '<div id="teamAdd"></div></div>' +
    '<div class="card"><h2>Recent access changes</h2><div id="teamFeed"><div class="mini">Loading…</div></div></div>';
}

var DASH = {

team:function(){
  var emails=Object.keys(ACCOUNTS);
  var rows=emails.map(function(e){var a=ACCOUNTS[e];
    var fns=a.roles.map(function(r){return ROLE[r].label;}).join(', ')+(a.siteDiscipline?' · '+a.siteDiscipline:'');
    return row('',['<b>'+a.name+'</b>','<span class="ref">'+e+'</span>',fns,pill('Active','ok'),'<button class="abtn">Edit</button>']);
  }).join('');
  return {cols:4,
  bar:'Signed in with <b>Team &amp; Access</b> — assign people to functions by <b>email</b>. Only the Principal and the PM can invite people or change access, and new projects cannot be added from the app.',
  kpis:[[String(emails.length),'People','act'],['13','Functions',''],['3','Projects (fixed)',''],['P + PM','Can assign','']],
  left:'<div class="card" style="border-left:3px solid var(--gold)"><h2>Assign a person <span class="r">Principal / PM only</span></h2>'+
      '<div class="actbar"><button class="prim" data-new="assign">+ Invite / assign email</button></div>'+
      '<div class="mini" style="margin-top:9px">Assigning an email grants that person their functions and the matching dashboards. One email can hold several functions; a site engineer is also given a discipline (Civil / MEP / …) so they see only their own activities.</div></div>'+
      '<div class="card"><h2>People &amp; access <span class="r">'+emails.length+'</span></h2><table><tr><th>Name</th><th>Email</th><th>Functions</th><th>Status</th><th></th></tr>'+rows+'</table></div>',
  // The company's real projects and its real access changes (the design showed samples here).
  right:teamRightLive()};
},

principal:function(){return {cols:4,
  bar:'Signed in as <b>Principal</b> — every project, every discipline, and every decision that has climbed to you. Nothing here needs day-to-day work; it needs a decision or an eye.',
  kpis:[['3','Live projects','act'],['61%','Portfolio complete',''],['4','Decisions on you','bad'],['AED 12.4m','Certified this month','good']],
  left:'<div class="card"><h2>Projects <span class="r">click any to drill in</span></h2><div class="pf">'+
      pcard('naf','Sample project','Sample contractor',63,'8 Nov 26',[['+2 wks slip','a'],['2 NCR','r'],['IPC-05 ready','g']])+
      pcard('jbbc','Commercial Tower','JBBC · Business Bay',42,'14 Mar 27',[['On track','g'],['0 NCR','g'],['VO-11 pending','a']])+
      pcard('barari','Villa Compound','Project three · 9 villas',78,'30 Sep 26',[['Snagging','a'],['1 NCR','r'],['Final IPC','g']])+
      '</div></div>'+
      '<div class="card"><h2>Consolidated progress <span class="r">planned vs actual</span></h2>'+
      bars([['Project one',63],['Project two',42,'var(--gold)'],['Project three',78,'var(--good)']])+
      '<div class="mini">Portfolio is 4% behind the combined baseline, carried almost entirely by the first project.</div></div>',
  right:'<div class="card"><h2>Decisions waiting on you <span class="r">4</span></h2>'+
      q('VO-07','VO','vo','VO-07 — sample variation','AED 214k · +12 days · PM & QS signed','Escalated to you',true)+
      q('IPA-05','IPC','ipc','IPA-05 — approve to submit','Sept application AED 4.41m · to the Engineer','',true)+
      q('LTR-092','LTR','','LTR-092 — EoT notice to client (JBBC)','Contracts drafted · your sign to issue','',true)+
      q('VO-11','VO','vo','VO-11 — facade upgrade (JBBC)','AED 880k · client-driven change','',false)+
      '</div>'+
      '<div class="card"><h2>Across all projects</h2>'+feed([
        ['g','IPC-05','certified by the Engineer','8m','IPC-05'],
        ['r','NCR-014','open 5 days','1h','NCR-014'],
        ['a','VO-11','priced — JBBC','3h','VO-11'],
        ['g','Project three','villa 7 handed over','y\'day'],
      ])+'</div>'};
},

pm:function(){return {cols:6,
  bar:'Signed in as <b>Project Manager</b> — you run the job. You sign off the work the site reports as finished, and nothing goes out until you approve it: the contractor prepares it, you approve, and it is submitted to the consultant / Engineer <b>for their action</b>. The client releases payment.',
  kpis:[['3','Activities to sign off','bad'],['14','In progress','act'],['9','Pending / not started',''],['4','Critical — watch','warn'],['5','Docs to approve','warn'],['63%','Complete','']],
  left:'<div class="card"><h2>Activities finished — awaiting your sign-off <span class="r">3</span></h2><table><tr><th>Ref</th><th>Activity</th><th>Floor</th><th>Reported by</th><th>Stage</th></tr>'+
      
      
      
      '</table><div class="mini">The site engineer marks an activity finished; it counts toward progress and payment only once you verify the work and sign it off.</div></div>'+
      '<div class="card"><h2>Programme — in progress, pending &amp; critical <span class="r">as at 13 Sep</span></h2><table><tr><th>Ref</th><th>Activity</th><th>Floor</th><th>%</th><th>Status</th></tr>'+
      
      
      
      
      
      
      '</table><div class="mini">Critical activities sit on the critical path — slip here moves the contract finish date.</div></div>'+
      '<div class="card"><h2>Out with the consultant / client <span class="r">ball in their court</span></h2><table><tr><th>Ref</th><th>Item</th><th>Sent</th><th>Status</th></tr>'+
      
      
      
      
      '</table><div class="mini">Consultant returns each submittal with a status: Approved · Approved as noted · Revise &amp; resubmit · Rejected. The client pays the certified IPC.</div></div>',
  right:'<div class="card" style="border-left:3px solid var(--gold)"><h2>Raise it yourself — PM override <span class="r">direct</span></h2>'+
      '<div class="mini" style="margin:0 0 10px">You are not limited to what the team sends up. You can originate a submission and issue it directly, and override any item waiting in a workflow. Every direct action and override is logged against your name.</div>'+
      '<div class="actbar"><button class="prim" data-open="SUB-079">+ New submission</button><button data-open="RFI-0035">+ RFI</button><button data-open="LTR-093">+ Letter</button><button class="ovr" data-open="SUB-078">Override an item</button></div></div>'+
      '<div class="card"><h2>Your sign-off queue <span class="r">6 items</span></h2>'+
      q('ACT-118','ACT','','ACT-118 — L3 blockwork Zone A','Site marked finished · verify &amp; sign off','',true)+
      q('SUB-078','SUB','','SUB-078 — L4 formwork drawings','Prepared by site · approve to submit to consultant','',true)+
      q('RFI-0035','RFI','','RFI-0035 — L2 slab penetration','Raised by site · approve to submit','',true)+
      q('IPA-05','IPC','ipc','IPA-05 — September application','QS prepared AED 4.41m · review &amp; submit to Engineer','Due today',true)+
      q('VO-07','VO','vo','VO-07 — Coral pond civil','+12 days · AED 214,000 · submit to client','',true)+
      q('LTR-093','LTR','','LTR-093 — progress letter','Drafted · sign to issue','',true)+
      '</div>'+
      '<div class="card"><h2>Live activity</h2>'+feed([
        ['a','ACT-118','marked finished by site','40m','ACT-118'],['g','ACT-116','signed off complete','2h','ACT-116'],
        ['','RFI-0033','answered by consultant','3h','RFI-0033'],['a','SUB-074','returned: revise &amp; resubmit','5h','SUB-074'],
        ['g','IPC-05','certified by Engineer','2d','IPC-05']])+'</div>'};
},

planning:function(){
  var overall=Math.round(ACTIVITIES.reduce(function(s,a){return s+a.pct;},0)/ACTIVITIES.length);
  var discAvg=function(d){var a=ACTIVITIES.filter(function(x){return x.disc===d;});return a.length?Math.round(a.reduce(function(s,x){return s+x.pct;},0)/a.length):0;};
  var crit=ACTIVITIES.filter(function(a){return /critical/.test(a.tag);});
  var atPM=ACTIVITIES.filter(function(a){return a.pct>=100;}).length;
  return {cols:6,
  bar:'Signed in as <b>Planning Engineer</b> — the programme. It updates <b>live</b> as the site engineers submit their progress, and the weekly &amp; monthly reports are generated from that same data.',
  kpis:[[overall+'%','Actual (live)','act'],['67%','Planned',''],[(overall-67)+'%','Variance','bad'],['+2 wks','Forecast slip','warn'],[String(crit.length),'Critical','warn'],[String(atPM),'Finished — at PM','']],
  left:'<div class="card"><h2>Progress by discipline <span class="r">live from site</span></h2>'+
      bars([['Overall',overall,'var(--gold)'],['Civil',discAvg('Civil')],['MEP',discAvg('MEP')],['Architecture',discAvg('Architecture')],['Planned',67,'var(--faint)']])+
      '<div class="mini">These bars move the moment a site engineer updates an activity — no manual status-taking. Currently '+(67-overall)+'% behind the baseline.</div></div>'+
      '<div class="card"><h2>Critical &amp; at-risk activities <span class="r">'+crit.length+'</span></h2><table><tr><th>Ref</th><th>Activity</th><th>Disc.</th><th>%</th><th>Note</th></tr>'+
      crit.map(function(a){return row(a.ref,['<span class="ref">'+a.ref+'</span>',a.name,a.disc,a.pct+'%',pill('Critical','late')]);}).join('')+
      '</table></div>'+
      '<div class="card"><h2>3-week look-ahead</h2><table><tr><th>Ref</th><th>Activity</th><th>Disc.</th><th>Starts</th></tr>'+
      ACTIVITIES.filter(function(a){return a.pct===0;}).map(function(a){return row(a.ref,['<span class="ref">'+a.ref+'</span>',a.name,a.disc,(a.tag||'—').replace('critical · ','').replace('due ','')||'—']);}).join('')+
      '</table></div>',
  right:'<div class="card" style="border-left:3px solid var(--gold)"><h2>Reports <span class="r">from live data</span></h2>'+
      '<div class="actbar"><button class="prim" data-report="weekly">Weekly report</button><button class="prim" data-report="monthly">Monthly report</button></div>'+
      '<div class="actbar" style="margin-top:8px"><button data-report="lookahead">3-week look-ahead</button><button class="schbtn" data-report="programme">Programme status</button></div>'+
      '<div class="actbar" style="margin-top:8px"><button data-new="rfi">+ RFI</button></div>'+
      '<div class="mini" style="margin-top:9px">The weekly and monthly reports pull straight from the activities the site engineers update — generated in one click.</div></div>'+
      '<div class="card"><h2>Live from site — updates</h2>'+feed([
        ['a','ACT-120','R. Das → 60% (Civil)','20m','ACT-120'],['a','ACT-130','A. Imran → 40% (MEP)','1h','ACT-130'],
        ['g','ACT-118','finished — sent to PM','4h','ACT-118'],['r','ACT-123','waterproofing failed WIR','1d','ACT-123'],
        ['g','ACT-116','signed off by PM','y\'day','ACT-116']])+'</div>'+
      '<div class="card"><h2>Delay &amp; EoT <span class="r">2 open</span></h2>'+
      q('EOT-02','EOT','vo','EoT-02 — Coral pond redesign','+12 days · linked to VO-07','',false)+
      q('EOT-01','EOT','vo','EoT-01 — late IFC for facade','+6 days · consultant delay','',false)+
      '</div>'};
},

site:function(){
  var acc=ACCOUNTS[state.email]; var disc=acc.siteDiscipline||'Civil';
  var mine=ACTIVITIES.filter(function(a){return a.disc===disc;});
  var live=mine.filter(function(a){return a.pct<100;});
  var withpm=mine.filter(function(a){return a.pct>=100;});
  var inprog=mine.filter(function(a){return a.pct>0&&a.pct<100;}).length;
  var list=function(arr){return arr.length?arr.map(function(a){return actRow(a.ref,a.name,a.floor,a.pct,a.tag);}).join(''):'<div class="mini">Nothing here right now.</div>';};
  return {cols:4,
  bar:'Signed in as <b>Site Engineer ('+disc+')</b> — you see <b>only the '+disc+' activities</b> assigned to you from the programme. Update the progress as you go; when one is finished, attach the photos and send it to the PM to sign off.',
  kpis:[[String(mine.length),'My '+disc+' activities','act'],[String(inprog),'In progress',''],[String(live.length),'Still open','warn'],[String(withpm.length),'With PM — sign-off','']],
  left:'<div class="card"><h2>My '+disc+' activities — from the programme <span class="r">tap one to update</span></h2>'+
      '<div class="actlist">'+list(live)+'</div>'+
      '<div class="mini">You see only the '+disc+' scope assigned to you — other disciplines have their own engineers and their own lists. Slide the percentage as work progresses; at 100% attach the completion photos and send to the PM to verify and sign off.</div></div>',
  right:'<div class="card"><h2>With the PM — awaiting sign-off <span class="r">'+withpm.length+'</span></h2>'+
      '<div class="actlist">'+list(withpm)+'</div>'+
      '<div class="mini">You marked these finished with photos attached — with the PM to sign off.</div></div>'+
      '<div class="card"><h2>Quick actions</h2><div class="actbar">'+
      '<button class="prim" data-new="wir">+ Raise inspection</button><button class="prim" data-new="mr">+ Order material</button><button data-new="ms">+ Method statement</button><button class="prim" data-new="rfi">+ RFI</button></div>'+
      '<div class="mini" style="margin-top:10px">A material request goes to the PM — you don\'t see the budget (BOM); the PM checks it and releases it. Inspections route to QA in the project format.</div></div>'+
      '<div class="card"><h2>Recent</h2>'+feed([
        ['g','Activity','signed off by PM','2h'],['a','Activity','sent to PM with photos','4h'],
        ['','WIR-220','approved by QA','y\'day','WIR-220']])+'</div>'};
},

design:function(){return {cols:6,
  bar:'Signed in as <b>Design &amp; Documents</b> — the drawing registers (tender, IFC, shop), submittals and authority approvals. Every register shows what is due, its status and any delay. Generate the submission schedule from any register in one click.',
  kpis:[['48','Current drawings',''],['2','Shop dwgs to approve','warn'],['3','Submittals open','act'],['1','NOC overdue','bad'],['3','Overdue actions','bad'],['4','Authorities tracked','']],
  left: '<div class="card" style="border-left:3px solid var(--gold)"><h2>Create — from your project templates <span class="r">generates the document + workflow</span></h2>'+
      '<div class="tmplnote">The format for each of these is the template you set for <b>this project</b> at onboarding. Fill the form and Generate — the document is produced in that format and the approval workflow starts automatically.</div>'+
      '<div class="actbar"><button class="prim" data-new="submittal">+ Submittal</button><button class="prim" data-new="ms">+ Method statement</button><button class="prim" data-new="rfi">+ RFI</button><button class="prim" data-new="material">+ Material submittal</button><button data-new="letter">+ Letter</button></div></div>'+
      regTable('drawings')+regTable('submittals'),
  right: regTable('authority')+
    '<div class="card"><h2>Live activity</h2>'+feed([
      ['a','DEWA-SUB','NOC now 3 days overdue','1h','DEWA-SUB'],['a','SUB-074','returned: revise &amp; resubmit','5h','SUB-074'],
      ['g','DCD-DES','Civil Defence approved','2d','DCD-DES'],['','AR-412','shop dwg submitted','y\'day','AR-412']])+'</div>'};
},
dc:function(){return {cols:6,
  bar:'Signed in as <b>Document Controller</b> — the correspondence diary, every register, and what has to be transmitted or logged today. This is the diary login.',
  kpis:[['9','In diary today','act'],['7','RFIs live',''],['3','Submittals due','warn'],['4','Transmittals out',''],['0','Un-filed','good'],['312','Docs this month','']],
  left:'<div class="card"><h2>Correspondence diary <span class="r">13 Sep</span></h2><table><tr><th>Time</th><th>Ref</th><th>Direction</th><th>Subject</th></tr>'+
      
      
      
      
      '</table></div>'+
      '<div class="card"><h2>Registers at a glance</h2><table><tr><th>Register</th><th>Open</th><th>This month</th><th>Overdue</th></tr>'+
      row('',['Drawings','48 current','12 new','—'])+
      row('',['RFIs','7','9','<span class="pill late">2</span>'])+
      row('',['Submittals','3','14','<span class="pill warn">1</span>'])+
      row('',['Letters','—','23','—'])+
      '</table></div>',
  right:'<div class="card"><h2>To transmit / log <span class="r">4</span></h2>'+
      q('AR-412','DWG','dwg','AR-412 Rev C — issue transmittal','To PM, consultant, site copy','',false)+
      q('RFI-0034','RFI','','RFI-0034 — log &amp; send','To consultant · reply due 15 Sep','',false)+
      q('SUB-076','SUB','','SUB-076 — external paint submittal','Route to QA then consultant','',false)+
      q('LTR-092','LTR','','LTR-092 — outgoing letter','Awaiting director sign to release','',false)+
      '</div>'+
      '<div class="card"><h2>Distribution activity</h2>'+feed([
        ['g','TR-118','transmittal sent','20m'],['','RFI-0033','filed — closed','2h','RFI-0033'],
        ['a','SUB-076','received from sub','3h'],['g','LTR-090','logged incoming','4h']])+'</div>'};
},

qaqc:function(){return {cols:6,
  bar:'Signed in as <b>QA / QC Engineer</b> — inspections, material approvals and the non-conformance record. <span style="color:var(--gold)">This email also holds Site Engineer — switch hats above.</span>',
  kpis:[['5','WIR/MIR open','act'],['2','NCRs open','bad'],['3','Materials to approve','warn'],['87%','First-time pass','good'],['4','Cube tests pending',''],['12','Inspections this wk','']],
  left:'<div class="card" style="border-left:3px solid var(--gold)"><h2>Raise — using the project inspection format <span class="r">issued every time + attachments</span></h2>'+
      '<div class="tmplnote">Each request goes out in <b>this project\'s standard WIR/MIR format</b>, with the ITP checklist and all attachments (drawing, photos) built in. Fill it, Generate, and the inspection workflow starts — QA inspects, consultant witnesses, approved to proceed.</div>'+
      '<div class="actbar"><button class="prim" data-new="wir">+ Inspection request (WIR)</button><button class="prim" data-new="mir">+ Material inspection (MIR)</button><button data-new="ncrform">+ NCR</button><button data-new="ms">+ Method statement</button><button data-new="rfi">+ RFI</button></div></div>'+
      regTable('inspections')+regTable('ncr'),
  right: regTable('matapp')+
      '<div class="card"><h2>Awaiting your action <span class="r">4 items</span></h2>'+
      q('WIR-221','WIR','','WIR-221 — L4 slab pre-pour','Raised by site · your inspection','Today',true)+
      q('MAR-046','MAR','','MAR-046 — External paint','Material approval · spec check','',true)+
      q('NCR-014','NCR','ncr','NCR-014 — Blockwork L3','Close-out evidence submitted','',true)+
      q('CUBE-32','TEST','','Cube set C-32 / 28-day','Result due — record &amp; sign','',false)+
      '</div>'+
      '<div class="card"><h2>Live activity</h2>'+feed([
        ['r','WIR-219','failed — waterproofing','20m','WIR-219'],['a','NCR-014','raised from WIR-219','20m','NCR-014'],
        ['g','MIR-088','material approved','2h','MIR-088'],['','WIR-220','approved & signed','4h','WIR-220'],
        ['g','Cube C-25','28-day pass 41 MPa','y\'day']])+'</div>'};
},

hse:function(){return {cols:6,
  bar:'Signed in as <b>HSE Officer</b> — permits, observations and incidents, with every certificate and permit backup in one place. Post the daily update and generate the weekly report in one click.',
  kpis:[['142','Days LTI-free','good'],['3','Permits live','act'],['3','Open observations','warn'],['1','Cert expired','bad'],['96%','PPE compliance',''],['0','Incidents this wk','good']],
  left:'<div class="card" style="border-left:3px solid var(--gold)"><h2>Raise / update <span class="r">daily &amp; weekly</span></h2>'+
      '<div class="actbar"><button class="prim" data-hse="daily">Daily HSE update</button><button class="prim" data-report="weekly">Weekly report</button></div>'+
      '<div class="actbar" style="margin-top:8px"><button data-new="ptw">+ Permit to work</button><button data-new="obs">+ Observation</button><button data-new="incident">+ Incident / near-miss</button></div>'+
      '<div class="mini" style="margin-top:9px">Daily update posts today\'s toolbox, PPE and headcount; the weekly report is generated from the registers below.</div></div>'+
      regTable('permits')+regTable('certs'),
  right: regTable('hseobs')+
      '<div class="card"><h2>Needs you now <span class="r">2</span></h2>'+
      q('PTW-209','PTW','hse','PTW-209 — hot work L2','Sign before work starts','',true)+
      q('OBS-051','OBS','hse','OBS-051 — edge protection L2','Close-out photo submitted','Overdue',true)+
      '</div>'+
      '<div class="card"><h2>Safety activity</h2>'+feed([
        ['r','CERT-LIFT-01','lifting gear cert expired','1h','CERT-LIFT-01'],['a','NM-009','near-miss logged','2h','NM-009'],
        ['r','OBS-051','raised — high risk','3h','OBS-051'],['g','Toolbox','L4 crew — 22 attended','5h']])+'</div>'};
},

commercial:function(){return {cols:6,
  bar:'Signed in as <b>Contracts &amp; Commercial</b> — the money and the contract in one place: the priced BOQ, the material budget (BOM), payment certificates, variations and contractual letters. Create variations and letters from your project templates; export any register to Excel. <span style="color:var(--gold)">This email also holds Procurement and Finance.</span>',
  kpis:[['AED 66.1m','Certified to date','good'],['AED 4.41m','IPA-05 (net)','act'],['4','Variations open','warn'],['1','Over BOM','bad'],['3','Letters to action','warn'],['AED 1.9m','VOs pending','']],
  left:'<div class="card" style="border-left:3px solid var(--gold)"><h2>Create — from your project templates <span class="r">generates the document + workflow</span></h2>'+
      '<div class="actbar"><button class="prim" data-new="variation">+ Variation</button><button class="prim" data-new="letter">+ Contractual letter</button><button data-new="rfi">+ RFI</button></div></div>'+
      regTable('boq')+regTable('ipc')+regTable('variations'),
  right: regTable('letters')+
      '<div class="card"><h2>Bill of Materials — value vs budget <span class="r">1 over BOM</span></h2><table><tr><th>Material</th><th>BOM</th><th>Ordered</th><th>Status</th></tr>'+
      row('BOM-block',['Solid block 200mm','38,000','39,200',pill('Over BOM','late')])+
      row('BOM-rebar',['Rebar T16–T25','420 t','405',pill('Near limit','warn')])+
      row('BOM-conc',['C40 ready-mix','1,250','1,180',pill('OK','ok')])+
      '</table><div class="mini">Ordering control sits in Procurement; here the commercial view watches material value against the budget.</div></div>'+
      '<div class="card"><h2>Live activity</h2>'+feed([
        ['g','VO-05','approved by client','1h','VO-05'],['a','IPA-05','certified by Engineer','2d','IPC-05'],
        ['r','VO-07','escalated to PM','2h','VO-07'],['g','LTR-089','LD reply issued','y\'day','LTR-089']])+'</div>'};
},

procurement:function(){return {cols:6,
  bar:'Signed in as <b>Procurement</b> — material requests from site, purchase orders, and deliveries landing against them. <span style="color:var(--gold)">Every order is checked against the Bill of Materials before it can be raised.</span>',
  kpis:[['5','Requests to action','act'],['1','Over BOM','bad'],['3','Deliveries due','warn'],['AED 2.1m','Committed',''],['12','LPOs this month',''],['2','Long-lead at risk','warn']],
  left:'<div class="card"><h2>Bill of Materials — order control <span class="r">1 over BOM</span></h2><table><tr><th>Material</th><th>BOM</th><th>Ordered</th><th>Received</th><th>Balance</th><th>Status</th></tr>'+
      row('BOM-conc',['C40 ready-mix','1,250 m³','1,180','1,050','+70',pill('OK','ok')])+
      row('BOM-rebar',['Rebar T16–T25','420 t','405','390','+15',pill('Near limit','warn')])+
      row('BOM-block',['Solid block 200mm','38,000 no','39,200','36,000','−1,200',pill('Over BOM','late')])+
      row('BOM-gyp',['Gypsum board','12,000 m²','8,400','7,900','+3,600',pill('OK','ok')])+
      '</table><div class="mini">The BOM is the approved material budget (take-off + agreed wastage). Every request and LPO draws against it. An order that pushes the ordered quantity past the BOM allowance is blocked until PM &amp; Commercial approve it with a reason.</div></div>'+
      '<div class="card"><h2>Material requests → LPO <span class="r">5 open</span></h2><table><tr><th>Ref</th><th>Material</th><th>For</th><th>BOM check</th><th>Status</th></tr>'+
      
      
      
      
      '</table></div>',
  right:'<div class="card"><h2>To action <span class="r">4</span></h2>'+
      q('MR-059','BOM','ncr','MR-059 — extra blockwork','Exceeds BOM by 60 no — needs approval','Over BOM',false)+
      q('MR-058','MR','','MR-058 — screed 30N','Within BOM · raise LPO · needed 17 Sep','Today',false)+
      q('LPO-118','LPO','','LPO-118 — Gulf Ready-mix','Finance to add before release','',false)+
      q('GRN-042','GRN','','GRN-042 — gypsum delivery','Arriving — brief site to receive','',false)+
      '</div>'+
      '<div class="card"><h2>Supply activity</h2>'+feed([
        ['r','MR-059','blocked — over BOM','15m','MR-059'],['g','LPO-116','received in full','1h','LPO-116'],
        ['a','LPO-117','part-delivered','3h'],['','MR-057','converted to LPO','5h']])+'</div>'};
},

finance:function(){return {cols:6,
  bar:'Signed in as <b>Finance</b> — money in from certified IPCs, money out to suppliers, and the GRN-to-invoice match that gates every payment.',
  kpis:[['AED 4.41m','Due in (IPC-05)','good'],['AED 1.42m','Payable this wk','warn'],['3','GRNs to match','act'],['AED 0.62m','Held on retention',''],['2','Invoices in query','bad'],['AED 3.7m','Received IPC-04','good']],
  left:'<div class="card"><h2>Payment gate — GRN → invoice → release</h2><table><tr><th>GRN</th><th>Supplier</th><th>Invoice</th><th>Gate</th></tr>'+
      
      
      
      '</table><div class="mini">Nothing is paid until the engineer and PM have signed the GRN and it matches the invoice.</div></div>'+
      '<div class="card"><h2>Cashflow <span class="r">next 30 days</span></h2>'+
      bars([['IPC-05 in',100,'var(--good)'],['Suppliers out',62,'var(--bad)'],['Subs out',44,'var(--gold)'],['Net position',71]])+'</div>',
  right:'<div class="card"><h2>To action <span class="r">3</span></h2>'+
      q('GRN-041','GRN','ipc','GRN-041 — release payment','Matched to INV-2291 · AED 61,200','',true)+
      q('GRN-040','GRN','ncr','GRN-040 — resolve mismatch','Delivered 480, invoiced 520 tins','Hold',false)+
      q('IPC-05','IPC','ipc','IPC-05 — record incoming','AED 4.41m certified · book receipt','',false)+
      '</div>'+
      '<div class="card"><h2>Ledger activity</h2>'+feed([
        ['g','INV-2291','matched to GRN-041','1h','GRN-041'],['a','IPC-04','AED 3.7m received','y\'day'],
        ['r','INV-2285','flagged mismatch','2d','GRN-040'],['g','Retention','AED 220k released','3d']])+'</div>'};
},

contracts:function(){return {cols:6,
  bar:'Signed in as <b>Contracts &amp; Claims</b> — the contractual letters, notices and time claims that protect the position.',
  kpis:[['3','Letters to issue','act'],['2','Live EoT claims','warn'],['12 d','Notice due in','bad'],['AED 1.9m','Claim value',''],['4','Obligations open',''],['0','Missed notices','good']],
  left:'<div class="card"><h2>Contractual letters <span class="r">3 to issue</span></h2><table><tr><th>Ref</th><th>Subject</th><th>Type</th><th>Status</th></tr>'+
      
      
      
      '</table></div>'+
      '<div class="card"><h2>Claims &amp; EoT <span class="r">2 live</span></h2><table><tr><th>Ref</th><th>Basis</th><th>Days</th><th>Status</th></tr>'+
      
      
      '</table><div class="mini">Notice for EoT-02 must go within 28 days of the event (VO-07 · 22 Aug).</div></div>',
  right:'<div class="card"><h2>Time-critical <span class="r">3</span></h2>'+
      q('LTR-092','LTR','vo','LTR-092 — issue EoT notice','28-day window closes in 12 days','Sign to issue',true)+
      q('EOT-02','EOT','vo','EoT-02 — attach delay analysis','Planning to provide CPM impact','',false)+
      q('LTR-091','LTR','','LTR-091 — finalise IFC delay letter','Consultant dates confirmed','',false)+
      '</div>'+
      '<div class="card"><h2>Contract activity</h2>'+feed([
        ['a','VO-07','triggers EoT clock','1h','VO-07'],['g','LTR-089','LD reply issued','y\'day'],
        ['','EoT-01','acknowledged by client','2d'],['r','Notice','EoT-02 window opened','3d']])+'</div>'};
},

subcon:function(){return {cols:6,
  bar:'Signed in as <b>Subcontractor Coordinator</b> — every package, their progress, valuations, quality and safety compliance in one place.',
  kpis:[['6','Active packages',''],['2','Valuations due','act'],['1','Behind programme','bad'],['AED 6.2m','To value',''],['3','Sub NCRs open','warn'],['92%','HSE compliant','good']],
  left:'<div class="card"><h2>Subcontractor packages</h2><table><tr><th>Package</th><th>Sub</th><th>Progress</th><th>Status</th></tr>'+
      
      
      
      
      '</table></div>'+
      '<div class="card"><h2>Sub valuations due <span class="r">2</span></h2><table><tr><th>Sub</th><th>Package</th><th>This month</th><th>Status</th></tr>'+
      
      row('',['Inches & Feet','MEP','AED 910k',pill('To value','warn')])+
      '</table></div>',
  right:'<div class="card"><h2>Needs you <span class="r">3</span></h2>'+
      q('SUB-VAL','SUB','','Ciginetex — value September','Verify % then send to QS','',false)+
      q('SUB-ALU','SUB','ncr','Alumco — behind programme','Recovery plan due from sub','Behind',false)+
      q('NCR-012','NCR','ncr','NCR-012 — Alumco bracket fixing','Sub to respond','',false)+
      '</div>'+
      '<div class="card"><h2>Subcontractor activity</h2>'+feed([
        ['g','Inches & Feet','L1 MEP 1st fix done','2h'],['r','Alumco','missed bracket date','5h'],
        ['a','Ciginetex','valuation submitted','y\'day'],['g','Emirates Int.','L2 boards up','y\'day']])+'</div>'};
},

consultant:function(){return {cols:6,
  bar:'Signed in as <b>Consultant / Client Engineer</b> — you see everything, and you act on what needs your approval: RFIs, submittals, drawings, inspections and the payment certificate.',
  kpis:[['4','RFIs to answer','act'],['3','Submittals to review','warn'],['2','Inspections to witness',''],['1','IPC to certify','bad'],['63%','Progress (info)',''],['87%','First-time pass','good']],
  left:'<div class="card"><h2>On your desk</h2><table><tr><th>Ref</th><th>Item</th><th>From</th><th>Due</th></tr>'+
      
      
      
      
      '</table></div>'+
      '<div class="card"><h2>Inspections to witness <span class="r">2</span></h2><table><tr><th>Ref</th><th>Location</th><th>When</th><th>Status</th></tr>'+
      
      
      '</table></div>',
  right:'<div class="card"><h2>Approvals waiting on you <span class="r">4</span></h2>'+
      q('RFI-0034','RFI','','RFI-0034 — answer the query','Handrail detail · reply due 15 Sep','',true)+
      q('IPC-05','IPC','ipc','IPC-05 — certify the valuation','QS & PM signed · your certificate','',true)+
      q('SUB-076','SUB','','SUB-076 — review submittal','External paint · check spec','',true)+
      q('AR-412','DWG','dwg','AR-412 Rev C — status the drawing','Approve / approve-as-noted / reject','',true)+
      '</div>'+
      '<div class="card"><h2>Recent from site</h2>'+feed([
        ['','RFI-0033','you answered','3h','RFI-0033'],['g','WIR-220','you approved','4h','WIR-220'],
        ['a','IPC-05','submitted to you','y\'day','IPC-05'],['r','WIR-219','you failed — WP','2d','WIR-219']])+'</div>'};
},

};

/* =========================================================================
   4.  RECORDS — the "what opens when you click" screens.
       Generic detail is used for any ref not spelled out here, so no click
       is ever dead.
   ========================================================================= */
function sigDone(name,role,when,esign){
  return '<div class="sig"><span class="'+(esign?'esign':'script')+'">'+name+'</span><div class="sm">'+(esign?'e-signature':'signature on file')+'<br>'+role+' · '+when+'</div></div>';
}
var RECORDS = {
'VO-07':{type:'Variation Order', title:'Coral pond civil works', status:'PM review', sc:'warn',
  facts:[['Reference','VO-07'],['Origin','RFI-0031 → instruction'],['Cost effect','AED 214,000'],['Time effect','+12 days'],['Raised','7 Sep 2026'],['Value to date','AED 2.1m (all VOs)']],
  desc:'Additional civil works to the coral feature pond following the client\'s design change captured in RFI-0031. Excavation, blinding, waterproof RC tanking and puddle flanges. Priced from measured quantities against the BOQ rates; new items starred where no rate exists.',
  wf:[
    {st:'Raised by Site Engineer',who:'R. Kumar · Site',state:'done',when:'7 Sep',sig:['R. Kumar','Site Engineer','7 Sep 09:20']},
    {st:'Priced & measured',who:'K. Nair · QS',state:'done',when:'9 Sep',sig:['K. Nair','Commercial / QS','9 Sep 14:02']},
    {st:'PM review & sign',who:'M. Said · PM',state:'now',when:'Due today',sig:null},
    {st:'Director approval',who:'A. Mattappilly · Principal',state:'wait',when:'—',sig:null},
    {st:'Client instruction',who:'DEC · Consultant',state:'wait',when:'—',sig:null},
  ],
  links:[['RFI','RFI-0031','Coral pond redesign query'],['EOT','EOT-02','+12 day time claim'],['DWG','AR-355','Revised pond GA']],
  att:[['VO-07 pricing sheet.xlsx','42 KB'],['Marked-up drawing AR-355.pdf','1.8 MB'],['Supplier quote — tanking.pdf','220 KB']],
  audit:[['R. Kumar','raised the variation','7 Sep 09:20'],['K. Nair','added pricing (AED 214,000)','9 Sep 14:02'],['System','routed to PM for review','9 Sep 14:02']]},

'IPC-05':{type:'Interim Payment Certificate', title:'September valuation', status:'Certified — awaiting client payment', sc:'wp',
  facts:[['Reference','IPC-05'],['From application','IPA-05'],['Period','1–30 Sep 2026'],['Applied','AED 4.41m'],['Certified by Engineer','AED 4.41m'],['Payment due','within 56 days']],
  desc:'The Engineer\'s certificate issued against the contractor\'s application (IPA-05). The Engineer certified the net amount; under FIDIC the Employer (client) then pays within 56 days of the certificate. The contractor does not release this payment — it receives it. Finance records the receipt when it lands.',
  wf:[
    {st:'Application submitted by contractor',who:'M. Said · PM',state:'done',when:'12 Sep',sig:['M. Said','Project Manager','12 Sep 09:00']},
    {st:'Engineer certifies (within 28 days)',who:'DEC · Engineer',state:'done',when:'12 Sep',sig:['DEC — J. Thomas','Consultant Engineer','12 Sep 11:30',true]},
    {st:'Employer / client pays (within 56 days)',who:'Client',state:'now',when:'Awaiting client',sig:null},
    {st:'Finance records receipt',who:'K. Nair · Finance',state:'wait',when:'—',sig:null},
  ],
  links:[['IPA','IPA-05','Contractor application'],['VO','VO-05','Included — AED 310k'],['IPC','IPC-04','Previous — AED 3.7m paid']],
  att:[['IPC-05 certificate.pdf','680 KB'],['Measurement backup.xlsx','1.2 MB'],['Consultant certificate.pdf','140 KB']],
  audit:[['M. Said','submitted application to Engineer','12 Sep 09:00'],['DEC','certified AED 4.41m','12 Sep 11:30'],['System','awaiting client payment (56-day)','12 Sep 11:30']]},

'RFI-0034':{type:'Request for Information', title:'Staircase-2 handrail detail', status:'Awaiting reply', sc:'wp',
  facts:[['Reference','RFI-0034'],['Discipline','Architectural'],['Raised','12 Sep 2026'],['Reply due','15 Sep 2026'],['Priority','Normal'],['Location','Staircase 2, all levels']],
  desc:'The IFC drawing AR-208 shows a 900 mm handrail but the fire strategy calls for 1100 mm at the open stair. Please confirm the governing height and the fixing detail at the mid-landing so fabrication can proceed.',
  wf:[
    {st:'Raised by Site',who:'R. Kumar · Site',state:'done',when:'12 Sep',sig:['R. Kumar','Site Engineer','12 Sep 10:40']},
    {st:'PM approved to issue',who:'M. Said · PM',state:'done',when:'12 Sep',sig:['M. Said','Project Manager','12 Sep 10:50']},
    {st:'Transmitted to consultant',who:'P. George · Doc Control',state:'done',when:'12 Sep',sig:['P. George','Document Controller','12 Sep 10:55']},
    {st:'Consultant to answer',who:'DEC · Consultant',state:'now',when:'Reply due 15 Sep',sig:null},
    {st:'Closed & distributed',who:'P. George · Doc Control',state:'wait',when:'—',sig:null},
  ],
  links:[['DWG','AR-208','Staircase details (IFC)'],['SUB','SUB-071','Handrail shop drawing']],
  att:[['RFI-0034 with sketch.pdf','340 KB'],['Photo — mid-landing.jpg','1.1 MB']],
  audit:[['R. Kumar','raised the RFI','12 Sep 10:40'],['P. George','transmitted to DEC','12 Sep 10:55']]},

'AR-412':{type:'Shop Drawing', title:'4th floor reflected ceiling plan — Rev C', status:'Awaiting PM approval to submit', sc:'warn',
  facts:[['Reference','AR-412'],['Revision','C'],['Discipline','Architectural'],['Prepared','13 Sep 2026'],['Supersedes','Rev B (12 Aug)'],['On site','only latest approved rev']],
  desc:'Contractor\'s shop drawing for the Level 4 reflected ceiling, coordinating gypsum, lighting, diffusers and sprinklers. Rev C incorporates the coordination comments on Rev B. The PM approves it internally, then it is submitted to the consultant, who returns a status (Approved · Approved as noted · Revise & resubmit · Rejected). Only the latest consultant-approved revision is shown to the site crews.',
  wf:[
    {st:'Prepared by contractor',who:'R. Kumar · Site',state:'done',when:'13 Sep',sig:['R. Kumar','Site Engineer','13 Sep 13:30']},
    {st:'PM approve to submit',who:'M. Said · PM',state:'now',when:'On you',sig:null},
    {st:'Submitted to consultant',who:'P. George · Doc Control',state:'wait',when:'—',sig:null},
    {st:'Consultant returns status',who:'DEC · Consultant',state:'wait',when:'Approved / as noted / revise / rejected',sig:null},
  ],
  links:[['DWG','AR-411','L4 floor finishes'],['RFI','RFI-0029','Diffuser layout (closed)']],
  att:[['AR-412 Rev C.pdf','2.4 MB'],['Coordination markup.pdf','900 KB']],
  audit:[['R. Kumar','prepared Rev C','13 Sep 13:30'],['System','held Rev B pending consultant approval','13 Sep 13:30']]},

'WIR-221':{type:'Work Inspection Request', title:'L4 slab — pre-pour inspection', status:'Awaiting inspection', sc:'wp',
  facts:[['Reference','WIR-221'],['Type','Civil — pre-pour'],['Location','Level 4 slab'],['Raised','13 Sep 2026'],['Inspection','14 Sep 08:00'],['Checklist','ITP-C-04']],
  desc:'Pre-pour inspection for the Level 4 suspended slab: rebar size, spacing, cover, laps, cast-in items and formwork. Consultant to witness. Pour cannot proceed until this WIR is approved and signed.',
  wf:[
    {st:'Raised by Site',who:'R. Kumar · Site',state:'done',when:'13 Sep',sig:['R. Kumar','Site Engineer','13 Sep 15:10']},
    {st:'QA/QC inspects',who:'S. Rahman · QA/QC',state:'now',when:'14 Sep 08:00',sig:null},
    {st:'Consultant witnesses',who:'DEC · Consultant',state:'wait',when:'14 Sep 08:00',sig:null},
    {st:'Approved to pour',who:'S. Rahman · QA/QC',state:'wait',when:'—',sig:null},
  ],
  links:[['DWG','ST-208','L4 slab rebar (current)'],['ITP','ITP-C-04','Concrete inspection plan']],
  att:[['WIR-221 checklist.pdf','120 KB'],['Rebar photos (6).zip','4.2 MB']],
  audit:[['R. Kumar','raised WIR for L4 slab','13 Sep 15:10'],['System','notified QA/QC & consultant','13 Sep 15:10']]},

'WIR-219':{type:'Work Inspection Request', title:'Podium 3 waterproofing', status:'Failed — NCR raised', sc:'late',
  facts:[['Reference','WIR-219'],['Type','Civil — waterproofing'],['Location','Podium 3'],['Result','Failed'],['Raised NCR','NCR-013'],['Reinspection','Pending']],
  desc:'Waterproofing membrane inspection at Podium 3. Failed on lap width and termination detail at the upstand. An NCR was raised automatically and the site engineer notified; reinspection required after rectification.',
  wf:[
    {st:'Raised by Site',who:'R. Kumar · Site',state:'done',when:'11 Sep',sig:['R. Kumar','Site Engineer','11 Sep 11:00']},
    {st:'QA/QC inspected — FAILED',who:'S. Rahman · QA/QC',state:'done',when:'11 Sep',sig:['S. Rahman','QA/QC Engineer','11 Sep 14:20']},
    {st:'NCR raised',who:'System → NCR-013',state:'done',when:'11 Sep',sig:null},
    {st:'Rectify & reinspect',who:'R. Kumar · Site',state:'now',when:'Pending',sig:null},
  ],
  links:[['NCR','NCR-013','Waterproofing lap defect']],
  att:[['WIR-219 fail report.pdf','160 KB'],['Defect photos (4).zip','2.8 MB']],
  audit:[['S. Rahman','failed the inspection','11 Sep 14:20'],['System','raised NCR-013','11 Sep 14:20']]},

'NCR-014':{type:'Non-Conformance Report', title:'Blockwork alignment — L3 Zone C', status:'Open', sc:'late',
  facts:[['Reference','NCR-014'],['Raised','8 Sep 2026'],['Age','5 days'],['Severity','Major'],['Location','Level 3, Zone C'],['Owner','Site Engineer']],
  desc:'Blockwork out of alignment beyond tolerance (18 mm over 3 m) at L3 Zone C. Disposition: cut and re-lay affected courses. Close-out evidence (survey + photos) required before QA/QC can verify and close.',
  wf:[
    {st:'Raised by QA/QC',who:'S. Rahman · QA/QC',state:'done',when:'8 Sep',sig:['S. Rahman','QA/QC Engineer','8 Sep 09:30']},
    {st:'Site rectifies',who:'R. Kumar · Site',state:'done',when:'12 Sep',sig:['R. Kumar','Site Engineer','12 Sep 16:00']},
    {st:'QA/QC verifies & closes',who:'S. Rahman · QA/QC',state:'now',when:'On you',sig:null},
  ],
  links:[['WIR','WIR-218','Blockwork L3 (failed)'],['DWG','AR-303','L3 block layout']],
  att:[['NCR-014.pdf','180 KB'],['Close-out survey.pdf','300 KB'],['After photos (5).zip','3.1 MB']],
  audit:[['S. Rahman','raised the NCR','8 Sep 09:30'],['R. Kumar','submitted close-out evidence','12 Sep 16:00']]},

'MAR-046':{type:'Material Approval Request', title:'External paint — Spot Lite', status:'Awaiting QA approval', sc:'wp',
  facts:[['Reference','MAR-046'],['Material','Weathershield ext. paint'],['Supplier','Spot Lite'],['Spec ref','09 91 00'],['Submitted','12 Sep 2026'],['Samples','3 colours']],
  desc:'Material approval request for the external weathershield paint. The contractor\'s QA checks it against specification section 09 91 00, the PM endorses it, and it is submitted to the consultant for their approval. Consultant approval is what releases the LPO to procurement.',
  wf:[
    {st:'Submitted by sub',who:'Alumco · Facade',state:'done',when:'12 Sep',sig:null},
    {st:'QA/QC checks spec',who:'S. Rahman · QA/QC',state:'done',when:'12 Sep',sig:['S. Rahman','QA/QC Engineer','12 Sep 12:00']},
    {st:'PM endorses',who:'M. Said · PM',state:'now',when:'On you',sig:null},
    {st:'Consultant approval',who:'DEC · Consultant',state:'wait',when:'Consultant to action',sig:null},
  ],
  links:[['SUB','SUB-076','Paint submittal'],['LPO','LPO-117','Held pending approval']],
  att:[['MAR-046 datasheet.pdf','410 KB'],['Sample board photo.jpg','1.4 MB']],
  audit:[['Alumco','submitted material','12 Sep 09:00'],['P. George','logged & routed to QA','12 Sep 10:00']]},

'GRN-041':{type:'Goods Received Note', title:'Gypsum board delivery — Emirates Gypsum', status:'Matched — pay', sc:'ok',
  bom:{label:'Gypsum board', unit:'m²', allow:12000, ordered:8400, received:7900},
  facts:[['Reference','GRN-041'],['Against LPO','LPO-116'],['Supplier','Emirates Gypsum'],['Delivered','y\'day'],['Received qty','1,800 m²'],['Value','AED 61,200']],
  desc:'Delivery of gypsum board against LPO-116. Quantity and condition checked on site, signed by the receiving engineer and the PM, then matched to the supplier invoice. The received quantity draws down the gypsum BOM line automatically (meter above). Payment is gated on this chain — nothing is released until both signatures and the invoice match.',
  wf:[
    {st:'LPO issued',who:'K. Nair · Procurement',state:'done',when:'2 Sep',sig:['K. Nair','Procurement','2 Sep 10:00']},
    {st:'Received on site',who:'R. Kumar · Site',state:'done',when:'y\'day',sig:['R. Kumar','Site Engineer','y\'day 11:20']},
    {st:'GRN approved',who:'M. Said · PM',state:'done',when:'y\'day',sig:['M. Said','Project Manager','y\'day 15:00']},
    {st:'Invoice matched',who:'K. Nair · Finance',state:'done',when:'Today',sig:['K. Nair','Finance','Today 09:00']},
    {st:'Payment release',who:'K. Nair · Finance',state:'now',when:'On you',sig:null},
  ],
  links:[['LPO','LPO-116','Emirates Gypsum — AED 61,200'],['MR','MR-057','Gypsum board request'],['BOM','BOM-gyp','Draws down the gypsum line']],
  att:[['GRN-041 signed.pdf','200 KB'],['Delivery note.pdf','90 KB'],['INV-2291.pdf','110 KB']],
  audit:[['R. Kumar','received & counted','y\'day 11:20'],['M. Said','approved GRN','y\'day 15:00'],['K. Nair','matched invoice','Today 09:00']]},

'LTR-092':{type:'Contractual Letter', title:'Extension of time notice — coral pond', status:'Draft — sign to issue', sc:'warn',
  facts:[['Reference','LTR-092'],['Type','Notice (EoT)'],['To','Client / Consultant'],['Drafted','13 Sep 2026'],['Deadline','28 days from 22 Aug'],['Days remaining','12']],
  desc:'Formal notice of a claim for extension of time arising from the coral pond redesign (VO-07 / EOT-02). Must be issued within the 28-day contractual window. Awaiting the director\'s signature to release; will be transmitted and logged on issue.',
  wf:[
    {st:'Drafted by Contracts',who:'Contracts',state:'done',when:'13 Sep',sig:['Contracts','Contracts & Claims','13 Sep 09:12']},
    {st:'Director sign',who:'A. Mattappilly · Principal',state:'now',when:'12 days left',sig:null},
    {st:'Issued & logged',who:'P. George · Doc Control',state:'wait',when:'—',sig:null},
  ],
  links:[['EOT','EOT-02','+12 day claim'],['VO','VO-07','Triggering event']],
  att:[['LTR-092 draft.pdf','130 KB'],['Delay analysis extract.pdf','280 KB']],
  audit:[['Contracts','drafted the notice','13 Sep 09:12'],['System','flagged 28-day deadline','13 Sep 09:12']]},

'PTW-209':{type:'Permit to Work', title:'Hot work — Level 2', status:'Awaiting HSE sign', sc:'warn',
  facts:[['Reference','PTW-209'],['Type','Hot work — welding'],['Location','Level 2, Zone A'],['Valid','14 Sep 07:00–17:00'],['Fire watch','Assigned'],['Precautions','Extinguisher, screens']],
  desc:'Permit for welding works at Level 2 tomorrow. Fire watch nominated, combustibles cleared, extinguisher and screens in place. HSE to sign before work starts; permit auto-expires at 17:00.',
  wf:[
    {st:'Requested by Site',who:'R. Kumar · Site',state:'done',when:'13 Sep',sig:['R. Kumar','Site Engineer','13 Sep 16:00']},
    {st:'HSE review & sign',who:'A. Farouk · HSE',state:'now',when:'Before work',sig:null},
    {st:'Close out at end of shift',who:'A. Farouk · HSE',state:'wait',when:'—',sig:null},
  ],
  links:[['OBS','OBS-051','Edge protection nearby (open)']],
  att:[['PTW-209 form.pdf','95 KB'],['Fire watch acknowledgement.pdf','60 KB']],
  audit:[['R. Kumar','requested permit','13 Sep 16:00'],['System','routed to HSE','13 Sep 16:00']]},

'OBS-051':{type:'HSE Observation', title:'Edge protection missing — Level 2', status:'Open — high risk', sc:'late',
  facts:[['Reference','OBS-051'],['Risk','High'],['Location','Level 2 perimeter'],['Raised','13 Sep 2026'],['Assigned','Site Engineer'],['Due','Same day']],
  desc:'Edge protection missing along a 6 m run of the Level 2 perimeter. High-risk fall hazard. Work in the zone stopped until reinstated. Close-out photo required.',
  wf:[
    {st:'Raised by HSE',who:'A. Farouk · HSE',state:'done',when:'13 Sep',sig:['A. Farouk','HSE Officer','13 Sep 08:30']},
    {st:'Site rectifies',who:'R. Kumar · Site',state:'done',when:'13 Sep',sig:['R. Kumar','Site Engineer','13 Sep 12:00']},
    {st:'HSE verifies & closes',who:'A. Farouk · HSE',state:'now',when:'On you',sig:null},
  ],
  links:[['PTW','PTW-209','Hot work same zone']],
  att:[['OBS-051 photo.jpg','1.2 MB'],['Close-out photo.jpg','1.1 MB']],
  audit:[['A. Farouk','raised observation','13 Sep 08:30'],['R. Kumar','reinstated edge protection','13 Sep 12:00']]},

'LPO-118':{type:'Purchase Order', title:'Ready-mix concrete — Gulf Ready-mix', status:'Issued', sc:'ok',
  facts:[['Reference','LPO-118'],['Supplier','Gulf Ready-mix'],['Against MR','MR-054'],['Value','AED 142,000'],['Issued','12 Sep 2026'],['Delivery','16 Sep — L4 pour']],
  desc:'Purchase order for C40 ready-mix for the Level 4 slab pour. Raised from the site material request, priced against the supply agreement, and added to the finance commitment ledger. Delivery will be received against a GRN.',
  wf:[
    {st:'Material request',who:'R. Kumar · Site',state:'done',when:'10 Sep',sig:['R. Kumar','Site Engineer','10 Sep 08:00']},
    {st:'LPO raised',who:'K. Nair · Procurement',state:'done',when:'12 Sep',sig:['K. Nair','Procurement','12 Sep 10:30']},
    {st:'Finance commits',who:'K. Nair · Finance',state:'done',when:'12 Sep',sig:['K. Nair','Finance','12 Sep 11:00']},
    {st:'Delivery / GRN',who:'R. Kumar · Site',state:'wait',when:'16 Sep',sig:null},
  ],
  links:[['MR','MR-054','C40 concrete request'],['DWG','ST-208','L4 slab (pour ref)']],
  att:[['LPO-118.pdf','120 KB'],['Supply agreement rate.pdf','80 KB']],
  audit:[['K. Nair','raised the LPO','12 Sep 10:30'],['K. Nair','committed in ledger','12 Sep 11:00']]},

'PRJ-naf':{type:'Project', title:'Sample project', status:'On site · 63%', sc:'wp',
  facts:[['Client','Sample client'],['Location','Dubai, UAE'],['Contract finish','8 Nov 2026'],['Forecast','+2 weeks'],['Certified to date','AED 66.1m'],['Open NCRs','2']],
  desc:'The flagship tower. 63% complete against a 67% baseline — a ~4% slip carried on the podium slabs. IPC-05 (AED 4.41m) is certified and waiting on your release. Two NCRs open, one at 5 days. Drill into any discipline from here to see its own dashboard.',
  wf:[{st:'Design',who:'IFC issued',state:'done',when:'Complete',sig:['—','Design','—']},
      {st:'Structure',who:'Superstructure',state:'now',when:'L4 in progress',sig:null},
      {st:'Finishes',who:'Fit-out',state:'wait',when:'From Oct',sig:null},
      {st:'Handover',who:'Snag & DLP',state:'wait',when:'Nov 26',sig:null}],
  links:[['IPC','IPC-05','September — to release'],['VO','VO-07','Coral pond — on you'],['NCR','NCR-014','Blockwork L3']],
  att:[['Master programme.pdf','1.9 MB'],['Weekly report W37.pdf','2.2 MB']],
  audit:[['DEC','certified IPC-05','12 Sep'],['S. Rahman','raised NCR-014','8 Sep']]},
'PRJ-jbbc':{type:'Project', title:'Commercial Tower — JBBC', status:'On track · 42%', sc:'ok',
  facts:[['Client','JBBC'],['Location','Business Bay, Dubai'],['Contract finish','14 Mar 2027'],['Forecast','On track'],['Certified to date','AED 38.4m'],['Open NCRs','0']],
  desc:'Business Bay commercial tower, 42% complete and on programme. VO-11 (facade upgrade, AED 880k) is a client-driven change awaiting your steer. No open NCRs.',
  wf:[{st:'Design',who:'IFC issued',state:'done',when:'Complete',sig:['—','Design','—']},
      {st:'Structure',who:'Superstructure',state:'now',when:'L9 in progress',sig:null},
      {st:'Finishes',who:'Fit-out',state:'wait',when:'2027',sig:null}],
  links:[['VO','VO-11','Facade upgrade — pending']],
  att:[['JBBC programme.pdf','1.6 MB']],
  audit:[['QS','priced VO-11','Today']]},
'PRJ-barari':{type:'Project', title:'Villa Compound — Project three', status:'Snagging · 78%', sc:'wp',
  facts:[['Client','Private'],['Location','Project three, Dubai'],['Contract finish','30 Sep 2026'],['Forecast','On track'],['Stage','Snagging & handover'],['Open NCRs','1']],
  desc:'Nine-villa compound, 78% complete and into snagging. Villa 7 handed over yesterday. One NCR open. Final IPC in preparation.',
  wf:[{st:'Structure',who:'Complete',state:'done',when:'Done',sig:['—','Struct','—']},
      {st:'Finishes',who:'Complete',state:'done',when:'Done',sig:['—','Finish','—']},
      {st:'Snag & handover',who:'In progress',state:'now',when:'Sep 26',sig:null}],
  links:[['IPC','IPC-FINAL','Final valuation — prep']],
  att:[['Snag list.pdf','740 KB']],
  audit:[['PM','handed over villa 7','y\'day']]},
'SUB-076':{type:'Submittal', title:'External paint submittal', status:'To review', sc:'wp',
  facts:[['Reference','SUB-076'],['Discipline','Architectural finishes'],['Spec','09 91 00'],['Submitted','12 Sep 2026'],['Route','QA → Consultant'],['Due','16 Sep 2026']],
  desc:'Technical submittal for the external weathershield paint system: datasheets, warranty, application method and sample board. Reviewed by QA against the material approval, then by the consultant for status.',
  wf:[
    {st:'Submitted by sub',who:'Alumco · Facade',state:'done',when:'12 Sep',sig:null},
    {st:'Logged',who:'P. George · Doc Control',state:'done',when:'12 Sep',sig:['P. George','Document Controller','12 Sep 10:05']},
    {st:'QA review',who:'S. Rahman · QA/QC',state:'now',when:'On you',sig:null},
    {st:'Consultant status',who:'DEC · Consultant',state:'wait',when:'—',sig:null},
  ],
  links:[['MAR','MAR-046','Material approval'],['LPO','LPO-117','Held pending']],
  att:[['SUB-076 package.pdf','2.1 MB'],['Sample board.jpg','1.3 MB']],
  audit:[['Alumco','submitted package','12 Sep 09:00'],['P. George','logged & routed','12 Sep 10:05']]},

/* ---- Activities: site reports finished → PM signs off; critical path tracking ---- */
'ACT-118':{type:'Activity', title:'Blockwork — Level 3, Zone A', status:'Finished — awaiting PM sign-off', sc:'warn',
  facts:[['Reference','ACT-118'],['WBS','Superstructure / L3'],['Trade','Blockwork'],['Planned finish','12 Sep 2026'],['Reported finished','13 Sep by site'],['Counts to progress','on PM sign-off']],
  desc:'The site engineer has marked this activity 100% finished. It does not count toward the reported progress, the programme update, or the payment application until the PM verifies the work on site and signs it off. This is the site-to-PM completion sign-off from the progress app.',
  wf:[
    {st:'Planned',who:'Programme',state:'done',when:'Baseline',sig:['—','Programme','—']},
    {st:'Started on site',who:'R. Kumar · Site',state:'done',when:'2 Sep',sig:['R. Kumar','Site Engineer','2 Sep 07:30']},
    {st:'Marked finished by site',who:'R. Kumar · Site',state:'done',when:'13 Sep',sig:['R. Kumar','Site Engineer','13 Sep 16:20']},
    {st:'PM verify & sign off complete',who:'M. Said · PM',state:'now',when:'On you',sig:null},
  ],
  links:[['WIR','WIR-218','Blockwork inspection'],['DWG','AR-303','L3 block layout'],['ACT','ACT-119','Follows — L2 blockwork']],
  att:[['Completion photos (4).zip','3.4 MB'],['Checklist ITP-A-02.pdf','90 KB']],
  audit:[['R. Kumar','started on site','2 Sep 07:30'],['R. Kumar','marked finished','13 Sep 16:20'],['System','routed to PM for sign-off','13 Sep 16:20']]},

'ACT-120':{type:'Activity', title:'Rebar fixing — Level 4 slab', status:'In progress — critical', sc:'wp',
  facts:[['Reference','ACT-120'],['WBS','Superstructure / L4'],['Trade','Steel fixing'],['Progress','60%'],['On critical path','Yes — 0 days float'],['Planned finish','15 Sep 2026']],
  desc:'Reinforcement fixing to the Level 4 slab, in progress at 60%. It sits on the critical path with zero float — any slip pushes the L4 pour and the contract finish date. It feeds the pre-pour inspection (WIR-221) and then the pour (ACT-121).',
  wf:[
    {st:'Planned',who:'Programme',state:'done',when:'Baseline',sig:['—','Programme','—']},
    {st:'Started on site',who:'R. Kumar · Site',state:'done',when:'11 Sep',sig:['R. Kumar','Site Engineer','11 Sep 07:00']},
    {st:'In progress — 60%',who:'R. Kumar · Site',state:'now',when:'Finish 15 Sep',sig:null},
    {st:'Site marks finished',who:'R. Kumar · Site',state:'wait',when:'—',sig:null},
    {st:'PM sign-off',who:'M. Said · PM',state:'wait',when:'—',sig:null},
  ],
  links:[['WIR','WIR-221','L4 pre-pour inspection'],['ACT','ACT-121','Next — L4 slab pour'],['DWG','ST-208','L4 slab rebar']],
  att:[['Progress photos (3).zip','2.1 MB']],
  audit:[['R. Kumar','started on site','11 Sep 07:00'],['R. Kumar','updated to 60%','13 Sep 13:00']]},

/* ---- PM outgoing approvals: nothing leaves the office without the PM's sign-off ---- */
'SUB-078':{type:'Submittal', title:'L4 slab formwork drawings', status:'Awaiting PM approval to issue', sc:'warn',
  facts:[['Reference','SUB-078'],['Discipline','Structural — temporary works'],['To','DEC · Consultant'],['Prepared by','R. Kumar · Site'],['Spec ref','03 11 00'],['Reply needed','18 Sep 2026']],
  desc:'Formwork and falsework drawings for the Level 4 slab, submitted for the consultant\'s review before the pour. It has been checked on site; it now needs the PM to confirm it is complete and coordinated, and to approve it to issue. On approval the transmittal is raised and Document Control sends it to the consultant, who returns it with a status: Approved · Approved as noted · Revise & resubmit · Rejected.',
  wf:[
    {st:'Prepared & checked on site',who:'R. Kumar · Site',state:'done',when:'13 Sep',sig:['R. Kumar','Site Engineer','13 Sep 14:00']},
    {st:'PM review & approve to issue',who:'M. Said · PM',state:'now',when:'On you',sig:null},
    {st:'Transmitted to consultant',who:'P. George · Doc Control',state:'wait',when:'—',sig:null},
    {st:'Consultant returns status',who:'DEC · Consultant',state:'wait',when:'Reply due 18 Sep',sig:null},
  ],
  links:[['DWG','ST-208','L4 slab rebar (current)'],['WIR','WIR-221','L4 pre-pour inspection']],
  att:[['SUB-078 formwork.pdf','2.6 MB'],['Load calcs.pdf','480 KB']],
  audit:[['R. Kumar','prepared & checked','13 Sep 14:00'],['System','routed to PM for approval','13 Sep 14:00']]},

'RFI-0035':{type:'Request for Information', title:'L2 slab penetration — MEP', status:'Awaiting PM approval to issue', sc:'warn',
  facts:[['Reference','RFI-0035'],['Discipline','Structural / MEP'],['To','DEC · Consultant'],['Raised by','Site'],['Priority','Normal'],['Reply needed','16 Sep 2026']],
  desc:'A 300 mm drainage penetration clashes with a beam at Level 2. Site has raised the query; the PM reviews whether it is answerable and genuinely needed before it goes out — a clean RFI log matters — then approves it to issue. Document Control transmits and logs it, and the reply clock starts.',
  wf:[
    {st:'Raised by Site',who:'R. Kumar · Site',state:'done',when:'Today',sig:['R. Kumar','Site Engineer','Today 08:20']},
    {st:'PM review & approve to issue',who:'M. Said · PM',state:'now',when:'On you',sig:null},
    {st:'Transmitted to consultant',who:'P. George · Doc Control',state:'wait',when:'—',sig:null},
    {st:'Consultant reply',who:'DEC · Consultant',state:'wait',when:'Reply due 16 Sep',sig:null},
  ],
  links:[['DWG','ST-205','L2 beam layout'],['DWG','ME-140','L2 drainage']],
  att:[['RFI-0035 sketch.pdf','260 KB']],
  audit:[['R. Kumar','raised the RFI','Today 08:20'],['System','routed to PM','Today 08:20']]},

'SUB-074':{type:'Submittal', title:'Facade brackets shop drawing', status:'Revise & resubmit', sc:'late',
  facts:[['Reference','SUB-074'],['Discipline','Facade'],['To','DEC · Consultant'],['Sent','8 days ago'],['Returned','Revise & resubmit'],['Revision','A → B due']],
  desc:'The consultant has returned this submittal with the status "Revise & resubmit" — the bracket spacing did not match the structural drawing. The action is back with the contractor: the sub revises, the PM re-approves, and it is re-transmitted. This is one of the four consultant status codes the platform tracks.',
  wf:[
    {st:'Prepared',who:'Alumco · Facade',state:'done',when:'—',sig:null},
    {st:'PM approved & issued',who:'M. Said · PM',state:'done',when:'5 Sep',sig:['M. Said','Project Manager','5 Sep 10:00']},
    {st:'Consultant returned — Revise & resubmit',who:'DEC · Consultant',state:'done',when:'Today',sig:['DEC — J. Thomas','Consultant Engineer','Today 09:30',true]},
    {st:'Revise & resubmit',who:'Alumco → PM',state:'now',when:'Rev B due',sig:null},
  ],
  links:[['DWG','ST-220','Facade support steel'],['MR','MR-055','Facade brackets (long-lead)']],
  att:[['SUB-074 Rev A.pdf','1.9 MB'],['Consultant comments.pdf','120 KB']],
  audit:[['M. Said','approved & issued Rev A','5 Sep 10:00'],['DEC','returned: revise & resubmit','Today 09:30']]},

'IPA-05':{type:'Interim Payment Application', title:'September payment application', status:'Awaiting PM review & submission', sc:'warn',
  facts:[['Reference','IPA-05'],['Period','1–30 Sep 2026'],['Amount applied','AED 4.41m (net)'],['Prepared by','K. Nair · QS'],['Submit to','DEC · Engineer'],['Cert. window','28 days (FIDIC 14.6)']],
  desc:'The contractor\'s monthly payment application (the FIDIC Statement), prepared by the QS from the priced BOQ against verified progress plus approved variations, less retention and previous payments. The PM reviews and submits it to the Engineer, who must certify within 28 days; the Employer then pays within 56 days. Once certified it becomes IPC-05.',
  wf:[
    {st:'Prepared by QS',who:'K. Nair · QS',state:'done',when:'10 Sep',sig:['K. Nair','Commercial / QS','10 Sep 16:40']},
    {st:'PM review & submit',who:'M. Said · PM',state:'now',when:'Due today',sig:null},
    {st:'Engineer certifies (28 days)',who:'DEC · Engineer',state:'wait',when:'—',sig:null},
    {st:'Employer pays (56 days)',who:'Client',state:'wait',when:'—',sig:null},
  ],
  links:[['IPC','IPC-05','Becomes IPC-05 once certified'],['VO','VO-05','Included — AED 310k'],['IPC','IPC-04','Previous — paid AED 3.7m']],
  att:[['IPA-05 application.pdf','680 KB'],['Measurement backup.xlsx','1.2 MB']],
  audit:[['K. Nair','prepared the application','10 Sep 16:40'],['System','routed to PM to submit','10 Sep 16:40']]},

'LTR-093':{type:'Contractual Letter', title:'Progress letter to client', status:'Awaiting PM signature', sc:'warn',
  facts:[['Reference','LTR-093'],['Type','Progress / notice'],['To','Client'],['Drafted by','Contracts'],['Drafted','Today'],['Status','To sign & issue']],
  desc:'Monthly progress letter to the client, drafted by the contracts team. It goes out under the PM\'s signature. On approval it is issued and logged in the outgoing correspondence register with a transmittal.',
  wf:[
    {st:'Drafted',who:'Contracts',state:'done',when:'Today',sig:['Contracts','Contracts & Claims','Today 09:00']},
    {st:'PM sign to issue',who:'M. Said · PM',state:'now',when:'On you',sig:null},
    {st:'Issued & logged',who:'P. George · Doc Control',state:'wait',when:'—',sig:null},
  ],
  links:[['LTR','LTR-092','EoT notice (director sign)']],
  att:[['LTR-093 draft.pdf','110 KB']],
  audit:[['Contracts','drafted the letter','Today 09:00'],['System','routed to PM','Today 09:00']]},

'DEWA-SUB':{type:'Authority Approval', title:'DEWA — substation & connection', status:'NOC awaited — 3 days overdue', sc:'late',
  warn:'This NOC is <b>3 days overdue</b> and it gates a critical activity. DEWA enablement is needed before the substation build (ACT-140) can start — the delay is now feeding the critical path. Chase the authority and flag to the PM.',
  facts:[['Reference','DEWA-SUB'],['Authority','DEWA'],['Scope','Substation + power/water connection'],['Submitted','1 Aug 2026'],['Action by','10 Sep 2026'],['Gates','Substation build (ACT-140)']],
  desc:'Authority approval tracked in the design team\'s authority register. Authorities are configured per project — this one applies to a Dubai Municipality-area plot; a different location or emirate carries a different set (DDA/Trakhees, ADDC, etc.), which the design team adds at project setup. Each authority runs submit → review → NOC → inspection → completion, and links to the programme activity it blocks.',
  wf:[
    {st:'Application submitted',who:'Design team',state:'done',when:'1 Aug',sig:['Design','Design & Documents','1 Aug']},
    {st:'DEWA review',who:'DEWA',state:'done',when:'Aug',sig:null},
    {st:'NOC issued',who:'DEWA',state:'now',when:'Overdue since 10 Sep',sig:null},
    {st:'Inspection',who:'DEWA',state:'wait',when:'—',sig:null},
    {st:'Connection / completion',who:'DEWA',state:'wait',when:'—',sig:null},
  ],
  links:[['ACT','ACT-140','Substation build (gated)'],['DWG','EL-500','Substation layout (IFC)']],
  att:[['DEWA application.pdf','520 KB'],['Load schedule.pdf','180 KB']],
  audit:[['Design team','submitted to DEWA','1 Aug'],['System','flagged NOC overdue (3 d)','Today']]},

'AUTH-NEW':{type:'Authority Approval', title:'Add an authority to this project', status:'Design team setup', sc:'wp',
  facts:[['Set by','Design team'],['When','Project setup'],['Depends on','Location & emirate'],['Examples','DEWA, DCD, DM, DDA, Trakhees, ADDC, RTA'],['Each carries','Submit → NOC → inspection → completion'],['Links to','The activity it gates']],
  desc:'Authorities are not fixed by the platform — they change with the location and emirate. The design team adds the ones that apply to this project at setup: name the authority, the scope, the submission and target dates, and the programme activity it gates. From then on it appears in the authority register with its action-required date, status and delay, and can be pulled into the generated schedule like any other item.',
  wf:[
    {st:'Name the authority & scope',who:'Design team',state:'now',when:'—',sig:null},
    {st:'Set submission & target dates',who:'Design team',state:'wait',when:'—',sig:null},
    {st:'Link to the gated activity',who:'Design team',state:'wait',when:'—',sig:null},
  ],
  links:[['—','—','Appears in the authority register once added']],
  att:[['Authority template.xlsx','—']],
  audit:[['Design team','configures authorities per project','at setup']]},

'SUB-079':{type:'Submittal', title:'Method statement — L4 slab pour', status:'Issued by PM — direct', sc:'wp',
  facts:[['Reference','SUB-079'],['Discipline','Structural — method'],['To','DEC · Consultant'],['Originated by','M. Said · PM (direct)'],['Issued','Today'],['Reply needed','15 Sep 2026']],
  desc:'Raised and issued by the PM directly — the PM did not wait for the site or planning team to prepare it. This is the PM override: originate a submission and issue it in one step. It is stamped and logged against the PM, and is now with the consultant for their action. The PM can do the same to push any queued item past its current step.',
  wf:[
    {st:'Raised & issued by PM',who:'M. Said · PM',state:'done',when:'Today',ovr:true,sig:['M. Said','Project Manager','Today 08:00']},
    {st:'Transmitted to consultant',who:'P. George · Doc Control',state:'done',when:'Today',sig:['P. George','Document Controller','Today 08:05']},
    {st:'Consultant to action',who:'DEC · Consultant',state:'now',when:'Reply due 15 Sep',sig:null},
  ],
  links:[['ACT','ACT-121','L4 slab pour'],['DWG','ST-208','L4 slab rebar']],
  att:[['SUB-079 method statement.pdf','1.1 MB']],
  audit:[['M. Said','raised & issued directly (override)','Today 08:00'],['P. George','transmitted to consultant','Today 08:05']]},

/* ---- Bill of Materials lines (the material budget every order draws against) ---- */
'BOM-block':{type:'Bill of Materials — line', title:'Solid block 200mm — order control', status:'Over BOM', sc:'late',
  bom:{label:'Solid block 200mm', unit:'no', allow:39140, ordered:39200, received:36000},
  warn:'Ordering has passed the BOM allowance. <b>39,200 ordered</b> against an allowance of <b>39,140</b> (38,000 measured + 3% wastage) — <b>over by 60 no</b>. Further ordering is blocked until PM and Commercial approve it with a reason. Over-ordering usually means breakage beyond wastage, rework, or a design change that should be raised as a variation rather than absorbed.',
  facts:[['Material','Solid block 200mm'],['BOM (measured)','38,000 no'],['Wastage allowance','+3% → 39,140'],['Ordered to date','39,200 no'],['Received to date','36,000 no'],['Balance vs BOM','−60 no (over)']],
  desc:'This line is taken from the approved take-off (the BOM skill output) plus the agreed 3% wastage. It is the ceiling for ordering this material. Every material request and LPO for 200 mm block draws against it, and every GRN records what actually arrived. The meter above shows received, ordered and the BOM allowance line — the ordered bar has now crossed it.',
  wf:[
    {st:'BOM baseline set',who:'K. Nair · Commercial',state:'done',when:'Project setup',sig:['K. Nair','Commercial / QS','1 Jul']},
    {st:'Order-control check — EXCEEDED',who:'System · on MR-059',state:'done',when:'Today',sig:null},
    {st:'PM approves over-order',who:'M. Said · PM',state:'now',when:'Pending',sig:null},
    {st:'Commercial confirms cost impact',who:'K. Nair · Commercial',state:'wait',when:'—',sig:null},
  ],
  links:[['MR','MR-059','Blocked request — the trigger'],['LPO','LPO-121','Last order (+1,200 no)'],['GRN','GRN-039','Block delivery — 12,000 no'],['VO','VO-08','Possible variation if design change']],
  att:[['BOM extract — masonry.xlsx','88 KB'],['Take-off backup.pdf','420 KB']],
  audit:[['LPO-119','ordered 26,000 no','Aug'],['GRN — Jul/Aug','received 24,000 no','Aug'],['LPO-120','ordered 12,000 no','2 Sep'],['GRN-039','received 12,000 no','9 Sep'],['LPO-121','ordered 1,200 no — crossed BOM','Today']]},

'BOM-conc':{type:'Bill of Materials — line', title:'C40 ready-mix — order control', status:'Within BOM', sc:'ok',
  bom:{label:'C40 ready-mix concrete', unit:'m³', allow:1250, ordered:1180, received:1050},
  facts:[['Material','C40 ready-mix'],['BOM (measured)','1,214 m³'],['Wastage allowance','+3% → 1,250'],['Ordered to date','1,180 m³'],['Received to date','1,050 m³'],['Headroom','70 m³']],
  desc:'Concrete ordering is within the BOM allowance. The L4 pour (LPO-118, ~130 m³) still sits inside the ceiling. The meter shows the headroom left before an order would need over-BOM approval.',
  wf:[{st:'BOM baseline set',who:'K. Nair · Commercial',state:'done',when:'1 Jul',sig:['K. Nair','Commercial / QS','1 Jul']},
      {st:'Order-control check — within',who:'System',state:'done',when:'Ongoing',sig:null}],
  links:[['LPO','LPO-118','L4 pour — 142,000'],['MR','MR-054','C40 request']],
  att:[['BOM extract — concrete.xlsx','76 KB']],
  audit:[['LPOs to date','ordered 1,180 m³','—'],['GRNs to date','received 1,050 m³','—']]},

'BOM-rebar':{type:'Bill of Materials — line', title:'Rebar T16–T25 — order control', status:'Near limit', sc:'warn',
  bom:{label:'Rebar T16–T25', unit:'t', allow:420, ordered:405, received:390},
  warn:'Only <b>15 t of headroom</b> left against the BOM allowance. The next slab order will likely need review — check the bar-bending schedule before raising it.',
  facts:[['Material','Rebar T16–T25'],['BOM (measured)','408 t'],['Wastage allowance','+3% → 420'],['Ordered to date','405 t'],['Received to date','390 t'],['Headroom','15 t']],
  desc:'Reinforcement is close to the BOM ceiling. Ordering can continue but the remaining headroom is thin; a further order beyond 15 t will trip the over-BOM check.',
  wf:[{st:'BOM baseline set',who:'K. Nair · Commercial',state:'done',when:'1 Jul',sig:['K. Nair','Commercial / QS','1 Jul']},
      {st:'Order-control check — near limit',who:'System',state:'now',when:'Watch',sig:null}],
  links:[['BBS','BBS-L4','L4 bar-bending schedule']],
  att:[['BOM extract — rebar.xlsx','92 KB']],
  audit:[['LPOs to date','ordered 405 t','—'],['GRNs to date','received 390 t','—']]},

'BOM-gyp':{type:'Bill of Materials — line', title:'Gypsum board — order control', status:'Within BOM', sc:'ok',
  bom:{label:'Gypsum board', unit:'m²', allow:12000, ordered:8400, received:7900},
  facts:[['Material','Gypsum board 12.5mm'],['BOM (measured)','11,650 m²'],['Wastage allowance','+3% → 12,000'],['Ordered to date','8,400 m²'],['Received to date','7,900 m²'],['Headroom','3,600 m²']],
  desc:'Gypsum ordering is comfortably within the BOM. Plenty of headroom for the remaining ceiling works.',
  wf:[{st:'BOM baseline set',who:'K. Nair · Commercial',state:'done',when:'1 Jul',sig:['K. Nair','Commercial / QS','1 Jul']},
      {st:'Order-control check — within',who:'System',state:'done',when:'Ongoing',sig:null}],
  links:[['LPO','LPO-116','Emirates Gypsum — 61,200'],['GRN','GRN-041','Gypsum delivery']],
  att:[['BOM extract — gypsum.xlsx','70 KB']],
  audit:[['LPOs to date','ordered 8,400 m²','—'],['GRNs to date','received 7,900 m²','—']]},

/* ---- material requests, the ordering step that hits the BOM check ---- */
'MR-059':{type:'Material Request', title:'Extra blockwork — Level 2 walls', status:'Blocked — over BOM', sc:'late',
  bom:{label:'Solid block 200mm', unit:'no', allow:39140, ordered:39200, received:36000},
  warn:'This request cannot be raised as-is. Requested <b>1,260 no</b>; 37,940 already ordered → <b>39,200 total</b> against a BOM allowance of <b>39,140</b> — <b>exceeds the BOM by 60 no</b>. Reduce the quantity to 1,200, or send it for over-BOM approval with a reason (rework, breakage, or a design change to be raised as a variation).',
  facts:[['Reference','MR-059'],['Material','Solid block 200mm'],['Requested','1,260 no'],['For','Level 2 walls, Zone B'],['Needed','18 Sep 2026'],['BOM check','FAILED — over by 60 no']],
  desc:'Site request for additional 200 mm block to complete the Level 2 walls. On submission the system checked the quantity against the Bill of Materials and found it would push total ordering past the allowance, so the request is held. It moves no further until the quantity is reduced or an over-BOM approval is signed.',
  wf:[
    {st:'Raised by Site',who:'R. Kumar · Site',state:'done',when:'Today',sig:['R. Kumar','Site Engineer','Today 08:40']},
    {st:'BOM order-control check — FAILED',who:'System',state:'done',when:'Today',sig:null},
    {st:'PM approves the over-order',who:'M. Said · PM',state:'now',when:'On hold',sig:null},
    {st:'Commercial confirms impact',who:'K. Nair · Commercial',state:'wait',when:'—',sig:null},
    {st:'Procurement raises LPO',who:'K. Nair · Procurement',state:'wait',when:'—',sig:null},
  ],
  links:[['BOM','BOM-block','Solid block 200mm line'],['VO','VO-08','Raise as variation if design change']],
  att:[['MR-059 request.pdf','60 KB']],
  audit:[['R. Kumar','raised the request','Today 08:40'],['System','blocked — exceeds BOM','Today 08:40'],['System','notified PM & Commercial','Today 08:40']]},

'MR-058':{type:'Material Request', title:'Screed 30N — Level 2 floors', status:'Within BOM — to LPO', sc:'wp',
  bom:{label:'Screed 30N', unit:'m³', allow:210, ordered:150, received:130},
  facts:[['Reference','MR-058'],['Material','Screed 30N'],['Requested','24 m³'],['For','Level 2 floors'],['Needed','17 Sep 2026'],['BOM check','Within — 60 m³ headroom']],
  desc:'Site request for floor screed at Level 2. The BOM check passed with headroom to spare, so the request flows straight to procurement to raise the LPO. No approval gate is triggered because it sits inside the allowance.',
  wf:[
    {st:'Raised by Site',who:'R. Kumar · Site',state:'done',when:'Today',sig:['R. Kumar','Site Engineer','Today 09:10']},
    {st:'BOM order-control check — within',who:'System',state:'done',when:'Today',sig:null},
    {st:'Procurement raises LPO',who:'K. Nair · Procurement',state:'now',when:'Today',sig:null},
    {st:'LPO issued',who:'K. Nair · Procurement',state:'wait',when:'—',sig:null},
    {st:'Delivery / GRN',who:'R. Kumar · Site',state:'wait',when:'17 Sep',sig:null},
  ],
  links:[['BOM','BOM-conc','Screed drawn from concrete budget'],['MR','MR-057','Previous — gypsum']],
  att:[['MR-058 request.pdf','58 KB']],
  audit:[['R. Kumar','raised the request','Today 09:10'],['System','BOM check passed','Today 09:10']]},
};

/* generic detail for any ref not fully modelled above */
function genericRecord(ref){
  var pre = ref.split('-')[0];
  var types={RFI:'Request for Information',VO:'Variation Order',WIR:'Work Inspection Request',MIR:'Material Inspection',
    NCR:'Non-Conformance Report',IPC:'Payment Certificate',DWG:'Drawing',GRN:'Goods Received Note',LPO:'Purchase Order',
    MR:'Material Request',LTR:'Letter',SUB:'Submittal',PTW:'Permit to Work',OBS:'HSE Observation',EOT:'Extension of Time',
    EOT2:'Extension of Time',ST:'Structural Drawing',AR:'Architectural Drawing',NM:'Near-miss',TR:'Transmittal',
    IND:'Induction',CUBE:'Concrete Test',TEST:'Test Record',INV:'Supplier Invoice',MAR:'Material Approval',
    BOM:'Bill of Materials',BBS:'Bar-bending Schedule',IPA:'Interim Payment Application',ACT:'Activity',
    DEWA:'Authority — DEWA',DCD:'Authority — Civil Defence',DM:'Authority — Municipality',RTA:'Authority — RTA',TN:'Tender Drawing'};
  return {type:types[pre]||'Record', title:ref+' — record detail', status:'Open', sc:'wp',
    facts:[['Reference',ref],['Type',types[pre]||'Record'],['Project','Sample project'],['Status','In workflow']],
    desc:'This is a live record in the '+(types[pre]||'register')+'. Every record opens to the same shape — the facts, the description, who has to act next, the signatures collected so far, the linked documents, the files, and the full history. The specific fields shown here are illustrative for the prototype.',
    wf:[{st:'Created',who:'Originator',state:'done',when:'—',sig:['Signature','Originator','on file']},
        {st:'Under review',who:'Assigned role',state:'now',when:'—',sig:null},
        {st:'Approval',who:'Approver',state:'wait',when:'—',sig:null}],
    links:[['—','—','Linked documents appear here']],
    att:[[ref+' document.pdf','—']],
    audit:[['Originator','created the record','—']]};
}

/* =========================================================================
   5.  DETAIL RENDER
   ========================================================================= */
function ladderHTML(wf){
  return '<ul class="ladder">'+wf.map(function(s){
    var node='<span class="node '+s.state+'"></span>';
    var sig='';
    if(s.sig) sig=sigDone(s.sig[0],s.sig[1],s.sig[2],s.sig[3]);
    else if(s.state==='now') sig='<div class="sigwait">Awaiting signature — this step is with '+s.who.split('·')[0].trim()+'</div>';
    return '<li>'+node+'<div class="st">'+s.st+(s.ovr?'<span class="ovrtag">PM OVERRIDE</span>':'')+'</div><div class="who">'+s.who+'</div><div class="when">'+s.when+'</div>'+sig+'</li>';
  }).join('')+'</ul>';
}
function actionsFor(rec){
  if(state.readonly) return '<div class="mini">View only — you have read access to this folder, not edit rights. Exports and reports are available; approvals and edits are done by that folder\'s team.</div>';
  var isPM = (state.role==='pm' || state.role==='principal');
  return '<div class="actbar">'+
    '<button class="prim">Approve &amp; sign</button>'+
    '<button>Add comment</button>'+
    '<button>Forward</button>'+
    (rec.type.indexOf('Inspection')>=0||rec.type.indexOf('Non-Conf')>=0?'<button class="warn">Reject / fail</button>':'')+
    (isPM?'<button class="ovr">Override &amp; issue</button>':'')+
    '</div><div class="mini">Signing applies your stored signature. No signature on file → draw or type an e-signature; it is stamped with your name, the time and your login.'+
    (isPM?'<br><b style="color:var(--accent-text)">Override:</b> as PM you can push this past its current step and issue it now — the override is logged against your name.':'')+'</div>';
}
/* BOM order-control meter — shows received, ordered and the BOM allowance line */
function bomMeterHTML(b){
  var max=Math.max(b.ordered,b.allow)*1.02;
  var pc=function(n){return (100*n/max).toFixed(1)+'%';};
  var over=b.ordered>b.allow;
  return '<div class="note"><div class="sechd">Order control against the Bill of Materials</div>'+
    '<div class="bomrow"><div class="bh"><b>'+b.label+'</b><span>BOM allowance '+b.allow.toLocaleString()+' '+b.unit+'</span></div>'+
    '<div class="bommeter '+(over?'over':'')+'">'+
      '<div class="ord" style="width:'+pc(b.ordered)+'"></div>'+
      '<div class="rec" style="width:'+pc(b.received)+'"></div>'+
      '<div class="lim" style="left:'+pc(b.allow)+'"></div>'+
    '</div>'+
    '<div class="bh" style="margin-top:5px"><span>Received '+b.received.toLocaleString()+'</span><span>Ordered '+b.ordered.toLocaleString()+'</span>'+
      '<span style="color:'+(over?'var(--bad)':'var(--good)')+'">'+(over?'Over by '+(b.ordered-b.allow).toLocaleString():'Headroom '+(b.allow-b.ordered).toLocaleString())+' '+b.unit+'</span></div>'+
    '</div></div>';
}
/* activities from the uploaded programme, tagged by discipline — each engineer sees only theirs */
var ACTIVITIES=[
  {ref:'ACT-116',name:'Podium 2 column casting',floor:'Podium 2',pct:100,disc:'Civil',tag:''},
  {ref:'ACT-117',name:'L3 slab',floor:'Level 3',pct:100,disc:'Civil',tag:''},
  {ref:'ACT-118',name:'L3 blockwork Zone A',floor:'Level 3',pct:100,disc:'Civil',tag:''},
  {ref:'ACT-119',name:'L2 blockwork',floor:'Level 2',pct:45,disc:'Civil',tag:''},
  {ref:'ACT-120',name:'L4 rebar fixing',floor:'Level 4',pct:60,disc:'Civil',tag:'critical · due 15 Sep'},
  {ref:'ACT-121',name:'L4 slab pour',floor:'Level 4',pct:0,disc:'Civil',tag:'critical · starts 16 Sep'},
  {ref:'ACT-123',name:'Podium 3 waterproofing',floor:'Podium 3',pct:30,disc:'Civil',tag:'critical'},
  {ref:'ACT-124',name:'L2 screed',floor:'Level 2',pct:0,disc:'Civil',tag:'due 20 Sep'},
  {ref:'ACT-122',name:'L1 MEP 1st fix',floor:'Level 1',pct:70,disc:'MEP',tag:''},
  {ref:'ACT-130',name:'L1 duct installation',floor:'Level 1',pct:40,disc:'MEP',tag:''},
  {ref:'ACT-131',name:'Riser cabling',floor:'Risers',pct:20,disc:'MEP',tag:'critical'},
  {ref:'ACT-132',name:'FCU mounting',floor:'Level 1',pct:100,disc:'MEP',tag:''},
  {ref:'ACT-140',name:'L2 gypsum ceiling',floor:'Level 2',pct:30,disc:'Architecture',tag:''},
  {ref:'ACT-141',name:'L1 floor tiling',floor:'Level 1',pct:15,disc:'Architecture',tag:''},
  {ref:'ACT-142',name:'External plaster',floor:'Facade',pct:0,disc:'Architecture',tag:'due 25 Sep'},
];
function actByRef(ref){for(var i=0;i<ACTIVITIES.length;i++)if(ACTIVITIES[i].ref===ref)return ACTIVITIES[i];return null;}
/* site-engineer activity panel: progress % update + photo attach → send to PM */
function activityPanel(ref){
  var a=actByRef(ref); var pct=a?a.pct:0, fin=pct>=100;
  if(fin) return '<div class="note" style="border-left:3px solid var(--good)"><div class="sechd">Activity — finished, with the PM</div>'+
    '<div class="mini" style="margin:0 0 9px">You marked this 100% and attached the completion photographs. It is now with the PM to verify and sign off.</div>'+
    '<div class="att"><span class="fi">▤</span><span class="fn">Completion photos.zip</span><span class="fs">attached</span></div></div>';
  return '<div class="note" style="border-left:3px solid var(--gold)"><div class="sechd">Update this activity</div>'+
    '<div class="frm"><div class="f full"><label>Progress — '+pct+'%</label><input type="range" min="0" max="100" value="'+pct+'"></div>'+
    '<div class="f full"><label>Photographs</label><div class="filebox">${icon('upload', 14)} Add site photos — required to close the activity</div></div></div>'+
    '<div class="actbar"><button class="prim">Save progress</button><button class="ovr">Mark finished &amp; send to PM</button></div>'+
    '<div class="mini">Update the percentage as you go. To close the activity you must attach completion photographs; it then goes to the PM to verify and sign off.</div></div>';
}
function openDetail(ref){
  var rec = RECORDS[ref] || genericRecord(ref);
  var pane = document.getElementById('dpane');
  pane.innerHTML =
    '<div class="dtop">'+
      '<div class="crumb"><a data-close="1">'+ROLE[state.role].page+'</a> › '+rec.type+' › '+ref+'</div>'+
      '<div class="dhrow"><div><div class="dh">'+rec.title+'</div><div class="dref">'+rec.type+' · '+ref+'</div></div>'+
        '<div style="margin-left:auto;display:flex;gap:10px;align-items:center">'+pill(rec.status,rec.sc)+'<button class="dclose" data-close="1">×</button></div></div>'+
    '</div>'+
    '<div class="dbody">'+
      (rec.warn?'<div class="dwarn">'+rec.warn+'</div>':'')+
      (rec.bom?bomMeterHTML(rec.bom):'')+
      (ref.indexOf('ACT-')===0?activityPanel(ref):'')+
      '<div class="dgrid">'+
        '<div>'+
          '<div class="note"><div class="sechd">Details</div><ul class="facts">'+rec.facts.map(function(f){return '<li><span class="k">'+f[0]+'</span><span class="v">'+f[1]+'</span></li>';}).join('')+'</ul></div>'+
          '<div class="note"><div class="sechd">Description</div><div class="desc">'+rec.desc+'</div></div>'+
          '<div class="note"><div class="sechd">Linked documents</div><div class="links">'+rec.links.map(function(l){
              return '<a '+(l[1]!=='—'?'data-open="'+l[1]+'"':'')+'><span class="lt">'+l[0]+'</span><span>'+(l[1]!=='—'?l[1]+' — ':'')+l[2]+'</span></a>';
            }).join('')+'</div></div>'+
        '</div>'+
        '<div>'+
          '<div class="note"><div class="sechd">Workflow &amp; signatures</div>'+ladderHTML(rec.wf)+actionsFor(rec)+'</div>'+
          '<div class="note"><div class="sechd">Attachments</div>'+rec.att.map(function(a){return '<div class="att"><span class="fi">▤</span><span class="fn">'+a[0]+'</span><span class="fs">'+a[1]+'</span></div>';}).join('')+'</div>'+
          '<div class="note"><div class="sechd">History</div><ul class="audit">'+rec.audit.map(function(a){return '<li><b>'+a[0]+'</b> '+a[1]+' · <span>'+a[2]+'</span></li>';}).join('')+'</ul></div>'+
        '</div>'+
      '</div>'+
    '</div>';
  document.getElementById('detail').classList.remove('hide');
}
function closeDetail(){document.getElementById('detail').classList.add('hide');}

/* =========================================================================
   6.  STATE + WIRING
   ========================================================================= */
var state = {email:null, role:null};

// The design's symbol characters, drawn as the platform's line icons (src/html/icons.js).
var SYM = ${symbolIcons(16)};
function ico(s){ return SYM[s] || s; }

function drawNav(){
  // Every role ends with what is the person's own: their files and their account.
  var yours = [['▤','My files',''],['⧉','Your account','']];
  // Connected programs (Revit and the others): for the Principal and the PM.
  if (state.role === 'principal' || state.role === 'pm') yours.push(['⇅','Integrations','']);
  var conf = (NAV[state.role]||NAV.pm).concat([['YOU',yours]]);
  var h='';
  conf.forEach(function(g){
    h+='<div class="nsec">'+g[0]+'</div>';
    g[1].forEach(function(a){
      var isOn=a[2]==='on';
      var badge=(a[2]&&!isOn)?('<span class="bdg'+(parseInt(a[2])>=5?' hot':'')+'">'+a[2]+'</span>'):'';
      h+='<a class="'+(isOn?'on':'')+'"><span><span class="ic">'+ico(a[0])+'</span>'+a[1]+'</span>'+badge+'</a>';
    });
  });
  document.getElementById('nav').innerHTML=h;
}

function drawHats(){
  var views=accessFor(state.email);
  var box=document.getElementById('hats');
  if(views.length<=1){box.innerHTML='<span class="hatlbl">'+ROLE[views[0][0]].label+'</span>';return;}
  var fulls=views.filter(function(v){return v[1]==='full';});
  var html='';
  if(fulls.length>=2 && fulls.length<=3){
    html+='<span class="hatlbl">Your functions</span>'+fulls.map(function(v){
      return '<button data-hat="'+v[0]+'" class="'+(v[0]===state.role?'on':'')+'"><span class="ic">'+ico(ROLE[v[0]].icon)+'</span>'+ROLE[v[0]].label+'</button>';}).join('');
  }else{
    html+='<span class="hatlbl">Dashboard</span>';
  }
  html+='<select class="viewsel" id="viewsel">'+views.map(function(v){
    return '<option value="'+v[0]+'"'+(v[0]===state.role?' selected':'')+'>'+ROLE[v[0]].label+(v[1]==='read'?' — read only':'')+'</option>';}).join('')+'</select>';
  box.innerHTML=html;
  box.querySelectorAll('button[data-hat]').forEach(function(b){
    b.addEventListener('click',function(){state.role=b.dataset.hat;state.readonly=false;state.pview=null;render();});
  });
  var sel=document.getElementById('viewsel');
  if(sel) sel.addEventListener('change',function(){state.role=this.value;state.readonly=(levelOf(views,this.value)==='read');state.pview=null;render();});
}

// A self-serve company's Principal adds projects themselves (/welcome); for a
// company AETRAA set up, projects stay AETRAA's to create.
fetch('/api/account').then(function(r){return r.ok?r.json():null;}).then(function(a){
  var n=document.getElementById('projNote');
  if(!n||!a||!a.may_create_project) return;
  n.innerHTML='<a href="/welcome" style="display:inline-flex;align-items:center;gap:6px;min-height:44px;color:var(--accent-text);text-decoration:none">+ New project</a>';
}).catch(function(){});

function render(){
  var acc=ACCOUNTS[state.email];
  document.getElementById('meAv').textContent=acc.av;
  document.getElementById('meName').textContent=acc.name;
  document.getElementById('meRole').textContent=acc.multi? (ROLE[state.role].label+'  ·  +'+(acc.roles.length-1)+' more') : acc.title;
  drawNav(); drawHats();

  // principal drill-down screens (project overview / section)
  if(state.role==='principal' && state.pview){
    document.getElementById('pageTitle').textContent='Portfolio';
    if(state.pview.section) renderPrincipalSection(state.pview.pid,state.pview.section);
    else renderPrincipalOverview(state.pview.pid);
    return;
  }

  var d=DASH[state.role]();
  document.getElementById('pageTitle').textContent=ROLE[state.role].page+(state.readonly?' · read only':'');
  document.getElementById('rolebar').className='rolebar';
  document.getElementById('rolebar').innerHTML=(state.readonly?'<div class="robar"><b>Read-only access.</b> You can view '+ROLE[state.role].page+' and export or generate reports from it, but you don\'t have edit rights on this folder.</div>':'')+d.bar;
  document.getElementById('kpis').style.gridTemplateColumns='';
  document.getElementById('kpis').innerHTML=fourKpis(d.kpis).map(function(k){return kpi(k[0],k[1],k[2]);}).join('');
  setWide(false);
  document.getElementById('leftcol').innerHTML=d.left;
  document.getElementById('rightcol').innerHTML=d.right;
}

function signIn(email){
  var acc=ACCOUNTS[email]; if(!acc){alert('Unknown email — pick a sample account.');return;}
  state.email=email;
  var views=accessFor(email); var primary=(acc.roles||[])[0];
  state.role=views.some(function(v){return v[0]===primary;})?primary:views[0][0];
  state.readonly=false; state.pview=null;
  document.getElementById('login').classList.add('hide');
  document.getElementById('app').classList.remove('hide');
  render();
}

/* account list on the login card */
document.getElementById('accList').innerHTML=Object.keys(ACCOUNTS).map(function(e){
  var a=ACCOUNTS[e];
  var fn=a.roles.map(function(r){return ROLE[r].label;}).join(' + ');
  return '<div class="acc" data-email="'+e+'"><b>'+a.name+'</b><span class="em">'+e+'</span><div class="fn">'+
    (a.multi?'${icon('chevron-right', 12)} ':'')+fn+'</div></div>';
}).join('');

/* delegated clicks */
document.addEventListener('click',function(ev){
  var acc=ev.target.closest('.acc'); if(acc){signIn(acc.dataset.email);return;}
  var proj=ev.target.closest('[data-proj]'); if(proj){state.pview={pid:proj.getAttribute('data-proj')};render();return;}
  var sec=ev.target.closest('[data-section]'); if(sec){var s=sec.getAttribute('data-section').split(':');state.pview={pid:s[0],section:s[1]};render();return;}
  var pnav=ev.target.closest('[data-pnav]'); if(pnav){var v=pnav.getAttribute('data-pnav');state.pview=(v==='root')?null:{pid:v.split(':')[1]};render();return;}
  var sch=ev.target.closest('[data-sched]'); if(sch){openSchedule(sch.getAttribute('data-sched'));return;}
  var rep=ev.target.closest('[data-report]'); if(rep){openReport(rep.getAttribute('data-report'));return;}
  var hse=ev.target.closest('[data-hse]'); if(hse){openHse(hse.getAttribute('data-hse'));return;}
  var xls=ev.target.closest('[data-xls]'); if(xls){downloadRegister(xls.getAttribute('data-xls'));return;}
  var nw=ev.target.closest('[data-new]'); if(nw){if(state.readonly)return;openNewForm(nw.getAttribute('data-new'));return;}
  var gen=ev.target.closest('[data-gen]'); if(gen){genConfirm(gen.getAttribute('data-gen'));return;}
  var open=ev.target.closest('[data-open]'); if(open){openDetail(open.getAttribute('data-open'));return;}
  var close=ev.target.closest('[data-close]'); if(close){closeDetail();return;}
  if(ev.target.id==='detail'){closeDetail();return;}
});
/* project switcher — every project runs the same dashboards */
var PROJINFO=[['Sample project','Dubai, UAE · Week 37 · 7–13 Sep 2026'],
  ['Commercial Tower — JBBC','Business Bay, Dubai · Week 37 · 7–13 Sep 2026'],
  ['Villa Compound — Project three','Project three, Dubai · 9 villas · Week 37']];
document.getElementById('projSel').addEventListener('change',function(){
  var i=this.selectedIndex; document.getElementById('projName').textContent=PROJINFO[i][0];
  document.getElementById('projSub').textContent=PROJINFO[i][1];
});
document.getElementById('loginBtn').addEventListener('click',function(){signIn(document.getElementById('email').value.trim());});
document.getElementById('email').addEventListener('keydown',function(e){if(e.key==='Enter')signIn(this.value.trim());});
document.getElementById('logout').addEventListener('click',function(){
  document.getElementById('app').classList.add('hide');
  document.getElementById('login').classList.remove('hide');
  document.getElementById('email').value='';
});
document.addEventListener('keydown',function(e){if(e.key==='Escape')closeDetail();});
</script>

<script>window.__ME__ = __ME_JSON__;</script>
<script>
(function(){
  var ME = window.__ME__ || {};
  if(!ME.email){ return; }

  /* ---- THE PREVIEW -----------------------------------------------------
   *
   * An AETRAA Admin looking at this project as one of its roles, before it is
   * handed over. Everything on screen is this project's real data; nothing on
   * screen may change it.
   *
   * Two things happen here, and neither of them is the guarantee. Every
   * request is stamped, and the server refuses every write that carries the
   * stamp — that is the guarantee, and it lives at the server's front door
   * where no route can forget it. This wrapper exists so the stamp is on every
   * request without 43 call sites having to remember, and so the person can
   * see, at a glance, that they are looking rather than working.
   */
  if (ME.preview) {
    var _fetch = window.fetch;
    window.fetch = function(input, init){
      init = init || {};
      var h = new Headers((init && init.headers) || (input && input.headers) || {});
      h.set('X-AETRAA-Preview', '1');
      init.headers = h;
      return _fetch(input, init);
    };

    document.addEventListener('DOMContentLoaded', function(){
      var bar = document.createElement('div');
      bar.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:99999;'
        + 'background:var(--card-light);color:var(--on-card-light);font-family:var(--font);font-size:var(--fs-secondary);line-height:var(--lh-secondary);font-weight:500;'
        + 'padding:9px 16px;display:flex;gap:14px;align-items:center;flex-wrap:wrap';
      bar.innerHTML = '<span>Preview \u2014 this is <b>' + (ME.projectName || 'the project')
        + '</b> as <b>' + (ME.title || 'a role') + '</b> sees it. '
        + 'Nothing here can be changed.</span>'
        + '<span style="flex:1 1 auto"></span>'
        + '<a href="/handover?p=' + encodeURIComponent(ME.projectId || '')
        + '" style="color:inherit;text-decoration:underline">Back to the checks</a>';
      document.body.appendChild(bar);
      document.body.style.paddingBottom = '46px';
    });
  }
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
        'Subcontractors':'subcon','Letters':['design','commercial'],
        'Payment terms':'commercial','Delays & EOT':'planning','Draft a letter':['design','commercial']};
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
        box.setAttribute('style','max-width:520px;margin:12vh auto;padding:32px;border:1px solid var(--line-strong);border-radius:var(--r-frame);font-family:var(--font);font-size:var(--fs-body);line-height:1.5;background:var(--glass);-webkit-backdrop-filter:var(--blur);backdrop-filter:var(--blur);color:var(--text)');
        box.innerHTML='<h2 style="margin:0 0 10px;font-size:var(--fs-headline);font-weight:500">Not switched on for this project</h2>'+
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
      var FAKE=/AED|\b(IPA|IPC|VO|SUB|ACT|MAR|WIR|NCR|LTR)-\d+/;
      window.kpi=function(v,l,c){
        if(FAKE.test(String(v))||FAKE.test(String(l))){
          return _kpi_orig('—', String(l).replace(/\b[A-Z]{2,4}-\d+\b/g,'').replace(/\s+/g,' ').trim()||'—', '');
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
  function initials(n){ var p=String(n||'').trim().split(/\s+/); return (((p[0]||'')[0]||'')+((p[1]||'')[0]||'')).toUpperCase()||'U'; }
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
  // Which "+ New …" form maps to which stored record type.
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
      row.time=t?('+'+String(t).replace(/^\+/,'')+' d'):'—';
    }
    else if(bucket==='rfi'){
      row.title=pick(d,'Subject')||r.title;
      row.type=pick(d,'Discipline')||'—';
      row.pri=pick(d,'Priority')||'Normal';
    }
    else if(bucket==='certs'){
      row.title=pick(d,'Certificate')||r.title;
      row.type=pick(d,'Issued by')||'—';
      row.due=pick(d,'Expires')||r.due||null;
    }
    else if(bucket==='mr'){
      row.title=pick(d,'Material')||r.title;
      row.qty=pick(d,'Quantity')||'—';
      row.forloc=pick(d,'For (location)')||'—';
    }
    else { row.title=r.title; row.type=r.type.toUpperCase(); }
    // K5: brought in from the old system. Never late, never ageing, and said so.
    if(r.imported){
      row.st='Imported — not raised on this platform'+(r.original_status?' · was “'+r.original_status+'”':'')+(r.continued_by?' · continues as '+r.continued_by:'');
      row.cls=''; row.sub=r.original_date||r.sub; if(row.age!==undefined) row.age='—';
    }
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
    // K1: where the bill stands, and the way to the check and the approval.
    // The section rows carry their amount from the server, worked in fils.
    REG.boq.note = 'The priced contract bill — value certified against each section. Feeds the IPC valuation and the cost-value reconciliation. '
      + (BOQ.state === 'pending' ? '<b>Waiting for the PM’s approval</b> — no payment application is valued against it until then. ' : '')
      + '<a href="/bills">Upload, check and approve the BOQ and BOM</a>';
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
               type: (d.kind || 'Drawing') + (d.revision ? ' · Rev ' + d.revision : ''),
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
  // Make every "+ New …" form actually save a real, numbered record.
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
        // A file field's value is "C:akepath	hing.pdf" — a lie, and the very
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
      var title=(f._titleLabel&&data[f._titleLabel])||data[f.fields[0][0]]||f.title;
      var wf=f.wf||null;
      // K13 (v5 A10): an RFI that may already have been asked is named first;
      // the engineer raises it anyway or not.
      var sendRec=function(anyway){ return fetch('/api/records',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:rtype,title:title,data:data,workflow:wf,not_duplicate:anyway||undefined})})
        .then(function(r){return r.json();}).then(function(res){
          if(res&&res.duplicates&&!anyway){ if(confirm(res.error)) return sendRec(true); return; }
          if(!(res&&res.ok)){ alert((res&&res.error)||'Could not save — check you are signed in.'); return; }
          try{ localStorage.removeItem(draftKey(kind)); }catch(e){}
          // The record exists and is numbered; now its files go against that number.
          return uploadAttachments(res.ref, picked, null).then(function(up){
            return loadRecords().then(function(){
              try{render();}catch(e){}
              showCreated(f,res.ref,up);
            });
          });
        }).catch(function(){ alert('Could not save.'); }); };
      sendRec(false);
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
      '<button class="dclose" data-close="1">×</button></div></div>'+
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
            '<div class="actbar"><button class="prim" data-new="submittal">+ New submission</button>'+
            '<button data-new="rfi">+ RFI</button><button data-new="letter">+ Letter</button></div></div>'+
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
      '<span class="fi">' + ico(attIcon(a.mime)) + '</span>' +
      '<a class="fn" href="/attachment/' + a.id + '">' + esc(a.filename) + '</a>' +
      '<span class="fs">' + esc(a.size_text || '') + '</span>' +
      '<button class="btn" data-attdel="' + a.id + '" title="Remove this file">×</button></div>';
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
  // A "+ New …" button for something the API will refuse is a trap. The design
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
          if (bar) bar.innerHTML = '<button class="prim" data-xlssched="' + kind + '">${icon('download', 14)} Excel</button>';
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

  /* ==================================================================
   * THE TEMPLATE IS THE FORM (src/template-forms.js).
   *
   * Where this project has the consultant's own form for a document type,
   * raising one shows that form beside the fields, filled in as it is typed,
   * and asks for every field the form has. Opening a record shows the
   * document as it will be issued before anybody signs it, with the
   * signature's box marked. Projects without a template are unchanged.
   * ================================================================== */
  var TPL_CSS_DONE = false;
  function tplCss(css){
    if (TPL_CSS_DONE || !css) return;
    TPL_CSS_DONE = true;
    var st = document.createElement('style');
    st.textContent = css +
      '.dpane.tpl-wide{width:min(1280px,97vw)}' +
      '.tpl-split{display:grid;grid-template-columns:minmax(330px,1fr) 1.35fr;gap:14px;align-items:start}' +
      '.tpl-split>div{min-width:0}.tpl-split>.tpl-right{position:sticky;top:8px}' +
      '.tpl-fit{overflow:hidden}' +
      '.tpl-mark{font-size:var(--fs-label);color:var(--warn-ink);background:color-mix(in srgb,var(--warn-ink) 15%,transparent);border-radius:var(--r-pill);padding:0 6px;margin-left:4px}' +
      '@media(max-width:900px){.tpl-split{grid-template-columns:1fr}.tpl-split>.tpl-right{position:static}}';
    document.head.appendChild(st);
  }
  // Scale the drawn form to the width it has, keeping its proportions.
  function tplFit(box){
    if (!box) return;
    var sheet = box.querySelector('.tp-sheet,.tp-doc');
    if (!sheet) return;
    sheet.style.transform = ''; box.style.height = '';
    var w = box.clientWidth - 8, sw = sheet.scrollWidth;
    if (sw > w && w > 0) {
      var k = w / sw;
      sheet.style.transformOrigin = '0 0';
      sheet.style.transform = 'scale(' + k + ')';
      box.style.height = Math.ceil(sheet.scrollHeight * k + 8) + 'px';
    }
  }
  function tplType(kind){
    try { return (typeof FORM_TO_TYPE !== 'undefined' && FORM_TO_TYPE[kind]) || null; } catch (e) { return null; }
  }
  function tplFormData(kind){
    var f = FORMS[kind], data = {}, title = '';
    var fs = document.querySelectorAll('#dpane .frm .f');
    for (var i = 0; i < f.fields.length && i < fs.length; i++) {
      var inp = fs[i].querySelector('input,select,textarea');
      if (!inp || inp.type === 'file') continue;
      data[f.fields[i][0]] = inp.value;
      if (!title && inp.value && f.fields[i][1] !== 'select') title = inp.value;
    }
    return { data: data, title: title };
  }
  // "Generate & route for approval" read as one act, and was one. It is now
  // Generate (shows the document) -> Edit or Confirm & submit for approval.
  function tplRelabel(){
    var b = document.querySelector('#dpane [data-gen]');
    if (!b || b.getAttribute('data-gen') === 'assign') return;
    b.textContent = 'Generate';
    var body = document.querySelector('#dpane .dbody');
    if (body && !body.querySelector('.tpl-steps')) body.insertAdjacentHTML('afterbegin', tplSteps(1));
  }
  // The three steps, always in view, so nobody takes Generate for Submit.
  function tplSteps(at){
    var names = ['Fill in', 'Check the document', 'Confirm & submit for approval'];
    return '<div class="tpl-steps" style="display:flex;gap:6px;flex-wrap:wrap;margin:0 0 10px">' + names.map(function(n, i){
      var on = i + 1 === at, done = i + 1 < at;
      return '<span style="flex:1 1 150px;padding:7px 10px;border-radius:var(--r-control);font-size:var(--fs-secondary);' +
        (on ? 'background:var(--accent);color:var(--on-accent);font-weight:500' : done ? 'background:color-mix(in srgb,var(--good-ink) 15%,transparent);color:var(--good-ink)' : 'background:var(--surface-2);color:var(--text-2)') +
        '">' + (done ? ico('\u2713') + ' ' : (i + 1) + '. ') + n.replace('&', '&amp;') + '</span>';
    }).join('') + '</div>';
  }
  function installTemplateForms(){
    if (typeof openNewForm !== 'function') return;
    var origNew = openNewForm, timer = null, seq = 0;
    window.openNewForm = function(kind){
      var f = FORMS[kind];
      if (f && f._base) f.fields = f._base.slice();         // a new project, a new template
      origNew(kind);
      tplRelabel();
      var type = tplType(kind);
      if (!f || !type || kind === 'assign' || state.readonly) return;
      var mine = ++seq;
      var labels = f.fields.map(function(x){ return x[0]; }).join('|');
      fetch('/api/template/form?type=' + encodeURIComponent(type) + '&labels=' + encodeURIComponent(labels), { cache: 'no-store' })
        .then(function(r){ return r.ok ? r.json() : null; })
        .then(function(d){
          if (!d || !d.has || mine !== seq) return;
          tplCss(d.css);
          if (!f._base) f._base = f.fields.slice();
          f._titleLabel = null;
          if (d.fields && d.fields.length) {
            // The consultant's form decides the inputs: its own fields, its own
            // names, in its own order. Attachments stay.
            var own = d.fields.map(function(x, i){ return [x.label, x.long ? 'textarea' : 'text', '', i === 0 ? 1 : 0, 'tpl']; });
            var files = f._base.filter(function(x){ return x[1] === 'file'; });
            f.fields = own.concat(files);
            var titled = d.fields.filter(function(x){ return /subject|title|description/i.test(x.token || x.label); })[0];
            f._titleLabel = (titled || d.fields[0]).label;
          } else {
            var extra = (d.extra || []).map(function(e){ return [e.label, e.long ? 'textarea' : 'text', '', e.long ? 1 : 0, 'tpl']; });
            f.fields = f._base.concat(extra);
          }
          origNew(kind);
          tplRelabel();
          var pane = document.getElementById('dpane');
          var body = pane && pane.querySelector('.dbody');
          if (!body) return;
          pane.classList.add('tpl-wide');
          // Fields that exist only because the consultant's form asks for them.
          var fs = pane.querySelectorAll('.frm .f');
          for (var i = (d.fields && d.fields.length) ? fs.length : f._base.length; i < fs.length; i++) {
            var lb = fs[i].querySelector('label');
            if (lb) lb.insertAdjacentHTML('beforeend', '<span class="tpl-mark">on the form</span>');
          }
          var note = pane.querySelector('.tmplnote');
          if (note) note.innerHTML = 'You are filling <b>' + esc(d.filename || 'this project’s form') +
            '</b>, the consultant’s own ' + (d.format === 'xlsx' ? 'Excel' : 'Word') + ' form. What you type appears on it, ' +
            'on the right, exactly as it will be issued.';
          var kids = Array.prototype.slice.call(body.children);
          var left = document.createElement('div'), right = document.createElement('div');
          right.className = 'tpl-right';
          right.innerHTML = '<div class="note"><div class="sechd">The document as it will be issued</div>' +
            '<div class="tp-wrap tpl-fit" id="tplLive"><div class="mini">Drawing the form…</div></div>' +
            '<div class="mini" style="margin-top:6px">Each signature goes in its own box on this form as the workflow is signed.</div></div>';
          kids.forEach(function(k){ left.appendChild(k); });
          var grid = document.createElement('div');
          grid.className = 'tpl-split';
          grid.appendChild(left); grid.appendChild(right);
          body.appendChild(grid);
          var draw = function(){
            var fd = tplFormData(kind);
            fetch('/api/template/preview', { method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ type: type, title: fd.title, data: fd.data }) })
              .then(function(r){ return r.json(); })
              .then(function(p){
                var box = document.getElementById('tplLive');
                if (!box) return;
                box.innerHTML = p && p.html ? p.html : '<div class="mini">' + esc((p && p.error) || 'The form could not be drawn.') + '</div>';
                tplFit(box);
              }).catch(function(){});
          };
          left.addEventListener('input', function(){ clearTimeout(timer); timer = setTimeout(draw, 450); });
          left.addEventListener('change', function(){ clearTimeout(timer); timer = setTimeout(draw, 150); });
          draw();
        }).catch(function(){});
    };

    // CHECK BEFORE IT IS RAISED. "Generate" no longer raises the document on the
    // spot: it shows the filled form, full size, with Edit and Submit. Nothing
    // is numbered, routed or sent until Submit. Without a template the check
    // shows what was typed, field by field.
    if (typeof genConfirm === 'function') {
      var origGen = genConfirm;
      window.genConfirm = function(kind){
        var f = FORMS[kind];
        var pane = document.getElementById('dpane');
        var body = pane && pane.querySelector('.dbody');
        if (!f || kind === 'assign' || !body || body.getAttribute('data-checked') === '1') {
          if (body) body.removeAttribute('data-checked');
          return origGen(kind);
        }
        // Anything required still empty: let the form say so, where it is.
        var fs = body.querySelectorAll('.frm .f'), empty = false;
        for (var i = 0; i < f.fields.length && i < fs.length; i++) {
          if (!f.fields[i][3] || f.fields[i][1] === 'file') continue;
          var inp = fs[i].querySelector('input,select,textarea');
          if (inp && inp.type !== 'file' && !String(inp.value || '').trim()) empty = true;
        }
        if (empty) return origGen(kind);
        var fd = tplFormData(kind);
        var kids = Array.prototype.slice.call(body.children);
        kids.forEach(function(k){ k.style.display = 'none'; });
        var rv = document.createElement('div');
        rv.id = 'tplReview';
        rv.innerHTML = tplSteps(2) + '<div class="tmplnote"><b>Check it before it is raised.</b> This is the document exactly as it will be issued. ' +
          'Nothing has been numbered or sent yet — <b>Edit</b> to change anything, <b>Confirm &amp; submit for approval</b> when it is right.</div>' +
          '<div class="actbar" style="position:sticky;top:0;z-index:2;background:var(--soft);padding:6px 0"><button class="prim" id="tplSubmit">Confirm &amp; submit for approval</button><button id="tplEdit">Edit</button></div>' +
          '<div class="note"><div class="sechd">' + esc(f.title) + ' — as it will be issued</div><div class="tp-wrap tpl-fit" id="tplCheck"><div class="mini">Drawing the document…</div></div></div>';
        body.appendChild(rv);
        var back = function(){ rv.remove(); kids.forEach(function(k){ k.style.display = ''; }); };
        document.getElementById('tplEdit').onclick = back;
        document.getElementById('tplSubmit').onclick = function(){
          this.disabled = true;
          back();
          body.setAttribute('data-checked', '1');
          window.genConfirm(kind);
        };
        var mine = ++seq;
        var plain = function(){
          var cb = document.getElementById('tplCheck');
          if (!cb || mine !== seq) return;
          var rows = Object.keys(fd.data).filter(function(k){ return String(fd.data[k] || '').trim(); });
          cb.innerHTML = '<div class="tp-doc"><table>' + rows.map(function(k){
            return '<tr><td style="width:34%;font-weight:600">' + esc(k) + '</td><td style="white-space:pre-wrap">' + esc(fd.data[k]) + '</td></tr>';
          }).join('') + '</table></div>';
        };
        var type = tplType(kind);
        if (!type) { plain(); return; }
        fetch('/api/template/preview', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: type, title: fd.title, data: fd.data }) })
          .then(function(r){ return r.json(); })
          .then(function(p){
            if (!p || !p.has || !p.html) { plain(); return; }
            var box = document.getElementById('tplCheck');
            if (!box || mine !== seq) return;               // edited, or closed, meanwhile
            tplCss(p.css);
            pane.classList.add('tpl-wide');
            box.innerHTML = p.html;
            tplFit(box);
          }).catch(plain);
      };
    }

    // Before anybody signs: the document as it will be issued, their box marked.
    if (typeof openDetail !== 'function') return;
    var origDetail = openDetail;
    window.openDetail = function(ref){
      origDetail(ref);
      var rec = (typeof RECBYREF !== 'undefined') ? RECBYREF[ref] : null;
      if (!rec) return;
      fetch('/api/record/preview?ref=' + encodeURIComponent(ref), { cache: 'no-store' })
        .then(function(r){ return r.ok ? r.json() : null; })
        .then(function(d){
          if (!d || !d.has || !d.html) return;
          var pane = document.getElementById('dpane');
          var body = pane && pane.querySelector('.dbody');
          if (!body || body.querySelector('#tplRec')) return;
          tplCss(d.css);
          pane.classList.add('tpl-wide');
          var box = document.createElement('div');
          box.className = 'note';
          box.innerHTML = '<div class="sechd">The document as it will be issued' +
            (d.your_box ? ' — check it before you sign' : '') + '</div>' +
            '<div class="tp-wrap tpl-fit" id="tplRec">' + d.html + '</div>' +
            (d.your_box ? '<div class="mini" style="margin-top:6px">The highlighted box is where your signature goes when you press <b>Approve &amp; sign</b> (or Issue).</div>' : '');
          body.insertBefore(box, body.firstChild);
          tplFit(document.getElementById('tplRec'));
        }).catch(function(){});
    };
    window.addEventListener('resize', function(){ tplFit(document.getElementById('tplLive')); tplFit(document.getElementById('tplRec')); });
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
      // K5: a record from the old system — its facts, the way to continue it, and no form to generate.
      if (rec.imported) {
        var src = rec.imported_from, srcTxt = '';
        if (src && typeof src === 'object') srcTxt = [src.file, src.sheet ? 'sheet ' + src.sheet : '', src.row ? 'row ' + src.row : ''].filter(Boolean).join(' · ');
        else if (src) srcTxt = String(src);
        links = '<div class="mini" style="margin:0 0 8px"><b>Imported — not raised on this platform.</b>' +
          (rec.original_date ? ' Raised ' + esc(rec.original_date) + ' in the old system.' : '') +
          (rec.original_status ? ' Its status there: “' + esc(rec.original_status) + '”.' : '') +
          (srcTxt ? ' From ' + esc(srcTxt) + '.' : '') +
          (rec.continued_by ? ' Continues as <a data-open="' + esc(rec.continued_by) + '" style="cursor:pointer;text-decoration:underline">' + esc(rec.continued_by) + '</a>.' : '') +
          ' No clock runs on it.</div>' + links;
        if (rec.may_take_over) html += '<button class="prim" id="recTakeOver">Take over as a new live record</button>';
      } else if (rec.continues) {
        links = '<div class="mini" style="margin:0 0 8px">Continues ' + '<a data-open="' + esc(rec.continues) + '" style="cursor:pointer;text-decoration:underline">' + esc(rec.continues) + '</a>, imported from the old system.</div>' + links;
      }
      // K7 (S0): issue by email, the reply and its comments live on the submittal desk.
      if (!rec.imported && ['submittal', 'ms', 'material', 'rfi'].indexOf(rec.type) >= 0) {
        links = '<div class="mini" style="margin:0 0 8px"><a href="/s0?ref=' + encodeURIComponent(rec.ref) + '" style="text-decoration:underline">Open the submittal desk</a> — issue it by email, record the reply, answer comments' + (rec.revision_of ? ' · follows ' + esc(rec.revision_of) : '') + '</div>' + links;
      }
      html = links + html;
      html += (rec.imported ? '' : '<button id="recDoc">Generate document</button>') +
        (ME.mayNotify ? '<button id="recNotify">Notify team</button>' : '') + '</div>' +
        '<div class="mini" id="recMsg" style="margin-top:8px">' +
        (rec.imported ? (rec.may_take_over && !rec.continued_by ? 'Taking it over raises a new record on this project, linked to this one, with its clock starting today.' : '')
          : closed ? 'This record is closed — ' + esc(rec.status || '') + '.'
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
    // K5: Document Control continues an imported matter as a new live record.
    var to = document.getElementById('recTakeOver');
    if (to) to.addEventListener('click', function(){
      if (!confirm('Take ' + ref + ' over? A new record is raised on this project, linked to ' + ref + ', with its clock starting today.')) return;
      to.disabled = true; say('Taking it over…');
      fetch('/api/records/take-over', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ref: ref }) })
        .then(function(r){ return r.json(); })
        .then(function(d){
          if (d && d.error) { say(d.error, true); to.disabled = false; return; }
          return loadRecords().then(function(){ try { render(); } catch (e) {} openDetail(d.ref); });
        }).catch(function(){ say('Could not reach the server.', true); to.disabled = false; });
    });
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
    return '<tr' + (l.linked ? '' : ' style="background:color-mix(in srgb,var(--warn-ink) 8%,transparent)"') + '>' +
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
      if (l.section !== sec) { sec = l.section; out += '<tr><td colspan="8" style="background:var(--surface-2)"><b>' + esc(sec || '(no section)') + '</b></td></tr>'; }
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
      row.style.gridTemplateColumns = '';
      row.innerHTML = fourKpis(k).map(function(x){ return kpi(x[0], x[1], x[2]); }).join('');
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
    // A13: the delay / EOT register, where Planning prepares the notice.
    'Delay & EoT': { page: '/delays' }, 'Delays & EOT': { page: '/delays' },
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
    'GRN → invoice match': { moves: 'grn', t: 'Deliveries received' },
    'Suppliers': { moves: 'all', t: 'Supply movements' },
    'Quality (portfolio)': { dash: 'qaqc' }, 'QA reports': { act: 'report:weekly' },
    'Programme': { prog: 'all' }, 'Baseline programme': { prog: 'all' },
    'P6 update & export': { page: '/programme' },
    'Minutes': { page: '/minutes' }, 'Action tracker': { page: '/minutes?tab=actions' },
    // G1, G10, G11, G12, G14, A9: pages of their own.
    'Payment terms': { page: '/terms' }, 'Specification index': { page: '/spec' },
    'Knowledge base': { page: '/knowledge' }, 'Schedules': { page: '/schedules' },
    'Ask the project': { page: '/ask' }, 'Draft a letter': { page: '/letters' },
    // A4 (decision 1): the contract obligations register.
    'Contract obligations': { page: '/obligations' },
    // Decision 20: the Tender vs IFC deviations.
    'Tender ↔ IFC deviations': { page: '/deviations' },
    // Everyone's own: their private files and their account (password).
    'My files': { page: '/myfiles' }, 'Your account': { page: '/account' },
    'Integrations': { page: '/integrations' },
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
    'Sub valuations': 'Subcontractor accounts are not kept on this platform yet — there is no subcontract, no valuation and no payment record behind this.',
    'Subcontractor valuations': 'Subcontractor accounts are not kept on this platform yet — there is no subcontract, no valuation and no payment record behind this.',
    'Sub programme': 'Subcontractor programmes are not held separately — the project programme is the only one on this platform.',
    'Contract documents': 'The contract document set has not been loaded for this project.',
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
    // The consultant's forms are kept on their own page (src/html/templates.js).
    if (label === 'Templates') { location.href = '/templates'; return; }
    // K6 (v5 E12): the old system's logs, brought in by Document Control.
    if (label === 'Past registers') { location.href = '/past-registers'; return; }
    // K10 (v5 A2): incoming and outgoing letters in one register, overdue first.
    if (label === 'Incoming / outgoing') { location.href = '/correspondence'; return; }
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
        reg.splice(2, 0, ['✎', 'RFI register', '']);
      }
      // "Raise RFI" opened nothing: raising is the + RFI button on the
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
        if (!found) groups[0][1].push(['✎', 'RFI register', '']);
      });
      var hse = NAV.hse && NAV.hse[0] && NAV.hse[0][1];
      if (hse && !hse.some(function(i){ return /Certificates/.test(i[1]); })) {
        hse.push(['◈', 'Certificates', '']);
      }
      // Document Control issues the payment application to the Engineer and
      // records the certificate, so it needs the payments register.
      // Step 8: Document Control writes and issues minutes.
      var dcctl = NAV.dc && NAV.dc[2] && NAV.dc[2][1];
      if (dcctl && !dcctl.some(function(i){ return /Minutes/.test(i[1]); })) dcctl.push(['☰', 'Minutes', '']);
      var dcreg = NAV.dc && NAV.dc[1] && NAV.dc[1][1];
      if (dcreg && !dcreg.some(function(i){ return /IPC/.test(i[1]); })) {
        dcreg.push(['₳', 'IPC / payments', '']);
      }
      var site = NAV.site && NAV.site[0] && NAV.site[0][1];
      if (site && !site.some(function(i){ return /Material requests/.test(i[1]); })) {
        site.push(['🛒', 'Material requests', '']);
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
      '<button class="dclose" data-close="1">×</button></div></div>' +
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
      '<button class="dclose" data-close="1">×</button></div></div>' +
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
        .map(function(s){ return s.textContent; }).join('\n');
    } catch (e) {}
    var w = window.open('', '_blank');
    if (!w) { alert('Your browser blocked the print window. Allow pop-ups for this site and try again.'); return; }
    var proj = (ME.projectName || '') + (ME.projectSub ? ' · ' + ME.projectSub : '');
    // Printed on paper: always the light theme, and no frame.
    w.document.write('<!doctype html><html data-theme="light"><head><meta charset="utf-8"><title>' +
      esc(titleText || 'AETRAA') + '</title><style>' + css +
      'html{background:var(--surface);} body{background:var(--surface);margin:0;border:0;border-radius:0;padding:24px;} .dclose,.actbar,[data-navback]{display:none!important;}' +
      '.dtop{position:static;} @page{margin:14mm;}</style></head><body>' +
      '<div style="font-size:var(--fs-secondary);color:var(--text-2);margin-bottom:10px">' + esc(proj) +
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
      '<button class="dclose" data-close="1">×</button></div></div>' +
      '<div class="dbody">' +
      (ranged ? '<div class="actbar"><button id="repPrev">‹ Previous ' + (byMonth ? 'month' : 'week') + '</button>' +
        '<button id="repNext">Next ' + (byMonth ? 'month' : 'week') + ' ›</button></div>' : '') +
      '<div id="repPaper" style="background:var(--card-light);color:var(--on-card-light);border:0;border-radius:var(--r-card);padding:24px;margin:12px 0;overflow-x:auto">' +
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
        .replace(/\n{3,}/g, '\n\n').slice(0, 1800);
    } catch (e) {}
    body += '\n\n—\nProduced by ' + (ME.name || '') + ' on ' + liveToday() + ' from AETRAA.';
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
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
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
    downloadText((ME.projectName || 'programme').replace(/[^\w]+/g, '-') + '-' + liveToday() + '.csv',
      rows.map(function(r){ return r.map(csvCell).join(','); }).join('\n'));
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
      (canLog ? '<div class="actbar" style="margin-bottom:8px"><button class="prim" data-new="incoming">+ Log incoming letter</button></div>' : '') +
      '<div class="mini" style="margin-bottom:6px"><a href="/correspondence">Correspondence register — drop a letter to log it; every letter in and out, overdue first</a></div>' +
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
    return '<tr data-attn="' + n + '" style="cursor:pointer"><td style="width:22px;color:var(--faint)">' + ico(ATT_ICON[i.kind] || '•') + '</td><td><b>' + esc(i.title) + '</b>' +
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
      (ATT.overdue ? ' · ' + ATT.overdue + ' overdue' : '') + ' · ' + esc(ATT.today || '') + '</div></div><button class="dclose" data-close="1">×</button></div></div>' +
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
        var em = tr ? (tr.textContent.match(/[w.+-]+@[w.-]+.w+/) || [])[0] : null;
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
      '<button class="dclose" data-close="1">×</button></div></div>' +
      '<div class="dbody"><div class="note"><div class="sechd">Access</div><ul class="facts">' +
      '<li><span class="k">Functions</span><span class="v">' + esc(acc.title || '—') + '</span></li>' +
      (acc.siteDiscipline ? '<li><span class="k">Discipline</span><span class="v">' + esc(acc.siteDiscipline) + '</span></li>' : '') +
      '<li><span class="k">Status</span><span class="v">' + esc(acc._status || 'active') + '</span></li>' +
      '</ul><div class="mini">To change what someone holds, invite them again with the ' +
      'functions they should have — the invitation updates the person rather than ' +
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
        var txt = span ? span.textContent.replace(/^[^\w]*\s*/, '').trim() : '';
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

  function boot(){ try{ var lg=document.getElementById('login'); if(lg) lg.classList.add('hide'); }catch(e){} try{ wireCreate(); }catch(e){} try{ installLivePM(); }catch(e){} try{ installLiveActivityPanel(); }catch(e){} try{ installLiveAttachments(); }catch(e){} try{ installLiveRecordActions(); }catch(e){} try{ installTemplateForms(); }catch(e){} try{ installLiveBOM(); }catch(e){} try{ installLiveIPC(); }catch(e){} try{ installMissingRegisters(); }catch(e){} try{ installRaiseGuard(); }catch(e){} try{ installRealExcelExport(); }catch(e){} try{ installLivePortfolio(); }catch(e){} try{ installNaNGuard(); }catch(e){} try{ installLiveKpis(); }catch(e){} try{ installLiveNavBadges(); }catch(e){} try{ installNavigation(); }catch(e){} try{ installLiveHse(); }catch(e){} try{ installLiveReports(); }catch(e){} try{ installPanelButtons(); }catch(e){} try{ installLastPanels(); }catch(e){} try{ installGenericRecordFix(); }catch(e){} try{ installTeamEdit(); }catch(e){} try{ installLiveFormUploads(); }catch(e){} if(!window.__NO_MODULE__){ try{ signIn(ME.email); }catch(e){} } }
  fetch('/api/data',{cache:'no-store'})
    .then(function(r){ return r.ok?r.json():null; })
    .then(function(d){ try{ mapAct(d); }catch(e){} try{ window.__RECENT=(d && d.recent) || []; }catch(e){} return loadRecords(); })
    .then(function(){ return loadPeople(); })
    .then(function(){ return loadVerify(); })
    .then(boot).catch(boot);
})();
</script>


<style>
#ntfDlg{border:1px solid var(--line);border-radius:var(--r-frame);padding:0;width:min(560px,94vw);max-height:88vh;color:var(--text);background:var(--surface)}
#ntfDlg::backdrop{background:var(--scrim)}
#ntfDlg .h{padding:24px 24px 8px;font-family:var(--font);font-size:var(--fs-headline);line-height:var(--lh-headline);font-weight:500}
#ntfDlg .b{padding:4px 24px 16px;font-family:var(--font);font-size:var(--fs-body);line-height:var(--lh-body);overflow:auto;max-height:60vh}
#ntfDlg label.t{display:block;font-size:var(--fs-secondary);line-height:var(--lh-secondary);color:var(--text-2);margin:12px 0 4px}
#ntfDlg .chips{display:flex;flex-wrap:wrap;gap:8px;margin:4px 0 8px}
#ntfDlg .chip{display:inline-flex;align-items:center;min-height:36px;border:1px solid var(--line);border-radius:var(--r-pill);padding:0 12px;font-size:var(--fs-secondary);cursor:pointer;background:var(--surface-2);color:var(--text-2)}
#ntfDlg .chip.on{background:var(--card-light);border-color:transparent;color:var(--on-card-light)}
#ntfDlg .ppl{border:1px solid var(--line);border-radius:var(--r-card);max-height:190px;overflow:auto}
#ntfDlg .ppl label{display:flex;gap:8px;align-items:center;min-height:44px;margin:0;padding:0 12px;border-bottom:1px solid var(--line);cursor:pointer;color:var(--text);font-size:var(--fs-body)}
#ntfDlg .ppl label span{color:var(--text-2);font-size:var(--fs-secondary)}
#ntfDlg .f{display:flex;gap:8px;justify-content:flex-end;align-items:center;padding:16px 24px 24px;border-top:1px solid var(--line)}
#ntfDlg button{font:inherit;font-size:var(--fs-secondary);min-height:44px;padding:0 16px;border-radius:var(--r-pill);border:1px solid var(--line);background:var(--surface-2);color:var(--text);cursor:pointer}
#ntfDlg button.p{background:var(--accent);border-color:transparent;color:var(--on-accent);border-radius:var(--r-control);font-size:var(--fs-body);font-weight:500}
#ntfDlg .m{font-size:var(--fs-secondary);margin-right:auto;color:var(--text-2)}
#ntfList{position:fixed;top:72px;right:16px;width:min(380px,92vw);max-height:70vh;overflow:auto;background:var(--surface);color:var(--text);border:1px solid var(--line-strong);border-radius:var(--r-card);z-index:9999;font-family:var(--font);font-size:var(--fs-body);line-height:var(--lh-body);display:none}
#ntfList .hd{display:flex;justify-content:space-between;align-items:center;padding:12px 16px;border-bottom:1px solid var(--line);font-weight:500}
#ntfList .hd a{font-weight:400;font-size:var(--fs-secondary);color:var(--accent-text);cursor:pointer}
#ntfList .it{padding:12px 16px;border-bottom:1px solid var(--line)}
#ntfList .it.un{background:var(--surface-2)}
#ntfList .it b{display:block;font-size:var(--fs-body);font-weight:500}
#ntfList .it div{font-size:var(--fs-secondary);color:var(--text-2);margin-top:2px;white-space:pre-wrap}
#ntfList .it span{font-size:var(--fs-secondary);color:var(--text-2)}
#ntfList .none{padding:16px;color:var(--text-2)}
#ntfPpl .ntf-note{padding:12px;color:var(--text-2)}
#ntfPpl .ntf-note.bad{color:var(--bad-ink)}
</style>
<dialog id="ntfDlg"><div class="h">Notify the team</div><div class="b">
  <label class="t">Subject</label><input type="text" id="ntfTitle">
  <label class="t">Message (optional)</label><textarea id="ntfMsg"></textarea>
  <label class="t">Who — pick a group, or people</label>
  <div class="chips" id="ntfChips"></div>
  <div class="ppl" id="ntfPpl"><div class="ntf-note">Loading the project team…</div></div>
  <label style="display:flex;gap:8px;align-items:center;margin-top:12px" id="ntfEmailRow"><input type="checkbox" id="ntfEmail" checked> Also send by email</label>
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
    }).join('') : '<div class="ntf-note">Nobody else is on this project yet.</div>';
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
      if (!j) { el('ntfPpl').innerHTML = '<div class="ntf-note bad">Could not load the team.</div>'; return; }
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

</body>
</html>
`;
export const appHTML = (meJson) => TEMPLATE.replace('__ME_JSON__', meJson);
