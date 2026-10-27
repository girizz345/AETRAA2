# POMI CLAUSE-BY-CLAUSE FORMULAE

**Every one of the 314 clauses, in POMI's own order.** For each: what the clause
says, and the formula used against it.

Generated 2026-09-07 from `pomi-verbatim.md` and
`scripts/formula_register.py`. The generator **refuses to build** if any clause has no
register entry, so the coverage below is proved, not asserted.

| | |
|---|---|
| **Clause text** | verbatim from `pomi-verbatim.md`, which is verbatim from the RICS publication |
| **Unit** | what the clause measures in — or why it measures nothing |
| **Formula** | the arithmetic. Blank where the clause carries none |
| **In practice** | what the measurer must actually do, and the trap where there is one |

**210 clauses carry arithmetic.**
The remaining 104 are descriptive, definitional or
administrative — they are listed anyway, because "considered, and carries no formula" is a
different statement from silence.

For the same material organised by ITEM rather than by clause — with worked examples,
cross-checks and the errors ranked by cost — see `measurement-formulae.md`.

---

# SECTION GP — GENERAL PRINCIPLES
*10 groups · 34 clauses · 12 carrying arithmetic*

## GP1  Principles of measurement

### GP1.1
> These principles of measurement provide a uniform basis for measuring bills of quantities for works of construction. More detailed information than is required by this document may be given to define the precise nature of work or the circumstances under which it is to be carried out.

**Unit:** `—` — no arithmetic — a descriptive, definitional or administrative rule

**In practice.** Scope. More detail than POMI requires MAY be given — this is the clause every HOUSE build-up is made under.

### GP1.2
> Amendments to these principles of measurement for use in a particular locality or adopted for work not envisaged by this document shall be stated; an appendix is provided for such amendments to be recorded.

**Unit:** `—` — no arithmetic — a descriptive, definitional or administrative rule

**In practice.** Local amendments SHALL BE STATED and recorded in POMI's own Appendix. A house rule not recorded there is undeclared.

### GP1.3
> These principles of measurement may be applied equally to the measurement of proposed works and of completed works.

**Unit:** `—` — no arithmetic — a descriptive, definitional or administrative rule

**In practice.** Applies equally to proposed and completed works — so the same formulae serve a take-off and a final account.

## GP2  Bills of quantities

### GP2.1
> The objects of bills of quantities are: 1. To assist in the accurate preparation of tenders, by providing for measurement of quantities on a uniform basis 2. To provide a basis for the financial control of a project, in accordance with the conditions of contract.

**Unit:** `—` — no arithmetic — a descriptive, definitional or administrative rule

**In practice.** The TWO stated objects of a bill of quantities: 1 TO ASSIST IN THE ACCURATE PREPARATION OF TENDERS, by providing for measurement of quantities ON A UNIFORM BASIS · 2 TO PROVIDE A BASIS FOR THE FINANCIAL CONTROL OF A PROJECT, in accordance with the conditions of contract. No arithmetic — but object 2 is why a quantity must stay traceable after award, not only until tender.

### GP2.2
> Bills of quantities shall describe and represent the works to be carried out; work which cannot be measured accurately shall be described as approximate or given in bills of approximate quantities.

**Unit:** `RULE` — governs how OTHER quantities are calculated

**In practice.** THE PROVISIONAL RULE, and it is a DUTY, not a fallback. Bills shall DESCRIBE AND REPRESENT the works; WORK WHICH CANNOT BE MEASURED ACCURATELY SHALL BE DESCRIBED AS APPROXIMATE, or given in bills of approximate quantities. HOUSE RULE: WHERE THE INFORMATION IS NOT CLEAR, THE ITEM IS MARKED PROVISIONAL — never estimated into a precise-looking figure, and never silently omitted. A provisional item carries FOUR things: (1) the quantity as best it can be derived, (2) the word PROVISIONAL in the description, (3) WHY it is provisional — what is missing, which document would settle it, and (4) the technical query raised to close it. Both failure modes are worse than the mark: an invented precise quantity transfers a risk nobody has priced, and an omitted item is found by the contractor after award. GP2.2 is what makes 'I do not know' a compliant answer.

### GP2.3
> Conditions of contract, drawings and specifications shall be provided with the bills of quantities.

**Unit:** `—` — no arithmetic — a descriptive, definitional or administrative rule

**In practice.** Conditions, drawings and specification issued with the bill.

### GP2.4
> The section headings and classifications do not impose restrictions upon the format and presentation of bills of quantities.

**Unit:** `—` — no arithmetic — a descriptive, definitional or administrative rule

**In practice.** Section headings do not restrict format — which is why a commercial heading may differ from POMI's, if declared.

## GP3  Measurement

### GP3.1
> Work shall be measured net as fixed in position and each measurement shall be taken to the nearest 10 millimetres; this principle shall not apply to dimensions stated in descriptions.

**Unit:** `RULE` — governs how OTHER quantities are calculated

```
d = round(d_drawn / 0.01) × 0.01
```

**In practice.** NET as fixed in position, each dimension to the nearest 10 mm. Round each dimension as taken, not the product. Dimensions in DESCRIPTIONS are exempt.

### GP3.2
> Unless otherwise stated, no deduction shall be made from items required to be measured by area for voids of less than 1.00 m².

**Unit:** `RULE` — governs how OTHER quantities are calculated

```
A_net = A_gross − Σ A_void  for A_void ≥ 1.00 m²
```

**In practice.** The area deduction threshold. Applies to items measured BY AREA.

### GP3.3
> Minimum deductions of voids shall refer only to voids within the edges of measured areas; voids which are at the edges of measured areas shall always be deducted, irrespective of size.

**Unit:** `RULE` — governs how OTHER quantities are calculated

```
deduct ALL voids at an edge, any size
```

**In practice.** The exception to GP3.2, and the one most often missed. Interior voids under 1.00 m² stay; edge voids always go.

### GP3.4
> These principles of measurement may be used with other units of measurement but the particular amendments shall be stated.

**Unit:** `—` — no arithmetic — a descriptive, definitional or administrative rule

**In practice.** Other units may be used if the amendment is stated.

### GP3.5
> Notwithstanding these principles of measurement, a separate minor building or structure may be enumerated.

**Unit:** `NR` — enumerated — a count

```
N = 1 per minor building
```

**In practice.** A separate minor building or structure MAY be enumerated whole instead of measured.

## GP4  Items to be fully inclusive

### GP4.1
> Unless otherwise stated, all items shall be fully inclusive of all that is necessary to fulfill the liabilities and obligations arising out of the contract and shall include: 1. Labour and all associated costs 2. Materials, goods and all associated costs 3. Provision of plant 4. Temporary works 5. Establishment charges, overheads and profit.

**Unit:** `—` — no arithmetic — a descriptive, definitional or administrative rule

**In practice.** What EVERY rate is deemed to include, FIVE heads: 1 LABOUR AND ALL ASSOCIATED COSTS · 2 MATERIALS, GOODS AND ALL ASSOCIATED COSTS · 3 PROVISION OF PLANT · 4 TEMPORARY WORKS · 5 ESTABLISHMENT CHARGES, OVERHEADS AND PROFIT. This is THE clause that makes waste, laps, rolling margin, working space and bulking rate matters — add any of them to a quantity and the same money is billed twice.

## GP5  Description of items

### GP5.1
> Items which are required to be enumerated, or for which an item is required, shall be fully described.

**Unit:** `—` — no arithmetic — a descriptive, definitional or administrative rule

**In practice.** Enumerated items and items must be FULLY DESCRIBED.

### GP5.2
> Items which are to be measured by length or depth shall state the cross-sectional size and shape, girth or ranges of girths or such other information as may be appropriate; for items of pipework it shall be stated whether the diameter is internal or external.

**Unit:** `RULE` — governs how OTHER quantities are calculated

**In practice.** Length and depth items STATE the cross-sectional size and shape, girth or range of girths. FOR PIPEWORK IT SHALL BE STATED WHETHER THE DIAMETER IS INTERNAL OR EXTERNAL. HOUSE ELECTION: INTERNAL DIAMETER IS STATED, converting from a nominal or external figure where the schedule gives that instead. THIS IS THE HIGHEST-LEVERAGE STATEMENT IN AN MEP BILL: POMI expresses the Q2.2 60 mm threshold as an INTERNAL diameter, so a pipe quoted at 65 mm EXTERNAL may be under 60 mm internal — and a whole class of enumerated fittings appears or disappears on the basis alone. The same threshold governs J6.3 cl.11 versus J6.4 for decoration.

### GP5.3
> Items which are to be measured by area shall state the thickness or such other information as may be appropriate.

**Unit:** `RULE` — governs how OTHER quantities are calculated

**In practice.** Area items STATE the thickness.

### GP5.4
> Items which are to be measured by weight shall state the material thickness and unit weight if appropriate (for example, ductwork).

**Unit:** `RULE` — governs how OTHER quantities are calculated

```
W = A × m_per_m2  or  L × m_per_m  or  V × ρ
```

**In practice.** Weight items STATE the material thickness and unit weight IF APPROPRIATE — POMI's own example is DUCTWORK. THE QUALIFIER IS POMI'S: the statement is required where it bears on the work, not mechanically on every weight item. It plainly IS appropriate for sheet material sold by gauge — ductwork, sheet metal, flashings — where the thickness is the whole difference in cost, and for rolled sections where the unit mass identifies the section. Take the density and unit mass FROM THE SPECIFICATION OR MANUFACTURER'S DATA, never from memory, and record the source on the row.

### GP5.5
> Notwithstanding these principles of measurement, proprietary items may be measured in a manner appropriate to the manufacturer's tariff or customary practice.

**Unit:** `—` — no arithmetic — a descriptive, definitional or administrative rule

**In practice.** Proprietary items may follow the manufacturer's tariff — a declared departure from the formulae here.

### GP5.6
> The description of items in bills of quantities may refer to other documents or drawings and any reference to such information shall be understood to fulfill any requirement of these principles of measurement; alternatively, reference may be made to published information.

**Unit:** `—` — no arithmetic — a descriptive, definitional or administrative rule

**In practice.** A description may refer to another document, and that reference satisfies POMI's requirement.

## GP6  Work to be executed by a specialist nominated by the employer

### GP6.1
> Unless otherwise required by the conditions of contract, work which is required to be executed by a specialist nominated by the employer shall be given as a sum; such sum shall be exclusive of contractor's profit and in each case an item shall be given for the addition of profit.

**Unit:** `SUM` — a SUM — a money figure, not a measured quantity

```
Sum, exclusive of profit + separate profit item
```

**In practice.** Nominated specialist work.

### GP6.2
> An item shall be given in each case for assistance by the contractor, which shall include: 1. Use of contractor's administrative arrangements 2. Use of constructional plant 3. Use of contractor's facilities 4. Use of temporary works 5. Space for specialist's offices and stores 6. Clearing away rubbish 7. Scaffolding required by the specialist, giving particulars 8. Unloading, distributing, hoisting and placing in position items of plant, machinery or the like, giving particulars.

**Unit:** `ITEM` — an ITEM — a lump, not a measured quantity

**In practice.** ONE ITEM for ATTENDANCE by the contractor on a nominated specialist, EIGHT heads: 1 USE OF THE CONTRACTOR'S ADMINISTRATIVE ARRANGEMENTS · 2 USE OF CONSTRUCTIONAL PLANT · 3 USE OF THE CONTRACTOR'S FACILITIES · 4 USE OF TEMPORARY WORKS · 5 SPACE FOR THE SPECIALIST'S OFFICES AND STORES · 6 CLEARING AWAY RUBBISH · 7 SCAFFOLDING required by the specialist, GIVING PARTICULARS · 8 UNLOADING, DISTRIBUTING, HOISTING AND PLACING IN POSITION items of plant or machinery, GIVING PARTICULARS. Heads 7 and 8 REQUIRE PARTICULARS — an attendance item that does not describe the scaffolding and the hoisting is not priceable.

## GP7  Goods, materials or services to be provided by a merchant or tradesman nominated by the employer

### GP7.1
> Unless otherwise required by the conditions of contract, goods, materials or services which are required to be provided by a merchant or tradesman nominated by the employer shall be given as a sum; such sum shall be exclusive of contractor's profit and in each case an item shall be given for the addition of profit.

**Unit:** `SUM` — a SUM — a money figure, not a measured quantity

```
Sum, exclusive of profit + separate profit item
```

**In practice.** Nominated merchant goods, materials or services.

### GP7.2
> Fixing goods and materials shall be given in accordance with the relevant clauses in these principles of measurement; fixing shall be understood to include unloading, storing, distributing and hoisting the, goods and materials. Particulars shall be given of any requirements for the contractor to arrange for delivery or pay any costs of conveying goods or materials.

**Unit:** `—` — no arithmetic — a descriptive, definitional or administrative rule

**In practice.** FIXING measured to the relevant clauses; fixing INCLUDES unloading, storing, distributing and hoisting.

## GP8  Work to be executed by a government or public authority

### GP8.1
> Unless otherwise required by the conditions of contract, work which may only be carried out or by a government or public authority shall be given as a sum; such sum shall be exclusive of contractor's profit and in each case an item shall be given for the addition of profit.

**Unit:** `SUM` — a SUM — a money figure, not a measured quantity

```
Sum, exclusive of profit + separate profit item
```

**In practice.** Work only a government or public authority may do — DEWA, Etisalat, du.

### GP8.2
> An item shall be given in each case for assistance by the contractor as described in clause GP6.2.

**Unit:** `ITEM` — an ITEM — a lump, not a measured quantity

**In practice.** Attendance, as GP6.2.

## GP9  Dayworks

### GP9.1
> The cost of labour in dayworks shall be given as a sum; alternatively, a schedule of the different categories of labour may be given containing a provisional quantity of hours for each category.

**Unit:** `SCHEDULE`

```
one priced line per labour category × PROVISIONAL hours
```

**In practice.** DAYWORK LABOUR. POMI permits A SUM or, expressly, A SCHEDULE OF CATEGORIES carrying a PROVISIONAL QUANTITY OF HOURS for each. HOUSE ELECTION: THE SCHEDULE. A sum is one number against one number and reveals nothing about the rates that will be applied when daywork is ordered; a schedule prices each category, so the tender is comparable AND the rates are fixed before anyone needs them. The hours are PROVISIONAL by POMI's own wording and adjust on the actual, so the schedule costs nothing in accuracy.

### GP9.2
> The cost of labour included in a sum or schedule shall include wages, bonuses and all allowances paid to operatives directly engaged on dayworks (including those operating mechanical plant and transport) in accordance with the appropriate employment agreement or, where no such agreement exists, the actual payments made to the work people concerned.

**Unit:** `—` — no arithmetic — a descriptive, definitional or administrative rule

**In practice.** What daywork labour cost includes.

### GP9.3
> The cost of materials in dayworks shall be given as a sum; alternatively, a schedule may be given containing a provisional quantity of different materials.

**Unit:** `SCHEDULE`

```
one priced line per material × PROVISIONAL quantity
```

**In practice.** DAYWORK MATERIALS, as a SCHEDULE with provisional quantities — same election as GP9.1. GP9.4 fixes the basis: the NET INVOICED PRICE, INCLUDING DELIVERY TO SITE.

### GP9.4
> The cost of materials included in a sum or schedule shall be the net invoiced price, including delivery to site.

**Unit:** `—` — no arithmetic — a descriptive, definitional or administrative rule

**In practice.** Daywork materials at NET INVOICED PRICE including delivery.

### GP9.5
> The cost of constructional plant employed exclusively in dayworks shall be given as a sum; alternatively, a schedule of the different categories of plant may be given containing a provisional quantity of hours, or such other period of time as may be appropriate, for each category.

**Unit:** `SCHEDULE`

```
one priced line per plant category × PROVISIONAL hours
```

**In practice.** DAYWORK PLANT, as a SCHEDULE with provisional hours — same election as GP9.1. NOTE THE WORD 'EXCLUSIVELY': only plant employed EXCLUSIVELY in dayworks is here. Plant shared with the permanent works is an OVERHEAD under GP9.8 cl.4 and must not appear. GP9.6 fixes what the rate covers: fuel, consumable stores, repairs, maintenance and insurance.

### GP9.6
> The cost of constructional plant included in a sum or schedule shall include fuel, consumable stores, repairs, maintenance and insurance of plant.

**Unit:** `—` — no arithmetic — a descriptive, definitional or administrative rule

**In practice.** What daywork plant cost includes.

### GP9.7
> An item shall be given for the addition of establishment charges, overheads and profit to each of the sums or schedules of labour, materials or plant.

**Unit:** `ITEM ×3`

```
one addition item against EACH of the three schedules
```

**In practice.** An item for the addition of establishment charges, overheads and profit TO EACH of the sums or schedules of labour, materials and plant. THE WORD IS 'EACH' — three schedules produce THREE addition items, so a daywork section is SIX blocks, not four: labour schedule + its addition, materials schedule + its addition, plant schedule + its addition. A single combined addition cannot be applied when only one of the three is expended.

### GP9.8
> Establishment charges, overheads and profit shall include: 1. Costs related to the employment of labour 2. Costs related to the storage of materials, including handling and waste in storage 3. Contractor's administrative arrangements 4. Constructional plant, except plant employed exclusively on dayworks 5. Contractor's facilities 6. Temporary works 7. Sundry items.

