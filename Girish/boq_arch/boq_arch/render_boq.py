"""Unpriced BOQ workbook in the house format (reference/house-template.md, LEGOLAND issue).

A4 portrait, eight columns, 62-row pages: 4-row project band, column head band,
section heading on every page, 46 body rows, 'To Collection' at P+60. Vertical
rules only. Description text wraps by starting a new row in C, never wrapText.
Item letters restart on each page and skip I and O. Rates are blank unless a
rate source is supplied; TOTAL PRICE is =E*G so a priced copy calculates.
"""
from __future__ import annotations

import textwrap
from pathlib import Path

from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, Side
from openpyxl.worksheet.page import PageMargins

from .letters import letter
from .records import Item

PAGE = 62
BODY0, BODY1 = 9, 54          # body rows P+9 .. P+54 (46 rows)
WRAP = 56                     # characters per description row
WIDTHS = {"A": 4.711, "B": 1.711, "C": 31.711, "D": 15.711, "E": 8.711, "F": 5.711, "G": 12.711, "H": 14.711}
QTY_FMT = "#,##0_);[Red](#,##0)"
RATE_FMT = '_(* #,##0.00_);_(* \\(#,##0.00\\);_(* "-"??_);_(@_)'      # as the sample's RATE cells
AMT_FMT = '_(* #,##0.00_);_(* \\(#,##0.00\\);_(* "-"??_);_(@_)'
COLL_FMT = "#,##0.00_);[Red](#,##0.00)"                               # collection / summary links
# fonts exactly as the issued sample bills (Bill No.1 / Bill No.6):
F10 = Font(name="Arial", size=10)                                     # body text, items, To Collection
F10B = Font(name="Arial", size=10, bold=True)                         # band lines A1-A4, TOTAL FOR lines
F10BU = Font(name="Arial", size=10, bold=True, underline="single")    # section, element and sub headings
F9 = Font(name="Arial", size=9)                                       # summary column head band
F9B = Font(name="Arial", size=9, bold=True)                           # section title D3, codes G3/H3
F8 = Font(name="Arial", size=8)                                       # BILL OF QUANTITIES labels, head band
CENTER = Alignment(horizontal="center")
LEFT = Alignment(horizontal="left")
THIN = Side(style="thin", color="000000")
ADDITIONAL = ["LIST ANY ADDITIONAL ITEMS", None,
              "The Tenderer shall list below and price any items not",
              "included herein but contained in the Tender Drawings, ",
              "mentioned in the Specifications or required for the ",
              "satisfactory completion of this section. Any such item ",
              "not listed below shall be deemed to be included", None,
              "------------------------------------------------", None,
              "------------------------------------------------", None,
              "------------------------------------------------"]

# border map, house-template.md section 5: offset -> (left cols, right cols, top cols, bottom cols)
_ALL = "ABCDEFGH"
BORDERS = {0: ("A", "ACDGH", _ALL, ""), 1: ("ADGH", "ACDFGH", "", ""), 2: ("ADGH", "ACDFGH", "", ""),
           3: ("ADGH", "ACDFGH", "", "GH"), 4: ("AEFGH", "AEFGH", _ALL, ""), 5: ("AEFGH", "AEFGH", "", ""),
           6: ("AEFGH", "AEFGH", "", _ALL), 61: ("AEFG", "AEFGH", "", _ALL)}


def _borders(off: int):
    return BORDERS.get(off, ("AEFG", "AEFGH", "", "") if 7 <= off <= 60 else ("", "", "", ""))


def bill_qty(q: float) -> int:
    """Bill quantities are whole units; anything measured but under one unit bills as 1."""
    if q <= 0:
        return 0
    return max(1, int(q + 0.5))


