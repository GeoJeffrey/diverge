"""
narrative_reproduction.py

Narrative Reproduction Number (Rn), the "Contagion Core" index.

Treats each account's *first* mention of a ticker as a new "infection" and estimates
the time-varying reproduction number with the renewal-equation method of
Cori et al. (2013, Am. J. Epidemiology), the same estimator used by EpiEstim:

    I_t      ~ Poisson(R * Lambda_t)
    Lambda_t = sum_{s>=1} I_{t-s} * w_s            (w = discretised serial interval)
    R | data ~ Gamma(a + sum I_t, 1 / (1/b + sum Lambda_t))   over the last `tau` days

Rn > 1: the narrative is recruiting new posters faster than it loses them (spreading).
Rn < 1: the narrative is dying out.

Assumptions (documented, tunable): serial interval ~ Gamma(mean=1.5 days, sd=1.0 day),
Gamma(1, 5) prior, 7-day estimation window. Calendar days without first mentions count
as zero onsets.

GUARD: needs >= MIN_DISTINCT_DAYS days of history and >= MIN_TOTAL_ONSETS onsets,
otherwise returns (None, 0.0). No heuristic estimate is substituted.
"""

from datetime import date, timedelta
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import numpy as np
from scipy import stats

from .. import config, storage, utils

logger = utils.setup_logger("rn_index")

MIN_DISTINCT_DAYS = 7
MIN_TOTAL_ONSETS = 10
SERIAL_INTERVAL_MEAN = 1.5
SERIAL_INTERVAL_SD = 1.0
MAX_SERIAL_INTERVAL = 7
PRIOR_SHAPE = 1.0
PRIOR_SCALE = 5.0
ESTIMATION_WINDOW = 7


def serial_interval_weights(
    mean: float = SERIAL_INTERVAL_MEAN, sd: float = SERIAL_INTERVAL_SD, max_days: int = MAX_SERIAL_INTERVAL
) -> np.ndarray:
    """Discretised gamma serial interval w_1..w_max (w_0 = 0), normalised to sum to 1."""
    shape = (mean / sd) ** 2
    scale = sd**2 / mean
    edges = np.arange(0, max_days + 1) + 0.5
    edges[0] = 0.0
    w = np.diff(stats.gamma.cdf(edges, a=shape, scale=scale))
    return w / w.sum()


def estimate_rn_posterior(
    daily_onsets: List[int],
    tau: int = ESTIMATION_WINDOW,
    min_days: int = MIN_DISTINCT_DAYS,
) -> Optional[Dict[str, float]]:
    """
    Posterior of R over the last `tau` days of a daily onset series.
    Returns {"mean", "lower", "upper", "cv"} (95% credible interval) or None when the guard fails.
    """
    onsets = np.asarray(daily_onsets, dtype=float)
    if len(onsets) < min_days or onsets.sum() < MIN_TOTAL_ONSETS:
        logger.info(
            f"Rn guard: {len(onsets)} days / {int(onsets.sum())} onsets "
            f"(need >= {min_days} days and >= {MIN_TOTAL_ONSETS} onsets). Returning None."
        )
        return None

    w = serial_interval_weights()
    # Lambda_t = sum_{s=1}^{S} I_{t-s} w_s
    lam = np.array(
        [sum(onsets[t - s] * w[s - 1] for s in range(1, len(w) + 1) if t - s >= 0) for t in range(len(onsets))]
    )
    window = slice(max(1, len(onsets) - tau), len(onsets))
    sum_i, sum_lam = float(onsets[window].sum()), float(lam[window].sum())
    if sum_lam <= 0:
        return None

    shape_post = PRIOR_SHAPE + sum_i
    scale_post = 1.0 / (1.0 / PRIOR_SCALE + sum_lam)
    mean = shape_post * scale_post
    lower, upper = stats.gamma.ppf([0.025, 0.975], a=shape_post, scale=scale_post)
    return {
        "mean": round(float(mean), 4),
        "lower": round(float(lower), 4),
        "upper": round(float(upper), 4),
        "cv": round(float(1.0 / np.sqrt(shape_post)), 4),
    }


def compute_rn_from_onset_counts(
    daily_onsets: List[int],
    min_days: int = MIN_DISTINCT_DAYS,
) -> Tuple[Optional[float], Optional[float]]:
    """
    Returns (Rn posterior mean, confidence) where confidence = 1 / (1 + posterior CV),
    so narrow credible intervals (lots of data) approach 1.0. (None, 0.0) if the guard fails.
    """
    post = estimate_rn_posterior(daily_onsets, min_days=min_days)
    if post is None:
        return (None, 0.0)
    return (post["mean"], round(1.0 / (1.0 + post["cv"]), 4))


def daily_onset_series(rows: List[Dict]) -> List[int]:
    """Dense per-calendar-day count of first mentions (missing days filled with 0)."""
    counts: Dict[date, int] = {}
    for r in rows:
        if r.get("is_first_mention") == 1:
            try:
                d = date.fromisoformat(str(r.get("timestamp_utc", ""))[:10])
            except ValueError:
                continue
            counts[d] = counts.get(d, 0) + 1
    if not counts:
        return []
    first, last = min(counts), max(counts)
    return [counts.get(first + timedelta(days=i), 0) for i in range((last - first).days + 1)]


def compute_rn(
    ticker: str,
    window_start_utc: Optional[str] = None,
    window_end_utc: Optional[str] = None,
    db_path: Path = config.DB_PATH,
) -> Tuple[Optional[float], Optional[float]]:
    """Fetch post_timing rows for a ticker and return (Rn, confidence), or (None, 0.0)."""
    rows = storage.get_post_timing_for_ticker(
        ticker=ticker,
        start_utc=window_start_utc,
        end_utc=window_end_utc,
        db_path=db_path,
    )
    if not rows:
        logger.info(f"No post_timing rows for ticker {ticker} -> Rn is (None, 0.0).")
        return (None, 0.0)
    return compute_rn_from_onset_counts(daily_onset_series(rows))
