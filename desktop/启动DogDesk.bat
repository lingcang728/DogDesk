@echo off
title DogDesk 🐕
echo.
echo   ================================
echo   DogDesk - Starting...
echo   ================================
echo.
cd /d "%~dp0"
npx tauri dev
pause
