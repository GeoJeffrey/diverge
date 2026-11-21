"""
label_windows.py

Real-world validation of the coordination detector with blind hand labels.

The detector was trained and benchmarked on simulated campaigns. This tool checks it on posts
your scrapers actually collected:

  1. Cut every ticker's social posts into 2-hour windows (>= 20 posts each).
  2. Score each window with the deployed learned scorer.
  3. Sample up to 100 windows: half from the highest-scored, half at random from the rest
     (so both "does it catch campaigns?" and "does it cry wolf?" can be measured).
  4. Show you the posts of each window in random order WITHOUT the score, and ask:
     coordinated / organic / unsure. Progress is saved after every answer; you can stop and resume.
  5. --evaluate compares the model with your labels and writes reports/real_world_validation.json.

    python -m diverge.evaluation.label_windows              # label (about 30-45 min for 100)
    python -m diverge.evaluation.label_windows --evaluate   # score the model against your labels
"""

import argparse
import csv
import json
import random
import sys
from collections import Counter
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from .. import config, storage
from ..integrity import coordination_score
from .coordination_benchmark import window_features
from .report import save_json
from .simulate import SimWindow

WINDOW = timedelta(hours=2)
MIN_POSTS = 20
LABELS_PATH = Path("reports/labels/real_windows.csv")
FIELDS = ["window_id", "ticker", "window_start", "stratum", "prob", "label"]

GUIDE = """
How to judge a window -- mark it COORDINATED if several of these hold:
  * different accounts posting the same or near-identical (lightly reworded) text
  * promotional pump language ("buy before it explodes", "last chance") from many accounts
  * posts arriving on a suspiciously regular schedule, or a burst of brand-new accounts
Mark ORGANIC for normal discussion, even if heated, and for many people sharing the same news headline.
Use UNSURE if you genuinely can't tell -- those windows are left out of the evaluation.
"""


def _parse(ts: str) -> Optional[datetime]:
    try:
        dt = datetime.fromisoformat(str(ts).replace("Z", "+00:00"))
        return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
    except ValueError:
        return None


def load_posts(db_path: Path) -> List[Dict[str, Any]]:
    conn = storage.get_connection(db_path)
    rows = conn.execute(
        """
        SELECT post_id, account_id, timestamp_utc, ticker, raw_text FROM raw_posts
        WHERE ticker IS NOT NULL AND platform NOT IN ('rss_news', 'google_trends')
        """
    ).fetchall()
    conn.close()
    posts = []
    for pid, acc, ts, ticker, text in rows:
        dt = _parse(ts)
        if dt and text:
            posts.append({"post_id": pid, "account_id": acc or "", "dt": dt, "ticker": ticker, "raw_text": text})
    return posts


def build_windows(posts: List[Dict[str, Any]], db_path: Path) -> List[SimWindow]:
    """Non-overlapping 2-hour windows per ticker with >= MIN_POSTS posts, in pipeline format."""
    by_ticker: Dict[str, List[Dict[str, Any]]] = {}
    for p in posts:
        by_ticker.setdefault(p["ticker"], []).append(p)

    windows = []
    for ticker, plist in by_ticker.items():
        plist.sort(key=lambda p: p["dt"])
        seen, buckets = set(), {}
        for p in plist:
            p = dict(p)
            p["is_first_mention"] = 0 if p["account_id"] in seen else 1
            seen.add(p["account_id"])
            epoch = int(p["dt"].timestamp())
            start = epoch - epoch % int(WINDOW.total_seconds())
            buckets.setdefault(start, []).append(p)
        for start_epoch, wposts in buckets.items():
            if len(wposts) < MIN_POSTS:
                continue
            start = datetime.fromtimestamp(start_epoch, tz=timezone.utc)
            prev = None
            for p in wposts:
                p["minute"] = (p["dt"] - start).total_seconds() / 60
                p["timestamp_utc"] = p["dt"].isoformat()
                p["delta_seconds"] = None if prev is None else (p["dt"] - prev).total_seconds()
                prev = p["dt"]
            end = start + WINDOW
            news = bool(storage.check_news_event_in_window(ticker, start.isoformat(), end.isoformat(), db_path=db_path))
            windows.append(SimWindow(wposts, -1, start, end, news, {"ticker": ticker}))
    return windows


def score_windows(windows: List[SimWindow]) -> List[Dict[str, Any]]:
    weights = coordination_score.load_learned_weights()
    if weights is None:
        sys.exit("No learned coordination weights found; run the coordination benchmark first.")
    out = []
    for w in windows:
        feats = window_features(w)
        out.append({"window": w, "prob": coordination_score.learned_probability(feats, weights)})
    return out


