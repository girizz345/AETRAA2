"""Mark up every drawing the take-off read from, and say what is on each (for the platform's viewer)."""
from __future__ import annotations

import re
from pathlib import Path

from .overlay import trade_rgb, write_elevation_overlay, write_plan_overlay, write_schedule_overlay
from .revision import to_points
from .sheet import Sheet
from .tags import norm_mark
from .vision import crop_rects


def _qty(v: float, unit: str) -> str:
    return f"{v:,.2f} {unit}" if unit != "nr" else f"{v:,.0f} nr"


def draw_overlay(job) -> None:
    """A worker (see parallel.py): draw one marked-up drawing. job: (kind, output file, title, then what that kind
    of drawing needs)."""
    from . import tasks
    kind, o, title = job[:3]
    if kind == "plan":
        from .cad import CadSheet, find_cad
        from .rooms import measure_rooms
        info, cal, pieces, rooms, tags, wall_items, open_marks, rows, ch = job[3:]
        cad = find_cad(info.path, info.drawing_no) if info.page_class == "CAD" else None
        sheet = CadSheet.load(cad) if cad is not None else Sheet(info.path)
        # the room fills, as the take-off found them (the plan comes back from measuring without its masks)
        masks = measure_rooms(sheet, cal, pieces)[2] if cal.mm_per_pt else None
        write_plan_overlay(sheet, o, title, pieces, rooms, masks, tags, wall_items, open_marks, rows, ch)
    elif kind == "schedule":
        path, rows = job[3:]
        sheet = Sheet(path)
        write_schedule_overlay(sheet, o, title, crop_rects(sheet, tasks.SCHEDULE), rows)
    else:
        path, classes, rows = job[3:]
        sheet = Sheet(path)
        write_elevation_overlay(sheet, o, title, classes, rows)
    if hasattr(sheet, "close"):
        sheet.close()


def write_markups(f, items: dict, out: Path, changes: dict | None = None) -> list[dict]:
    """Returns one record per marked drawing: file, drawing, title, kind, and its legend rows as text."""
    from .parallel import pmap
    records, jobs = [], []
    all_items = [it for its in items.values() for it in its]
    counts = getattr(f, "counts", {}) or {}
    open_marks = {k for k, c in counts.items() if c.status == "OPEN"}
    tag_changes = (changes or {}).get("tags", {})

    for p in f.plans:
        if not (p.pieces or p.rooms or p.tags):
            continue
        rows, text_rows = [], []
        shade = {}
        for it in all_items:
            q = sum(ln.total() for ln in it.lines if ln.ref == p.dn and not ln.memo)
            if not q and not (it.section == "H"):
                continue
            if it.section == "H":
                # the item's own mark is the last "type ..." in its line: a description before it can say "type 2 frame"
                found = list(re.finditer(r"type ([^\s,]+(?: \d+)?)", it.description))
                m = found[-1] if found else None
                key = norm_mark(m.group(1)) if m else ""
                n = sum(1 for k, _, _ in p.tags if k == key)
                if not n:
                    continue
                status = counts.get(key).status if key in counts else ""
                s = f"{it.code}  {m.group(1)}: {n} tag(s) here - count {status}"
                rgb = (0.85, 0.1, 0.1) if status == "OPEN" else trade_rgb("H")
            else:
                n_on = shade.setdefault(it.section, 0)
                shade[it.section] = n_on + 1
                rgb = trade_rgb(it.section, n_on)
                s = f"{it.code}  {_qty(q, it.unit)}  {it.description[:40]}"
            rows.append((rgb, s))
            text_rows.append({"colour": "#%02X%02X%02X" % tuple(int(c * 255) for c in rgb), "text": s,
                              "key": it.key()})
        wall_items = {}
        n = 0
        for it in items.get("D", []):
            m = re.search(r"(\d+)mm thick", it.description)
            if m and "partition" not in it.description and any(ln.ref == p.dn for ln in it.lines):
                wall_items[int(m.group(1))] = (it.code, n)
                n += 1
        ch = to_points(tag_changes[p.dn], p) if p.dn in tag_changes else None
        o = out / "overlays" / f"{p.dn} marked up.pdf"
        jobs.append(("plan", o, f"{p.dn} {p.info.title} - take-off markup. {p.cal.basis}", p.info, p.cal, p.pieces,
                     p.rooms, p.tags, wall_items, open_marks, rows, ch))
        records.append({"file": o.name, "drawing": p.dn, "title": p.info.title, "kind": "plan",
                        "method": p.info.page_class or "", "legend": text_rows,
                        "changes": {k: len(v) for k, v in (ch or {}).items()}})

    # schedules: regions read directly, and every mark read with its count and status
    for i in f.infos:
        if i.kind != "schedule":
            continue
        rows, text_rows = [], []
        for dn, r in f.schedule:
            if dn != i.drawing_no:
                continue
            key = norm_mark(r["mark"])
            c = counts.get(key)
            status = c.status if c else ""
            rgb = (0.85, 0.1, 0.1) if status == "OPEN" else trade_rgb("H")
            s = f"{r['mark']}: NO. {r.get('count')} read - plans {c.plan_total if c else '?'} - {status}"
            rows.append((rgb, s))
            text_rows.append({"colour": "#%02X%02X%02X" % tuple(int(x * 255) for x in rgb), "text": s})
        o = out / "overlays" / f"{i.drawing_no} marked up.pdf"
        jobs.append(("schedule", o, f"{i.drawing_no} {i.title} - read directly off the drawing (dashed: regions read)",
                     i.path, rows))
        records.append({"file": o.name, "drawing": i.drawing_no, "title": i.title, "kind": "schedule",
                        "method": i.page_class or "", "legend": text_rows, "changes": {}})

    # elevations: each finish class outlined, labelled and listed with its area and what it bills
    for e in getattr(f, "elevations", []):
        if not e.classes:
            continue
        rows, text_rows = [], []
        for c in e.classes:
            rgb = tuple(int(c.colour[k:k + 2], 16) / 255 for k in (1, 3, 5))
            it = next((it for it in all_items if any(ln.ref == e.dn and any(sh.startswith(f"{e.dn}/z{c.id[1:]}-")
                                                                          for sh in ln.shapes) for ln in it.lines)), None)
            what = (f"{it.code} {it.description}" if it else
                    "glazing - billed from the schedules" if c.kind == "glazing" else
                    "not billed - " + ("not named" if c.kind == "unknown" else c.kind))
            s = f"{c.label} {c.area_m2:,.2f} m2 - {what}"
            rows.append((rgb, s))
            text_rows.append({"colour": c.colour, "text": s, **({"key": it.key()} if it else {})})
        o = out / "overlays" / f"{e.dn} marked up.pdf"
        jobs.append(("elevation", o, f"{e.dn} {e.info.title} - finishes measured by colour. {e.cal.basis}",
                     e.info.path, e.classes, rows))
        records.append({"file": o.name, "drawing": e.dn, "title": e.info.title, "kind": "elevation",
                        "method": e.info.page_class or "", "legend": text_rows, "changes": {}})
    pmap(draw_overlay, jobs)
    return records
