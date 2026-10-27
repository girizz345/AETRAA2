# What is wired, and what it does

All twenty-one stages run. Every quantity comes from one of four sources,
each computed by code from the governing clause and each carrying its
origin: a schedule cell (STATED), a stated level difference (DERIVED), a tag
counted on a sheet (COUNTED), or a length measured to a calibrated scale on a
plan (MEASURED). The model never produces a number.

| Stage | Module | Output |
|---|---|---|
| S0 Ingest | `ingest/` | `ingest.json` — 314 clauses, 166 computable, 16 sections |
| S1 Register | `readers/register.py` | `register.json`, **`register.xlsx`** |
| S2 Probe | `readers/probe.py` | `readiness.json` |
| S3 Extract | `readers/extract.py` | `extraction.json` |
| S4 Calibrate | `measure/grid.py`, `measure/levels.py` | `grids.json` (per sheet: grid axes, dimension chain, mm/pt, CALIBRATED / PARTIAL / NONE), `levels.json` (storey → level, with citations and conflicts) |
| S5 Route | `readers/route.py` + model residue | `routing.json` |
| S6 Schedules | `readers/schedule_*.py` + model residue | `schedules.json` |
| S7 Counts | `readers/tags.py` | `counts.json` |
| S9 Evidence | `measure/intake.py`, `measure/levels.py`, `measure/plan_lengths.py` | `evidence.json`, `elements.json` — schedule rows to STATED records; storey heights attached to located columns/walls (DERIVED, "stated level difference"); plan lengths between the grid lines a tag sits between (MEASURED, "measured to scale", calibrated sheets only) |
| S10 Inventory | `measure/inventory.py` | `inventory.json` |
| S11 Classify | `measure/classify.py` + model residue | `classifications.json` |
| S12 Compute | `measure/compute.py` | `quantities.json` |
| S13 Takeoff | `stages_takeoff.py`, `takeoff/` | `takeoff.json`, `house_measurement.json`, `audit.json` |
| S14 Markup | `stages_takeoff.py`, `takeoff/markup.py` | `markup_instructions.json`, `markup_spec.json` |
| S15 Descriptions | `stages_bill.py`, `bill/descriptions.py` | `descriptions.json` |
| S16 Completeness | `stages_bill.py`, `bill/completeness.py` | `completeness.json` |
| S17 NonMeasured | `stages_bill.py`, `bill/nonmeasured.py` | `nonmeasured.json` |
| S18 Price | `stages_bill.py`, `bill/rates.py` (market search) | `priced.json` |
| S19 Assemble | `stages_bill.py`, `bill/assemble.py` | `bill.json` |
| S20 Render | `stages_render.py`, `render/` | `takeoff.xlsx`, `bill.xlsx`, `markup/*.pdf`, `provenance.xlsx`, `render.json` |
| S21 Revise | `stages_render.py`, `render/revise.py` | `revision_changes.json`, REVISION CHANGES tab |

## Where the model is called, and what it may say

Four places, labels only, through `model/client.py` → `core/ai.py` on the
Claude subscription. Each reply passes `model/schema.py` before it is read: a
key named `qty`, `quantity`, `value`, `amount`, `rate`, `total`, `area`,
`volume` or `length_m` at ANY depth raises `ModelSuppliedNumber` and the
stage fails — the run does not carry on with a number the model produced.

| Stage | Judgement | Deterministic first | The model returns |
|---|---|---|---|
| S5 | `sheet_kind` | title block, then file name | one of plan / section / elevation / detail / schedule / area-calc / legend, per sheet, batched |
| S6 | `column_mapping` | the header names its columns | column INDEX per role + header row index; `ColumnMapping.validate` refuses an unknown role, an index off the grid, a column claimed twice, a missing mark |
| S9 | `schedule_subject`, `level_alias` | title / heading / file-name words; `normalise_storey` | what a schedule schedules, from the closed set of element types; which storey of the level table a schedule's location string names |
| S11 | `classification` | `STATED_CLAUSES` (door → H1.1, window → H2.1, ironmongery → H4.1, louvre → H5.3) | the GOVERNING clause + `{formula role: evidence_id}` (a role is a slot — a wall's stated thickness fills W), batched per element family over every computable clause; `validate()` refuses an invented clause, a wrong arity, an unverified-scale citation, another element's evidence; a precast/prestressed/proprietary clause is refused unless the schedule says so; roles the evidence cannot fill are the gap ("C2.1 needs length") |
| S18 | market-rate search | — | web-search observations parsed by code; the rate is the published median with G+.32 guards |

`--no-ai` skips all four; each residue becomes a gap naming the sheet or mark.

## Gates that withhold output

- **S13** — `sum(line.squared) == quantity.value` exactly per item, or the
  item is a gap and the take-off says so.
- **S16** — completeness: evidence kind present in the package but no rows
  in its section → `FAIL` → `blocked` → **S20 withholds `bill.xlsx`** and
  writes the reason. Justify in `<project>/AN_RECONCILIATION.json`
  (`{"<evidence_kind>|<section>": "text"}`) to clear it.
- **S19** — a page that would overflow the 45 usable body rows is refused,
  never squeezed.
- **S20** — `bill.xlsx` is recalculated by LibreOffice, then
  `verify_template` (house format) and `verify_sections` (POMI section
  gate) run; outcomes are in `render.json["gates"]`. Without `soffice` the
  workbook is written with a `DO NOT ISSUE` gap.
- **Hygiene** — every user-facing string passes `render.hygiene`; a
  violation is a gap, never a silent rewrite.

## Reader defects found on a real package, and the guards now in place

1. **Rotated glyphs, not just rotated pages** — words read in the text's own
   direction; all four reading orders scored (`titleblock.py`).
2. **The corner was a constraint, not a hint** — every corner searched, the
   scoring decides.
3. **A match without a drawing number was scoring** — a candidate never wins
   without one.
4. **A project code read as the drawing number** — one title-block value
   claimed by 42 files. `register.demote_shared_numbers`: a value claimed by
   three or more files is a project code; each sheet is re-named from its
   file name where that carries a drawing-number token, with the basis in a
   gap, else left unresolved.
5. **A wrapped description became a new mark** — "DOOR AL-01", "AND WD-04".
   `schedule_read.mark_token`: a cell holding exactly one mark-shaped token
   among other words yields the token; a composite the schedule wrote as one
   ("F.10 / F.17") and a cell with no token ("FLOOR") are kept whole.
6. **The mark column chosen by shape alone** picked the threshold column
   (T4, T1, T1…). Uniqueness now discriminates (`_mark_quality`).

## Verified

- `python3 tests/run_all.py` — 320 tests, 23 files, no pytest needed.
- Full chain S0→S21 on a 95-sheet package: 59 s deterministic; the model
  residue adds the S5 batch, one S6 call per unreadable header, one S11 call
  per element family, and one search per rate class.
- Determinism: same folder → same run id → byte-identical JSON artefacts;
  `state.json` differs only in timestamps.
