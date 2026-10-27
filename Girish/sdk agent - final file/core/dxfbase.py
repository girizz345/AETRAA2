"""
AETRAA Core - reusable DXF/CAD vector reader (ezdxf).

Real vector-geometry measurement for every AETRAA module: linear runs by
layer (LINE / LWPOLYLINE / POLYLINE / ARC / SPLINE), block counts (INSERT),
text items and closed areas, all converted to METRES via the drawing header
units. Damaged files are recovered where possible and NEVER crash a run -
open_dxf() returns None and summarize() returns a flagged, empty summary.

Honesty contract (R-NO-HALLUCINATION): every figure returned here is
computed from entity geometry; nothing is factored or filled in. Where the
reader had to approximate (spline chord measure, unknown units, partial
read of an over-dense file) a flag string is added to the result so the
caller can disclose it.
"""

import math
from pathlib import Path

# Entities above this count trigger a bounded partial read (flagged).
MAX_ENTITIES = 500_000

# Cap on text items retained by text_items()/summarize().
MAX_TEXTS = 1000

# $INSUNITS -> factor to metres (only the codes we trust).
UNIT_FACTORS = {1: 0.0254, 2: 0.3048, 4: 0.001, 5: 0.01, 6: 1.0}
UNIT_NAMES = {1: 'in', 2: 'ft', 4: 'mm', 5: 'cm', 6: 'm'}

FLAG_UNITS_ASSUMED = 'units assumed mm - verify'
FLAG_SPLINE = ('spline lengths taken along control-point polylines '
               '(chord measure)')
FLAG_DENSE = 'file too dense - partial read'


# ---------------------------------------------------------------- opening

def open_dxf(path):
    """ezdxf.readfile with ezdxf.recover fallback for damaged files.
    Returns the document, or None on failure (never raises)."""
    try:
        import ezdxf
        from ezdxf import recover
    except ImportError:
        return None
    path = str(path)
    try:
        return ezdxf.readfile(path)
    except Exception:
        pass
    try:
        doc, _auditor = recover.readfile(path)
        return doc
    except Exception:
        return None


def detect_units(doc):
    """(factor_to_metres, unit_name, flags) from $INSUNITS with a
    $MEASUREMENT fallback. Unknown -> mm, flagged."""
    flags = []
    try:
        ins = int(doc.header.get('$INSUNITS', 0))
    except Exception:
        ins = 0
    if ins in UNIT_FACTORS:
        return UNIT_FACTORS[ins], UNIT_NAMES[ins], flags
    try:
        meas = int(doc.header.get('$MEASUREMENT', -1))
    except Exception:
        meas = -1
    if meas == 0:  # imperial drawing without a declared insert unit
        flags.append('units taken as inches from $MEASUREMENT=0 (imperial) '
                     '- verify')
        return UNIT_FACTORS[1], 'in', flags
    flags.append(FLAG_UNITS_ASSUMED)
    return UNIT_FACTORS[4], 'mm', flags


# ---------------------------------------------------------------- geometry

def _dist(a, b):
    return math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2
                     + ((a[2] - b[2]) ** 2 if len(a) > 2 and len(b) > 2
                        else 0.0))


def _bulge_len(p1, p2, bulge):
    """Arc length of a polyline segment carrying a bulge; chord if b=0."""
    c = _dist(p1, p2)
    if not bulge or c < 1e-12:
        return c
    theta = 4.0 * math.atan(abs(bulge))
    s = math.sin(theta / 2.0)
    return c if s < 1e-12 else theta * c / (2.0 * s)


def _seg_key(p1, p2):
    a = (round(p1[0], 4), round(p1[1], 4))
    b = (round(p2[0], 4), round(p2[1], 4))
    return (a, b) if a <= b else (b, a)


