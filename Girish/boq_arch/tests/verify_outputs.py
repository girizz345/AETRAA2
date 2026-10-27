"""Independent checks on a run's workbooks - re-derived from the files, not from the builder's constants.

    python tests/verify_outputs.py [output dir]

1. Take-off <-> BOQ: every item's quantity recomputed from the take-off's own dimension
   cells (Nr x L x W x H or Qty each, deductions negative) and compared with the BOQ.
2. House template: widths A-G, 62-row pages, band strings, section heading every page,
   'To Collection' =SUM over P+9..P+54, item letters restart per page and skip I and O,
   no wrapText in the body, Arial throughout.
Exit 0 when every check passes.
"""
import re
import sys
from pathlib import Path

import openpyxl

out = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parents[1] / "output"
fails = []
LETTERS = list("ABCDEFGHJKLMNPQRSTUVWXYZ")


def takeoff_quantities(ws):
    q, code = {}, None
    for r in range(3, ws.max_row + 1):
        c, d = ws.cell(r, 3).value, ws.cell(r, 4).value
        # an item header row: code and description, no drawing ref and no Nr
        if c and d and ws.cell(r, 1).value is None and ws.cell(r, 5).value is None:
            code = c
            q[code] = 0.0
            continue
        if code and c == code and ws.cell(r, 5).value is not None:
            nr = ws.cell(r, 5).value or 0
            dims = [ws.cell(r, k).value for k in (6, 7, 8) if ws.cell(r, k).value is not None]
            i = ws.cell(r, 9).value
            if dims:
                v = 1.0
                for x in dims:
                    v *= x
                if isinstance(i, str) and i.startswith("=-"):
                    v = -v
            else:
                v = float(i or 0)
            q[code] += nr * v
    return q


def boq_quantities(ws):
    return [ws.cell(r, 5).value for r in range(1, ws.max_row + 1)
            if (ws.cell(r, 1).value in LETTERS or re.fullmatch(r"([A-Z])\1+", str(ws.cell(r, 1).value or "")))
            and isinstance(ws.cell(r, 5).value, (int, float))]


# fonts of the issued sample bills (Output Sample -BOQ\Bill No.1 / Bill No.6): (size, bold, underlined)
SAMPLE_FONTS = {"band line": (10, True, False), "BILL OF QUANTITIES": (8, False, False),
                "section title D3": (9, True, False), "codes G3/H3": (9, True, False),
                "head band": (8, False, False), "section heading": (10, True, True),
                "To Collection": (10, False, False)}


def font_of(c):
    return (c.font.sz, bool(c.font.b), bool(c.font.u))


def check_fonts(path):
  for ws in openpyxl.load_workbook(path).worksheets[1:]:
      for P in range(1, ws.max_row, 62):
          got = {"band line": font_of(ws.cell(P, 1)), "BILL OF QUANTITIES": font_of(ws.cell(P, 4)),
                 "section title D3": font_of(ws.cell(P + 2, 4)), "codes G3/H3": font_of(ws.cell(P + 2, 8)),
                 "head band": font_of(ws.cell(P + 5, 8)), "section heading": font_of(ws.cell(P + 8, 3))}
          if ws.cell(P + 60, 4).value == "To Collection":
              got["To Collection"] = font_of(ws.cell(P + 60, 4))
          for k, v in got.items():
              if ws.cell(P + 8, 3).value is None and k == "section heading":
                  continue
              if v != SAMPLE_FONTS[k]:
                  fails.append(f"{path.name} p{P}: {k} font {v} != sample {SAMPLE_FONTS[k]}")


def check_template(path):
    wb = openpyxl.load_workbook(path)
    for ws in wb.worksheets[1:]:
        for col, w in {"A": 4.711, "B": 1.711, "C": 31.711, "D": 15.711, "E": 8.711, "F": 5.711, "G": 12.711}.items():
            if abs(ws.column_dimensions[col].width - w) > 0.01:
                fails.append(f"{path.name}: column {col} width {ws.column_dimensions[col].width} != {w}")
        pages = range(1, ws.max_row + 1, 62)
        for P in pages:
            band = (ws.cell(P, 4).value, ws.cell(P, 7).value, ws.cell(P, 8).value)
            if band != ("BILL OF QUANTITIES", "BILL NO.", "PAGE NO."):
                fails.append(f"{path.name} p{P}: band {band}")
            if ws.cell(P + 60, 4).value == "To Collection":
                if ws.cell(P + 60, 8).value != f"=SUM(H{P + 9}:H{P + 54})":
                    fails.append(f"{path.name} p{P}: To Collection {ws.cell(P + 60, 8).value}")
                head = str(ws.cell(P + 8, 3).value or "")
                if not head.startswith("SECTION "):
                    fails.append(f"{path.name} p{P}: no section heading at P+8")
            seq = [ws.cell(r, 1).value for r in range(P + 9, P + 55) if ws.cell(r, 1).value]
            if seq != LETTERS[:len(seq)]:
                fails.append(f"{path.name} p{P}: item letters {seq}")
        for row in ws.iter_rows():
            for c in row:
                if c.value is not None and c.font and c.font.name != "Arial":
                    fails.append(f"{path.name} {c.coordinate}: font {c.font.name}")
                if c.alignment and c.alignment.wrap_text:
                    fails.append(f"{path.name} {c.coordinate}: wrapText in body")


tk = next(out.glob("* - Take-off - *.xlsx"))
bq = next(out.glob("* - BOQ Unpriced - *.xlsx"))
twb, bwb = openpyxl.load_workbook(tk), openpyxl.load_workbook(bq)
if len(twb.worksheets) != len(bwb.worksheets):
    fails.append(f"take-off has {len(twb.worksheets) - 1} section tabs, bill has {len(bwb.worksheets) - 1} sheets")
for tws, bws in zip(twb.worksheets[1:], bwb.worksheets[1:]):
    tq = takeoff_quantities(tws)
    bqs = boq_quantities(bws)
    # an OPEN item (counts disagree) carries no quantity on either side
    open_codes = {tws.cell(r, 3).value for r in range(3, tws.max_row + 1) if tws.cell(r, 10).value == "OPEN"}
    open_codes |= {tws.cell(r - 1, 3).value for r in range(4, tws.max_row + 1) if tws.cell(r, 10).value == "OPEN"}
    exp = [0 if v <= 0 else max(1, int(v + 0.5)) for k, v in tq.items() if not (v == 0 and open_codes)]
    if exp != bqs:
        fails.append(f"{tws.title} / {bws.title}: take-off {exp} != BOQ {bqs}")
    else:
        print(f"{tws.title} -> bill sheet '{bws.title}': {len(bqs)} items, quantities agree")
check_template(bq)
check_fonts(bq)

if fails:
    print("\n".join(fails[:60]))
    print(f"FAILED: {len(fails)} check(s)")
    sys.exit(1)
print(f"PASSED: {len(bwb.worksheets) - 1} sections, house template, fonts and quantities")
