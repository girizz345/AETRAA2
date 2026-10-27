#!/usr/bin/env python3
"""
stages_bill.py — stages S15..S19: descriptions, completeness, non-measured
items, pricing and assembly. Bound by TAIL-CONTRACT.md.

Every stage is `def _stage_x(ctx) -> list[str]`, writes its artefact into
ctx["run"], hands its data on through ctx["<key>"], and records what it could
not resolve as a Gap — never as a default. The runner marks a raising stage
FAILED, so a gate that blocks issue (S16) records the block in ctx and in its
artefact rather than raising; S20 honours the flag.

Invariants carried here: the model never produces a number (S18 asks the
search channel for observations and computes the median in Python); a rate
class comes from the CLAUSE, never from description text; quantities stay
Decimal and are written as strings; every user-facing string passes
render.hygiene.violations, and a violation is a gap, not a rewrite.
"""
from __future__ import annotations

import importlib.util
import json
import re
from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal
from pathlib import Path
from types import SimpleNamespace

from bill import completeness as completeness_mod
from bill import descriptions as descriptions_mod
from bill.assemble import (AssemblyLine, assemble, page_code, pack_groups,
                           reconcile, section_total)
from bill.market import build_query, parse_observations, publish
from bill.nonmeasured import build as build_nonmeasured
from bill.price import BillLine as PriceLine
from bill.price import price_bill, search_budget
from ingest import crosswalk
from ingest.conventions import DITTO, SectionConvention
from ingest.gates import Gates
from ingest.rates import RateClass, RateClassTable
from render.hygiene import violations
from spine.errors import CompletenessFailure
from spine.gaps import Gap
from spine.records import BillLine

HERE = Path(__file__).resolve().parent
DATA = HERE / "data"
VERBATIM = HERE / "reference" / "pomi-verbatim.md"

# The house builder whose row arithmetic the S19 packer must reproduce. The
# render agent copies it to render/_house; until then the original is read.
HOUSE_BUILDER_CANDIDATES = (
    HERE / "render" / "_house" / "build_house_takeoff.py",
    Path("/Users/ajay/Documents/AETRAA/agents/pomi_takeoff/scripts/"
         "build_house_takeoff.py"),
)

# TAIL-CONTRACT: evidence_kind from element_type.
EVIDENCE_KIND = {
    "door": "door_schedule", "window": "window_schedule",
    "finish": "finish_schedule", "sanitary": "sanitary_schedule",
    "fixture": "sanitary_schedule", "equipment": "equipment_schedule",
    "slab": "structural_schedule", "column": "structural_schedule",
    "beam": "structural_schedule",
}

# Attribute roles that carry a length in metres on the evidence base and are
# stated in millimetres in a description (DECISIONS 1: the words keep 150 mm).
_MM_ROLES = {"thickness": "{v}mm thick", "width": "{v}mm wide",
             "height": "{v}mm high", "length": "{v}mm long",
             "depth": "{v}mm deep", "diameter": "{v}mm", "size": "{v}mm",
             "bore": "{v}mm", "nominal_size": "{v}mm", "girth": "{v}mm girth"}
_SIZE_ROLES = ("size", "diameter", "bore", "nominal_size")
_MARK_SLOTS = ("type", "type_reference", "named_type", "schedule_ref")
# slots that add the schedule's own words where it has them ("hinged door") but
# that POMI does not require: printed when evidenced, left out - not a gap - when not
_OPTIONAL_SLOTS = ("kind",)

_TOKEN_STOP = {"and", "or", "the", "of", "by", "to", "in", "with", "for", "so",
               "described", "each", "shall", "be", "as", "an", "its", "their",
               "from", "on", "at", "per", "which", "that", "this", "not",
               "all", "any", "like", "may", "are", "is", "one", "item",
               "items", "stating", "measured", "enumerated", "together"}


# ── shared helpers ────────────────────────────────────────────────────────
def _dump(path: Path, payload) -> None:
    path.write_text(json.dumps(payload, indent=1, sort_keys=True, default=str))


def _gap(ctx, stage: str, subject: str, reason: str, detail: str | None = None,
         doc_id: str | None = None) -> None:
    ctx["gaps"].add(Gap(stage=stage, doc_id=doc_id, subject=subject,
                        reason=reason, detail=detail))


def _conventions_raw() -> dict:
    return json.loads((DATA / "conventions.json").read_text())


def _family_of(section: str, raw: dict) -> str | None:
    """conventions.descriptions[].template is a FAMILY KEY ("family_1"); the
    text lives in closing_formulas[family].text. "none" and null are no
    closing formula at all."""
    for row in raw["descriptions"]:
        if row["section"] == section:
            key = row.get("template")
            return key if key and key != "none" else None
    return None


def _section_convention(section: str, raw: dict) -> SectionConvention | None:
    for row in raw["descriptions"]:
        if row["section"] == section:
            return SectionConvention(section, row.get("template") or "",
                                     tuple(row.get("varies_by", [])),
                                     tuple(row.get("required_slots", [])))
    return None


def _mm(value: Decimal, unit: str | None) -> int:
    if unit == "mm":
        return int(Decimal(value))
    if unit == "cm":
        return int(Decimal(value) * 10)
    return int((Decimal(value) * 1000).to_integral_value())


