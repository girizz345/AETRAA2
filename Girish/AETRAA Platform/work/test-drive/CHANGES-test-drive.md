# Test drive — change list

Base: `releases/aetraa-release-20261002-0954.tgz`, as shipped (commit `63d60ac` in this folder).
Change: commit `172e774`. Candidate build: `work/aetraa-release-20261002-testdrive-CANDIDATE.tgz`.
Nothing here has been deployed, and nothing was added to `releases/`.

## What it does

A new **Test** tab in the project's setup tabs sits after Setup and before Handover. Press
**Start testing** and every position on the project is listed down the left. Pick one and the
main window shows that position's real dashboard, on the project's uploaded programme,
documents and registers. Everything done there is real: records are numbered, routed, signed and
issued. For example, the PM prepares a letter, then you pick Document Control and issue it.
**Complete test** deletes every test record and test person, and **Go live** then appears on the
same screen. Handover checks also has a card linking to the Test tab.

All of it happens on a **copy** of the project (`<project id>--test`). The real project is
never written to. **Complete test**, or pressing **Go live**, deletes the copy, everything done on it, and its
test people.

## Files

| File | What changed | Why | What output it affects |
|---|---|---|---|
| `src/testdrive.js` (new) | Copies every row of a project into `<id>--test`, gives it new ids where a table's key is a single id, and adds one test person per role (`<role>@<project>.test-drive.invalid`). Deletes the copy and its people on end. Records shared storage keys in `testdrive_keys`. Adds two tables, `testdrive` and `testdrive_keys`, created on first use. | The engine of the feature. Works on SQLite and PostgreSQL. It asks each database for its own tables, so tables added later are copied too. | Nothing until a test drive is started. |
| `src/html/testdrive.js` (new) | The Test tab: positions down the left, the chosen position's dashboard in the main window, and **Start testing**, **Complete test** and **Go live**. | The screen the user asked for. | New page, `/testdrive?p=<project>`. |
| `src/html/admin-nav.js` | Adds **Test** to the setup tabs, between Setup and Handover, and to the new-project steps before Go live. | So testing is a setup step of its own, just before go-live. | The tab bar on every setup screen. |
| `src/index.js` | (1) `/testdrive` page and the `/api/testdrive`, `/start`, `/as`, `/back` and `/end` routes, AETRAA Admin only. (2) While the Admin acts as a test person, their own session is kept in a second cookie (`smown`), and opening any AETRAA-only screen (every setup tab, `/home` and the Test tab itself) gives it back automatically. (3) Go-live deletes a running test copy. (4) The test copy is left out of the admin project lists (`/api/admin-home`, `/api/setup/companies`, `listProjects`). (5) `/api/people` hides test people from real users and shows only test people inside the test. (6) `sendEmail` drops `.invalid` addresses, which can never receive mail. | (1) and (2) are the feature. (3) The user asked for test actions to be gone before go-live. (4) and (5) keep the copy out of the client's sight. (6) Stops a test person being emailed on the live server. | Go-live; admin project lists; Team & Access lists; outgoing email to `.invalid` addresses (none before this change). |
| `src/storage.js` | `deleteFile` skips a key listed in `testdrive_keys`. | The copy shares files with the real project, so deleting a document on the copy must not delete the real project's file. A test proves the real file is lost without this. | Deleting a file while a test copy shares it. Otherwise unchanged. |
| `src/html/handover.js` | Adds a **Test** card linking to the Test tab, with its status ("Testing is under way — N actions so far"). | So the Test step is in view where go-live happens. | The Handover checks screen. |

## How it was tested

`prelaunch/testdrive-check.mjs` runs on SQLite (`local.mjs`) and on PostgreSQL (`server.js` +
PGlite), in headless Chrome, with 78 checks across the two databases:
- the Test tab sits in the setup tabs, lists every position, shows the chosen position's dashboard, and Complete test leaves nothing running
- the copy matches the real project
- every role's dashboard opens on the copy
- the PM prepares a letter and Document Control moves it on
- setup screens give the Admin back their session
- the real project's registers, programme, IPC and audit are unchanged while the test runs and after it ends
- deleting a template on the copy keeps the real one
- End removes every row and the test people's sign-in stops working
- Go-live deletes a running copy

`prelaunch/run.mjs --release ../work/test-drive` re-runs the whole pre-launch suite on the
changed code.

## Known limits

- While the Admin acts as a test person, the other browser tabs act as that person too, because
  sign-in is one cookie per browser. Opening any setup screen gives the Admin's session back
  automatically.
- A test copy is a full copy of the database rows. Drawings stored in the database, rather than
  in object storage, are copied too, so a very large project takes longer to start.
- Uploads made during the test, such as a photo or an attachment, are stored files belonging to
  the copy. Ending the test deletes their rows. On object storage the files themselves are left
  behind and are not cleaned up.

---

# The template is the form — change list

Change: the commit after `963885f`, in this folder. The candidate build is the same file as
above, rebuilt. Nothing has been deployed.

## What it does

This works on every project, for every document type that has a consultant's form assigned
(RFI, submittal, material, WIR/RFIA, MIR, CVI, transmittals and so on):

1. **When a form is assigned** (uploaded on Setup or dropped on Documents → templates), the
   platform reads its fields (`{{placeholders}}`) and every "NAME & SIGN" box straight away.
   It also sets a first guess: the contractor's first signature box goes to the PM's approval
   step.
2. **Raising a document** shows the consultant's form beside the fields, filled in as it is
   typed. Any field the form asks for that the standard form lacks is added and marked "on the
   form".
3. **Before every signature** the record shows the filled form as it will be issued, with the
   approver's own box marked "Your signature goes here".
4. **The issued file** (Generate document) carries each signature (name, "e-signed", date) in the
   cell chosen for its step.
5. **Documents → templates → Signature boxes** draws the form. For each workflow step you click
   the cell where that step is signed.

Document types with no template keep the plain form, unchanged.

## Files

| File | What changed | Why | What output it affects |
|---|---|---|---|
| `src/template-preview.js` (new) | Draws an .xlsx form as HTML: column widths, row heights, merges, borders, fonts, fills, in-cell and floating pictures, print area. Draws a .docx simply. Writes text into chosen cells. Finds NAME & SIGN boxes. | So the form can be seen before it is issued, and signed in place. | New. |
| `src/template-forms.js` (new) | Lists the extra fields a form needs, places signatures for each workflow step, draws and issues. Adds a `sign_map` column to `templates`. | The rule above, one place for it. | New. |
| `src/templates-store.js` | On upload, records the signature boxes (`sign_map`). `listTemplates` returns them. | Step 1. | The upload reply now includes `sign_boxes`. |
| `src/template.js` | `{{description}}` also reads Question, Body, What happened and similar fields. New `{{reference}}` reads Drawing ref and similar fields. | So the standard form's fields fill the consultant's form without the same thing being asked twice. | Generated documents: these placeholders are now filled where they used to be blank or showed the subject. |
| `src/index.js` | New routes: `GET /api/template/form`, `POST /api/template/preview`, `GET /api/record/preview` and `POST /api/setup/template-signs`. `/api/record/doc` now writes the signatures into their cells. | Steps 2–5. | Generate document (.xlsx) now carries the signatures. |
| `src/html/app.js` | `installTemplateForms()`: the New form with the form drawn beside it, and the preview at the top of a record. **This file is generated from `dashboard-design.html` by `tools/gen-app.mjs`, which are not in the release. The same block must go into whatever produces app.js, or the next build will drop it.** | Steps 2–3. | Every New-document form and record drawer on a project with templates. |
| `src/html/signboxes.js` (new), `src/html/files.js`, `src/html/setup.js` | The signature-box picker, on Documents → templates and on the Setup template list. | Step 5. | Those two screens. |

## How it was tested

`prelaunch/templates-check.mjs` assigns the seven AETRAA/Iconic forms to a project and checks
the whole sequence on SQLite and PostgreSQL in headless Chrome. It covers fields and boxes read
on upload, the RFI form filled as it is typed, the PM seeing their box before signing, the
signature landing in cell D23 of the issued .xlsx, the Admin moving Document Control's box to
D24, both signatures appearing in the file, and a type with no template staying unchanged.
56 checks, all pass. The full pre-launch suite shows only the two failures already in the
Oct 2 release (stale demo seed; local.mjs restart).

## Check before it is raised

| File | What changed | Why | What output it affects |
|---|---|---|---|
| `src/html/app.js` | **Generate** on any New form opens a check first. It shows the document as it will be issued, using the consultant's form if the project has one, or the fields as typed if not. **Submit & route for approval** and **Edit** stay at the top. Nothing is numbered, routed or sent until Submit. Edit goes back to the form with everything kept. | The user asked to check the generated document, correct it and only then submit. | Every New-document form. Raising now takes one more click (Submit). |

Tested in `prelaunch/templates-check.mjs`, on SQLite and PostgreSQL:
- Generate shows the filled form and nothing is raised yet.
- Edit returns with the values kept.
- The check shows the edit.
- Submit raises exactly one record.
| `src/html/app.js` | The New form's button now reads **Generate**, not "Generate & route for approval". The check's button now reads **Confirm & submit for approval**. | The old label described a one-click submit, which is no longer what happens. | The labels on every New-document form. |
| `src/index.js` (`templateFor`) | Picks the form to issue a document on. It uses the type's own form if the project has one. Otherwise a **submittal** uses Transmittal of drawings (then documents), a **method statement** uses Transmittal of documents, and a **material submittal** uses Transmittal of documents. A test-drive copy uses the real project's forms. | Iconic has no general submittal form, and a test copy started before the forms were loaded had none. | Which form submittals and MS are drawn and issued on. |
| `src/html/app.js` (`tplSteps`) | Three steps across the top of every New form and its check: 1 Fill in → 2 Check the document → 3 Confirm & submit for approval. | So the flow can be seen, not just clicked through. | Every New-document form. |

---

# Templates kept by Document Control, read from the consultant's own form

## What it does

1. **A Templates page** (`/templates`). It is in the menu of Document Control (under Control), the PM (under Setup) and the Principal (under People). It lists one row per document type for the project the person is on: **Upload form / Replace**, **Fields**, **Signature boxes**, **Remove**.
2. **Extraction.** An Excel form is read as the consultant sent it, even one still filled in from the last job:
   - Labels and the box each one owns (to the right, or under a label that runs across the form).
   - Reference no., date, project, location, client, consultant and contractor are filled by the platform.
   - Everything else becomes a field to fill, in the form's order, under the form's own name.
   - Signature rows are cleared of old names.
   - Tick-box options, notes, tables and the consultant's response section are left alone.
   - Logos are kept.
   - Text the last job left inside the file is emptied, even where no cell shows it.
   - The original is stored, so the fields can be changed later without uploading it again.
3. **Fields.** Shows the original form with every box marked "asked for" or "filled by the platform". Document Control can rename a field, mark it long, remove it, or add one by clicking a box. On Save the form is rebuilt from the original, and its signature boxes are kept.
4. **The New form.** For that document type, the New form shows exactly those fields (plus attachments). The record's title is the form's subject or description field. The rest is unchanged: the form drawn beside it, Generate, Check, Confirm & submit, and signatures in their boxes.
5. **Admin uploads.** An upload on Setup (`/api/setup/template`) is read the same way.

## Files

| File | What changed | Why | What output it affects |
|---|---|---|---|
| `src/template-extract.js` (new) | Field extraction and the rebuild of a fillable form. | Each project's forms differ; Document Control should not have to edit them. | Every Excel form uploaded from now on. |
| `src/template-forms.js` | `saveFormTemplate` and `updateFields`. Adds `fields` and `orig_key` columns to `templates`; column checks run once per process. | Stores the fields with the form and keeps the original. | The `templates` table. |
| `src/template-preview.js` | `writeCells` empties text no cell uses any more. | So the last job's data does not travel inside the file. | Every filled form and the issued file. |
| `src/html/templates.js` (new) | The Templates page. | Document Control's screen. | New page. |
| `src/html/signboxes.js` | The signature-box picker can save through the Templates API. | So Document Control can set them without admin access. | — |
| `src/index.js` | `/templates` page. `/api/templates`, `/upload`, `/review`, `/fields`, `/signs` and `/remove`, open to DC, PM, Principal and Admin on their own project. The form endpoint returns the template's own fields. Filling uses the answers by field. The Setup upload is also read for fields. | As above. | Templates screens, the New form and generated documents. |
| `src/html/app.js` | "Templates" added to the DC, PM and Principal menus. The New form uses the template's own fields when it has them. The record title is taken from the subject or description field. **(app.js is generated: carry this into dashboard-design.html / gen-app.mjs.)** | As above. | Menus, and every New form on a project with these forms. |

## Tested

- `prelaunch/dc-templates-check.mjs`, on SQLite and PostgreSQL in Chrome, 42 checks, all pass:
  - Document Control uploads the seven Iconic originals as sent, and 2–10 fields are read from each.
  - A site engineer is refused.
  - DC renames a field and adds one on the form.
  - The New RFI asks for exactly those fields.
  - The issued file carries every answer in its box, and none of the last job's data.
- `templates-check.mjs` and `testdrive-check.mjs`: pass.
- The full pre-launch suite shows only the two failures already in the 2 Oct release.

---

# Testing the AI on the owner's Claude subscription (5 Oct 2026)

Before: the platform's AI ran only on an API key, so every test cost money. The default model was `claude-sonnet-4-5`, and every call sent a temperature setting, which Claude Opus 4.7 and later and Sonnet 5 and later refuse.

After: with `AI_PROVIDER=subscription`, the AI runs through the Claude Code signed in on the owner's Mac, at no extra cost, and each call still records what the same work would have cost on the API. Going live is unchanged: set `ANTHROPIC_API_KEY` on the server and leave `AI_PROVIDER` unset.

This switch is for the owner's own testing in the local sandbox only. It needs the `claude` command installed and signed in, and must never serve tenants.

## Files

| File | What changed | Why | What output it affects |
|---|---|---|---|
| `src/ai.js` | New provider `subscription`: one call through `claude -p --output-format json`, with no tools, settings, MCP servers or saved session, and the API key removed from its environment. A `cost_usd` column on `ai_usage`, filled from the CLI's cost figure, and summed in `aiUsageSummary`. Temperature is sent only to models that accept it. Default API model is now `claude-sonnet-5-5`. | Free testing with real cost figures; current models refuse temperature. | Every AI call and the AI usage log. |
| `local.mjs` | Passes `AI_PROVIDER` and `CLAUDE_BIN` through to the platform. | So the local sandbox can use the switch. | Local runs only. |

## Tested

- One call through the subscription on `claude-sonnet-5-5`: answer returned, tokens and cost (USD 0.0029) logged.
- A missing `claude` command returns a plain error message, not a crash.
- `claude-opus-5-5` needs Claude Code 2.1.280 or later. This Mac's `claude` command is 2.1.150, so Opus tests need `claude update` first.

---

# P1a: the project check on every drawing, programme and contract (5 Oct 2026)

Before: the gate checked a drawing's number against the project's numbering rules, and looked for another project's reference in the document's text. On real drawings that text check saw nothing: the intake probe reads a PDF's raw bytes, and a drawing's words are in compressed streams and AutoCAD "SHX text" annotations. A programme (.xer) or a contract from another project was never checked. Any kind of document naming another reference was held.

After (agreed as P1 step 2a): the Admin sets the project's identity once (plot numbers, contract numbers, programme project IDs, other names) on the Admin page.
- **Drawings** are read with pdf.js, annotations included. A readable drawing that shows the project's plot number is filed. One that doesn't is parked with "This document is not part of this project and cannot be attached." A scan with no readable text is not parked; it is left for the AI reader (A1).
- **Programmes:** an .xer whose project ID or stated plot is another project's is parked.
- **Contracts:** one that states another plot or contract number is parked.
- **Everything else** is filed, with the finding noted, and never parked.
- **The Admin** is emailed when documents are parked, with a warning when one tenant has had 3 or more parked in 90 days. The held queue lists those tenants. Only AETRAA can release a parked document, as before.

## Files

| File | What changed | Why | What output it affects |
|---|---|---|---|
| `src/gate.js` | Identity fields (`plot_numbers`, `contract_no`, `programme_ids`, `identity_strict`) and the checks: the plot number shown on a drawing; labelled plot and contract numbers; the .xer PROJECT `proj_short_name`. Holds only drawings, programmes and contracts (`HOLD_KINDS`). The old foreign-reference pattern is now note-only, because on real text it also matches drawing numbers and the consultant's job number. | P1 step 2a | Every intake and drawing upload verdict |
| `src/pdf-text.js` (new) | Reads a PDF page's text and annotation contents with pdf.js. Returns '' on any failure or on a scan. | The probe could not see drawing text | Project check |
| `src/intake.js` | Gives the gate the pdf.js text for drawing and contract PDFs, and the file text for an .xer. Records the tenant on each hold. | As above | Intake verdicts and the held queue |
| `src/drawings.js` | A single drawing upload is checked with its pdf.js text too. | Same rule on every route in | Drawing uploads |
| `src/quarantine.js` | `heldByTenant()`: holds per tenant in 90 days, with a warning at 3. | Agreed warning | Held queue |
| `src/index.js` | `identity` action on `/api/project`; identity fields in the project data; Admin email on parked documents (`tellAdminHeld`); `tenant_warnings` in `/api/quarantine` for AETRAA. | As above | Admin page, held queue, Admin email |
| `src/html/admin.js` | New "Project identity" card on the Admin page. | Where the Admin sets it | Admin page |
| `package.json`, `deploy/make-release.sh` | New dependency `pdfjs-dist` (Mozilla pdf.js, pure JavaScript), installed by the server like `pg` and `fflate`. | PDF text and annotations | Release install |

## Tested

- Measured on real files: 246 of Al Warqa'a's 247 readable drawings show plot 4210529 and are filed. The 5 others are not drawings (a contract, lift calculations, a photo layout, a trade licence). Of 125 sheets from five other projects, 124 are parked and 1 scan is left alone. Programmes: J179 is filed, and three other projects' .xer files are parked.
- `prelaunch/p1a-check.mjs`, through the real intake API, on SQLite and PostgreSQL: 36 checks pass.
  - Al Warqa'a drawings and its programme match.
  - Six drawings from three other projects and one other .xer are parked, with the message, in the Admin's queue.
  - The tenant warning appears.
  - The tenant's PM cannot release a parked document.
- `templates-check`, `dc-templates-check` and `testdrive-check` still pass.

## Found, not changed

- Some Al Warqa'a sheets, such as `G0-04A.pdf`, are matched but cannot be filed: "a drawing needs its number". Neither the file name nor the title block gives a number the reader recognises. This is the existing E3/E4 behaviour; P1b's AI reader (A1) is the fix.

---

# P1b, part 1: every sheet read, combined sets split, duplicates archived (5 Oct 2026)

Before: of Al Warqa'a's 233 files dropped in one folder, 160 drawings were filed and 61 failed. Combined sets ("floor_plans.pdf", 8 sheets) failed as "a drawing needs its number". Sheets numbered only on their face failed the same way. A4 soil and gate-level reports were treated as drawings. The same drawing arriving in several files was filed every time (A0-01 seven times). Title-block reads put junk in the register: "1:75" (a scale), "A1" (a paper size) and "ALUMINUM WINDOWS TYPICAL DETAILS" (a title).

After (same 233 files, both databases, same counts):
- **Combined sets** are split into one entry per sheet: 28 sets.
- **Each sheet's number** is read from its title-block corner.
- **Duplicates are archived, not filed.** A duplicate is the same file, or the same sheet in another file with identical words. 228 were archived, each pointing to the original.
- **Filed:** 346 items, including 326 drawing sheets.
- **13 sheets** carry no readable number. They wait on the review screen, where the number can be typed in.
- **A4 reports** are filed as documents: the soil report as a survey, calculations as reports.
- **Non-drawing files in a drawings folder** (.xlsx, .dgn) are not filed as drawings.
- **No junk numbers** reach the register.

## Files

