"""Audit logging service for security-relevant events."""
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy.orm import Session
from fastapi import Request

from ..models import AuditLog

# Action constants
LOGIN = "login"
LOGIN_FAILED = "login_failed"
LOGOUT = "logout"
REGISTER = "register"
PASSWORD_CHANGE = "password_change"
PASSWORD_RESET = "password_reset"
TWO_FA_ENABLED = "2fa_enabled"
TWO_FA_DISABLED = "2fa_disabled"
SESSION_REVOKED = "session_revoked"
SESSION_REVOKED_ALL = "session_revoked_all"
PLAID_LINK = "plaid_link"
PLAID_UNLINK = "plaid_unlink"
PLAID_SYNC = "plaid_sync"
USER_DEACTIVATED = "user_deactivated"
USER_REACTIVATED = "user_reactivated"
ROLE_CHANGED = "role_changed"
ACCESS_REVIEW = "access_review"
DATA_EXPORT = "data_export"
EMAIL_VERIFIED = "email_verified"
VERIFICATION_RESENT = "verification_resent"
RESOURCE_DELETED = "resource_deleted"


def log_audit_event(
    db: Session,
    action: str,
    user_id: Optional[int] = None,
    resource_type: Optional[str] = None,
    resource_id: Optional[str] = None,
    details: Optional[dict] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
    status: str = "success",
):
    """Write an immutable audit log entry."""
    entry = AuditLog(
        timestamp=datetime.now(timezone.utc),
        user_id=user_id,
        action=action,
        resource_type=resource_type,
        resource_id=str(resource_id) if resource_id else None,
        details=details,
        ip_address=ip_address,
        user_agent=user_agent,
        status=status,
    )
    db.add(entry)
    db.commit()


def log_from_request(
    db: Session,
    request: Request,
    action: str,
    user_id: Optional[int] = None,
    **kwargs,
):
    """Convenience wrapper that extracts IP/user-agent from the request."""
    log_audit_event(
        db=db,
        action=action,
        user_id=user_id,
        ip_address=request.client.host if request.client else None,
        user_agent=(request.headers.get("user-agent") or "")[:500],
        **kwargs,
    )
