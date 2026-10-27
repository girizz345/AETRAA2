#!/usr/bin/env python3
"""
The agent's own output is not its input. After the first issue, the project
holds Reports/BOQ_POMI_V1/<zip> (and, from earlier builds, folders of JSON and
markup PDFs). None of it may change the run id, be walked as a drawing, or be
resolved as a sheet — observed: a re-run over unchanged drawings came back
under a new run id because the previous markups were hashed as input.
"""
from __future__ import annotations

import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from readers.walk import walk                                  # noqa: E402
from spine.files import is_project_file, project_files         # noqa: E402
from spine.identity import hash_directory                      # noqa: E402


def _package(root: Path) -> None:
    (root / "Drawings").mkdir()
    (root / "Drawings" / "A-100.pdf").write_bytes(b"%PDF-1.4 a")
    (root / "Drawings" / "A-504 SCHEDULE.pdf").write_bytes(b"%PDF-1.4 b")


def test_reports_and_hidden_files_are_not_package_files():
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        assert is_project_file(root / "Drawings" / "A-100.pdf", root)
        assert not is_project_file(root / "Reports" / "BOQ_POMI_V1" / "x.zip", root)
        assert not is_project_file(root / "Reports" / "r" / "markup" / "1. A-504.pdf", root)
        assert not is_project_file(root / ".DS_Store", root)
        assert not is_project_file(root / "Drawings" / ".hidden.pdf", root)


def test_the_run_id_survives_an_issue():
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        _package(root)
        before, pairs = hash_directory(root)
        assert len(pairs) == 2
        out = root / "Reports" / "BOQ_POMI_V1" / "abc" / "markup"
        out.mkdir(parents=True)
        (out / "1. A-504.pdf").write_bytes(b"%PDF-1.4 markup")
        (root / "Reports" / "BOQ_POMI_V1" / "P - BOQ - Rev 00.zip").write_bytes(b"PK")
        after, pairs2 = hash_directory(root)
        assert after == before and pairs2 == pairs


def test_walk_and_resolver_skip_the_output_folder():
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        _package(root)
        out = root / "Reports" / "BOQ_POMI_V1" / "abc" / "markup"
        out.mkdir(parents=True)
        (out / "1. A-504.pdf").write_bytes(b"%PDF-1.4 markup")
        found = {f.doc_id for f in walk(root)}
        assert found == {"Drawings/A-100.pdf", "Drawings/A-504 SCHEDULE.pdf"}
        files = project_files(root)
        assert "Reports/BOQ_POMI_V1/abc/markup/1. A-504.pdf" not in files
        assert "1. A-504.pdf" not in files
