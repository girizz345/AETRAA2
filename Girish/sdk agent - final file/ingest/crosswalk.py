#!/usr/bin/env python3
"""
crosswalk.py — POMI section letters, and the dispute inside them.

Three sources disagree and the disagreement is not academic: it decides which
letter a line is billed under, and therefore which collection it totals into.

  client v1.2 correction : no section S — comms and ELV bill inside R;
                           furnishings move N -> M; K is Accessories
  reference BOQ          : agrees — "SECTION M - FURNISHINGS", no S
  SKYON take-off         : disagrees — uses "N. FURNISHINGS", "S. COMMS & ELV"

The reference BOQ governs, because it is an issued priced document and the
take-off is working paper. But the mapping is carried as data and validated,
not hardcoded into a render, so that when a fourth source appears it is a
fixture diff and not an archaeology exercise.

  python3 -m ingest.crosswalk --check N

Exit 0 = letter valid. Exit 1 = letter retired or unknown.
"""
from __future__ import annotations

import argparse

# governing letters, from the reference BOQ
SECTIONS: dict[str, str] = {
    "A": "General Requirements",
    "B": "Site Works",
    "C": "Concrete Work",
    "D": "Masonry",
    "E": "Metalwork",
    "F": "Woodwork",
    "G": "Thermal and Moisture Protection",
    "H": "Doors and Windows",
    "J": "Finishes",
    "K": "Accessories",
    "L": "Equipment",
    "M": "Furnishings",
    "N": "Special Construction",
    "P": "Conveying Systems",
    "Q": "Mechanical",
    "R": "Electrical",
}

# letter a legacy source used -> letter that governs, with the reason
RETIRED: dict[str, tuple[str, str]] = {
    "S": ("R", "no section S — comms and ELV bill inside R (client v1.2, "
               "confirmed by the reference BOQ)"),
}

# a source that uses N for furnishings is on the pre-correction scheme
LEGACY_FURNISHINGS = ("N", "M", "furnishings moved N -> M at client v1.2")


def resolve(letter: str) -> str:
    """Legacy letter -> governing letter. Unknown letters raise, because a
    line billed under a letter that does not exist has no collection to total
    into."""
    letter = letter.strip().upper()
    if letter in SECTIONS:
        return letter
    if letter in RETIRED:
        return RETIRED[letter][0]
    raise KeyError(f"section letter not in crosswalk: {letter}")


def title(letter: str) -> str:
    return SECTIONS[resolve(letter)]


def ordered() -> list[str]:
    """POMI order. Bill assembly walks this, never dict insertion order."""
    return sorted(SECTIONS)


def main() -> int:
    ap = argparse.ArgumentParser(description="Check a section letter.")
    ap.add_argument("--check", required=True)
    args = ap.parse_args()
    letter = args.check.strip().upper()
    if letter in RETIRED:
        target, why = RETIRED[letter]
        print(f"{letter} is retired -> {target}: {why}")
        return 1
    if letter not in SECTIONS:
        print(f"{letter} is not a POMI section letter")
        return 1
    print(f"{letter} — {SECTIONS[letter]}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
