#!/usr/bin/env python3
"""
BOQ POMI V1 — AETRAA SDK agent entry point.

Aaron's architecture, run through the SDK launcher. The difference from every
other agent in this SDK is where the loop lives: here Python holds it. The
stage order is data (spine/runstate.ORDER), every stage is entered and exited
through the run record, and the model is asked only for labels.

The consequence you can see on the first run: HALF THE STAGES ARE CONTRACTS.
This agent does not hide that. A stage that is not implemented exits 2 and is
recorded as NOT IMPLEMENTED with its reason; a stage that ran and found
nothing exits 0 with zero artefacts. Those two look different in state.json,
which is the whole point — in the installed v4.6.4 plugin they look identical,
and that is why a bill could issue with a check that never ran.

    python3 agent.py <project folder> [--no-ai] [--preflight] [--limit N]

The deliverable is ONE zip in <project>/Reports/BOQ_POMI_V1/ —
"<Project> - BOQ - Rev NN.zip" holding the BOQ workbook, the take-off workbook
and the markup drawings, named by project and revision, no date. The working
record (every stage's JSON, register, provenance, gaps, state, log) stays in
runs/<input_set_hash>/ inside this folder. --out-here puts the zip there too.
Nothing already in the project is read for writing or altered.

Exit 0 = the run completed, gaps or not. A GAP IS AN OUTPUT, NOT A FAILURE —
a run that records forty unresolved title blocks did its job. The launcher
reads any non-zero as "the draft stage reported a problem" and stops the
chain, so returning non-zero for gaps would halt a run that worked.
Exit 2 = bad input, nothing was read. Exit 3 = a gate blocked issue.
"""
from __future__ import annotations

import sys

if sys.version_info < (3, 10):          # say so plainly, before anything newer is imported
    sys.exit("This agent needs Python 3.10 or newer; this is Python "
             f"{sys.version.split()[0]}. On a Mac, install Python 3.12 from python.org "
             "and run it with python3.12 instead of python3.")

import argparse
import json
from decimal import Decimal
import os
import traceback
from datetime import datetime, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

from spine import logs                                    # noqa: E402
from spine.config import DEFAULT                          # noqa: E402
from spine.files import project_files                     # noqa: E402
from spine.gaps import Gap, GapList                       # noqa: E402
from spine.identity import hash_directory                 # noqa: E402
from spine.runstate import DEFERRED, NAMES, ORDER, RunState  # noqa: E402

AGENT = "BOQ POMI V1"
RUNS = HERE / "runs"
OUTPUT = HERE / "output"      # what a person opens after a run: see _to_output

EXIT_OK, EXIT_BAD_INPUT, EXIT_GATE = 0, 2, 3


# ── the stage table: what each stage calls, and what it needs ──────────────
def stage_plan():
    """(stage, callable-or-None, what it needs). None = not wired yet.

    Declared here rather than discovered, so an unwired stage is a visible
    absence in this table instead of a stage that quietly does not exist.

    S1 does the whole register pass — walk, probe, extract, title block,
    revisions, duplicates — because reading a sheet three times to satisfy
    three stage numbers costs three times the I/O on a 385-sheet package. S2
    and S3 publish what that pass found as their own artefacts, so each stage
    still owns an output and still records its own exit code."""
    return {
        "S0":  (_stage_ingest,   "ingest tables"),
        "S1":  (_stage_register, "readers.register — title block + revisions"),
        "S2":  (_stage_probe,    "readers.probe — tier T1..T4"),
        "S3":  (_stage_extract,  "readers.extract — words and paths"),
        "S4":  (_stage_calibrate, "measure.grid + measure.levels — scale, grid, "
                                  "level table"),
        "S5":  (_stage_route,    "readers.route — sheet kind"),
        "S6":  (_stage_schedules, "readers.schedule_* — grid, columns, rows"),
        "S7":  (_stage_counts, "readers.counts — scoped tag counts from the "
                               "text layer; vector symbol clustering is not "
                               "implemented"),
        "S8":  (_stage_measure,   "measure.plan_measure — walls and rooms on the "
                                  "calibrated plans; storey heights, slab and block "
                                  "sizes as the drawings state them"),
        "S9":  (_stage_evidence,  "measure.intake + measure.measured — schedule rows "
                                  "and measured plans to evidence"),
        "S10": (_stage_inventory, "measure.inventory — reconcile and consolidate"),
        "S11": (_stage_classify,  "measure.classify — stated clauses; the "
                                  "residue needs the model"),
        "S12": (_stage_compute,   "measure.compute — the clause's own formula"),
        "S13": (_tail("stages_takeoff", "_stage_takeoff"),
                "takeoff.rows — dimension rows, rollup, item codes"),
        "S14": (_tail("stages_takeoff", "_stage_markup"),
                "takeoff.markup — schedule-row regions, markup spec, closure"),
        "S15": (_tail("stages_bill", "_stage_descriptions"),
                "bill.descriptions — lead + Ditto variants, closing formulas"),
        "S16": (_tail("stages_bill", "_stage_completeness"),
                "bill.completeness — the gate (G+.29), justified in AN.RECONCILIATION"),
        "S17": (_tail("stages_bill", "_stage_nonmeasured"),
                "bill.nonmeasured — section A clauses, each its own item"),
        "S18": (_tail("stages_bill", "_stage_price"),
                "bill.price — market rates via core.ai.research, five guards"),
        "S19": (_tail("stages_bill", "_stage_assemble"),
                "bill.assemble — sections, 62-row pages, letters, collections"),
        "S20": (_tail("stages_render", "_stage_render"),
                "render — takeoff.xlsx, bill.xlsx (house format), markups, provenance"),
        "S21": (_tail("stages_render", "_stage_revise"),
                "render.revise — diff against the previous issue"),
    }


def _tail(module_name: str, fn_name: str):
    """A lazily-bound tail stage. The nine output stages live in three modules
    (stages_takeoff, stages_bill, stages_render). Binding late means a module
    that is absent or broken surfaces as a NOT IMPLEMENTED / FAILED entry in
    state.json for THAT stage, instead of an ImportError that stops the run
    before stage 0 — the reader chain still runs and still produces the
    register either way."""
    import importlib

    try:
        mod = importlib.import_module(module_name)
    except Exception as exc:                                  # noqa: BLE001
        mod, err = None, exc
    else:
        err = None
    fn = getattr(mod, fn_name, None) if mod is not None else None
    if fn is None:
        return None            # stage_plan reads None as "not wired" -> exit 2
    return fn


def _model_client(ctx):
    """One ModelClient per run, built on first use and shared by every stage
    that has a model residue (S5 route, S6 header mapping, S11 classify, S15
    descriptions). Its response cache is content-keyed, so the same judgement
    asked twice in a run is answered once. None when the boundary cannot be
    imported — the caller records a gap and carries on; it never substitutes."""
    if ctx.get("no_ai"):
        return None
    client = ctx.get("model")
    if client is None:
        try:
            from model.client import AI_AVAILABLE, ModelClient
        except ImportError:
            return None
        if not AI_AVAILABLE:
            return None
        client = ModelClient(ctx.get("config"))
        ctx["model"] = client
    return client


def _transcriber(ctx):
    """(store, live) for readers.transcribe: the saved readings - the agent's
    own readings/ and any --readings folder - and whether a live reading may be
    made (the model is available and this is not a --no-ai run)."""
    from readers.transcribe import READINGS, ReadingStore

    if "transcriber" not in ctx:
        live = False
        if not ctx.get("no_ai"):
            try:
                from model.client import AI_AVAILABLE, TRANSCRIPTION_ENABLED
                live = bool(AI_AVAILABLE and TRANSCRIPTION_ENABLED)
            except ImportError:
                live = False
        # the platform's readings answer this agent too (same format, same
        # task names), so a sheet read once by either is never read again
        sibling = HERE.parent / "boq_arch" / "readings"
        ctx["transcriber"] = (ReadingStore([READINGS, *ctx.get("reading_dirs", []), sibling]), live)
    return ctx["transcriber"]


def _stage_register(ctx):
    """Stage 1 — the register. The first output a surveyor can check by eye.

    Prints progress because this stage reads every sheet in the package. On a
    500-sheet set it is minutes of work, and a run that goes silent for minutes
    is indistinguishable from a run that has hung."""
    import time
    from readers.register import build, to_json
    from readers.register_output import write_workbook

    started = time.monotonic()
    every = max(1, ctx.get("progress_every", 25))

    def progress(done, total, doc_id):
        if done % every and done != total:
            return
        elapsed = time.monotonic() - started
        rate = done / elapsed if elapsed else 0
        left = (total - done) / rate if rate else 0
        sys.stdout.write(
            f"\r       reading {done}/{total} sheets "
            f"({rate:.1f}/s, ~{int(left)}s left)   ")
        sys.stdout.flush()

    store, live = _transcriber(ctx)
    sheets, gaps, words = build(ctx["project"], limit=ctx.get("limit"),
                                transcribe=(store, live),
                                workers=ctx["config"].max_workers,
                                progress=progress)
    ctx["word_counts"] = words
    sys.stdout.write("\r" + " " * 60 + "\r")
    ctx["sheets"] = sheets
    ctx["gaps"].extend(list(gaps))
    reg = ctx["run"] / "register.json"
    doc = to_json(sheets)
    # the sheets whose title block was read off the image, with the basis -
    # a reviewer checks these against the drawing
    doc["transcribed_title_blocks"] = list(getattr(build, "transcribed", []))
    # who and what the bill is for, as the title blocks state it (Decision 2,
    # Ajay 28-09-2026): voted across the sheets, the folder name only where
    # the sheets do not agree on a job title
    from readers.project_identity import FIELD_WORDS, heading, vote
    identity = vote(list(getattr(build, "identity", [])))
    ctx["project_identity"] = identity
    ctx["heading"] = heading(identity, Path(ctx["project"]).name)
    doc["project_identity"] = {**identity, "heading": ctx["heading"]}
    for field, why in sorted(identity["refused"].items()):
        ctx["gaps"].add(Gap(stage="S1", doc_id=None, subject=f"project {FIELD_WORDS[field]}",
                            reason=f"the title blocks do not agree on the {FIELD_WORDS[field]} "
                                   f"({why}); it is left off the bill's heading",
                            detail="confirm it with the consultant"))
    for field, groups in sorted(identity["dissent"].items()):
        for g in groups:
            ctx["gaps"].add(Gap(stage="S1", doc_id=g["sheets"][0],
                                subject=f"project {FIELD_WORDS[field]}",
                                reason=f"{len(g['sheets'])} sheet(s) give the {FIELD_WORDS[field]} as "
                                       f"'{g['value']}', where the rest of the package says "
                                       f"'{identity.get(field, '?')}'",
                                detail="are these sheets for this project? " + ", ".join(g["sheets"])))
    if ctx["heading"]["basis"] != "title blocks":
        ctx["gaps"].add(Gap(stage="S1", doc_id=None, subject="project name",
                            reason="no job title that the title blocks agree on, so the bill "
                                   "is headed with the folder name",
                            detail=f"'{ctx['heading']['project']}'"))
    reg.write_text(json.dumps(doc, indent=1, sort_keys=True))
    xlsx = ctx["run"] / "register.xlsx"
    counts = write_workbook(reg, xlsx)
    for problem in counts.get("_hygiene") or []:
        # the register is always produced; a cell that fails hygiene is
        # quoted as written and listed here, never rewritten or dropped
        ctx["gaps"].add(Gap(stage="S1", doc_id=None, subject="register.xlsx",
                            reason=problem))
    return ["register.json", "register.xlsx"]


def _stage_probe(ctx):
    """Stage 2 — readiness, per sheet and per package. The commercial answer:
    how much of this package can software do, before the work is taken on."""
    sheets = ctx.get("sheets") or []
    counts: dict[str, int] = {}
    for s in sheets:
        counts[s.tier.value] = counts.get(s.tier.value, 0) + 1
    measurable = counts.get("T2", 0) + counts.get("T1", 0)
    out = {"sheets": len(sheets), "by_tier": dict(sorted(counts.items())),
           "measurable": measurable, "by_hand": len(sheets) - measurable,
           "statement": f"Of {len(sheets)} sheets, {measurable} can be measured "
                        f"directly. {len(sheets) - measurable} require "
                        f"measurement by hand."}
    (ctx["run"] / "readiness.json").write_text(json.dumps(out, indent=1, sort_keys=True))
    return ["readiness.json"]


