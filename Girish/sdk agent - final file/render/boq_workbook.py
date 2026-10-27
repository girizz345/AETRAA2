#!/usr/bin/env python3
"""
boq_workbook.py — the bill in house format, with live formulas.

The workbook computes. Frozen numbers are not rendered into it, because a bill
whose totals are values rather than formulas cannot be interrogated: a surveyor
who changes a rate expects the collection and the summary to move, and one that
does not move is a printout wearing a spreadsheet's file extension.

Rendered by the ported render/_house/build_house_takeoff.py — the builder
measured off eleven issued tender workbooks (reference/house-template.md,
LOCKED). This module composes ONE workbook from it:

  MEASUREMENT      every section's measurement blocks, one shared item index
  Section {L} ...  one sheet per section: 62-row pages, COLLECTION, TOTAL FOR
  Summary          D = SUMMARY, one row per section linking to its TOTAL FOR
                   cell, closing with TOTAL CARRIED TO FORM OF TENDER

then runs the gates the builder's main() runs — recalculate (LibreOffice),
verify (link integrity + values present), verify_template (G-FORMAT) and
verify_sections (G-SECTION) — and REPORTS each outcome instead of aborting,
so a failed gate is a gap on the run and not a crash of the stage.

  python3 -m render.boq_workbook --bill B.json --out bill.xlsx [--no-recalc]

Exit 0 = written and every gate passed. Exit 1 = written, a gate did not pass.
"""
from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
from pathlib import Path

from openpyxl import Workbook
from openpyxl.styles import Alignment, Font

from render._house import build_house_takeoff as _house

COLUMN_WIDTHS = {"A": 4.7, "C": 31.7, "E": 8.7, "F": 5.7, "G": 12.7, "H": 17.4}
FONT = ("Arial", 12)
NUMBER_FORMAT = "#,##0.00"
BORDER = "medium"                 # page-frame border, per the house template

MEASUREMENT_SHEET = "MEASUREMENT"
SUMMARY_SHEET = "Summary"
T_SUMMARY = "SUMMARY"
T_TO_TENDER = _house.T_TO_TENDER          # "TOTAL CARRIED TO FORM OF TENDER"
SUMMARY_WIDTHS = {"A": 9.711, "B": 1.711, "C": 31.711, "D": 15.711,
                  "E": 8.711, "F": 5.711, "G": 12.711, "H": 15.711}

HOUSE_DIR = Path(_house.__file__).resolve().parent
REFERENCES_DIR = HOUSE_DIR.parent / "references"
DRAFT_WARNING = "draft — not recalculated, DO NOT ISSUE"


def to_collection_formula(first_row: int, last_row: int) -> str:
    return f"=SUM(H{first_row}:H{last_row})"


def collection_formula(page_total_cells: list[str]) -> str:
    """Sums the page totals. Written as an explicit list rather than a range,
    because the page totals are not contiguous."""
    return "=" + "+".join(sorted(page_total_cells))


# ── composition ─────────────────────────────────────────────────────────────
def ordered_specs(bill) -> list[dict]:
    """house_specs in bill order: section_no, then letter."""
    specs = bill.get("house_specs") or {}
    return [specs[k] for k in sorted(
        specs, key=lambda k: (specs[k].get("section_no") or 0, k))]


def measurement_spec(bill, specs: list[dict]) -> dict:
    """ALL sections' measurement blocks concatenated into the one spec the
    ported build_measurement consumes. item_key stays unique across sections
    because item codes are '{L}-{letter}'."""
    trades = []
    for s in specs:
        t = s.get("trade") or s.get("section_title") or ""
        if t and t not in trades:
            trades.append(t)
    blocks = []
    for s in specs:
        blocks.extend(s.get("measurement") or [])
    project = bill.get("project") or next(
        (s.get("project") for s in specs if s.get("project")), "") or ""
    return {"project": project, "trade": " / ".join(trades), "measurement": blocks}


