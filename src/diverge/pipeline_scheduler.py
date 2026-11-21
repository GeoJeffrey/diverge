"""
pipeline_scheduler.py

Automated Ingestion Pipeline Scheduler for Diverge.
Runs the master ingest pipeline (Phase 1 Scrapers -> Phase 2 Features -> Phase 3 Indices)
automatically every 4 hours using APScheduler.

Features:
- Configurable interval (default: every 4 hours).
- Automatic execution on startup (optional flag: --run-now).
- Structured logging to console and 'diverge_pipeline_scheduler.log' so that missed runs,
  timeouts, or pipeline errors are immediately visible and audited.
- Missed run notification & graceful execution tracking.
"""

import argparse
import logging
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

# Ensure project root is importable
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT / "src"))

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.events import EVENT_JOB_ERROR, EVENT_JOB_MISSED, EVENT_JOB_EXECUTED
from diverge import utils
from diverge.pipeline import run_full_pipeline

LOG_FILE = PROJECT_ROOT / "diverge_pipeline_scheduler.log"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] [Scheduler] %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(LOG_FILE, encoding="utf-8"),
    ],
)
logger = logging.getLogger("diverge_pipeline_scheduler")


def run_pipeline_job():
    """Execute the complete pipeline (ingest -> ... -> outlook -> publish)."""
    start = datetime.now(timezone.utc)
    logger.info(f"=== [START] Diverge pipeline run at {start.isoformat()} ===")
    status = run_full_pipeline()
    duration = (datetime.now(timezone.utc) - start).total_seconds()
    failed = [k for k, v in status.items() if v.startswith("failed")]
    if failed:
        logger.error(f"=== [DONE WITH FAILURES] {failed} in {duration:.0f}s ===")
    else:
        logger.info(f"=== [SUCCESS] pipeline completed in {duration:.0f}s ===")


def job_listener(event):
    """Event listener auditing missed runs and runtime errors."""
    if event.exception:
        logger.error(f"[AUDIT ALERT] Scheduled job raised exception: {event.exception}")
    elif event.code == EVENT_JOB_MISSED:
        logger.warning("[AUDIT ALERT] Scheduled job was MISSED! High server load or process sleep detected.")
    else:
        logger.info(f"[AUDIT LOG] Scheduled job executed cleanly (Job ID: {event.job_id})")


def start_scheduler(interval_hours: int = 4, run_now: bool = False):
    """Start background scheduler configured for 4-hour intervals."""
    scheduler = BackgroundScheduler(timezone="UTC")
    scheduler.add_listener(job_listener, EVENT_JOB_ERROR | EVENT_JOB_MISSED | EVENT_JOB_EXECUTED)
    
    # Schedule job every interval_hours
    job = scheduler.add_job(
        run_pipeline_job,
        trigger="interval",
        hours=interval_hours,
        id="diverge_ingest_pipeline",
        name="Diverge 4-Hour Ingest Pipeline",
        misfire_grace_time=3600,  # 1 hour grace window before marking missed
        replace_existing=True,
    )
    
    scheduler.start()
    logger.info(f"Scheduler started. Job 'diverge_ingest_pipeline' registered to run every {interval_hours} hours.")
    logger.info(f"Next scheduled run: {job.next_run_time}")
    
    if run_now:
        logger.info("Executing initial immediate run (--run-now enabled)...")
        run_pipeline_job()
        
    return scheduler


def main():
    parser = argparse.ArgumentParser(description="Diverge Automated Ingestion Pipeline Scheduler")
    parser.add_argument("--hours", type=int, default=4, help="Interval in hours between runs (default: 4)")
    parser.add_argument("--run-now", action="store_true", help="Trigger an immediate pipeline run upon startup")
    parser.add_argument("--test-single-run", action="store_true", help="Run once for verification then exit")
    args = parser.parse_args()

    if args.test_single_run:
        logger.info("Running single verification pass...")
        run_pipeline_job()
        return

    scheduler = start_scheduler(interval_hours=args.hours, run_now=args.run_now)
    try:
        while True:
            time.sleep(1)
    except (KeyboardInterrupt, SystemExit):
        logger.info("Shutting down scheduler...")
        scheduler.shutdown()


if __name__ == "__main__":
    main()
