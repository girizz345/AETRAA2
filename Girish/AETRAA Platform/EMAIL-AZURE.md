# Email on your own Azure account

AETRAA now sends email two ways, and picks between them from configuration:

| Driver | Turned on by | Used for |
|---|---|---|
| **Azure Communication Services** | `ACS_CONNECTION_STRING` (or `ACS_ENDPOINT` + `ACS_KEY`) | your own Azure tenant |
| **Resend** | `RESEND_KEY` | the fallback, if you ever want it |
| none | neither is set | the app runs, and simply never emails |

If both are set, **Azure wins**. Nothing above the `sendEmail()` function knows
which one ran, so switching provider later is a config line, never a rewrite.

This is the same arrangement the file store already uses for R2 / S3 / database.

---

## What this fixes

Sign-in codes go by email. With no email configured, a person types their
address at the sign-in form and gets an error instead of a code — which is
exactly what you hit. Reports and notifications are silent in the same way.

---

## Why Azure rather than Resend

Everything else already runs in your Azure subscription: the VM, the database,
the backups. Putting email there too means one invoice, one tenant, one set of
access controls, one audit trail — and no second vendor holding a copy of who
signs in to your platform and when.

**Your data location can be United Arab Emirates.** Azure Communication
Services lets you pick the geography when you create the resource, and UAE is
on the list. Resend does not offer that.

---

## Setting it up — the Azure side

You do these in the portal yourself; I can't create resources in your
subscription.

### 1. Create an Email Communication Service

Portal → **Create a resource** → search *Email Communication Service*.

- Subscription / resource group: the same ones as `aetraa-app`
- Name: e.g. `aetraa-email`
- **Data location: United Arab Emirates**

### 2. Add your domain

Inside that resource → **Provision domains** → **Add domain**.

Two choices, and the difference matters more than it looks:

| | Azure managed domain | Your own domain (`aetraa.ae`) |
|---|---|---|
| Set-up | one click, no DNS | add DNS records, verify |
| Sender looks like | `DoNotReply@<random>.azurecomm.net` | `no-reply@aetraa.ae` |
| **Sending limit** | **10 per hour — cannot be raised** | 30/min, 100/hour, **raisable on request** |

Use the managed domain to prove it works this week. **Do not run a real
project on it** — ten emails an hour will not carry a morning's sign-ins.

For `aetraa.ae`, Azure gives you TXT, SPF and DKIM records to add wherever
your DNS is hosted, then verifies them. Budget an hour, mostly waiting for DNS.

### 3. Create (or reuse) the Communication Service

Portal → **Create a resource** → *Communication Service*. Same resource group,
same UAE data location.

If you already have one, use it.

### 4. Connect the domain to it

Communication Service → **Email** → **Domains** → **Connect domain**, and pick
the domain from step 2.

This step is the one everyone forgets. A verified domain that is not
*connected* gives a 403 on every send — the app will tell you so in those words.

### 5. Copy the connection string

Communication Service → **Keys** → copy the **connection string** whole. It
looks like:

```
endpoint=https://aetraa.uae.communication.azure.com/;accesskey=BASE64KEY==
```

---

## Setting it up — the server side

Two commands, over SSH:

```bash
ssh aetraa-admin@20.216.19.138

sudo aetraa-config ACS_CONNECTION_STRING "endpoint=https://…/;accesskey=…"
sudo aetraa-config REPORT_FROM "AETRAA <no-reply@aetraa.ae>"
```

Quote both values — the connection string contains `;` and `=`, which the shell
would otherwise eat. Each command restarts the app; it is back in a few seconds.

**`REPORT_FROM` is not optional on Azure.** Resend has a shared test sender to
fall back on; Azure has nothing of the kind, so with no sender set, nothing
sends. The app says so plainly rather than failing quietly.

---

## Checking it worked

Sign in as owner → **People** → the email panel at the top now reads:

> Email goes out as **AETRAA <no-reply@aetraa.ae>** through Azure
> Communication Services · 4 of 11 people sign in by email

Then **Send a test to me**. If it does not arrive, the message you get back is
the actual reason, not a generic failure:

| What you see | What to do |
|---|---|
| *Azure refused the key* | recopy the connection string from the Keys blade |
| *Azure refused the sender … domain must be provisioned AND connected* | you missed step 4 |
| *Azure email is configured but no sender address is set* | set `REPORT_FROM` |
| *the Azure access key is not in the form Azure issues* | the key got truncated or unquoted |
| *Azure is rate-limiting* | you are on the managed domain's 10/hour, or need a quota rise |

---

## The limit to watch

On a custom domain you start at **30 per minute / 100 per hour**, and a quota
increase is a support request that takes up to 72 hours.

One project's morning sign-ins and a daily report are nowhere near that. Four
contractors onboarding at once, each with a dozen people, is. **Raise the quota
before you onboard a company, not on the morning you do it** — that is the one
thing here with a three-day lead time.

Other ceilings: 50 recipients per message (the app caps at 30 anyway), 10 MB
per message including attachments.

---

## What changed in the code

| File | What |
|---|---|
| `src/email-azure.js` | new — the driver: config, HMAC signing, send, error reading |
| `src/index.js` | `emailDriver()`, and `sendEmail()` / `emailStatus()` / `emailAdvice()` now per-driver |
| `server.js` | reads the ACS settings; says at boot which provider is live |
| `src/html/people.js` | the email panel names the provider and gives the right fix |
| `deploy/azure/server-setup.sh` | the config examples |
| `tools/test-email-azure.mjs` | new — 84 checks |

**On the signing.** ACS does not take a bearer token; every request is signed
HMAC-SHA256 with the access key. A signature that is merely well-shaped is
useless — the service answers 401, the code never arrives, and it looks exactly
like someone mistyping their own address. So the signing chain is checked
against Node's own crypto library, which is an entirely separate implementation
from the one the driver uses. If both agree on a fixed key and a fixed string,
the chain is right. There is a check specifically for the classic ACS mistake —
signing the *base64 text* of the key instead of its decoded bytes.

Full suite: **2346 checks, 0 failures.**

---

## Sources

- [Data residency and user privacy for Azure Communication Services](https://learn.microsoft.com/en-us/azure/communication-services/concepts/privacy)
- [Service limits for Azure Communication Services](https://learn.microsoft.com/en-us/azure/communication-services/concepts/service-limits)
- [Quota increase for email domains](https://learn.microsoft.com/en-us/azure/communication-services/concepts/email/email-quota-increase)
- [Email - Send (REST API)](https://learn.microsoft.com/en-us/rest/api/communication/email/email/send)
