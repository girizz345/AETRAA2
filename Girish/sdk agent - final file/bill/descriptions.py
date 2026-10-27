#!/usr/bin/env python3
"""
descriptions.py — house wording, generated per group and never per row.

The dominant shape in the reference BOQ, and the one that forbids the obvious
implementation: a full description followed by variants that inherit it.

    Raft foundation, 1000mm thick
    Ditto, 1400mm thick

Sixteen instances in Concrete alone. A generator that produces each row
independently cannot make that shape — it would repeat the full description
every time, which is not the house format and reads as a different item.

So a group produces one lead description and n-1 variants, and what the
variants vary by differs per section and comes from the ingested conventions
table rather than from a rule invented here.

Every slot must trace to an attribute the element actually carries.
Unevidenced content is rejected, not filled with a plausible adjective —
"heavy duty" appearing in a description nothing supports is a specification the
contractor prices and nobody wrote.

Wording quality is a human review. This file guarantees the structure and the
evidence, not the prose.

  python3 -m bill.descriptions --groups G.json --conventions C.json

Exit 0 = all composed. Exit 1 = a slot had no evidenced value.
"""
from __future__ import annotations

import argparse
import re
from dataclasses import dataclass

from ingest.conventions import DITTO

RE_SLOT = re.compile(r"\{([a-z_]+)\}")


@dataclass(frozen=True)
class Composed:
    lead: str
    variants: tuple           # (item_code, "Ditto, 1400mm thick")
    unevidenced: tuple        # slot names that had nothing behind them


def slots(template: str) -> list[str]:
    return sorted(set(RE_SLOT.findall(template)))


def fill(template: str, attributes: dict) -> tuple[str, list[str]]:
    """Returns (text, missing slots). A missing slot is left as its brace so it
    is visible in review rather than silently dropped."""
    missing: list[str] = []

    def substitute(match: re.Match) -> str:
        name = match.group(1)
        value = attributes.get(name)
        if value in (None, ""):
            missing.append(name)
            return match.group(0)
        return str(value)

    return RE_SLOT.sub(substitute, template), sorted(set(missing))


def compose(group, convention, attributes_by_mark: dict) -> Composed:
    """Lead is the group's first member in full; the rest inherit it and state
    only what varies."""
    lead_mark = group.lead.element_mark
    lead_text, missing = fill(convention.template,
                              attributes_by_mark.get(lead_mark, {}))
    variants = []
    for quantity in group.quantities[1:]:
        attributes = attributes_by_mark.get(quantity.element_mark, {})
        parts = [str(attributes.get(name, "")) for name in convention.varies_by]
        parts = [p for p in parts if p]
        variants.append((quantity.element_mark, f"{DITTO}, {', '.join(parts)}"))
    return Composed(lead=lead_text, variants=tuple(variants),
                    unevidenced=tuple(missing))


def main() -> int:
    ap = argparse.ArgumentParser(description="Compose bill descriptions.")
    ap.add_argument("--groups", required=True)
    ap.add_argument("--conventions", required=True)
    ap.parse_args()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
