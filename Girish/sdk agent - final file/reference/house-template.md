# HOUSE TEMPLATE — LOCKED (R-VERBATIM)

**Version 2.0 — measured from the issued tender bills.** Every figure below was read out of
the client's own workbooks, not inferred and not designed. `verify_template.py` diffs the
produced workbook against this file and **fails the run** on any deviation.

> **Supersedes the Enabling Works template**, which is withdrawn to
> `house-template-ENABLING-WORKS-WITHDRAWN.md`. That template was measured honestly, but off
> a single 5-page PDF that turned out not to be this office's issue format: it had US Letter
> paper, Calibri 8.9 pt, six Excel columns and a fully ruled grid. The issued bills are A4,
> Arial 10 pt, eight Excel columns and vertical rules only. **A workbook built to the old
> template is not this format and never was.** Do not read that file to build anything.

**Source of measurement.** Eleven issued tender workbooks — a Cover, Pricing Preambles, a
Grand Summary and Bills 1 to 8 — comprising 61 non-cover sheets and several hundred bill
pages. Figures below are the values those sheets actually carry; where the set is not
unanimous the spread is stated and the house value named.

**No project identity is recorded here.** Client, project, package, building, section
content, quantities and rates are *fields the run fills*, never constants. Only wording that
is the same on every job is frozen.

---

## 1. SHEET SET-UP

| | value |
|---|---|
| Paper | **A4** (`paperSize = 9`) |
| Orientation | **portrait** |
| Margins | left 0.25″ · right 0.25″ · top 0.5″ · bottom 0.5″ · header 0.25″ · footer 0.25″ |
| Header / footer text | **none** — the page head is drawn in cells, not in Excel's header |
| `print_title_rows` | **not set** — the band is repeated as real rows, so a page break in the wrong place shows up as a visibly wrong page rather than a silently right one |
| Explicit row breaks | **none** — pagination is by the fixed 62-row rhythm below |
| Row height | **12.75** throughout |
| Font | **Arial**, in three sizes. Measured 660/660 pages: the project band's own lines **10 pt bold**; the labels beside them (`BILL OF QUANTITIES`, `BILL NO.`, `PAGE NO.`) and the whole column-head band **8 pt regular**; the section title in `D` **9 pt bold**; the body **10 pt regular**, with section and element headings and the totals **bold**. The band is not one size — an earlier reading assumed 10 pt throughout and was wrong |

---

## 2. COLUMNS

Excel character widths, workbook default font.

| Col | Width | Carries |
|---|---|---|
| A | **4.711** | item reference — one letter |
| B | **1.711** | spacer. Carries no value and no vertical rule |
| C | **31.711** | item description |
| D | **15.711** | description overflow; also the head band's `BILL OF QUANTITIES` / section title, and `To Collection` |
| E | **8.711** | quantity |
| F | **5.711** | unit |
| G | **12.711** | unit rate |
| H | 15.711 | total price |

**A to G are unanimous across the bill pages.** Re-measured independently across all eight
issued workbooks — 128 sheets, of which **59 carry the `BILL OF QUANTITIES` head band and are
therefore bill pages** — column `A` is 4.711 on 50 of the 59.

H is the money column and the issued set does not agree with itself:

| H width | bill pages |
|---|---|
| **14.711** | **23** |
| 15.711 | 8 |
| 16.141 | 5 |
| 18.57 | 3 |
| 17.426 | 3 |

**The house value is 14.711** — the plurality by a clear margin. *(An earlier reading of this
file named 15.711; that was the third most common, not the first, and it was corrected when
the set was re-measured against the workbooks rather than against this file.)*
`verify_template.py` accepts 14.5 to 18.0 on H alone and fails any deviation on A to G.

### Cover sheets have their own geometry

The 69 non-bill sheets — covers and summaries — carry **`A` = 9.711**, not 4.711, on 68 of
69. A cover is not a bill page and is not held to the bill-page widths.

**B, C and D are one visual cell.** No vertical rule falls between them, so the reader sees
six columns where the workbook has eight. Description text is written into **C** and wraps by
starting a new row, never by `wrapText` — see §4.

---

## 3. THE PAGE — 62 ROWS

A page starts at row `P`, where `P = 1, 63, 125, 187, …`. Everything below is an offset from
`P`. This rhythm holds on 341 of the issued pages; the drifts that exist in the set are
single-sheet lapses and are not the format.