**Unit:** `—` — no arithmetic — a descriptive, definitional or administrative rule

**In practice.** What ESTABLISHMENT CHARGES, OVERHEADS AND PROFIT comprise, SEVEN heads: 1 COSTS RELATED TO THE EMPLOYMENT OF LABOUR · 2 COSTS RELATED TO THE STORAGE OF MATERIALS, INCLUDING HANDLING AND WASTE IN STORAGE · 3 THE CONTRACTOR'S ADMINISTRATIVE ARRANGEMENTS · 4 CONSTRUCTIONAL PLANT, EXCEPT plant employed exclusively on dayworks · 5 THE CONTRACTOR'S FACILITIES · 6 TEMPORARY WORKS · 7 SUNDRY ITEMS. Head 2 is the one that matters to a measurer: WASTE IN STORAGE is an overhead, which is a second reason a quantity never carries waste.

## GP10  Contingencies

### GP10.1
> Unless otherwise required by the conditions of contract, contingencies shall be given as a sum; no item shall be given for the addition of profit.

**Unit:** `SUM` — a SUM — a money figure, not a measured quantity

**In practice.** Contingencies as a sum. NO profit item — the opposite of GP6/7/8/9.7.

# SECTION A — GENERAL REQUIREMENTS
*9 groups · 13 clauses · 0 carrying arithmetic*

## A1  Conditions of contract

### A1.1
> A schedule of the clause headings shall be set out in the bills of quantities.

**Unit:** `—` — no arithmetic — a descriptive, definitional or administrative rule

**In practice.** Schedule of clause headings.

### A1.2
> Where there is an appendix to the conditions of contract requiring insertions to be made, a schedule of the insertions shall be set out in the bills of quantities.

**Unit:** `—` — no arithmetic — a descriptive, definitional or administrative rule

**In practice.** Schedule of appendix insertions.

## A2  Specification

### A2.1
> Where the specification contains clauses related to any of the following General Requirements, the bills of quantities shall make reference to the appropriate clauses.

**Unit:** `—` — no arithmetic — a descriptive, definitional or administrative rule

**In practice.** Bill refers to the specification's General Requirements clauses.

## A3  Restrictions

### A3.1
> Particulars shall be given of any restrictions, which shall include: 1. Access to and possession or use of the site 2. Limitations of working space 3. Limitations of working hours 4. The maintenance of existing services on, under or over the site 5. The execution or completion of the work in any specific order, sections or phases 6. Items of a like nature.

**Unit:** `—` — no arithmetic — a descriptive, definitional or administrative rule

**In practice.** PARTICULARS of RESTRICTIONS, SIX heads, all of them the employer's constraints on how the contractor may work: 1 ACCESS to and POSSESSION OR USE of the site · 2 LIMITATIONS OF WORKING SPACE · 3 LIMITATIONS OF WORKING HOURS · 4 MAINTENANCE OF EXISTING SERVICES on, under or over the site · 5 EXECUTION OR COMPLETION IN ANY SPECIFIC ORDER, SECTIONS OR PHASES · 6 items of a like nature. Noise, pollution and statutory obligations are NOT here — they are sundry items under A9.1.

## A4  Contractor's administrative arrangements

### A4.1
> An item shall be given for contractor's administrative arrangements, which shall include: 1. Site administration 2. Supervision 3. Security 4. Safety, health and welfare of workpeople 5. Transport of workpeople.

**Unit:** `ITEM` — an ITEM — a lump, not a measured quantity

**In practice.** Contractor's administrative arrangements — site admin, supervision, security, safety, transport of workpeople.

## A5  Constructional plant

### A5.1
> An item shall be given for constructional plant, which shall include: 1. Small plant and tools 2. Scaffolding 3. Cranes and lifting plant 4. Site transport 5. Plant required for specific trades.

**Unit:** `ITEM` — an ITEM — a lump, not a measured quantity

**In practice.** Constructional plant — small plant, scaffolding, cranes, site transport, trade-specific plant.

## A6  Employer's facilities

### A6.1
> Particulars shall be given of any facilities required for the employer or the employer's representatives, which shall include: 1. Temporary accommodation (for example, offices, laboratories, living accommodation), including heating, cooling, lighting, furnishing, attendance or related facilities 2. Telephones, including costs of calls; alternatively, the cost of calls may be given as a sum 3. Vehicles 4. Attendance of staff (for example, drivers, laboratory assistants) 5. Equipment (for example, surveyor laboratory equipment) 6. Special requirements for programmes or progress charts 7. Any other facilities (for example, progress photographs, signboards).

**Unit:** `—` — no arithmetic — a descriptive, definitional or administrative rule

**In practice.** PARTICULARS of the EMPLOYER'S FACILITIES — what the contractor must provide FOR THE EMPLOYER and the employer's representatives, SEVEN heads: 1 TEMPORARY ACCOMMODATION (offices, laboratories, living accommodation) INCLUDING heating, cooling, lighting, furnishing and attendance · 2 TELEPHONES, INCLUDING THE COST OF CALLS — ALTERNATIVELY the cost of calls MAY BE GIVEN AS A SUM · 3 VEHICLES · 4 ATTENDANCE OF STAFF (drivers, laboratory assistants) · 5 EQUIPMENT (surveying, laboratory) · 6 SPECIAL REQUIREMENTS FOR PROGRAMMES OR PROGRESS CHARTS · 7 any other facilities (progress photographs, signboards). Distinct from A7.1, which is what the contractor provides for HIMSELF.

## A7  Contractor's facilities

### A7.1
> An item shall be given for facilities required by the contractor, which shall include: 1. Accommodation and buildings, including offices, laboratories, compounds, stores, messrooms and living accommodation 2. Temporary fencing, including hoardings, screens, roofs and guardrails 3. Temporary roads, including hardstandings and crossings 4. Water for the works; particulars shall be given if water will be supplied to the contractor 5. Lighting and power for the works; particulars shall be given if current will be supplied to the contractor 6. Temporary telephones.

**Unit:** `ITEM` — an ITEM — a lump, not a measured quantity

**In practice.** ONE ITEM for the CONTRACTOR'S OWN FACILITIES, SIX heads: 1 ACCOMMODATION AND BUILDINGS — offices, laboratories, compounds, stores, messrooms, living accommodation · 2 TEMPORARY FENCING, INCLUDING hoardings, screens, roofs and guardrails · 3 TEMPORARY ROADS, INCLUDING hardstandings and crossings · 4 WATER FOR THE WORKS — PARTICULARS SHALL BE GIVEN IF WATER WILL BE SUPPLIED TO THE CONTRACTOR · 5 LIGHTING AND POWER FOR THE WORKS — PARTICULARS SHALL BE GIVEN IF CURRENT WILL BE SUPPLIED · 6 TEMPORARY TELEPHONES. The two 'particulars' limbs matter commercially: if the employer supplies water or current, say so, or the contractor prices it twice.

### A7.2
> Particulars shall be given where the nature or extent of the facilities is not at the discretion of the contractor.

**Unit:** `—` — no arithmetic — a descriptive, definitional or administrative rule

**In practice.** Particulars where the facilities are not at the contractor's discretion.

## A8  Temporary works

### A8.1
> An item shall be given for temporary works, which shall include: 1. Traffic diversion 2. Access roads 3. Bridges 4. Cofferdams 5. Pumping 6. De-watering 7. Compressed air for tunnelling.

**Unit:** `ITEM` — an ITEM — a lump, not a measured quantity

**In practice.** ONE ITEM for TEMPORARY WORKS, SEVEN heads: 1 TRAFFIC DIVERSION · 2 ACCESS ROADS · 3 BRIDGES · 4 COFFERDAMS · 5 PUMPING · 6 DE-WATERING · 7 COMPRESSED AIR FOR TUNNELLING. Pumping and de-watering are SEPARATE heads — keeping water out of an excavation and lowering the water table are not the same operation.

### A8.2
> Particulars shall be given where the nature or extent of the temporary works is not at the discretion of the contractor.

**Unit:** `—` — no arithmetic — a descriptive, definitional or administrative rule

**In practice.** Particulars where not at the contractor's discretion.

## A9  Sundry items

### A9.1
> An item shall be given for sundry items, which shall include: 1. Testing of materials 2. Testing of the works 3. Protecting the works from inclement weather 4. Removing rubbish, protective casings and coverings and cleaning the works at completion 5. Traffic regulations 6. Maintenance of public and private roads ' 7. Drying the works 8. Control of noise and pollution 9. All statutory obligations

**Unit:** `ITEM` — an ITEM — a lump, not a measured quantity

**In practice.** ONE ITEM for SUNDRY ITEMS, NINE heads: 1 TESTING OF MATERIALS · 2 TESTING OF THE WORKS · 3 PROTECTING THE WORKS FROM INCLEMENT WEATHER · 4 REMOVING RUBBISH, protective casings and coverings, AND CLEANING THE WORKS AT COMPLETION · 5 TRAFFIC REGULATIONS · 6 MAINTENANCE OF PUBLIC AND PRIVATE ROADS · 7 DRYING THE WORKS · 8 CONTROL OF NOISE AND POLLUTION · 9 ALL STATUTORY OBLIGATIONS. Testing of materials and testing of the works are two heads, not one.

### A9.2
> Particulars shall be given where the nature or extent of the sundry items is not at the discretion of the contractor.

**Unit:** `—` — no arithmetic — a descriptive, definitional or administrative rule

**In practice.** Particulars where not at the contractor's discretion.

# SECTION B — SITE WORK
*26 groups · 95 clauses · 65 carrying arithmetic*

## B1  Site exploration generally

### B1.1
> Keeping records of site observations, site tests and laboratory tests shall be given as an item.

**Unit:** `ITEM` — an ITEM — a lump, not a measured quantity

**In practice.** Keeping RECORDS of observations and tests.

### B1.2
> Samples, site observations, site tests, laboratory tests and analyses shall be given as an item,

**Unit:** `ITEM` — an ITEM — a lump, not a measured quantity

**In practice.** Samples, observations, site tests, laboratory tests AND ANALYSES — the testing itself, distinct from B1.1's recording.

### B1.3
> Providing reports shall be given as an item.

**Unit:** `ITEM` — an ITEM — a lump, not a measured quantity

**In practice.** Providing reports.

## B2  Trial holes

### B2.1
> Excavating trial holes shall be measured by depth, taken along the centre line, stating the number and the maximum depth below commencing level.

**Unit:** `M (depth)` — by depth, metres

```
Depth = Σ d(i) ; state N and d_max
```

**In practice.** Trial holes, along the CENTRE LINE. Depth from the COMMENCING LEVEL, not from datum.

### B2.2
> Earthwork support which is not at the discretion of the contractor shall be measured by depth.

**Unit:** `M (depth)` — by depth, metres

```
Depth = Σ d(i)
```

**In practice.** Earthwork support to trial holes, ONLY where not at the contractor's discretion.

## B3  Boreholes (including pumping test wells)

### B3.1
> Driving boreholes shall be measured by depth, taken along the centre line, stating the number and the maximum depth below commencing level; raking boreholes shall be so described.

**Unit:** `M (depth)` — by depth, metres

```
Depth = Σ d(i) ; state N and d_max
```

**In practice.** Boreholes. Raking boreholes SO DESCRIBED.

### B3.2
> Lining which is not at the discretion of the contractor shall be measured by depth.

**Unit:** `M (depth)` — by depth, metres

```
Depth = Σ d(i)
```

**In practice.** Borehole lining, only where not at the contractor's discretion.

### B3.3
> Cappings shall be enumerated.

**Unit:** `NR` — enumerated — a count

```
N = count
```

**In practice.** Cappings.

## B4  Site preparation

### B4.1
> Removing isolated trees shall be enumerated.

**Unit:** `NR` — enumerated — a count

```
N = count
```

**In practice.** Isolated trees, by girth band.

### B4.2
> Removing hedges shall be measured by length.

**Unit:** `M` — by length, metres

```
L = Σ L(i)
```

**In practice.** Hedges.

### B4.3
> Site clearance, which shall include removing vegetation, undergrowth, bushes, hedges, trees or the like, shall be measured by area.

**Unit:** `M2` — by area, square metres

```
A = L_site × W_site − excluded areas
```

**In practice.** Site clearance — INCLUDES vegetation, undergrowth, bushes, hedges, trees under the stated girth.

## B5  Demolitions and alterations

### B5.1
> The location of each item shall be given. Unless otherwise stated, old materials shall be understood to become the property of the contractor and shall be cleared away; old materials required to remain the property of the employer shall be so described.

**Unit:** `—` — no arithmetic — a descriptive, definitional or administrative rule

**In practice.** Location of each item given. Old materials become the contractor's unless otherwise stated.

### B5.2
> Removing individual fittings, fixtures, engineering installations or the like from an existing structure shall each be given as an item.

**Unit:** `ITEM` — an ITEM — a lump, not a measured quantity

**In practice.** Removing individual fittings, fixtures or installations from an existing structure.

### B5.3
> Demolishing individual structures (or part thereof) shall each be given as an item; alternatively, demolishing all structures on a site may be given as an item.

**Unit:** `ITEM` — an ITEM — a lump, not a measured quantity

**In practice.** Demolishing individual structures or parts.

### B5.4
> Cutting openings in existing structures and alterations to existing structures shall each be given as an item; making good all work damaged shall be understood to be included.

**Unit:** `ITEM` — an ITEM — a lump, not a measured quantity

**In practice.** Cutting openings in, and alterations to, existing structures.

### B5.5
> Temporary screens and roofs shall be given as an item.

**Unit:** `ITEM` — an ITEM — a lump, not a measured quantity

**In practice.** Temporary screens and roofs.

## B6  Shoring

### B6.1
> Shoring incidental to demolitions and alterations, together with clearing away and making good all work damaged, shall be understood to be included.

**Unit:** `ITEM` — an ITEM — a lump, not a measured quantity

**In practice.** Shoring INCIDENTAL to demolitions and alterations, with clearing away and making good.

### B6.2
> Shoring (other than that incidental to demolitions and alterations) shall be given as an item, stating the location; clearing away and making good all work damaged shall be understood to be included.

**Unit:** `ITEM` — an ITEM — a lump, not a measured quantity

**In practice.** Other shoring, stating the type and what is supported.

### B6.3
> Particulars shall be given where the design of the shoring is not at the discretion of the contractor.

**Unit:** `—` — no arithmetic — a descriptive, definitional or administrative rule

**In practice.** Particulars where the shoring design is not the contractor's.

### B6.4
> Shoring which is required by the specification to be left in position shall be so described.

**Unit:** `—` — no arithmetic — a descriptive, definitional or administrative rule

**In practice.** Shoring left in position SO DESCRIBED.

## B7  Underpinning

### B7.1
> Work in underpinning shall be given under an appropriate heading, stating the location.

**Unit:** `—` — no arithmetic — a descriptive, definitional or administrative rule

**In practice.** Underpinning under its own heading, stating the location.

### B7.2
> Unless otherwise stated, work shall be measured in accordance with the appropriate sections of this document.

**Unit:** `—` — no arithmetic — a descriptive, definitional or administrative rule

**In practice.** Work in underpinning measured to the APPROPRIATE SECTIONS — excavation to B, concrete to C, masonry to D.

### B7.3
> Temporary support shall be given as an item; particulars shall be given where the design of the temporary support is not at the discretion of the contractor.

**Unit:** `ITEM` — an ITEM — a lump, not a measured quantity

**In practice.** Temporary support to underpinning.

### B7.4
> Excavation shall be measured by volume, taken to the outside line of the projecting foundations or to the outside line of the new foundations (whichever is the greater), classified as follows: 1. Excavation in preliminary trenches down to the base of the existing foundations 2. Excavation below the base of the existing foundations.

**Unit:** `M3` — by volume, cubic metres

```
V = L × W_to_outside_of_projecting_foundation × D
```

**In practice.** Underpinning excavation to the OUTSIDE LINE of the projecting foundation, TWO classes: 1 down TO the base of the existing foundations · 2 BELOW the base of the existing foundations.

### B7.5
> Cutting away projecting foundations shall be measured by length.

**Unit:** `M` — by length, metres

```
L = Σ L(i)
```

**In practice.** Cutting away projecting foundations.

## B8  Earthworks generally

### B8.1
> Any information available concerning the nature of the ground and strata shall be provided with the bills of quantities.

**Unit:** `—` — no arithmetic — a descriptive, definitional or administrative rule

**In practice.** Ground and strata information provided with the bill.

### B8.2
> The quantities for excavation, dredging or tunnelling shall be understood to be the bulk before excavation, and no allowance shall be made for any working space or subsequent variation in bulk; existing voids shall be deducted.

**Unit:** `RULE` — governs how OTHER quantities are calculated

```
V = V_designed_void − Σ V_existing_voids
```

**In practice.** THE governing earthworks rule: quantities are the BULK BEFORE EXCAVATION. NO working space, NO bulking. Existing voids ARE deducted.

### B8.3
> Multiple handling of materials and transporting about the site shall be understood to be included; multiple handling which is required by the specification shall be so described in the item of disposal.

**Unit:** `—` — no arithmetic — a descriptive, definitional or administrative rule

**In practice.** Multiple handling and transporting about site DEEMED INCLUDED, unless the specification requires it — then so described in the DISPOSAL item.

### B8.4
> Earthwork support shall be given as an item.

**Unit:** `ITEM` — an ITEM — a lump, not a measured quantity