def _sorted_quantities(quantities: list) -> list:
    """Canonical order: section (POMI order), clause id, element mark."""
    order = {letter: i for i, letter in enumerate(crosswalk.ordered())}
    return sorted(quantities, key=lambda q: (order.get(q.section, 99),
                                             q.clause_id, q.element_mark))


def _element_attributes(element, base) -> dict:
    """Every slot value traces to an attribute the element actually carries.
    The mark is the schedule's own type reference; dimensional roles come
    from the evidence base, stated in millimetres."""
    attrs: dict = {}
    if element is None:
        return attrs
    if getattr(element, "words", None):
        # a measured element has no schedule mark to cite: it is described by
        # what was measured ("to floors, wet areas", "walls, 200mm thick")
        attrs.update(element.words)
        attrs["_measured"] = True
    else:
        for slot in _MARK_SLOTS:
            attrs[slot] = f"type {element.mark}"
    for role, evidence_id in sorted((element.dims or {}).items()):
        try:
            record = base.get(evidence_id) if base is not None else None
        except Exception:                                    # noqa: BLE001
            record = None
        if record is None:
            continue
        value, unit = record.value, record.unit
        if role in _MM_ROLES and unit in ("m", "mm", "cm"):
            attrs[role] = _MM_ROLES[role].format(v=_mm(value, unit))
            if role in _SIZE_ROLES:
                attrs["size"] = f"{_mm(value, unit)}mm"
        elif role == "count":
            continue
        elif role in ("unit_weight", "mass_per_m"):
            attrs["unit_weight"] = f"{value} {unit or 'kg/m'}"
        else:
            attrs[role] = f"{value} {unit}".strip()
    # an opening is described by its overall size, as the house bills write
    # it - "size 1100mm x 2200mm" - and POMI H1.1 / H2.1 require it stated
    if "width" in (element.dims or {}) and "height" in (element.dims or {}):
        w = _dim_mm(base, element.dims["width"])
        h = _dim_mm(base, element.dims["height"])
        if w and h:
            attrs["opening_size"] = f"size {w}mm x {h}mm"
    return attrs


def _dim_mm(base, evidence_id):
    try:
        record = base.get(evidence_id) if base is not None else None
    except Exception:                                    # noqa: BLE001
        return None
    if record is None or record.unit not in ("m", "mm", "cm"):
        return None
    return _mm(record.value, record.unit)


def _printed_mm(text: str) -> str:
    """A printed figure for a description: "1200" -> "1200mm", the legs of an
    L-shaped unit "7300+2950" -> "(7300 + 2950)mm" - stated, not added up."""
    parts = [p for p in str(text).split("+") if p]
    return f"({' + '.join(parts)})mm" if len(parts) > 1 else f"{parts[0]}mm"


def _schedule_sizes(ctx) -> dict:
    """mark -> the size the schedule STATES, for the words of the description:
    "size (7300 + 2950)mm x 3200mm, sill 1000mm". Used where the size is not a
    single measurable width x height (an L-shaped unit), so the description
    still carries it as printed; the quantity takes nothing from it."""
    out: dict = {}
    for sched in ctx.get("schedules") or []:
        for row in sched.get("rows") or []:
            v = row.get("values") or {}
            if not (v.get("width") and v.get("height")):
                continue
            text = f"size {_printed_mm(v['width'])} x {_printed_mm(v['height'])}"
            if v.get("sill"):
                text += f", sill {_printed_mm(v['sill'])}"
            out.setdefault(row.get("mark"), set()).add(text)
    return {mark: next(iter(t)) for mark, t in out.items() if len(t) == 1}


def _clause_heading(title: str) -> str:
    """A clause title as a bill heading. The clause table carries the POMI
    text's own editorial notes in capitals - "Windows and skylights ENUMERATED
    TOGETHER WITH THEIR FRAMES -", "Walls and piers, FOUR classes" - which are
    instructions to the measurer, not the name of the work."""
    import re as _re
    text = _re.split(r"\s+(?:ENUMERATED|MEASURED|STATING|INCLUDING)\b|,\s*[A-Z]+\s+classes\b",
                     str(title or ""))[0]
    text = _re.sub(r"[\s\-\u2013\u2014:;,]+$", "", text).strip()
    # a capitalised run that is part of the name reads in sentence case
    return _re.sub(r"\b[A-Z]{2,}\b", lambda m: m.group(0).lower(), text)


def _schedule_kinds(ctx) -> dict:
    """mark -> what the schedule says the unit IS, from its TYPE cell
    ("HINGED DOOR", "SLIDING WINDOW"), in the words of the schedule, lower
    case as a bill sentence carries it. A mark scheduled with two different
    types keeps none - the schedule does not say which."""
    seen: dict = {}
    for sched in ctx.get("schedules") or []:
        for row in sched.get("rows") or []:
            text = " ".join(str((row.get("values") or {}).get("type") or "").split())
            if not text:
                continue
            seen.setdefault(row.get("mark"), set()).add(text.lower())
    return {mark: next(iter(kinds)) for mark, kinds in seen.items() if len(kinds) == 1}


