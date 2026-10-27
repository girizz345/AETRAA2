"""The measurement rules: facts in, bill items out. Every number is arithmetic on cited facts.

Sections produced from architectural drawings:
  D  Masonry            D2.1 walls by area, by thickness
  G  Thermal & moisture G2.1 waterproofing by area (flat), G3.1 DPC by length
  H  Doors and windows  H1.1 / H2.1 enumerated, one item per schedule mark
  J  Finishes           J3.1 floors / walls / ceilings by area, J3.2 skirtings by length

Every measured line names the shapes it came from (Line.shapes), so the platform can show them. Shapes a
person corrected - a wall given its thickness, a room renamed or drawn - go on lines of their own.
"""
from __future__ import annotations

import re
from collections import defaultdict

from .facts import Facts, Plan
from .records import CORRECTED, COUNTED, DERIVED, MANUAL, MEASURED, READ_VISUAL, STATED, Gap, Item, Line
from .assemblies import assembly, unit_of
from .tags import norm_mark, tag_id

FORMULA_B = "complete in accordance with the Specifications and Drawings"
FORMULA_H = "complete in accordance with the Specifications, Schedule and Drawings"


def r2(v: float) -> float:
    """Round a dimension as it is taken (2 decimals, metres)."""
    return round(v + 1e-9, 2)


KEEP_CASE = re.compile(r"\b(?:[A-Z]\.){2,}[A-Z]?|\b[A-Z]+-\d+\b|\"[^\"]+\"")
PROPER = {"belgium": "Belgium", "isoflex": "Isoflex", "edilfon": "Edilfon"}


def sentence(s: str) -> str:
    """Schedule/detail text (printed in capitals) as bill text: sentence case, codes and names kept."""
    s = re.sub(r"\s+", " ", s).strip(" .;,*")
    if not s:
        return s
    kept = {m.group(0).lower(): m.group(0) for m in KEEP_CASE.finditer(s)}
    low = s.lower()
    for k, v in kept.items():
        low = low.replace(k, v)
    low = re.sub(r"\bcivil (defence|defense)\b", lambda m: "Civil " + m.group(1).title(), low)
    low = re.sub(r"\b(d e w a|dewa|gbr|rcc|pu|uv|u value|sp-2|opc|ppt)\b", lambda m: m.group(1).upper(), low)
    low = re.sub(r"\b(" + "|".join(PROPER) + r")\b", lambda m: PROPER[m.group(1)], low)
    # a new sentence starts after a full stop that ends a real word, not after an abbreviation (g., flr.)
    low = re.sub(r"(\b[a-z]{4,}[.!?]\s+)([a-z])", lambda m: m.group(1) + m.group(2).upper(), low)
    return low[0].upper() + low[1:]


def lower_first(s: str) -> str:
    """Lower-case the first letter unless it opens an acronym or code (B.R.C., A-142)."""
    return s if len(s) < 2 or not s[1].islower() else s[0].lower() + s[1:]


NOT_A_FINISH = re.compile(r"WALL|SLAB|TIE BEAM|SOLID BLOCK|SKIRTING|BITUMINOUS|COMPACTED", re.I)


def finish_layers(legend: str) -> str:
    """The finish build-up from a detail legend ('1 HOLLOW BLOCK WALL; 2 ...'): numbering and the
    parts that are not the floor finish (walls, slab, tie beam, fill, skirting) left out."""
    parts = [re.sub(r"^\s*\d+\s+", "", p).strip() for p in legend.split(";")]
    return "; ".join(lower_first(sentence(p)) for p in parts if p and not NOT_A_FINISH.search(p))


# ---------------------------------------------------------------- openings

# one value in inches: 36", 130 3/8", 1/2", 30.5", 34 IN - never the tail of another number or of a feet value
_INCH = r'(?<![\d\'/.])(\d+(?:\.\d+)?(?:\s+\d+/\d+)?|\d+/\d+)\s*(?:"|IN\b)'


def _inches(v: str) -> float:
    whole, _, frac = v.strip().partition(" ")
    if "/" in whole:
        whole, frac = "0", whole
    n, _, d = frac.partition("/")
    return float(whole) + (float(n) / float(d) if frac else 0.0)


def _plain_inches(s: str) -> str:
    """Feet and inches written out ('3'-0"', '2'6"', '7'') and hyphen fractions ('30-1/2"') as plain inches, so
    _INCH reads them whole: before, '3'-0" X 80"' came back 0 mm wide and '30-1/2"' 13 mm."""
    s = re.sub(r"(\d)\s*-\s*(\d+/\d+)", r"\1 \2", s)                       # 30-1/2  ->  30 1/2

    def feet_inches(m):
        total = float(m.group(1)) * 12 + (_inches(m.group(2)) if m.group(2) else 0.0)
        return f'{total:g}"'
    # feet whole, never the tail of another number: "3.5'" is three and a half feet, not five
    s = re.sub(r"(?<![\d.'/])(\d+(?:\.\d+)?)\s*'\s*-?\s*(\d+(?:\.\d+)?(?:\s+\d+/\d+)?|\d+/\d+)?\s*\"", feet_inches, s)
    return re.sub(r"(?<![\d.'/])(\d+(?:\.\d+)?)\s*'", lambda m: f'{float(m.group(1)) * 12:g}"', s)   # 7', 3.5'


