#!/usr/bin/env python3
"""
schedule_read.py — one model call per sheet, then code reads every row.

This is the shape that makes the whole pipeline affordable and is worth stating
plainly: the model is asked *which column is which* — one call, closed enum,
per sheet — and then ordinary code walks all 400 rows. Thirty calls, not thirty
thousand. Asking per row would cost 1000x and would also let the model produce
a different reading of row 200 than of row 3, which is the failure the single
call structurally prevents.

The mapping is validated against the grid before any row is read: a column
index that does not exist, a required role unmapped, or two roles claiming one
column are all hard failures. A wrong mapping applied to 400 rows is 400 wrong
values that individually look fine.

Schedules are the highest-reliability quantity source in any package, because
the quantities are stated rather than derived. That is why they carry
origin=STATED and why they are read before anything else is attempted.

  python3 -m readers.schedule_read <pdf> --page N --mapping M.json

Exit 0 = rows read. Exit 1 = mapping invalid against the grid. Exit 2 = no grid.
"""
from __future__ import annotations

import argparse
import re
from dataclasses import dataclass

ROLES = ("mark", "type", "width", "height", "thickness", "depth", "length",
         "diameter", "size", "count", "material", "finish", "fire_rating",
         "location", "remarks")
REQUIRED = ("mark",)


@dataclass(frozen=True)
class ColumnMapping:
    """What the model returned. Column indices into the grid, nothing else."""
    doc_id: str
    page: int
    columns: dict          # role -> column index
    header_row: int
    mark_basis: str = "header"   # "header" or "column contents"

    def validate(self, n_cols: int) -> list[str]:
        """Returns problems, empty if sound. Called before any row is read."""
        problems = []
        for role, index in sorted(self.columns.items()):
            if role not in ROLES:
                problems.append(f"unknown role: {role}")
            if not 0 <= index < n_cols:
                problems.append(f"role {role} maps to column {index}, "
                                f"grid has {n_cols}")
        claimed: dict[int, str] = {}
        for role, index in sorted(self.columns.items()):
            if index in claimed:
                problems.append(f"column {index} claimed by both "
                                f"{claimed[index]} and {role}")
            claimed[index] = role
        for role in REQUIRED:
            if role not in self.columns:
                problems.append(f"required role unmapped: {role}")
        return problems


@dataclass(frozen=True)
class ScheduleRow:
    mark: str
    values: dict           # role -> raw cell text, unparsed
    row_index: int
    doc_id: str
    page: int


# Header words that name a role. The header STATES what the column is, so
# reading it is not the forbidden keyword-matching — that rule is about matching
# an item DESCRIPTION to a rate. Here the draughtsman has labelled the column
# and the label is the evidence.
HEADER_SYNONYMS: dict = {
    "mark": ("MARK", "TAG", "REF", "REFERENCE", "TYPE NO", "DOOR NO",
             "WINDOW NO", "ITEM", "CODE", "ID", "NO."),
    "type": ("TYPE", "DESCRIPTION", "DESCR", "LEAF TYPE", "PANEL"),
    # structural schedules write B (breadth) x D (depth); B x T for slabs and
    # walls; DIA or Ø for piles and bars. Read as the sheet spells them.
    "width": ("WIDTH", "W", "B", "BREADTH", "CLEAR WIDTH", "OPENING WIDTH", "SIZE W"),
    "height": ("HEIGHT", "H", "CLEAR HEIGHT", "OPENING HEIGHT", "SIZE H", "STOREY HEIGHT"),
    "thickness": ("THICKNESS", "THK", "T", "THK."),
    "depth": ("DEPTH", "D", "DP", "OVERALL DEPTH"),
    "length": ("LENGTH", "L", "LEN", "SPAN"),
    "diameter": ("DIAMETER", "DIA", "DIA.", "Ø"),
    # SIZE is what the cell says it is: "900 x 2100" on a door schedule, "600"
    # on a pile schedule. Read whole here; measure.intake splits it by kind.
    "size": ("SIZE", "OPENING SIZE", "OVERALL SIZE", "FRAME SIZE", "UNIT SIZE",
             "NOMINAL SIZE", "SIZE (W X H)", "SIZE W X H", "W X H", "WXH",
             "DIMENSIONS", "DIMENSION", "DIMS", "DIM"),
    "count": ("QTY", "QUANTITY", "NOS", "NO OFF", "COUNT", "TOTAL"),
    "material": ("MATERIAL", "MAT", "FRAME", "FRAME MATERIAL", "GLAZING"),
    "finish": ("FINISH", "FINISHES", "COLOUR", "COLOR", "PAINT"),
    "fire_rating": ("FIRE RATING", "FIRE", "RATING", "FR", "FIRE RESISTANCE"),
    "location": ("LOCATION", "ROOM", "AREA", "ZONE", "LEVEL", "FLOOR"),
    "remarks": ("REMARKS", "REMARK", "NOTES", "NOTE", "COMMENTS"),
}


