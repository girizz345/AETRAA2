# POMI — THE COMPLETE MEASUREMENT AND BILLING PROCESS

**One document, 314 clauses, six things against each of them.**

| | |
|---|---|
| **1 · What POMI says** | the clause word for word, from `pomi-verbatim.md`, which is verbatim from the RICS publication |
| **2 · The rule** | what the clause actually obliges the measurer to do, and the trap where there is one |
| **3 · The formula** | the arithmetic. 210 clauses carry one; the other 104 say plainly that they do not, and why |
| **4 · How the take-off reads** | the wording on the DIMENSION SHEET, measured off an issued all-disciplines take-off workbook |
| **5 · What is marked on the drawing** | the markup primitive, the tag, and the closure test that re-derives the quantity from the marked geometry |
| **6 · How the bill reads** | the item wording AND the sheet format, measured off eleven issued tender workbooks |

**The take-off and the bill are two documents with two different jobs, and they do not
share wording.** The take-off **proves the quantity** — it narrates the calculation, cites
the drawing and says where on the plan. The bill **binds the rate** — it describes the work
and says what the money covers. A take-off line copied into a bill describes nothing; a bill
description copied into a take-off proves nothing.

Generated 2026-09-07. Nothing below is retyped. POMI comes from `pomi-verbatim.md`; the
arithmetic from `scripts/formula_register.py`; the take-off wording from
`scripts/takeoff_register.py`; the markup and hyperlink rules from
`scripts/markup_register.py`; the bill wording from `scripts/wording_register.py`. The
generator **refuses to build** if any clause has no formula entry, or any section is
missing a take-off, markup or wording entry, in either direction. Coverage is proved,
not asserted.

**No project data appears anywhere in this document.** Where an issued bill named a
particular design standard, approving party, grade, system or schedule reference, it is
written `{like this}` — a field a run fills, never a constant.

---

# PART 0 — WHAT GOVERNS EVERY SECTION

Read this once. It is the part that decides numbers in all sixteen measured sections.

## 0.1 The three things a quantity NEVER carries

`[GP4.1]` makes every rate *fully inclusive of all that is necessary to fulfil the
liabilities and obligations arising out of the contract*. `[GP9.8]` cl.2 independently makes
**waste in storage** an overhead. Between them:

| Never added to the quantity | Lives in | Clause |
|---|---|---|
| Working space, battering, bulking on excavation | the rate | `[B8.2]` + `[GP4.1]` |
| Rolling margin, welding material, spacers, tying wire | the rate | `[E1.1]` `[C3.1]` + `[GP4.1]` |
| Laps and seams on fabric, roofing, finishes | the rate | `[C3.3]` `[G1.1]` `[J1.1]` |
| Waste of any kind | overheads | `[GP9.8]` cl.2 |

Add any of them to a quantity and **the same money is billed twice** — once in the number
and once in the rate. The DESCRIPTION may list them as included; that is correct and does
not license adding them to the figure.

## 0.2 Rounding — `[GP3.1]`

```
d_measured = round(d_drawn / 0.01) × 0.01          d in metres, 2 decimals

  4.237 × 2.981  →  4.24 × 2.98  = 12.6352 m²      CORRECT
  4.237 × 2.981  = 12.630…       → 12.63 m²        WRONG
```

Round **each dimension as it is taken**, never the product. Dimensions **stated in a
description** are exempt — a "150 mm thick" slab stays 150 mm in the words.

## 0.3 Deductions — the two-part test `[GP3.2]` `[GP3.3]`

```
deduct if   A_void ≥ 1.00 m²        OR        the void TOUCHES AN EDGE
```

| Void | Area | At an edge? | Deduct? |
|---|---|---|---|
| Door in the middle of a wall | 1.89 m² | no | **yes** — ≥ 1.00 |
| Vent in the middle of a wall | 0.36 m² | no | **no** |
| The *same* 0.36 m² vent, at the wall's end | 0.36 m² | **yes** | **yes** |

Volume has its own threshold — **1.00 m³** `[C1.3]`, with boxed or tubular structural
metalwork **always** deducted irrespective of size. The two thresholds are different
numbers for different units and are not interchangeable.

## 0.4 The mandatory statements `[GP5]`

| If the item is measured by | The description MUST state | Clause |
|---|---|---|
| length or depth | cross-sectional size and shape, girth or girth range | `[GP5.2]` |
| length or depth, **and is pipework** | **whether the diameter is internal or external** | `[GP5.2]` |
| area | the thickness | `[GP5.3]` |
| weight | material thickness **and unit weight** | `[GP5.4]` |
| enumerated, or an item | everything — the words carry all of it | `[GP5.1]` |

A description may satisfy these **by reference** to another document or drawing `[GP5.6]`,
provided that document is issued with the bill `[GP2.3]`.

## 0.5 How an item is laid out — the description-and-variants structure

Present in **all 31 sheets** of the issued set. What varies by discipline is what the
variants vary BY — thicknesses in Concrete and Masonry, **sizes** in Mechanical and
Electrical, widths and types in Finishes, and **named schedule references, not sizes**, in
Equipment and Furnishings. Expect the structure; do not expect a size.

```
Walls                                                  ← element heading, one line
                                                       ← blank
Precast concrete block, bedded and jointed in cement   ← DESCRIPTION BLOCK:
mortar including wall ties, bed, joints, reinforcement,   no item ref, no quantity,
head restraint, ties and anchors ... complete in           no rate. Two lines or more.
accordance with the Specifications and Drawings
                                                       ← blank
Hollow Block Walls                                     ← sub-heading, one line (optional)
                                                       ← blank
A   Walls, 100mm thick, type {ref}      34   m2   95    ← VARIANTS, one row each,
                                                             one blank row between,
B   Walls, 150mm thick, type {ref}      24   m2  101       each inheriting the
                                                             description above
C   Walls, 200mm thick, type {ref}      46   m2  106
```

The description is what makes the rate binding. `20mm Piping` at a rate says nothing about
whether the rate covers the fittings, the valves or the supports — **the paragraph above it
does**, and that paragraph is what the contractor is held to. So the group is **atomic** and
never splits across a page: a contractor pricing page 5 cannot read page 4.

## 0.6 Item serial letters

```
A B C D E F G H J K L M N P Q R S T U V W X Y Z
```

**I and O are never used** — `I` next to `1` and `O` next to `0` is exactly the confusion a
priced bill cannot afford, and the error is invisible once printed. Letters **restart at A
on every page** and run straight through a description-and-variants group; the variants take
the next letters in the page's sequence, they do not restart.

## 0.7 The three closing formulas, by discipline family

### Family 1 — B · C · D · E · G — structure and envelope

> `… complete in accordance with the Specifications and Drawings`

… in accordance with the Specifications, Drawings and the {approving party} approval

*143 uses across the issued set — C 66 · G 41 · E 12 · D 10 · B 7 · J 7*

### Family 2 — F · J · K — finishes and fit-out

> `… in accordance with the {design standard document}, Specifications and Drawings`

the order of the three varies in the issued bills; the house form is the one above

*334 uses, 326 of them in Finishes*

### Family 3 — Q · R — MEP

> `Supply and install all {system} as shown on the drawings and/or as specified including but not limited to {the components the rate covers} and any other items required for a complete installation as indicated.`

the middle list is the commercially operative part — write it FROM THE POMI DEEMED-INCLUDED LIST for the clause being billed, not from memory

*63 openers · 39 'as shown on the drawings and/or as specified' · 99 'including but not limited to' · 72 closers*

### GP · A · L · M · N · P — no closing formula observed

(none — these sections bill items, sums and particulars, not measured work)

## 0.8 THE TAKE-OFF SHEET — the frozen layout

One tab per discipline, **landscape, A4**, titled
`{project} - SECTION {letter} : {DISCIPLINE} - TAKE-OFF`. Header band on row 2, **A3 — the title and the header band stay on screen**.
Fonts: Arial — 11pt bold title, 9pt bold header band and spec row, 9pt regular dimension rows, 8pt italic on the 'qty to bill' row. #,##0.00 in the two quantity columns.

| Col | Header | Width | What goes in it |
|---|---|---|---|
| `A` | Ref (drawing) | 16.0 | the drawing the dimension came off, HYPERLINKED to the PDF. This is the row's proof and it is not optional |
| `B` | Level / Floor | 15.0 | the level, with its RL where the level has one — 'Raft -3.85', 'Lower Roof +18.5'. A level without an RL cannot be checked against a section |
| `C` | Item code | 9.0 | {section letter}-{serial} — the key that joins the take-off to the bill. Repeated on the spec row AND on every dimension row under it. The serial runs A B C D E F G H J K L M N P Q R S T U V W X Y Z, then AA AB AC — and NEVER uses I or O |
| `D` | POMI clause | 11.0 | **the rule the quantity was measured under** — 'C2.1 cl.5', 'B9.1 cl.5', 'Q2.2'. Carried on the SPEC ROW, and repeated on a dimension row only where that row is measured under a DIFFERENT clause from the spec row above it. A row with no clause anywhere above it is not a measurement |
| `E` | Element / build-up | 40.0 | the description. Its wording differs between the spec row and the dimension rows — see below |
| `F` | Nr | 6.0 | timesing. A COUNT of identical occurrences, never a factor |
| `G` | L (m) | 8.0 | length |
| `H` | W (m) | 7.0 | width |
| `I` | H/Thk (m) | 9.0 | height, thickness or depth |
| `J` | Qty each | 10.0 | a LIVE FORMULA — =G*I, =G*H*I — never a typed number |
| `K` | Tot. | 11.0 | a LIVE FORMULA — =F*J |
| `L` | Unit | 6.0 | POMI's own units, and only these: item · m · m2 · m3 · nr · kg |
| `M` | Grid / location | 18.0 | where on the plan — 'Grids {x}-{y} / {a}-{b}', 'per {schedule}'. This is what makes a quantity findable on the drawing |
| `N` | — | — | spacer — deliberately empty |
| `O` | Item code | 10.0 | the pivot: one row per bill item |
| `P` | Qty | 12.0 | its total |
| `Q` | Unit | 7.0 | its unit |

### The three-row block — every measured item, every tab

```
   C       D          E                                    F    G      H     I      J        K      L    M
   ────────────────────────────────────────────────────────────────────────────────────────────────────────────────
1  {code}  {clause}   {THE SPECIFICATION — what the thing IS}                                                     ← SPEC ROW
                                                                                                                    bold. Carries the
                                                                                                                    CLAUSE. No dims,
                                                                                                                    no unit
2  {code}             {WHERE it is}: {calculation narrated} {N}  {L}    {W}   {H}   =G*I     =F*J   {u}  {grid}   ← DIMENSION ROW
                                                                                                                    drawing ref in A,
                                                                                                                    hyperlinked.
                                                                                                                    Clause blank =
                                                                                                                    inherits the
                                                                                                                    spec row's
2b {code}  {clause}   {a location measured under ANOTHER    {N}  {L}    {W}   {H}   =G*I     =F*J   {u}  {grid}   ← clause RESTATED
                       clause}                                                                                      only when it
                                                                                                                    differs

3                      qty to bill                                                =SUM(K..)                      ← CARRY row
                                                                                                                    8pt italic,
                                                                                                                    two leading spaces
```

**Row 1 — the SPEC ROW.** Bold. Item code, **POMI clause** and description only: **no
dimensions, no unit, no quantity.** It says what the thing *is* — the thickness, the grade,
the build-up, the rating — and **under which POMI rule it is being measured**. This is where
the mandatory statements `[GP5.2]` `[GP5.3]` `[GP5.4]` are first fixed, before any number is
taken.

### Column `D` — the POMI clause, and why it is on the sheet

Every row is measured under a rule, and the rule is what makes the quantity defensible. A row
reading

```
{dwg}  {level}  C-B              General raft slab: plan area {A} m2 x {t} m thick  {qty}  m3
```

says what was measured and where it came from, but not **why that is the right way to measure
it**. With the clause it does:

```
{dwg}  {level}  C-B  C2.1 cl.5   General raft slab: ...                        {qty}  m3
```

— *C2.1 class 5 measures suspended slabs by volume, stating the thickness, and that is
exactly what this row does.*

- The clause sits on the **spec row**, and every dimension row beneath **inherits** it.
- It is **restated on a dimension row only where that row is measured under a different
  clause** — an extra-over line, a deduction taken under a different limb, a class change.
- **A row with no clause anywhere above it is not a measurement.** It is an assertion, and
  `[GP1.1]` says so in the other direction: an item POMI does not cover is a **house
  extension** and must declare itself, recorded under `[GP1.2]`.

Without this column the answer to *"why is your raft quantity that figure?"* has to be
reconstructed from memory, item by item, months after the take-off was done.

**Row 2 — the DIMENSION ROWS.** One per location. The drawing reference in column `A` is
**hyperlinked to the drawing**, and the description **narrates the calculation in words** —
*"{element}: plan area {A} m² × {t} m thick"* — so the arithmetic can be read without
recomputing it. `Qty each` and `Tot.` are **live formulas**, never typed numbers.

**Row 3 — the CARRY ROW.** Two leading spaces, 8pt italic, the words `qty to bill`, and
`=SUM()` of the dimension rows above it. This is the figure that goes to the bill, and it
is the only figure that does.

### The unit vocabulary is POMI's, and closed

```
item · m · m2 · m3 · nr · kg
```

**POMI's own units and no others.** A linear metre is `m`, not `lm`. There is no `set`: a
set of things is `nr` if it is counted and `item` if it is a lump. Where another unit is
genuinely needed, `[GP3.4]` permits it **only if the amendment is stated** and recorded in
POMI's Appendix under `[GP1.2]`.

### The item-code serial

The item-code serial runs:

```
A B C D E F G H J K L M N P Q R S T U V W X Y Z   then   AA AB AC AD ...
```

**I and O are never used**, in the take-off exactly as in the bill. `I` next to `1` and `O`
next to `0` is the confusion a priced document cannot afford, and the error is invisible once
printed — every OTHER code on the sheet still looks right, so nothing draws the eye to it.

The serial runs **through the whole section tab**; it does not restart per page, because the
take-off has no page rhythm. (The BILL's letters do restart at `A` on every page — the two
documents differ here, deliberately.)

⚠ The issued sample deviates from this rule: eight of its seventeen tabs use `O`, and the
General Requirements tab uses `I`. **Those are defects in those tabs, not the rule.** A run
built to this document re-letters them.

### The discipline tabs — the office scheme, and what each measures to

The tabs are lettered **as the office letters them**, not as POMI letters its sections. POMI
remains what the work is **measured to**, so every tab declares which POMI section its clauses
come from. That declaration IS the `[GP1.2]` amendment — without it, a tab lettered `S` would
be measuring against a section POMI does not have.

| Tab | Title | Measured to POMI section | |
|---|---|---|---|
| `A` | GENERAL REQUIREMENTS | `A` |  |
| `B` | SITE WORKS | `B` |  |
| `C` | CONCRETE | `C` |  |
| `D` | MASONRY | `D` |  |
| `E` | METAL WORKS | `E` |  |
| `F` | WOOD WORKS | `F` |  |
| `G` | THERMAL & MOISTURE | `G` |  |
| `H` | DOORS & WINDOWS | `H` |  |
| `J` | FINISHES | `J` |  |
| `J1` | ID FINISHES | `J` | **house amendment** — a HOUSE SUB-TAB. Interior-design finishes split out of J so the ID package can be priced and let separately. Measured to Section J throughout |
| `K` | ACCESSORIES | `K` |  |
| `N` | FURNISHINGS | `M + L` | **house amendment** — the office letters furnishings N; POMI letters them M, and N is Special Construction. THE TAB ALSO CARRIES POMI SECTION L, EQUIPMENT — there is no L tab, and equipment arrives as a supplied schedule which is billed straight in here. Every row still declares its own POMI clause, so an L1.2 equipment item and an M1.2 furnishing item are distinguishable on the sheet even though they share a tab |
| `P` | CONVEYING | `P` |  |
| `Q` | MECHANICAL | `Q` |  |
| `R` | ELECTRICAL | `R` |  |
| `S` | COMMS & ELV | `R` | **house amendment** — POMI has NO section S. Communications and extra-low-voltage are inside Section R, and the office splits them onto their own tab. Followed as marked; measured to R |

Three tabs are house amendments and are declared as such: **`J1`**, **`N`** and **`S`**. The
other fourteen coincide with POMI's own letters.

### The pivot

Columns `O` `P` `Q`, separated by an empty spacer column `N`: one row per item code, its
total and its unit. It is what the bill compiler reads. **Quantities are per their own
unit and are never summed across units.**


## 0.9 THE MARKUP — what proves the quantity on the drawing

A quantity that cannot be pointed at on a drawing is an assertion. Every measured element is
**coloured up in its trade colour**, so an **unmarked element is visibly un-measured** — the
drawing shows what has NOT been taken off as clearly as what has.

### Three primitives cover all seventeen sections

| Primitive | Units | The mark | Closure re-derives it as | Tolerance |
|---|---|---|---|---|
| **AREA** | m² · m³ | a translucent SHADED POLYGON in the trade colour, with the area label | `shoelace area / scale²  — and × the stated thickness where the unit is m³` | **K42  ±1%** |
| **LINEAR** | m | a TRACED POLYLINE along the run, with the length label | `sum of the segment lengths / scale` | **K43  ±1%** |
| **TAG** | nr · item | a TAG at each instance — or a tag on the schedule row carrying the total, proved by a count reconciliation | `count of marked points` | **K18  EXACT equality** |

### The rules

- **The primitive follows the MEASURED UNIT, not the discipline.** A blockwork wall measured in m² is an area shade; the same wall measured in m is a polyline. Three primitives cover all seventeen sections.
- **Every measured element is coloured up, so an UNMARKED element is visibly un-measured.** That is the whole point of colouring up: the drawing shows what has not been taken off as clearly as what has.
- **The tag carries the ITEM CODE and the QUANTITY** — `C-B  720.00 m3` — and the item code matches the take-off row exactly, so the workbook and the drawing cross-reference BOTH ways.
- **Every marked sheet carries a LEGEND** listing every item taken off that sheet: colour dot, item code, quantity, short description. A line that could not be placed on the drawing still appears in the legend, so nothing is lost — it is simply not spotted. **Never invent a coordinate**; leave it to the legend and say so.
- **Volume is an area shade × a stated thickness.** There is no volume primitive. Preliminaries and PC sums are LISTED, not spotted — they have no geometry.
- **Where the measurer declared TYPE / ZONE × TIMESING, closure is on ONE INSTANCE** multiplied by the stated timesing. The gate is testing the type, not the building.

### The closure gate — why the markup can DISAGREE

`build_house_takeoff.py` **ABORTS** on any `DWG Ref` cell without a markup hyperlink, and on any hyperlink whose target does not exist. A broken link is not a cosmetic defect — it is a quantity that has stopped being traceable.

`markup_closure.py` **EXITS NON-ZERO** on any item where the geometry does not reproduce the quantity. The batch does not close and the comment goes back to the measurer.

### The hyperlinks — four links, and they close a loop

| From → to | Where | How |
|---|---|---|
| The take-off sheet → the drawing | column `A`, `Ref (drawing)` | the drawing reference is hyperlinked to the source PDF. This is the row's proof of WHERE the dimension came from, and it is not optional |
| The measurement sheet → the marked-up drawing | the `DWG Ref` column | written as a `=HYPERLINK("{target}","{dwg}")` FORMULA, never as a cell-hyperlink object. A cell hyperlink is rewritten to a temp-dir-relative path by the LibreOffice recalculation pass and stops resolving; a formula survives the round trip intact. Blue, underlined, centred |
| The marked-up drawing → the take-off row | the call-out tag | the tag carries the item code, so a reviewer reading the drawing can find the row. The link is two-way by construction, not by discipline |
| The take-off → the bill | the pivot, columns `O` `P` `Q` | item code, total, unit. The bill compiler reads this and nothing else |

Read together: the take-off row points at the drawing, the measurement sheet points at the
**marked-up** drawing, the tag on that drawing points back at the row, and the pivot points
at the bill. A reviewer can enter the loop at any point and walk it in either direction.

## 0.10 THE BILL SHEET — the frozen format

Measured off eleven issued tender workbooks, 61 non-cover sheets, several hundred bill pages.
`verify_template.py` fails any deviation.

| | |
|---|---|
| Paper | **A4 portrait** (`paperSize = 9`) |
| Margins | left 0.25in - right 0.25in - top 0.5in - bottom 0.5in - header 0.25in - footer 0.25in |
| Header / footer text | **none** — the page head is drawn in CELLS, not in Excel's header |
| Row height | **12.75** throughout |
| Font | **Arial in three sizes** — project band 10 pt bold; the labels beside it and the whole column-head band **8 pt regular**; section title in `D` 9 pt bold; body 10 pt regular, headings and totals bold |

### The eight columns

| Col | Width | Carries |
|---|---|---|
| `A` | **4.711** | item reference — one letter |
| `B` | **1.711** | spacer — no value, **no vertical rule** |
| `C` | **31.711** | item description |
| `D` | **15.711** | description overflow; the head band's BILL OF QUANTITIES and section title; To Collection |
| `E` | **8.711** | quantity |
| `F` | **5.711** | unit |
| `G` | **12.711** | unit rate |
| `H` | **14.711** | total price |

`A` to `G` are **unanimous across the bill pages**. Re-measured across all eight issued
workbooks — 128 sheets, of which **59 carry the head band and are bill pages** — `A` is 4.711
on 50 of 59. `H` is the money column and the set does not agree with itself: **14.711 on 23
pages**, 15.711 on 8, 16.141 on 5, 18.57 on 3, 17.426 on 3. **The house value is 14.711**, the
plurality; the gate accepts 14.5 to 18.0 on `H` alone and fails any deviation on `A` to `G`.

**Cover sheets have their own geometry** — the 69 non-bill sheets carry `A` = **9.711** on 68
of 69. A cover is not a bill page and is not held to the bill-page widths.

**`B`, `C` and `D` are one visual cell.** No vertical rule falls between them, so the reader
sees six columns where the workbook has eight.

### The page — 62 rows, and the body is 46

A page starts at row `P`, where `P = 1, 63, 125, 187 ...`

| Offset | Content |
|---|---|
| `P+0` | project band 1 — `A` client, `D` **BILL OF QUANTITIES**, `G` **BILL NO.**, `H` **PAGE NO.** |
| `P+1` | project band 2 — `A` project |
| `P+2` | project band 3 — `A` package, `D` SECTION TITLE, `G` bill/section code, `H` bill/section/page code |
| `P+3` | project band 4 — `A` building or sub-package |
| `P+4` | spacer — `C` and `F` each hold a single space |
| `P+5` | column head 1 — `A` **ITEM**, `C` **ITEM DESCRIPTION**, `E` **QUANTITY**, `F` **UNIT**, `G` **UNIT**, `H` **TOTAL PRICE** |
| `P+6` | column head 2 — `A` **REF.**, `G` **RATE**, `H` **AED** |
| `P+7` | blank |
| `P+8` | section heading — `SECTION {L} - {TITLE}`, or with `(CONT'D)` on every later page |
| `P+9 ... P+54` | **the body — 46 rows** |
| `P+55 ... P+59` | blank tail — five rows, always blank |
| `P+60` | `D` **To Collection**, `H` `=SUM()` over the body rows |
| `P+61` | blank — closes the page |

The body is 46 rows and it is **not a target**: an item that does not fit **starts the next
page**, because a description-and-variants group is atomic and never splits.

`BILL NO.` is `{bill}/{section}`. `PAGE NO.` is `{bill}/{section}/{page}`, and the page
number **restarts at 1 for each section**, not for each bill.

⚠ **A bill with no sections uses the TWO-PART form** `{bill}/{page}` — measured across the
issued set, **286 three-part codes and 17 two-part**, every two-part one in the **Dayworks**
bill, which has no POMI section of its own because it is `[GP9]`. A builder that assumes
three parts cannot produce a dayworks bill.

### Borders — VERTICAL RULES ONLY

The page is **not a ruled grid**. Horizontal rules appear only at the band boundaries.
Reading down the page the rules stand at: **left of A, right of A, left of E, right of E,
right of F, right of G, right of H**. Reproducing this as a fully ruled table is wrong.

### Frozen strings — reproduce character for character

```
BILL OF QUANTITIES        ITEM              QUANTITY        To Collection
BILL NO.                  REF.              UNIT
PAGE NO.                  ITEM DESCRIPTION  RATE
                                            TOTAL PRICE
                                            AED
```

A **section** heading repeated on a later page takes ` (CONT'D) ` — upper case. An
**element** heading repeated takes ` (Cont'd) ` — title case. **The two are different in the
issued bills and both are frozen.**

Counted across the eight workbooks: `(CONT'D)` **155**, `(Cont'd)` **87** — and a
trailing-period variant, `(CONT'D.)` 13 and `(Cont'd.)` 10. **The period variants are a
minority and are not reproduced**; they are recorded so a comparison against those sheets
does not read the correct string as a deviation.

Each section closes on its own page with `LIST ANY ADDITIONAL ITEMS` and its five-line
paragraph, immediately after the column-head band.

### The project band — what the four rows carry

Rows `P+0` to `P+3`, repeated on **every page**. All four are **fields a run fills**, never
constants:

| Row | Col `A` | Col `D` | Col `G` | Col `H` |
|---|---|---|---|---|
| `P+0` | `{client}` | **BILL OF QUANTITIES** | **BILL NO.** | **PAGE NO.** |
| `P+1` | `{project}` | | | |
| `P+2` | `{package}` | `{SECTION TITLE}` | `{bill}/{section}` | `{bill}/{section}/{page}` |
| `P+3` | `{building or sub-package}` | | | |

The band is **drawn in cells, not in Excel's page header**, and `print_title_rows` is
deliberately **not set** — the band is repeated as real rows, so a page break in the wrong
place shows up as a **visibly wrong page** rather than a silently right one.

### Per-column body style

| Col | Align | Number format — house value |
|---|---|---|
| `A` | centre | General |
| `C` | left | General |
| `E` | right | `#,##0_);[Red](#,##0)` |
| `F` | centre | General |
| `G` | — | `#,##0.00_);[Red](#,##0.00)` |
| `H` | right | `_(* #,##0.00_);_(* (#,##0.00);_(* "-"??_);_(@_)` — **Accounting** |

**Two number formats are in issue and neither is a defect.** Counted over every priced row in
all eleven workbooks:

| Column | bracketed-red | Accounting | house value |
|---|---|---|---|
| QUANTITY | 1,129 | 768 | bracketed-red |
| RATE | 1,290 | 339 | bracketed-red |
| AMOUNT | 675 | **1,192** | **Accounting** |

The builder writes the majority for each column; the gate accepts either, because asserting
one would fail the client's own bills. **Do not substitute one for the other because they look
similar in a populated cell** — they differ exactly where a bill is read hardest, at **zero**
and at a **negative**.

### Non-numeric entries in the money columns — frozen strings

The issued bills write words where a figure would mislead:

| Entry | In | Means |
|---|---|---|
| `item` | `F` | the unit for a lump-sum item |
| `Included` | `H` | priced within another item |
| `N.A` | `H` | not applicable to this project |
| `By OSE` | `H` | by others / owner-supplied |

⚠ A checker reading a section total must **not** treat these as zero-value omissions. A bill
row carrying `INCLUDED` is priced — it is priced somewhere else.

### The page break

- **No explicit row breaks.** Pagination is the fixed 62-row rhythm and nothing else.
- **A description-and-variants group is ATOMIC.** If it does not fit in what remains of the
  46-row body, the whole group **starts the next page**. A contractor pricing page 5 cannot
  read the description on page 4.
- The body is 46 rows and it is **not a target to fill**.

## 0.11 THE WORKBOOK — sheets, collection, summaries

### Section letters and titles

The issued bills letter their sections **exactly as POMI does**. `K` is **Accessories**,
`M` is **Furnishings**, and **there is no section S**.

| | | | | | |
|---|---|---|---|---|---|
| `A` GENERAL REQUIREMENTS | `B` SITE WORKS | `C` CONCRETE WORK | `D` MASONRY WORK | `E` METALWORK | `F` WOODWORK |
| `G` THERMAL & MOISTURE PROTECTION | `H` DOORS AND WINDOWS | `J` FINISHES | `K` ACCESSORIES | `L` EQUIPMENT | `M` FURNISHINGS |
| `P` CONVEYING SYSTEMS | `Q` MECHANICAL ENGINEERING INSTALLATIONS | `R` ELECTRICAL ENGINEERING INSTALLATIONS | | | |

The issued **titles** differ from POMI's own wording in three places — POMI heads `B` *Site
Work* singular, `D` *Masonry*, and `G` *Thermal and Moisture Protection* spelled out. Those
are **commercial headings and legitimate**, but they are **declared** through a
`pomi_section_title` field, never assumed. The gate tests the **letter and POMI's title**; the
printed title is the project's.

### The COLLECTION page — last page of every section

The column-head band is **abbreviated**: only `C` = `ITEM DESCRIPTION` and `H` = `TOTAL PRICE`
/ `AED`. **No** `ITEM`, `QUANTITY`, `UNIT` or `RATE`.

```
SECTION {L} - {TITLE}

COLLECTION

Page {bill}/{section}/1        =H{To Collection row of page 1}
Page {bill}/{section}/2        =H{To Collection row of page 2}
...

TOTAL FOR BILL NO. {bill}/{section}/{last page} - SECTION {L} - {TITLE}, 
CARRIED TO SUMMARY  - {summary ref}
```

⚠ The `TOTAL FOR ...` line **ends with a comma and a trailing space** and continues on the
next row. `CARRIED TO SUMMARY` is followed by **TWO** spaces before the dash. Both are frozen
and both are the kind of thing a re-typing loses.

### The BILL SUMMARY sheet

`D` = `SUMMARY`. One row per section: `C` the last page code, `D` the section title, `H` a
**link** to that section sheet's `TOTAL FOR ...` cell. Closes with:

```
TOTAL CARRIED TO FORM OF TENDER
```

### The GRAND SUMMARY sheet

`D` = `GRAND SUMMARY`, `H` page code `GS`. One row per bill: `C` = `BILL NO. {n}`, `D` the
bill title, `H` a **link** to that bill's summary total. Closes with `TOTAL CARRIED TO FORM OF
TENDER` and, lower down:

```
AMOUNT IN WORDS
```

### Workbook architecture

**One workbook per bill.** Inside it a **Cover sheet precedes every section sheet**:

```
Cover 1 · Summary · Cover 2 · {first section} · Cover 3 · {second section} · ...
```

Cover sheets are `A1:J38`, use merged rows `A{n}:I{n}`, and carry **the project identity
only**. The **Grand Summary is its own workbook** and links to each bill workbook by external
reference.

### The money chain, end to end

```
item rows            H = E x G                    quantity x rate
  -> page            To Collection = SUM(body)    P+60 of each page
    -> collection    one line per page            last page of the section
      -> bill summary   one line per section      links to TOTAL FOR ...
        -> grand summary  one line per bill       links to the bill summary total
          -> FORM OF TENDER  +  AMOUNT IN WORDS
```

Every link in that chain is a **live reference**, not a typed figure. A summary that carries a
number instead of a link is a bill that can silently disagree with itself.

## 0.12 What every measurement row must record

```
1  the POMI clause          an item with no clause is a HOUSE EXTENSION and must
                            declare itself under [GP1.1], recorded under [GP1.2]
2  the classification       WHICH numbered class within the clause
3  N × L × W × H            each factor in its own column, never pre-multiplied
4  the deduction basis      which voids were deducted, under which limb of GP3.2/GP3.3
5  the source               doc id, sheet, and the read tier from the extraction record
6  the DWG Ref hyperlink    to the marked-up sheet that proves it
7  the mandatory statements the clause demands — thickness, number, girth, drop,
                            diameter basis, unit weight, average depth
