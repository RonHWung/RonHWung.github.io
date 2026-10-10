@echo off
setlocal
title RonHWung - Atlas / Terminal Preview
cd /d "%~dp0"

where node >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Node.js is required.
  pause
  exit /b 1
)

node scripts\preview-local.mjs %*
if errorlevel 1 pause
