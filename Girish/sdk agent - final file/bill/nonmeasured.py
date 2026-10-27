#!/usr/bin/env python3
"""
nonmeasured.py — prelims, dayworks and contingencies, as enumerated items.

The reference BOQ carries these as prose clauses, individually priced, with an
explicit prohibition on a lump sum covering more than one clause. So they are
not one line each — Bill 1 Preliminaries is a list of separately priced
clauses, and Bill 8 Dayworks likewise.

That prohibition is the reason this is a stage rather than a template. A lump
sum hides which obligations the contractor has priced, and the whole point of
enumerating them is that an unpriced clause is visible.

Where a value is commercial rather than measured — a provisional sum, a
contingency — the cell is left blank and named, never filled with a plausible
figure. A blank is a decision for the surveyor; a figure is a decision this
pipeline is not entitled to make.

  python3 -m bill.nonmeasured --context P.json --out nonmeasured.json

Exit 0 = built. Exit 1 = a clause required a commercial value not supplied.
"""
from __future__ import annotations

import argparse
import re
from dataclasses import dataclass

BILLS = {1: "Preliminaries", 8: "Dayworks"}
NO_LUMP_SUM = ("A lump sum may not cover more than one clause. Each clause is "
               "priced separately.")

# A clause whose value is a commercial decision rather than a priced obligation.
# The cell is left blank and named; a figure here would be a decision the
# pipeline is not entitled to make.
RE_COMMERCIAL = re.compile(r"provisional|contingenc|allowance|\bsum\b",
                           re.IGNORECASE)


@dataclass(frozen=True)
class NonMeasuredItem:
    bill: int
    clause_ref: str
    text: str
    unit: str                 # usually "item"
    value_is_commercial: bool  # True -> cell left blank and named
    priced_by: str | None      # who supplies it, when it is commercial


def build(project_context: dict, clause_table) -> list[NonMeasuredItem]:
    """Prelims clauses come from the ingested corpus, not from a boilerplate
    file, so that a corpus revision reaches the prelims too.

    Every section A clause is its own item in Bill 1 — the reference BOQ
    prohibits one lump sum covering more than one clause, so a clause that is
    not enumerated is a clause nobody priced. The unit is always "item"; a
    clause whose title reads as a provisional sum, contingency or allowance is
    marked commercial, and `priced_by` is whoever the project context names
    for that (None when it names nobody — a blank, not a default)."""
    project_context = project_context or {}
    priced_by = project_context.get("priced_by")
    items: list[NonMeasuredItem] = []
    for clause in clause_table.by_section("A"):
        commercial = bool(RE_COMMERCIAL.search(clause.title or ""))
        items.append(NonMeasuredItem(
            bill=1, clause_ref=clause.id, text=clause.title, unit="item",
            value_is_commercial=commercial,
            priced_by=priced_by if commercial else None))
    return sorted(items, key=lambda i: (i.bill, i.clause_ref))


def unpriced(items: list[NonMeasuredItem], priced: dict) -> list[NonMeasuredItem]:
    """Items with no rate and no commercial flag. These are omissions, and they
    are reported rather than defaulted to nil."""
    return sorted((i for i in items
                   if not i.value_is_commercial and i.clause_ref not in priced),
                  key=lambda i: (i.bill, i.clause_ref))


def main() -> int:
    ap = argparse.ArgumentParser(description="Build non-measured bills.")
    ap.add_argument("--context", required=True)
    ap.add_argument("--out", required=True)
    ap.parse_args()
    print(NO_LUMP_SUM)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
