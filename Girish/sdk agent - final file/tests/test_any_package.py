#!/usr/bin/env python3
"""The agent on a package from an office it has never seen (unseen_package.py):
a combined set, title blocks of another shape, schedule headers no development
package used, an engineer's load summary, and files that cannot be read at all.
The whole run, deterministic path only (--no-ai), into temporary folders - the
agent's own runs/ and output/ are not touched.

What it must do on ANY package: finish, fill the output folder, read every
sheet it can and say in plain words why it could not read the rest, and bill
what the schedules state - no more and no less.
"""
from __future__ import annotations

import contextlib
import io
import json
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
for p in (ROOT, ROOT / "tests"):
    if str(p) not in sys.path:
        sys.path.insert(0, str(p))

import unseen_package                                              # noqa: E402

_RESULT: dict = {}


def _run() -> dict:
    """One run shared by every test here (it takes a few seconds)."""
    if _RESULT:
        return _RESULT
    import agent
    import readers.transcribe as transcribe
    import spine.files as files
    tmp = Path(tempfile.mkdtemp(prefix="boq-unseen-"))
    project = tmp / "Riverside Clinic"
    expect = unseen_package.build(project)
    saved = agent.RUNS, agent.OUTPUT, files.PAGES_CACHE, transcribe.READINGS
    (agent.RUNS, agent.OUTPUT, files.PAGES_CACHE,
     transcribe.READINGS) = tmp / "runs", tmp / "output", tmp / "pages", tmp / "readings"
    try:
        with contextlib.redirect_stdout(io.StringIO()) as out, \
                contextlib.redirect_stderr(io.StringIO()):
            code = agent.run(project, True, None, False, None, [])
    finally:
        agent.RUNS, agent.OUTPUT, files.PAGES_CACHE, transcribe.READINGS = saved
    run = next((tmp / "runs").iterdir())
    gaps = json.loads((run / "gaps.json").read_text(encoding="utf-8"))
    _RESULT.update(code=code, log=out.getvalue(), run=run, tmp=tmp, expect=expect,
                   register=json.loads((run / "register.json").read_text(encoding="utf-8"))["sheets"],
                   routing=json.loads((run / "routing.json").read_text(encoding="utf-8"))["sheets"],
                   takeoff=json.loads((run / "takeoff.json").read_text(encoding="utf-8")),
                   gaps=gaps if isinstance(gaps, list) else gaps.get("gaps", []))
    return _RESULT


def _by_number():
    return {s.get("drawing_no"): s for s in _run()["register"]}


def test_the_run_finishes_and_fills_the_output_folder():
    r = _run()
    assert r["code"] == 0, r["log"][-2000:]
    shown = [d for d in (r["tmp"] / "output").iterdir() if d.is_dir()]
    assert [d.name for d in shown] == ["RIVERSIDE CLINIC EXTENSION - Rev 00"]
    names = {f.name for f in shown[0].iterdir()}
    assert "Questions and gaps.txt" in names
    assert any("BOQ" in n and n.endswith(".xlsx") for n in names), names


def test_a_combined_set_is_read_as_its_sheets():
    pages = [s for s in _run()["register"] if "[page " in s["doc_id"]]
    assert len(pages) == _run()["expect"]["set_pages"]
    assert {s["drawing_no"] for s in pages} == {"A000", "A101", "A501"}


def test_title_blocks_of_an_unseen_shape_are_read():
    sheets = _by_number()
    assert _run()["expect"]["numbers"] <= set(sheets)
    assert sheets["A101"]["title"] == "GROUND FLOOR PLAN"               # not "... SHEET NO. A101 REV"
    assert sheets["2301-A-502"]["title"] == "WINDOW SCHEDULE"          # value beneath its label
    assert sheets["A000"]["title"] == "COVER SHEET"                    # a sheet with little drawn


def test_an_upper_case_pdf_in_a_non_english_folder_is_found():
    assert "Türen" in _by_number()["2301-A-502"]["doc_id"]


def test_an_engineers_load_summary_is_not_billed():
    kinds = {r["drawing_no"]: r["kind"] for r in _run()["routing"]}
    assert kinds["2301-E-601"] == "general"
    assert kinds["A501"] == kinds["2301-A-502"] == "schedule"
    sections = {s["letter"] for s in _run()["takeoff"]["sections"]}
    assert sections == {"H"}, sections


def test_the_bill_counts_exactly_what_the_schedules_state():
    expect = _run()["expect"]
    items = [i for s in _run()["takeoff"]["sections"] for i in s["items"]]
    marks = {i["element_mark"]: float(i["quantity"]) for i in items}
    assert set(marks) == set(expect["door_marks"]) | set(expect["window_marks"])
    doors = sum(q for m, q in marks.items() if m in expect["door_marks"])
    windows = sum(q for m, q in marks.items() if m in expect["window_marks"])
    assert (doors, windows) == (expect["doors"], expect["windows"])


def test_sizes_printed_as_one_cell_reach_the_bill():
    lines = [ln for s in _run()["takeoff"]["sections"] for i in s["items"]
             for ln in i["lines"] if i["element_mark"] == "D01"]
    assert lines and all(ln.get("W") or ln.get("H") or "900" in json.dumps(ln) for ln in lines)
    descr = json.loads((_run()["run"] / "descriptions.json").read_text(encoding="utf-8"))
    assert "900" in json.dumps(descr) and "2100" in json.dumps(descr)


def test_unreadable_files_are_explained_not_fatal():
    reasons = " ".join(g["reason"] for g in _run()["gaps"] if g["stage"] == "S1")
    assert "password-protected" in reasons
    assert "damaged or is not a PDF" in reasons
    assert "Image only" in reasons
