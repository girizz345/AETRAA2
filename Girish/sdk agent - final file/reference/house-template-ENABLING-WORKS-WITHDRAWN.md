# WITHDRAWN — DO NOT BUILD FROM THIS FILE

**This template is withdrawn at v3.3.0.** It described the "BOQ — Enabling Works" sample and
was measured accurately, but that sample is not this office's issue format.

| | this file | the issued bills |
|---|---|---|
| Paper | US Letter 612 x 792 pt | **A4 portrait** |
| Font | Calibri 8.9 pt | **Arial 10 pt** |
| Columns | 6 Excel columns | **8** — A, B spacer, C, D, E, F, G, H |
| Ruling | every cell ruled | **vertical rules only** |
| Page | 56-row body, no repeated project band | **62-row page with a 4-row project band on every page** |
| Number format | Accounting `_(* #,##0.00_);...` | `#,##0.00_);[Red](#,##0.00)` |
| Foot | `To Collection` + page-code row | `To Collection` only; the page code sits in the head band |

A workbook built to this file is not the house format. The measured replacement is
`house-template.md` v2.0, taken from eleven issued tender workbooks.

Kept only so that a bill issued before the correction can be read back and understood.

---

# HOUSE TEMPLATE — LOCKED (R-VERBATIM)

The client's issued sample governs. Every string in this file is **frozen**: reproduce it
character for character. Do not paraphrase, re-word, re-order, re-case, re-punctuate, or
"improve" any of it. `verify_template.py` diffs the produced workbook against these strings
and **fails the run** on any deviation.

Source of truth: `BOQ — Enabling Works.pdf` (5 pages) + the four marked-up sheets
(`1. Site Clearance`, `2. Ground Improvements`, `3. Excavation`, `4. Shoring`).

---

## 1. BOQ SECTION PAGE — geometry

**Verified by extracting the rules, fonts and glyph positions from all four issued BOQ
pages and diffing them against a rendered replica. Every figure below is measured, not
inferred.**

Paper **US Letter portrait, 612 × 792 pt**. The page is a **fully ruled table** — every
cell carries a thin border, populated or not. A borderless BOQ page is not this format.

**Font: Calibri, 8.9 pt.** Not Arial. The issued PDF embeds `CIDFont+F1` = Calibri Bold
and `CIDFont+F2` = Calibri Regular, at 8.8632 pt. Calibri 11 is also the workbook default,
which is what the column-width arithmetic below is measured in.

### Vertical rules — the column boundaries, in points from the left paper edge

```
75.0  |  107.9  |  336.6  |  390.5  |  429.2  |  488.0  |  566.2
      Item No.  Description   QTY.     UNIT      RATE     AMOUNT
        32.9      228.7       53.9     38.7      58.8      78.2
```

Excel measures column width in characters of the workbook default font, so
`chars = (width_pt − 3.75) / 5.25`. That gives **5.55 · 42.85 · 9.55 · 6.66 · 10.49 ·
14.18**, and those reproduce the issued widths exactly.

### Horizontal rules

| y | What it closes |
|---|---|
| 28.4 | top of the table |
| 55.6 | under the `PROJECT :` band (one box, no internal rules) |
| 81.2 | under the column-header band |
| 714.6 | bottom of the body band |
| 726.1 | under the `To Collection` row |
| 737.6 | under the page-code row |

Band heights: PROJECT **27.2**, header **25.6**, body **632.5**, and **11.5** for each of
the two foot rows. Body line pitch **11.65 pt**.

> **Build these on a 0.75 pt grid.** The recalculation gate round-trips the workbook
> through LibreOffice, which snaps every row height to 0.75 pt. Set 11.71 and it comes
> back 11.25, and the body band loses 25 pt. The builder therefore uses 27.0 / 25.5 /
> 56 × 11.25 / 11.25 / 11.25, which reproduces the measured bands to within 3 pt over the
> full page and survives the round trip unchanged.

### Which rules survive into the foot

The vertical rules do **not** all run to the bottom of the page.

- **Section page** — 107.9, 336.6 and 390.5 stop at the body (714.6). The `To Collection`
  and page-code rows are ruled at **75.0, 429.2, 488.0, 566.2** only.
- **COLLECTION page** — 429.2 stops at the body as well, so `Total for … Carried to
  Summary` runs across to the AMOUNT column. Ruled at **75.0, 488.0, 566.2**.

### Alignment, weight and number format, column by column

