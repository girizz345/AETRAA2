#!/usr/bin/env python3
"""
probe.py — how readable is this sheet, before anything tries to read it.

  T1  DXF/DWG                      out of scope at v3.1
  T2  vector geometry + text layer measurable
  T3  vector, text outlined        not measurable — no stated text to read
  T4  raster only                  refused

There is no OCR path and that is a decision, not a gap. A raster sheet yields
no stated text, so anything measured from it would be inferred; a
low-confidence number in a bid is worse than a visible gap, because the gap
gets priced as a risk and the number gets trusted.

The commercial value of this stage is that it answers "how much of this package
can be done by software" BEFORE the work is taken on, which changes what you
charge and what you promise.

  python3 -m readers.probe <pdf>

Exit 0 = T2. Exit 1 = T3 or T4 (refused). Exit 2 = unreadable.
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

from readers.extract import _open
from spine.errors import ExtractionError
from spine.records import Tier

MIN_WORDS = 20          # below this a "text layer" is a stamp, not a drawing
MIN_DRAWINGS = 10       # below this there is no drawn content worth measuring
PROBE_PAGES = 1         # the tier is decided on the first page — see counts()
HEAVY_STREAM_BYTES = 4_000_000   # a content stream this big is vector geometry
HEAVY_STREAM_PATHS = 100_000     # what it is counted as, without building it


def counts(doc) -> tuple[int, int, int, int]:
    """(words, drawings, images, pages) from an ALREADY OPEN document.

    Split out so the register opens each sheet once instead of twice. On a
    507-sheet package that is 507 fewer file opens and one fewer full text
    pass, which is the difference between a run you watch and a run you
    leave."""
    # The FIRST page decides the tier. A drawing sheet is one page; a
    # multi-page document in the package (a specification, a report, a
    # 200-page schedule book) is not a sheet, and walking get_drawings() over
    # every one of its pages is what held a 1,490-file package in stage 1 for
    # an hour. The page count is still reported, so a multi-page file is
    # visible in the register for what it is.
    words = drawings = images = 0
    for page in list(doc)[:PROBE_PAGES]:
        words += len([w for w in page.get_text("words") if w[4].strip()])
        images += len(page.get_images(full=False))
        # get_drawings() materialises every path as Python objects. On an
        # area-calculation sheet whose content stream runs to 14 MB that is
        # hundreds of thousands of objects per sheet, and eight of them in
        # flight at once took the register pass down (killed, exit -9) on two
        # packages. A stream that large IS drawn geometry — the question the
        # count answers — so it is answered from the stream size and the
        # paths are never built here.
        try:
            stream = sum(len(doc.xref_stream_raw(x) or b"") for x in page.get_contents())
        except Exception:                                         # noqa: BLE001
            stream = 0
        if stream > HEAVY_STREAM_BYTES:
            drawings += HEAVY_STREAM_PATHS
        else:
            drawings += len(page.get_drawings())
    return words, drawings, images, doc.page_count


def classify(words: int, drawings: int, images: int, pages: int
             ) -> tuple[Tier, str]:
    """The decision, separated from the reading, so it is testable without a
    file and reusable by a caller that already has the numbers."""
    if drawings < MIN_DRAWINGS and images:
        return Tier.T4_RASTER, (
            f"Image only — {images} embedded image(s), no drawn geometry. "
            "Measurement by hand.")
    if drawings < MIN_DRAWINGS and not images:
        return Tier.T4_RASTER, "No drawn geometry and no image. Nothing to measure."
    if words < MIN_WORDS:
        return Tier.T3_OUTLINED, (
            f"Text is outlined — {drawings} drawn objects but only {words} "
            "readable words. Dimensions cannot be read. Ask for the CAD file.")
    return Tier.T2_VECTOR, (
        f"Measurable — {words} readable words, {drawings} drawn objects "
        f"across {pages} page(s).")


def probe(path: Path) -> tuple[Tier, str]:
    """Return (tier, reason). The reason is written for a surveyor, because it
    lands in the readiness column of the register workbook."""
    path = Path(path)
    doc = _open(path)
    try:
        words, drawings, images, pages = counts(doc)
    finally:
        doc.close()

    return classify(words, drawings, images, pages)


def summarise(results: dict[str, tuple[Tier, str]]) -> dict[str, int]:
    counts: dict[str, int] = {}
    for tier, _ in results.values():
        counts[tier.value] = counts.get(tier.value, 0) + 1
    return dict(sorted(counts.items()))


def main() -> int:
    ap = argparse.ArgumentParser(description="Classify a sheet's readability.")
    ap.add_argument("pdf")
    args = ap.parse_args()
    p = Path(args.pdf)
    if not p.is_file():
        print(f"ERROR: no file at {p}", file=sys.stderr)
        return 2
    try:
        tier, reason = probe(p)
    except ExtractionError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 2
    print(f"{tier.value}  {reason}")
    return 0 if tier is Tier.T2_VECTOR else 1


if __name__ == "__main__":
    raise SystemExit(main())
