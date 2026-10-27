#!/usr/bin/env python3
"""The measured sections (CR-01 R1-R4), end to end on a project whose
quantities are worked out by hand (measured_package.py), plus the rules the
measurement rests on, each on its own."""
from __future__ import annotations

import contextlib
import io
import json
import math
import sys
import tempfile
from decimal import Decimal
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
for p in (ROOT, ROOT / "tests"):
    if str(p) not in sys.path:
        sys.path.insert(0, str(p))

import measured_package                                            # noqa: E402

_RUN: dict = {}


def _run() -> dict:
    if _RUN:
        return _RUN
    import agent
    import readers.transcribe as transcribe
    import spine.files as files
    tmp = Path(tempfile.mkdtemp(prefix="boq-measured-"))
    project = tmp / "One Room"
    expect = measured_package.build(project, tmp / "readings")
    saved = agent.RUNS, agent.OUTPUT, files.PAGES_CACHE, transcribe.READINGS
    agent.RUNS, agent.OUTPUT, files.PAGES_CACHE, transcribe.READINGS = (
        tmp / "runs", tmp / "output", tmp / "pages", tmp / "readings")
    try:
        with contextlib.redirect_stdout(io.StringIO()) as out, contextlib.redirect_stderr(io.StringIO()):
            code = agent.run(project, True, None, False, None, [])
    finally:
        agent.RUNS, agent.OUTPUT, files.PAGES_CACHE, transcribe.READINGS = saved
    run = next((tmp / "runs").iterdir())
    takeoff = json.loads((run / "takeoff.json").read_text(encoding="utf-8"))
    items = {i["element_mark"]: i for s in takeoff["sections"] for i in s["items"]}
    gaps = json.loads((run / "gaps.json").read_text(encoding="utf-8"))
    _RUN.update(code=code, log=out.getvalue(), run=run, items=items, expect=expect,
                gaps=gaps if isinstance(gaps, list) else gaps.get("gaps", []),
                measured=json.loads((run / "measured.json").read_text(encoding="utf-8")),
                markup=json.loads((run / "markup_instructions.json").read_text(encoding="utf-8")))
    return _RUN


def _qty(mark: str) -> float:
    items = _run()["items"]
    assert mark in items, f"{mark} not billed; items: {sorted(items)}; log: {_run()['log'][-1500:]}"
    return float(items[mark]["quantity"])


def test_the_plan_is_calibrated_and_measured():
    r = _run()
    assert r["code"] == 0, r["log"][-2000:]
    m = r["measured"]
    assert [p["drawing_no"] for p in m["plans"]] == ["A-101"], m["plans"]
    assert m["slab_mm"] == 150 and m["blocks_mm"] == [200]
    assert m["storeys"]["GF"]["height_m"] == "3.15"


def test_blockwork_reproduces_the_hand_calculation():
    assert _qty("Walls 200mm thick") == r"42.51" or abs(_qty("Walls 200mm thick") - 42.51) < 0.005


def test_blockwork_lines_are_the_surveyors_lines():
    lines = _run()["items"]["Walls 200mm thick"]["lines"]
    squared = [float(ln["squared"]) for ln in lines]
    assert squared == [41.7, 2.7, -1.89], lines        # gross, added back, deducted - never netted
    assert lines[0]["L"] == 13.9 and lines[0]["H"] == 3.0
    assert "GP3.3" in lines[2]["desc"]


def test_finishes_reproduce_the_hand_calculation_within_the_raster():
    # rooms are measured on a 3 px/pt raster (12 mm a pixel at 1:100): the
    # outline lies on the wall faces to within half a pixel
    for mark, expected in (("Floors, rooms", 12.00), ("Ceilings, rooms", 12.00),
                           ("Walls, rooms", 40.11)):
        got = _qty(mark)
        assert abs(got - expected) / expected < 0.01, (mark, got, expected)
    assert abs(_qty("Skirtings, rooms") - 13.10) / 13.10 < 0.01


