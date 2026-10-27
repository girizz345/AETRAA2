"""S20 Render and S21 Revise, against a tiny synthetic run: one section, two
items, one generated drawing. No model, no network. LibreOffice is exercised
only when it is present."""
from __future__ import annotations

import json
import shutil
import sys
import tempfile
from decimal import Decimal
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from spine.gaps import GapList                                    # noqa: E402

SHEET_NAME = "1. A-100.pdf"


# ── fixture ────────────────────────────────────────────────────────────────
def _drawing(path: Path, rotation: int = 0) -> None:
    import pymupdf as fitz
    doc = fitz.open()
    page = doc.new_page(width=842, height=595)
    page.insert_text((60, 60), "A-100 SETTING OUT PLAN", fontsize=14)
    page.draw_rect(fitz.Rect(100, 100, 400, 300), color=(0, 0, 0))
    if rotation:
        page.set_rotation(rotation)
    path.parent.mkdir(parents=True, exist_ok=True)
    doc.save(str(path))
    doc.close()


def _fixture(root: Path, rotation: int = 0) -> dict:
    project = root / "project"
    run = root / "run"
    run.mkdir(parents=True)
    doc_id = "Drawings/A-100.pdf"
    _drawing(project / doc_id, rotation)

    takeoff = {
        "project": "Test Project", "descriptor": None,
        "drawing_links": {"A-100": f"markup/{SHEET_NAME}"},
        "sections": [{"letter": "C", "name": "CONCRETE WORK", "items": [
            {"code": "C-A", "clause_id": "C2.1", "element_mark": "S1",
             "description": "Reinforced concrete in suspended slabs", "unit": "m3",
             "quantity": "12.5",
             "lines": [{"ref": "A-100", "level": "L1", "desc": "slab S1", "nr": 1,
                        "L": 10, "W": 5, "H": 0.25, "qty_each": None, "location": None,
                        "evidence_ids": ["ev1", "ev2"], "method": "schedule cell",
                        "squared": "12.5"}]},
            {"code": "C-B", "clause_id": "C7.1", "element_mark": "PL1",
             "description": "Precast concrete lintels", "unit": "nr", "quantity": "4",
             "lines": [{"ref": "A-100", "level": "L1", "desc": "lintel PL1", "nr": 4,
                        "L": None, "W": None, "H": None, "qty_each": 1, "location": None,
                        "evidence_ids": ["ev3"], "method": "counted from plan",
                        "squared": "4"}]}]}],
        "audit": {"reconciliation": [["slab S1", "schedule", "12.5", "plan", "12.5",
                                      "agree", "schedule row"]],
                  "substantive": [["C-A", "as scheduled", "schedule cell", "-"]],
                  "coverage": [["C", "structural_schedule", 2, 2, "PASS"]]}}

    measurement = [
        {"kind": "element", "text": "Slabs"},
        {"kind": "item", "item_key": "C-A", "item_ref": "", "boq_page": "",
         "description": "Reinforced concrete in suspended slabs", "unit": "m3",
         "units": 1, "length": 10, "width": 5, "height": 0.25,
         "area": None, "volume": None, "qty": None,
         "dwg_ref": "A-100", "markup": SHEET_NAME},
        {"kind": "item", "item_key": "C-B", "item_ref": "", "boq_page": "",
         "description": "Precast concrete lintels", "unit": "nr",
         "units": None, "length": None, "width": None, "height": None,
         "area": None, "volume": None, "qty": 4,
         "dwg_ref": "A-100", "markup": SHEET_NAME}]

    house_spec = {
        "section_letter": "C", "section_title": "CONCRETE WORK",
        "pomi_section_title": "CONCRETE WORK", "bill_no": 2, "section_no": 1,
        "summary_ref": "S1", "sheet_name": "Section C", "project": "Test Project",
        "trade": "Concrete Work", "measurement": measurement,
        "boq_pages": [{"entries": [
            {"kind": "heading", "text": "Slabs"},
            {"kind": "item_group",
             "description": ["Reinforced concrete grade C40 in suspended slabs",
                             "including compaction and curing complete"],
             "items": [{"variant": "200mm thick", "item_key": "C-A", "unit": "m3",
                        "qty": 13, "rate": 850.0}]},
            {"kind": "item", "item_key": "C-B", "unit": "nr", "qty": 4,
             "description": "Precast concrete lintels", "rate": None}]}]}

    bill = {
        "bill_no": 2, "project": "Test Project",
        "sections": [{"letter": "C", "title": "CONCRETE WORK",
                      "pomi_section_title": "CONCRETE WORK", "section_no": 1,
                      "lines": [
                          {"ref": "C-A", "item_letter": "A", "page": "2/1/1",
                           "description": "Reinforced concrete in suspended slabs, 200mm thick",
                           "quantity": "12.5", "unit": "m3", "rate": None,
                           "rate_source": None, "clause_id": "C2.1",
                           "evidence_ids": ["ev1", "ev2"], "is_variant_of": None},
                          {"ref": "C-B", "item_letter": "B", "page": "2/1/1",
                           "description": "Precast concrete lintels",
                           "quantity": "4", "unit": "nr", "rate": None,
                           "rate_source": None, "clause_id": "C7.1",
                           "evidence_ids": ["ev3"], "is_variant_of": None}],
                      "pages": [{"reference": "2/1/1", "item_count": 2}],
                      "last_page_ref": "2/1/1", "total": "0"}],
        "nonmeasured": [],
        "house_specs": {"C": house_spec},
        "summary": [{"section": "C", "last_page_ref": "2/1/1"}]}

    markup_spec = {"C": {
        "project": "Test Project", "building": "", "section_letter": "C",
        "section_title": "CONCRETE WORK", "group": "Concrete Work",
        "sheets": [{"seq": 1, "name": "A-100",
                    "source_pdf": str(project / doc_id), "source_page": 0,
                    "drawing_no": "A-100", "filename": "A-100.pdf",
                    "items": [{"label": "C-A", "qty": 12.5, "unit": "m3",
                               "colour": "#3FBFD4", "kind": "area",
                               "regions": [[[100, 100], [400, 100], [400, 300], [100, 300]]]},
                              {"label": "C-B", "qty": 4, "unit": "nr",
                               "colour": "#E0A020", "kind": "tag",
                               "regions": [[[120, 120], [380, 120], [120, 280], [380, 280]]]}]}]}}

    priced = {"rows": [{"ref": "C-A", "section": "C", "rate_class": "C.concrete",
                        "unit": "m3", "quantity": "12.5", "rate": None, "amount": None,
                        "citation": None, "flags": ["NO_RATE"], "failures": []},
                       {"ref": "C-B", "section": "C", "rate_class": "C.lintel",
                        "unit": "nr", "quantity": "4", "rate": None, "amount": None,
                        "citation": None, "flags": ["NO_RATE"], "failures": []}],
              "failures": [], "flags": [], "rates": {}, "searched": 0, "no_ai": True}
    evidence = {"schema": "evidence/1", "records": [
        {"id": "ev1", "value": "10", "unit": "m", "doc_id": doc_id, "origin": "stated", "region": None},
        {"id": "ev2", "value": "0.25", "unit": "m", "doc_id": doc_id, "origin": "inferred", "region": None},
        {"id": "ev3", "value": "4", "unit": "nr", "doc_id": doc_id, "origin": "counted", "region": None}]}
    register = {"schema": "register/1", "sheets": [{"doc_id": doc_id, "drawing_no": "A-100"}]}

    for name, data in (("takeoff.json", takeoff), ("bill.json", bill),
                       ("markup_spec.json", markup_spec), ("priced.json", priced),
                       ("evidence.json", evidence), ("register.json", register),
                       ("house_measurement.json", {"C": house_spec})):
        (run / name).write_text(json.dumps(data, indent=1, sort_keys=True))
    (run / "summary.json").write_text(json.dumps({"project": str(project)}))
    return {"root": root, "project": project, "run": run, "takeoff": takeoff,
            "bill": bill, "markup_spec": markup_spec}


