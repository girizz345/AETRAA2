#!/usr/bin/env python3
"""
runner.py — the throwaway terminal menu. A thin shell over the package.

Explicitly temporary. Every function it calls is a library function, so the
later UI imports the same code rather than reimplementing the sequence — which
is the failure that produces two pipelines that disagree.

  1. Make BOQ  -> path prompt (validated, re-prompts on a bad path)
                  -> metadata prompts
                  -> run with stage and progress display
                  -> print artefact paths and gap count
  Q. Quit

Nothing here decides anything. If a choice is being made in this file, it is in
the wrong file.

  python3 -m runner
"""
from __future__ import annotations

from pathlib import Path

from spine.cli import validate_directory

BANNER = "AETRAA — Bill of Quantities"
MENU = ("  1. Make BOQ", "  Q. Quit")


def prompt_directory() -> Path | None:
    while True:
        raw = input("  Drawings folder: ").strip()
        if raw.lower() in ("q", "quit", ""):
            return None
        path = Path(raw).expanduser()
        problem = validate_directory(path)
        if problem is None:
            return path
        print(f"  {problem}")


def prompt_metadata() -> dict:
    return {"client": input("  Client: ").strip(),
            "project": input("  Project: ").strip(),
            "package": input("  Package: ").strip(),
            "building": input("  Building or scope: ").strip()}


def main() -> int:
    print(f"\n{BANNER}\n")
    while True:
        for line in MENU:
            print(line)
        choice = input("\n  > ").strip().lower()
        if choice in ("q", "quit"):
            return 0
        if choice != "1":
            continue
        directory = prompt_directory()
        if directory is None:
            continue
        prompt_metadata()
        print("  pipeline not yet wired — see pipeline.py")


if __name__ == "__main__":
    raise SystemExit(main())
