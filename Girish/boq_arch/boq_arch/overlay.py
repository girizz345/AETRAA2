"""Marked-up drawings (PlanSwift's takeoff overlay), in the house trade-colour convention.

Colours are the house convention (sdk agent data/conventions.json, determinism.md 4.10): each POMI
section has one hue; items on one sheet take successive shades of it (the shade ladder), never a
reused colour. Primitive follows the unit: areas shaded, lengths traced, counts tagged.

  plans      walls traced in D, rooms shaded in J, door/window tags ringed in H (an OPEN mark in red),
             revision changes marked (added +, removed x, moved arrow), and a legend of every item
             taken off the sheet with its code and the quantity from this sheet
  schedules  each region read directly off the image outlined, and a legend of every mark read with
             its count and CLOSED / OPEN status
"""
from __future__ import annotations

import textwrap
from pathlib import Path

import numpy as np
import pymupdf

TRADE_HEX = {"D": "C0703A", "E": "4F6FA8", "F": "7A5C3E", "G": "B0913A", "H": "3F9E8C", "J": "2E7D5B",
             "K": "A0522D"}
LADDER = [1.0, 0.72, 1.28, 0.55, 1.5, 0.85]
RED, GREEN, ORANGE = (0.85, 0.1, 0.1), (0.1, 0.6, 0.2), (0.95, 0.55, 0.0)


def trade_rgb(section: str, n: int = 0) -> tuple:
    h = TRADE_HEX.get(section, "7F7F7F")
    rgb = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    k = LADDER[n % len(LADDER)]
    return tuple(min(1.0, max(0.0, c * k)) for c in rgb)


def _open_page(sheet):
    doc = pymupdf.open()
    doc.insert_pdf(sheet.doc, from_page=0, to_page=0)
    page = doc[0]
    inv = ~page.rotation_matrix
    return doc, page, (lambda x, y: pymupdf.Point(x, y) * inv)


def _text(sh, P, x, y, s, size, colour):
    """Text goes into the page's one shape too - a separate insert per label would re-parse the page each time."""
    sh.insert_text(P(x, y), s, fontsize=size, color=colour, rotate=sh.page.rotation)


LEGEND_W = 340


def _title_lines(title: str) -> list[str]:
    return textwrap.wrap(title, 82)[:4]


def _legend_height(title: str, rows: list) -> float:
    return 10 * len(_title_lines(title)) + 2 + 20 + 11 * len(rows) + 3


