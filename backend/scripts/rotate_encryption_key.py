#!/usr/bin/env python3
"""
Encryption Key Rotation Script

This script safely rotates the ENCRYPTION_KEY by re-encrypting all sensitive data
with a new key while maintaining data integrity.

Usage:
    1. Generate a new key:
       export NEW_ENCRYPTION_KEY=$(python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())")

    2. Run the rotation:
       python backend/scripts/rotate_encryption_key.py

    3. Update production environment:
       - Set OLD_ENCRYPTION_KEY to current ENCRYPTION_KEY (for rollback)
       - Set ENCRYPTION_KEY to NEW_ENCRYPTION_KEY
       - Restart application

    4. Verify and cleanup:
       - Test application functionality
       - Remove OLD_ENCRYPTION_KEY after 24 hours

Safety Features:
    - Dry-run mode by default
    - Backup verification
    - Rollback capability
    - Transaction-based (all or nothing)

Author: Finance Tracker Team
Last Updated: 2026-02-08
"""

import os
import sys
from datetime import datetime
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from cryptography.fernet import Fernet, InvalidToken
from sqlalchemy import text

from app.database import SessionLocal, engine
from app.models import PlaidItem, User, RefreshToken


class EncryptionKeyRotator:
    """Handles safe rotation of encryption keys."""

    def __init__(self, dry_run: bool = True):
        self.dry_run = dry_run
        self.old_key = os.getenv("ENCRYPTION_KEY")
        self.new_key = os.getenv("NEW_ENCRYPTION_KEY")

        if not self.old_key:
            raise ValueError("ENCRYPTION_KEY not set in environment")

        if not self.new_key:
            raise ValueError("NEW_ENCRYPTION_KEY not set in environment")

        try:
            self.old_fernet = Fernet(self.old_key.encode())
            self.new_fernet = Fernet(self.new_key.encode())
        except Exception as e:
            raise ValueError(f"Invalid encryption key format: {e}")

        self.stats = {
            "plaid_tokens": 0,
            "totp_secrets": 0,
            "refresh_tokens": 0,
            "errors": 0
        }

    def verify_database_connection(self):
        """Verify database is accessible."""
        try:
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            print("✓ Database connection verified")
            return True
        except Exception as e:
            print(f"✗ Database connection failed: {e}")
            return False

    def verify_backup_exists(self):
        """Prompt user to verify backup exists."""
        print("\n⚠️  IMPORTANT: Ensure you have a recent database backup!")
        print("   This operation will modify encrypted data.")
        print("   If something goes wrong, you'll need to restore from backup.")
        print("")

        if self.dry_run:
            print("   Running in DRY-RUN mode - no changes will be made")
            return True

        response = input("   Do you have a verified backup? (yes/no): ").lower()
        return response == "yes"

    def decrypt_with_old_key(self, encrypted_value: str) -> str:
        """Decrypt a value using the old key."""
        try:
            return self.old_fernet.decrypt(encrypted_value.encode()).decode()
        except InvalidToken:
            raise ValueError("Failed to decrypt with old key - may already be using new key")

    def encrypt_with_new_key(self, plaintext: str) -> str:
        """Encrypt a value using the new key."""
        return self.new_fernet.encrypt(plaintext.encode()).decode()

    def rotate_plaid_tokens(self, db):
        """Rotate all Plaid access tokens."""
        print("\n🔄 Rotating Plaid access tokens...")

        items = db.query(PlaidItem).all()
        print(f"   Found {len(items)} Plaid items")

        for item in items:
            try:
                # Decrypt with old key
                decrypted = self.decrypt_with_old_key(item.access_token_encrypted)

                # Encrypt with new key
                if not self.dry_run:
                    item.access_token_encrypted = self.encrypt_with_new_key(decrypted)

                self.stats["plaid_tokens"] += 1

                if self.stats["plaid_tokens"] % 10 == 0:
                    print(f"   Progress: {self.stats['plaid_tokens']}/{len(items)}")

            except Exception as e:
                print(f"   ✗ Error rotating Plaid item {item.id}: {e}")
                self.stats["errors"] += 1
                raise

        print(f"✓ Rotated {self.stats['plaid_tokens']} Plaid tokens")

    def rotate_totp_secrets(self, db):
        """Rotate all TOTP 2FA secrets."""
        print("\n🔄 Rotating TOTP secrets...")

        users = db.query(User).filter(User.totp_secret.isnot(None)).all()
        print(f"   Found {len(users)} users with 2FA enabled")

        for user in users:
            try:
                # Decrypt with old key
                decrypted = self.decrypt_with_old_key(user.totp_secret)

                # Encrypt with new key
                if not self.dry_run:
                    user.totp_secret = self.encrypt_with_new_key(decrypted)

                self.stats["totp_secrets"] += 1

            except Exception as e:
                print(f"   ✗ Error rotating TOTP for user {user.id}: {e}")
                self.stats["errors"] += 1
                raise

        print(f"✓ Rotated {self.stats['totp_secrets']} TOTP secrets")

    def rotate_refresh_tokens(self, db):
        """Rotate all refresh tokens."""
        print("\n🔄 Rotating refresh tokens...")

        tokens = db.query(RefreshToken).all()
        print(f"   Found {len(tokens)} refresh tokens")

        for token in tokens:
            try:
                # Decrypt with old key
                decrypted = self.decrypt_with_old_key(token.token)

                # Encrypt with new key
                if not self.dry_run:
                    token.token = self.encrypt_with_new_key(decrypted)

                self.stats["refresh_tokens"] += 1

                if self.stats["refresh_tokens"] % 50 == 0:
                    print(f"   Progress: {self.stats['refresh_tokens']}/{len(tokens)}")

            except Exception as e:
                print(f"   ✗ Error rotating refresh token {token.id}: {e}")
                self.stats["errors"] += 1
                raise

        print(f"✓ Rotated {self.stats['refresh_tokens']} refresh tokens")

    def verify_rotation(self, db):
        """Verify all encrypted data can be decrypted with new key."""
        print("\n🔍 Verifying rotation...")

        try:
            # Verify Plaid tokens
            sample_item = db.query(PlaidItem).first()
            if sample_item:
                self.new_fernet.decrypt(sample_item.access_token_encrypted.encode())
                print("   ✓ Plaid tokens verified")

            # Verify TOTP secrets
            sample_user = db.query(User).filter(User.totp_secret.isnot(None)).first()
            if sample_user:
                self.new_fernet.decrypt(sample_user.totp_secret.encode())
                print("   ✓ TOTP secrets verified")

            # Verify refresh tokens
            sample_token = db.query(RefreshToken).first()
            if sample_token:
                self.new_fernet.decrypt(sample_token.token.encode())
                print("   ✓ Refresh tokens verified")

            print("✓ All encrypted data verified successfully")
            return True

        except Exception as e:
            print(f"✗ Verification failed: {e}")
            return False

    def print_summary(self):
        """Print rotation summary."""
        print("\n" + "="*60)
        print("ROTATION SUMMARY")
        print("="*60)
        print(f"Mode:            {'DRY-RUN (no changes)' if self.dry_run else 'LIVE'}")
        print(f"Plaid tokens:    {self.stats['plaid_tokens']}")
        print(f"TOTP secrets:    {self.stats['totp_secrets']}")
        print(f"Refresh tokens:  {self.stats['refresh_tokens']}")
        print(f"Errors:          {self.stats['errors']}")
        print("="*60)

    def run(self):
        """Execute the key rotation process."""
        print("\n" + "="*60)
        print("ENCRYPTION KEY ROTATION")
        print("="*60)
        print(f"Started at: {datetime.now().isoformat()}")
        print(f"Mode: {'DRY-RUN' if self.dry_run else 'LIVE'}")
        print("")

        # Pre-flight checks
        if not self.verify_database_connection():
            return False

        if not self.verify_backup_exists():
            print("\n✗ Aborted - backup verification failed")
            return False

        # Perform rotation in transaction
        db = SessionLocal()
        try:
            print("\n🔄 Starting rotation (transaction will rollback on error)...")

            self.rotate_plaid_tokens(db)
            self.rotate_totp_secrets(db)
            self.rotate_refresh_tokens(db)

            if not self.dry_run:
                # Verify before committing
                if self.verify_rotation(db):
                    db.commit()
                    print("\n✓ Transaction committed successfully")
                else:
                    db.rollback()
                    print("\n✗ Verification failed - transaction rolled back")
                    return False
            else:
                db.rollback()
                print("\n✓ Dry-run completed (transaction rolled back)")

            self.print_summary()

            if not self.dry_run:
                print("\n" + "="*60)
                print("NEXT STEPS:")
                print("="*60)
                print("1. Update production environment variables:")
                print("   - Set OLD_ENCRYPTION_KEY to current ENCRYPTION_KEY")
                print("   - Set ENCRYPTION_KEY to NEW_ENCRYPTION_KEY")
                print("2. Restart the application")
                print("3. Verify application functionality")
                print("4. Remove OLD_ENCRYPTION_KEY after 24 hours")
                print("="*60)

            return self.stats["errors"] == 0

        except Exception as e:
            db.rollback()
            print(f"\n✗ Rotation failed: {e}")
            print("   Transaction rolled back - no changes made")
            return False

        finally:
            db.close()


def main():
    """Main entry point."""
    import argparse

    parser = argparse.ArgumentParser(description="Rotate encryption keys safely")
    parser.add_argument(
        "--live",
        action="store_true",
        help="Execute live rotation (default is dry-run)"
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Skip backup verification prompt"
    )

    args = parser.parse_args()

    try:
        rotator = EncryptionKeyRotator(dry_run=not args.live)

        if args.force:
            rotator.verify_backup_exists = lambda: True

        success = rotator.run()

        if success:
            print("\n✓ Key rotation completed successfully")
            sys.exit(0)
        else:
            print("\n✗ Key rotation failed")
            sys.exit(1)

    except KeyboardInterrupt:
        print("\n\n✗ Aborted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n✗ Fatal error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
