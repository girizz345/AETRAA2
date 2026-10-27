#!/usr/bin/env python3
"""
mep_risers.py — services measured to their own rules.

Scoped as its own family for an empirical reason: the client's first attempt at
this had twelve errors in it, including ductwork measured in the wrong unit.
That is not a formula problem, it is a units-and-grouping problem, and it needs
a table rather than an expression.

Three rules that a general evaluator gets wrong:

  * unit by service type, not by shape. Pipework is linear (m) by diameter.
    Ductwork is by surface area (m2) — measuring a rectangular duct as a length
    is the twelve-errors mistake. Cable containment is linear by size.
  * fittings are enumerated separately where the clause says so, and are NOT
    absorbed into the run length. Bends, tees and reducers price differently
    from straight run.
  * a riser is measured floor to floor from stated levels, not scaled. Under
    v3.1 there is no other option anyway, and where the levels are not stated
    the riser is a gap.

SERVICE_UNITS is the table. A service type absent from it is refused rather
than defaulted to linear, because defaulting to linear is precisely the failure
this file exists to prevent.
"""
from __future__ import annotations

from decimal import Decimal
from typing import Mapping

from spine.errors import UnknownClause

# service type -> (unit, roles required)
SERVICE_UNITS: dict[str, tuple[str, tuple]] = {
    "pipework":          ("m",  ("length",)),
    "ductwork":          ("m2", ("girth", "length")),
    "cable_tray":        ("m",  ("length",)),
    "cable_ladder":      ("m",  ("length",)),
    "trunking":          ("m",  ("length",)),
    "conduit":           ("m",  ("length",)),
    "insulation_pipe":   ("m",  ("length",)),
    "insulation_duct":   ("m2", ("girth", "length")),
}

ENUMERATED_SEPARATELY = ("bend", "tee", "reducer", "damper", "valve",
                         "flexible connection", "access panel")


class MepRiserEvaluator:
    name = "mep_riser"

    def unit_for(self, service_type: str) -> str:
        if service_type not in SERVICE_UNITS:
            raise UnknownClause(
                f"no measurement rule for service type {service_type!r}; "
                "refusing rather than defaulting to linear")
        return SERVICE_UNITS[service_type][0]

    def riser_length(self, values: Mapping[str, Decimal]) -> Decimal:
        """Floor to floor from stated levels. Subtraction, not scaling."""
        if "level_top" not in values or "level_bottom" not in values:
            raise KeyError("riser needs stated top and bottom levels")
        return Decimal(values["level_top"]) - Decimal(values["level_bottom"])

    def evaluate(self, clause, values: Mapping[str, Decimal], element, base
                 ) -> Decimal:
        service_type = str(element.element_type)
        unit = self.unit_for(service_type)
        length = (values["length"] if "length" in values
                  else self.riser_length(values))
        if unit == "m2":
            return Decimal(values["girth"]) * Decimal(length)
        return Decimal(length)


EVALUATOR = MepRiserEvaluator()
