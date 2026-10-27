"""measure.plan_lengths — a length between grid lines on a calibrated plan.

Synthetic words and GridMaps drive locate_marks and attach_lengths. The grid
is the contract's shape (measure.grid.GridMap); the words are in the upright
page space readers.extract produces. Nothing here opens a PDF.
"""
from __future__ import annotations

import sys
from decimal import Decimal
from pathlib import Path
from types import SimpleNamespace

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from measure import plan_lengths  # noqa: E402
from measure.evidence import EvidenceBase  # noqa: E402
from measure.grid import GridMap, bay_of  # noqa: E402
from measure.plan_lengths import attach_lengths, locate_marks  # noqa: E402
from spine.records import Element, Origin, Region, Word  # noqa: E402

PLAN = "S-101 GROUND FLOOR PLAN.pdf"
SCHED = "S-501 BEAM SCHEDULE.pdf"
OTHER = "S-102 FIRST FLOOR PLAN.pdf"


# ── builders ─────────────────────────────────────────────────────────────
def word(i, text, x0, y0, x1=None, y1=None, doc=PLAN):
    x1 = x0 + 6 * len(text) if x1 is None else x1
    y1 = y0 + 8 if y1 is None else y1
    return Word(index=i, text=text, x0=x0, y0=y0, x1=x1, y1=y1,
                doc_id=doc, page=0)


def grid(doc=PLAN, status="CALIBRATED", mm_per_pt=Decimal("10")):
    """Letters A..D along X at 100/300/500/700; numbers 1..3 along Y at
    100/300/450. 1 pt = 10 mm, so the A-B bay is 2000 mm."""
    return GridMap(doc_id=doc, W=1000.0, H=700.0, rotation=0, status=status,
                   letters=[("A", 100.0), ("B", 300.0), ("C", 500.0), ("D", 700.0)],
                   numbers=[("1", 100.0), ("2", 300.0), ("3", 450.0)],
                   letters_axis="X", numbers_axis="Y",
                   mm_per_pt=mm_per_pt if status == "CALIBRATED" else None,
                   scale_basis="dimension chain: 3 bays agree" if status == "CALIBRATED"
                   else "none", confidence="HIGH" if status == "CALIBRATED" else None,
                   chain=[2000, 2000, 2000], basis="test grid")


def beam(base, mark="B1", count=1, kind="beam", with_length=False, location=None):
    ids = {}
    for role, value, unit in (("count", count, "nr"), ("width", "0.30", "m"),
                              ("thickness", "0.60", "m")):
        rid = f"{kind}:{mark}:{role}"
        base.make(rid, value, unit, SCHED, None, Origin.STATED, role=role)
        ids[role] = rid
    if with_length:
        rid = f"{kind}:{mark}:length"
        base.make(rid, "6.00", "m", SCHED, None, Origin.STATED, role="length")
        ids["length"] = rid
    return Element(mark=mark, element_type=kind, dims=ids, count=count,
                   sheets=(SCHED,), evidence_ids=tuple(ids.values()),
                   location=location)


# horizontal tag: a wide flat box centred (190, 190) — between A and B along X
H_TAG = word(0, "B1", 178, 186, 202, 194)
# vertical tag: a tall narrow box centred (390, 400) — between 2 and 3 along Y
V_TAG = word(1, "B2", 386, 380, 394, 420)


# ── locate_marks ─────────────────────────────────────────────────────────
def test_locate_finds_the_word_case_insensitively_and_through_punctuation():
    words = [word(0, "B1", 100, 100), word(1, "b1", 100, 200),
             word(2, "B1,", 100, 300), word(3, "B10", 100, 400),
             word(4, "AB1", 100, 500)]
    found = locate_marks("B1", words)
    assert [r.y0 for r in found] == [100, 200, 300]
    assert found[0] == Region(PLAN, 0, 100.0, 100.0, 112.0, 108.0)
    assert locate_marks("b 1", words) == found, "the mark's own spaces do not matter"


