// THE LOOK, FOR EVERY PAGE — colours, type, and the parts pages are built from.
//
// Quiet and architectural: a cool slate with one warm sand accent, off-white
// text, thin 1px lines, frosted cards, almost no shadow. Light is the same
// character reversed.
//
// Every colour on the platform is one of the variables below. A page names a
// role (--text-2, --line, --bad-ink …), never a colour, so both themes and any
// later change of palette reach every screen at once. tools/check-theme.mjs
// holds the converted pages to that.
//
// Two theme sources, as before: the person's own choice (data-theme on <html>,
// set by THEME_BOOT in src/index.js from 'sm-theme') wins; with no choice, the
// computer's own light/dark setting decides.
//
// Contrast: every text colour here is at least 4.5:1 on --bg, --surface and
// --surface-2 in its theme (CHANGES-test-drive.md lists the figures). The one
// exception is --text-3, which is for DISABLED controls only — captions use
// --text-2. Status text on a pill uses the -ink shade, which holds 4.5:1 on its
// own 15% tint.
//
// The older names (--plane, --ink, --muted, --border, --series-1 …) are kept as
// aliases so a page not yet converted takes the new palette instead of breaking.

// Two faces: Roboto Slab for every word that is read or clicked — text,
// tables, fields, buttons, pills, labels — and Bebas Neue for display titles
// and big figures. Served from /fonts; Google's copy is the fallback.
const FONT_FACE = `
@font-face {
  font-family: "Roboto Slab"; font-style: normal; font-weight: 100 900; font-display: swap;
  src: url(/fonts/roboto-slab-var.woff2) format("woff2"),
       url(https://fonts.gstatic.com/s/robotoslab/v36/BngMUXZYTXPIvIBgJJSb6ufN5qU.woff2) format("woff2");
}
@font-face {
  /* → ← ↔, which Roboto Slab lacks: drawn to its proportions and declared as
     part of the family for those three characters, so no other font shows. */
  font-family: "Roboto Slab"; font-style: normal; font-weight: 100 900; font-display: swap;
  unicode-range: U+2190, U+2192, U+2194;
  src: url(/fonts/aetraa-arrows.woff) format("woff");
}
@font-face {
  font-family: "Bebas Neue"; font-style: normal; font-weight: 400; font-display: swap;
  src: url(/fonts/bebas-neue.woff2) format("woff2"),
       url(https://fonts.gstatic.com/s/bebasneue/v16/JTUSjIg69CK48gW7PXoo9Wlhyw.woff2) format("woff2");
}`;

// Light: the default, and the explicit choice.
const LIGHT = `
  color-scheme: light;
  --bg:           #F4F6FA;
  --surface:      #FFFFFF;
  --surface-2:    #EEF2F7;
  --glass:        rgba(255,255,255,0.72);
  --card:         rgba(255,255,255,0.96);
  --text:         #0F1A2E;
  --text-2:       #526074;
  --text-3:       #8792A3;
  --accent:       #C9AE78;
  --accent-text:  #7A5E2C;
  --on-accent:    #0F1A2E;
  --card-light:   #F1E8D5;
  --on-card-light:#0F1A2E;
  --line:         rgba(15,26,46,0.09);
  --line-strong:  rgba(15,26,46,0.17);
  --good:         #2F6B47;
  --warn:         #7E5716;
  --bad:          #A23B3B;
  --good-ink:     #2A6141;
  --warn-ink:     #76511A;
  --bad-ink:      #983636;
  --scrim:        rgba(11,18,32,0.45);
  --void:         #E3E8F0;
  --frame-1:      #F7F9FC;
  --frame-2:      #F1F4F9;
  --glow:         rgba(201,174,120,0.14);
  --series-2:     #4F6F9E; --series-3: #2F6B47; --series-4: #9A6B1E; --series-5: #8E5A7D;
  --series-6:     #2F7470; --series-7: #5F55A0; --series-8: #A23B3B;
  --serious:      #A35A2E;
  --planned-bar:  rgba(201,174,120,0.28);`;

