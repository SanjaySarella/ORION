# ORION Backend Startup Script
# Double-click this file or run it in PowerShell to start the server

Write-Host "Starting ORION Backend..." -ForegroundColor Yellow

# Navigate to backend folder
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

# Activate virtual environment
$venvPath = Join-Path $scriptDir ".venv\Scripts\Activate.ps1"
if (Test-Path $venvPath) {
    . $venvPath
    Write-Host "Virtual environment activated" -ForegroundColor Green
} else {
    Write-Host "Creating virtual environment..." -ForegroundColor Yellow
    python -m venv .venv
    . $venvPath
    pip install -r requirements.txt
}

# Start server
Write-Host "Server starting at http://localhost:8000" -ForegroundColor Green
Write-Host "API docs at http://localhost:8000/docs" -ForegroundColor Cyan
Write-Host "Press Ctrl+C to stop" -ForegroundColor Gray

uvicorn main:app --reload --port 8000