| Offset | Row | Content |
|---|---|---|
| P+0 | project band 1 | `A` client · `D` **`BILL OF QUANTITIES`** · `G` **`BILL NO.`** · `H` **`PAGE NO.`** |
| P+1 | project band 2 | `A` project |
| P+2 | project band 3 | `A` package · `D` SECTION TITLE · `G` bill/section code · `H` bill/section/page code |
| P+3 | project band 4 | `A` building or sub-package |
| P+4 | spacer | `C` and `F` each hold a single space |
| P+5 | column head 1 | `A` **`ITEM`** · `C` **`ITEM DESCRIPTION`** · `E` **`QUANTITY`** · `F` **`UNIT`** · `G` **`UNIT`** · `H` **`TOTAL PRICE`** |
| P+6 | column head 2 | `A` **`REF.`** · `G` **`RATE`** · `H` **`AED`** |
| P+7 | blank | |
| P+8 | section heading | `SECTION {L} - {TITLE}` on the first page of a section; `SECTION {L} - {TITLE} (CONT'D)` on every later page |
| P+9 … P+54 | **body — 46 rows** | items, element headings, description continuation lines and blank separators |
| P+55 … P+59 | blank tail | five rows, always blank |
| P+60 | To Collection | `D` **`To Collection`** · `H` `=SUM(H{P+9}:H{P+54})` |
| P+61 | blank | closes the page |

The body is **46 rows**. It is not a target — an item that does not fit starts the next page.

### Page codes

`BILL NO.` is `{bill}/{section}` — e.g. `6/1`. `PAGE NO.` is `{bill}/{section}/{page}` — e.g.
`6/1/1`, `6/1/2`. The page number restarts at 1 for each section, not for each bill.

**A bill with no sections uses the TWO-PART form** `{bill}/{page}` — e.g. `8/1`, `8/2`.
Measured across the issued set: **286 three-part codes and 17 two-part**, and every two-part
code is in the **Dayworks** bill, which has no POMI section of its own because it is `[GP9]`.
A builder that assumes three parts cannot produce a dayworks bill.

---

## 4. THE BODY

**One row is one line.** Description text is broken across consecutive rows of column `C` by
the builder, at the measured wrap width. `wrapText` is **not** used anywhere in the body: a
wrapped cell changes height, and a changed height breaks the 62-row page.

An item occupies its rows like this — reference and figures on the **first** row only:

```
A   C                                                    E      F     G      H
─────────────────────────────────────────────────────────────────────────────────
    Excavation                                                              ← element heading
                                                                            ← blank
    Excavation in any type of classified soil or hard                       ← description block,
    strata as per site levels, depth, Specifications,                          no item ref
    Drawings, soil report, etc.
                                                                            ← blank
A   Excavation to receive foundation bases, raft, ramp    193    m3    …    =E*G
    and grade slab                                                          ← continuation, no ref
                                                                            ← blank
```

### THE DESCRIPTION-AND-VARIANTS STRUCTURE — the house billing convention

This is how the issued bills compose an item, and the STRUCTURE is used in **every one of
the 31 bill sheets** — including Equipment, Furnishings and Signage. What varies by
discipline is what the variants vary BY: thicknesses in Concrete and Masonry, **sizes** in
Mechanical and Electrical, widths and types in Finishes, and **named schedule references,
not sizes**, in Equipment and Furnishings (0 sized runs out of 35 and 25 respectively). Do
not expect a size; expect the structure. The wording formulas differ by discipline too — see
`description-conventions.md`.

```
Walls                                                  ← element heading, one line
                                                       ← blank
Precast concrete block, bedded and jointed in cement   ← DESCRIPTION BLOCK
mortar including wall ties, bed, joints, reinforcement,   no item ref, no quantity,
head restraint, ties and anchors including wall head,     no rate. Two lines or more.
vertical and base, joints, filler, sealant and grouting
complete in accordance with the Specifications and
Drawings
                                                       ← blank
Hollow Block Walls                                     ← sub-heading, one line (optional)
                                                       ← blank
A   Walls, 100mm thick, type C0a        34   m2   95   ← VARIANTS. One row each,
                                                          one blank row between.
B   Walls, 150mm thick, type C0b        24   m2  101
                                                          Each inherits the
C   Walls, 200mm thick, type C0c        46   m2  106      description above.
```

On MEP the variants are pipe sizes — `20mm PPR Piping`, `25mm`, `32mm`, `40mm`, `65mm`,
`80mm` — under one *"Supply and install all Domestic Water Piping System … including but not
limited to all piping, fittings, angles, ells, tees, reducers, valves, heads, supports…"*.
On Concrete they are thicknesses; on Finishes, widths. Same structure every time.

**Why this is one spec entry (`kind: "item_group"`) and not a narrative followed by loose
items.** The description is what makes the rate binding. A line reading `20mm PPR Piping` at
16.00 says nothing about whether the rate covers the fittings, the valves, the supports or
the testing — the paragraph above it does, and that paragraph is what the contractor is held
to. Split them into separate spec entries and a later edit can move one without the other,
leaving a priced size with nothing behind it. So:

