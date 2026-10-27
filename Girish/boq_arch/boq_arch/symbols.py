"""Symbol counting (PlanSwift's count tool, automatic): box one symbol, find every match on the sheet.

Two ways, the exact one first:
  text     the boxed symbol carries real text (a door tag "D4", a window tag "DW 03"): every occurrence
           of that text on the sheet's own layers is a match - exact, COUNTED
  image    a purely graphic symbol (a WC, a light fitting, a column): the sheet is rendered in greyscale
           and the boxed symbol is matched against it by normalised correlation over the symbol's own
           ink and a thin band around it, so a wall or door swing crossing a symbol does not hide it;
           all four orientations are tried
Overlapping hits are one symbol. Matches are suggestions: the user confirms or edits them, and the
count is what is left on the sheet.
"""
from __future__ import annotations

import re

import cv2
import numpy as np
import pymupdf

DPI = 150
_CACHE: dict = {}


def _grey(sheet) -> np.ndarray:
    key = str(getattr(sheet, "path", id(sheet)))
    if key not in _CACHE:
        _CACHE.clear()
        pix = sheet.page.get_pixmap(dpi=DPI, colorspace=pymupdf.csGRAY, alpha=False)
        _CACHE[key] = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width)
    return _CACHE[key]


def _by_text(sheet, box) -> tuple[str, list] | None:
    x0, y0, x1, y1 = box
    inside = [w for w in sheet.own_words if x0 <= w.cx <= x1 and y0 <= w.cy <= y1]
    if not inside or len(inside) > 3:
        return None
    label = " ".join(w.text for w in sorted(inside, key=lambda w: (round(w.cy), w.x0)))
    if not re.search(r"[A-Za-z]", label) or len(label) > 12:
        return None
    first = inside[0].text
    hits = []
    for w in sheet.own_words:
        if w.text != first:
            continue
        if len(inside) > 1:                   # a two-line tag ("DW" over "03"): the second line must follow
            second = sorted(inside, key=lambda v: v.cy)[1].text
            below = [v for v in sheet.own_words if v.text == second and abs(v.cx - w.cx) < 6 and 0 < v.cy - w.cy < 12]
            if not below:
                continue
        hits.append((w.cx, w.cy, 1.0))
    return label, hits


def find_similar(sheet, box: tuple[float, float, float, float], threshold: float = 0.62,
                 rotations: bool = True, limit: int = 3000) -> dict:
    """box: (x0, y0, x1, y1) in sheet points around one symbol.
    Returns {"method": "text"|"image", "label", "points": [(x, y, score)]} in sheet points."""
    t = _by_text(sheet, box)
    if t is not None and t[1]:
        return {"method": "text", "label": t[0], "points": t[1]}
    img = _grey(sheet)
    k = DPI / 72.0
    x0, y0, x1, y1 = (int(round(v * k)) for v in box)
    x0, x1 = sorted((max(0, x0), min(img.shape[1], x1)))
    y0, y1 = sorted((max(0, y0), min(img.shape[0], y1)))
    tpl = img[y0:y1, x0:x1]
    if tpl.size == 0 or min(tpl.shape) < 5 or float(tpl.std()) < 3:
        return {"method": "image", "label": "", "points": []}
    ink = (tpl < 160).astype(np.uint8)
    band = cv2.dilate(ink, np.ones((3, 3), np.uint8), iterations=2).astype(np.float32)
    hits = []
    variants = [(tpl, band)] + ([(np.rot90(tpl, r).copy(), np.rot90(band, r).copy()) for r in (1, 2, 3)]
                                if rotations else [])
    for t_img, t_mask in variants:
        if t_img.shape[0] >= img.shape[0] or t_img.shape[1] >= img.shape[1]:
            continue
        res = cv2.matchTemplate(img, t_img, cv2.TM_CCOEFF_NORMED, mask=t_mask)
        res = np.nan_to_num(res, nan=0.0, posinf=0.0, neginf=0.0)
        ys, xs = np.nonzero(res >= threshold)
        for y, x in zip(ys, xs):
            hits.append((float(res[y, x]), (x + t_img.shape[1] / 2) / k, (y + t_img.shape[0] / 2) / k))
    hits.sort(reverse=True)
    r = max(tpl.shape) / k / 2
    kept: list = []
    for s, x, y in hits:
        if all((x - a) ** 2 + (y - b) ** 2 > r * r for a, b, _ in kept):
            kept.append((x, y, round(s, 3)))
            if len(kept) >= limit:
                break
    kept.sort(key=lambda p: (p[1], p[0]))
    return {"method": "image", "label": "", "points": kept}
