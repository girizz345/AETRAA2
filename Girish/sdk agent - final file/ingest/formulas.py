#!/usr/bin/env python3
"""
formulas.py — the operation grammar. 42 shapes and a default.

Measured off the corpus: 314 clauses, 210 carrying a formula, of which 168 are
a plain sum (L = ΣL, N = count, A = ΣA) and 42 need arithmetic beyond it. So
this file is small on purpose — the work is not the formulas, it is the
threshold conditionals and deduction rules that sit beside them, and those live
in measure/thresholds.py and measure/deductions.py.

Roles are named, not positional. There is no eval(): a new shape is a reviewed
addition to SHAPES, not an expression evaluated at runtime. A clause whose
formula is not in this table is a hard failure, not a guess.

  python3 -m ingest.formulas            # print the grammar

Exit 0 always.
"""
from __future__ import annotations

import argparse
from decimal import Decimal
from typing import Callable, Mapping

# sum_volume and sum_mass were added when the clause table was first loaded
# through this grammar rather than read as raw JSON. Clauses state "V = Σ V"
# (volumes from soundings) and "W = Σ W_grout" (grout injected by weight), and
# neither is expressible as any multiplicative shape — mapping them to one would
# have been an invented formula. Added as reviewed shapes, which is what this
# table is for. Note that sum_mass is an accumulation of WEIGHTS, distinct from
# sum_n_l_mass which converts a LENGTH to a weight through GP5.4.

# shape name -> required roles, in multiplication order
SHAPES: dict[str, list[str]] = {
    # the 168 — plain accumulation
    "sum_length":            ["length"],
    "sum_area":              ["area"],
    "sum_volume":            ["volume"],
    "sum_mass":              ["mass"],
    "count":                 ["count"],
    # the 42 — multiplicative shapes observed in the corpus
    "l_x_w":                 ["length", "width"],
    "l_x_h":                 ["length", "height"],
    "l_x_w_x_d":             ["length", "width", "depth"],
    "n_x_l_x_w_x_d":         ["count", "length", "width", "depth"],
    "n_x_l_x_w_x_t":         ["count", "length", "width", "thickness"],
    "a_x_t":                 ["area", "thickness"],
    "a_x_d":                 ["area", "depth"],
    "n_x_a":                 ["count", "area"],
    "n_x_l":                 ["count", "length"],
    "l_over_cos":            ["length", "width", "angle"],      # L×(W/cos θ)
    "sum_n_l_mass":          ["count", "length", "mass_per_m"],  # Σ N×L×m/m
    "circular_volume":       ["diameter", "length"],             # Σ (π/4)Ø²L
    "girth_then_length":     ["width", "depth", "length"],       # 2(w+d)×L
}

DEFAULT_SHAPE = "sum_length"

# unit each shape may legally produce — checked against the clause's own unit
SHAPE_UNITS: dict[str, tuple[str, ...]] = {
    "sum_length": ("m",), "sum_area": ("m2",), "sum_volume": ("m3",),
    "sum_mass": ("kg", "tonne"), "count": ("nr",),
    "l_x_w": ("m2",), "l_x_h": ("m2",), "l_x_w_x_d": ("m3",),
    "n_x_l_x_w_x_d": ("m3",), "n_x_l_x_w_x_t": ("m3",),
    "a_x_t": ("m3",), "a_x_d": ("m3",), "n_x_a": ("m2",), "n_x_l": ("m",),
    "l_over_cos": ("m2",), "sum_n_l_mass": ("kg", "t"),
    "circular_volume": ("m3",), "girth_then_length": ("m2",),
}


def roles_for(shape: str) -> list[str]:
    if shape not in SHAPES:
        raise KeyError(f"unknown formula shape: {shape}")
    return list(SHAPES[shape])


def evaluate(shape: str, values: Mapping[str, Decimal]) -> Decimal:
    """Pure arithmetic. No rounding — measure.compute rounds once, at the end.
    Missing role is a KeyError by design: a default here would be a number
    with nothing behind it."""
    fn: Callable[[Mapping[str, Decimal]], Decimal] = _IMPL[shape]
    return fn(values)


def _product(values: Mapping[str, Decimal], roles: list[str]) -> Decimal:
    out = Decimal(1)
    for role in roles:
        out *= Decimal(values[role])
    return out


_IMPL: dict[str, Callable[[Mapping[str, Decimal]], Decimal]] = {
    name: (lambda v, r=roles: _product(v, r)) for name, roles in SHAPES.items()
}


def main() -> int:
    ap = argparse.ArgumentParser(description="Print the formula grammar.")
    ap.parse_args()
    for name in sorted(SHAPES):
        units = "/".join(SHAPE_UNITS.get(name, ()))
        print(f"  {name:<20} {' × '.join(SHAPES[name]):<44} -> {units}")
    print(f"\n{len(SHAPES)} shapes, default {DEFAULT_SHAPE}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
