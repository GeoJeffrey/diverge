"""
backtest.py

Does social-media narrative carry information about the next trading day that prices don't?

Data
  Social:  mjw/stock_market_tweets (Hugging Face) -- ~1.7M tweets about AAPL, AMZN, GOOG(L), MSFT,
           TSLA, 2015-2019, with author ids (needed for first-mention onsets / Rn).
           Or --source db: the posts this project's own scrapers collected (raw_posts table).
  Prices:  Yahoo Finance daily closes via yfinance (+ SPY as the market factor), cached locally.

Daily narrative features per (ticker, trading day)  -- all known by the close of day t
  attention   log tweet volume; volume z-score vs trailing 20 days (attention shock)
  tone        mean sentiment, bullish share, sentiment z-score
  dispersion  Antweiler-Frank disagreement index
  contagion   share of first-time posters; Rn (renewal-equation reproduction number, 28-day history)
  stress      capitulation share (CLI)
  integrity   near-duplicate share across different authors (MinHash-LSH)
  divergence  sentiment z-score minus same-day return z-score (narrative/price divergence)

Targets
  next-day absolute return |r_{t+1}| (volatility) and next-day excess return over SPY (direction).

Protocol
  Expanding-window walk-forward by calendar year: train on every year before Y, test on Y.
  Baselines use only price information (HAR-style lagged volatility; momentum).
  We report out-of-sample R^2 / MSE reduction with a Diebold-Mariano test, AUC for direction,
  an event study (volatility after attention shocks, bootstrap CI), and a cost-aware long/short
  sanity check. Negative results are reported as they come out.

Run:  python -m diverge.evaluation.backtest                   # tweets dataset
      python -m diverge.evaluation.backtest --source db       # your own scraped data
"""

import argparse
import json
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import numpy as np
import pandas as pd

from ..features.text_features import _keyword_sentiment
from ..outlook.features import (  # noqa: F401  (re-exported for tests and notebooks)
    NARRATIVE_FEATURES,
    PRICE_FEATURES,
    _to_trading_day,
    build_daily_features,
)
from .report import save_json

CACHE = Path(".cache/diverge")
TWEETS_DATASET = "mjw/stock_market_tweets"

# --------------------------------------------------------------------------- data loading


def load_tweets(limit: Optional[int] = None) -> pd.DataFrame:
    CACHE.mkdir(parents=True, exist_ok=True)
    cached = CACHE / "tweets.parquet"
    if cached.exists():
        df = pd.read_parquet(cached)
    else:
        from datasets import load_dataset

        raw = load_dataset(TWEETS_DATASET, split="train").to_pandas()
        df = pd.DataFrame({
            "ticker": raw["ticker_symbol"].str.upper().replace({"GOOGL": "GOOG"}),
            "author": raw["writer"].fillna("unknown").astype(str),
            "date": pd.to_datetime(raw["post_date"]).dt.tz_localize(None).dt.normalize(),
            "text": raw["body"].fillna("").astype(str),
            "engagement": raw[["comment_num", "retweet_num", "like_num"]].sum(axis=1),
        })
        df.to_parquet(cached)
    return df.sample(n=limit, random_state=0) if limit else df


def load_db_posts() -> pd.DataFrame:
    """Social posts collected by this project's scrapers, with their pipeline sentiment labels."""
    from .. import config, storage
    from ..outlook.run_outlook import posts_frame

    return posts_frame(storage.get_social_posts_with_sentiment(db_path=config.DB_PATH, days=10_000))


YF_SYMBOL = {"RELIANCE": "RELIANCE.NS", "TCS": "TCS.NS", "INFY": "INFY.NS", "HDFCBANK": "HDFCBANK.NS",
             "ICICIBANK": "ICICIBANK.NS", "SBIN": "SBIN.NS", "BHARTIARTL": "BHARTIARTL.NS", "ITC": "ITC.NS",
             "LT": "LT.NS", "WIPRO": "WIPRO.NS", "TATASTEEL": "TATASTEEL.NS"}


