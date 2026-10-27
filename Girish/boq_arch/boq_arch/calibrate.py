"""Stage 2 - per-sheet scale calibration from the structural grid.

The title-block scale is NOT trusted: these PDFs were plotted scale-to-fit, so
1:150 on the title block measured 0.953x the stated grid dimensions on one sheet
and 0.983x on another. Each plan is calibrated against dimension strings it
states itself (grid dimension text in the text layer), or - when a sheet states
none - against the grid dimensions another calibrated sheet of the same set
states, matched grid label to grid label.
"""
from __future__ import annotations

import re
import statistics
from collections import defaultdict
from dataclasses import dataclass, field

from .records import Gap
from .sheet import Sheet

PT_MM = 25.4 / 72.0


@dataclass
class Grid:
    xs: dict[str, float] = field(default_factory=dict)   # label -> x (pt), vertical grid lines
    ys: dict[str, float] = field(default_factory=dict)   # label -> y (pt), horizontal grid lines


@dataclass
class Calibration:
    mm_per_pt: float | None
    status: str            # CALIBRATED / FROM-GRID-TABLE / NONE
    basis: str
    grid: Grid

    def m(self, pts: float) -> float:
        return pts * (self.mm_per_pt or 0) / 1000.0


def nominal_mm_per_pt(scale: str) -> float | None:
    """A ratio scale, '1:100' or the British and Indian '1 in 100'."""
    m = re.fullmatch(r"1\s*(?::|IN)\s*(\d+)", scale.strip(), re.I)
    return int(m.group(1)) * PT_MM if m else None


def _grid_lines(sheet: Sheet) -> tuple[list[float], list[float]]:
    vx: dict[float, float] = defaultdict(float)
    hy: dict[float, float] = defaultdict(float)
    for s in sheet.segments:
        lay = s.layer.upper()
        if "GRID" not in lay and "AXIS" not in lay:
            continue
        if "DIMENSION" in lay:
            continue
        if abs(s.x0 - s.x1) < 0.3:
            vx[round(s.x0, 1)] += abs(s.y1 - s.y0)
        elif abs(s.y0 - s.y1) < 0.3:
            hy[round(s.y0, 1)] += abs(s.x1 - s.x0)
    xs = sorted(x for x, l in vx.items() if l > 150)
    ys = sorted(y for y, l in hy.items() if l > 150)
    return xs, ys


def _grid(sheet: Sheet) -> Grid:
    """Label each grid line with the bubble text sitting on its axis beyond the building."""
    xs, ys = _grid_lines(sheet)
    g = Grid()
    for w in sheet.words:
        t = w.text.strip()
        if re.fullmatch(r"\d{1,2}", t) and xs:
            x = min(xs, key=lambda v: abs(v - w.cx))
            if abs(x - w.cx) < 3 and w.cy < sheet.height * 0.25:
                g.xs.setdefault(t, x)
        elif re.fullmatch(r"[A-HJ-NP-Z]", t) and ys:
            y = min(ys, key=lambda v: abs(v - w.cy))
            if abs(y - w.cy) < 3 and w.cx < sheet.width * 0.15:
                g.ys.setdefault(t, y)
    return g


def _stated_pairs(sheet: Sheet, g: Grid, nominal: float) -> list[tuple[str, str, float, float]]:
    """(label a, label b, stated mm, pt) for each grid bay whose dimension string is in the text layer."""
    out = []
    nums = [w for w in sheet.words if re.fullmatch(r"\d{3,5}", w.text)]
    for axis, lines in (("x", g.xs), ("y", g.ys)):
        order = sorted(lines.items(), key=lambda kv: kv[1])
        for (la, a), (lb, b) in zip(order, order[1:]):
            pt = b - a
            if pt < 5:
                continue
            mid = (a + b) / 2
            cands = []
            for w in nums:
                c_along = w.cx if axis == "x" else w.cy
                c_across = w.cy if axis == "x" else w.cx
                # the grid dimension row runs along the grid bubbles, outside the building
                outside = c_across < sheet.height * 0.25 if axis == "x" else c_across < sheet.width * 0.15
                if abs(c_along - mid) < 0.25 * pt and outside:
                    ratio = int(w.text) / (pt * nominal)
                    if 0.85 < ratio < 1.15:
                        cands.append((abs(c_along - mid), int(w.text)))
            if cands:
                out.append((la, lb, float(min(cands)[1]), pt))
    return out


