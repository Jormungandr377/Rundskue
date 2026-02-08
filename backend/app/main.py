"""
Finance Tracker API
Main FastAPI application entry point
Updated: Performance optimization - GZip compression + cache headers - 2026-02-07
"""
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from contextlib import asynccontextmanager
from starlette.exceptions import HTTPException as StarletteHTTPException
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
import os
from pathlib import Path
import sentry_sdk

from .config import get_settings
from .routers import plaid, accounts, transactions, budgets, analytics, profiles
from .routers import tsp, auth, recurring, export, goals, notifications, categorization, sessions
from .routers import admin, envelopes, subscriptions, cashflow, paycheck, savings_rules
from .routers import debt, credit, investments, splits
from .services.sync_service import sync_all_items
from .init_db import init_db

settings = get_settings()


async def create_access_review_reminder():
    """Quarterly job: create a notification for each admin user to perform an access review."""
    from .database import SessionLocal
    from .models import User as UserModel, Notification

    db = SessionLocal()
    try:
        admins = db.query(UserModel).filter(
            UserModel.role == "admin", UserModel.is_active == True
        ).all()
        for admin in admins:
            notif = Notification(
                user_id=admin.id,
                type="access_review_due",
                title="Quarterly Access Review Due",
                message="A quarterly access review is due. Please review all user accounts, "
                        "roles, and permissions via the Admin panel and record completion.",
            )
            db.add(notif)
        db.commit()
    finally:
        db.close()


# Sentry error monitoring (only if DSN configured)
if settings.sentry_dsn:
    sentry_sdk.init(
        dsn=settings.sentry_dsn,
        traces_sample_rate=0.1,
        profiles_sample_rate=0.1,
        environment="production",
    )

# Rate limiter
limiter = Limiter(key_func=get_remote_address)

