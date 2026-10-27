"""Stages S15..S19 — descriptions, completeness, non-measured, price, assemble.

A synthetic ctx stands in for S0..S13: a clause table from the fixture, an
evidence base, elements with dims, quantities, and a fake S13 (item codes, a
take-off dict, house_measurement.json in the run dir). The five stages then
run in order and every assertion is on what they wrote.

Runs under pytest and under tests/run_all.py.
"""
from __future__ import annotations

import json
import sys
import tempfile
from decimal import Decimal
from pathlib import Path
from types import SimpleNamespace

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

import stages_bill                                                   # noqa: E402
from bill.assemble import (AssemblyLine, assemble, group_lines,        # noqa: E402
                           pack_groups, reconcile)
from bill.lettering import SEQUENCE                                  # noqa: E402
from bill.nonmeasured import build as build_nonmeasured              # noqa: E402
from ingest.clause_table import ClauseTable                          # noqa: E402
from measure.evidence import EvidenceBase                            # noqa: E402
from spine.config import DEFAULT                                     # noqa: E402
from spine.gaps import GapList                                       # noqa: E402
from spine.records import BillLine, Element, Origin, Quantity        # noqa: E402

TABLE = ClauseTable.load(ROOT / "data" / "clauses.json")
DOC = "A-504 SCHEDULE OF DOORS -04.pdf"


# ── the synthetic world ─────────────────────────────────────────────────
def _door(base, mark, count, width="0.90", height="2.10"):
    base.make(f"door:{mark}:count", count, "nr", DOC, None, Origin.STATED, "count")
    base.make(f"door:{mark}:width", width, "m", DOC, None, Origin.STATED, "width")
    base.make(f"door:{mark}:height", height, "m", DOC, None, Origin.STATED, "height")
    element = Element(mark=mark, element_type="door",
                      dims={"count": f"door:{mark}:count",
                            "width": f"door:{mark}:width",
                            "height": f"door:{mark}:height"},
                      count=count, sheets=[DOC],
                      evidence_ids=[f"door:{mark}:count"])
    quantity = Quantity(element_mark=mark, clause_id="H1.1",
                        value=Decimal(count), unit="nr",
                        evidence_ids=[f"door:{mark}:count"],
                        origin=Origin.STATED, section="H")
    return element, quantity


def _slab(base, mark, thickness, area):
    doc = "ST-101.pdf"
    base.make(f"slab:{mark}:thickness", thickness, "m", doc, None,
              Origin.STATED, "thickness")
    base.make(f"slab:{mark}:area", area, "m2", doc, None, Origin.STATED, "area")
    element = Element(mark=mark, element_type="slab",
                      dims={"thickness": f"slab:{mark}:thickness",
                            "area": f"slab:{mark}:area"},
                      count=1, sheets=[doc], evidence_ids=[f"slab:{mark}:area"])
    quantity = Quantity(element_mark=mark, clause_id="C2.2",
                        value=Decimal(area), unit="m2",
                        evidence_ids=[f"slab:{mark}:area"],
                        origin=Origin.STATED, section="C")
    return element, quantity


def _mech(base, mark, element_type, clause_id, unit, size=None):
    doc = "M-201.pdf"
    ids = []
    dims = {}
    if size is not None:
        base.make(f"{element_type}:{mark}:diameter", size, "m", doc, None,
                  Origin.STATED, "diameter")
        dims["diameter"] = f"{element_type}:{mark}:diameter"
    base.make(f"{element_type}:{mark}:count", 1, "nr", doc, None, Origin.COUNTED,
              "count")
    dims["count"] = f"{element_type}:{mark}:count"
    ids.append(dims["count"])
    element = Element(mark=mark, element_type=element_type, dims=dims, count=1,
                      sheets=[doc], evidence_ids=ids)
    quantity = Quantity(element_mark=mark, clause_id=clause_id,
                        value=Decimal("12.50") if unit == "m" else Decimal(1),
                        unit=unit, evidence_ids=ids, origin=Origin.COUNTED,
                        section="Q")
    return element, quantity


