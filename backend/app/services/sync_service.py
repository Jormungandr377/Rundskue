"""Transaction sync service with scheduling."""
import logging
from datetime import datetime
from sqlalchemy.orm import Session
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

from app.database import SessionLocal
from app.models import PlaidItem
from app.services import plaid_service
from app.services.analytics import save_net_worth_snapshot
from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

# Global scheduler instance
scheduler = BackgroundScheduler()


def sync_all_items():
    """Sync transactions for all active Plaid items."""
    logger.info("Starting scheduled sync for all Plaid items")
    
    db = SessionLocal()
    try:
        # Get all active Plaid items
        items = db.query(PlaidItem).filter(PlaidItem.is_active == True).all()
        
        logger.info(f"Found {len(items)} active Plaid items to sync")
        
        success_count = 0
        error_count = 0
        
        for item in items:
            try:
                logger.info(f"Syncing item {item.id} ({item.institution_name})")
                result = plaid_service.sync_transactions(db, item)
                logger.info(
                    f"Item {item.id} sync complete: "
                    f"+{result['added']} ~{result['modified']} -{result['removed']}"
                )
                success_count += 1
            except Exception as e:
                logger.error(f"Error syncing item {item.id}: {str(e)}")
                
                # Update item with error
                try:
                    plaid_service.handle_plaid_error(
                        db, item, 
                        error_code="SYNC_ERROR",
                        error_message=str(e)
                    )
                except:
                    pass
                
                error_count += 1
        
        # Save net worth snapshots after sync
        try:
            # Save household total
            save_net_worth_snapshot(db, profile_id=None)
            
            # Save per-profile snapshots
            profile_ids = db.query(PlaidItem.profile_id).distinct().all()
            for (profile_id,) in profile_ids:
                save_net_worth_snapshot(db, profile_id=profile_id)
            
            logger.info("Net worth snapshots saved")
        except Exception as e:
            logger.error(f"Error saving net worth snapshots: {str(e)}")
        
        logger.info(
            f"Scheduled sync complete: {success_count} succeeded, {error_count} failed"
        )
        
    except Exception as e:
        logger.error(f"Error in scheduled sync: {str(e)}")
    finally:
        db.close()


def sync_single_item(db: Session, item_id: int) -> dict:
    """Sync a single Plaid item."""
    item = db.query(PlaidItem).filter(PlaidItem.id == item_id).first()
    
    if not item:
        raise ValueError(f"Plaid item {item_id} not found")
    
    if not item.is_active:
        raise ValueError(f"Plaid item {item_id} is not active")
    
    return plaid_service.sync_transactions(db, item)


def start_scheduler():
    """Start the background sync scheduler."""
    # Schedule daily sync
    trigger = CronTrigger(
        hour=settings.sync_hour,
        minute=settings.sync_minute
    )
    
    scheduler.add_job(
        sync_all_items,
        trigger=trigger,
        id="daily_sync",
        name="Daily Transaction Sync",
        replace_existing=True
    )
    
    scheduler.start()
    logger.info(
        f"Scheduler started. Daily sync scheduled at "
        f"{settings.sync_hour:02d}:{settings.sync_minute:02d}"
    )


def stop_scheduler():
    """Stop the background scheduler."""
    if scheduler.running:
        scheduler.shutdown()
        logger.info("Scheduler stopped")


def get_scheduler_status() -> dict:
    """Get current scheduler status."""
    jobs = []
    for job in scheduler.get_jobs():
        jobs.append({
            "id": job.id,
            "name": job.name,
            "next_run": job.next_run_time.isoformat() if job.next_run_time else None
        })
    
    return {
        "running": scheduler.running,
        "jobs": jobs
    }


def trigger_manual_sync():
    """Trigger an immediate sync outside of schedule."""
    logger.info("Manual sync triggered")
    sync_all_items()
