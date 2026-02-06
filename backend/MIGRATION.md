# Authentication Migration Guide

This guide explains how to migrate the Finance Tracker database from the no-authentication version to the authentication-enabled version.

## Overview

The migration process involves three steps:
1. **Alembic Migration 001**: Add authentication tables (users, refresh_tokens, password_reset_tokens) and user_id to profiles
2. **Data Migration Script**: Create default admin user and link existing profiles
3. **Alembic Migration 002**: Make user_id required on profiles table

## Prerequisites

- Backup your database before starting
- Have access to the database (via Coolify or direct connection)
- Python environment with all dependencies installed

## Migration Steps

### Step 1: Run First Alembic Migration

This creates the authentication tables and adds a nullable `user_id` column to the profiles table.

```bash
cd backend
alembic upgrade 001
```

**What it does:**
- Creates `users` table
- Creates `refresh_tokens` table
- Creates `password_reset_tokens` table
- Adds `user_id` column to `profiles` (nullable)

### Step 2: Run Data Migration Script

This creates a default admin user and associates all existing profiles with it.

```bash
cd backend
python scripts/migrate_to_auth.py
```

**What it does:**
- Creates admin user with email: `admin@financetracker.local`
- Sets temporary password: `ChangeMe123!` (from env or default)
- Links all orphaned profiles to the admin user
- Displays login credentials

**Environment Variables (Optional):**
```bash
export DEFAULT_ADMIN_EMAIL="your-email@example.com"
export DEFAULT_ADMIN_PASSWORD="YourSecurePassword123!"
python scripts/migrate_to_auth.py
```

### Step 3: Run Second Alembic Migration

This makes `user_id` required and adds the foreign key constraint.

```bash
cd backend
alembic upgrade 002
```

**What it does:**
- Makes `user_id` non-nullable on profiles table
- Adds foreign key constraint from profiles to users

**⚠️ Important:** This will fail if Step 2 was not completed successfully!

## Verification

After completing all migrations:

1. **Check tables exist:**
   ```sql
   \dt  -- List all tables
   -- Should see: users, refresh_tokens, password_reset_tokens, profiles, etc.
   ```

2. **Verify admin user:**
   ```sql
   SELECT id, email, is_active FROM users;
   ```

3. **Verify profiles are linked:**
   ```sql
   SELECT id, name, user_id FROM profiles;
   -- All profiles should have a user_id
   ```

4. **Test login:**
   - Navigate to your Finance Tracker URL
   - Login with the credentials from Step 2
   - Change your password immediately!

## Rollback (if needed)

If you need to rollback the migrations:

```bash
# Rollback to before authentication
alembic downgrade base
```

**⚠️ Warning:** This will delete all users, sessions, and authentication data!

## Docker/Coolify Deployment

If running in Docker/Coolify:

### Method 1: Via Coolify Container Shell

1. Access the Coolify dashboard
2. Navigate to your Finance Tracker application
3. Open the container shell/terminal
4. Run the migration commands

### Method 2: Via Docker Exec

```bash
# Get container ID
docker ps | grep finance-tracker

# Run migrations
docker exec -it <container-id> alembic upgrade 001
docker exec -it <container-id> python scripts/migrate_to_auth.py
docker exec -it <container-id> alembic upgrade 002
```

### Method 3: One-time Migration Container

Create a temporary container just for migration:

```bash
# From your local machine with database access
cd backend
docker run --rm \
  --network="your-network" \
  -e DATABASE_URL="your-database-url" \
  -v $(pwd):/app \
  -w /app \
  python:3.11 \
  bash -c "pip install -r requirements.txt && alembic upgrade head && python scripts/migrate_to_auth.py"
```

## Environment Configuration

After migration, ensure these variables are set in your `.env` or Coolify environment:

```
# Required
SECRET_KEY=<generate-with-openssl-rand-hex-32>
DATABASE_URL=postgresql://user:pass@host:5432/dbname

# Optional (for email features)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM=noreply@financetracker.com
```

Generate a secure secret key:
```bash
openssl rand -hex 32
```

## Post-Migration Tasks

1. **Change Admin Password**
   - Login immediately after migration
   - Navigate to profile/settings
   - Change the default password

2. **Configure Email (Optional)**
   - Set SMTP environment variables
   - Test password reset functionality

3. **Enable 2FA (Recommended)**
   - Login to your account
   - Navigate to security settings
   - Enable Google Authenticator 2FA

4. **Create Additional Users (if needed)**
   - Use the registration endpoint
   - Or add via the UI once built

## Troubleshooting

### Migration 002 fails with "column contains null values"

**Problem:** Some profiles still have NULL user_id

**Solution:** Run the data migration script again:
```bash
python scripts/migrate_to_auth.py
```

### "User already exists" error

**Problem:** Data migration script was already run

**Solution:** This is normal - the script prevents duplicate admin users. Skip to migration 002.

### Database connection errors

**Problem:** Cannot connect to database

**Solutions:**
- Check DATABASE_URL environment variable
- Verify database is running
- Check network connectivity
- Verify credentials

### Import errors running scripts

**Problem:** Module not found errors

**Solution:** Install dependencies:
```bash
cd backend
pip install -r requirements.txt
```

## Migration Status Check

To check current migration status:

```bash
cd backend
alembic current
alembic history
```

To see what migrations would be applied:

```bash
alembic upgrade head --sql > migration.sql
# Review migration.sql before applying
```

## Support

If you encounter issues:
1. Check the troubleshooting section above
2. Review migration logs for error messages
3. Ensure database backup is available for rollback
4. Check that all prerequisites are met

## Summary

```bash
# Complete migration process (3 commands)
cd backend
alembic upgrade 001              # Add auth tables
python scripts/migrate_to_auth.py  # Create admin & link profiles
alembic upgrade 002              # Make user_id required

# Or upgrade to latest (runs all pending migrations)
alembic upgrade head
```

Remember to **change the default admin password** immediately after migration!
