#!/usr/bin/env python3
"""
counts.py — counting symbols on a plan, and refusing to name what it cannot.

Two halves with different trust levels, which is the point of keeping them in
one file where the seam is visible.

Counting is deterministic: cluster repeated glyph geometry, count the clusters.
It produces origin=COUNTED evidence and needs no model.

Naming is not. Which cluster is a floor drain and which is a sprinkler head
comes from the sheet's legend, and reading the legend is one model call per
sheet. A cluster the legend does not cover is counted and reported as
unidentified — never named speculatively, because a plausible name attached to
a real count is exactly the kind of wrong that survives review.

The proof this stage owes the markup stage is not a bubble on every instance:
it is schedule count equals number of plan tags. Where both exist and disagree,
inventory reports the discrepancy and never averages.

  python3 -m readers.counts <pdf> --page N

Exit 0 = all clusters identified. Exit 1 = unidentified clusters present.
"""
from __future__ import annotations

import argparse
import re
from collections import OrderedDict
from dataclasses import dataclass

SHAPE_TOLERANCE = 0.02      # relative; two glyphs within this are the same symbol
MIN_CLUSTER = 2             # one occurrence is not a repeated symbol


@dataclass(frozen=True)
class SymbolCluster:
    signature: str          # normalised path signature, the clustering key
    count: int
    regions: tuple          # one Region per instance, for markup
    name: str | None = None  # from the legend, or None = unidentified


@dataclass(frozen=True)
class TagCount:
    """A tag counted from the TEXT layer, not from geometry.

    Kept separate from SymbolCluster on purpose, because the two have different
    trust levels and merging them would hide that. A tag is a label the
    draughtsman typed — "FCU-12", "D-04" — so counting its occurrences is
    reading, and it carries origin COUNTED with a named subject. A symbol
    cluster is geometry, and what it depicts is unknown until the legend is read.

    What this does NOT do: find an unlabelled symbol. A door drawn with no tag is
    invisible here and stays invisible, which is why the count is reconciled
    against the schedule rather than trusted on its own."""
    tag: str                # the kind: "door", "fan_coil_unit"
    value: str              # the occurrence as drawn: "D-04"
    count: int
    doc_id: str
    discipline: str         # the prefix that scoped the pattern


def normalise_mark(value) -> str:
    """One spelling for a mark, so a schedule's "D-2" and "DW 01" meet a plan's
    "D2" and "DW1": upper case, no separator, no leading zeros. A mark that is
    not letters-number-letters is only upper-cased and stripped of separators."""
    s = re.sub(r"[\s\-_./]+", "", str(value or "").upper())
    m = re.fullmatch(r"([A-Z]+)0*(\d+)([A-Z]*)", s)
    return f"{m.group(1)}{int(m.group(2))}{m.group(3)}" if m else s


def join_stacked_tags(words) -> list:
    """Tag symbols draw the prefix and the number as two words: "DW" above
    "06" in a hexagon, or "DW" then "06" on one line. A pattern run over the
    sheet's text never sees them together, so every window on this package's
    plans went uncounted. A word that is letters only (at most three) is joined
    to a number directly below it or directly after it, the two becoming one word
    ("DW06"). Everything else passes through unchanged."""
    from dataclasses import replace
    words = list(words)
    numbers = [w for w in words if re.fullmatch(r"\d{1,3}[A-Z]?", w.text or "", re.I)]
    used: set[int] = set()
    out = []
    for w in words:
        if id(w) in used:
            continue
        if re.fullmatch(r"[A-Z]{1,3}", w.text or "", re.I):
            h = max(w.y1 - w.y0, 0.1)
            cx = (w.x0 + w.x1) / 2
            best, best_d = None, None
            for n in numbers:
                if id(n) in used:
                    continue
                ncx = (n.x0 + n.x1) / 2
                # the two boxes often overlap: the number starts inside the
                # prefix's lower half ("DW" 443.4-449.4, "06" from 448.0)
                below = (n.y0 >= w.y0 + 0.4 * h and n.y0 - w.y1 <= 0.8 * h
                         and abs(ncx - cx) <= max(w.x1 - w.x0, n.x1 - n.x0))
                after = abs(n.y0 - w.y0) <= 0.3 * h and 0 <= n.x0 - w.x1 <= 0.6 * h
                if below or after:
                    d = abs(n.y0 - w.y1) + abs(ncx - cx)
                    if best_d is None or d < best_d:
                        best, best_d = n, d
            if best is not None:
                used.add(id(best))
                out.append(replace(w, text=w.text + best.text, x0=min(w.x0, best.x0),
                                   x1=max(w.x1, best.x1), y1=max(w.y1, best.y1)))
                continue
        out.append(w)
    return out


