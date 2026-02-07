"""Authentication routes for user registration, login, 2FA, and password reset."""
from datetime import datetime, timedelta
from typing import Optional
import json

from fastapi import APIRouter, Depends, HTTPException, status, Response, Request
from sqlalchemy.orm import Session
from slowapi import Limiter
from slowapi.util import get_remote_address

from ..database import get_db
from ..models import User, RefreshToken, PasswordResetToken, Profile
from ..schemas.auth import (
    UserRegister, UserLogin, Token, UserResponse, TwoFactorSetup,
    TwoFactorSetupResponse, TwoFactorVerify, TwoFactorDisable,
    ForgotPassword, ResetPassword, PasswordResetResponse, MessageResponse,
    ChangePassword
)
from ..core.security import (
    hash_password, verify_password, create_access_token, create_refresh_token,
    validate_password, generate_totp_secret, get_totp_uri, generate_qr_code,
    verify_totp, generate_backup_codes, generate_reset_token
)
from ..dependencies import get_current_active_user
from ..services.email import send_password_reset_email, send_welcome_email
from ..config import get_settings

settings = get_settings()
router = APIRouter(prefix="/auth", tags=["Authentication"])
limiter = Limiter(key_func=get_remote_address)


# ============================================================================
# Registration & Login
# ============================================================================

@router.post("/register", response_model=Token, status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minute")
async def register(
    request: Request,
    user_data: UserRegister,
    response: Response,
    db: Session = Depends(get_db)
):
    """
    Register a new user account.

    Creates a new user with email/password and a default profile.
    Returns JWT access token and sets refresh token cookie.
    """
    # Validate password
    is_valid, error_msg = validate_password(user_data.password)
    if not is_valid:
        raise HTTPException(status_code=400, detail=error_msg)

    # Check if user already exists
    existing_user = db.query(User).filter(User.email == user_data.email).first()
    if existing_user:
        raise HTTPException(
            status_code=400,
            detail="Email already registered"
        )

    # Create user
    user = User(
        email=user_data.email,
        hashed_password=hash_password(user_data.password),
        is_active=True
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # Create default profile
    profile = Profile(
        user_id=user.id,
        name="Primary Profile",
        is_primary=True
    )
    db.add(profile)
    db.commit()

    # Generate tokens
    access_token = create_access_token({"sub": str(user.id)})
    refresh_token = create_refresh_token()

    # Store refresh token
    expires_days = (
        settings.refresh_token_remember_me_days if user_data.remember_me
        else settings.refresh_token_expire_days
    )
    refresh_token_obj = RefreshToken(
        token=refresh_token,
        user_id=user.id,
        expires_at=datetime.utcnow() + timedelta(days=expires_days)
    )
    db.add(refresh_token_obj)
    db.commit()

    # Set refresh token cookie
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=False,  # Set to True in production with HTTPS
        samesite="lax",
        max_age=expires_days * 24 * 60 * 60
    )

    # Send welcome email (don't wait for it)
    try:
        await send_welcome_email(user.email)
    except Exception:
        pass  # Don't fail registration if email fails

    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/login", response_model=Token)
@limiter.limit("10/minute")
async def login(
    user_data: UserLogin,
    response: Response,
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Login with email and password.

    Supports 2FA if enabled. Returns JWT access token and sets refresh token cookie.
    """
    # Verify user credentials
    user = db.query(User).filter(User.email == user_data.email).first()
    if not user or not verify_password(user_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is inactive"
        )

    # Check 2FA if enabled
    if user.totp_enabled:
        if not user_data.totp_code:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="2FA code required",
                headers={"X-Require-2FA": "true"}
            )

        # Verify TOTP code
        if not verify_totp(user.totp_secret, user_data.totp_code):
            # Check backup codes
            if user.backup_codes:
                backup_codes = json.loads(user.backup_codes)
                code_valid = False

                for i, hashed_code in enumerate(backup_codes):
                    if verify_password(user_data.totp_code, hashed_code):
                        # Remove used backup code
                        backup_codes.pop(i)
                        user.backup_codes = json.dumps(backup_codes)
                        db.commit()
                        code_valid = True
                        break

                if not code_valid:
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="Invalid 2FA code"
                    )
            else:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid 2FA code"
                )

    # Generate tokens
    access_token = create_access_token({"sub": str(user.id)})
    refresh_token = create_refresh_token()

    # Store refresh token
    expires_days = (
        settings.refresh_token_remember_me_days if user_data.remember_me
        else settings.refresh_token_expire_days
    )
    refresh_token_obj = RefreshToken(
        token=refresh_token,
        user_id=user.id,
        expires_at=datetime.utcnow() + timedelta(days=expires_days),
        user_agent=request.headers.get("user-agent"),
        ip_address=request.client.host if request.client else None
    )
    db.add(refresh_token_obj)
    db.commit()

    # Set refresh token cookie
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=False,  # Set to True in production with HTTPS
        samesite="lax",
        max_age=expires_days * 24 * 60 * 60
    )

    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/refresh", response_model=Token)
async def refresh_token(
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Refresh access token using refresh token from cookie.

    Returns new JWT access token.
    """
    refresh_token = request.cookies.get("refresh_token")
    if not refresh_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token not found"
        )

    # Validate refresh token
    token_obj = db.query(RefreshToken).filter(
        RefreshToken.token == refresh_token,
        RefreshToken.is_revoked == False,
        RefreshToken.expires_at > datetime.utcnow()
    ).first()

    if not token_obj:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token"
        )

    # Verify user is still active
    user = db.query(User).filter(User.id == token_obj.user_id).first()
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive"
        )

    # Generate new access token
    access_token = create_access_token({"sub": str(token_obj.user_id)})

    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/logout", response_model=MessageResponse)