def _stage_extract(ctx):
    """Stage 3 — the extraction receipt, sheet by sheet.

    Reads nothing. Stage 1 already opened every sheet and counted its words;
    re-extracting here to satisfy a stage number would double the I/O on the
    whole package for a figure already in hand. The stage still owns its own
    artefact and its own exit code — it just does not pay twice for them."""
    from spine.records import Tier

    counts = ctx.get("word_counts") or {}
    rows = [{"doc_id": s.doc_id, "drawing_no": s.drawing_no,
             "words": counts.get(s.doc_id, 0)}
            for s in (ctx.get("sheets") or []) if s.tier is Tier.T2_VECTOR]
    out = {"frame": "page-display-topleft-pt", "sheets": len(rows),
           "words_total": sum(r["words"] for r in rows),
           "source": "counted during the stage 1 register pass, not re-read",
           "per_sheet": rows}
    (ctx["run"] / "extraction.json").write_text(json.dumps(out, indent=1, sort_keys=True))
    return ["extraction.json"]


def _jsonable(obj):
    """Stage records to JSON: dataclasses become dicts, Decimals become
    strings (never floats — a scale written as 0.35277777 has already lost
    the digits a reviewer would check it by), tuples become lists."""
    import dataclasses
    if dataclasses.is_dataclass(obj) and not isinstance(obj, type):
        return {f.name: _jsonable(getattr(obj, f.name))
                for f in dataclasses.fields(obj)}
    if isinstance(obj, Decimal):
        return str(obj)
    if isinstance(obj, dict):
        return {str(k): _jsonable(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple, set, frozenset)):
        return [_jsonable(v) for v in obj]
    if hasattr(obj, "__dict__") and not isinstance(obj, type):
        return {k: _jsonable(v) for k, v in vars(obj).items()
                if not k.startswith("_")}
    return obj


def _stage_calibrate(ctx):
    """Stage 4 — scale, grid and levels, from the text layer of every T2 sheet.

    Three things a length depends on and a schedule never states: the scale
    of each plan (verified against its own dimension chain, or not), where
    its grid lines are, and the stated level of each storey. Read once here,
    before routing, because the level table votes across every sheet that
    names a level and the grid map is what S9 measures plan lengths against.

    Each sheet's words are extracted ONCE and kept in ctx["words_by_doc"] for
    S9, which releases them when it is done — on a 100-sheet package that is
    the difference between one pass over the PDFs and two.

    The grid and level modules are imported here, not at the top of the file:
    a missing module is a stage-4 gap with a name and the run goes on to
    the register, the schedules and the counts, none of which need it."""
    import time
    from readers.extract import extract_words
    from spine.records import Tier

    started = time.monotonic()
    every = max(1, ctx.get("progress_every", 25))
    budget_s = 5.0

    try:
        from measure import grid
    except ImportError:
        grid = None
        ctx["gaps"].add(Gap(stage="S4", doc_id=None, subject="grid",
                            reason="S4 module measure.grid not present"))
    try:
        from measure import levels
    except ImportError:
        levels = None
        ctx["gaps"].add(Gap(stage="S4", doc_id=None, subject="levels",
                            reason="S4 module measure.levels not present"))

    on_disk = project_files(ctx["project"])
    sheets = [s for s in (ctx.get("sheets") or [])
              if s.tier is Tier.T2_VECTOR and not s.superseded_by]
    total = len(sheets)
    grids: dict = {}
    words_by_doc: dict = {}
    verified: dict = {}
    slow = 0

    def progress(done):
        if done % every and done != total:
            return
        elapsed = time.monotonic() - started
        rate = done / elapsed if elapsed else 0
        left = (total - done) / rate if rate else 0
        sys.stdout.write(f"\r       calibrating {done}/{total} sheets "
                         f"({rate:.1f}/s, ~{int(left)}s left)   ")
        sys.stdout.flush()

    for done, sheet in enumerate(sheets, 1):
        doc_id = sheet.doc_id
        path = on_disk.get(doc_id)
        if path is None:
            ctx["gaps"].add(Gap(stage="S4", doc_id=doc_id,
                                subject=sheet.drawing_no or doc_id,
                                reason="file not found in the project folder"))
            progress(done)
            continue
        t0 = time.monotonic()
        try:
            words = extract_words(path, page_index=0)
        except Exception as exc:                              # noqa: BLE001
            ctx["gaps"].add(Gap(stage="S4", doc_id=doc_id,
                                subject=sheet.drawing_no or doc_id,
                                reason=f"could not extract: {exc}"))
            progress(done)
            continue
        words_by_doc[doc_id] = words
        if grid is not None:
            try:
                W, H, rot = grid.page_size_and_rotation(path)
                gm = grid.calibrate_sheet(words, W, H, rot, doc_id,
                                          title_scale=sheet.scale)
                grids[doc_id] = gm
                verified[doc_id] = bool(grid.verified(gm))
            except Exception as exc:                          # noqa: BLE001
                ctx["gaps"].add(Gap(stage="S4", doc_id=doc_id,
                                    subject=sheet.drawing_no or doc_id,
                                    reason=f"grid not calibrated: {exc}"))
        took = time.monotonic() - t0
        if took > budget_s:
            slow += 1
            ctx["gaps"].add(Gap(stage="S4", doc_id=doc_id,
                                subject=sheet.drawing_no or doc_id,
                                reason=f"sheet took {took:.1f} s to calibrate "
                                       f"(budget {budget_s:.0f} s); its result "
                                       f"is kept, the overrun is reported"))
        progress(done)
    sys.stdout.write("\r" + " " * 60 + "\r")

    # a sheet that states no dimension chain of its own takes its scale from
    # the set's grid: the same bubbles on a calibrated sheet (measure.grid.
    # calibrate_from_set) - the floor plans a bill is measured from are
    # usually such sheets
    if grid is not None:
        from_set = grid.calibrate_from_set(grids)
        for doc_id, gm in from_set.items():
            grids[doc_id] = gm
            verified[doc_id] = True
        from_set = dict.fromkeys(from_set, "a calibrated sheet's grid")
        # still uncalibrated plans with a labelled grid whose chain the text
        # layer does not carry: the printed chain of one of them is read
        # (saved reading, else live, else a request) and CHECKED against its
        # own bubbles before it carries any scale
        pending = sorted((g for g in grids.values() if g.status != "CALIBRATED"
                          and max(len(g.letters), len(g.numbers)) >= grid.SET_MIN_BAYS + 1),
                         key=lambda g: (-(len(g.letters) + len(g.numbers)), g.doc_id))
        by_doc = {s.doc_id: s for s in sheets}
        if pending:
            from readers.transcribe import obtain, sheet_sha1
            store, live = _transcriber(ctx)
            # a sheet whose chain was read before wins (it costs nothing); then
            # the most labelled grid. Only one request is ever left.
            read = [g for g in pending if store.find(sheet_sha1(on_disk[g.doc_id]), "grid_dims")]
            pending = read + [g for g in pending if g not in read][:1]
            for gm in pending:
                sheet = by_doc.get(gm.doc_id)
                label = (sheet.drawing_no if sheet else None) or gm.doc_id
                reading, how = obtain(on_disk[gm.doc_id], "grid_dims",
                                      (sheet.drawing_no if sheet else None) or Path(gm.doc_id).stem,
                                      store, live)
                if reading is None:
                    ctx["gaps"].add(Gap(stage="S4", doc_id=gm.doc_id, subject=label,
                                        reason="plans state no grid dimensions in their text layer, "
                                               f"so none can be measured from; the grid chain was "
                                               f"not read ({how})",
                                        detail="answer the request (readers.requests) or run with "
                                               "the model available, then run again"))
                    break
                new, table, dropped = grid.calibrate_from_reading(gm, reading, how)
                for why in dropped:
                    ctx["gaps"].add(Gap(stage="S4", doc_id=gm.doc_id, subject=f"{label} grid",
                                        reason=why))
                if new is None:
                    continue
                grids[gm.doc_id] = new
                verified[gm.doc_id] = True
                from_set[gm.doc_id] = "its own grid chain, read and checked"
                for doc_id, g2 in grid.calibrate_from_table(grids, table, f"read from {label}").items():
                    grids[doc_id] = g2
                    verified[doc_id] = True
                    from_set[doc_id] = f"the grid chain read from {label}"
                break
        ctx["calibrated_from_set"] = dict(sorted(from_set.items()))

    table = None
    if levels is not None:
        try:
            table, level_gaps = levels.build_level_table(sheets, words_by_doc)
            # the residue: level figures no storey phrase sits beside. The
            # model NAMES them from the words around each figure (labels
            # only — the figure is code-read and never leaves this process);
            # the table is rebuilt with those names. On a real package the
            # deterministic pass read the typical floors only, and every
            # column at Foundation, the podiums, 1st, 9th–12th and Roof was
            # left without a height.
            unnamed = levels.unnamed_levels(sheets, words_by_doc) \
                if hasattr(levels, "unnamed_levels") else []
            if unnamed and not ctx.get("no_ai"):
                model = _model_client(ctx)
                if model is not None:
                    from model.client import ModelUnavailable
                    print(f"        {len(unnamed)} level figure(s) without a storey "
                          f"name to the model (labels only) ...", flush=True)
                    try:
                        names = levels.apply_names(
                            model.ask(levels.name_request(unnamed)).payload, unnamed)
                    except ModelUnavailable as exc:
                        names = {}
                        ctx["gaps"].add(Gap(stage="S4", doc_id=None, subject="level names",
                                            reason=f"model unavailable: {exc}"))
                    if names:
                        table, level_gaps = levels.build_level_table(
                            sheets, words_by_doc, names=names)
                        ctx["level_names_by_model"] = len(names)
            elif unnamed:
                ctx["gaps"].add(Gap(stage="S4", doc_id=None, subject="level names",
                                    reason=f"{len(unnamed)} level figure(s) carry no "
                                           f"storey name on their line (model call "
                                           f"skipped: --no-ai)"))
            ctx["gaps"].extend(list(level_gaps or []))
        except Exception as exc:                              # noqa: BLE001
            ctx["gaps"].add(Gap(stage="S4", doc_id=None, subject="level table",
                                reason=f"level table not built: {exc}",
                                detail=traceback.format_exc()[-400:]))

    ctx["grids"] = grids
    ctx["levels"] = table
    ctx["words_by_doc"] = words_by_doc          # released at the end of S9
    ctx["scale_verified"] = verified

    (ctx["run"] / "grids.json").write_text(json.dumps(
        {doc_id: _jsonable(gm) for doc_id, gm in sorted(grids.items())},
        indent=1, sort_keys=True))
    if table is not None and hasattr(table, "as_dict"):
        level_doc = table.as_dict()
    else:
        level_doc = {"levels": _jsonable(getattr(table, "levels", {}) or {}),
                     "conflicts": _jsonable(getattr(table, "conflicts", []) or [])}
    level_rows, conflicts = level_doc["levels"], level_doc["conflicts"]
    (ctx["run"] / "levels.json").write_text(json.dumps(
        level_doc, indent=1, sort_keys=True))

    by_status: dict = {}
    for gm in grids.values():
        key = str(getattr(gm, "status", "NONE"))
        by_status[key] = by_status.get(key, 0) + 1
    elapsed = time.monotonic() - started
    print(f"        {total} T2 sheets in {elapsed:.1f}s — grids "
          f"{dict(sorted(by_status.items()))}, levels {len(level_rows)}, "
          f"conflicts {len(conflicts)}"
          + (f", {slow} over budget" if slow else "")
          + (f"; {len(ctx.get('calibrated_from_set') or {})} calibrated from the set's grid"
             if ctx.get("calibrated_from_set") else ""), flush=True)
    return ["grids.json", "levels.json"]