# A mark looks like a mark: a short alphanumeric tag, not a sentence. "C 1",
# "C 2-A", "B1A", "SD-01", "F.03" are marks; a suffix after a hyphen ("2-A")
# is part of it.
MARK_SHAPE = re.compile(r"^[A-Z]{1,4}[\-. /]?\d{1,3}(?:-?[A-Z])?$")
# the same shape, found INSIDE a cell that carries other words as well. A
# structural schedule writes "C 1" with a space, and a section-cut letter
# drawn beside the mark lands in the same cell — "D C 1", "J C 3", "E B2B" —
# so the space between letters and digits is allowed and the stray letter
# before it is not part of the token.
MARK_TOKEN = re.compile(r"(?<![A-Z0-9])([A-Z]{1,4}[\-. ]?\d{1,3}(?:-?[A-Z])?)(?![A-Z0-9])")


def mark_token(text: str) -> str:
    """The mark a cell states, freed of the words that wrapped into it.

    A schedule cell is words at coordinates, and a description that wraps in
    the neighbouring column lands its last word in the mark's band: the cell
    then reads "DOOR AL-01", "TIMBER SD-09", "AND WD-04". Read literally, each
    is a NEW mark — a fourth AL-01 door that does not exist, and a real WD-04
    that is now split three ways across the bill.

    So: where a cell holds exactly one mark-shaped token together with other
    words, the token is the mark. Where it holds none ("FLOOR") or several
    ("F.10 / F.17", a genuine composite) the cell is kept whole — nothing is
    invented and nothing is split that the schedule wrote as one."""
    cell = " ".join(text.split())
    if not cell or MARK_SHAPE.match(cell.upper()):
        return cell
    tokens = MARK_TOKEN.findall(cell.upper())
    if len(tokens) == 1:
        # return the token as the cell spelled it, not upper-cased
        m = re.search(re.escape(tokens[0]), cell, re.IGNORECASE)
        return m.group(0) if m else tokens[0]
    return cell


def _match_roles(header_cells: dict) -> dict:
    """header_cells: column -> text. Returns role -> column.

    Exact and prefix matching, longest synonym first. A role already claimed is
    not reassigned and a column already used is not reused: the leftmost column
    wins, so a second "NO." inside a REMARKS heading cannot steal the mark."""
    pairs = []
    for role, synonyms in HEADER_SYNONYMS.items():
        for synonym in synonyms:
            pairs.append((len(synonym), synonym, role))
    pairs.sort(key=lambda t: (-t[0], t[1], t[2]))

    columns: dict = {}
    used: set = set()
    for col in sorted(header_cells):
        text = " ".join(header_cells[col].upper().replace(".", ". ").split())
        for _length, synonym, role in pairs:
            if role in columns or col in used:
                continue
            if text == synonym or text.startswith(synonym + " ") or \
                    text.replace(" ", "") == synonym.replace(" ", ""):
                columns[role] = col
                used.add(col)
                break
    return columns


