#!/usr/bin/env python3
"""
plan_measure.py — S8: the plans measured, and the stated figures that measuring
walls needs (CR-01 R1-R3).

Everything before this stage reads what the drawings STATE: schedules, tags,
levels. A bill is mostly work measured off the plans - blockwork by wall
length x height, finishes by room area - and until this stage no part of the
agent measured a plan. This stage does, and only where the measurement can be
proved:

  * on a CALIBRATED plan only (S4: its own dimension chain, or the set's grid
    read and checked bay by bay). A plan whose scale is not verified is a gap.
  * from the drawing's own CAD layers: walls from the wall layer (their two
    faces, paired), rooms by flood fill bounded by walls, doors, glazing and
    columns, each seeded at a room-name label. The engine is the platform's
    (boq_arch/walls.py, rooms.py) - one measuring engine for both tools. A PDF
    without layers gives no walls and says so.
  * one general-arrangement plan per storey, from a discipline that feeds the
    measured sections, so a plumbing layout drawn over the same walls is never
    measured twice.

It also settles, from the drawings, the three figures a wall's height needs -
and refuses to settle any of them by assumption (P4):

  storey heights  the section's level markers (FFL / SSL), read from the text
                  layer or transcribed, each checked against the printed
                  vertical dimension chain where one is printed
  slab thickness  as a note states it ("15cm CONCRETE SLAB"), or a QS decision
  block sizes     the wall thicknesses the details call blockwork ("200mm ...
                  THICK HOLLOW BLOCK"), or a QS decision

A QS decision is BOQ_DECISIONS.json beside the drawings, e.g.
  {"slab_thickness_mm": 200, "block_thicknesses_mm": [100, 150, 200]}
It is the surveyor's own statement, recorded as such in every basis.

No quantity is produced here; S9 (measure.measured) turns these facts into
evidence and elements, and S12 computes.

  python3 -m measure.plan_measure <plan.pdf> --mm-per-pt 53.76
"""
from __future__ import annotations

import argparse
import json
import math
import re
import sys
from decimal import Decimal
from pathlib import Path
from types import SimpleNamespace

from spine.gaps import Gap

STAGE = "S8"
HERE = Path(__file__).resolve().parents[1]
BOQ_ARCH = HERE.parent / "boq_arch"
ROOMS_TABLE = HERE / "data" / "rooms.json"
DECISIONS_FILE = "BOQ_DECISIONS.json"

# the datums that define a storey: finished floor or structural slab level
FLOOR_DATUMS = {"FFL": 0, "F.F.L": 0, "F.F.L.": 0, "FL": 0, "SSL": 1, "S.S.L": 1, "S.S.L.": 1,
                "SL": 1, "TOS": 1}
HEIGHT_LIMITS = (Decimal("1.80"), Decimal("12.00"))   # a storey outside these is a misread, not a storey
CHAIN_TOLERANCE = Decimal("0.01")                      # m: levels and the printed chain must agree to 10 mm
SLAB_LIMITS = (80, 600)                                # mm
BLOCK_LIMITS = (50, 400)                               # mm

# a plan whose title says it is not the general arrangement of its storey
NOT_GA = re.compile(r"CEILING|\bRCP\b|REFLECTED|FURNITURE|FINISH|FLOORING|SETTING\s*OUT|ENLARGED|"
                    r"\bPART\b|DEMOLITION|LANDSCAPE|KEY\s+PLAN|SITE\s+PLAN|DRAINAGE|WATER\s+SUPPLY|"
                    r"LIGHTING|POWER|HVAC|FIRE\s+(?:FIGHTING|ALARM|PROTECTION)|PLUMBING|SANITARY|"
                    r"ELECTRICAL|STRUCTURAL|FOUNDATION|FRAMING|REINFORCEMENT|FURNITURE\s+LAYOUT", re.I)

SLAB = [
    re.compile(r"(\d{2,3}(?:\.\d)?)\s*(MM|CM)\.?\s*(?:\(\s*\d+\s*\"?\s*\)\s*)?(?:THK\.?|THICK(?:NESS)?)?\s*"
               r"(?:R\.?\s?C\.?\s?C?\.?\s*|REINFORCED\s+CONCRETE\s+|CONCRETE\s+|RC\s+)"
               r"(?:SUSPENDED\s+|FLOOR\s+|ROOF\s+)?SLAB\b", re.I),
    re.compile(r"\bSLAB\s+(?:THICKNESS|THK\.?)\s*[:=\-]?\s*(\d{2,3}(?:\.\d)?)\s*(MM|CM)\b", re.I),
]
BLOCK = re.compile(r"((?:\d{2,3}\s*MM\s*(?:\(\s*\d+\s*\"?\s*\)\s*)?)+)(?:THK\.?|THICK)?\s*"
                   r"(?:(?:HOLLOW|SOLID|CONCRETE|CEMENT|AAC|THERMAL|INSULATED|LIGHT\s*WEIGHT)\s+)*"
                   r"(?:BLOCK|BLOCKWORK|BRICK|BRICKWORK|MASONRY)", re.I)


