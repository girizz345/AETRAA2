#!/usr/bin/env python3
"""
cli.py — boq run <dir>, and the flags that make the pipeline debuggable.

Path validation happens here and is stricter than it looks necessary: the
directory must exist, be a directory, and contain at least one PDF. A run
started against a typo'd path that produces an empty register is a confusing
twenty minutes, and one line of validation removes it.

Dev flags exist so a failure can be localised without a full run:

  --only <discipline>   one discipline's sheets
  --limit N             first N sheets, in stable order
  --no-model            exercise the deterministic path alone. Everything the
                        model would have decided becomes a gap, so the run
                        completes and shows exactly how much of the package
                        needs a judgement.
  --no-price            quantities only, unpriced bill
  --resume              continue from the first incomplete stage
  --verbose             debug to console; the file log is always debug

  boq run <dir> [flags]
  boq status --run runs/<id>

Exit 0 = complete. Exit 1 = completed with gaps. Exit 2 = bad input.
Exit 3 = a gate blocked issue.
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path


def build_parser() -> argparse.ArgumentParser:
    ap = argparse.ArgumentParser(prog="boq", description="Build a bill of "
                                 "quantities from a folder of drawings.")
    sub = ap.add_subparsers(dest="command", required=True)

    run = sub.add_parser("run", help="run the pipeline over a drawing folder")
    run.add_argument("directory")
    run.add_argument("--out", default="runs")
    run.add_argument("--only", help="limit to one discipline")
    run.add_argument("--limit", type=int, help="first N sheets, stable order")
    run.add_argument("--no-model", action="store_true",
                     help="deterministic path only; judgements become gaps")
    run.add_argument("--no-price", action="store_true")
    run.add_argument("--resume", action="store_true")
    run.add_argument("--verbose", action="store_true")

    status = sub.add_parser("status", help="show a run's stage record")
    status.add_argument("--run", required=True)
    return ap


def validate_directory(path: Path) -> str | None:
    """Returns a problem, or None. Written as its own function so the runner
    can re-prompt without duplicating the rules."""
    if not path.exists():
        return f"no such path: {path}"
    if not path.is_dir():
        return f"not a directory: {path}"
    from spine.files import project_pdfs
    if not project_pdfs(path):
        return f"no PDF files under {path}"
    return None


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    if args.command == "status":
        from spine.runstate import main as status_main
        return status_main()
    problem = validate_directory(Path(args.directory))
    if problem:
        print(f"ERROR: {problem}", file=sys.stderr)
        return 2
    from pipeline import run_pipeline
    return run_pipeline(args)


if __name__ == "__main__":
    raise SystemExit(main())
