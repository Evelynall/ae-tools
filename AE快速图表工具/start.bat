@echo off
chcp 65001 >nul 2>&1
title DataMotion Dev Server

cd /d "%~dp0"

echo ================================
echo   DataMotion Dev Server
echo ================================
echo.

set "NODE_DIR="
set "NODE_ROOT=%USERPROFILE%\.workbuddy\binaries\node\versions"

REM --- Step 1: is npm already in system PATH? ---
where npm >nul 2>&1
if not errorlevel 1 goto :system_npm

REM --- Step 2: scan WorkBuddy managed Node version folders ---
REM The version folder name changes on upgrades, so scan instead of hard-coding it.
if not exist "%NODE_ROOT%" goto :check_programfiles
for /d %%D in ("%NODE_ROOT%\*") do (
    if exist "%%~D\npm.cmd" set "NODE_DIR=%%~D"
)
if defined NODE_DIR goto :found_node

REM --- Step 3: standard Node.js install locations ---
:check_programfiles
if exist "C:\Program Files\nodejs\npm.cmd" goto :pf_node
if exist "%LOCALAPPDATA%\Programs\nodejs\npm.cmd" goto :localapp_node
goto :not_found

REM ---------------- resolved branches ----------------
:system_npm
echo [INFO] Using npm from system PATH.
goto :ready

:found_node
set "PATH=%NODE_DIR%;%PATH%"
echo [INFO] Using managed Node: %NODE_DIR%
goto :ready

:pf_node
set "NODE_DIR=C:\Program Files\nodejs"
set "PATH=%NODE_DIR%;%PATH%"
echo [INFO] Using Node from: %NODE_DIR%
goto :ready

:localapp_node
set "NODE_DIR=%LOCALAPPDATA%\Programs\nodejs"
set "PATH=%NODE_DIR%;%PATH%"
echo [INFO] Using Node from: %NODE_DIR%
goto :ready

:not_found
echo [ERROR] npm not found on this machine.
echo.
echo Looked in:
echo   - system PATH
echo   - %NODE_ROOT%
echo   - C:\Program Files\nodejs
echo.
echo Fix: install Node.js from https://nodejs.org, then re-run this file.
pause
exit /b 1

REM ---------------- start server ----------------
:ready
REM NOTE: on Windows npm is npm.cmd, so it MUST be invoked with CALL.
REM Without CALL this script would be terminated and never return.
call npm -v >nul 2>&1
if errorlevel 1 (
    echo [ERROR] npm located but not runnable.
    pause
    exit /b 1
)

if not exist "node_modules" (
    echo [INFO] node_modules not found, running npm install...
    call npm install
    if errorlevel 1 (
        echo [ERROR] npm install failed.
        pause
        exit /b 1
    )
    echo.
)

echo [INFO] Starting Vite dev server at http://127.0.0.1:5173
echo [INFO] Press Ctrl+C to stop.
echo.

call npm run dev

pause
