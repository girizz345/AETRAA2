#!/usr/bin/env python3
"""
girth.py — girth = 2 x (w + d), then length x girth.

Kept separate from the general product shapes because the intermediate is a
sum, and a sum inside a product is where a "just multiply the roles" evaluator
quietly gives the wrong answer. Used for items measured around a section —
casings, linings, wrappings to beams and columns.

The two-step is explicit: girth first, then the multiplication. Neither step
rounds, so the intermediate keeps full precision and the single rounding at the
end is the only place a value loses digits.
"""
from __future__ import annotations

from decimal import Decimal
from typing import Mapping


class GirthEvaluator:
    name = "girth_then_length"
    roles = ("width", "depth", "length")

    def girth(self, width: Decimal, depth: Decimal) -> Decimal:
        return Decimal(2) * (Decimal(width) + Decimal(depth))

    def evaluate(self, clause, values: Mapping[str, Decimal], element, base
                 ) -> Decimal:
        return self.girth(values["width"], values["depth"]) * Decimal(values["length"])


EVALUATOR = GirthEvaluator()
