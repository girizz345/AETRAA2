"""S13 take-off and S14 markup — the tail contract, held in place.

Synthetic evidence, elements and quantities drive the two stages end to end
into a temporary run folder. Three of these tests exist because the contract
names the failure they guard: a rollup that does not reconcile exactly, an
item letter I or O, and a coordinate invented for a row that could not be
located.

Run as a script to drive both stages on a real completed run folder:

  python3 tests/test_tail_takeoff.py [runs/<id>]

which writes takeoff.json, house_measurement.json, audit.json,
markup_instructions.json and markup_spec.json INTO that run folder and prints
the artefact summary.
"""
from __future__ import annotations

import json
import shutil
import sys
import tempfile
from decimal import Decimal
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from ingest.clause_table import Clause, ClauseTable  # noqa: E402
from measure.evidence import EvidenceBase  # noqa: E402
from spine.gaps import GapList  # noqa: E402
from spine.records import (Element, EvidenceRecord, Origin, Quantity,  # noqa: E402
                           Region, SheetRecord, Tier)
from stages_takeoff import (_stage_markup, _stage_takeoff,  # noqa: E402
                            item_codes_for)
from takeoff.markup import (MarkupInstruction, instructions_for,  # noqa: E402
                            primitive_for, unplaced_for)
from takeoff.rollup import build, reconcile  # noqa: E402
from takeoff.rows import rows_for  # noqa: E402

DOORS_SHEET = "A-504 SCHEDULE OF DOORS -04.pdf"

TABLE = ClauseTable({
    "H1.1": Clause(id="H1.1", section="H", title="Doors", unit="nr",
                   shape="count", thresholds=(), deduction_rule=None,
                   grouping=(), source="test"),
    "C2.1": Clause(id="C2.1", section="C", title="Reinforced concrete in slabs",
                   unit="m3", shape="volume", thresholds=(),
                   deduction_rule=None, grouping=(), source="test"),
    "C9.9": Clause(id="C9.9", section="C",
                   title="Slabs from the pipeline {thk}", unit="m2",
                   shape="area", thresholds=(), deduction_rule=None,
                   grouping=(), source="test"),
})


# ── builders ─────────────────────────────────────────────────────────────
def _door(base, mark, count=1, width="1.10", height="2.20", sheet=DOORS_SHEET):
    ids = {}
    for role, value, unit in (("count", count, "nr"), ("width", width, "m"),
                              ("height", height, "m")):
        rid = f"door:{mark}:{role}"
        base.make(rid, value, unit, sheet, None, Origin.STATED, role=role)
        ids[role] = rid
    element = Element(mark=mark, element_type="door", dims=ids, count=count,
                      sheets=(sheet,), evidence_ids=tuple(ids.values()))
    quantity = Quantity(element_mark=mark, clause_id="H1.1",
                        value=Decimal(count), unit="nr",
                        evidence_ids=(ids["count"],), origin=Origin.STATED,
                        section="H")
    return element, quantity


def _slab(base, mark, clause="C2.1", unit="m3", sheet="S-101 SLAB PLAN.pdf"):
    ids = {}
    for role, value in (("length", "4.237"), ("width", "2.981"),
                        ("thickness", "0.30")):
        rid = f"slab:{mark}:{role}"
        base.make(rid, value, "m", sheet, None, Origin.STATED, role=role)
        ids[role] = rid
    element = Element(mark=mark, element_type="slab", dims=ids, count=1,
                      sheets=(sheet,), evidence_ids=tuple(ids.values()))
    # GP3.1: 4.24 x 2.98 x 0.30, product never rounded
    value = Decimal("4.24") * Decimal("2.98") * Decimal("0.30")
    quantity = Quantity(element_mark=mark, clause_id=clause, value=value,
                        unit=unit, evidence_ids=tuple(ids.values()),
                        origin=Origin.STATED, section="C")
    return element, quantity


def _ctx(base, elements, quantities, sheets=(), project=None):
    run = Path(tempfile.mkdtemp(prefix="tail-"))
    project = project or Path(tempfile.mkdtemp(prefix="proj-"))
    return {"project": Path(project), "run": run, "gaps": GapList(),
            "no_ai": True, "base": base, "elements": list(elements),
            "quantities": list(quantities), "clause_table": TABLE,
            "sheets": list(sheets), "classifications": [], "schedules": [],
            "config": None, "region": None}


