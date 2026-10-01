@echo off
title Axxela Quant - Trade Transfer Platform Launcher
cls
echo ======================================================================
echo           AXXELA QUANT - TRADE TRANSFER ENGINE LAUNCHER
echo ======================================================================
echo.

:: 1. Check Python
where python >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Python not found in PATH. Please install Python 3.9+.
    pause
    exit /b 1
)

:: 2. Check Node.js
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js not found in PATH. Please install Node.js 18+.
    pause
    exit /b 1
)

echo [1/3] Starting Python Flask API on http://127.0.0.1:5000...
start "Axxela Backend (Flask :5000)" /min cmd /c "cd /d \"%~dp0backend\" && python app.py"

:: Wait for Flask backend to bind port
timeout /t 2 /nobreak >nul

echo [2/3] Starting Next.js Frontend on http://localhost:3000...
start "Axxela Frontend (Next.js :3000)" /min cmd /c "cd /d \"%~dp0frontend\" && npm run dev"

:: Wait for dev server compilation
timeout /t 3 /nobreak >nul

echo [3/3] Opening browser at http://localhost:3000...
start http://localhost:3000

echo.
echo ======================================================================
echo Platform is active:
echo   - Web UI:  http://localhost:3000
echo   - API:     http://127.0.0.1:5000
echo.
echo To shut down both servers, run stop_app.bat or close their terminal windows.
echo ======================================================================
echo.
pause
