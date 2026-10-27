#!/usr/bin/env python3
"""
S4 owner A — origins, the level table, storey heights, the alias judgement.

A storey height is one stated level minus another. These tests hold the
things a real structural package broke while this was written:

  * a section bubble "02" shared a text band with "+11.40", so a bare number
    on a sheet is never a storey name; a schedule cell reading 01 still is
  * "L3" was a ladder mark eight points above "+60.05", and "3f" a bar
    callout beside "1.25" — one letter and one digit is a mark shape, never
    a storey
  * FLOOR 8 with FLOOR 10 next in the table derived 7.20 m for a 3.60 m
    storey; a missing numbered floor is a gap, not a doubled height
  * two stated values for one storey are both kept and derive nothing
"""
from __future__ import annotations

import sys
from decimal import Decimal
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import pytest                                                  # noqa: E402

from measure import levels                                     # noqa: E402
from measure.evidence import EvidenceBase                      # noqa: E402
from measure.intake import build                               # noqa: E402
from measure.levels import (LevelTable, alias_request, apply_aliases,  # noqa: E402
                            attach_heights, build_level_table,
                            normalise_storey, storey_height)
from model import schema                                       # noqa: E402
from model.prompts import render                               # noqa: E402
from render.hygiene import APPROVED_METHODS                    # noqa: E402
from spine.errors import ModelSuppliedNumber, UnevidencedQuantity  # noqa: E402
from spine.records import Element, Origin, Quantity, Word      # noqa: E402
from takeoff.rows import _METHOD_BY_ORIGIN, rows_for           # noqa: E402

REAL = Path("/Users/ajay/Documents/Projects/BOQ Test 2")


# ── builders ─────────────────────────────────────────────────────────────
def _w(text, x, y, h=12.0, doc="S-105.pdf"):
    return Word(index=0, text=text, x0=x, y0=y, x1=x + 6.0 * len(text),
                y1=y + h, doc_id=doc, page=0)


def _sheet(doc_id, kind=None):
    return {"doc_id": doc_id, "tier": "T2", "sheet_kind": kind}


def _legend(doc, rows, x=120.0, y0=300.0, pitch=36.0):
    """A plan legend: storey label at x, level at x+70, one row per storey,
    the way a real multi-floor plan prints "2ND  +16.25"."""
    words = [_w("FLOOR", x - 5, y0 - 37, doc=doc), _w("LEVEL", x + 74, y0 - 37, doc=doc)]
    for n, (label, level) in enumerate(rows):
        words.append(_w(label, x, y0 + n * pitch, doc=doc))
        words.append(_w(level, x + 70, y0 + n * pitch, doc=doc))
    return words


PLAN_A = _legend("S-105.pdf", [("2ND", "+16.25"), ("4TH", "+23.45"), ("6TH", "+30.65")])
PLAN_B = _legend("S-106.pdf", [("3RD", "+19.85"), ("5TH", "+27.05"), ("7TH", "+34.25")])


def _table(*docs):
    sheets = [_sheet(d) for d, _words in docs]
    return build_level_table(sheets, dict(docs))


def _column_schedule(rows, doc="S-801 COLUMN SCHEDULE.pdf"):
    return {"doc_id": doc, "roles": ["mark", "width", "thickness", "location"],
            "rows": [{"mark": m, "values": v, "row_index": i}
                     for i, (m, v) in enumerate(rows)]}


# ── storey names ─────────────────────────────────────────────────────────
def test_storey_spellings():
    cases = {
        "Foundation": "FOUNDATION", "FDN": "FOUNDATION",
        "Pod 1": "PODIUM 1", "PODIUM 2": "PODIUM 2", "P01": "PODIUM 1",
        "1st floor": "FLOOR 1", "1ST FLOOR": "FLOOR 1", "FIRST FLOOR": "FLOOR 1",
        "LEVEL 1": "FLOOR 1", "LEVEL 01": "FLOOR 1", "L01": "FLOOR 1",
        "01": "FLOOR 1", "2ND": "FLOOR 2", "2nd floor": "FLOOR 2",
        "8th Floor": "FLOOR 8", "12th Floor": "FLOOR 12", "10TH": "FLOOR 10",
        "GROUND": "GROUND", "GROUND FLOOR": "GROUND", "GF": "GROUND",
        "L00": "GROUND", "00": "GROUND", "LEVEL 0": "GROUND",
        "BASEMENT 1": "BASEMENT 1", "B01": "BASEMENT 1", "BASEMENT": "BASEMENT 1",
        "MEZZANINE": "MEZZANINE", "Roof": "ROOF", "ROOF LEVEL": "ROOF",
        "TOP OF ROOF": "TOP OF ROOF", "LIFT MACHINE ROOM": "LIFT MACHINE ROOM",
        "LMR": "LIFT MACHINE ROOM",
    }
    wrong = {t: normalise_storey(t) for t, k in cases.items() if normalise_storey(t) != k}
    assert wrong == {}, wrong


