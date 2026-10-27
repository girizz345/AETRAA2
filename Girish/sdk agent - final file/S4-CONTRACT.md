# S4 CONTRACT — Calibrate: grid, scale, levels → plan-measured lengths and heights

Binding on three builders working in parallel. Each owns the files listed
under its name and touches nothing else; the seams are the signatures below.
Invariants 1–8 hold: the model never produces a number; everything here is
deterministic code over the PDF text layer; every failure is a gap with a
reason, never a default. No project names in code.

Why: on a 69-sheet structural package the schedules gave count, width and
thickness of 69 columns/walls/beams and never a length. C2.1 (concrete by
volume) needs length. Lengths come from (a) storey heights — stated level
difference between the levels on the sections/plans — and (b) measurement to
a calibrated scale between the grid lines an element spans on a plan.

## Coordinate space
readers.extract words/paths are in "page-display-topleft-pt": upright page,
origin top-left, y down, page rect [0,0,W,H] after /Rotate is applied. Every
position in this contract is in that space.

## A. Origins, level table, storey heights — OWNER A
Files: spine/records.py, measure/evidence.py, measure/levels.py (new),
measure/intake.py, takeoff/rows.py, model/schema.py + model/prompts.py (the
`level_alias` judgement only), tests/test_levels.py (new).

### Origin (spine/records.py)
```
STATED="stated"     read from a schedule cell or a dimension string
DERIVED="derived"   arithmetic on stated figures: a stated level difference
COUNTED="counted"
MEASURED="measured" measured to a calibrated scale on a plan
INFERRED="inferred"
```
weakest_origin order: STATED, DERIVED, COUNTED, MEASURED, INFERRED.
check_citation: unchanged rule — a dimensional role from a scale-UNVERIFIED
sheet is refused unless origin is STATED or DERIVED (DERIVED inputs are
stated levels; it does not depend on scale).
takeoff/rows.py `_METHOD_BY_ORIGIN`: DERIVED → "stated level difference",
MEASURED → "measured to scale" (both already approved hygiene labels).

### Element (spine/records.py)
Add `location: str | None = None` (the storey the schedule row states) and
`bay: str | None = None` (set by C for plan-measured occurrences). Frozen
dataclass; defaults keep every existing constructor call valid.

### measure/levels.py
```
normalise_storey(text) -> str | None
    canonical keys: "FOUNDATION", "BASEMENT 1"…, "GROUND", "PODIUM 1"…,
    "MEZZANINE", "FLOOR 1"… (from "1ST FLOOR", "FIRST FLOOR", "LEVEL 1",
    "L01", "01", "1st floor"), "ROOF", "TOP OF ROOF", "LIFT MACHINE ROOM".
    None when the text is not a storey name. Pure function; tests list the
    spellings.
@dataclass Level: key, value: Decimal (metres), citations: list[(doc_id, raw)],
                  votes: int
class LevelTable: levels: dict[key, Level]; conflicts: list[(key, values)]
build_level_table(sheets, words_by_doc: dict[str, list[Word]]) -> (LevelTable, gaps)
    A level number is a token matching [+-]?\d{1,3}\.\d{2,3} (metres) — six
    digits or mm-scale integers are not levels. It is paired with a storey
    phrase on the same text band (|Δy| < 0.6 × token height, |Δx| < 300 pt),
    or with a "LVL"/"SSL"/"FFL"/"TOS"/"TOC" prefix whose band also names a
    storey. Consider section, elevation and plan sheets (all T2 sheets when
    routing is not yet known — S4 runs before S5). Votes across sheets; two
    different values for one key → both kept, gap "level FLOOR 1 stated as
    +4.500 and +4.650 on …". Values are Decimal; never rounded here.
storey_height(table, key) -> (Decimal metres, basis: str) | None
    next higher level (by value) minus this one; None at the top storey.
attach_heights(elements, base, table) -> (elements, gaps)
    For each element with `location`: key = normalise_storey(location) (or a
    key set by apply_aliases); h = storey_height(table, key). Make evidence
    id f"{type}:{mark}:{key}:length", value h, unit "m", origin DERIVED,
    doc_id = first citing sheet, role "length"; dims["length"] = id. No table
    entry → gap "storey 'Pod 1' not in the level table (levels read: …)".
alias_request(unknown: list[str], keys: list[str]) -> model.client.Request
    judgement "level_alias"; context lists the unknown location strings and
    the table's keys; enum = keys.
apply_aliases(payload, unknown, keys) -> dict[location -> key]
    Only answers inside `keys` are kept.
```
schema "level_alias": {"required": ("items",), "item_required": ("location",
"storey"), "enums": {}} ; prompt asks for a JSON array
[{"location": "<as written>", "storey": "<one of the set>"}].

