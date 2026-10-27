#!/bin/bash
# BOQ POMI V1 - run the agent on a Mac.
# Double-click this file, or in a terminal:  bash "Run agent (Mac).command"
cd "$(dirname "$0")" || exit 1
echo
echo "  BOQ POMI V1 - Bill of Quantities from architectural drawings"
echo "  -------------------------------------------------------------"

# 1. a Python new enough (3.10 or later)
PY=""
for c in python3.13 python3.12 python3.11 python3.10 python3; do
  if command -v "$c" >/dev/null 2>&1 && "$c" -c 'import sys; sys.exit(sys.version_info < (3, 10))' 2>/dev/null; then
    PY="$c"; break
  fi
done
if [ -z "$PY" ]; then
  echo
  echo "  Python 3.10 or newer is needed. Install Python 3.12 from https://www.python.org/downloads/"
  echo "  then run this again."
  read -r -p "  Press Return to close." _; exit 1
fi
echo "  Python: $($PY --version)"

# 2. the two libraries it reads drawings and writes Excel with (first time only)
if ! "$PY" -c "import pymupdf, openpyxl, numpy, scipy, cv2" >/dev/null 2>&1; then
  echo "  Installing what the agent needs (first time only, a few minutes) ..."
  "$PY" -m pip install --user pymupdf openpyxl numpy scipy opencv-python-headless || { read -r -p "  Install failed - check the internet connection. Press Return." _; exit 1; }
fi
# the model link, used to read a door or window schedule off the sheet when its
# text cannot be read as a table. Optional: without it the agent still runs and
# leaves a request in readings/ for that sheet instead.
if ! "$PY" -c "import claude_agent_sdk" >/dev/null 2>&1; then
  echo "  Installing the model link (first time only) ..."
  "$PY" -m pip install --user claude-agent-sdk >/dev/null 2>&1     || echo "  (model link not installed - schedules it cannot read will be left as requests)"
fi

# 3. which drawings
FOLDER=$(osascript -e 'POSIX path of (choose folder with prompt "Choose the folder that holds the drawings (PDFs)")' 2>/dev/null)
if [ -z "$FOLDER" ]; then echo "  No folder chosen."; exit 0; fi
echo "  Drawings: $FOLDER"
echo

# 4. run it, then show the results
"$PY" agent.py "$FOLDER"
echo
echo "  Opening the output folder ..."
open "output"
read -r -p "  Done. Press Return to close." _
