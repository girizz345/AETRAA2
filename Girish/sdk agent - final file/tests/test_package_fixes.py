#!/usr/bin/env python3
"""
Fixes from the Coventry Residence 3 test run (102 sheets, EMSQUARE title block),
reported 26-09-2026: no BOQ issued, 162 gaps.

  * S1: the EMSQUARE block puts labels on one row and values beneath, spelled
    out in full (DRAWING NO. / DRAWING TITLE / REVISION NO.), so no spec
    matched and numbers came from file names - where "A-13-001" was cut to
    "A-13" and then demoted as a shared project code.
  * S1/S7: STRUCTURE Sheet NN.pdf carries no number as text; its folder names
    the discipline.
  * S5: the list of drawings and perspectives are never measured.
  * S6: the title block's revision table was read as the schedule; the real
    schedules are drawn as graphics and now say so, with their type tags.
"""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from ingest.discipline_matrix import DisciplineMatrix           # noqa: E402
from ingest.titleblocks import PatternSet                        # noqa: E402
from readers.register import number_from_filename                # noqa: E402
from readers.route import route                                  # noqa: E402
from readers.titleblock import outside_block, read_fields        # noqa: E402
from spine.records import Word                                   # noqa: E402

PATTERNS = PatternSet.load(ROOT / "data" / "titleblocks.json")
DRAWINGS = ROOT.parent / "Test Drawigs"


def _row(y, *cells):
    """Words on one row: (x, text) pairs, 7pt high."""
    return [Word(0, t, x, y, x + 6 * len(t), y + 7, "t", 0) for x, t in cells]


def _emsquare_block(number="A-07-003", title=("GROUND FLOOR PLAN",)):
    """The EMSQUARE right-hand strip, bottom rows, on a 2384 x 1684 sheet."""
    x0, x1, x2 = 2100, 2170, 2290
    words = _row(1470, (x0, "DRAWING"), (x0 + 50, "TITLE"), (x0 + 84, ":"))
    for i, line in enumerate(title):
        words += _row(1487 + 17 * i, (x0 + 20, line))
    y = 1487 + 17 * len(title) + 8
    words += _row(y, (x0, "ARCHITECT"), (x0 + 58, ":"), (x1, "STRUCTURAL"), (x1 + 66, "ENGR."),
                  (x1 + 100, ":"), (x2, "DRAWN"), (x2 + 36, ":"))
    words += _row(y + 17, (x0 + 10, "SMITHA"), (x2, "SHAFI"))
    words += _row(y + 40, (x0, "SCALE"), (x0 + 34, ":"), (x1, "DATE"), (x1 + 28, ":"),
                  (x2, "CHECKED"), (x2 + 45, "BY"), (x2 + 60, ":"))
    words += _row(y + 57, (x0 + 5, "1:150"), (x1 - 8, "JUN-2025"), (x2, "BABU"))
    words += _row(y + 80, (x0, "JOB"), (x0 + 22, "NO"), (x0 + 36, ":"), (x1, "DRAWING"),
                  (x1 + 48, "NO."), (x1 + 68, ":"), (x2, "REVISION"), (x2 + 50, "NO."), (x2 + 70, ":"))
    words += _row(y + 97, (x0 + 5, "___"), (x1 + 10, number), (x2 + 10, "--"))
    return words


def test_the_labels_over_values_block_is_read():
    read = read_fields(_emsquare_block(), 2384, 1684, "t", PATTERNS)
    assert read.spec_name == "tabular-labels-over-values"
    assert read.fields["drawing_no"] == "A-07-003"
    assert read.fields["title"] == "GROUND FLOOR PLAN"
    assert read.fields["scale"] == "1:150"            # not "1:150 JUN-2025"
    assert "revision" not in read.fields              # "--" is no revision


def test_a_two_line_title_starting_on_the_label_row_is_whole():
    words = _emsquare_block("A-12-006", ())
    words += _row(1470, (2190, "U.GROUND"), (2250, "WATER"))       # beside DRAWING TITLE :
    words += _row(1487, (2123, "TANK&PUMP"), (2203, "ROOM"), (2245, "DETAILS"))
    read = read_fields(words, 2384, 1684, "t", PATTERNS)
    assert read.fields["title"] == "U.GROUND WATER TANK&PUMP ROOM DETAILS"


