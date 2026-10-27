#!/usr/bin/env python3
"""
lettering.py — item letters, measured from the reference BOQ rather than assumed.

Observed run: A B C D E F G H J K L M N P Q R S T U V.

I and O are skipped because they are ambiguous with 1 and 0 in a document that
is read aloud on site and typed into a tender return. The sequence restarts on
every page, which is why a letter is only meaningful together with its page
reference — item C on page 2/2/3 and item C on 2/2/4 are different items.

A page needing more than 20 items has to break, and the break is a pagination
decision, not a lettering one. This module refuses rather than inventing AA.

  python3 -m bill.lettering --count 12

Exit 0 = sequence issued. Exit 1 = more items than letters on one page.
"""
from __future__ import annotations

import argparse

SEQUENCE = "ABCDEFGHJKLMNPQRSTUV"
SKIPPED = ("I", "O")


def letters(count: int) -> list[str]:
    """The first `count` letters. Raises rather than wrapping to AA."""
    if count < 0:
        raise ValueError("count must not be negative")
    if count > len(SEQUENCE):
        raise ValueError(
            f"{count} items on one page; the sequence holds {len(SEQUENCE)}. "
            "Break the page rather than extending the sequence.")
    return list(SEQUENCE[:count])


def letter_at(index: int) -> str:
    return letters(index + 1)[index]


def is_valid(letter: str) -> bool:
    return letter in SEQUENCE


def main() -> int:
    ap = argparse.ArgumentParser(description="Issue an item-letter sequence.")
    ap.add_argument("--count", type=int, required=True)
    args = ap.parse_args()
    try:
        issued = letters(args.count)
    except ValueError as exc:
        print(exc)
        return 1
    print(" ".join(issued))
    print(f"skipped: {', '.join(SKIPPED)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