def _stage_route(ctx):
    """Stage 5 — sheet kind. Deterministic from the title where it can be, then
    from the file name; the residue is what a model call would be for, and under
    --no-ai it is a gap rather than a guess.

    Every row records WHICH source decided it, because a filename is weaker
    evidence than a title block and a reviewer is entitled to know which sheets
    rest on it."""
    from readers.route import disagreement, route

    rows, ambiguous, by_name, by_model = [], 0, 0, 0
    pending = []
    words_by_doc = ctx.get("words_by_doc") or {}
    for s in ctx.get("sheets") or []:
        heading = _heading_of(words_by_doc.get(s.doc_id)) if words_by_doc else None
        kind, basis = route(s.title, s.doc_id, heading)
        if kind is None:
            pending.append(s)
        elif basis == "file name":
            by_name += 1
        rows.append({"doc_id": s.doc_id, "drawing_no": s.drawing_no,
                     "kind": kind, "basis": basis})

    # A sheet whose title names no kind ("UNDER GROUND WATER TANK & PUMP ROOM")
    # takes its drawing SERIES' kind where every other sheet of that series
    # was routed, by its own title, to the same one: A-07-001 among eight A-07
    # plans is a plan. Unanimous and at least three, or it stays a residue.
    by_series: dict = {}
    for r in rows:
        num = (r.get("drawing_no") or "").upper()
        if r["kind"] and r["basis"] == "title block" and num.count("-") >= 2:
            by_series.setdefault(num.rsplit("-", 1)[0], []).append(r["kind"])
    for s in list(pending):
        num = (s.drawing_no or "").upper()
        kinds = by_series.get(num.rsplit("-", 1)[0]) if num.count("-") >= 2 else None
        if kinds and len(kinds) >= 3 and len(set(kinds)) == 1:
            row = next(r for r in rows if r["doc_id"] == s.doc_id)
            row["kind"] = kinds[0]
            row["basis"] = f"drawing series {num.rsplit('-', 1)[0]} ({len(kinds)} of its sheets are {kinds[0]}s)"
            pending.remove(s)

    # the residue: the model reads the sheet's own largest words and returns
    # a label from the closed set. Batched per package, labels only.
    modelled: dict = {}
    if pending and not ctx.get("no_ai"):
        model = _model_client(ctx)
        if model is not None:
            print(f"        {len(pending)} sheets to the model for kind "
                  f"(labels only) ...", flush=True)
            modelled = _route_by_model(ctx, model, pending)
    for row in rows:
        if row["kind"] is None and row["doc_id"] in modelled:
            row["kind"], row["basis"] = modelled[row["doc_id"]], "model"
            by_model += 1

    for s in pending:
        if s.doc_id in modelled:
            continue
        ambiguous += 1
        ctx["gaps"].add(Gap(stage="S5", doc_id=s.doc_id,
                            subject=s.drawing_no or "unresolved",
                            reason="sheet kind not resolvable from the title "
                                   "or the file name"
                                   + (" (model call skipped: --no-ai)"
                                      if ctx.get("no_ai") else
                                      "; the model did not classify it")))
    for s in ctx.get("sheets") or []:
        clash = disagreement(s.title, s.doc_id)
        if clash:
            ctx["gaps"].add(Gap(stage="S5", doc_id=s.doc_id,
                                subject=s.drawing_no or s.doc_id,
                                reason=f"sheet kind disputed — {clash}",
                                detail="not resolved here; one of the two is wrong"))
    out = {"resolved": len(rows) - ambiguous, "ambiguous": ambiguous,
           "resolved_by_file_name": by_name, "resolved_by_model": by_model,
           "sheets": rows}
    (ctx["run"] / "routing.json").write_text(json.dumps(out, indent=1, sort_keys=True))
    ctx["routing"] = rows
    return ["routing.json"]


def _heading_of(words, limit: int = 40) -> str:
    """The largest words of a sheet already read (S4 keeps them), in reading
    order — the sheet naming itself. Same rule as _largest_words, no I/O."""
    if not words:
        return ""
    ranked = sorted(words, key=lambda w: (-(w.y1 - w.y0), w.index))[:limit]
    seen, out = set(), []
    for w in sorted(ranked, key=lambda w: w.index):
        t = w.text.strip()
        if t and t.upper() not in seen:
            seen.add(t.upper())
            out.append(t)
    return " ".join(out)


def _largest_words(path, limit: int = 40) -> str:
    """The sheet's own biggest text — the title strip, the sheet name, the
    schedule heading — as the evidence a kind is judged from. Size is the
    word's box height; the words are given in reading order, not by size, so
    a heading reads as a heading."""
    from readers.extract import extract_words

    try:
        words = extract_words(path, page_index=0)
    except Exception:                                         # noqa: BLE001
        return ""
    ranked = sorted(words, key=lambda w: (-(w.y1 - w.y0), w.index))[:limit]
    ordered = sorted(ranked, key=lambda w: w.index)
    seen, out = set(), []
    for w in ordered:
        t = w.text.strip()
        if t and t.upper() not in seen:
            seen.add(t.upper())
            out.append(t)
    return " ".join(out)


def _route_by_model(ctx, model, pending) -> dict:
    """doc_id -> kind for the sheets the model classified. A sheet it omitted
    or answered outside the enum is simply absent, and becomes the gap the
    caller records. ModelUnavailable is a gap for the whole batch."""
    from model.client import ModelUnavailable, Request
    from readers.route import KINDS

    on_disk = project_files(ctx["project"])
    lines = []
    for s in sorted(pending, key=lambda s: s.doc_id):
        path = on_disk.get(s.doc_id)
        hint = _largest_words(path) if path else ""
        lines.append(f"{s.doc_id} | {s.drawing_no or ''} | {s.title or ''} | "
                     f"{s.subtitle or ''} | {hint}")
    out: dict = {}
    batch = 40
    for start in range(0, len(lines), batch):
        request = Request(judgement="sheet_kind",
                          context={"sheets": "\n".join(lines[start:start + batch])},
                          enum=tuple(KINDS))
        try:
            response = model.ask(request)
        except ModelUnavailable as exc:
            ctx["gaps"].add(Gap(stage="S5", doc_id=None, subject="sheet kind",
                                reason=f"model unavailable: {exc}"))
            continue
        wanted = {s.doc_id for s in pending}
        for item in response.payload.get("items", []):
            doc_id = str(item.get("doc_id") or "")
            if doc_id in wanted and item.get("kind") in KINDS:
                out[doc_id] = item["kind"]
    return out


def _subject_by_model(ctx, model, pending) -> dict:
    """doc_id -> element type for the schedules the model could name from
    their own heading words and first rows. Answers outside the closed set
    are dropped; an unreachable model is a gap for the batch."""
    from measure.intake import ELEMENT_TYPES
    from model.client import ModelUnavailable, Request

    lines = []
    for s in sorted(pending, key=lambda s: s["doc_id"]):
        rows = s.get("rows") or []
        first = "; ".join(
            f"{r.get('mark')}: " + ", ".join(f"{k}={v}" for k, v in
                                             sorted((r.get("values") or {}).items()))
            for r in rows[:3])
        lines.append(f"{s['doc_id']} | {s.get('heading') or ''} | roles "
                     f"{', '.join(s.get('roles') or [])} | {first}"[:600])
    out: dict = {}
    for start in range(0, len(lines), 40):
        request = Request(judgement="schedule_subject",
                          context={"sheets": "\n".join(lines[start:start + 40])},
                          enum=tuple(ELEMENT_TYPES))
        try:
            response = model.ask(request)
        except ModelUnavailable as exc:
            ctx["gaps"].add(Gap(stage="S9", doc_id=None, subject="schedule subject",
                                reason=f"model unavailable: {exc}"))
            continue
        wanted = {s["doc_id"] for s in pending}
        for item in response.payload.get("items", []):
            doc_id = str(item.get("doc_id") or "")
            if doc_id in wanted and item.get("subject") in ELEMENT_TYPES:
                out[doc_id] = item["subject"]
    return out


def _grid_text(grid, rows: int = 8) -> str:
    """The grid as the model sees it: row index, column index, text. The
    first rows only — a header lives at the top, and 400 rows of door marks
    add nothing to the question of which column is which."""
    lines = []
    for r in range(min(grid.n_rows, rows)):
        cells = grid.row(r)
        if cells:
            lines.append(f"row {r}: " + " | ".join(
                f"c{c.col}={c.text}" for c in cells))
    return "\n".join(lines)


def _map_by_model(ctx, model, grid):
    """The S6 residue: a header that does not name its columns. The model
    returns column INDICES per role; validate() then refuses an unknown role,
    an index off the grid, a column claimed twice or a missing mark, and the
    caller records the refusal as the gap. Nothing is read from a mapping that
    did not validate."""
    from model.client import ModelUnavailable, Request
    from readers.schedule_read import ROLES, ColumnMapping

    request = Request(judgement="column_mapping",
                      context={"doc_id": grid.doc_id,
                               "grid": _grid_text(grid),
                               "roles": ", ".join(ROLES)})
    try:
        response = model.ask(request)
    except ModelUnavailable as exc:
        return None, f"model unavailable: {exc}"
    payload = response.payload
    # what came back, kept on the schedule record so a refused map can be
    # read against the grid instead of taken on trust
    ctx.setdefault("model_column_maps", {})[grid.doc_id] = {
        "columns": payload.get("columns"), "header_row": payload.get("header_row"),
        "grid_head": _grid_text(grid, rows=4)}
    columns_raw = payload.get("columns")
    if not isinstance(columns_raw, dict) and payload.get("ref") == "columns":
        # a bare-object reply flattened by the parser: the column map
        # survives as the row keyed "columns"; the header row does not
        columns_raw = {k: v for k, v in payload.items() if k != "ref"}
    if not isinstance(columns_raw, dict):
        return None, "model returned no column map"
    columns: dict = {}
    for role, index in sorted(columns_raw.items()):
        try:
            columns[str(role).lower()] = int(index)
        except (TypeError, ValueError):
            return None, f"model column index for {role!r} is not an index"
    if "mark" not in columns:
        return None, "model column map names no mark column"
    # one column, one role. The mark is required and keeps its column; a
    # second role the model put on the same column is dropped — fewer roles
    # read is a loss the gap list can see, a doubled column is not.
    dropped = sorted(r for r, c in columns.items()
                     if c == columns["mark"] and r != "mark")
    for role in dropped:
        del columns[role]
    seen: dict = {}
    for role in sorted(columns):
        col = columns[role]
        if col in seen:
            dropped.append(role)
            del columns[role]
        else:
            seen[col] = role
    # the header row: the model's if it gave one, else derived — the last
    # row above the first mark-shaped cell in the mark column
    try:
        header_row = int(payload.get("header_row"))
    except (TypeError, ValueError):
        header_row = _header_row_from_marks(grid, columns["mark"])
        if header_row is None:
            return None, ("model returned no header row index and the mark "
                          "column holds no mark-shaped cell")
    mapping = ColumnMapping(doc_id=grid.doc_id, page=grid.page,
                            columns=columns, header_row=header_row,
                            mark_basis="model")
    problems = mapping.validate(grid.n_cols)
    if problems:
        return None, "model column map refused: " + "; ".join(problems)
    # the model's mark column must behave like one — mostly mark-shaped
    # cells that identify their rows — exactly as the deterministic path
    # demands. Without this, a drawing list and a details sheet were read as
    # column schedules and "600", "500", "1" became columns in the bill.
    from readers.schedule_read import mark_column_plausible
    why_not = mark_column_plausible(grid, columns["mark"], header_row,
                                    located="location" in columns)
    if why_not:
        return None, f"model column map refused: mark column — {why_not}"
    note = (f"roles dropped for sharing a column: {', '.join(dropped)}"
            if dropped else None)
    return mapping, note


def _header_row_from_marks(grid, mark_col: int):
    from readers.schedule_read import MARK_SHAPE

    for cell in grid.column(mark_col):
        if MARK_SHAPE.match(cell.text.strip().upper()):
            return max(cell.row - 1, 0)
    return None


