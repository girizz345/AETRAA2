"""Stage 6 — reading a schedule out of a PDF that contains no table.

A PDF has words at coordinates. A table is a hypothesis about how they line up,
and every failure mode here produces a schedule that READS correctly and is
wrong, which is why each one gets a test:

  * band creep — forty words each just inside tolerance walk the band down the
    sheet and swallow the row beneath;
  * invented columns — a gap present in 3 rows of 40 splits one field into two;
  * merged cells assigned to the first column — loses five of a type's six rows;
  * wrapped REMARKS lines counted as rows — a 44-row schedule reads as 60;
  * blank marks dropped silently — 47 becomes 44 with nobody told.

Schedules are the highest-reliability quantity source in a package because the
quantities are STATED rather than derived, so an error here is inherited by
everything downstream.
"""
import pytest

from readers.schedule_cells import Grid, assemble, column_of, spans_of
from readers.schedule_columns import find_boundaries, corroborate_with_rules
from readers.schedule_grid import band_rows, median_height
from readers.schedule_read import ColumnMapping, map_from_header, read_rows
from spine.records import Word

W = 9.0          # word height used throughout


def word(text, x, y, width=None, height=W):
    return Word(index=0, text=text, x0=x, y0=y,
                x1=x + (width if width is not None else len(text) * 5.0),
                y1=y + height, doc_id="D", page=1)


def sheet(rows, x_of=(40, 160, 280, 400), y0=100, pitch=20):
    """rows: list of tuples of cell text (None = empty cell)."""
    out = []
    for r, cells in enumerate(rows):
        for c, text in enumerate(cells):
            if text:
                out.append(word(text, x_of[c], y0 + r * pitch))
    return out


# ── banding ────────────────────────────────────────────────────────────
def test_words_on_one_line_make_one_band():
    words = [word("MARK", 40, 100), word("TYPE", 160, 100),
             word("QTY", 280, 100)]
    bands = band_rows(words)
    assert len(bands) == 1
    assert [w.text for w in bands[0].words] == ["MARK", "TYPE", "QTY"]


def test_a_band_keeps_its_words_in_reading_order():
    words = [word("QTY", 280, 100), word("MARK", 40, 100),
             word("TYPE", 160, 100)]
    assert [w.text for w in band_rows(words)[0].words] == \
        ["MARK", "TYPE", "QTY"]


def test_mixed_type_sizes_in_one_cell_band_together():
    """A cell mixing 8pt and 12pt has words whose TOPS differ by more than the
    tolerance while their centres do not."""
    small = word("FR", 40, 102, height=6.0)
    large = word("60", 60, 100, height=12.0)
    assert len(band_rows([small, large])) == 1


def test_separate_rows_stay_separate():
    words = sheet([("D1", "FLUSH"), ("D2", "GLAZED")])
    assert len(band_rows(words)) == 2


def test_the_band_does_not_creep_down_the_sheet():
    """Each word sits just inside tolerance of the last. Measured from the
    FIRST word the band would swallow them all; measured from the band's own
    running centre it stops."""
    step = 0.55 * W * 0.9                    # just inside tolerance each time
    words = [word(f"w{i}", 40 + i * 30, 100 + i * step) for i in range(40)]
    bands = band_rows(words)
    assert len(bands) > 1, "the band crept the whole way down the sheet"


def test_banding_is_deterministic():
    words = sheet([("D1", "FLUSH", "2"), ("D2", "GLAZED", "4")])
    first = [[w.text for w in b.words] for b in band_rows(words)]
    second = [[w.text for w in b.words] for b in band_rows(list(reversed(words)))]
    assert first == second


def test_median_height_of_nothing_is_zero():
    assert median_height([]) == 0.0
    assert band_rows([]) == []


# ── columns ────────────────────────────────────────────────────────────
def test_boundaries_are_found_from_consistent_gaps():
    words = sheet([("MARK", "TYPE", "QTY", "REMARKS")] +
                  [(f"D{i}", "FLUSH", str(i), "NONE") for i in range(1, 9)])
    boundaries = find_boundaries(band_rows(words))
    assert len(boundaries) == 3, boundaries
    assert boundaries == sorted(boundaries)