class Sheet:
    def __init__(self, ws, band: dict, sec_title: str, sec_letter: str, code: str, abbreviated=False):
        self.ws, self.band, self.title, self.L, self.code = ws, band, sec_title, sec_letter, code
        self.pages: list[int] = []            # P of each page
        self.abbrev = abbreviated
        for col, w in WIDTHS.items():
            ws.column_dimensions[col].width = w
        ws.sheet_format.defaultRowHeight = 12.75
        ws.page_setup.paperSize = 9
        ws.page_setup.orientation = "portrait"
        ws.page_margins = PageMargins(left=0.25, right=0.25, top=0.5, bottom=0.5, header=0.25, footer=0.25)

    # -------------------------------------------------- page frame
    def new_page(self, heading: str | None, head_band="full") -> int:
        P = 1 + PAGE * len(self.pages)
        self.pages.append(P)
        ws, n = self.ws, len(self.pages)

        def put(r, c, v, font, align):
            cell = ws.cell(r, c, v)
            cell.font, cell.alignment = font, align
            return cell

        for off, key in ((0, "client"), (1, "project"), (2, "package"), (3, "building")):
            put(P + off, 1, self.band[key], F10B, LEFT)
        put(P, 4, "BILL OF QUANTITIES", F8, CENTER)
        put(P, 7, "BILL NO.", F8, CENTER)
        put(P, 8, "PAGE NO.", F8, CENTER)
        put(P + 2, 4, self.title if not self.abbrev else "SUMMARY", F9B, CENTER)
        put(P + 2, 7, self.code, F9B, CENTER).number_format = QTY_FMT
        put(P + 2, 8, f"{self.code}/{n}" if not self.abbrev else self.band.get("summary_page", "S-1"),
            F9B, CENTER).number_format = QTY_FMT
        ws.cell(P + 4, 3, " ").font = F10
        ws.cell(P + 4, 6, " ").font = F10
        if head_band == "full":
            for c, v in ((1, "ITEM"), (3, "ITEM DESCRIPTION"), (5, "QUANTITY"), (6, "UNIT"), (7, "UNIT"),
                         (8, "TOTAL PRICE")):
                put(P + 5, c, v, F8, CENTER)
            for c, v in ((1, "REF."), (7, "RATE"), (8, "AED")):
                put(P + 6, c, v, F8, CENTER)
        elif self.abbrev:                                   # bill summary: 9 pt, as the sample
            put(P + 5, 4, "ITEM DESCRIPTION", F9, Alignment(horizontal="right"))
            put(P + 5, 8, "TOTAL PRICE", F9, CENTER)
            put(P + 6, 8, "AED", F9, CENTER)
        else:                                               # collection page
            put(P + 5, 3, "ITEM DESCRIPTION", F8, CENTER)
            put(P + 5, 8, "TOTAL PRICE", F8, CENTER)
            put(P + 6, 8, "AED", F8, CENTER)
        if heading:
            ws.cell(P + 8, 3, heading).font = F10BU
        for off in range(PAGE):
            ws.row_dimensions[P + off].height = 12.75
            left, right, top, bottom = _borders(off)
            for col in _ALL:
                if not (col in left or col in right or col in top or col in bottom):
                    continue
                ws[f"{col}{P + off}"].border = Border(left=THIN if col in left else None,
                                                     right=THIN if col in right else None,
                                                     top=THIN if col in top else None,
                                                     bottom=THIN if col in bottom else None)
        for c, al in ((1, "center"), (5, "right"), (6, "center"), (8, "right")):
            for off in range(8, 61):             # body rows only; the head band keeps its centring
                ws.cell(P + off, c).alignment = Alignment(horizontal=al)
        return P

    def close_page(self, P: int):
        t = self.ws.cell(P + 60, 4, "To Collection")
        t.font, t.alignment = F10, LEFT
        c = self.ws.cell(P + 60, 8, f"=SUM(H{P + BODY0}:H{P + BODY1})")
        c.font, c.number_format = F10, AMT_FMT


def _lines(text: str) -> list[str]:
    return textwrap.wrap(text, WRAP, break_long_words=True) or [""]


U10 = Font(name="Arial", size=10, underline="single")                 # description paragraphs, sub-headings
HEAD_WRAP = 44        # a section heading longer than this puts (CONT'D) on the next row, as the sample


def _block_rows(level_rows: list[tuple[str, str]], note_lines=()) -> list[tuple]:
    """Rows for heading levels: each level's text wrapped, a blank row after each level."""
    out = []
    for i, (style, text) in enumerate(level_rows):
        for ln in _lines(text):
            out.append((style, ln))
        out.append(("blank",))
        if i == 0 and note_lines:
            out.append(("BU", "Note:"))
            out.append(("blank",))
            for para in note_lines:
                for ln in _lines(para):
                    out.append(("N", ln))
                out.append(("blank",))
    return out


def _head_rows(head: str, cont: bool) -> list[str]:
    if not cont:
        return [head]
    full = head + " (CONT'D)"
    return [full] if len(full) <= HEAD_WRAP else [head, "(CONT'D)"]


