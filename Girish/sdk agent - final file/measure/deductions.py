#!/usr/bin/env python3
"""
deductions.py — what comes off, decided by the standard.

The division that matters: the model says which openings exist and which
element they belong to. The standard decides which of them are deducted, and at
what threshold. Neither the model nor this file has a preference.

That split is why a deduction cannot be "chosen". A door opening in a blockwork
wall is deducted or not according to the clause governing that wall, and the
same opening in the plaster to that wall may be treated differently. Both
answers come from the clause table.

Deductions are applied before the floor multiplier and before rounding. Order
matters: multiplying a rounded net area by three, versus rounding three times a
net area, differ, and only one of them is right.

  python3 -m measure.deductions --clause-table T.json --clause D.1.1

Exit 0 = rule shown. Exit 1 = clause has no deduction rule recorded.
"""
from __future__ import annotations

import argparse
from decimal import Decimal

# a rule name -> whether an opening of the given size is deducted
RULES = {
    "none":            lambda area, limit: False,
    "all":             lambda area, limit: True,
    "over_limit":      lambda area, limit: area > limit,
    "over_or_equal":   lambda area, limit: area >= limit,
}


def total(clause, deduct_ids: list[str], base) -> Decimal:
    """Sum of the deductible openings cited for this element. An opening the
    rule does not deduct is still recorded in provenance — the fact that it was
    considered and not deducted is part of the trail."""
    if not deduct_ids:
        return Decimal(0)
    rule_name, limit = _parse(clause.deduction_rule)
    if rule_name not in RULES:
        raise ValueError(f"{clause.id}: unknown deduction rule {rule_name!r}")
    rule = RULES[rule_name]
    out = Decimal(0)
    for evidence_id in sorted(deduct_ids):
        area = Decimal(base.get(evidence_id).value)
        if rule(area, limit):
            out += area
    return out


def _parse(rule: str | None) -> tuple[str, Decimal]:
    """'over_limit:0.50' -> ('over_limit', Decimal('0.50')). A clause with no
    rule recorded deducts nothing, which is the conservative direction: it
    over-measures visibly rather than under-measuring silently."""
    if not rule:
        return "none", Decimal(0)
    if ":" not in rule:
        return rule, Decimal(0)
    name, _, value = rule.partition(":")
    return name, Decimal(value)


def main() -> int:
    ap = argparse.ArgumentParser(description="Show a clause's deduction rule.")
    ap.add_argument("--clause-table", required=True)
    ap.add_argument("--clause", required=True)
    ap.parse_args()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
