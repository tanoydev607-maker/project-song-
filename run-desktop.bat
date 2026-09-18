@echo off
title Songbird AI Desktop
cd /d "%~dp0"
powershell -ExecutionPolicy Bypass -NoProfile -File "%~dp0run-desktop.ps1"
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo Press any key to close this window...
    pause >nul
)
