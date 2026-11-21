"""
seed_production.py

Copies ticker_window_metrics (and related tables) from local SQLite
into the production PostgreSQL database via SQLAlchemy.

Usage:
  # Set DATABASE_URL to Railway Postgres, then:
  python seed_production.py
  
  # Or via Railway CLI:
  railway run python seed_production.py
"""

import os
import sqlite3
import sys
from pathlib import Path

# Ensure src/ is importable
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

# Credentials are never hard-coded: DATABASE_URL must come from the environment
# (e.g. `railway run python seed_production.py`).
if not os.environ.get("DATABASE_URL"):
    sys.exit("ERROR: set DATABASE_URL to the target PostgreSQL instance first.")

from diverge.db.base import SessionLocal, engine
from diverge.db.models import (
    RawPost, PostTiming, TickerTimeBin, TextFeature,
    PeriodicityStat, IndexValue, ConsumerSentiment,
    CoordinationScore, TickerWindowMetric, ReasoningTrace,
    DuplicatePair, NarrativePhylogeny,
)
from diverge.db.base import Base

LOCAL_DB = Path(__file__).resolve().parent.parent / "data" / "diverge_raw.db"

# Tables to seed, in dependency order
TABLES = [
    ("raw_posts", RawPost),
    ("post_timing", PostTiming),
    ("ticker_time_bins", TickerTimeBin),
    ("text_features", TextFeature),
    ("periodicity_stats", PeriodicityStat),
    ("index_values", IndexValue),
    ("consumer_sentiment", ConsumerSentiment),
    ("coordination_scores", CoordinationScore),
    ("ticker_window_metrics", TickerWindowMetric),
    ("reasoning_trace", ReasoningTrace),
    ("duplicate_pairs", DuplicatePair),
    ("narrative_phylogeny", NarrativePhylogeny),
]


def seed():
    if not LOCAL_DB.exists():
        print(f"ERROR: Local SQLite DB not found at {LOCAL_DB}")
        sys.exit(1)

    conn = sqlite3.connect(str(LOCAL_DB))
    conn.row_factory = sqlite3.Row

    db = SessionLocal()
    total = 0

    for table_name, Model in TABLES:
        try:
            rows = conn.execute(f"SELECT * FROM {table_name}").fetchall()
        except Exception:
            print(f"  SKIP {table_name} (not in SQLite)")
            continue

        if not rows:
            print(f"  SKIP {table_name} (0 rows)")
            continue

        # Get column names from model
        model_cols = {c.name for c in Model.__table__.columns}
        inserted = 0

        for row in rows:
            row_dict = {k: row[k] for k in row.keys() if k in model_cols}
            try:
                db.merge(Model(**row_dict))
                inserted += 1
            except Exception as e:
                # Skip rows that fail (e.g. FK violations during partial seed)
                pass

        db.commit()
        total += inserted
        print(f"  {table_name}: {inserted}/{len(rows)} rows seeded")

    db.close()
    conn.close()
    print(f"\nDone. Total rows seeded: {total}")


if __name__ == "__main__":
    print(f"Seeding from: {LOCAL_DB}")
    print(f"Into DB engine: {engine.url}")
    print()
    seed()