def sheet_grid(sheet: Sheet, scale: str) -> tuple[Grid, list[tuple[str, str, float, float]]]:
    """What calibration needs from the drawing itself: its labelled grid and the grid bays it states."""
    g = _grid(sheet)
    nominal = nominal_mm_per_pt(scale)
    return g, (_stated_pairs(sheet, g, nominal) if nominal is not None else [])


def plan_grid(task) -> tuple[Grid, list]:
    """A worker (see parallel.py): the grid of one sheet. task: (path, title-block scale)."""
    path, scale = task
    sheet = Sheet(path)
    try:
        return sheet_grid(sheet, scale)
    finally:
        sheet.close()


def calibrate(sheet: Sheet, scale: str, grid_table: dict[tuple[str, str], float]) -> Calibration:
    """grid_table maps (label a, label b) -> stated mm; filled by calibrated sheets, used by the rest."""
    g, pairs = sheet_grid(sheet, scale)
    return calibrate_grid(g, pairs, scale, grid_table)


def calibrate_grid(g: Grid, pairs: list, scale: str, grid_table: dict[tuple[str, str], float]) -> Calibration:
    """calibrate(), from what sheet_grid() found on the sheet."""
    nominal = nominal_mm_per_pt(scale)
    if nominal is None:
        imperial = re.search(r"\d\s*[\"']|\bFT\b|\bFEET\b", scale.upper()) is not None   # a mark, not "IN"
        return Calibration(None, "NONE", f"title-block scale '{scale}' is " + (
            "in feet and inches - this version measures metric drawings" if imperial else "not a ratio"), g)
    if len(pairs) >= 3:
        f = [mm / pt for _, _, mm, pt in pairs]
        med = statistics.median(f)
        spread = (max(f) - min(f)) / med
        if spread < 0.01:
            for la, lb, mm, _ in pairs:
                grid_table.setdefault((la, lb), mm)
            return Calibration(med, "CALIBRATED",
                               f"{len(pairs)} stated grid dimensions on this sheet, spread {spread:.2%}; "
                               f"effective scale 1:{med / PT_MM:.1f} (title block {scale})", g)
    # fall back to the set's grid table, label to label
    f = []
    for axis in (g.xs, g.ys):
        for (la, lb), mm in grid_table.items():
            if la in axis and lb in axis and abs(axis[lb] - axis[la]) > 5:
                f.append(mm / abs(axis[lb] - axis[la]))
    if len(f) >= 3:
        med = statistics.median(f)
        spread = (max(f) - min(f)) / med
        if spread < 0.01:
            return Calibration(med, "FROM-GRID-TABLE",
                               f"{len(f)} grid bays matched by label to dimensions stated on other sheets, "
                               f"spread {spread:.2%}; effective scale 1:{med / PT_MM:.1f} (title block {scale})", g)
    return Calibration(None, "NONE", "no stated grid dimensions on this sheet or matchable from the set", g)


