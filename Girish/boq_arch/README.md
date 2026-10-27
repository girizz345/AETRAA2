# boq_arch — architectural drawings to take-off and unpriced BOQ

Reads a folder of architectural PDF drawings and writes, per POMI section, a
take-off workbook (SKYON house format) and an unpriced bill (LEGOLAND house
format). It also writes a gaps workbook and measured overlays.

The model reads, code computes. The tool reads a drawing visually only where
the content exists solely as graphics: schedule cells, grid dimension strings,
level values and detail notes. Everything else comes from the PDF text layer
or from vector geometry measured at a scale calibrated for each sheet. Every
number that reaches a workbook is arithmetic done in code on cited facts.

## Platform (browser)

Double-click `start_platform.bat`, or run `python web/app.py`, then open
http://127.0.0.1:5000.

1. Upload the drawings (PDF, DWG, DXF, JPG, PNG or TIFF), or a `.zip` of them, or type the path of a
   drawings folder. Images become one PDF sheet per page and a DXF is plotted to an A1 sheet. A DWG needs the
   free ODA File Converter; without it the DWG is listed in the gaps.
2. Click **Run take-off**. The log streams live while it works.
3. Open the result. Each BOQ, take-off and gaps workbook can be **viewed** in the
   browser, with sheet tabs and formula values calculated, or **downloaded** as
   `.xlsx`. The measured-drawing PDFs open beside them. The take-off's drawing references are links: in the
   browser each opens its drawing in a new tab. A workbook downloaded on this computer (with no `BOQ_PUBLIC_URL`
   set) links to the drawing files themselves, made absolute, so its links open wherever the copy is saved or
   opened on this computer, platform running or not. One downloaded through a shared link links to the platform's page for each drawing
   instead (the drawings are not on that computer): at the address set in `BOQ_PUBLIC_URL` when there is a
   lasting one, or else at the address it was downloaded through - a quick tunnel's address lasts only until
   the share is restarted, and the results page says so beside the take-off. Excel checks such a link itself before opening it; the platform answers that check,
   and a reader already signed in goes straight to the drawing. For someone who cannot open the platform, use
   **Download with drawings (.zip)**: the workbook and the drawings it links to in one zip, the links pointing
   into it. Extract it first (right-click, Extract All) - a note in the zip says so: opened straight out of the
   zip, Windows copies the workbook alone to a temporary folder and Excel says "Cannot open the specified
   file". (The workbook in the run folder keeps links relative to that folder, so the run and its drawings can
   be moved together.)

4. Open **Measure** to see what each bill line was measured from, correct what the automatic take-off got
   wrong, and take off by hand on the raw drawings (below), then **Export to Excel**.

API keys can be entered for a single run and are not stored. With no key, a run started **on this computer**
reads with your own Claude sign-in (Claude Code, signed in on this machine); a run that comes in over a shared
link never does - it needs a key. Readings are shared across runs, so a sheet read once is never read again.
Each run is kept under `jobs/<run id>/`.

**Batch** runs several drawing sets at once: choose several `.zip` files (one per set), list set folders one per
line, or give a folder whose sub-folders are the sets. Each set gets its own run and results page; the batch page
shows every set's progress and gives one summary workbook. Each run is its own process, so runs go side by side:
two at once by default (`BOQ_PARALLEL_RUNS` to change), the rest wait their turn.

## Measure workspace (hands-on, PlanSwift-style)

A step-by-step guide with a worked example opens the first time the Measure tab is used. After that it is under
**? How to measure** in the toolbar, and at `/help/measure` (linked from How it works). The source is `web/guide.html`.
While drawing, the readout beside the pointer gives the length so far and the last side, or the area and perimeter.
When a shape is finished, a **Measured** box gives its figures in plain units. Once saved, the figures are written
on the drawing beside the shape (**Labels** turns this off).

The **Measure** tab of a run shows each raw drawing, and every document in the set, including scans whose
title block could not be read. Scrolling in zooms in on the point under the pointer, which stays under it.
Scrolling out stops at the whole sheet (100%), centred; the toolbar shows the zoom level. Dragging with any mouse
button moves the drawing in every tool, and a drag never places a point. The sheet cannot be dragged off-screen.
While a measurement is under way, holding the pointer near an edge scrolls the drawing that way, faster nearer
the edge, so a long wall can be followed at high zoom. In Pan mode, double-clicking zooms in. F fits the whole
sheet.

