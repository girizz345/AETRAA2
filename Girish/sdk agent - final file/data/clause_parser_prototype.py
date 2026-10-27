"""PROTOTYPE — not part of the pipeline.

The parser that produced data/clauses.json, kept so the extraction can be
reproduced and audited. It reads a text dump of the corpus; it is not
imported by any stage and running it needs that dump beside it.

    python3 data/clause_parser_prototype.py formulae.txt
"""
import sys
SOURCE = sys.argv[1] if len(sys.argv) > 1 else "formulae.txt"

def main():
    
    import json, re, sys
    from pathlib import Path
    
    text = Path(SOURCE).read_text(encoding="utf-8")
    
    # strip the running header / page-number furniture the PDF carries
    text = re.sub(r"^AETRAA POMI Take-off — the complete prompt set\s+\d+\s*$", "",
                  text, flags=re.M)
    text = re.sub(r"^\s*\d{1,3}\s*$", "", text, flags=re.M)
    
    lines = text.split("\n")
    
    RE_SECTION = re.compile(r"^SECTION ([A-Z]{1,2}) — (.+?)\s*$")
    RE_COUNTS  = re.compile(r"^(\d+) groups · (\d+) clauses · (\d+) carrying arithmetic")
    RE_GROUP   = re.compile(r"^([A-Z]{1,2}\d+)\s+(\S.*)$")
    RE_CLAUSE  = re.compile(r"^([A-Z]{1,2}\d+\.\d+)\s*$")
    RE_UNIT    = re.compile(r"^Unit:\s*(.+?)\s*$")
    RE_PRACT   = re.compile(r"^In practice\.\s*(.*)$")
    
    sections, clauses = {}, []
    cur_sec = cur_grp = None
    i = 0
    while i < len(lines):
        line = lines[i]
        m = RE_SECTION.match(line)
        if m:
            cur_sec = m.group(1); sections[cur_sec] = {"title": m.group(2)}
            i += 1; continue
        m = RE_COUNTS.match(line.strip())
        if m and cur_sec:
            sections[cur_sec].update(groups=int(m.group(1)), clauses=int(m.group(2)),
                                     arithmetic=int(m.group(3)))
            i += 1; continue
        m = RE_CLAUSE.match(line.strip())
        if m and cur_sec:
            cid = m.group(1)
            body, unit, formula, practice = [], None, None, None
            j = i + 1
            while j < len(lines):
                nxt = lines[j]
                if RE_CLAUSE.match(nxt.strip()) or RE_SECTION.match(nxt) or \
                   (RE_GROUP.match(nxt) and not nxt.startswith(" ")):
                    break
                u = RE_UNIT.match(nxt)
                if u:
                    unit = u.group(1)
                    # the formula, when present, is the next non-blank line
                    # before "In practice."
                    k = j + 1
                    while k < len(lines) and not lines[k].strip():
                        k += 1
                    if k < len(lines) and not RE_PRACT.match(lines[k].strip()) \
                       and lines[k].strip():
                        formula = lines[k].strip()
                    j += 1; continue
                p = RE_PRACT.match(nxt.strip())
                if p:
                    practice = p.group(1); j += 1; continue
                if unit is None and nxt.strip():
                    body.append(nxt.strip())
                j += 1
            clauses.append({"id": cid, "section": cur_sec, "group": cid.split(".")[0],
                            "text": " ".join(body), "unit_raw": unit,
                            "formula_raw": formula, "in_practice": practice})
            i = j; continue
        m = RE_GROUP.match(line)
        if m and cur_sec and not line.startswith(" "):
            cur_grp = m.group(1)
        i += 1
    
    # --- verify against the counts the document states about itself -------------
    print(f"clauses parsed              : {len(clauses)}")
    print(f"sections parsed             : {len(sections)}")
    stated_c = sum(s.get('clauses', 0) for s in sections.values())
    stated_a = sum(s.get('arithmetic', 0) for s in sections.values())
    stated_g = sum(s.get('groups', 0) for s in sections.values())
    print(f"clauses stated in headers   : {stated_c}")
    print(f"groups  stated in headers   : {stated_g}")
    print(f"arithmetic stated in headers: {stated_a}")
    with_f = [c for c in clauses if c['formula_raw']]
    print(f"clauses with a formula found: {len(with_f)}")
    print(f"clauses with a unit found   : {len([c for c in clauses if c['unit_raw']])}")
    print()
    print("per-section: parsed / stated / formulas found / stated arithmetic")
    for sec in sorted(sections):
        got = [c for c in clauses if c['section'] == sec]
        gotf = len([c for c in got if c['formula_raw']])
        s = sections[sec]
        flag = "" if len(got) == s.get('clauses') else "   <-- MISMATCH"
        print(f"  {sec:<3} {len(got):>4} / {s.get('clauses'):>4}   "
              f"{gotf:>4} / {s.get('arithmetic'):>4}{flag}")
    
    Path("clauses_proto.json").write_text(json.dumps(
        {"schema": "clauses/proto", "clauses": clauses}, indent=1))
    


if __name__ == "__main__":
    main()