def test_locate_joins_adjacent_words_and_not_distant_ones():
    words = [word(0, "B", 200, 100, 206, 108), word(1, "1", 207, 100, 213, 108),
             word(2, "B", 300, 100, 306, 108), word(3, "1", 340, 100, 346, 108),
             word(4, "B", 400, 100, 406, 108), word(5, "1", 407, 100, 413, 108),
             word(6, "0", 414, 100, 420, 108)]
    found = locate_marks("B1", words)
    assert found == [Region(PLAN, 0, 200.0, 100.0, 213.0, 108.0)], \
        "one join; the distant pair and the B-1-0 run are not B1"
    assert locate_marks("B10", words) == [Region(PLAN, 0, 400.0, 100.0, 420.0, 108.0)]


def test_locate_reads_a_rotated_tag_and_stacked_words():
    words = [V_TAG, word(2, "W", 600, 100, 608, 112), word(3, "3", 600, 113, 608, 125)]
    assert locate_marks("B2", words) == [Region(PLAN, 0, 386.0, 380.0, 394.0, 420.0)]
    assert locate_marks("W3", words) == [Region(PLAN, 0, 600.0, 100.0, 608.0, 125.0)]
    assert locate_marks("", words) == []


# ── attach_lengths ───────────────────────────────────────────────────────
def test_a_horizontal_beam_is_measured_between_the_gridlines_along_x():
    base = EvidenceBase()
    element = beam(base, "B1")
    out, gaps = attach_lengths([element], base, {PLAN: grid()},
                               {PLAN: [H_TAG]}, {PLAN: "plan"})
    assert len(out) == 1 and gaps == []
    sub = out[0]
    assert sub.mark == "B1" and sub.element_type == "beam" and sub.count == 1
    bay = bay_of(grid(), 190, 190)
    assert bay == "A/1" and sub.bay == bay
    assert sub.dims["length"] == "beam:B1:A/1:length"
    assert sub.dims["count"] == "beam:B1:A/1:count"
    assert sub.dims["width"] == "beam:B1:width", "schedule dims are kept"
    length = base.get(sub.dims["length"])
    assert length.value == Decimal("2.00") and length.unit == "m"
    assert length.origin is Origin.MEASURED and length.doc_id == PLAN
    assert length.region == Region(PLAN, 0, 178.0, 186.0, 202.0, 194.0)
    count = base.get(sub.dims["count"])
    assert count.value == Decimal(1) and count.origin is Origin.COUNTED
    assert sub.sheets == (SCHED, PLAN)
    assert "beam:B1:count" not in sub.evidence_ids, \
        "the schedule total is not cited by a one-bay sub-element"
    assert set(sub.evidence_ids) == {"beam:B1:width", "beam:B1:thickness",
                                     "beam:B1:A/1:count", "beam:B1:A/1:length"}


def test_a_vertical_tag_measures_along_y_between_the_number_lines():
    base = EvidenceBase()
    out, gaps = attach_lengths([beam(base, "B2")], base, {PLAN: grid()},
                               {PLAN: [V_TAG]}, {})
    assert gaps == [] and len(out) == 1
    sub = out[0]
    assert sub.bay == "B/3"
    assert base.get(sub.dims["length"]).value == Decimal("1.50"), \
        "2 at 300 to 3 at 450 is 150 pt x 10 mm/pt"


def test_two_tags_in_one_bay_get_distinct_ids_and_the_count_gap_is_reported():
    base = EvidenceBase()
    second = word(5, "B1", 148, 156, 172, 164)       # also bay A/1
    out, gaps = attach_lengths([beam(base, "B1", count=3)], base, {PLAN: grid()},
                               {PLAN: [H_TAG, second]}, {PLAN: "plan"})
    assert [e.bay for e in out] == ["A/1", "A/1"]
    ids = [e.dims["length"] for e in out]
    assert ids == ["beam:B1:A/1:length", "beam:B1:A/1#2:length"]
    assert [e.dims["count"] for e in out] == ["beam:B1:A/1:count",
                                              "beam:B1:A/1#2:count"]
    assert len(gaps) == 1
    assert gaps[0].subject == "B1" and gaps[0].stage == "S9"
    assert "schedule states 3 of B1; 2 tag(s) measured" in gaps[0].reason
    assert "not reconciled" in gaps[0].reason
    assert "grid A to B" in (gaps[0].detail or "")


