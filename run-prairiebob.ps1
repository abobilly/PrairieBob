# PrairieBob Launcher
# Always run the app from the correct folder

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path

if (!(Test-Path (Join-Path $root "run-dev.ps1"))) {
    Write-Host "run-dev.ps1 not found at $root" -ForegroundColor Red
    exit 1
}

Write-Host "Launching PrairieBob from $root" -ForegroundColor Cyan
& "$root\run-dev.ps1"
