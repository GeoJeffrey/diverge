"""
cassi_index.py

Cross-Asset Sentiment Spillover Index (CASSI) calculation.
Pulls daily average sentiment per ticker via storage.get_multi_ticker_sentiment_series().
Fits statsmodels.tsa.api.VAR across all tracked tickers.
Uses forecast-error variance decomposition (.fevd()) to measure the fraction of ticker i's
sentiment variance attributable to shocks from other tickers j != i.

GUARD: Requires >= 30 daily points across >= 2 tickers, else returns None.
"""

from pathlib import Path
from typing import Dict, List, Optional, Tuple

import numpy as np
import pandas as pd

from .. import config, storage, utils

logger = utils.setup_logger("cassi_index")

MIN_DAILY_POINTS = 30
MIN_TICKERS = 2


def compute_cassi_from_dataframe(df_sentiment: pd.DataFrame, max_lags: int = 2) -> Dict[str, Optional[float]]:
    """
    Compute CASSI for each column (ticker) in a daily sentiment DataFrame.
    df_sentiment: DataFrame indexed by date, columns = tickers, values = float daily avg sentiment.

    CASSI_i = share of ticker i's 5-step-ahead forecast-error variance explained by shocks to
    *other* tickers (Diebold-Yilmaz style spillover from a VAR's FEVD).

    Missing days are forward-filled for at most 2 days; remaining gaps are dropped, never zero-filled.
    Returns None for every ticker the VAR could not be estimated for -- no synthetic fallback values.
    """
    tickers = list(df_sentiment.columns)
    results: Dict[str, Optional[float]] = {t: None for t in tickers}

    if len(tickers) < MIN_TICKERS:
        logger.info(f"CASSI guard: only {len(tickers)} tickers (< {MIN_TICKERS}). Returning None.")
        return results

    # Keep only tickers with real variation, then only days where all of them have data.
    clean_df = df_sentiment.ffill(limit=2)
    variances = clean_df.var()
    usable = [c for c in tickers if pd.notna(variances.get(c)) and variances[c] > 1e-5]
    clean_df = clean_df[usable].dropna()

    if len(usable) < MIN_TICKERS or len(clean_df) < MIN_DAILY_POINTS:
        logger.info(
            f"CASSI guard: {len(usable)} usable tickers, {len(clean_df)} complete days "
            f"(need >= {MIN_TICKERS} and >= {MIN_DAILY_POINTS}). Returning None."
        )
        return results

    try:
        from statsmodels.tsa.api import VAR  # heavy import, only needed here

        lags = min(max_lags, max(1, len(clean_df) // 10))
        fitted = VAR(clean_df).fit(maxlags=lags)
        decomp = fitted.fevd(periods=5).decomp  # shape: (n_eq, periods, n_eq)
        for idx, col in enumerate(usable):
            shares = decomp[idx, -1, :]
            total = float(np.sum(shares))
            if total > 0:
                results[col] = round(float((total - shares[idx]) / total), 4)
    except Exception as e:  # singular matrix, too few obs for lag order, etc.
        logger.warning(f"VAR estimation failed for CASSI ({e}); returning None rather than a proxy.")

    return results


def compute_cassi(
    tickers: Optional[List[str]] = None,
    window_start_utc: Optional[str] = None,
    window_end_utc: Optional[str] = None,
    db_path: Path = config.DB_PATH,
) -> Dict[str, Optional[float]]:
    """
    Fetch sentiment series for tickers from DB, construct daily matrix, and compute CASSI.
    """
    if tickers is None:
        tickers = list(config.TICKERS.keys())

    raw_series = storage.get_multi_ticker_sentiment_series(
        tickers=tickers,
        start_utc=window_start_utc,
        end_utc=window_end_utc,
        db_path=db_path,
    )

    if not raw_series:
        logger.info("No sentiment data returned from DB for CASSI calculation.")
        return {t: None for t in tickers}

    # Reconstruct combined DataFrame
    all_dates = sorted(list(set(d for series in raw_series.values() for d, _ in series)))
    if len(all_dates) < MIN_DAILY_POINTS:
        logger.info(f"Insufficient total dates ({len(all_dates)} < {MIN_DAILY_POINTS}). CASSI returning None.")
        return {t: None for t in tickers}

    df = pd.DataFrame(index=all_dates)
    for t in tickers:
        series_dict = dict(raw_series.get(t, []))
        df[t] = [series_dict.get(d, np.nan) for d in all_dates]

    return compute_cassi_from_dataframe(df)

