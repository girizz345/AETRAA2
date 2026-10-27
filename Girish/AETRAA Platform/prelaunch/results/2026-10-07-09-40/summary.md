# AETRAA pre-launch test

Release: `rel-unpacked`  
Run: 2026-10-07T10:18:04.352Z  
**228 pass · 0 fail · 0 warn · 8 untestable**

| Backend | ID | Area | Check | Result | Detail |
|---|---|---|---|---|---|
| all | A0 | Boot | release unpacks and installs its packages | PASS | rel-unpacked |
| sqlite | A1 | Boot | release starts (local.mjs) | PASS | http://127.0.0.1:55251 |
| sqlite | A2 | Boot | owner code signs in | PASS |  |
| sqlite | A3 | Boot | file storage round-trips (/api/storage) | PASS | the database |
| sqlite | A4 | Boot | wrong code is refused | PASS |  |
| sqlite | B1 | Setup workflow | onboard company + project, team, programme, BOQ, BOM, registers, HSE log, IPC chain (demo seed) | PASS | project residential-tower-g-2p-1 |
| sqlite | B2 | Setup workflow | every seed call accepted (116 calls) | PASS |  |
| sqlite | C1 | Sign-in | seat signs in: Principal | PASS |  |
| sqlite | C1 | Sign-in | seat signs in: Project Manager | PASS |  |
| sqlite | C1 | Sign-in | seat signs in: Planning Engineer | PASS |  |
| sqlite | C1 | Sign-in | seat signs in: Site Engineer — Civil | PASS |  |
| sqlite | C1 | Sign-in | seat signs in: Site Engineer — MEP | PASS |  |
| sqlite | C1 | Sign-in | seat signs in: Design Manager | PASS |  |
| sqlite | C1 | Sign-in | seat signs in: Document Controller | PASS |  |
| sqlite | C1 | Sign-in | seat signs in: QA/QC Engineer | PASS |  |
| sqlite | C1 | Sign-in | seat signs in: HSE Officer | PASS |  |
| sqlite | C1 | Sign-in | seat signs in: Quantity Surveyor | PASS |  |
| sqlite | C1 | Sign-in | seat signs in: Consultant (read-only) | PASS |  |
| sqlite | D1 | Dashboards | every page answers for AETRAA Admin (owner) (54 open, 1 refused) | PASS |  |
| sqlite | D1 | Dashboards | every page answers for Principal (54 open, 1 refused) | PASS |  |
| sqlite | D1 | Dashboards | every page answers for Project Manager (54 open, 1 refused) | PASS |  |
| sqlite | D1 | Dashboards | every page answers for Planning Engineer (55 open, 0 refused) | PASS |  |
| sqlite | D1 | Dashboards | every page answers for Site Engineer — Civil (55 open, 0 refused) | PASS |  |
| sqlite | D1 | Dashboards | every page answers for Site Engineer — MEP (55 open, 0 refused) | PASS |  |
| sqlite | D1 | Dashboards | every page answers for Design Manager (55 open, 0 refused) | PASS |  |
| sqlite | D1 | Dashboards | every page answers for Document Controller (55 open, 0 refused) | PASS |  |
| sqlite | D1 | Dashboards | every page answers for QA/QC Engineer (55 open, 0 refused) | PASS |  |
| sqlite | D1 | Dashboards | every page answers for HSE Officer (55 open, 0 refused) | PASS |  |
| sqlite | D1 | Dashboards | every page answers for Quantity Surveyor (55 open, 0 refused) | PASS |  |
| sqlite | D1 | Dashboards | every page answers for Consultant (read-only) (54 open, 1 refused) | PASS |  |
| sqlite | D2 | Access | setup console is not usable by a client seat | PASS |  |
| sqlite | E1 | API | no GET endpoint crashes for Project Manager (156 endpoints) | PASS |  |
| sqlite | E1 | API | no GET endpoint crashes for AETRAA Admin (owner) (156 endpoints) | PASS |  |
| sqlite | F1 | Reports | daily report 2026-10-07 as html | PASS | 50830 bytes |
| sqlite | F1 | Reports | daily report 2026-10-07 as doc | PASS | 51428 bytes |
| sqlite | F1 | Reports | weekly report 2026-10-05 as html | PASS | 69766 bytes |
| sqlite | F1 | Reports | weekly report 2026-10-05 as doc | PASS | 67577 bytes |
| sqlite | F1 | Reports | monthly report 2026-10 as html | PASS | 69767 bytes |
| sqlite | F1 | Reports | monthly report 2026-10 as doc | PASS | 67566 bytes |
| sqlite | F1 | Reports | monthly report 2026-09 as html | PASS | 38566 bytes |
| sqlite | F1 | Reports | monthly report 2026-09 as doc | PASS | 36462 bytes |
| sqlite | F1 | Reports | lookahead report 2026-10-07 as html | PASS | 4340 bytes |
| sqlite | F1 | Reports | lookahead report 2026-10-07 as doc | PASS | 4943 bytes |
| sqlite | F1 | Reports | programme report 2026-10-07 as html | PASS | 14876 bytes |
| sqlite | F1 | Reports | programme report 2026-10-07 as doc | PASS | 12666 bytes |
| sqlite | F1 | Reports | hse report 2026-10 as html | PASS | 36986 bytes |
| sqlite | F1 | Reports | hse report 2026-10 as doc | PASS | 37583 bytes |
| sqlite | F2 | Reports | AI narrative is off without a key and says so | PASS | disabled, as expected with no key |
| sqlite | F3 | Registers | register workbook: submittals | PASS | 2 sheet(s), 14595 bytes |
| sqlite | F4 | Registers | schedule workbook: submittals | PASS | 1 sheet(s), 9408 bytes |
| sqlite | F3 | Registers | register workbook: rfi | PASS | 1 sheet(s), 10785 bytes |
| sqlite | F4 | Registers | schedule workbook: rfi | PASS | 1 sheet(s), 9413 bytes |
| sqlite | F3 | Registers | register workbook: matapp | PASS | 2 sheet(s), 12150 bytes |
| sqlite | F4 | Registers | schedule workbook: matapp | PASS | 1 sheet(s), 8577 bytes |
| sqlite | F3 | Registers | register workbook: authority | PASS | 2 sheet(s), 14462 bytes |
| sqlite | F4 | Registers | schedule workbook: authority | PASS | 1 sheet(s), 9311 bytes |
| sqlite | F3 | Registers | register workbook: letters | PASS | 2 sheet(s), 11705 bytes |
| sqlite | F4 | Registers | schedule workbook: letters | PASS | 1 sheet(s), 8648 bytes |
| sqlite | F3 | Registers | register workbook: variations | PASS | 2 sheet(s), 15317 bytes |
| sqlite | F4 | Registers | schedule workbook: variations | PASS | 1 sheet(s), 9367 bytes |
| sqlite | F3 | Registers | register workbook: inspections | PASS | 2 sheet(s), 14599 bytes |
| sqlite | F4 | Registers | schedule workbook: inspections | PASS | 1 sheet(s), 9483 bytes |
| sqlite | F3 | Registers | register workbook: ncr | PASS | 2 sheet(s), 13872 bytes |
| sqlite | F4 | Registers | schedule workbook: ncr | PASS | 1 sheet(s), 9037 bytes |
| sqlite | F3 | Registers | register workbook: permits | PASS | 2 sheet(s), 14058 bytes |
| sqlite | F4 | Registers | schedule workbook: permits | PASS | 1 sheet(s), 9034 bytes |
| sqlite | F3 | Registers | register workbook: hseobs | PASS | 2 sheet(s), 15730 bytes |
| sqlite | F4 | Registers | schedule workbook: hseobs | PASS | 1 sheet(s), 9446 bytes |
| sqlite | F3 | Registers | register workbook: mr | PASS | 2 sheet(s), 14023 bytes |
| sqlite | F4 | Registers | schedule workbook: mr | PASS | 1 sheet(s), 9014 bytes |
| sqlite | F3 | Registers | register workbook: certs | PASS | 2 sheet(s), 15043 bytes |
| sqlite | F4 | Registers | schedule workbook: certs | PASS | 1 sheet(s), 9434 bytes |
| sqlite | F3 | Registers | register workbook: drawings | PASS | 1 sheet(s), 8835 bytes |
| sqlite | F3 | Registers | register workbook: boq | PASS | 2 sheet(s), 16892 bytes |
| sqlite | F5 | Registers | CSV export of the programme | PASS | 32 lines |
| sqlite | F6 | Programme | P6 progress workbook and review workbook | PASS | 2 sheet(s), 12720 bytes / 1 sheet(s), 18058 bytes |
| sqlite | F7 | Payment | interim payment certificate reached "certified" | PASS | IPA-01 Certified — client to pay net 30627000 |
| sqlite | F8 | Payment | IPC BOQ valuation workbook | PASS | 6 sheet(s), 40345 bytes |
| sqlite | F9 | Payment | IPC covering letter (Word) | PASS | 11628 bytes |
| sqlite | F10 | Payment | IPC full pack (.zip) | PASS | 13 files: IPA-01 - Residential Tower — G+2P+12/01 Payment application IPA-01.doc, IPA-01 - Residential Tower — G+2P+12/02 BOQ valuation IPA-01.xlsx, IPA-01 - Residential Tower — G+2P+12/03 Progress report 2026-09-07 to 2026-10-07.doc, IPA-01 - Residential Tower — G+2P+12/04 Photographs/2026-10-07 A1000 Completed — A1000.png, IPA-01 - Residential Tower — G+2P+12/04 Photographs/2026-10-07 A1010 Completed — A1010.png, IPA-01 - Residential Tower — G+2P+12/04 Photographs/2026-10-07 A1020 Completed — A1020.png, IPA-01 - Residential Tower — G+2P+12/04 Photographs/2026-10-07 A1030 Completed — A1030.pn |
| sqlite | F11 | Payment | a second application while the first is open, or a bad period, is blocked | PASS | The period cannot end after today. |
| sqlite | G1 | Templates | Word template upload + RFI filled in the consultant format | PASS | 1070 bytes |
| sqlite | G2 | Templates | Excel template upload + WIR filled in the consultant format | PASS | 1 sheet(s), 1947 bytes |
| sqlite | G3 | Templates | a record with no template says so, not a crash | PASS |  |
| sqlite | G4 | Drawings | Design uploads a sheet, PM approves, drawing register exports | PASS | 1 sheet(s), 9628 bytes |
| sqlite | G5 | Minutes | DC drafts minutes, issues them, action is numbered, PM closes it, Word downloads | PASS | 6110 bytes / 1 sheet(s), 9096 bytes |
| sqlite | G6 | Correspondence | DC logs an incoming letter; the issued reply closes it | PASS | IN-001 → Replied — LTR-002 issued 2026-10-07 |
| sqlite | G7 | Site diary | Document Control saves a diary; the PM submits it; Word and print versions download | PASS | 49477 bytes / 27744 bytes |
| sqlite | G8 | Issues | site raises an issue; office issues it; issue notice renders | PASS | 8673 bytes |
| sqlite | G9 | Workflows | every register type can be walked to the end of its workflow | PASS | 14 types moved |
| sqlite | G10 | Access | consultant (read-only) cannot raise records, payments or drawings | PASS |  |
| sqlite | G11 | Access | a site engineer cannot approve payment or drawings | PASS |  |
| sqlite | G12 | Modules | switching Commercial off hides and refuses it; on again keeps every record | PASS |  |
| sqlite | G13 | Programme | Primavera .xer preview and import | UNTESTABLE | no --xer file given |
| sqlite | G14 | Intake | folder intake: open batch, scan files, read back | PASS | batch bat_muxx48zl6q57m7 read back |
| sqlite | G15 | Dashboards | "Needs my attention" answers for every seat | PASS |  |
| sqlite | G16 | Notifications | DC notifies the team; PM sees it under the bell | PASS |  |
| sqlite | G17 | Go-live | AETRAA Admin takes the project live | PASS | already live |
| sqlite | G18 | Email | email is off locally and the platform says so | PASS | {"driver":"none","driver_label":"not configured","key":false,"from":"","test_sender":false,"sender_set":false,"people":11,"people_with_email |
| sqlite | H1 | Browser | AETRAA Admin (owner): 52 pages drawn without errors | PASS |  |
| sqlite | H1 | Browser | AETRAA Admin (owner) (phone): 6 pages drawn without errors | PASS |  |
| sqlite | H1 | Browser | Principal: 52 pages drawn without errors | PASS |  |
| sqlite | H1 | Browser | Project Manager: 52 pages drawn without errors | PASS |  |
| sqlite | H1 | Browser | Project Manager (phone): 6 pages drawn without errors | PASS |  |
| sqlite | H1 | Browser | Planning Engineer: 52 pages drawn without errors | PASS |  |
| sqlite | H1 | Browser | Site Engineer — Civil: 52 pages drawn without errors | PASS |  |
| sqlite | H1 | Browser | Site Engineer — Civil (phone): 6 pages drawn without errors | PASS |  |
| sqlite | H1 | Browser | Site Engineer — MEP: 52 pages drawn without errors | PASS |  |
| sqlite | H1 | Browser | Design Manager: 52 pages drawn without errors | PASS |  |
| sqlite | H1 | Browser | Document Controller: 52 pages drawn without errors | PASS |  |
| sqlite | H1 | Browser | QA/QC Engineer: 52 pages drawn without errors | PASS |  |
| sqlite | H1 | Browser | HSE Officer: 52 pages drawn without errors | PASS |  |
| sqlite | H1 | Browser | Quantity Surveyor: 52 pages drawn without errors | PASS |  |
| sqlite | H1 | Browser | Consultant (read-only): 52 pages drawn without errors | PASS |  |
| sqlite | A5 | Boot | server log has no errors during the run | PASS |  |
| sqlite | A6 | Boot | local.mjs restarts on its own database and the projects are still there | PASS | 1 project(s) kept |
| postgres | A1 | Boot | release starts (server.js on PostgreSQL) | PASS | http://127.0.0.1:60810 |
| postgres | A2 | Boot | owner code signs in | PASS |  |
| postgres | A3 | Boot | file storage round-trips (/api/storage) | PASS | the database |
| postgres | A4 | Boot | wrong code is refused | PASS |  |
| postgres | B1 | Setup workflow | onboard company + project, team, programme, BOQ, BOM, registers, HSE log, IPC chain (demo seed) | PASS | project residential-tower-g-2p-1 |
| postgres | B2 | Setup workflow | every seed call accepted (116 calls) | PASS |  |
| postgres | C1 | Sign-in | seat signs in: Principal | PASS |  |
| postgres | C1 | Sign-in | seat signs in: Project Manager | PASS |  |
| postgres | C1 | Sign-in | seat signs in: Planning Engineer | PASS |  |
| postgres | C1 | Sign-in | seat signs in: Site Engineer — Civil | PASS |  |
| postgres | C1 | Sign-in | seat signs in: Site Engineer — MEP | PASS |  |
| postgres | C1 | Sign-in | seat signs in: Design Manager | PASS |  |
| postgres | C1 | Sign-in | seat signs in: Document Controller | PASS |  |
| postgres | C1 | Sign-in | seat signs in: QA/QC Engineer | PASS |  |
| postgres | C1 | Sign-in | seat signs in: HSE Officer | PASS |  |
| postgres | C1 | Sign-in | seat signs in: Quantity Surveyor | PASS |  |
| postgres | C1 | Sign-in | seat signs in: Consultant (read-only) | PASS |  |
| postgres | D1 | Dashboards | every page answers for AETRAA Admin (owner) (54 open, 1 refused) | PASS |  |
| postgres | D1 | Dashboards | every page answers for Principal (54 open, 1 refused) | PASS |  |
| postgres | D1 | Dashboards | every page answers for Project Manager (54 open, 1 refused) | PASS |  |
| postgres | D1 | Dashboards | every page answers for Planning Engineer (55 open, 0 refused) | PASS |  |
| postgres | D1 | Dashboards | every page answers for Site Engineer — Civil (55 open, 0 refused) | PASS |  |
| postgres | D1 | Dashboards | every page answers for Site Engineer — MEP (55 open, 0 refused) | PASS |  |
| postgres | D1 | Dashboards | every page answers for Design Manager (55 open, 0 refused) | PASS |  |
| postgres | D1 | Dashboards | every page answers for Document Controller (55 open, 0 refused) | PASS |  |
| postgres | D1 | Dashboards | every page answers for QA/QC Engineer (55 open, 0 refused) | PASS |  |
| postgres | D1 | Dashboards | every page answers for HSE Officer (55 open, 0 refused) | PASS |  |
| postgres | D1 | Dashboards | every page answers for Quantity Surveyor (55 open, 0 refused) | PASS |  |
| postgres | D1 | Dashboards | every page answers for Consultant (read-only) (54 open, 1 refused) | PASS |  |
| postgres | D2 | Access | setup console is not usable by a client seat | PASS |  |
| postgres | E1 | API | no GET endpoint crashes for Project Manager (156 endpoints) | PASS |  |
| postgres | E1 | API | no GET endpoint crashes for AETRAA Admin (owner) (156 endpoints) | PASS |  |
| postgres | F1 | Reports | daily report 2026-10-07 as html | PASS | 50840 bytes |
| postgres | F1 | Reports | daily report 2026-10-07 as doc | PASS | 51438 bytes |
| postgres | F1 | Reports | weekly report 2026-10-05 as html | PASS | 69764 bytes |
| postgres | F1 | Reports | weekly report 2026-10-05 as doc | PASS | 67575 bytes |
| postgres | F1 | Reports | monthly report 2026-10 as html | PASS | 69765 bytes |
| postgres | F1 | Reports | monthly report 2026-10 as doc | PASS | 67564 bytes |
| postgres | F1 | Reports | monthly report 2026-09 as html | PASS | 38474 bytes |
| postgres | F1 | Reports | monthly report 2026-09 as doc | PASS | 36370 bytes |
| postgres | F1 | Reports | lookahead report 2026-10-07 as html | PASS | 4340 bytes |
| postgres | F1 | Reports | lookahead report 2026-10-07 as doc | PASS | 4943 bytes |
| postgres | F1 | Reports | programme report 2026-10-07 as html | PASS | 14876 bytes |
| postgres | F1 | Reports | programme report 2026-10-07 as doc | PASS | 12666 bytes |
| postgres | F1 | Reports | hse report 2026-10 as html | PASS | 36986 bytes |
| postgres | F1 | Reports | hse report 2026-10 as doc | PASS | 37583 bytes |
| postgres | F2 | Reports | AI narrative is off without a key and says so | PASS | disabled, as expected with no key |
| postgres | F3 | Registers | register workbook: submittals | PASS | 2 sheet(s), 14595 bytes |
| postgres | F4 | Registers | schedule workbook: submittals | PASS | 1 sheet(s), 9408 bytes |
| postgres | F3 | Registers | register workbook: rfi | PASS | 1 sheet(s), 10785 bytes |
| postgres | F4 | Registers | schedule workbook: rfi | PASS | 1 sheet(s), 9413 bytes |
| postgres | F3 | Registers | register workbook: matapp | PASS | 2 sheet(s), 12150 bytes |
| postgres | F4 | Registers | schedule workbook: matapp | PASS | 1 sheet(s), 8577 bytes |
| postgres | F3 | Registers | register workbook: authority | PASS | 2 sheet(s), 14462 bytes |
| postgres | F4 | Registers | schedule workbook: authority | PASS | 1 sheet(s), 9311 bytes |
| postgres | F3 | Registers | register workbook: letters | PASS | 2 sheet(s), 11705 bytes |
| postgres | F4 | Registers | schedule workbook: letters | PASS | 1 sheet(s), 8648 bytes |
| postgres | F3 | Registers | register workbook: variations | PASS | 2 sheet(s), 15317 bytes |
| postgres | F4 | Registers | schedule workbook: variations | PASS | 1 sheet(s), 9367 bytes |
| postgres | F3 | Registers | register workbook: inspections | PASS | 2 sheet(s), 14599 bytes |
| postgres | F4 | Registers | schedule workbook: inspections | PASS | 1 sheet(s), 9483 bytes |
| postgres | F3 | Registers | register workbook: ncr | PASS | 2 sheet(s), 13872 bytes |
| postgres | F4 | Registers | schedule workbook: ncr | PASS | 1 sheet(s), 9037 bytes |
| postgres | F3 | Registers | register workbook: permits | PASS | 2 sheet(s), 14058 bytes |
| postgres | F4 | Registers | schedule workbook: permits | PASS | 1 sheet(s), 9034 bytes |
| postgres | F3 | Registers | register workbook: hseobs | PASS | 2 sheet(s), 15730 bytes |
| postgres | F4 | Registers | schedule workbook: hseobs | PASS | 1 sheet(s), 9446 bytes |
| postgres | F3 | Registers | register workbook: mr | PASS | 2 sheet(s), 14023 bytes |
| postgres | F4 | Registers | schedule workbook: mr | PASS | 1 sheet(s), 9014 bytes |
| postgres | F3 | Registers | register workbook: certs | PASS | 2 sheet(s), 15043 bytes |
| postgres | F4 | Registers | schedule workbook: certs | PASS | 1 sheet(s), 9434 bytes |
| postgres | F3 | Registers | register workbook: drawings | PASS | 1 sheet(s), 8835 bytes |
| postgres | F3 | Registers | register workbook: boq | PASS | 2 sheet(s), 16892 bytes |
| postgres | F5 | Registers | CSV export of the programme | PASS | 32 lines |
| postgres | F6 | Programme | P6 progress workbook and review workbook | PASS | 2 sheet(s), 12720 bytes / 1 sheet(s), 18058 bytes |
| postgres | F7 | Payment | interim payment certificate reached "certified" | PASS | IPA-01 Certified — client to pay net 30627000 |
| postgres | F8 | Payment | IPC BOQ valuation workbook | PASS | 6 sheet(s), 40345 bytes |
| postgres | F9 | Payment | IPC covering letter (Word) | PASS | 11628 bytes |
| postgres | F10 | Payment | IPC full pack (.zip) | PASS | 13 files: IPA-01 - Residential Tower — G+2P+12/01 Payment application IPA-01.doc, IPA-01 - Residential Tower — G+2P+12/02 BOQ valuation IPA-01.xlsx, IPA-01 - Residential Tower — G+2P+12/03 Progress report 2026-09-07 to 2026-10-07.doc, IPA-01 - Residential Tower — G+2P+12/04 Photographs/2026-10-07 A1000 Completed — A1000.png, IPA-01 - Residential Tower — G+2P+12/04 Photographs/2026-10-07 A1010 Completed — A1010.png, IPA-01 - Residential Tower — G+2P+12/04 Photographs/2026-10-07 A1020 Completed — A1020.png, IPA-01 - Residential Tower — G+2P+12/04 Photographs/2026-10-07 A1030 Completed — A1030.pn |
| postgres | F11 | Payment | a second application while the first is open, or a bad period, is blocked | PASS | The period cannot end after today. |
| postgres | G1 | Templates | Word template upload + RFI filled in the consultant format | PASS | 1070 bytes |
| postgres | G2 | Templates | Excel template upload + WIR filled in the consultant format | PASS | 1 sheet(s), 1947 bytes |
| postgres | G3 | Templates | a record with no template says so, not a crash | PASS |  |
| postgres | G4 | Drawings | Design uploads a sheet, PM approves, drawing register exports | PASS | 1 sheet(s), 9628 bytes |
| postgres | G5 | Minutes | DC drafts minutes, issues them, action is numbered, PM closes it, Word downloads | PASS | 6110 bytes / 1 sheet(s), 9096 bytes |
| postgres | G6 | Correspondence | DC logs an incoming letter; the issued reply closes it | PASS | IN-001 → Replied — LTR-002 issued 2026-10-07 |
| postgres | G7 | Site diary | Document Control saves a diary; the PM submits it; Word and print versions download | PASS | 49477 bytes / 27744 bytes |
| postgres | G8 | Issues | site raises an issue; office issues it; issue notice renders | PASS | 8673 bytes |
| postgres | G9 | Workflows | every register type can be walked to the end of its workflow | PASS | 14 types moved |
| postgres | G10 | Access | consultant (read-only) cannot raise records, payments or drawings | PASS |  |
| postgres | G11 | Access | a site engineer cannot approve payment or drawings | PASS |  |
| postgres | G12 | Modules | switching Commercial off hides and refuses it; on again keeps every record | PASS |  |
| postgres | G13 | Programme | Primavera .xer preview and import | UNTESTABLE | no --xer file given |
| postgres | G14 | Intake | folder intake: open batch, scan files, read back | PASS | batch bat_muxxs0brzspi9y read back |
| postgres | G15 | Dashboards | "Needs my attention" answers for every seat | PASS |  |
| postgres | G16 | Notifications | DC notifies the team; PM sees it under the bell | PASS |  |
| postgres | G17 | Go-live | AETRAA Admin takes the project live | PASS | already live |
| postgres | G18 | Email | email is off locally and the platform says so | PASS | {"driver":"none","driver_label":"not configured","key":false,"from":"","test_sender":false,"sender_set":false,"people":"11","people_with_ema |
| postgres | H1 | Browser | AETRAA Admin (owner): 52 pages drawn without errors | PASS |  |
| postgres | H1 | Browser | AETRAA Admin (owner) (phone): 6 pages drawn without errors | PASS |  |
| postgres | H1 | Browser | Principal: 52 pages drawn without errors | PASS |  |
| postgres | H1 | Browser | Project Manager: 52 pages drawn without errors | PASS |  |
| postgres | H1 | Browser | Project Manager (phone): 6 pages drawn without errors | PASS |  |
| postgres | H1 | Browser | Planning Engineer: 52 pages drawn without errors | PASS |  |
| postgres | H1 | Browser | Site Engineer — Civil: 52 pages drawn without errors | PASS |  |
| postgres | H1 | Browser | Site Engineer — Civil (phone): 6 pages drawn without errors | PASS |  |
| postgres | H1 | Browser | Site Engineer — MEP: 52 pages drawn without errors | PASS |  |
| postgres | H1 | Browser | Design Manager: 52 pages drawn without errors | PASS |  |
| postgres | H1 | Browser | Document Controller: 52 pages drawn without errors | PASS |  |
| postgres | H1 | Browser | QA/QC Engineer: 52 pages drawn without errors | PASS |  |
| postgres | H1 | Browser | HSE Officer: 52 pages drawn without errors | PASS |  |
| postgres | H1 | Browser | Quantity Surveyor: 52 pages drawn without errors | PASS |  |
| postgres | H1 | Browser | Consultant (read-only): 52 pages drawn without errors | PASS |  |
| postgres | A5 | Boot | server log has no errors during the run | PASS |  |
| all | U1 | Untestable here | Sign-in codes by email (Azure Communication Services) | UNTESTABLE | sends real email; needs the live ACS connection string. Check by hand on the live site with one internal address. |
| all | U2 | Untestable here | Scheduled sends: daily 18:00, weekly Mon 07:00, monthly 1st 08:00, 06:00 digest | UNTESTABLE | driven by the server clock and email; the report bodies they send are covered by F1. |
| all | U3 | Untestable here | AI report narrative with a real key | UNTESTABLE | needs ANTHROPIC_API_KEY and spends money; only the switched-off path is tested (F2). |
| all | U4 | Untestable here | Azure object storage for files | UNTESTABLE | needs the live S3/Blob credentials; locally files go in the database. After deploy, sign in as owner and open /api/storage — it must say working: true. |
| all | U5 | Untestable here | Azure hosting, DNS, TLS for app.aetraa.ae | UNTESTABLE | infrastructure, not code; use --live-readonly after deploy. |
| all | U6 | Untestable here | Installing as a phone app (PWA) | UNTESTABLE | needs a real phone over HTTPS. |
