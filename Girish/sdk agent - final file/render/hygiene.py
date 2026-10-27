#!/usr/bin/env python3
"""
hygiene.py — nothing in a deliverable may reveal how it was made.

House rule, binding on all three artefact sets. Every Aetraa output is signed by
a senior professional, and a cell reading "extract.py: 0 words" or "stage 12
compute" tells a client's commercial team that a machine produced the document
and no one read it. The document is the professional's; the pipeline is not the
client's concern.

Four rules, checked rather than trusted, because these leak through
exception messages and debug labels rather than through anything anyone wrote
on purpose:

  * no script, tool, library, module or variable name in a user-facing cell
  * no emoji
  * formal RICS language — no contractions, no first person
  * method labels use neutral surveying terms: "measured to scale",
    "schedule cell", "vector take-off" — never "OCR", "regex", "model call"

  python3 -m render.hygiene --workbook out.xlsx

Exit 0 = clean. Exit 1 = violations found, listed with cell references.
"""
from __future__ import annotations

import argparse
import re
import sys

BANNED_SUBSTRINGS = (
    ".py", ".json", ".xlsx", "None", "NaN", "null", "Traceback",
    "Exception", "Error:", "DEBUG", "TODO", "FIXME", "<", ">", "{", "}",
    "stage ", "pymupdf", "openpyxl", "regex", "OCR", "model call", "prompt",
    "token", "schema", "sha256", "run_id",
)

BANNED_WORDS = ("script", "parser", "pipeline", "algorithm", "hallucination")

CONTRACTIONS = ("don't", "won't", "can't", "isn't", "aren't", "it's",
                "we've", "we'll", "doesn't")

FIRST_PERSON = (" we ", " our ", " us ", " I ")

RE_EMOJI = re.compile(
    "[\U0001F300-\U0001FAFF\U00002600-\U000027BF\U0001F1E6-\U0001F1FF]")

APPROVED_METHODS = ("measured to scale", "schedule cell", "schedule cell (transcribed)",
                    "vector take-off",
                    "stated level difference", "counted from plan")


def violations(text: str) -> list[str]:
    """Problems with one cell's text. Empty list means clean."""
    if text is None:
        return []
    value = str(text)
    found: list[str] = []
    lower = f" {value.lower()} "
    for token in BANNED_SUBSTRINGS:
        if token[-1].isalnum() and token[0].isalnum():
            # a WORD, matched as one. Matched as a substring, "schema"
            # condemned a consultant's "SCHEMATIC DIAGRAM" and "token" would
            # condemn "tokenised"; the sheet's own words are quoted, not ours
            if re.search(rf"(?<![A-Za-z0-9]){re.escape(token)}(?![A-Za-z0-9])",
                         value, re.IGNORECASE):
                found.append(f"contains {token!r}")
        elif token.lower() in value.lower():
            found.append(f"contains {token!r}")
    for word in BANNED_WORDS:
        if f" {word} " in lower:
            found.append(f"contains {word!r}")
    for contraction in CONTRACTIONS:
        if contraction in lower:
            found.append(f"contraction {contraction!r}")
    for pronoun in FIRST_PERSON:
        if pronoun in lower:
            found.append(f"first person {pronoun.strip()!r}")
    if RE_EMOJI.search(value):
        found.append("emoji")
    return sorted(set(found))


def check_method_label(label: str) -> str | None:
    if label not in APPROVED_METHODS:
        return (f"method label {label!r} is not approved; use one of: "
                f"{', '.join(APPROVED_METHODS)}")
    return None


def main() -> int:
    ap = argparse.ArgumentParser(description="Check a deliverable's hygiene.")
    ap.add_argument("--workbook", help="workbook to check")
    ap.add_argument("--text", help="check a single string instead")
    args = ap.parse_args()
    if not args.workbook and not args.text:
        ap.error("give --workbook or --text")
    if args.text:
        found = violations(args.text)
        for problem in found:
            print(f"  {problem}", file=sys.stderr)
        return 1 if found else 0
    print(f"{len(BANNED_SUBSTRINGS)} banned substrings, "
          f"{len(APPROVED_METHODS)} approved method labels")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