**In practice.** Earthwork support. An ITEM, never an area.

### B8.5
> Excavation in rock shall be so described; alternatively, it may be measured as extra over excavation (that is, the volume of rock shall be measured but no deduction shall be made from the volume of excavation in which the rock occurs).

**Unit:** `M3` — by volume, cubic metres

```
ROUTE A  V_soil = V_total − V_rock   (two items, summing to the total)
ROUTE B  V_excavation = V_total UNCHANGED
         V_rock       = measured AS WELL
```

**In practice.** Excavation in rock. POMI'S PRIMARY LIMB IS 'SHALL BE SO DESCRIBED' — rock described as its own excavation item, the two summing to the total. EXTRA OVER IS THE EXPRESS ALTERNATIVE, and it is the HOUSE ELECTION: the volume of rock is measured but NO DEDUCTION is made from the excavation in which it occurs. Under the elected route the base dig stays whole, which matters because rock is FOUND, not designed. DEDUCTING THE ROCK FROM THE EXCAVATION LOSES THE BASE ITEM — the same error as B15.2 rock boring, D2.2 faced work and G2.3 special sheets, and the one people reverse. B8.6 defines rock, and it is an OPINION, not a geological test.

### B8.6
> For the purposes of measurement rock is defined as any material met with which is of such size or position that, in the opinion of the employer's representative, it can only be removed by means of wedges, special plant or explosives.

**Unit:** `—` — no arithmetic — a descriptive, definitional or administrative rule

**In practice.** Definition of rock: removable only by wedges, special plant or explosives, in the employer's representative's opinion.

## B9  Excavation

### B9.1
> Unless otherwise stated, excavation shall be measured by volume as the void which is to be occupied by the permanent construction, or vertically above any part of the permanent construction, classified as follows: 1. Oversite excavation to remove top soil, stating the average depth 2. Excavation to reduce levels 3. Excavation in cuttings 4. Basement excavation 5. Trench excavation to receive foundations, which shall include pile caps and ground beams 6. Pit excavation to receive foundation bases, stating the number 7. Excavation for diaphragm walls, stating the width of the permanent construction and the type of support fluid.

**Unit:** `M3` — by volume, cubic metres

```
V = N × L × W × D
```

**In practice.** Excavation as the VOID TO BE OCCUPIED by the permanent construction, or vertically above any part of it — L and W are the PERMANENT CONSTRUCTION's dimensions, not the dig's. SEVEN classes: 1 OVERSITE EXCAVATION to remove top soil, STATING THE AVERAGE DEPTH · 2 EXCAVATION TO REDUCE LEVELS · 3 EXCAVATION IN CUTTINGS · 4 BASEMENT EXCAVATION · 5 TRENCH EXCAVATION to receive foundations, which SHALL INCLUDE PILE CAPS AND GROUND BEAMS · 6 PIT EXCAVATION to receive foundation bases, STATING THE NUMBER · 7 EXCAVATION FOR DIAPHRAGM WALLS, STATING THE WIDTH of the permanent construction AND THE TYPE OF SUPPORT FLUID. Three classes carry a mandatory statement: 1 average depth, 6 the number, 7 width and support fluid.

### B9.2
> Excavation of trenches for service pipes, drain pipes, cables or the like shall each be measured by length, stating the average depth; disposal and filling shall be understood to be included.

**Unit:** `M` — by length, metres

```
Len = Σ L, per trench type
d_avg STATED
```

**In practice.** Trenches for service pipes, drain pipes, cables or the like shall EACH be measured BY LENGTH — 'each' meaning ONE ITEM PER TRENCH TYPE, not one combined trench item — STATING THE AVERAGE DEPTH. DISPOSAL AND FILLING ARE DEEMED INCLUDED, so NOTHING ELSE is measured for that trench: no disposal row under B11, no filling row under B12, no earthwork support. A drainage trench carrying all three has been paid three times for one operation, and it is the most double-counted item in a site-work bill.

### B9.3
> For excavation in tunnelling see clause B24.

**Unit:** `—` — no arithmetic — a descriptive, definitional or administrative rule

**In practice.** Tunnel excavation is B24, not B9.

## B10  Dredging

### B10.1
> Dredging shall be measured by volume, stating the location and limits; unless otherwise stated, measurement shall be understood to be taken from soundings.

**Unit:** `M3` — by volume, cubic metres

```
V = Σ V, from soundings
```

**In practice.** Dredging, stating location and limits.

## B11  Disposal

### B11.1
> Disposal of material arising from excavation, dredging or tunnelling shall be measured by volume as equal to the volume of excavation, dredging or tunnelling and each shall be classified as follows: 1. Backfilled into excavation 2. Backfilled in making up levels 3. Backfilled oversite to make up levels, giving details of special contouring, embankments or the like 4. Removed, which shall include providing a suitable tip.

**Unit:** `M3` — by volume, cubic metres

```
V_disposal = V_excavation  (EXACTLY)
```

**In practice.** Disposal EQUALS the excavation, dredging or tunnelling volume EXACTLY — no bulking, no shrinkage. FOUR classes, each measured separately: 1 BACKFILLED INTO EXCAVATION · 2 BACKFILLED IN MAKING UP LEVELS · 3 BACKFILLED OVERSITE TO MAKE UP LEVELS, GIVING DETAILS of special contouring, embankments or the like · 4 REMOVED, which SHALL INCLUDE PROVIDING A SUITABLE TIP — so tipping charges are in the rate, never a separate item.

## B12  Filling

### B12.1
> Filling material (other than that arising from excavation, dredging or tunnelling) shall be measured by volume as equal to the void to be filled, classified as follows: 1. Filled into excavation 2. Filled in making up levels 3. Filled oversite to make up levels, giving details of special contouring, embankments or the like.

**Unit:** `M3` — by volume, cubic metres

```
V_fill = V_void_to_be_filled
```

**In practice.** Filling material OTHER THAN that arising from excavation, dredging or tunnelling — so IMPORTED fill only; site-won material returned is B11 'backfilled', and the test is WHERE THE MATERIAL CAME FROM. Measured as EQUAL TO THE VOID TO BE FILLED — the designed void, not the loose volume delivered. THREE classes: 1 FILLED INTO EXCAVATION · 2 FILLED IN MAKING UP LEVELS · 3 FILLED OVERSITE TO MAKE UP LEVELS, GIVING DETAILS OF SPECIAL CONTOURING, EMBANKMENTS OR THE LIKE. Note there is NO 'removed' class, the asymmetry with B11's four: imported material is not taken away. If you want to bill 'filling — removed', you are in the wrong clause.

## B13  Piling generally

### B13.1
> For the purposes of measurement, driven piling shall include timber, precast concrete or metal piles.

**Unit:** `—` — no arithmetic — a descriptive, definitional or administrative rule

**In practice.** Driven piling includes timber, precast concrete and metal piles.

### B13.2
> Other piling systems (for example, preformed casing with concrete filling) shall be measured in accordance with the principles for driven piling or bored piling as may be appropriate.

**Unit:** `—` — no arithmetic — a descriptive, definitional or administrative rule

**In practice.** Other systems measured as driven or bored, whichever fits.

### B13.3
> Unless otherwise stated, reinforcement shall be measured in accordance with Section C.

**Unit:** `—` — no arithmetic — a descriptive, definitional or administrative rule

**In practice.** Pile reinforcement to Section C.

## B14  Driven piling

### B14.1
> Supplying piles shall be measured by length, stating the number; reinforcement shall be given separately.

**Unit:** `M` — by length, metres

```
L = Σ L_pile ; state N
```

**In practice.** SUPPLYING piles. Reinforcement given separately.

### B14.2
> Heads and shoes shall be enumerated.

**Unit:** `NR` — enumerated — a count

```
N = count
```

**In practice.** Heads and shoes.

### B14.3
> Driving piles shall be measured by length, taken from the pile point in contact with the ground when pitched to the pile point when driven, stating the number; driving piles on rake shall be so described.

**Unit:** `M` — by length, metres

```
L = Σ (pitched point → driven point) ; state N
```

**In practice.** DRIVING piles — a different length from supply. Raking piles SO DESCRIBED.

### B14.4
> Cutting off tops of piles and connections for lengthening piles shall be enumerated.

**Unit:** `NR` — enumerated — a count

```
N = count
```

**In practice.** Cutting off tops; connections for lengthening.

## B15  Bored piling

### B15.1
> Boring for piles shall be measured by length, taken from the formation level of the ground to the bottom of the pile hole, stating the number; the measurement shall include for blind boring when the pile top is to be below the formation level of the ground.

**Unit:** `M` — by length, metres

```
L = formation level → bottom of hole ; state N
```

**In practice.** Boring. INCLUDES blind boring where the pile top is below formation level.

### B15.2
> Boring through rock shall be measured by length as extra over boring for piles (that is, the length of boring through rock shall be measured but no deduction shall be made from the total length of boring).

**Unit:** `M` — by length, metres

```
L_rock measured; L_boring UNCHANGED
```

**In practice.** Boring through rock, EXTRA OVER.

### B15.3
> Linings for piles shall be measured by length.

**Unit:** `M` — by length, metres

```
L = Σ L_lining
```

**In practice.** Pile linings.

### B15.4
> Disposal of material arising from boring shall be measured in accordance with clause B11.

**Unit:** `M3` — by volume, cubic metres

```
per B11
```

**In practice.** Disposal of boring arisings.

### B15.5
> Concrete filling shall be measured by volume.

**Unit:** `M3` — by volume, cubic metres

```
V = Σ (π/4) × Ø² × L
```

**In practice.** Concrete filling to bored piles.

### B15.6
> Cutting off tops of piles and forming enlarged bases shall be enumerated.

**Unit:** `NR` — enumerated — a count

```
N = count
```

**In practice.** Cutting off tops; forming enlarged bases.

## B16  Sheet piling

### B16.1
> The measurements for sheet piling shall be taken along the centre line.

**Unit:** `RULE` — governs how OTHER quantities are calculated

**In practice.** ALL sheet piling measured along the CENTRE LINE.

### B16.2
> Supplying sheet piling shall be measured by area, taken as the area when in final position.

**Unit:** `M2` — by area, square metres

```
A = area IN FINAL POSITION
```

**In practice.** Supplying sheet piling.

### B16.3
> Corner piles or the like shall be measured by length.

**Unit:** `M` — by length, metres

```
L = Σ L
```

**In practice.** Corner piles.

### B16.4
> Driving sheet piling shall be measured by area, taken from the formation level of the ground to the bottom edge of the sheet piling when driven; strutting and waling and withdrawing sheet piling shall be understood to be included.

**Unit:** `M2` — by area, square metres

```
A = L_centreline × (formation level → bottom edge when driven)
```

**In practice.** Driving sheet piling BY AREA. The area is the CENTRE-LINE LENGTH (B16.1 fixes that every sheet-piling measurement is taken along the centre line) TIMES the driven depth, measured from the FORMATION LEVEL OF THE GROUND to the BOTTOM EDGE WHEN DRIVEN. A depth alone is not an area. NOTE THIS IS A DIFFERENT AREA FROM B16.2: supplying is measured as the area WHEN IN FINAL POSITION, driving from formation level — two correct areas for one wall of piles. STRUTTING, WALING AND WITHDRAWING ARE DEEMED INCLUDED, which is a large cost inside one clause and is why B16.6 'left in position' must be described when it applies.

### B16.5
> Cutting sheet piling shall be measured by length.

**Unit:** `M` — by length, metres

```
L = Σ L
```

**In practice.** Cutting sheet piling.

### B16.6
> Sheet piling which is required by the specification to be left in position shall be so described.

**Unit:** `—` — no arithmetic — a descriptive, definitional or administrative rule

**In practice.** Sheet piling left in position SO DESCRIBED.

## B17  Performance designed piling

### B17.1
> Performance designed piles shall be enumerated; reinforcement and disposal of material arising from boring shall be understood to be included.

**Unit:** `NR` — enumerated — a count

```
N = count
```

**In practice.** Performance designed piles. REINFORCEMENT AND DISPOSAL DEEMED INCLUDED — do not measure either.

### B17.2
> Details shall be given when the pile top is to be below the formation level of the ground.

**Unit:** `—` — no arithmetic — a descriptive, definitional or administrative rule

**In practice.** Details where the pile top is below formation level.

## B18  Testing piling

### B18.1
> Testing piling, which shall include trial piles and testing working piles, shall be given as an item.

**Unit:** `ITEM` — an ITEM — a lump, not a measured quantity

**In practice.** Testing piling — INCLUDES trial piles and testing working piles.

## B19  Underground drainage

### B19.1
> Drain pipes shall be measured by length, taken along the centre line over all fittings; drain pipes within inspection chambers or the like shall be so described and shall be understood to include fixings and supports.

**Unit:** `M` — by length, metres

```
L = Σ L_centreline, OVER ALL FITTINGS
```

**In practice.** Drain pipes. Pipes within chambers SO DESCRIBED and INCLUDE fixings and supports.

### B19.2
> Drain fittings in the length (for example, bends, junctions) shall be enumerated, grouped together for each size of pipe and described as 'fittings'.

**Unit:** `NR` — enumerated — a count

```
N = count, GROUPED per pipe size
```

**In practice.** Drain fittings in the length, described as 'fittings'.

### B19.3
> Drain accessories (for example, gullies, traps) shall be enumerated; concrete surrounds and additional excavation shall be understood to be included.

**Unit:** `NR` — enumerated — a count

```
N = count
```

**In practice.** Drain accessories. CONCRETE SURROUNDS AND ADDITIONAL EXCAVATION DEEMED INCLUDED.

### B19.4
> Concrete beds and coverings for drain pipes shall each be measured by length, stating the diameter of the pipe; surrounds to vertical pipes shall be so described and shall be understood to include formwork.

**Unit:** `M` — by length, metres

```
Len = Σ L, per class
```

**In practice.** Concrete beds and coverings for drain pipes shall EACH be measured BY LENGTH — 'each' meaning beds and coverings are SEPARATE items, not one combined item — STATING THE DIAMETER OF THE PIPE, which is a mandatory statement. BY LENGTH, NOT BY VOLUME. Surrounds to VERTICAL pipes are SO DESCRIBED and are DEEMED TO INCLUDE FORMWORK.

### B19.5
> Inspection chambers or the like shall be enumerated; alternatively, they may be measured in accordance with the relevant sections of this document and given under an appropriate heading.

**Unit:** `NR` — enumerated — a count

```
N = count
```

**In practice.** Inspection chambers — or measured to the relevant sections under a heading.

### B19.6
> Connections to existing drains shall be enumerated, subject to clause GP8.

**Unit:** `NR` — enumerated — a count

```
N = count
```

**In practice.** Connections to existing drains, SUBJECT TO GP8.

## B20  Paving and surfacing

### B20.1
> Paving and surfacing shall be measured by area.

**Unit:** `M2` — by area, square metres

```
A = Σ (L × W) − voids per GP3.2/GP3.3
```

**In practice.** Paving and surfacing.

### B20.2
> Expansion joints and water stops shall be measured by length.

**Unit:** `M` — by length, metres

```
L = Σ L
```

**In practice.** Expansion joints and water stops.

### B20.3
> Channels, curbs, edgings or the like shall be measured by length; curved work shall be so described.

**Unit:** `M` — by length, metres

```
L = Σ L
```

**In practice.** Channels, curbs, edgings. CURVED WORK SO DESCRIBED.

## B21  Fencing

### B21.1
> Fencing, which shall include posts and supports in the length, shall be measured by length; excavating pits, disposal and filling shall be understood to be included.

**Unit:** `M` — by length, metres

```
L = Σ L
```

**In practice.** Fencing. POSTS AND SUPPORTS IN THE LENGTH. EXCAVATING PITS, DISPOSAL AND FILLING DEEMED INCLUDED.

### B21.2
> Special posts (for example, gate posts, straining posts) shall be enumerated; excavating pits, disposal and filling shall be understood to be included.

**Unit:** `NR` — enumerated — a count

```
N = count
```

**In practice.** Special posts — gate, straining. Same deemed inclusions.

### B21.3
> Gates, barriers or the like shall be enumerated.

**Unit:** `NR` — enumerated — a count

```
N = count
```

**In practice.** Gates, barriers.

### B21.4
> Finishes shall be measured in accordance with Section J.

**Unit:** `—` — no arithmetic — a descriptive, definitional or administrative rule

**In practice.** Finishes to fencing measured to Section J.

## B22  Landscaping

### B22.1
> Cultivating and fertilising ground shall be measured by area.

**Unit:** `M2` — by area, square metres

```
A = Σ A
```

**In practice.** Cultivating and fertilising.

### B22.2
> Soiling, seeding and turfing shall be measured by area.

**Unit:** `M2` — by area, square metres

```
A = Σ A
```

**In practice.** Soiling, seeding, turfing.

### B22.3
> Hedges shall be measured by length.

**Unit:** `M` — by length, metres

```
L = Σ L
```

**In practice.** Hedges.

### B22.4
> Trees and shrubs shall be enumerated.

**Unit:** `NR` — enumerated — a count

```
N = count
```

**In practice.** Trees and shrubs.

## B23  Railway work

### B23.1
> Track, guard rails and conductor rails shall each be measured by length, taken along the centre line over all fittings; curved work shall be so described.

**Unit:** `M` — by length, metres

```
L = Σ L_centreline
```

