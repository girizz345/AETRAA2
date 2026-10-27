"""Hand corrections to the automatic take-off (PlanSwift's editable takeoff), measured again by the same rules.

A person points at a shape the automatic take-off drew and corrects it:

  exclude    a wall piece that is not a wall, a room that is not one, a tag that is a duplicate
  thickness  a wall piece of no block size given its thickness (it is then billed)
  rename     a room given its right name (which moves it to that room's finish class)
  add_tag    a door / window tag the plan leaves out, placed where the opening is
  add_room   a room the flood fill could not measure, drawn round by hand
  slope      a room that slopes (a ramp, a pitched roof): its floor finish and waterproofing are measured on the
             slope, plan area x 1 / cos(pitch)

and on an elevation:

  exclude    a coloured area that is not a finish (a symbol, a legend swatch)
  finish     a colour's finish named by hand - what it is, and whether it is a wall finish, glazing or other

A run keeps its plans without their drawings (Plan.snapshot, in state.pkl). The corrections are made to a
copy of them and the measurement rules run again, so every quantity still comes from the rules. Shapes a
person changed go on take-off lines of their own (MEASURED (CORRECTED) / MEASURED (MANUAL)); what was
excluded is noted under each item it left. A room drawn round a label the run could not measure resolves
that gap.
"""
from __future__ import annotations

import copy
import json
import math
import re
import time
import uuid
from collections import defaultdict
from dataclasses import replace
from pathlib import Path

from . import slope as slopes
from .records import CORRECTED, POMI_ORDER, Line
from .rooms import HAND_REGION, MIN_ROOM_M2, ROOM_TYPES, hand_room, inside
from .tags import norm_mark, tag_id

ACTIONS = ("exclude", "thickness", "rename", "add_tag", "add_room", "slope", "finish")
ON_SHAPE = ("exclude", "thickness", "rename", "slope", "finish")   # corrections made on a shape the run drew
WHAT = ("exclude", "thickness", "rename", "finish")                # what a shape is: one of these per shape


# ---------------------------------------------------------------- store

def load(folder: Path) -> list[dict]:
    p = folder / "corrections.json"
    return json.loads(p.read_text(encoding="utf-8")) if p.exists() else []


def save(folder: Path, cs: list[dict]):
    folder.mkdir(parents=True, exist_ok=True)
    (folder / "corrections.json").write_text(json.dumps(cs, indent=1), encoding="utf-8")


def put(cs: list[dict], c: dict) -> list[dict]:
    """The list with c in it: replacing the correction of the same id, or the one already on the same shape (what
    it is - excluded, a thickness, a name - and its slope are each held once)."""
    group = lambda a: "slope" if a == "slope" else "what"
    same = lambda x: x["id"] == c["id"] or (c["action"] in ON_SHAPE and x["action"] in ON_SHAPE
                                            and group(x["action"]) == group(c["action"])
                                            and x["sheet"] == c["sheet"] and x.get("shape") == c.get("shape"))
    return [x for x in cs if not same(x)] + [c]


# ---------------------------------------------------------------- checking a new correction

def _plan(state: dict, dn: str):
    return next((p for p in state["facts"].plans if p.dn == dn), None)


def _elevation(state: dict, dn: str):
    return next((e for e in getattr(state["facts"], "elevations", []) if e.dn == dn), None)


def marks(state: dict) -> dict[str, str]:
    """Schedule marks: normalised key -> the mark as printed."""
    return {norm_mark(r["mark"]): r["mark"] for _, r in state["facts"].schedule}


def wall_text(w) -> str:
    return f"wall piece {w.id}, {w.length_m:.2f} m, {w.raw_thk_mm:.0f} mm thick on the drawing"


