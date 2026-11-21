"""
pull_serving.py

Copy the posts the deployed worker has collected (the serving database, DATABASE_URL) into a local
SQLite snapshot, so the real-world bot-detector check can be run on them:

    $env:DATABASE_URL = "<serving database URL>"       # set in your own terminal only
    python -m diverge.pull_serving                       # -> data/serving_snapshot.db
    Remove-Item Env:DATABASE_URL
    python -m diverge.evaluation.label_windows --db data/serving_snapshot.db

Read-only on the serving database. The snapshot is a separate file under data/ (gitignored), so the
local pipeline's own store is never touched. The connection string is never printed or written.
"""

import argparse
import os
import sys
from pathlib import Path
from typing import Dict, Optional

from . import config, storage, utils

logger = utils.setup_logger("pull_serving")

DEFAULT_SNAPSHOT = config.BASE_DIR / "data" / "serving_snapshot.db"
COLUMNS = ["post_id", "account_id", "timestamp_utc", "community", "ticker", "raw_text", "upvotes", "platform", "scraped_at"]
BATCH = 2000


def pull(source_url: str, snapshot: Path = DEFAULT_SNAPSHOT) -> Dict[str, int]:
    """Copy raw_posts from the serving database into the snapshot (upsert). Returns simple counts."""
    from sqlalchemy import create_engine, text

    if source_url.startswith("postgresql://"):
        source_url = source_url.replace("postgresql://", "postgresql+psycopg2://", 1)
    engine = create_engine(source_url)
    snapshot.parent.mkdir(parents=True, exist_ok=True)
    dst = storage.get_connection(snapshot)  # creates the pipeline schema if the file is new
    copied = 0
    try:
        with engine.connect() as src:
            result = src.execution_options(stream_results=True).execute(text(f"SELECT {', '.join(COLUMNS)} FROM raw_posts"))
            while True:
                rows = result.fetchmany(BATCH)
                if not rows:
                    break
                with dst:
                    dst.executemany(
                        f"INSERT OR REPLACE INTO raw_posts ({', '.join(COLUMNS)}) VALUES ({', '.join('?' * len(COLUMNS))})",
                        [tuple(r) for r in rows],
                    )
                copied += len(rows)
        social = dst.execute(
            "SELECT COUNT(*) FROM raw_posts WHERE ticker IS NOT NULL AND platform NOT IN ('rss_news', 'google_trends')"
        ).fetchone()[0]
    finally:
        dst.close()
        engine.dispose()
    return {"copied": copied, "social_posts_in_snapshot": int(social)}


def main(argv: Optional[list] = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--out", type=Path, default=DEFAULT_SNAPSHOT, help="local SQLite snapshot file (default: data/serving_snapshot.db)")
    a = ap.parse_args(argv)
    url = os.getenv("DATABASE_URL")
    if not url or url.startswith("sqlite"):
        print("Set DATABASE_URL to the serving database (Neon) in this terminal first. It is never written to a file.")
        return 2
    if a.out.resolve() == config.DB_PATH.resolve():
        print("Refusing to overwrite the local pipeline store; choose another --out file.")
        return 2
    counts = pull(url, a.out)
    print(f"Copied {counts['copied']:,} posts into {a.out} ({counts['social_posts_in_snapshot']:,} social posts).")
    print(f"Next: python -m diverge.evaluation.label_windows --db {a.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
