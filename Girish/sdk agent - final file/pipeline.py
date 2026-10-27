#!/usr/bin/env python3
"""
pipeline.py — the stage sequence, and the only place it is written down.

Stages 1 to 8 are per-sheet and run concurrently. Stage 9 onward operates on
the building rather than the sheet and runs sequentially. The boundary is not a
performance decision: consolidation, dedup and the completeness gate all need
the whole package in hand, and running them per sheet would make each one
correct about one sheet and wrong about the job.

Every stage records its entry and exit in the run state before and after it
runs, so a stage that never ran is a visible absence rather than an assumed
pass.

The pipeline terminates in exactly one of two ways: the three artefact sets
plus a gap list, or a stated reason it could not produce them. There is no
third outcome where it produces something and says nothing about what is
missing.

Not a CLI — entered through spine.cli.
"""
from __future__ import annotations

import logging
from pathlib import Path

from spine import logs
from spine.config import DEFAULT
from spine.gaps import GapList
from spine.identity import hash_directory
from spine.runstate import RunState

LOG = logging.getLogger(__name__)

CONCURRENT_STAGES = ("S1", "S2", "S3", "S5", "S6", "S7")
SEQUENTIAL_FROM = "S9"

EXIT_OK = 0
EXIT_GAPS = 1
EXIT_BAD_INPUT = 2
EXIT_GATE_BLOCKED = 3


def run_pipeline(args) -> int:
    """Order is fixed by runstate.ORDER; this function only supplies each
    stage's inputs and records its result."""
    root = Path(args.directory)
    digest, _pairs = hash_directory(root)
    run_dir = Path(args.out) / digest[:12]
    logs.configure(run_dir, verbose=getattr(args, "verbose", False))
    state = RunState(run_dir)
    state.begin(digest)
    gaps = GapList()

    LOG.info("run begins", extra={"stage": "S0", "operation": digest[:12]})
    raise NotImplementedError(
        "wire the stages in runstate.ORDER: each one state.enter(), run, "
        "state.exit(code, artefacts); concurrent via spine.concurrency for "
        f"{CONCURRENT_STAGES}, sequential from {SEQUENTIAL_FROM}")


def artefact_paths(run_dir: Path) -> dict[str, Path]:
    """The three sets, plus the two things that are easy to overlook and cost
    the most when missing."""
    return {
        "markup": run_dir / "markup",
        "takeoff": run_dir / "takeoff.xlsx",
        "bill": run_dir / "bill.xlsx",
        "gaps": run_dir / "gaps.json",
        "provenance": run_dir / "provenance.xlsx",
    }
