"""Gather every fact the rules need: register, readings, calibration, levels, plans."""
from __future__ import annotations

import math
import re
from dataclasses import dataclass, field, replace
from pathlib import Path

from . import tasks
from .calibrate import Calibration, calibrate_all
from .levels import storey_key, storeys
from .records import Gap
from .register import SheetInfo, build_register, project_identity
from .rooms import HAND_REGION, Room, inside, measure_rooms
from .sheet import Sheet
from .tags import count_tags, norm_mark
from .vision import Reader
from .walls import WallPiece, measure_walls


def low_partition_height(sheet) -> float | None:
    """The height a plan states for its balcony partitions ('1.8M LOW HEIGHT PARTITION WALL')."""
    txt = " ".join(w.text for w in sheet.own_words).upper()
    m = re.search(r"(\d+(?:\.\d+)?)\s*M\s+LOW\s+HEIGHT\s+PARTITION\s+WALL", txt)
    return float(m.group(1)) if m else None


@dataclass
class Plan:
    info: SheetInfo
    sheet: Sheet | None
    cal: Calibration
    pieces: list[WallPiece] = field(default_factory=list)
    rooms: list[Room] = field(default_factory=list)
    room_problems: list[str] = field(default_factory=list)
    problem_points: list[list] = field(default_factory=list)   # the room labels each problem is about: (name, x, y)
    masks: tuple | None = None
    tags: list[tuple[str, float, float]] = field(default_factory=list)
    storey: str | None = None
    low_h: float | None = None                    # the height its balcony partitions are noted at
    # lookups made while the drawing and masks were in memory, kept so the plan can be measured again without them
    regions: dict = field(default_factory=dict)   # (x, y) -> region id
    nearest: dict = field(default_factory=dict)   # (x, y, max mm) -> (nearest wall piece id or None, distance)

    @property
    def dn(self) -> str:
        return self.info.drawing_no

    def region_at(self, x: float, y: float) -> int:
        key = (round(x, 3), round(y, 3))
        if self.masks is not None:
            lab, ppp, _ = self.masks
            yy, xx = int(y * ppp), int(x * ppp)
            v = int(lab[yy, xx]) if 0 <= yy < lab.shape[0] and 0 <= xx < lab.shape[1] else 0
            self.regions[key] = v
            return v
        # measured again without the masks: a room drawn by hand wins, then the run's own lookup, then the outlines
        for r in self.rooms:
            if r.region >= HAND_REGION and inside(r.poly, x, y):
                return r.region
        if key in self.regions:
            return self.regions[key]
        return next((r.region for r in self.rooms if r.region < HAND_REGION and inside(r.poly, x, y)), 0)

    def _piece(self, pid: str) -> WallPiece | None:
        idx = self.__dict__.get("_by_id")
        if idx is None or idx[0] is not self.pieces:
            idx = self.__dict__["_by_id"] = (self.pieces, {p.id: p for p in self.pieces})
        return idx[1].get(pid)

    def nearest_piece(self, x: float, y: float, max_mm: float = 1500) -> tuple[WallPiece | None, float]:
        key = (round(x, 3), round(y, 3), max_mm)
        if key in self.nearest:
            # pieces are only ever taken away by a correction, so a remembered nearest piece still there still is
            pid, d = self.nearest[key]
            if pid is None:
                return None, 0.0
            p = self._piece(pid)
            if p is not None:
                return p, d
        best, bd = None, 1e18
        for p in self.pieces:
            ax, ay = p.a
            bx, by = p.b
            dx, dy = bx - ax, by - ay
            L2 = dx * dx + dy * dy or 1e-9
            t = max(0.0, min(1.0, ((x - ax) * dx + (y - ay) * dy) / L2))
            d = math.hypot(ax + t * dx - x, ay + t * dy - y)
            if d < bd:
                best, bd = p, d
        if best is None or bd * (self.cal.mm_per_pt or 0) > max_mm:
            self.nearest[key] = (None, 0.0)
            return None, 0.0
        self.nearest[key] = (best.id, bd)
        return best, bd

    def snapshot(self) -> "Plan":
        """The plan without its drawing and masks: what a run keeps, to measure again with hand corrections."""
        return replace(self, sheet=None, masks=None)

    def sides_of(self, p: WallPiece, x: float, y: float) -> tuple[int, int]:
        """Region ids either side of wall piece p, taken level with point (x, y)."""
        ax, ay = p.a
        bx, by = p.b
        dx, dy = bx - ax, by - ay
        L = math.hypot(dx, dy) or 1e-9
        L2 = L * L
        t = max(0.0, min(1.0, ((x - ax) * dx + (y - ay) * dy) / L2))
        cx, cy = ax + t * dx, ay + t * dy
        nx, ny = -dy / L, dx / L
        off = ((p.raw_thk_mm / 2) + 150) / (self.cal.mm_per_pt or 1)
        return self.region_at(cx + nx * off, cy + ny * off), self.region_at(cx - nx * off, cy - ny * off)


