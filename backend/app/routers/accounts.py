"""Accounts API router - manage linked bank accounts."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from decimal import Decimal

from ..database import get_db
from ..models import Account, AccountType

router = APIRouter()


class AccountResponse(BaseModel):
    id: int
    profile_id: int
    plaid_item_id: int
    name: str
    official_name: Optional[str]
    account_type: str
    subtype: Optional[str]
    mask: Optional[str]
    balance_current: float
    balance_available: Optional[float]
    balance_limit: Optional[float]
    is_hidden: bool
    display_name: Optional[str]
    institution_name: Optional[str] = None
    
    class Config:
        from_attributes = True

class AccountUpdate(BaseModel):
    is_hidden: Optional[bool] = None
    display_name: Optional[str] = None

class AccountsSummary(BaseModel):
    total_assets: float
    total_liabilities: float
    net_worth: float
    accounts_by_type: dict


@router.get("/", response_model=List[AccountResponse])
def get_accounts(
    profile_id: Optional[int] = None,
    include_hidden: bool = False,
    db: Session = Depends(get_db)
):
    """Get all accounts, optionally filtered by profile."""
    query = db.query(Account)
    
    if profile_id:
        query = query.filter(Account.profile_id == profile_id)
    
    if not include_hidden:
        query = query.filter(Account.is_hidden == False)
    
    accounts = query.all()
    
    result = []
    for acc in accounts:
        data = AccountResponse(
            id=acc.id,
            profile_id=acc.profile_id,
            plaid_item_id=acc.plaid_item_id,
            name=acc.display_name or acc.name,
            official_name=acc.official_name,
            account_type=acc.account_type.value if isinstance(acc.account_type, AccountType) else acc.account_type,
            subtype=acc.subtype,
            mask=acc.mask,
            balance_current=float(acc.balance_current or 0),
            balance_available=float(acc.balance_available) if acc.balance_available else None,
            balance_limit=float(acc.balance_limit) if acc.balance_limit else None,
            is_hidden=acc.is_hidden,
            display_name=acc.display_name,
            institution_name=acc.plaid_item.institution_name if acc.plaid_item else None
        )
        result.append(data)
    
    return result


@router.get("/summary", response_model=AccountsSummary)
def get_accounts_summary(profile_id: Optional[int] = None, db: Session = Depends(get_db)):
    """Get aggregated account summary."""
    query = db.query(Account).filter(Account.is_hidden == False)
    
    if profile_id:
        query = query.filter(Account.profile_id == profile_id)
    
    accounts = query.all()
    
    total_assets = 0
    total_liabilities = 0
    by_type = {}
    
    for acc in accounts:
        balance = float(acc.balance_current or 0)
        acc_type = acc.account_type.value if isinstance(acc.account_type, AccountType) else acc.account_type
        
        # Aggregate by type
        if acc_type not in by_type:
            by_type[acc_type] = {"balance": 0, "count": 0}
        by_type[acc_type]["balance"] += balance
        by_type[acc_type]["count"] += 1
        
        # Assets vs liabilities
        if acc_type in ["checking", "savings", "investment"]:
            total_assets += balance
        elif acc_type in ["credit", "loan", "mortgage"]:
            total_liabilities += abs(balance)
    
    return AccountsSummary(
        total_assets=total_assets,
        total_liabilities=total_liabilities,
        net_worth=total_assets - total_liabilities,
        accounts_by_type=by_type
    )


@router.get("/{account_id}", response_model=AccountResponse)
def get_account(account_id: int, db: Session = Depends(get_db)):
    """Get a specific account."""
    account = db.query(Account).filter(Account.id == account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    
    return AccountResponse(
        id=account.id,
        profile_id=account.profile_id,
        plaid_item_id=account.plaid_item_id,
        name=account.display_name or account.name,
        official_name=account.official_name,
        account_type=account.account_type.value if isinstance(account.account_type, AccountType) else account.account_type,
        subtype=account.subtype,
        mask=account.mask,
        balance_current=float(account.balance_current or 0),
        balance_available=float(account.balance_available) if account.balance_available else None,
        balance_limit=float(account.balance_limit) if account.balance_limit else None,
        is_hidden=account.is_hidden,
        display_name=account.display_name,
        institution_name=account.plaid_item.institution_name if account.plaid_item else None
    )


@router.put("/{account_id}", response_model=AccountResponse)
def update_account(account_id: int, update: AccountUpdate, db: Session = Depends(get_db)):
    """Update account settings (hide/show, custom name)."""
    account = db.query(Account).filter(Account.id == account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    
    if update.is_hidden is not None:
        account.is_hidden = update.is_hidden
    if update.display_name is not None:
        account.display_name = update.display_name
    
    db.commit()
    db.refresh(account)
    
    return get_account(account_id, db)