# ── rows and rollup ───────────────────────────────────────────────────────
def test_rows_for_reconciles_exactly_for_a_count():
    base = EvidenceBase()
    element, quantity = _door(base, "SD-01", count=2)
    rows = rows_for(quantity, element, base)
    assert len(rows) == 1, "one element is one dimension set"
    row = rows[0]
    assert row.times == 2 and row.width == Decimal("1.10")
    assert row.height == Decimal("2.20") and row.length is None
    assert row.squared == Decimal(2)
    assert row.method == "schedule cell"
    assert row.drawing_ref == DOORS_SHEET
    assert reconcile(build(rows, quantity), quantity) is None


def test_rows_for_reconciles_exactly_for_a_product_never_rounded():
    base = EvidenceBase()
    element, quantity = _slab(base, "S1")
    rows = rows_for(quantity, element, base)
    assert rows[0].times == 1
    assert rows[0].height == Decimal("0.30"), "thickness fills the H column"
    assert rows[0].squared == Decimal("3.79056")
    assert reconcile(build(rows, quantity), quantity) is None


def test_a_row_out_of_step_with_its_quantity_is_reported():
    base = EvidenceBase()
    element, quantity = _door(base, "SD-01", count=2)
    rows = rows_for(quantity, element, base)
    other = Quantity(**{**quantity.__dict__, "value": Decimal(3)})
    assert "does not reconcile" in reconcile(build(rows, quantity), other)


def test_level_comes_from_the_sheet_subtitle():
    base = EvidenceBase()
    element, quantity = _door(base, "SD-01")
    sheet = SheetRecord(doc_id=DOORS_SHEET, file_sha256="", drawing_no="A-504",
                        title="SCHEDULE OF DOORS", revision="R0", scale="NTS",
                        subtitle="2ND, 4TH & 6TH", discipline="Architectural",
                        section="H", sheet_kind="schedule", tier=Tier.T2_VECTOR)
    with_sheet = rows_for(quantity, element, base, sheets={DOORS_SHEET: sheet})
    without = rows_for(quantity, element, base)
    assert with_sheet[0].level == "2ND, 4TH & 6TH"
    assert without[0].level is None


# ── item codes ────────────────────────────────────────────────────────────
def test_item_letters_skip_i_and_o():
    codes = item_codes_for("H", 20)
    assert "H-I" not in codes and "H-O" not in codes
    assert codes[8] == "H-J" and codes[-1] == "H-V"
    assert codes == [f"H-{c}" for c in "ABCDEFGHJKLMNPQRSTUV"]


def test_a_section_past_twenty_items_continues_with_an_ordinal():
    codes = item_codes_for("H", 31)
    assert len(set(codes)) == 31
    assert codes[20] == "H-2A" and codes[30] == "H-2L"
    assert not any(c.endswith("I") or c.endswith("O") for c in codes)


def test_stage_takeoff_letters_the_section_in_canonical_order():
    base = EvidenceBase()
    marks = [f"SD-{n:02d}" for n in range(1, 11)]
    pairs = [_door(base, m) for m in reversed(marks)]   # arrive out of order
    ctx = _ctx(base, [p[0] for p in pairs], [p[1] for p in pairs])
    written = _stage_takeoff(ctx)
    assert written == ["takeoff.json", "house_measurement.json", "audit.json"]
    codes = ctx["item_codes"]
    assert codes[("H1.1", "SD-01")] == "H-A"
    assert codes[("H1.1", "SD-09")] == "H-J", "I is skipped"
    assert codes[("H1.1", "SD-10")] == "H-K"
    section = ctx["takeoff"]["sections"][0]
    assert [i["code"] for i in section["items"]] == item_codes_for("H", 10)
    assert section["name"] == "DOORS AND WINDOWS"
    item = section["items"][0]
    assert item["quantity"] == "1" and item["lines"][0]["squared"] == "1"
    assert item["lines"][0]["method"] == "schedule cell"
    assert item["description"] == "Doors"


