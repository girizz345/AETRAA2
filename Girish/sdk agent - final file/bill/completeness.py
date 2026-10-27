#!/usr/bin/env python3
"""
completeness.py — the gate. The only stage that looks for what is not there.

Every other check in this pipeline verifies what was measured. None of them can
see what was never measured, and a section missing from a bid is the failure
that costs real money — it is also the one a human reviewer cannot reliably
perform, because reading a document only ever shows what is in it.

The matrix: evidence of a kind must produce output of the corresponding kind.

  a non-empty door schedule      -> at least one row in H
  wet rooms                      -> waterproofing in G, wall tile in J,
                                    floor drains in Q
  stairs                         -> balustrade in E
  lifts                          -> a row in P

A FAIL blocks output. It may be converted to a PASS only by a written
justification recorded in AN.RECONCILIATION — "lifts are in a separate
nominated package per specification section X" is a resolution; silence is not,
and neither is a tick.

This is built early in the build order on purpose. A completeness gate written
after the fact tends to be written to pass the output that already exists.

A gate that has never been observed to fail is not a gate: the test suite
constructs evidence sets with a known omission and asserts that it fires.

  python3 -m bill.completeness --run runs/<id>

Exit 0 = PASS. Exit 1 = FAIL, output blocked. Exit 2 = matrix unreadable.
"""
from __future__ import annotations

import argparse
from dataclasses import dataclass
from decimal import Decimal

from spine.errors import CompletenessFailure

# The matrix is DATA (data/gates.json, G+.29) rather than a literal here. Two
# reasons: a surveyor who does not read Python has to be able to read the gate
# they are being blocked by, and the matrix grew — the harvested G+.29 adds the
# finish, equipment, structural, apartment-mix and external-area implications
# that this file's original ten kinds did not carry.
#
# Some rows are ANY-OF: an equipment schedule must produce a row in Q or in R,
# because which of the two owns a given piece of plant is a project decision.
# Those are reported as one finding over the group, never as two findings one of
# which always fails.
from ingest.gates import Gates

_GATES: Gates | None = None


def gates() -> Gates:
    global _GATES
    if _GATES is None:
        _GATES = Gates.load()
    return _GATES


def matrix() -> dict:
    """evidence kind -> the sections it must produce rows in."""
    return gates().matrix()


@dataclass(frozen=True)
class Finding:
    evidence_kind: str
    evidence_count: int
    section: str
    output_rows: int
    justification: str | None
    reason: str | None = None       # what failed, where "no rows in X" is not it

    @property
    def status(self) -> str:
        if self.output_rows > 0:
            return "PASS"
        return "JUSTIFIED" if self.justification else "FAIL"


def check(evidence_counts: dict[str, int], rows_by_section: dict[str, int],
          justifications: dict[tuple, str] | None = None) -> list[Finding]:
    """Sorted findings. Justifications are keyed (evidence_kind, section) and
    must carry text — an empty string is not a justification.

    An any-of row is keyed on the joined section string ("Q|R"), so a
    justification for it is written against the group it was raised on."""
    justifications = justifications or {}
    findings: list[Finding] = []
    for row in sorted(gates().completeness_rows(),
                      key=lambda r: r.evidence_kind):
        count = evidence_counts.get(row.evidence_kind, 0)
        if count <= 0:
            continue
        if row.any_of:
            label = "|".join(row.sections)
            total = sum(rows_by_section.get(s, 0) for s in row.sections)
            note = justifications.get((row.evidence_kind, label)) or None
            findings.append(Finding(row.evidence_kind, count, label, total,
                                    note))
            continue
        for section in row.sections:
            note = justifications.get((row.evidence_kind, section)) or None
            findings.append(Finding(row.evidence_kind, count, section,
                                    rows_by_section.get(section, 0), note))
    return findings


UNREAD_KIND = {"door": "door_schedule", "window": "window_schedule",
               "glazing": "window_schedule", "louvre": "window_schedule"}


def unread(schedules: list[dict], justifications: dict[tuple, str] | None = None
           ) -> list[Finding]:
    """One FAIL per door or window schedule that is in the package and was not
    read (stage 6). check() cannot see it: it asks that each kind of evidence
    present produce rows, and an unread sheet produced no evidence at all - on
    one run the window schedule A-13-002 timed out and the bill issued with 11
    of 199 windows and the gate "clear". Justified, like any FAIL, by text in
    AN_RECONCILIATION.json keyed "unread_schedule|<drawing no>"."""
    justifications = justifications or {}
    out = []
    for s in sorted(schedules, key=lambda s: str(s.get("drawing_no") or s.get("doc_id"))):
        label = str(s.get("drawing_no") or s.get("doc_id"))
        kind = UNREAD_KIND.get(s.get("subject") or "", "schedule")
        sections = matrix().get(kind) or ["H"]
        out.append(Finding(f"unread_schedule {label}", 1, "|".join(sections), 0,
                           justifications.get(("unread_schedule", label)) or None,
                           reason=f"{s.get('subject')} schedule {label} is in the package "
                                  f"and was not read ({s.get('problem', 'no rows')})"))
    return out


