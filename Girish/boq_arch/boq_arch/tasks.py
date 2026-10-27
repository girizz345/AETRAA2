"""The visual readings: one prompt + JSON schema per kind of sheet.

A reading reports what is printed, cell by cell. It never totals, converts or
infers; code does that. Anything illegible comes back in `illegible`, which
becomes a named gap.
"""
from __future__ import annotations

from .vision import Task

_COMMON = (
    "You are reading a construction drawing for a quantity surveyor. Report only what is printed. "
    "Copy numbers and text exactly as printed. Do not total, convert, round or infer anything. "
    "If a value cannot be read with certainty, leave it out of the rows and list it under 'illegible' "
    "with where it is and why. The images are tiles of one sheet with a small overlap - an item that "
    "appears in two tiles is ONE item; report it once."
)

_ILLEGIBLE = {"type": "array", "items": {"type": "object", "additionalProperties": False,
              "required": ["where", "field", "reason"],
              "properties": {"where": {"type": "string"}, "field": {"type": "string"},
                             "reason": {"type": "string"}}}}

_BAY = {"type": "object", "additionalProperties": False, "required": ["from", "to", "mm"],
        "properties": {"from": {"type": "string"}, "to": {"type": "string"}, "mm": {"type": "integer"}}}

GRID_DIMS = Task(
    name="grid_dims", version="1",
    prompt=_COMMON + (
        "\n\nRead the structural grid dimension chains of this plan: the dimension strings between "
        "consecutive grid bubbles along the top (numbered grids) and down the side (lettered grids). "
        "For each bay give the two grid labels and the dimension in mm exactly as printed. Also give "
        "each overall dimension printed over the whole chain."),
    schema={"type": "object", "additionalProperties": False,
            "required": ["x_bays", "y_bays", "overall", "illegible"],
            "properties": {
                "x_bays": {"type": "array", "items": _BAY},
                "y_bays": {"type": "array", "items": _BAY},
                "overall": {"type": "array", "items": _BAY},
                "illegible": _ILLEGIBLE}},
    clips=[(0.03, 0.12, 0.76, 0.20), (0.04, 0.20, 0.13, 0.78)],
    dpi=150,
)

LEVELS = Task(
    name="levels", version="1",
    prompt=_COMMON + (
        "\n\nRead the storey level markers of the main section on this sheet: for each marker give the "
        "level name printed beside it (e.g. '2ND FLOOR LVL'), the level value exactly as printed in "
        "metres (e.g. +9.15) and the datum word after it (FFL, SSL, LVL, PARAPET ...). Also read the "
        "vertical dimension chain beside the markers, bottom to top, as the markers it runs between and "
        "the mm printed."),
    schema={"type": "object", "additionalProperties": False,
            "required": ["levels", "chain", "illegible"],
            "properties": {
                "levels": {"type": "array", "items": {
                    "type": "object", "additionalProperties": False,
                    "required": ["name", "value", "datum"],
                    "properties": {"name": {"type": "string"}, "value": {"type": "string"},
                                   "datum": {"type": "string"}}}},
                "chain": {"type": "array", "items": _BAY},
                "illegible": _ILLEGIBLE}},
    clips=[(0.0, 0.0, 0.34, 0.97)],
    grid=(1, 2),
    dpi=200,
)

TITLE_BLOCK = Task(
    name="title_block", version="3",
    prompt=_COMMON + (
        "\n\nThis is a drawing's title block (or, for a cover sheet, the whole sheet). Copy the fields printed "
        "in it. Leave a field empty if it is not printed; never take a value from anywhere else. "
        "Many offices print the drawing number large in a box of its own with no label (A1, A3, A17a, 05, "
        "A-101): that is the drawing_no, even when it looks like a paper size - a paper size is never printed "
        "that way. It is normal, so do not list it under 'illegible'. List under 'illegible' only the fields "
        "asked for here that you could not read - not logos, emblems, stamps or other text."),
    schema={"type": "object", "additionalProperties": False,
            "required": ["drawing_no", "drawing_title", "scale", "plot", "job_title", "owner", "illegible"],
            "properties": {k: {"type": "string"} for k in
                           ("drawing_no", "drawing_title", "scale", "plot", "job_title", "owner")}
            | {"illegible": _ILLEGIBLE}},
    dpi=200,
    crop="title_block",
)

