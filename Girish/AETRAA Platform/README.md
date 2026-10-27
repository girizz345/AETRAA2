# AETRAA — Project Management Module

The post-contract construction management platform. One deployment serves every
client company; each company and project is walled off inside one database.

## The model

```
AETRAA Admin (provider)  →  Company (client)  →  Principal  →  PM · engineers · QA/QC · HSE · Consultant
```

- **AETRAA Admin (you)** — onboards every client and sets each project up. Nobody
  inside a client company can add a project.
- **Company** — a tenant: its own projects, people and data.
- **Principal** — the client's top person; sees only their own company's projects.
- **The team** — each function opens only the dashboards its access allows.

## Modules

Every project runs the **base platform** — Principal and PM dashboards, the
programme and progress, team & access, issues and reports — plus the modules
the AETRAA Admin ticks for it:

Planning & look-ahead · Site progress & daily diary · Design & submittals ·
Drawings & document control · QA/QC · HSE · Contracts & commercial (BOQ, IPC) ·
Procurement (BOM, GRN) · Finance · Subcontractors · Consultant portal

- Ticked when the project is created, and changed at any time in **Modules —
  add or remove for a project** on the setup console.
- A module that is off is hidden from every screen **and refused by the server**
  (its API, its registers, its records). Nothing is deleted: switch it back on and
  every record is where it was.
- The setup console only asks for the documents the ticked modules need — no BOQ
  without Commercial, no BOM without Procurement, and so on.
- Projects created before modules existed keep every module.

The catalogue lives in `src/modules.js`; `node tools/test-modules.mjs` proves it.

## Primavera P6

- **Set-up:** the AETRAA Admin imports the baseline `.xer` — activities, logic,
  calendars, durations and float.
- **Every month (Planning, PM or Principal → *P6 update & export* in the sidebar):**
  1. *Download progress for P6* — site progress in P6's spreadsheet-import layout
     (Activity ID, status, actual start/finish, physical %). Completions go as
     Completed only once the PM has verified them. In P6: File → Import → Spreadsheet.
  2. Reschedule in P6, export the `.xer`, upload it: AETRAA shows what changed
     (data date, forecast finish, slips, new/removed activities), then applies it.
     Activities match on Activity ID, so site records stay with them.

## Company email domains

Each company can be locked to its own email domain(s) (e.g. `naf.ae`) with named
partner domains or addresses allowed. Only those addresses can be added — by the
AETRAA Admin, the Principal or the PM. Set when the company is created, or in
*Company email domains* on the setup console.

## Progress reports (weekly, monthly, look-ahead, programme status)

Built on the server from what is already recorded — nothing typed by hand. The
weekly runs Monday to Sunday; a week or month still running is reported to today.

- **Planned against actual** — S-curve from programme dates and site progress
  (weekly points, monthly on jobs over ~18 months), with the figures as a table
  for mail clients that do not draw pictures.
- **Three-week look-ahead** — due to start, due to finish, late to start, and the
  drawings / submittals / orders the programme needs first.
- **Registers** — raised, issued, replied, closed in the period; open, with the
  consultant and overdue on the last day; the overdue list worst first.
- **Documents issued and replies received**, drawings issued.
- **Site diary** — working days with a submitted diary, drafts, missing days.
- Plus: completed, delays and reasons, manpower, site issues log.

Open from the dashboard (Planning, PM, Principal, Document Control, Commercial),
print / save as PDF, or **Download Word** (`/api/report?kind=monthly&key=2026-09&format=doc`).
PM, Principal and Planning can email it to the project's report list. Automatic
sends: daily 18:00, weekly Monday 07:00, last month on the 1st at 08:00 (UAE time;
`DAILY_HOUR`, `WEEKLY_HOUR`, `MONTHLY_HOUR`), switched on per project in the admin page.

## Interim payment (IPA / IPC)

