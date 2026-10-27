#!/usr/bin/env python3
"""
levels.py — the level table, and storey heights derived from it.

On a 69-sheet structural package the schedules gave count, width and thickness
of every column and never a height. C2.1 measures concrete by volume, so the
height has to come from somewhere, and the honest somewhere is the drawings'
own stated levels: a column on the 1st floor runs from the 1st floor level to
the 2nd, and both levels are printed on the plans and sections. The height is
one stated figure minus another — DERIVED, not measured, because nothing here
depends on a sheet's scale.

Three things this module refuses to do, each because the alternative looks
exactly like a correct answer:

  * it never takes a typical storey height. A storey whose level is not on any
    sheet is a gap naming the storeys that WERE read, so the surveyor can see
    the table is short one row rather than trust a figure that was never stated.
  * it never picks between two stated values for one storey. Both are kept,
    the conflict is a gap, and no height is derived through a conflicted level.
  * it never rounds. Values are Decimal as printed; GP3.1 rounding happens once,
    in EvidenceBase.make, when the height enters the base.

The pairing of a number with a storey name is geometric, over the text layer:
a level token on the same text band as a storey phrase, or under an SSL/FFL
prefix whose band names one. The bare short forms a plan legend uses ("2ND",
"01", "L01") are storey names; a single letter and a digit ("L3") is not,
because on a real roof plan that was a ladder mark eight points above a level.

The one model call here is the alias judgement: which table key a schedule's
"Pod 1" names. A label from a closed set, never a number.

  python3 -m measure.levels <pdf> [<pdf> ...]

Exit 0 = table printed. Exit 1 = no levels read.
"""
from __future__ import annotations

import argparse
import re
import sys
from dataclasses import dataclass, field
from decimal import Decimal
from pathlib import Path

from measure.evidence import EvidenceBase
from spine.gaps import Gap
from spine.records import Element, Origin, Word

STAGE = "S4"

# A level is metres to two or three places, optionally signed: "+16.25",
# "-3.650", "0.00". Six digits or an unsigned integer is a millimetre
# dimension, and "12.5" (one place) is a dimension in metres, not a level.
LEVEL_TOKEN = re.compile(r"^[+\-±]?\d{1,3}\.\d{2,3}$")

# a word that says "this number is a level" without naming the storey
LEVEL_PREFIXES = ("LVL", "SSL", "FFL", "TOS", "TOC", "LEVEL", "S.S.L.",
                  "F.F.L.", "T.O.S.", "T.O.C.", "T.O.F", "T.O.F.")

# words that sit on a level's band and mean nothing for the storey: the
# datum, the unit, and the prefixes that say "this is a level". LEVEL and
# LVL are NOT here — "LEVEL 1" is a storey phrase and normalise_storey reads it.
_NOISE = {"M", "MM", "DMD", "=", "±", "+", "-", "LVL", "SSL", "FFL", "TOS", "TOC",
          "TOP", "BOTTOM", "S.S.L.", "F.F.L.", "T.O.F", "T.O.F.", "T.O.B",
          "NGL", "GWT", "@", "AT"}

# Pairing window, from the contract: same text band means centres within
# 0.6 x the token's own height, and within 300 pt horizontally. Words closer
# than a gap of 1.2 x the height form one phrase; a wider gap is a column
# break, so "2ND | +16.25" is two phrases and "1ST STAGE" is one.
BAND_FACTOR = 0.6
BAND_REACH_PT = 300.0
PHRASE_GAP_FACTOR = 1.2

_ORDINAL = re.compile(r"^(\d{1,2})(?:ST|ND|RD|TH)$")
_WORDS = {"FIRST": 1, "SECOND": 2, "THIRD": 3, "FOURTH": 4, "FIFTH": 5,
          "SIXTH": 6, "SEVENTH": 7, "EIGHTH": 8, "NINTH": 9, "TENTH": 10,
          "ELEVENTH": 11, "TWELFTH": 12, "THIRTEENTH": 13, "FOURTEENTH": 14,
          "FIFTEENTH": 15, "SIXTEENTH": 16, "SEVENTEENTH": 17,
          "EIGHTEENTH": 18, "NINETEENTH": 19, "TWENTIETH": 20}

# The heights this module derives, by element type. A column's scheduled
# "length" IS the storey height (it is the vertical member's L on dimension
# paper); a wall's storey height is its HEIGHT, because its length is a plan
# measurement that stage S9's plan_lengths supplies. A beam's length is not a
# storey height at all, so beams are not here — giving one a storey height
# as its length would be wrong and would also stop plan_lengths measuring it.
HEIGHT_ROLE_BY_TYPE = {"column": "length", "wall": "height"}


