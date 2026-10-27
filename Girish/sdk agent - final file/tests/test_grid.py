"""Stage 4 — the grid and the scale of a sheet, read off its text layer.

Every failure mode here produces a scale that LOOKS calibrated and is wrong,
and a wrong scale multiplies into every measured length on the sheet:

  * the sheet-frame reference grid (A–P down the border, 1–20 along it) is
    longer than any building grid and carries no chain — ranked on label
    count it wins, and two stray dimensions then "agree" by chance;
  * two ratios 22% apart both sit within 15% of their own median — two
    points fake a scale the way two labels fake a pitch;
  * a north-arrow 'S' on the bubble row anchors the line and, under the
    source's discard-whole rule, throws the whole axis away;
  * a title-block scale is what the drafter typed, not what was plotted.

The real-sheet tests read two packages on disk read-only and skip when the
folders are absent. Nothing here writes.
"""
import os
from decimal import Decimal
from pathlib import Path

from measure import grid
from measure.grid import (GridMap, bay_of, calibrate_sheet, gridline_positions,
                          page_size_and_rotation, parse_title_scale, verified)
from spine.records import Word

W, H = 2384.0, 1684.0                 # A1 landscape in points
MM_PER_PT_100 = 25.4 / 72 * 100       # 1:100 on paper — the truth for the synthetics


def word(text, cx, cy, w=10.0, h=12.0):
    return Word(index=0, text=text, x0=cx - w / 2, y0=cy - h / 2,
                x1=cx + w / 2, y1=cy + h / 2, doc_id="D", page=0)


def axis_words(labels, start, bays_mm, mm_per_pt, along, perp, chain_perp,
               chain=True, chain_mm=None):
    """Bubbles at `start` + cumulative bay pitch along the page axis `along`
    ('X' | 'Y') on the line `perp`; one dimension token in each bay on the
    line `chain_perp`. chain_mm overrides the printed values (a lying chain)."""
    out = []
    pos = [start]
    for mm in bays_mm:
        pos.append(pos[-1] + mm / mm_per_pt)
    printed = chain_mm if chain_mm is not None else bays_mm

    def put(text, a, p, w, h):
        return word(text, a, p, w, h) if along == "X" else word(text, p, a, h, w)

    for lab, a in zip(labels, pos):
        out.append(put(lab, a, perp, 10.0, 12.0))
    if chain:
        for i, mm in enumerate(printed):
            out.append(put(str(mm), (pos[i] + pos[i + 1]) / 2, chain_perp, 24.0, 10.0))
    return out, pos


def plan_sheet(mm_per_pt=MM_PER_PT_100, letters_chain=True, numbers_chain=True,
               letters_chain_mm=None):
    letters, lx = axis_words(list("ABCDEF"), 400, [6000, 7500, 4500, 8000, 6000],
                             mm_per_pt, "X", 1500, 1470,
                             chain=letters_chain, chain_mm=letters_chain_mm)
    numbers, ny = axis_words(["1", "2", "3", "4", "5"], 300, [5000, 6000, 4000, 7000],
                             mm_per_pt, "Y", 150, 185, chain=numbers_chain)
    noise = [word("GENERAL", 1800, 1400, 60), word("NOTES", 1870, 1400, 40),
             word("ALL", 1800, 1420, 20), word("DIMENSIONS", 1840, 1420, 70),
             word("IN", 1900, 1420), word("MM", 1920, 1420),
             word("N", 2200, 300, 12, 16), word("E=496495.09", 300, 1600, 70)]
    return letters + numbers + noise, lx, ny


# ── the synthetic plan ──────────────────────────────────────────────────
def test_a_labelled_grid_with_an_agreeing_chain_calibrates():
    words, _, _ = plan_sheet()
    gm = calibrate_sheet(words, W, H, 0, "S-101")
    assert gm.status == "CALIBRATED", gm.basis
    assert verified(gm)
    truth = Decimal(str(MM_PER_PT_100))
    assert abs(gm.mm_per_pt - truth) / truth < Decimal("0.02"), gm.mm_per_pt
    assert [lab for lab, _ in gm.letters] == list("ABCDEF")
    assert [lab for lab, _ in gm.numbers] == ["1", "2", "3", "4", "5"]
    assert gm.letters_axis == "X" and gm.numbers_axis == "Y"
    assert gm.confidence == "HIGH"
    assert gm.scale_basis.startswith("dimension chain: 9 bays agree")
    assert gm.chain[:5] == [6000, 7500, 4500, 8000, 6000]
    assert "1:100" in gm.basis and "rotation 0" in gm.basis