def test_takeoff_json_reconciles_and_carries_the_contract_keys():
    base = EvidenceBase()
    door = _door(base, "SD-01", count=3)
    slab = _slab(base, "S1")
    ctx = _ctx(base, [door[0], slab[0]], [door[1], slab[1]])
    _stage_takeoff(ctx)
    takeoff = json.loads((ctx["run"] / "takeoff.json").read_text())
    assert set(takeoff) == {"project", "descriptor", "drawing_links",
                            "sections", "audit"}
    assert [s["letter"] for s in takeoff["sections"]] == ["C", "H"]
    for section in takeoff["sections"]:
        for item in section["items"]:
            assert set(item) == {"code", "clause_id", "element_mark",
                                 "description", "unit", "quantity", "lines"}
            total = sum(Decimal(l["squared"]) for l in item["lines"])
            assert total == Decimal(item["quantity"])
            for line in item["lines"]:
                assert set(line) == {"ref", "level", "desc", "nr", "L", "W",
                                     "H", "qty_each", "location",
                                     "evidence_ids", "method", "squared"}
    # no sheet on disk -> no fabricated link
    assert all(v == "" for v in takeoff["drawing_links"].values())
    assert set(takeoff["audit"]) == {"reconciliation", "substantive",
                                     "coverage"}
    house = json.loads((ctx["run"] / "house_measurement.json").read_text())
    assert set(house) == {"C", "H"}
    kinds = [m["kind"] for m in house["H"]["measurement"]]
    assert kinds == ["element", "item"]
    door_item = house["H"]["measurement"][1]
    assert door_item["qty"] == 3.0 and door_item["length"] is None
    slab_item = house["C"]["measurement"][1]
    assert slab_item["units"] == 1 and slab_item["length"] == 4.24
    assert slab_item["height"] == 0.30 and slab_item["volume"] is None
    assert door_item["markup"] is None
    # GP3.1: the take-off quantity keeps full precision — the Decimal's own
    # digits, trailing zero included, never normalised or rounded
    slab_takeoff = takeoff["sections"][0]["items"][0]
    assert slab_takeoff["quantity"] == "3.790560"
    assert Decimal(slab_takeoff["quantity"]) == Decimal("3.79056")


def test_a_hygiene_violation_in_a_description_becomes_a_gap():
    base = EvidenceBase()
    element, quantity = _slab(base, "S9", clause="C9.9", unit="m2")
    ctx = _ctx(base, [element], [quantity])
    _stage_takeoff(ctx)
    hygiene_gaps = [g for g in ctx["gaps"]
                    if g.stage == "S13" and "hygiene" in g.reason]
    assert hygiene_gaps, "the title carries a brace and a banned word"
    reasons = " ".join(g.reason for g in hygiene_gaps)
    assert "'{'" in reasons and "'pipeline'" in reasons
    # not rewritten: the description is written as the clause has it
    takeoff = json.loads((ctx["run"] / "takeoff.json").read_text())
    assert takeoff["sections"][0]["items"][0]["description"] == \
        "Slabs from the pipeline {thk}"


# ── markup ────────────────────────────────────────────────────────────────
def test_markup_primitive_per_unit():
    assert primitive_for("m2") == "polygon"
    assert primitive_for("m3") == "polygon"
    assert primitive_for("m") == "polyline"
    assert primitive_for("kg") == "polyline"
    assert primitive_for("nr") == "tag"
    try:
        primitive_for("item")
    except KeyError:
        pass
    else:
        raise AssertionError("an item has no primitive and must say so")


def test_instructions_follow_the_unit_and_the_trade_colour():
    from ingest.conventions import Conventions
    conventions = Conventions.load(ROOT / "data" / "conventions.json")
    base = EvidenceBase()
    door = _door(base, "SD-01", count=2)
    slab = _slab(base, "S1")
    rows = (rows_for(door[1], door[0], base, item_code="H-A")
            + rows_for(slab[1], slab[0], base, item_code="C-A"))
    regions = {
        "H-A": [Region(DOORS_SHEET, 0, 10.0, 100.0, 500.0, 112.0),
                Region(DOORS_SHEET, 0, 10.0, 200.0, 500.0, 212.0)],
        "C-A": [Region("S-101 SLAB PLAN.pdf", 0, 50.0, 60.0, 150.0, 80.0)],
    }
    out = instructions_for(rows, conventions, regions)
    assert [i.item_code for i in out] == ["H-A", "C-A"], \
        "sorted by doc_id first"
    tag = next(i for i in out if i.item_code == "H-A")
    assert tag.primitive == "tag" and len(tag.points) == 2
    assert tag.points[0] == (255.0, 106.0)
    assert tag.colour == conventions.colour("H").rgb
    assert tag.hex == "3F9E8C" and tag.section == "H" and tag.qty == "2"
    area = next(i for i in out if i.item_code == "C-A")
    assert area.primitive == "polygon" and len(area.points) == 4
    assert area.label_at == (100.0, 70.0)
    assert unplaced_for(rows, conventions, regions) == []


