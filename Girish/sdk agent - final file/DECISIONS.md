# House decisions register

The GP1.2 record in embryo. POMI GP1.2: amendments to the principles for a
locality, or for work not envisaged, SHALL BE STATED, and an appendix is
provided for them to be recorded. Where a clause offers an alternative, GP
requires the choice be made ONCE per project, recorded, and applied
consistently — never chosen per item.

Settled by Ajay Mattappilly, 10 September 2026, against the corpus
(AETRAA POMI Take-off, Complete Prompt Set, plugin v4.6.4).

Status: **BINDING**. A seat or module that departs from any line below is a
defect, not a judgement.

---

## 1 · Rounding — GP3.1 governs

Each DIMENSION is rounded as it is taken, to 0.01 m. The PRODUCT is never
rounded.

    d_measured = round(d_drawn / 0.01) x 0.01

    4.237 x 2.981  ->  4.24 x 2.98  = 12.6352 m2      CORRECT
    4.237 x 2.981  = 12.630...      -> 12.63 m2       WRONG

Dimensions stated inside a description are exempt — a 150 mm thick slab stays
150 mm in the words.

**Not a GP1.2 amendment.** This is POMI's own rule, correctly applied.

Implemented: `measure/evidence.round_dimension` is the single rounding point,
applied at intake. `measure/compute.round_once` has been removed and now raises
rather than rounding, so a caller that still rounds a product fails loudly.
`takeoff/rollup.reconcile` compares exactly, since both sides are now sums over
already-rounded dimensions.

## 2 · Reinforcement — bar laps measured, fabric laps not

C3.1 measures bar reinforcement by net weight, and its exclusion list is
rolling margin, supports, spacers and tying wire. Laps are NOT on that list.

    W = Sum (N_bars x L_bar_INCLUDING_LAPS x m_per_m(diameter))

C3.3 measures fabric by area with NO addition for laps. Fabric is the clause
that excludes laps; bar is not.

Ranked error #6 is uplifting rebar by a BLANKET LAP PERCENTAGE — the percentage
fails because it names no location and cannot be re-derived. The laps
themselves are measured.

**Not a GP1.2 amendment.** POMI's own rule.

Implemented: `measure/evaluators/reinforcement.py`. A cut-length schedule is
used as it stands; a separately stated lap is added only where the schedule's
layout excludes it; an ambiguous layout is refused, never assumed either way.

## 3 · Cavity walls — composite item

D2.1 cl.3 offers: a composite item including skins and cavity, or the skins and
cavity each measured by area. **The house takes the composite item.**

Applied to every cavity wall in every job. Ranked error #4 is mixing the two
methods within one bill — measuring the skins separately AS WELL AS the
composite item — so consistency is the whole point of fixing this once.

Closing cavity walls at ends and around openings is deemed included either way.

**GP1.2: DECLARE** — a permitted alternative, chosen once, stated in the bill.

## 4 · Grouping — do not group thicknesses

C2.3 PERMITS differing thicknesses to be grouped provided the range is stated.
**The house does not group.** One item per thickness, always.

**Not a GP1.2 amendment.** Declining a permission is not an amendment to the
principles; it measures more finely than POMI requires, which GP1.1 expressly
allows. Nothing to declare.

Consequence: no range wording is needed anywhere, and `Clause.grouping` narrows
to the classification lists (C2.1's eleven, C4.1's eleven) rather than also
carrying thickness bands.

## 5 · Cross-reference clauses — resolve automatically

Nineteen clauses carry no arithmetic of their own and point at another clause:
"per B11", "per C3", "per C4", "per P2.1", "per P3.1", "measured to the
relevant clauses of this section".

**The clause table resolves these automatically** to the target clause's unit,
formula, thresholds and deduction rule.

Two conditions on the implementation:
- a resolution cycle is a hard failure at ingest, never a runtime recursion
- the provenance sheet records BOTH clause ids — the citing clause and the one
  it resolved to — so a checker sees why a Q8.1 item carries P2.1's arithmetic

**Not a GP1.2 amendment.** Resolution is what the clause instructs.

## 6 · Other alternatives — first limb POMI states

Where a clause offers an alternative, **the house takes the limb POMI states
first**, before the word "alternatively".

