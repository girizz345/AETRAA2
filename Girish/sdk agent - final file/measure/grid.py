#!/usr/bin/env python3
"""
grid.py — S4: the grid and the scale of one sheet, from its text layer only.

A port of the proven pass-A / pass-B arithmetic of the coordination-check
M2 grid module (`_classify`, `_tag_bands`, `_cluster_anchored`,
`_pitch_variance`, `_build_candidate`, `_read_chain`, `_rank_key`,
`_best_accepted`, `_build_accepted_axis`, `_build_bays`) into one standalone
module, plus the one thing that source never did: turn the dimension chain
printed between the bubbles into millimetres per point.

ZERO model calls, nothing rendered, nothing written, deterministic: the same
words give byte-identical maps. Every failure is a status with a basis line a
reviewer can check, never a default scale.

Coordinate space: readers.extract words — page-display-topleft-pt (upright
page, origin top-left, y down, page rect [0,0,W,H] after /Rotate). Nothing here
rotates anything further; the rotation is recorded on the map.

How the scale is settled (the part that is new):
  * an accepted label axis has centres c_0..c_n along the page; the gaps
    between consecutive bubbles are the bay pitches in POINTS;
  * the dimension tokens in the same edge band are clustered onto printed
    lines (same routine as the labels); a DIM token that sits alone between
    two consecutive bubbles is that bay's width in MILLIMETRES;
  * each such pair gives mm/pt; the pairs of both axes are pooled; the median
    is the sheet's scale when at least two pairs agree with it within
    C55_VARIANCE_MED. Fewer than two → PARTIAL, never a guess.
  * The axis that carries a matching chain outranks a longer one that does
    not — the sheet-frame reference letters (A–P down the border of an A1
    frame) are longer than any building grid and carry no chain.

Vocabulary extension over the source: labels of the form Y01 / X02 (one letter
and one or two digits, no separator) are accepted as an axis whose members
share the prefix. Hyphenated references (E-04, S-01) are deliberately not.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field, asdict
from decimal import Decimal
from pathlib import Path

# Input words are spine.records.Word (text, x0, y0, x1, y1); only those five
# attributes are read, so any object carrying them serves.

# ---------------------------------------------------------------- constants
# Inlined from the coordination-check cc_constants.py so this module has no
# cc_* import. The id is kept so a reviewer can trace each one to its origin.
C28_CHAIN_MIN_MM = 800       # shortest token admitted to a dimension chain (mm);
                             # run configuration in the source, defaulted here
C29_CHAIN_MAX_MM = 20000     # longest token admitted to a dimension chain (mm)
C50_EDGE_BAND = 0.30         # outer band, fraction of the page SHORT side, in which
                             # bubbles and chains are searched AND accepted (G-BAND)
C51_LINE_TOL = 2.5           # * glyph height — perpendicular tolerance grouping
                             # tokens onto one printed line from a fixed anchor
C52_AXIS_MIN_LABELS = 3      # fewest labels that make an axis; two fake a pitch
C53_DENSITY_MIN = 0.60       # labels over the key-span they cover; an axis is
                             # consecutive (I and O skipped score 0.90, not 1.00)
C54_GAP_OUTLIER = 4.0        # * median pitch — a gap beyond this is excluded from
                             # the pitch/variance MEASUREMENT only, never a label
C55_VARIANCE_MED = 0.15      # pitch variance at or above this sets MED, never
                             # rejects; here also the chain/pitch agreement band
C56_SHEET_BUDGET_MS = 244    # measured pass-A cost per sheet in the source; the
                             # S4 stage budget is the caller's, quoted for scale

# This module's own, not from cc_constants — each earned on a real sheet:
MARGIN_DEPTH = 0.02          # a label run shallower than this share of the short
                             # side sits in the drawing-border margin: it is the
                             # sheet-frame reference grid (A–P / 1–20), not the
                             # building's, and it carries no chain
CHAIN_REACH = 8.0            # * label glyph height — how far from the bubble row a
                             # dimension line may sit and still be that row's chain
STRAY_MAX = C52_AXIS_MIN_LABELS - 1   # tokens of another kind on a bubble row that
                             # are strays (a north-arrow 'S'), not a legend

PT_TO_MM_PAPER = Decimal("25.4") / Decimal(72)   # one PDF point on paper, mm

_CONF_ORDER = {"HIGH": 0, "MED": 1, "LOW": 2}
_BAND_ORDER = {"BOTTOM": 0, "TOP": 1, "LEFT": 2, "RIGHT": 3}
_ORIENT = {"BOTTOM": "X", "TOP": "X", "LEFT": "Y", "RIGHT": "Y"}
_GUARD_ORDER = ("vocabulary", "count", "band", "margin", "density", "monotonic")
_PREFIXED = re.compile(r"^([A-Za-z])(\d{1,2})$")
_SCALE = re.compile(r"1\s*[:/]\s*(\d{1,4})")
# ISO A sizes in points (w x h, landscape), for the fallback basis line only
_PAPER = (("A0", 3370.0, 2384.0), ("A1", 2384.0, 1684.0),
          ("A2", 1684.0, 1191.0), ("A3", 1191.0, 842.0), ("A4", 842.0, 595.0))


# ---------------------------------------------------------------- the record
@dataclass
class GridMap:
    doc_id: str
    W: float
    H: float
    rotation: int
    status: str                                  # CALIBRATED | PARTIAL | NONE
    letters: list = field(default_factory=list)  # [(label, pos_pt)] sorted by pos
    numbers: list = field(default_factory=list)
    letters_axis: str | None = None              # page axis the letters run along
    numbers_axis: str | None = None              # same for the numbers (extra)
    mm_per_pt: Decimal | None = None
    scale_basis: str = "none"
    confidence: str | None = None                # HIGH | MED | LOW | None
    chain: list = field(default_factory=list)    # dimension chain read, mm
    basis: str = ""                              # one line a reviewer can check

    def to_dict(self) -> dict:
        d = asdict(self)
        d["mm_per_pt"] = None if self.mm_per_pt is None else str(self.mm_per_pt)
        d["letters"] = [list(p) for p in self.letters]
        d["numbers"] = [list(p) for p in self.numbers]
        return d


# ---------------------------------------------------------------- small maths
def _median(xs):
    s = sorted(xs)
    n = len(s)
    if n == 0:
        return 0.0
    return s[n // 2] if n % 2 else (s[n // 2 - 1] + s[n // 2]) / 2.0


def _pop_stdev(xs):
    n = len(xs)
    if n < 1:
        return 0.0
    m = sum(xs) / n
    return (sum((x - m) ** 2 for x in xs) / n) ** 0.5


def _conf_lower(a, b):
    return a if _CONF_ORDER.get(a, 2) >= _CONF_ORDER.get(b, 2) else b


def _agreeing(ratios):
    """The ratios that agree: each within C55/2 of the median, so any two
    agreeing values differ by at most C55. Measured against the median only,
    two values 22% apart would BOTH pass a ±15% band — two points fake a
    scale the way two labels fake a pitch."""
    if len(ratios) < 2:
        return []
    med = _median(ratios)
    if med <= 0:
        return []
    return [r for r in ratios if abs(r - med) <= (C55_VARIANCE_MED / 2) * med]


# ---------------------------------------------------------------- tokens
def _tokens_from_words(words) -> list[dict]:
    """The token dict the ported arithmetic reads. `height` is the glyph
    height regardless of text rotation — min(w, h) — because a label printed
    up the left band has its glyph height along x."""
    out = []
    for w in words:
        x0, y0, x1, y1 = float(w.x0), float(w.y0), float(w.x1), float(w.y1)
        out.append({
            "text": w.text.strip(),
            "x0": x0, "y0": y0, "x1": x1, "y1": y1,
            "cx": (x0 + x1) / 2.0, "cy": (y0 + y1) / 2.0,
            "height": max(min(x1 - x0, y1 - y0), 0.1),
        })
    out.sort(key=lambda t: (round(t["cy"], 2), round(t["cx"], 2), t["text"]))
    return out


# ---------------------------------------------------------------- classification
def _classify(text):
    """kind in LETTER | NUMBER | PREFIXED | DIM | OTHER.

    LETTER    one alphabetic character, not I or O (they read as 1 and 0 on a
              print, so grid labelling omits both).
    NUMBER    one or two digits. The width rule keeps a dimension chain from
              ever being proposed as a numeric axis.
    PREFIXED  one letter + one or two digits, no separator: Y01, X2, A12.
    DIM       three to five digits with a value in [C28, C29]. Six digits is a
              coordinate or a level, not a bay.
    Returns (kind, key, mm, prefix)."""
    if len(text) == 1 and text.isalpha():
        if text.upper() in ("I", "O"):
            return ("OTHER", None, None, None)
        return ("LETTER", ord(text.upper()) - ord("A"), None, None)
    if text.isascii() and text.isdigit():
        n = len(text)
        v = int(text)
        if 1 <= n <= 2:
            return ("NUMBER", v, None, None)
        if 3 <= n <= 5 and C28_CHAIN_MIN_MM <= v <= C29_CHAIN_MAX_MM:
            return ("DIM", None, v, None)
        return ("OTHER", None, None, None)
    m = _PREFIXED.match(text)
    if m and m.group(1).upper() not in ("I", "O"):
        return ("PREFIXED", int(m.group(2)), None, m.group(1).upper())
    return ("OTHER", None, None, None)


# ---------------------------------------------------------------- bands
def _tag_bands(tok, W, H, d):
    """0, 1 or 2 of TOP BOTTOM LEFT RIGHT. A corner token lies in two bands and
    is evaluated in both — assigning it by nearest edge steals the end bubble
    off a real row. Bands are the outer C50 of the SHORT side, all four the
    same depth. y-down space: TOP y=0, BOTTOM y=H, LEFT x=0, RIGHT x=W."""
    cx, cy = tok["cx"], tok["cy"]
    bands = []
    if cy <= d:
        bands.append("TOP")
    if cy >= H - d:
        bands.append("BOTTOM")
    if cx <= d:
        bands.append("LEFT")
    if cx >= W - d:
        bands.append("RIGHT")
    return bands


def _in_margin(tok, W, H, margin):
    """Within `margin` pt of ANY page edge. A label there is border furniture
    (the frame's A–P / 1–20 reference), whichever band it is read in."""
    return (tok["cx"] <= margin or tok["cy"] <= margin
            or tok["cx"] >= W - margin or tok["cy"] >= H - margin)


def _perp_of(band):
    return "cy" if band in ("TOP", "BOTTOM") else "cx"


def _along_of(band):
    return "cx" if band in ("TOP", "BOTTOM") else "cy"


def _depth(perp, band, W, H, short):
    """Anchor's distance from its page edge over the short side. The SAME
    constant C50 is the search band and the accept test (G-BAND)."""
    if band == "TOP":
        dist = perp
    elif band == "BOTTOM":
        dist = H - perp
    elif band == "LEFT":
        dist = perp
    else:
        dist = W - perp
    return dist / short if short else 0.0


def _cluster_anchored(tokens, band, band_all_tokens):
    """Group tokens onto printed lines perpendicular to the axis from a FIXED
    anchor — the first token in ascending perpendicular order; the anchor is
    NOT updated as members join. Chaining would walk through a dense notes
    block and swallow the bubble row; a bubble row is precisely aligned by
    construction, so the fixed anchor costs nothing on a real row."""
    if not tokens:
        return []
    perp = _perp_of(band)
    along = _along_of(band)
    hgt = _median([t["height"] for t in tokens])
    if len(tokens) < 3:
        hgt = _median([t["height"] for t in band_all_tokens]) or hgt
    tol = C51_LINE_TOL * hgt
    ordered = sorted(tokens, key=lambda t: (t[perp], t[along], t["text"]))
    lines = []
    for t in ordered:
        if lines and abs(t[perp] - lines[-1]["anchor"]) <= tol:
            lines[-1]["members"].append(t)          # the anchor is not updated
        else:
            lines.append({"anchor": t[perp], "members": [t]})
    for line in lines:
        line["members"].sort(key=lambda t: (t[along], t["text"]))
    return lines


def _pitch_variance(positions):
    """Median gap and its relative spread. C54 excludes a gap from the
    MEASUREMENT only and never removes a label."""
    gaps = [positions[i + 1] - positions[i] for i in range(len(positions) - 1)]
    if not gaps:
        return 0.0, 0.0
    pitch = _median(gaps)
    if pitch <= 0:
        return 0.0, 0.0
    kept = [g for g in gaps
            if pitch / C54_GAP_OUTLIER <= g <= pitch * C54_GAP_OUTLIER]
    variance = (_pop_stdev(kept) / pitch) if len(kept) >= 2 else 0.0
    return pitch, variance


# ---------------------------------------------------------------- candidates
def _build_candidate(line, band, W, H, short):
    """One clustered line → an axis candidate, or None when the line mixes
    kinds (a legend, not an axis) or mixes prefixes. The source discarded a
    mixed line whole; here a line is kept when the other kinds are STRAYS —
    at most STRAY_MAX tokens, too few to be an axis themselves (a north-arrow
    'S' on the bubble row) — and discarded whole otherwise. The guards run
    here and every result is recorded before any ranking."""
    members = _dominant_family(line["members"])
    if members is None:
        return None
    kind = members[0]["kind"]
    if kind == "LETTER":
        family = "letters"
    elif kind == "NUMBER":
        family = "numbers"
    else:
        family = "prefixed:" + members[0]["prefix"]

    along = _along_of(band)
    perp = _perp_of(band)
    labels = [t["text"] for t in members]
    positions = [t[along] for t in members]
    keys = [t["key"] for t in members]
    anchor = _median([t[perp] for t in members])
    depth = _depth(anchor, band, W, H, short)
    n = len(labels)
    glyph = _median([t["height"] for t in members])

    span_keys = (max(keys) - min(keys) + 1) if keys else 1
    density = n / span_keys if span_keys else 0.0

    asc = n >= 2 and all(keys[i + 1] > keys[i] for i in range(n - 1))
    desc = n >= 2 and all(keys[i + 1] < keys[i] for i in range(n - 1))
    monotonic = "ASC" if asc else ("DESC" if desc else None)

    pitch, variance = _pitch_variance(positions)

    guards = {
        "vocabulary": not any(lab.upper() in ("I", "O") for lab in labels),
        "count": n >= C52_AXIS_MIN_LABELS,
        "band": depth <= C50_EDGE_BAND,
        "margin": depth >= MARGIN_DEPTH,
        "density": density >= C53_DENSITY_MIN,
        "monotonic": bool(monotonic),
    }
    accepted = all(guards.values())
    reject_why = None
    if not accepted:
        for g in _GUARD_ORDER:
            if not guards[g]:
                reject_why = g
                break

    return {
        "band": band, "orientation": _ORIENT[band], "family": family,
        "labels": labels, "keys": keys, "positions": positions,
        "anchor": anchor, "depth": depth, "n": n, "density": density,
        "monotonic": monotonic, "pitch": pitch, "variance": variance,
        "glyph": glyph,
        "guards": guards, "accepted": accepted, "reject_why": reject_why,
        "match": {"pairs": [], "consistent": 0, "chain": []},
    }


def _dominant_family(members):
    """The members of a line's dominant family (kind, and prefix for
    PREFIXED), or None when the rest are too many to be strays."""
    fam_of = lambda t: (t["kind"], t.get("prefix"))       # noqa: E731
    counts = {}
    for t in members:
        counts[fam_of(t)] = counts.get(fam_of(t), 0) + 1
    if not counts:
        return None
    ranked = sorted(counts.items(), key=lambda kv: -kv[1])
    dom, n_dom = ranked[0]
    # strays: every other family is too small to be an axis itself and
    # strictly smaller than the dominant one; a legend fails both
    for fam, n in ranked[1:]:
        if n > STRAY_MAX or n >= n_dom:
            return None
    return [t for t in members if fam_of(t) == dom]


def _read_chain(dim_tokens, band):
    """Dimension tokens ordered along the band's axis; two or more required."""
    if len(dim_tokens) < 2:
        return None
    along = _along_of(band)
    ordered = sorted(dim_tokens, key=lambda t: (t[along], t["text"]))
    return {"band": band, "values": [t["mm"] for t in ordered],
            "n": len(ordered)}


def _match_chain(cand, dim_lines):
    """Pair each bay of a candidate with the ONE dimension token that sits
    between its two bubbles on one printed dimension line. The line with the
    most pairs is the candidate's chain. A pair is (mm, gap_pt, mm/pt).
    `consistent` counts the pairs within C55 of the line's own median ratio;
    one pair alone is never consistent — a single agreement is coincidence.
    A dimension line farther than CHAIN_REACH glyph heights from the bubble
    row is some other dimension, not this row's chain."""
    along = _along_of(cand["band"])
    centres = cand["positions"]
    reach = CHAIN_REACH * cand["glyph"]
    best = {"pairs": [], "consistent": 0, "chain": [], "line_perp": None}
    best_key = None
    for line in dim_lines:
        dist = abs(line["anchor"] - cand["anchor"])
        if dist > reach:
            continue
        members = line["members"]
        pairs = []
        for i in range(len(centres) - 1):
            lo, hi = centres[i], centres[i + 1]
            inside = [t for t in members if lo < t[along] < hi]
            if len(inside) == 1 and hi > lo:
                mm = inside[0]["mm"]
                pairs.append((mm, hi - lo, mm / (hi - lo)))
        if not pairs:
            continue
        consistent = len(_agreeing([p[2] for p in pairs]))
        key = (-consistent, -len(pairs), dist)
        if best_key is None or key < best_key:
            best_key = key
            best = {"pairs": pairs, "consistent": consistent,
                    "chain": [t["mm"] for t in members],
                    "line_perp": line["anchor"]}
    return best


def _rank_key(c):
    """Total order for accepted candidates: most chain-consistent bays →
    most labels → highest density → shallowest band → lowest variance → band
    order → lowest first key. The chain term is the one addition to the
    source order: an axis the sheet dimensions outranks one it does not."""
    first_key = c["keys"][0] if c["keys"] else 0
    return (-c["match"]["consistent"], -c["n"], -c["density"], c["depth"],
            c["variance"], _BAND_ORDER.get(c["band"], 9), first_key)


def _best_accepted(candidates, family=None):
    cs = [c for c in candidates if c["accepted"]
          and (family is None or c["family"] == family)]
    cs.sort(key=_rank_key)
    return cs[0] if cs else None


# ---------------------------------------------------------------- accepted axis
def _build_accepted_axis(cand, W, H):
    """A winning candidate → an accepted axis. A DESC run is a grid numbered
    the other way; reversed for emit and recorded. Spans run midpoint to
    midpoint, clipped to the page."""
    orient = cand["orientation"]
    page_lo, page_hi = (0.0, W) if orient == "X" else (0.0, H)
    pairs = list(zip(cand["labels"], cand["positions"], cand["keys"]))
    printed = cand["monotonic"]
    if printed == "DESC":
        pairs = list(reversed(pairs))
    labels = [p[0] for p in pairs]
    centres = [p[1] for p in pairs]
    n = len(labels)
    pitch = cand["pitch"]
    confidence = "HIGH" if cand["variance"] < C55_VARIANCE_MED else "MED"
    axis_labels = []
    for i, lab in enumerate(labels):
        c = centres[i]
        lo = (centres[i - 1] + c) / 2.0 if i > 0 else c - pitch / 2.0
        hi = (c + centres[i + 1]) / 2.0 if i < n - 1 else c + pitch / 2.0
        lo, hi = min(lo, hi), max(lo, hi)
        axis_labels.append({"label": lab, "centre": c,
                            "span": [max(lo, page_lo), min(hi, page_hi)],
                            "confidence": confidence})
    return {"family": cand["family"], "band": cand["band"],
            "orientation": orient, "printed": printed, "labels": axis_labels,
            "pitch": pitch, "variance": cand["variance"],
            "confidence": confidence, "match": cand["match"]}


def _spans(positions, page_lo, page_hi):
    """Midpoint-to-midpoint spans for a sorted list of centres (bay map rule
    of the source: a point belongs to its NEAREST gridline)."""
    n = len(positions)
    if n == 0:
        return []
    pitch, _ = _pitch_variance(positions)
    out = []
    for i, c in enumerate(positions):
        lo = (positions[i - 1] + c) / 2.0 if i > 0 else c - pitch / 2.0
        hi = (c + positions[i + 1]) / 2.0 if i < n - 1 else c + pitch / 2.0
        out.append((max(min(lo, hi), page_lo), min(max(lo, hi), page_hi)))
    return out


def _build_bays(letters_axis, numbers_axis, W, H):
    """Bays from the two accepted axes, not from evidence at each
    intersection. Letters always first. Kept for parity with the source;
    bay_of computes the same rectangle on demand."""
    bays = {}
    letters_x = letters_axis["orientation"] == "X"
    for la in letters_axis["labels"]:
        for nu in numbers_axis["labels"]:
            x_span = la["span"] if letters_x else nu["span"]
            y_span = nu["span"] if letters_x else la["span"]
            bbox = [max(min(x_span), 0.0), max(min(y_span), 0.0),
                    min(max(x_span), W), min(max(y_span), H)]
            bays[f"{la['label']}/{nu['label']}"] = {
                "bbox": bbox, "letter": la["label"], "number": nu["label"],
                "confidence": _conf_lower(la["confidence"], nu["confidence"])}
    return bays


# ---------------------------------------------------------------- scale
def parse_title_scale(text) -> int | None:
    """'1:100', '1 : 50', '1/200' → the denominator. 'NTS', 'AS SHOWN',
    None → None. A first-match read; a sheet quoting several scales gives its
    first, which is why this is only ever a LOW-confidence fallback."""
    if not text:
        return None
    m = _SCALE.search(str(text))
    if not m:
        return None
    v = int(m.group(1))
    return v if v > 0 else None


def _paper_name(W, H):
    lo, hi = sorted((float(W), float(H)))
    for name, pw, ph in _PAPER:
        if abs(hi - pw) <= 0.01 * pw and abs(lo - ph) <= 0.01 * ph:
            return name
    return f"{W:.0f}x{H:.0f} pt"


def _implied_scale(mm_per_pt: Decimal) -> Decimal:
    return mm_per_pt / PT_TO_MM_PAPER


def _pool_ratios(axes):
    """Pool the chain pairs of the chosen axes and settle the scale: the
    median of the agreeing ratios, when at least two pairs agree (see
    _agreeing) AND the agreeing pairs are the majority — a chain two of whose
    six bays agree is not a chain that agrees. Returns (mm_per_pt | None,
    n_agree, n_pairs, spread)."""
    pairs = []
    for ax in axes:
        if ax:
            pairs.extend(ax["match"]["pairs"])
    if len(pairs) < 2:
        return None, 0, len(pairs), 0.0
    agree = _agreeing([p[2] for p in pairs])
    if len(agree) < 2 or 2 * len(agree) < len(pairs):
        return None, len(agree), len(pairs), 0.0
    value = _median(agree)
    spread = max(abs(r - value) / value for r in agree) if value else 0.0
    return value, len(agree), len(pairs), spread


# ---------------------------------------------------------------- basis
def _axis_words(ax, name):
    labs = [lab["label"] for lab in ax["labels"]]
    return (f"{len(labs)} {name} ({labs[0]}–{labs[-1]}) at pitch "
            f"{ax['pitch']:.0f} pt along {ax['band']}"
            + (" (printed descending)" if ax["printed"] == "DESC" else ""))


def _none_basis(candidates, rot):
    if not candidates:
        why = ("no run of 3 single labels lies in any edge band; the bubbles "
               "on this sheet are outlined glyphs or the sheet has no grid")
    else:
        near = sorted(candidates, key=lambda c: (-c["n"], c["depth"]))[0]
        why = (f"no candidate passed all five guards; nearest run "
               f"({near['n']} labels, band {near['band']}) failed "
               f"{near['reject_why']}")
    return f"NONE - {why}; rotation {rot}."


# ---------------------------------------------------------------- the entry
def calibrate_sheet(words, W, H, rotation, doc_id, title_scale=None) -> GridMap:
    """Read the bubbles and the chain off one sheet's words and settle the
    scale. Pure; deterministic; never writes."""
    W, H = float(W), float(H)
    rot = int(rotation) % 360
    short = min(W, H) if min(W, H) > 0 else 1.0
    d = C50_EDGE_BAND * short

    work = []
    margin = MARGIN_DEPTH * short
    for t in _tokens_from_words(words):
        kind, key, mm, prefix = _classify(t["text"])
        if kind == "OTHER":
            continue
        if kind != "DIM" and _in_margin(t, W, H, margin):
            continue          # border furniture: the sheet-frame reference grid
        t.update(kind=kind, key=key, mm=mm, prefix=prefix,
                 bands=_tag_bands(t, W, H, d))
        work.append(t)

    candidates = []
    band_chains = {}
    for band in ("BOTTOM", "TOP", "LEFT", "RIGHT"):
        in_band = [t for t in work if band in t["bands"]]
        label_tokens = [t for t in in_band
                        if t["kind"] in ("LETTER", "NUMBER", "PREFIXED")]
        dim_tokens = [t for t in in_band if t["kind"] == "DIM"]
        dim_lines = _cluster_anchored(dim_tokens, band, in_band)
        for line in _cluster_anchored(label_tokens, band, in_band):
            cand = _build_candidate(line, band, W, H, short)
            if cand is None:
                continue
            if cand["accepted"]:
                cand["match"] = _match_chain(cand, dim_lines)
            candidates.append(cand)
        ch = _read_chain(dim_tokens, band)
        if ch is not None:
            band_chains[band] = ch

    gm = GridMap(doc_id=doc_id, W=W, H=H, rotation=rot, status="NONE")

    primary = _best_accepted(candidates)
    if primary is None:
        gm.basis = _none_basis(candidates, rot)
        if band_chains:
            longest = sorted(band_chains.values(),
                             key=lambda c: (-c["n"], _BAND_ORDER[c["band"]]))[0]
            gm.chain = list(longest["values"])
        return gm

    # the second axis: opposite orientation, a different family (B10 in the
    # source drops a same-orientation second axis; here it is never chosen)
    others = [c for c in candidates if c["accepted"] and c is not primary
              and c["orientation"] != primary["orientation"]
              and c["family"] != primary["family"]]
    others.sort(key=_rank_key)
    secondary = others[0] if others else None

    ax_p = _build_accepted_axis(primary, W, H)
    ax_s = _build_accepted_axis(secondary, W, H) if secondary else None
    letters_ax, numbers_ax = _assign_slots(ax_p, ax_s)

    # the map lists gridlines by POSITION (a DESC run reads back to front)
    if letters_ax:
        gm.letters = sorted(((lab["label"], lab["centre"]) for lab in letters_ax["labels"]),
                            key=lambda p: (p[1], p[0]))
        gm.letters_axis = letters_ax["orientation"]
    if numbers_ax:
        gm.numbers = sorted(((lab["label"], lab["centre"]) for lab in numbers_ax["labels"]),
                            key=lambda p: (p[1], p[0]))
        gm.numbers_axis = numbers_ax["orientation"]

    # chain: the matched dimension lines, primary then secondary; else the
    # longest band chain as the source read it
    chain = list(ax_p["match"]["chain"]) + (list(ax_s["match"]["chain"]) if ax_s else [])
    if not chain and band_chains:
        longest = sorted(band_chains.values(),
                         key=lambda c: (-c["n"], _BAND_ORDER[c["band"]]))[0]
        chain = list(longest["values"])
    gm.chain = chain

    parts = []
    if letters_ax:
        parts.append(_axis_words(letters_ax, "letters"))
    if numbers_ax:
        parts.append(_axis_words(numbers_ax, "numbers"))

    value, n_agree, n_pairs, spread = _pool_ratios([ax_p, ax_s])
    title_den = parse_title_scale(title_scale)

    if value is not None:
        gm.status = "CALIBRATED"
        gm.mm_per_pt = Decimal(repr(float(value)))
        implied = _implied_scale(gm.mm_per_pt)
        # Scale confidence is about the CHAIN, not the bay pitch: uneven bays
        # give a real grid a pitch variance above C55 (axis MED in the
        # source) and say nothing about how well the chain fits them.
        conf = ("HIGH" if n_agree >= 3 and spread <= C55_VARIANCE_MED / 3
                else "MED")
        gm.scale_basis = (f"dimension chain: {n_agree} bays agree within "
                          f"{spread * 100:.0f}%")
        note = ""
        if title_den is not None:
            if abs(float(implied) / title_den - 1.0) > C55_VARIANCE_MED:
                conf = _conf_lower(conf, "MED")
                note = (f"; title block 1:{title_den} DISAGREES with the "
                        f"chain (kept: the chain)")
            else:
                note = f"; title block 1:{title_den} agrees"
        gm.confidence = conf
        gm.basis = (", ".join(parts)
                    + f"; chain {' '.join(str(v) for v in chain[:12])}"
                    + (" ..." if len(chain) > 12 else "")
                    + f" matches {n_agree} of {n_pairs} bays; "
                    f"{float(gm.mm_per_pt):.4f} mm/pt = 1:{float(implied):.0f}"
                    + note + f"; rotation {rot}.")
        return gm

    gm.status = "PARTIAL"
    why = (f"{n_agree} of {n_pairs} chain bays agree" if n_pairs
           else "no dimension chain between the bubbles")
    if title_den is not None:
        gm.mm_per_pt = PT_TO_MM_PAPER * Decimal(title_den)
        gm.confidence = "LOW"
        gm.scale_basis = (f"title block 1:{title_den} on {_paper_name(W, H)} "
                          f"(unverified)")
    else:
        gm.scale_basis = "none"
    gm.basis = (", ".join(parts) + f"; not scale-verified: {why}; "
                + gm.scale_basis + f"; rotation {rot}.")
    return gm


def _assign_slots(ax_p, ax_s):
    """Which accepted axis is `letters` and which is `numbers`. A LETTER
    family is always letters, a NUMBER family always numbers; prefixed
    families (Y01 / X02) take the free slot, the X-running one as letters
    when both are prefixed, so the bay name reads column/row."""
    axes = [a for a in (ax_p, ax_s) if a]
    letters = next((a for a in axes if a["family"] == "letters"), None)
    numbers = next((a for a in axes if a["family"] == "numbers"), None)
    rest = [a for a in axes if a is not letters and a is not numbers]
    if len(rest) == 2:                       # both prefixed; orientations differ
        letters = next(a for a in rest if a["orientation"] == "X")
        numbers = next(a for a in rest if a["orientation"] == "Y")
    elif len(rest) == 1:
        a = rest[0]
        if letters is None and numbers is None:
            if a["orientation"] == "X":
                letters = a
            else:
                numbers = a
        elif letters is None:
            letters = a
        else:
            numbers = a
    return letters, numbers


# ---------------------------------------------------------------- queries
def gridline_positions(gm: GridMap, page_axis: str) -> list:
    """The gridlines whose positions vary along `page_axis` ('X' | 'Y'):
    [(label, pos_pt)] sorted by position; [] when no axis runs that way."""
    out = []
    if gm.letters_axis == page_axis:
        out.extend(gm.letters)
    if gm.numbers_axis == page_axis:
        out.extend(gm.numbers)
    return sorted(out, key=lambda p: (p[1], p[0]))


def _label_at(pairs, orientation, x, y, W, H):
    if not pairs or orientation is None:
        return None
    coord = x if orientation == "X" else y
    page_hi = W if orientation == "X" else H
    positions = [p[1] for p in pairs]
    for (label, _), (lo, hi) in zip(pairs, _spans(positions, 0.0, page_hi)):
        if lo <= coord <= hi:
            return label
    return None


def bay_of(gm: GridMap, x, y) -> str | None:
    """'C/3' — the nearest letter gridline and the nearest number gridline
    (midpoint-to-midpoint spans, as the source's bay map). None when the map
    is NONE, when either axis is missing, or when the point lies beyond the
    outermost half-pitch."""
    if gm.status == "NONE" or not gm.letters or not gm.numbers:
        return None
    a = _label_at(gm.letters, gm.letters_axis, float(x), float(y), gm.W, gm.H)
    b = _label_at(gm.numbers, gm.numbers_axis, float(x), float(y), gm.W, gm.H)
    if a is None or b is None:
        return None
    return f"{a}/{b}"


def verified(gm: GridMap) -> bool:
    return gm.status == "CALIBRATED"


# ---------------------------------------------------------------- from the set
# A plan often states no dimension chain of its own - the architect dimensions
# the grid once, on the setting-out plan or the structural sheets, and every
# floor plan shows the same bubbles undimensioned. Such a sheet is PARTIAL here
# (title-block scale only, which a plot "scale to fit" makes wrong by several
# per cent), and nothing may be measured from it. But the grid IS the same
# grid: the bay between bubbles C and D is the same length on every sheet that
# shows both. So a PARTIAL sheet is calibrated from a CALIBRATED sheet of the
# set when enough of its bays, matched label to label, give one scale.
SET_MIN_BAYS = 3          # fewest matched bays that may carry a scale
SET_TOLERANCE = 0.02      # the bays agree within 2% of their median
SET_MIN_SHARE = 2 / 3     # and are two thirds of the bays compared
SET_TITLE_LIMIT = 0.15    # a result further than this from the title-block scale is refused
SET_MIN_BAY_PT = 20.0     # bays shorter than this on the sheet are too short to read


READ_TOLERANCE = 0.01     # a transcribed bay must agree with the sheet's geometry within 1%


def _positions(gm) -> dict:
    """label -> position (pt) along its own axis, both axes."""
    return {**dict(gm.numbers), **dict(gm.letters)}


def calibrate_from_reading(gm, reading: dict, how: str):
    """(GridMap | None, table, dropped). The sheet's grid dimensions as a
    reading copied them, checked bay by bay against the sheet's OWN bubble
    positions: each bay gives mm per point; the bays within 1% of their median
    carry the scale, and the rest are dropped with the reason. The kept bays
    are the set's grid table - (label, label) -> mm - for the other plans."""
    pos = _positions(gm)
    bays = []
    for key in ("x_bays", "y_bays"):
        for b in reading.get(key) or []:
            a, c, mm = str(b["from"]).strip(), str(b["to"]).strip(), float(b["mm"])
            if a in pos and c in pos and abs(pos[c] - pos[a]) >= SET_MIN_BAY_PT and mm > 0:
                bays.append((a, c, mm, mm / abs(pos[c] - pos[a])))
    if len(bays) < SET_MIN_BAYS:
        return None, {}, [f"only {len(bays)} transcribed bay(s) match bubbles on the sheet"]
    med = _median([r for *_x, r in bays])
    keep = [b for b in bays if abs(b[3] - med) <= READ_TOLERANCE * med]
    dropped = [f"{a}-{c} read {mm:.0f} mm, the drawing gives {mm / r * med:.0f} mm - not used"
               for a, c, mm, r in bays if abs(r - med) > READ_TOLERANCE * med]
    if len(keep) < SET_MIN_BAYS or len(keep) < SET_MIN_SHARE * len(bays):
        return None, {}, dropped + [f"{len(keep)} of {len(bays)} bays agree - no scale settled"]
    value = _median([b[3] for b in keep])
    spread = max(abs(b[3] - value) / value for b in keep)
    implied = value / float(PT_TO_MM_PAPER)
    new = GridMap(**{**gm.__dict__})
    new.status, new.confidence = "CALIBRATED", "MED"
    new.mm_per_pt = Decimal(repr(float(value)))
    new.chain = [int(b[2]) for b in keep]
    new.scale_basis = (f"grid dimensions transcribed ({how}): {len(keep)} of {len(bays)} bays "
                       f"agree with the sheet's own bubbles within {spread * 100:.1f}%")
    new.basis = (gm.basis.split("; not scale-verified")[0] + f"; {new.scale_basis}; "
                 f"{value:.4f} mm/pt = 1:{implied:.0f}; rotation {gm.rotation}.")
    return new, {(a, c): mm for a, c, mm, _r in keep}, dropped


def calibrate_from_table(grids: dict, table: dict, source: str) -> dict:
    """doc_id -> GridMap for each uncalibrated sheet whose bubbles match the
    set's grid table (label pair -> stated mm) closely enough: at least
    SET_MIN_BAYS bays within SET_TOLERANCE, and two thirds of those compared."""
    out = {}
    for doc_id, gm in sorted(grids.items()):
        if gm.status == "CALIBRATED" or not (gm.letters or gm.numbers):
            continue
        pos = _positions(gm)
        ratios, used = [], []
        for (a, c), mm in sorted(table.items()):
            if a in pos and c in pos and abs(pos[c] - pos[a]) >= SET_MIN_BAY_PT:
                ratios.append(mm / abs(pos[c] - pos[a]))
                used.append(f"{a}-{c}")
        if len(ratios) < SET_MIN_BAYS:
            continue
        med = _median(ratios)
        agree = [r for r in ratios if abs(r - med) <= SET_TOLERANCE * med]
        if len(agree) < SET_MIN_BAYS or len(agree) < SET_MIN_SHARE * len(ratios):
            continue
        value = _median(agree)
        implied = value / float(PT_TO_MM_PAPER)
        m = re.search(r"title block 1:(\d+)", gm.scale_basis or "")
        if m and abs(implied / int(m.group(1)) - 1.0) > SET_TITLE_LIMIT:
            continue
        spread = max(abs(r - value) / value for r in agree)
        new = GridMap(**{**gm.__dict__})
        new.status, new.confidence = "CALIBRATED", "MED"
        new.mm_per_pt = Decimal(repr(float(value)))
        new.scale_basis = (f"the set's grid table ({source}): {len(agree)} of {len(ratios)} "
                           f"bays agree within {spread * 100:.1f}%")
        new.basis = (gm.basis.split("; not scale-verified")[0] + f"; {new.scale_basis} "
                     f"({', '.join(used[:8])}{' ...' if len(used) > 8 else ''}); "
                     f"{value:.4f} mm/pt = 1:{implied:.0f}; rotation {gm.rotation}.")
        out[doc_id] = new
    return out


def _bays(labels) -> list[tuple[str, str, float]]:
    """Consecutive (label, label, distance in pt) along one axis, in position order."""
    ordered = sorted(labels, key=lambda p: (p[1], p[0]))
    return [(a, b, abs(pb - pa)) for (a, pa), (b, pb) in zip(ordered, ordered[1:])]


def calibrate_from_set(grids: dict) -> dict:
    """doc_id -> GridMap for every PARTIAL or NONE sheet that the set's grid
    calibrates; the calibrated sheets are left as they are. Deterministic:
    donors are tried in doc_id order and the one with the most agreeing bays
    wins, then the tighter spread, then the doc_id."""
    donors = sorted((g for g in grids.values()
                     if g.status == "CALIBRATED" and g.mm_per_pt), key=lambda g: g.doc_id)
    out = {}
    for doc_id, gm in sorted(grids.items()):
        if gm.status == "CALIBRATED" or not (gm.letters or gm.numbers):
            continue
        best = None
        for donor in donors:
            if donor.doc_id == doc_id:
                continue
            ratios, used = [], []
            for axis in ("letters", "numbers"):
                theirs = dict(getattr(donor, axis))
                mine = [p for p in getattr(gm, axis) if p[0] in theirs]
                for a, b, d_pt in _bays(mine):
                    if d_pt < SET_MIN_BAY_PT:
                        continue
                    d_mm = abs(theirs[b] - theirs[a]) * float(donor.mm_per_pt)
                    ratios.append(d_mm / d_pt)
                    used.append(f"{a}-{b}")
            if len(ratios) < SET_MIN_BAYS:
                continue
            med = _median(ratios)
            agree = [r for r in ratios if abs(r - med) <= SET_TOLERANCE * med]
            if len(agree) < SET_MIN_BAYS or len(agree) < SET_MIN_SHARE * len(ratios):
                continue
            value = _median(agree)
            spread = max(abs(r - value) / value for r in agree)
            key = (-len(agree), spread, donor.doc_id)
            if best is None or key < best[0]:
                best = (key, donor, value, len(agree), len(ratios), spread, used)
        if best is None:
            continue
        _key, donor, value, n_agree, n_pairs, spread, used = best
        title = None
        m = re.search(r"title block 1:(\d+)", gm.scale_basis or "")
        if m:
            title = int(m.group(1))
        implied = float(value) / float(PT_TO_MM_PAPER)
        if title and abs(implied / title - 1.0) > SET_TITLE_LIMIT:
            continue                      # the grid and the sheet's own scale disagree: not settled here
        new = GridMap(**{**gm.__dict__})
        new.status = "CALIBRATED"
        new.mm_per_pt = Decimal(repr(float(value)))
        new.confidence = "MED"
        new.scale_basis = (f"the set's grid: {n_agree} of {n_pairs} bays agree within "
                           f"{spread * 100:.1f}% with {donor.doc_id}, calibrated by its own "
                           f"dimension chain")
        new.basis = (gm.basis.split("; not scale-verified")[0]
                     + f"; scale from the grid of {donor.doc_id} ({', '.join(used[:8])}"
                     + (" ..." if len(used) > 8 else "")
                     + f"): {float(new.mm_per_pt):.4f} mm/pt = 1:{implied:.0f}"
                     + (f"; title block 1:{title} agrees" if title else "")
                     + f"; rotation {gm.rotation}.")
        out[doc_id] = new
    return out


def page_size_and_rotation(pdf_path, page=0) -> tuple[float, float, int]:
    """(W, H, rotation) of the displayed, upright page — page.rect in pymupdf
    already has /Rotate applied, which is the space readers.extract asserts
    containment in. Read-only; the document is closed before returning."""
    try:
        import pymupdf
    except ImportError:                                   # pragma: no cover
        import fitz as pymupdf
    doc = pymupdf.open(str(Path(pdf_path)))
    try:
        pg = doc[page]
        return float(pg.rect.width), float(pg.rect.height), int(pg.rotation) % 360
    finally:
        doc.close()
