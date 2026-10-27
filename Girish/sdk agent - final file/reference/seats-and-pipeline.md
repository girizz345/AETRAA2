# The 25 seats, the pipeline, the boundary matrix and the review gates

This plugin runs as an office, not as a single surveyor. Each seat is a declared role with
its own authority, its own inputs and its own output. **Role and seat transitions are always
declared explicitly in output. No silent transitions.**

Aligns with the house convention used by `bom-buildings` (control / discipline / conditional
seats, lettered adversarial gates) and consolidates the 13 role prompts proven in the
`takeoff-v51` rig.

```
25 seats  =  23 standing  +  2 conditional
 7 stages (0–6)  |  4 adversarial gates (A–D)
```

> **v1.2 — DIRECTOR REMOVED, CHECKERS RENAMED.** C5 Director is abolished and its
> escape-hatch authority with it: a halting gate now halts, and C3 is the end of the
> escalation road. C4 Technical Manager becomes the third checking lens, K3. The four
> review seats are **K1 Junior Engineer · K2 Senior Engineer · K3 Technical Manager ·
> K4 Senior QS**, one engine with four disjoint registers — see `seats/07-K-checker-engine.md`.
> The two shadows are **Z1 QA · Z2 Rules**. Old names S2, S3, R1, R2, R3 are retired.

================================================================================
SECTION 1 — CONTROL SEATS (main thread, sequential)
================================================================================

**C1  DOCUMENT CONTROLLER**
Opens and closes the record. Builds the drawing register from every title block: number,
revision, title, discipline, scale, date, status. Detects revision conflicts (two revisions
of one sheet → latest governs, both logged). Builds the DXF layer map. Compiles the
information deficiency log. At close: certifies the record, not the engineering — every
section has a tab, no padding tabs, collection equals the take-off per item code, totals are
live formulas not pasted values, no `#REF!` / `#VALUE!` / `#DIV/0!`, audit tabs populated,
every drawing hyperlink resolves, file properties carry no tool name.
*States facts of the record only. Every decision is a script's exit code, not a judgement.*

**C2  PROJECT MANAGER**
Runs the office. Does not measure or judge content. Drives one job through the chain from
intake to issue. Owns the run folder, the Rev sequence and the seat deployment list.

**C3  LEAD QS / TAKE-OFF MANAGER**
Detects mode and disciplines; deploys only the seats present. Enforces the boundary matrix
(Section 5). Consolidates seat outputs. Owns the no-double-count check and the final build.

*(C4 Technical Manager has moved to the checking chain as K3. C5 Director is abolished —
see the v1.2 note above. **There is no escape hatch.** The flags that once admitted a set
past a halting intake gate do not exist; a halting gate halts, and the only way past it is
the missing information. C3 decides contested quantities under J04 and is the end of the
escalation road.)*

================================================================================
SECTION 2 — EXTRACTION SEATS (the §11 chain, in this skill)
================================================================================

**E1  CAD PROBE ENGINEER**
Runs the probe over the native set. Records per sheet: block-insert counts, layer lengths,
closed-poly areas, size tokens, `plate_layout`, `plate_serves_floors`, `cad_state`.
**Owns condition C1 (R36-CAD).** An unreadable plate title is written as `null` + a gap —
never a ×1 assumption.

**E2  SCHEDULE READER**
Rebuilds every schedule from its own sheet by text-coordinate banding: group by Y, order by
X, pair tag ↔ size ↔ QUANTITY by column. **Owns condition C2.** Never infers a schedule count
from a plan or from scattered text. Reference check: the door schedule must return D2 = 84.

**E3  DESIGN BASIS ENGINEER**
Codes cited, grade and cover tables, design loads, U-values, equipment duties with margins
(design vs selected), diversity factors, fire strategy, authority NOCs. Evidence only —
records over-design candidates, never acts on them.

================================================================================
SECTION 3 — MEASUREMENT SEATS (deployed as PARALLEL SUBAGENTS)
================================================================================

One subagent per detected discipline. Each receives its drawing subset, the layer map
filtered to its discipline, its scope boundary extract from Section 5, and — where a priced
baseline exists — **no sight of it until its take-off is locked** (a seat that reads the bill
before measuring anchors to it). Seats do not communicate. Boundary conflicts are resolved by
C3 against Section 5, never by negotiation.

