#!/usr/bin/env python3
"""
project_identity.py — who and what the bill is for, as the title blocks state it.

A house bill is headed with the employer, the project and the package (the
four-line band: client | project | package | building). The drawings state
them in every title block - OWNER, JOB TITLE, PLOT NO. - and the folder the
drawings arrive in rarely does: the Coventry Residence 3 package came in a
folder called "Test Drawigs", and every bill page said so.

Read per sheet - from the text layer where the block is text, from the saved
or live reading where the block is drawn - then voted across the package. A
value most sheets do not agree on is not used; the folder name stands in for
the project and a gap says so. Decision 2, confirmed by Ajay 28-09-2026.

  python3 -m readers.project_identity <pdf>
"""
from __future__ import annotations

import argparse
import re
from collections import Counter

FIELDS = ("owner", "job_title", "plot")

# a label as it opens its line in the block: "OWNER :", "JOB TITLE :",
# "PLOT NO. / PARCEL ID". JOB NO is a job number, not the job's name.
LABELS = {
    "owner": re.compile(r"^(?:OWNER|CLIENT|EMPLOYER)\b\s*:?", re.I),
    "job_title": re.compile(r"^(?:JOB\s+TITLE|PROJECT\s+(?:TITLE|NAME)|PROJECT)\b\s*:?", re.I),
    "plot": re.compile(r"^PLOT\s*(?:NO\.?|NUMBER|NUM\.?)\b", re.I),
}
ANY_LABEL = re.compile(r"^(?:[A-Z./ ]{2,30}:|DRAWING\b|DRAWN\b|CHECKED\b|SCALE\b|DATE\b|"
                       r"REV\w*\b|ARCHITECT\b|CONSULTANT\b|BLOCK\b|JOB\s+NO\b)", re.I)
PLOT_VALUE = re.compile(r"^\d{4,10}$")
MARGIN = 0.22           # the block lies in the sheet's right or bottom 22%


def _lines(words) -> list[list]:
    """Words into lines: one line per run of words sharing a baseline band."""
    out: list[list] = []
    for w in sorted(words, key=lambda w: (w.y0, w.x0)):
        h = max(w.y1 - w.y0, 0.1)
        for line in out:
            if abs(line[0].y0 - w.y0) <= 0.5 * h:
                line.append(w)
                break
        else:
            out.append([w])
    return [sorted(line, key=lambda w: w.x0) for line in out]


def _text(words) -> str:
    return " ".join(" ".join(w.text for w in words).split())


def from_words(words, width: float, height: float) -> dict:
    """{owner, job_title, plot} this sheet's block states in its text layer;
    a field it does not state is left out."""
    zone = [w for w in words if w.x0 >= (1 - MARGIN) * width or w.y0 >= (1 - MARGIN) * height]
    lines = _lines(zone)
    out: dict = {}
    for i, line in enumerate(lines):
        for j in range(len(line)):
            head = _text(line[j:j + 5])
            for field, rx in LABELS.items():
                m = rx.match(head)
                if field in out or not m or (field == "job_title" and re.match(r"^JOB\s+NO", head, re.I)):
                    continue
                label = line[j]
                after = [w for w in line[j + 1:] if w.x0 > label.x0]
                taken = len(m.group(0).replace(":", " ").split())
                colon = next((k for k, w in enumerate(after[:taken + 2]) if w.text.endswith(":")), None)
                if colon is None and any(w.text.endswith(":") for w in line[j:j + taken]):
                    colon = taken - 2          # the colon closes the label word: "PROJECT:"
                # a label opens its line, or is followed by its colon: "OWNER COST"
                # in a note is not the OWNER label
                if j > 0 and colon is None:
                    continue
                h = max(label.y1 - label.y0, 0.1)
                # the column the value sits in: from the label to the next label on its line
                rest = after[(colon + 1) if colon is not None else taken - 1:]
                nxt = next((w.x0 for w in rest if ANY_LABEL.match(w.text) or w.text.endswith(":")),
                           None)
                x_lo, x_hi = label.x0 - 3 * h, (nxt - 1) if nxt else label.x0 + 40 * h
                values = []
                # a value on the label's own line only after its colon ("PLOT NO. /
                # PARCEL ID" is all label, and its value is on the line beneath)
                inline = [w for w in rest if w.x0 < x_hi] if colon is not None else []
                # and only as far as its own cell: a wide gap is the next column
                # of the block ("... EXTENSION      SHEET TITLE: ...")
                for k in range(1, len(inline)):
                    if inline[k].x0 - inline[k - 1].x1 > 2.5 * h:
                        inline = inline[:k]
                        break
                if inline and not ANY_LABEL.match(inline[0].text):
                    values.append(inline)
                bottom = max(w.y1 for w in line)
                for below in lines[i + 1:i + 4]:
                    if below[0].y0 - bottom > 3.5 * h or len(values) >= (2 if field == "job_title" else 1):
                        break
                    part = [w for w in below if x_lo <= w.x0 < x_hi]
                    if not part:
                        continue
                    if ANY_LABEL.match(part[0].text) or any(LABELS[f].match(_text(part)) for f in LABELS):
                        break
                    values.append(part)
                    bottom = max(w.y1 for w in below)
                if not values:
                    continue
                if field == "plot":
                    value = next((w.text for part in values for w in part if PLOT_VALUE.match(w.text)), None)
                else:
                    value = _text([w for part in values for w in part])
                if value:
                    out[field] = value
    return out


