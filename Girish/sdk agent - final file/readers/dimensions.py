#!/usr/bin/env python3
"""
dimensions.py — a dimension cell to a canonical value in metres.

Under v3.1 this file carries more weight than its size suggests: with geometry
inference out of scope, every length in the bill comes from a stated string,
and this is what turns that string into a number.

It refuses more than it parses, on purpose. "2100" is ambiguous — millimetres
in a door schedule, metres in a level note — so a bare number is only accepted
when the caller states the expected unit. "approx 2.1m", "2100 +/- 10" and
"2100 TYP" are refused rather than stripped to a number, because a tolerance or
an approximation is a different claim from a dimension and a bill should not
quietly promote one to the other.

  python3 -m readers.dimensions "900 x 2100"

Exit 0 = parsed. Exit 1 = refused (with the reason).
"""
from __future__ import annotations

import argparse
import re
from decimal import Decimal, InvalidOperation

MM_PER_M = Decimal(1000)

# a bare number this large in a drawing is millimetres, not metres
MM_THRESHOLD = Decimal(50)

_NUMBER = r"[0-9][0-9,]*(?:\.[0-9]+)?"
_UNIT = r"(?:mm|millimetres?|m|metres?|cm)"

# IGNORECASE, because drawings are lettered in CAPITALS. Without it "1100MM" —
# which is how every cell on an issued door schedule is written — failed to match
# and was REFUSED as "not a dimension", while "1100mm" parsed. On A-504 that
# silently dropped every width and height from 46 doors and left them as gaps.
# The unit is lower-cased in _to_metres, so matching case-insensitively here
# changes nothing downstream.
_FLAGS = re.IGNORECASE
RE_PAIR = re.compile(rf"^\s*({_NUMBER})\s*[xX×]\s*({_NUMBER})\s*({_UNIT})?\s*$",
                     _FLAGS)
RE_TRIPLE = re.compile(
    rf"^\s*({_NUMBER})\s*[xX×]\s*({_NUMBER})\s*[xX×]\s*({_NUMBER})\s*({_UNIT})?\s*$",
    _FLAGS)
RE_SINGLE = re.compile(rf"^\s*({_NUMBER})\s*({_UNIT})?\s*$", _FLAGS)

REFUSE_TOKENS = ("APPROX", "TYP", "±", "+/-", "MIN", "MAX", "NTS", "VARIES",
                 "TBC", "TO SUIT", "?")


class Refused(ValueError):
    """Not a dimension. Carries the reason, which reaches the gap list."""


def _to_decimal(token: str) -> Decimal:
    try:
        return Decimal(token.replace(",", ""))
    except InvalidOperation as exc:
        raise Refused(f"not a number: {token!r}") from exc


def _to_metres(value: Decimal, unit: str | None, expect: str | None) -> Decimal:
    unit = (unit or "").lower()
    if unit.startswith("mm") or unit.startswith("milli"):
        return value / MM_PER_M
    if unit.startswith("cm"):
        return value / Decimal(100)
    if unit.startswith("m"):
        return value
    if expect == "mm":
        return value / MM_PER_M
    if expect == "m":
        return value
    if value >= MM_THRESHOLD:
        return value / MM_PER_M          # 2100 is millimetres, not 2.1km
    raise Refused(f"ambiguous unit for bare value {value}; state expect=")


def parse(text: str, expect: str | None = None) -> tuple[Decimal, ...]:
    """Returns 1, 2 or 3 values in metres. Raises Refused with a reason."""
    if text is None:
        raise Refused("empty cell")
    cell = str(text).strip()
    if not cell:
        raise Refused("empty cell")
    upper = cell.upper()
    for token in REFUSE_TOKENS:
        if token in upper:
            raise Refused(f"qualified dimension ({token}) — not a measurement")
    for pattern, count in ((RE_TRIPLE, 3), (RE_PAIR, 2), (RE_SINGLE, 1)):
        found = pattern.match(cell)
        if not found:
            continue
        groups = found.groups()
        unit = groups[count]
        return tuple(_to_metres(_to_decimal(g), unit, expect)
                     for g in groups[:count])
    raise Refused(f"no dimension pattern matched {cell!r}")


def main() -> int:
    ap = argparse.ArgumentParser(description="Parse a dimension cell.")
    ap.add_argument("text")
    ap.add_argument("--expect", choices=["mm", "m"])
    args = ap.parse_args()
    try:
        values = parse(args.text, args.expect)
    except Refused as exc:
        print(f"refused: {exc}")
        return 1
    print(" x ".join(f"{v}" for v in values) + " m")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
