#!/usr/bin/env python3
"""
provenance.py — bill line to clause to evidence to sheet, with its origin.

Built from the artefacts, never read back from the rendered workbook. Reading
it back would let the provenance sheet inherit the workbook's own errors and
then corroborate them, which is worse than having no provenance sheet at all.

The reason it ships rather than staying internal: every Aetraa output is signed
by a senior professional, and before signing they need to see which quantities
rest on inference and which rates rest on a search. A bill where all three
columns read "stated" and "library" is a different document from one where a
fifth of them do not, and only the provenance sheet shows the difference.

It is also what makes the client's own review fast. An untraceable number costs
a checker as much to verify as it would to measure again — which would make the
system slower than the people it is meant to help. The trail is what lets them
check in minutes.

The join: bill.json line -> priced.json row (by ref) -> takeoff.json item (by
code, for its lines' evidence_ids) -> evidence.json records (doc_id, origin)
-> register.json (doc_id -> drawing number). Basis is the WEAKEST origin among
the line's evidence, labelled through BASIS_LABELS. A line that resolves to no
evidence is reported, not invented.

  python3 -m render.provenance --run runs/<id> --out provenance.xlsx

Exit 0 = every line traced. Exit 1 = a line resolved to no evidence (halt).
"""
from __future__ import annotations

import argparse
import json
from dataclasses import dataclass
from pathlib import Path

COLUMNS = ("Bill Ref", "Item", "Description", "Clause", "Quantity", "Unit",
           "Evidence", "Drawings", "Basis", "Rate", "Rate Source", "Rate Date")

BASIS_LABELS = {"stated": "Stated on drawing or schedule",
                "transcribed": "Stated on drawn schedule, transcribed",
                "derived": "Stated level difference",
                "counted": "Counted from drawing",
                "measured": "Measured to calibrated scale",
                "inferred": "Derived — see Analysis"}
ORIGIN_ORDER = ("stated", "transcribed", "derived", "counted", "measured",
                "inferred")   # weakest last
UNTRACED = "No evidence resolved — query"
FONT_NAME = "Arial"


@dataclass(frozen=True)
class ProvenanceRow:
    bill_ref: str
    item_letter: str
    description: str
    clause_id: str
    quantity: str
    unit: str
    evidence_ids: tuple
    drawings: tuple
    basis: str
    rate: str | None
    rate_source: str | None
    rate_date: str | None


def _load(run_dir: Path, name: str, default):
    p = run_dir / name
    if not p.is_file():
        return default
    return json.loads(p.read_text())


def _weakest(origins: list[str]) -> str:
    known = [o for o in origins if o in ORIGIN_ORDER]
    if not known:
        return "inferred"
    return max(known, key=ORIGIN_ORDER.index)


def build(run_dir, problems: list | None = None) -> list[ProvenanceRow]:
    """One row per bill line, sections in bill order. `problems`, when given,
    receives the halt condition for every line that resolved to no evidence —
    recorded, not raised, so the stage can gap it."""
    run_dir = Path(run_dir)
    bill = _load(run_dir, "bill.json", {})
    priced = _load(run_dir, "priced.json", {})
    takeoff = _load(run_dir, "takeoff.json", {})
    evidence = _load(run_dir, "evidence.json", {})
    register = _load(run_dir, "register.json", {})

    priced_by_ref = {r.get("ref"): r for r in priced.get("rows", [])}
    takeoff_by_code = {i.get("code"): i for s in takeoff.get("sections", [])
                       for i in s.get("items", [])}
    records = {r["id"]: r for r in evidence.get("records", [])}
    drawing_no = {s.get("doc_id"): (s.get("drawing_no") or s.get("doc_id"))
                  for s in register.get("sheets", [])}

    rows: list[ProvenanceRow] = []
    for section in bill.get("sections", []):
        for line in section.get("lines", []):
            ref = str(line.get("ref") or "")
            ids = set(line.get("evidence_ids") or [])
            item = takeoff_by_code.get(ref)
            if item is not None:
                for ln in item.get("lines", []):
                    ids.update(ln.get("evidence_ids") or [])
            ids_sorted = tuple(sorted(ids))
            found = [records[i] for i in ids_sorted if i in records]
            unknown = [i for i in ids_sorted if i not in records]
            docs = sorted({drawing_no.get(r["doc_id"], r["doc_id"]) for r in found})
            if found:
                basis = BASIS_LABELS[_weakest([r.get("origin", "") for r in found])]
                if unknown and problems is not None:
                    problems.append(f"{ref}: evidence ids not in evidence.json — "
                                    f"{', '.join(unknown)}")
            else:
                basis = UNTRACED
                if problems is not None:
                    problems.append(
                        f"{ref}: resolves to no evidence record — halt condition; "
                        f"the line cannot be signed" +
                        (f" (cited {', '.join(unknown)})" if unknown else ""))
            pr = priced_by_ref.get(ref, {})
            rate = line.get("rate") if line.get("rate") is not None else pr.get("rate")
            rows.append(ProvenanceRow(
                bill_ref=ref,
                item_letter=str(line.get("item_letter") or ""),
                description=str(line.get("description") or ""),
                clause_id=str(line.get("clause_id") or ""),
                quantity=str(line.get("quantity") if line.get("quantity") is not None else ""),
                unit=str(line.get("unit") or ""),
                evidence_ids=ids_sorted,
                drawings=tuple(docs),
                basis=basis,
                rate=None if rate is None else str(rate),
                rate_source=line.get("rate_source") or pr.get("citation"),
                rate_date=pr.get("rate_date") or pr.get("date"),
            ))
    return rows


def write(rows: list[ProvenanceRow], out_path) -> int:
    """provenance.xlsx — COLUMNS header, one row per bill line, Arial. A None
    is written as an empty cell, never as the word."""
    from openpyxl import Workbook
    from openpyxl.styles import Font

    wb = Workbook()
    ws = wb.active
    ws.title = "PROVENANCE"
    bold, plain = Font(name=FONT_NAME, size=10, bold=True), Font(name=FONT_NAME, size=10)
    for i, h in enumerate(COLUMNS, 1):
        ws.cell(1, i, h).font = bold
    for r, row in enumerate(rows, 2):
        values = (row.bill_ref, row.item_letter, row.description, row.clause_id,
                  row.quantity, row.unit, ", ".join(row.evidence_ids),
                  ", ".join(row.drawings), row.basis, row.rate, row.rate_source,
                  row.rate_date)
        for i, v in enumerate(values, 1):
            ws.cell(r, i, "" if v is None else v).font = plain
    for col, w in zip("ABCDEFGHIJKL", (10, 6, 60, 10, 12, 6, 30, 30, 30, 12, 40, 12)):
        ws.column_dimensions[col].width = w
    ws.freeze_panes = "A2"
    wb.save(str(out_path))
    return len(rows)


def main() -> int:
    ap = argparse.ArgumentParser(description="Build the provenance sheet.")
    ap.add_argument("--run", required=True)
    ap.add_argument("--out", required=True)
    args = ap.parse_args()
    problems: list[str] = []
    rows = build(Path(args.run), problems)
    write(rows, args.out)
    print(f"{len(rows)} line(s) traced to {args.out}")
    for p in problems:
        print(f"  HALT  {p}")
    return 1 if problems else 0


if __name__ == "__main__":
    raise SystemExit(main())
