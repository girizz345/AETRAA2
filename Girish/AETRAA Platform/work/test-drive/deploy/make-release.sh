#!/bin/bash
# ---------------------------------------------------------------------------
#  Build a release file on your Mac:   bash deploy/make-release.sh
#
#  Produces aetraa-release-<date>.tgz beside this folder, holding only what the
#  server runs: no tests, no dev tools, no local secrets (.dev.vars), no
#  backups, no node_modules (the server installs its own).
#
#  THE RELEASE CARRIES ITS OWN package.json, and not the one in the repo.
#
#  The repo's package.json declares five devDependencies — esbuild, playwright,
#  wrangler and two pglite packages — which exist to run the tests and the local
#  worker. The server runs none of them. It needs exactly two packages, and the
#  code says so: server.js does `await import('pg')` and the zip reader imports
#  fflate. Nothing else in server.js, cad-convert.js, local.mjs or src/ reaches
#  outside node: built-ins.
#
#  Shipping the dev package.json made the deploy depend on a lock file that
#  covered five packages the server would never load, and on 26 optional esbuild
#  platform binaries for architectures it will never run on. When that lock
#  drifted out of step with package.json, `npm ci` refused the whole install —
#  correctly — and a release that was otherwise fine could not be deployed:
#
#      npm error Missing: @esbuild/linux-x64@0.28.1 from lock file
#
#  A build tool for a platform the server does not use has no business being
#  able to stop a deployment. So the release declares the two dependencies it
#  actually has, and the server resolves those two.
# ---------------------------------------------------------------------------
set -euo pipefail
cd "$(dirname "$0")/.."
# This folder, wherever the script is started from. (It used $OLDPWD below,
# which is only this folder when the script is run from inside it.)
APP="$(pwd)"
OUT="../aetraa-release-$(date +%Y%m%d-%H%M).tgz"

STAGE=$(mktemp -d)
trap 'rm -rf "$STAGE"' EXIT

# Built from the real package.json rather than typed out here, so the versions
# can never drift from the ones the tests ran against.
node -e '
  const pkg = JSON.parse(require("fs").readFileSync("package.json", "utf8"));
  const deps = pkg.dependencies || {};
  for (const need of ["pg", "fflate", "pdfjs-dist", "pdf-lib", "@napi-rs/canvas"]) {
    if (!deps[need]) { console.error("package.json is missing " + need); process.exit(1); }
  }
  require("fs").writeFileSync(process.argv[1], JSON.stringify({
    name: pkg.name, version: pkg.version, description: pkg.description,
    private: true, license: pkg.license, type: "module",
    engines: pkg.engines,
    scripts: { start: "node server.js" },
    dependencies: deps,
  }, null, 2) + "\n");
' "$STAGE/package.json"

tar -czf "$OUT" \
  --exclude='./node_modules' --exclude='./.dev.vars' --exclude='./.wrangler' \
  --exclude='./backups' --exclude='./out' --exclude='./*.tgz' --exclude='./local-data' \
  -C "$STAGE" package.json \
  -C "$APP" \
  server.js cad-convert.js local.mjs schema.sql src assets deploy \
  tools/demo-seed.mjs tools/demo-live.mjs

echo "wrote $OUT ($(du -h "$OUT" | cut -f1))"

# Two things that must never be true of a release, checked rather than assumed.
tar -tzf "$OUT" | grep -q '^\(\./\)\?\.dev\.vars' && { echo "REFUSING: .dev.vars got in"; rm -f "$OUT"; exit 1; } || true
tar -tzf "$OUT" | grep -q '^\(\./\)\?package-lock\.json$' && { echo "REFUSING: the dev lock file got in"; rm -f "$OUT"; exit 1; } || true
node -e '
  const { execSync } = require("child_process");
  const j = JSON.parse(execSync("tar -xzOf " + JSON.stringify(process.argv[1]) + " package.json", { encoding: "utf8" }));
  if (j.devDependencies) { console.error("REFUSING: devDependencies got into the release"); process.exit(1); }
  console.log("release depends on: " + Object.keys(j.dependencies).join(", "));
' "$OUT"