def test_the_floor_multiplier_comes_from_the_sheet_title():
    read = read_fields(_emsquare_block("A-07-007", ("TYP ( 4 - 5 ) FLOOR PLAN",)),
                       2384, 1684, "t", PATTERNS)
    assert read.fields["subtitle"] == "TYP ( 4 - 5 )"


def test_a_date_is_never_a_drawing_number():
    words = _row(1500, (2100, "SCALE"), (2140, ":"), (2170, "DATE"), (2200, ":"))
    words += _row(1517, (2100, "1:100"), (2170, "JUN-2025"))
    read = read_fields(words, 2384, 1684, "t", PATTERNS)
    assert read.fields.get("drawing_no") != "JUN-2025"


def test_the_whole_number_is_kept_from_the_file_name():
    assert number_from_filename("A-13-001 SCHEDULE OF DOORS.pdf") == "A-13-001"
    assert number_from_filename("A-504 SCHEDULE OF DOORS -04.pdf") == "A-504"
    assert number_from_filename("620DXB24-MIM-XXX-S-601-T0.pdf") == "620DXB24-MIM-XXX-S-601-T0"
    assert number_from_filename("S-201-FOUNDATION-PLAN.pdf") == "S-201"
    assert number_from_filename("Structure/STRUCTURE Sheet 05.pdf") == "STRUCTURE-SHEET-05"


def test_the_folder_names_the_discipline_when_the_number_does_not():
    m = DisciplineMatrix.load()
    row, basis = m.resolve_for(None, "Structure/STRUCTURE Sheet 05.pdf")
    assert row.discipline == "Structural" and basis == "folder 'Structure'"
    row, basis = m.resolve_for("WS-03", "PLUMBING/WS-03 GROUND FLOOR PLAN.pdf")
    assert row.discipline == "Plumbing"
    row, basis = m.resolve_for("A-07-003", "Structure/odd.pdf")
    assert row.discipline == "Architectural" and basis == "drawing number"   # the prefix wins
    assert m.resolve_for(None, "misc/x.pdf") == (None, None)


def test_sheets_never_measured_are_routed_as_general():
    assert route("LIST OF DRAWINGS", "A-01-001 LIST OF DRAWINGS.pdf")[0] == "general"
    assert route("PERSPECTIVES", "x.pdf")[0] == "general"
    # a cover sheet's heading lists the set ("... DETAILS") - the file name wins
    assert route(None, "A-00-001 COVERSHEET.pdf", "STAIR DETAILS")[0] == "general"
    assert route("SCHEDULE OF DOORS", "A-13-001 SCHEDULE OF DOORS.pdf")[0] == "schedule"


def test_the_title_block_is_cut_away_before_a_table_is_looked_for():
    words = _row(100, (300, "DW"), (900, "DW")) + _row(1500, (2200, "DATE"), (2260, "DESCRIPTION"))
    kept = outside_block(words, ("x", 2089.3))
    assert [w.text for w in kept] == ["DW", "DW"]
    assert outside_block(words, None) == words


def test_a_graphic_schedule_reports_its_type_tags():
    import agent
    words = (_row(83, (653, "DW"), (1264, "DW")) + _row(92, (655, "01"), (1266, "02"))
             + _row(300, (500, "NOTE:"), (540, "ALL"), (560, "TIMBER")))
    tags = agent._type_tags(words, "t", "A-13-002")
    assert tags == ["DW 01", "DW 02"]
    assert agent._is_graphic(words, tags) and not agent._has_values(words)
    table = words + _row(400, (500, "900x2100")) + _row(420, (500, "1200")) + _row(440, (500, "12"), (520, "NOS"))
    assert agent._has_values(table)


def test_on_the_real_package_when_it_is_here():
    """The sheets from the report, read end to end (skipped where the drawings
    are not beside the agent)."""
    sched = DRAWINGS / "Architecture" / "A2" / "A-13-002 SCHEDULE OF WINDOWS-01.pdf"
    if not sched.exists():
        return
    import agent
    from readers.extract import extract_words
    from readers.titleblock import block_edge, read_sheet
    read = read_sheet(sched, PATTERNS)
    assert read.fields["drawing_no"] == "A-13-002"
    words = extract_words(sched, 0)
    edge = block_edge(sched, words, "A-13-002")
    assert edge and edge[0] == "x"
    body = outside_block(words, edge)
    assert not any(w.text == "DESCRIPTION" for w in body)            # the revision table is gone
    tags = agent._type_tags(body, "A-13-002", "A-13-002")
    assert tags[:3] == ["DW 01", "DW 02", "DW 03"] and "DW 12" in tags