def _ctx(doors=3, with_slabs=True, with_mech=True, no_ai=True, searcher=None):
    run = Path(tempfile.mkdtemp(prefix="tail_bill_"))
    project = run / "project"
    project.mkdir()
    base = EvidenceBase()
    elements, quantities = [], []
    for i in range(1, doors + 1):
        e, q = _door(base, f"SD-{i:02d}", 1 + (i % 3))
        elements.append(e); quantities.append(q)
    if with_slabs:
        for mark, thk, area in (("S1", "0.15", "48.2354"), ("S2", "0.20", "12.6352")):
            e, q = _slab(base, mark, thk, area)
            elements.append(e); quantities.append(q)
    if with_mech:
        e, q = _mech(base, "V1", "valve", "Q2.3", "nr")       # deemed list exists
        elements.append(e); quantities.append(q)
        e, q = _mech(base, "P1", "pipe", "Q2.1", "m", "0.05")  # no deemed list
        elements.append(e); quantities.append(q)
        e, q = _mech(base, "P2", "pipe", "Q2.1", "m", "0.08")
        elements.append(e); quantities.append(q)

    # fake S13: item codes, a take-off dict, house_measurement.json
    codes, sections, house = {}, {}, {}
    per_section: dict[str, int] = {}
    for q in stages_bill._sorted_quantities(quantities):
        n = per_section.get(q.section, 0)
        per_section[q.section] = n + 1
        code = f"{q.section}-{SEQUENCE[n] if n < len(SEQUENCE) else n + 1}"
        codes[(q.section, q.clause_id, q.element_mark)] = code
        sections.setdefault(q.section, []).append(
            {"code": code, "clause_id": q.clause_id, "element_mark": q.element_mark,
             "description": TABLE.get(q.clause_id).title, "unit": q.unit,
             "quantity": str(q.value), "lines": []})
        house.setdefault(q.section, {
            "section_letter": q.section, "section_title": "", "pomi_section_title": "",
            "measurement": []})["measurement"].append(
            {"kind": "item", "item_key": code, "item_ref": "", "boq_page": "",
             "description": TABLE.get(q.clause_id).title, "unit": q.unit,
             "units": None, "length": None, "width": None, "height": None,
             "area": None, "volume": None, "qty": str(q.value),
             "dwg_ref": DOC, "markup": None})
    (run / "house_measurement.json").write_text(json.dumps(house, indent=1))
    takeoff = {"project": "Synthetic", "sections": [
        {"letter": L, "name": L, "items": items} for L, items in sections.items()]}
    return {"project": project, "run": run, "gaps": GapList(), "no_ai": no_ai,
            "config": DEFAULT, "region": None, "clause_table": TABLE,
            "base": base, "elements": elements, "quantities": quantities,
            "item_codes": codes, "takeoff": takeoff, "searcher": searcher}


def _run_tail(ctx):
    written = []
    for fn in (stages_bill._stage_descriptions, stages_bill._stage_completeness,
               stages_bill._stage_nonmeasured, stages_bill._stage_price,
               stages_bill._stage_assemble):
        written += fn(ctx)
    return written


