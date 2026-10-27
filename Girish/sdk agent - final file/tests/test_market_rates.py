"""Market rates, and the five guards that replaced the withdrawn rate library.

The library's envelope caught one failure in particular: bulk excavation priced
at the raft concrete rate, a five-million overstatement, because a keyword
matched. A guard that has never been observed to fire is not a guard, so
test_the_historical_failure_is_caught reconstructs exactly that and asserts the
ordinal invariant fires on it.

Runs under pytest, and also standalone (python3 tests/test_market_rates.py) so
the guards can be proved on a machine with no pytest installed.
"""
from datetime import date
from decimal import Decimal
from pathlib import Path

from bill.market import (Observation, build_query, canonical_unit,
                         check_ordinals, escalate, median, parse_observations,
                         publish, search_class, share_breaches,
                         untested_ordinals)
from bill.price import BillLine, price_bill, price_line, search_budget
from ingest.rates import RateClassTable
import json

ROOT = Path(__file__).resolve().parent.parent
TABLE = RateClassTable.load(ROOT / "data" / "rate_classes.json")
UNITS = json.loads((ROOT / "data" / "units.json").read_text())
TODAY = date(2026, 9, 1)


def _obs(url, value, unit="m3", pub=None, price_date="2026-07-01",
         currency="AED"):
    return {"url": url, "publisher": pub or url, "quoted_value": value,
            "quoted_unit": unit, "quoted_currency": currency,
            "price_date": price_date, "region": "Dubai",
            "retrieved": "2026-09-01", "snippet": "as quoted"}


# ── the table itself ────────────────────────────────────────────────────
def test_the_table_holds_no_prices():
    raw = json.loads((ROOT / "data" / "rate_classes.json").read_text())
    for entry in raw["classes"]:
        assert set(entry) <= {"id", "unit", "section", "label", "note"}, entry
        for key in ("rate", "price", "total", "pc", "install"):
            assert key not in entry


def test_every_ordinal_is_well_formed():
    assert TABLE.check() == []
    assert len(TABLE.ordinals()) == 28


# ── G+.32c staleness and the observation record ─────────────────────────
def test_an_observation_without_a_url_is_not_a_rate():
    kept, rejected = parse_observations([{**_obs("x", 30), "url": None}], "m3")
    assert kept == [] and "missing url" in rejected[0][1]


def test_an_undated_observation_is_kept_as_at_retrieval_and_flagged():
    """Five of five observations on a real run carried no price date and the
    class went unpriced. An undated figure is used as current at the day it
    was read, marked, and the published rate carries DATE_UNSTATED so it is
    cleared before issue — disclosed, not refused and not silently dated."""
    from datetime import date
    from bill.market import publish
    from ingest.rates import RateClassTable
    from pathlib import Path

    row = _obs("https://a.example/x", 30)
    row["price_date"] = None
    row["retrieved"] = "2026-09-13"
    kept, rejected = parse_observations([row], "m3")
    assert rejected == [] and len(kept) == 1
    assert kept[0].date_unstated and kept[0].price_date == "2026-09-13"

    table = RateClassTable.load(Path(__file__).resolve().parents[1] / "data" / "rate_classes.json")
    rate = publish("excavation.bulk", "m3", kept, table, date(2026, 9, 13))
    assert rate is not None and rate.value == 30
    assert any(f.startswith("DATE_UNSTATED a.example") for f in rate.flags)
    assert rate.clear_required


def test_a_figure_quoted_in_the_wrong_unit_is_rejected():
    kept, rejected = parse_observations(
        [_obs("https://a.example/x", 30, unit="m2")], "m3")
    assert kept == [] and "the row is per m3" in rejected[0][1]


def test_a_foreign_currency_without_an_fx_rate_is_rejected():
    kept, rejected = parse_observations(
        [_obs("https://a.example/x", 8, currency="USD")], "m3")
    assert kept == [] and "no stated FX rate" in rejected[0][1]


def test_a_foreign_currency_with_an_fx_rate_converts():
    kept, _ = parse_observations([_obs("https://a.example/x", 8,
                                       currency="USD")], "m3",
                                fx={"USD": Decimal("3.6725")})
    assert kept[0].quoted_value == Decimal("29.38")