The QS values **every BOQ line** (proposed from programme progress at the period end,
never below what is already certified), adds approved variations and materials on
site, and presses **Check**. The platform applies the project's **Payment terms**
(set by the AETRAA Admin in `/setup`): retention and its cap, advance recovery
(proportional, with a start point and a full-recovery point, only once the advance
is marked received), materials-on-site %, VAT and the certify / pay periods.

Blockers stop an application: a % outside 0–100, a line below the certified % with no
note, an unapproved or unknown variation, materials without qty and rate, no period,
a period that overlaps the last one or ends in the future, a changed "previous"
figure with no reason, a second application while one is still being approved.
Warnings are for the QS and PM: claims more than 10 points ahead of the programme,
lines with no programme link, retention cap reached, advance fully recovered, net ≤ 0.

Road: QS prepares → PM approves → Document Control issues to the Engineer (certify-by
date set) → the team records the Engineer's certificate (net amount, ref, date;
"previous" on the next application is always this certified figure; the BOQ carries
the certified % forward) → Finance records payment (part paid / paid). A return by
the PM or the Engineer needs a reason, and the re-submission is `IPA-05 Rev 1`.

Downloads per application:
- **BOQ (Excel)** — the complete bill by section: previous %, cumulative % (yellow),
  this period %, with every value a live formula; sheets for Summary, Variations,
  Materials on site, Certificates, Retention & advance.
- **Letter (Word)** — covering letter, summary, statements, inspections, contents.
- **Full pack (.zip)** — the letter, the Excel, the progress report for the period,
  the period's site photographs, approved WIR/MIR with their attachments, each
  claimed variation's back-up, and everything attached to the application
  (take-off sheets, day-works, delivery notes, the Engineer's certificate).

## Incoming correspondence

Document Control logs every letter, instruction or email that arrives (`＋ Log incoming
letter` on the DC dashboard): from, their reference, letter date, date received,
subject, type, **action by** and the scanned letter. It is numbered `IN-001…`.

- **Reply by** = date received + the project's reply period for incoming letters
  (default 7 days, changed per project under Response periods), or a date typed in.
  A letter logged late is overdue at once.
- The **action owner** is notified (bell, and email when mail is set up) and the letter
  sits with them, the PM and DC. "For information only" files it with no reply due.
- **Draft reply** on the letter opens a pre-filled outgoing letter (`In reply to IN-001`).
  When Document Control **issues** that reply, the incoming letter closes itself as
  "Replied — LTR-00x issued <date>". Otherwise the owner closes it with the reason no
  reply is needed. It is never "rejected".
- The letters register shows both directions; the DC and PM dashboards show the open
  letters, overdue first; the weekly / monthly report lists letters received and any
  overdue reply.

## Meeting minutes and the action tracker (`/minutes`)

- **Minutes** are written as a draft: meeting type (each numbered in its own series —
  PRG-001 progress, INT, DES, MEP, HSE, SCM, MTG), date, place, chair, attendance
  (present / apologies), items discussed with the decision, and actions — each with an
  owner (someone on the project, or a named outside party such as the Engineer) and a date.
- Anyone in the office team may write minutes; the **PM, Principal or Document Control
  issues** them. Issuing is checked: a date not in the future, attendance, at least one
  item, and every action with what / who / when. Issued minutes are fixed; corrections
  go in the next meeting.
- On issue every action is numbered (**AI-001…**), its owner on the platform is told
  (bell, and email when mail is set up), and it appears in the **action tracker**.
- The next meeting of the same kind opens with **matters arising**: every action still
  open, to be carried forward, closed or re-dated — closing or re-dating needs a note.
- The owner (or the PM / Principal / DC) closes an action from the tracker, always with a
  note of what was done. Filters: open, mine, overdue, closed, all; the whole log
  downloads as Excel; minutes download as Word.
- Dashboards show "My meeting actions"; the PM, Principal and DC also see how many are
  overdue on the project. The weekly / monthly report has a **Meeting actions** section.

## Monthly HSE report

Reports → **Monthly HSE report** (HSE dashboard button, or the "Monthly HSE" menu item),
month by month, with Word, print / PDF and email like the progress reports. HSE, the PM,
the Principal, Planning, Document Control and Commercial may open it.

- **Man-hours** this month and to date, taken day by day from the best record there is:
  HSE's man-hours from the time sheets (daily HSE log) → the site diary (each trade × its
  own hours, subcontractor gangs × the standard day) → HSE's head count × the standard day
  → site's manpower return × the standard day. The report says which basis carried how
  many days, and lists working days with no record at all. The standard day is set per
  project in the setup console (Payment terms card; default 10 h).
