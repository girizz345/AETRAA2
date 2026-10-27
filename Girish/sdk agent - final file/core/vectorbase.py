"""
AETRAA Core - PDF vector run-length measurement toolkit.

Measures duct / pipe / service RUN LENGTHS from the vector geometry of a
drawing PDF (PyMuPDF page.get_drawings()) so linear take-off items can be
measured to the sheet scale instead of raised TO MEASURE - but ONLY where
the evidence supports it. This is QS-grade work: a WRONG quantity is far
worse than TO MEASURE, so every result carries a confidence gate and the
caller must never promote a 'low' confidence measurement.

Pipeline (all coordinates UNROTATED page space, the same space
page.get_text('words') and core.markupbase annotations live in):

  parse_scale(page)          -> the sheet's single stated ratio, or None
  service_paths(page)        -> coloured stroke segments (services), with
                                title-block strip and symbol noise removed
  chain_routes(segments)     -> connected route networks per stroke colour
                                (endpoint joins + collinear dash bridging)
  dedup_parallel(routes, g)  -> double-line duct handling: self-parallel
                                outlines halved to a centreline figure and
                                separate parallel twins merged; anything
                                ambiguous is flagged, never guessed
  label_routes(routes, lbls) -> size labels assigned to the nearest route;
                                simple multi-size routes split at label
                                midpoints; unlabeled routes ignored
  measure(page, size_labels) -> [{label, length_m, points, confidence,
                                  notes, ...}] with 'high' only when every
                                gate passes
"""

import math
import re
import time

MM_PER_PT = 0.352778

# Stroke colour saturation below this is grey/black linework, not a service.
SAT_MIN = 0.15
# Segments shorter than this (pt) are symbol fragments / hatching - dropped.
MIN_SEG_PT = 2.0
# Endpoints within this distance (pt) are joined (touching linework).
JOIN_TOL = 2.0
# Collinear segments with a gap up to this (pt) chain as one dashed run.
DASH_GAP = 8.0
ANGLE_TOL = math.radians(9.0)
# Label-to-route assignment: hard cut-off and the tighter high-confidence
# threshold (labels sit beside runs, usually on a short leader).
LABEL_NEAR_PT = 90.0
LABEL_TIGHT_PT = 70.0
# Plausible run lengths (m) - outside this a measurement is never 'high'.
LEN_MIN_M, LEN_MAX_M = 0.5, 500.0
# View-space fraction of the sheet width beyond which geometry is treated
# as title block / legend (same convention as the POMI engine).
EDGE_FRACTION = 0.88
# A colour carrying more stroke segments than this on one page is
# background linework (landscaping textures etc.), not a service run.
MAX_COLOR_SEGS = 12000
# Hard wall-clock budget for one page (dense infrastructure sheets can
# carry hundreds of thousands of paths - honesty over heroics: an
# unmeasured sheet stays TO MEASURE).
PAGE_BUDGET_S = 25.0
# Pages whose decompressed content stream exceeds this are too dense to
# parse into vector paths at all (memory-safe pre-check).
MAX_CONTENT_BYTES = 15_000_000

_SCALE_RE = re.compile(
    r'(?i)\bSCALE\b[^0-9A-Za-z\n]{0,8}(\d{1,3})\s*[:=]\s*(\d{1,5})')
_AS_SHOWN_RE = re.compile(r'(?i)\bSCALE\b[^\n]{0,25}\bAS\s+SHOWN\b')


# ────────────────────────────────────────── scale
def parse_scale(page):
    """The sheet's single stated scale ratio (e.g. 250.0 for 'SCALE 1:250'),
    or None where no ratio is stated, several DIFFERENT ratios are stated
    (detail sheets, 'AS SHOWN') or the sheet is NTS - i.e. unmeasurable."""
    try:
        text = page.get_text('text')
    except Exception:
        return None
    if _AS_SHOWN_RE.search(text or ''):
        return None
    ratios = set()
    for m in _SCALE_RE.finditer(text or ''):
        a, b = int(m.group(1)), int(m.group(2))
        if a >= 1 and b >= 1 and b >= a:
            ratios.add(round(b / a, 4))
    if len(ratios) != 1:
        return None
    ratio = ratios.pop()
    return ratio if 1 <= ratio <= 5000 else None


