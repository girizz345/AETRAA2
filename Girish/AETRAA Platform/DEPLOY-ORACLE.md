# Going live on Oracle Cloud (UAE) — step by step

Everything runs in the **UAE East (Dubai)** region, `me-dubai-1`. Budget about
**half a day** for the first set-up. Each part says who does it:
**You** (needs your identity, card or logins) or **Either** (Claude can do it with
you, or drive the console in your browser while you watch).

```
 Internet ──► WAF ──► Load balancer (HTTPS, app.aetraa.ae)       public subnet
                            │  port 8787 only
                            ▼
                     App server (Node 22)                          private subnet
                        │                │
         port 5432 only │                │ HTTPS (S3 API)
                        ▼                ▼
          PostgreSQL (managed)     Object Storage bucket           private
                                   Secrets: OCI Vault
```

Nothing but the load balancer has a public address. The app server and the
database cannot be reached from the internet at all.

---

## Part A — Before you start (You)

1. **Oracle account.** Sign up at oracle.com/cloud. When asked for a
   *Home Region*, choose **UAE East (Dubai)** — it cannot be changed later.
   Upgrade to **Pay As You Go** (the free trial limits shapes and services).
2. **Secure the account.** Turn on multi-factor sign-in for your user
   (Profile → *My profile* → *Multi-factor authentication*). Create a second
   admin user for day-to-day work; keep the first one for emergencies.
3. **Domain access.** You need to be able to add DNS records for `aetraa.ae`.
4. **Email.** Create a Resend account and add the domain `aetraa.ae`. It shows 3–4
   DNS records (SPF / DKIM) to add. Create an API key. (Sign-in codes and reports
   are sent this way.)
5. **SSL certificate** for `app.aetraa.ae` — buy a 1-year DV certificate from your
   domain registrar and download it (certificate, chain, private key). You will
   import it in Part F. *Set a calendar reminder 30 days before it expires.*
6. **Cost check.** Put the stack below into Oracle's Cost Estimator
   (oracle.com/cloud/costestimator.html), region Dubai, and confirm the monthly
   figure before you create anything.

## Part B — Network (Either)

1. **Compartment.** Identity → Compartments → *Create* → `aetraa-prod`.
   Create everything below inside it.
2. **VCN.** Networking → Virtual cloud networks → **Start VCN Wizard** →
   *Create VCN with Internet Connectivity*. Name `aetraa-vcn`, CIDR `10.0.0.0/16`.
   This makes a public subnet, a private subnet, an internet gateway, a NAT
   gateway (so the server can fetch updates) and a service gateway.
3. **Network security groups** (VCN → *Network security groups* → *Create*):

   | NSG | Allow in | From |
   |---|---|---|
   | `nsg-lb` | TCP 443 and 80 | `0.0.0.0/0` |
   | `nsg-app` | TCP 8787 | `nsg-lb` |
   | `nsg-db` | TCP 5432 | `nsg-app` |

   Remove the wizard's default rule that opens SSH (22) to the internet on the
   subnets' security lists. Nothing needs it — maintenance goes through Bastion.

## Part C — Database and files (Either)

1. **PostgreSQL.** Databases → *PostgreSQL* → *Create DB system*.
   Version 16 (or the newest offered), the smallest shape to start, storage
   **with backups on** (daily, 14+ days kept). Private subnet, NSG `nsg-db`.
   Admin user `aetraa`, strong password. When it is ready, open it and note the
   **endpoint**, and download the **CA certificate**.
   Connection string: `postgres://aetraa:PASSWORD@ENDPOINT:5432/postgres`
   (or create a database `aetraa` and use that name).
2. **Bucket.** Storage → Buckets → *Create* → `aetraa-files`, **private**,
   *Object versioning* on. Note the **namespace** (top of the Buckets page).
3. **S3 key for the app.** Identity → your service user (create one called
   `aetraa-app`, in a group that may only manage objects in `aetraa-files`) →
   *Customer secret keys* → *Generate*. Copy the access key and secret now — the
   secret is shown only once.

## Part D — Secrets (Either)

1. Identity & Security → **Vault** → *Create vault* `aetraa-vault`, then
   *Create key* `aetraa-master` (software-protected is fine).
2. In the vault → *Secrets* → create one secret for each of these:

   | Secret | Value |
   |---|---|
   | `AUTH_SECRET` | 48 random characters (e.g. `openssl rand -base64 36`) |
   | `OWNER_CODE` | 24+ random characters — the AETRAA Admin master code. **Write it down somewhere safe.** |
   | `DATABASE_URL` | the connection string from C1 |
   | `DB_CA_CERT` | the whole CA certificate text from C1 |
   | `S3_ACCESS_KEY` / `S3_SECRET_KEY` | from C3 |
   | `RESEND_KEY` | from A4 |

   Note each secret's **OCID** (copy button on its page).
3. **Let the server read them.** Identity → *Dynamic groups* → create
   `aetraa-app-servers` with rule `instance.compartment.id = '<aetraa-prod OCID>'`.
   Then *Policies* → create in `aetraa-prod`:
   ```
   Allow dynamic-group aetraa-app-servers to read secret-family in compartment aetraa-prod
   ```

## Part E — The app server (Either)

1. Compute → Instances → *Create*. Name `aetraa-app-1`.
   Image **Oracle Linux 9**. Shape `VM.Standard.E5.Flex`, 1 OCPU / 8 GB to start.
   Networking: **private subnet**, NSG `nsg-app`, **no public IP**.
   Add your SSH public key. *Advanced options → Management → Cloud-init script*:
   paste the whole of `deploy/install.sh`.
