#!/usr/bin/env python3
"""
register.py — the drawing register, and the two things in it with money attached.

Assembles one SheetRecord per file from the title block, the discipline matrix
and the probe tier. Then does the two jobs that are the reason this stage
exists at all:

Revision resolution. Where the same drawing number appears more than once, the
highest revision is measured and the others are marked superseded. A package
routinely carries a _Preliminary Submission folder beside the approved set, and
measuring both quietly doubles that discipline. It is a mistake that does not
announce itself: the quantities look plausible, the arithmetic is correct, and
the number is simply twice what it should be.

Duplicate reporting. Two different files claiming one drawing number at the
SAME revision is not a revision question, it is a package defect, and it is
reported rather than resolved by picking one.

Nothing here guesses. A sheet whose block could not be read is carried on the
register as unresolved, because a register that silently drops a sheet is worse
than one that admits it could not read forty of them.

Each sheet is opened ONCE. Probing and title-block reading both need the
page's words, so they share a single read: on a 507-sheet package the naive
version does 1,014 file opens and two full text passes per sheet, and the run
goes quiet for minutes with nothing to show it is alive. The per-sheet work is
independent, so it runs through spine.concurrency.ordered_map, which hands
results back in INPUT order however they complete — an unsorted result list is
the most common cause of "same inputs, different output", and it is silent.

  python3 -m readers.register <dir> [--patterns P] [--matrix M] [--out R.json]

Exit 0 = every sheet resolved. Exit 1 = unresolved sheets present (they are on
the register and in the gap list). Exit 2 = directory unreadable.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import asdict
from pathlib import Path

from ingest.discipline_matrix import DisciplineMatrix
from ingest.titleblocks import PatternSet
from readers.extract import _open, extract_words, page_display_size
from readers.probe import classify, counts
from readers.titleblock import read_fields

# Per-sheet time budget for the register pass. A drawing sheet reads in well
# under a second; a file that takes longer than this is not a sheet the
# register can describe (a specification, a corrupt file) and is listed
# unresolved with the reason rather than holding the stage.
SHEET_BUDGET_S = 90.0
from readers.walk import walk
from spine.concurrency import ordered_map
from spine.errors import BoqError
from spine.gaps import Gap, GapList
from readers.project_identity import from_reading
from spine.records import SheetRecord, Tier

STAGE = "S1"
DATA = Path(__file__).resolve().parent.parent / "data"

# preliminary issues sort BELOW lettered issues, which sort below numbered ones
RE_PRELIM = re.compile(r"^P0?(\d{1,2})$", re.IGNORECASE)
RE_LETTER = re.compile(r"^([A-Z])(\d{0,2})$", re.IGNORECASE)
RE_NUMBER = re.compile(r"^0?(\d{1,3})$")


def _rev_key(revision: str | None) -> tuple:
    """Normalise a revision for ordering.

    Its own function because consultants write revisions three or four ways and
    every package teaches it something new. The bands are deliberate:

        P1, P0 2   preliminary   band 0
        A, B, C    issued        band 1
        0, 1, 02   numbered      band 2

    An unreadable revision sorts LOWEST, so a sheet whose revision could not be
    read never silently supersedes one that could."""
    if not revision:
        return (-1, 0, 0)
    token = revision.strip().upper()
    m = RE_PRELIM.match(token)
    if m:
        return (0, int(m.group(1)), 0)
    m = RE_LETTER.match(token)
    if m:
        return (1, ord(m.group(1)) - ord("A"), int(m.group(2) or 0))
    m = RE_NUMBER.match(token)
    if m:
        return (2, int(m.group(1)), 0)
    return (-1, 0, 0)


def resolve_revisions(sheets: list[SheetRecord]) -> list[SheetRecord]:
    """Highest revision per drawing number governs; the rest get
    superseded_by set to the governing file's doc_id."""
    by_number: dict[str, list[SheetRecord]] = {}
    for s in sheets:
        if s.drawing_no:
            by_number.setdefault(s.drawing_no, []).append(s)
    superseded: dict[str, str] = {}
    for number, group in sorted(by_number.items()):
        if len(group) < 2:
            continue
        ranked = sorted(group, key=lambda s: (_rev_key(s.revision), s.doc_id),
                        reverse=True)
        governing = ranked[0]
        for s in ranked[1:]:
            superseded[s.doc_id] = governing.doc_id
    out = []
    for s in sheets:
        out.append(SheetRecord(**{**asdict(s), "tier": s.tier,
                                  "superseded_by": superseded.get(s.doc_id)})
                   if s.doc_id in superseded else s)
    return out


