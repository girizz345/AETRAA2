"""Stage 1 - sheet register: title block, sheet kind, floor, repetition.

The drawing number is read from the title block, never from the file name.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path

from .records import Gap
from .sheet import Sheet, Word

# Label -> key. Multi-word labels are matched as consecutive words on one row.
LABELS = {
    "CONSULTANT": "consultant",
    "OWNER": "owner",
    "JOB TITLE": "job_title",
    "PLOT NO. / PARCEL ID": "plot",
    "BLOCK / COMMUNITY": "community",
    "DRAWING TITLE": "drawing_title",
    "ARCHITECT": "architect",
    "STRUCTURAL ENGR.": "structural_engr",
    "DRAWN": "drawn",
    "SCALE": "scale",
    "DATE": "date",
    "CHECKED BY": "checked_by",
    "JOB NO": "job_no",
    "DRAWING NO.": "drawing_no",
    "REVISION NO.": "revision",
}

DRAWING_NO = re.compile(r"^[A-Z]{1,3}-\d{2,3}(?:-\d{3})?[A-Z]?$")
# A drawing number read off the title block's own number field (READ (VISUAL)) in the shapes offices use:
# A1.0, A101, A4a, A-101, S-03_1, 2301-A-200, ISO 19650 codes. Letters and digits both, no spaces. The strict
# house pattern above still guards the text layer, where anything near the corner could be taken (JUN-2025).
VISUAL_NO = re.compile(r"^(?=[^\s]*[A-Za-z])(?=[^\s]*\d)[A-Za-z0-9]+(?:[-._/][A-Za-z0-9]+){0,6}$")
DATE_LIKE = re.compile(r"^(?:\d{1,2}[-./]\d{1,2}[-./]\d{2,4}|[A-Za-z]{3}-\d{2,4})$")


def valid_number(dn: str, method: str) -> bool:
    """A drawing number the register can use: the house pattern, or - read off the number field visually - any
    office's usual shape that is not a date."""
    if DRAWING_NO.match(dn):
        return True
    if method != "READ (VISUAL)" or DATE_LIKE.match(dn):
        return False
    # a bare sheet number ("SHEET NUMBER 3" on a Chief Architect set) is the number field's own value
    return bool(VISUAL_NO.match(dn) or re.fullmatch(r"\d{1,3}", dn))


@dataclass
class SheetInfo:
    path: Path
    drawing_no: str = ""
    title: str = ""
    kind: str = ""                 # plan / roof / schedule / section / elevation / detail / area / general
    floors: list[str] = field(default_factory=list)   # storeys this plan represents
    scale: str = ""
    tb: dict = field(default_factory=dict)            # the whole title block
    tb_method: str = "STATED"                         # STATED (text layer) or READ (VISUAL)
    page_class: str = ""                              # TEXT / OUTLINED / RASTER / MIXED / CAD
    group: str = ""                                   # the floor a divider page before it named ("FIRST FLOOR")
    title_basis: str = ""                             # "title block", or "sheet heading" when the block names none
    schedule_text: bool = False                       # a door or window schedule printed on it (read or not)

    @property
    def repeat(self) -> int:
        return max(1, len(self.floors))


def _label_hits(words: list[Word], label: str) -> list[tuple[float, float, float, float]]:
    toks = label.split()
    hits = []
    for i, w in enumerate(words):
        if w.text != toks[0]:
            continue
        seq = [w]
        for t in toks[1:]:
            nxt = [v for v in words if v.text == t and abs(v.y0 - seq[-1].y0) < 3
                   and 0 <= v.x0 - seq[-1].x1 < 12]
            if not nxt:
                break
            seq.append(nxt[0])
        if len(seq) == len(toks):
            hits.append((seq[0].x0, seq[0].y0, seq[-1].x1, seq[-1].y1))
    return hits