def _item_code_for(ctx, quantity) -> str | None:
    """S13 publishes ctx["item_codes"]. Its key shape is not fixed by the
    contract, so every reasonable spelling is accepted; ctx["takeoff"] is the
    second source; None means S13 did not code this quantity."""
    codes = ctx.get("item_codes") or {}
    q = quantity
    for key in ((q.section, q.clause_id, q.element_mark),
                f"{q.section}|{q.clause_id}|{q.element_mark}",
                f"{q.section}:{q.clause_id}:{q.element_mark}",
                f"{q.clause_id}|{q.element_mark}",
                f"{q.clause_id}:{q.element_mark}",
                (q.clause_id, q.element_mark), q.element_mark):
        try:
            if key in codes:
                return str(codes[key])
        except TypeError:
            continue
    takeoff = ctx.get("takeoff") or {}
    for section in takeoff.get("sections", []):
        for item in section.get("items", []):
            if (item.get("clause_id") == q.clause_id
                    and item.get("element_mark") == q.element_mark):
                return str(item.get("code"))
    return None


# ── S15 descriptions ──────────────────────────────────────────────────────
_VERBATIM_CACHE: dict | None = None


def _verbatim_included(clause_id: str) -> str | None:
    """The POMI deemed-included list for a clause, read from the clause's own
    verbatim paragraph — the subject of "... shall be understood to be
    included". Nothing is written from memory: no such sentence, no list."""
    global _VERBATIM_CACHE
    if _VERBATIM_CACHE is None:
        _VERBATIM_CACHE = {}
        if VERBATIM.exists():
            pattern = re.compile(r"^\*\*([A-Z]+\d+\.\d+)\*\*\s+(.*)$")
            for line in VERBATIM.read_text(encoding="utf-8").splitlines():
                m = pattern.match(line.strip())
                if m:
                    _VERBATIM_CACHE[m.group(1)] = m.group(2)
    text = _VERBATIM_CACHE.get(clause_id)
    if not text:
        return None
    found = []
    for sentence in re.split(r"(?<=[.;])\s+", text):
        m = re.search(r"^(.*?)\s+shall be understood to (?:be )?include",
                      sentence, re.IGNORECASE)
        if m:
            subject = re.sub(r"^(?:and|but|or)\s+", "", m.group(1).strip(), flags=re.I)
            subject = re.sub(r"^extra weight for\s+", "", subject, flags=re.I)
            if subject:
                found.append(subject.rstrip(",;"))
    return "; ".join(found) if found else None


def _lead_template(clause, convention: SectionConvention | None, family: str | None,
                   raw: dict, attrs: dict) -> tuple[str, list[str]]:
    """The lead description as a template: clause title, the group's varying
    attributes as slots, the family closing text. Returns (template, printed
    slots). Family 3 IS the closing sentence, with {system} the clause title."""
    closing = raw["closing_formulas"].get(family, {}) if family else {}
    closing_text = closing.get("text") or ""
    closing_slots = set(descriptions_mod.slots(closing_text))
    printed: list[str] = []
    seen_values: set = set()
    if convention is not None:
        for slot in list(convention.varies_by) + list(convention.required_slots):
            if slot in closing_slots or slot in printed:
                continue
            value = attrs.get(slot)
            if value is None and slot in _OPTIONAL_SLOTS:
                continue                      # nothing to say, and nothing required
            if value is None and attrs.get("_measured") and slot not in convention.required_slots:
                continue                      # a measured item says what it covers; a
                                              # schedule attribute it has none of is not asked
            if value is not None and value in seen_values:
                continue                      # type == type_reference == mark
            printed.append(slot)
            if value is not None:
                seen_values.add(value)
    head = "{clause_title}"
    if family == "family_3":
        # The family 3 sentence IS the block; the size sits on the variant
        # row beneath it ("20mm PPR Piping" under "Supply and install all
        # Domestic Water Piping ..."), never appended after "as indicated."
        return closing_text, printed
    parts = [head] + [f"{{{s}}}" for s in printed]
    template = ", ".join(parts)
    if closing_text:
        template = f"{template}, {closing_text}"
    return template, printed


@dataclass
class _DescGroup:
    section: str
    clause_id: str
    element_type: str
    lead_code: str
    lead_description: str
    family: str | None
    members: list = field(default_factory=list)   # dicts, see below


