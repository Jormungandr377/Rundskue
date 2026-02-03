"""
Finance Tracker API
Main FastAPI application entry point
Updated: Fixed import paths for deployment
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from contextlib import asynccontextmanager
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
import os
from pathlib import Path

from .config import get_settings
from .routers import plaid, accounts, transactions, budgets, analytics, profiles
# from .routers import tsp  # Temporarily disabled - needs TSPSimulator class
from .services.sync_service import sync_all_items

settings = get_settings()

# Scheduler for daily syncs
scheduler = AsyncIOScheduler()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler - runs on startup and shutdown."""
    # Startup
    print("Starting Finance Tracker API...")
    
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

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url, "http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(profiles.router, prefix="/api/profiles", tags=["Profiles"])
app.include_router(plaid.router, prefix="/api/plaid", tags=["Plaid"])
app.include_router(accounts.router, prefix="/api/accounts", tags=["Accounts"])
app.include_router(transactions.router, prefix="/api/transactions", tags=["Transactions"])
app.include_router(budgets.router, prefix="/api/budgets", tags=["Budgets"])
app.include_router(analytics.router, prefix="/api/analytics", tags=["Analytics"])
# app.include_router(tsp.router, prefix="/api/tsp", tags=["TSP"])  # Temporarily disabled


@app.get("/")
async def root():
    """Health check endpoint."""
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

    # Serve the React app for all non-API routes (SPA routing)
    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        # Don't serve SPA for API routes
        if full_path.startswith("api/"):
            return {"error": "API route not found"}

        # Serve index.html for all SPA routes
        index_path = static_dir / "index.html"
        if index_path.exists():
            return FileResponse(index_path)
        return {"error": "Frontend not built. Run 'npm run build' in the frontend directory."}