```

A row missing 1, 4 or 6 is not a measurement. It is an assertion.

---

# SECTION GP — GENERAL PRINCIPLES

*10 groups · 34 clauses · 12 carrying arithmetic*

## How this section is TAKEN OFF

**The spec row says what the thing is**

```
(GP produces no take-off sheet — it is the rule set the sheets are measured under)
```

⚠ A GP clause never appears as a take-off item. It appears as the CLAUSE CITED by items in the other sixteen sections.

## How this section is MARKED UP

| | |
|---|---|
| **Trade colour** | — |
| **Primitive** | none |
| **Call-out tag** | — |

**What carries a mark.** GP marks nothing. It is the rule set the marks are made under..

⚠ A GP clause is CITED on a row; it is never marked on a drawing.

## How this section is BILLED

| | |
|---|---|
| **Closing formula** | none — this section bills items, sums or particulars, not measured work |
| **Variants vary by** | nothing — GP creates no measured item |
| **Element heading** | (GP produces no bill page of its own) |

**The description block**

```
GP is the rule set the OTHER sections are billed under. Its only lines in a bill are
the nominated sums and their profit items (GP6.1, GP7.1, GP8.1), the daywork sums and
their addition items (GP9), and contingencies (GP10.1) — all of which appear in the
PRELIMINARIES or a PROVISIONAL SUMS bill, not in a measured bill.
```

**The priced variants under it**

```
A   Prime cost sum for {nominated specialist work}          Sum   …
B   Add for contractor's profit                             Item  …
C   Add for attendance, as clause GP6.2                     Item  …
```

**What POMI forces into the wording in this section**

- GP6.1/7.1/8.1 — the sum is EXCLUSIVE of profit and a SEPARATE profit item follows.
- GP10.1 — contingencies carry NO profit item. It is the one sum that does not.

⚠ Never one line. A nominated sum is always a PAIR — sum, then profit — and where attendance applies (GP6.2, GP8.2) a THIRD line. A single combined line cannot be adjusted when the sum is expended, which is the whole point of keeping profit separate.

## GP1  Principles of measurement

### GP1.1

**What POMI says.**

> These principles of measurement provide a uniform basis for measuring bills of quantities for works of construction. More detailed information than is required by this document may be given to define the precise nature of work or the circumstances under which it is to be carried out.

**Unit.** `—` — no arithmetic — a descriptive, definitional or administrative rule

**The formula.** None — this clause carries no arithmetic.

**The rule.** Scope. More detail than POMI requires MAY be given — this is the clause every HOUSE build-up is made under.

### GP1.2

**What POMI says.**

> Amendments to these principles of measurement for use in a particular locality or adopted for work not envisaged by this document shall be stated; an appendix is provided for such amendments to be recorded.

**Unit.** `—` — no arithmetic — a descriptive, definitional or administrative rule

**The formula.** None — this clause carries no arithmetic.

**The rule.** Local amendments SHALL BE STATED and recorded in POMI's own Appendix. A house rule not recorded there is undeclared.

### GP1.3

**What POMI says.**

> These principles of measurement may be applied equally to the measurement of proposed works and of completed works.

**Unit.** `—` — no arithmetic — a descriptive, definitional or administrative rule

**The formula.** None — this clause carries no arithmetic.

**The rule.** Applies equally to proposed and completed works — so the same formulae serve a take-off and a final account.

## GP2  Bills of quantities

### GP2.1

**What POMI says.**

> The objects of bills of quantities are: 1. To assist in the accurate preparation of tenders, by providing for measurement of quantities on a uniform basis 2. To provide a basis for the financial control of a project, in accordance with the conditions of contract.

**Unit.** `—` — no arithmetic — a descriptive, definitional or administrative rule

**The formula.** None — this clause carries no arithmetic.

**The rule.** The TWO stated objects of a bill of quantities: 1 TO ASSIST IN THE ACCURATE PREPARATION OF TENDERS, by providing for measurement of quantities ON A UNIFORM BASIS · 2 TO PROVIDE A BASIS FOR THE FINANCIAL CONTROL OF A PROJECT, in accordance with the conditions of contract. No arithmetic — but object 2 is why a quantity must stay traceable after award, not only until tender.

### GP2.2

**What POMI says.**

> Bills of quantities shall describe and represent the works to be carried out; work which cannot be measured accurately shall be described as approximate or given in bills of approximate quantities.

**Unit.** `RULE` — governs how OTHER quantities are calculated

**The formula.** None — this clause carries no arithmetic.

**The rule.** THE PROVISIONAL RULE, and it is a DUTY, not a fallback. Bills shall DESCRIBE AND REPRESENT the works; WORK WHICH CANNOT BE MEASURED ACCURATELY SHALL BE DESCRIBED AS APPROXIMATE, or given in bills of approximate quantities. HOUSE RULE: WHERE THE INFORMATION IS NOT CLEAR, THE ITEM IS MARKED PROVISIONAL — never estimated into a precise-looking figure, and never silently omitted. A provisional item carries FOUR things: (1) the quantity as best it can be derived, (2) the word PROVISIONAL in the description, (3) WHY it is provisional — what is missing, which document would settle it, and (4) the technical query raised to close it. Both failure modes are worse than the mark: an invented precise quantity transfers a risk nobody has priced, and an omitted item is found by the contractor after award. GP2.2 is what makes 'I do not know' a compliant answer.

### GP2.3

**What POMI says.**

> Conditions of contract, drawings and specifications shall be provided with the bills of quantities.

**Unit.** `—` — no arithmetic — a descriptive, definitional or administrative rule

**The formula.** None — this clause carries no arithmetic.

**The rule.** Conditions, drawings and specification issued with the bill.

### GP2.4

**What POMI says.**

> The section headings and classifications do not impose restrictions upon the format and presentation of bills of quantities.

**Unit.** `—` — no arithmetic — a descriptive, definitional or administrative rule

**The formula.** None — this clause carries no arithmetic.

**The rule.** Section headings do not restrict format — which is why a commercial heading may differ from POMI's, if declared.

## GP3  Measurement

### GP3.1

**What POMI says.**

> Work shall be measured net as fixed in position and each measurement shall be taken to the nearest 10 millimetres; this principle shall not apply to dimensions stated in descriptions.

**Unit.** `RULE` — governs how OTHER quantities are calculated

**The formula.**

```
d = round(d_drawn / 0.01) × 0.01
```

**The rule.** NET as fixed in position, each dimension to the nearest 10 mm. Round each dimension as taken, not the product. Dimensions in DESCRIPTIONS are exempt.

### GP3.2

**What POMI says.**

> Unless otherwise stated, no deduction shall be made from items required to be measured by area for voids of less than 1.00 m².

**Unit.** `RULE` — governs how OTHER quantities are calculated

**The formula.**

```
A_net = A_gross − Σ A_void  for A_void ≥ 1.00 m²
```

**The rule.** The area deduction threshold. Applies to items measured BY AREA.

### GP3.3

**What POMI says.**

> Minimum deductions of voids shall refer only to voids within the edges of measured areas; voids which are at the edges of measured areas shall always be deducted, irrespective of size.

**Unit.** `RULE` — governs how OTHER quantities are calculated

**The formula.**

```
deduct ALL voids at an edge, any size
```

**The rule.** The exception to GP3.2, and the one most often missed. Interior voids under 1.00 m² stay; edge voids always go.

### GP3.4

**What POMI says.**

> These principles of measurement may be used with other units of measurement but the particular amendments shall be stated.

**Unit.** `—` — no arithmetic — a descriptive, definitional or administrative rule

**The formula.** None — this clause carries no arithmetic.

**The rule.** Other units may be used if the amendment is stated.

### GP3.5

**What POMI says.**

> Notwithstanding these principles of measurement, a separate minor building or structure may be enumerated.

**Unit.** `NR` — enumerated — a count

**The formula.**

```
N = 1 per minor building
```

**The rule.** A separate minor building or structure MAY be enumerated whole instead of measured.

## GP4  Items to be fully inclusive

### GP4.1

**What POMI says.**

> Unless otherwise stated, all items shall be fully inclusive of all that is necessary to fulfill the liabilities and obligations arising out of the contract and shall include: 1. Labour and all associated costs 2. Materials, goods and all associated costs 3. Provision of plant 4. Temporary works 5. Establishment charges, overheads and profit.

**Unit.** `—` — no arithmetic — a descriptive, definitional or administrative rule

**The formula.** None — this clause carries no arithmetic.

**The rule.** What EVERY rate is deemed to include, FIVE heads: 1 LABOUR AND ALL ASSOCIATED COSTS · 2 MATERIALS, GOODS AND ALL ASSOCIATED COSTS · 3 PROVISION OF PLANT · 4 TEMPORARY WORKS · 5 ESTABLISHMENT CHARGES, OVERHEADS AND PROFIT. This is THE clause that makes waste, laps, rolling margin, working space and bulking rate matters — add any of them to a quantity and the same money is billed twice.

## GP5  Description of items

### GP5.1

**What POMI says.**

> Items which are required to be enumerated, or for which an item is required, shall be fully described.

**Unit.** `—` — no arithmetic — a descriptive, definitional or administrative rule

**The formula.** None — this clause carries no arithmetic.

**The rule.** Enumerated items and items must be FULLY DESCRIBED.

### GP5.2

**What POMI says.**

> Items which are to be measured by length or depth shall state the cross-sectional size and shape, girth or ranges of girths or such other information as may be appropriate; for items of pipework it shall be stated whether the diameter is internal or external.

**Unit.** `RULE` — governs how OTHER quantities are calculated

**The formula.** None — this clause carries no arithmetic.

**The rule.** Length and depth items STATE the cross-sectional size and shape, girth or range of girths. FOR PIPEWORK IT SHALL BE STATED WHETHER THE DIAMETER IS INTERNAL OR EXTERNAL. HOUSE ELECTION: INTERNAL DIAMETER IS STATED, converting from a nominal or external figure where the schedule gives that instead. THIS IS THE HIGHEST-LEVERAGE STATEMENT IN AN MEP BILL: POMI expresses the Q2.2 60 mm threshold as an INTERNAL diameter, so a pipe quoted at 65 mm EXTERNAL may be under 60 mm internal — and a whole class of enumerated fittings appears or disappears on the basis alone. The same threshold governs J6.3 cl.11 versus J6.4 for decoration.

### GP5.3

**What POMI says.**

> Items which are to be measured by area shall state the thickness or such other information as may be appropriate.

**Unit.** `RULE` — governs how OTHER quantities are calculated

**The formula.** None — this clause carries no arithmetic.

**The rule.** Area items STATE the thickness.

### GP5.4

**What POMI says.**

> Items which are to be measured by weight shall state the material thickness and unit weight if appropriate (for example, ductwork).

**Unit.** `RULE` — governs how OTHER quantities are calculated

**The formula.**

```
W = A × m_per_m2  or  L × m_per_m  or  V × ρ
```

**The rule.** Weight items STATE the material thickness and unit weight IF APPROPRIATE — POMI's own example is DUCTWORK. THE QUALIFIER IS POMI'S: the statement is required where it bears on the work, not mechanically on every weight item. It plainly IS appropriate for sheet material sold by gauge — ductwork, sheet metal, flashings — where the thickness is the whole difference in cost, and for rolled sections where the unit mass identifies the section. Take the density and unit mass FROM THE SPECIFICATION OR MANUFACTURER'S DATA, never from memory, and record the source on the row.

### GP5.5

**What POMI says.**

> Notwithstanding these principles of measurement, proprietary items may be measured in a manner appropriate to the manufacturer's tariff or customary practice.

**Unit.** `—` — no arithmetic — a descriptive, definitional or administrative rule

**The formula.** None — this clause carries no arithmetic.

**The rule.** Proprietary items may follow the manufacturer's tariff — a declared departure from the formulae here.

### GP5.6

**What POMI says.**

> The description of items in bills of quantities may refer to other documents or drawings and any reference to such information shall be understood to fulfill any requirement of these principles of measurement; alternatively, reference may be made to published information.

**Unit.** `—` — no arithmetic — a descriptive, definitional or administrative rule

**The formula.** None — this clause carries no arithmetic.

**The rule.** A description may refer to another document, and that reference satisfies POMI's requirement.

## GP6  Work to be executed by a specialist nominated by the employer

### GP6.1

**What POMI says.**

> Unless otherwise required by the conditions of contract, work which is required to be executed by a specialist nominated by the employer shall be given as a sum; such sum shall be exclusive of contractor's profit and in each case an item shall be given for the addition of profit.

**Unit.** `SUM` — a SUM — a money figure, not a measured quantity

**The formula.**

```
Sum, exclusive of profit + separate profit item
```

**The rule.** Nominated specialist work.

### GP6.2

**What POMI says.**

> An item shall be given in each case for assistance by the contractor, which shall include: 1. Use of contractor's administrative arrangements 2. Use of constructional plant 3. Use of contractor's facilities 4. Use of temporary works 5. Space for specialist's offices and stores 6. Clearing away rubbish 7. Scaffolding required by the specialist, giving particulars 8. Unloading, distributing, hoisting and placing in position items of plant, machinery or the like, giving particulars.

**Unit.** `ITEM` — an ITEM — a priced line with no quantity

**The formula.** None — this clause carries no arithmetic.

**The rule.** ONE ITEM for ATTENDANCE by the contractor on a nominated specialist, EIGHT heads: 1 USE OF THE CONTRACTOR'S ADMINISTRATIVE ARRANGEMENTS · 2 USE OF CONSTRUCTIONAL PLANT · 3 USE OF THE CONTRACTOR'S FACILITIES · 4 USE OF TEMPORARY WORKS · 5 SPACE FOR THE SPECIALIST'S OFFICES AND STORES · 6 CLEARING AWAY RUBBISH · 7 SCAFFOLDING required by the specialist, GIVING PARTICULARS · 8 UNLOADING, DISTRIBUTING, HOISTING AND PLACING IN POSITION items of plant or machinery, GIVING PARTICULARS. Heads 7 and 8 REQUIRE PARTICULARS — an attendance item that does not describe the scaffolding and the hoisting is not priceable.

## GP7  Goods, materials or services to be provided by a merchant or tradesman nominated by the employer

### GP7.1

**What POMI says.**

> Unless otherwise required by the conditions of contract, goods, materials or services which are required to be provided by a merchant or tradesman nominated by the employer shall be given as a sum; such sum shall be exclusive of contractor's profit and in each case an item shall be given for the addition of profit.

**Unit.** `SUM` — a SUM — a money figure, not a measured quantity

**The formula.**

```
Sum, exclusive of profit + separate profit item
```

**The rule.** Nominated merchant goods, materials or services.

### GP7.2

**What POMI says.**

> Fixing goods and materials shall be given in accordance with the relevant clauses in these principles of measurement; fixing shall be understood to include unloading, storing, distributing and hoisting the, goods and materials. Particulars shall be given of any requirements for the contractor to arrange for delivery or pay any costs of conveying goods or materials.

**Unit.** `—` — no arithmetic — a descriptive, definitional or administrative rule

**The formula.** None — this clause carries no arithmetic.

**The rule.** FIXING measured to the relevant clauses; fixing INCLUDES unloading, storing, distributing and hoisting.

## GP8  Work to be executed by a government or public authority

### GP8.1

**What POMI says.**

> Unless otherwise required by the conditions of contract, work which may only be carried out or by a government or public authority shall be given as a sum; such sum shall be exclusive of contractor's profit and in each case an item shall be given for the addition of profit.

**Unit.** `SUM` — a SUM — a money figure, not a measured quantity

**The formula.**

```
Sum, exclusive of profit + separate profit item
```

**The rule.** Work only a government or public authority may do — DEWA, Etisalat, du.

### GP8.2

**What POMI says.**

> An item shall be given in each case for assistance by the contractor as described in clause GP6.2.

**Unit.** `ITEM` — an ITEM — a priced line with no quantity

**The formula.** None — this clause carries no arithmetic.

**The rule.** Attendance, as GP6.2.

## GP9  Dayworks

### GP9.1

**What POMI says.**

> The cost of labour in dayworks shall be given as a sum; alternatively, a schedule of the different categories of labour may be given containing a provisional quantity of hours for each category.

**Unit.** `SCHEDULE`

**The formula.**

```
one priced line per labour category × PROVISIONAL hours
```

**The rule.** DAYWORK LABOUR. POMI permits A SUM or, expressly, A SCHEDULE OF CATEGORIES carrying a PROVISIONAL QUANTITY OF HOURS for each. HOUSE ELECTION: THE SCHEDULE. A sum is one number against one number and reveals nothing about the rates that will be applied when daywork is ordered; a schedule prices each category, so the tender is comparable AND the rates are fixed before anyone needs them. The hours are PROVISIONAL by POMI's own wording and adjust on the actual, so the schedule costs nothing in accuracy.

### GP9.2

**What POMI says.**

> The cost of labour included in a sum or schedule shall include wages, bonuses and all allowances paid to operatives directly engaged on dayworks (including those operating mechanical plant and transport) in accordance with the appropriate employment agreement or, where no such agreement exists, the actual payments made to the work people concerned.

**Unit.** `—` — no arithmetic — a descriptive, definitional or administrative rule

**The formula.** None — this clause carries no arithmetic.

**The rule.** What daywork labour cost includes.

### GP9.3

**What POMI says.**

> The cost of materials in dayworks shall be given as a sum; alternatively, a schedule may be given containing a provisional quantity of different materials.

**Unit.** `SCHEDULE`

**The formula.**

```
one priced line per material × PROVISIONAL quantity
```

**The rule.** DAYWORK MATERIALS, as a SCHEDULE with provisional quantities — same election as GP9.1. GP9.4 fixes the basis: the NET INVOICED PRICE, INCLUDING DELIVERY TO SITE.

### GP9.4

**What POMI says.**

> The cost of materials included in a sum or schedule shall be the net invoiced price, including delivery to site.

**Unit.** `—` — no arithmetic — a descriptive, definitional or administrative rule

**The formula.** None — this clause carries no arithmetic.

**The rule.** Daywork materials at NET INVOICED PRICE including delivery.

### GP9.5

**What POMI says.**

> The cost of constructional plant employed exclusively in dayworks shall be given as a sum; alternatively, a schedule of the different categories of plant may be given containing a provisional quantity of hours, or such other period of time as may be appropriate, for each category.

**Unit.** `SCHEDULE`

**The formula.**

```
one priced line per plant category × PROVISIONAL hours
```

**The rule.** DAYWORK PLANT, as a SCHEDULE with provisional hours — same election as GP9.1. NOTE THE WORD 'EXCLUSIVELY': only plant employed EXCLUSIVELY in dayworks is here. Plant shared with the permanent works is an OVERHEAD under GP9.8 cl.4 and must not appear. GP9.6 fixes what the rate covers: fuel, consumable stores, repairs, maintenance and insurance.

### GP9.6

**What POMI says.**

> The cost of constructional plant included in a sum or schedule shall include fuel, consumable stores, repairs, maintenance and insurance of plant.

**Unit.** `—` — no arithmetic — a descriptive, definitional or administrative rule

**The formula.** None — this clause carries no arithmetic.

**The rule.** What daywork plant cost includes.

### GP9.7

**What POMI says.**

> An item shall be given for the addition of establishment charges, overheads and profit to each of the sums or schedules of labour, materials or plant.

**Unit.** `ITEM ×3`

**The formula.**

```
one addition item against EACH of the three schedules
```

**The rule.** An item for the addition of establishment charges, overheads and profit TO EACH of the sums or schedules of labour, materials and plant. THE WORD IS 'EACH' — three schedules produce THREE addition items, so a daywork section is SIX blocks, not four: labour schedule + its addition, materials schedule + its addition, plant schedule + its addition. A single combined addition cannot be applied when only one of the three is expended.

### GP9.8

**What POMI says.**

> Establishment charges, overheads and profit shall include: 1. Costs related to the employment of labour 2. Costs related to the storage of materials, including handling and waste in storage 3. Contractor's administrative arrangements 4. Constructional plant, except plant employed exclusively on dayworks 5. Contractor's facilities 6. Temporary works 7. Sundry items.

**Unit.** `—` — no arithmetic — a descriptive, definitional or administrative rule

**The formula.** None — this clause carries no arithmetic.

**The rule.** What ESTABLISHMENT CHARGES, OVERHEADS AND PROFIT comprise, SEVEN heads: 1 COSTS RELATED TO THE EMPLOYMENT OF LABOUR · 2 COSTS RELATED TO THE STORAGE OF MATERIALS, INCLUDING HANDLING AND WASTE IN STORAGE · 3 THE CONTRACTOR'S ADMINISTRATIVE ARRANGEMENTS · 4 CONSTRUCTIONAL PLANT, EXCEPT plant employed exclusively on dayworks · 5 THE CONTRACTOR'S FACILITIES · 6 TEMPORARY WORKS · 7 SUNDRY ITEMS. Head 2 is the one that matters to a measurer: WASTE IN STORAGE is an overhead, which is a second reason a quantity never carries waste.

## GP10  Contingencies

### GP10.1

**What POMI says.**

> Unless otherwise required by the conditions of contract, contingencies shall be given as a sum; no item shall be given for the addition of profit.

**Unit.** `SUM` — a SUM — a money figure, not a measured quantity

**The formula.** None — this clause carries no arithmetic.

**The rule.** Contingencies as a sum. NO profit item — the opposite of GP6/7/8/9.7.

# SECTION A — GENERAL REQUIREMENTS

*9 groups · 13 clauses · 0 carrying arithmetic*

## How this section is TAKEN OFF

**The spec row says what the thing is**

```
{the head, written as POMI words it} — e.g. 'Contractor's administrative arrangements, including site administration, supervision, security, safety, health and welfare of workpeople and transport of workpeople'
```

**The dimension rows narrate the calculation**

```
{scope statement}                                    1                    item
```

**The arithmetic.** no arithmetic — Nr = 1, unit = item.

⚠ Section A items carry no dimensions, so the DESCRIPTION is the whole take-off. The spec row must reproduce POMI's list of heads; the dimension row states the scope the item covers. A row reading 'Preliminaries — 1 item' proves nothing.

## How this section is MARKED UP

| | |
|---|---|
| **Trade colour** | grey |
| **Primitive** | LISTED, not spotted |
| **Call-out tag** | listed in the sheet legend only, with no dot |

**What carries a mark.** Nothing on a drawing. Section A is particulars and items — they have no geometry..

⚠ Do not attempt to spot a preliminaries item. Where a RESTRICTION under A3.1 has a physical extent — a limited working area, a phased zone, an access route — mark THAT as an area shade on the site plan and reference it from the A3 particulars. The mark proves the restriction, not the item.

## How this section is BILLED

| | |
|---|---|
| **Closing formula** | none — this section bills items, sums or particulars, not measured work |
| **Variants vary by** | nothing — A is priced as ITEMS and PARTICULARS |
| **Element heading** | GENERAL REQUIREMENTS / PRELIMINARIES |

**The description block**

```
Section A is billed as one ITEM per group, each carrying POMI's own list of heads as its
description. The description IS the list — that is what the contractor prices against.
Where the employer has specified the nature or extent (A7.2, A8.2, A9.2), or imposed a
restriction (A3.1) or required a facility (A6.1), the PARTICULARS are stated in the
description of the item they affect.
```

**The priced variants under it**

```
A   Contractor's administrative arrangements, including site      Item  …
    administration, supervision, security, safety, health and
    welfare of workpeople and transport of workpeople

B   Constructional plant, including small plant and tools,        Item  …
    scaffolding, cranes and lifting plant, site transport and
    plant required for specific trades
```

**What POMI forces into the wording in this section**

- A1.1 — a schedule of the conditions' clause headings.
- A1.2 — a schedule of the appendix insertions.
- A2.1 — reference to the appropriate specification clauses.
- A7.1 heads 4 and 5 — STATE whether water and current will be supplied to the contractor.
- A7.2 / A8.2 / A9.2 — STATE where the nature or extent is not at the contractor's discretion.

⚠ The description of an A item is POMI's own list of heads, written out. Abbreviating it to 'Preliminaries — Item' prices nothing and is the reason preliminaries become claims. A6 (for the EMPLOYER) and A7 (for the CONTRACTOR) get separate items even where one cabin serves both.

## A1  Conditions of contract

### A1.1

**What POMI says.**

> A schedule of the clause headings shall be set out in the bills of quantities.

**Unit.** `—` — no arithmetic — a descriptive, definitional or administrative rule

**The formula.** None — this clause carries no arithmetic.

**The rule.** Schedule of clause headings.

### A1.2

**What POMI says.**

> Where there is an appendix to the conditions of contract requiring insertions to be made, a schedule of the insertions shall be set out in the bills of quantities.

**Unit.** `—` — no arithmetic — a descriptive, definitional or administrative rule

**The formula.** None — this clause carries no arithmetic.

**The rule.** Schedule of appendix insertions.

## A2  Specification

### A2.1

**What POMI says.**

> Where the specification contains clauses related to any of the following General Requirements, the bills of quantities shall make reference to the appropriate clauses.

**Unit.** `—` — no arithmetic — a descriptive, definitional or administrative rule

**The formula.** None — this clause carries no arithmetic.

**The rule.** Bill refers to the specification's General Requirements clauses.

## A3  Restrictions

### A3.1

**What POMI says.**

> Particulars shall be given of any restrictions, which shall include: 1. Access to and possession or use of the site 2. Limitations of working space 3. Limitations of working hours 4. The maintenance of existing services on, under or over the site 5. The execution or completion of the work in any specific order, sections or phases 6. Items of a like nature.

**Unit.** `—` — no arithmetic — a descriptive, definitional or administrative rule

**The formula.** None — this clause carries no arithmetic.

**The rule.** PARTICULARS of RESTRICTIONS, SIX heads, all of them the employer's constraints on how the contractor may work: 1 ACCESS to and POSSESSION OR USE of the site · 2 LIMITATIONS OF WORKING SPACE · 3 LIMITATIONS OF WORKING HOURS · 4 MAINTENANCE OF EXISTING SERVICES on, under or over the site · 5 EXECUTION OR COMPLETION IN ANY SPECIFIC ORDER, SECTIONS OR PHASES · 6 items of a like nature. Noise, pollution and statutory obligations are NOT here — they are sundry items under A9.1.

## A4  Contractor's administrative arrangements

### A4.1

**What POMI says.**

> An item shall be given for contractor's administrative arrangements, which shall include: 1. Site administration 2. Supervision 3. Security 4. Safety, health and welfare of workpeople 5. Transport of workpeople.

**Unit.** `ITEM` — an ITEM — a priced line with no quantity

**The formula.** None — this clause carries no arithmetic.

**The rule.** Contractor's administrative arrangements — site admin, supervision, security, safety, transport of workpeople.

## A5  Constructional plant

### A5.1

**What POMI says.**

> An item shall be given for constructional plant, which shall include: 1. Small plant and tools 2. Scaffolding 3. Cranes and lifting plant 4. Site transport 5. Plant required for specific trades.

**Unit.** `ITEM` — an ITEM — a priced line with no quantity

**The formula.** None — this clause carries no arithmetic.

**The rule.** Constructional plant — small plant, scaffolding, cranes, site transport, trade-specific plant.

## A6  Employer's facilities

### A6.1

**What POMI says.**

> Particulars shall be given of any facilities required for the employer or the employer's representatives, which shall include: 1. Temporary accommodation (for example, offices, laboratories, living accommodation), including heating, cooling, lighting, furnishing, attendance or related facilities 2. Telephones, including costs of calls; alternatively, the cost of calls may be given as a sum 3. Vehicles 4. Attendance of staff (for example, drivers, laboratory assistants) 5. Equipment (for example, surveyor laboratory equipment) 6. Special requirements for programmes or progress charts 7. Any other facilities (for example, progress photographs, signboards).

**Unit.** `—` — no arithmetic — a descriptive, definitional or administrative rule

**The formula.** None — this clause carries no arithmetic.

**The rule.** PARTICULARS of the EMPLOYER'S FACILITIES — what the contractor must provide FOR THE EMPLOYER and the employer's representatives, SEVEN heads: 1 TEMPORARY ACCOMMODATION (offices, laboratories, living accommodation) INCLUDING heating, cooling, lighting, furnishing and attendance · 2 TELEPHONES, INCLUDING THE COST OF CALLS — ALTERNATIVELY the cost of calls MAY BE GIVEN AS A SUM · 3 VEHICLES · 4 ATTENDANCE OF STAFF (drivers, laboratory assistants) · 5 EQUIPMENT (surveying, laboratory) · 6 SPECIAL REQUIREMENTS FOR PROGRAMMES OR PROGRESS CHARTS · 7 any other facilities (progress photographs, signboards). Distinct from A7.1, which is what the contractor provides for HIMSELF.

## A7  Contractor's facilities

### A7.1

**What POMI says.**

> An item shall be given for facilities required by the contractor, which shall include: 1. Accommodation and buildings, including offices, laboratories, compounds, stores, messrooms and living accommodation 2. Temporary fencing, including hoardings, screens, roofs and guardrails 3. Temporary roads, including hardstandings and crossings 4. Water for the works; particulars shall be given if water will be supplied to the contractor 5. Lighting and power for the works; particulars shall be given if current will be supplied to the contractor 6. Temporary telephones.

**Unit.** `ITEM` — an ITEM — a priced line with no quantity

**The formula.** None — this clause carries no arithmetic.

**The rule.** ONE ITEM for the CONTRACTOR'S OWN FACILITIES, SIX heads: 1 ACCOMMODATION AND BUILDINGS — offices, laboratories, compounds, stores, messrooms, living accommodation · 2 TEMPORARY FENCING, INCLUDING hoardings, screens, roofs and guardrails · 3 TEMPORARY ROADS, INCLUDING hardstandings and crossings · 4 WATER FOR THE WORKS — PARTICULARS SHALL BE GIVEN IF WATER WILL BE SUPPLIED TO THE CONTRACTOR · 5 LIGHTING AND POWER FOR THE WORKS — PARTICULARS SHALL BE GIVEN IF CURRENT WILL BE SUPPLIED · 6 TEMPORARY TELEPHONES. The two 'particulars' limbs matter commercially: if the employer supplies water or current, say so, or the contractor prices it twice.

### A7.2

**What POMI says.**

> Particulars shall be given where the nature or extent of the facilities is not at the discretion of the contractor.

**Unit.** `—` — no arithmetic — a descriptive, definitional or administrative rule

**The formula.** None — this clause carries no arithmetic.

**The rule.** Particulars where the facilities are not at the contractor's discretion.

## A8  Temporary works

### A8.1

**What POMI says.**

> An item shall be given for temporary works, which shall include: 1. Traffic diversion 2. Access roads 3. Bridges 4. Cofferdams 5. Pumping 6. De-watering 7. Compressed air for tunnelling.

**Unit.** `ITEM` — an ITEM — a priced line with no quantity

**The formula.** None — this clause carries no arithmetic.

**The rule.** ONE ITEM for TEMPORARY WORKS, SEVEN heads: 1 TRAFFIC DIVERSION · 2 ACCESS ROADS · 3 BRIDGES · 4 COFFERDAMS · 5 PUMPING · 6 DE-WATERING · 7 COMPRESSED AIR FOR TUNNELLING. Pumping and de-watering are SEPARATE heads — keeping water out of an excavation and lowering the water table are not the same operation.

### A8.2

**What POMI says.**

> Particulars shall be given where the nature or extent of the temporary works is not at the discretion of the contractor.

**Unit.** `—` — no arithmetic — a descriptive, definitional or administrative rule

**The formula.** None — this clause carries no arithmetic.

**The rule.** Particulars where not at the contractor's discretion.

## A9  Sundry items

### A9.1

**What POMI says.**

> An item shall be given for sundry items, which shall include: 1. Testing of materials 2. Testing of the works 3. Protecting the works from inclement weather 4. Removing rubbish, protective casings and coverings and cleaning the works at completion 5. Traffic regulations 6. Maintenance of public and private roads ' 7. Drying the works 8. Control of noise and pollution 9. All statutory obligations

**Unit.** `ITEM` — an ITEM — a priced line with no quantity

**The formula.** None — this clause carries no arithmetic.

**The rule.** ONE ITEM for SUNDRY ITEMS, NINE heads: 1 TESTING OF MATERIALS · 2 TESTING OF THE WORKS · 3 PROTECTING THE WORKS FROM INCLEMENT WEATHER · 4 REMOVING RUBBISH, protective casings and coverings, AND CLEANING THE WORKS AT COMPLETION · 5 TRAFFIC REGULATIONS · 6 MAINTENANCE OF PUBLIC AND PRIVATE ROADS · 7 DRYING THE WORKS · 8 CONTROL OF NOISE AND POLLUTION · 9 ALL STATUTORY OBLIGATIONS. Testing of materials and testing of the works are two heads, not one.

### A9.2

**What POMI says.**

> Particulars shall be given where the nature or extent of the sundry items is not at the discretion of the contractor.

**Unit.** `—` — no arithmetic — a descriptive, definitional or administrative rule

**The formula.** None — this clause carries no arithmetic.

**The rule.** Particulars where not at the contractor's discretion.

# SECTION B — SITE WORK

*26 groups · 95 clauses · 65 carrying arithmetic*

## How this section is TAKEN OFF

**The spec row says what the thing is**

```
{depth / classification / destination} — e.g. 'to underside of raft blinding formation, maximum depth not exceeding {d} m'
```

**The dimension rows narrate the calculation**

```
Bulk excavation to {formation}: {element} plan area {A} m2 x {d} m deep
EO deepening to {element}: {element} area {A} m2 x {d} m
Surplus = total cut ({a}+{b}+{c}={T}) less selected re-use {r}
```

**The arithmetic.** Qty each = G*I for a plan area x depth; the surplus line narrates the subtraction IN FULL so the reconciliation is readable on the sheet.

⚠ B is where the narration earns its place. B11 disposal must EQUAL total excavation, so the disposal row spells out the arithmetic — every cut added, the re-use subtracted — and a checker verifies the equality by reading, without opening another tab. Extra-over items are prefixed 'EO' so that B8.5 and B15.2 are visibly extra over and not deductions.

## How this section is MARKED UP

| | |
|---|---|
| **Trade colour** | brown |
| **Primitive** | AREA for excavation, fill and paving · LINEAR for trenches, kerbs and fencing · TAG for trial holes, boreholes, trees, piles and drainage accessories |
| **Call-out tag** | `B-{serial}  {qty} {unit}` — and for extra-over items the tag reads `EO`, so the reviewer sees it is measured OVER the shade beneath it, not cut out of it |

**What carries a mark.** the excavation footprint at each formation level, each as its own shade; the deepening zones separately; the fill footprint; the paved areas; every service and drain trench as a polyline; every pile, gully, chamber, isolated tree and special fence post as a tag.

⚠ **The extra-over items must be marked ON TOP OF the base shade, not instead of it.** Rock under B8.5, deepening under B9, boring through rock under B15.2 — each is a second, overlapping mark. A markup that replaces the base shade with the extra-over shade is drawing the error that B8.5 exists to prevent. And B9.2 service trenches are a POLYLINE only — no separate disposal or backfill mark, because there is no separate quantity.

## How this section is BILLED

| | |
|---|---|
| **Closing formula** | Family 1 |
| | `… complete in accordance with the Specifications and Drawings` |
| **Variants vary by** | depth bands, soil classification, disposal destination |
| **Element heading** | Excavation |

**The description block**

```
Excavation in any type of classified soil or hard strata as per site levels, depth,
Specifications, Drawings, soil report, etc., including earthwork support, keeping
excavations free of water, trimming and levelling bottoms, complete in accordance with
the Specifications and Drawings
```

**The priced variants under it**

```
A   Excavation to receive foundation bases, raft, ramp     193   m3   …
    and grade slab

