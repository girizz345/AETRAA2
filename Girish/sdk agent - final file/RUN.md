# BOQ POMI V1 — how to run it

An AETRAA SDK agent. `manifest.json` + `agent.py <project>` is the same
contract every other agent in your SDK uses, so `aetraa.py` can list and launch
it once it is installed into `AETRAA_SDK/agents/`.

## Try it now

```bash
cd ~/Documents/AETRAA/agents/boq_pomi_v1
unset ANTHROPIC_API_KEY                  # run on the Claude subscription, not the paid API

python3 agent.py --preflight             # what is installed, what is wired, is the sign-in alive
python3 agent.py "<project folder>" --no-ai      # draft: deterministic path only, every judgement a gap
python3 agent.py "<project folder>"              # full: model residues + market rates
```

`--no-ai` runs the deterministic path only; every judgement becomes a gap. The
full run adds four model residues — sheet kind, column map, clause
classification, rate search — all labels, never a number. Add `--region Dubai`
(or any market) to steer the rate search; `--out-here` puts the deliverable zip
in this folder instead of `Reports/BOQ_POMI_V1/` inside the project.

## Install the two dependencies first

```bash
pip3 install pymupdf openpyxl numpy scipy opencv-python-headless
```

`pymupdf` is what reads the drawings. Without it stages 1-3 cannot run and
preflight says so by name.

## What you will see, and why it is the point

All twenty-one stages run and produce real output. S4 calibrates every sheet's
grid and scale from its own dimension chain (text layer only — no rendering, no
model) and builds the level table from the storey levels the sections and plans
state; S9 then attaches storey heights to located columns and walls (stated
level difference) and measures beam and wall lengths between the grid lines a
tag sits between, on calibrated sheets only. A stage that cannot finish records
the reason rather than passing over it. Look at `runs/<id>/state.json`:

```
S0   Ingest         ok  ingest.json
S1   Register       ok  register.json, register.xlsx
...
S11  Classify       ok  classifications.json
S12  Compute        ok  quantities.json
S13  Takeoff        ok  takeoff.json, house_measurement.json, audit.json
S16  Completeness   ok  completeness.json          <- may read BLOCKED
S19  Assemble       ok  bill.json
S20  Render         ok  takeoff.xlsx, bill.xlsx, markup/..., provenance.xlsx, render.json
S21  Revise         ok  revision_changes.json
```

When S16 reads **BLOCKED** — an evidence kind is present in the package but
its section has no rows — S20 writes the take-off and markups but **withholds
`bill.xlsx`** and records why in `render.json`. Clear it by justifying the
absence in `<project>/AN_RECONCILIATION.json` (`{"<evidence_kind>|<section>":
"text"}`) or by fixing the upstream gap it names.

A stage that ran and produced nothing would read `exit=0, artefacts: []`. A
stage that never ran reads `exit=2` with its reason. **Those two look
different**, and that is the single thing the installed v4.6.4 plugin cannot
do — there, a check that was never reached and a check that passed leave the
same trace, which is none.

`resume_from` names the first incomplete stage. Re-running picks up there.

## Determinism, demonstrated

Two runs over the same folder produce the same `run_id` (the `input_set_hash`)
and a byte-identical `gaps.json`. `state.json` differs only in timestamps,
because its job is to record when each stage ran.

That is the claim v4.6.4 cannot make, because nothing there establishes
"same inputs" in the first place.

## Where output goes

`runs/<input_set_hash>/` inside this folder:

| File | What |
|---|---|
| `state.json` | every stage, its exit code, its artefacts, and `not_implemented` where it applies |
| `gaps.json` | sorted, byte-stable — the list a surveyor reads |
| `summary.json` | run id, drawing count, stages ran vs not implemented, resume point |
| `run.log.jsonl` | one JSON object per event, greppable and diffable between runs |
| `ingest.json` | stage 0 — 314 clauses, 210 formulas, 16 sections, 16 formula shapes |
| `register.xlsx` | **the deliverable you check by eye** — REGISTER, REVISIONS, READINESS, COVERAGE |
| `register.json` | the same, as data for the stages after it |
| `readiness.json` | "Of N sheets, M can be measured directly. N-M require measurement by hand." |
| `extraction.json` | words extracted per sheet, and the coordinate frame |
| `routing.json` | sheet kind per sheet, and which source decided it (title block / file name / model) |
| `schedules.json` | every schedule row read, with the column map and its basis |
| `evidence.json`, `elements.json` | every evidence record (origin STATED / COUNTED / INFERRED) and the elements built from them |
| `classifications.json` | clause + bindings per element, stated vs modelled, and why each unclassified one is |
| `quantities.json` | the only place a quantity is produced — by code, from the clause |
| **`takeoff.xlsx`** | dimension paper: INDEX, one tab per section, AN.RECONCILIATION / SUBSTANTIVE / COVERAGE |
| **`bill.xlsx`** | the house-format bill (MEASUREMENT, Section tabs, Summary, REVISION CHANGES), LibreOffice-recalculated |
| `markup/` | one marked-up PDF per drawing that carries a measured item, plus `00-LEGEND-INDEX.pdf` |
| `provenance.xlsx` | bill line → priced row → take-off line → evidence → drawing |
| `render.json` | what was written, every gate's outcome, and what was withheld and why |

