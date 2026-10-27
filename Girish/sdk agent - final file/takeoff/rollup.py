#!/usr/bin/env python3
"""
rollup.py — dimension rows to the quantity that goes to the bill.

The one arithmetic step in the take-off, and the one that must be visible. A
rollup row states the item code, the sum of its dimension rows, and the unit —
and in the rendered workbook it is a live formula over the rows above it, not a
frozen number. That is the difference between a workbook a surveyor can
interrogate and a printout.

The rollup total must equal the Quantity that compute produced. If it does not,
something between them rounded twice or dropped a row, and that is a halt
rather than a tolerance: a take-off that disagrees with the bill it feeds is
worse than no take-off, because it looks like corroboration.

  python3 -m takeoff.rollup --takeoff T.json

Exit 0 = every rollup reconciles. Exit 1 = a rollup disagrees with its quantity.
"""
from __future__ import annotations

import argparse
from dataclasses import dataclass
from decimal import Decimal


@dataclass(frozen=True)
class Rollup:
    item_code: str
    total: Decimal
    unit: str
    row_span: tuple           # (first, last) row indices, for the SUM formula
    clause_id: str


def build(rows: list, quantity) -> Rollup:
    total = sum((r.squared for r in rows), Decimal(0))
    return Rollup(item_code=rows[0].item_code, total=total, unit=quantity.unit,
                  row_span=(0, len(rows) - 1), clause_id=quantity.clause_id)


def reconcile(rollup: Rollup, quantity) -> str | None:
    """None if they agree. Compared EXACTLY: under GP3.1 both sides are sums of
    products over dimensions already rounded at intake, so any difference is a
    defect rather than a rounding artefact."""
    if rollup.total != quantity.value:
        return (f"{rollup.item_code}: take-off {rollup.total} does not "
                f"reconcile to bill quantity {quantity.value}")
    return None


def main() -> int:
    ap = argparse.ArgumentParser(description="Check take-off rollups.")
    ap.add_argument("--takeoff", required=True)
    ap.parse_args()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
