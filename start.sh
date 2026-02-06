#!/bin/bash
# Startup script for Finance Tracker
# Runs database migrations automatically, then starts the app
# NOTE: No 'set -e' — migration failures must NOT prevent app startup

echo "=== Finance Tracker Startup ==="

# Run Alembic migrations (safe to run repeatedly - skips already-applied)
echo "Running database migrations..."
cd /app/backend

# Check if we can connect to the database
if python3 -c "
from app.database import engine
from sqlalchemy import text
with engine.connect() as conn:
    conn.execute(text('SELECT 1'))
    print('Database connection OK')
" 2>&1; then
    echo "Running Alembic migrations..."
    python3 -m alembic upgrade head 2>&1 || echo "Warning: Alembic migration had issues (may already be applied)"

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
else
    echo "Warning: Could not connect to database. Skipping migrations."
fi

cd /app

echo "Starting Finance Tracker API..."
exec python3 -m uvicorn backend.app.main:app --host 0.0.0.0 --port ${PORT:-3000}
