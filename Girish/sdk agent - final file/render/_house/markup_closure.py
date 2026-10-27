#!/usr/bin/env python3
"""
markup_closure.py — the S1 closure gate.

A markup that cannot disagree with the take-off is decoration. This script is what
lets it disagree: it re-derives the quantity from the marked geometry alone —
shoelace area, polyline length, tag count — converts it with the sheet's
CALIBRATED scale, and tests it against the measured quantity at the determinism
tolerances.

  AREA    unit m2   shoelace / scale^2                 K42  +/-1%
  AREA    unit m3   (shoelace / scale^2) x thickness   K42  +/-1%
  LINEAR  unit m    sum of segments / scale            K43  +/-1%
  TAG     unit nr   count of points                    K18  exact equality

Where the measurer declared TYPE / ZONE x TIMESING, closure is on ONE instance
multiplied by the stated timesing — the script is testing the type, not the
building.

  python3 markup_closure.py <closure_spec.json> [--out result.json]

Exit 0 = every item CLOSED. Exit 1 = at least one MARKUP_MISMATCH; the batch does
not close and the comment goes back to the measurer through C2.

Spec shape:
{
  "run_id": "...", "batch": 1,
  "scale": { "units_per_metre": 14.101 },          // default, PDF points per metre
  "scales": { "S-02-002": 14.101 },                // optional per-sheet override
  "items": [
    { "item_id": "B1-A", "unit": "m2", "primitive": "AREA",
      "measured_qty": 1152.03,
      "stated_thickness_m": null,                  // required when unit is m3
      "timesing_factor": null,                     // one-instance closure when set
      "regions": [ { "sheet": "S-02-002", "source_geometry_id": "poly_site",
                     "kind": "polygon", "points": [[222,222],[660,222]] } ] }
  ]
}
"""
import sys, json, math, argparse
from pathlib import Path

# --- determinism constants. Changed in determinism.md, never here. ------------
K42 = 0.01          # area / volume closure agreement
K43 = 0.01          # linear closure agreement
K18 = 0             # tag closure — exact equality
K45 = {"AREA": 3, "LINEAR": 2, "TAG": 1}     # minimum region vertices
K20 = 2             # measured decimal places

TOL = {"AREA": ("K42", K42), "LINEAR": ("K43", K43), "TAG": ("K18", K18)}


def shoelace(pts):
    """Polygon area in square source units. Sign-independent; the winding
    direction of an extracted polygon is not a measurement."""
    a = 0.0
    n = len(pts)
    for i in range(n):
        x1, y1 = pts[i]
        x2, y2 = pts[(i + 1) % n]
        a += x1 * y2 - x2 * y1
    return abs(a) / 2.0


def polylength(pts):
    return sum(math.dist(pts[i], pts[i + 1]) for i in range(len(pts) - 1))