| Clause | Taken | Not taken |
|---|---|---|
| C7.5 sinkings, channels | by length | enumerated |
| C7.6 fixings, ties, inserts | enumerated | by area |
| D2.2 faced / fair faced work | so described | extra over walls |
| D4.1 fabric reinforcement | per C3, by weight | by length |
| F9.1 metalwork with woodwork | enumerated | waterbars by length |
| M1.2 furnishings | item per category | enumerated, or by length |

Consistent with decision 3: the composite cavity item is D2.1 cl.3's first limb.

Q2.2 and Q3.3 are NOT in this family. They read like alternatives but are
conditional — fittings to pipes of 60 mm internal diameter or less are deemed
included, and fittings to rectangular ductwork are deemed included — so they
resolve from the condition and carry no choice.

**GP1.2: DECLARE** — six permitted alternatives, chosen once, stated in the bill.

## 7 · Where the choices are recorded

**The GP1.2 house-decisions record.** POMI's own appendix mechanism, which is
where a checker looks for exactly this.

The run carries this register as data so the pipeline enforces consistency, and
the lines marked DECLARE above are printed into the bill's GP1.2 appendix so
the tenderer sees them. Lines marked "not a GP1.2 amendment" are enforced but
not declared — declaring POMI's own rules as house amendments would suggest a
departure where there is none.

## 8 · Trade colours — determinism.md governs

The harvested references carry two trade palettes and they disagree.
`POMI-COMPLETE-PROCESS.md` names a colour per section in words; `determinism.md`
4.10 gives a hex per section and declares the table **closed and constant across
the whole project**. They differ for **nine of sixteen sections** — B, C, E, G,
H, K, L, N and Q.

| Section | POMI-COMPLETE-PROCESS | determinism.md 4.10 |
|---|---|---|
| B | brown | `#4A90D9` blue |
| C | blue | `#8C6BB1` purple |
| E | dark grey | `#4F6FA8` blue |
| G | purple | `#B0913A` olive |
| H | red | `#3F9E8C` teal |
| K | olive | `#A0522D` sienna |
| L | teal | `#D9772B` orange |
| N | maroon | `#6F8F3F` olive green |
| Q | cyan | `#C0392B` red |

**determinism.md governs.** It is hex-exact where the other is a colour name, it
declares itself closed, and a markup palette has to be exact to be checkable — a
reviewer learns the trade colour once and then an unmarked element is visible by
its absence. The six-step shade ladder and the split-sheet rule on a seventh item
come from the same clause and are carried with it.

Recorded in `data/conventions.json` under `provenance.conflict`.

**Not a GP1.2 amendment.** Markup is presentation, not measurement.

## 9 · The rate library is withdrawn — rates are market rates

**Decided by Ajay: there is no rate library. Rates are market rates, found by
web search.**

`reference/rate-library.md` is retained as a harvested document and is **not
loaded by any module**. Its prices are gone. Two parts of it survive because
neither was ever a price: the **item taxonomy** (a classification of work) and
the **regional adjustment table** (statements about market structure), both now
in `data/rate_classes.json`.

This removes a guard, and the guard mattered. G+.32 existed because keyword
matching against the library assigned wrong rates silently — the recorded
instance is bulk excavation priced at the raft concrete rate, a **5.0M
overstatement**. The library's class min/max envelope was the only thing that
caught it. So the envelope is **replaced, not dropped**, by five tests that need
no stored price:

| Gate | Test | Why it cannot go stale |
|---|---|---|
| G+.32a | two independent publishers per class; the rate is their median | independence is structural |
| G+.32b | observations more than 2x apart mean the class holds two items — split it | a coherence test, not a price test |
| G+.32c | no price date, no source; 6–18 months escalates by stated rule; older is rejected | dates, not prices |
| G+.32d | **28 ordinal invariants** — excavation/m³ below concrete/m³, a small board below a main switchboard, porcelain below marble | each follows from what the work IS, with its basis stated |
| G+.32e | no row above 35% of its section without a written note | catches the symptom the 5.0M error was found by |

G+.32d is the replacement for the envelope. Excavation is below concrete per
cubic metre in every market at every date, so the ordering polices a searched
rate with nothing stored to compare against. `tests/test_market_rates.py`
reconstructs the 5.0M failure and asserts the invariant fires on it.