def build_summary_sheet(ws, bill, totals: list[dict], summary_ref: str) -> None:
    """house-template.md §6 'Bill summary sheet': D = SUMMARY, one row per
    section — C the last page code, D the title, H a link to the section
    sheet's TOTAL FOR cell — closing with TOTAL CARRIED TO FORM OF TENDER."""
    ws.page_setup.orientation = "portrait"
    ws.page_setup.paperSize = 9
    for col, w in SUMMARY_WIDTHS.items():
        ws.column_dimensions[col].width = w
    f = lambda b=False, sz=10.0: Font(name=_house.FONT, size=sz, bold=b)  # noqa: E731

    # the head band's lines as the section pages carry them: employer,
    # project, package (plot) - those the drawings state, in that order
    spec = next(iter((bill.get("house_specs") or {}).values()), {})
    band = [v for v in (spec.get("client"), bill.get("project"), spec.get("package")) if v]
    for i, v in enumerate(band[:3]):
        ws.cell(1 + i, 1, v).font = f(True)
    c = ws.cell(1, 4, T_SUMMARY); c.font = f(True, 9.0)
    c.alignment = Alignment(horizontal="center")
    ws.cell(1, 7, _house.H_BILL_NO).font = f(False, 8.0)
    ws.cell(1, 8, _house.H_PAGE_NO).font = f(False, 8.0)
    ws.cell(2, 7, bill.get("bill_no", "")).font = f(False, 8.0)
    ws.cell(2, 8, summary_ref).font = f(False, 8.0)

    r = 4
    refs = []
    for t in totals:
        ws.cell(r, 3, t["last_page_code"]).font = f()
        ws.cell(r, 4, t["section_title"]).font = f()
        a = ws.cell(r, 8, f"='{t['sheet_name']}'!H{t['total_row']}")
        a.font = f(); a.number_format = _house.FMT_AMT
        a.alignment = Alignment(horizontal="right")
        refs.append(f"H{r}")
        r += 2
    r += 1
    ws.cell(r, 3, T_TO_TENDER).font = f(True)
    a = ws.cell(r, 8, "=SUM(" + ",".join(refs) + ")" if refs else 0)
    a.font = f(True); a.number_format = _house.FMT_AMT
    a.alignment = Alignment(horizontal="right")


def _unpriced(specs: list[dict]) -> list[dict]:
    """The same pages with every rate blank — the bill a tenderer prices.
    Descriptions, quantities, units and letters are identical to the priced
    workbook, because the two are ONE bill in two states, not two bills."""
    import copy
    out = copy.deepcopy(specs)
    for s in out:
        for page in s.get("boq_pages", []):
            for e in page.get("entries", []):
                if e.get("kind", "item") == "item_group":
                    for it in e.get("items", []):
                        it["rate"] = None
                elif e.get("kind", "item") == "item":
                    e["rate"] = None
    return out


def compose(bill, out_path, markups_dir: str = "markup", priced: bool = True) -> dict:
    """Builds and saves the workbook. No gates. Raises on a spec fault (a page
    that overflows, a missing key) — pagination is S19's decision, not ours.

    The workbook is the BILL and nothing else: Summary first, then one sheet
    per section. Quantities are stated on the page (the house ROUNDUP of the
    measured figure), not linked to a measurement sheet — the measurement
    lives in the take-off workbook, which is issued beside it. priced=False
    writes the same pages with every rate blank."""
    specs = ordered_specs(bill)
    if not specs:
        raise ValueError("bill carries no house_specs — nothing to render")
    for s in specs:
        for key in ("section_letter", "section_title", "boq_pages"):
            if key not in s:
                raise ValueError(f"house spec {s.get('section_letter', '?')} "
                                 f"lacks {key}")
    if not priced:
        specs = _unpriced(specs)

    wb = Workbook()
    first = wb.active                      # becomes the first section sheet
    totals = []
    used_names = {SUMMARY_SHEET}
    for n, s in enumerate(specs):
        L = s["section_letter"]
        name = s.get("sheet_name") or f"Section {L}"
        if name in used_names:
            raise ValueError(f"duplicate sheet name {name!r}")
        used_names.add(name)
        if n == 0:
            ws = first
            ws.title = name
        else:
            ws = wb.create_sheet(name)
        try:
            # index={} — no measurement sheet to link to; the page states
            # its own quantity
            total_row = _house.build_section_sheet(ws, s, {}, MEASUREMENT_SHEET)
        except SystemExit as exc:            # the builder's ABORT — a spec fault
            raise ValueError(f"section {L}: {exc}") from None
        bill_no, sect = s.get("bill_no", ""), s.get("section_no", "")
        n_last = len(s["boq_pages"]) + 1      # the COLLECTION page's own code
        code = f"{bill_no}/{n_last}" if not sect else f"{bill_no}/{sect}/{n_last}"
        totals.append({"sheet_name": name, "section_letter": L,
                       "section_title": s["section_title"],
                       "last_page_code": code, "total_row": total_row})

    summary_ref = next((s.get("summary_ref") for s in specs if s.get("summary_ref")), "S1")
    summary = wb.create_sheet(SUMMARY_SHEET, 0)     # the bill opens on its Summary
    build_summary_sheet(summary, bill, totals, summary_ref)
    wb.active = 0
    for ws in wb.worksheets:
        ws.sheet_view.tabSelected = (ws is wb.worksheets[0])
    wb.save(str(out_path))

    items = 0
    for s in specs:
        for page in s["boq_pages"]:
            for e in page["entries"]:
                kind = e.get("kind", "item")
                items += len(e.get("items", [])) if kind == "item_group" else (kind == "item")
    return {"sections": len(specs), "items": items, "priced": priced,
            "pages": sum(len(s["boq_pages"]) for s in specs),
            "sheets": wb.sheetnames, "totals": totals}


