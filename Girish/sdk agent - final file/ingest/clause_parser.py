#!/usr/bin/env python3
"""
clause_parser.py — POMI corpus (7.4k lines of prose) -> clauses.json.

Offline, run once per corpus version, output committed as a fixture. It is a
separate stage from everything else because these are *data*, every one of them
has been observed to be wrong or to drift, and a change must be visible as a
diff rather than arriving inside a code change.

Three things this parser must not do:

  * silently reconcile a contradiction. The corpus states the formula count as
    210 in one place and 207 in another, and at least one worked example reads
    against the clause it sits under. Each of those is emitted as a CONFLICT
    row for a surveyor to settle. Choosing produces a confident number with
    nothing behind it.
  * hardcode a count. Clause and formula counts are derived and asserted at
    boundaries, never written down.
  * invent a formula shape. A clause whose arithmetic is not one of
    ingest.formulas.SHAPES is emitted with shape=null and reported.

  python3 -m ingest.clause_parser --corpus <md> --out data/clauses.json

Exit 0 = parsed, no conflicts. Exit 1 = conflicts to settle. Exit 2 = corpus
unreadable.
"""
from __future__ import annotations

import argparse
import sys
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class Conflict:
    clause_id: str
    field: str
    values: tuple
    where: str


def parse_corpus(text: str) -> tuple[list[dict], list[Conflict]]:
    """Corpus text -> (clause rows, conflicts).

    NOT YET IMPLEMENTED — needs the real corpus in hand. The shape of the
    return value is the contract and is fixed; the parsing rules come from the
    document's own structure, which is not guessable from outside it.
    """
    raise NotImplementedError(
        "supply reference/POMI-COMPLETE-PROCESS.md and build the section, "
        "clause and formula recognisers against it")


def main() -> int:
    ap = argparse.ArgumentParser(description="Build the clause table.")
    ap.add_argument("--corpus", required=True)
    ap.add_argument("--out", required=True)
    args = ap.parse_args()
    path = Path(args.corpus)
    if not path.is_file():
        print(f"ERROR: no corpus at {path}", file=sys.stderr)
        return 2
    rows, conflicts = parse_corpus(path.read_text(encoding="utf-8"))
    Path(args.out).write_text(
        __import__("json").dumps({"schema": "clauses/1", "clauses": rows},
                                 indent=1, sort_keys=True))
    for conflict in conflicts:
        print(f"CONFLICT {conflict.clause_id} {conflict.field}: "
              f"{conflict.values} ({conflict.where})", file=sys.stderr)
    print(f"{len(rows)} clauses, {len(conflicts)} conflicts")
    return 1 if conflicts else 0


if __name__ == "__main__":
    raise SystemExit(main())