def _stage_descriptions(ctx) -> list[str]:
    """S15 — one description block per (section, clause) group, then variants
    that inherit it. bill.descriptions.compose does the composing; this stage
    resolves the family key to its closing text, traces every slot to an
    evidenced attribute, scans for fabrication tokens (G+.25) and hygiene."""
    raw = _conventions_raw()
    table = ctx["clause_table"]
    base = ctx.get("base")
    gates = Gates.load()
    by_mark = {e.key: e for e in (ctx.get("elements") or [])}   # key: mark @ storey @ bay
    quantities = _sorted_quantities(list(ctx.get("quantities") or []))

    codes_missing = 0
    fallback_index: dict[str, int] = {}
    groups: list[_DescGroup] = []
    items: list[dict] = []
    substantive: list = []
    quantity_by_code: dict[str, object] = {}

    grouped: dict[tuple, list] = {}
    for q in quantities:
        grouped.setdefault((q.section, q.clause_id), []).append(q)

    for (section, clause_id), members in grouped.items():
        try:
            clause = table.get(clause_id)
        except KeyError:
            _gap(ctx, "S15", clause_id, "clause not in the ingested table; "
                 "its quantities carry no description")
            continue
        family = _family_of(section, raw)
        convention = _section_convention(section, raw)

        attributes_by_mark: dict[str, dict] = {}
        element_types: list[str] = []
        kinds = _schedule_kinds(ctx)
        printed_sizes = _schedule_sizes(ctx)
        for q in members:
            element = by_mark.get(q.element_mark)
            attrs = _element_attributes(element, base)
            if element is not None and kinds.get(element.mark):
                attrs["kind"] = kinds[element.mark]
            if element is not None and printed_sizes.get(element.mark):
                # the schedule's own words win where they say more (a sill),
                # and stand in where the size is not one width x height
                if "sill" in printed_sizes[element.mark] or "opening_size" not in attrs:
                    attrs["opening_size"] = printed_sizes[element.mark]
            attrs["clause_title"] = _clause_heading(clause.title)
            attrs["system"] = clause.title
            if ctx.get("design_standard"):
                attrs["design_standard"] = str(ctx["design_standard"])
            if family == "family_3":
                included = _verbatim_included(clause_id)
                if included:
                    attrs["deemed_included"] = included
                    attrs["components"] = included
            attributes_by_mark[q.element_mark] = attrs
            if element is not None and element.element_type not in element_types:
                element_types.append(element.element_type)

        lead_q = members[0]
        template, printed = _lead_template(
            clause, convention, family, raw, attributes_by_mark[lead_q.element_mark])
        resolved = SectionConvention(
            section, template,
            tuple(convention.varies_by) if convention else (),
            tuple(convention.required_slots) if convention else ())

        composed = descriptions_mod.compose(
            SimpleNamespace(lead=lead_q, quantities=members), resolved,
            attributes_by_mark)

        # item codes, from S13
        member_codes: list[str] = []
        for q in members:
            code = _item_code_for(ctx, q)
            if code is None:
                codes_missing += 1
                n = fallback_index.get(section, 0) + 1
                fallback_index[section] = n
                code = f"{section}-{n}"
            member_codes.append(code)
            quantity_by_code[code] = q

        element_type = element_types[0] if len(element_types) == 1 else (
            "/".join(element_types) if element_types else "item")
        lead_code = member_codes[0]
        dgroup = _DescGroup(section=section, clause_id=clause_id,
                            element_type=element_type, lead_code=lead_code,
                            lead_description=composed.lead, family=family)

        variant_by_mark = {mark: text for mark, text in composed.variants}
        for q, code in zip(members, member_codes):
            attrs = attributes_by_mark[q.element_mark]
            unevidenced = list(composed.unevidenced) if q is lead_q else []
            printed_values = [attrs.get(s) for s in printed]
            short = ", ".join(v for v in printed_values if v)
            if q is lead_q:
                row_text = composed.lead
                variant_text = None
                # a varying attribute the lead itself cannot evidence is a
                # gap whether or not the template printed it (family 3)
                for slot in (resolved.varies_by or ()):
                    if (not attrs.get(slot) and slot not in _OPTIONAL_SLOTS
                            and not attrs.get("_measured")):
                        unevidenced.append(slot)
            else:
                variant_text = variant_by_mark.get(q.element_mark, DITTO)
                # compose joins only the varying parts; a variant whose
                # varying attribute is unevidenced would read "Ditto, ".
                variant_text = variant_text.rstrip(", ").rstrip()
                for slot in (resolved.varies_by or ()):
                    if (not attrs.get(slot) and slot not in _OPTIONAL_SLOTS
                            and not attrs.get("_measured")):
                        unevidenced.append(slot)
                if variant_text == DITTO:
                    unevidenced.append("variant")
                row_text = variant_text
            unevidenced = sorted(set(unevidenced))
            for slot in unevidenced:
                _gap(ctx, "S15", code,
                     f"description slot {slot!r} has no evidenced value; "
                     f"left visible for review",
                     detail=f"clause {clause_id}, element {q.element_mark}")

            # G+.25 fabrication tokens -> AN.SUBSTANTIVE + gap
            for hit in gates.scan(row_text):
                substantive.append([code, "fabrication token in description",
                                    f"token {hit.token!r} at {hit.where}",
                                    "reword from the evidence; confidence LOW"])
                _gap(ctx, "S15", code,
                     f"G+.25 fabrication token {hit.token!r} in description",
                     detail=row_text[:160])
            for problem in violations(row_text):
                _gap(ctx, "S15", code, f"hygiene: {problem}",
                     detail=row_text[:160])

            printed_attrs = {s: attrs.get(s) for s in printed}
            items.append({
                "item_code": code, "section": section, "clause_id": clause_id,
                "element_mark": q.element_mark, "family": family,
                "description": row_text,
                "is_variant_of": None if q is lead_q else lead_code,
                "variant_text": variant_text,
                "attributes": printed_attrs,
                "unevidenced": unevidenced})
            dgroup.members.append({
                "item_code": code, "element_mark": q.element_mark,
                "unit": q.unit, "quantity": q.value,
                "evidence_ids": list(q.evidence_ids),
                "row_text": row_text,
                "lead_variant": short or clause.title,
                "is_variant_of": None if q is lead_q else lead_code})
        groups.append(dgroup)

    if codes_missing:
        _gap(ctx, "S15", "item codes",
             f"{codes_missing} quantities had no item code from the take-off; "
             f"sequential fallback codes were used")
    if substantive:
        audit = ctx.setdefault("audit", {})
        audit.setdefault("AN.SUBSTANTIVE", []).extend(substantive)

    payload = {"items": items}
    _dump(ctx["run"] / "descriptions.json", payload)
    ctx["descriptions"] = payload
    ctx["description_groups"] = groups
    ctx["quantity_by_code"] = quantity_by_code
    print(f"  S15  {len(items)} descriptions in {len(groups)} groups, "
          f"{len(substantive)} substantive")
    return ["descriptions.json"]


