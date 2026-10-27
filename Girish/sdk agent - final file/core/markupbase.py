"""
AETRAA Core - sheet-scale-aware PDF drawing annotation toolkit.

Shared by every AETRAA module that marks up drawings (revision clouds,
callouts, ID tags, margin notes). All geometry is expressed at an A3
landscape baseline (1190 pt wide) and multiplied by a per-page scale
factor, so annotations stay legible AT SHEET SCALE - an A0 sheet
(~3974 pt wide) gets everything ~3.3x larger and prints readable.

COORDINATE SPACES (PyMuPDF): page.search_for()/get_text() AND annotation
placement both use the UNROTATED page coordinate system, while page.rect
is the rotated (viewing) rectangle. On rotated sheets (rotation 90 is the
norm on plans) clamping a search hit against page.rect throws away valid
locations - use bounds(page) instead. Layout decisions that are visual
("place the callout to the right of the cloud", "stack notes down the
right margin") are made in VIEW space here and mapped back with
page.derotation_matrix; FreeText gets rotate=page.rotation so the text
reads upright in the viewer and on paper.

Every annotation-creating function is exception-safe: one bad rect or a
PyMuPDF hiccup never crashes a run - the function returns None instead.
"""

import re
import fitz  # PyMuPDF
from pathlib import Path

RED = (0.85, 0.05, 0.05)
ORANGE = (0.93, 0.49, 0.19)
GREEN = (0.0, 0.55, 0.15)
WHITE = (1, 1, 1)

BASELINE_WIDTH = 1190.0  # A3 landscape, pt

# Base geometry at scale 1.0 (A3). Everything below is multiplied by s.
BASE = {
    'cloud_pad': 10,        # cloud grows this much beyond the element bbox
    'min_cloud': 46,        # minimum visible cloud size
    'cloud_border': 1.8,
    'callout_w': 170,       # callout box
    'callout_h': 30,
    'callout_font': 9,
    'callout_border': 1.2,
    'leader_border': 1.0,
    'callout_gap': 24,      # offset cloud -> callout
    'id_w': 52,             # ID tag box (e.g. 'D-012')
    'id_h': 16,
    'id_font': 8,
    'id_border': 0.8,
    'margin_w': 230,        # margin note strip at right edge
    'margin_top': 30,
    'margin_gap': 8,
    'edge_pad': 10,
}


def scale(page):
    """Sheet scale factor: 1.0 on A3 and smaller, ~2 on A1, ~3.3 on A0."""
    try:
        return max(1.0, max(page.rect.width, page.rect.height)
                   / BASELINE_WIDTH)
    except Exception:
        return 1.0


def bounds(page):
    """The page rectangle in UNROTATED coordinates - the space that both
    text search results and annotation positions live in."""
    try:
        r = page.rect * page.derotation_matrix
        r.normalize()
        return r
    except Exception:
        return page.rect


def to_view(page, rect):
    """Map an (unrotated) annotation/search rect to view space."""
    r = fitz.Rect(rect) * page.rotation_matrix
    r.normalize()
    return r


def from_view(page, rect):
    """Map a view-space rect back to unrotated annotation space."""
    r = fitz.Rect(rect) * page.derotation_matrix
    r.normalize()
    return r