def find_duplicates(sheets: list[SheetRecord]) -> list[Gap]:
    """Same drawing_no AND same revision, different files. A package defect."""
    seen: dict[tuple, list[str]] = {}
    for sheet in sheets:
        if not sheet.drawing_no:
            continue
        seen.setdefault((sheet.drawing_no, sheet.revision or ""), []).append(sheet.doc_id)
    gaps = []
    for (number, revision), docs in sorted(seen.items()):
        if len(docs) > 1:
            gaps.append(Gap(stage=STAGE, doc_id=sorted(docs)[0], subject=number,
                            reason=f"{len(docs)} files claim {number} rev "
                                   f"{revision or '-'}",
                            detail=", ".join(sorted(docs))))
    return gaps


def read_one(found, patterns) -> dict:
    """One sheet, one file open. Returns everything the register needs.

    Never raises: a sheet that cannot be read comes back with its error, so one
    bad file fails its own row and not the package."""
    out = {"doc_id": found.doc_id, "tier": None, "reason": "", "fields": {},
           "identity": {}, "words": 0, "error": None}
    try:
        doc = _open(found.path)
        try:
            words_n, drawings_n, images_n, pages = counts(doc)
            dw, dh = page_display_size(doc[0]) if doc.page_count else (0.0, 0.0)
        finally:
            doc.close()
        tier, reason = classify(words_n, drawings_n, images_n, pages)
        out.update(tier=tier, reason=reason, words=words_n)
        # a title block is read wherever there is text to read it from - not
        # only on a measurable sheet: a cover or a notes sheet with little
        # drawn on it still names itself, and was listed unresolved
        if tier is Tier.T2_VECTOR or words_n:
            words = extract_words(found.path, 0)
            out["fields"] = read_fields(words, dw, dh, found.doc_id, patterns).fields
            # owner, job title and plot, for the bill's heading (project_identity)
            from readers.project_identity import from_words
            out["identity"] = from_words(words, dw, dh)
    except BoqError as exc:
        out["error"] = str(exc)
    except Exception as exc:                       # noqa: BLE001 — see docstring
        out["error"] = f"{type(exc).__name__}: {exc}"
    return out


