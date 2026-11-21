"""
run_all.py

Master Orchestrator for Diverge Pipeline (Phase 1 + Phase 2 + Phase 3).
Executes all three phases end-to-end in required order:
  1. Phase 1: Scraper data collection (Reddit, StockTwits, Telegram, RSS, Google Trends)
  2. Phase 2: Feature extraction (post_timing, ticker_time_bins, periodicity_stats, text_features)
  3. Phase 3: Financial indices calculation (CLI, VDI, CASSI, Rn, CIRG)

Includes:
  - Error isolation & data dependency checks before each phase.
  - CLI flag --skip-scrape to run Phase 2+3 only against existing database records.
  - Single combined summary table at the end (Phase 1 platforms, Phase 2 tables, Phase 3 index values).
"""

import argparse
import sys
from pathlib import Path

from diverge import config, storage, utils
from diverge.pipeline import run_full_pipeline

logger = utils.setup_logger("run_all_master")


def main():
    parser = argparse.ArgumentParser(description="Run the full Diverge pipeline once (phases 1-8).")
    parser.add_argument("--skip-scrape", action="store_true", help="Reuse existing posts; skip ingestion.")
    args = parser.parse_args()

    status = run_full_pipeline(skip_scrape=args.skip_scrape)
    print_master_summary(config.DB_PATH)
    print("PHASE STATUS")
    for phase, result in status.items():
        print(f"  {phase:<18} {result}")
    if any(v.startswith("failed") for v in status.values()):
        sys.exit(1)


def print_master_summary(db_path: Path):
    """Print single unified summary report across all 6 phases."""
    print("\n" + "=" * 70)
    print("DIVERGE MASTER PIPELINE — COMBINED SUMMARY REPORT")
    print("=" * 70)

    # 1. Phase 1 Summary
    platform_counts = storage.count_by_platform(db_path=db_path)
    print("\n1. PHASE 1: RAW POSTS BY PLATFORM")
    print("-" * 40)
    if not platform_counts:
        print("  No records found.")
    else:
        for p, count in sorted(platform_counts.items()):
            print(f"  {p:<25} {count:>8,} rows")

    # 2. Phase 2 Summary
    all_table_counts = storage.count_all_tables(db_path=db_path)
    phase2_tables = ["post_timing", "ticker_time_bins", "text_features", "periodicity_stats"]
    print("\n2. PHASE 2: FEATURE EXTRACTION TABLES")
    print("-" * 40)
    for t in phase2_tables:
        print(f"  {t:<25} {all_table_counts.get(t, 0):>8,} rows")

    # 3. Phase 3-6 Summary
    print("\n3. PHASE 3 - 6: INDICES, INTEGRITY, COMPOSITE & EXPLAINABILITY STORAGE")
    print("-" * 40)
    print(f"  consumer_sentiment       {all_table_counts.get('consumer_sentiment', 0):>8,} rows")
    print(f"  index_values             {all_table_counts.get('index_values', 0):>8,} rows")
    print(f"  coordination_scores      {all_table_counts.get('coordination_scores', 0):>8,} rows")
    print(f"  ticker_window_metrics    {all_table_counts.get('ticker_window_metrics', 0):>8,} rows")
    print(f"  duplicate_pairs          {all_table_counts.get('duplicate_pairs', 0):>8,} rows")
    print(f"  reasoning_trace          {all_table_counts.get('reasoning_trace', 0):>8,} rows")
    print(f"  narrative_phylogeny      {all_table_counts.get('narrative_phylogeny', 0):>8,} rows")
    print(f"  ticker_outlook           {all_table_counts.get('ticker_outlook', 0):>8,} rows")
    print("=" * 70)
    print("\nData pipeline complete. Run python run_server.py to view results.\n")


if __name__ == "__main__":
    main()

