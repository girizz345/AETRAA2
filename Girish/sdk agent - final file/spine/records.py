#!/usr/bin/env python3
"""
records.py — the shared vocabulary. Every stage reads and writes these.

This file exists first and changes least. Stage 3 fixed the coordinate frame at
page-display-topleft-pt and every module that touches geometry inherits that
decision; if each stage declared its own record shape, that decision would have
to be re-made, and re-made differently, nine times.

Three rules are enforced by the types rather than by review:

  * Origin never upgrades. An EvidenceRecord created `inferred` stays inferred
    into the provenance sheet. There is no setter.
  * A Quantity may only cite EvidenceRecord ids. It carries no free value, so
    an untraceable quantity cannot be constructed.
  * Nothing here rounds. Rounding happens once, in measure.compute, at POMI
    precision.

Not a CLI.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from decimal import Decimal
from enum import Enum
from typing import Mapping, Sequence

FRAME = "page-display-topleft-pt"


class Origin(str, Enum):
    """How a value came to be known. Ordered weakest-last for reporting.

    DERIVED sits between STATED and COUNTED because its inputs are stated
    figures — a storey height is one stated level minus another — so it does
    not depend on a sheet's scale. MEASURED does: it is only as good as the
    calibration it was read against, which is why it ranks below COUNTED.

    TRANSCRIBED is a STATED figure that the sheet draws instead of writing:
    a schedule whose sizes and quantities are vector outlines, a title block
    drawn as graphics. The value is the drawing's own, read off it - never
    measured - so, like STATED, it does not depend on the sheet's scale; it
    ranks just below STATED because a reading, not the text layer, carried it.
    See DECISIONS.md, GP1.2 note: transcription."""
    STATED = "stated"      # read from a schedule cell or a dimension string
    TRANSCRIBED = "transcribed"  # a stated value the sheet draws as graphics, read off it
    DERIVED = "derived"    # arithmetic on stated figures: a level difference
    COUNTED = "counted"    # counted from repeated symbols on a sheet
    MEASURED = "measured"  # measured to a calibrated scale on a plan
    INFERRED = "inferred"  # derived without a stated source — rare under v3.1


class Tier(str, Enum):
    """probe.py's readability classes. T4 is refused, never OCR'd."""
    T1_CAD = "T1"        # DXF/DWG — out of scope at v3.1
    T2_VECTOR = "T2"     # vector geometry + a text layer — measurable
    T3_OUTLINED = "T3"   # vector, text outlined — not measurable
    T4_RASTER = "T4"     # raster only — refused


@dataclass(frozen=True)
class Word:
    """One text word with its box, in FRAME. index is assigned after sorting."""
    index: int
    text: str
    x0: float
    y0: float
    x1: float
    y1: float
    doc_id: str
    page: int


@dataclass(frozen=True)
class VectorPath:
    """One vector path. Generated, never accumulated — a sheet in the dev
    corpus carries 92,000 of these."""
    points: Sequence[tuple[float, float]]
    stroke: str | None
    fill: str | None
    width: float
    doc_id: str
    page: int


@dataclass(frozen=True)
class Region:
    """A rectangle on a sheet, in FRAME. What a markup primitive draws over
    and what a provenance line points at."""
    doc_id: str
    page: int
    x0: float
    y0: float
    x1: float
    y1: float


@dataclass(frozen=True)
class SheetRecord:
    """One row of the drawing register."""
    doc_id: str
    file_sha256: str
    drawing_no: str | None
    title: str | None
    revision: str | None
    scale: str | None
    subtitle: str | None      # load-bearing: carries the floor multiplier
    discipline: str | None
    section: str | None
    sheet_kind: str | None    # plan / section / elevation / detail / schedule
    tier: Tier
    superseded_by: str | None = None
    scale_verified: bool = False


@dataclass(frozen=True)
class EvidenceRecord:
    """A candidate value, addressable by id. The only thing a Quantity may
    cite. `origin` is set at construction and never changes."""
    id: str
    value: Decimal
    unit: str
    doc_id: str
    region: Region | None
    origin: Origin

    def citable_for_length_or_area(self, sheet: SheetRecord) -> bool:
        """A record from a scale-unverified sheet cannot be cited for length
        or area. Enforced in measure.evidence, stated here. DERIVED passes
        with STATED: a level difference is arithmetic on stated levels and
        never touched the sheet's scale."""
        return (sheet.scale_verified
                or self.origin in (Origin.STATED, Origin.TRANSCRIBED, Origin.DERIVED))


