#!/bin/bash
# ---------------------------------------------------------------------------
#  AETRAA — build the whole platform on Microsoft Azure, UAE North (Dubai).
#
#  Run it in Azure Cloud Shell (Bash) — the >_ icon at the top of the portal.
#  Upload the release file first (Manage files → Upload), then:
#
#     tar -xzf aetraa-release-*.tgz deploy/azure
#     bash deploy/azure/azure-setup.sh aetraa-release-*.tgz  [app.aetraa.ae]
#
#  It creates, in one resource group:
#    - a managed PostgreSQL database (Flexible Server, Burstable B1ms, 32 GB,
#      7-day automatic backups) — free for 12 months on a new account
#    - an Ubuntu 24.04 server (B2ats v2 — free for 12 months — or the nearest
#      size the region offers), 64 GB SSD, web ports 80/443 open
#    - Node 22, Caddy (automatic HTTPS), the AETRAA service, daily security updates
#  then installs the release and checks it answers over HTTPS.
#
#  Safe to run again: whatever already exists is kept. The names and secrets
#  it made are remembered in ~/aetraa-azure.env (your Cloud Shell home — only
#  you can read it). Keep a copy of the OWNER CODE it prints somewhere safe.
# ---------------------------------------------------------------------------
set -euo pipefail
REL="${1:?give the release file, e.g. aetraa-release-20260922-1000.tgz}"
DOMAIN_ARG="${2:-}"
[ -f "$REL" ] || { echo "No file called $REL here. Upload it first (Manage files → Upload)."; exit 1; }
HERE="$(cd "$(dirname "$0")" && pwd)"
[ -f "$HERE/server-setup.sh" ] || { echo "server-setup.sh is missing beside this script."; exit 1; }

LOC="${AETRAA_LOCATION:-uaenorth}"
RG="${AETRAA_RG:-aetraa-rg}"
VM="aetraa-app"
ADMIN="aetraa-admin"
STATE="$HOME/aetraa-azure.env"
log() { echo; echo "== $*"; }
rnd() { openssl rand -hex "$1"; }

# ---- names and secrets: made once, then reused on every run
[ -f "$STATE" ] && . "$STATE"
: "${SUFFIX:=$(rnd 3)}"
: "${PG_NAME:=aetraa-db-$SUFFIX}"
: "${PG_ADMIN:=aetraaadmin}"
: "${PG_PASS:=$(rnd 16)Aa1}"          # 35 chars: lower, upper, digits
: "${AUTH_SECRET:=$(rnd 32)}"         # 64 chars
: "${OWNER_CODE:=$(rnd 12)}"          # 24 chars — the master key
: "${DNS_LABEL:=aetraa-$SUFFIX}"
: "${DOMAIN:=}"
[ -n "$DOMAIN_ARG" ] && DOMAIN="$DOMAIN_ARG"
save_state() {
  ( umask 077; cat > "$STATE" <<EOF
SUFFIX=$SUFFIX
PG_NAME=$PG_NAME
PG_ADMIN=$PG_ADMIN
PG_PASS=$PG_PASS
AUTH_SECRET=$AUTH_SECRET
OWNER_CODE=$OWNER_CODE
DNS_LABEL=$DNS_LABEL
DOMAIN=$DOMAIN
EOF
  )
}
save_state

log "Subscription"
az account show --query "{name:name, id:id}" -o table

log "Registering the services this uses (first time only; can take a minute)"
for ns in Microsoft.Compute Microsoft.Network Microsoft.DBforPostgreSQL; do
  az provider register --namespace "$ns" --wait -o none
done

log "Resource group $RG in $LOC"
az group create -n "$RG" -l "$LOC" -o none

# ---- the server size: the free one if the region has it
pick_size() {
  if [ -n "${AETRAA_VM_SIZE:-}" ]; then echo "$AETRAA_VM_SIZE"; return; fi
  for s in Standard_B2ats_v2 Standard_B1s Standard_B2als_v2 Standard_B2s; do
    if az vm list-skus -l "$LOC" --size "$s" --resource-type virtualMachines \
         --query "[?name=='$s' && length(restrictions)==\`0\`].name" -o tsv 2>/dev/null | grep -qx "$s"; then
      echo "$s"; return
    fi
  done
  echo "none"
}

if az vm show -g "$RG" -n "$VM" -o none 2>/dev/null; then
  log "Server $VM already exists — keeping it"
else
  SIZE="$(pick_size)"
  [ "$SIZE" = none ] && { echo "No small server size is available to this subscription in $LOC. Tell Claude."; exit 1; }
  log "Creating server $VM ($SIZE, Ubuntu 24.04, 64 GB SSD)"
  [ "$SIZE" = Standard_B2ats_v2 ] || [ "$SIZE" = Standard_B1s ] || echo "   note: $SIZE is not in the free 12-month offer — it is billed."
  az vm create -g "$RG" -n "$VM" -l "$LOC" \
    --image Canonical:ubuntu-24_04-lts:server:latest --size "$SIZE" \
    --admin-username "$ADMIN" --generate-ssh-keys \
    --public-ip-sku Standard --public-ip-address "$VM-ip" --public-ip-address-dns-name "$DNS_LABEL" \
    --os-disk-size-gb 64 --storage-sku Premium_LRS --nsg-rule SSH -o none
