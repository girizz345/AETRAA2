// Shared look and feel for all three pages.
// Palette roles follow the validated default data-viz palette.

export const THEME_CSS = `
:root {
  color-scheme: light;
  --plane:        #f9f9f7;
  --surface:      #fcfcfb;
  --surface-2:    #f3f3f0;
  --ink:          #0b0b0b;
  --ink-2:        #52514e;
  --muted:        #898781;
  --grid:         #e1e0d9;
  --axis:         #c3c2b7;
  --border:       rgba(11,11,11,0.10);
  --series-1:     #2a78d6;
  --series-2:     #eb6834;
  --series-3:     #1baf7a;
  --series-4:     #eda100;
  --series-5:     #e87ba4;
  --series-6:     #008300;
  --series-7:     #4a3aa7;
  --series-8:     #e34948;
  --good:         #0ca30c;
  --warning:      #fab219;
  --serious:      #ec835a;
  --critical:     #d03b3b;
  --good-text:    #006300;
  --planned-bar:  #cde2fb;
  --shadow:       0 1px 2px rgba(11,11,11,.05), 0 8px 24px rgba(11,11,11,.04);
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    color-scheme: dark;
    --plane:       #0d0d0d;
    --surface:     #1a1a19;
    --surface-2:   #232322;
    --ink:         #ffffff;
    --ink-2:       #c3c2b7;
    --muted:       #898781;
    --grid:        #2c2c2a;
    --axis:        #383835;
    --border:      rgba(255,255,255,0.10);
    --series-1:    #3987e5;
    --series-2:    #d95926;
    --series-3:    #199e70;
    --series-4:    #c98500;
    --series-5:    #d55181;
    --series-6:    #008300;
    --series-7:    #9085e9;
    --series-8:    #e66767;
    --good-text:   #0ca30c;
    --planned-bar: #184f95;
    --shadow:      0 1px 2px rgba(0,0,0,.4);
  }
}
:root[data-theme="dark"] {
  color-scheme: dark;
  --plane: #0d0d0d; --surface: #1a1a19; --surface-2: #232322;
  --ink: #ffffff; --ink-2: #c3c2b7; --muted: #898781;
  --grid: #2c2c2a; --axis: #383835; --border: rgba(255,255,255,0.10);
  --series-1: #3987e5; --series-2: #d95926; --series-3: #199e70; --series-4: #c98500;
  --series-5: #d55181; --series-6: #008300; --series-7: #9085e9; --series-8: #e66767;
  --good-text: #0ca30c; --planned-bar: #184f95; --shadow: 0 1px 2px rgba(0,0,0,.4);
}

* { box-sizing: border-box; }
[hidden] { display: none !important; }
html, body { margin: 0; }
body {
  background: var(--plane);
  color: var(--ink);
  font: 14px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif;
  -webkit-text-size-adjust: 100%;
}
a { color: var(--series-1); }
h1, h2, h3 { margin: 0; font-weight: 600; letter-spacing: -0.01em; }
h1 { font-size: 18px; }
h2 { font-size: 15px; }
h3 { font-size: 13px; color: var(--ink-2); font-weight: 600; }

.wrap { max-width: 1400px; margin: 0 auto; padding: 16px; }
@media (min-width: 700px) { .wrap { padding: 20px 24px 48px; } }

.topbar {
  position: sticky; top: 0; z-index: 20;
  background: var(--surface); border-bottom: 1px solid var(--border);
}
.topbar-in {
  max-width: 1400px; margin: 0 auto; padding: 10px 16px;
  display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
}
.brand { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.brand .sub { font-size: 11.5px; color: var(--muted); }
.spacer { flex: 1 1 auto; }

.card {
  background: var(--surface); border: 1px solid var(--border);
  border-radius: 10px; padding: 14px 16px; box-shadow: var(--shadow);
}
.card + .card { margin-top: 14px; }
.card-head { display: flex; align-items: baseline; gap: 10px; margin-bottom: 10px; flex-wrap: wrap; }
.card-head .note { font-size: 11.5px; color: var(--muted); }

.btn {
  appearance: none; border: 1px solid var(--border); background: var(--surface);
  color: var(--ink); border-radius: 8px; padding: 7px 12px; font: inherit;
  font-size: 13px; cursor: pointer; white-space: nowrap;
}
.btn:hover { background: var(--surface-2); }
.btn-primary { background: var(--series-1); border-color: transparent; color: #fff; font-weight: 500; }
.btn-primary:hover { filter: brightness(1.08); background: var(--series-1); }
.btn:disabled { opacity: .5; cursor: default; }
.btn-lg { padding: 12px 16px; font-size: 15px; border-radius: 10px; }

label { display: block; font-size: 12px; color: var(--ink-2); margin-bottom: 4px; font-weight: 500; }
input, select, textarea {
  width: 100%; font: inherit; color: var(--ink); background: var(--surface);
  border: 1px solid var(--axis); border-radius: 8px; padding: 9px 10px;
}
input:focus, select:focus, textarea:focus { outline: 2px solid var(--series-1); outline-offset: -1px; border-color: var(--series-1); }
textarea { min-height: 70px; resize: vertical; }
.field { margin-bottom: 12px; }
.row { display: grid; gap: 12px; }
@media (min-width: 560px) { .row.two { grid-template-columns: 1fr 1fr; } .row.three { grid-template-columns: 1fr 1fr 1fr; } }

.tabs { display: flex; gap: 2px; overflow-x: auto; border-bottom: 1px solid var(--border); margin-bottom: 14px; }
.tab {
  appearance: none; background: none; border: none; border-bottom: 2px solid transparent;
  color: var(--ink-2); font: inherit; font-size: 13.5px; padding: 9px 12px; cursor: pointer; white-space: nowrap;
}
.tab[aria-selected="true"] { color: var(--ink); border-bottom-color: var(--series-1); font-weight: 600; }

.tiles { display: grid; gap: 12px; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); }
.tile { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 12px 14px; box-shadow: var(--shadow); }
.tile .k { font-size: 11.5px; color: var(--muted); text-transform: uppercase; letter-spacing: .04em; }
.tile .v { font-size: 28px; font-weight: 600; line-height: 1.15; margin-top: 4px; letter-spacing: -0.02em; }
.tile .s { font-size: 12px; color: var(--ink-2); margin-top: 2px; }

.pill { display: inline-flex; align-items: center; gap: 5px; font-size: 11.5px; font-weight: 600;
        padding: 2px 8px 2px 6px; border-radius: 999px; border: 1px solid var(--border); white-space: nowrap; }
.dot { width: 8px; height: 8px; border-radius: 50%; flex: 0 0 8px; }

.scroll-x { overflow-x: auto; }
table { border-collapse: collapse; width: 100%; font-size: 13px; }
th, td { text-align: left; padding: 7px 9px; border-bottom: 1px solid var(--grid); vertical-align: top; }
th { font-size: 11.5px; color: var(--muted); font-weight: 600; text-transform: uppercase; letter-spacing: .03em;
     position: sticky; top: 0; background: var(--surface); z-index: 1; cursor: pointer; white-space: nowrap; }
td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
tr.summary td { font-weight: 600; background: var(--surface-2); }
.empty { padding: 32px 16px; text-align: center; color: var(--muted); font-size: 13px; }

.legend { display: flex; gap: 14px; flex-wrap: wrap; font-size: 12px; color: var(--ink-2); }
.legend span { display: inline-flex; align-items: center; gap: 6px; }
.swatch { width: 11px; height: 11px; border-radius: 2px; }

.tooltip {
  position: fixed; pointer-events: none; z-index: 60; opacity: 0; transition: opacity .08s;
  background: var(--surface); color: var(--ink); border: 1px solid var(--border);
  border-radius: 8px; padding: 8px 10px; font-size: 12px; box-shadow: 0 6px 24px rgba(0,0,0,.18); max-width: 260px;
}
.tooltip b { font-weight: 600; }
.tooltip .tl { display: flex; justify-content: space-between; gap: 14px; font-variant-numeric: tabular-nums; }

.toast {
  position: fixed; left: 50%; bottom: 20px; transform: translateX(-50%) translateY(12px);
  background: var(--ink); color: var(--plane); padding: 10px 16px; border-radius: 999px;
  font-size: 13px; opacity: 0; transition: .2s; z-index: 80; pointer-events: none; max-width: 90vw;
}
.toast.show { opacity: 1; transform: translateX(-50%); }
.toast.bad { background: var(--critical); color: #fff; }

.grid-photos { display: grid; gap: 10px; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); }
.photo { border: 1px solid var(--border); border-radius: 8px; overflow: hidden; background: var(--surface-2); }
.photo img { display: block; width: 100%; height: 120px; object-fit: cover; cursor: zoom-in; }
.photo .cap { padding: 6px 8px; font-size: 11.5px; color: var(--ink-2); }
.lightbox { position: fixed; inset: 0; background: rgba(0,0,0,.85); display: none; align-items: center;
            justify-content: center; z-index: 90; padding: 16px; }
.lightbox.on { display: flex; }
.lightbox img { max-width: 100%; max-height: 88vh; border-radius: 8px; }

.hint { font-size: 12px; color: var(--muted); }
.sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
`;

export const STATUS_META = {
  not_started: { label: 'Not started', color: 'var(--muted)', icon: '○' },
  in_progress: { label: 'In progress', color: 'var(--series-1)', icon: '◐' },
  complete:    { label: 'Complete',    color: 'var(--good)',     icon: '✓' },
  at_risk:     { label: 'At risk',     color: 'var(--warning)',  icon: '!' },
  delayed:     { label: 'Delayed',     color: 'var(--critical)', icon: '▲' },
  on_hold:     { label: 'On hold',     color: 'var(--serious)',  icon: '‖' },
};
