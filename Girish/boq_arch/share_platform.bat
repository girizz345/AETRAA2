@echo off
setlocal EnableExtensions
title BOQ Take-off - shared link (close this window to stop sharing)
cd /d "%~dp0"
echo.
echo   BOQ Take-off - share this computer's platform over a public link
echo   ----------------------------------------------------------------
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

rem ---- 3. Cloudflare's free tunnel tool (installed the first time) ---------
set "CF="
for /f "delims=" %%i in ('where cloudflared 2^>nul') do if not defined CF set "CF=%%i"
if not defined CF if exist "%ProgramFiles(x86)%\cloudflared\cloudflared.exe" set "CF=%ProgramFiles(x86)%\cloudflared\cloudflared.exe"
if not defined CF if exist "%ProgramFiles%\cloudflared\cloudflared.exe" set "CF=%ProgramFiles%\cloudflared\cloudflared.exe"
if not defined CF (
  echo   Installing Cloudflare's tunnel tool - first time only ...
  winget install --id Cloudflare.cloudflared -e --silent --accept-package-agreements --accept-source-agreements
  if exist "%ProgramFiles(x86)%\cloudflared\cloudflared.exe" set "CF=%ProgramFiles(x86)%\cloudflared\cloudflared.exe"
  if exist "%ProgramFiles%\cloudflared\cloudflared.exe" set "CF=%ProgramFiles%\cloudflared\cloudflared.exe"
)
if not defined CF (
  echo   Cloudflare's tool could not be installed. Run:  winget install --id Cloudflare.cloudflared
  pause & exit /b 1
)

rem ---- 4. Start the platform (unless it is already running) ---------------
curl -s -o nul http://127.0.0.1:5000/login >nul 2>nul
if errorlevel 1 (
  echo   Starting the platform ...
  start "" /b "%PY%" -u web\app.py 1>platform.log 2>&1
)
set /a tries=0
:wait
curl -s -o nul http://127.0.0.1:5000/login >nul 2>nul
if not errorlevel 1 goto up
set /a tries+=1
if %tries% geq 60 ( echo   The platform did not start. See platform.log in this folder. & pause & exit /b 1 )
timeout /t 1 /nobreak >nul
goto wait
:up

rem ---- 5. Open the public link ----------------------------------------------
echo.
echo   ================================================================
echo    The platform is running. The public link appears below in a
echo    few seconds - the line ending in  .trycloudflare.com
echo.
echo    Sign in with:   username  ajay123     password  aetraa123
echo.
echo    Keep this window open while people are testing.
echo    Close it to stop sharing. The link changes every time.
echo    Uploads: at most 100 MB each (split big sets by discipline).
echo    The link is also written to tunnel.log in this folder.
echo   ================================================================
echo.
if exist tunnel.log del tunnel.log
"%CF%" tunnel --no-autoupdate --logfile tunnel.log --url http://127.0.0.1:5000