- The builder emits the description block once, then every variant, as **one atomic group**,
  and the group never splits across a page — a contractor pricing page 5 cannot read page 4.
- `verify_template.py` **fails** a run of sized variants that has no description block of two
  or more lines above it, looking back past any one-line sub-heading.

The item letters run straight through the group — the variants take the next letters in the
page's sequence, they do not restart.

### Item serial letters — A, B, C … and NEVER I or O

They run **A, B, C, D, E, F, G, H, J, K, L, M, N, P, Q, R, S …** — restarting at **A** on
every page, and **skipping both I and O**. They are not sequential through a section.

Measured across every sheet in the issued set: `I` appears **zero** times and `O` appears
**zero** times as an item reference; the longest observed page runs
`A B C D E F G H J K L M N P Q R S`. Confirmed by the office as the house rule.

The reason to gate this rather than trust it: `I` next to `1` and `O` next to `0` is exactly
the confusion a priced bill cannot afford, and the error is invisible once printed — every
*other* letter on the page still looks right, so nothing draws the eye to it.

`verify_template.py` rebuilds the expected sequence for each page and fails on any deviation.
Run against the issued bills it finds nine pages that break the rule — one uses `I`
(`…G H I J L M N`), one repeats itself (`A B A B C D E F…`), and seven skip letters where an
item was deleted in a revision and the sequence was never re-lettered (`A C E G H J K`,
`A B D E`, `A B C D F G`, `C D E`). Those are defects in those pages, not in this rule.

### Per-column body style

| Col | Align | Number format — house value |
|---|---|---|
| A | center | General |
| C | left | General |
| E | right | `#,##0_);[Red](#,##0)` |
| F | center | General |
| G | — | `#,##0.00_);[Red](#,##0.00)` |
| H | right | `_(* #,##0.00_);_(* (#,##0.00);_(* "-"??_);_(@_)` — Accounting |

**Two formats are in issue and neither is a defect.** Counted over every priced row in all
eleven workbooks:

| Column | bracketed-red | Accounting | house value |
|---|---|---|---|
| QUANTITY | 1,129 | 768 | bracketed-red |
| RATE | 1,290 | 339 | bracketed-red |
| AMOUNT | 675 | **1,192** | **Accounting** |

So the money column is mostly Accounting and the other two are mostly bracketed-red. The
builder writes the majority for each column; the gate accepts either, because asserting one
would fail the client's own bills. The two differ exactly where a bill is read hardest — at
zero and at a negative — so do not treat them as interchangeable when reading a rate back.
Do not substitute one for the other because they look similar in a populated cell — they
differ exactly where a bill is read hardest, at zero and at a negative.

### Non-numeric entries in the money columns

The issued bills write words where a figure would mislead, and they are frozen strings:

| Entry | Means |
|---|---|
| `item` | in `F`, the unit for a lump-sum item |
| `Included` | in `H`, priced within another item |
| `N.A` | in `H`, not applicable to this project |
| `By OSE` | in `H`, by others / owner-supplied |

---

## 5. BORDERS — VERTICAL RULES ONLY

Thin, black. The page is **not** a ruled grid: horizontal rules appear only at the band
boundaries. Reproducing this as a fully ruled table is wrong.

| Rows | Left | Right | Top | Bottom |
|---|---|---|---|---|
| P+0 | A | C · D · G · H | A · B · C · D · E · F · G · H | — |
| P+1 … P+2 | A · D · G · H | A · C · D · F · G · H | — | — |
| P+3 | A · D · G · H | A · C · D · F · G · H | — | G · H |
| P+4 | A · E · F · G · H | A · E · F · G · H | A · B · C · D · E · F · G · H | — |
| P+5 | A · E · F · G · H | A · E · F · G · H | — | — |
| P+6 | A · E · F · G · H | A · E · F · G · H | — | A · B · C · D · E · F · G · H |
| P+7 … P+60 | A · E · F · G | A · E · F · G · H | — | — |
| P+61 | A · E · F · G | A · E · F · G · H | — | A · B · C · D · E · F · G · H |

Read down the page, the rules stand at: left of A, right of A, left of E, right of E, right
of F, right of G, right of H. **B, C and D carry no rule** — that is what makes them read as
one description column.

---

## 6. FROZEN STRINGS

Reproduce character for character, including the trailing spaces and the double space marked.

### Head band
```
BILL OF QUANTITIES
BILL NO.
PAGE NO.
ITEM
REF.
ITEM DESCRIPTION
QUANTITY
UNIT
RATE
TOTAL PRICE
AED
```

### Page foot
```
To Collection
```