@dataclass
class Facts:
    folder: Path
    identity: dict
    infos: list[SheetInfo]
    gaps: list[Gap]
    readings: dict                    # (dn, task) -> (reading | None, provenance)
    storeys: dict                     # key -> {level, height, basis}
    levels_sheet: str
    plans: list[Plan]
    schedule: list[tuple[str, dict]]  # (drawing no, row)
    notes: dict                       # dn -> list of {detail, text}
    missing_sheets: list[tuple[str, str]]
    counts: dict = field(default_factory=dict)   # mark -> reconcile.Count (set by measure.build)
    elevations: list = field(default_factory=list)   # elevations.Elevation: external finishes by colour
    sheet_notes: list = field(default_factory=list)  # (drawing no, general note printed on a schedule sheet)


def _level_marks(path) -> int:
    """How many storey level marks a sheet's text layer shows: +3.95M, -0.30, LVL, FFL, SSL, LEVEL."""
    s = Sheet(path)
    try:
        return sum(1 for w in s.words
                   if re.fullmatch(r"[+\-±]\d+\.\d{2,3}M?|LVL\.?|F\.?F\.?L\.?|S\.?S\.?L\.?|LEVELS?", w.text.upper()))
    finally:
        s.close()


def read_sheet(job) -> tuple[dict | None, str, list[str]]:
    """A worker (see parallel.py): one visual reading. job: (path, drawing no, task, readings folder, providers)."""
    path, dn, task, folder, providers = job
    logs: list[str] = []
    sh = Sheet(path)
    try:
        reading, how = Reader(folder, providers, logs.append).read(sh, dn, task)
    finally:
        sh.close()
    return reading, how, logs


def measure_plan(job) -> dict:
    """A worker (see parallel.py): the walls, rooms and door and window tags of one plan.
    job: (sheet info, calibration, the schedule's marks). Returns the plan without its drawing and masks, with the
    region and nearest-wall lookups the rules make already taken while the masks were in memory."""
    from .cad import CadSheet, find_cad
    i, c, known = job
    gaps: list[Gap] = []
    logs: list[str] = []
    page_class = i.page_class
    sheet = Sheet(i.path)
    cad = find_cad(i.path, i.drawing_no)
    if cad is not None:
        # native CAD supplied: its named geometry replaces visual reading and calibration for this sheet
        try:
            sheet = CadSheet.load(cad)
            c = sheet.calibration()
            page_class = "CAD"
            logs.append(f"   {i.drawing_no}: measured from native CAD {cad.name}")
        except Exception as e:  # DWG, or a DXF that will not open: say so, fall back to the PDF
            gaps.append(Gap(i.drawing_no, "CAD file", f"{cad.name} supplied but not used: {e}; measured from the PDF"))
    p = Plan(i, sheet, c)
    p.storey = i.floors[0] if i.floors else None
    p.low_h = low_partition_height(sheet)
    if c.mm_per_pt:
        p.pieces = measure_walls(p.sheet, c)
        p.rooms, problems, p.masks = measure_rooms(p.sheet, c, p.pieces)
        p.room_problems, p.problem_points = [t for t, _ in problems], [pts for _, pts in problems]
        for pr in p.room_problems:
            gaps.append(Gap(i.drawing_no, "room", pr, "J"))
    _, p.tags = count_tags(p.sheet, known)
    # the lookups the rules make (balcony dividers; the rooms either side of each tagged opening), taken now
    for piece in p.pieces:
        p.sides_of(piece, *piece.mid)
    for _k, x, y in p.tags:
        piece, _ = p.nearest_piece(x, y)
        if piece is not None:
            p.sides_of(piece, x, y)
    logs.append(f"   {i.drawing_no} {i.title}: {len(p.pieces)} wall pieces, {len(p.rooms)} rooms, {len(p.tags)} tags")
    if hasattr(sheet, "close"):
        sheet.close()
    return {"plan": p.snapshot(), "page_class": page_class, "gaps": gaps, "logs": logs}


def _read(reader: Reader, infos, kind_filter, task, facts_readings, gaps):
    from .parallel import pmap
    todo = [i for i in infos if kind_filter(i)]
    results = pmap(read_sheet, [(i.path, i.drawing_no, task, reader.folder, reader.order) for i in todo])
    for i, (reading, how, logs) in zip(todo, results):
        for line in logs:
            reader.log(line)
        facts_readings[(i.drawing_no, task.name)] = (reading, how)
        if reading is None:
            gaps.append(Gap(i.drawing_no, f"{task.name} reading",
                            f"content is drawn as graphics and was not read ({how}); request left in readings/"
                            f"{i.drawing_no}.{task.name}.request/"))
        else:
            for il in reading.get("illegible", []):
                gaps.append(Gap(i.drawing_no, il.get("field", ""), f"{il.get('where', '')}: {il.get('reason', '')}"))