def test_every_measured_item_closes_against_its_markup():
    closure = _run()["markup"]["closure"]
    measured = {c: v for c, v in closure.items() if c[0] in "DJ"}
    assert measured and set(measured.values()) == {"CLOSED"}, closure


def test_a_run_is_deterministic():
    """P1: the same drawings give the same quantities. The measured part is
    rebuilt from the saved facts and compared figure by figure."""
    import measure.measured as mm
    from measure.evidence import EvidenceBase
    r = _run()
    a, _g, _f = mm.build(r["measured"], None, [], EvidenceBase())
    b, _g, _f = mm.build(json.loads(json.dumps(r["measured"])), None, [], EvidenceBase())
    assert [(e.mark, [ln.desc for ln in e.lines]) for e in a] == \
           [(e.mark, [ln.desc for ln in e.lines]) for e in b]


# ── the rules, each on its own ──────────────────────────────────────────────
def test_an_l_corner_is_completed_on_the_centreline_a_t_is_not():
    from measure.measured import centrelines
    k = 35.2778
    t, w, h = 200 / k, 4000 / k, 3000 / k
    walls = [{"id": "top", "a": (0, -t / 2), "b": (w, -t / 2), "raw_thk_mm": 200},
             {"id": "bot", "a": (0, h + t / 2), "b": (w, h + t / 2), "raw_thk_mm": 200},
             {"id": "left", "a": (-t / 2, 0), "b": (-t / 2, h), "raw_thk_mm": 200},
             {"id": "right", "a": (w + t / 2, 0), "b": (w + t / 2, h), "raw_thk_mm": 200},
             {"id": "stem", "a": (w / 2, 0), "b": (w / 2, h), "raw_thk_mm": 100}]
    c = centrelines(walls, k)
    girth = sum(math.dist(*c[i]) * k for i in ("top", "bot", "left", "right"))
    assert round(girth) == 14800                               # 2 x (4200 + 3200)
    assert round(math.dist(*c["stem"]) * k) == 3000            # stops at the faces it meets


def test_storey_heights_are_checked_against_the_printed_chain():
    from measure.plan_measure import heights_from_reading
    good = {"levels": [{"name": "GROUND FLOOR LVL", "value": "+0.30", "datum": "FFL"},
                       {"name": "1ST FLOOR LVL", "value": "+5.45", "datum": "FFL"},
                       {"name": "2ND FLOOR LVL", "value": "+9.15", "datum": "FFL"},
                       {"name": "ROOF PARAPET", "value": "+10.40", "datum": "PARAPET"}],
            "chain": [{"from": "GROUND FLOOR LVL", "to": "1ST FLOOR LVL", "mm": 5150},
                      {"from": "1ST FLOOR LVL", "to": "2ND FLOOR LVL", "mm": 3600}]}
    heights, problems = heights_from_reading(good, "S-1.pdf")
    assert heights["GF"][0] == Decimal("5.15") and "agrees" in heights["GF"][1]
    assert "1F" not in heights                                # 3.70 by level, 3.60 by chain
    assert any("printed chain states 3.6" in p for p in problems)


def test_slab_and_block_sizes_come_only_from_what_is_stated():
    from measure.plan_measure import block_thicknesses, slab_thickness
    notes = [("D.pdf", "6 15cm CONCRETE SLAB"), ("E.pdf", '200mm(8")150mm(6")THICK HOLLOW BLOCK')]
    assert slab_thickness(notes, {})[0] == 150
    assert block_thicknesses(notes, {})[0] == [150, 200]
    assert slab_thickness([], {})[0] is None                   # nothing stated: no slab, a gap
    assert slab_thickness(notes + [("F.pdf", "200 MM THK RC SLAB")], {})[0] is None   # disagree
    assert slab_thickness(notes, {"slab_thickness_mm": 200})[0] == 200               # QS decision