# ── storey names ─────────────────────────────────────────────────────────
def normalise_storey(text: str | None, bare_numbers: bool = True) -> str | None:
    """The canonical key a storey phrase names, or None when the words are
    not a storey. Pure; the spellings it accepts are listed in the tests.

    Keys: "FOUNDATION", "BASEMENT n", "GROUND", "PODIUM n", "MEZZANINE",
    "FLOOR n", "ROOF", "TOP OF ROOF", "LIFT MACHINE ROOM". A "LEVEL n" or
    "L0n" form is FLOOR n, and level 0 is GROUND, because that is what a
    package that numbers its plans L00, L01, L02 means by them.

    `bare_numbers`: whether "01" alone is FLOOR 1. True for a schedule cell,
    where a LEVEL column reading 01 is unambiguous. build_level_table passes
    False, because on a real plan the "02" sharing a text band with a level
    was a section bubble, and a false pairing there poisons two storeys.

    One letter and one digit ("L3", "B1", "P1") is never a storey in either
    mode: that is the shape of a mark, and on a real roof plan L3 was a
    ladder eight points above a level."""
    if not text:
        return None
    raw = " ".join(str(text).upper().replace("_", " ").split())
    raw = re.sub(r"\s*[-/]\s*", " ", raw).strip(" .")
    raw = re.sub(r"\.(?=[A-Z])", " ", raw)                # "G.F" -> "G F"
    words = raw.replace(".", "").split()
    if not words:
        return None
    joined = " ".join(words)

    # named storeys first — a phrase that says ROOF is the roof whatever
    # number sits beside it
    if re.fullmatch(r"(TOP OF ROOF|ROOF TOP|UPPER ROOF)( LEVEL| SLAB| FLOOR)?",
                    joined):
        return "TOP OF ROOF"
    if re.fullmatch(r"(LIFT|ELEVATOR) (MACHINE|MOTOR) ROOM( LEVEL| SLAB| FLOOR)?"
                    r"|LMR|LIFT MACHINE|LIFT OVERRUN|LOR", joined):
        return "LIFT MACHINE ROOM"
    if re.fullmatch(r"(ROOF|RF|RF LEVEL|ROOF LEVEL|ROOF SLAB|ROOF FLOOR|LRF"
                    r"|MAIN ROOF)", joined):
        return "ROOF"
    if re.fullmatch(r"(FOUNDATION|FOUNDATIONS|FDN|FOUNDATION LEVEL"
                    r"|FOUNDATION SLAB|RAFT|RAFT LEVEL|PILE CAP LEVEL|FND)", joined):
        return "FOUNDATION"
    if re.fullmatch(r"(MEZZANINE|MEZZ|MEZZANINE FLOOR|MEZZANINE LEVEL|MEZ)", joined):
        return "MEZZANINE"
    if re.fullmatch(r"(GROUND|GROUND FLOOR|GROUND LEVEL|GF|G F|GFL|GL"
                    r"|LEVEL G|LEVEL GF|LEVEL 0|LEVEL 00|L00|L0|00"
                    r"|LG|LOWER GROUND|LOWER GROUND FLOOR|UPPER GROUND|UGF)", joined):
        return "GROUND"

    # "BASEMENT 1", "BSMT 1", "LEVEL B1", "B01" — not "B1", a mark shape
    m = re.fullmatch(r"(?:(?:BASEMENT|BSMT|BASE|LEVEL B|LB) ?(\d{1,2})|B(\d{2}))"
                     r"(?: FLOOR| LEVEL)?", joined)
    if m:
        return f"BASEMENT {int(m.group(1) or m.group(2))}"
    if re.fullmatch(r"BASEMENT( FLOOR| LEVEL)?", joined):
        return "BASEMENT 1"

    # "PODIUM 1", "POD 1", "LEVEL P1", "P01" — not "P1", a mark shape
    m = re.fullmatch(r"(?:(?:PODIUM|POD|LEVEL P|LP) ?(\d{1,2})|P(\d{2}))"
                     r"(?: FLOOR| LEVEL)?", joined)
    if m:
        return f"PODIUM {int(m.group(1) or m.group(2))}"
    if re.fullmatch(r"PODIUM( FLOOR| LEVEL)?", joined):
        return "PODIUM 1"

    # numbered floors: "1ST FLOOR", "FIRST FLOOR", "LEVEL 1", "L01", "01",
    # "FLOOR 1", "1ST", "1F", "LEVEL 01".
    n = None
    m = re.fullmatch(r"(?:(LEVEL|LVL|FLOOR|FL|STOREY|STORY) )?(\d{1,2})(ST|ND|RD|TH)?"
                     r"(?: (FLOOR|FL|LEVEL|LVL|STOREY|STORY))?", joined)
    if m:
        worded = m.group(1) or m.group(3) or m.group(4)
        if worded or bare_numbers:
            n = int(m.group(2))
    else:
        # "L01", not "1F": on a real details sheet "3f" was a bar callout
        m = re.fullmatch(r"L(\d{2})(?: (?:FLOOR|LEVEL))?", joined)
        if m:
            n = int(m.group(1))
        else:
            m = re.fullmatch(r"([A-Z]+)(?: (?:FLOOR|FL|LEVEL|STOREY|STORY))?",
                             joined)
            if m and m.group(1) in _WORDS:
                n = _WORDS[m.group(1)]
    if n is None:
        return None
    if n == 0:
        return "GROUND"
    return f"FLOOR {n}"


