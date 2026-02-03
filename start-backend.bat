@echo off
echo ========================================
echo Starting Finance Tracker Backend
echo ========================================
echo.

cd backend

REM Activate virtual environment
if exist "venv\Scripts\activate.bat" (
    echo Activating virtual environment...
    call venv\Scripts\activate.bat
) else (
    echo ❌ Virtual environment not found. Please run quick-setup.bat first.
    pause
    exit /b 1
)

REM Check if .env exists
if not exist ".env" (
    echo ❌ .env file not found. Please run quick-setup.bat first.
    pause
    exit /b 1
)

echo Starting FastAPI server...
echo.
echo 🚀 Backend will be available at: http://localhost:8000
echo 📚 API Documentation: http://localhost:8000/docs
echo.
echo Press Ctrl+C to stop the server
echo.

uvicorn app.main:app --reload --host 0.0.0.0 --port 8000