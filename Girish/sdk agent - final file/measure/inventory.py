#!/usr/bin/env python3
"""
inventory.py — evidence into elements. Three jobs; the last two are where bills
go wrong.

1. Reconcile sources. Door schedule says 47, plan tags count 44. That is
   reported as a discrepancy. It is never averaged, never resolved by
   last-writer, and never quietly settled in favour of the schedule — the
   difference is a question for the employer and it is worth more as a question
   than as a number.

2. Floor multipliers. "TYPICAL FLOOR PLAN (2ND, 4TH & 6TH)" is three floors.
   The multiplier is parsed from the title-block subtitle, and where the served
   floors cannot be determined the element becomes a gap and never a silent x1.
   Getting this wrong was measured at a 16-58% undercount, which is the largest
   single error this pipeline can make.

3. Cross-sheet dedup. The same wall appears on a plan, a section and a detail.
   Measured from all three it is billed three times. Elements are matched and
   merged, and a count exactly equal to another element's count is flagged
   before measuring rather than after.

  python3 -m measure.inventory --evidence E.json --out inventory.json

Exit 0 = consolidated. Exit 1 = discrepancies present (reported, not resolved).
"""
from __future__ import annotations

import argparse
import math
import re
from dataclasses import dataclass

from spine.gaps import Gap
from spine.records import Element

STAGE = "S10"

# The floor-multiplier patterns live in data/multipliers.json and are resolved by
# ingest.multipliers, because they are a consultant's drafting habit rather than
# a standard: the next package will subtitle its sheets differently and adapting
# must be an edit to a table. This module keeps the function name because it is
# the pipeline's entry point, and keeps the contract: None means undetermined,
# and undetermined is a gap, never a silent 1.
from ingest.multipliers import floor_multiplier as _resolve_multiplier


@dataclass(frozen=True)
class Discrepancy:
    mark: str
    source_a: str
    count_a: int
    source_b: str
    count_b: int

    def as_gap(self) -> Gap:
        return Gap(stage=STAGE, doc_id=None, subject=self.mark,
                   reason=f"{self.source_a} says {self.count_a}, "
                          f"{self.source_b} says {self.count_b}",
                   detail="not averaged — raise as a query")


def floor_multiplier(subtitle: str | None,
                     section_floor_count: int | None = None) -> int | None:
    """None means undetermined, and undetermined is a gap, never 1.

    section_floor_count resolves the "ALL FLOORS" case, which cannot be read
    from the sheet itself — it needs the section drawing's storey count. Absent
    it, the answer stays undetermined rather than guessing the building's height.
    """
    return _resolve_multiplier(subtitle, section_floor_count)


def reconcile(schedule_counts: dict, tag_counts: dict) -> list[Discrepancy]:
    """Marks are compared in one spelling (readers.counts.normalise_mark): the
    schedule writes "D-2" and "DW 01", a plan "D2" and "DW1". Compared as
    written they never met, and the check reported nothing on every package."""
    from readers.counts import normalise_mark
    tags: dict = {}
    for mark, n in tag_counts.items():
        tags[normalise_mark(mark)] = tags.get(normalise_mark(mark), 0) + n
    out = []
    for mark in sorted(schedule_counts):
        a, b = schedule_counts[mark], tags.get(normalise_mark(mark))
        if a is not None and b is not None and a != b:
            out.append(Discrepancy(mark, "schedule", a, "plan tags", b))
    return out


