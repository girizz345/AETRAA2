#!/usr/bin/env python3
"""
Fixes from the review of a32692d on the same 102-sheet package, run once
with --no-ai and once with the model and no saved readings (27-09-2026).

  * S6/S16: the window schedule A-13-002 timed out (3 x 300 s) and the bill
    issued with 11 of 199 windows, the gate "clear". A schedule read now has
    900 s, and a door or window schedule left unread withholds the bill.
  * Take-off: a door's width and height were multiplied into its quantity -
    D-1 read 52.8 nr against 20 in the bill.
  * S7/S10: the schedule-against-plan check never ran ("D-2" never met
    "D2"), and could not have been right: the typical floor plan was counted
    once, window tags (drawn "DW" over "06") were never found, and tags on
    elevations, details, the setting-out plan and underlays were counted.
  * S1: without a saved reading, STRUCTURE Sheet 28 registered as MH-01, a
    manhole label, because a number with no title was never read off the
    block by the model.
"""
from __future__ import annotations

import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from bill import completeness                                    # noqa: E402
from ingest.discipline_matrix import DisciplineMatrix           # noqa: E402
from measure.inventory import (floor_multiplier, legs_m,         # noqa: E402
                               location_floors, plan_floors,
                               reconcile, reconcile_plan_tags, units)
from readers.counts import find_tags, join_stacked_tags, normalise_mark  # noqa: E402
from readers.extract import is_underlay                          # noqa: E402
from render._house.build_takeoff import _qty_each                # noqa: E402
from spine.errors import CompletenessFailure                     # noqa: E402
from spine.records import Word                                   # noqa: E402

DRAWINGS = ROOT.parent / "Test Drawigs"


def _w(text, x0, y0, x1, y1):
    return Word(0, text, x0, y0, x1, y1, "t", 0)


# ── take-off: an item counted in nr is not multiplied by its size ─────────
def test_a_counted_item_is_one_each_whatever_its_size():
    assert _qty_each(4, {"W": 1.2, "H": 2.2}, "nr") == 1
    assert _qty_each(4, {"W": 1.2, "H": 2.2, "qty_each": 2}, "nr") == 2


def test_a_measured_item_still_multiplies_its_dimensions():
    assert _qty_each(7, {"L": 3.0, "W": 2.0}, "m2") == "=F7*G7"
    assert _qty_each(7, {"L": 3.0}, "m") == "=F7"


# ── one spelling for a mark ─────────────────────────────────────────────────
def test_schedule_and_plan_spellings_meet():
    assert normalise_mark("D-2") == normalise_mark("D2") == "D2"
    assert normalise_mark("DW 01") == normalise_mark("DW1") == normalise_mark("DW-01") == "DW1"
    assert normalise_mark("LD-1") == "LD1"


def test_the_plain_check_now_compares_the_same_mark():
    found = reconcile({"D-2": 185, "D-6": 5}, {"D2": 147, "D6": 5})
    assert [(d.mark, d.count_a, d.count_b) for d in found] == [("D-2", 185, 147)]


# ── tags drawn as two words ─────────────────────────────────────────────────
def test_a_stacked_tag_is_one_word():
    # as drawn on A-07-005: "DW" 443.4-449.4, "06" from 448.0 (the boxes overlap)
    words = [_w("DW", 268.4, 443.4, 276.9, 449.4), _w("06", 268.8, 448.0, 274.4, 453.9),
             _w("BALCONY", 279.2, 445.5, 303.6, 450.6)]
    assert [w.text for w in join_stacked_tags(words)] == ["DW06", "BALCONY"]


def test_window_tags_are_found_with_where_they_sit():
    words = [_w("DW", 100, 100, 108, 106), _w("03", 101, 104.5, 107, 110.5),
             _w("D2", 300, 300, 308, 306), _w("LW", 500, 500, 508, 506),
             _w("01", 501, 504.5, 507, 510.5)]
    hits = find_tags(words, "A", DisciplineMatrix.load(), family="doors_windows")
    assert sorted(k for _t, k, _x, _y in hits) == ["D2", "DW3", "LW1"]