def check(state: dict, c: dict) -> tuple[dict | None, str]:
    """(the correction, completed with its detail and geometry) or (None, why it cannot be made)."""
    action, dn = c.get("action"), c.get("sheet")
    if action not in ACTIONS:
        return None, f"unknown correction '{action}'"
    e = _elevation(state, dn)
    if e is not None:
        return _check_elevation(state, e, c)
    if action == "finish":
        return None, "a finish is named on an elevation"
    p = _plan(state, dn)
    if p is None or not p.cal.mm_per_pt:
        return None, f"{dn} is not a plan the take-off measured"
    if p.info.page_class == "CAD":
        return None, f"{dn} was measured from its CAD file, whose shapes do not sit on the PDF"
    out = {"id": c.get("id") or uuid.uuid4().hex[:10], "sheet": dn, "action": action, "note": str(c.get("note") or ""),
           "created": c.get("created") or time.strftime("%Y-%m-%d %H:%M"), "sha": c.get("sha", "")}
    shape = c.get("shape") or ""
    if action in ON_SHAPE:
        w = next((x for x in p.pieces if x.id == shape), None)
        r = next((x for x in p.rooms if x.id == shape), None)
        t = next(((k, x, y) for k, x, y in p.tags if tag_id(x, y) == shape), None)
        if not (w or r or t):
            return None, f"{shape} is not a shape the take-off measured on {dn}"
        out["shape"] = shape
        if w:
            out["geom"] = {"kind": "wall", "a": list(w.a), "b": list(w.b), "thk": w.thk_mm, "raw": round(w.raw_thk_mm)}
        elif r:
            out["geom"] = {"kind": "room", "name": r.name, "seed": list(r.seed), "poly": [list(q) for q in r.poly[0]]
                           if r.poly else [], "area": round(r.area_m2, 2)}
        else:
            out["geom"] = {"kind": "tag", "mark": t[0], "x": t[1], "y": t[2]}
        if action == "exclude":
            out["detail"] = (wall_text(w) if w else f"room {r.id} {r.name}, {r.area_m2:.2f} m2" if r
                             else f"tag {marks(state).get(t[0], t[0])}") + " - excluded"
        elif action == "slope":
            if not r:
                return None, "only a room can slope"
            sl = slopes.parse(str(c.get("value") or ""))
            if sl is None:
                return None, "give the slope as a pitch in degrees (15), a gradient (1:12) or a percentage (8%)"
            out["value"] = str(c["value"]).strip()
            out["detail"] = f"room {r.id} {r.name}, {r.area_m2:.2f} m2 on plan - sloping {sl[1]}, x{sl[0]:.4f}"
        elif action == "thickness":
            if not w:
                return None, "only a wall piece has a thickness"
            blocks = state["decisions"]["block_thicknesses_mm"]
            try:
                v = int(c.get("value"))
            except (TypeError, ValueError):
                v = None
            if v not in blocks:
                return None, f"a wall is billed at a block size: {', '.join(map(str, blocks))} mm"
            out["value"] = v
            out["detail"] = f"{wall_text(w)} - billed as {v} mm"
        else:
            if not r:
                return None, "only a room can be renamed"
            if c.get("value") not in ROOM_TYPES:
                return None, f"'{c.get('value')}' is not a room name the rules know"
            out["value"] = c["value"]
            out["detail"] = f"room {r.id} {r.name}, {r.area_m2:.2f} m2 - renamed {c['value']}"
        return out, ""
    pts = c.get("points") or []
    try:
        pts = [[round(float(x), 2), round(float(y), 2)] for x, y in pts]
    except (TypeError, ValueError):
        return None, "points must be [x, y] pairs"
    out["points"] = pts
    if action == "add_tag":
        key = norm_mark(str(c.get("value") or ""))
        if len(pts) != 1:
            return None, "a tag is one point"
        if key not in marks(state):
            return None, f"'{c.get('value')}' is not a mark in the schedules"
        out["value"] = key
        out["detail"] = f"tag {marks(state)[key]} added"
        return out, ""
    name = c.get("value")
    if name not in ROOM_TYPES:
        return None, f"'{name}' is not a room name the rules know"
    if len(pts) < 3:
        return None, "a room needs at least three corners"
    r = hand_room(name, pts, p.cal.mm_per_pt, HAND_REGION, "h")
    if r.area_m2 < MIN_ROOM_M2:
        return None, f"{r.area_m2:.2f} m2 is smaller than a room ({MIN_ROOM_M2} m2)"
    out["value"] = name
    out["detail"] = f"{name} drawn by hand, {r.area_m2:.2f} m2"
    return out, ""


