# Title Block Patterns — UAE Conventions

Standard patterns to detect in drawing title blocks and subtitles for R36 floor multiplier application.

## Standard title block locations

UAE drawings typically place the title block in one of:
- Lower-right corner (most common)
- Lower-left (some HoK/Killa/Atkins conventions)
- Right strip (Aedas, Pickard Chilton variants)

## Required fields

For every drawing, extract:

| Field | Typical regex / pattern |
|-------|-------------------------|
| Drawing Number | `[A-Z]+-?\d{2,4}` (e.g., A-101, S-302, P-103, MD-001) |
| Drawing Title | usually largest text in title block |
| Subtitle / Scope | text immediately below drawing title (CRITICAL for floor multiplier) |
| Scale | `1:\d+` or `AS NOTED` |
| Revision | `R\d{2}` or `IFC-?\d{2}` or `T\d{2}` |
| Issue Date | various date formats |
| Discipline tag | usually first prefix letter(s): A, S, P, M, E, F, MD |
| Sheet Number | `\d+\s*OF\s*\d+` |
| Project Name | usually top of title block |

## Floor multiplier patterns

### Explicit range (multiplier = count in range)

```
"Typical Floor 3 to 9"          → 7 floors
"TYP. FL. L3 to L9"             → 7 floors
"FLOOR 3 TO 9 (TYPICAL)"        → 7 floors
"REPEAT FOR FLOORS 3 TO 9"      → 7 floors
"FL3 - FL9"                     → 7 floors
"L3 to L9 typ."                 → 7 floors
"TYPICAL 3RD-9TH FLOORS"        → 7 floors
```

### Discrete list (multiplier = count of listed floors)

```
"FLOORS 3, 5, 7 TYPICAL"        → 3 floors
"FL 3 / 5 / 7 / 9"              → 4 floors
"L1, L4, L7"                    → 3 floors
```

### All floors (multiplier = total floor count from section)

```
"ALL FLOORS"                    → N (derive from section)
"ALL TYPICAL FLOORS"            → N (derive from section)
"GROUND TO ROOF TYPICAL"        → N (derive from section)
"FLOOR PLAN ALL LEVELS"         → N (derive from section)
"FROM L1 TO ROOF"               → N (count from section)
```

If section drawing not uploaded, HALT and prompt user.

### Single floor (multiplier = 1)

```
"FLOOR 3"           "L3"            "FF" (first floor)
"GF" (ground)       "BASEMENT 1"    "B1"
"PODIUM LEVEL"      "MEZZANINE"     "ROOF"
"PLANT LEVEL"       "TYPICAL POOL"
```

### Zone qualifier (multiplier = 1 per zone)

```
"FLOOR 3 - ZONE A"              → 1 with zone tag "A"
"L3 - PODIUM EAST"              → 1 with zone tag "PODIUM EAST"
"GROUND FLOOR (NORTH WING)"     → 1 with zone tag "NORTH WING"
```

Each zone produces a separate row in measurement with zone qualifier.

## Detection algorithm

```python
def detect_floor_multiplier(subtitle):
    """Return (multiplier_int, scope_label) for a drawing's subtitle."""

    # Range patterns
    m = re.search(r'(?:FL|FLOOR|L)\s*(\d+)\s*(?:TO|-|to)\s*(?:FL|FLOOR|L)?\s*(\d+)', subtitle, re.I)
    if m:
        start, end = int(m.group(1)), int(m.group(2))
        return (end - start + 1, f"FL{start}-FL{end}")

    # List pattern
    m = re.search(r'(?:FL|FLOOR|L)S?\s*((?:\d+\s*[,/]\s*)+\d+)', subtitle, re.I)
    if m:
        nums = [int(x.strip()) for x in re.split(r'[,/]', m.group(1))]
        return (len(nums), f"FL{nums}")

    # All floors
    if re.search(r'ALL\s+(?:TYPICAL\s+)?FLOORS?', subtitle, re.I):
        return (None, "ALL_FLOORS")  # None triggers derive-from-section

    # Single floor
    if re.search(r'(?:FLOOR\s*\d+|L\d+|GF|FF|MEZZANINE|ROOF|BASEMENT)', subtitle, re.I):
        return (1, subtitle)

    # Default
    return (1, subtitle)
```

## Edge cases

- **"TYP." alone without range** → HALT and prompt user OR fall back to 1 with disclosure
- **Overlapping typical ranges** (e.g., "L3-L9 typical" + "L5 exception") → respect explicit non-typical drawings
- **Hyphenated floor names** ("FL 7A", "FL 7B") → treat as separate single floors
- **Mixed numbering** ("MEZZ + L1 + L2 = 3 floors") → multiplier 3

## Audit notes section AN.TITLE-BLOCK

Every measurement audit must include this section listing at least 5 drawings with their parsed title blocks:

```markdown
## AN.TITLE-BLOCK

| Drawing Number | Title | Subtitle | Scale | Rev | Floors Covered | Multiplier |
|----------------|-------|----------|-------|-----|----------------|------------|
| A-103 | TYPICAL FLOOR PLAN | TYP. FL. L3 TO L9 | 1:100 | R03 | L3-L9 | 7 |
| ...

UNRESOLVED title-block patterns (if any):
- (none)
```
