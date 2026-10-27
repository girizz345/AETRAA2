#!/usr/bin/env python3
"""
stages_render.py — S20 Render and S21 Revise, the output end of the tail.

Bound by TAIL-CONTRACT.md. Each stage takes ctx, writes into ctx["run"], and
returns the artefact names it actually wrote. Nothing here measures, prices or
paginates: the numbers arrived in takeoff.json and bill.json, and the format is
the ported house builder under render/_house. What this file decides is ORDER
and REFUSAL:

  order    markups first (so every DWG Ref hyperlink has a target to resolve
           to), then takeoff.xlsx, then bill.xlsx with its four gates, then
           provenance.xlsx, then render.json saying what happened.
  refusal  bill.xlsx is withheld when the completeness gate FAILED. A bill that
           issues over a failed gate is the one failure this agent exists to
           prevent; the gap says where the justification goes.

Every user-facing string is passed through render.hygiene BEFORE anything is
written; a violation is a gap, never a rewrite. A gate that does not pass is a
gap on the run, never a crash of the stage — the stage still returns what it
wrote, so state.json shows a bill that exists and is not issuable, which is
different from a bill that does not exist.
"""
from __future__ import annotations

import json
import shutil
from pathlib import Path

from bill import completeness as completeness_mod
from spine.gaps import Gap

HERE = Path(__file__).resolve().parent
RUNS = HERE / "runs"

STAGE_RENDER = "S20"
STAGE_REVISE = "S21"
MARKUP_DIR = "markup"
WITHHELD = ("bill withheld: completeness gate FAILED — justify in "
            "AN_RECONCILIATION.json")
PARTIAL = ("bill issued as PARTIAL: completeness gate FAILED — coverage.txt names "
           "every required section it lacks and why; justify in AN_RECONCILIATION.json "
           "or close the gaps for a complete bill")


# ── helpers ────────────────────────────────────────────────────────────────
def _read_json(path: Path):
    return json.loads(path.read_text()) if path.is_file() else None


def _write_json(path: Path, payload) -> None:
    path.write_text(json.dumps(payload, indent=1, sort_keys=True, default=str))


def _artefact(ctx, key: str, filename: str):
    """The in-memory artefact when the producing stage ran in this process,
    else the file it wrote. Prefer memory: it is what the stage actually
    handed on; the file is what it said it handed on."""
    if ctx.get(key) is not None:
        return ctx[key]
    return _read_json(Path(ctx["run"]) / filename)


def user_facing_strings(takeoff=None, bill=None, markup_spec=None) -> list[tuple[str, str]]:
    """(subject, text) for every string a reader of the three artefact sets
    will see: descriptions, headings, legend labels, audit cells."""
    out: list[tuple[str, str]] = []
    if takeoff:
        for s in takeoff.get("sections", []):
            out.append((f"section {s.get('letter')} name", s.get("name")))
            for it in s.get("items", []):
                out.append((f"{it.get('code')} description", it.get("description")))
                for ln in it.get("lines", []):
                    out.append((f"{it.get('code')} line", ln.get("desc") or ln.get("memo")))
        for tab, rows in (takeoff.get("audit") or {}).items():
            for row in rows or []:
                for cell in row:
                    out.append((f"audit {tab}", cell))
    if bill:
        for s in bill.get("sections", []):
            out.append((f"section {s.get('letter')} title", s.get("title")))
            for ln in s.get("lines", []):
                out.append((f"{ln.get('ref')} description", ln.get("description")))
        for nm in bill.get("nonmeasured", []) or []:
            out.append((f"nonmeasured {nm.get('clause_ref')}", nm.get("text")))
        for L, spec in (bill.get("house_specs") or {}).items():
            out.append((f"section {L} title", spec.get("section_title")))
            for blk in spec.get("measurement", []) or []:
                out.append((f"section {L} measurement", blk.get("text") or blk.get("description")))
            for page in spec.get("boq_pages", []) or []:
                for e in page.get("entries", []):
                    if e.get("kind") == "heading":
                        out.append((f"section {L} heading", e.get("text")))
                    elif e.get("kind") == "item_group":
                        desc = e.get("description")
                        for d in (desc if isinstance(desc, list) else [desc]):
                            out.append((f"section {L} description", d))
                        for it in e.get("items", []):
                            out.append((f"{it.get('item_key')} variant", it.get("variant")))
                    else:
                        out.append((f"{e.get('item_key')} description", e.get("description")))
    if markup_spec:
        for L, sec in markup_spec.items():
            out.append((f"markup {L} title", sec.get("section_title")))
            out.append((f"markup {L} group", sec.get("group")))
            for sh in sec.get("sheets", []):
                for it in sh.get("items", []):
                    out.append((f"markup {L} legend", it.get("label")))
    return [(s, t) for s, t in out if isinstance(t, str) and t.strip()]


