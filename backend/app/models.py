"""SQLAlchemy database models."""
from datetime import datetime, date
from decimal import Decimal
from sqlalchemy import (
    Column, Integer, String, DateTime, Date, Numeric, Boolean, 
    ForeignKey, Text, JSON, Enum as SQLEnum, Index
)
from sqlalchemy.orm import relationship
from .database import Base
import enum


class AccountType(enum.Enum):
    CHECKING = "checking"
    SAVINGS = "savings"
    CREDIT = "credit"
    INVESTMENT = "investment"
    LOAN = "loan"
    MORTGAGE = "mortgage"
    OTHER = "other"


class User(Base):
    """User account for authentication."""
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Preferences
    theme = Column(String(10), default="light")  # light, dark, system

    # Role
    role = Column(String(20), default="user", nullable=False)  # "admin" or "user"

    # 2FA fields
    totp_secret = Column(String(255), nullable=True)
    totp_enabled = Column(Boolean, default=False)
    backup_codes = Column(Text, nullable=True)  # JSON array of hashed codes

    # Relationships
    profiles = relationship("Profile", back_populates="user", cascade="all, delete-orphan")
    refresh_tokens = relationship("RefreshToken", back_populates="user", cascade="all, delete-orphan")
    password_reset_tokens = relationship("PasswordResetToken", back_populates="user", cascade="all, delete-orphan")
    email_verification_tokens = relationship("EmailVerificationToken", back_populates="user", cascade="all, delete-orphan")


class RefreshToken(Base):
    """Refresh tokens for session management."""
    __tablename__ = "refresh_tokens"

    id = Column(Integer, primary_key=True, index=True)
    token = Column(String(255), unique=True, index=True, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    expires_at = Column(DateTime, nullable=False)
    is_revoked = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    user_agent = Column(String(255), nullable=True)
    ip_address = Column(String(50), nullable=True)

    # Relationships
    user = relationship("User", back_populates="refresh_tokens")


class PasswordResetToken(Base):
    """Password reset tokens."""
    __tablename__ = "password_reset_tokens"

    id = Column(Integer, primary_key=True, index=True)
    token = Column(String(255), unique=True, index=True, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    expires_at = Column(DateTime, nullable=False)
    is_used = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="password_reset_tokens")


class EmailVerificationToken(Base):
    """Email verification tokens for new user signup."""
    __tablename__ = "email_verification_tokens"

    id = Column(Integer, primary_key=True, index=True)
    token = Column(String(255), unique=True, index=True, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    expires_at = Column(DateTime, nullable=False)
    is_used = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="email_verification_tokens")


class Profile(Base):
    """Household member profile."""
    __tablename__ = "profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)  # Indexed for user lookup
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
    user = relationship("User", back_populates="profiles")
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
    profile_id = Column(Integer, ForeignKey("profiles.id"), nullable=False, index=True)
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

    # Envelope budgeting
    envelope_id = Column(Integer, ForeignKey("envelopes.id"), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    account = relationship("Account", back_populates="transactions")
    category = relationship("Category", back_populates="transactions")
    envelope = relationship("Envelope", back_populates="transactions")
    
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
    rollover_amount = Column(Numeric(12, 2), default=0)  # Carried over from previous month

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


class RecurringTransaction(Base):
    """Recurring bills and subscriptions."""
    __tablename__ = "recurring_transactions"

    id = Column(Integer, primary_key=True, index=True)
    profile_id = Column(Integer, ForeignKey("profiles.id"), nullable=False, index=True)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=True)

    name = Column(String(255), nullable=False)
    amount = Column(Numeric(14, 2), nullable=False)
    frequency = Column(String(20), nullable=False)  # monthly, weekly, biweekly, quarterly, yearly
    day_of_month = Column(Integer, nullable=True)  # 1-31 for monthly
    day_of_week = Column(Integer, nullable=True)  # 0-6 for weekly (Mon=0)

    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=True)  # Null = ongoing
    next_due_date = Column(Date, nullable=False)

    is_income = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    auto_categorize = Column(Boolean, default=True)  # Auto-assign category to matching transactions

    notes = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    profile = relationship("Profile")
    category = relationship("Category")

    __table_args__ = (
        Index("ix_recurring_profile_active", "profile_id", "is_active"),
        Index("ix_recurring_next_due", "next_due_date"),
    )


