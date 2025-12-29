# InfoSky Server Startup Script
Write-Host "Starting InfoSky Server..." -ForegroundColor Cyan
Write-Host ""

# 切换到项目根目录 (server 的父目录)
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

# Check if virtual environment exists and activate it
if (Test-Path "server\.venv\Scripts\Activate.ps1") {
    Write-Host "Activating virtual environment (.venv)..." -ForegroundColor Green
    & .\server\.venv\Scripts\Activate.ps1
} elseif (Test-Path "server\venv\Scripts\Activate.ps1") {
    Write-Host "Activating virtual environment (venv)..." -ForegroundColor Green
    & .\server\venv\Scripts\Activate.ps1
} else {
    Write-Host "No virtual environment found. Using system Python." -ForegroundColor Yellow
}

# Install dependencies
Write-Host "Checking dependencies..." -ForegroundColor Green
pip install -r server\requirements.txt -q

Write-Host ""
Write-Host "Starting FastAPI server on http://localhost:8000" -ForegroundColor Cyan
Write-Host "API Docs: http://localhost:8000/docs" -ForegroundColor Cyan
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Yellow
Write-Host ""

python -m uvicorn server.main:app --reload --host 0.0.0.0 --port 8000