def from_reading(reading: dict | None) -> dict:
    """The same fields from a title-block reading (readers.transcribe)."""
    if not reading:
        return {}
    got = {"owner": reading.get("owner"), "job_title": reading.get("job_title"),
           "plot": reading.get("plot")}
    return {k: " ".join(str(v).split()) for k, v in got.items() if v and str(v).strip()}


def _key(value: str) -> str:
    """Two spellings of one value meet: case, full stops, brackets and word
    order aside ("PROPOSED B+G+5+ROOF RESIDENTIAL BUILDING" on the cover is
    the job the other sheets call "PROPOSED RESIDENTIAL BUILDING (B+G+5+ROOF)")."""
    return " ".join(sorted(re.sub(r"[.()\[\]]+", " ", value.upper()).split()))


def vote(per_sheet: list[dict], min_sheets: int = 2, share: float = 0.6) -> dict:
    """per_sheet: {doc_id, owner?, job_title?, plot?} per sheet. {field: value}
    where at least `min_sheets` sheets and `share` of the sheets stating the
    field agree; {field: [agreeing, stating]} under 'support'; the fields left
    out, with why, under 'refused'; and under 'dissent' every other value a
    field was given by at least `min_sheets` sheets, with those sheets - on this
    package the twelve plumbing sheets name another plot and building."""
    out: dict = {"support": {}, "refused": {}, "dissent": {}}
    for field in FIELDS:
        stated = [(r.get("doc_id"), r[field]) for r in per_sheet if r.get(field)]
        if not stated:
            continue
        counts = Counter(_key(v) for _d, v in stated)
        best, n = counts.most_common(1)[0]
        out["support"][field] = [n, len(stated)]
        if n >= min_sheets and n >= share * len(stated):
            # written as most of the agreeing sheets print it
            out[field] = Counter(" ".join(v.split()) for _d, v in stated
                                 if _key(v) == best).most_common(1)[0][0]
        else:
            out["refused"][field] = (f"{len(counts)} different values on {len(stated)} sheets, "
                                     f"the commonest on {n}")
        others = [(k, c) for k, c in counts.most_common() if k != best and c >= min_sheets]
        if others:
            out["dissent"][field] = [
                {"value": next(v for _d, v in stated if _key(v) == k),
                 "sheets": sorted(str(d) for d, v in stated if _key(v) == k)}
                for k, _c in others]
    return out


def heading(identity: dict | None, folder_name: str) -> dict:
    """The bill's head band and the name its files carry. The house band is
    client | project | package | building: the owner, the job title, the plot.
    Without an agreed job title the folder name stands in, as before."""
    identity = identity or {}
    project = identity.get("job_title") or folder_name
    plot = identity.get("plot")
    return {"client": identity.get("owner") or "",
            "project": project,
            "package": f"PLOT NO. {plot}" if plot else "",
            "building": "",
            "label": " ".join(p for p in (plot, project) if p) if identity.get("job_title") else folder_name,
            "basis": "title blocks" if identity.get("job_title") else "folder name"}


def heading_of(ctx) -> dict:
    """The heading stage 1 settled, or - for a run or test that did not run
    stage 1 - the folder name, as the bill was headed before."""
    from pathlib import Path
    folder = Path(ctx["project"]).name if ctx.get("project") else ""
    return ctx.get("heading") or heading(None, folder)


FIELD_WORDS = {"owner": "owner", "job_title": "job title", "plot": "plot number"}


def main() -> int:
    ap = argparse.ArgumentParser(description="What one sheet's title block says the project is.")
    ap.add_argument("pdf")
    args = ap.parse_args()
    from readers.extract import extract_words, page_display_size, _open
    doc = _open(args.pdf)
    try:
        w, h = page_display_size(doc[0])
    finally:
        doc.close()
    print(from_words(extract_words(args.pdf, 0), w, h))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