def test_an_unlocatable_region_lands_in_unplaced_not_in_instructions():
    base = EvidenceBase()
    door = _door(base, "SD-01", count=2)
    ctx = _ctx(base, [door[0]], [door[1]])          # project has no PDFs
    _stage_takeoff(ctx)
    written = _stage_markup(ctx)
    assert written == ["markup_instructions.json", "markup_spec.json"]
    out = json.loads((ctx["run"] / "markup_instructions.json").read_text())
    assert out["instructions"] == []
    assert out["unplaced"] == ["H-A"]
    assert out["closure"] == {"H-A": "MARKUP_MISMATCH"}
    assert ctx["markup_spec"] == {}
    gap = next(g for g in ctx["gaps"] if g.stage == "S14" and g.subject == "H-A")
    assert "not found in the project folder" in gap.reason
    # and the house block carries no markup link for it
    house = json.loads((ctx["run"] / "house_measurement.json").read_text())
    assert house["H"]["measurement"][1]["markup"] is None


def test_area_items_close_as_not_calibrated_with_one_gap():
    base = EvidenceBase()
    slab = _slab(base, "S1")
    ctx = _ctx(base, [slab[0]], [slab[1]])
    _stage_takeoff(ctx)
    ctx["regions"] = {"C-A": [Region("S-101 SLAB PLAN.pdf", 0, 50.0, 60.0,
                                     150.0, 80.0)]}
    ctx["region_problems"] = {}
    _stage_markup(ctx)
    assert ctx["markup_instructions"]["closure"] == {"C-A": "NOT_CALIBRATED"}
    scale_gaps = [g for g in ctx["gaps"] if g.stage == "S14"
                  and g.subject == "scale"]
    assert len(scale_gaps) == 1
    spec = ctx["markup_spec"]["C"]
    assert spec["section_title"] == "Concrete Work"
    sheet = spec["sheets"][0]
    assert sheet["filename"] == "S-101 SLAB PLAN.pdf" and sheet["seq"] == 1
    assert sheet["name"] == "S-101 SLAB PLAN"
    item = sheet["items"][0]
    assert item["kind"] == "area" and item["colour"] == "#8C6BB1"
    assert item["regions"] == [[[50.0, 60.0], [150.0, 60.0], [150.0, 80.0],
                                [50.0, 80.0]]]


def test_tag_closure_compares_points_with_the_schedule_count():
    base = EvidenceBase()
    door = _door(base, "SD-01", count=2)
    ctx = _ctx(base, [door[0]], [door[1]])
    _stage_takeoff(ctx)
    ctx["regions"] = {"H-A": [Region(DOORS_SHEET, 0, 10.0, 100.0, 500.0, 112.0),
                              Region(DOORS_SHEET, 0, 10.0, 200.0, 500.0, 212.0)]}
    ctx["region_problems"] = {}
    _stage_markup(ctx)
    assert ctx["markup_instructions"]["closure"] == {"H-A": "CLOSED"}
    item = ctx["markup_spec"]["H"]["sheets"][0]["items"][0]
    assert item["kind"] == "tag" and len(item["regions"]) == 2
    assert item["regions"][0] == [[255.0, 106.0]]


