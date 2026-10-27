# Module map

50 modules across 8 folders. Status is one of:

- **done** — implemented and exercised
- **contract** — types, signatures, constants and rules are written; the body
  raises `NotImplementedError` naming exactly what it is waiting for
- **port** — an implementation already exists elsewhere and should be adopted
  rather than rewritten

Issue numbers refer to `Aaron-Aetraa/Aetraa-AI-Solutions`.

## spine — the run itself

| Module | Status | Issue |
|---|---|---|
| `spine/records.py` | done | — |
| `spine/errors.py` | done | — |
| `spine/gaps.py` | done | — |
| `spine/identity.py` | done | #63 |
| `spine/runstate.py` | done | #59 |
| `spine/logs.py` | done | #60 |
| `spine/config.py` | done | — |
| `spine/concurrency.py` | done | — |
| `spine/cli.py` | done | #61 |
| `pipeline.py` | contract | — |
| `runner.py` | done | — |

## ingest — stage 0

| Module | Status | Issue |
|---|---|---|
| `ingest/formulas.py` | done | — |
| `ingest/clause_table.py` | done | #74 |
| `ingest/clause_parser.py` | contract — needs the corpus | #73 |
| `ingest/crosswalk.py` | done | — |
| `ingest/rates.py` | done | — |
| `ingest/discipline_matrix.py` | done | #68 |
| `ingest/titleblocks.py` | done | #66 |
| `ingest/conventions.py` | done | — |

## readers — stages 1 to 7

| Module | Status | Issue |
|---|---|---|
| `readers/walk.py` | done | #62 |
| `readers/probe.py` | contract — needs pymupdf | — |
| `readers/extract.py` | port — Aaron's PR #58 | #9 |
| `readers/calibrate.py` | deferred at v3.1 | — |
| `readers/titleblock.py` | contract | #64 #65 #69 |
| `readers/register.py` | contract | #67 #70 #71 #75 |
| `readers/register_output.py` | contract | #72 |
| `readers/route.py` | done | — |
| `readers/schedule_grid.py` | contract | #77 |
| `readers/schedule_columns.py` | contract | #78 |
| `readers/schedule_cells.py` | contract | #79 #80 |
| `readers/schedule_read.py` | contract | #85 #86 #87 |
| `readers/dimensions.py` | done | #88 |
| `readers/counts.py` | contract | — |

## measure — stages 9 to 12

| Module | Status |
|---|---|
| `measure/evidence.py` | done |
| `measure/inventory.py` | floor multipliers and reconcile done; dedup contract |
| `measure/classify.py` | validation done; the call itself contract |
| `measure/compute.py` | done — the single rounding point |
| `measure/thresholds.py` | done |
| `measure/deductions.py` | done |
| `measure/grouping.py` | done |
| `measure/evaluators/linear.py` | done |
| `measure/evaluators/area.py` | done |
| `measure/evaluators/count.py` | done |
| `measure/evaluators/girth.py` | done |
| `measure/evaluators/circular.py` | done |
| `measure/evaluators/reinforcement.py` | done — including the lap refusal |
| `measure/evaluators/mep_risers.py` | done — units by service type |

## takeoff — stages 13 to 14

| Module | Status |
|---|---|
| `takeoff/rows.py` | contract |
| `takeoff/rollup.py` | reconcile done; build contract |
| `takeoff/audit.py` | contract |
| `takeoff/markup.py` | contract |

## bill — stages 15 to 19

| Module | Status |
|---|---|
| `bill/lettering.py` | done |
| `bill/pagination.py` | done |
| `bill/completeness.py` | done — the gate |
| `bill/descriptions.py` | done |
| `bill/nonmeasured.py` | contract |
| `bill/price.py` | envelope and divergence done; the search contract |
| `bill/assemble.py` | ordering and reconcile done; assembly contract |

## render — stages 20 to 21

| Module | Status |
|---|---|
| `render/hygiene.py` | done |
| `render/boq_workbook.py` | contract — needs openpyxl and the reference BOQ |
| `render/takeoff_workbook.py` | contract |
| `render/markup_pdf.py` | contract |
| `render/provenance.py` | contract |
| `render/revise.py` | contract |

## model

| Module | Status | Issue |
|---|---|---|
| `model/schema.py` | done | #82 |
| `model/client.py` | boundary done; the provider call contract | #81 |
| `model/retry.py` | done | #83 |
| `model/budget.py` | done | #84 |
| `model/prompts.py` | done — six judgements | — |

## What unblocks the contracts

| Waiting on | Unblocks |
|---|---|
| POMI corpus | `clause_parser` — and through it every clause-driven module |
| Reference BOQ workbooks | `boq_workbook`, format conformance tests |
| Rate library | `rates` fixtures, `price` |
| Drawing corpus + register | `probe`, `titleblock`, `register`, all schedule readers |
| Surveying decisions | thresholds, grouping, the section-letter cases |
