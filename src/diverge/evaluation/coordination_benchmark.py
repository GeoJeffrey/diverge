"""
coordination_benchmark.py

Measures how well the integrity layer detects coordinated (bot-like) posting campaigns.

  1. Simulate N labelled 2-hour windows (see simulate.py) -- half contain an injected campaign.
  2. Extract the *production* integrity features for every window with the same functions the
     pipeline uses (KS test vs Poisson, ACF peak, onset dispersion, MinHash-LSH duplicate ratio,
     sentiment variance).
  3. Score windows with
       a) the original hand-weighted heuristic (coordination_score.calculate_coordination_score)
       b) a logistic-regression scorer trained on a held-out-by-design split
       c) gradient-boosted trees (upper-bound reference)
  4. Report ROC-AUC, PR-AUC, precision/recall/F1, false-positive rate on news-burst hard negatives,
     recall by campaign size, feature ablations, and MinHash-LSH speed-up vs brute force.

Run:  python -m diverge.evaluation.coordination_benchmark --windows 4000
"""

import argparse
import json
import time
from pathlib import Path
from typing import Any, Dict, List

import numpy as np

from ..features import periodicity_analysis as pa
from ..features.text_features import _keyword_sentiment
from ..integrity import coordination_score, duplicate_detection, sentiment_variance
from ..integrity.minhash_lsh import near_duplicate_pairs
from . import simulate
from .report import save_json

FEATURES = ["ks", "acf", "onset_dispersion", "duplicate_ratio", "sentiment_variance", "news_event", "log_posts"]
HEURISTIC_ONLY = ["ks", "acf", "onset_dispersion", "duplicate_ratio", "sentiment_variance"]


