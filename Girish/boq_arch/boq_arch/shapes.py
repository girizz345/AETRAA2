"""The take-off as the platform draws it: each plan's wall pieces, rooms and tags in sheet points, the lines of
every bill item with the shapes each was measured from, and what hand corrections changed against the
automatic take-off. Shape ids are those of Line.shapes without the drawing ("w12", "r3", "t2104_1187"; on an
elevation "z1-4", an area of finish class "c1")."""
from __future__ import annotations

import re

from .corrections import ON_SHAPE, marks
from .letters import letter
from .render_boq import bill_qty
from .rooms import ROOM_TYPES
from .tags import tag_id


def _walls(pieces, cids: dict) -> list:
    return [[w.id, round(w.a[0], 2), round(w.a[1], 2), round(w.b[0], 2), round(w.b[1], 2), w.thk_mm,
             round(w.raw_thk_mm), round(w.length_m, 3), cids.get(w.id, "")] for w in pieces]


def _rooms(rooms, cids: dict, scids: dict | None = None) -> list:
    return [{"id": r.id, "name": r.name, "cat": r.category, "area": round(r.area_m2, 2), "per": round(r.perimeter_m, 2),
             "seed": [round(r.seed[0], 2), round(r.seed[1], 2)], "hand": r.hand, "cid": cids.get(r.id, ""),
             "slope": r.slope, "slope_f": round(r.slope_f, 5), "scid": (scids or {}).get(r.id, ""),
             "poly": [[round(v, 1) for q in ring for v in q] for ring in r.poly]} for r in rooms]


def _zones(blobs, cids: dict) -> list:
    return [{"id": b.id, "cls": b.cls, "area": round(b.area_m2, 2), "point": list(b.point), "cid": cids.get(b.id, ""),
             "poly": [[round(v, 1) for q in ring for v in q] for ring in b.poly]} for b in blobs]


def _classes(classes, cids: dict) -> list:
    return [{"id": c.id, "label": c.label, "colour": c.colour, "area": round(c.area_m2, 2), "finish": c.finish,
             "kind": c.kind, "source": c.source, "hand": c.hand, "cid": cids.get(c.id, ""), "n": len(c.blobs)}
            for c in classes]


def _tags(tags, cids: dict) -> list:
    return [[tag_id(x, y), k, round(x, 2), round(y, 2), cids.get(tag_id(x, y), "")] for k, x, y in tags]


def _total(it) -> dict:
    q = it.quantity()
    return {"qty": round(q, 2), "bill": None if it.open else bill_qty(q), "open": it.open}


