#!/usr/bin/env python3
"""
plan_lengths.py — a length measured between grid lines on a calibrated plan.

The schedules of a structural package state count, width and thickness of a
beam or wall and never its length. Its length is on the plan: the tag "B1"
sits on the member, and the member runs from one grid line to the next. With
the sheet calibrated (measure.grid), the distance between the two grid lines
either side of the tag is a length in millimetres, and nothing about it is
guessed — the grid lines are labelled by the draughtsman and the scale was
verified against a dimension chain.

Two things are refused rather than approximated:

  * a plan that is not CALIBRATED yields no length. PARTIAL is a scale read
    from a title block and never verified; measuring to it would put a number
    in a cell that looks exactly like a measured one.
  * a tag with no grid line on one side is not measured to the page edge.

Every occurrence of a tag is one sub-element of count 1 with its own bay, so
a beam scheduled once but drawn at four bays yields four measured lengths and
a gap saying the schedule count and the plan count differ. The difference is
REPORTED, never reconciled here — inventory owns that question.

Coordinates are page-display-topleft-pt throughout (spine.records.FRAME).
"""
from __future__ import annotations

from dataclasses import fields, replace
from decimal import Decimal

from spine.gaps import Gap
from spine.records import Element, Origin, Region, Word

STAGE = "S9"

# element types whose length is a run along a plan between grid lines
PLAN_LENGTH_TYPES = ("beam", "wall", "lintel", "kerb", "strip_footing")

# punctuation a tag may carry in the text layer without changing the mark
_TRIM = "(),;:.[]"
# consecutive words join into one mark only when the gap between them is
# small against the text height — "B" then "1" a whole word-width apart is
# two labels, not one
_JOIN_GAP = 1.0
_JOIN_MAX_WORDS = 4


# ── locating a mark on a sheet ────────────────────────────────────────────
def _norm(text: str) -> str:
    """Case-folded, spaces removed, wrapping punctuation dropped."""
    return "".join(str(text).upper().split()).strip(_TRIM)


def _index(words: list[Word]) -> dict:
    """The per-sheet lookup built once: normalised text -> words, plus the
    words in index order for the join walk. A 5,000-word plan searched for
    seventy marks is 350,000 comparisons done naively; with this it is
    seventy dictionary reads."""
    by_text: dict[str, list[Word]] = {}
    for w in words:
        key = _norm(w.text)
        if key:
            by_text.setdefault(key, []).append(w)
    ordered = sorted(words, key=lambda w: w.index)
    return {"by_text": by_text, "ordered": ordered,
            "position": {w.index: i for i, w in enumerate(ordered)}}


def _adjacent(a: Word, b: Word) -> bool:
    """b continues a: same band and a small gap along the run, in either
    orientation (a rotated tag is a tall narrow box stacked the other way)."""
    ah, bh = a.y1 - a.y0, b.y1 - b.y0
    aw, bw = a.x1 - a.x0, b.x1 - b.x0
    # horizontal run: vertical overlap and a small horizontal gap
    v_overlap = min(a.y1, b.y1) - max(a.y0, b.y0)
    if v_overlap > 0.5 * min(ah, bh) and 0 <= b.x0 - a.x1 <= _JOIN_GAP * max(ah, bh):
        return True
    # vertical run: horizontal overlap and a small vertical gap
    h_overlap = min(a.x1, b.x1) - max(a.x0, b.x0)
    if h_overlap > 0.5 * min(aw, bw) and 0 <= b.y0 - a.y1 <= _JOIN_GAP * max(aw, bw):
        return True
    return False


def _region(ws: list[Word]) -> Region:
    return Region(doc_id=ws[0].doc_id, page=ws[0].page,
                  x0=min(w.x0 for w in ws), y0=min(w.y0 for w in ws),
                  x1=max(w.x1 for w in ws), y1=max(w.y1 for w in ws))


def _locate(mark: str, index: dict) -> list[Region]:
    target = _norm(mark)
    if not target:
        return []
    found: list[Region] = []
    taken: set[int] = set()
    for w in index["by_text"].get(target, []):
        found.append(_region([w]))
        taken.add(w.index)
    # consecutive words that join to the mark: start at any word that is a
    # proper prefix of it and walk forward while the join stays a prefix
    ordered = index["ordered"]
    for start, w in enumerate(ordered):
        head = _norm(w.text)
        if not head or head == target or not target.startswith(head):
            continue
        if w.index in taken:
            continue
        run, joined = [w], head
        for k, nxt in enumerate(ordered[start + 1: start + _JOIN_MAX_WORDS]):
            piece = _norm(nxt.text)
            if not piece or not _adjacent(run[-1], nxt):
                break
            joined += piece
            if not target.startswith(joined):
                break
            run.append(nxt)
            if joined == target:
                # "B" "1" "0" is B10, not B1 with a stray digit: a run that
                # continues into another adjacent alphanumeric word is a
                # longer mark and is not this one
                after = ordered[start + 2 + k: start + 3 + k]
                continues = (after and _norm(after[0].text).isalnum()
                             and _adjacent(nxt, after[0]))
                if not continues and not any(r.index in taken for r in run):
                    found.append(_region(run))
                    taken.update(r.index for r in run)
                break
    found.sort(key=lambda r: (r.y0, r.x0))
    return found