def read_title_block(sheet: Sheet) -> dict:
    """Label/value pairs from the title block (bottom-right panel of the sheet)."""
    w0, h0 = sheet.width, sheet.height
    words = [w for w in sheet.words if w.x0 > w0 * 0.86 and w.y0 > h0 * 0.68
             # rotated text (site levels, sheet-edge notes) is never title-block text
             and not (len(w.text) > 1 and (w.y1 - w.y0) > 1.2 * (w.x1 - w.x0))]
    labels = []
    for text, key in LABELS.items():
        hits = _label_hits(words, text)
        if hits:
            # the title block copy is the lowest-right one
            labels.append((key, max(hits, key=lambda h: (h[1], h[0]))))
    # "DRAWING" of "DRAWING NO." must not be taken as "DRAWING TITLE" and so on:
    # _label_hits already demands the full sequence.
    tb: dict[str, str] = {}
    right_edge = w0 * 0.995
    if labels:
        # the panel's left border sits just left of its labels; drawing text that
        # runs up to the border (clipped site levels) is outside the panel
        tb_left = min(l[1][0] for l in labels) - 8
        words = [w for w in words if w.x0 >= tb_left]
    for key, (x0, y0, x1, y1) in labels:
        row = sorted((l for l in labels if abs(l[1][1] - y0) < 4), key=lambda l: l[1][0])
        idx = [l[0] for l in row].index(key)
        left = (row[idx - 1][1][2] + x0) / 2 if idx > 0 else x0 - 40
        right = (x1 + row[idx + 1][1][0]) / 2 if idx + 1 < len(row) else right_edge
        # the title block is a stack of rows: a cell ends where the next label row starts
        below = [l[1][1] for l in labels if l[1][1] > y0 + 4]
        bottom = min(below) - 1 if below else h0 * 0.99
        vals = [w for w in words if y1 - 1 < w.y0 < bottom and left <= w.cx <= right
                and w.text not in (":",)]
        tb[key] = _join_lines(vals)
    if tb.get("consultant"):
        # keep the firm's name; the address and contact lines are not the name
        name = re.split(r"\b(?:P\.?O\.?\s*Box|Tel:|Email:|ARCHITECTS-)", tb["consultant"])[0]
        tb["consultant"] = " ".join(t for t in name.split() if not re.fullmatch(r"m\d?", t))
    if tb.get("scale"):
        tb["scale"] = tb["scale"].split()[0]
    return tb


def _join_lines(words: list[Word]) -> str:
    lines: list[list[Word]] = []
    for w in sorted(words, key=lambda w: (w.y0, w.x0)):
        if lines and abs(lines[-1][0].y0 - w.y0) < 4:
            lines[-1].append(w)
        else:
            lines.append([w])
    out = []
    for ln in lines:
        ln.sort(key=lambda w: w.x0)
        toks = [w.text for w in ln]
        # letter-spaced logos ("E N G I N E E R I N G") collapse to one word per gap
        if len(toks) > 4 and all(len(t) == 1 for t in toks):
            s, prev = "", None
            for w in ln:
                if prev is not None and w.x0 - prev.x1 > 3:
                    s += " "
                s += w.text
                prev = w
            out.append(s)
        else:
            out.append(" ".join(toks))
    return " ".join(out).strip()


ORDINALS = {"GROUND": "GF", "FIRST": "1F", "1ST": "1F", "SECOND": "2F", "2ND": "2F",
            "THIRD": "3F", "3RD": "3F", "4TH": "4F", "5TH": "5F", "BASEMENT": "B1",
            # the floors a divider page can name too (FLOOR_NAME): a plan after "... - FOURTH FLOOR" is 4F
            "FOURTH": "4F", "FIFTH": "5F", "SIXTH": "6F", "SEVENTH": "7F", "EIGHTH": "8F", "NINTH": "9F",
            "TENTH": "10F", "ELEVENTH": "11F", "TWELFTH": "12F"}


