"""Per-sheet work in worker processes.

A run opens one pool (`with pool(n):`) and every stage hands its independent per-sheet work to `pmap`, which
returns the results in the order the work was given - so a run gives the same take-off whatever the number of
workers. With one worker the same functions run in this process, one after another.

Worker functions are top-level functions of this package, take one picklable argument and return plain data
(dataclasses, lists, dicts); anything they would have logged comes back in the result for the caller to log in
order.
"""
from __future__ import annotations

import contextlib
import os
from concurrent.futures import ProcessPoolExecutor

_pool: ProcessPoolExecutor | None = None
_size = 1


def default_workers() -> int:
    """Up to 8 worker processes, leaving a core free (each plan being measured needs a few hundred MB)."""
    return max(1, min(8, (os.cpu_count() or 2) - 1))


@contextlib.contextmanager
def pool(n: int):
    """Workers for the stages run inside this block."""
    global _pool, _size
    prev = (_pool, _size)
    _size = max(1, int(n))
    _pool = ProcessPoolExecutor(max_workers=_size) if _size > 1 else None
    try:
        yield _size
    finally:
        if _pool is not None:
            _pool.shutdown(wait=True, cancel_futures=True)
        _pool, _size = prev


def size() -> int:
    return _size


def pmap(fn, items, progress=None) -> list:
    """fn over items, in worker processes when a pool is open; results in the order of items.
    progress(done, total), when given, is called as the results come in (a long visual reading shows its count)."""
    items = list(items)
    run = map(fn, items) if _pool is None or len(items) < 2 else _pool.map(fn, items)   # in order, as they finish
    out = []
    for r in run:
        out.append(r)
        if progress is not None:
            progress(len(out), len(items))
    return out
