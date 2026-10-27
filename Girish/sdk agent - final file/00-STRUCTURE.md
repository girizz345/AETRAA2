# BOQ agent

The working copy. Run everything from this folder.

## The eight stages

| # | Folder | Pipeline stages | .py | What it owns |
|---|---|---|---|---|
| 1 | `spine/` | — | 10 | run folder, run record, logging, run identity, gaps, errors, shared record types, CLI |
| 2 | `ingest/` | 0 | 13 | clause table, formula grammar, rate CLASSES (no prices), section crosswalk, discipline matrix, title-block patterns, floor multipliers, unit dictionary, reconciliation gates, house bill format, house conventions |
| 3 | `readers/` | 1–7 | 15 | walk, probe, extract, title block, register, route, schedules, dimensions, counts |
| 4 | `measure/` | 9–12 | 16 | evidence base, inventory, classify, compute, thresholds, deductions, grouping, and `evaluators/` |
| 5 | `takeoff/` | 13–14 | 5 | dimension rows, rollups, audit tabs, markup instructions |
| 6 | `bill/` | 15–19 | 9 | descriptions, completeness gate, non-measured, market rates, pricing, assembly, lettering, pagination |
| 7 | `render/` | 20–21 | 7 | BOQ workbook, take-off workbook, marked-up PDFs, provenance, hygiene, revisions |
| 8 | `model/` | — | 6 | typed client, response schemas, retry, call budget, six prompts |

90 Python files.

## Everything else

| Path | What |
|---|---|
| `pipeline.py` | the stage sequence — belongs to no single stage |
| `runner.py` | throwaway terminal menu, a thin shell over the package |
| `corpus/` | the POMI corpus — the 419-page PDF and its text extraction |
| `data/` | nine ingest tables — 314 clauses, 92 rate classes with 28 ordinal invariants and no prices, 35 discipline prefixes, the 8-column house bill format, the unit dictionary, the reconciliation gates, the floor-multiplier patterns, the title-block specs, the description conventions |
| `reference/` | the 24 harvested reference documents. Read once, converted into `data/`, **never loaded at run time**. See `HARVEST.md` |
| `tests/` | 7 test files, 89 tests. `python3 tests/run_all.py` runs them with or without pytest installed |
| `DECISIONS.md` | the GP1.2 house-decisions register — seven decisions, binding |
| `VERIFICATION.md` | the corpus verification pass and what it found |
| `HARVEST.md` | what each of the 24 references contributed, and the five contradictions they carried |
| `MODULES.md` | every module, its status, its issue number |
| `README.md` | what the agent is, the invariants, what runs today |

## Running it

Modules import each other by stage name — `from measure.evidence import ...` —
so run from this folder and the imports resolve.

```bash
cd ~/Documents/"BOQ agent"

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

Tests: `python3 tests/run_all.py` from here. It runs the same 89 tests with or
without pytest installed, because the machine this agent runs on has no outbound
network and a suite that can only be run elsewhere is a suite nobody runs.

## Status

## This build

Wired to the Claude subscription through `core/ai.py`. The provider-agnostic build is the sibling folder `any llm model/`. See `../00-READ-ME-FIRST.md`.