def close_item(item, scales, default_scale):
    prim = item["primitive"]
    unit = item.get("unit", "")
    regions = item.get("regions", [])
    fails = []

    if prim == "LEDGER_ONLY":
        return {"result": "NO_EVIDENCE_POSSIBLE", "closed_qty": None,
                "variance_pct": None, "tolerance": None,
                "note": "prelim / PC sum — listed, not spotted"}

    if not regions:
        return {"result": "MARKUP_MISMATCH", "closed_qty": None,
                "variance_pct": None, "tolerance": TOL[prim][0],
                "note": "no region supplied — an item with a quantity and no "
                        "geometry cannot be evidenced"}

    # every region must carry the source it was transcribed from
    for r in regions:
        if not r.get("source_geometry_id"):
            fails.append("a region carries no source_geometry_id — it cannot be "
                         "re-derived and is not admissible")
        if len(r.get("points", [])) < K45[prim]:
            fails.append(f"a region has fewer than K45 vertices for {prim}")
    if fails:
        return {"result": "MARKUP_MISMATCH", "closed_qty": None,
                "variance_pct": None, "tolerance": TOL[prim][0],
                "note": "; ".join(fails)}

    if prim == "TAG":
        closed = float(sum(len(r["points"]) for r in regions))
    else:
        total = 0.0
        for r in regions:
            sheet = r.get("sheet")
            s = scales.get(sheet, default_scale)
            if not s:
                return {"result": "MARKUP_MISMATCH", "closed_qty": None,
                        "variance_pct": None, "tolerance": TOL[prim][0],
                        "note": f"no calibrated scale for sheet {sheet} — a "
                                f"typed scale is not permitted (§11.6)"}
            pts = r["points"]
            total += shoelace(pts) / (s * s) if prim == "AREA" \
                else polylength(pts) / s
        closed = total
        if unit == "m3":
            t = item.get("stated_thickness_m")
            if t in (None, 0):
                return {"result": "MARKUP_MISMATCH", "closed_qty": None,
                        "variance_pct": None, "tolerance": "K42",
                        "note": "a volume closes as area x the thickness STATED "
                                "in the description; none was supplied"}
            closed *= float(t)

    tf = item.get("timesing_factor")
    if tf:
        closed *= float(tf)

    measured = float(item["measured_qty"])
    name, tol = TOL[prim]

    if prim == "TAG":
        ok = (closed == measured)
        var = 0.0 if ok else (closed - measured)
    else:
        var = ((closed - measured) / measured * 100.0) if measured else \
              (0.0 if closed == 0 else 100.0)
        ok = abs(var) <= tol * 100.0

    return {"result": "CLOSED" if ok else "MARKUP_MISMATCH",
            "closed_qty": round(closed, K20),
            "variance_pct": round(var, 3),
            "tolerance": name,
            "regions_used": [r.get("source_geometry_id") for r in regions],
            "note": ""}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("spec")
    ap.add_argument("--out")
    a = ap.parse_args()

    spec = json.load(open(a.spec))
    default_scale = (spec.get("scale") or {}).get("units_per_metre")
    scales = spec.get("scales", {})

    out, mismatches = [], []
    for item in spec["items"]:
        r = close_item(item, scales, default_scale)
        r["item_id"] = item["item_id"]
        r["measured_qty"] = item.get("measured_qty")
        r["primitive"] = item["primitive"]
        out.append(r)
        if r["result"] == "MARKUP_MISMATCH":
            mismatches.append(r)

    payload = {"run_id": spec.get("run_id"), "batch": spec.get("batch"),
               "closures": out,
               "summary": {"items": len(out),
                           "closed": sum(1 for r in out if r["result"] == "CLOSED"),
                           "mismatched": len(mismatches),
                           "no_evidence_possible":
                               sum(1 for r in out
                                   if r["result"] == "NO_EVIDENCE_POSSIBLE")}}
    if a.out:
        Path(a.out).write_text(json.dumps(payload, indent=1))

    for r in out:
        if r["result"] == "CLOSED":
            print(f"  CLOSED             {r['item_id']:<12} "
                  f"{r['measured_qty']:>12,.2f} vs {r['closed_qty']:>12,.2f}  "
                  f"{r['variance_pct']:+.3f}%  [{r['tolerance']}]")
        elif r["result"] == "NO_EVIDENCE_POSSIBLE":
            print(f"  LEDGER ONLY        {r['item_id']:<12} {r['note']}")
        else:
            cq = "—" if r["closed_qty"] is None else f"{r['closed_qty']:,.2f}"
            vp = "" if r["variance_pct"] is None else f"{r['variance_pct']:+.3f}%"
            print(f"  MARKUP_MISMATCH    {r['item_id']:<12} "
                  f"measured {r['measured_qty']:,.2f}  closed {cq}  {vp}"
                  f"  {r['note']}")

    s = payload["summary"]
    if mismatches:
        print(f"\nCLOSURE GATE FAILED — {s['mismatched']} of {s['items']} items "
              f"do not close.\nThe batch does not close. Each mismatch is a "
              f"comment to the measurer via C2.\nS1 states both figures and the "
              f"variance. It does not say which one is right.")
        sys.exit(1)
    print(f"\nClosure gate passed: {s['closed']} closed, "
          f"{s['no_evidence_possible']} ledger-only, 0 mismatched.")


if __name__ == "__main__":
    main()