def test_unit_aliases_a_published_page_might_use():
    assert canonical_unit("Sq.M") == "m2"
    assert canonical_unit("cu.m") == "m3"
    assert canonical_unit("Lin m") == "m"
    assert canonical_unit("each") == "nr"
    assert canonical_unit("per hectare") is None
    # a page's wording around the unit, as real searches returned it
    assert canonical_unit("per door unit (nr)") == "nr"
    assert canonical_unit("per door (nr)") == "nr"
    assert canonical_unit("AED/m2 of wall") == "m2"
    assert canonical_unit("per m2 or per nr") is None       # two units: refused
    # a price per THING with no measure named is enumerated
    assert canonical_unit("AED per door") == "nr"
    assert canonical_unit("AED per single door (labour only)") == "nr"
    assert canonical_unit("per day") is None                # time, not a thing
    assert canonical_unit("per m of skirting") == "m"


def test_price_dates_are_read_at_their_own_coarseness():
    from datetime import date
    from bill.market import parse_price_date
    assert parse_price_date("2026-06-15") == date(2026, 6, 15)
    assert parse_price_date("2026-06") == date(2026, 6, 1)
    assert parse_price_date("June 2026") == date(2026, 6, 1)
    assert parse_price_date("2026") == date(2026, 1, 1)
    assert parse_price_date("Q2 2026") is None
    obs = Observation(url="https://a.example/x", publisher="A", quoted_value=1,
                      quoted_unit="nr", quoted_currency="AED", price_date="2026-06")
    assert obs.age_months(date(2026, 9, 13)) == 3


def test_a_quoted_value_with_currency_or_a_range_is_read():
    from bill.market import _value
    from decimal import Decimal
    assert _value("AED 1,200") == (Decimal("1200"), None)
    assert _value("1200.00 / nr") == (Decimal("1200.00"), None)
    assert _value(950) == (Decimal("950"), None)
    mid, note = _value("800 – 1,500")
    assert mid == Decimal("1150.00") and "midpoint" in note
    assert _value("free quote") == (None, None)
    assert _value("-40") == (None, None)


def test_a_range_observation_prices_the_midpoint_and_is_flagged():
    from datetime import date
    from bill.market import publish
    from ingest.rates import RateClassTable
    from pathlib import Path
    row = _obs("https://a.example/x", "800 - 1200")
    kept, rejected = parse_observations([row], "m3")
    assert rejected == [] and kept[0].quoted_value == 1000
    table = RateClassTable.load(Path(__file__).resolve().parents[1] / "data" / "rate_classes.json")
    rate = publish("excavation.bulk", "m3", kept, table, date(2026, 9, 13))
    assert rate.value == 1000 and any(f.startswith("RANGE_MIDPOINT") for f in rate.flags)


def test_a_source_older_than_the_hard_limit_is_dropped():
    obs, _ = parse_observations(
        [_obs("https://a.example/x", 30, price_date="2023-01-01"),
         _obs("https://b.example/y", 32, price_date="2023-02-01")], "m3")
    assert publish("excavation.bulk", "m3", obs, TABLE, TODAY) is None


def test_a_source_inside_the_escalation_band_is_escalated_by_stated_rule():
    obs, _ = parse_observations(
        [_obs("https://a.example/x", 100, price_date="2025-09-01"),
         _obs("https://b.example/y", 100, price_date="2025-09-01")], "m3")
    rate = publish("excavation.bulk", "m3", obs, TABLE, TODAY,
                   escalation_pct=Decimal("4"))
    assert rate.value == Decimal("104.00")
    assert any(f.startswith("ESCALATED") for f in rate.flags)


def test_escalation_is_straight_line():
    assert escalate(Decimal("100"), 6, Decimal("4")) == Decimal("102.00")
    assert escalate(Decimal("100"), 18, Decimal("4")) == Decimal("106.00")


# ── G+.32a corroboration and G+.32b spread ──────────────────────────────
def test_one_publisher_is_flagged_even_across_two_pages():
    obs, _ = parse_observations(
        [_obs("https://costdata.example/a", 30, pub="CostData"),
         _obs("https://www.costdata.example/b", 31, pub="CostData")], "m3")
    rate = publish("excavation.bulk", "m3", obs, TABLE, TODAY)
    assert any("SINGLE_SOURCE" in f for f in rate.flags)
    assert rate.clear_required


def test_two_publishers_publish_clean():
    obs, _ = parse_observations(
        [_obs("https://a.example/x", 30), _obs("https://b.example/y", 34)], "m3")
    rate = publish("excavation.bulk", "m3", obs, TABLE, TODAY)
    assert rate.flags == () and rate.value == Decimal("32.00")


