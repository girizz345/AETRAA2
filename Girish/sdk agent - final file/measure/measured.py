#!/usr/bin/env python3
"""
measured.py — S9's second source: measured elements, beside the scheduled ones
(CR-01 R1, R2).

S8 measured the plans (walls, rooms) and settled the stated figures a height
needs (storey levels, slab thickness, block sizes). This turns them into
evidence records and elements in the same vocabulary the schedule path uses,
so classification, compute, take-off, markup and descriptions treat them
alike. What is new is only where a dimension comes from: a calibrated shape
on a plan (Origin.MEASURED), or a stated level difference (Origin.DERIVED).

One element is one BILL ITEM, built from several dimension lines - one per
plan and storey, and one per group of openings deducted - each line citing its
own evidence and carrying the shapes the markup draws (records.MeasuredLine).
The quantity is still produced in one place only, measure.compute.

  D2.1  blockwork, one item per stated block thickness:
          wall length on plan x clear height            (the plan's wall lines
        + opening widths added back x clear height        stop at openings)
        - each opening deducted as its own line: doors always (at the edge of
          the wall - GP3.3), windows 1.00 m2 or more (GP3.2)
  J3.1  floor, ceiling and wall finishes by room class (wet areas, rooms):
          floors and ceilings: room area on plan
          walls: room perimeter x clear height, openings deducted as above
  J3.2  skirtings: room perimeter less door widths
  G2.1  waterproofing: floors of wet areas; roofs, terraces and balconies

Clear height = the storey height (S8) less the stated slab thickness. A storey
without a height, a plan without a slab thickness, or a wall thickness no note
calls blockwork is a gap - never a default.
"""
from __future__ import annotations

import math
from decimal import ROUND_HALF_UP, Decimal
from pathlib import Path

from spine.gaps import Gap
from spine.records import Element, MeasuredLine, Origin

STAGE = "S9"
VOID_THRESHOLD_M2 = Decimal("1.00")     # GP3.2
TAG_REACH_MM = 1500                     # a tag within this of a wall is that wall's opening (tags
                                        # sit inside the room, off the wall; the platform's reach)
SIDE_OFFSET_MM = 150                    # looked for a room this far beyond each face

# element type -> (clause, bill wording slot "type")
MEASURED_CLAUSES = {
    "blockwork": "D2.1",
    "floor_finish": "J3.1",
    "wall_finish": "J3.1",
    "ceiling_finish": "J3.1",
    "skirting": "J3.2",
    "floor_waterproofing": "G2.1",
    "roof_waterproofing": "G2.1",
}
CLASS_WORDS = {"wet": "wet areas", "dry": "rooms"}


def _q2(v) -> Decimal:
    return Decimal(str(v)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def _dist_to_segment(p, a, b) -> tuple[float, float, float]:
    """(distance, projection x, projection y) of point p to segment ab."""
    (px, py), (ax, ay), (bx, by) = p, a, b
    dx, dy = bx - ax, by - ay
    L2 = dx * dx + dy * dy or 1e-9
    t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / L2))
    cx, cy = ax + t * dx, ay + t * dy
    return math.hypot(px - cx, py - cy), cx, cy


def _inside(rings, x, y) -> bool:
    hit = False
    for ring in rings:
        n = len(ring)
        for i in range(n):
            (x0, y0), (x1, y1) = ring[i], ring[i - 1]
            if (y0 > y) != (y1 > y) and x < (x1 - x0) * (y - y0) / ((y1 - y0) or 1e-12) + x0:
                hit = not hit
    return hit


def _room_at(plan, x, y):
    return next((r for r in plan["rooms"] if _inside(r["poly"], x, y)), None)