| Column | Content | Treatment |
|---|---|---|
| Item No. | item letter | centred; vertically centred against the description block |
| Description | headings, narrative, item text | left at 109.9 (cell padding); wraps at **224.5 pt** |
| QTY. | measured figure | **centred**, `#,##0` |
| QTY. | nil | numeric **0** under Accounting format — prints `-` 13.1 pt in from the right edge |
| UNIT | `m2` `m3` `m` `Item` | centred |
| RATE | — | **always empty**. The bidder fills it. |
| AMOUNT | `= QTY × RATE` | Accounting format, right |
| AMOUNT | `Rate Only` | the literal string, right-aligned, Accounting format |

Accounting format, both columns:

```
_(* #,##0.00_);_(* (#,##0.00);_(* "-"??_);_(@_)      AMOUNT
_(* #,##0_);_(* (#,##0);_(* "-"??_);_(@_)            QTY nil
```

The `??_)` pad is what parks the dash 13.1–13.2 pt in from the column edge, which is
exactly where the issued sheet puts it in the QTY column, in every `To Collection` row and
on the whole COLLECTION page.

> **One deliberate regularisation.** The issued page B/1 renders its item AMOUNT dashes
> flush right (1.2 pt in) while B/2, every `To Collection` and the whole COLLECTION page
> render them at the Accounting offset. The source workbook is not self-consistent. We
> adopt Accounting throughout — it is the majority treatment and the only one that also
> explains the QTY column.

> **The second deliberate regularisation.** The issued sheet's blank spacer between blocks
> varies between one and one-and-a-half rows with no discernible rule (`Site preparation`
> → item is 28.5 pt; `Excavation & Filling` → item is 22.9 pt). The builder uses **one
> blank row everywhere**. Everything else on the page — paper, margins, columns, rules,
> fonts, weights, underlines, alignments, number formats and strings — is reproduced
> as measured.

### Weight and underline

| Element | Weight | Underline |
|---|---|---|
| `PROJECT : {project}` | **bold** | no |
| column headers | **bold** | no |
| `SECTION B - ENABLING WORKS` | **bold** | **no** |
| trade / element heading (`Site preparation`) | **bold** | **yes** |
| narrative / preamble paragraph | regular | **yes** |
| the standing preamble (§3) | regular | **no** — the one narrative that is not underlined |
| `Generally` | **regular** | **yes** |
| `COLLECTION` | **regular** | **yes** |
| item description, unit, qty, amount | regular | no |
| `To Collection`, `Page B/n` | regular | no |
| `Total for … Carried to Summary` and its amount | **bold** | no |

Underlines are set on the **font**, not drawn as rules, so they run the width of the text
including its trailing space — which is why the trailing spaces in §3 are frozen.

### Page code

`Page B/1` is **right-aligned in the DESCRIPTION column**. It reads as centred on the
page, but the two issued codes share a right edge (335.1 and 335.2 against a column edge
of 336.6) and not a centre. Right alignment also keeps the RATE and AMOUNT rules printing
through the row, which merging would not.

## 2. FROZEN STRINGS — headers and plumbing

```
PROJECT : {project_name}
Item
No.
Item DESCRIPTION
QTY.
UNIT
RATE
 AMOUNT
AED 
SECTION {letter} - {SECTION TITLE}
SECTION {letter} - {SECTION TITLE} [CONT'D]
Note
To Collection
Page {letter}/{n}
COLLECTION
Total for {Section Title} Carried to Summary
Page {letter}/S
```

`AMOUNT` carries a **leading** space and `AED` a **trailing** space. They are in the issued
cells and they shift the centred string; keep them.

Rules:
- **The printed section title is the PACKAGE name; the POMI classification is
  declared separately.** The issued sample heads section B `ENABLING WORKS`, which
  is not POMI's title for B (POMI calls it Site Work). That is legitimate on a
  commercial heading — but it is declared, not assumed: the spec carries
  `pomi_section_title`, and `verify_sections.py` tests THAT against POMI's own
  headings. Omit the declaration and the printed title is tested instead, so a
  bill cannot claim a POMI section by silence.
- Page 1 of a section carries the bare section title. **Every** continuation page carries
  the same title with the suffix ` [CONT'D]` — a single space, square brackets, apostrophe,
  upper case.
- Item references restart at `A` on every page and run `A, B, C, D, E, F, G, H, J, …` —
  **the letter `I` is skipped.** (The sample runs `H` then `J`.)
- Page codes are `B/1`, `B/2`, `B/3` …, collection page `B/S`.
- The COLLECTION page lists one row per preceding page, in order, each with its amount cell.
- A page carrying **no priced item** — the `Generally` page — shows `To Collection` with a
  **blank** amount, not a nil dash, and its line on the COLLECTION page is blank too. The
  builder tells the two cases apart with `COUNT()`, and totals with `SUM()` rather than
  `+` so a blank line cannot poison the addition.

