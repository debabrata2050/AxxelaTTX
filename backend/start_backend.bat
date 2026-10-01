@echo off
title Axxela Backend (Flask :5000)
cd /d "%~dp0"
echo ======================================================================
echo           AXXELA BACKEND - FLASK API (:5000)
echo ======================================================================
echo.
python app.py
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Backend exited with error code %ERRORLEVEL%.
)
pause
