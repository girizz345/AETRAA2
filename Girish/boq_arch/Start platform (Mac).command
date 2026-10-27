#!/bin/bash
# BOQ Take-off platform - run it on a Mac. Double-click this file.
# It opens in your browser at http://127.0.0.1:5000
cd "$(dirname "$0")" || exit 1
echo
echo "  BOQ Take-off platform"
echo "  ---------------------"

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

# 2. the platform's libraries (first time only)
if ! "$PY" -c "import flask, pymupdf, cv2, openpyxl, scipy, ezdxf, PIL" >/dev/null 2>&1; then
  echo "  Installing the platform's libraries (first time only, a few minutes) ..."
  "$PY" -m pip install --user -r requirements.txt || { read -r -p "  Install failed - check the internet connection. Press Return." _; exit 1; }
fi

# 3. start it and open the browser
echo
echo "  Starting ... your browser opens on the sign-in page in a few seconds."
echo
echo "  Sign in with:   username  ajay123     password  aetraa123"
echo
echo "  Keep this window open while you use the platform. Close it to stop."
echo
( sleep 4; open "http://127.0.0.1:5000" ) &
"$PY" web/app.py
