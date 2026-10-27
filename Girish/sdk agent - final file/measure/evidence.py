#!/usr/bin/env python3
"""
evidence.py — the addressable base. Nothing may be measured from anything else.

Invariant 2, made structural: the values a quantity is computed from must come
from table parsing or symbol counting, never from a model. Otherwise the
hallucination just moves one step upstream wearing a clause reference.

A Quantity carries evidence ids, and this base is the only thing those ids
resolve against. So an untraceable quantity is not something a gate hunts for
afterwards — it cannot be constructed.

Two rules enforced here rather than reviewed:

  * origin never upgrades. A record created INFERRED survives into the
    provenance sheet as INFERRED. There is no promotion path, because the
    provenance sheet is what a senior professional reads before signing, and it
    must show which quantities rest on inference.
  * a record from a scale-unverified sheet cannot be cited for length or area.
    The guard outlives the calibrate stage that produced it.

The composition report is a finding in itself. Under v3.1 a run that is not
overwhelmingly stated and counted is worth investigating before it is issued.

  python3 -m measure.evidence --base work/evidence.json --composition

Exit 0 = base sound. Exit 1 = citation rule violated.
"""
from __future__ import annotations

import argparse
import json
import sys
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path

from spine.errors import UnevidencedQuantity
from spine.records import EvidenceRecord, Origin, Region

LENGTH_UNITS = {"m", "mm", "cm"}
AREA_UNITS = {"m2"}

# [GP3.1] A dimension is rounded as it is taken, to 0.01 m, and nothing
# downstream rounds again. This is the single rounding point in the package.
DIMENSION_DP = 2
DIMENSION_QUANTUM = Decimal("0.01")
DIMENSIONAL_ROLES = {"length", "width", "height", "depth", "thickness",
                     "girth", "diameter", "lap_length"}


def round_dimension(value: Decimal) -> Decimal:
    """GP3.1, and the only place a value is rounded. Applied when a dimension
    enters the base, never to a computed quantity."""
    return Decimal(value).quantize(DIMENSION_QUANTUM, rounding=ROUND_HALF_UP)


class EvidenceBase:
    def __init__(self) -> None:
        self._records: dict[str, EvidenceRecord] = {}
        self._unverified_sheets: set[str] = set()

    # -- construction ------------------------------------------------------
    def mark_scale_unverified(self, doc_id: str) -> None:
        self._unverified_sheets.add(doc_id)

    def add(self, record: EvidenceRecord) -> None:
        if record.id in self._records:
            raise ValueError(f"duplicate evidence id: {record.id}")
        self._records[record.id] = record

    def make(self, id_: str, value, unit: str, doc_id: str,
             region: Region | None, origin: Origin,
             role: str | None = None) -> EvidenceRecord:
        """A dimensional value is rounded here, once, per GP3.1. Everything
        else is stored as given -- a count is not a measurement and rounding a
        weight-per-metre would corrupt a constant."""
        figure = Decimal(str(value))
        if role in DIMENSIONAL_ROLES or (role is None and unit in LENGTH_UNITS):
            figure = round_dimension(figure)
        record = EvidenceRecord(id=id_, value=figure, unit=unit,
                                doc_id=doc_id, region=region, origin=origin)
        self.add(record)
        return record

    # -- reading -----------------------------------------------------------
    def __len__(self) -> int:
        return len(self._records)

    def __contains__(self, id_: str) -> bool:
        return id_ in self._records

    def get(self, id_: str) -> EvidenceRecord:
        if id_ not in self._records:
            raise UnevidencedQuantity(f"no evidence record {id_}")
        return self._records[id_]

    def resolve(self, ids: list[str]) -> list[EvidenceRecord]:
        return [self.get(i) for i in ids]

    def ids(self) -> list[str]:
        return sorted(self._records)

    # -- rules -------------------------------------------------------------
    def check_citation(self, id_: str, role: str) -> None:
        """Raises if this record may not fill this role."""
        record = self.get(id_)
        dimensional = role in {"length", "width", "height", "depth",
                               "thickness", "area", "girth"}
        if dimensional and record.doc_id in self._unverified_sheets:
            # STATED never touched the scale; DERIVED is arithmetic on stated
            # levels and did not either. MEASURED and INFERRED did, or might.
            if record.origin not in (Origin.STATED, Origin.TRANSCRIBED, Origin.DERIVED):
                raise UnevidencedQuantity(
                    f"{id_} is from scale-unverified sheet {record.doc_id} "
                    f"and cannot fill role {role}")

    def weakest_origin(self, ids: list[str]) -> Origin:
        """A quantity is only as strong as its weakest input."""
        order = [Origin.STATED, Origin.TRANSCRIBED, Origin.DERIVED,
                 Origin.COUNTED, Origin.MEASURED, Origin.INFERRED]
        found = [self.get(i).origin for i in ids]
        return max(found, key=order.index) if found else Origin.INFERRED

    def composition(self) -> dict[str, int]:
        counts = {origin.value: 0 for origin in Origin}
        for record in self._records.values():
            counts[record.origin.value] += 1
        return counts

    # -- persistence -------------------------------------------------------
    def write(self, path: Path) -> None:
        payload = {"schema": "evidence/1", "records": [
            {"id": r.id, "value": str(r.value), "unit": r.unit,
             "doc_id": r.doc_id, "origin": r.origin.value,
             "region": None if r.region is None else r.region.__dict__}
            for r in (self._records[k] for k in sorted(self._records))]}
        Path(path).write_text(json.dumps(payload, indent=1, sort_keys=True))


def main() -> int:
    ap = argparse.ArgumentParser(description="Inspect an evidence base.")
    ap.add_argument("--base", required=True)
    ap.add_argument("--composition", action="store_true")
    args = ap.parse_args()
    data = json.loads(Path(args.base).read_text())
    counts: dict[str, int] = {}
    for row in data["records"]:
        counts[row["origin"]] = counts.get(row["origin"], 0) + 1
    total = sum(counts.values()) or 1
    for origin in sorted(counts):
        print(f"  {origin:<10} {counts[origin]:>6}  {counts[origin]/total:6.1%}")
    if counts.get("inferred", 0) / total > 0.1:
        print("\nmore than 10% inferred — investigate before issue",
              file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
