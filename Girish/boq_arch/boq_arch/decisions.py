"""The project's decisions register: every measurement choice, stated once.

Defaults below; a `decisions.json` beside the drawings (or passed with
--decisions) overrides any key. Each choice is printed on the INDEX tab of the
take-off so a reviewer sees what was applied.
"""
from __future__ import annotations

import json
from pathlib import Path

DEFAULTS = {
    "bill_no": 1,
    "package": "ARCHITECTURAL WORKS",
    "currency": "AED",
    # GP3.2: no deduction from areas for voids < 1.00 m2
    "deduct_threshold_m2": 1.0,
    # wall pieces of these thicknesses are billed as blockwork; others are a gap
    "block_thicknesses_mm": [100, 150, 200],
    # a mark whose schedule count and plan count disagree: "leave_open" lists it with the quantity blank
    # and both counts in the gaps (never picks one); "bill_schedule" bills the schedule's NO. and flags it
    "open_count_policy": "leave_open",
    # null = read from the details (e.g. "15cm CONCRETE SLAB"); a number overrides
    "slab_thickness_mm": None,
    # rooms whose finishes follow the TYPICAL FLOOR FINISH detail
    "external_room_names": ["BALCONY", "TERRACE", "SERVICE ROOF", "ROOF DECK", "OUTDOOR CINEMA"],
    "wet_room_names": ["BATH", "TOI.", "TOILET", "TOILETS", "KITCHEN"],
    # the bill's summary page reference (house bills: S-1 ... on the grand summary)
    "summary_ref": "S-1",
    # sheet names in the bill workbook, as the issued bills
    "sheet_names": {"D": "Masonry", "E": "Metalwork", "F": "Woodwork", "G": "T&P", "H": "D & W",
                    "J": "Finishes", "K": "Accessories"},
    # "Note:" block under Doors, as the issued bills (edit to suit the project)
    "door_note_lines": [
        "a)  The rates for all doors shall include for all frames, sub-frames, architraves, transoms, stops, "
        "glazing, protective and decorative coatings, ironmongeries complete in accordance with the "
        "Specifications, Schedule and Drawings",
        "b)  Sizes referred to are structural opening sizes",
    ],
    "section_titles": {
        "D": "MASONRY WORK", "E": "METALWORK", "F": "WOODWORK", "G": "THERMAL & MOISTURE PROTECTION",
        "H": "DOORS AND WINDOWS", "J": "FINISHES", "K": "ACCESSORIES",
    },
}

EXPLAIN = {
    "deduct_threshold_m2": "Voids in measured areas deducted only when 1.00 m2 or more (POMI GP3.2); "
                           "voids at the edge of a measured area always deducted (GP3.3).",
    "block_thicknesses_mm": "Wall pieces of these thicknesses billed as blockwork; other thicknesses (cladding "
                            "lines, RC, unclassified) listed as gaps, not billed. Set them to the block "
                            "thicknesses the project's details state (the first test set's: 200/150 hollow, "
                            "150/100 solid).",
    "slab_thickness_mm": "Walls and wall finishes measured to storey height less slab thickness.",
    "open_count_policy": "Doors and windows are counted twice - schedule NO. and plan tags. Agreeing counts "
                         "close the item; disagreeing counts leave it OPEN (quantity blank, both counts in the "
                         "gaps) unless set to bill_schedule.",
}


def load(path: Path | None) -> dict:
    d = json.loads(json.dumps(DEFAULTS))
    if path and path.exists():
        user = json.loads(path.read_text(encoding="utf-8"))
        for k, v in user.items():
            if isinstance(v, dict) and isinstance(d.get(k), dict):
                d[k].update(v)
            else:
                d[k] = v
    return d