B   Excavation to reduce levels                            418   m3   …

C   Excavation in trenches to receive foundations           76   m3   …
```

**What POMI forces into the wording in this section**

- B8.1 — STATE the commencing level where it is not the original ground level.
- B9.1 cl.1 — oversite excavation STATES THE AVERAGE DEPTH.
- B9.1 cl.6 — pit excavation STATES THE NUMBER.
- B9.1 cl.7 — diaphragm wall excavation STATES THE WIDTH of the permanent construction AND THE TYPE OF SUPPORT FLUID.
- B2.1 / B3.1 — trial holes and boreholes STATE the number and the maximum depth.

⚠ The description must NOT promise anything the quantity has already excluded. Working space, battering and bulking are in the rate (B8.2 + GP4.1) — so the words may say 'including working space and all bulking' and the QUANTITY still stays net. What the words must never say is anything that implies the quantity carries them.

## B1  Site exploration generally

### B1.1

**What POMI says.**

> Keeping records of site observations, site tests and laboratory tests shall be given as an item.

**Unit.** `ITEM` — an ITEM — a priced line with no quantity

**The formula.** None — this clause carries no arithmetic.

**The rule.** Keeping RECORDS of observations and tests.

### B1.2

**What POMI says.**

> Samples, site observations, site tests, laboratory tests and analyses shall be given as an item,

**Unit.** `ITEM` — an ITEM — a priced line with no quantity

**The formula.** None — this clause carries no arithmetic.

**The rule.** Samples, observations, site tests, laboratory tests AND ANALYSES — the testing itself, distinct from B1.1's recording.

### B1.3

**What POMI says.**

> Providing reports shall be given as an item.

**Unit.** `ITEM` — an ITEM — a priced line with no quantity

**The formula.** None — this clause carries no arithmetic.

**The rule.** Providing reports.

## B2  Trial holes

### B2.1

**What POMI says.**

> Excavating trial holes shall be measured by depth, taken along the centre line, stating the number and the maximum depth below commencing level.

**Unit.** `M (depth)` — by depth, metres

**The formula.**

```
Depth = Σ d(i) ; state N and d_max
```

**The rule.** Trial holes, along the CENTRE LINE. Depth from the COMMENCING LEVEL, not from datum.

### B2.2

**What POMI says.**

> Earthwork support which is not at the discretion of the contractor shall be measured by depth.

**Unit.** `M (depth)` — by depth, metres

**The formula.**

```
Depth = Σ d(i)
```

**The rule.** Earthwork support to trial holes, ONLY where not at the contractor's discretion.

## B3  Boreholes (including pumping test wells)

### B3.1

**What POMI says.**

> Driving boreholes shall be measured by depth, taken along the centre line, stating the number and the maximum depth below commencing level; raking boreholes shall be so described.

**Unit.** `M (depth)` — by depth, metres

**The formula.**

```
Depth = Σ d(i) ; state N and d_max
```

**The rule.** Boreholes. Raking boreholes SO DESCRIBED.

### B3.2

**What POMI says.**

> Lining which is not at the discretion of the contractor shall be measured by depth.

**Unit.** `M (depth)` — by depth, metres

**The formula.**

```
Depth = Σ d(i)
```

**The rule.** Borehole lining, only where not at the contractor's discretion.

### B3.3

**What POMI says.**

> Cappings shall be enumerated.

**Unit.** `NR` — enumerated — a count

**The formula.**

```
N = count
```

**The rule.** Cappings.

## B4  Site preparation

### B4.1

**What POMI says.**

> Removing isolated trees shall be enumerated.

**Unit.** `NR` — enumerated — a count

**The formula.**

```
N = count
```

**The rule.** Isolated trees, by girth band.

### B4.2

**What POMI says.**

> Removing hedges shall be measured by length.

**Unit.** `M` — by length, metres

**The formula.**

```
L = Σ L(i)
```

**The rule.** Hedges.

### B4.3

**What POMI says.**

> Site clearance, which shall include removing vegetation, undergrowth, bushes, hedges, trees or the like, shall be measured by area.

**Unit.** `M2` — by area, square metres

**The formula.**

```
A = L_site × W_site − excluded areas
```

**The rule.** Site clearance — INCLUDES vegetation, undergrowth, bushes, hedges, trees under the stated girth.

## B5  Demolitions and alterations

### B5.1

**What POMI says.**

> The location of each item shall be given. Unless otherwise stated, old materials shall be understood to become the property of the contractor and shall be cleared away; old materials required to remain the property of the employer shall be so described.

**Unit.** `—` — no arithmetic — a descriptive, definitional or administrative rule

**The formula.** None — this clause carries no arithmetic.

**The rule.** Location of each item given. Old materials become the contractor's unless otherwise stated.

### B5.2

**What POMI says.**

> Removing individual fittings, fixtures, engineering installations or the like from an existing structure shall each be given as an item.

**Unit.** `ITEM` — an ITEM — a priced line with no quantity

**The formula.** None — this clause carries no arithmetic.

**The rule.** Removing individual fittings, fixtures or installations from an existing structure.

### B5.3

**What POMI says.**

> Demolishing individual structures (or part thereof) shall each be given as an item; alternatively, demolishing all structures on a site may be given as an item.

**Unit.** `ITEM` — an ITEM — a priced line with no quantity

**The formula.** None — this clause carries no arithmetic.

**The rule.** Demolishing individual structures or parts.

### B5.4

**What POMI says.**

> Cutting openings in existing structures and alterations to existing structures shall each be given as an item; making good all work damaged shall be understood to be included.

**Unit.** `ITEM` — an ITEM — a priced line with no quantity

**The formula.** None — this clause carries no arithmetic.

**The rule.** Cutting openings in, and alterations to, existing structures.

### B5.5

**What POMI says.**

> Temporary screens and roofs shall be given as an item.

**Unit.** `ITEM` — an ITEM — a priced line with no quantity

**The formula.** None — this clause carries no arithmetic.

**The rule.** Temporary screens and roofs.

## B6  Shoring

### B6.1

**What POMI says.**

> Shoring incidental to demolitions and alterations, together with clearing away and making good all work damaged, shall be understood to be included.

**Unit.** `ITEM` — an ITEM — a priced line with no quantity

**The formula.** None — this clause carries no arithmetic.

**The rule.** Shoring INCIDENTAL to demolitions and alterations, with clearing away and making good.

### B6.2

**What POMI says.**

> Shoring (other than that incidental to demolitions and alterations) shall be given as an item, stating the location; clearing away and making good all work damaged shall be understood to be included.

**Unit.** `ITEM` — an ITEM — a priced line with no quantity

**The formula.** None — this clause carries no arithmetic.

**The rule.** Other shoring, stating the type and what is supported.

### B6.3

**What POMI says.**

> Particulars shall be given where the design of the shoring is not at the discretion of the contractor.

**Unit.** `—` — no arithmetic — a descriptive, definitional or administrative rule

**The formula.** None — this clause carries no arithmetic.

**The rule.** Particulars where the shoring design is not the contractor's.

### B6.4

**What POMI says.**

> Shoring which is required by the specification to be left in position shall be so described.

**Unit.** `—` — no arithmetic — a descriptive, definitional or administrative rule

**The formula.** None — this clause carries no arithmetic.

**The rule.** Shoring left in position SO DESCRIBED.

## B7  Underpinning

### B7.1

**What POMI says.**

> Work in underpinning shall be given under an appropriate heading, stating the location.

**Unit.** `—` — no arithmetic — a descriptive, definitional or administrative rule

**The formula.** None — this clause carries no arithmetic.

**The rule.** Underpinning under its own heading, stating the location.

### B7.2

**What POMI says.**

> Unless otherwise stated, work shall be measured in accordance with the appropriate sections of this document.

**Unit.** `—` — no arithmetic — a descriptive, definitional or administrative rule

**The formula.** None — this clause carries no arithmetic.

**The rule.** Work in underpinning measured to the APPROPRIATE SECTIONS — excavation to B, concrete to C, masonry to D.

### B7.3

**What POMI says.**

> Temporary support shall be given as an item; particulars shall be given where the design of the temporary support is not at the discretion of the contractor.

**Unit.** `ITEM` — an ITEM — a priced line with no quantity

**The formula.** None — this clause carries no arithmetic.

**The rule.** Temporary support to underpinning.

### B7.4

**What POMI says.**

> Excavation shall be measured by volume, taken to the outside line of the projecting foundations or to the outside line of the new foundations (whichever is the greater), classified as follows: 1. Excavation in preliminary trenches down to the base of the existing foundations 2. Excavation below the base of the existing foundations.

**Unit.** `M3` — by volume, cubic metres

**The formula.**

```
V = L × W_to_outside_of_projecting_foundation × D
```

**The rule.** Underpinning excavation to the OUTSIDE LINE of the projecting foundation, TWO classes: 1 down TO the base of the existing foundations · 2 BELOW the base of the existing foundations.

### B7.5

**What POMI says.**

> Cutting away projecting foundations shall be measured by length.

**Unit.** `M` — by length, metres

**The formula.**

```
L = Σ L(i)
```

**The rule.** Cutting away projecting foundations.

## B8  Earthworks generally

### B8.1

**What POMI says.**

> Any information available concerning the nature of the ground and strata shall be provided with the bills of quantities.

**Unit.** `—` — no arithmetic — a descriptive, definitional or administrative rule

**The formula.** None — this clause carries no arithmetic.

**The rule.** Ground and strata information provided with the bill.

### B8.2

**What POMI says.**

> The quantities for excavation, dredging or tunnelling shall be understood to be the bulk before excavation, and no allowance shall be made for any working space or subsequent variation in bulk; existing voids shall be deducted.

**Unit.** `RULE` — governs how OTHER quantities are calculated

**The formula.**

```
V = V_designed_void − Σ V_existing_voids
```

**The rule.** THE governing earthworks rule: quantities are the BULK BEFORE EXCAVATION. NO working space, NO bulking. Existing voids ARE deducted.

### B8.3

**What POMI says.**

> Multiple handling of materials and transporting about the site shall be understood to be included; multiple handling which is required by the specification shall be so described in the item of disposal.

**Unit.** `—` — no arithmetic — a descriptive, definitional or administrative rule

**The formula.** None — this clause carries no arithmetic.

**The rule.** Multiple handling and transporting about site DEEMED INCLUDED, unless the specification requires it — then so described in the DISPOSAL item.

### B8.4

**What POMI says.**

> Earthwork support shall be given as an item.

**Unit.** `ITEM` — an ITEM — a priced line with no quantity

**The formula.** None — this clause carries no arithmetic.

**The rule.** Earthwork support. An ITEM, never an area.

### B8.5

**What POMI says.**

> Excavation in rock shall be so described; alternatively, it may be measured as extra over excavation (that is, the volume of rock shall be measured but no deduction shall be made from the volume of excavation in which the rock occurs).

**Unit.** `M3` — by volume, cubic metres

**The formula.**

```
ROUTE A  V_soil = V_total − V_rock   (two items, summing to the total)
ROUTE B  V_excavation = V_total UNCHANGED
         V_rock       = measured AS WELL
```

**The rule.** Excavation in rock. POMI'S PRIMARY LIMB IS 'SHALL BE SO DESCRIBED' — rock described as its own excavation item, the two summing to the total. EXTRA OVER IS THE EXPRESS ALTERNATIVE, and it is the HOUSE ELECTION: the volume of rock is measured but NO DEDUCTION is made from the excavation in which it occurs. Under the elected route the base dig stays whole, which matters because rock is FOUND, not designed. DEDUCTING THE ROCK FROM THE EXCAVATION LOSES THE BASE ITEM — the same error as B15.2 rock boring, D2.2 faced work and G2.3 special sheets, and the one people reverse. B8.6 defines rock, and it is an OPINION, not a geological test.

### B8.6

**What POMI says.**

> For the purposes of measurement rock is defined as any material met with which is of such size or position that, in the opinion of the employer's representative, it can only be removed by means of wedges, special plant or explosives.

**Unit.** `—` — no arithmetic — a descriptive, definitional or administrative rule

**The formula.** None — this clause carries no arithmetic.

**The rule.** Definition of rock: removable only by wedges, special plant or explosives, in the employer's representative's opinion.

## B9  Excavation

### B9.1

**What POMI says.**

> Unless otherwise stated, excavation shall be measured by volume as the void which is to be occupied by the permanent construction, or vertically above any part of the permanent construction, classified as follows: 1. Oversite excavation to remove top soil, stating the average depth 2. Excavation to reduce levels 3. Excavation in cuttings 4. Basement excavation 5. Trench excavation to receive foundations, which shall include pile caps and ground beams 6. Pit excavation to receive foundation bases, stating the number 7. Excavation for diaphragm walls, stating the width of the permanent construction and the type of support fluid.

**Unit.** `M3` — by volume, cubic metres

**The formula.**

```
V = N × L × W × D
```

**The rule.** Excavation as the VOID TO BE OCCUPIED by the permanent construction, or vertically above any part of it — L and W are the PERMANENT CONSTRUCTION's dimensions, not the dig's. SEVEN classes: 1 OVERSITE EXCAVATION to remove top soil, STATING THE AVERAGE DEPTH · 2 EXCAVATION TO REDUCE LEVELS · 3 EXCAVATION IN CUTTINGS · 4 BASEMENT EXCAVATION · 5 TRENCH EXCAVATION to receive foundations, which SHALL INCLUDE PILE CAPS AND GROUND BEAMS · 6 PIT EXCAVATION to receive foundation bases, STATING THE NUMBER · 7 EXCAVATION FOR DIAPHRAGM WALLS, STATING THE WIDTH of the permanent construction AND THE TYPE OF SUPPORT FLUID. Three classes carry a mandatory statement: 1 average depth, 6 the number, 7 width and support fluid.

### B9.2

**What POMI says.**

> Excavation of trenches for service pipes, drain pipes, cables or the like shall each be measured by length, stating the average depth; disposal and filling shall be understood to be included.

**Unit.** `M` — by length, metres

**The formula.**

```
Len = Σ L, per trench type
d_avg STATED
```

**The rule.** Trenches for service pipes, drain pipes, cables or the like shall EACH be measured BY LENGTH — 'each' meaning ONE ITEM PER TRENCH TYPE, not one combined trench item — STATING THE AVERAGE DEPTH. DISPOSAL AND FILLING ARE DEEMED INCLUDED, so NOTHING ELSE is measured for that trench: no disposal row under B11, no filling row under B12, no earthwork support. A drainage trench carrying all three has been paid three times for one operation, and it is the most double-counted item in a site-work bill.

### B9.3

**What POMI says.**

> For excavation in tunnelling see clause B24.

**Unit.** `—` — no arithmetic — a descriptive, definitional or administrative rule

**The formula.** None — this clause carries no arithmetic.

**The rule.** Tunnel excavation is B24, not B9.

## B10  Dredging

### B10.1

**What POMI says.**

> Dredging shall be measured by volume, stating the location and limits; unless otherwise stated, measurement shall be understood to be taken from soundings.

**Unit.** `M3` — by volume, cubic metres

**The formula.**

```
V = Σ V, from soundings
```

**The rule.** Dredging, stating location and limits.

## B11  Disposal

### B11.1

**What POMI says.**

> Disposal of material arising from excavation, dredging or tunnelling shall be measured by volume as equal to the volume of excavation, dredging or tunnelling and each shall be classified as follows: 1. Backfilled into excavation 2. Backfilled in making up levels 3. Backfilled oversite to make up levels, giving details of special contouring, embankments or the like 4. Removed, which shall include providing a suitable tip.

**Unit.** `M3` — by volume, cubic metres

**The formula.**

```
V_disposal = V_excavation  (EXACTLY)
```

**The rule.** Disposal EQUALS the excavation, dredging or tunnelling volume EXACTLY — no bulking, no shrinkage. FOUR classes, each measured separately: 1 BACKFILLED INTO EXCAVATION · 2 BACKFILLED IN MAKING UP LEVELS · 3 BACKFILLED OVERSITE TO MAKE UP LEVELS, GIVING DETAILS of special contouring, embankments or the like · 4 REMOVED, which SHALL INCLUDE PROVIDING A SUITABLE TIP — so tipping charges are in the rate, never a separate item.

## B12  Filling

### B12.1

**What POMI says.**

> Filling material (other than that arising from excavation, dredging or tunnelling) shall be measured by volume as equal to the void to be filled, classified as follows: 1. Filled into excavation 2. Filled in making up levels 3. Filled oversite to make up levels, giving details of special contouring, embankments or the like.

**Unit.** `M3` — by volume, cubic metres

**The formula.**

```
V_fill = V_void_to_be_filled
```

**The rule.** Filling material OTHER THAN that arising from excavation, dredging or tunnelling — so IMPORTED fill only; site-won material returned is B11 'backfilled', and the test is WHERE THE MATERIAL CAME FROM. Measured as EQUAL TO THE VOID TO BE FILLED — the designed void, not the loose volume delivered. THREE classes: 1 FILLED INTO EXCAVATION · 2 FILLED IN MAKING UP LEVELS · 3 FILLED OVERSITE TO MAKE UP LEVELS, GIVING DETAILS OF SPECIAL CONTOURING, EMBANKMENTS OR THE LIKE. Note there is NO 'removed' class, the asymmetry with B11's four: imported material is not taken away. If you want to bill 'filling — removed', you are in the wrong clause.

## B13  Piling generally

### B13.1

**What POMI says.**

> For the purposes of measurement, driven piling shall include timber, precast concrete or metal piles.

**Unit.** `—` — no arithmetic — a descriptive, definitional or administrative rule

**The formula.** None — this clause carries no arithmetic.

**The rule.** Driven piling includes timber, precast concrete and metal piles.

### B13.2

**What POMI says.**

> Other piling systems (for example, preformed casing with concrete filling) shall be measured in accordance with the principles for driven piling or bored piling as may be appropriate.

**Unit.** `—` — no arithmetic — a descriptive, definitional or administrative rule

**The formula.** None — this clause carries no arithmetic.

**The rule.** Other systems measured as driven or bored, whichever fits.

### B13.3

**What POMI says.**

> Unless otherwise stated, reinforcement shall be measured in accordance with Section C.

**Unit.** `—` — no arithmetic — a descriptive, definitional or administrative rule

**The formula.** None — this clause carries no arithmetic.

**The rule.** Pile reinforcement to Section C.

## B14  Driven piling

### B14.1

**What POMI says.**

> Supplying piles shall be measured by length, stating the number; reinforcement shall be given separately.

**Unit.** `M` — by length, metres

**The formula.**

```
L = Σ L_pile ; state N
```

**The rule.** SUPPLYING piles. Reinforcement given separately.

### B14.2

**What POMI says.**

> Heads and shoes shall be enumerated.

**Unit.** `NR` — enumerated — a count

**The formula.**

```
N = count
```

**The rule.** Heads and shoes.

### B14.3

**What POMI says.**

> Driving piles shall be measured by length, taken from the pile point in contact with the ground when pitched to the pile point when driven, stating the number; driving piles on rake shall be so described.

**Unit.** `M` — by length, metres

**The formula.**

```
L = Σ (pitched point → driven point) ; state N
```

**The rule.** DRIVING piles — a different length from supply. Raking piles SO DESCRIBED.

### B14.4

**What POMI says.**

> Cutting off tops of piles and connections for lengthening piles shall be enumerated.

**Unit.** `NR` — enumerated — a count

**The formula.**

```
N = count
```

**The rule.** Cutting off tops; connections for lengthening.

## B15  Bored piling

### B15.1

**What POMI says.**

> Boring for piles shall be measured by length, taken from the formation level of the ground to the bottom of the pile hole, stating the number; the measurement shall include for blind boring when the pile top is to be below the formation level of the ground.

**Unit.** `M` — by length, metres

**The formula.**

```
L = formation level → bottom of hole ; state N
```

**The rule.** Boring. INCLUDES blind boring where the pile top is below formation level.

### B15.2

**What POMI says.**

> Boring through rock shall be measured by length as extra over boring for piles (that is, the length of boring through rock shall be measured but no deduction shall be made from the total length of boring).

**Unit.** `M` — by length, metres

**The formula.**

```
L_rock measured; L_boring UNCHANGED
```

**The rule.** Boring through rock, EXTRA OVER.

### B15.3

**What POMI says.**

> Linings for piles shall be measured by length.

**Unit.** `M` — by length, metres

**The formula.**

```
L = Σ L_lining
```

**The rule.** Pile linings.

### B15.4

**What POMI says.**

> Disposal of material arising from boring shall be measured in accordance with clause B11.

**Unit.** `M3` — by volume, cubic metres

**The formula.**

```
per B11
```

**The rule.** Disposal of boring arisings.

### B15.5

**What POMI says.**

> Concrete filling shall be measured by volume.

**Unit.** `M3` — by volume, cubic metres

**The formula.**

```
V = Σ (π/4) × Ø² × L
```

**The rule.** Concrete filling to bored piles.

### B15.6

**What POMI says.**

> Cutting off tops of piles and forming enlarged bases shall be enumerated.

**Unit.** `NR` — enumerated — a count

**The formula.**

```
N = count
```

**The rule.** Cutting off tops; forming enlarged bases.

## B16  Sheet piling

### B16.1

**What POMI says.**

> The measurements for sheet piling shall be taken along the centre line.

**Unit.** `RULE` — governs how OTHER quantities are calculated

**The formula.** None — this clause carries no arithmetic.

**The rule.** ALL sheet piling measured along the CENTRE LINE.

### B16.2

**What POMI says.**

> Supplying sheet piling shall be measured by area, taken as the area when in final position.

**Unit.** `M2` — by area, square metres

**The formula.**

```
A = area IN FINAL POSITION
```

**The rule.** Supplying sheet piling.

### B16.3

**What POMI says.**

> Corner piles or the like shall be measured by length.

**Unit.** `M` — by length, metres

**The formula.**

```
L = Σ L
```

**The rule.** Corner piles.

### B16.4

**What POMI says.**

> Driving sheet piling shall be measured by area, taken from the formation level of the ground to the bottom edge of the sheet piling when driven; strutting and waling and withdrawing sheet piling shall be understood to be included.

**Unit.** `M2` — by area, square metres

**The formula.**

```
A = L_centreline × (formation level → bottom edge when driven)
```

**The rule.** Driving sheet piling BY AREA. The area is the CENTRE-LINE LENGTH (B16.1 fixes that every sheet-piling measurement is taken along the centre line) TIMES the driven depth, measured from the FORMATION LEVEL OF THE GROUND to the BOTTOM EDGE WHEN DRIVEN. A depth alone is not an area. NOTE THIS IS A DIFFERENT AREA FROM B16.2: supplying is measured as the area WHEN IN FINAL POSITION, driving from formation level — two correct areas for one wall of piles. STRUTTING, WALING AND WITHDRAWING ARE DEEMED INCLUDED, which is a large cost inside one clause and is why B16.6 'left in position' must be described when it applies.

### B16.5

**What POMI says.**

> Cutting sheet piling shall be measured by length.

**Unit.** `M` — by length, metres

**The formula.**

```
L = Σ L
```

**The rule.** Cutting sheet piling.

### B16.6

**What POMI says.**

> Sheet piling which is required by the specification to be left in position shall be so described.

**Unit.** `—` — no arithmetic — a descriptive, definitional or administrative rule

**The formula.** None — this clause carries no arithmetic.

**The rule.** Sheet piling left in position SO DESCRIBED.

## B17  Performance designed piling

### B17.1

**What POMI says.**

> Performance designed piles shall be enumerated; reinforcement and disposal of material arising from boring shall be understood to be included.

**Unit.** `NR` — enumerated — a count

**The formula.**

```
N = count
```

**The rule.** Performance designed piles. REINFORCEMENT AND DISPOSAL DEEMED INCLUDED — do not measure either.

### B17.2

**What POMI says.**

> Details shall be given when the pile top is to be below the formation level of the ground.

**Unit.** `—` — no arithmetic — a descriptive, definitional or administrative rule

**The formula.** None — this clause carries no arithmetic.

**The rule.** Details where the pile top is below formation level.

## B18  Testing piling

### B18.1

**What POMI says.**

> Testing piling, which shall include trial piles and testing working piles, shall be given as an item.

**Unit.** `ITEM` — an ITEM — a priced line with no quantity

**The formula.** None — this clause carries no arithmetic.

**The rule.** Testing piling — INCLUDES trial piles and testing working piles.

## B19  Underground drainage

### B19.1

**What POMI says.**

> Drain pipes shall be measured by length, taken along the centre line over all fittings; drain pipes within inspection chambers or the like shall be so described and shall be understood to include fixings and supports.

**Unit.** `M` — by length, metres

**The formula.**

```
L = Σ L_centreline, OVER ALL FITTINGS
```

**The rule.** Drain pipes. Pipes within chambers SO DESCRIBED and INCLUDE fixings and supports.

### B19.2

**What POMI says.**

> Drain fittings in the length (for example, bends, junctions) shall be enumerated, grouped together for each size of pipe and described as 'fittings'.

**Unit.** `NR` — enumerated — a count

**The formula.**

```
N = count, GROUPED per pipe size
```

**The rule.** Drain fittings in the length, described as 'fittings'.

### B19.3

**What POMI says.**

> Drain accessories (for example, gullies, traps) shall be enumerated; concrete surrounds and additional excavation shall be understood to be included.

**Unit.** `NR` — enumerated — a count

**The formula.**

```
N = count
```

**The rule.** Drain accessories. CONCRETE SURROUNDS AND ADDITIONAL EXCAVATION DEEMED INCLUDED.

### B19.4

**What POMI says.**

> Concrete beds and coverings for drain pipes shall each be measured by length, stating the diameter of the pipe; surrounds to vertical pipes shall be so described and shall be understood to include formwork.

**Unit.** `M` — by length, metres

**The formula.**

```
Len = Σ L, per class
```

**The rule.** Concrete beds and coverings for drain pipes shall EACH be measured BY LENGTH — 'each' meaning beds and coverings are SEPARATE items, not one combined item — STATING THE DIAMETER OF THE PIPE, which is a mandatory statement. BY LENGTH, NOT BY VOLUME. Surrounds to VERTICAL pipes are SO DESCRIBED and are DEEMED TO INCLUDE FORMWORK.

### B19.5

**What POMI says.**

> Inspection chambers or the like shall be enumerated; alternatively, they may be measured in accordance with the relevant sections of this document and given under an appropriate heading.

**Unit.** `NR` — enumerated — a count

**The formula.**

```
N = count
```

**The rule.** Inspection chambers — or measured to the relevant sections under a heading.

### B19.6

**What POMI says.**

> Connections to existing drains shall be enumerated, subject to clause GP8.

**Unit.** `NR` — enumerated — a count

**The formula.**

```
N = count
```

**The rule.** Connections to existing drains, SUBJECT TO GP8.

## B20  Paving and surfacing

### B20.1

**What POMI says.**

> Paving and surfacing shall be measured by area.

**Unit.** `M2` — by area, square metres

**The formula.**

```
A = Σ (L × W) − voids per GP3.2/GP3.3
```

**The rule.** Paving and surfacing.

### B20.2

**What POMI says.**

> Expansion joints and water stops shall be measured by length.

**Unit.** `M` — by length, metres

**The formula.**

```
L = Σ L
```

**The rule.** Expansion joints and water stops.

### B20.3

**What POMI says.**

> Channels, curbs, edgings or the like shall be measured by length; curved work shall be so described.

**Unit.** `M` — by length, metres

**The formula.**

```
L = Σ L
```

**The rule.** Channels, curbs, edgings. CURVED WORK SO DESCRIBED.

## B21  Fencing

### B21.1

**What POMI says.**

> Fencing, which shall include posts and supports in the length, shall be measured by length; excavating pits, disposal and filling shall be understood to be included.

**Unit.** `M` — by length, metres

**The formula.**

```
L = Σ L
```

**The rule.** Fencing. POSTS AND SUPPORTS IN THE LENGTH. EXCAVATING PITS, DISPOSAL AND FILLING DEEMED INCLUDED.

### B21.2

**What POMI says.**

> Special posts (for example, gate posts, straining posts) shall be enumerated; excavating pits, disposal and filling shall be understood to be included.

**Unit.** `NR` — enumerated — a count

**The formula.**

```
N = count
```

**The rule.** Special posts — gate, straining. Same deemed inclusions.

### B21.3

**What POMI says.**

> Gates, barriers or the like shall be enumerated.

**Unit.** `NR` — enumerated — a count

**The formula.**

```
N = count
```

**The rule.** Gates, barriers.

### B21.4

**What POMI says.**

> Finishes shall be measured in accordance with Section J.

**Unit.** `—` — no arithmetic — a descriptive, definitional or administrative rule

**The formula.** None — this clause carries no arithmetic.

**The rule.** Finishes to fencing measured to Section J.

## B22  Landscaping

### B22.1

**What POMI says.**

> Cultivating and fertilising ground shall be measured by area.

**Unit.** `M2` — by area, square metres

**The formula.**

```
A = Σ A
```

**The rule.** Cultivating and fertilising.

### B22.2

**What POMI says.**

> Soiling, seeding and turfing shall be measured by area.

**Unit.** `M2` — by area, square metres

**The formula.**

```
A = Σ A
```

**The rule.** Soiling, seeding, turfing.

### B22.3

**What POMI says.**

> Hedges shall be measured by length.

**Unit.** `M` — by length, metres

**The formula.**

```
L = Σ L
```

**The rule.** Hedges.

### B22.4

**What POMI says.**

> Trees and shrubs shall be enumerated.

**Unit.** `NR` — enumerated — a count

**The formula.**

```
N = count
```

**The rule.** Trees and shrubs.

## B23  Railway work

### B23.1

**What POMI says.**

> Track, guard rails and conductor rails shall each be measured by length, taken along the centre line over all fittings; curved work shall be so described.

**Unit.** `M` — by length, metres

**The formula.**

```
L = Σ L_centreline
```

**The rule.** Track, guard rails, conductor rails.

### B23.2

**What POMI says.**

> Sleepers and chairs shall be enumerated.

**Unit.** `NR` — enumerated — a count

**The formula.**

```
N = count
```

**The rule.** Sleepers and chairs.

### B23.3

**What POMI says.**

> Switches and crossings shall be enumerated, classified as follows: 1. Switches and turnouts 2. Diamond crossings 3. Single slip crossings 4. Double slip crossings 5. Other switches and crossings.

**Unit.** `NR` — enumerated — a count

**The formula.**

```
N = count
```

**The rule.** Switches and crossings ENUMERATED, FIVE classes: 1 SWITCHES AND TURNOUTS · 2 DIAMOND CROSSINGS · 3 SINGLE SLIP CROSSINGS · 4 DOUBLE SLIP CROSSINGS · 5 other switches and crossings. Single and double slips are separate classes — they are not one 'slip crossing' item.

### B23.4

**What POMI says.**

> Ballast shall be measured by volume, without deduction for track, classified as follows: 1. Bottom ballast, placed before the track is laid 2. Top ballast, placed after the track is laid.

**Unit.** `M3` — by volume, cubic metres

**The formula.**

```
V = Σ V, NO DEDUCTION FOR TRACK
```

**The rule.** Ballast by VOLUME, WITHOUT DEDUCTION FOR THE TRACK, TWO classes distinguished by WHEN it is placed: 1 BOTTOM BALLAST, PLACED BEFORE THE TRACK IS LAID · 2 TOP BALLAST, PLACED AFTER THE TRACK IS LAID. The sequence is the classification; measuring one ballast item loses it.

### B23.5

**What POMI says.**

> Concrete track foundations shall be measured by length, except that overwidth foundations for switches and crossings shall be measured by area; reinforcement and shuttering shall be understood to be included.

**Unit.** `M` — by length, metres

**The formula.**

```
L = Σ L
```

**The rule.** Concrete track foundations; OVERWIDTH foundations by volume.

### B23.6

**What POMI says.**

> Bitumen filler to complete rail assemblies shall be measured by length.

**Unit.** `M` — by length, metres

**The formula.**

```
L = Σ L
```

**The rule.** Bitumen filler to rail assemblies.

### B23.7

**What POMI says.**

> Buffer stops, wheel stops or the like shall be enumerated.

**Unit.** `NR` — enumerated — a count

**The formula.**

```
N = count
```

**The rule.** Buffer stops, wheel stops.

### B23.8

**What POMI says.**

> Signalling installations shall be measured in accordance with Section L or Section R.

**Unit.** `—` — no arithmetic — a descriptive, definitional or administrative rule

**The formula.** None — this clause carries no arithmetic.

**The rule.** Signalling to Section L or Section R.

## B24  Tunnel excavation

### B24.1

**What POMI says.**

> Excavation shall be measured by volume as the void which is to be occupied, including the volume of permanent linings, grouped as may be appropriate to identify different lengths and classified as follows: 1. Straight tunnels 2. Straight shafts 3. Curved tunnels 4. Curved shafts 5. Tapered tunnels 6. Tapered shafts 7. Other cavities, which shall include transitions, breakaways and intersections between shafts and tunnels.

**Unit.** `M3` — by volume, cubic metres

**The formula.**

```
V = void to be occupied, INCLUDING the lining
```

**The rule.** Tunnel excavation, SEVEN classes: straight tunnels · straight shafts · curved tunnels · curved shafts · tapered tunnels · tapered shafts · other cavities, which INCLUDE transitions, breakaways and intersections between shafts and tunnels.

### B24.2

**What POMI says.**

> Forward probing shall be measured by length, stating the number of probes.

**Unit.** `M` — by length, metres

**The formula.**

```
L = Σ L ; state number of probes
```

**The rule.** Forward probing.

### B24.3

**What POMI says.**

> For disposal see clause B11.

**Unit.** `—` — no arithmetic — a descriptive, definitional or administrative rule

**The formula.** None — this clause carries no arithmetic.

**The rule.** Tunnel disposal per B11.

## B25  Tunnel linings

### B25.1

**What POMI says.**

> Poured concrete linings shall be measured by area, stating whether spray or cast concrete, classified as follows: 1. lining 2. Secondary lining.

**Unit.** `M2` — by area, square metres

**The formula.**

```
A = Σ A
```

**The rule.** Poured concrete tunnel linings by AREA, STATING WHETHER SPRAY OR CAST CONCRETE, TWO classes: 1 [primary] LINING — the RICS text prints this class as bare 'lining', with the qualifying word lost in the source; read against class 2 it is the PRIMARY lining · 2 SECONDARY LINING. Measure the two separately; a single lining item cannot be priced, because primary and secondary are different operations at different times.

### B25.2

**What POMI says.**

> Preformed segmental tunnel linings shall be enumerated.

**Unit.** `NR` — enumerated — a count

**The formula.**

```
N = count
```

**The rule.** Preformed segmental linings.

## B26  Tunnel support and stabilisation

### B26.1

**What POMI says.**

> Timber supports shall be measured by volume.

**Unit.** `M3` — by volume, cubic metres

**The formula.**

```
V = Σ V
```

**The rule.** Timber tunnel supports.

### B26.2

**What POMI says.**

> Sprayed concrete supports and reinforcement shall be measured by area.

**Unit.** `M2` — by area, square metres

**The formula.**

```
A = Σ A
```

**The rule.** Sprayed concrete supports and reinforcement.

### B26.3

**What POMI says.**

> Rock bolts shall be measured by length.

**Unit.** `M` — by length, metres

**The formula.**

```
L = Σ L
```

**The rule.** Rock bolts.

### B26.4

**What POMI says.**

> Face packers shall be enumerated.

**Unit.** `NR` — enumerated — a count

**The formula.**

```
N = count
```

**The rule.** Face packers.

### B26.5

**What POMI says.**

> Metal arch supports shall be measured by weight.

**Unit.** `KG` — by weight, kilogrammes

**The formula.**

```
W = Σ L × m_per_m
```

**The rule.** Metal arch supports.

### B26.6

**What POMI says.**

> Injection of grout materials shall be measured by weight.

**Unit.** `KG` — by weight, kilogrammes

**The formula.**

```
W = Σ W_grout
```

**The rule.** Injection of grout materials.

# SECTION C — CONCRETE WORK

*7 groups · 36 clauses · 25 carrying arithmetic*

## How this section is TAKEN OFF

**The spec row says what the thing is**

```
{thickness} {element} — e.g. '600 mm thick general raft', '250/280 mm thick slabs to typical floors'
```

**The dimension rows narrate the calculation**

```
General raft slab: plan area {A} m2 x {t} m thick
Shear walls {ref}-{ref}: {L} m x {h} m ht x {t} m thick
Typical floor slab {t1}/{t2} mm: {A} m2 x {t_avg} m average
```

**The arithmetic.** Qty each = G*I for area x thickness, = G*H*I for length x height x thickness. Nr carries the FLOOR COUNT — 4 typical floors is Nr = 4, not four rows.

⚠ The spec row carries the THICKNESS because GP5.3 makes it a mandatory statement in the bill, and the take-off is where it is first fixed. Where a slab has two thicknesses the spec row states both and the dimension row states the average actually used — so the averaging is visible, not buried.

## How this section is MARKED UP

| | |
|---|---|
| **Trade colour** | blue |
| **Primitive** | AREA for slabs, beds and walls in elevation · TAG for columns and isolated bases |
| **Call-out tag** | `C-{serial}  {qty} m3` — the label states the thickness, because the shade is an AREA and the volume is that area × the thickness |

**What carries a mark.** every slab by level as a shaded polygon with its thickness in the label; thickened zones and drops as separate overlapping shades; walls and cores in plan; every column and isolated base as a tag; each formwork face as its own shade where formwork is marked separately.

⚠ **A volume mark is an area × a STATED thickness, and the thickness must be in the label** — otherwise the closure test has nothing to multiply by and the mark cannot be checked. Beams under C2.1 cl.8 are measured BELOW the slab, so a beam mark must show the beam zone, not the full depth through the slab; mark the slab and the beam as two shades, never one.

## How this section is BILLED

| | |
|---|---|
| **Closing formula** | Family 1 |
| | `… complete in accordance with the Specifications and Drawings` |
| **Variants vary by** | THICKNESSES and grades |
| **Element heading** | Concrete |

**The description block**

```
Reinforced concrete grade {grade}, {cement type}, minimum cement content {content},
maximum water/cement ratio {ratio}, including formwork, vibrating, curing, forming
construction joints, water stops and all necessary works, complete in accordance with
the Specifications and Drawings
```

**The priced variants under it**

```
A   Grade slab, 150mm thick                                 412   m2   …

