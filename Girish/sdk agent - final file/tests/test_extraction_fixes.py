#!/usr/bin/env python3
"""
Extraction defects seen in a real run's own record, and the guards now in place:

  * the same mark on two schedule sheets with different stated sizes was one
    element (first sheet won) — now two, with a gap that says so
  * a drawing list read as a column schedule put S-001, S-002 into the bill
  * a take-off line read "1 x 3.6 x 0.45 x 1.7 = 5.508" — the Nr column must
    make the line's own arithmetic true
  * section-sheet level figures with no storey phrase beside them could be
    named by the model — the figure stays code-read, the model says the storey
"""
from __future__ import annotations

import sys
from decimal import Decimal
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from measure.intake import build, is_drawing_register              # noqa: E402
from measure import levels                                          # noqa: E402
from spine.records import Element, Origin, Quantity, Word           # noqa: E402
from measure.evidence import EvidenceBase                           # noqa: E402
from takeoff.rows import rows_for                                   # noqa: E402


def _sheet(doc_id, heading, rows):
    return {"doc_id": doc_id, "drawing_no": doc_id[:-4], "title": None,
            "heading": heading, "roles": ["mark", "width", "depth"],
            "rows": [{"mark": m, "values": v, "row_index": i} for i, (m, v) in enumerate(rows)]}


def test_the_same_mark_with_different_sizes_on_two_sheets_is_two_elements():
    s1 = _sheet("S-402.pdf", "BEAM SCHEDULE", [("B1A", {"width": "500", "depth": "600"})])
    s2 = _sheet("S-403.pdf", "BEAM SCHEDULE", [("B1A", {"width": "500", "depth": "1,400"})])
    base, elements, gaps = build([s1, s2])
    assert len(elements) == 2
    depths = sorted(base.get(e.dims["depth"]).value for e in elements)
    assert depths == [Decimal("0.60"), Decimal("1.40")], depths   # GP3.1: 0.01 m
    assert any("different sizes" in g.reason for g in gaps)
    # the same sizes on two sheets stay one element
    s3 = _sheet("S-404.pdf", "BEAM SCHEDULE", [("B1A", {"width": "500", "depth": "600"})])
    _b, same, _g = build([s1, s3])
    assert len(same) == 1 and set(same[0].sheets) == {"S-402.pdf", "S-404.pdf"}


def test_a_drawing_list_is_not_a_schedule():
    reg = _sheet("S-000.pdf", "NO. OF DRAWINGS INCLUDED IN THIS SUBMISSION",
                 [(f"S-{n:03d}", {}) for n in range(1, 9)])
    assert is_drawing_register(reg)
    by_marks = _sheet("X.pdf", "SCHEDULE", [(f"A-{n:03d}", {}) for n in range(1, 8)])
    assert is_drawing_register(by_marks)
    doors = _sheet("A-504.pdf", "SCHEDULE OF DOORS", [("SD-01", {"width": "1100"})])
    assert not is_drawing_register(doors)
    _b, elements, gaps = build([reg, doors])
    assert [e.mark for e in elements] == ["SD-01"]
    assert any("drawing list" in g.reason for g in gaps)


def test_the_nr_column_makes_the_line_add_up():
    base = EvidenceBase()
    base.make("column:C 2:count", 2, "nr", "S-601.pdf", None, Origin.STATED, role="count")
    base.make("column:C 2:length", Decimal("3.6"), "m", "S-301.pdf", None, Origin.DERIVED, role="length")
    base.make("column:C 2:width", Decimal("0.45"), "m", "S-601.pdf", None, Origin.STATED, role="width")
    base.make("column:C 2:depth", Decimal("1.7"), "m", "S-601.pdf", None, Origin.STATED, role="depth")
    element = Element(mark="C 2", element_type="column",
                      dims={"count": "column:C 2:count", "length": "column:C 2:length",
                            "width": "column:C 2:width", "depth": "column:C 2:depth"},
                      count=2, sheets=("S-601.pdf",),
                      evidence_ids=("column:C 2:count", "column:C 2:length",
                                    "column:C 2:width", "column:C 2:depth"),
                      location="2nd floor")
    q = Quantity(element_mark=element.key, clause_id="C2.1", value=Decimal("5.508"),
                 unit="m3", evidence_ids=tuple(element.evidence_ids),
                 origin=Origin.DERIVED, section="C")
    row = rows_for(q, element, base, item_code="C-B")[0]
    assert row.times == 2 and row.level == "2nd floor"
    assert Decimal(row.times) * row.length * row.width * row.height == row.squared


def _w(text, x, y, doc="S-301.pdf", h=8.0):
    return Word(index=0, text=text, x0=x, y0=y, x1=x + 6 * len(text), y1=y + h, doc_id=doc, page=0)


def test_unnamed_levels_are_offered_to_the_model_and_named_labels_only():
    sheet = {"doc_id": "S-301.pdf", "tier": "T2", "sheet_kind": "section"}
    words = [_w("SSL", 100, 200), _w("-3.450", 130, 200), _w("PILE", 100, 230), _w("CAP", 130, 230),
             _w("FOUNDATION", 100, 260), _w("LVL", 100, 400), _w("+5.950", 130, 400),
             _w("PODIUM", 100, 420), _w("1", 150, 420)]
    unnamed = levels.unnamed_levels([sheet], {"S-301.pdf": words})
    assert [str(u["value"]) for u in unnamed] == ["-3.450", "5.950"]
    assert "FOUNDATION" in unnamed[0]["nearby"] and "PODIUM" in unnamed[1]["nearby"]
    req = levels.name_request(unnamed)
    assert req.judgement == "level_name" and "-3.450" not in req.context["levels"]
    payload = {"items": [{"level_id": "L001", "storey": "FOUNDATION"},
                         {"level_id": "L002", "storey": "PODIUM 1"},
                         {"level_id": "L999", "storey": "ROOF"},
                         {"level_id": "L001", "storey": "not a storey"}]}
    names = levels.apply_names(payload, unnamed)
    assert names == {("S-301.pdf", Decimal("-3.450")): "FOUNDATION",
                     ("S-301.pdf", Decimal("5.950")): "PODIUM 1"}
    table, gaps = levels.build_level_table([sheet], {"S-301.pdf": words}, names=names)
    assert str(table.levels["FOUNDATION"].value) == "-3.450"
    assert str(table.levels["PODIUM 1"].value) == "5.950"
    h = levels.storey_height(table, "FOUNDATION")
    assert h is not None and h[0] == Decimal("9.400")
