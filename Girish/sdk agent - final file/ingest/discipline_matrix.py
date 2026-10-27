#!/usr/bin/env python3
"""
discipline_matrix.py — drawing prefix -> discipline -> POMI section.

Carried as data because prefixes are a consultant's convention, not a standard.
The dev corpus uses ten discipline folders; the next package will use different
letters, and adapting to it must be an edit to a table rather than to code.

The section this yields is a *routing hint*, not the billing decision. What
section a line is billed under is fixed by its clause (ingest.clause_table).
This matrix answers a different question: which drawings feed which section,
which is what stage 16 needs to notice that a section has nothing behind it.

Three tables, not one. The prefix map answers most sheets; a sheet whose prefix
is unknown falls to the title keywords; and the equipment tag patterns are
SCOPED to a discipline because W12 is a shear wall on a structural sheet and a
window on an architectural one. A pattern applied outside its scope is how one
silently becomes the other.

Every routing to "section S" in the reference has been corrected to R. The
reference states in its own header that there is no POMI section S — ELV and
communications are electrical work billed inside R as their own item groups —
and then its table routes FA, ELV, MEP and LSF to S anyway. The file contradicts
itself; DECISIONS.md settles it.

  python3 -m ingest.discipline_matrix --matrix data/disciplines.json \\
      --drawing ST-101-A
  python3 -m ingest.discipline_matrix --title "REFLECTED CEILING PLAN"
  python3 -m ingest.discipline_matrix --tags "FCU-12 AHU-03" --scope ME

Exit 0 = resolved. Exit 1 = no prefix and no keyword matched.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import dataclass
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent / "data" / "disciplines.json"


@dataclass(frozen=True)
class DisciplineRow:
    prefix: str
    discipline: str
    sections: tuple          # POMI letters this discipline typically feeds


@dataclass(frozen=True)
class TagPattern:
    tag: str
    regex: str
    scope: tuple
    family: str = ""

    def finds(self, text: str) -> list[str]:
        return re.findall(rf"\b{self.regex}\b", text or "", re.IGNORECASE)


class DisciplineMatrix:
    def __init__(self, rows: list[DisciplineRow], raw: dict | None = None):
        # longest prefix first, so AR-INT beats AR
        self._rows = sorted(rows, key=lambda r: (-len(r.prefix), r.prefix))
        self._raw = raw or {}
        self._keywords = self._raw.get("title_keywords", {})
        self._patterns: list[TagPattern] = []
        for family in self._raw.get("equipment_patterns", []):
            scope = tuple(family.get("scope", ()))
            for pattern in family["patterns"]:
                self._patterns.append(TagPattern(pattern["tag"],
                                                 pattern["regex"], scope,
                                                 family.get("family", "")))

    # ── title keywords, for a sheet whose prefix is unknown ─────────────
    def route_by_title(self, title: str | None) -> list[str]:
        """Sections whose keywords appear in the title. A list, not a letter:
        "STAIR" is concrete or metalwork depending on what it is made of, and
        narrowing that needs the drawing, not the title."""
        text = (title or "").upper()
        if not text:
            return []
        hits = [section for section, words in sorted(self._keywords.items())
                if any(word in text for word in words)]
        return hits

    def ambiguous(self) -> list[dict]:
        return list(self._raw.get("ambiguous_keywords", []))

    # ── equipment tags, scoped ──────────────────────────────────────────
    def tag_patterns(self, discipline_prefix: str | None = None
                     ) -> list[TagPattern]:
        if discipline_prefix is None:
            return list(self._patterns)
        key = discipline_prefix.upper()
        return [p for p in self._patterns if key in p.scope]

    def reconcile_scope(self, family: str) -> dict:
        """Where a family's tags are counted against its schedules: the sheet
        kinds, and the plan titles that repeat another plan's floor (a setting-
        out plan draws the ground floor again, tags and all)."""
        for fam in self._raw.get("equipment_patterns", []):
            if fam.get("family") == family:
                return dict(fam.get("reconcile_on") or {})
        return {}

    def tags_in(self, text: str, discipline_prefix: str) -> dict:
        """Tags found, by kind. Scoped: a pattern outside the sheet's
        discipline is not applied at all, rather than applied and filtered."""
        out: dict[str, list[str]] = {}
        for pattern in self.tag_patterns(discipline_prefix):
            found = pattern.finds(text)
            if found:
                out.setdefault(pattern.tag, []).extend(found)
        return {k: sorted(set(v)) for k, v in sorted(out.items())}

    # ── what the reference got wrong, kept visible ──────────────────────
    def collisions(self) -> list[dict]:
        return list(self._raw.get("collisions", []))

    def corrections(self) -> list[dict]:
        return list(self._raw.get("corrections_applied", []))

    def cross_discipline(self) -> list[dict]:
        return list(self._raw.get("cross_discipline", []))

    def resolve(self, drawing_no: str) -> DisciplineRow | None:
        """The discipline a drawing number declares.

        Short numbers declare it as a prefix: "A-504", "ST-201". Field-coded
        numbers (BS 1192 / ISO 19650: "620DXB24-MIM-XXX-S-601-T0") declare it
        as one FIELD — the one that is exactly a known prefix, sitting before
        the sheet-number field. Prefix first; then the field, longest prefix
        winning so "ST" is not read as "S"."""
        token = (drawing_no or "").strip().upper()
        if not token:
            return None
        for row in self._rows:
            if token.startswith(row.prefix.upper()):
                return row
        fields = [f for f in re.split(r"[-_.]", token) if f]
        by_prefix = {row.prefix.upper(): row for row in self._rows}
        candidates = []
        for i, f in enumerate(fields[:-1]):           # never the last field
            row = by_prefix.get(f)
            if row is None:
                continue
            nxt = fields[i + 1]
            before_number = any(ch.isdigit() for ch in nxt) and not nxt.isalpha()
            candidates.append((0 if before_number else 1, -len(f), i, row))
        if candidates:
            return sorted(candidates, key=lambda c: c[:3])[0][3]
        return None

    def resolve_for(self, drawing_no: str | None, doc_id: str | None
                    ) -> tuple[DisciplineRow | None, str | None]:
        """(row, basis). The drawing number first - its prefix is the sheet's
        own declaration. Where it declares nothing (no prefix, or no number at
        all: 'STRUCTURE Sheet 05.pdf'), the FOLDER the sheet was issued in, when
        that folder is named for a discipline (data: folder_disciplines). The
        basis says which, so a routing that rests on a folder name is visible."""
        row = self.resolve(drawing_no or "")
        if row is not None:
            return row, "drawing number"
        folders = self._raw.get("folder_disciplines", {}).get("folders", {})
        parts = str(doc_id or "").replace("\\", "/").split("/")[:-1]
        by_prefix = {r.prefix.upper(): r for r in self._rows}
        for part in reversed(parts):                # the nearest folder first
            key = re.sub(r"[^A-Z ]+", " ", part.upper()).strip()
            key = re.sub(r"\s+", " ", key)
            prefix = folders.get(key) or folders.get(key.replace(" ", ""))
            if prefix and prefix.upper() in by_prefix:
                return by_prefix[prefix.upper()], f"folder '{part}'"
        return None, None

    def prefixes(self) -> list[str]:
        return sorted(row.prefix for row in self._rows)

    @classmethod
    def load(cls, path: Path | None = None) -> "DisciplineMatrix":
        raw = json.loads(Path(path or DATA).read_text())
        rows = [DisciplineRow(r["prefix"], r["discipline"],
                              tuple(r.get("sections", [])))
                for r in raw["disciplines"]]
        stray = sorted({s for r in rows for s in r.sections if s == "S"})
        if stray:
            raise ValueError("the discipline matrix still routes to section S; "
                             "there is no POMI section S - see DECISIONS.md")
        return cls(rows, raw)


def main() -> int:
    ap = argparse.ArgumentParser(description="Route a drawing to its sections.")
    ap.add_argument("--matrix")
    ap.add_argument("--drawing")
    ap.add_argument("--title")
    ap.add_argument("--tags")
    ap.add_argument("--scope", help="the sheet's discipline prefix, which is "
                                   "what scopes the tag patterns")
    args = ap.parse_args()
    try:
        matrix = DisciplineMatrix.load(Path(args.matrix) if args.matrix else None)
    except ValueError as exc:
        print(exc, file=sys.stderr)
        return 2

    if args.tags:
        if not args.scope:
            print("--tags needs --scope: an unscoped tag pattern reads a shear "
                  "wall as a window", file=sys.stderr)
            return 2
        found = matrix.tags_in(args.tags, args.scope)
        for tag, values in found.items():
            print(f"  {tag:<26} {', '.join(values)}")
        if not found:
            print(f"no tags of any kind scoped to {args.scope.upper()}")
        return 0 if found else 1

    if args.title and not args.drawing:
        sections = matrix.route_by_title(args.title)
        print(f"{args.title!r} -> "
              f"{', '.join(sections) if sections else 'no keyword matched'}")
        for entry in matrix.ambiguous():
            if entry["keyword"] in args.title.upper():
                print(f"  ambiguous: {entry['keyword']} — "
                      f"{'; '.join(entry['readings'])}")
                print(f"  {entry['resolution']}")
        return 0 if sections else 1

    if not args.drawing:
        print(f"{len(matrix.prefixes())} prefixes, "
              f"{len(matrix.tag_patterns())} tag patterns, "
              f"{len(matrix.collisions())} recorded collision(s), "
              f"{len(matrix.corrections())} correction(s) applied")
        return 0

    row = matrix.resolve(args.drawing)
    if row is None:
        sections = matrix.route_by_title(args.title)
        if sections:
            print(f"{args.drawing} -> no prefix matched; the title routes to "
                  f"{', '.join(sections)}")
            return 0
        print(f"no prefix matched {args.drawing}; known: "
              f"{', '.join(matrix.prefixes())}", file=sys.stderr)
        return 1
    print(f"{args.drawing} -> {row.discipline} -> {', '.join(row.sections)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