def mm_per_pt(ratio):
    """Real-world mm represented by one PDF point at the given ratio."""
    return MM_PER_PT * ratio


# ────────────────────────────────────────── segment collection
def _sat(color):
    return max(color) - min(color)


def service_paths(page, exclude_title=True):
    """Service-like stroke segments from the page vector geometry:
    coloured strokes only (saturation test drops grey/black/white
    linework), very short symbol fragments dropped, the title-block strip
    excluded, exact duplicates de-duplicated.
    Returns [{'p1': (x, y), 'p2': (x, y), 'color': (r, g, b),
              'width': w}] in unrotated page coordinates."""
    segs = []
    seen = set()
    try:
        view_w = page.rect.width
        rot = page.rotation_matrix
        drawings = page.get_drawings()
    except Exception:
        return segs
    for d in drawings:
        color = d.get('color')
        if not color or len(color) < 3:
            continue
        color = tuple(color[:3])
        if _sat(color) < SAT_MIN:
            continue
        width = float(d.get('width') or 0.0)
        for it in d['items']:
            if it[0] == 'l':
                p1, p2 = it[1], it[2]
            elif it[0] == 'c':
                p1, p2 = it[1], it[4]   # bezier chord (elbow sweeps)
            else:
                continue
            length = math.hypot(p2.x - p1.x, p2.y - p1.y)
            if length < MIN_SEG_PT:
                continue
            if exclude_title:
                mx = (p1.x + p2.x) / 2
                my = (p1.y + p2.y) / 2
                vx = rot.a * mx + rot.c * my + rot.e
                if vx > view_w * EDGE_FRACTION:
                    continue
            ck = (round(color[0], 2), round(color[1], 2), round(color[2], 2))
            key = (round(p1.x, 1), round(p1.y, 1),
                   round(p2.x, 1), round(p2.y, 1), ck)
            rkey = (key[2], key[3], key[0], key[1], ck)
            if key in seen or rkey in seen:
                continue
            seen.add(key)
            segs.append({'p1': (p1.x, p1.y), 'p2': (p2.x, p2.y),
                         'color': ck, 'width': round(width, 2)})
    return segs


# ────────────────────────────────────────── chaining
def _seg_dir(s):
    dx = s['p2'][0] - s['p1'][0]
    dy = s['p2'][1] - s['p1'][1]
    return math.atan2(dy, dx)


def _ang_diff(a, b):
    """Undirected angle difference (parallel test, 0..pi/2)."""
    d = abs(a - b) % math.pi
    return min(d, math.pi - d)


def _seg_len(s):
    return math.hypot(s['p2'][0] - s['p1'][0], s['p2'][1] - s['p1'][1])


class _UF:
    def __init__(self, n):
        self.p = list(range(n))

    def find(self, i):
        while self.p[i] != i:
            self.p[i] = self.p[self.p[i]]
            i = self.p[i]
        return i

    def union(self, i, j):
        ri, rj = self.find(i), self.find(j)
        if ri == rj:
            return False
        self.p[rj] = ri
        return True


