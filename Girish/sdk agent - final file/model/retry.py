#!/usr/bin/env python3
"""
retry.py — retry on a schema-invalid response, and on nothing else.

The distinction is the whole file. A malformed response is worth asking again,
because the question was sound and the answer was not. A response that is
well-formed and wrong is not worth asking again: asking twice and taking the
second answer is consensus by another name, and it makes the run
non-reproducible while feeling more careful.

So: SchemaInvalid retries, with backoff. Transient provider errors retry, with
backoff. Everything else — including a perfectly valid classification you
happen to disagree with — is accepted and dealt with by the eval set, offline,
where a disagreement can be measured rather than voted on.

A retry that exhausts its budget records a gap. It never falls back to a
default answer.

Not a CLI.
"""
from __future__ import annotations

import logging
import time
from typing import Callable, TypeVar

from model.schema import SchemaInvalid
from spine.errors import TransientError

LOG = logging.getLogger(__name__)
T = TypeVar("T")

BASE_DELAY = 1.0
MAX_DELAY = 30.0


def with_retry(fn: Callable[[], T], attempts: int = 2, sleep=time.sleep) -> T:
    """attempts counts retries, not total calls: attempts=2 means up to three
    calls. sleep is injectable so the tests do not wait."""
    last: Exception | None = None
    for attempt in range(attempts + 1):
        try:
            return fn()
        except SchemaInvalid as exc:
            last = exc
            LOG.warning("schema-invalid response, retrying",
                        extra={"operation": f"attempt {attempt + 1}"})
        except TransientError as exc:
            last = exc
            LOG.warning("transient provider error, retrying",
                        extra={"operation": f"attempt {attempt + 1}"})
        if attempt < attempts:
            sleep(min(BASE_DELAY * (2 ** attempt), MAX_DELAY))
    raise last if last else RuntimeError("retry exhausted with no error recorded")
