#!/usr/bin/env python3
"""
area.py — items measured by area.

Net contact area is the POMI position for formwork, and it is where the
separation from concrete matters: the concrete clause and the formwork clause
measure the same physical pour and produce different numbers, because formwork
is the area actually in contact and concrete is the volume placed. Measuring
formwork as the sum of an element's faces over-measures every abutment.

Openings are deducted per the clause's own rule, applied in measure.deductions,
not here.

No rounding here.
"""
from __future__ import annotations

from decimal import Decimal
from typing import Mapping


class AreaEvaluator:
    name = "area"
    roles = ("length", "height")

    def evaluate(self, clause, values: Mapping[str, Decimal], element, base
                 ) -> Decimal:
        if "area" in values:
            return Decimal(values["area"])
        length = Decimal(values["length"])
        other = values.get("height", values.get("width"))
        if other is None:
            raise KeyError(f"{clause.id}: area needs height or width")
        return length * Decimal(other)


EVALUATOR = AreaEvaluator()
