#!/usr/bin/env python3
"""
clause_normalise.py — the fixture's own fields into the shape the table needs.

The clause fixture carries what the corpus says: `text`, `unit_raw`
("NR — enumerated — a count"), `formula_raw` ("N = count"), `group`,
`in_practice`. The table needs `unit`, `shape`, `title`, `thresholds`,
`source`. Something has to do that conversion, and until this file existed
nothing did — `ClauseTable.load` read keys the fixture does not have, so the
table raised KeyError on its first row and had never once been loaded. Stage 0
reported "314 clauses" by reading the JSON directly, which is why the mismatch
stayed invisible.

The conversion is deliberately narrow. It maps what it recognises and leaves
what it does not as None, because:

  * a clause with no arithmetic is not a defect — 104 of the 314 are
    definitional, administrative or rule clauses that govern how OTHER
    quantities are calculated. They must load, carry no shape, and be refused
    if anything tries to compute from them.
  * a formula this grammar cannot express is reported, never approximated.
    Mapping "V = V_designed_void − Σ V_existing_voids" onto a product because it
    has three symbols in it would be an invented formula, which is the one thing
    ingest.formulas exists to prevent.

Where a clause states two units ("M / NR", "NR / M2"), the FIRST is taken and
the alternative recorded — DECISIONS.md decision 6, the house takes the limb
POMI states first.

  python3 -m ingest.clause_normalise --table data/clauses.json --report

Exit 0 = every row normalised. Exit 1 = rows could not be normalised.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

from ingest.formulas import SHAPES

# unit_raw's leading token -> the bill's unit. "RULE" and the empty token are
# clauses that measure nothing and correctly carry no unit.
UNIT_TOKENS: dict[str, str | None] = {
    "NR": "nr", "M": "m", "M2": "m2", "M3": "m3", "KG": "kg", "T": "tonne",
    "ITEM": "item", "SUM": "item", "SCHEDULE": "item",
    "RULE": None, "": None,
}

# formula_raw, reduced to its head, -> a shape in the grammar. Ordered: the
# first pattern that matches wins, so the specific forms precede the general.
FORMULA_PATTERNS: tuple[tuple[str, str], ...] = (
    (r"^N\s*=\s*count", "count"),
    (r"^N\s*=\s*1\b", "count"),
    (r"^(?:L|Len|Length)\s*=\s*(?:Σ|SUM)", "sum_length"),
    (r"^(?:L|Len)\s*=\s*formation", "sum_length"),
    (r"^(?:L|Len)\s*=\s*.*measured", "sum_length"),
    (r"^A\s*=\s*(?:Σ|SUM)", "sum_area"),
    (r"^A\s*=\s*A_", "sum_area"),
    (r"^A\s*=\s*area\b", "sum_area"),
    (r"^A_net\s*=", "sum_area"),
    (r"^A\s*=\s*L_?\w*\s*[×x]\s*W", "l_x_w"),
    (r"^A\s*=\s*L_centreline", "sum_area"),
    (r"^V\s*=\s*(?:Σ|SUM)", "sum_volume"),
    (r"^V\w*\s*=\s*V_", "sum_volume"),
    (r"^V\s*=\s*L\s*[×x]\s*W\w*\s*[×x]\s*D", "l_x_w_x_d"),
    # C2.1 — poured concrete by volume, "V = N × L × W × T". Unmatched, the
    # one clause every in-situ beam, column, wall and slab is measured under
    # was not computable, was never offered to the model, and 69 structural
    # elements came back "no listed clause governs it".
    (r"^V\s*=\s*N\w*\s*[×x]\s*L\w*\s*[×x]\s*W\w*\s*[×x]\s*T", "n_x_l_x_w_x_t"),
    (r"^V\s*=\s*N\w*\s*[×x]\s*L\w*\s*[×x]\s*W\w*\s*[×x]\s*D", "n_x_l_x_w_x_d"),
    # WEIGHT BEFORE LENGTH. Reinforcement and metalwork are MEASURED by length
    # and BILLED by weight, through GP5.4's mass per metre — "W = Σ (N_bars ×
    # L_bar_INCLUDING_LAPS × m_per_m(Ø))". Matched against the generic "W = Σ"
    # first, all six of those clauses collapsed to a length sum and then
    # contradicted their own kg unit. C3.1 is the bar reinforcement clause, so
    # that mis-mapping would have billed the whole of a project's rebar in
    # metres.
    (r"^W\s*=\s*(?:Σ|SUM)?\s*\(?\s*(?:N\w*\s*[×x]\s*)?L\w*\s*[×x]\s*m_per_m",
     "sum_n_l_mass"),
    (r"^W\s*=.*m_per_m\b", "sum_n_l_mass"),
    # an accumulation of WEIGHTS, not a length converted to one
    (r"^W\s*=\s*(?:Σ|SUM)\s*W", "sum_mass"),
    (r"^(?:W|Depth|d)\s*=\s*(?:Σ|SUM)", "sum_length"),
)

# A clause whose "formula" is a pointer to another clause measures nothing of
# its own. It is not unparsed — it is a cross-reference, and saying so is the
# difference between a gap and a defect.
CROSS_REFERENCE = re.compile(
    r"^(?:per\s+[A-Z]+\d|measured to the relevant clauses|see\s+[A-Z]+\d)",
    re.IGNORECASE)

# The corpus parse let the PAGE FOOTER bleed into clause fields — "AETRAA POMI
# Take-off — the complete prompt set   207" appears inside B9.1's formula and is
# prefixed to D3.1's text. These are real clauses with contaminated fields, not
# junk rows: B9.1 is the excavation-by-volume rule and dropping it would remove
# the rule the whole of section B rests on.
#
# So the noise is STRIPPED and counted. Counted because a contaminated fixture
# is a finding about the corpus parse, and a silent clean is indistinguishable
# from a silent error — the parser's own docstring says so.
PAGE_NOISE = re.compile(
    r"\s*AETRAA\s+POMI\s+Take-?off\s*[—-]\s*the\s+complete\s+prompt\s+set"
    r"\s*\d*\s*", re.IGNORECASE)


def strip_noise(value: str | None) -> tuple[str | None, bool]:
    """(cleaned, was_contaminated)."""
    if not value:
        return value, False
    cleaned = PAGE_NOISE.sub(" ", value).strip()
    cleaned = re.sub(r"\s{2,}", " ", cleaned)
    return (cleaned or None), cleaned != value.strip()

THRESHOLD = re.compile(
    r"(?P<role>[A-Za-z_]+)\s*(?:of\s+)?"
    r"(?P<op>[≥≤<>]=?|not exceeding|exceeding|less than|greater than|more than)"
    r"\s*(?P<value>[0-9]+(?:\.[0-9]+)?)\s*(?P<unit>m[²³23]?)", re.IGNORECASE)

OPS = {"exceeding": ">", "not exceeding": "<=", "less than": "<",
       "greater than": ">", "more than": ">", "≥": ">=", "≤": "<=",
       ">": ">", "<": "<", ">=": ">=", "<=": "<="}


def unit_of(unit_raw: str | None) -> tuple[str | None, tuple]:
    """(unit, alternatives). The first limb governs; the rest are recorded."""
    if not unit_raw:
        return None, ()
    head = unit_raw.split("—")[0].split("-")[0].strip()
    if not head:
        return None, ()
    limbs = [limb.strip().upper() for limb in head.split("/") if limb.strip()]
    units = []
    for limb in limbs:
        token = re.sub(r"[^A-Z0-9]", "", limb.split("(")[0].split("×")[0])
        units.append(UNIT_TOKENS.get(token, None))
    primary = units[0] if units else None
    alternatives = tuple(u for u in units[1:] if u)
    return primary, alternatives


def shape_of(formula_raw: str | None) -> tuple[str | None, str]:
    """(shape, why). `why` is "matched", "cross-reference", "no arithmetic" or
    "unexpressible" — and the last of those is reported, never approximated."""
    if not formula_raw or not formula_raw.strip():
        return None, "no arithmetic"
    # Match against the WHOLE formula, not a truncated head. Splitting on the
    # first "(" to get a tidy head silently cut "W = Σ (N_bars × L_bar ×
    # m_per_m(Ø))" down to "W = Σ", which then matched the generic length sum —
    # so C3.1, the bar reinforcement clause, was billed in metres while stating
    # kilogrammes. The parenthesis is where the arithmetic lives.
    whole = " ".join(formula_raw.split())
    if CROSS_REFERENCE.match(whole):
        return None, "cross-reference"
    # a qualified formula is the same arithmetic under a condition the clause
    # states in words: "flat: A = L × W", "regular: A = L × W",
    # "if Ø ≤ 60 mm → L = Σ L". The qualifier is the clause's own scope (it
    # is read separately, as a threshold where numeric); the arithmetic after
    # it is what the shape is.
    whole = re.sub(r"^[A-Za-z]+:\s*", "", whole)
    whole = re.sub(r"^if\b.*?(?:→|->|then)\s*", "", whole, flags=re.IGNORECASE)
    for pattern, shape in FORMULA_PATTERNS:
        if re.match(pattern, whole, re.IGNORECASE):
            if shape not in SHAPES:
                return None, "unexpressible"
            basis = ("weight via mass per metre, GP5.4"
                     if shape == "sum_n_l_mass" else "matched")
            return shape, basis
    return None, "unexpressible"


def thresholds_of(text: str | None) -> tuple:
    """Conditional existence, read off the clause's own words. Only explicit
    numeric thresholds — "voids ≥ 1.00 m²" — never an implied one."""
    if not text:
        return ()
    out = []
    for match in THRESHOLD.finditer(text):
        op = OPS.get(match.group("op").lower(), match.group("op"))
        unit = match.group("unit").lower().replace("²", "2").replace("³", "3")
        out.append((match.group("role").lower(), op, match.group("value"), unit))
    return tuple(out)


def title_of(row: dict) -> str:
    """The short name a bill heading would use. `in_practice` where the corpus
    gives one, else the clause's first sentence."""
    practice = (row.get("in_practice") or "").strip()
    if practice:
        return practice.split(".")[0].strip()[:120]
    text = (row.get("text") or "").strip()
    return text.split(".")[0].strip()[:120] or row["id"]