def table_from_reading(reading: dict, sheet: Sheet | None, dn: str, gaps: list[Gap],
                       g: Grid | None = None) -> dict[tuple[str, str], float]:
    """Check a visual reading of the grid chains against the sheet's own geometry and keep the bays that agree.
    g: the sheet's grid when already found (the sheet is then not needed).

    Every bay of a chain must give the same mm-per-point: a misread digit shows up as
    an outlier and is dropped with a gap, it never moves the scale.
    """
    g = g if g is not None else _grid(sheet)
    table: dict[tuple[str, str], float] = {}
    for axis, key in ((g.xs, "x_bays"), (g.ys, "y_bays")):
        bays = {(b["from"], b["to"]): float(b["mm"]) for b in reading.get(key, [])}
        order = sorted(axis, key=lambda k: axis[k])
        # one bay unreadable and the overall stated: the missing bay is the difference
        chain = list(zip(order, order[1:]))
        missing = [p for p in chain if p not in bays]
        overall = [o for o in reading.get("overall", []) if o["from"] == order[0] and o["to"] == order[-1]] if order else []
        if len(missing) == 1 and overall:
            mm = overall[0]["mm"] - sum(bays[p] for p in chain if p in bays)
            bays[missing[0]] = mm
            gaps.append(Gap(dn, f"grid {missing[0][0]}-{missing[0][1]}",
                            f"not legible; taken as {mm:.0f} mm = overall {overall[0]['mm']} less the other bays (DERIVED)"))
        f = {p: mm / abs(axis[p[1]] - axis[p[0]]) for p, mm in bays.items()
             if p[0] in axis and p[1] in axis and abs(axis[p[1]] - axis[p[0]]) > 5}
        if not f:
            continue
        med = statistics.median(f.values())
        for p, v in f.items():
            if abs(v - med) / med > 0.01:
                gaps.append(Gap(dn, f"grid {p[0]}-{p[1]}",
                                f"read {bays[p]:.0f} mm but the drawing gives {bays[p] / v * med:.0f} mm at the chain's scale - reading not used"))
            else:
                table[p] = bays[p]
    return table


def calibrate_all(sheets: list[tuple[str, Sheet, str]], gaps: list[Gap], reader=None,
                  kinds: dict[str, str] | None = None,
                  table: dict[tuple[str, str], float] | None = None,
                  grids: dict[str, tuple[Grid, list]] | None = None) -> dict[str, Calibration]:
    """sheets: (drawing no, sheet, title-block scale). table: filled with the set's grid bays (label pair -> mm),
    for other sheets (elevations) to check their scale against. grids: each sheet's sheet_grid() when already
    found (in workers); the sheets are then only opened for a visual reading.

    Pass 1: sheets that state their grid dimensions in the text layer calibrate themselves.
    If none does, one plan's grid chains are read visually and checked against its geometry.
    Pass 2: every other sheet is calibrated label-to-label against that grid table.
    """
    from .tasks import GRID_DIMS
    table = {} if table is None else table
    grids = {dn: grids[dn] if grids and dn in grids else sheet_grid(sh, sc) for dn, sh, sc in sheets}
    out: dict[str, Calibration] = {}
    for dn, sh, sc in sheets:
        c = calibrate_grid(*grids[dn], sc, table)
        if c.status == "CALIBRATED":
            out[dn] = c
    if not table and reader is not None:
        plans = [(dn, sh) for dn, sh, _ in sheets if (kinds or {}).get(dn, "plan") == "plan"]
        # a sheet already read wins; then the sheet with the most labelled grid lines
        plans.sort(key=lambda t: (not (reader.folder / f"{t[0]}.{GRID_DIMS.name}.json").exists(),
                                  -(len(grids[t[0]][0].xs) + len(grids[t[0]][0].ys)), t[0]))
        for dn, sh in plans[:1]:
            reading, how = reader.read(sh, dn, GRID_DIMS)
            if reading is None:
                gaps.append(Gap(dn, "grid dimensions", f"grid dimension strings are drawn as graphics and no reading is available ({how})"))
                continue
            for i in reading.get("illegible", []):
                gaps.append(Gap(dn, f"grid {i['field']}", f"{i['where']}: {i['reason']}"))
            table.update(table_from_reading(reading, sh, dn, gaps, grids[dn][0]))
    for dn, sh, sc in sheets:
        if dn not in out:
            out[dn] = calibrate_grid(*grids[dn], sc, table)
            if out[dn].status == "NONE":
                gaps.append(Gap(dn, "scale", out[dn].basis + " - nothing on this sheet is measured"))
    return out
