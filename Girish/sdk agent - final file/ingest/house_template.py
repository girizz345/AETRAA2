#!/usr/bin/env python3
"""
house_template.py — the issued bill format, and the gate that proves a workbook
matches it.

Eight Excel columns, A4 portrait, Arial in three sizes, vertical rules only, and
a 62-row page rhythm. Measured across eight issued workbooks: 128 sheets, of
which 59 carry the BILL OF QUANTITIES head band and are therefore bill pages.

Two things in here are easy to get wrong and were:

  * the money column. H is not unanimous in the issued set — 14.711 on 23 bill
    pages, 15.711 on 8, then 16.141, 18.57 and 17.426. The house value is
    14.711, the plurality by a clear margin, and an earlier reading of the
    reference named 15.711 because it read the file instead of the workbooks.
    The gate accepts 14.5 to 18.0 on H alone and fails any deviation on A to G.
  * the page rhythm. print_title_rows is deliberately NOT set and there are no
    explicit row breaks: the band is repeated as real rows, so a page break in
    the wrong place shows up as a visibly wrong page instead of a silently right
    one.

  python3 -m ingest.house_template --data data/house_template.json --page 2
  python3 -m ingest.house_template --verify-widths A=4.711,H=14.711

Exit 0 = matches. Exit 1 = deviation. Exit 2 = data unreadable.
"""
from __future__ import annotations

import argparse
import json
import sys
from dataclasses import dataclass
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent / "data" / "house_template.json"
PAGE_ROWS = 62


@dataclass(frozen=True)
class Column:
    col: str
    width: float
    carries: str
    align: str | None
    number_format: str | None
    unanimous: bool
    gate_accepts: tuple | None


class HouseTemplate:
    def __init__(self, raw: dict):
        self._raw = raw
        self._columns = {c["col"]: Column(
            col=c["col"], width=float(c["width"]), carries=c.get("carries", ""),
            align=c.get("align"), number_format=c.get("number_format"),
            unanimous=bool(c.get("unanimous")),
            gate_accepts=tuple(c["gate_accepts"]) if c.get("gate_accepts")
            else None) for c in raw["columns"]}

    # ── geometry ────────────────────────────────────────────────────────
    def columns(self) -> list[Column]:
        return [self._columns[k] for k in "ABCDEFGH"]

    def width(self, col: str) -> float:
        return self._columns[col.upper()].width

    def number_format(self, col: str) -> str | None:
        return self._columns[col.upper()].number_format

    def cover_width(self, col: str) -> float | None:
        return self._raw["cover_sheet_geometry"].get(col.upper())

    # ── the page ────────────────────────────────────────────────────────
    def first_row(self, page: int) -> int:
        """Page 1 starts at row 1, page 2 at 63, page 3 at 125."""
        if page < 1:
            raise ValueError("pages are 1-based")
        return 1 + (page - 1) * PAGE_ROWS

    def row_of(self, page: int, offset: int) -> int:
        if not 0 <= offset < PAGE_ROWS:
            raise ValueError(f"offset {offset} is outside the 62-row page")
        return self.first_row(page) + offset

    def body_rows(self, page: int) -> range:
        start = self.first_row(page)
        return range(start + 9, start + 55)

    def to_collection_row(self, page: int) -> int:
        return self.first_row(page) + 60

    def to_collection_formula(self, page: int) -> str:
        start = self.first_row(page)
        return f"=SUM(H{start + 9}:H{start + 54})"

    def page_of_row(self, row: int) -> int:
        return (row - 1) // PAGE_ROWS + 1

    def offsets(self) -> list[dict]:
        return list(self._raw["page"]["offsets"])

    # ── codes ───────────────────────────────────────────────────────────
    def bill_no(self, bill, section=None) -> str:
        return f"{bill}/{section}" if section is not None else f"{bill}"

    def page_no(self, bill, section, page) -> str:
        """A bill with no POMI section of its own — Dayworks, which is [GP9] —
        uses the TWO-part form. A builder that assumes three parts cannot
        produce a dayworks bill."""
        if section is None:
            return f"{bill}/{page}"
        return f"{bill}/{section}/{page}"

    def section_heading(self, letter, title, *, continued=False) -> str:
        tail = " (CONT'D)" if continued else ""
        return f"SECTION {letter} - {title}{tail}"

    # ── the gate ────────────────────────────────────────────────────────
    def verify_widths(self, observed: dict) -> list[str]:
        """Fails any deviation on A to G; accepts a range on H alone."""
        problems = []
        for col, width in sorted(observed.items()):
            key = col.upper()
            if key not in self._columns:
                problems.append(f"column {key} is not in the house format")
                continue
            spec = self._columns[key]
            if spec.gate_accepts:
                low, high = spec.gate_accepts
                if not low <= float(width) <= high:
                    problems.append(
                        f"{key} is {width}, outside the accepted "
                        f"{low} to {high} (house value {spec.width})")
            elif abs(float(width) - spec.width) > 0.001:
                problems.append(f"{key} is {width}, the house format is "
                                f"{spec.width} and A to G are unanimous")
        return problems

    def verify_page(self, row_kinds: dict) -> list[str]:
        """row_kinds: {absolute row -> kind}. Checks that each page's fixed rows
        carry the kind the format puts there."""
        problems = []
        fixed = {o["offset"]: o["kind"] for o in self.offsets()
                 if isinstance(o["offset"], int)}
        for row, kind in sorted(row_kinds.items()):
            offset = (row - 1) % PAGE_ROWS
            if offset in fixed and fixed[offset] != kind:
                problems.append(f"row {row} (offset {offset}) is {kind!r}, the "
                                f"format puts {fixed[offset]!r} there")
        return problems

    @classmethod
    def load(cls, path: Path | None = None) -> "HouseTemplate":
        return cls(json.loads(Path(path or DATA).read_text()))


def main() -> int:
    ap = argparse.ArgumentParser(description="The issued bill format.")
    ap.add_argument("--data")
    ap.add_argument("--page", type=int)
    ap.add_argument("--verify-widths")
    args = ap.parse_args()
    try:
        tpl = HouseTemplate.load(Path(args.data) if args.data else None)
    except Exception as exc:                                  # noqa: BLE001
        print(f"template data unreadable: {exc}", file=sys.stderr)
        return 2

    if args.verify_widths:
        observed = {}
        for pair in args.verify_widths.split(","):
            col, _, width = pair.partition("=")
            observed[col.strip()] = float(width)
        problems = tpl.verify_widths(observed)
        for p in problems:
            print(f"DEVIATION {p}")
        if not problems:
            print("widths match the house format")
        return 1 if problems else 0

    if args.page:
        page = args.page
        print(f"page {page} starts at row {tpl.first_row(page)}")
        for entry in tpl.offsets():
            offset = entry["offset"]
            if isinstance(offset, int):
                print(f"  row {tpl.row_of(page, offset):>4}  {entry['kind']}")
            else:
                lo, hi = offset
                print(f"  rows {tpl.row_of(page, lo)}-{tpl.row_of(page, hi)}  "
                      f"{entry['kind']}")
        print(f"  To Collection: H{tpl.to_collection_row(page)} "
              f"{tpl.to_collection_formula(page)}")
        return 0

    for c in tpl.columns():
        mark = "" if c.unanimous else "  (not unanimous in the issued set)"
        print(f"  {c.col}  {c.width:>7}  {c.carries[:46]}{mark}")
    print(f"\npage: {PAGE_ROWS} rows, body 46. "
          f"Dayworks page code: {tpl.page_no(8, None, 2)}. "
          f"Sectioned: {tpl.page_no(6, 1, 2)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