# ── the table ────────────────────────────────────────────────────────────
@dataclass
class Level:
    key: str
    value: Decimal                       # metres, as printed, never rounded
    citations: list = field(default_factory=list)   # [(doc_id, raw token)]
    votes: int = 0


@dataclass
class LevelTable:
    """levels: the one value per key this run stands on. candidates: every
    distinct value read per key, so a conflicted storey keeps both. A key in
    `conflicts` derives nothing until the drawings agree."""
    levels: dict = field(default_factory=dict)       # key -> Level
    conflicts: list = field(default_factory=list)    # [(key, [values])]
    candidates: dict = field(default_factory=dict)   # key -> [Level]

    def keys(self) -> list[str]:
        """Storeys in ascending order of level, so a listing reads bottom up."""
        return [k for _v, k in sorted((lvl.value, k)
                                      for k, lvl in self.levels.items())]

    def conflicted(self, key: str) -> bool:
        return any(k == key for k, _values in self.conflicts)

    def as_dict(self) -> dict:
        """JSON-ready; Decimals as strings so nothing is rounded on the way."""
        return {
            "levels": {k: {"value": str(lvl.value), "votes": lvl.votes,
                           "citations": [list(c) for c in lvl.citations]}
                       for k, lvl in sorted(self.levels.items())},
            "conflicts": [[k, [str(v) for v in values]]
                          for k, values in self.conflicts],
            "candidates": {k: [str(lvl.value) for lvl in lvls]
                           for k, lvls in sorted(self.candidates.items())},
        }


def _centre_y(w: Word) -> float:
    return (w.y0 + w.y1) / 2


def _band(token: Word, words: list[Word]) -> list[Word]:
    """The words sharing the token's text band, sorted left to right."""
    height = max(token.y1 - token.y0, 1.0)
    cy = _centre_y(token)
    out = [w for w in words if w is not token
           and abs(_centre_y(w) - cy) < BAND_FACTOR * height
           and abs(w.x0 - token.x0) < BAND_REACH_PT]
    out.sort(key=lambda w: (w.x0, w.y0))
    return out


def _phrases(band: list[Word], height: float) -> list[str]:
    """The band as runs of neighbouring words; every run is a candidate
    phrase. Level tokens and noise words are dropped from a run so
    "SSL +12.45 2ND" still yields "2ND", while "1ST STAGE" stays whole and
    names no storey."""
    runs: list[list[str]] = []
    last_x1 = None
    for w in band:
        if last_x1 is None or w.x0 - last_x1 > PHRASE_GAP_FACTOR * height:
            runs.append([])
        runs[-1].append(w.text)
        last_x1 = w.x1
    out = []
    for run in runs:
        kept = [t for t in run if not LEVEL_TOKEN.match(t)
                and t.upper().strip("().,:;") not in _NOISE]
        if kept:
            out.append(" ".join(kept))
    return out


def _storey_on_band(token: Word, words: list[Word]) -> str | None:
    """The storey key named on the token's band, if exactly one is."""
    band = _band(token, words)
    height = max(token.y1 - token.y0, 1.0)
    found = []
    for phrase in _phrases(band, height):
        key = normalise_storey(phrase, bare_numbers=False)
        if key and key not in found:
            found.append(key)
    # two storeys on one band is a legend row we have not understood
    return found[0] if len(found) == 1 else None


