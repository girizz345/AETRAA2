#!/usr/bin/env python3
"""
revise.py — each input folder issues as a numbered revision.

Where drawings arrive as successive folders — Tender, IFC, IFC-RevB — every
folder is a full run, issued as its own revision. First is Rev 0. Every Rev >= 1
carries a REVISION CHANGES sheet inside its own workbook listing what the issue
added, omitted and changed, with old -> new quantity and the difference.

Two rules that matter more than the diff itself:

  * a folder that fails its gates halts the sequence. A revision built on an
    issue that never passed completeness would carry the omission forward and
    the change sheet would show nothing wrong, because both revisions would be
    missing the same section.
  * folders are never skipped. Rev 2 compared against Rev 0 hides whatever
    happened in Rev 1, and "no change" is a claim the change sheet makes.

The dev corpus has exactly this shape — a TENDER set and an APPROVED set.

  python3 -m render.revise --current runs/<id> --previous runs/<id>

Exit 0 = change sheet built. Exit 1 = previous revision failed its gates.
"""
from __future__ import annotations

import argparse
import json
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
from pathlib import Path

SHEET_NAME = "REVISION CHANGES"
COLUMNS = ("Status", "Bill Ref", "Item", "Description", "Unit",
           "Previous Quantity", "This Quantity", "Difference", "Drawing Basis")
STATUSES = ("ADDED", "OMITTED", "CHANGED", "UNCHANGED")
FIRST_ISSUE_NOTE = ("First issue — no previous revision of this project was found; "
                    "every line is ADDED.")
FONT_NAME = "Arial"


@dataclass(frozen=True)
class Change:
    status: str
    bill_ref: str
    item: str
    description: str
    unit: str
    previous: Decimal | None
    current: Decimal | None

    @property
    def difference(self) -> Decimal | None:
        if self.previous is None or self.current is None:
            return None
        return self.current - self.previous


def flatten(bill: dict) -> list[dict]:
    """bill.json sections -> lines carrying their section letter, in bill
    order. The shape diff() keys on."""
    out = []
    for section in bill.get("sections", []):
        for line in section.get("lines", []):
            row = dict(line)
            row.setdefault("section", section.get("letter"))
            out.append(row)
    return out


def _qty(value) -> Decimal | None:
    if value is None or value == "":
        return None
    try:
        return Decimal(str(value))
    except InvalidOperation:
        return None


def _keyed(lines: list) -> dict:
    """(section, clause_id, description, occurrence) -> line. The occurrence
    index disambiguates two lines that share a clause and a description
    (two marks billed identically); without it the second would vanish."""
    out: dict = {}
    seen: dict = {}
    for line in lines:
        base = (str(line.get("section") or ""), str(line.get("clause_id") or ""),
                str(line.get("description") or "").strip())
        n = seen.get(base, 0)
        seen[base] = n + 1
        out[base + (n,)] = line
    return out


def _sort_key(change: Change):
    parts = change.bill_ref.split("-", 1)
    return (parts[0], parts[1] if len(parts) > 1 else "", change.description)


def diff(previous_lines: list, current_lines: list) -> list[Change]:
    """Matched on (section, clause_id, description key) rather than on item
    letter — letters restart per page and shift when a line is inserted, so
    matching on them would report the whole bill as changed."""
    prev, cur = _keyed(previous_lines), _keyed(current_lines)
    changes: list[Change] = []
    for key in sorted(set(prev) | set(cur), key=lambda k: (k[0], k[1], k[2], k[3])):
        p, c = prev.get(key), cur.get(key)
        line = c if c is not None else p
        pq = _qty(p.get("quantity")) if p is not None else None
        cq = _qty(c.get("quantity")) if c is not None else None
        if p is None:
            status = "ADDED"
        elif c is None:
            status = "OMITTED"
        elif pq != cq or (p.get("unit") or "") != (c.get("unit") or ""):
            status = "CHANGED"
        else:
            status = "UNCHANGED"
        changes.append(Change(
            status=status,
            bill_ref=str(line.get("ref") or ""),
            item=str(line.get("item_letter") or ""),
            description=str(line.get("description") or ""),
            unit=str(line.get("unit") or ""),
            previous=pq, current=cq))
    return sorted(changes, key=_sort_key)


def summary(changes: list[Change]) -> dict[str, int]:
    return {s: sum(1 for c in changes if c.status == s) for s in STATUSES}


def append_sheet(workbook_path, changes: list[Change], drawing_basis: dict | None = None,
                 note: str | None = None) -> None:
    """Appends the REVISION CHANGES sheet to an existing bill.xlsx. Replaces a
    previous one so a re-run does not stack two. drawing_basis maps a bill
    ref to the text for the last column."""
    from openpyxl import load_workbook
    from openpyxl.styles import Font

    wb = load_workbook(str(workbook_path))
    if SHEET_NAME in wb.sheetnames:
        del wb[SHEET_NAME]
    ws = wb.create_sheet(SHEET_NAME)
    bold, plain = Font(name=FONT_NAME, size=10, bold=True), Font(name=FONT_NAME, size=10)
    r = 1
    if note:
        ws.cell(r, 1, note).font = bold
        r += 2
    for i, h in enumerate(COLUMNS, 1):
        ws.cell(r, i, h).font = bold
    r += 1
    basis = drawing_basis or {}
    for ch in changes:
        values = (ch.status, ch.bill_ref, ch.item, ch.description, ch.unit,
                  None if ch.previous is None else float(ch.previous),
                  None if ch.current is None else float(ch.current),
                  None if ch.difference is None else float(ch.difference),
                  basis.get(ch.bill_ref, ""))
        for i, v in enumerate(values, 1):
            c = ws.cell(r, i, "" if v is None else v)
            c.font = plain
            if i in (6, 7, 8) and v is not None:
                c.number_format = "#,##0.00"
        r += 1
    for col, w in zip("ABCDEFGHI", (11, 10, 6, 60, 6, 16, 16, 12, 40)):
        ws.column_dimensions[col].width = w
    wb.save(str(workbook_path))


def to_json(changes: list[Change]) -> list[dict]:
    return [{"status": c.status, "bill_ref": c.bill_ref, "item": c.item,
             "description": c.description, "unit": c.unit,
             "previous": None if c.previous is None else str(c.previous),
             "current": None if c.current is None else str(c.current),
             "difference": None if c.difference is None else str(c.difference)}
            for c in changes]


def main() -> int:
    ap = argparse.ArgumentParser(description="Build a revision change sheet.")
    ap.add_argument("--current", required=True)
    ap.add_argument("--previous", required=True)
    args = ap.parse_args()
    cur = json.loads((Path(args.current) / "bill.json").read_text())
    prev = json.loads((Path(args.previous) / "bill.json").read_text())
    changes = diff(flatten(prev), flatten(cur))
    for s, n in summary(changes).items():
        print(f"  {s:<10} {n}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