# ── S16 completeness ──────────────────────────────────────────────────────
def _justifications(ctx) -> dict[tuple, str]:
    """{"<evidence_kind>|<section>": "text"} from the run or the project. An
    any-of row's section label is itself "Q|R", so the split is on the first
    bar only."""
    out: dict[tuple, str] = {}
    for folder in (ctx.get("run"), ctx.get("project")):
        if not folder:
            continue
        path = Path(folder) / "AN_RECONCILIATION.json"
        if not path.exists():
            continue
        try:
            data = json.loads(path.read_text())
        except (OSError, json.JSONDecodeError) as exc:
            _gap(ctx, "S16", path.name, f"unreadable: {exc}")
            continue
        rows = data.get("justifications", data) if isinstance(data, dict) else {}
        for key, text in (rows or {}).items():
            if "|" in key and isinstance(text, str) and text.strip():
                kind, section = key.split("|", 1)
                out.setdefault((kind, section), text.strip())
    return out


def _stage_completeness(ctx) -> list[str]:
    """S16 — the gate. Evidence of a kind must produce rows of the
    corresponding kind. A FAIL blocks issue: recorded in ctx and in the
    artefact, never raised, so the run record shows the gate RAN and blocked
    rather than FAILED."""
    evidence_counts: dict[str, int] = {}
    for element in ctx.get("elements") or []:
        kind = EVIDENCE_KIND.get(element.element_type)
        if kind:
            evidence_counts[kind] = evidence_counts.get(kind, 0) + 1
    for kind, n in (ctx.get("extra_evidence_counts") or {}).items():
        evidence_counts[kind] = evidence_counts.get(kind, 0) + int(n)

    rows_by_section: dict[str, int] = {}
    for q in ctx.get("quantities") or []:
        rows_by_section[q.section] = rows_by_section.get(q.section, 0) + 1

    justifications = _justifications(ctx)
    findings = completeness_mod.check(evidence_counts, rows_by_section,
                                      justifications)
    findings += completeness_mod.unread(ctx.get("unread_schedules") or [],
                                        justifications)
    blocked = False
    try:
        completeness_mod.enforce(findings)
    except CompletenessFailure as exc:
        blocked = True
        ctx["completeness_blocked"] = True
        _gap(ctx, "S16", "completeness gate", str(exc.message),
             detail="bill.xlsx is blocked until each FAIL is justified in "
                    "AN_RECONCILIATION.json (\"<evidence_kind>|<section>\", or "
                    "\"unread_schedule|<drawing no>\" for a schedule not read), "
                    "or the schedule is read")
    ctx.setdefault("completeness_blocked", blocked)

    payload = {
        "evidence_counts": dict(sorted(evidence_counts.items())),
        "rows_by_section": dict(sorted(rows_by_section.items())),
        "findings": [{"evidence_kind": f.evidence_kind,
                      "evidence_count": f.evidence_count,
                      "section": f.section, "output_rows": f.output_rows,
                      "status": f.status, "justification": f.justification,
                      **({"reason": f.reason} if f.reason else {})}
                     for f in findings],
        "blocked": blocked,
        # what the bill covers and what it does not, by section and why
        # (CR-01 §7): a failed gate issues a PARTIAL bill that says so
        "coverage": completeness_mod.coverage(findings, rows_by_section),
        # G+.30, every check with its figures or why it did not run
        "mass_balance": completeness_mod.mass_balance(
            ctx.get("quantities"), ctx.get("elements"), ctx.get("measured_facts"))}
    _dump(ctx["run"] / "completeness.json", payload)
    ctx["completeness"] = payload
    print(f"  S16  {len(findings)} findings, "
          f"{'BLOCKED' if blocked else 'clear'}")
    return ["completeness.json"]


# ── S17 non-measured ──────────────────────────────────────────────────────
def _stage_nonmeasured(ctx) -> list[str]:
    """S17 — every section A clause as its own Bill 1 item."""
    context = {"project": str(ctx.get("project") or ""),
               "region": ctx.get("region"),
               "priced_by": ctx.get("priced_by")}
    items = build_nonmeasured(context, ctx["clause_table"])
    rows = []
    for item in items:
        for problem in violations(item.text):
            _gap(ctx, "S17", item.clause_ref, f"hygiene: {problem}",
                 detail=item.text[:160])
        rows.append({"bill": item.bill, "clause_ref": item.clause_ref,
                     "text": item.text, "unit": item.unit,
                     "value_is_commercial": item.value_is_commercial,
                     "priced_by": item.priced_by})
    payload = {"items": rows}
    _dump(ctx["run"] / "nonmeasured.json", payload)
    ctx["nonmeasured"] = payload
    print(f"  S17  {len(rows)} non-measured items, "
          f"{sum(1 for r in rows if r['value_is_commercial'])} commercial")
    return ["nonmeasured.json"]


