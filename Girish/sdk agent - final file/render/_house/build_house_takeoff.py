#!/usr/bin/env python3
"""
build_house_takeoff.py — renders the house take-off + BOQ workbook.

Produces, in one workbook:
  * MEASUREMENT   — the 14-column measurement sheet, live formulas, DWG Ref hyperlinked
                    to the marked-up PDF that proves each quantity
  * {L}/1..{L}/n  — BOQ section pages, Qty formula-linked to MEASUREMENT
  * {L}/S         — COLLECTION page

Every header, preamble and plumbing string is frozen — see references/house-template.md.
The model supplies data; this script supplies format. Never hand-build these sheets.

Usage:
  python3 build_house_takeoff.py <takeoff.json> <out.xlsx> [--markups markups] [--no-recalc]

Requires: openpyxl (+ libreoffice for the recalculation gate)
"""
import sys, json, math, argparse, shutil, subprocess, tempfile
from pathlib import Path

from openpyxl import Workbook, load_workbook
from openpyxl.styles import Font, Alignment, Border, Side, PatternFill
from openpyxl.utils import get_column_letter

# ------------------------------------------------------------------ frozen text
# Measured off eleven issued tender workbooks. Trailing spaces are IN the
# issued cells; keep them. See references/house-template.md §6.
H_BOQ          = "BILL OF QUANTITIES"
H_BILL_NO      = "BILL NO."
H_PAGE_NO      = "PAGE NO."
H_ITEM         = "ITEM"
H_REF          = "REF."
H_DESC         = "ITEM DESCRIPTION"
H_QTY          = "QUANTITY"
H_UNIT         = "UNIT"
H_UNIT2        = "UNIT"
H_RATE         = "RATE"
H_AMOUNT       = "TOTAL PRICE"
H_AED          = "AED"
S_TITLE        = "SECTION {letter} - {title}"
S_TITLE_CONT   = "SECTION {letter} - {title} (CONT'D)"
E_CONT         = "{element} (Cont'd)"
T_COLLECTION   = "To Collection"
T_COLLECTION_H = "COLLECTION"
T_PAGE         = "Page {code}"
T_TOTAL_1      = "TOTAL FOR BILL NO. {code} - SECTION {letter} - {title}, "
T_TOTAL_2      = "CARRIED TO SUMMARY  - {summary_ref}"
T_TO_TENDER    = "TOTAL CARRIED TO FORM OF TENDER"
T_AMOUNT_WORDS = "AMOUNT IN WORDS"
T_ADDITIONAL   = "LIST ANY ADDITIONAL ITEMS"
T_RULE         = "------------------------------------------------"

# The tenderer paragraph. Lines 2-5 each end with ONE trailing space in the
# issued file. It is not a typo to tidy — verify_template.py compares these
# byte for byte.
ADDITIONAL = [
    "The Tenderer shall list below and price any items not",
    "included herein but contained in the Tender Drawings, ",
    "mentioned in the Specifications or required for the ",
    "satisfactory completion of this section. Any such item ",
    "not listed below shall be deemed to be included",
]

MEAS_HEADERS = ["BOQ\nPage", "Item\nRef", "Description", "Ref", "Unit",
                "No of\nUnits", "Length (m)", "Width\n(m)", "Height\n(m)",
                "Area (m2)", "Volume (m3)", "Qty", "Total\nQty", "DWG Ref"]

# Column widths measured off the issued sheet, in POINTS, converted to Excel
# character units:  chars = (pt * 96/72 - 5) / 7
MEAS_PT = [31.8, 20.4, 152.0, 67.0, 20.4, 23.5, 42.9, 28.7, 28.7, 42.9, 42.8,
           39.7, 46.1, 118.8]
# Width column widened 24.4 -> 28.7 pt (matching Height) so the header does not
# break mid-word as "Widt / h". +4.3 pt on a 711 pt table; the sheet still fits
# one landscape page. The only deliberate deviation from the issued widths.
MEAS_WIDTHS = [round((w * 96 / 72 - 5) / 7, 2) for w in MEAS_PT]

# Item letters restart on EVERY page and skip BOTH I and O, exactly as the
# issued bills do: the longest observed page runs A B C D E F G H J K L M N
# P Q R S. I is never used and O is never used.
ITEM_LETTERS = [c for c in "ABCDEFGHJKLMNPQRSTUVWXYZ"]

NUM   = '#,##0.00'
FONT  = "Arial"     # the issued tender bills are Arial 10 pt
thin  = Side(style="thin", color="000000")
med   = Side(style="medium", color="000000")


def F(sz=10, b=False, i=False):
    return Font(name=FONT, size=sz, bold=b, italic=i)


def bill_round(v):
    """House rule: measured carried at 2dp, BILLED quantity rounded UP."""
    return int(math.ceil(float(v) - 1e-9))