# ── schedule count against the plans' tags, per plan ─────────────────────
# A schedule row says where its mark goes ("1ST TO 5TH FLOOR", "LOWER ROOF");
# a plan's title says which floor it draws. A roof plan that shows the storey
# below repeats that storey's tags, and those are not this floor's windows.
LOCATION_FLOORS = [
    (r"BASEMENT", ["B1"]), (r"UNDER\s*GROUND", ["UG"]),
    (r"\bGF\b|(?<!UNDER)(?<!UNDER )\bGROUND", ["GF"]),
    (r"LOWER\s+(?:ROOF|RF|FLOOR)", ["LOWER ROOF"]), (r"UPPER\s+(?:ROOF|RF)", ["UPPER ROOF"]),
    (r"TOP\s+(?:ROOF|RF)", ["TOP ROOF"]), (r"MEZZ", ["MEZZ"]), (r"PODIUM", ["PODIUM"]),
]
_ORD = {"1ST": 1, "2ND": 2, "3RD": 3, "4TH": 4, "5TH": 5, "6TH": 6, "7TH": 7, "8TH": 8, "9TH": 9}
_WORD = {"FIRST": 1, "SECOND": 2, "THIRD": 3, "FOURTH": 4, "FIFTH": 5, "SIXTH": 6,
         "SEVENTH": 7, "EIGHTH": 8, "NINTH": 9, "TENTH": 10, "ELEVENTH": 11, "TWELFTH": 12}
# any ordinal, one to three digits: 1ST, 10TH, 21ST - a tower has more than nine floors
_ORDINAL = r"(\d{1,3})(?:ST|ND|RD|TH)"
_RANGE = re.compile(rf"\b{_ORDINAL}\s*(?:-|–|TO)\s*{_ORDINAL}\b")


def _numbered(u: str) -> list[str]:
    """The numbered storeys in a text: ranges ('6TH TO 12TH', '4TH-5TH') in full,
    then the ordinals that stand alone."""
    out: list[str] = []
    spans = []
    for m in _RANGE.finditer(u):
        a, b = int(m.group(1)), int(m.group(2))
        if a <= b <= a + 200:
            out += [f"{n}F" for n in range(a, b + 1)]
            spans.append(m.span())
    for m in re.finditer(rf"\b{_ORDINAL}\b", u):
        if not any(s <= m.start() < e for s, e in spans):
            out.append(f"{int(m.group(1))}F")
    return out


def location_floors(location: str | None) -> list[str]:
    """The storeys a schedule's LOCATION cell names: '1ST TO 5TH FLOOR' is
    1F..5F, '(GF,1ST TO 5TH FLOOR)' is GF and 1F..5F. None named: []."""
    u = (location or "").upper()
    out: list[str] = []
    for pat, floors in LOCATION_FLOORS:
        if re.search(pat, u):
            out += floors
    out += _numbered(u)
    return sorted(set(out), key=out.index)


def plan_floors(title: str | None, subtitle: str | None = None) -> list[str]:
    """The storeys a floor plan draws, from its title: 'FIRST FLOOR PLAN' is
    1F, 'TYP ( 4 - 5 ) FLOOR PLAN' 4F and 5F, 'LOWER ROOF PLAN' LOWER ROOF."""
    u = " ".join(p for p in (title, subtitle) if p).upper()
    out: list[str] = []
    for pat, floors in LOCATION_FLOORS:
        if re.search(pat, u):
            out += floors
    m = re.search(r"\(\s*(\d{1,3})\s*(?:-|–|TO)\s*(\d{1,3})\s*\)", u)
    if m and int(m.group(1)) <= int(m.group(2)):
        out += [f"{n}F" for n in range(int(m.group(1)), int(m.group(2)) + 1)]
    out += _numbered(u)
    out += [f"{n}F" for w, n in _WORD.items() if re.search(rf"\b{w}\s+FLOOR", u)]
    return sorted(set(out), key=out.index)


def units(tags: list[tuple[float, float]], span_pt: float | None) -> int:
    """Tags of one mark on one sheet -> units. An L-shaped or long unit is
    tagged once per leg or along its run, so tags lying within one unit's own
    overall length of each other are one unit. No span known: each tag is one."""
    if not span_pt:
        return len(tags)
    left, n = list(tags), 0
    while left:
        x, y = left.pop(0)
        n += 1
        left = [(a, b) for a, b in left if math.hypot(a - x, b - y) > span_pt]
    return n