- **Incidents** by classification — fatality, lost-time injury, restricted work, medical
  treatment, first aid, near-miss, property damage, environmental, dangerous occurrence —
  dated when they happened, with days lost.
- **Rates**: LTIFR per 1,000,000 man-hours and TRIR per 200,000, this month and to date;
  severity rate; days and safe man-hours since the last lost-time injury.
- **Leading indicators**: toolbox talks and attendance, inductions, PPE compliance,
  observations raised / closed / open (high risk), average days to close, permits by type.
- **Trend**: the last twelve months.
- The weekly and monthly progress reports carry a short Health & safety section.
A figure with nothing behind it shows as a dash, never as zero.

## Needs my attention

At the top of every dashboard, each person sees everything on the project whose next
move is theirs — overdue first, then by date — and clicks straight to it:

- records whose next step belongs to one of their functions (the PM and Principal see
  the steps that name them, not every step on the project);
- incoming letters sent to their function (the PM also sees any that are overdue);
- meeting actions they own;
- payment applications at their step — approve (PM), issue (DC), record the Engineer's
  certificate or chase it when late (DC / Commercial), record payment or chase it (Finance);
- site diaries not submitted — drafts one by one, missing days as one line (PM, DC);
- drawings waiting for approval and finished work waiting to be verified (PM, Principal);
- progress claims the office queried back, with the note (site engineer).

"Show all" opens the full list. `GET /api/attention` returns it as JSON. Optionally, each
person gets the same list by email at 06:00 UAE (`DIGEST_HOUR`) — switched on per project
in the admin page ("Email each person … their own list"), and only sent when there is
something on it.

## Who signs what

Every step of every workflow has an owner, and only that function (or the PM /
Principal) can sign it — so nobody approves their own work. The consultant is
not on the platform: after the PM approves, **Document Control issues** the
document, and when the consultant replies by letter or email **Document Control
records the reply** (Code A/B/C/D) and attaches it.

| Document | Raised by | Then |
|---|---|---|
| Submittal (SUB) | Design | PM approves → DC issues → DC records consultant code |
| Method statement (MS) | Site / Design / QA/QC / HSE | QA/QC or HSE review → PM approves → DC issues → DC records code |
| Material approval (MAR) | Design | QA/QC checks spec → PM approves → DC issues → DC records approval |
| RFI | Design | PM approves → DC issues → DC records answer |
| Authority NOC | Design | PM approves → DC submits → under review → DC records NOC |
| Letter | Design / Commercial | PM or Director signs → DC issues & logs |
| Variation (VO) | Commercial | PM review → Director → DC issues → instruction recorded |
| WIR / MIR | Site / QA/QC | QA/QC checks → DC issues → QA/QC records result |
| NCR, PTW, HSE, MR, certificates | internal | see `src/records.js` |

Drawings are uploaded by Design and Document Control only; the PM approves them.

**Notify the team.** When Document Control uploads a drawing or a file, or
issues a document, they are offered *Notify the team*: pick people or whole
functions, add a line, send. It lands under each person's bell, and by email
when email is set up. The PM and Principal can notify too, from any record.

## Setting a project up (the AETRAA Admin console, `/setup`)

1. Company, project and contract terms (retention, advance, payment days)
2. Programme — upload the Primavera `.xer`
3. Priced BOQ
4. Bill of Materials
5. Branding — client / consultant / contractor marks
6. Consultant document templates (Word, with `{{placeholders}}`)
7. Authorities — the NOCs this project must clear
8. Team & access
9. Go live

