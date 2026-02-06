"""Security utilities for authentication and authorization."""
from datetime import datetime, timedelta
from typing import Optional, Tuple
import secrets
import base64
import io
import json

from passlib.context import CryptContext
from jose import jwt, JWTError
import pyotp
import qrcode

from ..config import get_settings

settings = get_settings()

# Password hashing context
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


# ============================================================================
# Password Functions
# ============================================================================

def hash_password(password: str) -> str:
    """
    Hash a password using bcrypt.

    Args:
        password: Plain text password

    Returns:
        Hashed password
    """
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verify a password against its hash.

    Args:
        plain_password: Plain text password to verify
        hashed_password: Hashed password to check against

    Returns:
        True if password matches, False otherwise
    """
    return pwd_context.verify(plain_password, hashed_password)


def validate_password(password: str) -> Tuple[bool, str]:
    """
    Validate password against policy requirements.

    Args:
        password: Password to validate

    Returns:
        Tuple of (is_valid, error_message)
    """
    if len(password) < settings.password_min_length:
        return False, f"Password must be at least {settings.password_min_length} characters"

    if settings.password_require_uppercase and not any(c.isupper() for c in password):
        return False, "Password must contain at least one uppercase letter"

    if settings.password_require_number and not any(c.isdigit() for c in password):
        return False, "Password must contain at least one number"

    if settings.password_require_special:
        special_chars = "!@#$%^&*()_+-=[]{}|;:,.<>?"
        if not any(c in special_chars for c in password):
            return False, "Password must contain at least one special character"

    return True, ""


# ============================================================================
# JWT Token Functions
# ============================================================================

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """
    Create a JWT access token.

    Args:
        data: Data to encode in the token (typically {"sub": user_id})
        expires_delta: Optional custom expiration time

    Returns:
        Encoded JWT token
    """
    to_encode = data.copy()

    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.access_token_expire_minutes)

    to_encode.update({
        "exp": expire,
        "type": "access"
    })

    encoded_jwt = jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)
    return encoded_jwt


def decode_token(token: str) -> dict:
    """
    Decode and validate a JWT token.

    Args:
        token: JWT token to decode

    Returns:
        Decoded token payload

    Raises:
        JWTError: If token is invalid or expired
    """
    payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
    return payload


def create_refresh_token() -> str:
    """
    Create a secure random refresh token.

    Returns:
        Random URL-safe token string
    """
    return secrets.token_urlsafe(32)


# ============================================================================
# TOTP (Two-Factor Authentication) Functions
# ============================================================================

def generate_totp_secret() -> str:
    """
    Generate a random TOTP secret for 2FA.

    Returns:
        Base32-encoded TOTP secret
    """
    return pyotp.random_base32()


def get_totp_uri(secret: str, email: str) -> str:
    """
    Get a provisioning URI for Google Authenticator.

    Args:
        secret: TOTP secret
        email: User's email address

    Returns:
        Provisioning URI for QR code generation
    """
    totp = pyotp.TOTP(secret)
    return totp.provisioning_uri(
        name=email,
        issuer_name=settings.totp_issuer
    )


def generate_qr_code(uri: str) -> str:
    """
    Generate a QR code image from a URI.

    Args:
        uri: Provisioning URI from get_totp_uri()

    Returns:
        Base64-encoded PNG image of QR code
    """
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_L,
        box_size=10,
        border=4,
    )
    qr.add_data(uri)
    qr.make(fit=True)

    img = qr.make_image(fill_color="black", back_color="white")

    # Convert to base64
    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    img_base64 = base64.b64encode(buffer.getvalue()).decode()

    return img_base64


def verify_totp(secret: str, code: str) -> bool:
    """
    Verify a TOTP code against a secret.

    Args:
        secret: TOTP secret
        code: 6-digit TOTP code from authenticator app

    Returns:
        True if code is valid, False otherwise
    """
    totp = pyotp.TOTP(secret)
    # valid_window=1 allows codes from 30 seconds before/after current time
    return totp.verify(code, valid_window=1)


def generate_backup_codes(count: int = 10) -> list[str]:
    """
    Generate backup codes for account recovery.

    Args:
        count: Number of backup codes to generate

    Returns:
        List of backup codes
    """
    return [secrets.token_hex(4) for _ in range(count)]


# ============================================================================
# Password Reset Token Functions
# ============================================================================

def generate_reset_token() -> str:
    """
    Generate a secure random password reset token.

    Returns:
        Random URL-safe token string
    """
    return secrets.token_urlsafe(32)