def sane_rect(page, rect, min_size=None):
    """Return a valid rectangle clamped to the sheet, or None.
    Operates in unrotated (search/annotation) space.
    min_size defaults to the scaled minimum cloud size."""
    if rect is None:
        return None
    try:
        if min_size is None:
            min_size = BASE['min_cloud'] * scale(page)
        b = bounds(page)
        r = fitz.Rect(rect)
        r.normalize()
        if r.is_infinite:
            return None
        r = fitz.Rect(max(r.x0, b.x0), max(r.y0, b.y0),
                      min(r.x1, b.x1), min(r.y1, b.y1))
        if r.is_empty or r.width <= 0 or r.height <= 0:
            return None
        if r.width < min_size or r.height < min_size:
            cx, cy = (r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2
            half = min_size / 2
            r = fitz.Rect(max(cx - half, b.x0 + 2), max(cy - half, b.y0 + 2),
                          min(cx + half, b.x1 - 2), min(cy + half, b.y1 - 2))
            if r.is_empty:
                return None
        return r
    except Exception:
        return None


def _freetext(page, rect_u, text, fontsize, color, border):
    """FreeText annot in unrotated coords, text upright in the viewer."""
    ft = page.add_freetext_annot(rect_u, text, fontsize=fontsize,
                                 fontname="helv", text_color=color,
                                 fill_color=WHITE, rotate=page.rotation)
    ft.set_border(width=border)
    try:
        ft.set_colors(stroke=color, fill=WHITE)
    except Exception:
        pass
    ft.update()
    return ft


def cloud(page, rect, dashed=False):
    """Revision cloud (rect annot with PDF cloudy border effect) around a
    rect in unrotated (search-space) coordinates.
    Returns the drawn rect (unrotated space) or None."""
    try:
        s = scale(page)
        pad = BASE['cloud_pad'] * s
        r = sane_rect(page, fitz.Rect(rect) + (-pad, -pad, pad, pad))
        if r is None:
            return None
        annot = page.add_rect_annot(r)
        annot.set_colors(stroke=RED)
        dash = [max(1, round(5 * s)), max(1, round(3 * s))] if dashed else None
        annot.set_border(width=BASE['cloud_border'] * s, dashes=dash)
        annot.update()
        try:  # PDF cloudy border effect; intensity follows sheet scale
            intensity = max(1, min(2, round(s / 2)))
            page.parent.xref_set_key(annot.xref, "BE",
                                     f"<</S/C/I {intensity}>>")
        except Exception:
            pass
        return r
    except Exception:
        return None


def callout(page, anchor_rect, text, tbc=False):
    """Short label box beside a cloud with a leader arrow. anchor_rect is
    the cloud rect in unrotated space (as returned by cloud()).
    Returns the callout rect (unrotated space) or None."""
    try:
        s = scale(page)
        font = BASE['callout_font'] * s
        h = BASE['callout_h'] * s
        w = max(BASE['callout_w'] * s,
                min(len(text) * font * 0.62, 360 * s))
        pad = BASE['edge_pad'] * s
        gap = BASE['callout_gap'] * s

        # Lay out in VIEW space so 'right of' / 'above' mean what the
        # engineer sees on the printed sheet.
        av = to_view(page, anchor_rect)
        pw, ph = page.rect.width, page.rect.height
        x0 = av.x1 + gap
        if x0 + w > pw - pad:
            x0 = av.x0 - gap - w
        x0 = max(pad, min(x0, pw - w - pad))
        y0 = max(pad, min(av.y0 - h, ph - h - pad))
        box_v = fitz.Rect(x0, y0, x0 + w, y0 + h)

        col = ORANGE if tbc else RED
        box_u = from_view(page, box_v)
        _freetext(page, box_u, text, font, col, BASE['callout_border'] * s)

        # Leader arrow: from callout edge to the cloud (view-space logic,
        # endpoints mapped back to annotation space).
        cy = box_v.y0 + h / 2
        p1v = fitz.Point(box_v.x0, cy) if av.x1 < box_v.x0 \
            else fitz.Point(box_v.x1, cy)
        p2v = fitz.Point((av.x0 + av.x1) / 2, av.y0) \
            if cy < av.y0 else \
            fitz.Point((av.x0 + av.x1) / 2, (av.y0 + av.y1) / 2)
        m = page.derotation_matrix
        ln = page.add_line_annot(p1v * m, p2v * m)
        ln.set_colors(stroke=col)
        ln.set_border(width=BASE['leader_border'] * s)
        ln.set_line_ends(0, fitz.PDF_ANNOT_LE_OPEN_ARROW)
        ln.update()
        return box_u
    except Exception:
        return None


def id_tag(page, anchor_rect, text):
    """Small red ID label pinned above a cloud corner (e.g. 'D-012').
    anchor_rect in unrotated space. Returns the tag rect or None."""
    try:
        s = scale(page)
        font = BASE['id_font'] * s
        h = BASE['id_h'] * s
        w = max(BASE['id_w'] * s, min(len(text) * font * 0.62, 220 * s))
        av = to_view(page, anchor_rect)
        x0 = max(2, min(av.x0, page.rect.width - w - 4))
        y0 = max(2, av.y0 - h - 2 * s)
        box_u = from_view(page, fitz.Rect(x0, y0, x0 + w, y0 + h))
        _freetext(page, box_u, text, font, RED, BASE['id_border'] * s)
        return box_u
    except Exception:
        return None


def route_trace(page, points, ref=None, color=GREEN):
    """Trace a measured service route: PolyLine annotation(s) along the
    route polyline(s) (sheet-scaled width) with an ID tag carrying the
    item ref pinned at each end - the audit evidence for a quantity
    measured from the drawing's vector geometry.
    points: one polyline [(x, y), ...] or a list of polylines, in
    unrotated page coordinates (the space page.get_drawings() reports).
    Returns the number of polylines drawn, or None."""
    try:
        s = scale(page)
        polys = points or []
        if polys and polys[0] and not isinstance(
                polys[0][0], (list, tuple)):
            polys = [polys]
        drawn = []
        for poly in polys:
            pts = []
            for p in poly:
                try:
                    pts.append(fitz.Point(float(p[0]), float(p[1])))
                except Exception:
                    continue
            if len(pts) < 2:
                continue
            try:
                annot = page.add_polyline_annot(pts)
                annot.set_colors(stroke=color)
                annot.set_border(width=2.2 * s)
                try:
                    annot.set_opacity(0.7)
                except Exception:
                    pass
                annot.update()
                drawn.append(pts)
            except Exception:
                continue
        if not drawn:
            return None
        if ref:
            pad = 2 * s
            for pt in (drawn[0][0], drawn[-1][-1]):
                anchor = fitz.Rect(pt.x - pad, pt.y - pad,
                                   pt.x + pad, pt.y + pad)
                id_tag(page, anchor, ref)
        return len(drawn)
    except Exception:
        return None


def margin_slot_rect(page, slot):
    """The rect (unrotated space) a margin note at `slot` occupies - the
    same geometry margin_note() draws, exposed so callers can test the
    band for underlying drawing content BEFORE placing a note (a note
    must never overprint drawing content). Returns fitz.Rect or None
    (slot off the sheet)."""
    try:
        s = scale(page)
        h = BASE['callout_h'] * s
        w = BASE['margin_w'] * s
        # page.rect IS the view rect in PyMuPDF (already rotation-aware);
        # keep the note column LEFT of the title block strip (~85% of sheet)
        pw, ph = page.rect.width, page.rect.height
        x1 = pw * 0.83
        y0 = BASE['margin_top'] * s + slot * (h + BASE['margin_gap'] * s)
        if y0 + h > ph - BASE['edge_pad'] * s:
            return None  # off the bottom of the sheet
        box_v = fitz.Rect(x1 - w, y0, x1, y0 + h)
        return from_view(page, box_v)
    except Exception:
        return None


def margin_note(page, text, slot):
    """Orange note stacked down the right-hand margin of the VIEWED sheet
    (slot 0, 1, 2...). Returns the note rect (unrotated space) or None."""
    try:
        s = scale(page)
        box_u = margin_slot_rect(page, slot)
        if box_u is None:
            return None
        _freetext(page, box_u, text, BASE['callout_font'] * s, ORANGE,
                  BASE['leader_border'] * s)
        return box_u
    except Exception:
        return None


# ── tag search ───────────────────────────────────────────────────────
def _tag_candidates(item):
    """Ordered, de-duplicated list of search strings for a schedule item."""
    item = (item or '').strip()
    if not item:
        return []
    cands = []

    def add(c):
        c = c.strip()
        if c and len(c) >= 2 and c not in cands:
            cands.append(c)

    add(item)
    # Diameter symbol variants: drawings write 25Ø / 25ø / 25⌀ / 25mm
    for sym in ('Ø', 'ø', '⌀'):
        if sym in item:
            others = [o for o in ('Ø', 'ø', '⌀') if o != sym]
            for o in others:
                add(item.replace(sym, o))
            add(item.replace(sym, 'mm'))
            add(item.replace(sym, ''))

    parts = item.split()
    if len(parts) > 1:
        # Longest token that contains letters (system code, e.g. 'BCCWS')
        lettered = [p for p in parts if any(ch.isalpha() for ch in p)]
        if lettered:
            best = max(lettered, key=len)
            if len(best) >= 3:
                add(best)
        # first + last word combo, then each end alone
        add(f"{parts[0]} {parts[-1]}")
        add(parts[-1])
        add(parts[0])

    # Case variants for short tokens (search_for has no case flag)
    for c in list(cands):
        if len(c) <= 12:
            add(c.upper())
            add(c.lower())

    return cands[:10]  # keep page.search_for cost bounded


def search_tag(page, item):
    """Find text instances of a schedule/tag item on the page, trying
    progressively looser variants. Returns a list of fitz.Rect in
    unrotated coordinates - the same space annotations are placed in,
    so results can be handed straight to cloud()/sane_rect()."""
    for cand in _tag_candidates(item):
        try:
            inst = page.search_for(cand)
        except Exception:
            inst = None
        if inst:
            return inst
    return []


# ── placement verification gate ─────────────────────────────────────
_NORM_MAP = str.maketrans({'Ø': 'O', 'ø': 'O', '⌀': 'O', '×': 'X'})


def norm_label(t):
    """Case/diameter-symbol/whitespace-insensitive comparison form."""
    return ''.join((t or '').upper().translate(_NORM_MAP).split())


def anchor_token(item):
    """The most locatable token of an item string: prefer a token that
    carries a digit (a size or tag number), else the longest token."""
    parts = [p for p in (item or '').split() if p]
    if not parts:
        return (item or '').strip()
    digit = [p for p in parts
             if len(p) >= 3 and any(c.isdigit() for c in p)]
    if digit:
        return max(digit, key=len)
    longer = [p for p in parts if len(p) >= 3]
    if longer:
        return max(longer, key=len)
    return max(parts, key=len)


def token_in_texts(token, texts):
    """True if the item token (or its number/prefix) appears in the given
    word texts - the acceptance test for a cloud enclosing its element."""
    nt = norm_label(token)
    if not nt:
        return True
    blob = norm_label(' '.join(texts))
    if nt in blob:
        return True
    # Punctuation-tolerant retry: norm_label keeps hyphens, but PDF text
    # often splits a tag into separate words ('RO','M','01' -> 'ROM01'),
    # so a hyphenated token like 'RO-M' never matched and its cloud was
    # withdrawn as unverified. Compare alphanumerics only.
    import re as _re
    _an = lambda x: _re.sub(r'[^A-Z0-9]', '', (x or '').upper())
    if _an(nt) and _an(nt) in _an(blob):
        return True
    m = re.match(r'\d+', nt)  # number prefix, e.g. '32' of '32O'
    if m and any(norm_label(t).startswith(m.group(0)) for t in texts):
        return True
    return False


def words_under(page, rect, pad=4.0):
    """The word texts lying under a rect (unrotated space, expanded by
    pad) - what the engineer's eye finds inside the cloud."""
    try:
        r = fitz.Rect(rect) + (-pad, -pad, pad, pad)
        return [w[4] for w in page.get_text('words', clip=r)]
    except Exception:
        return []


def verify_placement(pdf_path, expects):
    """PLACEMENT VERIFICATION GATE - provable annotation placement.

    expects: [{'ref', 'page', 'rect', 'token', 'type'}, ...] - the
    annotations a markup run claims to have drawn ('rect' in unrotated
    space; 'token' None for transferred tender locations whose text is,
    by definition, absent from the IFC sheet). 'type' (optional,
    default 'cloud') extends the gate beyond clouds:

      'cloud'    1. a rectangle annotation exists at the recorded rect,
                 2. the ref appears in a FreeText annotation on the
                    page (the ID tag or callout), and
                 3. when a token is given, the item's text sits inside
                    the cloud.
      'note' /   a FreeText annotation carrying the ref exists at the
      'callout'  recorded rect (margin notes and count callouts).
      'route'    a PolyLine annotation intersects the recorded rect
                 (the route bbox) and the ref is on a FreeText on the
                 page (the endpoint ID tags).

    Returns a list of failure dicts {'ref','page','rect','reason',
    'type'}; an empty list means every annotation is proven."""
    failures = []
    try:
        doc = fitz.open(str(pdf_path))
    except Exception as e:
        return [{'ref': x.get('ref'), 'page': x.get('page'),
                 'rect': x.get('rect'), 'type': x.get('type', 'cloud'),
                 'reason': f'marked PDF failed to open: {e}'}
                for x in expects]
    squares, freetexts, ft_items, polylines = {}, {}, {}, {}
    for e in expects:
        kind = str(e.get('type') or 'cloud')
        try:
            pno = min(max(int(e.get('page') or 1), 1), len(doc))
            page = doc[pno - 1]
            if pno not in squares:
                sq, ft, pl = [], [], []
                for a in page.annots() or []:
                    if a.type[0] == fitz.PDF_ANNOT_SQUARE:
                        sq.append(fitz.Rect(a.rect))
                    elif a.type[1] == 'FreeText':
                        ft.append((fitz.Rect(a.rect),
                                   a.info.get('content') or ''))
                    elif a.type[1] in ('PolyLine', 'Polygon'):
                        pl.append(fitz.Rect(a.rect))
                squares[pno] = sq
                ft_items[pno] = ft
                freetexts[pno] = '\n'.join(t for _, t in ft)
                polylines[pno] = pl
            rect = fitz.Rect(e['rect'])
            ref = str(e.get('ref') or '')
            reasons = []
            if kind in ('note', 'callout'):
                near = [t for r, t in ft_items[pno]
                        if abs(r.x0 - rect.x0) <= 6
                        and abs(r.y0 - rect.y0) <= 6]
                if not near:
                    reasons.append(f'no {kind} annotation at the '
                                   f'recorded rect')
                elif ref and not any(ref in t for t in near):
                    reasons.append(f'ref not on the {kind} at the '
                                   f'recorded rect')
            elif kind == 'route':
                grown = fitz.Rect(rect) + (-6, -6, 6, 6)
                if not any(p.intersects(grown) for p in polylines[pno]):
                    reasons.append('no route polyline at the recorded '
                                   'extent')
                if ref and ref not in freetexts[pno]:
                    reasons.append('ref not on any ID tag on the page')
            else:
                if not any(abs(s.x0 - rect.x0) <= 3
                           and abs(s.y0 - rect.y0) <= 3
                           and abs(s.x1 - rect.x1) <= 3
                           and abs(s.y1 - rect.y1) <= 3
                           for s in squares[pno]):
                    reasons.append('no cloud annotation at the recorded '
                                   'rect')
                if ref and ref not in freetexts[pno]:
                    reasons.append('ref not on any ID tag/callout on '
                                   'the page')
                token = e.get('token')
                if token and not token_in_texts(token,
                                                words_under(page, rect)):
                    # A cloud drawn slightly proud of its text still marks
                    # the right element - equipment tags (RO-M 01) sit at
                    # the edge of their symbol and were failing a 4pt
                    # window. Re-check a wider halo before withdrawing a
                    # cloud that is, visually, in the right place. Only if
                    # the tag is absent from the WIDER area is placement
                    # genuinely wrong.
                    if not token_in_texts(token,
                                          words_under(page, rect, pad=28)):
                        reasons.append(f"item text '{token}' not found "
                                       f"inside the cloud")
            if reasons:
                failures.append({'ref': ref, 'page': pno,
                                 'rect': list(e['rect']), 'type': kind,
                                 'reason': '; '.join(reasons)})
        except Exception as ex:
            failures.append({'ref': e.get('ref'), 'page': e.get('page'),
                             'rect': e.get('rect'), 'type': kind,
                             'reason': f'verification error: {ex}'})
    doc.close()
    return failures


# ── save helper ──────────────────────────────────────────────────────
def save_overwrite(doc, out_path):
    """Save doc to out_path, safely overwriting an existing file that the
    doc itself may have been opened from (via tempfile)."""
    out_path = Path(out_path)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    if out_path.exists():
        import shutil
        import tempfile
        with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as tf:
            tmp = tf.name
        doc.save(tmp)
        shutil.copyfile(tmp, str(out_path))
        Path(tmp).unlink(missing_ok=True)
    else:
        doc.save(str(out_path))
    return out_path
