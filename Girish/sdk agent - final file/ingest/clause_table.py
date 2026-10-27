#!/usr/bin/env python3
"""
clause_table.py — the lookup every quantity is computed from.

The clause fixes the arithmetic. The model supplies a clause id and role
bindings; unit, formula shape, thresholds, deduction rule and grouping are
looked up here and never chosen. That is the difference between a bill and a
plausible-looking spreadsheet.

This table is data, fixtured, and a change to it must show as a fixture diff —
because the corpus contradicts itself in at least three places (formula count
stated as 210 and 207; at least one worked example reading against the clause
it sits under) and a silent correction is indistinguishable from a silent
error.

  python3 -m ingest.clause_table --table data/clauses.json --clause E.3.2

Exit 0 = found. Exit 1 = no such clause. Exit 2 = table unreadable.
"""
from __future__ import annotations

import argparse
import json
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Iterator


@dataclass(frozen=True)
class Clause:
    id: str
    section: str            # POMI letter — validated against the crosswalk
    title: str
    unit: str | None        # m, m2, m3, nr, kg, tonne, item — None = not measured
    shape: str | None       # key into ingest.formulas.SHAPES — None = no formula
    thresholds: tuple       # ((role, op, value, unit), ...) — conditional existence
    deduction_rule: str | None
    grouping: tuple         # attributes that split one line into several
    source: str             # corpus line reference — every row cites its origin
    shape_basis: str = "matched"     # matched / cross-reference / no arithmetic
                                     # / unexpressible
    unit_alternatives: tuple = ()     # limbs POMI offers after the first
    contaminated: bool = False        # a field carried the corpus page footer

    @property
    def computable(self) -> bool:
        """Can a quantity be produced from this clause at all? 104 of the 314
        are definitional or administrative, and asking them for arithmetic is a
        caller error rather than a gap."""
        return bool(self.shape and self.unit)


class ClauseTable:
    def __init__(self, clauses: dict[str, Clause]):
        self._clauses = clauses

    def __len__(self) -> int:
        return len(self._clauses)

    def __contains__(self, clause_id: str) -> bool:
        return clause_id in self._clauses

    def __iter__(self) -> Iterator[Clause]:
        for key in sorted(self._clauses):
            yield self._clauses[key]

    def get(self, clause_id: str) -> Clause:
        if clause_id not in self._clauses:
            raise KeyError(f"clause not in table: {clause_id}")
        return self._clauses[clause_id]

    def by_section(self, section: str) -> list[Clause]:
        return [c for c in self if c.section == section]

    def computable(self) -> list[Clause]:
        return [c for c in self if c.computable]

    @classmethod
    def load(cls, path: Path) -> "ClauseTable":
        """The fixture carries the corpus's own fields — `text`, `unit_raw`,
        `formula_raw` — so it is normalised on the way in by
        ingest.clause_normalise.

        Before that normaliser existed this method read `title`, `unit`, `shape`
        and `source`, none of which the fixture has, so it raised KeyError on its
        first row and the table had never been loaded once. Stage 0 reported
        "314 clauses" by reading the JSON directly, which is exactly why nobody
        noticed. A fixture that cannot be loaded through its own loader is not a
        fixture, so the loader now accepts the shape that is actually on disk."""
        from ingest.clause_normalise import normalise_table

        raw = json.loads(Path(path).read_text())
        rows, problems = normalise_table(raw)
        if problems:
            raise ValueError(
                "clause fixture has unnormalisable rows: "
                + "; ".join(f"{pid}: {why}" for pid, why in problems))
        clauses = {}
        for row in rows:
            clauses[row["id"]] = Clause(
                id=row["id"], section=row["section"], title=row["title"],
                unit=row["unit"], shape=row["shape"],
                thresholds=tuple(tuple(t) for t in row.get("thresholds", [])),
                deduction_rule=row.get("deduction_rule"),
                grouping=tuple(row.get("grouping", [])),
                source=row["source"],
                shape_basis=row.get("shape_basis", "matched"),
                unit_alternatives=tuple(row.get("unit_alternatives", [])),
                contaminated=bool(row.get("contaminated")))
        return cls(clauses)


def main() -> int:
    ap = argparse.ArgumentParser(description="Look a clause up.")
    ap.add_argument("--table", required=True)
    ap.add_argument("--clause")
    args = ap.parse_args()
    try:
        table = ClauseTable.load(Path(args.table))
    except (OSError, json.JSONDecodeError, KeyError) as exc:
        print(f"ERROR: table unreadable: {exc}", file=sys.stderr)
        return 2
    if not args.clause:
        print(f"{len(table)} clauses, {len(table.computable())} computable")
        return 0
    try:
        clause = table.get(args.clause)
    except KeyError as exc:
        print(exc, file=sys.stderr)
        return 1
    print(json.dumps(clause.__dict__, indent=1, sort_keys=True, default=list))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
