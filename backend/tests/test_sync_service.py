"""Tests for the sync service."""
import pytest
from unittest.mock import patch, MagicMock

from app.services.sync_service import (
    sync_single_item,
    get_scheduler_status,
)
from app.models import PlaidItem


class TestSyncSingleItem:
    """Tests for single item sync."""

    def test_item_not_found_raises(self, db):
        with pytest.raises(ValueError, match="not found"):
            sync_single_item(db, 999)

    def test_inactive_item_raises(self, db, sample_plaid_item):
        sample_plaid_item.is_active = False
        db.commit()
        with pytest.raises(ValueError, match="not active"):
            sync_single_item(db, sample_plaid_item.id)

    @patch("app.services.sync_service.plaid_service.sync_transactions")
    def test_active_item_calls_sync(self, mock_sync, db, sample_plaid_item):
        mock_sync.return_value = {"added": 5, "modified": 1, "removed": 0, "cursor": "abc"}
        result = sync_single_item(db, sample_plaid_item.id)
        assert result["added"] == 5
        mock_sync.assert_called_once()


class TestGetSchedulerStatus:
    """Tests for scheduler status reporting."""

    def test_returns_status_dict(self):
        result = get_scheduler_status()
        assert "running" in result
        assert "jobs" in result
        assert isinstance(result["jobs"], list)
