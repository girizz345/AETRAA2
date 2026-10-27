"""Dimension parsing. Under v3.1 every length in the bill comes through here,
so the refusals matter as much as the parses."""
from decimal import Decimal

import pytest

from readers.dimensions import Refused, parse


def test_pair_in_millimetres():
    assert parse("900 x 2100") == (Decimal("0.9"), Decimal("2.1"))


def test_explicit_metres_are_not_divided():
    assert parse("2.4 m") == (Decimal("2.4"),)


def test_comma_thousands():
    assert parse("1,200 x 2,400")[0] == Decimal("1.2")


@pytest.mark.parametrize("cell", ["approx 2100", "2100 TYP", "2100 +/- 10",
                                  "TO SUIT", "", "n/a"])
def test_qualified_dimensions_are_refused(cell):
    with pytest.raises(Refused):
        parse(cell)


def test_bare_small_number_is_ambiguous_without_expect():
    with pytest.raises(Refused):
        parse("3")
    assert parse("3", expect="m") == (Decimal("3"),)
