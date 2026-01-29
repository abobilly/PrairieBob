# =============================================================================
# PrairieBob Launcher
# =============================================================================
# Double-click this file to run PrairieBob!
#
# What this does:
#   1. Compiles the latest code (takes ~30 seconds first time)
#   2. Opens PrairieBob with the sample project loaded
#   3. Hot-reloads when you save code changes (if you're developing)
#
# Tip: Right-click > "Run with PowerShell" if double-click doesn't work
# =============================================================================

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

Write-Host ""
Write-Host "  ╔═══════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "  ║         🌾 PrairieBob Editor 🌾        ║" -ForegroundColor Cyan
Write-Host "  ║     AI-assisted tile map editing      ║" -ForegroundColor Cyan
Write-Host "  ╚═══════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Check if node_modules exists
if (!(Test-Path "node_modules")) {
    Write-Host "📦 First run detected! Installing dependencies..." -ForegroundColor Yellow
    Write-Host "   (This only happens once, takes 1-2 minutes)" -ForegroundColor Gray
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Failed to install dependencies" -ForegroundColor Red
        Read-Host "Press Enter to exit"
        exit 1
    }
    Write-Host "✅ Dependencies installed!" -ForegroundColor Green
}

# Compile Electron if needed
$preloadExists = Test-Path "dist-electron/preload.cjs"
if (!$preloadExists) {
    Write-Host "🔧 Compiling Electron..." -ForegroundColor Yellow
    npm run electron:compile 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Failed to compile Electron" -ForegroundColor Red
        Read-Host "Press Enter to exit"
        exit 1
    }
    Write-Host "✅ Electron compiled!" -ForegroundColor Green
}

Write-Host ""
Write-Host "🚀 Launching PrairieBob..." -ForegroundColor Green
Write-Host "   (Loading sample project: samples/cottage)" -ForegroundColor Gray
Write-Host ""
Write-Host "   Keyboard shortcuts:" -ForegroundColor DarkGray
Write-Host "   B = Brush, E = Eraser, F = Fill, G = Grid" -ForegroundColor DarkGray
Write-Host "   Ctrl+S = Save, Ctrl+Z = Undo, Ctrl+Y = Redo" -ForegroundColor DarkGray
Write-Host ""

# Use port 5175 to avoid conflicts
$env:VITE_DEV_SERVER_URL = "http://localhost:5175"

# Run with hot-reload (dev mode)
npx concurrently -k "npx vite --port 5175" "npx electron ."
