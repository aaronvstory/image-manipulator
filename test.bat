@echo off
:: Test script for Image Manipulator v2.0 functionality
:: PAPESLAY - Automated testing

echo.
echo Testing Image Manipulator Components...
echo.

cd /d "%~dp0"

echo Current directory: %CD%
echo.

echo 1. Checking project files...
if exist "server.js" (echo    - server.js found) else (echo    - server.js missing)
if exist "package.json" (echo    - package.json found) else (echo    - package.json missing)
if exist "public\index.html" (echo    - index.html found) else (echo    - index.html missing)
if exist "public\style.css" (echo    - style.css found) else (echo    - style.css missing)
if exist "public\script.js" (echo    - script.js found) else (echo    - script.js missing)

echo.
echo 2. Checking Node.js...
node --version
if errorlevel 1 (
    echo    - Node.js not available
) else (
    echo    - Node.js is available
)

echo.
echo 3. Checking dependencies...
if exist "node_modules" (
    echo    - Dependencies installed
) else (
    echo    - Dependencies not installed - run npm install
)

echo.
echo 4. Checking sample directory...
set "TARGET_DIR=.\test-images"
if exist "%TARGET_DIR%" (
    echo    - Sample directory exists
    echo    - Ready for testing with sample images
) else (
    echo    - Sample directory not found - this is normal
    echo    - Use the folder browser in the app to select an image directory
)

echo.
echo Test complete! All components checked.
echo.
pause
