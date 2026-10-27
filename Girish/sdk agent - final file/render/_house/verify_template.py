#!/usr/bin/env python3
"""
verify_template.py — G-FORMAT.

Diffs a produced workbook against `references/house-template.md` v2.0, the
format measured off eleven issued tender workbooks.

INDEPENDENCE. This file does NOT import the builder and does not read the
builder's constants. Every figure below is restated here from the template. If
it imported them the two would agree by construction and the gate would prove
nothing — which is exactly how the previous template survived being the wrong
format for as long as it did: the builder and its checker agreed with each
other, and neither had ever been compared to what the office actually issues.

  python3 verify_template.py <workbook.xlsx> [--sheet NAME] [--strict-h]

Exit 0 = the workbook is the house format.
Exit 1 = it is not, and every deviation is named.
"""
import sys, argparse, re
from pathlib import Path

import openpyxl

# ---- restated from house-template.md v2.0 ---------------------------------
FONT_NAME = "Arial"
# Type sizes, unanimous across all 660 issued pages. The band is NOT one size.
SZ_BODY, SZ_LABEL, SZ_SECTION_TITLE, SZ_PROJECT = 10.0, 8.0, 9.0, 10.0
ROW_H = 12.75
PAGE_ROWS = 62
WIDTHS = {"A": 4.711, "B": 1.711, "C": 31.711, "D": 15.711,
          "E": 8.711, "F": 5.711, "G": 12.711}
H_RANGE = (14.5, 18.0)              # the issued set does not agree on H
H_HOUSE = 15.711

O_SPACER, O_HEAD1, O_HEAD2 = 4, 5, 6
O_BODY_FIRST, O_BODY_LAST, O_TOCOLL, O_LAST = 9, 54, 60, 61

# MANDATORY on every bill page, priced or not. Measured 157/157.
HEAD_REQUIRED = {(0, 4): "BILL OF QUANTITIES", (0, 8): "PAGE NO.",
                 (O_HEAD1, 3): "ITEM DESCRIPTION",
                 (O_HEAD1, 8): "TOTAL PRICE", (O_HEAD2, 8): "AED"}
# OPTIONAL — a narrative, collection or preamble page carries no ITEM column
# and often no RATE column. Measured: BILL NO. on 138 of 157 pages, the G
# UNIT/RATE pair on 112. So their ABSENCE is not a defect; their being wrong
# when present is. An earlier version of this gate required all of them and
# raised 127 false failures against the client's own bills.
HEAD_OPTIONAL = {(0, 7): "BILL NO.",
                 (O_HEAD1, 1): "ITEM", (O_HEAD2, 1): "REF.",
                 (O_HEAD1, 5): "QUANTITY", (O_HEAD1, 6): "UNIT",
                 (O_HEAD1, 7): "UNIT", (O_HEAD2, 7): "RATE"}

# BOTH are in issue and neither is a defect. Measured over every priced row of
# all eleven workbooks: QUANTITY 1129 bracketed-red / 768 Accounting; RATE 1290
# / 339; AMOUNT 675 / 1192 — the money column is mostly Accounting. The gate
# accepts either; asserting one would fail the client's own bills.
FMT_QTY = ['#,##0_);[Red](#,##0)',
           '_(* #,##0_);_(* (#,##0);_(* "-"??_);_(@_)']
FMT_MON = ['#,##0.00_);[Red](#,##0.00)',
           '_(* #,##0.00_);_(* (#,##0.00);_(* "-"??_);_(@_)']
T_COLLECTION = "To Collection"

ADDITIONAL = [
    "The Tenderer shall list below and price any items not",
    "included herein but contained in the Tender Drawings, ",
    "mentioned in the Specifications or required for the ",
    "satisfactory completion of this section. Any such item ",
    "not listed below shall be deemed to be included",
]