def _ctx(fx: dict, **extra) -> dict:
    ctx = {"project": fx["project"], "run": fx["run"], "gaps": GapList(),
           "no_ai": True, "no_recalc": True, "takeoff": fx["takeoff"],
           "bill": fx["bill"], "markup_spec": fx["markup_spec"]}
    ctx.update(extra)
    return ctx


# ── the writers ────────────────────────────────────────────────────────────
def test_takeoff_workbook_tabs():
    from openpyxl import load_workbook
    from render import takeoff_workbook
    with tempfile.TemporaryDirectory() as td:
        fx = _fixture(Path(td))
        out = fx["run"] / "takeoff.xlsx"
        counts = takeoff_workbook.write(fx["takeoff"], out)
        names = load_workbook(out).sheetnames
        assert names[0] == "INDEX"
        assert "C. CONCRETE WORK" in names
        assert names[-3:] == ["AN.RECONCILIATION", "AN.SUBSTANTIVE", "AN.COVERAGE"]
        assert counts["sections"] == 1 and counts["items"] == 2 and counts["rows"] == 2
        ws = load_workbook(out)["C. CONCRETE WORK"]
        assert ws["A4"].hyperlink is not None                # R34 DWG-Ref link
        assert str(ws["J4"].value).startswith("=")           # live Tot.