def run_data(state: dict, rebuilt: dict, corrections: list[dict]) -> dict:
    """Everything the Measure workspace shows of the automatic take-off, for every plan of the run."""
    f, items = rebuilt["facts"], rebuilt["items"]
    base = {p.dn: p for p in state["facts"].plans}
    cids: dict = {}                   # sheet -> shape id -> the correction on it (what it is)
    scids: dict = {}                  # sheet -> room id -> its slope correction
    for c in corrections:
        sid = c.get("shape") if c["action"] in ON_SHAPE else \
            tag_id(*c["points"][0]) if c["action"] == "add_tag" else "h" + c["id"]
        (scids if c["action"] == "slope" else cids).setdefault(c["sheet"], {})[sid] = c["id"]
    sheets = {}
    for p in f.plans:
        mine = cids.get(p.dn, {})
        ex = {c["shape"] for c in corrections if c["sheet"] == p.dn and c["action"] == "exclude"}
        b = base[p.dn]
        sheets[p.dn] = {
            "overlay": p.info.page_class != "CAD" and bool(p.cal.mm_per_pt), "floors": p.info.floors,
            "mm_per_pt": p.cal.mm_per_pt,
            "kind": "plan", "walls": _walls(p.pieces, mine), "rooms": _rooms(p.rooms, mine, scids.get(p.dn)),
            "tags": _tags(p.tags, mine), "zones": [], "classes": [],
            # what a correction took out, drawn faintly so it can be put back
            "ghosts": {"walls": _walls([w for w in b.pieces if w.id in ex], mine),
                       "rooms": _rooms([r for r in b.rooms if r.id in ex], mine),
                       "tags": _tags([t for t in b.tags if tag_id(t[1], t[2]) in ex], mine), "zones": []},
            "problems": [[t, [[n, round(x, 2), round(y, 2)] for n, x, y in pts]]
                         for t, pts in zip(p.room_problems, p.problem_points) if pts]}
    base_e = {e.dn: e for e in getattr(state["facts"], "elevations", [])}
    for e in getattr(f, "elevations", []):
        mine = cids.get(e.dn, {})
        ex = {c["shape"] for c in corrections if c["sheet"] == e.dn and c["action"] == "exclude"}
        b = base_e.get(e.dn, e)
        sheets[e.dn] = {
            "overlay": bool(e.cal.mm_per_pt), "floors": [], "mm_per_pt": e.cal.mm_per_pt, "kind": "elevation",
            "walls": [], "rooms": [], "tags": [], "problems": [],
            "zones": _zones([z for c in e.classes for z in c.blobs], mine),
            "classes": _classes(e.classes, mine) + _classes([c for c in b.classes if c.id not in {x.id for x in e.classes}], mine),
            "ghosts": {"walls": [], "rooms": [], "tags": [],
                       "zones": _zones([z for c in b.classes for z in c.blobs if z.id in ex], mine)}}
    auto = {}
    for s, its in state["items"].items():
        for n, it in enumerate(its):
            auto[it.key()] = dict(_total(it), code=f"{s}-{letter(n)}", uhead=it.uhead, description=it.description,
                                  unit=it.unit)
    rows, now = [], {}
    for s, its in items.items():
        for it in its:
            key = it.key()
            now[key] = _total(it)
            on = {sh.split("/", 1)[0] for ln in it.lines for sh in getattr(ln, "shapes", ())} | \
                {ln.ref for ln in it.lines if not ln.memo and ln.ref in sheets}
            rows.append(dict(now[key], key=key, code=it.code, section=s, uhead=it.uhead, description=it.description,
                             unit=it.unit,
                             origins=it.origins(), sheets=sorted(on),
                             lines=[{"ref": ln.ref, "level": ln.level, "desc": ln.desc, "memo": ln.memo,
                                     "qty": 0 if ln.memo else round(ln.total(), 3), "origin": ln.origin,
                                     "shapes": list(getattr(ln, "shapes", ()))} for ln in it.lines]))
    changes = []
    for key in list(auto) + [k for k in now if k not in auto]:
        a, n = auto.get(key), now.get(key)
        if a and n and a["bill"] == n["bill"] and a["open"] == n["open"] and abs(a["qty"] - n["qty"]) < 0.005:
            continue
        row = next((r for r in rows if r["key"] == key), None) or a
        changes.append({"key": key, "code": row["code"], "unit": row["unit"], "uhead": row["uhead"],
                        "description": row["description"], "was": a, "now": n})
    counts = {k: {"mark": c.mark, "schedule": c.schedule, "plan": c.plan, "outside": c.outside,
                  "plan_total": c.plan_total, "status": c.status, "where": c.where}
              for k, c in sorted(f.counts.items())}
    return {"sheets": sheets, "items": rows, "changes": changes, "counts": counts,
            "marks": [{"key": k, "mark": v} for k, v in marks(state).items()],
            "room_types": sorted(ROOM_TYPES), "blocks": state["decisions"]["block_thicknesses_mm"],
            "corrections": corrections}


def sheet_view(data: dict, dn: str) -> dict:
    """run_data cut down to one plan: its shapes, and each item's lines on it with their shape ids."""
    out = {k: v for k, v in data.items() if k not in ("sheets", "items")}
    out["sheet"] = data["sheets"].get(dn)
    # marks in schedule order: D-2 before D-10
    out["marks"] = sorted(data["marks"], key=lambda m: (re.sub(r"\d+", "", m["key"]),
                                                       int(re.sub(r"\D", "", m["key"]) or 0)))
    pre = dn + "/"
    rows = []
    for it in data["items"]:
        lines = []
        for ln in it["lines"]:
            ids = [s[len(pre):] for s in ln["shapes"] if s.startswith(pre)]
            if ids or ln["ref"] == dn:
                lines.append(dict(ln, shapes=ids))
        rows.append(dict(it, lines=lines, here=round(sum(l["qty"] for l in lines if l["ref"] == dn), 3)))
    out["items"] = rows
    return out