def _grid_key(x, y, cell):
    return (int(x // cell), int(y // cell))


def _endpoint_pairs(si, sj):
    pts_i = (si['p1'], si['p2'])
    pts_j = (sj['p1'], sj['p2'])
    best = None
    for a in pts_i:
        for b in pts_j:
            d = math.hypot(a[0] - b[0], a[1] - b[1])
            if best is None or d < best[0]:
                best = (d, a, b)
    return best


def _chain_color(segments, idxs, join_tol, dash_gap):
    """Union-find chaining of one colour family. Endpoint contact joins;
    collinear near-gaps bridge dashed runs (the gap length is carried into
    the run length, and the bridge is kept for the trace polylines)."""
    uf = _UF(len(idxs))
    local = {g: k for k, g in enumerate(idxs)}
    grid = {}
    cell = dash_gap + 0.1
    for g in idxs:
        s = segments[g]
        for pt in (s['p1'], s['p2']):
            grid.setdefault(_grid_key(pt[0], pt[1], cell), set()).add(g)
    gaps = {}      # root -> accumulated bridged gap
    bridges = {}   # root -> [(pa, pb)]
    dirs = {g: _seg_dir(segments[g]) for g in idxs}

    checked = set()
    for g in idxs:
        s = segments[g]
        cand = set()
        for pt in (s['p1'], s['p2']):
            kx, ky = _grid_key(pt[0], pt[1], cell)
            for dx in (-1, 0, 1):
                for dy in (-1, 0, 1):
                    cand |= grid.get((kx + dx, ky + dy), set())
        for h in cand:
            if h <= g:
                continue
            pair = (g, h)
            if pair in checked:
                continue
            checked.add(pair)
            d, pa, pb = _endpoint_pairs(s, segments[h])
            if d <= join_tol:
                uf.union(local[g], local[h])
                continue
            if d <= dash_gap:
                # dash bridge: both segments AND the bridging vector must
                # share one direction (a dashed run continuing)
                if _ang_diff(dirs[g], dirs[h]) > ANGLE_TOL:
                    continue
                bang = math.atan2(pb[1] - pa[1], pb[0] - pa[0])
                if _ang_diff(bang, dirs[g]) > ANGLE_TOL:
                    continue
                ri = uf.find(local[g])
                if uf.union(local[g], local[h]):
                    r = uf.find(local[g])
                    gaps[r] = gaps.get(r, 0.0) + gaps.pop(ri, 0.0) \
                        if r != ri else gaps.get(r, 0.0)
                    gaps[r] = gaps.get(r, 0.0) + d
                    bridges.setdefault(r, []).append((pa, pb))
    # re-root the gap/bridge maps (roots may have moved during unions)
    comp = {}
    for g in idxs:
        comp.setdefault(uf.find(local[g]), []).append(g)
    gap_by_root, bridge_by_root = {}, {}
    for r, v in gaps.items():
        gap_by_root[uf.find(r)] = gap_by_root.get(uf.find(r), 0.0) + v
    for r, v in bridges.items():
        bridge_by_root.setdefault(uf.find(r), []).extend(v)

    routes = []
    for r, group in comp.items():
        routes.append(_build_route(segments, group,
                                   gap_by_root.get(r, 0.0),
                                   bridge_by_root.get(r, []), join_tol))
    return routes


def _node_key(pt, tol):
    return (round(pt[0] / tol), round(pt[1] / tol))


def _simplify(poly, tol=1.5):
    """Collapse collinear runs of vertices (keeps the trace light)."""
    if len(poly) <= 2:
        return poly
    out = [poly[0]]
    for k in range(1, len(poly) - 1):
        a, b, c = out[-1], poly[k], poly[k + 1]
        d1 = math.atan2(b[1] - a[1], b[0] - a[0])
        d2 = math.atan2(c[1] - b[1], c[0] - b[0])
        if _ang_diff(d1, d2) > math.radians(4) or \
                math.hypot(b[0] - a[0], b[1] - a[1]) > 200:
            out.append(b)
    out.append(poly[-1])
    return out


def _build_route(segments, group, gap_pt, bridge_list, join_tol):
    """Assemble one connected component into a route dict with trail
    polylines (for the audit trace) and the summed run length."""
    edges = []
    length = 0.0
    for g in group:
        s = segments[g]
        edges.append((s['p1'], s['p2']))
        length += _seg_len(s)
    for pa, pb in bridge_list:
        edges.append((pa, pb))
    length += gap_pt

    # node graph on quantized endpoints
    tol = max(join_tol, 1.0)
    adj = {}
    canon = {}
    for ei, (a, b) in enumerate(edges):
        for pt in (a, b):
            canon.setdefault(_node_key(pt, tol), pt)
        ka, kb = _node_key(a, tol), _node_key(b, tol)
        adj.setdefault(ka, []).append((kb, ei))
        adj.setdefault(kb, []).append((ka, ei))
    branched = any(len(v) > 2 for v in adj.values())

    # trail extraction: walk unused edges, preferring the straightest
    # continuation, starting at odd-degree nodes
    used = set()
    polylines = []
    order = sorted(adj, key=lambda k: (len(adj[k]) % 2 == 0, k))
    for start in order:
        while True:
            nxt = [(nb, ei) for nb, ei in adj[start] if ei not in used]
            if not nxt:
                break
            path = [canon[start]]
            node = start
            prev_dir = None
            while True:
                options = [(nb, ei) for nb, ei in adj[node]
                           if ei not in used]
                if not options:
                    break
                if prev_dir is None or len(options) == 1:
                    nb, ei = options[0]
                else:
                    def straightness(o):
                        p_here, p_next = canon[node], canon[o[0]]
                        ang = math.atan2(p_next[1] - p_here[1],
                                         p_next[0] - p_here[0])
                        return _ang_diff(ang, prev_dir)
                    nb, ei = min(options, key=straightness)
                used.add(ei)
                p_here, p_next = canon[node], canon[nb]
                prev_dir = math.atan2(p_next[1] - p_here[1],
                                      p_next[0] - p_here[0])
                path.append(p_next)
                node = nb
            if len(path) >= 2:
                polylines.append(_simplify(path))
    xs = [p[0] for a, b in edges for p in (a, b)]
    ys = [p[1] for a, b in edges for p in (a, b)]
    s0 = segments[group[0]]
    return {'color': s0['color'], 'width': s0['width'],
            'edges': edges, 'points': polylines,
            'length_pt': length, 'gap_pt': gap_pt,
            'n_segments': len(group), 'branched': branched,
            'bbox': (min(xs), min(ys), max(xs), max(ys)),
            'flags': []}


def chain_routes(segments, join_tol=JOIN_TOL, dash_gap=DASH_GAP,
                 deadline=None):
    """Join segments into connected routes per stroke colour: endpoint
    contact within join_tol, or collinear dash bridging within dash_gap.
    Returns route dicts (see _build_route). A deadline (time.time() value)
    aborts cleanly on over-dense sheets - the caller reports the sheet as
    not measurable rather than guessing."""
    by_color = {}
    for k, s in enumerate(segments):
        by_color.setdefault(s['color'], []).append(k)
    routes = []
    for color, idxs in sorted(by_color.items(), key=lambda kv: len(kv[1])):
        if len(idxs) > MAX_COLOR_SEGS:
            continue  # background texture, not a service
        if deadline and time.time() > deadline:
            raise TimeoutError('page geometry too dense to chain within '
                               'the time budget')
        routes.extend(_chain_color(segments, idxs, join_tol, dash_gap))
    return routes


# ────────────────────────────────────────── double-line handling
def _edge_grid(edges, cell):
    grid = {}
    for ei, (a, b) in enumerate(edges):
        mx, my = (a[0] + b[0]) / 2, (a[1] + b[1]) / 2
        grid.setdefault(_grid_key(mx, my, cell), []).append(ei)
    return grid


def _pt_seg_dist(px, py, a, b):
    ax, ay = a
    bx, by = b
    dx, dy = bx - ax, by - ay
    l2 = dx * dx + dy * dy
    if l2 == 0:
        return math.hypot(px - ax, py - ay)
    t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / l2))
    return math.hypot(px - (ax + t * dx), py - (ay + t * dy))