def locate_marks(mark: str, words: list[Word]) -> list[Region]:
    """Every occurrence of `mark` on a sheet: a word equal to it, or
    consecutive words that join to it ("B 1" -> "B1"), case-insensitive.
    Each occurrence is the tag's own box, in FRAME."""
    return _locate(mark, _index(list(words or [])))


# ── the grid, through measure.grid or the contract's own fields ──────────
def _status(gm) -> str:
    return str(getattr(gm, "status", "NONE") or "NONE")


def _grid_api():
    """measure.grid's own functions where the module exists. The fallbacks
    read the GridMap fields the S4 contract fixes, so this module and its
    tests stand while the grid module is being built alongside it."""
    try:
        from measure import grid
        return (grid.gridline_positions, grid.bay_of, grid.verified)
    except (ImportError, AttributeError):
        pass

    def positions(gm, page_axis):
        along_x = getattr(gm, "letters_axis", None) == "X"
        if getattr(gm, "letters_axis", None) is None:
            return []
        seq = gm.letters if (page_axis == "X") == along_x else gm.numbers
        return sorted(((str(l), float(p)) for l, p in seq), key=lambda t: t[1])

    def bay_of(gm, x, y):
        if _status(gm) == "NONE" or getattr(gm, "letters_axis", None) is None:
            return None
        xs, ys = positions(gm, "X"), positions(gm, "Y")
        lx = [l for l, p in xs if p <= x]
        ly = [l for l, p in ys if p <= y]
        if not lx or not ly or not xs or not ys:
            return None
        if x > xs[-1][1] or y > ys[-1][1]:
            return None
        letters_x = gm.letters_axis == "X"
        letter, number = (lx[-1], ly[-1]) if letters_x else (ly[-1], lx[-1])
        return f"{letter}/{number}"

    def verified(gm):
        return _status(gm) == "CALIBRATED"

    return positions, bay_of, verified


def _bracket(positions: list, c: float):
    """The nearest grid line at or before c and the nearest at or after it,
    as (label, pos) pairs; None on a side with no line."""
    lo = hi = None
    for label, pos in positions:
        if pos <= c and (lo is None or pos > lo[1]):
            lo = (label, pos)
        if pos >= c and (hi is None or pos < hi[1]):
            hi = (label, pos)
    return lo, hi


# ── elements ──────────────────────────────────────────────────────────────
_ELEMENT_FIELDS = {f.name for f in fields(Element)}


def _clone(element: Element, **changes) -> Element:
    """replace() restricted to the fields this Element has — `location` and
    `bay` arrive with the records change and are dropped, not fatal, before
    it lands."""
    return replace(element, **{k: v for k, v in changes.items()
                               if k in _ELEMENT_FIELDS})


def _unique(base, seen: dict, stem: str, roles: tuple) -> dict:
    """{role: f"{type}:{mark}:{bay}:{role}"} for every role at once, with an
    occurrence ordinal ("#2") when two tags of one mark share a bay, or a
    bay label repeats across plans. All the ids of one occurrence share the
    ordinal, so a length and its count are read together."""
    n = seen.get(stem, 0) + 1
    while True:
        prefix = stem if n == 1 else f"{stem}#{n}"
        ids = {role: f"{prefix}:{role}" for role in roles}
        if not any(i in base for i in ids.values()):
            seen[stem] = n
            return ids
        n += 1


def _measure_one(element: Element, gm, doc_id: str, region: Region, base,
                 api, seen: dict, measured: Origin):
    """One tag -> one sub-element, or (None, reason)."""
    positions_fn, bay_fn, _ = api
    cx = (region.x0 + region.x1) / 2.0
    cy = (region.y0 + region.y1) / 2.0
    horizontal = (region.x1 - region.x0) >= (region.y1 - region.y0)
    axis = "X" if horizontal else "Y"
    c = cx if horizontal else cy
    lo, hi = _bracket(positions_fn(gm, axis), c)
    where = f"tag at ({cx:.0f},{cy:.0f}) pt"
    if lo is None or hi is None:
        side = "before" if lo is None else "after"
        return None, (f"{where}: no grid line {side} it along {axis} — a "
                      f"length is not measured to the page edge")
    if hi[1] - lo[1] <= 0:
        return None, f"{where} sits on grid line {lo[0]}; no run to measure"
    mm_per_pt = getattr(gm, "mm_per_pt", None)
    if mm_per_pt is None:
        return None, f"{doc_id}: no scale on the grid map"
    bay = bay_fn(gm, cx, cy)
    if bay is None:
        return None, f"{where} is outside the grid"
    length_mm = Decimal(str(hi[1] - lo[1])) * Decimal(str(mm_per_pt))
    metres = length_mm / Decimal(1000)

    kind, mark = element.element_type, element.mark
    stem = f"{kind}:{mark}:{bay}"
    ids_new = _unique(base, seen, stem, ("length", "count"))
    length_id, count_id = ids_new["length"], ids_new["count"]
    base.make(length_id, metres, "m", doc_id, region, measured, role="length")
    # its own count of one: the evaluators read the count ROLE from evidence,
    # and pointing a sub-element at the schedule's total would multiply every
    # bay by the whole schedule row. A tag on a plan is a counted thing.
    base.make(count_id, 1, "nr", doc_id, region, Origin.COUNTED, role="count")
    dims = dict(element.dims)
    dims["length"] = length_id
    dims["count"] = count_id
    ids = [i for i in element.evidence_ids if i != element.dims.get("count")]
    ids += [count_id, length_id]
    sheets = tuple(element.sheets) + ((doc_id,) if doc_id not in element.sheets else ())
    sub = _clone(element, dims=dims, count=1, sheets=sheets,
                 evidence_ids=tuple(ids), bay=bay)
    basis = (f"{mark} at {bay} on {doc_id}: grid {lo[0]} to {hi[0]}, "
             f"{hi[1] - lo[1]:.1f} pt x {mm_per_pt} mm/pt = {length_mm:.0f} mm")
    return sub, basis


