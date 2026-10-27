#!/usr/bin/env python3
"""
price.py — stage 18. The stage carrying the project's highest residual risk.

Quantities trace to drawings. Rates trace to a web search. That asymmetry is the
largest open exposure on the project, and until now the rate library's min/max
envelope was the only thing narrowing it.

THE LIBRARY IS WITHDRAWN. Rates are market rates, searched per class, cited per
row. So the flagging in this file is no longer a nicety around the envelope —
it IS the safety mechanism, and it is built from things that cannot go stale:

  G+.31  a rate's unit must be the row's unit, and the row's unit must be the
         one its item type allows.
  G+.32a two independent publishers per class; the median is the rate.
  G+.32b observations more than 2x apart mean the class holds two items.
  G+.32c a source with no price date is not a source; an old one escalates by
         stated rule or is rejected.
  G+.32d twenty-eight ordinal invariants. Excavation per cubic metre is below
         concrete per cubic metre in every market at every date. This is the
         test that catches what the envelope was built to catch.
  G+.32e no row may carry more than 35% of its section without a note.

The rules that do not change:
  * a rate is NEVER assigned by keyword match on description text. The class
    comes from the clause being billed plus the element's stated attributes.
    "Reinforced concrete" matching a rate for "concrete" is how a C50 slab gets
    a blinding rate.
  * where the project has its own priced document, it GOVERNS for matching
    items and the search is the fallback. Divergence beyond the threshold is
    flagged, never averaged away.
  * every priced row cites its source — publisher, url, price date. Invariant 7.
  * the target is a bid, so no uncertainty band is published. That is precisely
    why a flagged rate must surface as something a human clears.

Search is budgeted by distinct rate class, not by line: 400 lines across 60
classes costs 60 searches, cached per run.

  python3 -m bill.price --lines lines.json --classes ../data/rate_classes.json \\
      --units ../data/units.json --rates rates_found.json

Exit 0 = every row priced and every guard clean. Exit 1 = flags to clear.
Exit 2 = a guard failed outright (unit mismatch, ordinal breach) or a class is
a gap.
"""
from __future__ import annotations

import argparse
import json
import sys
from dataclasses import dataclass, field
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path

MONEY = Decimal("0.01")


@dataclass(frozen=True)
class BillLine:
    """What stage 13 produced, as far as pricing cares about it."""
    ref: str
    section: str
    rate_class: str
    unit: str
    quantity: Decimal
    item_type: str | None = None
    description: str | None = None       # carried for the bill, NEVER matched on


@dataclass(frozen=True)
class PricedRow:
    line: BillLine
    rate: Decimal | None
    amount: Decimal | None
    citation: str | None
    flags: tuple = field(default_factory=tuple)
    failures: tuple = field(default_factory=tuple)

    @property
    def is_gap(self) -> bool:
        return self.rate is None


def _unit_ok(line: BillLine, units: dict) -> str | None:
    """G+.31. Two tests, not one: the unit must exist, and it must be the unit
    the item type is allowed to carry."""
    allowed = set(units.get("units", ()))
    if line.unit not in allowed:
        return f"unit {line.unit!r} is not in the unit dictionary"
    if line.item_type:
        for row in units.get("classes", ()):
            if line.item_type in row["item_types"]:
                if row["unit"] != line.unit:
                    return (f"item type {line.item_type!r} bills in "
                            f"{row['unit']}, the row says {line.unit}")
                break
        else:
            return f"item type {line.item_type!r} is not in the unit dictionary"
    if line.quantity is None:
        return "quantity absent"
    if line.quantity < 0:
        return "negative quantity"
    return None


def price_line(line: BillLine, rates: dict, units: dict,
               project_rates: dict | None = None,
               divergence_threshold: float = 0.30) -> PricedRow:
    """One line, one rate, one citation. No keyword matching anywhere in here —
    the class arrives on the line, fixed upstream by the clause."""
    failures = []
    flags = []

    problem = _unit_ok(line, units)
    if problem:
        failures.append(f"G+.31 {problem}")

    market = rates.get(line.rate_class)
    if market is None:
        return PricedRow(line, None, None, None,
                         flags=("NO_RATE class is a gap, not a number",),
                         failures=tuple(failures))

    if market.unit != line.unit:
        failures.append(f"G+.31 rate for {line.rate_class} is per {market.unit}, "
                        f"the row is per {line.unit}")

    value = market.value
    citation = market.citation()
    flags.extend(market.flags)

    # the project's own priced document governs where it has the item
    own = (project_rates or {}).get(line.rate_class)
    if own is not None:
        own = Decimal(str(own))
        if own > 0:
            gap = abs(value - own) / own
            if gap > Decimal(str(divergence_threshold)):
                flags.append(f"DIVERGENCE searched {value} is {gap:.0%} from the "
                             f"project's own rate {own} — the project rate "
                             f"governs")
            value, citation = own, "the project's own priced document"

    if line.quantity == 0 and value:
        failures.append("G+.31 quantity is zero on a priced row")

    amount = (value * Decimal(line.quantity)).quantize(MONEY, ROUND_HALF_UP)
    return PricedRow(line, value, amount, citation, tuple(flags),
                     tuple(failures))


