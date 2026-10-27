#!/usr/bin/env python3
"""
schema.py — every model response is validated before anything reads it.

Not after. A response that has been parsed, partially consumed and then found
invalid has already influenced a decision somewhere, and unpicking that is
harder than refusing it at the boundary.

The schemas are deliberately narrow. Each declares a closed enum or a set of
identifiers that must already exist, so an invalid response is one that names
something the pipeline does not have — an unknown sheet kind, a clause not in
the table, an evidence id not in the base. That is a much stronger check than
"is this JSON".

And every schema FORBIDS a quantity field. If a response carries a number where
only a label was permitted, the run halts rather than continuing with the rest
of that response: a model producing numbers in one place is not trustworthy in
the others.

  python3 -m model.schema --list

Exit 0 always.
"""
from __future__ import annotations

import argparse

from readers.route import KINDS as SHEET_KINDS
from spine.errors import ModelSuppliedNumber

FORBIDDEN_KEYS = ("qty", "quantity", "value", "amount", "rate", "total",
                  "area", "volume", "length_m")

SCHEMAS: dict[str, dict] = {
    "sheet_kind": {
        # batched: the ambiguous sheets of one package in one call
        "required": ("items",),
        "item_required": ("doc_id", "kind"),
        # the router's own list, not a copy of it: a copy drifted, lacked
        # "general", and one model answer of "general" stopped S5 on a
        # 385-sheet run (CR-01 D1)
        "item_enums": {"kind": SHEET_KINDS},
        "enums": {},
    },
    "column_mapping": {
        "required": ("doc_id", "header_row", "columns"),
        "enums": {},
    },
    "legend_entry": {
        "required": ("doc_id", "entries"),
        "enums": {},
    },
    "classification": {
        # batched: one call answers a family of elements. Each item carries the
        # per-element keys; the client wraps a bare array as {"items": [...]}.
        "required": ("items",),
        "item_required": ("element_mark", "clause_id", "bindings"),
        "enums": {},
    },
    "description_block": {
        "required": ("group_key", "lead", "variants"),
        "enums": {},
    },
    "title_block": {
        "required": ("doc_id", "fields"),
        "enums": {},
    },
    # the seventh judgement: what a schedule schedules, when neither its
    # title, its heading nor its name says. A label from the closed set of
    # element types; batched per package.
    "schedule_subject": {
        "required": ("items",),
        "item_required": ("doc_id", "subject"),
        "enums": {},
    },
    # the eighth judgement: which storey of the level table a schedule's
    # location string names, when normalise_storey cannot tell ("Pod 1",
    # "L3"). A label from the table's own keys; batched per run. The caller
    # (measure.levels.apply_aliases) drops any answer outside those keys.
    "level_alias": {
        "required": ("items",),
        "item_required": ("location", "storey"),
        "enums": {},
    },
    # the ninth judgement: which storey a level FIGURE on a section sheet
    # belongs to, when no storey phrase sits on its text band. The figure was
    # read by code and is referred to by an id, never echoed; the model
    # returns the storey label only.
    "level_name": {
        "required": ("items",),
        "item_required": ("level_id", "storey"),
        "enums": {},
    },
}


class SchemaInvalid(ValueError):
    """Retryable — the one condition that earns another call."""


def validate(name: str, payload: dict) -> dict:
    """Returns the payload if sound. Raises SchemaInvalid (retry) or
    ModelSuppliedNumber (halt)."""
    if name not in SCHEMAS:
        raise KeyError(f"no schema named {name}")
    spec = SCHEMAS[name]
    if not isinstance(payload, dict):
        raise SchemaInvalid(f"{name} response is not a JSON object")
    _scan_forbidden(name, payload)
    missing = [k for k in spec["required"] if k not in payload]
    if missing:
        raise SchemaInvalid(f"{name} missing {', '.join(sorted(missing))}")
    for field, allowed in sorted(spec["enums"].items()):
        if payload.get(field) not in allowed:
            raise SchemaInvalid(
                f"{name}.{field} = {payload.get(field)!r}, not in {allowed}")
    item_keys = spec.get("item_required")
    if item_keys:
        items = payload.get("items")
        if not isinstance(items, list):
            raise SchemaInvalid(f"{name}.items is not a list")
        # A batched answer is one answer PER ITEM. An item labelled outside
        # the enum is dropped and named under "_off_enum" - the caller finds
        # that item absent and records its gap - rather than failing the
        # batch: one stray label in forty stopped a 385-sheet run (CR-01 D1).
        kept, off = [], []
        for n, item in enumerate(items):
            bad = next(((f, item.get(f)) for f, allowed in
                        sorted(spec.get("item_enums", {}).items())
                        if isinstance(item, dict) and item.get(f) not in allowed), None)
            if bad is None:
                kept.append(item)
            else:
                off.append(f"items[{n}].{bad[0]} = {bad[1]!r}")
        if off:
            payload["items"] = items = kept
            payload["_off_enum"] = off
        for n, item in enumerate(items):
            if not isinstance(item, dict):
                raise SchemaInvalid(f"{name}.items[{n}] is not an object")
            # `ref` is what core.ai's parser gives an object keyed by mark
            if "element_mark" not in item and "ref" in item:
                item["element_mark"] = item["ref"]
            missing = [k for k in item_keys if k not in item]
            if missing:
                raise SchemaInvalid(
                    f"{name}.items[{n}] missing {', '.join(sorted(missing))}")
            for field, allowed in sorted(spec.get("item_enums", {}).items()):
                if item.get(field) not in allowed:
                    raise SchemaInvalid(
                        f"{name}.items[{n}].{field} = {item.get(field)!r}, "
                        f"not in {allowed}")
    return payload


def _scan_forbidden(name: str, node, path: str = "") -> None:
    """Every key at every depth. A number hidden inside a binding is still a
    number the model produced."""
    if isinstance(node, dict):
        for key in sorted(node):
            if str(key).lower() in FORBIDDEN_KEYS:
                raise ModelSuppliedNumber(
                    f"{name} response carried {path + str(key)!r}; only labels "
                    "are permitted")
            _scan_forbidden(name, node[key], f"{path}{key}.")
    elif isinstance(node, list):
        for n, child in enumerate(node):
            _scan_forbidden(name, child, f"{path}[{n}].")


def main() -> int:
    ap = argparse.ArgumentParser(description="List the response schemas.")
    ap.add_argument("--list", action="store_true")
    ap.parse_args()
    for name in sorted(SCHEMAS):
        print(f"  {name:<20} requires {', '.join(SCHEMAS[name]['required'])}")
    print(f"\nforbidden in every schema: {', '.join(FORBIDDEN_KEYS)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
