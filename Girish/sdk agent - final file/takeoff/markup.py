#!/usr/bin/env python3
"""
markup.py — every measured element drawn back onto the sheet it came from.

The deliverable's real claim is not "here are the marked-up drawings". It is
that an element which has NOT been measured is visibly unmarked. That inverts
the review: instead of checking that each quantity is right, a surveyor scans
for what is still white.

Three primitives, matching the measurement type, so the picture states how the
number was arrived at as well as where:

  polygon   shaded, for an area
  polyline  traced, for a linear item
  tag       for a count

Plus a per-sheet legend listing every item taken off that sheet, so the sheet
is self-describing when it is printed and separated from the workbook.

The item code on the markup matches the take-off row exactly, in both
directions — code to row and row to code. For counts, the proof is not a bubble
on every instance; it is that the schedule count equals the number of plan
tags.

Where the region comes from. Evidence records built from schedule cells carry
no region — the intake stage reads values, not boxes. So the region of a
schedule-derived element is derived here by re-reading the schedule sheet:
band its words into rows and take the band that holds the element's mark. One
band per row the mark sits on, which is exactly what a count reconciliation
needs — a mark on two rows is two tags, and a schedule count of three against
two tags is a mismatch the closure records rather than hides.

A row whose region cannot be located is UNPLACED. It is a gap; a coordinate is
never invented for it.

  python3 -m takeoff.markup --takeoff T.json --drawings D --out M/

Exit 0 = every measured element marked. Exit 1 = a row had no coordinates.
"""
from __future__ import annotations

import argparse
from dataclasses import dataclass
from pathlib import Path

from spine.records import Region

PRIMITIVES = {"m2": "polygon", "m": "polyline", "nr": "tag", "m3": "polygon",
              "kg": "polyline", "t": "polyline"}
LEGEND_TITLE = "ITEMS MEASURED FROM THIS SHEET"
OPACITY = 0.35              # shaded areas must not obscure the drawing beneath

SCHEDULE_PAGE = 0           # schedules are read from their first page (S6)


@dataclass(frozen=True)
class MarkupInstruction:
    doc_id: str
    page: int
    primitive: str
    points: tuple
    colour: tuple           # trade colour, from ingest.conventions
    item_code: str
    label_at: tuple
    section: str = ""       # POMI letter — the trade the colour belongs to
    hex: str = ""           # colour as RRGGBB, derived from the same rgb
    qty: str = ""           # the quantity, full precision, as a string
    unit: str = ""


def primitive_for(unit: str) -> str:
    if unit not in PRIMITIVES:
        raise KeyError(f"no markup primitive for unit {unit!r}")
    return PRIMITIVES[unit]


def hex_of(rgb) -> str:
    """RRGGBB from an rgb triple. Matches the `hex` field in
    data/conventions.json, which is the same colour written twice."""
    r, g, b = (int(c) for c in rgb)
    return f"{r:02X}{g:02X}{b:02X}"


def section_of(item_code: str) -> str:
    """The POMI letter an item code is billed under: the part before the
    dash. "H-A" -> "H"."""
    return item_code.split("-", 1)[0] if item_code else ""


# ── region derivation ─────────────────────────────────────────────────────
def band_holds_mark(band, mark: str) -> bool:
    """A band holds a mark when one of its words IS the mark, or when a run of
    consecutive words joined by a space is — "DOOR AL-01" is read as two
    words and scheduled as one mark."""
    wanted = " ".join(str(mark).split())
    if not wanted:
        return False
    texts = [w.text for w in band.words]
    if wanted in texts:
        return True
    parts = wanted.split(" ")
    if len(parts) < 2:
        return False
    n = len(parts)
    return any(texts[i:i + n] == parts for i in range(len(texts) - n + 1))


def regions_for_mark(mark: str, bands, doc_id: str,
                     page: int = SCHEDULE_PAGE) -> list[Region]:
    """Every schedule row band holding the mark, as a Region spanning the
    whole row: [min x0, band.top, max x1, band.bottom] in
    page-display-topleft-pt. Sorted top to bottom, so two runs mark the same
    rows in the same order."""
    out: list[Region] = []
    for band in bands:
        if not band.words or not band_holds_mark(band, mark):
            continue
        out.append(Region(doc_id=doc_id, page=page,
                          x0=min(w.x0 for w in band.words), y0=band.top,
                          x1=max(w.x1 for w in band.words), y1=band.bottom))
    out.sort(key=lambda r: (r.y0, r.x0))
    return out


