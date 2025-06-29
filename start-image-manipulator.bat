@echo off
setlocal EnableDelayedExpansion

:: Image Manipulator - Automated Launch Script
:: PAPESLAY - Comprehensive server management with auto-launch and cleanup

echo.
echo ========================================
echo   Image Manipulator - Auto Launcher
echo ========================================
echo.

:: Change to the correct directory
cd /d "%~dp0"
echo Working directory: %CD%

:: Check if Node.js is available
echo Checking Node.js availability...
node --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

:: Check if dependencies are installed
echo Checking dependencies...
if not exist "node_modules" (
    echo Installing dependencies...
    npm install
    if errorlevel 1 (
        echo ERROR: Failed to install dependencies
        pause
        exit /b 1
    )
)

:: Find Chrome executable
set "CHROME_PATH="
echo Locating Google Chrome...

:: Common Chrome installation paths
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" (
    set "CHROME_PATH=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
    goto :chrome_found
)
if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" (
    set "CHROME_PATH=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
    goto :chrome_found
)
if exist "%LocalAppData%\Google\Chrome\Application\chrome.exe" (
    set "CHROME_PATH=%LocalAppData%\Google\Chrome\Application\chrome.exe"
    goto :chrome_found
)

:chrome_found
if "%CHROME_PATH%"=="" (
    echo WARNING: Chrome not found, using default browser
    set "CHROME_PATH=start"
) else (
    echo Chrome found: %CHROME_PATH%
)

:: Start the server in background
echo.
echo Starting Image Manipulator server...
start /B /MIN cmd /c "node server.js > server.log 2>&1"

:: Wait for server to start
echo Waiting for server to initialize...
timeout /t 3 /nobreak >nul

:: Launch browser with the application
echo.
echo Launching Image Manipulator in browser...
echo URL: http://localhost:3000

if "%CHROME_PATH%"=="start" (
    start "" "http://localhost:3000"
) else (
    start "" "%CHROME_PATH%" "http://localhost:3000" --new-window
)

echo.
echo ========================================
echo  Image Manipulator is now running!
echo ========================================
echo.
echo Instructions:
echo   * Click thumbnails for 90 degree CW rotation
echo   * Use CW/CCW buttons for precise control
echo   * All changes save automatically
echo.
echo To stop the server:
echo   * Close this window, or
echo   * Press Ctrl+C
echo.
echo Server will auto-terminate when you close this window
echo.

:: Wait for user input or window close
echo Press any key to stop the server and exit...
pause >nul

:cleanup
echo.
echo Cleaning up...

:: Kill the Node.js server process
echo Stopping server...
taskkill /f /im node.exe >nul 2>&1

echo Server stopped successfully
echo.
echo Thank you for using Image Manipulator!
timeout /t 2 /nobreak >nul

exit /b 0