fi
az vm open-port -g "$RG" -n "$VM" --port 80,443 --priority 1010 -o none
IP="$(az vm show -d -g "$RG" -n "$VM" --query publicIps -o tsv)"
FQDN="$(az network public-ip show -g "$RG" -n "$VM-ip" --query dnsSettings.fqdn -o tsv 2>/dev/null || true)"
echo "   public IP : $IP"
echo "   Azure name: ${FQDN:-none}"

if az postgres flexible-server show -g "$RG" -n "$PG_NAME" -o none 2>/dev/null; then
  log "Database server $PG_NAME already exists — keeping it"
else
  log "Creating the database server $PG_NAME (PostgreSQL 16, B1ms, 32 GB, 7-day backups) — about 5–10 minutes"
  az postgres flexible-server create -g "$RG" -n "$PG_NAME" -l "$LOC" \
    --tier Burstable --sku-name Standard_B1ms --storage-size 32 --version 16 \
    --admin-user "$PG_ADMIN" --admin-password "$PG_PASS" \
    --public-access None --backup-retention 7 --high-availability Disabled --yes -o none
fi
az postgres flexible-server db create -g "$RG" --server-name "$PG_NAME" --database-name aetraa -o none 2>/dev/null || true
# Only the app server may reach the database.
az postgres flexible-server firewall-rule create -g "$RG" --name "$PG_NAME" --rule-name aetraa-app \
  --start-ip-address "$IP" --end-ip-address "$IP" -o none
PG_HOST="$(az postgres flexible-server show -g "$RG" -n "$PG_NAME" --query fullyQualifiedDomainName -o tsv)"

# ---- the address people will use
HOST="${DOMAIN:-$FQDN}"
[ -n "$HOST" ] || { echo "The server has no web name. Tell Claude."; exit 1; }
if [ -n "$DOMAIN" ]; then
  RESOLVED="$(getent hosts "$DOMAIN" | awk '{print $1}' | head -1 || true)"
  if [ "$RESOLVED" != "$IP" ]; then
    echo "   $DOMAIN does not point at $IP yet (it gives: ${RESOLVED:-nothing})."
    echo "   Using $FQDN for now. Add the DNS record, then run:  sudo aetraa-config domain $DOMAIN  on the server."
    HOST="$FQDN"
  fi
fi

log "Settings for the app"
ENVF="$(mktemp)"; chmod 600 "$ENVF"
cat > "$ENVF" <<EOF
PORT=8787
NODE_ENV=production
TZ_OFFSET_MIN=240
DAILY_HOUR=18
WEEKLY_HOUR=7
PUBLIC_URL=https://$HOST
DATA_REGION="UAE (Dubai) — Microsoft Azure UAE North"
REPORT_FROM="AETRAA <no-reply@aetraa.ae>"
DATABASE_URL=postgres://$PG_ADMIN:$PG_PASS@$PG_HOST:5432/aetraa
DB_SSL=verify
DB_POOL_MAX=8
AUTH_SECRET=$AUTH_SECRET
OWNER_CODE=$OWNER_CODE
EOF

log "Waiting for the server to accept SSH"
SSHO=(-o StrictHostKeyChecking=accept-new -o ConnectTimeout=10 -o BatchMode=yes)
for i in $(seq 1 30); do ssh "${SSHO[@]}" "$ADMIN@$IP" true 2>/dev/null && break; sleep 10; done

log "Copying the release and the set-up to the server"
scp "${SSHO[@]}" "$REL" "$HERE/server-setup.sh" "$ADMIN@$IP:/tmp/"
scp "${SSHO[@]}" "$ENVF" "$ADMIN@$IP:/tmp/aetraa.env"
rm -f "$ENVF"

log "Installing on the server (Node, Caddy, the service, the release) — a few minutes"
ssh "${SSHO[@]}" "$ADMIN@$IP" "sudo bash /tmp/server-setup.sh /tmp/aetraa.env /tmp/$(basename "$REL") $HOST"

log "Checking https://$HOST/healthz"
ok=""
for i in $(seq 1 24); do
  if curl -fsS "https://$HOST/healthz" >/dev/null 2>&1; then ok=1; break; fi
  sleep 5
done
save_state

echo
echo "==================================================================="
if [ -n "$ok" ]; then echo "  AETRAA is live:   https://$HOST"; else
  echo "  Installed, but https://$HOST did not answer yet."
  echo "  Wait a minute and open it; if it still fails, send Claude the output above."
fi
echo
echo "  OWNER CODE (the master key — sign in with it, then keep it safe):"
echo "     $OWNER_CODE"
echo
echo "  Server  : $ADMIN@$IP  (ssh from this Cloud Shell)"
echo "  Database: $PG_HOST"
echo "  Names and secrets are kept in $STATE"
echo "==================================================================="