def write_section(ws_sheet: Sheet, items: list[Item]) -> None:
    """Lay the section's items out on pages as the issued bills do.

    Headings are printed only where they change from the item before; an item group
    (items sharing all heading levels) is kept on one page when it fits on one; on a
    new page the open headings are repeated with (Cont'd) and the description repeated.
    """
    L = ws_sheet.L
    ws = ws_sheet.ws
    head = f"SECTION {L} - {ws_sheet.title}"
    FONT = {"BU": F10BU, "U": U10, "UD": U10, "N": F10}

    # consecutive runs of items with identical heading levels
    runs: list[list[Item]] = []
    for it in items:
        if runs and runs[-1][0].levels() == it.levels() and runs[-1][0].note_lines == it.note_lines:
            runs[-1].append(it)
        else:
            runs.append([it])

    state = {"P": None, "r": 0, "n": 0}

    def start_page(cont: bool):
        if state["P"] is not None:
            ws_sheet.close_page(state["P"])
        hr = _head_rows(head, cont)
        P = ws_sheet.new_page(hr[0])
        r = P + BODY0 + 1
        for extra in hr[1:]:                 # (CONT'D) wrapped onto the next row
            ws.cell(P + BODY0, 3, extra).font = F10BU
            r += 1
        state.update(P=P, r=r, n=0)

    def room():
        return (state["P"] + BODY1) - state["r"] + 1

    def emit(rows):
        for row in rows:
            if row[0] != "blank":
                ws.cell(state["r"], 3, row[1]).font = FONT[row[0]]
            state["r"] += 1

    def item_rows(it):
        return len(_lines(it.description)) + 1

    def put_item(it):
        lines = _lines(it.description)
        r = state["r"]
        a = ws.cell(r, 1, letter(state["n"]))
        a.font, a.alignment = F10, CENTER
        state["n"] += 1
        ws.cell(r, 3, lines[0]).font = F10
        q = ws.cell(r, 5, None if getattr(it, "open", False) else bill_qty(it.quantity()))   # OPEN: blank
        q.font, q.number_format = F10, QTY_FMT
        ws.cell(r, 6, it.unit).font = F10
        g = ws.cell(r, 7)
        g.font, g.number_format = F10, RATE_FMT     # a rate typed in later is Arial 10 too
        t = ws.cell(r, 8, f"=E{r}*G{r}")
        t.font, t.number_format = F10, AMT_FMT
        for k, extra in enumerate(lines[1:], 1):
            ws.cell(r + k, 3, extra).font = F10
        state["r"] = r + len(lines) + 1

    def continuation_rows(it):
        lv = it.levels()
        rows = []
        for i, (style, text) in enumerate(lv):
            if style == "BU":
                rows += [("BU", ln) for ln in _lines(text + " (Cont'd)")] + [("blank",)]
            else:
                rows += [(style, ln) for ln in _lines(text)] + [("blank",)]
        return rows

    start_page(False)
    prev: list = []
    for run in runs:
        lv = run[0].levels()
        i = 0
        while i < len(lv) and i < len(prev) and lv[i] == prev[i]:
            i += 1
        note = run[0].note_lines if i == 0 else ()
        block = _block_rows(lv[i:], note)
        need_all = len(block) + sum(item_rows(it) for it in run)
        need_first = len(block) + item_rows(run[0])
        full_page = BODY1 - BODY0
        if need_all > room() and (need_all <= full_page or need_first > room()):
            start_page(True)
            block = _block_rows(lv, run[0].note_lines) if lv and lv[0] != (prev[0] if prev else None) \
                else continuation_rows(run[0])
        emit(block)
        for it in run:
            if item_rows(it) > room():
                start_page(True)
                emit(continuation_rows(it))
            put_item(it)
        prev = lv
    ws_sheet.close_page(state["P"])

    # LIST ANY ADDITIONAL ITEMS - its own page
    start_page(True)
    ws_sheet.pages  # noqa: B018  (page registered by start_page)
    P = state["P"]
    r = state["r"]
    n = 0
    for line in ADDITIONAL:
        if line is not None:
            c = ws.cell(r, 3, line)
            c.font = F10BU if line.startswith("LIST") else F10
            if line.startswith("---"):          # each rule line is a lettered item, as the sample
                c.alignment = LEFT
                a = ws.cell(r, 1, letter(n))
                a.font, a.alignment = F10, CENTER
                g = ws.cell(r, 7)
                g.font, g.number_format = F10, RATE_FMT
                t = ws.cell(r, 8, f"=E{r}*G{r}")
                t.font, t.number_format = F10, AMT_FMT
                n += 1
        r += 1
    ws_sheet.close_page(P)


