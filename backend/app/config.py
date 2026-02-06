"""Application configuration using Pydantic Settings."""
from pydantic_settings import BaseSettings
from cryptography.fernet import Fernet
from functools import lru_cache
from typing import Optional

# Generate a default Fernet key for development
_default_fernet_key = Fernet.generate_key().decode()


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    
    # Application
    app_name: str = "Finance Tracker"
    debug: bool = False
    secret_key: str = "change-this-in-production-use-a-real-secret-key"
    
    # Database
    database_url: str = "postgresql://finance_user:finance_password@localhost:5432/finance_tracker"
    
    # Plaid API
    plaid_client_id: str = ""
    plaid_secret: str = ""
    plaid_env: str = "sandbox"  # sandbox, development, or production
    plaid_products: str = "transactions"
    plaid_country_codes: str = "US"
    plaid_redirect_uri: Optional[str] = None
    plaid_webhook_url: Optional[str] = None

    # Security
    encryption_key: str = _default_fernet_key
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 7
    refresh_token_remember_me_days: int = 30

    # Password Policy
    password_min_length: int = 8
    password_require_uppercase: bool = True
    password_require_number: bool = True
    password_require_special: bool = True

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
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
