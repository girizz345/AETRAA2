#!/usr/bin/env python3
"""
market.py — market rates from a web search, and the arithmetic that guards them.

There is no rate library. A rate reaches a bill row only as the median of at
least two independently published observations, each carrying the page it was
read on and the date its price was current.

The division of labour is the house invariant: the MODEL identifies (it searches
and reports what each page said), the CODE computes (median, spread, age,
escalation, the ordinal tests). Nothing in this file asks a model for a number.

Every function below is pure except search_class(), which is the one that
reaches the network, and it takes its searcher as an argument so the module
itself imports no provider.

  python3 -m bill.market --classes ../data/rate_classes.json \\
      --observations obs.json --class excavation.bulk

Exit 0 = published inside every guard. Exit 1 = flags to clear. Exit 2 = gap.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from pathlib import Path
from urllib.parse import urlparse

MONEY = Decimal("0.01")

# Unit spellings live in data/units.json — ONE table, read by the unit gate
# (G+.31) and by this module, so a page quoting "Sq.M" and a bill row saying
# "m2" meet in one place instead of in two tables that drift apart. Loaded
# lazily and cached: this module must stay importable with no data file present
# for a unit test that never canonicalises anything.
_UNITS = None


def _units():
    global _UNITS
    if _UNITS is None:
        from ingest.units import Units
        _UNITS = Units.load()
    return _UNITS


REQUIRED_FIELDS = ("url", "publisher", "quoted_value", "quoted_unit",
                   "quoted_currency")     # price_date: see parse_observations


def canonical_unit(text: str | None) -> str | None:
    """What a published page called the unit, in the bill's spelling.

    Exact spellings first, from the one unit table. A page rarely obliges:
    "per door unit (nr)", "per door (nr)", "AED/m2 of wall" were all refused
    as unrecognised on a real search while carrying the unit in plain sight.
    So the text is then scanned for the table's spellings as whole tokens. One
    distinct unit found is the unit; none, or two different ones, is None and
    the observation is rejected with the text quoted — never a guess between
    them."""
    if text is None:
        return None
    exact = _units().canonical(text)
    if exact:
        return exact
    low = str(text).lower().replace("²", "2").replace("³", "3")
    table = getattr(_units(), "table", None) or getattr(_units(), "_canonical", None)
    if not isinstance(table, dict):
        try:
            import json
            from pathlib import Path
            table = json.loads((Path(__file__).resolve().parents[1] / "data"
                                / "units.json").read_text())["canonical"]
        except (OSError, ValueError, KeyError):
            return None
    found = set()
    for spelling in sorted(table, key=len, reverse=True):
        pat = r"(?<![a-z0-9])" + re.escape(spelling.lower()) + r"(?![a-z0-9])"
        if re.search(pat, low):
            found.add(table[spelling])
    if len(found) == 1:
        return found.pop()
    if found:
        return None                          # two different units: refused
    # "AED per door", "per single door (labour only)", "each door": a price
    # per THING with no measure named is an enumerated price — nr. Refused if
    # any measure or time word is present, because "per m of door" or
    # "per day" are not.
    stripped = re.sub(r"\([^)]*\)", " ", low)
    if re.search(r"(?<![a-z0-9])(per|each|/)\s*[a-z][a-z ]*$", stripped.strip()) \
            and not re.search(r"(?<![a-z0-9])(m|m2|m3|mm|cm|km|km2|kg|g|t|tonne|"
                              r"ton|lb|lbs|oz|l|ml|litre|liter|gallon|gal|"
                              r"hectare|hectares|ha|acre|acres|sqft|ft2|"
                              r"hour|hr|hrs|minute|min|day|week|month|year|"
                              r"annum|sq|cu|lin|ft|foot|feet|inch|yard|yd|"
                              r"set|lot|pair|roll|bag|box|pallet|sheet|"
                              r"length|width|height|thickness)(?![a-z0-9])",
                              stripped):
        return "nr"
    return None


RE_RANGE = re.compile(r"^\s*([0-9][0-9,]*(?:\.[0-9]+)?)\s*(?:-|–|—|to)\s*"
                      r"([0-9][0-9,]*(?:\.[0-9]+)?)\s*$")


def _value(value) -> tuple[Decimal | None, str | None]:
    """(figure, note). A page quotes "AED 1,200", "1200.00/nr", "800 – 1,500".
    Currency letters and symbols and thousands separators are stripped; a
    RANGE is read as its midpoint and the note says so, and publish() flags
    the rate RANGE_MIDPOINT so a reviewer sees the spread the page gave."""
    if value is None:
        return None, None
    if isinstance(value, (int, float, Decimal)):
        out = Decimal(str(value))
        return (out, None) if out > 0 else (None, None)
    text = str(value)
    text = re.sub(r"[A-Za-z$€£]+", " ", text)          # currency words, symbols
    text = re.sub(r"/.*$", "", text)                    # "1200 / nr" → "1200"
    text = text.replace(",", "").strip()
    m = RE_RANGE.match(text)
    if m:
        try:
            lo, hi = Decimal(m.group(1)), Decimal(m.group(2))
        except InvalidOperation:
            return None, None
        if lo <= 0 or hi <= 0:
            return None, None
        lo, hi = min(lo, hi), max(lo, hi)
        mid = ((lo + hi) / 2).quantize(MONEY, ROUND_HALF_UP)
        return mid, f"range {lo}–{hi}, midpoint taken"
    try:
        out = Decimal(text)
    except (InvalidOperation, ValueError):
        return None, None
    return (out, None) if out > 0 else (None, None)


def _decimal(value) -> Decimal | None:
    return _value(value)[0]


@dataclass(frozen=True)
class Observation:
    """One figure, read on one page, on one date. Not a rate."""
    url: str
    publisher: str
    quoted_value: Decimal
    quoted_unit: str
    quoted_currency: str
    price_date: str                  # ISO — the date the price was current
    region: str | None = None
    retrieved: str | None = None     # ISO — when we read the page
    snippet: str | None = None
    date_unstated: bool = False      # the page gave no date; price_date is the
                                     # retrieval date and the rate is flagged
    range_note: str | None = None    # the page gave a range; midpoint taken

    @property
    def domain(self) -> str:
        """Independence is by publisher domain. Two pages of one site are one
        source, which is the whole reason this property exists."""
        host = (urlparse(self.url).hostname or "").lower()
        if host.startswith("www."):
            host = host[4:]
        parts = host.split(".")
        return ".".join(parts[-2:]) if len(parts) >= 2 else host

    def age_months(self, today: date) -> int:
        when = parse_price_date(self.price_date)
        if when is None:
            return 10 ** 6          # unparseable reads as infinitely old
        return (today.year - when.year) * 12 + (today.month - when.month)


def parse_price_date(text: str | None) -> date | None:
    """A page dates a price as "2026-06-15", "2026-06", "June 2026" or
    "2026". Each is read at the coarseness it has — a month is its first day,
    a year is its first day — which reads OLDER, never newer, than the truth.
    "2026-06" was refused as unparseable on a real search and the only usable
    observation went with it."""
    if not text:
        return None
    s = str(text).strip()
    for fmt in ("%Y-%m-%d", "%Y-%m", "%Y", "%B %Y", "%b %Y", "%d %B %Y",
                "%d %b %Y", "%B %d, %Y", "%b %d, %Y", "%Y/%m/%d", "%d/%m/%Y",
                "%m/%Y", "%Y.%m"):
        try:
            from datetime import datetime
            return datetime.strptime(s[:20] if fmt != "%Y-%m-%d" else s[:10],
                                     fmt).date()
        except ValueError:
            continue
    return None


def parse_observations(raw: list, expect_unit: str,
                       bill_currency: str = "AED",
                       fx: dict[str, Decimal] | None = None
                       ) -> tuple[list[Observation], list[tuple[dict, str]]]:
    """Turn what the search channel reported into observations, and say why each
    rejected row was rejected. A rejection is never silent: the reasons go to
    AN.RECONCILIATION so a reviewer sees what the search found and lost."""
    kept: list[Observation] = []
    rejected: list[tuple[dict, str]] = []
    for row in raw or []:
        if not isinstance(row, dict):
            rejected.append(({"raw": row}, "not an object"))
            continue
        missing = [f for f in REQUIRED_FIELDS if not row.get(f)]
        if missing:
            rejected.append((row, f"missing {', '.join(missing)}"))
            continue
        url = str(row["url"])
        if not url.lower().startswith(("http://", "https://")):
            rejected.append((row, "url is not a web address"))
            continue
        value, range_note = _value(row["quoted_value"])
        if value is None:
            rejected.append((row, f"quoted_value is not a positive number: "
                                  f"{row['quoted_value']!r}"))
            continue
        unit = canonical_unit(row["quoted_unit"])
        if unit is None:
            rejected.append((row, f"unit {row['quoted_unit']!r} unrecognised "
                                  f"(none of the unit table's spellings, or "
                                  f"two different ones)"))
            continue
        if unit != expect_unit:
            rejected.append((row, f"quoted per {unit}, the row is per "
                                  f"{expect_unit}"))
            continue
        currency = str(row["quoted_currency"]).strip().upper()
        if currency != bill_currency:
            rate = (fx or {}).get(currency)
            if rate is None:
                rejected.append((row, f"quoted in {currency} with no stated FX "
                                      f"rate to {bill_currency}"))
                continue
            value = (value * Decimal(str(rate))).quantize(MONEY, ROUND_HALF_UP)
            currency = bill_currency
        # A page that states a figure but no date is what most supplier price
        # lists and rate pages look like. Refusing it priced nothing on a real
        # run — five observations, five "missing price_date". A surveyor uses
        # the undated figure as current at the day it was read and SAYS SO; so
        # does this: price_date = retrieved (or today), the observation is
        # marked, and publish() flags the rate DATE_UNSTATED for clearance.
        price_date = row.get("price_date")
        date_unstated = False
        if not price_date or str(price_date).lower() in ("null", "none", "n/a", "unknown"):
            price_date = row.get("retrieved") or date.today().isoformat()
            date_unstated = True
        kept.append(Observation(
            url=url, publisher=str(row["publisher"]), quoted_value=value,
            quoted_unit=unit, quoted_currency=currency,
            price_date=str(price_date), region=row.get("region"),
            retrieved=row.get("retrieved"), snippet=row.get("snippet"),
            date_unstated=date_unstated, range_note=range_note))
    return kept, rejected


def median(values: list[Decimal]) -> Decimal:
    """Deterministic: an even count averages the two middle values. Sorted on
    the Decimal, not on a float, so the same inputs always give the same answer."""
    ordered = sorted(values)
    n = len(ordered)
    if n == 0:
        raise ValueError("median of nothing")
    mid = n // 2
    if n % 2:
        return ordered[mid]
    return ((ordered[mid - 1] + ordered[mid]) / 2).quantize(MONEY, ROUND_HALF_UP)


def escalate(value: Decimal, months: int, pct_per_year: Decimal) -> Decimal:
    """Straight-line, by stated rule. Never by judgement."""
    years = Decimal(months) / Decimal(12)
    return (value * (1 + pct_per_year / Decimal(100) * years)).quantize(
        MONEY, ROUND_HALF_UP)


@dataclass(frozen=True)
class MarketRate:
    rate_class: str
    unit: str
    value: Decimal
    currency: str
    basis: str
    observations: tuple = field(default_factory=tuple)
    rejected: tuple = field(default_factory=tuple)
    flags: tuple = field(default_factory=tuple)

    @property
    def clear_required(self) -> bool:
        return bool(self.flags)

    def citation(self) -> str:
        """Invariant 7 — a rate cites its source. This is the cell a reviewer
        reads, so it names the publishers, not the arithmetic."""
        pubs = sorted({o.publisher for o in self.observations})
        return f"{self.basis}: {', '.join(pubs)}"


def publish(rate_class: str, unit: str, observations: list[Observation],
            table, today: date, *, escalation_pct: Decimal = Decimal("4"),
            rejected: list | None = None,
            currency: str = "AED") -> MarketRate | None:
    """Observations in, one rate out — or None, which is a GAP and never a
    number. Applies corroboration, spread and staleness. The ordinal tests need
    the other classes, so they run in check_ordinals() once every class is
    published."""
    flags: list[str] = []
    usable: list[tuple[Observation, Decimal]] = []
    bands = table.staleness_bands()
    hard_limit = max((b["max_age_months"] for b in bands
                      if b["max_age_months"]), default=18)
    soft_limit = min((b["max_age_months"] for b in bands
                      if b["max_age_months"]), default=6)

    for obs in observations:
        if obs.date_unstated:
            flags.append(f"DATE_UNSTATED {obs.domain} — the page states no price "
                         f"date; taken as current at retrieval, clear before issue")
        if obs.range_note:
            flags.append(f"RANGE_MIDPOINT {obs.domain} — {obs.range_note}")
        age = obs.age_months(today)
        if age > hard_limit:
            flags.append(f"SOURCE_TOO_OLD {obs.domain} ({age} months)")
            continue
        if age > soft_limit:
            usable.append((obs, escalate(obs.quoted_value, age,
                                         escalation_pct)))
            flags.append(f"ESCALATED {obs.domain} by {escalation_pct}%/yr "
                         f"over {age} months")
        else:
            usable.append((obs, obs.quoted_value))

    if not usable:
        return None

    domains = {o.domain for o, _ in usable}
    if len(domains) < table.min_sources:
        flags.append(f"SINGLE_SOURCE only {len(domains)} independent publisher")

    values = [v for _, v in usable]
    spread = max(values) / min(values) if min(values) > 0 else Decimal("0")
    if spread > table.max_spread:
        flags.append(f"CLASS_SPREAD {spread.quantize(Decimal('0.01'))}x across "
                     f"{len(values)} observations — the class probably holds two "
                     f"different items; split it and search again")

    value = median(values)
    basis = (f"median of {len(values)} observation(s) from {len(domains)} "
             f"independent publisher(s)")
    return MarketRate(rate_class=rate_class, unit=unit, value=value,
                      currency=currency, basis=basis,
                      observations=tuple(o for o, _ in usable),
                      rejected=tuple(rejected or ()), flags=tuple(flags))


def check_ordinals(rates: dict, table) -> list[str]:
    """The guard that survives the library's withdrawal. An ordering that holds
    because of what the work is cannot go stale, so it can police a searched
    rate without any stored price to compare against.

    A pair with one side unpriced is not a breach — it is simply untested, and
    the untested pairs are reported separately so the coverage of the guard is
    visible rather than assumed."""
    breaches = []
    for o in table.ordinals():
        lo, hi = rates.get(o.lower), rates.get(o.higher)
        if lo is None or hi is None:
            continue
        if not o.holds(lo.value, hi.value):
            breaches.append(o.breach(lo.value, hi.value))
    return breaches


def untested_ordinals(rates: dict, table) -> list[int]:
    return [o.n for o in table.ordinals()
            if o.lower not in rates or o.higher not in rates]


def share_breaches(amounts: dict, table) -> list[str]:
    """amounts: {section letter: {rate_class: amount}}. The last guard, and the
    one that catches the symptom the withdrawn library's failure was found by —
    a single row carrying most of a section."""
    out = []
    limit = table.share_limit
    for section, rows in amounts.items():
        total = sum(rows.values())
        if total <= 0:
            continue
        for rate_class, amount in sorted(rows.items()):
            share = Decimal(amount) / Decimal(total)
            if share > limit:
                out.append(f"{rate_class} is {share:.0%} of section {section} "
                           f"— over the {limit:.0%} limit; needs a written note")
    return out


# ── the one function that touches the network ───────────────────────────
def build_query(rate_class, region: str | None, today: date) -> str:
    """The query is built from the CLASS, never from a bill line's description.
    Matching a description to a rate is the failure this whole module exists to
    prevent, and it would be reintroduced the moment a description reached a
    search box."""
    where = f" in {region}" if region else ""
    return (
        f"Find published unit rates for: {rate_class.label}{where}.\n"
        f"The rate must be quoted per {rate_class.unit}.\n"
        f"Today is {today.isoformat()}. Prefer sources whose price date is "
        f"within the last 6 months, and report the price date you find rather "
        f"than today's date.\n"
        f"Search construction cost publications, published tender rates, "
        f"supplier price lists and quantity surveying cost data for the region. "
        f"Read at least three candidate pages and report an observation for "
        f"every one that states a figure.\n"
        f"Each observation: "
        f'{{"url":..., "publisher":..., "quoted_value":..., "quoted_unit":..., '
        f'"quoted_currency":..., "region":..., "price_date":"YYYY-MM-DD", '
        f'"retrieved":"{today.isoformat()}", "snippet":...}}')


def search_class(rate_class, table, *, region: str | None = None,
                 today: date | None = None, searcher=None,
                 fx: dict | None = None) -> MarketRate | None:
    """One search per class per run. `searcher` is injected so this module
    imports no provider and so a test can run the whole guard chain offline."""
    today = today or date.today()
    if searcher is None:
        from core.ai import research           # lazy: keeps the module portable
        searcher = research
    raw = searcher(build_query(rate_class, region, today),
                   label=f"rate search {rate_class.rate_class}")
    if raw is None:
        return None
    kept, rejected = parse_observations(raw, rate_class.unit, fx=fx)
    return publish(rate_class.rate_class, rate_class.unit, kept, table, today,
                   rejected=rejected)


def main() -> int:
    ap = argparse.ArgumentParser(description="Publish a market rate from "
                                            "observations.")
    ap.add_argument("--classes", required=True)
    ap.add_argument("--observations", required=True,
                    help="JSON array as the search channel returned it")
    ap.add_argument("--class", dest="rate_class", required=True)
    ap.add_argument("--today")
    args = ap.parse_args()

    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
    from ingest.rates import RateClassTable

    table = RateClassTable.load(Path(args.classes))
    rc = table.get(args.rate_class)
    raw = json.loads(Path(args.observations).read_text())
    today = date.fromisoformat(args.today) if args.today else date.today()

    kept, rejected = parse_observations(raw, rc.unit)
    for row, why in rejected:
        print(f"  rejected: {why}  [{str(row.get('url'))[:60]}]")
    rate = publish(rc.rate_class, rc.unit, kept, table, today,
                   rejected=rejected)
    if rate is None:
        print(f"{rc.rate_class}: GAP — no usable observation. A gap is never "
              f"an assumption.")
        return 2
    print(f"{rate.rate_class}  {rate.value} {rate.currency}/{rate.unit}")
    print(f"  {rate.citation()}")
    for flag in rate.flags:
        print(f"  FLAG {flag}")
    return 1 if rate.flags else 0


if __name__ == "__main__":
    raise SystemExit(main())