// Dark: the computer's dark setting, and the explicit choice.
const DARK = `
  color-scheme: dark;
  --bg:           #0B1220;
  --surface:      #111A2E;
  --surface-2:    #18233A;
  --glass:        rgba(14,22,40,0.62);
  --card:         rgba(17,26,46,0.92);
  --text:         #E8ECF3;
  --text-2:       #94A3B8;
  --text-3:       #64748B;
  --accent:       #D6BE8A;
  --accent-text:  #D9C394;
  --on-accent:    #141B2B;
  --card-light:   #EFE6D2;
  --on-card-light:#141B2B;
  --line:         rgba(148,163,184,0.14);
  --line-strong:  rgba(148,163,184,0.26);
  --good:         #7CC49A;
  --warn:         #DDB26E;
  --bad:          #E58A8A;
  --good-ink:     #8FD3A9;
  --warn-ink:     #E6C08A;
  --bad-ink:      #F0A3A3;
  --scrim:        rgba(3,7,15,0.62);
  --void:         #060A13;
  --frame-1:      #0D1526;
  --frame-2:      #0A101D;
  --glow:         rgba(214,190,138,0.07);
  --series-2:     #7FA3D6; --series-3: #7CC49A; --series-4: #DDB26E; --series-5: #C79BC0;
  --series-6:     #6FBFB8; --series-7: #A99BE0; --series-8: #E58A8A;
  --serious:      #E0A07A;
  --planned-bar:  rgba(214,190,138,0.22);`;

// The tokens alone — the font, both palettes and the scales — for a page that
// brings its own components (the dashboard shell, src/html/app.js).
export const THEME_TOKENS = `${FONT_FACE}
:root {${LIGHT}
  /* type */
  --font: "Roboto Slab", "Rockwell", "Cambria", serif;
  --font-display: "Bebas Neue", "Oswald", "Arial Narrow", sans-serif;
  --font-ui: "Roboto Slab", "Rockwell", "Cambria", serif;
  --mono: "Roboto Slab", "Rockwell", "Cambria", serif;     /* references: the reading face, even-width figures */
  --fs-display: clamp(40px, 5.6vw, 76px); --lh-display: 1;
  --fs-title: 24px;     --lh-title: 30px;
  --fs-headline: 17px;  --lh-headline: 24px;
  --fs-body: 15px;      --lh-body: 22px;
  --fs-secondary: 13px; --lh-secondary: 19px;
  --fs-label: 11px;     --lh-label: 14px;
  --fs-number: 32px;    --lh-number: 36px;
  /* Display steps for Bebas Neue, which sets small for its size. */
  --fs-d1: 64px; --fs-d2: 48px; --fs-d3: 40px; --fs-d4: 32px;
  /* space, corners */
  --s1: 4px; --s2: 8px; --s3: 12px; --s4: 16px; --s5: 24px; --s6: 32px; --s7: 48px;
  --r-frame: 16px; --r-card: 12px; --r-control: 10px; --r-pill: 999px;
  --blur: blur(18px) saturate(120%);
  --glass-edge: inset 0 1px 0 rgba(255,255,255,0.04);
  /* the older names, kept so every page follows the palette */
  --plane: var(--bg); --ink: var(--text); --ink-2: var(--text-2); --muted: var(--text-2);
  --grid: var(--line); --axis: var(--line-strong); --border: var(--line);
  --series-1: var(--accent); --warning: var(--warn); --critical: var(--bad);
  --good-text: var(--good-ink); --shadow: none;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {${DARK}
  }
}
:root[data-theme="dark"] {${DARK}
}
:root[data-theme="light"] {${LIGHT}
}
`;