def _check_elevation(state: dict, e, c: dict) -> tuple[dict | None, str]:
    action, shape = c.get("action"), c.get("shape") or ""
    if not e.cal.mm_per_pt:
        return None, f"{e.dn} has no scale, so nothing on it is measured"
    out = {"id": c.get("id") or uuid.uuid4().hex[:10], "sheet": e.dn, "action": action, "note": str(c.get("note") or ""),
           "created": c.get("created") or time.strftime("%Y-%m-%d %H:%M"), "sha": c.get("sha", ""), "shape": shape}
    if action == "exclude":
        b = next((b for fc in e.classes for b in fc.blobs if b.id == shape), None)
        if b is None:
            return None, f"{shape} is not an area the take-off measured on {e.dn}"
        fc = next(fc for fc in e.classes if fc.id == b.cls)
        out["geom"] = {"kind": "zone", "cls": b.cls, "colour": fc.colour, "point": list(b.point), "area": round(b.area_m2, 2),
                       "poly": [list(q) for q in b.poly[0]] if b.poly else []}
        out["detail"] = f"{fc.label} area {b.id}, {b.area_m2:.2f} m2 - excluded"
        return out, ""
    if action == "finish":
        fc = next((fc for fc in e.classes if fc.id == shape), None)
        if fc is None:
            return None, f"{shape} is not a finish colour on {e.dn}"
        v = c.get("value") or {}
        kind = v.get("kind") if isinstance(v, dict) else None
        name = re.sub(r"\s+", " ", str((v or {}).get("finish", "") if isinstance(v, dict) else "")).strip()
        from .elevations import KINDS
        if kind not in KINDS or kind == "unknown":
            return None, "say whether it is a wall finish, glazing or other"
        if kind == "wall finish" and not name:
            return None, "a wall finish needs its name (e.g. brick cladding as per specialist's details)"
        out["value"] = {"finish": name, "kind": kind}
        out["geom"] = {"kind": "class", "colour": fc.colour, "label": fc.label}
        out["detail"] = f"{fc.label} ({fc.colour}, {fc.area_m2:.2f} m2) named {kind}" + (f": {name}" if name else "")
        return out, ""
    return None, f"on an elevation a correction excludes an area or names a finish, not '{action}'"


# ---------------------------------------------------------------- applying them

def _resolved(points: list, hand_rooms: list) -> bool:
    """A room problem is resolved when every label it is about lies inside a room drawn by hand."""
    return bool(points) and all(any(inside(r.poly, x, y) for r in hand_rooms) for _, x, y in points)


