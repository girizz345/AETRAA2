# `src/html/app.js` — hand changes for the new look (26 Oct 2026)

`app.js` is generated from `dashboard-design.html` by `tools/gen-app.mjs`. Neither of those
is in this folder, and Girish asked for the dashboards to be restyled now. So `app.js` was
changed by hand. **Running the generator without these changes undoes the new look.** When
`gen-app.mjs` and `dashboard-design.html` arrive, carry these into the design file, regenerate,
and compare with this copy. A copy of `app.js` before the restyle is kept outside the
repository (the session scratchpad, `app.js.before-restyle`).

## 1. Imports (top of the file, before `const TEMPLATE`)

```js
import { THEME_TOKENS } from './theme.js';
import { icon, symbolIcons } from './icons.js';
import { BUILDING_ART } from './art.js';
```

## 2. The stylesheet (the first `<style>` block)

Replaced whole. It now starts with `${THEME_TOKENS}` (the platform's palette, font and
scales, both themes), then points the design's own names at it, so the script's inline
`var(--navy)`, `var(--gold)` and so on follow both themes:

```css
--navy: var(--text); --navy2: var(--surface-2); --blue: var(--accent-text); --blue2: var(--accent);
--gold: var(--accent); --faint: var(--text-2); --soft: var(--surface-2); --white: var(--surface);
--tint: color-mix(in srgb, var(--accent) 16%, transparent);
```

Every class name the script uses is kept. What changed in the look:

- **Frame:** the shell sits in a rounded frame (22px) on the darker `--void` ground.
- **Sidebar:** solid deep navy; AETRAA in champagne gold; menu items with line icons. The
  active item is a light pill with a gold marker. On a phone it becomes a strip across the top.
- **Header (`.top`):** the one strongly frosted surface. It is sticky and compact, with the page
  title in plain words (24px, semibold) and the project line under it. It also holds the
  light/dark button and the bell.
- **KPI row (`.kpis`):** four cards, each with its label and icon tile on top and the number
  below. Colours by role: champagne for the main figure, muted red for overdue, green for
  verified or healthy.
- **Columns (`.cols`):** 2 : 1. The attention queue gets the wide column; decisions and activity
  sit in the narrow one.
- **Cards:** deep navy (`--card`, slightly translucent, no blur), with a hairline border, a
  16px radius and semibold titles.
- **Featured cards:** a card the design edged in gold (`border-left:3px solid var(--gold)`) is
  featured. It is frosted, with a champagne border.
- **The queue:** each item in "Needs my attention" (`tr[data-attn]`) is a rounded row.
- **Tables, pills, sign-off buttons, the detail drawer, the forms and the login:** all on the
  tokens. Pills are a status tint plus words.
- **Print:** the print window is forced to the light theme and has no frame.
- **Phones:** the figures go two per row and every column shrinks, so nothing scrolls sideways.

## 3. Markup

- **Header:** a light/dark button (`#themeBtn`, `${icon('contrast', 18)}`) and a line-icon
  bell (`${icon('bell', 18)}`) in place of 🔔. There is also a `.topart` line drawing, which is
  hidden in the current style.
- **Login:** a `.loginart` line drawing behind the card.
- **Sidebar:** the 🔒 note uses `${icon('lock', 12)}`.

## 4. Script

- **Icons:** `var SYM = ${symbolIcons(16)}; function ico(s)` turns the design's symbol
  characters into line icons. It is used in `drawNav`, the role buttons (`drawHats`), the
  principal's section tiles, the attention list (`ATT_ICON`) and the attachment icons
  (`attIcon`).
- **KPI cards:**
  - `kpi(v, l, c)` draws the new card; `kpiSym(l)` picks its icon from the label.
  - `fourKpis(k)` keeps four figures: the first three, plus "Overdue" when a role lists it
    further down. It is used wherever a KPI row is drawn: the design's role dashboards, the
    principal's drill-down and `installLiveKpis`.
  - The inline `gridTemplateColumns` on `#kpis` is now left empty.
- **Inline colours moved to tokens:**
  - the preview banner;
  - the template step chips;
  - the PM override note;
  - the "Not switched on" box;
  - `.tpl-mark`;
  - the unlinked BOQ row tint;
  - the BOQ section rows;
  - the report "paper" (now the cream card).
- **Notifications:** the embedded "Notify the team" and bell styles are replaced by the
  themed copy from `src/html/notify-ui.js`.

`tools/check-theme.mjs` now checks `app.js` too: no typed-in colours, sizes on the scale, and
only the platform fonts. The script face stays only on the drawn signature (`.sig`).

## Launch additions (27 Oct 2026)

- `drawNav` adds a **YOU** group at the foot of the menu:
  - My files (`/myfiles`) and Your account (`/account`), for everyone;
  - Integrations (`/integrations`), for a Principal or PM.

  `NAV_TARGET` has the three pages.
- The team view's right-hand column was the design's sample (projects, "recent access changes").
  `teamRightLive()` now fills it from `__ME__.projects`, `/api/account` and `/api/audit`.