export const THEME_CSS = THEME_TOKENS + `
/* ------------------------------------------------------------ the page
 * Every page is one framed object on a darker ground: a rounded slab with a
 * hairline edge, lit warm from one side. On a phone the frame is the screen. */
* { box-sizing: border-box; }
[hidden] { display: none !important; }
html, body { margin: 0; }
html { background: var(--void); }
body {
  margin: var(--s4); min-height: calc(100vh - 2 * var(--s4));
  border: 1px solid var(--line); border-radius: 22px;
  background:
    radial-gradient(900px 520px at 78% 18%, var(--glow), transparent 70%),
    linear-gradient(180deg, var(--frame-1), var(--frame-2) 70%);
  color: var(--text);
  font-family: var(--font); font-size: var(--fs-body); line-height: var(--lh-body); font-weight: 400;
  font-synthesis: none;
  -webkit-text-size-adjust: 100%; -webkit-font-smoothing: antialiased;
}
@media (max-width: 600px) { body { margin: 0; min-height: 100vh; border: 0; border-radius: 0; } }
a { color: var(--accent-text); text-underline-offset: 3px; }
b, strong { font-weight: 500; }
h1, h2, h3 { margin: 0; letter-spacing: -0.01em; }
h1 { font-size: var(--fs-title); line-height: var(--lh-title); font-weight: 400; }
h2 { font-size: var(--fs-headline); line-height: var(--lh-headline); font-weight: 500; }
h3 { font-size: var(--fs-label); line-height: var(--lh-label); font-weight: 500; color: var(--text-2);
     text-transform: uppercase; letter-spacing: 0.1em; }
.ic { display: inline-block; vertical-align: -0.2em; flex: 0 0 auto; }

/* The seven sizes. Nothing else is used. */
.t-display  { font-size: var(--fs-display); line-height: var(--lh-display); font-weight: 300;
              text-transform: uppercase; letter-spacing: -0.02em; margin: 0; }
.t-title    { font-size: var(--fs-title); line-height: var(--lh-title); font-weight: 400; }
.t-headline { font-size: var(--fs-headline); line-height: var(--lh-headline); font-weight: 500; }
.t-body     { font-size: var(--fs-body); line-height: var(--lh-body); }
.t-secondary, .hint { font-size: var(--fs-secondary); line-height: var(--lh-secondary); color: var(--text-2); }
.t-label, .label { font-size: var(--fs-label); line-height: var(--lh-label); font-weight: 500; color: var(--text-2);
              text-transform: uppercase; letter-spacing: 0.1em; }
.t-number   { font-size: var(--fs-number); line-height: var(--lh-number); font-weight: 300;
              font-variant-numeric: tabular-nums; letter-spacing: -0.01em; }
.ref        { font-family: var(--mono); font-variant-numeric: tabular-nums; letter-spacing: 0; }
.key        { color: var(--accent-text); }
.lead       { font-size: var(--fs-body); line-height: 1.6; font-weight: 300; color: var(--text-2); max-width: 44ch; margin: 0; }

/* -------------------------------------------------- the composed page
 * A hero (label, display title with one sand word, a lead, one main button;
 * line art beside it, a frosted card floating on the art), then a row of
 * figures, the cream card and feature tiles, then the working area. */
.hero { position: relative; display: grid; grid-template-columns: minmax(0, 5fr) minmax(0, 7fr);
  gap: var(--s5); align-items: center; min-height: 440px; margin-bottom: var(--s6); }
.hero-copy { display: grid; gap: var(--s4); align-content: center; position: relative; z-index: 1; }
.hero-copy .t-display { font-size: clamp(52px, 6.2vw, 92px); line-height: .95; }
.hero-copy .btn-primary { justify-self: start; margin-top: var(--s2); }
.hero-art { position: relative; height: 100%; min-height: 360px; color: var(--text-2); }
.hero-art .art { position: absolute; inset: 0; width: 100%; height: 100%; }
.hero-art .float { position: absolute; right: 0; top: var(--s4); width: min(300px, 70%); }
.art { display: block; }
@media (max-width: 860px) {
  .hero { grid-template-columns: 1fr; min-height: 0; }
  .hero-art { min-height: 260px; }
  .hero-art .float { position: relative; top: auto; right: auto; width: 100%; margin-top: 200px; }
}
/* The floating card: frosted, a touch brighter at the edge. */
.float { background: var(--glass); -webkit-backdrop-filter: var(--blur); backdrop-filter: var(--blur);
  border: 1px solid var(--line-strong); border-radius: var(--r-frame); padding: var(--s5);
  display: grid; gap: var(--s3); box-shadow: var(--glass-edge); color: var(--text); }
.float .t-number { color: var(--text); }
.float-foot { display: flex; align-items: center; justify-content: space-between; gap: var(--s3); }

.overview { display: grid; grid-template-columns: minmax(150px, 1fr) minmax(0, 2.4fr) minmax(0, 1.6fr);
  gap: var(--s5); align-items: stretch; margin-bottom: var(--s7); }
@media (max-width: 960px) { .overview { grid-template-columns: 1fr 1fr; } .overview > .card-light { grid-column: 1 / -1; order: -1; } }
@media (max-width: 600px) { .overview { grid-template-columns: 1fr; } }
.stats { display: grid; gap: var(--s5); align-content: center; padding-left: var(--s4); border-left: 1px solid var(--line); }
.stat .t-number { display: block; }
.stat .t-label { display: block; margin-top: var(--s1); }
.feats { display: grid; gap: var(--s4); align-content: center; padding-left: var(--s5); border-left: 1px solid var(--line); }
.feat { display: flex; gap: var(--s3); align-items: flex-start; }
.feat b { display: block; font-weight: 400; font-size: var(--fs-secondary); line-height: var(--lh-secondary); color: var(--text); }
.feat span.d { display: block; font-weight: 300; font-size: var(--fs-secondary); line-height: var(--lh-secondary); color: var(--text-2); }
@media (max-width: 600px) { .stats, .feats { border-left: 0; padding-left: 0; } .stats { grid-template-columns: repeat(3, 1fr); gap: var(--s3); } }

/* The foot of a floating card: words on the left, a ringed arrow on the right. */
.link-arrow.go { width: 100%; justify-content: space-between; }
.ring { width: 36px; height: 36px; flex: 0 0 36px; border: 1px solid var(--line-strong); border-radius: 50%;
  display: inline-flex; align-items: center; justify-content: center; }
.link-arrow.go:hover .ring { background: var(--surface-2); }
/* Every page's head (put in by src/index.js from the page's own title): the
   line as a label, the title large and light, the line drawing beside it. */
.pagehead { position: relative; display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(0, .9fr); align-items: end;
  gap: var(--s5); min-height: 200px; margin: 0 0 var(--s6); padding-bottom: var(--s5); border-bottom: 1px solid var(--line); }
.pagehead-copy { position: relative; z-index: 1; display: grid; gap: var(--s3); align-content: end; }
.pagehead-copy .t-label { margin: 0; }
.pagehead-copy .t-label:empty { display: none; }
.pagehead .t-display { font-size: clamp(44px, 5vw, 68px); line-height: .95; }
.pagehead-art { position: relative; height: 200px; color: var(--text-2); opacity: .5; }
.pagehead-art .art { position: absolute; inset: 0; width: 100%; height: 100%; }
@media (max-width: 760px) {
  .pagehead { grid-template-columns: 1fr; min-height: 0; }
  .pagehead-art { position: absolute; right: 0; top: 0; width: 55%; height: 100%; opacity: .2; }
  .pagehead .t-display { font-size: clamp(30px, 9vw, 44px); }
}
/* An arrow link: words, then the arrow. */
.link-arrow { display: inline-flex; align-items: center; gap: var(--s2); color: var(--text); text-decoration: none;
  font-size: var(--fs-secondary); background: none; border: 0; padding: 0; min-height: 44px; cursor: pointer; font-family: inherit; }
.link-arrow:hover { color: var(--accent-text); }
/* The section label above a title, with the corner arrow of the cream card. */
.corner { position: absolute; top: var(--s5); right: var(--s5); color: currentColor; }
/* A secondary pill on cream, like the reference's "Sign up". */
.btn-cream { background: var(--card-light); color: var(--on-card-light); border-color: transparent; }
.btn-cream:hover { border-color: transparent; filter: brightness(0.97); }

.wrap { max-width: 1200px; margin: 0 auto; padding: var(--s4); }
@media (min-width: 700px) { .wrap { padding: var(--s6) var(--s5) var(--s7); } }

/* -------------------------------------------------------- the top bar */
.topbar {
  position: sticky; top: 0; z-index: 20; border-radius: 22px 22px 0 0;
  background: color-mix(in srgb, var(--frame-1) 72%, transparent);
  -webkit-backdrop-filter: var(--blur); backdrop-filter: var(--blur);
  border-bottom: 1px solid var(--line);
}
.topbar-in {
  max-width: 1200px; margin: 0 auto; padding: var(--s3) var(--s5);
  display: flex; align-items: center; gap: var(--s3); flex-wrap: wrap; min-height: 76px;
}
/* The links in the middle of the bar, as in a site's main navigation. */
@media (min-width: 900px) {
  .topbar-in.centered { display: grid; grid-template-columns: 1fr auto 1fr; }
  .topbar-in.centered > .nav { justify-self: center; }
  .topbar-in.centered > .end { justify-self: end; }
}
/* Every page's bar in the same voice: its buttons read as quiet links, Sign
   out is the cream pill, the light/dark switch is a ringed icon. */
.topbar .btn:not(.btn-primary):not(.btn-cream) {
  background: none; border-color: transparent; color: var(--text-2); border-radius: var(--r-control); padding: 0 var(--s3);
}
.topbar .btn:not(.btn-primary):not(.btn-cream):hover { color: var(--text); border-color: transparent;
  background: color-mix(in srgb, var(--surface-2) 60%, transparent); }
.topbar a.btn[href="/api/logout"] { background: var(--card-light); color: var(--on-card-light); border-radius: var(--r-pill); padding: 0 var(--s4); }
.topbar a.btn[href="/api/logout"]:hover { background: var(--card-light); color: var(--on-card-light); filter: brightness(.97); }
.topbar #themeBtn.btn { width: 44px; padding: 0; border: 1px solid var(--line-strong); border-radius: 50%; color: var(--text); }
.end { display: flex; align-items: center; gap: var(--s2); margin-left: auto; }
.start { display: flex; align-items: center; gap: var(--s3); min-width: 0; }
@media (max-width: 600px) { .topbar { border-radius: 0; } .topbar-in { padding: var(--s2) var(--s4); } }
.topbar h1 { font-size: var(--fs-headline); line-height: var(--lh-headline); font-weight: 500; }
.brand { display: flex; flex-direction: column; gap: 0; min-width: 0; }
.brand .sub { font-size: var(--fs-secondary); line-height: var(--lh-secondary); color: var(--text-2); }
.spacer { flex: 1 1 auto; }
.nav { display: flex; align-items: center; gap: var(--s1); flex-wrap: wrap; }
.nav a, .nav .navlink {
  position: relative; display: inline-flex; align-items: center; gap: var(--s2); min-height: 44px;
  padding: 0 var(--s3); border-radius: var(--r-control); color: var(--text-2); text-decoration: none;
  font-size: var(--fs-secondary); line-height: var(--lh-secondary);
}
.nav a:hover { color: var(--text); }
.nav a[aria-current="page"] { color: var(--text); }
.nav a[aria-current="page"]::after {
  content: ""; position: absolute; left: 50%; bottom: 6px; width: 4px; height: 4px; margin-left: -2px;
  border-radius: 50%; background: var(--accent);
}
@media (max-width: 600px) {
  .topbar-in { gap: var(--s2); }
  .brand .sub { display: none; }
  .nav { order: 10; width: 100%; justify-content: flex-start; margin: 0 calc(-1 * var(--s3)); }
}

/* ---------------------------------------------------------------- cards */
/* Cards are deep navy with a hairline edge and only a little translucency;
   the strong frosted glass is kept for the header and featured cards (.float). */
.card {
  background: var(--card);
  border: 1px solid var(--line); border-radius: var(--r-frame); padding: var(--s5);
  box-shadow: var(--glass-edge);
}
.card + .card { margin-top: var(--s4); }
.card.solid { background: var(--surface); -webkit-backdrop-filter: none; backdrop-filter: none; }
.card-sm { border-radius: var(--r-card); padding: var(--s4); }
.card-head { display: flex; align-items: baseline; gap: var(--s3); margin-bottom: var(--s3); flex-wrap: wrap; }
.card-head .note { font-size: var(--fs-secondary); color: var(--text-2); }
/* One per page: the thing to do next. */
.card-light {
  background: var(--card-light); color: var(--on-card-light); border: 0;
  border-radius: var(--r-frame); padding: var(--s5);
}
.card-light .hint, .card-light .t-secondary, .card-light .t-label, .card-light .label { color: var(--on-card-light); opacity: .78; }

/* -------------------------------------------------------------- buttons */
.btn {
  appearance: none; display: inline-flex; align-items: center; justify-content: center; gap: var(--s2);
  min-height: 44px; padding: 0 var(--s4); border-radius: var(--r-pill);
  border: 1px solid var(--line); background: var(--surface-2); color: var(--text);
  font: inherit; font-size: var(--fs-secondary); line-height: var(--lh-secondary); font-weight: 400;
  cursor: pointer; white-space: nowrap; text-decoration: none;
}
.btn:hover { border-color: var(--line-strong); }
.btn:disabled { opacity: .5; cursor: default; }
/* The main action: one per screen, sand, with its arrow. */
.btn-primary {
  background: var(--accent); color: var(--on-accent); border-color: transparent;
  border-radius: var(--r-control); font-size: var(--fs-body); font-weight: 500; padding: 0 var(--s4) 0 var(--s5);
}
.btn-primary::after {
  content: ""; width: 16px; height: 16px; background: currentColor;
  -webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M5 12h14'/%3E%3Cpath d='m12 5 7 7-7 7'/%3E%3C/svg%3E") center / contain no-repeat;
          mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M5 12h14'/%3E%3Cpath d='m12 5 7 7-7 7'/%3E%3C/svg%3E") center / contain no-repeat;
}
.btn-primary:hover { background: var(--accent); border-color: transparent; filter: brightness(1.05); }
.btn-lg { min-height: 48px; font-size: var(--fs-body); }
/* A plain text action. */
.btn-text { appearance: none; background: none; border: 0; color: var(--text); font: inherit; cursor: pointer;
  display: inline-flex; align-items: center; gap: var(--s2); min-height: 44px; padding: 0 var(--s1); }
/* A round icon button: a 36px ring inside a 44px touch target. */
.icon-btn {
  appearance: none; position: relative; width: 44px; height: 44px; padding: 0; border: 0; background: none;
  color: var(--text); cursor: pointer; display: inline-flex; align-items: center; justify-content: center;
  border-radius: 50%;
}
.icon-btn::before { content: ""; position: absolute; inset: 4px; border-radius: 50%; border: 1px solid var(--line-strong); }
.icon-btn:hover::before { background: var(--surface-2); }
.icon-btn > * { position: relative; }
/* An icon in a square. */
.icon-tile { width: 36px; height: 36px; flex: 0 0 36px; display: inline-flex; align-items: center; justify-content: center;
  border: 1px solid var(--line); border-radius: var(--r-control); color: var(--text-2); }

/* -------------------------------------------------------------- forms */
label { display: block; font-size: var(--fs-secondary); line-height: var(--lh-secondary); color: var(--text-2);
        margin-bottom: var(--s1); font-weight: 400; }
input, select, textarea {
  width: 100%; font: inherit; font-size: var(--fs-body); color: var(--text); background: var(--surface-2);
  border: 1px solid var(--line); border-radius: var(--r-control); padding: 0 var(--s3); min-height: 44px;
}
textarea { padding: var(--s3); min-height: 88px; resize: vertical; }
select { padding-right: var(--s6); }
input::placeholder, textarea::placeholder { color: var(--text-2); }
input[type=file] { padding: var(--s1); background: var(--surface-2); font-size: var(--fs-secondary); color: var(--text-2); }
input[type=file]::file-selector-button {
  font: inherit; min-height: 34px; margin-right: var(--s3); padding: 0 var(--s4); border-radius: var(--r-pill);
  border: 1px solid var(--line-strong); background: var(--surface); color: var(--text); cursor: pointer;
}
/* A TICK BOX IS NOT A TEXT FIELD: a checkbox with width:100% stretches across
 * its container and squeezes its label to nothing, so the two controls that
 * are not fields opt out of the field styling. */
input[type=checkbox], input[type=radio] {
  width: 18px; height: 18px; min-height: 0; padding: 0; border: 0; border-radius: 0; background: none;
  accent-color: var(--accent); cursor: pointer;
}
input:focus, select:focus, textarea:focus { outline: none; border-color: var(--accent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 25%, transparent); }
:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
input:focus-visible, select:focus-visible, textarea:focus-visible { outline: none; }
.field { margin-bottom: var(--s3); }
.row { display: grid; gap: var(--s3); }
@media (min-width: 560px) { .row.two { grid-template-columns: 1fr 1fr; } .row.three { grid-template-columns: 1fr 1fr 1fr; } }

/* ----------------------------------------------------------------- tabs */
.tabs { display: flex; gap: var(--s1); overflow-x: auto; border-bottom: 1px solid var(--line); margin-bottom: var(--s4); }
.tab {
  appearance: none; position: relative; background: none; border: none; color: var(--text-2); font: inherit;
  font-size: var(--fs-secondary); min-height: 44px; padding: 0 var(--s3); cursor: pointer; white-space: nowrap;
}
.tab:hover { color: var(--text); }
.tab[aria-selected="true"] { color: var(--text); }
.tab[aria-selected="true"]::after { content: ""; position: absolute; left: 50%; bottom: 4px; width: 4px; height: 4px;
  margin-left: -2px; border-radius: 50%; background: var(--accent); }

/* ------------------------------------------------------- figures, tiles */
.tiles { display: grid; gap: var(--s3); grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); }
.tile { background: var(--card);
  border: 1px solid var(--line); border-radius: var(--r-card); padding: var(--s4); }
.tile .k { font-size: var(--fs-label); line-height: var(--lh-label); color: var(--text-2); font-weight: 500;
  text-transform: uppercase; letter-spacing: .1em; }
.tile .v { font-size: var(--fs-number); line-height: var(--lh-number); font-weight: 300; margin-top: var(--s2);
  font-variant-numeric: tabular-nums; letter-spacing: -0.01em; }
.tile .s { font-size: var(--fs-secondary); line-height: var(--lh-secondary); color: var(--text-2); margin-top: var(--s1); }

/* ---------------------------------------------------------------- pills
 * A status is never colour alone: tint + words + icon. */
.pill { display: inline-flex; align-items: center; gap: var(--s1); font-size: var(--fs-secondary); line-height: var(--lh-secondary);
  font-weight: 400; padding: 2px 10px; border-radius: var(--r-pill); white-space: nowrap;
  background: var(--surface-2); color: var(--text-2); border: 0; }
.pill.good { background: color-mix(in srgb, var(--good-ink) 15%, transparent); color: var(--good-ink); }
.pill.warn { background: color-mix(in srgb, var(--warn-ink) 15%, transparent); color: var(--warn-ink); }
.pill.bad  { background: color-mix(in srgb, var(--bad-ink) 15%, transparent);  color: var(--bad-ink); }
.dot { width: 8px; height: 8px; border-radius: 50%; flex: 0 0 8px; }

/* --------------------------------------------------------------- tables
 * No vertical lines; 1px row dividers; a 44px row; the header in label type
 * and stuck to the top. Add class "stack" (and data-label on each cell) and
 * under 768px every row becomes a card of its own. */
.scroll-x { overflow-x: auto; }
table { border-collapse: collapse; width: 100%; font-size: var(--fs-secondary); line-height: var(--lh-secondary); }
th, td { text-align: left; padding: var(--s3); border-bottom: 1px solid var(--line); vertical-align: top; }
td { height: 44px; }
th { font-size: var(--fs-label); line-height: var(--lh-label); color: var(--text-2); font-weight: 500;
     text-transform: uppercase; letter-spacing: .1em; position: sticky; top: 0; background: var(--surface);
     z-index: 1; white-space: nowrap; vertical-align: bottom; }
tbody tr:hover td { background: var(--surface-2); }
td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
tr.summary td { font-weight: 500; background: var(--surface-2); }
/* On a phone nothing may push the page sideways: a wide table scrolls inside
   its own card, a field is never wider than the screen, a button may wrap. */
@media (max-width: 767px) {
  table:not(.stack) { display: block; max-width: 100%; overflow-x: auto; }
  input, select, textarea { max-width: 100%; min-width: 0 !important; }
  .btn { white-space: normal; max-width: 100%; height: auto; text-align: center; }
  .card, .side { max-width: 100%; min-width: 0; }
  pre, code { white-space: pre-wrap; word-break: break-word; }
}
@media (max-width: 767px) {
  table.stack, table.stack tbody, table.stack tr, table.stack td { display: block; width: 100%; }
  table.stack thead { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
  table.stack tr { border: 1px solid var(--line); border-radius: var(--r-card); padding: var(--s3) var(--s4);
    margin-bottom: var(--s2); background: var(--surface); }
  table.stack td { border: 0; padding: var(--s1) 0; height: auto; text-align: left; }
  table.stack td[data-label]::before { content: attr(data-label); display: block; font-size: var(--fs-label);
    line-height: var(--lh-label); font-weight: 500; color: var(--text-2); text-transform: uppercase;
    letter-spacing: .1em; margin-bottom: 2px; }
  table.stack tbody tr:hover td { background: none; }
}

/* ------------------------------------------- empty, loading, messages */
.empty { padding: var(--s7) var(--s4); text-align: center; color: var(--text-2); font-size: var(--fs-body);
  display: flex; flex-direction: column; align-items: center; gap: var(--s3); }
.empty .icon-tile { width: 48px; height: 48px; flex-basis: 48px; border-radius: var(--r-card); }
.skel { display: grid; gap: var(--s3); padding: var(--s2) 0; }
.skel i { display: block; height: 14px; border-radius: var(--r-pill); background: var(--surface-2); }
.skel i:nth-child(3n+2) { width: 82%; } .skel i:nth-child(3n) { width: 64%; }

.legend { display: flex; gap: var(--s4); flex-wrap: wrap; font-size: var(--fs-secondary); color: var(--text-2); }
.legend span { display: inline-flex; align-items: center; gap: var(--s2); }
.swatch { width: 12px; height: 12px; border-radius: 3px; }

.tooltip {
  position: fixed; pointer-events: none; z-index: 60; opacity: 0;
  background: var(--surface); color: var(--text); border: 1px solid var(--line-strong);
  border-radius: var(--r-control); padding: var(--s2) var(--s3); font-size: var(--fs-secondary); max-width: 260px;
}
.tooltip b { font-weight: 500; }
.tooltip .tl { display: flex; justify-content: space-between; gap: var(--s4); font-variant-numeric: tabular-nums; }

.toast {
  position: fixed; left: 50%; bottom: var(--s5); transform: translateX(-50%) translateY(12px);
  background: var(--surface-2); color: var(--text); border: 1px solid var(--line-strong);
  padding: var(--s3) var(--s4); border-radius: var(--r-pill); font-size: var(--fs-secondary);
  opacity: 0; z-index: 80; pointer-events: none; max-width: 90vw;
}
.toast.show { opacity: 1; transform: translateX(-50%); }
.toast.bad { color: var(--bad-ink); border-color: var(--bad-ink); }

dialog { border: 1px solid var(--line); border-radius: var(--r-frame); background: var(--surface); color: var(--text);
  padding: 0; max-width: 96vw; }
dialog::backdrop { background: var(--scrim); }

.grid-photos { display: grid; gap: var(--s3); grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); }
.photo { border: 1px solid var(--line); border-radius: var(--r-card); overflow: hidden; background: var(--surface-2); }
.photo img { display: block; width: 100%; height: 120px; object-fit: cover; cursor: zoom-in; }
.photo .cap { padding: var(--s2); font-size: var(--fs-secondary); color: var(--text-2); }
.lightbox { position: fixed; inset: 0; background: var(--scrim); display: none; align-items: center;
            justify-content: center; z-index: 90; padding: var(--s4); }
.lightbox.on { display: flex; }
.lightbox img { max-width: 100%; max-height: 88vh; border-radius: var(--r-card); }

.sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }

/* ------------------------------------------------------------ the faces
 * Bebas Neue for display titles and big figures (one weight: never bolded);
 * Roboto Slab for everything else — text, tables, fields, buttons, pills,
 * labels and references (with even-width figures, so columns line up). */
.t-display, .t-number, .tile .v, .stat .t-number, .float .t-number, .pagehead h1, .hero h1 {
  font-family: var(--font-display); font-weight: 400; letter-spacing: .015em; text-transform: none;
}
.t-number, .tile .v, .stat .t-number, .float .t-number { font-size: 44px; line-height: 1; }
input, select, textarea, button, .btn, table, .pill, .tag, .t-label, .label, h3, label, .nav, .tabs, .tab, .seg,
.toast, .tooltip, .whoami, .proj, .ref, .tile .k, .bar, .rowbtns {
  font-family: var(--font-ui);
}
.ref, table { font-variant-numeric: tabular-nums; }
/* Code and commands too: the browser would otherwise draw them in its own monospace. */
code, kbd, pre, samp { font-family: var(--mono); font-size: .95em; }

/* ---------------------------------------------------------------- motion
 * 150–250ms, easing out, and only for people who have not asked for less. */
@media (prefers-reduced-motion: no-preference) {
  .btn, .icon-btn::before, .nav a, .tab, input, select, textarea, tbody td, .pill, .card, .tile {
    transition: background-color .18s ease-out, border-color .18s ease-out, color .18s ease-out, box-shadow .18s ease-out;
  }
  .toast, .tooltip { transition: opacity .2s ease-out, transform .2s ease-out; }
  .skel i { background: linear-gradient(90deg, var(--surface-2) 0%, var(--line-strong) 50%, var(--surface-2) 100%);
    background-size: 200% 100%; animation: skel 1.4s ease-out infinite; }
  @keyframes skel { from { background-position: 100% 0; } to { background-position: -100% 0; } }
}
`;

// Status of a programme activity. The icon names the line icon (src/html/icons.js).
export const STATUS_META = {
  not_started: { label: 'Not started', color: 'var(--text-2)', icon: 'minus' },
  in_progress: { label: 'In progress', color: 'var(--accent-text)', icon: 'clock' },
  complete:    { label: 'Complete',    color: 'var(--good-ink)', icon: 'check' },
  at_risk:     { label: 'At risk',     color: 'var(--warn-ink)', icon: 'alert' },
  delayed:     { label: 'Delayed',     color: 'var(--bad-ink)',  icon: 'alert' },
  on_hold:     { label: 'On hold',     color: 'var(--text-2)',   icon: 'clock' },
};