@dataclass(frozen=True)
class MeasuredLine:
    """One line of dimension paper for a measured element: nr x the dims it
    names, or nr x its one measured quantity (an area or a length taken off a
    shape). `dims` maps a role (length, width, height, area, quantity) to an
    evidence id; the line's value is nr times their product, negative for a
    deduction. `shapes` is what the markup draws for it, in FRAME:
    (("polygon" | "polyline", ((x, y), ...)), ...)."""
    doc_id: str
    level: str | None
    desc: str
    dims: Mapping[str, str]
    nr: int = 1
    deduct: bool = False
    shapes: Sequence = ()


@dataclass(frozen=True)
class Element:
    """A thing to be measured, consolidated across sheets."""
    mark: str
    element_type: str
    dims: Mapping[str, str]        # role -> evidence id
    count: int
    sheets: Sequence[str]
    evidence_ids: Sequence[str]
    multiplier: int = 1            # from the subtitle: (2ND, 4TH & 6TH) = 3
    # where the thing is. `location` is the storey the schedule row states,
    # as written ("Pod 1", "1st floor"); `bay` is the grid cell a plan-
    # measured occurrence sits in ("C/3"). Both default None so every
    # existing constructor call stands, and the mark stays the mark.
    location: str | None = None
    bay: str | None = None
    # A MEASURED element - walls, rooms, waterproofing taken off the plans
    # (measure.measured) - is one bill item built from several dimension lines,
    # one per plan and storey, each with its own evidence and its own shapes on
    # the drawing. Empty for a scheduled element, which is one dimension set.
    lines: Sequence["MeasuredLine"] = ()
    # the words a measured element is described by ("to floors, wet areas"),
    # in the slots the section's description convention prints
    words: Mapping[str, str] | None = None

    @property
    def key(self) -> str:
        """The element's identity for every lookup: the mark, qualified by
        the storey and the bay when it has them. One schedule mark split by
        location ("C 1" at Foundation, at Pod 1, at 1st floor) is several
        elements; keyed by mark alone they collided in every by-mark table
        and the last one written won. `mark` stays the mark as the schedule
        wrote it — that is what a take-off line shows and what a markup
        looks for on the sheet; `key` is what classifications and quantities
        cite."""
        out = self.mark
        if self.location:
            out += f" @ {self.location}"
        if self.bay:
            out += f" @ {self.bay}"
        return out


@dataclass(frozen=True)
class Binding:
    """Model output for one element: which record fills which formula role."""
    role: str
    evidence_id: str


@dataclass(frozen=True)
class Classification:
    """What the model is allowed to return. A clause id and role bindings —
    never a number."""
    element_mark: str
    clause_id: str
    bindings: Sequence[Binding]
    deduct: Sequence[str] = field(default_factory=tuple)


@dataclass(frozen=True)
class Quantity:
    """The output of measure.compute. Rounded exactly once, on construction
    by compute, and never again."""
    element_mark: str
    clause_id: str
    value: Decimal
    unit: str
    evidence_ids: Sequence[str]
    origin: Origin                 # weakest origin among its evidence
    section: str


@dataclass(frozen=True)
class BillLine:
    """One priced row. rate_source is mandatory — invariant 7."""
    section: str
    item_letter: str | None        # assigned at pagination, not before
    description: str
    quantity: Decimal | None
    unit: str
    rate: Decimal | None
    rate_source: str | None
    clause_id: str | None
    evidence_ids: Sequence[str] = field(default_factory=tuple)
    is_variant_of: str | None = None   # the Ditto shape