def test_no_calibrated_plan_is_a_gap_that_counts_the_partial_ones():
    base = EvidenceBase()
    element = beam(base, "B9")
    grids = {PLAN: grid(status="PARTIAL"), OTHER: grid(OTHER, status="NONE")}
    out, gaps = attach_lengths([element], base, grids, {PLAN: [word(0, "B9", 190, 190)]},
                               {PLAN: "plan", OTHER: "plan"})
    assert out == [element], "unchanged — PARTIAL is not scale-verified"
    assert len(gaps) == 1
    assert gaps[0].reason == ("length not measurable: no calibrated plan "
                              "carries B9 (2 plans PARTIAL/NONE)")
    assert gaps[0].doc_id == SCHED
    # calibrated, but the mark is not on it
    out, gaps = attach_lengths([element], base, {PLAN: grid()}, {PLAN: [H_TAG]}, {})
    assert out == [element]
    assert gaps[0].reason.endswith("carries B9 (0 plans PARTIAL/NONE)")


def test_only_plan_sheets_are_searched_when_the_kind_is_known():
    base = EvidenceBase()
    element = beam(base, "B1")
    out, gaps = attach_lengths([element], base, {PLAN: grid()}, {PLAN: [H_TAG]},
                               {PLAN: "section"})
    assert out == [element] and "no calibrated plan carries B1" in gaps[0].reason
    # unknown kind: a CALIBRATED sheet is searched
    out, gaps = attach_lengths([element], base, {PLAN: grid()}, {PLAN: [H_TAG]}, None)
    assert out[0].bay == "A/1" and gaps == []


def test_elements_with_a_length_or_of_another_type_are_untouched():
    base = EvidenceBase()
    stated = beam(base, "B3", with_length=True)
    column = beam(base, "C1", kind="column")
    words = [word(0, "B3", 190, 190), word(1, "C1", 390, 190)]
    out, gaps = attach_lengths([stated, column], base, {PLAN: grid()}, {PLAN: words}, {})
    assert out == [stated, column] and gaps == []


def test_a_tag_with_no_gridline_on_one_side_is_not_measured_to_the_page_edge():
    base = EvidenceBase()
    element = beam(base, "B1")
    left_of_a = word(0, "B1", 38, 186, 62, 194)            # centre x 50 < A at 100
    out, gaps = attach_lengths([element], base, {PLAN: grid()}, {PLAN: [left_of_a]}, {})
    assert out == [element]
    assert len(gaps) == 1 and gaps[0].doc_id == PLAN
    assert "no grid line before it along X" in gaps[0].reason
    assert "page edge" in gaps[0].reason
    assert len(base) == 3, "nothing was added to the base"


def test_a_tag_is_attributed_once_across_two_rows_of_the_same_mark():
    """Two schedule rows of B1 (two storeys) and one plan tag: the second
    row gets a gap naming the attribution, not a second measurement."""
    base = EvidenceBase()
    ground = beam(base, "B1", location="GROUND")
    first = Element(mark="B1", element_type="beam", dims={}, count=1,
                    sheets=(SCHED,), evidence_ids=(), location="FLOOR 1")
    out, gaps = attach_lengths([ground, first], base, {PLAN: grid()},
                               {PLAN: [H_TAG]}, {})
    assert len(out) == 2
    assert out[0].bay == "A/1" and out[0].location == "GROUND"
    assert out[1] == first
    assert len(gaps) == 1 and "already attributed" in gaps[0].reason
    assert "no plan-to-storey mapping" in gaps[0].reason


def test_measured_origin_missing_is_a_gap_not_a_substitute():
    base = EvidenceBase()
    element = beam(base, "B1")
    saved = plan_lengths.Origin
    plan_lengths.Origin = SimpleNamespace(COUNTED=Origin.COUNTED)
    try:
        out, gaps = attach_lengths([element], base, {PLAN: grid()}, {PLAN: [H_TAG]}, {})
    finally:
        plan_lengths.Origin = saved
    assert out == [element]
    assert "Origin.MEASURED is not defined" in gaps[0].reason


def test_measured_length_is_rounded_once_at_intake_gp31():
    base = EvidenceBase()
    gm = grid(mm_per_pt=Decimal("10.0037"))         # 200 pt -> 2000.74 mm
    out, gaps = attach_lengths([beam(base, "B1")], base, {PLAN: gm}, {PLAN: [H_TAG]}, {})
    assert gaps == []
    assert base.get(out[0].dims["length"]).value == Decimal("2.00")