def test_a_wide_spread_says_the_class_holds_two_items():
    obs, _ = parse_observations(
        [_obs("https://a.example/x", 30), _obs("https://b.example/y", 95)], "m3")
    rate = publish("excavation.bulk", "m3", obs, TABLE, TODAY)
    assert any("CLASS_SPREAD" in f for f in rate.flags)


def test_no_usable_observation_is_a_gap_not_a_number():
    assert publish("excavation.bulk", "m3", [], TABLE, TODAY) is None


def test_the_median_is_deterministic():
    assert median([Decimal("3"), Decimal("1"), Decimal("2")]) == Decimal("2")
    assert median([Decimal("1"), Decimal("2"), Decimal("3"),
                   Decimal("4")]) == Decimal("2.50")


def test_a_rate_cites_its_publishers():
    obs, _ = parse_observations(
        [_obs("https://a.example/x", 30, pub="Cost Handbook"),
         _obs("https://b.example/y", 34, pub="Tender Price Index")], "m3")
    rate = publish("excavation.bulk", "m3", obs, TABLE, TODAY)
    assert "Cost Handbook" in rate.citation()
    assert "Tender Price Index" in rate.citation()


# ── G+.32d the ordinal invariants ───────────────────────────────────────
def _rate(rate_class, value, unit):
    obs, _ = parse_observations(
        [_obs("https://a.example/" + rate_class, value, unit=unit),
         _obs("https://b.example/" + rate_class, value, unit=unit)], unit)
    return publish(rate_class, unit, obs, TABLE, TODAY)


def test_the_historical_failure_is_caught():
    """Bulk excavation priced at the raft concrete rate — the five-million
    overstatement the withdrawn library's envelope existed to catch. The
    envelope is gone; the ordinal invariant catches it instead, and it does so
    without any stored price to compare against."""
    rates = {"excavation.bulk": _rate("excavation.bulk", 1950, "m3"),
             "concrete.reinforced.slab": _rate("concrete.reinforced.slab",
                                               1950, "m3"),
             "concrete.plain": _rate("concrete.plain", 450, "m3")}
    breaches = check_ordinals(rates, TABLE)
    assert breaches, "the excavation-at-concrete-rate error went undetected"
    assert any("excavation.bulk" in b and "concrete.plain" in b
               for b in breaches)


def test_correct_ordering_passes():
    rates = {"excavation.bulk": _rate("excavation.bulk", 30, "m3"),
             "excavation.trench": _rate("excavation.trench", 48, "m3"),
             "concrete.plain": _rate("concrete.plain", 450, "m3"),
             "concrete.reinforced.slab": _rate("concrete.reinforced.slab",
                                               1800, "m3"),
             "concrete.reinforced.stair": _rate("concrete.reinforced.stair",
                                                2200, "m3")}
    assert check_ordinals(rates, TABLE) == []


def test_a_small_board_at_a_switchboard_rate_is_caught():
    rates = {"board.distribution.small": _rate("board.distribution.small",
                                               95000, "nr"),
             "board.distribution.main": _rate("board.distribution.main",
                                              12000, "nr")}
    assert check_ordinals(rates, TABLE)


def test_an_untested_pair_is_reported_not_silently_passed():
    rates = {"excavation.bulk": _rate("excavation.bulk", 30, "m3")}
    assert check_ordinals(rates, TABLE) == []
    assert len(untested_ordinals(rates, TABLE)) == len(TABLE.ordinals())


# ── G+.32e the share guard ──────────────────────────────────────────────
def test_one_row_carrying_most_of_a_section_is_flagged():
    amounts = {"B": {"excavation.bulk": Decimal("5000000"),
                     "kerb.concrete": Decimal("80000")}}
    assert share_breaches(amounts, TABLE)


def test_an_even_spread_across_a_section_is_not_flagged():
    amounts = {"B": {"a": Decimal("100"), "b": Decimal("100"),
                     "c": Decimal("100"), "d": Decimal("100")}}
    assert share_breaches(amounts, TABLE) == []


# ── G+.31 units, and the bill ───────────────────────────────────────────
def test_a_rate_per_square_metre_cannot_price_a_cubic_metre_row():
    rates = {"concrete.reinforced.slab": _rate("concrete.reinforced.slab",
                                               380, "m2")}
    line = BillLine("C-A", "C", "concrete.reinforced.slab", "m3",
                    Decimal("100"), item_type="concrete")
    row = price_line(line, rates, UNITS)
    assert any("G+.31" in f for f in row.failures)