def test_a_mark_shape_or_a_room_is_never_a_storey():
    """L3 was a ladder, 3f a bar callout, 1ST STAGE a piling note."""
    for text in ("L3", "B1", "P1", "3f", "1F", "1ST STAGE", "RC 300", "Kitchen",
                 "H-GWT LVL", "SSL", "G", "C2-W4", "", None):
        assert normalise_storey(text) is None, text


def test_bare_numbers_name_a_storey_only_in_a_schedule_cell():
    assert normalise_storey("02") == "FLOOR 2"
    assert normalise_storey("02", bare_numbers=False) is None
    assert normalise_storey("2ND", bare_numbers=False) == "FLOOR 2"
    assert normalise_storey("LEVEL 2", bare_numbers=False) == "FLOOR 2"


# ── origins ──────────────────────────────────────────────────────────────
def test_derived_and_measured_take_their_places_in_the_order():
    base = EvidenceBase()
    for origin in Origin:
        base.make(f"x:{origin.value}", 1, "m", "S-1.pdf", None, origin, role="length")
    assert base.weakest_origin(["x:stated", "x:derived"]) is Origin.DERIVED
    assert base.weakest_origin(["x:derived", "x:counted"]) is Origin.COUNTED
    assert base.weakest_origin(["x:counted", "x:measured"]) is Origin.MEASURED
    assert base.weakest_origin(["x:measured", "x:inferred"]) is Origin.INFERRED
    assert base.weakest_origin([]) is Origin.INFERRED


def test_a_derived_length_survives_an_unverified_sheet_a_measured_one_does_not():
    base = EvidenceBase()
    base.make("d", "3.6", "m", "S-1.pdf", None, Origin.DERIVED, role="length")
    base.make("m", "3.6", "m", "S-1.pdf", None, Origin.MEASURED, role="length")
    base.mark_scale_unverified("S-1.pdf")
    base.check_citation("d", "length")            # stated levels, no scale
    with pytest.raises(UnevidencedQuantity):
        base.check_citation("m", "length")


def test_every_origin_has_an_approved_method_label():
    for origin in (Origin.STATED, Origin.DERIVED, Origin.COUNTED, Origin.MEASURED):
        assert _METHOD_BY_ORIGIN[origin] in APPROVED_METHODS
    assert _METHOD_BY_ORIGIN[Origin.DERIVED] == "stated level difference"
    assert _METHOD_BY_ORIGIN[Origin.MEASURED] == "measured to scale"


def test_element_location_and_bay_default_none():
    e = Element(mark="C1", element_type="column", dims={}, count=1, sheets=(),
                evidence_ids=())
    assert e.location is None and e.bay is None and e.multiplier == 1


# ── the table ────────────────────────────────────────────────────────────
def test_a_plan_legend_builds_the_table_and_heights_follow():
    table, gaps = _table(("S-105.pdf", PLAN_A), ("S-106.pdf", PLAN_B))
    assert gaps == []
    assert table.keys() == [f"FLOOR {n}" for n in range(2, 8)]
    assert table.levels["FLOOR 2"].value == Decimal("16.25")
    assert table.levels["FLOOR 2"].citations == [("S-105.pdf", "+16.25")]
    height, basis = storey_height(table, "FLOOR 2")
    assert height == Decimal("3.60")                     # never rounded here
    assert "FLOOR 3 +19.85 minus FLOOR 2 +16.25" in basis
    assert "S-105.pdf" in basis and "S-106.pdf" in basis
    assert storey_height(table, "FLOOR 7") is None, "top storey"
    assert storey_height(table, "GROUND") is None, "unknown key"