def test_a_lone_cross_reference_away_from_the_block_is_not_a_drawing_number():
    """'REFER DRG NO.S-05_2' in a note in the LEFT margin of a sheet whose own
    block has no number as text: seven structure sheets were named S-05_2."""
    words = _row(589, (292, "REFER"), (330, "DRG"), (360, "NO.S-05_2"))
    read = read_fields(words, 1684, 1191, "t", PATTERNS)
    assert read.fields.get("drawing_no") != "S-05_2"
    # the real block in its declared place still reads, lone number or not
    assert read_fields(_emsquare_block(), 2384, 1684, "t", PATTERNS).fields["drawing_no"] == "A-07-003"


def test_a_sheet_takes_its_series_kind_when_the_series_agrees():
    """A-07-001 'UNDER GROUND WATER TANK & PUMP ROOM' names no kind; its eight
    A-07 siblings are all plans by their own titles."""
    import tempfile
    import agent
    from spine.gaps import GapList
    from spine.records import SheetRecord, Tier

    def sheet(no, title):
        return SheetRecord(doc_id=f"A1/{no}.pdf", file_sha256="", drawing_no=no, title=title,
                           revision=None, scale=None, subtitle=None, discipline="Architectural",
                           section=None, sheet_kind=None, tier=Tier.T2_VECTOR)

    sheets = [sheet("A-07-001", "UNDER GROUND WATER TANK & PUMP ROOM")]
    sheets += [sheet(f"A-07-00{i}", f"FLOOR {i} PLAN") for i in (3, 4, 5)]
    sheets += [sheet("A-12-001", "WATER TANK"), sheet("A-12-002", "STAIR DETAIL"), sheet("A-12-003", "LIFT PLAN")]
    with tempfile.TemporaryDirectory() as td:
        ctx = {"sheets": sheets, "gaps": GapList(), "run": Path(td), "no_ai": True}
        agent._stage_route(ctx)
    kinds = {r["drawing_no"]: (r["kind"], r["basis"]) for r in ctx["routing"]}
    assert kinds["A-07-001"][0] == "plan" and kinds["A-07-001"][1].startswith("drawing series A-07")
    # a series that does not agree (a detail and a plan) decides nothing
    assert kinds["A-12-001"][0] is None


# ---- transcription: drawn values read off the sheet, never measured -----------

def test_a_drawn_schedule_card_becomes_a_row_the_agent_reads():
    from readers.transcribe import schedule_rows
    rows = schedule_rows({"rows": [
        {"mark": "D-1", "type": "HINGED DOOR", "size": "1200X2200", "shown_size": "",
         "location": "STAIRCASE", "count": 20, "description": "5CM SOLID PANEL"},
        {"mark": "DW 06", "type": "FIXED", "size": "AS SHOWN", "shown_size": "3750 x 3200",
         "location": "", "count": 4, "description": ""},
        {"mark": "DW 09", "type": "L", "size": "AS SHOWN", "shown_size": "7300+2950 x 3200",
         "location": "", "count": 1, "description": ""},
        {"mark": "", "type": "no mark", "size": "", "shown_size": "", "location": "", "count": None,
         "description": ""}]})
    assert [r["mark"] for r in rows] == ["D-1", "DW 06", "DW 09"]           # no mark, no row
    assert rows[0]["values"] == {"mark": "D-1", "type": "HINGED DOOR", "location": "STAIRCASE",
                                 "remarks": "5CM SOLID PANEL", "count": "20",
                                 "width": "1200", "height": "2200"}
    assert rows[1]["values"]["width"] == "3750" and rows[1]["values"]["height"] == "3200"
    assert rows[2]["values"]["width"] == "7300+2950"         # two legs: kept as printed, refused later


def test_a_reading_answers_only_the_sheet_it_was_made_from():
    import json
    import tempfile
    from readers.transcribe import ReadingStore
    with tempfile.TemporaryDirectory() as td:
        doc = {"_stamp": {"sheet_sha1": "abc", "task": "title_block", "version": "1"},
               "_by": "someone", "reading": {"drawing_no": "S-03_1", "drawing_title": "SLAB",
                                            "scale": "1:150", "plot": "", "job_title": "",
                                            "owner": "", "illegible": []}}
        (Path(td) / "x.title_block.json").write_text(json.dumps(doc), encoding="utf-8")
        store = ReadingStore([td])
        assert store.find("abc", "title_block")[0]["drawing_no"] == "S-03_1"
        assert store.find("abd", "title_block") is None        # a revised sheet is not answered
        assert store.find("abc", "schedule") is None


