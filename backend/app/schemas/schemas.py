"""Pydantic schemas for API request/response validation."""
from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from pydantic import BaseModel, Field


# ============ Profile Schemas ============

class ProfileBase(BaseModel):
    name: str
    email: Optional[str] = None
    service_start_date: Optional[date] = None
    base_pay: Optional[Decimal] = None
    tsp_contribution_pct: Decimal = Field(default=Decimal("5.0"))
    tsp_roth_pct: Decimal = Field(default=Decimal("0.0"))


class ProfileCreate(ProfileBase):
    is_primary: bool = False


class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    service_start_date: Optional[date] = None
    base_pay: Optional[Decimal] = None
    tsp_contribution_pct: Optional[Decimal] = None
    tsp_roth_pct: Optional[Decimal] = None


class ProfileResponse(ProfileBase):
    id: int
    is_primary: bool
    created_at: datetime
    
    class Config:
        from_attributes = True


# ============ Account Schemas ============

class AccountBase(BaseModel):
    name: str
    account_type: str
    balance_current: Decimal = Field(default=Decimal("0"))


class AccountResponse(AccountBase):
    id: int
    profile_id: int
    plaid_account_id: str
    official_name: Optional[str] = None
    subtype: Optional[str] = None
    mask: Optional[str] = None
    balance_available: Optional[Decimal] = None
    balance_limit: Optional[Decimal] = None
    is_hidden: bool
    display_name: Optional[str] = None
    institution_name: Optional[str] = None
    updated_at: datetime
    
    class Config:
        from_attributes = True


class AccountUpdate(BaseModel):
    is_hidden: Optional[bool] = None
    display_name: Optional[str] = None


# ============ Transaction Schemas ============

class TransactionBase(BaseModel):
    amount: Decimal
    date: date
    name: str
    merchant_name: Optional[str] = None


class TransactionResponse(TransactionBase):
    id: int
    account_id: int
    category_id: Optional[int] = None
    category_name: Optional[str] = None
    custom_name: Optional[str] = None
    notes: Optional[str] = None
    is_excluded: bool
    is_transfer: bool
    pending: bool
    account_name: str
    
    class Config:
        from_attributes = True


class TransactionUpdate(BaseModel):
    category_id: Optional[int] = None
    custom_name: Optional[str] = None
    notes: Optional[str] = None
    is_excluded: Optional[bool] = None
    is_transfer: Optional[bool] = None


class TransactionSearch(BaseModel):
    profile_id: Optional[int] = None
    account_ids: Optional[list[int]] = None
    category_ids: Optional[list[int]] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    min_amount: Optional[Decimal] = None
    max_amount: Optional[Decimal] = None
    search_text: Optional[str] = None
    include_excluded: bool = False
    include_transfers: bool = True
    page: int = 1
    page_size: int = 50


# ============ Category Schemas ============

class CategoryBase(BaseModel):
    name: str
    icon: Optional[str] = None
    color: Optional[str] = None
    is_income: bool = False


class CategoryCreate(CategoryBase):
    parent_id: Optional[int] = None


class CategoryResponse(CategoryBase):
    id: int
    parent_id: Optional[int] = None
    is_system: bool
    children: list["CategoryResponse"] = []
    
    class Config:
        from_attributes = True


# ============ Budget Schemas ============

class BudgetItemBase(BaseModel):
    category_id: int
    amount: Decimal


class BudgetItemResponse(BudgetItemBase):
    id: int
    category_name: str
    spent: Decimal = Field(default=Decimal("0"))
    remaining: Decimal = Field(default=Decimal("0"))
    
    class Config:
        from_attributes = True


class BudgetBase(BaseModel):
    name: str
    month: date


class BudgetCreate(BudgetBase):
    profile_id: int
    items: list[BudgetItemBase] = []


class BudgetResponse(BudgetBase):
    id: int
    profile_id: int
    is_template: bool
    items: list[BudgetItemResponse] = []
    total_budgeted: Decimal = Field(default=Decimal("0"))
    total_spent: Decimal = Field(default=Decimal("0"))
    
    class Config:
        from_attributes = True


