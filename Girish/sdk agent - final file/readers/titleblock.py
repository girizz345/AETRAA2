#!/usr/bin/env python3
"""
titleblock.py — find the block, then read its fields.

Two jobs in one file because they share a failure mode: both are pattern-driven,
both fail on packages they were not built for, and both must report rather than
guess. A sheet whose block cannot be located, or whose fields no pattern
matches, is listed unresolved and NAMED. It is never inferred from the
filename — that is the tempting shortcut and the one that produces a register
which looks complete and is not.

Locating is a SCORE, not an assumption about where the block sits. A spec's
declared corner is a HINT, not a constraint: every candidate corner is tried
for every spec, and the winner is the region whose words satisfy the most of
that spec's patterns. That matters because a consultant's block is wherever
they drew it, and because a sheet whose /Rotate does not match how it was
drawn puts the block somewhere no convention predicts. The declared corner
still wins ties, so a well-behaved package resolves the way the spec expects.

A candidate without a DRAWING NUMBER never wins. Two or three incidental
pattern hits in the wrong corner would otherwise beat a real block, and a
register row with a revision and no drawing number is worse than an unresolved
one — it looks answered.

The SEARCH region is deliberately larger than the declared one. A width_frac
is a proportion of the sheet, and the same physical block is a different
proportion of a rotated page — a 490pt block is 29% of a 1684pt edge and 21%
of a 2384pt one. Searching at the declared fraction misses it by a few points
and reports the sheet unresolved, which is the worst outcome: a real block,
correctly extracted, thrown away by arithmetic. So the search is generous
(SEARCH_MARGIN, floored at SEARCH_MIN_FRAC) and the scoring does the work.
Requiring a drawing number is what makes a generous region safe.

The subtitle field is load-bearing and easy to treat as decoration. It carries
the floor multiplier — "TYPICAL FLOOR PLAN (2ND, 4TH & 6TH)" is three floors,
and getting it wrong was measured at a 16-58% undercount.

  python3 -m readers.titleblock <pdf> [--patterns data/titleblocks.json]

Exit 0 = all fields read. Exit 1 = one or more unresolved. Exit 2 = unreadable.
"""
from __future__ import annotations

import argparse
import re
import sys
from re import error
from dataclasses import dataclass
from pathlib import Path

from ingest.titleblocks import FIELDS, PatternSet, TitleBlockSpec
from readers.extract import extract_words, page_display_size, _open
from spine.records import Region, Word

STAGE = "S1"
DEFAULT_PATTERNS = Path(__file__).resolve().parent.parent / "data" / "titleblocks.json"


@dataclass(frozen=True)
class TitleBlockRead:
    fields: dict
    spec_name: str | None
    region: Region | None
    unmatched: tuple

    @property
    def resolved(self) -> bool:
        return bool(self.fields.get("drawing_no"))


CORNERS = ("lower-right", "lower-left", "upper-right", "upper-left",
           "right-strip", "left-strip", "bottom-strip", "top-strip")

SEARCH_MARGIN = 1.6      # of the spec's declared fraction
SEARCH_MIN_FRAC = 0.30   # never search a band narrower than this


def _search_fracs(spec, corner) -> tuple[float, float]:
    """The region actually searched. Generous — see the module docstring."""
    wf = max(spec.width_frac * SEARCH_MARGIN, SEARCH_MIN_FRAC)
    hf = max(spec.height_frac * SEARCH_MARGIN, SEARCH_MIN_FRAC)
    if corner in ("right-strip", "left-strip"):
        hf = 1.0
    elif corner in ("bottom-strip", "top-strip"):
        wf = 1.0
    return min(wf, 1.0), min(hf, 1.0)


def corner_region(corner: str, doc_id: str, page: int, w: float, h: float,
                  width_frac: float, height_frac: float) -> Region:
    cw, ch = w * width_frac, h * height_frac
    if corner == "lower-right":
        return Region(doc_id, page, w - cw, h - ch, w, h)
    if corner == "lower-left":
        return Region(doc_id, page, 0, h - ch, cw, h)
    if corner == "upper-right":
        return Region(doc_id, page, w - cw, 0, w, ch)
    if corner == "upper-left":
        return Region(doc_id, page, 0, 0, cw, ch)
    if corner == "right-strip":
        return Region(doc_id, page, w - cw, 0, w, h)
    if corner == "left-strip":
        return Region(doc_id, page, 0, 0, cw, h)
    if corner == "bottom-strip":
        return Region(doc_id, page, 0, h - ch, w, h)
    if corner == "top-strip":
        return Region(doc_id, page, 0, 0, w, ch)
    raise ValueError(f"unknown corner: {corner}")