| File | What changed | Why | What output it affects |
|---|---|---|---|
| `src/sheet-reader.js` (new) | `readPdfSheets` (pdf.js: each page's size, text with annotations, and the number in the title-block corner); `pdfPage` (pdf-lib: one page as a single-sheet PDF, no dates written, so the same page always gives the same bytes); `validNumber`, `paperOf`, `textKey`. | Combined sets, face numbers, reports | Intake |
| `src/intake.js` | For a drawing PDF, or a PDF the classifier could not place: an A4 file goes to the library (survey or report); a multi-sheet set is split and each sheet scanned on its own; the corner number wins over the title-block and file-name numbers; implausible numbers are dropped (`plausibleNumber`). Duplicates are found by file fingerprint or by the fingerprint of the sheet's words (new `text_sha` column) and kept with state `archived`; commit never files them. A drawing with no number goes to "Needs a decision"; a number typed there is checked before it is kept. | P1b, and Ajay: "any duplicate to be parked as archive" | Intake review and filing |
| `src/intake-classify.js` | New review group `archived`, counted in the summary. | As above | Intake review |
| `src/html/intake.js` | "Archived duplicates" group. A number box on drawings that need one. Shows "sheet N of M in <set>" on split sheets. | As above | Intake page |
| `src/drawings.js` | `fromFileName` accepts a one-letter suffix (G0-03A, S1-01B). | Those sheets failed before | Every drawing named that way |
| `package.json`, `deploy/make-release.sh` | New dependency `pdf-lib` (pure JavaScript). | Splitting sets | Release install |

## Tested

- `prelaunch/p1b-check.mjs` drops the whole JBBC-Iconic folder (233 files) through the real intake API on SQLite and PostgreSQL. 13 checks pass, with identical counts on both databases.
- `p1a-check`, `templates-check`, `dc-templates-check` and `testdrive-check` still pass.

## Found, not changed (next)

- **Revisions:** no revision is read on these sheets. All are blank, so 39 number-and-stage pairs appear more than once with different content. They are probably revisions, and need the revision box read.
- **Stage:** 178 sheets have stage "other". The consultant's DM portal sets carry no TENDER or IFC stamp the reader recognises.

---

# P1b, part 2: authority approved drawings; library download fixed (5 Oct 2026)

Requested by Ajay on 5 Oct 2026: "Authority Approved drawing need a section... the intake shall read the title block and AI shall populate the required authority section and each drawing shall go into its specific section."

Before: sheets an authority had approved (Al Warqa'a's DM-portal sets) landed in "Unsorted — stage not stated": 178 of them. Filing any sheet retired the current sheet of the same number, whatever its stage. Every download from the Library returned a 15-byte file reading "[object Object]". That last one was found on the live site on 4 Oct.

After:
- **A new stage, "Authority approved drawings",** sorted by authority. Each sheet carries the authority, the approval number and the approval date.
- **At intake, code reads the folder.** A sheet with no other stage, arriving in an authority's folder (DM, DCD, Telephone and so on), is proposed as that authority's.
- **Then "Read approval stamps (AI)" reads each stamp:** the authority, approval number, date and how sure it is. A low-confidence read waits for Document Control. The folder's guess is kept beside the AI's answer. Dates are read day-first, as UAE authorities print them.
- **An authority sheet never retires an IFC or tender sheet,** and is retired only by a later approval of the same sheet by the same authority.
- **Library downloads return the file.**

## Files

| File | What changed | Why | What output it affects |
|---|---|---|---|
| `src/authority-sheet.js` (new) | `authorityFromPath` (folder → authority code, deepest folder first); `authorityCode` and `authorityName` (from `authorities.js`); the stamp prompt; `parseStamp`; `dayFirst`. | Authority section | Intake |
| `src/drawings.js` | New stage `authority`. Columns `authority`, `approval_no` and `approval_date` (`ensureAuthorityColumns`). The supersede rule is now stage-aware for authority sheets. | As above | Drawing register |
| `src/sections.js` | New section "Authority approved drawings", listed by authority with the approval number and date. | As above | Sections screen |
| `src/intake.js` | Authority proposed from the folder. `needs_stamp` on authority and unstaged sheets. `readStamps()`: the AI reads stamps a few at a time and the answer is kept on the item. Item shape carries kind, authority, approval and stamp. | As above | Intake |
| `src/ai.js` | `callModel` accepts `documents` (PDF bytes). On the API they are sent as document blocks. On the subscription they are written to a private temporary folder that the CLI may only Read, and deleted afterwards. | The AI must see the stamp image | AI calls with documents |
| `src/index.js` | `POST /api/intake/stamps`. | As above | Intake page |
| `src/html/intake.js` | "Read approval stamps (AI)" button with progress, shown when sheets are waiting. The authority, approval number, date and confidence are shown on each authority sheet. | As above | Intake page |
| `src/library.js` | `documentFile` returns the file's bytes, not the storage object. | Every library download was "[object Object]" | Library downloads |

## Tested

- **`prelaunch/authority-check.mjs`, with AI on the owner's subscription (Sonnet 5.5):**
  - 20 DM-portal sheets were proposed as authority approved: DCD 8, telephone 10, DM 2 by folder.
  - The AI read every stamp: DM 15, DCD 5. It read approval 455359-3-3, dated 2026-05-12.
  - They were filed under Authority approved, and the IFC A0-01 stayed current.
  - Measured cost: USD 1.04 for 20 sheets, about USD 0.05 a sheet; 12 seconds a sheet on the subscription.
- **`p1b-check`:** the whole folder now has 178 sheets in Authority approved and none unsorted. All earlier checks pass.

## Note for review

- **The AI is not deterministic.** Sheets of the same smoke-layout set came back as DM on some pages and DCD on others. That is why it is an AI step (A1) with a confidence level, and Document Control confirms before filing.
- **DCD stamps** gave no approval number.

---

# P1b, part 3: the title block read box by box; duplicates by number, revision and stage (5 Oct 2026)

Ajay, 5 Oct: "many drawings not taken properly... the extraction to open and read all documents and then add to the section."

Before: drawing titles came from file names, for example "ac floor plans1770821668412 sheet 9" or "str copy sheet 7". No revision was read, so every sheet was "–". The same drawing at the same revision and stage was filed several times when its files differed.

After (the whole JBBC-Iconic folder, both databases, same counts):
- **Titles** come from the title block's own "Drawing Title" box on 92% of sheets, for example "THERMAL SUMMARY SHEET AC LAYOUT" and "COLUMN LAYOUT AT ROOF LEVEL". The rest are cover sheets and perspectives with no title box; for those, the portal timestamps and "sheet N" are stripped from the file-name title.
- **Revisions** come from the "REV:" box, not the revision table's heading.
- **Same number, revision and stage** is archived as a duplicate, with the reason given. This does not apply to authority sheets, where a second approval on another date is a new approval.
- Result: 319 filed, 255 archived, 13 waiting for a number, and no unsorted sheets.

## Files

| File | What changed | Why | What output it affects |
|---|---|---|---|
| `src/sheet-reader.js` | `titleBlockFields()`: label-and-box reading of Drawing Title, REV, Scale, Date and Drawing No inside the title-block strip. A box label written with a colon wins over a table heading. A revision printed twice ("0. R0") is reduced to one. | Titles and revisions from the sheet | Intake |
| `src/intake.js` | Title and revision from the title block override the file-name ones. File-name titles are cleaned. New `dkey` (number, revision and stage) duplicate rule. | As above | Intake, register |
| `src/db-cols.js` (new) | `columnsOf` and `addColumns`: a column is added only if missing, so no failing ALTER runs. On PostgreSQL a failed statement can cost the connection; the PostgreSQL test rig lost every scan this way. | Reliability on PostgreSQL | Intake, drawings, ai_usage |
| `src/drawings.js`, `src/ai.js` | Use `addColumns` for the new columns. | As above | — |

## Tested

- **`p1b-check`:** 15 checks pass, with identical counts on SQLite and PostgreSQL. Titles come from the title block on 92% of sheets (305 of 326).
- **`p1a-check`, `templates-check`, `dc-templates-check`, `testdrive-check`:** all pass.

---

# P1b, part 4: approval stamps read after filing, three at a time, with missing numbers (5 Oct 2026)

In Ajay's test the stamp reader read 3 sheets. "File everything confirmed" was then pressed, and the other 178 authority sheets were filed with the authority from their folder but no approval number or date. Six elevation sheets failed because no number could be read.

- **Order no longer matters.** Stamps are read for filed sheets too, and the drawing register is updated with the authority, approval number and date. "File" is disabled while the stamp reader runs.
- **Three sheets are read side by side.** 20 sheets took 98 s instead of 239 s.
- **The same AI read also returns the drawing number and title from the title block.** A sheet that failed for want of a number gets the AI's reading (marked "title block (AI)") and returns to the review to be filed.

| File | What changed | Output |
|---|---|---|
| `src/intake.js` | `readStamps` takes proposed, confirmed, filed, and failed-for-number sheets, and reads three in parallel (`readOneStamp`). For a filed sheet it updates `drawings` (kind, authority, approval_no, approval_date). A failed sheet that receives a number goes back to `confirmed`. | Intake, register |
| `src/authority-sheet.js` | The prompt also asks for the drawing number and title; `parseStamp` keeps them. | AI read |
| `src/html/intake.js` | Button: "Read approval stamps and missing numbers (AI)". File is disabled while it runs. Archived items are never sent to commit. | Intake page |

**Tested:** `authority-check` with AI on the subscription: 6 checks pass. 20 stamps were read in 98 s, costing USD 1.09.

---

# Three fixes found in the 6 Oct audit (6 Oct 2026)

An audit of this code against the v5 workflows and the Extraction & Filing Engine spec found three bugs. The rest of the audit is in `Girish/AETRAA-Platform-Work-Split.pdf` at the top of the repository.

1. **Another company could load files into your project.** `/api/intake/batch` (POST), `/api/intake/scan`, `/api/intake/confirm` and `/api/intake/stamps` took the `project_id` and `batch_id` from the request body and never checked them against the signed-in person's project. A Document Controller of company B could open a batch on company A's project and write items into A's batch. Spec §19 requires this isolation. Anyone who is not AETRAA may now only use their own project, and a batch is used only with the project it belongs to.
2. **Contract terms were read from almost no contract.** The terms were read from the probe's sample of the raw PDF bytes. Most PDFs compress their text, so a real contract gave nothing. Each whole file was also passed as one "page", so the page shown beside a figure was the file's position. Contracts are now read with pdf.js, page by page, and each figure carries its own page (and its document, when several were read).
3. **Restarting `local.mjs` wiped data (known failure A6).** `local.mjs` ran the whole of `schema.sql` on every start, and `schema.sql` begins by dropping tables. A restart crashed on `issues`, after projects, users and the rest had already been dropped. The full script now runs only on a new database. On an existing one the drops are skipped, only tables and indexes added since are created, and the default settings are inserted only if missing.

| File | What changed | Why | What output it affects |
|---|---|---|---|
| `src/index.js` | `batchIn()` check; non-AETRAA callers limited to their own project on intake batch, scan, confirm and stamps. | Fix 1 | Intake API: refuses another project's id or batch (403/404) |
| `src/pdf-text.js` | New `pdfPages()`: one string per page. | Fix 2 | — |
| `src/index.js` | New `contractPages()` and `onOwnPages()`; used by `/api/terms/read`, `/api/parties` (GET) and `/api/intake/terms`. | Fix 2 | Proposed contract terms and parties, and their page numbers |
| `local.mjs` | `schema.sql` run in full only on a new database. | Fix 3 | Local server restarts keep their data |
| `tools/test-intake-fixes.mjs` (new), `tools/fixtures/contract-test.pdf` (new) | 22 checks: the tenant wall on every intake path, a company's own intake still working, and terms read from a compressed 3-page contract with the right page. | Proof | — |

**Tested:**
- `node tools/test-intake-fixes.mjs`: 22 pass. On the code before this change, 12 of them fail.
- A restart on an existing database keeps its projects and issues.
- The older intake tests from `tools/` (top level) give the same results before and after this change (`test-intake-terms` 38/38, `test-intake-probe` 58/58; the failures in `test-intake`, `test-intake-api` and `test-gate` were there before, because those tests were written for the older copy).
- **Note for this machine:** `pdfjs-dist` was missing from `node_modules` after the download, so pdf.js could not load. Run `npm install` in this folder first.

---

# Girish's half of the work split, G1–G15 (6 Oct 2026)

The tasks are in `Girish/AETRAA-Platform-Work-Split.pdf`. Each section below is one task. Tests use the shared set-up in `tools/_harness.mjs` (in-memory SQLite, the real router, mail captured instead of sent). `node tools/check-page-scripts.mjs` parses the in-browser script of every page, which `node --check` cannot see.

## G13 · X1: the same header on every downloaded schedule, log and tracker

Every workbook now starts with: company logo, project name, project ref / plot, client, consultant, contractor, contract no., document title, as-at date and time (UAE), the programme data date on dated schedules, and who downloaded it. It is on every sheet of the workbook. The sheet's own title lines are replaced by it, so a register does not say its name twice.

| File | What changed | Why | What output it affects |
|---|---|---|---|
| `src/xlsx.js` | `headerRows`, `applyHeader`, `buildXlsx(sheets, { header })`; real embedded images (drawing parts, PNG and JPEG, proportions kept). | X1 | Every .xlsx download |
| `src/index.js` | `xlsHeader()`: builds the header from the project row (`client_name`, `engineer_name`, `contractor_name`, `contract_no` or `contract_ref`, `plot_numbers`, `data_date`) and the company logo (`orgs.logo`, else the project's contractor logo). Passed to the register, schedule, drawing register, BOQ, action log and IPC valuation downloads. | X1 | Those downloads |
| `src/register-xlsx.js`, `src/meetings-doc.js`, `src/ipc-pack.js` | Each workbook passes its `opts.header` to `buildXlsx`. | X1 | — |

The P6 progress file (`/api/programme/p6-progress`) is deliberately left without the header: it is a machine import file for Primavera, and extra rows would break the import.

**Tested:** `tools/test-x1-header.mjs`, 36 checks. The workbook was also opened with openpyxl: it loads, the logo is an image, and the frozen rows end at the column headings.

## G1 · Contract terms: ranges, clauses, digits, evidence, the Principal's approval

| File | What changed | Why | What output it affects |
|---|---|---|---|
| `src/contract-terms.js` | Spec §18 ranges: retention 0–20%, cap 0–10%, advance 0–30%, payment and RFI reply 1–180 days (outside them a figure is not proposed). A cap above the retention rate is flagged, not refused. `clauseBefore()`: the clause each figure sits under (a clause named in the figure's own sentence first, else the last heading before it). `westernDigits()`: Arabic-Indic digits read (§23). `termEvidence()`: every proposal with what was done with it. | E9, §6, §14, §18, §23 | Proposed terms now carry `clause` (and each option its clause) |
| `src/terms-approval.js` (new) | `term_evidence` table (every proposal: accepted, corrected, refused or not found, with clause, page, sentence, who, when). `projects.terms_state` and who applied/approved. `approveTerms`, `termsStatus`. | E9 step 3, §14 | — |
| `src/index.js` | `/api/intake/terms` (POST) records evidence for every proposal sent and marks applied terms pending. New `/api/terms/status` and `/api/terms/approve` (a Principal of the project only — not AETRAA, not the PM). `/api/ipc` (POST) refuses while the terms are pending. New page `/terms`. | E9 step 3 | Raising an application is refused on pending terms |
| `src/html/terms.js` (new) | The Principal's page: the terms in use, where each came from, and Approve. | E9 step 3 | New page |
| `src/attention.js` | "Payment terms read from the contract" in the Principal's Needs my attention while pending. | E9 step 3 | Principal's attention list |
| `src/html/contract.js` | **Proposals were ticked by default**; they no longer are (spec §8: unticked by default). A conflicting term shows a choice instead of "null". The clause is shown. Every proposal is sent, so refused ones are kept. | §8, §14 | Contract step of setup |
| `src/html/intake.js`, `src/html/files.js` | The clause is shown; every proposal is sent, ticked or not. | §14 | Intake and Documents terms panels |

**Tested:** `tools/test-g1-terms.mjs`, 28 checks: each range, the clause on a real compressed contract (Sub-Clause 14.3, page 3), Arabic-Indic digits, evidence for accepted/refused proposals, AETRAA and the PM refused, IPC blocked until the Principal approves, the attention item and the page.

## G2–G8 · The intake engine: limits, security, folder map, drafts, report, determinism, audit

| Task | File | What changed | Why | What output it affects |
|---|---|---|---|---|
| G2 | `src/intake.js` | `LIMITS` and `MSG` (spec §12): 1,000 files and 2 GB per batch, refused up front from the size the browser sends and again as the batch fills; one open batch per project (`openBatchOn`: a batch being scanned, reviewed or committed and touched in the last 24 hours), refused with the spec's words and the open batch's id; `abandonBatch` deletes the files stored for scanning and marks the items abandoned (spec §13). | §12, §13 | Opening a batch, scanning, the intake page |
| G2 | `src/quarantine.js` | `hold()` refuses past 500 held items on a project, flags the project (`intake_flag`) and says so. Applies to every path to the queue, the single drawing upload included. | §12 | Holding |
| G2 | `src/index.js` | `/api/intake/batch` passes the expected file count and size and answers 409 when a batch is open; new `/api/intake/abandon`; AETRAA is emailed when a project reaches 500 held. | §12, §13 | — |
| G3 | `src/intake-classify.js` | `ALLOWED_EXT`, `BLOCKED_EXT`, `supportedExt`: a file whose extension is on neither list, or blocked (executables, `.docm`), is classified `unsupported`. `.zip` is classified `archive`. | §19 | Classification |
| G3 | `src/intake.js` | An unsupported file is listed (group "Left out") and never stored. `expandZip`: entries counted and sized from the zip's directory BEFORE anything is inflated; refused whole over 500 files, 500 MB or 2 levels of nesting; each entry is then scanned on its own, with the zip's name in its path. | §19 | Intake of zips and unsupported files |
| G3 | `src/attachments.js` | `checkUpload` now also requires an allowed extension, closing the hole where an empty or `application/octet-stream` MIME type passed. | §19 | Every attachment upload |
| G4 | `src/intake-classify.js`, `src/intake.js` | `folderMapHit`: a confirmed company mapping decides a file in a folder of that name. `folderMapFor` is now called on every scan. `learnFolders` leaves out folders already remembered; new `listFolderMap`, `removeFolderMap`. | §4 | Classification |
| G4 | `src/index.js`, `src/html/intake.js` | `/api/intake/folders` (proposals after a commit), `/api/intake/folder-map` (GET list, POST remember / remove). The intake page offers the folders after a commit; nothing is remembered unless ticked. | §4 | Intake page |
| G5 | `src/intake-classify.js`, `src/intake.js` | A file whose name says draft, superseded, void, obsolete or cancelled starts left out (state `skipped`, group "Left out") and can be included deliberately. Two programmes in one drop both need a decision, and neither is filed while the other is still in. | §17, §6 | Intake review and commit |
| G6 | `src/intake-report.js` (new) | `buildReport` (every file in exactly one outcome, with `reconciles` computed), `reportWorkbook` (Excel with the X1 header: Summary, Added, Not added, Needs a decision, Could not tell), `reportPdf` (the record). | §30 | — |
| G6 | `src/intake.js`, `src/index.js` | `fileReport`: when a commit settles (also partly) the PDF is filed to the library, class report, one per state of the batch, never overwritten. `/api/intake/report?batch=&format=json|xlsx|pdf`. `filed_to` recorded on every filed item. | §30 | Library; new downloads |
| G7 | `src/intake.js` | `EXTRACTOR_VERSION` stored on every item; the first reading of each file is kept against its SHA-256 and the version (`extraction_cache`), and a later reading that differs is flagged (`result_changed`) instead of quietly replacing it; items listed in a fixed order (full path, character by character); the order-dependent reason text for two programmes removed. | §27 | Item order on the review screen |
| G7 | `src/html/intake.js` | Files are sent in path order. | §27 | — |
| G8 | `src/index.js` | One audit row per file classified (`intake.classified`), filed (`intake.filed`) and held (`intake.held`), plus abandon and folder-map changes. `/api/intake/history`. | §14 | Audit table |
| G8 | `src/html/intake-history.js` (new) | The project's drops with their reports, for the contractor too; the company's remembered folders with Remove. Page `/intake-history`. | §14, §30, §4 | New page |
| — | `src/html/intake.js` | "Left out" group with Include / Leave it out; Abandon; report links; commit in chunks of 25 (spec §20). | — | Intake page |
| fix | `src/intake.js` | **A drawing's stage was never read from its folder.** `kindFrom` treats the last part of the path as the file name and strips it; intake passed the folder alone, so "/IFC Drawings" lost its own name and every sheet in it was filed as "other". The file name is now added to the path. | §6 | Drawings dropped in a stage folder are filed under that stage |

**Tested:** `tools/test-g2-g8-intake.mjs`, 46 checks, including the same 12-file folder (drawings, contract, BOQ, two programmes, an .exe, an unknown type, a photo, a zip) dropped twice in opposite orders on two projects with identical results, and compared byte for byte with `tools/fixtures/golden-intake.json`. If a rule is changed on purpose, bump `EXTRACTOR_VERSION` and run the test with `--write`.

## G9 · E11 Drawing lists

| File | What changed | Why | What output it affects |
|---|---|---|---|
| `src/drawing-lists.js` (new) | Reads a drawing list (Excel / CSV): the number, title, revision, date, discipline and status columns found by their headings; every line read or not read with the reason (no number, not a number, listed twice). `compareList` against the register: missing, at another revision, as listed, not listed, new since the last approved list — sorted by number. `drawing_lists` table; DC confirms (unticking any line), PM approves, missing and changed sheets become `awaited` drawings (no file). | E11 | Drawing register |
| `src/drawings.js` | `saveDrawing` removes the `awaited` placeholder of a number when the real sheet arrives (not an authority's stamped copy). | E11 | Drawing register |
| `src/index.js` | `/api/drawing-lists` (GET list or one, POST read), `/confirm` (DC), `/approve` (PM only). | E11 | — |
| `src/html/drawings.js` | "Drawing list from the designer" card: drop, comparison with untick, Confirm, Approve. Awaited sheets show in the live register with an "awaited" pill. | E11 | Drawings page |
| `src/intake-probe.js`, `src/index.js` | **A priced BOQ or BOM longer than 400 rows was cut off without a word**: the import read the file through the classifier's probe, which stops at 400 rows (CSV at 200 KB). `probe(…, { maxRows })` now reads every row for imports and marks a sheet that still reaches the limit `truncated`. Intake's BOQ/BOM import passes 200,000. | E7, spec §15 ("line count and total match the source file exactly") | BOQ and BOM imports through intake |

**Tested:** `tools/test-g9-drawing-lists.mjs`, 21 checks, including a 650-line bill read whole.

## G10 · E13 Specification index

| File | What changed | Why | What output it affects |
|---|---|---|---|
| `src/spec-index.js` (new) | `buildIndex(pages)`: sections from the table of contents (each located at the page whose heading names it) or, without one, from explicit section headings (MasterFormat "SECTION 03 30 00 – …" or a letter section "SECTION D – …"); otherwise the document is not split, with the reason. Page ranges, discipline from the MasterFormat division, manufacturers named per section ("or equal" noted), and the sentences setting shop drawings, product data, samples, mock-ups, method statements, testing and inspection, each with its page. Pages with no text reported as not read. `spec_index` (proposals) and `spec_section` (live sections); `sectionPdf` copies a section's pages out. | E13, spec §6 | — |
| `src/index.js` | `/api/spec-index` (GET, POST from a library specification or an upload, which is filed to the library first), `/api/spec-index/confirm` (Design only), `/api/spec-sections` (search by number or title), `/api/spec-sections/file` (one section as a PDF), `/api/spec-sections/xlsx` (with the X1 header). Page `/spec`. | E13 | New page and downloads |
| `src/html/spec.js` (new) | Build, review (titles editable), confirm, search, open a section. | E13 | New page |

**Tested:** `tools/test-g10-spec-index.mjs`, 22 checks: split from the contents, page ranges, disciplines, manufacturers, requirements with pages, the unread page, PM refused, DC builds, DC cannot confirm, Design confirms, search, a section's own PDF, Excel, and a rebuild replacing the live index.

## G11 · P1 The project knowledge base

| File | What changed | Why | What output it affects |
|---|---|---|---|
| `src/knowledge.js` (new) | `buildSummary`: what was read (drawings by stage, awaited and pending; BOQ lines and total; BOM; programme activities and data date; specification sections and how many name manufacturers; contract documents and the terms' state; library by class), what is missing, what was flagged (held, failed, not identified, terms pending, drawings pending, links to confirm), templates found and missing per document type, and `tenderVsIfc` (changed, new at IFC, no IFC yet). `proposeLinks`: drawing → specification section (same discipline and a shared word), section → BOQ line, BOQ line → activity, drawing → activity (the register's own trade/floor rule and a shared word) — a few closest per item, each with its basis; a decided link is never proposed again. `issueKb` (AETRAA, with a snapshot), `approveKb` (PM), `kbChanges` / `reviewChanges`: reissued drawings, BOQ, programme and specification compared with what was approved (P1 step 7). Tables `kb`, `kb_link`, `kb_drawing_contents`. | P1 steps 2–7 | — |
| `src/index.js` | `/api/knowledge` (GET), `/links/propose`, `/links/decide`, `/issue` (AETRAA only), `/approve` (PM only), `/review-changes` (PM), `/ai-links` (AI proposes links; any ref not in the lists given is discarded), `/ai-contents` (AI lists the elements, systems and materials an IFC sheet shows; kept as a proposal), `/xlsx` (with the X1 header). Page `/knowledge`. | P1 | New page and downloads |
| `src/html/knowledge.js` (new) | The summary, links with confirm / reject, tender vs IFC, AI contents, Issue, Approve, and the reissue changes for the PM. | P1 | New page |
| `src/attention.js` | The PM's Needs my attention: the knowledge base waiting for approval, and reissue changes not yet reviewed. | P1 steps 5, 7 | PM's attention list |

**Not in this code, and said so on the screen:** P1 step 3 says the tender-vs-IFC comparison is run by "the existing Tender vs IFC agent". That agent is not part of this repository; `tenderVsIfc` compares the register's tender and IFC sheets by number and stands in for it until Ajay supplies it.

**Tested:** `tools/test-g11-knowledge.mjs`, 31 checks.

## G12 · P2–P5 The four schedules

| File | What changed | Why | What output it affects |
|---|---|---|---|
| `src/schedules.js` (new) | `proposeItems`: P2 one shop-drawing item per section asking for shop drawings, based on the IFC drawings linked to it (or sharing its words); P3 one item per section asking for product data or samples, or naming manufacturers (noted), matched to a BOQ line; P4 one per section asking for a method statement plus one per kind of high-risk work in the programme (lifting, hot work, excavation, working at height, demolition, confined space, concreting, formwork, T&C) by trade; P5 one ITP per section with testing or inspection clauses, its hold/witness points quoted, and the inspections planned from its activities. Each item quotes its clause and page. `plannedDates`: the date rule — the programme's own activity for the item ("from programme"), otherwise start − lead time − consultant review (the project's response period) − one resubmission − preparation ("derived"); defaults 21/14/14; P3 has no default lead time; computed when read, so a programme update moves every date. `coverageGates` (P3): pages not read, requirements with no item, approved vendors with no item, BOQ lines with no item, IFC finishes with no item — each cleared with a reason. `approveSchedule`: the PM's baseline (refused for P3 while a gap is open). `dueItems` for Needs my attention. Tables `schedule_item`, `schedule_meta`, `schedule_resolution`. | P2–P5 | — |
| `src/index.js` | `/api/schedules` (list or one, with P3's gates), `/generate`, `/item` (add / edit / remove — the owning team only: Design for P2, Design/Procurement for P3, Site/QA-QC/HSE for P4, QA/QC for P5), `/gate`, `/approve` (PM only), `/raise` (raises the item's submittal through the existing records and links it — S0 then tracks it), `/ai-propose` (AI proposes items; any section not in the index is discarded), `/risk` (AI drafts a P4 risk assessment for HSE to check), `/xlsx` (the v5 columns, the X1 header with the data date; P5 adds the planned inspections). Approving the knowledge base generates the schedules (P1 step 6). Page `/schedules`. | P1 step 6, P2–P5 | New page and downloads |
| `src/html/schedules.js` (new) | One tab per schedule: items with their basis, activity, lead time and dates (late in red, baseline beside live), coverage gaps with Clear, Raise, Remove, Add, AI, Approve. | P2–P5 | New page |
| `src/attention.js` | Items due within a week, or late, on approved schedules, for the owning team. | P2 step 5 | Attention list |

P5 step 5 (reminders before hold points) stays deferred, as v5 says.

**Tested:** `tools/test-g12-schedules.mjs`, 36 checks.

## G14 · A14 Ask the project

| File | What changed | Why | What output it affects |
|---|---|---|---|
| `src/ask.js` (new) | `findSources`: records, specification sections, drawings, BOQ lines, payment terms and programme activities sharing words with the question (or named by reference) — each searched only if the person's roles open its dashboard (records also only for the workflows they are on). `limitFor` (PM 30, everyone else 20 a day), `usedToday`, `logQuestion` (`ask_log`: who, question, sources, AI used, cost — the answer is not stored). | A14 | — |
| `src/index.js` | `/api/ask`: finds the sources by rules; with AI on, the model writes the answer from them only and may cite only their references (a cited reference not in the sources is dropped); with AI off, the matching records are returned with links. Over the limit → 429. Page `/ask`. | A14 | New page |
| `src/html/ask.js` (new) | The question box, the answer, the records used, questions left today. | A14 | New page |

The main dashboard (`src/html/app.js`) is generated from `dashboard-design.html` by `gen-app.mjs`, which is not in this folder, so the "Ask" box there is not added here: the page is `/ask`, ready to be linked from the dashboard's source.

**Tested:** `tools/test-g14-ask.mjs`, 15 checks: the PM sees every dashboard's records, QA/QC only the NCR, HSE only the permit, nothing leaks; the AI path (stubbed) links only cited records and drops an invented reference; nothing stored or changed; 20 and 30 a day; every question logged.

## G15 · CAD packages (phase 7) and the project index with Check and complete (phase 9)

| File | What changed | Why | What output it affects |
|---|---|---|---|
| `src/cad.js` (new) | `readCad`: a DXF's title block (number, revision, title, scale — outranking the file name, disagreements flagged) and its xrefs (BLOCK entries flagged as external references); a DWG by its file name only (D9: DXF only in v1). `fileCad`: paired to the live sheet of the same number as its native source — never a second register row; a CAD revision past the issued PDF is reported and the PDF stays the sheet; with no PDF the CAD file becomes the sheet, flagged "no PDF issued"; xrefs in the same drop travel with it, missing ones are listed. `cad_package` table. `cadStorable`: until files leave the database (spec §12) a CAD file over the drawing limit is "recognised, not stored". | §6, §10, §16 phase 7 | — |
| `src/intake.js`, `src/intake-classify.js`, `src/intake-report.js` | CAD files over the limit are left out at scan with that reason (bytes not kept); CAD items commit through `fileCad` instead of the library; the report has a "Too large to store yet" group. | §6, §12, §30 | Intake |
| `src/project-index.js` (new) | `rebuildIndex`: contract clauses from the library's contract PDFs (a clause starts where "Sub-Clause n.n" opens a sentence with a heading — a reference inside a sentence does not), each verbatim with its page and topics; records and correspondence; minutes; dated events (instructions, approvals); drawings; BOQ lines and applications. Every entry names its source or is not written; stated links where a letter says what it replies to. D14: a later contract document's clause governs and the earlier is kept, marked superseded. Rebuildable. `checkDraft`: references the draft names (checked; a missing one flagged), clauses quoted verbatim with their page, the notice clause on a notice, vague references replaced by possibly-related records or flagged "cannot be checked", date arithmetic shown and never concluded, cost sources, the addressee from the parties, related records on the subject. `confirmLetter`: what was proposed, accepted, edited (an edited quotation recorded as paraphrase) and refused. Tables `index_entry`, `index_link`, `letter_check`. | §29, §16 phase 9 | — |
| `src/index.js` | `/api/cad-packages`; `/api/index/rebuild`, `/api/index`, `/api/index/check`, `/api/index/confirm` — the contractor's team only, no consultant (D15). Confirming does not issue: the letter goes through its own workflow. Page `/letter-check`. | §29, D15 | New page |
| `src/html/letter-check.js` (new) | Write the draft, Check and complete, Accept / Edit then accept / Refuse per proposal, the letter with what was accepted placed after the sentence it belongs to, Confirm. | §29 | New page |

**Ajay's decisions D13–D15 are still his to make.** Until he does, this follows the spec's own recommendations: D13 verbatim clauses, D14 later clause first with the earlier kept as superseded, D15 the contractor's team only.

**Tested:** `tools/test-g15-cad-index.mjs`, 30 checks.

## PostgreSQL

`tools/test-pg-girish.mjs` runs G1–G15 end to end on PostgreSQL (PGlite in memory, through `src/db-postgres.js` — the live server's database): 38 checks, 0 failures. It uses PGlite from `../../prelaunch/node_modules` (`npm install` there first).

## Summary of Girish's half

All fifteen tasks are built and tested: 287 checks on SQLite across 10 test files, 38 on PostgreSQL, and every page's in-browser script parses (`tools/check-page-scripts.mjs`). Bugs found and fixed on the way: contract proposals pre-ticked on the contract screen; drawings in a stage folder filed as "other"; BOQ/BOM imports cut at 400 rows; the order-dependent two-programme reason. Still needed from Ajay: the Tender vs IFC agent (P1 step 3), decisions D13–D15, and the main dashboard source (`dashboard-design.html` / `gen-app.mjs`) to link the new pages (`/knowledge`, `/schedules`, `/spec`, `/ask`, `/letter-check`, `/terms`, `/intake-history`) from it.
---

# The second half of the work split, K1–K13 (6 Oct 2026)

The tasks are in `Girish/AETRAA-Platform-Work-Split.pdf`. Each section below is one task. Tests use the same `tools/_harness.mjs` as Girish's half.

## K1 · E7 and E8: the priced BOQ and the BOM, checked, matched and approved, with money exact to the fil

Before this change, `importBOQ` took the Amount it was given and worked out qty × rate only when the Amount was blank. A bill that did not add up was imported as it was, and every certificate valued on it was wrong (spec §18). The setup console worked out the rows in the browser from the first worksheet only. `/api/boq`, `/api/bom` and `/api/boq/bill` accepted any project id they were sent, so a named user could read or change another company's bill. Every money figure was a floating-point sum.

Now nothing reaches either bill without being read and checked. The QS (Contracts & Commercial) uploads the BOQ; Procurement, or the QS, uploads the BOM. The platform reads every sheet and every row. It compares the bill's own sub-totals and grand total with its lines, and flags every line with no rate, a wrong sum, a figure that is not a number, a negative amount or no description. The QS fixes the file and uploads it again, or accepts each flag with a reason; the reason is kept with who accepted it and when. The bill is imported only when no flag is open, and then waits for the PM. The PM approves it by name. No IPC is valued against a BOQ waiting for approval (E7 step 4). Each BOM material is matched to a BOQ line: by the BOQ ref column (taken as it is) or by name (a proposal that Procurement confirms). Procurement resolves every unmatched material. Only then can the PM approve the BOM. No order or delivery is recorded against a BOM that is waiting (E8 steps 2–4).

| File | What changed | Why | What output it affects |
|---|---|---|---|
| `src/money.js` (new) | Money in whole fils, quantities in thousandths, percentages in ten-thousandths. Figures are read from their written form digit by digit (`toScaled`: commas, brackets, currency codes, %, Arabic-Indic digits, exponents), never multiplied through a float, so 1.005 is 1.01. Rounding is half away from zero (Excel's ROUND), once per line, then summed. Products use BigInt (`lineAmount`, `pctOf`, `ratioPct`). Also `SQL_SUM_FILS(col)` sums a REAL column exactly on SQLite and PostgreSQL. | §27 rule 5: "0.1 + 0.2 is the wrong answer in a BOQ" | — |
| `src/bills.js` (new) | Reader `bills-v1`. `.xlsx` is read sheet by sheet, each cell placed by its own reference, hidden sheets marked, and the unzipped size checked before anything is inflated (120 MB). `.csv` is read with its quotes honoured. `.xls` is refused, with "save it as .xlsx". Each sheet's header row is the first of its top 20 rows with two or more words. A sheet named Summary, Collection, Cover or Index is read but not imported, so the bill does not count itself twice; the person can tick sheets in or out. Headings, carried/brought-forward rows and blank rows are reported as not read, with the reason. `checkBill` raises the flags; the tolerance follows the precision the amount was written to: 1 fil, or half a dirham for a bill rounded to whole dirhams. Table `bill_imports`: one check per upload, kept with the file's SHA-256, the reader version, every line, every row not read, the flags and their acceptances, the totals by section, and the stored original. `stageBill`, `restageBill`, `acceptFlags` (a reason is required), `commitBill` (refused while a flag is open), `discardBill`, `approveBill`, `billState`. BOM matching: `matchBom`, `bomMatching`, `resolveBom` (confirm, link to chosen BOQ lines, or "not in the BOQ" with a reason), table `bom_links`. New project columns `boq_state` / `bom_state` and who imported and approved them. A project whose BOQ existed before this change has no state and counts as approved, so live certificates are not stopped. | E7, E8, the E-program condition (deterministic, SHA-256 + version, every row reported), §15 test 8 (a bill over the limit is refused, never cut short) | — |
| `src/commercial.js` | `importBOQ` stores each amount to the fil and totals it in fils. `listBOQ` sums sections and billed values in fils, rounding each line once. Section rows now carry `amount` as well as `value`. | §27; the register showed "—" for every section because it reads `amount` | BOQ register, BOQ Excel, IPC |
| `src/bom.js` | New columns `boq_ref` and `discipline` (via `addColumns`). Budget, ordered, received and remaining are worked in thousandths. | E8 step 2 and the log by discipline; §27 | BOM screens, orders, GRN |
| `src/ipc.js` | The valuation (`valuate`, `proposeValuation`, certify and pay) works in fils: per line `pctOf`, variations, materials on site, retention and its cap, advance recovery, previous, net and VAT. A BOQ waiting for the PM is a blocker, and propose answers "waiting for the PM's approval". | E7 step 4; §27 | Every IPC figure: exact to the fil, the same as before wherever the old float sum happened to round right |
| `src/index.js` | New `/api/bills` (state, with what the person may do), `/api/bills/check`, `/upload`, `/sheets`, `/accept`, `/commit`, `/discard`, `/approve` (a named PM or Principal only, not AETRAA, not the QS), `/match` (GET and POST), `/file` (the original as uploaded). The project for every bills route is the one the router resolved for the person; naming another one gets 403. The AETRAA Admin may name any project. Module walls: BOQ under Contracts & commercial, BOM under Procurement. `/api/boq/import` and `/api/bom/import` (rows) go through the same check: rows with flags come back 409 with the flags unless `accept: { note }` is sent. **Security fix:** `/api/boq`, `/api/bom*` and `/api/boq/bill` no longer take another company's project id from the query or body. `/api/bom/order` and `/grn` are refused while the BOM waits for the PM. Intake files a priced BOQ or BOM through the same check: a clean bill is imported and waits for the PM; a flagged bill waits on `/bills` and nothing is imported. Contract sum (payment terms), the project page's BOQ total and the admin home's BOQ total are summed in fils. Page `/bills`. Every step is audited (`boq.check`, `boq.accept`, `boq.import`, `boq.approve`, `bom.match`, …). | E7, E8, §19 (permissions on the server) | Setup console, intake, register, IPC, BOM orders |
| `src/intake.js` | The commercial branch of `fileOne` calls `routes.bill` (the check above) when it is wired in. | E7, E8 | Intake of a BOQ or BOM |
| `src/sections.js` | The BOQ figure and its total are summed in fils. | §27 | Files → BOQ |
| `src/register-xlsx.js` | BOQ Excel: the Amount is the bill's own figure as a value, not `E×F` (a lump sum or an accepted amount showed a different figure from the one every certificate was valued on); billed value is `ROUND(G×H,2)`, worked in fils. | §27 | BOQ register download |
| `src/ipc-pack.js` | IPC valuation workbook: every value in fils, each formula `ROUND(…,2)` (line values, variations, materials on site, retention and its cap, VAT), so the sheet Excel recalculates shows the figures the platform certified. | §27 | IPC valuation download |
| `src/attention.js` | Needs my attention: an upload waiting to be checked (QS for the BOQ; Procurement or QS for the BOM), materials not matched to the BOQ, and a bill waiting for the PM's approval. | E7, E8 | Attention lists |
| `src/html/bills.js` (new) | BOQ & BOM page: each bill's state, upload, the check (every sheet with what happened to it and the columns read, the bill's own totals, flags with accept-with-reason, rows not read, the lines as read, by section), import, discard, the BOM's matching (confirm, link, not in the BOQ), and Approve for the PM. | E7, E8 | New page `/bills` |
| `src/html/setup.js` | The BOQ and BOM cards send the file itself to `/api/bills/upload` (every sheet), instead of rows worked out in the browser from the first sheet. They show what was read and flagged and link to `/bills` to finish. | E7, E8 | Setup console |
| `src/html/app.js` | The BOQ register's note says when the BOQ is waiting for the PM, and links to `/bills`. Edited directly: `gen-app.mjs` is not in this folder. | E7 | BOQ register |
| `tools/demo-seed.mjs` | The demo BOQ is priced as section lump sums, so it is imported with the QS's reason. Each BOM material names its BOQ line, and the PM approves both before orders and the IPC. | The demo still builds end to end | Demo |

**Tested:** `tools/test-k1-bills.mjs`, 68 checks:
- money exact: 0.1 + 0.2, 1.005, brackets, BigInt on AED 50m
- CSV quotes and the .xls refusal
- a three-sheet workbook:
  - the summary sheet is read and not imported
  - the title row above the header is skipped
  - every line keeps its sheet and row
  - headings are reported
  - the sub-total is checked
  - the wrong sum is flagged at its row, with the arithmetic beside it
  - "Included" is flagged as no rate
  - the total matches the file to the fil
- the same file gives the same SHA-256, flags and total
- no import while a flag is open; accept needs a reason; who accepted and why are kept
- IPC refused until the PM approves; the QS cannot approve; it appears in the PM's and the QS's attention lists
- an IPC line at 33.335% and one at 50% valued to the fil
- the IPC workbook uses `ROUND(…,2)` and the accepted amount as a value
- BOM:
  - matched by reference, proposed by name, and unmatched
  - no approval while any material is open
  - no order while the BOM is pending
  - 0.1 + 0.2 ordered is 0.3
- another company's QS is refused on five routes
- the rows API: 409 with flags, then imported with a reason
- intake: a flagged bill waits and nothing is imported
- a BOQ from before approval existed counts as approved

All earlier tests still pass after rebasing on G15: G1 28, G2–G8 46 (the golden intake file is unchanged), G9 21, G10 22, G11 31, G12 36, G14 15, G15 30, intake fixes 22, X1 36, PostgreSQL (Girish) 38; 55 page scripts parse. The demo seed was also run in-process: both bills approved, IPA-01 valued and certified. `tools/test-pg-k-series.mjs` runs the same flow on PostgreSQL (PGlite, through `db-postgres.js`, PGlite from `../../prelaunch/node_modules` as in `test-pg-girish.mjs`), 15 checks: a AED 60m bill (past a 4-byte integer in fils, which is why `bill_imports.total_fils` is REAL), flags, accept, import, approval, the IPC block, BOM matching and approval, 0.1 + 0.2 ordered, and the contract sum in fils.

**Not changed, for the owner to decide:**
- `prelaunch/sandbox.mjs` is outside `work/test-drive` and is left alone. It imports an amount-only BOQ through `/api/boq/import`. Once a release includes K1, that import is answered 409 (no rates) until it sends `accept: { note: … }`. The UAT PM then approves the BOQ and BOM on `/bills`.
- `src/knowledge.js` (G11) summed the BOQ total with a float `SUM(amount)` for its snapshot; Girish moved it onto the fils sum in `7ee916b`.

**K1 follow-up: reading a real printed bill.** A real unpriced bill, from a B+G+5 residential building in Sharjah, read every sheet as "no description column", so it gave no lines. Its title block ("BILL OF QUANTITIES · BILL NO. · PAGE NO.") comes before the header. The fix in `src/bills.js`:
- **The header:** it is now the row that maps a description and a figure column, not the first row with words.
- **Two-row headers:** a header split over two rows ("ITEM / REF.", "UNIT / RATE", "TOTAL PRICE / AED") is read as one, but only when the second row maps more. A heading under the header stays a heading.
- **Repeated page headings:** the title block and the column headings repeated at the top of every printed page are reported as "the page’s own heading, repeated", not read as lines.
- **Sections:** with no section column, a line’s section is the "SECTION D - MASONRY WORK" heading above it.

That bill now reads as 55 items across four bill sheets, in their sections. The summary sheet is not imported, and the only flags are the "no rate" ones an unpriced bill should have. `tools/test-k1-bills.mjs` has a bill built in the same shape (the real file is the client’s and is not in the repository): 72 checks.

## K5 · Imported records: closed, no clocks, marked, numbered above, taken over by DC

**The decision this follows.** v5 E12 says imported records arrive "at their current workflow step". Spec §3 and §17 say they arrive closed, with no pending step. Asked on 6 Oct 2026, the owner chose the spec: closed, no clocks, status *Imported*, the old status kept as a fact. Document Control can take one over as a new live record, linked to the old one, with a fresh clock.

Before this change there was no way to create a closed record, and nothing was named `imported`. Several readers did not skip a record that has no pending step:
- the weekly and monthly register figures counted it as raised, open and closed
- HSE read "Imported" as a live permit, and an old injury as a lost-time injury
- the IPC listed an old variation as unapproved
- the AETRAA Admin could "advance" it and overwrite its status

| File | What changed | Why | What output it affects |
|---|---|---|---|
| `src/records.js` | New columns through `addColumns`: `imported`, `imported_from`, `original_date`, `original_status`, `continues` and `continued_by`. The old `due_basis` probe and bare `ALTER` were moved onto `addColumns` (rule 4). `importRecord` / `importRecords` create a record closed: one done step "Imported — not raised on this platform", status `Imported`, no due date, no basis. The reference is kept verbatim and refused if already on the project (§18, case-insensitive). The original date must be a date. The facts are kept in `data`, the source in `imported_from`. `importedNumber`: the platform's numbering stays above the last number of a reference that names the kind's prefix (`RFI-0042`, `J179-RFI-ARC-0050`, `RFI 42 Rev 1`). A reference with no prefix sets nothing. The highest per kind and the next live number are reported (§17). `takeOverRecord`: a new live record of the same kind from the first step of the project's ladder, with the old data carried except the fields that set a due date, `Continues: <old ref>`, and links both ways. An incoming letter is answered by a reply letter that names it, not taken over. `advanceRecord` refuses an imported record. | Spec §3, §17, §18; the K5 decision | Records |
| `src/index.js` | `POST /api/records/import` (Document Control, PM or Principal on their own project; the AETRAA Admin on the project it names with `?p=`; up to 5,000 per call; module walls per record kind; audited) and `POST /api/records/take-over` (same people; audited). `stepPermission` refuses an imported record for everybody, AETRAA included. `/api/record/doc` refuses to generate a platform form for an imported record. Each record sent to the screen says whether the viewer may take it over. | K5 | — |
| `src/attention.js` | Imported records and imported drawings are skipped outright. They already had no pending step; this says so outright. | §17 "every clock skips it" | Needs my attention and the 06:00 digest |
| `src/report-extras.js` | `registers()` leaves imported records out of raised, issued, replied, closed, open, overdue and with the consultant, and counts them on their own (`totals.imported`, in the period they came in). `drawingsIssued` leaves out imported sheets. | §17 | Weekly and monthly reports |
| `src/hse.js`, `src/hse-monthly.js` | Imported permits, observations and incidents are out of the HSE report and the monthly statistics, including "days since a lost-time injury", frequency rates and days lost. | §17 per-type rules (permits, incidents) | HSE reports |
| `src/ipc.js` | (Added in K1) an imported variation posts nothing to the IPC and is not listed as unapproved. | §17 "must not post a value" | IPC |
| `src/authorities.js` | Seeding authorities skips one already on the project as an imported approval, and reports it under `already`. | §6 | Setup → Authorities |
| `src/drawings.js` | Columns `imported`, `imported_from` and `original_date` on drawings (`addColumns`). `markDrawingImported` is for the archive import. `listDrawings` returns them. | §10, §17 | Drawing register |
| `src/register-xlsx.js` | Register export: a new last column, **Origin**, reads "imported — not raised on this platform". For an imported record: Raised by is the old log's (`Raised by` / `From` / `Originator`), not the importer; Raised on is the original date; Status is "Imported — was "…" in the old system". Schedule export: the same marker and dates. Drawing register export: an Origin column. | §3 "a visible marker … in every export" (a column, because X1's header replaces the rows above the headings) | Register, schedule and drawing register downloads |
| `src/html/app.js` | Register rows of an imported record read "Imported — not raised on this platform · was "…"", never Overdue, with no NCR age. The record panel gives the facts (the original date and status, where it came from, what it continues as). It shows **Take over as a new live record** to DC, the PM and the Principal, and has no Generate document. A live record that continues one links back to it. Edited directly: `gen-app.mjs` is not in this folder. | §3, the K5 decision | Every register screen and the record panel |

**Tested:** `tools/test-k5-imported.mjs`, 46 checks:
- reference numbers: plain, compound, with a revision, and with no prefix
- who may import (a designer, and another company's DC, are refused)
- seven records across RFI, permit, incident, variation, authority and incoming
- a second copy is refused (also in other case), with an unknown kind and a bad date each refused with the reason
- stored closed, with the facts and the source kept
- nothing imported in Needs my attention for DC, the PM, HSE or the QS
- report figures (`registers`) zero for the month it was raised, a month in between, and the week it was imported, with `imported` counted on its own
- HSE weekly, daily and monthly exclude the imported lost-time injury and permit
- the IPC excludes the imported VO
- refused: AETRAA's advance, the PM's early close, and document generation
- the next live RFI is RFI-0051, after an imported J179-RFI-ARC-0050
- the register export carries the marker, the old status and the old "Raised by"
- take over:
  - refused for a designer and for an incoming letter
  - gives RFI-0052, linked both ways, with no carried reply-by and waiting on the PM
  - is not done twice, and never on a live record
- an imported drawing is not "issued this week", and its export is marked
- seeding authorities skips the imported Dubai Municipality
- the same reference on another company's project is its own

`tools/test-pg-k-series.mjs` now runs K5 on PostgreSQL too: 25 checks in all, including the weekly, monthly and HSE reports building with imported records. Every other test still passes.

**Still to decide, from the review (not built here):**
- Should an imported certificate's or NOC's expiry still be flagged (spec §6 line 365, §18)? Today an imported record has no due date, so nothing flags it.
- Who marks a drawing as imported? The function is here; intake, E3 and E11 are Girish's, and K6 (past registers) will call `importRecords`.
- Should the separate `issues` register (its own RFI-#### sequence) also start above imported RFIs, or is it being retired?

## K2 · Files out of PostgreSQL: Azure Blob, what each project holds, and the move

**The decision this follows.** Asked on 6 Oct 2026, the owner chose the full move:
- a Blob driver
- the capacity screen
- register-screen drawings and site photos through the file store
- an Admin-run, dry-run-first tool to move the files already in PostgreSQL

Sub-choices made here:
- **Shared Key** authentication (signed in code, as `sigv4` is for S3), with a SAS token as an alternative.
- **A store that fails** still falls back to the database, so nothing is lost, but every such file is recorded and shown.
- **The 1.4 MB register upload limit stays** (spec §12: "limits unchanged").
- **Logos stay in the database.**

Before this change, every file on the live server sat in PostgreSQL (32 GB, shared by every company), as base64. Only the files table went through `storage.js`. Register-screen drawings were in `drawings.data`, site photos in `photos.data`, held drawings in `quarantine.payload`, and some templates in `templates.blob`. "Clear documents" and "Delete project" left stored files behind. `POST /api/drawing` stored any `r2_key` it was sent: a project's PM could point a drawing at another company's library file and download it from here.

| File | What changed | Why | What output it affects |
|---|---|---|---|
| `src/storage.js` | **Azure Blob driver.** Settings: `AZURE_STORAGE_ACCOUNT`, `AZURE_STORAGE_CONTAINER`, and `AZURE_STORAGE_KEY` or `AZURE_STORAGE_SAS`, with an optional `AZURE_STORAGE_ENDPOINT`; or one `AZURE_STORAGE_CONNECTION_STRING`. It is tried first, before S3, R2 and the database. `azureSign`: Shared Key (the verb, the standard headers, the `x-ms-*` headers, `/<account><path>`). **File index** `stored_files` (key, project, area, size, driver, `fell_back`), written for every stored file on every driver, since an object store cannot cheaply say what a project holds. `putFileTo` / `getFileFrom` (one named store only, for the verified move). `deleteProjectFiles` (every file of a project in the given areas, from the index and from the database's own files table). `deleteFile` clears the index. Reads still look in every store, so nothing stored before a switch is lost. | Spec §12, §16 phase 0, D1 | Where every file is kept |
| `src/drawings.js` | A register-screen upload goes to the file store under `drawings/<project>/<id>/<file>`; the row keeps the key and `data` stays empty. It is stored only once the change is allowed, so a refused edit leaves no file. A replaced upload's old file is deleted. A held drawing's bytes go to the store and the held item carries the key. Removing a register upload removes its file. **Security fix:** a key sent in a request must be one of this project's own (`intake/`, `drawings/` or `library/` + the project id; a test-drive copy may use its real project's), or it is refused with "that file is not on this project". | §12, §10 (held files through storage), §19 (an id in a request is only a claim) | Drawing register |
| `src/photos.js` (new), `src/index.js`, `src/ipc-pack.js` | A site photo goes to `photos/<project>/<id>.<ext>`. `photos.file_key` and `photos.size` (`addColumns`); `photos.data` is left `''` because of its NOT NULL. `/photo/<id>` and the IPC pack read from the store, and older photos still read from their data URL. | §12, §6 ("photos are what fills storage") | Site photos, IPC pack |
| `src/file-move.js` (new) | `planMove`, the **dry run**: every file still in PostgreSQL (the files table, register drawings, photos, held drawings, inline templates), counted and sized, by kind and by project. Nothing changes. `runMove`, the **move**, a batch at a time: written to the object store, read back and compared by SHA-256, and only then removed from the database. A file that fails stays where it was and is listed. Running it again carries on. `capacity`, **what each project holds**: per project, drawings (and how many live), records, library documents, photos, bytes in the object store and bytes still in the database, and last activity (from the audit). For the platform: the database's size (`pg_database_size`, or page count × page size on SQLite) against `DATABASE_LIMIT_GB` (default 32), the object store's total, and the files that fell back. | §8, §12 | — |
| `src/index.js` | `GET /api/storage/capacity`, `GET /api/storage/move` (dry run) and `POST /api/storage/move` (needs `confirm: "move"`; audited), all AETRAA Admin only. Page `/storage`. "Clear documents" and "Delete project" now delete the stored files of the drawings, library, attachments and intake (plus photos, templates and bills on a delete), and say how many. `bill_imports` and `bom_links` (K1) are added to what a delete removes. | §8, §12 | Admin |
| `src/html/storage.js` (new), `src/html/home.js` | The Storage screen:<br>- where files go<br>- the database's size and how full it is (warning at 80%)<br>- files still in the database and in the object store<br>- files that fell back<br>- a "Check the file store now" self-test<br>- the dry run, and Move (batches until done)<br>- every project's holdings<br><br>A **Storage** button on the Admin home. | §8, §12 | New page |
| `server.js`, `local.mjs` | Pass the `AZURE_STORAGE_*` and `DATABASE_LIMIT_GB` settings into the app (`server.js` copies only named settings). The start-up line says Azure Blob when it is configured. | — | — |
| `deploy/azure/azure-setup.sh` | Registers `Microsoft.Storage`. Creates the storage account (`aetraafiles<suffix>`, UAE North, StorageV2, `Standard_LRS` or `AETRAA_STORAGE_SKU`, TLS 1.2, HTTPS only, no public access). Sets 14-day soft delete for blobs and containers, and versioning. Creates the private container `aetraa-files`. Limits network access to the app server's address. Writes the settings into the app's environment. Re-runnable. | §12 (Blob retention, so a backup survives the move) | New servers |
| `deploy/azure/STORAGE.md` (new) | The settings; the steps for a server already running; checking it, the dry run and the move; reclaiming database space; restoring the database and the files together; what stays in the database (logos). | §12 | — |

**Tested:** `tools/test-k2-storage.mjs`, 43 checks:
- the Shared Key signature equals the one `@azure/storage-blob` 12.34.0 computed for the same request
- a fake Blob server refuses any request whose signature is wrong; none was refused
- before Azure: a register upload already goes through the store, and the dry run counts all five kinds and refuses to move with nowhere to go
- with Azure:
  - the self-test round-trips
  - the dry run changes nothing
  - the move needs confirm, moves everything, and removes the database copies
  - the moved drawing, photo and template are served from Blob with the same SHA-256
  - running it again moves nothing
- new files go to Blob: a drawing, a photo, a template and an attachment, each stored and read back
- with the store down, an upload is kept in the database and shown as fallen back; the next move takes it across
- what the project holds: counts, bytes, last activity, and the database against its limit
- the page is AETRAA's alone
- a drawing pointed at another company's file is refused
- removing a register upload removes its blob
- "Clear documents" deletes the documents' blobs and keeps photos and templates; "Delete project" deletes the rest, and another company's files are untouched

`tools/test-pg-k-series.mjs` adds the same on PostgreSQL (`pg_database_size`, the dry run and the move, serving from Blob): 32 checks in all. The older top-level `tools/test-storage.mjs` (S3, R2, database: 46 checks) passes against the new `storage.js`. Every other test still passes.

**Checked by hand, not kept in the repository:** the driver against the Azurite emulator (3.37) and the official SDK, with both installed in a scratch folder.
- Azurite accepted the Shared Key signature.
- The SDK read what the driver wrote, and the driver read what the SDK wrote, with its content type.
- A missing key reads as nothing, and a delete removes the blob.
- A wrong key was refused by Azurite and the file fell back, recorded.
- A SAS token works instead of a key.
- Through the router: the self-test, the move of an old drawing, a register upload (read back by the SDK), and a photo.

**Not built here:**
- Spec §25's per-project switch for bulk loading. Today, client roles can open drawings-only intake batches through the API. Those files now go to Blob too, once it is configured.
- The live server's Blob settings need Azure access. The script and `STORAGE.md` give the steps, and the Storage screen's self-test confirms them.
- The top-level `DEPLOY-AZURE.md` still says files stay in the database; `deploy/azure/STORAGE.md` replaces that paragraph.

## K3 · Held documents and storage: who is told, once (spec §22)

**What was there:** one email to AETRAA per intake commit that held anything, with "Warning:" once a company had three held in 90 days. Several things went wrong:
- **Single uploads:** a held single drawing upload told nobody and recorded no uploader.
- **Repeat sends:** pressing Commit again re-sent the email for items already held.
- **Decisions:** nobody was told a decision.
- **Approving an intake hold:** this filed nothing. Pressing Commit again held it a second time, silently.
- **The live server:** `server.js` never passed `PLATFORM_EMAILS` into the app, so every AETRAA email went to nobody there.

| Rule (spec §22) | Who | How | Period |
|---|---|---|---|
| The first item held on a project (nothing else of it waiting) | AETRAA | email at once, with the company warning as before | once per first hold |
| Further holds | AETRAA | the daily digest at 06:00 UAE, leaving out what was already sent | once a day |
| Held more than 3 days | AETRAA | email, until cleared | once a day |
| More than 20 held on one project | AETRAA | email | once a week (so: once, then weekly) |
| Database storage over 80% (K2's figure) | AETRAA | email, with what to do | once a day |
| A held item decided | whoever loaded it | email and the bell: approved and where it was filed, or rejected with the Admin's own words | once per item |

The 3 days, 20 and 80% are the spec's values. **D5 is still Ajay's open decision**, so they are settings, not code: `HELD_REMIND_DAYS`, `HELD_PROJECT_LIMIT` and `STORAGE_ALERT_PCT`.

| File | What changed | Why | What output it affects |
|---|---|---|---|
| `src/alerts.js` (new) | `notify_log` (rule, scope, period): every message is written there **before** it is sent. A second attempt for the same key sends nothing, across restarts and across servers, which the scheduler's in-memory "already fired" cannot promise. A send that fails removes its row, so the next run retries. `onNewHolds` (the first hold), `runAdminAlerts` (the digest, over N days, over N on a project, storage), `tellUploaders` (the decision, by email and the bell, one message per person per decision call). `isoWeek` for the weekly period. | §22 "nothing is notified twice" | AETRAA's email, the uploader's email and bell |
| `src/index.js` | The intake commit tells AETRAA only about **new** holds. A held single upload now tells AETRAA too and records the person who uploaded it. The decide route:<br>- files an approved intake hold **at once**, through the same intake code and past the gate<br>- reports where it went<br>- tells each uploader<br><br>The 06:00 cron also runs `runAdminAlerts`. The intake importers object moved, unchanged, into a module-level `intakeRoutes()`, so the decide route files through exactly the same code; its drawing importer accepts `{ gate: false }`. The old `tellAdminHeld` is replaced. | §22, P1 step 2a ("Admin notified") | Held queue, intake |
| `src/intake.js` | An item whose hold was approved is filed past the gate (it was held again). A hold re-reported on a second Commit is marked `already`. | §22 "the decision message says it was filed" | Intake commit |
| `src/drawings.js` | A held single upload records the person (`held_by_id`), not just a name. | So they can be told | Held queue |
| `src/quarantine.js` | `held_by_id` is returned with each held item. | — | — |
| `server.js`, `local.mjs`, `deploy/azure/azure-setup.sh` | `PLATFORM_EMAILS` is passed into the app, with the three thresholds. The setup script writes `PLATFORM_EMAILS` from `AETRAA_ADMIN_EMAILS`. On a running server: `sudo aetraa-config PLATFORM_EMAILS admin@…`. | Without it, no AETRAA alert is ever sent on the live server | Every AETRAA email |

**Tested:** `tools/test-k3-alerts.mjs`, 30 checks:
- a held single upload emails AETRAA at once, and records the uploader
- a second hold while the first waits is not emailed at once
- an intake hold is not emailed at once while others wait, and pressing Commit again sends nothing
- the daily digest lists the later holds and not the first; a second run that day sends nothing
- held over 3 days: reported, once that day, again the next day; with the threshold set to 10, a 7-day hold is not yet due
- over 20 held: one email, not again that week, again the next week
- storage: nothing while the database is nearly empty; over the limit, told with what to do, once a day
- decisions:
  - approving a held upload files it, and the designer is emailed "approved and filed to the drawing register"
  - a rejection needs the reason, and the designer is told it in the Admin's words
  - both reach the bell
  - approving the DC's intake hold files it at once, onto the register and not held again, the intake item says filed, and the DC is told where it went
- the 06:00 cron runs the alerts

`tools/test-pg-k-series.mjs` adds K3 on PostgreSQL: the duplicate key is refused, a failed send is retried, and the daily run sends each rule once. 36 checks in all. Every other test still passes.

**Not built here:**
- **No held-queue screen:** there is still no screen where AETRAA sees the held queue and types the note (spec §8, §24). The API and the rules are here; the bell links the uploader to their intake history.
- **"Batch interrupted":** the §22 row "Batch interrupted → whoever ran it" is in neither half of the work split.
- **The thresholds:** D5 is still to be confirmed by Ajay.

## K4 · E16 Word forms: fields and signature boxes from their tables, filled and signed at issue; placeholders nothing fills, named

v5 E16: "Same as E10 for consultant forms that come as Word documents — fields and signature boxes from its tables; AI (A6) only when fewer than two fields are found." Before this change, a Word form only had its `{{tokens}}` read: no fields, no signature boxes, no clickable drawing and no writer. A token nothing fills printed blank without a word. A macro-enabled package was accepted, and its macros were copied into every issued file.

**Built to v5, not to the spec, where they differ:** spec §6 also wants PDF forms accepted as "reference forms". v5 approves Excel (E10) and Word (E16) forms only, and S0 needs a fillable form. The work split says to stop at a v5–spec disagreement, so **PDF templates are not built**. A PDF is still refused with "not a readable .docx or .xlsx form". The question is open for Ajay.

| File | What changed | Why | What output it affects |
|---|---|---|---|
| `src/template-word.js` (new) | `readWordSheet`: the document's tables on one grid with A1 references, the same shape as the Excel reader's. Horizontal merges (`gridSpan`) and vertical ones (`vMerge`) become merges; nested tables are read as their cell's text; paragraphs outside tables become full-width rows, so the drawing shows the whole page. `extractWordFields`, Word's own label rules:<br>- cells are read left to right in label \| box pairs, and the cell beside a label is its box, whatever was typed there. This fixes E10's rule reading the old value "Old subject" as a label.<br>- a label is bold, ends in ":", is a known name, or is the first of a pair.<br>- a label across its table owns the box under it.<br>- signature rows, tick-box rows, numbered lists and the consultant's part make no fields.<br>- old names in signature rows and the consultant's old answers are cleared.<br><br>It also returns a per-row read / not-read report with the reason. `writeWordCells` / `prepareWordForm`: `{{token}}` into each box, old text out, keeping the cell's properties and the first paragraph's and run's formatting. `suggestWordSignCells`. Version `e16-1`. Deterministic; no AI. | v5 E16 | Word templates |
| `src/template-forms.js` | `saveFormTemplate` reads a Word form with tables like an Excel one. Its fields and the original are kept (`.orig.docx`), and DC's changes rebuild it from the original. A Word form with only `{{tokens}}` is kept as before. Signature boxes are found on Word forms. A Word form with tables is drawn on its grid, with clickable cells for Fields and the signature picker and signatures shown in place. At issue, signatures are written into their Word boxes. `unknownTokens`, what prints blank:<br>- on a form with fields, a `{{token}}` that is neither a field nor filled by the platform<br>- `{{sign:N}}` for a step the workflow does not have<br>- `<<token>>`<br><br>The E-program record is kept for every template upload: the original's SHA-256, the extractor and its version (`e10-1` / `e16-1`), the field count, and the row report. Under two fields, the form is marked for A6. Each field is marked `by: extractor` or `by: person`, so A6 (K9) never changes what the extractor read. Columns go through `addColumns`; the bare `ALTER TABLE`s are gone (rule 4). | E16, spec §6, the E-program condition, the A6 boundary | Templates, New form, previews, issued documents |
| `src/template.js` | A macro-enabled package (`word/vbaProject.bin` or `xl/vbaProject.bin`, whatever its name) is refused. `angleTokens` finds `<<placeholders>>`. | Spec §19, §6 | Template upload |
| `src/index.js` | The template list carries whether fields were read, the field count, the A6 mark, the extractor, and what prints blank. | — | Templates screen |
| `src/html/templates.js`, `src/html/setup.js`, `src/html/files.js` | Fields and Signature boxes are offered for a Word form with fields. "Prints blank: …" is shown, and named in the upload reply. A Word form with tokens says "filled from its {{placeholders}}" instead of "no fields to fill". | — | DC Templates, Admin Setup, Documents |

**Tested:** `tools/test-k4-word-forms.mjs`, 35 checks, with Word forms built in `tools/fixtures/word-forms.mjs` (a consultant's RFI form last used on another job):
- **Reading:** eight fields; platform-filled versus asked; the box under a wide label; the value beside a label is a box; old names and answers cleared; the row report; extractor marks; the same output twice; a plain two-column table.
- **The writer:** tokens in, the last job out, formatting kept.
- **DC upload:**
  - fields, signature boxes, extractor, count and SHA-256 kept
  - the same file twice gives the same record
  - the list offers Fields
  - the review is drawn with clickable cells
- **Raising and issuing:**
  - the New form asks for the form's own fields
  - raised by the designer and signed by the PM
  - issued as Word, with the platform's values, the person's values and the PM's e-signature in their boxes, and nothing of the last job
  - the preview shows the signature in place
- **DC renames a field:** it becomes DC's; the rest stay the extractor's.
- **What prints blank:** `<<old>>`, `{{sign:7}}`, and a stray `{{token}}` on an Excel form with fields; the list carries them.
- **Refused:** a macro-enabled form, and a PDF.
- **A6:** a form with one field is marked for it.

`tools/test-pg-k-series.mjs` adds a Word form on PostgreSQL, read, stored and issued filled: 39 checks in all. Every other test still passes.

**Not built here, for the owner:**
- **PDF reference forms** (spec §6): v5 does not approve them, so they wait for Ajay.
- **No real Word consultant form exists in the repository or the Al Warqa'a set**, which is all Excel. The fixtures are built to the shape such forms take. The first real one should be checked on the review screen.
- **Templates are still live on upload**, not on DC's save (v5 E10 step 3). Unchanged here.

## K6 · E12 Past registers: the old system's RFI, submittal, material and NCR logs, brought in by Document Control

v5 E12:
1. Document Control drops the old system's log (Excel).
2. Its columns are mapped to the platform's (reference, subject, dates, status, code) with a preview, and DC fixes unmapped columns and odd statuses.
3. Confirming creates the records.

Following the K5 decision, the records are created **closed**, as imported records: status *Imported*, the old status and dates kept as facts, no clock anywhere. Nothing for this existed before: no reader that kept every row (the probe stopped at 400), no dates beyond ISO, no log vocabulary, and no screen.

| File | What changed | Why | What output it affects |
|---|---|---|---|
| `src/past-registers.js` (new) | **Reader:** K1's workbook reader (every sheet, every row, cells by reference; `.xlsx` and `.csv`; `.xls` refused with "save it as .xlsx"). The header row is the one naming the most log columns. **The log's words:** reference (never the log's own "Sr"/"S.No"), subject, date raised / submitted, issued, reply due, replied / returned, status, consultant code, discipline, revision, remarks. **Dates:** Excel serial numbers (and the 1904 system), ISO, `3-Apr-2025`, and `dd/mm` / `mm/dd`. A log that writes one date only one way (13/01) settles its own order; if nothing settles it, each date that reads both ways is held with both readings, until DC says the order once. **Statuses and codes:** normalised against a versioned table (`status-1`): Code A–D, Open, Closed — answered, Withdrawn. A code the platform knows settles the status; an unknown status is held, by name, until DC says what it means or keeps it as written. **Every row** is reported as read, not read (a heading, no reference, another register's reference) or held. A row is held when its reference is listed twice in the log, is already on this project (raised here or imported before), has a date that is not a date or falls after the day the log was read, or has an unknown status. Rows brought in by this same file before are counted as already imported. The four counts add up to the sheet's rows. The highest reference and the gaps in the sequence are reported (§18). **Determinism:** the proposal is kept in `past_import` against the file's SHA-256, the reader and status-table versions, and the mapping. The same file read the same way returns the proposal already kept. The log itself is kept in the file store, so a remap needs no second upload. **Confirm:** every row read goes through K5's `importRecords`, with `imported_from` = the file, sheet, row, SHA-256 and reader. It is safe to run twice: a second import of the same log adds nothing. | v5 E12, the E-program condition, spec §17, §18 | Records, registers |
| `src/bills.js` | The workbook reader reports the 1904 date system. | Dates | — |
| `src/index.js` | `GET /api/past-registers` (the project's logs, or one log's report), `POST /read`, `/map` (DC's column mapping, status meanings and date order) and `/confirm`. Who: Document Control, the PM or the Principal on their own project, or AETRAA with `?p=`; the project in a request body is only a claim. Each log kind is refused while its module is switched off (an NCR log needs QA/QC). Audited. Page `/past-registers`. | v5 E12 (started and signed off by DC) | — |
| `src/html/past-registers.js` (new) | The screen: drop the log; how each column was read, with a choice for each; the date order; the statuses the platform does not know; every row with its outcome and reason; the sequence gaps; Bring in. | E12 steps 1–3 | New page |
| `src/html/app.js` | "Past registers" in Document Control's menu (CONTROL), opening `/past-registers`. Edited directly: `gen-app.mjs` is not in this folder. | — | DC menu |

**Tested:** `tools/test-k6-past-registers.mjs`, 43 checks:
- **Dates:** a serial, the 1904 system, ISO, 13/03 settling the order, 03/04 reading both ways and then one way, `3-Apr-2025`, "TBC" refused. The log's "Sr" is never the reference.
- **A 52-row RFI log** with a duplicate, a live collision, an unknown status, a non-date, a heading and a submittal reference:
  - each outcome, with its reason
  - the counts add up
  - the date order is settled by the log
  - serials and statuses are read
  - the sequence gap is found
  - reading it again returns the kept proposal
- **DC's corrections:** saying what "Pending with Arch" means reads that row; the replaced reading cannot be confirmed.
- **Confirm:** creates exactly the rows read, as closed imported records, with their source, facts, nothing in Needs my attention, and the next live RFI numbered RFI-0051.
- **A second import** of the same log finds every row already here and creates nothing.
- **A 450-row submittal log** is read whole, with the code column giving the consultant's code.
- **An ambiguous log** holds each date with both readings until DC says day first.
- **Refused:** a site engineer, another company's DC, an NCR log with QA/QC off, another project's log, and `.xls`.
- **Deterministic:** the same file gives the same proposal, row for row.

`tools/test-pg-k-series.mjs` adds K6 on PostgreSQL (read, confirm, re-import): 43 checks in all. Every other test still passes.

**For the owner:**
- **No golden fixture:** there is no real past log from Al Warqa'a (or any project) in the repository, so there is no golden fixture as v5's condition asks. The first real log should be checked on this screen, and kept as the fixture.
- **One record per reference:** a submittal log with each revision on its own row, under the same reference, holds those rows as "listed twice". Which revision should become the record is DC's to say, or Ajay's to decide.

## K7 · S0 and E14: submittals to the consultant and back — returned, issued by email, answered, revised

v5 S0 (submittals, method statements, materials and RFIs):
- Design prepares it on the consultant's form.
- The PM approves, or returns it to Design with comments.
- Document Control issues it from the platform to the consultant's email.
- DC records the reply.
- The code decides what happens next.

v5 E14 reads the returned Excel form. Before this change:
- Nothing emailed the consultant.
- A PM "Reject" dead-ended the record and threw the comment away.
- The code was free text, and any code closed the record (a Code C showed green and opened nothing).
- There was no revision, no comment checklist, no originator kept, and no reader for a returned form.

**Decisions made here** (each can be changed; none is a v5-versus-spec conflict):
- **A revision is its own record:** `SUB-001 Rev 1`, with the same number, linked back (`revision_of`). Every register, attachment, report and K5's numbering keeps working by reference.
- **Code C and Code D both open the next revision.** S0 step 6 says C/D; E14, A3 and A7 mention only C, and S0 is the governing workflow.
- **The PM's reject before issue sends it back to Design** ("Returned to Design"), and a comment is required.
- **Issuing and recording the reply are Document Control's.** The PM and Principal, who may sign any internal step, do not issue.
- **The email:** To and Cc are kept per project; the default To is the consultant party's contact. Both are editable on each issue, are checked as addresses, and are capped at 30. The email is sent from the platform address with DC's name, Reply-To DC.
- **The size limit:** the files go up to 7 MB (an Azure message takes 10 MB once encoded). Over that, or with email off, DC records the issue as made by hand, with how.

| File | What changed | Why | What output it affects |
|---|---|---|---|
| `src/s0.js` (new) | The S0 statuses (Prepared, Returned to Design, Approved internally, Issued for approval with the date, then the code) are derived from the ladder's issue and reply markers, not step names. `returnToDesign`, `resubmit` (what changed is required; internal comments answered). `issueRecord`: by email with the filled form and the chosen files, or by hand; records To, Cc and the files, starts the reply-by clock. `recordReply`: the code is checked (A–D; an RFI is Answered); the reply date can be neither after today nor before the issue; a C or D must carry its comments. The consequences are applied on the server:<br>- **A:** closed<br>- **B:** closed, comments kept<br>- **C or D:** closed, and the next revision is opened with the comments as Design's open checklist<br><br>The reply is emailed to the originator, the PM(s) and the Cc list, with the returned file. `answerComment` (answered, or does not apply, both with words). **E14** `readReturnedSheet`: in the consultant's section, it reads the code ticked (an X, ✓ or ☑ in or beside the option), the reply date (read as K6 reads dates; an ambiguous one is named, never converted), the comments and the reference (from the form's own reference field). Two ticks, no tick or a wrong reference are reported, not guessed. Each read is kept with the file's SHA-256 and the reader (`e14-1`), and DC's confirmation is kept beside it (`reply_reads`). Tables `record_comments`, `reply_reads`; `projects.issue_to` / `issue_cc`. | v5 S0, E14 | Submittals, MS, materials and RFIs |
| `src/records.js` | New columns through `addColumns`: `code`, `replied_on`, `rev`, `revision_of`, `originator_id`, `issued_to`, `issued_on`, `returned`. Returned with each record. | S0 | Records |
| `src/index.js` | `sendEmail` takes Cc, attachments, a sender name and Reply-To (Resend). The record route keeps who raised an S0 record. The advance route follows S0 for these four types:<br>- reject before issue returns the record to Design<br>- it is not approved while returned, or while the consultant's comments are open (for everyone)<br>- the drawer's Issue button records an issue by hand<br>- the drawer's code dropdown records the reply<br>- issue and reply are DC's<br><br>The submittal desk: `GET /api/s0`, `POST /api/s0/resubmit`, `/answer`, `/issue`, `/read-reply` (the returned form is kept on the record and read), `/reply`, `/issue-list`; all audited. Page `/s0`. `filledFormFor` shares "Generate document"'s filling with the issue email. | S0 | — |
| `src/email-azure.js` | Cc, attachments and Reply-To on the Azure driver. Azure sends from the domain's configured sender, so the per-message name applies on Resend only. | S0 step 4 | Email |
| `src/html/s0.js` (new) | The submittal desk:<br>- where it stands, with the timeline and what was sent to whom<br>- the comments, with Answered or Does not apply<br>- Returned to Design → Resubmit<br>- the issue: To, Cc, files, by email or by hand<br>- the reply: read the returned form, then code, date and comments<br>- after a C or D, the screen opens Rev 1 | S0 | New page |
| `src/html/app.js` | The record panel links S0 records to the submittal desk. Edited directly. | — | Record panel |
| `src/attention.js` | A record returned to Design, or a revision with open consultant comments, is the originator's or Design's to do, not the approver's. | S0 step 3, A3 step 3 | Needs my attention |
| `src/report-extras.js` | The reports use the recorded issue date and the consultant's own reply date. | S0 | Weekly and monthly reports |

**Tested:** `tools/test-k7-s0.mjs`, 45 checks, following SUB-001 the whole way round:
- **Raised:** "Prepared", with the originator kept.
- **Returned:** the PM's return needs a reason and gives "Returned to Design"; the PM is then blocked. It is the designer's to do; the resubmission needs what changed; then "Approved internally".
- **Issued:**
  - the PM cannot issue
  - To and Cc refuse a non-address
  - over 7 MB is refused and nothing is marked issued
  - with email off, it offers issuing by hand
  - issued by email: to the consultant, Cc as edited, "The DC (Document Control) via AETRAA", Reply-To DC, the filled Word form plus the chosen PDF
  - "Issued for approval" with the date, and the clock running
- **E14:**
  - code C, the date, two comments and the reference are read, identically twice
  - two ticks are not guessed
  - another submittal's form is refused
  - the proposal is kept against its hash, and DC's confirmation kept beside it
- **The reply:** a code Z is refused; a C without comments is refused. Code C opens Rev 1 (same number, linked, same originator, two open comments), and the reply is emailed to the designer, the PM and the Cc list with the reply attached.
- **The PM is held:** blocked on Rev 1 with 2 open, the designer's to-do; an answer needs words; one answered and one not applicable; then the PM approves.
- **Issued by hand:** needs to say how.
- **Code B:** closed, the comment kept, no revision.
- **Code D:** opens a revision too.
- **The drawer:** its Issue button records an issue by hand.
- **An RFI** is "Answered" from the drawer as before.
- **The tracker export** carries the S0 statuses.
- **The desk page** opens.

`tools/test-pg-k-series.mjs` adds S0 on PostgreSQL: 47 checks in all. Every other test still passes, including Girish's schedules and A9/A13, and the demo seed builds.

**For the owner:**
- **No returned forms in the repository.** There are no real returned consultant forms (Al Warqa'a's or any other), so E14 is built and tested on forms made in the shape the review describes. The first real returned form should be read on the desk, and kept as the fixture.
- **The material ladder** still has the QA/QC step that v5 A7 removed. That is left for K12, which is the material workflow.

## K8 · E15 Timesheets: subcontractors' manpower into the diary, the manpower log and exact HSE man-hours

v5 E15:
- Site or HSE drops a subcontractor's daily timesheet.
- The platform reads trade, headcount and hours.
- Site reviews, and the diary's manpower is filled. The manpower log and the HSE man-hours follow from it.
- The PM submits the diary as before.

Before this change:
- Nothing read a timesheet. Site typed the gang lines by hand.
- The diary's subcontractor gangs never reached the manpower log, so the dashboard chart and the reports showed own staff only.
- The HSE man-hours counted every gang at the standard day, whatever hours the diary gave, and were rounded to whole hours.

**Decisions made here** (each can be changed; none is a v5-versus-spec conflict):
- **The HSE man-hours from the diary use each line's own hours.** They are counted in hundredths of an hour and shown to 2 decimals. The standard day is used only where a line gives no hours. This changes the HSE figures for any existing diary whose lines carry typed hours.
- **Subcontractor gangs go into the manpower log**, marked with the subcontractor (a new column, `manpower.subcontractor`). The dashboard chart and the daily and monthly reports now include them.
- **Applying a timesheet replaces only that subcontractor's gang lines for that day.** It never adds to them. Every other part of the diary is saved as it stands, including "prepared by".
- **A submitted diary is revised, not overwritten.** Applying to it needs a reason, and the version as submitted is kept (the diary's existing version history).
- **Trades are kept as written.** There is no mapping to a trade list, and no fuzzy matching.
- **Workers of one trade on different hours become separate lines** (5 scaffolders × 9 h, 1 × 9.5 h), so the man-hours are exact, never averaged.
- **Nothing is guessed.** These are held for the person, with the reason:
  - a total that does not divide evenly among the men
  - a row with no trade or no hours
  - a sheet that names no subcontractor
  - a date that reads two ways

  The date never defaults to today. Site says whose sheet it is, or which day, and reads it again.
- **Who:**
  - Site, HSE, the PM and the Principal; a QS may not
  - the owner, manager and site code seats
  - the AETRAA Admin

  The routes sit under `/api/diary`, so the Site module's switch covers them.

| File | What changed | Why | What output it affects |
|---|---|---|---|
| `src/timesheets.js` (new) | **E15 reader (`timesheets-1`).** Finds the header row: name, ID, trade or designation, count, hours, normal, OT, total, time in and time out. Reads two layouts:<br>- one row per worker: hours, normal + OT, or time in and out (07:00, 4:30 pm, 0730, an Excel fraction)<br>- one row per trade: count × hours per man, or total hours<br><br>The subcontractor and the date are taken from the cells above the header. Every row is reported as read, not read (totals and signature rows) or held, with the reason. Hours are held in hundredths. **Kept:** each read is stored with the file's SHA-256, the reader version and the options given (`timesheet_reads`), and the file goes to the store under `timesheets/<project>/…`. The same file with the same options returns the kept read. **Applied:** `applyRead` refuses a read with anything held. For each subcontractor and day it replaces that subcontractor's gang lines, saves every other diary field as it stands, and marks the read applied. | v5 E15 | Daily diary, manpower log, HSE monthly |
| `src/diary.js` | `ensureManpowerSub` adds `manpower.subcontractor` through `addColumns`. Saving the diary keeps the log in step:<br>- the staff lines replace only own-staff rows<br>- the gang lines replace only subcontractor rows, each marked with whose it is<br><br>The diary's own-staff seed reads own-staff rows only. | E15 | Manpower log, dashboard chart, reports |
| `src/hse-monthly.js` | The diary basis counts each line at its own hours, falling back to the standard day. Man-hours are summed in hundredths and shown to 2 decimals: period, to date, and since the last LTI. | E15, §27 rule 5 | HSE monthly report |
| `src/index.js` | The site's own manpower post replaces only own-staff rows, never a subcontractor's gang. New routes, all audited (`timesheet.read`, `timesheet.apply`):<br>- `GET /api/diary/timesheets` (`?day=`)<br>- `/one`<br>- `POST /read`<br>- `POST /apply`<br>- `GET /api/diary/manpower.xlsx`: "Manpower by trade and day", own staff and each subcontractor, with the X1 header<br><br>Page `/timesheets`. | E15 | — |
| `src/html/timesheets.js` (new) | The timesheets page:<br>- drop the sheet<br>- say whose it is or which day, if the sheet does not<br>- each subcontractor and day, with the lines, the men and the man-hours<br>- every row not read or held, with the reason<br>- "Put it in the diary", with a reason box for a submitted diary<br>- the manpower Excel for a range of days | E15 | New page |
| `src/html/diary.js` | A "Timesheets" button in the diary's top bar. | E15 | Daily diary |

**Tested:** `tools/test-k8-timesheets.mjs`, 33 checks:
- **Times:** 07:00, 16:30, 0730, 4:30 pm and an Excel fraction.
- **Reading:**
  - Al Noor Scaffolding's per-worker sheet: the subcontractor and 15/09/2026 are read from above the header. The foreman is 9 + 1 OT. Five scaffolders are at 9 h and one at 07:00–16:30 (9.5 h). That gives 7 men and exactly 64.5 man-hours.
  - The worker with no hours is held; the total and signature rows are not read.
  - The same file reads identically twice.
  - Gulf Masonry's per-trade sheet: 3 × 7.5 + 2 × 8 = 38.5.
  - A date that reads two ways, and a sheet naming no subcontractor, are held, not guessed.
- **Into the diary:**
  - A QS and another company's engineer are refused.
  - The same sheet dropped again returns the kept read.
  - Applying replaces yesterday's 9-man scaffolding line, not adding to it, and leaves the staff, plant, works, weather and "prepared by" as they were.
  - HSE applies Gulf Masonry's sheet.
  - The HSE man-hours are exactly 119 (2 × 8 own staff + 64.5 + 38.5).
  - The manpower log carries both subcontractors beside own staff.
  - Applying twice adds nothing.
- **Held:** a sheet with no subcontractor and a two-way date is refused for the diary. Read again with both given, it reads.
- **Submitted:** after the PM submits, applying is refused without a reason. With one, the diary is revised and stays submitted. The version as submitted is kept with who changed it and why.
- **The Excel log, and the module wall:** the manpower Excel downloads with both subcontractors. With the Site module off, timesheets are refused.

`tools/test-pg-k-series.mjs` adds timesheets on PostgreSQL: read and kept, applied twice adding nothing, exactly 55 man-hours (2 × 8 + 3 × 7.5 + 2 × 8.25), the Excel log. That makes 52 checks in all. Every other test still passes, including Girish's, and the demo seed builds (it writes no diaries, so its figures are unchanged).

**For the owner:**
- **No real timesheet in the repository.** E15 is built and tested on sheets made in the two usual shapes. The first real subcontractor timesheets should be read on the page and kept as fixtures.
- **Old days are not backfilled.** Subcontractor gangs reach the manpower log when a day's diary is next saved; days saved before this change still show own staff only in the chart.
- **The HSE man-hours move.** Existing diaries whose lines carry hours other than the standard day will show different HSE man-hours from before, now exact rather than standard-day estimates.

## K9 · A1, A3, A6: the AI readers — scanned sheets, stamped replies, unusual forms; the model reads, a person commits

v5 A1, A3 and A6 are the three "AI — reading" workflows:

- **A1:** Document Control presses Read with AI on a scanned sheet. Only the title-block corner is sent. The number, revision, title, date and discipline come back, each with how sure. DC confirms or corrects each value, and the PM approves the sheet into the register.
- **A3 (S0 step 5):** a consultant's reply that came back scanned or stamped is read for the code, each comment with its drawing or clause and discipline, and the reply date. DC confirms with one click (S0 step 6). Excel and Word returns go to E14 (K7).
- **A6:** a consultant's form on which E10 or E16 found fewer than two fields. The AI proposes fields and signature boxes on the drawn form, and DC reviews and saves.

Before this change:
- Only authority stamps and missing numbers were read, by sending the whole sheet.
- No reply could be read unless it was an Excel or Word form.
- A form the extractor could not place offered nothing.

**The rules every reader keeps** (v5 "AI must never", spec §27 rule 9):
- **A reader only proposes.** Each proposal is kept on its own (`ai_proposals`), apart from every value read by rule. It records the model, the prompt version, and what was sent with its SHA-256.
- **Nothing in a register, record or template changes until the person confirms.** The confirming route runs the checks again on the server; it does not trust the page.
- **The checks around the model are deterministic:**
  - the number's pattern, and the project's numbering
  - the revision order against the register
  - the reference matching the record
  - dates read as K6 reads them; a date that reads two ways is put to the person, never resolved (§18)
- **AI never overwrites a value read by rule.** The number or title from the file name and a value DC typed are kept, and the AI's differing value is flagged. Only the person may type over it.
- **With AI off (or the project's AI module off):**
  - no AI button shows
  - every route says so and writes nothing
  - every screen works as before
- **Every call goes through `src/ai.js` `callModel`**, logged with its cost.

**Decisions made here** (each can be changed):
- **The corner is the strip E4 reads** (`sheet-reader.js` `titleBlockFields`: the right 22% of the sheet, the bottom 36%). It is rendered and cut out as its own PNG (`sheet-corner.js`; pdf.js on `@napi-rs/canvas`, already installed with pdf.js). A CropBox PDF was not used, because it hides the rest of the scan but still carries it. A server without the canvas library refuses rather than sending the whole sheet. The page's own rotation is applied. The image sent is kept and shown beside the values, so DC checks against exactly what the AI saw.
- **"A scan"** is a PDF with no text the title-block reader could use (the gate's `readable()` test), or a picture. A vector PDF whose lettering is drawn as lines also counts, which is right: E4 cannot read it. A sheet with text is refused ("E4 reads it").
- **Where A1 runs:**
  - on the drawing register, for a sheet still awaiting the PM (DC's own uploads)
  - on the intake review, for a scanned sheet in a drop (the AETRAA Admin's screen)

  An approved sheet is not read; it is the PM's.
- **A sheet whose values the AI read waits for the PM, whoever files it.** This applies even when the Admin files it, though the Admin's sheets otherwise go live at once (A1 step 3; "the AI never approves a drawing").
- **One-click taking** is offered only where nothing is kept and no check blocks. A low-confidence value is offered but not pre-ticked. An older revision, or a number outside the project's numbering, is flagged but not blocked: DC decides, and the gate still holds a foreign number at filing.
- **A3 on one click:** offered only when the reading passes every check: this record's reference, a code the record takes, a date between the issue and today, and comments with a Code C or D. Anything else is put in the reply form for DC to record by hand. One click applies K7's `recordReply` exactly as the manual form does: Code C/D opens the next revision with the comments as Design's checklist, and the reply is emailed.
- **What A6 sends:** the cell text and positions, never the file (v5 A6 step 1). The extractor is run again on the stored original before the AI is offered. A form it reads two or more fields on is refused, and no proposal may touch a field the extractor read. Each proposal is checked against the drawn form: a real cell, inside the form, blank, the first cell of a merged block, not proposed twice. What fails is listed with the reason. DC's saved fields keep "proposed by AI" against them. The signature boxes DC keeps are stored in the sign map (`ai`), outlined in blue in Signature boxes, where DC says which step signs in each. They survive later field edits.
- **Who:**
  - A1 and A6: Document Control (and the AETRAA Admin). The PM and Principal also keep templates, but v5 makes A6 DC's.
  - A3: the reply step's owner, Document Control, as K7.
- **The readers live in a new `src/ai-readers.js`**, not `src/ai-tasks.js`, which the work-split named. That keeps clear of Girish's G12/G14 additions to `ai-tasks.js`.

| File | What changed | Why | What output it affects |
|---|---|---|---|
| `src/ai-readers.js` (new) | **The store:** `ai_proposals` (the reader, the target, the model, the provider, the prompt version, what was sent and its SHA-256, the proposal, state, who decided and what was applied). `firstJson` for the answer, and `dateOf` (K6's `readDate`, "March 14, 2026" too, two readings reported). **A1:** prompt `a1-1`, `parseSheet`, `checkSheet` (pattern, project numbering via `checkIncoming`, revision order via `revCompare`, kept values, blocking or warning flags), `readSheetWithAI`, `settleSheet` (re-checks what the person chose). **A3:** prompt `a3-1` per record type, `parseReply`, `checkReply`, `readReplyWithAI`. **A6:** `formPayload` (cell text and positions), prompt `a6-1`, `parseForm`, `checkForm`, `findFieldsWithAI`. | v5 A1, A3, A6; §27 rule 9 | — |
| `src/sheet-corner.js` (new) | `titleBlockCorner` cuts the title-block strip out of page 1 of a PDF (rendered) or out of a PNG/JPEG, at most 1,400 px. `isScanned`. A TIFF is refused with what to do. | A1 step 1 | What is sent to the model |
| `src/ai.js` | **Images:** an image (`image/png`, `image/jpeg`) goes to the API as an image block, and to the subscription as a `.png`/`.jpg` file the CLI reads. **Windows:** `claude.exe` is found where it is installed (`~/.local/bin`, or npm's `@anthropic-ai/claude-code/bin`) when `CLAUDE_BIN` is not set, because Node cannot start the `claude.cmd` shim without a shell. All additive; nothing else changes. | A1; "works on the subscription locally" | AI calls |
| `src/drawings.js` | New columns through `addColumns`: `scanned`, `sheet_date`, `read_by_ai`. **Uploads:** a new upload is marked a scan when its PDF has no readable text, or when it is a picture. The text read once serves both the gate and this mark. **Pending:** a sheet filed with AI-read values is pending for the PM whatever the filer's role, and nothing is retired until it is approved. `applySheetToDrawing` writes confirmed values only to a sheet awaiting approval. The register lists the new columns. | A1 steps 2–3 | Drawing register |
| `src/intake.js` | **Scans:** a scanned drawing in a drop is marked `scanned`. The review shows `scanned`, `revision`, `title`, `sheet_date` and `ai_read`. **A1 for items:** `getItemOn`, `itemSheetValues` (what the item says and where each value came from) and `applySheetToItem` (confirmed values, each with "title block (AI, confirmed by …)" or "typed by …"; a failed sheet that now has its number goes back to be filed). **Stamp reader:** with AI off it now refuses and marks nothing as tried. Before, pressing it with AI off marked every sheet as tried for good. With AI on it behaves exactly as before. | A1; AI-off | Intake review |
| `src/template-forms.js` | **Sign map:** carries `ai` (DC's kept AI signature boxes). **Field save:** `updateFields` marks the fields kept from an AI draft `by: 'ai'` and keeps the AI boxes through every later save. | A6 step 2 | Templates |
| `src/template-extract.js` | `tokenOf(label)`: E10's own label-to-token rule, exported for A6's fields. E10's results are unchanged. | A6 | — |
| `src/s0.js` | Comment ids now sort in the order the comments were made. Two comments recorded in the same millisecond used to come back in random order, a K7 bug found by this test. | S0 step 6 | The comment list on the submittal desk |
| `src/index.js` | **A1** (under `/api/ai`, so the project's AI module covers it):<br>- `POST /api/ai/sheet` reads a sheet: an intake item, or a register sheet awaiting approval<br>- `POST /api/ai/sheet/confirm` takes values, types over them, or discards the reading<br>- `GET /api/ai/corner` returns the image that was sent<br><br>**A3:** `POST /api/s0/ai-read` and `/api/s0/ai-confirm`; the desk says whether AI is on (`ai_on`).<br>**A6:** `POST /api/templates/ai-fields`; `POST /api/templates/fields` takes `proposal_id` and `ai_signs`; the template list says `ai_fields`.<br>**Elsewhere:** the register says `ai_read`, and the intake filer passes `ai_read`, `scanned` and `sheet_date` to `saveDrawing`.<br><br>All audited (`ai.sheet.read`, `ai.sheet.confirm`, `ai.reply.read`, `record.reply` "read by AI, confirmed by …", `ai.fields.read`, `template.fields`). | A1, A3, A6 | — |
| `src/html/ai-read.js` (new) | The A1 panel, shared by the register and the intake review:<br>- the corner image beside each value, how sure, and the checks<br>- **use it** for what the AI read, or type it<br>- Confirm or Discard | A1 step 2 | New panel |
| `src/html/drawings.js` | "Read with AI" on a scanned sheet awaiting approval (DC, with AI on). Each row shows "title, date read by AI, confirmed by …" and the sheet's date. | A1 | Drawing register |
| `src/html/intake.js` | "Read with AI" on a scanned sheet in the review, and the provenance once confirmed. The stamp reader's button shows only with AI on. | A1 | Intake review |
| `src/html/s0.js` | The reply upload takes a PDF or picture too. "Read with AI" shows the draft, its checks and each comment's drawing or clause. Confirm records it with one click. Otherwise the manual form is filled in from it. | A3 | Submittal desk |
| `src/html/templates.js` | "Find fields with AI" on a form with fewer than two fields read. The field editor opens with the AI's fields marked **AI**, its signature boxes to keep or not, and what was not used with the reason. | A6 | Templates |
| `src/html/signboxes.js` | DC's kept AI signature boxes are outlined in blue and named. | A6 | Signature boxes |

**Tested:**

`tools/test-k9-ai-readers.mjs`, 77 checks, with a fake model whose every request is inspected; three runs alike.
- **The checks:** revision order, two-way dates, kept values, and a scale that is not a number.
- **A1:**
  - With AI off, there is no button, the route refuses, and nothing is written. The stamp reader marks nothing as tried.
  - A site engineer is refused, and another company's DC cannot reach the sheet.
  - What was sent is one PNG of the corner's shape, with no PDF in the request. The corner can be shown back. The call is logged with its cost.
  - Nothing reached the sheet before confirmation. Taking the AI's number over DC's typed one is refused, and nothing is saved.
  - Confirmed: title, date and discipline from the AI, the revision typed, each marked so. The sheet stays pending, and a reading is confirmed once.
  - The PM approves. The register shows "confirmed by The DC" and the sheet's date, and an approved sheet is not read again.
  - A two-way date is held and then typed. An older revision is flagged. A text PDF is refused. An answer in the wrong shape changes nothing.
- **A1 in a drop:**
  - A file name's number is kept, with the AI's flagged.
  - A scan with no number gets it from the AI. The file name's title is kept, and DC types the title.
  - Filed by the Admin, it is still pending, with its date, scan mark and provenance.
- **A3:**
  - With AI off it is refused. The PM is refused, and an attachment from elsewhere is refused.
  - The code, date and comments are read from the PDF as uploaded, and nothing is recorded before confirmation.
  - Another record's reference, or a two-way date, is not offered and is refused if pressed.
  - One click records Code C and opens Rev 1, with the comments' drawing, clause and discipline as Design's checklist. It is not applied twice.
- **A6:**
  - With AI off it is refused. The PM is refused.
  - Two fields and one box are kept. A label cell, an outside cell and a duplicate are dropped with the reason.
  - Only cell text and positions are sent, with no file. The form is unchanged until saved.
  - Saved: the AI's fields are marked AI, DC's own are marked DC's, and the kept box survives a later edit. A draft is saved once.
  - A form the extractor read is refused.
- **The AI module off:** A1 and A6 are refused and the register offers no button. Every call went through `callModel` and was logged.

`tools/k9-subscription.mjs`: the three readers on the Claude subscription (`AI_PROVIDER=subscription`, claude-sonnet-5-5), run on this Windows machine. `claude.exe` was found without setting anything.
- **A1:** read A2-301, P3, "TYPICAL FLOOR PLAN LEVELS 3 TO 7", 14 MAR 2026 → 2026-03-14 and Architectural off the corner of a scanned A1 sheet, all "high", in 8 s.
- **A3:** read Code B, today's date and both comments with "S-201" / "Clause 3.2" and Structural off a scanned stamped reply, in 6 s.
- **A6:** proposed the two boxes and the contractor's signature box on the unusual form, in 6 s.

The logged API-equivalent costs were USD 0.057, 0.040 and 0.019. Nothing was applied in any of them.

`tools/test-pg-k-series.mjs` adds A1 (scan mark, proposal, confirmation, still pending) and A3 (one click) on PostgreSQL: 56 checks in all. Every other test still passes (Girish's included, and K7's 45), the 63 page scripts parse, and the demo seed builds.

**For the owner — left for a decision, not built:**
- **P1 step 2a (the project check on scans).** A1 was approved "including the project check, step 2a": the AI would read the plot or project from a scanned title block, and mismatches would be parked. Spec §5 and §4 put OCR of scanned sheets out of v1, and §27 rule 9 says model output is never a classification nor an input to another rule. That is a v5-versus-spec disagreement, so it is not built. A scan is still never parked by the gate (it says nothing either way). Ajay to decide.
- **The existing stamp reader** (`/api/intake/stamps`, built at Ajay's request on 5 Oct) still:
  - writes the AI's authority, approval number and date onto sheets already filed
  - moves a failed sheet to "confirmed" with no person
  - replaces the authority read from the folder
  - reads a two-way date day-first (`parseStamp`)

  Each is against A1's rules and §18. Bringing it under them would change what Ajay asked for and break `prelaunch/authority-check.mjs` (not my test; it also needs Ajay's own project folders, so it cannot run here). Only its AI-off fault is fixed. Girish or Ajay to decide.
- **A3 for inspections (WIR/MIR).** v5 A3 has DC record a returned inspection. The platform's inspection ladder has QA/QC record the result. A3 is built for the four S0 types (submittal, method statement, material, RFI); inspections wait for that decision.
- **A6 and PDF forms.** v5 A6 read literally takes any form with fewer than two fields, which includes PDFs. A PDF is never a template (spec §6; K4 left PDF reference forms for Ajay), so A6 covers Excel and Word.

**Also for the owner:**
- **Sheets loaded before this change** carry no scan mark, so they offer no Read with AI. They are marked when uploaded or dropped again.
- **No DC drop screen.** A DC who drops a set has no intake screen yet (E3's "drops the drawing set on Drawings"; the intake review is the Admin's). A1 is on the register for the DC's own uploads.
- **Scanned askew.** A scan turned inside its own picture (not by the page's rotation) has no title block in its corner. The AI then returns empty, low-confidence values, and nothing is taken.
- **No real scans or stamped replies in the repository.** The first real scanned sheets and stamped replies should be read on these screens, and kept as fixtures.

## K10 · A2: the correspondence register — every letter in and out, overdue first; a dropped letter read by rule, the AI filling the gaps

v5 A2:
1. Document Control drops the letter. The extraction program reads its text where it has some, and finds the records it names (RFI, VO, drawing numbers). The AI reads the sender, their reference, the date, subject, type and who must act, and writes a two-line summary.
2. DC edits and logs it. The reply-by comes from the project's reply period, and the action owner is told.
3. The action owner replies or closes it with a reason.

**Outgoing:** every letter DC issues is logged and stored, and closes the incoming letter it answers.

**The log:** one correspondence register, in and out, overdue first, with the columns Ref, In/Out, Date, From / To, Their ref, Subject, Action by, Reply-by, Answered by and Status.

**AI must never:** log, route, reply to or close a letter by itself.

**Already there before this change:**
- the typed "Log incoming letter" form (IN-00x)
- the reply-by from the project's period
- telling the action owner
- closing with a reason
- a reply letter, once issued, closing the letter it answers

**New in this change:**
- reading a dropped letter
- the summary and the linked records
- DC logging a letter signed outside the platform
- keeping every issued letter
- the register's columns and order, on screen and in Excel

**Decisions made here** (each can be changed):
- **The rules read first** (spec §6 reads a letter's reference, subject, date and an email's headers by rule):
  - "Our ref", "Subject" or "Re", "Date", and an .eml's From, Date and Subject
  - an .eml is an Email

  The AI fills only what the rules left empty. A different AI value is shown beside the rule's and never used, as A1 does. This reconciles v5 A2 (the AI reads them) with spec §6 (the rules read them); nothing is lost either way.
- **Linked records** are only references the letter states that exist on this project (§6 "reply chains are proposed, never assumed", §29). The reading is kept on the server; the record's "Linked records" is written from it, never from the page. A reference not on this project is listed beside the reading, not linked.
- **An Arabic letter** is detected and filed, not sent to the AI or summarised (§23 "detect, never translate"). DC types its details. A scan whose language only the AI can see is dropped from the AI's reading if the AI says it is Arabic.
- **What is sent:** a letter with text goes to the model as its text, not the file. A scan goes as the PDF or picture. An Outlook .msg is kept but not read; save it as .eml or PDF. Which model letters may go to is spec D8, a deployment setting: everything goes through `callModel`, whatever is configured.
- **Where it starts:** the drop is on the correspondence page (a live letter with a reply clock), not through intake (which files letters to the library with no clock, §17). The same file dropped twice is the reading already kept, and says "already logged as IN-00x".
- **Outgoing letters:**
  - **Drafted here:** issuing it stores the letter as issued on the record. That is the consultant's letter form filled and signed, or, with no letter form, a plain PDF of what was issued.
  - **Signed outside the platform:** DC logs it with its signed copy (required). It becomes an LTR record already issued, with no reply clock, closing the letters it answers on the day it went. This is a separate DC route; who may draft a letter (Design, Commercial) is unchanged.
- **The columns:**
  - **Date:** received (incoming, the day the reply clock runs from) or issued (outgoing).
  - **Their ref:** the sender's reference (incoming), or the reference of the letter it answers (outgoing).
  - **Action by and Reply-by:** incoming only; Reply-by while it is open.
  - **Answered by:** the letter or letters that answered it, or "closed — <why>".
  - **Order:** overdue first (most overdue first), then newest.
  - **Imported letters** (K5) are listed and never overdue.
  - **CVIs** (issued to the consultant) are listed as outgoing, as the letters Excel already listed them.
- **The screen is a page of its own,** `/correspondence`, rather than a rework of the dashboard's generic register. The DC menu's "Incoming / outgoing" and the incoming card open it. The dashboard's letters Excel button now gives the same register.

| File | What changed | Why | What output it affects |
|---|---|---|---|
| `src/correspondence.js` (new) | **Text:** `letterText`: PDF (pdf.js, line by line), Word, .eml (headers, plain or HTML part, base64 / quoted-printable, encoded words), text; .msg named, not read; a picture or a PDF with no text is a scan. **By rule:** `findReferences` (every record reference by prefix and number, drawing numbers apart, sorted) and `matchReferences` (linked if on this project); `ruleFields` (§6); `isArabic`. **AI:** prompt `a2-1` with A2's "must never", `parseLetter`, `draftOf` (rules first, AI fills gaps, bad dates, types and roles not used). **Kept:** `readLetter` keeps the file and the reading (`letter_reads`, against SHA-256 and reader `a2-read-1`), logging nothing; `provenanceOf` and `markLogged`. **The register:** `correspondenceRegister` (the ten columns, overdue first). **Outgoing:** `checkOutgoing` and `letterPdf`. | v5 A2 | Correspondence register |
| `src/index.js` | **Routes:**<br>- `GET /api/letters` (the register and what this person may do)<br>- `POST /api/letters/read` (drop: read, kept, nothing logged)<br>- `GET /api/letters/read`<br>- `POST /api/letters/outgoing` (DC: a letter signed outside, with its copy)<br>- `GET /api/letters/register.xlsx`<br><br>**`POST /api/records`** with `read_id`: links from the reading, the letter kept on the IN record, the reading marked logged (once). **The issue step** of a letter keeps it as issued. `/api/register/xlsx?reg=letters` gives the correspondence register. Page `/correspondence`. Audited: `letter.read`, `letter.outgoing`. | A2 | — |
| `src/records.js` | `closeIncomingByReply` takes the day the reply was issued, for a letter logged after it went out. | A2 outgoing | Incoming letter status |
| `src/register-xlsx.js` | `correspondenceWorkbook`: the ten columns, overdue first ("Overdue N days — …"), the X1 header, and a Detail sheet with the summary, linked records and "in reply to". The letters register's title is "Correspondence register" (v5 A2's name for it). | A2 | Letters Excel |
| `src/html/correspondence.js` (new) | The register: In / Out filter, open only, search, overdue rows marked. **Log an incoming letter:** drop it (or type it in). Each value is shown with where it came from (read from the letter / read by AI, with how sure) and anything not used and why. The records it names, a summary box, Date received and Reply by, then Log it. **Log an outgoing letter signed outside the platform:** To, subject, type, date issued, our reference, signed by, in reply to, the signed copy. | A2 | New page |
| `src/html/app.js` | **Edited directly** (no generator in work/test-drive): the DC menu's "Incoming / outgoing" opens `/correspondence`, and the incoming card links to it. | A2 | Dashboard menu and incoming card |

**Tested:**

`tools/test-k10-correspondence.mjs`, 48 checks:
- **By rule:**
  - references (RFI, VO, SUB apart from drawing numbers; ISO 9001 not taken)
  - their ref, date and subject from a letter, and an .eml's headers
  - a two-way date not taken
  - Arabic detected
  - rules first, with the AI's different value kept aside and a bad date, type or role not used
- **AI off:**
  - Site is refused.
  - DC drops a PDF letter: their ref, subject and date read; the RFI and A1-101 linked; SUB-099 not on this project.
  - "AI is not switched on", with nothing sent to a model and nothing logged.
  - Logged typed: IN-001 with reply-by 7 days on, the links from the reading not the page, the letter kept, "read from the letter" and "typed" recorded, the PM emailed.
  - The same file again says "already logged as IN-001", and it cannot be logged twice.
- **AI on:**
  - An .eml: From, date and subject by rule, the AI's different From kept aside; their ref, who acts and the summary from the AI. The text went, not the file. Nothing was logged.
  - Logged: IN-002, with "read by AI, confirmed by The DC" per value, and the QS emailed.
  - An Arabic letter is not sent to the AI and not summarised.
  - A scan goes as the picture, and a two-way date from the AI is not taken.
- **The register:**
  - overdue first (3 days late)
  - the ten columns for an incoming letter
  - "for information" has no reply-by
  - a letter imported from the old system is never overdue
  - another company sees none of it
- **Outgoing:**
  - A reply drafted, signed by the PM (IN-001 still open) and issued by DC closes IN-001 and keeps "LTR-001 as issued.pdf". The register shows IN-001 answered by LTR-001, and LTR-001 out with their ref.
  - The PM cannot log what DC issued. No signed copy, a future date, or a reply to IN-099 is refused.
  - DC logs a letter signed outside: issued, no clock, its copy kept, IN-002 closed on the day it went.
- **The Excel and the page:** the Excel has its columns, overdue first, with the project header; the dashboard's letters Excel is the same; the page opens; every AI call is logged.

`tools/test-pg-k-series.mjs` adds the register on PostgreSQL (read, logged from the reading, outgoing closing it): 60 checks in all. Every other test still passes, including Girish's and the prelaunch's typed path (unchanged), the 64 page scripts parse, and the demo seed builds.

**For the owner:**
- **Arabic letters (spec §23 against v5 A2).** v5 A2 has the AI read and summarise every incoming letter. Spec §23 says Arabic is detect-and-file in v1, with no field extraction, and an English summary of an Arabic letter is a translation. They are detected and filed, and DC types the details. Ajay to decide.
- **D8 (customer documents to the Claude API).** D8 is still open, and incoming client and consultant letters are customer documents. The code sends them only through `callModel`, so whether the live server uses the API, the subscription or a self-hosted model is a setting, which Ajay's D8 decides.
- **Outlook .msg files** are kept but not read (no parser). Saved as .eml or PDF, they are read.
- **A deadline stated in a letter** ("reply within 3 days") does not replace the project's reply period. DC types a Reply by date when the letter sets one.

## K11 (A5) · Delivery notes and certificates with the daily diary; certificate expiry alerts. A4 (contract obligations) waits for Ajay

**This is half of K11.** K11 is two builds: A4 (contract obligations) and A5 (delivery notes and certificates). Only A5 is built here. A4 is not built, because it rests on a disagreement between v5 and the spec, and on one of Ajay's open decisions. The work-split says to stop and ask on both (see "For the owner").

v5 A5, as agreed on 5 Oct 2026, is part of the daily diary:
- The site or DC uploads delivery notes and certificates with the day's diary.
- They are read into the diary's materials received and the certificates register (type, number, expiry).
- The person confirms.
- An expiry raises an alert, and an expired certificate is filed and flagged, not refused.

**AI must never:** receive goods, or accept a certificate, by itself.

Before this change:
- Nothing could be uploaded with the diary. Its "Delivery of materials" kept only material, quantity and unit.
- Only HSE could log a certificate.
- The certificate form saved its expiry as "Expires", but the record's date was read only from "Valid until". So a logged certificate had no expiry date, exported a blank one and raised no alert.

**Decisions made here** (each can be changed):
- **Rules first, the AI fills the gaps** (as K9 and K10 do):
  - read by rule: a delivery note's number and date; a certificate's number, issue date and expiry ("Expiry", "Valid until", "Next examination due")
  - read by the AI: the supplier, each item with its quantity, unit and batch; the certificate's type, issuer and what it covers

  A two-way date is never taken. A certificate type outside the list becomes "Other", with the reason shown. A document with text goes to the model as text; a photo or scan goes as itself.
- **A confirmed delivery note** adds its lines to that day's "Delivery of materials". Each line carries the supplier, note number, batch and the note it came from (shown under the line and on both prints). Confirming the same note again replaces its own lines, never adds to them. Every other part of the diary is saved as it stands. A submitted diary is revised with a reason, and its submitted version is kept (as K8 does).
- **A confirmed certificate is filed** in the certificates register by the person who confirmed it: site, DC, HSE, QA/QC or the PM, as A5 agreed. Only HSE could raise one before. It is filed at "Logged", so **HSE still checks it**: the ladder is unchanged. Its expiry is the record's date, and the copy is kept on it.
  - **An expired certificate** is filed and flagged ("expired on …").
  - **With no expiry** it is "expiry not found" (spec §6).
  - **Refused:** an expiry before the issue date, or an issue date after today.

  It is filed only where the certificates register (HSE module) is on; a delivery note still works without it.
- **Expiry alerts:**
  - **On the list:** the attention list of HSE and the PM shows expired (overdue), within 30 days ("in N days"), and no expiry found.
  - **By email:** to the project's HSE and PM, once when a certificate comes within 30 days and once when it has expired (K3's send-once log). The period is the expiry date, so a renewed certificate is told about again.
  - **Old-system certificates:** none, for one brought in from the old system (K5: no clocks).
- **The certificate form's "Expires" now sets the record's date,** and the certificates Excel reads it. That fixes certificates typed on the form too.
- **Deferred, as A5's 5 Oct comment says:** matching to the MIR, the order, the BOM and the plant list, and BOM received quantities / the GRN log. The BOM routes' tenant wall, which the review flagged, was already closed by K1.

| File | What changed | Why | What output it affects |
|---|---|---|---|
| `src/diary-docs.js` (new) | **By rule:** `ruleDelivery`, `ruleCert`. **AI:** prompt `a5-1` for each kind with A5's "must never"; `parseDoc` and `draftDoc` (rules first). **Kept:** `readDiaryDoc` keeps the file and the reading (`diary_docs`, against SHA-256 and reader `a5-read-1`), receiving and filing nothing; the same file again is the kept reading. **Confirming:** `settleDelivery` (numbers checked; lines carry supplier, note number, batch and source) and `applyDelivery` (into the day's diary, the rest as it stands, a submitted diary revised with a reason); `settleCert` (expired flagged, no expiry listed, impossible dates refused). **Expiry:** `certExpiries` (expired / within 30 days / not found; imported left out). | v5 A5 | Diary, certificates register |
| `src/diary.js` | A delivery line keeps `s` (supplier), `dn`, `b` (batch) and `src` (its note). | A5 | Diary data |
| `src/diary-doc.js` | Both prints show the supplier, note number and batch beside the material. | A5 | Printed diary (PDF / Word) |
| `src/records.js` | A certificate's "Expires" sets its date (`due`). | A5; the form's expiry was lost | Certificates register, alerts |
| `src/register-xlsx.js` | The certificates Excel reads "Expires" and what the certificate covers. | A5 | Certificates Excel |
| `src/attention.js` | Certificates by expiry on the lists of HSE and the PM: expired, expiring in N days, no expiry found. | A5 expiry alerts | Needs my attention, morning digest |
| `src/alerts.js` | `runCertAlerts`: the email, once at 30 days and once on expiry, to HSE and the PM. | A5 expiry alerts; spec §22 "once" | Email |
| `src/index.js` | **Routes:**<br>- `GET /api/diary/docs?day=`<br>- `/file`<br>- `POST /read`<br>- `POST /confirm` (a delivery into the diary, or a certificate into the register)<br>- `POST /discard`<br><br>All audited (`diary.doc.read`, `diary.delivery`, `diary.certificate`). The 06:00 job runs the certificate alerts; `certAlertPeople` names HSE and the PM. | A5 | — |
| `src/html/diary-docs.js` (new), `src/html/diary.js` | The diary's "Delivery notes and certificates" card: upload (delivery note or certificate), check what was read, edit, then confirm or discard. Today's documents are listed with their state, and certificates expiring or expired are named. Delivery lines from a note say so under the line. | A5 | Diary screen |

**Tested:** `tools/test-k11-diary-docs.mjs`, 40 checks:
- **By rule:** a note's number and date; a certificate's number and expiry, with a two-way issue date not taken; the AI only filling gaps.
- **A delivery note, AI off:**
  - A QS is refused.
  - Site uploads it: the number read and nothing received.
  - A quantity that is not a number is refused.
  - Confirmed: the line has supplier, note, batch and source, and the rest of the diary is as it was.
  - It is confirmed once. The same file again says so. The printed diary shows the supplier and note.
- **A delivery note, AI on:**
  - A photo goes as the picture.
  - The diary is submitted, and confirming without a reason is refused.
  - With a reason, both lines are added and the submitted version kept. "Read by AI" is recorded for the supplier.
- **Certificates:**
  - A crane certificate: number and expiry by rule, the rest by AI, nothing filed until confirmed. Site files it: CERT-001 dated by its expiry, the copy kept, HSE still to check.
  - **Before it lapses:** HSE and the PM are alerted "Expires on … (in 20 days)", and site is not.
  - The morning email goes to HSE and the PM once, not again the next day.
  - An expired certificate is filed and flagged, overdue on HSE's list, and emailed once. One with no expiry is filed as "expiry not found" and asks for it. An expiry before the issue date is refused.
  - A certificate typed on the form takes its "Expires" as its date. The certificates Excel shows the expiry. A certificate imported from the old system carries no alert.
- **Walls:** another company is refused. With the AI module off, a document is read by rule only. With HSE off, no certificate is filed. The diary page carries the card. Every AI call is logged.

`tools/test-pg-k-series.mjs` adds A5 on PostgreSQL (note into the diary, certificate filed with its expiry, listed as expiring): 64 checks in all. Every other test still passes (Girish's included), the 65 page scripts parse, and the demo seed builds.

**For the owner:**
- **A4, contract obligations: not built, waiting for Ajay.**
  - **v5 against the spec.** v5 A4 has the platform split the whole contract by clause and the AI list every obligation. Spec §3 says the seven contract terms are "the only values read from the contract", and "the rest of the contract is filed in the library and read by people, not by the engine".
  - **D8.** Sending contract text to the Claude API is Ajay's open decision D8.
  - **A13.** What the Principal's approval "applies" (A13's reply-by clocks and notice reminders) is in A13, which v5 marks "later".

  The work-split's instruction is to stop and ask on each. To do once Ajay answers:
  - a line-keeping clause splitter (the reader `correspondence.js` now has for letters can serve)
  - an obligations table with clause, verbatim quote (checked to be verbatim), who it binds and the period
  - QS confirmation and Principal approval on G1's pattern
  - the register with its Excel
- **Who may file a certificate.** A5 as agreed lets site and DC file what they confirm, while the register stays HSE's (HSE checks each one). If quality certificates (mill certificates, test reports) should be QA/QC's to check rather than HSE's, that is a change to the certificate ladder.
- **The 30-day lead and who is told** (HSE and the PM) are choices made here; spec §22 lists no certificate rule.
- **Imported certificates carry no expiry alert** (K5's "no clocks"). If old certificates still on site should be alerted, that is a change to K5's rule for certificates only.

## K12 · A7: the material submittal package — catalogue and spec section in, a checked package out, then S0

v5 A7: the design engineer starts "+ Material submittal" (or a due P3 item) and drops the supplier's catalogue.
1. The platform finds the spec section (E13), the BOQ line and the approved manufacturers, and collects the section's clauses.
2. The AI prepares the package: the consultant's form, the compliance statement (Spec clause, Requirement, Submitted, Complies Y/N/Partly, Deviation, Catalogue page), the method statement, the technical explanations, highlighted catalogue pages, certificates and contents. The result is one PDF plus the form.
3. The engineer reviews on one screen, where every line links to its source page. They edit and regenerate sections.
4. Completing the package forms Rev 1, and Rev 0 is kept.
5. Generate → Check → Confirm & submit.

Then S0 (K7): the PM approves, DC issues, the reply is read, and Code C opens the next revision.
- **No QA/QC step:** the PM can add one.
- **A brand not on the approved list** is labelled "Alternative / equivalent".
- **AI must never:** submit, approve or issue; invent a figure not in the catalogue or specification.

Before this change:
- "+ Material submittal" opened the generic form.
- The material ladder still had the QA/QC step v5 removed.
- Nothing prepared a package.

**Decisions made here** (each can be changed):
- **The number is given at submission.** v5 A7 says "Log line MAR-00x" at step 1 and "Numbers it" at step 5. The log line exists from the drop, as "Being prepared — not numbered yet". MAR-00x is given at Confirm & submit, as every other form on the platform is numbered only on Submit, so an abandoned package leaves no gap in the MARs.
- **The spec section** comes from E13 (G10's confirmed spec index): its library document, pages and the manufacturers it names. Otherwise it is a library specification and the pages the engineer names. A second splitter is never guessed (spec §6). The clauses are split deterministically by their numbers, and a lettered clause is known by its parent ("2.2 A", "3.1 A"), since every clause has its own A and B.
- **The approved list** is the section's manufacturers plus any the engineer adds. The brand label is by rule, not by the AI: "Approved manufacturer (…)" or "Alternative / equivalent" only.
- **What the AI is given:** the clauses and the catalogue's pages as text, one call per section, so it works with a self-hosted text model too. A catalogue page with no text (a scan) is listed, and a line citing it is flagged "check it by eye".
- **Every figure is checked:** a deterministic check on every line and every regeneration.
  - every figure a line says was **submitted** must be printed on the catalogue page it cites
  - its **quote** must be that page's own words
  - every figure in a **requirement** must be in the specification
  - a figure in the **form, the method statement or the explanations** must be in the catalogue or the specification

  Anything else flags the line. A package with a flagged line is not completed.
- **Overrides:** the engineer may change the AI's "Complies", but must say why. The override (from, to, why, who) and the AI's remark stay on the line, in the PDF too, and survive a regeneration.
- **Revisions:**
  - **Rev 0** is the AI's draft. Completing forms Rev 1, and Rev 0 is kept whole.
  - **Rev 1** is submitted as MAR-001.
  - **Code C or D** makes K7 open "MAR-001 Rev 1". Its package starts from Rev 1 with the consultant's comments beside it, and is filed on that record as package Rev 2 with no new number.

  K7's record revisions stay the one revision model.
- **The PDF** (pdf-lib) holds:
  - contents with page numbers
  - the compliance statement as a table
  - the method statement and the technical explanations
  - the catalogue pages the lines cite, with each cited figure and quote highlighted (positions from pdf.js)
  - the certificates (PDF or pictures)

  The consultant's own material form is filled from the package's form section, as an Excel or Word file, where one is set up. Otherwise the plain form is used. A7's transmittal is K7's issue: the filled form and the files chosen.
- **The ladder:**
  - **Shipped:** Prepared → PM → DC issues → reply.
  - **Old default:** a project still carrying the untouched shipped ladder from before (with QA/QC, never changed by anyone) is moved to A7's when its next package is submitted. A ladder a person set is left as it is.
  - **Adding QA/QC:** the PM (or Principal) adds or takes out the QA/QC step for their project. Before, only the AETRAA Admin could change a ladder.
- **From a P3 item:** the package is pre-filled, and on submission the item's `record_ref` is set to the MAR. That is the field G12's live tracking reads, written directly because `editItem` does not take it.
- **Issuing:** nothing is issued without the PM and DC. K7 already makes issuing Document Control's for S0 records, and DC can issue only after the PM approves.

| File | What changed | Why | What output it affects |
|---|---|---|---|
| `src/material-package.js` (new) | **Store:** `material_package` and `material_package_rev` (Rev 0 kept). **Deterministic:** `clausesOf`, `numbersIn`, `figureCheck`, `quoteOn`, `brandStatus`, `checkSections` (every flag recomputed). **Start:** `createPackage` (E13 section or library pages, BOQ line, P3 item, catalogue and certificates stored, page texts kept against SHA-256). **AI:** prompt `a7-1` with A7's "must never", `draftSections` (one call per section, history kept, overrides survive). **Edit and complete:** `editPackage` (overrides need a reason), `addCertificate`, `completePackage` (refused while flagged). **Out:** `packagePdf`, `materialLog`. **Ladder:** `settleMaterialLadder`, `materialSteps`. | v5 A7 | Material submittals |
| `src/records.js` | The material ladder: no QA/QC step (Submitted → PM → DC issues → reply). | v5 A7 step 6 "Removed" | New MARs |
| `src/pdf-text.js` | `pdfPageLines`: each page's text line by line, and optionally each text piece's box. It is shared by K10's letters, K12's catalogues and specifications, and the highlights. | K10, K12; one line-keeping reader, as the review asked | — |
| `src/correspondence.js` | Reads PDFs through `pdfPageLines` (no change in what it reads). | One reader | — |
| `src/sheet-corner.js` | pdf.js is given its standard-font files, so a sheet using the 14 standard fonts renders its text in the corner sent (found while checking K12's PDF by eye). | K9 A1 | The corner sent to the AI |
| `src/index.js` | **Routes:**<br>- `GET /api/material` (log, sections, specifications, BOQ, open P3 items)<br>- `/log.xlsx`<br>- `/one`<br>- `/page` (one page of the catalogue or specification, inline: what every line opens)<br>- `/pdf`<br>- `/form`<br>- `POST /qaqc` (PM)<br>- `/start`, `/draft`, `/edit`, `/cert`, `/complete`, `/submit`, `/revise` (Design, PM, Principal)<br><br>All audited (`material.*`). Page `/material`. | A7 | — |
| `src/html/material.js` (new) | **The log** by discipline (Sr, Ref, Discipline, Description, Supplier, Brand, Submitted, Rev, Status), with its Excel. **Starting a package:** from scratch or a P3 item; spec section, BOQ line, approved list, catalogue, certificates. **The review screen:** the form's values, the compliance statement (clause → spec page, catalogue page link, flags, the AI's remark, the reason for an override), method statement, explanations, certificates and the clauses collected. Prepare with AI or by hand, regenerate a section, save, complete, generate the PDF and the form, confirm and submit. **The PM's QA/QC switch.** | A7 | New page |
| `src/html/app.js` | **Edited directly** (no generator in work/test-drive): "+ Material submittal" opens `/material`. | A7 step 1 | Design dashboard |

**Tested:** `tools/test-k12-material-package.mjs`, 53 checks. The sample is a two-section specification indexed and confirmed through G10, a three-page catalogue and a certificate.
- **The deterministic parts:**
  - clause split (lettered clauses known by their parent)
  - the figure check (an AI's own "80" from 2 × 40 caught; "1,200" = "1200")
  - quote check
  - brand rule
  - the QA/QC step in and out
- **The start:**
  - Site is refused.
  - From the P3 item: being prepared, not numbered.
  - The clauses collected with their pages.
  - The approved list (Jotun, Hempel, "or equal") from the section, the BOQ line found.
  - Asian Paints labelled "Alternative / equivalent".
  - With AI off the AI is not offered.
- **The AI's draft:**
  - The four sections are drafted from the clauses and pages as text.
  - A line whose figures are on its page stands.
  - Flagged: an invented "80", a quote not on its page, and a "12 year" not in the sources.
  - The deviation's AI remark is kept.
  - Nothing is numbered.
- **Every compliance line opens its source page:** its catalogue page and its spec page each open as one page, and a page that is not there is refused.
- **The review:**
  - Changing the AI's "Partly" needs a reason; with one, the override is kept with the AI's remark.
  - With flagged lines the package is not completed.
  - With the brand corrected to Jotun, it is approved.
  - A section regenerated on its own.
  - Completed: Rev 1, with Rev 0 (the AI's draft) kept.
- **The package:**
  - One PDF of 8 pages: contents, compliance, method, explanations, the three cited catalogue pages highlighted, the certificate. Each page was checked by eye.
  - Submitted: MAR-001 numbered then, the package PDF filed, the brand, its status, the spec section, the BOQ line and Rev 1 on the record.
  - No QA/QC step.
  - The P3 line follows MAR-001, and a package is submitted once.
- **Nothing issued without the PM and DC:**
  - DC cannot issue before the PM approves.
  - The PM approves but cannot issue, on the desk or through the drawer.
  - DC issues.
- **Code C:** MAR-001 Rev 1 is opened, and its package starts from Rev 1 with the comments. It is filed on MAR-001 Rev 1 as package Rev 2.
- **The PM's QA/QC step:** Design cannot change the workflow. The PM adds the step, and a package typed by hand (no AI) then goes through QA/QC first. A project left on the old shipped ladder is moved to A7's.
- **The log and the walls:** the log and its Excel; another company cannot open a package; the page opens; every AI call is logged.

`tools/test-pg-k-series.mjs` adds A7 on PostgreSQL (a package from library pages, completed with Rev 0 kept, submitted with its PDF): 67 checks in all. It caught a library specification named with a section number being looked up in the index, now fixed. Every other test still passes (Girish's G10 and G12 included), the 66 page scripts parse, and the demo seed builds.

**For the owner:**
- **When MAR-00x is given.** v5 A7 step 1 says "Log line MAR-00x"; step 5 says "Numbers it". It is given at step 5 here (no gaps). If Ajay wants the number from the drop, the package would create its MAR at the start, at the cost of gaps.
- **Revision labels.** The package's Rev 2 (A7) is filed on K7's "MAR-001 Rev 1" record (K7's record revision). One revision model, as the review asked, but two numbers are visible. If the consultant should see one, the record's revision numbering is K7's to change.
- **D8 (sending a customer's documents to the hosted API)** covers specification and catalogue text too. They go only through `callModel`, as text.
- **Shared with G12:** the method statement section is written so G12's P4 ("as in A7, method statement part") can reuse it.
- **No real catalogue, specification section or consultant material form is in the repository.** The first real ones should be run through the page and kept as fixtures.

## K13 (A10) · RFIs: prepared from a note and a photo, the duplicate check, the possible-variation flag, the RFI log

K13 is three parts: A10 (RFIs), A11 (minutes) and A12 (the site diary). Each is committed on its own. This is A10.

v5 A10:
1. The engineer picks "+ RFI", types a note and drops a photo or marked-up drawing. The extraction program finds the drawing references (E3) and the spec references (E13). The AI prepares the RFI's text and fields on the consultant's form: subject, question, location, impact, needed-by. It checks the engineer's wording and proposes what is missing.
2. The engineer edits, then Generate → Check → Confirm & submit. A duplicate check runs before raising.
3. S0 follows. A "possible variation" flag goes to the QS when the answer changes scope.

- **No proposed-solution field.**
- **The log:** Sr, Discipline, Subject, Raised, Issued, Reply by, Answered, Days open, Status, Variation flag.
- **AI must never:** raise, route or issue the RFI.

**Decisions made here** (each can be changed):
- **"+ RFI" opens `/rfi`**, a page of its own like K12's: the note and photo, the drafted fields, Check, Confirm & submit. The RFI is raised through the same route as before (`POST /api/records`), then the submittal desk (S0, K7). With AI off the page is the typed RFI.
- **References are found by rule, not by the AI:**
  - drawing numbers the note names that are in the register (one not in the register is said so)
  - spec sections it names by number, or by a distinctive word of their title (G10's index)

  The register's drawing reference is put on the form, never a drawing the AI named.
- **The fields** are those of the consultant's RFI form where one is set up. Otherwise: Subject, Discipline, Question, Drawing ref, Spec ref, Location, Impact, Priority, Reply needed by.
- **A proposal box is left blank.** A box on the consultant's form for a proposal ("Contractor's proposed solution") is left blank and not asked of the AI, and the AI is told an RFI asks and never answers. The impact is what is held up on site, never a claim or a notice (A13 is later).
- **What is missing** is the AI's wording check plus what the rules find: no drawing in the register, no location, no needed-by date. The needed-by date is read one way or not at all.
- **The duplicate check** runs on the server every time an RFI is raised, by any route.
  - **Searched:** both RFI stores (the records register and the issues register), open, answered and imported alike.
  - **What counts:** similar words, or the same drawing with somewhat similar words.
  - **What happens:** it names the earlier RFI and asks; the engineer can raise it anyway. The dashboard's generic form asks the same.
- **The "possible variation" flag** is set when DC records the answer:
  - DC writes why in a box on the desk.
  - When the AI reads a scanned answer (A3), it may suggest one, prefilled for DC to keep or clear.

  The record carries "Possible variation — …" and the QS is told (bell and email). Nothing is created in the variation register.
- **The RFI log, by discipline:**
  - Days open runs from raised to answered (or today).
  - Sr is the running number down the log.
  - In Excel it adds who raised it and, for a record from the old system, its origin (K5).

| File | What changed | Why | What output it affects |
|---|---|---|---|
| `src/rfi-prep.js` (new) | **By rule:** `findRfiReferences` (E3 drawings, E13 sections); `similarity` and `rfiDuplicates` (both stores). **AI:** prompt `a10-1` with A10's "must never" and "an RFI asks"; `draftRfi` (a proposal box left blank, register references put on, needed-by date read, missing listed, duplicates named; nothing raised). **The log:** `rfiLog`. | v5 A10 | RFIs |
| `src/ai-readers.js` | A3 for an RFI also suggests whether the answer changes scope (a suggestion, never applied). | A10 variation flag | The submittal desk |
| `src/register-xlsx.js` | `rfiWorkbook`: the RFI log with v5's columns, then raised by and origin. | A10 log; K5 marker | RFI Excel |
| `src/index.js` | **Routes:** `GET /api/rfi` (log, the form's fields); `POST /api/rfi/draft`; `POST /api/rfi/duplicates`. **Raising:** `POST /api/records` stops a likely duplicate RFI (409, the earlier one named) unless the engineer says to raise it anyway. **Replies:** `/api/s0/reply` and `/api/s0/ai-confirm` take `variation` (flag the record, tell the QS, audited). **Excel:** `/api/register/xlsx?reg=rfi` gives the RFI log. **Page:** `/rfi`. | A10 | — |
| `src/html/rfi.js` (new) | The page:<br>- the note and photo<br>- Draft the RFI<br>- the fields, the drawings and spec sections found, what is missing, what was left blank, RFIs that may already be asked<br>- Check the document (the consultant's form, filled)<br>- Confirm & submit, or "Raise it anyway"<br>- the RFI log | A10 | New page |
| `src/html/s0.js` | For an RFI, the reply form has the possible-variation box, prefilled from the AI's suggestion. | A10 | Submittal desk |
| `src/html/app.js` | **Edited directly:** "+ RFI" opens `/rfi`, and the dashboard's form asks before raising a likely duplicate. | A10 | Dashboard |

**Tested:** `tools/test-k13-rfi.mjs`, 27 checks:
- **By rule:** a register drawing and a spec section found; a grid is not a drawing; similarity.
- **AI off:**
  - HSE is refused.
  - The form's fields include location and impact.
  - With AI off the references are still found and what is missing said, with nothing sent.
  - Typed and raised: RFI-0001.
- **AI on:**
  - Drafted from the note and the photo (sent as a picture).
  - The needed-by date read as a date.
  - The AI's wording check beside the rules'.
  - Nothing raised.
  - The AI told an RFI never proposes a solution.
  - The register's drawing reference kept over the AI's.
  - The earlier RFI named. Raising it is stopped with it named, and raised when the engineer says so.
  - The issues register searched too.
- **A consultant's form with a "proposed solution" box:** the box is left blank and not asked of the AI.
- **S0:**
  - Issued by DC.
  - Answered with the possible-variation flag on the record.
  - The QS emailed.
  - Nothing in the variation register.
- **The log:** every column for RFI-0001 (raised, issued, reply by, answered, days open, status, variation flag), in Excel too. Another company sees none of it. The page opens. Every AI call is logged.

`tools/test-pg-k-series.mjs` adds A10 on PostgreSQL (raised, the duplicate stopped, the log): 70 checks. Every other test passes, Girish's included. K5's export check first caught the RFI log missing the old-system marker, now carried.

**For the owner:**
- **Two RFI stores.** RFIs exist both as records (S0, this register) and in the issues register (raised from site delay reasons). Both are numbered RFI-0001 on one project. A10 is built on the records register, and the duplicate check searches both. Whether the issues register's RFI should be retired or routed into records is Girish's or Ajay's to decide.
- **One model for every task.** The AI cost plan puts RFIs on a larger model than the diary and minutes. `callModel` uses one model per deployment, so a per-task model would be a change to `src/ai.js`.

## K13 (A11) · Minutes: from typed notes or a scanned sheet, owners confirmed by a person, two series on their templates, the consultant's minutes recorded

v5 A11 (agreed 5 Oct):
- **Input:** typed by hand, or a scanned sheet (no audio). The AI reads it and prepares the minutes.
- **Two separate series:** consultant meetings on the consultant's template, internal meetings on the company template.
- **The consultant's issued minutes** are uploaded directly; the AI reads them and records the decisions and actions.
- **The action tracker:** the AI fills it (action, proposed owner, due date) for a person to confirm. Its columns are No, Meeting, Action, Owner, Due, Status, Closed on.
- **AI must never:** issue minutes or assign actions.

**Already there before this change:** drafting, checking and issuing minutes, the numbered actions (AI-001…), owners told, matters arising, and the tracker with Excel.

**Decisions made here** (each can be changed):
- **The AI's draft fills the minutes editor on screen**: attendance, items, decisions and actions. It is saved only when the person saves.
- **Owners are proposed, never assigned.** An owner the notes name is matched to the project team by name (deterministic); one not on the team is kept by name. Every owner the AI gives is marked "proposed". The minutes cannot be issued until the person confirms each one (a tick beside it).
- **Dates** are read one way or left blank with the reason (§18).
- **The two series:**
  - **Kinds:** each meeting is in the consultant's series or the company's. Progress, design and MEP meetings start in the consultant's; the rest in the company's. A draft can be moved.
  - **Templates:** each series has its own template type, "Minutes — the consultant's meetings" and "Minutes — internal meetings". Uploaded on the templates page, the minutes go out on it, filled from tokens such as `{{meeting_ref}}`, `{{attendees}}`, `{{items}}`, `{{decisions}}` and `{{actions}}` (lists as lines). Without one, the platform's own layout is used, as before.
  - **Numbering:** the existing numbering per kind (PRG-…, INT-…) is unchanged.
- **The consultant's issued minutes** are read and then recorded as theirs, with status "recorded", their own reference kept and the file kept on the meeting. Their decisions and actions are kept as text within the minute. They are not raised as live actions in our tracker, as spec §6 says of imported minutes, and minutes we did not write are never "issued" by us.
- **The tracker** is in v5's columns (No, Meeting, Action, Owner, Due, Status, Closed on), then the first date, times carried and the closing note.

| File | What changed | Why | What output it affects |
|---|---|---|---|
| `src/minutes-ai.js` (new) | **Prompt** `a11-1` with A11's "must never". **`shapeMinutes`:** owners matched to the team and marked proposed; dates read one way or left. **`draftMinutes`** returns a draft, saving nothing. **`readConsultantMinutes`:** their actions kept as text. A text document goes as text; a scan goes as the file. | v5 A11 | Minutes |
| `src/meetings.js` | New columns through `addColumns`: `series`, `their_ref`, `source`. `SERIES` and `seriesOf`. A draft action keeps "proposed" until confirmed, and issuing is blocked while one is unconfirmed. `saveDraft` takes `opts` to record the consultant's minutes. Recorded minutes cannot be issued or edited. | A11 | Minutes, tracker |
| `src/meetings-doc.js` | `minutesValues` (what a minutes template is filled with). The action log is in v5's columns first. | A11 | Minutes on a template; action log Excel |
| `src/templates-store.js` | Two template types: the consultant's minutes and the company's. | A11 two series | Templates |
| `src/index.js` | **Routes:** `POST /api/meeting/ai-draft`; `POST /api/meeting/consultant/read`; `POST /api/meeting/consultant/record`. **The minutes document:** `/api/meeting/doc` uses the series' template when one is set up. **The list:** `/api/meetings` says whether AI is on and lists the series. All audited. | A11 | — |
| `src/html/minutes.js` | **The editor:** a "Prepare with AI" panel (notes or a scanned sheet), the series choice, and a "confirm the owner" tick on each proposed one. **The list:** "Upload the consultant's minutes" (read, check, record) and a "recorded" status. **The tracker:** in v5's columns. | A11 | Meetings page |

**Tested:** `tools/test-k13-minutes.mjs`, 27 checks:
- **Proposed owners:** an owner matched to the team or kept by name, both only proposed; a two-way date left blank.
- **AI off:** the series offered; preparing refused with nothing written; an internal meeting written and issued by hand in the company series.
- **AI on:**
  - Finance is refused.
  - The minutes are prepared from typed notes: Ravi proposed from the team, the Engineer by name. Nothing saved.
  - The person saves a consultant-series draft with the proposals kept. It is not issued while an owner is unconfirmed, and no action exists yet.
  - Confirmed: issued with the actions numbered, and Ravi emailed.
- **Templates:** a progress meeting's minutes go out on the consultant's Excel template, filled with its ref, the action and AI-001. An internal one with no company template uses the platform's layout.
- **The consultant's minutes:**
  - Read with their reference, date, decision and action; the text PDF went as text.
  - Recorded as theirs with the file kept.
  - Their action stays in the minute, so our tracker is unchanged, and it is not issued by us.
  - It is listed as theirs.
- **The tracker and the walls:** the Excel tracker is in v5's columns. Another company sees none of it. With the AI module off, preparing is refused. Every AI call is logged.

`tools/test-pg-k-series.mjs` adds A11 on PostgreSQL (series, the proposed-owner block, recorded minutes): 73 checks. Every other test passes (G11's knowledge base now also lists the two minutes templates when missing).

**For the owner:**
- **The consultant's actions (spec §6 against v5 A11).** v5 says the AI "records the decisions and actions" of the consultant's issued minutes. Spec §6 says actions in imported minutes are not created as live actions. They are recorded as text within the minute. If Ajay wants the actions addressed to us to enter our tracker after DC confirms them, that is a small change.
- **Series and numbering.** v5's "two separate series" is read as two templates. Numbering stays per kind of meeting. If the consultant's and company meetings should each have one number series, that is a change to the meeting numbering.
- **Sending to external attendees.** v5 A11 step 3 has DC send the minutes to external attendees. Attendees have no email address on the platform yet, so that is not built.

## K13 (A12) · Site diary: prepared by DC or the person the PM assigns, an AI draft from typed notes or a scanned site sheet, a problems field, the 6 pm and next-morning reminders

v5 A12 (agreed 5 Oct):
- **Who prepares it:** DC, or the person the PM assigns. Typed, or from a scanned site sheet (no voice).
- **What the diary holds:** weather, manpower by trade, plant, materials received, visitors, problems, tomorrow's plan, and photos of in-progress activities only. There is no work-done-against-activity section and no progress % for now.
- **Photos:** the AI captions each photo and tags its activity and location.
- **Reminders:** at 6 pm to the assigned person if the day's diary is not saved, and the PM told the next morning.
- **Submitting:** the PM submits; DC sends it if the contract requires.

**Already there before this change:**
- **The diary itself:** weather, manpower by trade, plant, materials, subcontractor gangs, works, tomorrow, remarks and visitors. It carries forward from the previous day.
- **Checks and history:** the checks before submitting, the kept versions after submission, the 14-day strip, and the attention list.
- **Inputs from other tasks:** delivery notes and certificates (K11, A5) and subcontractors' timesheets into manpower (K8, E15).
- **Submitting:** only the office submits.

**Decisions made here** (each can be changed):
- **Who prepares the diary:**
  - Document Control prepares it unless the PM assigns someone else on the diary page. The Principal and the AETRAA Admin can also assign.
  - Only someone on the project whose role can write the diary can be assigned, never the consultant.
  - The assignee can write the diary even if it is not one of their workflows.
  - Anyone who could save the diary before can still save it, such as the site engineer on a phone. The assignment decides who is named and reminded.
- **The AI's draft:**
  - **Input:** typed notes, or a scanned site sheet (PDF, Word, text, PNG or JPEG). A document with text goes to the model as text; a scan goes as the picture.
  - **Who can use it:** DC, Site, the PM, the Principal and the assignee. Other functions, such as Finance, cannot.
  - **What it fills on screen:** weather, our manpower by trade, subcontractor gangs, plant, materials received, visitors, problems and tomorrow's plan. It drafts no works and no progress % (v5).
- **Matching the draft to the roster** (by rule, `rosterName`):
  - A trade, machine or material written another way gets the roster's name.
  - A name not on the roster is kept as written and listed for the person to check.
  - A count that is not a number is left out, and the person is told.
  - A material given in a different unit from the one the project uses is flagged.
- **How the draft is laid over the day as last saved:**
  - The manpower the notes give replaces the day's figures, and a trade the notes do not give is 0.
  - Materials are added after the delivery-note lines.
  - Visitors, problems and remarks are filled in, or added on a new line.
  - Nothing is saved. The person saves it, and the PM submits.
- **Problems:** a new field (`addColumns`), shown on the screen, the printed sheet and the Word copy. It counts with Remarks when deciding whether the site was closed.
- **Works no longer stop a submission.** v5 has no work-done-against-activity section for now. The works card stays on the screen and the sheet, because the printed sheet is the company's format. The warnings about site progress stay.
- **Reminders** (working days only):
  - **6 pm UAE** (`0 14 * * *`): if today's diary is not saved, the assignee is told, or Document Control where nobody is assigned. A saved draft counts as saved.
  - **6 am next day** (`0 2 * * *`): if yesterday's diary is still not saved, the PMs are told, with the name of who prepares it.
  - **Days skipped:** the project's day off, days before it came onto the platform, a draft project, and a project with the Site module off.
  - **Once each:** sent through K3's notify log (`diary-6pm`, `diary-next-morning`).

| File | What changed | Why | What output it affects |
|---|---|---|---|
| `src/diary-ai.js` (new) | **Prompt** `a12-1`: use only what the notes or sheet say, never invent a number, name, delivery or problem. The route never saves or submits (A12's "must never"). **Matching:** `rosterName`, `shapeDiary` (the draft on the roster, with the notes to check), `applyDraft` (laid over the day, not stored). **`draftDiary`** returns a draft and saves nothing. **Reminders:** `preparersOf`, `runDiaryReminders`. **`ensureDiaryA12`:** `projects.diary_assignee`. | v5 A12 | Site diary, reminder emails |
| `src/diary.js` | `ensureDiaryProblems` (`diary.problems` via `addColumns`); saved, loaded and kept with each version. | A12 problems | Diary |
| `src/diary-checks.js` | **Works:** an empty works list is no longer a blocker. **Closed day:** problems are read with Remarks. | v5 A12: no work-done section | Diary checks |
| `src/diary-doc.js` | **PROBLEMS** on the printed sheet and in the Word copy. | A12 | Diary sheet, Word |
| `src/index.js` | **Routes:** `POST /api/diary/assignee` (the PM, Principal or Admin; the person must be on the project and able to write the diary); `POST /api/diary/ai-draft` (returns the diary laid over, saves nothing). **`GET /api/diary`** returns `a12` (who prepares it, whether this person can assign, the people they can pick, whether AI is on). **`POST /api/diary`:** the assignee can save. **Crons:** the 6 pm run (`0 14 * * *`) and the morning run (`0 2 * * *`) send the reminders. **`diaryReminderDeps`.** All audited. | A12 | — |
| `src/html/diary.js` | **The panel:** who prepares the diary, with the PM's "Assign" choice, and "Prepare the diary with AI" (notes or a scanned sheet; the list of things to check). **Problems box.** | A12 | Diary page |

`app.js`: not changed.

**Tested:** `tools/test-k13-diary.mjs`, 45 checks:
- **Matching to the roster:** a trade written another way, one not on the roster listed, a count that is not a number left out, the weather, plant, subcontractor and a unit flagged. Two names that both fit are no match. The draft laid over the day: Helper 0, the delivery-note line kept.
- **AI off:**
  - Document Control prepares the diary; preparing with AI is refused and nothing is written.
  - Written by hand with a problem, which comes back on the screen, the sheet and the Word copy.
  - The PM submits with no works described.
- **Assigning:**
  - DC cannot assign; the PM can.
  - Neither the consultant nor someone from another company can be assigned.
  - A project id in the body is only a claim.
  - Sam is assigned, which is in the audit trail.
  - Someone not on the diary's workflow still cannot write it; Sam sees the diary is theirs.
- **AI on:**
  - Finance and the consultant are refused.
  - Sam, who is off the diary's workflow, has the diary prepared from typed notes. The notes went as text with the roster, and a scanned sheet goes as the picture.
  - Nothing is saved or submitted by the AI, even though its answer said "submitted".
  - Sam saves; submitting is refused to Sam, and the PM submits.
  - Every call is in `ai_usage` and the audit trail.
- **6 pm reminder:**
  - Sam is told, and the other company's DC is told where nobody is assigned. Each is sent only once.
  - No reminder is sent on the day off or when a draft is saved.
- **Next morning:** the PM is told, naming Sam. Nothing is sent where yesterday's diary was saved, and nothing is sent twice.
- **The walls:** another company sees none of it. With the AI module off, preparing is refused and the diary is still written by hand.

`tools/test-pg-k-series.mjs` adds A12 on PostgreSQL (the assignee, the 6 pm reminder sent once, a problem saved): 76 checks. Every other test passes.

**For the owner:**
- **Photo captions and tags (v5 A12 against spec §6): not built.**
  - v5 says the AI captions each photo and tags its activity and location.
  - Spec §6 ("Site photographs") links a photo to an activity "only where the folder or filename names one", because "a photo linked to the wrong activity is worse than one linked to nothing".
  - This needs Ajay's decision. One way: the AI proposes the caption and activity, and a person confirms them, as with the owners in the minutes.
- **Who can save the diary.** v5 says DC or the person the PM assigns prepares it. Only the AI draft is narrowed to that (plus Site, PM and Principal). Anyone whose role could write the diary before (site engineers, QA/QC, HSE) can still save it. If only DC and the assignee should save it, that is a small change.
- **The works section.** v5 has no work-done-against-activity section "for now". The section is now optional, not removed, because the printed sheet is the company's format. It can be taken off the screen and the prints if Ajay wants.
- **"DC sends if the contract requires."** Not built. There is no contract setting yet for sending the diary; it belongs with the contract obligations (A4), which are also not built (see K11).

---

# A9 Letters and replies, and A13 Delay and EOT (6 Oct 2026)

v5 marks these "later" (A9) and "not now" (A13), and their tabs are still "to review". Built at Girish's request to the tabs as written, so Ajay can review them working rather than on paper. Nothing in them sends, signs or claims anything on its own.

| File | What changed | Why | What output it affects |
|---|---|---|---|
| `src/letters-ai.js` (new) | `draftContext`: the incoming letter, the indexed clauses on its subject (the notice clause when it is about a notice, delay or claim), and the related records — by rules. The AI drafts Subject, References, Body, Clause cited and Enclosures from those facts only; with AI off a skeleton is drafted from the same facts. `checkQuotes`: any quotation in the draft that is not word for word in the indexed contract is flagged; `checkRefs`: any reference not on the project is flagged. `letter_draft`: every completion is a new revision. | A9 steps 1–2 | — |
| `src/index.js` | `/api/letters/draft` (PM, QS, Principal, Design), `/draft/save` (a revision), `/drafts`, `/draft/raise`: raises the letter record (with "In reply to"), refused while warnings stand unless the author confirms. The letter's own workflow then does A9 steps 3–4 — PM / Director signs, DC issues and logs, the incoming letter it answers is closed (existing `closeIncomingByReply`). Page `/letters`. | A9 | New page |
| `src/delays.js` (new) | `scanDelays`: a critical activity (no float) whose forecast finish from the last P6 update is after its baseline, the forecast completion after the contract completion, and issues marked with delay days — each with its effect through the logic (successors) and the end of its notice period (event date + the period read from the indexed notice clause; if none is found, none is assumed). `clockNote`: the arithmetic, never a conclusion. `delay_event` register: event, notice date, end of notice period, days claimed, status (flagged → drafting → completed → signed → issued). | A13 steps 1–5 | — |
| `src/index.js` | `/api/delays/scan` (Planning, PM), `/api/delays` (the contractor's team), `/prepare` (AI drafts the notice and EOT narrative from the facts; skeleton with AI off), `/save` (days claimed are the planner's own figure; Complete), `/sign` (the Director — Principal — only, once completed), `/issue` (Document Control only, once signed: logged as a letter record, the issue's notice reference set, the register updated), `/xlsx` (X1 header). Page `/delays`. | A13 | New page |
| `src/attention.js` | Flagged delays in Planning's and the PM's Needs my attention, with the end of the notice period (highlighted within a week). | A13 step 1 | Attention list |

**Tested:** `tools/test-a9-a13.mjs`, 35 checks (with the AI path stubbed: an invented quotation and an invented reference are both flagged); `tools/test-pg-girish.mjs` now 43 checks on PostgreSQL.

| fix | `src/knowledge.js` | The BOQ total in the knowledge base summary and snapshot is summed in whole fils with `money.js` (K1), not a floating-point `SUM(amount)` — the point left open in the K1 notes. | §27 rule 5 | Knowledge base summary |

---

# Menu links for the G and A9/A13 pages, and one-click start (6 Oct 2026)

Six pages could only be opened by typing their address. They now have entries in the dashboard menu. Like K6 and K10, this edits `src/html/app.js` directly, so the same entries need carrying back into `dashboard-design.html` before `gen-app.mjs` is run again.

| File | What changed | Why | What output it affects |
|---|---|---|---|
| `src/html/app.js` | Menu entries: PM gets Ask the project (`/ask`), Draft a letter (`/letters`) and Delays & EOT (`/delays`). Planning's Delay & EoT now opens `/delays` instead of the variations register. Commercial gets Draft a letter and Payment terms (`/terms`). Principal gets Payment terms. Design gets Specification index (`/spec`), Knowledge base (`/knowledge`) and Schedules (`/schedules`). The new entries are hidden with their module (`NAV_MODULE`) like the others. | G1, G10, G11, G12, G14, A9, A13 had no way in | Dashboard menu |
| `../../Start AETRAA (Windows).bat`, `../../Start AETRAA (Mac).command` (new), `../../RUN-LOCALLY.md` | One-click start from the platform folder. Each one runs `work/test-drive`, installs packages on first run and opens the setup page. A note at the top of RUN-LOCALLY.md says the top-level `src/`, `server.js` and `local.mjs` are the older copy. | Running `node local.mjs` in the top folder started the old code | — |

**Checked:** every page route opens (200) on a fresh local run; 67 page scripts parse; all 28 test files pass.

---

# Shared-code fixes from the K handover, and two gaps (6 Oct 2026)

The K-series handover left three questions on shared code and two items that neither half of the work split covered. All five are done here. Each AI change keeps the rule that AI only proposes.

| File | What changed | Why | What output it affects |
|---|---|---|---|
| `src/issues.js`, `src/index.js`, `src/html/issues.js`, `src/html/rfi.js` | **One RFI series.** An issue of type "Information required" is now numbered `INF-000x`, not `RFI-000x`. The RFI itself is a record (A10). The issue panel offers **Raise the RFI**, which opens `/rfi?issue=INF-…` with the issue's words as the note. When it is raised, the issue keeps the RFI's reference (`issues.rfi_ref`, added with `addColumns`). `GET /api/issue?ref=` reads one issue. Issues raised before this change keep their `RFI-000x` references; the A10 duplicate check still searches them. | The issues register and the records register both numbered from RFI-0001 | Issue numbers for new information issues; issue panel |
| `src/intake.js`, `src/authority-sheet.js`, `src/index.js`, `src/html/intake.js`, `../../prelaunch/authority-check.mjs` | **Stamp readings are proposals.** `readStamps` no longer writes the AI's authority, approval number, date or drawing number onto the sheet, or into the register for a filed sheet. The reading waits (`stamp_pending`). Document Control confirms, corrects or rejects it on the intake page, through the new route `/api/intake/stamps/confirm` (`confirmStamps`). Only then is it applied, with who confirmed it. A printed date that could be read either way (05/06/2026) is no longer read day-first; it is left for the person to type. `authority-check.mjs` now confirms the readings before it files. | Spec §4, §27: AI output never reaches a register unconfirmed | Intake review; the drawing register's Authority approved section |
| `src/ai.js`, `server.js`, `local.mjs` | **A model per task.** `AI_TASK_MODELS="a10-rfi=claude-opus-5-5,schedule-=…"` sets a task's model, matched exactly or by prefix. Any task it does not name uses `AI_MODEL`. Usage is logged with the model actually used. Nothing changes until it is set. | The cost plan puts RFIs on a bigger model | — |
| `src/html/held.js` (new), `src/index.js`, `src/html/home.js`, `src/html/intake-history.js`, `src/html/intake.js` | **The held list, `/held`.** AETRAA sees every project's held items, grouped by reason. Each file can be opened (`/api/quarantine/file`). A group is approved, approved with the numbering widened, or rejected; a reason is required to reject. It uses the existing `/api/quarantine/decide`, so the uploader is told (K3). Anyone else sees their own project's items, read-only. It is linked from AETRAA's home and from Intake history. The intake page's broken "held queue" link (`/app#quarantine`) now points to it. | Spec §7, §21, §22; there was no screen | New page |
| `src/alerts.js`, `src/intake.js`, `src/index.js`, `server.js`, `src/html/intake.js` | **Batch interrupted (spec §22).** A drop whose filing started, has sheets not yet filed, and has been quiet for 15 minutes triggers an alert. Whoever ran it (`intake_batch.started_by_id`, new) is told on the bell and by email. AETRAA is emailed the link that continues the drop. Each alert is sent once (`notify_log`), and a failed email is retried without a second bell. The check runs every 15 minutes (a new `*/15 * * * *` branch, fired by the server's ticker). On screen, the intake page now stops when the connection drops: "Stopped at item N of M … Continue where it stopped?" | Spec §21, §22 | Email, bell, intake page |

**Tested:** `tools/test-shared-fixes.mjs` (48 checks) and `tools/test-pg-girish.mjs` (now 49 checks, on PostgreSQL). All 29 test files pass.

**For Ajay:**
- `authority-check.mjs` was changed, and it needs the Al Warqa'a drawings to run.
- A Document Controller's interrupted drop still blocks new drops on that project for a day, unless AETRAA continues or abandons it. Whether DC may continue their own drop is in the approvals list.

---

# Ajay's decisions, 6 Oct 2026 (all yes), part 1: items 6, 9, 11, 12, 13

Ajay answered yes to all 24 items on `Girish/AETRAA-Decisions-for-Ajay.pdf`. Each item is built in turn; this is the first batch.

| File | What changed | Decision | What output it affects |
|---|---|---|---|
| `src/ai.js` | RFI drafting (`a10-rfi`) uses `claude-opus-5-5` whenever the provider is Claude (the API or the subscription). A self-hosted model keeps `AI_MODEL`, and `AI_TASK_MODELS` still overrides it. | 6 | RFI drafts |
| `src/records.js`, `src/workflow-store.js`, `src/s0.js`, `src/ai-readers.js` | WIR and MIR: the last step is now "Inspection result recorded by Document Control" (DC), not QA/QC. Both go through the submittal desk (`S0_TYPES`). DC issues them (email or by hand) and records the Engineer's result, and a scanned result can be read by the A3 reader for DC to confirm. The email says "for inspection". Records already running keep their own copy of the steps. | 9 | Inspection workflow; submittal desk |
| `src/index.js` (`mayWriteDiary`), `src/html/diary.js` | Only Document Control and the person the PM assigns may save the site diary, or have the AI prepare it. The PM (and the Principal) submit it. The diary page hides Save and Mark submitted from anyone who cannot use them (`a12.may_save`, `a12.may_submit`). The owner code and the old shared site code work as before. Timesheets (E15, Site and HSE) are unchanged. | 11 | Diary saving |
| `src/html/diary.js`, `src/diary-doc.js`, `src/diary-checks.js` | The "Description of works" section is gone from the diary screen, the printed sheet and the Word copy, and so are the "Add today's site progress" button, the Works column in the history and the works-list warnings. An old diary's works lines stay in the record but are not shown. | 12 | Diary screen and prints |
| `src/index.js`, `src/html/files.js`, `src/alerts.js` | Whoever started a drop may continue it. `GET /api/intake/batch` says whether it is `mine`. When a new drop is refused because one is still open, the drop page offers to continue it (filing the rest exactly as before) or to abandon it. Anyone else is told whose drop it is. Note: today only AETRAA starts drops from a screen; a DC uploads drawings one by one. | 13 | Drop page; "filing stopped" message |

**Tests:** `tools/test-ajay-decisions.mjs` (new, 29 checks). In `test-pg-k-series`, `test-k8-timesheets` and `test-k11-diary-docs`, the diary is now saved by DC or the assigned site engineer.

---

# Ajay's decisions, 6 Oct 2026, part 2: items 3, 8, 16

| File | What changed | Decision | What output it affects |
|---|---|---|---|
| `src/ai-readers.js` (`sheetProject`), `src/index.js`, `src/html/ai-read.js`, `src/html/drawings.js` | **The A1 reader holds a scan that states another project.** It now also reads the project line from the title block (name, project or contract number, plot). The line is never applied to the sheet; it is checked with the gate's own `identityMismatches`. A sheet stating another plot or contract, read "high" or "medium", is held for AETRAA, the same way the gate holds a readable sheet. A sheet in a drop goes to state `held`; a register sheet to status `held` (shown as "held for AETRAA", and the PM cannot approve it). A "low" reading is only flagged. A sheet stating nothing, or this project's plot, is not held. AETRAA releases it from the held list (a register sheet goes back to the PM; a drop's sheet is filed) or rejects it, and the uploader is told why. The first hold on a project emails AETRAA (K3). | 3 | Scanned sheets; held list |
| `src/meetings.js` (`trackConsultantActions`), `src/minutes-ai.js`, `src/index.js`, `src/html/minutes.js` | **The consultant's actions go into our tracker once DC confirms them.** On the consultant's recorded minutes, each of their actions has "Add to our tracker". DC (or the PM or the Principal) confirms the owner — someone on the team or the name as written; the reading's match is only pre-selected — and the date. It becomes a numbered action (AI-00x) whose history says which of the consultant's minutes it came from and who confirmed it, and the owner is told. Each is added once, and the minute shows where each one went. Route: `/api/meeting/consultant/track`. | 8 | Action tracker; consultant's minutes |
| `src/meetings.js` (`meeting_contacts`, `outsideRecipients`, `logSent`), `src/index.js`, `src/html/minutes.js` | **Outside attendees.** The attendance has an email column for attendees from outside the platform. Their names and emails are kept as the project's contacts, and picking a known name fills in their company and email. On issued minutes, DC (or the PM or the Principal) presses "Send the minutes to them". The minutes go to the outside attendees only, on the series' template where there is one (Word otherwise), with Reply-To set to the sender. Each sending is kept on the minute (`sent_log`). Route: `/api/meeting/send`. | 16 | Minutes; email |

**Tests:** `tools/test-ajay-decisions.mjs` now has 57 checks. All test files pass.

---

# Ajay's decisions, 6 Oct 2026, part 3: items 2, 4, 15

| File | What changed | Decision | What output it affects |
|---|---|---|---|
| `src/photo-ai.js` (new), `src/index.js`, `src/html/diary.js`, `src/diary-doc.js` | **Diary photos: caption, activity and location proposed by AI, confirmed by a person.** The diary screen has a Photos card for the day. "Suggest captions with AI" sends each uncaptioned photo with the programme's activities live around that day (started and not finished, or planned within a week either side). The AI proposes a caption, one activity from that list (anything else it names is dropped), the location, and how sure it is. The proposal is kept beside the photo (`ai_caption`, `ai_activity_id`, `ai_location`). The photo's own caption, activity and location change only when Document Control or the assigned person confirms or corrects them; "Not right" sets the proposal aside. The printed photo page shows the activity and the location. Routes: `GET /api/diary/photos`, `POST /api/diary/photos/suggest`, `POST /api/diary/photos/confirm`. | 2 (in place of spec §6's folder-name-only rule) | Diary screen; printed diary |
| `src/correspondence.js` | **Arabic letters are read and summarised.** An Arabic letter goes to the AI with Arabic instructions. The subject and summary come back in English, translated faithfully, and the subject as written in Arabic is kept. Each translated value is flagged "translated from Arabic by AI — check it against the letter". Arabic-Indic digits in the date and reference are turned into 0–9 by rule. A Hijri date is not converted: the person types the Gregorian date. A scan the rules could not see was Arabic is read again with the Arabic instructions. | 4 (in place of spec §23 "detect, never translate") | Correspondence register |
| `src/msg.js` (new), `src/correspondence.js`, `src/minutes-ai.js`, `src/html/correspondence.js` | **Outlook .msg letters are read.** A small Compound File reader (FAT, DIFAT, mini stream, directory tree) opens the top-level message streams: subject, sender name and SMTP address, To, the date (the transport header, else the submit time, in UAE time), and the plain-text body (HTML stripped if that is all there is). It gives the same shape as `parseEml`, so a .msg goes through the same rules and AI as an .eml. A .msg that cannot be opened is kept, saying why. Minutes notes can be an email too. | 15 | Correspondence register; minutes |

**Tests:** `tools/test-ajay-decisions.mjs` now has 73 checks (with `tools/fixtures/msg-file.mjs`, a .msg writer, for both the mini-stream and the ordinary-sector paths). `test-k10-correspondence` checks the new Arabic behaviour. `test-pg-girish` now has 55 checks on PostgreSQL. All test files pass.

---

# Ajay's decisions, 6 Oct 2026, part 4: item 14 (PDF reference forms)

| File | What changed | Decision | What output it affects |
|---|---|---|---|
| `src/template-pdf.js` (new) | **PDF forms.** A fillable PDF (AcroForm): its own fields are the form's fields, labelled by their tooltip (`/TU`) or name. Signature fields, or fields named "signature", are signature boxes. A flat PDF: every "Label:" it states becomes a field, with a fillable box added on the same line to its right (the original is kept, and the prepared copy carries the boxes). Filling is by token, name or label, as for Word and Excel: checkboxes, dropdowns where the option exists, and signatures written in their own box. An issued form is flattened. The preview draws the filled pages (pdf.js and canvas). A password-protected or unreadable PDF is refused with the reason. Extractor `e16-pdf-1`. | 14 | Consultant forms; issued documents |
| `src/template.js`, `src/template-forms.js`, `src/index.js`, `src/html/templates.js`, `src/html/setup.js` | PDF is a third format beside .docx and .xlsx (`FORMATS.pdf`, `formatOf`, `extractTokens`). `fillTemplate` returns a promise for a PDF (pdf-lib is asynchronous), so `drawTemplate`, `issueFile` and every caller now `await` (awaiting the Word and Excel result changes nothing). `saveFormTemplate` reads a PDF with `savePdfForm`: fields saved, original kept, signature boxes given to the workflow's steps in order. A6 is not offered for a PDF, which is read by its own fields. The upload inputs accept .pdf. | 14 | — |

**Tests:** `tools/test-ajay-decisions.mjs` now has 83 checks: a fillable PDF WIR form read, filled, signed and flattened; the preview drawn; a flat NCR form given boxes; a broken PDF refused. `test-k4-word-forms` now expects a broken PDF to be refused rather than every PDF. All test files pass.

---

# Ajay's decisions, 6 Oct 2026, part 5: item 1 (A4 contract obligations)

| File | What changed | Decision | What output it affects |
|---|---|---|---|
| `src/obligations.js` (new) | **A4: the AI reads the whole contract and lists every obligation.** Step 1: QS (Contracts & Commercial) or AETRAA presses "Find clauses". The clauses are the project index's (G15, split by rule, with the clause an addendum replaced left out), read 12 at a time; a clause read once is not read again. For each obligation the AI gives the words that state it, who it binds, the kind (notice, time bar, delay, variation, payment, claim, other), the period, what starts it, and a one-line summary. Checks: a quotation that is not word for word in its clause is dropped; a period is kept only where its number is in the quotation ("28 days", "twenty-eight (28) days"), and a differing AI figure is flagged. Step 2: QS edits who it binds, the kind, the period and the trigger, then confirms or rejects each line; the quotation is never edited. Step 3: the Principal approves every confirmed line, which then becomes live; an approved line is not changed. Nothing here writes to the payment terms (G1) or to any project figure (v5 A4 "AI must never"). | 1 (v5 A4 in place of spec §3's seven terms only) | New register |
| `src/delays.js` | A13's notice clock uses the approved obligation's period (notice, time bar, claim or delay, binding the contractor) where there is one, and says so. Otherwise it reads the indexed clause as before. | 1 (A4 step 3) | Delay register |
| `src/index.js`, `src/html/obligations.js` (new), `src/attention.js`, `src/html/app.js` | Routes `/api/obligations` (GET), `/find`, `/confirm`, `/approve`; page `/obligations`. Needs my attention: "to confirm" for the QS, "to approve" for the Principal. Menu entry "Contract obligations" for the PM, the QS and the Principal. | 1 | New page; attention list; dashboard menu |

**Tests:** `tools/test-ajay-decisions.mjs` now has 97 checks. `test-pg-girish` now has 60 checks on PostgreSQL (`ON CONFLICT DO NOTHING`, confirm, approve, the notice clock). All test files pass.

---

# Ajay's decisions, 6 Oct 2026, part 6: item 20 (Tender vs IFC), and the settings

| File | What changed | Decision | What output it affects |
|---|---|---|---|
| `src/tender-ifc.js` (new) | **The Tender vs IFC deviations agent, in the platform.** (1) Pairing, by rule: each IFC sheet with its tender sheet — by number; else by the number without its stage marks (T-, TD-, -T, -TEN, "(TENDER)"); else by an identical title. Sheets with no partner are listed: an IFC-only sheet is scope the tender never showed. (2) Comparison, by rule: each pair's first page drawn 1,400 px wide. The ink each sheet has that the other has not is found at half resolution, forgiving a pixel of drift. It is counted in a 16-pixel grid and the changed cells are joined into regions, giving a changed percentage. An overlay image is drawn (removed in red, added in green, regions boxed) and kept in the file store. Text lines on one sheet and not the other are listed, leaving out the title block's revision and date lines. (3) The AI, where it is on, sees both sheets and the comparison and describes each deviation: what, where, the kind (scope added or removed, dimension, specification, annotation, other), and whether it may be a variation. It decides nothing. With AI off, each changed line of text (or the changed area) is a deviation to decide. (4) A person (Design, the PM, the QS or the Principal) decides each one: a possible variation (a note for the QS is required), no cost impact, or not a change. A pair is compared once; a new IFC revision is a new pair. Rules version `tifc-2026.10.07`. | 20 | New register |
| `src/index.js`, `src/html/deviations.js` (new), `src/html/app.js` | Routes `/api/deviations` (GET), `/run`, `/decide`, `/overlay`, `/xlsx` (with the X1 header); page `/deviations`. The dashboard's "Tender ↔ IFC deviations" (Design; and now the QS) opens it instead of "not set up". | 20 | New page; dashboard menu |
| `src/knowledge.js` | The knowledge base's Tender vs IFC section (P1 step 3) pairs sheets the same way and points to `/deviations` for the content comparison. | 20 | Knowledge base |

**Settings Ajay decided (no code needed):**
- **D8 (yes):** customer documents may go to the Claude API. Set `ANTHROPIC_API_KEY` on the live server; every AI call already goes through `callModel`.
- **D5 (yes):** alerts stay at 3 days held, 20 held on one project and 80% storage (the defaults).
- **Live server:** `LOGIN_TEST_CODE` is confirmed off.
- **Still to come from Ajay:**
  - **Azure access**, to switch on Blob storage on the live server (steps in `deploy/azure/STORAGE.md`).
  - **`tools/gen-app.mjs`.** Until it arrives, the menu entries added to `src/html/app.js` since 6 Oct need carrying into `dashboard-design.html`. An older copy (21 Sep) is in `_archive/backup-2026-09-21/tools/`.

**Tests:** `tools/test-ajay-decisions.mjs` now has 113 checks, covering all 15 decisions built. `test-g11-knowledge` checks the new pairing note. `test-pg-girish` now has 64 checks on PostgreSQL. All test files pass.

---

# Launch check, 7 Oct 2026: fixes found by the full pre-launch kit

The full kit (`prelaunch/run.mjs`, both databases, with headless Chrome) was run against the current code. It found:

| File | What changed | Why | What output it affects |
|---|---|---|---|
| `src/ipc-pack.js` | `const enc = new TextEncoder()` is back. K1 removed it, so `/api/ipc/pack` (the full payment application .zip) failed with a server error for every application. `test-k1-bills` now downloads the pack. | Bug (kit F10) | IPC full pack |
| `package.json` | `@napi-rs/canvas` is declared (it was in the lock file only, as an optional dependency of pdf.js). Scan reading (A1), the PDF form preview and the Tender vs IFC comparison need it; declared, it cannot be skipped by an install. | Launch safety | — |
| `src/index.js` | `/api/template/form` reports a PDF form as `pdf`, not `docx`. | Decision 14 follow-up | Template form |
| `../../prelaunch/run.mjs` | G7 now expects what Ajay decided (decision 11): a site engineer who is not assigned is refused; Document Control saves; the PM submits. The kit also runs on Windows (`npm.cmd`). | The kit expected the old rule | — |
| `tools/demo-seed.mjs` | The kit's sample project is seeded the way the platform now requires: the authorities are chosen from the library (the route takes a list), and an activity claimed complete gets its photograph first. This is the B2 failure that has been open since 5 Oct. | Stale seed (kit B2) | Kit sample project only |
| `server.js` | The schema file is found with `fileURLToPath`, not `URL.pathname`, which breaks on a path with a space or a Windows drive. That is why the kit's PostgreSQL pass never started here; on the Linux server it worked because the path has no spaces. | Robustness (kit A1, PostgreSQL) | Server start |
| `src/db-postgres.js` (`toPg`) | SQLite's numbered parameters (`?1` used three times in the role-code check) become `$1`, not "the next `$n` followed by the digit" (`$11`, `$21`…). This was the PostgreSQL 500 on a wrong sign-in code, open since 5 Oct (kit A4); on the live server a mistyped code gave a server error. `test-pg-girish` now checks it. | Bug (kit A4) | Sign-in on PostgreSQL |
| `tools/demo-seed.mjs` | The authorities are named directly (the library is grouped by emirate, not a list). | Kit B1 | Kit sample project only |
| `src/gate.js` (`ensureGateColumns`) | The gate's columns (`drawing_rules`, aliases, plot numbers…) are added with `addColumns`, looked up first. The old try-SELECT-then-ALTER left `drawing_rules` missing on PostgreSQL behind a connection pool, so a project's drawing numbering could not be saved (kit A5). It is marked done only once the projects table is found. `test-pg-girish` saves rules. | Bug (kit A5, PostgreSQL) | Drawing numbering on PostgreSQL |
| `tools/demo-seed.mjs` | The programme CSV quotes a field with a comma (two activity names shifted their columns and lost their trade). The civil site engineer covers Architecture as well, and the MEP engineer sends A4 (lifts, commissioning). | Kit B2 | Kit sample project only |
| `src/hse.js`, `src/index.js`, `src/ipc.js`, `src/modules.js`, `src/org.js`, `src/roles-store.js`, `src/workflow-store.js` | Every remaining bare `ALTER TABLE … ADD COLUMN` (11 of them, all from before the db-cols rule) now goes through `addColumns`, looked up first. The try-SELECT-then-ALTER pattern can leave the column missing on PostgreSQL behind a connection pool: the kit's last run found `hse_log.man_hours` missing, so the HSE daily log could not be saved on PostgreSQL. A "done" flag is set only once the table is found. The roles store still gives existing roles their party, but only when the column is new. `test-pg-girish` saves an HSE log. | Bug (kit B2, PostgreSQL) | HSE log; any project column added on a live upgrade |

---

# Launch open issues, 7 Oct 2026: fixed (Girish/AETRAA-Launch-Open-Issues.pdf)

| # | File | What changed | What output it affects |
|---|---|---|---|
| 2 | `tools/test-menu.mjs` (new), `docs/app-js-direct-edits.patch` (new) | `app.js` cannot be regenerated safely here. The `gen-app.mjs` at the top of the platform folder is older than Ajay's: it produces about 17 KB less than the first test-drive `app.js`, so regenerating from it would lose Ajay's own later work. So: (a) `test-menu.mjs` fails if a regenerated app.js is missing any of the 12 menu entries added since 6 Oct, or their page links; (b) the patch holds every direct edit to app.js since it arrived (10 commits) for whoever runs Ajay's generator to carry back. | — |
| 3, 5 | `src/modules.js`, `src/parties.js`, `src/index.js`, `src/html/drawings.js` | **Bulk drawing loading by Document Control (spec D2: yes, drawings only, enforced on the server), switched on per project (spec §25).** A new module `bulkload` that is opt-in (`optIn`): off on every project, new or existing, until AETRAA ticks it on Modules. It is never added by catalogue version (`CATALOGUE_VERSION` 3), not part of the contractor's defaults, and kept when the parties change. With it on, the project's DC opens `/intake` (drawings-only, their project only, as the server already enforced), and the drawings page offers "Drop a folder of drawings" (`bulk_load` on `/api/drawings`). With it off, opening a drop is refused with the reason; the DC still sees the project's drops and reports. | Modules screen; drawings page; intake |
| 4 | `src/diary-send.js` (new), `src/index.js`, `src/html/diary.js` | **"DC sends the diary if the contract requires" (v5 A12 step 3).** The diary shows the approved A4 obligation that asks for daily records, if there is one, as the basis. DC, the PM or the Principal set who it goes to (`projects.diary_send_to`). Document Control sends a submitted day with the Word copy attached; the email names the clause; each sending is kept on the day (`diary.sent_log`). Not sent automatically, and not before the PM submits. Routes `/api/diary/send-to`, `/api/diary/send`. | Diary; email |
| 6 | — (checked) | Old RFI-000x issues are linked to an RFI record exactly as new INF ones are: "Raise the RFI" goes by issue type, not number. Nothing to renumber. | — |
| 7 | `../../deploy/make-release.sh`, `deploy/make-release.sh` | **The release script at the top of the platform folder packaged the older copy of the code**: running it would have shipped the old platform to the live server. It now hands over to `work/test-drive/deploy/make-release.sh` (the original is kept commented). That script used `$OLDPWD` for its files, which is only right when run from inside work/test-drive; it now uses its own folder. A release must also declare `@napi-rs/canvas`. The older copy itself is left in place for Ajay to archive. | Releases |
| 8 | `tools/run-all.mjs` (new), `package.json` | `npm test` runs every `tools/test-*.mjs` on any machine (`fileURLToPath`), one line per file, non-zero exit on any failure. (The broken `run-tests.mjs` belongs to the older copy.) | — |
| 9–15 | `src/launch-check.js` (new), `src/html/launch.js` (new), `src/index.js`, `src/html/home.js` | **Launch check (`/launch-check`, AETRAA only, linked from AETRAA's home):** read from the running server, it shows what the server has and what it still needs. It covers email; PLATFORM_EMAILS; PUBLIC_URL; the AI key and provider (flagging the subscription provider on a server); the file store (a probe file written, read back and deleted, and which driver); the image library and pdf.js loading; LOGIN_TEST_CODE; owner code length; any demo company; and the database. Each line says what to set. Secrets are never shown. It also lists what is checked by hand (DNS/TLS, one sign-in email, one scheduled report, PWA, the first real files). | New page |

**Tests:** `tools/test-launch-fixes.mjs` (new, 33 checks), `test-menu.mjs` (14), `test-pg-girish` (71, PostgreSQL). Tests whose DC drops folders switch bulk loading on first (`bulkOn` in `_harness.mjs`). `npm test`: 32 files, 0 failing.

---

# The light / dark switch, 7 Oct 2026

| File | What changed | Why | What output it affects |
|---|---|---|---|
| `src/index.js` (`THEME_BOOT`, `html()`) | One light/dark switch for every page, put into each page's `<head>` by `html()`. It applies the saved choice before the page draws, and takes over the ◐ button (`#themeBtn`): each click goes to the opposite of what is on screen, remembered in `sm-theme`. 21 pages drew the button with no handler. The others cycled dark → light → "the computer's setting", which on a dark computer looks like dark, so every other click seemed to do nothing. Checked in Chrome with the computer set to dark and to light, on /, /setup, /drawings and /people: each click flips, and the choice survives a reload. | Reported: "toggle light background mode ain't working" | Every page |

---

# The dashboard header showed the design's sample week (22 Oct 2026)

| File | What changed | Why | What output it affects |
|---|---|---|---|
| `src/index.js` (`projectSubLine`, `buildMe`, preview) | The line under the project name on every dashboard is now the project's location and the current week (Monday to Sunday, UAE time), e.g. "Dubai, UAE · Week 43 · 19–25 Oct 2026". The server sent it empty, so the design's sample "Dubai, UAE · Week 37 · 7–13 Sep 2026" stayed on screen for every project and every day. Found while walking every role through in Chrome; no other design sample text was found on any of the 11 dashboards. | Sample data on a live screen | Every dashboard header |
| `local.mjs` | Answers `/healthz` like the live server, so the demo loader and the kit run against a local copy. | — | — |

---

# AETRAA Assistant: A14 "Ask the project" as a conversation (22 Oct 2026)

A chat on the `/ask` page. It answers questions about the person's own project from its records (the A14 sources, access and limits, unchanged) and refuses anything else. Explaining how to use AETRAA itself is built but **switched off** (see "Needs Ajay's approval" below).

| File | What changed | Why | What output it affects |
|---|---|---|---|
| `src/assistant.js` (new) | **Layer 1, rules, no model:** `prefilter` refuses jailbreaks (ignore your instructions, system prompt, role-play, DAN, developer mode, base64…), requests for other companies' or projects' data, and plainly off-topic questions (code, maths, jokes, poems, recipes, news, crypto, personal advice…). A question goes through only if it names a record (RFI-0042) or a v5 workflow (S0, A14…), uses document-control words (submittal, RFI, WIR, IPC, BOQ, drawing, diary…), or matches records the person may see. A short follow-up goes through only after a question that was let through. **Layer 2, the prompt:** `chatSystem` and `chatPrompt` allow answers only from the numbered sources, each cited; record text goes inside `<<<DATA … DATA>>>` and is declared data, never instructions. **Layer 3, the answer:** `checkAnswer` refuses an answer that cites none of the sources it was given, repeats a marker hidden in the instructions, or carries code, a poem and the like. A reference the model invented is struck out. `cleanHistory` keeps the last 6 turns, each cut to 600 characters, and drops the whole history if any turn carries instructions. `HELP_TOPICS`: 29 fixed descriptions of pages and workflows (where to click, who does it), each shown only to people whose roles open that page. `REFUSAL` is the one fixed refusal message. | A chatbot that stays inside AETRAA and the project | — |
| `src/index.js` | New route `POST /api/ask/chat` `{question, history}` → `{reply, refused, note, sources, used, limit}`. On every message: signed in, project open, the A14 daily limit (one message is one question, refusals included), sources found again on the server with `findSources` (only what the person's roles open, in this project). Uses the `callModel` task `a14-chat`, so `AI_TASK_MODELS` can give it its own model. With AI off: the matching records with `AI_OFF_MESSAGE`. Read-only. `/api/ask` is unchanged. | — | New route |
| `src/ask.js` | `ask_log` gets `outcome` (prefilter-refused, output-refused, answered, not-found, no-sources, ai-off, ai-error), `input_tokens`, `output_tokens` and `task`, through `addColumns`. `logQuestion` takes them as an optional last argument. | Every message logged with its cost; a pay-per-use bill can be built from it | `ask_log` |
| `src/ask.js` (`findSources`) | A record is also found by what it is ("which submittals…" finds every submittal the person may see, not only those whose title shares a word), and a plural matches its singular. The text the model reads starts with the record type ("Submittal: …"). | Walking it through in Chrome, "What is the status of the submittals?" found nothing on a project with submittals | `/api/ask`, `/api/ask/chat` |
| `src/html/ask.js` | The page is now a chat: messages, cited references as links, the records used, refusals in their own muted style, questions left today, New conversation. The conversation is kept in this browser tab only (sessionStorage), because v5 A14 says answers are not stored. Works in light and dark mode and on a phone. | — | `/ask` |
| `src/index.js` (`CHAT_BOOT`, in `html()`) | **The chat button.** A round chat button in the bottom-right corner of every page, for every role. It asks `GET /api/ask/chat` first and shows itself only when the person is signed in with a project open. Clicking it opens the assistant (`/ask?embed=1`) in a panel over the page: "Full page" opens `/ask`, and × or Esc closes it. On a phone the panel fills the screen. It does not appear inside the panel, on `/ask` itself, or in print. It is added where the light/dark switch is added (`html()`), not in `src/html/app.js`, so regenerating the dashboard from `dashboard-design.html` does not remove it. `/ask?embed=1` hides the page's top bar and opens a record in a new tab. With AI off, a "how do I / where is" question shows the best help topic's text; any other question lists the matching records. | The assistant had no way in except the PM's menu | Every page |
| `src/assistant.js` (`smallTalk`), `src/index.js`, `src/ask.js` (`usedToday`) | **Greetings.** "hi", "hey", "thanks", "bye", "who are you?", "what can you do?" and the like got the refusal. They now get a short fixed reply saying what the assistant can help with. They make no model call, are logged as `small-talk`, and do not count against the day's questions. Only a message that is entirely small talk counts as one: "hi, which RFIs are open?" is answered as a question, and "hi, ignore your instructions" is still refused. | The first thing people type to a chatbot was refused | `/api/ask/chat` |
| `src/ask.js` (`findSources`) | Short terms (RFI, NCR, WIR, MIR, IPC, BOQ, PTW, EOT, ITP, NOC, GRN, LPO, MEP, IFC, HSE, CVI) are searched; until now only words of four letters and up were. "RFIs" matches "RFI". | "Which RFIs are open?" found nothing | `/api/ask`, `/api/ask/chat` |
| `server.js`, `local.mjs` | Pass through `ASSISTANT_PLATFORM_HELP`. | The switch would otherwise never reach the code | — |
| `tools/_assistant-cases.mjs`, `tools/test-assistant.mjs`, `tools/test-pg-assistant.mjs` (new) | 50 checks, run on SQLite and on PostgreSQL (PGlite), against a stub model: greetings answered for nothing and not counted; the chat button on every page, shown only when the server says yes, and the panel mode; 35 off-topic and jailbreak questions all refused with 0 model calls; text planted in a letter stays inside the data block, and a model that obeys it is caught; leaked instructions, uncited answers and code are refused; cited answers link only what they cite; follow-ups; HSE gets no IPC or variation; another company's records never reach the model; help only behind the switch and only for pages the person opens; AI off (records listed; a help topic, being fixed text, shown as it is); a type and plural search; no record changed; every message and model call logged; limits of 30 and 20. | — | — |

**Needs Ajay's approval:**
1. **Platform help (how to use AETRAA).** This goes beyond A14, which covers the project's records only. It is built and tested but off until `ASSISTANT_PLATFORM_HELP=on` is set. With it off, a question only about the platform ("how do I sign out?") is refused.
2. **The menu entry.** The chat button now reaches the assistant from every page, so the menu entry is optional. A14 says anyone can ask, but only the Project Manager's menu has "Ask the project" (`/ask`). If every role's menu should have it too, preferably renamed "AETRAA Assistant", add it in `dashboard-design.html` and regenerate with `gen-app.mjs`; `app.js` was not edited by hand.
3. **Refusals count toward the daily limit**, so the assistant cannot be spammed. They make no model call and cost nothing.

---

# New look, step 1: the theme, shared parts, and the drawing register (26 Oct 2026)

A visual change only. No route behaviour, API, permission, database field or wording changed, except the
one font route and the one security-header line listed below. This is the sample page for approval. The
other pages are **not** converted yet; they pick up the new palette through the old variable names, so they
change colour but keep their old sizes, symbols and typed-in colours until each is done.

**The look:** dark cool slate (`#1E2126`) with one warm sand accent (`#D8BFA0`), off-white text, 1px
lines, frosted cards, no shadows. Light is the same reversed (`#F3F1ED` page, white cards). One typeface
(Inter), seven type sizes, line icons instead of symbol characters, and every table a card per row on a phone.

| File | What changed | Why | What output it affects |
|---|---|---|---|
| `src/html/theme.js` | Rewritten. Both palettes as variables: light is the default and `[data-theme="light"]`; dark is the computer's dark setting and `[data-theme="dark"]`. The old names (`--plane`, `--ink`, `--ink-2`, `--muted`, `--border`, `--grid`, `--axis`, `--series-1`, `--warning`, `--critical`, `--good-text`, `--shadow`) are kept as aliases of the new ones. The type scale (7 sizes), spacing steps, corner radii, and the shared parts: card, highlight card (`.card-light`), main / secondary / text buttons, round icon button (36px ring in a 44px touch target), icon tile, frosted top bar and `.nav` links with the active dot, tabs with the dot, inputs (44px, focus ring), status pills (`.pill.good/.warn/.bad`), tables (44px rows, sticky label-style header, no vertical lines; class `stack` makes each row a card under 768px), empty state, loading bars, toast, dialog. All motion sits inside `prefers-reduced-motion: no-preference`. `@font-face` for Inter: `/fonts/inter-var.woff2` first, Google's copy second. `STATUS_META` icons are now icon names; nothing used them. | The theme in one place | Every page that includes `THEME_CSS` (53 of 61) |
| `src/html/icons.js` (new) | 25 line icons (Lucide style, 1.5px stroke, `currentColor`) and `icon(name, size)`, plus `iconsFor([...])` for page scripts. Every icon is `aria-hidden`. | In place of ◐ ✓ ⚠ and the like | — |
| `src/html/fonts.js` (new, generated) | Inter, variable 100–900, latin, 48 KB, as base64. From `@fontsource-variable/inter` 5.2.5, SIL Open Font License 1.1. | The font is served by the app, on any host | — |
| `src/index.js` | (1) `GET /fonts/inter-var.woff2`: public, cached a year. (2) The security policy's `font-src` adds `https://fonts.gstatic.com`, as the fallback only (Girish, 26 Oct: "a & b"). In practice the browser loads only `/fonts/…`, checked in Chrome. (3) The Assistant's chat button takes the page's tokens (frosted, outlined), with the old navy kept as the fallback for `app.js` pages. | Fonts; the chat button matching the pages | Every page (chat button); the font request |
| `src/html/shared.js` | Project switcher and "Signed in as" on the tokens. The logo sits on a cream chip in dark mode (it was white). `theme-color` per theme. "Signed in as" is now found beside Sign out wherever it sits (the bar, or a `<nav>`). Before, it was only found as a direct child of the bar, and would silently vanish once Sign out moved into a `<nav>`. | — | Every page's top bar |
| `src/html/drawings.js` | The sample page. All 29 typed colours and 22 font sizes removed. Top bar: logo, project, then `<nav>` (Dashboard, Site update, Sign out) and an icon light/dark button. "Design" and its line moved from the bar into the page heading (display type). The PM's "waiting for your approval" banner is the page's highlight card, with the main button. Drop zone, section pills, search with an icon, Live / All revisions segment, and the register on the shared table. Numbers and revisions in monospace, tabular. Status pills have an icon plus words. Row actions have icons. Empty state has an icon. Loading shows placeholder bars, not "Loading…" text (still announced to screen readers). Under 768px each drawing is a card: number, revision and status on top, then the rest; nothing scrolls sideways. Cells carry `data-label` for that layout. Wording, ids and handlers unchanged. | — | `/drawings`, `/design` |
| `src/html/notify-ui.js` | "Notify the team" and the bell panel on the tokens. They were fixed white, so they showed as white panels on dark pages. | Dark mode | The drawing register (only user) |
| `src/html/ai-read.js` | "Read with AI" panel on the tokens; the table and corner image stack on a phone; Confirm is the main button. | — | Drawing register, intake review |
| `tools/check-theme.mjs` (new) | Fails if a converted page has a typed-in colour (hex, rgb, hsl, named), a font size not on the scale, or a font other than `var(--font)` / `var(--mono)`. Converted so far: `drawings.js`, `notify-ui.js`, `ai-read.js`. The other pages are counted, not failed; `--all` makes every page strict for the end of the rollout. Skips `app.js`, `theme.js`, `shared.js`, `fonts.js`, `icons.js`. | — | — |

**The variables (dark / light):**

| Variable | Dark | Light | Use |
|---|---|---|---|
| `--bg` | `#1E2126` | `#F3F1ED` | page |
| `--surface` | `#2B3038` | `#FFFFFF` | panels |
| `--surface-2` | `#343A42` | `#F8F7F4` | raised, hover, fields |
| `--glass` | `rgba(52,58,66,.55)` | `rgba(255,255,255,.70)` | frosted cards and bar, with `blur(18px) saturate(120%)` |
| `--text` | `#EDEBE7` | `#2A2D33` | text |
| `--text-2` | `#A9A8A4` | `#6B6A66` | secondary text and captions |
| `--text-3` | `#7E7D7A` | `#9A9893` | **disabled only** |
| `--accent` | `#D8BFA0` | `#B8976F` | main button, active marks |
| `--accent-text` | `#C9B39A` | `#856946` | sand text, links |
| `--on-accent` | `#2A2D33` | `#2A2D33` | text on the main button |
| `--card-light` / `--on-card-light` | `#F3F1ED` / `#2A2D33` | `#EDE3D5` / `#2A2D33` | the one highlight card |
| `--line` / `--line-strong` | white 12% / 22% | black 8% / 16% | lines |
| `--good` `--warn` `--bad` | `#8FB59B` `#D9A866` `#DB8F8B` | `#3F7A55` `#93651B` `#A8463F` | status |
| `--good-ink` `--warn-ink` `--bad-ink` | `#A7C5B0` `#DFB780` `#E6B1AE` | `#376B4B` `#805818` `#9E423B` | status words on their 15% pill tint |
| `--scrim` | black 55% | slate 45% | behind dialogs |

Type: `--fs-display` 40/44 · `--fs-title` 24/30 · `--fs-headline` 17/24 · `--fs-body` 15/22 ·
`--fs-secondary` 13/19 · `--fs-label` 11/14 · `--fs-number` 32/36. Spacing `--s1`–`--s7` (4–48px).
Corners `--r-frame` 20 · `--r-card` 14 · `--r-control` 10 · `--r-pill` 999.

**Contrast (WCAG, needs 4.5:1).** Every text colour against the page, the panel and the raised panel in
its theme:

| Pair | Dark | Light |
|---|---|---|
| `--text` | 9.64–13.56 | 12.23–13.80 |
| `--text-2` | 4.82–6.78 | 4.80–5.41 |
| `--accent-text` | 5.68–7.99 | 4.53+ (was 4.19 at `#8C6E4A`) |
| main button text on `--accent` | 7.81 | 5.06 (white was 2.73) |
| highlight card text | 12.23 | 10.88 |
| `--good` / `--warn` / `--bad` as text | 5.06+ / 5.32+ / 4.54+ (bad was `#D98A86`, 4.33) | 4.51+ / 4.52+ (warn was `#A9741F`, 3.58) / 5.15+ |
| pill words on their own tint | 4.51 / 4.51 / 4.53 (were 4.41 / 4.63 / 3.91) | 4.51 / 4.55 / 4.56 (were 4.18 / 3.38 / 4.67) |
| `--text-3` | 2.79–3.92 — disabled only (exempt) | 2.55–2.88 — disabled only (exempt) |

**Differences from the brief, for review:**
1. The colour variables were in `theme.js`, not `shared.js`, so the palette lives there. The brief's
   `--navy` and `--gold` exist only in `app.js` and `index.js`.
2. Shades changed to pass 4.5:1: light `--accent-text`, light `--warn`, dark `--bad`, and the `-ink` pill
   shades (table above). The main button in light mode has dark text on sand (the brief's white fails).
   `--text-3` is for disabled controls only; captions use `--text-2`.
3. The highlight card in light mode is `#EDE3D5`. The brief's `#F3F1ED` is the light page colour, so a
   card in it would not show.
4. The Label size is 11px, as in the scale, though the brief also says nothing below 12px.
5. The drop zone's empty-state wording was not changed, so it has no new "→" action text.
6. Table row buttons are 32px tall with a mouse and 44px on a touch screen (`pointer: coarse`), to keep
   the desktop rows at the 44px row height.

**Waiting on `gen-app.mjs` (`src/html/app.js`, not edited):** it holds most of what is left:
188 typed colours, 121 font sizes, 238 symbol icons (the sidebar menus, `NAV`), Arial for the whole
shell, Georgia for headings and figures, its own `:root` (`--navy`, `--gold`, `--soft`…), and no dark
mode at all. It needs: `THEME_CSS` in place of its `:root`, its colours and sizes moved to the variables,
the `NAV` symbols swapped for `icon()`, the sidebar on the `.nav` style (`--surface-2` plus the dot), and
the login page's navy gradient replaced. Keep the script font (`'Segoe Script'`) only on the drawn
signature (`.sig .script`, `.sig .esign`). Until then the dashboards keep their old look, apart from the
chat button, which falls back to the old navy there.

**How it was checked:**
- `node tools/check-page-scripts.mjs`: 72 page scripts parsed, 0 failures.
- `node tools/check-theme.mjs`: 3 checks, 0 failures (55 pages still listed).
- `node tools/run-all.mjs`: 34 files, 0 failing.
- In Chrome, on a copy of the local database (port 8789) seeded with live, pending, sent-back,
  superseded and tender drawings, signed in as the PM: dark and light, 1440px and 375px. No sideways
  scrolling at either width. Inter is loaded from `/fonts/inter-var.woff2` and nothing is fetched from Google.

## Step 1b: the composition (26 Oct 2026, same day)

Girish: the first pass had the right colours but still looked like an admin screen. The target is the
look of an architectural studio's site (reference image he supplied): one framed object, a large light
headline, line drawings as the imagery, glass cards floating on them, and a lot of empty space.

| File | What changed |
|---|---|
| `src/html/theme.js` | **Every page is a framed slab**: the page sits on a darker ground (`--void`), inside a 28px-radius frame with a hairline edge, lit by a soft warm glow (`--glow`) and a slight vertical gradient (`--frame-1` to `--frame-2`). On a phone the frame is the screen. The top bar is translucent inside the frame. **Display type** is now `clamp(40px, 5.6vw, 76px)`, weight 300, uppercase. New parts: `.hero` (copy, line art, a floating card), `.float` (frosted card, brighter edge), `.overview` (figures, the cream card, feature tiles), `.stats` / `.stat`, `.feats` / `.feat` (icon tile, title and one line), `.lead`, `.link-arrow`, `.ring` (ringed arrow), `.btn-cream` (the cream pill), and `.topbar-in.centered` (links in the middle of the bar). The cream card's labels use its own dark ink. |
| `src/html/art.js` (new) | The imagery as line drawings, built in code and drawn in `currentColor`: `BUILDING_ART` (a cantilevered house, isometric, with construction lines and a ground grid) and `SKETCH_ART` (a frame of columns and slabs). No photographs, so nothing to license and nothing to load. |
| `src/html/shared.js` | The logo is drawn in the text colour (off-white on dark, charcoal on light), like a wordmark set in type, instead of on a white chip. On load the logo checks its own corner pixel: a company logo with a solid background keeps its own colours on a cream chip. |
| `src/html/drawings.js` | Rebuilt in that composition. **Top bar:** logo and project on the left; Dashboard, Design (current, with the dot) and Site update in the middle; light/dark and a cream "Sign out" pill on the right. **Hero:** "Design" label, "Drawing **register**" (sand), the page's line, and one main button ("Upload drawings" for uploaders, "Review now" for an approver who does not upload), beside the line drawing. **Floating card:** "Awaiting your approval", the count and "Review now" with a ringed arrow; or, with nothing waiting, the latest live sheet with Open. **Overview:** the register's figures (sheets live, awaiting approval, sent back), the upload as the cream card with a sketch, and three feature tiles. Then the register: tabs, filters, the table (quieter: "applies to" as words with dots, not chips) and the drawing list. Ids, handlers and every action unchanged. |

**New words on the page, for Ajay and Aaron to check:** "Drawing register" (the page was headed
"Design", which is now the label above it); "Upload drawings"; "Latest live sheet"; "Sheets live",
"Awaiting approval", "Sent back"; "The register"; and the three tiles: "Live revision only — Site works
from the approved, current sheet.", "An approval gate — An upload waits for the project manager.",
"Checked against the list — Missing sheets show here as awaited." The drop card lost the joining words
"— or" between its two buttons.

**Pages not yet converted:** they are now inside the frame and take the new palette, but keep their own
layout until each is done.

Checked: `check-page-scripts` 72/0, `check-theme` 3/0, `run-all` 34 files / 0 failing; Chrome, dark and
light, 1440px and 375px, no sideways scrolling.

## Step 2: every page, the dashboards, and navy and champagne (26 Oct 2026)

Girish asked for the whole front end, the main dashboards included. He then supplied a second
reference that set the final direction:
- deep navy cards with subtle borders and only a little translucency;
- strong glass kept for the header and a few featured elements;
- four KPI cards, with the attention queue given the largest area and decisions and activity in an
  aligned secondary column;
- champagne gold for the brand and main actions, muted red for overdue, green for verified or
  healthy, and cool grey for secondary information.

| File | What changed |
|---|---|
| `src/html/theme.js` | **The palette is now navy and champagne.** Dark: page `#0B1220`, cards `#111A2E`, raised `#18233A`, text `#E8ECF3`, grey `#94A3B8`, champagne `#D6BE8A`, green `#7CC49A`, muted red `#E58A8A`. Light: `#F4F6FA`, white cards, ink `#0F1A2E`, champagne `#C9AE78`. Every text pair is at least 4.5:1 in both themes; the lowest is 5.08, for a pill's words on its own tint. A new `--card` (navy, about 92% opaque, no blur) is used for cards and tiles; the frosted `--glass` is kept for the header and featured cards. Corners are 16 / 12 / 10px. `THEME_TOKENS` is split out for the dashboard shell. **Every page's top bar:** its buttons read as quiet links, Sign out is the cream pill, and the light/dark switch is a ringed icon. **`.pagehead`:** the page head (see `src/index.js`). **Phones:** a wide table scrolls inside its card, a field is never wider than the screen, and a button may wrap. |
| `src/index.js` | **`withPageHead`:** each page's own title and line are moved out of the top bar into a page head at the top of the content: the line as a small label, the title in semibold sentence case, and a line drawing beside it. The elements are moved, not copied, so their ids still work for the page scripts. Pages that have their own head (the drawing register), or another shape (the dashboards), are left as they are. **The light/dark script** swaps the ◐ character for the line icon on every page. |
| `src/html/app.js` — **the dashboards** | Restyled by hand onto the theme (`docs/app-js-restyle.md` lists every change, for when `gen-app.mjs` arrives). Frosted sticky header; four KPI cards with icon tiles; the attention queue in the wide column as rounded rows; the gold-edged cards (PM override, decisions) as featured frosted cards with a champagne edge; a solid navy sidebar with line icons and AETRAA in champagne; light and dark; phones. The print window is always light. |
| `src/html/icons.js` | 30 more line icons. `SYMBOL_ICON` maps every symbol the design used (★ ▦ ⚑ ₳ ⚖ ✓ ◈ ⧉ ▤ ◷ ✎ ⇪ ⚠ ✉ ☰ ◭ ⛏ 🛒 ⇥ ◮ ⏱ 🧪 ◉ 🚑 🎓 ⌸ ▮ 🔔 🔒 …) to one; `symbolIcons()` hands the map to a page script. |
| 54 page files in `src/html/` | Every typed-in colour, font size, heavy weight and font moved onto the theme. This was done by a converter that splits each file at quotes and braces, changes only the inside of a declaration, and writes everything else back byte for byte. The mapping went by role: a solid status colour with white words becomes a status tint with status ink; pale tints become the matching tint; greys become secondary text or lines; navies become text; shadows are removed. The hand fixes: two Arial `font:` shorthands (diary, issues), intake's validation border colours, and four `var(--gold)` references outside the dashboards (`--gold` is defined only there). |
| `src/html/diary.js` | The Assign row may wrap on a phone; it pushed the page 95px sideways. |
| `src/html/pwa.js` | Home-screen app colours set to the new navy. |
| `tools/check-theme.mjs` | Now strict on **every** page, `app.js` included. It skips only the token, data and manifest files. It allows a canvas's paper colour and the drawn signature's script face. |

**What changed in the words:** the page heads show each page's existing title and line, so no
wording was added. The dashboards show four figures instead of up to six: the first three each role
lists, plus its overdue count when it has one. The others are still on their screens.

Checked:
- `check-page-scripts`: 72 parsed, 0 failures.
- `check-theme`: 58 pages, 0 failures.
- `run-all`: 34 files, 0 failing.
- All 49 pages in Chrome, signed in as the PM or the AETRAA Admin, dark and light, at 1440px and
  375px: none scrolls sideways and none raises a script error.

## Step 3: Roboto Slab and Bebas Neue (26 Oct 2026)

Girish asked for Roboto Slab and Bebas Neue in the main areas, in place of the plain sans. Each face
has one job:

| Face | Where |
|---|---|
| **Bebas Neue** (`--font-display`) | Display titles: every page head, the drawing register's hero, the dashboard header ("PROJECT MANAGER"), the sign-in title, the detail drawer title. Big figures: KPI numbers, stats, the principal's tiles. The AETRAA wordmark. It has one weight, so it is never bolded (`font-synthesis: none`). |
| **Roboto Slab** (`--font`, set on body) | Everything that is read: body copy, card titles, lead lines, descriptions, queue items, notes. |
| **Inter** (`--font-ui`) | Dense controls, where a slab face at 11–13px reads worse: the menu, table cells, fields, buttons, pills, small uppercase labels, tabs. |

- `src/html/fonts.js` now holds all three (latin subset, from Fontsource 5.2.5, all under the SIL Open
  Font License 1.1): Inter 48 KB, Roboto Slab 34 KB (variable, all weights), Bebas Neue 14 KB.
- `src/index.js` serves them at `/fonts/inter-var.woff2`, `/fonts/roboto-slab-var.woff2` and
  `/fonts/bebas-neue.woff2`, cached a year. Google's copies stay as the fallback only.
- `src/html/theme.js` adds the two faces and the three font roles, plus four display steps for Bebas
  Neue, which sets small for its size: `--fs-d1` 64, `--fs-d2` 48, `--fs-d3` 40, `--fs-d4` 32px.
- `src/html/app.js` sets the dashboard's titles, wordmark and figures in Bebas Neue and its controls
  in Inter.
- `tools/check-theme.mjs` accepts `var(--font-ui)` and `var(--font-display)`.

Checked: `check-page-scripts` 72/0, `check-theme` 58/0, `run-all` 34 files / 0 failing; the dashboard
and the drawing register in Chrome.

**Step 3b — Inter removed (same day).** Girish: everything still in Inter (the attention queue, menus,
tables, buttons, pills) is to change too. Now two faces only: **Bebas Neue** for display titles and big
figures, **Roboto Slab** for everything else.

- `--font-ui` and `--mono` now point at Roboto Slab. References and tables use even-width figures, so
  columns still line up.
- `code`, `kbd`, `pre` and `samp` use the platform face; the browser would otherwise use Consolas.
- Inter's file and route are gone: 48 KB less on a first visit.
- **Characters Roboto Slab does not have** were drawing in Windows fonts (Cambria, Segoe UI Symbol,
  Segoe UI Emoji, Microsoft YaHei, Arial). They are dealt with as follows:
  - **→ ← ↔** — used as words in phrases ("QS prepares → PM approves") and in a few lookup keys. They
    are drawn in a 748-byte font, *AETRAA Arrows*: built with fontTools to Roboto Slab's proportions,
    served at `/fonts/aetraa-arrows.woff`, and declared as part of the Roboto Slab family for those
    three characters only. The wording and the keys are unchanged.
  - **＋** became **+** and **✕** became **×**. Both are in Roboto Slab.
  - **Icons:** ⬇ ⬆ ⏱ ▶ ↻ 📷 ↗, the handover ticks, the workflow toggles and the legacy dashboard's status
    symbols became line icons. The ✍ on "signs" chips became the pen icon (a CSS mask), and the
    dashboard's done-step ✓ also uses the icon.
  - **The report preview (`/reports`)** shows the report in Roboto Slab. The emailed and Word copies
    keep their inline Arial, which mail programs reliably have.
  - **Not changed:** the test email body (`/api/email-check`) and the diary Word document's ✓. Those
    are documents and mail, not screens.
- Measured in Chrome, glyph by glyph, on all 51 screens (49 pages signed in as the PM or the AETRAA
  Admin, plus the signed-out sign-in and demo pages): every character is drawn in Roboto Slab, Bebas
  Neue or the arrows font, and no other.

# Launch-ready: accounts, My files, real data only, integrations (27 Oct 2026)

Girish asked for the platform to work like an ordinary website on Ajay's Azure UAE backend, with these
decisions:
- open self sign-up, no approval;
- a private "My files" drive per person;
- integrations with Revit and the other two programs in both directions;
- no sample data anywhere.

`LAUNCH.md` is the deploy note for Ajay. `docs/INTEGRATION.md` and `docs/openapi.json` are the guide
for the integration code.

**Accounts** (`src/accounts.js`, new; `src/html/auth.js`, new; `src/html/login.js` now re-exports it):
- `/signup` makes a self-serve company, active at once, with the person as its Principal. They are
  signed in straight away. `SIGNUP_ENABLED=off` closes it.
- Passwords are PBKDF2-SHA256, 600,000 rounds (`PASSWORD_ITERATIONS`), with their own salt. A
  password needs 10 or more characters, must not be a common password, and must not contain the
  email name.
- `/` logs in with email and password. The emailed code and the site code are kept, under "Other
  ways to sign in".
- `/forgot` resets the password with an emailed code. `/account` changes the password; someone who
  never had one can set one.
- `/welcome` is the home page for someone with no project yet. A self-serve Principal creates their
  first project there (`POST /api/self/project`). A company AETRAA set up keeps that to the AETRAA
  Admin.
- **Guess counting** (`auth_throttle`, counted atomically):
  - 10 wrong passwords per email per 15 minutes;
  - limits per address on log-in, sign-up and code requests.
  - An unknown email gets the same answer, in about the same time, as a wrong password.
- **Emailed codes** (`src/org.js` `spendTry`): a try is claimed with `UPDATE … RETURNING` before the
  code is compared. Previously, 30 parallel guesses all went through.

**My files** (`src/myfiles.js`, `src/html/myfiles.js`, new; `/myfiles`, `/api/myfiles/*`):
- Each person's own folders and files: upload (with progress and drag-and-drop), download, rename,
  move, search, delete, and attach to a record.
- Stored through `src/storage.js` (Azure Blob when configured).
- Limits: 2 GB each (`MYFILES_QUOTA_MB`) and 100 MB per file (`MYFILES_MAX_MB`).
- Programs, scripts, web pages and SVGs are refused. Only PDFs and pictures open in the browser.
- Nobody else, not even the AETRAA Admin, can open them. Under "YOU", the menu has My files and Your
  account.

**Integrations** (`src/integrations.js`, `src/html/integrations.js`, new; `/integrations`, `/api/v1/*`):
- API keys per company, made by the Principal: shown once, only a hash kept, scopes read/write,
  revocable.
- `/api/v1` answers to a key only. It lists projects and takes items into a project inbox. Re-sending
  an item with the same `external_id` updates it. Files can be attached.
- **Connectors** (`INTEGRATIONS`, `INTEGRATION_<NAME>_URL/_SECRET/_LABEL`): AETRAA calls the other
  side with HMAC-SHA256-signed POSTs, every call is logged, and there is a Test button.
- `INBOX_HANDLERS` is where each program's data is mapped into the registers. It is empty until the
  data shapes are agreed.

**No sample data:**
- `/demo` answers 404 unless `DEMO_MODE=on`.
- The team view's sample projects and "recent access changes" are replaced with the person's real
  projects and the audit log (`teamRightLive` in `src/html/app.js`).
- Everything else on the dashboards was already live; checked by signing in as every role.

**Security:**
- **Uploaded files:** a drawing uploaded as `data:text/html`, or a library file declared
  `text/html`, used to open on the site as a page, where its script could read `/api/people`.
  `uploadedFileHeaders` in `src/index.js` now does the following, on `/dwg/*` and
  `/api/library/file`:
  - only PDF and PNG/JPEG/WebP/GIF are inline;
  - everything else is an `application/octet-stream` attachment;
  - always `nosniff`, plus a sandboxing CSP.

  The quarantine, generated-PDF and diary routes were already safe, because their type comes from
  the extension or from the server.
- **`server.js`:**
  - passes all the new settings through, including any `INTEGRATION_…`;
  - refuses requests over `MAX_BODY_MB` (default 256) with 413, before reading them into memory.

  `local.mjs` passes the same settings.
- **`src/ai.js`:** the subscription mode runs `claude` in an empty temporary folder, never the app's
  folder.
- The font route serves `/fonts/<name>` for woff and woff2.

**Tests** (new):
- `test-accounts.mjs` (46 checks);
- `test-myfiles.mjs` (43);
- `test-integrations.mjs` (38);
- `test-upload-safety.mjs` (5);
- `test-pg-launch.mjs` (27, on PostgreSQL: sign-up, guess counting, code bursts, My files, the API
  inbox).

`tools/_harness.mjs` keeps cookies by name and can send raw bytes (`callRaw`).

Checked:
- `check-page-scripts` 78/0;
- `check-theme` 61/0;
- `run-all` 39 files, 0 failing.

Nothing committed, pushed or deployed.

**Afterwards, from the screenshots (same day):**
- **Sidebar note:** the dashboard sidebar said "Projects are fixed — new projects can't be added" even
  to a self-serve Principal. It now shows **+ New project** (to `/welcome`) for anyone allowed to
  create projects, and "Projects are set up by AETRAA" for everyone else. The welcome page says
  "Create a project" and links back to the dashboard.
- **44px touch targets at phone width** (they were 32px):
  - the password "Show" buttons;
  - My files' row actions, breadcrumb and names;
  - the Revoke button;
  - the dashboard's project and view selects;
  - the small card buttons.
- Measured at 375px on all eight launch pages: no sideways scroll and no script errors.
