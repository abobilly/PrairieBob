@echo off
title PrairieBob - First Time Setup
color 0E

echo.
echo  ====================================
echo   PrairieBob - First Time Setup
echo  ====================================
echo.

:: Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js is not installed!
    echo.
    echo ----------------------------------------
    echo  STEP 1: Install Node.js
    echo ----------------------------------------
    echo.
    echo 1. Go to: https://nodejs.org/
    echo 2. Download the LTS version (green button)
    echo 3. Run the installer (accept all defaults)
    echo 4. Restart your computer
    echo 5. Run this script again
    echo.
    echo Opening Node.js download page...
    start https://nodejs.org/
    echo.
    pause
    exit /b 1
)

echo [OK] Node.js is installed!
node --version
echo.

echo ----------------------------------------
echo  Installing dependencies...
echo ----------------------------------------
echo.
echo This will download about 200MB of packages.
echo Please wait...
echo.

call npm install

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] npm install failed!
    echo Try running this script as Administrator.
    pause
    exit /b 1
)

echo.
echo ----------------------------------------
echo  Building Electron app...
echo ----------------------------------------
echo.
call npm run build

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [WARN] Build had issues, but app may still work.
)

echo.
echo ----------------------------------------
echo  Checking for Go CLI (optional)...
echo ----------------------------------------
echo.

:: Check if Go is installed for CLI
where go >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo [OK] Go is installed, building CLI...
    cd cli
    go build -o pb.exe .
    if %ERRORLEVEL% EQU 0 (
        echo [OK] PrairieBob CLI built: cli\pb.exe
    ) else (
        echo [WARN] CLI build failed, but editor will still work.
    )
    cd ..
) else (
    echo [INFO] Go not installed. CLI tool is optional.
    echo        Install Go from https://go.dev/ to enable CLI features.
)

echo.
echo ========================================
echo  SUCCESS! PrairieBob is ready!
echo ========================================
echo.
echo To start the app:
echo   - Double-click START.bat
echo   - Or run: npm run electron:dev
echo.
pause
