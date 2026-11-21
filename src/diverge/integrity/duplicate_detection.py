"""
duplicate_detection.py

Near-duplicate post detection for the integrity layer.
For each (ticker, window):
  - Finds post pairs whose word-bigram Jaccard similarity >= threshold, using MinHash + LSH
    candidate generation (see minhash_lsh.py) followed by exact verification.
  - Only pairs posted by DIFFERENT accounts count (one account repeating itself is spam,
    not coordination).
  - duplicate_ratio = posts involved in >= 1 cross-account near-duplicate pair / total posts.
  - Pairs are stored in duplicate_pairs for lineage tracing (explainability layer).
"""

from pathlib import Path
from typing import Any, Dict, List, Optional

from .. import config, storage, utils
from .minhash_lsh import near_duplicate_pairs

logger = utils.setup_logger("duplicate_detection")

DEFAULT_THRESHOLD = 0.8


def compute_duplicate_ratio(
    posts: List[Dict[str, Any]],
    similarity_threshold: float = DEFAULT_THRESHOLD,
    ticker: str = "",
    window_start_utc: str = "",
    db_path: Optional[Path] = None,
) -> float:
    """
    Compute duplicate_ratio for a list of post dicts with 'post_id', 'account_id', 'raw_text'.
    Returns a ratio in [0.0, 1.0]. Writes duplicate pairs to storage when ticker/window are given.
    """
    total_posts = len(posts)
    if total_posts <= 1:
        return 0.0

    usable = [p for p in posts if p.get("raw_text")]
    if len(usable) <= 1:
        return 0.0

    duplicate_post_ids = set()
    pair_rows: List[Dict[str, Any]] = []
    for i, j, sim in near_duplicate_pairs([p["raw_text"] for p in usable], threshold=similarity_threshold):
        a, b = usable[i], usable[j]
        acc_a, acc_b = a.get("account_id", ""), b.get("account_id", "")
        if not (acc_a and acc_b and acc_a != acc_b):
            continue
        duplicate_post_ids.update((a.get("post_id", ""), b.get("post_id", "")))
        if ticker and window_start_utc:
            pair_rows.append({
                "ticker": ticker,
                "window_start_utc": window_start_utc,
                "post_id_a": a.get("post_id", ""),
                "post_id_b": b.get("post_id", ""),
                "similarity": sim,
            })

    if pair_rows and ticker and window_start_utc:
        storage.insert_duplicate_pairs(pair_rows, db_path=db_path if db_path else config.DB_PATH)

    return round(len(duplicate_post_ids) / total_posts, 4)