| Tool | Key | What it does |
|---|---|---|
| Length / Area / Rectangle | L / A / R | **Double-click to start, double-click to finish.** In between, click at each corner (a rectangle needs only the two double-clicks, on opposite corners). Clicks snap to the ends of drawn lines (underlays excluded). Shift keeps a line straight, Backspace undoes a point, Esc cancels |
| Count | C | Click each item. Clicking a ring again removes it |
| Count similar | S | Box one symbol or tag. A tag with real text (D4, DW 03) is found everywhere by its text, which is exact. A graphic symbol is found by masked image matching in four orientations. You check the rings and correct them |
| Set scale | K | Click two points a known distance apart and type the distance. You can also type 1:NNN. Plans default to their grid-calibrated scale |
| Note / Cloud / Arrow / Highlight | N / U / W / H | Mark-ups, kept with the run and burnt into a marked-up PDF on export |
| Overlay | | This sheet over the same drawing from another run: grey unchanged, red removed, green added |
| Eraser | E | Point at a measurement or mark-up: it turns red and the readout names it. A click erases it. On a count, a click erases one mark and Shift+click erases the whole count. Undo brings anything back |
| Add tag / Add room | T / O | Corrections to the automatic take-off (next section) |
| Undo | Ctrl+Z | While drawing, takes back the last point or count mark. Otherwise it takes back the last saved change, most recent first: a new measurement, an edit, a delete, a scale change or a correction. Hover over the button to see what it will undo |

Each length, area or count can use an **assembly** from the **Formulas** tab. An assembly is one measurement
turned into several bill lines. Each line has a POMI clause (which fixes its unit), headings and wording, and
a formula over `L` (m), `A` (m²), `P` (m) or `N`, plus the assembly's own parameters. For example, a block
wall is `L*H` of blockwork plus `2*L*H` of plaster. Formulas are arithmetic only and are never `eval`'d.
The library lives in `assemblies_library.json`, seeded from `boq_arch/data/assemblies_library.json`.

**Export to Excel** writes the take-off and bill again with the manual lines added (origin `MEASURED (MANUAL)`).
A line whose wording and clause match an existing item adds to that item. The export also writes a
measurement list, the marked-up PDFs, and runs the house-format check. It goes to `output/with manual/`;
the automatic run is not changed. A later run of the same project offers to bring the manual measurements
forward, and flags any sheet whose file has changed.

Stored per run: `jobs/<id>/manual/measures.json`, `scales.json` and `corrections.json`. The export reads
`output/state.pkl`, which is saved by every run.

## Tracing and correcting the automatic take-off

On every plan, Measure draws what the automatic take-off measured, in the trade colours: wall pieces at their
drawn thickness, rooms shaded, door and window tags ringed (red: the count is OPEN). Grey dashed walls are
pieces of no block size, which are not billed. An orange **?** marks a room label the flood fill could not
measure.

- **Follow an item.** Click an item in the *Automatic take-off* list, or in the Takeoff view legend. Its shapes
  light up, the rest fade, and the view moves to them. The list gives each item's quantity on this sheet and
  in the bill, and names the other sheets it is measured on.
- **Ask a shape.** Point at a wall, room or tag to see its size and the items it feeds. Click it to see the
  take-off lines it is in, and to correct it.
- **See what to check.** *To check on this sheet* lists the rooms not measured and the OPEN counts with tags
  here.

