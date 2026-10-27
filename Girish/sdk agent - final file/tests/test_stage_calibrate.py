"""S4 calibrate and its S9 call-site, held in place.

A synthetic project of tiny PDFs drives _stage_calibrate end to end into a
temporary run folder; a synthetic ctx drives _stage_evidence with a level
table, a grid map and a tag. One test reads a real sheet read-only where the
package is on this machine and is skipped otherwise. Nothing is written into
any project folder.
"""
from __future__ import annotations

import json
import sys
import tempfile
import time
from decimal import Decimal
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

import agent  # noqa: E402
from agent import (_attach_s4, _reattach_aliased, _stage_calibrate,  # noqa: E402
                   _stage_evidence, stage_plan)
from measure.evidence import EvidenceBase  # noqa: E402
from measure.grid import GridMap  # noqa: E402
from measure.levels import Level, LevelTable  # noqa: E402
from spine.gaps import GapList  # noqa: E402
from spine.records import Element, Origin, SheetRecord, Tier, Word  # noqa: E402
from spine.runstate import DEFERRED, ORDER, RunState  # noqa: E402

REAL_PACKAGES = (Path("/Users/ajay/Documents/Projects/BOQ Test 2"),
                 Path("/Users/ajay/Documents/Projects/test boq"))


# ── builders ─────────────────────────────────────────────────────────────
def sheet(doc_id, tier=Tier.T2_VECTOR, scale="1:100", superseded_by=None,
          title="GROUND FLOOR PLAN"):
    return SheetRecord(doc_id=doc_id, file_sha256="", drawing_no=doc_id[:5],
                       title=title, revision="0", scale=scale, subtitle=None,
                       discipline="Structural", section="C", sheet_kind=None,
                       tier=tier, superseded_by=superseded_by)


def make_pdf(path: Path, lines):
    """A one-page PDF carrying the given (x, y, text) words."""
    import pymupdf
    doc = pymupdf.open()
    page = doc.new_page(width=842, height=595)
    for x, y, text in lines:
        page.insert_text((x, y), text, fontsize=10)
    doc.save(str(path))
    doc.close()


def project_with(names_and_words) -> Path:
    project = Path(tempfile.mkdtemp(prefix="s4proj-"))
    for name, words in names_and_words.items():
        make_pdf(project / name, words)
    return project


def ctx_for(project, sheets, **extra):
    ctx = {"project": project, "run": Path(tempfile.mkdtemp(prefix="s4run-")),
           "gaps": GapList(), "no_ai": True, "sheets": list(sheets),
           "config": None, "region": None, "limit": None}
    ctx.update(extra)
    return ctx


# SSL, not LVL: measure.levels drops SSL/FFL from a band as noise but not
# LVL (the contract names both); a band reading "GROUND FLOOR LVL" is not a
# storey to it. Owner A's module — noted, not worked around in code.
SECTION_WORDS = [(100, 100, "GROUND FLOOR SSL +0.000"),
                 (100, 200, "FIRST FLOOR SSL +4.500"),
                 (100, 300, "ROOF SSL +8.700")]


# ── the stage table and the run state ────────────────────────────────────
def test_s4_is_wired_and_no_longer_deferred():
    plan = stage_plan()
    fn, needs = plan["S4"]
    assert fn is _stage_calibrate
    assert needs == "measure.grid + measure.levels — scale, grid, level table"
    assert DEFERRED == set()
    assert ORDER.index("S3") < ORDER.index("S4") < ORDER.index("S5")


def test_run_state_requires_s4_before_s5():
    state = RunState(Path(tempfile.mkdtemp(prefix="state-")))
    state.begin("abc")
    for stage in ("S0", "S1", "S2", "S3"):
        state.enter(stage)
        state.exit(stage, 0, [])
    assert state.resume_from() == "S4"
    try:
        state.enter("S5")
    except RuntimeError as exc:
        assert "S4" in str(exc)
    else:
        raise AssertionError("S5 entered with S4 not run")
    state.enter("S4")
    state.exit("S4", 0, ["grids.json", "levels.json"])
    state.enter("S5")
    assert state.resume_from() == "S5"


