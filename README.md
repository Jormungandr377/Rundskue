# Personal Finance Tracker

A self-hosted personal finance management application with Plaid integration, TSP retirement simulator, and Monarch-style analytics. Built for privacy-conscious users who want full control of their financial data.

## Features

- **Bank Account Syncing** - Connect to 12,000+ financial institutions via Plaid
- **Transaction Management** - Automatic categorization, search, and filtering
- **Budget Tracking** - Monthly budgets by category with progress visualization
- **Financial Reports** - Spending analysis, income vs expenses, net worth tracking
- **TSP Simulator** - Military/federal employee retirement projections with BRS matching
- **Multi-Profile Support** - Track finances for multiple people or purposes

## Tech Stack

**Backend:**
- Python 3.11+ with FastAPI
- PostgreSQL database
- SQLAlchemy ORM
- Plaid API for bank connections

**Frontend:**
- React 18 with TypeScript
- Vite build tool
- Tailwind CSS
- Recharts for visualizations
- React Query for data fetching

## Prerequisites

- Windows 10/11 (or Linux/macOS)
- Python 3.11 or higher
- Node.js 18 or higher
- PostgreSQL 15 or higher
- Plaid API credentials (free development account)

## Windows Installation Guide

### Step 1: Install PostgreSQL

1. Download PostgreSQL from https://www.postgresql.org/download/windows/
2. Run the installer and follow the prompts
3. Remember the password you set for the `postgres` user
4. Add PostgreSQL to PATH (usually `C:\Program Files\PostgreSQL\15\bin`)

Create the database:
```cmd
psql -U postgres
CREATE DATABASE finance_tracker;
\q
```

### Step 2: Install Python

1. Download Python from https://www.python.org/downloads/
2. **Important:** Check "Add Python to PATH" during installation
3. Verify installation:
```cmd
python --version
```

### Step 3: Install Node.js

1. Download Node.js LTS from https://nodejs.org/
2. Run the installer
3. Verify installation:
```cmd
node --version
npm --version
```

### Step 4: Get Plaid API Credentials

1. Sign up at https://dashboard.plaid.com/signup
2. Navigate to Team Settings > Keys
3. Copy your `client_id`, `secret` (Sandbox), and `secret` (Development)
4. For production, you'll need to apply for Production access

### Step 5: Clone and Configure

```cmd
cd C:\Users\YourName\Projects
git clone <your-repo-url> finance-tracker
cd finance-tracker
```

Create backend environment file:
```cmd
copy backend\.env.example backend\.env
notepad backend\.env
```

Edit with your values:
```env
DATABASE_URL=postgresql://postgres:yourpassword@localhost:5432/finance_tracker
PLAID_CLIENT_ID=your_client_id
PLAID_SECRET=your_sandbox_secret
PLAID_ENV=sandbox
ENCRYPTION_KEY=your-32-character-encryption-key!
```

### Step 6: Setup Backend

```cmd
cd backend

:: Create virtual environment
python -m venv venv

:: Activate virtual environment
venv\Scripts\activate

:: Install dependencies
pip install -r requirements.txt

:: Run database migrations (creates tables)
python -c "from app.database import engine; from app.models import Base; Base.metadata.create_all(bind=engine)"

:: Seed initial data (categories)
python scripts/seed_categories.py
```

### Step 7: Setup Frontend

```cmd
cd ..\frontend

:: Install dependencies
npm install
```

### Step 8: Run the Application

**Terminal 1 - Backend:**
```cmd
cd backend
venv\Scripts\activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**Terminal 2 - Frontend:**
```cmd
cd frontend
npm run dev
```

Access the application at http://localhost:3000

## Running as a Windows Service (Optional)

For persistent operation on your home server, you can run the backend as a Windows service using NSSM (Non-Sucking Service Manager):

1. Download NSSM from https://nssm.cc/download
2. Extract and add to PATH
3. Install the service:

```cmd
nssm install FinanceTrackerBackend

:: In the NSSM GUI:
:: Path: C:\Users\YourName\Projects\finance-tracker\backend\venv\Scripts\python.exe
:: Startup directory: C:\Users\YourName\Projects\finance-tracker\backend
:: Arguments: -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

For the frontend, build for production and serve with a static file server:

```cmd
cd frontend
npm run build
npm install -g serve
nssm install FinanceTrackerFrontend
:: Path: C:\Users\YourName\AppData\Roaming\npm\serve.cmd
:: Arguments: -s dist -l 3000
:: Startup directory: C:\Users\YourName\Projects\finance-tracker\frontend
```

## Configuration

### Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@localhost:5432/dbname` |
| `PLAID_CLIENT_ID` | Plaid API client ID | `abc123...` |
| `PLAID_SECRET` | Plaid API secret | `xyz789...` |
| `PLAID_ENV` | Plaid environment | `sandbox`, `development`, or `production` |
| `ENCRYPTION_KEY` | 32-char key for encrypting Plaid tokens | `your-32-character-encryption-key!` |

### Plaid Environments

- **Sandbox**: Free testing with fake bank credentials (user: `user_good`, pass: `pass_good`)
- **Development**: Real bank connections, 100 items free
- **Production**: Unlimited, requires Plaid approval

## Usage

### First-Time Setup

1. Open http://localhost:3000
2. Create a profile (your name or "Personal")
3. Go to "Link Account" and connect your first bank
4. Wait for transactions to sync (may take a few minutes)
5. Review and categorize transactions as needed
6. Set up budgets for your spending categories

### TSP Simulator

The TSP simulator helps military and federal employees project retirement savings:

1. Go to "TSP Simulator"
2. Create a scenario with your current TSP balance
3. Enter your base pay, contribution percentage, and target retirement age
4. Adjust fund allocation (G, F, C, S, I funds)
5. Compare different scenarios to optimize your strategy

### Transaction Categorization

Transactions are automatically categorized based on Plaid's merchant data. You can:
- Change categories by clicking the category dropdown
- Mark transactions as transfers (excluded from spending reports)
- Exclude transactions from all reports
- Search and filter by date, account, or category

## API Documentation

When running, visit http://localhost:8000/docs for interactive API documentation.

## Troubleshooting

### "Cannot connect to database"
- Ensure PostgreSQL service is running
- Check your DATABASE_URL in `.env`
- Verify the database `finance_tracker` exists

### "Plaid link not opening"
- Check browser console for errors
- Verify PLAID_CLIENT_ID and PLAID_SECRET are correct
- Ensure PLAID_ENV matches your Plaid dashboard

### "Transactions not syncing"
- Check the Plaid item status in Link Account page
- Look for errors in the backend console
- Try manual sync by clicking "Sync" button

### Port already in use
```cmd
:: Find process using port 8000
netstat -ano | findstr :8000
:: Kill the process
taskkill /PID <PID> /F
```

## Security Notes

- All Plaid access tokens are encrypted at rest using Fernet encryption
- Never commit your `.env` file to version control
- Use a strong, unique ENCRYPTION_KEY
- For production, use HTTPS with a reverse proxy (nginx/Caddy)
- Consider firewall rules if exposing to your local network

## Backup

Backup your PostgreSQL database regularly:

```cmd
pg_dump -U postgres finance_tracker > backup_%date:~-4,4%%date:~-10,2%%date:~-7,2%.sql
```

Restore from backup:
```cmd
psql -U postgres finance_tracker < backup_20240115.sql
```

## License

MIT License - See LICENSE file for details.

## Acknowledgments

- [Plaid](https://plaid.com/) for bank connectivity
- [Monarch Money](https://www.monarchmoney.com/) for design inspiration
- [Recharts](https://recharts.org/) for beautiful charts
