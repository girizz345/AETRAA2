"""Floor multipliers. Getting this wrong was measured at a 16-58% undercount,
and the undetermined case must be a gap rather than a silent 1."""
from measure.inventory import floor_multiplier


def test_listed_floors():
    assert floor_multiplier("TYPICAL FLOOR PLAN (2ND, 4TH & 6TH)") == 3


def test_range_of_levels():
    assert floor_multiplier("LEVELS 03-07 FLOOR PLAN") == 5


def test_plain_sheet_is_one():
    assert floor_multiplier("GROUND FLOOR PLAN") == 1


def test_typical_without_a_list_is_undetermined():
    assert floor_multiplier("TYPICAL FLOOR PLAN") is None


def test_missing_subtitle_is_undetermined():
    assert floor_multiplier(None) is None