def load_prices(tickers: List[str], start: str, end: str) -> pd.DataFrame:
    """Daily adjusted closes, columns = tickers + 'MKT' (SPY), cached to parquet."""
    CACHE.mkdir(parents=True, exist_ok=True)
    cached = CACHE / f"prices_{'_'.join(sorted(tickers))}_{start}_{end}.parquet"
    if cached.exists():
        return pd.read_parquet(cached)
    import yfinance as yf

    symbols = {t: YF_SYMBOL.get(t, t) for t in tickers}
    market = "^NSEI" if any(s.endswith(".NS") for s in symbols.values()) else "SPY"
    data = yf.download(list(symbols.values()) + [market], start=start, end=end, auto_adjust=True, progress=False)
    closes = data["Close"].rename(columns={v: k for k, v in symbols.items()}).rename(columns={"SPY": "MKT", "^NSEI": "MKT"})
    closes.index = pd.to_datetime(closes.index).tz_localize(None)
    closes.to_parquet(cached)
    return closes


# --------------------------------------------------------------------------- sentiment


def score_sentiment(texts: pd.Series, method: str) -> np.ndarray:
    """Signed sentiment in [-1, 1] per text. Cached per method for the tweets dataset."""
    if method == "keyword":
        return np.array([_keyword_sentiment(t)[0] for t in texts])
    if method == "tfidf":
        from .sentiment_benchmark import load_split, tfidf_model

        x, y = load_split("train")
        predict = tfidf_model(x, y)
        sign = {"bullish": 1.0, "bearish": -1.0, "neutral": 0.0}
        preds = []
        for i in range(0, len(texts), 200_000):
            preds += predict(list(texts.iloc[i : i + 200_000]))
        return np.array([sign[p] for p in preds])
    # transformer: fine-tuned FinBERT if available, otherwise base FinBERT
    from ..features.text_features import sentiment_model_path
    from .sentiment_benchmark import transformer_model

    predict = transformer_model(sentiment_model_path() if method == "auto" else method, batch_size=256)
    sign = {"bullish": 1.0, "bearish": -1.0, "neutral": 0.0}
    return np.array([sign.get(p, 0.0) for p in predict(list(texts))])


# --------------------------------------------------------------------------- evaluation


def diebold_mariano(e_base: np.ndarray, e_model: np.ndarray, lag: int = 5) -> Tuple[float, float]:
    """DM test on squared-error loss with Newey-West variance. Positive stat = model better."""
    from scipy import stats

    d = e_base**2 - e_model**2
    n, mean = len(d), d.mean()
    dc = d - mean
    var = dc @ dc / n
    for k in range(1, lag + 1):
        var += 2 * (1 - k / (lag + 1)) * (dc[k:] @ dc[:-k]) / n
    stat = mean / np.sqrt(var / n)
    return float(stat), float(1 - stats.norm.cdf(stat))


def _model(kind: str, task: str):
    from sklearn.ensemble import HistGradientBoostingClassifier, HistGradientBoostingRegressor
    from sklearn.linear_model import LogisticRegression, RidgeCV
    from sklearn.pipeline import make_pipeline
    from sklearn.preprocessing import StandardScaler

    if task == "reg":
        return make_pipeline(StandardScaler(), RidgeCV(alphas=np.logspace(-3, 3, 13))) if kind == "linear" \
            else HistGradientBoostingRegressor(max_iter=300, learning_rate=0.03, max_depth=3, random_state=0)
    return make_pipeline(StandardScaler(), LogisticRegression(C=0.1, max_iter=2000)) if kind == "linear" \
        else HistGradientBoostingClassifier(max_iter=200, learning_rate=0.03, max_depth=3, random_state=0)