def test_a_transcribed_figure_is_its_own_origin_and_scale_free():
    from spine.records import Origin
    from takeoff.rows import _METHOD_BY_ORIGIN
    from render.hygiene import APPROVED_METHODS
    assert Origin.TRANSCRIBED.value == "transcribed"
    assert _METHOD_BY_ORIGIN[Origin.TRANSCRIBED] in APPROVED_METHODS
    from measure.intake import build
    sched = [{"doc_id": "A2/A-13-001 SCHEDULE OF DOORS.pdf", "title": "SCHEDULE OF DOORS",
              "origin": "transcribed", "drawing_no": "A-13-001",
              "rows": [{"mark": "D-1", "values": {"mark": "D-1", "count": "20", "width": "1200",
                                                  "height": "2200"}, "row_index": 0}]}]
    base, elements, _gaps = build(sched)
    assert elements[0].count == 20
    assert {base.get(i).origin for i in elements[0].evidence_ids} == {Origin.TRANSCRIBED}


def test_the_real_drawn_schedules_are_read_from_their_saved_readings():
    sched = DRAWINGS / "Architecture" / "A2" / "A-13-001 SCHEDULE OF DOORS.pdf"
    if not sched.exists():
        return
    from readers.transcribe import READINGS, ReadingStore, obtain, schedule_rows
    reading, how = obtain(sched, "schedule", "A-13-001", ReadingStore([READINGS]))
    assert reading is not None and how.startswith("saved reading")
    rows = schedule_rows(reading)
    assert rows[0]["mark"] == "D-1" and rows[0]["values"]["count"] == "20"


# ---- the words of the bill: what POMI H1.1 / H2.1 and the house bills require --

def test_a_door_or_window_states_its_kind_size_and_type():
    """POMI H1.1 / H2.1: enumerated, stating size and type; the house bills
    write "…door, size 1100mm x 2200mm, type S1.2"."""
    import json
    conv = json.loads((ROOT / "data" / "conventions.json").read_text(encoding="utf-8"))
    h = next(c for c in conv["descriptions"] if c["section"] == "H")
    assert h["varies_by"] == ["kind", "opening_size", "type"]
    assert "opening_size" in h["required_slots"]
    from types import SimpleNamespace
    from stages_bill import _element_attributes
    from measure.evidence import EvidenceBase
    from spine.records import Origin
    base = EvidenceBase()
    base.make("d:w", "1.10", "m", "s", None, Origin.STATED, role="width")
    base.make("d:h", "2.20", "m", "s", None, Origin.STATED, role="height")
    el = SimpleNamespace(mark="D-2", dims={"width": "d:w", "height": "d:h"})
    assert _element_attributes(el, base)["opening_size"] == "size 1100mm x 2200mm"


def test_sizes_in_parts_are_described_as_printed_never_added():
    from readers.transcribe import _size
    from stages_bill import _printed_mm
    assert _size("7300+2950 x 3200") == ("7300+2950", "3200", None)
    assert _size("11350 x (800+2400)") == ("11350", "800+2400", None)
    assert _size("1200 x 1400 sill 1000") == ("1200", "1400", "1000")
    assert _size("AS SHOWN") == (None, None, None)
    assert _printed_mm("7300+2950") == "(7300 + 2950)mm" and _printed_mm("1200") == "1200mm"
    from measure.intake import build
    sched = [{"doc_id": "W.pdf", "title": "SCHEDULE OF WINDOWS", "drawing_no": "A-13-002",
              "rows": [{"mark": "DW 04", "row_index": 0,
                        "values": {"mark": "DW 04", "count": "10", "width": "7300+2950",
                                   "height": "3200"}}]}]
    _base, elements, gaps = build(sched)
    assert elements[0].count == 10 and "width" not in elements[0].dims
    assert [g.subject for g in gaps] == ["stated sizes in parts"]           # one plain gap


def test_a_clause_title_reads_as_a_bill_heading():
    from stages_bill import _clause_heading
    assert _clause_heading("Windows and skylights ENUMERATED TOGETHER WITH THEIR FRAMES —") \
        == "Windows and skylights"
    assert _clause_heading("Walls and piers, FOUR classes") == "Walls and piers"
    assert _clause_heading("Screens, borrowed lights and CURTAIN WALLING") \
        == "Screens, borrowed lights and curtain walling"
    assert _clause_heading("Doors") == "Doors"


