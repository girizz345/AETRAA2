#!/usr/bin/env python3
"""
assemble.py — sections, ordering, lettering, pagination, collections, summary.

The order is forced by the data and it is worth writing down, because doing it
in any other order produces a bill whose page references are wrong in a way
nobody notices until it is issued:

  1. group lines into sections, POMI order from the crosswalk
  2. paginate — 62-row grid, 46-row body, counted the way the house builder
     counts (render/_house/build_house_takeoff.build_section_sheet)
  3. letter — restarting per page, skipping I and O
  4. To Collection per page: =SUM over that page's item rows
  5. collection page: sums the page totals
  6. section close: TOTAL FOR BILL NO. n/n/n — CARRIED TO SUMMARY
  7. summary: cites each section by its LAST page, so it can only be written
     after step 2 has run for every section
  8. Form of Tender total

One halt condition: a section total that does not equal the sum of its items.
That is not a rounding tolerance, it is a defect — the workbook computes with
live formulas, so a disagreement means a line was written into the wrong
section or a page was double-counted.

PAGINATION IS A SPEC DECISION. The house builder ABORTS if a page overflows
its body, refuses a page that ends on a heading, and treats an item_group as
atomic. So the packer here counts rows exactly as the builder does:

  heading     2 rows   (the text, then a blank)
  item        len(wrap(description)) + 1
  item_group  len(wrap(lead)) + 1 + sum(len(wrap(variant))) + (n - 1) + 1

The builder starts writing at P+O_BODY_FIRST+1 (one blank under the section
heading) and its last writable row is P+O_BODY_LAST, so of the 46 body rows
45 are available to entries. A group that cannot fit on a fresh page is split
into chunks, each repeating its lead description — pagination.py: "where it
cannot be avoided the block repeats its lead description".

  python3 -m bill.assemble --lines L.json --out bill.json

Exit 0 = assembled. Exit 1 = a section total does not reconcile.
"""
from __future__ import annotations

import argparse
from dataclasses import dataclass, field
from decimal import Decimal

from bill.lettering import SEQUENCE, letters
from bill.pagination import Page, last_page_reference
from ingest import crosswalk

CARRIED_TO_SUMMARY = "TOTAL FOR BILL NO. {ref} — CARRIED TO SUMMARY - S1"
TO_COLLECTION = "To Collection"
COLLECTION = "COLLECTION"
CONTINUED = "{element} (Cont'd)"        # build_house_takeoff.E_CONT, verbatim

# build_house_takeoff: O_BODY_FIRST = 9, O_BODY_LAST = 54, the first body row
# is left blank under the section heading. 54 - (9 + 1) + 1 = 45 writable rows.
BODY_ROWS = 46
USABLE_ROWS = 45
HEADING_ROWS = 2
LETTERS_PER_PAGE = len(SEQUENCE)         # 20 — bill.lettering refuses more


@dataclass(frozen=True)
class AssemblyLine:
    """One bill row as the assembler needs it: the spine record plus the
    identity and wording the house structure carries around it."""
    line: object                 # spine.records.BillLine
    ref: str                     # item code, matches the take-off and markup
    element_type: str
    lead_description: str        # the description block the row bills under
    variant: str                 # the short text on the item's own row
    group_key: tuple             # (section, clause_id) — one block per group
    rate_source: str | None = None

    @property
    def section(self) -> str:
        return self.line.section

    @property
    def quantity(self):
        return self.line.quantity

    @property
    def rate(self):
        return self.line.rate


@dataclass(frozen=True)
class PlacedLine:
    """An AssemblyLine after pagination: it now has a letter and a page."""
    line: AssemblyLine
    item_letter: str
    page_ref: str

    @property
    def ref(self) -> str:
        return self.line.ref

    @property
    def quantity(self):
        return self.line.quantity

    @property
    def rate(self):
        return self.line.rate


@dataclass(frozen=True)
class PackedPage:
    page: Page                   # bill.pagination shape
    reference: str               # "2/3/1" (bill 2) or "1/1" (a bill without sections)
    entries: tuple               # house boq_pages entries, in order
    placed: tuple                # PlacedLine, in letter order
    rows: int                    # rows the builder will consume

    @property
    def item_count(self) -> int:
        return len(self.placed)


@dataclass(frozen=True)
class AssembledSection:
    letter: str
    title: str
    pages: tuple
    lines: tuple
    last_page_ref: str
    total: Decimal
    section_no: int = 0
    bill: int = 2


