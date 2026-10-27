# Setting up a new project

Everything below happens in the **setup console** — sign in on the front page with
the **owner code**, not with an email. That code is the master key to every
company on the platform; it is yours and nobody else's.

One rule governs the order: **create the project first.** The programme, BOQ,
BOM, logos, templates and authorities all attach *to* a project, so none of
those cards will do anything until the project exists.

---

## Before you start — what you actually need

| You have | Where it goes | Notes |
|---|---|---|
| The contract | **Typed in, not uploaded** | See the warning below — this is the step people get wrong |
| Primavera programme (`.xer`) | Setup console → Programme | Export from P6. This is the project's spine |
| Priced BOQ (Excel) | Setup console → Import priced BOQ | Needs a header row |
| BOM / budget quantities (Excel) | Setup console → Import BOM | Optional; only if you run Procurement |
| Consultant's blank forms (`.docx`) | Setup console → Templates | One per document type |
| Logos — client, consultant, contractor | Setup console → Branding | Any size; shrunk automatically |
| Drawings (PDF) | **In the app, not the setup console** | Design / Document Control upload them |

### The contract is not uploaded — it is transcribed

There is no "attach the contract" box, and that is deliberate: the platform does
not read contracts. What it needs is the handful of clauses that drive money and
deadlines, and you type those in on the onboarding form:

- **Retention %** and **retention cap %**
- **Advance %**
- **Payment period (days)** — how long the client has to pay a certificate
- **Notice clause** — e.g. `Sub-Clause 20.2.1`, printed on notices
- **RFI reply (days)** — how long the consultant has before an RFI goes red
- **Contract completion date**

Get these right at onboarding. Every payment certificate, every reply-by clock
and every overdue flag on the project is computed from them. They can be changed
later (Response periods / Payment terms cards), but figures already certified
were worked out with the old ones.

---

## Step 1 — Onboard the project

Setup console → **Onboard a project**. One form, four parts:

**Company (client).** Pick an existing company or create a new one. If new, give
its **email domain** — `naf.ae`. Only addresses at that domain can be added to
its team, which is what stops somebody being invited by mistake. Partner domains
(the consultant, a subcontractor) go in **Also allowed**.

**Project.** Name, reference, location, client, consultant, contractor,
completion date, currency.

**Commercial terms.** The contract figures listed above.

**Modules.** Tick what this project needs. The base platform — Principal and PM
dashboards, programme, progress, team, issues, reports — is always on. The rest
are optional:

| Module | What it adds |
|---|---|
| Planning & look-ahead | Planning dashboard, schedule analysis, delay impact |
| Site progress & daily diary | Site dashboard, daily diary, manpower, material requests |
| Design & submittals | Submittals, method statements, material approvals, RFIs, authority NOCs |
| Drawings & document control | Drawing register, revisions, incoming correspondence |
| QA / QC | Inspections (WIR / MIR), NCRs |
| HSE | Safety log, permits, observations, incidents, certificates |
| Contracts & commercial | Priced BOQ, payment certificates, variations |
| Procurement | Bill of materials, orders, goods received |
| Finance, Subcontractors, Consultant portal | Their own dashboards |

Switching a module off later **hides** it, it never deletes anything. Turn it
back on and every record is where it was. So if in doubt, leave it off — adding
it later costs nothing.

**Principal.** The client's top person: name and the email they will sign in
with. They are the only person created here. **Everyone else is invited from
inside the app**, by the Principal or the PM, under *Team & access*.

Press **Create project & go live**. The project is live immediately.

---

## Step 2 — Load the programme

Setup console → **Programme**. Pick the project, choose the `.xer`, press **Read
the programme**.

Nothing is saved yet. It shows you what it found — activities, dates, logic —
and you save it only if it looks right. The programme is what the whole platform
is measured against: progress, look-aheads, the weekly and monthly reports,
delay, and the S-curve all come from it. A wrong programme loaded on day one is
felt for the life of the job.

---

## Step 3 — Load the priced BOQ

Setup console → **Import priced BOQ** (only appears if you ticked Contracts &
commercial).

Excel or CSV, **first row must be a header**. Recognised columns:

```
Section · Ref · Description · Unit · Qty · Rate · Amount · Billed%
```

`Amount` is optional — it is `Qty × Rate` when left blank. This is what payment
certificates are built from, line by line.

**BOM** (Procurement module) works the same way: `Ref · Material · Unit · Budget
Qty · Rate · Amount`. Re-importing a BOM updates the budgets but **keeps** what
site has already ordered and received.

---

## Step 4 — The consultant's document templates

Setup console → **Consultant document templates**. This is the step that makes
the platform look like it belongs on the job rather than like a tool bolted on.

Take the consultant's own blank Word form — their RFI form, their submittal
form, their transmittal — and in Word, type a placeholder in double braces
wherever a value belongs:

```
{{ref}}      {{title}}     {{date}}
{{Discipline}}             {{Priority}}
```

Any field label from the form itself works as a placeholder. Upload one template
per document type. From then on, every document the platform issues for that
project comes out in **the consultant's exact format**, filled in — so what
leaves your office looks like what the consultant asked for.

Without a template the platform uses its own layout, which is perfectly usable —
but the templates are worth the hour.

---

## Step 5 — Branding and authorities

**Branding.** Logos for client, consultant, second consultant and contractor.
They are printed on the project's documents and reports.

**Authorities.** Pick the emirate and tick the NOCs this project must clear —
DEWA, Civil Defence, the municipality, the master developer. Each one becomes a
tracked item in the authority register with its own reference, action date and
status, so a NOC that is running late shows up as late instead of being
remembered by one person.

---

## Step 6 — Drawings (in the app, not here)

Drawings are **not** loaded from the setup console. They belong to the job, so
the Design office or Document Control uploads them from the **Drawing register**
inside the app, each one with its number, revision, discipline and whether it is
Tender, IFC or a shop drawing.

That is deliberate. Drawings arrive continuously and get revised; the register
tracks revisions and approvals, and only the latest approved revision is the one
site sees. Loading them through setup would lose all of that.

---

## Step 7 — Invite the team

Inside the app, as the Principal or PM: **Team & access**. Add each person by
name and email, and tick the functions they hold — PM, planning, site, design,
document control, QA/QC, HSE, commercial, procurement, finance.

Functions are what the platform actually enforces: who may raise an RFI, who
approves it, who issues it, who signs off progress. One person can hold several
(a QS often holds commercial, procurement and finance).

They sign in with their email — a code is sent to it — so **email must be set up
on the server** before you invite anyone. Until then, only the owner code works.

---

## The order, on one line

> **Project → programme → BOQ → templates → branding → authorities → drawings → team**

Nothing except the project is compulsory to go live. A project with only a
programme loaded already runs progress, look-aheads and reports; you can add the
BOQ the week the first payment application is due.

---

## What to check before you hand it over

- Open the project as the **Principal** — does the programme look right, and do
  the counters read sensibly?
- Raise one test RFI and take it through **PM approves → DC issues**. If a
  template is loaded, download the document and check the format.
- Check the **payment terms** against the contract one more time. Retention and
  the payment period are the two that cause arguments.
- Delete the test records before the client logs in.