# ── the stage ────────────────────────────────────────────────────────────
def test_stage_calibrate_writes_both_records_and_sets_the_ctx_keys():
    project = project_with({
        "S-201 SECTION.pdf": SECTION_WORDS,
        "S-101 PLAN.pdf": [(100, 100, "A"), (200, 100, "B"), (300, 100, "C")],
        "S-101 PLAN OLD.pdf": SECTION_WORDS,
        "S-900 RASTER.pdf": [],
    })
    sheets = [sheet("S-201 SECTION.pdf", title="SECTION A-A"),
              sheet("S-101 PLAN.pdf"),
              sheet("S-101 PLAN OLD.pdf", superseded_by="S-101 PLAN.pdf"),
              sheet("S-900 RASTER.pdf", tier=Tier.T4_RASTER),
              sheet("S-404 MISSING.pdf")]
    ctx = ctx_for(project, sheets)
    written = _stage_calibrate(ctx)
    assert written == ["grids.json", "levels.json"]

    grids = json.loads((ctx["run"] / "grids.json").read_text())
    assert set(grids) == {"S-201 SECTION.pdf", "S-101 PLAN.pdf"}, \
        "T2 only; superseded, raster and missing sheets are not calibrated"
    for doc_id, row in grids.items():
        assert row["doc_id"] == doc_id
        assert row["status"] in ("CALIBRATED", "PARTIAL", "NONE")
        assert row["mm_per_pt"] is None or isinstance(row["mm_per_pt"], str), \
            "Decimals are written as strings"
        assert set(row) >= {"W", "H", "rotation", "letters", "numbers",
                            "letters_axis", "scale_basis", "confidence",
                            "chain", "basis"}
    levels = json.loads((ctx["run"] / "levels.json").read_text())
    assert set(levels) >= {"levels", "conflicts"}
    assert {"GROUND", "FLOOR 1", "ROOF"} <= set(levels["levels"])
    assert levels["levels"]["FLOOR 1"]["value"] == "4.500"
    assert levels["conflicts"] == []

    assert set(ctx["grids"]) == set(grids)
    assert all(isinstance(g, GridMap) for g in ctx["grids"].values())
    assert isinstance(ctx["levels"], LevelTable)
    assert set(ctx["words_by_doc"]) == set(grids)
    assert all(isinstance(w, Word) for w in ctx["words_by_doc"]["S-201 SECTION.pdf"])
    assert ctx["scale_verified"] == {d: (grids[d]["status"] == "CALIBRATED")
                                     for d in grids}
    missing = [g for g in ctx["gaps"] if g.doc_id == "S-404 MISSING.pdf"]
    assert missing and "not found" in missing[0].reason


def test_stage_calibrate_survives_a_missing_grid_module_with_a_named_gap():
    import measure
    project = project_with({"S-201 SECTION.pdf": SECTION_WORDS})
    ctx = ctx_for(project, [sheet("S-201 SECTION.pdf")])
    saved_mod = sys.modules.get("measure.grid")
    saved_attr = getattr(measure, "grid", None)
    sys.modules["measure.grid"] = None            # import raises ImportError
    if saved_attr is not None:
        delattr(measure, "grid")
    try:
        written = _stage_calibrate(ctx)
    finally:
        if saved_mod is not None:
            sys.modules["measure.grid"] = saved_mod
        else:
            sys.modules.pop("measure.grid", None)
        if saved_attr is not None:
            setattr(measure, "grid", saved_attr)
    assert written == ["grids.json", "levels.json"]
    assert ctx["grids"] == {} and ctx["scale_verified"] == {}
    assert set(ctx["words_by_doc"]) == {"S-201 SECTION.pdf"}, \
        "words are still read — the level table does not need the grid"
    assert "FLOOR 1" in ctx["levels"].levels
    gap = next(g for g in ctx["gaps"] if g.stage == "S4" and g.subject == "grid")
    assert gap.reason == "S4 module measure.grid not present"
    assert json.loads((ctx["run"] / "grids.json").read_text()) == {}


def test_stage_calibrate_on_an_empty_register_writes_empty_records():
    ctx = ctx_for(Path(tempfile.mkdtemp(prefix="empty-")), [])
    assert _stage_calibrate(ctx) == ["grids.json", "levels.json"]
    assert ctx["grids"] == {} and ctx["words_by_doc"] == {}
    assert json.loads((ctx["run"] / "levels.json").read_text())["levels"] == {}


# ── the S9 call-site ─────────────────────────────────────────────────────
PLAN = "S-101 GROUND FLOOR PLAN.pdf"
PARTIAL = "S-102 FIRST FLOOR PLAN.pdf"
COLS = "S-501 COLUMN SCHEDULE.pdf"
BEAMS = "S-502 BEAM SCHEDULE.pdf"