**In practice.** Track, guard rails, conductor rails.

### B23.2
> Sleepers and chairs shall be enumerated.

**Unit:** `NR` — enumerated — a count

```
N = count
```

**In practice.** Sleepers and chairs.

### B23.3
> Switches and crossings shall be enumerated, classified as follows: 1. Switches and turnouts 2. Diamond crossings 3. Single slip crossings 4. Double slip crossings 5. Other switches and crossings.

**Unit:** `NR` — enumerated — a count

```
N = count
```

**In practice.** Switches and crossings ENUMERATED, FIVE classes: 1 SWITCHES AND TURNOUTS · 2 DIAMOND CROSSINGS · 3 SINGLE SLIP CROSSINGS · 4 DOUBLE SLIP CROSSINGS · 5 other switches and crossings. Single and double slips are separate classes — they are not one 'slip crossing' item.

### B23.4
> Ballast shall be measured by volume, without deduction for track, classified as follows: 1. Bottom ballast, placed before the track is laid 2. Top ballast, placed after the track is laid.

**Unit:** `M3` — by volume, cubic metres

```
V = Σ V, NO DEDUCTION FOR TRACK
```

**In practice.** Ballast by VOLUME, WITHOUT DEDUCTION FOR THE TRACK, TWO classes distinguished by WHEN it is placed: 1 BOTTOM BALLAST, PLACED BEFORE THE TRACK IS LAID · 2 TOP BALLAST, PLACED AFTER THE TRACK IS LAID. The sequence is the classification; measuring one ballast item loses it.

### B23.5
> Concrete track foundations shall be measured by length, except that overwidth foundations for switches and crossings shall be measured by area; reinforcement and shuttering shall be understood to be included.

**Unit:** `M` — by length, metres

```
L = Σ L
```

**In practice.** Concrete track foundations; OVERWIDTH foundations by volume.

### B23.6
> Bitumen filler to complete rail assemblies shall be measured by length.

**Unit:** `M` — by length, metres

```
L = Σ L
```

**In practice.** Bitumen filler to rail assemblies.

### B23.7
> Buffer stops, wheel stops or the like shall be enumerated.

**Unit:** `NR` — enumerated — a count

```
N = count
```

**In practice.** Buffer stops, wheel stops.

### B23.8
> Signalling installations shall be measured in accordance with Section L or Section R.

**Unit:** `—` — no arithmetic — a descriptive, definitional or administrative rule

**In practice.** Signalling to Section L or Section R.

## B24  Tunnel excavation

### B24.1
> Excavation shall be measured by volume as the void which is to be occupied, including the volume of permanent linings, grouped as may be appropriate to identify different lengths and classified as follows: 1. Straight tunnels 2. Straight shafts 3. Curved tunnels 4. Curved shafts 5. Tapered tunnels 6. Tapered shafts 7. Other cavities, which shall include transitions, breakaways and intersections between shafts and tunnels.

**Unit:** `M3` — by volume, cubic metres

```
V = void to be occupied, INCLUDING the lining
```

**In practice.** Tunnel excavation, SEVEN classes: straight tunnels · straight shafts · curved tunnels · curved shafts · tapered tunnels · tapered shafts · other cavities, which INCLUDE transitions, breakaways and intersections between shafts and tunnels.

### B24.2
> Forward probing shall be measured by length, stating the number of probes.

**Unit:** `M` — by length, metres

```
L = Σ L ; state number of probes
```

**In practice.** Forward probing.

### B24.3
> For disposal see clause B11.

**Unit:** `—` — no arithmetic — a descriptive, definitional or administrative rule

**In practice.** Tunnel disposal per B11.

## B25  Tunnel linings

### B25.1
> Poured concrete linings shall be measured by area, stating whether spray or cast concrete, classified as follows: 1. lining 2. Secondary lining.

**Unit:** `M2` — by area, square metres

```
A = Σ A
```

**In practice.** Poured concrete tunnel linings by AREA, STATING WHETHER SPRAY OR CAST CONCRETE, TWO classes: 1 [primary] LINING — the RICS text prints this class as bare 'lining', with the qualifying word lost in the source; read against class 2 it is the PRIMARY lining · 2 SECONDARY LINING. Measure the two separately; a single lining item cannot be priced, because primary and secondary are different operations at different times.

### B25.2
> Preformed segmental tunnel linings shall be enumerated.

**Unit:** `NR` — enumerated — a count

```
N = count
```

**In practice.** Preformed segmental linings.

## B26  Tunnel support and stabilisation

### B26.1
> Timber supports shall be measured by volume.

**Unit:** `M3` — by volume, cubic metres

```
V = Σ V
```

**In practice.** Timber tunnel supports.

### B26.2
> Sprayed concrete supports and reinforcement shall be measured by area.

**Unit:** `M2` — by area, square metres

```
A = Σ A
```

**In practice.** Sprayed concrete supports and reinforcement.

### B26.3
> Rock bolts shall be measured by length.

**Unit:** `M` — by length, metres

```
L = Σ L
```

**In practice.** Rock bolts.

### B26.4
> Face packers shall be enumerated.

**Unit:** `NR` — enumerated — a count

```
N = count
```

**In practice.** Face packers.

### B26.5
> Metal arch supports shall be measured by weight.

**Unit:** `KG` — by weight, kilogrammes

```
W = Σ L × m_per_m
```

**In practice.** Metal arch supports.

### B26.6
> Injection of grout materials shall be measured by weight.

**Unit:** `KG` — by weight, kilogrammes

```
W = Σ W_grout
```

**In practice.** Injection of grout materials.

# SECTION C — CONCRETE WORK
*7 groups · 36 clauses · 25 carrying arithmetic*

## C1  Generally

### C1.1
> Reinforced poured concrete and plain poured concrete shall each be so described.

**Unit:** `—` — no arithmetic — a descriptive, definitional or administrative rule

**In practice.** Reinforced and plain poured concrete EACH SO DESCRIBED.

### C1.2
> Poured concrete required by the specification to be placed, compacted, cured or otherwise treated in a particular manner shall be so described.

**Unit:** `—` — no arithmetic — a descriptive, definitional or administrative rule

**In practice.** Special placing, compacting, curing or treatment SO DESCRIBED.

### C1.3
> No deduction shall be made for voids less than 1.00 m3, nor for the volume of any reinforcement or structural metal enclosed in the concrete, except that voids caused by boxed or tubular structural metalwork shall always be deducted.

**Unit:** `RULE` — governs how OTHER quantities are calculated

```
V_net = V_gross − Σ V_void(≥1.00 m³) − Σ V_boxed_or_tubular_steel
```

**In practice.** The concrete deduction rule. NO deduction for rebar or for solid enclosed steel. BOXED OR TUBULAR steel is ALWAYS deducted, at any size.

### C1.4
> Unless otherwise described, horizontal surfaces of concrete shall be understood to be tamped.

**Unit:** `—` — no arithmetic — a descriptive, definitional or administrative rule

**In practice.** Horizontal concrete surfaces UNDERSTOOD TO BE TAMPED unless otherwise described — so a tamped finish is not a measurable item.

## C2  Poured concrete

### C2.1
> Unless otherwise stated, poured concrete shall be measured by volume, classified as follows: 1. Foundations, which shall include combined or isolated bases 2. Pile caps, which shall include ground beams 3. Blinding 4. Beds, which shall include roads and footpaths, stating the thickness 5. Suspended slabs, which shall include floors, landings, roofs or the like, stating the thickness 6. Walls, which shall include attached columns, stating the thickness 7. Columns, which shall include casing to metal stancheons 8. Beams (measured below the slab), which shall include lintels and casing to metal beams 9. Staircases, which shall include steps and strings 10. Diaphragm walls 11. Other classifications (for example, tunnel linings, bridge abutments) as may be appropriate.

**Unit:** `M3` — by volume, cubic metres

```
V = N × L × W × T
```

**In practice.** Poured concrete by VOLUME, ELEVEN classes: 1 FOUNDATIONS, which INCLUDE combined or isolated bases · 2 PILE CAPS, which INCLUDE GROUND BEAMS · 3 BLINDING · 4 BEDS, which INCLUDE ROADS AND FOOTPATHS, STATING THE THICKNESS · 5 SUSPENDED SLABS, which INCLUDE floors, landings and roofs, STATING THE THICKNESS · 6 WALLS, which INCLUDE ATTACHED COLUMNS, STATING THE THICKNESS · 7 COLUMNS, which INCLUDE CASING TO METAL STANCHEONS · 8 BEAMS, MEASURED BELOW THE SLAB, which INCLUDE lintels and casing to metal beams — V = N × b × (D − t_slab) × L · 9 STAIRCASES, which INCLUDE STEPS AND STRINGS · 10 DIAPHRAGM WALLS · 11 other classifications, e.g. tunnel linings, bridge abutments. Classes 4, 5 and 6 each STATE THE THICKNESS.

### C2.2
> Poured concrete suspended slabs of special construction, including floors, landings, roofs or the like, shall be measured by area; coffered and troughed slabs shall be so described, giving details of solid margins or the like.

**Unit:** `M2` — by area, square metres

```
A = Σ (L × W) − voids
```

**In practice.** Suspended slabs of SPECIAL construction BY AREA, not volume. Coffered and troughed SO DESCRIBED with details of solid margins.

### C2.3
> Where an item is required to be measured by volume and the thickness stated, then items of differing thickness may be grouped together, provided that the range of the different thicknesses is stated.

**Unit:** `—` — no arithmetic — a descriptive, definitional or administrative rule

**In practice.** Differing thicknesses MAY be GROUPED provided the RANGE is stated. HOUSE RULE: grouping is used, but ONLY WITHIN ONE CONSTRUCTION STAGE — substructure, superstructure, roof. Items are never grouped ACROSS stages, because a 200 mm raft and a 200 mm roof slab do not price alike and a range spanning them tells a tenderer nothing. Grouping removes the individual thickness statement C2.1 cl.4, cl.5 and cl.6 require, so the stated range is what carries that duty and it must be tight.

## C3  Reinforcement

### C3.1
> The weight of bar reinforcement shall be the net weight without addition for rolling margin, supports, spacers or tying wire.

**Unit:** `KG` — by weight, kilogrammes

```
W = Σ (N_bars × L_bar_INCLUDING_LAPS × m_per_m(Ø))
```

**In practice.** THE NET WEIGHT RULE, and read its exclusion list EXACTLY: no addition for ROLLING MARGIN, SUPPORTS, SPACERS or TYING WIRE. LAPS ARE NOT IN THAT LIST. A lap is steel fixed in position, so under GP3.1 it IS measured — and the contrast with C3.3, which excludes laps from FABRIC in terms, proves the omission here is deliberate. WHAT IS FORBIDDEN is a BLANKET PERCENTAGE UPLIFT with no derivation. HOUSE RULE ON THE SOURCE: reinforcement is MEASURED FROM THE SECTION DRAWINGS, never from a bar bending schedule. N_bars = (L_run / spacing) + 1 read off the section; each lap derived from the SPECIFIED LAP LENGTH (k x diameter) at the positions the section shows. A BBS, where one is later issued, is a CROSS-CHECK ONLY — reconcile and record the variance, raise a technical query on a real difference, but do not adopt the schedule's figure. Chairs, spacers and tying wire remain excluded at all times.

### C3.2
> Bar reinforcement shall be measured by weight, stating the diameter; bars of differing diameters shall be given separately.

**Unit:** `KG` — by weight, kilogrammes

```
W = Σ N_bars × L_bar × m_per_m(Ø)
m_per_m = (π/4) × Ø² × 7850 / 1e6
```

**In practice.** Bar reinforcement, STATING THE DIAMETER. Differing diameters GIVEN SEPARATELY — never a blended tonnage.

### C3.3
> Fabric reinforcement shall be measured by area, without addition for laps.

**Unit:** `M2` — by area, square metres

```
A = A_covered, NO addition for laps
```

**In practice.** Fabric reinforcement. A lap covers the same square metre twice.

### C3.4
> Reinforcement shall be given as an item where the detailed design work is the responsibility of the contractor.

**Unit:** `ITEM` — an ITEM — a lump, not a measured quantity

**In practice.** Reinforcement as an ITEM where the detailed design is the contractor's responsibility.

## C4  Shuttering

### C4.1
> Unless otherwise stated, shuttering shall be measured by area, taken as the net area in contact with the finished face of concrete, classified as follows: 1. Soffits; shuttering to soffits of special construction shall be so described 2. Sloping soffits, which shall include soffits of staircases 3. Sloping upper surfaces, which shall include surfaces more than 15° from horizontal 4. Sides of foundations, which shall include bases, pile caps and ground beams 5. Sides of walls, which shall include attached columns 6. Returns to walls, which shall include ends, projections and reveals of openings or recesses 7. Sides and soffits of beams, which shall include lintels and breaks in soffits; isolated beams shall be so described 8. Sides and soffits of sloping beams, which shall include lintels and breaks in soffits; isolated beams shall be so described 9. Sides of columns 10. Staircases, which shall include treads, risers and strings but exclude soffits 11. Other classifications (for example, tunnel linings, bridges, bridge abutments) as may be appropriate.

**Unit:** `M2` — by area, square metres

```
A = Σ A_contact
```

**In practice.** Shuttering as the NET AREA IN CONTACT with the finished face of the concrete, ELEVEN classes: 1 SOFFITS — soffits of special construction SO DESCRIBED · 2 SLOPING SOFFITS, which INCLUDE SOFFITS OF STAIRCASES · 3 SLOPING UPPER SURFACES, which are surfaces MORE THAN 15° FROM HORIZONTAL · 4 SIDES OF FOUNDATIONS, which INCLUDE bases, pile caps and ground beams · 5 SIDES OF WALLS, which INCLUDE ATTACHED COLUMNS · 6 RETURNS TO WALLS, which INCLUDE ends, projections and reveals of openings or recesses · 7 SIDES AND SOFFITS OF BEAMS, which INCLUDE lintels and breaks in soffits; ISOLATED BEAMS SO DESCRIBED — A = L × (2·h_exposed + b) · 8 SIDES AND SOFFITS OF SLOPING BEAMS, same inclusions, isolated so described · 9 SIDES OF COLUMNS · 10 STAIRCASES, which INCLUDE treads, risers and strings BUT EXCLUDE SOFFITS — the soffit is class 2 · 11 other classifications. The 15° line in class 3 and the staircase split between 2 and 10 are the two places shuttering is most often misclassified.

### C4.2
> Shuttering to edges, which shall include face of curb or upstand or break in upper surface of floor, shall be measured by length; items of differing height may be grouped together, provided that the range of different heights is stated.

**Unit:** `M` — by length, metres

```
L = Σ L
```

**In practice.** Shuttering to EDGES — includes curb face, upstand, break in upper surface of floor. Heights may be grouped if the RANGE is stated.

### C4.3
> Grooves, which shall include throats, rebates, chamfers or the like, 2500 mm2 sectional area or over shall be measured by length; grooves less than 2500 mm2 sectional area shall be understood to be included.

**Unit:** `M` — by length, metres

```
if sectional area ≥ 2500 mm² → Len = Σ L
if sectional area <  2500 mm² → DEEMED INCLUDED
```

**In practice.** THE 2500 mm² THRESHOLD. Grooves — which INCLUDE throats, rebates and CHAMFERS — of 2500 mm² SECTIONAL AREA OR OVER are measured by length; under that they are DEEMED INCLUDED. COMPUTE THE SECTIONAL AREA FROM THE SHAPE, NOT FROM THE LEG DIMENSIONS. A chamfer is a TRIANGLE: 50 x 50 mm legs give ½ × 50 × 50 = 1250 mm², which is UNDER the threshold and therefore FREE. A chamfer only reaches 2500 mm² at about 71 x 71 mm legs. A rebate or a throat is rectangular, so 50 x 50 there IS 2500 mm² and is measured. Reading the leg dimensions as the area bills a whole class of chamfers POMI deems included.

### C4.4
> Shuttering may be enumerated where it is more appropriate to do so (for example, decorative features).

**Unit:** `NR` — enumerated — a count

```
N = count
```

**In practice.** Shuttering may be ENUMERATED where more appropriate — decorative features.

### C4.5
> Shuttering which is required by the specification to be left in position shall be so described.

**Unit:** `—` — no arithmetic — a descriptive, definitional or administrative rule

**In practice.** Shuttering left in position SO DESCRIBED.

### C4.6
> Shuttering to curved, conical and spherical surfaces shall each be so described.

**Unit:** `—` — no arithmetic — a descriptive, definitional or administrative rule

**In practice.** Curved, conical and spherical shuttering EACH SO DESCRIBED — described, not uplifted.

### C4.7
> Shuttering to provide a special finish shall be so described.

**Unit:** `—` — no arithmetic — a descriptive, definitional or administrative rule

**In practice.** Shuttering for a special finish SO DESCRIBED.

### C4.8
> Unless otherwise stated, if the volume of concrete has not been deducted, shuttering to the faces of a void shall be understood to be included.

**Unit:** `RULE` — governs how OTHER quantities are calculated

```
if V_concrete NOT deducted → shuttering to the void DEEMED INCLUDED
```

**In practice.** Pairs with C1.3. Deduct neither or both, never one.

## C5  Precast concrete

### C5.1
> Moulds for precast units shall be understood to be included.

**Unit:** `—` — no arithmetic — a descriptive, definitional or administrative rule