### Continuation
A section heading repeated on a later page takes `` (CONT'D) `` — upper case, straight
apostrophe. An element heading repeated takes `` (Cont'd) `` — title case. The two are
different in the issued bills and both are frozen.

**Counted across the eight workbooks:**

| String | Count | |
|---|---|---|
| `(CONT'D)` | **155** | the house form |
| `(Cont'd)` | **87** | the house form |
| `(CONT'D.)` | 13 | **a trailing-period variant in the issued set** |
| `(Cont'd.)` | 10 | same |

The period variants are a minority and are **not** reproduced. They are recorded so that a
comparison against those sheets does not read the correct string as a deviation.

```
SECTION {L} - {TITLE} (CONT'D)
{Element} (Cont'd)
```

### List any additional items

Closes a section, on its own page, immediately after the column head band. Five lines of
`C`, one per row, blank row between the heading and the paragraph, then two rule lines:

```
LIST ANY ADDITIONAL ITEMS

The Tenderer shall list below and price any items not
included herein but contained in the Tender Drawings, 
mentioned in the Specifications or required for the 
satisfactory completion of this section. Any such item 
not listed below shall be deemed to be included

------------------------------------------------

------------------------------------------------
```

Lines 2, 3, 4 and 5 each end with a single trailing space. It is in the issued file; keep it.

### Collection page

Last page of a section. The column head band is **abbreviated** — only `C` = `ITEM
DESCRIPTION` and `H` = `TOTAL PRICE` / `AED`; no `ITEM`, `QUANTITY`, `UNIT` or `RATE`.

```
SECTION {L} - {TITLE}

COLLECTION

Page {bill}/{section}/1        =H{To Collection row of page 1}
Page {bill}/{section}/2        =H{To Collection row of page 2}
…

TOTAL FOR BILL NO. {bill}/{section}/{last page} - SECTION {L} - {TITLE}, 
CARRIED TO SUMMARY  - {summary ref}
```

The `TOTAL FOR …` line ends with a comma and a trailing space and continues on the next row.
`CARRIED TO SUMMARY` is followed by **two** spaces before the dash.

### Bill summary sheet

`D` = `SUMMARY`, then one row per section: `C` the last page code, `D` the section title,
`H` a link to that section sheet's `TOTAL FOR …` cell. Closes with:

```
TOTAL CARRIED TO FORM OF TENDER
```

### Grand summary sheet

`D` = `GRAND SUMMARY`, `H` page code `GS`. One row per bill: `C` = `BILL NO. {n}`, `D` = the
bill title, `H` a link to that bill's summary total. Closes with `TOTAL CARRIED TO FORM OF
TENDER` and, lower down:

```
AMOUNT IN WORDS
```

---

## 7. SECTION LETTERS AND TITLES

The issued bills letter their sections **exactly as POMI does**, and this is the independent
confirmation that the section-letter correction at `determinism.md` §4.11a is right:

| Letter | Title as issued |
|---|---|
| A | GENERAL REQUIREMENTS |
| B | SITE WORKS |
| C | CONCRETE WORK |
| D | MASONRY WORK |
| E | METALWORK |
| F | WOODWORK |
| G | THERMAL & MOISTURE PROTECTION |
| H | DOORS AND WINDOWS |
| J | FINISHES |
| K | ACCESSORIES |
| L | EQUIPMENT |
| M | FURNISHINGS |
| P | CONVEYING SYSTEMS |
| Q | MECHANICAL ENGINEERING INSTALLATIONS |
| R | ELECTRICAL ENGINEERING INSTALLATIONS |

**K is Accessories and M is Furnishings in the client's own issue.** There is no section S.
The issued titles differ from POMI's own wording in three places — POMI heads B *Site Work*
singular, D *Masonry*, and G *Thermal and Moisture Protection* spelled out. Those are
commercial headings and legitimate, but they are **declared** through `pomi_section_title`,
never assumed. G-SECTION tests the letter and the POMI title; the printed title is the
project's.

---

## 8. WORKBOOK ARCHITECTURE

One workbook per bill. Inside it, a **Cover sheet precedes every section sheet** — `Cover 1`,
`Summary`, `Cover 2`, `{first section}`, `Cover 3`, `{second section}`, and so on. Cover
sheets are A1:J38, use merged rows `A{n}:I{n}`, and carry the project identity only.

The Grand Summary is its own workbook and links to each bill workbook by external reference.

---

## 9. HOW THIS FILE IS ENFORCED

`verify_template.py` opens the produced workbook and re-derives every figure above
independently — widths, heights, fonts, number formats, border map, band offsets, the 62-row
rhythm, the `=SUM` ranges and every frozen string. It does not read the builder's constants;
if it did, the two would agree by construction and prove nothing.
