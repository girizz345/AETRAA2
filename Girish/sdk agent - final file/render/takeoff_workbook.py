#!/usr/bin/env python3
"""
takeoff_workbook.py — the take-off, in the client's issued shape.

  INDEX          every section present, hyperlinked
  one tab per POMI section present — never padded with empty sections
  AN.RECONCILIATION · AN.SUBSTANTIVE · AN.COVERAGE

Never padded is a rule, not a preference. An empty section tab reads as
"nothing to measure here", and the truth is "nothing was found here" — those
are different claims and only one of them is a query to the employer.

Each dimension row carries a DWG Ref hyperlink to the sheet it was measured
from, and the rollup is a live SUM over the rows above it, so the arithmetic is
checkable in place rather than on trust.

The rendering is the ported render/_house/build_takeoff.py (the legacy
dimension-paper contract, reference/takeoff-format.md). This module only
adapts the takeoff.json dict to it and reports what was written.

  python3 -m render.takeoff_workbook --takeoff T.json --out takeoff.xlsx

Exit 0 = written. Exit 1 = a rollup did not reconcile to its bill quantity.
"""
from __future__ import annotations

import argparse
import json
import warnings
from decimal import Decimal, InvalidOperation
from pathlib import Path

from render._house import build_takeoff as _house_takeoff

INDEX_TAB = "INDEX"
AUDIT_TABS = ("AN.RECONCILIATION", "AN.SUBSTANTIVE", "AN.COVERAGE")
DIMENSION_COLUMNS = ("Item", "Nr", "L", "W", "H/Thk", "Squared", "Unit",
                     "DWG Ref", "Level", "Location", "Method")
SHEET_TITLE_MAX = 31          # Excel refuses a longer worksheet name


def rollup_formula(first_row: int, last_row: int) -> str:
    return f"=SUM(F{first_row}:F{last_row})"


def reconcile(takeoff) -> list[str]:
    """Every item whose lines' squared values do not sum EXACTLY to its
    quantity (takeoff.rollup.reconcile's rule, restated here so the workbook
    cannot be written from a take-off that disagrees with itself)."""
    problems = []
    for section in takeoff.get("sections", []):
        for item in section.get("items", []):
            qty = item.get("quantity")
            lines = [ln for ln in item.get("lines", []) if "memo" not in ln]
            if qty is None or not lines:
                continue
            try:
                total = sum(Decimal(str(ln.get("squared", "0"))) for ln in lines)
                if total != Decimal(str(qty)):
                    problems.append(f"{item.get('code')}: lines sum to {total}, "
                                    f"quantity is {qty}")
            except InvalidOperation:
                problems.append(f"{item.get('code')}: a squared value is not a number")
    return problems


def _clamp_sheet_titles(out_path: Path) -> list[str]:
    """Section tabs are named '{L}. {NAME}' by the ported builder; POMI Q and R
    exceed Excel's 31-character limit. openpyxl only warns, Excel refuses the
    file. Renamed after the build so the builder stays verbatim."""
    from openpyxl import load_workbook
    wb = load_workbook(out_path)
    renamed = []
    for ws in wb.worksheets:
        if len(ws.title) > SHEET_TITLE_MAX:
            old = ws.title
            ws.title = old[:SHEET_TITLE_MAX].rstrip()
            renamed.append(f"{old} -> {ws.title}")
    if renamed:
        wb.save(out_path)
    return renamed


def write(takeoff, out_path, audit_tabs: bool = True) -> dict[str, int]:
    """Renders takeoff.json through the ported builder. Returns counts.
    audit_tabs=False leaves the AN.* tabs out — the issued take-off is INDEX
    plus one tab per section; the audit stays in audit.json."""
    out_path = Path(out_path)
    problems = reconcile(takeoff)
    if problems:
        raise ValueError("take-off does not reconcile: " + "; ".join(problems))
    data = dict(takeoff)
    data.setdefault("sections", [])
    data.setdefault("drawing_links", {})
    if not audit_tabs:
        data.pop("audit", None)
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")           # the >31-char title warning
        _house_takeoff.build(data, str(out_path))
    renamed = _clamp_sheet_titles(out_path)
    sections = data["sections"]
    items = sum(len(s.get("items", [])) for s in sections)
    rows = sum(len(i.get("lines", [])) for s in sections for i in s.get("items", []))
    return {"sections": len(sections), "items": items, "rows": rows,
            "audit_tabs": len(AUDIT_TABS) if data.get("audit") else 0,
            "renamed_tabs": len(renamed)}


def main() -> int:
    ap = argparse.ArgumentParser(description="Render the take-off workbook.")
    ap.add_argument("--takeoff", required=True)
    ap.add_argument("--out", required=True)
    args = ap.parse_args()
    takeoff = json.loads(Path(args.takeoff).read_text())
    try:
        counts = write(takeoff, args.out)
    except ValueError as exc:
        print(exc)
        return 1
    print(f"Wrote {args.out}: {counts}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
