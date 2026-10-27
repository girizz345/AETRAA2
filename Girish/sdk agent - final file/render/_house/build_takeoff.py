#!/usr/bin/env python3
"""
Build a POMI dimension-paper take-off workbook from a structured take-off JSON.

The measurement judgement (reading drawings / DXF and applying the POMI
rules) is done upstream and captured in the JSON. This script only RENDERS that
measurement into the house take-off format with live Excel formulas, so the
output recalculates and the collection block always agrees with the take-off.

Usage:
    python build_takeoff.py <takeoff.json> <output.xlsx>

JSON shape (see references/takeoff-format.md for the full contract):
{
  "project": "Project name" | null,
  "descriptor": "G+4+R" | null,            # optional, appended after project in titles
  "drawing_links": {                        # R34: map drawing number -> link target
    "S-200": "drawings/S-200.pdf",          #   relative path, absolute path, or URL;
    "A-102": "Tender_Drawings.pdf#page=12"  #   append #page=N to land on a page
  },
  "sections": [
    {
      "letter": "C",
      "name": "CONCRETE",
      "items": [
        {
          "code": "C-A",
          "description": "100 mm thick blinding under raft foundation ...",
          "unit": "m2",
          "lines": [
            {"ref":"S-200","level":"Raft","desc":"Blinding to raft underside",
             "nr":1,"L":1427.10,"W":null,"H":0.6,"qty_each":null,
             "location":"Grids 1-9 / A-G"},
            {"memo":"Formwork reuse: 1 pour cycle, panels reused x8 - procurement note only"}
          ]
        }
      ]
    }
  ],
  "audit": {                                # optional; rendered as AN. tabs
    "reconciliation": [ ["Pass 2 sample","...","variance","action"] ],
    "substantive":    [ ["row","gate","token","confidence","action"] ],
    "coverage":       [ ["section","source document","available/assumed","note"] ]
  }
}
"""
import json
import sys
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

# ---- House style (reverse-engineered from the reference take-off) ----------
FONT       = "Arial"
SZ         = 9
HEADER_FILL = PatternFill("solid", fgColor="FF1F4E78")  # dark blue header band (opaque ARGB)
COLL_FILL   = PatternFill("solid", fgColor="FFE2EFDA")   # light green collection block (opaque ARGB)
WHITE_BOLD  = Font(name=FONT, size=SZ, bold=True, color="FFFFFFFF")
BOLD        = Font(name=FONT, size=SZ, bold=True)
PLAIN       = Font(name=FONT, size=SZ)
LINK_FONT   = Font(name=FONT, size=SZ, color="0563C1", underline="single")  # R34 drawing link
ITALIC      = Font(name=FONT, size=SZ, italic=True, color="595959")
TITLE_FONT  = Font(name=FONT, size=11, bold=True)
NUMFMT      = "#,##0.00"
THIN        = Side(style="thin", color="BFBFBF")
BORDER      = Border(top=THIN, bottom=THIN, left=THIN, right=THIN)
CTR         = Alignment(horizontal="center", vertical="center", wrap_text=True)
CTR_NOWRAP  = Alignment(horizontal="center", vertical="center")
WRAP        = Alignment(horizontal="left", vertical="center", wrap_text=True)

# Take-off block headers (cols A..L) and collection block headers (cols N..P)
TO_HEADERS = ["Ref (drawing)", "Level / Floor", "Item code", "Element / build-up",
              "Nr", "L (m)", "W (m)", "H/Thk (m)", "Qty each", "Tot.", "Unit",
              "Grid / location"]
COLL_HEADERS = ["Item code", "Qty", "Unit"]
# Widths match the reference take-off exactly: G and the M spacer are left at the
# Excel default (the reference does not set them), so they are omitted here.
COL_WIDTHS = {"A":16,"B":15,"C":9,"D":40,"E":6,"F":8,"H":9,"I":10,"J":11,
              "K":6,"L":18,"N":10,"O":12,"P":7}


def _title(project, descriptor, letter, name):
    lead = " ".join(p for p in [project, descriptor] if p)
    lead = (lead + " - ") if lead else ""
    return f"{lead}SECTION {letter} : {name} - TAKE-OFF"


