#!/usr/bin/env python3
"""
The model residue of stage 11, exercised without a network: a fake ModelClient
answers with labels, and every guard between the answer and a Classification is
shown to hold. The three things that matter:

  * a label-only answer that cites the element's own evidence is accepted, and
    passes the same validate() the stated path uses
  * a number anywhere in the reply halts (ModelSuppliedNumber), at any depth
  * an invented clause, a wrong arity, a neighbour's evidence, an unreachable
    model — each leaves the element UNCLASSIFIED with a reason, never a default
"""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import pytest                                                  # noqa: E402

from ingest.clause_table import ClauseTable                    # noqa: E402
from measure.classify import classify, offered_clauses         # noqa: E402
from measure.evidence import EvidenceBase                      # noqa: E402
from model import schema                                       # noqa: E402
from model.client import ModelUnavailable, Request, Response  # noqa: E402
from spine.errors import ModelSuppliedNumber                   # noqa: E402
from spine.records import Element, Origin                      # noqa: E402

TABLE = ClauseTable.load(ROOT / "data" / "clauses.json")


def _base_and_elements():
    base = EvidenceBase()
    elements = []
    for mark in ("GL-01", "GL-02"):
        base.make(f"glazing:{mark}:count", 3, "nr", "A-601.pdf", None,
                  Origin.STATED, role="count")
        elements.append(Element(mark=mark, element_type="glazing",
                                dims={"count": f"glazing:{mark}:count"},
                                count=3, sheets=("A-601.pdf",),
                                evidence_ids=(f"glazing:{mark}:count",),
                                multiplier=1))
    return base, elements


def _count_clause():
    return next(c.id for c in TABLE.computable() if c.shape == "count")


class _Fake:
    """Answers through the SAME gate the real client uses: schema.validate."""

    def __init__(self, reply):
        self.reply = reply
        self.calls = 0

    def ask(self, request: Request) -> Response:
        self.calls += 1
        payload = self.reply if isinstance(self.reply, dict) \
            else {"items": self.reply}
        schema.validate(request.judgement, payload)
        return Response(request.judgement, payload, "fake")


def test_a_label_only_answer_is_accepted_and_validated():
    base, elements = _base_and_elements()
    clause = _count_clause()
    fake = _Fake([{"element_mark": "GL-01", "clause_id": clause,
                   "bindings": {"count": "glazing:GL-01:count"}},
                  {"element_mark": "GL-02", "clause_id": clause,
                   "bindings": {"count": "glazing:GL-02:count"}}])
    done, left, reasons = classify(elements, TABLE, base, fake)
    assert fake.calls == 1                       # one call for the family
    assert [c.element_mark for c in done] == ["GL-01", "GL-02"]
    assert left == [] and reasons == {}


def test_a_number_anywhere_in_the_reply_halts():
    base, elements = _base_and_elements()
    fake = _Fake([{"element_mark": "GL-01", "clause_id": _count_clause(),
                   "bindings": {"count": "glazing:GL-01:count"},
                   "quantity": 3}])
    with pytest.raises(ModelSuppliedNumber):
        classify(elements, TABLE, base, fake)
    nested = _Fake([{"element_mark": "GL-01", "clause_id": _count_clause(),
                     "bindings": {"count": "glazing:GL-01:count",
                                  "area": "12.5"}}])
    with pytest.raises(ModelSuppliedNumber):
        classify(elements, TABLE, base, nested)


def test_an_invented_clause_is_refused_with_a_reason():
    base, elements = _base_and_elements()
    fake = _Fake([{"element_mark": "GL-01", "clause_id": "Z9.9",
                   "bindings": {"count": "glazing:GL-01:count"}}])
    done, left, reasons = classify(elements, TABLE, base, fake)
    assert done == [] and {e.mark for e in left} == {"GL-01", "GL-02"}
    assert "invented clause" in reasons["GL-01"]
    assert "no answer" in reasons["GL-02"]


def test_a_neighbours_evidence_is_refused():
    base, elements = _base_and_elements()
    fake = _Fake([{"element_mark": "GL-01", "clause_id": _count_clause(),
                   "bindings": {"count": "glazing:GL-02:count"}}])
    done, left, reasons = classify(elements, TABLE, base, fake)
    assert done == []
    assert "another element" in reasons["GL-01"]


def test_a_null_clause_is_a_gap_not_a_default():
    base, elements = _base_and_elements()
    fake = _Fake([{"element_mark": "GL-01", "clause_id": None,
                   "bindings": {}}])
    done, left, reasons = classify(elements, TABLE, base, fake)
    assert done == [] and "no listed clause" in reasons["GL-01"]


def test_an_unreachable_model_leaves_the_batch_unclassified():
    base, elements = _base_and_elements()

    class _Down:
        def ask(self, request):
            raise ModelUnavailable("breaker open")

    done, left, reasons = classify(elements, TABLE, base, _Down())
    assert done == [] and len(left) == 2
    assert all("model unavailable" in r for r in reasons.values())


def test_every_computable_clause_is_offered_not_only_the_fillable_ones():
    offered = offered_clauses(TABLE)
    assert {c.shape for c in offered} >= {"count", "l_x_w", "sum_area"}
    assert len(offered) == len(TABLE.computable())


def test_a_precast_clause_is_refused_for_an_element_the_schedule_does_not_call_precast():
    """82 in-situ beams went under a precast enumerated clause on a real
    package. The schedule's words decide the form; the count being the only
    evidenced role does not."""
    base, elements = _base_and_elements()
    precast = next((c.id for c in TABLE.computable()
                    if c.shape == "count" and "precast" in c.title.lower()), None)
    assert precast, "the clause table carries a precast enumerated clause"
    fake = _Fake([{"element_mark": "GL-01", "clause_id": precast,
                   "bindings": {"count": "glazing:GL-01:count"}}])
    words = {"A-601.pdf": "BEAM SCHEDULE — BAR MARKS AND LINKS"}
    done, left, reasons = classify(elements, TABLE, base, fake, sheet_words=words)
    assert done == [] and "does not say precast" in reasons["GL-01"]
    # the same answer is accepted when the schedule says so
    fake2 = _Fake([{"element_mark": "GL-01", "clause_id": precast,
                    "bindings": {"count": "glazing:GL-01:count"}}])
    done, left, reasons = classify(elements, TABLE, base, fake2,
                                   sheet_words={"A-601.pdf": "PRECAST BEAM SCHEDULE"})
    assert [c.element_mark for c in done] == ["GL-01"]


def test_a_governing_clause_the_evidence_cannot_fill_is_an_honest_gap():
    """Ten finishes with a count and no area must NOT become a count item:
    the model names the governing area clause, and the gap says what the
    package still has to supply."""
    base, elements = _base_and_elements()
    area_clause = next(c.id for c in TABLE.computable() if c.shape == "sum_area")
    fake = _Fake([{"element_mark": "GL-01", "clause_id": area_clause,
                   "bindings": {}}])
    done, left, reasons = classify(elements, TABLE, base, fake)
    assert done == []
    assert reasons["GL-01"].startswith(f"governing clause {area_clause} needs area")
    assert "evidenced: count" in reasons["GL-01"]


def test_the_schema_accepts_a_ref_keyed_reply():
    payload = {"items": [{"ref": "GL-01", "clause_id": "H1.1",
                          "bindings": {"count": "x"}}]}
    out = schema.validate("classification", payload)
    assert out["items"][0]["element_mark"] == "GL-01"