def hygiene_gaps(strings: list[tuple[str, str]], stage: str = STAGE_RENDER) -> list[Gap]:
    """One gap per distinct offending text. Never rewrites."""
    from render.hygiene import violations
    gaps, seen = [], set()
    for subject, text in strings:
        found = violations(text)
        if not found or text in seen:
            continue
        seen.add(text)
        gaps.append(Gap(stage=stage, doc_id=None, subject=subject,
                        reason="output hygiene: " + "; ".join(found),
                        detail=text[:200]))
    return gaps


def _completeness_blocked(ctx) -> bool:
    if "completeness_blocked" in ctx:
        return bool(ctx["completeness_blocked"])
    completeness = _read_json(Path(ctx["run"]) / "completeness.json")
    return bool(completeness and completeness.get("blocked"))


# ── S20 ────────────────────────────────────────────────────────────────────
def _stage_render(ctx) -> list[str]:
    from render import boq_workbook, markup_pdf, provenance, takeoff_workbook

    run = Path(ctx["run"])
    gaps = ctx["gaps"]
    written: list[str] = []
    gates: dict = {}
    recalculated = False

    takeoff = _artefact(ctx, "takeoff", "takeoff.json")
    bill = _artefact(ctx, "bill", "bill.json")
    markup_spec = _artefact(ctx, "markup_spec", "markup_spec.json")

    # A re-run over the same drawings lands in the same run folder. Whatever
    # the LAST run rendered is cleared first, so a bill withheld this time is
    # not shipped from last time — observed: a stale bill.xlsx zipped and
    # issued for a run whose completeness gate had just FAILED.
    for stale in ("takeoff.xlsx", "bill.xlsx", "bill_unpriced.xlsx",
                  "provenance.xlsx", "render.json", "coverage.txt"):
        try:
            (run / stale).unlink()
        except FileNotFoundError:
            pass
    shutil.rmtree(run / MARKUP_DIR, ignore_errors=True)
    shutil.rmtree(run / "deliverable", ignore_errors=True)
    for old_zip in run.glob("*.zip"):
        old_zip.unlink()

    if takeoff is None:
        raise RuntimeError("takeoff.json not present — S13 did not produce a take-off")

    # hygiene first: nothing is written until every string has been checked
    for gap in hygiene_gaps(user_facing_strings(takeoff, bill, markup_spec)):
        gaps.add(gap)

    # 1. markups — before the workbooks, so DWG Ref links resolve
    if markup_spec is None:
        gaps.add(Gap(stage=STAGE_RENDER, doc_id=None, subject="markups",
                     reason="markup_spec.json not present — no marked-up drawings; "
                            "DWG Ref links will not resolve"))
    else:
        result = markup_pdf.render(markup_spec, ctx.get("project"), run / MARKUP_DIR)
        gates["markups"] = {k: result[k] for k in ("sheets", "items", "derotated")}
        for p in result["problems"]:
            gaps.add(Gap(stage=STAGE_RENDER, doc_id=None, subject="markup", reason=p))
        written.extend(f"{MARKUP_DIR}/{n}" for n in result["written"])
        written.append(f"{MARKUP_DIR}/{result['legend']}")

    # 2. takeoff.xlsx — INDEX + one tab per section. The AN audit tabs stay in
    # audit.json (the working record); the issued take-off does not carry them.
    try:
        gates["takeoff"] = takeoff_workbook.write(takeoff, run / "takeoff.xlsx",
                                                  audit_tabs=False)
        written.append("takeoff.xlsx")
    except ValueError as exc:
        gaps.add(Gap(stage=STAGE_RENDER, doc_id=None, subject="takeoff.xlsx",
                     reason=f"not written — {exc}"))

    # 3. the bill, in two states — priced (bill.xlsx) and unpriced
    # (bill_unpriced.xlsx). Over a completeness gate that FAILED it is issued
    # as PARTIAL, with coverage.txt naming every required section it lacks and
    # why (CR-01 §7): withholding everything left a surveyor an empty folder,
    # and a bill honest about its coverage is one they can use. The FAIL
    # itself is not narrowed - it stays in completeness.json and the gaps.
    blocked = _completeness_blocked(ctx)
    completeness = ctx.get("completeness") or _read_json(run / "completeness.json") or {}
    title = "COVERAGE - READ THIS BEFORE THE BILL"
    (run / "coverage.txt").write_text(
        completeness_mod.coverage_text(completeness.get("coverage") or {"complete": not blocked},
                                       title)
        + completeness_mod.mass_balance_text(completeness.get("mass_balance") or []),
        encoding="utf-8")
    written.append("coverage.txt")
    if bill is None:
        gaps.add(Gap(stage=STAGE_RENDER, doc_id=None, subject="bill.xlsx",
                     reason="bill.json not present — S19 did not assemble a bill"))
    else:
        if blocked:
            gaps.add(Gap(stage=STAGE_RENDER, doc_id=None, subject="bill.xlsx", reason=PARTIAL))
            gates["bill"] = "partial"
        for filename, key, priced in (("bill.xlsx", "bill", True),
                                      ("bill_unpriced.xlsx", "bill_unpriced", False)):
            try:
                result = boq_workbook.write(bill, run / filename, MARKUP_DIR,
                                            recalc=not ctx.get("no_recalc", False),
                                            priced=priced)
            except (ValueError, KeyError) as exc:
                gaps.add(Gap(stage=STAGE_RENDER, doc_id=None, subject=filename,
                             reason=f"not written — {exc}"))
            else:
                written.append(filename)
                recalculated = result["recalculated"] if priced else recalculated
                gates[key] = {"sheets": result["sheets"], "pages": result["pages"],
                              "gates": result["gates"], "partial": blocked}
                for p in result["problems"]:
                    gaps.add(Gap(stage=STAGE_RENDER, doc_id=None, subject=f"{filename} gate",
                                 reason=p[:600]))

    # 4. provenance.xlsx — from the artefacts, never from the workbook
    problems: list[str] = []
    rows = provenance.build(run, problems)
    provenance.write(rows, run / "provenance.xlsx")
    written.append("provenance.xlsx")
    gates["provenance"] = {"rows": len(rows), "untraced": len(problems)}
    for p in problems:
        gaps.add(Gap(stage=STAGE_RENDER, doc_id=None, subject="provenance", reason=p))

    _write_json(run / "render.json", {"written": sorted(written), "gates": gates,
                                      "recalculated": recalculated, "blocked": blocked,
                                      "partial": blocked})
    written.append("render.json")
    return written


