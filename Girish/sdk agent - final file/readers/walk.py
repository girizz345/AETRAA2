#!/usr/bin/env python3
"""
walk.py — a folder of drawings to a stable file list.

Stable is the whole point. rglob returns files in filesystem order, which
differs between machines and between runs on the same machine after a copy.
That order reaches input_set_hash, and a machine-dependent run identity makes
every determinism claim downstream untestable.

So: sorted, always, by POSIX-normalised relative path. Non-PDFs are recorded,
not discarded — a report or an authority letter in the folder is not a drawing
but it must not silently go missing either.

  python3 -m readers.walk <dir>

Exit 0 = files found. Exit 2 = not a directory, or empty.
"""
from __future__ import annotations

import argparse
import sys
from dataclasses import dataclass
from pathlib import Path

DRAWING_SUFFIX = ".pdf"
IGNORE_NAMES = {".DS_Store", "Thumbs.db"}


@dataclass(frozen=True)
class FoundFile:
    doc_id: str          # POSIX relative path — the stable identity
    path: Path
    is_drawing: bool
    folder: str          # first path segment: the discipline folder


def walk(root: Path) -> list[FoundFile]:
    from spine.files import _page_count, _split, is_project_file, set_page_id

    root = Path(root)
    out: list[FoundFile] = []
    for path in sorted(p for p in root.rglob("*") if p.is_file()):
        if path.name in IGNORE_NAMES or path.name.startswith("._"):
            continue
        if not is_project_file(path, root):      # Reports/ is output, not input
            continue
        rel = path.relative_to(root).as_posix()
        parts = rel.split("/")
        folder = parts[0] if len(parts) > 1 else ""
        is_drawing = path.suffix.lower() == DRAWING_SUFFIX
        pages = _page_count(path) if is_drawing else 1
        if pages > 1:
            # a combined set is its sheets, one per page (spine.files)
            for k, page_path in enumerate(_split(path, pages), start=1):
                out.append(FoundFile(doc_id=set_page_id(rel, k, pages),
                                     path=page_path, is_drawing=True, folder=folder))
            continue
        out.append(FoundFile(doc_id=rel, path=path, is_drawing=is_drawing,
                             folder=folder))
    return out


def summarise(files: list[FoundFile]) -> dict[str, int]:
    """Per-folder drawing counts. This is what reconciles a stated package size
    against what is actually on disk — the 403 vs 385 question is answered
    here, not guessed at."""
    counts: dict[str, int] = {}
    for found in files:
        if found.is_drawing:
            counts[found.folder] = counts.get(found.folder, 0) + 1
    return dict(sorted(counts.items()))


def main() -> int:
    ap = argparse.ArgumentParser(description="List a drawing folder, stably.")
    ap.add_argument("directory")
    args = ap.parse_args()
    root = Path(args.directory)
    if not root.is_dir():
        print(f"ERROR: not a directory: {root}", file=sys.stderr)
        return 2
    files = walk(root)
    drawings = [f for f in files if f.is_drawing]
    if not files:
        print(f"ERROR: nothing under {root}", file=sys.stderr)
        return 2
    for folder, count in summarise(files).items():
        print(f"  {folder or '(root)':<40} {count}")
    print(f"\n{len(drawings)} drawings, {len(files) - len(drawings)} other files")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
