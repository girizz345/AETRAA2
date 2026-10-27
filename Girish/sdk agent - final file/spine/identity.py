#!/usr/bin/env python3
"""
identity.py — input_set_hash. Without it, "same inputs, same outputs" is an
unfalsifiable claim.

sha256 over the sorted pairs of (doc_id, file sha256). Sorted, because a
directory walk returns files in whatever order the filesystem offers and that
order differs between machines — which would make the hash, and therefore the
run identity, machine-dependent.

The hash is the run's name. A new input set is a new run: state from one input
set may never satisfy a prerequisite in another.

  python3 -m spine.identity <dir>

Exit 0 = hash printed. Exit 2 = directory unreadable or empty.
"""
from __future__ import annotations

import argparse
import hashlib
import sys
from pathlib import Path

CHUNK = 1 << 20
HEAD = 1 << 20          # bytes hashed from the start of a file
TAIL = 1 << 16          # and from its end (a PDF's xref and trailer live there)


def file_sha256(path: Path) -> str:
    """The identity of one file: its size, its first megabyte and its last
    64 KB, hashed together.

    Not the whole content. A package is a set of drawings, and its run id
    must be the same on every run over the same drawings — that is all the
    id is for. Hashing every byte of a 5.4 GB package (specification
    volumes, IFC exports) took longer than reading the drawings themselves
    and held one run for twenty minutes before it had begun. A PDF that
    changes in any way changes its size, its xref table or its first
    megabyte; a PDF re-saved unchanged does not. Two different sheets never
    share all three. Content-based still — a renamed copy keeps its id."""
    digest = hashlib.sha256()
    size = path.stat().st_size
    digest.update(str(size).encode("ascii"))
    digest.update(b"\x00")
    with path.open("rb") as handle:
        digest.update(handle.read(HEAD))
        if size > HEAD + TAIL:
            handle.seek(size - TAIL)
            digest.update(handle.read(TAIL))
        elif size > HEAD:
            digest.update(handle.read())
    return digest.hexdigest()


def input_set_hash(pairs: list[tuple[str, str]]) -> str:
    """pairs: (doc_id, file_sha256). Sorted here so callers cannot get it
    wrong."""
    digest = hashlib.sha256()
    for doc_id, sha in sorted(pairs):
        digest.update(doc_id.encode("utf-8"))
        digest.update(b"\x00")
        digest.update(sha.encode("ascii"))
        digest.update(b"\n")
    return digest.hexdigest()


def hash_directory(root: Path, suffix: str = ".pdf") -> tuple[str, list[tuple[str, str]]]:
    from spine.files import is_project_file

    # the agent's own output under Reports/ is not input: a package whose
    # drawings have not changed keeps its run id after it has been issued
    # the suffix is matched ignoring case: rglob is case-sensitive on a Mac,
    # and a package of "A-101.PDF" files hashed as empty there
    files = sorted(p for p in root.rglob("*")
                   if p.suffix.lower() == suffix.lower()
                   and p.is_file() and is_project_file(p, root))
    pairs = [(str(p.relative_to(root)).replace("\\", "/"), file_sha256(p)) for p in files]
    return input_set_hash(pairs), pairs


def main() -> int:
    ap = argparse.ArgumentParser(description="Freeze a run identity.")
    ap.add_argument("directory")
    ap.add_argument("--suffix", default=".pdf")
    args = ap.parse_args()
    root = Path(args.directory)
    if not root.is_dir():
        print(f"ERROR: not a directory: {root}", file=sys.stderr)
        return 2
    digest, pairs = hash_directory(root, args.suffix)
    if not pairs:
        print(f"ERROR: no {args.suffix} files under {root}", file=sys.stderr)
        return 2
    print(f"{len(pairs)} files")
    print(digest)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