def words_in(words: list[Word], r: Region) -> list[Word]:
    return [w for w in words
            if w.x0 >= r.x0 - 1 and w.x1 <= r.x1 + 1
            and w.y0 >= r.y0 - 1 and w.y1 <= r.y1 + 1]


def text_runs_vertically(words: list[Word]) -> bool:
    """True when the glyphs are rotated, so a logical line runs down the page.

    A /Rotate 90 or 270 sheet has its text rotated with it: the word "AR-102"
    comes back 13pt wide and 52pt tall, and the words of one line of the title
    block share an X, not a Y. Banding such a sheet by Y joins the LABELS of
    four different rows into one string — "SCALE: REVISION: TITLE: DRAWING" —
    and every pattern then fails on a block that was extracted perfectly.

    Detected from the glyph boxes rather than from page.rotation, because a
    sheet can carry rotated text on an unrotated page and the boxes are the
    thing that actually decides how to read it. A multi-character word that is
    taller than it is wide has been rotated."""
    votes = [(w.y1 - w.y0) > (w.x1 - w.x0) for w in words if len(w.text) > 2]
    return bool(votes) and sum(votes) > len(votes) / 2


# The four ways a block can be laid out relative to the page axes:
# (band axis, band ascending, along ascending). A /Rotate 180 sheet reads
# right-to-left and bottom-to-top; a /Rotate 270 one reads down-to-up.
ORIENTATIONS = (
    ("y", 1, 1),     # upright
    ("x", 1, 1),     # rotated 90
    ("y", -1, -1),   # rotated 180
    ("x", -1, -1),   # rotated 270
)


def _rows_oriented(words: list[Word], axis: str, band_dir: int,
                   along_dir: int) -> list[list[Word]]:
    """Band the words into rows under ONE candidate orientation."""
    if not words:
        return []
    band = (lambda w: w.x0) if axis == "x" else (lambda w: w.y0)
    size = (lambda w: w.x1 - w.x0) if axis == "x" else (lambda w: w.y1 - w.y0)
    along = (lambda w: w.y0) if axis == "x" else (lambda w: w.x0)

    rows: list[list[Word]] = []
    for w in sorted(words, key=lambda w: (round(band(w) * band_dir, 1),
                                          along(w) * along_dir)):
        if rows and abs(band(rows[-1][0]) - band(w)) <= max(2.0, size(w) * 0.6):
            rows[-1].append(w)
        else:
            rows.append([w])
    return [sorted(r, key=lambda w: along(w) * along_dir) for r in rows]


def rows_to_text(rows: list[list[Word]]) -> str:
    return "\n".join(" ".join(w.text for w in r) for r in rows)


def _as_text_oriented(words, axis, band_dir, along_dir) -> str:
    return rows_to_text(_rows_oriented(words, axis, band_dir, along_dir))


def reading_layouts(words: list[Word]) -> list[tuple]:
    """Every plausible reading, as (orientation, rows). See reading_orders."""
    vertical = text_runs_vertically(words)
    ordered = sorted(ORIENTATIONS,
                     key=lambda o: 0 if (o[0] == "x") == vertical else 1)
    return [(o, _rows_oriented(words, *o)) for o in ordered]


ALONG = {"x": (lambda w: w.y0, lambda w: w.y1),
         "y": (lambda w: w.x0, lambda w: w.x1)}


