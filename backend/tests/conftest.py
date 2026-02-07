"""Shared test fixtures for the Finance Tracker backend."""
import os
import sys
import types
import pytest
from datetime import date, datetime
from decimal import Decimal
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

# Use SQLite for tests
TEST_DATABASE_URL = "sqlite://"

# Set env vars before any app code loads
os.environ["DATABASE_URL"] = TEST_DATABASE_URL
os.environ["PLAID_CLIENT_ID"] = "test_client_id"
os.environ["PLAID_SECRET"] = "test_secret"
os.environ["PLAID_ENV"] = "sandbox"

# Create test engine
test_engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

# We need to pre-create the app.database module with our test engine
# so that when other modules import from it, they get the SQLite engine
# instead of trying to create a PostgreSQL engine.
from sqlalchemy.orm import declarative_base as sa_declarative_base

Base = sa_declarative_base()

# Create a fake database module
fake_db_module = types.ModuleType("app.database")
fake_db_module.engine = test_engine
fake_db_module.SessionLocal = TestingSessionLocal
fake_db_module.Base = Base


def _get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


def _init_db():
    Base.metadata.create_all(bind=test_engine)


fake_db_module.get_db = _get_db
fake_db_module.init_db = _init_db

# Also need the app package itself to exist
if "app" not in sys.modules:
    app_pkg = types.ModuleType("app")
    app_pkg.__path__ = [os.path.join(os.path.dirname(os.path.dirname(__file__)), "app")]
    sys.modules["app"] = app_pkg

sys.modules["app.database"] = fake_db_module

# Now we can safely import app models and other code
from app.models import (
    Profile, PlaidItem, Account, AccountType, Category,
    Transaction, Budget, BudgetItem, NetWorthSnapshot,
    TSPScenario, TSPFundHistory, User, Notification,
    SavingsGoal, CategoryRule,
)
from app.core.security import hash_password, create_access_token

from fastapi.testclient import TestClient


@pytest.fixture
def db():
    """Create a fresh database session for each test."""
    Base.metadata.create_all(bind=test_engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=test_engine)


@pytest.fixture
def client(db):
    """FastAPI test client with overridden DB dependency.

    Patches the scheduler to avoid event loop issues in tests.
    """
    from unittest.mock import patch, MagicMock

    # Patch the scheduler and init_db to avoid side effects
    with patch("app.main.scheduler") as mock_scheduler, \
         patch("app.main.init_db"):
        mock_scheduler.running = False
        mock_scheduler.start = MagicMock()
        mock_scheduler.shutdown = MagicMock()
        mock_scheduler.add_job = MagicMock()

        from app.main import app

        def override_get_db():
            try:
                yield db
            finally:
                pass

        app.dependency_overrides[_get_db] = override_get_db
        with TestClient(app) as c:
            yield c
        app.dependency_overrides.clear()


@pytest.fixture
def sample_profile(db):
    """Create a sample profile."""
    profile = Profile(
        name="Test User",
        email="test@example.com",
        is_primary=True,
        base_pay=Decimal("60000"),
        tsp_contribution_pct=Decimal("5.0"),
    )
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return profile


@pytest.fixture
def sample_categories(db):
    """Create sample categories."""
    cats = {}
    for name, is_income, color in [
        ("Groceries", False, "#22c55e"),
        ("Restaurants", False, "#ef4444"),
        ("Streaming", False, "#8b5cf6"),
        ("Salary", True, "#3b82f6"),
        ("Uncategorized", False, "#6b7280"),
        ("Transfer", False, "#9ca3af"),
        ("Fast Food", False, "#f97316"),
        ("Coffee Shops", False, "#92400e"),
        ("Gas/Fuel", False, "#64748b"),
        ("Amazon", False, "#f59e0b"),
        ("Shopping", False, "#ec4899"),
        ("Food", False, "#10b981"),
    ]:
        cat = Category(name=name, is_income=is_income, color=color)
        db.add(cat)
        db.flush()
        cats[name] = cat
    db.commit()
    return cats


