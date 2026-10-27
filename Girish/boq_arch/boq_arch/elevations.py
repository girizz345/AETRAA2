"""External finishes measured on the elevations (MEASURED; names READ (VISUAL)).

Scale. An elevation is calibrated from its own storey dimension chain: each floor-to-floor dimension printed
in the text layer (3700, 5150 ...) against the distance between the chain's tick marks. Every span must give
the same mm-per-point within 1%. Where the set's grid table exists (the plans' grid bays), the grid bubbles on
the elevation must agree with it within 1% too, or nothing on the sheet is measured.

Finishes. The elevations show finishes as colour: a solid fill on one sheet, a transparent image or a dense
coloured hatch on another. The sheet is rendered and every clearly coloured pixel of the drawing area is taken;
pixels of one hue are one finish class. Line work drawn over a fill (mullions, hatch lines) is closed over,
and specks, thin lines and anything under 0.3 m2 are dropped. What is left of each class is its area on the
elevation - a projected area, true for faces parallel to the elevation.

Names. Which finish each colour is exists only in the callout notes, drawn as graphics. The sheet is rendered
with each class labelled (F1, F2 ...) and read visually: for each label, the callout its leaders point into.
Wall finishes are billed by area under external finishes (J3.1, walls; J1.3 external work so described);
glazing is left out - doors and windows are billed from the schedules. A class nobody has named is a gap,
never billed; a person can name it in the Measure workspace (corrections.py).
"""
from __future__ import annotations

import hashlib
import math
import re
import statistics
from dataclasses import dataclass, field, replace

import numpy as np

from .calibrate import PT_MM, Calibration, Grid, _grid_lines
from .records import Gap

PX_PER_PT = 2.0            # render resolution for the finish areas
MIN_BLOB_M2 = 0.3          # smaller coloured patches are symbols, not finishes
SAT_MIN, VAL_MIN, VAL_MAX = 40, 40, 250   # "clearly coloured" in 0-255 HSV
HUE_BIN = 6                # OpenCV hue runs 0-179; 30 bins
KINDS = ("wall finish", "glazing", "other", "unknown")


@dataclass
class Blob:
    id: str                         # z<class>-<n>
    cls: str                        # c<n>
    area_m2: float
    poly: list                      # outline rings, sheet points
    point: tuple[float, float]      # a point well inside it (for the label)


@dataclass
class FinishClass:
    id: str                         # c<n>, in hue order
    label: str                      # F<n>, as drawn for the reading
    colour: str                     # #RRGGBB, the class's mean colour on the drawing
    blobs: list[Blob] = field(default_factory=list)
    finish: str = ""                # the callout wording
    kind: str = "unknown"           # wall finish / glazing / other / unknown
    source: str = ""                # READ (VISUAL) / named by hand
    hand: str = ""                  # the correction, in words, when a person named it

    @property
    def area_m2(self) -> float:
        return sum(b.area_m2 for b in self.blobs)


@dataclass
class Elevation:
    info: object                    # SheetInfo
    cal: Calibration
    classes: list[FinishClass] = field(default_factory=list)
    how: str = ""                   # where the names came from

    @property
    def dn(self) -> str:
        return self.info.drawing_no

    def snapshot(self) -> "Elevation":
        return replace(self, classes=[replace(c, blobs=list(c.blobs)) for c in self.classes])


# ---------------------------------------------------------------- scale

