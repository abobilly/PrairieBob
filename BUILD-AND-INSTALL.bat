@echo off
title PrairieBob - Build and Install
echo.
echo  ====================================
echo    PrairieBob - Build and Install
echo  ====================================
echo.

:: Check for Node.js
where node >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo ERROR: Node.js is not installed.
    echo Please install Node.js from https://nodejs.org
    pause
    exit /b 1
)

:: Navigate to project directory
cd /d "%~dp0"

echo [1/4] Installing dependencies...
call npm install --no-audit --no-fund >nul 2>&1

echo [2/4] Compiling Electron main process...
call npm run electron:compile
if %ERRORLEVEL% neq 0 (
    echo ERROR: Electron compilation failed.
    pause
    exit /b 1
)

echo [3/4] Building production app...
call npm run build
if %ERRORLEVEL% neq 0 (
    echo ERROR: Build failed.
    pause
    exit /b 1
)

echo [4/4] Packaging installer...
call npx electron-builder --win
if %ERRORLEVEL% neq 0 (
    echo ERROR: Packaging failed.
    pause
    exit /b 1
)

echo.
echo  ====================================
echo    BUILD COMPLETE!
echo  ====================================
echo.
echo  Your installer is in: release\
echo.

:: Find and run the installer
for %%f in (release\*.exe) do (
    if not "%%f"=="" (
        echo  Found: %%f
        echo.
        set /p INSTALL="Install now? (Y/n): "
        if /i not "%INSTALL%"=="n" (
            echo  Launching installer...
            start "" "%%f"
        )
    )
)

echo.
echo  After installing, pin PrairieBob to your taskbar!
echo  Right-click the Start Menu shortcut ^> Pin to taskbar
echo.
pause
