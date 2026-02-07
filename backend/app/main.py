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

from .config import get_settings
from .routers import plaid, accounts, transactions, budgets, analytics, profiles
from .routers import tsp, auth
from .services.sync_service import sync_all_items
from .init_db import init_db

settings = get_settings()

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
    scheduler.start()
    print(f"Scheduled daily sync at {settings.sync_hour:02d}:{settings.sync_minute:02d}")
    
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
        elif path == "/favicon.ico":
            response.headers["Cache-Control"] = "public, max-age=86400"
        # API responses - no cache
        elif path.startswith("/api/"):
            response.headers["Cache-Control"] = "no-store"
        # HTML (SPA routes) - revalidate every time so deploys take effect
        else:
            response.headers["Cache-Control"] = "no-cache"

        return response


app.add_middleware(CacheControlMiddleware)

# Include routers
app.include_router(auth.router, prefix="/api")  # Auth routes (no additional prefix)
app.include_router(profiles.router, prefix="/api/profiles", tags=["Profiles"])
app.include_router(plaid.router, prefix="/api/plaid", tags=["Plaid"])
app.include_router(accounts.router, prefix="/api/accounts", tags=["Accounts"])
app.include_router(transactions.router, prefix="/api/transactions", tags=["Transactions"])
app.include_router(budgets.router, prefix="/api/budgets", tags=["Budgets"])
app.include_router(analytics.router, prefix="/api/analytics", tags=["Analytics"])
app.include_router(tsp.router, prefix="/api/tsp", tags=["TSP"])


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

    # Serve favicon and other root files
    @app.get("/favicon.ico")
    async def favicon():
        favicon_path = static_dir / "favicon.ico"
        if favicon_path.exists():
            return FileResponse(favicon_path)
        return {"error": "Favicon not found"}

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
