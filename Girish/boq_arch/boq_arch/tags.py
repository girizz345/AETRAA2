"""Door / window tags counted on the plans (text layer, COUNTED)."""
from __future__ import annotations

import re
from collections import Counter

from .sheet import Sheet

# single-word tags: D1, D-1, SD2, LD1 ...; two-word tags stacked in a hexagon: "DW" over "03"
ONE_WORD = re.compile(r"^(D|SD|LD|W|LW|DW|FD)-?(\d{1,2})$")
TWO_WORD_PREFIX = {"DW", "LW", "W", "D", "SD", "LD"}
MARK_LIKE = re.compile(r"[A-Z]{1,3}\d{0,2}[-.]?\d{1,3}[A-Z]?")


def tag_id(x: float, y: float) -> str:
    """A tag's id, from where it sits on the sheet (so the same drawing always gives the same ids)."""
    return f"t{round(x * 10)}_{round(y * 10)}"


def norm_mark(mark: str) -> str:
    """'D-1', 'D1', 'DW 03', 'DW03', 'DW-3' -> 'D1' / 'DW3'."""
    m = re.match(r"^\s*([A-Z]+)\s*-?\s*0*(\d+)\s*$", mark.upper())
    return f"{m.group(1)}{m.group(2)}" if m else mark.upper().replace(" ", "")


def count_tags(sheet: Sheet, known: set[str]) -> tuple[Counter, list[tuple[str, float, float]]]:
    """Counts of each known (normalised) mark on the sheet, and every hit's position."""
    words = sheet.own_words
    hits: list[tuple[str, float, float]] = []
    used: set[int] = set()
    nums = [(i, w) for i, w in enumerate(words) if re.fullmatch(r"\d{1,2}", w.text)]
    for i, w in enumerate(words):
        t = w.text.strip().upper()
        m = ONE_WORD.match(t)
        if m:
            k = norm_mark(t)
            if k in known:
                hits.append((k, w.cx, w.cy))
            continue
        if MARK_LIKE.fullmatch(t) and norm_mark(t) in known:
            # a mark in the schedule's own form, which the pattern above does not know: a floor-prefixed
            # "D1-08" (floor 1, door 08) was never counted, and every door read "no tag on any plan"
            hits.append((norm_mark(t), w.cx, w.cy))
            continue
        if t in TWO_WORD_PREFIX:
            h = w.y1 - w.y0
            below = [(j, n) for j, n in nums if j not in used and abs(n.cx - w.cx) < 1.2 * h
                     and 0 < n.cy - w.cy < 1.6 * h]
            if below:
                j, n = min(below, key=lambda jn: jn[1].cy - w.cy)
                k = norm_mark(t + n.text)
                if k in known:
                    used.add(j)
                    hits.append((k, w.cx, (w.cy + n.cy) / 2))
    # the underlay test needs the openings' layers; a PDF with no layer names at all has no underlay to tell
    # apart, and the test dropped every tag on it
    if any(getattr(s, "layer", "") for s in sheet.segments):    # a CAD sheet (cad.CadSheet) has segments too
        hits = [h for h in hits if _drawn_here(sheet, h[1], h[2])]
    # a tag printed twice on the same spot (some programs write each label's text twice) is one tag
    one: list[tuple[str, float, float]] = []
    for h in hits:
        if not any(k == h[0] and abs(x - h[1]) < 1 and abs(y - h[2]) < 1 for k, x, y in one):
            one.append(h)
    return Counter(k for k, _, _ in one), one


OPENING_LAYERS = ("WALL", "DOOR", "GLASS", "JAMB", "WIN")


def _drawn_here(sheet: Sheet, x: float, y: float, radius_pt: float = 30.0) -> bool:
    """A tag belongs to this sheet only if the opening it marks is drawn on this sheet's own layers.

    A plan that shows another level as an underlay repeats that level's tags; some of
    that text carries no layer name, so the geometry test is what tells them apart.
    """
    idx = _index(sheet)
    cx, cy = int(x // 20), int(y // 20)
    for gx in (cx - 2, cx - 1, cx, cx + 1, cx + 2):
        for gy in (cy - 2, cy - 1, cy, cy + 1, cy + 2):
            for sx, sy in idx.get((gx, gy), ()):
                if (sx - x) ** 2 + (sy - y) ** 2 <= radius_pt ** 2:
                    return True
    return False


def _index(sheet: Sheet) -> dict:
    """The sheet's opening geometry on a 20 pt grid, built once and kept on the sheet itself (a cache keyed by
    id(sheet) handed a new sheet the index of a closed one whose id it had been given)."""
    grid = sheet.__dict__.get("_opening_index")
    if grid is None:
        grid = {}
        for s in sheet.own_segments:
            if any(w in s.layer.upper() for w in OPENING_LAYERS):
                for t in (0.0, 0.5, 1.0):
                    px, py = s.x0 + (s.x1 - s.x0) * t, s.y0 + (s.y1 - s.y0) * t
                    grid.setdefault((int(px // 20), int(py // 20)), []).append((px, py))
        sheet.__dict__["_opening_index"] = grid
    return grid