def test_takeoff_workbook_refuses_unreconciled():
    from render import takeoff_workbook
    with tempfile.TemporaryDirectory() as td:
        fx = _fixture(Path(td))
        bad = json.loads(json.dumps(fx["takeoff"]))
        bad["sections"][0]["items"][0]["quantity"] = "99"
        try:
            takeoff_workbook.write(bad, fx["run"] / "t.xlsx")
        except ValueError as exc:
            assert "C-A" in str(exc)
        else:
            raise AssertionError("an unreconciled take-off was written")


def test_markups_named_for_dwg_ref_and_legend_index():
    from render import markup_pdf
    with tempfile.TemporaryDirectory() as td:
        fx = _fixture(Path(td))
        out = fx["run"] / "markup"
        result = markup_pdf.render(fx["markup_spec"], fx["project"], out)
        assert (out / SHEET_NAME).is_file()
        assert (out / markup_pdf.LEGEND_FILENAME).is_file()
        assert result["sheets"] == 1 and result["items"] == 2
        assert result["problems"] == [] and result["derotated"] == []


def test_a_sheet_marked_in_two_sections_keeps_both_sections_pages():
    import copy

    import pymupdf as fitz
    from render import markup_pdf
    with tempfile.TemporaryDirectory() as td:
        fx = _fixture(Path(td))
        spec = copy.deepcopy(fx["markup_spec"])
        other = copy.deepcopy(spec["C"])
        other.update({"section_letter": "M", "section_title": "Floor finishes",
                      "group": "Floor finishes"})
        spec["M"] = other
        out = fx["run"] / "markup"
        result = markup_pdf.render(spec, fx["project"], out)
        assert result["written"] == [SHEET_NAME] and result["problems"] == []
        with fitz.open(out / SHEET_NAME) as doc:
            assert doc.page_count == 2            # section C's page was overwritten before
        assert not (out / "_parts").exists()


def test_markups_on_a_rotated_sheet_are_derotated():
    import pymupdf as fitz
    from render import markup_pdf
    with tempfile.TemporaryDirectory() as td:
        fx = _fixture(Path(td), rotation=90)
        result = markup_pdf.render(fx["markup_spec"], fx["project"], fx["run"] / "markup")
        assert result["derotated"] and "90" in result["derotated"][0]
        # closed before the temporary folder goes: Windows will not delete an
        # open file, so an unclosed handle failed this test there
        with fitz.open(str(fx["run"] / "markup" / SHEET_NAME)) as doc:
            assert doc[0].rect.width > 0