# ── gates ───────────────────────────────────────────────────────────────────
# LibreOffice re-spells number formats on the recalculation round trip. The
# builder writes the house quantity and rate formats, which openpyxl stores as
# Excel's built-in formats 38 and 40; LibreOffice 26.x exports those built-ins
# in its own spelling — a minus-sign negative instead of the bracketed one —
# and writes the Accounting dash as \- instead of "-". Those are not the house
# formats and G-FORMAT is right to fail them. The strings are restored in
# xl/styles.xml alone, byte for byte to what the builder wrote; the sheet XML,
# and with it every cached value the recalculation produced, is not touched.
# Keys and values are the XML attribute spellings (quotes escaped).
LO_RESPELLINGS = {
    r"#,##0;[RED]\-#,##0": "#,##0_);[Red](#,##0)",
    r"#,##0.00;[RED]\-#,##0.00": "#,##0.00_);[Red](#,##0.00)",
    r"_(* #,##0.00_);_(* \(#,##0.00\);_(* \-??_);_(@_)":
        "_(* #,##0.00_);_(* (#,##0.00);_(* &quot;-&quot;??_);_(@_)",
    r"_(* #,##0_);_(* \(#,##0\);_(* \-??_);_(@_)":
        "_(* #,##0_);_(* (#,##0);_(* &quot;-&quot;??_);_(@_)",
}


def restore_number_formats(path) -> int:
    """Puts the house number-format strings back after a LibreOffice round
    trip. Returns how many formatCode attributes were restored."""
    import re
    import zipfile

    path = Path(path)
    with zipfile.ZipFile(path) as z:
        entries = [(i, z.read(i.filename)) for i in z.infolist()]
    restored = 0
    out_entries = []
    for info, data in entries:
        if info.filename == "xl/styles.xml":
            text = data.decode("utf-8")

            def swap(m):
                nonlocal restored
                code = m.group(1)
                if code in LO_RESPELLINGS:
                    restored += 1
                    return f'formatCode="{LO_RESPELLINGS[code]}"'
                return m.group(0)
            text = re.sub(r'formatCode="([^"]*)"', swap, text)
            data = text.encode("utf-8")
        out_entries.append((info, data))
    if restored:
        tmp = path.with_suffix(".tmp.xlsx")
        with zipfile.ZipFile(tmp, "w", zipfile.ZIP_DEFLATED) as z:
            for info, data in out_entries:
                z.writestr(info, data)
        tmp.replace(path)
    return restored


def recalculate(path) -> int:
    """The ported recalculation gate, then the format restoration it needs on
    this LibreOffice. Raises what the ported gate raises."""
    _house.recalculate(str(path))
    return restore_number_formats(path)


def _run_script(script: str, args: list[str]) -> dict:
    rc = subprocess.run([sys.executable, str(HOUSE_DIR / script), *args],
                        capture_output=True, text=True)
    out = (rc.stdout.strip() + ("\n" + rc.stderr.strip() if rc.stderr.strip() else "")).strip()
    return {"returncode": rc.returncode, "output": out}


def section_rules_path() -> Path | None:
    """verify_sections' own docstring says the standard is POMI's verbatim
    headings, not the house paraphrase; the ported main() reads
    ref-pomi-rules.md. Verbatim is preferred when present, paraphrase second,
    and the gate is skipped (recorded) when neither exists."""
    for name in ("pomi-verbatim.md", "ref-pomi-rules.md"):
        p = REFERENCES_DIR / name
        if p.is_file():
            return p
    return None


def verify_bill(out_path, recalculated: bool) -> str:
    """G+.36 on the bill workbook itself: each section sheet carries at least
    one stated quantity (column E, numeric), and — after recalculation — its
    TOTAL FOR cell holds a cached number. Raises SystemExit with the finding,
    as the ported gates do."""
    from openpyxl import load_workbook

    wb = load_workbook(out_path, data_only=True)
    sections = [ws for ws in wb.worksheets if ws.title != SUMMARY_SHEET]
    if not sections:
        raise SystemExit("ABORT: the bill has no section sheet")
    quantities = 0
    for ws in sections:
        n = sum(1 for row in ws.iter_rows(min_col=5, max_col=5)
                for c in row if isinstance(c.value, (int, float)))
        if n == 0:
            raise SystemExit(f"ABORT: {ws.title} states no quantity")
        quantities += n
    if recalculated:
        empty = [ws.title for ws in sections
                 if not any(isinstance(c.value, (int, float))
                            for row in ws.iter_rows(min_col=8, max_col=8) for c in row)]
        if empty:
            raise SystemExit("ABORT: no cached amounts after recalculation on: "
                             + ", ".join(empty))
    return f"ok — {quantities} quantities stated across {len(sections)} section sheet(s)"