def inch_size(size: str) -> tuple[float, float, str] | None:
    """(width m, height m, which size) from a size in inches or feet and inches: '34" X 96"', '3'-0" X 6'-8"',
    'Width 70" Height 22" R/O 71"X23"'. The rough opening when one is given - the bill's sizes are structural
    opening sizes. None when either side is not a size (a nought is not)."""
    if re.search(r"/\s*0+(?!\d)", size):
        return None                         # a misread fraction ("30 1/0"): no size, not a crash
    s = _plain_inches(size.replace("″", '"').replace("′", "'").upper())
    ro = re.search(rf"R/?O\s*{_INCH}\s*[X×]\s*{_INCH}", s)
    m = ro or re.search(rf"{_INCH}\s*[X×]\s*{_INCH}", s) \
        or re.search(rf"W(?:IDTH)?\s*{_INCH}\s*H(?:EIGHT)?\s*{_INCH}", s)
    if not m:
        return None
    w, h = round(_inches(m.group(1)) * 0.0254, 4), round(_inches(m.group(2)) * 0.0254, 4)
    if w <= 0 or h <= 0:
        return None
    return w, h, "rough opening" if ro else "as printed"


class Opening:
    def __init__(self, dn: str, row: dict):
        self.dn, self.row = dn, row
        self.mark = row["mark"]
        self.key = norm_mark(self.mark)
        self.count = row.get("count")
        self.legs: list[float] = []
        self.w = self.h = self.sill = None
        self.basis = ""
        self._parse()

    def _parse(self):
        size = self.row.get("size", "")
        m = re.match(r"\s*\(?\s*(\d{3,5})\s*[Xx×]\s*(\d{3,5})", size)
        # some schedules state the size in metres ("(3.17 x 1.2)"): width with its decimal point, metres or none
        mm = re.fullmatch(r"\s*\(?\s*(\d{1,2}\.\d{1,3})\s*M?\s*[Xx×]\s*(\d{1,2}(?:\.\d{1,3})?)\s*M?\s*\)?\s*", size, re.I)
        if m:
            self.legs, self.h = [int(m.group(1)) / 1000], int(m.group(2)) / 1000
            self.basis = f"SIZE cell {m.group(1)}X{m.group(2)}"
        elif mm:
            self.legs, self.h = [float(mm.group(1))], float(mm.group(2))
            self.basis = f"SIZE cell {size.strip()}, in metres"
        elif inch_size(size):
            w, h, which = inch_size(size)
            self.legs, self.h = [w], h
            self.basis = f"SIZE cell {size.strip()}, in inches ({which}, converted to mm)"
        else:
            ss = self.row.get("shown_size", "")
            m = re.match(r"\s*([\d+ ]+?)\s*[xX×]\s*(\(?[\d+ ]+\)?)", ss)
            if m:
                self.legs = [int(v) / 1000 for v in re.findall(r"\d+", m.group(1))]
                parts = [int(v) for v in re.findall(r"\d+", m.group(2))]
                self.h = sum(parts) / 1000
                self.basis = f"elevation dimensions {ss}" + (" (height summed from its printed parts - DERIVED)"
                                                               if len(parts) > 1 else "")
                s = re.search(r"sill\s*(\d+)", ss)
                self.sill = int(s.group(1)) / 1000 if s else None
        if self.legs:
            self.w = sum(self.legs)

    @property
    def is_door(self) -> bool:
        """A door by its TYPE cell, its mark (D-1, SD-2, LD-1, FD-1, DW 01) or - for a mark that is only a number, as
        with a US schedule's doors 101, 102 - by its description: a door when it names a door before any window
        ("ENTRY DOOR / SIDE LITE / WINDOWS"). A lettered mark keeps its letter's word: W6 "FIXED GLAZING BESIDE
        ENTRANCE DOOR" and V1 "VENTILATOR ABOVE DOOR" are not doors."""
        t = (self.row.get("type", "") + " " + self.mark).upper()
        if "DOOR" in t or self.key.startswith(("D", "SD", "LD", "FD")):
            return True
        if not re.fullmatch(r"\d+[A-Z]?", self.key):
            return False
        d = self.row.get("description", "").upper()
        door, window = re.search(r"\bDOORS?\b", d), re.search(r"\bWINDOWS?\b", d)
        return door is not None and (window is None or door.start() < window.start())

    def size_text(self) -> str:
        if not self.legs:
            return "size not legible"
        w = " + ".join(f"{int(round(l * 1000))}" for l in self.legs)
        shape = " (L-shaped on plan)" if len(self.legs) > 1 else ""
        return f"{w} x {int(round(self.h * 1000))}mm{shape}"


def openings(f: Facts) -> dict[str, Opening]:
    out = {}
    for dn, row in f.schedule:
        o = Opening(dn, row)
        if o.key in out:
            f.gaps.append(Gap(dn, o.mark, f"mark also scheduled on {out[o.key].dn}; both readings kept apart - "
                                          f"resolve which governs", "H"))
            continue
        out[o.key] = o
        if o.w is None:
            f.gaps.append(Gap(dn, o.mark, "size not legible - opening not deducted from walls or finishes", "H"))
    return out


# ---------------------------------------------------------------- H doors and windows

FAMILIES = [
    ("SOLID PANEL DOOR", "Timber Doors"),
    ("LOUVERED DOOR", "Aluminium Louvred Doors"),
    ("STEEL DOOR", "Steel Doors"),
    ("LOUVRE WINDOW", "Aluminium Louvred Windows"),
    ("ALUMIN", "Aluminium Glazed Doors and Windows"),
]