def test_element_headings_are_plural_and_mass_nouns_are_not():
    from bill.assemble import _heading_text as h
    assert [h("door"), h("window"), h("pile_cap"), h("door/window")] == \
        ["Doors", "Windows", "Pile caps", "Doors and windows"]
    assert [h("glazing"), h("reinforcement"), h("ironmongery"), h("concrete")] == \
        ["Glazing", "Reinforcement", "Ironmongery", "Concrete"]


# ---- the output folder: one obvious place, never empty ------------------------

def _output_ctx(tmp: Path, delivered: bool):
    from spine.gaps import Gap, GapList
    run = tmp / "run"
    (run / "deliverable" / "markup").mkdir(parents=True)
    for name in ("takeoff.xlsx", "bill_unpriced.xlsx", "provenance.xlsx", "register.xlsx"):
        (run / name).write_bytes(b"x")
    zip_path = None
    if delivered:
        for name in ("P - BOQ Priced - Rev 00.xlsx", "P - BOQ Unpriced - Rev 00.xlsx",
                     "P - Take-off - Rev 00.xlsx"):
            (run / "deliverable" / name).write_bytes(b"x")
        (run / "deliverable" / "markup" / "1. A-100.pdf").write_bytes(b"x")
        zip_path = tmp / "P - BOQ - Rev 00.zip"
        zip_path.write_bytes(b"zip")
    gaps = GapList()
    gaps.add(Gap(stage="S10", doc_id="A/A-13-001.pdf", subject="D-1",
                 reason="schedule says 20, plan tags say 19"))
    ctx = {"run": run, "project": tmp / "Project X", "revision": "Rev 00", "gaps": gaps}
    return ctx, zip_path


def test_the_output_folder_holds_the_issued_bill_unzipped():
    import tempfile
    import agent
    with tempfile.TemporaryDirectory() as td:
        tmp = Path(td)
        agent.OUTPUT, keep = tmp / "output", agent.OUTPUT
        try:
            ctx, zip_path = _output_ctx(tmp, delivered=True)
            folder = agent._to_output(ctx, zip_path, None)
            names = sorted(p.name for p in folder.iterdir())
            assert folder.name == "Project X - Rev 00"
            assert "P - BOQ Priced - Rev 00.xlsx" in names and "P - Take-off - Rev 00.xlsx" in names
            assert "markup" in names and "P - BOQ - Rev 00.zip" in names
            assert any("Provenance" in n for n in names) and any("Drawing register" in n for n in names)
            text = (folder / "Questions and gaps.txt").read_text(encoding="utf-8")
            assert "1 question(s)" in text and "schedule says 20, plan tags say 19" in text
            assert "Bill issued: yes" in (agent.OUTPUT / "LATEST RUN.txt").read_text(encoding="utf-8")
            assert not (folder / "WHY THERE IS NO BILL.txt").exists()
        finally:
            agent.OUTPUT = keep


def test_the_output_folder_says_why_when_no_bill_was_issued():
    import tempfile
    import agent
    with tempfile.TemporaryDirectory() as td:
        tmp = Path(td)
        agent.OUTPUT, keep = tmp / "output", agent.OUTPUT
        try:
            ctx, _ = _output_ctx(tmp, delivered=False)
            folder = agent._to_output(ctx, None, "No element was built - see gaps.json (S6, S9)")
            why = (folder / "WHY THERE IS NO BILL.txt").read_text(encoding="utf-8")
            assert "No element was built" in why and "see Questions and gaps.txt" in why
            names = [p.name for p in folder.iterdir()]
            assert any("Take-off (not issued)" in n for n in names)          # never an empty folder
            assert "Bill issued: no" in (agent.OUTPUT / "LATEST RUN.txt").read_text(encoding="utf-8")
        finally:
            agent.OUTPUT = keep


# ---- from Ajay's run on a 385-sheet package --------------------------------

def test_engineers_load_sheets_are_not_schedules_to_bill():
    assert route("ELECTRICAL LOAD SUMMARY", "6. ELECTRICAL LOAD SUMMARY - 06.pdf")[0] == "general"
    assert route(None, "E-201 LOAD SCHEDULE.pdf", "LOAD SCHEDULE")[0] == "general"
    assert route("PANEL SCHEDULE DB-1", "x.pdf")[0] == "general"
    assert route("SCHEDULE OF WINDOWS", "A-13-003.pdf")[0] == "schedule"