def walk_forward(df: pd.DataFrame, features: List[str], target: str, task: str, kind: str,
                 min_train_years: int = 2) -> pd.DataFrame:
    years = sorted(df["day"].dt.year.unique())
    preds = []
    for y in years[min_train_years:]:
        tr, te = df[df["day"].dt.year < y], df[df["day"].dt.year == y]
        if len(te) == 0:
            continue
        ytr = tr[target] if task == "reg" else (tr[target] > 0).astype(int)
        m = _model(kind, task).fit(tr[features], ytr)
        p = m.predict(te[features]) if task == "reg" else m.predict_proba(te[features])[:, 1]
        preds.append(pd.DataFrame({"day": te["day"], "ticker": te["ticker"], "y": te[target], "pred": p}))
    return pd.concat(preds)


def evaluate_volatility(df: pd.DataFrame, narrative: List[str]) -> Dict:
    from scipy.stats import spearmanr

    res = {}
    for kind in ["linear", "gbm"]:
        base = walk_forward(df, PRICE_FEATURES, "y_abs_next", "reg", kind)
        full = walk_forward(df, PRICE_FEATURES + narrative, "y_abs_next", "reg", kind)
        y, eb, ef = base["y"].to_numpy(), (base["y"] - base["pred"]).to_numpy(), (full["y"] - full["pred"]).to_numpy()
        sst = ((y - y.mean()) ** 2).sum()
        dm, p = diebold_mariano(eb, ef)
        res[kind] = {
            "oos_r2_price_only": round(1 - (eb**2).sum() / sst, 4),
            "oos_r2_with_narrative": round(1 - (ef**2).sum() / sst, 4),
            "mse_reduction_pct": round(100 * (1 - (ef**2).mean() / (eb**2).mean()), 2),
            "rank_ic_price_only": round(float(spearmanr(base["pred"], y)[0]), 4),
            "rank_ic_with_narrative": round(float(spearmanr(full["pred"], y)[0]), 4),
            "diebold_mariano_stat": round(dm, 3),
            "dm_p_value": round(p, 4),
            "test_observations": int(len(y)),
            "test_years": sorted(int(v) for v in base["day"].dt.year.unique()),
        }
    return res


def evaluate_direction(df: pd.DataFrame, narrative: List[str], cost_bps: float = 5.0) -> Dict:
    from sklearn.metrics import accuracy_score, roc_auc_score

    res = {}
    for kind in ["linear", "gbm"]:
        row = {}
        for name, feats in [("price_only", PRICE_FEATURES), ("with_narrative", PRICE_FEATURES + narrative)]:
            out = walk_forward(df, feats, "y_excess_next", "clf", kind)
            yb = (out["y"] > 0).astype(int)
            pos = np.where(out["pred"] > 0.5, 1.0, -1.0)
            turnover = pd.Series(pos, index=out.index).groupby(out["ticker"]).diff().abs().fillna(1.0)
            daily_pnl = (pos * out["y"] - turnover * cost_bps / 1e4).groupby(out["day"]).mean()
            row[name] = {
                "auc": round(float(roc_auc_score(yb, out["pred"])), 4),
                "accuracy": round(float(accuracy_score(yb, out["pred"] > 0.5)), 4),
                "long_short_sharpe_after_costs": round(float(daily_pnl.mean() / daily_pnl.std() * np.sqrt(252)), 3),
            }
        res[kind] = row
    return res


def event_study(df: pd.DataFrame, n_boot: int = 2000, seed: int = 0) -> Dict:
    """Next-day |return| after top-decile attention shocks vs all other days (bootstrap 95% CI)."""
    rng = np.random.default_rng(seed)
    thr = df.groupby("ticker")["volume_z"].transform(lambda s: s.quantile(0.9))
    shock = df["volume_z"] >= thr
    a, b = df.loc[shock, "y_abs_next"].to_numpy(), df.loc[~shock, "y_abs_next"].to_numpy()
    ratios = [rng.choice(a, len(a)).mean() / rng.choice(b, len(b)).mean() for _ in range(n_boot)]
    return {
        "shock_days": int(len(a)), "other_days": int(len(b)),
        "mean_next_day_abs_return_shock_pct": round(100 * a.mean(), 3),
        "mean_next_day_abs_return_other_pct": round(100 * b.mean(), 3),
        "volatility_ratio": round(a.mean() / b.mean(), 3),
        "ratio_95ci": [round(float(np.percentile(ratios, 2.5)), 3), round(float(np.percentile(ratios, 97.5)), 3)],
    }


