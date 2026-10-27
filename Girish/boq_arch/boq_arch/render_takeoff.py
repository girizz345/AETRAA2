"""Take-off workbook, house format (SKYON reference): INDEX + one dimension-paper tab per section.

Take-off block A-L, one item after another: header row (code + full description,
bold) -> dimensioned lines -> 'qty to bill' row summing the item's line totals.
Collection block N-P: one row per item code, Qty linked to its 'qty to bill' cell.
Evidence origin and basis sit in R-S, outside both blocks, so the house columns
are unchanged. Every quantity cell is a live formula over the dimensions.
"""
from __future__ import annotations

import os
import re
from pathlib import Path

from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter

from .decisions import EXPLAIN
from .letters import letter
from .records import Item

ARIAL9 = Font(name="Arial", size=9)
BOLD9 = Font(name="Arial", size=9, bold=True)
ITAL8 = Font(name="Arial", size=8, italic=True)
ITAL9 = Font(name="Arial", size=9, italic=True, color="595959")
HEAD = Font(name="Arial", size=9, bold=True, color="FFFFFF")
TITLE = Font(name="Arial", size=11, bold=True)
TITLE12 = Font(name="Arial", size=12, bold=True)
LINK = Font(name="Arial", size=9, color="0563C1", underline="single")
BLUE_FILL = PatternFill("solid", fgColor="1F4E78")
GREEN_FILL = PatternFill("solid", fgColor="E2EFDA")
GREY = Side(style="thin", color="BFBFBF")
BOX = Border(left=GREY, right=GREY, top=GREY, bottom=GREY)
NUM = "#,##0.00"
WIDTHS = {"A": 16, "B": 15, "C": 9, "D": 40, "E": 6, "F": 8, "H": 9, "I": 10, "J": 11, "K": 6, "L": 18,
          "N": 10, "O": 12, "P": 7, "R": 16, "S": 60}
HEADERS = ["Ref (drawing)", "Level / Floor", "Item code", "Element / build-up", "Nr", "L (m)", "W (m)",
           "H/Thk (m)", "Qty each", "Tot.", "Unit", "Grid / location"]
# tab names as the SKYON take-off
TAB_NAMES = {"D": "MASONRY", "E": "METAL WORKS", "F": "WOOD WORKS", "G": "THERMAL & MOISTURE",
             "H": "DOORS & WINDOWS", "J": "FINISHES", "K": "ACCESSORIES"}


def assign_codes(section: str, items: list[Item]) -> None:
    for n, it in enumerate(items):
        it.code = f"{section}-{letter(n)}"


def _link(cell, target, base: Path) -> None:
    """The drawing reference made a hyperlink to the drawing."""
    if target is None:
        return
    try:        # relative, so the workbook and drawings can move together
        link = os.path.relpath(target, base).replace("\\", "/")
    except ValueError:      # on another drive (Windows): no relative path exists
        link = Path(target).resolve().as_uri()
    cell.hyperlink = link
    cell.font = LINK


def _section_tab(ws, title_line: str, items: list[Item], drawing_paths: dict, base: Path):
    ws["A1"] = title_line
    ws["A1"].font = TITLE
    for c, h in enumerate(HEADERS, 1):
        cell = ws.cell(2, c, h)
        cell.font, cell.fill = HEAD, BLUE_FILL
        cell.alignment = Alignment(wrap_text=True, horizontal="center", vertical="center")
    for c, h in ((14, "Item code"), (15, "Qty"), (16, "Unit"), (18, "Evidence origin"), (19, "Basis")):
        cell = ws.cell(2, c, h)
        cell.font, cell.fill = HEAD, BLUE_FILL
        cell.alignment = Alignment(wrap_text=True, horizontal="center", vertical="center")
    ws.freeze_panes = "A3"
    for col, w in WIDTHS.items():
        ws.column_dimensions[col].width = w

    row, coll = 3, 3
    for it in items:
        ws.cell(row, 3, it.code).font = BOLD9
        ws.cell(row, 4, f"{it.description} - {it.group_desc}" if it.group_desc else it.description).font = BOLD9
        ws.cell(row, 19, f"POMI {it.clause}" + (f"; {it.subgroup}" if it.subgroup else "")).font = ARIAL9
        head_row = row
        row += 1
        first = row
        for ln in it.lines:
            if ln.memo:
                ws.cell(row, 1, ln.ref).font = ARIAL9
                ws.cell(row, 4, ln.desc).font = ITAL9
                ws.cell(row, 18, ln.origin).font = ITAL9
                _link(ws.cell(row, 1), drawing_paths.get(ln.ref), base)   # the schedule a count was read off
                row += 1
                continue
            for c, v in enumerate([ln.ref, ln.level, it.code, ln.desc, ln.nr, ln.L, ln.W, ln.H], 1):
                cell = ws.cell(row, c, v)
                cell.font, cell.border = ARIAL9, BOX
            dims = [get_column_letter(c) + str(row) for c, v in ((6, ln.L), (7, ln.W), (8, ln.H)) if v is not None]
            sign = "-" if ln.deduct else ""
            ws.cell(row, 9, f"={sign}{'*'.join(dims)}" if dims else (-(ln.qty_each or 0) if ln.deduct
                                                                    else (ln.qty_each or 0)))
            ws.cell(row, 10, f"=E{row}*I{row}")
            ws.cell(row, 11, it.unit)
            m = re.search(r"effective scale (1:[\d.]+)", ln.location)
            ws.cell(row, 12, f"calibrated {m.group(1)}" if m else ln.location)
            for c in range(9, 13):
                ws.cell(row, c).font = ARIAL9
                ws.cell(row, c).border = BOX
            for c in (5, 6, 7, 8, 9, 10):
                ws.cell(row, c).number_format = NUM
            ws.cell(row, 18, ln.origin).font = ARIAL9
            ws.cell(row, 19, ln.location).font = ARIAL9
            _link(ws.cell(row, 1), drawing_paths.get(ln.ref), base)
            row += 1
        last = row - 1
        ws.cell(row, 4, "  qty to bill").font = ITAL8
        qcells = [f"J{r}" for r in range(first, last + 1) if ws.cell(r, 10).value is not None]
        if getattr(it, "open", False):
            ws.cell(row, 4, "  qty to bill - OPEN: counts disagree, see GAPS").font = ITAL8
            ws.cell(row, 10, "OPEN").font = BOLD9
        else:
            ws.cell(row, 10, f"=SUM({','.join(qcells)})" if qcells else 0).font = BOLD9
        ws.cell(row, 10).number_format = NUM
        for c, v in ((14, it.code), (15, f"=J{row}"), (16, it.unit)):
            cell = ws.cell(coll, c, v)
            cell.font, cell.fill = ARIAL9, GREEN_FILL
        ws.cell(coll, 15).number_format = NUM
        coll += 1
        ws.cell(head_row, 11, it.unit).font = BOLD9
        row += 2


