@echo off
setlocal EnableExtensions
title BOQ POMI V1 - Bill of Quantities from architectural drawings
rem Double-click this file. It asks for the drawings folder, runs the agent,
rem and opens the output folder. A folder can also be given:  "Run agent (Windows).bat" "D:\drawings"
cd /d "%~dp0"
echo.
echo   BOQ POMI V1 - Bill of Quantities from architectural drawings
echo   -------------------------------------------------------------
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

rem ---- 2. The libraries it reads drawings and writes Excel with -------------
"%PY%" -c "import pymupdf, openpyxl, numpy, scipy, cv2" >nul 2>nul
if errorlevel 1 (
  echo   Installing what the agent needs - first time only ...
  "%PY%" -m pip install pymupdf openpyxl numpy scipy opencv-python-headless
  if errorlevel 1 ( echo   The install failed. Check the internet connection and try again. & pause & exit /b 1 )
)
rem the model link, used to read a drawn door or window schedule. Optional:
rem without it the agent still runs and leaves a request for that sheet.
"%PY%" -c "import claude_agent_sdk" >nul 2>nul
if errorlevel 1 (
  echo   Installing the model link - first time only ...
  "%PY%" -m pip install claude-agent-sdk >nul 2>nul
  if errorlevel 1 echo   ^(model link not installed - schedules it cannot read will be left as requests^)
)

rem ---- 3. Which drawings -----------------------------------------------------
set "FOLDER=%~1"
if not defined FOLDER for /f "usebackq delims=" %%I in (`powershell -NoProfile -STA -Command "Add-Type -AssemblyName System.Windows.Forms; $f = New-Object System.Windows.Forms.FolderBrowserDialog; $f.Description = 'Choose the folder that holds the drawings (PDFs)'; if ($f.ShowDialog() -eq 'OK') { $f.SelectedPath }"`) do set "FOLDER=%%I"
if not defined FOLDER (
  echo   No folder chosen.
  pause & exit /b 0
)
echo   Drawings: %FOLDER%
echo.

rem ---- 4. Run it, then show the results -------------------------------------
"%PY%" agent.py "%FOLDER%" %2 %3 %4 %5
echo.
echo   Opening the output folder ...
start "" "%~dp0output"
echo.
echo   Done. You can close this window.
pause