def test_an_item_type_billed_in_the_wrong_unit_fails():
    rates = {"excavation.bulk": _rate("excavation.bulk", 30, "m3")}
    line = BillLine("B-A", "B", "excavation.bulk", "m3", Decimal("10"),
                    item_type="door")
    row = price_line(line, rates, UNITS)
    assert any("bills in nr" in f for f in row.failures)


def test_a_class_with_no_rate_is_a_gap_row():
    line = BillLine("B-A", "B", "excavation.bulk", "m3", Decimal("10"))
    row = price_line(line, {}, UNITS)
    assert row.is_gap and row.amount is None


def test_the_projects_own_priced_document_governs():
    rates = {"excavation.bulk": _rate("excavation.bulk", 30, "m3")}
    line = BillLine("B-A", "B", "excavation.bulk", "m3", Decimal("100"),
                    item_type="excavation")
    row = price_line(line, rates, UNITS, project_rates={"excavation.bulk": 60})
    assert row.rate == Decimal("60")
    assert row.citation == "the project's own priced document"
    assert any("DIVERGENCE" in f for f in row.flags)


def test_the_amount_is_rate_times_quantity():
    rates = {"excavation.bulk": _rate("excavation.bulk", 30, "m3")}
    line = BillLine("B-A", "B", "excavation.bulk", "m3", Decimal("124.55"),
                    item_type="excavation")
    row = price_line(line, rates, UNITS)
    assert row.amount == Decimal("3736.50")


def test_search_is_budgeted_by_class_not_by_line():
    lines = [BillLine(f"B-{i}", "B", "excavation.bulk", "m3", Decimal("1"))
             for i in range(400)]
    lines.append(BillLine("C-A", "C", "concrete.plain", "m3", Decimal("1")))
    assert search_budget(lines) == 2


def test_a_bill_priced_end_to_end_offline():
    rates = {"excavation.bulk": _rate("excavation.bulk", 30, "m3"),
             "concrete.plain": _rate("concrete.plain", 450, "m3")}
    lines = [BillLine("B-A", "B", "excavation.bulk", "m3", Decimal("1200"),
                      item_type="excavation"),
             BillLine("C-A", "C", "concrete.plain", "m3", Decimal("90"),
                      item_type="concrete")]
    rows, failures, flags = price_bill(lines, rates, UNITS, TABLE)
    assert failures == []
    assert [r.amount for r in rows] == [Decimal("36000.00"),
                                        Decimal("40500.00")]
    assert any("untested" in f for f in flags)


# ── the search channel's contract ───────────────────────────────────────
def test_the_query_is_built_from_the_class_not_from_a_description():
    rc = TABLE.get("excavation.bulk")
    query = build_query(rc, "Dubai", TODAY)
    assert rc.label in query and "per m3" in query
    assert "2026-09-01" in query


def test_search_class_runs_the_whole_chain_against_an_injected_searcher():
    def fake_searcher(prompt, label=None):
        assert "bulk excavation" in prompt
        return [_obs("https://a.example/x", 30), _obs("https://b.example/y", 34)]
    rate = search_class(TABLE.get("excavation.bulk"), TABLE, region="Dubai",
                       today=TODAY, searcher=fake_searcher)
    assert rate.value == Decimal("32.00") and rate.flags == ()


def test_a_search_channel_that_is_down_yields_a_gap_not_a_guess():
    rate = search_class(TABLE.get("excavation.bulk"), TABLE, today=TODAY,
                        searcher=lambda prompt, label=None: None)
    assert rate is None


def test_a_search_channel_that_invents_a_figure_is_rejected():
    """The model is told never to report a figure it did not read. If it does it
    anyway, the missing url is what stops it."""
    def inventing(prompt, label=None):
        return [{"quoted_value": 28, "quoted_unit": "m3",
                 "quoted_currency": "AED", "publisher": "professional judgement",
                 "price_date": "2026-09-01"}]
    assert search_class(TABLE.get("excavation.bulk"), TABLE, today=TODAY,
                        searcher=inventing) is None


if __name__ == "__main__":
    import sys, traceback
    tests = [(n, f) for n, f in sorted(globals().items())
             if n.startswith("test_") and callable(f)]
    failed = []
    for name, fn in tests:
        try:
            fn()
            print(f"  ok   {name}")
        except Exception:
            failed.append(name)
            print(f"  FAIL {name}")
            traceback.print_exc()
    print(f"\n{len(tests) - len(failed)}/{len(tests)} passed")
    sys.exit(1 if failed else 0)
