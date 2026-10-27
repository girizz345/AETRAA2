#!/usr/bin/env python3
"""
A package that arrives in sub-folders. doc_id is the relative path; every
reader that treats it as a bare file name must use the name, and every file
lookup must resolve the relative path. Found on a 183-sheet package where 12
schedules read "file not found" and 129 sheets lost their drawing number.
"""
from __future__ import annotations

import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from measure.intake import element_type_of                     # noqa: E402
from readers.register import number_from_filename              # noqa: E402
from readers.route import route                                # noqa: E402
from spine.files import doc_name, project_files                # noqa: E402

DOC = "Drawings/01-ARCHITECTURE/A-504 SCHEDULE OF DOORS-04.pdf"


def test_doc_name_is_the_file_not_the_folder():
    assert doc_name(DOC) == "A-504 SCHEDULE OF DOORS-04.pdf"
    assert doc_name("A-504.pdf") == "A-504.pdf"
    assert doc_name(None) == ""


def test_the_drawing_number_comes_from_the_name_not_the_folder():
    assert number_from_filename(DOC) == "A-504"
    assert number_from_filename("Drawings/02-STRUCTURE/S-402 PILE SCHEDULES.pdf") == "S-402"


def test_field_coded_file_names_are_drawing_numbers_too():
    """BS 1192 / ISO 19650 naming: the whole hyphenated code is the number, a
    title word ends it, and prose is not a number."""
    assert number_from_filename("620DXB24-MIM-XXX-S-601-T0.pdf") == "620DXB24-MIM-XXX-S-601-T0"
    assert number_from_filename("620DXB24-MIM-FDN-S-100 A-T0.pdf") == "620DXB24-MIM-FDN-S-100"
    assert number_from_filename("S-201-FOUNDATION-PLAN.pdf") == "S-201"
    assert number_from_filename("SCHEDULE OF DOORS.pdf") is None
    assert number_from_filename("notes.pdf") is None


def test_discipline_from_a_field_coded_number():
    from ingest.discipline_matrix import DisciplineMatrix
    m = DisciplineMatrix.load()
    assert m.resolve("A-504").discipline == "Architectural"
    row = m.resolve("620DXB24-MIM-XXX-S-601-T0")
    assert row is not None and row.discipline == "Structural"
    assert m.resolve("620DXB24-MIM-XXX-ST-601-T0").discipline == "Structural"
    assert m.resolve("620DXB24-MIM-XXX-601-T0") is None


def test_routing_and_element_type_read_the_name():
    assert route(None, DOC) == ("schedule", "file name")
    assert element_type_of(DOC) == "door"
    # a folder named like a kind must not route the sheet
    assert route(None, "PLANS/XYZ.pdf") == (None, None)


def test_project_files_resolves_relative_paths_and_unique_names():
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        (root / "Drawings" / "01-ARCH").mkdir(parents=True)
        (root / "Drawings" / "02-STR").mkdir(parents=True)
        (root / "Drawings" / "01-ARCH" / "A-100.pdf").write_bytes(b"%PDF")
        (root / "Drawings" / "02-STR" / "A-100.pdf").write_bytes(b"%PDF")
        (root / "Drawings" / "01-ARCH" / "A-504 SCHEDULE.pdf").write_bytes(b"%PDF")
        files = project_files(root)
        assert "Drawings/01-ARCH/A-504 SCHEDULE.pdf" in files
        assert files["A-504 SCHEDULE.pdf"].name == "A-504 SCHEDULE.pdf"   # unique name
        assert "A-100.pdf" not in files                                    # two of them
        assert "Drawings/02-STR/A-100.pdf" in files
