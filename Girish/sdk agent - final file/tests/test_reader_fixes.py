#!/usr/bin/env python3
"""
Two reader defects found on a real package, and the guards that now hold.

  * S6: a description wrapping into the mark column made "DOOR AL-01" and
    "AND WD-04" new marks. mark_token() frees the mark; a composite the
    schedule wrote as one ("F.10 / F.17") and a cell with no mark ("FLOOR")
    are kept whole.
  * S1: one title-block value claimed by 42 files was a project code, not a
    drawing number. demote_shared_numbers() re-names such sheets from the
    file name where it carries a drawing-number token, and records the basis;
    genuine two-file revision clashes are untouched.
"""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from readers.register import (demote_shared_numbers,           # noqa: E402
                              number_from_filename)
from readers.schedule_read import mark_token                   # noqa: E402
from spine.records import SheetRecord, Tier                    # noqa: E402


def test_a_wrapped_word_is_freed_from_the_mark():
    assert mark_token("DOOR AL-01") == "AL-01"
    assert mark_token("TIMBER SD-09") == "SD-09"
    assert mark_token("AND WD-04") == "WD-04"
    assert mark_token("ALUMINIUM WD-04") == "WD-04"


def test_a_section_cut_letter_beside_a_spaced_mark_is_not_part_of_it():
    """Structural schedules write "C 1"; a detail letter drawn beside it lands
    in the cell — "D C 1", "J C 3", "E B2B" — and read whole each became a new
    column or beam in the bill."""
    assert mark_token("D C 1") == "C 1"
    assert mark_token("J C 3") == "C 3"
    assert mark_token("E B2B") == "B2B"
    assert mark_token("C 2-A") == "C 2-A"
    assert mark_token("C 1") == "C 1"


def test_a_model_mark_column_may_repeat_when_a_location_column_tells_rows_apart():
    """A column schedule states C 1 once per storey. Refusing that as
    'repeating' threw away the column and core-wall schedules of a real
    package; a details table of 600 / 500 / 1 is still refused on shape."""
    from readers.schedule_cells import Cell, Grid
    from readers.schedule_read import mark_column_plausible
    rows = [("C 1", "Foundation"), ("C 1", "Pod 1"), ("C 1", "1st floor"),
            ("C 2", "Foundation"), ("C 2", "Pod 1"), ("C 1", "2nd floor")]
    cells = [Cell(0, 0, "ID"), Cell(0, 1, "From")]
    for i, (m, loc) in enumerate(rows, 1):
        cells += [Cell(i, 0, m), Cell(i, 1, loc)]
    grid = Grid(cells=tuple(cells), n_rows=len(rows) + 1, n_cols=2, doc_id="S-601.pdf", page=1)
    assert mark_column_plausible(grid, 0, 0, located=True) is None
    assert "repeat" in mark_column_plausible(grid, 0, 0, located=False)
    junk = tuple([Cell(0, 0, "D")] + [Cell(i, 0, v) for i, v in enumerate(["600", "500", "1", "600"], 1)])
    g2 = Grid(cells=junk, n_rows=5, n_cols=1, doc_id="S-605.pdf", page=1)
    assert "not mark-shaped" in mark_column_plausible(g2, 0, 0, located=True)


def test_a_plain_mark_and_a_composite_are_kept_whole():
    assert mark_token("SD-01") == "SD-01"
    assert mark_token("F.03") == "F.03"
    assert mark_token("F.10 / F.17") == "F.10 / F.17"     # two tokens: composite
    assert mark_token("FLOOR") == "FLOOR"                 # no token: not invented
    assert mark_token("") == ""


def _sheet(doc_id, number, rev="B"):
    return SheetRecord(doc_id=doc_id, file_sha256="", drawing_no=number,
                       title=None, revision=rev, scale=None, subtitle=None,
                       discipline=None, section=None, sheet_kind=None,
                       tier=Tier.T2_VECTOR)


def test_a_project_code_claimed_by_many_files_is_demoted_to_the_file_name():
    sheets = [_sheet("A-102 GROUND FLOOR PLAN.pdf", "DIA-RE-0160"),
              _sheet("A-103 PODIUM FLOOR PLAN.pdf", "DIA-RE-0160"),
              _sheet("A-504 SCHEDULE OF DOORS -04.pdf", "DIA-RE-0160"),
              _sheet("notes.pdf", "DIA-RE-0160")]
    out, gaps = demote_shared_numbers(sheets)
    numbers = {s.doc_id: s.drawing_no for s in out}
    assert numbers["A-102 GROUND FLOOR PLAN.pdf"] == "A-102"
    assert numbers["A-504 SCHEDULE OF DOORS -04.pdf"] == "A-504"
    assert numbers["notes.pdf"] is None            # unresolved, not guessed
    assert len(gaps) == 4 and all("project code" in g.reason for g in gaps)
    assert any("unresolved" in (g.detail or "") for g in gaps)


def test_a_genuine_two_file_clash_is_left_for_the_revision_resolver():
    sheets = [_sheet("A-100 rev B.pdf", "A-100", "B"),
              _sheet("A-100 rev C.pdf", "A-100", "C")]
    out, gaps = demote_shared_numbers(sheets)
    assert out == sheets and gaps == []


def test_filename_number_shapes():
    assert number_from_filename("A-504 SCHEDULE OF DOORS -04.pdf") == "A-504"
    assert number_from_filename("S_201-FOUNDATION.pdf") == "S-201"
    assert number_from_filename("MEP 1203 rev A.pdf") == "MEP-1203"
    assert number_from_filename("SCHEDULE OF DOORS.pdf") is None