def build(root: Path, patterns_path: Path | None = None,
          matrix_path: Path | None = None, limit: int | None = None,
          workers: int = 8, progress=None, transcribe=None
          ) -> tuple[list[SheetRecord], GapList, dict[str, int]]:
    """transcribe: (ReadingStore, live) from readers.transcribe, or None. A
    sheet whose title block yields no drawing number is then read off its
    image - saved reading, live reading, or a request left - before its file
    name is used. build.transcribed lists what was read that way.
    build.identity holds each sheet's owner / job title / plot, from its
    text or from the reading of its block, for readers.project_identity.vote."""
    build.transcribed = []
    build.identity = []
    patterns = PatternSet.load(patterns_path or DATA / "titleblocks.json")
    matrix = DisciplineMatrix.load(matrix_path or DATA / "disciplines.json")
    gaps = GapList()
    sheets: list[SheetRecord] = []

    drawings = [f for f in walk(root) if f.is_drawing]
    if limit:
        drawings = drawings[:limit]

    done = [0]
    word_counts: dict[str, int] = {}

    def one(found):
        result = read_one(found, patterns)
        done[0] += 1
        if progress:
            progress(done[0], len(drawings), found.doc_id)
        return result

    for found, result, error in ordered_map(one, drawings, workers=workers,
                                            stage=STAGE, timeout=SHEET_BUDGET_S):
        if error is not None or result is None:
            gaps.add(Gap(stage=STAGE, doc_id=found.doc_id, subject="file",
                         reason=str(error)))
            continue
        if result["error"]:
            gaps.add(Gap(stage=STAGE, doc_id=found.doc_id, subject="file",
                         reason=result["error"]))
            continue
        tier, fields = result["tier"], result["fields"]
        identity = dict(result.get("identity") or {})
        word_counts[found.doc_id] = result["words"]
        if tier is not Tier.T2_VECTOR:
            gaps.add(Gap(stage=STAGE, doc_id=found.doc_id, subject="readability",
                         reason=result["reason"]))
        number = fields.get("drawing_no")
        if number and not fields.get("title") and transcribe is not None:
            # a number with no title beside it is the weakest read a block
            # gives ("MH-01", a manhole label, on a structure sheet whose block
            # is drawn). The block is read off the sheet as for a sheet with no
            # number - saved reading, else a live one, else a request - and the
            # reading wins where it has a number. Reading only a saved answer
            # here left every new package with the misread: STRUCTURE Sheet 28
            # registered as MH-01 until someone had read it by hand.
            from readers.transcribe import obtain, title_fields
            store, live = transcribe
            reading, how = obtain(found.path, "title_block", Path(found.doc_id).stem,
                                  store, live)
            read = title_fields(reading) if reading else {}
            identity = {**from_reading(reading), **identity}
            if read.get("drawing_no"):
                fields = {**fields, **read}
                number = read["drawing_no"]
                build.transcribed.append({"doc_id": found.doc_id, "fields": read,
                                          "basis": how})
            else:
                gaps.add(Gap(stage=STAGE, doc_id=found.doc_id, subject=number,
                             reason=f"drawing number {number} was read with no title beside "
                                    f"it and the title block was not read ({how})",
                             detail="check the sheet's drawing number"))
        if not number and transcribe is not None:
            # the block's fields are drawn as graphics (or its text is garbled):
            # read them off the sheet, as the consultant printed them
            from readers.transcribe import obtain, title_fields
            store, live = transcribe
            reading, how = obtain(found.path, "title_block", Path(found.doc_id).stem,
                                  store, live)
            read = title_fields(reading) if reading else {}
            identity = {**from_reading(reading), **identity}
            if read.get("drawing_no"):
                fields = {**fields, **read}
                number = read["drawing_no"]
                build.transcribed.append({"doc_id": found.doc_id, "fields": read,
                                          "basis": how})
        if identity:
            build.identity.append({"doc_id": found.doc_id, **identity})
        if not number:
            # The title block did not yield a number. The FILE NAME is the
            # consultant's own naming — weaker evidence than the block, but
            # evidence: "620DXB24-MIM-XXX-S-601-T0.pdf" is that sheet's number
            # as issued. Taken where the name is a drawing-number-shaped code,
            # with the basis recorded; a name that is prose stays unresolved.
            number = number_from_filename(found.doc_id)
            if number:
                gaps.add(Gap(stage=STAGE, doc_id=found.doc_id, subject="drawing number",
                             reason=f"no title-block pattern matched; drawing number "
                                    f"taken from the file name: {number}"))
            else:
                gaps.add(Gap(stage=STAGE, doc_id=found.doc_id, subject="drawing number",
                             reason="no title-block pattern matched and the file name "
                                    "is not a drawing number; sheet listed unresolved"))
        # the number's prefix first; where it declares no discipline, the
        # folder the sheet was issued in ("Structure/STRUCTURE Sheet 05.pdf")
        row, _basis = matrix.resolve_for(number, found.doc_id)
        folder_row, folder_basis = matrix.resolve_for(None, found.doc_id)
        if row and folder_row and _basis == "drawing number" \
                and row.discipline != folder_row.discipline \
                and not fields.get("title"):
            # "MH-01" read off a sheet in the Structure folder: a manhole
            # label taken for the drawing number by a loose pattern. Where the
            # block gave no title either, the number is the likelier misread
            # and the folder the sheet was issued in decides - said as a gap.
            gaps.add(Gap(stage=STAGE, doc_id=found.doc_id, subject=number,
                         reason=f"the number {number} reads as {row.discipline}, but the "
                                f"sheet was issued in the {folder_basis} "
                                f"({folder_row.discipline}); the folder is used",
                         detail="check the sheet's drawing number"))
            row = folder_row
        sheets.append(SheetRecord(
            doc_id=found.doc_id, file_sha256="", drawing_no=number,
            title=fields.get("title"), revision=fields.get("revision"),
            scale=fields.get("scale"), subtitle=fields.get("subtitle"),
            discipline=row.discipline if row else None,
            section=", ".join(row.sections) if row else None,
            sheet_kind=None, tier=tier, superseded_by=None,
            scale_verified=False))

    sheets, demoted = demote_shared_numbers(sheets)
    gaps.extend(demoted)
    sheets = resolve_revisions(sheets)
    gaps.extend(find_duplicates(sheets))
    return (sorted(sheets, key=lambda s: (s.drawing_no or "~", s.doc_id)),
            gaps, word_counts)