# Scheduler for daily syncs
scheduler = AsyncIOScheduler()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler - runs on startup and shutdown."""
    # Startup
    print("Starting Finance Tracker API...")

    # Initialize database tables and default data
    init_db()

    # Schedule daily Plaid sync
    scheduler.add_job(
        sync_all_items,
        CronTrigger(hour=settings.sync_hour, minute=settings.sync_minute),
        id="daily_plaid_sync",
        name="Daily Plaid Transaction Sync",
        replace_existing=True
    )

    # Schedule quarterly access review reminder (1st of Jan/Apr/Jul/Oct at 9 AM)
    scheduler.add_job(
        create_access_review_reminder,
        CronTrigger(month="1,4,7,10", day=1, hour=9),
        id="quarterly_access_review",
        name="Quarterly Access Review Reminder",
        replace_existing=True,
    )

    scheduler.start()
    print(f"Scheduled daily sync at {settings.sync_hour:02d}:{settings.sync_minute:02d}")
    print("Scheduled quarterly access review reminders")

    # Startup check: warn if admin users don't have 2FA
    from .database import SessionLocal
    from .models import User as UserModel
    check_db = SessionLocal()
    try:
        admins_no_2fa = check_db.query(UserModel).filter(
            UserModel.role == "admin", UserModel.totp_enabled == False
        ).count()
        if admins_no_2fa:
            print(f"WARNING: {admins_no_2fa} admin user(s) do not have 2FA enabled!")
    finally:
        check_db.close()
    
    yield
    
    # Shutdown
    print("Shutting down Finance Tracker API...")
    scheduler.shutdown()


app = FastAPI(
    title="Finance Tracker",
    description="Self-hosted personal finance tracker with Plaid integration and TSP simulator",
    version="1.0.0",
    lifespan=lifespan
)

# Rate limiting
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# GZip compression - compress responses > 500 bytes (huge win for JS/CSS bundles)
app.add_middleware(GZipMiddleware, minimum_size=500)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url, "https://finance.rundskue.com", "http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Cache headers middleware - long cache for hashed assets, no-cache for HTML/API
class CacheControlMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        path = request.url.path

        # Hashed static assets (e.g. /assets/index-CWa-Wc9X.js) - cache 1 year
        if path.startswith("/assets/"):
            response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
        # Favicon - cache 1 day
        elif path in ("/favicon.ico", "/favicon.svg"):
            response.headers["Cache-Control"] = "public, max-age=86400"
        # Service worker - must always be fresh
        elif path == "/sw.js":
            response.headers["Cache-Control"] = "no-cache"
        # API responses - no cache
        elif path.startswith("/api/"):
            response.headers["Cache-Control"] = "no-store"
        # HTML (SPA routes) - revalidate every time so deploys take effect
        else:
            response.headers["Cache-Control"] = "no-cache"

        return response


app.add_middleware(CacheControlMiddleware)


# Security headers middleware - defense-in-depth HTTP headers
class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "0"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        if request.url.path.startswith("/api/"):
            response.headers["Content-Security-Policy"] = "default-src 'none'; frame-ancestors 'none'"
        return response


app.add_middleware(SecurityHeadersMiddleware)


# CSRF protection - require X-Requested-With header on state-changing API requests
# This leverages the browser's same-origin policy: cross-origin forms can't set custom headers
class CSRFMiddleware(BaseHTTPMiddleware):
    SAFE_METHODS = ("GET", "HEAD", "OPTIONS")
    EXEMPT_PATHS = ("/api/auth/login", "/api/auth/register", "/api/auth/refresh",
                    "/api/auth/forgot-password", "/api/auth/reset-password",
                    "/api/auth/verify-email", "/api/auth/resend-verification",
                    "/api/health")

    async def dispatch(self, request: Request, call_next):
        if (
            request.method not in self.SAFE_METHODS
            and request.url.path.startswith("/api/")
            and request.url.path not in self.EXEMPT_PATHS
        ):
            if not request.headers.get("X-Requested-With"):
                return JSONResponse(
                    status_code=403,
                    content={"detail": "Missing X-Requested-With header"}
                )
        return await call_next(request)


app.add_middleware(CSRFMiddleware)

# Include routers
app.include_router(auth.router, prefix="/api")  # Auth routes (no additional prefix)
app.include_router(profiles.router, prefix="/api/profiles", tags=["Profiles"])
app.include_router(plaid.router, prefix="/api/plaid", tags=["Plaid"])
app.include_router(accounts.router, prefix="/api/accounts", tags=["Accounts"])
app.include_router(transactions.router, prefix="/api/transactions", tags=["Transactions"])
app.include_router(budgets.router, prefix="/api/budgets", tags=["Budgets"])
app.include_router(analytics.router, prefix="/api/analytics", tags=["Analytics"])
app.include_router(tsp.router, prefix="/api/tsp", tags=["TSP"])
app.include_router(recurring.router, prefix="/api/recurring", tags=["Recurring"])
app.include_router(export.router, prefix="/api/export", tags=["Export"])
app.include_router(goals.router, prefix="/api/goals", tags=["Savings Goals"])
app.include_router(notifications.router, prefix="/api/notifications", tags=["Notifications"])
app.include_router(categorization.router, prefix="/api/categorization", tags=["Auto-Categorization"])
app.include_router(sessions.router, prefix="/api/sessions", tags=["Sessions"])
app.include_router(admin.router, prefix="/api/admin", tags=["Admin"])
app.include_router(envelopes.router, prefix="/api/envelopes", tags=["Envelopes"])
app.include_router(subscriptions.router, prefix="/api/subscriptions", tags=["Subscriptions"])
app.include_router(cashflow.router, prefix="/api/cashflow", tags=["Cash Flow"])
app.include_router(paycheck.router, prefix="/api/paycheck", tags=["Paycheck"])
app.include_router(savings_rules.router, prefix="/api/savings-rules", tags=["Savings Rules"])
app.include_router(debt.router, prefix="/api/debt", tags=["Debt"])
app.include_router(credit.router, prefix="/api/credit-score", tags=["Credit Score"])
app.include_router(investments.router, prefix="/api/investments", tags=["Investments"])
app.include_router(splits.router, prefix="/api/splits", tags=["Bill Splitting"])


@app.get("/")
async def root():
    """Serve the React frontend at root."""
    index_path = static_dir / "index.html"
    if index_path.exists():
        return FileResponse(index_path)
    return {
        "status": "healthy",
        "app": "Finance Tracker",
        "version": "1.0.0"
    }


@app.get("/api/health")
async def health_check():
    """Detailed health check."""
    return {
        "status": "healthy",
        "database": "connected",
        "scheduler": "running" if scheduler.running else "stopped"
    }


# Serve static files from the React build
static_dir = Path(__file__).parent.parent.parent / "frontend" / "dist"
if static_dir.exists():
    # Serve static assets
    app.mount("/assets", StaticFiles(directory=static_dir / "assets"), name="assets")

    # Serve favicon and other root-level files
    @app.get("/favicon.ico")
    async def favicon():
        favicon_path = static_dir / "favicon.ico"
        if favicon_path.exists():
            return FileResponse(favicon_path)
        return {"error": "Favicon not found"}

    @app.get("/favicon.svg")
    async def favicon_svg():
        svg_path = static_dir / "favicon.svg"
        if svg_path.exists():
            return FileResponse(svg_path, media_type="image/svg+xml")
        return {"error": "Favicon not found"}

    @app.get("/manifest.json")
    async def manifest():
        manifest_path = static_dir / "manifest.json"
        if manifest_path.exists():
            return FileResponse(manifest_path, media_type="application/manifest+json")
        return {"error": "Manifest not found"}

    @app.get("/sw.js")
    async def service_worker():
        sw_path = static_dir / "sw.js"
        if sw_path.exists():
            return FileResponse(
                sw_path,
                media_type="application/javascript",
                headers={"Cache-Control": "no-cache", "Service-Worker-Allowed": "/"},
            )
        return {"error": "Service worker not found"}

    # Exception handler for 404s - serve SPA for non-API routes
    @app.exception_handler(404)
    async def not_found_handler(request: Request, exc):
        # Serve SPA for non-API routes
        if not request.url.path.startswith("/api/"):
            index_path = static_dir / "index.html"
            if index_path.exists():
                return FileResponse(index_path)
        # For API routes, return proper 404
        from fastapi.responses import JSONResponse
        return JSONResponse(
            status_code=404,
            content={"detail": "Not found"}
        )