def test_an_underlay_is_another_sheets_content():
    assert is_underlay("A-07-008 LOWER ROOF PLAN|M2-A-DOOR TAG", "A-07-009")
    assert not is_underlay("A-07-009 UPPER ROOF PLAN|M2-A-DOOR TAG", "A-07-009")
    assert not is_underlay("XR-GRID|A-GRID", "A-07-009")
    assert not is_underlay("M2-A-WIN TAG", "A-07-009")


# ── floors ──────────────────────────────────────────────────────────────────
def test_the_typical_bracket_is_two_floors():
    assert floor_multiplier("TYP ( 4 - 5 ) FLOOR PLAN") == 2
    assert floor_multiplier("TYPICAL FLOOR PLAN") is None          # still a gap


def test_which_floor_a_plan_draws_and_a_row_names():
    assert plan_floors("TYP ( 4 - 5 ) FLOOR PLAN") == ["4F", "5F"]
    assert plan_floors("UNDER GROUND WATER TANK & PUMP ROOM") == ["UG"]
    assert plan_floors("LOWER ROOF PLAN") == ["LOWER ROOF"]
    assert location_floors("APARTMENT ENTRANCE (1ST TO 5TH FLOOR)") == ["1F", "2F", "3F", "4F", "5F"]
    assert location_floors("LIFT LOBBY (BASEMENT FLOOR)") == ["B1"]
    assert location_floors("STAIRCASE") == []


# ── reconciliation, plan by plan ────────────────────────────────────────────
def test_an_l_shaped_unit_tagged_on_each_leg_is_one_unit():
    # DW 04 on A-07-004: four tags, two windows of 7300 + 2950 at 1:150
    tags = [(1481, 843), (1507, 919), (1507, 1088), (1476, 1168)]
    assert legs_m("7300+2950") == [7.3, 2.95]
    assert units(tags, 10250 / 52.9167) == 2
    assert units(tags, None) == 4


def test_the_check_counts_each_plan_on_its_own_floors():
    plans = [
        {"drawing_no": "A-07-006", "floors": ["3F"], "multiplier": 1, "mm_per_pt": 52.9,
         "tags": {"D2": [(0, 0)] * 38}},
        {"drawing_no": "A-07-007", "floors": ["4F", "5F"], "multiplier": 2, "mm_per_pt": 52.9,
         "tags": {"D2": [(0, 0)] * 38}},
        {"drawing_no": "A-07-009", "floors": ["UPPER ROOF"], "multiplier": 1, "mm_per_pt": 52.9,
         "tags": {"DW11": [(0, 0)]}},
        {"drawing_no": "A-07-008", "floors": ["LOWER ROOF"], "multiplier": 1, "mm_per_pt": 52.9,
         "tags": {"DW11": [(0, 0), (400, 0)]}},
    ]
    marks = [{"mark": "D-2", "count": 114, "location": "(3RD TO 5TH FLOOR)", "legs": [1.1]},
             {"mark": "DW 11", "count": 1, "location": "GYMNASIUM (LOWER ROOF)", "legs": [28.17, 6.3]},
             {"mark": "DW 02", "count": 1, "location": "LIFT LOBBY (BASEMENT FLOOR)", "legs": [3.7]}]
    got = {r.mark: r for r in reconcile_plan_tags(marks, plans)}
    assert got["D-2"].plans == {"A-07-006": 38, "A-07-007": 76} and got["D-2"].agrees
    assert got["DW 11"].plans == {"A-07-008": 1} and got["DW 11"].outside == {"A-07-009": 1}
    assert got["DW 11"].agrees
    # a mark no plan shows is reported, with the floor that has no plan
    assert got["DW 02"].plan_total == 0 and not got["DW 02"].agrees
    assert got["DW 02"].missing_floors == ["B1"]
    assert "B1, which has no plan in the set" in got["DW 02"].as_gap().detail


# ── the gate sees a schedule that was not read ─────────────────────────────
UNREAD = [{"doc_id": "Architecture/A2/A-13-002 SCHEDULE OF WINDOWS-01.pdf",
           "drawing_no": "A-13-002", "subject": "window",
           "problem": "not read - request left in readings/A-13-002.schedule.request/"}]


def test_an_unread_window_schedule_blocks_the_bill():
    found = completeness.unread(UNREAD)
    assert [f.status for f in found] == ["FAIL"]
    with pytest.raises(CompletenessFailure) as exc:
        completeness.enforce(found)
    assert "window schedule A-13-002 is in the package and was not read" in str(exc.value)