def _ref_target(line, links):
    """R34: resolve the drawing-link target for a measurement line, or None.
    Priority: explicit per-line 'ref_link', else the project drawing register
    (drawing_links map keyed by drawing number). No target -> plain text."""
    t = line.get("ref_link")
    if t:
        return t
    ref = line.get("ref")
    return links.get(str(ref)) if ref is not None else None


# Units that count things. A door's width and height describe it; they are not
# multiplied into its quantity. The reference take-off shows them in the
# dimension columns with Qty each = 1, so Tot. = Nr (SKYON H. DOORS & WINDOWS).
COUNT_UNITS = {"nr", "no", "no.", "item", "set", "pair", "pr"}


def _qty_each(row, line, unit=""):
    """Return either a live dimension formula or a direct value for col I (Qty each)."""
    if str(unit or "").strip().lower() in COUNT_UNITS:
        qe = line.get("qty_each")
        return qe if qe not in (None, "") else 1
    # a deduction line (its squared figure negative - an opening, GP3.2/3.3)
    # stays a deduction in the live formula, so the item's SUM subtracts it
    deduct = str(line.get("squared", "")).strip().startswith("-")
    dims = [("F", line.get("L")), ("G", line.get("W")), ("H", line.get("H"))]
    present = [f"{c}{row}" for c, v in dims if v not in (None, "")]
    if present:
        product = "*".join(present)
        return f"=-({product})" if deduct else "=" + product
    qe = line.get("qty_each")
    if qe in (None, ""):
        return None
    return -abs(qe) if deduct and isinstance(qe, (int, float)) else qe


def _write_section(ws, sec, project, descriptor, links=None):
    links = links or {}
    # Title
    ws["A1"] = _title(project, descriptor, sec["letter"], sec["name"])
    ws["A1"].font = TITLE_FONT

    # Header band (row 2): take-off block A..L, gap M, collection block N..P
    for i, h in enumerate(TO_HEADERS):
        c = ws.cell(2, 1 + i, h)
        c.font, c.fill, c.alignment = WHITE_BOLD, HEADER_FILL, CTR
    for i, h in enumerate(COLL_HEADERS):
        c = ws.cell(2, 14 + i, h)
        c.font, c.fill, c.alignment = WHITE_BOLD, HEADER_FILL, CTR_NOWRAP
    ws.freeze_panes = "A3"

    # ---- Left take-off block ----
    row = 3
    qty_to_bill_rows = {}            # code -> row of its 'qty to bill' total (for collection link)
    for item in sec["items"]:
        code, unit = item["code"], item.get("unit", "")
        # item header row: code in C (bold), spec narrative in D (bold)
        ws.cell(row, 3, code).font = BOLD
        d = ws.cell(row, 4, item.get("description", ""))
        d.font, d.alignment = BOLD, WRAP
        row += 1

        pending = bool(item.get("pending"))             # e.g. reinforcement awaiting a BBS
        line_rows = []
        for line in item.get("lines", []):
            if "memo" in line:                       # non-priced procurement / basis note
                m = ws.cell(row, 4, "  " + str(line["memo"]))
                m.font, m.alignment = ITALIC, WRAP
                row += 1
                continue
            acell = ws.cell(row, 1, line.get("ref", ""))
            tgt = _ref_target(line, links)               # R34: link drawing ref to its source
            if tgt:
                acell.hyperlink = tgt
                acell.font = LINK_FONT
            ws.cell(row, 2, line.get("level", ""))
            ws.cell(row, 3, code).alignment = CTR_NOWRAP
            ws.cell(row, 4, line.get("desc", "")).alignment = WRAP
            ws.cell(row, 5, line.get("nr", 1))        # E Nr (floor multiplier lives here)
            if not pending:
                for col, key in ((6, "L"), (7, "W"), (8, "H")):
                    v = line.get(key)
                    if v not in (None, ""):
                        ws.cell(row, col, v).number_format = NUMFMT
                qe = _qty_each(row, line, unit)
                if qe is not None:
                    ws.cell(row, 9, qe).number_format = NUMFMT           # I Qty each
                ws.cell(row, 10, f"=E{row}*I{row}").number_format = NUMFMT  # J Tot.
            ws.cell(row, 11, unit).alignment = CTR_NOWRAP             # K Unit
            ws.cell(row, 12, line.get("location", ""))
            for col in range(1, 13):                                 # thin border A..L
                ws.cell(row, col).border = BORDER
                if ws.cell(row, col).font.name != FONT:
                    ws.cell(row, col).font = PLAIN
            line_rows.append(row)
            row += 1

        # qty to bill — a SUM of line totals, or a visible PENDING flag when awaiting evidence
        ws.cell(row, 4, "  qty to bill").font = BOLD
        if pending:
            j = ws.cell(row, 10, "PENDING BBS")      # no invented quantity; flagged on the sheet
            j.font = BOLD
        else:
            if line_rows:
                rng = f"J{line_rows[0]}:J{line_rows[-1]}"
                j = ws.cell(row, 10, f"=SUM({rng})")
            else:
                j = ws.cell(row, 10, 0)
            j.font, j.number_format = BOLD, NUMFMT
        qty_to_bill_rows[code] = row
        row += 1

    # ---- Right collection block (independent list from row 3, 1 row per code) ----
    cr = 3
    for item in sec["items"]:
        code = item["code"]
        ws.cell(cr, 14, code).fill = COLL_FILL
        o = ws.cell(cr, 15, f"=J{qty_to_bill_rows[code]}")   # live link to take-off total
        o.fill, o.number_format = COLL_FILL, NUMFMT
        ws.cell(cr, 16, item.get("unit", "")).fill = COLL_FILL
        for col in (14, 15, 16):
            ws.cell(cr, col).font = PLAIN
        cr += 1

    for col, w in COL_WIDTHS.items():
        ws.column_dimensions[col].width = w