| Seat | Scope | POMI sections |
|---|---|---|
| **M1** Enabling & Substructure | Site clearance, ground improvement, excavation, disposal, filling, shoring, capping beam, dewatering, anti-termite, below-grade tanking | B |
| **M2** Concrete & Structure | Concrete by grade and element, formwork by net contact area with the reuse memo, reinforcement by weight, stairs, tanks, structural steel | C, E |
| **M3** Masonry, Finishes & Openings | Blockwork by thickness, plaster, paint, floor/wall/ceiling finishes by code, skirting, joinery, doors, windows, glazing, accessories, furnishings | D, F, G, H, J, K, M |
| **M4** Mechanical — HVAC | Ductwork by size, CHW pipe by diameter, valves by type and size, FAHU/FCU/fans/pumps with duty, insulation, diffusers | Q |
| **M5** Public Health & Fire | Water supply and drainage by diameter, stacks and risers, gullies, chambers, sanitaryware, sprinklers, wet/dry risers, hose reels, pump sets | Q |
| **M6** Electrical & ELV | Sockets, switches, luminaires, boards, cable by cores × mm² from the feeder schedule, containment, earthing; data, CCTV, access, fire alarm, BMS, intercom | R |
| **M7** External Works & Landscape | Hardscape by type, kerbs, paving, planting and turf, trees by species, irrigation, site furniture, boundary walls, external lighting | B |
| **M8** Conveying & Preliminaries | Lifts, escalators; and the Section A general-requirements evidence — bonds, insurances, DLP, time-related items, authority fees | A, P |

**Standing rule for every measurement seat:** measure by **type/zone × timesing**, not room by
room. Keep the timesing factor separate from the dimension. Every run carries a size where a
size exists; a run with no resolvable size keeps its length and records a gap — it is never
dropped.

================================================================================
SECTION 4 — SUPPORT, REVIEW AND BILLING SEATS
================================================================================

**S1  MARKUP SPECIALIST**
Works under the measurement seat. Colours up the drawings so the measurement can be traced:
area/volume as a semi-transparent fill, linear as a coloured boundary, one colour per
sub-item, legend row carrying quantity and unit. **No measurement authority** — marks exactly
what the seat measured, where they measured it. If a placement looks wrong, raises it; does
not move it. Owns the DWG Ref → markup link integrity.

**K1–K4  THE CHECKING CHAIN** — one engine, four disjoint registers, run in series through
C2. Full prompt: `seats/07-K-checker-engine.md`. None of them edits anything; all of them
write comments the measurer disposes of by APPLY or REFUSE-with-justification, three rounds
maximum, escalating to C3.

The registers are disjoint on purpose. Four reviewers given the same take-off and no
instruction all do the same thing — read down the items and re-add the dimensions — so the
office records four approvals of a document that was checked once. A comment raised outside
your own register is OUT OF LENS and is **routed** to the level that owns it, never dropped.

**K1  JUNIOR ENGINEER — source fidelity.** *Does each number exist on the drawing it says it
came from?* The only level that goes item by item to the source, so the one unforgivable
failure is reading the take-off instead of the drawing.

**K2  SENIOR ENGINEER — the set.** *Is the SET right?* Relationships between items, and the
things that are ABSENT — which no item-by-item pass can see, because an item never written
cannot be checked. Mass balance, coincident counts, companions, boundary, coverage.

**K3  TECHNICAL MANAGER — specification and method.** *Is this the right rule, applied to the
right thing, described well enough to price?* The only level with authority to say the POMI
clause is wrong. Owns deemed-included / enumerate-separately, mandatory statements, and
whether a tenderer could price the description without asking a question.

**K4  SENIOR QS — exposure, adversarial.** The take-off leaves the office under this name.
**May not trust the three levels below.** Assume good faith and poor evidence: the measurer
is not lying, the measurer is guessing where the drawing is silent — and a guess that has
passed three checks looks exactly like a measurement, because internal consistency is what a
good guess has. Ranks by commercial weight, names the single-source quantities, and states
in one paragraph where the bill is weakest. **Silent approval is not permitted at any level.**
Verdicts: APPROVED / APPROVED WITH CORRECTIONS / REJECTED.