B   Suspended slabs, 200mm thick                            286   m2   …

C   Walls, 250mm thick                                       94   m3   …
```

**What POMI forces into the wording in this section**

- GP5.3 — every AREA item states the THICKNESS.
- C2.1 cl.4, cl.5, cl.6 — beds, suspended slabs and walls EACH STATE THE THICKNESS.
- C3.1 — reinforcement STATES the diameter and, where relevant, the type.
- C4.1 cl.7, cl.8 — ISOLATED beams SO DESCRIBED.

⚠ 15 of Concrete's 34 shared-description runs carry sized variants — the highest of any section. Thickness is the variant axis here, and it is also a POMI mandatory statement, so the two coincide: the variant line IS the GP5.3 statement.

## C1  Generally

### C1.1

**What POMI says.**

> Reinforced poured concrete and plain poured concrete shall each be so described.

**Unit.** `—` — no arithmetic — a descriptive, definitional or administrative rule

**The formula.** None — this clause carries no arithmetic.

**The rule.** Reinforced and plain poured concrete EACH SO DESCRIBED.

### C1.2

**What POMI says.**

> Poured concrete required by the specification to be placed, compacted, cured or otherwise treated in a particular manner shall be so described.

**Unit.** `—` — no arithmetic — a descriptive, definitional or administrative rule

**The formula.** None — this clause carries no arithmetic.

**The rule.** Special placing, compacting, curing or treatment SO DESCRIBED.

### C1.3

**What POMI says.**

> No deduction shall be made for voids less than 1.00 m3, nor for the volume of any reinforcement or structural metal enclosed in the concrete, except that voids caused by boxed or tubular structural metalwork shall always be deducted.

**Unit.** `RULE` — governs how OTHER quantities are calculated

**The formula.**

```
V_net = V_gross − Σ V_void(≥1.00 m³) − Σ V_boxed_or_tubular_steel
```

**The rule.** The concrete deduction rule. NO deduction for rebar or for solid enclosed steel. BOXED OR TUBULAR steel is ALWAYS deducted, at any size.

### C1.4

**What POMI says.**

> Unless otherwise described, horizontal surfaces of concrete shall be understood to be tamped.

**Unit.** `—` — no arithmetic — a descriptive, definitional or administrative rule

**The formula.** None — this clause carries no arithmetic.

**The rule.** Horizontal concrete surfaces UNDERSTOOD TO BE TAMPED unless otherwise described — so a tamped finish is not a measurable item.

## C2  Poured concrete

### C2.1

**What POMI says.**

> Unless otherwise stated, poured concrete shall be measured by volume, classified as follows: 1. Foundations, which shall include combined or isolated bases 2. Pile caps, which shall include ground beams 3. Blinding 4. Beds, which shall include roads and footpaths, stating the thickness 5. Suspended slabs, which shall include floors, landings, roofs or the like, stating the thickness 6. Walls, which shall include attached columns, stating the thickness 7. Columns, which shall include casing to metal stancheons 8. Beams (measured below the slab), which shall include lintels and casing to metal beams 9. Staircases, which shall include steps and strings 10. Diaphragm walls 11. Other classifications (for example, tunnel linings, bridge abutments) as may be appropriate.

**Unit.** `M3` — by volume, cubic metres

**The formula.**

```
V = N × L × W × T
```

**The rule.** Poured concrete by VOLUME, ELEVEN classes: 1 FOUNDATIONS, which INCLUDE combined or isolated bases · 2 PILE CAPS, which INCLUDE GROUND BEAMS · 3 BLINDING · 4 BEDS, which INCLUDE ROADS AND FOOTPATHS, STATING THE THICKNESS · 5 SUSPENDED SLABS, which INCLUDE floors, landings and roofs, STATING THE THICKNESS · 6 WALLS, which INCLUDE ATTACHED COLUMNS, STATING THE THICKNESS · 7 COLUMNS, which INCLUDE CASING TO METAL STANCHEONS · 8 BEAMS, MEASURED BELOW THE SLAB, which INCLUDE lintels and casing to metal beams — V = N × b × (D − t_slab) × L · 9 STAIRCASES, which INCLUDE STEPS AND STRINGS · 10 DIAPHRAGM WALLS · 11 other classifications, e.g. tunnel linings, bridge abutments. Classes 4, 5 and 6 each STATE THE THICKNESS.

### C2.2

**What POMI says.**

> Poured concrete suspended slabs of special construction, including floors, landings, roofs or the like, shall be measured by area; coffered and troughed slabs shall be so described, giving details of solid margins or the like.

**Unit.** `M2` — by area, square metres

**The formula.**

```
A = Σ (L × W) − voids
```

**The rule.** Suspended slabs of SPECIAL construction BY AREA, not volume. Coffered and troughed SO DESCRIBED with details of solid margins.

### C2.3

**What POMI says.**

> Where an item is required to be measured by volume and the thickness stated, then items of differing thickness may be grouped together, provided that the range of the different thicknesses is stated.

**Unit.** `—` — no arithmetic — a descriptive, definitional or administrative rule

**The formula.** None — this clause carries no arithmetic.

**The rule.** Differing thicknesses MAY be GROUPED provided the RANGE is stated. HOUSE RULE: grouping is used, but ONLY WITHIN ONE CONSTRUCTION STAGE — substructure, superstructure, roof. Items are never grouped ACROSS stages, because a 200 mm raft and a 200 mm roof slab do not price alike and a range spanning them tells a tenderer nothing. Grouping removes the individual thickness statement C2.1 cl.4, cl.5 and cl.6 require, so the stated range is what carries that duty and it must be tight.

## C3  Reinforcement

### C3.1

**What POMI says.**

> The weight of bar reinforcement shall be the net weight without addition for rolling margin, supports, spacers or tying wire.

**Unit.** `KG` — by weight, kilogrammes

**The formula.**

```
W = Σ (N_bars × L_bar_INCLUDING_LAPS × m_per_m(Ø))
```

**The rule.** THE NET WEIGHT RULE, and read its exclusion list EXACTLY: no addition for ROLLING MARGIN, SUPPORTS, SPACERS or TYING WIRE. LAPS ARE NOT IN THAT LIST. A lap is steel fixed in position, so under GP3.1 it IS measured — and the contrast with C3.3, which excludes laps from FABRIC in terms, proves the omission here is deliberate. WHAT IS FORBIDDEN is a BLANKET PERCENTAGE UPLIFT with no derivation. HOUSE RULE ON THE SOURCE: reinforcement is MEASURED FROM THE SECTION DRAWINGS, never from a bar bending schedule. N_bars = (L_run / spacing) + 1 read off the section; each lap derived from the SPECIFIED LAP LENGTH (k x diameter) at the positions the section shows. A BBS, where one is later issued, is a CROSS-CHECK ONLY — reconcile and record the variance, raise a technical query on a real difference, but do not adopt the schedule's figure. Chairs, spacers and tying wire remain excluded at all times.

### C3.2

**What POMI says.**

> Bar reinforcement shall be measured by weight, stating the diameter; bars of differing diameters shall be given separately.

**Unit.** `KG` — by weight, kilogrammes

**The formula.**

```
W = Σ N_bars × L_bar × m_per_m(Ø)
m_per_m = (π/4) × Ø² × 7850 / 1e6
```

**The rule.** Bar reinforcement, STATING THE DIAMETER. Differing diameters GIVEN SEPARATELY — never a blended tonnage.

### C3.3

**What POMI says.**

> Fabric reinforcement shall be measured by area, without addition for laps.

**Unit.** `M2` — by area, square metres

**The formula.**

```
A = A_covered, NO addition for laps
```

**The rule.** Fabric reinforcement. A lap covers the same square metre twice.

### C3.4

**What POMI says.**

> Reinforcement shall be given as an item where the detailed design work is the responsibility of the contractor.

**Unit.** `ITEM` — an ITEM — a priced line with no quantity

**The formula.** None — this clause carries no arithmetic.

**The rule.** Reinforcement as an ITEM where the detailed design is the contractor's responsibility.

## C4  Shuttering

### C4.1

**What POMI says.**

> Unless otherwise stated, shuttering shall be measured by area, taken as the net area in contact with the finished face of concrete, classified as follows: 1. Soffits; shuttering to soffits of special construction shall be so described 2. Sloping soffits, which shall include soffits of staircases 3. Sloping upper surfaces, which shall include surfaces more than 15° from horizontal 4. Sides of foundations, which shall include bases, pile caps and ground beams 5. Sides of walls, which shall include attached columns 6. Returns to walls, which shall include ends, projections and reveals of openings or recesses 7. Sides and soffits of beams, which shall include lintels and breaks in soffits; isolated beams shall be so described 8. Sides and soffits of sloping beams, which shall include lintels and breaks in soffits; isolated beams shall be so described 9. Sides of columns 10. Staircases, which shall include treads, risers and strings but exclude soffits 11. Other classifications (for example, tunnel linings, bridges, bridge abutments) as may be appropriate.

**Unit.** `M2` — by area, square metres

**The formula.**

```
A = Σ A_contact
```

**The rule.** Shuttering as the NET AREA IN CONTACT with the finished face of the concrete, ELEVEN classes: 1 SOFFITS — soffits of special construction SO DESCRIBED · 2 SLOPING SOFFITS, which INCLUDE SOFFITS OF STAIRCASES · 3 SLOPING UPPER SURFACES, which are surfaces MORE THAN 15° FROM HORIZONTAL · 4 SIDES OF FOUNDATIONS, which INCLUDE bases, pile caps and ground beams · 5 SIDES OF WALLS, which INCLUDE ATTACHED COLUMNS · 6 RETURNS TO WALLS, which INCLUDE ends, projections and reveals of openings or recesses · 7 SIDES AND SOFFITS OF BEAMS, which INCLUDE lintels and breaks in soffits; ISOLATED BEAMS SO DESCRIBED — A = L × (2·h_exposed + b) · 8 SIDES AND SOFFITS OF SLOPING BEAMS, same inclusions, isolated so described · 9 SIDES OF COLUMNS · 10 STAIRCASES, which INCLUDE treads, risers and strings BUT EXCLUDE SOFFITS — the soffit is class 2 · 11 other classifications. The 15° line in class 3 and the staircase split between 2 and 10 are the two places shuttering is most often misclassified.

### C4.2

**What POMI says.**

> Shuttering to edges, which shall include face of curb or upstand or break in upper surface of floor, shall be measured by length; items of differing height may be grouped together, provided that the range of different heights is stated.

**Unit.** `M` — by length, metres

**The formula.**

```
L = Σ L
```

**The rule.** Shuttering to EDGES — includes curb face, upstand, break in upper surface of floor. Heights may be grouped if the RANGE is stated.

### C4.3

**What POMI says.**

> Grooves, which shall include throats, rebates, chamfers or the like, 2500 mm2 sectional area or over shall be measured by length; grooves less than 2500 mm2 sectional area shall be understood to be included.

**Unit.** `M` — by length, metres

**The formula.**

```
if sectional area ≥ 2500 mm² → Len = Σ L
if sectional area <  2500 mm² → DEEMED INCLUDED
```

**The rule.** THE 2500 mm² THRESHOLD. Grooves — which INCLUDE throats, rebates and CHAMFERS — of 2500 mm² SECTIONAL AREA OR OVER are measured by length; under that they are DEEMED INCLUDED. COMPUTE THE SECTIONAL AREA FROM THE SHAPE, NOT FROM THE LEG DIMENSIONS. A chamfer is a TRIANGLE: 50 x 50 mm legs give ½ × 50 × 50 = 1250 mm², which is UNDER the threshold and therefore FREE. A chamfer only reaches 2500 mm² at about 71 x 71 mm legs. A rebate or a throat is rectangular, so 50 x 50 there IS 2500 mm² and is measured. Reading the leg dimensions as the area bills a whole class of chamfers POMI deems included.

### C4.4

**What POMI says.**

> Shuttering may be enumerated where it is more appropriate to do so (for example, decorative features).

**Unit.** `NR` — enumerated — a count

**The formula.**

```
N = count
```

**The rule.** Shuttering may be ENUMERATED where more appropriate — decorative features.

### C4.5

**What POMI says.**

> Shuttering which is required by the specification to be left in position shall be so described.

**Unit.** `—` — no arithmetic — a descriptive, definitional or administrative rule

**The formula.** None — this clause carries no arithmetic.

**The rule.** Shuttering left in position SO DESCRIBED.

### C4.6

**What POMI says.**

> Shuttering to curved, conical and spherical surfaces shall each be so described.

**Unit.** `—` — no arithmetic — a descriptive, definitional or administrative rule

**The formula.** None — this clause carries no arithmetic.

**The rule.** Curved, conical and spherical shuttering EACH SO DESCRIBED — described, not uplifted.

### C4.7

**What POMI says.**

> Shuttering to provide a special finish shall be so described.

**Unit.** `—` — no arithmetic — a descriptive, definitional or administrative rule

**The formula.** None — this clause carries no arithmetic.

**The rule.** Shuttering for a special finish SO DESCRIBED.

### C4.8

**What POMI says.**

> Unless otherwise stated, if the volume of concrete has not been deducted, shuttering to the faces of a void shall be understood to be included.

**Unit.** `RULE` — governs how OTHER quantities are calculated

**The formula.**

```
if V_concrete NOT deducted → shuttering to the void DEEMED INCLUDED
```

**The rule.** Pairs with C1.3. Deduct neither or both, never one.

## C5  Precast concrete

### C5.1

**What POMI says.**

> Moulds for precast units shall be understood to be included.

**Unit.** `—` — no arithmetic — a descriptive, definitional or administrative rule

**The formula.** None — this clause carries no arithmetic.

**The rule.** Moulds for precast units DEEMED INCLUDED. Never a separate item.

### C5.2

**What POMI says.**

> Reinforcement shall be measured in accordance with clause C3 and given under an appropriate heading; alternatively, it may be described in the item.

**Unit.** `KG` — by weight, kilogrammes

**The formula.**

```
per C3
```

**The rule.** Precast reinforcement under a heading, or described in the item.

### C5.3

**What POMI says.**

> Floor slabs, partition slabs or the like shall be measured by area. .'

**Unit.** `M2` — by area, square metres

**The formula.**

```
A = Σ A
```

**The rule.** Precast floor slabs, partition slabs.

### C5.4

**What POMI says.**

> Lintels, sills, duct covers or the like shall be measured by length; alternatively, duct covers may be measured by area.

**Unit.** `M` — by length, metres

**The formula.**

```
L = Σ L
```

**The rule.** Lintels, sills, duct covers. Duct covers ALTERNATIVELY by area.

### C5.5

**What POMI says.**

> Structural units (for example, beams, stanchions, tunnel rings) shall be enumerated.

**Unit.** `NR` — enumerated — a count

**The formula.**

```
N = count
```

**The rule.** Precast structural units — beams, stanchions, tunnel rings.

### C5.6

**What POMI says.**

> Padstones, cappings or the like shall be enumerated.

**Unit.** `NR` — enumerated — a count

**The formula.**

```
N = count
```

**The rule.** Padstones, cappings.

## C6  Prestressed concrete

### C6.1

**What POMI says.**

> Prestressed concrete work shall be given under an appropriate heading.

**Unit.** `—` — no arithmetic — a descriptive, definitional or administrative rule

**The formula.** None — this clause carries no arithmetic.

**The rule.** Prestressed work under its own heading.

### C6.2

**What POMI says.**

> Prestressed concrete shall be measured by volume, classified in accordance with clause C2.

**Unit.** `M3` — by volume, cubic metres

**The formula.**

```
V per C2 classes
```

**The rule.** Prestressed concrete by volume.

### C6.3

**What POMI says.**

> Reinforcement shall be measured in accordance with clause C3; supporting steel wires or cables shall be measured by weight.

**Unit.** `KG` — by weight, kilogrammes

**The formula.**

```
per C3; supporting wires/cables BY WEIGHT
```

**The rule.** Prestressing reinforcement.

### C6.4

**What POMI says.**

> Shuttering shall be measured in accordance with clause C4, stating whether to pre-tensioned or post-tensioned members.

**Unit.** `M2` — by area, square metres

**The formula.**

```
per C4
```

**The rule.** Prestressed shuttering, STATING pre-tensioned or post-tensioned.

## C7  Sundries

### C7.1

**What POMI says.**

> Surfaces finished to falls or cross-falls shall be measured by area.

**Unit.** `M2` — by area, square metres

**The formula.**

```
A = Σ A
```

**The rule.** Surfaces finished to falls or cross-falls.

### C7.2

**What POMI says.**

> Surface finishes shall be measured by area, except that tamped finishes shall be understood to be included.

**Unit.** `M2` — by area, square metres

**The formula.**

```
A = Σ A
```

**The rule.** Surface finishes — EXCEPT tamped, which is deemed included per C1.4.

### C7.3

**What POMI says.**

> Expansion material or the like shall be measured by area.

**Unit.** `M2` — by area, square metres

**The formula.**

```
A = Σ A
```

**The rule.** Expansion material.

### C7.4

**What POMI says.**

> Designed joints, water stops, cast-in channels or the like shall be measured by length.

**Unit.** `M` — by length, metres

**The formula.**

```
L = Σ L
```

**The rule.** Designed joints, water stops, cast-in channels.

### C7.5

**What POMI says.**

> Forming sinkings, channels or the like shall be measured by length and, where appropriate, the item may include additional excavation, hardcore, shuttering and concrete; alternatively, they may be enumerated.

**Unit.** `M / NR`

**The formula.**

```
L = Σ L, or N = count
```

**The rule.** Sinkings and channels. The item MAY include additional excavation, hardcore, shuttering and concrete.

### C7.6

**What POMI says.**

> Fixings, ties, inserts or the like shall be enumerated; alternatively, they may be measured by area.

**Unit.** `NR / M2`

**The formula.**

```
N = count, or A = Σ A
```

**The rule.** Fixings, ties, inserts.

### C7.7

**What POMI says.**

> Mortices, holes or the like shall be understood to be included.

**Unit.** `—` — no arithmetic — a descriptive, definitional or administrative rule

**The formula.** None — this clause carries no arithmetic.

**The rule.** Mortices and holes DEEMED INCLUDED. Measure nothing.

# SECTION D — MASONRY

*5 groups · 10 clauses · 8 carrying arithmetic*

## How this section is TAKEN OFF

**The spec row says what the thing is**

```
{thickness} {block type} — e.g. '200 mm thick hollow block partition, {type ref}'
```

**The dimension rows narrate the calculation**

```
{Location} blockwork: wall length {L} m x {h} m clear height
Deduct openings: {n} nr x {w} m x {h} m
```

**The arithmetic.** Qty each = G*I. Openings are a SEPARATE NEGATIVE row, never netted silently.

⚠ Deductions get their own row. GP3.2/GP3.3 make the deduction a decision — over or under 1.00 m2, interior or at an edge — and a decision that leaves no row cannot be checked. Where the cavity-wall method (D2.1 cl.3) is composite, say so on the spec row.

## How this section is MARKED UP

| | |
|---|---|
| **Trade colour** | orange |
| **Primitive** | AREA — walls marked in ELEVATION, not in plan |
| **Call-out tag** | `D-{serial}  {qty} m2`, thickness stated |

**What carries a mark.** every wall run as a shaded elevation with its thickness in the label; openings marked as their own negative shade so the deduction is visible.

⚠ **Mark the openings.** GP3.2/GP3.3 make each deduction a decision — over or under 1.00 m², interior or at an edge — and a decision with no mark cannot be reviewed. Where the cavity-wall composite method (D2.1 cl.3) is in force, ONE shade covers the whole build-up; where the skins are measured separately, each skin gets its own shade. Never both on one wall.

## How this section is BILLED

| | |
|---|---|
| **Closing formula** | Family 1 |
| | `… complete in accordance with the Specifications and Drawings` |
| **Variants vary by** | THICKNESSES and block types |
| **Element heading** | Walls |

**The description block**

```
Precast concrete block, bedded and jointed in cement mortar including wall ties, bed,
joints, reinforcement, head restraint, ties and anchors including wall head, vertical
and base, joints, filler, sealant and grouting complete in accordance with the
Specifications and Drawings
```

**The priced variants under it**

```
Hollow Block Walls

A   Walls, 100mm thick, type {ref}                           34   m2   …

B   Walls, 150mm thick, type {ref}                           24   m2   …

C   Walls, 200mm thick, type {ref}                           46   m2   …
```

**What POMI forces into the wording in this section**

- GP5.3 — thickness stated on every area item.
- D2.1 cl.2 — walls built against other construction SO DESCRIBED.
- D2.1 cl.3 — where the COMPOSITE method is used the description carries the whole build-up ('100 + 50 cavity + 100'); where the SEPARATE method is used each skin and the cavity is its own description. STATE WHICH METHOD IS IN FORCE in the preambles.
- D2.2 — faced or fair faced SO DESCRIBED, stating one side or both.

⚠ The one-line sub-heading between the block and the variants ('Hollow Block Walls', 'Solid Block Walls') is optional but common here, and verify_template.py looks PAST it when testing that a run of variants has a description above it.

## D1  Generally

### D1.1

**What POMI says.**

> Sloping, battering and curved work shall each be so described.

**Unit.** `—` — no arithmetic — a descriptive, definitional or administrative rule

**The formula.** None — this clause carries no arithmetic.

**The rule.** Sloping, battering and curved work EACH SO DESCRIBED.

### D1.2

**What POMI says.**

> Reinforced masonry shall be so described.

**Unit.** `—` — no arithmetic — a descriptive, definitional or administrative rule

**The formula.** None — this clause carries no arithmetic.

**The rule.** Reinforced masonry SO DESCRIBED.

## D2  Walls and piers

### D2.1

**What POMI says.**

> Walls and piers shall be measured by area, classified as follows: 1. Walls; integral piers shall be measured as walls of combined pier and wall thickness 2. Walls built against other construction 3. Cavity walls measured as a composite item, including skins and cavity; alternatively, the skins and cavity may each be measured by area. Closing cavity walls at ends or around openings shall be understood to be included 4. Isolated piers.

**Unit.** `M2` — by area, square metres

**The formula.**

```
A = Σ (L × H) − voids per GP3.2/GP3.3
```

**The rule.** Walls and piers, FOUR classes. cl.1 INTEGRAL PIERS measured as WALLS at the COMBINED pier+wall thickness. cl.2 walls built against other construction, SO DESCRIBED. cl.3 CAVITY WALLS — POMI permits EITHER one composite item including skins and cavity, OR the skins and cavity EACH measured by area. HOUSE DEFAULT: THE COMPOSITE ITEM, one area at one description carrying the whole build-up, because it prices as one operation. State it in the preambles. What is wrong is MIXING the two methods in one bill. CLOSING CAVITY WALLS at ends and around openings is DEEMED INCLUDED under either method. cl.4 isolated piers.

### D2.2

**What POMI says.**

> Faced or fair faced work shall each be so described; alternatively, it may be measured as extra over walls, stating whether faced or fair faced on one or both sides (that is, the area of faced or fair faced work shall be measured but no deduction shall be made from the area of walling on which the faced or fair faced work occurs).

**Unit.** `M2` — by area, square metres

**The formula.**

```
A_wall = FULL area, UNCHANGED
A_faced = measured AS WELL
```

**The rule.** Faced or fair faced work: POMI permits EITHER each SO DESCRIBED as its own wall item, OR measured as EXTRA OVER walls. HOUSE DEFAULT: EXTRA OVER — the wall area stays whole and the faced area is measured AS WELL, STATING WHETHER ONE SIDE OR BOTH. NO DEDUCTION is made from the walling on which the faced work occurs; deducting it loses the base item, which is the same error as B8.5 rock, B15.2 rock boring and G2.3 special sheets. 'One side or both' is a MANDATORY STATEMENT — fair faced both sides is twice the work at the same wall area.

## D3  Sills, etc.

### D3.1

**What POMI says.**

> Sills, copings, oversailing or receding courses or the like shall be measured by length.

**Unit.** `M` — by length, metres

**The formula.**

```
L = Σ L
```

**The rule.** Sills, copings, oversailing or receding courses.

### D3.2

**What POMI says.**

> Arches shall be measured by length.

**Unit.** `M` — by length, metres

**The formula.**

```
Len = Σ L
```

**The rule.** Arches BY LENGTH. THAT IS THE WHOLE CLAUSE — POMI states no basis along which the length is taken. HOUSE EXTENSION under GP1.1, declared: the length is taken on the MEAN GIRTH, L = π × (R_intrados + t/2) × (θ/180) for a curved arch, because the mean girth is the line the work actually follows and both the span and the intrados understate it. This is the HOUSE's basis, not POMI's, and it is recorded in the Appendix under GP1.2. GP5.2 separately requires the cross-sectional size or girth to be STATED in the description.

## D4  Reinforcement

### D4.1

**What POMI says.**

> Reinforcement shall be measured in accordance with clause C3; alternatively, fabric reinforcement may be measured by length.

**Unit.** `KG / M2 / M`

**The formula.**

```
bar: per C3 by weight
fabric: per C3 by area, OR by LENGTH
```

**The rule.** Reinforcement measured in accordance with Section C — so C3.1's net-weight rule applies, and with it the house rule that bar is MEASURED FROM THE SECTION DRAWINGS with laps taken at the specified lap length. D4.1 additionally permits BED-JOINT FABRIC to be measured BY LENGTH instead of by area. HOUSE DEFAULT: BY LENGTH, which is the natural unit for brick-force in a bed joint. Choose one and hold it across the bill.

## D5  Sundries

### D5.1

**What POMI says.**

> Concrete filling to cavities shall be measured by area.

**Unit.** `M2` — by area, square metres

**The formula.**

```
A = Σ A
```

**The rule.** Concrete filling to cavities — BY AREA, thickness in the description per GP5.3. Not by volume.

### D5.2

**What POMI says.**

> Expansion joints or the like shall be measured by length.

**Unit.** `M` — by length, metres

**The formula.**

```
L = Σ L
```

**The rule.** Expansion joints.

### D5.3

**What POMI says.**

> Air bricks or the like shall be enumerated.

**Unit.** `NR` — enumerated — a count

**The formula.**

```
N = count
```

**The rule.** Air bricks.

# SECTION E — METALWORK

*3 groups · 11 clauses · 8 carrying arithmetic*

## How this section is TAKEN OFF

**The spec row says what the thing is**

```
{member class} {grade} — e.g. 'Structural steel beams, grade {grade}'
```

**The dimension rows narrate the calculation**

```
{Class}: {n} nr x {L} m x {kg/m} kg/m
Roof trusses; {n} nr: {L} m x {kg/m} kg/m
```

**The arithmetic.** Qty each = the unit mass x length. The UNIT WEIGHT is shown in the narration because GP5.4 makes it a mandatory statement.

⚠ E2.1 cl.4 and cl.5 require the NUMBER as well as the weight, so the number goes in the narration and in the bill description. Weight is NET — no rolling margin, no welding material, no deduction for holes.

## How this section is MARKED UP

| | |
|---|---|
| **Trade colour** | dark grey |
| **Primitive** | LINEAR along each member · TAG for trusses, portal frames and isolated units |
| **Call-out tag** | `E-{serial}  {qty} kg` — with the unit weight in the label, per GP5.4 |

**What carries a mark.** every beam, stanchion and grillage traced as a polyline with its section size in the label; each truss and portal frame tagged, because E2.1 cl.4 and cl.5 require the NUMBER.

⚠ **The mark is a LENGTH but the quantity is a WEIGHT.** Closure multiplies the traced length by the stated unit mass, so the unit mass must be on the tag. A steel mark with no kg/m cannot be closed.

## How this section is BILLED

| | |
|---|---|
| **Closing formula** | Family 1 |
| | `… complete in accordance with the Specifications and Drawings` |
| **Variants vary by** | member type and, where relevant, the number |
| **Element heading** | Structural Steelwork |

**The description block**

```
Structural steelwork grade {grade}, fabricated, delivered and erected, including all
cutting, drilling, welding, bolting, splice plates, cleats, base plates, holding down
bolts, shop priming and protective treatment, complete in accordance with the
Specifications and Drawings
```

**The priced variants under it**

```
A   Beams                                              14,280   kg   …