class EngineMissing(RuntimeError):
    pass


# ── the measuring engine ─────────────────────────────────────────────────────
def engine():
    """The platform's wall and room engine, with the agent's room vocabulary
    (data/rooms.json) and layer words added to the platform's own. Raises
    EngineMissing, with what to install, when it cannot be loaded."""
    try:
        import cv2  # noqa: F401
        import numpy  # noqa: F401
        import scipy  # noqa: F401
    except ImportError as exc:
        raise EngineMissing(f"{exc.name} is not installed (pip install numpy scipy "
                            f"opencv-python-headless)") from exc
    if not (BOQ_ARCH / "boq_arch" / "walls.py").is_file():
        raise EngineMissing(f"the measuring engine is not beside the agent ({BOQ_ARCH})")
    if str(BOQ_ARCH) not in sys.path:
        sys.path.insert(0, str(BOQ_ARCH))
    from boq_arch import rooms as R
    from boq_arch import walls as W
    from boq_arch.calibrate import Calibration, Grid
    from boq_arch.sheet import Sheet

    table = json.loads(ROOMS_TABLE.read_text(encoding="utf-8"))
    if not getattr(R, "_agent_widened", False):
        platform = set(R.ROOM_TYPES)
        for name, (cls, limit) in table["rooms"].items():
            R.ROOM_TYPES.setdefault(name, (cls, limit))
        R.BARRIER_WORDS = tuple(dict.fromkeys(tuple(R.BARRIER_WORDS)
                                              + tuple(table.get("barrier_layer_words", []))))
        R._labels = _strict_labels(R, platform, set(table.get("weak", [])))
        R._agent_widened = True
    return SimpleNamespace(rooms=R, walls=W, Sheet=Sheet, Calibration=Calibration, Grid=Grid)


def _strict_labels(R, platform: set, weak: set = frozenset()):
    """The platform's label reader, with one rule for the names the agent adds:
    such a name is a room label only when it OPENS a short line of its own (four
    words at most - "BEDROOM 2", "W.C. 3", "OFFICE"). The added names are
    generic words; inside a note ("POWDER COATED ALUMINIUM", "SHOWER SCREEN") they
    planted a room in a terrace, and the terrace was refused as two rooms. The
    platform's own names read as before."""
    original = R._labels

    def labels(sheet):
        found = original(sheet)
        # the weak names only where the other names find almost nothing
        sparse = sum(1 for n, _x, _y in found if n not in weak) < 3
        out = []
        words = [w for w in sheet.own_words if "TAG" not in w.layer.upper()]
        lines: dict = {}
        for w in words:
            lines.setdefault(round(w.cy / 2), []).append(w)
        for name, x, y in found:
            if name in weak and name not in platform and not sparse:
                continue
            if name in platform:
                out.append((name, x, y))
                continue
            row = sorted(lines.get(round(y / 2), []), key=lambda w: w.x0)
            near = [w for w in row if abs(w.cy - y) < 2 and abs((w.x0 + w.x1) / 2 - x) < 300]
            text = " ".join(w.text for w in near).upper()
            if len(text.split()) <= 4 and re.match(rf"{re.escape(name)}(\s|$)", text):
                out.append((name, x, y))
        return out

    return labels


def room_class(name: str) -> str:
    """wet / dry / ext / skip, from the room vocabulary (the longest listed
    name within the label)."""
    table = json.loads(ROOMS_TABLE.read_text(encoding="utf-8"))["rooms"]
    u = " ".join(str(name).upper().split())
    for key in sorted(table, key=len, reverse=True):
        if re.search(rf"(^|\s|/){re.escape(key)}($|\s|/)", u):
            return table[key][0]
    return "dry"


# ── decisions and stated texts ──────────────────────────────────────────────
def decisions(project: Path) -> tuple[dict, str | None]:
    """The QS's decisions beside the drawings, and a problem if the file is
    there but unreadable (which is a gap: a decision that does not load is not
    silently ignored)."""
    path = Path(project) / DECISIONS_FILE
    if not path.is_file():
        return {}, None
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        return (data if isinstance(data, dict) else {}), None
    except (OSError, ValueError) as exc:
        return {}, f"{DECISIONS_FILE} could not be read ({exc}); no decision in it is applied"