def family(desc: str) -> str:
    u = desc.upper()
    return next((name for key, name in FAMILIES if key in u), "Other Doors and Windows")


H_FAMILIES = [   # (keyword in the schedule description, element, family heading, sub-heading noun)
    ("SOLID PANEL DOOR", "Doors", "Wooden Doors", "wooden doors"),
    ("LOUVERED DOOR", "Doors", "Aluminium Louvred Doors", "aluminium louvred doors"),
    ("STEEL DOOR", "Doors", "Steel Doors", "steel doors"),
    ("LOUVRE WINDOW", "Windows", "Aluminium Louvred Windows", ""),
]


MATERIALS = [("UPVC", "uPVC"), ("U-PVC", "uPVC"), ("PVC", "PVC"), ("ALUMIN", "Aluminium"), ("STEEL", "Steel"),
             ("TIMBER", "Timber"), ("WOOD", "Wooden")]


def h_family(o: "Opening") -> tuple[str, str, str]:
    u = o.row["description"].upper()
    for key, element, fam, noun in H_FAMILIES:
        if key in u:
            return element, fam, noun
    if o.key.startswith("DW"):
        return "Windows", "Aluminium Door Windows", ""
    # anything else by what it is and what it is made of: a uPVC casement window is not an aluminium door. The
    # material named first is the item's - "WOOD DOOR WITH STEEL LEVER HANDLES" is a wooden door
    hits = [(u.find(key), name) for key, name in MATERIALS if key in u]
    mat = min(hits)[1] if hits else ""
    if not o.is_door:
        return "Windows", f"{mat} Windows" if mat else "Windows", ""
    if not mat:
        return "Doors", "Doors", "doors"
    return "Doors", f"{mat} Doors", f"{mat if mat in ('uPVC', 'PVC') else mat.lower()} doors"


def named_family(o: "Opening") -> bool:
    """Whether h_family names the item's family from its description (the house set's families) rather than
    by element and material alone."""
    u = o.row["description"].upper()
    return any(key in u for key, *_ in H_FAMILIES) or o.key.startswith("DW")


def h_size(o: "Opening") -> str:
    if not o.legs:
        return "size as scheduled"
    w = "mm + ".join(f"{int(round(l * 1000))}" for l in o.legs)
    return f"size {w}mm x {int(round(o.h * 1000))}mm" + (", L-shaped" if len(o.legs) > 1 else "")


def section_h(f: Facts, ops: dict[str, Opening], decisions, counts) -> list[Item]:
    items = []
    notes = tuple(decisions.get("door_note_lines", []))
    order = {"Doors": 0, "Windows": 1}
    fam_desc: dict[str, str] = {}

    def is_fire(o):
        # fire rated anywhere in the description, unless NON / NOT / NO comes in the few words before it -
        # "(NON - FIRE RATED)", "NOT TO BE FIRE RATED"; punctuation is no word
        u = re.sub(r"[^A-Z0-9*]+", " ", o.row["description"].upper())
        return any(not set(u[:m.start()].split()[-4:]) & {"NON", "NOT", "NO"} for m in re.finditer(r"FIRE ?RATED", u))

    # a family with any member named by element and material alone groups items that say different things
    # (Chief Architect's windows, a flush door beside the house's solid panel doors): when its members'
    # descriptions differ, each line carries its own, under a heading that is the family's name
    members: dict[str, set] = {}
    loose: set[str] = set()
    for k in ops:
        fam = h_family(ops[k])[1]
        members.setdefault(fam, set()).add(sentence(ops[k].row["description"].split("*")[0]))
        if not named_family(ops[k]):
            loose.add(fam)
    generic = {fam: d for fam, d in members.items() if fam in loose}

    def sort_key(k):
        el, fam, _ = h_family(ops[k])
        # fire rated items together under one sub-heading, then the rest; by mark within each
        return (order[el], fam, not is_fire(ops[k]), re.sub(r"\d+", "", k), int(re.sub(r"\D", "", k) or 0))

    for key in sorted(ops, key=sort_key):
        o = ops[key]
        element, fam, noun = h_family(o)
        base, *extras = [s for s in o.row["description"].split("*")]
        mixed = len(generic.get(fam, ())) > 1
        if fam not in fam_desc:
            fam_desc[fam] = f"{fam if mixed else sentence(base)} {FORMULA_H}"
        fire = is_fire(o)
        rest = []
        for e in extras:
            u = re.sub(r"\s+", " ", e.upper()).strip(" .")
            if "FIRE RATED" in u:
                continue                                  # carried by the fire rated sub-heading
            if "WEATHER STRIP" in u:
                rest.append("with weather strips")
                continue
            # "DOOR SHALL HAVE LABEL AND SELF DOOR CLOSER" -> "with label and self door closer"
            m = re.match(r"(?:THE )?DOOR SHALL HAVE (.+)", u)
            if m:
                what = m.group(1)
                if fire:                                  # a fire rated door's label goes with its rating
                    what = re.sub(r"^LABEL\s*(AND\s*)?", "", what).strip()
                if what:
                    rest.append("with " + lower_first(sentence(what)))
            elif sentence(e):
                rest.append(lower_first(sentence(e)))
        sub = (f"Fire rated {noun}" if fire else f"Non fire rated {noun}") if noun else ""
        typ = sentence(o.row["type"]) if o.row.get("type", "").strip() else ""
        own = sentence(base) if mixed else ""
        short = min(typ, own, key=len).lower() if typ and own else ""
        if len(short) >= 3 and re.search(rf"\b{re.escape(short)}\b", max(typ, own, key=len).lower()):
            typ, own = max(typ, own, key=len), ""          # "Fixed glass" typed and described: said once
        lead = ", ".join(x for x in (typ, lower_first(own) if typ else own) if x)
        variant = ", ".join(x for x in (lead, h_size(o), f"type {o.mark}") if x) + "".join(f", {r}" for r in rest)
        clause = "H1.1" if o.is_door else "H2.1"
        it = Item("H", fam, fam_desc[fam], sub, variant, unit_of(clause), clause,
                  heads=(element, fam), note_lines=notes if element == "Doors" else ())
        c = counts[key]
        sched = (f"{o.mark} - schedule NO. {o.count if o.count is not None else '(empty)'} "
                 f"({o.size_text()}; location: {sentence(o.row['location'])})")
        plans = f"{o.mark} - plan tags {c.plan_total} ({c.where})"
        tags = tuple(f"{p.dn}/{tag_id(x, y)}" for p in f.plans for k, x, y in p.tags if k == key)
        if o.count is None:
            f.gaps.append(Gap(o.dn, o.mark, "NO. cell empty or illegible - count not read", "H"))
        if c.status == "CLOSED":
            # two independent counts agree: the item closes on that number
            it.lines.append(Line(o.dn, sentence(o.row["location"]), sched + " - CLOSED, agrees with the plans", 1,
                                 qty_each=o.count, origin=READ_VISUAL, location=o.basis))
            it.lines.append(Line(o.dn, "", plans, memo=True, origin=COUNTED, shapes=tags))
        elif decisions.get("open_count_policy", "leave_open") == "bill_schedule" and o.count is not None:
            it.lines.append(Line(o.dn, sentence(o.row["location"]), sched + " - OPEN, billed as scheduled by "
                                 "decision", 1, qty_each=o.count, origin=READ_VISUAL, location=o.basis))
            it.lines.append(Line(o.dn, "", plans, memo=True, origin=COUNTED, shapes=tags))
        else:
            # the counts disagree: both are recorded, neither is billed
            it.open = True
            it.lines.append(Line(o.dn, "", sched + " - OPEN", memo=True, origin=READ_VISUAL))
            it.lines.append(Line(o.dn, "", plans + " - OPEN", memo=True, origin=COUNTED, shapes=tags))
        items.append(it)
    return items


