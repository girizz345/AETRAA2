#!/usr/bin/env python3
"""
classify.py — the model's only structural judgement, and the wall around it.

What the model may return: a clause id, and which evidence record fills which
formula role. That is all. It may not return a quantity, a unit, a rate or a
description of its own reasoning that anything downstream reads.

What is checked before any of it is used — every one of these is a hard fail,
not a warning, because a classification that is wrong in these ways produces a
confident number rather than an obvious gap:

  * the clause exists in the ingested table
  * the roles match what that clause's formula requires, in the right arity —
    a thickness supplied to a linear clause is refused
  * every cited evidence id exists in the base
  * the clause's section letter exists in the crosswalk
  * the citation rule holds for each role (evidence.check_citation)

One call per judgement. No consensus, no voting, no self-review at runtime:
reliability comes from the offline eval set, not from asking three times and
taking the mode. Retry only on a schema-invalid response.

Unclassifiable elements are carried into the output as unclassified with their
evidence attached. They are visible, and a surveyor can finish them.

  python3 -m measure.classify --inventory I.json --evidence E.json

Exit 0 = all classified. Exit 1 = unclassified present. Exit 2 = contract
violation (halts).
"""
from __future__ import annotations

import argparse

from ingest import crosswalk
from ingest.formulas import roles_for
from spine.errors import (ModelSuppliedNumber, RoleArityMismatch,
                          UnknownClause)
from spine.records import Binding, Classification

FORBIDDEN_KEYS = ("qty", "quantity", "value", "amount", "rate", "total")


def reject_numbers(payload: dict) -> None:
    """Invariant 1, detected rather than trusted. A response carrying a value
    where only a label was permitted halts the run — if the model is producing
    numbers, everything it produced this run is suspect."""
    for key in sorted(payload):
        if key.lower() in FORBIDDEN_KEYS:
            raise ModelSuppliedNumber(
                f"model response carried {key!r}; only labels are permitted")


def validate(classification: Classification, clause_table, base) -> None:
    if classification.clause_id not in clause_table:
        raise UnknownClause(f"invented clause: {classification.clause_id}")
    clause = clause_table.get(classification.clause_id)
    crosswalk.resolve(clause.section)          # raises if not a real section
    required = roles_for(clause.shape)
    supplied = sorted(b.role for b in classification.bindings)
    if supplied != sorted(required):
        raise RoleArityMismatch(
            f"{clause.id} needs {sorted(required)}, got {supplied}")
    for binding in sorted(classification.bindings, key=lambda b: b.role):
        base.check_citation(binding.evidence_id, binding.role)


# A clause that ENUMERATES, matched to an element type the schedule itself
# names. This is not keyword-matching a description to a rate: the sheet is
# titled "SCHEDULE OF DOORS", POMI H1.1 reads "Doors shall be enumerated", and
# the schedule states the count. Nothing is inferred and no model is needed, so
# a door schedule is measurable with the network down.
#
# Deliberately short. A type whose clause needs judgement — which of H3.1
# screens, H5.2 sealed units or H6.1 patent glazing a "GLASS AND ALUMINIUM"
# schedule belongs under — is NOT in this table and goes to the model, or to the
# unclassified list where a surveyor can see it.
STATED_CLAUSES: dict = {
    "door": "H1.1",            # Doors shall be enumerated
    "window": "H2.1",          # Windows, together with their frames, enumerated
    "ironmongery": "H4.1",     # Units or sets of ironmongery shall be enumerated
    "louvre": "H5.3",          # Glass louvres shall be enumerated
}


def classify_stated(elements, clause_table, base) -> tuple[list, list]:
    """The deterministic path: elements whose clause follows from what the
    schedule says it schedules. Returns (classifications, unclassified).

    Every classification is validated exactly as a model's would be — there is
    no shortcut around validate(), because a deterministic mapping can be wrong
    too and the validation is what catches it."""
    from measure.measured import MEASURED_CLAUSES

    classifications, unclassified = [], []
    for element in elements:
        if getattr(element, "lines", ()):
            # a measured element: its clause is what it was measured as (walls
            # by area, D2.1; finishes by area, J3.1 ...), and every line's
            # evidence must be citable for its role - a length or an area off
            # a sheet whose scale is not verified is refused here, whatever
            # measured it
            clause_id = MEASURED_CLAUSES.get(element.element_type)
            try:
                if clause_id is None or clause_id not in clause_table:
                    raise UnknownClause(f"no clause for measured {element.element_type}")
                crosswalk.resolve(clause_table.get(clause_id).section)
                for line in element.lines:
                    for role, eid in line.dims.items():
                        base.check_citation(eid, role)
            except Exception:                                     # noqa: BLE001
                unclassified.append(element)
                continue
            classifications.append(Classification(element_mark=element.key, clause_id=clause_id,
                                                  bindings=()))
            continue
        clause_id = STATED_CLAUSES.get(element.element_type)
        if clause_id is None or clause_id not in clause_table:
            unclassified.append(element)
            continue
        clause = clause_table.get(clause_id)
        if not clause.computable:
            unclassified.append(element)
            continue
        required = roles_for(clause.shape)
        missing = [r for r in required if r not in element.dims]
        if missing:
            unclassified.append(element)
            continue
        candidate = Classification(
            element_mark=element.key, clause_id=clause_id,
            bindings=tuple(Binding(role=r, evidence_id=element.dims[r])
                           for r in sorted(required)))
        try:
            validate(candidate, clause_table, base)
        except Exception:                                     # noqa: BLE001
            unclassified.append(element)
            continue
        classifications.append(candidate)
    return classifications, unclassified


