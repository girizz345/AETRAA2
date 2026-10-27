> **Run the current code, in `work/test-drive`.** The `src/`, `server.js` and
> `local.mjs` in this folder are an older copy. Double-click **Start AETRAA (Windows).bat**
> or **Start AETRAA (Mac).command** here, or: `cd work/test-drive && npm install && node local.mjs`.
> Data is kept in `work/test-drive/local-data/`.

# AETRAA on your own Mac

```bash
cd "~/Documents/AETRAA Platform"
node local.mjs
```

That's it. It prints an address and an owner code. Open the address.

No database to install, no Docker, no configuration. Node 22 carries SQLite
inside it, so Node is the only requirement. Check with `node -v` — if it says
v22 or later you are ready; if not, install Node from nodejs.org.

---

## What you get

```
──────────────────────────────────────────────────────────
  AETRAA — running on this machine only
──────────────────────────────────────────────────────────
  open        http://127.0.0.1:8788/setup
  intake      http://127.0.0.1:8788/intake

  owner code  local-41241e82ef7b
  database    …/local-data/aetraa.db   (new)
  email       off
──────────────────────────────────────────────────────────
```

The owner code is generated once and kept in `local-data/local.json`, so it
doesn't change under you between restarts.

Stop it with **Ctrl+C**. Your data stays in `local-data/aetraa.db`.

---

## Why bother running it locally

**Intake.** Four hundred drawings dropped onto the hosted platform is four
hundred uploads over a UAE office line. Dropped onto this, the files never
leave the machine they are already sitting on. Setting a project up from a
folder is the one job where local is plainly better — and it's the job you do
most at the start of a project.

**It's where to try things.** A folder that classifies badly, a numbering
scheme you're still working out, a contract whose terms come back wrong. None
of that belongs on the live server in front of a client.

---

## Two things to be clear about

### It is a separate platform, not a window onto the live one

Projects you create here exist here. **Nothing syncs.** That is deliberate: a
local tool that quietly wrote into the live database would be the most
dangerous thing in the repository.

When you have a project set up the way you want it, you still set it up on the
live server — but by then you know the folder classifies cleanly and the
contract terms read correctly, which is most of the work.

### It listens on 127.0.0.1 only

Not on your network, not on the office wifi. The owner code is the master key
to everything on it, and a development server holding a master key must not be
reachable from another machine. If you need it on another machine, that is what
the hosted platform is for.

---

## What differs from the server

| | Local | Server |
|---|---|---|
| Application | **identical** — same `src/index.js` | same |
| Database | SQLite, one file | PostgreSQL |
| Files | in that same file | database, then object storage |
| Email | **off** unless configured | Azure / Resend |

Email is off on purpose. A local copy that could send a sign-in code to a real
client is a bad surprise. Sign in with the owner code instead.

To turn email on for a local test:

```bash
ACS_CONNECTION_STRING="endpoint=…;accesskey=…" \
REPORT_FROM="AETRAA <no-reply@aetraa.ae>" node local.mjs
```

---

## Setting up a project from a folder

1. **`/setup`** → fill the form → **Create as a draft**. Leave the commercial
   terms blank; reading them from the contract is the point.
2. **Drawing numbering** card → add the contractor's prefixes (`ST`, `ME`, `AR`)
   from their drawing register. Until this is set the card says *gate is off*,
   and it means it.
3. **`/intake`** → pick the project → drag the folder in.
4. It scans. **Nothing is written.** One screen, five groups.
5. Contract terms appear in their own panel, each with its clause, sentence and
   page, **none of them ticked**.
6. Commit. Programme, BOQ, BOM, templates and logos go through the importers
   that already exist; everything else lands in the library; conflicts go to
   the held queue.
7. Take it live — deliberately, once you are happy.

---

## If something goes wrong

**`node: command not found`** — install Node 22 from nodejs.org.

**`SQLite is an experimental feature`** — a warning from Node, not an error.
Ignore it.

**Port 8788 already in use** — `PORT=8790 node local.mjs`.

**Start completely fresh** — stop it, delete the `local-data` folder, start it
again. You get a new owner code and an empty database.

**Keep a project you built locally** — `local-data/aetraa.db` is the whole
thing, one file. Copy it somewhere safe.
