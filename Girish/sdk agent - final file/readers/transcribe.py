#!/usr/bin/env python3
"""
transcribe.py — stated values a sheet DRAWS instead of writing, read off it.

A schedule whose sizes and quantities are vector outlines, a title block whose
fields are graphics: the value is on the sheet, stated by the consultant, but
the text layer does not carry it. Everything else in this agent reads the text
layer, so these sheets came back empty — no schedule, no BOQ.

This file is the ONE place a value is read off a drawing's image. What it may
read is fixed: the printed cells of a schedule and the printed fields of a
title block — values the drawing STATES. It never measures, totals, scales or
infers; a length off a plan is still measured by code or not at all. That is
the line invariant 1 draws, and why it is kept (DECISIONS.md, GP1.2 note:
transcription). Every value it returns carries Origin.TRANSCRIBED.

Where a reading comes from, in order:
  1. a saved reading — readings/<name>.<task>.json, stamped with the SHA-1 of
     the exact sheet file it was read from, so a revised sheet is never answered
     from its predecessor's reading. Any folder given with --readings is
     searched too (boq_arch's readings share this format and are accepted).
  2. a live reading through core/ai.py's vision channel, when the model is
     available and the run is not --no-ai. It is saved at once, so the next run
     is answered from (1) and never pays for the same sheet twice.
  3. otherwise a REQUEST folder — readings/<name>.<task>.request/ with the
     crops, the prompt and the answer's schema — and a gap saying so. A reading
     made from the request and saved as the named .json is used on the next run.

  python3 -m readers.transcribe <pdf> --task schedule|title_block
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
READINGS = ROOT / "readings"

_COMMON = (
    "You are reading a construction drawing for a quantity surveyor. Report only what is printed. "
    "Copy numbers and text exactly as printed. Do not total, convert, round or infer anything. "
    "If a value cannot be read with certainty, leave it out of the rows and list it under 'illegible' "
    "with where it is and why. The images are tiles of one sheet with a small overlap - an item that "
    "appears in two tiles is ONE item; report it once."
)
_ILLEGIBLE = {"type": "array", "items": {"type": "object", "required": ["where", "field", "reason"],
              "properties": {"where": {"type": "string"}, "field": {"type": "string"},
                             "reason": {"type": "string"}}}}
_ROW = {"type": "object",
        "required": ["mark", "type", "size", "shown_size", "location", "count", "description"],
        "properties": {k: {"type": "string"} for k in
                       ("mark", "type", "size", "shown_size", "location", "description")}
        | {"count": {"type": ["integer", "null"]}}}

# The same task names, versions, prompts and fields as boq_arch/tasks.py, so a
# reading made by either tool answers both.
TASKS = {
    "schedule": {
        # timeout: A-13-002 (eleven window cards, each with its elevation) was
        # read correctly in 558 s; at the 300 s default it timed out three times
        # and the run went on with 188 of 199 windows missing
        "version": "2", "dpi": 220, "grid": (3, 2), "timeout": 900,
        "prompt": _COMMON + (
            "\n\nThis sheet is a door or window schedule laid out as a grid of cards. Each card has a mark "
            "(e.g. D-1, SD-2, LD-1, W-1, DW-03) and cells TYPE, SIZE, LOCATION, NO. and DESCRIPTION, plus an "
            "elevation drawing. Return one row per card. Ignore the title block and the sheet notes except "
            "for 'sheet_notes', where you copy each general note printed on the sheet (outside the cards)."),
        "schema": {"type": "object", "required": ["rows", "sheet_notes", "illegible"],
                   "properties": {"rows": {"type": "array", "items": _ROW},
                                  "sheet_notes": {"type": "array", "items": {"type": "string"}},
                                  "illegible": _ILLEGIBLE}},
    },
    "title_block": {
        "version": "1", "dpi": 200, "grid": (1, 1),
        "prompt": _COMMON + (
            "\n\nThis is a drawing's title block (or, for a cover sheet, the whole sheet). Copy the fields printed "
            "in it. Leave a field empty if it is not printed; never take a value from anywhere else."),
        "schema": {"type": "object",
                   "required": ["drawing_no", "drawing_title", "scale", "plot", "job_title", "owner",
                                "illegible"],
                   "properties": {k: {"type": "string"} for k in
                                  ("drawing_no", "drawing_title", "scale", "plot", "job_title", "owner")}
                   | {"illegible": _ILLEGIBLE}},
    },
    # A plan's grid dimension strings, where the text layer does not carry
    # them. Copied as printed and then CHECKED against the sheet's own bubble
    # positions (measure.grid.calibrate_from_reading): a bay whose figure
    # disagrees with the drawing's geometry is dropped, never used - so a
    # misread digit can not move the scale.
    "grid_dims": {
        "version": "1", "dpi": 150, "grid": None,
        "prompt": _COMMON + (
            "\n\nRead the structural grid dimension chains of this plan: the dimension strings between "
            "consecutive grid bubbles along the edges of the plan (numbered grids one way, lettered grids "
            "the other). For each bay give the two grid labels and the dimension in mm exactly as printed. "
            "Also give each overall dimension printed over the whole chain."),
        "schema": {"type": "object", "required": ["x_bays", "y_bays", "overall", "illegible"],
                   "properties": {k: {"type": "array", "items": {
                       "type": "object", "required": ["from", "to", "mm"],
                       "properties": {"from": {"type": "string"}, "to": {"type": "string"},
                                      "mm": {"type": "number"}}}}
                                  for k in ("x_bays", "y_bays", "overall")}
                   | {"illegible": _ILLEGIBLE}},
    },
    # A section's storey level markers, where they are drawn as graphics:
    # floor-to-floor heights for walls and wall finishes come from these.
    # Checked against the dimension chain printed beside them
    # (measure.plan_measure.storey_heights) before any height is used.
    "levels": {
        "version": "1", "dpi": 200, "grid": (2, 2),
        "prompt": _COMMON + (
            "\n\nRead the storey level markers of the main section on this sheet: for each marker give the "
            "level name printed beside it (e.g. '2ND FLOOR LVL'), the level value exactly as printed in "
            "metres (e.g. +9.15) and the datum word after it (FFL, SSL, LVL, PARAPET ...). Also read the "
            "vertical dimension chain beside the markers, bottom to top, as the markers it runs between and "
            "the mm printed."),
        "schema": {"type": "object", "required": ["levels", "chain", "illegible"],
                   "properties": {
                       "levels": {"type": "array", "items": {
                           "type": "object", "required": ["name", "value", "datum"],
                           "properties": {k: {"type": "string"} for k in ("name", "value", "datum")}}},
                       "chain": {"type": "array", "items": {
                           "type": "object", "required": ["from", "to", "mm"],
                           "properties": {"from": {"type": "string"}, "to": {"type": "string"},
                                          "mm": {"type": "number"}}}},
                       "illegible": _ILLEGIBLE}},
    },
    # A detail or section sheet's specification notes and build-up labels,
    # where they are drawn as graphics: the slab thickness and the block
    # thicknesses the walls are classified by are read from these, as printed.
    "notes": {
        "version": "1", "dpi": 200, "grid": (2, 2),
        "prompt": _COMMON + (
            "\n\nThis is a detail / section sheet. List every specification note and build-up label printed "
            "on it (the text on leaders and in note boxes that says what something is made of, its thickness, "
            "height or treatment), and the detail it belongs to. Do not list room names, levels or drawing "
            "references. Keep each note's wording exactly as printed."),
        "schema": {"type": "object", "required": ["notes", "illegible"],
                   "properties": {
                       "notes": {"type": "array", "items": {
                           "type": "object", "required": ["detail", "text"],
                           "properties": {"detail": {"type": "string"}, "text": {"type": "string"}}}},
                       "illegible": _ILLEGIBLE}},
    },
}


def sheet_sha1(path: Path) -> str:
    return hashlib.sha1(Path(path).read_bytes()).hexdigest()


def _safe(name: str) -> str:
    return re.sub(r'[<>:"/\\|?*]+', "-", name).strip()


class ReadingStore:
    """Saved readings, found by the sheet file's SHA-1 and the task - never by
    file name or drawing number, which a revision keeps."""

    def __init__(self, dirs):
        self.dirs = [Path(d) for d in dirs if d and Path(d).is_dir()]
        self._index: dict | None = None

    def _build(self) -> dict:
        index: dict = {}
        for d in self.dirs:
            for p in sorted(d.glob("*.json")):
                try:
                    doc = json.loads(p.read_text(encoding="utf-8"))
                except (OSError, ValueError):
                    continue
                stamp = doc.get("_stamp") if isinstance(doc, dict) else None
                if not stamp or "reading" not in doc:
                    continue
                key = (stamp.get("sheet_sha1"), stamp.get("task"))
                index.setdefault(key, (doc["reading"], doc.get("_by") or "saved reading", p))
        return index

    def find(self, sha1: str, task: str):
        if self._index is None:
            self._index = self._build()
        return self._index.get((sha1, task))

    def save(self, path: Path, sha1: str, task: str, reading: dict, by: str, stem: str) -> Path:
        READINGS.mkdir(parents=True, exist_ok=True)
        out = READINGS / f"{_safe(stem)}.{task}.json"
        doc = {"_stamp": {"sheet_sha1": sha1, "task": task, "version": TASKS[task]["version"]},
               "_by": by, "_sheet": Path(path).name, "reading": reading}
        tmp = out.with_suffix(".tmp")
        tmp.write_text(json.dumps(doc, indent=1, ensure_ascii=False), encoding="utf-8")
        tmp.replace(out)
        if self._index is not None:
            self._index[(sha1, task)] = (reading, by, out)
        return out


def crop_rects(path: Path, task: str, edge=None) -> list:
    """The regions to read, in sheet points (displayed page). A schedule: the
    sheet left of the title block, cut into overlapping tiles. A title block:
    the block - right of its border where one was found, else the lower right."""
    import pymupdf
    doc = pymupdf.open(str(path))
    try:
        w, h = doc[0].rect.width, doc[0].rect.height
    finally:
        doc.close()
    right = edge[1] if edge and edge[0] == "x" else w * 0.885
    bottom = edge[1] if edge and edge[0] == "y" else h * 0.97
    if task == "title_block":
        if edge and edge[0] == "y":
            return [(w * 0.40, edge[1], w, h)]
        return [(right if edge else w * 0.80, h * 0.45, w, h)]
    if task == "grid_dims":
        # the four edge bands, where grid bubbles and their chains are drawn;
        # the title block is left out
        d = 0.22
        return [(0, 0, right, h * d), (0, bottom - h * d, right, bottom),
                (0, 0, w * d, bottom), (right - w * d, 0, right, bottom)]
    cols, rows = TASKS[task]["grid"]
    x0, y0, x1, y1 = w * 0.01, h * 0.01, right, bottom
    tw, th = (x1 - x0) / cols, (y1 - y0) / rows
    ov = 0.06
    return [(x0 + c * tw - (ov * tw if c else 0), y0 + r * th - (ov * th if r else 0),
             x0 + (c + 1) * tw + (ov * tw if c < cols - 1 else 0),
             y0 + (r + 1) * th + (ov * th if r < rows - 1 else 0))
            for r in range(rows) for c in range(cols)]


def render_crops(path: Path, task: str, out_dir: Path, edge=None) -> list[Path]:
    import pymupdf
    out_dir.mkdir(parents=True, exist_ok=True)
    doc = pymupdf.open(str(path))
    files = []
    try:
        page = doc[0]
        for i, (x0, y0, x1, y1) in enumerate(crop_rects(path, task, edge), 1):
            f = out_dir / f"tile_{i:02d}.png"
            page.get_pixmap(dpi=TASKS[task]["dpi"], clip=pymupdf.Rect(x0, y0, x1, y1)).save(str(f))
            files.append(f)
    finally:
        doc.close()
    return files


def _valid(task: str, reading) -> dict | None:
    if isinstance(reading, list) and len(reading) == 1:
        reading = reading[0]
    if not isinstance(reading, dict):
        return None
    need = TASKS[task]["schema"]["required"]
    if any(k not in reading for k in need):
        return None
    if task == "schedule" and not all(isinstance(r, dict) and r.get("mark") for r in reading["rows"]):
        return None
    if task == "levels":
        if not all(isinstance(r, dict) and all(isinstance(r.get(k), str) for k in ("name", "value", "datum"))
                   for r in reading["levels"]):
            return None
        if not all(isinstance(c, dict) and isinstance(c.get("mm"), (int, float))
                   and not isinstance(c.get("mm"), bool) for c in reading["chain"]):
            return None
    if task == "notes":
        if not all(isinstance(n, dict) and isinstance(n.get("text"), str) for n in reading["notes"]):
            return None
    if task == "grid_dims":
        for key in ("x_bays", "y_bays", "overall"):
            bays = reading[key]
            if not isinstance(bays, list) or not all(
                    isinstance(b, dict) and b.get("from") not in (None, "") and b.get("to") not in (None, "")
                    and isinstance(b.get("mm"), (int, float)) and not isinstance(b.get("mm"), bool)
                    for b in bays):
                return None
    return reading


def _live(path: Path, task: str, tiles: list[Path]):
    """One vision call through core/ai.py, answers validated here. None when
    the model is unreachable or its answer does not fit the schema."""
    try:
        from core.ai import review_vision
    except ImportError:
        return None
    spec = TASKS[task]
    instructions = (spec["prompt"] + "\n\nReturn a JSON array holding ONE object that fits this JSON "
                    "schema:\n" + json.dumps(spec["schema"]))
    return _valid(task, review_vision(instructions, [str(t) for t in tiles],
                                      label=f"transcribe {task}",
                                      timeout=spec.get("timeout")))


def obtain(path: Path, task: str, stem: str, store: ReadingStore, live: bool = False,
           edge=None) -> tuple[dict | None, str]:
    """(reading, how). how names the source, or where the request was left."""
    path = Path(path)
    sha1 = sheet_sha1(path)
    found = store.find(sha1, task)
    if found:
        reading, by, where = found
        ok = _valid(task, reading)
        if ok is not None:
            return ok, f"saved reading ({by}; {where.name})"
    request = READINGS / f"{_safe(stem)}.{task}.request"
    tiles = render_crops(path, task, request, edge)
    if live:
        reading = _live(path, task, tiles)
        if reading is not None:
            saved = store.save(path, sha1, task, reading, "model (visual transcription)", stem)
            for t in tiles:
                t.unlink(missing_ok=True)
            request.rmdir() if request.exists() and not any(request.iterdir()) else None
            return reading, f"read live ({saved.name})"
    (request / "request.json").write_text(json.dumps(
        {"_stamp": {"sheet_sha1": sha1, "task": task, "version": TASKS[task]["version"]},
         "answer_to": f"{_safe(stem)}.{task}.json", "sheet": path.name,
         "prompt": TASKS[task]["prompt"], "schema": TASKS[task]["schema"],
         "tiles": [t.name for t in tiles]}, indent=1, ensure_ascii=False), encoding="utf-8")
    return None, f"not read - request left in readings/{request.name}/"


# ---- readings into the shapes the rest of the agent reads --------------------

_PART = r"\(?\s*\d{2,5}(?:\s*\+\s*\d{2,5})*\s*\)?"
RE_SIZE = re.compile(rf"^\s*({_PART})\s*[xX×*]\s*({_PART})(?:\s*,?\s*sill\s*(\d{{2,5}}))?\s*$",
                     re.IGNORECASE)


def _size(text: str) -> tuple[str | None, str | None, str | None]:
    """(width, height, sill) as printed: "1200X2200", "7300+2950 x 3200" (an
    L-shaped unit's two legs), "11350 x (800+2400)" (a height in two parts),
    "1200 x 1400 sill 1000". Legs stay joined by "+" - they are two stated
    figures, not one, and are never added up here."""
    m = RE_SIZE.match(text or "")
    if not m:
        return None, None, None
    clean = lambda s: re.sub(r"[\s()]", "", s)                    # noqa: E731
    return clean(m.group(1)), clean(m.group(2)), m.group(3)


def schedule_rows(reading: dict) -> list[dict]:
    """Rows as stage 6 records them: mark, the values by role, the row index.
    SIZE "1200X2200" is width 1200 and height 2200 (mm, as printed); where SIZE
    says AS SHOWN the card's printed overall dimensions stand in. A size that
    is not W x H is kept under 'size' for the take-off and not guessed apart."""
    out = []
    for i, r in enumerate(reading.get("rows") or []):
        mark = " ".join(str(r.get("mark") or "").split())
        if not mark:
            continue
        values = {"mark": mark}
        for src, role in (("type", "type"), ("location", "location"), ("description", "remarks")):
            if r.get(src):
                values[role] = " ".join(str(r[src]).split())
        if r.get("count") not in (None, ""):
            values["count"] = str(r["count"])
        width, height, sill = _size(r.get("size") or "")
        if width is None and r.get("shown_size"):
            width, height, sill = _size(r.get("shown_size"))
        if width is not None:
            values["width"], values["height"] = width, height
            if sill:
                values["sill"] = sill
        elif r.get("size"):
            values["size"] = str(r["size"])
        out.append({"mark": mark, "values": values, "row_index": i})
    return out


def title_fields(reading: dict) -> dict:
    """The register's fields from a title-block reading; empty ones left out."""
    out = {"drawing_no": reading.get("drawing_no"), "title": reading.get("drawing_title"),
           "scale": reading.get("scale")}
    return {k: " ".join(str(v).split()) for k, v in out.items() if v and str(v).strip()}


def main() -> int:
    ap = argparse.ArgumentParser(description="Show what a sheet's saved reading says.")
    ap.add_argument("pdf")
    ap.add_argument("--task", choices=sorted(TASKS), required=True)
    ap.add_argument("--readings", action="append", default=[])
    args = ap.parse_args()
    store = ReadingStore([READINGS, *args.readings])
    found = store.find(sheet_sha1(Path(args.pdf)), args.task)
    if not found:
        print("no saved reading for this sheet")
        return 1
    reading, by, where = found
    print(f"{where.name} - {by}")
    print(json.dumps(schedule_rows(reading) if args.task == "schedule" else title_fields(reading),
                     indent=1, ensure_ascii=False)[:3000])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