def calibrated_grid(doc=PLAN):
    return GridMap(doc_id=doc, W=1000.0, H=700.0, rotation=0, status="CALIBRATED",
                   letters=[("A", 100.0), ("B", 300.0), ("C", 500.0), ("D", 700.0)],
                   numbers=[("1", 100.0), ("2", 300.0), ("3", 450.0)],
                   letters_axis="X", numbers_axis="Y", mm_per_pt=Decimal("10"),
                   scale_basis="dimension chain: 3 bays agree", confidence="HIGH",
                   chain=[2000, 2000, 2000], basis="test")


def level_table():
    return LevelTable(levels={
        "GROUND": Level("GROUND", Decimal("0.000"), [("S-201.pdf", "+0.000")], 2),
        "FLOOR 1": Level("FLOOR 1", Decimal("4.500"), [("S-201.pdf", "+4.500")], 2),
        "ROOF": Level("ROOF", Decimal("8.700"), [("S-201.pdf", "+8.700")], 1)})


def evidence_ctx():
    schedules = [
        {"doc_id": COLS, "title": "COLUMN SCHEDULE", "heading": "",
         "roles": ["mark", "width", "thickness", "location"],
         "rows": [{"mark": "C1", "values": {"width": "400", "thickness": "400",
                                            "location": "GROUND FLOOR"}},
                  {"mark": "C1", "values": {"width": "400", "thickness": "400",
                                            "location": "ROOF"}}]},
        {"doc_id": BEAMS, "title": "BEAM SCHEDULE", "heading": "",
         "roles": ["mark", "width", "thickness"],
         "rows": [{"mark": "B1", "values": {"width": "300", "thickness": "600"}},
                  {"mark": "B7", "values": {"width": "300", "thickness": "600"}}]},
    ]
    tag = Word(index=0, text="B1", x0=178, y0=186, x1=202, y1=194, doc_id=PLAN, page=0)
    return {"project": Path(tempfile.mkdtemp(prefix="s9proj-")),
            "run": Path(tempfile.mkdtemp(prefix="s9run-")), "gaps": GapList(),
            "no_ai": True, "config": None, "region": None,
            "schedules": schedules,
            "routing": [{"doc_id": PLAN, "kind": "plan"},
                        {"doc_id": PARTIAL, "kind": "plan"},
                        {"doc_id": COLS, "kind": "schedule"}],
            "levels": level_table(),
            "grids": {PLAN: calibrated_grid(),
                      PARTIAL: GridMap(doc_id=PARTIAL, W=1000.0, H=700.0,
                                       rotation=0, status="PARTIAL")},
            "words_by_doc": {PLAN: [tag], PARTIAL: []},
            "scale_verified": {PLAN: True, PARTIAL: False}}


def test_stage_evidence_attaches_heights_and_plan_lengths_and_flags_scale():
    ctx = evidence_ctx()
    written = _stage_evidence(ctx)
    assert written == ["evidence.json", "elements.json"]
    by = {(e.mark, e.location, e.bay): e for e in ctx["elements"]}
    assert set(by) == {("C1", "GROUND FLOOR", None), ("C1", "ROOF", None),
                       ("B1", None, "A/1"), ("B7", None, None)}
    base = ctx["base"]
    ground = by[("C1", "GROUND FLOOR", None)]
    assert ground.dims["length"] == "column:C1:GROUND:length"
    assert base.get(ground.dims["length"]).value == Decimal("4.50")
    assert base.get(ground.dims["length"]).origin is Origin.DERIVED
    assert "length" not in by[("C1", "ROOF", None)].dims, "top storey: no height"
    measured = by[("B1", None, "A/1")]
    assert measured.count == 1
    assert base.get(measured.dims["length"]).value == Decimal("2.00")
    assert base.get(measured.dims["length"]).origin is Origin.MEASURED
    assert "length" not in by[("B7", None, None)].dims

    out = json.loads((ctx["run"] / "elements.json").read_text())
    summary = out["summary"]
    assert summary["with_length"] == 2
    assert summary["derived_heights"] == 1 and summary["measured_lengths"] == 1
    assert summary["storeys"] == ["FLOOR 1", "GROUND", "ROOF"]
    rows = {(r["mark"], r["location"], r["bay"]) for r in out["elements"]}
    assert ("B1", None, "A/1") in rows and ("C1", "GROUND FLOOR", None) in rows

    assert "words_by_doc" not in ctx, "released after S9"
    assert PARTIAL in base._unverified_sheets and PLAN not in base._unverified_sheets
    reasons = [g.reason for g in ctx["gaps"] if g.stage == "S9"]
    assert any("no calibrated plan carries B7 (1 plans PARTIAL/NONE)" in r
               for r in reasons)
    # attach_heights' gaps carry measure.levels' own stage tag, whatever it is
    assert any(g.reason.startswith("no storey height for ROOF")
               and g.subject == "C1" for g in ctx["gaps"])