# ---------------------------------------------------------------- walls

def slab_thickness(f: Facts, decisions) -> tuple[float | None, str]:
    if decisions.get("slab_thickness_mm"):
        return decisions["slab_thickness_mm"] / 1000, "decisions register"
    for dn, notes in sorted(f.notes.items()):
        for n in notes:
            m = re.search(r"(\d+)\s*cm\s+CONCRETE SLAB", n["text"], re.I)
            if m:
                return int(m.group(1)) / 100, f"'{m.group(0)}' ({n['detail']}, {dn})"
    return None, ""


def floor_height(f: Facts, floor: str, slab: float | None) -> tuple[float | None, str]:
    s = f.storeys.get(floor)
    if not s or s.get("height") is None:
        return None, ""
    h = s["height"] - (slab or 0)
    return r2(h), s["basis"] + (f" less {slab:.2f} slab" if slab else "")


def classify_pieces(plan: Plan, ext_names: set[str]) -> dict[int, str]:
    """piece index -> 'low' when both faces open onto balconies (a balcony divider)."""
    out = {}
    if not plan.rooms:
        return out
    region_name = {r.region: r.name for r in plan.rooms}
    for idx, p in enumerate(plan.pieces):
        mx, my = p.mid
        a, b = plan.sides_of(p, mx, my)
        na, nb = region_name.get(a, ""), region_name.get(b, "")
        if "BALCONY" in na and "BALCONY" in nb:
            out[idx] = "low"
    return out