# Vertical rules, read down the page: left of A, right of A, left of E, right
# of E, right of F, right of G, right of H. B, C and D carry none.
# Measured over 30,360 issued body rows. Only two rules are ABSOLUTE — left of
# A at 100.0% and right of H at 100.0% — and B and C are absolutely unruled
# (0.0-0.1%). The rest is the house pattern at 86-91%: roughly one issued page
# in ten drifts. So the gate has two strengths. Against OUR OWN output the
# house pattern is required. Against a sheet somebody else made (--as-issued)
# only the absolutes are required and the rest is reported as drift, because a
# gate that fails the client's own bills is measuring the wrong thing.
BODY_LEFT   = {1, 5, 6, 7}
BODY_RIGHT  = {1, 5, 6, 7, 8}
RULE_ABS_L  = {1}
RULE_ABS_R  = {8}
NEVER_RULED = {2, 3}

# Item serial letters. They restart on EVERY page and skip BOTH I and O.
# Confirmed twice: the issued bills' longest page runs A B C D E F G H J K L M
# N P Q R S — I appears 0 times and O appears 0 times across every sheet — and
# the user confirmed it as the house rule. A bill that runs ...H I J... is not
# this office's bill, and the error is invisible once it is printed, because
# every OTHER letter still looks right.
ITEM_LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ"

# A VARIANT is a priced line whose description is a bare size, thickness or
# width — "20mm PPR Piping", "Grade slab, 150mm thick", "200mm wide". The house
# convention, measured 316 times across the issued set and in EVERY section not
# only MEP, is: one description block, then a run of variants that inherit it.
#
# The description is what makes the rate binding. "20mm PPR Piping" priced at 16
# says nothing about whether the rate covers fittings, valves, supports and
# testing; the paragraph above it does, and that paragraph is what a contractor
# is held to. A variant billed with no description block above it is an item
# nobody can price and nobody can enforce — and it looks completely normal on
# the page, which is why it is gated rather than trusted.
VARIANT = re.compile(
    r"^\s*\d+(?:\.\d+)?\s*(mm|MM|m|M|\"|inch|Ø|sqmm)\b"          # 20mm ...
    r"|.*\b\d+(?:\.\d+)?\s*(mm|MM)\s+(thick|wide|high|deep|dia)\b",  # ... 150mm thick
    re.I)

# ---- EVERY OTHER FROZEN STRING ---------------------------------------------
# Until v3.6.0 these lived in the builder and NOTHING checked them. The head
# band and the tenderer paragraph were gated; the section heading, the
# collection block, the section total, the rule line and the price notes were
# not. A gate that tests some of the frozen strings and not the rest gives the
# same green light either way, which is worse than no gate at all — it is a
# green light that means nothing.
#
# Exact forms, counted across the issued set.
# The title is NOT allowed to swallow a continuation marker: an earlier version
# used a lazy (.+?) and passed both "… SITE WORKS [CONT'D]" and
# "… SITE WORKS (Cont'd)". The section marker is "(CONT'D)", upper case, round
# brackets, straight apostrophe — and nothing else.
S_SECTION      = re.compile(r"^SECTION ([A-R]) - ([^(\[]+?)( \(CONT'D\))?$")
S_CONT_LOOSE   = re.compile(r"cont\s*'?\s*d", re.I)
S_ELEMENT_CONT = re.compile(r"^(.+) \(Cont'd\)$")
T_COLLECTION_H = "COLLECTION"                       # 47 uses, exactly this
T_ADDITIONAL   = "LIST ANY ADDITIONAL ITEMS"        # 49 uses
T_RULE         = "-" * 48                           # 125 uses, exactly 48
T_TO_TENDER    = "TOTAL CARRIED TO FORM OF TENDER"
T_AMOUNT_WORDS = "AMOUNT IN WORDS"
S_PAGE         = re.compile(r"^Page \S+$")
# The line ends on a comma and continues on the next row. Where the section
# title is long — MECHANICAL ENGINEERING INSTALLATIONS — the issued bills wrap
# the TITLE itself onto the next row, so the comma is not on this one. Both are
# accepted; what is NOT accepted is a form that never reaches "CARRIED TO
# SUMMARY", and that is checked separately.
S_TOTAL_FOR    = re.compile(r"^TOTAL FOR BILL NO\. \S+ - SECTION [A-R] - .+?,?\s?$")
# TWO spaces before the dash. Measured on every one of them.
S_CARRIED      = re.compile(r"^CARRIED TO SUMMARY  - \S+$")
# Compared case-INSENSITIVELY: the issued bills write Included, INCLUDED and
# included, all three, and the casing is not the thing under test.
PRICE_NOTES    = {"included", "n.a", "n/a", "by ose", "rate only", "excluded",
                  "nil", "item", "na",
                  # Provisional Sum, both spellings the issued bills use
                  "p-sum", "p- sum", "p sum", "provisional sum"}