# ── S21 ────────────────────────────────────────────────────────────────────
def find_previous_run(current: Path, project: str, roots: list[Path]) -> Path | None:
    """The most recent OTHER run of the same project that assembled a bill.
    Recency is the run's own summary timestamp, falling back to mtime."""
    candidates = []
    for root in roots:
        if not root or not Path(root).is_dir():
            continue
        for d in sorted(Path(root).iterdir()):
            if not d.is_dir() or d.resolve() == Path(current).resolve():
                continue
            summary = _read_json(d / "summary.json")
            if not summary or str(summary.get("project")) != str(project):
                continue
            if not (d / "bill.json").is_file():
                continue
            candidates.append((summary.get("utc") or "", (d / "bill.json").stat().st_mtime, d))
    if not candidates:
        return None
    return max(candidates)[2]


def _stage_revise(ctx) -> list[str]:
    from render import provenance, revise

    run = Path(ctx["run"])
    gaps = ctx["gaps"]
    bill = _artefact(ctx, "bill", "bill.json")
    if bill is None:
        raise RuntimeError("bill.json not present — nothing to revise against")

    previous = find_previous_run(run, str(ctx["project"]), [RUNS, run.parent])
    current_lines = revise.flatten(bill)
    if previous is None:
        changes = revise.diff([], current_lines)
        note = revise.FIRST_ISSUE_NOTE
    else:
        prev_bill = _read_json(previous / "bill.json") or {}
        prev_state = _read_json(previous / "state.json") or {}
        failed = [s for s, v in (prev_state.get("stages") or {}).items()
                  if isinstance(v, dict) and v.get("exit") not in (0, None)]
        if failed:
            gaps.add(Gap(stage=STAGE_REVISE, doc_id=None, subject="previous revision",
                         reason=f"previous run {previous.name} did not pass every stage "
                                f"({', '.join(sorted(failed))}); the comparison below "
                                f"rests on an issue that did not close its gates"))
        changes = revise.diff(revise.flatten(prev_bill), current_lines)
        note = f"Compared against revision {previous.name}"

    basis = {r.bill_ref: ", ".join(r.drawings) for r in provenance.build(run)}
    payload = {"previous_run": None if previous is None else previous.name,
               "first_issue": previous is None, "note": note,
               "summary": revise.summary(changes), "changes": revise.to_json(changes)}
    _write_json(run / "revision_changes.json", payload)
    # The comparison is kept in the working record only. The issued bill does
    # not carry a REVISION CHANGES sheet — the workbook stays Summary + sections.
    return ["revision_changes.json"]