def test_a_prefixed_level_pairs_only_when_its_band_names_a_storey():
    doc = "S-201.pdf"
    words = [
        _w("SSL", 400, 500, 10, doc), _w("+9.650", 425, 500, 10, doc),
        _w("PODIUM", 470, 500, 10, doc), _w("2", 515, 500, 10, doc),
        _w("SSL", 400, 700, 10, doc), _w("-3.650", 425, 700, 10, doc),   # no storey
        _w("1500", 600, 500, 10, doc), _w("3450", 640, 500, 10, doc),    # mm
        _w("123456", 700, 500, 10, doc),                                  # not a level
        _w("±", 900, 300, 12, doc), _w("0.00", 910, 300, 12, doc),
        _w("=", 940, 300, 12, doc), _w("+5.95", 950, 300, 12, doc),
        _w("DMD", 990, 300, 12, doc),                                    # the datum
    ]
    table, gaps = _table((doc, words))
    assert list(table.levels) == ["PODIUM 2"]
    assert table.levels["PODIUM 2"].value == Decimal("9.650")
    assert gaps == []


def test_no_pairing_anywhere_is_a_gap_not_an_empty_success():
    table, gaps = _table(("S-301.pdf", [_w("-3.650", 100, 100), _w("SSL", 130, 100)]))
    assert table.levels == {}
    assert any("no level paired with a storey name" in g.reason for g in gaps)


def test_two_values_for_one_storey_are_both_kept_and_derive_nothing():
    a = _legend("S-1.pdf", [("GROUND", "+0.000"), ("1ST", "+4.500")])
    b = _legend("S-2.pdf", [("1ST", "+4.650"), ("2ND", "+8.100")])
    table, gaps = _table(("S-1.pdf", a), ("S-2.pdf", b))
    assert table.conflicts == [("FLOOR 1", [Decimal("4.500"), Decimal("4.650")])]
    assert [lvl.value for lvl in table.candidates["FLOOR 1"]] == \
        [Decimal("4.500"), Decimal("4.650")]
    gap = next(g for g in gaps if g.subject == "level FLOOR 1")
    assert "stated as +4.500 and +4.650 on S-1.pdf, S-2.pdf" in gap.reason
    assert storey_height(table, "FLOOR 1") is None
    assert storey_height(table, "GROUND") is None, "the level above is conflicted"


def test_a_missing_numbered_floor_is_not_a_doubled_height():
    """FLOOR 8 and FLOOR 10 read, FLOOR 9 not: 7.20 m is two storeys."""
    table, _ = _table(("S-107.pdf", _legend("S-107.pdf", [("8TH", "+37.85"), ("10TH", "+45.05")])))
    assert storey_height(table, "FLOOR 8") is None
    _, why = levels._height_or_reason(table, "FLOOR 8")
    assert "FLOOR 9 not read" in why


def test_the_same_level_on_two_sheets_votes_twice():
    table, _ = _table(("S-105.pdf", PLAN_A), ("S-105b.pdf", _legend("S-105b.pdf", [("2ND", "+16.25")])))
    assert table.levels["FLOOR 2"].votes == 2
    assert [d for d, _r in table.levels["FLOOR 2"].citations] == ["S-105.pdf", "S-105b.pdf"]


def test_only_plan_section_elevation_or_unrouted_sheets_are_read():
    sheets = [{"doc_id": "S-105.pdf", "tier": "T2", "sheet_kind": "schedule"},
              {"doc_id": "S-106.pdf", "tier": "T2", "sheet_kind": "section"},
              {"doc_id": "S-107.pdf", "tier": "T3", "sheet_kind": None}]
    words = {"S-105.pdf": PLAN_A, "S-106.pdf": PLAN_B, "S-107.pdf": PLAN_A}
    table, _ = build_level_table(sheets, words)
    assert table.keys() == ["FLOOR 3", "FLOOR 5", "FLOOR 7"]


def test_as_dict_carries_decimals_as_strings():
    table, _ = _table(("S-105.pdf", PLAN_A))
    out = table.as_dict()
    assert out["levels"]["FLOOR 2"]["value"] == "16.25"
    assert out["conflicts"] == [] and out["candidates"]["FLOOR 4"] == ["23.45"]


