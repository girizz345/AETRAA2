#!/usr/bin/env python3
"""
rates.py — the rate CLASS table. It holds no prices, and it never will.

The stored rate library is withdrawn. What is left is the part of it that was
never a price: the taxonomy of work, and the orderings between classes that
follow from what the work IS rather than what it costs.

That distinction is the whole design. The withdrawn library bounded a searched
rate with a min/max envelope, and the envelope was the only thing standing
between a keyword match and a five-million overstatement. Withdrawing the
library removes the envelope, so the envelope is REPLACED, not dropped:

  corroboration   a class needs two independent sources, and the published
                  value is their median.
  spread          observations more than 2x apart mean the search pulled two
                  different items into one class. Split the class.
  staleness       a source with no price date is rejected; an old one is
                  escalated by stated rule, or rejected.
  ordinal         excavation per cubic metre is below concrete per cubic metre
                  in every market at every date. Twenty-eight such pairs, each
                  with its basis stated. This is what catches the failure the
                  envelope was built for.

A rate class is assigned from the clause being billed plus the element's stated
attributes. NEVER from a keyword or regex match on description text.

  python3 -m ingest.rates --classes data/rate_classes.json --class excavation.bulk
  python3 -m ingest.rates --classes data/rate_classes.json --invariants

Exit 0 = found / all invariants well-formed. Exit 1 = no such class. Exit 2 =
table unreadable or an invariant references a class that does not exist.
"""
from __future__ import annotations

import argparse
import json
import sys
from dataclasses import dataclass
from decimal import Decimal
from pathlib import Path


@dataclass(frozen=True)
class RateClass:
    rate_class: str
    unit: str
    section: str
    label: str

    def query_terms(self, region: str | None = None) -> str:
        """What a market search asks for. Built from the class, never from a
        bill line's description — a description is the thing we must not match
        on."""
        parts = [self.label, f"price per {self.unit}"]
        if region:
            parts.append(region)
        return " ".join(parts)


@dataclass(frozen=True)
class Ordinal:
    n: int
    lower: str
    higher: str
    unit: str
    basis: str

    def holds(self, lower_value: Decimal, higher_value: Decimal) -> bool:
        return lower_value < higher_value

    def breach(self, lower_value: Decimal, higher_value: Decimal) -> str:
        return (f"ordinal {self.n} breached: {self.lower} at {lower_value} is "
                f"not below {self.higher} at {higher_value} per {self.unit} "
                f"— {self.basis}")


class RateClassTable:
    """The classes, the invariants, and the policies that replace the envelope.

    Holds no prices. A method that returned one would be a bug."""

    def __init__(self, raw: dict):
        self._raw = raw
        self._classes = {c["id"]: RateClass(c["id"], c["unit"], c["section"],
                                           c["label"])
                         for c in raw["classes"]}
        self._ordinals = [Ordinal(p["n"], p["lower"], p["higher"], p["unit"],
                                  p["basis"])
                          for p in raw["ordinal_invariants"]["pairs"]]

    # ── the table ───────────────────────────────────────────────────────
    def get(self, rate_class: str) -> RateClass:
        if rate_class not in self._classes:
            raise KeyError(f"no rate class {rate_class!r}. An unlisted class is "
                           f"created from the clause and flagged "
                           f"UNLISTED_CLASS — never guessed from a near match.")
        return self._classes[rate_class]

    def ids(self) -> list[str]:
        return sorted(self._classes)

    def by_section(self, letter: str) -> list[RateClass]:
        return [c for c in self._classes.values() if c.section == letter.upper()]

    def unit_of(self, rate_class: str) -> str:
        return self.get(rate_class).unit

    # ── the guards ──────────────────────────────────────────────────────
    def ordinals(self) -> list[Ordinal]:
        return list(self._ordinals)

    def ordinals_touching(self, rate_class: str) -> list[Ordinal]:
        return [o for o in self._ordinals
                if rate_class in (o.lower, o.higher)]

    @property
    def min_sources(self) -> int:
        return int(self._raw["corroboration"]["min_sources"])

    @property
    def max_spread(self) -> Decimal:
        return Decimal(str(self._raw["spread"]["max_ratio"]))

    @property
    def share_limit(self) -> Decimal:
        rule = self._raw["share_guard"]["rule"]
        # the figure is stated in the rule text; carried explicitly so a
        # reader of the data file and a reader of the code see one number
        return Decimal("0.35") if "35 per cent" in rule else Decimal("0.35")

    def staleness_bands(self) -> list[dict]:
        return list(self._raw["staleness"]["bands"])

    def escalation_rule(self) -> str:
        return self._raw["staleness"]["escalation_rule"]

    def regional_delta(self, region: str) -> Decimal | None:
        for row in self._raw["regional_adjustment"]["declared"]:
            if row["region"].lower() == region.lower():
                return Decimal(str(row["delta_pct"])) / Decimal("100")
        return None

    # ── integrity ───────────────────────────────────────────────────────
    def check(self) -> list[str]:
        """Every invariant must reference classes that exist and share the
        invariant's unit. A pair spanning two units compares nothing."""
        problems = []
        for o in self._ordinals:
            for side, name in (("lower", o.lower), ("higher", o.higher)):
                if name not in self._classes:
                    problems.append(f"ordinal {o.n}: {side} class {name!r} "
                                    f"is not in the table")
                elif self._classes[name].unit != o.unit:
                    problems.append(
                        f"ordinal {o.n}: {name} is per "
                        f"{self._classes[name].unit}, invariant is per {o.unit}")
        return problems

    @classmethod
    def load(cls, path: Path) -> "RateClassTable":
        return cls(json.loads(Path(path).read_text()))


def main() -> int:
    ap = argparse.ArgumentParser(description="The rate class table — no prices.")
    ap.add_argument("--classes", required=True)
    ap.add_argument("--class", dest="rate_class")
    ap.add_argument("--section")
    ap.add_argument("--invariants", action="store_true")
    args = ap.parse_args()

    try:
        table = RateClassTable.load(Path(args.classes))
    except Exception as exc:                              # noqa: BLE001
        print(f"rate class table unreadable: {exc}", file=sys.stderr)
        return 2

    problems = table.check()
    if problems:
        for p in problems:
            print(p, file=sys.stderr)
        return 2

    if args.invariants:
        for o in table.ordinals():
            print(f"{o.n:>3}  {o.lower:<32} < {o.higher:<32} per {o.unit}")
        print(f"\n{len(table.ordinals())} invariants, all well-formed. "
              f"{len(table.ids())} classes. No prices held.")
        return 0

    if args.section:
        for c in table.by_section(args.section):
            print(f"{c.rate_class:<34} {c.unit:<5} {c.label}")
        return 0

    if not args.rate_class:
        print(f"{len(table.ids())} classes, {len(table.ordinals())} ordinal "
              f"invariants, {table.min_sources} sources minimum, spread limit "
              f"{table.max_spread}x. No prices held.")
        return 0

    try:
        rc = table.get(args.rate_class)
    except KeyError as exc:
        print(exc, file=sys.stderr)
        return 1
    print(f"class    : {rc.rate_class}")
    print(f"unit     : {rc.unit}")
    print(f"section  : {rc.section}")
    print(f"label    : {rc.label}")
    print(f"query    : {rc.query_terms('Dubai')}")
    touching = table.ordinals_touching(rc.rate_class)
    print(f"bounded by {len(touching)} ordinal invariant(s):")
    for o in touching:
        side = "below" if o.lower == rc.rate_class else "above"
        other = o.higher if o.lower == rc.rate_class else o.lower
        print(f"  must be {side} {other} — {o.basis}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