def test_invert_rotation_is_pymupdf_inverse():
    import pymupdf as fitz
    from render.markup_pdf import invert_rotation
    doc = fitz.open()
    for rot in (0, 90, 180, 270):
        page = doc.new_page(width=800, height=500)
        page.set_rotation(rot)
        w, h = page.rect.width, page.rect.height
        for pt in ((10, 20), (400, 30), (33, 400)):
            expected = fitz.Point(*pt) * page.derotation_matrix
            got = invert_rotation([pt], rot, w, h)[0]
            assert abs(expected.x - got[0]) < 1e-6 and abs(expected.y - got[1]) < 1e-6


def test_boq_workbook_sheets_and_formulas():
    from openpyxl import load_workbook
    from render import boq_workbook, markup_pdf
    with tempfile.TemporaryDirectory() as td:
        fx = _fixture(Path(td))
        markup_pdf.render(fx["markup_spec"], fx["project"], fx["run"] / "markup")
        out = fx["run"] / "bill.xlsx"
        result = boq_workbook.write(fx["bill"], out, "markup", recalc=False)
        wb = load_workbook(out)
        # the bill is Summary + one sheet per section, opening on the Summary;
        # the measurement lives in the take-off workbook, not here
        assert wb.sheetnames == ["Summary", "Section C"]
        assert wb.active.title == "Summary"
        ws = wb["Section C"]
        assert ws["D61"].value == "To Collection"
        assert str(ws["H61"].value).startswith("=SUM(H10:H55)")
        # COLLECTION page: TOTAL FOR ... / CARRIED TO SUMMARY, a formula
        total_row = result["totals"][0]["total_row"]
        assert str(ws.cell(total_row - 1, 3).value).startswith("TOTAL FOR BILL NO. 2/1/2")
        assert ws.cell(total_row, 3).value == "CARRIED TO SUMMARY  - S1"
        assert str(ws.cell(total_row, 8).value).startswith("=SUM(")
        # quantities are STATED on the page (house ROUNDUP), letters A then B
        letters = [ws.cell(r, 1).value for r in range(10, 56)
                   if isinstance(ws.cell(r, 1).value, str) and len(ws.cell(r, 1).value) == 1]
        assert letters == ["A", "B"]
        qtys = [c.value for row in ws.iter_rows(min_col=5, max_col=5) for c in row
                if isinstance(c.value, (int, float))]
        assert qtys == [13, 4]
        # body rows only — the head band carries the bill number in G3
        rates = [c.value for row in ws.iter_rows(min_row=10, max_row=55, min_col=7, max_col=7)
                 for c in row if isinstance(c.value, (int, float))]
        assert rates == [850.0]                      # C-B has no rate: blank, not 0
        # the UNPRICED twin: identical pages, every rate blank
        out_u = fx["run"] / "bill_unpriced.xlsx"
        boq_workbook.write(fx["bill"], out_u, "markup", recalc=False, priced=False)
        wu = load_workbook(out_u)
        assert wu.sheetnames == ["Summary", "Section C"]
        wsu = wu["Section C"]
        assert [c.value for row in wsu.iter_rows(min_col=5, max_col=5) for c in row
                if isinstance(c.value, (int, float))] == [13, 4]
        assert not any(isinstance(c.value, (int, float))
                       for row in wsu.iter_rows(min_row=10, max_row=55, min_col=7, max_col=7)
                       for c in row)
        # Summary links to the section's TOTAL FOR cell
        summ = wb["Summary"]
        assert summ["D1"].value == "SUMMARY"
        assert summ["C4"].value == "2/1/2" and summ["D4"].value == "CONCRETE WORK"
        assert summ["H4"].value == f"='Section C'!H{total_row}"
        assert summ["C7"].value == "TOTAL CARRIED TO FORM OF TENDER"
        # gates ran and were reported, not raised
        g = result["gates"]
        assert g["recalculate"].startswith("skipped")
        assert g["verify_template"]["returncode"] == 0, g["verify_template"]["output"]
        assert g["verify_sections"]["returncode"] == 0, g["verify_sections"]["output"]
        assert any("DO NOT ISSUE" in p for p in result["problems"])


