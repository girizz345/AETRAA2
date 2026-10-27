"""Schedule rows to a POMI quantity — stages 9 to 12.

Run end to end on the development package this chain produces 46 doors under
H1.1 from 31 marks, every record origin STATED. These tests hold the pieces of
that chain in place, and three of them exist because the real sheets broke them:

  * "1100MM" was REFUSED as not-a-dimension while "1100mm" parsed, because the
    patterns were compiled case-sensitively. Drawings are lettered in capitals,
    so every width and height on 46 doors silently became a gap.
  * a count is never defaulted to 1. A schedule stating QTY 12 on one row is
    twelve doors, and a default of 1 understates the bill by eleven while
    looking exactly like a correct answer.
  * a clause's formula may not contradict its own unit.
"""
from decimal import Decimal

import pytest

from ingest.clause_table import ClauseTable
from measure.classify import STATED_CLAUSES, classify_stated
from measure.compute import compute_one, round_once
from measure.evidence import EvidenceBase, round_dimension
from measure.intake import build, count_of, element_type_of
from pathlib import Path
from readers.dimensions import Refused, parse
from spine.records import Origin

TABLE = ClauseTable.load(Path(__file__).resolve().parent.parent /
                         "data" / "clauses.json")


def _sheet(doc_id, rows):
    return {"doc_id": doc_id, "rows": [
        {"mark": m, "values": v, "row_index": i}
        for i, (m, v) in enumerate(rows)]}


DOORS = _sheet("A-504 SCHEDULE OF DOORS -04.pdf", [
    ("SD-01", {"width": "1100MM", "height": "2200MM"}),
    ("SD-02", {"width": "1500MM", "height": "2400MM"}),
    ("SD-03", {"width": "2000MM", "height": "2400MM"}),
])


# ── dimensions, in the case drawings are actually lettered in ───────────
def test_uppercase_millimetres_parse():
    """The regression. Every cell on an issued schedule reads 1100MM."""
    assert parse("1100MM") == (Decimal("1.1"),)
    assert parse("2200MM") == (Decimal("2.2"),)
    assert parse("900 X 2100") == (Decimal("0.9"), Decimal("2.1"))
    assert parse("2.4 M") == (Decimal("2.4"),)


def test_a_qualified_figure_is_still_refused_in_either_case():
    """Case-insensitivity must not soften the refusals — that is the whole
    value of this parser."""
    for cell in ("approx 1100", "1100 TYP", "APPROX 1100MM", "1100MM TYP",
                 "1100 +/- 10", "TO SUIT"):
        with pytest.raises(Refused):
            parse(cell)


def test_gp3_1_rounds_the_dimension_and_nothing_else():
    assert round_dimension(Decimal("4.237")) == Decimal("4.24")
    with pytest.raises(NotImplementedError):
        round_once(Decimal("12.6352"))


# ── intake ─────────────────────────────────────────────────────────────
def test_the_schedule_names_its_own_subject():
    assert element_type_of("A-504 SCHEDULE OF DOORS -04.pdf") == "door"
    assert element_type_of("A-505 SCHEDULE OF GLASS AND ALUMINIUM.pdf") == \
        "glazing"
    assert element_type_of("A-102 GROUND FLOOR PLAN.pdf") is None


def test_a_sheet_that_does_not_say_what_it_schedules_is_a_gap():
    base, elements, gaps = build([_sheet("A-999 UNTITLED.pdf",
                                         [("X-1", {})])])
    assert elements == []
    assert any("does not say what it schedules" in g.reason for g in gaps)


def test_rows_become_stated_evidence_with_dimensions():
    base, elements, gaps = build([DOORS])
    assert len(elements) == 3
    assert len(base) == 9, "count, width and height per element"
    assert base.composition()["stated"] == 9
    assert base.composition()["inferred"] == 0
    door = elements[0]
    assert sorted(door.dims) == ["count", "height", "width"]
    assert base.get(door.dims["width"]).value == Decimal("1.10")


def test_a_stated_count_governs_and_is_never_defaulted_to_one():
    """A schedule stating QTY 12 is twelve doors."""
    sheet = _sheet("A-501 SCHEDULE OF DOORS.pdf",
                   [("D1", {"count": "12"}), ("D2", {"count": "4"})])
    _base, elements, _gaps = build([sheet])
    assert {e.mark: e.count for e in elements} == {"D1": 12, "D2": 4}


def test_repeated_marks_without_a_count_column_are_counted_by_row():
    sheet = _sheet("A-501 SCHEDULE OF DOORS.pdf",
                   [("D1", {}), ("D1", {}), ("D2", {})])
    _base, elements, _gaps = build([sheet])
    assert {e.mark: e.count for e in elements} == {"D1": 2, "D2": 1}