# ── S15 ─────────────────────────────────────────────────────────────────
def test_group_yields_a_lead_and_ditto_variants():
    ctx = _ctx()
    stages_bill._stage_descriptions(ctx)
    items = ctx["descriptions"]["items"]
    slabs = [i for i in items if i["section"] == "C"]
    assert len(slabs) == 2
    lead, variant = slabs
    assert lead["is_variant_of"] is None and lead["variant_text"] is None
    assert "150mm thick" in lead["description"]
    assert lead["description"].endswith(
        "complete in accordance with the Specifications and Drawings")
    assert lead["family"] == "family_1"
    assert variant["is_variant_of"] == lead["item_code"]
    assert variant["variant_text"] == "Ditto, 200mm thick"
    assert variant["description"] == "Ditto, 200mm thick"
    doors = [i for i in items if i["section"] == "H"]
    # POMI H1.1: size and type stated (the fixture's schedule has no TYPE
    # cell, so the unit's kind is simply not said)
    assert doors[0]["description"].startswith("Doors, size 900mm x 2100mm, type SD-01")
    assert doors[1]["variant_text"] == "Ditto, size 900mm x 2100mm, type SD-02"
    assert not any(d["unevidenced"] for d in doors)
    assert (ctx["run"] / "descriptions.json").exists()
    assert set(items[0]) == {"item_code", "section", "clause_id", "element_mark",
                             "family", "description", "is_variant_of",
                             "variant_text", "attributes", "unevidenced"}


def test_family_3_slots_are_resolved_or_left_visible():
    ctx = _ctx()
    stages_bill._stage_descriptions(ctx)
    items = {i["item_code"]: i for i in ctx["descriptions"]["items"]}
    q_items = [i for i in items.values() if i["section"] == "Q"]
    pipes = [i for i in q_items if i["clause_id"] == "Q2.1"]
    valves = [i for i in q_items if i["clause_id"] == "Q2.3"]
    assert valves and pipes
    valve = valves[0]
    assert valve["family"] == "family_3"
    assert valve["description"].startswith("Supply and install all Valves, traps")
    assert "sleeves, cover-plates or the like" in valve["description"]
    assert "deemed_included" not in valve["unevidenced"]
    pipe_lead = [i for i in pipes if i["is_variant_of"] is None][0]
    assert "{deemed_included}" in pipe_lead["description"]
    assert "deemed_included" in pipe_lead["unevidenced"]
    assert pipe_lead["description"].endswith("as indicated.")   # size on the row
    assert pipe_lead["attributes"] == {"size": "50mm"}
    pipe_variant = [i for i in pipes if i["is_variant_of"]][0]
    assert pipe_variant["variant_text"] == "Ditto, 80mm"
    assert "size" in valve["unevidenced"]          # a valve carries no size
    gaps = [g for g in ctx["gaps"] if g.stage == "S15"]
    assert any("deemed_included" in g.reason for g in gaps)
    assert any("hygiene" in g.reason for g in gaps)      # the visible brace


def test_fabrication_token_moves_the_line_to_substantive():
    ctx = _ctx(doors=1, with_slabs=False, with_mech=False)
    q = ctx["quantities"][0]
    # Q3.1's title carries NOMINAL — a G+.25 token — so billing it is enough
    ctx["quantities"] = [Quantity(q.element_mark, "Q3.1", Decimal(10), "kg",
                                  q.evidence_ids, q.origin, "Q")]
    ctx["item_codes"] = {}
    stages_bill._stage_descriptions(ctx)
    assert ctx["audit"]["AN.SUBSTANTIVE"]
    assert any("G+.25" in g.reason for g in ctx["gaps"])


# ── S16 ─────────────────────────────────────────────────────────────────
def test_door_schedule_with_no_h_rows_blocks():
    ctx = _ctx(doors=4, with_slabs=True, with_mech=False)
    ctx["quantities"] = [q for q in ctx["quantities"] if q.section != "H"]
    stages_bill._stage_completeness(ctx)
    out = ctx["completeness"]
    assert out["evidence_counts"]["door_schedule"] == 4
    assert out["blocked"] is True and ctx["completeness_blocked"] is True
    assert [f["status"] for f in out["findings"] if f["section"] == "H"] == ["FAIL"]
    assert any(g.stage == "S16" for g in ctx["gaps"])


def test_a_written_justification_lifts_the_block():
    ctx = _ctx(doors=2, with_slabs=False, with_mech=False)
    ctx["quantities"] = []
    (ctx["run"] / "AN_RECONCILIATION.json").write_text(json.dumps(
        {"door_schedule|H": "doors in a nominated package, spec 08 11 00"}))
    stages_bill._stage_completeness(ctx)
    assert ctx["completeness"]["blocked"] is False
    assert ctx["completeness"]["findings"][0]["status"] == "JUSTIFIED"


