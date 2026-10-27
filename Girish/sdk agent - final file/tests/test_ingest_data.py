"""The harvested ingest tables, and the corrections applied while harvesting.

Each reference document was treated as evidence, not as instruction. Where two
references disagreed, or a reference contradicted itself, the contradiction was
resolved and recorded — and a resolution nobody tests is a resolution that
quietly reverts the next time the table is edited. These are those tests.
"""
import json
from pathlib import Path

import pytest

from ingest.discipline_matrix import DisciplineMatrix
from ingest.gates import Gates
from ingest.house_template import HouseTemplate
from ingest.multipliers import Multipliers, floor_multiplier
from ingest.units import Units

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"


# ── the discipline matrix, and its self-contradiction ───────────────────
def test_nothing_routes_to_a_section_that_does_not_exist():
    """discipline-matrix.md says in its own header that there is no POMI section
    S, then routes FA, ELV, MEP and LSF to S anyway. The loader refuses a table
    that still does."""
    matrix = DisciplineMatrix.load()
    assert all("S" not in row.sections for row in
               [matrix.resolve(p) for p in matrix.prefixes()])


def test_the_elv_disciplines_bill_inside_electrical():
    matrix = DisciplineMatrix.load()
    for prefix in ("FA", "ELV", "LV", "V", "LSF", "LF"):
        assert matrix.resolve(prefix + "-101").sections == ("R",), prefix


def test_a_table_that_still_routes_to_S_is_refused(tmp_path=None):
    import tempfile
    raw = json.loads((DATA / "disciplines.json").read_text())
    raw["disciplines"].append({"prefix": "ZZ", "discipline": "x",
                               "sections": ["S"]})
    with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as fh:
        json.dump(raw, fh)
        path = Path(fh.name)
    with pytest.raises(ValueError):
        DisciplineMatrix.load(path)


def test_fire_alarm_devices_are_measured_in_R():
    matrix = DisciplineMatrix.load()
    note = [c for c in matrix.cross_discipline()
            if "fire alarm" in c["item"]][0]
    assert note["measure_in"] == "R" and note["was"] == "S"


def test_the_LS_collision_is_recorded_rather_than_silently_picked():
    """LS is Landscape in the development package and Life Safety in the
    reference. One of them has to hold the bare prefix; the other must still be
    reachable, and the choice must be visible."""
    matrix = DisciplineMatrix.load()
    assert matrix.resolve("LS-101").discipline == "Landscape"
    assert matrix.resolve("LSF-101").discipline.startswith("Life safety")
    assert [c["token"] for c in matrix.collisions()] == ["LS"]


def test_a_tag_pattern_outside_its_discipline_is_not_applied():
    """W12 is a shear wall on a structural sheet and a window on an
    architectural one. Applying both patterns everywhere is how one becomes the
    other."""
    matrix = DisciplineMatrix.load()
    assert matrix.tags_in("W12", "ST") == {"shear_wall": ["W12"]}
    assert "shear_wall" not in matrix.tags_in("W12", "AR")


def test_an_ambiguous_keyword_routes_to_both_readings():
    matrix = DisciplineMatrix.load()
    assert set(matrix.route_by_title("RETAINING WALL SECTION")) >= {"C", "D"}
    assert set(matrix.route_by_title("STAIR CORE DETAIL")) >= {"C", "E"}
    assert {e["keyword"] for e in matrix.ambiguous()} == {"WALL", "STAIR"}


# ── floor multipliers ──────────────────────────────────────────────────
def test_the_corpus_subtitle_forms_all_resolve():
    cases = {"TYP. FL. L3 TO L9": 7, "LEVELS 03-07 FLOOR PLAN": 5,
             "TYPICAL FLOOR PLAN (2ND, 4TH & 6TH)": 3,
             "REPEAT FOR FLOORS 3 TO 9": 7, "FL 3 / 5 / 7 / 9": 4,
             "L1, L4, L7": 3, "TYPICAL 3RD-9TH FLOORS": 7,
             "GROUND FLOOR PLAN": 1, "L3 - PODIUM EAST": 1}
    assert {k: floor_multiplier(k) for k in cases} == cases


def test_typical_without_a_scope_is_undetermined_not_one():
    assert floor_multiplier("TYPICAL FLOOR PLAN") is None
    assert floor_multiplier("TYPICAL POOL") is None
    assert floor_multiplier(None) is None


def test_all_floors_needs_the_section_drawing():
    assert floor_multiplier("ALL FLOORS") is None
    assert floor_multiplier("ALL FLOORS", 12) == 12


def test_a_zone_qualifier_is_one_floor_and_carries_the_zone():
    scope = Multipliers.load().resolve("GROUND FLOOR (NORTH WING)")
    assert scope.multiplier == 1 and scope.zone == "NORTH WING"


def test_the_verbatim_subtitle_is_kept_for_R36():
    scope = Multipliers.load().resolve("TYP. FL. L3 TO L9")
    assert scope.verbatim == "TYP. FL. L3 TO L9" and scope.label == "FL3-FL9"


