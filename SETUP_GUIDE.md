# Finance Tracker Setup Guide

## Prerequisites Installation

### 1. Install Python 3.11+
1. Go to https://www.python.org/downloads/
2. Download Python 3.11 or newer
3. ✅ **IMPORTANT**: Check "Add Python to PATH" during installation
4. ✅ Choose "Install for all users"
5. Restart your command prompt or computer after installation

### 2. Install Node.js 18+
1. Go to https://nodejs.org/
2. Download the LTS version (recommended)
3. Run the installer with default settings
4. Restart your command prompt after installation

### 3. Install PostgreSQL 15+
1. Go to https://www.postgresql.org/download/windows/
2. Download and run the installer
3. Remember the password you set for the `postgres` user
4. Add PostgreSQL to PATH: `C:\Program Files\PostgreSQL\15\bin`

### 4. Get Plaid API Credentials
1. Go to https://dashboard.plaid.com
2. Create a free account
3. Get your Client ID and Sandbox Secret
4. You'll use these in the .env file

## Quick Start Commands

After installing prerequisites, run these commands:

```cmd
# 1. Verify installations
python --version
node --version
psql --version

# 2. Create database
createdb -U postgres finance_tracker

# 3. Navigate to project
cd "D:\Coding Projects\Finance Project\files\finance-tracker"

# 4. Setup backend
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt

# 5. Configure environment (edit with your values)
copy .env.example .env
notepad .env

# 6. Initialize database
python -c "from app.database import engine; from app.models import Base; Base.metadata.create_all(bind=engine)"
python scripts\seed_categories.py

# 7. Start backend (in first terminal)
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# 8. Setup frontend (in second terminal)
cd ..\frontend
npm install
npm run dev
```

## Environment Configuration

Edit `backend\.env` with your values:

```env
# Database
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/finance_tracker

# Plaid API
PLAID_CLIENT_ID=your_client_id_here
PLAID_SECRET=your_sandbox_secret_here
PLAID_ENV=sandbox

# Security (generate a 32-character random string)
ENCRYPTION_KEY=your-32-character-encryption-key!
SECRET_KEY=your-secret-key-for-sessions

# Optional
FRONTEND_URL=http://localhost:3000
DEBUG=True
```

## Troubleshooting

### Python not found
- Restart command prompt/computer after Python installation
- Verify PATH: `echo $PATH` should include Python directory

### Node not found
- Restart command prompt after Node.js installation
- Try `node -v` and `npm -v`

### Database connection error
- Ensure PostgreSQL is running: `pg_ctl status`
- Check password and database name in .env file
- Create database: `createdb -U postgres finance_tracker`

### Plaid errors
- Verify your credentials in Plaid Dashboard
- Ensure you're using Sandbox environment for testing
- Check .env file has correct PLAID_CLIENT_ID and PLAID_SECRET

## Success!

When everything is working:
- Backend will be at: http://localhost:8000
- Frontend will be at: http://localhost:3000
- API docs will be at: http://localhost:8000/docs