def test_the_letters_are_sorted_by_position_whatever_the_input_order():
    words, _, _ = plan_sheet()
    gm = calibrate_sheet(list(reversed(words)), W, H, 0, "S")
    positions = [p for _, p in gm.letters]
    assert positions == sorted(positions)


def test_the_map_is_deterministic():
    words, _, _ = plan_sheet()
    a = calibrate_sheet(words, W, H, 0, "S").to_dict()
    b = calibrate_sheet(list(reversed(words)), W, H, 0, "S").to_dict()
    assert a == b


def test_a_chain_that_disagrees_leaves_the_sheet_partial():
    """Uniform bubbles, a chain of unrelated numbers: labels read, no scale."""
    words, _, _ = plan_sheet(letters_chain_mm=[3000, 9000, 1500, 12000, 2000],
                             numbers_chain=False)
    # make the letter pitches uniform so no accidental ratio agrees
    gm = calibrate_sheet(words, W, H, 0, "S")
    assert gm.status == "PARTIAL", gm.basis
    assert gm.mm_per_pt is None and gm.confidence is None
    assert gm.scale_basis == "none"
    assert not verified(gm)
    assert len(gm.letters) == 6 and len(gm.numbers) == 5
    assert "not scale-verified" in gm.basis


def test_two_ratios_a_fifth_apart_are_not_an_agreement():
    """Regression from a toilet-details sheet: detail tags T01/T02/T04 and two
    unrelated dims 1400 and 1900 gave ratios 2.82 and 2.31 — 22% apart — and
    BOTH lay within 15% of their own median. Two points fake a scale."""
    labels, pos = axis_words(["A", "B", "C"], 400, [6000, 7500], MM_PER_PT_100,
                             "X", 1500, 1470, chain_mm=[6000, 9200])
    gm = calibrate_sheet(labels, W, H, 0, "S")
    assert gm.status == "PARTIAL", gm.basis


def test_a_lone_agreeing_minority_is_not_a_chain():
    """Six bays, two agree, four do not: the chain does not agree."""
    labels, _ = axis_words(list("ABCDEFG"), 300, [6000] * 6, MM_PER_PT_100,
                           "X", 1500, 1470,
                           chain_mm=[6000, 6000, 1000, 15000, 2500, 11000])
    gm = calibrate_sheet(labels, W, H, 0, "S")
    assert gm.status == "PARTIAL", gm.basis


def test_no_labels_is_none_with_a_diagnosis():
    words = [word("6000", 500, 1470, 24, 10), word("7500", 700, 1470, 24, 10),
             word("GENERAL", 1800, 1400, 60), word("NOTES", 1870, 1400, 40)]
    gm = calibrate_sheet(words, W, H, 0, "S")
    assert gm.status == "NONE"
    assert gm.basis.startswith("NONE - ")
    assert gm.mm_per_pt is None and gm.letters == [] and gm.numbers == []
    assert not verified(gm)
    assert bay_of(gm, 500, 500) is None
    assert gridline_positions(gm, "X") == []
    assert gm.chain == [6000, 7500], "the chain is still read for the record"


def test_two_labels_do_not_make_an_axis():
    words = [word("A", 400, 1500), word("B", 600, 1500),
             word("6000", 500, 1470, 24, 10)]
    gm = calibrate_sheet(words, W, H, 0, "S")
    assert gm.status == "NONE"
    assert "failed count" in gm.basis


def test_empty_words_is_none():
    gm = calibrate_sheet([], W, H, 0, "S")
    assert gm.status == "NONE" and gm.basis.startswith("NONE")


# ── bays and gridlines ──────────────────────────────────────────────────
def test_bay_of_names_the_nearest_gridlines_letters_first():
    words, lx, ny = plan_sheet()
    gm = calibrate_sheet(words, W, H, 0, "S")
    assert bay_of(gm, lx[2], ny[2]) == "C/3"
    assert bay_of(gm, lx[0] + 5, ny[4] - 5) == "A/5"
    # midway between D and E, nearer E
    assert bay_of(gm, (lx[3] + lx[4]) / 2 + 20, ny[1]) == "E/2"