## 3. FROZEN STRINGS — the standing preamble

Reproduced exactly, on the first page of every section, as **one wrapped cell** spanning
four rows, with `Note` in the Unit column **vertically centred against the whole block**
(the issued `Note` sits at y=139.5, between the second and third lines — not on the third
line, as an earlier reading of this template said).

This is the one narrative block that is **not** underlined.

```
The bidder shall price herein for all details related to this 
section of the Works and has included for complying with all 
the requirements contained therein, whether or not they are 
specifically mentioned within the Item descriptions
```

And the "Generally" page, which is a whole page of its own before the collection. Heading
and body are both **regular weight, underlined**:

```
Generally

The Contractor shall list and price below, the Items and 
quantities of addition or deduction for any Bill of Quantity 
Item(s) and or any omitted Items that in his opinion are 
necessary for the full and satisfactory completion of the work 
as described in the Specifications or shown on the Drawings 
and for which either expressed or implied provision is 
required and which are not covered by the Items or the rates 
in the Bill of Quantities. Any such Items not listed below shall 
be deemed to be included.
```

Line breaks inside both blocks are part of the template. **So are the trailing spaces** —
they set the length of the underline. Keep them.

## 3A. ITEM DESCRIPTIONS — the wrap is frozen too

Item descriptions are supplied by the project, but their **line breaks are computed and
written into the cell**, not left to Excel to recompute when the file is opened. The
builder measures with Carlito (metric-compatible with Calibri) at a usable width of
**224.5 pt** and joins the lines with explicit newlines.

That width was calibrated against every wrapped description on the issued pages: any value
between **223.3 and 227.9 pt** reproduces all ten of them break for break. 224.5 sits mid-
window and stays under Excel's own usable width (228.7 less ~3 pt of cell padding), so a
pre-written line can never re-wrap and silently add a row.

The item letter, quantity, unit and amount are **vertically centred against the whole
description block**, which is how the issued sheet sets them.

## 4. MEASUREMENT SHEET — geometry

**Verified against the issued sheet.** Paper **US Letter landscape, 792 x 612 pt**,
all fourteen columns on ONE page. Font **7.2 pt Calibri** throughout — the same
Calibri as the BOQ pages, confirmed from the embedded fonts (7.2137 pt measured).
Title `MEASUREMENT SHEET` centred, bold. Then two identity lines, left at x=30:

```
Project   : {project_name}
Trade     : {trade_name}
```

**The table is a FULL GRID.** Every cell carries a thin border, INCLUDING blank
cells and the spacer rows between groups. A borderless sheet is not this format.

Column widths, measured off the issued sheet, in points:

| # | Header | Width pt | Notes |
|---|---|---|---|
| 1 | `BOQ` / `Page` | 31.8 | two lines, centred |
| 2 | `Item` / `Ref` | 20.4 | two lines, centred |
| 3 | `Description` | 152.0 | left, wraps |
| 4 | `Ref` | 67.0 | sub-measure label only, e.g. `Depth is 9.20m` |
| 5 | `Unit` | 20.4 | centred |
| 6 | `No of` / `Units` | 23.5 | centred |
| 7 | `Length (m)` | 42.9 | right |
| 8 | `Width` / `(m)` | 24.4 | **built at 28.7** so the header does not break mid-word as "Widt / h". The only deliberate deviation |
| 9 | `Height` / `(m)` | 28.7 | right |
| 10 | `Area (m2)` | 42.9 | right |
| 11 | `Volume (m3)` | 42.8 | right |
| 12 | `Qty` | 39.7 | right |
| 13 | `Total` / `Qty` | 46.1 | right, **BOLD** |
| 14 | `DWG Ref` | 118.8 | centred, hyperlinked — see §6 |

Row heights: base **9.75 pt**; two-line description **19.5**; three-line **29.25**;
header row **24**. On the 0.75 pt grid, for the same reason as §1 — the LibreOffice
recalculation pass rewrites anything that is not. A blank bordered spacer row sits
after each group heading and after each item.

**Group headings** — `SITE WORKS`, `Site preparation`, `Ground Improvement`,
`Excavation & Filling`, `Disposal`, `Shoring` — all sit in the Description column
in **bold AND underlined**, ONE style. There is no separate style for a trade
heading versus an element heading.

### THE TWO QUANTITY COLUMNS — the rule the whole format turns on

```
Qty        = No of Units x (Area | Volume | Length)      MEASURED value, 2 dp
Total Qty  = ROUNDUP( SUM of that item's Qty rows , 0 )  BILLED value, BOLD
```