Three rules carry over unchanged: a rate is **never** assigned by keyword match
on description text (the class comes from the clause plus the element's stated
attributes); the project's own priced document **governs** where it has the item,
with divergence beyond 30% flagged rather than averaged; and every priced row
**cites its source** — publisher, URL, price date. Invariant 7.

Searching needs a channel that can search. `core/ai.py` had two — a tool-less
judgement channel whose system prompt explicitly tells the model it has no web
search, and a vision channel allowed only `Read`. A third was added:
`core.ai.research`, allowed `WebSearch` and `WebFetch`, asked for
**observations** rather than for a rate. The median and every test above are
computed in Python, because the model identifies and the code computes. Budgeted
one search per distinct class per run, cached — 400 lines across 60 classes costs
60 searches.

A class with no usable observation is a **gap**, never a number.

**GP1.2: DECLARE** — the basis of pricing is stated in the bill: market rates at
the stated date, each row citing its source, no stored library.

## 10 · The LS prefix collision

`LS` is **Landscape** in the development package's own folder names and **Life
Safety** in `reference/discipline-matrix.md`. One reading has to hold the bare
prefix.

Landscape holds it, because it is the reading observed in a real package rather
than in a generic convention list. Life safety stays reachable as `LSF` and
`LF`. The collision is recorded in `data/disciplines.json` under `collisions`, a
project that uses `LS` for life safety overrides that row, and a run that routes
an `LS` sheet records the reading it used.

**Not a GP1.2 amendment.** A drawing prefix is a consultant's convention, not a
measurement rule.

---

## 11 · Transcription of drawn values — CONFIRMED by Ajay, 28-09-2026

Raised by the Coventry Residence 3 test run (26-09-2026): its door and window
schedules and every structural title block are **drawn** — sizes, quantities,
drawing numbers and titles are vector outlines, not text. Invariant 1 kept the
model from reading them, so the run built no element and issued no bill.

Implemented behind `model/client.py: TRANSCRIPTION_ENABLED`, and confirmed as
it stands ("Yes - allow it", the update for Ajay of 28-09-2026):

- **Transcription is not measurement.** `readers/transcribe.py` reads only the
  printed cells of a drawn door / window schedule and the printed fields of a
  drawn title block — values the sheet STATES. It never measures, totals, scales
  or infers. `review_vision` stays guarded: no stage may ask the model to measure.
- Every such value carries **`Origin.TRANSCRIBED`**, ranked just below STATED,
  labelled "schedule cell (transcribed)" in the take-off and "Stated on drawn
  schedule, transcribed" in provenance, so a reviewer can tell it from a value
  the text layer carried.
- A reading is **saved** with the SHA-1 of the exact sheet file and reused only
  for that file; a revised sheet is read again. Readings made by boq_arch share
  the format and are accepted (`--readings DIR`).
- With no model and no saved reading, the sheet is **not guessed**: a request
  (crops, prompt, schema) is left in `readings/` and the gap says so.
- Transcribed quantities are **cross-checked, not trusted**: a drawn schedule's
  count is still reconciled against the tags counted on the plans.

**A GP1.2 matter**: it changes what the agent accepts as a stated source, and
the change is disclosed per value by its origin.

**Direction after this:** measure the counts and widths from the plans' own
geometry (door swings, window openings) and use the drawn schedule for the
descriptions and as a cross-check, so a quantity rests on measurement wherever
the drawing allows it.

---

## 12 · The project named on the bill — the title blocks, CONFIRMED by Ajay, 28-09-2026

The bill was headed with the name of the folder the drawings came in; for the
Coventry Residence 3 package that was "Test Drawigs", on every page and in the
file names. Chosen (option B of the update for Ajay): the name comes from the
drawings.

- `readers/project_identity.py` reads OWNER, JOB TITLE and PLOT NO. from each
  sheet's title block - its text layer, or the reading of a drawn block - and
  votes across the package: a value is used where at least two sheets and 60%
  of the sheets stating it agree.
- The head band is the house form's: client = the owner, project = the job
  title, package = "PLOT NO. <plot>". The files are named "<plot> <job title>".
- Where the sheets do not agree on a job title, the folder name is used, as
  before, and a gap says so.
