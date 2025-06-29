@echo off
:: Emergency cleanup script for Image Manipulator
:: PAPESLAY - Force cleanup if main script fails

echo.
echo 🧹 Image Manipulator - Emergency Cleanup
echo.

echo 🛑 Stopping all Node.js processes...
taskkill /f /im node.exe >nul 2>&1

echo 🔍 Checking for remaining processes on port 3000...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000"') do (
    echo   Killing process ID: %%a
    taskkill /f /pid %%a >nul 2>&1
)

echo ✅ Cleanup complete!
echo.
pause