def _lines(words) -> list[str]:
    """A sheet's words as text lines (top to bottom, left to right)."""
    rows: list[list] = []
    for w in sorted(words, key=lambda w: ((w.y0 + w.y1) / 2, w.x0)):
        h = max(w.y1 - w.y0, 0.1)
        cy = (w.y0 + w.y1) / 2
        if rows and abs(rows[-1][0] - cy) <= 0.6 * h and w.x0 - rows[-1][1][-1].x1 < 4 * h:
            rows[-1][1].append(w)
        else:
            rows.append([cy, [w]])
    return [" ".join(x.text for x in sorted(r[1], key=lambda w: w.x0)) for r in rows]


def stated_texts(ctx, store) -> list[tuple[str, str]]:
    """(doc_id, text) for every note a section, detail or plan states: its text
    layer, and any saved 'notes' reading of it (the platform's or this agent's)."""
    from readers.transcribe import sheet_sha1
    from spine.files import project_files

    on_disk = project_files(ctx["project"])
    words = ctx.get("words_by_doc") or {}
    out = []
    for row in sorted(ctx.get("routing") or [], key=lambda r: r["doc_id"]):
        kind = row.get("kind")
        if kind not in ("detail", "section", "plan", "elevation", "general", "schedule"):
            continue
        doc_id = row["doc_id"]
        path = on_disk.get(doc_id)
        sheet_words = words.get(doc_id)
        if sheet_words is None and path is not None and kind in ("detail", "section", "general"):
            # a notes sheet with little drawn on it is not kept by S4 (not a
            # measurable drawing), and is often where the slab is stated
            try:
                from readers.extract import extract_words
                sheet_words = extract_words(path, 0)
            except Exception:                                     # noqa: BLE001
                sheet_words = None
        if sheet_words:
            out.append((doc_id, "\n".join(_lines(sheet_words))))
        if path is not None and kind in ("detail", "section"):
            found = store.find(sheet_sha1(path), "notes") if store is not None else None
            if found:
                out.append((doc_id, "\n".join(str(n.get("text", "")) for n in found[0].get("notes", []))))
    return out


def slab_thickness(texts, dec: dict) -> tuple[int | None, str, list[str]]:
    """(mm, basis, problems). A QS decision wins; otherwise the thickness the
    notes state, where every statement agrees."""
    if dec.get("slab_thickness_mm"):
        return int(dec["slab_thickness_mm"]), f"QS decision ({DECISIONS_FILE})", []
    found: dict[int, list] = {}
    for doc_id, text in texts:
        for rx in SLAB:
            for m in rx.finditer(text):
                v = Decimal(m.group(1)) * (10 if m.group(2).upper() == "CM" else 1)
                mm = int(v)
                if SLAB_LIMITS[0] <= mm <= SLAB_LIMITS[1]:
                    found.setdefault(mm, []).append(f"'{' '.join(m.group(0).split())}' ({Path(doc_id).name})")
    if not found:
        return None, "", ["no slab thickness is stated in the notes the drawings carry"]
    if len(found) > 1:
        listed = "; ".join(f"{mm} mm: {', '.join(sorted(set(w))[:2])}" for mm, w in sorted(found.items()))
        return None, "", [f"the notes state different slab thicknesses ({listed}) - which applies to "
                          f"which storey is not stated; record it in {DECISIONS_FILE}"]
    mm, where = next(iter(found.items()))
    return mm, f"stated: {sorted(set(where))[0]}", []


def block_thicknesses(texts, dec: dict) -> tuple[list[int], str]:
    """The wall thicknesses the details call blockwork (or brick, masonry)."""
    if dec.get("block_thicknesses_mm"):
        return sorted(int(v) for v in dec["block_thicknesses_mm"]), f"QS decision ({DECISIONS_FILE})"
    found: dict[int, str] = {}
    for doc_id, text in texts:
        for m in BLOCK.finditer(text):
            for v in re.findall(r"(\d{2,3})\s*MM", m.group(1), re.I):
                mm = int(v)
                if BLOCK_LIMITS[0] <= mm <= BLOCK_LIMITS[1]:
                    found.setdefault(mm, f"'{' '.join(m.group(0).split())}' ({Path(doc_id).name})")
    if not found:
        return [], ""
    return sorted(found), "stated: " + "; ".join(sorted(set(found.values()))[:3])


