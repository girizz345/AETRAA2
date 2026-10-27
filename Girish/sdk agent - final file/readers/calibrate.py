#!/usr/bin/env python3
"""
calibrate.py — page units to metres. Deferred at v3.1, not deleted.

With geometry inference out of scope, nothing is measured off the page: lengths
come from schedule cells and dimension strings, depths from subtracting stated
levels. So no quantity depends on scale, and running this stage would produce a
number nothing consumes.

It is kept, with its rule intact, for one reason. The rule is
refuse-on-disagreement: where the stated scale, the scale bar and a known grid
dimension do not agree, the sheet is marked SCALE_UNVERIFIED and no length or
area may cite it. That guard survives in measure/evidence.py even while this
stage sleeps, because a record from an unverified sheet must stay uncitable
whether or not anyone is calibrating.

If a measurement is ever taken by scaling, this comes back — and it comes back
with the refusal, not without it.

  python3 -m readers.calibrate <pdf>

Exit 3 = deferred, always, at v3.1.
"""
from __future__ import annotations

import argparse

DEFERRED_AT = "v3.1"


def calibrate(_path) -> None:
    raise NotImplementedError(
        f"stage 4 deferred at {DEFERRED_AT}; reinstate with the "
        "refuse-on-disagreement rule, never without it")


def main() -> int:
    ap = argparse.ArgumentParser(description="Scale calibration (deferred).")
    ap.add_argument("pdf")
    ap.parse_args()
    print(f"stage 4 calibrate is deferred at {DEFERRED_AT} — "
          "no quantity depends on scale under text-only measurement")
    return 3


if __name__ == "__main__":
    raise SystemExit(main())
