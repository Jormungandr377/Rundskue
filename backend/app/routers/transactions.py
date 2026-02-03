"""Transactions API router - query and manage transactions."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, and_, or_
from pydantic import BaseModel
from typing import List, Optional
from datetime import date, datetime, timedelta

from app.database import get_db
from app.models import Transaction, Account, Category

router = APIRouter()


class TransactionResponse(BaseModel):
    id: int
    account_id: int
    account_name: str
    category_id: Optional[int]
    category_name: Optional[str]
    amount: float
    date: date
    name: str
    merchant_name: Optional[str]
    custom_name: Optional[str]
    notes: Optional[str]
    is_excluded: bool
    is_transfer: bool
    pending: bool
    
    class Config:
        from_attributes = True

class TransactionUpdate(BaseModel):
    category_id: Optional[int] = None
    custom_name: Optional[str] = None
    notes: Optional[str] = None
    is_excluded: Optional[bool] = None
    is_transfer: Optional[bool] = None

class TransactionListResponse(BaseModel):
    transactions: List[TransactionResponse]
    total: int
    page: int
    page_size: int
    total_pages: int

class CategorySplit(BaseModel):
    category_id: int
    amount: float


@router.get("/", response_model=TransactionListResponse)
def get_transactions(
    profile_id: Optional[int] = None,
    account_id: Optional[int] = None,
    category_id: Optional[int] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    search: Optional[str] = None,
    min_amount: Optional[float] = None,
    max_amount: Optional[float] = None,
    include_excluded: bool = False,
    include_transfers: bool = True,
    pending_only: bool = False,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=500),
    db: Session = Depends(get_db)
):
    """
    Get transactions with filtering and pagination.
    Amounts: positive = expense, negative = income.
    """
    query = db.query(Transaction).options(
        joinedload(Transaction.account),
        joinedload(Transaction.category)
    )
    
    # Apply filters
    if profile_id:
        query = query.join(Account).filter(Account.profile_id == profile_id)
    
    if account_id:
        query = query.filter(Transaction.account_id == account_id)
    
    if category_id:
        query = query.filter(Transaction.category_id == category_id)
    
    if start_date:
        query = query.filter(Transaction.date >= start_date)
    
    if end_date:
        query = query.filter(Transaction.date <= end_date)
    
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            or_(
                Transaction.name.ilike(search_term),
                Transaction.merchant_name.ilike(search_term),
                Transaction.custom_name.ilike(search_term),
                Transaction.notes.ilike(search_term)
            )
        )
    
    if min_amount is not None:
        query = query.filter(Transaction.amount >= min_amount)
    
    if max_amount is not None:
        query = query.filter(Transaction.amount <= max_amount)
    
    if not include_excluded:
        query = query.filter(Transaction.is_excluded == False)
    
    if not include_transfers:
        query = query.filter(Transaction.is_transfer == False)
    
    if pending_only:
        query = query.filter(Transaction.pending == True)
    
    # Get total count
    total = query.count()
    
    # Apply pagination and ordering
    query = query.order_by(Transaction.date.desc(), Transaction.id.desc())
    query = query.offset((page - 1) * page_size).limit(page_size)
    
    transactions = query.all()
    
    result = []
    for t in transactions:
        result.append(TransactionResponse(
            id=t.id,
            account_id=t.account_id,
            account_name=t.account.display_name or t.account.name,
            category_id=t.category_id,
            category_name=t.category.name if t.category else None,
            amount=float(t.amount),
            date=t.date,
            name=t.custom_name or t.merchant_name or t.name,
            merchant_name=t.merchant_name,
            custom_name=t.custom_name,
            notes=t.notes,
            is_excluded=t.is_excluded,
            is_transfer=t.is_transfer,
            pending=t.pending
        ))
    
    return TransactionListResponse(
        transactions=result,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=(total + page_size - 1) // page_size
    )


@router.get("/{transaction_id}", response_model=TransactionResponse)
def get_transaction(transaction_id: int, db: Session = Depends(get_db)):
    """Get a specific transaction."""
    t = db.query(Transaction).options(
        joinedload(Transaction.account),
        joinedload(Transaction.category)
    ).filter(Transaction.id == transaction_id).first()
    
    if not t:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    return TransactionResponse(
        id=t.id,
        account_id=t.account_id,
        account_name=t.account.display_name or t.account.name,
        category_id=t.category_id,
        category_name=t.category.name if t.category else None,
        amount=float(t.amount),
        date=t.date,
        name=t.custom_name or t.merchant_name or t.name,
        merchant_name=t.merchant_name,
        custom_name=t.custom_name,
        notes=t.notes,
        is_excluded=t.is_excluded,
        is_transfer=t.is_transfer,
        pending=t.pending
    )


@router.put("/{transaction_id}", response_model=TransactionResponse)
def update_transaction(
    transaction_id: int,
    update: TransactionUpdate,
    db: Session = Depends(get_db)
):
    """Update transaction (category, name, notes, excluded/transfer flags)."""
    t = db.query(Transaction).filter(Transaction.id == transaction_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    if update.category_id is not None:
        # Verify category exists
        if update.category_id > 0:
            cat = db.query(Category).filter(Category.id == update.category_id).first()
            if not cat:
                raise HTTPException(status_code=400, detail="Category not found")
        t.category_id = update.category_id if update.category_id > 0 else None
    
    if update.custom_name is not None:
        t.custom_name = update.custom_name if update.custom_name else None
    
    if update.notes is not None:
        t.notes = update.notes if update.notes else None
    
    if update.is_excluded is not None:
        t.is_excluded = update.is_excluded
    
    if update.is_transfer is not None:
        t.is_transfer = update.is_transfer
    
    db.commit()
    
    return get_transaction(transaction_id, db)


@router.post("/bulk-categorize")
def bulk_categorize(
    transaction_ids: List[int],
    category_id: int,
    db: Session = Depends(get_db)
):
    """Bulk update category for multiple transactions."""
    # Verify category exists
    if category_id > 0:
        cat = db.query(Category).filter(Category.id == category_id).first()
        if not cat:
            raise HTTPException(status_code=400, detail="Category not found")
    
    updated = db.query(Transaction).filter(
        Transaction.id.in_(transaction_ids)
    ).update(
        {Transaction.category_id: category_id if category_id > 0 else None},
        synchronize_session=False
    )
    
    db.commit()
    
    return {"updated": updated}


@router.get("/search/merchants")
def search_merchants(
    q: str = Query(..., min_length=1),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db)
):
    """Search for unique merchant names for autocomplete."""
    merchants = db.query(Transaction.merchant_name).filter(
        Transaction.merchant_name.ilike(f"%{q}%"),
        Transaction.merchant_name.isnot(None)
    ).distinct().limit(limit).all()
    
    return [m[0] for m in merchants if m[0]]