**In practice.** Moulds for precast units DEEMED INCLUDED. Never a separate item.

### C5.2
> Reinforcement shall be measured in accordance with clause C3 and given under an appropriate heading; alternatively, it may be described in the item.

**Unit:** `KG` — by weight, kilogrammes

```
per C3
```

**In practice.** Precast reinforcement under a heading, or described in the item.

### C5.3
> Floor slabs, partition slabs or the like shall be measured by area. .'

**Unit:** `M2` — by area, square metres

```
A = Σ A
```

**In practice.** Precast floor slabs, partition slabs.

### C5.4
> Lintels, sills, duct covers or the like shall be measured by length; alternatively, duct covers may be measured by area.

**Unit:** `M` — by length, metres

```
L = Σ L
```

**In practice.** Lintels, sills, duct covers. Duct covers ALTERNATIVELY by area.

### C5.5
> Structural units (for example, beams, stanchions, tunnel rings) shall be enumerated.

**Unit:** `NR` — enumerated — a count

```
N = count
```

**In practice.** Precast structural units — beams, stanchions, tunnel rings.

### C5.6
> Padstones, cappings or the like shall be enumerated.

**Unit:** `NR` — enumerated — a count

```
N = count
```

**In practice.** Padstones, cappings.

## C6  Prestressed concrete

### C6.1
> Prestressed concrete work shall be given under an appropriate heading.

**Unit:** `—` — no arithmetic — a descriptive, definitional or administrative rule

**In practice.** Prestressed work under its own heading.

### C6.2
> Prestressed concrete shall be measured by volume, classified in accordance with clause C2.

**Unit:** `M3` — by volume, cubic metres

```
V per C2 classes
```

**In practice.** Prestressed concrete by volume.

### C6.3
> Reinforcement shall be measured in accordance with clause C3; supporting steel wires or cables shall be measured by weight.

**Unit:** `KG` — by weight, kilogrammes

```
per C3; supporting wires/cables BY WEIGHT
```

**In practice.** Prestressing reinforcement.

### C6.4
> Shuttering shall be measured in accordance with clause C4, stating whether to pre-tensioned or post-tensioned members.

**Unit:** `M2` — by area, square metres

```
per C4
```

**In practice.** Prestressed shuttering, STATING pre-tensioned or post-tensioned.

## C7  Sundries

### C7.1
> Surfaces finished to falls or cross-falls shall be measured by area.

**Unit:** `M2` — by area, square metres

```
A = Σ A
```

**In practice.** Surfaces finished to falls or cross-falls.

### C7.2
> Surface finishes shall be measured by area, except that tamped finishes shall be understood to be included.

**Unit:** `M2` — by area, square metres

```
A = Σ A
```

**In practice.** Surface finishes — EXCEPT tamped, which is deemed included per C1.4.

### C7.3
> Expansion material or the like shall be measured by area.

**Unit:** `M2` — by area, square metres

```
A = Σ A
```

**In practice.** Expansion material.

### C7.4
> Designed joints, water stops, cast-in channels or the like shall be measured by length.

**Unit:** `M` — by length, metres

```
L = Σ L
```

**In practice.** Designed joints, water stops, cast-in channels.

### C7.5
> Forming sinkings, channels or the like shall be measured by length and, where appropriate, the item may include additional excavation, hardcore, shuttering and concrete; alternatively, they may be enumerated.

**Unit:** `M / NR`

```
L = Σ L, or N = count
```

**In practice.** Sinkings and channels. The item MAY include additional excavation, hardcore, shuttering and concrete.

### C7.6
> Fixings, ties, inserts or the like shall be enumerated; alternatively, they may be measured by area.

**Unit:** `NR / M2`

```
N = count, or A = Σ A
```

**In practice.** Fixings, ties, inserts.

### C7.7
> Mortices, holes or the like shall be understood to be included.

**Unit:** `—` — no arithmetic — a descriptive, definitional or administrative rule

**In practice.** Mortices and holes DEEMED INCLUDED. Measure nothing.

# SECTION D — MASONRY
*5 groups · 10 clauses · 8 carrying arithmetic*

## D1  Generally

### D1.1
> Sloping, battering and curved work shall each be so described.

**Unit:** `—` — no arithmetic — a descriptive, definitional or administrative rule

**In practice.** Sloping, battering and curved work EACH SO DESCRIBED.

### D1.2
> Reinforced masonry shall be so described.

**Unit:** `—` — no arithmetic — a descriptive, definitional or administrative rule

**In practice.** Reinforced masonry SO DESCRIBED.

## D2  Walls and piers

### D2.1
> Walls and piers shall be measured by area, classified as follows: 1. Walls; integral piers shall be measured as walls of combined pier and wall thickness 2. Walls built against other construction 3. Cavity walls measured as a composite item, including skins and cavity; alternatively, the skins and cavity may each be measured by area. Closing cavity walls at ends or around openings shall be understood to be included 4. Isolated piers.

**Unit:** `M2` — by area, square metres

```
A = Σ (L × H) − voids per GP3.2/GP3.3
```

**In practice.** Walls and piers, FOUR classes. cl.1 INTEGRAL PIERS measured as WALLS at the COMBINED pier+wall thickness. cl.2 walls built against other construction, SO DESCRIBED. cl.3 CAVITY WALLS — POMI permits EITHER one composite item including skins and cavity, OR the skins and cavity EACH measured by area. HOUSE DEFAULT: THE COMPOSITE ITEM, one area at one description carrying the whole build-up, because it prices as one operation. State it in the preambles. What is wrong is MIXING the two methods in one bill. CLOSING CAVITY WALLS at ends and around openings is DEEMED INCLUDED under either method. cl.4 isolated piers.

### D2.2
> Faced or fair faced work shall each be so described; alternatively, it may be measured as extra over walls, stating whether faced or fair faced on one or both sides (that is, the area of faced or fair faced work shall be measured but no deduction shall be made from the area of walling on which the faced or fair faced work occurs).

**Unit:** `M2` — by area, square metres

```
A_wall = FULL area, UNCHANGED
A_faced = measured AS WELL
```

**In practice.** Faced or fair faced work: POMI permits EITHER each SO DESCRIBED as its own wall item, OR measured as EXTRA OVER walls. HOUSE DEFAULT: EXTRA OVER — the wall area stays whole and the faced area is measured AS WELL, STATING WHETHER ONE SIDE OR BOTH. NO DEDUCTION is made from the walling on which the faced work occurs; deducting it loses the base item, which is the same error as B8.5 rock, B15.2 rock boring and G2.3 special sheets. 'One side or both' is a MANDATORY STATEMENT — fair faced both sides is twice the work at the same wall area.

## D3  Sills, etc.

### D3.1
> Sills, copings, oversailing or receding courses or the like shall be measured by length.

**Unit:** `M` — by length, metres

```
L = Σ L
```

**In practice.** Sills, copings, oversailing or receding courses.

### D3.2
> Arches shall be measured by length.

**Unit:** `M` — by length, metres

```
Len = Σ L
```

**In practice.** Arches BY LENGTH. THAT IS THE WHOLE CLAUSE — POMI states no basis along which the length is taken. HOUSE EXTENSION under GP1.1, declared: the length is taken on the MEAN GIRTH, L = π × (R_intrados + t/2) × (θ/180) for a curved arch, because the mean girth is the line the work actually follows and both the span and the intrados understate it. This is the HOUSE's basis, not POMI's, and it is recorded in the Appendix under GP1.2. GP5.2 separately requires the cross-sectional size or girth to be STATED in the description.

## D4  Reinforcement

### D4.1
> Reinforcement shall be measured in accordance with clause C3; alternatively, fabric reinforcement may be measured by length.

**Unit:** `KG / M2 / M`

```
bar: per C3 by weight
fabric: per C3 by area, OR by LENGTH
```

**In practice.** Reinforcement measured in accordance with Section C — so C3.1's net-weight rule applies, and with it the house rule that bar is MEASURED FROM THE SECTION DRAWINGS with laps taken at the specified lap length. D4.1 additionally permits BED-JOINT FABRIC to be measured BY LENGTH instead of by area. HOUSE DEFAULT: BY LENGTH, which is the natural unit for brick-force in a bed joint. Choose one and hold it across the bill.

## D5  Sundries

### D5.1
> Concrete filling to cavities shall be measured by area.

**Unit:** `M2` — by area, square metres

```
A = Σ A
```

**In practice.** Concrete filling to cavities — BY AREA, thickness in the description per GP5.3. Not by volume.

### D5.2
> Expansion joints or the like shall be measured by length.

**Unit:** `M` — by length, metres

```
L = Σ L
```

**In practice.** Expansion joints.

### D5.3
> Air bricks or the like shall be enumerated.

**Unit:** `NR` — enumerated — a count

```
N = count
```

**In practice.** Air bricks.

# SECTION E — METALWORK
*3 groups · 11 clauses · 8 carrying arithmetic*

## E1  Generally

### E1.1
> The weight of metalwork shall be the net weight, without addition for rolling margin or welding material and without deduction for holes, splay cuts, notches or the like.

**Unit:** `KG` — by weight, kilogrammes

```
W = Σ (N × L_gross × m_per_m(section))
```

**In practice.** THE NET WEIGHT RULE, and it cuts BOTH ways. NO ADDITION for rolling margin or welding material — a fabricator's own tonnage adds both, because that is what he buys and consumes, and both are RATE matters under GP4.1. NO DEDUCTION for holes, splay cuts, notches or the like — a careful measurer deducts them because they are visibly not steel, and POMI forbids that too. The two errors pull in opposite directions and partially cancel, so a wrong figure can foot to about the right total, which is exactly why neither gets caught. It is the GROSS SECTION over the GROSS LENGTH: a beam notched at both ends and drilled for twelve bolts is still its full length at its full unit mass.

### E1.2
> Welded, riveted or bolted work shall each be so described.

**Unit:** `—` — no arithmetic — a descriptive, definitional or administrative rule

**In practice.** Welded, riveted or bolted work EACH SO DESCRIBED.

## E2  Structural metalwork

### E2.1
> Unless otherwise stated, structural metalwork shall be measured by weight, classified as follows: 1. Grillages 2. Beams 3. Stanchions 4. Portal frames, stating the number 5. Roof trusses, stating the number 6. Support steelwork, which shall include sheeting rails, braces, struts or the like 7. Other classifications, as may be appropriate.

**Unit:** `KG` — by weight, kilogrammes

```
W = Σ N × L × m_per_m, per class
```

**In practice.** Structural metalwork by WEIGHT, SEVEN classes: 1 GRILLAGES · 2 BEAMS · 3 STANCHIONS · 4 PORTAL FRAMES, STATING THE NUMBER · 5 ROOF TRUSSES, STATING THE NUMBER · 6 SUPPORT STEELWORK, which INCLUDES sheeting rails, braces, struts or the like · 7 other classifications. Classes 4 and 5 carry a mandatory NUMBER as well as the weight.

### E2.2
> Fittings (for example, caps, brackets) shall be given as an item.

**Unit:** `ITEM` — an ITEM — a lump, not a measured quantity

**In practice.** Fittings — caps, brackets. An ITEM, not weight.

### E2.3
> Fixings (for example, bolts, distance pieces, rivets) shall be given as an item.

**Unit:** `ITEM` — an ITEM — a lump, not a measured quantity

**In practice.** Fixings — bolts, distance pieces, rivets. An ITEM, not weight.

### E2.4
> Wedging and grouting bases or the like shall be enumerated.

**Unit:** `NR` — enumerated — a count

```
N = count
```

**In practice.** Wedging and grouting bases.

### E2.5
> Holding down bolts or the like shall be enumerated; temporary boxes and grouting shall be understood to be included.

**Unit:** `NR` — enumerated — a count

```
N = count
```

**In practice.** Holding-down bolts. TEMPORARY BOXES AND GROUTING DEEMED INCLUDED.

### E2.6
> Protective treatment shall be given as an item.

**Unit:** `M2` — by area, square metres

```
A = Σ A_treated_surface
```

**In practice.** Protective treatment. POMI SAYS AN ITEM. HOUSE AMENDMENT, DECLARED UNDER GP1.2 AND RECORDED IN POMI'S APPENDIX: it is MEASURED BY AREA. The treated surface is the cost driver — a galvanising or intumescent system prices per square metre, and the surface area of a tonne of steel varies several-fold between a heavy stanchion and a light truss. An item forces the tenderer to compute that area himself and price a risk he cannot see, and it cannot be valued on variation. The AREA is measured; the SYSTEM stays in the description. Surface area is the developed girth of the section times its length, plus the area of any plates and cleats.

## E3  Non-structural metalwork

### E3.1
> Floor plates, duct covers, sheet metal coverings and linings or the like shall be measured by area.

**Unit:** `M2` — by area, square metres

```
A = Σ A
```

**In practice.** Floor plates, duct covers, sheet coverings and linings.

### E3.2
> Bearers, balustrades, handrails (except where included with a staircase), frames or the like shall be measured by length.

**Unit:** `M` — by length, metres

```
Len = Σ L
```

**In practice.** Bearers, balustrades, handrails, frames BY LENGTH. POMI's exception reads 'except where included with a staircase'. HOUSE ELECTION: THE HANDRAIL IS A SEPARATE LENGTH ITEM and the enumerated staircase under E3.3 is DESCRIBED AS EXCLUDING IT. This is within the clause — the handrail is only inside the staircase where the bill puts it there — and it prices the two properly, because a balustrade is a different trade and a different rate from the stair. THE STAIRCASE DESCRIPTION MUST SAY 'excluding handrail', or the two readings collide and the handrail is billed twice or not at all.

### E3.3
> Matwell frames, cat ladders, gates, staircases or the like shall be enumerated.

**Unit:** `NR` — enumerated — a count

```
N = count
```

**In practice.** Matwell frames, cat ladders, gates and STAIRCASES ENUMERATED — never weighed, never measured by rise. GP5.1 governs: there is no dimension carrying information, so the words carry all of it. Under the house election at E3.2 the staircase is DESCRIBED AS EXCLUDING THE HANDRAIL, which is measured separately by length.

# SECTION F — WOODWORK
*10 groups · 22 clauses · 17 carrying arithmetic*

## F1  Generally

### F1.1
> Timber which is sawn (that is, not milled) and timber which is finished (that is, milled) shall each be so described.

**Unit:** `—` — no arithmetic — a descriptive, definitional or administrative rule

**In practice.** SAWN (not milled) and FINISHED (milled) timber EACH SO DESCRIBED.

### F1.2
> Descriptions of timber members shall state whether the sizes are basic (that is, before machining) or finished (that is, milled, within permitted deviations).

**Unit:** `RULE` — governs how OTHER quantities are calculated

**In practice.** Descriptions SHALL STATE whether sizes are BASIC (before machining) or FINISHED (milled, within permitted deviations). HOUSE RULE: FOLLOW THE PROJECT DESCRIPTION — take whichever basis the specification and drawings use and state it; do not convert one to the other and do not assume a house default. The statement is mandatory, its VALUE comes from the source documents. This matters commercially: a '50 x 200' quoted BASIC finishes at about 45 x 195 after machining — same words, different timber, different price. An F item with no basic/finished statement is incomplete under GP5, and it is the most-missed mandatory statement in the section because the size looks complete on its own.

## F2  Structural timbers

### F2.1
> Structural timbers shall be measured by length, classified as follows: 1. Floors and flat roofs 2. Pitched roofs 3. Walls 4. Kerbs, bearers or the like 5. Cleats, sprockets or the like.

**Unit:** `M` — by length, metres

```
L = Σ N × L, per class
```

**In practice.** Structural timbers by LENGTH, FIVE classes by WHERE THE TIMBER IS, not what it is: 1 FLOORS AND FLAT ROOFS · 2 PITCHED ROOFS · 3 WALLS · 4 KERBS, BEARERS or the like · 5 CLEATS, SPROCKETS or the like. Cross-sectional size goes in the description per GP5.2 — it is never turned into a volume.

### F2.2
> Strutting and bridging between joists shall be measured by length, taken overall the joists.

**Unit:** `M` — by length, metres

```
Len = Σ L, TAKEN OVERALL THE JOISTS
```

**In practice.** Strutting and bridging between joists BY LENGTH, TAKEN OVERALL THE JOISTS — the full width of the floor in one measurement, NOT the sum of the individual struts between each pair. A herringbone run across nine joists is one length across the whole span. Measuring strut by strut is the same over-measure as measuring open-spaced battens individually under F4.1.

## F3  Boarding and flooring

### F3.1
> Unless otherwise stated, boarding and flooring shall be measured by area, without addition for joints or laps, classified as follows: 1. Floors, which shall include landings 2. Walls, which shall include returns, reveals of openings or recesses and attached and unattached columns 3. Ceilings, which shall include attached and unattached beams and soffits of staircases 4. Roofs, which shall include tops and cheeks of dormers and sides and bottoms of gutters, stating whether flat, sloping or vertical; firring pieces and bearers shall be understood to be included.

**Unit:** `M2` — by area, square metres

```
A = Σ (L × W) − voids, NO laps or joints
```

**In practice.** Boarding and flooring, four classes. cl.2 walls INCLUDE returns, reveals and attached AND unattached columns. cl.3 ceilings INCLUDE beams and staircase soffits. cl.4 roofs INCLUDE dormers and gutters; FIRRINGS AND BEARERS DEEMED INCLUDED; state flat, sloping or vertical.

