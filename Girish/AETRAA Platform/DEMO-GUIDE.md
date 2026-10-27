# AETRAA — client demo

**Open the demo at:**
`https://aetraa-1b3ece.uaenorth.cloudapp.azure.com/demo`
(once the domain is set up this becomes `app.aetraa.ae/demo`)

That page lists every seat on the job. Click one — **no code, no password, no
email** — and you are inside that person's screens immediately. Sign out
top-left and pick another. Nothing to type in front of a client.

---

## What is in it

An invented contractor, **Contracting Company LLC**, on an invented job:
**Residential Tower — G+2P+12**, Dubai, UAE, AED 80m, finishing July 2027.
Everyone is a **position**, not a person — Project Manager, Document
Controller, QA/QC Engineer. No real company, person or site is named anywhere.

Already loaded: a 31-activity programme, progress reported by two site
engineers, a priced BOQ and BOM with one material over budget, RFIs,
submittals, material approvals, inspections, two NCRs, permits, observations, a
near-miss, plant certificates, three variations, a notice of delay, a week of
safety figures, and a payment application of **AED 34.0m** certified by the
Engineer at **AED 29.7m**.

## The seats

| Seat | What they show |
|---|---|
| Principal | The director's view across the portfolio |
| Project Manager | The main pitch — everything waiting on one person |
| Planning Engineer | Programme, look-ahead, P6 update and export |
| Site Engineer — Civil | The phone screen: report work done |
| Site Engineer — MEP | The same, on the services side |
| Design Manager | Drawings, submittals, technical queries |
| Document Controller | The registers and the correspondence diary |
| QA/QC Engineer | Inspection requests and NCRs |
| HSE Officer | Man-hours, LTIFR, TRIR, permits, observations |
| Quantity Surveyor | BOQ, variations, the payment certificate |
| Consultant (read-only) | What the Engineer's side sees |

---

## Yes — the workflow is in it, and you can show it

Every record carries its own chain of steps, and each step names the **position**
that owns it. Open any record and the right-hand panel is titled **Workflow &
signatures**: green ticks for the steps already signed, an amber marker on the
step it is sitting at right now, and grey for the steps still ahead. Each
signed step shows the position that signed it and the date. Below it sit the
live buttons for whoever is signed in — **Approve & sign**, **Issue**,
**Reject**, or **Record consultant reply**.

The best one to open live: sign in as **Document Controller** and click
**WIR-002 · Podium 2 waterproofing — flood test** in the "To issue / record"
box. You get:

```
 ✓ Raised by engineer              QA/QC Engineer        signed
 ✓ QA/QC checks work ready         Project Manager       signed
 ● Document Control issues to consultant   ← waiting here, and you are that person
 ○ Inspection result recorded      QA / QC
```

Press **Issue** in front of them. The step goes green under the Document
Controller's name, the record moves on, and it offers to notify the team. Then
sign out, come back in as the **Consultant**, and record the result — the same
chain, seen from the other side of the table.

The point to make out loud: *nobody can skip a step, and every step has a name
and a date against it.* That is the whole argument for the system.

**Who raises an RFI**

Not just the design office. The site engineer standing at the clash, QA/QC
unable to inspect against a contradictory detail, the planning engineer blocked
on a sequence, and the QS holding a BOQ item the drawings do not support can
all raise one themselves — the ＋ RFI button is on each of their dashboards.
The PM still approves it before it leaves and Document Control still issues it,
so nothing reaches the consultant unchecked. The demo has one of each, so you
can show a client that the question is asked on the day it is hit, by the
person who hit it, under their own name. That date is what a delay claim turns
on.

**Three chains worth showing**

1. **Inspection (WIR)** — engineer raises → PM checks ready → DC issues to the
   consultant → result recorded. Two minutes, and it lands.
2. **RFI / submittal** — raised → PM approves to issue → DC issues → consultant
   replies with a code (A / B / C / D) → closed. The reply-by clock runs from
   the issue date; when it is missed, it goes red. This is the time-bar argument.
3. **Payment (IPC)** — QS prepares → PM approves → DC issues → Engineer's
   certificate recorded → paid. In the demo the claim is AED 34.0m and the
   certificate AED 29.7m, and the difference is visible line by line.

---

## A twelve-minute run

**1. Project Manager — two minutes.**
"Needs my attention" is the pitch: everything waiting on this one person,
overdue first. Point at the missing site diary and the RFI reply due. Then the
counters along the top: activities, progress, open records, overdue.

**2. Site Engineer — Civil — two minutes.**
The phone screen. He marks an activity finished, adds a photograph, and it goes
to the PM to verify. Nothing counts toward progress or payment until it is
verified. This answers "how do I know the 60% is real".

**3. Document Controller — three minutes.**
The registers and the correspondence diary: every letter, submittal and RFI
leaves through one desk with a reference, a date and a reply-by. **This is
where you press Issue on WIR-002 and show the workflow panel.**

**4. Quantity Surveyor — three minutes.**
The payment application: BOQ line by line with the percentage claimed,
materials on site, retention, then the Engineer's certificate recorded against
it. Download the Excel and the covering letter in front of them.

**5. HSE Officer and QA/QC Engineer — two minutes.**
Man-hours, LTIFR and TRIR out of the daily logs rather than a spreadsheet;
inspection requests and NCRs with the closing evidence.

**6. Finish as the Principal — one minute.**
Portfolio, progress against baseline, money, what is overdue, and who it is
waiting on.

---

## Everything exports to Excel

Every register has a **⬇ Excel** button, and so does every generated schedule.
What downloads is a real workbook, not a comma-separated file with an Excel
name: dates that sort and filter as dates, a frozen header, sensible column
widths, and the columns the screen has no room for — who raised it, when, who
it is waiting on, and how many days late it is. A second **Detail** sheet
carries every field of every record's own form, so the RFI question or the NCR
finding travels with the register.

The drawing register and the priced BOQ export the same way; the BOQ comes out
with live formulas and a section roll-up, so a QS can change a percentage in
the file and watch the total move. Worth doing live in front of a QS — open the
downloaded file at the table.

## Which parts to lean on, by audience

- **Contractors** — the site-to-PM verification loop, the diary, the IPC with
  retention and the Engineer's certificate, NCR closure, time-bar protection.
- **Consultants / PMCs** — the register discipline, reply-by clocks, inspection
  requests, and the reports that come out without anyone compiling them.
- **Developers / clients** — the Principal's view: one page per project,
  progress against the programme, certified to date, and what is late.

---

## Housekeeping

- The demo company is walled off from anything real on the platform. A client
  clicking around it cannot reach another company's data.
- The one-click seats work **only** for this demo company. Every real customer
  still signs its office people in by email.
- Anything a client changes during a demo stays changed. To put it back —
  clean data, fresh records — delete the demo company in the setup console
  (sign in with the owner code) and run, on the server:
  ```
  ssh aetraa-admin@20.216.19.138 "sudo bash -c 'cd /opt/aetraa/current && \
    node tools/demo-live.mjs http://127.0.0.1:8787 <owner code>'"
  ```
  The new company must be able to claim the `@demo.aetraa.ae` addresses, so
  rename the old company's people first (prefix them `old-`) or the seed stops
  on "somebody already uses that email address".
- Do not publish the `/demo` link where search engines will find it. Send it to
  a named prospect, the same way you would a quotation.