def test_boq_workbook_recalc_and_format_gate_with_libreoffice():
    """Only where LibreOffice is installed; skipped cleanly otherwise."""
    if not (shutil.which("soffice") or shutil.which("libreoffice")):
        return
    from openpyxl import load_workbook
    from render import boq_workbook, markup_pdf
    with tempfile.TemporaryDirectory() as td:
        fx = _fixture(Path(td))
        markup_pdf.render(fx["markup_spec"], fx["project"], fx["run"] / "markup")
        out = fx["run"] / "bill.xlsx"
        result = boq_workbook.write(fx["bill"], out, "markup", recalc=True)
        g = result["gates"]
        assert g["recalculate"] == "ok" and result["recalculated"]
        assert str(g["verify"]).startswith("ok"), g["verify"]
        assert g["verify_template"]["returncode"] == 0, g["verify_template"]["output"]
        assert g["verify_sections"]["returncode"] == 0, g["verify_sections"]["output"]
        assert result["problems"] == []
        vals = load_workbook(out, data_only=True)["Section C"]
        amounts = [c.value for row in vals.iter_rows(min_col=8, max_col=8)
                   for c in row if isinstance(c.value, (int, float)) and c.value]
        assert 13 * 850 in amounts                 # 13 m3 x 850 recalculated


def test_boq_workbook_page_overflow_is_a_spec_fault():
    from render import boq_workbook
    with tempfile.TemporaryDirectory() as td:
        fx = _fixture(Path(td))
        bill = json.loads(json.dumps(fx["bill"]))
        page = bill["house_specs"]["C"]["boq_pages"][0]
        page["entries"] = [{"kind": "item", "item_key": "C-B", "unit": "nr",
                            "description": "Precast concrete lintels", "rate": None}] * 30
        try:
            boq_workbook.write(bill, fx["run"] / "b.xlsx", "markup", recalc=False)
        except ValueError as exc:
            assert "overflows" in str(exc)
        else:
            raise AssertionError("an overflowing page was rendered")


def test_provenance_one_row_per_line_weakest_origin():
    from openpyxl import load_workbook
    from render import provenance
    with tempfile.TemporaryDirectory() as td:
        fx = _fixture(Path(td))
        problems: list[str] = []
        rows = provenance.build(fx["run"], problems)
        assert [r.bill_ref for r in rows] == ["C-A", "C-B"]
        assert rows[0].basis == provenance.BASIS_LABELS["inferred"]   # ev2 is inferred
        assert rows[1].basis == provenance.BASIS_LABELS["counted"]
        assert rows[0].drawings == ("A-100",)
        assert problems == []
        out = fx["run"] / "provenance.xlsx"
        provenance.write(rows, out)
        ws = load_workbook(out).active
        assert [c.value for c in ws[1]] == list(provenance.COLUMNS)
        assert ws.max_row == 3
        assert ws["A1"].font.name == "Arial"
        # a line with no evidence is a recorded halt, not a crash
        bill = json.loads((fx["run"] / "bill.json").read_text())
        bill["sections"][0]["lines"][1]["evidence_ids"] = []
        takeoff = json.loads((fx["run"] / "takeoff.json").read_text())
        takeoff["sections"][0]["items"][1]["lines"][0]["evidence_ids"] = []
        (fx["run"] / "bill.json").write_text(json.dumps(bill))
        (fx["run"] / "takeoff.json").write_text(json.dumps(takeoff))
        problems = []
        rows = provenance.build(fx["run"], problems)
        assert rows[1].basis == provenance.UNTRACED and len(problems) == 1