def _stage_schedules(ctx):
    """Stage 6 — read every schedule sheet into rows.

    Schedules are the highest-reliability quantity source in a package: the
    quantities are STATED on the sheet rather than derived from geometry, so
    these rows carry more weight than anything measured later and are read
    first.

    A PDF holds no table — it holds words at coordinates — so the table is
    rebuilt: band the words into rows, find the column separators from the gaps
    that persist across most rows, resolve the two into a grid, then read the
    header to learn which column is which. The header names its own columns, so
    most sheets need no model call at all, and a sheet whose header cannot be
    read is a gap rather than a guess.

    Nothing is written into the drawings folder; the rows land in the run."""
    from readers.extract import extract_paths, extract_words
    from readers.schedule_cells import assemble
    from readers.schedule_columns import corroborate_with_rules, locate_table
    from readers.schedule_grid import band_rows
    from readers.schedule_read import map_from_header, read_rows

    wanted = [r for r in (ctx.get("routing") or []) if r.get("kind") == "schedule"]
    out = {"sheets_routed_as_schedule": len(wanted), "read": 0,
           "rows_total": 0, "blank_marks": 0, "schedules": []}

    if not wanted:
        ctx["gaps"].add(Gap(stage="S6", doc_id=None, subject="schedules",
                            reason="no sheet in the package routed as a schedule"))
        (ctx["run"] / "schedules.json").write_text(
            json.dumps(out, indent=1, sort_keys=True))
        return ["schedules.json"]

    # SheetRecord carries doc_id, not a path — resolve once for the whole stage
    # rather than rglob-ing per sheet on a 500-file package.
    on_disk = project_files(ctx["project"])
    titles = {s.doc_id: s.title for s in (ctx.get("sheets") or [])}

    for row in wanted:
        doc_id = row["doc_id"]
        path = on_disk.get(doc_id)
        record = {"doc_id": doc_id, "drawing_no": row.get("drawing_no"),
                  "basis": row.get("basis"),
                  # what the sheet says it schedules: its title-block title and
                  # the heading above the table (its largest words). S9 reads
                  # the subject from these, not from the column headings.
                  "title": titles.get(doc_id),
                  "heading": _largest_words(path, limit=14) if path else ""}
        if path is None:
            record["problem"] = "file not found in the project folder"
            ctx["gaps"].add(Gap(stage="S6", doc_id=doc_id,
                                subject=row.get("drawing_no") or doc_id,
                                reason=record["problem"]))
            out["schedules"].append(record)
            continue
        try:
            words = extract_words(path, page_index=0)
            paths = list(extract_paths(path, page_index=0))
        except Exception as exc:                              # noqa: BLE001
            record["problem"] = f"could not extract: {exc}"
            ctx["gaps"].add(Gap(stage="S6", doc_id=doc_id,
                                subject=row.get("drawing_no") or doc_id,
                                reason=record["problem"]))
            out["schedules"].append(record)
            continue

        # The title block is cut away first. Its revision table (DATE |
        # DESCRIPTION | BY) and consultant rows are a table too, and on a sheet
        # whose schedule is drawn as graphics they are the ONLY table - so they
        # were read as the schedule and the model was asked for a mark column
        # in a title block. The edge is the block's ruled border, found from
        # the drawing and anchored on the drawing number (titleblock.block_edge).
        from readers.titleblock import block_edge, outside_block
        edge = block_edge(path, words, row.get("drawing_no"))
        record["title_block_edge"] = list(edge) if edge else None
        words = outside_block(words, edge)
        record["type_tags"] = _type_tags(words, doc_id, row.get("drawing_no"))

        bands = band_rows(words)
        # the table is LOCATED first. A drawing sheet is mostly not a table —
        # title block, authority stamp, general notes, legend — and looking for
        # columns across all of it finds none: measured on this package, three
        # schedule sheets yielded zero columns until the table was isolated.
        raw, table_rows = locate_table(bands)
        boundaries = corroborate_with_rules(raw, paths) if raw else []
        record["bands"] = len(bands)
        record["table_rows"] = len(table_rows)
        record["columns"] = len(boundaries) + 1 if boundaries else 0

        if _is_graphic(words, record["type_tags"]) and (not boundaries
                                                       or not _has_values(words)):
            tags = record["type_tags"]
            record["graphic"] = True
            done, how = _transcribe_schedule(ctx, path, row, record, out, edge, titles)
            if done:
                continue
            record["problem"] = (
                "schedule content is graphic and has not been transcribed yet - "
                + (f"{len(tags)} type tag(s) are text ({', '.join(tags[:12])}"
                   f"{' …' if len(tags) > 12 else ''}); " if tags else "")
                + f"{how}")
            ctx["gaps"].add(Gap(stage="S6", doc_id=doc_id,
                                subject=row.get("drawing_no") or doc_id,
                                reason=record["problem"],
                                detail="run with the model available to transcribe "
                                       "it, answer the request, or give --readings a "
                                       "folder that holds a reading of this sheet"))
            out["schedules"].append(record)
            continue
        if not boundaries:
            # a door / window schedule with no table the text layer can rebuild
            # is read off the sheet instead, as a drawn one is
            done, how = _transcribe_schedule(ctx, path, row, record, out, edge, titles)
            if done:
                continue
            record["problem"] = ("no table on this sheet — no column structure "
                                 "persists across enough rows. Either it is not "
                                 "a schedule, or its text is outlined"
                                 + (f"; {how}" if how else ""))
            ctx["gaps"].add(Gap(stage="S6", doc_id=doc_id,
                                subject=row.get("drawing_no") or doc_id,
                                reason=record["problem"]))
            out["schedules"].append(record)
            continue

        grid = assemble([bands[i] for i in table_rows], boundaries, doc_id, 1)
        record["grid_rows"] = grid.n_rows
        mapping = map_from_header(grid)
        if mapping is None and not ctx.get("no_ai"):
            model = _model_client(ctx)
            if model is not None:
                print(f"        {doc_id}: header unreadable — column map "
                      f"to the model (indices only) ...", flush=True)
                mapping, why = _map_by_model(ctx, model, grid)
                record["model"] = why or "column map from the model, validated"
                record["model_reply"] = (ctx.get("model_column_maps") or {}).get(doc_id)
        if mapping is None:
            # the header could not be mapped - by the words or by the model
            # (A-501 on a 385-sheet package): read the printed cards instead,
            # rather than leave a door schedule, and so the bill, unread
            done, how = _transcribe_schedule(ctx, path, row, record, out, edge, titles)
            if done:
                continue
            record["problem"] = ("header does not name its columns — needs the "
                                 "model" + (" (skipped: --no-ai)"
                                            if ctx.get("no_ai") else
                                            f" ({record.get('model')})")
                                 + (f"; {how}" if how else ""))
            ctx["gaps"].add(Gap(stage="S6", doc_id=doc_id,
                                subject=row.get("drawing_no") or doc_id,
                                reason=record["problem"]))
            out["schedules"].append(record)
            continue

        try:
            rows_read, blanks = read_rows(grid, mapping)
        except ValueError as exc:
            done, how = _transcribe_schedule(ctx, path, row, record, out, edge, titles)
            if done:
                continue
            record["problem"] = f"column mapping invalid: {exc}" + (f"; {how}" if how else "")
            ctx["gaps"].add(Gap(stage="S6", doc_id=doc_id,
                                subject=row.get("drawing_no") or doc_id,
                                reason=record["problem"]))
            out["schedules"].append(record)
            continue

        record.update({
            "roles": sorted(mapping.columns),
            "mark_basis": mapping.mark_basis,
            "header_row": mapping.header_row,
            "rows": len(rows_read),
            "blank_marks": blanks,
            "marks": [r.mark for r in rows_read],
            # r.values already carries the mark under its own role, so
            # dict(mark=..., **values) collides. Build it explicitly.
            "sample": [{"mark": r.mark,
                        **{k: v for k, v in r.values.items() if k != "mark"}}
                       for r in rows_read[:3]],
            # every row, because stage 9 reads them. A sample is for the eye;
            # the pipeline needs the set.
            "rows": [{"mark": r.mark, "values": r.values,
                      "row_index": r.row_index} for r in rows_read],
        })
        if blanks:
            ctx["gaps"].add(Gap(stage="S6", doc_id=doc_id,
                                subject=row.get("drawing_no") or doc_id,
                                reason=f"{blanks} row(s) carry no mark and were "
                                       f"not read",
                                detail="a schedule of 47 rows with 3 blank marks "
                                       "is a 44-row schedule — raise as a query"))
        out["read"] += 1
        out["rows_total"] += len(rows_read)
        out["blank_marks"] += blanks
        out["schedules"].append(record)

    # A door or window schedule that is in the package and was not read is a
    # hole in section H the gate below cannot see: it looks for rows of each
    # kind of evidence present, and an unread sheet produced no evidence. Named
    # here, S16 withholds the bill for it (A-13-002 timed out on one run and the
    # bill issued with 11 of 199 windows, completeness "clear").
    from measure.intake import element_type_of
    ctx["unread_schedules"] = []
    for rec in out["schedules"]:
        if rec.get("problem") and not rec.get("rows"):
            subject = element_type_of(rec["doc_id"], rec.get("title"), rec.get("heading"))
            if subject in ("door", "window", "glazing", "louvre"):
                ctx["unread_schedules"].append(
                    {"doc_id": rec["doc_id"], "drawing_no": rec.get("drawing_no"),
                     "subject": subject, "problem": rec["problem"]})
    out["unread"] = ctx["unread_schedules"]

    ctx["schedules"] = out["schedules"]
    (ctx["run"] / "schedules.json").write_text(
        json.dumps(out, indent=1, sort_keys=True))
    return ["schedules.json"]


_TRANSCRIBABLE = ("door", "window", "glazing", "louvre")


def _transcribe_schedule(ctx, path, row, record, out, edge, titles) -> tuple[bool, str]:
    """Read a door or window schedule's printed cards off the sheet (saved
    reading, else a live one, else a request) when its text could not be read
    as a table. (read, how). On a read the record carries the rows as
    Origin.TRANSCRIBED and is counted; otherwise how says what happened and the
    caller records its gap. Any other kind of schedule is not asked: the
    transcription task is written for door and window cards."""
    from measure.intake import element_type_of
    from readers.transcribe import obtain, schedule_rows

    doc_id = row["doc_id"]
    subject = element_type_of(doc_id, titles.get(doc_id), record.get("heading"))
    if subject not in _TRANSCRIBABLE:
        # a column or beam schedule is not asked door-card questions
        return False, (f"no transcription for a drawn {subject or 'unnamed'} schedule"
                       if record.get("graphic") else "")
    store, live = _transcriber(ctx)
    reading, how = obtain(path, "schedule", row.get("drawing_no") or Path(doc_id).stem,
                          store, live, edge)
    record["transcription"] = how
    rows_read = schedule_rows(reading) if reading is not None else []
    if not rows_read:
        return False, how
    record.update({
        "origin": "transcribed", "mark_basis": "transcribed",
        "roles": sorted({k for r in rows_read for k in r["values"]}),
        "marks": [r["mark"] for r in rows_read],
        "sample": [r["values"] for r in rows_read[:3]],
        "rows": rows_read,
        "sheet_notes": reading.get("sheet_notes") or []})
    record.pop("problem", None)
    for il in reading.get("illegible") or []:
        ctx["gaps"].add(Gap(stage="S6", doc_id=doc_id,
                            subject=row.get("drawing_no") or doc_id,
                            reason=f"not legible on the schedule: "
                                   f"{il.get('field', '')} at {il.get('where', '')}",
                            detail=il.get("reason")))
    out["read"] += 1
    out["rows_total"] += len(rows_read)
    out["schedules"].append(record)
    return True, how


def _type_tags(words, doc_id, drawing_no) -> list:
    """The door / window type tags a schedule sheet carries as text ("DW 01",
    "D-4"), in the order drawn. Two-word tags ("DW" over "01") are joined.
    Read with the architectural tag patterns of the discipline matrix."""
    import re as _re
    from ingest.discipline_matrix import DisciplineMatrix

    matrix = DisciplineMatrix.load()
    pats = [_re.compile(rf"^(?:{p.regex})$", _re.IGNORECASE)
            for p in matrix.tag_patterns("A")]
    is_tag = lambda t: _re.search(r"\d", t) and any(p.match(t.replace(" ", "")) for p in pats)  # noqa: E731
    found = []
    for w in words:
        t = w.text.strip().upper()
        if is_tag(t):
            tag = t
        elif _re.fullmatch(r"[A-Z]{1,3}", t):
            # a tag drawn in two parts: the letters, and the number set just
            # under them (or just after them on the line) - "DW" over "01"
            h = max(w.y1 - w.y0, 1.0)
            nums = [v for v in words if _re.fullmatch(r"\d{1,3}[A-Z]?", v.text.strip())
                    and ((abs(v.x0 - w.x0) < 1.5 * h and 0 < v.y0 - w.y0 < 2.5 * h)
                         or (abs(v.y0 - w.y0) < 0.5 * h and 0 <= v.x0 - w.x1 < 1.5 * h))]
            if not nums:
                continue
            v = min(nums, key=lambda v: (abs(v.y0 - w.y0) + abs(v.x0 - w.x0)))
            tag = f"{t} {v.text.strip().upper()}"
            if not is_tag(tag):
                continue
        else:
            continue
        if tag not in found:
            found.append(tag)
    return sorted(found, key=lambda s: (_re.sub(r"[^A-Z]", "", s),
                                        int(_re.sub(r"\D", "", s) or 0)))


def _is_graphic(words, tags) -> bool:
    """A schedule whose content is drawn rather than written: once the title
    block is gone, little text is left - type tags and general notes - and no
    table. (A text schedule has hundreds of words in its rows.)"""
    return len(words) < 400 or bool(tags)


def _has_values(words) -> bool:
    """Does the text hold what a schedule's rows hold - sizes and quantities
    ("900x2100", "1200", "12 NOS")? A graphic schedule's text is its type tags
    and general notes; a few notes can still line up like a small table."""
    import re as _re
    size = _re.compile(r"^\d{3,4}$|\d{3,4}\s*[xX×*]\s*\d{3,4}|^(?:NOS?|QTY)\.?$", _re.IGNORECASE)
    return sum(1 for w in words if size.search(w.text.strip())) >= 3


