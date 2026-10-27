#!/bin/bash
# ---------------------------------------------------------------------------
#  AETRAA email on Azure — STEP 1 of 2
#
#  Creates the Email Communication Service and adds aetraa.ae to it, then
#  prints the DNS records you must add at server.ae.
#
#  It creates nothing else and changes no DNS. Safe to re-run: every step
#  checks whether the thing already exists first.
#
#  Paste the whole thing into Azure Cloud Shell (bash) and press Enter.
# ---------------------------------------------------------------------------
set -uo pipefail

EMAIL_SVC=aetraa-email
DOMAIN=aetraa.ae

say() { printf '\n\033[1;36m== %s\033[0m\n' "$*"; }
die() { printf '\n\033[1;31mSTOPPED: %s\033[0m\n' "$*"; exit 1; }

say "Azure CLI communication extension"
az extension add -n communication -y >/dev/null 2>&1
az extension update -n communication >/dev/null 2>&1
echo "ready"

say "Finding the resource group that holds aetraa-app"
RG=$(az vm list --query "[?name=='aetraa-app'].resourceGroup | [0]" -o tsv 2>/dev/null)
[ -n "$RG" ] || die "could not find a VM called aetraa-app in this subscription.
Run 'az account list -o table' and check you are on the right subscription."
echo "resource group: $RG"
echo "subscription:   $(az account show --query name -o tsv)"

# ---------------------------------------------------------------------------
say "Email Communication Service ($EMAIL_SVC), data at rest in the UAE"

if az communication email show -n "$EMAIL_SVC" -g "$RG" -o none 2>/dev/null; then
  echo "already exists — leaving it alone"
else
  # The accepted spelling of the data location has changed between API
  # versions, so try the known forms rather than guess one and fail.
  CREATED=no
  for DL in "United Arab Emirates" "UAE" "unitedarabemirates" "uae"; do
    if az communication email create -n "$EMAIL_SVC" -g "$RG" \
         --location global --data-location "$DL" -o none 2>/dev/null; then
      echo "created, data location: $DL"
      CREATED=yes
      break
    fi
  done
  if [ "$CREATED" = no ]; then
    echo "None of the UAE spellings were accepted. Azure's own words:"
    az communication email create -n "$EMAIL_SVC" -g "$RG" \
      --location global --data-location "United Arab Emirates" 2>&1 | tail -20
    die "could not create the Email Communication Service"
  fi
fi

# ---------------------------------------------------------------------------
say "Adding $DOMAIN as a customer-managed domain"

if az communication email domain show --domain-name "$DOMAIN" \
     --email-service-name "$EMAIL_SVC" -g "$RG" -o none 2>/dev/null; then
  echo "already added — leaving it alone"
else
  az communication email domain create --domain-name "$DOMAIN" \
    --email-service-name "$EMAIL_SVC" -g "$RG" --location global \
    --domain-management CustomerManaged -o none \
    || die "could not add the domain"
  echo "added"
fi

# ---------------------------------------------------------------------------
say "THE DNS RECORDS TO ADD AT server.ae"

az communication email domain show --domain-name "$DOMAIN" \
  --email-service-name "$EMAIL_SVC" -g "$RG" \
  --query "verificationRecords" -o json

cat <<'NOTE'

--------------------------------------------------------------------------
READ THIS BEFORE TOUCHING DNS

  * DO NOT add the SPF record.
    aetraa.ae already publishes  v=spf1 include:spf.protection.outlook.com -all
    which is character-for-character what Azure is asking for. A domain may
    carry only ONE SPF record — adding a second breaks mail for BOTH, your
    own Microsoft 365 inbox included. Leave it exactly as it is.

  * DO add the Domain TXT record and the two DKIM CNAME records.
    Extra TXT records are fine (only SPF must be singular), and the DKIM
    hostnames do not exist on aetraa.ae today, so nothing is overwritten.

  * Do not touch the MX records at all.

Then wait 15-30 minutes for DNS to propagate and run step 2.
--------------------------------------------------------------------------
NOTE

say "Step 1 done"