| Correction | How | Effect |
|---|---|---|
| Wall thickness | Click a wall piece, choose a block size | Billed on its own line, `MEASURED (CORRECTED)` |
| Not a wall | Click it, *Not a wall - exclude* (or Delete) | Leaves its items; each item notes it |
| Rename a room | Click a room, choose its name | Moves to that room's finish class, and into wet-area waterproofing if wet |
| Not a room | Click it, *Not a room - exclude* | Leaves floors, walls, skirtings and ceilings |
| Duplicate tag | Click a tag, *Exclude* | The count is reconciled again; the item closes if the counts now agree |
| Missing tag | Add tag (T): click where the tag is, choose the mark | Counted, and like any tag its opening is deducted and its walling added back |
| Room not measured | Add room (O), or click a **?**: draw round it, name it | Billed as `MEASURED (MANUAL)` under that room's finishes. The gap closes once every label it is about has a room drawn round it |
| Sloping room | Click a room, give its slope (`15`, `1:12`, `8%`), *Set slope* | Floor finish and waterproofing measured on the slope (plan area x 1 / cos pitch) as their own sloping items (G2.1 class 2; D1.1); walls, skirting and ceiling stay as on plan |
| Not a finish | On an elevation, click a coloured area, *exclude* | The area leaves its external finish item |
| Name a colour | On an elevation, click a coloured area, say what the colour is (wall finish + its name, glazing, other) | A wall finish is billed under external finishes as `MEASURED (CORRECTED)`; used when no callout names the colour, or to correct the reading |

Each correction is measured again by the same rules, from the plans the run keeps in `state.pkl` without their
drawings (`corrections.py`). A door added therefore also comes off the skirting and the plaster. With no
correction, measuring again gives the automatic take-off exactly. An excluded shape stays drawn in faint red
and can be put back, and Undo takes corrections back like any other change. *Corrections* lists each one and
the bill changes it caused (was -> now).

**Export to Excel** makes the corrections, measures again, adds the manual measurements and re-issues the
take-off, bill and GAPS. The Manual Measurements workbook gets a CORRECTIONS tab, and the marked-up PDFs show
the corrections. A later run of the same project offers to bring them forward. On an unchanged sheet they land
on the same shapes. On a revised sheet each shape is found again where it was (walls by their ends, rooms by
their label point, tags by mark and position), and any that cannot be placed are listed.

Each run writes `shapes.json`: every wall piece, room and tag, and the shapes each take-off line came from.
Runs made before this version keep no plans in `state.pkl`, and Measure asks for the drawings to be run again.

## External finishes on the elevations

Each elevation is scaled from **its own storey dimension chain**: every floor-to-floor dimension printed in the
text layer (3700, 5150, ...) against the distance between the chain's tick marks. Every span must agree within
1%. Where the plans have a grid table, the elevation's grid bubbles must agree with it within 1% as well, or the
sheet is not measured. (Test set: 8 storey dimensions and 7 or 16 grid bays agree on every elevation; the four
sheets were plotted at 1:130.0, 1:130.0, 1:127.8 and 1:149.4 against a title block of 1:125.) Elevations then
also have a scale in Measure, so the Area tool works on them straight away.

The elevations show their finishes as colour: a solid fill on one sheet, a transparent image or a coloured hatch
on another. The sheet is rendered at 2 px/pt and every clearly coloured pixel of the drawing area is taken; one
hue is one finish class. Lines drawn over a fill are closed over, and specks, thin lines and patches under
0.3 m² are dropped. What is left of each class is its area on the elevation, a **projected** area (true for faces
parallel to the elevation).

Which finish each colour is exists only in the callout notes, drawn as graphics. The sheet is rendered with each
class labelled F1, F2 ... and read visually (`elevation_finishes`): for each label, the callout its leaders point
into, and whether it is a wall finish, glazing or other. Wall finishes are billed by area as
`External Finishes > Walls: To external walls, <finish>` (J3.1 class 2; J1.3 external work so described), one
line per elevation, with the areas it came from. Glazing is not billed here, because doors and windows come from
the schedules. A colour no callout names is a gap, never billed. Name it in Measure to bill it.

Not measured on the elevations: surfaces left uncoloured (paint, stone, aluminium profiles and slats) and
faces drawn faded. Measure those by hand with the Area tool and the *External wall finish* or *External paint*
assembly.

## Slopes

Anything measured on plan over a slope is shorter than it is. A slope is written as a pitch (`15`), a gradient
(`1:12`, `1 in 12`) or a percentage (`8%`); the slope factor is 1 / cos(pitch).

