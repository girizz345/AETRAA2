@echo off
rem Starts AETRAA on this machine from the CURRENT code (work\test-drive).
rem The src\, server.js and local.mjs beside this file are an older copy.
cd /d "%~dp0work\test-drive"
where node >nul 2>nul || (echo Node.js 22.5 or later is needed - install it from https://nodejs.org & pause & exit /b 1)
if not exist node_modules (
  echo Installing packages, first run only...
  call npm install --no-audit --no-fund || (pause & exit /b 1)
)
start "" cmd /c "timeout /t 3 >nul & start http://127.0.0.1:8788/setup"
node local.mjs
pause
