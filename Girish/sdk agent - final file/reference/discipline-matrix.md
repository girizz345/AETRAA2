# Discipline Matrix — Drawing Identification + POMI Mapping

> **Section letters corrected at v1.2.** There is no POMI section S — communications
> and ELV are ELECTRICAL work, billed inside **R** as their own item groups. Furnishings
> moved from N to **M**; N is Special Construction; K is **Accessories**, not Specialties.
> Crosswalk: `pomi-take-off/references/determinism.md` §4.11a.


How to identify which discipline a drawing belongs to and which POMI section to assign it to.

## Drawing number prefix conventions (UAE common)

| Prefix | Discipline | POMI Section |
|--------|------------|--------------|
| A, AR | Architecture | varies by content (B/D/G/H/J/N) |
| S, ST | Structure | C (Concrete) + E (Metalwork) |
| M, ME | Mechanical (HVAC) | Q |
| P, PB | Plumbing | Q |
| D, DR | Drainage | Q (with B for external) |
| F, FA, FF | Fire (alarm + fighting) | Q (FF) + S (FA) |
| E, EL | Electrical | R |
| V, ELV | Extra-low voltage | S |
| MD, MEP | Combined MEP | Q + R + S |
| LS, LF, LSF | Life safety / fire egress | S (LSF) |
| L, LA | Landscape | B (Site Works) |
| C, CV, CIV | Civil / external | B |
| IN, INT, ID | Interior | varies (D/G/H/J) |

## Drawing title keywords (when prefix unclear)

### → Section B (Site Work)
"GRADING", "EARTHWORKS", "PAVING", "ROAD", "KERB", "LANDSCAPING", "IRRIGATION", "EXCAVATION", "BACKFILL", "FENCING"

### → Section C (Concrete)
"FOUNDATION", "PILE CAP", "RAFT", "COLUMN", "BEAM", "SLAB", "WALL" (RC), "STAIR", "TIE BEAM", "GROUND SLAB", "TRANSFER SLAB", "POST-TENSIONING", "STARTER", "REINFORCEMENT"

### → Section D (Masonry)
"BLOCK", "PARTITION", "BLOCKWORK", "MASONRY", "HOLLOW BLOCK", "SOLID BLOCK"

### → Section E (Metalwork)
"HANDRAIL", "BALUSTRADE", "STAIRS" (steel), "LADDER", "STEEL FRAME", "STRUCTURAL STEEL", "PURLIN", "CHANNEL"

### → Section F (Woodwork)
"JOINERY", "CABINETRY", "BUILT-IN", "WARDROBE", "MILLWORK"

### → Section G (Thermal & Moisture)
"WATERPROOFING", "INSULATION", "FLASHING", "MEMBRANE", "DPM", "DPC", "BITUMINOUS"

### → Section H (Doors & Windows)
"DOOR SCHEDULE", "WINDOW SCHEDULE", "DOOR LAYOUT", "GLAZING", "STOREFRONT", "ALUMINIUM SECTION", "IRONMONGERY"

### → Section J (Finishes)
"FLOOR FINISH", "WALL FINISH", "CEILING", "TILE LAYOUT", "FINISH SCHEDULE", "REFLECTED CEILING PLAN" (RCP), "PAINTING SCHEDULE"

### → Section K (Accessories)
"SIGNAGE", "TOILET ACCESSORIES", "FIRE EXTINGUISHER LAYOUT", "WAYFINDING"

### → Section N (Special Construction)
"POOL", "WATER FEATURE", "AMENITY", "SAUNA", "SPA"

### → Section P (Conveying)
"LIFT", "ESCALATOR", "DUMBWAITER", "ELEVATOR"

### → Section Q (Mechanical)
"HVAC", "FCU", "AHU", "FAHU", "DUCT", "CHILLED WATER", "VRF", "FIRE FIGHTING", "SPRINKLER", "PLUMBING", "WATER SUPPLY", "HOT WATER", "DRAINAGE", "WASTE", "GREASE TRAP"

### → Section R (Electrical)
"SLD", "SINGLE LINE", "LIGHTING LAYOUT", "POWER LAYOUT", "DISTRIBUTION BOARD", "CABLE TRAY", "EARTHING", "LIGHTNING PROTECTION", "EMERGENCY LIGHTING", "TRANSFORMER", "SWITCHBOARD"

### → Section R (Electrical) — communications / ELV item groups
"FIRE ALARM", "CCTV", "ACCESS CONTROL", "DATA", "AV", "PA", "BMS", "BUILDING MANAGEMENT SYSTEM"

## Equipment regex patterns for measurement extraction

### Doors / Windows

```
D-?\d+         door tag (D1, D-01, D 12)
DW-?\d+        door+window combined
W-?\d+         window tag
FD-?\d+        fire door
LD-?\d+        louvre door
SD-?\d+        sliding door
```

### Lights

```
L\d+\w*        light tag (L1, L01, L1A)
DL-?\d+        downlight
PL-?\d+        panel light
SP-?\d+        spotlight
EM-?\d+        emergency light
EX-?\d+        exit sign
```

### Electrical equipment

```
DB-?\d+        distribution board
MSB           main switchboard
SDB           sub-distribution board
TX-?\d+       transformer
GEN-?\d+      generator
UPS-?\d+      UPS
```

### Mechanical equipment

```
FCU-?\d+      fan coil unit
FAHU-?\d+     fresh air handling unit
AHU-?\d+      air handling unit
VRF-?\d+      VRF outdoor
CT-?\d+       cooling tower
P-?\d+        pump (when in M discipline)
CH-?\d+       chiller
EF-?\d+       exhaust fan
SF-?\d+       supply fan
```

### Structural

```
C\d+          column tag
W\d+          wall tag (shear wall)
B\d+          beam tag
PC\d+         pile cap
FB\d+         foundation tie beam
SC\d+         shear column
PT\d+         post-tension item
```

## Discipline detection algorithm

```python
def detect_discipline(drawing_number, drawing_title):
    # First check prefix
    prefix_match = re.match(r'^([A-Z]+)-?', drawing_number)
    if prefix_match:
        prefix = prefix_match.group(1)
        if prefix in PREFIX_MAP:
            return PREFIX_MAP[prefix]

    # Fall back to title keywords
    title_upper = drawing_title.upper()
    for section, keywords in TITLE_KEYWORDS.items():
        if any(kw in title_upper for kw in keywords):
            return section

    # Default: ARCH (POMI varies)
    return 'A'
```

## Cross-discipline coordination notes

Some items appear in MULTIPLE disciplines:

- **Floor drainage** — appears on architectural plans (for tile setting) AND plumbing/drainage. Measure ONCE in Q (Mechanical/Plumbing), reference architectural for location only.
- **Roof penetrations** — on architectural roof plan AND mechanical/electrical roof plan. Measure penetrations once in the discipline that owns the penetration.
- **Recessed ceiling lights** — on RCP (architectural) AND lighting layout (electrical). Light fittings measured in R. Ceiling type measured in J.
- **Fire alarm devices** — on architectural reflected ceiling AND fire alarm drawing. Devices measured in S (ELV) only.

When in doubt: the discipline that DESIGNED the item owns the measurement.