def apply(f, corrections: list[dict], pre_gaps: list):
    """A copy of the run's facts with the corrections made (the run's own are not changed)."""
    by = defaultdict(list)
    for c in corrections:
        by[c["sheet"]].append(c)
    plans, fixed = [], set()          # fixed: (sheet, problem text) resolved by a room drawn by hand
    for p in f.plans:
        # its own memo of nearest walls: one found after a piece is excluded holds only for these corrections
        q = replace(p, nearest=dict(p.nearest))
        cs = by.get(p.dn)
        if cs:
            ex = {c["shape"] for c in cs if c["action"] == "exclude"}
            thk = {c["shape"]: c for c in cs if c["action"] == "thickness"}
            ren = {c["shape"]: c for c in cs if c["action"] == "rename"}
            slo = {c["shape"]: slopes.parse(c["value"]) for c in cs if c["action"] == "slope"}
            q.pieces = [replace(w, thk_mm=int(thk[w.id]["value"]), hand=thk[w.id]["detail"]) if w.id in thk else w
                        for w in p.pieces if w.id not in ex]
            q.rooms = [replace(r, name=ren[r.id]["value"], category=ROOM_TYPES[ren[r.id]["value"]][0],
                               hand=f"renamed from {r.name}") if r.id in ren else r
                       for r in p.rooms if r.id not in ex]
            q.rooms = [replace(r, slope=slo[r.id][1], slope_f=slo[r.id][0]) if slo.get(r.id) else r for r in q.rooms]
            q.tags = [t for t in p.tags if tag_id(t[1], t[2]) not in ex]
            drawn = []
            for c in cs:
                if c["action"] == "add_tag":
                    (x, y), = c["points"]
                    q.tags.append((c["value"], float(x), float(y)))
                elif c["action"] == "add_room":
                    drawn.append(hand_room(c["value"], c["points"], p.cal.mm_per_pt, HAND_REGION + len(drawn),
                                           "h" + c["id"]))
            q.rooms += drawn
            keep = [(t, pts) for t, pts in zip(p.room_problems, p.problem_points) if not _resolved(pts, drawn)]
            fixed |= {(p.dn, t) for t, pts in zip(p.room_problems, p.problem_points) if _resolved(pts, drawn)}
            fixed -= {(p.dn, t) for t, _ in keep}          # the same words for a label still unmeasured stay a gap
            q.room_problems, q.problem_points = [t for t, _ in keep], [pts for _, pts in keep]
        plans.append(q)
    elevations = []
    for e in getattr(f, "elevations", []):
        cs = by.get(e.dn)
        if not cs:
            elevations.append(e)
            continue
        ex = {c["shape"] for c in cs if c["action"] == "exclude"}
        named = {c["shape"]: c for c in cs if c["action"] == "finish"}
        classes = []
        for fc in e.classes:
            fc = replace(fc, blobs=[b for b in fc.blobs if b.id not in ex])
            if fc.id in named:
                v = named[fc.id]["value"]
                fc = replace(fc, finish=v["finish"], kind=v["kind"], source="named by hand", hand=named[fc.id]["detail"])
            if fc.blobs:
                classes.append(fc)
        elevations.append(replace(e, classes=classes))
    named_sheets = {c["sheet"] for c in corrections if c["action"] == "finish"}
    g = copy.copy(f)
    g.plans = plans
    g.elevations = elevations
    # a sheet whose finishes are named by hand no longer waits on its reading
    g.gaps = [x for x in pre_gaps if not (x.field == "room" and (x.sheet, x.reason) in fixed)
              and not (x.field == "external finish names" and x.sheet in named_sheets
                       and all(fc.source for e in elevations if e.dn == x.sheet for fc in e.classes))]
    g.counts = {}
    return g


def rebuild(state: dict, corrections: list[dict]) -> dict:
    """The take-off measured again with the corrections: {"items": section -> items (coded), "facts": facts}."""
    from .measure import build
    from .render_takeoff import assign_codes
    f = apply(state["facts"], corrections, state["pre_gaps"])
    got = build(f, state["decisions"])
    if not hasattr(state["facts"], "sheet_notes"):
        # a run made before the schedules' sheet notes were kept: its thresholds gap cannot be found again from
        # what was saved, so the run's own is carried over rather than silently lost
        have = {(g.sheet, g.field) for g in f.gaps}
        own = {i.drawing_no for i in getattr(state["facts"], "infos", [])}   # only one about the run's own drawings:
        f.gaps += [g for g in getattr(state["facts"], "gaps", []) if g.field == "thresholds"   # the old constant was
                   and (g.sheet, g.field) not in have and g.sheet in own]                    # on every project
    items = {s: got[s] for s in POMI_ORDER if s in got}
    note_corrections(items, state["items"], corrections, marks(state))
    for s, its in items.items():
        assign_codes(s, its)
    return {"items": items, "facts": f}