def attach_lengths(elements: list, base, grids: dict, words_by_doc: dict,
                   sheet_kinds: dict | None) -> tuple[list, list]:
    """(elements, gaps). Elements of a plan-length type that carry no
    dims["length"] are looked for on the calibrated plans; each tag found
    becomes a sub-element of count 1 with a MEASURED length and its bay.

    `grids` is {doc_id: GridMap}; `words_by_doc` {doc_id: [Word]} from S4;
    `sheet_kinds` {doc_id: kind} from routing where known. A sheet whose kind
    is known and is not "plan" is never searched; a sheet whose kind is not
    known is searched when CALIBRATED."""
    api = _grid_api()
    kinds = dict(sheet_kinds or {})
    grids = dict(grids or {})
    words_by_doc = words_by_doc or {}

    def plan_like(doc_id: str) -> bool:
        return kinds.get(doc_id) in (None, "plan")

    calibrated = sorted(d for d, gm in grids.items()
                        if plan_like(d) and _status(gm) == "CALIBRATED")
    uncalibrated = sorted(d for d, gm in grids.items()
                          if plan_like(d) and _status(gm) != "CALIBRATED")
    indexes = {d: _index(list(words_by_doc.get(d) or [])) for d in calibrated}
    measured = getattr(Origin, "MEASURED", None)

    out: list = []
    gaps: list[Gap] = []
    used: set = set()            # (doc_id, x0, y0) of a tag already attributed
    seen: dict = {}              # evidence id stems -> ordinal
    for element in elements:
        if (element.element_type not in PLAN_LENGTH_TYPES
                or "length" in element.dims):
            out.append(element)
            continue
        mark = element.mark
        first_sheet = element.sheets[0] if element.sheets else None
        if measured is None:
            gaps.append(Gap(stage=STAGE, doc_id=first_sheet, subject=mark,
                            reason="length not measurable: Origin.MEASURED is "
                                   "not defined in spine.records"))
            out.append(element)
            continue
        if not calibrated:
            gaps.append(Gap(stage=STAGE, doc_id=first_sheet, subject=mark,
                            reason=f"length not measurable: no calibrated plan "
                                   f"carries {mark} ({len(uncalibrated)} plans "
                                   f"PARTIAL/NONE)"))
            out.append(element)
            continue

        occurrences, already = [], 0
        for doc_id in calibrated:
            for region in _locate(mark, indexes[doc_id]):
                key = (doc_id, round(region.x0, 1), round(region.y0, 1))
                if key in used:
                    already += 1
                    continue
                occurrences.append((doc_id, region, key))
        if not occurrences:
            if already:
                reason = (f"length not measurable: all {already} plan "
                          f"occurrence(s) of {mark} are already attributed to "
                          f"another scheduled row of {mark}; no plan-to-storey "
                          f"mapping to split them")
            else:
                reason = (f"length not measurable: no calibrated plan carries "
                          f"{mark} ({len(uncalibrated)} plans PARTIAL/NONE)")
            gaps.append(Gap(stage=STAGE, doc_id=first_sheet, subject=mark,
                            reason=reason))
            out.append(element)
            continue

        subs, bases = [], []
        for doc_id, region, key in occurrences:
            sub, why = _measure_one(element, grids[doc_id], doc_id, region,
                                    base, api, seen, measured)
            if sub is None:
                gaps.append(Gap(stage=STAGE, doc_id=doc_id, subject=mark,
                                reason=f"length not measured: {why}"))
                continue
            used.add(key)
            subs.append(sub)
            bases.append(why)
        if not subs:
            out.append(element)
            continue
        out.extend(subs)
        if len(subs) != element.count:
            gaps.append(Gap(stage=STAGE, doc_id=first_sheet, subject=mark,
                            reason=f"schedule states {element.count} of {mark}; "
                                   f"{len(subs)} tag(s) measured on calibrated "
                                   f"plans — reported, not reconciled",
                            detail="; ".join(bases)[:600]))
    return out, gaps
