"""Item lettering — the sequence is measured from the reference BOQ, so these
tests assert the observed run rather than an alphabet."""
import pytest

from bill import lettering


def test_skips_i_and_o():
    issued = lettering.letters(20)
    assert "I" not in issued
    assert "O" not in issued


def test_observed_run_matches_the_reference_bill():
    assert lettering.letters(20) == list("ABCDEFGHJKLMNPQRSTUV")


def test_refuses_to_invent_a_second_cycle():
    with pytest.raises(ValueError):
        lettering.letters(21)


def test_zero_is_legal():
    assert lettering.letters(0) == []
