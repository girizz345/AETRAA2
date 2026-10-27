#!/usr/bin/env python3
"""
intake.py — schedule rows into evidence records and elements.

The bridge from readers to measure, and the place where origin is fixed once and
for all. A figure read out of a schedule cell is STATED: the schedule says the
door is 1100 mm wide, so nothing is inferred and nothing is measured to scale.
That is why schedules are read first — they are the only source in a package
whose quantities are stated rather than derived.

Three things happen here and all three are the kind that go wrong silently:

  * dimensions are parsed through readers.dimensions, which REFUSES a qualified
    figure. "1100MM" is a dimension; "approx 1100" and "1100 TYP" are not, and
    they become gaps rather than numbers. The refusal is the point.
  * GP3.1 rounding happens on intake, inside EvidenceBase.make, and never again.
  * the count comes from the schedule's own QTY column where it has one, and
    otherwise from the number of rows carrying that mark. It is never assumed
    to be one: a schedule listing SD-01 on four rows is four doors, and a
    schedule stating QTY 12 against one row is twelve.

  python3 -m measure.intake --schedules schedules.json

Exit 0 = elements built. Exit 1 = rows refused (reported).
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from collections import OrderedDict
from decimal import Decimal
from pathlib import Path

from measure.evidence import EvidenceBase
from readers.dimensions import Refused, parse
from spine.gaps import Gap
from spine.records import Element, Origin

STAGE = "S9"

# what a schedule's own words say the thing is. The schedule NAMES its subject —
# "SCHEDULE OF DOORS" — so this is reading a stated label, not inferring a type
# from a description.
TITLE_TYPES: tuple = (
    ("DOOR", "door"),
    ("WINDOW", "window"),
    ("GLASS", "glazing"),
    ("GLAZING", "glazing"),
    ("CURTAIN WALL", "glazing"),
    ("ALUMINIUM", "glazing"),
    ("SKYLIGHT", "window"),
    ("SHUTTER", "door"),
    # finishes are scheduled by what they finish as often as by the word
    ("CEILING", "finish"),
    ("FLOORING", "finish"),
    ("TILING", "finish"),
    ("PAINT", "finish"),
    ("CLADDING", "finish"),
    ("FINISH", "finish"),
    ("SANITARY", "fixture"),
    ("FIXTURE", "fixture"),
    ("IRONMONGERY", "ironmongery"),
    ("LOUVRE", "louvre"),
    # structural schedules, named by what they schedule
    ("PILE CAP", "pile_cap"),
    ("PILE", "pile"),
    ("COLUMN", "column"),
    ("SHEAR WALL", "wall"),
    ("WALL", "wall"),
    ("BEAM", "beam"),
    ("SLAB", "slab"),
    ("FOOTING", "footing"),
    ("FOUNDATION", "footing"),
    ("LINTEL", "lintel"),
    ("STAIR", "stair"),
    ("REBAR", "reinforcement"),
    ("REINFORCEMENT", "reinforcement"),
    ("BAR BENDING", "reinforcement"),
    ("EQUIPMENT", "equipment"),
    ("FCU", "equipment"),
    ("PUMP", "equipment"),
    ("CHILLER", "equipment"),
    ("AIR HANDLING", "equipment"),
    ("LIGHT", "fixture"),
    ("LUMINAIRE", "fixture"),
)

# the closed set the model may answer from when the words do not settle it
ELEMENT_TYPES: tuple = tuple(sorted({kind for _t, kind in TITLE_TYPES}))

DIMENSION_ROLES = ("width", "height", "thickness", "depth", "length", "diameter")


def element_type_of(doc_id: str, title: str | None = None,
                    heading: str | None = None) -> str | None:
    """From the sheet's own words: its title-block title, its file name, and
    the heading the sheet carries above the table (its largest words —
    "COLUMN SCHEDULE", "PILE SCHEDULE"). None means the schedule does not say
    what it schedules, which is a gap — guessing from the column headings
    would be inferring the subject from its attributes.

    Longest phrase wins ("PILE CAP" before "PILE", "SHEAR WALL" before
    "WALL"), and the title is tried before the heading before the name, so a
    sheet titled "DOOR SCHEDULE" whose notes mention a wall is a door
    schedule."""
    from spine.files import doc_name

    ordered = sorted(TITLE_TYPES, key=lambda t: -len(t[0]))
    for text in (title, heading, doc_name(doc_id)):
        hay = " ".join((text or "").upper().split())
        found = []
        for token, kind in ordered:
            if token in hay and kind not in found:
                found.append(kind)
        if not found:
            continue
        # "COLUMNS REINFORCEMENT SCHEDULE" schedules columns; the reinforcement
        # is the attribute it tabulates. The ELEMENT wins over its attribute
        # whenever the words name both; a bar-bending schedule names no element
        # and stays reinforcement.
        if len(found) > 1 and "reinforcement" in found:
            found.remove("reinforcement")
        return found[0]
    return None


def count_of(rows: list) -> int | None:
    """The schedule's own count where it states one, else the number of rows.

    Returns None if a stated count cannot be parsed — never 1. A default of 1
    against a row that says "12" understates the bill by eleven doors and looks
    exactly like a correct answer."""
    stated = [r.values.get("count") for r in rows if r.values.get("count")]
    if not stated:
        return len(rows)
    total = 0
    for text in stated:
        digits = "".join(ch for ch in str(text) if ch.isdigit())
        if not digits:
            return None
        total += int(digits)
    return total or None


REGISTER_WORDS = ("LIST OF DRAWINGS", "DRAWING LIST", "DRAWING INDEX",
                  "DRAWINGS INCLUDED", "NO. OF DRAWINGS", "SHEET INDEX",
                  "SHEET LIST", "INDEX OF DRAWINGS")


def is_drawing_register(sheet: dict) -> bool:
    """A table whose heading says it lists drawings, or whose marks are
    drawing numbers (most rows carrying the package's own sheet-number
    shape, e.g. S-001, A-102), is the drawing register — not a schedule."""
    words = " ".join(str(sheet.get(k) or "") for k in ("title", "heading")).upper()
    if any(w in words for w in REGISTER_WORDS):
        return True
    rows = sheet.get("rows") or []
    if len(rows) >= 5:
        import re as _re
        shape = _re.compile(r"^[A-Z]{1,3}-\d{3}[A-Z]?$")
        hits = sum(1 for r in rows if shape.match(str(r.get("mark") or "").upper()))
        return hits * 2 > len(rows)
    return False


def _dimension_signature(rows) -> tuple:
    """The stated sizes a row group carries, per sheet — what decides whether
    two sheets describe one element or two."""
    return tuple(sorted({(role, " ".join(str(r.values.get(role)).split()))
                         for r in rows for role in DIMENSION_ROLES
                         if r.values.get(role)}))


def _split_conflicting(grouped, gaps) -> "OrderedDict":
    out: "OrderedDict[tuple, dict]" = OrderedDict()
    for (kind, mark, location), entry in grouped.items():
        by_sheet: dict = {}
        for row in entry["rows"]:
            by_sheet.setdefault(getattr(row, "doc_id", None) or entry["sheets"][0],
                                []).append(row)
        if len(by_sheet) < 2:
            out[(kind, mark, location)] = entry
            continue
        sigs = {d: _dimension_signature(rows) for d, rows in by_sheet.items()}
        if len(set(sigs.values())) < 2:
            out[(kind, mark, location)] = entry
            continue
        stated = "; ".join(f"{d.rsplit('/', 1)[-1]}: " + ", ".join(f"{r}={v}" for r, v in s)
                           for d, s in sorted(sigs.items()))
        gaps.append(Gap(stage=STAGE, doc_id=entry["sheets"][0], subject=mark,
                        reason=f"{kind} {mark} is stated with different sizes on "
                               f"{len(by_sheet)} schedule sheets — measured as "
                               f"{len(by_sheet)} elements, one per sheet",
                        detail=stated[:300]))
        for d, rows in by_sheet.items():
            where = (location + " / " if location else "") + d.rsplit("/", 1)[-1].replace(".pdf", "")
            out[(kind, mark, where)] = {"rows": rows, "sheets": [d]}
    return out


def _has_location_role(sheet: dict) -> bool:
    """Whether this schedule carries a location column. Stage 6 records the
    mapped roles on the sheet; a sheet built without that list (a test, an
    older schedules.json) is judged by its rows instead."""
    roles = sheet.get("roles")
    if roles is not None:
        return "location" in roles
    return any(
        (row.get("values") if isinstance(row.get("values"), dict) else row)
        .get("location") for row in sheet.get("rows", []))


def build(schedules: list, base: EvidenceBase | None = None,
          split_by_location: bool = True) -> tuple[EvidenceBase, list, list]:
    """(evidence base, elements, gaps).

    `schedules` is what stage 6 wrote: one entry per sheet, each carrying its
    rows. Elements are keyed by (element_type, mark) so the same mark on two
    sheets of one schedule is one element measured once, with both sheets
    recorded.

    When a schedule carries a location column and `split_by_location` is on,
    the key is (element_type, mark, location): a column schedule lists C1 at
    "Pod 1" and again at "1st floor", and those are different columns with
    different storey heights, not one column counted twice. The mark stays
    the mark as written and Element.location carries the storey, so a take-off
    line still reads "C1" with its level beside it. Evidence ids for a split
    element carry the location, because ids must be unique and the same mark
    now has one count per storey. Elements without a location are unchanged."""
    base = base or EvidenceBase()
    gaps: list[Gap] = []
    refused: dict = {}            # (doc_id, role, reason head) -> [(mark, raw)]
    grouped: "OrderedDict[tuple, dict]" = OrderedDict()
    origin_of: dict = {}          # doc_id -> STATED or TRANSCRIBED

    for sheet in schedules:
        doc_id = sheet["doc_id"]
        if is_drawing_register(sheet):
            # a drawing list is a table of drawing numbers, not of elements:
            # read as a "column schedule" on a real package it put S-001,
            # S-002 … into the bill as columns
            gaps.append(Gap(stage=STAGE, doc_id=doc_id,
                            subject=sheet.get("drawing_no") or doc_id,
                            reason="a drawing list, not a schedule of elements — "
                                   "not measured",
                            detail=(sheet.get("heading") or "")[:120]))
            continue
        kind = (sheet.get("subject")                       # settled upstream
                or element_type_of(doc_id, sheet.get("title"), sheet.get("heading")))
        if kind is None:
            gaps.append(Gap(stage=STAGE, doc_id=doc_id,
                            subject=sheet.get("drawing_no") or doc_id,
                            reason="the schedule does not say what it schedules, so "
                                   "nothing on it is billed - its heading reads "
                                   f"\"{' '.join(str(sheet.get('heading') or sheet.get('title') or '(none)').split())[:80]}\"",
                            detail="read from its title, heading and file name, then "
                                   "(with the model) its first rows; guessing from "
                                   "the column headings would infer the subject from "
                                   "its attributes. Run with the model available, "
                                   "or measure it by hand"))
            continue
        origin_of[doc_id] = (Origin.TRANSCRIBED if sheet.get("origin") == "transcribed"
                             else Origin.STATED)
        located = split_by_location and _has_location_role(sheet)
        for row in sheet.get("rows", []):
            parsed = _Row(row, doc_id)
            _split_size(parsed.values, kind)
            location = None
            if located:
                location = " ".join(str(parsed.values.get("location") or "")
                                    .split()) or None
            key = (kind, row["mark"], location)
            entry = grouped.setdefault(key, {"rows": [], "sheets": []})
            entry["rows"].append(parsed)
            if doc_id not in entry["sheets"]:
                entry["sheets"].append(doc_id)

    # The same mark on two schedule sheets with DIFFERENT stated sizes is two
    # elements, not one: B1A is 500 x 600 on one beam schedule and 500 x 1400
    # on the next (different floors, same numbering). Merged, the first sheet
    # won silently. Split by sheet, and say so.
    grouped = _split_conflicting(grouped, gaps)

    elements = []
    for (kind, mark, location), entry in grouped.items():
        rows = entry["rows"]
        doc_id = entry["sheets"][0]
        ids: list[str] = []
        dims: dict = {}
        # ids as today for an unlocated element; a located one is one of
        # several with this mark and its ids say which
        stem = f"{kind}:{mark}" if location is None else f"{kind}:{mark}:{location}"

        count = count_of(rows)
        if count is None:
            gaps.append(Gap(stage=STAGE, doc_id=doc_id, subject=mark,
                            reason="the schedule states a count that cannot be "
                                   "read",
                            detail="not defaulted to 1 — a default here "
                                   "understates the bill and looks correct"))
            continue
        count_id = f"{stem}:count"
        # a figure carried by a transcribed sheet is TRANSCRIBED; the weaker
        # origin wins where one mark is scheduled on both kinds of sheet
        origin = (Origin.TRANSCRIBED if any(origin_of.get(d) is Origin.TRANSCRIBED
                                            for d in entry["sheets"]) else Origin.STATED)
        base.make(count_id, count, "nr", doc_id, None, origin,
                  role="count")
        dims["count"] = count_id
        ids.append(count_id)

        for role in DIMENSION_ROLES:
            raw = next((r.values.get(role) for r in rows
                        if r.values.get(role)), None)
            if raw is None:
                continue
            try:
                values = parse(str(raw))
            except Refused as exc:
                # one gap per (sheet, role), counted — a bar-diameter column
                # mapped as a dimension refuses on every one of 56 rows, and
                # 56 identical lines bury the gaps a surveyor must read
                import re as _re
                if _re.fullmatch(r"\d{2,5}(?:\+\d{2,5})+", str(raw).replace(" ", "")):
                    # an L-shaped unit's two legs, or a height in two parts:
                    # two stated figures, not one dimension - never added up
                    key = (doc_id, "size", "composite")
                else:
                    key = (doc_id, role, str(exc).split(":")[0])
                refused.setdefault(key, []).append((mark, str(raw)))
                continue
            record_id = f"{stem}:{role}"
            base.make(record_id, values[0], "m", doc_id, None, origin,
                      role=role)
            dims[role] = record_id
            ids.append(record_id)

        elements.append(Element(mark=mark, element_type=kind, dims=dims,
                                count=count, sheets=tuple(entry["sheets"]),
                                evidence_ids=tuple(ids), multiplier=1,
                                location=location))
    for (doc_id, role, head), rows_refused in sorted(refused.items()):
        sample = ", ".join(f"{m}={v!r}" for m, v in rows_refused[:3])
        if head == "composite":
            marks = sorted({m for m, _v in rows_refused})
            gaps.append(Gap(stage=STAGE, doc_id=doc_id, subject="stated sizes in parts",
                            reason=f"{len(marks)} unit(s) are sized in parts - an L-shaped "
                                   f"unit's legs or a height in two parts ({', '.join(marks)}); "
                                   f"no single width or height is taken from them",
                            detail=f"e.g. {sample}" + (" …" if len(rows_refused) > 3 else "")
                                   + " — the items are enumerated and their descriptions "
                                     "state the size as printed; confirm the parts"))
            continue
        gaps.append(Gap(stage=STAGE, doc_id=doc_id, subject=f"{role} column",
                        reason=f"{role} not a dimension on {len(rows_refused)} "
                               f"row(s): {head}",
                        detail=f"e.g. {sample}" + (" …" if len(rows_refused) > 3 else "")
                               + " — the column mapped to this role does not hold "
                                 "dimensions; the rows keep their other roles"))
    return base, elements, gaps


OPENING_KINDS = ("door", "window", "glazing", "louvre")


def _split_size(values: dict, kind: str | None) -> None:
    """A SIZE column, as the kind of thing scheduled reads it. On a door or
    window schedule "900 x 2100" is width x height (and "7300+2950 x 3200" an
    L-shaped unit's legs, kept joined). A single figure is a diameter - a pile
    or a pipe. Anything else stays under "size", as printed: a column's
    "300 x 600" is breadth x depth, and which is which is the schedule's to
    say, not this function's to guess."""
    raw = values.get("size")
    if not raw:
        return
    from readers.transcribe import _size
    text = str(raw)
    if kind in OPENING_KINDS and not (values.get("width") or values.get("height")):
        width, height, sill = _size(text)
        if width is not None:
            values["width"], values["height"] = width, height
            if sill and not values.get("sill"):
                values["sill"] = sill
            return
    if not values.get("diameter") and re.fullmatch(r"\s*(?:Ø|DIA\.?)?\s*\d{2,4}\s*(?:MM)?\s*",
                                                   text, re.IGNORECASE):
        values["diameter"] = re.sub(r"\D", "", text)


class _Row:
    """The rows arrive as dicts from schedules.json or as ScheduleRow objects
    from stage 6 in the same process. One shape inside this module."""

    __slots__ = ("mark", "values", "doc_id")

    def __init__(self, row, doc_id=None):
        self.doc_id = doc_id
        if isinstance(row, dict):
            self.mark = row.get("mark")
            self.values = {k: v for k, v in row.items() if k != "mark"}
            if isinstance(row.get("values"), dict):
                self.values = dict(row["values"])
        else:
            self.mark = row.mark
            self.values = dict(row.values)
            self.doc_id = doc_id or getattr(row, "doc_id", None)


def main() -> int:
    ap = argparse.ArgumentParser(description="Schedule rows to elements.")
    ap.add_argument("--schedules", required=True)
    args = ap.parse_args()
    data = json.loads(Path(args.schedules).read_text())
    sheets = [s for s in data.get("schedules", []) if s.get("rows")]
    base, elements, gaps = build(sheets)
    for element in elements:
        print(f"  {element.element_type:<10} {element.mark:<10} "
              f"count {element.count:<4} roles "
              f"{', '.join(sorted(element.dims))}")
    print(f"\n{len(elements)} elements, {len(base)} evidence records, "
          f"{len(gaps)} gaps")
    for gap in gaps:
        print(f"  GAP {gap.subject}: {gap.reason}", file=sys.stderr)
    return 1 if gaps else 0


if __name__ == "__main__":
    raise SystemExit(main())
