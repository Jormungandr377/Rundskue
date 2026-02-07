"""Admin router - user management, audit logs, access reviews."""
from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from pydantic import BaseModel

from ..database import get_db
from ..models import User, AuditLog, RefreshToken, PlaidItem, Notification
from ..dependencies import get_current_admin_user
from ..services import audit

router = APIRouter(tags=["Admin"])


# ============================================================================
# Schemas
# ============================================================================

class AdminUserResponse(BaseModel):
    id: int
    email: str
    role: str
    is_active: bool
    totp_enabled: bool
    created_at: datetime
    last_login: Optional[datetime] = None
    active_sessions: int = 0
    linked_items: int = 0

    class Config:
        from_attributes = True


class RoleUpdate(BaseModel):
    role: str


class AuditLogResponse(BaseModel):
    id: int
    timestamp: datetime
    user_id: Optional[int]
    action: str
    resource_type: Optional[str]
    resource_id: Optional[str]
    details: Optional[dict]
    ip_address: Optional[str]
    user_agent: Optional[str]
    status: str

    class Config:
        from_attributes = True


class AccessReviewReport(BaseModel):
    generated_at: datetime
    total_users: int
    active_users: int
    admin_users: int
    users_with_2fa: int
    users: List[AdminUserResponse]


class ReviewComplete(BaseModel):
    notes: str


# ============================================================================
# User Management
# ============================================================================

@router.get("/users", response_model=List[AdminUserResponse])
async def list_users(
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    """List all users with security metadata."""
    users = db.query(User).all()
    result = []
    for user in users:
        # Get last login from audit logs
        last_login_entry = db.query(AuditLog).filter(
            AuditLog.user_id == user.id,
            AuditLog.action == audit.LOGIN,
            AuditLog.status == "success",
        ).order_by(desc(AuditLog.timestamp)).first()

        # Count active sessions
        active_sessions = db.query(RefreshToken).filter(
            RefreshToken.user_id == user.id,
            RefreshToken.is_revoked == False,
            RefreshToken.expires_at > datetime.utcnow(),
        ).count()

        # Count linked Plaid items
        profile_ids = [p.id for p in user.profiles]
        linked_items = 0
        if profile_ids:
            linked_items = db.query(PlaidItem).filter(
                PlaidItem.profile_id.in_(profile_ids),
                PlaidItem.is_active == True,
            ).count()

        result.append(AdminUserResponse(
            id=user.id,
            email=user.email,
            role=user.role,
            is_active=user.is_active,
            totp_enabled=user.totp_enabled,
            created_at=user.created_at,
            last_login=last_login_entry.timestamp if last_login_entry else None,
            active_sessions=active_sessions,
            linked_items=linked_items,
        ))
    return result


@router.put("/users/{user_id}/role")
async def change_user_role(
    user_id: int,
    body: RoleUpdate,
    request: Request,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    """Change a user's role."""
    if body.role not in ("admin", "user"):
        raise HTTPException(status_code=400, detail="Role must be 'admin' or 'user'")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    old_role = user.role
    user.role = body.role
    db.commit()

    audit.log_from_request(
        db, request, audit.ROLE_CHANGED,
        user_id=current_user.id,
        resource_type="user",
        resource_id=str(user_id),
        details={"target_user": user.email, "old_role": old_role, "new_role": body.role},
    )
    return {"message": f"User {user.email} role changed from {old_role} to {body.role}"}


@router.put("/users/{user_id}/deactivate")
async def deactivate_user(
    user_id: int,
    request: Request,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    """Deactivate a user: sets is_active=False and revokes all sessions."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot deactivate your own account")

    user.is_active = False

    # Revoke all refresh tokens
    revoked = db.query(RefreshToken).filter(
        RefreshToken.user_id == user_id,
        RefreshToken.is_revoked == False,
    ).update({"is_revoked": True})

    db.commit()

    audit.log_from_request(
        db, request, audit.USER_DEACTIVATED,
        user_id=current_user.id,
        resource_type="user",
        resource_id=str(user_id),
        details={"target_user": user.email, "sessions_revoked": revoked},
    )
    return {"message": f"User {user.email} deactivated, {revoked} sessions revoked"}


@router.put("/users/{user_id}/reactivate")
async def reactivate_user(
    user_id: int,
    request: Request,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    """Reactivate a deactivated user."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.is_active = True
    db.commit()

    audit.log_from_request(
        db, request, audit.USER_REACTIVATED,
        user_id=current_user.id,
        resource_type="user",
        resource_id=str(user_id),
        details={"target_user": user.email},
    )
    return {"message": f"User {user.email} reactivated"}


# ============================================================================
# Audit Logs
# ============================================================================

@router.get("/audit-logs", response_model=List[AuditLogResponse])
async def get_audit_logs(
    action: Optional[str] = None,
    user_id: Optional[int] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    status: Optional[str] = None,
    limit: int = Query(default=100, le=500),
    offset: int = Query(default=0, ge=0),
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    """Query audit log entries with optional filters."""
    query = db.query(AuditLog)

    if action:
        query = query.filter(AuditLog.action == action)
    if user_id:
        query = query.filter(AuditLog.user_id == user_id)
    if start_date:
        query = query.filter(AuditLog.timestamp >= start_date)
    if end_date:
        query = query.filter(AuditLog.timestamp <= end_date)
    if status:
        query = query.filter(AuditLog.status == status)

    return query.order_by(desc(AuditLog.timestamp)).offset(offset).limit(limit).all()


# ============================================================================
# Access Review
# ============================================================================

@router.get("/access-review", response_model=AccessReviewReport)
async def generate_access_review(
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    """Generate an access review report."""
    users = db.query(User).all()
    user_responses = []

    for user in users:
        last_login_entry = db.query(AuditLog).filter(
            AuditLog.user_id == user.id,
            AuditLog.action == audit.LOGIN,
            AuditLog.status == "success",
        ).order_by(desc(AuditLog.timestamp)).first()

        active_sessions = db.query(RefreshToken).filter(
            RefreshToken.user_id == user.id,
            RefreshToken.is_revoked == False,
            RefreshToken.expires_at > datetime.utcnow(),
        ).count()

        profile_ids = [p.id for p in user.profiles]
        linked_items = 0
        if profile_ids:
            linked_items = db.query(PlaidItem).filter(
                PlaidItem.profile_id.in_(profile_ids),
                PlaidItem.is_active == True,
            ).count()

        user_responses.append(AdminUserResponse(
            id=user.id,
            email=user.email,
            role=user.role,
            is_active=user.is_active,
            totp_enabled=user.totp_enabled,
            created_at=user.created_at,
            last_login=last_login_entry.timestamp if last_login_entry else None,
            active_sessions=active_sessions,
            linked_items=linked_items,
        ))

    return AccessReviewReport(
        generated_at=datetime.utcnow(),
        total_users=len(users),
        active_users=sum(1 for u in users if u.is_active),
        admin_users=sum(1 for u in users if u.role == "admin"),
        users_with_2fa=sum(1 for u in users if u.totp_enabled),
        users=user_responses,
    )


@router.post("/access-review/complete")
async def complete_access_review(
    body: ReviewComplete,
    request: Request,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    """Record that an access review was completed."""
    audit.log_from_request(
        db, request, audit.ACCESS_REVIEW,
        user_id=current_user.id,
        details={"notes": body.notes, "reviewer": current_user.email},
        status="completed",
    )
    return {"message": "Access review recorded"}
