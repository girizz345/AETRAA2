"""The gate. A gate that has never been observed to fail is not a gate, so
these construct an evidence set with a known omission and assert it fires."""
import pytest

from bill.completeness import check, enforce
from spine.errors import CompletenessFailure


def test_door_schedule_with_no_doors_fails():
    findings = check({"door_schedule": 47}, {"H": 0})
    assert [f.status for f in findings] == ["FAIL"]
    with pytest.raises(CompletenessFailure):
        enforce(findings)


def test_door_schedule_with_doors_passes():
    findings = check({"door_schedule": 47}, {"H": 12})
    assert all(f.status == "PASS" for f in findings)
    enforce(findings)


def test_written_justification_converts_a_fail():
    findings = check({"lift": 2}, {"P": 0},
                     {("lift", "P"): "separate nominated package, spec 14 10 00"})
    assert [f.status for f in findings] == ["JUSTIFIED"]
    enforce(findings)


def test_silence_is_not_a_justification():
    findings = check({"lift": 2}, {"P": 0}, {("lift", "P"): ""})
    assert [f.status for f in findings] == ["FAIL"]


def test_wet_room_requires_three_sections():
    findings = check({"wet_room": 8}, {"G": 3, "J": 5, "Q": 0})
    assert sorted(f.section for f in findings if f.status == "FAIL") == ["Q"]
