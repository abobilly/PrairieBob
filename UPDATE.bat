@echo off
title PrairieBob - Update
echo.
echo  ====================================
echo    PrairieBob - Pull Updates + Rebuild
echo  ====================================
echo.

cd /d "%~dp0"

echo [1/5] Pulling latest code from GitHub...
git pull origin main
if %ERRORLEVEL% neq 0 (
    echo ERROR: Git pull failed. Do you have git installed?
    pause
    exit /b 1
)

echo [2/5] Installing any new dependencies...
call npm install --no-audit --no-fund >nul 2>&1

echo [3/5] Compiling Electron...
call npm run electron:compile
if %ERRORLEVEL% neq 0 (
    echo ERROR: Compile failed.
    pause
    exit /b 1
)

echo [4/5] Building production app...
call npm run build
if %ERRORLEVEL% neq 0 (
    echo ERROR: Build failed.
    pause
    exit /b 1
)

echo [5/5] Packaging installer...
call npx electron-builder --win
if %ERRORLEVEL% neq 0 (
    echo ERROR: Packaging failed.
    pause
    exit /b 1
)

echo.
echo  ====================================
echo    UPDATE COMPLETE!
echo  ====================================
echo.

:: Find and run the latest installer
for %%f in (release\PrairieBob*.exe) do (
    echo  Installing update: %%f
    start "" "%%f"
    goto :done
)

:done
echo.
echo  The app will update in place.
echo  Your taskbar shortcut stays the same!
echo.
pause
