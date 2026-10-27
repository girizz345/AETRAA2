"""Rooms measured by flood fill (MEASURED, calibrated sheets only).

The sheet's own walls, columns, door leaves/swings, jambs, glazing, railings and
slab edges are rasterised as barriers; each room-name label seeds a fill. The room
is then measured as POMI measures it, the floor within its walls (_net): the pockets
a door's swing cuts off are the room's, its outline runs along the wall faces, and
its area and perimeter are that outline's, less voids of 1.00 m2 and more, at the
sheet's calibrated scale.

A fill that leaks through an open doorway is caught, not billed: a region that
touches the sheet border, exceeds the size a room of its name can have, or holds
a wet room and a dry room together is a gap.

Each room also keeps its outline as polygons in sheet points - to draw it on the
platform, and to tell which room a point is in once the masks are gone.
"""
from __future__ import annotations

import math
import re
from dataclasses import dataclass, field

import numpy as np
from scipy import ndimage

from .calibrate import Calibration
from .sheet import Sheet

PX_PER_PT = 3
BARRIER_WORDS = ("WALL", "COLUMN", "DOOR", "JAMB", "GLASS", "WIN", "RAILING", "FLOOR LINE", "LIFT", "STAIR")
NOT_BARRIER_WORDS = ("TAG", "TEXT", "HATCH", "DIMENSION")

# room name -> (category, max plausible area m2). Longest names first when matching.
ROOM_TYPES = {
    "STUDIO LIVING/DINING": ("dry", 60), "LIVING/DINING": ("dry", 80), "BED ROOM": ("dry", 40),
    "BEDROOM": ("dry", 40), "PANTRY": ("dry", 25), "KITCHEN": ("wet", 30), "BATH": ("wet", 15),
    "TOI.": ("wet", 10), "TOILET": ("wet", 30), "TOILETS": ("wet", 60), "BALCONY": ("ext", 40),
    "TERRACE": ("ext", 400), "CORRIDOR": ("dry", 600), "LOBBY": ("dry", 200), "LIFT LOBBY": ("dry", 200),
    "ENTRANCE LOBBY": ("dry", 300), "ELEC RM": ("dry", 30), "ELEC. RM": ("dry", 30), "TEL RM": ("dry", 30),
    "TELE ROOM": ("dry", 30), "WATER MTR": ("dry", 30), "GARB RM": ("dry", 30), "GARBAGE ROOM": ("dry", 60),
    "SERV. PASSAGE": ("dry", 60), "GYMNASIUM": ("dry", 400), "WATCHMAN": ("dry", 30),
    "SUBSTATION": ("dry", 150), "L.V ROOM": ("dry", 150), "RECEPTION": ("dry", 100),
    "GSM ROOM": ("dry", 40), "SWIM.POOL PUMP RM.": ("dry", 40), "STORE": ("dry", 30),
    "SERVICE ROOF": ("ext", 2500), "ROOF DECK": ("ext", 400), "OUTDOOR CINEMA": ("ext", 400),
    "BBQ AREA/ SITTING AREA": ("ext", 300),
}
MIN_ROOM_M2 = 1.0   # a smaller region is a label inside a fixture outline, not a room
HAND_REGION = 1_000_000_000   # region ids of rooms drawn by hand; the fill's labels stay far below this
# A room as POMI measures it - the floor within its walls (the BOQ agent's measure_rooms_net, 30-09-2026):
POCKET_M2 = 2.0     # an unlabelled pocket up to this size, cut off only by thin lines, is the room's
THIN_MM = 55        # a line no thicker than this is a door's leaf or swing, not a wall (walls are 75 mm and more)
SLIT_MM = 100       # a hairline slit narrower than this does not break a room's outline
MIN_VOID_M2 = 1.0   # GP3.2: an island under 1.00 m2 stays in the room's area; a larger void is deducted


@dataclass
class Room:
    name: str
    category: str
    area_m2: float
    perimeter_m: float
    seed: tuple[float, float]
    region: int
    id: str = ""                                # r<n>, in sheet order; h<correction id> when drawn by hand
    poly: list = field(default_factory=list)    # outline: rings of (x, y) sheet points
    hand: str = ""                              # "drawn", or "renamed from <name>", when a person made or changed it
    slope: str = ""                             # the slope in words, when a person said the room slopes
    slope_f: float = 1.0                        # its slope factor: true area = plan area x slope_f