def price_bill(lines: list, rates: dict, units: dict, table,
               project_rates: dict | None = None) -> tuple[list, list, list]:
    """Returns (rows, failures, flags). The guards that need the whole bill —
    the ordinals and the share test — run here, after every row is priced,
    because neither can be judged one row at a time."""
    from bill.market import check_ordinals, share_breaches, untested_ordinals

    rows = [price_line(line, rates, units, project_rates) for line in lines]

    failures = [f"{r.line.ref}: {f}" for r in rows for f in r.failures]
    flags = [f"{r.line.ref}: {f}" for r in rows for f in r.flags]

    for breach in check_ordinals(rates, table):
        failures.append(f"G+.32d {breach}")

    untested = untested_ordinals(rates, table)
    if untested:
        flags.append(f"G+.32d {len(untested)} of {len(table.ordinals())} ordinal "
                     f"invariants untested this run (one side unpriced): "
                     f"{untested}")

    amounts: dict = {}
    for row in rows:
        if row.amount is None:
            continue
        bucket = amounts.setdefault(row.line.section, {})
        bucket[row.line.rate_class] = bucket.get(row.line.rate_class,
                                                 Decimal(0)) + row.amount
    for breach in share_breaches(amounts, table):
        flags.append(f"G+.32e {breach}")

    return rows, failures, flags


def search_budget(lines: list) -> int:
    """Distinct rate classes, which is what a run actually pays for."""
    return len({getattr(line, "rate_class", None) for line in lines} - {None})


def _load_lines(path: Path) -> list:
    raw = json.loads(path.read_text())
    return [BillLine(ref=r["ref"], section=r["section"],
                     rate_class=r["rate_class"], unit=r["unit"],
                     quantity=Decimal(str(r["quantity"])),
                     item_type=r.get("item_type"),
                     description=r.get("description")) for r in raw]


def _load_rates(path: Path, table) -> dict:
    """rates_found.json holds, per class, the observations the search channel
    returned. The rate is recomputed here rather than read, so a file cannot
    smuggle in a number that never passed the guards."""
    from datetime import date
    from bill.market import parse_observations, publish
    raw = json.loads(path.read_text())
    today = date.fromisoformat(raw["as_at"]) if raw.get("as_at") else date.today()
    out = {}
    for rate_class, observations in raw["classes"].items():
        rc = table.get(rate_class)
        kept, rejected = parse_observations(observations, rc.unit)
        rate = publish(rate_class, rc.unit, kept, table, today,
                       rejected=rejected)
        if rate is not None:
            out[rate_class] = rate
    return out


def main() -> int:
    ap = argparse.ArgumentParser(description="Price bill lines at market rates.")
    ap.add_argument("--lines", required=True)
    ap.add_argument("--classes", required=True)
    ap.add_argument("--units", required=True)
    ap.add_argument("--rates", required=True)
    ap.add_argument("--project-rates")
    args = ap.parse_args()

    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
    from ingest.rates import RateClassTable

    table = RateClassTable.load(Path(args.classes))
    units = json.loads(Path(args.units).read_text())
    lines = _load_lines(Path(args.lines))
    rates = _load_rates(Path(args.rates), table)
    project_rates = (json.loads(Path(args.project_rates).read_text())
                     if args.project_rates else None)

    rows, failures, flags = price_bill(lines, rates, units, table, project_rates)

    for row in rows:
        if row.is_gap:
            print(f"  {row.line.ref:<10} {row.line.rate_class:<30} GAP")
        else:
            print(f"  {row.line.ref:<10} {row.line.rate_class:<30} "
                  f"{row.rate:>12} x {row.line.quantity:>10} = "
                  f"{row.amount:>14}")
            print(f"             {row.citation}")
    print(f"\n{len(rows)} rows, {search_budget(lines)} classes searched, "
          f"{sum(1 for r in rows if r.is_gap)} gaps")
    for f in failures:
        print(f"FAIL {f}")
    for f in flags:
        print(f"FLAG {f}")
    if failures or any(r.is_gap for r in rows):
        return 2
    return 1 if flags else 0


if __name__ == "__main__":
    raise SystemExit(main())