B   Stanchions                                          8,940   kg   …

C   Roof trusses; 12 nr                                11,600   kg   …
```

**What POMI forces into the wording in this section**

- GP5.4 — weight items STATE the material thickness and unit weight where appropriate.
- E2.1 cl.4 — portal frames STATE THE NUMBER.
- E2.1 cl.5 — roof trusses STATE THE NUMBER.
- E1.1 — the weight is NET: no rolling margin, no welding material, no deduction for holes, splay cuts or notches. The words may list them as included; the number never carries them.

⚠ Classes 4 and 5 carry a NUMBER as well as a weight, and the number belongs in the variant line, not in a separate item.

## E1  Generally

### E1.1

**What POMI says.**

> The weight of metalwork shall be the net weight, without addition for rolling margin or welding material and without deduction for holes, splay cuts, notches or the like.

**Unit.** `KG` — by weight, kilogrammes

**The formula.**

```
W = Σ (N × L_gross × m_per_m(section))
```

**The rule.** THE NET WEIGHT RULE, and it cuts BOTH ways. NO ADDITION for rolling margin or welding material — a fabricator's own tonnage adds both, because that is what he buys and consumes, and both are RATE matters under GP4.1. NO DEDUCTION for holes, splay cuts, notches or the like — a careful measurer deducts them because they are visibly not steel, and POMI forbids that too. The two errors pull in opposite directions and partially cancel, so a wrong figure can foot to about the right total, which is exactly why neither gets caught. It is the GROSS SECTION over the GROSS LENGTH: a beam notched at both ends and drilled for twelve bolts is still its full length at its full unit mass.

### E1.2

**What POMI says.**

> Welded, riveted or bolted work shall each be so described.

**Unit.** `—` — no arithmetic — a descriptive, definitional or administrative rule

**The formula.** None — this clause carries no arithmetic.

**The rule.** Welded, riveted or bolted work EACH SO DESCRIBED.

## E2  Structural metalwork

### E2.1

**What POMI says.**

> Unless otherwise stated, structural metalwork shall be measured by weight, classified as follows: 1. Grillages 2. Beams 3. Stanchions 4. Portal frames, stating the number 5. Roof trusses, stating the number 6. Support steelwork, which shall include sheeting rails, braces, struts or the like 7. Other classifications, as may be appropriate.

**Unit.** `KG` — by weight, kilogrammes

**The formula.**

```
W = Σ N × L × m_per_m, per class
```

**The rule.** Structural metalwork by WEIGHT, SEVEN classes: 1 GRILLAGES · 2 BEAMS · 3 STANCHIONS · 4 PORTAL FRAMES, STATING THE NUMBER · 5 ROOF TRUSSES, STATING THE NUMBER · 6 SUPPORT STEELWORK, which INCLUDES sheeting rails, braces, struts or the like · 7 other classifications. Classes 4 and 5 carry a mandatory NUMBER as well as the weight.

### E2.2

**What POMI says.**

> Fittings (for example, caps, brackets) shall be given as an item.

**Unit.** `ITEM` — an ITEM — a priced line with no quantity

**The formula.** None — this clause carries no arithmetic.

**The rule.** Fittings — caps, brackets. An ITEM, not weight.

### E2.3

**What POMI says.**

> Fixings (for example, bolts, distance pieces, rivets) shall be given as an item.

**Unit.** `ITEM` — an ITEM — a priced line with no quantity

**The formula.** None — this clause carries no arithmetic.

**The rule.** Fixings — bolts, distance pieces, rivets. An ITEM, not weight.

### E2.4

**What POMI says.**

> Wedging and grouting bases or the like shall be enumerated.

**Unit.** `NR` — enumerated — a count

**The formula.**

```
N = count
```

**The rule.** Wedging and grouting bases.

### E2.5

**What POMI says.**

> Holding down bolts or the like shall be enumerated; temporary boxes and grouting shall be understood to be included.

**Unit.** `NR` — enumerated — a count

**The formula.**

```
N = count
```

**The rule.** Holding-down bolts. TEMPORARY BOXES AND GROUTING DEEMED INCLUDED.

### E2.6

**What POMI says.**

> Protective treatment shall be given as an item.

**Unit.** `M2` — by area, square metres

**The formula.**

```
A = Σ A_treated_surface
```

**The rule.** Protective treatment. POMI SAYS AN ITEM. HOUSE AMENDMENT, DECLARED UNDER GP1.2 AND RECORDED IN POMI'S APPENDIX: it is MEASURED BY AREA. The treated surface is the cost driver — a galvanising or intumescent system prices per square metre, and the surface area of a tonne of steel varies several-fold between a heavy stanchion and a light truss. An item forces the tenderer to compute that area himself and price a risk he cannot see, and it cannot be valued on variation. The AREA is measured; the SYSTEM stays in the description. Surface area is the developed girth of the section times its length, plus the area of any plates and cleats.

## E3  Non-structural metalwork

### E3.1

**What POMI says.**

> Floor plates, duct covers, sheet metal coverings and linings or the like shall be measured by area.

**Unit.** `M2` — by area, square metres

**The formula.**

```
A = Σ A
```

**The rule.** Floor plates, duct covers, sheet coverings and linings.

### E3.2

**What POMI says.**

> Bearers, balustrades, handrails (except where included with a staircase), frames or the like shall be measured by length.

**Unit.** `M` — by length, metres

**The formula.**

```
Len = Σ L
```

**The rule.** Bearers, balustrades, handrails, frames BY LENGTH. POMI's exception reads 'except where included with a staircase'. HOUSE ELECTION: THE HANDRAIL IS A SEPARATE LENGTH ITEM and the enumerated staircase under E3.3 is DESCRIBED AS EXCLUDING IT. This is within the clause — the handrail is only inside the staircase where the bill puts it there — and it prices the two properly, because a balustrade is a different trade and a different rate from the stair. THE STAIRCASE DESCRIPTION MUST SAY 'excluding handrail', or the two readings collide and the handrail is billed twice or not at all.

### E3.3

**What POMI says.**

> Matwell frames, cat ladders, gates, staircases or the like shall be enumerated.

**Unit.** `NR` — enumerated — a count

**The formula.**

```
N = count
```

**The rule.** Matwell frames, cat ladders, gates and STAIRCASES ENUMERATED — never weighed, never measured by rise. GP5.1 governs: there is no dimension carrying information, so the words carry all of it. Under the house election at E3.2 the staircase is DESCRIBED AS EXCLUDING THE HANDRAIL, which is measured separately by length.

# SECTION F — WOODWORK

*10 groups · 22 clauses · 17 carrying arithmetic*

## How this section is TAKEN OFF

**The spec row says what the thing is**

```
{cross-section} {grade} {treatment} — e.g. '50 x 200 mm sawn softwood, {grade}, pressure impregnated'
```

**The dimension rows narrate the calculation**

```
{Class}: {n} nr x {L} m at {spacing} centres
Open-spaced boarding: overall area {A} m2, {spacing} centres
```

**The arithmetic.** Qty each = F*G for members; = G*H for open-spaced boarding, which is measured on the OVERALL AREA covered.

⚠ The cross-section lives in the spec row and never enters the arithmetic — F is billed by LENGTH. F4.1 open-spaced work is the exception that changes unit mid-section, so the narration must say 'overall area' explicitly.

## How this section is MARKED UP

| | |
|---|---|
| **Trade colour** | tan |
| **Primitive** | LINEAR for structural timbers · AREA for open-spaced boarding and battens |
| **Call-out tag** | `F-{serial}  {qty} m` — cross-section stated, per GP5.2 |

**What carries a mark.** every joist, rafter, plate and bearer traced as a polyline with its cross-section in the label; open-spaced boarding shaded as the OVERALL AREA it covers.

⚠ **F4.1 open-spaced work changes primitive mid-section.** Battens at centres are an AREA shade over the whole surface, not a polyline per batten — measuring them as timber lengths over-measures by two to three times, and the mark is where that error becomes visible.

## How this section is BILLED

| | |
|---|---|
| **Closing formula** | Family 2 |
| | `… in accordance with the {design standard document}, Specifications and Drawings` |
| **Variants vary by** | cross-sectional sizes and grades |
| **Element heading** | Carpentry |

**The description block**

```
Sawn softwood, {grade}, pressure impregnated, including all cutting, notching, boring,
fixing and jointing, in accordance with the {design standard document}, Specifications
and Drawings
```

**The priced variants under it**

```
A   Floors and flat roofs; 50 x 200mm                       186   m    …

B   Pitched roofs; 50 x 150mm                                242   m    …

C   Walls; 50 x 100mm                                         98   m    …
```

**What POMI forces into the wording in this section**

- GP5.2 — every LENGTH item states the CROSS-SECTIONAL SIZE AND SHAPE.
- F2.1 — the five classes are by WHERE the timber is (floors and flat roofs, pitched roofs, walls, kerbs and bearers, cleats and sprockets), not by what it is.
- F4.1 — open-spaced boarding and battens are measured by the OVERALL AREA covered and SO DESCRIBED, stating the spacing.

⚠ The cross-section goes in the WORDS and never into the number. A 50 x 200 joist is billed by LENGTH at that description — it is not converted to a volume, and the section size is a POMI mandatory statement, not a courtesy.

## F1  Generally

### F1.1

**What POMI says.**

> Timber which is sawn (that is, not milled) and timber which is finished (that is, milled) shall each be so described.

**Unit.** `—` — no arithmetic — a descriptive, definitional or administrative rule

**The formula.** None — this clause carries no arithmetic.

**The rule.** SAWN (not milled) and FINISHED (milled) timber EACH SO DESCRIBED.

### F1.2

**What POMI says.**

> Descriptions of timber members shall state whether the sizes are basic (that is, before machining) or finished (that is, milled, within permitted deviations).

**Unit.** `RULE` — governs how OTHER quantities are calculated

**The formula.** None — this clause carries no arithmetic.

**The rule.** Descriptions SHALL STATE whether sizes are BASIC (before machining) or FINISHED (milled, within permitted deviations). HOUSE RULE: FOLLOW THE PROJECT DESCRIPTION — take whichever basis the specification and drawings use and state it; do not convert one to the other and do not assume a house default. The statement is mandatory, its VALUE comes from the source documents. This matters commercially: a '50 x 200' quoted BASIC finishes at about 45 x 195 after machining — same words, different timber, different price. An F item with no basic/finished statement is incomplete under GP5, and it is the most-missed mandatory statement in the section because the size looks complete on its own.

## F2  Structural timbers

### F2.1

**What POMI says.**

> Structural timbers shall be measured by length, classified as follows: 1. Floors and flat roofs 2. Pitched roofs 3. Walls 4. Kerbs, bearers or the like 5. Cleats, sprockets or the like.

**Unit.** `M` — by length, metres

**The formula.**

```
L = Σ N × L, per class
```

**The rule.** Structural timbers by LENGTH, FIVE classes by WHERE THE TIMBER IS, not what it is: 1 FLOORS AND FLAT ROOFS · 2 PITCHED ROOFS · 3 WALLS · 4 KERBS, BEARERS or the like · 5 CLEATS, SPROCKETS or the like. Cross-sectional size goes in the description per GP5.2 — it is never turned into a volume.

### F2.2

**What POMI says.**

> Strutting and bridging between joists shall be measured by length, taken overall the joists.

**Unit.** `M` — by length, metres

**The formula.**

```
Len = Σ L, TAKEN OVERALL THE JOISTS
```

**The rule.** Strutting and bridging between joists BY LENGTH, TAKEN OVERALL THE JOISTS — the full width of the floor in one measurement, NOT the sum of the individual struts between each pair. A herringbone run across nine joists is one length across the whole span. Measuring strut by strut is the same over-measure as measuring open-spaced battens individually under F4.1.

## F3  Boarding and flooring

### F3.1

**What POMI says.**

> Unless otherwise stated, boarding and flooring shall be measured by area, without addition for joints or laps, classified as follows: 1. Floors, which shall include landings 2. Walls, which shall include returns, reveals of openings or recesses and attached and unattached columns 3. Ceilings, which shall include attached and unattached beams and soffits of staircases 4. Roofs, which shall include tops and cheeks of dormers and sides and bottoms of gutters, stating whether flat, sloping or vertical; firring pieces and bearers shall be understood to be included.

**Unit.** `M2` — by area, square metres

**The formula.**

```
A = Σ (L × W) − voids, NO laps or joints
```

**The rule.** Boarding and flooring, four classes. cl.2 walls INCLUDE returns, reveals and attached AND unattached columns. cl.3 ceilings INCLUDE beams and staircase soffits. cl.4 roofs INCLUDE dormers and gutters; FIRRINGS AND BEARERS DEEMED INCLUDED; state flat, sloping or vertical.

### F3.2

**What POMI says.**

> Eaves and verge boards, which shall include fascias, barge boards or the like, shall be measured by length.

**Unit.** `M` — by length, metres

**The formula.**

```
L = Σ L
```

**The rule.** Eaves and verge boards — INCLUDE fascias and barge boards.

### F3.3

**What POMI says.**

> Fillets and rolls shall be measured by length.

**Unit.** `M` — by length, metres

**The formula.**

```
L = Σ L
```

**The rule.** Fillets and rolls.

## F4  Grounds and battens

### F4.1

**What POMI says.**

> Open-spaced grounds and battens shall be measured by area, taken overall.

**Unit.** `M2` — by area, square metres

**The formula.**

```
A = Σ A, TAKEN OVERALL the surface covered
```

**The rule.** OPEN-SPACED grounds and battens BY AREA TAKEN OVERALL — not by the length of the timber. Battens at 400 mm centres over a 6.00 x 4.00 m wall are 24.00 m2, NOT 15 x 4.00 m = 60 m. Different unit AND two to three times the magnitude. The test is one word, OPEN-SPACED: a run of battens at centres over a surface is open-spaced and goes to area; a single ground round a door opening is individual and goes to F4.2 by length.

### F4.2

**What POMI says.**

> Individual grounds and battens shall be measured by length.

**Unit.** `M` — by length, metres

**The formula.**

```
L = Σ L
```

**The rule.** INDIVIDUAL grounds and battens.

## F5  Framework

### F5.1

**What POMI says.**

> Framework shall be measured by area, taken overall; alternatively, it may be measured by length.

**Unit.** `M2` — by area, square metres

**The formula.**

```
A = Σ A, TAKEN OVERALL
```

**The rule.** Framework. POMI permits AREA TAKEN OVERALL or, expressly, by LENGTH, with no preference. HOUSE ELECTION: AREA TAKEN OVERALL, matching F4.1's treatment of open-spaced work — a stud framework is a surface, and measuring the studs by length over-measures for the same reason battens do. Hold it across the whole bill: a framework in m2 on one elevation and m on the next cannot be summed or checked.

## F6  Finishings and fittings

### F6.1

**What POMI says.**

> Finishings shall be measured by length, classified as follows: 1. Cover fillets, which shall include architraves, skirtings or the like 2. Beads, which shall include stops or the like 3. Edgings, which shall include window boards, nosings or the like.

**Unit.** `M` — by length, metres

**The formula.**

```
L = Σ L, per class
```

**The rule.** Finishings: 1 cover fillets (incl. architraves, skirtings) · 2 beads (incl. stops) · 3 edgings (incl. window boards, nosings).

### F6.2

**What POMI says.**

> Unless otherwise stated, fittings shall be measured by length, classified as follows: 1. Work tops, which shall include seats or the like 2. Handrails or balustrades.

**Unit.** `M` — by length, metres

**The formula.**

```
L = Σ L, per class
```

**The rule.** Fittings: 1 work tops (incl. seats) · 2 handrails/balustrades.

### F6.3

**What POMI says.**

> Shelving shall be measured by area; alternatively, it may be measured by length.

**Unit.** `M` — by length, metres

**The formula.**

```
Len = Σ L
```

**The rule.** Shelving. POMI permits AREA or, expressly, LENGTH. HOUSE ELECTION: BY LENGTH, because shelving is bought and fixed by the running metre at a stated depth. The DEPTH then goes in the description under GP5.2 as the cross-sectional size — a length item with no depth stated is incomplete.

### F6.4

**What POMI says.**

> Backboards or the like shall be enumerated.

**Unit.** `NR` — enumerated — a count

**The formula.**

```
N = count
```

**The rule.** Backboards.

### F6.5

**What POMI says.**

> Built-up members shall be so described.

**Unit.** `—` — no arithmetic — a descriptive, definitional or administrative rule

**The formula.** None — this clause carries no arithmetic.

**The rule.** Built-up members SO DESCRIBED.

### F6.6

**What POMI says.**

> Plastic coverings or the like shall be described with the item on which they occur, stating whether on one or more faces; alternatively, they may be measured separately by area.

**Unit.** `—` — no arithmetic — a descriptive, definitional or administrative rule

**The formula.** None — this clause carries no arithmetic.

**The rule.** Plastic coverings. POMI's PRIMARY limb is DESCRIPTION — described WITH THE ITEM on which they occur, STATING WHETHER ON ONE OR MORE FACES — with separate measurement by area as the express alternative. HOUSE ELECTION: DESCRIBED WITH THE ITEM. A laminated worktop is a worktop described as laminated on the top and front edge; the plastic is not a separate area. 'ONE OR MORE FACES' IS A MANDATORY STATEMENT either way — it is the difference between one face and four at the same running length.

### F6.7

**What POMI says.**

> Sheet linings shall be measured by area, classified as follows: 1. Walls, which shall include returns, reveals of openings or recesses and attached and unattached columns 2. Ceilings, which shall include attached and unattached beams and soffits of staircases.

**Unit.** `M2` — by area, square metres

**The formula.**

```
A = Σ A, per class
```

**The rule.** Sheet linings: walls (incl. returns, reveals, columns) · ceilings (incl. beams, staircase soffits) · other.

## F7  Composite items

### F7.1

**What POMI says.**

> Unless otherwise stated, composite items (which shall mean items which might be fabricated off-site whether or not they are fabricated off-site) shall be enumerated; all metal work or the like shall be understood to be included.

**Unit.** `NR` — enumerated — a count

**The formula.**

```
N = count
```

**The rule.** Composite items — those which MIGHT be fabricated off-site, whether or not they are. ALL METALWORK DEEMED INCLUDED.

### F7.2

**What POMI says.**

> Any associated work (for example, decorations) shall be measured in accordance with the relevant sections of this document.

**Unit.** `—` — no arithmetic — a descriptive, definitional or administrative rule

**The formula.** None — this clause carries no arithmetic.

**The rule.** Associated work (e.g. decorations) to the relevant sections.

## F8  Sundry items

### F8.1

**What POMI says.**

> Finished surfaces on sawn items shall be measured by length.

**Unit.** `M` — by length, metres

**The formula.**

```
L = Σ L
```

**The rule.** Finished surfaces on sawn items.

## F9  Metalwork

### F9.1

**What POMI says.**

> Metalwork items associated with woodwork shall be enumerated; alternatively, waterbars or the like may be measured by length.

**Unit.** `NR / M`

**The formula.**

```
N = count; waterbars may be L = Σ L
```

**The rule.** Metalwork associated with woodwork.

## F10  Ironmongery

### F10.1

**What POMI says.**

> Units or sets of ironmongery shall be enumerated.

**Unit.** `NR` — enumerated — a count

**The formula.**

```
N = count of SETS
```

**The rule.** Units or SETS of ironmongery ENUMERATED. WORD-FOR-WORD IDENTICAL TO H4.1. HOUSE ELECTION: NOT USED — all ironmongery, including ironmongery to timber doors, is billed under H4.1 so that every set sits in one place. Retained here because POMI carries it; a run that measures against F10.1 has split the ironmongery across two bills and will double-count the sets.

# SECTION G — THERMAL AND MOISTURE PROTECTION

*4 groups · 7 clauses · 6 carrying arithmetic*

## How this section is TAKEN OFF

**The spec row says what the thing is**

```
{system} {layers} {thickness} — e.g. '{membrane} waterproofing, {n} layers, {t} mm'
```

**The dimension rows narrate the calculation**

```
Flat coverings: {A} m2 on plan
Sloping coverings: {A_plan} m2 on plan / cos {theta} = {A_slope} m2 ON SLOPE
Vertical coverings: {L} m x {h} m upstand
```

**The arithmetic.** the SLOPING line shows the plan area, the pitch and the on-slope result — all three, on one row.

⚠ G2.1's three classes are three separate rows, and the sloping one must SHOW the correction. A 30 degree roof taken on plan is 13.4% short, and the only way a checker sees it was done is if the division appears in the narration.

## How this section is MARKED UP

| | |
|---|---|
| **Trade colour** | purple |
| **Primitive** | AREA — and the SLOPING areas marked on the roof plan but labelled ON SLOPE |
| **Call-out tag** | `G-{serial}  {qty} m2` — and on a sloping area the label carries BOTH the plan area and the pitch, e.g. `412 m2 plan / 30° = 476 m2` |

**What carries a mark.** each covering as a shaded polygon, in three separate classes — flat, sloping, vertical — with upstands and downstands traced as polylines where they are measured by length.

⚠ **A sloping roof is drawn on plan and measured on slope, so the mark and the quantity legitimately differ.** The label must show the correction or the closure test will read a correct take-off as a 13.4% over-measure. This is the one section where the geometry on the sheet is NOT the quantity, and the tag has to say so.

## How this section is BILLED

| | |
|---|---|
| **Closing formula** | Family 1 |
| | `… complete in accordance with the Specifications and Drawings` |
| **Variants vary by** | membrane type, number of layers, and thickness |
| **Element heading** | Waterproofing |

**The description block**

```
{Membrane type} waterproofing system, including primer, all laps, joints, angle
fillets, upstands, downstands, dressing into outlets, protection board and all
necessary works, complete in accordance with the Specifications and Drawings
```

**The priced variants under it**

```
A   Flat coverings, horizontal                              862   m2   …

B   Sloping coverings, measured on the slope                 314   m2   …

C   Vertical coverings                                       128   m2   …
```

**What POMI forces into the wording in this section**

- GP5.3 — thickness stated.
- G2.1 — flat, sloping and vertical are THREE SEPARATE CLASSES and are billed as three lines. Sloping is measured ON THE SLOPE.
- G3.1 — damp-proof courses STATE THE WIDTH (GP5.2).
- G2.3 — where the EXTRA OVER route is used for special sheets, the description says 'extra over' and NO DEDUCTION is made from the roofing.

⚠ G is the section where the words and the number diverge most dangerously. 'Including all laps' is correct wording under GP4.1 — and the AREA is still measured flat, without laps, under G1.1. The description promising laps does not license adding them.

## G1  Generally

### G1.1

**What POMI says.**

> Work shall be measured flat without addition for laps or seams.

**Unit.** `RULE` — governs how OTHER quantities are calculated

**The formula.**

```
A = A_covered, NO laps or seams
```

**The rule.** Measured FLAT. Lap material is a rate cost — typically +8 to +12% of a roof if wrongly added.

### G1.2

**What POMI says.**

> Curved, spherical and conical work shall each be so described.

**Unit.** `—` — no arithmetic — a descriptive, definitional or administrative rule

**The formula.** None — this clause carries no arithmetic.

**The rule.** Curved, spherical and conical EACH SO DESCRIBED — described, not uplifted.

## G2  Coverings and linings

### G2.1

**What POMI says.**

> Unless otherwise stated, roofing, tanking, waterproof coverings, linings or the like shall be measured by area, classified as follows: 1. Flat coverings 2. Sloping coverings 3. Vertical coverings.

**Unit.** `M2` — by area, square metres

**The formula.**

```
flat: A = L × W
sloping: A = L × (W / cos θ)
vertical: A = L × H
```

**The rule.** Roofing, tanking, waterproof coverings and linings by AREA, THREE classes: 1 FLAT COVERINGS — A = L × W · 2 SLOPING COVERINGS, MEASURED ON THE SLOPE — A = L × (W / cos θ); a 30° roof taken on plan is 13.4% short · 3 VERTICAL COVERINGS — A = L × H. The class is the plane of the covering, and the slope correction belongs to class 2 alone.

### G2.2

**What POMI says.**

> Eaves, ridges, skirtings, fascias, flashings, aprons or the like shall be measured by length; alternatively, skirtings, fascias or the like to composite roofing may be measured by area.

**Unit.** `M` — by length, metres

**The formula.**

```
Len = Σ L
```

**The rule.** Eaves, ridges, skirtings, fascias, flashings and aprons BY LENGTH. POMI's express alternative permits skirtings and fascias TO COMPOSITE ROOFING to be measured by area. HOUSE ELECTION: LENGTH THROUGHOUT, so the section carries ONE trim unit rather than two. Note how narrow the alternative is in any case — skirtings and fascias ONLY, and ONLY to composite roofing. It never reaches flashings, ridges or aprons, and measuring one of those by area is outside the clause.

### G2.3

**What POMI says.**

> Roof lights, ventilators, soaker collars, special roofing sheets or the like shall be enumerated; alternatively, special roofing sheets may be measured as extra over roofing (that is, the special roofing sheets shall be measured but no deduction shall be made from the roofing in which the special sheeting occurs).

**Unit.** `NR` — enumerated — a count

**The formula.**

```
N = count
```

**The rule.** Roof lights, ventilators, soaker collars and special roofing sheets ALL ENUMERATED. POMI's express alternative permits SPECIAL SHEETS ONLY to be measured as EXTRA OVER roofing, with NO DEDUCTION from the roofing in which they occur. HOUSE ELECTION: ENUMERATE ALL FOUR — the counts are unambiguous and extra over is the limb that gets mis-applied. Note the alternative never reached roof lights, ventilators or soaker collars in any case; those are enumerated under either limb.

## G3  Damp-proof courses

### G3.1

**What POMI says.**

> Damp-proof courses shall be measured by length; alternatively, they may be measured by area.

**Unit.** `M` — by length, metres

**The formula.**

```
Len = Σ L
```

**The rule.** Damp-proof courses. POMI permits LENGTH or, expressly, AREA. HOUSE ELECTION: BY LENGTH, with the WIDTH STATED in the description under GP5.2 — a DPC is bought and laid by the roll at a stated width. A length item with no width stated is incomplete.

## G4  Insulation

### G4.1

**What POMI says.**

> Insulation shall be measured by area; alternatively, it may be described with items of composite roofing.

**Unit.** `M2` — by area, square metres

**The formula.**

```
A = Σ A
```

**The rule.** Insulation. POMI permits a measured AREA or, expressly, DESCRIPTION WITHIN items of composite roofing. HOUSE ELECTION: A SEPARATE AREA ITEM — it keeps the insulation visible and valuable on variation, where the alternative buries it in the roofing rate. THE TWO ARE MUTUALLY EXCLUSIVE: a bill carrying a composite roofing item whose description mentions insulation AND a separate insulation area has billed it twice, and the second row looks perfectly reasonable.

# SECTION H — DOORS AND WINDOWS

*6 groups · 12 clauses · 12 carrying arithmetic*

## How this section is TAKEN OFF

**The spec row says what the thing is**

```
{type ref} {size} {rating} — e.g. 'Type {ref}, {w} x {h} mm, {rating} minute fire rated'
```

**The dimension rows narrate the calculation**

```
{Type ref}: {n} nr, {location}
Irregular glazing: smallest rectangle {w} x {h} m from which cut
```

**The arithmetic.** Qty each = 1; Nr carries the count. Nothing else is calculated.

⚠ Every H item is enumerated, so GP5.1 governs: the words carry everything. H5.1 irregular glass is measured to the SMALLEST RECTANGLE from which it can be cut — the narration must say so, or the figure looks like an over-measure.

## How this section is MARKED UP

| | |
|---|---|
| **Trade colour** | red |
| **Primitive** | TAG — every item in the section is enumerated |
| **Call-out tag** | `H-{serial}  {n} nr`, with the type reference |

**What carries a mark.** a tag at every door, window, screen and rooflight on the plan; or a tag on the SCHEDULE ROW carrying the total, proved by count reconciliation.

⚠ **H closes by COUNT RECONCILIATION, not by geometry — schedule count = number of plan tags, at K18 EXACT equality.** Not ±1%. A door is a whole number and a discrepancy of one is a real discrepancy. Run `count_reconcile.py` with the schedule counts and the extracted plan tags; any mismatch fails.

## How this section is BILLED

| | |
|---|---|
| **Closing formula** | Family 1 |
| | `… complete in accordance with the Specifications and Drawings` |
| **Variants vary by** | door and window schedule references |
| **Element heading** | Doors |

**The description block**

```
{Door type} door, {leaf construction}, complete with frame, architraves, ironmongery,
vision panel, intumescent and smoke seals, finish and all necessary accessories,
complete in accordance with the Specifications and Drawings
```

**The priced variants under it**

```
A   Type D-01; 900 x 2100mm single leaf                       24   nr   …

B   Type D-02; 1800 x 2100mm double leaf                       6   nr   …

