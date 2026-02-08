"""Application configuration using Pydantic Settings."""
import logging
from pydantic_settings import BaseSettings
from cryptography.fernet import Fernet
from functools import lru_cache
from typing import Optional

logger = logging.getLogger(__name__)

# Placeholder sentinel – never a valid key
_INSECURE_SECRET_KEY = "change-this-in-production-use-a-real-secret-key"
_INSECURE_DB_URL = "postgresql://finance_user:finance_password@localhost:5432/finance_tracker"


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Application
    app_name: str = "Finance Tracker"
    debug: bool = False
    secret_key: str = _INSECURE_SECRET_KEY

    # Database
    database_url: str = _INSECURE_DB_URL
    
    # Plaid API
    plaid_client_id: str = ""
    plaid_secret: str = ""
    plaid_env: str = "sandbox"  # sandbox, development, or production
    plaid_products: str = "transactions"
    plaid_country_codes: str = "US"
    plaid_redirect_uri: Optional[str] = None
    plaid_webhook_url: Optional[str] = None

    # Security  (ENCRYPTION_KEY must be set in env – the app warns loudly if not)
    encryption_key: str = ""
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 7
    refresh_token_remember_me_days: int = 30

    # Password Policy
    password_min_length: int = 8
    password_require_uppercase: bool = True
    password_require_number: bool = True
    password_require_special: bool = True

    # Registration
    registration_enabled: bool = True  # Set to False to prevent new signups

    # 2FA
    totp_issuer: str = "Finance Tracker"

    # Email (SMTP)
    smtp_host: str = "smtp.gmail.com"
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = "noreply@financetracker.com"

    # Frontend URL (for CORS)
    frontend_url: str = "http://localhost:3000"
    
    # Sync settings
    sync_hour: int = 3  # Hour to run daily sync (3 AM)
    sync_minute: int = 0  # Minute to run daily sync (on the hour)

    # Error monitoring
    sentry_dsn: str = ""  # Set in env to enable Sentry

    # Database connection pooling
    db_pool_size: int = 5
    db_max_overflow: int = 10

    # Scheduled jobs timing
    scheduled_reports_hour: int = 6  # Hour to send scheduled reports (6 AM)
    scheduled_reports_minute: int = 0

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance with startup security checks."""
    s = Settings()

    # ── Security gate: hard-fail if critical secrets are missing/insecure ──
    if s.secret_key == _INSECURE_SECRET_KEY:
        if s.debug:
            logger.warning(
                "⚠️  SECRET_KEY is the insecure default! Set a strong random key "
                "via the SECRET_KEY environment variable before deploying to production."
            )
        else:
            raise RuntimeError(
                "SECRET_KEY is still the insecure default. "
                "Generate a strong key: python -c \"import secrets; print(secrets.token_hex(32))\" "
                "and set it as the SECRET_KEY environment variable."
            )

    if not s.encryption_key:
        if s.debug:
            # Auto-generate for dev convenience but warn
            s.encryption_key = Fernet.generate_key().decode()
            logger.warning(
                "⚠️  ENCRYPTION_KEY is not set – using a one-time generated key. "
                "Data encrypted with this key will be LOST on restart. "
                "Set ENCRYPTION_KEY in your environment for persistence."
            )
        else:
            raise RuntimeError(
                "ENCRYPTION_KEY is not set. Generate one: "
                "python -c \"from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())\" "
                "and set it as the ENCRYPTION_KEY environment variable."
            )

    if s.database_url == _INSECURE_DB_URL and not s.debug:
        raise RuntimeError(
            "DATABASE_URL is still the insecure default. "
            "Set a proper DATABASE_URL environment variable."
        )

    return s