def normalise(row: dict) -> dict:
    text, text_dirty = strip_noise(row.get("text"))
    formula, formula_dirty = strip_noise(row.get("formula_raw"))
    unit, alternatives = unit_of(row.get("unit_raw"))
    shape, why = shape_of(formula)
    return {
        "contaminated": text_dirty or formula_dirty,
        "id": row["id"],
        "section": row["section"],
        "title": title_of({**row, "text": text}),
        "unit": unit,
        "unit_alternatives": list(alternatives),
        "shape": shape,
        "shape_basis": why,
        "thresholds": [list(t) for t in thresholds_of(text)],
        "deduction_rule": formula if "void" in (formula or "").lower() else None,
        "grouping": ["class"] if "per class" in (formula or "").lower() else [],
        "source": f"clauses.json:{row['id']} group {row.get('group')}",
        "text": text,
        "formula_raw": formula,
    }


def normalise_table(raw: dict) -> tuple[list, list]:
    """(rows, problems). A row that is not a clause at all is a problem, not a
    clause with missing fields."""
    rows, problems = [], []
    for row in raw["clauses"]:
        normalised = normalise(row)
        if not normalised["text"] and not normalised["unit"]:
            problems.append((row.get("id"), "no text and no unit — nothing to "
                                            "normalise"))
            continue
        rows.append(normalised)
    return rows, problems


