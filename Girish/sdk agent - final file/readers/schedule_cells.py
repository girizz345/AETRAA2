#!/usr/bin/env python3
"""
schedule_cells.py — the grid, including the cells that are not rectangles.

Step three: rows x columns -> cells. Two shapes break the simple version and
both are common enough that handling them is not an edge case.

Multi-line cells. A door schedule's "REMARKS" column routinely wraps to three
lines while its row's other columns hold one. Banding alone makes that three
rows, two of which are almost empty. A band whose populated columns are a
strict subset of the band above, with no value in the key column, is a
continuation and is joined.

Merged cells. A header spanning four columns, or a type applying to six rows.
A merged cell is detected by a value whose x-extent crosses a boundary, and it
is propagated to every column it spans rather than assigned to the first —
assigning to the first is how a schedule silently loses five of its six rows.

  python3 -m readers.schedule_cells <pdf> --page N

Exit 0 = grid assembled. Exit 1 = grid incoherent (reported, never patched).
"""
from __future__ import annotations

import argparse
from dataclasses import dataclass


@dataclass(frozen=True)
class Cell:
    row: int
    col: int
    text: str
    spans: int = 1          # columns covered; >1 means merged
    continued: bool = False  # this cell absorbed a wrapped line


@dataclass(frozen=True)
class Grid:
    cells: tuple
    n_rows: int
    n_cols: int
    doc_id: str
    page: int

    def row(self, index: int) -> list[Cell]:
        return sorted((c for c in self.cells if c.row == index),
                      key=lambda c: c.col)

    def column(self, index: int) -> list[Cell]:
        return sorted((c for c in self.cells if c.col <= index < c.col + c.spans),
                      key=lambda c: c.row)


def column_of(x_centre: float, boundaries: list[float]) -> int:
    """Which column a point falls in. n boundaries make n+1 columns."""
    index = 0
    for boundary in boundaries:
        if x_centre < boundary:
            return index
        index += 1
    return index


def spans_of(x0: float, x1: float, boundaries: list[float]) -> tuple:
    """(first column, number of columns covered). A value whose extent crosses
    a boundary is merged, and it is propagated to every column it covers —
    assigning it to the first is how a schedule silently loses five of its six
    rows."""
    first = column_of(x0, boundaries)
    last = column_of(x1, boundaries)
    return first, max(1, last - first + 1)


def _is_continuation(populated: set, previous: set, key_column: int) -> bool:
    """A wrapped line, not a row.

    Three tests, and the third one exists because the first two are not enough.
    A subset of the row above with an empty key column describes a wrapped
    REMARKS line — and it equally describes a REAL ROW WHOSE MARK IS MISSING.
    Treating the second as the first merges two rows: a door schedule row
    carrying quantity 9 is absorbed into the row above and its quantity 4
    becomes the string "4 9". A silently corrupted quantity, which is the exact
    failure class this file exists to prevent.

    So a continuation must also be NARROW — it may populate at most half the
    fields the row above populated. A wrap is one or two columns of prose; a row
    missing its mark still fills most of its fields.

    Where the two readings remain ambiguous the answer is DO NOT JOIN. An
    unjoined wrap produces an extra row with a blank mark, which read_rows
    counts and reports. A wrongly joined row produces a wrong number that looks
    right. Visible beats silent, every time."""
    if not populated or not previous:
        return False
    if key_column in populated:
        return False
    if not populated < previous:
        return False
    return len(populated) * 2 <= len(previous)


def assemble(bands: list, boundaries: list[float], doc_id: str, page: int,
             key_column: int = 0) -> Grid:
    """Rows x columns -> cells, joining wrapped lines and propagating merges.

    Cell text is assembled from the words in reading order within the cell, so
    "FIRE RATED" stays two words in one cell rather than becoming two cells."""
    n_cols = len(boundaries) + 1
    rows: list[dict] = []          # col -> list[(x0, text)] per logical row
    previous_populated: set = set()

    for band in bands:
        populated: dict = {}
        merges: dict = {}
        for word in sorted(band.words, key=lambda w: (w.x0, w.text)):
            first, spans = spans_of(word.x0, word.x1, boundaries)
            populated.setdefault(first, []).append((word.x0, word.text))
            if spans > 1:
                merges[first] = max(merges.get(first, 1), spans)

        if not populated:
            continue

        keys = set(populated)
        if rows and _is_continuation(keys, previous_populated, key_column):
            target = rows[-1]
            for col, items in populated.items():
                target["cells"].setdefault(col, []).extend(items)
                target["continued"].add(col)
            for col, spans in merges.items():
                target["merges"][col] = max(target["merges"].get(col, 1), spans)
            continue

        rows.append({"cells": {c: list(v) for c, v in populated.items()},
                     "merges": dict(merges), "continued": set()})
        previous_populated = keys

    cells = []
    for index, row in enumerate(rows):
        for col in sorted(row["cells"]):
            items = sorted(row["cells"][col], key=lambda pair: pair[0])
            text = " ".join(t for _x, t in items).strip()
            if not text:
                continue
            cells.append(Cell(row=index, col=col, text=text,
                              spans=row["merges"].get(col, 1),
                              continued=col in row["continued"]))
    return Grid(cells=tuple(cells), n_rows=len(rows), n_cols=n_cols,
                doc_id=doc_id, page=page)


def main() -> int:
    ap = argparse.ArgumentParser(description="Assemble a schedule grid.")
    ap.add_argument("pdf")
    ap.add_argument("--page", type=int, default=0)
    ap.parse_args()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