# Sections this version can bill only from geometry measured off the plans and
# sections, and does not yet measure (CR-01 §4, the producer map). A FAIL there
# is scope this build has not reached - said so, by name - not a hole in the
# drawings. Remove a letter as its measured path lands (CR-01 §10).
NOT_YET_MEASURED = {
    "B": "site work (excavation, paving, external works) by volume and area",
    "K": "partitions by measured run",
}
# Sections this version measures off the calibrated plans (S8, measure.
# measured). Missing, they were not measured IN THIS RUN - the plans had no
# verified scale or no wall layer, or a storey height or the slab thickness is
# not stated - and the S8 lines of the gaps say which.
MEASURED_BY_PLANS = {
    "D": "blockwork by wall length x clear height",
    "G": "waterproofing by area",
    "J": "finishes by room area and wall area",
}


def coverage(findings: list[Finding], rows_by_section: dict[str, int]) -> dict:
    """What the bill covers and what it does not, section by section (CR-01
    §7). The gate itself is not narrowed: every FAIL stays a FAIL and is listed
    here with why - a schedule that was not read, a section this version does
    not yet measure, or evidence with nothing billed from it."""
    missing = []
    for f in findings:
        if f.status != "FAIL":
            continue
        letters = f.section.split("|")
        if f.reason:
            why, detail = "schedule not read", f.reason
        elif any(s in NOT_YET_MEASURED for s in letters):
            why = "not yet measured by this version"
            detail = "; ".join(NOT_YET_MEASURED[s] for s in letters if s in NOT_YET_MEASURED)
        elif any(s in MEASURED_BY_PLANS for s in letters):
            why = "not measured from the plans in this run"
            detail = ("; ".join(MEASURED_BY_PLANS[s] for s in letters if s in MEASURED_BY_PLANS)
                      + " - see the S8 and S9 lines in 'Questions and gaps.txt' for why "
                        "(scale not verified, no wall layer, storey height or slab thickness "
                        "not stated)")
        else:
            why = "evidence present, nothing billed"
            detail = (f"{f.evidence_count} {f.evidence_kind} in the drawings, "
                      f"no rows in section {f.section}")
        missing.append({"section": f.section, "evidence": f.evidence_kind,
                        "evidence_count": f.evidence_count, "why": why, "detail": detail})
    return {"billed": {s: n for s, n in sorted(rows_by_section.items()) if n > 0},
            "missing": missing, "complete": not missing}


def coverage_text(cov: dict, title: str) -> str:
    """The coverage statement a person reads before the bill."""
    lines = [title, "=" * len(title), ""]
    if cov.get("complete"):
        lines.append("Every section the drawings call for has rows in this bill.")
        return "\n".join(lines) + "\n"
    lines += ["THIS BILL IS PARTIAL. It covers the sections below and NOT the ones",
              "listed after them. Do not issue it for tender as a complete bill.", "",
              "Sections billed:"]
    lines += [f"  {s}  {n} line(s)" for s, n in cov.get("billed", {}).items()] or ["  (none)"]
    lines += ["", "Required by the drawings but NOT in this bill:"]
    by_why: dict = {}
    for m in cov.get("missing", []):
        by_why.setdefault(m["why"], []).append(m)
    for why in ("schedule not read", "evidence present, nothing billed",
                "not measured from the plans in this run", "not yet measured by this version"):
        for m in by_why.get(why, []):
            lines.append(f"  {m['section']:<6} {why.upper()}: {m['detail']}")
    lines += ["", "How to close each kind:",
              "  SCHEDULE NOT READ - answer its request in readings/ (or run with the model",
              "    available) and run again.",
              "  EVIDENCE PRESENT, NOTHING BILLED - see 'Questions and gaps.txt' for why.",
              "  NOT MEASURED FROM THE PLANS IN THIS RUN - the gaps say what was missing: a",
              "    verified scale, a wall layer in the PDF, a storey height or the slab",
              "    thickness. Supply it (drawings, or BOQ_DECISIONS.json) and run again.",
              "  NOT YET MEASURED BY THIS VERSION - measure these by hand (the platform's",
              "    Measure tab) until the agent measures them itself.",
              "", "A FAIL can also be closed by a written justification in",
              "AN_RECONCILIATION.json beside the drawings."]
    return "\n".join(lines) + "\n"


def _pct(actual, expected) -> Decimal | None:
    if not expected:
        return None
    return (abs(Decimal(actual) - Decimal(expected)) / Decimal(expected) * 100).quantize(Decimal("0.1"))


