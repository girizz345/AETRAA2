# Drawing Markup & Call-outs — demonstrating the take-off

A take-off is only persuasive to a client if they can *trace every quantity back to
the drawing it came from*. This skill supports that two ways: the workbook links
each row to its drawing (R34), and `scripts/markup_drawings.py` stamps the reverse —
**call-out tags on the drawings** showing what was measured where. Together they let
a reviewer move freely between the number and the picture.

## Mark up the way the item is measured (full QS colour-up)

A professional take-off is "coloured up": every measured element is marked in its
trade colour, so an unmarked element is visibly un-measured. The markup type follows
the measurement type — three primitives cover every POMI discipline:

- **Area (m²)** — a translucent **shaded polygon** in the trade colour with the area
  label. Slabs, finishes, blockwork by elevation, formwork faces, tanking/roofing.
- **Linear (m)** — a **traced polyline** with the length label. Skirtings, kerbs,
  pipe/duct/cable runs, railings, DPC.
- **Count (nr/set/item)** — a **tag** at each instance, or a tag on the schedule row
  with the total, proven by a count reconciliation. Doors, windows, fittings, plant,
  lifts, columns-as-count.

Volume (m³) is area-shade × a stated thickness; prelims/PC sums are listed, not
spotted. Each marked drawing gets a **discipline colour legend** on its index page.

These are supplied in a top-level `markups` array, grouped by drawing `ref`:

```json
"markups": [
  {"ref":"{dwg-s2}","type":"area","page":1,"trade":"C","label":"Slab 540 m2",
   "points":[[300,260],[900,260],[900,780],[300,780]]},
  {"ref":"{dwg-s2}","type":"line","page":1,"trade":"Q","label":"CHW 16 m",
   "points":[[1300,400],[1300,1100]]},
  {"ref":"{dwg-s2}","type":"point","page":1,"trade":"H","x":540,"y":1475,
   "title":"D1 door","lines":["53 nr (schedule)"]}
]
```

`trade` is the POMI section letter (drives the colour + legend). Geometry comes from
the DXF where available (hatch areas, polylines, block points) and is model-traced on
vector PDFs otherwise. Points are PDF points (top-left origin).

### Count reconciliation — the proof for schedule-driven items
For doors/windows/fittings/plant the count is the quantity, so the check is
**schedule count = number of plan tags**, not a bubble on every instance:

```
python scripts/count_reconcile.py schedule_counts.json evidence.json --drawing <plan-sheet>
```

`schedule_counts.json` is `{"D1":53,"AHU-01":1,...}` from the schedules; `evidence.json`
(from `extract_drawings.py`) carries the plan-tag counts. The `--drawing` filter sums
tags from the relevant plan sheets only. Any mismatch fails (exit 1). This also
reconciles wall/core marks, so it covers every enumerated discipline.

## What the markup produces

For each drawing referenced in the take-off, a `"<drawing>_markup.pdf"` carrying:
- A **call-out tag** for every measured line that has a placement — a bubble with
  the item code and quantity (e.g. `C-B  720.00 m3`), a leader line, and a dot at
  the measured point, colour-coded by trade (POMI section).
- A **legend / index box** listing every item taken off that sheet: colour dot,
  item code, quantity, and a short description — so even lines without a spotted
  coordinate are accounted for on the drawing.
- The item code on the tag matches the take-off row exactly, so the workbook and the
  marked-up drawing cross-reference both ways.

This is the same idea as a Bluebeam / CostX marked-up take-off, generated
automatically from the measurement.

## How placement works (vector PDF)

Because the drawings are vector PDFs, the measurement pass can record where each
element sits. Add an optional `markup` block to a take-off line:

```json
{"ref":"{dwg}","level":"{level}","desc":"Raft slab 1200.00 x 0.60",
 "nr":1,"L":1200.00,"H":0.6,"location":"Grids {x}-{y}",
 "markup":{"page":1,"x":330,"y":250}}
```

`x`/`y` are PDF points (origin top-left, as PyMuPDF uses); `page` is 1-based. Capture
these while measuring — for an area, the centroid; for a run, its midpoint; for a
count, the item location. A line **without** a `markup` block still appears in the
sheet legend, so nothing is lost — it simply isn't spotted on the drawing. Never
invent a coordinate; if you cannot place it, leave it to the legend and note it.

## Running it

```
python scripts/markup_drawings.py <takeoff.json> <pdf_dir> <out_dir>
```

Requires PyMuPDF (`pip install pymupdf`). It reads the same take-off JSON the
workbook is built from, so the markup and the workbook can never disagree.

`<pdf_dir>` holds the source vector PDFs. Each drawing is resolved by its
`drawing_links` target basename (or `ref_link`), else `"<ref>.pdf"`. Drawings with
no source PDF are skipped and reported, so they can be recorded as a gap in
AN.COVERAGE.

## Demonstrating correctness to the client — the full package

Hand the client these four things and the measurement defends itself:
1. **The take-off workbook** — every quantity a live `Nr × dimensions` build-up they
   can click into, with the linked collection block.
2. **The marked-up drawings** — call-out tags + legend showing exactly what was
   measured on each sheet.
3. **The audit tabs** — AN.RECONCILIATION (independent re-measure + variances),
   AN.SUBSTANTIVE (anything flagged), AN.COVERAGE (drawing-to-section coverage and
   every gap, e.g. rebar pending a BBS).
4. **A short methodology note** — POMI as the standard, R34/R36 traceability, and
   the evidence-only rule (nothing measured that isn't on a drawing).
