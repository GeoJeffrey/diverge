"""
features.py

Daily narrative + price features per (ticker, trading day).

This is the single implementation used by BOTH the research backtest / model training
(diverge.evaluation) and live prediction (diverge.outlook.run_outlook), so the model is served
on exactly the features it was trained on.
"""

from typing import List

import numpy as np
import pandas as pd

from ..features.text_features import detect_capitulation
from ..indices.narrative_reproduction import estimate_rn_posterior
from ..integrity.minhash_lsh import near_duplicate_pairs

PRICE_FEATURES = ["abs_ret", "abs_ret_5", "abs_ret_22", "mkt_abs_ret", "ret", "ret_5"]
NARRATIVE_FEATURES = [
    "log_volume", "volume_z", "mean_sentiment", "bull_share", "sentiment_z", "disagreement",
    "new_author_share", "rn", "capitulation_share", "duplicate_share", "engagement", "divergence",
]



def _to_trading_day(dates: pd.Series, trading_days: pd.DatetimeIndex) -> pd.Series:
    """Map each calendar date to the latest trading day <= date (weekend posts roll back to Friday;
    they are still published before the Friday->Monday return is realised, so there is no look-ahead)."""
    pos = trading_days.searchsorted(dates.values, side="right") - 1
    out = pd.Series(pd.NaT, index=dates.index)
    ok = pos >= 0
    out[ok] = trading_days[pos[ok]]
    return out


def _duplicate_share(group: pd.DataFrame, max_posts: int = 3000) -> float:
    g = group.iloc[:max_posts]
    if len(g) < 2:
        return 0.0
    texts, authors = g["text"].tolist(), g["author"].tolist()
    flagged = set()
    for i, j, _ in near_duplicate_pairs(texts, threshold=0.8):
        if authors[i] != authors[j]:
            flagged.update((i, j))
    return len(flagged) / len(g)


def rolling_rn(onsets: pd.Series, history: int = 28) -> pd.Series:
    vals = onsets.to_numpy()
    out = np.full(len(vals), np.nan)
    for t in range(len(vals)):
        post = estimate_rn_posterior(list(vals[max(0, t - history + 1) : t + 1]))
        if post:
            out[t] = post["mean"]
    return pd.Series(out, index=onsets.index)


def build_daily_features(
    posts: pd.DataFrame, prices: pd.DataFrame, with_duplicates: bool = True, require_targets: bool = True
) -> pd.DataFrame:
    """
    posts:  ticker, author, date (naive UTC day), text, engagement, sentiment in [-1, 1].
    prices: daily closes, one column per ticker plus 'MKT' (market index), trading-day index.
    Returns one row per (ticker, trading day). Every feature on day t uses only information
    available by the close of day t. Targets (y_*) look one trading day ahead.
    require_targets=False keeps the most recent day (no next-day return yet) for live prediction.
    """
    trading_days = prices.index
    posts = posts.copy()
    posts["day"] = _to_trading_day(posts["date"], trading_days)
    posts = posts.dropna(subset=["day"])
    posts["cap"] = [detect_capitulation(t)[0] for t in posts["text"]]

    # first-ever post by an author about a ticker = an "onset" (calendar-day resolution)
    first = posts.groupby(["ticker", "author"])["date"].transform("min")
    posts["is_onset"] = (posts["date"] == first).astype(int)

    g = posts.groupby(["ticker", "day"])
    daily = pd.DataFrame({
        "n": g.size(),
        "mean_sentiment": g["sentiment"].mean(),
        "bull": g["sentiment"].apply(lambda s: (s > 0).sum()),
        "bear": g["sentiment"].apply(lambda s: (s < 0).sum()),
        "new_author_share": g["is_onset"].mean(),
        "capitulation_share": g["cap"].mean(),
        "engagement": np.log1p(g["engagement"].mean()),
    })
    daily["bull_share"] = daily["bull"] / daily["n"]
    bs = daily["bull"] + daily["bear"]
    daily["disagreement"] = np.sqrt(1 - ((daily["bull"] - daily["bear"]) / bs.replace(0, np.nan)) ** 2).fillna(0.0)
    daily["log_volume"] = np.log1p(daily["n"])
    if with_duplicates:
        daily["duplicate_share"] = g[["text", "author"]].apply(_duplicate_share)
    else:
        daily["duplicate_share"] = 0.0

    frames = []
    for ticker, d in daily.groupby(level="ticker"):
        if ticker not in prices.columns:
            continue
        d = d.droplevel("ticker").reindex(trading_days)
        d["n"] = d["n"].fillna(0)
        d["log_volume"] = d["log_volume"].fillna(0.0)
        for col in ["mean_sentiment", "bull_share", "disagreement", "new_author_share",
                    "capitulation_share", "duplicate_share", "engagement"]:
            d[col] = d[col].fillna(0.0)

        # contagion: Rn over calendar-day onset counts
        onsets = posts[posts["ticker"] == ticker].groupby("date")["is_onset"].sum()
        onsets = onsets.reindex(pd.date_range(onsets.index.min(), onsets.index.max()), fill_value=0)
        rn = rolling_rn(onsets)
        d["rn"] = rn.reindex(trading_days, method="ffill").fillna(1.0).clip(0, 5)

        # price features (past and present only) and targets (future)
        px = prices[ticker]
        ret = np.log(px).diff()
        mkt = np.log(prices["MKT"]).diff()
        d["ret"], d["abs_ret"] = ret, ret.abs()
        d["ret_5"] = ret.rolling(5).sum()
        d["abs_ret_5"] = ret.abs().rolling(5).mean()
        d["abs_ret_22"] = ret.abs().rolling(22).mean()
        d["mkt_abs_ret"] = mkt.abs()

        roll = lambda s: (s - s.rolling(20, min_periods=10).mean()) / s.rolling(20, min_periods=10).std()
        d["volume_z"] = roll(d["log_volume"])
        d["sentiment_z"] = roll(d["mean_sentiment"])
        d["divergence"] = d["sentiment_z"] - roll(ret)

        d["y_ret_next"] = ret.shift(-1)
        d["y_abs_next"] = ret.shift(-1).abs()
        d["y_excess_next"] = (ret - mkt).shift(-1)
        d["ticker"] = ticker
        frames.append(d)

    if not frames:
        return pd.DataFrame(columns=["day", "ticker"] + PRICE_FEATURES + NARRATIVE_FEATURES)
    out = pd.concat(frames).rename_axis("day").reset_index()
    out = out.replace([np.inf, -np.inf], np.nan)
    needed = PRICE_FEATURES + ["volume_z", "sentiment_z", "divergence"]
    if require_targets:
        needed += ["y_ret_next", "y_abs_next", "y_excess_next"]
    return out.dropna(subset=needed)