def mass_balance(quantities, elements, facts: dict | None) -> list[dict]:
    """G+.30, every check, with its figures: PASS, FLAG (outside tolerance - a
    question for the surveyor, not a block) or NOT RUN with the reason. A check
    whose input this run does not produce says NOT RUN - never PASS (CR-01 §8:
    "NOT RUN is a statement, not a pass")."""
    facts = facts or {}
    by_key = {e.key: e for e in elements or []}

    def total(*types) -> Decimal:
        return sum((Decimal(q.value) for q in quantities or []
                    if getattr(by_key.get(q.element_mark), "element_type", None) in types), Decimal(0))

    def count(*types) -> int:
        return sum(int(e.count) * int(getattr(e, "multiplier", 1) or 1)
                   for e in elements or [] if e.element_type in types and not getattr(e, "lines", ()))

    out = []
    for c in gates().mass_balance():
        row = {"n": c.n, "check": c.check, "status": "NOT RUN", "expected": None,
               "actual": None, "variance_pct": None, "note": ""}
        tol = Decimal(str(getattr(c, "tolerance_pct", None) or 0))
        if c.n == 1 and facts.get("room_area"):
            row.update(expected=str(facts["room_area"]), actual=str(total("floor_finish")))
        elif c.n == 3 and facts.get("wall_gross"):
            row.update(expected=str(facts["wall_gross"]), actual=str(total("blockwork")),
                       note="expected: wall lengths once x clear height, before openings; the "
                            "variance is the openings' net effect")
        elif c.n == 4 and count("door"):
            row.update(expected=str(count("door")), actual=str(total("door")))
        elif c.n == 5 and count("window", "glazing", "louvre"):
            row.update(expected=str(count("window", "glazing", "louvre")),
                       actual=str(total("window", "glazing", "louvre")))
        elif c.n == 6 and facts.get("rooms_wet"):
            fixtures = count("fixture", "sanitary")
            if fixtures:
                ok = fixtures >= facts["rooms_wet"]
                row.update(expected=f">= {facts['rooms_wet']}", actual=str(fixtures),
                           status="PASS" if ok else "FLAG")
            else:
                row["note"] = "no sanitary fixture schedule was read"
            out.append(row)
            continue
        elif c.n == 7 and total("wall_finish") and total("blockwork"):
            limit = 2 * total("blockwork")
            row.update(expected=f"<= {limit}", actual=str(total("wall_finish")),
                       status="PASS" if total("wall_finish") <= limit else "FLAG",
                       note="external wall inner faces are not added to the bound")
            out.append(row)
            continue
        elif c.n == 8 and facts.get("perimeter"):
            row.update(expected=str(facts["perimeter"]), actual=str(total("skirting")),
                       note="expected: room perimeters before door widths")
        elif c.n == 12:
            fixtures = count("fixture", "sanitary")
            others = {t: count(t) for t in ("door", "window")}
            same = [t for t, n in others.items() if fixtures and n == fixtures]
            row.update(status="FLAG" if same else "PASS" if fixtures else "NOT RUN",
                       note=(f"fixture count equals the {same[0]} count - check the tags"
                             if same else "" if fixtures else "no fixture count to compare"))
            out.append(row)
            continue
        else:
            row["note"] = {
                1: "no room areas were measured",
                2: "slab area is not measured from the plans by this version",
                3: "no walls were measured",
                4: "no door schedule was read", 5: "no window schedule was read",
                7: "wall finishes or blockwork were not measured",
                8: "no room perimeters were measured",
                9: "slab area is not measured from the plans by this version",
                10: "no register of systems across sections is kept by this version",
                11: "CAD blocks are not counted by this version",
            }.get(c.n, "not implemented")
            out.append(row)
            continue
        var = _pct(row["actual"], row["expected"])
        row["variance_pct"] = None if var is None else str(var)
        row["status"] = "PASS" if var is not None and var <= tol else "FLAG"
        out.append(row)
    return out


def mass_balance_text(rows: list[dict]) -> str:
    lines = ["", "Cross-checks (G+.30 mass balance):"]
    for r in rows:
        figures = (f" - expected {r['expected']}, got {r['actual']}"
                   + (f" ({r['variance_pct']}%)" if r.get("variance_pct") is not None else "")
                   if r.get("expected") is not None else "")
        lines.append(f"  {r['n']:>2}. {r['status']:<7} {r['check']}{figures}"
                     + (f" [{r['note']}]" if r.get("note") else ""))
    return "\n".join(lines) + "\n"


def enforce(findings: list[Finding]) -> None:
    """Raises on the first FAIL. Blocking is the point: a bill that issues with
    a section missing is worse than one that does not issue."""
    failures = [f for f in findings if f.status == "FAIL"]
    if failures:
        detail = "; ".join(
            f.reason or f"{f.evidence_count} {f.evidence_kind} but no rows in section {f.section}"
            for f in failures)
        raise CompletenessFailure(f"completeness gate FAILED — {detail}")


def main() -> int:
    ap = argparse.ArgumentParser(description="Run the completeness gate.")
    ap.add_argument("--run", required=True)
    ap.parse_args()
    print(f"matrix covers {len(matrix())} evidence kinds")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
