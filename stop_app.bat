@echo off
title Stop Axxela Trade Transfer Platform
cls
echo ======================================================================
echo           STOPPING AXXELA TRADE TRANSFER PLATFORM
echo ======================================================================
echo.

echo Terminating backend processes on port 5000...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5000" ^| findstr "LISTENING"') do (
    taskkill /f /pid %%a >nul 2>&1
)

echo Terminating frontend processes on port 3000...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3000" ^| findstr "LISTENING"') do (
    taskkill /f /pid %%a >nul 2>&1
)

echo.
echo All Axxela processes terminated successfully.
echo.
timeout /t 2 /nobreak >nul
