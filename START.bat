@echo off
title PrairieBob Launcher
color 0A

echo.
echo  ====================================
echo   PrairieBob - Tile Editor
echo  ====================================
echo.

:: Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js is not installed!
    echo.
    echo Please install Node.js from: https://nodejs.org/
    echo Download the LTS version and run the installer.
    echo.
    pause
    exit /b 1
)

echo [OK] Node.js found: 
node --version
echo.

:: Check if node_modules exists
if not exist "node_modules" (
    echo [INFO] First time setup - installing dependencies...
    echo This may take a few minutes...
    echo.
    call npm install
    if %ERRORLEVEL% NEQ 0 (
        echo [ERROR] npm install failed!
        pause
        exit /b 1
    )
    echo.
    echo [OK] Dependencies installed!
    echo.
)

:: Check if dist folder exists, if not build
if not exist "dist" (
    echo [INFO] Building app for first time...
    echo.
    call npm run build
    echo.
)

:: Check if dist-electron folder exists, if not compile electron
if not exist "dist-electron\main.cjs" (
    echo [INFO] Compiling Electron main process...
    echo.
    call npm run electron:compile
    echo.
)

echo [INFO] Starting PrairieBob...
echo.
echo TIP: Press Ctrl+C in this window to stop the app.
echo.

:: Run the Electron app in dev mode
call npm run electron:dev

pause
