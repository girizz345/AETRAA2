#!/usr/bin/env python3
"""
pagination.py — the 62-row page grid, and why page references resolve last.

Measured from Bill No.2 Main Hotel Building, not assumed:

  62 rows, repeating
  four project lines (client / project / package / building)
  a section title carrying BILL NO. and PAGE NO.
  a two-row column header
  item rows
  a To Collection row closing the page

Page references read Bill/Section/Page — 2/2/3 is bill 2, section 2, page 3 —
and the Summary cites each section by its LAST page (2/2/10). So a page
reference cannot be written until pagination has run, and the summary cannot be
written until every section's last page is known. That ordering is the reason
assembly is a separate stage from render.

A description block and its Ditto variants should not be split across a page
break where it can be avoided, because a variant marooned at the top of a page
reads as a full item. Where it cannot be avoided the block repeats its lead
description.

  python3 -m bill.pagination --items 47

Exit 0 always.
"""
from __future__ import annotations

import argparse
from dataclasses import dataclass

PAGE_ROWS = 62
PROJECT_LINES = 4
SECTION_TITLE_ROWS = 1
HEADER_ROWS = 2
TO_COLLECTION_ROWS = 1
CHROME = PROJECT_LINES + SECTION_TITLE_ROWS + HEADER_ROWS + TO_COLLECTION_ROWS
ITEM_ROWS_PER_PAGE = PAGE_ROWS - CHROME          # 54


@dataclass(frozen=True)
class Page:
    bill: int
    section_no: int
    page_no: int
    first_item: int
    last_item: int

    @property
    def reference(self) -> str:
        return f"{self.bill}/{self.section_no}/{self.page_no}"

    @property
    def item_count(self) -> int:
        return self.last_item - self.first_item + 1


def paginate(item_count: int, bill: int = 2, section_no: int = 1,
             rows_per_item: int = 1) -> list[Page]:
    """Items to pages. rows_per_item > 1 where descriptions wrap; the caller
    measures the wrap, this file only divides."""
    from bill.lettering import SEQUENCE
    per_page = min(ITEM_ROWS_PER_PAGE // max(rows_per_item, 1), len(SEQUENCE))
    pages: list[Page] = []
    index = 0
    page_no = 1
    while index < item_count:
        last = min(index + per_page, item_count) - 1
        pages.append(Page(bill, section_no, page_no, index, last))
        index = last + 1
        page_no += 1
    return pages


def last_page_reference(pages: list[Page]) -> str:
    """What the Summary cites. Resolvable only after pagination — which is the
    whole reason summary generation follows assembly."""
    if not pages:
        raise ValueError("no pages: a section with no items has no reference")
    return pages[-1].reference


def main() -> int:
    ap = argparse.ArgumentParser(description="Paginate a section.")
    ap.add_argument("--items", type=int, required=True)
    ap.add_argument("--bill", type=int, default=2)
    ap.add_argument("--section-no", type=int, default=1)
    args = ap.parse_args()
    pages = paginate(args.items, args.bill, args.section_no)
    for page in pages:
        print(f"  {page.reference:<10} items {page.first_item}-{page.last_item} "
              f"({page.item_count})")
    print(f"\n{len(pages)} pages; summary cites {last_page_reference(pages)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
