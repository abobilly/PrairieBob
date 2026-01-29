# =============================================================================
# PrairieBob Builder
# =============================================================================
# Creates a standalone PrairieBob.exe installer in the release/ folder
#
# Run this when you want to:
#   - Create an installer to share with others
#   - Have a standalone .exe that doesn't need the terminal
#
# The installer will be at: release/PrairieBob Setup X.X.X.exe
# =============================================================================

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

Write-Host ""
Write-Host "  ╔═══════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "  ║      🌾 PrairieBob Builder 🌾         ║" -ForegroundColor Cyan
Write-Host "  ║   Creating standalone installer...    ║" -ForegroundColor Cyan
Write-Host "  ╚═══════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Check dependencies
if (!(Test-Path "node_modules")) {
    Write-Host "📦 Installing dependencies first..." -ForegroundColor Yellow
    npm install
}

Write-Host "🔧 Step 1/3: Compiling TypeScript..." -ForegroundColor Yellow
npm run electron:compile
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to compile Electron" -ForegroundColor Red
    exit 1
}

Write-Host "📦 Step 2/3: Building React app..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to build React" -ForegroundColor Red
    exit 1
}

Write-Host "🏗️ Step 3/3: Creating installer..." -ForegroundColor Yellow
npm run electron:build
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to create installer" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "✅ Build complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Your installer is at:" -ForegroundColor Cyan

# Find the installer
$installer = Get-ChildItem -Path "release" -Filter "*.exe" | Select-Object -First 1
if ($installer) {
    Write-Host "   $($installer.FullName)" -ForegroundColor White
    Write-Host ""
    Write-Host "Double-click that file to install PrairieBob!" -ForegroundColor Gray
} else {
    Write-Host "   release/" -ForegroundColor White
}

Write-Host ""
Read-Host "Press Enter to exit"
