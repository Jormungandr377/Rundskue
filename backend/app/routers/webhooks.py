"""Webhook management router - register, update, delete, and test webhooks."""
import secrets
import hmac
import hashlib
import json
import ipaddress
import socket
import logging
from datetime import datetime, timezone
from typing import List, Optional
from urllib.parse import urlparse

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field, field_validator

from ..database import get_db
from ..models import Webhook, User
from ..dependencies import get_current_active_user
from ..services import audit

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Webhooks"])


# ============================================================================
# Constants
# ============================================================================

ALLOWED_EVENT_TYPES = {
    "transaction_created",
    "budget_exceeded",
    "goal_reached",
    "bill_due",
    "sync_completed",
}


# ============================================================================
# Schemas
# ============================================================================

class WebhookCreate(BaseModel):
    url: str = Field(..., max_length=500)
    events: List[str]

    @field_validator("url")
    @classmethod
    def url_must_be_https(cls, v: str) -> str:
        if not v.startswith("https://"):
            raise ValueError("Webhook URL must start with https://")
        return v

    @field_validator("events")
    @classmethod
    def events_must_be_valid(cls, v: List[str]) -> List[str]:
        if not v:
            raise ValueError("At least one event type is required")
        invalid = set(v) - ALLOWED_EVENT_TYPES
        if invalid:
            raise ValueError(
                f"Invalid event types: {', '.join(sorted(invalid))}. "
                f"Allowed: {', '.join(sorted(ALLOWED_EVENT_TYPES))}"
            )
        return v


class WebhookUpdate(BaseModel):
    url: Optional[str] = Field(None, max_length=500)
    events: Optional[List[str]] = None
    is_active: Optional[bool] = None

    @field_validator("url")
    @classmethod
    def url_must_be_https(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and not v.startswith("https://"):
            raise ValueError("Webhook URL must start with https://")
        return v

    @field_validator("events")
    @classmethod
    def events_must_be_valid(cls, v: Optional[List[str]]) -> Optional[List[str]]:
        if v is not None:
            if not v:
                raise ValueError("At least one event type is required")
            invalid = set(v) - ALLOWED_EVENT_TYPES
            if invalid:
                raise ValueError(
                    f"Invalid event types: {', '.join(sorted(invalid))}. "
                    f"Allowed: {', '.join(sorted(ALLOWED_EVENT_TYPES))}"
                )
        return v


class WebhookResponse(BaseModel):
    id: int
    user_id: int
    url: str
    events: List[str]
    secret: str
    is_active: bool
    last_triggered: Optional[datetime] = None
    failure_count: int
    created_at: datetime

    class Config:
        from_attributes = True

    @field_validator("secret", mode="before")
    @classmethod
    def mask_secret(cls, v: str) -> str:
        if v and len(v) > 8:
            return v[:8] + "..."
        return v


class WebhookTestResponse(BaseModel):
    success: bool
    status_code: Optional[int] = None
    detail: str


# ============================================================================
# Helper Functions
# ============================================================================

def _get_user_webhook(
    webhook_id: int,
    user_id: int,
    db: Session,
) -> Webhook:
    """Retrieve a webhook that belongs to the given user, or raise 404."""
    webhook = db.query(Webhook).filter(
        Webhook.id == webhook_id,
        Webhook.user_id == user_id,
    ).first()
    if not webhook:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Webhook not found",
        )
    return webhook


def _generate_signature(payload: bytes, secret: str) -> str:
    """Generate an HMAC-SHA256 hex digest for the given payload and secret."""
    return hmac.new(
        secret.encode("utf-8"),
        payload,
        hashlib.sha256,
    ).hexdigest()


# Private / reserved IP ranges (SSRF protection)
_BLOCKED_NETWORKS = [
    ipaddress.ip_network("10.0.0.0/8"),
    ipaddress.ip_network("172.16.0.0/12"),
    ipaddress.ip_network("192.168.0.0/16"),
    ipaddress.ip_network("127.0.0.0/8"),
    ipaddress.ip_network("169.254.0.0/16"),   # Link-local / cloud metadata
    ipaddress.ip_network("0.0.0.0/8"),
    ipaddress.ip_network("::1/128"),
    ipaddress.ip_network("fc00::/7"),          # IPv6 ULA
    ipaddress.ip_network("fe80::/10"),         # IPv6 link-local
]


