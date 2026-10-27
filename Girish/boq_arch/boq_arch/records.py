"""Shared record types. Every quantity carries its origin and its sheet."""
from __future__ import annotations

from dataclasses import dataclass, field, asdict

# Evidence origins (see the agent brief).
STATED = "STATED"            # printed in the text layer / schedule cell
COUNTED = "COUNTED"          # tags counted in the text layer
MEASURED = "MEASURED"        # scaled off calibrated vector geometry
READ_VISUAL = "READ (VISUAL)"  # read off the rendered image by a vision model
DERIVED = "DERIVED"          # arithmetic on the above (level differences etc.)
CORRECTED = "MEASURED (CORRECTED)"  # measured geometry a person reclassified (a wall's thickness, a room's name)
MANUAL = "MEASURED (MANUAL)"        # clicked on the drawing by a person

POMI_ORDER = "ABCDEFGHJKLMNPQR"     # sections in bill order


@dataclass
class Gap:
    sheet: str
    field: str
    reason: str
    section: str = ""

    def key(self) -> tuple:
        return (self.section, self.sheet, self.field, self.reason)


@dataclass
class Line:
    """One dimensioned line of dimension paper. Qty each = L*W*H of those given, or qty_each."""
    ref: str                 # drawing number
    level: str
    desc: str
    nr: float = 1
    L: float | None = None
    W: float | None = None
    H: float | None = None
    qty_each: float | None = None
    location: str = ""
    origin: str = ""
    deduct: bool = False     # a deduction line (qty negative)
    memo: bool = False       # a note line: rendered italic, carries no quantity
    shapes: tuple = ()       # the drawn shapes it was measured from, "<drawing>/<shape id>" (w wall, r room, t tag)

    def each(self) -> float:
        if self.memo:
            return 0.0
        dims = [d for d in (self.L, self.W, self.H) if d is not None]
        if dims:
            v = 1.0
            for d in dims:
                v *= d
        else:
            v = self.qty_each or 0.0
        return -abs(v) if self.deduct else v

    def total(self) -> float:
        return self.nr * self.each()


@dataclass
class Item:
    """One bill item: description + unit + the dimension lines that build its quantity."""
    section: str             # POMI section letter
    group: str               # element heading in the bill ("Doors", "Walls", ...)
    group_desc: str          # shared description block (the house item_group paragraph)
    subgroup: str            # optional one-line sub-heading
    description: str         # the variant line ("Single leaf ... type D-1")
    unit: str
    clause: str              # governing POMI clause
    lines: list[Line] = field(default_factory=list)
    code: str = ""           # take-off item code, assigned at render (H-A, H-B ...)
    note: str = ""
    # bill layout, as the issued sample bills:
    heads: tuple = ()        # bold-underlined element headings, outermost first ("Internal Finishes", "Finishing")
    note_lines: tuple = ()   # a "Note:" block printed under the first heading when that element starts
    uhead: str = ""          # underlined heading above the description paragraph ("Floors")
    open: bool = False       # two independent counts disagree: listed, quantity left blank until resolved

    def levels(self) -> list[tuple[str, str]]:
        """(style, text) from the outermost heading down to the sub-heading; style BU / U / UD."""
        out = [("BU", h) for h in self.heads]
        if self.uhead:
            out.append(("U", self.uhead))
        if self.group_desc:
            out.append(("UD", self.group_desc))
        if self.subgroup:
            out.append(("U", self.subgroup))
        return out

    def quantity(self) -> float:
        return sum(l.total() for l in self.lines)

    def key(self) -> str:
        """The item within its bill: section, sub-heading and wording (skirtings and wall plaster share the
        wording 'To walls, ...' and differ by sub-heading)."""
        return f"{self.section}|{self.uhead}|{self.description}"

    def origins(self) -> str:
        return ", ".join(sorted({l.origin for l in self.lines if l.origin}))


def to_dict(obj):
    return asdict(obj)