class SavingsGoal(Base):
    """Savings goal tracking."""
    __tablename__ = "savings_goals"

    id = Column(Integer, primary_key=True, index=True)
    profile_id = Column(Integer, ForeignKey("profiles.id"), nullable=False, index=True)

    name = Column(String(255), nullable=False)
    target_amount = Column(Numeric(14, 2), nullable=False)
    current_amount = Column(Numeric(14, 2), default=0)
    deadline = Column(Date, nullable=True)
    color = Column(String(7), default="#3b82f6")  # Hex color for UI
    icon = Column(String(50), default="piggy-bank")

    # Phase 3: Emergency fund & sinking funds
    is_emergency_fund = Column(Boolean, default=False)
    fund_type = Column(String(20), default="general")  # general, sinking_fund, emergency
    target_date = Column(Date, nullable=True)  # For sinking funds
    monthly_contribution = Column(Numeric(14, 2), nullable=True)  # Auto-calculated

    is_completed = Column(Boolean, default=False)
    completed_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    profile = relationship("Profile")

    __table_args__ = (
        Index("ix_savings_goals_profile", "profile_id", "is_completed"),
    )


class CategoryRule(Base):
    """Auto-categorization rules for transactions."""
    __tablename__ = "category_rules"

    id = Column(Integer, primary_key=True, index=True)
    profile_id = Column(Integer, ForeignKey("profiles.id"), nullable=False, index=True)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=False)

    match_field = Column(String(20), nullable=False, default="name")  # name, merchant_name
    match_type = Column(String(20), nullable=False, default="contains")  # contains, exact, starts_with
    match_value = Column(String(255), nullable=False)

    is_active = Column(Boolean, default=True)
    priority = Column(Integer, default=0)  # Higher = checked first

    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    profile = relationship("Profile")
    category = relationship("Category")

    __table_args__ = (
        Index("ix_category_rules_profile_active", "profile_id", "is_active"),
    )


class Notification(Base):
    """User notifications for budget alerts, bill reminders, etc."""
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    type = Column(String(50), nullable=False)  # budget_alert, bill_reminder, goal_reached
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    data = Column(JSON, nullable=True)  # Extra context (budget_id, goal_id, etc.)

    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    user = relationship("User")

    __table_args__ = (
        Index("ix_notifications_user_read", "user_id", "is_read"),
    )


class AuditLog(Base):
    """Immutable audit trail for security-relevant actions."""
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    action = Column(String(100), nullable=False)
    resource_type = Column(String(50), nullable=True)
    resource_id = Column(String(50), nullable=True)
    details = Column(JSON, nullable=True)
    ip_address = Column(String(50), nullable=True)
    user_agent = Column(String(500), nullable=True)
    status = Column(String(20), default="success", nullable=False)

    __table_args__ = (
        Index("ix_audit_logs_timestamp", "timestamp"),
        Index("ix_audit_logs_user_action", "user_id", "action"),
        Index("ix_audit_logs_action", "action"),
    )


# ============================================================================
# Phase 1: Budget Enhancements
# ============================================================================

class Envelope(Base):
    """Virtual envelope for zero-based budgeting."""
    __tablename__ = "envelopes"

    id = Column(Integer, primary_key=True, index=True)
    profile_id = Column(Integer, ForeignKey("profiles.id"), nullable=False, index=True)
    name = Column(String(100), nullable=False)
    allocated_amount = Column(Numeric(14, 2), default=0)
    color = Column(String(7), default="#3b82f6")
    icon = Column(String(50), default="wallet")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    profile = relationship("Profile")
    transactions = relationship("Transaction", back_populates="envelope")

    __table_args__ = (
        Index("ix_envelopes_profile_active", "profile_id", "is_active"),
    )