# ── storey heights ──────────────────────────────────────────────────────────
def _value(text: str) -> Decimal | None:
    t = str(text).replace("−", "-").replace("±", "")
    m = re.search(r"([+\-]?)\s*(\d+(?:\.\d+)?)", t)
    if not m:
        return None
    v = Decimal(m.group(2))
    return -v if m.group(1) == "-" else v


def _floor_key(name: str) -> str | None:
    from measure.inventory import plan_floors
    keys = plan_floors(name)
    return keys[0] if len(keys) == 1 else None


def heights_from_reading(reading: dict, doc_id: str) -> tuple[dict, list[str]]:
    """key -> (height m, basis) from a section's level markers, and the
    problems found. A storey's level is its FFL (else its SSL); its height is
    the next storey's level less its own; where the printed chain gives the same
    pair, the two must agree within 10 mm or the height is not used."""
    levels: dict[str, tuple[int, Decimal, str]] = {}
    for r in reading.get("levels") or []:
        datum = " ".join(str(r.get("datum", "")).upper().split())
        if datum not in FLOOR_DATUMS:
            continue
        key, value = _floor_key(r.get("name", "")), _value(r.get("value", ""))
        if key is None or value is None:
            continue
        rank = FLOOR_DATUMS[datum]
        if key not in levels or rank < levels[key][0]:
            levels[key] = (rank, value, datum)
    chain = {}
    for c in reading.get("chain") or []:
        a, b = _floor_key(str(c.get("from", ""))), _floor_key(str(c.get("to", "")))
        if a and b:
            chain[(a, b)] = Decimal(str(c["mm"])) / 1000
    order = sorted(levels, key=lambda k: levels[k][1])
    out, problems = {}, []
    sheet = Path(doc_id).name
    for a, b in zip(order, order[1:]):
        (_ra, va, da), (_rb, vb, db) = levels[a], levels[b]
        h = vb - va
        basis = f"{b} {db} {vb:+} less {a} {da} {va:+} ({sheet})"
        if not HEIGHT_LIMITS[0] <= h <= HEIGHT_LIMITS[1]:
            problems.append(f"storey {a}: levels give {h} m, outside a storey's range - not used")
            continue
        stated = chain.get((a, b))
        if stated is not None and abs(stated - h) > CHAIN_TOLERANCE:
            problems.append(f"storey {a}: levels give {h} m but the printed chain states {stated} m "
                            f"- not used until the drawings agree")
            continue
        if stated is not None:
            basis += f"; agrees with the printed {int(stated * 1000)} mm"
        if da != db:
            basis += f" (datums differ: {da} / {db})"
        out[a] = (h, basis)
    if order:
        top = order[-1]
        problems.append(f"storey {top}: no level above it is read, so no height")
    return out, problems


def storey_heights(ctx, store, live) -> tuple[dict, str, list[Gap]]:
    """(key -> (height, basis), where they came from, gaps). The level markers
    of a section sheet - saved reading first (it costs nothing), else the
    section most likely to carry the building's levels, read live or left as
    ONE request."""
    from readers.transcribe import obtain, sheet_sha1
    from spine.files import project_files

    gaps: list[Gap] = []
    on_disk = project_files(ctx["project"])
    sections = [r for r in ctx.get("routing") or [] if r.get("kind") == "section"
                and on_disk.get(r["doc_id"]) is not None]
    if not sections:
        gaps.append(Gap(stage=STAGE, doc_id=None, subject="storey heights",
                        reason="no section sheet in the set, so no storey height is stated; walls and "
                               "wall finishes are not measured"))
        return {}, "", gaps

    def rank(r):
        title = str(r.get("title") or r["doc_id"]).upper()
        return (0 if store.find(sheet_sha1(on_disk[r["doc_id"]]), "levels") else 1,
                0 if "WALL SECTION" in title else 1 if "SECTION" in title else 2, r["doc_id"])

    tried = 0
    for r in sorted(sections, key=rank):
        path = on_disk[r["doc_id"]]
        saved = store.find(sheet_sha1(path), "levels")
        if not saved and tried:
            break                                     # one request at most
        tried += 1
        reading, how = obtain(path, "levels", r.get("drawing_no") or Path(r["doc_id"]).stem, store, live)
        if reading is None:
            gaps.append(Gap(stage=STAGE, doc_id=r["doc_id"], subject="storey heights",
                            reason=f"the section's level markers are drawn as graphics and were not "
                                   f"read ({how}); walls and wall finishes are not measured",
                            detail="answer the request (readers.requests) or run with the model"))
            break
        heights, problems = heights_from_reading(reading, r["doc_id"])
        for p in problems:
            gaps.append(Gap(stage=STAGE, doc_id=r["doc_id"], subject="storey heights", reason=p))
        if heights:
            return heights, f"{r.get('drawing_no') or Path(r['doc_id']).name} ({how})", gaps
    return {}, "", gaps