def note_corrections(items: dict, auto: dict, corrections: list[dict], mark_text: dict):
    """Under each item, a note of the corrections that took shapes out of it or moved them elsewhere."""
    was = defaultdict(set)            # shape -> the items (Item.key) it fed in the automatic take-off
    for its in auto.values():
        for it in its:
            for ln in it.lines:
                for sh in getattr(ln, "shapes", ()):
                    was[sh].add(it.key())
    now = {it.key(): it for its in items.values() for it in its}
    notes = defaultdict(lambda: defaultdict(list))     # item -> sheet -> corrections
    for c in corrections:
        if c["action"] in ON_SHAPE:
            for key in was.get(f"{c['sheet']}/{c['shape']}", ()):
                notes[key][c["sheet"]].append(c)
        elif c["action"] == "add_tag":
            for key, it in now.items():
                if any(f"{c['sheet']}/{tag_id(*c['points'][0])}" in getattr(ln, "shapes", ()) for ln in it.lines):
                    notes[key][c["sheet"]].append(c)
    for key, sheets in notes.items():
        it = now.get(key)
        if it is None:
            continue
        for dn, cs in sorted(sheets.items()):
            parts = []
            kinds = defaultdict(list)
            for c in cs:
                kinds[(c["action"], (c.get("geom") or {}).get("kind", "tag"))].append(c)
            for (action, kind), group in sorted(kinds.items()):
                n = len(group)
                if kind == "zone":
                    parts.append(f"{n} coloured area(s) excluded ({sum(c['geom']['area'] for c in group):.2f} m2)")
                    continue
                if kind == "class":
                    continue                     # a named finish is on its own lines already
                if action == "slope":
                    parts.append("room(s) sloping: " + ", ".join(f"{c['geom']['name']} {c['value']}" for c in group))
                    continue
                if kind == "wall":
                    L = sum(math.dist(c["geom"]["a"], c["geom"]["b"]) for c in group)
                    what = f"{n} wall piece(s)"
                    parts.append(f"{what} excluded" if action == "exclude" else
                                 f"{what} re-set to " + ", ".join(sorted({f'{c["value"]} mm' for c in group})))
                elif kind == "room":
                    parts.append(f"{n} room(s) excluded ({', '.join(c['geom']['name'] for c in group)})"
                                 if action == "exclude" else
                                 "room(s) renamed " + ", ".join(f"{c['geom']['name']} -> {c['value']}" for c in group))
                else:
                    ms = ", ".join(sorted({mark_text.get((c.get("geom") or {}).get("mark") or c.get("value"), "?")
                                           for c in group}))
                    parts.append(f"{n} tag(s) {'excluded' if action == 'exclude' else 'added'} ({ms})")
            why = "; ".join(sorted({c["note"] for c in cs if c.get("note")}))
            it.lines.append(Line(dn, "", f"Corrected by hand on {dn}: " + "; ".join(parts) + (f" - {why}" if why else ""),
                                 memo=True, origin=CORRECTED))


# ---------------------------------------------------------------- carrying them to a later run

