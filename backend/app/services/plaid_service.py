"""Plaid API integration service."""
import plaid
from plaid.api import plaid_api
from plaid.model.link_token_create_request import LinkTokenCreateRequest
from plaid.model.link_token_create_request_user import LinkTokenCreateRequestUser
from plaid.model.item_public_token_exchange_request import ItemPublicTokenExchangeRequest
from plaid.model.transactions_sync_request import TransactionsSyncRequest
from plaid.model.accounts_get_request import AccountsGetRequest
from plaid.model.products import Products
from plaid.model.country_code import CountryCode
from cryptography.fernet import Fernet
from datetime import datetime
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models import PlaidItem, Account, AccountType

settings = get_settings()

# Initialize Plaid client
configuration = plaid.Configuration(
    host=getattr(plaid.Environment, settings.plaid_env.capitalize()),
    api_key={
        'clientId': settings.plaid_client_id,
        'secret': settings.plaid_secret,
    }
)
api_client = plaid.ApiClient(configuration)
plaid_client = plaid_api.PlaidApi(api_client)

# Encryption for access tokens
fernet = Fernet(settings.encryption_key.encode())


def encrypt_token(token: str) -> str:
    """Encrypt a Plaid access token."""
    return fernet.encrypt(token.encode()).decode()


def decrypt_token(encrypted: str) -> str:
    """Decrypt a Plaid access token."""
    return fernet.decrypt(encrypted.encode()).decode()


def create_link_token(profile_id: int, access_token: str = None) -> dict:
    """Create a Plaid Link token for connecting a new bank or updating an existing connection."""
    request = LinkTokenCreateRequest(
        products=[Products("transactions")],
        client_name="Finance Tracker",
        country_codes=[CountryCode("US")],
        language="en",
        user=LinkTokenCreateRequestUser(client_user_id=str(profile_id)),
    )

    # For update mode, include the access token
    if access_token:
        request.access_token = decrypt_token(access_token)

    # Add webhook URL if configured
    if settings.plaid_webhook_url:
        request.webhook = settings.plaid_webhook_url

    response = plaid_client.link_token_create(request)

    return {
        "link_token": response.link_token,
        "expiration": response.expiration.isoformat()
    }


def exchange_public_token(
    db: Session,
    profile_id: int,
    public_token: str,
    institution_id: str = None,
    institution_name: str = None
) -> PlaidItem:
    """Exchange public token for access token and create PlaidItem."""
    # Exchange the public token
    request = ItemPublicTokenExchangeRequest(public_token=public_token)
    response = plaid_client.item_public_token_exchange(request)
    
    # Create PlaidItem with encrypted access token
    plaid_item = PlaidItem(
        profile_id=profile_id,
        item_id=response.item_id,
        access_token_encrypted=encrypt_token(response.access_token),
        institution_id=institution_id,
        institution_name=institution_name,
        is_active=True
    )
    
    db.add(plaid_item)
    db.flush()
    
    # Fetch and create accounts
    fetch_accounts(db, plaid_item)
    
    db.commit()
    return plaid_item


def fetch_accounts(db: Session, plaid_item: PlaidItem) -> list[Account]:
    """Fetch accounts for a PlaidItem from Plaid."""
    access_token = decrypt_token(plaid_item.access_token_encrypted)
    
    request = AccountsGetRequest(access_token=access_token)
    response = plaid_client.accounts_get(request)
    
    accounts = []
    for acc in response.accounts:
        # Map Plaid account type to our enum
        account_type = map_account_type(acc.type, acc.subtype)
        
        # Check if account already exists
        existing = db.query(Account).filter(
            Account.plaid_account_id == acc.account_id
        ).first()
        
        if existing:
            # Update existing account
            existing.balance_current = acc.balances.current or 0
            existing.balance_available = acc.balances.available
            existing.balance_limit = acc.balances.limit
            accounts.append(existing)
        else:
            # Create new account
            account = Account(
                profile_id=plaid_item.profile_id,
                plaid_item_id=plaid_item.id,
                plaid_account_id=acc.account_id,
                name=acc.name,
                official_name=acc.official_name,
                account_type=account_type,
                subtype=str(acc.subtype) if acc.subtype else None,
                mask=acc.mask,
                balance_current=acc.balances.current or 0,
                balance_available=acc.balances.available,
                balance_limit=acc.balances.limit
            )
            db.add(account)
            accounts.append(account)
    
    return accounts


