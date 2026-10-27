#!/bin/bash
# Starts AETRAA on this machine from the CURRENT code (work/test-drive).
# The src/, server.js and local.mjs beside this file are an older copy.
cd "$(dirname "$0")/work/test-drive" || exit 1
command -v node >/dev/null || { echo "Node.js 22.5 or later is needed - install it from https://nodejs.org"; read -r; exit 1; }
[ -d node_modules ] || { echo "Installing packages, first run only..."; npm install --no-audit --no-fund || { read -r; exit 1; }; }
(sleep 3; open http://127.0.0.1:8788/setup) &
node local.mjs
