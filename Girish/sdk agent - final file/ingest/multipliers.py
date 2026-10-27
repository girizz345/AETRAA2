#!/usr/bin/env python3
"""
multipliers.py — R36. How many floors a typical-floor drawing serves.

Getting this wrong was measured at a 16 to 58 per cent undercount, which is the
largest single error the pipeline can make, so the rule is stated twice: the
scope is recorded VERBATIM and the count is carried in the Nr column, never
pre-multiplied at measurement time; and where the served floors cannot be
determined the answer is None, which is a gap, never a silent 1.

The patterns are data (data/multipliers.json) because they are a consultant's
drafting habit, not a standard. The resolution ORDER is data too: a range must
be tried before a single floor, or "FLOOR 3 TO 9" reads as floor 3.

  python3 -m ingest.multipliers --data data/multipliers.json \\
      --subtitle "TYP. FL. L3 TO L9"

Exit 0 = resolved. Exit 1 = undetermined (a gap). Exit 2 = data unreadable.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import dataclass
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent / "data" / "multipliers.json"


@dataclass(frozen=True)
class Scope:
    """What one drawing covers. `verbatim` is the subtitle as drawn — R36 wants
    it on the sheet, so it is carried rather than normalised away."""
    multiplier: int | None
    kind: str
    label: str
    verbatim: str
    zone: str | None = None
    flags: tuple = ()

    @property
    def undetermined(self) -> bool:
        return self.multiplier is None


class Multipliers:
    def __init__(self, raw: dict):
        self._raw = raw
        self._patterns = {p["kind"]: p for p in raw["patterns"]}
        self._order = list(raw["precedence"])
        self._compiled = {k: re.compile(p["regex"], re.IGNORECASE)
                          for k, p in self._patterns.items()}

    def kinds(self) -> list[str]:
        return list(self._order)

    def resolve(self, subtitle: str | None, *,
                section_floor_count: int | None = None) -> Scope:
        text = (subtitle or "").strip()
        if not text:
            return Scope(None, "absent", "", "",
                         flags=("NO_SUBTITLE",))

        for kind in self._order:
            rx = self._compiled.get(kind)
            if rx is None:
                continue
            match = rx.search(text)
            if not match:
                continue
            handler = getattr(self, f"_{kind}")
            scope = handler(match, text, section_floor_count)
            if scope is not None:
                return scope

        if "TYPICAL" in text.upper() or re.search(r"\bTYP\b\.?", text, re.I):
            return Scope(None, "typical_alone", text, text,
                         flags=("TYPICAL_WITHOUT_SCOPE",))

        default = self._raw["default"]
        return Scope(int(default["multiplier"]), "default", text, text,
                     flags=(default["flag"],))

    # ── one handler per pattern kind ────────────────────────────────────
    @staticmethod
    def _span(start: int, end: int) -> int:
        return abs(end - start) + 1

    def _range(self, m, text, _count):
        start, end = int(m.group("start")), int(m.group("end"))
        return Scope(self._span(start, end), "range",
                     f"FL{start}-FL{end}", text)

    def _typical_bracket(self, m, text, _count):
        start, end = int(m.group("start")), int(m.group("end"))
        return Scope(self._span(start, end), "typical_bracket",
                     f"FL{start}-FL{end}", text)

    def _ordinal_range(self, m, text, _count):
        start, end = int(m.group("start")), int(m.group("end"))
        return Scope(self._span(start, end), "ordinal_range",
                     f"FL{start}-FL{end}", text)

    def _ordinal_list(self, m, text, _count):
        found = [int(n) for n in re.findall(r"(\d{1,2})\s*(?:ST|ND|RD|TH)",
                                           m.group(0), re.IGNORECASE)]
        distinct = sorted(set(found))
        if not distinct:
            return None
        return Scope(len(distinct), "ordinal_list",
                     "FL" + ",".join(str(n) for n in distinct), text)

    def _list(self, m, text, _count):
        found = [int(n) for n in re.findall(r"\d{1,2}", m.group(0))]
        distinct = sorted(set(found))
        if len(distinct) < 2:
            return None
        return Scope(len(distinct), "list",
                     "FL" + ",".join(str(n) for n in distinct), text)

    def _all(self, m, text, count):
        if count is None:
            return Scope(None, "all", "ALL_FLOORS", text,
                         flags=("ALL_FLOORS_NO_SECTION",))
        return Scope(int(count), "all", "ALL_FLOORS", text,
                     flags=("FROM_SECTION_COUNT",))

    def _zone(self, m, text, _count):
        zone = (m.group("zone") or "").strip()
        if not zone or zone.upper() in {"PLAN", "LAYOUT"}:
            return None
        return Scope(1, "zone", f"{m.group('floor').strip()} / {zone}", text,
                    zone=zone)

    def _single(self, m, text, _count):
        return Scope(1, "single", m.group(0).strip(), text)

    @classmethod
    def load(cls, path: Path | None = None) -> "Multipliers":
        return cls(json.loads(Path(path or DATA).read_text()))


_CACHE: Multipliers | None = None


def table() -> Multipliers:
    global _CACHE
    if _CACHE is None:
        _CACHE = Multipliers.load()
    return _CACHE


def floor_multiplier(subtitle: str | None,
                     section_floor_count: int | None = None) -> int | None:
    """The compatibility entry point. None means undetermined, and undetermined
    is a gap, never 1."""
    return table().resolve(subtitle,
                           section_floor_count=section_floor_count).multiplier


def main() -> int:
    ap = argparse.ArgumentParser(description="Resolve a floor multiplier.")
    ap.add_argument("--data")
    ap.add_argument("--subtitle", required=True)
    ap.add_argument("--section-floors", type=int)
    args = ap.parse_args()
    try:
        mults = Multipliers.load(Path(args.data) if args.data else None)
    except Exception as exc:                                  # noqa: BLE001
        print(f"multiplier data unreadable: {exc}", file=sys.stderr)
        return 2
    scope = mults.resolve(args.subtitle,
                          section_floor_count=args.section_floors)
    print(f"verbatim   : {scope.verbatim}")
    print(f"read as    : {scope.kind}")
    print(f"label      : {scope.label}")
    print(f"multiplier : {scope.multiplier if scope.multiplier else 'UNDETERMINED — a gap'}")
    if scope.zone:
        print(f"zone       : {scope.zone}")
    for flag in scope.flags:
        print(f"flag       : {flag}")
    return 1 if scope.undetermined else 0


if __name__ == "__main__":
    raise SystemExit(main())