# ── S18 price ─────────────────────────────────────────────────────────────
def _stem(word: str) -> str:
    if len(word) > 3 and word.endswith("s") and not word.endswith("ss"):
        return word[:-1]
    return word


def _key_tokens(text: str) -> list[str]:
    head = re.split(r"\s+[—–:;]\s*|[:;—–]", text or "", maxsplit=1)[0]
    words = re.findall(r"[a-z]+", head.lower())
    return sorted({_stem(w) for w in words if len(w) >= 3 and w not in _TOKEN_STOP})


def _title_head(text: str) -> str:
    return re.split(r"\s+[—–:;]\s*|[:;—–]", text or "", maxsplit=1)[0].strip()


def rate_class_for(clause, table: RateClassTable, unit: str | None
                   ) -> tuple[str, RateClass, bool]:
    """The class from the CLAUSE: a table class in the clause's section with
    the clause's unit whose label carries every key token of the clause
    title. Exactly one match is the class. None or several is UNLISTED —
    a synthetic class labelled from the clause, flagged, never a near match."""
    unit = clause.unit or unit
    tokens = _key_tokens(clause.title)
    candidates = []
    if tokens:
        for rc in table.by_section(clause.section):
            if rc.unit != unit:
                continue
            label_tokens = {_stem(w) for w in re.findall(r"[a-z]+", rc.label.lower())}
            if all(t in label_tokens for t in tokens):
                candidates.append(rc)
    if len(candidates) == 1:
        return candidates[0].rate_class, candidates[0], False
    cls = f"UNLISTED_CLASS:{clause.section}.{clause.id}"
    return cls, RateClass(cls, unit or "item", clause.section,
                          _title_head(clause.title)), True


def _search_rate(ctx, cls: str, rc: RateClass, table: RateClassTable,
                 today: date):
    """The proven sequence from agent.rate_check: build_query -> research ->
    parse_observations -> publish. The model reports observations; the code
    computes the rate. None is a gap, never a number."""
    searcher = ctx.get("searcher")
    if searcher is None:
        from core.ai import research
        searcher = research
    raw = searcher(build_query(rc, ctx.get("region"), today),
                   label=f"rate search {cls}")
    if raw is None:
        return None, "the search channel returned nothing"
    kept, rejected = parse_observations(raw, rc.unit)
    rate = publish(cls, rc.unit, kept, table, today, rejected=rejected)
    if rate is None:
        # a rejection is never silent: the reviewer sees what the search found
        # and why each finding was refused, not just that nothing survived
        from collections import Counter
        why = Counter(reason for _row, reason in rejected)
        detail = "; ".join(f"{n}x {reason}" for reason, n in
                           sorted(why.items(), key=lambda kv: (-kv[1], kv[0])))
        if kept and not rejected:
            detail = "every observation was too old or failed corroboration"
        return None, (f"{len(raw)} observation(s) reported, none usable "
                      f"({len(rejected)} rejected: {detail})" if detail else
                      f"{len(raw)} observation(s) reported, none usable")
    return rate, None


