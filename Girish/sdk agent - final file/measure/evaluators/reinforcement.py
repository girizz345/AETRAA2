#!/usr/bin/env python3
"""
reinforcement.py — rebar by net weight, and the lap that must come off.

This is a family rather than a formula because the arithmetic is the easy half.
The rules are:

  * C3.1 — measured by NET weight, meaning no addition for rolling margin,
    supports, spacers or tying wire. LAPS ARE NOT ON THAT EXCLUSION LIST, and
    the clause formula is explicit:
        W = Sum (N_bars x L_bar_INCLUDING_LAPS x m_per_m(diameter))
    So the lapped length IS measured. This is the opposite of the intuition
    that "net weight" means stripping laps out, and it is the direction that
    costs money: removing the laps under-measures every lapped bar in the bill.
  * C3.2 — bars of differing diameter are given separately. Not summed into one
    tonnage; a 10mm bar and a 32mm bar price differently.
  * C3.3 — FABRIC is measured by area with NO addition for laps. Fabric is the
    clause that excludes laps; bar is not. Confusing the two is the common
    error, which is why both live in this file where the difference is visible.

The consequence for evidence: the bar bending schedule already carries the
lapped length, because a schedule is a cutting list. For C3.1 that is the
correct figure and it is used as it stands — no lap deduction, no percentage
adjustment. Where a schedule states a lap separately it is ADDED if it is not
already in the stated length, and where it is unclear which the schedule states,
the item is a gap rather than an assumption in either direction.

Mass per metre comes from the ingested bar table, keyed by diameter. It is data
because bar mass is a standard's figure and standards get revised.
"""
from __future__ import annotations

from decimal import Decimal
from typing import Mapping

from spine.errors import UnevidencedQuantity

# kg per metre, by bar diameter in mm. Standard figures — ingested, not derived.
MASS_PER_M: dict[int, Decimal] = {
    8: Decimal("0.395"), 10: Decimal("0.617"), 12: Decimal("0.888"),
    16: Decimal("1.579"), 20: Decimal("2.466"), 25: Decimal("3.854"),
    32: Decimal("6.313"), 40: Decimal("9.864"),
}

# C3.1's exclusion list, verbatim in effect. Laps are deliberately absent.
EXCLUDED_FROM_WEIGHT = ("rolling margin", "supports", "spacers", "tying wire",
                        "chairs")
LAPS_INCLUDED_IN_BAR_WEIGHT = True     # C3.1
LAPS_EXCLUDED_FROM_FABRIC = True       # C3.3


class ReinforcementEvaluator:
    name = "reinforcement"
    roles = ("diameter", "length", "count")

    def mass_per_m(self, diameter_mm: int) -> Decimal:
        if diameter_mm not in MASS_PER_M:
            raise KeyError(f"no mass per metre for {diameter_mm}mm bar")
        return MASS_PER_M[diameter_mm]

    def measured_length(self, values: Mapping[str, Decimal]) -> Decimal:
        """C3.1 length, laps included.

        A bar bending schedule normally states the cut length, which already
        contains the lap — that figure is used unchanged. Where a schedule
        states the lap as a separate column, it is added, because the stated
        length in that layout is the member length rather than the cut length.
        `lap_in_length` says which layout this schedule uses; where it is not
        known the item is a gap, since adding or not adding changes the weight
        and neither direction may be assumed."""
        length = Decimal(values["length"])
        if "lap_length" not in values:
            return length                      # cut length: lap already in it
        if "lap_in_length" not in values:
            raise UnevidencedQuantity(
                "schedule states a lap column but does not say whether the "
                "stated length already includes it; C3.1 measures the lapped "
                "length and the two layouts differ")
        if Decimal(values["lap_in_length"]) == 1:
            return length
        return length + Decimal(values["lap_length"])

    def evaluate(self, clause, values: Mapping[str, Decimal], element, base
                 ) -> Decimal:
        """kg. Bars of one diameter only — the clause table groups by diameter,
        so a mixed element arrives here already split."""
        diameter = int(values["diameter"])
        count = Decimal(values.get("count", 1))
        return count * self.measured_length(values) * self.mass_per_m(diameter)


class FabricEvaluator:
    """Mesh fabric: measured by area, no addition for laps. Kept beside bar
    because the two are billed under the same section and confusing them is the
    common error."""
    name = "reinforcement_fabric"
    roles = ("area",)

    def evaluate(self, clause, values: Mapping[str, Decimal], element, base
                 ) -> Decimal:
        return Decimal(values["area"])


EVALUATOR = ReinforcementEvaluator()
FABRIC = FabricEvaluator()
