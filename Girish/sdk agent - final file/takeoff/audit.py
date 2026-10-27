#!/usr/bin/env python3
"""
audit.py — the three tabs that make the take-off checkable.

Following the client's issued shape, because a surveyor already knows how to
read it and a new layout would cost them time to learn for no gain.

  AN.RECONCILIATION  where two sources disagreed and what was done about it.
                     Also the only place a completeness FAIL may be converted
                     to a PASS, by written justification — "lifts in a separate
                     nominated package per spec section X". Silence is not a
                     resolution.
  AN.SUBSTANTIVE     the judgement calls: which clause was applied where it was
                     not obvious, which threshold decided an item out, which
                     deduction rule governed.
  AN.COVERAGE        evidence present against output produced, per section.
                     The same matrix the completeness gate runs on, shown to
                     the reader rather than only enforced.

These are not appendices. AN.COVERAGE is the tab a reviewer should read first,
because it is the only one that describes what is absent.

Everything here is read from the run folder's own artefacts — inventory.json
for the discrepancies, classifications.json for the judgements, elements.json
and quantities.json for the coverage matrix. A missing artefact is an empty
tab, never a crash: a run that stopped early still gets an audit that says
what it found.

  python3 -m takeoff.audit --run runs/<id>

Exit 0 = tabs built. Exit 1 = unresolved reconciliation entries remain.
"""
from __future__ import annotations

import argparse
import json
from dataclasses import dataclass
from pathlib import Path

TABS = ("AN.RECONCILIATION", "AN.SUBSTANTIVE", "AN.COVERAGE")

# element type (measure.intake) -> evidence kind (data/gates.json G+.29).
# The same mapping S16 uses, so the coverage tab and the gate agree.
EVIDENCE_KIND_BY_TYPE = {
    "door": "door_schedule",
    "window": "window_schedule",
    "finish": "finish_schedule",
    "sanitary": "sanitary_schedule",
    "fixture": "sanitary_schedule",
    "equipment": "equipment_schedule",
    "slab": "structural_schedule",
    "column": "structural_schedule",
    "beam": "structural_schedule",
}


@dataclass(frozen=True)
class ReconciliationEntry:
    subject: str
    source_a: str
    value_a: str
    source_b: str
    value_b: str
    resolution: str | None       # None = open, and it stays open in the output
    justified_by: str | None     # spec clause, RFI number — never a bare word

    def row(self) -> list:
        return [self.subject, self.source_a, self.value_a, self.source_b,
                self.value_b, self.resolution, self.justified_by]


@dataclass(frozen=True)
class SubstantiveEntry:
    item_code: str
    judgement: str               # what was decided
    basis: str                   # the clause or rule that decided it
    alternative: str | None      # what else it could have been, if arguable

    def row(self) -> list:
        return [self.item_code, self.judgement, self.basis, self.alternative]


@dataclass(frozen=True)
class CoverageEntry:
    section: str
    evidence_kind: str
    evidence_count: int
    output_rows: int
    status: str                  # PASS / FAIL / JUSTIFIED

    def row(self) -> list:
        return [self.section, self.evidence_kind, self.evidence_count,
                self.output_rows, self.status]


def _load(path: Path) -> dict:
    """A dict, or an empty one. Never raises — a missing or malformed input
    is an empty tab, which the reader can see, not a traceback."""
    try:
        data = json.loads(Path(path).read_text())
    except (OSError, ValueError):
        return {}
    return data if isinstance(data, dict) else {}


def _codes_from_takeoff(run: Path) -> dict:
    """(clause_id, element_mark) -> item code, from takeoff.json if it has
    been written. Before S13 has run there are no codes and the mark stands
    in for one."""
    codes: dict = {}
    for section in _load(run / "takeoff.json").get("sections", []) or []:
        for item in section.get("items", []) or []:
            key = (item.get("clause_id"), item.get("element_mark"))
            if item.get("code"):
                codes[key] = item["code"]
    return codes