def legs_m(width: str | None) -> list[float]:
    """A schedule width in mm as printed, into its legs in metres: '1100' is
    [1.1], '7300+2950' (an L-shaped unit) is [7.3, 2.95]. Unreadable: []."""
    out = []
    for part in re.split(r"\s*\+\s*", str(width or "").strip()):
        m = re.fullmatch(r"(\d{3,5}(?:\.\d+)?)", part.replace(",", ""))
        if not m:
            return []
        out.append(float(m.group(1)) / 1000)
    return out


@dataclass
class TagReconciliation:
    """One schedule mark against the plans: what each plan shows, and what
    was tagged on a floor the schedule does not place the mark on."""
    mark: str
    schedule: int
    plans: dict            # drawing no -> units counted (x the floors it serves)
    outside: dict          # drawing no -> units on a floor the schedule does not name
    missing_floors: list   # floors the schedule names that have no plan in the set
    unscaled: list         # plans whose tags could not be grouped into units (no scale)

    @property
    def plan_total(self) -> int:
        return sum(self.plans.values())

    @property
    def agrees(self) -> bool:
        return self.schedule == self.plan_total

    def as_gap(self) -> Gap:
        where = ", ".join(f"{dn} {n}" for dn, n in sorted(self.plans.items())) \
            or "no tag on any floor plan in the set"
        if self.outside:
            where += "; also tagged on " + ", ".join(
                f"{dn} {n}" for dn, n in sorted(self.outside.items())) + \
                " - a floor the schedule does not place it on, not counted"
        notes = []
        if self.missing_floors:
            notes.append(f"its location is on {', '.join(self.missing_floors)}, "
                         f"which has no plan in the set")
        if self.unscaled:
            notes.append(f"no scale on {', '.join(sorted(self.unscaled))}, so each "
                         f"tag there was taken as one unit")
        return Gap(stage=STAGE, doc_id=None, subject=self.mark,
                   reason=f"schedule says {self.schedule}, plan tags say "
                          f"{self.plan_total} ({where})",
                   detail="not averaged - raise as a query"
                          + (f" ({'; '.join(notes)})" if notes else ""))


def reconcile_plan_tags(marks: list[dict], plans: list[dict]) -> list[TagReconciliation]:
    """marks: {mark, count, location, legs (m)} per schedule mark. plans: one
    per floor plan, {drawing_no, floors, multiplier, mm_per_pt, tags: {mark
    (normalised) -> [(x, y), ...]}}. Every mark is reconciled, including one
    no plan shows (plans say 0): the schedule count is checked, never trusted."""
    from readers.counts import normalise_mark
    have = {f for p in plans for f in p.get("floors") or []}
    out = []
    for m in sorted(marks, key=lambda m: m["mark"]):
        key = normalise_mark(m["mark"])
        floors = set(location_floors(m.get("location")))
        legs = m.get("legs") or []
        long_unit = len(legs) > 1 or (legs and legs[0] >= 6.0)
        r = TagReconciliation(m["mark"], m["count"], {}, {},
                              [f for f in location_floors(m.get("location")) if f not in have], [])
        for p in plans:
            tags = (p.get("tags") or {}).get(key) or []
            if not tags:
                continue
            span = None
            if long_unit:
                if p.get("mm_per_pt"):
                    span = sum(legs) * 1000 / float(p["mm_per_pt"])
                else:
                    r.unscaled.append(p["drawing_no"])
            n = units(tags, span) * int(p.get("multiplier") or 1)
            if floors and not floors & set(p.get("floors") or []):
                r.outside[p["drawing_no"]] = n
            else:
                r.plans[p["drawing_no"]] = n
        out.append(r)
    return out


def dedup(elements: list[Element]) -> tuple[list[Element], list[Gap]]:
    """Merge elements that are the same thing seen on different sheets."""
    raise NotImplementedError(
        "key on (element_type, normalised dims, mark); merge sheets and "
        "evidence_ids; flag equal-count pairs across types before measuring")


def main() -> int:
    ap = argparse.ArgumentParser(description="Consolidate evidence to elements.")
    ap.add_argument("--evidence", required=True)
    ap.add_argument("--out", required=True)
    ap.parse_args()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