# ── the plans ───────────────────────────────────────────────────────────────
def measurable_plans(ctx) -> tuple[list[dict], list[Gap]]:
    """The general-arrangement plans to measure: calibrated, of a discipline
    that feeds the measured sections, one per storey. Returns (plans, gaps)."""
    from ingest.discipline_matrix import DisciplineMatrix
    from measure.inventory import plan_floors

    gaps: list[Gap] = []
    matrix = DisciplineMatrix.load()
    grids = ctx.get("grids") or {}
    sheets = {s.doc_id: s for s in ctx.get("sheets") or []}
    candidates, not_calibrated = [], []
    for row in sorted(ctx.get("routing") or [], key=lambda r: r["doc_id"]):
        if row.get("kind") != "plan":
            continue
        doc_id = row["doc_id"]
        sheet = sheets.get(doc_id)
        title = (sheet.title if sheet else None) or ""
        resolved, _basis = matrix.resolve_for(row.get("drawing_no"), doc_id)
        feeds = set(getattr(resolved, "sections", ()) or ())
        if resolved is not None and not feeds & {"D", "J"}:
            continue                                  # a services or structural plan
        if NOT_GA.search(title):
            continue
        floors = plan_floors(title, sheet.subtitle if sheet else None)
        if not floors:
            gaps.append(Gap(stage=STAGE, doc_id=doc_id, subject=row.get("drawing_no") or doc_id,
                            reason=f"the storey this plan draws is not stated in its title "
                                   f"('{title}'), so it is not measured"))
            continue
        g = grids.get(doc_id)
        if g is None or g.status != "CALIBRATED" or not g.mm_per_pt:
            not_calibrated.append(row.get("drawing_no") or Path(doc_id).name)
            continue
        candidates.append({"doc_id": doc_id, "drawing_no": row.get("drawing_no"), "title": title,
                           "floors": floors, "mm_per_pt": float(g.mm_per_pt),
                           "scale_basis": g.scale_basis})
    if not_calibrated:
        gaps.append(Gap(stage=STAGE, doc_id=None, subject="plans not measured",
                        reason=f"{len(not_calibrated)} plan(s) have no verified scale, so nothing is "
                               f"measured from them: {', '.join(sorted(not_calibrated)[:12])}"
                               + (" ..." if len(not_calibrated) > 12 else ""),
                        detail="S4 calibrates a plan from its own grid chain or the set's grid; "
                               "see grids.json for why each was not"))
    return candidates, gaps


SLIT_MM = 100            # a boundary line thinner than this inside a room (a door leaf) is not a wall
MIN_VOID_M2 = 1.0        # GP3.2: voids under 1.00 m2 are not deducted from an area
THIN_MM = 55             # a line no thicker than this is drawn furniture of the room (a door's leaf and
                         # swing), not a wall - walls are 75 mm and more
POCKET_M2 = 2.0          # an unlabelled pocket up to this size cut off by thin lines only is the room's