def column_bounds(row, offsets, c0: int, c1: int, axis: str,
                  match_end: int) -> tuple:
    """How wide the label's COLUMN is, not how wide the label is.

    A value is routinely wider than the label above it — "DWG NAME :" sits
    over "GROUND FLOOR PLAN". Clipping the value to the label's own span
    returns "GROUND" and loses the rest. So the column runs from this label's
    start to the START OF THE NEXT LABEL on the same row, which is what a
    table column actually is.

    match_end is the end of the WHOLE match, colon included. Using the label's
    own end instead makes this label's trailing colon look like the start of
    the next column, which clips the column to the label and returns the first
    word of the value — "GROUND" out of "GROUND FLOOR PLAN"."""
    start, end = ALONG[axis]
    mine = [w for (a, b, w) in offsets if a < c1 and b > c0]
    if not mine:
        return None, None
    lo = min(start(w) for w in mine)
    # the next label on this row begins the next column
    # On a label row, everything after this label's colon belongs to the NEXT
    # column — so the boundary is simply the next word, whether or not it
    # carries a colon of its own. Keying on the colon missed "REV NO." where
    # the colon sat in a separate cell, and the drawing-number column ran on
    # to swallow the revision: "A-102 R0".
    later = [w for (a, _b, w) in offsets if a >= match_end]
    hi = min(start(w) for w in later) if later else float("inf")
    return lo, max(hi, max(end(w) for w in mine))


def value_below(rows: list[list[Word]], axis: str, label_row: int,
                lo: float, hi: float, max_rows: int = 3, take: int = 1) -> str | None:
    """The value sitting UNDER a label, in a tabular block.

    EDMAC's block — and many UAE consultants' — is a grid, not a list:

        PROJECT NO. :   DWG NO. :   REV NO. :
        B-290           A-301       R0

    A pattern looking for "DWG NO. : <value>" on one line never sees A-301,
    and matches whatever inline label:value pair it finds first instead — on
    this package that was PLOT NO, so 64 sheets came back carrying the plot
    number as their drawing number. Correct-looking, and wrong.

    So: take the label's extent ALONG the line, then read the next row or two
    and keep the words whose own extent overlaps it. Orientation-safe, because
    rows and 'along' both come from the chosen reading order rather than from
    the page axes."""
    start, end = ALONG[axis]
    got: list[str] = []
    for r in range(label_row + 1, min(label_row + 1 + max_rows, len(rows))):
        hits = [w for w in rows[r] if start(w) < hi and end(w) > lo]
        text = " ".join(w.text for w in hits).strip(" :.-")
        if got and (not text or any(w.text.rstrip().endswith(":") for w in rows[r])):
            break                       # a blank row, or the next label row, ends a value
        if text:
            got.append(text)
            if len(got) >= take:
                break
    return " ".join(got) if got else None


def reading_orders(words: list[Word]) -> list[str]:
    """Every plausible reading of these words, best-guess first.

    A title block can be rotated with its sheet, and the rotation that a
    producer applied is not reliably recoverable — a sheet can carry rotated
    text on an unrotated page, and vice versa. So rather than assume, this
    returns all four candidate readings and the caller scores them against its
    own patterns. Four regexes over a few dozen words costs nothing, and it
    removes an assumption that was silently losing whole packages: banding a
    rotated block by Y joins the LABELS of four rows into one string
    ("SCALE: REVISION: TITLE: DRAWING") and every pattern then fails on a block
    that was extracted perfectly."""
    return [rows_to_text(rows) for _o, rows in reading_layouts(words)]


def as_text(words: list[Word]) -> str:
    """The single best-guess reading. reading_orders() is what the matcher
    uses; this exists for inspection and for callers that want one string."""
    orders = reading_orders(words)
    return orders[0] if orders else ""


def read_sheet(path: Path, patterns: PatternSet, page: int = 0) -> TitleBlockRead:
    """Convenience wrapper: opens the file itself. The register uses
    read_fields instead, because it already has the words and opening the
    same sheet twice on a 500-sheet package is minutes of wasted I/O."""
    words = list(extract_words(path, page))
    doc = _open(Path(path))
    try:
        dw, dh = page_display_size(doc[page])
    finally:
        doc.close()
    return read_fields(words, dw, dh, f"{Path(path).name}#{page}", patterns, page)


def _row_text_with_offsets(row) -> tuple[str, list[tuple]]:
    """The row as text, plus (char_start, char_end, word) for every word.

    The offsets are what make a positional match reliable: a label is located
    by WHERE it matched, not by comparing token strings. Comparing strings
    fails on exactly the rows that matter — "DWG NO. :" may arrive as three
    words or as one, and a row that happens to repeat a token elsewhere would
    widen the label's span across the whole line and take the entire value row
    with it."""
    parts, offsets, pos = [], [], 0
    for w in row:
        parts.append(w.text)
        offsets.append((pos, pos + len(w.text), w))
        pos += len(w.text) + 1
    return " ".join(parts), offsets