def sample(scored: List[Dict[str, Any]], n: int = 100, seed: int = 11) -> List[Dict[str, Any]]:
    rng = random.Random(seed)
    ranked = sorted(scored, key=lambda s: -s["prob"])
    top = ranked[: n // 2]
    rest = ranked[n // 2 :]
    rnd = rng.sample(rest, min(len(rest), n - len(top)))
    chosen = [{**s, "stratum": "top_scored"} for s in top] + [{**s, "stratum": "random"} for s in rnd]
    rng.shuffle(chosen)
    return chosen


def window_id(w: SimWindow) -> str:
    return f"{w.meta['ticker']}|{w.window_start.isoformat()}"


def _read_labels(path: Path) -> Dict[str, Dict[str, str]]:
    if not path.exists():
        return {}
    with path.open(newline="", encoding="utf-8") as f:
        return {r["window_id"]: r for r in csv.DictReader(f)}


def _show(w: SimWindow, i: int, total: int, max_posts: int = 25) -> None:
    accounts = Counter(p["account_id"] for p in w.posts)
    texts = Counter(p["raw_text"].strip().lower()[:80] for p in w.posts)
    print("\n" + "=" * 78)
    print(f"[{i}/{total}] {w.meta['ticker']}  {w.window_start:%Y-%m-%d %H:%M} UTC  "
          f"{len(w.posts)} posts, {len(accounts)} accounts, news headline in window: {'yes' if w.news_event else 'no'}")
    repeated = [(t, c) for t, c in texts.most_common(3) if c > 1]
    if repeated:
        print("Most repeated texts:", "; ".join(f"{c}x \"{t[:50]}\"" for t, c in repeated))
    print("-" * 78)
    step = max(1, len(w.posts) // max_posts)
    for p in w.posts[::step][:max_posts]:
        text = " ".join(p["raw_text"].split())[:110]
        print(f"{p['dt']:%H:%M}  {p['account_id'][:14]:<14}  {text}")


def label(db_path: Path, n: int, out: Path = LABELS_PATH) -> None:
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")  # emoji-safe on Windows consoles
    except AttributeError:
        pass
    windows = build_windows(load_posts(db_path), db_path)
    if not windows:
        sys.exit(f"No 2-hour windows with >= {MIN_POSTS} social posts found in {db_path}. "
                 "Let the pipeline collect data for a few days first (python run_all.py).")
    chosen = sample(score_windows(windows), n)
    done = _read_labels(out)
    out.parent.mkdir(parents=True, exist_ok=True)
    new_file = not out.exists()
    print(GUIDE)
    print(f"{len(windows)} candidate windows; labelling {len(chosen)} ({len(done)} already done).")
    with out.open("a", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=FIELDS)
        if new_file:
            writer.writeheader()
        for i, s in enumerate(chosen, 1):
            wid = window_id(s["window"])
            if wid in done:
                continue
            _show(s["window"], i, len(chosen))
            while True:
                ans = input("[c]oordinated / [o]rganic / [u]nsure / [q]uit and save > ").strip().lower()[:1]
                if ans in {"c", "o", "u", "q"}:
                    break
            if ans == "q":
                print(f"Saved. Re-run to continue. Labels: {out}")
                return
            writer.writerow({"window_id": wid, "ticker": s["window"].meta["ticker"],
                             "window_start": s["window"].window_start.isoformat(), "stratum": s["stratum"],
                             "prob": round(s["prob"], 6), "label": {"c": "coordinated", "o": "organic", "u": "unsure"}[ans]})
            f.flush()
    print(f"All done. Now run: python -m diverge.evaluation.label_windows --evaluate")


def evaluate(path: Path = LABELS_PATH, out_dir: Path = Path("reports")) -> Dict[str, Any]:
    rows = [r for r in _read_labels(path).values() if r["label"] in ("coordinated", "organic")]
    if not rows:
        sys.exit(f"No usable labels in {path}.")
    weights = coordination_score.load_learned_weights()
    thr = weights["threshold"] if weights else 0.5
    y = [1 if r["label"] == "coordinated" else 0 for r in rows]
    p = [float(r["prob"]) for r in rows]
    flagged = [pi >= thr for pi in p]

    def share(xs):
        return round(sum(xs) / len(xs), 4) if xs else None

    rnd = [(yi, fi) for yi, fi, r in zip(y, flagged, rows) if r["stratum"] == "random"]
    res: Dict[str, Any] = {
        "labelled_windows": len(rows),
        "unsure_excluded": len(_read_labels(path)) - len(rows),
        "coordinated_found": sum(y),
        "threshold": thr,
        "precision_when_flagged": share([yi for yi, fi in zip(y, flagged) if fi]),
        "flagged_windows": sum(flagged),
        "recall_within_sample": share([fi for yi, fi in zip(y, flagged) if yi]),
        "random_sample": {
            "windows": len(rnd),
            "coordinated_prevalence": share([yi for yi, _ in rnd]),
            "false_alarm_rate": share([fi for yi, fi in rnd if yi == 0]),
        },
        "note": "Half the sample is the highest-scored windows, so recall is measured within the labelled sample only.",
    }
    if 0 < sum(y) < len(y):
        from sklearn.metrics import roc_auc_score

        res["roc_auc"] = round(float(roc_auc_score(y, p)), 4)
    save_json(res, out_dir / "real_world_validation.json")
    return res


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--evaluate", action="store_true")
    ap.add_argument("--n", type=int, default=100)
    ap.add_argument("--db", type=Path, default=config.DB_PATH)
    a = ap.parse_args()
    if a.evaluate:
        print(json.dumps(evaluate(), indent=2))
    else:
        label(a.db, a.n)