def section_d(f: Facts, ops, decisions, slab) -> list[Item]:
    blocks = decisions["block_thicknesses_mm"]
    thr = assembly("D2.1", decisions["deduct_threshold_m2"]).deduct_threshold or 0.0
    block_note = notes_text(f, r"WALL AT GROUND|EXTERNAL WALL")
    group_desc = "Concrete block, bedded and jointed in cement mortar " + FORMULA_B
    # block type per thickness, only where a detail states it: "200mm(8")150mm(6")THICK HOLLOW BLOCK"
    hollow = set()
    if block_note:
        m = re.search(r"((?:\d+mm\(\d+\"\)\s*)+)THICK HOLLOW BLOCK", block_note[0], re.I)
        if m:
            hollow = {int(v) for v in re.findall(r"(\d+)mm", m.group(1))}
    items: dict[tuple, Item] = {}

    def item(thk, low=False, low_h=None):
        key = (thk, low)
        if key not in items:
            d = f"Walls, {thk}mm thick" + (f", balcony partition, {low_h:g}m high" if low else "")
            sub = "Hollow Block Walls" if thk in hollow else "Block Walls"
            items[key] = Item("D", "Walls", group_desc, sub, d, unit_of("D2.1"), "D2.1", heads=("Walls",))
        return items[key]

    for p in f.plans:
        if not p.pieces:
            continue
        kinds = classify_pieces(p, set(decisions["external_room_names"]))
        low_h = p.low_h
        for floor in p.info.floors:
            H, basis = floor_height(f, floor, slab)
            if H is None:
                f.gaps.append(Gap(p.dn, f"walls {floor}", "no storey height for this level - walls not measured", "D"))
                continue
            walls = defaultdict(list)        # (thickness, balcony partition, given its thickness by hand) -> pieces
            other = defaultdict(float)
            for idx, w in enumerate(p.pieces):
                if w.thk_mm in blocks:
                    walls[(w.thk_mm, kinds.get(idx) == "low", bool(w.hand))].append(w)
                else:
                    other[w.thk_mm] += w.length_m
            # full-height walls by thickness, then balcony partitions; within each, the pieces set by hand last
            for (thk, low, hand) in sorted(walls, key=lambda k: (k[1], k[0], k[2])):
                ws = walls[(thk, low, hand)]
                length = sum(w.length_m for w in ws)
                L = r2(length)
                ids = tuple(f"{p.dn}/{w.id}" for w in ws)
                by_hand = f" given their thickness by hand ({len(ws)} piece(s))" if hand else ""
                if not low:
                    item(thk).lines.append(Line(p.dn, floor, f"{thk}mm walls{by_hand}, net length on plan (openings "
                                                             f"excluded) x storey height less slab ({basis})", 1, L=L,
                                                H=H, origin=CORRECTED if hand else MEASURED, location=p.cal.basis,
                                                shapes=ids))
                elif low_h is None:
                    f.gaps.append(Gap(p.dn, f"{thk}mm balcony partitions {floor}",
                                      f"{length:.2f} m between balconies; height not stated - not billed", "D"))
                else:
                    item(thk, True, low_h).lines.append(Line(p.dn, floor, f"{thk}mm balcony partitions{by_hand}, height "
                                                                   f"{low_h} m as noted on plan ('{low_h}M LOW HEIGHT "
                                                                   f"PARTITION WALL')", 1, L=L, H=low_h,
                                                             origin=CORRECTED if hand else MEASURED,
                                                             location=p.cal.basis, shapes=ids))
            for thk, L in sorted(other.items(), key=lambda kv: str(kv[0])):
                if L >= 0.5:
                    f.gaps.append(Gap(p.dn, f"walls {floor}",
                                      f"{L:.2f} m of wall pieces {thk or 'of unclassified'} "
                                      f"{'mm ' if thk else ''}thickness - not a block size (cladding line, RC or "
                                      f"drafting overlap); not billed", "D"))
            # add back the walling the plan leaves out at openings, less the opening (GP3.2)
            add = defaultdict(list)          # (thickness, mark) -> the tags
            for k, x, y in p.tags:
                o = ops.get(k)
                if not o or o.w is None:
                    continue
                piece, _ = p.nearest_piece(x, y)
                if piece is None or piece.thk_mm not in blocks:
                    continue
                add[(piece.thk_mm, k)].append(f"{p.dn}/{tag_id(x, y)}")
            for (thk, k), tids in sorted(add.items()):
                o = ops[k]
                w_each = r2(o.w / len(o.legs)) if len(o.legs) > 1 else r2(o.w)
                area = o.w * o.h
                if area >= thr:
                    hh = r2(max(0.0, H - o.h))
                    note = f"walling over/under {o.mark} ({o.size_text()}): opening {area:.2f} m2 deducted (>= {thr} m2)"
                else:
                    hh = H
                    note = f"walling at {o.mark} ({o.size_text()}): opening {area:.2f} m2 < {thr} m2, not deducted"
                if hh <= 0:
                    continue
                if len(o.legs) > 1:
                    note += "; L-shaped unit tagged per leg - each tag takes one leg's average width"
                item(thk).lines.append(Line(p.dn, floor, note, len(tids), L=w_each, H=hh, origin=DERIVED,
                                            location="tagged openings on plan", shapes=tuple(tids)))
    for thk in sorted({k[0] for k in items}):
        if thk not in hollow:
            f.gaps.append(Gap(block_note[1] if block_note else "(set)", f"{thk}mm walls",
                              "block type (hollow / solid) for this thickness is not stated on the details - billed "
                              "under 'Block Walls'", "D"))
    # hollow block walls first, as the sample bills; then by thickness
    return [items[k] for k in sorted(items, key=lambda k: (k[0] not in hollow, k[0], k[1]))]


# ---------------------------------------------------------------- finishes and waterproofing

def notes_text(f: Facts, pattern: str) -> tuple[str, str] | None:
    for dn, notes in sorted(f.notes.items()):
        for n in notes:
            if re.search(pattern, n["detail"], re.I):
                return n["text"], f"{n['detail'].strip(' .')}, {dn}"
    return None


def _room_openings(p: Plan, ops) -> dict[int, list]:
    """region -> (Opening, tag) for the openings in its walls, from each tag's nearest wall, both faces."""
    out = defaultdict(list)
    for k, x, y in p.tags:
        o = ops.get(k)
        if not o or o.w is None:
            continue
        piece, _ = p.nearest_piece(x, y)
        if piece is None:
            continue
        for rid in set(p.sides_of(piece, x, y)):
            if rid:
                out[rid].append((o, f"{p.dn}/{tag_id(x, y)}"))
    return out


