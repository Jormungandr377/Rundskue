#!/bin/bash
# Startup script for Finance Tracker
# Runs database migrations automatically, then starts the app
# NOTE: No 'set -e' — migration failures must NOT prevent app startup

echo "=== Finance Tracker Startup ==="

# Run Alembic migrations (safe to run repeatedly - skips already-applied)
echo "Running database migrations..."
cd /app/backend

# Check if we can connect to the database (with retry logic)
MAX_RETRIES=5
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if python3 -c "
from app.database import engine
from sqlalchemy import text
with engine.connect() as conn:
    conn.execute(text('SELECT 1'))
    print('Database connection OK')
" 2>&1; then
        echo "Database connection successful!"

        # Run Alembic migrations with proper error capture
        echo "Running Alembic migrations..."
        if python3 -m alembic upgrade head 2>&1; then
            echo "✓ Migrations completed successfully"
        else
            MIGRATION_EXIT_CODE=$?
            echo "⚠ Warning: Alembic migration exited with code $MIGRATION_EXIT_CODE"
            echo "  This may be expected if migrations are already applied"
        fi
        break
    else
        RETRY_COUNT=$((RETRY_COUNT + 1))
        if [ $RETRY_COUNT -lt $MAX_RETRIES ]; then
            echo "Database connection failed (attempt $RETRY_COUNT/$MAX_RETRIES). Retrying in 2 seconds..."
            sleep 2
        else
            echo "⚠ ERROR: Could not connect to database after $MAX_RETRIES attempts"
            echo "  The application will start but may not function correctly"
        fi
    fi
done

# Only proceed with data setup if database is connected
if [ $RETRY_COUNT -lt $MAX_RETRIES ]; then

    # Run data migration if users table is empty (first-time setup only)
    USER_CHECK=$(python3 -c "
from app.database import SessionLocal
from app.models import User
db = SessionLocal()
count = db.query(User).count()
db.close()
if count == 0:
    print('NO_USERS')
else:
    print(f'USERS_EXIST ({count})')
" 2>&1) || true

    echo "User check result: $USER_CHECK"

    if echo "$USER_CHECK" | grep -q "NO_USERS"; then
        echo "First-time setup: Creating default admin user..."
        python3 scripts/migrate_to_auth.py 2>&1 || echo "Warning: Admin user creation had issues"
    fi

    # One-time fix: update .local email to .app (email-validator rejects .local TLD)
    python3 -c "
from app.database import SessionLocal
from app.models import User
db = SessionLocal()
user = db.query(User).filter(User.email == 'admin@financetracker.local').first()
if user:
    user.email = 'admin@financetracker.app'
    db.commit()
    print('Fixed admin email: .local -> .app')
else:
    print('Admin email fix not needed')
db.close()
" 2>&1 || true
fi

cd /app

echo "Starting Finance Tracker API..."
exec python3 -m uvicorn backend.app.main:app --host 0.0.0.0 --port ${PORT:-3000}
