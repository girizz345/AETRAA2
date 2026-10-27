"""Assemblies (PlanSwift's custom formulas): clause -> unit, formula, deduction rule, description.

Once an element is classified to a POMI clause, how its quantity becomes a bill line is looked up
here from the clause table (data/clauses.json, the POMI clause corpus of the existing build) - never
re-derived per item. measure.py asks for a clause's unit; build() checks every item against its
clause: unit, the shape of its dimension lines, and the words its description must carry.
"""
from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path

from .records import Gap, Item

UNITS = {"NR": "nr", "M": "m", "M2": "m2", "M3": "m3", "ITEM": "item", "KG": "kg", "SUM": "sum"}

# what a description must state, by clause (POMI: enumerated items give size and type; areas state
# thickness or the class the clause splits them into). A requirement is a regex over the item's
# heading, description paragraph, sub-heading and line together.
DESCRIBE = {
    "H1.1": [("size", r"\d+\s*mm\s*(\+\s*\d+\s*mm\s*)?x\s*\d+\s*mm"), ("type reference", r"\btype\s+\S+")],
    "H2.1": [("size", r"\d+\s*mm\s*(\+\s*\d+\s*mm\s*)?x\s*\d+\s*mm"), ("type reference", r"\btype\s+\S+")],
    "D2.1": [("thickness", r"\d+\s*mm\s+thick")],
    "G2.1": [("class: flat / sloping / vertical", r"flat|horizontal|sloping|vertical")],
    "J3.1.1": [("class: floors", r"floor")],
    "J3.1.2": [("class: walls", r"wall")],
    "J3.1.3": [("class: ceilings", r"ceiling")],
}


@dataclass
class Assembly:
    clause: str
    unit: str
    formula: str            # count / length / area / volume / item
    formula_text: str
    deduct_threshold: float | None
    describe: list = field(default_factory=list)
    text: str = ""


@lru_cache(maxsize=1)
def _table() -> dict:
    d = json.loads((Path(__file__).parent / "data" / "clauses.json").read_text(encoding="utf-8"))
    return {c["id"]: c for c in d["clauses"]}


def _formula(raw: str | None, unit: str) -> str:
    r = (raw or "").replace(" ", "")
    if r.startswith("N=") or unit == "nr":
        return "count"
    if r.startswith(("Len=", "L=")) or unit == "m":
        return "length"
    if "A=" in r or unit == "m2":
        return "area"
    if "V=" in r or unit == "m3":
        return "volume"
    return "item"


def assembly(clause: str, deduct_threshold_m2: float = 1.0) -> Assembly:
    """Look a clause up. 'J3.1.2' is class 2 of clause J3.1."""
    table = _table()
    base = clause if clause in table else ".".join(clause.split(".")[:2])
    c = table.get(base)
    if c is None:
        raise KeyError(f"clause {clause} is not in the clause table")
    unit = UNITS.get((c.get("unit_raw") or "").split(" ")[0], "")
    raw = c.get("formula_raw") or ""
    deduct = deduct_threshold_m2 if re.search(r"GP3\.2|void", raw + " " + c.get("text", ""), re.I) else None
    return Assembly(clause, unit, _formula(raw, unit), raw, deduct, DESCRIBE.get(clause, DESCRIBE.get(base, [])),
                    c.get("text", ""))


def unit_of(clause: str) -> str:
    return assembly(clause).unit


def check(items: list[Item], decisions: dict) -> list[Gap]:
    """Every item against its clause: unit, dimension-line shape, mandatory description."""
    out = []
    for it in items:
        try:
            a = assembly(it.clause, decisions.get("deduct_threshold_m2", 1.0))
        except KeyError as e:
            out.append(Gap("(rules)", it.description, str(e), it.section))
            continue
        if a.unit and it.unit != a.unit:
            out.append(Gap("(rules)", it.description, f"billed in {it.unit} but {it.clause} measures in {a.unit}",
                           it.section))
        for ln in it.lines:
            if ln.memo:
                continue
            dims = [d for d in (ln.L, ln.W, ln.H) if d is not None]
            if a.formula == "count" and (dims or (ln.qty_each is not None and ln.qty_each != int(ln.qty_each))):
                out.append(Gap(ln.ref, it.description, f"{it.clause} is enumerated; a line carries dimensions "
                                                       f"or a part count", it.section))
            if a.formula == "length" and len(dims) > 1:
                out.append(Gap(ln.ref, it.description, f"{it.clause} is by length; a line multiplies two "
                                                       f"dimensions", it.section))
            if a.formula == "area" and len(dims) == 1:
                out.append(Gap(ln.ref, it.description, f"{it.clause} is by area; a line has one dimension",
                               it.section))
        text = " ".join([*it.heads, it.uhead, it.group_desc, it.subgroup, it.description]).lower()
        for what, pat in a.describe:
            if not re.search(pat, text, re.I):
                out.append(Gap("(rules)", it.description, f"{it.clause} requires the description to state {what}",
                               it.section))
    return out
