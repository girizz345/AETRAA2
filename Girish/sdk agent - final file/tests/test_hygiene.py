"""Output hygiene. These leak through exception text and debug labels rather
than through anything anyone wrote deliberately."""
from render.hygiene import check_method_label, violations


def test_clean_cell():
    assert violations("Raft foundation, 1000mm thick") == []
    # a consultant's own words are quoted, not ours: a banned WORD must not
    # condemn a longer word that merely contains it
    assert violations("Drawings/03-HVAC/AC-115 SCHEMATIC DIAGRAM.pdf") == []
    assert violations("tokenised access control") == []
    assert violations("the schema was invalid")            # the word itself still is


def test_script_name_is_caught():
    assert violations("see extract.py for details")


def test_none_leaking_into_a_cell_is_caught():
    assert violations("Quantity: None")


def test_contraction_is_caught():
    assert violations("The quantity doesn't include laps")


def test_approved_method_label():
    assert check_method_label("schedule cell") is None
    assert check_method_label("OCR") is not None
