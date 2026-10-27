# Launching this version (for Ajay)

This version makes AETRAA work like an ordinary website, on the Azure UAE server:

- **People make their own accounts** at `/signup`: name, company, email, password. No approval. They're signed in at once, as the **Principal** of a new company, and create their first project on the welcome page.
- **Log in with email and password.** The emailed six-digit code and the site access code still work, under "Other ways to sign in".
- **Forgotten password:** a code is emailed (`/forgot`). People change their password on **Your account** (`/account`).
- **My files:** each person has a private drive (`/myfiles`) for folders, upload, download, rename, move, search and attaching to a record. The files go to the same store as everything else (Azure Blob when configured).
- **No sample data.** The dashboards show only what is really in the database. The `/demo` page is off unless `DEMO_MODE=on`.
- **Integrations** (`/integrations`): API keys for Revit and the other programs, a project inbox, and signed calls out to your services. Your guide is [`docs/INTEGRATION.md`](docs/INTEGRATION.md); the API description is [`docs/openapi.json`](docs/openapi.json).

Nothing has been committed, pushed or deployed.

---

## 1. Before you deploy

### Email is required now

Sign-up works without email. **Password reset and the emailed sign-in code don't.** Set one of:

```bash
sudo aetraa-config ACS_CONNECTION_STRING "endpoint=https://<name>.communication.azure.com/;accesskey=..."
sudo aetraa-config REPORT_FROM "AETRAA <no-reply@aetraa.ae>"
```

`RESEND_KEY` also works. Check it by using **Forgot your password?** on your own account after deploying.

### Files on Azure Blob

My files and integration files are stored by `src/storage.js`, like drawings. If the server doesn't use Blob yet, follow `deploy/azure/STORAGE.md` first. Without Blob, every upload lands in PostgreSQL, and My files will fill the 32 GB database quickly.

### The database

**No migration to run.** The new tables and columns are created on first use (`CREATE TABLE IF NOT EXISTS`, plus adding columns that are missing). This matches how the K-series tables work.

New tables:
- `auth_throttle`
- `user_files`
- `user_folders`
- `api_keys`
- `integration_inbox`
- `integration_log`

New columns on `users`: `password_hash`, `password_set_at`, `email_verified_at`.

`tools/test-pg-launch.mjs` runs all of it on PostgreSQL.

---

## 2. Settings

All are optional; the defaults are what launch needs. Set one with `sudo aetraa-config NAME value`.

| Setting | Default | What it does |
|---|---|---|
| `SIGNUP_ENABLED` | on | `off` closes `/signup` (people can still be invited). |
| `DEMO_MODE` | off | `on` opens the `/demo` sample page. Leave it off on the live site. |
| `PASSWORD_ITERATIONS` | 600000 | PBKDF2-SHA256 rounds for new passwords. Existing passwords keep the rounds they were made with. |
| `MYFILES_QUOTA_MB` | 2048 | Each person's My files allowance. |
| `MYFILES_MAX_MB` | 100 | The largest single file in My files. |
| `MAX_BODY_MB` | 256 | The largest request the server reads at all. Uploads are held in memory, so this protects the server. |
| `INTEGRATION_MAX_MB` | 200 | The largest file sent in through the API. |
| `INTEGRATION_TIMEOUT_MS` | 30000 | How long AETRAA waits for one of your services to answer. |
| `INTEGRATIONS` | (none) | Your connectors, e.g. `revit,navisworks`. For each, also set `INTEGRATION_<NAME>_URL` and `INTEGRATION_<NAME>_SECRET`, and optionally `INTEGRATION_<NAME>_LABEL`. See `docs/INTEGRATION.md` §4. |

`server.js` passes all of these through. The connector names are read from whatever `INTEGRATION_…` settings exist.

**Guessing limits:**
- 10 wrong passwords per email per 15 minutes, then 15 minutes' wait.
- Five tries per emailed code.
- Limits per address on sign-up and on code requests.

The counters are in `auth_throttle`; the scheduled report job clears old rows, alongside spent sign-in codes.

---

## 3. Deploying

The usual route, from a copy of `work/test-drive`:

```bash
bash deploy/make-release.sh                       # builds aetraa-release-<date>.tgz
# copy it to the server, then:
sudo bash /opt/aetraa/current/deploy/update.sh aetraa-release-<date>.tgz   # the release carries deploy/
```

`update.sh` checks `/healthz` and rolls back if the new release doesn't come up.

**After deploying, check:**

1. `/` shows the new log-in page (email and password).
2. `/signup`: make a test account and a test project, and see the empty dashboard.
3. `/forgot`: the reset email arrives.
4. `/myfiles`: upload a PDF and open it.
5. `/integrations`: make a key, then:
   ```bash
   curl -H "Authorization: Bearer <key>" https://<site>/api/v1/ping
   ```
6. `/demo` answers 404.
7. Afterwards, delete the test company from the Admin screens.

---

## 4. Connecting your code

`docs/INTEGRATION.md` has everything: keys, endpoints, C# and Python examples, the signature check, and where to map each program's data into the registers (`INBOX_HANDLERS` in `src/integrations.js`).

Nothing is written into a register automatically until a handler exists. Items wait on `/integrations` for a person until then.

---

## 5. Security fixes in this version

- **Uploaded files can no longer run as pages on the site.** A drawing or library file uploaded as HTML (or claiming to be `text/html`) used to open inside AETRAA, where its script could read other people's data. Now only PDFs and pictures open in the browser; everything else downloads. `tools/test-upload-safety.mjs` reproduces the old attack.
- **Parallel guessing of an emailed code.** A burst of simultaneous guesses used to get past the five-try limit. Tries are now claimed atomically (`UPDATE … RETURNING`). Checked on SQLite and PostgreSQL.
- **Log-in endpoints are rate-limited** per address and per email.
- **The AI "subscription" mode** runs the `claude` command in an empty temporary folder, never in the app's own folder.