def _validate_webhook_url(url: str) -> None:
    """
    Prevent SSRF by resolving the URL hostname and rejecting private/internal IPs.
    Raises HTTPException(400) if the URL targets an internal network.
    """
    parsed = urlparse(url)
    hostname = parsed.hostname
    if not hostname:
        raise HTTPException(status_code=400, detail="Invalid webhook URL")

    try:
        # Resolve hostname to IP(s)
        addr_infos = socket.getaddrinfo(hostname, parsed.port or 443, proto=socket.IPPROTO_TCP)
    except socket.gaierror:
        raise HTTPException(status_code=400, detail="Could not resolve webhook hostname")

    for family, _, _, _, sockaddr in addr_infos:
        ip = ipaddress.ip_address(sockaddr[0])
        for net in _BLOCKED_NETWORKS:
            if ip in net:
                raise HTTPException(
                    status_code=400,
                    detail="Webhook URL must not point to a private or internal network address",
                )


# ============================================================================
# Endpoints
# ============================================================================

@router.get("/", response_model=List[WebhookResponse])
async def list_webhooks(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """List all webhooks for the current user."""
    webhooks = (
        db.query(Webhook)
        .filter(Webhook.user_id == current_user.id)
        .order_by(Webhook.created_at.desc())
        .all()
    )
    return webhooks


@router.post("/", response_model=WebhookResponse, status_code=status.HTTP_201_CREATED)
async def create_webhook(
    data: WebhookCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Create a new webhook for the current user."""
    webhook = Webhook(
        user_id=current_user.id,
        url=data.url,
        events=data.events,
        secret=secrets.token_hex(32),
        is_active=True,
        failure_count=0,
    )
    db.add(webhook)
    db.commit()
    db.refresh(webhook)
    return webhook


@router.put("/{webhook_id}", response_model=WebhookResponse)
async def update_webhook(
    webhook_id: int,
    data: WebhookUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Update an existing webhook (url, events, is_active)."""
    webhook = _get_user_webhook(webhook_id, current_user.id, db)

    if data.url is not None:
        webhook.url = data.url
    if data.events is not None:
        webhook.events = data.events
    if data.is_active is not None:
        webhook.is_active = data.is_active

    db.commit()
    db.refresh(webhook)
    return webhook


@router.delete("/{webhook_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_webhook(
    webhook_id: int,
    request: Request,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Delete a webhook with ownership verification."""
    webhook = _get_user_webhook(webhook_id, current_user.id, db)
    db.delete(webhook)
    db.commit()
    audit.log_from_request(db, request, audit.RESOURCE_DELETED, user_id=current_user.id, resource_type="webhook", resource_id=str(webhook_id))
    return None


@router.post("/{webhook_id}/test", response_model=WebhookTestResponse)
async def test_webhook(
    webhook_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Send a test payload to the webhook URL and return the result."""
    webhook = _get_user_webhook(webhook_id, current_user.id, db)

    # SSRF protection: validate the URL doesn't target internal networks
    _validate_webhook_url(webhook.url)

    test_payload = {
        "event": "test",
        "webhook_id": webhook.id,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "data": {
            "message": "This is a test event from Finance Tracker.",
        },
    }

    payload_bytes = json.dumps(test_payload, separators=(",", ":")).encode("utf-8")
    signature = _generate_signature(payload_bytes, webhook.secret)

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                webhook.url,
                content=payload_bytes,
                headers={
                    "Content-Type": "application/json",
                    "X-Webhook-Signature": signature,
                },
            )

        # Update last_triggered timestamp on successful delivery
        webhook.last_triggered = datetime.now(timezone.utc)

        if response.status_code < 400:
            webhook.failure_count = 0
            db.commit()
            return WebhookTestResponse(
                success=True,
                status_code=response.status_code,
                detail=f"Webhook responded with status {response.status_code}",
            )
        else:
            webhook.failure_count += 1
            db.commit()
            return WebhookTestResponse(
                success=False,
                status_code=response.status_code,
                detail=f"Webhook responded with error status {response.status_code}",
            )

    except httpx.TimeoutException:
        webhook.failure_count += 1
        db.commit()
        return WebhookTestResponse(
            success=False,
            status_code=None,
            detail="Webhook request timed out after 10 seconds",
        )
    except httpx.RequestError as exc:
        webhook.failure_count += 1
        db.commit()
        logger.warning(f"Webhook test failed for webhook {webhook.id}: {exc}")
        return WebhookTestResponse(
            success=False,
            status_code=None,
            detail="Failed to reach webhook URL",
        )
