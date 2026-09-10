# ── CycloSense – Start Backend ─────────────────────────────────────────────────
# Run from "MY Model" directory.  Double-click or:  .\start_backend.ps1

$rootDir    = $PSScriptRoot
$venvPython = Join-Path $rootDir "venv\Scripts\python.exe"
$backendDir = Join-Path $rootDir "cyclone_app\backend"

if (-not (Test-Path $venvPython)) {
    Write-Host "[ERROR] venv not found at $venvPython" -ForegroundColor Red
    Write-Host "Create it with:  python -m venv venv" -ForegroundColor Yellow
    pause
    exit 1
}

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  CycloSense – Cyclone Prediction System  (Backend)" -ForegroundColor Cyan
Write-Host "  API  : http://localhost:8000" -ForegroundColor Green
Write-Host "  Docs : http://localhost:8000/docs" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

Set-Location $backendDir
& $venvPython -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
