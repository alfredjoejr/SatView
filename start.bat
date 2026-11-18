@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>&1
if errorlevel 1 (
  echo Node.js is required. Please install Node.js and try again.
  exit /b 1
)

if not exist "node_modules" (
  echo Installing dependencies...
  call npm install
  if errorlevel 1 exit /b %errorlevel%
)

node scripts/dev.ts %*
exit /b %errorlevel%