Verified on every item of the issued sheet:

| Item | Qty | Total Qty |
|---|---|---|
| Site clearance | 1,152.03 | **1,153.00** |
| Excavation | 9,897.79 + 740.14 = 10,637.93 | **10,638.00** |
| Shoring 9.2 m | 101.11 | **102.00** |
| Capping beam | 102.00 + 36.00 = 138.00 | **138.00** |

**The BOQ page links DIRECTLY to `Total Qty`.** It is already rounded. Applying
ROUNDUP again on the bill page double-rounds and is wrong.

**Sub-measure rows.** Where an item is built up from more than one measurement,
the ITEM row carries the description, unit and `Total Qty`; each constituent sits
on its own row below carrying only `Ref` (the label), its dimension columns,
`Qty` and `DWG Ref`. The item row's own dimension columns stay empty.

**Live formulas, not typed numbers.**
`Area = Length x Width` · `Volume = Area x Height` ·
`Qty = No of Units x (Area | Volume | Length)` ·
`Total Qty = ROUNDUP(SUM(constituent Qty rows), 0)`.

**Font must be set on EVERY cell explicitly.** Do not change the workbook
default font to achieve it — Excel measures column width in characters of the
default font, so changing it silently renarrows every column. The default stays
Calibri 11; every cell is written as Calibri 7.2.

## 5. ROUNDING — where each figure lives

Both figures appear on the MEASUREMENT SHEET, in two different columns. This is the
correction to the earlier reading of this template:

> **`Qty`** carries the MEASURED quantity at two decimals.
> **`Total Qty`** carries the BILLED quantity — `ROUNDUP(SUM of the item's Qty rows, 0)`,
> in bold.

The BOQ page then takes `Total Qty` **as it stands**. It is already rounded, and applying
ROUNDUP a second time on the bill page is wrong.

Rounding is UP to the next whole unit for m, m², m³ and nr.

Never round the measurement to make it agree with the bill. The difference between the two
columns IS the rounding, and it is visible on purpose — 1,152.03 against 1,153.00,
10,637.93 against 10,638.00, 101.11 against 102.00.

## 6. DWG REF HYPERLINK (R-MARKUP-LINK)

Column 14 is not text. Every populated `DWG Ref` cell is an Excel hyperlink whose display
text is the drawing number (`S-02-002`) and whose target is the marked-up PDF that proves
that quantity:

```
markups/{NN}. {Trade Item}.pdf
```

numbered in bill order — `1. Site Clearance.pdf`, `2. Ground Improvements.pdf`,
`3. Excavation.pdf`, `4. Shoring.pdf`. Relative path, so the workbook and the `markups/`
folder travel together.

**A measured row with no markup link is a FAIL** (gate G7). Every quantity in the bill must
be traceable to a coloured region on a drawing.

## 7. MARKED-UP SHEET — layout

One PDF per bill item group, built by overlaying the issued drawing. Reproduce exactly:

- **Banner**, centred across the top: `SECTION {letter} - {SECTION TITLE}` in ~20pt.
- **Identity block**, two columns beneath the banner, boxed:
  `Project: {project}` / `Building: {building}` on the left;
  `Drawing: {drawing_no}` / `Filename: {filename}` on the right.
- **Legend panel**, right-hand margin, boxed and separated from the drawing by a vertical
  rule. Title `Legend` right-aligned in ~16pt, then the group name (`Enabling Works`), then
  one row per measured item: a filled colour swatch, the item name, the quantity, the unit.

  ```
  Legend
  Enabling Works
  [swatch] Site Clearance  1,152.03 m2
  [swatch] Excavation - Depth - 9.20m  9,897.79 m3
  [swatch] Shoring - Depth - 9.2m  101.11 m
  ```

  Item name, then quantity to two decimals with separators, then the unit. One swatch
  colour per measured item, consistent between the legend and the drawing.
- **Footer**, centred: `CostX`.
- **The measurement itself**, over the drawing:
  - area/volume items → semi-transparent colour **fill** across the measured region
  - linear items → coloured **boundary line** along the measured run, ~2pt
  - one distinct colour per sub-item, so `Depth 9.2m` and `Depth 9.7m` read apart.

Naming convention in the legend follows the sample: `{Item} - Depth - {d}m` for depth-split
items (`Excavation - Depth - 9.20m`, `Shoring - Depth - 9.2m`).

## 8. WHAT IS NOT FROZEN