def test_a_gap_in_a_few_rows_does_not_become_a_column():
    """Two of ten rows have an extra gap. Inventing a column there splits one
    field into two and the schedule reads correctly and is wrong."""
    rows = [("MARK", "TYPE", "QTY", "REMARKS")]
    rows += [(f"D{i}", "FLUSH", str(i), "NONE") for i in range(1, 11)]
    words = sheet(rows)
    words.append(word("EXTRA", 700, 120))        # far right, two rows only
    words.append(word("EXTRA", 700, 140))
    boundaries = find_boundaries(band_rows(words))
    assert len(boundaries) == 3, f"invented a column: {boundaries}"


def test_too_few_rows_supports_nothing():
    assert find_boundaries(band_rows(sheet([("A", "B"), ("C", "D")]))) == []


def test_a_rule_snaps_a_boundary_but_never_adds_one():
    class Path:
        def __init__(self, x, y0, y1):
            self.points = [(x, y0), (x, y1)]
    boundaries = [100.0, 200.0]
    paths = [Path(103.0, 0, 400), Path(640.0, 0, 400)]    # 640 = a frame rule
    out = corroborate_with_rules(boundaries, paths)
    assert 103.0 in out, "did not snap to the rule"
    assert 640.0 not in out, "added a column a rule implied but words did not"
    assert len(out) == 2


def test_no_rules_leaves_the_boundaries_alone():
    assert corroborate_with_rules([100.0, 200.0], []) == [100.0, 200.0]


# ── the grid ───────────────────────────────────────────────────────────
def test_a_point_lands_in_the_right_column():
    assert column_of(50, [100, 200]) == 0
    assert column_of(150, [100, 200]) == 1
    assert column_of(250, [100, 200]) == 2


def test_a_value_crossing_a_boundary_is_merged_across_every_column():
    first, spans = spans_of(50, 250, [100, 200])
    assert (first, spans) == (0, 3), "a merged cell kept only its first column"


def test_a_simple_grid_assembles():
    words = sheet([("MARK", "TYPE", "QTY"), ("D1", "FLUSH", "2")],
                  x_of=(40, 160, 280, 400))
    grid = assemble(band_rows(words), [100.0, 220.0], "D", 1)
    assert (grid.n_rows, grid.n_cols) == (2, 3)
    assert [c.text for c in grid.row(1)] == ["D1", "FLUSH", "2"]


def test_words_in_one_cell_stay_in_one_cell():
    words = [word("FIRE", 40, 100), word("RATED", 70, 100),
             word("D1", 160, 100)]
    grid = assemble(band_rows(words), [120.0], "D", 1)
    assert [c.text for c in grid.row(0)] == ["FIRE RATED", "D1"]


def test_a_wrapped_remarks_line_joins_its_row_instead_of_making_one():
    """The continuation populates only a column the row above populated, and
    says nothing in the key column."""
    words = [word("D1", 40, 100), word("FLUSH", 160, 100),
             word("SEE", 280, 100),
             word("DETAIL", 280, 118),            # the wrap
             word("D2", 40, 140), word("GLAZED", 160, 140)]
    grid = assemble(band_rows(words), [120.0, 220.0], "D", 1)
    assert grid.n_rows == 2, f"the wrap became a row: {grid.n_rows} rows"
    remarks = [c for c in grid.row(0) if c.col == 2][0]
    assert remarks.text == "SEE DETAIL" and remarks.continued


# ── reading the rows ───────────────────────────────────────────────────
def _door_schedule():
    rows = [("MARK", "TYPE", "QTY", "REMARKS"),
            ("D1", "FLUSH", "12", "FR60"),
            ("D2", "GLAZED", "4", "NONE"),
            (None, "ORPHAN", "9", "NONE"),       # blank mark
            ("D3", "LOUVRE", "6", "NONE")]
    words = sheet(rows)
    bands = band_rows(words)
    return assemble(bands, find_boundaries(bands), "D", 1)


def test_the_header_maps_itself_with_no_model_call():
    """A schedule's header NAMES its columns. Reading it means a door schedule
    is readable with no network — which is not hypothetical."""
    mapping = map_from_header(_door_schedule())
    assert mapping is not None
    assert mapping.columns["mark"] == 0
    assert mapping.columns["type"] == 1
    assert mapping.columns["count"] == 2
    assert mapping.columns["remarks"] == 3