def test_a_complete_bill_is_not_blocked():
    ctx = _ctx()
    stages_bill._stage_completeness(ctx)
    assert ctx["completeness"]["blocked"] is False


# ── S17 ─────────────────────────────────────────────────────────────────
def test_nonmeasured_marks_a_provisional_sum_commercial():
    clauses = [SimpleNamespace(id="A4.1", title="Contractor's administrative "
                               "arrangements", unit="item"),
               SimpleNamespace(id="A9.9", title="Provisional sum for "
                               "authority fees", unit="item"),
               SimpleNamespace(id="A9.8", title="Contingency allowance",
                               unit="item")]
    table = SimpleNamespace(by_section=lambda L: clauses if L == "A" else [])
    items = build_nonmeasured({}, table)
    by_ref = {i.clause_ref: i for i in items}
    assert [i.clause_ref for i in items] == ["A4.1", "A9.8", "A9.9"]
    assert by_ref["A9.9"].value_is_commercial is True
    assert by_ref["A9.8"].value_is_commercial is True
    assert by_ref["A4.1"].value_is_commercial is False
    assert all(i.bill == 1 and i.unit == "item" for i in items)


def test_nonmeasured_stage_enumerates_every_section_a_clause():
    ctx = _ctx(doors=1, with_slabs=False, with_mech=False)
    stages_bill._stage_nonmeasured(ctx)
    refs = [i["clause_ref"] for i in ctx["nonmeasured"]["items"]]
    assert refs == [c.id for c in TABLE.by_section("A")]
    assert set(ctx["nonmeasured"]["items"][0]) == {
        "bill", "clause_ref", "text", "unit", "value_is_commercial", "priced_by"}


# ── S18 ─────────────────────────────────────────────────────────────────
def test_pricing_with_no_ai_yields_no_rate_gaps_and_no_numbers():
    ctx = _ctx()
    stages_bill._stage_descriptions(ctx)
    stages_bill._stage_price(ctx)
    out = ctx["priced"]
    assert out["no_ai"] is True and out["searched"] == 0 and out["rates"] == {}
    assert out["rows"] and all(r["rate"] is None and r["amount"] is None
                               for r in out["rows"])
    assert all(any("NO_RATE" in f for f in r["flags"]) for r in out["rows"])
    gaps = [g for g in ctx["gaps"] if g.stage == "S18"]
    assert any("NO_RATE" in g.reason for g in gaps)
    assert set(out["rows"][0]) == {"ref", "section", "rate_class", "unit",
                                   "quantity", "rate", "amount", "citation",
                                   "flags", "failures"}
    assert set(out) == {"rows", "failures", "flags", "rates", "searched", "no_ai"}


def test_rate_class_comes_from_the_clause_never_the_description():
    from ingest.rates import RateClassTable
    table = RateClassTable.load(ROOT / "data" / "rate_classes.json")
    cls, rc, unlisted = stages_bill.rate_class_for(TABLE.get("H1.1"), table, "nr")
    # "Doors" matches five listed door classes — ambiguity is UNLISTED, not a guess
    assert unlisted and cls == "UNLISTED_CLASS:H.H1.1"
    assert rc.unit == "nr" and rc.section == "H" and rc.label == "Doors"
    clause = SimpleNamespace(id="C9.9", section="C", title="Plain concrete blinding",
                             unit="m3")
    cls, rc, unlisted = stages_bill.rate_class_for(clause, table, "m3")
    assert not unlisted and cls == "concrete.plain"


