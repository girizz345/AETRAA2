# UAT hand-offs on the sandbox

**66 pass · 1 fail · 0 warn**

| Flow | Step | Result | Detail |
|---|---|---|---|
| 1 Site progress → PM sees it | site engineer sets Ground floor slab to 50% and presses Submit | PASS |  |
| 1 Site progress → PM sees it | PM dashboard shows A130 at 50% from the site engineer | PASS |  |
| 1 Site progress → PM sees it | site engineer cannot report an MEP activity (outside their trade) | PASS | refused |
| 2 Completion → PM sign-off | site engineer tries 100% with no photo and is stopped | PASS |  |
| 2 Completion → PM sign-off | site engineer photographs the activity and sends 100% | PASS |  |
| 2 Completion → PM sign-off | PM sees it waiting for sign-off and signs it off | PASS |  |
| 2 Completion → PM sign-off | the "awaiting sign-off" tile agrees with the list | FAIL | tile says 4, the list holds 3 |
| 2 Completion → PM sign-off | site engineer sees "Verified by" on the activity | PASS |  |
| 3 PM queries a completion back | site engineer photographs Ground floor slab and sends 100% | PASS |  |
| 3 PM queries a completion back | PM presses Query on it and writes why | PASS |  |
| 3 PM queries a completion back | site engineer sees "Queried by" with the PM's note | PASS |  |
| 4 RFI: Design → PM → DC → consultant answer | Design fills the New RFI form and presses Generate & route | PASS | RFI-0001 |
| 4 RFI: Design → PM → DC → consultant answer | Project Manager: opens RFI-0001, presses "Approve & sign" | PASS | Approve & sign → Issuing records it as sent to the consultant under your name. You can notify the |
| 4 RFI: Design → PM → DC → consultant answer | Document Controller: opens RFI-0001, presses "Issue" | PASS | Issue → Pick the status the consultant returned and attach their reply to this record. |
| 4 RFI: Design → PM → DC → consultant answer | Document Controller: opens RFI-0001, presses "Record consultant reply" | PASS | Record consultant reply → This record is closed — Code A — Approved. |
| 4 RFI: Design → PM → DC → consultant answer | the RFI ends closed / answered in the register | PASS | Code A — Approved |
| 5 Submittal workflow | Design Manager raises SUB-001 | PASS |  |
| 5 Submittal workflow | Project Manager: opens SUB-001, presses "PM approves to submit" | PASS | Approve & sign → Issuing records it as sent to the consultant under your name. You can notify the |
| 5 Submittal workflow | Document Controller: opens SUB-001, presses "Document Control issues to consultant" | PASS | Issue → Pick the status the consultant returned and attach their reply to this record. |
| 5 Submittal workflow | Document Controller: opens SUB-001, presses "Consultant status recorded (Code A/B/C)" | PASS | Record consultant reply → This record is closed — Code A — Approved. |
| 5 Submittal workflow | reaches the end: Code A — Approved | PASS |  |
| 5 Material approval workflow | Design Manager raises MAR-001 | PASS |  |
| 5 Material approval workflow | QA/QC Engineer: opens MAR-001, presses "QA/QC checks against spec" | PASS | Approve & sign → Waiting on: PM approves to submit — Project Manager. |
| 5 Material approval workflow | Project Manager: opens MAR-001, presses "PM approves to submit" | PASS | Approve & sign → Issuing records it as sent to the consultant under your name. You can notify the |
| 5 Material approval workflow | Document Controller: opens MAR-001, presses "Document Control issues to consultant" | PASS | Issue → Pick the status the consultant returned and attach their reply to this record. |
| 5 Material approval workflow | Document Controller: opens MAR-001, presses "Consultant approval recorded" | PASS | Record consultant reply → This record is closed — Code A — Approved. |
| 5 Material approval workflow | reaches the end: Code A — Approved | PASS |  |
| 5 Inspection request (WIR) workflow | QA/QC Engineer raises WIR-001 | PASS |  |
| 5 Inspection request (WIR) workflow | QA/QC Engineer: opens WIR-001, presses "QA/QC checks work ready" | PASS | Approve & sign → Waiting on: Document Control issues to consultant — Document Control. |
| 5 Inspection request (WIR) workflow | Document Controller: opens WIR-001, presses "Document Control issues to consultant" | PASS | Issue → Waiting on: Inspection result recorded — QA / QC. |
| 5 Inspection request (WIR) workflow | QA/QC Engineer: opens WIR-001, presses "Inspection result recorded" | PASS | Approve & sign → This record is closed — Closed / approved. |
| 5 Inspection request (WIR) workflow | reaches the end: Closed / approved | PASS |  |
| 5 NCR workflow | QA/QC Engineer raises NCR-001 | PASS |  |
| 5 NCR workflow | Site Engineer — Civil: opens NCR-001, presses "Site rectifies" | PASS | Approve & sign → Waiting on: QA/QC verifies & closes — QA / QC. |
| 5 NCR workflow | QA/QC Engineer: opens NCR-001, presses "QA/QC verifies & closes" | PASS | Approve & sign → This record is closed — Closed / approved. |
| 5 NCR workflow | reaches the end: Closed / approved | PASS |  |
| 5 Permit to work workflow | HSE Officer raises PTW-001 | PASS |  |
| 5 Permit to work workflow | HSE Officer: opens PTW-001, presses "HSE review & sign" | PASS | Approve & sign → Waiting on: Work proceeds — Site Engineer. |
| 5 Permit to work workflow | Site Engineer — Civil: opens PTW-001, presses "Work proceeds" | PASS | Approve & sign → Waiting on: HSE closes out at end of shift — HSE. |
| 5 Permit to work workflow | HSE Officer: opens PTW-001, presses "HSE closes out at end of shift" | PASS | Approve & sign → This record is closed — Closed / approved. |
| 5 Permit to work workflow | reaches the end: Closed / approved | PASS |  |
| 5 Variation workflow | Quantity Surveyor raises VO-01 | PASS |  |
| 5 Variation workflow | Project Manager: opens VO-01, presses "PM review" | PASS | Approve & sign → Approving moves it to the next step and records your name against it. |
| 5 Variation workflow | Principal: opens VO-01, presses "Director approval" | PASS | Approve & sign → Issuing records it as sent to the consultant under your name. You can notify the |
| 5 Variation workflow | Document Controller: opens VO-01, presses "Document Control issues to client" | PASS | Issue → Approving moves it to the next step and records your name against it. |
| 5 Variation workflow | Quantity Surveyor: opens VO-01, presses "Client instruction recorded" | PASS | Approve & sign → This record is closed — Closed / approved. |
| 5 Variation workflow | reaches the end: Closed / approved | PASS |  |
| 5 Material request workflow | Site Engineer — Civil raises MR-001 | PASS |  |
| 5 Material request workflow | Project Manager: opens MR-001, presses "PM reviews (checks BOM)" | PASS | Approve & sign → Approving moves it to the next step and records your name against it. |
| 5 Material request workflow | Quantity Surveyor: opens MR-001, presses "Procurement raises LPO" | PASS | Approve & sign → This record is closed — Closed / approved. |
| 5 Material request workflow | reaches the end: Closed / approved | PASS |  |
| 6 IPC: QS → PM → DC → certificate → paid | QS prepares the application (valued from programme progress) | PASS | IPA-01 net 17085060 |
| 6 IPC: QS → PM → DC → certificate → paid | Project Manager: presses approve on IPA-01 | PASS | Approved — Document Control to issue |
| 6 IPC: QS → PM → DC → certificate → paid | Document Controller: presses issue on IPA-01 | PASS | Issued — awaiting the Engineer’s certificate |
| 6 IPC: QS → PM → DC → certificate → paid | Quantity Surveyor: presses certify on IPA-01 | PASS | Certified — client to pay |
| 6 IPC: QS → PM → DC → certificate → paid | Quantity Surveyor: presses pay on IPA-01 | PASS | Part paid |
| 7 Every dashboard after the run | Principal — dashboard opens with no script errors | PASS |  |
| 7 Every dashboard after the run | Project Manager — dashboard opens with no script errors | PASS |  |
| 7 Every dashboard after the run | Planning Engineer — dashboard opens with no script errors | PASS |  |
| 7 Every dashboard after the run | Site Engineer — Civil — dashboard opens with no script errors | PASS |  |
| 7 Every dashboard after the run | Site Engineer — MEP — dashboard opens with no script errors | PASS |  |
| 7 Every dashboard after the run | Design Manager — dashboard opens with no script errors | PASS |  |
| 7 Every dashboard after the run | Document Controller — dashboard opens with no script errors | PASS |  |
| 7 Every dashboard after the run | QA/QC Engineer — dashboard opens with no script errors | PASS |  |
| 7 Every dashboard after the run | HSE Officer — dashboard opens with no script errors | PASS |  |
| 7 Every dashboard after the run | Quantity Surveyor — dashboard opens with no script errors | PASS |  |
| 7 Every dashboard after the run | Consultant (read-only) — dashboard opens with no script errors | PASS |  |
