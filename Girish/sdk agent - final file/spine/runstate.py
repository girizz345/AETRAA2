#!/usr/bin/env python3
"""
runstate.py — the run folder and its memory.

The failure this closes: a stage that never ran must look different from a
stage that ran and found nothing. Otherwise a check that was never reached is
indistinguishable from a check that passed, and the deliverable is issued
anyway with nothing in it saying so.

state.json records, per stage: entered, exited, exit code, artefacts written,
and the input_set_hash it belongs to. Three consequences:

  * a stage cannot be entered until its predecessors recorded exit 0
  * a run resumes from the first incomplete stage
  * an omitted stage is a visible absence

  python3 -m spine.runstate show  --run runs/<id>
  python3 -m spine.runstate check --run runs/<id>   # 1 if broken

The stage list is declared here once, so "what the stages are" is data.
"""
from __future__ import annotations

import argparse
import json
import os
from datetime import datetime, timezone
from pathlib import Path

STAGES = [
    ("S0", "Ingest"), ("S1", "Register"), ("S2", "Probe"), ("S3", "Extract"),
    ("S4", "Calibrate"), ("S5", "Route"), ("S6", "Schedules"), ("S7", "Counts"),
    ("S8", "Measure"), ("S9", "Evidence"), ("S10", "Inventory"), ("S11", "Classify"),
    ("S12", "Compute"), ("S13", "Takeoff"), ("S14", "Markup"),
    ("S15", "Descriptions"), ("S16", "Completeness"), ("S17", "NonMeasured"),
    ("S18", "Price"), ("S19", "Assemble"), ("S20", "Render"), ("S21", "Revise"),
]
ORDER = [s[0] for s in STAGES]
NAMES = dict(STAGES)
# Stages the run skips without failing. S4 (calibrate) sat here from v3.1
# until the grid/level work landed; it now runs, so the set is empty. It is
# kept as a set, not deleted, because enter/resume/show all consult it and a
# future deferral is a one-line change here rather than four edits.
DEFERRED: set[str] = set()


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


class RunState:
    def __init__(self, run_dir: Path):
        self.run_dir = Path(run_dir)
        self.run_dir.mkdir(parents=True, exist_ok=True)
        self.path = self.run_dir / "state.json"
        self.data = self._load()

    def _fresh(self) -> dict:
        return {"schema": "run_state/1", "input_set_hash": None,
                "created_utc": _now(), "stages": {}}

    def _load(self) -> dict:
        if self.path.is_file():
            try:
                return json.loads(self.path.read_text())
            except json.JSONDecodeError:
                pass
        return self._fresh()

    def save(self) -> None:
        tmp = self.path.with_suffix(".tmp")
        tmp.write_text(json.dumps(self.data, indent=1, sort_keys=True))
        os.replace(tmp, self.path)

    def begin(self, input_set_hash: str) -> None:
        """A different input_set_hash is a different run. Reusing state across
        input sets would let a stage from one satisfy a prerequisite in
        another."""
        if self.data.get("input_set_hash") not in (None, input_set_hash):
            self.data = self._fresh()
        self.data["input_set_hash"] = input_set_hash
        self.save()

    def enter(self, stage: str) -> None:
        blocking = self.first_incomplete_before(stage)
        if blocking:
            raise RuntimeError(
                f"cannot enter {stage} ({NAMES[stage]}): {blocking} "
                f"({NAMES[blocking]}) has not exited 0")
        self.data["stages"][stage] = {"entered_utc": _now(), "exit": None,
                                      "artefacts": []}
        self.save()

    def exit(self, stage: str, code: int, artefacts: list[str] | None = None) -> None:
        record = self.data["stages"].setdefault(stage, {"entered_utc": _now()})
        record["exited_utc"] = _now()
        record["exit"] = code
        record["artefacts"] = sorted(artefacts or [])
        self.save()

    def completed(self, stage: str) -> bool:
        return self.data["stages"].get(stage, {}).get("exit") == 0

    def first_incomplete_before(self, stage: str) -> str | None:
        for earlier in ORDER[:ORDER.index(stage)]:
            if earlier in DEFERRED:
                continue
            if not self.completed(earlier):
                return earlier
        return None

    def resume_from(self) -> str | None:
        for stage in ORDER:
            if stage in DEFERRED:
                continue
            if not self.completed(stage):
                return stage
        return None


def main() -> int:
    ap = argparse.ArgumentParser(description="Inspect a run's state.")
    ap.add_argument("command", choices=["show", "check", "reset"])
    ap.add_argument("--run", required=True)
    args = ap.parse_args()
    state = RunState(Path(args.run))
    if args.command == "reset":
        state.data = state._fresh()
        state.save()
        return 0
    broken = 0
    for stage in ORDER:
        record = state.data["stages"].get(stage)
        if record is None:
            mark = "deferred" if stage in DEFERRED else "NOT RUN"
        else:
            mark = f"exit {record.get('exit')}"
            if record.get("exit") not in (0, None):
                broken = 1
        if args.command == "show":
            print(f"  {stage:<4} {NAMES[stage]:<14} {mark}")
    if args.command == "check":
        nxt = state.resume_from()
        print(f"resume from: {nxt or 'complete'}")
    return broken if args.command == "check" else 0


if __name__ == "__main__":
    raise SystemExit(main())