def _stage_counts(ctx):
    """Stage 7 — count what the sheets label.

    Two halves, and only one of them exists yet. Counting TAGS from the text
    layer is reading: "D-04" on a plan is a door the draughtsman named, and the
    patterns are scoped per discipline so a structural W12 is never read as a
    window. That half is implemented here.

    Clustering unlabelled SYMBOLS from vector geometry is not, and the gap says
    so rather than letting a partial count pass as a full one. A door drawn with
    no tag is invisible to this stage, which is exactly why stage 10 reconciles
    these counts against the schedule instead of trusting either alone.

    Door and window tags are counted where a surveyor would count them: once,
    on the floor plan of the floor they are on (disciplines.json, reconcile_on),
    times the floors that plan serves ("TYP ( 4 - 5 )" is two), with each tag's
    position kept so stage 10 can tell an L-shaped window tagged on both legs
    from two windows. Text another sheet contributes as an underlay (the lower
    roof drawn beneath the upper roof plan) is not this sheet's and is dropped."""
    from ingest.discipline_matrix import DisciplineMatrix
    from measure.inventory import floor_multiplier, plan_floors
    from readers.counts import count_tags, find_tags, totals_by_value
    from readers.extract import extract_words, is_underlay, word_layers

    FAMILY = "doors_windows"
    matrix = DisciplineMatrix.load()
    family_of = {p.tag: p.family for p in matrix.tag_patterns()}
    scope = matrix.reconcile_scope(FAMILY)
    plan_kinds = set(scope.get("sheet_kinds") or ["plan"])
    not_titles = [t.upper() for t in scope.get("not_titles") or []]
    on_disk = project_files(ctx["project"])
    records = {s.doc_id: s for s in (ctx.get("sheets") or [])}
    numbers = sorted({s.drawing_no for s in records.values() if s.drawing_no})
    grids = ctx.get("grids") or {}
    wanted = [r for r in (ctx.get("routing") or [])
              if r.get("kind") in ("plan", "elevation", "section", "detail")]

    all_counts = []
    per_sheet = []
    plans = []
    for row in wanted:
        doc_id = row["doc_id"]
        path = on_disk.get(doc_id)
        if path is None:
            continue
        # the drawing number's prefix; failing that, the discipline folder the
        # sheet was issued in (Structure/STRUCTURE Sheet 05.pdf)
        resolved, _basis = matrix.resolve_for(row.get("drawing_no"), doc_id)
        discipline = resolved.prefix if resolved else None
        if discipline is None:
            ctx["gaps"].add(Gap(stage="S7", doc_id=doc_id,
                                subject=row.get("drawing_no") or doc_id,
                                reason="no discipline prefix and no discipline "
                                       "folder, so no tag pattern is in scope "
                                       "for this sheet"))
            continue
        try:
            words = extract_words(path, page_index=0)
        except Exception as exc:                              # noqa: BLE001
            ctx["gaps"].add(Gap(stage="S7", doc_id=doc_id,
                                subject=row.get("drawing_no") or doc_id,
                                reason=f"could not extract: {exc}"))
            continue
        try:
            layers = word_layers(path, words, 0)
            words = [w for w, lay in zip(words, layers)
                     if not is_underlay(lay, row.get("drawing_no"), numbers)]
        except Exception:                                     # noqa: BLE001
            pass                    # no layer names: every word is the sheet's own
        counts = [c for c in count_tags(words, doc_id, discipline, matrix)
                  if family_of.get(c.tag) != FAMILY]
        all_counts.extend(counts)
        entry = {"doc_id": doc_id, "discipline": discipline,
                 "tags": len(counts),
                 "occurrences": sum(c.count for c in counts)}

        sheet = records.get(doc_id)
        title = sheet.title if sheet else None
        subtitle = sheet.subtitle if sheet else None
        if row.get("kind") in plan_kinds and not any(t in (title or "").upper()
                                                     for t in not_titles):
            hits = find_tags(words, discipline, matrix, family=FAMILY)
            if hits:
                tags: dict = {}
                for _kind, key, x, y in hits:
                    tags.setdefault(key, []).append((x, y))
                mult = floor_multiplier(subtitle or title)
                if mult is None:
                    ctx["gaps"].add(Gap(stage="S7", doc_id=doc_id,
                                        subject=row.get("drawing_no") or doc_id,
                                        reason=f"the floors this plan serves are not "
                                               f"stated ('{subtitle or title}'), so its "
                                               f"door and window tags are counted once",
                                        detail="state the floors (e.g. TYP (4-5)) or "
                                               "check the schedule count by hand"))
                grid = grids.get(doc_id)
                mm = getattr(grid, "mm_per_pt", None) if grid is not None else None
                plans.append({"doc_id": doc_id, "drawing_no": row.get("drawing_no"),
                              "title": title, "floors": plan_floors(title, subtitle),
                              "multiplier": mult or 1,
                              "mm_per_pt": float(mm) if mm else None,
                              "tags": tags})
                entry["door_window_tags"] = {k: len(v) for k, v in sorted(tags.items())}
                entry["multiplier"] = mult or 1
                entry["floors"] = plan_floors(title, subtitle)
        per_sheet.append(entry)

    ctx["plan_tags"] = plans
    tag_counts = totals_by_value(all_counts)
    for p in plans:
        for key, where in p["tags"].items():
            tag_counts[key] = tag_counts.get(key, 0) + len(where) * p["multiplier"]
    ctx["tag_counts"] = tag_counts
    ctx["gaps"].add(Gap(stage="S7", doc_id=None, subject="symbol clustering",
                        reason="unlabelled vector symbols are not counted",
                        detail="only tags in the text layer are counted; an "
                               "element drawn without a tag is not seen here, "
                               "so a schedule count is the stronger source"))
    out = {"sheets_examined": len(per_sheet),
           "distinct_tag_values": len(ctx["tag_counts"]),
           "total_occurrences": sum(ctx["tag_counts"].values()),
           "by_sheet": per_sheet,
           "by_value": dict(sorted(ctx["tag_counts"].items())),
           "floor_plans_counted": [
               {k: p[k] for k in ("drawing_no", "title", "floors", "multiplier", "mm_per_pt")}
               for p in plans],
           "symbol_clustering": "not implemented"}
    (ctx["run"] / "counts.json").write_text(
        json.dumps(out, indent=1, sort_keys=True))
    return ["counts.json"]


def _stage_measure(ctx):
    """Stage 8 — the plans measured (CR-01 R1-R3). Walls and rooms off every
    calibrated general-arrangement plan, one per storey, with the storey
    heights, slab thickness and block sizes the drawings state. No quantity:
    S9 turns these into evidence and S12 computes."""
    from measure import plan_measure

    store, live = _transcriber(ctx)
    result = plan_measure.measure(ctx, store, live)
    for gap in result["gaps"]:
        ctx["gaps"].add(gap)
    art = result["artefact"]
    ctx["measured"] = art
    walls = sum(len(p.get("walls") or []) for p in art["plans"])
    rooms = sum(len(p.get("rooms") or []) for p in art["plans"])
    floors = sorted({f for p in art["plans"] for f in p.get("measured_floors") or []})
    print(f"  S8   {len(art['plans'])} plan(s) measured ({', '.join(floors) or 'none'}): "
          f"{walls} wall pieces, {rooms} rooms; storeys {len(art['storeys'])}, "
          f"slab {art['slab_mm'] or '-'} mm, blocks {art['blocks_mm'] or '-'}", flush=True)
    (ctx["run"] / "measured.json").write_text(json.dumps(art, indent=1, sort_keys=True, default=str))
    return ["measured.json"]


def _stage_evidence(ctx):
    """Stage 9 — the addressable base. Nothing may be measured from anything else.

    Schedule rows become evidence records with origin STATED, because a figure
    read out of a schedule cell is stated: the schedule says the door is 1100 mm
    wide. GP3.1 rounding happens here, on intake, and nowhere else.

    A qualified figure is REFUSED rather than cleaned — "approx 1100" and
    "1100 TYP" become gaps. That refusal is what keeps an approximation out of a
    cell where it would be indistinguishable from a measurement."""
    from measure.intake import build, element_type_of

    schedules = [s for s in (ctx.get("schedules") or []) if s.get("rows")]

    # the residue: a schedule whose title, heading and name do not say what
    # it schedules goes to the model for a label from the closed set of
    # element types; unanswered, it stays the gap intake records
    pending = [s for s in schedules
               if element_type_of(s["doc_id"], s.get("title"), s.get("heading")) is None]
    if pending and not ctx.get("no_ai"):
        model = _model_client(ctx)
        if model is not None:
            print(f"        {len(pending)} schedule(s) to the model for subject "
                  f"(labels only) ...", flush=True)
            for doc_id, subject in _subject_by_model(ctx, model, pending).items():
                for s in schedules:
                    if s["doc_id"] == doc_id:
                        s["subject"] = subject
                        s["subject_basis"] = "model"
    base, elements, gaps = build(schedules)
    for gap in gaps:
        ctx["gaps"].add(gap)
    # what S4 read — storey heights from the level table, lengths measured
    # between grid lines on the calibrated plans — attached to the elements
    # the schedules built. A failure here is a gap, not a lost stage: the
    # stated evidence above stands on its own.
    try:
        elements = _attach_s4(ctx, base, elements)
    except Exception as exc:                                  # noqa: BLE001
        ctx["gaps"].add(Gap(stage="S9", doc_id=None, subject="S4 attachment",
                            reason=f"heights and plan lengths not attached: {exc}",
                            detail=traceback.format_exc()[-400:]))
    # the second source: what S8 measured off the plans (walls, rooms), as
    # elements of several dimension lines each (measure.measured)
    measured = ctx.get("measured")
    if measured is None and (ctx["run"] / "measured.json").is_file():
        measured = json.loads((ctx["run"] / "measured.json").read_text())
    try:
        from measure import measured as measured_mod
        m_elements, m_gaps, m_facts = measured_mod.build(
            measured, ctx.get("plan_tags"), elements, base)
        for gap in m_gaps:
            ctx["gaps"].add(gap)
        elements = list(elements) + m_elements
        ctx["measured_facts"] = m_facts
        if m_facts.get("rooms_wet"):
            extra = ctx.setdefault("extra_evidence_counts", {})
            extra["wet_room"] = extra.get("wet_room", 0) + m_facts["rooms_wet"]
    except Exception as exc:                                  # noqa: BLE001
        ctx["gaps"].add(Gap(stage="S9", doc_id=None, subject="measured elements",
                            reason=f"measured plans not turned into elements: {exc}",
                            detail=traceback.format_exc()[-600:]))
    ctx["base"] = base
    ctx["elements"] = elements

    base.write(ctx["run"] / "evidence.json")
    out = {"records": len(base), "elements": len(elements),
           "composition": base.composition(),
           "by_type": {}}
    for element in elements:
        out["by_type"][element.element_type] = \
            out["by_type"].get(element.element_type, 0) + element.count
    out.update(_length_summary(ctx, base, elements))
    (ctx["run"] / "elements.json").write_text(json.dumps(
        {"elements": [{"mark": e.mark, "element_type": e.element_type,
                       "count": e.count, "sheets": list(e.sheets),
                       "roles": sorted(e.dims), "multiplier": e.multiplier,
                       "location": getattr(e, "location", None),
                       "bay": getattr(e, "bay", None)}
                      for e in elements], "summary": out},
        indent=1, sort_keys=True))
    # the words S4 kept for this stage are no longer needed by anyone
    ctx.pop("words_by_doc", None)
    return ["evidence.json", "elements.json"]


def _length_summary(ctx, base, elements) -> dict:
    """The S4 additions to elements.json's summary: how many elements now
    carry a length, by how it came to be known, and the storeys the level
    table names."""
    with_length = derived = measured = 0
    for e in elements:
        eid = e.dims.get("length")
        if not eid:
            continue
        with_length += 1
        origin = base.get(eid).origin.value if eid in base else None
        derived += origin == "derived"
        measured += origin == "measured"
    table = ctx.get("levels")
    storeys = sorted(str(k) for k in (getattr(table, "levels", {}) or {}))
    return {"with_length": with_length, "derived_heights": derived,
            "measured_lengths": measured, "storeys": storeys}