def test_pricing_with_a_fake_searcher_prices_and_cites():
    def searcher(prompt, label=None):
        return [{"url": "https://a.example/x", "publisher": "A", "quoted_value": 30,
                 "quoted_unit": "nr", "quoted_currency": "AED",
                 "price_date": "2026-08-01", "retrieved": "2026-09-01"},
                {"url": "https://b.example/y", "publisher": "B", "quoted_value": 34,
                 "quoted_unit": "nr", "quoted_currency": "AED",
                 "price_date": "2026-08-01", "retrieved": "2026-09-01"}]
    ctx = _ctx(doors=2, with_slabs=False, with_mech=False, no_ai=False,
               searcher=searcher)
    stages_bill._stage_descriptions(ctx)
    stages_bill._stage_price(ctx)
    out = ctx["priced"]
    assert out["searched"] == 1                        # one class, two lines
    row = out["rows"][0]
    assert row["rate"] == "32.00" and row["citation"].startswith("median of 2")
    assert any("UNLISTED_CLASS" in f for f in row["flags"])


# ── S19 ─────────────────────────────────────────────────────────────────
def test_assemble_packs_a_sixty_item_section_over_pages():
    ctx = _ctx(doors=60, with_slabs=False, with_mech=False)
    _run_tail(ctx)
    bill = ctx["bill"]
    section = bill["sections"][0]
    assert section["letter"] == "H" and section["section_no"] == 1
    assert len(section["pages"]) > 1
    assert section["last_page_ref"] == f"2/1/{len(section['pages'])}"
    assert bill["summary"] == [{"section": "H",
                                "last_page_ref": section["last_page_ref"]}]
    wrap = stages_bill.house_wrap()[0]
    by_page: dict[str, list] = {}
    for line in section["lines"]:
        by_page.setdefault(line["page"], []).append(line["item_letter"])
    for page_ref, letters in by_page.items():
        assert letters == list(SEQUENCE[:len(letters)]), page_ref
        assert "I" not in letters and "O" not in letters
    for page in ctx["bill"]["house_specs"]["H"]["boq_pages"]:
        entries = page["entries"]
        assert entries[-1]["kind"] != "heading"
        rows = 0
        for e in entries:
            if e["kind"] == "heading":
                rows += 2
            elif e["kind"] == "item_group":
                n = len(e["items"])
                rows += (len(e["description"]) + 1
                         + sum(len(wrap(i["variant"])) for i in e["items"])
                         + (n - 1) + 1)
            else:
                rows += len(wrap(e["description"])) + 1
        assert rows <= 46 and rows <= 45
    codes = [line["ref"] for line in section["lines"]]
    assert len(codes) == 60 and len(set(codes)) == 60
    assert section["pages"][0]["item_count"] == len(by_page["2/1/1"])
    # the continuation heading repeats the block's element on later pages
    second = ctx["bill"]["house_specs"]["H"]["boq_pages"][1]["entries"]
    assert second[0] == {"kind": "heading", "text": "Doors (Cont'd)"}


