"""Plaid API router - handle account linking and syncing."""
import logging

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks

logger = logging.getLogger(__name__)
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

from ..database import get_db
from ..models import PlaidItem, Account, Profile, User
from ..dependencies import get_current_active_user
from ..services import audit
from ..services.plaid_service import (
    create_link_token,
    exchange_public_token,
    sync_transactions
)

router = APIRouter()


# Pydantic schemas
class LinkTokenRequest(BaseModel):
    profile_id: int

class LinkTokenResponse(BaseModel):
    link_token: str
    expiration: str

class PublicTokenExchange(BaseModel):
    public_token: str
    profile_id: int
    institution_id: Optional[str] = None
    institution_name: Optional[str] = None

class PlaidItemResponse(BaseModel):
    id: int
    profile_id: int
    institution_name: Optional[str]
    is_active: bool
    last_sync: Optional[datetime]
    error_message: Optional[str]
    accounts_count: int
    
    class Config:
        from_attributes = True

class SyncResponse(BaseModel):
    items_synced: int
    transactions_added: int
    transactions_modified: int
    transactions_removed: int
    errors: List[str]


@router.post("/link-token", response_model=LinkTokenResponse)
def get_link_token(
    request: LinkTokenRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Create a Plaid Link token for connecting a new bank account.
    The frontend uses this token to initialize Plaid Link.
    """
    # Verify profile belongs to user
    profile_ids = [p.id for p in current_user.profiles]
    if request.profile_id not in profile_ids:
        raise HTTPException(status_code=403, detail="Access denied to this profile")

    profile = db.query(Profile).filter(Profile.id == request.profile_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    
    try:
        result = create_link_token(profile.id)
        return LinkTokenResponse(
            link_token=result["link_token"],
            expiration=result["expiration"]
        )
    except Exception as e:
        logger.exception(f"Failed to create link token for profile {request.profile_id}")
        raise HTTPException(status_code=500, detail="Failed to create link token")


@router.post("/exchange-token")
def exchange_token(
    request: PublicTokenExchange,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Exchange public token for access token after user completes Plaid Link.
    This creates the PlaidItem and associated accounts.
    """
    # Verify profile belongs to user
    profile_ids = [p.id for p in current_user.profiles]
    if request.profile_id not in profile_ids:
        raise HTTPException(status_code=403, detail="Access denied to this profile")

    profile = db.query(Profile).filter(Profile.id == request.profile_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    try:
        # Use the service function which properly encrypts the token
        plaid_item = exchange_public_token(
            db=db,
            profile_id=request.profile_id,
            public_token=request.public_token,
            institution_id=request.institution_id,
            institution_name=request.institution_name
        )

        # Audit log
        audit.log_audit_event(
            db, audit.PLAID_LINK, user_id=current_user.id,
            resource_type="plaid_item", resource_id=str(plaid_item.id),
            details={"institution": request.institution_name, "accounts": len(plaid_item.accounts)},
        )

        return {
            "status": "success",
            "item_id": plaid_item.id,
            "accounts_linked": len(plaid_item.accounts)
        }

    except Exception as e:
        db.rollback()
        logger.exception(f"Failed to exchange token for profile {request.profile_id}")
        raise HTTPException(status_code=500, detail="Failed to exchange token")


@router.get("/items", response_model=List[PlaidItemResponse])
def list_items(
    profile_id: Optional[int] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """List all Plaid items (bank connections) for current user."""
    profile_ids = [p.id for p in current_user.profiles]

    query = db.query(PlaidItem).filter(PlaidItem.profile_id.in_(profile_ids))
    if profile_id:
        if profile_id not in profile_ids:
            raise HTTPException(status_code=403, detail="Access denied to this profile")
        query = query.filter(PlaidItem.profile_id == profile_id)

    items = query.all()
    
    result = []
    for item in items:
        result.append(PlaidItemResponse(
            id=item.id,
            profile_id=item.profile_id,
            institution_name=item.institution_name,
            is_active=item.is_active,
            last_sync=item.last_sync,
            error_message=item.error_message,
            accounts_count=len(item.accounts)
        ))
    
    return result


@router.post("/sync", response_model=SyncResponse)
async def trigger_sync(
    background_tasks: BackgroundTasks,
    item_id: Optional[int] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Trigger a transaction sync for one or all of user's Plaid items.
    If item_id is provided, sync only that item.
    Otherwise, sync all active items for the user.
    """
    profile_ids = [p.id for p in current_user.profiles]

    if item_id:
        item = db.query(PlaidItem).filter(
            PlaidItem.id == item_id,
            PlaidItem.profile_id.in_(profile_ids)
        ).first()
        if not item:
            raise HTTPException(status_code=404, detail="Plaid item not found")
        items = [item]
    else:
        items = db.query(PlaidItem).filter(
            PlaidItem.is_active == True,
            PlaidItem.profile_id.in_(profile_ids)
        ).all()
    
    total_added = 0
    total_modified = 0
    total_removed = 0
    errors = []
    
    for item in items:
        try:
            result = sync_transactions(db, item)
            total_added += result.get("added", 0)
            total_modified += result.get("modified", 0)
            total_removed += result.get("removed", 0)
        except Exception as e:
            logger.exception(f"Sync failed for item {item.id} ({item.institution_name})")
            errors.append(f"Sync failed for item {item.id}")
    
    return SyncResponse(
        items_synced=len(items),
        transactions_added=total_added,
        transactions_modified=total_modified,
        transactions_removed=total_removed,
        errors=errors
    )


@router.delete("/items/{item_id}")
def delete_item(
    item_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Remove a Plaid item (bank connection)."""
    profile_ids = [p.id for p in current_user.profiles]

    item = db.query(PlaidItem).filter(
        PlaidItem.id == item_id,
        PlaidItem.profile_id.in_(profile_ids)
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Plaid item not found")
    
    institution_name = item.institution_name

    # This will cascade delete accounts and transactions
    db.delete(item)
    db.commit()

    # Audit log
    audit.log_audit_event(
        db, audit.PLAID_UNLINK, user_id=current_user.id,
        resource_type="plaid_item", resource_id=str(item_id),
        details={"institution": institution_name},
    )

    return {"status": "deleted", "item_id": item_id}


@router.post("/items/{item_id}/update-link")
def update_link(
    item_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Get a link token for updating/fixing a bank connection.
    Used when credentials need to be refreshed.
    """
    profile_ids = [p.id for p in current_user.profiles]

    item = db.query(PlaidItem).filter(
        PlaidItem.id == item_id,
        PlaidItem.profile_id.in_(profile_ids)
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Plaid item not found")
    
    try:
        result = create_link_token(
            item.profile_id,
            access_token=item.access_token_encrypted  # For update mode
        )
        return {
            "link_token": result["link_token"],
            "expiration": result["expiration"]
        }
    except Exception as e:
        logger.exception(f"Failed to create update link token for item {item_id}")
        raise HTTPException(status_code=500, detail="Failed to create update link token")