2. **Bastion.** Identity & Security → Bastion → create one on the private
   subnet. Use *Create session* whenever you (or Claude, with you) need to get on
   the server; sessions expire by themselves.
3. On the server (through a Bastion session):
   - edit `/etc/aetraa/aetraa.conf` — put your bucket **namespace** into
     `S3_ENDPOINT`, and check `PUBLIC_URL`;
   - edit `/etc/aetraa/secrets.list` — one line per secret, `NAME  OCID`.
4. **Put the app on it.** On your Mac, in the `AETRAA Platform` folder:
   `bash deploy/make-release.sh` → it writes `releases/aetraa-release-<date>.tgz`.
   Upload that file to a private bucket `aetraa-releases`, create a
   *Pre-authenticated request* (read, expires in 1 day), and on the server run:
   ```
   cd /tmp && curl -fsSL -o release.tgz 'https://…the pre-authenticated link…'
   tar -xzf release.tgz deploy/update.sh && sudo bash deploy/update.sh release.tgz
   ```
   It installs, starts, checks `/healthz`, and rolls back by itself if the new
   version does not come up.

## Part F — Load balancer, certificate, firewall (Either)

1. Identity & Security → **Certificates** → *Import certificate* — the files
   from A5.
2. Networking → **Load balancers** → *Create* (Flexible, 10–100 Mbps), **public**
   subnet, NSG `nsg-lb`.
   - Backend set: `aetraa-app-1` port **8787**, health check **HTTP `/healthz`**,
     expect 200.
   - Listener **HTTPS 443** with the imported certificate → backend set.
   - Listener **HTTP 80** → a rule that redirects everything to HTTPS.
   Note the load balancer's **public IP**.
3. Identity & Security → **Web Application Firewall** → *Create policy*
   `aetraa-waf`, attach it to the load balancer:
   - *Protections*: turn on the recommended (OWASP) rule set.
   - *Rate limiting*: `/api/signin/*` and `/api/login` — 10 requests per minute
     per IP address.
   - *Access control*: `/api/setup/*` (everything the AETRAA Admin console does) — allow only your office IP
     address(es); everyone else gets 403.
4. **Cloud Guard**: Identity & Security → Cloud Guard → *Enable* (free).
   Add the **Vulnerability Scanning** recipe for `aetraa-prod` (free).

## Part G — Go live (You, with Claude)

1. **DNS**: add an `A` record `app` → the load balancer IP. Add Resend's records.
2. Open **https://app.aetraa.ae**, sign in with the `OWNER_CODE`.
3. Open **https://app.aetraa.ae/api/storage** — it must say
   `"working": true, "wrote_to": "s3"`.
4. Create a test company and project with some modules, add yourself as a
   Document Controller, check that the sign-in email arrives and that a
   notification reaches the bell.
5. **Backups**: in the PostgreSQL console, restore last night's backup to a new
   DB system once, check it opens, then delete it. *A backup nobody has restored
   is not a backup.*

### Go-live checklist

- [ ] `LOGIN_TEST_CODE` is **not** in the secrets list
- [ ] `AUTH_SECRET` and `OWNER_CODE` are random and from Vault (the server refuses short ones)
- [ ] `DB_CA_CERT` is set (the server warns on start if not)
- [ ] `/api/storage` → `working: true`, `wrote_to: "s3"`
- [ ] App server and database have **no public IP**; SSH is closed to the internet
- [ ] WAF attached: OWASP rules, sign-in rate limit, `/api/setup/*` limited to office IPs
- [ ] Database backups on, and one restore tested
- [ ] Cloud Guard and vulnerability scanning on
- [ ] Certificate expiry in your calendar
- [ ] Sign-in email arrives from `no-reply@aetraa.ae`
- [ ] Penetration test booked before the first paying client

---

## Updating later

On the Mac: `bash deploy/make-release.sh` → upload → on the server
`sudo bash /opt/aetraa/current/deploy/update.sh '<link>'`. It keeps the last five
releases and rolls back by itself if a release is unhealthy.

## One server at first

The daily and weekly reports are timed inside `server.js`. Run **one** app
server; with two, every report would go out twice. (When a second server is
needed, the timer moves to a single scheduled job first.)

## Settings reference

Everything is an environment variable; the service reads non-secret ones from
`/etc/aetraa/aetraa.conf` and secrets from Vault (via `/etc/aetraa/secrets.list`).

| Variable | Where | What |
|---|---|---|
| `DATABASE_URL` | Vault | PostgreSQL connection string |
| `DB_CA_CERT` | Vault | PostgreSQL CA certificate (verifies the database) |
| `AUTH_SECRET` | Vault | signs every sign-in (32+ chars, required) |
| `OWNER_CODE` | Vault | AETRAA Admin master code (16+ chars, required) |
| `S3_ACCESS_KEY`, `S3_SECRET_KEY` | Vault | Object Storage customer secret key |
| `RESEND_KEY` | Vault | email |
| `S3_ENDPOINT`, `S3_BUCKET`, `S3_REGION` | conf | `https://<namespace>.compat.objectstorage.me-dubai-1.oraclecloud.com`, `aetraa-files`, `me-dubai-1` |
| `REPORT_FROM` | conf | sender, on your verified domain |
| `PUBLIC_URL` | conf | `https://app.aetraa.ae` |
| `PORT`, `TZ_OFFSET_MIN`, `DAILY_HOUR`, `WEEKLY_HOUR` | conf | 8787, 240, 18, 7 |

`LOGIN_TEST_CODE` must never be set in production — anyone who knows it can
sign in as anyone.

## Tests

`npm test` (after `npm install`) runs everything, including PostgreSQL
(`tools/test-postgres.mjs`, on PGlite) and real browsers. Run it on the Mac
before every release.
