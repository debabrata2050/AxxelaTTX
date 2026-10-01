@echo off
title Axxela Frontend (Next.js :3000)
cd /d "%~dp0"
echo ======================================================================
echo           AXXELA FRONTEND - NEXT.JS (:3000)
echo ======================================================================
echo.
call npm run dev
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Frontend exited with error code %ERRORLEVEL%.
)
pause
