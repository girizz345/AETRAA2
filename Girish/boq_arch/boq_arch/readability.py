"""How can a page (or a region of it) be read? Decides text extraction vs direct visual reading.

Four classes, decided per region from the PDF itself:
  TEXT      real text in the text layer               -> extract as text (STATED)
  OUTLINED  vector glyphs, no text (text to curves)     -> render the region, read it (READ (VISUAL))
  RASTER    a scanned / embedded image covers it        -> render the region, read it (READ (VISUAL))
  EMPTY     nothing drawn there
A page is TEXT, OUTLINED, RASTER or MIXED from its body and title-block regions.
A sheet with a CAD file supplied beside it is CAD and bypasses all of this (see cad.py).
"""
from __future__ import annotations

import re
from dataclasses import dataclass

import pymupdf

from .sheet import Sheet

TEXT, OUTLINED, RASTER, EMPTY, MIXED, CAD = "TEXT", "OUTLINED", "RASTER", "EMPTY", "MIXED", "CAD"


@dataclass
class RegionClass:
    cls: str
    words: int
    vectors: int
    image_cover: float

    @property
    def how(self) -> str:
        return {TEXT: "text layer extraction", OUTLINED: "direct visual reading (text is outlined to curves)",
                RASTER: "direct visual reading (scanned / raster image)", EMPTY: "nothing to read"}[self.cls]


def _images(sheet: Sheet) -> list[pymupdf.Rect]:
    m = sheet.page.rotation_matrix
    out = []
    for info in sheet.page.get_image_info():
        r = pymupdf.Rect(info["bbox"]) * m
        if r.width > 5 and r.height > 5:
            out.append(r)
    return out