def _free_spot(sheet, w: float, h: float, avoid=(), room_masks=None, margin: float = 28) -> tuple[float, float, bool]:
    """Top-left corner (sheet points) of the emptiest w x h box on the sheet for the legend: the least drawing
    ink, and clear of everything the take-off marks on it (tags, wall traces, measured rooms), so the legend
    never hides what it explains. Also says whether that box is clear: on a sheet with no empty space (a
    schedule) the legend is drawn see-through instead. Falls back to the top-left corner."""
    page = getattr(sheet, "page", None)
    if page is None:
        return 60.0, 40.0, True
    # ink seen at 36 dpi, where thin lines and small text still darken a pixel, then pooled 2 x 2 (max) to 18 dpi
    pix = page.get_pixmap(dpi=36, colorspace=pymupdf.csGRAY, alpha=False)
    g = np.frombuffer(pix.samples, np.uint8).reshape(pix.height, pix.width)
    ink = g < 248
    ink = ink[:ink.shape[0] // 2 * 2, :ink.shape[1] // 2 * 2]
    cost = ink.reshape(ink.shape[0] // 2, 2, ink.shape[1] // 2, 2).any(axis=(1, 3)).astype(np.float64)
    k = 18 / 72
    H, W = cost.shape
    for x, y in avoid:                        # what this markup draws must stay visible
        cx, cy = int(x * k), int(y * k)
        cost[max(0, cy - 2):cy + 3, max(0, cx - 2):cx + 3] += 50
    if room_masks is not None:                # and so must the rooms it shades
        lab, px_per_pt, ids = room_masks
        ys = np.clip(((np.arange(H) + 0.5) / k * px_per_pt).astype(int), 0, lab.shape[0] - 1)
        xs = np.clip(((np.arange(W) + 0.5) / k * px_per_pt).astype(int), 0, lab.shape[1] - 1)
        cost[np.isin(lab[np.ix_(ys, xs)], np.asarray(list(ids)))] += 5
    bw, bh, m = int(w * k) + 1, int(h * k) + 1, int(margin * k)
    if bw + 2 * m >= W or bh + 2 * m >= H:
        return 60.0, 40.0, False
    ii = np.zeros((H + 1, W + 1))
    ii[1:, 1:] = cost.cumsum(0).cumsum(1)
    S = ii[bh:, bw:] - ii[:-bh, bw:] - ii[bh:, :-bw] + ii[:-bh, :-bw]      # box sums, by top-left corner
    S = S[m:H - bh - m + 1, m:W - bw - m + 1]
    iy, ix = np.unravel_index(int(np.argmin(S)), S.shape)                 # first minimum: the top-most, left-most
    return (ix + m) / k, (iy + m) / k, float(S[iy, ix]) <= 0.02 * bw * bh  # clear: at most 2% of it has ink


def _legend_shapes(sh, P, x, y, title: str, rows: list, width: float = LEGEND_W, clear: bool = True):
    """The legend box (sheet title, then one row per item) and colour swatches, drawn into the page's one shape."""
    sh.draw_rect(pymupdf.Rect(P(x, y), P(x + width, y + _legend_height(title, rows))).normalize())
    sh.finish(color=(0.2, 0.2, 0.2), fill=(1, 1, 1), fill_opacity=0.94 if clear else 0.55, width=0.6)
    y0 = y + 10 * len(_title_lines(title)) + 2
    for i, (rgb, _) in enumerate(rows):
        yy = y0 + 20 + 11 * i
        sh.draw_rect(pymupdf.Rect(P(x + 5, yy - 7), P(x + 13, yy + 1)).normalize())
        sh.finish(color=None, fill=rgb, fill_opacity=0.9, width=0)


def _legend_text(sh, P, x, y, title: str, head: str, rows: list):
    for j, line in enumerate(_title_lines(title)):
        _text(sh, P, x + 5, y + 9 + 10 * j, line, 7.5, (0.6, 0, 0))
    y0 = y + 10 * len(_title_lines(title)) + 2
    _text(sh, P, x + 5, y0 + 9, head, 7, (0, 0, 0))
    for i, (_, s) in enumerate(rows):
        _text(sh, P, x + 17, y0 + 20 + 11 * i, s[:72], 6, (0.1, 0.1, 0.1))


def write_plan_overlay(sheet, out: Path, title: str, pieces=(), rooms=(), room_masks=None, tags=(),
                       wall_items: dict | None = None, open_marks: set | None = None, legend_rows=(),
                       changes: dict | None = None):
    """wall_items: thickness -> (item code, shade n); legend_rows: [(rgb, text)]; changes: this sheet's
    revision changes in sheet points: {"added": [(key,x,y)], "removed": [...], "moved": [(key,x0,y0,x,y)]}."""
    doc, page, P = _open_page(sheet)
    sh = page.new_shape()                     # everything drawn into one shape, committed once
    if room_masks is not None:
        lab, px_per_pt, ids = room_masks
        step = 3
        sub = lab[::step, ::step]
        m = np.isin(sub, np.asarray(list(ids)))
        for row in range(m.shape[0]):
            r = m[row]
            if not r.any():
                continue
            d = np.diff(np.concatenate(([0], r.view(np.int8), [0])))
            y0, y1 = row * step / px_per_pt, (row + 1) * step / px_per_pt
            for a, b in zip(np.nonzero(d == 1)[0], np.nonzero(d == -1)[0]):
                sh.draw_rect(pymupdf.Rect(P(a * step / px_per_pt, y0), P(b * step / px_per_pt, y1)).normalize())
        sh.finish(color=None, fill=trade_rgb("J"), fill_opacity=0.22, width=0)
    wall_items = wall_items or {}
    by_colour: dict = {}
    for p in pieces:
        code, n = wall_items.get(p.thk_mm, (None, 5))
        by_colour.setdefault(trade_rgb("D", n) if code else (0.6, 0.6, 0.6), []).append(p)
    for colour, ps in by_colour.items():
        for p in ps:
            sh.draw_line(P(*p.a), P(*p.b))
        sh.finish(color=colour, width=1.8, stroke_opacity=0.9)
    open_marks = open_marks or set()
    for colour, sel in ((trade_rgb("H"), [t for t in tags if t[0] not in open_marks]),
                        (RED, [t for t in tags if t[0] in open_marks])):
        if sel:
            for _, x, y in sel:
                sh.draw_circle(P(x, y), 7)
            sh.finish(color=colour, width=1.1)
    for kind, pts in (changes or {}).items():
        if not pts:
            continue
        for c in pts:
            if kind == "added":
                _, x, y = c
                sh.draw_line(P(x - 9, y), P(x + 9, y))
                sh.draw_line(P(x, y - 9), P(x, y + 9))
            elif kind == "removed":
                _, x, y = c
                sh.draw_line(P(x - 7, y - 7), P(x + 7, y + 7))
                sh.draw_line(P(x - 7, y + 7), P(x + 7, y - 7))
            elif kind == "moved":
                _, x0, y0, x, y = c
                sh.draw_line(P(x0, y0), P(x, y))
                sh.draw_circle(P(x, y), 3)
        sh.finish(color={"added": GREEN, "removed": RED, "moved": ORANGE}[kind], width=2.2)
    rows = list(legend_rows)
    if changes and any(changes.values()):
        rows += [(GREEN, f"+ added since previous revision: {len(changes.get('added', []))}"),
                 (RED, f"x removed since previous revision: {len(changes.get('removed', []))}"),
                 (ORANGE, f"-> moved since previous revision: {len(changes.get('moved', []))}")]
    avoid = [(x, y) for _, x, y in tags] + [r.seed for r in rooms]
    for pc in pieces:
        avoid += [pc.a, pc.b, ((pc.a[0] + pc.b[0]) / 2, (pc.a[1] + pc.b[1]) / 2)]
    lx, ly, clear = _free_spot(sheet, LEGEND_W, _legend_height(title, rows), avoid, room_masks)
    _legend_shapes(sh, P, lx, ly, title, rows, clear=clear)
    for r in rooms:
        _text(sh, P, r.seed[0] - 12, r.seed[1] + 9, f"{r.area_m2:.2f} m2", 4.5, (0.1, 0.35, 0.2))
    _legend_text(sh, P, lx, ly, title,
                 "TAKE-OFF ON THIS SHEET (trade colours)" if rows else "Nothing taken off this sheet", rows)
    sh.commit()
    out.parent.mkdir(parents=True, exist_ok=True)
    doc.save(out, garbage=3, deflate=True)
    doc.close()


def write_elevation_overlay(sheet, out: Path, title: str, classes=(), legend_rows=()):
    """Each finish class outlined in a strong line of its own colour and labelled on its largest areas."""
    doc, page, P = _open_page(sheet)
    sh = page.new_shape()
    for c in classes:
        rgb = tuple(int(c.colour[k:k + 2], 16) / 255 for k in (1, 3, 5))
        edge = tuple(max(0.0, v * 0.6) for v in rgb)
        drew = False
        for b in c.blobs:
            for ring in b.poly:
                if len(ring) >= 3:
                    sh.draw_polyline([P(*q) for q in ring + ring[:1]])
                    drew = True
        if drew:
            sh.finish(color=edge, width=1.4, stroke_opacity=0.95, closePath=True)
    for c in classes:
        for b in sorted(c.blobs, key=lambda b: -b.area_m2)[:3]:
            x, y = b.point
            sh.draw_rect(pymupdf.Rect(P(x - 11, y - 6), P(x + 11, y + 6)).normalize())
            sh.finish(color=(0.1, 0.1, 0.1), fill=(1, 1, 1), width=0.6)
    rows = list(legend_rows)
    avoid = [b.point for c in classes for b in c.blobs]
    lx, ly, clear = _free_spot(sheet, LEGEND_W, _legend_height(title[:330], rows), avoid)
    _legend_shapes(sh, P, lx, ly, title[:330], rows, clear=clear)
    for c in classes:
        for b in sorted(c.blobs, key=lambda b: -b.area_m2)[:3]:
            x, y = b.point
            _text(sh, P, x - 8, y + 3.2, c.label, 8, (0, 0, 0))
    _legend_text(sh, P, lx, ly, title[:330], "FINISHES MEASURED ON THIS ELEVATION (by colour)", rows)
    sh.commit()
    out.parent.mkdir(parents=True, exist_ok=True)
    doc.save(out, garbage=3, deflate=True)
    doc.close()


def write_schedule_overlay(sheet, out: Path, title: str, regions=(), legend_rows=()):
    """Outline each region read visually and list every mark read with its count and status."""
    doc, page, P = _open_page(sheet)
    sh = page.new_shape()
    if regions:
        for r in regions:
            sh.draw_rect(pymupdf.Rect(P(r.x0, r.y0), P(r.x1, r.y1)).normalize())
        sh.finish(color=trade_rgb("H"), width=0.8, dashes="[4 3] 0", stroke_opacity=0.8)
    rows = list(legend_rows)
    avoid = [(x, y) for r in regions for x in (r.x0, r.x1) for y in (r.y0, r.y1)]
    lx, ly, clear = _free_spot(sheet, LEGEND_W, _legend_height(title, rows), avoid)
    _legend_shapes(sh, P, lx, ly, title, rows, clear=clear)
    _legend_text(sh, P, lx, ly, title, "READ (VISUAL) FROM THIS SCHEDULE", rows)
    sh.commit()
    out.parent.mkdir(parents=True, exist_ok=True)
    doc.save(out, garbage=3, deflate=True)
    doc.close()