### F3.2
> Eaves and verge boards, which shall include fascias, barge boards or the like, shall be measured by length.

**Unit:** `M` — by length, metres

```
L = Σ L
```

**In practice.** Eaves and verge boards — INCLUDE fascias and barge boards.

### F3.3
> Fillets and rolls shall be measured by length.

**Unit:** `M` — by length, metres

```
L = Σ L
```

**In practice.** Fillets and rolls.

## F4  Grounds and battens

### F4.1
> Open-spaced grounds and battens shall be measured by area, taken overall.

**Unit:** `M2` — by area, square metres

```
A = Σ A, TAKEN OVERALL the surface covered
```

**In practice.** OPEN-SPACED grounds and battens BY AREA TAKEN OVERALL — not by the length of the timber. Battens at 400 mm centres over a 6.00 x 4.00 m wall are 24.00 m2, NOT 15 x 4.00 m = 60 m. Different unit AND two to three times the magnitude. The test is one word, OPEN-SPACED: a run of battens at centres over a surface is open-spaced and goes to area; a single ground round a door opening is individual and goes to F4.2 by length.

### F4.2
> Individual grounds and battens shall be measured by length.

**Unit:** `M` — by length, metres

```
L = Σ L
```

**In practice.** INDIVIDUAL grounds and battens.

## F5  Framework

### F5.1
> Framework shall be measured by area, taken overall; alternatively, it may be measured by length.

**Unit:** `M2` — by area, square metres

```
A = Σ A, TAKEN OVERALL
```

**In practice.** Framework. POMI permits AREA TAKEN OVERALL or, expressly, by LENGTH, with no preference. HOUSE ELECTION: AREA TAKEN OVERALL, matching F4.1's treatment of open-spaced work — a stud framework is a surface, and measuring the studs by length over-measures for the same reason battens do. Hold it across the whole bill: a framework in m2 on one elevation and m on the next cannot be summed or checked.

## F6  Finishings and fittings

### F6.1
> Finishings shall be measured by length, classified as follows: 1. Cover fillets, which shall include architraves, skirtings or the like 2. Beads, which shall include stops or the like 3. Edgings, which shall include window boards, nosings or the like.

**Unit:** `M` — by length, metres

```
L = Σ L, per class
```

**In practice.** Finishings: 1 cover fillets (incl. architraves, skirtings) · 2 beads (incl. stops) · 3 edgings (incl. window boards, nosings).

### F6.2
> Unless otherwise stated, fittings shall be measured by length, classified as follows: 1. Work tops, which shall include seats or the like 2. Handrails or balustrades.

**Unit:** `M` — by length, metres

```
L = Σ L, per class
```

**In practice.** Fittings: 1 work tops (incl. seats) · 2 handrails/balustrades.

### F6.3
> Shelving shall be measured by area; alternatively, it may be measured by length.

**Unit:** `M` — by length, metres

```
Len = Σ L
```

**In practice.** Shelving. POMI permits AREA or, expressly, LENGTH. HOUSE ELECTION: BY LENGTH, because shelving is bought and fixed by the running metre at a stated depth. The DEPTH then goes in the description under GP5.2 as the cross-sectional size — a length item with no depth stated is incomplete.

### F6.4
> Backboards or the like shall be enumerated.

**Unit:** `NR` — enumerated — a count

```
N = count
```

**In practice.** Backboards.

### F6.5
> Built-up members shall be so described.

**Unit:** `—` — no arithmetic — a descriptive, definitional or administrative rule

**In practice.** Built-up members SO DESCRIBED.

### F6.6
> Plastic coverings or the like shall be described with the item on which they occur, stating whether on one or more faces; alternatively, they may be measured separately by area.

**Unit:** `—` — no arithmetic — a descriptive, definitional or administrative rule

**In practice.** Plastic coverings. POMI's PRIMARY limb is DESCRIPTION — described WITH THE ITEM on which they occur, STATING WHETHER ON ONE OR MORE FACES — with separate measurement by area as the express alternative. HOUSE ELECTION: DESCRIBED WITH THE ITEM. A laminated worktop is a worktop described as laminated on the top and front edge; the plastic is not a separate area. 'ONE OR MORE FACES' IS A MANDATORY STATEMENT either way — it is the difference between one face and four at the same running length.

### F6.7
> Sheet linings shall be measured by area, classified as follows: 1. Walls, which shall include returns, reveals of openings or recesses and attached and unattached columns 2. Ceilings, which shall include attached and unattached beams and soffits of staircases.

**Unit:** `M2` — by area, square metres

```
A = Σ A, per class
```

**In practice.** Sheet linings: walls (incl. returns, reveals, columns) · ceilings (incl. beams, staircase soffits) · other.

## F7  Composite items

### F7.1
> Unless otherwise stated, composite items (which shall mean items which might be fabricated off-site whether or not they are fabricated off-site) shall be enumerated; all metal work or the like shall be understood to be included.

**Unit:** `NR` — enumerated — a count

```
N = count
```

**In practice.** Composite items — those which MIGHT be fabricated off-site, whether or not they are. ALL METALWORK DEEMED INCLUDED.

### F7.2
> Any associated work (for example, decorations) shall be measured in accordance with the relevant sections of this document.

**Unit:** `—` — no arithmetic — a descriptive, definitional or administrative rule

**In practice.** Associated work (e.g. decorations) to the relevant sections.

## F8  Sundry items

### F8.1
> Finished surfaces on sawn items shall be measured by length.

**Unit:** `M` — by length, metres

```
L = Σ L
```

**In practice.** Finished surfaces on sawn items.

## F9  Metalwork

### F9.1
> Metalwork items associated with woodwork shall be enumerated; alternatively, waterbars or the like may be measured by length.

**Unit:** `NR / M`

```
N = count; waterbars may be L = Σ L
```

**In practice.** Metalwork associated with woodwork.

## F10  Ironmongery

### F10.1
> Units or sets of ironmongery shall be enumerated.

**Unit:** `NR` — enumerated — a count

```
N = count of SETS
```

**In practice.** Units or SETS of ironmongery ENUMERATED. WORD-FOR-WORD IDENTICAL TO H4.1. HOUSE ELECTION: NOT USED — all ironmongery, including ironmongery to timber doors, is billed under H4.1 so that every set sits in one place. Retained here because POMI carries it; a run that measures against F10.1 has split the ironmongery across two bills and will double-count the sets.

# SECTION G — THERMAL AND MOISTURE PROTECTION
*4 groups · 7 clauses · 6 carrying arithmetic*

## G1  Generally

### G1.1
> Work shall be measured flat without addition for laps or seams.

**Unit:** `RULE` — governs how OTHER quantities are calculated

```
A = A_covered, NO laps or seams
```

**In practice.** Measured FLAT. Lap material is a rate cost — typically +8 to +12% of a roof if wrongly added.

### G1.2
> Curved, spherical and conical work shall each be so described.

**Unit:** `—` — no arithmetic — a descriptive, definitional or administrative rule

**In practice.** Curved, spherical and conical EACH SO DESCRIBED — described, not uplifted.

## G2  Coverings and linings

### G2.1
> Unless otherwise stated, roofing, tanking, waterproof coverings, linings or the like shall be measured by area, classified as follows: 1. Flat coverings 2. Sloping coverings 3. Vertical coverings.

**Unit:** `M2` — by area, square metres

```
flat: A = L × W
sloping: A = L × (W / cos θ)
vertical: A = L × H
```

**In practice.** Roofing, tanking, waterproof coverings and linings by AREA, THREE classes: 1 FLAT COVERINGS — A = L × W · 2 SLOPING COVERINGS, MEASURED ON THE SLOPE — A = L × (W / cos θ); a 30° roof taken on plan is 13.4% short · 3 VERTICAL COVERINGS — A = L × H. The class is the plane of the covering, and the slope correction belongs to class 2 alone.

### G2.2
> Eaves, ridges, skirtings, fascias, flashings, aprons or the like shall be measured by length; alternatively, skirtings, fascias or the like to composite roofing may be measured by area.

**Unit:** `M` — by length, metres

```
Len = Σ L
```

**In practice.** Eaves, ridges, skirtings, fascias, flashings and aprons BY LENGTH. POMI's express alternative permits skirtings and fascias TO COMPOSITE ROOFING to be measured by area. HOUSE ELECTION: LENGTH THROUGHOUT, so the section carries ONE trim unit rather than two. Note how narrow the alternative is in any case — skirtings and fascias ONLY, and ONLY to composite roofing. It never reaches flashings, ridges or aprons, and measuring one of those by area is outside the clause.

### G2.3
> Roof lights, ventilators, soaker collars, special roofing sheets or the like shall be enumerated; alternatively, special roofing sheets may be measured as extra over roofing (that is, the special roofing sheets shall be measured but no deduction shall be made from the roofing in which the special sheeting occurs).

**Unit:** `NR` — enumerated — a count

```
N = count
```

**In practice.** Roof lights, ventilators, soaker collars and special roofing sheets ALL ENUMERATED. POMI's express alternative permits SPECIAL SHEETS ONLY to be measured as EXTRA OVER roofing, with NO DEDUCTION from the roofing in which they occur. HOUSE ELECTION: ENUMERATE ALL FOUR — the counts are unambiguous and extra over is the limb that gets mis-applied. Note the alternative never reached roof lights, ventilators or soaker collars in any case; those are enumerated under either limb.

## G3  Damp-proof courses

### G3.1
> Damp-proof courses shall be measured by length; alternatively, they may be measured by area.

**Unit:** `M` — by length, metres

```
Len = Σ L
```

**In practice.** Damp-proof courses. POMI permits LENGTH or, expressly, AREA. HOUSE ELECTION: BY LENGTH, with the WIDTH STATED in the description under GP5.2 — a DPC is bought and laid by the roll at a stated width. A length item with no width stated is incomplete.

## G4  Insulation

### G4.1
> Insulation shall be measured by area; alternatively, it may be described with items of composite roofing.

**Unit:** `M2` — by area, square metres

```
A = Σ A
```

**In practice.** Insulation. POMI permits a measured AREA or, expressly, DESCRIPTION WITHIN items of composite roofing. HOUSE ELECTION: A SEPARATE AREA ITEM — it keeps the insulation visible and valuable on variation, where the alternative buries it in the roofing rate. THE TWO ARE MUTUALLY EXCLUSIVE: a bill carrying a composite roofing item whose description mentions insulation AND a separate insulation area has billed it twice, and the second row looks perfectly reasonable.

# SECTION H — DOORS AND WINDOWS
*6 groups · 12 clauses · 12 carrying arithmetic*

## H1  Doors

### H1.1
> Doors shall be enumerated.

**Unit:** `NR` — enumerated — a count

```
N = count
```

**In practice.** Doors.

### H1.2
> Jambs, heads, sills, mullions, transomes or the like shall be measured by length; alternatively, frame and lining sets may be enumerated.

**Unit:** `NR` — enumerated — a count

```
N = count of frame/lining SETS
```

**In practice.** Jambs, heads, sills, mullions and transomes BY LENGTH; POMI's express alternative permits FRAME AND LINING SETS to be ENUMERATED. HOUSE ELECTION: ENUMERATED SETS, matching the way door schedules are issued and keeping one line per door type. THE SET MUST BE FULLY DESCRIBED under GP5.1 — with no length, the words are the only thing saying how big it is. NOTE: the door leaf (H1.1) and its surround (H1.2) stay SEPARATE items under either limb. A single 'door complete with frame' collapses two clauses into one and neither can then be varied independently.

## H2  Windows

### H2.1
> Windows, skylights or the like, together with their frames, shall be enumerated; sub-frames of a different material shall be separately enumerated or may be measured by length.

**Unit:** `NR` — enumerated — a count

```
N = count (window INCLUDING its own frame)
```

**In practice.** Windows and skylights ENUMERATED TOGETHER WITH THEIR FRAMES — the OPPOSITE of doors, where H1.2 measures the surround separately. Same section, deliberately opposite, and it is easy to carry the door habit across. SUB-FRAMES OF A DIFFERENT MATERIAL are separately enumerated or measured by length; 'of a different material' is the whole test — an aluminium window in an aluminium sub-frame is ONE item, the same window in a TIMBER sub-frame is TWO. J6.3 cl.8 picks up the same distinction for decoration.

## H3  Screens

### H3.1
> Screens, borrowed lights, curtain walling or the like shall be measured by area; alternatively, they may be enumerated.

**Unit:** `M2` — by area, square metres

```
A = Σ (W × H)
```

**In practice.** Screens, borrowed lights and CURTAIN WALLING. POMI permits AREA or, expressly, ENUMERATION. HOUSE ELECTION: BY AREA — curtain walling prices per square metre and a '1 nr curtain wall' is unpriceable. Curtain walling belongs HERE, not in Section E as metalwork and not under H5 as glass. NO DEDUCTION is made for doors within the screen: H3.2 enumerates them AS WELL, which is extra-over logic applied to a screen.

### H3.2
> Doors and frames within a screen shall be enumerated.

**Unit:** `NR` — enumerated — a count

```
N = count
```

**In practice.** Doors and frames WITHIN a screen.

## H4  Ironmongery

### H4.1
> Units or sets of ironmongery shall be enumerated.

**Unit:** `NR` — enumerated — a count

```
N = count of SETS
```

**In practice.** Units or SETS of ironmongery ENUMERATED — sets, never pieces. A door's set (hinges, lock, lever furniture, closer, seals) is ONE unit, fully described under GP5.1; counting the hinges is counting inside the set. THIS CLAUSE IS WORD-FOR-WORD F10.1. HOUSE ELECTION: ALL IRONMONGERY IS BILLED HERE, under H4.1, regardless of whether the door is timber or metal, so F10.1 is never used. Splitting ironmongery across two sections is how sets get counted twice.

## H5  Glass

### H5.1
> Unless otherwise stated, glass shall be measured by area; panes of irregular shape shall be measured as the smallest rectangle from which such irregular shape can be cut.

**Unit:** `M2` — by area, square metres

```
regular: A = L × W
irregular: A = L_bounding × W_bounding
```

**In practice.** Glass. An IRREGULAR pane is measured as THE SMALLEST RECTANGLE it can be cut from — a 1.80 × 1.10 triangle measures 1.98 m², not 0.99.

### H5.2
> Sealed factory-glazed units shall be enumerated.

**Unit:** `NR` — enumerated — a count

```
N = count
```

**In practice.** Sealed factory-glazed units.

### H5.3
> Glass louvres shall be enumerated; alternatively, they may be measured by length, stating the number.

**Unit:** `NR` — enumerated — a count

```
N = count
```

**In practice.** Glass louvres. POMI permits ENUMERATION or, expressly, LENGTH STATING THE NUMBER. HOUSE ELECTION: ENUMERATED. Note the alternative never permits length alone — the number is mandatory under either limb.

### H5.4
> Glass panes of special shape or with decorative treatment shall be enumerated.

**Unit:** `NR` — enumerated — a count

```
N = count
```

**In practice.** Panes of special shape or with decorative treatment.

## H6  Patent glazing

### H6.1
> Patent glazing shall be measured by area, classified as follows: 1. Roofs 2. Skylights, which shall include lantern lights 3. Vertical surfaces.

**Unit:** `M2` — by area, square metres

```
A = Σ A, per class
```

**In practice.** Patent glazing: roofs · skylights (incl. lantern lights) · vertical. Sloping measured on the slope.

### H6.2
> Opening portions shall be enumerated.

**Unit:** `NR` — enumerated — a count

```
N = count
```

**In practice.** Opening portions.

# SECTION J — FINISHES
*7 groups · 16 clauses · 11 carrying arithmetic*

## J1  Generally

### J1.1
> Work shall be measured flat without addition for laps or seams; finishes on corrugated or ornamental surfaces shall each be so described.

**Unit:** `RULE` — governs how OTHER quantities are calculated

```
A = A_covered, NO laps or seams
```

**In practice.** Measured FLAT. Corrugated and ornamental surfaces EACH SO DESCRIBED.

### J1.2
> Curved, spherical and conical work shall each be so described.

**Unit:** `—` — no arithmetic — a descriptive, definitional or administrative rule

**In practice.** Curved, spherical and conical EACH SO DESCRIBED.

### J1.3
> Internal and external work shall each be so described.

**Unit:** `—` — no arithmetic — a descriptive, definitional or administrative rule

**In practice.** Internal and external work EACH SO DESCRIBED.

## J2  Backgrounds

### J2.1
> Backgrounds shall be measured by area; backgrounds for floor, wall or ceiling finishes shall each be so described.

**Unit:** `M2` — by area, square metres

```
A = Σ A
```

**In practice.** Backgrounds BY AREA, with floor, wall and ceiling backgrounds EACH SO DESCRIBED. HOUSE RULE: A BACKGROUND IS ALWAYS MEASURED SEPARATELY FROM THE FINISH ON IT. A screed under a tile is J2.2 and the tile is J3.1 cl.1 — TWO measured areas over the same surface, which is not a double count because they are two operations. The common error is the reverse: billing only the finish and letting the background disappear into its rate, where it cannot be valued on variation.

### J2.2
> Poured backgrounds (for example, screeds) shall each be given separately, stating the surface finish.

**Unit:** `M2` — by area, square metres

```
A = Σ A
```

**In practice.** POURED backgrounds (screeds) each given separately, STATING THE SURFACE FINISH.

