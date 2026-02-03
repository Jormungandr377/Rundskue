@echo off
echo ========================================
echo Finance Tracker Quick Setup
echo ========================================
echo.

REM Check if Python is installed
echo Checking Python installation...
python --version >nul 2>&1
if errorlevel 1 (
    echo ❌ ERROR: Python is not installed or not in PATH
    echo Please install Python 3.11+ from https://www.python.org/downloads/
    echo Make sure to check "Add Python to PATH" during installation
    pause
    exit /b 1
) else (
    python --version
    echo ✅ Python found
)

REM Check if Node is installed
echo Checking Node.js installation...
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ ERROR: Node.js is not installed or not in PATH
    echo Please install Node.js 18+ from https://nodejs.org/
    pause
    exit /b 1
) else (
    node --version
    echo ✅ Node.js found
)

REM Check if PostgreSQL is available
echo Checking PostgreSQL installation...
psql --version >nul 2>&1
if errorlevel 1 (
    echo ⚠️  WARNING: PostgreSQL not found in PATH
    echo Please ensure PostgreSQL is installed and added to PATH
    echo You can continue but may need to configure database manually
) else (
    psql --version
    echo ✅ PostgreSQL found
)

echo.
echo ========================================
echo Setting up Backend
echo ========================================

cd backend

REM Create virtual environment
if not exist "venv" (
    echo Creating Python virtual environment...
    python -m venv venv
)

REM Activate virtual environment
echo Activating virtual environment...
call venv\Scripts\activate.bat

REM Install dependencies
echo Installing Python dependencies...
pip install -r requirements.txt

REM Check if .env exists
if not exist ".env" (
    echo.
    echo ⚠️  .env file not found!
    echo Creating .env from template...
    echo.
    echo # Database > .env
    echo DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/finance_tracker >> .env
    echo. >> .env
    echo # Plaid API >> .env
    echo PLAID_CLIENT_ID=your_client_id_here >> .env
    echo PLAID_SECRET=your_sandbox_secret_here >> .env
    echo PLAID_ENV=sandbox >> .env
    echo. >> .env
    echo # Security >> .env
    echo ENCRYPTION_KEY=change-this-32-character-key-now! >> .env
    echo SECRET_KEY=change-this-secret-key-for-sessions >> .env
    echo. >> .env
    echo # Optional >> .env
    echo FRONTEND_URL=http://localhost:3000 >> .env
    echo DEBUG=True >> .env
    echo.
    echo ❌ IMPORTANT: Please edit backend\.env with your database password and Plaid credentials!
    echo You can get Plaid credentials from https://dashboard.plaid.com
    echo.
    pause
    notepad .env
)

echo.
echo ========================================
echo Setting up Database
echo ========================================

echo Creating database tables...
python -c "from app.database import engine; from app.models import Base; Base.metadata.create_all(bind=engine)" 2>nul
if errorlevel 1 (
    echo ❌ Database setup failed. Please check your DATABASE_URL in .env file
    echo Make sure PostgreSQL is running and the database exists
    pause
    exit /b 1
)

echo Seeding initial data...
python scripts\seed_categories.py 2>nul
if errorlevel 1 (
    echo ⚠️  Seeding failed, but continuing...
)

echo ✅ Backend setup complete!

echo.
echo ========================================
echo Setting up Frontend
echo ========================================

cd ..\frontend

echo Installing Node.js dependencies...
call npm install

echo ✅ Frontend setup complete!

echo.
echo ========================================
echo Setup Complete! 🎉
echo ========================================
echo.
echo To start your Finance Tracker:
echo.
echo 1. Open TWO command prompts
echo.
echo 2. In the FIRST terminal, start the backend:
echo    cd "D:\Coding Projects\Finance Project\files\finance-tracker\backend"
echo    venv\Scripts\activate
echo    uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
echo.
echo 3. In the SECOND terminal, start the frontend:
echo    cd "D:\Coding Projects\Finance Project\files\finance-tracker\frontend"
echo    npm run dev
echo.
echo 4. Open your browser to: http://localhost:3000
echo.
echo 📚 API Documentation: http://localhost:8000/docs
echo 🔧 Backend Health: http://localhost:8000/health (if available)
echo.
pause