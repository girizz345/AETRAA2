#!/usr/bin/env python3
"""
prompts.py — the six judgements, and the words that ask for them.

Six, and no more. Every one asks for a label from a closed set or an identifier
that already exists, and every one states that a number in the response is a
failure. They are held together in one file so that adding a seventh judgement
is a visible act rather than a line buried in a stage.

The wording matters less than the shape, and the shape is the same six times:
here is one judgement, here is only the evidence for it, here is the closed set
of answers, return the label and nothing else.

Prompts are versioned. A prompt change invalidates the eval-set results
measured against the old one, so PROMPT_VERSION is bumped and the eval is
re-run — otherwise "the model got worse" and "we changed the question" are
indistinguishable.

  python3 -m model.prompts --judgement classification

Exit 0 = printed. Exit 1 = no such judgement.
"""
from __future__ import annotations

import argparse
import sys

PROMPT_VERSION = "3"     # v2: classification asks for the batched array shape
                         # v3: adds level_alias (S4 storey aliases)

_RULE = ("Return only the requested label or identifier. Do not return a "
         "quantity, dimension, rate or total. A numeric measurement in your "
         "response is a failure of the task.")

PROMPTS: dict[str, str] = {
    "sheet_kind": (
        "Classify each drawing sheet below by what it is. The title block "
        "could not settle it, so the sheet's own largest words are given.\n\n"
        "Sheets, one per line — doc_id | drawing number | title | subtitle | "
        "largest words on the sheet:\n{sheets}\n\n"
        "For each sheet answer with exactly one of: {enum}. Omit a sheet you "
        "cannot classify from its words; do not infer from the file name's "
        "position or extension.\n"
        "Reply with ONLY a JSON array, one object per sheet:\n"
        '[{{"doc_id": "<doc_id>", "kind": "<one of the set>", '
        '"basis": "<one line>"}}]\n' + _RULE),
    "column_mapping": (
        "This is one schedule sheet, given as a grid of cells "
        "(row index: column index = text).\n\n"
        "{grid}\n\n"
        "State which column index holds each of these roles: {roles}.\n"
        "Omit a role the schedule does not carry. State the header row index. "
        "The mark column is the one whose cells identify each scheduled item "
        "(D-01, W2, SD-03 ...).\n"
        "You are mapping columns once for the whole sheet; the rows are read "
        "by other means.\n"
        "Reply with ONLY this JSON, nothing before or after it:\n"
        '{{"items": [{{"doc_id": "{doc_id}", "header_row": <row index>, '
        '"columns": {{"<role>": <column index>}}}}]}}\n' + _RULE),
    "legend_entry": (
        "This is the legend block from one drawing sheet.\n\n{legend}\n\n"
        "For each symbol signature listed, give its name as the legend states "
        "it: {signatures}.\n"
        "Omit any signature the legend does not cover. Do not infer a name "
        "from the symbol's appearance.\n" + _RULE),
    "classification": (
        "For each element below, state which measurement clause governs it and "
        "which evidence record fills each role that clause requires.\n\n"
        "Elements:\n{elements}\n\n"
        "Available clauses: {clauses}\n"
        "Available evidence records: {evidence}\n\n"
        "Cite only clause identifiers and evidence identifiers from those "
        "lists. Name the clause that GOVERNS the element under POMI — the "
        "clause a surveyor would measure it under — even when the evidence "
        "listed cannot fill every role that clause requires; do not pick a "
        "different clause because its roles happen to be evidenced. The "
        "element's FORM comes from the schedule's own words: a beam, column, "
        "wall or slab scheduled with bar marks is in-situ reinforced concrete "
        "(measured by volume), never precast or proprietary unless the "
        "schedule says so. A formula role is a SLOT, not an attribute name: "
        "bind each role the clause needs to the one record of this element "
        "that fills it — a wall's stated thickness fills W and its storey "
        "height fills T in N x L x W x T; a column's storey height fills L. "
        "Use each record at most once; leave a role unbound where no record "
        "of this element fills it. If no listed clause governs an element, "
        "return null for its clause_id.\n"
        "Prefer the first limb of a clause unless the evidence states "
        "otherwise. Do not group by thickness; do not split an element that "
        "the schedule states as one.\n\n"
        "Reply with ONLY a JSON array, one object per element, exactly this "
        "shape:\n"
        '[{{"element_mark": "<mark>", "clause_id": "<id or null>", '
        '"bindings": {{"<role>": "<evidence_id>"}}, "basis": "<one line>"}}]\n'
        + _RULE),
    "description_block": (
        "Compose the bill description for this group of measured items, in the "
        "house pattern: one full description, then variants that inherit it.\n\n"
        "Group: {group}\nAttributes available: {attributes}\n"
        "Variants differ by: {varies_by}\n\n"
        "Every word must trace to an attribute listed above.\n" + _RULE),
    "schedule_subject": (
        "Each sheet below is a schedule whose title, heading and file name do "
        "not say what it schedules. Its heading words and its first table "
        "rows are given.\n\n"
        "Sheets — doc_id | heading words | header row | first rows:\n{sheets}\n\n"
        "For each sheet, state what the schedule schedules, as exactly one of: "
        "{enum}. Omit a sheet you cannot tell from its own words.\n"
        "Reply with ONLY a JSON array, one object per sheet:\n"
        '[{{"doc_id": "<doc_id>", "subject": "<one of the set>", '
        '"basis": "<one line>"}}]\n' + _RULE),
    "title_block": (
        "This text was read from the title block region of a drawing sheet.\n\n"
        "{text}\n\n"
        "Give the drawing number, title, revision, scale and subtitle where "
        "each is present. Omit any field the text does not state; do not infer "
        "one from the others or from the filename.\n" + _RULE),
    "level_name": (
        "A section or elevation sheet states structural levels as figures "
        "(metres above datum). Each figure below has no storey name on its "
        "own text line, but the words around it on the sheet — level labels, "
        "storey names, the drawing's own annotations — usually say which "
        "storey it is. Name each level's storey from those words.\n\n"
        "Levels, one per line — level_id | sheet | words near the figure, "
        "nearest first:\n{levels}\n\n"
        "Answer per level with a storey written EXACTLY as one of these forms: "
        "FOUNDATION, BASEMENT n, GROUND, PODIUM n, MEZZANINE, FLOOR n, ROOF, "
        "TOP OF ROOF, LIFT MACHINE ROOM. Omit a level you cannot name from "
        "the words given; never infer a storey from the figure's size or "
        "from its order among the others.\n"
        "Reply with ONLY a JSON array, one object per level:\n"
        '[{{"level_id": "<id>", "storey": "<storey>", "basis": "<the words '
        'that name it>"}}]\n' + _RULE),
    "level_alias": (
        "A schedule states each element's location in its own words. The "
        "drawings' level table names storeys in a canonical form. Match each "
        "location string below to the storey it names.\n\n"
        "Location strings, as written, one per line:\n{locations}\n\n"
        "Storeys in the level table: {enum}\n\n"
        "Answer with exactly one storey from that set per location. Omit a "
        "location that is not a storey at all (a room, a zone, a grid "
        "reference) and omit one you cannot match without guessing; do not "
        "invent a storey that is not in the set.\n"
        "Reply with ONLY a JSON array, one object per location:\n"
        '[{{"location": "<as written>", "storey": "<one of the set>"}}]\n'
        + _RULE),
}


def render(judgement: str, **kwargs) -> str:
    if judgement not in PROMPTS:
        raise KeyError(f"no prompt for judgement {judgement!r}")
    return PROMPTS[judgement].format(**kwargs)


def main() -> int:
    ap = argparse.ArgumentParser(description="Show a judgement's prompt.")
    ap.add_argument("--judgement")
    args = ap.parse_args()
    if not args.judgement:
        print(f"v{PROMPT_VERSION}: {', '.join(sorted(PROMPTS))}")
        return 0
    if args.judgement not in PROMPTS:
        print(f"no such judgement: {args.judgement}", file=sys.stderr)
        return 1
    print(PROMPTS[args.judgement])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
