"""
train_outlook.py

Trains the models behind the dashboard's "Next-day outlook" and measures their track record.

  1. Build daily features from ~1.7M historical tweets + Yahoo Finance prices
     (same code path the live pipeline uses: diverge.outlook.features).
  2. Walk-forward by year (train on all years before Y, predict Y) to get an honest,
     out-of-sample track record:
       direction  AUC, accuracy vs the "always up" baseline, Brier score, calibration table,
                  accuracy of "lean" / "slight lean" calls and how often they are issued
       move size  out-of-sample R^2 vs a price-only baseline, precision of "larger than usual"
  3. Refit on all data and write src/diverge/outlook/outlook_model.json
     (coefficients + scaler + track record) for the API to serve.

Run:  python -m diverge.evaluation.train_outlook            (after the backtest has cached data)
      python -m diverge.evaluation.train_outlook --sentiment tfidf --limit 300000   (quick)
"""

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

import numpy as np
import pandas as pd

from ..outlook.features import NARRATIVE_FEATURES, PRICE_FEATURES, build_daily_features
from ..outlook.model import LEAN_THRESHOLD, MODEL_PATH, SLIGHT_THRESHOLD
from .report import save_json

# 'engagement' (likes/retweets) is not collected by the live scrapers, so it is excluded to avoid
# train/serve skew.
SERVE_EXCLUDED = {"engagement"}
LARGE_RATIO, SMALL_RATIO = 1.25, 0.8


def _direction_model():
    from sklearn.linear_model import LogisticRegression
    from sklearn.pipeline import make_pipeline
    from sklearn.preprocessing import StandardScaler

    return make_pipeline(StandardScaler(), LogisticRegression(C=0.1, max_iter=2000))


def _move_model():
    from sklearn.linear_model import RidgeCV
    from sklearn.pipeline import make_pipeline
    from sklearn.preprocessing import StandardScaler

    return make_pipeline(StandardScaler(), RidgeCV(alphas=np.logspace(-3, 3, 13)))


def _export(pipe, features: List[str]) -> Dict[str, Any]:
    scaler, est = pipe.steps[0][1], pipe.steps[1][1]
    coef = np.ravel(est.coef_)
    intercept = float(np.ravel(est.intercept_)[0]) if np.ndim(est.intercept_) else float(est.intercept_)
    return {
        "features": features,
        "mean": [round(float(v), 8) for v in scaler.mean_],
        "scale": [round(float(v), 8) for v in scaler.scale_],
        "coef": [round(float(v), 8) for v in coef],
        "intercept": round(intercept, 8),
    }


def walk_forward_predictions(df: pd.DataFrame, features: List[str], min_train_years: int = 2) -> pd.DataFrame:
    years = sorted(df["day"].dt.year.unique())
    out = []
    for y in years[min_train_years:]:
        tr, te = df[df["day"].dt.year < y], df[df["day"].dt.year == y]
        if te.empty:
            continue
        d = _direction_model().fit(tr[features], (tr["y_ret_next"] > 0).astype(int))
        m = _move_model().fit(tr[features], tr["y_abs_next"])
        base = _move_model().fit(tr[PRICE_FEATURES], tr["y_abs_next"])
        out.append(pd.DataFrame({
            "day": te["day"], "ticker": te["ticker"], "y_ret": te["y_ret_next"], "y_abs": te["y_abs_next"],
            "typical": te["abs_ret_22"], "p_up": d.predict_proba(te[features])[:, 1],
            "move": np.maximum(m.predict(te[features]), 0), "move_base": np.maximum(base.predict(te[PRICE_FEATURES]), 0),
        }))
    return pd.concat(out)