def _considered(sheet) -> bool:
    """Section, elevation and plan sheets; every T2 sheet when routing has not
    run. Not a superseded one, and not a raster."""
    get = (lambda k: sheet.get(k)) if isinstance(sheet, dict) \
        else (lambda k: getattr(sheet, k, None))
    tier = get("tier")
    tier = getattr(tier, "value", tier)
    if tier not in (None, "T2"):
        return False
    if get("superseded_by"):
        return False
    return get("sheet_kind") in (None, "plan", "section", "elevation")


def unnamed_levels(sheets, words_by_doc: dict, per_sheet: int = 24) -> list[dict]:
    """The level figures no storey phrase sits beside — the residue the
    model may NAME. Each entry: level_id (assigned here, so the figure is
    never echoed), doc_id, value (Decimal, code-read), nearby (the words
    around the figure, nearest first, a reviewer's context). Only the
    considered sheets, only distinct figures per sheet, capped per sheet."""
    out: list[dict] = []
    for sheet in sheets:
        doc_id = sheet.get("doc_id") if isinstance(sheet, dict) \
            else getattr(sheet, "doc_id", None)
        if not doc_id or not _considered(sheet):
            continue
        words = words_by_doc.get(doc_id) or []
        seen: set = set()
        for token in words:
            if not LEVEL_TOKEN.match(token.text):
                continue
            if _storey_on_band(token, words) is not None:
                continue
            value = Decimal(token.text.replace("±", "").replace("+", ""))
            if value in seen:
                continue
            seen.add(value)
            cx, cy = (token.x0 + token.x1) / 2, _centre_y(token)
            near = sorted((w for w in words if w is not token and w.text.strip()
                           and not LEVEL_TOKEN.match(w.text)),
                          key=lambda w: abs((w.x0 + w.x1) / 2 - cx) + abs(_centre_y(w) - cy))
            nearby = []
            for w in near:
                if len(nearby) >= 14:
                    break
                t = w.text.strip()
                if t.upper() not in _NOISE and t not in nearby:
                    nearby.append(t)
            out.append({"level_id": f"L{len(out) + 1:03d}", "doc_id": doc_id,
                        "value": value, "raw": token.text, "nearby": nearby})
            if len([o for o in out if o["doc_id"] == doc_id]) >= per_sheet:
                break
    return out


def name_request(unnamed: list[dict]):
    """The level_name judgement over the unnamed figures. The figure itself is
    not in the prompt — the id and the words around it are; the model names
    the storey, code keeps the number."""
    from model.client import Request
    from spine.files import doc_name

    lines = [f"{u['level_id']} | {doc_name(u['doc_id'])} | {' / '.join(u['nearby'])}"
             for u in unnamed]
    return Request(judgement="level_name", context={"levels": "\n".join(lines)},
                   enum=("FOUNDATION", "BASEMENT n", "GROUND", "PODIUM n", "MEZZANINE",
                         "FLOOR n", "ROOF", "TOP OF ROOF", "LIFT MACHINE ROOM"))


def apply_names(payload: dict, unnamed: list[dict]) -> dict:
    """(doc_id, value) -> storey key, for answers that are a known id and a
    storey normalise_storey accepts; anything else is dropped."""
    by_id = {u["level_id"]: u for u in unnamed}
    out: dict = {}
    for item in (payload or {}).get("items", []):
        u = by_id.get(str(item.get("level_id") or ""))
        key = normalise_storey(str(item.get("storey") or ""), bare_numbers=False)
        if u is not None and key:
            out[(u["doc_id"], u["value"])] = key
    return out