fails, notes = [], []


def fail(msg):
    fails.append(msg)


def note(msg):
    """Drift, not a defect. Used only when reading a workbook this office did
    not produce: the issued set is not perfectly consistent with itself, and
    reporting its own variation as failure would be a gate with no meaning."""
    notes.append(msg)


def fmt_eq(a, b):
    """Compare number formats by MEANING, not spelling. LibreOffice re-spells
    a format on the round trip — it escapes the parentheses and the minus — and
    a gate that compares strings fails on a workbook that is correct."""
    def n(x):
        return re.sub(r"\\(.)", r"\1", str(x or "")).replace(" ", "")
    if isinstance(b, (list, tuple)):
        return any(n(a) == n(x) for x in b)
    return n(a) == n(b)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("workbook")
    ap.add_argument("--sheet")
    ap.add_argument("--as-issued", action="store_true",
                    help="testing a third-party workbook: require only what is "
                         "invariant in the issued set, report the rest as drift")
    ap.add_argument("--strict-h", action="store_true",
                    help="require H to be exactly the house 15.711")
    a = ap.parse_args()

    wb = openpyxl.load_workbook(a.workbook)
    names = [a.sheet] if a.sheet else [
        ws.title for ws in wb.worksheets
        if ws.title.upper() != "MEASUREMENT"
        and not ws.title.strip().lower().startswith("cover")]
    if not names:
        raise SystemExit("ABORT: no BOQ sheet found in the workbook.")

    SUMMARY_D = {"SUMMARY", "GRAND SUMMARY", "AD SUMMARY"}
    for name in names:
        ws = wb[name]
        p = f"[{name}]"
        # A SUMMARY or PREAMBLE sheet is a different sheet type with its own
        # widths and no ITEM/QUANTITY/RATE band. Testing it against the bill
        # page profile is a category error, not a finding.
        head_d = {str(ws.cell(r, 4).value or "").strip().upper()
                  for r in range(1, min(ws.max_row, 20) + 1)}
        if head_d & SUMMARY_D or "PREAMBLE" in name.upper():
            print(f"  [{name}] is a summary/preamble sheet — bill-page profile "
                  f"not applicable, skipped")
            continue

        # ---- sheet set-up -------------------------------------------------
        if ws.page_setup.orientation != "portrait":
            (note if a.as_issued else fail)(
                f"{p} orientation is {ws.page_setup.orientation}, "
                f"not portrait")
        if str(ws.page_setup.paperSize) != "9":
            (note if a.as_issued else fail)(
                f"{p} paperSize is {ws.page_setup.paperSize}, not 9 (A4)")
        for attr, want in (("left", 0.25), ("right", 0.25),
                           ("top", 0.5), ("bottom", 0.5)):
            got = getattr(ws.page_margins, attr)
            if got is None or abs(got - want) > 0.01:
                (note if a.as_issued else fail)(
                    f"{p} margin {attr} is {got}, not {want}")

        # ---- columns ------------------------------------------------------
        for col, want in WIDTHS.items():
            got = ws.column_dimensions[col].width
            if got is None or abs(got - want) > 0.01:
                (note if a.as_issued else fail)(
                    f"{p} column {col} width is {got}, not {want}")
        h = ws.column_dimensions["H"].width
        if h is None:
            fail(f"{p} column H has no width set")
        elif a.strict_h and abs(h - H_HOUSE) > 0.01:
            fail(f"{p} column H width is {h}, not the house {H_HOUSE}")
        elif not (H_RANGE[0] <= (h or 0) <= H_RANGE[1]):
            fail(f"{p} column H width is {h}, outside the issued range "
                 f"{H_RANGE[0]}-{H_RANGE[1]}")

        # ---- find the pages by their head band ----------------------------
        heads = [r for r in range(1, ws.max_row + 1)
                 if ws.cell(r, 3).value == "ITEM DESCRIPTION"]
        if not heads:
            fail(f"{p} carries no 'ITEM DESCRIPTION' head band at all")
            continue
        starts = [r - O_HEAD1 for r in heads]
        if starts[0] != 1:
            fail(f"{p} first page starts at row {starts[0]}, not row 1")
        for i, (x, y) in enumerate(zip(starts, starts[1:]), 1):
            if y - x != PAGE_ROWS:
                (note if a.as_issued else fail)(
                    f"{p} page {i} to {i+1} pitch is {y - x} rows, "
                    f"not {PAGE_ROWS}")

        for n, P in enumerate(starts, 1):
            q = f"{p} page {n}"
            priced = ws.cell(P + O_HEAD1, 1).value == "ITEM"
            for (off, col), text in HEAD_REQUIRED.items():
                got = ws.cell(P + off, col).value
                if got != text:
                    fail(f"{q} head cell {P + off}/{col} is {got!r}, "
                         f"not {text!r}")
            for (off, col), text in HEAD_OPTIONAL.items():
                got = ws.cell(P + off, col).value
                if got is not None and got != text:
                    fail(f"{q} head cell {P + off}/{col} is {got!r}, "
                         f"not {text!r}")
            if not priced and not a.as_issued:
                for off, col in ((O_HEAD1, 5), (O_HEAD1, 6), (O_HEAD1, 7)):
                    if ws.cell(P + off, col).value is not None:
                        fail(f"{q} carries no ITEM column but its head band "
                             f"still shows {ws.cell(P + off, col).value!r} — "
                             f"an unpriced page's head is abbreviated")
            if ws.cell(P + O_SPACER, 3).value != " ":
                fail(f"{q} spacer row C is "
                     f"{ws.cell(P + O_SPACER, 3).value!r}, not a single space")

            # ---- row heights ---------------------------------------------
            for r in range(P, P + PAGE_ROWS):
                hh = ws.row_dimensions[r].height
                if hh is not None and abs(hh - ROW_H) > 0.01 and not a.as_issued:
                    fail(f"{q} row {r} height is {hh}, not {ROW_H}")
                    break

            # ---- fonts, by role ------------------------------------------
            roles = [((0, 1), SZ_PROJECT), ((0, 4), SZ_LABEL),
                     ((0, 7), SZ_LABEL), ((0, 8), SZ_LABEL),
                     ((2, 4), SZ_SECTION_TITLE),
                     ((O_HEAD1, 3), SZ_LABEL), ((O_HEAD1, 8), SZ_LABEL)]
            for (off, col), sz in roles:
                c = ws.cell(P + off, col)
                if c.value is None:
                    continue
                if c.font.name != FONT_NAME or float(c.font.sz or 0) != sz:
                    (note if a.as_issued else fail)(
                        f"{q} head cell {c.coordinate} is "
                        f"{c.font.name} {c.font.sz}, not {FONT_NAME} {sz}")
            for r in range(P + O_BODY_FIRST, P + O_BODY_LAST + 1):
                for col in range(1, 9):
                    c = ws.cell(r, col)
                    if c.value is None:
                        continue
                    if c.font.name != FONT_NAME \
                       or float(c.font.sz or 0) != SZ_BODY:
                        fail(f"{q} body cell {c.coordinate} is "
                             f"{c.font.name} {c.font.sz}, not "
                             f"{FONT_NAME} {SZ_BODY}")
                        break
                else:
                    continue
                break

            # ---- vertical rules ------------------------------------------
            # Scan EVERY body row that carries content, not one sample row.
            # A gate that tests one row per page proves that one row.
            def side(bd, which):
                sd = getattr(bd, which, None)
                return getattr(sd, "style", None) if sd else None
            body_rows = [rr for rr in range(P + O_BODY_FIRST, P + O_BODY_LAST + 1)
                         if any(ws.cell(rr, c).value is not None
                                for c in range(1, 9))] or [P + O_BODY_FIRST + 2]
            for r, col in ((rr, c) for rr in body_rows for c in range(1, 9)):
                b = ws.cell(r, col).border
                if a.as_issued:
                    # Only the absolutes. Left of A is 100.0% of 30,360 issued
                    # body rows and right of H is 100.0%; everything else runs
                    # 86-91%, so requiring it here would fail the client's own
                    # bills — which would mean the gate was measuring the
                    # template's opinion, not the format.
                    if col in RULE_ABS_L and side(b, "left") != "thin":
                        fail(f"{q} body row {r} col {col}: left rule absent — "
                             f"this one is invariant in the issued set")
                    if col in RULE_ABS_R and side(b, "right") != "thin":
                        fail(f"{q} body row {r} col {col}: right rule absent — "
                             f"this one is invariant in the issued set")
                    if col in NEVER_RULED and (side(b, "left") == "thin"
                                               or side(b, "right") == "thin"):
                        # 0.0-0.1% of issued body rows do carry a stray rule
                        # here. Against our own output it is a defect; against
                        # someone else's book it is drift.
                        note(f"{q} body row {r} col {col} is ruled. B and C "
                             f"are inside the description column and are "
                             f"never ruled in the issued set")
                    continue
                want_l, want_r = col in BODY_LEFT, col in BODY_RIGHT
                if (side(b, "left") == "thin") != want_l:
                    fail(f"{q} body row {r} col {col}: left rule "
                         f"{'present' if side(b, 'left') else 'absent'}, "
                         f"expected {'present' if want_l else 'absent'}")
                if (side(b, "right") == "thin") != want_r:
                    fail(f"{q} body row {r} col {col}: right rule "
                         f"{'present' if side(b, 'right') else 'absent'}, "
                         f"expected {'present' if want_r else 'absent'}")
            if any(side(ws.cell(r, c).border, "left") for c in NEVER_RULED):
                fail(f"{q} has a rule inside B/C/D — those three are ONE "
                     f"description column and carry no rule between them")

            # ---- wrapText is forbidden in the body ------------------------
            for rr in range(P + O_BODY_FIRST, P + O_BODY_LAST + 1):
                if ws.cell(rr, 3).alignment.wrapText:
                    (note if a.as_issued else fail)(
                        f"{q} cell C{rr} uses wrapText. A wrapped cell "
                         f"changes height and a changed height breaks the "
                        f" A wrapped cell changes height and a changed height"
                        f" breaks the {PAGE_ROWS}-row page.")
                    break

            # ---- item serial letters --------------------------------------
            seq = [str(ws.cell(r, 1).value).strip()
                   for r in range(P + O_BODY_FIRST, P + O_BODY_LAST + 1)
                   if isinstance(ws.cell(r, 1).value, str)
                   and len(str(ws.cell(r, 1).value).strip()) == 1
                   and str(ws.cell(r, 1).value).strip().isalpha()]
            if seq:
                want = list(ITEM_LETTERS[:len(seq)])
                if seq != want:
                    bad = [x for x in seq if x in ("I", "O")]
                    why = (f" — I and O are never used; found {bad}" if bad
                           else " — the letters must restart at A on every page "
                                "and run in order")
                    fail(f"{q} item letters are {''.join(seq)}, "
                         f"not {''.join(want)}{why}")

            # ---- variant runs must carry a description block ---------------
            # Parse the body into BLOCKS first. A block is either a DESC (text
            # rows that do not follow an item) or an ITEM (an item row plus the
            # wrapped continuation lines under it). Then: any maximal run of
            # ITEM blocks containing a variant must be preceded by a DESC of
            # two lines or more.
            #
            # The first version of this check looked back from the first
            # VARIANT rather than from the first ITEM of the run, and reported
            # the client's own Concrete pages as orphaned — the description was
            # there, with two unsized items ("Foundation…", "Columns") standing
            # between it and the first sized one.
            blocks = []
            rr = P + O_BODY_FIRST
            last_item = False
            while rr <= P + O_BODY_LAST:
                v = ws.cell(rr, 1).value
                t = ws.cell(rr, 3).value
                is_i = (isinstance(v, str) and len(v.strip()) == 1
                        and v.strip().isalpha())
                has_t = isinstance(t, str) and t.strip() != ""
                if is_i:
                    blocks.append(["ITEM", [t or ""], rr, rr])
                    last_item = True
                elif has_t and last_item and blocks:
                    blocks[-1][1].append(t)          # wrapped continuation
                    blocks[-1][3] = rr
                elif has_t:
                    if blocks and blocks[-1][0] == "DESC" \
                       and blocks[-1][3] == rr - 1:
                        blocks[-1][1].append(t); blocks[-1][3] = rr
                    else:
                        blocks.append(["DESC", [t], rr, rr])
                    last_item = False
                rr += 1
            i = 0
            while i < len(blocks):
                if blocks[i][0] != "ITEM":
                    i += 1
                    continue
                j = i
                while j < len(blocks) and blocks[j][0] == "ITEM":
                    j += 1
                run = blocks[i:j]
                variants = [b2 for b2 in run if VARIANT.match(b2[1][0] or "")]
                if variants:
                    # Walk back past SINGLE-LINE headings. The issued bills put
                    # a sub-heading between the description and the variants —
                    # "Hollow Block Walls", "Solid Block Walls", "uPVC Pipe" —
                    # and an earlier version of this check called every one of
                    # those an orphan, 30 times, on the client's own bills.
                    k2, found = i - 1, False
                    while k2 >= 0 and blocks[k2][0] == "DESC":
                        if len(blocks[k2][1]) >= 2:
                            found = True
                            break
                        k2 -= 1          # a one-line heading, keep looking
                    if not found:
                        # In --as-issued this is a NOTE, not a failure: a run
                        # that continues across a page break has its
                        # description on the PREVIOUS page, and this parse is
                        # per-page. Against our own output it stays a failure,
                        # because the builder keeps a description and its
                        # variants on ONE page — they are one bill item, and a
                        # contractor pricing page 5 cannot read page 4.
                        (note if a.as_issued else fail)(
                            f"{q} rows {run[0][2]}-{run[-1][3]} bill "
                            f"{len(variants)} sized variant(s) "
                            f"({variants[0][1][0].strip()[:30]!r} …) with NO "
                            f"description block above the run. A bare size is "
                            f"not a priceable item — the paragraph above is "
                            f"what the rate is deemed to include")
                i = j

            # ---- To Collection -------------------------------------------
            tc = ws.cell(P + O_TOCOLL, 4).value
            amt = ws.cell(P + O_TOCOLL, 8)
            if not priced:
                # The COLLECTION page carries the section total, not a To
                # Collection line; a narrative page carries neither.
                if tc == T_COLLECTION and not a.as_issued:
                    fail(f"{q} carries no ITEM column and must not carry "
                         f"'To Collection'")
            else:
                if tc != T_COLLECTION:
                    (note if a.as_issued else fail)(
                        f"{q} row {P + O_TOCOLL} column D is {tc!r}, "
                        f"not {T_COLLECTION!r}")
                    if a.as_issued:
                        continue
                # The issued set does NOT standardise this range — 84 distinct
                # variants appear, because each page was ranged by hand to
                # cover its own items. So the invariant is not a literal
                # string: it is that the SUM lies inside the page's body band
                # and CATCHES EVERY PRICED ROW ON THE PAGE. That is the error
                # worth gating — a range that misses an item is a bill that
                # under-adds, and it looks perfectly normal.
                m = re.match(r"=SUM\(H(\d+):H(\d+)\)$",
                             str(amt.value or "").replace(" ", ""))
                if not m:
                    (note if a.as_issued else fail)(
                        f"{q} To Collection is {amt.value!r}, not a "
                        f"=SUM(H..:H..) over this page")
                else:
                    lo, hi = int(m.group(1)), int(m.group(2))
                    if lo < P + 7 or hi > P + 59 or lo > hi:
                        fail(f"{q} To Collection sums H{lo}:H{hi}, which "
                             f"leaves the page body band "
                             f"H{P + 7}:H{P + 59}")
                    # A row is PRICED only if column H holds a number or a
                    # formula. The issued bills write INCLUDED, N.A and By OSE
                    # as text in H, deliberately, and those rows are not part
                    # of the page total. Counting them as priced reports the
                    # client's own bill as under-adding when it is correct —
                    # which this check did, on Masonry page 2, until it was
                    # fixed here.
                    def is_priced(r2):
                        v = ws.cell(r2, 8).value
                        if v is None:
                            return False
                        if isinstance(v, str):
                            return v.startswith("=")
                        return isinstance(v, (int, float))
                    priced_rows = [r2 for r2 in range(P + 7, P + 60)
                                   if r2 != P + O_TOCOLL and is_priced(r2)]
                    missed = [r2 for r2 in priced_rows if not lo <= r2 <= hi]
                    if missed:
                        fail(f"{q} To Collection sums H{lo}:H{hi} and MISSES "
                             f"priced row(s) {missed[:6]} — the page total is "
                             f"short")
                if not fmt_eq(amt.number_format, FMT_MON):
                    fail(f"{q} To Collection format is "
                         f"{amt.number_format!r}, not one of the two issued")

            # ---- body number formats -------------------------------------
            for rr in range(P + O_BODY_FIRST, P + O_BODY_LAST + 1):
                if ws.cell(rr, 5).value is not None \
                   and not fmt_eq(ws.cell(rr, 5).number_format, FMT_QTY):
                    (note if a.as_issued else fail)(
                        f"{q} E{rr} format is "
                        f"{ws.cell(rr, 5).number_format!r}, not one of the two "
                        f"issued")
                    break
            for col in (7, 8):
                for rr in range(P + O_BODY_FIRST, P + O_BODY_LAST + 1):
                    c = ws.cell(rr, col)
                    if isinstance(c.value, str) and not str(c.value).startswith("="):
                        continue          # 'Included', 'N.A', 'By OSE'
                    if c.value is not None and not fmt_eq(c.number_format, FMT_MON):
                        (note if a.as_issued else fail)(
                            f"{q} {c.coordinate} format is "
                            f"{c.number_format!r}, not one of the two issued")
                        break

        # ---- every other frozen string, wherever it appears ---------------
        for r in range(1, ws.max_row + 1):
            for col in (3, 4, 8):
                v = ws.cell(r, col).value
                if not isinstance(v, str) or not v.strip():
                    continue
                t = v.rstrip("\n")
                ts = t.strip()
                if ts.upper().startswith("SECTION ") and " - " in ts:
                    m2 = S_SECTION.match(t.rstrip())
                    if m2 and S_CONT_LOOSE.search(m2.group(2)):
                        m2 = None          # marker hiding inside the title
                    if not m2:
                        fail(f"{p} {ws.cell(r, col).coordinate} section heading "
                             f"is {t!r}. The frozen form is "
                             f"'SECTION {{L}} - {{TITLE}}' and, on a repeat, "
                             f"\"SECTION {{L}} - {{TITLE}} (CONT'D)\" — upper "
                             f"case, straight apostrophe")
                if ts.upper() == "COLLECTION" and ts != T_COLLECTION_H:
                    fail(f"{p} {ws.cell(r, col).coordinate} is {t!r}, "
                         f"not {T_COLLECTION_H!r}")
                if ts.upper().startswith("LIST ANY ADDITIONAL") \
                   and ts != T_ADDITIONAL:
                    fail(f"{p} {ws.cell(r, col).coordinate} is {t!r}, "
                         f"not {T_ADDITIONAL!r}")
                if set(ts) == {"-"} and ts != T_RULE:
                    fail(f"{p} {ws.cell(r, col).coordinate} rule line is "
                         f"{len(ts)} dashes, not {len(T_RULE)}")
                if ts.upper().startswith("TOTAL CARRIED TO FORM") \
                   and ts != T_TO_TENDER:
                    fail(f"{p} {ws.cell(r, col).coordinate} is {t!r}, "
                         f"not {T_TO_TENDER!r}")
                if ts.upper().startswith("AMOUNT IN WORD") \
                   and ts != T_AMOUNT_WORDS:
                    fail(f"{p} {ws.cell(r, col).coordinate} is {t!r}, "
                         f"not {T_AMOUNT_WORDS!r}")
                if ts.upper().startswith("TOTAL FOR BILL") \
                   and not S_TOTAL_FOR.match(t):
                    fail(f"{p} {ws.cell(r, col).coordinate} is {t!r}. The "
                         f"frozen form is 'TOTAL FOR BILL NO. {{code}} - "
                         f"SECTION {{L}} - {{TITLE}}, ' — ending on a comma, "
                         f"the sentence continuing on the next row")
                if ts.upper().startswith("CARRIED TO SUMMARY") \
                   and not S_CARRIED.match(ts):
                    fail(f"{p} {ws.cell(r, col).coordinate} is {t!r}. The "
                         f"frozen form is 'CARRIED TO SUMMARY  - {{ref}}' — "
                         f"TWO spaces before the dash, on every one of the "
                         f"issued ones")
                # the money column, BODY rows only — the head band legitimately
                # carries TOTAL PRICE and AED in H
                in_body = any(P2 + O_BODY_FIRST <= r <= P2 + O_BODY_LAST
                              for P2 in starts)
                if col == 8 and in_body and not ts.startswith("=") and ts \
                   and not re.match(r"^[\d,.\-()]+$", ts) \
                   and re.sub(r"\s+", " ", ts.lower()) not in PRICE_NOTES:
                    fail(f"{p} {ws.cell(r, col).coordinate} carries the text "
                         f"{t!r} in the money column. The only words the issued "
                         f"bills put there are "
                         f"{', '.join(sorted(PRICE_NOTES))} (any casing)")

        # ---- MEP description closer (sections Q and R) --------------------
        # Family 3 in description-conventions.md. Strict mode only: this is a
        # DRAFTING rule, and against a workbook the office did not write it is
        # an observation, not a defect.
        if not a.as_issued:
            letters = {m3.group(1) for m3 in
                       (S_SECTION.match(str(ws.cell(r, 3).value or "").rstrip())
                        for r in range(1, ws.max_row + 1)) if m3}
            if letters & {"Q", "R"}:
                for r in range(1, ws.max_row + 1):
                    v = ws.cell(r, 3).value
                    if not isinstance(v, str):
                        continue
                    if v.strip().lower().startswith("supply and install all"):
                        tail = " ".join(
                            str(ws.cell(x, 3).value or "").strip()
                            for x in range(r, min(r + 12, ws.max_row + 1)))
                        if "complete installation as indicated" not in tail:
                            fail(f"{p} C{r} opens an MEP description "
                                 f"'Supply and install all …' but does not "
                                 f"close it '… and any other items required "
                                 f"for a complete installation as indicated.' "
                                 f"— the frozen Q/R form, see "
                                 f"description-conventions.md §2 Family 3")

        # ---- the additional-items paragraph, wherever it appears ----------
        for r in range(1, ws.max_row + 1):
            if ws.cell(r, 3).value == "LIST ANY ADDITIONAL ITEMS":
                for k, want in enumerate(ADDITIONAL):
                    got = ws.cell(r + 2 + k, 3).value
                    if got != want:
                        fail(f"{p} additional-items line {k + 1} is {got!r}, "
                             f"not {want!r} — trailing spaces included")

    print(f"Checked {len(names)} sheet(s): {', '.join(names)}")
    if notes:
        print(f"\n  {len(notes)} drift note(s) — variation within the issued "
              f"set, not a defect:")
        for n in notes[:12]:
            print(f"    {n}")
        if len(notes) > 12:
            print(f"    ... and {len(notes) - 12} more")
    if fails:
        print(f"\nFORMAT GATE FAILED — {len(fails)} deviation(s) "
              f"from house-template.md v2.0\n")
        for f in fails:
            print(f"  {f}")
        print("\nThe template is measured off the client's issued bills. A "
              "deviation here\nis a defect in the OUTPUT, not in the template — "
              "unless the issued bills\nhave changed, in which case re-measure "
              "and version the template first.")
        sys.exit(1)
    print("Format gate passed: the workbook is the house format.")


if __name__ == "__main__":
    main()
