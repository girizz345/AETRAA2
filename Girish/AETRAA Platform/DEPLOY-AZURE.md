# Going live on Microsoft Azure (UAE North, Dubai)

Everything runs in **UAE North (Dubai)**, so project data stays in the UAE.
One script builds the whole platform; Claude runs it with you in Azure Cloud Shell.
Budget about **1 hour** on the day, most of it waiting for Azure.

```
 Internet ──► App server (Ubuntu 24.04)  ports 443/80 only (+ SSH, key-only)
              Caddy: HTTPS, certificate renewed automatically
                 │ 127.0.0.1:8787
              AETRAA (Node 22, systemd service, restarts itself)
                 │ TLS, certificate verified
              PostgreSQL 16 — Azure managed, 7-day automatic backups
              (only the app server's address is allowed in)
```

Who does what: **You** = needs your identity, card or logins. **Claude** = Claude
does it, driving the browser while you watch, or tells you exactly what to paste.

---

## Part A — The account (You, ~15 min)

1. Sign up at **https://azure.microsoft.com/free** with your aetraa.ae email.
   A credit card is needed (a $1 hold is placed and released; prepaid cards are refused).
2. You get **$200 for 30 days**, then **12 months of free services** — but only if
   you **upgrade to pay-as-you-go before day 30** (Portal → *Subscriptions* →
   *Upgrade*). Staying inside the free amounts still costs nothing.
3. Turn on **multi-factor sign-in** for your account (Microsoft prompts you; accept).
4. Set a **budget alert**: Portal → *Cost Management* → *Budgets* → *Add* →
   monthly **$10**, alert at 80% to your email. Nothing is billed without you knowing.

## Part B — Build it (Claude, ~30–40 min)

1. In the portal, click **Cloud Shell** (the `>_` icon, top bar) → **Bash**.
   When asked about storage, choose **Mount storage account** (a few cents a
   month) — it keeps the server's SSH key and the setup notes between sessions.
2. **Manage files → Upload** the newest file from `AETRAA Platform/releases/`.
3. Run:

   ```bash
   tar -xzf aetraa-release-*.tgz deploy/azure
   bash deploy/azure/azure-setup.sh aetraa-release-*.tgz
   ```

   It creates, in resource group `aetraa-rg`:

   | Item | Size | Free for 12 months |
   |---|---|---|
   | App server `aetraa-app`, Ubuntu 24.04 | B2ats v2 (2 vCPU, 1 GB) + 2 GB swap | yes (750 h/month) |
   | Disk | 64 GB premium SSD | yes (2 × 64 GB) |
   | Database `aetraa-db-xxxxxx`, PostgreSQL 16 | Burstable B1ms, 32 GB, 7-day backups | yes (750 h + 32 GB) |

   If the free server size isn't offered in the region, it takes the nearest
   small size and **says it is billed**.
4. At the end it prints the address — `https://aetraa-xxxxxx.uaenorth.cloudapp.azure.com`
   — and the **OWNER CODE**. **Write the owner code down somewhere safe**: it is the
   master key to every company on the platform. It is also kept in
   `~/aetraa-azure.env` in your Cloud Shell (only you can read it).

The script can be run again safely: it keeps whatever already exists.

## Part C — Your own address, app.aetraa.ae (You + Claude, ~10 min)

1. **You**, at whoever manages aetraa.ae DNS: add an **A record**
   `app` → the server's public IP (the script prints it).
2. **Claude**, once the record resolves (minutes to an hour):
   ```bash
   ssh aetraa-admin@<IP> sudo aetraa-config domain app.aetraa.ae
   ```
   Caddy fetches the certificate by itself and renews it — no certificate to buy.

## Part D — Email (You + Claude, ~15 min)

Sign-in codes, reports and the morning list go out through **Resend**.

1. **You**: create an account at resend.com, add the domain `aetraa.ae`, add the
   3–4 DNS records it shows, create an API key.
2. **Claude**: `ssh aetraa-admin@<IP> sudo aetraa-config RESEND_KEY re_xxxxxxxx`

Until this is done, sign in with the owner code — it needs no email.

## Part E — First sign-in (You + Claude)

Open the address → sign in with the **owner code** → create the company, your admin
user, the first project and its modules → invite the team.

---

## Running it

| Task | Command (from Cloud Shell) |
|---|---|
| New release | upload it, then `scp aetraa-release-X.tgz aetraa-admin@<IP>:/tmp/ && ssh aetraa-admin@<IP> sudo aetraa-update /tmp/aetraa-release-X.tgz` — checks health, rolls back by itself if the new one fails |
| Change a setting | `ssh aetraa-admin@<IP> sudo aetraa-config KEY value` |
| See the log | `ssh aetraa-admin@<IP> sudo journalctl -u aetraa -n 100` |
| Restore the database | Portal → the database → *Restore* → pick any moment in the last 7 days |
| Lost the SSH key (new Cloud Shell) | `az vm user update -g aetraa-rg -n aetraa-app -u aetraa-admin --ssh-key-value "$(cat ~/.ssh/id_rsa.pub)"` (after `ssh-keygen` if needed) |

Security updates install every day by themselves; if one needs a reboot, it
happens at 03:00 UAE time.

## Cost after the free year (UAE North, list price)

| Item | Monthly |
|---|---|
| App server moved up to **B2als v2** (2 vCPU, 4 GB) — recommended when clients go live | ~$33 (or $233/year reserved ≈ $19/month) |
| Database B1ms + 32 GB | check in the Azure pricing calculator before year two |
| Disk, bandwidth | a few dollars |

Move the server up any time: Portal → `aetraa-app` → *Size* → B2als v2 → *Resize*
(a restart of about 2 minutes).

## How this differs from the Oracle plan

- The app server has its own public address (HTTPS and key-only SSH) instead of
  sitting behind a load balancer; the database is reachable only from that
  address and only over verified TLS.
- Settings and secrets live in `/etc/aetraa/aetraa.env`, readable only by root
  and the app, on an Azure-encrypted disk, instead of in a vault service.
- Uploaded files (photos, drawings) are kept in the database for now. When they
  grow, they move to Azure Blob Storage — a small change, made when needed.
