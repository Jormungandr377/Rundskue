"""Tests for the transaction categorization service."""
import pytest

from app.services.categorization import (
    categorize_transaction,
    get_category_hierarchy,
    KEYWORD_MAPPINGS,
    PLAID_CATEGORY_MAPPINGS,
)
from app.models import Category


class TestKeywordMappings:
    """Tests for keyword-to-category mappings."""

    def test_grocery_keywords(self):
        grocery_keywords = ["grocery", "groceries", "walmart", "costco", "whole foods"]
        for kw in grocery_keywords:
            assert KEYWORD_MAPPINGS[kw] == "Groceries"

    def test_restaurant_keywords(self):
        assert KEYWORD_MAPPINGS["doordash"] == "Restaurants"
        assert KEYWORD_MAPPINGS["uber eats"] == "Restaurants"

    def test_fast_food_keywords(self):
        assert KEYWORD_MAPPINGS["mcdonald"] == "Fast Food"
        assert KEYWORD_MAPPINGS["chipotle"] == "Fast Food"

    def test_transfer_keywords(self):
        assert KEYWORD_MAPPINGS["zelle"] == "Transfer"
        assert KEYWORD_MAPPINGS["venmo"] == "Transfer"

    def test_military_keywords(self):
        assert KEYWORD_MAPPINGS["dfas"] == "Military Pay"
        assert KEYWORD_MAPPINGS["commissary"] == "Groceries"


class TestPlaidCategoryMappings:
    """Tests for Plaid category mappings."""

    def test_hierarchical_match(self):
        assert PLAID_CATEGORY_MAPPINGS["Food and Drink > Restaurants"] == "Restaurants"
        assert PLAID_CATEGORY_MAPPINGS["Food and Drink > Groceries"] == "Groceries"

    def test_top_level_match(self):
        assert PLAID_CATEGORY_MAPPINGS["Travel"] == "Travel"
        assert PLAID_CATEGORY_MAPPINGS["Healthcare"] == "Healthcare"

    def test_transfer_mapping(self):
        assert PLAID_CATEGORY_MAPPINGS["Transfer"] == "Transfer"
        assert PLAID_CATEGORY_MAPPINGS["Payment"] == "Transfer"


class TestCategorizeTransaction:
    """Tests for the main categorization function."""

    def test_keyword_match_case_insensitive(self, db, sample_categories):
        result = categorize_transaction(db, "WALMART SUPERCENTER #1234")
        assert result == sample_categories["Groceries"].id

    def test_keyword_match_partial(self, db, sample_categories):
        result = categorize_transaction(db, "Amazon.com Order")
        assert result == sample_categories["Amazon"].id

    def test_plaid_category_fallback(self, db, sample_categories):
        # No keyword match, but Plaid category should work
        result = categorize_transaction(
            db,
            "Unknown Merchant XYZ",
            plaid_categories=["Food and Drink", "Restaurants"],
        )
        assert result == sample_categories["Restaurants"].id

    def test_plaid_top_level_fallback(self, db, sample_categories):
        result = categorize_transaction(
            db,
            "Unknown Merchant XYZ",
            plaid_categories=["Food and Drink"],
        )
        assert result == sample_categories["Food"].id

    def test_no_match_returns_uncategorized(self, db, sample_categories):
        result = categorize_transaction(db, "XYZZY Unknown Corp 12345")
        assert result == sample_categories["Uncategorized"].id

    def test_none_merchant_name(self, db, sample_categories):
        result = categorize_transaction(db, None)
        assert result == sample_categories["Uncategorized"].id

    def test_empty_merchant_name(self, db, sample_categories):
        result = categorize_transaction(db, "")
        assert result == sample_categories["Uncategorized"].id

    def test_keyword_takes_priority_over_plaid(self, db, sample_categories):
        # "starbucks" matches "Coffee Shops" by keyword
        result = categorize_transaction(
            db,
            "Starbucks #12345",
            plaid_categories=["Food and Drink", "Coffee Shop"],
        )
        assert result == sample_categories["Coffee Shops"].id

    def test_no_uncategorized_in_db_returns_none(self, db):
        # Create a category that won't match
        cat = Category(name="Other", is_income=False)
        db.add(cat)
        db.commit()
        result = categorize_transaction(db, "XYZZY Unknown")
        assert result is None


class TestGetCategoryHierarchy:
    """Tests for category hierarchy retrieval."""

    def test_returns_top_level_categories(self, db, sample_categories):
        result = get_category_hierarchy(db)
        names = [c["name"] for c in result]
        assert "Groceries" in names
        assert "Restaurants" in names

    def test_includes_children(self, db, sample_categories):
        # Add a child category
        parent = sample_categories["Groceries"]
        child = Category(name="Organic", parent_id=parent.id, is_income=False)
        db.add(child)
        db.commit()

        result = get_category_hierarchy(db)
        groceries = next(c for c in result if c["name"] == "Groceries")
        assert len(groceries["children"]) == 1
        assert groceries["children"][0]["name"] == "Organic"

    def test_empty_database(self, db):
        result = get_category_hierarchy(db)
        assert result == []