def write_collection(ws_sheet: Sheet, bill: int, sec_idx: int, summary_ref: str) -> tuple[int, str]:
    """COLLECTION page; returns (row of the carried total, last page code)."""
    body_pages = list(ws_sheet.pages)
    ws = ws_sheet.ws
    P = ws_sheet.new_page(None, head_band="abbrev")
    last_code = f"{bill}/{sec_idx}/{len(ws_sheet.pages)}"
    s = ws.cell(P + 8, 3, f"SECTION {ws_sheet.L} - {ws_sheet.title}")
    s.font, s.alignment = F10BU, LEFT
    c = ws.cell(P + 10, 3, "COLLECTION")
    c.font, c.alignment = F10BU, CENTER
    r = P + 12
    first = r
    for n, pp in enumerate(body_pages, 1):          # one page per line, a blank row between, as the sample
        p = ws.cell(r, 3, f"Page {bill}/{sec_idx}/{n}")
        p.font, p.alignment = F10, CENTER
        c = ws.cell(r, 8, f"=H{pp + 60}")
        c.font, c.number_format, c.alignment = F10, COLL_FMT, Alignment(horizontal="right")
        r += 2
    ref = summary_ref.replace("-", "")               # the sample writes S-5 on the summary, S5 here
    line1 = f"TOTAL FOR BILL NO. {last_code} - SECTION {ws_sheet.L} - {ws_sheet.title}, "
    if len(line1) <= 58:
        lines = [line1, f"CARRIED TO SUMMARY  - {ref}"]
    else:
        w = textwrap.wrap(line1.strip(), 58)
        lines = [w[0], " ".join(w[1:]) + f" CARRIED TO SUMMARY - {ref}"]
    tr = P + 58                                      # the sample closes the page with it (rows 57-58 of 62)
    tr = max(tr, r + 1)
    ws.cell(tr, 3, lines[0]).font = F10B
    ws.cell(tr + 1, 3, lines[1]).font = F10B
    t = ws.cell(tr + 1, 8, f"=SUM(H{first}:H{r - 1})")
    t.font, t.number_format, t.alignment = F10, COLL_FMT, Alignment(horizontal="right")
    return tr + 1, last_code


def write_boq(path: Path, band: dict, sections: list[tuple[str, str, str, int, list[Item]]], bill: int,
              summary_ref: str = "S-1"):
    """One workbook per bill, as the issued bills: Summary, then one sheet per section.

    sections: (letter, title, sheet name, section index within the bill, items).
    """
    wb = Workbook()
    summ = wb.active
    summ.title = "Summary"
    carried = []
    for L, title, sheet_name, idx, items in sections:
        ws = wb.create_sheet(sheet_name[:31])
        sh = Sheet(ws, band, title, L, f"{bill}/{idx}")
        write_section(sh, items)
        row, last = write_collection(sh, bill, idx, summary_ref)
        carried.append((last, f"SECTION {L} - {title}", ws.title, row))
    s = Sheet(summ, dict(band, summary_page=summary_ref), "SUMMARY", "", str(bill), abbreviated=True)
    P = s.new_page(None, head_band="abbrev")
    s0 = summ.cell(P + 9, 4, "SUMMARY")
    s0.font, s0.alignment = F10BU, CENTER
    b = summ.cell(P + 11, 3, "BILL NO.")
    b.font, b.alignment = F10BU, LEFT
    r = P + 13
    first = r
    for last, title, sheet, row in carried:
        c = summ.cell(r, 3, last)
        c.font, c.alignment = F10, LEFT
        summ.cell(r, 4, title).font = F10
        ref = f"'{sheet}'!H{row}" if not sheet.isalnum() else f"{sheet}!H{row}"
        c = summ.cell(r, 8, f"={ref}")
        c.font, c.number_format, c.alignment = F10, COLL_FMT, Alignment(horizontal="right")
        r += 2
    tr = max(P + 47, r + 1)                        # the sample totals the summary at row 48
    summ.cell(tr, 4, "TOTAL CARRIED TO FORM OF TENDER").font = F10B
    t = summ.cell(tr, 8, f"=SUM(H{first}:H{r - 1})")
    t.font, t.number_format, t.alignment = F10, COLL_FMT, Alignment(horizontal="right")
    path.parent.mkdir(parents=True, exist_ok=True)
    wb.save(path)
