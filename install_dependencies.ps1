# =========================================================================
# Axxela TTX - Automatic Dependency Installer (PowerShell)
# =========================================================================

$ErrorActionPreference = "Stop"
$rootDir = $PSScriptRoot

Write-Host "=========================================================================" -ForegroundColor Cyan
Write-Host "      AXXELA TTX - AUTOMATIC DEPENDENCY INSTALLER (PowerShell)" -ForegroundColor Cyan
Write-Host "=========================================================================" -ForegroundColor Cyan

# 1. Python check & Backend install
Write-Host "`n[1/2] Installing Backend Dependencies (pip install -r backend\requirements.txt)..." -ForegroundColor Yellow
if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
    Write-Host "[ERROR] Python not found in PATH. Please install Python 3.10+ and add to PATH." -ForegroundColor Red
    exit 1
}

python -m pip install -r "$rootDir\backend\requirements.txt"
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Failed to install backend Python dependencies." -ForegroundColor Red
    exit $LASTEXITCODE
}
Write-Host "[OK] Backend dependencies installed." -ForegroundColor Green

# 2. Node/npm check & Frontend install
Write-Host "`n[2/2] Installing Frontend Dependencies (npm install in frontend)..." -ForegroundColor Yellow
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Host "[ERROR] npm / Node.js not found in PATH. Please install Node.js 18+ and add to PATH." -ForegroundColor Red
    exit 1
}

Push-Location "$rootDir\frontend"
try {
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] Failed to install frontend dependencies." -ForegroundColor Red
        exit $LASTEXITCODE
    }
} finally {
    Pop-Location
}
Write-Host "[OK] Frontend dependencies installed." -ForegroundColor Green

Write-Host "`n=========================================================================" -ForegroundColor Cyan
Write-Host " [SUCCESS] All backend and frontend dependencies installed successfully!" -ForegroundColor Green
Write-Host " Run .\start_app.bat to launch the application." -ForegroundColor Green
Write-Host "=========================================================================`n" -ForegroundColor Cyan
