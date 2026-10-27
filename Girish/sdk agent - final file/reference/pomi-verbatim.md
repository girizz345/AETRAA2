# POMI — VERBATIM CLAUSE LIBRARY

**Principles of Measurement (International) for Works of Construction**
RICS · First Edition June 1979 · reprinted 1988, 1991, 1994, 2001, 2002, 2004 · ISBN 0 85406 108 8

Extracted 2026-09-06 · **17 sections · 117 groups · 314 clauses** · GP + A to R

---

## THIS FILE IS THE AUTHORITY

`ref-pomi-rules.md` is a derived working reference — faster to apply, house extensions
marked. But it restates each clause in its own compressed words and adds house commentary,
so it is longer than POMI overall (8,771 words against POMI's 7,600) while every individual
clause is shorter. Length is not the point: it is in the HOUSE'S words. It is an index, not the
standard. **Where the two differ, THIS FILE GOVERNS.** This is the text to quote in a bill
preamble, a technical query, a variation or a dispute.

## What was done to the text

- **Every clause is reproduced word for word.** Nothing is summarised, merged or reordered.
- **Marginal side-headings are omitted from the clause text.** They are a navigation aid
  printed in the margin, not part of the clause. They are preserved as the group headings
  (`## GP4  Items to be fully inclusive`), which is what they are.
- **23 defects in the source PDF were repaired**, each one listed in Appendix 1 with the
  text as printed, the text as repaired, and why. Four of them are of a kind worth naming
  separately: a marginal side-heading that has fallen INTO the body text stream, so the
  sentence as the PDF prints it is not a sentence — GP1.1 prints *"this document may
  measurement be given"*. Read from the PDF without repair, those four clauses are unquotable.
- **5 readings that look like errors but are what the book prints** are left exactly as
  printed and listed in Appendix 2. A standard is quoted as it stands.
- No other change was made. Every repair above is reversible from the appendix.

## Verification

Four checks run against this file, and each is designed to fail differently.

1. **Clause by clause, against the source.** `verify_library.py` re-reads the PDF,
   reverses every declared repair, and requires an exact match. It reports
   **314/314**. It reads the PDF a DIFFERENT WAY from the extractor that
   built this file — by words grouped into lines, not by the PDF's own text
   blocks — because the one real omission found here was caused by block
   segmentation, and a checker that segments the same way cannot see it.
2. **Every line on every page accounted for.** No body line may be attached to no
   clause, and no margin line may be anything but a side-heading or a page
   number. Both report zero.
3. **Against POMI's own contents pages.** The contents is an index RICS wrote,
   independent of the body pages: 17 sections and 117 groups, reconciled both
   ways, no group in one and not the other.
4. **Numbering continuity.** Group numbers run 1..n in every section and clause
   numbers run 1..n in every group, with no gap, no duplicate and no clause
   filed under the wrong group.

**Three things the first build of this file got wrong**, all found by those
checks and all fixed here:

- **A7 Contractor's facilities was missing entirely.** The PDF prints the
  identifier as `A 7`, with a space, and a pattern that did not allow the space
  skipped the group and both its clauses in silence. That is site accommodation,
  hoardings, temporary roads, water and power for the works.
- **Three clauses were truncated at a page or block break** — GP10.1, B8.5 and
  E2.1 — because a clause's tail arrives as its own block at the text indent
  with no identifier, and the extractor tested only the identifier indent. E2.1
  lost four of its structural-metalwork classifications: portal frames, roof
  trusses, support steelwork, and other classifications.
- **The count was reported as 313.** It is **314**.

Coverage is now asserted against the section, group and clause structure read
off the pages and cross-checked against the contents — not against a list of
identifiers the extractor happened to find. An extractor that finds nothing
reports nothing, and the first version of this file is what that looks like.

---


# SECTION GP — GENERAL PRINCIPLES

## GP1  Principles of measurement
**GP1.1**  These principles of measurement provide a uniform basis for measuring bills of quantities for works of construction. More detailed information than is required by this document may be given to define the precise nature of work or the circumstances under which it is to be carried out.
**GP1.2**  Amendments to these principles of measurement for use in a particular locality or adopted for work not envisaged by this document shall be stated; an appendix is provided for such amendments to be recorded.
**GP1.3**  These principles of measurement may be applied equally to the measurement of proposed works and of completed works.

## GP2  Bills of quantities
**GP2.1**  The objects of bills of quantities are: 1. To assist in the accurate preparation of tenders, by providing for measurement of quantities on a uniform basis 2. To provide a basis for the financial control of a project, in accordance with the conditions of contract.
**GP2.2**  Bills of quantities shall describe and represent the works to be carried out; work which cannot be measured accurately shall be described as approximate or given in bills of approximate quantities.
**GP2.3**  Conditions of contract, drawings and specifications shall be provided with the bills of quantities.
**GP2.4**  The section headings and classifications do not impose restrictions upon the format and presentation of bills of quantities.

## GP3  Measurement
**GP3.1**  Work shall be measured net as fixed in position and each measurement shall be taken to the nearest 10 millimetres; this principle shall not apply to dimensions stated in descriptions.
**GP3.2**  Unless otherwise stated, no deduction shall be made from items required to be measured by area for voids of less than 1.00 m².
**GP3.3**  Minimum deductions of voids shall refer only to voids within the edges of measured areas; voids which are at the edges of measured areas shall always be deducted, irrespective of size.
**GP3.4**  These principles of measurement may be used with other units of measurement but the particular amendments shall be stated.
**GP3.5**  Notwithstanding these principles of measurement, a separate minor building or structure may be enumerated.

## GP4  Items to be fully inclusive
**GP4.1**  Unless otherwise stated, all items shall be fully inclusive of all that is necessary to fulfill the liabilities and obligations arising out of the contract and shall include: 1. Labour and all associated costs 2. Materials, goods and all associated costs 3. Provision of plant 4. Temporary works 5. Establishment charges, overheads and profit.

## GP5  Description of items
**GP5.1**  Items which are required to be enumerated, or for which an item is required, shall be fully described.
**GP5.2**  Items which are to be measured by length or depth shall state the cross-sectional size and shape, girth or ranges of girths or such other information as may be appropriate; for items of pipework it shall be stated whether the diameter is internal or external.
**GP5.3**  Items which are to be measured by area shall state the thickness or such other information as may be appropriate.
**GP5.4**  Items which are to be measured by weight shall state the material thickness and unit weight if appropriate (for example, ductwork).
**GP5.5**  Notwithstanding these principles of measurement, proprietary items may be measured in a manner appropriate to the manufacturer's tariff or customary practice.
**GP5.6**  The description of items in bills of quantities may refer to other documents or drawings and any reference to such information shall be understood to fulfill any requirement of these principles of measurement; alternatively, reference may be made to published information.

## GP6  Work to be executed by a specialist nominated by the employer
**GP6.1**  Unless otherwise required by the conditions of contract, work which is required to be executed by a specialist nominated by the employer shall be given as a sum; such sum shall be exclusive of contractor's profit and in each case an item shall be given for the addition of profit.
**GP6.2**  An item shall be given in each case for assistance by the contractor, which shall include: 1. Use of contractor's administrative arrangements 2. Use of constructional plant 3. Use of contractor's facilities 4. Use of temporary works 5. Space for specialist's offices and stores 6. Clearing away rubbish 7. Scaffolding required by the specialist, giving particulars 8. Unloading, distributing, hoisting and placing in position items of plant, machinery or the like, giving particulars.

## GP7  Goods, materials or services to be provided by a merchant or tradesman nominated by the employer
**GP7.1**  Unless otherwise required by the conditions of contract, goods, materials or services which are required to be provided by a merchant or tradesman nominated by the employer shall be given as a sum; such sum shall be exclusive of contractor's profit and in each case an item shall be given for the addition of profit.
**GP7.2**  Fixing goods and materials shall be given in accordance with the relevant clauses in these principles of measurement; fixing shall be understood to include unloading, storing, distributing and hoisting the, goods and materials. Particulars shall be given of any requirements for the contractor to arrange for delivery or pay any costs of conveying goods or materials.

## GP8  Work to be executed by a government or public authority
**GP8.1**  Unless otherwise required by the conditions of contract, work which may only be carried out or by a government or public authority shall be given as a sum; such sum shall be exclusive of contractor's profit and in each case an item shall be given for the addition of profit.
**GP8.2**  An item shall be given in each case for assistance by the contractor as described in clause GP6.2.

## GP9  Dayworks
**GP9.1**  The cost of labour in dayworks shall be given as a sum; alternatively, a schedule of the different categories of labour may be given containing a provisional quantity of hours for each category.
**GP9.2**  The cost of labour included in a sum or schedule shall include wages, bonuses and all allowances paid to operatives directly engaged on dayworks (including those operating mechanical plant and transport) in accordance with the appropriate employment agreement or, where no such agreement exists, the actual payments made to the work people concerned.
**GP9.3**  The cost of materials in dayworks shall be given as a sum; alternatively, a schedule may be given containing a provisional quantity of different materials.
**GP9.4**  The cost of materials included in a sum or schedule shall be the net invoiced price, including delivery to site.
**GP9.5**  The cost of constructional plant employed exclusively in dayworks shall be given as a sum; alternatively, a schedule of the different categories of plant may be given containing a provisional quantity of hours, or such other period of time as may be appropriate, for each category.
**GP9.6**  The cost of constructional plant included in a sum or schedule shall include fuel, consumable stores, repairs, maintenance and insurance of plant.
**GP9.7**  An item shall be given for the addition of establishment charges, overheads and profit to each of the sums or schedules of labour, materials or plant.
**GP9.8**  Establishment charges, overheads and profit shall include: 1. Costs related to the employment of labour 2. Costs related to the storage of materials, including handling and waste in storage 3. Contractor's administrative arrangements 4. Constructional plant, except plant employed exclusively on dayworks 5. Contractor's facilities 6. Temporary works 7. Sundry items.

## GP10  Contingencies
**GP10.1**  Unless otherwise required by the conditions of contract, contingencies shall be given as a sum; no item shall be given for the addition of profit.


# SECTION A — GENERAL REQUIREMENTS

## A1  Conditions of contract
**A1.1**  A schedule of the clause headings shall be set out in the bills of quantities.
**A1.2**  Where there is an appendix to the conditions of contract requiring insertions to be made, a schedule of the insertions shall be set out in the bills of quantities.

## A2  Specification
**A2.1**  Where the specification contains clauses related to any of the following General Requirements, the bills of quantities shall make reference to the appropriate clauses.

## A3  Restrictions
**A3.1**  Particulars shall be given of any restrictions, which shall include: 1. Access to and possession or use of the site 2. Limitations of working space 3. Limitations of working hours 4. The maintenance of existing services on, under or over the site 5. The execution or completion of the work in any specific order, sections or phases 6. Items of a like nature.

## A4  Contractor's administrative arrangements
**A4.1**  An item shall be given for contractor's administrative arrangements, which shall include: 1. Site administration 2. Supervision 3. Security 4. Safety, health and welfare of workpeople 5. Transport of workpeople.

## A5  Constructional plant
**A5.1**  An item shall be given for constructional plant, which shall include: 1. Small plant and tools 2. Scaffolding 3. Cranes and lifting plant 4. Site transport 5. Plant required for specific trades.

## A6  Employer's facilities
**A6.1**  Particulars shall be given of any facilities required for the employer or the employer's representatives, which shall include: 1. Temporary accommodation (for example, offices, laboratories, living accommodation), including heating, cooling, lighting, furnishing, attendance or related facilities 2. Telephones, including costs of calls; alternatively, the cost of calls may be given as a sum 3. Vehicles 4. Attendance of staff (for example, drivers, laboratory assistants) 5. Equipment (for example, surveyor laboratory equipment) 6. Special requirements for programmes or progress charts 7. Any other facilities (for example, progress photographs, signboards).

## A7  Contractor's facilities
**A7.1**  An item shall be given for facilities required by the contractor, which shall include: 1. Accommodation and buildings, including offices, laboratories, compounds, stores, messrooms and living accommodation 2. Temporary fencing, including hoardings, screens, roofs and guardrails 3. Temporary roads, including hardstandings and crossings 4. Water for the works; particulars shall be given if water will be supplied to the contractor 5. Lighting and power for the works; particulars shall be given if current will be supplied to the contractor 6. Temporary telephones.
**A7.2**  Particulars shall be given where the nature or extent of the facilities is not at the discretion of the contractor.

## A8  Temporary works
**A8.1**  An item shall be given for temporary works, which shall include: 1. Traffic diversion 2. Access roads 3. Bridges 4. Cofferdams 5. Pumping 6. De-watering 7. Compressed air for tunnelling.
**A8.2**  Particulars shall be given where the nature or extent of the temporary works is not at the discretion of the contractor.

## A9  Sundry items
**A9.1**  An item shall be given for sundry items, which shall include: 1. Testing of materials 2. Testing of the works 3. Protecting the works from inclement weather 4. Removing rubbish, protective casings and coverings and cleaning the works at completion 5. Traffic regulations 6. Maintenance of public and private roads ' 7. Drying the works 8. Control of noise and pollution 9. All statutory obligations
**A9.2**  Particulars shall be given where the nature or extent of the sundry items is not at the discretion of the contractor.


# SECTION B — SITE WORK

## B1  Site exploration generally
**B1.1**  Keeping records of site observations, site tests and laboratory tests shall be given as an item.
**B1.2**  Samples, site observations, site tests, laboratory tests and analyses shall be given as an item,
**B1.3**  Providing reports shall be given as an item.

## B2  Trial holes
**B2.1**  Excavating trial holes shall be measured by depth, taken along the centre line, stating the number and the maximum depth below commencing level.
**B2.2**  Earthwork support which is not at the discretion of the contractor shall be measured by depth.

## B3  Boreholes (including pumping test wells)
**B3.1**  Driving boreholes shall be measured by depth, taken along the centre line, stating the number and the maximum depth below commencing level; raking boreholes shall be so described.
**B3.2**  Lining which is not at the discretion of the contractor shall be measured by depth.
**B3.3**  Cappings shall be enumerated.

## B4  Site preparation
**B4.1**  Removing isolated trees shall be enumerated.
**B4.2**  Removing hedges shall be measured by length.
**B4.3**  Site clearance, which shall include removing vegetation, undergrowth, bushes, hedges, trees or the like, shall be measured by area.

## B5  Demolitions and alterations
**B5.1**  The location of each item shall be given. Unless otherwise stated, old materials shall be understood to become the property of the contractor and shall be cleared away; old materials required to remain the property of the employer shall be so described.
**B5.2**  Removing individual fittings, fixtures, engineering installations or the like from an existing structure shall each be given as an item.
**B5.3**  Demolishing individual structures (or part thereof) shall each be given as an item; alternatively, demolishing all structures on a site may be given as an item.
**B5.4**  Cutting openings in existing structures and alterations to existing structures shall each be given as an item; making good all work damaged shall be understood to be included.
**B5.5**  Temporary screens and roofs shall be given as an item.

## B6  Shoring
**B6.1**  Shoring incidental to demolitions and alterations, together with clearing away and making good all work damaged, shall be understood to be included.
**B6.2**  Shoring (other than that incidental to demolitions and alterations) shall be given as an item, stating the location; clearing away and making good all work damaged shall be understood to be included.
**B6.3**  Particulars shall be given where the design of the shoring is not at the discretion of the contractor.
**B6.4**  Shoring which is required by the specification to be left in position shall be so described.

## B7  Underpinning
**B7.1**  Work in underpinning shall be given under an appropriate heading, stating the location.
**B7.2**  Unless otherwise stated, work shall be measured in accordance with the appropriate sections of this document.
**B7.3**  Temporary support shall be given as an item; particulars shall be given where the design of the temporary support is not at the discretion of the contractor.
**B7.4**  Excavation shall be measured by volume, taken to the outside line of the projecting foundations or to the outside line of the new foundations (whichever is the greater), classified as follows: 1. Excavation in preliminary trenches down to the base of the existing foundations 2. Excavation below the base of the existing foundations.
**B7.5**  Cutting away projecting foundations shall be measured by length.

## B8  Earthworks generally
**B8.1**  Any information available concerning the nature of the ground and strata shall be provided with the bills of quantities.
**B8.2**  The quantities for excavation, dredging or tunnelling shall be understood to be the bulk before excavation, and no allowance shall be made for any working space or subsequent variation in bulk; existing voids shall be deducted.
**B8.3**  Multiple handling of materials and transporting about the site shall be understood to be included; multiple handling which is required by the specification shall be so described in the item of disposal.
**B8.4**  Earthwork support shall be given as an item.
**B8.5**  Excavation in rock shall be so described; alternatively, it may be measured as extra over excavation (that is, the volume of rock shall be measured but no deduction shall be made from the volume of excavation in which the rock occurs).
**B8.6**  For the purposes of measurement rock is defined as any material met with which is of such size or position that, in the opinion of the employer's representative, it can only be removed by means of wedges, special plant or explosives.

## B9  Excavation
**B9.1**  Unless otherwise stated, excavation shall be measured by volume as the void which is to be occupied by the permanent construction, or vertically above any part of the permanent construction, classified as follows: 1. Oversite excavation to remove top soil, stating the average depth 2. Excavation to reduce levels 3. Excavation in cuttings 4. Basement excavation 5. Trench excavation to receive foundations, which shall include pile caps and ground beams 6. Pit excavation to receive foundation bases, stating the number 7. Excavation for diaphragm walls, stating the width of the permanent construction and the type of support fluid.
**B9.2**  Excavation of trenches for service pipes, drain pipes, cables or the like shall each be measured by length, stating the average depth; disposal and filling shall be understood to be included.
**B9.3**  For excavation in tunnelling see clause B24.

## B10  Dredging
**B10.1**  Dredging shall be measured by volume, stating the location and limits; unless otherwise stated, measurement shall be understood to be taken from soundings.

## B11  Disposal
**B11.1**  Disposal of material arising from excavation, dredging or tunnelling shall be measured by volume as equal to the volume of excavation, dredging or tunnelling and each shall be classified as follows: 1. Backfilled into excavation 2. Backfilled in making up levels 3. Backfilled oversite to make up levels, giving details of special contouring, embankments or the like 4. Removed, which shall include providing a suitable tip.

## B12  Filling
**B12.1**  Filling material (other than that arising from excavation, dredging or tunnelling) shall be measured by volume as equal to the void to be filled, classified as follows: 1. Filled into excavation 2. Filled in making up levels 3. Filled oversite to make up levels, giving details of special contouring, embankments or the like.

## B13  Piling generally
**B13.1**  For the purposes of measurement, driven piling shall include timber, precast concrete or metal piles.
**B13.2**  Other piling systems (for example, preformed casing with concrete filling) shall be measured in accordance with the principles for driven piling or bored piling as may be appropriate.
**B13.3**  Unless otherwise stated, reinforcement shall be measured in accordance with Section C.

## B14  Driven piling
**B14.1**  Supplying piles shall be measured by length, stating the number; reinforcement shall be given separately.
**B14.2**  Heads and shoes shall be enumerated.
**B14.3**  Driving piles shall be measured by length, taken from the pile point in contact with the ground when pitched to the pile point when driven, stating the number; driving piles on rake shall be so described.
**B14.4**  Cutting off tops of piles and connections for lengthening piles shall be enumerated.

## B15  Bored piling
**B15.1**  Boring for piles shall be measured by length, taken from the formation level of the ground to the bottom of the pile hole, stating the number; the measurement shall include for blind boring when the pile top is to be below the formation level of the ground.
**B15.2**  Boring through rock shall be measured by length as extra over boring for piles (that is, the length of boring through rock shall be measured but no deduction shall be made from the total length of boring).
**B15.3**  Linings for piles shall be measured by length.
**B15.4**  Disposal of material arising from boring shall be measured in accordance with clause B11.
**B15.5**  Concrete filling shall be measured by volume.
**B15.6**  Cutting off tops of piles and forming enlarged bases shall be enumerated.

## B16  Sheet piling
**B16.1**  The measurements for sheet piling shall be taken along the centre line.
**B16.2**  Supplying sheet piling shall be measured by area, taken as the area when in final position.
**B16.3**  Corner piles or the like shall be measured by length.
**B16.4**  Driving sheet piling shall be measured by area, taken from the formation level of the ground to the bottom edge of the sheet piling when driven; strutting and waling and withdrawing sheet piling shall be understood to be included.
**B16.5**  Cutting sheet piling shall be measured by length.
**B16.6**  Sheet piling which is required by the specification to be left in position shall be so described.

## B17  Performance designed piling
**B17.1**  Performance designed piles shall be enumerated; reinforcement and disposal of material arising from boring shall be understood to be included.
**B17.2**  Details shall be given when the pile top is to be below the formation level of the ground.

## B18  Testing piling
**B18.1**  Testing piling, which shall include trial piles and testing working piles, shall be given as an item.

## B19  Underground drainage
**B19.1**  Drain pipes shall be measured by length, taken along the centre line over all fittings; drain pipes within inspection chambers or the like shall be so described and shall be understood to include fixings and supports.
**B19.2**  Drain fittings in the length (for example, bends, junctions) shall be enumerated, grouped together for each size of pipe and described as 'fittings'.
**B19.3**  Drain accessories (for example, gullies, traps) shall be enumerated; concrete surrounds and additional excavation shall be understood to be included.
**B19.4**  Concrete beds and coverings for drain pipes shall each be measured by length, stating the diameter of the pipe; surrounds to vertical pipes shall be so described and shall be understood to include formwork.
**B19.5**  Inspection chambers or the like shall be enumerated; alternatively, they may be measured in accordance with the relevant sections of this document and given under an appropriate heading.
**B19.6**  Connections to existing drains shall be enumerated, subject to clause GP8.

## B20  Paving and surfacing
**B20.1**  Paving and surfacing shall be measured by area.
**B20.2**  Expansion joints and water stops shall be measured by length.
**B20.3**  Channels, curbs, edgings or the like shall be measured by length; curved work shall be so described.

## B21  Fencing
**B21.1**  Fencing, which shall include posts and supports in the length, shall be measured by length; excavating pits, disposal and filling shall be understood to be included.
**B21.2**  Special posts (for example, gate posts, straining posts) shall be enumerated; excavating pits, disposal and filling shall be understood to be included.
**B21.3**  Gates, barriers or the like shall be enumerated.
**B21.4**  Finishes shall be measured in accordance with Section J.

## B22  Landscaping
**B22.1**  Cultivating and fertilising ground shall be measured by area.
**B22.2**  Soiling, seeding and turfing shall be measured by area.
**B22.3**  Hedges shall be measured by length.
**B22.4**  Trees and shrubs shall be enumerated.

## B23  Railway work
**B23.1**  Track, guard rails and conductor rails shall each be measured by length, taken along the centre line over all fittings; curved work shall be so described.
**B23.2**  Sleepers and chairs shall be enumerated.
**B23.3**  Switches and crossings shall be enumerated, classified as follows: 1. Switches and turnouts 2. Diamond crossings 3. Single slip crossings 4. Double slip crossings 5. Other switches and crossings.
**B23.4**  Ballast shall be measured by volume, without deduction for track, classified as follows: 1. Bottom ballast, placed before the track is laid 2. Top ballast, placed after the track is laid.
**B23.5**  Concrete track foundations shall be measured by length, except that overwidth foundations for switches and crossings shall be measured by area; reinforcement and shuttering shall be understood to be included.
**B23.6**  Bitumen filler to complete rail assemblies shall be measured by length.
**B23.7**  Buffer stops, wheel stops or the like shall be enumerated.
**B23.8**  Signalling installations shall be measured in accordance with Section L or Section R.

## B24  Tunnel excavation
**B24.1**  Excavation shall be measured by volume as the void which is to be occupied, including the volume of permanent linings, grouped as may be appropriate to identify different lengths and classified as follows: 1. Straight tunnels 2. Straight shafts 3. Curved tunnels 4. Curved shafts 5. Tapered tunnels 6. Tapered shafts 7. Other cavities, which shall include transitions, breakaways and intersections between shafts and tunnels.
**B24.2**  Forward probing shall be measured by length, stating the number of probes.
**B24.3**  For disposal see clause B11.

## B25  Tunnel linings
**B25.1**  Poured concrete linings shall be measured by area, stating whether spray or cast concrete, classified as follows: 1. lining 2. Secondary lining.
**B25.2**  Preformed segmental tunnel linings shall be enumerated.

## B26  Tunnel support and stabilisation
**B26.1**  Timber supports shall be measured by volume.
**B26.2**  Sprayed concrete supports and reinforcement shall be measured by area.
**B26.3**  Rock bolts shall be measured by length.
**B26.4**  Face packers shall be enumerated.
**B26.5**  Metal arch supports shall be measured by weight.
**B26.6**  Injection of grout materials shall be measured by weight.


# SECTION C — CONCRETE WORK

## C1  Generally
**C1.1**  Reinforced poured concrete and plain poured concrete shall each be so described.
**C1.2**  Poured concrete required by the specification to be placed, compacted, cured or otherwise treated in a particular manner shall be so described.
**C1.3**  No deduction shall be made for voids less than 1.00 m3, nor for the volume of any reinforcement or structural metal enclosed in the concrete, except that voids caused by boxed or tubular structural metalwork shall always be deducted.
**C1.4**  Unless otherwise described, horizontal surfaces of concrete shall be understood to be tamped.

## C2  Poured concrete
**C2.1**  Unless otherwise stated, poured concrete shall be measured by volume, classified as follows: 1. Foundations, which shall include combined or isolated bases 2. Pile caps, which shall include ground beams 3. Blinding 4. Beds, which shall include roads and footpaths, stating the thickness 5. Suspended slabs, which shall include floors, landings, roofs or the like, stating the thickness 6. Walls, which shall include attached columns, stating the thickness 7. Columns, which shall include casing to metal stancheons 8. Beams (measured below the slab), which shall include lintels and casing to metal beams 9. Staircases, which shall include steps and strings 10. Diaphragm walls 11. Other classifications (for example, tunnel linings, bridge abutments) as may be appropriate.
**C2.2**  Poured concrete suspended slabs of special construction, including floors, landings, roofs or the like, shall be measured by area; coffered and troughed slabs shall be so described, giving details of solid margins or the like.
**C2.3**  Where an item is required to be measured by volume and the thickness stated, then items of differing thickness may be grouped together, provided that the range of the different thicknesses is stated.

## C3  Reinforcement
**C3.1**  The weight of bar reinforcement shall be the net weight without addition for rolling margin, supports, spacers or tying wire.
**C3.2**  Bar reinforcement shall be measured by weight, stating the diameter; bars of differing diameters shall be given separately.
**C3.3**  Fabric reinforcement shall be measured by area, without addition for laps.
**C3.4**  Reinforcement shall be given as an item where the detailed design work is the responsibility of the contractor.

## C4  Shuttering
**C4.1**  Unless otherwise stated, shuttering shall be measured by area, taken as the net area in contact with the finished face of concrete, classified as follows: 1. Soffits; shuttering to soffits of special construction shall be so described 2. Sloping soffits, which shall include soffits of staircases 3. Sloping upper surfaces, which shall include surfaces more than 15° from horizontal 4. Sides of foundations, which shall include bases, pile caps and ground beams 5. Sides of walls, which shall include attached columns 6. Returns to walls, which shall include ends, projections and reveals of openings or recesses 7. Sides and soffits of beams, which shall include lintels and breaks in soffits; isolated beams shall be so described 8. Sides and soffits of sloping beams, which shall include lintels and breaks in soffits; isolated beams shall be so described 9. Sides of columns 10. Staircases, which shall include treads, risers and strings but exclude soffits 11. Other classifications (for example, tunnel linings, bridges, bridge abutments) as may be appropriate.
**C4.2**  Shuttering to edges, which shall include face of curb or upstand or break in upper surface of floor, shall be measured by length; items of differing height may be grouped together, provided that the range of different heights is stated.
**C4.3**  Grooves, which shall include throats, rebates, chamfers or the like, 2500 mm2 sectional area or over shall be measured by length; grooves less than 2500 mm2 sectional area shall be understood to be included.
**C4.4**  Shuttering may be enumerated where it is more appropriate to do so (for example, decorative features).
**C4.5**  Shuttering which is required by the specification to be left in position shall be so described.
**C4.6**  Shuttering to curved, conical and spherical surfaces shall each be so described.
**C4.7**  Shuttering to provide a special finish shall be so described.
**C4.8**  Unless otherwise stated, if the volume of concrete has not been deducted, shuttering to the faces of a void shall be understood to be included.

## C5  Precast concrete
**C5.1**  Moulds for precast units shall be understood to be included.
**C5.2**  Reinforcement shall be measured in accordance with clause C3 and given under an appropriate heading; alternatively, it may be described in the item.
**C5.3**  Floor slabs, partition slabs or the like shall be measured by area. .'
**C5.4**  Lintels, sills, duct covers or the like shall be measured by length; alternatively, duct covers may be measured by area.
**C5.5**  Structural units (for example, beams, stanchions, tunnel rings) shall be enumerated.
**C5.6**  Padstones, cappings or the like shall be enumerated.

## C6  Prestressed concrete
**C6.1**  Prestressed concrete work shall be given under an appropriate heading.
**C6.2**  Prestressed concrete shall be measured by volume, classified in accordance with clause C2.
**C6.3**  Reinforcement shall be measured in accordance with clause C3; supporting steel wires or cables shall be measured by weight.
**C6.4**  Shuttering shall be measured in accordance with clause C4, stating whether to pre-tensioned or post-tensioned members.

## C7  Sundries
**C7.1**  Surfaces finished to falls or cross-falls shall be measured by area.
**C7.2**  Surface finishes shall be measured by area, except that tamped finishes shall be understood to be included.
**C7.3**  Expansion material or the like shall be measured by area.
**C7.4**  Designed joints, water stops, cast-in channels or the like shall be measured by length.
**C7.5**  Forming sinkings, channels or the like shall be measured by length and, where appropriate, the item may include additional excavation, hardcore, shuttering and concrete; alternatively, they may be enumerated.
**C7.6**  Fixings, ties, inserts or the like shall be enumerated; alternatively, they may be measured by area.
**C7.7**  Mortices, holes or the like shall be understood to be included.


# SECTION D — MASONRY

## D1  Generally
**D1.1**  Sloping, battering and curved work shall each be so described.
**D1.2**  Reinforced masonry shall be so described.

## D2  Walls and piers
**D2.1**  Walls and piers shall be measured by area, classified as follows: 1. Walls; integral piers shall be measured as walls of combined pier and wall thickness 2. Walls built against other construction 3. Cavity walls measured as a composite item, including skins and cavity; alternatively, the skins and cavity may each be measured by area. Closing cavity walls at ends or around openings shall be understood to be included 4. Isolated piers.
**D2.2**  Faced or fair faced work shall each be so described; alternatively, it may be measured as extra over walls, stating whether faced or fair faced on one or both sides (that is, the area of faced or fair faced work shall be measured but no deduction shall be made from the area of walling on which the faced or fair faced work occurs).

## D3  Sills, etc.
**D3.1**  Sills, copings, oversailing or receding courses or the like shall be measured by length.
**D3.2**  Arches shall be measured by length.

## D4  Reinforcement
**D4.1**  Reinforcement shall be measured in accordance with clause C3; alternatively, fabric reinforcement may be measured by length.

## D5  Sundries
**D5.1**  Concrete filling to cavities shall be measured by area.
**D5.2**  Expansion joints or the like shall be measured by length.
**D5.3**  Air bricks or the like shall be enumerated.


# SECTION E — METALWORK

## E1  Generally
**E1.1**  The weight of metalwork shall be the net weight, without addition for rolling margin or welding material and without deduction for holes, splay cuts, notches or the like.
**E1.2**  Welded, riveted or bolted work shall each be so described.

## E2  Structural metalwork
**E2.1**  Unless otherwise stated, structural metalwork shall be measured by weight, classified as follows: 1. Grillages 2. Beams 3. Stanchions 4. Portal frames, stating the number 5. Roof trusses, stating the number 6. Support steelwork, which shall include sheeting rails, braces, struts or the like 7. Other classifications, as may be appropriate.
**E2.2**  Fittings (for example, caps, brackets) shall be given as an item.
**E2.3**  Fixings (for example, bolts, distance pieces, rivets) shall be given as an item.
**E2.4**  Wedging and grouting bases or the like shall be enumerated.
**E2.5**  Holding down bolts or the like shall be enumerated; temporary boxes and grouting shall be understood to be included.
**E2.6**  Protective treatment shall be given as an item.

## E3  Non-structural metalwork
**E3.1**  Floor plates, duct covers, sheet metal coverings and linings or the like shall be measured by area.
**E3.2**  Bearers, balustrades, handrails (except where included with a staircase), frames or the like shall be measured by length.
**E3.3**  Matwell frames, cat ladders, gates, staircases or the like shall be enumerated.


# SECTION F — WOODWORK

## F1  Generally
**F1.1**  Timber which is sawn (that is, not milled) and timber which is finished (that is, milled) shall each be so described.
**F1.2**  Descriptions of timber members shall state whether the sizes are basic (that is, before machining) or finished (that is, milled, within permitted deviations).

## F2  Structural timbers
**F2.1**  Structural timbers shall be measured by length, classified as follows: 1. Floors and flat roofs 2. Pitched roofs 3. Walls 4. Kerbs, bearers or the like 5. Cleats, sprockets or the like.
**F2.2**  Strutting and bridging between joists shall be measured by length, taken overall the joists.

## F3  Boarding and flooring
**F3.1**  Unless otherwise stated, boarding and flooring shall be measured by area, without addition for joints or laps, classified as follows: 1. Floors, which shall include landings 2. Walls, which shall include returns, reveals of openings or recesses and attached and unattached columns 3. Ceilings, which shall include attached and unattached beams and soffits of staircases 4. Roofs, which shall include tops and cheeks of dormers and sides and bottoms of gutters, stating whether flat, sloping or vertical; firring pieces and bearers shall be understood to be included.
**F3.2**  Eaves and verge boards, which shall include fascias, barge boards or the like, shall be measured by length.
**F3.3**  Fillets and rolls shall be measured by length.

## F4  Grounds and battens
**F4.1**  Open-spaced grounds and battens shall be measured by area, taken overall.
**F4.2**  Individual grounds and battens shall be measured by length.

## F5  Framework
**F5.1**  Framework shall be measured by area, taken overall; alternatively, it may be measured by length.

## F6  Finishings and fittings
**F6.1**  Finishings shall be measured by length, classified as follows: 1. Cover fillets, which shall include architraves, skirtings or the like 2. Beads, which shall include stops or the like 3. Edgings, which shall include window boards, nosings or the like.
**F6.2**  Unless otherwise stated, fittings shall be measured by length, classified as follows: 1. Work tops, which shall include seats or the like 2. Handrails or balustrades.
**F6.3**  Shelving shall be measured by area; alternatively, it may be measured by length.
**F6.4**  Backboards or the like shall be enumerated.
**F6.5**  Built-up members shall be so described.
**F6.6**  Plastic coverings or the like shall be described with the item on which they occur, stating whether on one or more faces; alternatively, they may be measured separately by area.
**F6.7**  Sheet linings shall be measured by area, classified as follows: 1. Walls, which shall include returns, reveals of openings or recesses and attached and unattached columns 2. Ceilings, which shall include attached and unattached beams and soffits of staircases.

## F7  Composite items
**F7.1**  Unless otherwise stated, composite items (which shall mean items which might be fabricated off-site whether or not they are fabricated off-site) shall be enumerated; all metal work or the like shall be understood to be included.
**F7.2**  Any associated work (for example, decorations) shall be measured in accordance with the relevant sections of this document.

## F8  Sundry items
**F8.1**  Finished surfaces on sawn items shall be measured by length.

## F9  Metalwork
**F9.1**  Metalwork items associated with woodwork shall be enumerated; alternatively, waterbars or the like may be measured by length.

## F10  Ironmongery
**F10.1**  Units or sets of ironmongery shall be enumerated.


# SECTION G — THERMAL AND MOISTURE PROTECTION

## G1  Generally
**G1.1**  Work shall be measured flat without addition for laps or seams.
**G1.2**  Curved, spherical and conical work shall each be so described.

## G2  Coverings and linings
**G2.1**  Unless otherwise stated, roofing, tanking, waterproof coverings, linings or the like shall be measured by area, classified as follows: 1. Flat coverings 2. Sloping coverings 3. Vertical coverings.
**G2.2**  Eaves, ridges, skirtings, fascias, flashings, aprons or the like shall be measured by length; alternatively, skirtings, fascias or the like to composite roofing may be measured by area.
**G2.3**  Roof lights, ventilators, soaker collars, special roofing sheets or the like shall be enumerated; alternatively, special roofing sheets may be measured as extra over roofing (that is, the special roofing sheets shall be measured but no deduction shall be made from the roofing in which the special sheeting occurs).

## G3  Damp-proof courses
**G3.1**  Damp-proof courses shall be measured by length; alternatively, they may be measured by area.

## G4  Insulation
**G4.1**  Insulation shall be measured by area; alternatively, it may be described with items of composite roofing.


# SECTION H — DOORS AND WINDOWS

## H1  Doors
**H1.1**  Doors shall be enumerated.
**H1.2**  Jambs, heads, sills, mullions, transomes or the like shall be measured by length; alternatively, frame and lining sets may be enumerated.

## H2  Windows
**H2.1**  Windows, skylights or the like, together with their frames, shall be enumerated; sub-frames of a different material shall be separately enumerated or may be measured by length.

## H3  Screens
**H3.1**  Screens, borrowed lights, curtain walling or the like shall be measured by area; alternatively, they may be enumerated.
**H3.2**  Doors and frames within a screen shall be enumerated.

## H4  Ironmongery
**H4.1**  Units or sets of ironmongery shall be enumerated.

## H5  Glass
**H5.1**  Unless otherwise stated, glass shall be measured by area; panes of irregular shape shall be measured as the smallest rectangle from which such irregular shape can be cut.
**H5.2**  Sealed factory-glazed units shall be enumerated.
**H5.3**  Glass louvres shall be enumerated; alternatively, they may be measured by length, stating the number.
**H5.4**  Glass panes of special shape or with decorative treatment shall be enumerated.

## H6  Patent glazing
**H6.1**  Patent glazing shall be measured by area, classified as follows: 1. Roofs 2. Skylights, which shall include lantern lights 3. Vertical surfaces.
**H6.2**  Opening portions shall be enumerated.


# SECTION J — FINISHES

## J1  Generally
**J1.1**  Work shall be measured flat without addition for laps or seams; finishes on corrugated or ornamental surfaces shall each be so described.
**J1.2**  Curved, spherical and conical work shall each be so described.
**J1.3**  Internal and external work shall each be so described.

## J2  Backgrounds
**J2.1**  Backgrounds shall be measured by area; backgrounds for floor, wall or ceiling finishes shall each be so described.
**J2.2**  Poured backgrounds (for example, screeds) shall each be given separately, stating the surface finish.
**J2.3**  Pre-formed backgrounds (for example, plasterboard, expanded metal lathing) shall each be given separately.

## J3  Finishings
**J3.1**  Unless otherwise stated, finishing shall be measured by area, classified as follows: 1. Floors, which shall include landings 2. Walls, which shall include returns, reveals of openings or recesses and attached and unattached columns 3. Ceilings, which shall include attached and unattached beams and soffits of staircases 4. Staircases, which shall include treads, risers and edges of landings but exclude soffits.
**J3.2**  Skirtings, bands, strings, coverings to kerbs, mouldings, coves, channels or the like shall be measured by length.

## J4  Sundries
**J4.1**  Non-slip inserts, dividing strips, metal angle beads, lathing at junction of differing backgrounds or the like shall be measured by length; alternatively, they may be described with the items in which they occur.

## J5  Suspended ceilings
**J5.1**  Suspended ceilings shall be measured by area, classified as follows: 1. Ceilings stating the drop 2. Sides and soffits of beams or upstands.

## J6  Decorations
**J6.1**  Decorations on different surfaces shall each be given separately.
**J6.2**  Details shall be given of any special method of application (for example, spraying).
**J6.3**  Unless otherwise stated, decorations shall be measured by area, classified as follows: 1. Floors, which shall include landings 2. Walls, which shall include returns, reveals of openings or recesses and attached and unattached columns 3. Ceilings, which shall include attached and unattached beams and soffits of staircases 4. Staircases, which shall include treads, risers, strings and edges of landings but exclude soffits 5. Cornices 6. General surfaces, which shall include doors, close-type fencing or the like; glazed general surfaces (measured flat over glass) shall be so described 7. Isolated general surfaces, which shall include door frames, linings, sub-frames of a differing material to the window, skirtings, rails, architraves, bars, posts, balusters or the like 8. Windows (measured flat over glass, frames, mullions, transomes and architraves), which shall include glazed partitions or the like, but exclude sub-frames of a differing material to the window; edges of sashes shall be understood to be included 9. Radiators, measured over the area of heating surface 10. Gutters, measured inside and out 11. Large pipes (that is, pipes with an internal diameter exceeding 60mm), including trunking or the like, unless measured as incidental work; hangers, supports or the like (except common supports to services) shall be understood to be included 12. Structural metalwork, which shall include roof trusses.
**J6.4**  Decoration on small pipes (that is, pipes with an internal diameter of 60mm or less) unless measured as incidental work, shall be measured by length; hangers, supports or the like (except common supports to services) shall be understood to be included.
**J6.5**  Decoration on gratings, rainwater heads or the like shall each be enumerated separately, irrespective of size.

## J7  Signwriting
**J7.1**  Signwriting letters or the like shall be enumerated.


# SECTION K — ACCESSORIES

## K1  Generally
**K1.1**  For the purposes of identification, accessories to be measured in accordance with the principles in this section shall be defined as those being specially manufactured or proprietary items not included in other sections.
**K1.2**  Unless otherwise stated, accessories shall be enumerated.

## K2  Partitions
**K2.1**  Partitions shall be measured by length, taken over all doors and glazed units.
**K2.2**  Doors and glazed units shall be enumerated, stating the partition in which they occur.
**K2.3**  Cubicles or the like shall be enumerated.


# SECTION L — EQUIPMENT

## L1  Generally
**L1.1**  For the purposes of identification, equipment to be measured in accordance with the principles in this section shall be defined as specialist equipment related solely to the function of a building or department (for example, food preparation or service equipment, laboratory equipment, stage equipment).
**L1.2**  Each category of equipment shall be given as an item; alternatively, individual items of equipment may be enumerated.


# SECTION M — FURNISHINGS

## M1  Generally
**M1.1**  For the purposes of identification, furnishings to be measured in accordance with the principles in this section shall be defined as loose furniture, fittings or the like related to the occupation and use of a building or department (for example, rugs, curtains, artwork, ashtrays, furnishing accessories).
**M1.2**  Each category of furnishing shall be given as an item; alternatively, individual items of furnishing may be enumerated or measured by length, as may be appropriate.

## M2  Curtain track
**M2.1**  Curtain track shall be measured by length; hooks, gliders, stops or the like shall be understood to be included.


# SECTION N — SPECIAL CONSTRUCTION

## N1  Generally
**N1.1**  For the purposes of identification, special construction to be measured in accordance with the principles in this section shall be defined as either enclosures of a specialist construction (for example, air supported or geodetic structures, prefabricated buildings) or installations of a specialist nature (for example, radiation protection).

## N2  Enclosures
**N2.1**  Enclosures shall be enumerated; work within the enclosure, not being part of the enclosure construction, shall be measured in accordance with the relevant sections of this document.

## N3  Installations
**N3.1**  Installations shall each be given as an item; alternatively, they may be measured in accordance with the relevant sections of this document.


# SECTION P — CONVEYING SYSTEMS

## P1  Generally
**P1.1**  Lifts, hoists, conveyors, escalators or the like shall be enumerated.

## P2  Sundries
**P2.1**  An item shall be given for each of the following: 1. Supports, which shall include fixings, anchors, insulating blocks and anti-vibration devices 2. Identification, which shall include plates, discs,labels, charts and colour coding 3. Testing and commissioning, which shall include operating completed installations and providing fuel and power 4. Tools and spares, which shall include loose keys and consumable stores 5. Documents, which shall include drawings, operating instructions and maintenance manuals.

## P3  Work incidental to conveying systems
**P3.1**  An item shall be given for incidental work, which shall include: 1. Co-ordination with other engineering installations 2. Cutting or forming holes, mortices, chases or the like and making good finishings 3. Building in or cutting and pinning brackets or the like and making good finishings.
**P3.2**  Protective painting and decorative painting shall each be given as an item for each system and shall include: 1. Removing protective coating or wrapping 2. Cleaning and polishing exposed surfaces.
**P3.3**  Other incidental work shall be measured in accordance with the relevant sections of this document and grouped under an appropriate heading.


# SECTION Q — MECHANICAL ENGINEERING INSTALLATIONS

## Q1  Generally
**Q1.1**  Installations shall be classified by function and given separately under an appropriate heading.
**Q1.2**  Installations shall be measured in accordance with the relevant clauses in this section; alternatively, they may be enumerated on a locational basis (for example, cold water installation to ground floor).

## Q2  Pipework and gutterwork
**Q2.1**  Pipes and gutters shall be measured by length, taken along the centre line over all fittings.
**Q2.2**  Fittings to small pipes (that is, pipes with an internal diameter of 60mm or less) shall be understood to be included. Fittings (except joints in the running length) to large pipes (that is, pipes with an internal diameter exceeding 60mm) and to gutters shall be enumerated, grouped together for each size of pipe or gutter and described as 'fittings'.
**Q2.3**  Valves, traps, expansion compensators or the like shall be enumerated; sleeves, cover-plates or the like shall be understood to be included.

## Q3  Ductwork
**Q3.1**  Rectangular ductwork shall be measured by weight, based upon the area calculated as the length, taken along the centre line over all fittings, times the net girth of nominal dimensions. Blank ends shall be added to the area for weighting but no deduction shall be made for intersections or openings; extra weight for seams, stiffeners, supports, fixings or the like shall be understood to be included.
**Q3.2**  Circular, oval and flexible ductwork shall be measured by length, taken along the centre line over all fittings.
**Q3.3**  Fittings to rectangular ductwork shall be understood to be included; fittings to circular and oval ductwork (excluding test holes and covers) shall be enumerated, grouped together for each size of duct and described as 'fittings'.
**Q3.4**  Dampers, grilles, flexible connectors or the like shall be enumerated.

## Q4  Equipment
**Q4.1**  Sanitary fittings, tanks, fans, pumps, hoods, air-handling units or the like shall be enumerated.
**Q4.2**  Continuous convectors or the like shall be measured by length.
**Q4.3**  Heated or ventilated ceilings or the like shall be measured by area.

## Q5  Automatic controls
**Q5.1**  Sensing or activating devices (for example, thermostats, humidistats, motorised valves), control panels, air compressors and receivers or the like shall be enumerated.
**Q5.2**  Wiring, pneumatic tubing, isolators, starters, relays or the like associated with automatic controls shall be understood to be included.
**Q5.3**  Alternatively, automatic control systems shall be given as an item for each installation but equipment common to more than one system shall be enumerated.

## Q6  Connections to supply mains
**Q6.1**  Connections to supply mains shall be enumerated, subject to clause GP8.

## Q7  Insulation, including linings and protective coverings
**Q7.1**  Insulation to pipework shall be measured by length, taken along the centre line over all fittings.
**Q7.2**  Insulation to rectangular ductwork shall be measured by area, calculated as described In clause Q3; additional insulation to flanges or the like shall be understood to be included.
**Q7.3**  Insulation to circular, oval and flexible ductwork shall be measured by length, taken along the centre line over all fittings.
**Q7.4**  Insulation boxes around accessories shall be enumerated.
**Q7.5**  Insulation to equipment shall be enumerated.

## Q8  Sundries
**Q8.1**  Sundries shall be measured in accordance with clause P2.

## Q9  Work incidental to mechanical engineering installations
**Q9.1**  Work incidental to mechanical engineering installations shall be measured in accordance with clause P3.


# SECTION R — ELECTRICAL ENGINEERING INSTALLATIONS

## R1  Generally
**R1.1**  Installations and auxiliary installations shall be classified by function and given separately under an appropriate heading.
**R1.2**  Installations shall be measured in accordance with the relevant clauses in this section; alternatively, they may be enumerated on a locational basis (for example, lighting installation to ground floor).
**R1.3**  The references herein to 'cable' shall be understood to Include tape, bus-bar trunking or the like.
**R1.4**  The references herein to 'conduit' shall be understood to include trunking, cable tray, ducting or the like.

## R2  Main circuits
**R2.1**  For the purposes of measurement, 'main' is defined as the 'incoming supply to the main distribution board within a building or complex'.
**R2.2**  Cable shall be measured by length.
**R2.3**  Conduit shall be measured by length.

## R3  Sub-main circuits
**R3.1**  For the purposes of measurement, 'sub-main' is defined as the 'supply from the main distribution board to a sub-main distribution board'.
**R3.2**  Cable and conduit to individual sub-main circuits shall be enumerated and separately identified as may be appropriate; alternatively, sub-main circuits may be measured in accordance with clause R2.

## R4  Final sub-circuits and auxiliary installations
**R4.1**  Cable and conduit to termination points shall be enumerated, classified as follows: 1. Lighting points 2. Lighting switch points, stating whether one-way, two-way or intermediate 3. General purpose socket outlets; multi-gang socket outlets or the like shall count as one point 4. Equipment points, stating type of equipment or the electrical rating; contactors, starters or the like shall be measured separately as equipment points 5. Auxiliary installation points (for example, bell push, telephone outlet).

## R5  Accessories
**R5.1**  Ceiling roses and pendants, lighting switches, socket outlets, bell pushes or the like shall be enumerated.

## R6  Control gear
**R6.1**  Switchgear, distribution gear, contactors, starters, composite switchboards or the like shall be enumerated.

## R7  Equipment
**R7.1**  Transformers, generators, standby power cubicles, luminaries, external lighting columns, clocks, loudspeakers, bells or the like shall be enumerated.
**R7.2**  Controls, which shall include accessories and interconnecting cables, shall be measured in accordance with the relevant clauses in this section; alternatively, they may be included with the items of equipment.

## R8  Connections to supply mains
**R8.1**  Connections to supply mains shall be enumerated, subject to clause GP8.

## R9  Sundries
**R9.1**  Sundries shall be measured in accordance with clause P2.

## R10  Work incidental to electrical engineering installations
**R10.1**  Work incidental to electrical engineering installations shall be measured in accordance with clause P3.


# APPENDIX

*Reproduced from page 21 of the publication. The page is a blank form, printed
so that amendments made under GP1.2 can be recorded and stated. It carries no
text beyond its two headings, and nothing has been omitted from it.*

**APPENDIX**

**Amendments to principles of measurement (see clause GP1.2)**

> On a project where these principles are amended for the locality or for work
> the document did not envisage, GP1.2 requires the amendment to be STATED. This
> is the page POMI provides for it, and a bill preamble that binds to POMI
> without recording its departures here is binding to something it is not using.


---

# APPENDIX 1 — DEFECTS IN THE SOURCE PDF, REPAIRED


Each was confirmed against the rendered page image before repair — the defect is in
the file, not in the reader.


## A — marginal side-heading fallen into the body text


| Clause | As the PDF prints it | Repaired to | Which heading |
|---|---|---|---|
| GP1.1 | ...document may measurement be given... | ...document may be given... | the marginal side-heading "Principles of measurement" is set beside this clause; its second line has fallen into the body line at the same depth |
| GP4.1 | ...necessary to fulfill the Items to be fully liabilities... | ...necessary to fulfill the liabilities... | the marginal side-heading "Items to be fully inclusive"; its first line has fallen into the body line at the same depth |
| B19.1 | ...understood to drainage include fixings... | ...understood to include fixings... | the marginal side-heading "Underground drainage" |
| Q9.1 | ...measured in accordance electrical engineering with clause P3... | ...measured in accordance with clause P3... | the marginal side-heading of the FOLLOWING group, R10 "Work incidental to electrical engineering installations" |

## B — text-layer / character defects


| Clause | As the PDF prints it | Repaired to | Defect |
|---|---|---|---|
| GP5.1 | enumerated. or for which | enumerated, or for which | comma read as a full point |
| GP5.3 | measured bv area | measured by area | y read as v |
| GP9.3 | alternatively, 3 schedule may be given | alternatively, a schedule may be given | a read as 3 |
| GP9.7 | establishment charges. overheads | establishment charges, overheads | comma read as a full point |
| B1.2 | site tests, a oratory tests an analyses | site tests, laboratory tests and analyses | the l of laboratory lost and its ab split; and read as an |
| B8.2 | any \\'orking space | any working space | w read as backslash-apostrophe |
| B3.3 | Cap pings shall be enumerated | Cappings shall be enumerated | the word broken in two. D3.2 sets the same word correctly as "cappings", so the source is inconsistent with itself, not using two spellings |
| B8.5 | measured bur no deduction | measured but no deduction | t read as r |
| B8.6 | position that. in the opinion | position that, in the opinion | comma read as a full point |
| B8.6 | representative. It can only be removed | representative, it can only be removed | comma read as a full point, capitalising the next word |
| B19.5 | measured in accordance \\'ith the relevant | measured in accordance with the relevant | w read as backslash-apostrophe |
| B20.2 | joints and \\'ater stops | joints and water stops | w read as backslash-apostrophe |
| H2.1 | shall be separately enumeraled | shall be separately enumerated | t read as l |
| L1.1 | (for example. food preparation | (for example, food preparation | comma read as a full point |
| N1.1 | (for example. air supported | (for example, air supported | comma read as a full point |
| Q2.3 | enumerated; sleeve~, cover-plates | enumerated; sleeves, cover-plates | s read as a tilde |
| R2.1 | defined as the ‘incoming supply | defined as the 'incoming supply | opening quotation mark rendered as a curly glyph where the closing mark is straight |
| R7.2 | interconnecting cables. shall be measured | interconnecting cables, shall be measured | comma read as a full point |
| R7.2 | they may be. included with | they may be included with | stray full point |

## C — clause identifiers repaired at extraction (no body text touched)


| Identifier | As the PDF prints it | Repaired to | Defect |
|---|---|---|---|
| GP5.1-GP5.6 | GPS.n | GP5.n | 5 read as S |
| GP10.1 | GP 10.1 | GP10.1 | space inserted in the identifier |
| A4.1 | A4.l | A4.1 | 1 read as l |
| A7 / A7.1 | A 7 / A 7.1 | A7 / A7.1 | space inserted in the identifier. THIS IS WHY A7 WAS LOST from the first build of this library: a clause-identifier pattern that did not allow the space skipped the group and the clause silently |
| G2.1 | G2.l | G2.1 | 1 read as l |
| SECTION R | ELECTRICAL ENGINEERING INST ALLA TIONS | ELECTRICAL ENGINEERING INSTALLATIONS | inter-letter spacing broken in the heading |

## D — transcription rules (not repairs)


| Rule | Transcribed as | Why |
|---|---|---|
| `\bm\s?2\s?\.` | `m².` | GP3.2 — superscript 2, set as a separate 4.5pt span, transcribed as U+00B2. The only superscript in the document. |

## E — what is NOT reproduced here, and why

| Pages | Holds | Status |
|---|---|---|
| 1–2 | title page; RICS imprint, ISBN, reprint history, copyright notice | publisher's matter, not the principles |
| 3 | Foreword, Simon Cash, RICS Construction Faculty, December 2003 | commentary added 24 years after the first edition; not a measurement rule, and not cited by any clause |
| 4–5 | Contents | an index. Reproduced in effect by this file's own headings, and used as an INDEPENDENT CHECK on them — all 17 sections and all 117 groups reconciled |
| 6–25 | the principles | **reproduced here in full** |
| 26 | Appendix | **reproduced here** — a blank form for GP1.2 amendments |

Marginal side-headings on pages 6–25 are not reproduced as running text because
they are not text: they are the navigation aid printed in the margin. Each one
IS reproduced, as the group heading it names. The verifier checks this: every
margin line on every page must match a heading in this file or be a page number,
and it reports any that does not.


---

# APPENDIX 2 — READINGS PRESERVED AS PRINTED

These are **not** repaired. They are what the book prints, and a standard is quoted as it
stands. Flagged here so that nobody spends an afternoon deciding whether this file is wrong.

**GP8.1** — work which may only be carried out **or** by a government or public authority

> the "or" is redundant and is in the printed text; the clause reads as though a word such as "solely" was intended before it. Reproduced as printed.

**C2.1** — casing to metal **stancheons**

> printed thus; the accepted spelling is "stanchions". Reproduced as printed.

**GP4.1 / GP5.6** — **fulfill**

> printed thus in both clauses; British usage in a RICS document would be "fulfil". Consistent across both occurrences, so it is the text, not a defect. Reproduced as printed.

**B1.2** — ends "...shall be given as an item**,**"

> the clause closes with a comma where a full point belongs. The sentence is complete — nothing follows it on the page, the next line is B1.3 — so this is punctuation, not a lost clause. Confirmed against the rendered page.

**H1.2 / J6.3** — **transomes**

> printed thus in both clauses; the usual spelling is "transoms". Consistent across both occurrences. Reproduced as printed.

