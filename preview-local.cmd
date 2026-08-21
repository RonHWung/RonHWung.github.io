@echo off
setlocal
title RonHWung Website Preview
cd /d "%~dp0"

set "PREVIEW_URL=http://127.0.0.1:4321/"
set "OPEN_BROWSER=1"
if /i "%~1"=="--no-open" set "OPEN_BROWSER=0"

where pnpm >nul 2>&1
if errorlevel 1 (
  echo [ERROR] pnpm was not found. Install Node.js and pnpm first.
  pause
  exit /b 1
)

powershell.exe -NoProfile -Command "try { $response = Invoke-WebRequest -UseBasicParsing -Uri '%PREVIEW_URL%' -TimeoutSec 1; if ($response.StatusCode -ge 200) { exit 0 } } catch {}; exit 1" >nul 2>&1
if not errorlevel 1 (
  echo Preview is already running at %PREVIEW_URL%
  if "%OPEN_BROWSER%"=="1" start "" "%PREVIEW_URL%"
  exit /b 0
)

if not exist "node_modules\astro\package.json" (
  echo Installing dependencies...
  call pnpm install --store-dir "%~dp0.pnpm-store"
  if errorlevel 1 (
    echo [ERROR] Dependency installation failed.
    pause
    exit /b 1
  )
)

echo Starting local preview at %PREVIEW_URL%
echo Keep this window open. Press Ctrl+C to stop the server.

if "%OPEN_BROWSER%"=="1" start "" /b powershell.exe -NoProfile -WindowStyle Hidden -Command "$url = '%PREVIEW_URL%'; for ($i = 0; $i -lt 60; $i++) { try { $response = Invoke-WebRequest -UseBasicParsing -Uri $url -TimeoutSec 1; if ($response.StatusCode -ge 200) { Start-Process $url; exit 0 } } catch {}; Start-Sleep -Milliseconds 500 }"

call pnpm dev --host 127.0.0.1 --port 4321
set "PREVIEW_EXIT=%ERRORLEVEL%"

if not "%PREVIEW_EXIT%"=="0" (
  echo [ERROR] The preview server stopped with exit code %PREVIEW_EXIT%.
  pause
)

exit /b %PREVIEW_EXIT%