class BudgetAlert(Base):
    """Configurable spending alert thresholds per budget item."""
    __tablename__ = "budget_alerts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    budget_item_id = Column(Integer, ForeignKey("budget_items.id"), nullable=False)
    threshold_pct = Column(Integer, nullable=False, default=80)
    is_enabled = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User")
    budget_item = relationship("BudgetItem")


class Subscription(Base):
    """Detected or manually added subscription/recurring charge."""
    __tablename__ = "subscriptions"

    id = Column(Integer, primary_key=True, index=True)
    profile_id = Column(Integer, ForeignKey("profiles.id"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    merchant_name = Column(String(255), nullable=True)
    amount = Column(Numeric(14, 2), nullable=False)
    frequency = Column(String(20), default="monthly")
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=True)
    last_charged = Column(Date, nullable=True)
    next_expected = Column(Date, nullable=True)
    is_active = Column(Boolean, default=True)
    is_flagged_unused = Column(Boolean, default=False)
    detected_at = Column(DateTime, default=datetime.utcnow)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    profile = relationship("Profile")
    category = relationship("Category")

    __table_args__ = (
        Index("ix_subscriptions_profile_active", "profile_id", "is_active"),
    )


# ============================================================================
# Phase 2: Cash Flow & Income
# ============================================================================

class PaycheckRule(Base):
    """Rule for automatically splitting paycheck income into envelopes/goals."""
    __tablename__ = "paycheck_rules"

    id = Column(Integer, primary_key=True, index=True)
    profile_id = Column(Integer, ForeignKey("profiles.id"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    match_merchant = Column(String(255), nullable=False)
    match_amount_min = Column(Numeric(14, 2), nullable=True)
    match_amount_max = Column(Numeric(14, 2), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    profile = relationship("Profile")
    allocations = relationship("PaycheckAllocation", back_populates="rule", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_paycheck_rules_profile_active", "profile_id", "is_active"),
    )


class PaycheckAllocation(Base):
    """Individual allocation within a paycheck splitting rule."""
    __tablename__ = "paycheck_allocations"

    id = Column(Integer, primary_key=True, index=True)
    rule_id = Column(Integer, ForeignKey("paycheck_rules.id"), nullable=False, index=True)
    target_type = Column(String(20), nullable=False)  # envelope, goal, category
    target_id = Column(Integer, nullable=False)
    amount_type = Column(String(20), nullable=False)  # fixed, percentage
    amount = Column(Numeric(14, 2), nullable=False)
    priority = Column(Integer, default=0)

    rule = relationship("PaycheckRule", back_populates="allocations")


# ============================================================================
# Phase 3: Savings & Goals Enhancements
# ============================================================================

class SavingsRule(Base):
    """Automated savings rules (round-up, percentage, fixed schedule)."""
    __tablename__ = "savings_rules"

    id = Column(Integer, primary_key=True, index=True)
    profile_id = Column(Integer, ForeignKey("profiles.id"), nullable=False, index=True)
    goal_id = Column(Integer, ForeignKey("savings_goals.id"), nullable=False)
    rule_type = Column(String(20), nullable=False)  # round_up, percentage, fixed_schedule
    round_up_to = Column(Integer, nullable=True)  # 1, 5, or 10
    percentage = Column(Numeric(5, 2), nullable=True)  # % of transaction
    fixed_amount = Column(Numeric(14, 2), nullable=True)
    frequency = Column(String(20), nullable=True)  # weekly, monthly (for fixed_schedule)
    is_active = Column(Boolean, default=True)
    total_saved = Column(Numeric(14, 2), default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    profile = relationship("Profile")
    goal = relationship("SavingsGoal")

    __table_args__ = (
        Index("ix_savings_rules_profile_active", "profile_id", "is_active"),
    )