def test_stage_evidence_without_s4_outputs_records_gaps_and_still_builds():
    ctx = evidence_ctx()
    for key in ("levels", "grids", "words_by_doc", "scale_verified"):
        ctx.pop(key)
    _stage_evidence(ctx)
    assert {e.mark for e in ctx["elements"]} == {"C1", "B1", "B7"}
    reasons = {g.subject: g.reason for g in ctx["gaps"] if g.stage == "S9"
               and g.subject in ("storey heights", "plan lengths")}
    assert reasons["storey heights"].startswith("no level table from stage 4")
    assert reasons["plan lengths"].startswith("no grid maps from stage 4")
    summary = json.loads((ctx["run"] / "elements.json").read_text())["summary"]
    assert summary["with_length"] == 0 and summary["storeys"] == []


def test_reattach_aliased_uses_the_aliases_parameter_and_keeps_the_location():
    from measure import levels
    base = EvidenceBase()
    table = level_table()
    pod = Element(mark="C2", element_type="column", dims={}, count=1,
                  sheets=(COLS,), evidence_ids=(), location="Pod 1")
    other = Element(mark="C3", element_type="column", dims={}, count=1,
                    sheets=(COLS,), evidence_ids=(), location="GROUND")
    elements, gaps, marks = _reattach_aliased(levels, [other, pod], base, table,
                                              {"Pod 1": "GROUND"})
    assert marks == {"C2"}
    assert [e.mark for e in elements] == ["C3", "C2"], "order kept"
    assert elements[1].location == "Pod 1", "as written, not the alias"
    assert elements[1].dims["length"] == "column:C2:GROUND:length"
    assert base.get("column:C2:GROUND:length").value == Decimal("4.50")
    assert gaps == []
    assert elements[0] == other, "not aliased, not re-run"


def test_attach_s4_under_no_ai_leaves_the_unknown_storey_as_a_gap():
    ctx = evidence_ctx()
    base = EvidenceBase()
    pod = Element(mark="C2", element_type="column", dims={}, count=1,
                  sheets=(COLS,), evidence_ids=(), location="Pod 1")
    out = _attach_s4(ctx, base, [pod])
    assert out == [pod]
    gap = next(g for g in ctx["gaps"] if g.subject == "C2")
    assert gap.reason.startswith("storey 'Pod 1' not in the level table")
    assert "GROUND +0.000" in gap.reason


# ── a real sheet, read-only ──────────────────────────────────────────────
def test_the_real_package_calibrates_within_budget():
    """Skipped where neither package is on this machine. Reads three sheets
    of the first one present, writes only into a temporary run folder."""
    from spine.files import project_pdfs
    project = next((p for p in REAL_PACKAGES if p.is_dir()), None)
    if project is None:
        return
    pdfs = project_pdfs(project)[:3]
    if not pdfs:
        return
    sheets = [sheet(p.relative_to(project).as_posix(), scale=None, title=None)
              for p in pdfs]
    ctx = ctx_for(project, sheets)
    before = {p: p.stat().st_mtime for p in project.rglob("*") if p.is_file()}
    t0 = time.monotonic()
    written = _stage_calibrate(ctx)
    elapsed = time.monotonic() - t0
    after = {p: p.stat().st_mtime for p in project.rglob("*") if p.is_file()}
    assert before == after, "nothing under the project was touched"
    assert written == ["grids.json", "levels.json"]
    assert elapsed / max(1, len(sheets)) < 5.0, f"{elapsed:.1f}s for {len(sheets)}"
    grids = json.loads((ctx["run"] / "grids.json").read_text())
    assert set(grids) <= {s.doc_id for s in sheets}
    for row in grids.values():
        assert row["status"] in ("CALIBRATED", "PARTIAL", "NONE")
        if row["status"] == "CALIBRATED":
            assert Decimal(row["mm_per_pt"]) > 0
    assert set(ctx["scale_verified"]) == set(grids)
