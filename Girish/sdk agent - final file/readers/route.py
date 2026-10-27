#!/usr/bin/env python3
"""
route.py — what kind of sheet is this.

plan / section / elevation / detail / schedule / area-calc / legend.

Title keywords resolve most of it — "SCHEDULE OF DOORS-01" is not ambiguous —
and that path is deterministic and free. Only the residue goes to the model,
one small call, closed enum, no free text. The keyword table lives here rather
than in ingest because it is about the pipeline's own routing rather than about
the client's conventions.

Getting this wrong is cheap in one direction and expensive in the other: a
schedule routed as a plan is measured by counting symbols that are not there
and yields nothing, which is visible. A plan routed as a schedule produces
rows from a table that does not exist, which is not.

  python3 -m readers.route --title "SCHEDULE OF DOORS-01"

Exit 0 = resolved deterministically. Exit 1 = ambiguous, needs a model call.
"""
from __future__ import annotations

import argparse

KINDS = ("plan", "section", "elevation", "detail", "schedule", "area-calc", "legend",
         "general")
# "general": a sheet that is part of the set but is never measured from - the
# cover sheet, the list of drawings, perspectives and renders. Routing it as
# such is a decision; leaving it unrouted made every package carry these as
# gaps, one per sheet, although nothing is missing.

# checked in order; first hit wins, so the more specific phrases come first
KEYWORDS: tuple[tuple[str, str], ...] = (
    ("COVER SHEET", "general"),
    ("COVERSHEET", "general"),
    ("LIST OF DRAWINGS", "general"),
    ("DRAWING LIST", "general"),
    ("DRAWING INDEX", "general"),
    ("INDEX OF DRAWINGS", "general"),
    ("PERSPECTIVE", "general"),
    ("3D VIEW", "general"),
    ("RENDER", "general"),
    ("GENERAL NOTES", "general"),
    # engineers' calculation sheets are tables of loads, not of things to
    # build: an electrical load summary headed "... SCHEDULE" was read as a
    # schedule and its circuits billed (20 sheets on a 385-sheet package)
    ("LOAD SUMMARY", "general"),
    ("LOAD CALCULATION", "general"),
    ("LOAD SCHEDULE", "general"),
    ("LOADING SCHEDULE", "general"),
    ("PANEL SCHEDULE", "general"),
    ("SINGLE LINE DIAGRAM", "general"),
    ("SCHEDULE", "schedule"),
    ("AREA STATEMENT", "area-calc"),
    ("AREA CALCULATION", "area-calc"),
    ("LEGEND", "legend"),
    ("KEY PLAN", "plan"),
    ("SITE PLAN", "plan"),
    ("FLOOR PLAN", "plan"),
    ("LAYOUT", "plan"),
    ("PLAN", "plan"),
    ("SECTION", "section"),
    ("ELEVATION", "elevation"),
    ("DETAIL", "detail"),
)


def route_by_title(title: str | None) -> str | None:
    """Deterministic pass. None means ambiguous — hand it to the model."""
    if not title:
        return None
    upper = title.upper()
    for token, kind in KEYWORDS:
        if token in upper:
            return kind
    return None


def route(title: str | None, doc_id: str | None = None,
          heading: str | None = None) -> tuple:
    """(kind, basis). The basis is returned, not just the kind, because the
    sources are not equally strong and the run must say which it used.

    Three sources, in order of strength: the title block's title; the sheet's
    own HEADING — its largest words, "COLUMN SCHEDULE", "GROUND FLOOR PLAN" —
    which is the sheet naming itself where the title block did not (a
    69-sheet package whose every title read "Sheet" routed nothing without
    it); then the file name.

    The title block is the sheet's own statement and is tried first. The
    FILENAME is weaker — a consultant can rename a file — but it is still the
    consultant's own naming and it is evidence, not an assumption. Observed on
    the development package: the title block failed on 66 of 95 sheets, and
    seven of those are named "SCHEDULE OF DOORS -01" and the like. Routing them
    as nothing left seven real schedules unread, which is a worse error than
    trusting a filename and saying so.

    Nothing is inferred from a file's position or extension, and a disagreement
    between the two sources is reported rather than resolved — see
    disagreement()."""
    from spine.files import doc_name, is_set_page

    by_title = route_by_title(title)
    if by_title:
        return by_title, "title block"
    if is_set_page(doc_id):
        # a page cut from a set: the file name is the set's ("PLANS AND
        # SECTIONS.pdf" names all eighty), so only the page itself routes it
        by_heading = route_by_title(heading)
        return (by_heading, "sheet heading") if by_heading else (None, None)
    # a file NAMED as a cover sheet, drawing list or perspective is that,
    # whatever its largest words say: a cover sheet's heading lists the set's
    # contents ("... DETAILS ...") and routed the cover as a detail sheet
    if route_by_title(doc_name(doc_id)) == "general":
        return "general", "file name"
    by_heading = route_by_title(heading)
    if by_heading:
        return by_heading, "sheet heading"
    by_name = route_by_title(doc_name(doc_id))     # the name, not its folder
    if by_name:
        return by_name, "file name"
    return None, None


def disagreement(title: str | None, doc_id: str | None) -> str | None:
    """Where both sources resolve and they differ, say so. One of the two is
    wrong and which one it is cannot be decided from here."""
    from spine.files import doc_name, is_set_page

    if is_set_page(doc_id):
        return None                  # the set's name is not this sheet's
    by_title = route_by_title(title)
    by_name = route_by_title(doc_name(doc_id))
    if by_title and by_name and by_title != by_name:
        return (f"title block reads {by_title}, file name reads {by_name}")
    return None


def main() -> int:
    ap = argparse.ArgumentParser(description="Route a sheet by its title.")
    ap.add_argument("--title", required=True)
    args = ap.parse_args()
    kind = route_by_title(args.title)
    if kind is None:
        print(f"ambiguous — model call needed, enum: {', '.join(KINDS)}")
        return 1
    print(kind)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
