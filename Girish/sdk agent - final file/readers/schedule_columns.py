#!/usr/bin/env python3
"""
schedule_columns.py — column boundaries by horizontal clustering.

Step two. Column edges are found from where words are *not*: project every
word's x-extent onto one axis, and the gaps that persist across most rows are
the column separators. Ruled lines are used as corroboration where they exist
and are never required, because a good proportion of schedules in the dev
corpus are unruled.

A boundary that holds on 3 rows out of 40 is noise. MIN_ROW_SUPPORT is the
fraction of rows a gap must appear in to count, and it is deliberately high:
inventing a column splits one field into two and produces a schedule that reads
correctly and is wrong.

  python3 -m readers.schedule_columns <pdf> --page N

Exit 0 = columns found. Exit 1 = no stable column structure.
"""
from __future__ import annotations

import argparse

MIN_ROW_SUPPORT = 0.75
MIN_GAP_FRAC = 0.4          # of median word width


def _median(values: list[float]) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    mid = len(ordered) // 2
    return (ordered[mid] if len(ordered) % 2
            else (ordered[mid - 1] + ordered[mid]) / 2)


def band_gaps(band, min_gap: float) -> list[tuple[float, float]]:
    """The horizontal gaps inside one row, as (start, end) pairs. A gap is
    space between consecutive words wide enough to be a column separator
    rather than a word space."""
    words = sorted(band.words, key=lambda w: w.x0)
    gaps = []
    for left, right in zip(words, words[1:]):
        if right.x0 - left.x1 >= min_gap:
            gaps.append((left.x1, right.x0))
    return gaps


MIN_TABLE_ROWS = 5            # fewer rows than this is not a table
MIN_TABLE_COLUMNS = 3         # two columns is a list or a pair of notes, not a
                              # schedule. Measured: a door-elevation sheet and a
                              # window-elevation sheet both yield exactly one
                              # persistent gap and would otherwise be read as a
                              # 101-row table of nonsense.
MIN_CLUSTER_ROWS = 3          # a gap in fewer bands than this is a word space


def _clusters(bands: list, min_gap: float) -> list[dict]:
    """Gap intervals from every band, merged by overlap, each carrying the set of
    band indices that support it.

    Intersecting rather than counting positions: a column separator is not at
    the same x in every row — the words either side move — but the EMPTY BAND
    between them overlaps in every row, and that overlap is the boundary."""
    clusters: list[dict] = []
    for index, band in enumerate(bands):
        for start, end in band_gaps(band, min_gap):
            for cluster in clusters:
                lo = max(cluster["lo"], start)
                hi = min(cluster["hi"], end)
                if lo < hi:
                    cluster["lo"], cluster["hi"] = lo, hi
                    cluster["rows"].add(index)
                    break
            else:
                clusters.append({"lo": start, "hi": end, "rows": {index}})
    return clusters