def gather(folder: Path, readings_dir: Path, providers: list[str], log=print,
           converted_dir: Path | None = None) -> Facts:
    gaps: list[Gap] = []
    reader = Reader(readings_dir, providers, log)
    log("S1 register - title blocks (read visually where the text layer fails)")
    extra = []
    if converted_dir is not None:
        from .convert import convert_folder
        made, problems = convert_folder(folder, converted_dir, log)
        for name, why in problems:
            gaps.append(Gap(name, "input file", why))
        extra = [converted_dir]
    infos = build_register(folder, gaps, reader, extra)
    ident = project_identity(infos, gaps)
    readings: dict = {}

    log("S2 visual readings - schedules, levels, detail notes")
    _read(reader, infos, lambda i: i.kind == "schedule", tasks.SCHEDULE, readings, gaps)
    sections = [i for i in infos if i.kind == "section"]
    lvl_sheet = next((i for i in sections if "WALL SECTION" in i.title.upper()), None)
    if lvl_sheet is None and sections:
        # the section that shows the storeys: the most level marks (+3.95M, LVL, FFL) in its text, the first on a
        # tie - not simply the first section, a joinery section on IIT Bombay's set while its building sections
        # (+0.00M ... +3.95M) went unread
        marks = [_level_marks(i.path) for i in sections]
        lvl_sheet = sections[max(range(len(sections)), key=lambda k: (marks[k], -k))]
    st: dict = {}
    if lvl_sheet:
        _read(reader, [lvl_sheet], lambda i: True, tasks.LEVELS, readings, gaps)
        r = readings[(lvl_sheet.drawing_no, "levels")][0]
        if r:
            st = storeys(r, lvl_sheet.drawing_no, gaps)
    else:
        gaps.append(Gap("(set)", "levels", "no section sheet in the set - storey heights unknown; nothing is measured by height"))
    _read(reader, infos, lambda i: i.kind in ("detail", "section") and re.search(
        r"WATERPROOF|TYPICAL|WALL SECTION", i.title.upper()) is not None, tasks.NOTES, readings, gaps)
    notes = {dn: r["notes"] for (dn, t), (r, _) in readings.items() if t == "notes" and r}

    schedule, sheet_notes = [], []
    for (dn, t), (r, _) in sorted(readings.items()):
        if t == "schedule" and r:
            schedule += [(dn, row) for row in r["rows"]]
            sheet_notes += [(dn, n) for n in r.get("sheet_notes", []) if n]

    log("S3 calibration - grid")
    from .calibrate import plan_grid
    from .parallel import pmap
    pl = [i for i in infos if i.kind in ("plan", "roof")]
    sheets = {i.drawing_no: Sheet(i.path) for i in pl}      # opened only if a grid must be read visually
    grids = dict(zip([i.drawing_no for i in pl], pmap(plan_grid, [(i.path, i.scale) for i in pl])))
    grid_table: dict = {}
    cal = calibrate_all([(i.drawing_no, sheets[i.drawing_no], i.scale) for i in pl], gaps, reader,
                        {i.drawing_no: i.kind for i in pl}, grid_table, grids)
    for sh in sheets.values():
        sh.close()

    log("S4 plans - walls, rooms, tags")
    known = {norm_mark(r["mark"]) for _, r in schedule}
    plans: list[Plan] = []
    for i, res in zip(pl, pmap(measure_plan, [(i, cal[i.drawing_no], known) for i in pl])):
        p = res["plan"]
        p.info = i                          # the register's own record, not the worker's copy
        i.page_class = res["page_class"]
        gaps += res["gaps"]
        for line in res["logs"]:
            log(line)
        plans.append(p)

    log("S4b elevations - external finishes by colour")
    from .elevations import measure_elevations
    elevations = measure_elevations(infos, reader, grid_table, gaps, log)

    # sheets the list of drawings names but the set does not contain
    missing = []
    lod = next((i for i in infos if "LIST OF DRAWINGS" in i.title.upper()), None)
    if lod:
        have = {i.drawing_no for i in infos}
        sh = Sheet(lod.path)
        for w in sh.words:
            if re.fullmatch(r"[A-Z]-\d{2}-\d{3}", w.text) and w.text not in have:
                title = " ".join(v.text for v in sh.words if abs(v.cy - w.cy) < 3 and w.x1 < v.x0 < w.x1 + 400)
                if title and (w.text, title) not in missing:
                    missing.append((w.text, title))
        files = [pp.name.upper() for pp in folder.rglob("*.pdf")]
        for dn, title in missing:
            named = [n for n in files if n.startswith(dn)]
            if named:
                gaps.append(Gap(dn, "sheet", f"'{title}' is on the list of drawings ({lod.drawing_no}); a file named "
                                             f"'{named[0]}' is in the set but its title block could not be read, so "
                                             f"it was not used (a file name is not a drawing number)"))
            else:
                gaps.append(Gap(dn, "sheet", f"'{title}' is on the list of drawings ({lod.drawing_no}) but not in the set"))
    return Facts(folder, ident, infos, gaps, readings, st, lvl_sheet.drawing_no if lvl_sheet else "",
                 plans, schedule, notes, missing, elevations=elevations, sheet_notes=sheet_notes)


def storey_of(floor: str) -> str | None:
    return storey_key(floor) or floor
