#!/usr/bin/env python3
"""
gates.py — the reconciliation gates, as data.

Four families, all of them checks on the bill rather than on the drawings:

  G+.25–28  substantive scans — fabrication tokens, confidence honesty, the
            percentage/factor scan that catches a formwork reuse factor entering
            a quantity, and the pattern-check rule that forbids adding an
            element because it is customary.
  G+.29     the completeness matrix — evidence of a kind must produce output of
            the corresponding kind. The only gate that looks for what is NOT
            there.
  G+.30     twelve mass-balance checks with their tolerances.
  G+.31/32  units and rates, which live in ingest.units and ingest.rates
            because both are consulted row by row during pricing.

Carried as data so a tolerance can be changed without touching code, and so the
matrix can be read by a surveyor who does not read Python.

  python3 -m ingest.gates --data data/gates.json --list
  python3 -m ingest.gates --data data/gates.json --scan "assumed 150mm thick"

Exit 0 = clean. Exit 1 = a scan found something. Exit 2 = data unreadable.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import dataclass
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent / "data" / "gates.json"


@dataclass(frozen=True)
class CompletenessRow:
    evidence_kind: str
    evidence: str
    must_produce: tuple
    min_rows: int
    any_of: bool
    all_of: bool
    on_zero: str
    source: str

    @property
    def sections(self) -> tuple:
        return self.must_produce


@dataclass(frozen=True)
class MassBalance:
    n: int
    check: str
    tolerance_pct: float | None
    rule: str | None
    on_breach: str

    def breached(self, expected: float, actual: float) -> bool:
        """A tolerance of 0 means exact. A check with no tolerance is a rule,
        not an arithmetic comparison, and is judged by its own handler."""
        if self.tolerance_pct is None:
            return False
        if expected == 0:
            return actual != 0
        return abs(actual - expected) / abs(expected) * 100 > self.tolerance_pct

    def variance_pct(self, expected: float, actual: float) -> float | None:
        if expected == 0:
            return None
        return (actual - expected) / abs(expected) * 100


@dataclass(frozen=True)
class TokenHit:
    token: str
    where: int


class Gates:
    def __init__(self, raw: dict):
        self._raw = raw
        self._completeness = [
            CompletenessRow(
                evidence_kind=r["evidence_kind"], evidence=r["evidence"],
                must_produce=tuple(r["must_produce"]),
                min_rows=int(r.get("min_rows", 1)),
                any_of=bool(r.get("any_of")), all_of=bool(r.get("all_of")),
                on_zero=r.get("on_zero", "FAIL"),
                source=r.get("source", ""))
            for r in raw["completeness"]["rows"]]
        self._mass = [
            MassBalance(n=c["n"], check=c["check"],
                        tolerance_pct=c.get("tolerance_pct"),
                        rule=c.get("rule"), on_breach=c["on_breach"])
            for c in raw["mass_balance"]["checks"]]
        self._tokens = tuple(raw["substantive"]["G+.25"]["tokens"])
        self._token_re = re.compile(
            "|".join(re.escape(t) for t in self._tokens), re.IGNORECASE)

    # ── G+.29 ───────────────────────────────────────────────────────────
    def completeness_rows(self) -> list[CompletenessRow]:
        return list(self._completeness)

    def matrix(self) -> dict[str, tuple]:
        """evidence kind -> the sections it must produce rows in."""
        return {r.evidence_kind: r.sections for r in self._completeness}

    def row(self, evidence_kind: str) -> CompletenessRow:
        for r in self._completeness:
            if r.evidence_kind == evidence_kind:
                return r
        raise KeyError(f"no completeness row for {evidence_kind!r}")

    # ── G+.30 ───────────────────────────────────────────────────────────
    def mass_balance(self) -> list[MassBalance]:
        return list(self._mass)

    def mass_check(self, n: int) -> MassBalance:
        for c in self._mass:
            if c.n == n:
                return c
        raise KeyError(f"no mass-balance check {n}")

    # ── G+.25–28 ────────────────────────────────────────────────────────
    def fabrication_tokens(self) -> tuple:
        return self._tokens

    def scan(self, text: str | None, *, quoted_label: bool = False
             ) -> list[TokenHit]:
        """G+.25. The exception is real and narrow: the token sits inside a
        quoted drawing label, where "TYPICAL FLOOR PLAN" is the sheet's own
        name and not a fabrication."""
        if not text or quoted_label:
            return []
        return [TokenHit(m.group(0), m.start())
                for m in self._token_re.finditer(text)]

    def confidence_levels(self) -> dict:
        return dict(self._raw["substantive"]["G+.26"]["levels"])

    def forbidden_derivations(self) -> tuple:
        return tuple(self._raw["substantive"]["G+.27"]["forbidden"])

    def percentage_contexts(self) -> tuple:
        return tuple(self._raw["substantive"]["G+.27"]["permitted_contexts"])

    # ── G+.32 ───────────────────────────────────────────────────────────
    def rate_sanity_status(self) -> str:
        return self._raw["rate_sanity"]["status"]

    @classmethod
    def load(cls, path: Path | None = None) -> "Gates":
        return cls(json.loads(Path(path or DATA).read_text()))


def main() -> int:
    ap = argparse.ArgumentParser(description="The reconciliation gates.")
    ap.add_argument("--data")
    ap.add_argument("--list", action="store_true")
    ap.add_argument("--scan")
    args = ap.parse_args()
    try:
        gates = Gates.load(Path(args.data) if args.data else None)
    except Exception as exc:                                  # noqa: BLE001
        print(f"gate data unreadable: {exc}", file=sys.stderr)
        return 2
    if args.scan is not None:
        hits = gates.scan(args.scan)
        for hit in hits:
            print(f"G+.25 fabrication token {hit.token!r} at {hit.where} — "
                  f"the line moves to AN.SUBSTANTIVE and its confidence drops "
                  f"to LOW")
        if not hits:
            print("clean")
        return 1 if hits else 0
    if args.list:
        print(f"G+.29 completeness — {len(gates.completeness_rows())} rows")
        for r in gates.completeness_rows():
            join = " or " if r.any_of else " and "
            print(f"  {r.evidence_kind:<22} -> "
                  f"{join.join(r.sections):<12} {r.source}")
        print(f"\nG+.30 mass balance — {len(gates.mass_balance())} checks")
        for c in gates.mass_balance():
            bound = (f"±{c.tolerance_pct}%" if c.tolerance_pct
                     else (c.rule or "exact"))
            print(f"  {c.n:>2}  {bound:<16} {c.check[:72]}")
        print(f"\nG+.25 tokens — {len(gates.fabrication_tokens())}")
        print(f"G+.32 — {gates.rate_sanity_status()[:90]}")
        return 0
    print(f"{len(gates.completeness_rows())} completeness rows, "
          f"{len(gates.mass_balance())} mass-balance checks, "
          f"{len(gates.fabrication_tokens())} fabrication tokens")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
