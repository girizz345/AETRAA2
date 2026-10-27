# AETRAA pre-launch test

Release: `aetraa-release-20261005-1143.tgz`  
Run: 2026-10-05T08:01:33.990Z  
**193 pass · 4 fail · 1 warn · 8 untestable**

| Backend | ID | Area | Check | Result | Detail |
|---|---|---|---|---|---|
| all | A0 | Boot | release unpacks and installs its packages | PASS | aetraa-release-20261005-1143.tgz |
| sqlite | A1 | Boot | release starts (local.mjs) | PASS | http://127.0.0.1:60953 |
| sqlite | A2 | Boot | owner code signs in | PASS |  |
| sqlite | A3 | Boot | file storage round-trips (/api/storage) | PASS | the database |
| sqlite | A4 | Boot | wrong code is refused | PASS |  |
| sqlite | B1 | Setup workflow | onboard company + project, team, programme, BOQ, BOM, registers, HSE log, IPC chain (demo seed) | PASS | project residential-tower-g-2p-1 |
| sqlite | B2 | Setup workflow | every seed call accepted (104 calls) | FAIL | seed POST /api/setup/authorities → 400 choose at least one authority / seed POST /api/update → 422 A photograph is needed before an activity can be marked complete. / seed POST /api/update → 422 A photograph is needed before an activity can be marked complete. / seed POST /api/update → 422 A photograph is needed before an activity can be marked complete. / seed POST /api/update → 422 A photograph is needed before an activity can be marked complete. / seed POST /api/update → 422 A photograph is needed before an activity can be marked complete. |
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
| sqlite | D1 | Dashboards | every page answers for AETRAA Admin (owner) (33 open, 1 refused) | PASS |  |
| sqlite | D1 | Dashboards | every page answers for Principal (33 open, 1 refused) | PASS |  |
| sqlite | D1 | Dashboards | every page answers for Project Manager (33 open, 1 refused) | PASS |  |
| sqlite | D1 | Dashboards | every page answers for Planning Engineer (34 open, 0 refused) | PASS |  |
| sqlite | D1 | Dashboards | every page answers for Site Engineer — Civil (34 open, 0 refused) | PASS |  |
| sqlite | D1 | Dashboards | every page answers for Site Engineer — MEP (34 open, 0 refused) | PASS |  |
| sqlite | D1 | Dashboards | every page answers for Design Manager (34 open, 0 refused) | PASS |  |
| sqlite | D1 | Dashboards | every page answers for Document Controller (34 open, 0 refused) | PASS |  |
| sqlite | D1 | Dashboards | every page answers for QA/QC Engineer (34 open, 0 refused) | PASS |  |
| sqlite | D1 | Dashboards | every page answers for HSE Officer (34 open, 0 refused) | PASS |  |
| sqlite | D1 | Dashboards | every page answers for Quantity Surveyor (34 open, 0 refused) | PASS |  |
| sqlite | D1 | Dashboards | every page answers for Consultant (read-only) (33 open, 1 refused) | PASS |  |
| sqlite | D2 | Access | setup console is not usable by a client seat | PASS |  |
| sqlite | E1 | API | no GET endpoint crashes for Project Manager (90 endpoints) | PASS |  |
| sqlite | E1 | API | no GET endpoint crashes for AETRAA Admin (owner) (90 endpoints) | PASS |  |
| sqlite | F1 | Reports | daily report 2026-10-05 as html | PASS | 14619 bytes |
| sqlite | F1 | Reports | daily report 2026-10-05 as doc | PASS | 15217 bytes |
| sqlite | F1 | Reports | weekly report 2026-10-05 as html | PASS | 70512 bytes |
| sqlite | F1 | Reports | weekly report 2026-10-05 as doc | PASS | 68328 bytes |
| sqlite | F1 | Reports | monthly report 2026-10 as html | PASS | 70589 bytes |
| sqlite | F1 | Reports | monthly report 2026-10 as doc | PASS | 68393 bytes |
| sqlite | F1 | Reports | monthly report 2026-09 as html | PASS | 38628 bytes |
| sqlite | F1 | Reports | monthly report 2026-09 as doc | PASS | 36525 bytes |
| sqlite | F1 | Reports | lookahead report 2026-10-05 as html | PASS | 16769 bytes |
| sqlite | F1 | Reports | lookahead report 2026-10-05 as doc | PASS | 17372 bytes |
| sqlite | F1 | Reports | programme report 2026-10-05 as html | PASS | 22836 bytes |
| sqlite | F1 | Reports | programme report 2026-10-05 as doc | PASS | 20631 bytes |
| sqlite | F1 | Reports | hse report 2026-10 as html | PASS | 36985 bytes |
| sqlite | F1 | Reports | hse report 2026-10 as doc | PASS | 37582 bytes |
| sqlite | F2 | Reports | AI narrative is off without a key and says so | PASS | disabled, as expected with no key |
| sqlite | F3 | Registers | register workbook: submittals | PASS | 2 sheet(s), 12708 bytes |
| sqlite | F4 | Registers | schedule workbook: submittals | PASS | 1 sheet(s), 8478 bytes |
| sqlite | F3 | Registers | register workbook: rfi | PASS | 2 sheet(s), 13362 bytes |
| sqlite | F4 | Registers | schedule workbook: rfi | PASS | 1 sheet(s), 8466 bytes |
| sqlite | F3 | Registers | register workbook: matapp | PASS | 2 sheet(s), 10306 bytes |
| sqlite | F4 | Registers | schedule workbook: matapp | PASS | 1 sheet(s), 7641 bytes |
| sqlite | F3 | Registers | register workbook: authority | PASS | 1 sheet(s), 7718 bytes |
| sqlite | F4 | Registers | schedule workbook: authority | PASS | 1 sheet(s), 7254 bytes |
| sqlite | F3 | Registers | register workbook: letters | PASS | 2 sheet(s), 11087 bytes |
| sqlite | F4 | Registers | schedule workbook: letters | PASS | 1 sheet(s), 7691 bytes |
| sqlite | F3 | Registers | register workbook: variations | PASS | 2 sheet(s), 13383 bytes |
| sqlite | F4 | Registers | schedule workbook: variations | PASS | 1 sheet(s), 8398 bytes |
| sqlite | F3 | Registers | register workbook: inspections | PASS | 2 sheet(s), 12724 bytes |
| sqlite | F4 | Registers | schedule workbook: inspections | PASS | 1 sheet(s), 8565 bytes |
| sqlite | F3 | Registers | register workbook: ncr | PASS | 2 sheet(s), 11979 bytes |
| sqlite | F4 | Registers | schedule workbook: ncr | PASS | 1 sheet(s), 8076 bytes |
| sqlite | F3 | Registers | register workbook: permits | PASS | 2 sheet(s), 12162 bytes |
| sqlite | F4 | Registers | schedule workbook: permits | PASS | 1 sheet(s), 8073 bytes |
| sqlite | F3 | Registers | register workbook: hseobs | PASS | 2 sheet(s), 13788 bytes |
| sqlite | F4 | Registers | schedule workbook: hseobs | PASS | 1 sheet(s), 8477 bytes |
| sqlite | F3 | Registers | register workbook: mr | PASS | 2 sheet(s), 12116 bytes |
| sqlite | F4 | Registers | schedule workbook: mr | PASS | 1 sheet(s), 8041 bytes |
| sqlite | F3 | Registers | register workbook: certs | PASS | 2 sheet(s), 12887 bytes |
| sqlite | F4 | Registers | schedule workbook: certs | PASS | 1 sheet(s), 8372 bytes |
| sqlite | F3 | Registers | register workbook: drawings | PASS | 1 sheet(s), 7864 bytes |
| sqlite | F3 | Registers | register workbook: boq | PASS | 2 sheet(s), 15015 bytes |
| sqlite | F5 | Registers | CSV export of the programme | PASS | 32 lines |
| sqlite | F6 | Programme | P6 progress workbook and review workbook | PASS | 2 sheet(s), 9006 bytes / 1 sheet(s), 8928 bytes |
| sqlite | F7 | Payment | interim payment certificate reached "certified" | PASS | IPA-01 Certified — client to pay net 30627000 |
| sqlite | F8 | Payment | IPC BOQ valuation workbook | PASS | 6 sheet(s), 36568 bytes |
| sqlite | F9 | Payment | IPC covering letter (Word) | PASS | 11628 bytes |
| sqlite | F10 | Payment | IPC full pack (.zip) | PASS | 3 files: IPA-01 - Residential Tower — G+2P+12/01 Payment application IPA-01.doc, IPA-01 - Residential Tower — G+2P+12/02 BOQ valuation IPA-01.xlsx, IPA-01 - Residential Tower — G+2P+12/03 Progress report 2026-09-05 to 2026-10-05.doc |
| sqlite | F11 | Payment | a second application while the first is open, or a bad period, is blocked | PASS | The period cannot end after today. |
| sqlite | G1 | Templates | Word template upload + RFI filled in the consultant format | PASS | 1070 bytes |
| sqlite | G2 | Templates | Excel template upload + WIR filled in the consultant format | PASS | 1 sheet(s), 1947 bytes |
| sqlite | G3 | Templates | a record with no template says so, not a crash | PASS |  |
| sqlite | G4 | Drawings | Design uploads a sheet, PM approves, drawing register exports | PASS | 1 sheet(s), 8625 bytes |
| sqlite | G5 | Minutes | DC drafts minutes, issues them, action is numbered, PM closes it, Word downloads | PASS | 6110 bytes / 1 sheet(s), 8246 bytes |
| sqlite | G6 | Correspondence | DC logs an incoming letter; the issued reply closes it | PASS | IN-001 → Replied — LTR-002 issued 2026-10-05 |
| sqlite | G7 | Site diary | site saves a diary; office submits it; Word and print versions download | PASS | 58181 bytes / 27694 bytes |
| sqlite | G8 | Issues | site raises an issue; office issues it; issue notice renders | PASS | 8673 bytes |
| sqlite | G9 | Workflows | every register type can be walked to the end of its workflow | PASS | 13 types moved |
| sqlite | G10 | Access | consultant (read-only) cannot raise records, payments or drawings | PASS |  |
| sqlite | G11 | Access | a site engineer cannot approve payment or drawings | PASS |  |
| sqlite | G12 | Modules | switching Commercial off hides and refuses it; on again keeps every record | PASS |  |
| sqlite | G13 | Programme | Primavera .xer preview and import | UNTESTABLE | no --xer file given |
| sqlite | G14 | Intake | folder intake: open batch, scan files, read back | PASS | batch bat_muuynvjrlri0ds read back |
| sqlite | G15 | Dashboards | "Needs my attention" answers for every seat | PASS |  |
| sqlite | G16 | Notifications | DC notifies the team; PM sees it under the bell | PASS |  |
| sqlite | G17 | Go-live | AETRAA Admin takes the project live | PASS | already live |
| sqlite | G18 | Email | email is off locally and the platform says so | PASS | {"driver":"none","driver_label":"not configured","key":false,"from":"","test_sender":false,"sender_set":false,"people":11,"people_with_email |
| sqlite | A5 | Boot | server log has no errors during the run | PASS |  |
| sqlite | A6 | Boot | local.mjs restarts on its own database and the projects are still there | FAIL | restart failed: Error: table issues already exists |
| postgres | A1 | Boot | release starts (server.js on PostgreSQL) | PASS | http://127.0.0.1:60994 |
| postgres | A2 | Boot | owner code signs in | PASS |  |
| postgres | A3 | Boot | file storage round-trips (/api/storage) | PASS | the database |
| postgres | A4 | Boot | wrong code is refused | FAIL | status 500 |
| postgres | B1 | Setup workflow | onboard company + project, team, programme, BOQ, BOM, registers, HSE log, IPC chain (demo seed) | PASS | project residential-tower-g-2p-1 |
| postgres | B2 | Setup workflow | every seed call accepted (104 calls) | FAIL | seed POST /api/setup/authorities → 400 choose at least one authority / seed POST /api/update → 422 A photograph is needed before an activity can be marked complete. / seed POST /api/update → 422 A photograph is needed before an activity can be marked complete. / seed POST /api/update → 422 A photograph is needed before an activity can be marked complete. / seed POST /api/update → 422 A photograph is needed before an activity can be marked complete. / seed POST /api/update → 422 A photograph is needed before an activity can be marked complete. |
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
| postgres | D1 | Dashboards | every page answers for AETRAA Admin (owner) (33 open, 1 refused) | PASS |  |
| postgres | D1 | Dashboards | every page answers for Principal (33 open, 1 refused) | PASS |  |
| postgres | D1 | Dashboards | every page answers for Project Manager (33 open, 1 refused) | PASS |  |
| postgres | D1 | Dashboards | every page answers for Planning Engineer (34 open, 0 refused) | PASS |  |
| postgres | D1 | Dashboards | every page answers for Site Engineer — Civil (34 open, 0 refused) | PASS |  |
| postgres | D1 | Dashboards | every page answers for Site Engineer — MEP (34 open, 0 refused) | PASS |  |
| postgres | D1 | Dashboards | every page answers for Design Manager (34 open, 0 refused) | PASS |  |
| postgres | D1 | Dashboards | every page answers for Document Controller (34 open, 0 refused) | PASS |  |
| postgres | D1 | Dashboards | every page answers for QA/QC Engineer (34 open, 0 refused) | PASS |  |
| postgres | D1 | Dashboards | every page answers for HSE Officer (34 open, 0 refused) | PASS |  |
| postgres | D1 | Dashboards | every page answers for Quantity Surveyor (34 open, 0 refused) | PASS |  |
| postgres | D1 | Dashboards | every page answers for Consultant (read-only) (33 open, 1 refused) | PASS |  |
| postgres | D2 | Access | setup console is not usable by a client seat | PASS |  |
| postgres | E1 | API | no GET endpoint crashes for Project Manager (90 endpoints) | PASS |  |
| postgres | E1 | API | no GET endpoint crashes for AETRAA Admin (owner) (90 endpoints) | PASS |  |
| postgres | F1 | Reports | daily report 2026-10-05 as html | PASS | 14619 bytes |
| postgres | F1 | Reports | daily report 2026-10-05 as doc | PASS | 15217 bytes |
| postgres | F1 | Reports | weekly report 2026-10-05 as html | PASS | 70421 bytes |
| postgres | F1 | Reports | weekly report 2026-10-05 as doc | PASS | 68237 bytes |
| postgres | F1 | Reports | monthly report 2026-10 as html | PASS | 70497 bytes |
| postgres | F1 | Reports | monthly report 2026-10 as doc | PASS | 68301 bytes |
| postgres | F1 | Reports | monthly report 2026-09 as html | PASS | 38536 bytes |
| postgres | F1 | Reports | monthly report 2026-09 as doc | PASS | 36433 bytes |
| postgres | F1 | Reports | lookahead report 2026-10-05 as html | PASS | 16769 bytes |
| postgres | F1 | Reports | lookahead report 2026-10-05 as doc | PASS | 17372 bytes |
| postgres | F1 | Reports | programme report 2026-10-05 as html | PASS | 22836 bytes |
| postgres | F1 | Reports | programme report 2026-10-05 as doc | PASS | 20631 bytes |
| postgres | F1 | Reports | hse report 2026-10 as html | PASS | 36985 bytes |
| postgres | F1 | Reports | hse report 2026-10 as doc | PASS | 37582 bytes |
| postgres | F2 | Reports | AI narrative is off without a key and says so | PASS | disabled, as expected with no key |
| postgres | F3 | Registers | register workbook: submittals | PASS | 2 sheet(s), 12708 bytes |
| postgres | F4 | Registers | schedule workbook: submittals | PASS | 1 sheet(s), 8478 bytes |
| postgres | F3 | Registers | register workbook: rfi | PASS | 2 sheet(s), 13362 bytes |
| postgres | F4 | Registers | schedule workbook: rfi | PASS | 1 sheet(s), 8466 bytes |
| postgres | F3 | Registers | register workbook: matapp | PASS | 2 sheet(s), 10306 bytes |
| postgres | F4 | Registers | schedule workbook: matapp | PASS | 1 sheet(s), 7641 bytes |
| postgres | F3 | Registers | register workbook: authority | PASS | 1 sheet(s), 7718 bytes |
| postgres | F4 | Registers | schedule workbook: authority | PASS | 1 sheet(s), 7254 bytes |
| postgres | F3 | Registers | register workbook: letters | PASS | 2 sheet(s), 11087 bytes |
| postgres | F4 | Registers | schedule workbook: letters | PASS | 1 sheet(s), 7691 bytes |
| postgres | F3 | Registers | register workbook: variations | PASS | 2 sheet(s), 13383 bytes |
| postgres | F4 | Registers | schedule workbook: variations | PASS | 1 sheet(s), 8398 bytes |
| postgres | F3 | Registers | register workbook: inspections | PASS | 2 sheet(s), 12724 bytes |
| postgres | F4 | Registers | schedule workbook: inspections | PASS | 1 sheet(s), 8565 bytes |
| postgres | F3 | Registers | register workbook: ncr | PASS | 2 sheet(s), 11979 bytes |
| postgres | F4 | Registers | schedule workbook: ncr | PASS | 1 sheet(s), 8076 bytes |
| postgres | F3 | Registers | register workbook: permits | PASS | 2 sheet(s), 12162 bytes |
| postgres | F4 | Registers | schedule workbook: permits | PASS | 1 sheet(s), 8073 bytes |
| postgres | F3 | Registers | register workbook: hseobs | PASS | 2 sheet(s), 13788 bytes |
| postgres | F4 | Registers | schedule workbook: hseobs | PASS | 1 sheet(s), 8477 bytes |
| postgres | F3 | Registers | register workbook: mr | PASS | 2 sheet(s), 12116 bytes |
| postgres | F4 | Registers | schedule workbook: mr | PASS | 1 sheet(s), 8041 bytes |
| postgres | F3 | Registers | register workbook: certs | PASS | 2 sheet(s), 12887 bytes |
| postgres | F4 | Registers | schedule workbook: certs | PASS | 1 sheet(s), 8372 bytes |
| postgres | F3 | Registers | register workbook: drawings | PASS | 1 sheet(s), 7864 bytes |
| postgres | F3 | Registers | register workbook: boq | PASS | 2 sheet(s), 15015 bytes |
| postgres | F5 | Registers | CSV export of the programme | PASS | 32 lines |
| postgres | F6 | Programme | P6 progress workbook and review workbook | PASS | 2 sheet(s), 9006 bytes / 1 sheet(s), 8928 bytes |
| postgres | F7 | Payment | interim payment certificate reached "certified" | PASS | IPA-01 Certified — client to pay net 30627000 |
| postgres | F8 | Payment | IPC BOQ valuation workbook | PASS | 6 sheet(s), 36568 bytes |
| postgres | F9 | Payment | IPC covering letter (Word) | PASS | 11628 bytes |
| postgres | F10 | Payment | IPC full pack (.zip) | PASS | 3 files: IPA-01 - Residential Tower — G+2P+12/01 Payment application IPA-01.doc, IPA-01 - Residential Tower — G+2P+12/02 BOQ valuation IPA-01.xlsx, IPA-01 - Residential Tower — G+2P+12/03 Progress report 2026-09-05 to 2026-10-05.doc |
| postgres | F11 | Payment | a second application while the first is open, or a bad period, is blocked | PASS | The period cannot end after today. |
| postgres | G1 | Templates | Word template upload + RFI filled in the consultant format | PASS | 1070 bytes |
| postgres | G2 | Templates | Excel template upload + WIR filled in the consultant format | PASS | 1 sheet(s), 1947 bytes |
| postgres | G3 | Templates | a record with no template says so, not a crash | PASS |  |
| postgres | G4 | Drawings | Design uploads a sheet, PM approves, drawing register exports | PASS | 1 sheet(s), 8625 bytes |
| postgres | G5 | Minutes | DC drafts minutes, issues them, action is numbered, PM closes it, Word downloads | PASS | 6110 bytes / 1 sheet(s), 8246 bytes |
| postgres | G6 | Correspondence | DC logs an incoming letter; the issued reply closes it | PASS | IN-001 → Replied — LTR-002 issued 2026-10-05 |
| postgres | G7 | Site diary | site saves a diary; office submits it; Word and print versions download | PASS | 58181 bytes / 27694 bytes |
| postgres | G8 | Issues | site raises an issue; office issues it; issue notice renders | PASS | 8673 bytes |
| postgres | G9 | Workflows | every register type can be walked to the end of its workflow | PASS | 13 types moved |
| postgres | G10 | Access | consultant (read-only) cannot raise records, payments or drawings | PASS |  |
| postgres | G11 | Access | a site engineer cannot approve payment or drawings | PASS |  |
| postgres | G12 | Modules | switching Commercial off hides and refuses it; on again keeps every record | PASS |  |
| postgres | G13 | Programme | Primavera .xer preview and import | UNTESTABLE | no --xer file given |
| postgres | G14 | Intake | folder intake: open batch, scan files, read back | PASS | batch bat_muuyo0tvxijhyi read back |
| postgres | G15 | Dashboards | "Needs my attention" answers for every seat | PASS |  |
| postgres | G16 | Notifications | DC notifies the team; PM sees it under the bell | PASS |  |
| postgres | G17 | Go-live | AETRAA Admin takes the project live | PASS | already live |
| postgres | G18 | Email | email is off locally and the platform says so | PASS | {"driver":"none","driver_label":"not configured","key":false,"from":"","test_sender":false,"sender_set":false,"people":"11","people_with_ema |
| postgres | A5 | Boot | server log has no errors during the run | WARN | POST /api/login failed after 2ms: error: could not determine data type of parameter $1 /   severity: 'ERROR', |
| all | U1 | Untestable here | Sign-in codes by email (Azure Communication Services) | UNTESTABLE | sends real email; needs the live ACS connection string. Check by hand on the live site with one internal address. |
| all | U2 | Untestable here | Scheduled sends: daily 18:00, weekly Mon 07:00, monthly 1st 08:00, 06:00 digest | UNTESTABLE | driven by the server clock and email; the report bodies they send are covered by F1. |
| all | U3 | Untestable here | AI report narrative with a real key | UNTESTABLE | needs ANTHROPIC_API_KEY and spends money; only the switched-off path is tested (F2). |
| all | U4 | Untestable here | Azure object storage for files | UNTESTABLE | needs the live S3/Blob credentials; locally files go in the database. After deploy, sign in as owner and open /api/storage — it must say working: true. |
| all | U5 | Untestable here | Azure hosting, DNS, TLS for app.aetraa.ae | UNTESTABLE | infrastructure, not code; use --live-readonly after deploy. |
| all | U6 | Untestable here | Installing as a phone app (PWA) | UNTESTABLE | needs a real phone over HTTPS. |
