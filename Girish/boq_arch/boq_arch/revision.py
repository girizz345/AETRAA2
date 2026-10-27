"""Revision tracking: what changed between two runs of the same project.

Each run writes evidence.json - the sheets and their fingerprints, every schedule row read, every tag
found on every plan (in mm from the sheet's grid origin, so a re-plotted sheet still lines up), and
every bill item's quantity. Given the previous run's evidence, diff() reports:

  sheets     added / removed / revised (fingerprint changed)
  schedule   marks added / removed, and count, size or location changed
  tags       per plan: moved (same mark, found again within MOVE_MM), added, removed
  quantities bill items whose quantity changed, and items added / removed
"""
from __future__ import annotations

import json
import math
from pathlib import Path

SAME_MM = 300        # a tag within this of where it was has not moved
MOVE_MM = 5000       # beyond this it is a removal plus an addition, not a move


def _origin(plan) -> tuple[float, float]:
    g = plan.cal.grid
    x0 = g.xs.get("1", min(g.xs.values()) if g.xs else 0.0)
    y0 = g.ys.get("A", min(g.ys.values()) if g.ys else 0.0)
    return x0, y0


def evidence(f, items: dict, ident: dict, rev: str) -> dict:
    tags = {}
    for p in f.plans:
        k = p.cal.mm_per_pt or 0
        ox, oy = _origin(p)
        tags[p.dn] = sorted([[key, round((x - ox) * k), round((y - oy) * k)] for key, x, y in p.tags])
    return {
        "schema": "evidence/1", "rev": rev, "project": {k: ident.get(k, "") for k in ("plot", "job_title", "owner")},
        "sheets": {i.drawing_no: {"title": i.title, "sha1": __import__("hashlib").sha1(i.path.read_bytes()).hexdigest(),
                                  "file": i.path.name} for i in f.infos},
        "schedule": {r["mark"]: {"count": r.get("count"), "size": r.get("size"), "shown_size": r.get("shown_size", ""),
                                 "location": r.get("location"), "sheet": dn} for dn, r in f.schedule},
        "tags": tags,
        "items": {f"{s}|{it.description}": {"code": it.code, "unit": it.unit,
                                             "qty": None if it.open else round(it.quantity(), 2)}
                  for s, its in items.items() for it in its},
    }


def diff(prev: dict, cur: dict) -> dict:
    out = {"from_rev": prev.get("rev"), "to_rev": cur.get("rev"), "sheets": [], "schedule": [], "tags": {},
           "quantities": []}
    ps, cs = prev.get("sheets", {}), cur.get("sheets", {})
    for dn in sorted(set(ps) | set(cs)):
        if dn not in ps:
            out["sheets"].append({"sheet": dn, "change": "added", "title": cs[dn]["title"]})
        elif dn not in cs:
            out["sheets"].append({"sheet": dn, "change": "removed", "title": ps[dn]["title"]})
        elif ps[dn]["sha1"] != cs[dn]["sha1"]:
            out["sheets"].append({"sheet": dn, "change": "revised", "title": cs[dn]["title"]})
    pv, cv = prev.get("schedule", {}), cur.get("schedule", {})
    for m in sorted(set(pv) | set(cv)):
        if m not in pv:
            out["schedule"].append({"mark": m, "change": "added", "now": cv[m]})
        elif m not in cv:
            out["schedule"].append({"mark": m, "change": "removed", "was": pv[m]})
        else:
            for fld in ("count", "size", "shown_size", "location"):
                if pv[m].get(fld) != cv[m].get(fld):
                    out["schedule"].append({"mark": m, "change": f"{fld} changed", "was": pv[m].get(fld),
                                            "now": cv[m].get(fld)})
    pt, ct = prev.get("tags", {}), cur.get("tags", {})
    for dn in sorted(set(pt) | set(ct)):
        before, after = [tuple(t) for t in pt.get(dn, [])], [tuple(t) for t in ct.get(dn, [])]
        res = {"added": [], "removed": [], "moved": []}
        left = list(before)
        unmatched = []
        for t in after:                                  # unchanged first
            hit = next((b for b in left if b[0] == t[0] and math.hypot(b[1] - t[1], b[2] - t[2]) <= SAME_MM), None)
            if hit:
                left.remove(hit)
            else:
                unmatched.append(t)
        for t in unmatched:                              # then nearest same mark within the move limit
            cands = [b for b in left if b[0] == t[0] and math.hypot(b[1] - t[1], b[2] - t[2]) <= MOVE_MM]
            if cands:
                b = min(cands, key=lambda b: math.hypot(b[1] - t[1], b[2] - t[2]))
                left.remove(b)
                res["moved"].append([t[0], b[1], b[2], t[1], t[2]])
            else:
                res["added"].append(list(t))
        res["removed"] = [list(b) for b in left]
        if any(res.values()):
            out["tags"][dn] = res
    pi, ci = prev.get("items", {}), cur.get("items", {})
    for k in sorted(set(pi) | set(ci)):
        sec, desc = k.split("|", 1)
        if k not in pi:
            out["quantities"].append({"section": sec, "item": desc, "change": "added", "now": ci[k]["qty"],
                                      "unit": ci[k]["unit"]})
        elif k not in ci:
            out["quantities"].append({"section": sec, "item": desc, "change": "removed", "was": pi[k]["qty"],
                                      "unit": pi[k]["unit"]})
        elif pi[k]["qty"] != ci[k]["qty"]:
            out["quantities"].append({"section": sec, "item": desc, "change": "quantity changed",
                                      "was": pi[k]["qty"], "now": ci[k]["qty"], "unit": ci[k]["unit"]})
    out["summary"] = {"sheets": len(out["sheets"]), "schedule": len(out["schedule"]),
                      "tags": sum(len(v) for d in out["tags"].values() for v in d.values()),
                      "quantities": len(out["quantities"])}
    return out


def to_points(change: dict, plan) -> dict:
    """A plan's tag changes (mm from grid origin) back to sheet points, for the overlay."""
    k = plan.cal.mm_per_pt or 1
    ox, oy = _origin(plan)
    pt = lambda x, y: (ox + x / k, oy + y / k)
    return {"added": [(t[0], *pt(t[1], t[2])) for t in change.get("added", [])],
            "removed": [(t[0], *pt(t[1], t[2])) for t in change.get("removed", [])],
            "moved": [(t[0], *pt(t[1], t[2]), *pt(t[3], t[4])) for t in change.get("moved", [])]}


def load(path: Path | None) -> dict | None:
    if path is None:
        return None
    p = path / "evidence.json" if path.is_dir() else path
    return json.loads(p.read_text(encoding="utf-8")) if p.exists() else None
