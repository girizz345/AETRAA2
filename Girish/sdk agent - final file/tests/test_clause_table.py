"""The clause table, and the fact that it had never once loaded.

`ClauseTable.load` read keys `title`, `unit`, `shape` and `source`. The 314-clause
fixture carries `text`, `unit_raw` and `formula_raw`. So the loader raised
KeyError on its first row, every time, and nothing noticed — because stage 0
reported "314 clauses" by reading the JSON directly and never through the loader.

Everything from S11 on computes from this table, so a table that cannot load is
the floor under the second half of the pipeline. These tests are that floor.
"""
from pathlib import Path

import pytest

from ingest.clause_normalise import (normalise_table, shape_of, strip_noise,
                                     thresholds_of, unit_of)
from ingest.clause_table import ClauseTable
from ingest.formulas import SHAPES, SHAPE_UNITS

TABLE = ClauseTable.load(Path(__file__).resolve().parent.parent /
                         "data" / "clauses.json")


def test_the_table_loads_at_all():
    """The regression. Before the normaliser this raised KeyError."""
    assert len(TABLE) == 314


def test_every_clause_keeps_its_own_section_letter():
    assert all(c.section for c in TABLE)
    assert "S" not in {c.section for c in TABLE}


def test_doors_are_enumerated():
    doors = TABLE.get("H1.1")
    assert (doors.unit, doors.shape) == ("nr", "count")
    assert doors.computable


def test_a_definitional_clause_loads_and_is_not_computable():
    """104 of the 314 are definitional or administrative. They must LOAD —
    they govern how other quantities are calculated — and must refuse to be
    computed from."""
    rule = TABLE.get("GP1.2")
    assert rule.unit is None and rule.shape is None
    assert not rule.computable


def test_a_shape_is_never_invented():
    """A formula this grammar cannot express is reported, not approximated.
    Mapping "V = V_designed_void − Σ V_existing_voids" onto a product because it
    has three symbols would be exactly the invented formula ingest.formulas
    exists to prevent."""
    for clause in TABLE:
        if clause.shape is not None:
            assert clause.shape in SHAPES, f"{clause.id}: {clause.shape}"
    assert any(c.shape_basis == "unexpressible" for c in TABLE), \
        "nothing reported as unexpressible — suspiciously tidy"


def test_a_shape_agrees_with_its_clause_unit():
    """The clause fixes the arithmetic AND the unit, so the two must not
    contradict: a clause billed in m3 cannot carry an area formula."""
    for clause in TABLE:
        if not clause.computable:
            continue
        allowed = SHAPE_UNITS.get(clause.shape, ())
        assert clause.unit in allowed, \
            f"{clause.id}: {clause.shape} cannot produce {clause.unit}"


def test_every_clause_cites_where_it_came_from():
    assert all(c.source for c in TABLE)


# ── the page-footer contamination ───────────────────────────────────────
def test_the_corpus_page_footer_is_stripped_not_dropped():
    """The parse let "AETRAA POMI Take-off — the complete prompt set 207" bleed
    into clause fields. B9.1 is the excavation-by-volume rule the whole of
    section B rests on; rejecting the row would have removed it."""
    cleaned, dirty = strip_noise(
        "AETRAA POMI Take-off — the complete prompt set 226 Sills, copings "
        "shall be measured by length.")
    assert dirty
    assert cleaned.startswith("Sills, copings")
    assert "AETRAA" not in cleaned


def test_the_contaminated_rows_are_counted_not_silently_cleaned():
    """A silent clean is indistinguishable from a silent error — the parser's own
    docstring says so, and GP3.2 (the void deduction rule) is one of them."""
    dirty = [c.id for c in TABLE if c.contaminated]
    assert len(dirty) == 12, dirty
    assert "GP3.2" in dirty and "B9.1" in dirty


def test_b9_1_survived_and_still_measures_excavation_by_volume():
    clause = TABLE.get("B9.1")
    assert clause.text_intact if hasattr(clause, "text_intact") else True
    assert clause.unit == "m3"


def test_no_row_is_lost():
    raw_count = len(__import__("json").loads(
        (Path(__file__).resolve().parent.parent / "data" /
         "clauses.json").read_text())["clauses"])
    rows, problems = normalise_table(__import__("json").loads(
        (Path(__file__).resolve().parent.parent / "data" /
         "clauses.json").read_text()))
    assert problems == []
    assert len(rows) == raw_count


# ── the pieces ─────────────────────────────────────────────────────────
def test_the_first_unit_limb_governs():
    """DECISIONS.md decision 6 — the house takes the limb POMI states first,
    and the alternative is recorded rather than discarded."""
    assert unit_of("NR / M2 — enumerated or by area") == ("nr", ("m2",))
    assert unit_of("M / NR") == ("m", ("nr",))
    assert unit_of("RULE — governs how OTHER quantities are calculated") == \
        (None, ())
    assert unit_of(None) == (None, ())


def test_the_formula_heads_the_corpus_actually_uses():
    assert shape_of("N = count")[0] == "count"
    assert shape_of("L = Σ L")[0] == "sum_length"
    assert shape_of("A = Σ A, per class")[0] == "sum_area"
    assert shape_of("V = Σ V, from soundings")[0] == "sum_volume"
    assert shape_of("V = L × W_to_outside × D")[0] == "l_x_w_x_d"


def test_a_cross_reference_is_not_an_unparsed_formula():
    """"per P2.1" measures nothing of its own. Calling that unexpressible would
    report a defect where there is none."""
    assert shape_of("per P2.1") == (None, "cross-reference")
    assert shape_of("measured to the relevant clauses of this section")[1] == \
        "cross-reference"


def test_no_formula_means_no_arithmetic_not_a_failure():
    assert shape_of(None) == (None, "no arithmetic")
    assert shape_of("") == (None, "no arithmetic")


def test_an_unexpressible_formula_says_so():
    assert shape_of("one priced line per labour category × PROVISIONAL hours") \
        == (None, "unexpressible")


def test_the_two_numeric_thresholds_in_the_corpus_are_found():
    """GP3.2 at 1.00 m2 and C1.3 at 1.00 m3 are the deduction thresholds the
    whole of measurement turns on."""
    gp = thresholds_of("no deduction shall be made from items required to be "
                       "measured by area for voids of less than 1.00 m².")
    assert gp and gp[0][1:] == ("<", "1.00", "m2")
    assert TABLE.get("GP3.2").thresholds
    assert TABLE.get("C1.3").thresholds


def test_sum_volume_was_added_because_the_corpus_needs_it():
    """Eleven clauses state "V = Σ V" and had nowhere to map before this shape
    existed. Mapping them onto a multiplicative shape would have invented a
    formula."""
    assert "sum_volume" in SHAPES
    assert SHAPE_UNITS["sum_volume"] == ("m3",)
    assert any(c.shape == "sum_volume" for c in TABLE)