def map_account_type(plaid_type: str, plaid_subtype: str = None) -> AccountType:
    """Map Plaid account types to our AccountType enum."""
    type_str = str(plaid_type).lower()
    subtype_str = str(plaid_subtype).lower() if plaid_subtype else ""
    
    if type_str == "depository":
        if "checking" in subtype_str:
            return AccountType.CHECKING
        elif "savings" in subtype_str:
            return AccountType.SAVINGS
        return AccountType.CHECKING
    elif type_str == "credit":
        return AccountType.CREDIT
    elif type_str == "investment":
        return AccountType.INVESTMENT
    elif type_str == "loan":
        if "mortgage" in subtype_str:
            return AccountType.MORTGAGE
        return AccountType.LOAN
    
    return AccountType.OTHER


def sync_transactions(db: Session, plaid_item: PlaidItem, cursor: str = None) -> dict:
    """Sync transactions for a PlaidItem using Plaid's sync API."""
    from app.models import Transaction
    from app.services.categorization import categorize_transaction
    
    access_token = decrypt_token(plaid_item.access_token_encrypted)
    
    # Build accounts lookup
    accounts_by_plaid_id = {
        acc.plaid_account_id: acc 
        for acc in plaid_item.accounts
    }
    
    added_count = 0
    modified_count = 0
    removed_count = 0
    
    has_more = True
    while has_more:
        request = TransactionsSyncRequest(
            access_token=access_token,
            cursor=cursor
        )
        response = plaid_client.transactions_sync(request)
        
        # Process added transactions
        for txn in response.added:
            account = accounts_by_plaid_id.get(txn.account_id)
            if not account:
                continue
            
            # Check if transaction already exists
            existing = db.query(Transaction).filter(
                Transaction.plaid_transaction_id == txn.transaction_id
            ).first()
            
            if not existing:
                # Auto-categorize
                category_id = categorize_transaction(db, txn.name, txn.category)
                
                transaction = Transaction(
                    account_id=account.id,
                    plaid_transaction_id=txn.transaction_id,
                    amount=txn.amount,
                    date=txn.date,
                    name=txn.name,
                    merchant_name=txn.merchant_name,
                    plaid_category=txn.category,
                    plaid_category_id=txn.category_id,
                    category_id=category_id,
                    pending=txn.pending
                )
                db.add(transaction)
                added_count += 1
        
        # Process modified transactions
        for txn in response.modified:
            existing = db.query(Transaction).filter(
                Transaction.plaid_transaction_id == txn.transaction_id
            ).first()
            
            if existing:
                existing.amount = txn.amount
                existing.date = txn.date
                existing.name = txn.name
                existing.merchant_name = txn.merchant_name
                existing.pending = txn.pending
                modified_count += 1
        
        # Process removed transactions
        for txn in response.removed:
            existing = db.query(Transaction).filter(
                Transaction.plaid_transaction_id == txn.transaction_id
            ).first()
            
            if existing:
                db.delete(existing)
                removed_count += 1
        
        cursor = response.next_cursor
        has_more = response.has_more
    
    # Update last sync time and clear errors
    plaid_item.last_sync = datetime.utcnow()
    plaid_item.error_code = None
    plaid_item.error_message = None
    
    # Also refresh account balances
    fetch_accounts(db, plaid_item)
    
    db.commit()
    
    return {
        "added": added_count,
        "modified": modified_count,
        "removed": removed_count,
        "cursor": cursor
    }


def handle_plaid_error(db: Session, plaid_item: PlaidItem, error_code: str, error_message: str):
    """Update PlaidItem with error status."""
    plaid_item.error_code = error_code
    plaid_item.error_message = error_message
    
    # Deactivate on certain errors
    fatal_errors = ["ITEM_LOGIN_REQUIRED", "ITEM_NOT_FOUND", "ACCESS_NOT_GRANTED"]
    if error_code in fatal_errors:
        plaid_item.is_active = False
    
    db.commit()
