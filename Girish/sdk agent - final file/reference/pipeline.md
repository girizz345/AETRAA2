# Staged, gated pipeline — enforcing completeness and honesty

The take-off runs as a sequence of stages, each with a script that can HALT the
run. The point is to remove discretion: a take-off cannot be presented as a
deliverable while a file is unread, a scheduled element is unmeasured, or a
quantity is fabricated/assumed. Run the stages in order; do not skip a failing gate.

## Stage 1 — input validation & manifest
`python scripts/stage1_validate.py <input_dir> --out manifest.json`

Registers every input file, classifies it, and confirms at least one measurable
source (drawing PDF or DXF). **Halts (exit 2)** if there is nothing to measure.
The manifest is the spine of the no-skipping rule — every measurable file must later
be marked processed, and the Stage 3.5 coverage gate fails if any is still unread.

## Stage 2 — inventory reconciliation
`python scripts/stage2_reconcile.py inventory.json takeoff.json --out reconcile.json`

`inventory.json` is the AUTHORITATIVE element list read from the schedules
(every column mark, every wall, every core). The stage checks that each scheduled
element appears in the take-off and **fails (exit 1)** on any that is scheduled but
unmeasured. This is the check that catches a whole discipline being skipped (e.g.
shear walls present on the wall schedule but absent from the take-off). Build the
inventory from the schedule sheets first — it is the master against which coverage
is judged.

## Stage 2b — drawing-by-drawing extraction (strict no-skip)
`python scripts/extract_drawings.py <input_dir> --manifest manifest.json --out evidence.json`

Walks every drawing one at a time and records a per-drawing extraction (title block,
marks, sizes, reinforcement tokens, vectors). Its rule: **no drawing may be skipped.**
Each is visited and marked OK / EMPTY / ERROR. If any measurable drawing is EMPTY
(e.g. a scan with no text layer) or ERROR, it **halts (exit 1)** — you must supply a
readable copy or pass `--allow-empty` to record it explicitly as a gap (which then
must appear in AN.COVERAGE). This is what makes "every sheet was read" a coded fact,
not a claim. It also updates each file's status in the manifest, feeding the Stage
3.5 G6 coverage gate.

## Stage 3 — propose the take-off
The measurement itself: read each element from the drawings/schedules, apply the
POMI rules (see `ref-pomi-rules.md` — `pomi-measurement.md` is WITHDRAWN), and
assemble the take-off JSON
(see `takeoff-format.md`). Every quantity is `Nr × basis`; missing inputs are left
blank/flagged, never filled. Capture `markup` coordinates for call-outs.

## Stage 3.5 — gate check (must pass before building)
`python scripts/stage3_5_gate_check.py takeoff.json --manifest manifest.json --reconcile reconcile.json`

Five content gates plus coverage; any FAIL exits non-zero:
- **G1 NULL-QTY** — a measured line with no dimensions and no quantity, on a
  non-`pending` item.
- **G2 DUPLICATE** — a repeated item code.
- **G3 PERCENT/FACTOR** — a quantity derived by bare factor/percentage/ratio or a
  per-area rule (dimension cross-products and timesing are fine).
- **G4 FABRICATION** — a fabrication/assumption token (typical, **assumed**, approx,
  TBC, nominal, generic …) in a priced item. An assumed storey height in a priced
  concrete item fails here — which is correct: resolve the input or mark the item
  `pending`, do not ship the assumption.
- **G5 NO-UNIT** — an item with no unit.
- **G6 COVERAGE** — any manifest file unread, or any Stage 2 element MISSING.

If a value genuinely cannot be evidenced (e.g. no section for storey height), the
honest resolution is to leave those quantities `pending` and list the required
drawing — not to bake in an assumption that G4 will (rightly) reject.

## Stage 4 — build outputs
`python scripts/build_takeoff.py takeoff.json out.xlsx` — the workbook (live
formulas, linked collection, R34 hyperlinks).
`python scripts/markup_drawings.py takeoff.json <pdf_dir> <out_dir>` — the call-out
marked-up drawings + index.

Build only after Stage 3.5 passes. A run that reaches Stage 4 with gates failing is
not a take-off — it is a draft with known holes, and must be reported as such.