# ── heights on elements ──────────────────────────────────────────────────
def test_attach_heights_derives_a_column_length_and_a_wall_height():
    table, _ = _table(("S-105.pdf", PLAN_A), ("S-106.pdf", PLAN_B))
    base, elements, gaps = build([
        _column_schedule([("C1", {"width": "600", "thickness": "300", "location": "2nd floor"}),
                          ("C1", {"width": "600", "thickness": "300", "location": "1st floor"})]),
        {"doc_id": "S-802 SHEAR WALL SCHEDULE.pdf", "roles": ["mark", "thickness", "location"],
         "rows": [{"mark": "SW1", "values": {"thickness": "300", "location": "LEVEL 3"}}]},
        {"doc_id": "S-803 BEAM SCHEDULE.pdf", "roles": ["mark", "location"],
         "rows": [{"mark": "B1", "values": {"location": "2ND FLOOR"}}]},
        {"doc_id": "A-504 SCHEDULE OF DOORS.pdf", "roles": ["mark", "location"],
         "rows": [{"mark": "D1", "values": {"location": "Kitchen"}}]},
    ])
    assert gaps == []
    out, gaps = attach_heights(elements, base, table)
    by = {(e.element_type, e.mark, e.location): e for e in out}

    c2 = by[("column", "C1", "2nd floor")]
    record = base.get(c2.dims["length"])
    assert record.id == "column:C1:FLOOR 2:length"
    assert record.value == Decimal("3.60") and record.unit == "m"
    assert record.origin is Origin.DERIVED and record.doc_id == "S-105.pdf"
    assert record.id in c2.evidence_ids and c2.count == 1

    wall = by[("wall", "SW1", "LEVEL 3")]
    assert "length" not in wall.dims, "a wall's length is a plan measurement"
    assert base.get(wall.dims["height"]).value == Decimal("3.60")

    assert "length" not in by[("beam", "B1", "2ND FLOOR")].dims
    assert "length" not in by[("door", "D1", "Kitchen")].dims

    gap = next(g for g in gaps if g.subject == "C1")
    assert gap.reason.startswith("storey '1st floor' not in the level table (levels read: FLOOR 2 +16.25")
    assert gap.doc_id == "S-801 COLUMN SCHEDULE.pdf"
    assert len(gaps) == 1, "the door's room is not a gap; doors have no storey height"


def test_a_column_at_the_top_storey_is_a_gap():
    table, _ = _table(("S-105.pdf", PLAN_A), ("S-106.pdf", PLAN_B))
    base, elements, _ = build([_column_schedule([("C9", {"location": "7th floor"})])])
    out, gaps = attach_heights(elements, base, table)
    assert "length" not in out[0].dims
    assert gaps[0].reason.startswith("no storey height for FLOOR 7: no level above FLOOR 7")


# ── the alias judgement ──────────────────────────────────────────────────
def test_alias_request_and_apply_keep_only_the_tables_keys():
    keys = ["FLOOR 2", "FLOOR 3", "PODIUM 1"]
    request = alias_request(["Pod 1", "Lobby", "L3"], keys)
    assert request.judgement == "level_alias" and request.enum == tuple(keys)
    assert "Pod 1" in request.context["locations"]
    payload = schema.validate("level_alias", {"items": [
        {"location": "Pod 1", "storey": "PODIUM 1"},
        {"location": "L3", "storey": "FLOOR 3"},
        {"location": "Lobby", "storey": "ROOF"},          # not a key
        {"location": "Pod 9", "storey": "FLOOR 2"},       # not asked
    ]})
    assert apply_aliases(payload, ["Pod 1", "Lobby", "L3"], keys) == \
        {"Pod 1": "PODIUM 1", "L3": "FLOOR 3"}
    with pytest.raises(ModelSuppliedNumber):
        schema.validate("level_alias", {"items": [
            {"location": "Pod 1", "storey": "PODIUM 1", "value": "9.65"}]})
    with pytest.raises(schema.SchemaInvalid):
        schema.validate("level_alias", {"items": [{"location": "Pod 1"}]})


def test_the_alias_prompt_renders_with_the_batched_shape():
    text = render("level_alias", locations="Pod 1\nL3", storeys="FLOOR 2, PODIUM 1",
                  enum="FLOOR 2, PODIUM 1")
    assert '[{"location": "<as written>", "storey": "<one of the set>"}]' in text
    assert "FLOOR 2, PODIUM 1" in text and "{{" not in text