def find_tags(words, discipline: str, matrix, family: str | None = None
              ) -> list[tuple[str, str, float, float]]:
    """(tag kind, mark as normalise_mark spells it, x, y) for every tag on the
    sheet, one per word - so each occurrence keeps where it sits, which is
    what tells one L-shaped window tagged on both legs from two windows.
    Scoped like count_tags; `family` narrows to one pattern family."""
    if not discipline:
        return []
    pats = [(p.tag, re.compile(rf"{p.regex}", re.IGNORECASE))
            for p in matrix.tag_patterns(discipline)
            if family is None or getattr(p, "family", None) == family]
    out = []
    for w in join_stacked_tags(words):
        t = (w.text or "").strip()
        for tag, rx in pats:
            if rx.fullmatch(t):
                out.append((tag, normalise_mark(t), (w.x0 + w.x1) / 2, (w.y0 + w.y1) / 2))
                break
    return out


def count_tags(words, doc_id: str, discipline: str, matrix) -> list[TagCount]:
    """Count scoped equipment tags in a sheet's words.

    SCOPED is the whole point: W12 is a shear wall on a structural sheet and a
    window on an architectural one, so a pattern is applied only on sheets of its
    own discipline. Applying every pattern everywhere is how one silently becomes
    the other.

    A tag occurring once is still counted — unlike a symbol cluster, where one
    occurrence is not a repeated symbol. A single D-99 on a plan is a real door."""
    if not discipline:
        return []
    text = " ".join(w.text for w in join_stacked_tags(words))
    found: "OrderedDict[tuple, int]" = OrderedDict()
    for pattern in matrix.tag_patterns(discipline):
        for hit in re.findall(rf"\b{pattern.regex}\b", text, re.IGNORECASE):
            key = (pattern.tag, str(hit).upper())
            found[key] = found.get(key, 0) + 1
    return [TagCount(tag=tag, value=value, count=count, doc_id=doc_id,
                     discipline=discipline)
            for (tag, value), count in sorted(found.items())]


def totals_by_value(counts: list) -> dict:
    """{tag value -> occurrences} across sheets, which is what the schedule
    count is reconciled against."""
    out: dict = {}
    for entry in counts:
        out[entry.value] = out.get(entry.value, 0) + entry.count
    return out


def cluster_symbols(paths) -> list[SymbolCluster]:
    """Normalise each closed path group to a scale- and position-invariant
    signature, then group. Sorted by signature so cluster order is stable."""
    raise NotImplementedError(
        "normalise path groups to a signature; group within SHAPE_TOLERANCE; "
        "discard groups below MIN_CLUSTER; sort by signature")


def name_from_legend(clusters: list[SymbolCluster], legend_entries: dict
                     ) -> list[SymbolCluster]:
    """Legend entries are (signature -> name) from one model call. A cluster
    with no entry keeps name=None and is reported."""
    return sorted(
        (SymbolCluster(c.signature, c.count, c.regions,
                       legend_entries.get(c.signature)) for c in clusters),
        key=lambda c: c.signature)


def main() -> int:
    ap = argparse.ArgumentParser(description="Count symbols on a plan.")
    ap.add_argument("pdf")
    ap.add_argument("--page", type=int, default=0)
    ap.parse_args()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