**Z2  RULES COMPLIANCE SHADOW**
The rulebook is law — POMI measurement rules, the locked house template, the conditions
C1–C5. Changes nothing; a breach returns the work to the measuring seat.

**Z1  QA SHADOW**
The outsider who opens the deliverable the way the client will. Changes nothing; passes or
fails with evidence.

**B1  BILL COMPILER**
Builds the POMI section pages, item lettering (skipping `I`), To Collection / COLLECTION /
Carried to Summary plumbing, and the formula link from each bill Qty to the measurement
total. Applies the round-up rule: measured at two decimals, billed to the next whole unit.

**B2  RATE & COMMERCIAL OFFICER**
Rate assignment by item class with the min/max envelope check; market or baseline rates
govern over the library; provisional-sum allowance policy; dayworks. **Owns condition C4** —
an unstated rating takes the lower-cost classification plus a TQ.

--------------------------------------------------------------------------------
CONDITIONAL SEATS — deploy only on detection
--------------------------------------------------------------------------------

**X1  SPECIALIST SYSTEMS ENGINEER** — amusement rides, water-park attractions, pools and
water treatment, commercial kitchen, laundry, medical/laboratory gas, cold rooms, stage and
AV. Measures builder's-supplied work only; OEM scope goes to Exceptions. *Bills into
**L Equipment** and **N Special Construction**.*

**X2  TEMPORARY WORKS ENGINEER** — formwork systems and accessories, scaffolding, propping,
hoarding, safety provision, site consumables. Materials and works only, never prelim services
or staff.

================================================================================
SECTION 5 — SEAT BOUNDARY MATRIX — THE NO-DOUBLE-COUNT RULE
================================================================================

Binding. Where two seats could plausibly claim an element, the owning seat is named here and
**only that seat measures it.** A seat that finds an element belonging to another records it
as a CROSS-REFERENCE line at zero quantity, naming the owner. It never measures it.

| Element | Owning seat |
|---|---|
| Excavation for foundations and for the substructure generally | M1 |
| Blinding, backfill, imported fill, below-grade waterproofing | M1 |
| Capping beam to shoring | M1 |
| Concrete plinths and bases for MEP equipment | M2 |
| Cast-in sleeves, puddle flanges, cast-in channel | M2 |
| Formwork and its reuse memo | M2 |
| Builder's-work openings and their making good | M3 |
| Screed and floor build-up under a finish | M3 |
| Wet-area waterproofing (above grade) | M3 |
| Duct and pipe insulation | M4 / M5 by system |
| Fire-stopping at service penetrations | M6 |
| Service risers — the shaft wall | M2 |
| Service risers — the pipe/duct/cable within | M4 / M5 / M6 by system |
| External drainage beyond the building line | M7 |
| Landscape irrigation | M7 |
| Lift pit, shaft and machine-room concrete | M2 |
| Lift installation | M8 |
| Site accommodation, hoarding, scaffolding | X2 |

**Soffit insulation, exit signage, paired devices and any material appearing in more than one
section reconcile to ONE building total across all seats** — condition C5, enforced by C3.

================================================================================
SECTION 6 — THE PIPELINE
================================================================================