def _schedule_call(title, reading, graphic=False):
    import agent
    import readers.transcribe as tr
    from spine.gaps import GapList
    asked = []

    def fake_obtain(path, task, stem, store, live=False, edge=None):
        asked.append(stem)
        return reading, "live reading" if reading else "request written"
    saved = agent._transcriber, tr.obtain
    agent._transcriber, tr.obtain = (lambda ctx: (None, True)), fake_obtain
    doc_id = f"A5/{title}.pdf"
    ctx = {"gaps": GapList()}
    out = {"read": 0, "rows_total": 0, "schedules": []}
    record = {"doc_id": doc_id, "heading": title, "problem": "x"}
    if graphic:
        record["graphic"] = True
    try:
        done, how = agent._transcribe_schedule(ctx, Path(doc_id), {"doc_id": doc_id,
                                               "drawing_no": "A-501"}, record, out, None,
                                               {doc_id: title})
    finally:
        agent._transcriber, tr.obtain = saved
    return done, how, record, out, asked


def test_a_door_schedule_whose_header_cannot_be_mapped_is_read_off_the_sheet():
    reading = {"rows": [{"mark": "D1", "type": "FLUSH", "size": "900X2100", "shown_size": "",
                         "location": "", "count": 12, "description": ""}]}
    done, how, record, out, asked = _schedule_call("SCHEDULE OF DOORS", reading)
    assert done and asked == ["A-501"]
    assert record["origin"] == "transcribed" and record["marks"] == ["D1"]
    assert "problem" not in record
    assert out["read"] == 1 and out["rows_total"] == 1 and out["schedules"] == [record]


def test_an_unread_door_schedule_says_a_request_was_left():
    done, how, record, out, _ = _schedule_call("SCHEDULE OF DOORS", None)
    assert not done and how == "request written" and out["schedules"] == []


def test_a_column_schedule_is_not_asked_door_questions():
    done, how, _, _, asked = _schedule_call("COLUMN SCHEDULE", None)
    assert not done and asked == [] and how == ""
    done, how, _, _, _ = _schedule_call("COLUMN SCHEDULE", None, graphic=True)
    assert how.startswith("no transcription for a drawn")


# ---- CR-01 D1: one list of sheet kinds, and a stray label is one gap --------

def test_the_model_may_route_a_sheet_as_general():
    from model.schema import SCHEMAS, validate
    from readers.route import KINDS
    assert SCHEMAS["sheet_kind"]["item_enums"]["kind"] == KINDS
    out = validate("sheet_kind", {"items": [{"doc_id": "a", "kind": "general"}]})
    assert out["items"][0]["kind"] == "general"


def test_one_off_list_label_drops_that_sheet_not_the_stage():
    from model.schema import validate
    out = validate("sheet_kind", {"items": [{"doc_id": "a", "kind": "plan"},
                                            {"doc_id": "b", "kind": "banana"}]})
    assert [i["doc_id"] for i in out["items"]] == ["a"]
    assert out["_off_enum"] == ["items[1].kind = 'banana'"]


# ---- CR-01 D2: schedules named by what their headings actually say ----------

def test_schedules_are_named_by_the_words_offices_use():
    from measure.intake import element_type_of
    for heading, kind in (("GLAZING SCHEDULE", "glazing"), ("CURTAIN WALL SCHEDULE", "glazing"),
                          ("SKYLIGHT SCHEDULE", "window"), ("ROLLER SHUTTER SCHEDULE", "door"),
                          ("CEILING SCHEDULE", "finish"), ("FLOORING SCHEDULE", "finish"),
                          ("PUMP SCHEDULE", "equipment"), ("DOOR SCHEDULE", "door")):
        assert element_type_of("x.pdf", None, heading) == kind, heading


def test_an_unnamed_schedule_is_a_gap_that_quotes_its_heading():
    from measure.intake import build
    _base, elements, gaps = build([{"doc_id": "A5/x.pdf", "heading": "OPENINGS - LEVEL 2",
                                    "rows": [{"mark": "X1", "values": {"mark": "X1"}}]}])
    assert elements == []
    assert any("OPENINGS - LEVEL 2" in g.reason and "nothing on it is billed" in g.reason
               for g in gaps)