def test_bay_of_outside_the_grid_is_none():
    words, lx, ny = plan_sheet()
    gm = calibrate_sheet(words, W, H, 0, "S")
    assert bay_of(gm, W - 10, ny[1]) is None, "beyond the last letter"
    assert bay_of(gm, lx[1], H - 5) is None, "beyond the last number"


def test_bay_of_needs_both_axes():
    labels, _ = axis_words(list("ABCD"), 400, [6000, 7500, 4500], MM_PER_PT_100,
                           "X", 1500, 1470)
    gm = calibrate_sheet(labels, W, H, 0, "S")
    assert gm.status == "CALIBRATED"          # one axis can still fix the scale
    assert gm.numbers == [] and gm.numbers_axis is None
    assert bay_of(gm, 500, 500) is None


def test_gridline_positions_follow_the_page_axis():
    words, lx, ny = plan_sheet()
    gm = calibrate_sheet(words, W, H, 0, "S")
    xs = gridline_positions(gm, "X")
    ys = gridline_positions(gm, "Y")
    assert [lab for lab, _ in xs] == list("ABCDEF")
    assert [lab for lab, _ in ys] == ["1", "2", "3", "4", "5"]
    assert all(abs(p - t) < 0.01 for (_, p), t in zip(xs, lx))
    assert all(abs(p - t) < 0.01 for (_, p), t in zip(ys, ny))


# ── the title block ─────────────────────────────────────────────────────
def test_title_scale_is_a_low_confidence_fallback_only_on_partial():
    words, _, _ = plan_sheet(letters_chain=False, numbers_chain=False)
    gm = calibrate_sheet(words, W, H, 0, "S", title_scale="1:100")
    assert gm.status == "PARTIAL"
    assert gm.confidence == "LOW"
    assert gm.mm_per_pt == Decimal("25.4") / Decimal(72) * 100
    assert "title block 1:100" in gm.scale_basis and "unverified" in gm.scale_basis
    assert "A1" in gm.scale_basis
    assert not verified(gm), "a title-block scale never verifies a sheet"


def test_title_scale_spellings():
    assert parse_title_scale("1:100") == 100
    assert parse_title_scale("1 : 50") == 50
    assert parse_title_scale("1/200") == 200
    assert parse_title_scale("SCALE 1:125 @ A1") == 125
    assert parse_title_scale("NTS") is None
    assert parse_title_scale("AS SHOWN") is None
    assert parse_title_scale(None) is None
    assert parse_title_scale("") is None


def test_nts_gives_no_fallback():
    words, _, _ = plan_sheet(letters_chain=False, numbers_chain=False)
    for ts in ("NTS", "AS SHOWN", None):
        gm = calibrate_sheet(words, W, H, 0, "S", title_scale=ts)
        assert gm.status == "PARTIAL"
        assert gm.mm_per_pt is None and gm.confidence is None
        assert gm.scale_basis == "none"


def test_the_chain_governs_over_the_title_block():
    """A sheet plotted at 1:125 whose title block says 1:100 keeps the
    chain's scale, drops to MED and says so in the basis."""
    words, _, _ = plan_sheet(mm_per_pt=MM_PER_PT_100 * 1.25)
    gm = calibrate_sheet(words, W, H, 0, "S", title_scale="1:100")
    assert gm.status == "CALIBRATED"
    truth = Decimal(str(MM_PER_PT_100 * 1.25))
    assert abs(gm.mm_per_pt - truth) / truth < Decimal("0.02")
    assert gm.confidence == "MED"
    assert "DISAGREES" in gm.basis
    agreeing = calibrate_sheet(words, W, H, 0, "S", title_scale="1:125")
    assert agreeing.confidence == "HIGH" and "agrees" in agreeing.basis


# ── what the real sheets taught ─────────────────────────────────────────
def test_the_sheet_frame_reference_grid_is_not_the_building_grid():
    """An A1 frame carries A–P down both borders and 1–20 along both, 16 pt
    from the edge at a perfectly even pitch. Ranked on label count it beats
    every building grid; with stray dims it even calibrates. It is border
    furniture and must not be read."""
    words, lx, ny = plan_sheet()
    frame = []
    for i, lab in enumerate("ABCDEFGHJKLMNP"):
        frame.append(word(lab, 16.5, 89 + i * 116.5, 5, 8))
        frame.append(word(lab, W - 20, 89 + i * 116.5, 5, 8))
    for i in range(1, 21):
        frame.append(word(str(i), 81 + (i - 1) * 116.2, 18.7, 6, 8))
        frame.append(word(str(i), 81 + (i - 1) * 116.2, H - 20, 6, 8))
    gm = calibrate_sheet(words + frame, W, H, 0, "S")
    assert [lab for lab, _ in gm.letters] == list("ABCDEF"), gm.basis
    assert [lab for lab, _ in gm.numbers] == ["1", "2", "3", "4", "5"]
    only_frame = calibrate_sheet(frame + [word("3000", 140, 300, 24, 10),
                                          word("3000", 260, 300, 24, 10)],
                                 W, H, 0, "S")
    assert only_frame.status == "NONE", only_frame.basis


