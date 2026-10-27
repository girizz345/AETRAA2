@echo off
setlocal EnableExtensions
title BOQ Take-off platform (close this window to stop it)
rem BOQ Take-off platform - opens in your browser at http://127.0.0.1:5000
cd /d "%~dp0"
echo.
echo   BOQ Take-off platform
echo   ---------------------
echo.

rem ---- 1. Python 3.12 (installed the first time if missing) ---------------
set "PY="
if exist "%LOCALAPPDATA%\Programs\Python\Python312\python.exe" set "PY=%LOCALAPPDATA%\Programs\Python\Python312\python.exe"
if not defined PY for /f "delims=" %%i in ('py -3.12 -c "import sys;print(sys.executable)" 2^>nul') do set "PY=%%i"
if not defined PY (
  echo   Installing Python 3.12 - first time only, a few minutes ...
  winget install --id Python.Python.3.12 -e --silent --accept-package-agreements --accept-source-agreements
  if exist "%LOCALAPPDATA%\Programs\Python\Python312\python.exe" set "PY=%LOCALAPPDATA%\Programs\Python\Python312\python.exe"
)
if not defined PY (
  echo   Python 3.12 could not be found or installed. Install it from python.org, then run this again.
  pause & exit /b 1
)

rem ---- 2. The platform's libraries (installed the first time) --------------
"%PY%" -c "import flask, pymupdf, cv2, openpyxl, scipy, ezdxf, PIL" >nul 2>nul
if errorlevel 1 (
  echo   Installing the platform's libraries - first time only, a few minutes ...
  "%PY%" -m pip install -r requirements.txt
  if errorlevel 1 ( echo   The libraries did not install. Check the internet connection and try again. & pause & exit /b 1 )
)

rem ---- 3. Start it and open the browser --------------------------------------
echo   Starting ... your browser opens on the sign-in page in a few seconds.
echo.
echo   Sign in with:   username  ajay123     password  aetraa123
echo.
echo   Keep this window open while you use the platform. Close it to stop.
echo.
start "" http://127.0.0.1:5000
"%PY%" web\app.py
pause
