"""Walls measured from the plan's wall layer (MEASURED, calibrated sheets only).

The wall layer draws each wall as its two faces. A wall piece is the length over
which two parallel face lines run side by side; its thickness is the distance
between them. Faces pair with their nearest partner first, so the far face of a
neighbouring wall is never taken as a partner while a nearer one is free.

Face lines stop at columns and at door and window openings, so the length found
is net of every opening on plan. measure.py adds back the walling above door
heads and above/below windows, then applies the POMI deduction threshold.
"""
from __future__ import annotations

import math
from collections import defaultdict
from dataclasses import dataclass

from .calibrate import Calibration
from .sheet import Sheet

WALL_LAYER_WORDS = ("WALL",)
NOT_WALL = ("PARTITION-LOW",)   # reserved; low partitions are split out by room context
STANDARD_THK = (100, 150, 200, 250, 300)   # mm; snap tolerance below
SNAP_MM = 20
MAX_THK_MM = 420


@dataclass
class WallPiece:
    length_m: float
    thk_mm: int | None       # snapped standard thickness, None if unclassified
    raw_thk_mm: float
    mid: tuple[float, float]  # centreline midpoint, sheet points
    a: tuple[float, float]
    b: tuple[float, float]
    id: str = ""              # w<n>, in sheet order - the same drawing always gives the same ids
    hand: str = ""            # set when a person gave it its thickness (the correction, in words)


def is_wall_layer(layer: str) -> bool:
    u = layer.upper()
    return any(w in u for w in WALL_LAYER_WORDS) and "XR-" not in u


def _subtract(free: list[tuple[float, float]], lo: float, hi: float) -> list[tuple[float, float]]:
    out = []
    for a, b in free:
        if b <= lo or a >= hi:
            out.append((a, b))
            continue
        if a < lo:
            out.append((a, lo))
        if b > hi:
            out.append((hi, b))
    return out


def _intersect(fa, fb):
    out = []
    for a0, a1 in fa:
        for b0, b1 in fb:
            lo, hi = max(a0, b0), min(a1, b1)
            if hi - lo > 1e-6:
                out.append((lo, hi))
    return out


def measure_walls(sheet: Sheet, cal: Calibration) -> list[WallPiece]:
    k = cal.mm_per_pt
    if not k:
        return []
    min_pt, max_pt = 60 / k, MAX_THK_MM / k
    # bucket face lines by direction (0..180 deg, 1 deg buckets)
    buckets: dict[int, list] = defaultdict(list)
    for s in sheet.own_segments:
        if not is_wall_layer(s.layer):
            continue
        dx, dy = s.x1 - s.x0, s.y1 - s.y0
        ln = math.hypot(dx, dy)
        if ln * k < 50:        # shorter than 50 mm: a return or a tick, not a face
            continue
        ang = math.degrees(math.atan2(dy, dx)) % 180
        buckets[int(round(ang)) % 180].append(s)
    pieces: list[WallPiece] = []
    for ang, segs in buckets.items():
        th = math.radians(ang)
        c, s_ = math.cos(th), math.sin(th)
        lines = []
        for sg in segs:
            u0, v0 = sg.x0 * c + sg.y0 * s_, -sg.x0 * s_ + sg.y0 * c
            u1, v1 = sg.x1 * c + sg.y1 * s_, -sg.x1 * s_ + sg.y1 * c
            lines.append(((v0 + v1) / 2, min(u0, u1), max(u0, u1)))
        lines.sort()
        free = [[(u0, u1)] for _, u0, u1 in lines]
        cands = []
        for i, (vi, a0, a1) in enumerate(lines):
            for j in range(i + 1, len(lines)):
                vj, b0, b1 = lines[j]
                gap = vj - vi
                if gap > max_pt:
                    break
                if gap < min_pt:
                    continue
                if min(a1, b1) - max(a0, b0) > 0:
                    cands.append((gap, i, j))
        cands.sort()
        for gap, i, j in cands:
            both = _intersect(free[i], free[j])
            if not both:
                continue
            for lo, hi in both:
                free[i] = _subtract(free[i], lo, hi)
                free[j] = _subtract(free[j], lo, hi)
                vm = (lines[i][0] + lines[j][0]) / 2
                pa = (lo * c - vm * s_, lo * s_ + vm * c)
                pb = (hi * c - vm * s_, hi * s_ + vm * c)
                raw = gap * k
                snap = min(STANDARD_THK, key=lambda t: abs(t - raw))
                pieces.append(WallPiece(
                    length_m=(hi - lo) * k / 1000, thk_mm=snap if abs(snap - raw) <= SNAP_MM else None,
                    raw_thk_mm=raw, mid=((pa[0] + pb[0]) / 2, (pa[1] + pb[1]) / 2), a=pa, b=pb))
    pieces.sort(key=lambda p: (p.mid[1], p.mid[0]))
    for n, p in enumerate(pieces):
        p.id = f"w{n}"
    return pieces
