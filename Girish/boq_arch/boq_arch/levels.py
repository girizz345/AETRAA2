"""Storey levels and heights from the section's level markers.

Storey height = level of the storey above - level of this storey (DERIVED from two
READ levels), cross-checked against the dimension chain printed beside them.
"""
from __future__ import annotations

import re

from .records import Gap

NAME_KEYS = [
    (r"BASEMENT", "B1"), (r"GROUND", "GF"), (r"\b1ST\b|FIRST", "1F"), (r"\b2ND\b|SECOND", "2F"),
    (r"\b3RD\b|THIRD", "3F"), (r"\b4TH\b|FOURTH", "4F"), (r"\b5TH\b|FIFTH", "5F"), (r"\b6TH\b|SIXTH", "6F"),
    (r"LOWER\s+R", "LOWER ROOF"),
    (r"UPPER\s+R", "UPPER ROOF"), (r"TOP\s+R", "TOP ROOF"),
]


WORD_FLOORS = {"SEVENTH": 7, "EIGHTH": 8, "NINTH": 9, "TENTH": 10, "ELEVENTH": 11, "TWELFTH": 12}


def storey_key(name: str) -> str | None:
    u = name.upper()
    for pat, key in NAME_KEYS:
        if re.search(pat, u):
            return key
    # any other floor by its number or its word, as the register names plans: 7TH, 10TH, SEVENTH ... -> 7F
    m = re.search(r"\b(\d{1,2})(?:ST|ND|RD|TH)\b", u)
    if m:
        return f"{int(m.group(1))}F"
    w = next((n for word, n in WORD_FLOORS.items() if re.search(rf"\b{word}\b", u)), None)
    return f"{w}F" if w else None


def _value(s: str) -> float | None:
    m = re.search(r"([+\-±]?)\s*(\d+\.\d+)", s.replace("−", "-"))
    if not m:
        return None
    v = float(m.group(2))
    return -v if m.group(1) == "-" else v


def storeys(reading: dict, sheet: str, gaps: list[Gap]) -> dict[str, dict]:
    """key -> {level, height, basis}. Only floor/slab levels (FFL, SSL) define storeys."""
    lv: dict[str, float] = {}
    for r in reading.get("levels", []):
        if r.get("datum", "").upper() not in ("FFL", "SSL"):
            continue
        k, v = storey_key(r["name"]), _value(r["value"])
        if k and v is not None:
            lv.setdefault(k, v)
    order = sorted(lv, key=lambda k: lv[k])
    chain = {(storey_key(c["from"]), storey_key(c["to"])): c["mm"] for c in reading.get("chain", [])}
    out = {}
    for a, b in zip(order, order[1:]):
        h = round(lv[b] - lv[a], 3)
        basis = f"{b} {lv[b]:+.2f} less {a} {lv[a]:+.2f} ({sheet})"
        stated = chain.get((a, b))
        if stated is not None and abs(stated / 1000 - h) > 0.01:
            gaps.append(Gap(sheet, f"storey height {a}",
                            f"levels give {h:.2f} m but the dimension chain states {stated / 1000:.2f} m"))
        elif stated is not None:
            basis += f"; agrees with the {stated} mm dimension"
        out[a] = {"level": lv[a], "height": h, "basis": basis}
    if order:
        out[order[-1]] = {"level": lv[order[-1]], "height": None, "basis": "top level read"}
    return out