C   Type FD-1; 900 x 2100mm, 60 minute fire rated             12   nr   …
```

**What POMI forces into the wording in this section**

- GP5.1 — enumerated items shall be FULLY DESCRIBED. In H that is the whole burden: there is no dimension carrying information, so the words carry all of it.
- H5.1 — irregularly shaped glass is measured to the SMALLEST RECTANGLE from which it can be cut, and SO DESCRIBED.
- H6.1 — ironmongery classified, and fixing to a differing material SO DESCRIBED.

⚠ Every item in H is enumerated, so GP5.1 governs the whole section: the schedule reference alone is not a description. The type reference identifies WHICH door; the description says what the rate covers.

## H1  Doors

### H1.1

**What POMI says.**

> Doors shall be enumerated.

**Unit.** `NR` — enumerated — a count

**The formula.**

```
N = count
```

**The rule.** Doors.

### H1.2

**What POMI says.**

> Jambs, heads, sills, mullions, transomes or the like shall be measured by length; alternatively, frame and lining sets may be enumerated.

**Unit.** `NR` — enumerated — a count

**The formula.**

```
N = count of frame/lining SETS
```

**The rule.** Jambs, heads, sills, mullions and transomes BY LENGTH; POMI's express alternative permits FRAME AND LINING SETS to be ENUMERATED. HOUSE ELECTION: ENUMERATED SETS, matching the way door schedules are issued and keeping one line per door type. THE SET MUST BE FULLY DESCRIBED under GP5.1 — with no length, the words are the only thing saying how big it is. NOTE: the door leaf (H1.1) and its surround (H1.2) stay SEPARATE items under either limb. A single 'door complete with frame' collapses two clauses into one and neither can then be varied independently.

## H2  Windows

### H2.1

**What POMI says.**

> Windows, skylights or the like, together with their frames, shall be enumerated; sub-frames of a different material shall be separately enumerated or may be measured by length.

**Unit.** `NR` — enumerated — a count

**The formula.**

```
N = count (window INCLUDING its own frame)
```

**The rule.** Windows and skylights ENUMERATED TOGETHER WITH THEIR FRAMES — the OPPOSITE of doors, where H1.2 measures the surround separately. Same section, deliberately opposite, and it is easy to carry the door habit across. SUB-FRAMES OF A DIFFERENT MATERIAL are separately enumerated or measured by length; 'of a different material' is the whole test — an aluminium window in an aluminium sub-frame is ONE item, the same window in a TIMBER sub-frame is TWO. J6.3 cl.8 picks up the same distinction for decoration.

## H3  Screens

### H3.1

**What POMI says.**

> Screens, borrowed lights, curtain walling or the like shall be measured by area; alternatively, they may be enumerated.

**Unit.** `M2` — by area, square metres

**The formula.**

```
A = Σ (W × H)
```

**The rule.** Screens, borrowed lights and CURTAIN WALLING. POMI permits AREA or, expressly, ENUMERATION. HOUSE ELECTION: BY AREA — curtain walling prices per square metre and a '1 nr curtain wall' is unpriceable. Curtain walling belongs HERE, not in Section E as metalwork and not under H5 as glass. NO DEDUCTION is made for doors within the screen: H3.2 enumerates them AS WELL, which is extra-over logic applied to a screen.

### H3.2

**What POMI says.**

> Doors and frames within a screen shall be enumerated.

**Unit.** `NR` — enumerated — a count

**The formula.**

```
N = count
```

**The rule.** Doors and frames WITHIN a screen.

## H4  Ironmongery

### H4.1

**What POMI says.**

> Units or sets of ironmongery shall be enumerated.

**Unit.** `NR` — enumerated — a count

**The formula.**

```
N = count of SETS
```

**The rule.** Units or SETS of ironmongery ENUMERATED — sets, never pieces. A door's set (hinges, lock, lever furniture, closer, seals) is ONE unit, fully described under GP5.1; counting the hinges is counting inside the set. THIS CLAUSE IS WORD-FOR-WORD F10.1. HOUSE ELECTION: ALL IRONMONGERY IS BILLED HERE, under H4.1, regardless of whether the door is timber or metal, so F10.1 is never used. Splitting ironmongery across two sections is how sets get counted twice.

## H5  Glass

### H5.1

**What POMI says.**

> Unless otherwise stated, glass shall be measured by area; panes of irregular shape shall be measured as the smallest rectangle from which such irregular shape can be cut.

**Unit.** `M2` — by area, square metres

**The formula.**

```
regular: A = L × W
irregular: A = L_bounding × W_bounding
```

**The rule.** Glass. An IRREGULAR pane is measured as THE SMALLEST RECTANGLE it can be cut from — a 1.80 × 1.10 triangle measures 1.98 m², not 0.99.

### H5.2

**What POMI says.**

> Sealed factory-glazed units shall be enumerated.

**Unit.** `NR` — enumerated — a count

**The formula.**

```
N = count
```

**The rule.** Sealed factory-glazed units.

### H5.3

**What POMI says.**

> Glass louvres shall be enumerated; alternatively, they may be measured by length, stating the number.

**Unit.** `NR` — enumerated — a count

**The formula.**

```
N = count
```

**The rule.** Glass louvres. POMI permits ENUMERATION or, expressly, LENGTH STATING THE NUMBER. HOUSE ELECTION: ENUMERATED. Note the alternative never permits length alone — the number is mandatory under either limb.

### H5.4

**What POMI says.**

> Glass panes of special shape or with decorative treatment shall be enumerated.

**Unit.** `NR` — enumerated — a count

**The formula.**

```
N = count
```

**The rule.** Panes of special shape or with decorative treatment.

## H6  Patent glazing

### H6.1

**What POMI says.**

> Patent glazing shall be measured by area, classified as follows: 1. Roofs 2. Skylights, which shall include lantern lights 3. Vertical surfaces.

**Unit.** `M2` — by area, square metres

**The formula.**

```
A = Σ A, per class
```

**The rule.** Patent glazing: roofs · skylights (incl. lantern lights) · vertical. Sloping measured on the slope.

### H6.2

**What POMI says.**

> Opening portions shall be enumerated.

**Unit.** `NR` — enumerated — a count

**The formula.**

```
N = count
```

**The rule.** Opening portions.

# SECTION J — FINISHES

*7 groups · 16 clauses · 11 carrying arithmetic*

## How this section is TAKEN OFF

**The spec row says what the thing is**

```
{thickness} {system} {finish} — e.g. '15 mm two-coat plaster with putty finish and 2-coat {paint system}'
```

**The dimension rows narrate the calculation**

```
{Location} wall plaster: wall length {L} m x {h} m clear height
{Location} floor screed: {A} m2 ({n} units)
Suspended ceiling, drop {d} m: {A} m2
```

**The arithmetic.** Qty each = G*I for walls, direct area for floors and ceilings. Nr carries the FLOOR or UNIT count.

⚠ J3.1 cl.2 puts returns, reveals and attached AND UNATTACHED columns INSIDE the wall class — so the narration adds them as their own line rather than leaving them to be assumed. J5.1 requires the DROP on a suspended ceiling, so the drop goes in the spec row.

## How this section is MARKED UP

| | |
|---|---|
| **Trade colour** | green |
| **Primitive** | AREA for finishes · LINEAR for skirtings, coves and dividing strips |
| **Call-out tag** | `J-{serial}  {qty} m2` — and for a suspended ceiling the DROP, per J5.1 |

**What carries a mark.** floor finishes shaded on the floor plan; wall finishes shaded on ELEVATIONS or, where elevations do not exist, traced as a polyline on plan with the height in the label; ceilings shaded on the RCP; skirtings and coves traced.

⚠ **Attached and unattached columns are INSIDE the wall class under J3.1 cl.2, so they must be marked WITH the wall, not as separate items.** Two marks for a plastered column is the double count J3.1 exists to prevent. And a decoration take-off under J6.3 has TWELVE classes — cornices, general surfaces, windows, radiators, gutters, large pipes, structural metalwork — most of which are NOT on the finishes markup at all and need their own marks.

## How this section is BILLED

| | |
|---|---|
| **Closing formula** | Family 2 |
| | `… in accordance with the {design standard document}, Specifications and Drawings` |
| **Variants vary by** | widths, types and schedule references |
| **Element heading** | Finishes |

**The description block**

```
{Finish type} to {substrate}, including preparation of background, bonding agent,
scratch coat, angle beads, stop beads, movement joints, dubbing out and making good,
in accordance with the {design standard document}, Specifications and Drawings
```

**The priced variants under it**

```
A   Walls, 200mm wide, type {ref}                            418   m2   …

B   Ceilings, type {ref}                                     286   m2   …

C   Staircases, treads, risers and edges of landings          46   m2   …
```

**What POMI forces into the wording in this section**

- GP5.3 — thickness stated on area items.
- J1.1 — corrugated or ornamental surfaces SO DESCRIBED.
- J1.2 — curved, spherical, conical EACH SO DESCRIBED.
- J1.3 — internal and external EACH SO DESCRIBED.
- J5.1 — suspended ceilings STATE THE DROP.
- J6.3 cl.6 and cl.8 — glazed general surfaces and windows are MEASURED FLAT OVER GLASS and SO DESCRIBED.

⚠ 326 of the 334 Family 2 closers in the issued set are in Finishes — this is the section the family was measured from. J1.1 to J1.3 are DESCRIPTIONS, not quantity adjustments: a curved wall is described as curved and the area is not uplifted.

## J1  Generally

### J1.1

**What POMI says.**

> Work shall be measured flat without addition for laps or seams; finishes on corrugated or ornamental surfaces shall each be so described.

**Unit.** `RULE` — governs how OTHER quantities are calculated

**The formula.**

```
A = A_covered, NO laps or seams
```

**The rule.** Measured FLAT. Corrugated and ornamental surfaces EACH SO DESCRIBED.

### J1.2

**What POMI says.**

> Curved, spherical and conical work shall each be so described.

**Unit.** `—` — no arithmetic — a descriptive, definitional or administrative rule

**The formula.** None — this clause carries no arithmetic.

**The rule.** Curved, spherical and conical EACH SO DESCRIBED.

### J1.3

**What POMI says.**

> Internal and external work shall each be so described.

**Unit.** `—` — no arithmetic — a descriptive, definitional or administrative rule

**The formula.** None — this clause carries no arithmetic.

**The rule.** Internal and external work EACH SO DESCRIBED.

## J2  Backgrounds

### J2.1

**What POMI says.**

> Backgrounds shall be measured by area; backgrounds for floor, wall or ceiling finishes shall each be so described.

**Unit.** `M2` — by area, square metres

**The formula.**

```
A = Σ A
```

**The rule.** Backgrounds BY AREA, with floor, wall and ceiling backgrounds EACH SO DESCRIBED. HOUSE RULE: A BACKGROUND IS ALWAYS MEASURED SEPARATELY FROM THE FINISH ON IT. A screed under a tile is J2.2 and the tile is J3.1 cl.1 — TWO measured areas over the same surface, which is not a double count because they are two operations. The common error is the reverse: billing only the finish and letting the background disappear into its rate, where it cannot be valued on variation.

### J2.2

**What POMI says.**

> Poured backgrounds (for example, screeds) shall each be given separately, stating the surface finish.

**Unit.** `M2` — by area, square metres

**The formula.**

```
A = Σ A
```

**The rule.** POURED backgrounds (screeds) each given separately, STATING THE SURFACE FINISH.

### J2.3

**What POMI says.**

> Pre-formed backgrounds (for example, plasterboard, expanded metal lathing) shall each be given separately.

**Unit.** `M2` — by area, square metres

**The formula.**

```
A = Σ A
```

**The rule.** PRE-FORMED backgrounds (plasterboard, EML) each given separately.

## J3  Finishings

### J3.1

**What POMI says.**

> Unless otherwise stated, finishing shall be measured by area, classified as follows: 1. Floors, which shall include landings 2. Walls, which shall include returns, reveals of openings or recesses and attached and unattached columns 3. Ceilings, which shall include attached and unattached beams and soffits of staircases 4. Staircases, which shall include treads, risers and edges of landings but exclude soffits.

**Unit.** `M2` — by area, square metres

**The formula.**

```
A = Σ (L × H) − voids + reveals + columns
```

**The rule.** Finishings, FOUR classes: 1 floors (incl. landings) · 2 walls, INCLUDING returns, reveals of openings or recesses and ATTACHED AND UNATTACHED COLUMNS · 3 ceilings, INCLUDING attached and unattached beams and soffits of staircases · 4 STAIRCASES, including treads, risers and edges of landings BUT EXCLUDING SOFFITS (those fall in cl.3).

### J3.2

**What POMI says.**

> Skirtings, bands, strings, coverings to kerbs, mouldings, coves, channels or the like shall be measured by length.

**Unit.** `M` — by length, metres

**The formula.**

```
L = Σ L
```

**The rule.** Skirtings, bands, strings, coverings to kerbs, mouldings, coves, channels.

## J4  Sundries

### J4.1

**What POMI says.**

> Non-slip inserts, dividing strips, metal angle beads, lathing at junction of differing backgrounds or the like shall be measured by length; alternatively, they may be described with the items in which they occur.

**Unit.** `—` — no arithmetic — a descriptive, definitional or administrative rule

**The formula.** None — this clause carries no arithmetic.

**The rule.** Non-slip inserts, dividing strips, metal angle beads and lathing at junctions of differing backgrounds. POMI permits LENGTH or, expressly, DESCRIPTION WITH THE ITEMS IN WHICH THEY OCCUR. HOUSE ELECTION: DESCRIBED WITH THE ITEM — no separate linear item is raised, matching the F6.6 treatment of plastic coverings. THE TWO LIMBS ARE MUTUALLY EXCLUSIVE: a bill carrying an angle-bead length AND a finish description that mentions angle beads has billed them twice, and the second row reads perfectly reasonably. So the finish description must NAME them — beads, stops, dividing strips, lathing at junctions — or the rate is not bound to anything.

## J5  Suspended ceilings

### J5.1

**What POMI says.**

> Suspended ceilings shall be measured by area, classified as follows: 1. Ceilings stating the drop 2. Sides and soffits of beams or upstands.

**Unit.** `M2` — by area, square metres

**The formula.**

```
A = Σ A, per class
```

**The rule.** Suspended ceilings: 1 ceilings STATING THE DROP · 2 sides and soffits of beams or upstands. The drop is a MANDATORY statement.

## J6  Decorations

### J6.1

**What POMI says.**

> Decorations on different surfaces shall each be given separately.

**Unit.** `—` — no arithmetic — a descriptive, definitional or administrative rule

**The formula.** None — this clause carries no arithmetic.

**The rule.** Decorations on DIFFERENT SURFACES each given separately.

### J6.2

**What POMI says.**

> Details shall be given of any special method of application (for example, spraying).

**Unit.** `—` — no arithmetic — a descriptive, definitional or administrative rule

**The formula.** None — this clause carries no arithmetic.

**The rule.** Details of any special method of application, e.g. spraying.

### J6.3

**What POMI says.**

> Unless otherwise stated, decorations shall be measured by area, classified as follows: 1. Floors, which shall include landings 2. Walls, which shall include returns, reveals of openings or recesses and attached and unattached columns 3. Ceilings, which shall include attached and unattached beams and soffits of staircases 4. Staircases, which shall include treads, risers, strings and edges of landings but exclude soffits 5. Cornices 6. General surfaces, which shall include doors, close-type fencing or the like; glazed general surfaces (measured flat over glass) shall be so described 7. Isolated general surfaces, which shall include door frames, linings, sub-frames of a differing material to the window, skirtings, rails, architraves, bars, posts, balusters or the like 8. Windows (measured flat over glass, frames, mullions, transomes and architraves), which shall include glazed partitions or the like, but exclude sub-frames of a differing material to the window; edges of sashes shall be understood to be included 9. Radiators, measured over the area of heating surface 10. Gutters, measured inside and out 11. Large pipes (that is, pipes with an internal diameter exceeding 60mm), including trunking or the like, unless measured as incidental work; hangers, supports or the like (except common supports to services) shall be understood to be included 12. Structural metalwork, which shall include roof trusses.

**Unit.** `M2` — by area, square metres

**The formula.**

```
A = Σ A, per class
```

**The rule.** Decorations, TWELVE classes — THREE TIMES the four of J3.1: 1 floors (incl. landings) · 2 walls (incl. returns, reveals, attached and unattached columns) · 3 ceilings (incl. attached and unattached beams, staircase soffits) · 4 STAIRCASES, incl. treads, risers, STRINGS and edges of landings BUT EXCLUDING soffits · 5 CORNICES · 6 GENERAL SURFACES, which INCLUDE doors and close-type fencing; GLAZED general surfaces MEASURED FLAT OVER GLASS and SO DESCRIBED · 7 ISOLATED GENERAL SURFACES, which include door frames, linings, sub-frames of a differing material to the window, skirtings, rails, architraves, bars, posts, balusters · 8 WINDOWS, MEASURED FLAT OVER GLASS, frames, mullions, transomes and architraves, including glazed partitions but EXCLUDING sub-frames of a differing material; EDGES OF SASHES DEEMED INCLUDED · 9 RADIATORS, MEASURED OVER THE AREA OF HEATING SURFACE · 10 GUTTERS, MEASURED INSIDE AND OUT · 11 LARGE PIPES (internal diameter exceeding 60 mm) including trunking, unless measured as incidental work; hangers and supports (except common supports to services) DEEMED INCLUDED · 12 STRUCTURAL METALWORK, which includes roof trusses. Classes 5 to 12 have NO counterpart in J3.1 — a decoration take-off is NOT a copy of the finishes take-off.

### J6.4

**What POMI says.**

> Decoration on small pipes (that is, pipes with an internal diameter of 60mm or less) unless measured as incidental work, shall be measured by length; hangers, supports or the like (except common supports to services) shall be understood to be included.

**Unit.** `M` — by length, metres

**The formula.**

```
if Ø_internal ≤ 60 mm → L = Σ L
```

**The rule.** Decoration on SMALL pipes by length. HANGERS AND SUPPORTS DEEMED INCLUDED, except common supports to services.

### J6.5

**What POMI says.**

> Decoration on gratings, rainwater heads or the like shall each be enumerated separately, irrespective of size.

**Unit.** `NR` — enumerated — a count

**The formula.**

```
N = count
```

**The rule.** Decoration on gratings and rainwater heads — ENUMERATED SEPARATELY, IRRESPECTIVE OF SIZE.

## J7  Signwriting

### J7.1

**What POMI says.**

> Signwriting letters or the like shall be enumerated.

**Unit.** `NR` — enumerated — a count

**The formula.**

```
N = count
```

**The rule.** Signwriting letters.

# SECTION K — ACCESSORIES

*2 groups · 5 clauses · 4 carrying arithmetic*

## How this section is TAKEN OFF

**The spec row says what the thing is**

```
{type} {width} — e.g. '{accessory type}, {w} mm wide, type {ref}'
```

**The dimension rows narrate the calculation**

```
{Location}: {L} m
Partitions: {L} m measured THROUGH door openings, no deduction
```

**The arithmetic.** Qty each = the length. Doors are NOT deducted.

⚠ K2.1's no-deduction rule is counter-intuitive enough that the narration must state it. A partition length that looks too long is the correct one.

## How this section is MARKED UP

| | |
|---|---|
| **Trade colour** | olive |
| **Primitive** | LINEAR for partitions, rails and trims · TAG for enumerated accessories |
| **Call-out tag** | `K-{serial}  {qty} m` or `{n} nr` |

**What carries a mark.** partitions traced as a polyline THROUGH the door openings; every enumerated accessory tagged.

⚠ **The partition polyline runs THROUGH the doors and is not broken at them** — K2.1 makes no deduction. A markup that stops the line at each door will close short, and the closure failure will look like a measurement error when the measurement was right.

## How this section is BILLED

| | |
|---|---|
| **Closing formula** | Family 2 |
| | `… in accordance with the {design standard document}, Specifications and Drawings` |
| **Variants vary by** | widths and types |
| **Element heading** | Accessories |

**The description block**

```
{Accessory type}, including all fixings, brackets, trims, end caps, jointing and making
good, in accordance with the {design standard document}, Specifications and Drawings
```

**The priced variants under it**

```
A   200mm wide, type {ref}                                    64   m    …

B   300mm wide, type {ref}                                    38   m    …
```

**What POMI forces into the wording in this section**

- GP5.2 — length items state the cross-sectional size, shape or girth.
- K2.1 — partition LENGTH is measured with NO DEDUCTION for the doors in it; the doors are enumerated separately.

⚠ K is a small section with one large trap: K2.1. The description must not suggest the partition length excludes the door openings, because it does not.

## K1  Generally

### K1.1

**What POMI says.**

> For the purposes of identification, accessories to be measured in accordance with the principles in this section shall be defined as those being specially manufactured or proprietary items not included in other sections.

**Unit.** `—` — no arithmetic — a descriptive, definitional or administrative rule

**The formula.** None — this clause carries no arithmetic.

**The rule.** THE DEFINITION, and it is a RESIDUAL: accessories are specially manufactured or proprietary items NOT INCLUDED IN OTHER SECTIONS. SO K IS TESTED LAST — an item reaches K only after Q, R, H, J and every other section has been tested and none of them takes it. Reaching for K early pulls work out of the sections that price it properly. HOUSE RULE: BECAUSE THE SECTION IS DEFINED BY EXCLUSION, EVERY K ITEM MUST BE FULLY DESCRIBED — what the thing is, what it is made of, how it is fixed, and the schedule or type reference it comes from. A section defined by what it is not cannot rely on its heading to say what an item is; only the description can.

### K1.2

**What POMI says.**

> Unless otherwise stated, accessories shall be enumerated.

**Unit.** `NR` — enumerated — a count

**The formula.**

```
N = count
```

**The rule.** Unless otherwise stated, accessories ENUMERATED — the section's default, and 'unless otherwise stated' is the licence for K2.1's length. Everything not caught by K2 falls to this count, FULLY DESCRIBED under GP5.1 and under the K1.1 house rule: the description is the only thing identifying an item in a section defined by exclusion.

## K2  Partitions

### K2.1

**What POMI says.**

> Partitions shall be measured by length, taken over all doors and glazed units.

**Unit.** `M` — by length, metres

**The formula.**

```
L = Σ L, TAKEN OVER ALL doors and glazed units
```

**The rule.** Partitions. NO deduction for the doors and glazed panels in them.

### K2.2

**What POMI says.**

> Doors and glazed units shall be enumerated, stating the partition in which they occur.

**Unit.** `NR` — enumerated — a count

**The formula.**

```
N = count
```

**The rule.** Doors and glazed units, STATING THE PARTITION they occur in.

### K2.3

**What POMI says.**

> Cubicles or the like shall be enumerated.

**Unit.** `NR` — enumerated — a count

**The formula.**

```
N = count
```

**The rule.** Cubicles.

# SECTION L — EQUIPMENT

*1 groups · 2 clauses · 1 carrying arithmetic*

## How this section is TAKEN OFF

**The spec row says what the thing is**

```
{equipment type} {duty} — e.g. '{type}, {duty}, {location}'
```

**The dimension rows narrate the calculation**

```
{Type ref}: {n} nr, {location}
```

**The arithmetic.** Qty each = 1; Nr carries the count.

⚠ Named types and schedule references, NOT sizes. The take-off proves WHICH unit and HOW MANY, and the schedule proves what it is.

## How this section is MARKED UP

| | |
|---|---|
| **Trade colour** | teal |
| **Primitive** | TAG |
| **Call-out tag** | `L-{serial}  {n} nr`, with the type reference |

**What carries a mark.** every item of equipment tagged at its position on the plan, or on its schedule row.

⚠ Named types and schedule references, not sizes. Closure is count reconciliation at K18 exact equality, as for H.

## How this section is BILLED

| | |
|---|---|
| **Closing formula** | none — this section bills items, sums or particulars, not measured work |
| **Variants vary by** | NAMED TYPES and schedule references — NOT sizes |
| **Element heading** | Equipment |

**The description block**

```
{Equipment type}, complete with all accessories, fixings, connections, testing and
commissioning, as specified and as shown on the drawings
```

**The priced variants under it**

```
A   Type {ref}                                                 8   nr   …

B   Type {ref}                                                 4   nr   …
```

**What POMI forces into the wording in this section**

- GP5.1 — fully described. GP5.5 — a proprietary item MAY be measured to the manufacturer's tariff instead; declare it under GP1.2 if you do.

⚠ ZERO of Equipment's 35 shared-description runs in the issued set carry a sized variant. The variants here are named types and schedule references. A rule demanding a size in this section would be wrong.

## L1  Generally

### L1.1

**What POMI says.**

> For the purposes of identification, equipment to be measured in accordance with the principles in this section shall be defined as specialist equipment related solely to the function of a building or department (for example, food preparation or service equipment, laboratory equipment, stage equipment).

**Unit.** `—` — no arithmetic — a descriptive, definitional or administrative rule

**The formula.** None — this clause carries no arithmetic.

**The rule.** Scope: equipment is specially manufactured or proprietary items not in other sections — food service, laboratory, stage.

### L1.2

**What POMI says.**

> Each category of equipment shall be given as an item; alternatively, individual items of equipment may be enumerated.

**Unit.** `NR` — enumerated — a count

**The formula.**

```
N = count
```

**The rule.** POMI permits EACH CATEGORY AS AN ITEM or, expressly, INDIVIDUAL ITEMS ENUMERATED. HOUSE ELECTION: ENUMERATED. An 'Item' for laboratory or kitchen equipment prices nothing, compares between tenderers on nothing, and cannot be valued on variation. GP5.5 sits over this section — a proprietary item MAY follow the manufacturer's tariff — so between L1.2 and GP5.5 Section L is the loosest in POMI and the DESCRIPTION carries everything.

# SECTION M — FURNISHINGS

*2 groups · 3 clauses · 2 carrying arithmetic*

## How this section is TAKEN OFF

**The spec row says what the thing is**

```
{furnishing type} {schedule ref}
```

**The dimension rows narrate the calculation**

```
{Type ref}: {n} nr, {location}
```

**The arithmetic.** Qty each = 1; Nr carries the count.

⚠ As L. The count and the location are the whole measurement.

## How this section is MARKED UP

| | |
|---|---|
| **Trade colour** | pink |
| **Primitive** | TAG |
| **Call-out tag** | `M-{serial}  {n} nr`, with the type reference |

**What carries a mark.** every furnishing tagged at its position, or on its schedule row.

⚠ As L. The count and the location are the whole measurement.

## How this section is BILLED

| | |
|---|---|
| **Closing formula** | none — this section bills items, sums or particulars, not measured work |
| **Variants vary by** | NAMED TYPES and schedule references — NOT sizes |
| **Element heading** | Furnishings |

**The description block**

```
{Furnishing type}, complete with all fixings, brackets, trims and accessories, as
specified and as shown on the drawings
```

**The priced variants under it**

```
A   Type {ref}                                                12   nr   …

B   Type {ref}                                                 6   nr   …
```

**What POMI forces into the wording in this section**

- GP5.1 — fully described.

⚠ As L: ZERO of Furnishings' 25 runs carry a sized variant. Expect the STRUCTURE, not a size.

## M1  Generally

### M1.1

**What POMI says.**

> For the purposes of identification, furnishings to be measured in accordance with the principles in this section shall be defined as loose furniture, fittings or the like related to the occupation and use of a building or department (for example, rugs, curtains, artwork, ashtrays, furnishing accessories).

**Unit.** `—` — no arithmetic — a descriptive, definitional or administrative rule

**The formula.** None — this clause carries no arithmetic.

**The rule.** Scope: furnishings — rugs, curtains, artwork, ashtrays, furnishing accessories.

### M1.2

**What POMI says.**

> Each category of furnishing shall be given as an item; alternatively, individual items of furnishing may be enumerated or measured by length, as may be appropriate.

**Unit.** `NR / M`

**The formula.**

```
N = count for discrete items
Len = Σ L for continuous ones
```

**The rule.** POMI permits EACH CATEGORY AS AN ITEM, or individual items ENUMERATED, or MEASURED BY LENGTH — three units in one clause, the most permissive in the standard. HOUSE ELECTION: ENUMERATED for discrete items, BY LENGTH for continuous ones (curtains, blinds). CATEGORY AS AN ITEM IS NEVER USED, for the same reason as L1.2.

## M2  Curtain track

### M2.1

**What POMI says.**

> Curtain track shall be measured by length; hooks, gliders, stops or the like shall be understood to be included.

**Unit.** `M` — by length, metres

**The formula.**

```
L = Σ L
```

**The rule.** Curtain track. HOOKS, GLIDERS AND STOPS DEEMED INCLUDED.

# SECTION N — SPECIAL CONSTRUCTION

*3 groups · 3 clauses · 2 carrying arithmetic*

## How this section is TAKEN OFF

**The spec row says what the thing is**

```
{system type} — e.g. '{special structure}, {system}'
```

**The dimension rows narrate the calculation**

```
{System}: {scope}                                    1                    item
```

**The arithmetic.** usually an item; ordinary construction inside it goes to ITS OWN SECTION's tab.

⚠ N2.1 sends ordinary construction to the relevant section. So a special structure produces rows on OTHER tabs, and the N tab carries only what is genuinely special.

## How this section is MARKED UP

| | |
|---|---|
| **Trade colour** | maroon |
| **Primitive** | mixed — follows whichever section the work is measured to |
| **Call-out tag** | `N-{serial}` on the special item; the ordinary work carries its own section's code |

**What carries a mark.** the special structure outlined as an area shade for identification; the ORDINARY construction inside it marked in ITS OWN section's colour, because N2.1 sends it to that section.

⚠ **N is the one section where the marks belong to other sections.** An outline in maroon identifies the special structure; the concrete inside it is a blue C mark, the finishes a green J mark. A maroon shade over everything inside the structure hides the work that N2.1 requires to be measured elsewhere.

## How this section is BILLED

| | |
|---|---|
| **Closing formula** | none — this section bills items, sums or particulars, not measured work |
| **Variants vary by** | system or structure type |
| **Element heading** | Special Construction |

**The description block**

```
{System type}, complete in accordance with the Specifications and Drawings
```

**The priced variants under it**

```
A   {System}, as detailed                                      1   item …
```

**What POMI forces into the wording in this section**

- N2.1 — work forming part of a special structure, but of ordinary construction, is MEASURED TO THE RELEVANT SECTIONS, not billed inside the special item.
- N3.1 — installations are an ITEM each, or measured to the relevant sections.

⚠ N's whole discipline is knowing what NOT to put inside it. Ordinary construction inside a special structure goes to its own section.

## N1  Generally

### N1.1

**What POMI says.**

> For the purposes of identification, special construction to be measured in accordance with the principles in this section shall be defined as either enclosures of a specialist construction (for example, air supported or geodetic structures, prefabricated buildings) or installations of a specialist nature (for example, radiation protection).

**Unit.** `—` — no arithmetic — a descriptive, definitional or administrative rule

**The formula.** None — this clause carries no arithmetic.

**The rule.** Scope: special construction — air-supported or geodetic structures, prefabricated buildings.

## N2  Enclosures

### N2.1

**What POMI says.**

> Enclosures shall be enumerated; work within the enclosure, not being part of the enclosure construction, shall be measured in accordance with the relevant sections of this document.

**Unit.** `NR` — enumerated — a count

**The formula.**

```
N = count
```

**The rule.** Enclosures. Work WITHIN the enclosure that is not part of the enclosure construction is measured to the relevant sections.

## N3  Installations

### N3.1

**What POMI says.**

> Installations shall each be given as an item; alternatively, they may be measured in accordance with the relevant sections of this document.

**Unit.** `—` — no arithmetic — a descriptive, definitional or administrative rule

**The formula.**

```
measured to the RELEVANT SECTIONS
```

**The rule.** Installations of a specialist nature. POMI permits AN ITEM EACH or, expressly, MEASUREMENT TO THE RELEVANT SECTIONS. HOUSE ELECTION: MEASURED TO THE RELEVANT SECTIONS — it prices against known work rather than a lump. BUT THE SPECIALIST NATURE MUST SURVIVE IN THE WORDING: an item measured under C, F or J that forms part of a specialist installation is DESCRIBED AS SUCH, naming the installation it belongs to and the specification clause that governs it. Radiation shielding measured as lead-lined boarding under F is priced as ordinary boarding unless the description says what it is. THE MEASUREMENT MOVES SECTION; THE SPECIFICATION DOES NOT.

# SECTION P — CONVEYING SYSTEMS

*3 groups · 5 clauses · 4 carrying arithmetic*

## How this section is TAKEN OFF

**The spec row says what the thing is**

```
{system} {capacity} {stops} — e.g. 'Passenger lift, {capacity}, {n} stops, {speed}'
```

**The dimension rows narrate the calculation**

```
{Type}: {n} nr, {location}
Supports / Identification / Testing and commissioning /
Tools and spares / Documents                          1                    item
```

**The arithmetic.** Qty each = 1 throughout. The FIVE P2.1 sundry items are five separate rows.

⚠ P2.1's five items are measured NOWHERE ELSE — a row measuring lift guide supports by length has billed against the supports item.

## How this section is MARKED UP

| | |
|---|---|
| **Trade colour** | indigo |
| **Primitive** | TAG for the units · LISTED for the five P2.1 sundry items |
| **Call-out tag** | `P-{serial}  {n} nr`, with capacity and stops |

**What carries a mark.** each lift, hoist, escalator and conveyor tagged at its shaft or run; the shaft outlined for identification.

⚠ The five P2.1 items — supports, identification, testing and commissioning, tools and spares, documents — are LISTED in the legend with no dot. They have no geometry, and attempting to spot lift guide supports means they have been measured when they should be an item.

## How this section is BILLED

| | |
|---|---|
| **Closing formula** | none — this section bills items, sums or particulars, not measured work |
| **Variants vary by** | capacity, travel, number of stops |
| **Element heading** | Conveying Systems |

**The description block**

```
Supply and install all {system} including all guides, ropes, controls, machinery,
car, doors, signalisation, testing and commissioning, and any other items required for
a complete installation as indicated
```

**The priced variants under it**

```
A   Passenger lift; {capacity}, {number} stops, {speed}         2   nr   …