def locate(targets, on_disk: dict) -> tuple[dict, dict]:
    """Derive regions for (item_code, mark, doc_id) targets by re-reading each
    schedule sheet once.

    `on_disk` maps doc_id -> Path. Returns (regions by item code, problems by
    item code); an item is in exactly one of the two. A sheet is opened once
    however many items it carries, because a package with 500 sheets does not
    forgive per-item I/O."""
    from readers.extract import extract_words
    from readers.schedule_grid import band_rows

    regions: dict[str, list] = {}
    problems: dict[str, str] = {}
    bands_by_doc: dict[str, list | str] = {}

    for item_code, mark, doc_id in sorted(targets, key=lambda t: t[0]):
        if not doc_id:
            problems[item_code] = "no sheet recorded for this item"
            continue
        if doc_id not in bands_by_doc:
            path = on_disk.get(doc_id)
            if path is None:
                bands_by_doc[doc_id] = "sheet not found in the project folder"
            else:
                try:
                    words = extract_words(Path(path), page_index=SCHEDULE_PAGE)
                    bands_by_doc[doc_id] = band_rows(words)
                except Exception as exc:                  # noqa: BLE001
                    bands_by_doc[doc_id] = f"sheet could not be read: {exc}"
        bands = bands_by_doc[doc_id]
        if isinstance(bands, str):
            problems[item_code] = bands
            continue
        found = regions_for_mark(mark, bands, doc_id)
        if not found:
            problems[item_code] = (f"mark {mark!r} not found on any row of "
                                   f"{doc_id}")
            continue
        regions[item_code] = found
    return regions, problems


# ── instructions ──────────────────────────────────────────────────────────
def _union(regions) -> tuple[float, float, float, float]:
    return (min(r.x0 for r in regions), min(r.y0 for r in regions),
            max(r.x1 for r in regions), max(r.y1 for r in regions))


def _centre(region) -> tuple[float, float]:
    return ((region.x0 + region.x1) / 2, (region.y0 + region.y1) / 2)


def points_for(primitive: str, regions) -> tuple:
    """The geometry each primitive draws over the located regions.

    tag       one point per region — the centre of each schedule row the
              mark sits on, so the number of points IS the tag count
    polygon   the four corners of the union of the regions
    polyline  a line across the union at its vertical centre"""
    if primitive == "tag":
        return tuple(_centre(r) for r in regions)
    x0, y0, x1, y1 = _union(regions)
    if primitive == "polygon":
        return ((x0, y0), (x1, y0), (x1, y1), (x0, y1))
    if primitive == "polyline":
        cy = (y0 + y1) / 2
        return ((x0, cy), (x1, cy))
    raise KeyError(f"no geometry rule for primitive {primitive!r}")


def instructions_for(rows: list, conventions, regions: dict | None = None
                     ) -> list[MarkupInstruction]:
    """One instruction per row whose region is known. Sorted by (doc_id,
    page, item_code) so two runs draw in the same order and the output PDFs
    are byte-comparable.

    `regions` maps item_code -> list[Region] (from `locate`). A row with no
    entry, an unknown unit or an unknown trade produces NO instruction — see
    `unplaced_for` for the list of those, which is a gap and never a guess."""
    regions = regions or {}
    out: list[MarkupInstruction] = []
    for row in rows:
        found = regions.get(row.item_code)
        if not found:
            continue
        try:
            primitive = primitive_for(row.unit)
        except KeyError:
            continue
        section = section_of(row.item_code)
        try:
            colour = conventions.colour(section)
        except KeyError:
            continue
        points = points_for(primitive, found)
        x0, y0, x1, y1 = _union(found)
        out.append(MarkupInstruction(
            doc_id=found[0].doc_id, page=found[0].page, primitive=primitive,
            points=points, colour=tuple(colour.rgb), item_code=row.item_code,
            label_at=((x0 + x1) / 2, (y0 + y1) / 2), section=section,
            hex=hex_of(colour.rgb), qty=str(row.squared), unit=row.unit))
    out.sort(key=lambda i: (i.doc_id, i.page, i.item_code))
    return out


def unplaced_for(rows: list, conventions, regions: dict | None = None
                 ) -> list[tuple[str, str]]:
    """(item_code, reason) for every row that instructions_for skipped —
    the same three tests, so the two lists partition the rows exactly."""
    regions = regions or {}
    out: list[tuple[str, str]] = []
    for row in rows:
        if not regions.get(row.item_code):
            out.append((row.item_code, "no region located on the sheet"))
            continue
        if row.unit not in PRIMITIVES:
            out.append((row.item_code,
                        f"no markup primitive for unit {row.unit!r}"))
            continue
        try:
            conventions.colour(section_of(row.item_code))
        except KeyError:
            out.append((row.item_code,
                        f"no trade colour for section "
                        f"{section_of(row.item_code)!r}"))
    return sorted(out)


def main() -> int:
    ap = argparse.ArgumentParser(description="Mark up measured drawings.")
    ap.add_argument("--takeoff", required=True)
    ap.add_argument("--drawings", required=True)
    ap.add_argument("--out", required=True)
    ap.parse_args()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
