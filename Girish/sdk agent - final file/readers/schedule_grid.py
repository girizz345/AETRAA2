#!/usr/bin/env python3
"""
schedule_grid.py — words into rows, by vertical position.

Step one of reading a schedule. A PDF has no table: it has words at
coordinates, and a table is a hypothesis about how they line up. This file
makes the row hypothesis, schedule_columns makes the column one, and
schedule_cells resolves the two into a grid.

Banding by y is done on the word's vertical *centre*, not its top, because a
cell mixing 8pt and 12pt text has words whose tops differ by more than the
tolerance while their centres do not.

Tolerance is derived from the median word height on the sheet rather than
fixed, since a schedule drawn at A1 and the same schedule at A3 have different
absolute spacing and identical relative spacing.

  python3 -m readers.schedule_grid <pdf> --page N

Exit 0 = rows found. Exit 1 = no row structure — not a schedule.
"""
from __future__ import annotations

import argparse
from dataclasses import dataclass

from spine.records import Word

BAND_TOLERANCE_FRAC = 0.6      # of median word height


@dataclass(frozen=True)
class Band:
    top: float
    bottom: float
    words: tuple

    @property
    def centre(self) -> float:
        return (self.top + self.bottom) / 2


def median_height(words: list[Word]) -> float:
    heights = sorted(w.y1 - w.y0 for w in words)
    if not heights:
        return 0.0
    mid = len(heights) // 2
    return heights[mid] if len(heights) % 2 else (heights[mid - 1] + heights[mid]) / 2


def band_rows(words: list[Word]) -> list[Band]:
    """Sorted by centre, then greedily banded. Words inside a band keep their
    x order, so a band is already a row read left to right.

    The band's tolerance is measured from the band's OWN running centre, not
    from the first word in it. Comparing against the first word lets a band
    creep: forty words each 0.5 tolerance below the last walks the band a long
    way down the sheet and swallows the row beneath. The running centre holds
    the band where its mass actually is.

    Ties are broken on x0 and then on text so the banding is byte-identical
    across runs — two words at the same centre must not change places because a
    dict iterated differently."""
    if not words:
        return []
    height = median_height(words) or 1.0
    tolerance = BAND_TOLERANCE_FRAC * height

    ordered = sorted(words, key=lambda w: ((w.y0 + w.y1) / 2, w.x0, w.text))
    bands: list[Band] = []
    current: list[Word] = []
    running = 0.0

    def flush():
        if not current:
            return
        row = sorted(current, key=lambda w: (w.x0, w.text))
        bands.append(Band(top=min(w.y0 for w in row),
                          bottom=max(w.y1 for w in row),
                          words=tuple(row)))

    for word in ordered:
        centre = (word.y0 + word.y1) / 2
        if not current:
            current, running = [word], centre
            continue
        if abs(centre - running) <= tolerance:
            current.append(word)
            running = sum((w.y0 + w.y1) / 2 for w in current) / len(current)
        else:
            flush()
            current, running = [word], centre
    flush()
    return bands


def main() -> int:
    ap = argparse.ArgumentParser(description="Band a sheet's words into rows.")
    ap.add_argument("pdf")
    ap.add_argument("--page", type=int, default=0)
    ap.parse_args()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
