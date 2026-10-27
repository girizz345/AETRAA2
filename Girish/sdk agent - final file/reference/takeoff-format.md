# Take-off Workbook Format — LEGACY v1

> **This is NOT the client's issued house format.** It describes the older
> multi-tab dimension-paper workbook rendered by `scripts/build_takeoff.py`,
> kept so that earlier runs can still be re-rendered. Its Arial 9 / blue header
> styling is that format's, not the house one.
>
> For anything issued to the client, the governing document is
> **`house-template.md`** v2.0 — Arial, the fourteen-column measurement sheet, the
> 62-row BOQ pages with vertical rules only, the COLLECTION page — rendered by
> `build_house_takeoff.py` and gated by `verify_template.py`.

The output is a multi-tab Excel **dimension-paper take-off**. Do not build the
workbook by hand — assemble a take-off JSON and render it with
`scripts/build_takeoff.py`, which guarantees the house format, the live formulas,
and the linked collection block. This file documents the JSON contract and the
format so you know what to produce.

## Workbook structure

- **INDEX** tab first: bill letter, discipline, and tab pointer for every section
  actually produced.
- One tab per POMI section present in the project, named `"<Letter>. <NAME>"`
  (e.g. `C. CONCRETE`). **Only emit sections the project contains** — detect from
  the evidence; do not pad with empty sections.
- Three audit tabs at the end: `AN.RECONCILIATION`, `AN.SUBSTANTIVE`,
  `AN.COVERAGE` (mandatory — see universal-rules.md).

## Section tab layout (fixed)

Two independent blocks sit side by side, with column M as a narrow spacer:

**Take-off block (cols A–L)** — the measurement, one item after another:

| A | B | C | D | E | F | G | H | I | J | K | L |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Ref (drawing) | Level / Floor | Item code | Element / build-up | Nr | L (m) | W (m) | H/Thk (m) | Qty each | Tot. | Unit | Grid / location |

Each item is: a **header row** (code in C, full spec narrative in D, both bold) →
one or more **dimensioned lines** → a **`qty to bill`** row whose J cell sums the
item's line totals.

- `I` (Qty each) = a live formula of whichever dimensions are present
  (`=F*G*H`, `=F*H`, …) or a direct value when the line gives `qty_each`.
- `J` (Tot.) = `=E*I` always (E is the `Nr` timesing multiplier).
- `qty to bill` J = `=SUM(...)` over the item's line totals.

**Collection block (cols N–P)** — an independent list from row 3, **one row per
item code**:

| N | O | P |
|---|---|---|
| Item code | Qty | Unit |

`O` is a **live formula** linking to that code's `qty to bill` cell
(`=J<row>`), so the collection always equals the take-off. (The sample file held
static values here; we link them per the agreed method so the workbook
recalculates.)

## Styling (matches the reference file exactly)

Handled by the builder — listed so you can verify:
- Font **Arial 9** throughout; tab title **Arial 11 bold** in A1.
- Header band row 2: white bold text on fill **`1F4E78`** (dark blue), wrapped,
  centred. Freeze panes at **A3**.
- Measurement lines: thin grey border on cols A–L. Item header row and
  `qty to bill` row: bold, no border.
- Collection block cells: fill **`E2EFDA`** (light green).
- Numbers: `#,##0.00`. No emoji, no colour-coding beyond the above.

## Item coding

`<SECTION LETTER>-<SEQUENCE>` running A, B, C … within the section
(`C-A`, `C-B`, …). Companion items (formwork, reinforcement) get their own
sequential codes; tie them to the parent element with a shared note in the
description (e.g. "raft R1") rather than a code suffix, unless a suffix reads
more clearly to the QS.

## JSON contract

```json
{
  "project": "Project name or null (NEVER hard-code a real project name in the skill)",
  "descriptor": "G+4+R or null",
  "sections": [
    {
      "letter": "C",
      "name": "CONCRETE",
      "items": [
        {
          "code": "C-A",
          "description": "Full POMI spec narrative: 100 mm blinding under raft, C15",
          "unit": "m2",
          "lines": [
            {"ref":"{dwg}","level":"{level}","desc":"Blinding to raft underside",
             "nr":1,"L":1200.00,"W":null,"H":null,"qty_each":720.00,
             "location":"Grids {x}-{y} / A-G"},
            {"memo":"basis / reuse note, rendered italic with no quantity"}
          ]
        }
      ]
    }
  ],
  "audit": {
    "reconciliation": [["sample","result","variance","action"]],
    "substantive":    [["row","gate","token","confidence","action"]],
    "coverage":       [["section","source document","available/assumed","note"]]
  }
}
```

### Drawing hyperlinks (R34)

Every tagged drawing number in the `Ref (drawing)` column (col A) should be a
**working hyperlink to its source drawing**, so anyone reviewing the take-off can
click a reference and open the drawing it was measured from. Provide a
`drawing_links` map at the top of the JSON, keyed by drawing number:

```json
"drawing_links": {
  "{dwg-s}": "drawings/{dwg-s}.pdf",
  "{dwg-a}": "Tender_Drawings.pdf#page=12",
  "CHW-LAYOUT": "https://docs.example.com/CHW-LAYOUT.pdf"
}
```

Targets may be a relative path (to a drawings folder beside the workbook), an
absolute path, or a URL; append `#page=N` to land on a specific page of a combined
PDF. The builder turns each matching col-A cell into a blue underlined hyperlink. A
single line may override the register with its own `"ref_link"`. If a drawing has no
entry, the reference stays as plain text (no fabricated link) and the gap can be
noted in AN.COVERAGE — never invent a path.

Item field notes:
- `"pending": true` on an item (used for reinforcement with no bar bending
  schedule) renders the element and its `Nr` floor multiplier with the quantity
  columns blank and a **"PENDING BBS"** flag in the qty-to-bill cell, instead of a
  computed total. The collection block reflects the same flag. Use it so rebar is
  always visible on the sheet without inventing a weight; also log the gap in
  `audit.coverage`.

Line field notes:
- Give **either** `L`/`W`/`H` dimensions (so `Qty each` computes live) **or** a
  direct `qty_each` when the area/volume is read straight off a schedule. If both
  appear, the dimensions win and `qty_each` is ignored.
- `nr` is the timesing multiplier (floor count, number of identical bays, both
  faces of formwork, …). Default 1.
- A `{"memo": "..."}` line renders as an italic, non-priced note — used for the
  formwork reuse / procurement basis and any other build-up commentary.
- An optional `"markup": {"page": 1, "x": 330, "y": 250}` block records where the
  element sits on its vector PDF drawing (PDF points, top-left origin), used by the
  drawing call-out markup. See `drawing-markup.md`. Omit it if you cannot place the
  item — it will still be listed in the drawing legend.
- `unit` is set once per item and flows to both the take-off `Unit` column and the
  collection block.