def classify(title: str) -> tuple[str, list[str]]:
    t = re.sub(r"\s+", " ", title.upper())
    if "SCHEDULE" in t:
        return "schedule", []
    if "AREA" in t and "CALC" in t:
        return "area", []
    if "ELEVATION" in t and not re.search(r"\b(?:EXTERIOR|EXTERNAL)\b", t) and (
            re.search(r"\bINTERIOR\b", t) or (
                re.search(r"\b(?:KITCHEN|KITCHENETTE|BATH|BATHROOM|TOILET|JOINERY)S?\b", t)
                and not re.search(r"\b(?:BLOCK|BUILDING|STREET|ROAD)\b", t))):
        # a room's own walls: no external finish is measured off it (a gap says). INTERIOR says so outright
        # ("INTERIOR ELEVATIONS - BLOCK A"); a room's name does unless it names a building ("TOILET BLOCK")
        return "detail", []
    if "ELEVATION" in t:
        return "elevation", []
    if "SECTION" in t and "PLAN" not in t:
        return "section", []
    if "ROOF" in t and "PLAN" in t:
        return "roof", [t.replace(" PLAN", "").replace("TOPROOF", "TOP ROOF").strip()]
    if "PLAN" in t and "SETTING" not in t:
        m = re.search(r"TYP\w*\s*\(\s*(\d+)\s*-\s*(\d+)\s*\)", t)
        if m:
            a, b = int(m.group(1)), int(m.group(2))
            return "plan", [f"{n}F" for n in range(a, b + 1)]
        for k, v in ORDINALS.items():
            if re.search(rf"\b{k}\b", t):
                return "plan", [v]
        m = re.search(r"\b(\d{1,2})(?:ST|ND|RD|TH)\s+FLOOR\b", t)
        if m:
            return "plan", [f"{int(m.group(1))}F"]
        return "plan", []
    if "WATER TANK" in t or "PUMP ROOM" in t:
        return "plan", ["UG TANK"]
    if "DETAIL" in t:
        return "detail", []
    return "general", []


def _visual_title_block(sheet: Sheet, reader, rel: str, gaps: list[Gap]) -> dict | None:
    """Read the title block off the rendered sheet when its text layer gives no valid drawing number."""
    from .tasks import TITLE_BLOCK
    reading, how = reader.read(sheet, f"file-{sheet.sha1[:12]}", TITLE_BLOCK)
    if reading is None:
        gaps.append(Gap(rel, "title block", f"text layer gives no drawing number and the title block was not read "
                                            f"visually ({how}); sheet not used"))
        return None
    for il in reading.get("illegible", []):
        gaps.append(Gap(rel, il.get("field", "title block"), f"{il.get('where', '')}: {il.get('reason', '')}"))
    return reading


KIND_WORD = re.compile(r"\b(PLAN|SECTION|ELEVATION|DETAIL|SCHEDULE|LAYOUT)S?\b", re.I)
FLOOR_NAME = re.compile(r"\b(GROUND|FIRST|SECOND|THIRD|FOURTH|FIFTH|SIXTH|SEVENTH|EIGHTH|NINTH|TENTH|ELEVENTH|"
                        r"TWELFTH|\d{1,2}(?:ST|ND|RD|TH)|TYPICAL|MEZZANINE)"
                        r"\s+FLOOR\b|\bBASEMENT\b|\b(?:LOWER |UPPER )?ROOF\b", re.I)