def write_takeoff(path: Path, sections: list[tuple[str, str, list[Item]]], ident: dict, decisions: dict,
                  register: list, drawing_paths: dict[str, Path], extra_notes: list[str]):
    """One workbook, as the SKYON take-off: INDEX, then one tab per section (sections: letter, title, items)."""
    wb = Workbook()
    ix = wb.active
    ix.title = "INDEX"
    job = ident.get("job_title", "")
    ix["A1"] = f"{job} - TAKE-OFF (room / element schedules by discipline)"
    ix["A1"].font = TITLE12
    ix["A2"] = ("Each discipline tab lists elements/rooms with drawing ref (hyperlinked), level, Nr x dimension = "
                "quantity, and a pivot of quantity per bill item. Quantities are per their own unit (m2/m3/lm/nr) - "
                "not summed across units.")
    ix["A2"].font = ARIAL9
    for c, h in enumerate(("Bill", "Discipline", "Take-off tab"), 1):
        cell = ix.cell(3, c, h)
        cell.font, cell.fill = HEAD, BLUE_FILL
    r = 4
    for L, title, _ in sections:
        name = TAB_NAMES.get(L, title)
        ix.cell(r, 1, L).font = ARIAL9
        ix.cell(r, 2, name).font = ARIAL9
        ix.cell(r, 3, f"see '{L}.' tab").font = ARIAL9
        r += 1
    for col, w in (("A", 10), ("B", 42), ("C", 18)):
        ix.column_dimensions[col].width = w

    # project record, below the house index (not part of the SKYON layout)
    r += 2
    ix.cell(r, 1, "Project").font = BOLD9
    for label, key in (("Owner", "owner"), ("Job title", "job_title"), ("Plot no. / parcel ID", "plot"),
                       ("Block / community", "community"), ("Consultant", "consultant")):
        r += 1
        ix.cell(r, 1, label).font = ARIAL9
        ix.cell(r, 2, ident.get(key, "")).font = ARIAL9
    r += 2
    ix.cell(r, 1, "Evidence origin (column R of each tab)").font = BOLD9
    for k, v in (("STATED", "printed on the drawing / in a schedule cell's text layer"),
                 ("COUNTED", "tags counted in the text layer of a plan"),
                 ("MEASURED", "scaled off vector geometry of a plan calibrated to its own grid dimensions"),
                 ("READ (VISUAL)", "read off the rendered sheet image (schedule cells, detail notes drawn as graphics)"),
                 ("DERIVED", "arithmetic on the above (level differences, opening add-backs)")):
        r += 1
        ix.cell(r, 1, k).font = ARIAL9
        ix.cell(r, 2, v).font = ARIAL9
    r += 2
    ix.cell(r, 1, "Decisions applied").font = BOLD9
    for k, v in EXPLAIN.items():
        r += 1
        ix.cell(r, 1, k).font = ARIAL9
        ix.cell(r, 2, f"{decisions.get(k)} - {v}").font = ARIAL9
    for n in extra_notes:
        r += 1
        ix.cell(r, 2, n).font = ARIAL9
    r += 2
    ix.cell(r, 1, "Drawings used").font = BOLD9
    for info in register:
        r += 1
        ix.cell(r, 1, info.drawing_no).font = ARIAL9
        guessed = ", title from the sheet's heading" if getattr(info, "title_basis", "") == "sheet heading" else ""
        ix.cell(r, 2, f"{info.title}  ({info.kind}{guessed}, title block scale {info.scale or '-'})").font = ARIAL9

    for L, title, items in sections:
        name = TAB_NAMES.get(L, title)
        ws = wb.create_sheet(f"{L}. {name}"[:31])
        _section_tab(ws, f"{job} - SECTION {L} : {name} - TAKE-OFF", items, drawing_paths, path.parent)
    path.parent.mkdir(parents=True, exist_ok=True)
    wb.save(path)