# ============ Analytics Schemas ============

class SpendingByCategory(BaseModel):
    category_id: int
    category_name: str
    category_color: str
    amount: Decimal
    percentage: Decimal
    transaction_count: int


class CashFlowSummary(BaseModel):
    period: str  # e.g., "2024-01" for monthly
    income: Decimal
    expenses: Decimal
    net: Decimal


class NetWorthSummary(BaseModel):
    date: date
    total_assets: Decimal
    total_liabilities: Decimal
    net_worth: Decimal
    breakdown: dict


class AnalyticsResponse(BaseModel):
    spending_by_category: list[SpendingByCategory]
    cash_flow: list[CashFlowSummary]
    top_merchants: list[dict]
    period_comparison: Optional[dict] = None


# ============ Plaid Schemas ============

class PlaidLinkRequest(BaseModel):
    profile_id: int


class PlaidLinkResponse(BaseModel):
    link_token: str
    expiration: str


class PlaidExchangeRequest(BaseModel):
    profile_id: int
    public_token: str
    institution_id: Optional[str] = None
    institution_name: Optional[str] = None


class PlaidItemResponse(BaseModel):
    id: int
    profile_id: int
    institution_name: Optional[str] = None
    is_active: bool
    last_sync: Optional[datetime] = None
    error_code: Optional[str] = None
    error_message: Optional[str] = None
    accounts: list[AccountResponse] = []
    
    class Config:
        from_attributes = True


# ============ TSP Schemas ============

class TSPAllocation(BaseModel):
    g: Decimal = Field(default=Decimal("0"), ge=0, le=100)
    f: Decimal = Field(default=Decimal("0"), ge=0, le=100)
    c: Decimal = Field(default=Decimal("60"), ge=0, le=100)
    s: Decimal = Field(default=Decimal("30"), ge=0, le=100)
    i: Decimal = Field(default=Decimal("10"), ge=0, le=100)
    l: Decimal = Field(default=Decimal("0"), ge=0, le=100)
    l_fund_year: Optional[int] = None


class TSPScenarioCreate(BaseModel):
    profile_id: int
    name: str
    current_balance: Decimal = Field(default=Decimal("0"))
    current_balance_date: Optional[date] = None
    contribution_pct: Decimal = Field(default=Decimal("5.0"))
    base_pay: Optional[Decimal] = None
    annual_pay_increase_pct: Decimal = Field(default=Decimal("2.0"))
    allocation: TSPAllocation = TSPAllocation()
    use_historical_returns: bool = True
    custom_annual_return_pct: Optional[Decimal] = None
    retirement_age: int = 60
    birth_year: Optional[int] = None


class TSPScenarioResponse(BaseModel):
    id: int
    profile_id: int
    name: str
    is_active: bool
    current_balance: Decimal
    current_balance_date: Optional[date] = None
    contribution_pct: Decimal
    base_pay: Optional[Decimal] = None
    annual_pay_increase_pct: Decimal
    allocation_g: Decimal
    allocation_f: Decimal
    allocation_c: Decimal
    allocation_s: Decimal
    allocation_i: Decimal
    allocation_l: Decimal
    l_fund_year: Optional[int] = None
    use_historical_returns: bool
    custom_annual_return_pct: Optional[Decimal] = None
    retirement_age: int
    birth_year: Optional[int] = None
    created_at: datetime
    
    class Config:
        from_attributes = True


class TSPProjectionYear(BaseModel):
    year: int
    age: int
    contribution: Decimal
    employer_match: Decimal
    growth: Decimal
    balance: Decimal


class TSPProjectionResponse(BaseModel):
    scenario_id: int
    scenario_name: str
    projections: list[TSPProjectionYear]
    final_balance: Decimal
    total_contributions: Decimal
    total_employer_match: Decimal
    total_growth: Decimal
    average_annual_return: Decimal


class TSPFundHistoryResponse(BaseModel):
    fund: str
    history: list[dict]  # [{date: str, price: Decimal}, ...]
    average_annual_return: Decimal
    total_return: Decimal


# Forward reference resolution
CategoryResponse.model_rebuild()