def inside(poly: list, x: float, y: float) -> bool:
    """Is (x, y) inside any ring of the outline (even-odd rule)?"""
    hit = False
    for ring in poly:
        n = len(ring)
        for i in range(n):
            (x0, y0), (x1, y1) = ring[i], ring[i - 1]
            if (y0 > y) != (y1 > y) and x < (x1 - x0) * (y - y0) / (y1 - y0) + x0:
                hit = not hit
    return hit


def hand_room(name: str, pts: list, mm_per_pt: float, region: int, rid: str) -> Room:
    """A room a person drew round (MEASURED (MANUAL)): area and perimeter of the polygon at the sheet's scale."""
    k = mm_per_pt / 1000
    pts = [(float(x), float(y)) for x, y in pts]
    a2 = sum(x0 * y1 - x1 * y0 for (x0, y0), (x1, y1) in zip(pts, pts[1:] + pts[:1]))
    per = sum(math.dist(p, q) for p, q in zip(pts, pts[1:] + pts[:1]))
    if a2:
        cx = sum((x0 + x1) * (x0 * y1 - x1 * y0) for (x0, y0), (x1, y1) in zip(pts, pts[1:] + pts[:1])) / (3 * a2)
        cy = sum((y0 + y1) * (x0 * y1 - x1 * y0) for (x0, y0), (x1, y1) in zip(pts, pts[1:] + pts[:1])) / (3 * a2)
    else:
        cx, cy = pts[0]
    seed = (cx, cy) if inside([pts], cx, cy) else pts[0]
    return Room(name, ROOM_TYPES[name][0], abs(a2) / 2 * k * k, per * k, seed, region, id=rid, poly=[pts], hand="drawn")