The programme is the spine: it supplies each discipline's activities and the
drawing, material and procurement dates. Dates the programme does not contain
are derived backwards from the work and labelled **derived**.

## Folder

```
server.js, package.json, schema.sql   the app (what runs on the server)
src/                                  the application code
dashboard-design.html                 the approved design — src/html/app.js is generated from it
deploy/                               Oracle set-up and release scripts (see DEPLOY-ORACLE.md)
releases/                             release files built by deploy/make-release.sh
tools/                                tests and build scripts
test-output/                          what the tests write for you to look at
demo/                                 the sales demo and walkthrough
assets/                               sample logos
_archive/                             the old Cloudflare set-up and past outputs — not used
```

## Layout

```
src/            the application — router, API and each screen
  index.js      routes and API
  setup.js      project onboarding            xer.js        Primavera .xer
  commercial.js priced BOQ                    bom.js        BOM, orders, GRN
  ipc.js        interim payment               records.js    every register/workflow
  hse.js        safety log and report         attachments.js files on a record
  template.js   Word template filling         templates-store.js  where templates live
  storage.js    the portable file store       db-postgres.js  PostgreSQL, D1-shaped
  authorities.js UAE authorities by emirate   functions.js  functions & access matrix
  html/         the screens (app.js is generated — see below)
server.js       runs it on an ordinary server with PostgreSQL
tools/          tests and build scripts
schema.sql      the database
```

## Where it runs

The same source runs on Cloudflare or on any server with PostgreSQL. Only
configuration differs — see `DEPLOY-ORACLE.md`.

|            | Cloudflare            | Oracle Cloud (UAE)             |
|------------|-----------------------|--------------------------------|
| Runs as    | Worker                | `node server.js`               |
| Database   | D1 (SQLite)           | PostgreSQL                     |
| Files      | R2 or the database    | Object Storage or the database |
| Reports    | cron triggers         | a timer in `server.js`         |

Every database call goes through one narrow shape — `prepare().bind().all()` —
so `src/db-postgres.js` is the whole of the difference. Files go through
`src/storage.js`, which picks object storage or the database from the
environment.

`src/html/app.js` is **generated** from `dashboard-design.html` (the approved
design) by `tools/gen-app.mjs`. Edit the design or the generator, never app.js.

## Running the tests

```
npm test                 # everything, including real browsers
npm test -- --fast       # everything except the browser runs
```

What each kind proves:

```
tools/test-*.mjs          the modules, in isolation
tools/test-live.mjs       the real worker, over its real HTTP API
tools/test-postgres.mjs   the whole API on real PostgreSQL
tools/test-server.mjs     server.js, real pg driver, real socket, restart safety
tools/test-browser*.mjs   a real Chromium — what is actually on the screen
```

The browser runs are the only check on what a person actually sees, so they
are part of `npm test` rather than an optional extra.

## The walkthrough

`AETRAA-Platform-Walkthrough.html` — the approved design walked end to end, as a
single file that opens offline. Rebuild it with `node tools/build-prototype.mjs`.

## Deploying

See `SETUP-PLATFORM.md`.

## Folder layout (everything for the platform lives in this one folder)

- `server.js`, `schema.sql`, `package*.json`, `src/`, `tools/` — the platform itself
- `deploy/` — `make-release.sh`, `update.sh`; `deploy/azure/` — the Azure set-up scripts; `install.sh` — Oracle
- `releases/` — the release bundles to upload to the server (newest = latest)
- `DEPLOY-AZURE.md` — the go-live guide (Microsoft Azure, UAE North) — the chosen host
- `DEPLOY-ORACLE.md` — the earlier Oracle Cloud guide, kept for reference
- `demo/`, `assets/`, `test-output/` — demo data, logos, sample outputs
- `_archive/` — nothing here is needed to run the platform:
  - `backup-2026-09-21/` — the copy taken before the clean-up, plus the step transfer bundles
  - `early-designs-and-screens/` — the first dashboard design, architecture deck, phase zips and screenshots
  - `cloudflare-setup/`, `old-releases/`, `sample-data/`, `test-outputs/`