def test_a_row_missing_its_mark_is_not_swallowed_by_the_row_above():
    """Regression. This row is a subset of the row above with an empty mark —
    geometrically indistinguishable from a wrapped line — and joining it turned
    quantity 4 into the string "4 9" and GLAZED into GLAZED ORPHAN. A silently
    corrupted quantity. It must stay its own row and be reported as a blank."""
    grid = _door_schedule()
    texts = [c.text for r in range(grid.n_rows) for c in grid.row(r)]
    assert "4 9" not in texts, "a quantity was corrupted by a bad join"
    assert "GLAZED ORPHAN" not in texts
    assert grid.n_rows == 5, f"rows merged: {grid.n_rows}"


def test_a_wrap_of_two_columns_still_joins():
    """Narrowness is the test, not a single column: a row may wrap both its
    TYPE and its REMARKS and still be one row."""
    words = [word("D1", 40, 100), word("FLUSH", 160, 100),
             word("12", 280, 100), word("SEE", 400, 100),
             word("TIMBER", 160, 118), word("DETAIL", 400, 118),
             word("D2", 40, 150), word("GLAZED", 160, 150),
             word("4", 280, 150), word("NONE", 400, 150)]
    grid = assemble(band_rows(words), [120.0, 220.0, 340.0], "D", 1)
    assert grid.n_rows == 2, f"a two-column wrap became a row: {grid.n_rows}"
    assert [c.text for c in grid.row(0) if c.col == 1][0] == "FLUSH TIMBER"


def test_rows_are_read_and_blank_marks_are_counted_not_dropped():
    grid = _door_schedule()
    rows, blanks = read_rows(grid, map_from_header(grid))
    assert [r.mark for r in rows] == ["D1", "D2", "D3"]
    assert blanks == 1, "a blank mark vanished without being counted"
    assert rows[0].values["count"] == "12"


def test_a_header_with_no_mark_column_refuses_to_map():
    words = sheet([("COLOUR", "FINISH"), ("WHITE", "MATT")])
    bands = band_rows(words)
    grid = assemble(bands, find_boundaries(bands), "D", 1)
    assert map_from_header(grid) is None


def test_a_mapping_that_does_not_fit_the_grid_is_refused_before_any_row():
    grid = _door_schedule()
    bad = ColumnMapping("D", 1, {"mark": 0, "count": 99}, 0)
    with pytest.raises(ValueError):
        read_rows(grid, bad)


def test_two_roles_cannot_claim_one_column():
    bad = ColumnMapping("D", 1, {"mark": 0, "type": 0}, 0)
    assert any("claimed by both" in p for p in bad.validate(4))


def test_a_required_role_unmapped_is_a_failure():
    assert any("required role unmapped" in p
               for p in ColumnMapping("D", 1, {"type": 1}, 0).validate(4))


def test_a_merged_type_reaches_every_row_it_covers():
    """A type cell spanning six rows must not leave five rows empty."""
    grid = Grid(cells=(
        __import__("readers.schedule_cells", fromlist=["Cell"]).Cell(0, 0, "MARK"),
        __import__("readers.schedule_cells", fromlist=["Cell"]).Cell(0, 1, "TYPE"),
        __import__("readers.schedule_cells", fromlist=["Cell"]).Cell(1, 0, "D1"),
        __import__("readers.schedule_cells", fromlist=["Cell"]).Cell(
            1, 1, "FLUSH TIMBER", spans=2),
    ), n_rows=2, n_cols=3, doc_id="D", page=1)
    rows, _ = read_rows(grid, ColumnMapping("D", 1, {"mark": 0, "type": 1}, 0))
    assert rows[0].values["type"] == "FLUSH TIMBER"


# ── what the real sheets taught ─────────────────────────────────────────
# These three came out of running the reader against the development package.
# Every one of them passed the synthetic tests above and failed on a real sheet,
# which is the only reason they exist.

def test_a_sheet_that_is_mostly_not_a_table_still_yields_its_table():
    """The first version found ZERO columns on three real schedule sheets. A
    drawing sheet is mostly title block, authority stamp, notes and legend, so a
    column gap holds across forty bands of a hundred and forty — 29% support,
    nowhere near the 75% the gate wants. Support must be measured inside the
    table, and the table has to be found first."""
    from readers.schedule_columns import locate_table
    table = [("MARK", "TYPE", "QTY", "REMARKS")]
    table += [(f"D{i}", "FLUSH", str(i), "NONE") for i in range(1, 13)]
    words = sheet(table)
    # the rest of the sheet: notes, a stamp, a legend — none of it tabular
    for i, note in enumerate(["GENERAL NOTES", "ALL DIMENSIONS IN MM",
                              "AUTHORITY STAMP", "REFER TO SPECIFICATION",
                              "DO NOT SCALE", "CONTRACTOR TO VERIFY",
                              "ISSUED FOR CONSTRUCTION", "LEGEND",
                              "FIRE RATED ASSEMBLY", "SEE DETAIL 4"]):
        words.append(word(note, 600, 500 + i * 20))
    boundaries, rows = locate_table(band_rows(words))
    assert len(boundaries) == 3, f"lost the table in the noise: {boundaries}"
    assert len(rows) >= 12, f"table rows not isolated: {len(rows)}"


