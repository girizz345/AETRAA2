#!/usr/bin/env python3
"""
conventions.py — description wording and markup primitives, as data.

Two tables that share a property: both were derived from issued documents
(3,605 priced items for the wording, the markup register for the colours), and
both are house style rather than standard. They belong beside the clause table
and not inside the renderer.

The description conventions carry one structural fact that is easy to miss and
expensive to get wrong: descriptions are generated per *group*, not per row.
One full description, then variants that inherit it — "Raft foundation, 1000mm
thick" then "Ditto, 1400mm thick". Sixteen instances in Concrete alone. What
the variants vary by differs per section, and that is what VARIES_BY holds.

  python3 -m ingest.conventions --data data/conventions.json --section C

Exit 0 = section found. Exit 1 = no conventions for that section.
"""
from __future__ import annotations

import argparse
import json
import sys
from dataclasses import dataclass
from pathlib import Path

DITTO = "Ditto"


@dataclass(frozen=True)
class SectionConvention:
    section: str
    template: str             # slots in {braces}, filled from element attributes
    varies_by: tuple          # attributes that make a variant rather than a new block
    required_slots: tuple


@dataclass(frozen=True)
class TradeColour:
    trade: str
    rgb: tuple
    primitive: str            # polygon (area) / polyline (linear) / tag (count)


class Conventions:
    def __init__(self, sections: dict[str, SectionConvention],
                 colours: dict[str, TradeColour]):
        self._sections = sections
        self._colours = colours

    def section(self, letter: str) -> SectionConvention:
        if letter not in self._sections:
            raise KeyError(f"no description convention for section {letter}")
        return self._sections[letter]

    def colour(self, trade: str) -> TradeColour:
        return self._colours[trade]

    def trades(self) -> list[str]:
        return sorted(self._colours)

    @classmethod
    def load(cls, path: Path) -> "Conventions":
        raw = json.loads(Path(path).read_text())
        sections = {r["section"]: SectionConvention(
            r["section"], r["template"], tuple(r.get("varies_by", [])),
            tuple(r.get("required_slots", []))) for r in raw["descriptions"]}
        colours = {r["trade"]: TradeColour(r["trade"], tuple(r["rgb"]),
                                           r["primitive"])
                   for r in raw["markup"]}
        return cls(sections, colours)


def main() -> int:
    ap = argparse.ArgumentParser(description="Inspect the conventions.")
    ap.add_argument("--data", required=True)
    ap.add_argument("--section")
    args = ap.parse_args()
    conventions = Conventions.load(Path(args.data))
    if not args.section:
        print(f"trades: {', '.join(conventions.trades())}")
        return 0
    try:
        convention = conventions.section(args.section.upper())
    except KeyError as exc:
        print(exc, file=sys.stderr)
        return 1
    print(f"template : {convention.template}")
    print(f"varies by: {', '.join(convention.varies_by)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
