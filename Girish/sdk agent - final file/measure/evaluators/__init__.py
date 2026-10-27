#!/usr/bin/env python3
"""
evaluators — the arithmetic that a formula shape cannot express.

Most clauses need no evaluator. 168 of the 210 with a formula are a plain sum,
and 42 more are a product of named roles; both are handled by
ingest.formulas.evaluate and never reach this package.

What lives here is the residue: shapes with a non-linear step (girth, circular
section), and two disciplines whose measurement is a set of rules rather than
an expression — reinforcement and MEP risers. Those two are families, not
formulas, and they are scoped separately because both are places where
measurement commonly goes wrong. The client's own first attempt had MEP risers
wrong in twelve places, including measuring ductwork in the wrong unit.

Every evaluator takes (clause, values, element, base) and returns an unrounded
Decimal. None of them round; compute.round_once is the single rounding point.

FAMILIES is keyed by formula shape, so the clause table selects an evaluator
the same way it selects a formula — by data, never by an if-branch in compute.
"""
from __future__ import annotations

from measure.evaluators import (area, circular, count, girth, linear,
                                       mep_risers, reinforcement)

FAMILIES = {
    "girth_then_length": girth.EVALUATOR,
    "circular_volume": circular.EVALUATOR,
    "reinforcement": reinforcement.EVALUATOR,
    "mep_riser": mep_risers.EVALUATOR,
}

SIMPLE = {
    "linear": linear.EVALUATOR,
    "area": area.EVALUATOR,
    "count": count.EVALUATOR,
}

__all__ = ["FAMILIES", "SIMPLE", "area", "circular", "count", "girth",
           "linear", "mep_risers", "reinforcement"]