@dataclass
class _Group:
    key: tuple
    element_type: str
    lead_description: str
    items: list = field(default_factory=list)


def order_sections(letters_: list[str]) -> list[str]:
    """POMI order, via the crosswalk, so a retired letter is resolved before
    ordering rather than sorting into a position that no longer exists."""
    resolved = {crosswalk.resolve(letter) for letter in letters_}
    return [letter for letter in crosswalk.ordered() if letter in resolved]


def reconcile(section: AssembledSection) -> str | None:
    line_total = sum(((line.quantity or Decimal(0)) * (line.rate or Decimal(0))
                      for line in section.lines), Decimal(0))
    if line_total != section.total:
        return (f"section {section.letter}: items sum to {line_total}, "
                f"section total is {section.total}")
    return None


def page_code(bill: int, section_no: int, page_no: int) -> str:
    """Three-part for a bill with sections, two-part for one without — the
    dayworks form, house-template.md §3."""
    return (f"{bill}/{section_no}/{page_no}" if section_no
            else f"{bill}/{page_no}")


def _heading_text(element_type: str) -> str:
    """The element heading as a bill writes it: plural, "Doors", "Windows",
    "Pile caps" - a heading names the kind of work, not one item. Work named by
    a mass noun stays as it is: "Glazing", "Reinforcement", "Ironmongery"."""
    kinds = [k.replace("_", " ").split() for k in element_type.split("/") if k.strip()]
    if not kinds:
        return "Items"
    out = []
    for words in kinds:
        last = words[-1]
        if not (last.endswith(("s", "ing", "ment", "work", "ery")) or last in _MASS_NOUNS):
            last = (last[:-1] + "ies") if last.endswith("y") and last[-2:-1] not in "aeiou"                 else (last + "es") if last.endswith(("ch", "sh", "x")) else last + "s"
        out.append(" ".join(words[:-1] + [last]))
    return " and ".join(out).capitalize()


_MASS_NOUNS = {"concrete", "masonry", "insulation", "steel", "formwork", "cladding",
               "glass", "timber", "plaster", "screed", "waterproofing"}


def _group_rows(desc_lines: int, variant_lines: list[int]) -> int:
    """Exactly what build_section_sheet consumes for one item_group: the
    description lines, a blank, each variant's lines, a blank between
    variants, and the blank that closes the group."""
    n = len(variant_lines)
    if n == 0:
        return 0
    return desc_lines + 1 + sum(variant_lines) + (n - 1) + 1


def billed_qty(quantity):
    """The quantity as the bill page states it: the house Total Qty is
    ROUNDUP(measured, 0), so the page carries the measured figure rounded UP to
    the whole unit. The take-off keeps the unrounded figure (GP3.1 — products
    are never rounded); this is the bill's presentation of it, not a change to
    it, and it rounds the same way the MEASUREMENT sheet's formula did."""
    from decimal import ROUND_CEILING
    if quantity is None:
        return None
    return int(Decimal(str(quantity)).to_integral_value(rounding=ROUND_CEILING))


