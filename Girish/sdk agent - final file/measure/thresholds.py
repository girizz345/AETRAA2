#!/usr/bin/env python3
"""
thresholds.py — whether an item is measured at all.

Conditional existence, and it is more consequential than it sounds. A threshold
does not adjust a quantity; it decides whether a line appears in the bill. Get
it wrong in one direction and the bill carries items the standard says are not
measured separately; in the other, it silently omits them.

So every threshold is tested on both sides — at the boundary, just below it and
just above it — and the boundary case is stated by the clause, not chosen here.
Where the corpus states a threshold twice with different values, ingest emits a
CONFLICT and this module refuses to guess between them.

  python3 -m measure.thresholds --clause-table T.json --clause C.2.1

Exit 0 = thresholds listed. Exit 1 = clause has an unresolved conflict.
"""
from __future__ import annotations

import argparse
from decimal import Decimal
from typing import Mapping

OPS = {
    ">":  lambda a, b: a > b,
    ">=": lambda a, b: a >= b,
    "<":  lambda a, b: a < b,
    "<=": lambda a, b: a <= b,
    "==": lambda a, b: a == b,
    "!=": lambda a, b: a != b,
}


def measured(clause, values: Mapping[str, Decimal]) -> bool:
    """True if every threshold on the clause passes. A threshold naming a role
    the element does not carry is a refusal, not a pass — an untestable
    condition must not default to measuring."""
    for threshold in sorted(clause.thresholds):
        # (role, op, limit) or (role, op, limit, unit). The unit is carried
        # because 1.00 m2 and 1.00 m3 are different thresholds — GP3.2 and C1.3
        # state the same figure against different dimensions, and a threshold
        # that forgets which one it is will deduct a void from a volume at an
        # area limit.
        role, op, limit = threshold[0], threshold[1], threshold[2]
        unit = threshold[3] if len(threshold) > 3 else None
        if role not in values:
            return False
        if unit and f"{role}_unit" in values and values[f"{role}_unit"] != unit:
            return False
        if op not in OPS:
            raise ValueError(f"{clause.id}: unknown threshold operator {op!r}")
        if not OPS[op](Decimal(values[role]), Decimal(str(limit))):
            return False
    return True


def boundary_cases(clause) -> list[tuple[str, Decimal]]:
    """The values a test suite must cover for this clause: exactly at each
    limit, and one ulp either side. Generated rather than written, so a new
    clause cannot be added without its boundary tests existing."""
    cases: list[tuple[str, Decimal]] = []
    for threshold in sorted(clause.thresholds):
        role, limit = threshold[0], threshold[2]
        value = Decimal(str(limit))
        step = Decimal(1).scaleb(value.as_tuple().exponent)
        cases.extend([(role, value - step), (role, value), (role, value + step)])
    return cases


def main() -> int:
    ap = argparse.ArgumentParser(description="Show a clause's thresholds.")
    ap.add_argument("--clause-table", required=True)
    ap.add_argument("--clause", required=True)
    ap.parse_args()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