def build_level_table(sheets, words_by_doc: dict,
                      names: dict | None = None) -> tuple[LevelTable, list]:
    """(LevelTable, gaps). Reads every considered sheet's words for a level
    token paired with a storey phrase, votes across sheets, and reports a
    storey stated at two values rather than choosing one.

    A token is paired when its own band names a storey. The SSL/LVL prefix
    case in the contract is the same rule: the prefix is noise on the band
    and the storey beside it is what pairs. `names` — (doc_id, value) ->
    storey key — supplies the pairings the model made for figures no band
    named (see unnamed_levels / apply_names); the value stays the code-read
    figure, the model only said which storey it is."""
    gaps: list[Gap] = []
    read: dict[str, dict[Decimal, Level]] = {}
    names = names or {}

    for sheet in sheets:
        doc_id = sheet.get("doc_id") if isinstance(sheet, dict) \
            else getattr(sheet, "doc_id", None)
        if not doc_id or not _considered(sheet):
            continue
        words = words_by_doc.get(doc_id) or []
        if not words:
            continue
        for token in words:
            if not LEVEL_TOKEN.match(token.text):
                continue
            key = _storey_on_band(token, words)
            if key is None:
                value_here = Decimal(token.text.replace("±", "").replace("+", ""))
                key = names.get((doc_id, value_here))
            if key is None:
                continue
            value = Decimal(token.text.replace("±", "").replace("+", ""))
            per_key = read.setdefault(key, {})
            level = per_key.setdefault(value, Level(key=key, value=value))
            level.votes += 1
            if not any(d == doc_id for d, _raw in level.citations):
                level.citations.append((doc_id, token.text))

    table = LevelTable()
    for key in sorted(read):
        candidates = sorted(read[key].values(), key=lambda lvl: lvl.value)
        table.candidates[key] = candidates
        if len(candidates) > 1:
            values = [lvl.value for lvl in candidates]
            table.conflicts.append((key, values))
            where = sorted({d for lvl in candidates for d, _r in lvl.citations})
            gaps.append(Gap(
                stage=STAGE, doc_id=where[0], subject=f"level {key}",
                reason=f"level {key} stated as "
                       f"{' and '.join(_signed(v) for v in values)} on "
                       f"{', '.join(where)}",
                detail="both kept; no storey height is derived through this "
                       "level until the drawings agree"))
        # the most-voted value stands in `levels`; a tie takes the lower so
        # two runs over the same sheets build the same table
        table.levels[key] = max(candidates, key=lambda lvl: (lvl.votes, -lvl.value))

    if not table.levels:
        gaps.append(Gap(stage=STAGE, doc_id=None, subject="level table",
                       reason="no level paired with a storey name on any "
                              "section, elevation or plan sheet",
                       detail="a level is [+-]d.dd(d) on the same text band "
                              "as a storey phrase; storey heights cannot be "
                              "derived"))
    return table, gaps


def _signed(value: Decimal) -> str:
    text = str(value)
    return text if text.startswith("-") else f"+{text}"


def _floor_number(key: str) -> int | None:
    m = re.fullmatch(r"FLOOR (\d+)", key)
    return int(m.group(1)) if m else None


def _height_or_reason(table: LevelTable, key: str):
    """((metres, basis) or None, reason when None). The reason is what the
    gap says; storey_height keeps the contract's plain shape."""
    if key not in table.levels:
        return None, f"{key} not in the level table"
    if table.conflicted(key):
        return None, f"{key} is stated at two values"
    here = table.levels[key]
    above = min((lvl for lvl in table.levels.values() if lvl.value > here.value),
                key=lambda lvl: lvl.value, default=None)
    if above is None:
        return None, f"no level above {key} is in the table"
    if table.conflicted(above.key):
        return None, f"{above.key}, the level above, is stated at two values"
    # a conflicted storey's alternative values may sit between the two
    for other, values in table.conflicts:
        if any(here.value < v < above.value for v in values):
            return None, f"{other} may lie between {key} and {above.key}"
    # FLOOR 8 with FLOOR 10 next by value is a table missing FLOOR 9. The
    # difference would be two storeys and read as one — on a real package
    # that was 7.20 m for a 3.60 m storey. Numbered floors carry their own
    # sequence, so the check costs nothing and catches exactly that.
    n_here, n_above = _floor_number(key), _floor_number(above.key)
    if n_here is not None and n_above is not None and n_above != n_here + 1:
        missing = ", ".join(f"FLOOR {n}" for n in range(n_here + 1, n_above))
        return None, (f"{missing} not read; the level above {key} in the "
                      f"table is {above.key}, so the difference spans more "
                      f"than one storey")
    height = above.value - here.value
    where = sorted({d for d, _r in here.citations + above.citations})
    basis = (f"{above.key} {_signed(above.value)} minus {key} "
             f"{_signed(here.value)} = {height} m, levels on {', '.join(where)}")
    return (height, basis), None


def storey_height(table: LevelTable, key: str) -> tuple[Decimal, str] | None:
    """(metres, basis) — the next higher level minus this storey's level.
    None at the top storey, for an unknown key, wherever a conflicted level
    is either end of the difference, and where the next numbered floor is
    missing from the table: a height through a level the drawings state
    twice, or across a storey they never state, is not a stated difference."""
    result, _reason = _height_or_reason(table, key)
    return result


