"""Pydantic schemas for authentication."""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, Field, field_validator


# ============================================================================
# Request Schemas
# ============================================================================

class UserRegister(BaseModel):
    """Schema for user registration."""
    email: EmailStr = Field(..., description="User email address")
    password: str = Field(..., min_length=8, description="User password")
    remember_me: bool = Field(default=False, description="Stay logged in for 30 days")


class UserLogin(BaseModel):
    """Schema for user login."""
    email: EmailStr = Field(..., description="User email address")
    password: str = Field(..., description="User password")
    remember_me: bool = Field(default=False, description="Stay logged in for 30 days")
    totp_code: Optional[str] = Field(None, description="2FA code if enabled")


class TokenRefresh(BaseModel):
    """Schema for token refresh (empty - token comes from cookie)."""
    pass


class TwoFactorSetup(BaseModel):
    """Schema for initiating 2FA setup."""
    password: str = Field(..., description="Current password for verification")


class TwoFactorVerify(BaseModel):
    """Schema for verifying and enabling 2FA."""
    totp_code: str = Field(..., min_length=6, max_length=6, description="6-digit TOTP code")

    @field_validator("totp_code")
    @classmethod
    def validate_totp_code(cls, v: str) -> str:
        """Validate TOTP code is numeric."""
        if not v.isdigit():
            raise ValueError("TOTP code must be numeric")
        return v


class TwoFactorDisable(BaseModel):
    """Schema for disabling 2FA."""
    password: str = Field(..., description="Current password for verification")
    totp_code: Optional[str] = Field(None, description="TOTP code if 2FA is currently enabled")


class ForgotPassword(BaseModel):
    """Schema for requesting password reset."""
    email: EmailStr = Field(..., description="User email address")


class ResetPassword(BaseModel):
    """Schema for resetting password with token."""
    token: str = Field(..., description="Password reset token from email")
    new_password: str = Field(..., min_length=8, description="New password")

    @field_validator("new_password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        """Validate password meets requirements (validated in endpoint)."""
        return v


class ChangePassword(BaseModel):
    """Schema for changing password (authenticated user)."""
    current_password: str = Field(..., description="Current password")
    new_password: str = Field(..., min_length=8, description="New password")


class UpdateTheme(BaseModel):
    """Schema for updating theme preference."""
    theme: str = Field(..., description="Theme preference: light, dark, or system")

    @field_validator("theme")
    @classmethod
    def validate_theme(cls, v: str) -> str:
        """Validate theme value."""
        if v not in ("light", "dark", "system"):
            raise ValueError("Theme must be light, dark, or system")
        return v


# ============================================================================
# Response Schemas
# ============================================================================

class Token(BaseModel):
    """Schema for access token response."""
    access_token: str = Field(..., description="JWT access token")
    token_type: str = Field(default="bearer", description="Token type")


class TwoFactorSetupResponse(BaseModel):
    """Schema for 2FA setup response."""
    secret: str = Field(..., description="TOTP secret (for manual entry)")
    qr_code: str = Field(..., description="Base64-encoded QR code image")
    backup_codes: list[str] = Field(..., description="Single-use backup codes")


class UserResponse(BaseModel):
    """Schema for user information response."""
    id: int = Field(..., description="User ID")
    email: str = Field(..., description="User email address")
    is_active: bool = Field(..., description="Whether user account is active")
    role: str = Field(default="user", description="User role (admin or user)")
    totp_enabled: bool = Field(..., description="Whether 2FA is enabled")
    theme: str = Field(default="light", description="UI theme preference (light, dark, system)")
    created_at: datetime = Field(..., description="Account creation timestamp")

    class Config:
        from_attributes = True


class MessageResponse(BaseModel):
    """Generic message response."""
    message: str = Field(..., description="Response message")


class PasswordResetResponse(BaseModel):
    """Response for password reset request."""
    message: str = Field(
        default="If the email exists, you will receive a password reset link",
        description="Generic success message (doesn't reveal if email exists)"
    )