ROOM_CLASSES = [   # (room names, bill wording), first match wins
    ({"BATH", "TOI.", "TOILET", "TOILETS", "KITCHEN"}, "bathrooms and toilets"),
    ({"STUDIO LIVING/DINING", "LIVING/DINING", "BED ROOM", "BEDROOM", "PANTRY"}, "apartments"),
    ({"CORRIDOR", "LOBBY", "LIFT LOBBY", "ENTRANCE LOBBY", "RECEPTION", "SERV. PASSAGE"}, "corridors and lobbies"),
    ({"GYMNASIUM"}, "gymnasium"),
]


def room_class(names: set[str]) -> str:
    for group, words in ROOM_CLASSES:
        if names & group:
            return words
    return "service rooms"


def section_j_g(f: Facts, ops, decisions, slab) -> tuple[list[Item], list[Item]]:
    thr = assembly("J3.1.2", decisions["deduct_threshold_m2"]).deduct_threshold or 0.0
    ext = set(decisions["external_room_names"])
    wet = set(decisions["wet_room_names"])
    typ = notes_text(f, r"TYPICAL FLOOR FINISH")
    gfd = notes_text(f, r"GROUND FLOOR FINISH")
    plaster = notes_text(f, r"WALL AT GROUND|EXTERNAL WALL")
    wp_wet = notes_text(f, r"WET AREA")
    dpc = notes_text(f, r"DAMP PROOFING")
    items: dict[tuple, Item] = {}
    FIN = ("Internal Finishes", "Finishing")

    def item(key, sec, heads, uhead, gdesc, sub, desc, unit, clause):
        if key not in items:
            items[key] = Item(sec, heads[-1], gdesc, sub, desc, unit, clause, heads=heads, uhead=uhead)
        return items[key]

    floor_desc = (f"{finish_layers(typ[0])[0].upper()}{finish_layers(typ[0])[1:]} ({typ[1]}) {FORMULA_B}"
                  if typ else f"Floor finishes {FORMULA_B}")
    gf_desc = (f"{finish_layers(gfd[0])[0].upper()}{finish_layers(gfd[0])[1:]} ({gfd[1]}) {FORMULA_B}"
               if gfd else floor_desc)
    wall_desc = (f"20mm thick cement mortar plaster ({plaster[1]}) {FORMULA_B}" if plaster
                 else f"Wall finishes {FORMULA_B}")
    ceil_desc = ("Ceiling finish as the ceiling details (A-14-001 to A-14-007, not in the drawing set) "
                 + FORMULA_B)
    skirt_desc = f"Ceramic tiles skirting ({typ[1]}) {FORMULA_B}" if typ else ""
    roof_desc = ("Roof waterproofing system as the waterproofing and roof finishing details (A-12-012, "
                 f"A-12-013; system to each roof to be confirmed) {FORMULA_B}")
    wet_desc = ("Superstructure waterproofing system including background "
                + (f"({wp_wet[1]}) " if wp_wet else "") + FORMULA_B)

    for p in f.plans:
        if not p.rooms:
            continue
        opens = _room_openings(p, ops)
        for floor in p.info.floors:
            H, basis = floor_height(f, floor, slab)
            by_name = defaultdict(list)      # (name, "" / "drawn" / "renamed" by hand, slope) -> rooms
            for r in p.rooms:
                by_name[(r.name, "drawn" if r.hand == "drawn" else "renamed" if r.hand else "", r.slope)].append(r)
            for (name, how, slope), rooms in sorted(by_name.items()):
                n = len(rooms)
                area = r2(sum(r.area_m2 for r in rooms))
                per = r2(sum(r.perimeter_m for r in rooms))
                names = set(name.split(" / "))
                is_ext = bool(names & ext) or all(r.category == "ext" for r in rooms)
                label = f"{name} ({n} no.)" + {"": "", "drawn": " - drawn by hand", "renamed": " - renamed by hand"}[how]
                origin = {"": MEASURED, "drawn": MANUAL, "renamed": CORRECTED}[how]
                ids = tuple(f"{p.dn}/{r.id}" for r in rooms)
                # a sloping surface is measured on the slope (G2.1 class 2; sloping work so described, D1.1);
                # walls, skirtings and ceilings stay as measured on plan
                on_slope, slabel, sorigin = area, label, origin
                if slope:
                    on_slope = r2(sum(r.area_m2 * r.slope_f for r in rooms))
                    slabel = f"{label}, sloping {slope}: plan area {area} m2 x slope factor {rooms[0].slope_f:.4f}"
                    sorigin = CORRECTED if origin == MEASURED else origin
                if is_ext:
                    where = "balconies" if names == {"BALCONY"} else "roofs and terraces"
                    item(("G-roof", where, bool(slope)), "G", ("Roof Coverings",), "Waterproofing", roof_desc, "",
                         f"To {'sloping' if slope else 'horizontal'} surfaces, {where}", unit_of("G2.1"),
                         "G2.1").lines.append(
                        Line(p.dn, floor, slabel, 1, qty_each=on_slope, origin=sorigin, location=p.cal.basis, shapes=ids))
                    continue
                cls = room_class(names)
                gf = floor == "GF"
                item(("J-floor", gf, cls, bool(slope)), "J", FIN, "Floors", gf_desc if gf else floor_desc, "",
                     f"To floors, {cls}" + (", ground floor" if gf else "") + (", sloping" if slope else ""),
                     unit_of("J3.1.1"), "J3.1.1").lines.append(
                    Line(p.dn, floor, slabel, 1, qty_each=on_slope, origin=sorigin, location=p.cal.basis, shapes=ids))
                if names & wet:
                    item(("G-wet", bool(slope)), "G", ("Damp-proof Courses", "Superstructure Waterproofing System"), "",
                         wet_desc, "To Internal Wet Areas;", "Sloping surfaces" if slope else "Horizontal surfaces",
                         unit_of("G2.1"), "G2.1").lines.append(
                        Line(p.dn, floor, slabel, 1, qty_each=on_slope, origin=sorigin, location=p.cal.basis, shapes=ids))
                ded_area, door_w, ded_tags, door_tags = 0.0, 0.0, [], []
                for r in rooms:
                    for o, tag in opens.get(r.region, []):
                        if o.w * o.h >= thr:
                            ded_area += o.w * o.h
                            ded_tags.append(tag)
                        if o.is_door:
                            door_w += o.w
                            door_tags.append(tag)
                if skirt_desc:
                    item(("J-skirt", cls), "J", FIN, "Skirtings", skirt_desc, "", f"To walls, {cls}", "m",
                         "J3.2").lines.append(
                        Line(p.dn, floor, f"{label}: perimeter {per} m less door openings {r2(door_w)} m", 1,
                             qty_each=r2(max(0.0, per - door_w)), origin=origin, location=p.cal.basis,
                             shapes=ids + tuple(door_tags)))
                if H is not None:
                    it = item(("J-wall", cls), "J", FIN, "Walls", wall_desc, "", f"To walls, {cls}", "m2",
                              "J3.1.2")
                    it.lines.append(Line(p.dn, floor, f"{label}: room perimeter x storey height less slab ({basis})",
                                         1, L=per, H=H, origin=origin, location=p.cal.basis, shapes=ids))
                    if ded_area:
                        it.lines.append(Line(p.dn, floor, f"{label}: deduct openings >= {thr} m2 in these rooms",
                                             1, qty_each=r2(ded_area), deduct=True, origin=DERIVED,
                                             location="tagged openings on plan", shapes=tuple(ded_tags)))
                item(("J-ceil", cls), "J", FIN, "Ceilings", ceil_desc, "", f"To ceilings, {cls}", "m2",
                     "J3.1.3").lines.append(Line(p.dn, floor, label, 1, qty_each=area, origin=origin,
                                                 location=p.cal.basis, shapes=ids))
    gfp = [p for p in f.plans if "GF" in p.info.floors and p.pieces]
    if dpc and gfp:
        it = item(("G-dpc",), "G", ("Damp-proof Courses",), "Damp Proof Course",
                  f"Damp proof course at ground floor walls ({dpc[1]}) {FORMULA_B}", "", "To walls", unit_of("G3.1"), "G3.1")
        blocks = decisions["block_thicknesses_mm"]
        for p in gfp:
            auto = [w for w in p.pieces if w.thk_mm in blocks and not w.hand]
            it.lines.append(Line(p.dn, "GF", "block walls at ground floor, net length on plan", 1,
                                 qty_each=r2(sum(w.length_m for w in auto)), origin=MEASURED, location=p.cal.basis,
                                 shapes=tuple(f"{p.dn}/{w.id}" for w in auto)))
            hand = [w for w in p.pieces if w.thk_mm in blocks and w.hand]
            if hand:
                it.lines.append(Line(p.dn, "GF", f"block walls at ground floor given their thickness by hand "
                                                 f"({len(hand)} piece(s))", 1,
                                     qty_each=r2(sum(w.length_m for w in hand)), origin=CORRECTED,
                                     location=p.cal.basis, shapes=tuple(f"{p.dn}/{w.id}" for w in hand)))
    cls_order = [w for _, w in ROOM_CLASSES] + ["service rooms"]
    kind_order = {"J-floor": 0, "J-skirt": 1, "J-wall": 2, "J-ceil": 3}

    def jkey(k):
        kind = k[0]
        gf, cls, sloping = (k[1], k[2], k[3]) if kind == "J-floor" else (False, k[1], False)
        return (kind_order[kind], not gf, cls_order.index(cls) if cls in cls_order else 99, sloping)

    j = [items[k] for k in sorted((k for k in items if k[0].startswith("J")), key=jkey)]
    g = [items[k] for k in (("G-roof", "roofs and terraces", False), ("G-roof", "roofs and terraces", True),
                            ("G-roof", "balconies", False), ("G-roof", "balconies", True), ("G-dpc",),
                            ("G-wet", False), ("G-wet", True))
         if k in items]
    return j, g