def window_features(w: simulate.SimWindow) -> Dict[str, float]:
    posts = w.posts
    deltas = [p["delta_seconds"] for p in posts if p["delta_seconds"] is not None]
    n_slots = simulate.WINDOW_MINUTES // pa.BIN_MINUTES
    series = [0] * n_slots
    for p in posts:
        series[min(int(p["minute"] // pa.BIN_MINUTES), n_slots - 1)] += 1

    ks = pa._compute_ks_statistic(deltas)
    _, acf = pa._compute_acf_peak(series)
    disp = pa._compute_onset_dispersion(posts, w.window_start, w.window_end)
    dup = duplicate_detection.compute_duplicate_ratio(posts)
    sent = [_keyword_sentiment(p["raw_text"])[0] for p in posts]
    var = sentiment_variance.compute_window_sentiment_variance(sent)

    heuristic = coordination_score.calculate_coordination_score(
        ks_stat=ks, acf_strength=acf, onset_dispersion=disp, duplicate_ratio=dup,
        sentiment_var=var, total_posts=len(posts), news_event_present=w.news_event,
        method="heuristic",
    )
    return {
        "ks": ks or 0.0,
        "acf": acf or 0.0,
        "onset_dispersion": disp or 0.0,
        "duplicate_ratio": dup,
        "sentiment_variance": var,
        "news_event": float(w.news_event),
        "log_posts": float(np.log1p(len(posts))),
        "heuristic_score": heuristic["coordination_score"],
    }


def _metrics(y_true, scores, threshold) -> Dict[str, float]:
    from sklearn.metrics import average_precision_score, f1_score, precision_score, recall_score, roc_auc_score

    pred = (np.asarray(scores) >= threshold).astype(int)
    return {
        "roc_auc": round(float(roc_auc_score(y_true, scores)), 4),
        "pr_auc": round(float(average_precision_score(y_true, scores)), 4),
        "precision": round(float(precision_score(y_true, pred, zero_division=0)), 4),
        "recall": round(float(recall_score(y_true, pred, zero_division=0)), 4),
        "f1": round(float(f1_score(y_true, pred, zero_division=0)), 4),
        "threshold": round(float(threshold), 4),
    }


def _best_f1_threshold(y, scores) -> float:
    from sklearn.metrics import precision_recall_curve

    p, r, t = precision_recall_curve(y, scores)
    f1 = 2 * p * r / np.maximum(p + r, 1e-12)
    return float(t[int(np.argmax(f1[:-1]))])


def lsh_scaling(sizes=(1000, 2000, 4000), seed: int = 3) -> List[Dict[str, Any]]:
    """Wall-clock of exhaustive vs LSH near-duplicate search on growing post streams."""
    rng = np.random.default_rng(seed)
    rows = []
    for n in sizes:
        windows = []
        while sum(len(w.posts) for w in windows) < n:
            windows.append(simulate.simulate_window(rng, bool(rng.random() < 0.3)))
        texts = [p["raw_text"] for w in windows for p in w.posts][:n]
        t0 = time.perf_counter(); exact = near_duplicate_pairs(texts, use_lsh=False); t_exact = time.perf_counter() - t0
        t0 = time.perf_counter(); approx = near_duplicate_pairs(texts, use_lsh=True); t_lsh = time.perf_counter() - t0
        recall = len(set(exact) & set(approx)) / max(len(exact), 1)
        rows.append({
            "posts": n, "exact_seconds": round(t_exact, 3), "lsh_seconds": round(t_lsh, 3),
            "speedup": round(t_exact / t_lsh, 2), "pair_recall": round(recall, 4),
        })
    return rows


def run(n_windows: int = 4000, seed: int = 7, out_dir: Path = Path("reports"), export_weights: bool = True) -> Dict[str, Any]:
    from sklearn.ensemble import HistGradientBoostingClassifier
    from sklearn.linear_model import LogisticRegression
    from sklearn.model_selection import train_test_split
    from sklearn.pipeline import make_pipeline
    from sklearn.preprocessing import StandardScaler

    t0 = time.perf_counter()
    windows = simulate.simulate_dataset(n_windows, seed=seed)
    rows = [window_features(w) for w in windows]
    extract_s = time.perf_counter() - t0
    total_posts = sum(len(w.posts) for w in windows)

    y = np.array([w.label for w in windows])
    X = np.array([[r[f] for f in FEATURES] for r in rows])
    heur = np.array([r["heuristic_score"] for r in rows])
    idx_tr, idx_te = train_test_split(np.arange(len(y)), test_size=0.3, stratify=y, random_state=seed)

    results: Dict[str, Any] = {
        "windows": n_windows, "posts": total_posts, "positive_rate": round(float(y.mean()), 3),
        "feature_extraction_posts_per_sec": round(total_posts / extract_s, 1),
    }

    # a) heuristic: as deployed (moderate >= 40) and with an F1-optimal threshold tuned on train
    results["heuristic_as_deployed"] = _metrics(y[idx_te], heur[idx_te], 40.0)
    results["heuristic_tuned"] = _metrics(y[idx_te], heur[idx_te], _best_f1_threshold(y[idx_tr], heur[idx_tr]))

    # b) logistic regression and c) gradient boosting
    models = {
        "logistic_regression": make_pipeline(StandardScaler(), LogisticRegression(max_iter=1000)),
        "gradient_boosting": HistGradientBoostingClassifier(max_iter=300, learning_rate=0.05, random_state=seed),
    }
    probs = {}
    for name, model in models.items():
        model.fit(X[idx_tr], y[idx_tr])
        p_tr, p_te = model.predict_proba(X[idx_tr])[:, 1], model.predict_proba(X[idx_te])[:, 1]
        probs[name] = p_te
        results[name] = _metrics(y[idx_te], p_te, _best_f1_threshold(y[idx_tr], p_tr))

    # False-positive rate on the hardest negatives: organic news bursts (shared headline text)
    news_neg = np.array([windows[i].news_event and y[i] == 0 for i in idx_te])
    for name, scores, thr in [
        ("heuristic_as_deployed", heur[idx_te], 40.0),
        ("logistic_regression", probs["logistic_regression"], results["logistic_regression"]["threshold"]),
    ]:
        results[name]["fpr_on_news_bursts"] = round(float((scores[news_neg] >= thr).mean()), 4)

    # Recall by campaign strength (bot share of traffic)
    lr_thr = results["logistic_regression"]["threshold"]
    by_share = {}
    for lo, hi in [(0.0, 0.15), (0.15, 0.3), (0.3, 1.0)]:
        sel = np.array([y[i] == 1 and lo <= windows[i].meta["bot_share"] < hi for i in idx_te])
        if sel.any():
            by_share[f"{int(lo*100)}-{int(hi*100)}%"] = {
                "windows": int(sel.sum()),
                "recall_logreg": round(float((probs["logistic_regression"][sel] >= lr_thr).mean()), 4),
                "recall_heuristic": round(float((heur[idx_te][sel] >= 40.0).mean()), 4),
            }
    results["recall_by_bot_share"] = by_share

    # Ablation: drop one heuristic feature at a time (logistic regression ROC-AUC)
    from sklearn.metrics import roc_auc_score

    base_auc = results["logistic_regression"]["roc_auc"]
    ablation = {}
    for f in HEURISTIC_ONLY:
        keep = [i for i, name in enumerate(FEATURES) if name != f]
        m = make_pipeline(StandardScaler(), LogisticRegression(max_iter=1000)).fit(X[idx_tr][:, keep], y[idx_tr])
        auc = roc_auc_score(y[idx_te], m.predict_proba(X[idx_te][:, keep])[:, 1])
        ablation[f] = {"roc_auc_without": round(float(auc), 4), "auc_drop": round(base_auc - float(auc), 4)}
    results["ablation"] = ablation

    # Export learned weights so the pipeline can use the trained scorer
    lr = models["logistic_regression"]
    scaler, clf = lr.named_steps["standardscaler"], lr.named_steps["logisticregression"]
    weights = {
        "features": FEATURES,
        "mean": scaler.mean_.round(6).tolist(),
        "scale": scaler.scale_.round(6).tolist(),
        "coef": clf.coef_[0].round(6).tolist(),
        "intercept": round(float(clf.intercept_[0]), 6),
        "threshold": lr_thr,
        "trained_on": f"{n_windows} simulated windows (seed={seed})",
    }
    results["lsh_scaling"] = lsh_scaling()

    out_dir.mkdir(parents=True, exist_ok=True)
    save_json(results, out_dir / "coordination_benchmark.json")
    if export_weights:
        save_json(weights, Path(__file__).resolve().parent.parent / "integrity" / "learned_coordination_weights.json")
    return results


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--windows", type=int, default=4000)
    ap.add_argument("--seed", type=int, default=7)
    ap.add_argument("--out", type=Path, default=Path("reports"))
    ap.add_argument("--no-export", action="store_true", help="don't overwrite the shipped learned weights")
    args = ap.parse_args()
    print(json.dumps(run(args.windows, args.seed, args.out, export_weights=not args.no_export), indent=2))
