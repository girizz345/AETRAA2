#!/usr/bin/env python3
"""
titleblocks.py — title block field patterns, as data.

This is the file that decides the project's timescale, and it is worth being
explicit about why. Every consultant lays a title block out differently — lower
right, lower left, a strip down the side — and revisions are written three or
four ways. The rule cannot be written in advance because nobody knows what is
in the package until it is read. So: a pattern set runs across several hundred
sheets, reports the forty it could not manage, the set improves, and it runs
again. That loop is set by how varied the drawings are, not by how fast anyone
works.

Which means this table changes often and by hand, and every change must be
diffable. Hence data, not code.

A pattern that matches nothing across a whole package is reported — a silently
dead pattern is how a set rots.

  python3 -m ingest.titleblocks --patterns data/titleblocks.json

Exit 0 = loaded. Exit 2 = unreadable.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import dataclass
from pathlib import Path

FIELDS = ("drawing_no", "title", "revision", "scale", "subtitle")


@dataclass(frozen=True)
class FieldPattern:
    """One way to find one field.

    mode "inline"  the value follows the label on the same line:
                   "DRAWING No: AR-101"
    mode "below"   the block is a TABLE and the value sits under the label:
                       PROJECT NO. :   DWG NO. :   REV NO. :
                       B-290           A-301       R0
                   The regex then matches the LABEL, and the reader takes the
                   value from the row beneath, in the label's own column.
                   value_regex, when given, is what that value must look like
                   (its "value" group is kept): under SCALE : the column also
                   catches the start of the DATE beside it, "1:150 JUN-2025".
                   rows is how many rows the value may run to - a two-line
                   sheet title - stopping at the next row that holds a label."""
    field: str
    regex: str
    note: str = ""
    mode: str = "inline"
    value_regex: str = ""
    rows: int = 1

    def match(self, text: str) -> str | None:
        found = re.search(self.regex, text, re.IGNORECASE | re.MULTILINE)
        if not found:
            return None
        return (found.group("value") if "value" in found.groupdict()
                else found.group(0)).strip()


@dataclass(frozen=True)
class TitleBlockSpec:
    """One consultant's convention: where the block sits, and how to read it."""
    name: str
    corner: str                  # lower-right / lower-left / right-strip
    width_frac: float            # fraction of sheet width the block occupies
    height_frac: float
    patterns: tuple
    # a fallback spec is read only where no office's own convention found a
    # drawing number: it widens what is read on an unseen package without
    # changing a single value on one whose blocks are already known
    fallback: bool = False


class PatternSet:
    def __init__(self, specs: list[TitleBlockSpec]):
        self._specs = sorted(specs, key=lambda s: s.name)

    def __iter__(self):
        return iter(self._specs)

    def fields_for(self, spec_name: str) -> dict[str, list[FieldPattern]]:
        out: dict[str, list[FieldPattern]] = {f: [] for f in FIELDS}
        for spec in self._specs:
            if spec.name != spec_name:
                continue
            for pattern in spec.patterns:
                out[pattern.field].append(pattern)
        return out

    @classmethod
    def load(cls, path: Path) -> "PatternSet":
        raw = json.loads(Path(path).read_text())
        specs = []
        for row in raw["title_blocks"]:
            patterns = tuple(FieldPattern(p["field"], p["regex"],
                                          p.get("note", ""),
                                          p.get("mode", "inline"),
                                          p.get("value_regex", ""),
                                          int(p.get("rows", 1)))
                             for p in row.get("patterns", []))
            for pattern in patterns:
                if pattern.field not in FIELDS:
                    raise ValueError(f"unknown title-block field: {pattern.field}")
                re.compile(pattern.regex)      # fail at load, not mid-package
                if pattern.value_regex:
                    re.compile(pattern.value_regex)
            specs.append(TitleBlockSpec(row["name"], row["corner"],
                                        float(row["width_frac"]),
                                        float(row["height_frac"]), patterns,
                                        bool(row.get("fallback", False))))
        return cls(specs)


def main() -> int:
    ap = argparse.ArgumentParser(description="Load and validate the pattern set.")
    ap.add_argument("--patterns", required=True)
    args = ap.parse_args()
    try:
        patterns = PatternSet.load(Path(args.patterns))
    except (OSError, json.JSONDecodeError, KeyError, ValueError, re.error) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 2
    for spec in patterns:
        print(f"  {spec.name:<24} {spec.corner:<14} {len(spec.patterns)} patterns")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