def test_a_range_is_tried_before_a_single_floor():
    """Precedence is data. Reversed, FLOOR 3 TO 9 reads as floor 3."""
    order = Multipliers.load().kinds()
    assert order.index("range") < order.index("single")


# ── units ──────────────────────────────────────────────────────────────
def test_lm_is_an_input_spelling_not_a_unit():
    units = Units.load()
    assert units.canonical("lm") == "m"
    assert "lm" not in json.loads((DATA / "units.json").read_text())["units"]


def test_the_unit_table_is_the_single_source_for_market_spellings():
    from bill.market import canonical_unit
    for spelling in ("Sq.M", "cu.m", "Lin m", "each", "Nos."):
        assert canonical_unit(spelling) == Units.load().canonical(spelling)
    assert canonical_unit("per hectare") is None


def test_an_item_type_carries_only_its_own_unit():
    units = Units.load()
    assert units.check("door", "nr") is None
    assert "bills in nr" in units.check("door", "m2")
    assert units.check("bar_reinforcement", "tonne") is None


# ── the gates ──────────────────────────────────────────────────────────
def test_the_completeness_matrix_kept_the_rows_the_newer_reference_dropped():
    matrix = Gates.load().matrix()
    assert {"door_schedule", "window_schedule", "lift", "stair", "wet_room",
            "balustrade", "kitchen_equipment", "fire_alarm_device",
            "light_fitting"} <= set(matrix)
    assert {"finish_schedule", "equipment_schedule", "structural_schedule",
            "apartment_mix", "external_area"} <= set(matrix)


def test_fire_alarm_completeness_points_at_R():
    assert Gates.load().row("fire_alarm_device").sections == ("R",)


def test_a_wet_room_must_produce_rows_in_three_sections():
    row = Gates.load().row("wet_room")
    assert row.sections == ("G", "J", "Q") and row.all_of


def test_equipment_may_be_in_either_Q_or_R():
    row = Gates.load().row("equipment_schedule")
    assert row.any_of and set(row.sections) == {"Q", "R"}


def test_all_twelve_mass_balance_checks_are_present_with_their_tolerances():
    checks = Gates.load().mass_balance()
    assert [c.n for c in checks] == list(range(1, 13))
    assert Gates.load().mass_check(2).tolerance_pct == 5
    assert Gates.load().mass_check(4).tolerance_pct == 0


def test_an_exact_check_breaches_on_any_difference():
    exact = Gates.load().mass_check(4)
    assert exact.breached(47, 48) and not exact.breached(47, 47)


def test_a_ten_percent_check_tolerates_nine():
    check = Gates.load().mass_check(1)
    assert not check.breached(1000, 1090) and check.breached(1000, 1110)


def test_the_fabrication_token_scan_fires_and_its_exception_holds():
    gates = Gates.load()
    assert [h.token.lower() for h in gates.scan("assumed typical thickness")] \
        == ["typical", "assumed"] or len(gates.scan("assumed typical")) == 2
    assert gates.scan("TYPICAL FLOOR PLAN", quoted_label=True) == []


# ── the house format ───────────────────────────────────────────────────
def test_the_money_column_is_the_plurality_not_the_earlier_reading():
    """An earlier reading of the reference named 15.711. It was the third most
    common width in the issued set, not the first."""
    tpl = HouseTemplate.load()
    assert tpl.width("H") == 14.711


def test_A_to_G_are_unanimous_and_gated_exactly():
    tpl = HouseTemplate.load()
    assert tpl.verify_widths({"A": 4.711, "G": 12.711}) == []
    assert tpl.verify_widths({"A": 9.711}), "a cover width passed on a bill page"
    assert tpl.verify_widths({"H": 15.711}) == [], "H accepts a range"
    assert tpl.verify_widths({"H": 20.0}), "H accepted a width outside the range"


def test_eight_columns_not_six():
    assert [c.col for c in HouseTemplate.load().columns()] == list("ABCDEFGH")


def test_the_page_rhythm():
    tpl = HouseTemplate.load()
    assert [tpl.first_row(n) for n in (1, 2, 3, 4)] == [1, 63, 125, 187]
    assert len(tpl.body_rows(2)) == 46
    assert tpl.to_collection_row(2) == 123
    assert tpl.to_collection_formula(2) == "=SUM(H72:H117)"
    assert tpl.page_of_row(123) == 2


def test_a_dayworks_bill_uses_the_two_part_page_code():
    tpl = HouseTemplate.load()
    assert tpl.page_no(6, 1, 2) == "6/1/2"
    assert tpl.page_no(8, None, 2) == "8/2"


def test_a_continuation_heading_is_the_house_string():
    tpl = HouseTemplate.load()
    assert tpl.section_heading("C", "CONCRETE") == "SECTION C - CONCRETE"
    assert tpl.section_heading("C", "CONCRETE", continued=True) == \
        "SECTION C - CONCRETE (CONT'D)"


def test_a_band_row_in_the_wrong_place_is_caught():
    tpl = HouseTemplate.load()
    assert tpl.verify_page({1: "project band 1", 6: "column head 1"}) == []
    assert tpl.verify_page({1: "body"})
