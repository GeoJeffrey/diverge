"""
run_outlook.py

Pipeline phase 7: compute the next-day outlook for every tracked ticker and store it in
ticker_outlook. Uses exactly the training feature code (outlook.features) and the trained
linear models (outlook_model.json).

A ticker gets available = 0 (with a reason the dashboard shows) when:
  - the model has not been trained yet,
  - prices could not be fetched,
  - there is not enough history (rolling z-scores need ~10 trading days),
  - there were no social posts in the last 3 trading days.
"""

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

import pandas as pd

from .. import config, storage, utils
from . import prices as price_source
from .features import build_daily_features
from .model import load_model, missing_features, predict

logger = utils.setup_logger("outlook")

SIGN = {"bullish": 1.0, "bearish": -1.0, "neutral": 0.0}
RECENT_DAYS = 3


def posts_frame(rows: List[Dict[str, Any]]) -> pd.DataFrame:
    if not rows:
        return pd.DataFrame(columns=["ticker", "author", "date", "text", "engagement", "sentiment"])
    df = pd.DataFrame(rows)
    return pd.DataFrame({
        "ticker": df["ticker"],
        "author": df["account_id"].fillna("unknown").astype(str),
        "date": pd.to_datetime(df["timestamp_utc"], utc=True, errors="coerce").dt.tz_localize(None).dt.normalize(),
        "text": df["raw_text"].fillna("").astype(str),
        "engagement": 0,
        # discrete labels, matching how the training data was scored
        "sentiment": df["sentiment_label"].map(SIGN).fillna(0.0),
    }).dropna(subset=["date"])


def outlook_rows(
    posts: pd.DataFrame,
    closes: pd.DataFrame,
    tickers: List[str],
    spec: Optional[Dict[str, Any]],
    flags: Dict[str, str],
    now_iso: str,
) -> List[Dict[str, Any]]:
    """Pure function: one ticker_outlook row per ticker."""
    def unavailable(t: str, note: str, day: str = "") -> Dict[str, Any]:
        return {"ticker": t, "as_of_day": day or now_iso[:10], "available": 0, "coverage_note": note,
                "payload": None, "model_version": spec.get("version") if spec else None, "generated_at": now_iso}

    if spec is None:
        return [unavailable(t, "The outlook model has not been trained yet.") for t in tickers]
    if closes.empty:
        return [unavailable(t, "Price data could not be fetched for this run.") for t in tickers]

    live = build_daily_features(posts[posts["ticker"].isin(tickers)], closes, require_targets=False)
    rows = []
    for t in tickers:
        hist = live[live["ticker"] == t].sort_values("day")
        if t not in closes.columns or closes[t].dropna().empty:
            rows.append(unavailable(t, "No price history found for this ticker."))
            continue
        last_trading_day = closes[t].dropna().index.max()
        if hist.empty or hist["day"].max() < last_trading_day:
            rows.append(unavailable(t, "Needs about 2 weeks of post history before an outlook can be made.",
                                    str(last_trading_day.date())))
            continue
        if hist.tail(RECENT_DAYS)["n"].sum() == 0:
            rows.append(unavailable(t, f"No social posts in the last {RECENT_DAYS} trading days.",
                                    str(last_trading_day.date())))
            continue
        latest = hist.iloc[-1].to_dict()
        missing = missing_features(spec, latest)
        if missing:
            rows.append(unavailable(t, f"Missing inputs: {', '.join(missing)}.", str(last_trading_day.date())))
            continue
        payload = predict(spec, latest, flags.get(t))
        payload["posts_today"] = int(latest["n"])
        rows.append({"ticker": t, "as_of_day": str(latest["day"].date()), "available": 1, "coverage_note": None,
                     "payload": json.dumps(payload), "model_version": spec.get("version"), "generated_at": now_iso})
    return rows


def run(db_path: Path = config.DB_PATH) -> int:
    spec = load_model()
    tickers = list(config.TICKERS.keys())
    now_iso = datetime.now(timezone.utc).isoformat(timespec="seconds")
    posts = posts_frame(storage.get_social_posts_with_sentiment(db_path=db_path))
    flags = storage.get_latest_confidence_flags(db_path=db_path)

    rows: List[Dict[str, Any]] = []
    for market, group in price_source.group_by_market(tickers).items():
        closes = price_source.fetch_closes(group, market) if spec else pd.DataFrame()
        rows += outlook_rows(posts, closes, group, spec, flags, now_iso)

    written = storage.insert_outlooks(rows, db_path=db_path)
    ok = sum(r["available"] for r in rows)
    logger.info(f"Outlook: {ok}/{len(rows)} tickers available, {written} rows written.")
    return written


if __name__ == "__main__":
    run()