def _match_below(rows, axis: str, pattern) -> str | None:
    """Find the pattern's LABEL in a row, then take the value beneath it."""
    start, end = ALONG[axis]
    for i, row in enumerate(rows):
        text, offsets = _row_text_with_offsets(row)
        found = re.search(pattern.regex, text, re.IGNORECASE)
        if not found:
            continue
        try:
            c0, c1 = found.span("label")
        except (IndexError, error):
            c0, c1 = found.span(0)
        lo, hi = column_bounds(row, offsets, c0, c1, axis, found.end(0))
        if lo is None:
            continue
        head = ""
        if pattern.rows > 1:
            # a value that runs to more than one line can START on the label's
            # own line: "DRAWING TITLE : U.GROUND WATER" over "TANK&PUMP ROOM
            # DETAILS". Words after the colon that carry no label of their own
            # are that first line, and the column is not the next label's.
            after = [w for (a, _b, w) in offsets if a >= found.end(0)]
            if after and not any(w.text.rstrip().endswith(":") for w in after):
                head = " ".join(w.text for w in after)
                hi = float("inf")
        value = value_below(rows, axis, i, lo, hi, take=max(1, pattern.rows))
        value = " ".join(v for v in (head, value) if v) or None
        if value and pattern.value_regex:
            ok = re.search(pattern.value_regex, value, re.IGNORECASE)
            value = (ok.group("value") if ok and "value" in ok.groupdict()
                     else ok.group(0) if ok else None)
        if value:
            return value.strip()
    return None


def read_fields(words: list[Word], dw: float, dh: float, doc_id: str,
                patterns: PatternSet, page: int = 0) -> TitleBlockRead:
    """The actual work, on words a caller already has. The offices' own
    conventions first; the fallback specs only where none of them found a
    drawing number."""
    specs = list(patterns)
    best = (_best_read(words, dw, dh, doc_id, [s for s in specs if not s.fallback], page)
            or _best_read(words, dw, dh, doc_id, [s for s in specs if s.fallback], page))
    if best is None:
        return TitleBlockRead({}, None, None, tuple(FIELDS))
    _key, name, region, found = best
    return TitleBlockRead(found, name, region,
                          tuple(f for f in FIELDS if f not in found))


def _best_read(words, dw, dh, doc_id, specs, page):
    best: tuple[tuple, str, Region, dict] | None = None
    for spec in specs:
        for corner in CORNERS:
            wf, hf = _search_fracs(spec, corner)
            region = corner_region(corner, doc_id, page, dw, dh, wf, hf)
            region_words = words_in(words, region)
            if not region_words:
                continue
            found: dict[str, str] = {}
            labelled = False
            for orientation, rows in reading_layouts(region_words):
                text = rows_to_text(rows)
                trial: dict[str, str] = {}
                trial_labelled = False
                for pattern in spec.patterns:
                    if pattern.field in trial:
                        continue               # first match wins, declared order
                    if pattern.mode == "below":
                        value = _match_below(rows, orientation[0], pattern)
                    else:
                        value = pattern.match(text)
                    if value:
                        trial[pattern.field] = value
                        if pattern.field == "drawing_no" and pattern.mode == "below":
                            trial_labelled = True
                if "drawing_no" in trial and (trial_labelled, len(trial)) > (labelled, len(found)):
                    found, labelled = trial, trial_labelled
            if "drawing_no" not in found:
                continue                       # never wins without one
            if corner != spec.corner and len(found) < 2:
                # Away from the corner the spec declares, a drawing number
                # standing ALONE is a cross-reference, not a block: "REFER DRG
                # NO.S-05_2" in a note in the left margin named seven structure
                # sheets S-05_2. A real block moved by a rotated sheet still
                # gives its title, scale or revision with it.
                continue
            # prefer: a drawing number read from under its own DRAWING NO.
            # label - a table cell, the strongest evidence a block gives - then
            # more fields, then the spec's own declared corner, then the
            # tighter region, then the spec name — all deterministic. Counting
            # fields alone let a loose inline spec win by filling "title" and
            # "revision" with whatever followed JOB TITLE and REV.
            key = (labelled, len(found), corner == spec.corner,
                   -(region.x1 - region.x0) * (region.y1 - region.y0), spec.name)
            if best is None or key > best[0]:
                best = (key, spec.name, region, found)
    return best


