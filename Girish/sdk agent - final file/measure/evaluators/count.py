#!/usr/bin/env python3
"""
count.py — items measured by number.

Trivial arithmetic, and the family with the strictest evidence rule. A count
must come from a schedule cell (STATED) or a symbol cluster (COUNTED). It may
never be INFERRED, because an inferred count is a guess wearing an integer, and
an integer is the most trusted-looking thing in a bill.

Where a schedule count and a plan tag count disagree, inventory has already
reported the discrepancy; this evaluator uses the schedule and records which
source it took, so the provenance sheet shows the choice rather than hiding it.
"""
from __future__ import annotations

from decimal import Decimal
from typing import Mapping

from spine.errors import UnevidencedQuantity
from spine.records import Origin


class CountEvaluator:
    name = "count"
    roles = ("count",)

    def evaluate(self, clause, values: Mapping[str, Decimal], element, base
                 ) -> Decimal:
        for evidence_id in sorted(element.evidence_ids):
            record = base.get(evidence_id)
            if record.unit == "nr" and record.origin is Origin.INFERRED:
                raise UnevidencedQuantity(
                    f"{clause.id}: count for {element.mark} is inferred; "
                    "a count must be stated or counted")
        return Decimal(values["count"])


EVALUATOR = CountEvaluator()
