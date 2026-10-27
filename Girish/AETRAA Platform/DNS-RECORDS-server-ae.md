# DNS records to add at server.ae for aetraa.ae

Azure generated these on 23 September 2026 for the domain `aetraa.ae`
under the Email Communication Service `aetraa-email`.

Your DNS is hosted at **ns90.server.ae / ns91.server.ae** — add these in that
control panel, not in Azure.

---

## ADD THESE THREE

### 1. Domain ownership — TXT

| Field | Value |
|---|---|
| Type | `TXT` |
| Host / Name | `@` (or leave blank, or `aetraa.ae` — whichever the panel wants for the root) |
| Value | `ms-domain-verification=4d431be1-dc24-41b0-8c78-2abcceb9864a` |
| TTL | `3600` |

### 2. DKIM — CNAME

| Field | Value |
|---|---|
| Type | `CNAME` |
| Host / Name | `selector1-azurecomm-prod-net._domainkey` |
| Points to | `selector1-azurecomm-prod-net._domainkey.azurecomm.net` |
| TTL | `3600` |

### 3. DKIM2 — CNAME

| Field | Value |
|---|---|
| Type | `CNAME` |
| Host / Name | `selector2-azurecomm-prod-net._domainkey` |
| Points to | `selector2-azurecomm-prod-net._domainkey.azurecomm.net` |
| TTL | `3600` |

---

## DO NOT ADD THIS ONE

Azure also lists an SPF record:

```
v=spf1 include:spf.protection.outlook.com -all
```

**`aetraa.ae` already publishes exactly this record.** It is identical,
character for character — ACS sends through the same Microsoft infrastructure
your Microsoft 365 mail already authorises.

A domain may carry **only one** SPF record. Adding a second makes the domain's
SPF invalid, and receiving servers then fail *both* — Azure's mail and your own
`@aetraa.ae` inbox. Leave the existing record untouched.

---

## Notes on entering them

- If the panel appends the domain automatically, enter the host as
  `selector1-azurecomm-prod-net._domainkey` and **not** the full
  `selector1-azurecomm-prod-net._domainkey.aetraa.ae` — otherwise you get
  `...._domainkey.aetraa.ae.aetraa.ae`.
- The underscore in `_domainkey` is required. Some panels warn about it; it is
  valid and standard for DKIM.
- Do not touch the MX records.
- Propagation is normally 15–30 minutes, occasionally longer at the stated TTL.

## Then

Back in Cloud Shell:

```bash
for t in Domain DKIM DKIM2; do
  az communication email domain initiate-verification \
    --domain-name aetraa.ae --email-service-name aetraa-email \
    -g aetraa-rg --verification-type $t
done

az communication email domain show --domain-name aetraa.ae \
  --email-service-name aetraa-email -g aetraa-rg \
  --query verificationStates -o json
```

All three must read `Verified` before email will send.
