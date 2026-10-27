# AETRAA Platform — pre-launch test plan

Run before every deploy to https://app.aetraa.ae. Everything runs on this Mac,
on 127.0.0.1; nothing is sent to the live site (except `--live-readonly`, which
only GETs public pages).

```bash
cd "~/Documents/AETRAA Platform/prelaunch"
npm install                       # once
node run.mjs --xer "/path/to/a/real.xer" --live-readonly
```

Results land in `results/<date-time>/`: `summary.md` (one line per check),
`results.json`, every generated file under `<backend>/outputs/`, a screenshot of
every page under `<backend>/screens/`, and the server log.

## Testing YOUR project before it goes live

When a project is set up locally (all documents in, every setup step done):

```bash
node run.mjs --project-db "../local-data/aetraa.db"                 # every project
node run.mjs --project-db "../local-data/aetraa.db" --project "Tower"  # one project
```

It copies the database to a temporary folder (the original is never opened for
writing), starts the release on the copy, and for each project checks:

| ID | What |
|---|---|
| P1–P2 | the setup checklist (`/api/project-check`): missing logos, parties, documents, unsigned workflow steps, drawing gate; and whether it is live |
| P3 | every person on the project signs in |
| P4 | every page answers for the owner and every person; "Needs my attention" for each |
| P5 | every report (daily, weekly, monthly, look-ahead, programme, HSE) as page and Word |
| P6–P7 | every register workbook; programme loaded and P6 progress workbook |
| P8 | **every consultant template you uploaded, filled from one of the project's own records** (a test record is made on the copy if none exists) — no `{{placeholder}}` left |
| P9 | every IPC's Excel, letter and pack |
| H1 | every page in headless Chrome for every person |

## Clicking through as the end users (UAT)

A test company with a test person in every seat, on this Mac, so you can do
the work as each of them would: the site engineer types a % and submits, the PM
opens their dashboard and signs it off, and so on.

```bash
node sandbox.mjs              # Terminal 1 — leave running; prints a sign-in card
node uat-flows.mjs            # Terminal 2 — does every hand-off on the real screens
node uat-flows.mjs --show     # the same, with the browser windows visible
```

- The test people are `uat.<role>@uat.example` — a domain reserved for testing
  that can never receive mail, and email is off anyway. Their codes are on the
  card and in `sandbox-data/CARD.txt`.
- To do it by hand: open http://127.0.0.1:8790 in a normal window as the site
  engineer and in a private window as the PM, and pass the work between them.
- `node sandbox.mjs --fresh` throws the test data away and starts again.
- Nothing here touches your real `local-data` or the live site.

`uat-flows.mjs` covers, each step by the person who owns it, through the screens:

| Flow | Hand-offs |
|---|---|
| 1 | Site engineer sets 50% and submits → PM dashboard shows it live; a Civil engineer is refused an MEP activity |
| 2 | 100% without a photo is stopped → photo + 100% → PM signs off → the tile and the list agree → site sees "Verified" |
| 3 | Site sends 100% → PM queries it with a note → site sees "Queried by" and the note |
| 4 | Design fills the New RFI form → PM approves → DC issues → DC records the consultant's code → closed |
| 5 | Submittal, material approval, WIR, NCR, permit to work, variation, material request — each walked to closed by whoever each step names |
| 6 | IPC: QS prepares → PM approves → DC issues → certificate recorded → payment recorded |
| 7 | Every person's dashboard opens with no script errors afterwards |

## What is under test

The **release file** that will be uploaded (`releases/aetraa-release-*.tgz`,
newest by default), not the source folder. The two differ: the Oct 2 release
carries screens and modules (`/home`, `/new`, `/workflows`, `/contract`,
`/parties`, `/handover`, roles and sections) that the folder's `src/` does not
have, so the folder's own `npm test` does not test what is deployed.

Each release is tested twice, on the two databases it supports:

| Backend | How | Why |
|---|---|---|
| SQLite | `local.mjs` | the local intake copy |
| PostgreSQL | `server.js` + PGlite on a socket | what the live server runs |

## Checks

| ID | Area | What is proved | Pass when |
|---|---|---|---|
| A6 | Boot | `local.mjs` restarts on a database that already holds projects, and keeps them | projects still there |
| A0–A5 | Boot | release unpacks, installs, starts; owner code signs in; wrong code refused; file store round-trips; server log clean | every step answers, `/api/storage` says working |
| B1–B2 | Setup workflow | onboarding a company and project, 11 seats, programme, BOQ, BOM, authorities, progress, every register, PM approvals, BOM orders/GRN, a week of HSE logs, and an IPC prepared → approved → issued → certified (the release's own demo seed) | every API call returns < 400 |
| C1 | Sign-in | each of the 11 seats signs in with its personal code | all sign in |
| D1–D2 | Dashboards & access | every page the release declares, as every seat; client seats cannot use the setup console | no 5xx, no error page |
| E1 | API | every GET endpoint the release declares, as PM and owner | no 5xx |
| F1–F2 | Report generators | daily, weekly, monthly (this and last), look-ahead, programme, HSE — as HTML and as Word; AI narrative off without a key | valid file, project named, no `undefined`/`NaN` |
| F3–F6 | Register generators | 12 register workbooks + 12 schedule workbooks + drawings + BOQ; programme CSV; P6 progress + review workbooks | valid .xlsx, sheets present |
| F7–F11 | Payment | IPC reaches certified; BOQ valuation .xlsx, covering letter, full pack .zip; a bad period is blocked | valid files; blocker raised |
| G1–G3 | Template generator | a consultant Word form and Excel form with `{{tokens}}` uploaded, filled from an RFI and a WIR; a type with no template says so | no `{{` left, ref and project filled |
| G4 | Drawings | Design uploads, PM approves, drawing register exports | sheet in register |
| G5 | Minutes | draft → issue → action numbered → owner closes → Word + action log | each step accepted |
| G6 | Correspondence | incoming letter logged; issued reply closes it | status "Replied" |
| G7 | Site diary | site saves, office submits, Word + print copy | submitted, files valid |
| G8 | Issues | site raises, office issues, notice renders | |
| G9 | Workflows | every register type is moved to the end of its workflow by whoever owns each step | none stuck |
| G10–G11 | Access | consultant cannot raise; site cannot approve payment or drawings | refused |
| G12 | Modules | Commercial off → BOQ refused; on → back | |
| G13 | Programme | real Primavera `.xer` preview + import | activities loaded (needs `--xer`) |
| G14 | Intake | folder intake batch, scan, read back | |
| G15–G18 | Dashboards, notifications, go-live, email | attention list for every seat; notify reaches the bell; project goes live; email is off locally | |
| H1 | Browser | headless Chrome, every open page for every seat (desktop), and the site pages on a phone-size screen | no JS error, no 5xx, not blank, no `undefined`/`NaN` on screen; screenshot kept |
| L1 | Live (read-only) | `/`, `/healthz`, manifest, `/demo` on app.aetraa.ae | no 5xx |

## Not testable from this Mac (listed in every run as U1–U6)

Email sign-in codes and scheduled sends (real Azure email), the AI narrative
with a real key, Azure object storage, Azure hosting/DNS/TLS, and installing as
a phone app. Each has a one-line manual check in `summary.md`.

## After deploy (by hand, five minutes)

1. `node run.mjs --live-readonly --backend sqlite --no-browser` — the L1 lines must pass.
2. Sign in on the live site as owner → open `/api/storage` → `working: true`.
3. Send yourself a sign-in code at an aetraa.ae address; sign in with it.
4. Open one project's dashboard as PM on a phone.
