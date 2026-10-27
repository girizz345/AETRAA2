#!/usr/bin/env python3
"""
rows.py — the measurement written out as a surveyor reads it.

Not a new computation. Stages 9 to 12 already produced the quantities; this is
those stages rendered as dimension paper. It exists because the take-off is
what a surveyor checks, and because the rollup is the auditable step between a
dimension on a drawing and a quantity in a bill.

One row per measured dimension set — Nr, L, W, H/Thk — each carrying its
drawing reference, level and grid location. Timesing is shown, not folded in: a
row reading 3/ 4.50 x 0.30 is checkable at a glance and 4.05 is not.

The drawing reference is a hyperlink to the sheet, and the item code matches
the markup tag exactly, both directions. Those two things are what let a
checker move between a quantity and the picture it came from without measuring
anything again.

In this build one element is one dimension set, so one quantity is one row.
The reconciling value is `squared`, which is the quantity itself: the row is
the quantity written out, not a second computation of it, so the rollup
reconciles exactly and a disagreement can only mean a row was dropped.

  python3 -m takeoff.rows --quantities Q.json --out takeoff.json

Exit 0 = rows built. Exit 2 = quantities unreadable.
"""
from __future__ import annotations

import argparse
import json
import sys
from dataclasses import dataclass
from decimal import Decimal
from pathlib import Path

from spine.records import Origin


@dataclass(frozen=True)
class DimensionRow:
    item_code: str            # matches the markup tag, exactly
    times: int                # the Nr column — timesing, shown not folded in
    length: Decimal | None
    width: Decimal | None
    height: Decimal | None
    squared: Decimal          # the product, for the eye to check
    unit: str
    drawing_ref: str          # doc_id — rendered as a hyperlink
    level: str | None
    location: str | None      # grid reference
    evidence_ids: tuple
    method: str               # neutral wording: "schedule cell", "vector take-off"

    @property
    def qty_each(self) -> Decimal | None:
        """squared / times, only where that division is exact. A count of 2
        doors on a floor repeated 7 times reads 2/ 7 = 14; a value that does
        not divide by its timesing has no honest per-unit figure and gets
        None rather than a rounded one."""
        if self.times <= 0:
            return None
        each = self.squared / Decimal(self.times)
        return each if each * self.times == self.squared else None


METHODS = ("schedule cell", "schedule cell (transcribed)", "counted from plan",
           "stated level difference",
           "measured to scale")

# how a quantity came to be known -> the neutral surveying label for it.
# Every label here is in render.hygiene.APPROVED_METHODS; a new origin needs
# a label there before it needs one here.
_METHOD_BY_ORIGIN = {
    Origin.STATED: "schedule cell",
    Origin.TRANSCRIBED: "schedule cell (transcribed)",
    Origin.DERIVED: "stated level difference",
    Origin.COUNTED: "counted from plan",
    Origin.MEASURED: "measured to scale",
}

# element dimension roles -> the three dimension-paper columns
_LENGTH_ROLES = ("length",)
_WIDTH_ROLES = ("width",)
_HEIGHT_ROLES = ("height", "thickness", "depth")


def provisional_code(quantity) -> str:
    """A code that identifies the item before lettering has run. Lettering
    needs the whole section in canonical order, which one quantity cannot
    know, so the stage replaces this once the section is assembled."""
    return f"{quantity.section}-{quantity.clause_id}/{quantity.element_mark}"


def _dimension(element, base, roles) -> Decimal | None:
    dims = element.dims or {}
    for role in roles:
        evidence_id = dims.get(role)
        if evidence_id is None:
            continue
        try:
            return base.get(evidence_id).value
        except Exception:                                   # noqa: BLE001
            continue
    return None


def _is_count_driven(quantity, element) -> bool:
    """A count-driven item is timesed by the element count. That is when the
    clause enumerates (unit nr) or when the only dimension the element carries
    IS its count."""
    if quantity.unit == "nr":
        return True
    roles = set(element.dims or {})
    return bool(roles) and roles == {"count"}