def _attach_s4(ctx, base, elements):
    """The S9 call-site for stage 4's outputs, in the contract's order:
    storey heights (DERIVED, from the level table) for every element that
    states a storey; a model alias for storey names the table does not
    know, labels only, answers outside the table refused; plan lengths
    (MEASURED) for the run types on calibrated plans; and the scale flag on
    every sheet S4 could not verify, so no derived-from-geometry figure on
    one of those can ever fill a dimensional role."""
    gaps = ctx["gaps"]
    table = ctx.get("levels")

    # ── heights ──────────────────────────────────────────────────────────
    try:
        from measure import levels
    except ImportError:
        levels = None
        gaps.add(Gap(stage="S9", doc_id=None, subject="storey heights",
                     reason="S4 module measure.levels not present"))
    if levels is not None and table is None:
        gaps.add(Gap(stage="S9", doc_id=None, subject="storey heights",
                     reason="no level table from stage 4 — storey heights "
                            "not derived"))
    if levels is not None and table is not None:
        elements, first_pass = levels.attach_heights(elements, base, table)
        first_pass = list(first_pass or [])
        keys = sorted(str(k) for k in (getattr(table, "levels", {}) or {}))
        unknown = sorted({e.location for e in elements
                          if getattr(e, "location", None)
                          and levels.normalise_storey(e.location) not in keys})
        aliases: dict = {}
        if unknown and keys and not ctx.get("no_ai"):
            model = _model_client(ctx)
            if model is not None:
                from model.client import ModelUnavailable
                print(f"        {len(unknown)} storey name(s) to the model for "
                      f"a level alias (labels only) ...", flush=True)
                try:
                    response = model.ask(levels.alias_request(unknown, keys))
                    aliases = dict(levels.apply_aliases(
                        response.payload, unknown, keys) or {})
                except ModelUnavailable as exc:
                    gaps.add(Gap(stage="S9", doc_id=None, subject="level alias",
                                 reason=f"model unavailable: {exc}"))
        if aliases:
            elements, again, resolved = _reattach_aliased(
                levels, elements, base, table, aliases)
            first_pass = [g for g in first_pass
                          if not (g.subject in resolved
                                  and "level table" in (g.reason or ""))]
            first_pass.extend(again)
        gaps.extend(first_pass)

    # ── plan lengths ─────────────────────────────────────────────────────
    grids = ctx.get("grids") or {}
    try:
        from measure import plan_lengths
    except ImportError:
        plan_lengths = None
        gaps.add(Gap(stage="S9", doc_id=None, subject="plan lengths",
                     reason="module measure.plan_lengths not present"))
    if plan_lengths is not None:
        if grids:
            kinds = {r["doc_id"]: r["kind"] for r in (ctx.get("routing") or [])
                     if r.get("kind")}
            elements, more = plan_lengths.attach_lengths(
                elements, base, grids, ctx.get("words_by_doc") or {}, kinds)
            gaps.extend(more)
        else:
            gaps.add(Gap(stage="S9", doc_id=None, subject="plan lengths",
                         reason="no grid maps from stage 4 — plan lengths "
                                "not measured"))

    # ── scale flags ──────────────────────────────────────────────────────
    for doc_id, ok in (ctx.get("scale_verified") or {}).items():
        if not ok:
            base.mark_scale_unverified(doc_id)
    return elements


def _reattach_aliased(levels, elements, base, table, aliases):
    """attach_heights again, for the elements whose storey name the model
    aliased to a table key. Returns (elements, gaps, marks re-run). The
    alias reaches attach_heights through its `aliases` parameter where it
    has one; otherwise the element is re-run under the aliased name and
    handed back with its location as written."""
    import dataclasses
    import inspect

    # attach_heights itself skips an element whose height role is filled
    subset = [e for e in elements if getattr(e, "location", None) in aliases]
    if not subset:
        return elements, [], set()
    try:
        takes_aliases = "aliases" in inspect.signature(
            levels.attach_heights).parameters
    except (TypeError, ValueError):
        takes_aliases = False
    if takes_aliases:
        out, gaps = levels.attach_heights(subset, base, table, aliases=aliases)
    else:
        renamed = [dataclasses.replace(e, location=aliases[e.location])
                   for e in subset]
        out, gaps = levels.attach_heights(renamed, base, table)
        out = list(out)
        if len(out) == len(subset):
            out = [dataclasses.replace(o, location=e.location)
                   for o, e in zip(out, subset)]
    out = list(out)
    if len(out) == len(subset):
        by_id = {id(e): o for e, o in zip(subset, out)}
        merged = [by_id.get(id(e), e) for e in elements]
    else:
        keep = {id(e) for e in subset}
        merged = [e for e in elements if id(e) not in keep] + out
    return merged, list(gaps or []), {e.mark for e in subset}


def _stage_inventory(ctx):
    """Stage 10 — reconcile sources and consolidate across sheets.

    A discrepancy between a schedule count and a plan tag count is REPORTED,
    never averaged and never settled in favour of the schedule. The difference is
    a question for the employer and it is worth more as a question than as a
    number.

    Door and window marks are checked plan by plan (measure.inventory.
    reconcile_plan_tags): each floor plan's tags, grouped into units where one
    unit is tagged on each leg, times the floors the plan serves, and only on
    the floors the schedule row names. A mark no plan shows is reported too -
    the schedule says 1, the plans say 0 - because a check that skips what it
    cannot find has checked nothing."""
    import re as _re
    from ingest.discipline_matrix import DisciplineMatrix
    from measure.inventory import legs_m, reconcile, reconcile_plan_tags
    from readers.counts import normalise_mark

    elements = ctx.get("elements") or []
    schedule_counts: dict = {}
    for e in elements:                 # a mark split by storey is one mark to a tag count
        schedule_counts[e.mark] = schedule_counts.get(e.mark, 0) + e.count
    tag_counts = ctx.get("tag_counts") or {}          # stage 7, when it exists
    plans = ctx.get("plan_tags")

    checked: list = []
    discrepancies: list = []
    if plans is not None:
        tagged = [_re.compile(p.regex, _re.I) for p in DisciplineMatrix.load().tag_patterns()
                  if p.family == "doors_windows"]
        widths: dict = {}
        for sc in ctx.get("schedules") or []:
            for r in sc.get("rows") or []:
                w = (r.get("values") or {}).get("width")
                if w and r.get("mark") not in widths:
                    widths[r["mark"]] = legs_m(w)
        marks: dict = {}
        for e in elements:
            if not any(rx.fullmatch(normalise_mark(e.mark)) for rx in tagged):
                continue
            m = marks.setdefault(e.mark, {"mark": e.mark, "count": 0, "location": "",
                                          "legs": widths.get(e.mark) or []})
            m["count"] += e.count
            if e.location and e.location not in m["location"]:
                m["location"] = ", ".join(x for x in (m["location"], e.location) if x)
        checked = reconcile_plan_tags(list(marks.values()), plans)
        for r in checked:
            if not r.agrees:
                ctx["gaps"].add(r.as_gap())
        rest = {m: n for m, n in schedule_counts.items() if m not in marks}
        discrepancies = reconcile(rest, tag_counts)
    else:
        discrepancies = reconcile(schedule_counts, tag_counts)
    for discrepancy in discrepancies:
        ctx["gaps"].add(discrepancy.as_gap())

    out = {"elements": len(elements),
           "marks": sorted(schedule_counts),
           "total_counted": sum(schedule_counts.values()),
           "discrepancies": [
               {"mark": r.mark, "schedule": r.schedule, "plan_tags": r.plan_total,
                "plans": dict(sorted(r.plans.items())),
                "outside": dict(sorted(r.outside.items())),
                "missing_floors": r.missing_floors}
               for r in checked if not r.agrees] + [
               {"mark": d.mark, "schedule": d.count_a, "plan_tags": d.count_b}
               for d in discrepancies],
           "agreed": sorted(r.mark for r in checked if r.agrees),
           "plan_tag_counts_available": bool(tag_counts)}
    if not tag_counts:
        ctx["gaps"].add(Gap(stage="S10", doc_id=None, subject="count check",
                            reason="no plan tag counts to reconcile against",
                            detail="stage 7 not implemented, so a schedule count "
                                   "stands unchecked against the drawings"))
    (ctx["run"] / "inventory.json").write_text(
        json.dumps(out, indent=1, sort_keys=True))
    return ["inventory.json"]


def _stage_classify(ctx):
    """Stage 11 — element to clause. Deterministic where the schedule states
    what it schedules; the residue is what a model call is for.

    The deterministic path is not a shortcut: "SCHEDULE OF DOORS" plus H1.1
    "Doors shall be enumerated" plus a stated count leaves nothing to judge. It
    is also why this stage works with the network down."""
    from measure.classify import classify, classify_stated

    table = ctx.get("clause_table")
    if table is None:
        raise RuntimeError("no clause table — stage 0 did not load it")
    elements = ctx.get("elements") or []
    base = ctx.get("base")

    classifications, unclassified = classify_stated(elements, table, base)
    stated = len(classifications)
    modelled = 0
    reasons: dict = {}

    if unclassified and not ctx.get("no_ai"):
        model = _model_client(ctx)
        if model is None:
            for element in unclassified:
                reasons[element.mark] = "model boundary not importable"
        else:
            print(f"        {len(unclassified)} elements to the model "
                  f"(labels only) ...", flush=True)
            # what each schedule SAYS about itself — its title and heading —
            # travels with the element so the clause follows the words
            sheet_words = {s["doc_id"]: " ".join(
                x for x in (s.get("title"), s.get("heading")) if x)
                for s in (ctx.get("schedules") or [])}
            # ModelSuppliedNumber is NOT caught: a number in a response halts
            # the stage, and the runner records the failure (invariant 1).
            modelled_list, unclassified, reasons = classify(
                unclassified, table, base, model, sheet_words=sheet_words)
            classifications.extend(modelled_list)
            modelled = len(modelled_list)

    for element in unclassified:
        why = reasons.get(element.mark)
        ctx["gaps"].add(Gap(stage="S11", doc_id=element.sheets[0]
                            if element.sheets else None, subject=element.mark,
                            reason=f"no stated clause for element type "
                                   f"{element.element_type!r}",
                            detail=why or ("needs the model"
                                           + (" (skipped: --no-ai)"
                                              if ctx.get("no_ai") else ""))))
    classifications.sort(key=lambda c: (c.clause_id, c.element_mark))
    ctx["classifications"] = classifications
    out = {"classified": len(classifications), "unclassified": len(unclassified),
           "stated": stated, "modelled": modelled,
           "basis": "stated — the schedule names its subject and the clause "
                    "enumerates it; modelled — the model chose the clause and "
                    "bindings from labels, validated by code",
           "unclassified_reasons": {e.key: reasons.get(e.key, "needs the model")
                                    for e in unclassified},
           "rows": [{"mark": c.element_mark, "clause": c.clause_id,
                     "bindings": {b.role: b.evidence_id for b in c.bindings}}
                    for c in classifications]}
    (ctx["run"] / "classifications.json").write_text(
        json.dumps(out, indent=1, sort_keys=True))
    return ["classifications.json"]


def _stage_compute(ctx):
    """Stage 12 — the only stage that produces a quantity.

    No model. The clause said which formula, threshold, deduction and grouping;
    nothing here is chosen. Products are NOT rounded — GP3.1 rounds each
    dimension at intake and never the product."""
    from measure.compute import compute_one

    table = ctx["clause_table"]
    base = ctx["base"]
    by_mark = {e.key: e for e in (ctx.get("elements") or [])}   # key: mark @ storey @ bay
    quantities = []

    for classification in ctx.get("classifications") or []:
        element = by_mark.get(classification.element_mark)
        if element is None:
            continue
        clause = table.get(classification.clause_id)
        quantity, gap = compute_one(classification, clause, base, element,
                                    ctx["config"])
        if gap is not None:
            ctx["gaps"].add(gap)
        if quantity is not None:
            quantities.append(quantity)

    ctx["quantities"] = quantities
    totals: dict = {}
    for quantity in quantities:
        key = f"{quantity.section}/{quantity.clause_id}/{quantity.unit}"
        totals[key] = totals.get(key, Decimal(0)) + quantity.value
    out = {"quantities": len(quantities),
           "totals": {k: str(v) for k, v in sorted(totals.items())},
           "rows": [{"mark": q.element_mark, "clause": q.clause_id,
                     "value": str(q.value), "unit": q.unit,
                     "section": q.section, "origin": q.origin.value,
                     "evidence": list(q.evidence_ids)}
                    for q in quantities]}
    (ctx["run"] / "quantities.json").write_text(
        json.dumps(out, indent=1, sort_keys=True))
    return ["quantities.json"]