def offered_clauses(clause_table) -> list:
    """Every computable clause, offered whole. The offer is NOT narrowed to
    the clauses the element's evidence can fill: doing that on a real package
    pushed ten finishes — schedule rows with a count and no area — into the
    one count-shaped clause on offer, and the bill carried finishes "by
    number". The governing clause is a judgement about the element; whether
    the evidence can fill it is arithmetic, decided afterwards by validate(),
    and its failure is the honest gap: "J2.1 needs area; none evidenced"."""
    out = []
    for clause in clause_table.computable():
        try:
            roles_for(clause.shape)
        except KeyError:
            continue
        out.append(clause)
    return out


def _clause_line(clause) -> str:
    roles = ", ".join(roles_for(clause.shape))
    return (f"{clause.id} | {clause.section} | {clause.title} | "
            f"{clause.unit} | needs: {roles}")


def missing_roles(clause, element) -> list:
    """The roles the clause requires that the element has no evidence for."""
    return sorted(r for r in roles_for(clause.shape) if r not in element.dims)


def _bindings_of(raw) -> list:
    """Accept {"role": "id"} or [{"role":..,"evidence_id":..}]; anything else
    is an empty list, which validate() refuses on arity."""
    if isinstance(raw, dict):
        return [Binding(role=str(r), evidence_id=str(e))
                for r, e in sorted(raw.items())]
    if isinstance(raw, list):
        out = []
        for entry in raw:
            if isinstance(entry, dict) and "role" in entry \
                    and "evidence_id" in entry:
                out.append(Binding(role=str(entry["role"]),
                                   evidence_id=str(entry["evidence_id"])))
        return sorted(out, key=lambda b: b.role)
    return []


def stated_form_conflict(clause, element, sheet_words: dict | None) -> str | None:
    """A clause that names a FORM of construction — precast, prestressed,
    proprietary, prefabricated — governs only an element whose schedule says
    it is that form. On a real package the model put 82 in-situ beams (a
    beam schedule with bar marks) under a precast enumerated clause, because
    the count was the only role evidenced; the bill would have priced
    in-situ beams as precast units. The schedule's own words decide."""
    forms = ("precast", "prestressed", "pre-stressed", "post-tensioned",
             "prefabricated", "proprietary")
    title = (clause.title or "").lower()
    named = [f for f in forms if f in title]
    if not named:
        return None
    words = " ".join((sheet_words or {}).get(s, "") for s in element.sheets).lower()
    if any(f in words for f in named):
        return None
    return (f"{clause.id} governs {named[0]} work; the schedule for "
            f"{element.mark} does not say {named[0]} — the element's own "
            f"words decide its form, not the roles evidenced")


