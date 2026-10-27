#!/usr/bin/env python3
"""
concurrency.py — bounded parallelism across sheets, with the order put back.

Stages 1 to 8 are per-sheet and embarrassingly parallel. Stage 9 onward
operates on the building, not the sheet, and runs sequentially.

The rule this file exists to enforce: results come back in input order, always.
A thread pool returns them in completion order, which varies run to run, and an
unsorted result list is the most common cause of "same input, different output"
— and it is silent, because every individual value is correct.

One sheet's failure fails that sheet, loudly, with traceback. The run continues
on the others.

Not a CLI.
"""
from __future__ import annotations

import logging
from concurrent.futures import ThreadPoolExecutor
from concurrent.futures import TimeoutError as FuturesTimeout
from typing import Callable, Iterable, Sequence, TypeVar

LOG = logging.getLogger(__name__)

T = TypeVar("T")
R = TypeVar("R")


class SheetTimeout(Exception):
    """One item exceeded its time budget. Reported as that item's error; the
    others are unaffected."""


def ordered_map(fn: Callable[[T], R], items: Iterable[T], workers: int = 8,
                stage: str = "?", timeout: float | None = None
                ) -> list[tuple[T, R | None, Exception | None]]:
    """Apply fn across items, bounded. Returns (item, result, error) triples in
    the order items were given, never in completion order.

    `timeout` is a per-item budget in seconds. Without one, a single
    pathological file — a 200-page specification walked page by page, a sheet
    with a million paths — holds the whole stage: a 1,490-file package sat in
    stage 1 for an hour on one such file. With one, the item is reported as
    SheetTimeout and the run moves on; the worker thread finishes in the
    background and its result is discarded."""
    items = list(items)
    if workers <= 1 or len(items) <= 1:
        return [_one(fn, item, stage) for item in items]
    if timeout is None:
        with ThreadPoolExecutor(max_workers=workers) as pool:
            return list(pool.map(lambda item: _one(fn, item, stage), items))
    pool = ThreadPoolExecutor(max_workers=workers)
    futures = [pool.submit(_one, fn, item, stage) for item in items]
    out = []
    try:
        for item, fut in zip(items, futures):
            try:
                out.append(fut.result(timeout=timeout))
            except FuturesTimeout:
                LOG.error("sheet exceeded its time budget",
                          extra={"stage": stage, "doc_id": str(item)})
                out.append((item, None, SheetTimeout(
                    f"exceeded {timeout:.0f} s — listed unresolved, not read")))
    finally:
        pool.shutdown(wait=False, cancel_futures=True)
    return out


def _one(fn: Callable[[T], R], item: T, stage: str):
    try:
        return (item, fn(item), None)
    except Exception as exc:                      # noqa: BLE001 — see docstring
        LOG.exception("sheet failed", extra={"stage": stage, "doc_id": str(item)})
        return (item, None, exc)


def sequential(fn: Callable[[T], R], items: Sequence[T], stage: str = "?"):
    """Explicit sequential form, for stages 9 onward. Same return shape, so a
    caller can be moved between the two without changing how it reads results."""
    return ordered_map(fn, items, workers=1, stage=stage)
