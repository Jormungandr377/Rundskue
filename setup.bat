@echo off
echo ========================================
echo Finance Tracker Setup Script
echo ========================================
echo.

REM Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python is not installed or not in PATH
    echo Please install Python 3.11+ from https://www.python.org/downloads/
    pause
    exit /b 1
)

REM Check if Node is installed
node --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js is not installed or not in PATH
    echo Please install Node.js 18+ from https://nodejs.org/
    pause
    exit /b 1
)

REM Check if .env file exists
if not exist "backend\.env" (
    echo.
    echo WARNING: backend\.env not found!
    echo Please copy backend\.env.example to backend\.env and fill in your values.
    echo.
    copy backend\.env.example backend\.env
    echo Created backend\.env from template. Please edit it with your values.
    pause
    exit /b 1
)

echo.
echo Step 1: Setting up Python virtual environment...
cd backend
if not exist "venv" (
    python -m venv venv
)
call venv\Scripts\activate.bat

echo.
echo Step 2: Installing Python dependencies...
pip install -r requirements.txt

echo.
echo Step 3: Initializing database...
python -c "from app.database import engine; from app.models import Base; Base.metadata.create_all(bind=engine)"
python scripts\seed_categories.py

echo.
echo Step 4: Setting up frontend...
cd ..\frontend
call npm install

echo.
echo ========================================
echo Setup Complete!
echo ========================================
echo.
echo To start the application:
echo.
echo 1. Open two command prompts
echo.
echo 2. In the first, run:
echo    cd backend
echo    venv\Scripts\activate
echo    uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
echo.
echo 3. In the second, run:
echo    cd frontend
echo    npm run dev
echo.
echo 4. Open http://localhost:3000 in your browser
echo.
pause
