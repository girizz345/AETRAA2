"""Reconciled counting (PlanSwift's count tool, done two independent ways).

For every mark that appears in a schedule and on plans:
  a) the schedule's NO. cell                     (READ (VISUAL) - schedules are drawn as graphics)
  b) the mark's occurrences on the plan views   (COUNTED - own text layer, per plan, x storeys it serves)
Equal -> CLOSED. Different -> OPEN: both counts and their sources go to the gaps register and the
item is left open - neither count is picked.

An L-shaped (multi-leg) unit is tagged once per leg; tags of that mark lying within the unit's own
overall length of each other on one sheet are one unit. Nothing else is inferred.
"""
from __future__ import annotations

import math
import re
from dataclasses import dataclass, field

from .records import Gap

LOCATION_FLOORS = [
    (r"BASEMENT", ["B1"]), (r"\bGF\b|GROUND", ["GF"]), (r"LOWER\s+(ROOF|RF|FLOOR)", ["LOWER ROOF"]),
    (r"UPPER\s+(ROOF|RF)", ["UPPER ROOF"]),
]
ORD = {"1ST": 1, "2ND": 2, "3RD": 3, "4TH": 4, "5TH": 5, "6TH": 6}


def location_floors(location: str) -> list[str]:
    """Storeys a schedule's LOCATION cell names ('1ST TO 5TH FLOOR' -> 1F..5F)."""
    u = location.upper()
    out = []
    for pat, fl in LOCATION_FLOORS:
        if re.search(pat, u):
            out += fl
    for a, b in re.findall(r"\b(\d)(?:ST|ND|RD|TH)\s+TO\s+(\d)(?:ST|ND|RD|TH)\b", u):
        out += [f"{n}F" for n in range(int(a), int(b) + 1)]
    for o in re.findall(r"\b(\d(?:ST|ND|RD|TH))\b(?!\s+TO)", u):
        if not re.search(rf"TO\s+{o}", u):
            out.append(f"{ORD[o]}F")
    return sorted(set(out), key=out.index)


@dataclass
class Count:
    key: str
    mark: str
    schedule: int | None
    schedule_sheet: str
    location: str
    plan: dict = field(default_factory=dict)      # drawing no -> units counted (x storeys it serves)
    outside: dict = field(default_factory=dict)   # tags on plans of floors the schedule does not name
    status: str = "OPEN"
    note: str = ""

    @property
    def plan_total(self) -> int:
        return sum(self.plan.values())

    @property
    def where(self) -> str:
        s = ", ".join(f"{dn} {n}" for dn, n in sorted(self.plan.items())) or "no tag on any plan in the set"
        if self.outside:
            s += "; also tagged on " + ", ".join(f"{dn} {n}" for dn, n in sorted(self.outside.items())) + \
                 " - a floor the schedule does not place it on, not counted"
        return s


def _units(tags: list[tuple[float, float]], span_pt: float | None) -> int:
    """Tags on one sheet -> units: tags within one unit's own length of each other are one unit."""
    if not span_pt:
        return len(tags)
    left = list(tags)
    n = 0
    while left:
        x, y = left.pop(0)
        n += 1
        left = [(a, b) for a, b in left if math.hypot(a - x, b - y) > span_pt]
    return n


def reconcile(f, ops) -> dict[str, Count]:
    """ops: key -> Opening (schedule rows). Returns key -> Count, and writes OPEN items to the gaps."""
    plan_floors = {fl for p in f.plans for fl in p.info.floors}
    out: dict[str, Count] = {}
    for key, o in ops.items():
        c = Count(key, o.mark, o.count, o.dn, o.row.get("location", ""))
        floors = set(location_floors(c.location))
        for p in f.plans:
            tags = [(x, y) for k, x, y in p.tags if k == key]
            if not tags:
                continue
            span = None
            # one unit tagged more than once: per leg (L-shaped) or along a long run (6 m and over)
            if (len(o.legs) > 1 or (o.w or 0) >= 6.0) and p.cal.mm_per_pt:
                span = (sum(o.legs) * 1000) / p.cal.mm_per_pt
            n = _units(tags, span) * p.info.repeat
            if floors and not floors & set(p.info.floors):
                # a plan of a floor the schedule does not place this mark on (e.g. a roof plan showing the
                # storey below): reported, not counted
                c.outside[p.dn] = n
                continue
            c.plan[p.dn] = n
        if c.schedule is not None and c.schedule == c.plan_total:
            c.status = "CLOSED"
        else:
            c.status = "OPEN"
            fl = location_floors(c.location)
            missing = [x for x in fl if x not in plan_floors]
            if missing:
                c.note = f"its location is on {', '.join(missing)}, which has no plan in the set"
            f.gaps.append(Gap(o.dn, f"{o.mark} count", (
                f"OPEN - schedule {o.dn} states {c.schedule if c.schedule is not None else 'no NO.'}, "
                f"plans show {c.plan_total} ({c.where}). Both kept; neither is billed until resolved"
                + (f" ({c.note})" if c.note else "")), "H"))
        # the location a schedule states must be findable on a plan of that floor
        fl = location_floors(c.location)
        missing = [x for x in fl if x not in plan_floors]
        if missing:
            f.gaps.append(Gap(o.dn, f"{o.mark} location", (
                f"schedule location '{c.location}' cannot be confirmed - "
                f"{', '.join(missing)} has no plan in the set, and no {o.mark} tag appears on the plans supplied"
                if c.plan_total == 0 else
                f"schedule location '{c.location}' is only partly covered - no plan for {', '.join(missing)}"), "H"))
        out[key] = c
    return out
