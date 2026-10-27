#!/usr/bin/env python3
"""
budget.py — estimate the calls before starting, and cap them.

Both inputs are known before the run: sheet count from the register, element
count from the inventory. So the ceiling is computable rather than discovered,
and a run that would exceed it stops at the start instead of three hours in.

Estimated for the 385-sheet dev corpus, roughly 800 calls of which about 150
are expensive:

  title-block fallback   ~20    only sheets no pattern matched
  routing                <=385  only sheets the keyword table could not resolve
  schedule mapping       ~30    ONE per schedule sheet, not per row
  legends                ~150   one per plan carrying symbols
  classification         ~40    batched per element family
  descriptions           ~30    batched per group

Web search in pricing is a separate budget, bounded by distinct rate class
rather than by line count: 400 lines across 60 classes costs 60 searches.

  python3 -m model.budget --sheets 385 --schedules 30 --elements 900

Exit 0 = within cap. Exit 1 = estimate exceeds the cap.
"""
from __future__ import annotations

import argparse
from dataclasses import dataclass

CLASSIFICATION_BATCH = 25       # elements per call
DESCRIPTION_BATCH = 20          # groups per call
DEFAULT_CAP = 1500


@dataclass(frozen=True)
class Estimate:
    title_block: int
    routing: int
    schedule_mapping: int
    legends: int
    classification: int
    descriptions: int

    @property
    def total(self) -> int:
        return (self.title_block + self.routing + self.schedule_mapping
                + self.legends + self.classification + self.descriptions)

    def as_rows(self) -> list[tuple[str, int]]:
        return sorted(((k, v) for k, v in self.__dict__.items()),
                      key=lambda kv: kv[0])


def estimate(sheets: int, schedules: int, plans: int, elements: int,
             groups: int, unmatched_title_blocks: int = 0,
             unresolved_routes: int = 0) -> Estimate:
    return Estimate(
        title_block=unmatched_title_blocks,
        routing=unresolved_routes,
        schedule_mapping=schedules,
        legends=plans,
        classification=-(-elements // CLASSIFICATION_BATCH),
        descriptions=-(-groups // DESCRIPTION_BATCH))


def check(est: Estimate, cap: int = DEFAULT_CAP) -> str | None:
    if est.total > cap:
        return f"estimated {est.total} calls exceeds cap {cap}"
    return None


def main() -> int:
    ap = argparse.ArgumentParser(description="Estimate a run's model calls.")
    ap.add_argument("--sheets", type=int, required=True)
    ap.add_argument("--schedules", type=int, default=0)
    ap.add_argument("--plans", type=int, default=0)
    ap.add_argument("--elements", type=int, default=0)
    ap.add_argument("--groups", type=int, default=0)
    ap.add_argument("--cap", type=int, default=DEFAULT_CAP)
    args = ap.parse_args()
    est = estimate(args.sheets, args.schedules, args.plans, args.elements,
                   args.groups)
    for name, count in est.as_rows():
        print(f"  {name:<20} {count:>5}")
    print(f"  {'TOTAL':<20} {est.total:>5}")
    problem = check(est, args.cap)
    if problem:
        print(problem)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