def test_it_is_cleared_only_by_a_written_reason():
    found = completeness.unread(UNREAD, {("unread_schedule", "A-13-002"): "priced from the "
                                         "consultant's schedule by hand"})
    assert [f.status for f in found] == ["JUSTIFIED"]
    completeness.enforce(found)


def test_a_schedule_read_is_given_the_time_it_takes():
    from readers.transcribe import TASKS
    assert TASKS["schedule"]["timeout"] >= 600


# ── S1: a number with no title is read off the block ───────────────────────
# (no pytest fixtures: tests/run_all.py calls each test with no arguments)
SHEET_28 = DRAWINGS / "Structure" / "STRUCTURE Sheet 28.pdf"
READING_28 = {"drawing_no": "S-03_1", "drawing_title": "GROUND FLOOR SLAB & BEAM LAYOUT",
              "scale": "1:150", "plot": "", "job_title": "", "owner": "", "illegible": []}


def _register_sheet_28(live, answer):
    """register.build over a folder holding only STRUCTURE Sheet 28, with an
    empty readings folder and the model's answer stubbed."""
    import shutil
    import tempfile
    from readers import register, transcribe
    saved = transcribe.READINGS, transcribe._live
    with tempfile.TemporaryDirectory() as d:
        d = Path(d)
        (d / "Structure").mkdir()
        (d / "readings").mkdir()
        shutil.copy(SHEET_28, d / "Structure")
        transcribe.READINGS = d / "readings"
        transcribe._live = lambda path, task, tiles: answer
        try:
            store = transcribe.ReadingStore([d / "readings"])
            return register.build(d, workers=1, transcribe=(store, live))
        finally:
            transcribe.READINGS, transcribe._live = saved


def test_a_number_without_a_title_is_read_off_the_block():
    if not SHEET_28.exists():
        return                                   # the test package is not here
    sheets, _gaps, _ = _register_sheet_28(True, READING_28)
    assert [(s.drawing_no, s.title) for s in sheets] == [("S-03_1", "GROUND FLOOR SLAB & BEAM LAYOUT")]


def test_without_the_model_the_misread_is_said():
    if not SHEET_28.exists():
        return
    sheets, gaps, _ = _register_sheet_28(False, None)
    assert sheets[0].drawing_no == "MH-01"
    assert any("read with no title beside it" in g.reason for g in gaps)


# ── the bill is headed from the title blocks (Decision 2, 28-09-2026) ──────
def _block(owner="G F S REAL ESTATE L.L.C", title=("PROPOSED RESIDENTIAL BUILDING", "(B+G+5+ROOF)"),
           plot="5310319"):
    """The EMSQUARE block's OWNER / JOB TITLE / PLOT rows as on A-13-001 (2384 x 1684)."""
    def row(y, h, *cells):
        return [_w(t, x, y, x + 5.5 * len(t), y + h) for x, t in cells]
    words = row(1293, 9.4, (2098, "OWNER"), (2136, ":"))
    words += row(1317, 9.4, *[(2119 + 40 * i, t) for i, t in enumerate(owner.split())])
    words += row(1362, 9.4, (2092, "JOB"), (2113, "TITLE"), (2141, ":"))
    for k, line in enumerate(title):
        words += row(1378 + 15 * k, 9.4, *[(2100 + 60 * i, t) for i, t in enumerate(line.split())])
    words += row(1431, 7.8, (2093, "PLOT"), (2113, "NO."), (2126, "/"), (2130, "PARCEL"), (2158, "ID"),
                 (2191, "BLOCK"), (2216, "/"), (2220, "COMMUNITY"))
    words += row(1447, 7.8, (2114, plot), (2219, "SAIH"), (2244, "SHUAIB"), (2281, "2"))
    words += row(1200, 9.4, (2000, "PAID"), (2040, "AT"), (2060, "OWNER"), (2100, "COST"))
    return words


def test_the_block_names_the_owner_the_job_and_the_plot():
    from readers.project_identity import from_words
    assert from_words(_block(), 2384, 1684) == {
        "owner": "G F S REAL ESTATE L.L.C",
        "job_title": "PROPOSED RESIDENTIAL BUILDING (B+G+5+ROOF)", "plot": "5310319"}