def _stage_ingest(ctx):
    """Stage 0: load every table the pipeline looks up, and prove it loaded.

    Nine tables now, not one. Loading them here rather than lazily at the point
    of use means a malformed table is a stage-0 gap with a name, on a run that
    has done nothing else yet — not a traceback forty minutes into a 500-sheet
    package. Each loader also validates: the discipline matrix refuses a table
    that still routes to a section that does not exist, and the rate class table
    refuses an ordinal invariant whose two sides are measured in different units.
    """
    from ingest import crosswalk, formulas
    out = {"sections": len(crosswalk.SECTIONS),
           "formula_shapes": len(formulas.SHAPES)}

    # Loaded THROUGH ClauseTable, not read around it. Reading the JSON directly
    # is how a loader that raised KeyError on its first row went unnoticed while
    # stage 0 cheerfully reported "314 clauses" every run.
    clauses = HERE / "data" / "clauses.json"
    if not clauses.is_file():
        ctx["gaps"].add(Gap(stage="S0", doc_id=None, subject="clause table",
                            reason="data/clauses.json not present"))
    else:
        try:
            from ingest.clause_table import ClauseTable
            table = ClauseTable.load(clauses)
            computable = table.computable()
            out["clauses"] = len(table)
            out["clauses_computable"] = len(computable)
            out["clauses_contaminated"] = len([c for c in table if c.contaminated])
            out["clauses_unexpressible"] = len(
                [c for c in table if c.shape_basis == "unexpressible"])
            ctx["clause_table"] = table
        except Exception as exc:                              # noqa: BLE001
            out["clauses"] = None
            ctx["gaps"].add(Gap(stage="S0", doc_id=None, subject="clause table",
                                reason=f"clause table did not load: {exc}"))

    def _load(subject, fn):
        try:
            out[subject] = fn()
        except Exception as exc:                              # noqa: BLE001
            out[subject] = None
            ctx["gaps"].add(Gap(stage="S0", doc_id=None, subject=subject,
                                reason=f"table did not load: {exc}"))

    def _disciplines():
        from ingest.discipline_matrix import DisciplineMatrix
        m = DisciplineMatrix.load()
        return {"prefixes": len(m.prefixes()),
                "tag_patterns": len(m.tag_patterns()),
                "collisions": len(m.collisions()),
                "corrections_applied": len(m.corrections())}

    def _titleblocks():
        from ingest.titleblocks import PatternSet
        specs = list(PatternSet.load(HERE / "data" / "titleblocks.json"))
        return {"specs": len(specs),
                "patterns": sum(len(s.patterns) for s in specs)}

    def _multipliers():
        from ingest.multipliers import Multipliers
        return {"patterns": len(Multipliers.load().kinds())}

    def _units():
        from ingest.units import Units
        u = Units.load()
        return {"item_types": len(u.item_types()),
                "rejections": len(u.rejections())}

    def _gates():
        from ingest.gates import Gates
        g = Gates.load()
        return {"completeness_rows": len(g.completeness_rows()),
                "mass_balance": len(g.mass_balance()),
                "fabrication_tokens": len(g.fabrication_tokens())}

    def _house_template():
        from ingest.house_template import HouseTemplate
        t = HouseTemplate.load()
        return {"columns": len(t.columns()), "money_column_width": t.width("H")}

    def _rate_classes():
        from ingest.rates import RateClassTable
        t = RateClassTable.load(HERE / "data" / "rate_classes.json")
        problems = t.check()
        if problems:
            raise ValueError("; ".join(problems))
        return {"classes": len(t.ids()),
                "ordinal_invariants": len(t.ordinals()),
                "min_sources": t.min_sources,
                "prices_held": 0}

    def _conventions():
        from ingest.conventions import Conventions
        c = Conventions.load(HERE / "data" / "conventions.json")
        return {"trades": len(c.trades())}

    _load("disciplines", _disciplines)
    _load("titleblocks", _titleblocks)
    _load("multipliers", _multipliers)
    _load("units", _units)
    _load("gates", _gates)
    _load("house_template", _house_template)
    _load("rate_classes", _rate_classes)
    _load("conventions", _conventions)

    (ctx["run"] / "ingest.json").write_text(json.dumps(out, indent=1,
                                                       sort_keys=True))
    return ["ingest.json"]


# ── preflight ──────────────────────────────────────────────────────────────
def preflight(no_ai: bool) -> int:
    print(f"\n{AGENT} — preflight\n" + "-" * 58)
    ok = True
    print(f"  python            {sys.version.split()[0]}")
    for names, label, why in ((("pymupdf", "fitz"), "pymupdf", "reads the drawings"),
                              (("openpyxl",), "openpyxl", "builds the workbook")):
        found = False
        for n in names:
            try:
                __import__(n); found = True; break
            except ImportError:
                continue
        print(f"  {label:<17} {'present' if found else 'MISSING — ' + why}")
        ok = ok and found

    if no_ai:
        print("  model             skipped (--no-ai)")
    else:
        if os.environ.get("ANTHROPIC_API_KEY"):
            print("  WARNING: ANTHROPIC_API_KEY is set — unset it to run on "
                  "your subscription instead of the paid API.")
        try:
            from core.ai import DEFAULT_MODEL, check_auth, check_env
            print(f"  model             {DEFAULT_MODEL}")
            print(f"  oauth token       "
                  f"{'set' if os.environ.get('CLAUDE_CODE_OAUTH_TOKEN') else 'not set — the CLI login is used'}")
            check_env()
            # A live call, not a guess. An expired login is this agent's most
            # expensive failure: it costs a whole run and used to surface as
            # "sheet left unmeasured" or "class left unpriced" instead of as
            # itself. Two seconds here buys that back.
            signed_in, detail = check_auth()
            print(f"  signed in         "
                  f"{'yes — ' + detail if signed_in else 'NO: ' + detail}")
            ok = ok and signed_in
        except ImportError as exc:
            print(f"  core.ai           MISSING — {exc}"); ok = False

    plan = stage_plan()
    wired = [s for s in plan if plan[s][0]]
    print(f"\n  stages wired      {len(wired)} of {len(plan)}  ({', '.join(wired)})")
    print(f"  stages deferred   {', '.join(sorted(DEFERRED)) or 'none'}")
    print(f"  rounding          GP3.1 — dimensions at intake, products never")
    print("-" * 58)
    return EXIT_OK if ok else EXIT_BAD_INPUT


# ── the run ────────────────────────────────────────────────────────────────
def run(project: Path, no_ai: bool, limit: int | None,
        into_project: bool = True, region: str | None = None,
        readings: list | None = None) -> int:
    digest, pairs = hash_directory(project)
    # the working record — every stage's JSON, the register, provenance,
    # state, gaps and the log — lives in the agent's own runs/. The project
    # receives the DELIVERABLE only: one zip holding the BOQ workbook, the
    # take-off workbook and the markup drawings, named by project and
    # revision. Nothing already in the project is read for writing or altered.
    run_dir = RUNS / digest[:12]
    run_dir.mkdir(parents=True, exist_ok=True)
    if into_project:
        deliver_dir = project / "Reports" / "BOQ_POMI_V1"
        try:
            deliver_dir.mkdir(parents=True, exist_ok=True)
        except OSError as exc:
            print(f"  cannot write to {deliver_dir} ({exc}) — the zip goes to "
                  f"the agent folder", file=sys.stderr)
            deliver_dir = run_dir
    else:
        deliver_dir = run_dir
    logs.configure(run_dir, verbose=False)

    state = RunState(run_dir)
    state.begin(digest)
    gaps = GapList()
    ctx = {"project": project, "run": run_dir, "gaps": gaps, "no_ai": no_ai,
           "limit": limit, "config": DEFAULT, "region": region,
           "deliver": deliver_dir, "reading_dirs": list(readings or [])}

    print(f"\n{AGENT}\n" + "-" * 58)
    print(f"  project     {project}")
    print(f"  drawings    {len(pairs)} PDF")
    print(f"  run id      {digest[:12]}")
    print(f"  working     {run_dir}")
    print(f"  deliver to  {deliver_dir}")
    print("-" * 58)

    plan = stage_plan()
    ran = notimpl = 0
    for stage in ORDER:
        if stage in DEFERRED:
            print(f"  {stage:<4} {NAMES[stage]:<14} deferred — skipped, not failed")
            continue
        fn, needs = plan.get(stage, (None, "not in the stage table"))
        if fn is None:
            notimpl += 1
            state.data["stages"][stage] = {
                "entered_utc": None, "exited_utc": None, "exit": 2,
                "artefacts": [], "not_implemented": needs}
            state.save()
            gaps.add(Gap(stage=stage, doc_id=None, subject=NAMES[stage],
                         reason=f"stage not implemented — {needs}"))
            print(f"  {stage:<4} {NAMES[stage]:<14} NOT IMPLEMENTED — {needs}")
            continue
        try:
            state.enter(stage)
        except RuntimeError as exc:
            print(f"  {stage:<4} {NAMES[stage]:<14} BLOCKED — {exc}")
            break
        try:
            artefacts = fn(ctx) or []
            state.exit(stage, 0, artefacts)
            ran += 1
            print(f"  {stage:<4} {NAMES[stage]:<14} ok  "
                  f"{', '.join(artefacts) if artefacts else '(no artefacts)'}")
        except Exception as exc:                            # noqa: BLE001
            state.exit(stage, 1, [])
            gaps.add(Gap(stage=stage, doc_id=None, subject=NAMES[stage],
                         reason=str(exc), detail=traceback.format_exc()[-400:]))
            print(f"  {stage:<4} {NAMES[stage]:<14} FAILED — {exc}")

    delivered, why = _deliver(ctx, digest[:12])
    if delivered is None:
        why = f"{why}. {_why_nothing_measured(ctx)}".strip()
        gaps.add(Gap(stage="S21", doc_id=None, subject="deliverable",
                     reason=f"no zip issued — {why}"))
    # after the reason is complete and its gap recorded, so both reach the folder
    try:
        shown = _to_output(ctx, delivered, why)
    except OSError as exc:                                   # never fails a run
        shown = None
        print(f"  the output folder could not be written ({exc})", file=sys.stderr)

    gaps.write(run_dir / "gaps.json")
    summary = {
        "agent": AGENT, "run_id": digest[:12], "input_set_hash": digest,
        "utc": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "project": str(project), "drawings": len(pairs),
        "stages_total": len(ORDER), "stages_ran": ran,
        "stages_not_implemented": notimpl, "gaps": len(gaps),
        "resume_from": state.resume_from(),
        "deliverable": str(delivered) if delivered else None,
        "revision": ctx.get("revision"),
    }
    (run_dir / "summary.json").write_text(json.dumps(summary, indent=1, sort_keys=True))

    print("-" * 58)
    print(f"  ran {ran} · not implemented {notimpl} · gaps {len(gaps)}")
    print(f"  resume from {state.resume_from()}")
    if shown:
        print(f"\n  Open this folder: {shown}")
    if delivered:
        print(f"  Deliverable: {delivered}")
        if ctx.get("partial"):
            print("  PARTIAL BILL - the completeness gate failed. 'COVERAGE - READ FIRST.txt'"
                  " names every required section it lacks and why.")
    else:
        print(f"\n  No deliverable issued — {why}")
        print("  The register (register.xlsx) and every stage's record are in the working folder.")
    print(f"  Working files (gaps.json, state, every stage's record): {run_dir}")
    print("  Nothing already in the project was altered.\n")
    return EXIT_OK


# ── the deliverable ────────────────────────────────────────────────────────
def _why_nothing_measured(ctx) -> str:
    """One sentence a surveyor can act on, when the run ends without a bill:
    what the package gave, and what it did not. Read from the stage records
    already in ctx, never re-derived."""
    elements = ctx.get("elements") or []
    quantities = ctx.get("quantities") or []
    classifications = ctx.get("classifications") or []
    if not elements:
        n_sched = sum(1 for s in (ctx.get("schedules") or []) if s.get("rows"))
        return (f"No element was built: {n_sched} schedule(s) read, none said what "
                f"it schedules or every row was refused — see gaps.json (S6, S9).")
    if not classifications:
        reasons: dict = {}
        for g in ctx["gaps"]:
            if g.stage == "S11" and g.detail:
                key = g.detail.split(";")[0]
                reasons[key] = reasons.get(key, 0) + 1
        top = sorted(reasons.items(), key=lambda kv: -kv[1])[:2]
        why = "; ".join(f"{n} x {r}" for r, n in top) or "see gaps.json (S11)"
        return (f"{len(elements)} elements built, none measurable from the "
                f"schedules alone: {why}. The missing roles are what the drawings "
                f"must supply (a level table, plan dimensions) before this build "
                f"can measure them.")
    if not quantities:
        return f"{len(classifications)} elements classified, no quantity computed — see gaps.json (S12)."
    if ctx.get("completeness_blocked"):
        unread = [u.get("drawing_no") or u.get("doc_id") for u in ctx.get("unread_schedules") or []]
        if unread:
            return (f"the completeness gate FAILED — {', '.join(unread)} not read, so section H "
                    f"is incomplete. Run again with the model, answer the request in readings/, "
                    f"or justify it in AN_RECONCILIATION.json (\"unread_schedule|<drawing no>\").")
        return "the completeness gate FAILED — justify the absence in AN_RECONCILIATION.json."
    return ""


def project_label(project: Path, name: str | None = None) -> str:
    """The project's name, made safe for a file name: `name` where stage 1
    read one from the title blocks ("5310319 PROPOSED RESIDENTIAL BUILDING
    (B+G+5+ROOF)"), else the folder's name. No date — the revision carries
    the sequence."""
    import re as _re
    name = (name or Path(project).name).strip()
    name = _re.sub(r'[\\/:*?"<>|]+', " ", name)
    return " ".join(name.split()) or "Project"


def issue_revision(run_dir: Path, project: Path) -> int:
    """Rev 00 for the first issue of a project; each EARLIER run of the same
    project that assembled a bill adds one. A re-run over unchanged drawings
    has the same run id and therefore the same revision."""
    seen = set()
    for d in sorted(RUNS.iterdir()) if RUNS.is_dir() else []:
        if not d.is_dir() or d.resolve() == run_dir.resolve():
            continue
        try:
            summary = json.loads((d / "summary.json").read_text())
        except (OSError, ValueError):
            continue
        if str(summary.get("project")) != str(project):
            continue
        if (d / "bill.json").is_file() and summary.get("deliverable"):
            seen.add(d.name)
    return len(seen)