- A set of sheets that names another plot or building is a gap listing them.
  On this package the twelve plumbing sheets are titled "PROPOSED RESIDENTIAL
  BUILDING (B+G+6+ROOF)", plot 5310301 - the rest say (B+G+5+ROOF), 5310319 - so
  whether they belong to this project is a question for the consultant.

---

## 13 · Work measured off the plans — CR-01 (raised by Ajay, 30-09-2026)

Until CR-01 every bill line came from a schedule or a tag count, so the sections
a building bill is mostly made of - blockwork, finishes, waterproofing - had no
producer, and the completeness gate withheld every bill. They are now measured
off the calibrated plans (S8 `measure/plan_measure.py`, S9 `measure/measured.py`),
under the same four rules as everything else (P1-P4):

- **Only a verified scale.** A plan is measured when S4 calibrated it - from its
  own grid chain, or from the set's grid (`measure.grid.calibrate_from_set`,
  `calibrate_from_reading`: the printed chain of one plan read and checked bay
  by bay against its own bubbles, 1%, then carried label to label, 2%).
- **Only stated heights and sizes.** Storey heights are the section's FFL/SSL
  levels, each checked against the printed vertical chain (10 mm). Clear height
  = storey height less the slab thickness a note states. The wall thicknesses
  billed as blockwork are the ones a note calls blockwork. A QS decision in
  `BOQ_DECISIONS.json` beside the drawings may state either; nothing is assumed.
- **One plan per storey**, a general-arrangement plan of a discipline that feeds
  D or J - a plumbing layout over the same walls is never measured twice.
- **POMI's own rules.** Walls on the centreline, L-corners completed, a T's stem
  to the face of the wall it meets, the thicker wall through a crossing (D2.1).
  Openings: the plan's wall lines stop at them, so each is added back and then
  deducted as its own line - a door always (at the edge of the area, GP3.3), a
  window from 1.00 m2 (GP3.2), never netted silently. Rooms as the floor within
  the walls; islands under 1.00 m2 stay in (GP3.2), larger voids come out.
- **Every line proves itself.** Each measured line carries its sheet, storey,
  evidence and the shapes drawn on the markup; S14 re-measures the drawn shapes
  and CLOSES the item or reports the variance (R4).

The platform's measuring engine (`boq_arch/walls.py`, `rooms.py`) is the one
used - one engine for both tools - with four corrections made in the agent,
each found by measuring a room of known size and each tested:

1. Door swings and leaves (lines no thicker than 55 mm) cut a triangle out of
   every room with a door: those pockets are the room's (a pocket that holds a
   wall's centreline is a wall, and is not).
2. The fill stopped at the edge of the rasterised line, not the wall face: the
   room is grown onto the face line; area and perimeter are the outline's.
   A 2.40 m bathroom measures 2.402 m - the dimension printed on the plan.
3. Perimeter counted pixel edges (a diagonal as a staircase, a door leaf twice):
   it is the outline's length. Wall finishes on the development package fell
   from 35,799 m2 to about 26,000 m2 and now sit under 2 x blockwork (G+.30 #7).
4. Generic room names added for other offices (MAJLIS, W.C., OFFICE ...) seed a
   room only where they open a short line of their own; names that label part
   of a space (SHOWER, DECK, POWDER ...) only where the known names find almost
   nothing (`data/rooms.json`).

**Not yet measured:** C concrete from the plans (slab area x thickness,
shuttering), B site work, K partitions, Q floor drains, stair finishes (J3.1
class 4), the reveals of openings (J3.1 class 2). The coverage note names each
where the drawings call for it; the gate is not narrowed to hide them.

---

## Still open

**From the harvest:** nothing unresolved. Decisions 8, 9 and 10 settle the three
contradictions the reference corpus carried into this build.

**From the drawings:** the remaining title-block variants. 46 of 95 sheets in the
development package still resolve to the project number rather than the sheet
number, in at least two block layouts not yet in `data/titleblocks.json`. That is
a reader defect, not a decision.

**Open question for Ajay, raised rather than assumed:** decision 9 sets the
escalation rule at 3-5% per year straight-line and the run currently applies 4%,
the midpoint, disclosed per row. The withdrawn library stated the range but not
which figure the house takes. A single figure chosen once is a GP1.2-style
decision; until it is made the midpoint is used and flagged.
