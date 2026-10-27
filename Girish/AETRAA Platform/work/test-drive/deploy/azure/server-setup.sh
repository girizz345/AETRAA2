#!/bin/bash
# ---------------------------------------------------------------------------
#  AETRAA — set up the app server (Ubuntu 24.04 on Azure). Run as root:
#
#     sudo bash server-setup.sh <settings-file> <release.tgz> <web-name>
#
#  azure-setup.sh runs this for you. It installs Node 22 and Caddy, adds 2 GB
#  of swap on a small server, creates a locked-down 'aetraa' user and the
#  systemd service, puts the settings in /etc/aetraa/aetraa.env (root and the
#  app only), turns on daily security updates, serves the app over HTTPS at
#  <web-name>, and installs the release. Safe to run again.
#
#  Afterwards, on the server:
#     sudo aetraa-update <release.tgz>          install a new release (rolls back if unhealthy)
#     sudo aetraa-config KEY VALUE              change a setting, e.g. RESEND_KEY re_xxx
#     sudo aetraa-config ACS_CONNECTION_STRING "endpoint=https://x.communication.azure.com/;accesskey=..."
#     sudo aetraa-config REPORT_FROM "AETRAA <no-reply@your-domain>"
#     sudo aetraa-config domain app.aetraa.ae   move to your own web address
#     sudo journalctl -u aetraa -f              watch the app's log
# ---------------------------------------------------------------------------
set -euo pipefail
ENVF="${1:?settings file}"; REL="${2:?release .tgz}"; HOST="${3:?web name}"
log() { echo "[aetraa-setup] $*"; }
export DEBIAN_FRONTEND=noninteractive

# 1. Swap — the free server has 1 GB of memory; npm and PDF-sized uploads need headroom.
if [ ! -f /swapfile ] && [ "$(awk '/MemTotal/{print $2}' /proc/meminfo)" -lt 3000000 ]; then
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile >/dev/null && swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
  log "2 GB swap on"
fi

# 2. Packages
apt-get update -y
apt-get install -y ca-certificates curl gnupg tar debian-keyring debian-archive-keyring apt-transport-https unattended-upgrades

if ! node -v 2>/dev/null | grep -q '^v22\.'; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi
log "node $(node -v)"

if ! command -v caddy >/dev/null; then
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' -o /etc/apt/sources.list.d/caddy-stable.list
  chmod o+r /usr/share/keyrings/caddy-stable-archive-keyring.gpg /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -y && apt-get install -y caddy
fi
log "caddy $(caddy version | cut -d' ' -f1)"

# 3. Security updates, every day, with a reboot at 03:00 UAE time if one is needed.
cat > /etc/apt/apt.conf.d/20auto-upgrades <<'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
EOF
cat > /etc/apt/apt.conf.d/52aetraa-reboot <<'EOF'
Unattended-Upgrade::Automatic-Reboot "true";
Unattended-Upgrade::Automatic-Reboot-Time "23:00";
EOF
timedatectl set-timezone UTC || true

# 4. The app's own user, folders and settings
id aetraa >/dev/null 2>&1 || useradd --system --create-home --home-dir /opt/aetraa --shell /usr/sbin/nologin aetraa
mkdir -p /opt/aetraa/releases /etc/aetraa
chown -R aetraa:aetraa /opt/aetraa
chmod 750 /etc/aetraa && chown root:aetraa /etc/aetraa
if [ -f /etc/aetraa/aetraa.env ]; then
  # Keep settings added since (RESEND_KEY…); refresh the ones this run supplies.
  while IFS= read -r line; do
    k="${line%%=*}"; [ -z "$k" ] && continue
    grep -v "^$k=" /etc/aetraa/aetraa.env > /etc/aetraa/aetraa.env.new || true
    echo "$line" >> /etc/aetraa/aetraa.env.new
    mv /etc/aetraa/aetraa.env.new /etc/aetraa/aetraa.env
  done < "$ENVF"