def reconciliation(run: Path) -> list[ReconciliationEntry]:
    entries = []
    for d in _load(run / "inventory.json").get("discrepancies", []) or []:
        if not isinstance(d, dict):
            continue
        entries.append(ReconciliationEntry(
            subject=str(d.get("mark", "")),
            source_a="schedule count", value_a=str(d.get("schedule", "")),
            source_b="plan tag count", value_b=str(d.get("plan_tags", "")),
            resolution=None, justified_by=None))
    return sorted(entries, key=lambda e: e.subject)


def substantive(run: Path, item_codes: dict | None = None
                ) -> list[SubstantiveEntry]:
    data = _load(run / "classifications.json")
    codes = item_codes if item_codes is not None else _codes_from_takeoff(run)
    basis = str(data.get("basis") or "stated clause")
    entries = []
    for r in data.get("rows", []) or []:
        if not isinstance(r, dict):
            continue
        clause, mark = r.get("clause"), r.get("mark")
        code = codes.get((clause, mark), str(mark))
        entries.append(SubstantiveEntry(
            item_code=str(code),
            judgement=f"clause {clause} applied to {mark}",
            basis=basis, alternative=None))
    return sorted(entries, key=lambda e: (e.item_code, e.judgement))


def justifications(run: Path) -> dict:
    """{(evidence_kind, section): text} from AN_RECONCILIATION.json in the
    run folder, if a surveyor wrote one. Same file S16 reads."""
    out = {}
    for key, text in _load(run / "AN_RECONCILIATION.json").items():
        if "|" in str(key) and str(text).strip():
            kind, section = str(key).split("|", 1)
            out[(kind, section)] = str(text)
    return out


def coverage(run: Path) -> list[CoverageEntry]:
    elements = _load(run / "elements.json").get("elements", []) or []
    quantities = _load(run / "quantities.json").get("rows", []) or []
    if not elements and not quantities:
        return []
    evidence_counts: dict[str, int] = {}
    for e in elements:
        if not isinstance(e, dict):
            continue
        kind = EVIDENCE_KIND_BY_TYPE.get(str(e.get("element_type")))
        if kind:
            evidence_counts[kind] = evidence_counts.get(kind, 0) + 1
    rows_by_section: dict[str, int] = {}
    for q in quantities:
        if isinstance(q, dict) and q.get("section"):
            rows_by_section[q["section"]] = rows_by_section.get(q["section"], 0) + 1
    try:
        from bill.completeness import check
        findings = check(evidence_counts, rows_by_section, justifications(run))
    except Exception:                                       # noqa: BLE001
        return []
    entries = [CoverageEntry(f.section, f.evidence_kind, f.evidence_count,
                             f.output_rows, f.status) for f in findings]
    return sorted(entries, key=lambda e: (e.section, e.evidence_kind))


def build(run_dir, item_codes: dict | None = None) -> dict[str, list]:
    """The three tabs as lists of rows, in the shape audit.json carries.
    `item_codes` ({(clause_id, element_mark): code}) lets the take-off stage
    label the substantive tab before takeoff.json exists on disk."""
    run = Path(run_dir)
    return {
        "AN.RECONCILIATION": [e.row() for e in reconciliation(run)],
        "AN.SUBSTANTIVE": [e.row() for e in substantive(run, item_codes)],
        "AN.COVERAGE": [e.row() for e in coverage(run)],
    }


def main() -> int:
    ap = argparse.ArgumentParser(description="Build the take-off audit tabs.")
    ap.add_argument("--run", required=True)
    args = ap.parse_args()
    tabs = build(Path(args.run))
    for name in TABS:
        print(f"  {name:<20} {len(tabs[name]):>4} row(s)")
    unresolved = [r for r in tabs["AN.RECONCILIATION"] if r[5] is None]
    if unresolved:
        print(f"\n{len(unresolved)} reconciliation entr"
              f"{'y' if len(unresolved) == 1 else 'ies'} unresolved")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