### measure/intake.py
`build(schedules, base=None, split_by_location=True)`: when a schedule's
roles include "location", group rows by (type, mark, location) and set
Element.location; Element.mark stays the mark as written; sheets/evidence ids
as today; count from that group's rows. Elements without a location are
unchanged. `element_type_of` unchanged.

## B. Grid + scale from the text layer — OWNER B
Files: measure/grid.py (new), tests/test_grid.py (new). Nothing else.

Port the proven pass-A/pass-B arithmetic of
`/Users/ajay/aetraa-agents/AETRAA_SDK/agents/coordination_check/m2_grid.py`
(functions `_classify`, `_tag_bands`, `_cluster_anchored`, `_build_candidate`,
`_read_chain`, `_best_accepted`, `_build_accepted_axis`, `_build_bays`, and
the single-sheet calibration arithmetic inside `_calibrate`) into ONE
standalone module with the constants it needs inlined from
`coordination_check/cc_constants.py` (C28, C29, C50–C56) and documented. No
cc_* imports, no model, no rendering. Input is readers.extract words.
```
@dataclass GridMap:
    doc_id, W, H, rotation
    status: "CALIBRATED" | "PARTIAL" | "NONE"
    letters: list[(label, pos_pt)]   # sorted by pos
    numbers: list[(label, pos_pt)]
    letters_axis: "X" | "Y" | None   # which page axis the letter labels run along
    mm_per_pt: Decimal | None        # the calibrated scale
    scale_basis: str                 # "dimension chain: 3 bays agree within 4%" |
                                     # "title block 1:100 on A1 (unverified)" | "none"
    confidence: "HIGH" | "MED" | "LOW" | None
    chain: list[int]                 # the dimension chain read, mm
    basis: str                       # one line a reviewer can check
calibrate_sheet(words, W, H, rotation, doc_id, title_scale: str | None = None) -> GridMap
    CALIBRATED only when ≥ 2 chain values match the bubble pitches (variance
    within C55). PARTIAL when labels are read but no chain agrees — then
    mm_per_pt may come from `title_scale` ("1:100") with confidence LOW and
    scale_basis saying so; PARTIAL is NOT scale-verified. NONE when no axis.
gridline_positions(gm, page_axis: "X"|"Y") -> list[(label, pos_pt)]
bay_of(gm, x, y) -> str | None       # "C/3" style, None if outside or NONE
verified(gm) -> bool                  # status == "CALIBRATED"
page_size_and_rotation(pdf_path, page=0) -> (W, H, rotation)  # via pymupdf, in the same
                                                             # upright space as extract
```
Tests: synthetic word sets (a labelled axis + a chain that agrees; one that
does not; no labels) and, where present on disk (skip otherwise), a real
sheet from /Users/ajay/Documents/Projects/test boq and
/Users/ajay/Documents/Projects/BOQ Test 2 read-only, asserting status and a
plausible mm_per_pt for its title-block scale.