_SCHED_ROW = {
    "type": "object", "additionalProperties": False,
    "required": ["mark", "type", "size", "shown_size", "location", "count", "description"],
    "properties": {
        "mark": {"type": "string", "description": "the schedule mark exactly as printed, e.g. D-1, W-3"},
        "type": {"type": "string", "description": "the TYPE cell"},
        "size": {"type": "string", "description": "the SIZE cell exactly as printed, e.g. 1200X2200"},
        "shown_size": {"type": "string", "description": "when SIZE says AS SHOWN: the overall dimensions printed on the card's elevation, width x height, e.g. '3750 x 3200'; an L-shaped unit gives both legs, '7300+2950 x 3200'; a height printed only in parts as '(800+2400)'; a sill height as 'sill 750'. Empty when SIZE gives the size"},
        "location": {"type": "string", "description": "the LOCATION cell"},
        "count": {"type": ["integer", "null"], "description": "the NO. cell as printed; null if the cell is empty"},
        "description": {"type": "string", "description": "the DESCRIPTION cell, all lines, joined with spaces"},
    }}

SCHEDULE = Task(
    name="schedule", version="2",
    prompt=_COMMON + (
        "\n\nThis sheet is a door or window schedule laid out as a grid of cards. Each card has a mark "
        "(e.g. D-1, SD-2, LD-1, W-1, DW-03) and cells TYPE, SIZE, LOCATION, NO. and DESCRIPTION, plus an "
        "elevation drawing. Return one row per card. Ignore the title block and the sheet notes except "
        "for 'sheet_notes', where you copy each general note printed on the sheet (outside the cards)."),
    schema={"type": "object", "additionalProperties": False,
            "required": ["rows", "sheet_notes", "illegible"],
            "properties": {"rows": {"type": "array", "items": _SCHED_ROW},
                           "sheet_notes": {"type": "array", "items": {"type": "string"}},
                           "illegible": _ILLEGIBLE}},
    clips=[(0.0, 0.0, 0.885, 0.97)],
    grid=(3, 2),
    dpi=220,
    crop="table",          # read off tight crops of the schedule table, not the whole sheet
)

ELEVATION_FINISHES = Task(
    name="elevation_finishes", version="1",
    prompt=_COMMON + (
        "\n\nThese are tiles of one building elevation. Software has found the coloured areas of the facade and "
        "labelled them in small white boxes: F1, F2 ... - one label stands for all the areas of one colour, and "
        "appears on a few of them. For each label, find the callout notes (text at the end of leader lines) whose "
        "leaders point into areas of that colour, and copy the finish they name, word for word as printed. "
        "Give 'kind': 'wall finish' for a finish or cladding on walls (brick cladding, paint, stone, render, "
        "aluminium cladding ...); 'glazing' when the areas are glass - windows, glazed doors, curtain walling or "
        "glass railings; 'other' for anything else; 'unknown' when no callout points into that colour. List every "
        "callout you used under 'callouts'. Report every label shown, even if unknown."),
    schema={"type": "object", "additionalProperties": False,
            "required": ["finishes", "illegible"],
            "properties": {
                "finishes": {"type": "array", "items": {
                    "type": "object", "additionalProperties": False,
                    "required": ["label", "finish", "kind", "callouts"],
                    "properties": {"label": {"type": "string"}, "finish": {"type": "string"},
                                   "kind": {"type": "string", "enum": ["wall finish", "glazing", "other", "unknown"]},
                                   "callouts": {"type": "array", "items": {"type": "string"}}}}},
                "illegible": _ILLEGIBLE}},
    dpi=220,    # clips and tiles are set per sheet (elevations.reading_task)
)

NOTES = Task(
    name="notes", version="1",
    prompt=_COMMON + (
        "\n\nThis is a detail / section sheet. List every specification note and build-up label printed "
        "on it (the text on leaders and in note boxes that says what something is made of, its thickness, "
        "height or treatment), and the detail it belongs to. Do not list room names, levels or drawing "
        "references. Keep each note's wording exactly as printed."),
    schema={"type": "object", "additionalProperties": False,
            "required": ["notes", "illegible"],
            "properties": {
                "notes": {"type": "array", "items": {
                    "type": "object", "additionalProperties": False,
                    "required": ["detail", "text"],
                    "properties": {"detail": {"type": "string"}, "text": {"type": "string"}}}},
                "illegible": _ILLEGIBLE}},
    clips=[(0.0, 0.0, 0.875, 0.97)],
    grid=(2, 2),
    dpi=200,
)