def test_revise_first_issue_marks_every_line_added():
    from render import revise
    with tempfile.TemporaryDirectory() as td:
        fx = _fixture(Path(td))
        changes = revise.diff([], revise.flatten(fx["bill"]))
        assert [c.status for c in changes] == ["ADDED", "ADDED"]
        assert all(c.previous is None and c.difference is None for c in changes)


def test_revise_diff_changed_omitted_unchanged():
    from render import revise
    with tempfile.TemporaryDirectory() as td:
        fx = _fixture(Path(td))
        prev = revise.flatten(fx["bill"])
        cur = json.loads(json.dumps(prev))
        cur[0]["quantity"] = "15.0"
        cur[0]["item_letter"] = "C"                 # letters shift: not a change
        cur.append({"section": "C", "ref": "C-C", "clause_id": "C9.1",
                    "description": "Concrete kerbs", "quantity": "8", "unit": "m"})
        cur.pop(1)
        changes = {c.description: c for c in revise.diff(prev, cur)}
        assert changes["Reinforced concrete in suspended slabs, 200mm thick"].status == "CHANGED"
        assert changes["Reinforced concrete in suspended slabs, 200mm thick"].difference == Decimal("2.5")
        assert changes["Precast concrete lintels"].status == "OMITTED"
        assert changes["Concrete kerbs"].status == "ADDED"


# ── the stages ─────────────────────────────────────────────────────────────
def test_hygiene_violation_becomes_a_gap_not_a_rewrite():
    from stages_render import hygiene_gaps, user_facing_strings
    with tempfile.TemporaryDirectory() as td:
        fx = _fixture(Path(td))
        takeoff = json.loads(json.dumps(fx["takeoff"]))
        takeoff["sections"][0]["items"][0]["description"] = "see extract.py for details"
        gaps = hygiene_gaps(user_facing_strings(takeoff, fx["bill"], fx["markup_spec"]))
        assert len(gaps) == 1 and gaps[0].stage == "S20"
        assert "'.py'" in gaps[0].reason
        assert takeoff["sections"][0]["items"][0]["description"] == "see extract.py for details"
        assert hygiene_gaps(user_facing_strings(fx["takeoff"], fx["bill"], fx["markup_spec"])) == []


def test_stage_render_order_and_render_json():
    from stages_render import _stage_render
    with tempfile.TemporaryDirectory() as td:
        fx = _fixture(Path(td))
        ctx = _ctx(fx)
        written = _stage_render(ctx)
        run = fx["run"]
        for name in ("takeoff.xlsx", "bill.xlsx", "bill_unpriced.xlsx", "provenance.xlsx",
                     "render.json", f"markup/{SHEET_NAME}", "markup/00-LEGEND-INDEX.pdf"):
            assert name in written and (run / name).is_file(), name
        render = json.loads((run / "render.json").read_text())
        assert render["blocked"] is False and render["recalculated"] is False
        assert render["gates"]["bill"]["sheets"] == ["Summary", "Section C"]
        assert render["gates"]["bill_unpriced"]["sheets"] == ["Summary", "Section C"]
        assert render["gates"]["bill"]["gates"]["verify_template"]["returncode"] == 0
        # the issued take-off is INDEX + section tabs; the AN audit stays in audit.json
        from openpyxl import load_workbook
        names = load_workbook(run / "takeoff.xlsx").sheetnames
        assert names[0] == "INDEX" and not any(n.startswith("AN.") for n in names)
        assert render["gates"]["takeoff"]["audit_tabs"] == 0
        reasons = [g.reason for g in ctx["gaps"]]
        assert any("DO NOT ISSUE" in r for r in reasons)          # --no-recalc draft