## C. S4 stage, plan lengths, wiring — OWNER C
Files: agent.py (S4 stage + S9 call-site only), spine/runstate.py (un-defer
S4), measure/plan_lengths.py (new), tests/test_plan_lengths.py (new),
tests/test_stage_calibrate.py (new).

### agent._stage_calibrate(ctx)  (S4; runstate.DEFERRED becomes empty)
For every T2 sheet (ctx["sheets"]): words = extract_words(path, 0);
W,H,rot = grid.page_size_and_rotation(path); gm = grid.calibrate_sheet(
words, W, H, rot, doc_id, title_scale=sheet.scale). Collect words_by_doc for
A. table, gaps = levels.build_level_table(sheets, words_by_doc).
Write grids.json ({doc_id: GridMap as dict, Decimals as str}) and
levels.json ({"levels": {...}, "conflicts": [...]}). Set ctx["grids"],
ctx["levels"], ctx["words_by_doc"] (kept for S9; drop after S9 to free
memory), ctx["scale_verified"] = {doc_id: verified(gm)}. Progress line every
25 sheets like S1. Return ["grids.json", "levels.json"]. Budget ≤ 1.5 s/sheet
on a 100-sheet package; if a sheet exceeds 5 s, record a gap and move on.

### measure/plan_lengths.py
```
locate_marks(mark, words) -> list[Region]
    occurrences of the mark on a sheet: a word equal to the mark, or
    consecutive words that join to it ("B 1" → "B1"), case-insensitive.
attach_lengths(elements, base, grids, words_by_doc, sheet_kinds) -> (elements, gaps)
    For each element WITHOUT dims["length"] whose type is in
    ("beam", "wall", "lintel", "kerb", "strip_footing"): search plan sheets
    (sheet_kinds[doc_id] == "plan" when known, else all CALIBRATED sheets).
    For each occurrence: axis = horizontal if the word box is wider than
    tall else vertical; the gridlines perpendicular to the element run are
    the ones whose positions vary along the element's axis; take the nearest
    gridline at or before and at or after the tag centre along that axis;
    length_mm = (hi − lo) × mm_per_pt. One occurrence → one sub-element:
    same mark, bay = grid.bay_of(gm, cx, cy), count 1, dims["length"] =
    f"{type}:{mark}:{bay}:length" (value metres, MEASURED, doc_id, region =
    tag bbox). Schedule count vs occurrences found is REPORTED (gap) when they
    differ, never reconciled here. Zero occurrences on any CALIBRATED plan →
    gap "length not measurable: no calibrated plan carries B1 (n plans
    PARTIAL/NONE)".
```
### S9 call-site (after intake.build)
```
elements, g = levels.attach_heights(elements, base, ctx["levels"])   # A
unknown = {e.location for e in elements if e.location and not in table}  → if AI on:
    resp = model.ask(levels.alias_request(sorted(unknown), keys)); aliases =
    levels.apply_aliases(resp.payload, …); re-run attach_heights for those.
elements, g = plan_lengths.attach_lengths(elements, base, ctx["grids"],
                                          ctx["words_by_doc"], kinds_from_routing_if_present)
for doc_id, ok in ctx["scale_verified"].items(): if not ok: base.mark_scale_unverified(doc_id)
```
elements.json summary gains {"with_length": n, "derived_heights": n,
"measured_lengths": n, "storeys": [...]}.

## Shared facts
- Storey height and plan length are in METRES (Decimal), GP3.1-rounded by
  EvidenceBase.make as dimensions. Schedule widths/thicknesses arrive in mm
  through readers.dimensions.parse → metres already.
- A sub-element's mark stays the schedule mark; `location`/`bay` carry the
  place; S13 take-off lines show "C 1" with level "Pod 1" (rows.py reads
  element.location for the `level` column when present).
- No file under the project is written. Tests that read real drawings do so
  read-only and skip when the folder is absent.
- Run `python3 tests/run_all.py` before reporting; the whole suite must pass.