def test_the_package_votes_and_a_dissenting_set_is_named():
    from readers.project_identity import heading, vote
    sheets = [{"doc_id": f"Architecture/A-{i:02d}.pdf", "owner": "G F S REAL ESTATE L.L.C",
               "job_title": "PROPOSED RESIDENTIAL BUILDING (B+G+5+ROOF)", "plot": "5310319"}
              for i in range(8)]
    sheets += [{"doc_id": f"PLUMBING/WS-{i:02d}.pdf", "job_title": "PROPOSED RESIDENTIAL BUILDING "
                "(B+G+6+ROOF)", "plot": "5310301"} for i in range(3)]
    got = vote(sheets)
    assert (got["job_title"], got["plot"]) == ("PROPOSED RESIDENTIAL BUILDING (B+G+5+ROOF)", "5310319")
    assert got["dissent"]["plot"] == [{"value": "5310301", "sheets": [
        "PLUMBING/WS-00.pdf", "PLUMBING/WS-01.pdf", "PLUMBING/WS-02.pdf"]}]
    head = heading(got, "Test Drawigs")
    assert head["client"] == "G F S REAL ESTATE L.L.C" and head["package"] == "PLOT NO. 5310319"
    assert head["label"] == "5310319 PROPOSED RESIDENTIAL BUILDING (B+G+5+ROOF)"


def test_without_an_agreed_title_the_folder_name_stands():
    from readers.project_identity import heading, vote
    split = vote([{"doc_id": "a", "job_title": "TOWER A"}, {"doc_id": "b", "job_title": "TOWER B"}])
    assert "job_title" not in split and "job_title" in split["refused"]
    assert heading(split, "Test Drawigs")["project"] == "Test Drawigs"
    assert heading(split, "Test Drawigs")["basis"] == "folder name"


def test_one_title_in_another_word_order_is_the_same_title():
    from readers.project_identity import vote
    got = vote([{"doc_id": "cover", "job_title": "PROPOSED B+G+5+ROOF RESIDENTIAL BUILDING"}] +
               [{"doc_id": f"s{i}", "job_title": "PROPOSED RESIDENTIAL BUILDING (B+G+5+ROOF)"} for i in range(3)])
    assert got["support"]["job_title"] == [4, 4] and not got["dissent"]
    assert got["job_title"] == "PROPOSED RESIDENTIAL BUILDING (B+G+5+ROOF)"      # as most print it


# ── a request the agent left is answered and used (readers/requests.py) ────
def test_a_request_left_by_the_agent_is_answered_and_then_used():
    if not SHEET_28.exists():
        return
    import shutil
    import tempfile
    from readers import requests, transcribe
    saved = transcribe.READINGS
    with tempfile.TemporaryDirectory() as d:
        d = Path(d)
        transcribe.READINGS = d
        try:
            store = transcribe.ReadingStore([d])
            reading, how = transcribe.obtain(SHEET_28, "title_block", "STRUCTURE Sheet 28", store, live=False)
            assert reading is None and "request left" in how
            waiting = requests.pending(d)
            assert [(r["sheet"], r["task"]) for r in waiting] == [("STRUCTURE Sheet 28.pdf", "title_block")]
            assert requests.why_invalid("title_block", {"drawing_no": "S-03_1"}).startswith("missing field")
            requests.save(waiting[0], READING_28, "test")
            assert requests.pending(d) == []
            again, how = transcribe.obtain(SHEET_28, "title_block", "STRUCTURE Sheet 28",
                                           transcribe.ReadingStore([d]), live=False)
            assert again["drawing_no"] == "S-03_1" and how.startswith("saved reading (test")
        finally:
            transcribe.READINGS = saved
            shutil.rmtree(d, ignore_errors=True)


def test_a_schedule_answer_needs_a_mark_on_every_row():
    from readers.requests import why_invalid
    ok = {"rows": [{"mark": "D-1", "count": 20}], "sheet_notes": [], "illegible": []}
    assert why_invalid("schedule", ok) is None
    assert "carry no mark" in why_invalid("schedule", {"rows": [{"count": 3}], "sheet_notes": [],
                                                        "illegible": []})
