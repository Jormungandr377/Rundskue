"""SQLAlchemy database models."""
from datetime import datetime, date
from decimal import Decimal
from sqlalchemy import (
    Column, Integer, String, DateTime, Date, Numeric, Boolean, 
    ForeignKey, Text, JSON, Enum as SQLEnum, Index
)
from sqlalchemy.orm import relationship
from app.database import Base
import enum


class AccountType(enum.Enum):
    CHECKING = "checking"
    SAVINGS = "savings"
    CREDIT = "credit"
    INVESTMENT = "investment"
    LOAN = "loan"
    MORTGAGE = "mortgage"
    OTHER = "other"


class Profile(Base):
    """Household member profile."""
    __tablename__ = "profiles"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    email = Column(String(255), unique=True, nullable=True)
    is_primary = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Military-specific fields for TSP
    service_start_date = Column(Date, nullable=True)
    base_pay = Column(Numeric(12, 2), nullable=True)
    tsp_contribution_pct = Column(Numeric(5, 2), default=5.0)  # % of base pay
    tsp_roth_pct = Column(Numeric(5, 2), default=0.0)  # % that is Roth
    
    # Relationships
    plaid_items = relationship("PlaidItem", back_populates="profile", cascade="all, delete-orphan")
    accounts = relationship("Account", back_populates="profile", cascade="all, delete-orphan")
    budgets = relationship("Budget", back_populates="profile", cascade="all, delete-orphan")
    tsp_scenarios = relationship("TSPScenario", back_populates="profile", cascade="all, delete-orphan")


class PlaidItem(Base):
    """Plaid Item (represents a bank login)."""
    __tablename__ = "plaid_items"
    
    id = Column(Integer, primary_key=True, index=True)
    profile_id = Column(Integer, ForeignKey("profiles.id"), nullable=False)
    
    # Plaid identifiers (encrypted)
    item_id = Column(String(255), unique=True, nullable=False)
    access_token_encrypted = Column(Text, nullable=False)
    
    # Institution info
    institution_id = Column(String(50), nullable=True)
    institution_name = Column(String(255), nullable=True)
    
    # Status
    is_active = Column(Boolean, default=True)
    last_sync = Column(DateTime, nullable=True)
    error_code = Column(String(50), nullable=True)
    error_message = Column(Text, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    profile = relationship("Profile", back_populates="plaid_items")
    accounts = relationship("Account", back_populates="plaid_item", cascade="all, delete-orphan")


class Account(Base):
    """Bank account linked via Plaid."""
    __tablename__ = "accounts"
    
    id = Column(Integer, primary_key=True, index=True)
    profile_id = Column(Integer, ForeignKey("profiles.id"), nullable=False)
    plaid_item_id = Column(Integer, ForeignKey("plaid_items.id"), nullable=False)
    
    # Plaid identifiers
    plaid_account_id = Column(String(255), unique=True, nullable=False)
    
    # Account info
    name = Column(String(255), nullable=False)
    official_name = Column(String(255), nullable=True)
    account_type = Column(SQLEnum(AccountType), nullable=False)
    subtype = Column(String(50), nullable=True)
    mask = Column(String(4), nullable=True)  # Last 4 digits
    
    # Balances
    balance_current = Column(Numeric(14, 2), default=0)
    balance_available = Column(Numeric(14, 2), nullable=True)
    balance_limit = Column(Numeric(14, 2), nullable=True)  # For credit cards
    
    # Display settings
    is_hidden = Column(Boolean, default=False)
    display_name = Column(String(255), nullable=True)  # Custom name override
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    profile = relationship("Profile", back_populates="accounts")
    plaid_item = relationship("PlaidItem", back_populates="accounts")
    transactions = relationship("Transaction", back_populates="account", cascade="all, delete-orphan")
    
    # Indexes
    __table_args__ = (
        Index("ix_accounts_profile_type", "profile_id", "account_type"),
    )


class Category(Base):
    """Transaction category."""
    __tablename__ = "categories"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    parent_id = Column(Integer, ForeignKey("categories.id"), nullable=True)
    icon = Column(String(50), nullable=True)
    color = Column(String(7), nullable=True)  # Hex color
    is_income = Column(Boolean, default=False)
    is_system = Column(Boolean, default=True)  # False for user-created
    
    # Relationships
    parent = relationship("Category", remote_side=[id], backref="children")
    transactions = relationship("Transaction", back_populates="category")
    budget_items = relationship("BudgetItem", back_populates="category")


class Transaction(Base):
    """Financial transaction from Plaid."""
    __tablename__ = "transactions"
    
    id = Column(Integer, primary_key=True, index=True)
    account_id = Column(Integer, ForeignKey("accounts.id"), nullable=False)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=True)
    
    # Plaid identifiers
    plaid_transaction_id = Column(String(255), unique=True, nullable=False)
    
    # Transaction details
    amount = Column(Numeric(14, 2), nullable=False)  # Positive = expense, Negative = income
    date = Column(Date, nullable=False)
    name = Column(String(255), nullable=False)  # Plaid merchant name
    merchant_name = Column(String(255), nullable=True)  # Clean merchant name
    
    # Plaid categorization
    plaid_category = Column(JSON, nullable=True)  # Plaid's category array
    plaid_category_id = Column(String(50), nullable=True)
    
    # User modifications
    custom_name = Column(String(255), nullable=True)  # User override
    notes = Column(Text, nullable=True)
    is_excluded = Column(Boolean, default=False)  # Exclude from reports
    is_transfer = Column(Boolean, default=False)  # Internal transfer
    
    # Status
    pending = Column(Boolean, default=False)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    account = relationship("Account", back_populates="transactions")
    category = relationship("Category", back_populates="transactions")
    
    # Indexes for common queries
    __table_args__ = (
        Index("ix_transactions_date", "date"),
        Index("ix_transactions_account_date", "account_id", "date"),
        Index("ix_transactions_category_date", "category_id", "date"),
    )