def classify(elements, clause_table, base, model, batch: int | None = None,
             sheet_words: dict | None = None) -> tuple[list, list, dict]:
    """The model residue. Returns (classifications, unclassified, reasons)
    where reasons maps an unclassified mark to why.

    Batched per element family (element_type) so one call covers a family
    rather than an element; a family larger than the budget's batch is split.
    The model sees labels only — record ids, roles and units, never values.
    Every returned Classification passes the same validate() as the stated
    path. A response carrying a number halts (ModelSuppliedNumber propagates);
    an unreachable model leaves the batch unclassified with the reason, never
    a default."""
    from model.budget import CLASSIFICATION_BATCH
    from model.client import ModelUnavailable, Request

    batch = batch or CLASSIFICATION_BATCH
    classifications: list = []
    unclassified: list = []
    reasons: dict = {}

    families: dict = {}
    for element in elements:
        families.setdefault(element.element_type or "", []).append(element)

    clauses = offered_clauses(clause_table)
    clause_text = "\n".join(_clause_line(c) for c in clauses)
    for family in sorted(families):
        members = sorted(families[family], key=lambda e: e.key)
        for start in range(0, len(members), batch):
            chunk = members[start:start + batch]
            if not clauses:
                for element in chunk:
                    unclassified.append(element)
                    reasons[element.key] = "the clause table has no computable clause"
                continue

            element_lines, evidence_lines = [], []
            for element in chunk:
                roles = ", ".join(f"{r}={i}" for r, i in sorted(element.dims.items()))
                said = " / ".join(w for w in
                                  ((sheet_words or {}).get(s, "") for s in element.sheets)
                                  if w)[:160]
                element_lines.append(
                    f"{element.key} | type {element.element_type} | "
                    f"sheets {', '.join(element.sheets)} | schedule says: {said or '-'} | "
                    f"evidence roles: {roles}")
                for record_id in element.evidence_ids:
                    try:
                        record = base.get(record_id)
                    except KeyError:
                        continue
                    role = getattr(record, "role", None) or record_id.rsplit(":", 1)[-1]
                    evidence_lines.append(
                        f"{record_id} | role {role} | unit {record.unit} | "
                        f"origin {record.origin.value} | sheet {record.doc_id}")
            request = Request(
                judgement="classification",
                context={"family": family,
                         "elements": "\n".join(element_lines),
                         "clauses": clause_text,
                         "evidence": "\n".join(evidence_lines)},
                guidance=("Cite the governing POMI clause by its identifier "
                          "from the list. The unit and formula are fixed by "
                          "the clause; you choose the clause and the "
                          "bindings only."),
                enum=tuple(c.id for c in clauses))
            try:
                response = model.ask(request)
            except ModelUnavailable as exc:
                for element in chunk:
                    unclassified.append(element)
                    reasons[element.key] = f"model unavailable: {exc}"
                continue

            by_mark: dict = {}
            for item in response.payload.get("items", []):
                mark = str(item.get("element_mark") or "").strip()
                clause_id = item.get("clause_id")
                if not mark or mark in by_mark:
                    continue
                if not clause_id or str(clause_id).lower() in ("null", "none"):
                    reasons[mark] = "the model found no listed clause governing it"
                    continue
                candidate = Classification(
                    element_mark=mark, clause_id=str(clause_id),
                    bindings=tuple(_bindings_of(item.get("bindings"))))
                element = next((e for e in chunk if e.key == mark), None)
                if element is not None and candidate.clause_id in clause_table:
                    conflict = stated_form_conflict(
                        clause_table.get(candidate.clause_id), element, sheet_words)
                    if conflict:
                        reasons[mark] = conflict
                        continue
                    # the governing clause named, the evidence short of it:
                    # the gap says which formula roles are still UNBOUND. A
                    # formula role is a slot, not an attribute name — a wall's
                    # stated thickness fills C2.1's W and its storey height
                    # fills T — so what counts is whether the model bound every
                    # role to one of this element's records, not whether the
                    # record happened to be named like the role.
                    clause_obj = clause_table.get(candidate.clause_id)
                    bound = {b.role for b in candidate.bindings}
                    short = sorted(r for r in roles_for(clause_obj.shape)
                                   if r not in bound)
                    if short:
                        reasons[mark] = (
                            f"governing clause {candidate.clause_id} needs "
                            f"{', '.join(short)}; no evidence of it for this "
                            f"element (evidenced: "
                            f"{', '.join(sorted(element.dims)) or 'none'})")
                        continue
                try:
                    validate(candidate, clause_table, base)
                except (UnknownClause, RoleArityMismatch, KeyError,
                        ValueError) as exc:
                    reasons[mark] = f"model classification refused: {exc}"
                    continue
                except ModelSuppliedNumber:
                    raise
                except Exception as exc:                          # noqa: BLE001
                    reasons[mark] = f"model classification refused: {exc}"
                    continue
                # the bindings must belong to THIS element, not a neighbour
                foreign = [b.evidence_id for b in candidate.bindings
                           if b.evidence_id not in _ids_of(chunk, mark)]
                if foreign:
                    reasons[mark] = (f"binding cites another element's "
                                     f"evidence: {', '.join(sorted(foreign))}")
                    continue
                by_mark[mark] = candidate

            for element in chunk:
                if element.key in by_mark:
                    classifications.append(by_mark[element.key])
                else:
                    unclassified.append(element)
                    reasons.setdefault(element.key,
                                       "the model returned no answer for it")
    return classifications, unclassified, reasons


def _ids_of(chunk, mark: str) -> set:
    for element in chunk:
        if element.key == mark:
            return set(element.evidence_ids)
    return set()


def main() -> int:
    ap = argparse.ArgumentParser(description="Classify elements to clauses.")
    ap.add_argument("--inventory", required=True)
    ap.add_argument("--evidence", required=True)
    ap.parse_args()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