def _edges_touch(e1, e2, tol=JOIN_TOL):
    for p in e1:
        for q in e2:
            if math.hypot(p[0] - q[0], p[1] - q[1]) <= tol:
                return True
    return False


def _self_double(route, max_gap):
    """Fraction of the route length whose edges have a PARALLEL,
    non-touching partner edge within max_gap in the SAME route (double-line
    duct outline), plus the median partner gap."""
    edges = route['edges']
    if len(edges) < 2:
        return 0.0, None
    cell = max_gap + 0.1
    grid = _edge_grid(edges, cell)
    doubled = 0.0
    total = 0.0
    gaps = []
    for ei, (a, b) in enumerate(edges):
        elen = math.hypot(b[0] - a[0], b[1] - a[1])
        total += elen
        ang = math.atan2(b[1] - a[1], b[0] - a[0])
        mx, my = (a[0] + b[0]) / 2, (a[1] + b[1]) / 2
        kx, ky = _grid_key(mx, my, cell)
        best = None
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                for ej in grid.get((kx + dx, ky + dy), []):
                    if ej == ei:
                        continue
                    c, d = edges[ej]
                    ang2 = math.atan2(d[1] - c[1], d[0] - c[0])
                    if _ang_diff(ang, ang2) > math.radians(12):
                        continue
                    if _edges_touch((a, b), (c, d)):
                        continue
                    dist = _pt_seg_dist(mx, my, c, d)
                    if 1.5 <= dist <= max_gap and \
                            (best is None or dist < best):
                        best = dist
        if best is not None:
            doubled += elen
            gaps.append(best)
    frac = doubled / total if total else 0.0
    gaps.sort()
    med = gaps[len(gaps) // 2] if gaps else None
    return frac, med


def _route_route_gap(ra, rb, max_gap):
    """(median gap, overlap fraction) sampling route A's edge midpoints
    against route B's edges."""
    cell = max_gap * 1.6
    grid = _edge_grid(rb['edges'], cell)
    dists = []
    n = 0
    for a, b in ra['edges']:
        mx, my = (a[0] + b[0]) / 2, (a[1] + b[1]) / 2
        n += 1
        kx, ky = _grid_key(mx, my, cell)
        best = None
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                for ej in grid.get((kx + dx, ky + dy), []):
                    c, d = rb['edges'][ej]
                    dist = _pt_seg_dist(mx, my, c, d)
                    if best is None or dist < best:
                        best = dist
        if best is not None and best <= max_gap * 1.5:
            dists.append(best)
    if not dists or n == 0:
        return None, 0.0
    dists.sort()
    return dists[len(dists) // 2], len(dists) / n


def dedup_parallel(routes, max_gap_pts, deadline=None):
    """Double-line duct handling.
    (a) A route that is dominantly self-parallel (the two outline lines of
        one duct chained through their fittings) has its length HALVED to
        a centreline figure and is flagged 'double-line merged'. A route
        only partially self-parallel is flagged ambiguous - low confidence.
    (b) Two separate near-parallel same-colour routes closer than
        max_gap_pts merge into one (average length), keeping one trace.
        A route with more than one merge candidate is ambiguous - flagged,
        NOT merged."""
    out = []
    # (a) self-parallel outlines
    for r in routes:
        if deadline and time.time() > deadline:
            raise TimeoutError('page geometry too dense to de-duplicate '
                               'within the time budget')
        frac, med = _self_double(r, max_gap_pts)
        r['double_frac'] = round(frac, 3)
        r['double_gap'] = round(med, 2) if med is not None else None
        if frac >= 0.65:
            r['length_pt'] = (r['length_pt'] * frac) / 2.0 \
                + r['length_pt'] * (1 - frac)
            r['flags'].append('double-line merged')
        elif frac >= 0.35:
            r['flags'].append('ambiguous double-line geometry')
    # (b) separate parallel twins
    by_color = {}
    for k, r in enumerate(routes):
        by_color.setdefault(r['color'], []).append(k)
    merged_away = set()
    for color, idxs in by_color.items():
        cands = {k: [] for k in idxs}
        for i, ka in enumerate(idxs):
            if deadline and time.time() > deadline:
                raise TimeoutError('page geometry too dense to '
                                   'de-duplicate within the time budget')
            for kb in idxs[i + 1:]:
                ra, rb = routes[ka], routes[kb]
                la, lb = ra['length_pt'], rb['length_pt']
                if la <= 0 or lb <= 0:
                    continue
                if min(la, lb) / max(la, lb) < 0.6:
                    continue
                gap, cover = _route_route_gap(
                    ra if la <= lb else rb, rb if la <= lb else ra,
                    max_gap_pts)
                if gap is not None and 1.5 <= gap <= max_gap_pts \
                        and cover >= 0.7:
                    cands[ka].append(kb)
                    cands[kb].append(ka)
        for ka in idxs:
            if ka in merged_away:
                continue
            partners = [k for k in cands[ka] if k not in merged_away]
            if len(partners) == 1:
                kb = partners[0]
                if len([k for k in cands[kb] if k not in merged_away]) == 1:
                    ra, rb = routes[ka], routes[kb]
                    if 'double-line merged' in ra['flags'] or \
                            'double-line merged' in rb['flags']:
                        continue  # already centreline figures
                    keep = ra if ra['length_pt'] >= rb['length_pt'] else rb
                    drop = rb if keep is ra else ra
                    keep['length_pt'] = (ra['length_pt']
                                         + rb['length_pt']) / 2.0
                    keep['n_segments'] += drop['n_segments']
                    keep['flags'].append('double-line merged')
                    merged_away.add(kb if keep is ra else ka)
            elif len(partners) > 1:
                routes[ka]['flags'].append('ambiguous parallel routes')
    for k, r in enumerate(routes):
        if k not in merged_away:
            out.append(r)
    return out


# ────────────────────────────────────────── labels
def _label_route_dist(x, y, route):
    best = None
    for a, b in route['edges']:
        d = _pt_seg_dist(x, y, a, b)
        if best is None or d < best:
            best = d
    return best if best is not None else float('inf')


def _arc_pos(poly, x, y):
    """Arc-length position of the point's projection along a polyline."""
    best = (float('inf'), 0.0)
    acc = 0.0
    for k in range(len(poly) - 1):
        a, b = poly[k], poly[k + 1]
        seg = math.hypot(b[0] - a[0], b[1] - a[1])
        d = _pt_seg_dist(x, y, a, b)
        if d < best[0]:
            dx, dy = b[0] - a[0], b[1] - a[1]
            l2 = dx * dx + dy * dy
            t = 0.0 if l2 == 0 else max(0.0, min(1.0, ((x - a[0]) * dx +
                                                       (y - a[1]) * dy) / l2))
            best = (d, acc + t * seg)
        acc += seg
    return best[1]


def _cut_polyline(poly, t0, t1):
    """The sub-polyline between arc positions t0..t1."""
    pts = []
    acc = 0.0
    for k in range(len(poly) - 1):
        a, b = poly[k], poly[k + 1]
        seg = math.hypot(b[0] - a[0], b[1] - a[1])
        if seg == 0:
            continue
        s0, s1 = acc, acc + seg
        lo, hi = max(s0, t0), min(s1, t1)
        if lo < hi:
            f0 = (lo - s0) / seg
            f1 = (hi - s0) / seg
            p0 = (a[0] + (b[0] - a[0]) * f0, a[1] + (b[1] - a[1]) * f0)
            p1 = (a[0] + (b[0] - a[0]) * f1, a[1] + (b[1] - a[1]) * f1)
            if not pts:
                pts.append(p0)
            pts.append(p1)
        acc = s1
    return pts


def label_routes(routes, size_labels, near=LABEL_NEAR_PT):
    """Assign size labels [(text, x, y)] to the nearest route within the
    proximity cut-off. Returns measurement candidates:
      [{'label', 'length_pt', 'points', 'n_segments', 'flags',
        'label_dist', 'color', 'double_gap'}]
    A simple (single-trail, unbranched) route carrying several DIFFERENT
    size labels is split at the arc midpoints between the labels; a
    branched multi-size route is flagged instead (low confidence).
    Unlabeled routes are ignored (background geometry)."""
    for r in routes:
        r['_labels'] = []
    for text, x, y in size_labels:
        ranked = sorted(((_label_route_dist(x, y, r), k)
                         for k, r in enumerate(routes)), key=lambda t: t[0])
        if not ranked or ranked[0][0] > near:
            continue
        d1, k1 = ranked[0]
        ambiguous = False
        if len(ranked) > 1:
            d2, k2 = ranked[1]
            if d2 <= near and d2 <= max(d1 * 1.3, d1 + 6.0):
                # only material when the two candidate runs would bill
                # materially different lengths (else the quantity is the
                # same whichever run the label belongs to)
                l1 = routes[k1]['length_pt'] or 1.0
                l2 = routes[k2]['length_pt'] or 1.0
                if abs(l1 - l2) / max(l1, l2) > 0.12:
                    ambiguous = True
        routes[k1]['_labels'].append({'text': text, 'x': x, 'y': y,
                                      'dist': d1, 'ambiguous': ambiguous})
    results = []
    for r in routes:
        labels = r.get('_labels') or []
        if not labels:
            continue
        texts = sorted({l['text'] for l in labels})
        base_flags = list(r['flags'])
        if any(l['ambiguous'] for l in labels):
            base_flags.append('label could sit on more than one run')
        if len(texts) == 1:
            results.append({'label': texts[0],
                            'length_pt': r['length_pt'],
                            'points': r['points'],
                            'n_segments': r['n_segments'],
                            'flags': base_flags,
                            'label_dist': min(l['dist'] for l in labels),
                            'color': r['color'],
                            'double_gap': r.get('double_gap')})
            continue
        # multiple DIFFERENT sizes on one connected run
        if r['branched'] or len(r['points']) != 1:
            for t in texts:
                results.append({'label': t, 'length_pt': r['length_pt'],
                                'points': r['points'],
                                'n_segments': r['n_segments'],
                                'flags': base_flags +
                                ['several sizes on one branched run'],
                                'label_dist': min(l['dist'] for l in labels
                                                  if l['text'] == t),
                                'color': r['color'],
                                'double_gap': r.get('double_gap')})
            continue
        # simple trail: split at midpoints between consecutive labels
        poly = r['points'][0]
        total = sum(math.hypot(poly[k + 1][0] - poly[k][0],
                               poly[k + 1][1] - poly[k][1])
                    for k in range(len(poly) - 1))
        marks = sorted(((_arc_pos(poly, l['x'], l['y']), l) for l in labels),
                       key=lambda t: t[0])
        cuts = [0.0]
        for k in range(len(marks) - 1):
            if marks[k][1]['text'] != marks[k + 1][1]['text']:
                cuts.append((marks[k][0] + marks[k + 1][0]) / 2)
        cuts.append(total)
        # halving factor survives the split proportionally
        factor = r['length_pt'] / total if total else 1.0
        pieces = {}
        ci = 0
        for pos, l in marks:
            while ci + 1 < len(cuts) - 1 and pos > cuts[ci + 1]:
                ci += 1
            pieces.setdefault((cuts[ci], cuts[ci + 1]), []).append(l)
        for (t0, t1), ls in pieces.items():
            seg_pts = _cut_polyline(poly, t0, t1)
            results.append({'label': ls[0]['text'],
                            'length_pt': (t1 - t0) * factor,
                            'points': [seg_pts] if len(seg_pts) >= 2 else [],
                            'n_segments': r['n_segments'],
                            'flags': base_flags + ['split at label midpoints'],
                            'label_dist': min(l['dist'] for l in ls),
                            'color': r['color'],
                            'double_gap': r.get('double_gap')})
    return results


# ────────────────────────────────────────── measurement
_DUCT_LABEL = re.compile(r'^(\d{2,4})[xX](\d{2,4})$')


def measure(page, size_labels, ratio='auto', budget_s=PAGE_BUDGET_S):
    """Measure labelled service runs on one page.
    size_labels: [(text, x, y)] in unrotated page coordinates.
    Returns [{'label', 'length_m', 'points', 'confidence', 'notes',
              'n_segments'}]. 'high' confidence ONLY when: a single sheet
    scale parsed, the label sits within the tight threshold on exactly one
    run, the chain and any double-line handling are unambiguous and the
    length is plausible. Anything else is 'low' and MUST NOT be billed."""
    if ratio == 'auto':
        ratio = parse_scale(page)
    if not size_labels:
        return []
    try:  # memory-safe pre-check before parsing the vector paths
        raw = page.read_contents()
        if raw and len(raw) > MAX_CONTENT_BYTES:
            return [{'label': t, 'length_m': None, 'points': [],
                     'confidence': 'low', 'n_segments': 0,
                     'notes': ['page geometry too dense to measure']}
                    for t, _x, _y in size_labels]
    except Exception:
        pass
    deadline = time.time() + budget_s
    segs = service_paths(page)
    if not segs:
        return []
    try:
        routes = chain_routes(segs, deadline=deadline)
        if ratio:
            # merge gap sized to the largest common duct width on the sheet
            max_gap = min(30.0, max(6.0, 650.0 / mm_per_pt(ratio)))
        else:
            max_gap = 12.0
        if time.time() > deadline:
            raise TimeoutError('page geometry too dense to measure within '
                               'the time budget')
        routes = dedup_parallel(routes, max_gap, deadline=deadline)
    except TimeoutError as e:
        return [{'label': t, 'length_m': None, 'points': [],
                 'confidence': 'low', 'notes': [str(e)], 'n_segments': 0}
                for t, _x, _y in size_labels]
    cands = label_routes(routes, size_labels)

    results = []
    for c in cands:
        notes = list(c['flags'])
        length_m = None
        if ratio:
            length_m = round(c['length_pt'] * mm_per_pt(ratio) / 1000.0, 2)
        ok = True
        m = _DUCT_LABEL.match(c['label'])
        if not ratio:
            notes.append('no single stated sheet scale')
            ok = False
        if c['label_dist'] > LABEL_TIGHT_PT:
            notes.append('size label sits far from the drawn run')
            ok = False
        for bad in ('ambiguous', 'several sizes', 'more than one run'):
            if any(bad in f for f in c['flags']):
                ok = False
        if length_m is not None and not (LEN_MIN_M <= length_m <= LEN_MAX_M):
            notes.append(f'implausible run length {length_m} m')
            ok = False
        # geometry-shape gates: a plan RUN must extend well beyond its own
        # cross-section and must not curl inside a compact footprint
        # (riser drops, shaft boxes and fitting outlines carry size labels
        # too - billing their outline as a run length is wrong)
        if ok and c['points']:
            xs = [p[0] for poly in c['points'] for p in poly]
            ys = [p[1] for poly in c['points'] for p in poly]
            bw, bh = max(xs) - min(xs), max(ys) - min(ys)
            diag = math.hypot(bw, bh)
            # perimeter / U-runs legitimately reach ~3x the diagonal;
            # cross-section outlines and fittings sit far above that
            if c['length_pt'] > 4.0 * max(diag, 1.0):
                notes.append('geometry curls within a compact footprint - '
                             'an outline or fitting, not a plan run')
                ok = False
            if m and ratio:
                wmax = max(int(m.group(1)), int(m.group(2)))
                w_paper = wmax / mm_per_pt(ratio)
                if max(bw, bh) < 3.0 * w_paper:
                    notes.append('footprint no larger than the duct '
                                 'cross-section - a drop or fitting, not '
                                 'a plan run')
                    ok = False
                if length_m is not None and length_m < 5.0 * wmax / 1000.0:
                    notes.append('run too short relative to the duct size '
                                 '- a drop or stub, not a plan run')
                    ok = False
        # pipework is drawn single-line: a 'double-line merged' halving on
        # a pipe label means parallel pipework was folded into one run -
        # the billed length would be wrong either way, so gate it out
        if ok and not m and 'double-line merged' in c['flags']:
            notes.append('parallel pipework merged - pipes are drawn '
                         'single-line, pair the runs by hand')
            ok = False
        # duct label vs measured double-line gap corroboration
        if ok and m and ratio and 'double-line merged' in c['flags'] \
                and c.get('double_gap'):
            expected = min(int(m.group(1)),
                           int(m.group(2))) / mm_per_pt(ratio)
            wider = max(int(m.group(1)),
                        int(m.group(2))) / mm_per_pt(ratio)
            if not (expected - 4.0 <= c['double_gap'] <= wider + 4.0):
                notes.append('drawn duct width does not corroborate the '
                             'labelled size')
                ok = False
        results.append({'label': c['label'], 'length_m': length_m,
                        'points': c['points'] if ok else [],
                        'confidence': 'high' if ok else 'low',
                        'notes': notes, 'n_segments': c['n_segments']})
    return results
