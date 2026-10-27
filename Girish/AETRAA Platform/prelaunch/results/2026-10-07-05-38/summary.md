# AETRAA pre-launch test

Release: `test-drive`  
Run: 2026-10-07T05:38:57.709Z  
**11 pass · 5 fail · 0 warn · 6 untestable**

| Backend | ID | Area | Check | Result | Detail |
|---|---|---|---|---|---|
| all | A0 | Boot | release unpacks and installs its packages | PASS | test-drive |
| sqlite | A1 | Boot | release starts (local.mjs) | PASS | http://127.0.0.1:51824 |
| sqlite | A2 | Boot | owner code signs in | PASS |  |
| sqlite | A3 | Boot | file storage round-trips (/api/storage) | PASS | the database |
| sqlite | A4 | Boot | wrong code is refused | PASS |  |
| sqlite | B1 | Setup workflow | onboard company + project, team, programme, BOQ, BOM, registers, HSE log, IPC chain (demo seed) | FAIL | ((au && au.library) // []).filter is not a function |
| sqlite | B2 | Setup workflow | every seed call accepted (16 calls) | PASS |  |
| sqlite | Z | Harness | run stopped | FAIL | Error: cannot continue without a project     at runOn (file:///D:/Girish/AETRAA/Girish/AETRAA%20Platform/prelaunch/run.mjs:364:24)     at process.processTicksAndRejections (node:internal/process/task_queues:104:5)     at async file:///D:/Girish/AETRAA/Girish/AETRAA%20Platform/prelaunch/run.mjs:1009:46 |
| sqlite | A6 | Boot | local.mjs restarts on its own database and the projects are still there | PASS | 1 project(s) kept |
| postgres | A1 | Boot | release starts (server.js on PostgreSQL) | PASS | http://127.0.0.1:60051 |
| postgres | A2 | Boot | owner code signs in | PASS |  |
| postgres | A3 | Boot | file storage round-trips (/api/storage) | PASS | the database |
| postgres | A4 | Boot | wrong code is refused | FAIL | status 500 |
| postgres | B1 | Setup workflow | onboard company + project, team, programme, BOQ, BOM, registers, HSE log, IPC chain (demo seed) | FAIL | ((au && au.library) // []).filter is not a function |
| postgres | B2 | Setup workflow | every seed call accepted (16 calls) | PASS |  |
| postgres | Z | Harness | run stopped | FAIL | Error: cannot continue without a project     at runOn (file:///D:/Girish/AETRAA/Girish/AETRAA%20Platform/prelaunch/run.mjs:364:24)     at process.processTicksAndRejections (node:internal/process/task_queues:104:5)     at async file:///D:/Girish/AETRAA/Girish/AETRAA%20Platform/prelaunch/run.mjs:1009:46 |
| all | U1 | Untestable here | Sign-in codes by email (Azure Communication Services) | UNTESTABLE | sends real email; needs the live ACS connection string. Check by hand on the live site with one internal address. |
| all | U2 | Untestable here | Scheduled sends: daily 18:00, weekly Mon 07:00, monthly 1st 08:00, 06:00 digest | UNTESTABLE | driven by the server clock and email; the report bodies they send are covered by F1. |
| all | U3 | Untestable here | AI report narrative with a real key | UNTESTABLE | needs ANTHROPIC_API_KEY and spends money; only the switched-off path is tested (F2). |
| all | U4 | Untestable here | Azure object storage for files | UNTESTABLE | needs the live S3/Blob credentials; locally files go in the database. After deploy, sign in as owner and open /api/storage — it must say working: true. |
| all | U5 | Untestable here | Azure hosting, DNS, TLS for app.aetraa.ae | UNTESTABLE | infrastructure, not code; use --live-readonly after deploy. |
| all | U6 | Untestable here | Installing as a phone app (PWA) | UNTESTABLE | needs a real phone over HTTPS. |