def main() -> int:
    ap = argparse.ArgumentParser(description="Normalise the clause fixture.")
    ap.add_argument("--table", required=True)
    ap.add_argument("--report", action="store_true")
    ap.add_argument("--unexpressible", action="store_true")
    args = ap.parse_args()

    raw = json.loads(Path(args.table).read_text())
    rows, problems = normalise_table(raw)

    if args.unexpressible:
        for row in rows:
            if row["shape_basis"] == "unexpressible":
                print(f"  {row['id']:<8} {row['unit'] or '--':<5} "
                      f"{row['source']}")
        return 0

    if args.report:
        import collections
        print(f"  rows in fixture   {len(raw['clauses'])}")
        print(f"  normalised        {len(rows)}")
        for pid, why in problems:
            print(f"  REJECTED {pid}: {why}")
        dirty = [r["id"] for r in rows if r["contaminated"]]
        print(f"  contaminated      {len(dirty)} row(s) carried the corpus page "
              f"footer in a field; stripped: {', '.join(dirty)}")
        units = collections.Counter(r["unit"] or "(none)" for r in rows)
        basis = collections.Counter(r["shape_basis"] for r in rows)
        print(f"\n  units             "
              f"{', '.join(f'{k}={v}' for k, v in sorted(units.items()))}")
        print(f"  formula basis     "
              f"{', '.join(f'{k}={v}' for k, v in sorted(basis.items()))}")
        print(f"  computable        "
              f"{sum(1 for r in rows if r['shape'] and r['unit'])}")
        print(f"  with thresholds   "
              f"{sum(1 for r in rows if r['thresholds'])}")
        print(f"  with a deduction  "
              f"{sum(1 for r in rows if r['deduction_rule'])}")
        return 1 if problems else 0

    print(f"{len(rows)} clauses normalised, {len(problems)} rejected")
    return 1 if problems else 0


if __name__ == "__main__":
    raise SystemExit(main())