def carry(corrections: list[dict], state: dict, sha_of) -> tuple[list[dict], list[str]]:
    """Corrections of an earlier run placed on this run's shapes. An unchanged sheet gives the same shapes; on a
    revised sheet each shape is found again where it was (walls by their ends, rooms by their label point, tags by
    mark and position; an elevation's areas by their label point, its named colours by colour). Returns
    (corrections for this run, what could not be placed)."""
    out, lost = [], []
    for c in corrections:
        p = _plan(state, c["sheet"])
        if p is None and _elevation(state, c["sheet"]) is None:
            lost.append(f"{c['sheet']}: not in this run - {c.get('detail', c['action'])}")
            continue
        sha = sha_of(c["sheet"])
        new = dict(c, id=uuid.uuid4().hex[:10], sha=sha, carried=True, sheet_changed=bool(c.get("sha")) and sha != c["sha"])
        e = _elevation(state, c["sheet"])
        if e is not None:
            g = c.get("geom") or {}
            if c["action"] == "finish":
                # the same colour on the new run's sheet
                col = lambda h: tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))
                near = [fc for fc in e.classes if max(abs(a - b) for a, b in zip(col(fc.colour), col(g["colour"]))) <= 24]
                hit = near[0].id if near else None
            else:
                hit = next((b.id for fc in e.classes for b in fc.blobs if b.cls == g.get("cls") and b.poly
                            and inside(b.poly, *g["point"])), None)
            if hit is None:
                lost.append(f"{c['sheet']}: {c.get('detail', c['action'])} - not found on this run's elevation")
                continue
            out.append(dict(new, shape=hit))
            continue
        if c["action"] in ON_SHAPE and new["sheet_changed"]:
            g = c.get("geom") or {}
            hit = None
            if g.get("kind") == "wall":
                near = lambda u, v: math.dist(u, v) <= 1.5
                hit = next((w.id for w in p.pieces if (near(w.a, g["a"]) and near(w.b, g["b"]))
                            or (near(w.a, g["b"]) and near(w.b, g["a"]))), None)
            elif g.get("kind") == "room":
                hit = next((r.id for r in p.rooms if r.name == g["name"] and inside(r.poly, *g["seed"])), None)
            elif g.get("kind") == "tag":
                hit = next((tag_id(x, y) for k, x, y in p.tags if k == g["mark"]
                            and math.dist((x, y), (g["x"], g["y"])) <= 2.0), None)
            if hit is None:
                lost.append(f"{c['sheet']}: {c.get('detail', c['action'])} - the shape is not on the revised sheet")
                continue
            new["shape"] = hit
        if c["action"] in ON_SHAPE and not any(
                x.id == new["shape"] for x in p.pieces) and not any(x.id == new["shape"] for x in p.rooms) \
                and not any(tag_id(x, y) == new["shape"] for _, x, y in p.tags):
            lost.append(f"{c['sheet']}: {c.get('detail', c['action'])} - the shape is not in this run")
            continue
        out.append(new)
    return out, lost


# ---------------------------------------------------------------- on the marked-up PDF

def as_markups(corrections: list[dict]) -> list[dict]:
    """Each correction as a manual-measure-like shape, for manual.burn_markup."""
    RED, WALL, ROOM, TAG = "#e0001b", "#C0703A", "#2E7D5B", "#3F9E8C"
    out = []
    for c in corrections:
        g = c.get("geom") or {}
        text = c.get("detail", "") + (f" ({c['note']})" if c.get("note") else "")
        if c["action"] == "add_room":
            out.append({"kind": "area", "points": c["points"], "color": ROOM, "name": text})
        elif c["action"] == "add_tag":
            out.append({"kind": "count", "points": c["points"], "color": TAG, "name": text})
        elif g.get("kind") == "wall":
            out.append({"kind": "length", "points": [g["a"], g["b"]], "name": text,
                        "color": RED if c["action"] == "exclude" else WALL})
        elif g.get("kind") == "room" and g.get("poly"):
            out.append({"kind": "area", "points": g["poly"], "name": text, "deduct": c["action"] == "exclude",
                        "color": RED if c["action"] == "exclude" else ROOM})
        elif g.get("kind") == "tag":
            out.append({"kind": "count", "points": [[g["x"], g["y"]]], "color": RED, "name": text})
        elif g.get("kind") == "zone" and g.get("poly"):
            out.append({"kind": "area", "points": g["poly"], "name": text, "deduct": True, "color": RED})
    return out
