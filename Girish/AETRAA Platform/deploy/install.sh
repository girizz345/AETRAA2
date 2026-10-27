#!/bin/bash
# ---------------------------------------------------------------------------
#  AETRAA — first-time set-up of the app server (Oracle Linux 9 on OCI).
#
#  Paste this whole file into "Cloud-init script" when you create the compute
#  instance (Advanced options → Management), or run it once as root:
#
#     sudo bash install.sh
#
#  It installs Node 22, creates a locked-down 'aetraa' user, installs the
#  systemd service, turns on automatic security updates, and opens the app port
#  in the host firewall. It does NOT install the app itself or any secret — the
#  app arrives with deploy/update.sh, the secrets come from OCI Vault at start.
#  Safe to run again.
# ---------------------------------------------------------------------------
set -euo pipefail
log() { echo "[aetraa-install] $*"; }

# 1. Node.js 22 — from Oracle Linux AppStream; NodeSource only if that stream is missing.
if ! command -v node >/dev/null || ! node -v | grep -q '^v22\.'; then
  if dnf module list nodejs 2>/dev/null | grep -qE '^nodejs +22'; then
    dnf module reset -y nodejs && dnf module enable -y nodejs:22 && dnf install -y nodejs
  else
    curl -fsSL https://rpm.nodesource.com/setup_22.x | bash - && dnf install -y nodejs
  fi
fi
log "node $(node -v)"

# 2. Tools: OCI CLI (reads secrets from Vault as this instance), tar, jq.
dnf install -y tar jq oraclelinux-developer-release-el9 && dnf install -y python39-oci-cli || true
command -v oci >/dev/null && log "oci cli $(oci --version)" || log "WARNING: OCI CLI not installed — install it before starting the app"

# 3. A user that owns the app and nothing else.
id aetraa >/dev/null 2>&1 || useradd --system --create-home --home-dir /opt/aetraa --shell /sbin/nologin aetraa
mkdir -p /opt/aetraa/releases /etc/aetraa
chown -R aetraa:aetraa /opt/aetraa
chmod 750 /etc/aetraa

# 4. The service, and the secret loader it runs before every start.
install -m 0644 /dev/stdin /etc/systemd/system/aetraa.service <<'UNIT'
[Unit]
Description=AETRAA platform
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=aetraa
Group=aetraa
WorkingDirectory=/opt/aetraa/current
# Secrets are fetched from OCI Vault into memory-backed /run on every start.
# They are never written to the disk image.
# '+' runs the loader as root, outside the sandbox below.
ExecStartPre=+/usr/local/bin/aetraa-load-secrets
EnvironmentFile=/etc/aetraa/aetraa.conf
EnvironmentFile=-/run/aetraa/secrets.env
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=3
# Hardening
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/opt/aetraa
ProtectKernelTunables=true
ProtectControlGroups=true
RestrictSUIDSGID=true
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
UNIT

install -m 0755 /dev/stdin /usr/local/bin/aetraa-load-secrets <<'LOADER'
#!/bin/bash
# Reads each secret named in /etc/aetraa/secrets.list from OCI Vault, as this
# instance (instance principal — no API key on the box), into /run/aetraa.
set -euo pipefail
mkdir -p /run/aetraa && chmod 750 /run/aetraa && chown root:aetraa /run/aetraa
out=/run/aetraa/secrets.env; tmp=$(mktemp -p /run/aetraa)
chmod 640 "$tmp"; chown root:aetraa "$tmp"
while read -r name ocid; do
  [ -z "${name:-}" ] && continue; case "$name" in \#*) continue;; esac
  val=$(oci secrets secret-bundle get --secret-id "$ocid" --auth instance_principal \
        --query 'data."secret-bundle-content".content' --raw-output | base64 -d)
  # multi-line values (the database CA certificate) are kept on one line, quoted
  printf '%s="%s"\n' "$name" "$(printf '%s' "$val" | sed ':a;N;$!ba;s/\n/\\n/g; s/"/\\"/g')" >> "$tmp"
done < /etc/aetraa/secrets.list
mv "$tmp" "$out"
LOADER

# Non-secret settings (edit after install). Secrets go in secrets.list as OCIDs.
[ -f /etc/aetraa/aetraa.conf ] || install -m 0640 -o root -g aetraa /dev/stdin /etc/aetraa/aetraa.conf <<'CONF'
PORT=8787
NODE_ENV=production
TZ_OFFSET_MIN=240
DAILY_HOUR=18
WEEKLY_HOUR=7
PUBLIC_URL=https://app.aetraa.ae
S3_ENDPOINT=https://NAMESPACE.compat.objectstorage.me-dubai-1.oraclecloud.com
S3_BUCKET=aetraa-files
S3_REGION=me-dubai-1
REPORT_FROM="AETRAA <no-reply@aetraa.ae>"
DATA_REGION=UAE (Dubai)
CONF

[ -f /etc/aetraa/secrets.list ] || install -m 0640 -o root -g aetraa /dev/stdin /etc/aetraa/secrets.list <<'LIST'
# NAME  OCID-of-the-secret-in-OCI-Vault   (one per line)
# AUTH_SECRET    ocid1.vaultsecret.oc1.me-dubai-1.xxxx
# OWNER_CODE     ocid1.vaultsecret.oc1.me-dubai-1.xxxx
# DATABASE_URL   ocid1.vaultsecret.oc1.me-dubai-1.xxxx
# DB_CA_CERT     ocid1.vaultsecret.oc1.me-dubai-1.xxxx
# S3_ACCESS_KEY  ocid1.vaultsecret.oc1.me-dubai-1.xxxx
# S3_SECRET_KEY  ocid1.vaultsecret.oc1.me-dubai-1.xxxx
# RESEND_KEY     ocid1.vaultsecret.oc1.me-dubai-1.xxxx
LIST

# 5. Host firewall: only the app port, only from inside the VCN.
if command -v firewall-cmd >/dev/null; then
  firewall-cmd --permanent --add-rich-rule='rule family="ipv4" source address="10.0.0.0/16" port port="8787" protocol="tcp" accept' || true
  firewall-cmd --reload || true
fi

# 6. Security updates, applied automatically every day.
dnf install -y dnf-automatic
sed -i 's/^upgrade_type.*/upgrade_type = security/; s/^apply_updates.*/apply_updates = yes/' /etc/dnf/automatic.conf
systemctl enable --now dnf-automatic.timer

systemctl daemon-reload
systemctl enable aetraa.service
log "done. Next: fill /etc/aetraa/aetraa.conf and /etc/aetraa/secrets.list, then run deploy/update.sh with a release."