def sheet_headings(sheet: Sheet) -> tuple[list[str], str]:
    """(the sheet's own headings that name a kind of drawing, largest first; all its large text, joined).

    Some offices print a drawing's name only on the drawing ("FURNITURE LAYOUT PLAN", "SECTION AA'",
    "WINDOW SCHEDULE OF ...") and not in the title block, so every sheet of their set read as "general" and none was
    measured. A heading is a line of horizontal text at least 1.6 times the height of the sheet's small text (its
    notes and labels), not in the title block; one that names no kind of drawing (a dimension, a logo) is not a
    title. The small text, not the median: on a plan the dimension figures are most of the text, and a heading
    only 1.4 times their height was missed (IIT Bombay's room plans)."""
    import pymupdf
    from .readability import title_block_rect
    tb = title_block_rect(sheet, whole_lines=False)    # the block, not the crop read with its name

    def in_block(x, y):
        return tb.contains(pymupdf.Point(x, y))
    # horizontal words only: a dimension figure written up the page has its length for a height
    hor = [w for w in sheet.words if w.y1 - w.y0 > 0.5 and (w.x1 - w.x0 >= w.y1 - w.y0 or len(w.text) < 2)]
    heights = sorted(w.y1 - w.y0 for w in hor if not in_block((w.x0 + w.x1) / 2, (w.y0 + w.y1) / 2))
    if not heights:
        return [], ""
    usual = heights[len(heights) // 4]
    big = sorted((w for w in hor if w.y1 - w.y0 >= 1.6 * usual), key=lambda w: (w.y0, w.x0))
    lines: list[list] = []
    for w in big:
        h = w.y1 - w.y0
        line = next((ln for ln in lines if abs(ln[0].y0 - w.y0) <= 0.4 * h and abs((ln[0].y1 - ln[0].y0) - h) <= 0.3 * h), None)
        if line is None:
            lines.append([w])
        else:
            line.append(w)
    # two views side by side put their headings on one line ("FRONT ELEVATION   SECTION BB'"): a gap wider than
    # the letters are tall starts another heading, and a dimension beside one ("1150") is not part of it
    texts = []
    for ln in lines:
        ln.sort(key=lambda w: w.x0)
        runs = [[ln[0]]]
        for w in ln[1:]:
            if w.x0 - runs[-1][-1].x1 > 1.5 * (w.y1 - w.y0):
                runs.append([w])
            else:
                runs[-1].append(w)
        for run in runs:
            # a heading printed across the block's edge, its left or its top ("CENTRAL FIXED SEATING DETAIL-01",
            # "CONFERENCE ROOM DOOR DETAIL-06") is the sheet's; the office's name and the drawing number, wholly
            # inside the block, are not
            whole = pymupdf.Rect(run[0].x0, min(w.y0 for w in run), run[-1].x1, max(w.y1 for w in run))
            if tb.contains(whole):
                continue
            tokens = [w.text for w in run]
            # a sheet's own title carries its number ("RECEPTION TABLE DETAIL - 02", "MS JALI DETAIL-07")
            tagged = re.search(r"[A-Za-z]\s*[-–]\s*\d{1,3}$", " ".join(tokens)) is not None
            while tokens and not any(c.isalpha() for c in tokens[0]):
                tokens.pop(0)
            while tokens and not any(c.isalpha() for c in tokens[-1]) and not tagged:
                tokens.pop()
            if tokens:
                box = pymupdf.Rect(run[0].x0, min(w.y0 for w in run), run[-1].x1, max(w.y1 for w in run))
                across = (box.x0 < tb.x0 < box.x1 and box.y0 < tb.y1 and box.y1 > tb.y0) or \
                    (box.y0 < tb.y0 < box.y1 and box.x0 < tb.x1 and box.x1 > tb.x0)     # over its left or top edge
                texts.append((max(w.y1 - w.y0 for w in run), " ".join(tokens), tagged, across))
    kinds = [t for t in texts if KIND_WORD.search(t[1]) and sum(c.isalpha() for c in t[1]) >= 4]
    top = max((k[0] for k in kinds), default=0.0)
    # the largest headings first. Among those of one size (within 3%: a sheet's title and its view labels are one
    # font, their heights differ in the fifth decimal) the sheet's own title - the one with its number, or the one
    # printed across the title block's edge - then page order: by height alone, a view's "SECTION AA'" higher up
    # the sheet beat "MANAGER CABIN-STORAGE UNIT DETAIL-05"
    order = sorted(range(len(kinds)), key=lambda n: (0, not kinds[n][2], not kinds[n][3], n)
                   if kinds[n][0] >= 0.97 * top else (1, -kinds[n][0], n))
    heads = [kinds[n][1] for n in order]
    return list(dict.fromkeys(heads)), " ".join(t[1] for t in texts)


def plot_like(v: str) -> bool:
    """A plot or parcel number ("5310319", "PLOT 12-A"), not an address: a reading put "POWAI, MUMBAI - 400 076,
    INDIA" in the plot field, and the files were named after it."""
    v = (v or "").strip()
    return bool(v) and "," not in v and len(v.split()) <= 3 and any(c.isdigit() for c in v) and len(v) <= 24


def read_heading(task) -> dict:
    """One file's title block and how its page can be read (a worker: see parallel.py). task: (root, path,
    readings folder or None, providers)."""
    from .readability import classify_page
    from .vision import Reader
    root, path, readings, providers = task
    gaps: list[Gap] = []
    logs: list[str] = []
    sheet = Sheet(path)
    tb = read_title_block(sheet)
    dn = tb.get("drawing_no", "").split(" ")[0]
    method = "STATED"
    rel = str(path.relative_to(root))
    if not DRAWING_NO.match(dn) and readings is not None:
        # the text layer is empty or garbled here: read the title block the way a person would
        vis = _visual_title_block(sheet, Reader(readings, providers, logs.append), rel, gaps)
        if vis is not None:
            tb = {"drawing_no": vis.get("drawing_no", ""), "drawing_title": vis.get("drawing_title", ""),
                  "scale": vis.get("scale", ""), "plot": vis.get("plot", ""),
                  "job_title": vis.get("job_title", ""), "owner": vis.get("owner", "")}
            dn = tb["drawing_no"].split(" ")[0] if tb["drawing_no"] else ""
            method = "READ (VISUAL)"
    page_class = classify_page(sheet)["page"]
    heads, big_text = sheet_headings(sheet)
    words = len(sheet.words)
    # what the sheet says and where (to 4 pt): two drawings of one room share most of their words, a copy shares
    # them in the same places
    said = frozenset((w.text, round(w.x0 / 4), round(w.y0 / 4)) for w in sheet.words)
    sha1, size = sheet.sha1, (round(sheet.width), round(sheet.height))
    # a door or window schedule printed on the sheet (a US floor plan carries its own): only schedule sheets are
    # read, and the gaps must not then say the set has none
    schedule_text = re.search(r"\b(?:DOOR|WINDOW)S?\s+SCHEDULE\b", " ".join(w.text for w in sheet.words).upper()) \
        is not None
    sheet.close()
    return {"tb": tb, "dn": dn, "method": method, "rel": rel, "page_class": page_class, "gaps": gaps, "logs": logs,
            "headings": heads, "big_text": big_text, "words": words, "said": said, "sha1": sha1, "size": size,
            "schedule_text": schedule_text}


def is_copy(a: dict, b: dict) -> bool:
    """Two files of one drawing (a copy, a re-export): the same file, or the same sheet with all but a few of its
    words in the same places. Two drawings an office built on one base plan (a room's plan and its ceiling plan)
    share most of their words, so words alone called them copies; a borderline pair is kept as two drawings,
    with a gap, rather than one dropped."""
    if a.get("sha1") and a.get("sha1") == b.get("sha1"):
        return True
    x, y = a.get("said", frozenset()), b.get("said", frozenset())
    return bool(x or y) and a.get("size") == b.get("size") and len(x & y) / max(len(x | y), 1) >= 0.95


def _natural(p: Path) -> list:
    """Files in the order a person reads them: Plans 2 before Plans 10 (a divider page applies to the sheets
    after it, so the order decides each sheet's floor)."""
    return [int(t) if t.isdigit() else t for t in re.split(r"(\d+)", str(p))]


def build_register(folder: Path, gaps: list[Gap], reader=None, extra_roots=()) -> list[SheetInfo]:
    from .parallel import pmap
    infos: list[SheetInfo] = []
    roots = [folder, *[Path(r) for r in extra_roots if Path(r).exists()]]
    files = [(r, pp) for r in roots for pp in sorted(Path(r).rglob("*.pdf"), key=_natural)]
    def progress(done, total):
        if reader is not None and total > 10 and (done % 10 == 0 or done == total):
            reader.log(f"   title blocks: {done} of {total}")
    heads = pmap(read_heading, [(r, pp, reader.folder if reader is not None else None,
                                 reader.order if reader is not None else None) for r, pp in files], progress)
    group: dict[tuple, str] = {}           # (folder, file series) -> the floor its last divider page named
    holders: dict[str, list[SheetInfo]] = {}   # a printed drawing number -> every sheet registered with it
    taken: set[str] = set()                # drawing numbers as registered: every sheet's is its own
    seen: dict[Path, dict] = {}            # a registered sheet -> what read_heading found on it

    def free(*names: str) -> str:
        """The first of names no sheet holds yet (counting on from the last)."""
        for n in names:
            if n not in taken:
                return n
        k = 2
        while f"{names[-1]} {k}" in taken:
            k += 1
        return f"{names[-1]} {k}"

    def number_notes(h):
        # a sheet not used: what else on it could not be read does not matter (a divider page's cut-off title)
        return [g for g in h["gaps"] if g.field.startswith(("drawing_no", "title block"))]
    for (root, path), h in zip(files, heads):
        for line in h["logs"]:
            reader.log(line)
        tb, dn, method, rel, page_class = h["tb"], h["dn"], h["method"], h["rel"], h["page_class"]
        info = SheetInfo(path=path, tb=tb, scale=tb.get("scale", ""))
        info.tb_method, info.page_class = method, page_class
        series = (path.parent, re.sub(r"[\s._-]*\d+$", "", path.stem).strip().upper())
        if not valid_number(dn, method):
            floor = FLOOR_NAME.search(h.get("big_text", ""))
            if floor and h.get("words", 0) < 80:
                # a divider page ("ARCHITECTURAL DETAIL DRAWINGS - FIRST FLOOR"): the sheets after it, until the
                # next one, are that floor's - an office that numbers each floor's sheets A5 to A18 again needs it
                group[series] = floor.group(0).upper()
            gaps += number_notes(h)
            gaps.append(Gap(rel, "drawing_no",
                            (f"no drawing number printed on this sheet (read visually)" if method != "STATED" else
                             f"title block drawing number not readable (read '{dn}')")
                            + "; sheet not used - a file name is never taken as a drawing number"))
            continue
        info.group = group.get(series, "")
        same = holders.setdefault(dn, [])
        # a copy of any sheet already registered with this number - never one on another floor's sheets: an office
        # that numbers each floor afresh reissues one typical drawing for every floor
        twin = next((o for o in same if (o.group == info.group or not (o.group and info.group))
                     and is_copy(h, seen[o.path])), None)
        if twin is not None:
            if info.group and not twin.group:
                # the kept copy came first under another file name ("Plans 15 - Copy") outside the divider's
                # series: the floor its twin's divider names is its floor too
                twin.group = info.group
                if twin.kind in ("plan", "roof") and not twin.floors:
                    twin.floors = classify(f"{info.group} PLAN")[1]
            gaps += number_notes(h)
            gaps.append(Gap(rel, "drawing_no", f"duplicate of {twin.drawing_no} already registered from "
                                               f"{twin.path.name}; this copy skipped"))
            continue
        gaps += h["gaps"]
        raw = dn
        if same:
            first = same[0]
            if info.group and not any(o.group == info.group for o in same):
                # the same number on another floor's sheets: all kept, each named with its floor
                for o in same:
                    if o.drawing_no == raw and o.group:
                        taken.discard(o.drawing_no)
                        o.drawing_no = free(f"{raw} ({o.group})")
                        taken.add(o.drawing_no)
                dn = free(f"{raw} ({info.group})")
                gaps.append(Gap(rel, "drawing_no", f"{raw} is used again on {info.group.lower()}'s sheets; "
                                                   f"kept as {dn} (and {first.drawing_no})"))
            else:
                # the same number printed on another drawing (IIT Bombay's second-floor demolition plan and room
                # plan are both A1): both kept, this one named with its file - skipping it lost a drawing
                other = next((o for o in same if o.group == info.group), first)
                base = f"{raw} ({info.group})" if info.group else raw
                # never a path separator: a drawing number names reading and overlay files
                dn = free(f"{base} ({path.stem})", f"{base} ({path.parent.name} {path.stem})")
                gaps.append(Gap(rel, "drawing_no", f"{other.drawing_no} is also printed on {other.path.name}, a "
                                                   f"different drawing; kept as {dn} - ask which number is right"))
        else:
            dn = free(raw)
        seen[path] = h
        same.append(info)
        taken.add(dn)
        info.drawing_no = dn
        info.title, info.title_basis = tb.get("drawing_title", ""), "title block"
        if not info.title and h.get("headings"):
            # the block names no drawing: the sheet's own largest heading does ("FURNITURE LAYOUT PLAN")
            info.title, info.title_basis = h["headings"][0], "sheet heading"
        info.kind, info.floors = classify(info.title)
        if info.title_basis == "sheet heading" and info.kind in ("plan", "section", "elevation") \
                and not FLOOR_NAME.search(info.title):
            # a sheet whose own headings are views of several kinds - a pantry's plan, its sections and its
            # elevation - is a detail sheet, not a floor plan to measure, unless its title names a floor
            views = {classify(t)[0] for t in h["headings"] if not re.search(r"\b(?:KEY|LOCATION)\s+PLAN\b", t, re.I)}
            if len(views & {"plan", "section", "elevation"}) > 1:
                info.kind, info.floors = "detail", []
        info.schedule_text = h.get("schedule_text", False)
        if info.kind in ("plan", "roof") and not info.floors and info.group:
            info.floors = classify(f"{info.group} PLAN")[1]     # the floor its divider page named
        infos.append(info)
    return infos


def unspaced(v: str) -> str:
    """Letters printed spaced out ("I I T BOMBAY", "G F S REAL ESTATE") joined, to compare two readings - the
    value itself is kept as printed."""
    return re.sub(r"(?<![A-Za-z])(?:[A-Za-z] ){2,}[A-Za-z](?![A-Za-z])", lambda m: m.group(0).replace(" ", ""), v)


def same_title(a: str, b: str) -> bool:
    """One job title, and the same one with an address before or after it ("..., POWAI, MUMBAI - 400 076, INDIA",
    "1910 E GRANDVIEW DR. / GRANDVIEW"), name one project. Whole words: "PROPOSED VILLA 1" and "PROPOSED VILLA 12",
    or "TOWER A" and "TOWER AB", do not - nor one more word that is no address ("TOWER A EXTENSION")."""
    ta, tb = ([t for t in re.split(r"[^A-Z0-9]+", unspaced(x).upper()) if t] for x in (a, b))
    if ta == tb:
        return True
    (s, _), (lng, lraw) = sorted(((ta, a), (tb, b)), key=lambda p: len(p[0]))
    if not s or len(s) == len(lng):
        return False
    n = len(s)
    extra = lng[n:] if lng[:n] == s else lng[:-n] if lng[-n:] == s else None
    return extra is not None and (len(extra) >= 2 or "," in lraw)


def project_identity(infos: list[SheetInfo], gaps: list[Gap]) -> dict:
    """The header block, read from the title blocks; every sheet must agree on plot and job title."""
    keys = ("owner", "job_title", "plot", "community", "consultant")
    ident = {}
    for k in keys:
        vals: dict[str, list[str]] = {}
        for i in infos:
            v = " ".join(i.tb.get(k, "").split())
            if v and k == "plot" and not plot_like(v):
                continue                    # an address read into the plot field is not a plot number
            if v:
                vals.setdefault(v, []).append(i.drawing_no)
        if not vals:
            gaps.append(Gap("(all)", k, "not readable in any title block"))
            ident[k] = ""
            continue
        best = max(vals, key=lambda v: len(vals[v]))
        ident[k] = best
        for v, dns in vals.items():
            if k == "job_title" and same_title(v, best):
                continue
            if v != best and k in ("plot", "job_title"):
                gaps.append(Gap(", ".join(dns), k,
                                f"reads '{v}' where the set reads '{best}' - confirm these sheets belong to this plot before combining"))
    return ident