def outlines(lab: np.ndarray, ids, px_per_pt: float = PX_PER_PT) -> dict[int, list]:
    """Each region's outer boundary as sheet-point polygons, simplified to about a pixel. lab: labels rendered at
    px_per_pt pixels per sheet point."""
    import cv2
    ids = [int(i) for i in ids]
    if not ids:
        return {}
    boxes = ndimage.find_objects(lab, max_label=max(ids))
    out = {}
    for rid in ids:
        box = boxes[rid - 1]
        if box is None:
            continue
        ys, xs = box
        crop = np.pad((lab[box] == rid).astype(np.uint8), 1)
        found, _ = cv2.findContours(crop, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        rings = []
        for c in found:
            c = cv2.approxPolyDP(c, 1.0, True)[:, 0, :]
            if len(c) >= 3:
                rings.append([(round((xs.start + px - 0.5) / px_per_pt, 2), round((ys.start + py - 0.5) / px_per_pt, 2))
                              for px, py in c.tolist()])
        out[rid] = rings
    return out


def door_closers(pieces, mm_per_pt: float, max_gap_mm: float = 1600) -> list[tuple[float, float, float, float]]:
    """Lines across each door-sized gap between two collinear wall pieces of one thickness.

    A room is bounded by the wall line, so an opening is closed where the wall runs:
    the fill then stops at the threshold instead of running on into the next room.
    """
    import math
    out = []
    ends = []
    for p in pieces:
        if p.thk_mm is None:
            continue
        ang = math.atan2(p.b[1] - p.a[1], p.b[0] - p.a[0]) % math.pi
        ends.append((p, ang))
    for i, (p, ang) in enumerate(ends):
        for q, ang2 in ends[i + 1:]:
            if q.thk_mm != p.thk_mm or abs(ang - ang2) > 0.02:
                continue
            c, s = math.cos(ang), math.sin(ang)
            off = lambda pt: -pt[0] * s + pt[1] * c
            if abs(off(p.a) - off(q.a)) * mm_per_pt > 25:
                continue
            along = lambda pt: pt[0] * c + pt[1] * s
            pa, pb = sorted((along(p.a), along(p.b)))
            qa, qb = sorted((along(q.a), along(q.b)))
            gap_lo, gap_hi = (pb, qa) if pb <= qa else (qb, pa)
            gap = (gap_hi - gap_lo) * mm_per_pt
            if not (400 <= gap <= max_gap_mm):
                continue
            half = p.thk_mm / 2 / mm_per_pt
            v = off(p.a)
            for dv in (-half, half):
                vv = v + dv
                out.append((gap_lo * c - vv * s, gap_lo * s + vv * c, gap_hi * c - vv * s, gap_hi * s + vv * c))
    return out


def _counts(lab: np.ndarray, n: int, rows: int = 512) -> np.ndarray:
    """np.bincount(lab.ravel(), minlength=n), a band of rows at a time (a whole plan's labels as int64 would
    need another 300 MB)."""
    out = np.zeros(n, dtype=np.int64)
    for y in range(0, lab.shape[0], rows):
        out += np.bincount(lab[y:y + rows].ravel(), minlength=n)
    return out


def _barrier(sheet: Sheet, shape: tuple[int, int], extra=()) -> np.ndarray:
    img = np.zeros(shape, dtype=bool)
    H, W = shape
    segs = [(s.x0, s.y0, s.x1, s.y1) for s in sheet.own_segments
            if any(w in s.layer.upper() for w in BARRIER_WORDS)
            and not any(w in s.layer.upper() for w in NOT_BARRIER_WORDS)]
    for seg in list(segs) + list(extra):
        x0, y0, x1, y1 = (v * PX_PER_PT for v in seg)
        n = int(max(abs(x1 - x0), abs(y1 - y0))) + 2
        xs = np.clip(np.rint(np.linspace(x0, x1, n)).astype(int), 0, W - 1)
        ys = np.clip(np.rint(np.linspace(y0, y1, n)).astype(int), 0, H - 1)
        img[ys, xs] = True
    return ndimage.binary_dilation(img, iterations=1)


def _centrelines(pieces, shape: tuple[int, int]) -> np.ndarray:
    """Every wall piece's centreline, rasterised. The strip between a wall's two drawn faces is free space to the
    fill, and a pocket holding a centreline is a WALL, never part of the room beside it."""
    H, W = shape
    out = np.zeros(shape, dtype=bool)
    for p in pieces:
        (ax, ay), (bx, by) = p.a, p.b
        n = int(max(abs(bx - ax), abs(by - ay)) * PX_PER_PT) + 2
        xs = np.clip(np.rint(np.linspace(ax * PX_PER_PT, bx * PX_PER_PT, n)).astype(int), 0, W - 1)
        ys = np.clip(np.rint(np.linspace(ay * PX_PER_PT, by * PX_PER_PT, n)).astype(int), 0, H - 1)
        out[ys, xs] = True
    return out


def _net(lab: np.ndarray, rid: int, sizes, boxes, labelled: set, border: set, centre: np.ndarray,
         mm_px: float) -> tuple[float, float, list, list[int]]:
    """A room as POMI measures it: (area m2, perimeter m, outline rings in sheet points, pockets merged).

    A flood fill stops at the inner edge of each boundary line as rasterised, is cut into pockets by a door's leaf
    and swing, and its pixel-edge count runs a diagonal or an arc as a staircase: on a typical floor of the test
    set the room perimeters came out 19% (living rooms 31%) above their own outlines, so skirtings and wall
    finishes were overstated by about a quarter. Corrected as the BOQ agent measures (measure_rooms_net):
      * an unlabelled pocket of POCKET_M2 or less, cut off only by lines no thicker than THIN_MM and holding no wall
        centreline, is the room's (a door swing);
      * the room is grown into its boundary lines, so its outline runs along the wall faces;
      * hairline slits under SLIT_MM are closed; islands under MIN_VOID_M2 stay in the area, larger voids are
        deducted (GP3.2);
      * the area is the outline's, less those voids; the perimeter is the outline's length, not a pixel count."""
    import cv2
    H, W = lab.shape
    slit_px = max(1, int(math.ceil(SLIT_MM / mm_px / 2)))
    thin_px = max(2, int(math.ceil(THIN_MM / mm_px)))
    ys, xs = boxes[rid - 1]
    pad = slit_px + thin_px + 2
    y0, y1 = max(0, ys.start - pad), min(H, ys.stop + pad)
    x0, x1 = max(0, xs.start - pad), min(W, xs.stop + pad)
    crop = lab[y0:y1, x0:x1]
    own = crop == rid
    thin_disk = np.hypot(*np.mgrid[-thin_px:thin_px + 1, -thin_px:thin_px + 1]) <= thin_px
    near = ndimage.binary_dilation(own, structure=thin_disk, iterations=1)
    walls_here = centre[y0:y1, x0:x1]
    pockets = []
    for v in np.unique(crop[near & ~own]).tolist():
        if v and v != rid and v not in labelled and v not in border \
                and sizes[v] * mm_px ** 2 / 1e6 <= POCKET_M2:
            region = crop == v
            if not (region & walls_here).any():
                own |= region
                pockets.append(int(v))
    mask = ndimage.binary_dilation(own, iterations=2) & ((crop == 0) | own)
    disk = np.hypot(*np.mgrid[-slit_px:slit_px + 1, -slit_px:slit_px + 1]) <= slit_px
    closed = ndimage.binary_closing(mask, structure=disk)
    filled = ndimage.binary_fill_holes(closed)
    holes, nh = ndimage.label(filled & ~closed)
    big = np.zeros_like(filled)
    if nh:
        hsz = np.bincount(holes.ravel())
        keep = [h for h in range(1, nh + 1) if hsz[h] * mm_px ** 2 / 1e6 >= MIN_VOID_M2]
        if keep:
            big = np.isin(holes, keep)

    def rings_of(m) -> tuple[list, float]:
        found, _ = cv2.findContours(m.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        rings, length = [], 0.0
        for c in found:
            c = cv2.approxPolyDP(c, 1.0, True)[:, 0, :].tolist()
            if len(c) < 3:
                continue
            rings.append([(round((x0 + qx + 0.5) / PX_PER_PT, 2), round((y0 + qy + 0.5) / PX_PER_PT, 2))
                          for qx, qy in c])
            length += sum(math.dist(a, b) for a, b in zip(c, c[1:] + c[:1]))
        return rings, length

    def area_of(rings) -> float:
        return sum(abs(sum(ax * by - bx * ay for (ax, ay), (bx, by) in zip(r, r[1:] + r[:1]))) / 2 for r in rings)

    rings, per_px = rings_of(filled)
    voids, _ = rings_of(big) if big.any() else ([], 0.0)
    k = mm_px * PX_PER_PT / 1000                     # metres per sheet point
    return (area_of(rings) - area_of(voids)) * k * k, per_px * mm_px / 1000, rings, pockets


def _labels(sheet: Sheet) -> list[tuple[str, float, float]]:
    """Room-name labels: longest vocabulary phrase on one text line."""
    words = [w for w in sheet.own_words if "TAG" not in w.layer.upper()]
    lines: list[list] = []
    for w in sorted(words, key=lambda w: (round(w.cy / 2), w.x0)):
        if lines and abs(lines[-1][-1].cy - w.cy) < 2 and 0 <= w.x0 - lines[-1][-1].x1 < 8:
            lines[-1].append(w)
        else:
            lines.append([w])
    # a two-line label ("STUDIO" over "LIVING/DINING") is merged with the line directly below
    out = []
    names = sorted(ROOM_TYPES, key=len, reverse=True)
    used = set()
    for i, ln in enumerate(lines):
        text = " ".join(w.text for w in ln).upper()
        below = [j for j, l2 in enumerate(lines) if j != i and j not in used and 0 < l2[0].cy - ln[0].cy < 14
                 and abs((l2[0].x0 + l2[-1].x1) / 2 - (ln[0].x0 + ln[-1].x1) / 2) < 25]
        cands = [text] + [text + " " + " ".join(w.text for w in lines[j]).upper() for j in below]
        for cand in sorted(cands, key=len, reverse=True):
            hit = next((n for n in names if re.search(rf"(^|\s){re.escape(n)}($|\s)", cand)), None)
            if hit:
                x = (ln[0].x0 + ln[-1].x1) / 2
                out.append((hit, x, ln[0].cy))
                break
    return out


def measure_rooms(sheet: Sheet, cal: Calibration, pieces=()) -> tuple[list[Room], list[tuple[str, list]], tuple]:
    """Rooms, and (reason, [(name, x, y)] of its labels) for every label that could not be measured. pieces: this
    sheet's wall pieces."""
    if not cal.mm_per_pt:
        return [], [("sheet not calibrated", [])], None
    H, W = int(sheet.height * PX_PER_PT) + 1, int(sheet.width * PX_PER_PT) + 1
    free = ~_barrier(sheet, (H, W), door_closers(pieces, cal.mm_per_pt))
    lab, nlab = ndimage.label(free)
    del free
    border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]])))
    mm_px = cal.mm_per_pt / PX_PER_PT
    seeds = _labels(sheet)
    by_region: dict[int, list] = {}
    problems: list[tuple[str, list]] = []
    sizes = _counts(lab, nlab + 1)
    min_px = MIN_ROOM_M2 * 1e6 / mm_px ** 2
    step_px = max(2, int(150 / mm_px))              # look out in 150 mm steps, up to 1.2 m
    for name, x, y in seeds:
        cy, cx = min(H - 1, int(y * PX_PER_PT)), min(W - 1, int(x * PX_PER_PT))
        r = int(lab[cy, cx])
        if r == 0 or sizes[r] < min_px:
            # the label sits on a line or inside a fixture outline: take the room that surrounds it -
            # the largest region met within 1.2 m that is not the sheet's outside
            found = {}
            for k in range(1, 9):
                d = k * step_px
                for dy, dx in ((-d, 0), (d, 0), (0, -d), (0, d), (-d, -d), (-d, d), (d, -d), (d, d)):
                    yy, xx = cy + dy, cx + dx
                    if 0 <= yy < H and 0 <= xx < W:
                        v = int(lab[yy, xx])
                        if v and sizes[v] >= min_px:
                            found[v] = found.get(v, 0) + 1
                if found:
                    break
            if not found:
                problems.append((f"{name} label at ({x:.0f},{y:.0f}) sits on a line or in a fixture with no room "
                                 f"found around it - not measured", [(name, x, y)]))
                continue
            r = max(found, key=lambda v: (found[v], sizes[v]))
        by_region.setdefault(r, []).append((name, x, y))
    ids = np.array(sorted(by_region), dtype=np.int64)
    if len(ids) == 0:
        return [], problems, None
    areas = sizes[ids]                              # each region's pixels
    boxes = ndimage.find_objects(lab)
    centre = _centrelines(pieces, (H, W))
    labelled = {int(r) for r in ids}                # a pocket is merged into one room at most
    merged: dict[int, int] = {}                     # pocket region -> the room region it joined
    rooms: list[Room] = []
    for rid, area_px in zip(ids, areas):
        members = by_region[int(rid)]
        cats = {ROOM_TYPES[n][0] for n, _, _ in members}
        area = float(area_px) * mm_px ** 2 / 1e6     # the fill's own pixels, for the refusals below
        names = sorted({n for n, _, _ in members})
        name = " / ".join(names)
        at = list(members)
        limit = max(ROOM_TYPES[n][1] for n in names) * max(1, len(members))
        if area < MIN_ROOM_M2:
            problems.append((f"{name}: label sits inside a {area:.2f} m2 outline (a fixture, not the room) - "
                             f"not measured from this label", at))
            continue
        if int(rid) in border:
            problems.append((f"{name}: fill escapes to the sheet edge (an opening is not closed on plan) - not "
                             f"measured", at))
            continue
        if "wet" in cats and len(cats) > 1:
            problems.append((f"{name}: a wet and a dry room fill as one space (open doorway) - not measured", at))
            continue
        if area > limit:
            problems.append((f"{name}: {area:.1f} m2 is more than a room of this kind can be ({limit} m2) - "
                             f"the fill leaked; not measured", at))
            continue
        net_area, per, rings, pockets = _net(lab, int(rid), sizes, boxes, labelled | set(merged), border,
                                             centre, mm_px)
        for v in pockets:
            merged[v] = int(rid)
        for n, x, y in members[:1]:
            rooms.append(Room(name, ROOM_TYPES[names[0]][0] if len(cats) == 1 else "dry",
                              net_area, per, (x, y), int(rid), poly=rings))
        if len(members) > 1 and len(names) == 1:
            # one space labelled twice (e.g. a long corridor): measured once
            pass
    # a pocket merged into a room is that room's everywhere a point is looked up in the masks (which room a wall
    # face, a door or a click lies in)
    for v, rid in merged.items():
        box = boxes[v - 1]
        if box is not None:
            sub = lab[box]
            sub[sub == v] = rid
    rooms.sort(key=lambda r: (r.name, r.seed[1], r.seed[0]))
    for n, r in enumerate(rooms):
        r.id = f"r{n}"
    return rooms, problems, (lab, PX_PER_PT, sorted({r.region for r in rooms}))