Item descriptions come from the project's own specification and drawings. The section
letter and title, the trade name, the project and building names, the drawing numbers, the
quantities and the number of pages all follow the project. **Everything in §1, §2, §3,
§3A, §4 and §7 is frozen.**

## 8A. THE SPEC THE BUILDER EATS

`build_house_takeoff.py <spec.json> <out.xlsx> [--markups markups]`. The model supplies
data; the script supplies format. Never hand-build these sheets.

```jsonc
{
  "project": "XXXX",
  "trade": "Enabling Package",
  "section_letter": "B",
  "section_title": "ENABLING WORKS",

  "measurement": [
    { "kind": "heading", "text": "SITE WORKS" },          // bold + underlined
    { "kind": "element", "text": "Site preparation" },    // identical treatment
    { "kind": "item",
      "boq_page": "B/1", "item_ref": "A", "item_key": "site_clearance",
      "description": "...", "unit": "m2",
      "units": 1, "length": null, "width": null, "height": null,
      "area": 1152.03,                                    // or "volume"
      "dwg_ref": "S-02-002", "markup": "1. Site Clearance.pdf",
      "subs": [                                           // optional build-up
        { "ref": "Depth is 9.20m", "volume": 9897.79,
          "dwg_ref": "S-02-002", "markup": "3. Excavation.pdf" }
      ] }
  ],

  "boq_pages": [
    { "entries": [
      { "kind": "heading",   "text": "Site preparation" },
      { "kind": "narrative", "lines": ["line 1 ", "line 2 "] },
      { "kind": "item", "item_key": "site_clearance", "unit": "m2",
        "description": "..." },
      { "kind": "item", "unit": "Item", "qty": 1, "rate_only": true,
        "description": "Vibro Compaction" },
      { "kind": "generally" }
    ] }
  ]
}
```

Points that are easy to get wrong:

- **`heading` and `narrative` are different kinds.** A heading is bold **and** underlined
  and takes one row; a narrative is regular weight, underlined, and takes one row per
  supplied line. Do not push a heading through as a one-line narrative.
- **`narrative` lines are frozen.** The builder writes them as given, one per row, trailing
  spaces and all. It does not re-wrap them. Break them where the source breaks them.
- **`item.description` is NOT pre-split.** The builder computes the wrap (§3A). Give it
  the whole sentence.
- **`item_key` links the bill line to the measurement sheet.** With it, QTY becomes a live
  reference to `Total Qty`. Without it, supply `qty` — or neither, and the line bills nil.
- **`rate_only` still honours `qty`.** The issued sheet bills `Vibro Compaction` as
  1 Item, Rate Only.
- **Pagination is a spec decision.** One entry in `boq_pages` is one printed page. If the
  content overflows the 56-row body band the builder aborts rather than reflowing — split
  the page in the spec.
- **A page may not END on a heading.** A heading left as the last row with its items
  overleaf is an orphan; the builder aborts. Move the heading to the next page.
- **`pomi_section_title` is REQUIRED**, even where it matches the printed heading. The
  printed heading is the package name a client reads; the POMI classification is a recorded
  fact. A declaration present only when it differs is one nobody can trust, so the builder
  refuses to compile without it.
- The `Generally` page is its own `boq_pages` entry, and the COLLECTION page is generated;
  do not list it.

## 8B. THE WORKED EXAMPLE

`references/issued-sample-spec.json` is the spec that reproduces the client's issued
five-page sample exactly — every heading, narrative, item, rate-only line and page break.
It is the regression fixture for this template. Build it, render it, diff it against the
issued PDF; it must come back **0 mismatches**. Change the builder and re-run it before
changing anything else.

## 9. HOW THIS FILE WAS VERIFIED — and how to verify it again

Reading a format and reproducing it is not the same as matching it. This template was
wrong in nine ways that only surfaced when a replica was **rendered and diffed against the
issued PDF**: the typeface, the page borders, the `Rate Only` column, four weight/underline
rules, the nil-quantity format, and the row heights the recalculation gate was destroying.

The method, and the standard for any future change:

1. Build a spec that reproduces the issued sample exactly — every string, every page.
2. Run the builder, then render the workbook to PDF.
3. Extract every text span from both PDFs and compare **(column, weight, string)**.
   Not a visual check. A span-by-span diff.
4. Extract the vector rules from both and compare the x of every vertical and the y of
   every horizontal.
5. Read the *saved* workbook back after the recalculation gate. Recalculation is a
   round trip through another application and it rewrites things — row heights, cell
   hyperlinks — that were correct when they were written.

The current replica diffs **0 mismatches across all four pages** — 70 / 82 / 22 / 19 text
spans, each in the same column, at the same weight, carrying the same string.