async def logout(
    request: Request,
    response: Response,
    db: Session = Depends(get_db)
):
    """
    Logout user by revoking refresh token.

    Clears refresh token cookie.
    """
    refresh_token = request.cookies.get("refresh_token")
    if refresh_token:
        # Revoke refresh token
        token_obj = db.query(RefreshToken).filter(
            RefreshToken.token == refresh_token
        ).first()
        if token_obj:
            token_obj.is_revoked = True
            db.commit()

    # Clear cookie
    response.delete_cookie(key="refresh_token")

    return {"message": "Logged out successfully"}


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(
    current_user: User = Depends(get_current_active_user)
):
    """Get current authenticated user's information."""
    return current_user


@router.post("/change-password", response_model=MessageResponse)
async def change_password(
    password_data: ChangePassword,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Change password for authenticated user.

    Requires current password verification and validates new password.
    Revokes all refresh tokens to force re-login on other devices.
    """
    # Verify current password
    if not verify_password(password_data.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    # Validate new password
    is_valid, error_msg = validate_password(password_data.new_password)
    if not is_valid:
        raise HTTPException(status_code=400, detail=error_msg)

    # Don't allow same password
    if verify_password(password_data.new_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="New password must be different from current password")

    # Update password
    current_user.hashed_password = hash_password(password_data.new_password)
    db.commit()

    # Revoke all refresh tokens (force re-login on all devices)
    db.query(RefreshToken).filter(
        RefreshToken.user_id == current_user.id,
        RefreshToken.is_revoked == False
    ).update({"is_revoked": True})
    db.commit()

    return {"message": "Password changed successfully"}


# ============================================================================
# Two-Factor Authentication (2FA)
# ============================================================================

@router.post("/2fa/setup", response_model=TwoFactorSetupResponse)
async def setup_2fa(
    setup_data: TwoFactorSetup,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Initialize 2FA setup for user.

    Generates TOTP secret, QR code, and backup codes.
    2FA is not enabled until verified.
    """
    # Verify password
    if not verify_password(setup_data.password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect password")

    # Generate TOTP secret
    secret = generate_totp_secret()
    uri = get_totp_uri(secret, current_user.email)
    qr_code = generate_qr_code(uri)

    # Generate backup codes
    backup_codes = generate_backup_codes()
    hashed_backup_codes = [hash_password(code) for code in backup_codes]

    # Save to user (not enabled yet - requires verification)
    current_user.totp_secret = secret
    current_user.backup_codes = json.dumps(hashed_backup_codes)
    db.commit()

    return {
        "secret": secret,
        "qr_code": qr_code,
        "backup_codes": backup_codes
    }


@router.post("/2fa/verify", response_model=MessageResponse)
async def verify_2fa(
    verify_data: TwoFactorVerify,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Verify TOTP code and enable 2FA.

    User must scan QR code and enter valid code to enable 2FA.
    """
    if not current_user.totp_secret:
        raise HTTPException(status_code=400, detail="2FA not set up")

    # Verify TOTP code
    if not verify_totp(current_user.totp_secret, verify_data.totp_code):
        raise HTTPException(status_code=400, detail="Invalid 2FA code")

    # Enable 2FA
    current_user.totp_enabled = True
    db.commit()

    return {"message": "2FA enabled successfully"}


@router.post("/2fa/disable", response_model=MessageResponse)
async def disable_2fa(
    disable_data: TwoFactorDisable,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Disable 2FA for user account.

    Requires password and TOTP code verification.
    """
    # Verify password
    if not verify_password(disable_data.password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect password")

    # If 2FA is enabled, require TOTP code
    if current_user.totp_enabled:
        if not disable_data.totp_code:
            raise HTTPException(status_code=400, detail="2FA code required")
        if not verify_totp(current_user.totp_secret, disable_data.totp_code):
            raise HTTPException(status_code=400, detail="Invalid 2FA code")

    # Disable 2FA
    current_user.totp_enabled = False
    current_user.totp_secret = None
    current_user.backup_codes = None
    db.commit()

    return {"message": "2FA disabled successfully"}


# ============================================================================
# Password Reset
# ============================================================================

@router.post("/forgot-password", response_model=PasswordResetResponse)
@limiter.limit("3/minute")
async def forgot_password(
    request: Request,
    forgot_data: ForgotPassword,
    db: Session = Depends(get_db)
):
    """
    Request password reset email.

    Always returns success to prevent email enumeration.
    """
    user = db.query(User).filter(User.email == forgot_data.email).first()

    if user and user.is_active:
        # Generate reset token
        reset_token = generate_reset_token()

        # Store token with 1-hour expiration
        token_obj = PasswordResetToken(
            token=reset_token,
            user_id=user.id,
            expires_at=datetime.utcnow() + timedelta(hours=1)
        )
        db.add(token_obj)
        db.commit()

        # Send reset email (don't wait for it)
        try:
            await send_password_reset_email(user.email, reset_token)
        except Exception:
            pass  # Don't reveal if email failed

    # Always return success (don't reveal if email exists)
    return PasswordResetResponse()


@router.post("/reset-password", response_model=MessageResponse)
async def reset_password(
    reset_data: ResetPassword,
    db: Session = Depends(get_db)
):
    """
    Reset password using reset token.

    Validates token and updates password.
    """
    # Validate reset token
    token_obj = db.query(PasswordResetToken).filter(
        PasswordResetToken.token == reset_data.token,
        PasswordResetToken.is_used == False,
        PasswordResetToken.expires_at > datetime.utcnow()
    ).first()

    if not token_obj:
        raise HTTPException(
            status_code=400,
            detail="Invalid or expired reset token"
        )

    # Validate new password
    is_valid, error_msg = validate_password(reset_data.new_password)
    if not is_valid:
        raise HTTPException(status_code=400, detail=error_msg)

    # Get user
    user = db.query(User).filter(User.id == token_obj.user_id).first()
    if not user:
        raise HTTPException(status_code=400, detail="User not found")

    # Update password
    user.hashed_password = hash_password(reset_data.new_password)
    token_obj.is_used = True
    db.commit()

    # Revoke all refresh tokens (force re-login on all devices)
    db.query(RefreshToken).filter(
        RefreshToken.user_id == user.id,
        RefreshToken.is_revoked == False
    ).update({"is_revoked": True})
    db.commit()

    return {"message": "Password reset successfully"}