def _write_index(ws, sections):
    ws["A1"] = "TAKE-OFF (room / element dimensioned build-up per POMI)"
    ws["A1"].font = TITLE_FONT
    ws["A2"] = "Each discipline tab lists elements/rooms measured to POMI; collection block carries the billed quantity per item code."
    ws["A2"].font = ITALIC
    for i, h in enumerate(["Bill", "Discipline", "Take-off tab"]):
        c = ws.cell(3, 1 + i, h)
        c.font, c.fill, c.alignment = WHITE_BOLD, HEADER_FILL, CTR_NOWRAP
    r = 4
    for s in sections:
        ws.cell(r, 1, s["letter"])
        ws.cell(r, 2, s["name"])
        ws.cell(r, 3, f"see '{s['letter']}.' tab")
        r += 1
    ws.column_dimensions["A"].width = 8
    ws.column_dimensions["B"].width = 28
    ws.column_dimensions["C"].width = 16


def _write_audit(wb, audit):
    specs = [("AN.RECONCILIATION", ["Pass 2 sample", "Result", "Variance", "Action"],
             audit.get("reconciliation", [])),
            ("AN.SUBSTANTIVE", ["Row", "Gate", "Token", "Confidence", "Action"],
             audit.get("substantive", [])),
            ("AN.COVERAGE", ["Section", "Source document", "Available / assumed", "Note"],
             audit.get("coverage", []))]
    for title, heads, rows in specs:
        ws = wb.create_sheet(title)
        ws["A1"] = title
        ws["A1"].font = TITLE_FONT
        for i, h in enumerate(heads):
            c = ws.cell(2, 1 + i, h)
            c.font, c.fill, c.alignment = WHITE_BOLD, HEADER_FILL, CTR_NOWRAP
        for ri, rowvals in enumerate(rows, start=3):
            for ci, v in enumerate(rowvals, start=1):
                ws.cell(ri, ci, v).font = PLAIN
        for ci in range(1, len(heads) + 1):
            ws.column_dimensions[get_column_letter(ci)].width = 26


def build(data, out_path):
    wb = Workbook()
    idx = wb.active
    idx.title = "INDEX"
    _write_index(idx, data["sections"])
    links = data.get("drawing_links", {})      # R34 register: {drawing number: target}
    for sec in data["sections"]:
        ws = wb.create_sheet(f"{sec['letter']}. {sec['name']}")
        _write_section(ws, sec, data.get("project"), data.get("descriptor"), links)
    if data.get("audit"):
        _write_audit(wb, data["audit"])
    wb.save(out_path)
    return out_path


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python build_takeoff.py <takeoff.json> <output.xlsx>")
        sys.exit(1)
    with open(sys.argv[1]) as f:
        data = json.load(f)
    print("Saved:", build(data, sys.argv[2]))