B   Supports                                                   1   item …
C   Identification                                             1   item …
D   Testing and commissioning                                  1   item …
E   Tools and spares                                           1   item …
F   Documents                                                  1   item …
```

**What POMI forces into the wording in this section**

- P2.1 — FIVE separate ITEMS: supports, identification, testing and commissioning (INCLUDING providing fuel and power), TOOLS AND SPARES, DOCUMENTS.
- P3.1 — incidental work as an ITEM.
- P3.2 — protective and decorative painting as an ITEM per system.

⚠ The P2.1 five are the pattern Q and R both adopt. They are ITEMS — a take-off that measures lift guide supports by length has billed against the supports item.

## P1  Generally

### P1.1

**What POMI says.**

> Lifts, hoists, conveyors, escalators or the like shall be enumerated.

**Unit.** `NR` — enumerated — a count

**The formula.**

```
N = count
```

**The rule.** Lifts, hoists, conveyors, escalators.

## P2  Sundries

### P2.1

**What POMI says.**

> An item shall be given for each of the following: 1. Supports, which shall include fixings, anchors, insulating blocks and anti-vibration devices 2. Identification, which shall include plates, discs,labels, charts and colour coding 3. Testing and commissioning, which shall include operating completed installations and providing fuel and power 4. Tools and spares, which shall include loose keys and consumable stores 5. Documents, which shall include drawings, operating instructions and maintenance manuals.

**Unit.** `ITEM ×5`

**The formula.**

```
five separate ITEMS
```

**The rule.** THE SUNDRIES LIST, used by P, Q and R: 1 supports (incl. fixings, anchors, insulating blocks, anti-vibration devices) · 2 identification (plates, discs, labels, charts, colour coding) · 3 TESTING AND COMMISSIONING, which INCLUDES operating the completed installation AND PROVIDING FUEL AND POWER · 4 TOOLS AND SPARES, which includes loose keys and consumable stores · 5 DOCUMENTS, which includes drawings, operating instructions and maintenance manuals.

## P3  Work incidental to conveying systems

### P3.1

**What POMI says.**

> An item shall be given for incidental work, which shall include: 1. Co-ordination with other engineering installations 2. Cutting or forming holes, mortices, chases or the like and making good finishings 3. Building in or cutting and pinning brackets or the like and making good finishings.

**Unit.** `ITEM` — an ITEM — a priced line with no quantity

**The formula.**

```
ITEM
```

**The rule.** Incidental work AS AN ITEM, three heads: 1 CO-ORDINATION with other engineering installations · 2 CUTTING OR FORMING holes, mortices and chases AND MAKING GOOD FINISHINGS · 3 BUILDING IN, or cutting and pinning brackets, AND MAKING GOOD FINISHINGS. BUILDER'S WORK IS AN ITEM, NOT A COUNT — no enumeration of holes, no area of making good. Heads 2 and 3 BOTH end 'and making good finishings', so the make-good is inside this item and MUST NOT reappear in Section J.

### P3.2

**What POMI says.**

> Protective painting and decorative painting shall each be given as an item for each system and shall include: 1. Removing protective coating or wrapping 2. Cleaning and polishing exposed surfaces.

**Unit.** `ITEM` — an ITEM — a priced line with no quantity

**The formula.**

```
ITEM per system
```

**The rule.** Protective and decorative painting, AN ITEM FOR EACH SYSTEM, and it INCLUDES 1 removing protective coating or wrapping · 2 cleaning and polishing exposed surfaces — both PREPARATION, not painting. HOUSE ELECTION: MEP PAINTING IS BILLED IN THE MEP SECTIONS, HERE, AND NOT IN SECTION J. J6.3 cl.11 (large pipes and trunking) and cl.12 (structural metalwork) both carry the qualifier 'unless measured as incidental work' — under this election it IS incidental work, so those two J6.3 classes are NOT used for anything inside an MEP package. Billing both double-pays, and both rows read correctly.

### P3.3

**What POMI says.**

> Other incidental work shall be measured in accordance with the relevant sections of this document and grouped under an appropriate heading.

**Unit.** `—` — no arithmetic — a descriptive, definitional or administrative rule

**The formula.** None — this clause carries no arithmetic.

**The rule.** Other incidental work to the relevant sections, GROUPED under an appropriate heading.

# SECTION Q — MECHANICAL ENGINEERING INSTALLATIONS

*9 groups · 23 clauses · 21 carrying arithmetic*

## How this section is TAKEN OFF

**The spec row says what the thing is**

```
{system} {equipment tag} {duty} — e.g. '{plant type} {tag}, {duty}, {location}' · for distribution: '{material} {service} pipework {size}'
```

**The dimension rows narrate the calculation**

```
{Tag}: {n} nr, {system}, {location}
{Material} pipework {size} mm: {L} m, {system}, {levels}
Rectangular duct {w}x{d}: {L} m x girth {g} m x {kg/m2} kg/m2
```

**The arithmetic.** Qty each = 1 for plant; = the run length for distribution; = area x unit mass for rectangular duct, with the girth shown.

⚠ The DUCT line must show girth and unit weight, because Q3.1 measures by WEIGHT from an area and GP5.4 makes the unit weight mandatory. And the pipe size in the narration must be on the SAME diameter basis (internal or external) that GP5.2 requires the bill to state — it decides the Q2.2 60 mm test.

## How this section is MARKED UP

| | |
|---|---|
| **Trade colour** | cyan |
| **Primitive** | LINEAR for pipe and duct runs · TAG for plant and terminals · AREA for insulation and rectangular duct where measured by area |
| **Call-out tag** | `Q-{serial}  {qty} m` with the size, or `{n} nr` |

**What carries a mark.** every pipe and duct run traced as a polyline on the service layout, with the SIZE in the label; every item of plant tagged; every terminal, valve and large-pipe fitting tagged.

⚠ **The run is traced along the CENTRE LINE, OVER ALL FITTINGS** — the polyline does not stop at a bend, and the bend is separately tagged only where the pipe exceeds 60 mm internal diameter under Q2.2. Marking fittings on a 20 mm pipe is marking a quantity that does not exist. **Rectangular duct is traced as a line but billed by WEIGHT**, so the label must carry the girth and the unit mass, or the mark cannot be closed.

## How this section is BILLED

| | |
|---|---|
| **Closing formula** | Family 3 |
| | `Supply and install all {system} as shown on the drawings and/or as specified including but not limited to {the components the rate covers} and any other items required for a complete installation as indicated.` |
| **Variants vary by** | SIZES — 20mm, 25mm, 32mm, 40mm, 65mm, 80mm … |
| **Element heading** | Mechanical Works |

**The description block**

```
Supply and install all {system} as shown on the drawings and/or as specified including
but not limited to all piping, fittings, angles, ells, tees, reducers, valves, heads,
supports and any other items required for a complete installation as indicated.
```

**The priced variants under it**

```
{Material} Piping

A   20mm                                                     186   m    …

B   25mm                                                     142   m    …

C   32mm                                                      88   m    …

D   40mm                                                      64   m    …
```

**What POMI forces into the wording in this section**

- GP5.2 — for PIPEWORK, STATE WHETHER THE DIAMETER IS INTERNAL OR EXTERNAL. This is not optional and it decides the Q2.2 60 mm test.
- GP5.4 — ductwork by weight STATES the material thickness AND unit weight.
- Q2.2 — fittings to pipes and GUTTERS over 60 mm internal diameter are ENUMERATED, GROUPED PER SIZE, and described as 'fittings'. At or under 60 mm they are DEEMED INCLUDED and must not appear.
- Q1.1 — installations CLASSIFIED BY FUNCTION, each under its own heading.

⚠ The 'including but not limited to' list is the commercially operative half of the description and it must be written FROM THE POMI DEEMED-INCLUDED LIST for the clause being billed. A component left out is a component the contractor can claim for; a component listed that POMI already deems included is harmless.

## Q1  Generally

### Q1.1

**What POMI says.**

> Installations shall be classified by function and given separately under an appropriate heading.

**Unit.** `—` — no arithmetic — a descriptive, definitional or administrative rule

**The formula.** None — this clause carries no arithmetic.

**The rule.** Installations CLASSIFIED BY FUNCTION, each under its own heading.

### Q1.2

**What POMI says.**

> Installations shall be measured in accordance with the relevant clauses in this section; alternatively, they may be enumerated on a locational basis (for example, cold water installation to ground floor).

**Unit.** `—` — no arithmetic — a descriptive, definitional or administrative rule

**The formula.**

```
measured to the relevant clauses of this section
```

**The rule.** POMI permits MEASUREMENT to the clauses of this section or, expressly, ENUMERATION ON A LOCATIONAL BASIS (for example, 'cold water installation to ground floor'). HOUSE ELECTION: MEASURED. The locational alternative dissolves the section into counts that price nothing a checker can test and cannot be valued when the layout changes.

## Q2  Pipework and gutterwork

### Q2.1

**What POMI says.**

> Pipes and gutters shall be measured by length, taken along the centre line over all fittings.

**Unit.** `M` — by length, metres

**The formula.**

```
L = Σ L_centreline, OVER ALL FITTINGS
```

**The rule.** Pipes and gutters. State whether the diameter is internal or external per GP5.2.

### Q2.2

**What POMI says.**

> Fittings to small pipes (that is, pipes with an internal diameter of 60mm or less) shall be understood to be included. Fittings (except joints in the running length) to large pipes (that is, pipes with an internal diameter exceeding 60mm) and to gutters shall be enumerated, grouped together for each size of pipe or gutter and described as 'fittings'.

**Unit.** `NR / —`

**The formula.**

```
if Ø_internal ≤ 60 mm → fittings DEEMED INCLUDED
if Ø_internal > 60 mm → N = count, GROUPED per size
```

**The rule.** THE 60 mm RULE. Applies to fittings TO GUTTERS as well as to large pipes. Joints in the running length are included either way. Grouped per size of pipe OR GUTTER and described as 'fittings'.

### Q2.3

**What POMI says.**

> Valves, traps, expansion compensators or the like shall be enumerated; sleeves, cover-plates or the like shall be understood to be included.

**Unit.** `NR` — enumerated — a count

**The formula.**

```
N = count
```

**The rule.** Valves, traps, expansion compensators. SLEEVES AND COVER-PLATES DEEMED INCLUDED.

## Q3  Ductwork

### Q3.1

**What POMI says.**

> Rectangular ductwork shall be measured by weight, based upon the area calculated as the length, taken along the centre line over all fittings, times the net girth of nominal dimensions. Blank ends shall be added to the area for weighting but no deduction shall be made for intersections or openings; extra weight for seams, stiffeners, supports, fixings or the like shall be understood to be included.

**Unit.** `KG` — by weight, kilogrammes

**The formula.**

```
girth = 2 × (w + d)
A = L_centreline × girth + Σ A_blank_ends
W = A × m_per_m2(gauge)
```

**The rule.** RECTANGULAR ductwork BY WEIGHT, from an area built on NOMINAL dimensions. BLANK ENDS ARE ADDED to the area. NO DEDUCTION for intersections or openings. EXTRA WEIGHT FOR SEAMS, STIFFENERS, SUPPORTS AND FIXINGS IS DEEMED INCLUDED — so the gauge weight is applied flat, with no uplift.

### Q3.2

**What POMI says.**

> Circular, oval and flexible ductwork shall be measured by length, taken along the centre line over all fittings.

**Unit.** `M` — by length, metres

**The formula.**

```
L = Σ L_centreline, over all fittings
```

**The rule.** Circular, oval and flexible ductwork BY LENGTH.

### Q3.3

**What POMI says.**

> Fittings to rectangular ductwork shall be understood to be included; fittings to circular and oval ductwork (excluding test holes and covers) shall be enumerated, grouped together for each size of duct and described as 'fittings'.

**Unit.** `NR / —`

**The formula.**

```
rectangular fittings DEEMED INCLUDED
circular/oval fittings N = count, grouped per size
```

**The rule.** The asymmetry follows the unit: a weight item absorbs its fittings, a length item does not. Test holes and covers excluded.

### Q3.4

**What POMI says.**

> Dampers, grilles, flexible connectors or the like shall be enumerated.

**Unit.** `NR` — enumerated — a count

**The formula.**

```
N = count
```

**The rule.** Dampers, grilles, flexible connectors.

## Q4  Equipment

### Q4.1

**What POMI says.**

> Sanitary fittings, tanks, fans, pumps, hoods, air-handling units or the like shall be enumerated.

**Unit.** `NR` — enumerated — a count

**The formula.**

```
N = count
```

**The rule.** Sanitary fittings, tanks, fans, pumps, hoods, air-handling units.

### Q4.2

**What POMI says.**

> Continuous convectors or the like shall be measured by length.

**Unit.** `M` — by length, metres

**The formula.**

```
L = Σ L
```

**The rule.** Continuous convectors.

### Q4.3

**What POMI says.**

> Heated or ventilated ceilings or the like shall be measured by area.

**Unit.** `M2` — by area, square metres

**The formula.**

```
A = Σ A
```

**The rule.** Heated or ventilated ceilings.

## Q5  Automatic controls

### Q5.1

**What POMI says.**

> Sensing or activating devices (for example, thermostats, humidistats, motorised valves), control panels, air compressors and receivers or the like shall be enumerated.

**Unit.** `NR` — enumerated — a count

**The formula.**

```
N = count
```

**The rule.** Sensing and activating devices, control panels, air compressors, receivers.

### Q5.2

**What POMI says.**

> Wiring, pneumatic tubing, isolators, starters, relays or the like associated with automatic controls shall be understood to be included.

**Unit.** `—` — no arithmetic — a descriptive, definitional or administrative rule

**The formula.** None — this clause carries no arithmetic.

**The rule.** Wiring, pneumatic tubing, isolators, starters, relays for automatic controls DEEMED INCLUDED — NOT measured under Section R.

### Q5.3

**What POMI says.**

> Alternatively, automatic control systems shall be given as an item for each installation but equipment common to more than one system shall be enumerated.

**Unit.** `ITEM` — an ITEM — a priced line with no quantity

**The formula.**

```
ITEM per installation
PLUS N = count of SHARED equipment
```

**The rule.** POMI permits automatic controls to be MEASURED (Q5.1 device by device) or, expressly, GIVEN AS AN ITEM FOR EACH INSTALLATION. HOUSE ELECTION: AN ITEM PER INSTALLATION. BUT THE CLAUSE'S OWN EXCEPTION SURVIVES THE ELECTION AND IS NOT OPTIONAL: EQUIPMENT COMMON TO MORE THAN ONE SYSTEM IS STILL ENUMERATED. So a BMS is one item per installation, while a shared control panel, a shared air compressor or a shared receiver serving two or more systems is counted separately — otherwise it sits inside one installation's item and the other installations are priced without it. Q5.2 still applies: wiring, pneumatic tubing, isolators, starters and relays associated with the controls are DEEMED INCLUDED and are never measured as cable under Section R.

## Q6  Connections to supply mains

### Q6.1

**What POMI says.**

> Connections to supply mains shall be enumerated, subject to clause GP8.

**Unit.** `SUM` — a SUM — a money figure, not a measured quantity

**The formula.**

```
GP8.1 sum, exclusive of profit
+ profit ITEM
+ attendance ITEM per GP8.2
```

**The rule.** Connections to supply mains ENUMERATED, SUBJECT TO GP8. HOUSE ELECTION: WHERE THE AUTHORITY HOLDS THE MONOPOLY — which in the UAE is every potable water, sewer and district-cooling connection — GP8 GOVERNS AND IT IS NOT A MEASURED CONNECTION AT ALL. It becomes a GP8.1 SUM EXCLUSIVE OF PROFIT, a SEPARATE PROFIT ITEM, and an ATTENDANCE ITEM under GP8.2 carrying the eight GP6.2 heads. Three lines, never one. Only where the contractor may lawfully make the connection himself is it enumerated under this clause.

## Q7  Insulation, including linings and protective coverings

### Q7.1

**What POMI says.**

> Insulation to pipework shall be measured by length, taken along the centre line over all fittings.

**Unit.** `M` — by length, metres

**The formula.**

```
L = Σ L_centreline, over all fittings
```

**The rule.** Insulation to PIPEWORK.

### Q7.2

**What POMI says.**

> Insulation to rectangular ductwork shall be measured by area, calculated as described In clause Q3; additional insulation to flanges or the like shall be understood to be included.

**Unit.** `M2` — by area, square metres

**The formula.**

```
A = L_centreline × girth  (girth per Q3.1)
```

**The rule.** Insulation to RECTANGULAR ductwork BY AREA — same geometry as Q3.1 but a DIFFERENT UNIT from the duct itself. Additional insulation to flanges DEEMED INCLUDED.

### Q7.3

**What POMI says.**

> Insulation to circular, oval and flexible ductwork shall be measured by length, taken along the centre line over all fittings.

**Unit.** `M` — by length, metres

**The formula.**

```
L = Σ L_centreline, over all fittings
```

**The rule.** Insulation to circular, oval and flexible ductwork.

### Q7.4

**What POMI says.**

> Insulation boxes around accessories shall be enumerated.

**Unit.** `NR` — enumerated — a count

**The formula.**

```
N = count
```

**The rule.** Insulation boxes around accessories.

### Q7.5

**What POMI says.**

> Insulation to equipment shall be enumerated.

**Unit.** `NR` — enumerated — a count

**The formula.**

```
N = count
```

**The rule.** Insulation to equipment.

## Q8  Sundries

### Q8.1

**What POMI says.**

> Sundries shall be measured in accordance with clause P2.

**Unit.** `ITEM ×5`

**The formula.**

```
per P2.1
```

**The rule.** Mechanical sundries.

## Q9  Work incidental to mechanical engineering installations

### Q9.1

**What POMI says.**

> Work incidental to mechanical engineering installations shall be measured in accordance with clause P3.

**Unit.** `ITEM` — an ITEM — a priced line with no quantity

**The formula.**

```
per P3.1
```

**The rule.** Mechanical incidental work, including builder's work holes and making good.

# SECTION R — ELECTRICAL ENGINEERING INSTALLATIONS

*10 groups · 17 clauses · 12 carrying arithmetic*

## How this section is TAKEN OFF

**The spec row says what the thing is**

```
{system} {cable/equipment type} {size or rating}
```

**The dimension rows narrate the calculation**

```
{Cable type} {size}: {L} m, {system}, {levels}
{Point class}: {n} nr, {location}
{Board / equipment tag}: {n} nr, {location}
```

**The arithmetic.** Qty each = the run length for cable; = 1 for points and equipment.

⚠ Where final sub-circuits are ENUMERATED AS POINTS under R4.1, NO cable length is taken for those same circuits, and the take-off must not contain both. A multi-gang outlet is ONE point. Auxiliary points — bell push, telephone outlet — are R4.1 class 5 and belong on this tab, not with accessories.

## How this section is MARKED UP

| | |
|---|---|
| **Trade colour** | yellow |
| **Primitive** | LINEAR for cable, conduit and trunking runs · TAG for points, boards and equipment |
| **Call-out tag** | `R-{serial}  {qty} m` with the size, or `{n} nr` with the point class |

**What carries a mark.** every containment and cable run traced with its size in the label; every point tagged by its R4.1 class; every board and item of equipment tagged.

⚠ **Where final sub-circuits are ENUMERATED AS POINTS under R4.1, the cable to those circuits is NOT traced.** A markup showing both a point tag and a cable polyline on the same final circuit is drawing the double count. A multi-gang outlet gets ONE tag. Auxiliary points — bell push, telephone outlet — are R4.1 class 5 and are tagged in yellow with the rest, not left to the accessories markup.

## How this section is BILLED

| | |
|---|---|
| **Closing formula** | Family 3 |
| | `Supply and install all {system} as shown on the drawings and/or as specified including but not limited to {the components the rate covers} and any other items required for a complete installation as indicated.` |
| **Variants vary by** | SIZES and ratings — cable sizes, breaker ratings |
| **Element heading** | Electrical Works |

**The description block**

```
Supply and install all {system} as shown on the drawings and/or as specified including
but not limited to all cables, conduits, trunking, boxes, glands, terminations,
supports, earthing and any other items required for a complete installation as
indicated.
```

**The priced variants under it**

```
{Cable type} Cables

A   3 x 2.5 sq.mm                                            420   m    …

B   3 x 4 sq.mm                                              286   m    …

C   4 x 16 sq.mm                                              94   m    …
```

**What POMI forces into the wording in this section**

- R4.1 cl.2 — lighting switch points STATE one-way, two-way or intermediate.
- R4.1 cl.4 — equipment points STATE the type of equipment or the electrical rating.
- R4.1 — a point CARRIES its cable, conduit, boxes and terminations. Where points are enumerated, the description must NOT also promise a measured cable length, and no cable length is measured for those circuits.
- R1.1 — installations classified by function, each under its own heading.

⚠ The issued Electrical bills close eight descriptions '… required for a complete installation a indicated' — 'a' for 'as'. It is a typo repeated through those sheets. DO NOT reproduce it; the correct closer is Family 3. Recorded so a comparison against those bills does not read the corrected wording as a deviation.

## R1  Generally

### R1.1

**What POMI says.**

> Installations and auxiliary installations shall be classified by function and given separately under an appropriate heading.

**Unit.** `—` — no arithmetic — a descriptive, definitional or administrative rule

**The formula.** None — this clause carries no arithmetic.

**The rule.** Installations and auxiliary installations CLASSIFIED BY FUNCTION, each under its own heading.

### R1.2

**What POMI says.**

> Installations shall be measured in accordance with the relevant clauses in this section; alternatively, they may be enumerated on a locational basis (for example, lighting installation to ground floor).

**Unit.** `—` — no arithmetic — a descriptive, definitional or administrative rule

**The formula.**

```
measured to the relevant clauses of this section
```

**The rule.** POMI permits MEASUREMENT to the clauses of this section or, expressly, ENUMERATION ON A LOCATIONAL BASIS. HOUSE ELECTION: MEASURED, matching Q1.2. Note R1.3 and R1.4 widen every clause below: 'cable' INCLUDES tape and BUS-BAR TRUNKING, and 'conduit' INCLUDES TRUNKING, CABLE TRAY and DUCTING. So a rule about conduit is a rule about cable tray.

### R1.3

**What POMI says.**

> The references herein to 'cable' shall be understood to Include tape, bus-bar trunking or the like.

**Unit.** `—` — no arithmetic — a descriptive, definitional or administrative rule

**The formula.** None — this clause carries no arithmetic.

**The rule.** 'CABLE' INCLUDES tape, bus-bar trunking or the like.

### R1.4

**What POMI says.**

> The references herein to 'conduit' shall be understood to include trunking, cable tray, ducting or the like.

**Unit.** `—` — no arithmetic — a descriptive, definitional or administrative rule

**The formula.** None — this clause carries no arithmetic.

**The rule.** 'CONDUIT' INCLUDES trunking, CABLE TRAY, ducting or the like — so tray and trunking follow the conduit rules.

## R2  Main circuits

### R2.1

**What POMI says.**

> For the purposes of measurement, 'main' is defined as the 'incoming supply to the main distribution board within a building or complex'.

**Unit.** `—` — no arithmetic — a descriptive, definitional or administrative rule

**The formula.** None — this clause carries no arithmetic.

**The rule.** 'MAIN' = the incoming supply to the main distribution board within a building or complex.

### R2.2

**What POMI says.**

> Cable shall be measured by length.

**Unit.** `M` — by length, metres

**The formula.**

```
L = Σ L_cable
```

**The rule.** Main cable BY LENGTH.

### R2.3

**What POMI says.**

> Conduit shall be measured by length.

**Unit.** `M` — by length, metres

**The formula.**

```
L = Σ L_conduit
```

**The rule.** Main conduit BY LENGTH.

## R3  Sub-main circuits

### R3.1

**What POMI says.**

> For the purposes of measurement, 'sub-main' is defined as the 'supply from the main distribution board to a sub-main distribution board'.

**Unit.** `—` — no arithmetic — a descriptive, definitional or administrative rule

**The formula.** None — this clause carries no arithmetic.

**The rule.** 'SUB-MAIN' = the supply from the main distribution board to a sub-main distribution board.

### R3.2

**What POMI says.**

> Cable and conduit to individual sub-main circuits shall be enumerated and separately identified as may be appropriate; alternatively, sub-main circuits may be measured in accordance with clause R2.

**Unit.** `NR` — enumerated — a count

**The formula.**

```
N = count of sub-main circuits, separately identified
```

**The rule.** Cable and conduit to individual SUB-MAIN circuits ENUMERATED and SEPARATELY IDENTIFIED; POMI's express alternative permits them to be measured by length per R2. HOUSE ELECTION: ENUMERATED PER CIRCUIT, separately identified — a sub-main is a discrete run between two discrete boards, and identifying it by its boards makes it checkable against the single-line diagram. THE TIER IS DECIDED BY WHICH BOARDS THE CABLE RUNS BETWEEN, not by its size or route: incoming supply to the main DB is R2 (by length), main DB to a sub-main DB is R3, and anything onward to a termination point is R4 (as points).

## R4  Final sub-circuits and auxiliary installations

### R4.1

**What POMI says.**

> Cable and conduit to termination points shall be enumerated, classified as follows: 1. Lighting points 2. Lighting switch points, stating whether one-way, two-way or intermediate 3. General purpose socket outlets; multi-gang socket outlets or the like shall count as one point 4. Equipment points, stating type of equipment or the electrical rating; contactors, starters or the like shall be measured separately as equipment points 5. Auxiliary installation points (for example, bell push, telephone outlet).

**Unit.** `NR` — enumerated — a count

**The formula.**

```
N = Σ points, per class
```

**The rule.** CABLE AND CONDUIT to termination points ENUMERATED AS POINTS — and read that literally: the point carries THE CABLE AND THE CONDUIT, and by R1.4 'conduit' also means TRUNKING, CABLE TRAY and DUCTING. IT DOES NOT CARRY THE ACCESSORY: ceiling roses, switches, socket outlets and bell pushes are separately enumerated under R5.1, and both are billed at each position. FIVE classes: 1 lighting points · 2 lighting switch points, STATING one-way, two-way or intermediate · 3 general purpose socket outlets — A MULTI-GANG OUTLET COUNTS AS ONE POINT · 4 equipment points, STATING type of equipment or electrical rating; CONTACTORS AND STARTERS ARE MEASURED SEPARATELY AS EQUIPMENT POINTS · 5 AUXILIARY INSTALLATION POINTS, e.g. bell push, telephone outlet. Where a circuit is enumerated as a point, DO NOT ALSO MEASURE ITS CABLE OR CONTAINMENT BY LENGTH — that is the double count.

## R5  Accessories

### R5.1

**What POMI says.**

> Ceiling roses and pendants, lighting switches, socket outlets, bell pushes or the like shall be enumerated.

**Unit.** `NR` — enumerated — a count

**The formula.**

```
N = count
```

**The rule.** Ceiling roses, pendants, lighting switches, socket outlets and bell pushes ENUMERATED. HOUSE ELECTION: BOTH R4.1 AND R5.1 ARE BILLED AT EACH POSITION — R4.1 counts the POINT (the cable, conduit, tray, boxes and terminations reaching the position) and R5.1 counts the ACCESSORY fitted to it (the switch plate, the socket face). Two items per position, deliberately, because they are supplied and fixed at different times by different people. This is NOT the R4.1 double count — that one is measuring a point AND a cable LENGTH for the same final circuit, which remains forbidden.

## R6  Control gear

### R6.1

**What POMI says.**

> Switchgear, distribution gear, contactors, starters, composite switchboards or the like shall be enumerated.

**Unit.** `NR` — enumerated — a count

**The formula.**

```
N = count
```

**The rule.** Switchgear, distribution gear, CONTACTORS, STARTERS and composite switchboards ENUMERATED. HOUSE ELECTION: CONTACTORS AND STARTERS ARE BILLED TWICE, DELIBERATELY — as an EQUIPMENT POINT under R4.1 cl.4 (the circuit reaching the device, which POMI directs in terms) and as CONTROL GEAR here (the device itself). Two items, not one. POMI's own wording at R4.1 cl.4 requires the first; this clause requires the second.

## R7  Equipment

### R7.1

**What POMI says.**

> Transformers, generators, standby power cubicles, luminaries, external lighting columns, clocks, loudspeakers, bells or the like shall be enumerated.

**Unit.** `NR` — enumerated — a count

**The formula.**

```
N = count
```

**The rule.** Transformers, generators, standby cubicles, luminaires, external lighting columns, clocks, loudspeakers, bells.

### R7.2

**What POMI says.**

> Controls, which shall include accessories and interconnecting cables, shall be measured in accordance with the relevant clauses in this section; alternatively, they may be included with the items of equipment.

**Unit.** `—` — no arithmetic — a descriptive, definitional or administrative rule

**The formula.**

```
included with the items of equipment
```

**The rule.** Controls — which INCLUDE ACCESSORIES AND INTERCONNECTING CABLES — measured to the relevant clauses of this section or, expressly, INCLUDED WITH THE ITEMS OF EQUIPMENT. HOUSE ELECTION: INCLUDED WITH THE EQUIPMENT, matching the Q5.3 election so the two MEP sections treat controls the same way. THE INTERCONNECTING CABLES GO WITH THEM — they are not measured again under R2, R3 or R4.

## R8  Connections to supply mains

### R8.1

**What POMI says.**

> Connections to supply mains shall be enumerated, subject to clause GP8.

**Unit.** `NR` — enumerated — a count

**The formula.**

```
N = count
```

**The rule.** Connections to supply mains, SUBJECT TO GP8.

## R9  Sundries

### R9.1

**What POMI says.**

> Sundries shall be measured in accordance with clause P2.

**Unit.** `ITEM ×5`

**The formula.**

```
per P2.1
```

**The rule.** Electrical sundries.

## R10  Work incidental to electrical engineering installations

### R10.1

**What POMI says.**

> Work incidental to electrical engineering installations shall be measured in accordance with clause P3.

**Unit.** `ITEM` — an ITEM — a priced line with no quantity

**The formula.**

```
per P3.1
```

**The rule.** Electrical incidental work.

## 0.13 PROVISIONAL — what to do when the information is not clear

`[GP2.2]` is a **duty**, not a fallback: bills shall describe and represent the works, and
**work which cannot be measured accurately SHALL BE DESCRIBED AS APPROXIMATE**, or given in
bills of approximate quantities.

**Where the information is not clear, the item is marked PROVISIONAL.** Never estimated into
a precise-looking figure, and never silently omitted. Both failure modes are worse than the
mark:

| | What happens |
|---|---|
| **Invented precision** | a risk nobody has priced is transferred to the contractor, and nothing on the face of the bill says so |
| **Silent omission** | the contractor finds it after award, when it is a claim rather than a quantity |

**A provisional item carries four things:**

```
1  the quantity          as best it can be derived from what IS available
2  the word PROVISIONAL  in the description, not in a footnote
3  WHY                   what is missing, and which document would settle it
4  the technical query    raised to close it, by its TQ reference
```

⚠ **`[GP2.2]` is what makes "I do not know" a compliant answer.** An item marked provisional
with its reason and its query is POMI-compliant. A confident wrong number is not.

⚠ **The take-off row says so too.** Where the extraction chain returns `SCALE_UNVERIFIED` or
`ABSENT`, or a schedule is not issued, the row is provisional and the `POMI clause` column
carries `GP2.2` alongside the measurement clause.

## 0.14 DAYWORKS — six blocks, not four

`[GP9]` gives dayworks nine clauses. The shape is three cost heads, each with its own
addition item:

| | The schedule | Its addition |
|---|---|---|
| **Labour** | `[GP9.1]` categories × **provisional hours** | `[GP9.7]` |
| **Materials** | `[GP9.3]` materials × **provisional quantities** | `[GP9.7]` |
| **Plant** | `[GP9.5]` categories × **provisional hours** | `[GP9.7]` |

```
Daywork Labour       one priced line per category   x provisional hours
  + Item: addition of establishment charges, overheads and profit
Daywork Materials    one priced line per material   x provisional quantity
  + Item: addition of establishment charges, overheads and profit
Daywork Plant        one priced line per category   x provisional hours
  + Item: addition of establishment charges, overheads and profit
