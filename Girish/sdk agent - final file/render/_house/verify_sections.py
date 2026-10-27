#!/usr/bin/env python3
"""
verify_sections.py — Z2 Pass 2, line Z2.16 / Z2.17.

Tests the HOUSE SECTION LETTERS against POMI's OWN SECTION HEADINGS.

This is the check that a rules review normally does not have, and its absence is
how a bill titled POMI came to carry a section S that POMI does not contain,
Furnishings lettered N when POMI puts it at M, and K titled Specialties when POMI
calls it Accessories. Every output-compliance check passed on those bills,
because the output obeyed the house rules perfectly. The house rules were the
defect.

The standard is read from `pomi-verbatim.md`'s own `SECTION X — TITLE` headings —
POMI's headings, reproduced word for word from the RICS PDF and verified clause by
clause against it. NOT from ref-pomi-rules.md: that file is the house's paraphrase
of POMI, and testing the house letters against the house paraphrase is the same
circularity this gate exists to break. Nothing is hard-coded here, so correcting
the standard file corrects this gate, and a standard file that drifts is caught by
the same run.

  python3 verify_sections.py [--rules references/pomi-verbatim.md] \\
                             [--workbook bill.xlsx] \\
                             [--letters '{"K": "Accessories", "S": "Comms"}'] \\
                             [--pymap scripts/reformat-boq-giant-wheel.py]

Exit 0 = every house letter exists in POMI and its title matches.
Exit 1 = an invented section, or a mis-titled one. Returns to the RULEBOOK.
"""
import sys, re, json, argparse
from pathlib import Path

HEADING = re.compile(r"^#*\s*SECTION\s+([A-Z])\s*[—\-–]\s*(.+?)\s*$", re.M)
SHEET = re.compile(r"^([A-Z])\s*[-–—.]\s*(.+)$")


def norm(t):
    """Compare titles by meaning, not typography. POMI prints headings in caps;
    house sheet names are mixed case and abbreviate."""
    t = t.upper().replace("&", "AND")
    t = re.sub(r"[^A-Z ]", " ", t)
    return " ".join(t.split())


def same_title(house, pomi):
    """A sheet tab abbreviates; it must not RENAME.

    Deliberately NOT an alias table. An alias table is a list of exceptions
    somebody maintains, and the exception that gets added to make a build pass is
    how "Specialties" would survive as an alias of "Accessories".

    Two mechanical tests, no judgement:
      1  despaced prefix   — 'Thermal&Moist' abbreviates 'Thermal and Moisture
                             Protection'; 'Specialties' cannot abbreviate
                             'Accessories'.
      2  word-wise prefix  — same word count or fewer, each house word a prefix
                             of the POMI word in that position or vice versa, so
                             'Site Works' matches 'Site Work'.
    """
    h, p = norm(house), norm(pomi)
    if p.replace(" ", "").startswith(h.replace(" ", "")):
        return True
    hw, pw = h.split(), p.split()
    if len(hw) > len(pw):
        return False
    return all(a.startswith(b) or b.startswith(a) for a, b in zip(hw, pw))


def read_standard(path):
    text = Path(path).read_text(encoding="utf-8")
    std = {}
    for letter, title in HEADING.findall(text):
        std.setdefault(letter, norm(title))
    if not std:
        raise SystemExit(f"ABORT: no 'SECTION X — TITLE' headings found in {path}.\n"
                         f"       The standard could not be read, so nothing can be\n"
                         f"       tested against it. UNTESTED is not PASS.")
    return std


def house_from_workbook(path):
    from openpyxl import load_workbook
    out = {}
    for name in load_workbook(path, read_only=True).sheetnames:
        m = SHEET.match(name.strip())
        if m and not m.group(2).strip().isdigit() and m.group(2).strip() != "S":
            out.setdefault(m.group(1), m.group(2).strip())
    return out


def house_from_pymap(path):
    """Pull a LETTER_TO_SHEET-style dict out of a script without importing it."""
    text = Path(path).read_text(encoding="utf-8")
    out = {}
    body = re.search(r"LETTER_TO_SHEET\s*=\s*\{(.*?)\n\}", text, re.S)
    if body:
        for letter, sheet in re.findall(r'"([A-Z])":\s*\("([^"]+)"', body.group(1)):
            m = SHEET.match(sheet)
            out[letter] = m.group(2) if m else sheet
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--rules", default=str(Path(__file__).resolve().parent.parent
                                    / "references" / "pomi-verbatim.md"))
    ap.add_argument("--workbook")
    ap.add_argument("--pymap")
    ap.add_argument("--letters", help="JSON object of letter -> title")
    a = ap.parse_args()

    std = read_standard(a.rules)

    house = {}
    if a.workbook:
        house.update(house_from_workbook(a.workbook))
    if a.pymap:
        house.update(house_from_pymap(a.pymap))
    if a.letters:
        house.update(json.loads(a.letters))
    if not house:
        raise SystemExit("ABORT: no house sections supplied — nothing to test.")

    fails = []
    print(f"POMI standard read from {a.rules}: "
          f"{len(std)} sections, {' '.join(sorted(std))}\n")

    for letter in sorted(house):
        title = house[letter]
        if letter not in std:
            fails.append((letter, title,
                          f"POMI has no section {letter}. A house section the "
                          f"standard does not contain cannot appear on a bill "
                          f"titled POMI."))
            print(f"  FAIL  {letter}  {title!r}  — no such POMI section")
            continue
        if not same_title(title, std[letter]):
            fails.append((letter, title,
                          f"POMI titles section {letter} '{std[letter].title()}'."))
            print(f"  FAIL  {letter}  {title!r}  — POMI says {std[letter].title()!r}")
        else:
            print(f"  PASS  {letter}  {title}")

    unused = sorted(set(std) - set(house))
    if unused:
        print(f"\n  note: POMI sections not used by this bill: {' '.join(unused)}")
        print( "        Not a failure — a project need not contain every section —")
        print( "        but a section that exists in the works and not in the bill")
        print( "        is a coverage question for K2.")

    if fails:
        print(f"\nSECTION GATE FAILED — {len(fails)} deviation(s) from POMI.\n")
        for letter, title, why in fails:
            print(f"  {letter}  {title!r}\n      {why}")
        print("\nThis finding RETURNS TO THE RULEBOOK, not to a measuring seat.")
        print("Re-work scope: every bill issued under the wrong letter. A revision")
        print("comparison run across the correction needs the crosswalk at")
        print("determinism.md §4.11a, or it will read a corrected section as")
        print("omitted and a re-lettered one as new.")
        sys.exit(1)

    print(f"\nSection gate passed: {len(house)} house sections, all present in POMI "
          f"with matching titles.")


if __name__ == "__main__":
    main()