def test_a_failed_completeness_gate_issues_a_partial_bill_that_says_so():
    """CR-01 §7: the gate is not narrowed (the FAIL stays recorded), but the
    sections that were measured issue as a PARTIAL bill, and coverage.txt
    names every required section it lacks and why."""
    from bill.completeness import Finding, coverage
    from stages_render import PARTIAL, _stage_render
    findings = [Finding("door_schedule", 3, "H", 12, None),
                Finding("external_area", 1, "B", 0, None),
                Finding("wet_room", 4, "G", 0, None),
                Finding("unread_schedule A-501", 1, "H", 0, None,
                        reason="door schedule A-501 is in the package and was not read")]
    cov = coverage(findings, {"H": 12})
    assert [m["why"] for m in cov["missing"]] == ["not yet measured by this version",
                                                    "not measured from the plans in this run",
                                                    "schedule not read"]
    with tempfile.TemporaryDirectory() as td:
        fx = _fixture(Path(td))
        ctx = _ctx(fx, completeness_blocked=True,
                   completeness={"blocked": True, "coverage": cov})
        written = _stage_render(ctx)
        assert "bill.xlsx" in written and (fx["run"] / "bill.xlsx").exists()
        assert "coverage.txt" in written
        text = (fx["run"] / "coverage.txt").read_text(encoding="utf-8")
        assert "THIS BILL IS PARTIAL" in text and "A-501" in text
        assert "NOT YET MEASURED BY THIS VERSION" in text
        assert any(g.reason == PARTIAL for g in ctx["gaps"])
        render = json.loads((fx["run"] / "render.json").read_text())
        assert render["blocked"] is True and render["partial"] is True


def test_a_complete_bill_says_it_is_complete():
    from bill.completeness import Finding, coverage, coverage_text
    cov = coverage([Finding("door_schedule", 3, "H", 12, None)], {"H": 12})
    assert cov["complete"] and "PARTIAL" not in coverage_text(cov, "COVERAGE")


def test_stage_revise_first_issue():
    from openpyxl import load_workbook
    from stages_render import _stage_render, _stage_revise
    with tempfile.TemporaryDirectory() as td:
        fx = _fixture(Path(td))
        ctx = _ctx(fx)
        _stage_render(ctx)
        written = _stage_revise(ctx)
        assert written[0] == "revision_changes.json"
        payload = json.loads((fx["run"] / "revision_changes.json").read_text())
        assert payload["first_issue"] is True and payload["previous_run"] is None
        assert payload["summary"] == {"ADDED": 2, "OMITTED": 0, "CHANGED": 0, "UNCHANGED": 0}
        # the comparison stays in the working record; the issued bill carries
        # no REVISION CHANGES sheet
        wb = load_workbook(fx["run"] / "bill.xlsx")
        assert wb.sheetnames == ["Summary", "Section C"]
        assert written == ["revision_changes.json"]


def test_stage_revise_against_previous_run_of_same_project():
    from stages_render import _stage_render, _stage_revise, find_previous_run
    with tempfile.TemporaryDirectory() as td:
        root = Path(td)
        fx = _fixture(root / "a")
        # a previous run of the same project, sibling under the same runs root
        prev = fx["run"].parent / "prev_run"
        shutil.copytree(fx["run"], prev)
        prev_bill = json.loads((prev / "bill.json").read_text())
        prev_bill["sections"][0]["lines"][0]["quantity"] = "10"
        (prev / "bill.json").write_text(json.dumps(prev_bill))
        (prev / "summary.json").write_text(json.dumps(
            {"project": str(fx["project"]), "utc": "2026-01-01T00:00:00+00:00"}))
        assert find_previous_run(fx["run"], str(fx["project"]), [fx["run"].parent]) == prev
        ctx = _ctx(fx)
        _stage_render(ctx)
        _stage_revise(ctx)
        payload = json.loads((fx["run"] / "revision_changes.json").read_text())
        assert payload["previous_run"] == "prev_run"
        assert payload["summary"]["CHANGED"] == 1 and payload["summary"]["UNCHANGED"] == 1
        changed = [c for c in payload["changes"] if c["status"] == "CHANGED"][0]
        assert changed["previous"] == "10" and changed["current"] == "12.5"
        assert changed["difference"] == "2.5"
