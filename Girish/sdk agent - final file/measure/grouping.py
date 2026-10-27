#!/usr/bin/env python3
"""
grouping.py — one line, or one line per size. This decides the bill's shape.

Two elements measured identically can produce one bill line or six, and the
clause decides which. Grouping is not cosmetic: a bill that groups where the
standard separates hides a size the contractor needs to price, and one that
separates where the standard groups produces six lines a checker has to
reconcile by hand.

The grouping attributes come from the clause table. This file only applies
them, and it sorts on them, so two runs that reach the same quantities produce
lines in the same order — which is what makes two bills diffable.

It also produces the block/variant structure that descriptions consume: the
first member of a group carries the full description, the rest inherit it. That
is the dominant shape in the reference BOQ and it is decided here, not in the
renderer.

  python3 -m measure.grouping --quantities Q.json

Exit 0 always.
"""
from __future__ import annotations

import argparse
from dataclasses import dataclass
from decimal import Decimal


@dataclass(frozen=True)
class Group:
    clause_id: str
    section: str
    key: tuple                 # the grouping attribute values
    quantities: tuple
    unit: str

    @property
    def total(self) -> Decimal:
        return sum((q.value for q in self.quantities), Decimal(0))

    @property
    def lead(self):
        """The member that carries the full description; the rest are Ditto
        variants of it. Deterministically the first by key."""
        return self.quantities[0]


def group(quantities: list, clause_table) -> list[Group]:
    """Sorted by (section, clause_id, key) so line order is a property of the
    content, never of iteration order."""
    buckets: dict[tuple, list] = {}
    for quantity in quantities:
        clause = clause_table.get(quantity.clause_id)
        key = tuple(str(getattr(quantity, attr, "")) for attr in clause.grouping)
        buckets.setdefault((clause.section, clause.id, key), []).append(quantity)
    out = []
    for (section, clause_id, key) in sorted(buckets):
        members = sorted(buckets[(section, clause_id, key)],
                         key=lambda q: q.element_mark)
        out.append(Group(clause_id=clause_id, section=section, key=key,
                         quantities=tuple(members),
                         unit=clause_table.get(clause_id).unit))
    return out


def main() -> int:
    ap = argparse.ArgumentParser(description="Group quantities into bill lines.")
    ap.add_argument("--quantities", required=True)
    ap.parse_args()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
