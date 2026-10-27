#!/usr/bin/env python3
"""
register_output.py — the register as a workbook, and the first thing the client
can actually check.

Four sheets, and THREE OF THEM DESCRIBE SOMETHING THAT IS NOT THERE. That is
deliberate: absence is the hardest thing for a reviewer to notice, because
reading a document only ever shows what is in it.

  REGISTER      every sheet — number, title, revision, scale, discipline, status
  REVISIONS     which revision governs, which is superseded, and why
  READINESS     per sheet and per package: measurable by software, or not
  COVERAGE      which drawings feed which section — and which sections have
                nothing feeding them

COVERAGE is the tab that becomes a query to the employer before it is anything
else, and it is the same information the completeness gate later uses to refuse
to issue a bill with no windows in it.

READINESS is the commercial one. "Of 385 sheets, 340 can be measured directly.
45 are flat images and will need measuring by hand" is a different job to price
than one where that is discovered after the work is taken on.

Output hygiene applies here as everywhere: no script, tool or variable names in
any user-facing cell, no emoji, formal language.

  python3 -m readers.register_output --register R.json --out register.xlsx

Exit 0 = written. Exit 2 = register unreadable.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from ingest import crosswalk
from render.hygiene import violations

SHEETS = ("REGISTER", "REVISIONS", "READINESS", "COVERAGE")

COLUMNS = {
    "REGISTER": ("Drawing No", "Title", "Revision", "Scale", "Discipline",
                 "Sheet Type", "Status"),
    "REVISIONS": ("Drawing No", "Governing Revision", "Superseded Revision",
                  "Superseded File", "Basis"),
    "READINESS": ("Drawing No", "File", "Tier", "Measurable", "Reason"),
    "COVERAGE": ("Section", "Section Title", "Drawings", "Schedules", "Status"),
}

WIDTHS = {"REGISTER": (16, 42, 10, 12, 26, 14, 26),
          "REVISIONS": (16, 20, 22, 34, 40),
          "READINESS": (16, 34, 8, 14, 60),
          "COVERAGE": (10, 34, 12, 12, 34)}

TIER_MEASURABLE = {"T2": "Yes", "T1": "Yes", "T3": "No", "T4": "No"}
TIER_REASON = {
    "T2": "Vector drawing with a readable text layer.",
    "T1": "Native CAD.",
    "T3": "Text is outlined. Dimensions cannot be read. Request the CAD file.",
    "T4": "Flat image. Requires measurement by hand.",
}


def _rows(sheets: list[dict]) -> dict[str, list[tuple]]:
    reg, rev, rdy = [], [], []
    for s in sheets:
        status = ("Superseded by " + s["superseded_by"]) if s.get("superseded_by") \
            else ("Unresolved title block" if not s.get("drawing_no") else "Current")
        reg.append((s.get("drawing_no") or "Unresolved", s.get("title") or "",
                    s.get("revision") or "", s.get("scale") or "",
                    s.get("discipline") or "", s.get("sheet_kind") or "",
                    status))
        if s.get("superseded_by"):
            gov = next((g for g in sheets if g["doc_id"] == s["superseded_by"]), {})
            rev.append((s.get("drawing_no") or "", gov.get("revision") or "",
                        s.get("revision") or "", s["doc_id"],
                        "Later revision of the same drawing number is present."))
        tier = s.get("tier", "T4")
        rdy.append((s.get("drawing_no") or "Unresolved", s["doc_id"], tier,
                    TIER_MEASURABLE.get(tier, "No"), TIER_REASON.get(tier, "")))

    cov = []
    for letter in crosswalk.ordered():
        feeding = [s for s in sheets
                   if letter in (s.get("section") or "") and not s.get("superseded_by")]
        scheds = [s for s in feeding if "SCHEDULE" in (s.get("title") or "").upper()]
        status = ("No drawings found — raise as a query to the employer"
                  if not feeding else "Covered")
        cov.append((letter, crosswalk.title(letter), len(feeding), len(scheds), status))
    return {"REGISTER": reg, "REVISIONS": rev, "READINESS": rdy, "COVERAGE": cov}


def write_workbook(register_path: Path, out_path: Path) -> dict[str, int]:
    """Returns per-sheet row counts. Never pads a section with an empty tab —
    an empty tab reads as 'nothing to measure' where the truth is 'nothing was
    found', and those are different claims."""
    from openpyxl import Workbook
    from openpyxl.styles import Alignment, Border, Font, PatternFill, Side

    data = json.loads(Path(register_path).read_text())
    rows = _rows(data["sheets"])

    wb = Workbook(); wb.remove(wb.active)
    head_font = Font(name="Arial", size=11, bold=True, color="FFFFFF")
    head_fill = PatternFill("solid", fgColor="1F3864")
    body_font = Font(name="Arial", size=10)
    thin = Side(style="thin", color="BFBFBF")
    border = Border(left=thin, right=thin, top=thin, bottom=thin)

    counts: dict[str, int] = {}
    problems: list[str] = []
    for name in SHEETS:
        ws = wb.create_sheet(name)
        for c, (title, width) in enumerate(zip(COLUMNS[name], WIDTHS[name]), 1):
            cell = ws.cell(row=1, column=c, value=title)
            cell.font, cell.fill, cell.border = head_font, head_fill, border
            cell.alignment = Alignment(vertical="center")
            ws.column_dimensions[cell.column_letter].width = width
        for r, row in enumerate(rows[name], 2):
            for c, value in enumerate(row, 1):
                cell = ws.cell(row=r, column=c, value=value)
                cell.font, cell.border = body_font, border
                cell.alignment = Alignment(vertical="top", wrap_text=(c == 5))
                if isinstance(value, str):
                    found = violations(value)
                    if found:
                        # a gap, not a refusal: the register is the one output
                        # that must always be produced, and the cell is quoted
                        # as it is — never rewritten, never dropped
                        problems.append(f"{name}!{cell.coordinate} fails output "
                                        f"hygiene ({'; '.join(found)}): {value!r}")
        ws.freeze_panes = "A2"
        ws.auto_filter.ref = ws.dimensions
        counts[name] = len(rows[name])
    Path(out_path).parent.mkdir(parents=True, exist_ok=True)
    wb.save(out_path)
    counts["_hygiene"] = problems          # type: ignore[assignment]
    return counts


def main() -> int:
    ap = argparse.ArgumentParser(description="Render the register workbook.")
    ap.add_argument("--register", required=True)
    ap.add_argument("--out", required=True)
    args = ap.parse_args()
    if not Path(args.register).is_file():
        print(f"ERROR: no register at {args.register}", file=sys.stderr)
        return 2
    counts = write_workbook(Path(args.register), Path(args.out))
    for name in SHEETS:
        print(f"  {name:<12} {counts.get(name, 0)} rows")
    print(f"  -> {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
