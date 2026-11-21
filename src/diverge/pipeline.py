"""
pipeline.py

The single end-to-end pipeline used by both the CLI (run_all.py) and the scheduled worker
(pipeline_scheduler.py):

  1 ingest -> 2 features -> 3 indices -> 4 integrity -> 5 composite -> 6 explainability
  -> 7 next-day outlook -> 8 publish to the serving database

Each phase is isolated: a failure is logged and recorded, later phases still run on whatever
data exists. Returns a per-phase status dict.
"""

import time
from pathlib import Path
from typing import Callable, Dict

from . import config, storage, utils

logger = utils.setup_logger("pipeline")


def _phases(db_path: Path, skip_scrape: bool) -> Dict[str, Callable[[], object]]:
    from .aggregation import run_phase5
    from .explainability import run_phase6
    from .features import run_phase2
    from .indices import run_phase3
    from .integrity import run_phase4
    from .outlook import run_outlook
    from .publish import publish
    from .scrapers import run_phase1

    phases: Dict[str, Callable[[], object]] = {}
    if not skip_scrape:
        phases["1_ingest"] = run_phase1.run_pipeline
    phases.update({
        "2_features": run_phase2.main,
        "3_indices": lambda: run_phase3.run(db_path=db_path),
        "4_integrity": lambda: run_phase4.run(db_path=db_path),
        "5_composite": lambda: run_phase5.run(db_path=db_path),
        "6_explainability": lambda: run_phase6.run(db_path=db_path),
        "7_outlook": lambda: run_outlook.run(db_path=db_path),
        "8_publish": lambda: publish(db_path=db_path),
    })
    return phases


def run_full_pipeline(skip_scrape: bool = False, db_path: Path = config.DB_PATH) -> Dict[str, str]:
    db_path.parent.mkdir(parents=True, exist_ok=True)
    status: Dict[str, str] = {}
    for name, fn in _phases(db_path, skip_scrape).items():
        if name == "2_features" and sum(storage.count_by_platform(db_path=db_path).values()) == 0:
            logger.warning("raw_posts is empty; stopping before feature extraction.")
            status[name] = "skipped: no posts"
            break
        t0 = time.perf_counter()
        try:
            fn()
            status[name] = f"ok ({time.perf_counter() - t0:.1f}s)"
        except Exception as e:  # isolate phase failures
            logger.error(f"[{name}] failed: {e}", exc_info=True)
            status[name] = f"failed: {e}"
    logger.info(f"Pipeline finished: {status}")
    return status
