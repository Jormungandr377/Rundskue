@echo off
echo ========================================
echo Starting Finance Tracker Frontend
echo ========================================
echo.

cd frontend

REM Check if node_modules exists
if not exist "node_modules" (
    echo ❌ Dependencies not installed. Please run quick-setup.bat first.
    pause
    exit /b 1
)

echo Starting React development server...
echo.
echo 🚀 Frontend will be available at: http://localhost:3000
echo.
echo The page will auto-reload when you make changes.
echo Press Ctrl+C to stop the server
echo.

npm run dev