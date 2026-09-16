@echo off
title Songbird AI Desktop
echo ========================================================
echo   Launching Songbird AI Desktop Application
echo ========================================================
echo.

cd /d "%~dp0"

:: 1. Launch Engine Daemon if not already active on port 18789
powershell -Command "if (-not (Get-NetTCPConnection -LocalPort 18789 -ErrorAction SilentlyContinue)) { Start-Process powershell -ArgumentList '-NoProfile -WindowStyle Hidden -Command cd engine/hermes-agent; .\venv\Scripts\python.exe -u server.py' }"

:: 2. Launch Vite Frontend if not already active on port 1420
powershell -Command "if (-not (Get-NetTCPConnection -LocalPort 1420 -ErrorAction SilentlyContinue)) { Start-Process powershell -ArgumentList '-NoProfile -WindowStyle Hidden -Command pnpm dev:frontend' }"

echo Waiting for services to initialize...
timeout /t 3 /nobreak >nul

:: 3. Launch Standalone Native Desktop Window
echo Launching standalone desktop window...
start msedge --app=http://localhost:1420

echo Songbird AI is running!