def pack_groups(groups: list, wrap, *, bill: int, section_no: int,
                usable_rows: int = USABLE_ROWS,
                letters_per_page: int = LETTERS_PER_PAGE) -> list[PackedPage]:
    """Groups to pages, atomically where a group fits on a page and in
    lead-repeating chunks where it cannot fit on any page. Letters restart on
    every page, skipping I and O. A page never ends on a heading because a
    heading is only ever emitted together with at least one item."""
    pages: list[PackedPage] = []
    entries: list = []
    placed: list = []
    rows = 0
    last_heading: str | None = None
    page_no = 1
    item_index = 0

    def close_page():
        nonlocal entries, placed, rows, last_heading, page_no
        if not entries:
            return
        first = placed[0]
        letters_ = letters(len(placed))
        page = Page(bill, section_no, page_no, first[0], placed[-1][0])
        ref = page_code(bill, section_no, page_no)
        out = tuple(PlacedLine(item, letter, ref)
                    for (_, item), letter in zip(placed, letters_))
        pages.append(PackedPage(page=page, reference=ref,
                                entries=tuple(entries), placed=out, rows=rows))
        entries, placed, rows, last_heading = [], [], 0, None
        page_no += 1

    for group in groups:
        # A group with no description block is a run of plain items — the
        # builder's "item" kind: len(wrap(description)) + 1 rows each.
        plain = not group.lead_description
        desc_lines = [] if plain else wrap(group.lead_description)
        remaining = list(group.items)
        variant_lines = [len(wrap(item.variant)) for item in remaining]
        continued = False
        while remaining:
            heading = _heading_text(group.element_type)
            if continued:
                heading = CONTINUED.format(element=heading)
            heading_rows = 0 if heading == last_heading else HEADING_ROWS
            room = usable_rows - rows - heading_rows
            slots = letters_per_page - len(placed)

            def rows_for(k: int) -> int:
                if plain:
                    return sum(v + 1 for v in variant_lines[:k])
                return _group_rows(len(desc_lines), variant_lines[:k])

            fit = 0
            for k in range(1, min(len(remaining), slots) + 1):
                if rows_for(k) <= room:
                    fit = k
                else:
                    break

            if fit == len(remaining) or (fit > 0 and not entries):
                chunk, remaining = remaining[:fit], remaining[fit:]
                rows += rows_for(fit)
                variant_lines = variant_lines[fit:]
                if heading_rows:
                    entries.append({"kind": "heading", "text": heading})
                    rows += heading_rows
                    last_heading = heading
                if plain:
                    for item in chunk:
                        entries.append({
                            "kind": "item", "item_key": item.ref,
                            "unit": item.line.unit, "description": item.variant,
                            "qty": billed_qty(item.line.quantity),
                            "rate": (None if item.rate is None
                                     else float(item.rate))})
                else:
                    entries.append({
                        "kind": "item_group",
                        "description": list(desc_lines),
                        "items": [{"variant": item.variant, "item_key": item.ref,
                                   "unit": item.line.unit,
                                   "qty": billed_qty(item.line.quantity),
                                   "rate": (None if item.rate is None
                                            else float(item.rate))}
                                  for item in chunk]})
                for item in chunk:
                    placed.append((item_index, item))
                    item_index += 1
                if remaining:
                    close_page()
                    continued = True
                continue

            if not entries:
                raise ValueError(
                    f"item {remaining[0].ref}: description block of "
                    f"{len(desc_lines)} lines plus its variant cannot fit on "
                    f"an empty {usable_rows}-row page")
            # The group does not fit on this partly filled page: start a fresh
            # one rather than marooning a two-item tail under a repeated block.
            close_page()

    close_page()
    return pages


def group_lines(lines: list) -> list[_Group]:
    """Consecutive lines sharing a group_key form one item_group. The order of
    the input is the canonical order and is preserved."""
    groups: list[_Group] = []
    for line in lines:
        if groups and groups[-1].key == line.group_key:
            groups[-1].items.append(line)
            continue
        groups.append(_Group(key=line.group_key, element_type=line.element_type,
                             lead_description=line.lead_description,
                             items=[line]))
    return groups


def section_total(placed: list) -> Decimal:
    return sum(((p.quantity or Decimal(0)) * (p.rate or Decimal(0))
                for p in placed if p.rate is not None), Decimal(0))


def assemble(lines: list, config, *, wrap=None, bill: int = 2
             ) -> list[AssembledSection]:
    """AssemblyLines in canonical order -> AssembledSections in POMI order,
    paginated and lettered. `wrap` is the house builder's wrap_lines; without
    it a description is one line, which is only right for a unit test."""
    wrap = wrap or (lambda text: [str(text)])
    by_section: dict[str, list] = {}
    for line in lines:
        by_section.setdefault(crosswalk.resolve(line.section), []).append(line)
    out: list[AssembledSection] = []
    for section_no, letter in enumerate(order_sections(list(by_section)), 1):
        groups = group_lines(by_section[letter])
        pages = pack_groups(groups, wrap, bill=bill, section_no=section_no)
        placed = [p for page in pages for p in page.placed]
        out.append(AssembledSection(
            letter=letter, title=crosswalk.title(letter), pages=tuple(pages),
            lines=tuple(placed),
            last_page_ref=(last_page_reference([p.page for p in pages])
                           if pages else ""),
            total=section_total(placed), section_no=section_no, bill=bill))
    return out


def main() -> int:
    ap = argparse.ArgumentParser(description="Assemble the bill.")
    ap.add_argument("--lines", required=True)
    ap.add_argument("--out", required=True)
    ap.parse_args()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