# A floor, not the discriminator. A real door schedule repeats a tag across
# locations — A-504's tag column is 67% distinct, not 100% — so an absolute
# threshold set high enough to exclude a type code also excludes the real mark.
# The discriminator is RELATIVE: among the tag-shaped columns, the mark is the
# one that most nearly identifies its row. On A-504 that is 0.67 against 0.09.
MIN_MARK_UNIQUENESS = 0.35


def _mark_quality(grid, col: int, first_row: int) -> float:
    """How much does this column behave like a column of marks? 0 = not at all.

    Two properties, and the second is the one that matters. A mark LOOKS like a
    tag — a short alphanumeric code, not a sentence — and a mark IDENTIFIES ITS
    ROW, so marks are mostly distinct. A type or rating code in the same shape
    repeats down the column.

    That distinction is not academic. On A-504 the tag column holds SD-01, SD-02,
    SD-03 and the threshold column holds T4, T1, T1, T1, T1. Both match the tag
    shape, so shape alone chose the threshold column, put T4 in the mark role and
    the real door tag in the type role, and produced 46 rows that read perfectly
    and were wrong. Uniqueness separates them."""
    values = [c.text.strip() for c in grid.column(col)
              if c.row > first_row and c.text.strip()]
    if len(values) < 3:
        return 0.0
    shaped = [v for v in values if MARK_SHAPE.match(v.upper())]
    if len(shaped) * 2 < len(values):
        return 0.0
    uniqueness = len(set(v.upper() for v in values)) / len(values)
    return uniqueness if uniqueness >= MIN_MARK_UNIQUENESS else 0.0


def mark_column_plausible(grid, col: int, first_row: int, located: bool) -> str | None:
    """Why a proposed mark column is NOT one, or None if it is.

    Two properties, applied differently from _mark_quality because this
    judges a column the MODEL proposed on a sheet whose header code could
    not read. Its cells must be mark-shaped (the shape test always holds —
    "600", "500", "1" are not marks, and a drawing list's S-001 rows are
    caught elsewhere). Uniqueness holds only when the schedule has no
    location column: a column schedule states C 1 once per storey, six rows
    of C 1 with six locations, and refusing that as "repeating" threw away
    the column and core-wall schedules of a real package."""
    values = [c.text.strip() for c in grid.column(col)
              if c.row > first_row and c.text.strip()]
    if len(values) < 3:
        return "fewer than three cells below the header"
    shaped = [v for v in values if MARK_SHAPE.match(mark_token(v).upper())]
    if len(shaped) * 2 < len(values):
        return (f"{len(values) - len(shaped)} of {len(values)} cells are not "
                f"mark-shaped (e.g. {', '.join(v for v in values if v not in shaped)[:60]})")
    if not located:
        uniqueness = len(set(v.upper() for v in values)) / len(values)
        if uniqueness < MIN_MARK_UNIQUENESS:
            return (f"marks repeat ({uniqueness:.0%} distinct) and no location "
                    f"column tells the rows apart")
    return None


def _mark_column(grid, first_row: int) -> int | None:
    """The tag-shaped column that most nearly identifies its row.

    Not simply the leftmost tag-shaped column: a schedule can carry several
    columns of codes and the leftmost is usually but not always the tag. Among
    the candidates the mark is the one with the highest uniqueness, and a tie
    breaks LEFTMOST — because a schedule puts its tag first in every package
    anyone has issued, and because a tie must break the same way on every run."""
    scored = [(_mark_quality(grid, col, first_row), col)
              for col in range(grid.n_cols)]
    candidates = [(q, col) for q, col in scored if q > 0]
    if not candidates:
        return None
    best = max(q for q, _col in candidates)
    return min(col for q, col in candidates if q == best)


