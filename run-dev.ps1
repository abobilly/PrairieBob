# PrairieBob Development Server
# Run from repo root

$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

# Use port 5175 to avoid conflicts with other Electron apps
$env:VITE_DEV_SERVER_URL = "http://localhost:5175"

Write-Host "Starting PrairieBob from: $(Get-Location)" -ForegroundColor Cyan
Write-Host "Vite URL: $env:VITE_DEV_SERVER_URL" -ForegroundColor Yellow
npx concurrently -k "npx vite --port 5175" "npx electron ."
