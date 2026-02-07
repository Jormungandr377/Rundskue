"""Session management router - view active sessions, logout all devices."""
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from pydantic import BaseModel

from ..database import get_db
from ..models import RefreshToken, User
from ..dependencies import get_current_active_user
from ..services import audit

router = APIRouter(tags=["Sessions"])


# ============================================================================
# Schemas
# ============================================================================

class SessionResponse(BaseModel):
    id: int
    user_agent: Optional[str]
    ip_address: Optional[str]
    created_at: datetime
    expires_at: datetime
    is_current: bool = False

    class Config:
        from_attributes = True


# ============================================================================
# Endpoints
# ============================================================================

@router.get("/", response_model=List[SessionResponse])
async def list_sessions(
    request: Request,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """List all active sessions (refresh tokens) for the current user."""
    current_refresh_token = request.cookies.get("refresh_token")

    sessions = db.query(RefreshToken).filter(
        RefreshToken.user_id == current_user.id,
        RefreshToken.is_revoked == False,
        RefreshToken.expires_at > datetime.utcnow()
    ).order_by(RefreshToken.created_at.desc()).all()

    result = []
    for session in sessions:
        result.append(SessionResponse(
            id=session.id,
            user_agent=session.user_agent,
            ip_address=session.ip_address,
            created_at=session.created_at,
            expires_at=session.expires_at,
            is_current=(session.token == current_refresh_token) if current_refresh_token else False,
        ))
    return result


@router.delete("/{session_id}")
async def revoke_session(
    session_id: int,
    request: Request,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Revoke a specific session."""
    session = db.query(RefreshToken).filter(
        RefreshToken.id == session_id,
        RefreshToken.user_id == current_user.id,
        RefreshToken.is_revoked == False,
    ).first()

    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    session.is_revoked = True
    db.commit()

    audit.log_from_request(
        db, request, audit.SESSION_REVOKED,
        user_id=current_user.id,
        resource_type="session", resource_id=str(session_id),
    )
    return {"message": "Session revoked"}


@router.delete("/")
async def revoke_all_other_sessions(
    request: Request,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Revoke all sessions except the current one."""
    current_refresh_token = request.cookies.get("refresh_token")

    query = db.query(RefreshToken).filter(
        RefreshToken.user_id == current_user.id,
        RefreshToken.is_revoked == False,
    )

    # Keep current session active
    if current_refresh_token:
        query = query.filter(RefreshToken.token != current_refresh_token)

    count = query.update({"is_revoked": True})
    db.commit()

    audit.log_from_request(
        db, request, audit.SESSION_REVOKED_ALL,
        user_id=current_user.id,
        details={"sessions_revoked": count},
    )
    return {"message": f"Revoked {count} sessions"}