### J2.3
> Pre-formed backgrounds (for example, plasterboard, expanded metal lathing) shall each be given separately.

**Unit:** `M2` — by area, square metres

```
A = Σ A
```

**In practice.** PRE-FORMED backgrounds (plasterboard, EML) each given separately.

## J3  Finishings

### J3.1
> Unless otherwise stated, finishing shall be measured by area, classified as follows: 1. Floors, which shall include landings 2. Walls, which shall include returns, reveals of openings or recesses and attached and unattached columns 3. Ceilings, which shall include attached and unattached beams and soffits of staircases 4. Staircases, which shall include treads, risers and edges of landings but exclude soffits.

**Unit:** `M2` — by area, square metres

```
A = Σ (L × H) − voids + reveals + columns
```

**In practice.** Finishings, FOUR classes: 1 floors (incl. landings) · 2 walls, INCLUDING returns, reveals of openings or recesses and ATTACHED AND UNATTACHED COLUMNS · 3 ceilings, INCLUDING attached and unattached beams and soffits of staircases · 4 STAIRCASES, including treads, risers and edges of landings BUT EXCLUDING SOFFITS (those fall in cl.3).

### J3.2
> Skirtings, bands, strings, coverings to kerbs, mouldings, coves, channels or the like shall be measured by length.

**Unit:** `M` — by length, metres

```
L = Σ L
```

**In practice.** Skirtings, bands, strings, coverings to kerbs, mouldings, coves, channels.

## J4  Sundries

### J4.1
> Non-slip inserts, dividing strips, metal angle beads, lathing at junction of differing backgrounds or the like shall be measured by length; alternatively, they may be described with the items in which they occur.

**Unit:** `—` — no arithmetic — a descriptive, definitional or administrative rule

**In practice.** Non-slip inserts, dividing strips, metal angle beads and lathing at junctions of differing backgrounds. POMI permits LENGTH or, expressly, DESCRIPTION WITH THE ITEMS IN WHICH THEY OCCUR. HOUSE ELECTION: DESCRIBED WITH THE ITEM — no separate linear item is raised, matching the F6.6 treatment of plastic coverings. THE TWO LIMBS ARE MUTUALLY EXCLUSIVE: a bill carrying an angle-bead length AND a finish description that mentions angle beads has billed them twice, and the second row reads perfectly reasonably. So the finish description must NAME them — beads, stops, dividing strips, lathing at junctions — or the rate is not bound to anything.

## J5  Suspended ceilings

### J5.1
> Suspended ceilings shall be measured by area, classified as follows: 1. Ceilings stating the drop 2. Sides and soffits of beams or upstands.

**Unit:** `M2` — by area, square metres

```
A = Σ A, per class
```

**In practice.** Suspended ceilings: 1 ceilings STATING THE DROP · 2 sides and soffits of beams or upstands. The drop is a MANDATORY statement.

## J6  Decorations

### J6.1
> Decorations on different surfaces shall each be given separately.

**Unit:** `—` — no arithmetic — a descriptive, definitional or administrative rule

**In practice.** Decorations on DIFFERENT SURFACES each given separately.

### J6.2
> Details shall be given of any special method of application (for example, spraying).

**Unit:** `—` — no arithmetic — a descriptive, definitional or administrative rule

**In practice.** Details of any special method of application, e.g. spraying.

### J6.3
> Unless otherwise stated, decorations shall be measured by area, classified as follows: 1. Floors, which shall include landings 2. Walls, which shall include returns, reveals of openings or recesses and attached and unattached columns 3. Ceilings, which shall include attached and unattached beams and soffits of staircases 4. Staircases, which shall include treads, risers, strings and edges of landings but exclude soffits 5. Cornices 6. General surfaces, which shall include doors, close-type fencing or the like; glazed general surfaces (measured flat over glass) shall be so described 7. Isolated general surfaces, which shall include door frames, linings, sub-frames of a differing material to the window, skirtings, rails, architraves, bars, posts, balusters or the like 8. Windows (measured flat over glass, frames, mullions, transomes and architraves), which shall include glazed partitions or the like, but exclude sub-frames of a differing material to the window; edges of sashes shall be understood to be included 9. Radiators, measured over the area of heating surface 10. Gutters, measured inside and out 11. Large pipes (that is, pipes with an internal diameter exceeding 60mm), including trunking or the like, unless measured as incidental work; hangers, supports or the like (except common supports to services) shall be understood to be included 12. Structural metalwork, which shall include roof trusses.

**Unit:** `M2` — by area, square metres

```
A = Σ A, per class
```

**In practice.** Decorations, TWELVE classes — THREE TIMES the four of J3.1: 1 floors (incl. landings) · 2 walls (incl. returns, reveals, attached and unattached columns) · 3 ceilings (incl. attached and unattached beams, staircase soffits) · 4 STAIRCASES, incl. treads, risers, STRINGS and edges of landings BUT EXCLUDING soffits · 5 CORNICES · 6 GENERAL SURFACES, which INCLUDE doors and close-type fencing; GLAZED general surfaces MEASURED FLAT OVER GLASS and SO DESCRIBED · 7 ISOLATED GENERAL SURFACES, which include door frames, linings, sub-frames of a differing material to the window, skirtings, rails, architraves, bars, posts, balusters · 8 WINDOWS, MEASURED FLAT OVER GLASS, frames, mullions, transomes and architraves, including glazed partitions but EXCLUDING sub-frames of a differing material; EDGES OF SASHES DEEMED INCLUDED · 9 RADIATORS, MEASURED OVER THE AREA OF HEATING SURFACE · 10 GUTTERS, MEASURED INSIDE AND OUT · 11 LARGE PIPES (internal diameter exceeding 60 mm) including trunking, unless measured as incidental work; hangers and supports (except common supports to services) DEEMED INCLUDED · 12 STRUCTURAL METALWORK, which includes roof trusses. Classes 5 to 12 have NO counterpart in J3.1 — a decoration take-off is NOT a copy of the finishes take-off.

### J6.4
> Decoration on small pipes (that is, pipes with an internal diameter of 60mm or less) unless measured as incidental work, shall be measured by length; hangers, supports or the like (except common supports to services) shall be understood to be included.

**Unit:** `M` — by length, metres

```
if Ø_internal ≤ 60 mm → L = Σ L
```

**In practice.** Decoration on SMALL pipes by length. HANGERS AND SUPPORTS DEEMED INCLUDED, except common supports to services.

### J6.5
> Decoration on gratings, rainwater heads or the like shall each be enumerated separately, irrespective of size.

**Unit:** `NR` — enumerated — a count

```
N = count
```

**In practice.** Decoration on gratings and rainwater heads — ENUMERATED SEPARATELY, IRRESPECTIVE OF SIZE.

## J7  Signwriting

### J7.1
> Signwriting letters or the like shall be enumerated.

**Unit:** `NR` — enumerated — a count

```
N = count
```

**In practice.** Signwriting letters.

# SECTION K — ACCESSORIES
*2 groups · 5 clauses · 4 carrying arithmetic*

## K1  Generally

### K1.1
> For the purposes of identification, accessories to be measured in accordance with the principles in this section shall be defined as those being specially manufactured or proprietary items not included in other sections.

**Unit:** `—` — no arithmetic — a descriptive, definitional or administrative rule

**In practice.** THE DEFINITION, and it is a RESIDUAL: accessories are specially manufactured or proprietary items NOT INCLUDED IN OTHER SECTIONS. SO K IS TESTED LAST — an item reaches K only after Q, R, H, J and every other section has been tested and none of them takes it. Reaching for K early pulls work out of the sections that price it properly. HOUSE RULE: BECAUSE THE SECTION IS DEFINED BY EXCLUSION, EVERY K ITEM MUST BE FULLY DESCRIBED — what the thing is, what it is made of, how it is fixed, and the schedule or type reference it comes from. A section defined by what it is not cannot rely on its heading to say what an item is; only the description can.

### K1.2
> Unless otherwise stated, accessories shall be enumerated.

**Unit:** `NR` — enumerated — a count

```
N = count
```

**In practice.** Unless otherwise stated, accessories ENUMERATED — the section's default, and 'unless otherwise stated' is the licence for K2.1's length. Everything not caught by K2 falls to this count, FULLY DESCRIBED under GP5.1 and under the K1.1 house rule: the description is the only thing identifying an item in a section defined by exclusion.

## K2  Partitions

### K2.1
> Partitions shall be measured by length, taken over all doors and glazed units.

**Unit:** `M` — by length, metres

```
L = Σ L, TAKEN OVER ALL doors and glazed units
```

**In practice.** Partitions. NO deduction for the doors and glazed panels in them.

### K2.2
> Doors and glazed units shall be enumerated, stating the partition in which they occur.

**Unit:** `NR` — enumerated — a count

```
N = count
```

**In practice.** Doors and glazed units, STATING THE PARTITION they occur in.

### K2.3
> Cubicles or the like shall be enumerated.

**Unit:** `NR` — enumerated — a count

```
N = count
```

**In practice.** Cubicles.

# SECTION L — EQUIPMENT
*1 groups · 2 clauses · 1 carrying arithmetic*

## L1  Generally

### L1.1
> For the purposes of identification, equipment to be measured in accordance with the principles in this section shall be defined as specialist equipment related solely to the function of a building or department (for example, food preparation or service equipment, laboratory equipment, stage equipment).

**Unit:** `—` — no arithmetic — a descriptive, definitional or administrative rule

**In practice.** Scope: equipment is specially manufactured or proprietary items not in other sections — food service, laboratory, stage.

### L1.2
> Each category of equipment shall be given as an item; alternatively, individual items of equipment may be enumerated.

**Unit:** `NR` — enumerated — a count

```
N = count
```

**In practice.** POMI permits EACH CATEGORY AS AN ITEM or, expressly, INDIVIDUAL ITEMS ENUMERATED. HOUSE ELECTION: ENUMERATED. An 'Item' for laboratory or kitchen equipment prices nothing, compares between tenderers on nothing, and cannot be valued on variation. GP5.5 sits over this section — a proprietary item MAY follow the manufacturer's tariff — so between L1.2 and GP5.5 Section L is the loosest in POMI and the DESCRIPTION carries everything.

# SECTION M — FURNISHINGS
*2 groups · 3 clauses · 2 carrying arithmetic*

## M1  Generally

### M1.1
> For the purposes of identification, furnishings to be measured in accordance with the principles in this section shall be defined as loose furniture, fittings or the like related to the occupation and use of a building or department (for example, rugs, curtains, artwork, ashtrays, furnishing accessories).

**Unit:** `—` — no arithmetic — a descriptive, definitional or administrative rule

**In practice.** Scope: furnishings — rugs, curtains, artwork, ashtrays, furnishing accessories.

### M1.2
> Each category of furnishing shall be given as an item; alternatively, individual items of furnishing may be enumerated or measured by length, as may be appropriate.

**Unit:** `NR / M`

```
N = count for discrete items
Len = Σ L for continuous ones
```

**In practice.** POMI permits EACH CATEGORY AS AN ITEM, or individual items ENUMERATED, or MEASURED BY LENGTH — three units in one clause, the most permissive in the standard. HOUSE ELECTION: ENUMERATED for discrete items, BY LENGTH for continuous ones (curtains, blinds). CATEGORY AS AN ITEM IS NEVER USED, for the same reason as L1.2.

## M2  Curtain track

### M2.1
> Curtain track shall be measured by length; hooks, gliders, stops or the like shall be understood to be included.

**Unit:** `M` — by length, metres

```
L = Σ L
```

**In practice.** Curtain track. HOOKS, GLIDERS AND STOPS DEEMED INCLUDED.

# SECTION N — SPECIAL CONSTRUCTION
*3 groups · 3 clauses · 2 carrying arithmetic*

## N1  Generally

### N1.1
> For the purposes of identification, special construction to be measured in accordance with the principles in this section shall be defined as either enclosures of a specialist construction (for example, air supported or geodetic structures, prefabricated buildings) or installations of a specialist nature (for example, radiation protection).

**Unit:** `—` — no arithmetic — a descriptive, definitional or administrative rule

**In practice.** Scope: special construction — air-supported or geodetic structures, prefabricated buildings.

## N2  Enclosures

### N2.1
> Enclosures shall be enumerated; work within the enclosure, not being part of the enclosure construction, shall be measured in accordance with the relevant sections of this document.

**Unit:** `NR` — enumerated — a count

```
N = count
```

**In practice.** Enclosures. Work WITHIN the enclosure that is not part of the enclosure construction is measured to the relevant sections.

## N3  Installations

### N3.1
> Installations shall each be given as an item; alternatively, they may be measured in accordance with the relevant sections of this document.

**Unit:** `—` — no arithmetic — a descriptive, definitional or administrative rule

```
measured to the RELEVANT SECTIONS
```

**In practice.** Installations of a specialist nature. POMI permits AN ITEM EACH or, expressly, MEASUREMENT TO THE RELEVANT SECTIONS. HOUSE ELECTION: MEASURED TO THE RELEVANT SECTIONS — it prices against known work rather than a lump. BUT THE SPECIALIST NATURE MUST SURVIVE IN THE WORDING: an item measured under C, F or J that forms part of a specialist installation is DESCRIBED AS SUCH, naming the installation it belongs to and the specification clause that governs it. Radiation shielding measured as lead-lined boarding under F is priced as ordinary boarding unless the description says what it is. THE MEASUREMENT MOVES SECTION; THE SPECIFICATION DOES NOT.

# SECTION P — CONVEYING SYSTEMS
*3 groups · 5 clauses · 4 carrying arithmetic*

## P1  Generally

### P1.1
> Lifts, hoists, conveyors, escalators or the like shall be enumerated.

**Unit:** `NR` — enumerated — a count

```
N = count
```

**In practice.** Lifts, hoists, conveyors, escalators.

## P2  Sundries

### P2.1
> An item shall be given for each of the following: 1. Supports, which shall include fixings, anchors, insulating blocks and anti-vibration devices 2. Identification, which shall include plates, discs,labels, charts and colour coding 3. Testing and commissioning, which shall include operating completed installations and providing fuel and power 4. Tools and spares, which shall include loose keys and consumable stores 5. Documents, which shall include drawings, operating instructions and maintenance manuals.

**Unit:** `ITEM ×5`

```
five separate ITEMS
```

**In practice.** THE SUNDRIES LIST, used by P, Q and R: 1 supports (incl. fixings, anchors, insulating blocks, anti-vibration devices) · 2 identification (plates, discs, labels, charts, colour coding) · 3 TESTING AND COMMISSIONING, which INCLUDES operating the completed installation AND PROVIDING FUEL AND POWER · 4 TOOLS AND SPARES, which includes loose keys and consumable stores · 5 DOCUMENTS, which includes drawings, operating instructions and maintenance manuals.

## P3  Work incidental to conveying systems

### P3.1
> An item shall be given for incidental work, which shall include: 1. Co-ordination with other engineering installations 2. Cutting or forming holes, mortices, chases or the like and making good finishings 3. Building in or cutting and pinning brackets or the like and making good finishings.

**Unit:** `ITEM` — an ITEM — a lump, not a measured quantity

```
ITEM
```

**In practice.** Incidental work AS AN ITEM, three heads: 1 CO-ORDINATION with other engineering installations · 2 CUTTING OR FORMING holes, mortices and chases AND MAKING GOOD FINISHINGS · 3 BUILDING IN, or cutting and pinning brackets, AND MAKING GOOD FINISHINGS. BUILDER'S WORK IS AN ITEM, NOT A COUNT — no enumeration of holes, no area of making good. Heads 2 and 3 BOTH end 'and making good finishings', so the make-good is inside this item and MUST NOT reappear in Section J.

### P3.2
> Protective painting and decorative painting shall each be given as an item for each system and shall include: 1. Removing protective coating or wrapping 2. Cleaning and polishing exposed surfaces.

**Unit:** `ITEM` — an ITEM — a lump, not a measured quantity

```
ITEM per system
```

**In practice.** Protective and decorative painting, AN ITEM FOR EACH SYSTEM, and it INCLUDES 1 removing protective coating or wrapping · 2 cleaning and polishing exposed surfaces — both PREPARATION, not painting. HOUSE ELECTION: MEP PAINTING IS BILLED IN THE MEP SECTIONS, HERE, AND NOT IN SECTION J. J6.3 cl.11 (large pipes and trunking) and cl.12 (structural metalwork) both carry the qualifier 'unless measured as incidental work' — under this election it IS incidental work, so those two J6.3 classes are NOT used for anything inside an MEP package. Billing both double-pays, and both rows read correctly.

### P3.3
> Other incidental work shall be measured in accordance with the relevant sections of this document and grouped under an appropriate heading.

**Unit:** `—` — no arithmetic — a descriptive, definitional or administrative rule

**In practice.** Other incidental work to the relevant sections, GROUPED under an appropriate heading.

# SECTION Q — MECHANICAL ENGINEERING INSTALLATIONS
*9 groups · 23 clauses · 21 carrying arithmetic*

## Q1  Generally

### Q1.1
> Installations shall be classified by function and given separately under an appropriate heading.

**Unit:** `—` — no arithmetic — a descriptive, definitional or administrative rule

**In practice.** Installations CLASSIFIED BY FUNCTION, each under its own heading.

### Q1.2
> Installations shall be measured in accordance with the relevant clauses in this section; alternatively, they may be enumerated on a locational basis (for example, cold water installation to ground floor).