def attach_heights(elements: list, base: EvidenceBase, table: LevelTable,
                   aliases: dict | None = None) -> tuple[list, list]:
    """(elements, gaps). Every column or wall whose schedule row states a
    location gets its storey height as a DERIVED dimension — a column's
    length, a wall's height — cited to the first sheet the level was read
    from. `aliases` maps a location string to a table key where
    normalise_storey could not (the model's level_alias answers).

    An element whose storey is not in the table, sits at the top, or whose
    level is conflicted keeps its dims as they were and gets a gap that names
    the storeys that WERE read. Never a typical height."""
    aliases = aliases or {}
    gaps: list[Gap] = []
    out = []
    listing = ", ".join(f"{k} {_signed(table.levels[k].value)}"
                        for k in table.keys()) or "none"
    for element in elements:
        role = HEIGHT_ROLE_BY_TYPE.get(element.element_type)
        location = element.location
        if role is None or not location or role in (element.dims or {}):
            out.append(element)
            continue
        key = aliases.get(location) or normalise_storey(location)
        doc_id = element.sheets[0] if element.sheets else None
        if key is None or key not in table.levels:
            out.append(element)
            gaps.append(Gap(stage="S9", doc_id=doc_id, subject=element.mark,
                            reason=f"storey '{location}' not in the level table "
                                   f"(levels read: {listing})",
                            detail=f"{element.element_type} {element.mark}: no "
                                   f"{role} derived; a typical storey height "
                                   "is not a stated one"))
            continue
        derived, why = _height_or_reason(table, key)
        if derived is None:
            out.append(element)
            gaps.append(Gap(stage="S9", doc_id=doc_id, subject=element.mark,
                            reason=f"no storey height for {key}: {why} "
                                   f"(levels read: {listing})",
                            detail=f"{element.element_type} {element.mark} at "
                                   f"'{location}'"))
            continue
        height, _basis = derived          # the id names both storeys; the
        cite = table.levels[key].citations[0][0]   # basis is re-derivable
        record_id = f"{element.element_type}:{element.mark}:{key}:{role}"
        if record_id not in base:
            base.make(record_id, height, "m", cite, None, Origin.DERIVED,
                      role=role)
        dims = dict(element.dims or {})
        dims[role] = record_id
        ids = tuple(element.evidence_ids) + (record_id,)
        out.append(Element(mark=element.mark, element_type=element.element_type,
                           dims=dims, count=element.count, sheets=element.sheets,
                           evidence_ids=ids, multiplier=element.multiplier,
                           location=location, bay=element.bay))
    return out, gaps


# ── the alias judgement ───────────────────────────────────────────────────
def alias_request(unknown: list[str], keys: list[str]):
    """The one model call: which table key each unresolved location string
    names. Context is the strings and the keys, nothing else; the enum is the
    keys, so an answer outside them fails validation before it is read."""
    from model.client import Request
    return Request(judgement="level_alias",
                   context={"locations": "\n".join(sorted(set(unknown))),
                            "storeys": ", ".join(keys)},
                   enum=tuple(keys))


def apply_aliases(payload: dict, unknown: list[str], keys: list[str]) -> dict:
    """location -> key, keeping only answers for a location that was asked
    about and a storey that is in the table. The model may omit; it may not
    add."""
    asked = set(unknown)
    allowed = set(keys)
    out: dict = {}
    for item in (payload or {}).get("items", []):
        if not isinstance(item, dict):
            continue
        location = str(item.get("location") or "")
        storey = str(item.get("storey") or "")
        if location in asked and storey in allowed:
            out[location] = storey
    return out


def main() -> int:
    ap = argparse.ArgumentParser(description="Read a level table from sheets.")
    ap.add_argument("pdf", nargs="+")
    args = ap.parse_args()
    from readers.extract import extract_words
    sheets, words = [], {}
    for name in args.pdf:
        path = Path(name)
        sheets.append({"doc_id": path.name, "tier": "T2"})
        words[path.name] = extract_words(path, 0)
    table, gaps = build_level_table(sheets, words)
    for key in table.keys():
        lvl = table.levels[key]
        derived = storey_height(table, key)
        height = f"{derived[0]} m" if derived else "-"
        print(f"  {key:<18} {_signed(lvl.value):>9}  votes {lvl.votes:<3} "
              f"storey {height:<9} {lvl.citations[0][0]}")
    for gap in gaps:
        print(f"  GAP {gap.subject}: {gap.reason}", file=sys.stderr)
    return 0 if table.levels else 1


if __name__ == "__main__":
    raise SystemExit(main())