```

⚠ **`[GP9.7]` says the addition is given to EACH of the sums or schedules.** Three schedules
produce **three** addition items. A single combined addition cannot be applied when only one
of the three is expended.

**What each rate covers, fixed by POMI:**

| Clause | The basis |
|---|---|
| `[GP9.2]` | labour: wages, bonuses and **all allowances** to operatives **directly engaged**, including those operating plant and transport, per the employment agreement or the actual payments |
| `[GP9.4]` | materials: the **NET INVOICED PRICE, INCLUDING DELIVERY TO SITE** |
| `[GP9.6]` | plant: **fuel, consumable stores, repairs, maintenance and insurance** |

⚠ **`[GP9.5]` says EXCLUSIVELY.** Only plant employed **exclusively** in dayworks belongs
here. Plant shared with the permanent works is an **overhead** under `[GP9.8]` cl.4 and must
not appear in the daywork schedule at all.

⚠ **Dayworks sits with the preliminaries, not in a measured bill** — it has no POMI section
letter of its own. It is `GP9`, and it is priced against a schedule the tenderer completes.

---

# PART 1 — THE GP1.2 RECORD: EVERY HOUSE DECISION, DECLARED

`[GP1.2]` requires that amendments to POMI **shall be stated**, and provides an appendix for
recording them. `[GP1.1]` permits more detail than POMI requires. Every house decision falls
into exactly one of three kinds, and each is disclosed differently:

| Kind | Means | Disclosed |
|---|---|---|
| **AMENDMENT** | the house measures **differently from POMI** | in **POMI's own Appendix** under `[GP1.2]`. Without that record the bill is **defective**, not merely unconventional |
| **ELECTION** | POMI offers a **choice** and the house has picked one | in the **PREAMBLES**. POMI is being followed — but a cross-check written for the other limb reads a correct take-off as an error, so the bill must say which limb is in force |
| **EXTENSION** | POMI is **silent**; detail added under `[GP1.1]` | on the item or in the preambles. Never smuggled |


## AMENDMENTS — 3

### `E2.6`

**POMI says.** Protective treatment to structural metalwork SHALL BE GIVEN AS AN ITEM.

**The house does.** Protective treatment is MEASURED BY AREA.

**Why.** The treated area is the cost driver — a galvanising or intumescent system prices per square metre of surface, and the surface area of a tonne of steel varies by a factor of several between a heavy stanchion and a light truss. An item forces the tenderer to compute the area himself from the same drawings, price a risk he cannot see, and it cannot be valued on variation. The area is measured; the SYSTEM stays in the description.

### `take-off tabs J1 / N / S`

**POMI says.** POMI letters its sections A B C D E F G H J K L M N P Q R. K is Accessories, M is Furnishings, N is Special Construction, and THERE IS NO SECTION S.

**The house does.** The take-off carries the office's own tabs: J1 ID FINISHES (a sub-tab of J), N FURNISHINGS (POMI's M), and S COMMS & ELV (inside POMI's R).

**Why.** The tabs follow how the packages are let and priced, not how POMI letters its sections. POMI remains what the work is MEASURED to, so every tab declares its POMI section and every row carries its POMI clause. Without that declaration a tab lettered S would be measuring against a section POMI does not have.

### `Section L placement`

**POMI says.** POMI gives EQUIPMENT its own section, L, distinct from FURNISHINGS at M.

**The house does.** There is NO L TAB. Equipment arrives as a supplied schedule and is billed straight into the N tab alongside furnishings.

**Why.** The two arrive together on these projects, as one schedule from one supplier, and splitting them across two tabs splits one procurement package. The distinction is not lost: EVERY ROW DECLARES ITS OWN POMI CLAUSE, so an L1.2 equipment item and an M1.2 furnishing item are distinguishable on the sheet and in the bill even though they share a tab.

## ELECTIONS — 42

### `D2.1 cl.3`

**POMI says.** Cavity walls measured as a COMPOSITE ITEM including skins and cavity; ALTERNATIVELY the skins and cavity may EACH be measured by area.

**The house does.** THE COMPOSITE ITEM. One area at one description carrying the whole build-up.

**Why.** It prices as one operation, and a composite description carries the whole build-up where a checker can see it. What matters more than the choice is that the bill states it: a cross-check written for the composite method reads a correct skin-by-skin take-off as a double count.

### `D2.2`

**POMI says.** Faced or fair faced work SO DESCRIBED; ALTERNATIVELY measured as EXTRA OVER walls.

**The house does.** EXTRA OVER. The wall area stays whole and the faced area is measured AS WELL, STATING WHETHER ONE SIDE OR BOTH.

**Why.** It keeps one wall quantity for the whole elevation and prices the facing against it, which is how the work is actually carried out. NO DEDUCTION is made from the walling — the same discipline as B8.5 rock, B15.2 rock boring and G2.3 special sheets.

### `D4.1`

**POMI says.** Fabric reinforcement to masonry measured in accordance with Section C by AREA; ALTERNATIVELY by LENGTH.

**The house does.** BY LENGTH for bed-joint reinforcement.

**Why.** Brick-force is bought, laid and paid by the metre of bed joint. An area for a strip a few centimetres wide is a number nobody prices against.

### `C2.3`

**POMI says.** Items of differing thickness MAY be grouped together, PROVIDED THAT THE RANGE of the different thicknesses is stated.

**The house does.** Grouping is used, but ONLY WITHIN ONE CONSTRUCTION STAGE — substructure, superstructure, roof. Never across stages.

**Why.** A 200 mm raft and a 200 mm roof slab do not price alike, so a range spanning them tells a tenderer nothing. Grouping removes the individual thickness statement C2.1 cl.4, cl.5 and cl.6 require, so the stated range is what carries that duty and it must be tight.

### `E3.2 / E3.3`

**POMI says.** Handrails measured BY LENGTH, EXCEPT WHERE INCLUDED WITH A STAIRCASE. Staircases enumerated.

**The house does.** The handrail is a SEPARATE LENGTH ITEM, and the enumerated staircase is DESCRIBED AS EXCLUDING IT.

**Why.** This is POMI's own exception read the other way, and it is within the clause: the handrail is only inside the staircase where the bill puts it there. Separating them prices the two properly — a stair balustrade is a different trade and a different rate from the stair. THE STAIRCASE DESCRIPTION MUST SAY 'excluding handrail' or the two readings collide and the handrail is either billed twice or not at all.

### `F5.1`

**POMI says.** Framework shall be measured by AREA, TAKEN OVERALL; ALTERNATIVELY it may be measured by LENGTH.

**The house does.** AREA, TAKEN OVERALL.

**Why.** A stud framework is a surface. Measuring the studs by length over-measures for the same reason open-spaced battens do under F4.1, and it puts the item in a unit that cannot be summed with the area items around it.

### `F6.3`

**POMI says.** Shelving shall be measured by AREA; ALTERNATIVELY it may be measured by LENGTH.

**The house does.** BY LENGTH, with the depth stated in the description under GP5.2.

**Why.** Shelving is bought and fixed by the running metre at a stated depth. An area for a 300 mm shelf is a number nobody prices against.

### `F6.6`

**POMI says.** Plastic coverings shall be DESCRIBED WITH THE ITEM on which they occur, STATING WHETHER ON ONE OR MORE FACES; ALTERNATIVELY they may be measured separately by area.

**The house does.** DESCRIBED WITH THE ITEM.

**Why.** This is POMI's primary limb. A laminated worktop is a worktop described as laminated on the top and front edge, not a worktop plus an area of laminate. 'One or more faces' stays a MANDATORY STATEMENT either way — it is the difference between one face and four at the same running length.

### `G3.1`

**POMI says.** Damp-proof courses shall be measured by LENGTH; ALTERNATIVELY they may be measured by AREA.

**The house does.** BY LENGTH, with the WIDTH stated in the description under GP5.2.

**Why.** A DPC is bought and laid by the roll at a stated width. The width is then a mandatory statement, not a courtesy — a length with no width is not a quantity anyone can price.

### `G4.1`

**POMI says.** Insulation shall be measured by AREA; ALTERNATIVELY it may be DESCRIBED WITH items of composite roofing.

**The house does.** A SEPARATE AREA ITEM.

**Why.** It keeps the insulation visible on the face of the bill and valuable on variation, where the alternative buries it in the roofing rate. The two limbs are MUTUALLY EXCLUSIVE: a composite roofing item whose description mentions insulation, plus a separate insulation area, bills it twice — and the second row reads perfectly reasonably.

### `G2.2`

**POMI says.** Eaves, ridges, skirtings, fascias, flashings and aprons shall be measured by LENGTH; ALTERNATIVELY, skirtings, fascias or the like TO COMPOSITE ROOFING may be measured by AREA.

**The house does.** LENGTH THROUGHOUT — the alternative is not used.

**Why.** One trim unit for the whole section rather than two. The alternative is narrow in any case: skirtings and fascias only, and only to composite roofing. It never reaches flashings, ridges or aprons.

### `G2.3`

**POMI says.** Roof lights, ventilators, soaker collars and special roofing sheets shall be ENUMERATED; ALTERNATIVELY, SPECIAL ROOFING SHEETS may be measured as EXTRA OVER roofing.

**The house does.** ENUMERATE ALL FOUR. Extra over is not used.

**Why.** The counts are unambiguous, and extra over is the limb that gets mis-applied — the same no-deduction discipline as B8.5, B15.2 and D2.2, and the one people reverse. The alternative never reached roof lights, ventilators or soaker collars in any case.

### `H1.2`

**POMI says.** Jambs, heads, sills, mullions and transomes shall be measured by LENGTH; ALTERNATIVELY, FRAME AND LINING SETS may be ENUMERATED.

**The house does.** ENUMERATED SETS, each fully described under GP5.1.

**Why.** Door schedules are issued as types, so a set per type keeps one bill line per schedule row and survives a schedule revision. With no length in the item the DESCRIPTION is the only thing saying how big the frame is, so it must carry the girth and the material.

### `H3.1`

**POMI says.** Screens, borrowed lights and curtain walling shall be measured by AREA; ALTERNATIVELY they may be ENUMERATED.

**The house does.** BY AREA.

**Why.** Curtain walling prices per square metre. A '1 nr curtain wall' cannot be priced, cannot be valued on variation, and cannot be compared between tenderers.

### `H5.3`

**POMI says.** Glass louvres shall be ENUMERATED; ALTERNATIVELY they may be measured by LENGTH, STATING THE NUMBER.

**The house does.** ENUMERATED.

**Why.** The count is the quantity and it reconciles against the window schedule. Note the alternative never permits length alone — the number is mandatory under either limb.

### `H4.1 / F10.1`

**POMI says.** Units or sets of ironmongery shall be ENUMERATED. The clause appears TWICE in POMI, word for word, at H4.1 and at F10.1.

**The house does.** ALL ironmongery is billed under H4.1, whatever the door is made of. F10.1 is never used.

**Why.** The two clauses are identical, so ironmongery to a timber door could legitimately be billed in either section — and if the office uses both, the sets get counted twice across two bills with nothing on the face of either showing it. One home for every set.

### `J4.1`

**POMI says.** Non-slip inserts, dividing strips, metal angle beads and lathing at junctions of differing backgrounds shall be measured by LENGTH; ALTERNATIVELY, they may be DESCRIBED WITH THE ITEMS IN WHICH THEY OCCUR.

**The house does.** DESCRIBED WITH THE ITEM. No separate linear item is raised.

**Why.** Consistent with the F6.6 treatment of plastic coverings, and it keeps a finishes bill from carrying a linear item for every bead. THE FINISH DESCRIPTION MUST NAME THEM — beads, stops, dividing strips, lathing at junctions — or the rate is not bound to anything. The two limbs are mutually exclusive: a bead length plus a description mentioning beads bills them twice.

### `L1.2`

**POMI says.** Each category of equipment shall be given as an ITEM; ALTERNATIVELY, individual items of equipment may be ENUMERATED.

**The house does.** ENUMERATED. Category-as-an-item is never used.

**Why.** An 'Item' for laboratory or kitchen equipment prices nothing, compares between tenderers on nothing, and cannot be valued on variation. Equipment arrives as a schedule, so a count against that schedule is both available and checkable.

### `M1.2`

**POMI says.** Each category of furnishing shall be given as an ITEM; ALTERNATIVELY, individual items may be ENUMERATED or MEASURED BY LENGTH, as may be appropriate.

**The house does.** ENUMERATED for discrete items, BY LENGTH for continuous ones. Category-as-an-item is never used.

**Why.** Same reason as L1.2. Curtains and blinds are continuous and price by the metre; chairs and rugs are discrete and price by the number.

### `N3.1`

**POMI says.** Installations of a specialist nature shall EACH BE GIVEN AS AN ITEM; ALTERNATIVELY, they may be MEASURED IN ACCORDANCE WITH THE RELEVANT SECTIONS.

**The house does.** MEASURED TO THE RELEVANT SECTIONS — and the DESCRIPTION carries the specialist nature, naming the installation the item belongs to and the specification clause that governs it.

**Why.** Measuring to the relevant sections prices against known work rather than a lump. But the measurement moving section must not move the SPECIFICATION with it: radiation shielding measured as lead-lined boarding under F is priced as ordinary boarding unless the words say what it is. THE MEASUREMENT MOVES SECTION; THE SPECIFICATION DOES NOT.

### `P3.2 / J6.3 cl.11 and cl.12`

**POMI says.** Protective and decorative painting to conveying systems shall be given as AN ITEM FOR EACH SYSTEM. J6.3 cl.11 (large pipes, trunking) and cl.12 (structural metalwork) measure decoration by AREA, in each case 'UNLESS MEASURED AS INCIDENTAL WORK'.

**The house does.** MEP PAINTING IS BILLED IN THE MEP SECTIONS — P3.2, and its Q and R counterparts. J6.3 cl.11 and cl.12 are NOT used for anything inside an MEP package.

**Why.** POMI's own qualifier makes this an election, not a conflict: under this election MEP painting IS incidental work, so the J6.3 classes stand down. The two overlap by design and billing both double-pays — with both rows reading correctly, which is why it survives a check.

### `P2.1 / Q8.1 / R9.1`

**POMI says.** An item shall be given for each of five sundries — supports, identification, testing and commissioning, tools and spares, documents. The same list is adopted by Section Q and by Section R.

**The house does.** EACH MEP SECTION CARRIES ITS OWN SET OF FIVE. They are not consolidated across the MEP package.

**Why.** Conveying, mechanical and electrical are let and priced as separate packages, often to separate specialists. One consolidated set of five could not be apportioned between them, and could not be valued when one package varies.

### `Q1.2`

**POMI says.** Installations shall be MEASURED in accordance with the relevant clauses of this section; ALTERNATIVELY, they may be ENUMERATED ON A LOCATIONAL BASIS.

**The house does.** MEASURED.

**Why.** The locational alternative dissolves the section into counts that price nothing a checker can test and cannot be valued when the layout changes.

### `Q5.3`

**POMI says.** Sensing and activating devices, control panels, air compressors and receivers shall be ENUMERATED (Q5.1); ALTERNATIVELY, automatic control systems shall be GIVEN AS AN ITEM FOR EACH INSTALLATION, BUT EQUIPMENT COMMON TO MORE THAN ONE SYSTEM SHALL BE ENUMERATED.

**The house does.** AN ITEM PER INSTALLATION — with the clause's own exception applied in full: SHARED EQUIPMENT IS STILL ENUMERATED.

**Why.** Controls are let as a specialist package against a functional specification, so an item per installation matches how the work is bought. The exception is not optional and it is the part that gets dropped: a shared control panel, compressor or receiver serving two installations must be counted separately, or it sits inside one installation's item and the others are priced without it.

### `GP5.2 — pipework diameter basis`

**POMI says.** For items of pipework IT SHALL BE STATED WHETHER THE DIAMETER IS INTERNAL OR EXTERNAL. POMI does not say which to use.

**The house does.** INTERNAL DIAMETER, converted from a nominal or external figure where the schedule gives that instead.

**Why.** POMI expresses the Q2.2 60 mm fittings threshold as an INTERNAL diameter, so stating any other basis puts the bill and the rule on different measures. A pipe quoted at 65 mm EXTERNAL may be under 60 mm internal, and a whole class of enumerated fittings appears or disappears on the basis alone. The same threshold governs J6.3 cl.11 against J6.4.

### `Q6.1 / R8.1`

**POMI says.** Connections to supply mains shall be ENUMERATED, SUBJECT TO CLAUSE GP8. GP8.1 makes work which may only be carried out by a government or public authority a SUM exclusive of profit, with a separate profit item, and GP8.2 adds an attendance item.

**The house does.** WHERE THE AUTHORITY HOLDS THE MONOPOLY the GP8 route applies and it is NOT a measured connection: a SUM, a PROFIT ITEM and an ATTENDANCE ITEM. Three lines, never one. Only where the contractor may lawfully make the connection himself is it enumerated.

**Why.** In the UAE every potable water, sewer and district-cooling connection is an authority monopoly, so the GP8 limb is the normal case rather than the exception. Enumerating it prices a connection the contractor is not permitted to make, and leaves the authority's own charge with nowhere to sit.

### `R1.2`

**POMI says.** Installations shall be MEASURED in accordance with the relevant clauses of this section; ALTERNATIVELY, they may be ENUMERATED ON A LOCATIONAL BASIS.

**The house does.** MEASURED.

**Why.** Matches the Q1.2 election so the two MEP sections are read the same way.

### `R3.2`

**POMI says.** Cable and conduit to individual SUB-MAIN circuits shall be ENUMERATED and separately identified; ALTERNATIVELY, sub-main circuits may be MEASURED in accordance with R2.

**The house does.** ENUMERATED PER CIRCUIT, separately identified by the boards it runs between.

**Why.** A sub-main is a discrete run between two discrete boards. Identifying it by its boards makes it checkable against the single-line diagram, which a length cannot be.

### `R4.1 / R5.1`

**POMI says.** Cable and conduit to termination points shall be ENUMERATED AS POINTS (R4.1). Ceiling roses, switches, socket outlets and bell pushes shall be ENUMERATED (R5.1).

**The house does.** BOTH are billed at each position — the POINT and the ACCESSORY fitted to it.

**Why.** They are supplied and fixed at different times by different people: the point is the cable, conduit, tray, boxes and terminations reaching the position; the accessory is the plate on the front. This is NOT the R4.1 double count — that one is measuring a point AND a cable LENGTH for the same final circuit, which stays forbidden.

### `R4.1 cl.4 / R6.1`

**POMI says.** Equipment points shall state the type of equipment or electrical rating; CONTACTORS, STARTERS OR THE LIKE SHALL BE MEASURED SEPARATELY AS EQUIPMENT POINTS (R4.1 cl.4). Switchgear, distribution gear, contactors, starters and composite switchboards shall be ENUMERATED (R6.1).

**The house does.** CONTACTORS AND STARTERS ARE BILLED TWICE, deliberately — once as the equipment point, once as the control gear.

**Why.** POMI directs both in terms: R4.1 cl.4 requires the circuit reaching the device to be measured as an equipment point, and R6.1 requires the device itself to be enumerated. Two items, and a bill carrying only one of them is short.

### `R7.2`

**POMI says.** Controls, which shall include accessories and interconnecting cables, shall be MEASURED in accordance with the relevant clauses of this section; ALTERNATIVELY, they may be INCLUDED WITH THE ITEMS OF EQUIPMENT.

**The house does.** INCLUDED WITH THE EQUIPMENT — and the interconnecting cables go with them, not measured again under R2, R3 or R4.

**Why.** Matches the Q5.3 election so controls are treated the same way in both MEP sections.

### `GP5.6`

**POMI says.** The description of items MAY REFER TO OTHER DOCUMENTS OR DRAWINGS and any reference to such information SHALL BE UNDERSTOOD TO FULFIL any requirement of these principles; ALTERNATIVELY, reference may be made to published information.

**The house does.** REFERENCE IS USED, and it is what makes the Family 1 and Family 2 closing formulas sufficient — but ONLY to a document ISSUED WITH THE BILL under GP2.3.

**Why.** A reference discharges POMI's description duty, so a reference to a document the tenderer does not hold discharges the duty against nothing. Published information (a standard, a code) may be referenced because the tenderer can obtain it; a project document may not unless it is in the tender set.

### `GP9.1 / GP9.3 / GP9.5 — DAYWORKS`

**POMI says.** The cost of labour, of materials, and of constructional plant employed exclusively in dayworks shall EACH be given AS A SUM; ALTERNATIVELY, a SCHEDULE of the different categories may be given CONTAINING A PROVISIONAL QUANTITY of hours, or of materials, for each category.

**The house does.** A SCHEDULE with provisional quantities, for all three. Sums are not used.

**Why.** A sum cannot be compared between tenderers — it is one number against one number, and it reveals nothing about the rates that will actually be applied when daywork is ordered. A schedule prices each category, so the tender is comparable AND the rates are fixed before anyone needs them. The quantities are provisional by POMI's own wording and are adjusted on the actual, so the schedule costs nothing in accuracy.

### `A6.1 cl.2`

**POMI says.** Telephones for the employer, INCLUDING COSTS OF CALLS; ALTERNATIVELY, the cost of calls may be given AS A SUM.

**The house does.** THE COST OF CALLS IS GIVEN AS A SUM, separately from the telephone provision.

**Why.** Call charges are unknowable at tender and depend entirely on how the employer's team uses them. Leaving them inside the facilities particulars makes the contractor price an open risk; a sum adjusts on the actual.

### `B5.3`

**POMI says.** Demolishing INDIVIDUAL STRUCTURES (or part thereof) shall EACH be given as an item; ALTERNATIVELY, demolishing ALL STRUCTURES on a site may be given as ONE item.

**The house does.** EACH STRUCTURE ITS OWN ITEM, stating its location per B5.1.

**Why.** B5.1 requires the location of each item, which a single all-structures item cannot give. And demolition is routinely varied — one building descoped, another added — which a single lump cannot be valued against.

### `B8.5`

**POMI says.** Excavation in rock shall be SO DESCRIBED; ALTERNATIVELY, it may be measured as EXTRA OVER excavation — the volume of rock measured but NO DEDUCTION from the excavation in which it occurs.

**The house does.** EXTRA OVER.

**Why.** Consistent with the D2.2 election. It keeps ONE excavation quantity for the whole dig and prices the rock against it, which is how the work is carried out and how a variation is valued. Rock is found, not designed, so the base quantity must not move when it is.

### `B19.5`

**POMI says.** Inspection chambers or the like shall be ENUMERATED; ALTERNATIVELY, they may be MEASURED in accordance with the relevant sections and given under an appropriate heading.

**The house does.** ENUMERATED.

**Why.** B19.3 already deems the concrete surrounds and additional excavation of drainage accessories included, so the section is built around counting. Measuring a chamber through C, D and B for a handful of chambers produces more rows than it does certainty.

### `C5.2`

**POMI says.** Reinforcement to precast concrete shall be measured in accordance with C3 AND GIVEN UNDER AN APPROPRIATE HEADING; ALTERNATIVELY, it may be DESCRIBED IN THE ITEM.

**The house does.** DESCRIBED IN THE ITEM.

**Why.** A precast unit is bought as a unit, at a rate that includes its steel. Separating the reinforcement produces a weight nobody prices independently and a unit rate that then has to be read net of it.

### `C5.4`

**POMI says.** Lintels, sills and duct covers shall be measured by LENGTH; ALTERNATIVELY, DUCT COVERS may be measured by AREA.

**The house does.** BY LENGTH throughout — the duct-cover alternative is not used.

**Why.** One unit for the whole clause. Consistent with the F6.3 shelving election: a cover is bought and laid by the running metre at a stated width, and the width is a GP5.2 mandatory statement anyway.

### `C7.5`

**POMI says.** Forming sinkings, channels or the like shall be measured by LENGTH and, WHERE APPROPRIATE, THE ITEM MAY INCLUDE additional excavation, hardcore, shuttering and concrete; ALTERNATIVELY, they may be ENUMERATED.

**The house does.** BY LENGTH, AND THE ITEM INCLUDES the additional excavation, hardcore, shuttering and concrete.

**Why.** The inclusive limb is the point of the clause: a channel is one operation and splitting it into four trades produces four rows that must then be kept in step. Because the item is inclusive, NO SEPARATE excavation, hardcore, formwork or concrete is raised for it — that is the double count this election exists to prevent.

### `C7.6`

**POMI says.** Fixings, ties and inserts shall be ENUMERATED; ALTERNATIVELY, they may be measured by AREA.

**The house does.** ENUMERATED.

**Why.** They are discrete objects at discrete positions. An area of cast-in channel or of wall ties is a density, not a quantity, and it cannot be checked against a drawing.

### `F9.1`

**POMI says.** Metalwork items associated with woodwork shall be ENUMERATED; ALTERNATIVELY, WATERBARS or the like may be measured by LENGTH.

**The house does.** ENUMERATED, EXCEPT waterbars and the like, which are measured BY LENGTH.

**Why.** POMI's own split, taken as written: discrete ironmongery-like objects are counted, a continuous bar is measured. Note this clause does NOT reach metalwork inside an F7.1 COMPOSITE ITEM, where all metalwork is deemed included.

## EXTENSIONS — 9

### `C3.1 / C3.2`

**POMI says.** The weight of bar reinforcement shall be the NET WEIGHT without addition for rolling margin, supports, spacers or tying wire. POMI does not say where the bar arrangement is read from.

**The house does.** Reinforcement is MEASURED FROM THE SECTION DRAWINGS. Laps are measured at the SPECIFIED LAP LENGTH at the positions the sections show. A bar bending schedule, where one is issued, is A CROSS-CHECK ONLY.

**Why.** At tender no BBS is issued, so a method depending on one has no answer at tender and a different answer later — the take-off must give the same figure at both. A BBS is the FABRICATOR'S CUTTING LIST on its own revision cycle, not the designed arrangement. The section drawing is issued with the tender under GP2.3 and is therefore the document the contractor priced against. A variance against a later BBS is a finding to record and query, not a correction to apply.

### `B4.1`

**POMI says.** Removing isolated trees shall be ENUMERATED. POMI states no size classification.

**The house does.** Enumerated BY GIRTH BAND.

**Why.** A rate for 'remove tree' with no girth cannot be priced — a sapling and a mature ghaf are the same item under POMI and two different jobs on site.

### `A9.1 cl.9`

**POMI says.** An item shall be given for sundry items, which shall include ALL STATUTORY OBLIGATIONS.

**The house does.** The statutory obligations head is EXPANDED into a stated list under A9.2 — municipality permits, NOCs, civil defence approvals, authority coordination and third-party inspections.

**Why.** POMI gives it one phrase. In the UAE it is the most under-priced line in a preliminaries bill, and A9.2 is POMI's own mechanism for turning it from a blank cheque into a defined scope.

### `GP3.1`

**POMI says.** Each measurement shall be taken to the nearest 10 millimetres. POMI does not say whether the rounding is applied to each dimension or to the product.

**The house does.** Each dimension is rounded AS IT IS TAKEN, then multiplied. Never the product.

**Why.** Rounding the product hides which dimension was read, so a checker cannot re-derive the row from the drawing.

### `GP3.5`

**POMI says.** Notwithstanding these principles, a separate minor building or structure MAY be enumerated.

**The house does.** Available but NEVER automatic. A guard house, pump room or substation is measured through unless a run explicitly elects to enumerate it, and the election is recorded.

**Why.** POMI says 'may'. A default that quietly enumerates would lose the detail that makes a bill checkable, and nothing on the face of the bill would show it had happened.

### `F1.2`

**POMI says.** Descriptions of timber members SHALL STATE whether the sizes are BASIC (before machining) or FINISHED (milled, within permitted deviations). POMI does not say which basis to use.

**The house does.** FOLLOW THE PROJECT DESCRIPTION — take whichever basis the specification and drawings use, and state it. No house default, and no conversion between the two.

**Why.** The basis belongs to the design, not to the measurer. A '50 x 200' quoted basic finishes at about 45 x 195 — same words, different timber, different price — so converting one to the other silently changes the specification. The statement is mandatory; its value comes from the source documents.

### `J2.1 / J2.2 / J3.1`

**POMI says.** Backgrounds shall be measured by area and each so described. Finishings shall be measured by area. POMI does not say in terms that both are measured over the same surface.

**The house does.** A BACKGROUND IS ALWAYS MEASURED SEPARATELY FROM THE FINISH ON IT — two areas over one surface.

**Why.** They are two operations by two trades at two times. Letting the screed sit inside the tiling rate makes it invisible on the face of the bill and unvaluable on variation, and it is the commoner error by far — nobody bills the screed twice, they bill it never.

### `K1.1`

**POMI says.** Accessories are defined as specially manufactured or proprietary items NOT INCLUDED IN OTHER SECTIONS. POMI says nothing further about how they are described.

**The house does.** K IS TESTED LAST, and EVERY K ITEM IS FULLY DESCRIBED — what the thing is, what it is made of, how it is fixed, and its schedule or type reference.

**Why.** The section is defined by EXCLUSION, so its heading says nothing about what an item is. Only the description can. And testing K last stops work being pulled out of the sections that would price it properly.

### `D3.2`

**POMI says.** Arches shall be measured by LENGTH. That is the entire clause — POMI states no basis along which the length is taken.

**The house does.** The length is taken on the MEAN GIRTH: L = pi x (R_intrados + t/2) x (theta/180) for a curved arch.

**Why.** Both the span and the intrados understate the work; the mean girth is the line the masonry actually follows, and on a semicircular arch the three differ by about 45 per cent. POMI is silent, so this is the HOUSE's basis and it is declared rather than presented as the standard's.

---

# PART 2 — THE CROSS-CHECKS A TAKE-OFF MUST SURVIVE

These are arithmetic identities, not opinions. A take-off that fails one of them is wrong somewhere, **even when every individual row looks right**.

## 12.1 Excavation ↔ disposal `[B11.1]`

```
V_disposal_total  ==  V_excavation_total  +  V_dredging  +  V_tunnelling      EXACTLY
V_backfill + V_removed  ==  V_disposal_total
```

## 2 Excavation ↔ substructure concrete

```
V_excavation  ≥  V_concrete_below_ground  +  V_blinding  +  V_hardcore
```
The dig must at least contain what is built in it. Where it does not, either the excavation is
short or a foundation has been measured that nothing was dug for.

## 3 Concrete ↔ formwork **HOUSE**

For a rectangular member, the ratio of shuttered area to concrete volume has a knowable range.
Outside it, one of the two is wrong:

```
r  =  A_shutter / V_concrete            m²/m³
```

| Member | Typical `r` | Read as |
|---|---|---|
| slab, 200 mm, soffit only | ≈ 5.0 | `1/t` |
| wall, 250 mm, both faces | ≈ 8.0 | `2/t` |
| column, 400 × 400 | ≈ 10.0 | `perimeter / A_sect` |
| beam, 300 × 600 under a 200 slab | ≈ 7–9 | |
| foundation, mass, sides only | ≈ 1–3 | |

⚠ `r` far **above** the range usually means formwork was measured to faces that are cast against
earth or against existing construction. Far **below** usually means a face was missed.

## 4 Concrete ↔ reinforcement **HOUSE**

```
ρ_rebar  =  W_rebar_kg / V_concrete_m3          kg/m³
```

| Element | Typical range |
|---|---|
| blinding | 0 |
| mass foundation | 30 – 60 |
| raft, ground beam | 90 – 160 |
| suspended slab | 80 – 130 |
| column | 150 – 300 |
| beam | 120 – 220 |
| core / shear wall | 100 – 200 |

These are **sense checks, not rules**. A figure outside the range is a question to answer, not
a quantity to change — and the answer goes in the run audit either way.

## 5 Wall finishes ↔ wall area **HOUSE**

```
A_finish  ≈  A_wall_structure  ×  (number of finished faces)
             −  Σ voids ≥ 1.00 m² and all edge voids
             +  Σ reveals, returns, columns          [J3.1 class 2]
```
The `+` term is the one that gets dropped, and it always makes the finish **larger** than the
structure.

## 6 Doors and windows ↔ their voids

```
count(door items, H1.1)     ==  count(door voids deducted from walls)
count(window items, H2.1)   ==  count(window voids deducted from walls)
```
⚠ A door counted in H but never deducted from D or J means the wall and its plaster were paid
for through the opening. A void deducted with no door item means the door was never billed.

## 7 Roof area ↔ pitch `[G2.1]`

```
A_slope  ==  A_plan / cos θ                  θ = roof pitch from horizontal
```
If `A_slope == A_plan` on a pitched roof, the roof was measured on plan and is under-measured
by the table in §6.2.

## 8 Drainage ↔ excavation `[B9.2]`

```
if drain trenches measured by LENGTH under B9.2
   then  NO separate disposal and NO separate filling rows for those trenches
```
Both are deemed included. Their presence is a double count.

## 9 MEP points ↔ cable **HOUSE**, from `[R4.1]`

```
if final sub-circuits enumerated as POINTS
   then  NO cable or conduit length measured for those same circuits
```

---

---

# PART 3 — THE NINETEEN ERRORS THAT COST THE MOST

Ranked by what they typically do to a bill, worst first. Every one of them produces a take-off
in which each individual row is defensible.

| # | Error | Clause broken | Typical effect |
|---|---|---|---|
| 1 | Excavation measured with working space / battering / bulking | `[B8.2]` | **+25 to +40%** on the dig |
| 2 | Pitched roof measured on plan, not on slope | `[G2.1]` | **−13 to −29%** on the covering |
| 3 | Rock or faced work DEDUCTED from the item it is extra over | `[B8.5] [D2.2]` | loses the whole base item |
| 4 | Cavity wall: the composite and the skin-by-skin methods **MIXED** in one bill | `[D2.1] cl.3` | **×2** on the masonry where they overlap. Measuring the skins and cavity separately is **not** an error — POMI expressly permits it — measuring them separately **as well as** the composite item is |
| 5 | Beam measured full depth through the slab | `[C2.1] cl.8` | +30 to +50% on beam concrete |
| 6 | Rebar uplifted by a BLANKET lap percentage | `[C3.1] [GP3.1]` | +5 to +10%, and uncitable. Laps themselves ARE measured — C3.1 excludes rolling margin, supports, spacers and tying wire, NOT laps. What fails is the percentage, which names no location and cannot be re-derived |
| 7 | Fabric reinforcement uplifted for laps | `[C3.3]` | +8 to +15% |
| 8 | MEP fittings enumerated on pipes ≤ 60 mm | `[Q2.2]` | bills work already in the rate |
| 9 | Final sub-circuit cable measured AND the point enumerated | `[R4.1]` | double-counts final distribution |
| 10 | Attached column measured separately from its wall | `[C2.1] cl.6` `[J3.1] cl.2` | double count, invisible |
| 11 | Edge void under 1.00 m² not deducted | `[GP3.3]` | small each, endemic |
| 12 | Duct insulation billed by weight instead of area | `[Q7.2]` | whole-item unit error |
| 13 | Irregular glass measured to its true shape | `[H5.1]` | up to **−50%** on that pane |
| 14 | Open-spaced battens measured as timber length, not overall area | `[F4.1]` | ×2 to ×3 |
| 15 | Partition length deducted for its doors | `[K2.1]` | under-measures and double-pays |
| 16 | Decoration take-off copied from the finishes take-off | `[J6.3]` vs `[J3.1]` | J6.3 has **twelve** classes, J3.1 has four. Copying loses cornices, general and isolated general surfaces, windows, radiators, gutters, large pipes and structural metalwork — **eight** whole classes |
| 17 | Multi-gang socket counted as several points | `[R4.1] cl.3` | ×1.5 to ×3 on the socket count |
| 18 | Ductwork weight uplifted for seams, stiffeners and supports | `[Q3.1]` | +10 to +15%, all deemed included |
| 19 | Tunnel-to-shaft intersections billed at plain tunnel rates | `[B24.1] cl.7` | loses the most expensive m³ on the job |

---

# PART 4 — WHAT IS HANDED OVER

Four things, and the measurement defends itself:

1. **The take-off workbook** — every quantity a live `Nr x dimensions` build-up the client can
   click into, one tab per discipline, with the pivot that feeds the bill.
2. **The marked-up drawings** — call-out tags and a legend showing exactly what was measured
   on each sheet, colour-coded by POMI section, every tag carrying the item code.
3. **The bill** — in the issue format above: A4 portrait, the eight columns, the 62-row page,
   collection page per section, bill summary, grand summary, amount in words.
4. **The audit tabs** — an independent re-measure with variances, anything flagged as
   substantive, and drawing-to-section coverage naming **every gap** (for example rebar
   pending a bar bending schedule).

Plus a short methodology note: **POMI as the standard**, the traceability rules, and the
**evidence-only rule — nothing is measured that is not on a drawing.**

---

# PART 5 — THE COUNT RECONCILIATION

For doors, windows, fittings, plant and every other schedule-driven item, **the count IS the
quantity**, so the check is not a bubble on every instance — it is:

```
schedule count  ==  number of plan tags            K18, EXACT equality
```

Not a tolerance. A door is a whole number and a discrepancy of one is a real discrepancy.
The same reconciliation covers wall marks and core marks, so it reaches every enumerated
discipline — `H`, `L`, `M`, and the tagged items in `B`, `P`, `Q` and `R`.

---
