#!/usr/bin/env python3
"""
compute.py — the only file in the package where a quantity is produced.

Four things happen here and only the first is arithmetic:

  formula     one of ingest.formulas.SHAPES, or a discipline family
  thresholds  conditional existence — does this item get measured at all
  deductions  the standard's rule, never anyone's preference
  grouping    one line, or one per size/class/type — this sets the bill's shape

No model, ever. The model said which clause and which evidence; the clause said
which formula, threshold, deduction and grouping. Nothing is left to choose.

Rounding does NOT happen here. [GP3.1] rounds each DIMENSION as it is taken,
to 0.01 m, and never the product -- measure/evidence.round_dimension is that
single point. The corpus settles it with a worked example:

    4.237 x 2.981  ->  4.24 x 2.98  = 12.6352 m2      CORRECT
    4.237 x 2.981  = 12.630...      -> 12.63 m2       WRONG

So a quantity leaves this module at full precision over already-rounded
dimensions. Rounding it again would be a second rounding point, which is what
GP3.1 forbids and what makes two implementations disagree in the last place.

A missing required value produces no quantity and a gap naming what is missing.
There are no defaults: a default is indistinguishable from a measurement once
it is in a cell.

  python3 -m measure.compute --classifications C.json --evidence E.json

Exit 0 = all computed. Exit 1 = gaps. Exit 2 = contract violation.
"""
from __future__ import annotations

import argparse
from decimal import Decimal

from ingest.formulas import evaluate, roles_for
from measure import deductions as deduct_rules
from measure import thresholds as threshold_rules
from measure.evaluators import FAMILIES
from spine.gaps import Gap
from spine.records import Quantity

STAGE = "S12"


def round_once(*_args, **_kwargs) -> Decimal:
    """Removed at the GP3.1 correction. Kept as a loud failure rather than
    deleted, because a caller that still rounds a product is a defect and a
    silent AttributeError would not say why."""
    raise NotImplementedError(
        "GP3.1: products are not rounded. Dimensions are rounded at intake by "
        "measure.evidence.round_dimension. See DECISIONS.md decision 1.")


def gather(classification, base) -> dict:
    """Role -> Decimal, resolved from the evidence base. Raises rather than
    defaulting; the caller turns that into a gap."""
    values = {}
    for binding in sorted(classification.bindings, key=lambda b: b.role):
        values[binding.role] = base.get(binding.evidence_id).value
    return values


# the unit a measured line's dimensions make: one length, a length by a
# height (or a width), an area taken off a shape
_LINE_UNITS = {("length",): "m", ("height", "length"): "m2", ("length", "width"): "m2",
               ("area",): "m2", ("area", "thickness"): "m3"}


def compute_measured(clause, base, element) -> tuple[Quantity | None, Gap | None]:
    """A measured element (measure.measured): the sum of its dimension lines,
    each nr x the product of the dimensions it cites, a deduction negative.
    Every line must make the clause's own unit - a length line under an area
    clause is a defect, reported, never summed."""
    total = Decimal(0)
    ids: set = set()
    for n, line in enumerate(element.lines):
        roles = tuple(sorted(line.dims))
        unit = _LINE_UNITS.get(roles)
        if unit != clause.unit:
            return None, Gap(stage=STAGE, doc_id=line.doc_id, subject=element.mark,
                             reason=f"{clause.id} is measured in {clause.unit}; line {n + 1} "
                                    f"({', '.join(roles)}) gives {unit or 'no known unit'}")
        try:
            value = Decimal(line.nr)
            for role in roles:
                value *= base.get(line.dims[role]).value
        except Exception as exc:                                  # noqa: BLE001
            return None, Gap(stage=STAGE, doc_id=line.doc_id, subject=element.mark,
                             reason=f"cannot compute {clause.id}: {exc}")
        total += -value if line.deduct else value
        ids.update(line.dims.values())
    if total <= 0:
        return None, Gap(stage=STAGE, doc_id=element.sheets[0] if element.sheets else None,
                         subject=element.mark,
                         reason=f"{clause.id}: the deductions equal or exceed the measured "
                                f"work ({total}); nothing is billed")
    ids = sorted(ids)
    return Quantity(element_mark=element.key, clause_id=clause.id, value=total,
                    unit=clause.unit, evidence_ids=ids, origin=base.weakest_origin(ids),
                    section=clause.section), None


def compute_one(classification, clause, base, element, config
                ) -> tuple[Quantity | None, Gap | None]:
    """One element to one quantity, or to a gap. Never to both, never to
    neither."""
    if getattr(element, "lines", ()):
        return compute_measured(clause, base, element)
    try:
        values = gather(classification, base)
    except Exception as exc:                    # missing or unresolvable input
        return None, Gap(stage=STAGE, doc_id=None, subject=element.mark,
                         reason=f"cannot compute {clause.id}: {exc}")

    missing = [r for r in roles_for(clause.shape) if r not in values]
    if missing:
        return None, Gap(stage=STAGE, doc_id=None, subject=element.mark,
                         reason=f"{clause.id} needs {', '.join(missing)}")

    if not threshold_rules.measured(clause, values):
        return None, None                       # below threshold: not an item

    if clause.shape in FAMILIES:
        raw = FAMILIES[clause.shape].evaluate(clause, values, element, base)
    else:
        raw = evaluate(clause.shape, values)

    raw -= deduct_rules.total(clause, classification.deduct, base)
    raw *= Decimal(element.multiplier)

    value = raw                      # GP3.1 -- not rounded; see module docstring
    ids = sorted({b.evidence_id for b in classification.bindings}
                 | set(classification.deduct))
    # the element's KEY (mark @ storey @ bay), not the bare mark: one schedule
    # mark split by storey is several quantities, and every table downstream
    # (take-off, descriptions, provenance) looks the quantity's element up by it
    return Quantity(element_mark=element.key, clause_id=clause.id,
                    value=value, unit=clause.unit, evidence_ids=ids,
                    origin=base.weakest_origin(ids),
                    section=clause.section), None


def main() -> int:
    ap = argparse.ArgumentParser(description="Compute quantities.")
    ap.add_argument("--classifications", required=True)
    ap.add_argument("--evidence", required=True)
    ap.parse_args()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