def linear_by_layer(doc, flags=None, limit=MAX_ENTITIES):
    """{layer: {'length_m': total, 'segments': n}} over modelspace LINE,
    LWPOLYLINE, POLYLINE, ARC (arc length) and SPLINE (control-point
    polyline, flagged). Zero-length and exact duplicate start/end straight
    segments are skipped."""
    factor, _u, _f = detect_units(doc)
    out = {}
    seen = set()
    spline_flagged = False
    n_ent = 0

    def add(layer, length, p1=None, p2=None):
        if length * factor < 1e-6:
            return
        if p1 is not None:
            key = (layer, _seg_key(p1, p2))
            if key in seen:
                return
            seen.add(key)
        e = out.setdefault(layer, {'length_m': 0.0, 'segments': 0})
        e['length_m'] += float(length) * factor
        e['segments'] += 1

    for ent in doc.modelspace():
        n_ent += 1
        if n_ent > limit:
            if flags is not None and FLAG_DENSE not in flags:
                flags.append(FLAG_DENSE)
            break
        try:
            kind = ent.dxftype()
            layer = ent.dxf.layer
            if kind == 'LINE':
                p1 = tuple(ent.dxf.start)
                p2 = tuple(ent.dxf.end)
                add(layer, _dist(p1, p2), p1, p2)
            elif kind == 'LWPOLYLINE':
                pts = list(ent.get_points('xyb'))  # (x, y, bulge)
                if ent.closed and len(pts) > 2:
                    pts = pts + [pts[0]]
                for a, b in zip(pts, pts[1:]):
                    p1, p2 = (a[0], a[1]), (b[0], b[1])
                    if a[2]:
                        add(layer, _bulge_len(p1, p2, a[2]))
                    else:
                        add(layer, _dist(p1, p2), p1, p2)
            elif kind == 'POLYLINE':
                verts = [v for v in ent.vertices]
                pts = [tuple(v.dxf.location) for v in verts]
                bulges = [getattr(v.dxf, 'bulge', 0.0) for v in verts]
                if ent.is_closed and len(pts) > 2:
                    pts = pts + [pts[0]]
                    bulges = bulges + [0.0]
                for i in range(len(pts) - 1):
                    if bulges[i]:
                        add(layer, _bulge_len(pts[i], pts[i + 1], bulges[i]))
                    else:
                        add(layer, _dist(pts[i], pts[i + 1]),
                            pts[i], pts[i + 1])
            elif kind == 'ARC':
                sweep = (ent.dxf.end_angle - ent.dxf.start_angle) % 360.0
                if sweep == 0.0:
                    sweep = 360.0
                add(layer, ent.dxf.radius * math.radians(sweep))
            elif kind == 'SPLINE':
                cps = [tuple(p) for p in ent.control_points]
                length = sum(_dist(a, b) for a, b in zip(cps, cps[1:]))
                if length > 0:
                    add(layer, length)
                    if not spline_flagged and flags is not None:
                        flags.append(FLAG_SPLINE)
                        spline_flagged = True
        except Exception:
            continue  # one bad entity never kills the read
    for e in out.values():
        e['length_m'] = round(e['length_m'], 3)
    return out


# ---------------------------------------------------------------- blocks

def _is_xref(doc, name):
    try:
        blk = doc.blocks.get(name)
        return bool(blk is not None and blk.block.dxf.flags & 0x0C)  # xref
    except Exception:
        return False


def _effective_block_name(doc, name):
    """Dynamic-block anonymous *U inserts counted by their effective
    (dynamic block definition) name where resolvable."""
    if not name.upper().startswith('*U'):
        return name
    try:
        brec = doc.block_records.get(name)
        if not brec.has_extension_dict:
            return name
        xdict = brec.get_extension_dict()
        rep = xdict.get('AcDbBlockRepresentation')
        if rep is None:
            return name
        repdata = rep.get('AcDbRepData') if hasattr(rep, 'get') else None
        if repdata is None:
            return name
        for tag in getattr(repdata, 'tags', []):
            if tag.code == 340:
                target = doc.entitydb.get(tag.value)
                dyn = getattr(getattr(target, 'dxf', None), 'name', None)
                if dyn:
                    return dyn
    except Exception:
        pass
    return name


def block_counts(doc, limit=MAX_ENTITIES, flags=None):
    """{block_name: {'count': n, 'layers': {layer: n}}} from modelspace
    INSERT entities. Xref inserts and anonymous *X blocks are skipped;
    *U dynamic blocks are counted by their effective name."""
    out = {}
    n_ent = 0
    for ins in doc.modelspace().query('INSERT'):
        n_ent += 1
        if n_ent > limit:
            if flags is not None and FLAG_DENSE not in flags:
                flags.append(FLAG_DENSE)
            break
        try:
            raw = ins.dxf.name
            name = _effective_block_name(doc, raw)
            if name.startswith('*'):
                continue  # anonymous (non-resolvable) block
            if _is_xref(doc, raw):
                continue
            e = out.setdefault(name, {'count': 0, 'layers': {}})
            e['count'] += 1
            lay = ins.dxf.layer
            e['layers'][lay] = e['layers'].get(lay, 0) + 1
        except Exception:
            continue
    return out


# ---------------------------------------------------------------- text

