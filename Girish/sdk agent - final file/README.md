# aetraa-boq

Drawings in, three deliverables out: **marked-up drawings**, a **take-off
workbook**, and a **priced bill of quantities** — plus the two things that are
easy to overlook and cost the most when they are missing: a list of everything
the system could not resolve, and a record showing for every quantity which
drawing it came from and how it was arrived at.

Scaffolded from the v3.1 build spec. Every module carries its contract in its
docstring; the ones that need the corpus, the reference BOQ or the drawings in
hand raise `NotImplementedError` with the specific thing they are waiting for.

## The eight groups

| Folder | Stages | What it owns |
|---|---|---|
| `spine/` | — | run folder, run record, logging, identity, gaps, errors, shared record types, the CLI |
| `ingest/` | 0 | clause table, formula grammar, rate library, section crosswalk, discipline matrix, title-block patterns, house conventions |
| `readers/` | 1–7 | walk, probe, extract, title block, register, route, schedules, dimensions, counts |
| `measure/` | 9–12 | evidence base, inventory, classify, compute, thresholds, deductions, grouping, the evaluators |
| `takeoff/` | 13–14 | dimension rows, rollups, audit tabs, markup instructions |
| `bill/` | 15–19 | descriptions, the completeness gate, non-measured, pricing, assembly, lettering, pagination |
| `render/` | 20–21 | BOQ workbook, take-off workbook, marked-up PDFs, provenance, hygiene, revisions |
| `model/` | — | typed client, response schemas, retry, call budget, the six prompts |

## The invariants everything else follows

1. **Model identifies, code computes.** The model returns labels and references
   from closed sets. Never a number that reaches the bill.
2. **Evidence is extracted, not asserted.** The values a quantity is computed
   from come from table parsing or symbol counting. Otherwise the hallucination
   moves one step upstream wearing a clause reference.
3. **The clause fixes the arithmetic.** Unit, formula, thresholds, deduction
   rule and grouping are looked up, never chosen.
4. **One model call per judgement.** No consensus, voting or self-review at
   runtime. Reliability comes from the offline eval set. Retry only on a
   schema-invalid response.
5. **Gaps, never assumptions.** A stage that cannot complete records a gap
   naming sheet and reason. Gaps ship with the output.
6. **Sort everything, round once.** No unsorted iteration anywhere. Rounding
   happens exactly once, in `measure/compute.py`, at POMI precision.
7. **A rate cites its source.** Never assigned by keyword match on description
   text.
8. **Absence is detectable.** Evidence of a kind must produce output of the
   corresponding kind, or a recorded failure.

## Where the work actually is

`measure/` is the largest piece and the one that depends most on surveying
judgement — 42 formula shapes, every threshold, every deduction rule, plus the
two discipline families. `bill/completeness.py` is the module that decides
whether anything ships at all, and it is written before the stages it gates on
purpose: a completeness gate written afterwards tends to be written to pass the
output that already exists.

## Running the parts that are finished

```bash
python3 -m spine.identity <drawings dir>       # freeze a run identity
python3 -m readers.walk <drawings dir>         # stable file list
python3 -m readers.dimensions "900 x 2100"     # parse a dimension cell
python3 -m ingest.formulas                     # the formula grammar
python3 -m ingest.crosswalk --check S          # the section-letter dispute
python3 -m bill.lettering --count 12           # item letters
python3 -m bill.pagination --items 47          # the 62-row grid
python3 -m model.budget --sheets 385 --schedules 30 --elements 900
python3 -m render.hygiene --text "see extract.py"
```

## What is needed before the rest can be written

- `reference/POMI-COMPLETE-PROCESS.md` — the clause corpus
- the reference BOQ workbooks — the render target and format conformance
- the rate library — the pricing envelope
- the drawing corpus and its register — ground truth for stage 1
- surveying decisions on the open questions, chiefly the section letters and
  the threshold and grouping cases the corpus states inconsistently

## Standards

Python 3.11+. One package; the terminal runner is a thin shell over it.
pylint >= 8.5 per file, enforced. Files stay under ~300 lines. Dependencies
pinned — a `pymupdf` upgrade that changes vector extraction must be a visible
change, not quietly different quantities.

## Fixes from the Coventry Residence 3 test run (26-09-2026)

Ajay's run over `Girish/Test Drawigs` (102 sheets) issued no BOQ, with 162 gaps (193 without the model).
Changed, all deterministic, with no model call added:

- **Title block (S1).** A spec for blocks with labels on one row and values beneath, spelled out in full
  (`DRAWING NO.`, `DRAWING TITLE`, `REVISION NO.`, `SCALE`), as on the EMSQUARE block (`tabular-labels-over-values`
  in `data/titleblocks.json`). A value under a label can be checked against a `value_regex` and can run to more than one
  row (`rows`), for two-line titles. A drawing number read from under its own label now outranks a looser spec that
  filled more fields. Dates (`JUN-2025`) and digit-less words are never taken as drawing numbers.
- **File-name numbers (S1).** `A-13-001 …` keeps the whole number; it used to be cut to `A-13` and demoted as a project
  code. `STRUCTURE Sheet 05.pdf` (no number on the sheet as text) is named `STRUCTURE-SHEET-05` from its file name, with
  the basis recorded.
- **Discipline from the folder (S1, S7).** Where the number has no discipline prefix, the folder the sheet was issued
  in decides (`folder_disciplines` in `data/disciplines.json`; `DisciplineMatrix.resolve_for`). Where a number's
  prefix contradicts the folder and the block gave no title, the folder is used and a gap says so.
- **Sheets never measured (S5).** Cover sheet, list of drawings, perspectives, renders: kind `general`.
- **Schedules (S6).** The title block is cut away before a table is looked for (`titleblock.block_edge`: the block's
  ruled border, anchored on the drawing number), so its revision table can no longer be read as the schedule. A schedule
  whose content is drawn as graphics now has one clear gap per sheet, listing its type tags where they are text
  (`DW 01` …). Its sizes and quantities are **not** read: that would need the model to read numbers off a drawing,
  which invariant 1 forbids. That decision is open.

- **Cross-references are not drawing numbers (S1).** Away from a spec's declared corner, a drawing number found
  alone, with no title, scale or revision beside it, is not taken. "REFER DRG NO.S-05_2" in a note named seven
  structure sheets S-05_2.
- **Drawing series (S5).** A sheet whose title names no kind takes its series' kind when at least three other sheets
  of that series agree by their own titles (A-07-001 among the A-07 plans), with the basis recorded.
- **Windows.** Text and Markdown files (the POMI standard, role files) are read as UTF-8, and a test closes the PDF it
  opens. All 338 tests pass on Windows.