EDGE_MIN_SPAN = 0.45     # a block's border runs at least this share of the page
EDGE_BAND = (0.55, 0.985)  # where such a border can sit; the last 1.5% is the sheet frame


def block_edge(path: Path, words: list[Word], drawing_no: str | None,
               page: int = 0) -> tuple[str, float] | None:
    """Where the title block starts, as ("x", edge) - everything right of the
    edge is the block - or ("y", edge) for a block along the bottom.

    Stage 6 needs this and the search region cannot supply it. The search
    region is deliberately generous (see the module docstring), so cutting it
    away would also cut away a schedule's right-hand columns; left in, the
    block's own revision table (DATE | DESCRIPTION | BY) and consultant rows
    line up better than an outlined schedule does and get read AS the
    schedule. So the edge is found from the drawing: the block's border is a
    ruled line running most of the sheet's height (or width).

    Anchored on the drawing number the register read: the edge is the
    right-most such rule still LEFT of that number, so a schedule's own long
    column rules - which lie left of the block - are never taken for it. With
    no anchor, no edge is claimed rather than one guessed."""
    anchors = [w for w in words if drawing_no and w.text.strip() == drawing_no.strip()]
    if not anchors:
        return None
    ax = min(w.x0 for w in anchors)
    ay = min(w.y0 for w in anchors)
    from readers.extract import rotate_point
    doc = _open(Path(path))
    try:
        pg = doc[page]
        rot = pg.rotation
        ur = pg.rect if rot in (0, 180) else type(pg.rect)(0, 0, pg.rect.height, pg.rect.width)
        uw, uh = ur.width, ur.height
        dw, dh = page_display_size(pg)
        verticals, horizontals = [], []
        for d in pg.get_drawings():
            for item in d.get("items", ()):
                if item[0] == "l":
                    (x0, y0), (x1, y1) = (rotate_point(p.x, p.y, rot, uw, uh) for p in item[1:3])
                    if abs(x1 - x0) < 1.5 and abs(y1 - y0) >= EDGE_MIN_SPAN * dh:
                        verticals.append((x0 + x1) / 2)
                    elif abs(y1 - y0) < 1.5 and abs(x1 - x0) >= EDGE_MIN_SPAN * dw:
                        horizontals.append((y0 + y1) / 2)
                elif item[0] == "re":
                    r = item[1]
                    (x0, y0), (x1, y1) = (rotate_point(r.x0, r.y0, rot, uw, uh),
                                          rotate_point(r.x1, r.y1, rot, uw, uh))
                    x0, x1, y0, y1 = min(x0, x1), max(x0, x1), min(y0, y1), max(y0, y1)
                    if y1 - y0 >= EDGE_MIN_SPAN * dh:
                        verticals += [x0, x1]
                    if x1 - x0 >= EDGE_MIN_SPAN * dw:
                        horizontals += [y0, y1]
    finally:
        doc.close()
    lo, hi = EDGE_BAND
    xs = [x for x in verticals if lo * dw < x < hi * dw and x <= ax - 2]
    if xs:
        return ("x", max(xs))
    ys = [y for y in horizontals if lo * dh < y < hi * dh and y <= ay - 2]
    if ys:
        return ("y", max(ys))
    return None


def outside_block(words: list[Word], edge: tuple[str, float] | None) -> list[Word]:
    """The words that are not in the title block."""
    if edge is None:
        return list(words)
    axis, at = edge
    return [w for w in words if (w.x1 if axis == "x" else w.y1) <= at + 1]


def main() -> int:
    ap = argparse.ArgumentParser(description="Read one sheet's title block.")
    ap.add_argument("pdf")
    ap.add_argument("--patterns", default=str(DEFAULT_PATTERNS))
    args = ap.parse_args()
    p = Path(args.pdf)
    if not p.is_file():
        print(f"ERROR: no file at {p}", file=sys.stderr)
        return 2
    read = read_sheet(p, PatternSet.load(Path(args.patterns)))
    print(f"spec: {read.spec_name or 'NONE MATCHED'}")
    for f in FIELDS:
        v = read.fields.get(f)
        print(f"  {f:<12} {v if v else '— unresolved'}")
    return 0 if not read.unmatched else 1


if __name__ == "__main__":
    raise SystemExit(main())
