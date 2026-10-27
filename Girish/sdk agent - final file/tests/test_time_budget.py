#!/usr/bin/env python3
"""
One slow file must not hold a stage. ordered_map with a per-item budget
reports the slow item as SheetTimeout and returns every other item's result,
in the order given; without a budget it behaves as before.
"""
from __future__ import annotations

import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from spine.concurrency import SheetTimeout, ordered_map            # noqa: E402


def _work(item):
    if item == "slow":
        time.sleep(2.5)
    return item.upper()


def test_a_slow_item_is_reported_and_the_rest_are_returned_in_order():
    started = time.monotonic()
    out = ordered_map(_work, ["a", "slow", "b", "c"], workers=4, timeout=0.5)
    assert time.monotonic() - started < 2.0          # did not wait for the slow one
    assert [o[0] for o in out] == ["a", "slow", "b", "c"]
    assert out[0][1] == "A" and out[2][1] == "B" and out[3][1] == "C"
    assert out[1][1] is None and isinstance(out[1][2], SheetTimeout)
    assert "exceeded" in str(out[1][2])


def test_without_a_budget_nothing_changes():
    out = ordered_map(_work, ["a", "b"], workers=2)
    assert [o[1] for o in out] == ["A", "B"] and all(o[2] is None for o in out)


def test_the_probe_reads_the_first_page_only():
    from readers import probe
    assert probe.PROBE_PAGES == 1