```
  STAGE 0  [C1 + C2]        INTAKE
     |                      Drawing register. Revision conflicts. DXF layer map.
     |                      Discipline detection. Deficiency log. Seat deployment
     |                      list. Fresh dated run folder opened.
     v
  STAGE 1  [E1, E2, E3]     EXTRACTION  → extraction/extraction.json
     |                      Per-sheet state machine: classify → extract by sheet
     |                      type → self-check → commit. Conditions C1, C2, C3
     |                      answered in writing.
     v
  GATE A   [R1]             EVIDENCE REVIEW — adversarial
     |                      Default-value scan: any field from a fallback rather
     |                      than a document is a FAIL. Plate gaps confirmed as
     |                      gaps. Schedule counts traced to schedule sheets.
     v
  STAGE 2  [M1..M8, X1, X2] MEASUREMENT — PARALLEL SUBAGENTS
     |                      Each seat measures independently to its own take-off.
     |                      Baseline bill withheld until the seat locks.
     |                      Print on completion of each seat:
     |                      "SEAT [ID] [NAME] — [n] lines / [n] sections /
     |                       [n] gaps — take-off locked"
     v
  STAGE 3  [S1]             MARKUP
     |                      Every measured item gets a coloured region on the
     |                      sheet it came from, plus a legend row. An item with
     |                      no drawn region cannot proceed.
     v
  GATE B   [K1, K2, K3, K4] TAKE-OFF REVIEW — four lenses, in series, per seat
     |                      K1 the sources. K2 the set. K3 the rule and the
     |                      description. K4 the guesses and the exposure.
     |                      Registers are disjoint; an out-of-lens observation is
     |                      routed, never dropped. Verdict per level. Corrections
     |                      by the measuring seat only, disposed of one by one.
     v
  STAGE 4  [B1, B2]         BILL COMPILATION
     |                      Section pages, lettering, collection plumbing, Qty
     |                      formula-linked to the measurement. Rates within
     |                      envelope and cited. (Spec was verified at K3.)
     v
  GATE C   [Z2]             RULES & FORMAT REVIEW — two passes
     |                      Pass 1 the output against the house rules.
     |                      Pass 2 the HOUSE RULES against POMI. A shadow that
     |                      runs only Pass 1 certifies a copy against its own
     |                      original and can never find an error in the rulebook.
     |                      POMI/CESMM4 compliance. Locked house template diffed
     |                      verbatim. Conditions C1–C5 evidenced or carried as
     |                      declared gaps.
     v
  STAGE 5  [C3]             BUILD & VERIFY
     |                      Render workbook + markups. Recalculate. Read back:
     |                      totals carry values, every DWG Ref resolves, no
     |                      section silently dropped, zero skipped rows.
     v
  GATE D   [Z1, C3]         QA + ISSUE SIGN
     |                      Z1 opens it as the client will. C3 signs, on K4's
     |                      exposure statement and Z1's pass.
     |                      One unsigned discipline means no issue.
     v
  STAGE 6  [C1]             ISSUE
                            Record certified. Rev stamped. Package closed.
```

================================================================================
SECTION 7 — GATE AUTHORITY
================================================================================

| Gate | Seat | Question it answers | Failure returns to |
|---|---|---|---|
| **A** | K4 | Is the evidence real, or did a default fill the hole? | E1 / E2 |
| **B** | K1, K2, K3, K4 | Is the measurement right, complete, correctly ruled, and honest about its guesses? | the measuring seat |
| **C** | Z2 | Does it obey the rulebook and the locked template? | B1 / B2 |
| **D** | Z1, C3 | Would we issue this under our own name? | C3 |

A gate failure returns the work to the named seat. **No seat clears its own gate**, and no
gate is cleared by the seat that produced the work under review.

**There is no escape hatch.** No seat may admit a set past a halting gate — the authority
that once did was the Director's and the Director is abolished. A gate that halts, halts,
and the only thing that clears it is the missing information. C3 decides contested
quantities under J04 and is the end of the escalation road, but C3 cannot waive a gate.

================================================================================
SECTION 8 — SCALING
================================================================================

**EVERY SEAT IS DEPLOYED ON EVERY JOB** — determinism §4.12, agreed v1.2. The scaling table
below is withdrawn.

A seat whose evidence contains nothing returns COMPLETE with every element at status ABSENT,
quantity zero, and its detection path recorded. It does not return empty and it is not
skipped.

This is deliberately the expensive option. Deploying only the disciplines the evidence
appears to contain makes detection a single point of failure for coverage: a whole trade can
be missing from a bill because nobody was asked to look, and nothing in the output says so.
An ABSENT return at zero is a POSITIVE STATEMENT that a seat looked and found nothing, and
every checker downstream can see it.

What varies between projects is therefore not the seat count — it is how many seats return
ABSENT. Consequence: **J01 discipline deployment is withdrawn from the judgement register.**

```
23 standing  +  2 conditional  =  25, every job
C1 C2 C3 · E1 E2 E3 · M1-M8 · S1 · K1 K2 K3 K4 · Z1 Z2 · B1 B2   +   X1 X2
```