def feature_importance(df: pd.DataFrame, narrative: List[str]) -> Dict[str, float]:
    """Permutation importance (MSE increase, %) of each narrative feature on the final test year."""
    from sklearn.inspection import permutation_importance

    last = df["day"].dt.year.max()
    tr, te = df[df["day"].dt.year < last], df[df["day"].dt.year == last]
    feats = PRICE_FEATURES + narrative
    m = _model("gbm", "reg").fit(tr[feats], tr["y_abs_next"])
    base_mse = float(((te["y_abs_next"] - m.predict(te[feats])) ** 2).mean())
    pi = permutation_importance(m, te[feats], te["y_abs_next"], scoring="neg_mean_squared_error",
                                n_repeats=10, random_state=0)
    imp = {f: round(100 * float(v) / base_mse, 3) for f, v in zip(feats, pi.importances_mean)}
    return dict(sorted(imp.items(), key=lambda kv: -kv[1]))


def run_backtest(posts: pd.DataFrame, prices: pd.DataFrame, with_duplicates: bool = True) -> Dict:
    df = build_daily_features(posts, prices, with_duplicates=with_duplicates)
    narrative = [f for f in NARRATIVE_FEATURES if f in df.columns and df[f].std() > 0]
    return {
        "panel": {"tickers": sorted(df["ticker"].unique().tolist()), "ticker_days": int(len(df)),
                  "first_day": str(df["day"].min().date()), "last_day": str(df["day"].max().date()),
                  "posts": int(len(posts))},
        "narrative_features": narrative,
        "volatility": evaluate_volatility(df, narrative),
        "direction": evaluate_direction(df, narrative),
        "attention_shock_event_study": event_study(df),
        "permutation_importance_pct_mse": feature_importance(df, narrative),
    }


def main(source: str, sentiment: str, limit: Optional[int], with_duplicates: bool, out_dir: Path) -> Dict:
    posts = load_tweets(limit) if source == "tweets" else load_db_posts()
    cache = CACHE / f"sentiment_{source}_{sentiment}_{limit}.npy"
    if source == "db":
        sentiment = "pipeline labels"  # already scored by the pipeline's sentiment model
    elif cache.exists():
        posts["sentiment"] = np.load(cache)
    else:
        posts["sentiment"] = score_sentiment(posts["text"], sentiment)
        if source == "tweets":
            np.save(cache, posts["sentiment"].to_numpy())

    start = (posts["date"].min() - pd.Timedelta(days=60)).strftime("%Y-%m-%d")
    end = (posts["date"].max() + pd.Timedelta(days=10)).strftime("%Y-%m-%d")
    if source == "db":
        from ..outlook.prices import group_by_market

        groups = group_by_market(sorted(posts["ticker"].unique()))
        if len(groups) > 1:  # one market factor per run: keep the larger market
            keep = max(groups.values(), key=len)
            posts = posts[posts["ticker"].isin(keep)]
    prices = load_prices(sorted(posts["ticker"].unique()), start, end)
    results = {"source": TWEETS_DATASET if source == "tweets" else "diverge raw_posts",
               "sentiment_model": sentiment, **run_backtest(posts, prices, with_duplicates)}
    save_json(results, out_dir / "backtest.json")
    return results


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--source", choices=["tweets", "db"], default="tweets")
    ap.add_argument("--sentiment", default="auto",
                    help="'auto' (fine-tuned FinBERT if trained, else FinBERT), 'tfidf', 'keyword' or a model path")
    ap.add_argument("--limit", type=int, default=None, help="subsample N posts for a quick run")
    ap.add_argument("--no-duplicates", action="store_true", help="skip the (slower) near-duplicate feature")
    ap.add_argument("--out", type=Path, default=Path("reports"))
    a = ap.parse_args()
    print(json.dumps(main(a.source, a.sentiment, a.limit, not a.no_duplicates, a.out), indent=2))