def _points(sheet: Sheet):
    """Word centres and vector-item midpoints as arrays, computed once per sheet and kept on the sheet itself (a
    cache keyed by id(sheet) handed a new sheet the points of a closed one whose id it had been given)."""
    import numpy as np
    got = sheet.__dict__.get("_points")
    if got is None:
        w = np.array([(x.cx, x.cy) for x in sheet.words], dtype=float).reshape(-1, 2)
        m = sheet.page.rotation_matrix
        pts = []
        for d in sheet.page.get_drawings():
            r = pymupdf.Rect(d["rect"]) * m
            pts.extend([((r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2)] * max(1, len(d["items"])))
        v = np.array(pts, dtype=float).reshape(-1, 2)
        got = sheet.__dict__["_points"] = (w, v, _images(sheet))
    return got


def _count(arr, rect) -> int:
    if not len(arr):
        return 0
    return int(((arr[:, 0] >= rect.x0) & (arr[:, 0] <= rect.x1) & (arr[:, 1] >= rect.y0) & (arr[:, 1] <= rect.y1)).sum())


def classify_region(sheet: Sheet, rect: pymupdf.Rect, min_words: int = 4) -> RegionClass:
    wpts, vpts, imgs = _points(sheet)
    words, vectors = _count(wpts, rect), _count(vpts, rect)
    area = max(rect.width * rect.height, 1e-6)
    cover = sum((r & rect).width * (r & rect).height for r in imgs if r.intersects(rect)) / area
    if cover > 0.5 and words < min_words:
        cls = RASTER
    elif words >= min_words:
        cls = TEXT
    elif vectors > 40:
        cls = OUTLINED
    else:
        cls = EMPTY
    return RegionClass(cls, words, vectors, round(min(cover, 1.0), 3))


# the words a title block labels its fields with; its position is found from where they gather
_TB_LABEL = re.compile(r"^(DRAWING|DRAWINGS?|DRG|DWG|SCALE|DATE|REV|REV\.|REVISION|DRAWN|CHECKED|APPROVED|PROJECT|"
                       r"CLIENT|OWNER|SHEET|TITLE|JOB|CONSULTANT|ARCHITECTS?|ISSUE|NO\.?)[:.]?$", re.I)


def _tb_candidates(W: float, H: float) -> list[pymupdf.Rect]:
    """Where offices put a title block, the house layout first: a strip down the lower right edge (EMSQUARE), a
    band along the bottom right (IIT Bombay, Habitat), a corner box, a full-height right strip (Chief
    Architect), a full-width bottom strip."""
    return [pymupdf.Rect(W * 0.86, H * 0.68, W * 0.995, H * 0.99),
            pymupdf.Rect(W * 0.55, H * 0.80, W * 0.995, H * 0.995),
            pymupdf.Rect(W * 0.70, H * 0.70, W * 0.995, H * 0.995),
            pymupdf.Rect(W * 0.86, H * 0.02, W * 0.995, H * 0.99),
            pymupdf.Rect(W * 0.02, H * 0.86, W * 0.995, H * 0.995)]


def title_block_rect(sheet: Sheet, whole_lines: bool = True) -> pymupdf.Rect:
    """The title block panel, found from its field labels rather than assumed to be in one corner.

    The crop used to be the house layout's strip down the lower right edge, whatever the office: on a set whose
    block is a band along the bottom (IIT Bombay's) the image sent to be read was blank paper, so no reader - an
    API or a Claude sign-in - could have read it. Each place a title block goes is scored by the labels it holds
    for its size; the densest wins (the house strip on a tie), and the crop is those labels' extent with a margin
    - the drawing number, often large drawn letters beside them, falls inside it. A sheet with no labels there (a
    cover or divider sheet) keeps the house strip."""
    W, H = sheet.width, sheet.height
    cands = _tb_candidates(W, H)
    words = [w for w in sheet.words if _TB_LABEL.match(w.text.strip()) and not _caption(sheet, w)
             and not _in_notes(sheet, w)]

    def inside(r):
        return [w for w in words if r.contains(pymupdf.Point((w.x0 + w.x1) / 2, (w.y0 + w.y1) / 2))]
    counts = [len(inside(c)) for c in cands]
    # the densest of the places that hold (nearly) all the labels; on a tie the earlier one (the house strip
    # first). Density alone chose the house strip on a sheet whose block only reached into it - a few of its
    # labels in a small area - and the crop cut the block in half.
    full = [i for i in range(len(cands)) if counts[i] >= 0.8 * max(counts)]
    best = max(full, key=lambda i: (counts[i] / max(cands[i].width * cands[i].height, 1.0), -i))
    hits = inside(cands[best])
    if best == 0 or len(hits) < 2:
        return cands[0]                     # the house layout, cropped exactly as before
    # from the labels to the sheet's edge: a block runs to the border, and its drawing number - large letters,
    # often drawn as outlines, so no label of its own - sits at the far right or the foot of it
    c = cands[best]
    m = 0.05 * min(W, H)
    box = pymupdf.Rect(min(w.x0 for w in hits) - m, min(w.y0 for w in hits) - m, c.x1, c.y1)
    if best == 3:
        box.y0 = c.y0                       # a full-height strip is read whole
    else:
        box.x0 = min(box.x0, max(c.x0, _panel_left(sheet, box, c)))
        if whole_lines:                     # the crop to read; the block itself without
            box.x0 = _whole_lines(sheet, box)
    return box & pymupdf.Rect(0, 0, W, H)


def _whole_lines(sheet: Sheet, box: pymupdf.Rect) -> float:
    """The crop's left edge, moved left past each line of text the block's edge runs through, to the line's start:
    an office that prints the drawing's name across the block's left edge ("RECEPTION TABLE DETAIL - 02") had it
    read as "...AIL - 02". Only those lines - walking on from the new edge reached the sheet's notes - and a line
    reaching further than 0.45 of the width is no drawing's name: the edge then stays. Capping the walk instead
    left the edge inside a word ("...SE AREA WALL PANELLING DETAIL - 03")."""
    left, seen = box.x0, set()
    for w in sheet.words:
        h = _letter_h(w)
        if not (box.y0 <= (w.y0 + w.y1) / 2 <= box.y1 and w.x0 - 3 * h < box.x0 < w.x1 + 3 * h):
            continue                        # only words at the edge can be on a line it cuts
        run = _line_run(sheet, w)
        key = (round(run[0].x0), round(run[0].y0))
        if key in seen or not run[0].x0 < box.x0 < run[-1].x1:
            continue                        # the line does not cross the edge: through a word or between two
        seen.add(key)
        if box.x0 - run[0].x0 <= 0.45 * sheet.width:  # a longer line is no drawing's name: that one stays cut
            left = min(left, run[0].x0 - 2)
    return left


def _letter_h(w) -> float:
    """A word's letter height: its box's short side (a word written up the page, or a large logo, has a tall box)."""
    return max(min(w.x1 - w.x0, w.y1 - w.y0), 1.0)


def _line_run(sheet: Sheet, w) -> list:
    """The words of w's line around it: on its baseline, of about its letter height, gaps under 1.5 letter heights -
    a big logo word or a label written up the page does not take in the small text beside it."""
    h, cy = _letter_h(w), (w.y0 + w.y1) / 2
    near = sorted((v for v in sheet.words if abs((v.y0 + v.y1) / 2 - cy) < 0.4 * h
                   and abs(_letter_h(v) - h) <= 0.3 * h), key=lambda v: v.x0)
    i = next((k for k, v in enumerate(near) if v is w), None)
    if i is None:
        return [w]
    a = b = i
    while a > 0 and near[a].x0 - near[a - 1].x1 < 1.5 * h:
        a -= 1
    while b < len(near) - 1 and near[b + 1].x0 - near[b].x1 < 1.5 * h:
        b += 1
    return near[a:b + 1]



def _in_notes(sheet: Sheet, w) -> bool:
    """A label word inside a sheet's running notes ("1. DRAWINGS SHALL NOT BE SCALED", "... BROUGHT TO THE NOTICE OF
    THE ARCHITECT"): the five such words in IIT Bombay's notes made the whole bottom strip its title block. A note is
    a line of five words or more with no field label in it (a title block's own row has its "DATE:", "SCALE:"), or
    any line that starts with a note's number."""
    run = _line_run(sheet, w)               # the run of words the label sits in
    if re.match(r"\d{1,2}[.)]", run[0].text):
        return True
    # a field label ends with its colon; "Note:" opening a disclaimer is no field
    fields = [v for v in run if v.text.rstrip().endswith(":") and v.text.strip().upper().rstrip(":") not in ("NOTE", "NOTES")]
    return len(run) >= 5 and not fields


def _caption(sheet: Sheet, w) -> bool:
    """'NO SCALE' / 'NOT TO SCALE' under a photo or a view is a caption, not the block's SCALE label: three of them
    along a sheet's foot put its title block there (Chief Architect's sheet 5)."""
    if w.text.strip().upper().rstrip(":.") != "SCALE":
        return False
    h, cy = max(w.y1 - w.y0, 1.0), (w.y0 + w.y1) / 2
    return any(v.text.strip().upper() in ("NO", "TO") and abs((v.y0 + v.y1) / 2 - cy) < 0.4 * h
               and 0 <= w.x0 - v.x1 < 1.5 * h for v in sheet.words)


def _panel_left(sheet: Sheet, box: pymupdf.Rect, c: pymupdf.Rect) -> float:
    """Where the ruled panel the labels sit in starts: the panel runs further left than its labels (a logo, the
    job title and the office's name have no label), and its top rules run from there to its right-hand edge.
    The labels' own extent cut the office's logo and the start of the job title off (IIT Bombay's blocks)."""
    from collections import defaultdict
    rows: dict[int, list[tuple[float, float]]] = defaultdict(list)
    for s in getattr(sheet, "segments", None) or []:
        if abs(s.y0 - s.y1) < 0.5 and box.y0 - 0.03 * sheet.height <= s.y0 <= box.y0 + 0.5 * box.height:
            rows[round(s.y0)].append((min(s.x0, s.x1), max(s.x0, s.x1)))
    left = box.x0
    for spans in rows.values():
        spans.sort(key=lambda p: -p[1])
        a, b = spans[0]
        if b < c.x1 - 0.04 * sheet.width:
            continue                        # a rule inside the drawing, not one of the block's
        for x0, x1 in spans[1:]:
            if x1 >= a - 2:                 # the same rule, drawn in pieces
                a = min(a, x0)
        left = min(left, a - 2)
    return left


def body_rect(sheet: Sheet) -> pymupdf.Rect:
    return pymupdf.Rect(sheet.width * 0.02, sheet.height * 0.02, sheet.width * 0.86, sheet.height * 0.97)


def cell_classes(sheet: Sheet, cols: int = 8, rows: int = 6) -> list[tuple[pymupdf.Rect, RegionClass]]:
    """The drawing area cut into a grid; each cell classed on its own (a sheet is rarely one class)."""
    b = body_rect(sheet)
    cw, ch = b.width / cols, b.height / rows
    out = []
    for r in range(rows):
        for c in range(cols):
            rect = pymupdf.Rect(b.x0 + c * cw, b.y0 + r * ch, b.x0 + (c + 1) * cw, b.y0 + (r + 1) * ch)
            out.append((rect, classify_region(sheet, rect, min_words=3)))
    return out


def classify_page(sheet: Sheet) -> dict:
    """Page class from its title block and a grid of body cells.

    A cell with dense vectors and almost no text is OUTLINED (table cells, dimension strings drawn as
    curves); a page whose cells are part TEXT, part OUTLINED is MIXED - it needs both methods.
    """
    tb = classify_region(sheet, title_block_rect(sheet))
    cells = cell_classes(sheet)
    counts = {k: sum(1 for _, c in cells if c.cls == k) for k in (TEXT, OUTLINED, RASTER)}
    # an outlined cell counts when it is dense (glyph outlines), not a sparse line drawing
    dense_outlined = sum(1 for _, c in cells if c.cls == OUTLINED and c.vectors > 400)
    body_cls = [k for k, n in (("TEXT", counts[TEXT]), ("OUTLINED", dense_outlined), ("RASTER", counts[RASTER]))
                if n >= 2]
    classes = set(body_cls) | ({tb.cls} if tb.cls != EMPTY else set())
    page = classes.pop() if len(classes) == 1 else (MIXED if classes else EMPTY)
    return {"page": page, "title_block": tb, "cells": counts | {"OUTLINED_dense": dense_outlined}}


def table_rect(sheet: Sheet) -> pymupdf.Rect:
    """The schedule table's own outline: the extent of its ruled lines, inside the sheet frame and
    left of the title block - so a crop holds the table and nothing else. The block's own edge, not the house
    layout's: a schedule running past 86% of the width, beside a narrower block, was cut off (Chief Architect's
    door schedule, read without its descriptions)."""
    body = body_rect(sheet)
    tb = title_block_rect(sheet, whole_lines=False)
    house = tb == _tb_candidates(sheet.width, sheet.height)[0]
    if not house:
        body.x1 = sheet.width * 0.98        # to the frame; the block's own rules are left out below
    xs, ys = [], []
    for s in sheet.own_segments:
        horiz, vert = abs(s.y0 - s.y1) < 0.3, abs(s.x0 - s.x1) < 0.3
        ln = abs(s.x1 - s.x0) + abs(s.y1 - s.y0)
        a, b = pymupdf.Point(s.x0, s.y0), pymupdf.Point(s.x1, s.y1)
        # beside another office's block: not the block's own rules (both ends in it) and not the sheet's frame
        theirs = not (tb.contains(a) and tb.contains(b)) and ln < 0.8 * (sheet.width if horiz else sheet.height)
        if (horiz or vert) and 60 < ln and body.contains(a) and body.contains(b) and (house or theirs):
            xs += [s.x0, s.x1]
            ys += [s.y0, s.y1]
    if not xs:
        return body
    return pymupdf.Rect(min(xs), min(ys), max(xs), max(ys)) + (-4, -4, 4, 4)


def tight_tiles(rect: pymupdf.Rect, max_w: float = 620, max_h: float = 440) -> list[pymupdf.Rect]:
    """Tiles over a tight crop, small enough to read at high resolution, overlapping 6%."""
    import math
    cols, rows = max(1, math.ceil(rect.width / max_w)), max(1, math.ceil(rect.height / max_h))
    cw, ch = rect.width / cols, rect.height / rows
    ox, oy = cw * 0.06, ch * 0.06
    return [pymupdf.Rect(rect.x0 + c * cw - (ox if c else 0), rect.y0 + r * ch - (oy if r else 0),
                         rect.x0 + (c + 1) * cw + (ox if c < cols - 1 else 0),
                         rect.y0 + (r + 1) * ch + (oy if r < rows - 1 else 0))
            for r in range(rows) for c in range(cols)]
