# Finance Tracker Deployment Guide (Coolify)

This guide covers deploying the Finance Tracker to Coolify via Docker.

## Prerequisites

1. **Coolify Instance**: Self-hosted Coolify with Docker support
2. **PostgreSQL**: Database service running on Coolify
3. **Plaid Account**: API keys from [dashboard.plaid.com](https://dashboard.plaid.com/)
4. **GitHub**: Code pushed to GitHub (Coolify pulls from there)

## Architecture

Single Docker container serving both the React frontend and FastAPI backend:

```
Coolify -> GitHub (main branch) -> Docker build -> Container
                                                   |
                                                   +-- React (static files)
                                                   +-- FastAPI (API + serves frontend)
                                                   +-- Auto-migrations on startup
```

## Environment Variables

Set these in the Coolify dashboard for your application:

### Required

```bash
# Database (your Coolify PostgreSQL service)
DATABASE_URL=postgresql://postgres:password@db-host:5432/finance_tracker

# Security keys (generate unique values!)
SECRET_KEY=<run: python -c "import secrets; print(secrets.token_hex(32))">
ENCRYPTION_KEY=<run: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())">

# Plaid API
PLAID_CLIENT_ID=your_plaid_client_id
PLAID_SECRET=your_plaid_secret
PLAID_ENV=sandbox

# Production settings
DEBUG=false
FRONTEND_URL=https://finance.rundskue.com
```

### Optional

```bash
# Email (for password reset)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM=noreply@financetracker.com

# Daily Plaid sync time
SYNC_HOUR=3
SYNC_MINUTE=0

# Custom admin credentials (first deploy only)
DEFAULT_ADMIN_EMAIL=admin@financetracker.local
DEFAULT_ADMIN_PASSWORD=ChangeMe123!
```

## Deployment Steps

### 1. Push to GitHub

```bash
git push origin main
```

### 2. Coolify Configuration

- **Build type**: Dockerfile
- **Port**: 3000
- **Health check**: `/api/health`
- **Domain**: finance.rundskue.com

### 3. First Deploy

On first deploy, the startup script automatically:
1. Runs Alembic migrations (creates auth tables)
2. Creates default admin user if no users exist
3. Links orphaned profiles to the admin user
4. Starts the FastAPI server

### 4. Post-Deploy

1. Navigate to https://finance.rundskue.com
2. Login with default credentials:
   - Email: `admin@financetracker.local`
   - Password: `ChangeMe123!`
3. **Change the password immediately**
4. Optionally enable 2FA

## Authentication System

The app uses JWT-based authentication:
- **Access tokens**: 15-minute expiry
- **Refresh tokens**: 7-30 days (with "remember me")
- **2FA**: Optional TOTP (Google Authenticator)
- **Password reset**: Email-based (requires SMTP config)

All API endpoints require authentication. Data is scoped per user.

## Troubleshooting

### Container won't start
- Check Coolify logs for migration errors
- Verify DATABASE_URL is correct and database is reachable

### 401 on all endpoints
- Auth system is working - you need to login first
- Test: `curl https://finance.rundskue.com/api/health` (this endpoint is public)

### Migration errors
- Check if database is accessible from the container
- Migrations are idempotent - safe to retry

### Can't login
- Verify the data migration created the admin user (check Coolify logs for "Migration completed")
- Check SECRET_KEY hasn't changed between deploys (invalidates tokens)

## Redeployment

Push to main branch and redeploy in Coolify. Migrations run automatically and skip already-applied changes.