def test_an_unreadable_stated_count_is_a_gap_not_a_one():
    assert count_of([type("R", (), {"values": {"count": "SEE NOTE"}})()]) is None
    sheet = _sheet("A-501 SCHEDULE OF DOORS.pdf",
                   [("D1", {"count": "SEE NOTE"})])
    _base, elements, gaps = build([sheet])
    assert elements == []
    assert any("cannot be read" in g.reason for g in gaps)


def test_a_qualified_dimension_becomes_a_gap_and_the_element_survives():
    sheet = _sheet("A-501 SCHEDULE OF DOORS.pdf",
                   [("D1", {"width": "approx 900"})])
    _base, elements, gaps = build([sheet])
    assert len(elements) == 1, "the door is still a door"
    assert "width" not in elements[0].dims
    assert any("not a dimension" in g.reason for g in gaps)


def test_the_same_mark_on_two_sheets_is_one_element_citing_both():
    a = _sheet("A-501 SCHEDULE OF DOORS -01.pdf", [("D1", {})])
    b = _sheet("A-502 SCHEDULE OF DOORS -02.pdf", [("D1", {})])
    _base, elements, _gaps = build([a, b])
    assert len(elements) == 1
    assert len(elements[0].sheets) == 2
    assert elements[0].count == 2


# ── classification without a model ─────────────────────────────────────
def test_a_door_schedule_classifies_with_the_network_down():
    """"SCHEDULE OF DOORS" plus H1.1 "Doors shall be enumerated" plus a stated
    count leaves nothing to judge."""
    base, elements, _gaps = build([DOORS])
    classifications, unclassified = classify_stated(elements, TABLE, base)
    assert unclassified == []
    assert {c.clause_id for c in classifications} == {"H1.1"}
    assert all(b.role == "count" for c in classifications for b in c.bindings)


def test_a_type_whose_clause_needs_judgement_is_left_unclassified():
    """Which of H3.1 screens, H5.2 sealed units or H6.1 patent glazing a "GLASS
    AND ALUMINIUM" schedule belongs under is a judgement, so it is visible
    rather than guessed."""
    assert "glazing" not in STATED_CLAUSES
    sheet = _sheet("A-505 SCHEDULE OF GLASS AND ALUMINIUM.pdf", [("G1", {})])
    base, elements, _gaps = build([sheet])
    classifications, unclassified = classify_stated(elements, TABLE, base)
    assert classifications == [] and len(unclassified) == 1


def test_every_stated_clause_exists_enumerates_and_is_computable():
    for kind, clause_id in sorted(STATED_CLAUSES.items()):
        clause = TABLE.get(clause_id)
        assert clause.computable, f"{kind} -> {clause_id}"
        assert clause.unit == "nr", f"{kind} -> {clause_id} is {clause.unit}"
        assert clause.shape == "count"


# ── compute ────────────────────────────────────────────────────────────
def test_the_chain_produces_a_pomi_quantity():
    base, elements, _gaps = build([DOORS])
    classifications, _ = classify_stated(elements, TABLE, base)
    by_mark = {e.mark: e for e in elements}
    total = Decimal(0)
    for classification in classifications:
        element = by_mark[classification.element_mark]
        clause = TABLE.get(classification.clause_id)
        quantity, gap = compute_one(classification, clause, base, element, None)
        assert gap is None
        assert quantity.unit == "nr" and quantity.section == "H"
        assert quantity.origin is Origin.STATED
        total += quantity.value
    assert total == Decimal(3)


def test_the_floor_multiplier_multiplies_the_quantity():
    base, elements, _gaps = build([DOORS])
    classifications, _ = classify_stated(elements, TABLE, base)
    element = elements[0]
    repeated = type(element)(mark=element.mark, element_type=element.element_type,
                             dims=element.dims, count=element.count,
                             sheets=element.sheets,
                             evidence_ids=element.evidence_ids, multiplier=7)
    clause = TABLE.get("H1.1")
    one, _ = compute_one(classifications[0], clause, base, element, None)
    seven, _ = compute_one(classifications[0], clause, base, repeated, None)
    assert seven.value == one.value * 7


def test_a_quantity_carries_the_evidence_it_was_computed_from():
    base, elements, _gaps = build([DOORS])
    classifications, _ = classify_stated(elements, TABLE, base)
    quantity, _ = compute_one(classifications[0], TABLE.get("H1.1"), base,
                              elements[0], None)
    assert quantity.evidence_ids
    for eid in quantity.evidence_ids:
        assert eid in base
