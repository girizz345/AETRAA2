#!/usr/bin/env python3
"""
logs.py — structured logging into the run folder.

One line per event, JSON, so the log is greppable and diffable between two runs
of the same input set. Console output is for a human watching; the file is the
record, and the file is what a failure gets read out of three weeks later.

No print() outside the runner display. logging.getLogger(__name__) everywhere
else, configured once here.

Not a CLI.
"""
from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from pathlib import Path


class JsonLines(logging.Formatter):
    """One JSON object per line. Extra fields set by stages — doc_id, stage,
    operation — are carried through so a log line names the same three things
    a failure does."""

    KEYS = ("doc_id", "stage", "operation", "clause_id", "elapsed_ms")

    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "ts": datetime.now(timezone.utc).isoformat(timespec="milliseconds"),
            "level": record.levelname,
            "logger": record.name,
            "msg": record.getMessage(),
        }
        for key in self.KEYS:
            value = getattr(record, key, None)
            if value is not None:
                payload[key] = value
        if record.exc_info:
            payload["exc"] = self.formatException(record.exc_info)
        return json.dumps(payload, sort_keys=True)


def configure(run_dir: Path, verbose: bool = False) -> Path:
    """Attach a file handler to the run folder and a console handler for the
    human. Returns the log path. Idempotent within a process."""
    run_dir = Path(run_dir)
    run_dir.mkdir(parents=True, exist_ok=True)
    log_path = run_dir / "run.log.jsonl"

    root = logging.getLogger("aetraa")
    root.setLevel(logging.DEBUG if verbose else logging.INFO)
    for handler in list(root.handlers):
        root.removeHandler(handler)

    file_handler = logging.FileHandler(log_path, encoding="utf-8")
    file_handler.setFormatter(JsonLines())
    file_handler.setLevel(logging.DEBUG)
    root.addHandler(file_handler)

    console = logging.StreamHandler()
    console.setFormatter(logging.Formatter("%(levelname)-7s %(message)s"))
    console.setLevel(logging.DEBUG if verbose else logging.WARNING)
    root.addHandler(console)

    root.propagate = False
    return log_path