- **By hand:** Length, Area and Rectangle take a *Slope*. `L` and `A` are then on the slope, `Lp` / `Ap` keep the
  plan figure and `F` is the factor, all usable in formulas; `P` stays as drawn. The *Roof covering (sloping)* and
  *Ramp / sloping floor finish* assemblies bill to the sloping classes.
- **Automatic rooms:** a slope correction on a room (above).

## Visual takeoff (automatic)

| PlanSwift | Here | Module |
|---|---|---|
| Click to measure (automatic) | Each page and region is classified (TEXT / OUTLINED / RASTER / MIXED / CAD). Real text is extracted. Outlined or scanned regions (schedule tables, title blocks, dimension strings) are cropped tightly and read directly off the image, tagged `READ (VISUAL)`. A text value that fails validation, such as a garbled drawing number, is re-read visually rather than the sheet being skipped | `readability.py`, `vision.py`, `register.py` |
| Count tool | Every mark is counted two ways: the schedule's NO. and its tags on the plans. A unit tagged per leg, or along a long run, counts once. Tags on floors the schedule doesn't name are reported, not counted. Agreeing counts close the item. Disagreeing counts leave it **OPEN**: both go to the gaps, and the bill quantity stays blank (`open_count_policy`) | `reconcile.py` |
| Assemblies | clause → unit, formula, deduction rule and required description words, looked up from the POMI clause table (`data/clauses.json`); every item is checked against its clause | `assemblies.py` |
| PDF / CAD import | All PDF classes need no per-project special-casing. A DXF beside a sheet (same name, or starting with its drawing number, or in a `cad` folder) bypasses visual reading and calibration for that sheet. DWG must be converted to DXF first | `cad.py` |
| Takeoff colouring | Every drawing read from is marked up in the house trade colours, with a legend of items per sheet. Schedules show the regions read and each mark's status | `overlay.py`, `markups.py` |
| Overlay compare | Each run writes `evidence.json`. `--previous <earlier output>` (automatic on the platform) reports sheets revised, schedule changes, tags moved / added / removed and quantity changes, and marks them on the drawings | `revision.py` |

