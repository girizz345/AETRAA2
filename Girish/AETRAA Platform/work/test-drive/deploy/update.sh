#!/bin/bash
# ---------------------------------------------------------------------------
#  AETRAA — install a release on the app server, and roll back if it fails.
#
#     sudo bash update.sh <release.tgz | https://…pre-authenticated-link…>
#
#  Unpacks into /opt/aetraa/releases/<timestamp>, installs production
#  dependencies, switches /opt/aetraa/current to it, restarts, and checks
#  /healthz. If the new release does not come up healthy within 60 seconds, the
#  previous one is put back. The last 5 releases are kept.
# ---------------------------------------------------------------------------
set -euo pipefail
SRC="${1:?give a release .tgz file or a link to one}"
BASE=/opt/aetraa; REL=$BASE/releases/$(date +%Y%m%d-%H%M%S)
log() { echo "[aetraa-update] $*"; }

mkdir -p "$REL"
if [[ "$SRC" == http* ]]; then curl -fsSL "$SRC" -o "$REL.tgz"; else cp "$SRC" "$REL.tgz"; fi
tar -xzf "$REL.tgz" -C "$REL" && rm -f "$REL.tgz"
[ -f "$REL/server.js" ] || { log "that is not an AETRAA release (no server.js)"; exit 1; }
chown -R aetraa:aetraa "$REL"

# INSTALL, NOT CLEAN-INSTALL.
#
# `npm ci` needs a lock file that agrees with package.json down to the last
# optional platform binary, and refuses the entire install when it does not. A
# release carries no lock: it declares the two packages the server actually
# loads — pg and fflate — and nothing else, so there is no dev tree for a lock
# to describe and nothing for one to drift out of step with.
#
# npm writes its own lock into the release directory as it installs, so each
# release on this server still records exactly what it resolved. Releases are
# kept side by side and never modified in place, which is where the
# reproducibility actually comes from.
( cd "$REL" && sudo -u aetraa -H npm install --omit=dev --no-audit --no-fund )

# The server loads both of these. An install that "succeeded" without them
# fails at the first request instead, which looks like a code fault.
for need in pg fflate; do
  [ -d "$REL/node_modules/$need" ] || { log "install did not produce $need — stopping"; exit 1; }
done

# Only a real earlier release counts: on the first install there is none, and
# readlink -f would otherwise hand back the path itself (a link to itself on rollback).
PREV=""
if [ -L $BASE/current ]; then PREV=$(readlink -f $BASE/current); [ "$PREV" = "$REL" ] && PREV=""; fi
ln -sfn "$REL" $BASE/current.new && mv -T $BASE/current.new $BASE/current
systemctl restart aetraa

for i in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:8787/healthz >/dev/null 2>&1; then
    log "healthy: $(basename "$REL")"
    ls -1dt $BASE/releases/*/ | tail -n +6 | xargs -r rm -rf
    exit 0
  fi
  sleep 2
done

log "NOT healthy — rolling back"; journalctl -u aetraa -n 30 --no-pager || true
if [ -n "$PREV" ] && [ -d "$PREV" ]; then
  ln -sfn "$PREV" $BASE/current.new && mv -T $BASE/current.new $BASE/current
  systemctl restart aetraa; log "rolled back to $(basename "$PREV")"
fi
exit 1
