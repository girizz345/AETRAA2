#!/usr/bin/env python3
"""
files.py — one answer to "which file is this doc_id".

A doc_id is the sheet's path RELATIVE to the project root, as posix
("Drawings/01-ARCHITECTURE/A-504 SCHEDULE OF DOORS-04.pdf"). A package that
arrives as one flat folder makes doc_id and file name the same string, and
every lookup keyed on the bare name works — until the first package arrives in
sub-folders, when every schedule reads "file not found in the project folder"
and every drawing number derived from the "file name" is derived from the
folder instead. Observed on a 183-sheet package: 12 schedules unread, 129
sheets unresolved, all from the same one-line assumption in five places.

So the lookup lives here, once:

  * project_files(root) maps BOTH the relative path and the bare name to the
    Path. The relative path always resolves; the bare name resolves only when
    it is unique in the package, because two "A-100.pdf" in two folders are two
    sheets and guessing between them is worse than not finding one.
  * doc_name(doc_id) is the bare file name, for everything that reads the
    consultant's naming — routing by title words, the drawing number in the
    name, the element type a schedule's name states.
"""
from __future__ import annotations

import re
from pathlib import Path, PurePosixPath


# Folders under the project root that are OUTPUT, never input. Reports/ is
# where this agent — and every other AETRAA agent — writes; a markup PDF the
# last run issued is not a drawing, and reading it back would change the
# input-set hash of a package whose drawings have not changed.
OUTPUT_FOLDERS = ("Reports",)


def is_project_file(path: Path, root: Path) -> bool:
    """A file that belongs to the PACKAGE: not hidden, not under an output
    folder. Applied identically by the walker, the hash and the resolver."""
    try:
        rel = Path(path).relative_to(root)
    except ValueError:
        return False
    parts = rel.parts
    if not parts:
        return False
    if parts[0] in OUTPUT_FOLDERS:
        return False
    return not any(part.startswith(".") for part in parts)


def project_pdfs(root: Path) -> list:
    """Every PDF of the package, stable order, output folders excluded. The
    suffix is matched ignoring case: rglob("*.pdf") is case-sensitive on a
    Mac, and a package of "A-101.PDF" files was listed there but never found."""
    root = Path(root)
    return sorted(p for p in root.rglob("*")
                  if p.suffix.lower() == ".pdf" and p.is_file()
                  and is_project_file(p, root))


# ── a combined set: one PDF, many sheets ────────────────────────────────────
# Many offices issue a set as ONE PDF - eighty sheets, one file. Every reader
# takes a file to be a sheet (its title block on page 1, its schedule on page
# 1), so a set was read as its first sheet and the others were never seen. A
# set is therefore split, once, into one-page PDFs kept in a cache beside the
# agent (keyed by the set's content, so a changed set is split again), and
# each page is a sheet of its own:
#     "Drawings/ARCH SET.pdf"  ->  "Drawings/ARCH SET [page 03 of 80].pdf"
# The project folder is never written to.
PAGES_CACHE = Path(__file__).resolve().parent.parent / "runs" / "_pages"
_SET_PAGE = re.compile(r" \[page (\d+) of (\d+)\]\.pdf$", re.IGNORECASE)
_SHEETS_MEMO: dict = {}


def _fitz():
    try:
        import pymupdf as fitz
    except ImportError:                                 # pragma: no cover
        import fitz
    return fitz


def set_page_id(doc_id: str, page: int, pages: int) -> str:
    """The doc_id of page (1-based) of a set of `pages` sheets."""
    stem = doc_id[:-4] if doc_id.lower().endswith(".pdf") else doc_id
    width = max(2, len(str(pages)))
    return f"{stem} [page {page:0{width}d} of {pages}].pdf"


def is_set_page(doc_id: str | None) -> bool:
    """A sheet cut from a combined set. Its file name is the SET's name, which
    says nothing about this one sheet: no drawing number and no sheet kind is
    read from it."""
    return bool(doc_id and _SET_PAGE.search(str(doc_id)))


def _page_count(path: Path) -> int:
    try:
        with _fitz().open(path) as doc:
            return 1 if doc.needs_pass else doc.page_count
    except Exception:                                   # noqa: BLE001
        return 1          # unreadable: left whole, and the register says why


def _split(path: Path, pages: int) -> list[Path]:
    """One-page PDFs of a set, from the cache or cut now."""
    import hashlib
    fitz = _fitz()
    digest = hashlib.sha1(path.read_bytes()).hexdigest()[:16]
    folder = PAGES_CACHE / digest
    out = [folder / f"p{k:04d}.pdf" for k in range(1, pages + 1)]
    if all(p.is_file() for p in out):
        return out
    folder.mkdir(parents=True, exist_ok=True)
    with fitz.open(path) as doc:
        for k, target in enumerate(out):
            one = fitz.open()
            one.insert_pdf(doc, from_page=k, to_page=k)
            tmp = target.with_suffix(".part")
            one.save(tmp, garbage=3, deflate=True)
            one.close()
            tmp.replace(target)
    return out


def project_sheets(root: Path) -> list[tuple[str, Path]]:
    """(doc_id, path) for every SHEET of the package, stable order: a
    one-page PDF is itself, a set is its pages. Remembered while no PDF under
    the root has changed, so the five lookups of a run open each file once."""
    root = Path(root)
    pdfs = project_pdfs(root)
    stamp = tuple((str(p), p.stat().st_size, p.stat().st_mtime_ns) for p in pdfs)
    key = str(root.resolve())
    memo = _SHEETS_MEMO.get(key)
    if memo and memo[0] == stamp:
        return memo[1]
    out: list[tuple[str, Path]] = []
    for path in pdfs:
        rel = path.relative_to(root).as_posix()
        pages = _page_count(path)
        if pages <= 1:
            out.append((rel, path))
            continue
        for k, page_path in enumerate(_split(path, pages), start=1):
            out.append((set_page_id(rel, k, pages), page_path))
    _SHEETS_MEMO[key] = (stamp, out)
    return out


def doc_name(doc_id: str | None) -> str:
    """The file's own name, whatever folder it sits in."""
    if not doc_id:
        return ""
    return PurePosixPath(str(doc_id).replace("\\", "/")).name


def project_files(root: Path) -> dict:
    """doc_id -> Path for every PDF under the root, keyed by relative posix
    path and, where unique, by bare name."""
    root = Path(root)
    by_rel: dict = {}
    by_name: dict = {}
    clashes: set = set()
    for rel, path in project_sheets(root):
        by_rel[rel] = path
        name = doc_name(rel)
        if name in by_name:
            clashes.add(name)
        else:
            by_name[name] = path
    out = dict(by_rel)
    for name, path in by_name.items():
        if name not in clashes:
            out.setdefault(name, path)
    return out