def chain_ratios(sheet) -> list[tuple[int, float]]:
    """(stated mm, mm per point) for every storey dimension printed on a chain with tick marks."""
    from .readability import body_rect
    body = body_rect(sheet)
    ticks_by_layer: dict[str, list] = {}
    out = []
    for w in sheet.words:
        if not re.fullmatch(r"\d{3,5}", w.text) or "TITLE" in w.layer.upper() or not body.contains((w.cx, w.cy)):
            continue
        if w.layer not in ticks_by_layer:
            ticks_by_layer[w.layer] = [g for g in sheet.segments if g.layer == w.layer
                                       and abs(g.y0 - g.y1) < 0.3 and abs(g.x1 - g.x0) < 20]
        ticks = sorted({round((g.y0 + g.y1) / 2, 2) for g in ticks_by_layer[w.layer]
                        if min(g.x0, g.x1) - 15 < w.cx < max(g.x0, g.x1) + 15})
        up = [t for t in ticks if t < w.cy]
        dn = [t for t in ticks if t > w.cy]
        if up and dn and dn[0] - up[-1] > 20:           # a short span is too coarse to set a scale
            out.append((int(w.text), int(w.text) / (dn[0] - up[-1])))
    return out


def grid_labels(sheet) -> dict[str, float]:
    """Grid bubble label -> x of its vertical grid line (an elevation runs one axis across the sheet)."""
    xs, _ = _grid_lines(sheet)
    cands = []
    for w in sheet.words:
        t = w.text.strip()
        if xs and (re.fullmatch(r"\d{1,2}", t) or re.fullmatch(r"[A-HJ-NP-Z]", t)):
            x = min(xs, key=lambda v: abs(v - w.cx))
            if abs(x - w.cx) < 3:
                cands.append((t, x, w.cy))
    if not cands:
        return {}
    row = statistics.median(c[2] for c in cands)       # the bubbles sit in one row
    out: dict[str, float] = {}
    for t, x, y in cands:
        if abs(y - row) < 8:
            out.setdefault(t, x)
    return out


def _agree(values: list[float]) -> float | None:
    if len(values) < 3:
        return None
    med = statistics.median(values)
    ok = [v for v in values if abs(v - med) / med < 0.01]
    return statistics.median(ok) if len(ok) >= 3 else None


def calibrate_elevation(sheet, table: dict[tuple[str, str], float]) -> Calibration:
    chain = chain_ratios(sheet)
    k_chain = _agree([r for _, r in chain])
    labels = grid_labels(sheet)
    order = sorted(labels.items(), key=lambda kv: kv[1])
    bays = []
    for (la, a), (lb, b) in zip(order, order[1:]):
        mm = table.get((la, lb)) or table.get((lb, la))
        if mm and b - a > 5:
            bays.append(mm / (b - a))
    k_grid = _agree(bays)
    g = Grid(xs=labels)
    n_chain = sum(1 for _, r in chain if k_chain and abs(r - k_chain) / k_chain < 0.01)
    if k_chain and k_grid:
        if abs(k_chain - k_grid) / k_chain > 0.01:
            return Calibration(None, "NONE", f"storey dimension chain gives 1:{k_chain / PT_MM:.1f} but the grid gives "
                                             f"1:{k_grid / PT_MM:.1f} - they differ by more than 1%", g)
        return Calibration(k_chain, "CALIBRATED",
                           f"{n_chain} storey dimensions on this sheet agree within 1%, and {len(bays)} grid bays "
                           f"matched to the plans agree; effective scale 1:{k_chain / PT_MM:.1f}", g)
    if k_chain:
        return Calibration(k_chain, "CALIBRATED", f"{n_chain} storey dimensions on this sheet agree within 1%; "
                                                  f"effective scale 1:{k_chain / PT_MM:.1f}", g)
    if k_grid:
        return Calibration(k_grid, "FROM-GRID-TABLE", f"{len(bays)} grid bays matched by label to the plans' grid "
                                                      f"dimensions agree within 1%; effective scale 1:{k_grid / PT_MM:.1f}", g)
    return Calibration(None, "NONE", "no storey dimension chain or matchable grid on this sheet", g)


# ---------------------------------------------------------------- finish areas