def test_a_stray_on_the_bubble_row_does_not_kill_the_axis():
    """A north arrow's 'S' sat 20 pt above the Y01–Y09 row, anchored the
    line, and the discard-whole rule threw away a nine-label axis with a
    perfect chain. Strays of ANOTHER kind are dropped; a legend (many of two
    kinds) is not. A stray of the SAME kind ('S' beside A–F) stays a member
    and fails density, as in the source — no subsequence is ever extracted."""
    words, _, _ = plan_sheet()
    words += [word("5", 2000, 1480, 6, 8), word("97", 380, 1502, 10, 8)]
    gm = calibrate_sheet(words, W, H, 0, "S")
    assert gm.status == "CALIBRATED", gm.basis
    assert [lab for lab, _ in gm.letters] == list("ABCDEF")
    ys, _ = axis_words([f"Y0{i}" for i in range(1, 7)], 400,
                       [2628, 5228, 5795, 2090, 9055], MM_PER_PT_100,
                       "X", 250, 280)
    ys += [word("S", 1645, 233, 5, 7), word("E", 1605, 262, 5, 7)]
    gm = calibrate_sheet(ys, W, H, 0, "S")
    assert gm.status == "CALIBRATED", gm.basis
    assert len(gm.letters) == 6


def test_a_legend_row_mixing_letters_and_numbers_is_not_an_axis():
    legend = []
    for i, lab in enumerate("ABC"):
        legend.append(word(lab, 400 + i * 200, 1500))
        legend.append(word(str(i + 1), 460 + i * 200, 1500))
    gm = calibrate_sheet(legend, W, H, 0, "S")
    assert gm.status == "NONE"


def test_prefixed_labels_make_an_axis_and_a_bay_name():
    """Y01–Y09 across the top and X01–X04 down the side — the labelling of
    the first development package — with the X-running family as letters."""
    ys, yp = axis_words([f"Y0{i}" for i in range(1, 7)], 400,
                        [2628, 5228, 5795, 2090, 9055], MM_PER_PT_100 * 1.25,
                        "X", 250, 280)
    xs, xp = axis_words(["X01", "X02", "X03", "X04"], 500, [9750, 4325, 5425],
                        MM_PER_PT_100 * 1.25, "Y", 100, 135)
    words = ys + xs + [word("E-04", 860, 240, 22, 12), word("A-302", 470, 245, 20, 9)]
    gm = calibrate_sheet(words, W, H, 0, "S")
    assert gm.status == "CALIBRATED", gm.basis
    assert [lab for lab, _ in gm.letters][:3] == ["Y01", "Y02", "Y03"]
    assert [lab for lab, _ in gm.numbers] == ["X01", "X02", "X03", "X04"]
    assert bay_of(gm, yp[2], xp[1]) == "Y03/X02"
    assert "1:125" in gm.basis


def test_descending_labels_are_read_and_emitted_ascending():
    labels, _ = axis_words(["6", "5", "4", "3"], 400, [6000, 7500, 4500],
                           MM_PER_PT_100, "X", 1500, 1470)
    gm = calibrate_sheet(labels, W, H, 0, "S")
    assert gm.status == "CALIBRATED"
    assert [lab for lab, _ in gm.numbers] == ["6", "5", "4", "3"]
    assert "printed descending" in gm.basis


def test_a_chain_far_from_its_bubbles_is_some_other_dimension():
    """Room dimensions 300 pt below the bubble row are not the grid chain."""
    labels, _ = axis_words(list("ABCD"), 400, [6000, 7500, 4500], MM_PER_PT_100,
                           "X", 1500, 1200)
    gm = calibrate_sheet(labels, W, H, 0, "S")
    assert gm.status == "PARTIAL", gm.basis