def test_section_total_reconciles_and_shape_is_exact():
    rates = {"H": Decimal("120.50"), "C": Decimal("310")}

    def searcher(prompt, label=None):
        unit = "m2" if "per m2" in prompt else "nr"
        v = "310" if unit == "m2" else "120.50"
        return [{"url": f"https://a.example/{unit}", "publisher": "A",
                 "quoted_value": v, "quoted_unit": unit, "quoted_currency": "AED",
                 "price_date": "2026-08-01"},
                {"url": f"https://b.example/{unit}", "publisher": "B",
                 "quoted_value": v, "quoted_unit": unit, "quoted_currency": "AED",
                 "price_date": "2026-08-01"}]
    ctx = _ctx(doors=3, with_slabs=True, with_mech=False, no_ai=False,
               searcher=searcher)
    written = _run_tail(ctx)
    assert written == ["descriptions.json", "completeness.json",
                       "nonmeasured.json", "priced.json", "bill.json"]
    bill = json.loads((ctx["run"] / "bill.json").read_text())
    assert set(bill) == {"bill_no", "project", "sections", "nonmeasured",
                         "house_specs", "summary"}
    assert [s["letter"] for s in bill["sections"]] == ["C", "H"]
    for section in bill["sections"]:
        expect = sum(Decimal(l["quantity"]) * Decimal(l["rate"])
                     for l in section["lines"] if l["rate"] is not None)
        assert Decimal(section["total"]) == expect
        assert expect == rates[section["letter"]] * sum(
            Decimal(l["quantity"]) for l in section["lines"])
        assert set(section) == {"letter", "title", "pomi_section_title",
                                "section_no", "lines", "pages", "last_page_ref",
                                "total"}
        assert set(section["lines"][0]) == {
            "ref", "item_letter", "page", "description", "quantity", "unit",
            "rate", "rate_source", "clause_id", "evidence_ids", "is_variant_of"}
        assert section["lines"][0]["rate_source"].startswith("median of")
    c_lines = bill["sections"][0]["lines"]
    assert c_lines[0]["quantity"] == "48.2354"          # GP3.1: never rounded
    assert c_lines[1]["is_variant_of"] == c_lines[0]["ref"]
    assert c_lines[1]["description"] == "Ditto, 200mm thick"
    for section in ctx["bill_sections"]:
        assert reconcile(section) is None
    spec = bill["house_specs"]["C"]
    assert set(spec) == {"section_letter", "section_title", "pomi_section_title",
                         "bill_no", "section_no", "summary_ref", "sheet_name",
                         "project", "client", "package", "building", "trade",
                         "measurement", "boq_pages"}
    assert spec["bill_no"] == 2 and spec["summary_ref"] == "S1"
    assert spec["measurement"][0]["item_ref"] == "A"
    assert spec["measurement"][0]["boq_page"] == "2/1/1"
    group = spec["boq_pages"][0]["entries"][1]
    assert group["kind"] == "item_group"
    assert group["items"][0]["variant"] == "150mm thick"
    assert group["items"][1]["variant"] == "Ditto, 200mm thick"
    assert group["items"][0]["rate"] == 310.0
    assert bill["nonmeasured"] and bill["nonmeasured"][0]["page"] == "1/1"
    assert bill["nonmeasured"][0]["rate"] is None
    assert bill["nonmeasured"][0]["quantity"] == "1"


def test_packer_refuses_a_page_ending_on_a_heading_and_splits_atomically():
    def wrap(text):
        return [text]
    lines = []
    for i in range(30):
        record = BillLine("C", None, f"row {i}", Decimal(1), "m2", None, None,
                          "C2.2", (), None if i == 0 else "C-A")
        lines.append(AssemblyLine(record, f"C-{i}", "slab", "the block", f"row {i}",
                                  ("C", "C2.2")))
    pages = pack_groups(group_lines(lines), wrap, bill=2, section_no=3)
    assert len(pages) == 2
    assert [p.reference for p in pages] == ["2/3/1", "2/3/2"]
    # one-line variants: the 20-letter cap binds before the 45-row cap
    assert pages[0].item_count == 20 and pages[1].item_count == 10
    assert pages[0].rows == 2 + 1 + 1 + 20 + 19 + 1 == 44
    assert all(p.entries[-1]["kind"] == "item_group" for p in pages)
    assert [pl.item_letter for pl in pages[1].placed][:3] == ["A", "B", "C"]
    sections = assemble(lines, DEFAULT, wrap=wrap)
    assert sections[0].last_page_ref == "2/1/2"


if __name__ == "__main__":
    import traceback
    tests = [(n, f) for n, f in sorted(globals().items())
             if n.startswith("test_") and callable(f)]
    failed = []
    for name, fn in tests:
        try:
            fn()
            print(f"  ok   {name}")
        except Exception:
            failed.append(name)
            print(f"  FAIL {name}")
            traceback.print_exc()
    print(f"\n{len(tests) - len(failed)}/{len(tests)} passed")
    sys.exit(1 if failed else 0)