# ---------------------------------------------------------------- all

def build(f: Facts, decisions) -> dict[str, list[Item]]:
    ops = openings(f)
    slab, sbasis = slab_thickness(f, decisions)
    if slab is None:
        f.gaps.append(Gap("(set)", "slab thickness", "not stated - walls and wall finishes measured to full storey "
                                                   "height; set slab_thickness_mm in decisions.json", "D"))
    else:
        f.gaps.append(Gap("(set)", "slab thickness", f"{slab * 1000:.0f} mm taken from {sbasis} (STATED) for "
                                                   f"wall heights", "D"))
    from .assemblies import check
    from .reconcile import reconcile
    f.counts = reconcile(f, ops)
    out = {"H": section_h(f, ops, decisions, f.counts), "D": section_d(f, ops, decisions, slab)}
    out["J"], out["G"] = section_j_g(f, ops, decisions, slab)
    from .elevations import section_external
    out["J"] += section_external(getattr(f, "elevations", []), f.gaps)
    # every item against its clause: unit, dimension-line shape, mandatory description words
    f.gaps += check([it for its in out.values() for it in its], decisions)
    f.gaps += not_measured(f, ops)
    return {k: v for k, v in out.items() if v}


RAILING = re.compile(r"RAILING|BALUSTRADE|HANDRAIL", re.I)
IRONMONGERY = re.compile(r"\b(?:PUSH PLATES?|DOOR KNOBS?|KNOBS?|(?:SELF |DOOR )*CLOSERS?|HANDLES?|LOCKS?|HINGES?|"
                         r"LEVERS?|PANIC BARS?|DOOR STOPS?|IRONMONGERY)\b", re.I)