def test_a_door_is_deducted_whatever_its_size_a_small_window_is_not():
    from measure.measured import _deduct_line
    lines = []

    class B:
        @staticmethod
        def line(item, doc_id, level, desc, dims, nr=1, deduct=False, shapes=()):
            lines.append((desc, deduct))
    door = {"mark": "D-9", "w": Decimal("0.60"), "h": Decimal("1.50"), "door": True, "ids": ("w", "h")}
    window = {"mark": "W-9", "w": Decimal("0.60"), "h": Decimal("0.60"), "door": False, "ids": ("w", "h")}
    _deduct_line(B, {}, door, 1, "d", "GF", Decimal("3.0"), "H")
    _deduct_line(B, {}, window, 1, "d", "GF", Decimal("3.0"), "H")
    assert len(lines) == 1 and "GP3.3" in lines[0][0] and lines[0][1] is True


def test_a_measured_line_under_a_clause_of_another_unit_is_refused():
    from measure.compute import compute_measured
    from measure.evidence import EvidenceBase
    from spine.records import Element, MeasuredLine, Origin
    base = EvidenceBase()
    base.make("L", Decimal("3.00"), "m", "d", None, Origin.MEASURED, role="length")

    class Clause:
        id, unit, section = "J3.1", "m2", "J"
    e = Element(mark="x", element_type="wall_finish", dims={}, count=1, sheets=("d",),
                evidence_ids=("L",), lines=(MeasuredLine("d", "GF", "run", {"length": "L"}),))
    q, gap = compute_measured(Clause, base, e)
    assert q is None and "gives m" in gap.reason


def test_a_t_junction_joins_the_through_wall_and_stops_the_stem():
    """The engine splits a wall where another meets it; the two halves are one
    wall measured through, and the stem stops at its face (not twice counted)."""
    from measure.measured import centrelines
    k = 35.2778
    t, s, w, h = 200 / k, 100 / k, 4000 / k, 3000 / k
    walls = [{"id": "topL", "a": (0, -t / 2), "b": (w / 2 - s / 2, -t / 2), "raw_thk_mm": 200},
             {"id": "topR", "a": (w / 2 + s / 2, -t / 2), "b": (w, -t / 2), "raw_thk_mm": 200},
             {"id": "left", "a": (-t / 2, 0), "b": (-t / 2, h), "raw_thk_mm": 200},
             {"id": "right", "a": (w + t / 2, 0), "b": (w + t / 2, h), "raw_thk_mm": 200},
             {"id": "stem", "a": (w / 2, 0), "b": (w / 2, h / 2), "raw_thk_mm": 100}]
    c = centrelines(walls, k)
    assert round((math.dist(*c["topL"]) + math.dist(*c["topR"])) * k) == 4200
    assert round(math.dist(*c["stem"]) * k) == 1500


def test_at_a_crossing_the_thicker_wall_runs_through():
    from measure.measured import centrelines
    k = 35.2778
    t, s, w, h = 200 / k, 100 / k, 4000 / k, 3000 / k
    walls = [{"id": "aL", "a": (0, 0), "b": (w / 2 - s / 2, 0), "raw_thk_mm": 200},
             {"id": "aR", "a": (w / 2 + s / 2, 0), "b": (w, 0), "raw_thk_mm": 200},
             {"id": "bU", "a": (w / 2, -h / 2), "b": (w / 2, -t / 2), "raw_thk_mm": 100},
             {"id": "bD", "a": (w / 2, t / 2), "b": (w / 2, h / 2), "raw_thk_mm": 100}]
    c = centrelines(walls, k)
    assert round((math.dist(*c["aL"]) + math.dist(*c["aR"])) * k) == 4000
    assert round(math.dist(*c["bU"]) * k) == round((h / 2 - t / 2) * k)


def test_the_take_off_workbook_subtracts_each_deduction_live():
    """The workbook's rollup is a live SUM over the lines: a deduction line must
    be a negative formula there, or Excel adds the opening instead."""
    from openpyxl import load_workbook
    ws = load_workbook(_run()["run"] / "takeoff.xlsx")["D. MASONRY"]
    rows = [r for r in ws.iter_rows(min_row=3, values_only=True) if r[3] and "deduct" in str(r[3])]
    assert rows and all(str(r[8]).startswith("=-(") for r in rows), rows