# A drawing number as a file is named. Three shapes cover what consultants
# issue, and none encodes a project:
#   * "A-504 SCHEDULE OF DOORS -04.pdf"        -> A-504   (short code, then a title)
#   * "A-13-001 SCHEDULE OF DOORS.pdf"         -> A-13-001 (a short code in several
#     numeric fields - ALL of them: stopping at the first gave "A-13" to three
#     sheets, which were then demoted as a shared project code)
#   * "620DXB24-MIM-XXX-S-601-T0.pdf"          -> the whole code (BS 1192 / ISO
#     19650 style: hyphenated fields, letters and digits, no spaces)
# The number is the leading run of code characters up to the first space; it
# must carry both a digit and a letter, and must not be a bare word.
RE_SHORT_NUMBER = re.compile(r"^([A-Z]{1,4}[-_ ]?\d{2,4}[A-Z]?(?:[-_]\d{1,4}[A-Z]?)*)(?=[\s_.]|-[A-Z]|$)",
                             re.IGNORECASE)
# "STRUCTURE Sheet 05.pdf": no drawing number anywhere in the sheet's text,
# only the consultant's file name. That name is kept as the sheet's reference -
# the file name as issued, with the basis recorded - rather than leaving fifty
# sheets unresolved and unroutable.
RE_SHEET_NAME = re.compile(r"^([A-Z][A-Z &]{2,30}?)\s*[-_ ]\s*SHEET\s*[-_ ]?\s*(\d{1,4}[A-Z]?)$",
                           re.IGNORECASE)
RE_CODE = re.compile(r"^([A-Z0-9][A-Z0-9_.\-]*[A-Z0-9])(?=[\s]|$)", re.IGNORECASE)
SHARED_NUMBER_FLOOR = 3


def number_from_filename(doc_id: str) -> str | None:
    from spine.files import doc_name, is_set_page

    if is_set_page(doc_id):
        return None           # a set's name is every page's: it names no one sheet
    stem = doc_name(doc_id).strip()
    if stem.lower().endswith(".pdf"):
        stem = stem[:-4]
    m = RE_SHORT_NUMBER.match(stem)
    if m:
        return m.group(1).upper().replace("_", "-").replace(" ", "-")
    m = RE_SHEET_NAME.match(stem)
    if m:
        return f"{'-'.join(m.group(1).upper().split())}-SHEET-{m.group(2).upper()}"
    m = RE_CODE.match(stem)
    if not m:
        return None
    # the long form: keep the hyphenated fields up to the first field that is
    # a WORD (four or more letters, no digit) — that is where a title starts
    # ("S-201-FOUNDATION-PLAN" -> S-201); BS-style fields are short ("MIM",
    # "XXX", "S", "T0") or carry digits ("620DXB24", "601")
    fields = m.group(1).upper().replace("_", "-").split("-")
    kept = []
    for f in fields:
        if f.isalpha() and len(f) >= 4:
            break
        kept.append(f)
    code = "-".join(kept).strip("-.")
    if not (any(c.isdigit() for c in code) and any(c.isalpha() for c in code)):
        return None
    return code if len(code) >= 3 else None