def _sides(plan, wall, x, y) -> list:
    """The rooms either side of a wall, level with (x, y)."""
    k = plan["mm_per_pt"]
    (ax, ay), (bx, by) = wall["a"], wall["b"]
    L = math.hypot(bx - ax, by - ay) or 1e-9
    _d, cx, cy = _dist_to_segment((x, y), (ax, ay), (bx, by))
    nx, ny = -(by - ay) / L, (bx - ax) / L
    off = ((wall["raw_thk_mm"] or 0) / 2 + SIDE_OFFSET_MM) / k
    out = []
    for s in (1, -1):
        r = _room_at(plan, cx + s * nx * off, cy + s * ny * off)
        if r is not None and r not in out:
            out.append(r)
    return out


CORNER_SLACK_MM = 40      # how far a piece may stop short of a corner and still be at it


def centrelines(walls: list, k: float) -> dict:
    """wall id -> (a, b) on the CENTRELINE, run on to each L-corner. A wall
    piece is measured where its two faces run side by side, so at an L-corner
    neither wall counts the corner square and the girth falls short by a wall
    thickness at every corner. POMI measures walls on the centreline: at an
    L-corner (the two centrelines meet at the END of both) each piece runs on
    to the corner point - half the other wall's thickness. A T-junction's stem
    stops at the face of the wall it meets (that wall is measured through) and
    is not extended; nor is a crossing."""
    out = {w["id"]: [tuple(w["a"]), tuple(w["b"])] for w in walls}
    cell = max(1.0, 600 / k)
    grid: dict = {}
    for w in walls:
        for p in (w["a"], w["b"]):
            grid.setdefault((int(p[0] // cell), int(p[1] // cell)), []).append(w)

    def direction(w):
        (ax, ay), (bx, by) = w["a"], w["b"]
        L = math.hypot(bx - ax, by - ay) or 1e-9
        return (bx - ax) / L, (by - ay) / L

    def cross(p, u, q, v):
        """The meeting point of two lines p + s u and q + t v, or None."""
        det = u[0] * (-v[1]) - u[1] * (-v[0])
        if abs(det) < 1e-9:
            return None
        dx, dy = q[0] - p[0], q[1] - p[1]
        s = (dx * (-v[1]) - dy * (-v[0])) / det
        return p[0] + s * u[0], p[1] + s * u[1]

    def near(pt):
        cx, cy = int(pt[0] // cell), int(pt[1] // cell)
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                yield from grid.get((cx + dx, cy + dy), ())

    def partner(q, x, skip):
        """Another piece on q's own line that also ends at x: q and it are ONE
        wall running through the junction (split there by the wall they meet)."""
        v = direction(q)
        for p in near(x):
            if p is q or p is skip:
                continue
            pv = direction(p)
            if abs(v[0] * pv[0] + v[1] * pv[1]) < 0.98:
                continue
            # on q's line
            off = abs((x[0] - p["a"][0]) * pv[1] - (x[1] - p["a"][1]) * pv[0])
            if off > ((p["raw_thk_mm"] or 0) / 4) / k + 1e-6:
                continue
            reach = ((q["raw_thk_mm"] or 0) + 2 * CORNER_SLACK_MM) / k
            if min(math.dist(tuple(p["a"]), x), math.dist(tuple(p["b"]), x)) <= reach:
                return p
        return None

    def through_first(w, q):
        """At a crossing, which wall runs through: the thicker; at equal
        thickness the one nearer horizontal on the sheet - fixed, so every run
        chooses the same."""
        uw, uq = direction(w), direction(q)
        return ((w["raw_thk_mm"] or 0), abs(uw[0])) > ((q["raw_thk_mm"] or 0), abs(uq[0]))

    for w in walls:
        u = direction(w)
        for end in (0, 1):
            e = tuple((w["a"], w["b"])[end])
            best = None
            for q in near(e):
                if q is w:
                    continue
                v = direction(q)
                if abs(u[0] * v[0] + u[1] * v[1]) > 0.5:
                    continue                     # parallel: not a corner
                x = cross(e, u, tuple(q["a"]), v)
                if x is None:
                    continue
                reach_w = ((q["raw_thk_mm"] or 0) / 2 + CORNER_SLACK_MM) / k
                reach_q = ((w["raw_thk_mm"] or 0) / 2 + CORNER_SLACK_MM) / k
                d_w = math.dist(e, x)
                d_q = min(math.dist(tuple(q["a"]), x), math.dist(tuple(q["b"]), x))
                # the meeting point is at the end of BOTH pieces, and lies
                # beyond this end, not back along the piece
                ahead = ((x[0] - e[0]) * u[0] + (x[1] - e[1]) * u[1]) * (1 if end else -1)
                if not (d_w <= reach_w and d_q <= reach_q and ahead >= -1e-6):
                    continue
                # q continues through the junction on its own line: w is the
                # stem of a T and stops at q's face - unless w runs through as
                # well (a crossing), where the thicker wall is the one measured
                # through
                if partner(q, x, w) is not None:
                    if partner(w, x, q) is None or not through_first(w, q):
                        continue
                if best is None or d_w < best[0]:
                    best = (d_w, x)
            if best is not None:
                out[w["id"]][end] = best[1]
    return {i: (tuple(a), tuple(b)) for i, (a, b) in out.items()}


def openings_from(elements, base) -> dict:
    """normalised mark -> {mark, w, h, door} for every scheduled door or window
    whose width and height are stated (single figures; a unit sized in parts is
    left out - its legs are not one opening)."""
    from readers.counts import normalise_mark
    out = {}
    for e in elements:
        if e.element_type not in ("door", "window", "glazing", "louvre"):
            continue
        w_id, h_id = (e.dims or {}).get("width"), (e.dims or {}).get("height")
        if not w_id or not h_id:
            continue
        try:
            w, h = base.get(w_id).value, base.get(h_id).value
        except Exception:                                         # noqa: BLE001
            continue
        out.setdefault(normalise_mark(e.mark), {"mark": e.mark, "w": Decimal(w), "h": Decimal(h),
                                                "door": e.element_type == "door",
                                                "ids": (w_id, h_id)})
    return out


def _tags_on(plan_tags, doc_id) -> dict:
    for p in plan_tags or []:
        if p["doc_id"] == doc_id:
            return p["tags"]
    return {}


class _Builder:
    """Evidence and lines, accumulated per bill item."""

    def __init__(self, base):
        self.base = base
        self.items: dict[tuple, dict] = {}
        self.n = 0

    def ev(self, stem: str, value, unit: str, doc_id: str, origin: Origin, role: str) -> str:
        self.n += 1
        eid = f"m{self.n:05d}:{stem}"
        self.base.make(eid, value, unit, doc_id, None, origin, role=role)
        return eid

    def item(self, key: tuple, element_type: str, mark: str, words: dict, extra_dims: dict | None = None):
        if key not in self.items:
            self.items[key] = {"type": element_type, "mark": mark, "words": words, "lines": [],
                               "sheets": [], "dims": dict(extra_dims or {})}
        return self.items[key]

    def line(self, item, doc_id, level, desc, dims, nr=1, deduct=False, shapes=()):
        item["lines"].append(MeasuredLine(doc_id=doc_id, level=level, desc=desc, dims=dict(dims),
                                          nr=int(nr), deduct=deduct, shapes=tuple(shapes)))
        if doc_id not in item["sheets"]:
            item["sheets"].append(doc_id)

    def elements(self) -> list[Element]:
        out = []
        for key in sorted(self.items, key=lambda k: tuple(str(x) for x in k)):
            it = self.items[key]
            if not it["lines"]:
                continue
            ids = sorted({i for ln in it["lines"] for i in ln.dims.values()} | set(it["dims"].values()))
            out.append(Element(mark=it["mark"], element_type=it["type"], dims=dict(it["dims"]),
                               count=1, sheets=tuple(it["sheets"]), evidence_ids=tuple(ids),
                               lines=tuple(it["lines"]), words=dict(it["words"])))
        return out


def build(measured: dict, plan_tags, schedule_elements, base) -> tuple[list[Element], list[Gap], dict]:
    """(elements, gaps, facts for the checks). `measured` is S8's artefact."""
    gaps: list[Gap] = []
    facts = {"room_area": Decimal(0), "wall_gross": Decimal(0), "perimeter": Decimal(0),
             "rooms_wet": 0, "plans": 0, "storeys": 0}
    if not measured or not measured.get("plans"):
        return [], gaps, facts
    B = _Builder(base)
    storeys = {k: (Decimal(v["height_m"]), v["basis"]) for k, v in (measured.get("storeys") or {}).items()}
    slab_mm = measured.get("slab_mm")
    slab = Decimal(slab_mm) / 1000 if slab_mm else None
    blocks = set(measured.get("blocks_mm") or [])
    ops = openings_from(schedule_elements, base)
    basis = measured.get("basis") or {}

    for plan in sorted(measured["plans"], key=lambda p: p["doc_id"]):
        doc_id, dn = plan["doc_id"], plan.get("drawing_no") or Path(plan["doc_id"]).stem
        k = plan["mm_per_pt"]
        walls = plan.get("walls") or []
        rooms = [r for r in plan.get("rooms") or [] if r["class"] != "skip"]
        tags = _tags_on(plan_tags, doc_id)
        facts["plans"] += 1
        centre = centrelines(walls, k)

        def run_m(w):
            (ax, ay), (bx, by) = centre[w["id"]]
            return math.hypot(bx - ax, by - ay) * k / 1000

        # the openings on this plan: each tag, its wall and the rooms either side
        placed = []                       # (opening, wall, rooms, (x, y))
        unplaced: dict[str, int] = {}
        for key, points in sorted(tags.items()):
            o = ops.get(key)
            if o is None:
                continue
            for (x, y) in points:
                best, bd = None, None
                for w in walls:
                    d, _cx, _cy = _dist_to_segment((x, y), w["a"], w["b"])
                    if bd is None or d < bd:
                        best, bd = w, d
                reach = ((best["raw_thk_mm"] / 2 if best else 0) + TAG_REACH_MM) / k
                if best is None or bd > reach:
                    unplaced[o["mark"]] = unplaced.get(o["mark"], 0) + 1
                    continue
                placed.append((o, best, _sides(plan, best, x, y), (x, y)))
        if unplaced:
            gaps.append(Gap(stage=STAGE, doc_id=doc_id, subject=dn,
                            reason="tags with no wall within reach, so their openings are neither added "
                                   "back nor deducted: " + ", ".join(f"{m} x{n}" for m, n in sorted(unplaced.items()))))

        # walls: which are between two external areas (dividers, parapets)
        divider = set()
        for w in walls:
            mx, my = (w["a"][0] + w["b"][0]) / 2, (w["a"][1] + w["b"][1]) / 2
            sides = _sides(plan, w, mx, my)
            if len(sides) == 2 and all(s["class"] == "ext" for s in sides):
                divider.add(w["id"])

        for floor in plan["measured_floors"]:
            facts["storeys"] += 1
            level = floor
            if floor not in storeys:
                gaps.append(Gap(stage=STAGE, doc_id=doc_id, subject=f"{dn} {floor}",
                                reason=f"no storey height for {floor}, so its walls and wall finishes are "
                                       f"not measured (floors, ceilings and waterproofing are)"))
                H = None
            elif slab is None:
                H = None
            else:
                H = storeys[floor][0] - slab
            h_id = None
            if H is not None:
                h_id = B.ev(f"{dn}:{floor}:H", H, "m", doc_id, Origin.DERIVED, "height")

            # ── D blockwork ──────────────────────────────────────────────
            by_thk: dict[int, list] = {}
            other: dict = {}
            for w in walls:
                if w["id"] in divider:
                    continue
                if w["thk_mm"] in blocks:
                    by_thk.setdefault(w["thk_mm"], []).append(w)
                else:
                    other[w["thk_mm"]] = other.get(w["thk_mm"], 0.0) + w["length_m"]
            div_len = sum(w["length_m"] for w in walls if w["id"] in divider)
            if div_len >= 0.5:
                gaps.append(Gap(stage=STAGE, doc_id=doc_id, subject=f"{dn} {floor}",
                                reason=f"{div_len:.2f} m of walls between external areas (balcony "
                                       f"dividers, parapets) - their height is not stated, so they are "
                                       f"not billed"))
            for thk, L in sorted(other.items(), key=lambda kv: str(kv[0])):
                if L >= 0.5 and blocks:
                    gaps.append(Gap(stage=STAGE, doc_id=doc_id, subject=f"{dn} {floor}",
                                    reason=f"{L:.2f} m of wall lines {thk or 'of unclassified'}"
                                           f"{'mm' if thk else ''} thick - not a thickness the notes call "
                                           f"blockwork (concrete, cladding or a drafting line); not billed "
                                           f"in D"))
            if H is not None:
                for thk, ws in sorted(by_thk.items()):
                    item = B.item(("D", thk), "blockwork", f"Walls {thk}mm thick",
                                  {"type": f"walls, {thk}mm thick"},
                                  {"thickness": B.ev(f"D:{thk}:t", Decimal(thk) / 1000, "m",
                                                     doc_id, Origin.MEASURED, "thickness")}
                                  if ("D", thk) not in B.items else None)
                    L = _q2(sum(run_m(w) for w in ws))
                    facts["wall_gross"] += L * H
                    B.line(item, doc_id, level,
                           f"{thk}mm walls, length on the centreline, corners completed (openings "
                           f"excluded) x clear height ({storeys[floor][1]}; less {slab_mm} mm slab, "
                           f"{basis.get('slab')})",
                           {"length": B.ev(f"{dn}:{floor}:D{thk}:L", L, "m", doc_id, Origin.MEASURED, "length"),
                            "height": h_id},
                           shapes=[("polyline", centre[w["id"]]) for w in ws])
                    _openings(B, item, [p for p in placed if p[1]["thk_mm"] == thk and p[1]["id"] not in divider],
                              doc_id, dn, floor, level, H, h_id, f"D{thk}")

            # ── J finishes, G waterproofing ───────────────────────────────
            by_class: dict[str, list] = {}
            for r in rooms:
                by_class.setdefault(r["class"], []).append(r)
            for cls, rs in sorted(by_class.items()):
                area = _q2(sum(Decimal(str(r["area_m2"])) for r in rs))
                names = sorted({r["name"] for r in rs})
                label = f"{len(rs)} room(s): {', '.join(names[:6])}{' ...' if len(names) > 6 else ''}"
                polys = ([("polygon", tuple(tuple(p) for p in ring)) for r in rs for ring in r["poly"]]
                         + [("void", tuple(tuple(p) for p in ring)) for r in rs
                            for ring in r.get("voids") or []])
                a_id = B.ev(f"{dn}:{floor}:{cls}:A", area, "m2", doc_id, Origin.MEASURED, "area")
                if cls == "ext":
                    item = B.item(("G", "roof"), "roof_waterproofing", "Roofs, terraces and balconies",
                                  {"type": "to roofs, terraces and balconies"})
                    B.line(item, doc_id, level, label, {"area": a_id}, shapes=polys)
                    continue
                facts["room_area"] += area
                words = CLASS_WORDS.get(cls, "rooms")
                B.line(B.item(("J", "floor", cls), "floor_finish", f"Floors, {words}", {"type": f"to floors, {words}"}),
                       doc_id, level, label, {"area": a_id}, shapes=polys)
                B.line(B.item(("J", "ceil", cls), "ceiling_finish", f"Ceilings, {words}",
                              {"type": f"to ceilings, {words}"}), doc_id, level, label, {"area": a_id}, shapes=polys)
                if cls == "wet":
                    facts["rooms_wet"] += len(rs)
                    B.line(B.item(("G", "wet"), "floor_waterproofing", "Floors of wet areas",
                                  {"type": "to floors of wet areas"}), doc_id, level, label, {"area": a_id},
                           shapes=polys)
                per = _q2(sum(Decimal(str(r["perimeter_m"])) for r in rs))
                facts["perimeter"] += per
                p_id = B.ev(f"{dn}:{floor}:{cls}:P", per, "m", doc_id, Origin.MEASURED, "length")
                outlines = [("polyline", tuple(tuple(p) for p in ring) + (tuple(ring[0]),))
                            for r in rs for ring in r["poly"]]
                in_rooms = [p for p in placed if any(s in rs for s in p[2])]
                # skirtings: perimeter less the doors' widths, each face a door opens on
                sk = B.item(("J", "skirt", cls), "skirting", f"Skirtings, {words}", {"type": f"to walls, {words}"})
                B.line(sk, doc_id, level, f"{label}: room perimeter", {"length": p_id}, shapes=outlines)
                doors: dict[str, list] = {}
                for o, _w, sides, pt in in_rooms:
                    if o["door"]:
                        doors.setdefault(o["mark"], []).append((o, sum(1 for s in sides if s in rs)))
                for mark, found in sorted(doors.items()):
                    o, n = found[0][0], sum(c for _o, c in found)
                    B.line(sk, doc_id, level, f"deduct door {mark} ({int(o['w'] * 1000)} mm), "
                                              f"{n} face(s) in these rooms",
                           {"length": o["ids"][0]}, nr=n, deduct=True)
                if H is None:
                    continue
                wf = B.item(("J", "wall", cls), "wall_finish", f"Walls, {words}", {"type": f"to walls, {words}"})
                B.line(wf, doc_id, level, f"{label}: room perimeter x clear height", {"length": p_id,
                                                                                     "height": h_id},
                       shapes=outlines)
                faces = [(o, w, [s for s in sides if s in rs], pt) for o, w, sides, pt in in_rooms]
                _deduct(B, wf, faces, doc_id, level, H, h_id)
    return B.elements(), gaps, facts


def _openings(B, item, placed, doc_id, dn, floor, level, H, h_id, tag):
    """Walling across the openings added back (the wall lines stop at them),
    then each opening deducted as its own line where POMI deducts it."""
    groups: dict[str, list] = {}
    for o, _w, _sides, _pt in placed:
        groups.setdefault(o["mark"], []).append(o)
    for mark, os_ in sorted(groups.items()):
        o, n = os_[0], len(os_)
        B.line(item, doc_id, level, f"add back walling across {mark} openings ({int(o['w'] * 1000)} mm wide; "
                                    f"the plan's wall lines stop at them)",
               {"length": o["ids"][0], "height": h_id}, nr=n)
        _deduct_line(B, item, o, n, doc_id, level, H, h_id)


def _deduct(B, item, faces, doc_id, level, H, h_id):
    groups: dict[str, list] = {}
    for o, _w, sides, _pt in faces:
        if sides:
            groups.setdefault(o["mark"], []).append((o, len(sides)))
    for mark, found in sorted(groups.items()):
        o, n = found[0][0], sum(c for _o, c in found)
        _deduct_line(B, item, o, n, doc_id, level, H, h_id)


def _deduct_line(B, item, o, n, doc_id, level, H, h_id):
    """One deduction line for n openings of one mark: a door always (it is at
    the edge of the measured area, GP3.3); a window when 1.00 m2 or more
    (GP3.2). An opening taller than the clear height takes the clear height."""
    area = o["w"] * o["h"]
    if not o["door"] and area < VOID_THRESHOLD_M2:
        return
    rule = "GP3.3, at the edge of the area" if o["door"] else "GP3.2, 1.00 m2 or more"
    if o["h"] > H and h_id:
        dims = {"length": o["ids"][0], "height": h_id}
        note = "full clear height"
    else:
        dims = {"length": o["ids"][0], "height": o["ids"][1]}
        note = f"{int(o['h'] * 1000)} mm high"
    B.line(item, doc_id, level, f"deduct {o['mark']} ({int(o['w'] * 1000)} x {note}; {rule})", dims,
           nr=n, deduct=True)
