#!/usr/bin/env python3
"""
extract.py — words with boxes, vector paths with coordinates. No interpretation.

This module knows nothing about title blocks, walls or schedules. Everything
downstream cites back to it, which is why it is the one place the coordinate
frame is decided.

The frame, which is the real decision here. PyMuPDF returns words and drawings
in UNROTATED page space while page.rect reports the DISPLAYED size. On a
/Rotate 270 sheet those differ — 1684x2384 against 2384x1684 — and half a
typical UAE package is rotated. A consumer assuming either frame would read the
title block from the wrong corner of half the package and produce a register
that looked entirely plausible. So rotation is applied explicitly, the frame
(page-display-topleft-pt) is stated on every record, and containment in the
displayed page is asserted rather than trusted.

Persistence: none. Words are returned, never written. Paths are a GENERATOR,
not a list — one sheet in a real corpus carries 92,000 paths, ~54MB serialised,
and under v3.1 nothing is measured off page geometry.

Word order is fixed — sorted by (y0, x0, text), index assigned AFTER sorting,
so no downstream stage inherits content-stream order.

  python3 -m readers.extract <pdf> [--page N] [--paths]

Exit 0 = extracted. Exit 2 = unreadable (ExtractionError names the reason).
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path
from typing import Iterator

try:
    import pymupdf                      # 1.24+
except ImportError:                     # pragma: no cover
    try:
        import fitz as pymupdf
    except ImportError:
        pymupdf = None

from spine.errors import ExtractionError
from spine.records import FRAME, VectorPath, Word

STAGE = "S3"
CONTAINMENT_TOLERANCE = 1.0     # pt; a word may touch the trim edge
OVERHANG_TOLERANCE = 40.0       # pt; a word set past the trim is clipped, not refused


def _open(path: Path):
    if pymupdf is None:
        raise ExtractionError("pymupdf is not installed", stage=STAGE,
                              operation="import")
    try:
        doc = pymupdf.open(str(path))
    except Exception as exc:            # corrupt, not a PDF
        raise ExtractionError("cannot open - the file is damaged or is not a PDF "
                              f"({str(exc)[:80]}); ask for the drawing to be issued again",
                              doc_id=str(path), stage=STAGE, operation="open") from exc
    # a sheet that opens only with a password cannot be read at all; one with
    # only an owner password (printing or copying locked) opens and reads
    if doc.needs_pass and not doc.authenticate(""):
        doc.close()
        raise ExtractionError("password-protected - ask for an unprotected copy of "
                              "this drawing", doc_id=str(path), stage=STAGE,
                              operation="open")
    return doc


def rotate_point(x: float, y: float, rot: int, w: float, h: float
                 ) -> tuple[float, float]:
    """Unrotated page space -> displayed space, top-left origin.

    w and h are the UNROTATED page width and height. Written as its own
    function because it is the step whose absence is invisible: without it the
    numbers are still plausible, just in the wrong corner."""
    rot = rot % 360
    if rot == 0:
        return x, y
    if rot == 90:
        return h - y, x
    if rot == 180:
        return w - x, h - y
    if rot == 270:
        return y, w - x
    raise ExtractionError(f"unsupported page rotation {rot}", stage=STAGE)


def _rect_to_display(x0, y0, x1, y1, rot, w, h):
    """Rotate both corners, then re-normalise so x0<x1 and y0<y1."""
    ax, ay = rotate_point(x0, y0, rot, w, h)
    bx, by = rotate_point(x1, y1, rot, w, h)
    return min(ax, bx), min(ay, by), max(ax, bx), max(ay, by)


def page_display_size(page) -> tuple[float, float]:
    r = page.rect
    return r.width, r.height


def extract_words(path: Path, page_index: int | None = None) -> list[Word]:
    """Sorted by (y0, x0, text); index assigned after sorting."""
    path = Path(path)
    doc = _open(path)
    out: list[Word] = []
    try:
        pages = range(doc.page_count) if page_index is None else [page_index]
        for pno in pages:
            if pno >= doc.page_count:
                raise ExtractionError(f"no page {pno}", doc_id=str(path),
                                      stage=STAGE)
            page = doc[pno]
            rot = page.rotation
            # unrotated page box — what get_text('words') is expressed in
            ur = page.rect if rot in (0, 180) else pymupdf.Rect(
                0, 0, page.rect.height, page.rect.width)
            uw, uh = ur.width, ur.height
            dw, dh = page_display_size(page)
            rows = []
            for x0, y0, x1, y1, text, *_ in page.get_text("words"):
                if not text.strip():
                    continue
                cx0, cy0, cx1, cy1 = _rect_to_display(x0, y0, x1, y1, rot, uw, uh)
                if not (-CONTAINMENT_TOLERANCE <= cx0
                        and cx1 <= dw + CONTAINMENT_TOLERANCE
                        and -CONTAINMENT_TOLERANCE <= cy0
                        and cy1 <= dh + CONTAINMENT_TOLERANCE):
                    # A word that OVERHANGS the page edge — a title-block label
                    # set 6 pt past the trim, a note in the margin — is still on
                    # the sheet; 78 of 179 sheets of one package were refused
                    # whole for a single "CONSULTANTS" hanging off the right
                    # edge. Overhang within OVERHANG_TOLERANCE is clipped to the
                    # page; a word lying wholly outside (a rotation error, not
                    # a layout habit) still fails the containment assertion.
                    inside = (cx1 > 0 and cx0 < dw and cy1 > 0 and cy0 < dh)
                    near = (cx0 >= -OVERHANG_TOLERANCE and cx1 <= dw + OVERHANG_TOLERANCE
                            and cy0 >= -OVERHANG_TOLERANCE and cy1 <= dh + OVERHANG_TOLERANCE)
                    if not (inside and near):
                        raise ExtractionError(
                            f"word {text!r} falls outside the displayed page "
                            f"({cx0:.1f},{cy0:.1f})-({cx1:.1f},{cy1:.1f}) vs "
                            f"{dw:.1f}x{dh:.1f} at rot {rot}",
                            doc_id=str(path), stage=STAGE, operation="containment")
                    cx0, cy0 = max(cx0, 0.0), max(cy0, 0.0)
                    cx1, cy1 = min(cx1, dw), min(cy1, dh)
                rows.append((cy0, cx0, text, cx1, cy1, pno))
            rows.sort(key=lambda r: (round(r[0], 2), round(r[1], 2), r[2]))
            base = len(out)
            for i, (y0, x0, text, x1, y1, pg) in enumerate(rows):
                out.append(Word(index=base + i, text=text, x0=x0, y0=y0,
                                x1=x1, y1=y1,
                                doc_id=f"{path.name}#{pg}", page=pg))
    finally:
        doc.close()
    return out


def _keep_none_alive() -> None:
    """PyMuPDF 1.28 releases more references to None than it takes: get_texttrace()
    some 900 on a large plan. Python 3.11 counts None's references like any other
    object's, so a run that has read enough plans loses more than None ever had and
    fails ('deallocating None') as it shuts down. From Python 3.12 None cannot be
    freed; here it is given a billion references to lose (as boq_arch/sheet.py)."""
    import ctypes
    if sys.version_info < (3, 12) and not getattr(_keep_none_alive, "done", False):
        ctypes.c_ssize_t.from_address(id(None)).value += 1_000_000_000
        _keep_none_alive.done = True


def word_layers(path: Path, words: list[Word], page_index: int = 0) -> list[str]:
    """The CAD layer each word was drawn on, aligned with `words` ('' where the PDF
    names none). A layer's name says whose content it is: "A-07-008 LOWER ROOF
    PLAN|M2-A-DOOR TAG" on the upper roof plan is the lower roof plan drawn
    underneath, and its door tags are that sheet's doors, not this one's."""
    _keep_none_alive()
    doc = _open(Path(path))
    try:
        page = doc[page_index]
        rot = page.rotation
        ur = page.rect if rot in (0, 180) else pymupdf.Rect(
            0, 0, page.rect.height, page.rect.width)
        rows: dict[int, list] = {}
        for sp in page.get_texttrace():
            layer = sp.get("layer") or ""
            if not layer:
                continue
            x0, y0, x1, y1 = _rect_to_display(*sp["bbox"], rot, ur.width, ur.height)
            for band in range(int(y0 // 20), int(y1 // 20) + 1):
                rows.setdefault(band, []).append((x0, y0, x1, y1, layer))
    finally:
        doc.close()
    out = []
    for w in words:
        cx, cy = (w.x0 + w.x1) / 2, (w.y0 + w.y1) / 2
        out.append(next((lay for x0, y0, x1, y1, lay in rows.get(int(cy // 20), ())
                         if x0 - 0.5 <= cx <= x1 + 0.5 and y0 - 0.5 <= cy <= y1 + 0.5), ""))
    return out


def is_underlay(layer: str, own_drawing_no: str | None = None,
                drawing_nos=()) -> bool:
    """Content xref'd from ANOTHER drawing sheet: the xref (the part before '|')
    is named after a sheet of the package, or reads like a drawing number
    (A-07-008 ...). Shared xrefs - grid, plot, title sheet - are part of every
    sheet and are not underlays."""
    if "|" not in (layer or ""):
        return False
    xref = layer.split("|", 1)[0].strip().upper()
    own = (own_drawing_no or "").strip().upper()
    if own and xref.startswith(own):
        return False
    if any(n and xref.startswith(str(n).strip().upper()) for n in drawing_nos):
        return True
    import re
    return bool(re.match(r"^[A-Z]{1,3}-\d{2}-\d{3}(?:\s|$)", xref))


def extract_paths(path: Path, page_index: int | None = None
                  ) -> Iterator[VectorPath]:
    """Generator, deliberately. Never materialise a whole sheet's paths."""
    path = Path(path)
    doc = _open(path)
    try:
        pages = range(doc.page_count) if page_index is None else [page_index]
        for pno in pages:
            page = doc[pno]
            rot = page.rotation
            ur = page.rect if rot in (0, 180) else pymupdf.Rect(
                0, 0, page.rect.height, page.rect.width)
            uw, uh = ur.width, ur.height
            for d in page.get_drawings():
                pts: list[tuple[float, float]] = []
                for item in d.get("items", ()):
                    for part in item[1:]:
                        for attr in ("x", "y"):
                            pass
                        if hasattr(part, "x") and hasattr(part, "y"):
                            pts.append(rotate_point(part.x, part.y, rot, uw, uh))
                        elif hasattr(part, "x0"):
                            pts.append(rotate_point(part.x0, part.y0, rot, uw, uh))
                            pts.append(rotate_point(part.x1, part.y1, rot, uw, uh))
                if not pts:
                    continue
                yield VectorPath(points=tuple(pts),
                                 stroke=str(d.get("color")) if d.get("color") else None,
                                 fill=str(d.get("fill")) if d.get("fill") else None,
                                 width=float(d.get("width") or 0),
                                 doc_id=f"{path.name}#{pno}", page=pno)
    finally:
        doc.close()


def page_count(path: Path) -> int:
    doc = _open(Path(path))
    try:
        return doc.page_count
    finally:
        doc.close()


def main() -> int:
    ap = argparse.ArgumentParser(description="Extract words and paths.")
    ap.add_argument("pdf")
    ap.add_argument("--page", type=int)
    ap.add_argument("--paths", action="store_true")
    args = ap.parse_args()
    p = Path(args.pdf)
    if not p.is_file():
        print(f"ERROR: no file at {p}", file=sys.stderr)
        return 2
    try:
        words = extract_words(p, args.page)
    except ExtractionError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 2
    print(f"{len(words)} words · frame {FRAME} · {page_count(p)} page(s)")
    for w in words[:6]:
        print(f"  [{w.index:>4}] ({w.x0:7.1f},{w.y0:7.1f}) {w.text[:40]}")
    if args.paths:
        n = sum(1 for _ in extract_paths(p, args.page))
        print(f"{n} vector paths")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