def measure_rooms_net(E, sheet, cal, pieces):
    """Rooms as POMI measures them - the floor within its walls - on the
    platform's flood fill and its refusals (leaks to the sheet edge, a wet and
    a dry room as one space, a region too big for its name), with three
    corrections to the figures: the pockets a door's leaf and swing cut off
    (unlabelled, under POCKET_M2, separated from the room only by lines no
    thicker than THIN_MM - never by a wall) are the room's; a room is closed
    over hairline slits thinner than SLIT_MM; islands under 1.00 m2 stay in
    its area (GP3.2) and larger voids are deducted. The
    perimeter is the room's outline, not a count of pixel edges (which counts a
    diagonal wall as a staircase). Returns (rooms, problems) like the platform."""
    import cv2
    import numpy as np
    from scipy import ndimage

    R = E.rooms
    px = R.PX_PER_PT
    H, W = int(sheet.height * px) + 1, int(sheet.width * px) + 1
    # the platform's boundaries, unchanged: on real sets the door lines are
    # what close most doorways (a sliding door's panels, a leaf in its frame)
    free = ~R._barrier(sheet, (H, W), R.door_closers(pieces, cal.mm_per_pt))
    lab, nlab = ndimage.label(free)
    del free
    border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]])).tolist())
    mm_px = cal.mm_per_pt / px
    sizes = R._counts(lab, nlab + 1)
    min_px = R.MIN_ROOM_M2 * 1e6 / mm_px ** 2
    step_px = max(2, int(150 / mm_px))
    by_region: dict[int, list] = {}
    problems: list = []
    for name, x, y in R._labels(sheet):
        cy, cx = min(H - 1, int(y * px)), min(W - 1, int(x * px))
        r = int(lab[cy, cx])
        if r == 0 or sizes[r] < min_px:
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
                problems.append((f"{name} label at ({x:.0f},{y:.0f}) sits on a line or in a fixture with "
                                 f"no room found around it - not measured", [(name, x, y)]))
                continue
            r = max(found, key=lambda v: (found[v], sizes[v]))
        by_region.setdefault(r, []).append((name, x, y))

    boxes = ndimage.find_objects(lab)
    slit_px = max(1, int(math.ceil(SLIT_MM / mm_px / 2)))
    thin_px = max(2, int(math.ceil(THIN_MM / mm_px)))
    thin_disk = np.hypot(*np.mgrid[-thin_px:thin_px + 1, -thin_px:thin_px + 1]) <= thin_px
    # every wall's centreline: the strip between a wall's two drawn faces is
    # free space to the fill, and a pocket holding a centreline is a WALL,
    # never part of the room beside it
    centre = np.zeros((H, W), dtype=bool)
    for p in pieces:
        (ax, ay), (bx, by) = p.a, p.b
        n = int(max(abs(bx - ax), abs(by - ay)) * px) + 2
        cxs = np.clip(np.rint(np.linspace(ax * px, bx * px, n)).astype(int), 0, W - 1)
        cys = np.clip(np.rint(np.linspace(ay * px, by * px, n)).astype(int), 0, H - 1)
        centre[cys, cxs] = True
    disk = np.hypot(*np.mgrid[-slit_px:slit_px + 1, -slit_px:slit_px + 1]) <= slit_px
    rooms = []
    for rid in sorted(by_region):
        members = by_region[rid]
        names = sorted({n for n, _x, _y in members})
        name = " / ".join(names)
        cats = {R.ROOM_TYPES[n][0] for n in names}
        area_raw = float(sizes[rid]) * mm_px ** 2 / 1e6
        limit = max(R.ROOM_TYPES[n][1] for n in names) * max(1, len(members))
        if area_raw < R.MIN_ROOM_M2:
            problems.append((f"{name}: label sits inside a {area_raw:.2f} m2 outline (a fixture, not the "
                             f"room) - not measured from this label", members))
            continue
        if rid in border:
            problems.append((f"{name}: fill escapes to the sheet edge (an opening is not closed on plan) "
                             f"- not measured", members))
            continue
        if "wet" in cats and len(cats) > 1:
            problems.append((f"{name}: a wet and a dry room fill as one space (open doorway) - not "
                             f"measured", members))
            continue
        if area_raw > limit:
            problems.append((f"{name}: {area_raw:.1f} m2 is more than a room of this kind can be "
                             f"({limit} m2) - the fill leaked; not measured", members))
            continue
        ys, xs = boxes[rid - 1]
        pad = slit_px + thin_px + 2
        y0, y1 = max(0, ys.start - pad), min(H, ys.stop + pad)
        x0, x1 = max(0, xs.start - pad), min(W, xs.stop + pad)
        crop = lab[y0:y1, x0:x1]
        walls_here = centre[y0:y1, x0:x1]
        own = crop == rid
        near = ndimage.binary_dilation(own, structure=thin_disk, iterations=1)
        for v in np.unique(crop[near & ~own]).tolist():
            pocket = sizes[v] * mm_px ** 2 / 1e6 <= POCKET_M2
            if v and v != rid and v not in by_region and v not in border and pocket:
                region = crop == v
                if not (region & walls_here).any():
                    own |= region
        # the fill stops at the edge of the boundary line as rasterised (three
        # pixels wide), not at the wall face the line is drawn on: grow the room
        # two pixels into the line, so its edge pixels sit ON the face line and
        # the outline traced through them runs along the wall faces
        mask = ndimage.binary_dilation(own, iterations=2) & ((crop == 0) | own)
        ys, xs = slice(y0, y1), slice(x0, x1)
        pad = 0
        closed = ndimage.binary_closing(mask, structure=disk)
        filled = ndimage.binary_fill_holes(closed)
        holes, nh = ndimage.label(filled & ~closed)
        big = np.zeros_like(filled)
        if nh:
            hsz = np.bincount(holes.ravel())
            keep = [h for h in range(1, nh + 1) if hsz[h] * mm_px ** 2 / 1e6 >= MIN_VOID_M2]
            if keep:
                big = np.isin(holes, keep)
        net = filled & ~big
        found, _ = cv2.findContours(filled.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        rings, per_px = [], 0.0
        for c in found:
            c = cv2.approxPolyDP(c, 1.0, True)[:, 0, :]
            if len(c) < 3:
                continue
            ring = [(round((xs.start - pad + qx + 0.5) / px, 2), round((ys.start - pad + qy + 0.5) / px, 2))
                    for qx, qy in c.tolist()]
            rings.append(ring)
            per_px += sum(math.dist(a, b) for a, b in zip(c.tolist(), c.tolist()[1:] + c.tolist()[:1]))
        void_rings = []
        if big.any():
            vf, _ = cv2.findContours(big.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            for c in vf:
                c = cv2.approxPolyDP(c, 1.0, True)[:, 0, :]
                if len(c) >= 3:
                    void_rings.append([(round((xs.start + qx + 0.5) / px, 2), round((ys.start + qy + 0.5) / px, 2))
                                       for qx, qy in c.tolist()])
        # the area is the outline's: the shape the markup draws, less the voids
        # of 1.00 m2 and more inside it (GP3.2)
        def _poly_area(rr):
            return sum(abs(sum(ax * by - bx * ay for (ax, ay), (bx, by) in zip(r, r[1:] + r[:1]))) / 2
                       for r in rr)
        area = (_poly_area(rings) - _poly_area(void_rings)) * (cal.mm_per_pt / 1000) ** 2
        n0, x0, y0 = members[0]
        rooms.append(SimpleNamespace(
            name=name, category=R.ROOM_TYPES[names[0]][0] if len(cats) == 1 else "dry",
            area_m2=area, perimeter_m=per_px * mm_px / 1000, seed=(x0, y0), region=rid, poly=rings,
            void_poly=void_rings,
            voids_m2=float(big.sum()) * mm_px ** 2 / 1e6))
    rooms.sort(key=lambda r: (r.name, r.seed[1], r.seed[0]))
    for n, r in enumerate(rooms):
        r.id = f"r{n}"
    return rooms, [(t, pts) for t, pts in problems]


def measure_sheet(E, path: Path, mm_per_pt: float) -> dict:
    """Walls and rooms of one calibrated plan, in FRAME (displayed points).
    A sheet whose layers carry no wall is returned with no walls, and says so."""
    sheet = E.Sheet(Path(path))
    try:
        cal = E.Calibration(mm_per_pt, "CALIBRATED", "agent S4", E.Grid())
        pieces = E.walls.measure_walls(sheet, cal)
        rooms, problems = measure_rooms_net(E, sheet, cal, pieces) if pieces else ([], [])
        return {
            "walls": [{"id": w.id, "length_m": round(w.length_m, 4), "thk_mm": w.thk_mm,
                       "raw_thk_mm": round(w.raw_thk_mm, 1), "a": [round(v, 2) for v in w.a],
                       "b": [round(v, 2) for v in w.b]} for w in pieces],
            "rooms": [{"id": r.id, "name": r.name, "class": r.category,
                       "area_m2": round(r.area_m2, 4), "perimeter_m": round(r.perimeter_m, 4),
                       "poly": [[[round(x, 2), round(y, 2)] for x, y in ring] for ring in r.poly],
                       "voids": [[[round(x, 2), round(y, 2)] for x, y in ring]
                                 for ring in getattr(r, "void_poly", [])]}
                      for r in rooms],
            "problems": [str(t) for t, _pts in problems],
            "wall_layer": bool(pieces),
        }
    finally:
        sheet.close()


def measure(ctx, store, live) -> dict:
    """S8. Returns the artefact; ctx["measured"] carries it to S9."""
    from spine.files import project_files

    gaps: list[Gap] = []
    dec, dec_problem = decisions(ctx["project"])
    if dec_problem:
        gaps.append(Gap(stage=STAGE, doc_id=None, subject=DECISIONS_FILE, reason=dec_problem))
    out = {"decisions": dec, "plans": [], "storeys": {}, "slab_mm": None, "blocks_mm": [],
           "basis": {}, "engine": None}
    try:
        E = engine()
        out["engine"] = "boq_arch walls/rooms"
    except EngineMissing as exc:
        gaps.append(Gap(stage=STAGE, doc_id=None, subject="measuring engine",
                        reason=f"plans are not measured: {exc}",
                        detail="sections D, G and J are then not measured by this run"))
        return {"artefact": out, "gaps": gaps}

    plans, more = measurable_plans(ctx)
    gaps += more
    on_disk = project_files(ctx["project"])
    by_floor: dict[str, list] = {}
    for p in plans:
        try:
            p.update(measure_sheet(E, on_disk[p["doc_id"]], p["mm_per_pt"]))
        except Exception as exc:                                   # noqa: BLE001
            gaps.append(Gap(stage=STAGE, doc_id=p["doc_id"], subject=p["drawing_no"] or p["doc_id"],
                            reason=f"plan could not be measured: {type(exc).__name__}: {exc}"))
            continue
        if not p["wall_layer"]:
            gaps.append(Gap(stage=STAGE, doc_id=p["doc_id"], subject=p["drawing_no"] or p["doc_id"],
                            reason="this PDF carries no wall layer (its CAD layers were not kept when "
                                   "it was plotted), so no wall or room is measured from it",
                            detail="ask for the plans as PDFs exported with layers, or as DWG/DXF"))
        for problem in p["problems"]:
            gaps.append(Gap(stage=STAGE, doc_id=p["doc_id"], subject=p["drawing_no"] or p["doc_id"],
                            reason=f"room not measured: {problem}"))
        for f in p["floors"]:
            by_floor.setdefault(f, []).append(p)
    # one plan per storey: the one with the most measured room area; the
    # others are named, not measured again
    chosen = []
    for floor, ps in sorted(by_floor.items()):
        ps = sorted(ps, key=lambda p: (-sum(r["area_m2"] for r in p.get("rooms", [])), p["doc_id"]))
        chosen.append((floor, ps[0]))
        for other in ps[1:]:
            gaps.append(Gap(stage=STAGE, doc_id=other["doc_id"], subject=f"storey {floor}",
                            reason=f"storey {floor} is also drawn on {other['drawing_no'] or other['doc_id']}; "
                                   f"it is measured once, from {ps[0]['drawing_no'] or ps[0]['doc_id']}"))
    serves: dict[str, list] = {}
    for floor, p in chosen:
        serves.setdefault(p["doc_id"], []).append(floor)
    for p in plans:
        p["measured_floors"] = serves.get(p["doc_id"], [])
    out["plans"] = [p for p in plans if p.get("measured_floors")]

    heights, source, more = storey_heights(ctx, store, live)
    gaps += more
    out["storeys"] = {k: {"height_m": str(h), "basis": b} for k, (h, b) in sorted(heights.items())}
    out["basis"]["storeys"] = source

    texts = stated_texts(ctx, store)
    slab, slab_basis, problems = slab_thickness(texts, dec)
    out["slab_mm"], out["basis"]["slab"] = slab, slab_basis
    for p in problems:
        gaps.append(Gap(stage=STAGE, doc_id=None, subject="slab thickness",
                        reason=p + "; walls and wall finishes need the clear height (storey height "
                                   "less slab), so they are not measured",
                        detail=f"state it in {DECISIONS_FILE}, e.g. {{\"slab_thickness_mm\": 200}}"))
    blocks, block_basis = block_thicknesses(texts, dec)
    out["blocks_mm"], out["basis"]["blocks"] = blocks, block_basis
    if not blocks:
        gaps.append(Gap(stage=STAGE, doc_id=None, subject="block walls",
                        reason="no note states which wall thicknesses are blockwork, so no wall is "
                               "billed as masonry (a wall line's thickness does not say what it is "
                               "built of)",
                        detail=f"state them in {DECISIONS_FILE}, e.g. "
                               f"{{\"block_thicknesses_mm\": [100, 150, 200]}}"))
    return {"artefact": out, "gaps": gaps}


def main() -> int:
    ap = argparse.ArgumentParser(description="Measure one calibrated plan's walls and rooms.")
    ap.add_argument("pdf")
    ap.add_argument("--mm-per-pt", type=float, required=True)
    a = ap.parse_args()
    try:
        E = engine()
    except EngineMissing as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 2
    m = measure_sheet(E, Path(a.pdf), a.mm_per_pt)
    print(f"{len(m['walls'])} wall pieces ({sum(w['length_m'] for w in m['walls']):.2f} m), "
          f"{len(m['rooms'])} rooms ({sum(r['area_m2'] for r in m['rooms']):.2f} m2), "
          f"{len(m['problems'])} problem(s)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