else
  cp "$ENVF" /etc/aetraa/aetraa.env
fi
chown root:aetraa /etc/aetraa/aetraa.env && chmod 640 /etc/aetraa/aetraa.env
shred -u "$ENVF" 2>/dev/null || rm -f "$ENVF"

# 5. The service
cat > /etc/systemd/system/aetraa.service <<'UNIT'
[Unit]
Description=AETRAA platform
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=aetraa
Group=aetraa
WorkingDirectory=/opt/aetraa/current
EnvironmentFile=/etc/aetraa/aetraa.env
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=3
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
systemctl daemon-reload
systemctl enable aetraa.service >/dev/null

# 6. HTTPS in front of the app (Caddy fetches and renews the certificate itself)
write_caddy() {
  cat > /etc/caddy/Caddyfile <<EOF
$1 {
	encode gzip
	reverse_proxy 127.0.0.1:8787
	log {
		output file /var/log/caddy/aetraa.log {
			roll_size 20MiB
			roll_keep 5
		}
	}
}
EOF
  mkdir -p /var/log/caddy && chown caddy:caddy /var/log/caddy
}
write_caddy "$HOST"
systemctl enable caddy >/dev/null
systemctl restart caddy

# 7. The helpers
T="$(mktemp -d)"
tar -xzf "$REL" -C "$T" deploy/update.sh
install -m 0755 "$T/deploy/update.sh" /usr/local/bin/aetraa-update
rm -rf "$T"

cat > /usr/local/bin/aetraa-config <<'CFG'
#!/bin/bash
# sudo aetraa-config KEY VALUE        set a setting and restart the app
# sudo aetraa-config domain NAME      serve the app at NAME (point its DNS here first)
# sudo aetraa-config show             list the setting names (values hidden)
set -euo pipefail
F=/etc/aetraa/aetraa.env
case "${1:-}" in
  show) cut -d= -f1 "$F"; exit 0 ;;
  domain)
    D="${2:?give the web name, e.g. app.aetraa.ae}"
    sed -i "s#^PUBLIC_URL=.*#PUBLIC_URL=https://$D#" "$F"
    sed -i "1s#^.* {#$D {#" /etc/caddy/Caddyfile
    systemctl reload caddy && systemctl restart aetraa
    echo "now serving https://$D"; exit 0 ;;
  ""|-h|--help) sed -n '2,4p' "$0"; exit 0 ;;
esac
K="$1"; V="${2:?give a value}"
[[ "$K" =~ ^[A-Z][A-Z0-9_]*$ ]] || { echo "setting names are UPPER_CASE"; exit 1; }
# Refuse here what the app refuses at startup. Without this the script happily
# wrote a short OWNER_CODE, restarted, and the app exited 1 on every restart —
# so a one-word change took the whole platform down and the only clue was in
# journalctl. The check belongs in front of the write, not after it.
if [[ "$K" == "OWNER_CODE" && ${#V} -lt 16 ]]; then
  echo "OWNER_CODE is the master key to every company — it must be at least 16 characters."
  echo "Nothing was changed; the platform is still running on the current code."
  exit 1
fi
if [[ "$K" == "AUTH_SECRET" && ${#V} -lt 32 ]]; then
  echo "AUTH_SECRET must be at least 32 characters. Nothing was changed."
  exit 1
fi
grep -v "^$K=" "$F" > "$F.new" || true
printf '%s=%s\n' "$K" "$V" >> "$F.new"
chown root:aetraa "$F.new"; chmod 640 "$F.new"; mv "$F.new" "$F"
systemctl restart aetraa && echo "$K set; app restarted"
CFG
chmod 0755 /usr/local/bin/aetraa-config

# 8. The release
/usr/local/bin/aetraa-update "$REL"
rm -f "$REL" /tmp/server-setup.sh
log "done: https://$HOST"
