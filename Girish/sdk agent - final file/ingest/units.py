#!/usr/bin/env python3
"""
units.py — G+.31. The unit a row is allowed to carry, given what it measures.

A small table, and the cheapest gate in the pipeline: it catches a slab billed
in cubic metres, a door billed in square metres, and a rate quoted per square
metre pricing a cubic metre row. All three are silent errors in a populated
workbook and all three are arithmetic-free to detect.

  python3 -m ingest.units --data data/units.json --check slab m2
  python3 -m ingest.units --data data/units.json --canonical "Sq.M"

Exit 0 = allowed. Exit 1 = rejected. Exit 2 = table unreadable.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent / "data" / "units.json"


class Units:
    def __init__(self, raw: dict):
        self._raw = raw
        self._units = set(raw["units"])
        self._canonical = {k.lower(): v for k, v in raw["canonical"].items()}
        self._by_type: dict[str, str] = {}
        for row in raw["classes"]:
            for item_type in row["item_types"]:
                # a type may legitimately carry two units (rebar: kg or tonne);
                # the first declared is the house unit, the rest are accepted
                self._by_type.setdefault(item_type, row["unit"])
        self._accepted: dict[str, set] = {}
        for row in raw["classes"]:
            for item_type in row["item_types"]:
                self._accepted.setdefault(item_type, set()).add(row["unit"])

    def canonical(self, text: str | None) -> str | None:
        if not text:
            return None
        key = str(text).strip()
        if key in self._units:
            return key
        return self._canonical.get(key.lower())

    def house_unit(self, item_type: str) -> str | None:
        return self._by_type.get(item_type)

    def allows(self, item_type: str, unit: str) -> bool:
        return unit in self._accepted.get(item_type, set())

    def check(self, item_type: str | None, unit: str | None,
              quantity=None) -> str | None:
        """None means the row is fine. A string is the reason it is not."""
        canon = self.canonical(unit)
        if canon is None:
            return f"unit {unit!r} is not in the unit dictionary"
        if item_type is not None:
            if item_type not in self._accepted:
                return f"item type {item_type!r} is not in the unit dictionary"
            if not self.allows(item_type, canon):
                allowed = ", ".join(sorted(self._accepted[item_type]))
                return (f"item type {item_type!r} bills in {allowed}, "
                        f"the row says {canon}")
        if quantity is None:
            return None
        if quantity < 0:
            return "negative quantity"
        return None

    def item_types(self) -> list[str]:
        return sorted(self._accepted)

    def rejections(self) -> list[dict]:
        return list(self._raw["rejections"])

    @classmethod
    def load(cls, path: Path | None = None) -> "Units":
        return cls(json.loads(Path(path or DATA).read_text()))


def main() -> int:
    ap = argparse.ArgumentParser(description="The unit dictionary, G+.31.")
    ap.add_argument("--data")
    ap.add_argument("--check", nargs=2, metavar=("ITEM_TYPE", "UNIT"))
    ap.add_argument("--canonical")
    args = ap.parse_args()
    try:
        units = Units.load(Path(args.data) if args.data else None)
    except Exception as exc:                                  # noqa: BLE001
        print(f"unit table unreadable: {exc}", file=sys.stderr)
        return 2
    if args.canonical:
        canon = units.canonical(args.canonical)
        print(canon or f"{args.canonical!r} is not a unit this bill recognises")
        return 0 if canon else 1
    if args.check:
        item_type, unit = args.check
        problem = units.check(item_type, unit)
        print(problem or f"{item_type} in {units.canonical(unit)} — allowed")
        return 1 if problem else 0
    print(f"{len(units.item_types())} item types, "
          f"{len(units.rejections())} rejection rules")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