def _deliver(ctx, run_id: str):
    """One zip into the deliver folder: the BOQ workbook, the take-off
    workbook and the markup drawings, named by project and revision. The zip
    is written only when both workbooks exist — a withheld bill means no
    issue, and the reason is already in gaps.json. An earlier zip of the same
    project and revision is replaced (it was this agent's, for this issue)."""
    import shutil
    import zipfile

    run: Path = ctx["run"]
    deliver: Path = ctx.get("deliver") or run
    takeoff = run / "takeoff.xlsx"
    bill = run / "bill.xlsx"
    unpriced = run / "bill_unpriced.xlsx"
    # only what THIS run's render stage wrote is issued — never a file left
    # in the run folder by an earlier run over the same drawings
    try:
        rendered = json.loads((run / "render.json").read_text())
    except (OSError, ValueError):
        rendered = {}
    written = set(rendered.get("written", []))
    # a bill over a failed completeness gate is issued PARTIAL, and says so in
    # every file name and in the coverage note beside it (CR-01 §7)
    partial = bool(rendered.get("partial"))
    ctx["partial"] = partial
    label = project_label(ctx["project"], (ctx.get("heading") or {}).get("label"))
    rev = issue_revision(run, ctx["project"])
    ctx["revision"] = f"Rev {rev:02d}"
    boq = "BOQ (PARTIAL)" if partial else "BOQ"
    stem = f"{label} - {boq} - {ctx['revision']}"

    # the zip an earlier run over these same drawings issued (same run id,
    # same revision) - named as now, or as the last run named it (the name
    # moved from the folder to the title blocks) - is not left looking current:
    # a blocked re-run once left an earlier 11-window bill in Reports/ as the issue
    try:
        last = json.loads((run / "summary.json").read_text()).get("deliverable")
    except (OSError, ValueError):
        last = None
    # either form of this issue - complete or partial - is the earlier one
    earlier = {deliver / f"{label} - {b} - {ctx['revision']}.zip"
               for b in ("BOQ", "BOQ (PARTIAL)")} | ({Path(last)} if last else set())

    def withdraw(keep=None) -> list[str]:
        done = []
        for old in sorted(earlier):
            if old == keep or old.parent != deliver or not old.exists():
                continue
            gone = old.with_name(f"{old.stem} - WITHDRAWN.zip")
            if gone.exists():
                gone.unlink()
            old.rename(gone)
            done.append(f"the earlier {old.name} is renamed {gone.name}")
        return done

    def withheld(why):
        return None, "; ".join([why, *withdraw()])

    if not takeoff.is_file() or "takeoff.xlsx" not in written:
        return withheld("takeoff.xlsx was not produced by this run")
    if not bill.is_file() or "bill.xlsx" not in written:
        return withheld("bill.xlsx was withheld or not produced by this run")
    if not unpriced.is_file() or "bill_unpriced.xlsx" not in written:
        return withheld("bill_unpriced.xlsx was not produced by this run")
    tag = " (PARTIAL)" if partial else ""
    names = {"bill": f"{label} - BOQ Priced{tag} - {ctx['revision']}.xlsx",
             "unpriced": f"{label} - BOQ Unpriced{tag} - {ctx['revision']}.xlsx",
             "takeoff": f"{label} - Take-off - {ctx['revision']}.xlsx"}

    staging = run / "deliverable"
    if staging.exists():
        shutil.rmtree(staging)
    staging.mkdir()
    shutil.copy2(bill, staging / names["bill"])
    shutil.copy2(unpriced, staging / names["unpriced"])
    shutil.copy2(takeoff, staging / names["takeoff"])
    if partial and (run / "coverage.txt").is_file():
        shutil.copy2(run / "coverage.txt", staging / "COVERAGE - READ FIRST.txt")
    markup_dir = run / "markup"
    if markup_dir.is_dir():
        shutil.copytree(markup_dir, staging / "markup")

    target = deliver / f"{stem}.zip"
    for note in withdraw(keep=target):
        print(f"  {note}")
    if target.exists():
        target.unlink()
    with zipfile.ZipFile(target, "w", zipfile.ZIP_DEFLATED) as zf:
        for path in sorted(staging.rglob("*")):
            if path.is_file():
                info = zipfile.ZipInfo(path.relative_to(staging).as_posix(),
                                       date_time=(1980, 1, 1, 0, 0, 0))
                info.compress_type = zipfile.ZIP_DEFLATED
                zf.writestr(info, path.read_bytes())
    return target, None


def _to_output(ctx, delivered, why) -> Path | None:
    """The run's results in one obvious place beside the agent: output/<project
    - Rev NN>/. The zip in the project's Reports/ folder is the formal issue;
    this is the same work, unzipped, for a person to open - the bills, the
    take-off, provenance, the register and the markups. A run that issued no
    bill still fills it, with the register, whatever was produced, and a note
    saying why there is no bill: an empty folder explains nothing."""
    import shutil

    run: Path = ctx["run"]
    label = project_label(ctx["project"], (ctx.get("heading") or {}).get("label"))
    rev = ctx.get("revision") or "Rev 00"
    folder = OUTPUT / f"{label} - {rev}"
    if folder.exists():
        shutil.rmtree(folder)
    folder.mkdir(parents=True)

    staging = run / "deliverable"
    if delivered and staging.is_dir():
        for item in sorted(staging.iterdir()):
            if item.is_dir():
                shutil.copytree(item, folder / item.name)
            else:
                shutil.copy2(item, folder / item.name)
        shutil.copy2(delivered, folder / Path(delivered).name)
    else:
        for name, shown_as in (("takeoff.xlsx", "Take-off (not issued).xlsx"),
                               ("bill_unpriced.xlsx", "BOQ Unpriced (not issued).xlsx")):
            if (run / name).is_file():
                shutil.copy2(run / name, folder / f"{label} - {shown_as}")
        (folder / "WHY THERE IS NO BILL.txt").write_text(
            "This run did not issue a Bill of Quantities.\n\n"
            f"Reason: {(why or 'not recorded').replace('see gaps.json', 'see Questions and gaps.txt')}\n\n"
            "Every question the drawings left open is listed in 'Questions and gaps.txt'\n"
            "in this folder. Answer or fix those, then run the agent again.\n"
            + ("\n\n" + (run / "coverage.txt").read_text(encoding="utf-8")
               if (run / "coverage.txt").is_file() else ""),
            encoding="utf-8")
    for name, shown_as in (("provenance.xlsx", "Provenance - where every figure came from.xlsx"),
                           ("register.xlsx", "Drawing register.xlsx")):
        if (run / name).is_file():
            shutil.copy2(run / name, folder / f"{label} - {shown_as}")

    # the gaps, readable: one line each, grouped by stage
    # (read from the run itself: gaps.json is written after this step)
    gaps = ctx["gaps"].sorted() if ctx.get("gaps") is not None else []
    lines = [f"{label} - {rev}: {len(gaps)} question(s) and gap(s) the run recorded.", ""]
    for g in gaps:
        where = Path(str(g.doc_id or "")).name
        lines.append(f"[{g.stage}] {where + ': ' if where else ''}{g.reason}")
    (folder / "Questions and gaps.txt").write_text("\n".join(lines) + "\n", encoding="utf-8")
    (OUTPUT / "LATEST RUN.txt").write_text(
        f"The latest run's results are in:\n  {folder.name}\n\n"
        "Bill issued: " + ("PARTIAL - read COVERAGE - READ FIRST.txt in that folder"
                           if delivered and ctx.get("partial") else "yes" if delivered
                           else "no - see WHY THERE IS NO BILL.txt in that folder") + "\n",
        encoding="utf-8")
    return folder


def rate_check(rate_class: str, region: str | None) -> int:
    """One real market search, on one class, printed in full.

    The pricing path is the newest and least proven part of the agent, and it is
    the only part that leaves the machine. This command exercises it end to end —
    the search channel, the observation record, corroboration, spread, staleness
    and the ordinal invariants touching that class — on ONE class, so a failure
    is legible instead of buried in a 500-sheet run.

    It prints what each page said, not just the answer, because the answer is
    only as good as the pages behind it."""
    from datetime import date
    from ingest.rates import RateClassTable
    from bill.market import (build_query, parse_observations, publish)

    table = RateClassTable.load(HERE / "data" / "rate_classes.json")
    try:
        rc = table.get(rate_class)
    except KeyError as exc:
        print(exc, file=sys.stderr)
        print(f"\n  classes in section B: "
              f"{', '.join(c.rate_class for c in table.by_section('B'))}",
              file=sys.stderr)
        return EXIT_BAD_INPUT

    today = date.today()
    print(f"\n{AGENT} — market rate check\n" + "-" * 58)
    print(f"  class       {rc.rate_class}")
    print(f"  label       {rc.label}")
    print(f"  unit        {rc.unit}")
    print(f"  region      {region or '(not stated)'}")
    print(f"  as at       {today.isoformat()}")
    print("-" * 58)

    try:
        from core.ai import research
    except ImportError as exc:
        print(f"  the search channel is unavailable: {exc}", file=sys.stderr)
        return 2

    raw = research(build_query(rc, region, today),
                   label=f"rate search {rc.rate_class}")
    if raw is None:
        print("  the search channel returned nothing — the class is a GAP.\n"
              "  A gap is never an assumption, so nothing is priced.")
        return 2

    kept, rejected = parse_observations(raw, rc.unit)
    print(f"\n  {len(raw)} observation(s) reported, {len(kept)} usable\n")
    for obs in kept:
        print(f"    {obs.quoted_value:>12} {obs.quoted_currency}/{obs.quoted_unit}"
              f"  {obs.publisher[:30]:<30} priced {obs.price_date[:10]} "
              f"({obs.age_months(today)} months old)")
        print(f"                 {obs.url[:96]}")
        if obs.snippet:
            print(f"                 \"{str(obs.snippet)[:88]}\"")
    for row, why in rejected:
        print(f"    REJECTED {why}  [{str(row.get('url'))[:56]}]")

    rate = publish(rc.rate_class, rc.unit, kept, table, today,
                   rejected=rejected)
    print("-" * 58)
    if rate is None:
        print("  GAP — no usable observation survived the guards. Nothing is "
              "priced, and nothing is guessed.")
        return 2
    print(f"  RATE        {rate.value} {rate.currency} per {rate.unit}")
    print(f"  basis       {rate.citation()}")
    for flag in rate.flags:
        print(f"  FLAG        {flag}")
    bounded = table.ordinals_touching(rc.rate_class)
    print(f"  bounded by  {len(bounded)} ordinal invariant(s), tested once the "
          f"other side of each pair is priced")
    print("-" * 58)
    return 1 if rate.flags else 0


def main() -> int:
    ap = argparse.ArgumentParser(description=f"{AGENT} — POMI bill of quantities")
    ap.add_argument("root", nargs="?", default=None, help="project folder")
    ap.add_argument("--no-ai", action="store_true",
                    help="deterministic path only; judgements become gaps")
    ap.add_argument("--preflight", action="store_true")
    ap.add_argument("--readings", action="append", default=[], metavar="DIR",
                    help="another folder of saved sheet readings (graphic "
                         "schedules and title blocks), e.g. boq_arch/readings; "
                         "the agent's own readings/ is always searched")
    ap.add_argument("--limit", type=int, help="first N sheets, stable order")
    ap.add_argument("--into-project", action="store_true",
                    help="(default) write results into <project>/Reports/"
                         "BOQ_POMI_V1/<run id>/ beside the drawings")
    ap.add_argument("--out-here", action="store_true",
                    help="write results into this agent folder's runs/ instead "
                         "of the project")
    ap.add_argument("--rate-check", metavar="CLASS",
                    help="run ONE real market search on one rate class and "
                         "print every source behind the answer. Proves the "
                         "pricing path end to end without a drawing.")
    ap.add_argument("--region", help="the project's emirate or city, used in the "
                                    "search query and in the regional "
                                    "adjustment disclosure")
    args, _unknown = ap.parse_known_args()

    if args.preflight:
        return preflight(args.no_ai)
    if args.rate_check:
        return rate_check(args.rate_check, args.region)
    if not args.root:
        print("ERROR: give a project folder, or --preflight", file=sys.stderr)
        return EXIT_BAD_INPUT
    project = Path(args.root).expanduser().resolve()
    if not project.is_dir():
        print(f"ERROR: not a directory: {project}", file=sys.stderr)
        return EXIT_BAD_INPUT
    from spine.files import project_pdfs
    if not project_pdfs(project):
        print(f"ERROR: no PDF files under {project}", file=sys.stderr)
        return EXIT_BAD_INPUT
    return run(project, args.no_ai, args.limit, not args.out_here, args.region,
               args.readings)


if __name__ == "__main__":
    raise SystemExit(main())
