"""Slopes: a surface measured on plan is shorter than it is. Its true area (or length up the slope) is the plan
figure times the slope factor 1 / cos(pitch).

A slope is written as a pitch in degrees ('15', '15°', '15 deg'), a gradient ('1:12', '1 in 12', '2:3') or a
percentage ('8%').
"""
from __future__ import annotations

import math
import re


def parse(text: str) -> tuple[float, str] | None:
    """(slope factor, the slope in words) or None if the text is not a slope. A flat or empty slope is None."""
    t = (text or "").strip().lower().replace("in", ":") if re.search(r"\d\s*in\s*\d", (text or "").lower()) \
        else (text or "").strip().lower()
    if not t:
        return None
    m = re.fullmatch(r"(\d+(?:\.\d+)?)\s*:\s*(\d+(?:\.\d+)?)", t)
    if m:
        rise, run = float(m.group(1)), float(m.group(2))
        if run <= 0:
            return None
        theta = math.atan(rise / run)
        words = f"{m.group(1)}:{m.group(2)}"
    else:
        m = re.fullmatch(r"(\d+(?:\.\d+)?)\s*%", t)
        if m:
            theta = math.atan(float(m.group(1)) / 100)
            words = f"{m.group(1)}%"
        else:
            m = re.fullmatch(r"(\d+(?:\.\d+)?)\s*(?:°|deg|degrees?)?", t)
            if not m:
                return None
            theta = math.radians(float(m.group(1)))
            words = f"{m.group(1)}°"
    if theta <= 0 or theta >= math.radians(80):
        return None
    deg = math.degrees(theta)
    return 1 / math.cos(theta), words + ("" if words.endswith("°") else f" ({deg:.1f}°)")