def _times(quantity, element, squared: Decimal, dims: tuple) -> int:
    """The Nr column must make the line's own arithmetic true: nr x L x W x H
    = squared. When the clause's formula timesed by the schedule count
    (N x L x W x T), the count IS the nr — a line reading "1 x 3.6 x 0.45 x
    1.7 = 5.508" is a dimension paper that does not add up, and that is what
    the first real structural take-off showed. So the count is used when it
    reconciles the stated dimensions to the squared figure; 1 when the
    dimensions alone do; and the enumeration rule when there are no
    dimensions to check against."""
    present = [d for d in dims if d is not None]
    count = int(element.count) if element.count else 1
    if present:
        product = Decimal(1)
        for d in present:
            product *= Decimal(str(d))
        if count > 1 and product * count == squared:
            return count
        if product == squared:
            return 1
        # neither reconciles exactly (a deduction, a multiplier): fall through
    if _is_count_driven(quantity, element) or "count" in (element.dims or {}):
        return count
    return 1


def _drawing_ref(quantity, element, base) -> str:
    for evidence_id in quantity.evidence_ids:
        try:
            return base.get(evidence_id).doc_id
        except Exception:                                   # noqa: BLE001
            continue
    if element.sheets:
        return element.sheets[0]
    return ""


def measured_rows(quantity, element, base, code: str) -> list[DimensionRow]:
    """A measured element's dimension paper: one row per line, in the order
    the lines were taken - the gross run, then what is added back, then each
    deduction as its own negative row (GP3.2/GP3.3), never netted. The rows
    sum to the quantity exactly; the rollup checks that."""
    out = []
    for line in element.lines:
        values = {role: Decimal(base.get(eid).value) for role, eid in line.dims.items()}
        product = Decimal(line.nr)
        for v in values.values():
            product *= v
        origin = base.weakest_origin(sorted(line.dims.values()))
        out.append(DimensionRow(
            item_code=code, times=int(line.nr),
            length=values.get("length"), width=values.get("width"),
            height=values.get("height"),
            squared=-product if line.deduct else product,
            unit=quantity.unit, drawing_ref=line.doc_id, level=line.level,
            location=None, evidence_ids=tuple(sorted(line.dims.values())),
            method=_METHOD_BY_ORIGIN.get(origin, "measured to scale")))
    return out


def rows_for(quantity, element, base, item_code: str | None = None,
             sheets: dict | None = None) -> list[DimensionRow]:
    """One quantity may be several dimension sets — a wall measured in three
    runs is three rows and one rollup, and collapsing it to one row loses the
    check. In this build one element is one dimension set, so one row.

    The level column: the storey the schedule row itself states
    (element.location, "Pod 1") when the element carries one — that is the
    row's own words and beats anything read off the sheet. Otherwise `sheets`,
    an optional doc_id -> SheetRecord map, supplies the sheet's subtitle (the
    floor). The grid-reference column is the element's bay when a plan
    measurement set one.

    Nothing here rounds. `squared` is the quantity's own Decimal."""
    code = item_code or provisional_code(quantity)
    if getattr(element, "lines", ()):
        return measured_rows(quantity, element, base, code)
    squared = Decimal(quantity.value)
    length = _dimension(element, base, _LENGTH_ROLES)
    width = _dimension(element, base, _WIDTH_ROLES)
    height = _dimension(element, base, _HEIGHT_ROLES)
    times = _times(quantity, element, squared, (length, width, height))

    doc_id = _drawing_ref(quantity, element, base)
    level = getattr(element, "location", None) or None
    if level is None and sheets and doc_id in sheets:
        level = getattr(sheets[doc_id], "subtitle", None) or None

    row = DimensionRow(
        item_code=code,
        times=times,
        length=length,
        width=width,
        height=height,
        squared=squared,
        unit=quantity.unit,
        drawing_ref=doc_id,
        level=level,
        location=getattr(element, "bay", None) or None,
        evidence_ids=tuple(quantity.evidence_ids),
        method=_METHOD_BY_ORIGIN.get(quantity.origin, "measured to scale"),
    )
    rows = [row]
    rows.sort(key=lambda r: (r.item_code, r.drawing_ref, str(r.squared)))
    return rows


def main() -> int:
    ap = argparse.ArgumentParser(description="Build take-off dimension rows.")
    ap.add_argument("--quantities", required=True)
    ap.add_argument("--out", required=True)
    args = ap.parse_args()
    try:
        data = json.loads(Path(args.quantities).read_text())
    except (OSError, json.JSONDecodeError) as exc:
        print(f"ERROR: quantities unreadable: {exc}", file=sys.stderr)
        return 2
    rows = data.get("rows", [])
    print(f"{len(rows)} quantities read; rows are built by the take-off stage "
          f"from the evidence base, not from this file alone")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