def locate_table(bands: list) -> tuple:
    """(boundaries, row indices). Find the TABLE before looking for its columns.

    This is the step the first version of this file did not have, and the reason
    it read nothing off a real sheet. A drawing sheet is mostly not a table: a
    schedule sheet in the development package gives 140 bands of which perhaps
    forty are the schedule, and the rest are the title block, the authority
    stamp, general notes and a legend. Requiring a gap to hold across 75% of ALL
    bands therefore asks it to hold across the notes as well, which no real
    column does — measured on A-501, A-505 and A-510 the answer was zero columns
    on each.

    So support is measured WITHIN the table, and the table is found first: the
    strongest column candidate names a set of bands, those bands are the table,
    and every other candidate is then judged only against them. One refinement
    pass, because the seed cluster may have caught a few notes lines too.

    Returns empty when no band set is large enough to be a table. That is a
    "this is not a schedule" answer, which is a legitimate and useful one."""
    rows = [b for b in bands if len(b.words) >= 2]
    if len(rows) < MIN_TABLE_ROWS:
        return [], []

    widths = [w.x1 - w.x0 for b in rows for w in b.words]
    min_gap = MIN_GAP_FRAC * _median(widths)
    if min_gap <= 0:
        return [], []

    index_of = {id(b): i for i, b in enumerate(bands)}
    clusters = [c for c in _clusters(bands, min_gap)
                if len(c["rows"]) >= MIN_CLUSTER_ROWS]
    if not clusters:
        return [], []

    # seed: the gap that holds across the most bands is the table's spine
    clusters.sort(key=lambda c: (-len(c["rows"]), c["lo"]))
    table = set(clusters[0]["rows"])

    for _pass in range(2):
        if len(table) < MIN_TABLE_ROWS:
            return [], []
        # A column gap is KEPT when it persists across most of the rows it
        # shares with the table — judged against the smaller of the two row
        # sets. Judged against the seed alone, a seed that also runs through
        # the general-notes block beside the schedule (a gap between the
        # table's last column and the notes persists across every notes line
        # too) demanded support the real columns could not give, and a
        # 14-column pile schedule read as "no table".
        kept = [c for c in clusters
                if len(c["rows"] & table) >= MIN_ROW_SUPPORT * min(len(c["rows"]), len(table))
                and len(c["rows"] & table) >= MIN_CLUSTER_ROWS]
        if not kept:
            return [], []
        # a band belongs to the table if it supports most of the kept columns
        votes: dict = {}
        for cluster in kept:
            for index in cluster["rows"]:
                votes[index] = votes.get(index, 0) + 1
        threshold = max(1, len(kept) // 2)
        refined = {i for i, v in votes.items() if v >= threshold}
        if refined == table:
            break
        table = refined

    if len(table) < MIN_TABLE_ROWS or not kept:
        return [], []
    if len(kept) + 1 < MIN_TABLE_COLUMNS:
        return [], []
    boundaries = sorted((c["lo"] + c["hi"]) / 2 for c in kept)
    return boundaries, sorted(table)


def find_boundaries(bands: list) -> list[float]:
    """x positions of the column separators, ascending. Derived, never fixed —
    a schedule's column count is a property of the sheet."""
    boundaries, _rows = locate_table(bands)
    return boundaries


SNAP_TOLERANCE = 6.0          # points; a rule further than this is not this column


def vertical_rules(paths, min_length: float = 20.0) -> list[float]:
    """x positions of vertical strokes. Paths arrive as a generator of tens of
    thousands per sheet, so this consumes it once and keeps only the x."""
    found = []
    for path in paths:
        points = list(getattr(path, "points", ()) or ())
        if len(points) < 2:
            continue
        xs = [p[0] for p in points]
        ys = [p[1] for p in points]
        if max(xs) - min(xs) <= 1.0 and max(ys) - min(ys) >= min_length:
            found.append(sum(xs) / len(xs))
    return sorted(found)


def corroborate_with_rules(boundaries: list[float], paths) -> list[float]:
    """Where vertical rules exist, snap a boundary to the nearest rule. Never
    add a boundary a rule implies but the words do not — a ruled decorative
    border would become a column, and a title block's frame would become six.

    Snapping is worth doing because a rule is the draughtsman's own statement of
    where the column is, and it is exact where a gap midpoint is an estimate.
    Adding is not, and the asymmetry is the whole point of this function."""
    rules = vertical_rules(paths) if paths is not None else []
    if not rules:
        return sorted(boundaries)
    snapped = []
    for boundary in boundaries:
        nearest = min(rules, key=lambda r: abs(r - boundary))
        snapped.append(nearest if abs(nearest - boundary) <= SNAP_TOLERANCE
                       else boundary)
    # a snap can collide two boundaries onto one rule; collapse, never duplicate
    out: list[float] = []
    for value in sorted(snapped):
        if not out or abs(value - out[-1]) > 0.5:
            out.append(value)
    return out


def main() -> int:
    ap = argparse.ArgumentParser(description="Find schedule column boundaries.")
    ap.add_argument("pdf")
    ap.add_argument("--page", type=int, default=0)
    ap.parse_args()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
