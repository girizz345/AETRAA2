# core/ — what came across, and what of it is actually wired

`core/` is AETRAA_SDK's shared framework, copied whole: **51 files,
byte-identical to the source**, including all 38 files under `core/roles/`.
Verified by file-list diff and byte comparison, not by assumption.

## What the BOQ pipeline actually imports

One module. `model/client.py` imports `core.ai` and nothing else:

```python
from core.ai import check_env, report, review, selftest, DEFAULT_MODEL
```

Everything else in `core/` is here as a library you may draw on. It is not
dead weight — it is the rest of your SDK — but nothing in the 21 stages calls
it today.

## Every core module, and whether it duplicates something the BOQ agent has

| core module | What it is | BOQ agent's own | Status |
|---|---|---|---|
| `ai.py` | Claude subscription layer | — | **WIRED** |
| `folderledger.py` | the Folder Manager's register | `spine/runstate.py` + `spine/identity.py` | duplicate |
| `qagate.py` | independent QA gate | `bill/completeness.py` | duplicate |
| `workflow.py` | QS office workflow engine | `pipeline.py` | duplicate |
| `excelbase.py` | Excel house style, shared by every agent | `render/boq_workbook.py`, `render/takeoff_workbook.py` | **overlap worth resolving** |
| `markupbase.py` | sheet-scale-aware PDF annotation | `render/markup_pdf.py`, `takeoff/markup.py` | **overlap worth resolving** |
| `vectorbase.py` | PDF vector run-length measurement | `readers/extract.py` | overlap |
| `dxfbase.py` | DXF/CAD reader (ezdxf) | — | out of scope at v3.1 (PDF only) |
| `roles.py` | the standing team of role agents | `model/prompts.py` | **the seats model, rejected by the BOQ spec** |
| `operator.py` | the human operator's seat | `runner.py` | duplicate |
| `projects.py` | project folder handling | `spine/cli.py` path validation | duplicate |
| `delivery.py` | versioned outputs, final package | `render/revise.py` | overlap |

**Two are worth resolving rather than leaving parallel.** `excelbase.py`
carries the Excel house style *every AETRAA agent's workbook uses* — so the
BOQ workbook rendering should probably sit on it rather than re-implement the
house format, or the two will drift and your bills will stop matching your
other deliverables. Same argument for `markupbase.py`, which is already
sheet-scale aware.

**One is a live contradiction.** `roles.py` is the seats model. The BOQ
build spec rejects it explicitly — *"runtime redundancy, violates invariant
4. The checks those seats perform are worth harvesting into code; the
personas are not."* Both are now in this folder. Decide which governs before
anything is built on either.

## Import health

Every core module imports cleanly except `core.markupbase`, which needs
`fitz` (PyMuPDF). That is a missing dependency rather than a broken copy —
`pymupdf` is already a hard dependency of this build, so it resolves on a
machine with the requirements installed.

## Dependencies

The BOQ pipeline needs three: `pymupdf`, `openpyxl`, `claude-agent-sdk`.

The rest of `core/` carries its own, listed as the `full-core` optional group
in `pyproject.toml` — Pillow, pdfplumber, python-docx, ezdxf, shapely. Install
that group only if you start using those modules.

```bash
pip3 install -e .                 # the pipeline
pip3 install -e ".[full-core]"    # plus everything core/ can do
```

Two things in AETRAA_SDK's requirements are **not pip-installable** and are
not needed by the BOQ pipeline as it stands: LibreOffice (required by
`pomi_takeoff` so its workbook totals are not blank) and tesseract (raster
drawing sets only — this pipeline refuses raster sheets rather than OCR-ing
them).