MEAS_FS   = 7.2          # issued sheet font size, measured
# on LibreOffice's 0.75 pt grid, for the same reason as the BOQ rows above
ROW_H     = 9.75         # base row height, measured off the rules
ROW_H2    = 19.5         # two-line description
ROW_H3    = 29.25        # three-line description

# ------------------------------------------------------------------ measurement
def build_measurement(ws, spec, markups_dir):
    """Renders the issued MEASUREMENT SHEET format exactly: full cell grid,
    7.2pt, bold+underlined group headings, Qty = measured, Total Qty = ROUNDUP.

    The issued sheet is 792 x 612 pt — LANDSCAPE, all fourteen columns on one
    page. Without the page setup below the sheet spills and the last three
    columns (Qty, Total Qty, DWG Ref) print on a second page, which is the one
    format fault a reader notices immediately."""
    ws.sheet_view.showGridLines = False
    ws.page_setup.orientation = 'landscape'
    ws.page_setup.paperSize = ws.PAPERSIZE_LETTER   # issued sheet is 792 x 612
    ws.page_setup.fitToWidth = 1
    ws.page_setup.fitToHeight = 0
    ws.sheet_properties.pageSetUpPr.fitToPage = True
    # the issued sheet is NOT centred on the page: the identity block sits at
    # x=30.2 pt and the table's left edge just under it
    ws.page_margins.left = 30.0 / 72
    ws.page_margins.right = 0.3
    ws.page_margins.top = ws.page_margins.bottom = 0.4
    ws.print_options.horizontalCentered = False
    for i, w in enumerate(MEAS_WIDTHS, 1):
        ws.column_dimensions[get_column_letter(i)].width = w

    ws.merge_cells(start_row=1, start_column=1, end_row=1, end_column=14)
    c = ws.cell(1, 1, "MEASUREMENT SHEET")
    c.font = Font(name=FONT, size=MEAS_FS, bold=True)
    c.alignment = Alignment(horizontal="center")

    for r, (lbl, val) in enumerate([("Project", spec["project"]),
                                    ("Trade",   spec["trade"])], start=3):
        a = ws.cell(r, 1, lbl); a.font = Font(name=FONT, size=MEAS_FS, bold=True)
        b = ws.cell(r, 2, f': {val}'); b.font = Font(name=FONT, size=MEAS_FS)

    HR = 6
    for i, h in enumerate(MEAS_HEADERS, 1):
        cell = ws.cell(HR, i, h)
        cell.font = Font(name=FONT, size=MEAS_FS, bold=True)
        cell.alignment = Alignment(horizontal="center", vertical="center",
                                   wrap_text=True)
    ws.row_dimensions[HR].height = 24

    def grid(row, height=ROW_H):
        """Every cell in the table carries a border — including empty ones."""
        for i in range(1, 15):
            ws.cell(row, i).border = Border(top=thin, bottom=thin,
                                            left=thin, right=thin)
        ws.row_dimensions[row].height = height

    grid(HR, 24)
    r = HR + 1
    grid(r); r += 1                                   # opening spacer row
    index = {}

    for blk in spec["measurement"]:
        kind = blk.get("kind", "item")

        if kind in ("heading", "element"):
            cell = ws.cell(r, 3, blk["text"])
            cell.font = Font(name=FONT, size=MEAS_FS, bold=True, underline="single")
            grid(r); r += 1
            grid(r); r += 1
            continue

        item_row = r
        ws.cell(r, 1, blk.get("boq_page", "")).alignment = Alignment(horizontal="center", vertical="center")
        ws.cell(r, 2, blk.get("item_ref", "")).alignment = Alignment(horizontal="center", vertical="center")
        d = ws.cell(r, 3, blk["description"])
        d.alignment = Alignment(wrap_text=True, vertical="center")
        ws.cell(r, 5, blk.get("unit", "")).alignment = Alignment(horizontal="center", vertical="center")
        for i in range(1, 15):
            ws.cell(r, i).font = Font(name=FONT, size=MEAS_FS)

        lines = max(1, len(blk["description"]) // 46 + 1)
        h = ROW_H3 if lines >= 3 else (ROW_H2 if lines == 2 else ROW_H)

        subs = blk.get("subs", [])
        if not subs:
            _write_dims(ws, r, blk)
            _qty_formula(ws, r, blk)
            tq = ws.cell(r, 13, f"=ROUNDUP(L{r},0)")
            tq.number_format = NUM; tq.font = Font(name=FONT, size=MEAS_FS, bold=True)
            tq.alignment = Alignment(horizontal="right", vertical="center")
            _link(ws, r, blk, markups_dir)
            grid(r, h)
            total_row = r
            r += 1
        else:
            grid(r, h)
            sub_rows = []
            rr = r + 1
            for sub in subs:
                sc = ws.cell(rr, 4, sub.get("ref", ""))
                sc.font = Font(name=FONT, size=MEAS_FS)
                _write_dims(ws, rr, sub)
                _qty_formula(ws, rr, sub)
                _link(ws, rr, sub, markups_dir)
                for i in range(1, 15):
                    ws.cell(rr, i).font = Font(name=FONT, size=MEAS_FS)
                grid(rr)
                sub_rows.append(rr)
                rr += 1
            tq = ws.cell(item_row, 13,
                         "=ROUNDUP(" + "+".join(f"L{x}" for x in sub_rows) + ",0)")
            tq.number_format = NUM; tq.font = Font(name=FONT, size=MEAS_FS, bold=True)
            tq.alignment = Alignment(horizontal="right", vertical="center")
            total_row = item_row
            r = rr

        grid(r); r += 1                               # spacer row after each item
        if blk.get("item_key"):
            index[blk["item_key"]] = total_row

    return index


def _MF(bold=False):
    """Every cell this script writes on the measurement sheet uses this font.
    Cells written by a helper AFTER the row's font loop otherwise fall through
    to the workbook default (Calibri 11) and the sheet renders at two sizes."""
    return Font(name=FONT, size=MEAS_FS, bold=bold)


def _write_dims(ws, row, d):
    for col, key in ((6, "units"), (7, "length"), (8, "width"), (9, "height")):
        if d.get(key) is not None:
            c = ws.cell(row, col, d[key])
            c.number_format = NUM if col > 6 else '0'
            c.font = _MF()
            c.alignment = Alignment(horizontal="center" if col == 6 else "right",
                                    vertical="center")
    # Area / Volume are DERIVED, never typed
    def _put(col, val):
        c = ws.cell(row, col, val)
        c.number_format = NUM
        c.font = _MF()
        c.alignment = Alignment(horizontal="right", vertical="center")

    if d.get("length") is not None and d.get("width") is not None:
        _put(10, f"=G{row}*H{row}")
        if d.get("height") is not None:
            _put(11, f"=J{row}*I{row}")
    else:
        if d.get("area") is not None:
            _put(10, d["area"])
        if d.get("volume") is not None:
            _put(11, d["volume"])


def _qty_formula(ws, row, d):
    """Qty = No of Units x (Volume | Area | Length). Returns the cell ref."""
    units = f"F{row}" if d.get("units") is not None else "1"
    if ws.cell(row, 11).value is not None or d.get("volume") is not None:
        base = f"K{row}"
    elif ws.cell(row, 10).value is not None or d.get("area") is not None:
        base = f"J{row}"
    elif d.get("length") is not None:
        base = f"G{row}"
    else:
        base = None
    c = None
    if base:
        c = ws.cell(row, 12, f"={units}*{base}")
    elif d.get("qty") is not None:
        c = ws.cell(row, 12, d["qty"])
    if c is not None:
        c.number_format = NUM
        c.font = _MF()
        c.alignment = Alignment(horizontal="right", vertical="center")
    return f"L{row}"


def _link(ws, row, d, markups_dir):
    """R-MARKUP-LINK — DWG Ref links to the marked-up sheet that proves the quantity.

    Written as a =HYPERLINK() FORMULA, not a cell-hyperlink object. A cell hyperlink is
    rewritten to a temp-dir-relative path by the LibreOffice recalculation pass and stops
    resolving; a formula survives the round trip intact.
    """
    dwg = d.get("dwg_ref")
    if not dwg:
        return
    mk = d.get("markup")
    c = ws.cell(row, 14)
    if mk:
        target = f"{markups_dir}/{mk}".replace('"', '""')
        c.value = f'=HYPERLINK("{target}","{dwg}")'
    else:
        c.value = dwg
    c.font = Font(name=FONT, size=MEAS_FS, color="0000FF", underline="single")
    c.alignment = Alignment(horizontal="center", vertical="center")


# ------------------------------------------------------------------- BOQ pages
# Geometry measured off ELEVEN ISSUED TENDER WORKBOOKS — 61 non-cover sheets,
# several hundred bill pages. See references/house-template.md v2.0.
#
# The previous version of this block was built to the "Enabling Works" sample:
# US Letter, Calibri 8.9 pt, six columns, fully ruled, one page per worksheet.
# None of that is the house format. The issued bills are A4, Arial 10 pt, eight
# columns, vertical rules only, and every page of a section is STACKED ON ONE
# WORKSHEET at a fixed 62-row pitch.

BOQ_FS        = 10.0
BOQ_ROW       = 12.75
BOQ_PAGE_ROWS = 62                 # unanimous on 341 of the issued pages
BOQ_BODY_ROWS = 46                 # P+9 .. P+54

# Excel character widths. A..G are unanimous across all 61 issued sheets.
# H is the money column and the issued set does not agree with itself
# (14.711 / 15.711 / 16.141 / 17.426 / 17.711); 15.711 is the house value.
BOQ_WIDTHS = {"A": 4.711, "B": 1.711, "C": 31.711, "D": 15.711,
              "E": 8.711, "F": 5.711, "G": 12.711, "H": 15.711}

# Offsets from the page's first row P.
O_PROJ, O_SPACER, O_HEAD1, O_HEAD2 = 0, 4, 5, 6
O_SECTION      = 8
O_BODY_FIRST   = 9
O_BODY_LAST    = 54
O_TOCOLL       = 60
O_PAGE_LAST    = 61

# The issued number formats. NOT Excel Accounting. Accounting pads a nil dash
# in from the column edge; this prints a red bracketed negative and no pad.
# They look alike in a populated cell and differ exactly where a bill is read
# hardest — at zero and at a negative — so one may not stand in for the other.
# The issued set uses TWO formats and the split differs by column. Measured
# over every priced row in all eleven workbooks:
#     QUANTITY  bracketed-red 1129  Accounting 768
#     RATE      bracketed-red 1290  Accounting 339
#     AMOUNT    Accounting   1192   bracketed-red 675
# So the money column is mostly Accounting and the other two are mostly
# bracketed-red. The builder writes the majority for each column; G-FORMAT
# accepts either, because both are genuinely in issue and neither is a defect.
FMT_QTY  = '#,##0_);[Red](#,##0)'
FMT_RATE = '#,##0.00_);[Red](#,##0.00)'
FMT_AMT  = '_(* #,##0.00_);_(* (#,##0.00);_(* "-"??_);_(@_)'

# Description wrap width. Column C is 31.711 characters of Arial 10; C, B and D
# carry no rule between them but the issued bills WRITE only into C and break
# by starting a new row, so the wrap width is C alone.
BOQ_DESC_PT = 31.711 * 7.0 + 5.0 - 6.0     # ~221 pt, one char of padding off

# The wrap width is computed from real glyph advances, so a font file is
# REQUIRED — not optional, and not substitutable for something that merely
# looks similar. Arial is the target; Liberation Sans and Carlito are
# metric-compatible with it, which means identical advance widths and therefore
# identical break points. Anything else silently re-wraps every description and
# changes the row count of every page.
#
# Searched in order, first hit wins, per platform. The resolved path is printed
# and folded into the run record so a wrap difference between two machines is
# VISIBLE rather than mysterious.
_TTF_CANDIDATES = {
    False: [
        # Windows — the real thing
        r"C:\Windows\Fonts\arial.ttf",
        # macOS
        "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/Library/Fonts/Arial.ttf",
        # Linux — metric-compatible substitutes
        "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
        "/usr/share/fonts/liberation/LiberationSans-Regular.ttf",
        "/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf",
        "/usr/share/fonts/truetype/crosextra/Carlito-Regular.ttf",
    ],
    True: [
        r"C:\Windows\Fonts\arialbd.ttf",
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
        "/Library/Fonts/Arial Bold.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
        "/usr/share/fonts/liberation/LiberationSans-Bold.ttf",
        "/usr/share/fonts/truetype/liberation2/LiberationSans-Bold.ttf",
        "/usr/share/fonts/truetype/crosextra/Carlito-Bold.ttf",
    ],
}
_TTF_RESOLVED = {}
_FCACHE = {}


def resolve_font(bold=False):
    """First existing candidate, or a refusal that says what to install.

    An earlier version hardcoded two Linux paths. On Windows or macOS the
    builder raised at the first wrapped description — and that is the BETTER
    failure. The one to fear is a silent fall-back to a font with different
    metrics, which produces a workbook that looks right, wraps differently,
    and fails G-FORMAT's row arithmetic for reasons nobody can see.
    """
    if bold in _TTF_RESOLVED:
        return _TTF_RESOLVED[bold]
    for c in _TTF_CANDIDATES[bold]:
        if Path(c).is_file():
            _TTF_RESOLVED[bold] = c
            return c
    raise SystemExit(
        "ABORT: no Arial-metric font found for the description wrap.\n"
        "       The builder measures real glyph advances; it cannot guess.\n"
        "       Install ONE of:\n"
        "         Windows  Arial is present by default — check C:\\Windows\\Fonts\\arial.ttf\n"
        "         macOS    Arial is present by default — /System/Library/Fonts/Supplemental/\n"
        "         Linux    apt install fonts-liberation   (or fonts-crosextra-carlito)\n"
        "       Liberation and Carlito are metric-compatible with Arial, so the\n"
        "       wrap points are identical. A non-metric-compatible font is NOT a\n"
        "       substitute — it re-wraps every description and changes the row\n"
        "       count of every page."
    )


def _advance(text, bold=False, size=BOQ_FS):
    """Liberation Sans is metric-compatible with Arial, so the break points
    this computes are the break points Excel uses. Loaded at 10x and divided so
    the advance is a float and the line count is reproducible on any machine."""
    from PIL import ImageFont
    key = (bold, round(size, 2))
    if key not in _FCACHE:
        _FCACHE[key] = ImageFont.truetype(resolve_font(bold), int(round(size * 10)))
    return _FCACHE[key].getlength(text) / 10.0


def wrap_lines(text, width_pt=BOQ_DESC_PT, bold=False, size=BOQ_FS):
    out, cur = [], ""
    for word in str(text).split(" "):
        trial = word if not cur else cur + " " + word
        if _advance(trial, bold, size) <= width_pt or not cur:
            cur = trial
        else:
            out.append(cur); cur = word
    out.append(cur)
    return out


def _f(bold=False):
    return Font(name=FONT, size=BOQ_FS, bold=bold)


def page_start(n):
    """Row on which page n (1-based) begins."""
    return 1 + BOQ_PAGE_ROWS * (n - 1)


def _sheet_setup(ws):
    ws.page_setup.orientation = 'portrait'
    ws.page_setup.paperSize = 9                    # A4
    ws.page_margins.left = ws.page_margins.right = 0.25
    ws.page_margins.top = ws.page_margins.bottom = 0.5
    ws.page_margins.header = ws.page_margins.footer = 0.25
    for col, w in BOQ_WIDTHS.items():
        ws.column_dimensions[col].width = w


def _rules(ws, P, last):
    """The vertical rules, and the four horizontal rules that close the bands.
    Read down the page the rules stand at: left of A, right of A, left of E,
    right of E, right of F, right of G, right of H. B, C and D carry NO rule —
    that is what makes them read as one description column."""
    def put(r, col, l=False, rr=False, t=False, bt=False):
        c = ws.cell(r, col)
        c.border = Border(left=thin if l else None, right=thin if rr else None,
                          top=thin if t else None, bottom=thin if bt else None)
    for r in range(P, P + BOQ_PAGE_ROWS):
        ws.row_dimensions[r].height = BOQ_ROW
    top, bot4 = P + O_PROJ, P + 3
    for col in range(1, 9):
        put(top, col, l=(col in (1, 4, 7, 8)), rr=(col in (3, 4, 7, 8)), t=True)
    for r in range(P + 1, P + 4):
        for col in (1, 4, 7, 8):
            put(r, col, l=True, rr=True, bt=(r == bot4 and col in (7, 8)))
        put(r, 3, rr=True); put(r, 6, rr=True)
    for col in range(1, 9):
        put(P + O_SPACER, col, l=(col in (1, 5, 6, 7, 8)),
            rr=(col in (1, 5, 6, 7, 8)), t=True)
    for col in (1, 5, 6, 7, 8):
        put(P + O_HEAD1, col, l=True, rr=True)
    for col in range(1, 9):
        put(P + O_HEAD2, col, l=(col in (1, 5, 6, 7, 8)),
            rr=(col in (1, 5, 6, 7, 8)), bt=True)
    for r in range(P + 7, P + BOQ_PAGE_ROWS):
        for col in (1, 5, 6, 7):
            put(r, col, l=True, rr=True, bt=(r == last))
        put(r, 8, rr=True, bt=(r == last))
    for col in (2, 3, 4):
        put(last, col, bt=True)


def _head(ws, P, spec, section_line, page_code, collection=False):
    """The four-row project band plus the two-row column head. On a COLLECTION
    page the column head is ABBREVIATED — ITEM DESCRIPTION and TOTAL PRICE / AED
    only, no ITEM, QUANTITY, UNIT or RATE. That is how the issued bills do it."""
    # Head-band type sizes, unanimous across all 660 issued pages: the project
    # band's own lines are 10 pt BOLD, the labels beside them 8 pt regular, and
    # the section title 9 pt bold. The band is NOT all one size.
    band = [spec.get("client", ""), spec.get("project", ""),
            spec.get("package", ""), spec.get("building", "")]
    for i, v in enumerate(band):
        if v:
            ws.cell(P + i, 1, v).font = Font(name=FONT, size=10.0, bold=True)
    for col, row, val, sz, bold in (
            (4, 0, H_BOQ, 8.0, False), (7, 0, H_BILL_NO, 8.0, False),
            (8, 0, H_PAGE_NO, 8.0, False),
            (4, 2, spec["section_title"], 9.0, True),
            (7, 2, spec.get("bill_no", ""), 8.0, False),
            (8, 2, page_code, 8.0, False)):
        c = ws.cell(P + row, col, val)
        c.font = Font(name=FONT, size=sz, bold=bold)
        c.alignment = Alignment(horizontal="center")
    for col in (3, 6):
        c = ws.cell(P + O_SPACER, col, " ")
        c.font = _f()
    if collection:
        cells = ((3, O_HEAD1, H_DESC), (8, O_HEAD1, H_AMOUNT), (8, O_HEAD2, H_AED))
    else:
        cells = ((1, O_HEAD1, H_ITEM), (1, O_HEAD2, H_REF), (3, O_HEAD1, H_DESC),
                 (5, O_HEAD1, H_QTY), (6, O_HEAD1, H_UNIT), (7, O_HEAD1, H_UNIT2),
                 (7, O_HEAD2, H_RATE), (8, O_HEAD1, H_AMOUNT), (8, O_HEAD2, H_AED))
    for col, off, val in cells:
        c = ws.cell(P + off, col, val)
        c.font = Font(name=FONT, size=8.0, bold=False)   # 8 pt, not 10
        c.alignment = Alignment(horizontal="center")
    if section_line:
        ws.cell(P + O_SECTION, 3, section_line).font = _f(bold=True)


def _to_collection(ws, P):
    c = ws.cell(P + O_TOCOLL, 4, T_COLLECTION); c.font = _f(bold=True)
    a = ws.cell(P + O_TOCOLL, 8,
                f"=SUM(H{P + O_BODY_FIRST}:H{P + O_BODY_LAST})")
    a.font = _f(bold=True); a.number_format = FMT_AMT
    a.alignment = Alignment(horizontal="right")


def _cell(ws, r, col, val, align=None, fmt=None, bold=False):
    c = ws.cell(r, col, val)
    c.font = _f(bold=bold)
    if align:
        c.alignment = Alignment(horizontal=align)
    if fmt:
        c.number_format = fmt
    return c


def build_section_sheet(ws, spec, index, meas_title):
    """Every page of one section, stacked on ONE worksheet at the 62-row pitch,
    then the COLLECTION page, then the TOTAL FOR line. Returns the row of the
    section total, for the bill Summary to link to."""
    _sheet_setup(ws)
    L, title = spec["section_letter"], spec["section_title"]
    bill, sect = spec.get("bill_no", ""), spec.get("section_no", "")
    pages = spec["boq_pages"]

    tocoll_rows = []
    for i, page in enumerate(pages):
        n = i + 1
        P = page_start(n)
        code = f"{bill}/{n}" if not sect else f"{bill}/{sect}/{n}"
        first = (i == 0)
        line = (S_TITLE if first else S_TITLE_CONT).format(letter=L, title=title)
        _rules(ws, P, P + O_PAGE_LAST)
        _head(ws, P, spec, line, code)

        ents = page["entries"]
        if ents and ents[-1].get("kind", "item") == "heading":
            raise SystemExit(
                f"ABORT: page {n} ends on the heading {ents[-1].get('text')!r}.\n"
                f"       A heading may not sit as the last row of a page with\n"
                f"       its items overleaf. Move it in the spec.")

        r = P + O_BODY_FIRST + 1          # one blank under the section heading
        letters = iter(ITEM_LETTERS)
        limit = P + O_BODY_LAST

        def room(need):
            if r + need - 1 > limit:
                raise SystemExit(
                    f"ABORT: page {n} overflows the {BOQ_BODY_ROWS}-row body.\n"
                    f"       Pagination is a spec decision, not a rendering\n"
                    f"       one — split the page in the spec and re-run.")

        for entry in ents:
            kind = entry.get("kind", "item")
            if kind == "heading":
                room(1); _cell(ws, r, 3, entry["text"], bold=True); r += 2
                continue
            if kind == "narrative":
                room(len(entry["lines"]))
                for ln in entry["lines"]:
                    _cell(ws, r, 3, ln); r += 1
                r += 1
                continue

            if kind == "item_group":
                # THE HOUSE BILLING CONVENTION. One description block, then a
                # run of priced variants that inherit it — sizes on MEP piping
                # and ductwork, thicknesses on concrete and finishes, widths on
                # thresholds. Measured 316 times across the issued set, in every
                # section, not only MEP.
                #
                # It is one entry in the spec, not a narrative followed by loose
                # items, because the description and the variants under it are
                # ONE bill item in substance: the rate for "20mm PPR Piping"
                # means nothing without the paragraph above it saying the rate
                # includes fittings, valves and supports. Split them and a later
                # edit can move one without the other, and the variant is then
                # priced against nothing.
                desc = entry["description"]
                lines = (desc if isinstance(desc, list)
                         else wrap_lines(desc))
                items = entry["items"]
                need = len(lines) + 1 + 2 * len(items) - 1
                room(need)
                for ln in lines:
                    _cell(ws, r, 3, ln); r += 1
                r += 1
                for k, it in enumerate(items):
                    ref = next(letters)
                    it["_ref"] = ref
                    vlines = wrap_lines(it["variant"])
                    room(len(vlines))
                    _cell(ws, r, 1, ref, align="center")
                    for j, vl in enumerate(vlines):
                        _cell(ws, r + j, 3, vl, align="left")
                    key = it.get("item_key")
                    if key and key in index:
                        _cell(ws, r, 5, f"='{meas_title}'!M{index[key]}",
                              align="right", fmt=FMT_QTY)
                    elif it.get("qty") is not None:
                        _cell(ws, r, 5, it["qty"], align="right", fmt=FMT_QTY)
                    if it.get("unit"):
                        _cell(ws, r, 6, it["unit"], align="center")
                    if it.get("price_note"):
                        _cell(ws, r, 8, it["price_note"], align="right")
                    else:
                        _cell(ws, r, 7, it.get("rate"), fmt=FMT_RATE)
                        _cell(ws, r, 8, f"=E{r}*G{r}", align="right",
                              fmt=FMT_AMT)
                    r += len(vlines)
                    if k < len(items) - 1:
                        r += 1
                r += 1
                continue
            ref = next(letters)
            entry["_ref"] = ref
            lines = wrap_lines(entry["description"])
            room(len(lines))
            _cell(ws, r, 1, ref, align="center")
            for k, ln in enumerate(lines):
                _cell(ws, r + k, 3, ln, align="left")
            key = entry.get("item_key")
            if key and key in index:
                _cell(ws, r, 5, f"='{meas_title}'!M{index[key]}",
                      align="right", fmt=FMT_QTY)
            elif entry.get("qty") is not None:
                _cell(ws, r, 5, entry["qty"], align="right", fmt=FMT_QTY)
            _cell(ws, r, 6, entry.get("unit", ""), align="center")
            if entry.get("price_note"):
                _cell(ws, r, 8, entry["price_note"], align="right")
            else:
                _cell(ws, r, 7, entry.get("rate"), fmt=FMT_RATE)
                _cell(ws, r, 8, f"=E{r}*G{r}", align="right", fmt=FMT_AMT)
            r += len(lines) + 1

        _to_collection(ws, P)
        tocoll_rows.append(P + O_TOCOLL)

    # ---- COLLECTION page -------------------------------------------------
    n = len(pages) + 1
    P = page_start(n)
    code = f"{bill}/{n}" if not sect else f"{bill}/{sect}/{n}"
    _rules(ws, P, P + O_PAGE_LAST)
    _head(ws, P, spec, None, code, collection=True)
    r = P + O_BODY_FIRST - 1
    _cell(ws, r, 3, S_TITLE.format(letter=L, title=title), bold=True); r += 2
    _cell(ws, r, 3, T_COLLECTION_H, bold=True); r += 2
    refs = []
    for i, tr in enumerate(tocoll_rows, 1):
        pc = f"{bill}/{i}" if not sect else f"{bill}/{sect}/{i}"
        _cell(ws, r, 3, T_PAGE.format(code=pc))
        a = _cell(ws, r, 8, f"=H{tr}", align="right", fmt=FMT_AMT)
        refs.append(f"H{r}")
        r += 2
    total_row = P + O_PAGE_LAST - 3
    _cell(ws, total_row, 3,
          T_TOTAL_1.format(code=code, letter=L, title=title), bold=True)
    _cell(ws, total_row + 1, 3,
          T_TOTAL_2.format(summary_ref=spec.get("summary_ref", "")), bold=True)
    a = _cell(ws, total_row + 1, 8, "=SUM(" + ",".join(refs) + ")",
              align="right", fmt=FMT_AMT, bold=True)
    return total_row + 1


def build_additional_items_page(ws, spec, n):
    """The LIST ANY ADDITIONAL ITEMS page. Closes a section, on its own page,
    immediately after the column head band."""
    P = page_start(n)
    _rules(ws, P, P + O_PAGE_LAST)
    bill, sect = spec.get("bill_no", ""), spec.get("section_no", "")
    code = f"{bill}/{n}" if not sect else f"{bill}/{sect}/{n}"
    _head(ws, P, spec, None, code)
    r = P + O_BODY_FIRST - 1
    _cell(ws, r, 3, T_ADDITIONAL, bold=True); r += 2
    for ln in ADDITIONAL:
        _cell(ws, r, 3, ln); r += 1
    r += 1
    _cell(ws, r, 3, T_RULE); r += 2
    _cell(ws, r, 3, T_RULE)
    _to_collection(ws, P)
    return P + O_TOCOLL


# ------------------------------------------------------------------------ gates
def recalculate(path):
    soffice = shutil.which("soffice") or shutil.which("libreoffice")
    if not soffice:
        raise SystemExit(
            "ABORT: LibreOffice not found — the workbook is full of formulas with no\n"
            "       cached values and every total would read blank. Install it, or pass\n"
            "       --no-recalc for a deliberate draft that must NOT be issued."
        )
    path = Path(path)
    with tempfile.TemporaryDirectory() as td:
        subprocess.run([soffice, "--headless", "--convert-to", "xlsx",
                        "--outdir", td, str(path)],
                       check=True, capture_output=True, timeout=900)
        made = Path(td) / path.name
        if not made.exists():
            raise SystemExit(f"ABORT: recalculation produced nothing for {path.name}")
        shutil.copy(made, path)
    print(f"Recalculated: {path.name}")


def verify(path, markups_dir):
    """G6 link integrity + G+.36 values present."""
    import re as _re
    wb = load_workbook(path)
    ws = wb["MEASUREMENT"]
    missing, unlinked = [], []
    for row in ws.iter_rows(min_col=14, max_col=14):
        for c in row:
            if c.value in (None, "", "DWG Ref"):
                continue
            m = _re.match(r'=HYPERLINK\("([^"]+)"', str(c.value))
            if not m:
                unlinked.append(f"{c.coordinate}: {c.value}")
                continue
            if not (Path(path).parent / m.group(1)).exists():
                missing.append(m.group(1))
    if unlinked:
        raise SystemExit("ABORT: DWG Ref cells without a markup hyperlink:\n  " +
                         "\n  ".join(unlinked))
    if missing:
        raise SystemExit("ABORT: hyperlink targets do not exist:\n  " +
                         "\n  ".join(sorted(set(missing))))

    wbv = load_workbook(path, data_only=True)
    wsv = wbv["MEASUREMENT"]
    vals = [c.value for row in wsv.iter_rows(min_col=13, max_col=13)
            for c in row if isinstance(c.value, (int, float))]
    if not vals:
        raise SystemExit(
            "ABORT: no Total Qty value survived — the workbook holds formulas with no\n"
            "       cached results. It is not issuable."
        )
    print(f"Verified: {len(vals)} measured totals, all DWG Refs linked and resolving")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("spec"); ap.add_argument("out")
    ap.add_argument("--markups", default="markups")
    ap.add_argument("--no-recalc", action="store_true")
    a = ap.parse_args()

    spec = json.load(open(a.spec))
    L = spec["section_letter"]

    wb = Workbook()
    # NOTE: do NOT change wb._fonts[0]. Excel column width is measured in
    # characters of the WORKBOOK DEFAULT font, so changing it silently
    # renarrows every column. Fonts are set explicitly on every cell instead.
    meas = wb.active
    meas.title = "MEASUREMENT"
    index = build_measurement(meas, spec, a.markups)

    # One worksheet per SECTION, with every page stacked on it at the 62-row
    # pitch — that is how the issued bills are built, and it is what makes the
    # COLLECTION page able to point at a To Collection cell by row.
    sheet = wb.create_sheet(spec.get("sheet_name", f"Section {L}"))
    total_row = build_section_sheet(sheet, spec, index, meas_title="MEASUREMENT")
    print(f"Section total at {sheet.title}!H{total_row}")

    wb.save(a.out)
    print(f"Wrote: {a.out}")

    if not a.no_recalc:
        recalculate(a.out)
        verify(a.out, a.markups)
        # G-FORMAT: diff the SAVED workbook against house-template.md. It runs
        # after recalculation on purpose — recalculation is a round trip through
        # another application and it rewrites things that were correct when they
        # were written (row heights, cell hyperlinks, number-format spelling).
        rc = subprocess.run(
            [sys.executable, str(Path(__file__).with_name("verify_template.py")),
             a.out], capture_output=True, text=True)
        print(rc.stdout.strip() or rc.stderr.strip())
        if rc.returncode:
            raise SystemExit("ABORT: format gate failed — see above.")

        # G-SECTION: the section letter and title against POMI's OWN headings.
        # A format gate only proves the workbook obeys the house template; it
        # cannot tell you the house template letters the section wrongly. This
        # is the check whose absence let a bill titled POMI carry a section S.
        if "pomi_section_title" not in spec:
            raise SystemExit(
                "ABORT: the spec does not declare `pomi_section_title`.\n"
                "       The printed heading is the package name; the POMI\n"
                "       classification is a recorded fact, and it is declared\n"
                "       even where the two are identical. A declaration that is\n"
                "       only present when it differs is one nobody can trust."
            )
        rules = (Path(__file__).parent.parent / "references"
                 / "ref-pomi-rules.md")
        if rules.exists():
            rc = subprocess.run(
                [sys.executable,
                 str(Path(__file__).with_name("verify_sections.py")),
                 "--rules", str(rules),
                 # The heading a client reads is the PACKAGE name — "ENABLING
                 # WORKS" — which is not POMI's title for B. That is legitimate
                 # on a commercial heading and it must not be assumed: the spec
                 # DECLARES the POMI classification, and the gate tests that.
                 # Absent a declaration the printed title is tested, so a bill
                 # cannot claim a POMI section by silence.
                 "--letters", json.dumps(
                     {spec["section_letter"]: spec["pomi_section_title"]})],
                capture_output=True, text=True)
            if rc.returncode:
                print(rc.stdout.strip())
                raise SystemExit("ABORT: section gate failed — the bill section "
                                 "letter or title is not POMI's.")
            pomi_t = spec.get("pomi_section_title", spec["section_title"])
            note = ("" if pomi_t == spec["section_title"]
                    else f'  (billed as "{spec["section_title"].title()}")')
            print(f"Section gate passed: POMI {spec['section_letter']} — "
                  f"{pomi_t.title()}{note}")
    else:
        print("WARNING: --no-recalc — draft only, totals are blank, DO NOT ISSUE.")


if __name__ == "__main__":
    main()