- **Drawn schedules and title blocks are transcribed (DECISIONS.md 11, proposed).** `readers/transcribe.py` reads the
  printed cells of a drawn door/window schedule and the printed fields of a drawn title block, as
  `Origin.TRANSCRIBED`. It uses a saved reading tied to the sheet file's SHA-1, else a live read when the model is
  available, else it leaves a request in `readings/`. `readings/` holds the readings for this package: the three
  schedules, the garbled architecture title blocks, and all 50 structure title blocks. `--readings DIR` adds a folder
  (boq_arch's readings are accepted).

- **Bill wording (S15, S19).** A door or window now states its kind, size and type, as POMI H1.1 / H2.1 require and
  as the house bills write it: "Doors, hinged door, size 1200mm x 2200mm, type D-1, complete in accordance with the
  Specifications and Drawings", then "Ditto, hinged door, size 1100mm x 2200mm, type D-2". It used to be "Ditto, type
  D-2", with no size. Sizes in parts are stated as printed and never added up: "size (7300 + 2950)mm x 3200mm",
  "size 11350mm x (800 + 2400)mm", "size 1200mm x 1400mm, sill 1000mm". The kind comes from the schedule's TYPE cell
  and is left out, not reported as a gap, when a schedule has none. Clause titles lose the POMI text's editorial
  capitals when used as headings ("Windows and skylights", not "... ENUMERATED TOGETHER WITH THEIR FRAMES"), and
  element headings are plural ("Doors", "Windows"; "Glazing" stays as it is).

Tests: `tests/test_package_fixes.py`. On this package the run now issues a BOQ with **480 doors and 199 windows**
(34 items), registers all 102 sheets with numbers and 100 with titles, and gaps without the model fall from 193 to
58. 38 of those are rate searches that need the model, and 2 are because LibreOffice is not installed on the test
machine.

## Fixes from the review of the same package (27-09-2026)

Run once with `--no-ai` and once with the model and an empty `readings/`, so every drawn value had to be read live.
The model read all 54 drawn title blocks, the door schedule and A-13-003 correctly. Fixed:

- **An unread schedule withholds the bill (S6, S16).** A-13-002 timed out (3 x 300 s) and the bill issued with 11 of
  199 windows, the gate "clear": it asks each kind of evidence present for rows, and an unread sheet is no evidence.
  A door or window schedule left unread is now a FAIL naming the sheet, justified only by `"unread_schedule|<drawing
  no>"` in `AN_RECONCILIATION.json`. A schedule read is given 900 s (`TASKS["schedule"]["timeout"]`, passed to
  `review_vision(timeout=)`); A-13-002 takes about 560 s. A withheld re-run renames the zip an earlier run of the
  same drawings issued to `... - WITHDRAWN.zip`, so it is not left looking current.
- **Take-off totals (render).** Qty each for an item counted in nr is 1, as in the reference take-off; its width and
  height stay in their columns. D-1 read 52.8 nr against 20 in the bill.
- **Schedule against plan tags (S7, S10).** Marks are compared in one spelling (`D-2` = `D2`, `DW 01` = `DW1`); window
  tags drawn as "DW" over "06" are joined; `LW` is a tag; tags are counted on floor plans only (not elevations,
  details or the setting-out plan) and not in underlay text (the lower roof drawn beneath the upper roof plan);
  `TYP ( 4 - 5 )` is two floors; an L-shaped or long unit tagged on each leg is one unit; a tag on a floor the schedule
  does not name is reported, not counted; a mark no plan shows is reported as 0. On this package 28 of 34 marks
  agree; the six queries are D-1 (20 / 19), DW 01 (1 / 2) and four basement items - the set has no basement plan.
- **A number with no title is read off the block (S1).** Without a saved reading, STRUCTURE Sheet 28 registered as
  MH-01, a manhole label; the block is now read live (S-03_1) or a request is left and the gap says so.

Tests: `tests/test_review_fixes.py`.

## Ajay's decisions (28-09-2026)

- **Transcription of drawn values: allowed** (DECISIONS.md 11, now confirmed). Nothing changes in the agent.
- **The bill is named from the drawings** (DECISIONS.md 12). The head band is the owner, the job title and the plot
  as the title blocks state them, voted across the sheets (`readers/project_identity.py`); the files are named
  "5310319 PROPOSED RESIDENTIAL BUILDING (B+G+5+ROOF) - BOQ - Rev 00". The folder name is used only where the sheets
  do not agree on a job title. On this package the vote also found that the twelve plumbing sheets name another
  building and plot (B+G+6+ROOF, 5310301) - a gap, for the consultant.

## Running it from Claude Code (30-09-2026)

Open Claude Code in this folder and ask it to run the BOQ on a drawings folder. The `boq-pomi` skill
(`.claude/skills/boq-pomi/SKILL.md`, with `CLAUDE.md`) has it:

- update the agent;
- run it in the background;
- when the bill is withheld because a drawn schedule or title block was not read, answer the agent's requests itself.

The requests are `readers/requests.py list | show | save`. The skill looks at the request's tile images, copies what
is printed and never measures (DECISIONS.md 11). The answer is checked against the task's schema and saved as a
reading tied to that sheet, and the next run uses it. It all runs on the user's own Claude sign-in, on the user's own
machine. On Ajay's 385-sheet run A-501 was left unread; this is the way through when the model's own read fails.

## Measured sections - CR-01 (30-09-2026)

Blockwork (D2.1), finishes (J3.1, J3.2) and waterproofing (G2.1) are measured
off the calibrated plans, not only read from schedules. See DECISIONS.md 13.

- **S8 Measure** (`measure/plan_measure.py`): walls and rooms on every
  calibrated general-arrangement plan, one per storey; storey heights from the
  section's level markers; slab and block sizes as the notes state them, or as
  `BOQ_DECISIONS.json` beside the drawings states them. Needs `numpy`, `scipy`
  and `opencv-python-headless` (the launchers install them) and the platform's
  engine beside the agent (`../boq_arch`).
- **S9** (`measure/measured.py`): one bill item per wall thickness / room class,
  one dimension line per plan and storey; openings added back and deducted as
  their own lines (GP3.2, GP3.3).
- **S14** draws each measured line's shapes and closes each item against them.
- **S16** runs the G+.30 mass-balance checks and, where the gate fails, the bill
  issues PARTIAL with `COVERAGE - READ FIRST.txt` naming every missing section.
- `tests/test_measured.py` builds a one-room project whose quantities are
  worked out by hand (42.51 m2 blockwork, 40.11 m2 wall finish, 13.10 m skirting)
  and the run reproduces them.

Not yet measured: C concrete from the plans, B site work, K partitions, Q floor
drains, stair finishes and reveals of openings - each named in the coverage note.