def _stage_price(ctx) -> list[str]:
    """S18 — market rates per distinct class, budgeted by class, cached per
    run. Every failure and every unpriced class is a gap."""
    table = RateClassTable.load(DATA / "rate_classes.json")
    units_raw = json.loads((DATA / "units.json").read_text())
    clause_table = ctx["clause_table"]
    by_mark = {e.key: e for e in (ctx.get("elements") or [])}   # key: mark @ storey @ bay
    today = date.today()
    no_ai = bool(ctx.get("no_ai"))

    lines: list[PriceLine] = []
    classes: dict[str, RateClass] = {}
    unlisted: dict[str, str] = {}
    row_flags: dict[str, list] = {}
    for item in (ctx.get("descriptions") or {}).get("items", []):
        code = item["item_code"]
        q = (ctx.get("quantity_by_code") or {}).get(code)
        if q is None:
            _gap(ctx, "S18", code, "description has no quantity behind it")
            continue
        try:
            clause = clause_table.get(q.clause_id)
        except KeyError:
            _gap(ctx, "S18", code, f"clause {q.clause_id} not in the table")
            continue
        cls, rc, is_unlisted = rate_class_for(clause, table, q.unit)
        classes.setdefault(cls, rc)
        if is_unlisted:
            unlisted.setdefault(cls, q.clause_id)
            row_flags.setdefault(code, []).append(
                f"UNLISTED_CLASS {cls} — no listed rate class matches clause "
                f"{q.clause_id}; searched on the clause title")
        element = by_mark.get(q.element_mark)
        lines.append(PriceLine(
            ref=code, section=q.section, rate_class=cls, unit=q.unit,
            quantity=Decimal(str(q.value)),
            item_type=element.element_type if element else None,
            description=item["description"]))

    for cls, clause_id in sorted(unlisted.items()):
        _gap(ctx, "S18", clause_id,
             f"no listed rate class for the clause; {cls} is searched on the "
             f"clause title and flagged UNLISTED_CLASS")

    budget = search_budget(lines)
    cache = ctx.setdefault("rate_cache", {})
    rates: dict = {}
    searched = 0
    ordered = sorted(classes)
    if no_ai:
        for cls in ordered:
            _gap(ctx, "S18", cls, "NO_RATE — no search with --no-ai; the class "
                                  "is a gap, not a number")
    else:
        for i, cls in enumerate(ordered, 1):
            if cls in cache:
                rate, why = cache[cls]
            else:
                print(f"  S18  rate search {i}/{budget}: {cls}", flush=True)
                rate, why = _search_rate(ctx, cls, classes[cls], table, today)
                cache[cls] = (rate, why)
                searched += 1
            if rate is None:
                _gap(ctx, "S18", cls, f"NO_RATE — {why}")
            else:
                rates[cls] = rate
                print(f"  S18    {cls}: {rate.value} {rate.currency}/{rate.unit}"
                      f"{' FLAGS ' + ', '.join(rate.flags) if rate.flags else ''}",
                      flush=True)

    rows, failures, flags = price_bill(lines, rates, units_raw, table,
                                       ctx.get("project_rates"))
    for failure in failures:
        ref, _, reason = failure.partition(": ")
        _gap(ctx, "S18", ref or "pricing", reason or failure)
    for row in rows:
        if row.is_gap:
            _gap(ctx, "S18", row.line.ref,
                 f"NO_RATE for class {row.line.rate_class}")

    out_rows = []
    for row in rows:
        extra = row_flags.get(row.line.ref, [])
        out_rows.append({
            "ref": row.line.ref, "section": row.line.section,
            "rate_class": row.line.rate_class, "unit": row.line.unit,
            "quantity": str(row.line.quantity),
            "rate": None if row.rate is None else str(row.rate),
            "amount": None if row.amount is None else str(row.amount),
            "citation": row.citation,
            "flags": list(row.flags) + extra,
            "failures": list(row.failures)})
    all_flags = list(flags) + [f"{ref}: {f}" for ref, fl in sorted(row_flags.items())
                               for f in fl]
    payload = {
        "rows": out_rows, "failures": list(failures), "flags": all_flags,
        "rates": {cls: {"value": str(r.value), "unit": r.unit,
                        "citation": r.citation(), "flags": list(r.flags)}
                  for cls, r in sorted(rates.items())},
        "searched": searched, "no_ai": no_ai}
    _dump(ctx["run"] / "priced.json", payload)
    ctx["priced"] = payload
    ctx["priced_rows"] = {r.line.ref: r for r in rows}
    print(f"  S18  {len(rows)} rows, {len(classes)} classes "
          f"({len(unlisted)} unlisted), {searched} searched, "
          f"{sum(1 for r in rows if r.is_gap)} unpriced")
    return ["priced.json"]


# ── S19 assemble ──────────────────────────────────────────────────────────
_WRAP = None


def house_wrap():
    """build_house_takeoff.wrap_lines, from render/_house first and the
    pomi_takeoff original second. Returns (wrap, source path)."""
    global _WRAP
    if _WRAP is not None:
        return _WRAP
    for path in HOUSE_BUILDER_CANDIDATES:
        if path.exists():
            spec = importlib.util.spec_from_file_location("_house_builder", path)
            module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(module)
            _WRAP = (module.wrap_lines, str(path))
            return _WRAP
    raise RuntimeError("build_house_takeoff.py not found in render/_house or "
                       "the pomi_takeoff scripts folder — the page packer "
                       "cannot count rows without its wrap_lines")


def _line_dict(placed, line: BillLine, ref: str, is_variant_of, clause_id,
               evidence_ids, rate_source) -> dict:
    return {"ref": ref, "item_letter": placed.item_letter,
            "page": placed.page_ref, "description": line.description,
            "quantity": None if line.quantity is None else str(line.quantity),
            "unit": line.unit,
            "rate": None if line.rate is None else str(line.rate),
            "rate_source": rate_source, "clause_id": clause_id,
            "evidence_ids": list(evidence_ids), "is_variant_of": is_variant_of}