def demote_shared_numbers(sheets: list[SheetRecord]) -> tuple[list, list]:
    """A drawing number is one sheet's name. When the SAME value comes back
    from three or more files it is not a drawing number — it is the project
    or job code that every title block in the set carries, and the pattern
    matched it because it is drawing-number shaped. Left standing, forty
    sheets become one drawing: the revision resolver supersedes thirty-nine of
    them and every cross-reference collapses onto one name.

    So a value claimed by SHARED_NUMBER_FLOOR or more files is demoted. Each
    such sheet is re-named from its FILE NAME where that carries a
    drawing-number-shaped leading token — the consultant's own naming, weaker
    than a title block but still evidence — and a gap records the basis. A
    sheet whose file name carries no such token is left UNRESOLVED, not
    guessed."""
    claims: dict[str, list[SheetRecord]] = {}
    for s in sheets:
        if s.drawing_no:
            claims.setdefault(s.drawing_no, []).append(s)
    shared = {n for n, group in claims.items() if len(group) >= SHARED_NUMBER_FLOOR}
    if not shared:
        return sheets, []
    out, gaps = [], []
    for s in sheets:
        if s.drawing_no not in shared:
            out.append(s)
            continue
        replacement = number_from_filename(s.doc_id)
        out.append(SheetRecord(**{**asdict(s), "tier": s.tier,
                                  "drawing_no": replacement}))
        gaps.append(Gap(stage=STAGE, doc_id=s.doc_id, subject=s.drawing_no,
                        reason=f"{s.drawing_no} is claimed by "
                               f"{len(claims[s.drawing_no])} files — a project "
                               f"code, not a drawing number",
                        detail=(f"drawing number taken from the file name: "
                                f"{replacement}" if replacement else
                                "file name carries no drawing number; sheet "
                                "listed unresolved rather than guessed")))
    return out, gaps


def to_json(sheets: list[SheetRecord]) -> dict:
    return {"schema": "register/1",
            "sheets": [{**asdict(s), "tier": s.tier.value} for s in sheets]}


def main() -> int:
    ap = argparse.ArgumentParser(description="Build the drawing register.")
    ap.add_argument("directory")
    ap.add_argument("--patterns"); ap.add_argument("--matrix")
    ap.add_argument("--out"); ap.add_argument("--limit", type=int)
    args = ap.parse_args()
    root = Path(args.directory)
    if not root.is_dir():
        print(f"ERROR: not a directory: {root}", file=sys.stderr)
        return 2
    sheets, gaps, _words = build(
        root, Path(args.patterns) if args.patterns else None,
        Path(args.matrix) if args.matrix else None, args.limit)
    if args.out:
        Path(args.out).write_text(json.dumps(to_json(sheets), indent=1, sort_keys=True))
    for s in sheets:
        mark = "SUPERSEDED" if s.superseded_by else ""
        print(f"  {s.drawing_no or '— unresolved':<13} {(s.revision or '-'):<4} "
              f"{s.tier.value:<3} {(s.discipline or '-'):<24} {mark}")
    print(f"\n{len(sheets)} sheets, {len(gaps)} gaps")
    return 1 if len(gaps) else 0


if __name__ == "__main__":
    raise SystemExit(main())


build.transcribed = []     # set by build(): sheets whose title block was read off its image
