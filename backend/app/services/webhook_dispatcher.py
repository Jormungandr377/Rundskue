"""Webhook dispatcher service for sending event notifications."""
import hmac
import hashlib
import json
import logging
from datetime import datetime, timezone
from typing import Any, Dict

import httpx

logger = logging.getLogger(__name__)

VALID_EVENTS = {
    "transaction_created",
    "budget_exceeded",
    "goal_reached",
    "bill_due",
    "sync_completed",
}


async def dispatch_webhook_event(
    user_id: int,
    event_type: str,
    payload: Dict[str, Any],
):
    """
    Dispatch a webhook event to all active webhooks for a user that are subscribed to this event type.

    Args:
        user_id: The user whose webhooks to trigger
        event_type: The event type string
        payload: The event data payload
    """
    from ..database import SessionLocal
    from ..models import Webhook

    if event_type not in VALID_EVENTS:
        logger.warning(f"Unknown webhook event type: {event_type}")
        return

    db = SessionLocal()
    try:
        webhooks = db.query(Webhook).filter(
            Webhook.user_id == user_id,
            Webhook.is_active == True,
        ).all()

        for webhook in webhooks:
            events = webhook.events or []
            if event_type not in events:
                continue

            body = json.dumps({
                "event": event_type,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "data": payload,
            }, default=str)

            # HMAC-SHA256 signature
            signature = hmac.new(
                webhook.secret.encode(),
                body.encode(),
                hashlib.sha256,
            ).hexdigest()

            try:
                async with httpx.AsyncClient(timeout=10.0) as client:
                    resp = await client.post(
                        webhook.url,
                        content=body,
                        headers={
                            "Content-Type": "application/json",
                            "X-Webhook-Signature": signature,
                            "X-Webhook-Event": event_type,
                        },
                    )

                if resp.status_code < 300:
                    webhook.last_triggered = datetime.now(timezone.utc)
                    webhook.failure_count = 0
                else:
                    webhook.failure_count = (webhook.failure_count or 0) + 1
                    logger.warning(
                        f"Webhook {webhook.id} returned {resp.status_code}"
                    )

            except Exception as e:
                webhook.failure_count = (webhook.failure_count or 0) + 1
                logger.error(f"Webhook {webhook.id} failed: {e}")

            # Auto-disable after 10 consecutive failures
            if (webhook.failure_count or 0) >= 10:
                webhook.is_active = False
                logger.warning(f"Webhook {webhook.id} auto-disabled after 10 failures")

        db.commit()
    except Exception as e:
        logger.error(f"Webhook dispatch error: {e}")
        db.rollback()
    finally:
        db.close()