def test_band_matching_reads_a_two_word_mark():
    from takeoff.markup import band_holds_mark, regions_for_mark
    from readers.schedule_grid import Band
    from spine.records import Word

    def word(i, text, x0, y0):
        return Word(index=i, text=text, x0=x0, y0=y0, x1=x0 + 30, y1=y0 + 8,
                    doc_id="x#0", page=0)
    band = Band(top=100.0, bottom=108.0,
                words=(word(0, "DOOR", 10, 100), word(1, "AL-01", 45, 100),
                       word(2, "SUBSTATION", 80, 100)))
    assert band_holds_mark(band, "DOOR AL-01")
    assert band_holds_mark(band, "AL-01")
    assert not band_holds_mark(band, "AL-0")
    regions = regions_for_mark("DOOR AL-01", [band], "A-504.pdf")
    assert regions == [Region("A-504.pdf", 0, 10.0, 100.0, 110.0, 108.0)]


def test_audit_build_survives_an_empty_run_folder():
    from takeoff.audit import TABS, build
    tabs = build(Path(tempfile.mkdtemp(prefix="empty-")))
    assert set(tabs) == set(TABS)
    assert all(rows == [] for rows in tabs.values())


def test_audit_coverage_reads_the_run_artefacts():
    from takeoff.audit import build
    run = Path(tempfile.mkdtemp(prefix="audit-"))
    (run / "elements.json").write_text(json.dumps({"elements": [
        {"mark": "SD-01", "element_type": "door"},
        {"mark": "F.03", "element_type": "finish"}]}))
    (run / "quantities.json").write_text(json.dumps({"rows": [
        {"mark": "SD-01", "clause": "H1.1", "section": "H"}]}))
    (run / "inventory.json").write_text(json.dumps({"discrepancies": [
        {"mark": "SD-01", "schedule": 2, "plan_tags": 3}]}))
    (run / "classifications.json").write_text(json.dumps({
        "basis": "stated", "rows": [{"mark": "SD-01", "clause": "H1.1"}]}))
    tabs = build(run, item_codes={("H1.1", "SD-01"): "H-A"})
    assert tabs["AN.RECONCILIATION"] == [["SD-01", "schedule count", "2",
                                          "plan tag count", "3", None, None]]
    assert tabs["AN.SUBSTANTIVE"] == [["H-A", "clause H1.1 applied to SD-01",
                                       "stated", None]]
    coverage = {(r[0], r[1]): r[4] for r in tabs["AN.COVERAGE"]}
    assert coverage[("H", "door_schedule")] == "PASS"
    assert coverage[("J", "finish_schedule")] == "FAIL"


# ── the real run ──────────────────────────────────────────────────────────
REAL_RUN = ROOT / "runs" / "18679d9147ab"


def ctx_from_run(run_dir: Path, out_dir: Path) -> dict | None:
    """Rebuild the S13 ctx from a completed run folder. None when the folder
    or its project is not on this machine."""
    needed =("quantities.json", "elements.json", "evidence.json",
              "register.json", "summary.json")
    if not all((run_dir / n).is_file() for n in needed):
        return None
    summary = json.loads((run_dir / "summary.json").read_text())
    project = Path(summary.get("project", ""))
    if not project.is_dir():
        return None

    base = EvidenceBase()
    for r in json.loads((run_dir / "evidence.json").read_text())["records"]:
        base.add(EvidenceRecord(id=r["id"], value=Decimal(r["value"]),
                                unit=r["unit"], doc_id=r["doc_id"],
                                region=None, origin=Origin(r["origin"])))
    elements = []
    for e in json.loads((run_dir / "elements.json").read_text())["elements"]:
        dims = {role: f"{e['element_type']}:{e['mark']}:{role}"
                for role in e.get("roles", [])}
        dims = {k: v for k, v in dims.items() if v in base}
        elements.append(Element(mark=e["mark"], element_type=e["element_type"],
                                dims=dims, count=int(e["count"]),
                                sheets=tuple(e.get("sheets", [])),
                                evidence_ids=tuple(dims.values()),
                                multiplier=int(e.get("multiplier", 1))))
    quantities = []
    for q in json.loads((run_dir / "quantities.json").read_text())["rows"]:
        quantities.append(Quantity(element_mark=q["mark"], clause_id=q["clause"],
                                   value=Decimal(q["value"]), unit=q["unit"],
                                   evidence_ids=tuple(q.get("evidence", [])),
                                   origin=Origin(q["origin"]),
                                   section=q["section"]))
    sheets = []
    for s in json.loads((run_dir / "register.json").read_text())["sheets"]:
        sheets.append(SheetRecord(**{**s, "tier": Tier(s["tier"])}))
    table = ClauseTable.load(ROOT / "data" / "clauses.json")

    out_dir.mkdir(parents=True, exist_ok=True)
    if out_dir.resolve() != run_dir.resolve():
        for name in ("inventory.json", "classifications.json",
                     "elements.json", "quantities.json"):
            if (run_dir / name).is_file():
                shutil.copy(run_dir / name, out_dir / name)
    return {"project": project, "run": out_dir, "gaps": GapList(),
            "no_ai": True, "base": base, "elements": elements,
            "quantities": quantities, "clause_table": table,
            "sheets": sheets, "config": None, "region": None}