def test_two_columns_is_not_a_schedule():
    """A door-elevation sheet and a window-elevation sheet each yield exactly one
    persistent gap. Read as a table that is a 101-row, 2-column schedule of
    nonsense, and nothing downstream can tell."""
    from readers.schedule_columns import locate_table
    words = sheet([(f"NOTE {i}", "SOME TEXT") for i in range(12)],
                  x_of=(40, 300))
    boundaries, rows = locate_table(band_rows(words))
    assert boundaries == [] and rows == []


def test_the_mark_column_is_the_one_that_identifies_its_row():
    """A-504 holds door tags SD-01..SD-46 in column 0 and threshold codes
    T4/T1/T1/T1 in column 4. Both match the tag SHAPE, so shape alone chose the
    threshold column, put T4 in the mark role and the door tag in type, and read
    46 rows that looked perfect and were wrong.

    Uniqueness separates them — 0.67 against 0.09 — and it has to be relative,
    because a real door tag repeats across locations and an absolute threshold
    high enough to exclude T1 also excludes SD-01."""
    rows = [("DOOR", "STRUCTURAL", "THRESHOLD"),
            ("TYPE", "WIDTH", "TYPE")]
    tags = ["SD-01", "SD-02", "SD-03", "SD-05", "SD-06", "SD-06", "SD-07",
            "SD-08", "SD-09"]
    thresholds = ["T4", "T1", "T1", "T1", "T4", "T1", "T1", "T1", "T1"]
    for tag, thr in zip(tags, thresholds):
        rows.append((tag, "1100MM", thr))
    words = sheet(rows, x_of=(40, 200, 360))
    bands = band_rows(words)
    from readers.schedule_columns import locate_table
    boundaries, table_rows = locate_table(bands)
    grid = assemble([bands[i] for i in table_rows], boundaries, "A-504", 1)
    mapping = map_from_header(grid)
    assert mapping is not None, "refused a schedule it should have read"
    marks = [c.text for c in grid.column(mapping.columns["mark"])
             if c.row > mapping.header_row]
    assert any(m.startswith("SD-") for m in marks), \
        f"mark role landed on the wrong column: {marks[:4]}"
    assert "T1" not in marks


def test_a_mapping_whose_mark_column_repeats_is_refused_not_used():
    """Refuse rather than read. Rows read from a mapping nobody understood are
    wrong in a way no one downstream can see."""
    rows = [("CODE", "VALUE")]
    rows += [("T1", str(i)) for i in range(10)]          # mark repeats entirely
    words = sheet(rows, x_of=(40, 300))
    bands = band_rows(words)
    from readers.schedule_columns import locate_table
    boundaries, table_rows = locate_table(bands)
    if not boundaries:
        return                      # rejected even earlier, which is also right
    grid = assemble([bands[i] for i in table_rows], boundaries, "X", 1)
    assert map_from_header(grid) is None


def test_a_two_line_header_is_read_as_one_label():
    """DOOR / TYPE, STRUCTURAL / WIDTH, OPENING / HEIGHT — one label across two
    bands, which is how the issued sheets draw it."""
    rows = [("MARK", "STRUCTURAL", "OPENING"),
            ("REF.", "WIDTH", "HEIGHT")]
    rows += [(f"D{i}", "900MM", "2100MM") for i in range(1, 9)]
    words = sheet(rows, x_of=(40, 200, 360))
    bands = band_rows(words)
    from readers.schedule_columns import locate_table
    boundaries, table_rows = locate_table(bands)
    grid = assemble([bands[i] for i in table_rows], boundaries, "X", 1)
    mapping = map_from_header(grid)
    assert mapping is not None
    assert "width" in mapping.columns and "height" in mapping.columns, \
        f"a two-line header was not joined: {mapping.columns}"