@pytest.fixture
def sample_plaid_item(db, sample_profile):
    """Create a sample PlaidItem."""
    from cryptography.fernet import Fernet

    key = Fernet.generate_key()
    fernet = Fernet(key)
    encrypted = fernet.encrypt(b"test-access-token").decode()

    item = PlaidItem(
        profile_id=sample_profile.id,
        item_id="test_item_001",
        access_token_encrypted=encrypted,
        institution_id="ins_001",
        institution_name="Test Bank",
        is_active=True,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@pytest.fixture
def sample_accounts(db, sample_profile, sample_plaid_item):
    """Create sample accounts of various types."""
    accounts = {}
    for name, acc_type, balance in [
        ("Checking", AccountType.CHECKING, Decimal("5000")),
        ("Savings", AccountType.SAVINGS, Decimal("15000")),
        ("Credit Card", AccountType.CREDIT, Decimal("2500")),
        ("Investment", AccountType.INVESTMENT, Decimal("50000")),
        ("Car Loan", AccountType.LOAN, Decimal("12000")),
    ]:
        acc = Account(
            profile_id=sample_profile.id,
            plaid_item_id=sample_plaid_item.id,
            plaid_account_id=f"acc_{name.lower().replace(' ', '_')}",
            name=name,
            account_type=acc_type,
            balance_current=balance,
        )
        db.add(acc)
        db.flush()
        accounts[name] = acc
    db.commit()
    return accounts


@pytest.fixture
def sample_transactions(db, sample_accounts, sample_categories):
    """Create sample transactions for testing."""
    checking = sample_accounts["Checking"]
    credit = sample_accounts["Credit Card"]
    txns = []

    entries = [
        (checking.id, sample_categories["Groceries"].id, Decimal("85.50"), date(2025, 1, 15), "Whole Foods Market", False, False),
        (checking.id, sample_categories["Salary"].id, Decimal("-3500.00"), date(2025, 1, 1), "DFAS Payroll", False, False),
        (credit.id, sample_categories["Restaurants"].id, Decimal("42.00"), date(2025, 1, 10), "Olive Garden", False, False),
        (credit.id, sample_categories["Streaming"].id, Decimal("15.99"), date(2025, 1, 5), "Netflix", False, False),
        (checking.id, sample_categories["Transfer"].id, Decimal("500.00"), date(2025, 1, 20), "Transfer to Savings", True, False),
        (credit.id, sample_categories["Groceries"].id, Decimal("120.30"), date(2025, 1, 22), "Costco", False, False),
        (checking.id, sample_categories["Uncategorized"].id, Decimal("200.00"), date(2025, 1, 25), "Excluded charge", False, True),
    ]

    for i, (acct_id, cat_id, amount, dt, name, is_transfer, is_excluded) in enumerate(entries):
        txn = Transaction(
            account_id=acct_id,
            category_id=cat_id,
            plaid_transaction_id=f"txn_{i:03d}",
            amount=amount,
            date=dt,
            name=name,
            merchant_name=name,
            is_transfer=is_transfer,
            is_excluded=is_excluded,
        )
        db.add(txn)
        txns.append(txn)

    db.commit()
    return txns


@pytest.fixture
def sample_tsp_scenario(db, sample_profile):
    """Create a sample TSP scenario."""
    scenario = TSPScenario(
        profile_id=sample_profile.id,
        name="Base Scenario",
        current_balance=Decimal("50000"),
        contribution_pct=Decimal("5.0"),
        base_pay=Decimal("60000"),
        annual_pay_increase_pct=Decimal("2.0"),
        allocation_g=Decimal("0"),
        allocation_f=Decimal("0"),
        allocation_c=Decimal("60"),
        allocation_s=Decimal("30"),
        allocation_i=Decimal("10"),
        allocation_l=Decimal("0"),
        use_historical_returns=False,
        custom_annual_return_pct=Decimal("7.0"),
        retirement_age=60,
        birth_year=1990,
    )
    db.add(scenario)
    db.commit()
    db.refresh(scenario)
    return scenario


@pytest.fixture
def sample_fund_history(db):
    """Create sample TSP fund price history."""
    entries = []
    for fund, prices in {
        "C": [(date(2017, 1, 2), 25.00), (date(2026, 1, 2), 65.00)],
        "S": [(date(2017, 1, 2), 35.00), (date(2026, 1, 2), 80.00)],
        "G": [(date(2017, 1, 2), 14.00), (date(2026, 1, 2), 18.00)],
        "F": [(date(2017, 1, 2), 16.00), (date(2026, 1, 2), 21.00)],
        "I": [(date(2017, 1, 2), 25.00), (date(2026, 1, 2), 38.00)],
    }.items():
        for dt, price in prices:
            entry = TSPFundHistory(
                fund=fund,
                date=dt,
                price=Decimal(str(price)),
            )
            db.add(entry)
            entries.append(entry)
    db.commit()
    return entries


@pytest.fixture
def test_user(db) -> User:
    """Create a test user with a linked primary profile."""
    user = User(
        email="testauth@example.com",
        hashed_password=hash_password("TestPass123!"),
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    profile = Profile(
        user_id=user.id,
        name="Auth Test Profile",
        is_primary=True,
        base_pay=Decimal("60000"),
        tsp_contribution_pct=Decimal("5.0"),
    )
    db.add(profile)
    db.commit()
    return user


@pytest.fixture
def auth_headers(test_user) -> dict:
    """Provide authenticated headers with JWT and CSRF for API requests."""
    token = create_access_token({"sub": str(test_user.id)})
    return {
        "Authorization": f"Bearer {token}",
        "X-Requested-With": "XMLHttpRequest",
    }


@pytest.fixture
def api_headers() -> dict:
    """Provide headers for public endpoints (no auth, with CSRF)."""
    return {
        "X-Requested-With": "XMLHttpRequest",
        "Content-Type": "application/json",
    }