Tests: `tests/test_units.py` (including the formula evaluator, manual geometry, the merge into bill items, slopes and hue grouping), `tests/test_corrections.py` (on a run's `state.pkl`: measuring again with no correction gives the automatic take-off; an excluded wall, a thickness, a renamed and an excluded room; D-1 closed by an added tag and DW 01 by an excluded one; drawn rooms resolve their gap; sloping terraces and floors; external finishes equal their coloured areas, a colour named by hand, an area excluded; the corrected bill passes the house checks), `tests/acceptance_section_h.py` (480 doors / 12 marks, 199 windows / 22 marks, LW-03 flagged and left open), `tests/test_revision.py` (a moved and a removed tag found on a revised plan), `tests/test_parallel.py` (one worker, four workers and two batch runs at once give identical outputs), and `tests/fixtures/cad_sample.dxf` for the CAD path.

## Run from the command line

```
pip install -r requirements.txt
python boq.py "<drawings folder>" [--rev 00] [--out DIR] [--decisions decisions.json] [--workers N]
python batch.py SET [SET ...]         # several drawing sets (folders or zips), two at a time
python batch.py --each "<folder>"     # every sub-folder and zip in it is one set
python tests/verify_outputs.py        # take-off = BOQ quantities; house template rules
python tests/test_units.py
python tests/test_corrections.py      # corrections measured again, on output/state.pkl
python tests/test_parallel.py         # parallel and batch runs give the one-worker take-off
```

`batch.py` writes each set to `<out>/<set>/` (log in `run.log`), runs the same checks as the platform on each,
and lists them all in `<out>/batch_summary.xlsx` (and `.json`): project, revision, time, items and quantities per
section, gaps, readings pending, checks. `--parallel N` sets how many run at once, `--workers M` the worker
processes each uses (default: the machine's cores shared between them).

### Speed

A run hands its per-sheet work (title blocks, visual readings, grids, plans, elevations, mark-ups) to worker
processes, up to 8 by default (`--workers`), and puts the results together in the order a one-worker run would.
The take-off, bill, gaps, shapes and mark-ups are identical whatever the number of workers
(`tests/test_parallel.py` checks every cell and every rendered mark-up). On the test set, on a 16-core machine:
135 s before, 122 s on one worker, 40 s on four, 37 s on eight; two sets side by side in 57 s. Each plan being
measured needs 300-650 MB.

Two faults were found and fixed on the way: a cache keyed by `id(sheet)` in `tags.py` and `readability.py` could
hand a new sheet the data of a closed one (a run that opened sheets one at a time lost door and window tags), and
PyMuPDF 1.28 loses references to Python's `None` on almost every page call, which on Python 3.11 made a
long run (and `save_reading.py`) fail as it shut down (`sheet.py` keeps `None` alive, as Python 3.12 does).

Outputs, in `output/` unless `--out` says otherwise:

| File | What |
|---|---|
| `<Project> - Take-off - Section <X> - Rev NN.xlsx` | INDEX (header block, decisions, drawings used), dimension paper with live formulas + collection pivot, evidence origin per line, GAPS |
| `<Project> - BOQ Unpriced - Section <X> - Rev NN.xlsx` | Summary + section sheet: 62-row A4 pages, To Collection, List any additional items, Collection |
| `<Project> - GAPS - Rev NN.xlsx` | Everything the run could not resolve (sheet, field, reason) |
| `overlays/<drawing> measured.pdf` | Each plan with what was measured drawn on it: walls by thickness, rooms tinted with areas, tags ringed |
| `run.json` | Items, quantities, origins, storeys, which reading answered what |
| `shapes.json` | Every wall piece, room and tag measured, and which take-off line each one feeds (the platform draws it) |
| `state.pkl` | The run's items and its plans without their drawings, to export again with manual measurements and corrections |

## Visual readings: Claude first, then OpenAI, then Gemini

Set `ANTHROPIC_API_KEY` to read with Claude (`BOQ_CLAUDE_MODEL`, default `claude-opus-5`).
If Claude is rate-limited, out of credit, overloaded or refuses, the reading passes to
OpenAI (`OPENAI_API_KEY`, `BOQ_OPENAI_MODEL`) and then to Gemini (`GEMINI_API_KEY`,
`BOQ_GEMINI_MODEL`), and last to your own Claude sign-in (`claude-login`: Claude Code signed in on this machine,
for your own runs only - the platform turns it on for runs started on this computer; on the command line set
`BOQ_CLAUDE_LOGIN=1`). Use `--providers claude,gemini` to change the order.

The title block is found from its labels (DRAWING, SCALE, DATE, REVISION, CHECKED ...) wherever the office puts
it - a strip down the right edge, a band along the bottom, a corner box - and read out to the sheet's edge, where
the drawing number sits. A number read off it may be in any office's usual form (A1.0, A101, A4a, S-03_1); the
text layer still keeps the house pattern (A-07-004).

The block is the place on the sheet holding (nearly) all its labels, the densest of those; the crop runs from the
block's own ruled edge (so its logo and job title are read), takes in whole any line of text the edge would cut,
and leaves out captions such as "NO SCALE". A large code in an unlabelled box is the drawing number, even A1 or
A3 (the paper sizes). A schedule is cropped to its table's own lines, beside whatever block the sheet has.

Some offices name a drawing only on the sheet ("FURNITURE LAYOUT PLAN", "SECTION AA'"), not in the title block.
The sheet's largest heading that names a kind of drawing is then its title - among headings of one size, the
one carrying the sheet's number ("MS JALI DETAIL-07") or printed across the title block's edge - and the
register says so (`title_basis: sheet heading` in sheets.json, "title from the sheet's heading" on the take-off's
INDEX), so plans, sections and schedules are recognised. The levels are read off the section that shows the
most level marks (+3.95M, LVL, FFL) when no sheet is titled WALL SECTION. A set that numbers each floor's sheets afresh (A6 on the ground
floor, A6 again on the first) keeps both: the floor comes from the divider page before them ("DETAIL
DRAWINGS - FIRST FLOOR"), and the sheets become `A6 (GROUND FLOOR)` and `A6 (FIRST FLOOR)`. The same number twice
is skipped only when the two files are one drawing - the same file, or the same words in the same places - and never across floors (an office reissues one typical drawing for each floor); a different drawing given the same number is kept under its file's name (`A1 (Plans 15)`), with a gap asking which number is right. Files are taken in the order a person reads them (Plans 2 before Plans 10), since a divider applies to the sheets after it. The plot field only takes a plot number ("5310319",
"PLOT 12-A"); an address read into it is ignored, so the files are not named after it.

Each reading is saved in `readings/<drawing>.<task>.json`, stamped with the sheet's
SHA-1 and the prompt version. A rerun on unchanged drawings reuses the saved reading
and costs nothing. A changed drawing gets read again.

If no provider answers, the tool writes the tiles and the prompt to
`readings/<drawing>.<task>.request/` and records a gap. A person, or a Claude Code
session, can answer the request with:

```
python save_reading.py "<drawings folder>" <drawing no> <task> answer.json "<who read it>"
```

The readings in `readings/` for the test set were made this way.

## What is measured, and how

| Section | Item | Source |
|---|---|---|
| H | One enumerated item per door/window mark (H1.1/H2.1). Size from the SIZE cell (mm, or metres: "(3.17 x 1.2)"), or from the elevation dimensions when the cell says AS SHOWN. Filed as a door or a window, by its material (a uPVC casement window is not an aluminium door) | Schedule READ (VISUAL); plan tags COUNTED as a cross-check - a tag in the schedule's own form ("D1-08") counts, and one printed twice on its spot counts once |
| D | Block walls by thickness (D2.1): net plan length × (storey height − slab). Walling above/below each tagged opening is added back, and the opening is deducted if ≥ 1.00 m² (GP3.2). Balcony partitions at their noted 1.8 m height | Wall layer MEASURED; levels READ; slab from detail notes |
| J | Floors, ceilings (J3.1), plaster to walls less openings ≥ 1 m², skirtings less door widths (J3.2) | Room flood-fill MEASURED to the wall faces: a door swing's pocket is the room's, area and perimeter from the room's outline (not a pixel count), voids ≥ 1 m² deducted; finishes from detail notes |
| G | Wet-area and roof waterproofing, flat, or sloping where a room is given a slope (G2.1); DPC under ground-floor walls (G3.1) | Room fills; detail notes |
| J | External wall finishes by area (J3.1 class 2, external) | Elevation colour areas MEASURED at the storey-chain scale; finish names READ (VISUAL) from the callouts |

Scale is never taken from the title block. These sheets are plotted
scale-to-fit, so "1:150" measured 1:152.4 or 1:157.3. Each plan is calibrated
from the grid dimension chain, and every grid bay must agree within 1%.
Content that one sheet shows as an underlay of another (e.g. the lower roof
drawn on the upper roof plan) is excluded by its xref layer name.

## Decisions register

`decisions.json` beside the drawings overrides any default in
`boq_arch/decisions.py`: deduction threshold, block thicknesses, slab
thickness, package line, bill number, section titles, room classes. The
choices applied are printed on each take-off's INDEX tab.

## Not measured by this version (listed in GAPS when the set shows them)

Each of these is reported from the set's own readings - the railings its detail notes name, the doors that
describe ironmongery, a threshold note on its schedule - and only when the set has them:

- External finishes left uncoloured on the elevations (paint, stone, aluminium profiles and slats), and faces
  drawn faded; coloured finishes are measured
- Railings
- Ironmongery (no hardware schedule)
- Thresholds
- Roof build-up choice: three systems are detailed and the drawings don't say which goes where
- Anything on sheets missing from the set, e.g. the basement plan and the ceiling details

Walls and rooms are measured only on plans drawn in CAD layers (a wall layer, a grid layer with its dimension
chain); a PDF with no layers (IIT Bombay's set) or one in feet and inches (the two US sets) gives its title
blocks, schedules and door and window counts, but no walls, rooms or finishes. Door and window sizes in inches
('34" X 96"', or a rough opening 'R/O 71"X23"') are converted to mm. A set with no door or window schedule bills no
door or window, and says so; an interior elevation (kitchen, bath) is not measured for external finishes.
