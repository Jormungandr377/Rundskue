"""Data migration script: Create default admin user and link existing profiles.

This script should be run AFTER the Alembic migration that adds the authentication tables.

It will:
1. Create a default admin user (if no users exist)
2. Associate all orphaned profiles with the admin user
3. Display login credentials

Usage:
    python scripts/migrate_to_auth.py
"""
import sys
import os
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy.orm import Session
from app.database import SessionLocal, engine
from app.models import User, Profile
from app.core.security import hash_password
from app.config import get_settings

settings = get_settings()


def migrate_existing_data():
    """Create default admin user and associate existing profiles."""
    db: Session = SessionLocal()

    try:
        print("=" * 70)
        print("Finance Tracker - Authentication Migration")
        print("=" * 70)
        print()

        # Check if users already exist
        existing_users = db.query(User).count()
        if existing_users > 0:
            print(f"⚠️  Migration aborted: {existing_users} user(s) already exist in database")
            print("   This script should only be run once during initial auth setup.")
            return

        # Get default credentials from environment or use defaults
        default_email = os.getenv("DEFAULT_ADMIN_EMAIL", "admin@financetracker.local")
        default_password = os.getenv("DEFAULT_ADMIN_PASSWORD", "ChangeMe123!")

        print("Step 1: Creating default admin user...")
        print(f"   Email: {default_email}")

        # Create admin user
        admin_user = User(
            email=default_email,
            hashed_password=hash_password(default_password),
            is_active=True,
            is_verified=True
        )
        db.add(admin_user)
        db.commit()
        db.refresh(admin_user)

        print(f"   ✅ Admin user created (ID: {admin_user.id})")
        print()

        # Associate orphaned profiles with admin user
        print("Step 2: Linking existing profiles to admin user...")
        orphan_profiles = db.query(Profile).filter(Profile.user_id == None).all()

        if orphan_profiles:
            for profile in orphan_profiles:
                profile.user_id = admin_user.id
                print(f"   - Linked profile: {profile.name} (ID: {profile.id})")

            db.commit()
            print(f"   ✅ Linked {len(orphan_profiles)} profile(s) to admin user")
        else:
            print("   ℹ️  No orphaned profiles found")

        print()
        print("=" * 70)
        print("✅ Migration completed successfully!")
        print("=" * 70)
        print()
        print("IMPORTANT: Login Credentials")
        print("-" * 70)
        print(f"Email:    {default_email}")
        print(f"Password: {default_password}")
        print()
        print("⚠️  SECURITY WARNING:")
        print("   Change this password immediately after your first login!")
        print()
        print("Next Steps:")
        print("   1. Login to Finance Tracker with the credentials above")
        print("   2. Change your password immediately")
        print("   3. Optionally enable two-factor authentication")
        print("   4. Optionally update your email address")
        print("=" * 70)

    except Exception as e:
        db.rollback()
        print(f"❌ Migration failed: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

    finally:
        db.close()


if __name__ == "__main__":
    migrate_existing_data()