def test_rotation_is_recorded_not_applied():
    words, _, _ = plan_sheet()
    gm = calibrate_sheet(words, W, H, 270, "S")
    assert gm.rotation == 270 and "rotation 270" in gm.basis
    assert gm.status == "CALIBRATED"


def test_to_dict_is_json_ready():
    import json
    words, _, _ = plan_sheet()
    d = calibrate_sheet(words, W, H, 0, "S").to_dict()
    json.dumps(d)
    assert isinstance(d["mm_per_pt"], str)
    assert d["letters"][0][0] == "A"


def test_constants_carry_their_source_values():
    assert (grid.C28_CHAIN_MIN_MM, grid.C29_CHAIN_MAX_MM) == (800, 20000)
    assert grid.C50_EDGE_BAND == 0.30 and grid.C51_LINE_TOL == 2.5
    assert grid.C52_AXIS_MIN_LABELS == 3 and grid.C53_DENSITY_MIN == 0.60
    assert grid.C54_GAP_OUTLIER == 4.0 and grid.C55_VARIANCE_MED == 0.15
    assert grid.C56_SHEET_BUDGET_MS == 244


# ── real sheets, read-only, skipped when absent ─────────────────────────
PACKAGES = [Path("/Users/ajay/Documents/Projects/test boq"),
            Path("/Users/ajay/Documents/Projects/BOQ Test 2")]


def _plan_sheet_in(folder: Path):
    """The first floor-plan sheet: a file name containing PLAN (FLOOR PLAN
    preferred); else the first sheet whose text layer says PLAN."""
    pdfs = sorted(p for p in folder.glob("*.pdf"))
    for needle in ("FLOOR PLAN", "PLAN"):
        hits = [p for p in pdfs if needle in p.name.upper()]
        if hits:
            return hits[0]
    from readers.extract import extract_words
    for p in pdfs:
        if any(w.text.upper() == "PLAN" for w in extract_words(p, 0)):
            return p
    return None


def _calibrate_real(pdf: Path) -> GridMap:
    from readers.extract import extract_words
    Wr, Hr, rot = page_size_and_rotation(pdf)
    words = extract_words(pdf, 0)
    assert all(-1 <= w.x0 and w.x1 <= Wr + 1 and -1 <= w.y0 and w.y1 <= Hr + 1
               for w in words), "page_size_and_rotation is not extract's frame"
    return calibrate_sheet(words, Wr, Hr, rot, pdf.name)


def test_real_plan_sheets_calibrate_to_a_plausible_scale():
    seen = 0
    for folder in PACKAGES:
        if not folder.is_dir():
            continue
        pdf = _plan_sheet_in(folder)
        if pdf is None:
            continue
        seen += 1
        gm = _calibrate_real(pdf)
        print(f"\n  {pdf.name}: {gm.status} {gm.confidence} "
              f"mm/pt={gm.mm_per_pt}\n    {gm.basis}")
        assert gm.status != "NONE", gm.basis
        if gm.status == "CALIBRATED":
            scale = gm.mm_per_pt / Decimal("0.3528")
            assert 20 <= scale <= 500, f"implausible scale 1:{scale}"
    if not seen:
        print("  (no real packages on disk — skipped)")


def test_real_plan_sheets_never_calibrate_to_nonsense():
    """Every PLAN-named sheet in the packages: a CALIBRATED status means a
    drawing scale a QS would recognise, and the folder is never written."""
    for folder in PACKAGES:
        if not folder.is_dir():
            continue
        before = sorted(os.listdir(folder))
        plans = sorted(p for p in folder.glob("*.pdf") if "PLAN" in p.name.upper())
        for pdf in plans:
            gm = _calibrate_real(pdf)
            if gm.status == "CALIBRATED":
                scale = gm.mm_per_pt / Decimal("0.3528")
                assert 20 <= scale <= 500, f"{pdf.name}: 1:{scale} — {gm.basis}"
        assert sorted(os.listdir(folder)) == before, "the project folder was written"


def test_page_size_and_rotation_is_the_displayed_upright_page():
    for folder in PACKAGES:
        if not folder.is_dir():
            continue
        for pdf in sorted(folder.glob("*.pdf"))[:3]:
            Wr, Hr, rot = page_size_and_rotation(pdf)
            assert rot in (0, 90, 180, 270)
            assert Wr > 0 and Hr > 0
            from readers.extract import extract_words
            words = extract_words(pdf, 0)
            assert all(w.x1 <= Wr + 1 and w.y1 <= Hr + 1 for w in words)
