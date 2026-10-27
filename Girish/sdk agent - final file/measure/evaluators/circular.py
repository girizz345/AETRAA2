#!/usr/bin/env python3
"""
circular.py — volume of a circular section: (pi/4) x diameter^2 x length.

Separate because of pi. Every other evaluator in this package is exact decimal
arithmetic, and this one is not: pi is irrational, so the result depends on how
many digits are carried. Carrying a float here and Decimals everywhere else is
how two runs of the same inputs disagree in the last place.

So pi is a fixed Decimal literal at a stated precision, declared once, and the
whole calculation stays in Decimal. Changing PI is a visible change to a
constant, not a library upgrade.
"""
from __future__ import annotations

from decimal import Decimal
from typing import Mapping

# 30 significant figures. Fixed, not math.pi, so the arithmetic is reproducible.
PI = Decimal("3.14159265358979323846264338328")


class CircularEvaluator:
    name = "circular_volume"
    roles = ("diameter", "length")

    def evaluate(self, clause, values: Mapping[str, Decimal], element, base
                 ) -> Decimal:
        diameter = Decimal(values["diameter"])
        return (PI / Decimal(4)) * diameter * diameter * Decimal(values["length"])


EVALUATOR = CircularEvaluator()
