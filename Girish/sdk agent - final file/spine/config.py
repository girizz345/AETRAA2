#!/usr/bin/env python3
"""
config.py — the settings that must not drift silently.

A pymupdf upgrade that changes vector extraction must be a visible change, not
quietly different quantities. Dependencies are pinned in uv.lock; the values
here are the ones the pipeline reads at runtime, and every one of them is a
number that would change an output if it moved.

POMI_DP is the single rounding precision. Nothing else in the package rounds.

Not a CLI.
"""
from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True)
class Config:
    # -- arithmetic [GP3.1] ------------------------------------------------
    # Each DIMENSION is rounded as it is taken, to 0.01 m. The PRODUCT is
    # never rounded. 4.237 x 2.981 -> 4.24 x 2.98 = 12.6352 m2, not 12.63.
    dimension_dp: int = 2            # metres, 2 dp -- the only rounding point
    round_products: bool = False     # GP3.1. Do not set true without a GP1.2
                                     # amendment declared in the bill.

    # -- bill format, measured from the reference BOQ ----------------------
    page_rows: int = 62
    letter_sequence: str = "ABCDEFGHJKLMNPQRSTUV"   # I and O omitted
    col_widths: dict = field(default_factory=lambda: {
        "A": 4.7, "C": 31.7, "E": 8.7, "F": 5.7, "G": 12.7, "H": 17.4})

    # -- execution ---------------------------------------------------------
    max_workers: int = 8             # real limit is provider rate limits
    model_retries: int = 2           # schema-invalid only

    # -- pricing -----------------------------------------------------------
    rate_divergence_flag: float = 0.30   # >30% from a project document

    # -- refusals ----------------------------------------------------------
    refuse_tiers: tuple = ("T3", "T4")   # no OCR, ever

    def replace(self, **kwargs) -> "Config":
        from dataclasses import replace as _replace
        return _replace(self, **kwargs)


DEFAULT = Config()