def text_items(doc, limit=MAX_ENTITIES):
    """[(text, layer, (x, y))] from modelspace TEXT / MTEXT."""
    out = []
    n_ent = 0
    for ent in doc.modelspace().query('TEXT MTEXT'):
        n_ent += 1
        if n_ent > limit or len(out) >= MAX_TEXTS:
            break
        try:
            if ent.dxftype() == 'MTEXT':
                txt = ent.plain_text()
            else:
                txt = ent.dxf.text
            txt = (txt or '').strip()
            if not txt:
                continue
            ins = ent.dxf.insert
            out.append((txt, ent.dxf.layer,
                        (round(ins[0], 2), round(ins[1], 2))))
        except Exception:
            continue
    return out


# ---------------------------------------------------------------- areas

def _shoelace(pts):
    n = len(pts)
    if n < 3:
        return 0.0
    s = 0.0
    for i in range(n):
        x1, y1 = pts[i][0], pts[i][1]
        x2, y2 = pts[(i + 1) % n][0], pts[(i + 1) % n][1]
        s += x1 * y2 - x2 * y1
    return float(abs(s)) / 2.0  # plain float (ezdxf may hand back numpy)


def areas_by_layer(doc, limit=MAX_ENTITIES, flags=None):
    """{layer: {'area_m2': total, 'shapes': n}} from closed LWPOLYLINE
    and HATCH (polyline-path) entities in modelspace."""
    factor, _u, _f = detect_units(doc)
    f2 = factor * factor
    out = {}
    n_ent = 0

    def add(layer, area):
        if area * f2 < 1e-9:
            return
        e = out.setdefault(layer, {'area_m2': 0.0, 'shapes': 0})
        e['area_m2'] += float(area) * f2
        e['shapes'] += 1

    for ent in doc.modelspace().query('LWPOLYLINE HATCH'):
        n_ent += 1
        if n_ent > limit:
            if flags is not None and FLAG_DENSE not in flags:
                flags.append(FLAG_DENSE)
            break
        try:
            if ent.dxftype() == 'LWPOLYLINE':
                if not ent.closed:
                    continue
                pts = [(p[0], p[1]) for p in ent.get_points('xy')]
                add(ent.dxf.layer, _shoelace(pts))
            else:  # HATCH - external polyline paths only
                for path in ent.paths:
                    external = bool(getattr(path, 'path_type_flags', 1) & 1)
                    if not external:
                        continue
                    verts = getattr(path, 'vertices', None)
                    if verts is None:
                        if flags is not None:
                            note = ('hatch with edge-path boundary skipped '
                                    '(area not derivable as a polygon)')
                            if note not in flags:
                                flags.append(note)
                        continue
                    pts = [(v[0], v[1]) for v in verts]
                    add(ent.dxf.layer, _shoelace(pts))
        except Exception:
            continue
    for e in out.values():
        e['area_m2'] = round(e['area_m2'], 4)
    return out


# ---------------------------------------------------------------- summary

def summarize(path):
    """One bounded call returning everything a module needs:
    {'file', 'ok', 'units', 'unit_factor', 'entities', 'flags',
     'linear', 'blocks', 'areas', 'texts'}."""
    path = Path(path)
    result = {'file': str(path), 'ok': False, 'units': None,
              'unit_factor': None, 'entities': 0, 'flags': [],
              'linear': {}, 'blocks': {}, 'areas': {}, 'texts': []}
    doc = open_dxf(path)
    if doc is None:
        result['flags'].append('file could not be read (corrupt or not a '
                               'DXF) - skipped')
        return result
    try:
        factor, unit_name, uflags = detect_units(doc)
        result['units'] = unit_name
        result['unit_factor'] = factor
        result['flags'].extend(uflags)
        try:
            n = len(doc.modelspace())
        except Exception:
            n = 0
        result['entities'] = n
        limit = MAX_ENTITIES
        if n > MAX_ENTITIES:
            result['flags'].append(FLAG_DENSE)
        result['linear'] = linear_by_layer(doc, flags=result['flags'],
                                           limit=limit)
        result['blocks'] = block_counts(doc, limit=limit,
                                        flags=result['flags'])
        result['areas'] = areas_by_layer(doc, limit=limit,
                                         flags=result['flags'])
        result['texts'] = text_items(doc, limit=limit)
        result['ok'] = True
    except Exception as e:
        result['flags'].append(f'read failed part-way: {e}')
    # de-duplicate flags, preserving order
    seen = set()
    result['flags'] = [f for f in result['flags']
                       if not (f in seen or seen.add(f))]
    return result
