# ── CycloSense – Start Frontend ────────────────────────────────────────────────
# Run from "MY Model" directory.  Double-click or:  .\start_frontend.ps1

$rootDir     = $PSScriptRoot
$frontendDir = Join-Path $rootDir "cyclone_app\frontend"

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  CycloSense – Cyclone Prediction System  (Frontend)" -ForegroundColor Cyan
Write-Host "  App  : http://localhost:5173" -ForegroundColor Green
Write-Host "  Make sure the backend is running first!" -ForegroundColor Yellow
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

Set-Location $frontendDir

# Install deps if node_modules is missing
if (-not (Test-Path (Join-Path $frontendDir "node_modules"))) {
    Write-Host "[INFO] node_modules not found – running npm install..." -ForegroundColor Yellow
    npm install
}

npm run dev
