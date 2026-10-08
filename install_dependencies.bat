@echo off
title Install Dependencies - Axxela TTX
cd /d "%~dp0"

echo =========================================================================
echo       AXXELA TTX - AUTOMATIC DEPENDENCY INSTALLER
echo =========================================================================
echo.

:: 1. Verify Python
echo Checking Python...
python --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Python not found in PATH.
    echo Please install Python 3.10+ from python.org and check "Add Python to PATH".
    pause
    exit /b 1
)

:: 2. Install Backend Python Dependencies
echo.
echo [1/2] Installing Backend Dependencies (pip install -r backend\requirements.txt)...
echo -------------------------------------------------------------------------
python -m pip install -r "%~dp0backend\requirements.txt"
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Failed to install backend dependencies.
    pause
    exit /b %ERRORLEVEL%
)
echo [OK] Backend dependencies installed.

:: 3. Verify Node / npm
echo.
echo Checking Node.js and npm...
call npm --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] npm / Node.js not found in PATH.
    echo Please install Node.js 18+ from nodejs.org.
    pause
    exit /b 1
)

:: 4. Install Frontend Dependencies
echo.
echo [2/2] Installing Frontend Dependencies (npm install in frontend)...
echo -------------------------------------------------------------------------
pushd "%~dp0frontend"
call npm install
set FRONTEND_ERR=%ERRORLEVEL%
popd
if %FRONTEND_ERR% NEQ 0 (
    echo.
    echo [ERROR] Failed to install frontend dependencies.
    pause
    exit /b %FRONTEND_ERR%
)
echo [OK] Frontend dependencies installed.

echo.
echo =========================================================================
echo  [SUCCESS] All dependencies for backend and frontend installed!
echo  You can now start the application using start_app.bat
echo =========================================================================
echo.
pause