def _hue_runs(hist: np.ndarray, min_px: float) -> list[list[int]]:
    """Runs of neighbouring hue bins that each carry colour (hue wraps round: red is at both ends)."""
    on = [i for i, c in enumerate(hist) if c >= min_px * 0.2]
    runs: list[list[int]] = []
    for i in on:
        if runs and i - runs[-1][-1] == 1:
            runs[-1].append(i)
        else:
            runs.append([i])
    if len(runs) > 1 and runs[0][0] == 0 and runs[-1][-1] == len(hist) - 1:
        runs[0] = runs.pop() + runs[0]
    return [r for r in runs if sum(hist[i] for i in r) >= min_px]


def finish_classes(sheet, mm_per_pt: float) -> list[FinishClass]:
    """The coloured areas of the elevation, one class per hue, each as blobs with outlines."""
    import cv2
    from .readability import body_rect
    from .rooms import outlines
    k = PX_PER_PT
    pix = sheet.page.get_pixmap(dpi=int(round(72 * k)), alpha=False)
    img = np.frombuffer(pix.samples, np.uint8).reshape(pix.height, pix.width, pix.n)[..., :3]
    body = body_rect(sheet)
    area = np.zeros(img.shape[:2], bool)
    area[int(body.y0 * k):int(body.y1 * k), int(body.x0 * k):int(body.x1 * k)] = True
    hsv = cv2.cvtColor(np.ascontiguousarray(img), cv2.COLOR_RGB2HSV)
    h, s, v = hsv[..., 0], hsv[..., 1], hsv[..., 2]
    coloured = area & (s > SAT_MIN) & (v > VAL_MIN) & (v < VAL_MAX)
    m2_px = (mm_per_pt / k / 1000) ** 2
    min_px = MIN_BLOB_M2 / m2_px
    bins = (h // HUE_BIN).astype(np.int32)
    hist = np.bincount(bins[coloured], minlength=180 // HUE_BIN)
    out: list[FinishClass] = []
    kernel = np.ones((5, 5), np.uint8)
    for run in sorted(_hue_runs(hist, min_px), key=lambda r: r[len(r) // 2]):
        raw = coloured & np.isin(bins, run)
        m = cv2.morphologyEx(raw.astype(np.uint8), cv2.MORPH_CLOSE, kernel)
        m = cv2.morphologyEx(m, cv2.MORPH_OPEN, kernel)
        n, lab, stats, _ = cv2.connectedComponentsWithStats(m, connectivity=4)
        keep = [i for i in range(1, n) if stats[i, cv2.CC_STAT_AREA] >= min_px]
        if not keep:
            continue
        cid = f"c{len(out) + 1}"
        rgb = img[raw].mean(axis=0)
        fc = FinishClass(cid, f"F{len(out) + 1}", "#%02X%02X%02X" % tuple(int(c) for c in rgb))
        rings = outlines(lab, keep, k)
        dist_cache = {}
        blobs = []
        for i in keep:
            x, y, w, hh = (int(stats[i, c]) for c in (cv2.CC_STAT_LEFT, cv2.CC_STAT_TOP, cv2.CC_STAT_WIDTH,
                                                       cv2.CC_STAT_HEIGHT))
            sub = (lab[y:y + hh, x:x + w] == i).astype(np.uint8)
            d = cv2.distanceTransform(np.pad(sub, 1), cv2.DIST_L2, 3)[1:-1, 1:-1]
            py, px = np.unravel_index(int(np.argmax(d)), d.shape)
            dist_cache[i] = ((x + px + 0.5) / k, (y + py + 0.5) / k)
            blobs.append((i, float(stats[i, cv2.CC_STAT_AREA]) * m2_px))
        # blobs in reading order: top to bottom, left to right
        blobs.sort(key=lambda t: (round(dist_cache[t[0]][1] / 20), dist_cache[t[0]][0]))
        for j, (i, a) in enumerate(blobs, 1):
            fc.blobs.append(Blob(f"z{cid[1:]}-{j}", cid, a, rings.get(i, []), tuple(round(c, 2) for c in dist_cache[i])))
        out.append(fc)
    return out


# ---------------------------------------------------------------- the reading

def signature(classes: list[FinishClass]) -> str:
    """Changes when the classes the reading is about change (another colour, another class)."""
    key = ";".join(f"{c.label}:{c.colour[:5]}" for c in classes)
    return hashlib.sha1(key.encode()).hexdigest()[:8]


class Marked:
    """A sheet rendered with each finish class labelled, for the visual reading. Same fingerprint as the sheet."""

    def __init__(self, sheet, classes: list[FinishClass]):
        import pymupdf
        self.sheet, self.sha1 = sheet, sheet.sha1
        self.width, self.height = sheet.width, sheet.height
        self.doc = pymupdf.open()
        self.doc.insert_pdf(sheet.doc, from_page=0, to_page=0)
        page = self.doc[0]
        inv = ~page.rotation_matrix
        P = lambda x, y: pymupdf.Point(x, y) * inv
        sh = page.new_shape()
        for c in classes:
            rgb = tuple(int(c.colour[i:i + 2], 16) / 255 for i in (1, 3, 5))
            for b in sorted(c.blobs, key=lambda b: -b.area_m2)[:4]:
                x, y = b.point
                sh.draw_rect(pymupdf.Rect(P(x - 11, y - 6), P(x + 11, y + 6)).normalize())
                sh.finish(color=rgb, fill=(1, 1, 1), width=1.6)
        for c in classes:
            for b in sorted(c.blobs, key=lambda b: -b.area_m2)[:4]:
                x, y = b.point
                sh.insert_text(P(x - 8, y + 3.2), c.label, fontsize=9, color=(0, 0, 0), rotate=page.rotation)
        sh.commit()
        self.page = page

    def render_png(self, dpi: int, clip=None) -> bytes:
        kw = {"dpi": dpi}
        if clip is not None:
            kw["clip"] = clip
        return self.page.get_pixmap(**kw).tobytes("png")


def reading_task(sheet, classes: list[FinishClass]):
    """The finishes reading for this sheet: tiles round the coloured areas and their callouts."""
    from .readability import body_rect
    from .tasks import ELEVATION_FINISHES
    body = body_rect(sheet)
    pts = [p for c in classes for b in c.blobs for ring in b.poly for p in ring]
    xs, ys = [p[0] for p in pts], [p[1] for p in pts]
    x0, x1 = max(body.x0, min(xs) - 280), min(body.x1, max(xs) + 280)     # callouts sit beside the building
    y0, y1 = max(body.y0, min(ys) - 60), min(body.y1, max(ys) + 60)
    cols, rows = max(1, math.ceil((x1 - x0) / 450)), max(1, math.ceil((y1 - y0) / 450))
    W, H = sheet.width, sheet.height
    return replace(ELEVATION_FINISHES, version=f"{ELEVATION_FINISHES.version}-{signature(classes)}",
                   clips=[(x0 / W, y0 / H, x1 / W, y1 / H)], grid=(cols, rows))


def apply_reading(classes: list[FinishClass], reading: dict | None):
    for r in (reading or {}).get("finishes", []):
        c = next((c for c in classes if c.label == r.get("label")), None)
        if c is None:
            continue
        c.finish = re.sub(r"\s+", " ", r.get("finish") or "").strip()
        c.kind = r.get("kind") if r.get("kind") in KINDS else "unknown"
        if not c.finish and c.kind == "wall finish":
            c.kind = "unknown"
        c.source = "READ (VISUAL)"


def measure_elevation(job) -> dict:
    """A worker (see parallel.py): the coloured finishes of one elevation. job: (sheet info, the plans' grid table,
    readings folder, providers)."""
    from .sheet import Sheet
    from .vision import Reader
    i, table, folder, providers = job
    gaps: list[Gap] = []
    logs: list[str] = []
    sh = Sheet(i.path)
    cal = calibrate_elevation(sh, table)
    e = Elevation(i, cal)
    if not cal.mm_per_pt:
        gaps.append(Gap(i.drawing_no, "scale", cal.basis + " - no external finish on this sheet is measured", "J"))
        sh.close()
        return {"elevation": e, "gaps": gaps, "logs": logs}
    e.classes = finish_classes(sh, cal.mm_per_pt)
    if e.classes:
        marked = Marked(sh, e.classes)
        reading, how = Reader(folder, providers, logs.append).read(marked, i.drawing_no, reading_task(sh, e.classes))
        marked.doc.close()
        e.how = how
        apply_reading(e.classes, reading)
        if reading is None:
            gaps.append(Gap(i.drawing_no, "external finish names",
                            f"the finish callouts are drawn as graphics and were not read ({how}); request left in "
                            f"readings/{i.drawing_no}.elevation_finishes.request/ - the coloured areas are measured "
                            f"but not billed until named (or name them in Measure)", "J"))
        else:
            for il in reading.get("illegible", []):
                gaps.append(Gap(i.drawing_no, il.get("field", ""), f"{il.get('where', '')}: {il.get('reason', '')}", "J"))
    logs.append(f"   {i.drawing_no} {i.title}: " + (", ".join(f"{c.label} {c.area_m2:.1f} m2 {c.kind}" for c in e.classes)
                                                     or "no coloured finish areas") + f" ({cal.basis.split(';')[-1].strip()})")
    sh.close()
    return {"elevation": e, "gaps": gaps, "logs": logs}


def measure_elevations(infos, reader, table, gaps: list[Gap], log=print) -> list[Elevation]:
    from .parallel import pmap
    todo = [i for i in infos if i.kind == "elevation"]
    out = []
    for i, res in zip(todo, pmap(measure_elevation, [(i, table, reader.folder, reader.order) for i in todo])):
        e = res["elevation"]
        e.info = i                          # the register's own record, not the worker's copy
        gaps += res["gaps"]
        for line in res["logs"]:
            log(line)
        out.append(e)
    return out


# ---------------------------------------------------------------- the bill

FORMULA_B = "complete in accordance with the Specifications and Drawings"


def short_name(finish: str) -> str:
    """'BRICK CLADDING AS PER SPECIALIST'S DETAILS & SPECS' -> 'brick cladding'."""
    s = re.split(r"\s+(?:AS PER|AS SHOWN|TO BE|WITH|INCLUDING)\b|[,;(]", finish, maxsplit=1, flags=re.I)[0]
    return re.sub(r"\s+", " ", s).strip().lower()


def section_external(elevations: list[Elevation], gaps: list[Gap]) -> list:
    """External wall finishes by area, one item per finish, one line per elevation."""
    from .measure import lower_first, r2, sentence
    from .records import CORRECTED, MEASURED, Item, Line
    items: dict[str, Item] = {}
    for e in elevations:
        for c in e.classes:
            if c.kind == "wall finish" and c.finish:
                name = short_name(c.finish)
                if name not in items:
                    items[name] = Item("J", "Finishing", f"{sentence(c.finish)} {FORMULA_B}", "",
                                       f"To external walls, {name}", "m2", "J3.1.2",
                                       heads=("External Finishes", "Finishing"), uhead="Walls")
                by = " - named by hand" if c.hand else ""
                items[name].lines.append(Line(
                    e.dn, "", f"{c.label} {lower_first(sentence(c.finish))}: {len(c.blobs)} area(s) coloured on this "
                              f"elevation, projected area{by}",
                    1, qty_each=r2(c.area_m2), origin=CORRECTED if c.hand else MEASURED, location=e.cal.basis,
                    shapes=tuple(f"{e.dn}/{b.id}" for b in c.blobs)))
            elif c.kind == "unknown" and c.source:
                # read, but no callout points into it (a sheet not read at all has one gap for the sheet)
                gaps.append(Gap(e.dn, f"finish {c.label}", f"{c.area_m2:.1f} m2 coloured {c.colour}: no callout names it "
                                                           f"- not billed", "J"))
    return [items[k] for k in sorted(items)]