**Unit:** `—` — no arithmetic — a descriptive, definitional or administrative rule

```
measured to the relevant clauses of this section
```

**In practice.** POMI permits MEASUREMENT to the clauses of this section or, expressly, ENUMERATION ON A LOCATIONAL BASIS (for example, 'cold water installation to ground floor'). HOUSE ELECTION: MEASURED. The locational alternative dissolves the section into counts that price nothing a checker can test and cannot be valued when the layout changes.

## Q2  Pipework and gutterwork

### Q2.1
> Pipes and gutters shall be measured by length, taken along the centre line over all fittings.

**Unit:** `M` — by length, metres

```
L = Σ L_centreline, OVER ALL FITTINGS
```

**In practice.** Pipes and gutters. State whether the diameter is internal or external per GP5.2.

### Q2.2
> Fittings to small pipes (that is, pipes with an internal diameter of 60mm or less) shall be understood to be included. Fittings (except joints in the running length) to large pipes (that is, pipes with an internal diameter exceeding 60mm) and to gutters shall be enumerated, grouped together for each size of pipe or gutter and described as 'fittings'.

**Unit:** `NR / —`

```
if Ø_internal ≤ 60 mm → fittings DEEMED INCLUDED
if Ø_internal > 60 mm → N = count, GROUPED per size
```

**In practice.** THE 60 mm RULE. Applies to fittings TO GUTTERS as well as to large pipes. Joints in the running length are included either way. Grouped per size of pipe OR GUTTER and described as 'fittings'.

### Q2.3
> Valves, traps, expansion compensators or the like shall be enumerated; sleeves, cover-plates or the like shall be understood to be included.

**Unit:** `NR` — enumerated — a count

```
N = count
```

**In practice.** Valves, traps, expansion compensators. SLEEVES AND COVER-PLATES DEEMED INCLUDED.

## Q3  Ductwork

### Q3.1
> Rectangular ductwork shall be measured by weight, based upon the area calculated as the length, taken along the centre line over all fittings, times the net girth of nominal dimensions. Blank ends shall be added to the area for weighting but no deduction shall be made for intersections or openings; extra weight for seams, stiffeners, supports, fixings or the like shall be understood to be included.

**Unit:** `KG` — by weight, kilogrammes

```
girth = 2 × (w + d)
A = L_centreline × girth + Σ A_blank_ends
W = A × m_per_m2(gauge)
```

**In practice.** RECTANGULAR ductwork BY WEIGHT, from an area built on NOMINAL dimensions. BLANK ENDS ARE ADDED to the area. NO DEDUCTION for intersections or openings. EXTRA WEIGHT FOR SEAMS, STIFFENERS, SUPPORTS AND FIXINGS IS DEEMED INCLUDED — so the gauge weight is applied flat, with no uplift.

### Q3.2
> Circular, oval and flexible ductwork shall be measured by length, taken along the centre line over all fittings.

**Unit:** `M` — by length, metres

```
L = Σ L_centreline, over all fittings
```

**In practice.** Circular, oval and flexible ductwork BY LENGTH.

### Q3.3
> Fittings to rectangular ductwork shall be understood to be included; fittings to circular and oval ductwork (excluding test holes and covers) shall be enumerated, grouped together for each size of duct and described as 'fittings'.

**Unit:** `NR / —`

```
rectangular fittings DEEMED INCLUDED
circular/oval fittings N = count, grouped per size
```

**In practice.** The asymmetry follows the unit: a weight item absorbs its fittings, a length item does not. Test holes and covers excluded.

### Q3.4
> Dampers, grilles, flexible connectors or the like shall be enumerated.

**Unit:** `NR` — enumerated — a count

```
N = count
```

**In practice.** Dampers, grilles, flexible connectors.

## Q4  Equipment

### Q4.1
> Sanitary fittings, tanks, fans, pumps, hoods, air-handling units or the like shall be enumerated.

**Unit:** `NR` — enumerated — a count

```
N = count
```

**In practice.** Sanitary fittings, tanks, fans, pumps, hoods, air-handling units.

### Q4.2
> Continuous convectors or the like shall be measured by length.

**Unit:** `M` — by length, metres

```
L = Σ L
```

**In practice.** Continuous convectors.

### Q4.3
> Heated or ventilated ceilings or the like shall be measured by area.

**Unit:** `M2` — by area, square metres

```
A = Σ A
```

**In practice.** Heated or ventilated ceilings.

## Q5  Automatic controls

### Q5.1
> Sensing or activating devices (for example, thermostats, humidistats, motorised valves), control panels, air compressors and receivers or the like shall be enumerated.

**Unit:** `NR` — enumerated — a count

```
N = count
```

**In practice.** Sensing and activating devices, control panels, air compressors, receivers.

### Q5.2
> Wiring, pneumatic tubing, isolators, starters, relays or the like associated with automatic controls shall be understood to be included.

**Unit:** `—` — no arithmetic — a descriptive, definitional or administrative rule

**In practice.** Wiring, pneumatic tubing, isolators, starters, relays for automatic controls DEEMED INCLUDED — NOT measured under Section R.

### Q5.3
> Alternatively, automatic control systems shall be given as an item for each installation but equipment common to more than one system shall be enumerated.

**Unit:** `ITEM` — an ITEM — a lump, not a measured quantity

```
ITEM per installation
PLUS N = count of SHARED equipment
```

**In practice.** POMI permits automatic controls to be MEASURED (Q5.1 device by device) or, expressly, GIVEN AS AN ITEM FOR EACH INSTALLATION. HOUSE ELECTION: AN ITEM PER INSTALLATION. BUT THE CLAUSE'S OWN EXCEPTION SURVIVES THE ELECTION AND IS NOT OPTIONAL: EQUIPMENT COMMON TO MORE THAN ONE SYSTEM IS STILL ENUMERATED. So a BMS is one item per installation, while a shared control panel, a shared air compressor or a shared receiver serving two or more systems is counted separately — otherwise it sits inside one installation's item and the other installations are priced without it. Q5.2 still applies: wiring, pneumatic tubing, isolators, starters and relays associated with the controls are DEEMED INCLUDED and are never measured as cable under Section R.

## Q6  Connections to supply mains

### Q6.1
> Connections to supply mains shall be enumerated, subject to clause GP8.

**Unit:** `SUM` — a SUM — a money figure, not a measured quantity

```
GP8.1 sum, exclusive of profit
+ profit ITEM
+ attendance ITEM per GP8.2
```

**In practice.** Connections to supply mains ENUMERATED, SUBJECT TO GP8. HOUSE ELECTION: WHERE THE AUTHORITY HOLDS THE MONOPOLY — which in the UAE is every potable water, sewer and district-cooling connection — GP8 GOVERNS AND IT IS NOT A MEASURED CONNECTION AT ALL. It becomes a GP8.1 SUM EXCLUSIVE OF PROFIT, a SEPARATE PROFIT ITEM, and an ATTENDANCE ITEM under GP8.2 carrying the eight GP6.2 heads. Three lines, never one. Only where the contractor may lawfully make the connection himself is it enumerated under this clause.

## Q7  Insulation, including linings and protective coverings

### Q7.1
> Insulation to pipework shall be measured by length, taken along the centre line over all fittings.

**Unit:** `M` — by length, metres

```
L = Σ L_centreline, over all fittings
```

**In practice.** Insulation to PIPEWORK.

### Q7.2
> Insulation to rectangular ductwork shall be measured by area, calculated as described In clause Q3; additional insulation to flanges or the like shall be understood to be included.

**Unit:** `M2` — by area, square metres

```
A = L_centreline × girth  (girth per Q3.1)
```

**In practice.** Insulation to RECTANGULAR ductwork BY AREA — same geometry as Q3.1 but a DIFFERENT UNIT from the duct itself. Additional insulation to flanges DEEMED INCLUDED.

### Q7.3
> Insulation to circular, oval and flexible ductwork shall be measured by length, taken along the centre line over all fittings.

**Unit:** `M` — by length, metres

```
L = Σ L_centreline, over all fittings
```

**In practice.** Insulation to circular, oval and flexible ductwork.

### Q7.4
> Insulation boxes around accessories shall be enumerated.

**Unit:** `NR` — enumerated — a count

```
N = count
```

**In practice.** Insulation boxes around accessories.

### Q7.5
> Insulation to equipment shall be enumerated.

**Unit:** `NR` — enumerated — a count

```
N = count
```

**In practice.** Insulation to equipment.

## Q8  Sundries

### Q8.1
> Sundries shall be measured in accordance with clause P2.

**Unit:** `ITEM ×5`

```
per P2.1
```

**In practice.** Mechanical sundries.

## Q9  Work incidental to mechanical engineering installations

### Q9.1
> Work incidental to mechanical engineering installations shall be measured in accordance with clause P3.

**Unit:** `ITEM` — an ITEM — a lump, not a measured quantity

```
per P3.1
```

**In practice.** Mechanical incidental work, including builder's work holes and making good.

# SECTION R — ELECTRICAL ENGINEERING INSTALLATIONS
*10 groups · 17 clauses · 12 carrying arithmetic*

## R1  Generally

### R1.1
> Installations and auxiliary installations shall be classified by function and given separately under an appropriate heading.

**Unit:** `—` — no arithmetic — a descriptive, definitional or administrative rule

**In practice.** Installations and auxiliary installations CLASSIFIED BY FUNCTION, each under its own heading.

### R1.2
> Installations shall be measured in accordance with the relevant clauses in this section; alternatively, they may be enumerated on a locational basis (for example, lighting installation to ground floor).

**Unit:** `—` — no arithmetic — a descriptive, definitional or administrative rule

```
measured to the relevant clauses of this section
```

**In practice.** POMI permits MEASUREMENT to the clauses of this section or, expressly, ENUMERATION ON A LOCATIONAL BASIS. HOUSE ELECTION: MEASURED, matching Q1.2. Note R1.3 and R1.4 widen every clause below: 'cable' INCLUDES tape and BUS-BAR TRUNKING, and 'conduit' INCLUDES TRUNKING, CABLE TRAY and DUCTING. So a rule about conduit is a rule about cable tray.

### R1.3
> The references herein to 'cable' shall be understood to Include tape, bus-bar trunking or the like.

**Unit:** `—` — no arithmetic — a descriptive, definitional or administrative rule

**In practice.** 'CABLE' INCLUDES tape, bus-bar trunking or the like.

### R1.4
> The references herein to 'conduit' shall be understood to include trunking, cable tray, ducting or the like.

**Unit:** `—` — no arithmetic — a descriptive, definitional or administrative rule

**In practice.** 'CONDUIT' INCLUDES trunking, CABLE TRAY, ducting or the like — so tray and trunking follow the conduit rules.

## R2  Main circuits

### R2.1
> For the purposes of measurement, 'main' is defined as the 'incoming supply to the main distribution board within a building or complex'.

**Unit:** `—` — no arithmetic — a descriptive, definitional or administrative rule

**In practice.** 'MAIN' = the incoming supply to the main distribution board within a building or complex.

### R2.2
> Cable shall be measured by length.

**Unit:** `M` — by length, metres

```
L = Σ L_cable
```

**In practice.** Main cable BY LENGTH.

### R2.3
> Conduit shall be measured by length.

**Unit:** `M` — by length, metres

```
L = Σ L_conduit
```

**In practice.** Main conduit BY LENGTH.

## R3  Sub-main circuits

### R3.1
> For the purposes of measurement, 'sub-main' is defined as the 'supply from the main distribution board to a sub-main distribution board'.

**Unit:** `—` — no arithmetic — a descriptive, definitional or administrative rule

**In practice.** 'SUB-MAIN' = the supply from the main distribution board to a sub-main distribution board.

### R3.2
> Cable and conduit to individual sub-main circuits shall be enumerated and separately identified as may be appropriate; alternatively, sub-main circuits may be measured in accordance with clause R2.

**Unit:** `NR` — enumerated — a count

```
N = count of sub-main circuits, separately identified
```

**In practice.** Cable and conduit to individual SUB-MAIN circuits ENUMERATED and SEPARATELY IDENTIFIED; POMI's express alternative permits them to be measured by length per R2. HOUSE ELECTION: ENUMERATED PER CIRCUIT, separately identified — a sub-main is a discrete run between two discrete boards, and identifying it by its boards makes it checkable against the single-line diagram. THE TIER IS DECIDED BY WHICH BOARDS THE CABLE RUNS BETWEEN, not by its size or route: incoming supply to the main DB is R2 (by length), main DB to a sub-main DB is R3, and anything onward to a termination point is R4 (as points).

## R4  Final sub-circuits and auxiliary installations

### R4.1
> Cable and conduit to termination points shall be enumerated, classified as follows: 1. Lighting points 2. Lighting switch points, stating whether one-way, two-way or intermediate 3. General purpose socket outlets; multi-gang socket outlets or the like shall count as one point 4. Equipment points, stating type of equipment or the electrical rating; contactors, starters or the like shall be measured separately as equipment points 5. Auxiliary installation points (for example, bell push, telephone outlet).

**Unit:** `NR` — enumerated — a count

```
N = Σ points, per class
```

**In practice.** CABLE AND CONDUIT to termination points ENUMERATED AS POINTS — and read that literally: the point carries THE CABLE AND THE CONDUIT, and by R1.4 'conduit' also means TRUNKING, CABLE TRAY and DUCTING. IT DOES NOT CARRY THE ACCESSORY: ceiling roses, switches, socket outlets and bell pushes are separately enumerated under R5.1, and both are billed at each position. FIVE classes: 1 lighting points · 2 lighting switch points, STATING one-way, two-way or intermediate · 3 general purpose socket outlets — A MULTI-GANG OUTLET COUNTS AS ONE POINT · 4 equipment points, STATING type of equipment or electrical rating; CONTACTORS AND STARTERS ARE MEASURED SEPARATELY AS EQUIPMENT POINTS · 5 AUXILIARY INSTALLATION POINTS, e.g. bell push, telephone outlet. Where a circuit is enumerated as a point, DO NOT ALSO MEASURE ITS CABLE OR CONTAINMENT BY LENGTH — that is the double count.

## R5  Accessories

### R5.1
> Ceiling roses and pendants, lighting switches, socket outlets, bell pushes or the like shall be enumerated.

**Unit:** `NR` — enumerated — a count

```
N = count
```

**In practice.** Ceiling roses, pendants, lighting switches, socket outlets and bell pushes ENUMERATED. HOUSE ELECTION: BOTH R4.1 AND R5.1 ARE BILLED AT EACH POSITION — R4.1 counts the POINT (the cable, conduit, tray, boxes and terminations reaching the position) and R5.1 counts the ACCESSORY fitted to it (the switch plate, the socket face). Two items per position, deliberately, because they are supplied and fixed at different times by different people. This is NOT the R4.1 double count — that one is measuring a point AND a cable LENGTH for the same final circuit, which remains forbidden.

## R6  Control gear

### R6.1
> Switchgear, distribution gear, contactors, starters, composite switchboards or the like shall be enumerated.

**Unit:** `NR` — enumerated — a count

```
N = count
```

**In practice.** Switchgear, distribution gear, CONTACTORS, STARTERS and composite switchboards ENUMERATED. HOUSE ELECTION: CONTACTORS AND STARTERS ARE BILLED TWICE, DELIBERATELY — as an EQUIPMENT POINT under R4.1 cl.4 (the circuit reaching the device, which POMI directs in terms) and as CONTROL GEAR here (the device itself). Two items, not one. POMI's own wording at R4.1 cl.4 requires the first; this clause requires the second.

## R7  Equipment

### R7.1
> Transformers, generators, standby power cubicles, luminaries, external lighting columns, clocks, loudspeakers, bells or the like shall be enumerated.

**Unit:** `NR` — enumerated — a count

```
N = count
```

**In practice.** Transformers, generators, standby cubicles, luminaires, external lighting columns, clocks, loudspeakers, bells.

### R7.2
> Controls, which shall include accessories and interconnecting cables, shall be measured in accordance with the relevant clauses in this section; alternatively, they may be included with the items of equipment.

**Unit:** `—` — no arithmetic — a descriptive, definitional or administrative rule

```
included with the items of equipment
```

**In practice.** Controls — which INCLUDE ACCESSORIES AND INTERCONNECTING CABLES — measured to the relevant clauses of this section or, expressly, INCLUDED WITH THE ITEMS OF EQUIPMENT. HOUSE ELECTION: INCLUDED WITH THE EQUIPMENT, matching the Q5.3 election so the two MEP sections treat controls the same way. THE INTERCONNECTING CABLES GO WITH THEM — they are not measured again under R2, R3 or R4.

## R8  Connections to supply mains

### R8.1
> Connections to supply mains shall be enumerated, subject to clause GP8.

**Unit:** `NR` — enumerated — a count

```
N = count
```

**In practice.** Connections to supply mains, SUBJECT TO GP8.

## R9  Sundries

### R9.1
> Sundries shall be measured in accordance with clause P2.

**Unit:** `ITEM ×5`

```
per P2.1
```

**In practice.** Electrical sundries.

## R10  Work incidental to electrical engineering installations

### R10.1
> Work incidental to electrical engineering installations shall be measured in accordance with clause P3.

**Unit:** `ITEM` — an ITEM — a lump, not a measured quantity

```
per P3.1
```

**In practice.** Electrical incidental work.