def not_measured(f: Facts, ops: dict[str, Opening]) -> list[Gap]:
    """What this set's drawings show that this version does not measure, each found in the set's own readings.

    These were written out for the first test set (its railings, its door D-1, its terrace thresholds) and so were
    reported on every project, citing drawings the project did not have."""
    out = []
    elevations = getattr(f, "elevations", [])
    shown = [e for e in elevations if e.cal.mm_per_pt and e.classes]
    blank = [e for e in elevations if e.cal.mm_per_pt and not e.classes]
    if shown:
        out.append(Gap(", ".join(e.dn for e in shown), "external wall finishes",
                       "finishes shown in colour on the elevations are measured by area; surfaces left uncoloured "
                       "are not, and faces seen at an angle are taken as drawn (projected area)", "J"))
    if blank:
        out.append(Gap(", ".join(e.dn for e in blank), "external wall finishes",
                       "no finish is shown in colour on these elevations - external finishes are not measured off "
                       "them", "J"))
    if not any(i.kind == "elevation" for i in f.infos):
        out.append(Gap("(set)", "external wall finishes", "no elevation in the set - external finishes are not "
                                                           "measured", "J"))
    interior = [i.drawing_no for i in f.infos if i.kind == "detail" and "ELEVATION" in i.title.upper()]
    if interior:
        out.append(Gap(", ".join(interior), "external wall finishes",
                       "taken as interior elevations (a room's own walls) - no external finish is measured off them",
                       "J"))
    rails = [(dn, part.strip()) for dn, ns in sorted(f.notes.items()) for n in ns
             for part in str(n.get("text", "")).split(";") if RAILING.search(part)]
    if rails:
        once: dict[str, str] = {}           # one note, printed on two sheets with other punctuation, said once
        for _, part in rails:
            once.setdefault(re.sub(r"[^a-z0-9]", "", part.lower()), lower_first(sentence(part)))
        said = list(once.values())
        out.append(Gap(", ".join(dict.fromkeys(dn for dn, _ in rails)), "railings",
                       f"railings are noted ({'; '.join(said[:3])}); railing lengths are not measured by this "
                       f"version", "E"))
    doors = [o for o in ops.values() if o.is_door]
    schedules = [i for i in f.infos if i.kind == "schedule"]
    read = {dn for dn, _ in f.schedule}
    unread = [i for i in schedules if i.drawing_no not in read]   # waiting on a reading: said by its own gap
    printed = [i.drawing_no for i in f.infos if getattr(i, "schedule_text", False) and i.kind != "schedule"]
    if not schedules and printed:
        out.append(Gap(", ".join(printed), "doors and windows",
                       "a door or window schedule is printed on these sheets, but only a sheet titled as a schedule "
                       "is read - no door or window is billed", "H"))
    elif not schedules and any(i.kind in ("plan", "roof") for i in f.infos):
        out.append(Gap("(set)", "doors and windows", "no door or window schedule in the set - no door or window is "
                                                     "billed", "H"))
    if doors and not any(re.search(r"IRONMONG|HARDWARE", i.title, re.I) for i in f.infos):
        says = [(o.mark, list(dict.fromkeys(m.group(0).lower() for m in IRONMONGERY.finditer(o.row["description"]))))
                for o in doors]
        says = [(m, w) for m, w in says if w]
        out.append(Gap(doors[0].dn, "ironmongery", "no ironmongery schedule in the set" + (
            "; only " + ", ".join(f"{m} ({', '.join(w)})" for m, w in says) + " describe" + ("s" if len(says) == 1
                                                                                            else "") + " any"
            if says else ""), "H"))
    drawn = [i.drawing_no for i in f.infos if i.kind != "schedule" and re.search(r"\bDOORS?\b", i.title, re.I)]
    if ops and not doors and not unread and drawn:
        out.append(Gap(", ".join(drawn), "doors", "doors are drawn, but the set has no door schedule - no door is "
                                                  "billed", "H"))
    thr = [(dn, s) for dn, s in getattr(f, "sheet_notes", []) if re.search(r"THRESHOLD", s, re.I)]
    if thr:
        detail = [dn for dn, ns in sorted(f.notes.items())
                  if any(re.search(r"THRESHOLD", f"{n.get('detail', '')} {n.get('text', '')}", re.I) for n in ns)]
        out.append(Gap(thr[0][0], "thresholds", f"'{thr[0][1]}'" + (f" - threshold detail on {', '.join(detail)}"
                                                                      if detail else "")
                       + "; the doors it applies to are not identified on plan, so thresholds are not enumerated",
                       "H"))
    return out
