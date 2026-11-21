"""
cli_index.py

Capitulation Leak Index (CLI) calculation.
CLI = (posts where capitulation_flag = 1) / (total posts mentioning ticker in window).

Returns None (null) on empty window / zero post volume, logged gracefully.
"""

from pathlib import Path
from typing import Any, Dict, List, Optional

from .. import config, storage, utils

logger = utils.setup_logger("cli_index")


def compute_cli_for_posts(posts: List[Dict[str, Any]]) -> Optional[float]:
    """
    CLI = share of posts in the window flagged as capitulation language.
    Returns a ratio in [0.0, 1.0] (0.0 is a real observation, not missing data),
    or None when the window has no posts.
    """
    if not posts:
        logger.info("CLI window has 0 posts -> None.")
        return None
    cap_count = sum(1 for p in posts if p.get("capitulation_flag") == 1)
    return round(cap_count / len(posts), 4)


def compute_cli(
    ticker: str,
    window_start_utc: Optional[str] = None,
    window_end_utc: Optional[str] = None,
    db_path: Path = config.DB_PATH,
) -> Optional[float]:
    """
    Fetch text features from DB for (ticker, window) and return computed CLI value.
    """
    posts = storage.get_text_features_for_window(
        ticker=ticker,
        start_utc=window_start_utc,
        end_utc=window_end_utc,
        db_path=db_path,
    )
    if not posts:
        logger.info(f"No posts found for ticker {ticker} in window -> CLI is None.")
        return None

    return compute_cli_for_posts(posts)

