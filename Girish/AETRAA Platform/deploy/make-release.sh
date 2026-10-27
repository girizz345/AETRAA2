#!/bin/bash
# ---------------------------------------------------------------------------
#  THIS FOLDER'S CODE IS THE OLDER COPY. The platform that runs is in
#  work/test-drive, so a release is built from there.
#
#  This script used to package server.js, src/ and schema.sql from this folder
#  — the older copy — so running it would have shipped the old platform to the
#  live server. It now hands over to work/test-drive/deploy/make-release.sh
#  (7 Oct 2026, launch check). The original is kept below, commented out, for
#  Ajay to delete once the older copy is archived.
# ---------------------------------------------------------------------------
set -euo pipefail
HERE="$(cd "$(dirname "$0")/.." && pwd)"
echo "Building the release from work/test-drive (the current code), not from this folder's older copy."
exec bash "$HERE/work/test-drive/deploy/make-release.sh" "$@"

# --- the original, which packaged the older copy -----------------------------
# cd "$(dirname "$0")/.."
# OUT="../aetraa-release-$(date +%Y%m%d-%H%M).tgz"
# tar -czf "$OUT" \
#   --exclude='./node_modules' --exclude='./.dev.vars' --exclude='./.wrangler' \
#   --exclude='./backups' --exclude='./out' --exclude='./*.tgz' --exclude='./local-data' \
#   server.js local.mjs package.json package-lock.json schema.sql src assets deploy \
#   tools/demo-seed.mjs tools/demo-live.mjs
# echo "wrote $OUT ($(du -h "$OUT" | cut -f1))"
# tar -tzf "$OUT" | grep -q '^\(\./\)\?\.dev\.vars' && { echo "REFUSING: .dev.vars got in"; rm -f "$OUT"; exit 1; } || true