class Budget(Base):
    """Monthly budget for a profile."""
    __tablename__ = "budgets"
    
    id = Column(Integer, primary_key=True, index=True)
    profile_id = Column(Integer, ForeignKey("profiles.id"), nullable=False)
    
    name = Column(String(100), nullable=False)
    month = Column(Date, nullable=False)  # First day of month
    is_template = Column(Boolean, default=False)  # Use as template for new months
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    profile = relationship("Profile", back_populates="budgets")
    items = relationship("BudgetItem", back_populates="budget", cascade="all, delete-orphan")
    
    __table_args__ = (
        Index("ix_budgets_profile_month", "profile_id", "month"),
    )


class BudgetItem(Base):
    """Individual budget line item."""
    __tablename__ = "budget_items"
    
    id = Column(Integer, primary_key=True, index=True)
    budget_id = Column(Integer, ForeignKey("budgets.id"), nullable=False)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=False)
    
    amount = Column(Numeric(12, 2), nullable=False)  # Budgeted amount
    
    # Relationships
    budget = relationship("Budget", back_populates="items")
    category = relationship("Category", back_populates="budget_items")


class NetWorthSnapshot(Base):
    """Historical net worth tracking."""
    __tablename__ = "net_worth_snapshots"
    
    id = Column(Integer, primary_key=True, index=True)
    profile_id = Column(Integer, ForeignKey("profiles.id"), nullable=True)  # Null = household total
    
    date = Column(Date, nullable=False)
    
    # Asset totals
    total_cash = Column(Numeric(14, 2), default=0)
    total_investments = Column(Numeric(14, 2), default=0)
    total_assets = Column(Numeric(14, 2), default=0)
    
    # Liability totals
    total_credit = Column(Numeric(14, 2), default=0)
    total_loans = Column(Numeric(14, 2), default=0)
    total_liabilities = Column(Numeric(14, 2), default=0)
    
    # Net worth
    net_worth = Column(Numeric(14, 2), default=0)
    
    # Breakdown by account (JSON for flexibility)
    account_breakdown = Column(JSON, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    
    __table_args__ = (
        Index("ix_net_worth_profile_date", "profile_id", "date"),
    )


class TSPScenario(Base):
    """TSP retirement projection scenario."""
    __tablename__ = "tsp_scenarios"
    
    id = Column(Integer, primary_key=True, index=True)
    profile_id = Column(Integer, ForeignKey("profiles.id"), nullable=False)
    
    name = Column(String(100), nullable=False)
    is_active = Column(Boolean, default=True)  # Current scenario vs saved comparison
    
    # Current TSP state
    current_balance = Column(Numeric(14, 2), default=0)
    current_balance_date = Column(Date, nullable=True)
    
    # Contribution settings
    contribution_pct = Column(Numeric(5, 2), default=5.0)
    base_pay = Column(Numeric(12, 2), nullable=True)
    annual_pay_increase_pct = Column(Numeric(5, 2), default=2.0)
    
    # Fund allocation (should sum to 100)
    allocation_g = Column(Numeric(5, 2), default=0)
    allocation_f = Column(Numeric(5, 2), default=0)
    allocation_c = Column(Numeric(5, 2), default=60)
    allocation_s = Column(Numeric(5, 2), default=30)
    allocation_i = Column(Numeric(5, 2), default=10)
    allocation_l = Column(Numeric(5, 2), default=0)
    l_fund_year = Column(Integer, nullable=True)  # e.g., 2050 for L2050
    
    # Growth assumptions
    use_historical_returns = Column(Boolean, default=True)
    custom_annual_return_pct = Column(Numeric(5, 2), nullable=True)  # If not using historical
    
    # Retirement settings
    retirement_age = Column(Integer, default=60)
    birth_year = Column(Integer, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    profile = relationship("Profile", back_populates="tsp_scenarios")


class TSPFundHistory(Base):
    """Historical TSP fund prices."""
    __tablename__ = "tsp_fund_history"
    
    id = Column(Integer, primary_key=True, index=True)
    date = Column(Date, nullable=False)
    fund = Column(String(10), nullable=False)  # G, F, C, S, I, L2025, L2030, etc.
    price = Column(Numeric(12, 6), nullable=False)
    
    __table_args__ = (
        Index("ix_tsp_fund_date", "fund", "date", unique=True),
    )
