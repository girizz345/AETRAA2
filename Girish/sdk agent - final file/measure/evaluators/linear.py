#!/usr/bin/env python3
"""
linear.py — items measured by length.

The simplest family, and the one whose errors are quietest. Two rules that are
easy to omit and change the answer:

  * lengths are measured along the centre line unless the clause says the face.
    Which it is comes from the clause, and where the clause is silent the item
    is a gap rather than an assumption.
  * a run interrupted by an opening is still one item unless the clause
    separates it. Splitting a continuous run into segments and summing them
    gives the same number; splitting it into separate bill *lines* does not.

No rounding here.
"""
from __future__ import annotations

from decimal import Decimal
from typing import Mapping


class LinearEvaluator:
    name = "linear"
    roles = ("length",)

    def evaluate(self, clause, values: Mapping[str, Decimal], element, base
                 ) -> Decimal:
        return Decimal(values["length"]) * Decimal(values.get("count", 1))


EVALUATOR = LinearEvaluator()