def test_an_alias_lets_attach_heights_derive():
    table, _ = _table(("S-201.pdf", _legend("S-201.pdf", [("PODIUM 1", "+5.950"), ("PODIUM 2", "+9.650")])))
    base, elements, _ = build([_column_schedule([("C3", {"location": "Pod-A"})])])
    _, gaps = attach_heights(elements, base, table)
    assert "storey 'Pod-A' not in the level table" in gaps[0].reason
    out, gaps = attach_heights(elements, base, table, aliases={"Pod-A": "PODIUM 1"})
    assert gaps == [] and base.get(out[0].dims["length"]).value == Decimal("3.70")


# ── intake and rows ──────────────────────────────────────────────────────
def test_intake_splits_a_mark_by_its_stated_location():
    sheet = _column_schedule([("C1", {"location": "Pod 1"}), ("C1", {"location": "Pod 1"}),
                              ("C1", {"location": "1st floor"}), ("C2", {})])
    base, elements, gaps = build([sheet])
    assert gaps == []
    assert [(e.mark, e.location, e.count) for e in elements] == \
        [("C1", "Pod 1", 2), ("C1", "1st floor", 1), ("C2", None, 1)]
    assert elements[0].dims["count"] == "column:C1:Pod 1:count"
    assert elements[2].dims["count"] == "column:C2:count", "unlocated ids as today"
    _base, merged, _ = build([sheet], split_by_location=False)
    assert [(e.mark, e.location, e.count) for e in merged] == [("C1", None, 3), ("C2", None, 1)]


def test_rows_show_the_stated_location_as_the_level_and_the_bay_as_location():
    base = EvidenceBase()
    base.make("column:C1:count", 1, "nr", "S-801.pdf", None, Origin.STATED, role="count")
    base.make("column:C1:FLOOR 2:length", "3.6", "m", "S-105.pdf", None,
              Origin.DERIVED, role="length")
    element = Element(mark="C1", element_type="column",
                      dims={"count": "column:C1:count", "length": "column:C1:FLOOR 2:length"},
                      count=1, sheets=("S-801.pdf",),
                      evidence_ids=("column:C1:count", "column:C1:FLOOR 2:length"),
                      location="2nd floor", bay="C/3")
    quantity = Quantity(element_mark="C1", clause_id="C2.1", value=Decimal("3.60"),
                        unit="m3", evidence_ids=("column:C1:FLOOR 2:length",),
                        origin=Origin.DERIVED, section="C")
    row = rows_for(quantity, element, base)[0]
    assert row.level == "2nd floor" and row.location == "C/3"
    assert row.length == Decimal("3.60") and row.method == "stated level difference"


# ── the real package, read-only, skipped when absent ─────────────────────
def test_real_plans_build_a_consistent_table():
    """Five real sheets: three multi-floor plans with a storey legend, the
    roof plan with the ladder mark L3 beside +60.05, and the details sheet
    with the bar callout 3f beside 1.25. Every storey read is 3.60 m and
    neither hazard reaches the table."""
    names = ["620DXB24-MIM-L02-S-105-T0.pdf", "620DXB24-MIM-L03-S-106-T0.pdf",
             "620DXB24-MIM-L08-S-107-T0.pdf", "620DXB24-MIM-LUR-S-026-T0.pdf",
             "620DXB24-MIM-XXX-S-0006-T0.pdf"]
    if not all((REAL / n).is_file() for n in names):
        return                                              # skip: corpus absent
    from readers.extract import extract_words
    words = {n: extract_words(REAL / n, 0) for n in names}
    table, gaps = build_level_table([_sheet(n) for n in names], words)
    assert table.keys() == ["FLOOR 2", "FLOOR 3", "FLOOR 4", "FLOOR 5", "FLOOR 6",
                            "FLOOR 7", "FLOOR 8", "FLOOR 10"]
    assert table.conflicts == [] and gaps == []
    assert table.levels["FLOOR 3"].value == Decimal("19.85"), "not +60.05, not +1.25"
    for n in range(2, 8):
        assert storey_height(table, f"FLOOR {n}")[0] == Decimal("3.60"), n
    assert storey_height(table, "FLOOR 8") is None, "FLOOR 9 unread"
    assert storey_height(table, "FLOOR 10") is None, "top"