def track_record(wf: pd.DataFrame) -> Dict[str, Any]:
    from scipy.stats import spearmanr
    from sklearn.metrics import brier_score_loss, roc_auc_score

    up = (wf["y_ret"] > 0).astype(int).to_numpy()
    p = wf["p_up"].to_numpy()
    edge = np.abs(p - 0.5)
    hit = ((p > 0.5).astype(int) == up)

    def tier(mask):
        return {"share_of_days": round(float(mask.mean()), 4),
                "accuracy": round(float(hit[mask].mean()), 4) if mask.any() else None,
                "days": int(mask.sum())}

    bins = pd.qcut(p, 5, duplicates="drop")
    calib = (pd.DataFrame({"p": p, "up": up, "bin": bins}).groupby("bin", observed=True)
             .agg(mean_predicted=("p", "mean"), actual_up_rate=("up", "mean"), days=("up", "size")))

    y_abs, typical = wf["y_abs"].to_numpy(), wf["typical"].to_numpy()
    sst = ((y_abs - y_abs.mean()) ** 2).sum()
    ratio = wf["move"].to_numpy() / np.where(typical > 0, typical, np.nan)
    large = ratio >= LARGE_RATIO
    actually_large = y_abs > typical

    return {
        "test_period": f"{wf['day'].min().date()} to {wf['day'].max().date()}",
        "test_days": int(len(wf)),
        "tickers": sorted(wf["ticker"].unique().tolist()),
        "direction": {
            "auc": round(float(roc_auc_score(up, p)), 4),
            "accuracy": round(float(hit.mean()), 4),
            "always_up_accuracy": round(float(up.mean()), 4),
            "brier": round(float(brier_score_loss(up, p)), 4),
            "lean_calls": tier(edge >= LEAN_THRESHOLD),
            "slight_calls": tier((edge >= SLIGHT_THRESHOLD) & (edge < LEAN_THRESHOLD)),
            "no_call": tier(edge < SLIGHT_THRESHOLD),
            "calibration": [
                {"mean_predicted": round(float(r.mean_predicted), 4),
                 "actual_up_rate": round(float(r.actual_up_rate), 4), "days": int(r.days)}
                for r in calib.itertuples()
            ],
        },
        "move": {
            "oos_r2": round(1 - float(((y_abs - wf["move"]) ** 2).sum() / sst), 4),
            "oos_r2_price_only": round(1 - float(((y_abs - wf["move_base"]) ** 2).sum() / sst), 4),
            "rank_corr": round(float(spearmanr(wf["move"], y_abs)[0]), 4),
            "larger_than_usual_calls": {
                "share_of_days": round(float(np.nanmean(large)), 4),
                "precision": round(float(actually_large[large].mean()), 4) if large.any() else None,
                "base_rate": round(float(actually_large.mean()), 4),
                "lift": round(float(actually_large[large].mean() / actually_large.mean()), 2)
                if large.any() and actually_large.mean() > 0 else None,
            },
        },
    }


def train(df: pd.DataFrame, source: str, sentiment: str) -> Dict[str, Any]:
    features = [f for f in PRICE_FEATURES + NARRATIVE_FEATURES
                if f not in SERVE_EXCLUDED and f in df.columns and df[f].std() > 0]
    record = track_record(walk_forward_predictions(df, features))
    direction = _direction_model().fit(df[features], (df["y_ret_next"] > 0).astype(int))
    move = _move_model().fit(df[features], df["y_abs_next"])
    return {
        "version": datetime.now(timezone.utc).strftime("%Y%m%d"),
        "trained_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "training_data": {"source": source, "sentiment_model": sentiment, "ticker_days": int(len(df)),
                          "first_day": str(df["day"].min().date()), "last_day": str(df["day"].max().date())},
        "direction": _export(direction, features),
        "move": {**_export(move, features), "large_ratio": LARGE_RATIO, "small_ratio": SMALL_RATIO},
        "track_record": record,
    }


def main(sentiment: str = "auto", limit: Optional[int] = None, out_dir: Path = Path("reports")) -> Dict[str, Any]:
    from .backtest import CACHE, load_prices, load_tweets, score_sentiment, TWEETS_DATASET

    posts = load_tweets(limit)
    cache = CACHE / f"sentiment_tweets_{sentiment}_{limit}.npy"
    if cache.exists():
        posts["sentiment"] = np.load(cache)
    else:
        posts["sentiment"] = score_sentiment(posts["text"], sentiment)
        np.save(cache, posts["sentiment"].to_numpy())
    start = (posts["date"].min() - pd.Timedelta(days=60)).strftime("%Y-%m-%d")
    end = (posts["date"].max() + pd.Timedelta(days=10)).strftime("%Y-%m-%d")
    prices = load_prices(sorted(posts["ticker"].unique()), start, end)

    spec = train(build_daily_features(posts, prices), TWEETS_DATASET, sentiment)
    MODEL_PATH.write_text(json.dumps(spec, indent=2), encoding="utf-8")
    save_json({"track_record": spec["track_record"], "training_data": spec["training_data"]},
              out_dir / "outlook_track_record.json")
    return spec


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--sentiment", default="auto")
    ap.add_argument("--limit", type=int, default=None)
    ap.add_argument("--out", type=Path, default=Path("reports"))
    a = ap.parse_args()
    print(json.dumps(main(a.sentiment, a.limit, a.out)["track_record"], indent=2))
