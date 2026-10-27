#!/usr/bin/env python3
"""
gaps.py — one shape for everything the run could not resolve.

A gap is not an error. It is an output. The gap list ships with the
deliverable, and a stage that cannot complete records one rather than
substituting a default, because a default is indistinguishable from a
measurement once it is in a cell.

Every gap names the sheet and says what is missing in words a surveyor can act
on — "no thickness for raft R3 on ST-101", not "KeyError: thickness".

  python3 -m spine.gaps --run runs/<id>       # print the gap list

Exit 0 always. A gap is never a failure of the run.
"""
from __future__ import annotations

import argparse
import json
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Iterable, Iterator


@dataclass(frozen=True)
class Gap:
    stage: str
    doc_id: str | None
    subject: str          # what was being resolved: a mark, a clause, a sheet
    reason: str           # plain words, for a surveyor
    detail: str | None = None


class GapList:
    """Append-only. Sorted on write, so two runs that find the same gaps write
    byte-identical lists."""

    def __init__(self) -> None:
        self._gaps: list[Gap] = []

    def add(self, gap: Gap) -> None:
        self._gaps.append(gap)

    def extend(self, gaps: Iterable[Gap]) -> None:
        self._gaps.extend(gaps)

    def __len__(self) -> int:
        return len(self._gaps)

    def __iter__(self) -> Iterator[Gap]:
        return iter(self.sorted())

    def sorted(self) -> list[Gap]:
        return sorted(self._gaps, key=lambda g: (g.stage, g.doc_id or "", g.subject))

    def by_stage(self) -> dict[str, list[Gap]]:
        out: dict[str, list[Gap]] = {}
        for gap in self.sorted():
            out.setdefault(gap.stage, []).append(gap)
        return out

    def write(self, path: Path) -> None:
        payload = {"schema": "gaps/1", "count": len(self._gaps),
                   "gaps": [asdict(g) for g in self.sorted()]}
        path.write_text(json.dumps(payload, indent=1, sort_keys=True))

    @classmethod
    def read(cls, path: Path) -> "GapList":
        out = cls()
        data = json.loads(path.read_text())
        out.extend(Gap(**g) for g in data.get("gaps", []))
        return out


def main() -> int:
    ap = argparse.ArgumentParser(description="Print a run's gap list.")
    ap.add_argument("--run", required=True)
    args = ap.parse_args()
    gaps = GapList.read(Path(args.run) / "gaps.json")
    for stage, items in sorted(gaps.by_stage().items()):
        print(f"\n{stage} — {len(items)}")
        for g in items:
            print(f"  {g.doc_id or '-':<28} {g.subject:<24} {g.reason}")
    print(f"\n{len(gaps)} gaps")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