All of that is the **working record** and stays in `runs/<run id>/` here. The
**deliverable** is one zip in `<project>/Reports/BOQ_POMI_V1/`:

```
<Project> - BOQ - Rev 00.zip
  <Project> - BOQ Priced - Rev 00.xlsx      Summary, then one sheet per section, rates filled
  <Project> - BOQ Unpriced - Rev 00.xlsx    the same pages, every rate blank — for tender
  <Project> - Take-off - Rev 00.xlsx        INDEX + one dimension-paper tab per section
  markup/1. A-504.pdf ...  markup/00-LEGEND-INDEX.pdf
```

The bill workbooks carry the bill only — no measurement sheet, no revision
sheet; the take-off carries the measurement, and the AN audit tabs and the
revision comparison stay in the working record (`audit.json`,
`revision_changes.json`).

Named by the project folder and the issue revision, no date. Rev 00 is the
first issue; a later run of the same project on changed drawings is Rev 01,
and its REVISION CHANGES sheet says what moved. A re-run on unchanged drawings
keeps its revision and replaces its own zip. No zip is issued while the
completeness gate withholds the bill — `gaps.json` says why. **Nothing already
in the project is read for writing or altered.**

## Proving the tables loaded

```bash
cd ~/Documents/"BOQ agent/sdk agent"
python3 tests/run_all.py
```

320 tests, 23 files, no pytest needed. The suite covers the nine ingest tables,
the reader chain at four rotations, the measure chain, the model boundary (a
number in a reply halts; an invented clause, a wrong arity, a neighbour's
evidence are each refused with a reason), the take-off reconciliation, the
house-format packer, the render gates, and every pricing guard including a
reconstruction of the 5.0M rate error the withdrawn library's envelope used
to catch.

Stage 0 loads all nine tables and writes their counts to `ingest.json`, so a
malformed table is a named stage-0 gap rather than a traceback forty minutes into
a 500-sheet package.

## Proving the market-rate path — one command, no drawings

There is no rate library. Rates are market rates, searched per class, cited per
row. That path is the newest part of the agent and the only part that leaves the
machine, so it has its own check:

```bash
cd ~/Documents/"BOQ agent/sdk agent"
python3 agent.py --rate-check excavation.bulk --region Dubai
```

It prints every page the search read — the figure, the publisher, the unit, the
price date and its age — then the published median and any flag raised. Exit 0 is
clean, 1 means there are flags to clear, 2 means the class is a gap.

What to expect, and why each is the right answer:

| Outcome | What it means |
|---|---|
| a rate and no flags | two or more independent publishers, consistent, recent |
| `SINGLE_SOURCE` | one publisher only — priced, but needs clearing before issue |
| `CLASS_SPREAD` | the sources disagree by more than 2x: the class is holding two different items, split it |
| `ESCALATED` | a source 6-18 months old, escalated by the stated rule and disclosed |
| `GAP` | nothing usable was found. Nothing is priced and nothing is guessed |

List the classes and the invariants that bound them:

```bash
python3 -m ingest.rates --classes data/rate_classes.json --invariants
python3 -m ingest.rates --classes data/rate_classes.json --class concrete.reinforced.slab
```

A class not in the table is not a failure — it is created from the clause at run
time and flagged `UNLISTED_CLASS`. What is refused is a *near match*: a rate is
never assigned by matching a description's words.

## Installing it into the aetraa menu

```bash
cp -R ~/Documents/"BOQ agent/sdk agent"/. \
      ~/Documents/AETRAA/agents/boq_pomi_v1/
```

`~/Documents/AETRAA/agents/` is the install location — it is the `DEST` in
`INSTALL.command`, and the only one `aetraa` reads. An earlier install went to
`~/aetraa-agents/AETRAA_SDK/agents/` and the menu never saw it.

Then `aetraa` lists it as **BOQ POMI V1**. The launcher passes the project
folder as the first argument and sets `CLAUDE_CODE_OAUTH_TOKEN` from your
Claude sign-in, which is what `core/ai.py` reads.

Copy it rather than symlink: the two then drift independently, and you want
this one to change without touching anything the SDK already runs.

## How a stage is wired

`agent.py` holds the stage table in `stage_plan()`. S0–S12 are bound directly;
S13–S21 are bound lazily from `stages_takeoff.py`, `stages_bill.py` and
`stages_render.py` through `_tail()`, so a broken tail module surfaces as a
FAILED entry for that stage rather than an import error before stage 0. The
artefact each tail stage writes, and the `ctx` keys it hands on, are fixed in
`TAIL-CONTRACT.md`.

The callable takes the run context and returns the list of artefacts it wrote.
Everything else — entering the stage, recording the exit code, catching the
failure into a gap — is already handled.

Stage order is `spine/runstate.py:ORDER`. It is a list, not prose. That is the
difference from the plugin in one line.