def run_gates(out_path, specs: list[dict], markups_dir: str, recalc: bool) -> dict:
    """Every gate the ported main() runs, each reported rather than raised."""
    out_path = Path(out_path)
    gates: dict = {}
    problems: list[str] = []

    # G-RECALC
    soffice = shutil.which("soffice") or shutil.which("libreoffice")
    recalculated = False
    if not recalc:
        gates["recalculate"] = f"skipped — {DRAFT_WARNING}"
        problems.append(f"bill.xlsx: {DRAFT_WARNING} (recalculation not requested)")
    elif not soffice:
        gates["recalculate"] = f"skipped — {DRAFT_WARNING} (LibreOffice not found)"
        problems.append(f"bill.xlsx: {DRAFT_WARNING} — LibreOffice (soffice) not found")
    else:
        try:
            restored = recalculate(out_path)
            gates["recalculate"] = "ok"
            gates["number_formats_restored"] = restored
            recalculated = True
        except (SystemExit, subprocess.SubprocessError, OSError) as exc:
            gates["recalculate"] = f"failed: {exc}"
            problems.append(f"bill.xlsx: recalculation failed — {exc}")

    # G+.36 — every bill page states its quantities, and the recalculated
    # totals are present. (G6 link integrity belongs to the take-off workbook,
    # which is where the DWG Ref hyperlinks live.)
    try:
        gates["verify"] = verify_bill(out_path, recalculated)
    except SystemExit as exc:
        gates["verify"] = str(exc)
        problems.append(f"bill.xlsx: {str(exc).splitlines()[0]}")
    except Exception as exc:                                     # noqa: BLE001
        gates["verify"] = f"failed: {exc}"
        problems.append(f"bill.xlsx: verify did not run — {exc}")

    # G-FORMAT
    gates["verify_template"] = _run_script("verify_template.py", [str(out_path)])
    if gates["verify_template"]["returncode"]:
        problems.append("bill.xlsx: format gate FAILED — "
                        + gates["verify_template"]["output"])

    # G-SECTION
    letters = {}
    for s in specs:
        if "pomi_section_title" not in s:
            problems.append(f"section {s.get('section_letter')}: spec does not "
                            f"declare pomi_section_title")
        else:
            letters[s["section_letter"]] = s["pomi_section_title"]
    rules = section_rules_path()
    if rules is None:
        gates["verify_sections"] = "skipped — no rules file under render/references"
        problems.append("bill.xlsx: section gate skipped — no POMI rules file")
    elif letters:
        gates["verify_sections"] = _run_script(
            "verify_sections.py", ["--rules", str(rules), "--letters", json.dumps(letters)])
        gates["verify_sections"]["rules"] = rules.name
        if gates["verify_sections"]["returncode"]:
            problems.append("bill.xlsx: section gate FAILED — "
                            + gates["verify_sections"]["output"])
    else:
        gates["verify_sections"] = "skipped — no section declared pomi_section_title"

    gates["recalculated"] = recalculated
    gates["problems"] = problems
    return gates


def write(bill, out_path, markups_dir: str = "markup", recalc: bool = True,
          priced: bool = True) -> dict:
    """ONE workbook, then the gates. Returns the counts plus "gates" (each
    outcome), "recalculated" and "problems" (gap texts — never raised)."""
    counts = compose(bill, out_path, markups_dir, priced=priced)
    gates = run_gates(out_path, ordered_specs(bill), markups_dir, recalc)
    counts["gates"] = gates
    counts["recalculated"] = gates["recalculated"]
    counts["problems"] = gates["problems"]
    return counts


def main() -> int:
    ap = argparse.ArgumentParser(description="Render the BOQ workbook.")
    ap.add_argument("--bill", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--markups", default="markup")
    ap.add_argument("--no-recalc", action="store_true")
    args = ap.parse_args()
    bill = json.loads(Path(args.bill).read_text())
    result = write(bill, args.out, args.markups, recalc=not args.no_recalc)
    print(f"Wrote {args.out}: sheets {result['sheets']}")
    for p in result["problems"]:
        print(f"  GAP  {p}")
    return 1 if result["problems"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
