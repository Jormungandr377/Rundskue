"""Tests for the Plaid integration service."""
import pytest
from unittest.mock import patch, MagicMock
from cryptography.fernet import Fernet

from app.services.plaid_service import (
    encrypt_token,
    decrypt_token,
    map_account_type,
    handle_plaid_error,
)
from app.models import AccountType, PlaidItem


class TestTokenEncryption:
    """Tests for Plaid access token encryption/decryption."""

    def test_encrypt_decrypt_round_trip(self):
        # Generate a key and patch the module's fernet
        key = Fernet.generate_key()
        fernet = Fernet(key)

        with patch("app.services.plaid_service.fernet", fernet):
            original = "access-sandbox-abc123-test-token"
            encrypted = encrypt_token(original)
            assert encrypted != original
            decrypted = decrypt_token(encrypted)
            assert decrypted == original

    def test_encrypted_is_different_from_plaintext(self):
        key = Fernet.generate_key()
        fernet = Fernet(key)

        with patch("app.services.plaid_service.fernet", fernet):
            token = "my-secret-token"
            encrypted = encrypt_token(token)
            assert encrypted != token
            assert len(encrypted) > len(token)

    def test_decrypt_with_wrong_key_fails(self):
        key1 = Fernet.generate_key()
        key2 = Fernet.generate_key()
        fernet1 = Fernet(key1)
        fernet2 = Fernet(key2)

        with patch("app.services.plaid_service.fernet", fernet1):
            encrypted = encrypt_token("test-token")

        with patch("app.services.plaid_service.fernet", fernet2):
            with pytest.raises(Exception):
                decrypt_token(encrypted)


class TestMapAccountType:
    """Tests for Plaid account type mapping."""

    def test_depository_checking(self):
        assert map_account_type("depository", "checking") == AccountType.CHECKING

    def test_depository_savings(self):
        assert map_account_type("depository", "savings") == AccountType.SAVINGS

    def test_depository_default_is_checking(self):
        assert map_account_type("depository", "cd") == AccountType.CHECKING

    def test_credit(self):
        assert map_account_type("credit", "credit card") == AccountType.CREDIT

    def test_investment(self):
        assert map_account_type("investment", "401k") == AccountType.INVESTMENT

    def test_loan(self):
        assert map_account_type("loan", "auto") == AccountType.LOAN

    def test_mortgage(self):
        assert map_account_type("loan", "mortgage") == AccountType.MORTGAGE

    def test_unknown_type(self):
        assert map_account_type("other", None) == AccountType.OTHER

    def test_case_insensitive(self):
        assert map_account_type("DEPOSITORY", "CHECKING") == AccountType.CHECKING

    def test_none_subtype(self):
        assert map_account_type("depository", None) == AccountType.CHECKING


class TestHandlePlaidError:
    """Tests for Plaid error handling."""

    def test_sets_error_fields(self, db, sample_plaid_item):
        handle_plaid_error(db, sample_plaid_item, "SOME_ERROR", "Something went wrong")
        db.refresh(sample_plaid_item)
        assert sample_plaid_item.error_code == "SOME_ERROR"
        assert sample_plaid_item.error_message == "Something went wrong"
        assert sample_plaid_item.is_active is True  # Non-fatal error

    def test_fatal_error_deactivates_item(self, db, sample_plaid_item):
        handle_plaid_error(db, sample_plaid_item, "ITEM_LOGIN_REQUIRED", "Login required")
        db.refresh(sample_plaid_item)
        assert sample_plaid_item.is_active is False

    def test_item_not_found_deactivates(self, db, sample_plaid_item):
        handle_plaid_error(db, sample_plaid_item, "ITEM_NOT_FOUND", "Item not found")
        db.refresh(sample_plaid_item)
        assert sample_plaid_item.is_active is False

    def test_access_not_granted_deactivates(self, db, sample_plaid_item):
        handle_plaid_error(db, sample_plaid_item, "ACCESS_NOT_GRANTED", "Access denied")
        db.refresh(sample_plaid_item)
        assert sample_plaid_item.is_active is False

    def test_non_fatal_error_keeps_active(self, db, sample_plaid_item):
        handle_plaid_error(db, sample_plaid_item, "RATE_LIMIT", "Too many requests")
        db.refresh(sample_plaid_item)
        assert sample_plaid_item.is_active is True