def _stage_assemble(ctx) -> list[str]:
    """S19 — sections in POMI order, pages packed to the house builder's row
    arithmetic, letters per page, totals reconciled, the house spec merged
    with the take-off's measurement blocks."""
    wrap, wrap_source = house_wrap()
    priced_rows = ctx.get("priced_rows") or {}
    from readers.project_identity import heading_of
    head = heading_of(ctx)            # owner / job title / plot, else the folder name
    project_name = head["project"] or None

    assembly: list[AssemblyLine] = []
    for group in ctx.get("description_groups") or []:
        for m in group.members:
            priced = priced_rows.get(m["item_code"])
            rate = priced.rate if priced is not None else None
            rate_source = priced.citation if priced is not None else None
            record = BillLine(
                section=group.section, item_letter=None,
                description=m["row_text"], quantity=Decimal(str(m["quantity"])),
                unit=m["unit"], rate=rate, rate_source=rate_source,
                clause_id=group.clause_id, evidence_ids=tuple(m["evidence_ids"]),
                is_variant_of=m["is_variant_of"])
            assembly.append(AssemblyLine(
                line=record, ref=m["item_code"], element_type=group.element_type,
                lead_description=group.lead_description,
                variant=m["lead_variant"] if m["is_variant_of"] is None
                else m["row_text"],
                group_key=(group.section, group.clause_id),
                rate_source=rate_source))

    sections = assemble(assembly, ctx.get("config"), wrap=wrap, bill=2)

    # the take-off's measurement blocks, by section
    measurement_path = Path(ctx["run"]) / "house_measurement.json"
    measurement: dict = {}
    if measurement_path.exists():
        try:
            measurement = json.loads(measurement_path.read_text())
        except (OSError, json.JSONDecodeError) as exc:
            _gap(ctx, "S19", measurement_path.name, f"unreadable: {exc}")
    else:
        _gap(ctx, "S19", "house_measurement.json",
             "not written by the take-off stage; house specs carry no "
             "measurement blocks")

    out_sections = []
    house_specs = {}
    summary = []
    for section in sections:
        by_ref = {}
        lines_out = []
        for placed in section.lines:
            a = placed.line
            by_ref[a.ref] = placed
            lines_out.append(_line_dict(
                placed, a.line, a.ref, a.line.is_variant_of, a.line.clause_id,
                a.line.evidence_ids, a.rate_source))
        mismatch = reconcile(section)
        if mismatch:
            _gap(ctx, "S19", section.letter, f"section total does not "
                                              f"reconcile: {mismatch}")
        for page in section.pages:
            if page.rows > 45:
                _gap(ctx, "S19", page.reference,
                     f"page packs {page.rows} rows; the house body allows 45")
            if page.entries and page.entries[-1].get("kind") == "heading":
                _gap(ctx, "S19", page.reference, "page ends on a heading")
        out_sections.append({
            "letter": section.letter, "title": section.title,
            "pomi_section_title": section.title,
            "section_no": section.section_no,
            "lines": lines_out,
            "pages": [{"reference": p.reference, "item_count": p.item_count}
                      for p in section.pages],
            "last_page_ref": section.last_page_ref,
            "total": str(section.total)})
        summary.append({"section": section.letter,
                        "last_page_ref": section.last_page_ref})

        blocks = []
        for block in (measurement.get(section.letter) or {}).get("measurement", []):
            block = dict(block)
            placed = by_ref.get(block.get("item_key"))
            if placed is not None:
                block["item_ref"] = placed.item_letter
                block["boq_page"] = placed.page_ref
            blocks.append(block)
        house_specs[section.letter] = {
            "section_letter": section.letter, "section_title": section.title,
            "pomi_section_title": section.title, "bill_no": 2,
            "section_no": section.section_no, "summary_ref": "S1",
            "sheet_name": f"Section {section.letter}",
            "project": project_name, "client": head["client"],
            "package": head["package"], "building": head["building"],
            "trade": section.title,
            "measurement": blocks,
            "boq_pages": [{"entries": [dict(e) for e in p.entries]}
                          for p in section.pages]}

    # Bill 1 — the non-measured items, each its own lettered row, two-part
    # page codes because the bill has no POMI section of its own.
    nm_lines: list[AssemblyLine] = []
    for item in (ctx.get("nonmeasured") or {}).get("items", []):
        record = BillLine(section="A", item_letter=None, description=item["text"],
                          quantity=Decimal(1), unit="item", rate=None,
                          rate_source=None, clause_id=item["clause_ref"],
                          evidence_ids=(), is_variant_of=None)
        # lead_description "" -> the packer counts these as plain items
        nm_lines.append(AssemblyLine(
            line=record, ref=item["clause_ref"], element_type="preliminaries",
            lead_description="", variant=item["text"],
            group_key=("A", "preliminaries")))
    nonmeasured_out = []
    if nm_lines:
        from bill.assemble import group_lines
        pages = pack_groups(group_lines(nm_lines), wrap, bill=1, section_no=0)
        for page in pages:
            for placed in page.placed:
                a = placed.line
                row = _line_dict(placed, a.line, a.ref, None, a.line.clause_id,
                                 (), None)
                row["bill"] = 1
                row["value_is_commercial"] = next(
                    (i["value_is_commercial"]
                     for i in ctx["nonmeasured"]["items"]
                     if i["clause_ref"] == a.ref), False)
                nonmeasured_out.append(row)

    payload = {"bill_no": 2, "project": project_name,
               "sections": out_sections, "nonmeasured": nonmeasured_out,
               "house_specs": house_specs, "summary": summary}
    _dump(ctx["run"] / "bill.json", payload)
    ctx["bill"] = payload
    ctx["bill_sections"] = sections
    print(f"  S19  {len(out_sections)} sections, "
          f"{sum(len(s['pages']) for s in out_sections)} pages, "
          f"{len(nonmeasured_out)} bill-1 items; wrap from {wrap_source}")
    return ["bill.json"]


__all__ = ["_stage_descriptions", "_stage_completeness", "_stage_nonmeasured",
           "_stage_price", "_stage_assemble", "rate_class_for", "house_wrap"]