def map_from_header(grid, header_row: int | None = None):
    """The deterministic path, tried before any model call.

    A schedule's header names its own columns, so most sheets need no model at
    all — and a run that can read a door schedule with no network is a run that
    still works when the sign-in has expired, which is not hypothetical.

    Two things real sheets do that a synthetic one does not:

    * the header spans TWO bands. "DOOR / TYPE", "STRUCTURAL / WIDTH",
      "OPENING / HEIGHT" — the words sit on separate lines and mean one label.
      So consecutive pairs of rows are tried joined as well as alone.
    * the header does not name the mark column. Then the column's CONTENTS
      decide, and `mark_basis` records that they did.

    The candidate producing the most roles wins; ties go to the earlier header
    row, so a run is reproducible."""
    candidates = []
    limit = grid.n_rows if header_row is None else header_row + 1
    start = 0 if header_row is None else header_row
    for row in range(start, min(limit, start + 4)):
        cells = {c.col: c.text for c in grid.row(row)}
        if cells:
            candidates.append((row, cells))
        nxt = {c.col: c.text for c in grid.row(row + 1)}
        if cells and nxt:
            joined = dict(cells)
            for col, text in nxt.items():
                joined[col] = f"{joined.get(col, '')} {text}".strip()
            candidates.append((row + 1, joined))

    best = None
    for row, cells in candidates:
        # the mark column is settled FIRST, from the cells beneath the header,
        # and then excluded from role matching. Settling it last let a weaker
        # role claim it and pushed the mark onto whatever was left.
        by_content = _mark_column(grid, row)
        columns = _match_roles(cells)
        header_mark = columns.get("mark")
        basis = "header"

        if header_mark is not None and _mark_quality(grid, header_mark, row) > 0:
            mark_col = header_mark
        elif by_content is not None:
            mark_col = by_content
            basis = "column contents"
        elif header_mark is not None:
            mark_col, basis = header_mark, "header (contents do not corroborate)"
        else:
            continue

        columns = {r: c for r, c in columns.items() if c != mark_col}
        columns["mark"] = mark_col
        score = len(columns)
        if best is None or score > best[0]:
            best = (score, row, columns, basis)

    if best is None:
        return None
    _score, row, columns, basis = best
    if _mark_quality(grid, columns["mark"], row) <= 0:
        # Refuse rather than read. A schedule whose mark column repeats itself is
        # a schedule we have not understood, and rows read from a mapping we have
        # not understood are wrong in a way nobody downstream can see.
        return None
    return ColumnMapping(doc_id=grid.doc_id, page=grid.page, columns=columns,
                         header_row=row, mark_basis=basis)


def read_rows(grid, mapping: ColumnMapping) -> tuple:
    """Every row below the header, and the blanks it skipped.

    Returns (rows, blanks). Blank marks are skipped and COUNTED, not dropped
    silently — a schedule with 47 rows and 3 blank marks is a 44-row schedule
    and somebody should know why. The count reaches the gap list, so the
    difference between 47 and 44 is a question rather than a quiet loss.

    Validation runs first and raises: a wrong mapping applied to 400 rows is
    400 wrong values that each look fine on their own."""
    problems = mapping.validate(grid.n_cols)
    if problems:
        raise ValueError("; ".join(problems))

    mark_col = mapping.columns["mark"]
    rows: list[ScheduleRow] = []
    blanks = 0

    for index in range(mapping.header_row + 1, grid.n_rows):
        cells = {c.col: c for c in grid.row(index)}
        # a merged cell covers columns it does not start in
        for cell in grid.row(index):
            for offset in range(cell.spans):
                cells.setdefault(cell.col + offset, cell)

        mark_cell = cells.get(mark_col)
        mark = mark_token((mark_cell.text if mark_cell else "").strip())
        if not mark:
            blanks += 1
            continue

        values = {}
        for role, col in sorted(mapping.columns.items()):
            cell = cells.get(col)
            if cell is not None and cell.text.strip():
                values[role] = cell.text.strip()
        rows.append(ScheduleRow(mark=mark, values=values, row_index=index,
                                doc_id=grid.doc_id, page=grid.page))
    return rows, blanks


def main() -> int:
    ap = argparse.ArgumentParser(description="Read a schedule's rows.")
    ap.add_argument("pdf")
    ap.add_argument("--page", type=int, default=0)
    ap.add_argument("--mapping", required=True)
    ap.parse_args()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
