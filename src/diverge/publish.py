"""
publish.py

Final pipeline phase: copy freshly computed rows from the pipeline's working SQLite store
into the serving database the API reads (DATABASE_URL, PostgreSQL in production).

The pipeline needs a local store with full history (rolling statistics, first-mention onsets),
while the API needs a shared, concurrent database. This step connects the two; previously
results only reached production through a manual seeding script.

Incremental by default: only rows created or recomputed in the last `lookback_days`
(covers missed runs). `--full` backfills everything.

    python -m diverge.publish            # incremental
    python -m diverge.publish --full     # first deployment / backfill
"""

import argparse
import os
import sqlite3
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Dict, List, Optional

from . import config, utils

logger = utils.setup_logger("publish")

# (table, timestamp column used for incremental selection). Order respects foreign keys.
TABLES = [
    ("raw_posts", "scraped_at"),
    ("text_features", "computed_at"),
    ("coordination_scores", "computed_at"),
    ("ticker_window_metrics", "computed_at"),
    ("narrative_phylogeny", "computed_at"),
    ("reasoning_trace", "created_at"),
    ("ticker_outlook", "generated_at"),
]
BATCH = 500


def serving_url() -> Optional[str]:
    """DATABASE_URL if it points somewhere other than the pipeline's own SQLite file."""
    url = os.getenv("DATABASE_URL")
    if not url or (url.startswith("sqlite") and Path(url.split("///", 1)[-1]).resolve() == config.DB_PATH.resolve()):
        return None
    return url


def _rows(conn: sqlite3.Connection, table: str, ts_col: str, since: Optional[str]) -> List[Dict]:
    conn.row_factory = sqlite3.Row
    sql = f"SELECT * FROM {table}" + (f" WHERE {ts_col} >= ?" if since else "")
    return [dict(r) for r in conn.execute(sql, (since,) if since else ())]


def publish(db_path: Path = config.DB_PATH, lookback_days: int = 3, full: bool = False) -> Dict[str, int]:
    if serving_url() is None:
        logger.info("Publish skipped: DATABASE_URL is unset or is the pipeline's own SQLite store.")
        return {}

    from sqlalchemy.dialects import postgresql, sqlite as sqlite_dialect

    from .db.base import Base, engine
    from .db import models  # noqa: F401  (registers tables)

    since = None if full else (datetime.now(timezone.utc) - timedelta(days=lookback_days)).isoformat()
    insert_fn = postgresql.insert if engine.dialect.name == "postgresql" else sqlite_dialect.insert
    counts: Dict[str, int] = {}
    src = sqlite3.connect(db_path)
    try:
        with engine.begin() as dst:
            for table, ts_col in TABLES:
                target = Base.metadata.tables[table]
                cols = {c.name for c in target.columns}
                pk = [c.name for c in target.primary_key.columns]
                rows = [{k: v for k, v in r.items() if k in cols} for r in _rows(src, table, ts_col, since)]
                for i in range(0, len(rows), BATCH):
                    chunk = rows[i : i + BATCH]
                    stmt = insert_fn(target).values(chunk)
                    update = {c: stmt.excluded[c] for c in chunk[0] if c not in pk}
                    stmt = stmt.on_conflict_do_update(index_elements=pk, set_=update) if update else stmt.on_conflict_do_nothing()
                    dst.execute(stmt)
                counts[table] = len(rows)
    finally:
        src.close()
    logger.info(f"Published to serving database: {counts}")
    return counts


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--full", action="store_true")
    ap.add_argument("--lookback-days", type=int, default=3)
    a = ap.parse_args()
    publish(lookback_days=a.lookback_days, full=a.full)