def drive(run_dir: Path, out_dir: Path) -> dict | None:
    ctx = ctx_from_run(run_dir, out_dir)
    if ctx is None:
        return None
    _stage_takeoff(ctx)
    _stage_markup(ctx)
    return ctx


def summarise(ctx: dict) -> str:
    takeoff = ctx["takeoff"]
    lines = [f"run       {ctx['run']}"]
    for section in takeoff["sections"]:
        codes = [i["code"] for i in section["items"]]
        lines.append(f"section {section['letter']}  {len(codes)} items  "
                     f"{codes[0]}..{codes[-1]}")
    links = {k: v for k, v in takeoff["drawing_links"].items() if v}
    lines.append(f"drawing_links  {len(takeoff['drawing_links'])} refs, "
                 f"{len(links)} linked: {links}")
    audit = ctx["audit"]
    lines.append("audit     " + ", ".join(f"{k} {len(v)}" for k, v in
                                          sorted(audit.items())))
    mi = ctx["markup_instructions"]
    closure = {}
    for status in mi["closure"].values():
        closure[status] = closure.get(status, 0) + 1
    lines.append(f"markup    {len(mi['instructions'])} instructions, "
                 f"{len(mi['unplaced'])} unplaced {mi['unplaced']}, "
                 f"closure {closure}")
    for letter, spec in ctx["markup_spec"].items():
        for sheet in spec["sheets"]:
            lines.append(f"spec {letter}  {sheet['seq']}. {sheet['name']}.pdf  "
                         f"{len(sheet['items'])} items  <- {sheet['source_pdf']}")
    gaps = [g for g in ctx["gaps"] if g.stage in ("S13", "S14")]
    lines.append(f"gaps      {len(gaps)}")
    for g in gaps[:12]:
        lines.append(f"  {g.stage} {g.subject:<10} {g.reason[:90]}")
    return "\n".join(lines)


def test_the_real_run_reconciles_and_places_its_schedule_rows():
    """Skipped silently where the run folder or its project is absent."""
    if not REAL_RUN.is_dir():
        return
    ctx = drive(REAL_RUN, Path(tempfile.mkdtemp(prefix="real-")))
    if ctx is None:
        return
    takeoff = ctx["takeoff"]
    for section in takeoff["sections"]:
        for item in section["items"]:
            assert sum(Decimal(l["squared"]) for l in item["lines"]) == \
                Decimal(item["quantity"])
    assert not any("does not reconcile" in g.reason for g in ctx["gaps"])
    mi = ctx["markup_instructions"]
    assert mi["instructions"], "the door schedule rows are locatable"
    assert all(i["primitive"] == "tag" for i in mi["instructions"])
    assert mi["closure"]
    assert set(mi["closure"].values()) <= {"CLOSED", "MARKUP_MISMATCH"}
    linked = [v for v in takeoff["drawing_links"].values() if v]
    assert linked and all(v.startswith("markup/") for v in linked)
    spec = ctx["markup_spec"]["H"]
    assert all(Path(s["source_pdf"]).is_file() for s in spec["sheets"])
    assert ctx["audit"]["AN.COVERAGE"], "elements and quantities are present"


if __name__ == "__main__":
    target = Path(sys.argv[1]) if len(sys.argv) > 1 else REAL_RUN
    driven = drive(target, target)
    if driven is None:
        print(f"cannot rebuild a ctx from {target} (run artefacts or the "
              f"project folder are missing)")
        raise SystemExit(2)
    print(summarise(driven))
