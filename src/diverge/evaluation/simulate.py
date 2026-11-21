"""
simulate.py

Generator of labelled 2-hour social-media windows for benchmarking the coordination detector.

There is no public, labelled dataset of coordinated stock-promotion campaigns on Reddit/StockTwits,
so the detector is evaluated the way fraud and bot-detection systems usually are before labels
exist: by injecting campaigns with *known* ground truth into realistic organic traffic and measuring
whether the detector finds them.

Organic traffic
  - Poisson arrivals with a smooth intensity, plus (in ~40% of windows) a news shock: a burst of
    new posters reacting to a headline, many of whom share the headline text verbatim. These are
    deliberate hard negatives -- bursty and duplicated, but not coordinated.
  - Free-text posts built from a mixed bullish/bearish/neutral phrase bank.

Coordinated campaign (positive windows)
  - Bot accounts post on a shared schedule (period 5-30 min) with timing jitter.
  - Messages are paraphrases of 1-3 promotional templates (synonym swaps, shuffled tags/emojis).
  - The campaign's share of the window's traffic is drawn uniformly from 5% to 50%.
  - Total window volume is drawn from the same distribution for both classes, so post count
    alone carries no information about the label.

Every knob is drawn per window and returned in the window's metadata so results can be broken down
by difficulty.
"""

from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

import numpy as np

WINDOW_MINUTES = 120

_CASHTAGS = ["$TSLA", "$NVDA", "$AAPL", "$AMZN", "$MSFT", "$INFY", "$RELIANCE", "$TCS"]
_EMOJIS = ["🚀", "📈", "🔥", "💎", "🌕", "💰"]

_OPENERS = [
    "just read the", "anyone watching", "thoughts on", "honestly", "my take on", "looking at",
    "not sure about", "still holding", "can't believe", "quick question about", "interesting move in",
]
_SUBJECTS = [
    "earnings call", "guidance", "the chart", "options flow", "valuation", "management commentary",
    "margins", "the downgrade", "the upgrade", "volume today", "the gap", "support level",
    "free cash flow", "the new product", "analyst targets", "short interest",
]
_VIEWS = [
    "looks bullish to me", "feels like a breakout", "could rally from here", "strong growth ahead",
    "this looks weak", "probably a drop coming", "bearish divergence on the daily", "might sell some",
    "expecting a decline", "neutral for now", "waiting for confirmation", "no idea honestly",
    "might be priced in", "could go either way", "taking profit here", "adding on dips",
]
_TAILS = ["", "", "", "nfa", "dyor", "imo", "lol", "thoughts?", "we'll see", "long term"]

_HEADLINES = [
    "{tag} beats estimates, raises full-year guidance",
    "{tag} shares fall after regulator opens probe",
    "{tag} announces buyback, stock jumps in pre-market",
    "{tag} CEO steps down effective immediately",
    "{tag} misses revenue expectations, cuts outlook",
]

_PROMO_TEMPLATES = [
    "{tag} is about to explode, buy before it's too late {e}",
    "huge breakout incoming on {tag}, load up now {e} {e2}",
    "{tag} to the moon, insiders are buying, don't miss this rally {e}",
    "last chance to get into {tag} before the surge {e}",
    "{tag} undervalued gem, massive upside, buy and hold {e}",
]
_SYNONYMS = {
    "explode": ["skyrocket", "explode", "blast off", "rip"],
    "buy": ["buy", "grab", "get in", "load"],
    "huge": ["huge", "massive", "insane", "big"],
    "breakout": ["breakout", "squeeze", "run", "pump"],
    "now": ["now", "today", "asap", "right now"],
    "rally": ["rally", "run", "move", "pump"],
    "chance": ["chance", "call", "opportunity", "window"],
    "surge": ["surge", "spike", "rally", "jump"],
    "gem": ["gem", "pick", "play", "stock"],
    "massive": ["massive", "huge", "big", "crazy"],
}


@dataclass
class SimWindow:
    posts: List[Dict[str, Any]]
    label: int
    window_start: datetime
    window_end: datetime
    news_event: bool
    meta: Dict[str, Any] = field(default_factory=dict)


def _organic_text(rng: np.random.Generator, tag: str) -> str:
    parts = [
        rng.choice(_OPENERS),
        tag if rng.random() < 0.7 else "",
        rng.choice(_SUBJECTS),
        rng.choice(_VIEWS),
    ]
    if rng.random() < 0.5:
        parts.append(rng.choice(_VIEWS))
    parts.append(rng.choice(_TAILS))
    if rng.random() < 0.15:
        parts.append(rng.choice(_EMOJIS))
    return " ".join(p for p in parts if p)


def _paraphrase(rng: np.random.Generator, template: str, tag: str, rate: float) -> str:
    words = template.format(tag=tag, e=rng.choice(_EMOJIS), e2=rng.choice(_EMOJIS)).split()
    out = []
    for w in words:
        key = w.strip(",.").lower()
        if key in _SYNONYMS and rng.random() < rate:
            out.append(str(rng.choice(_SYNONYMS[key])))
        else:
            out.append(w)
    if rng.random() < rate:  # occasionally append an extra tag/emoji in random position
        out.insert(int(rng.integers(0, len(out) + 1)), str(rng.choice(_EMOJIS)))
    return " ".join(out)


def _organic_posts(rng, start, tag, n_total, news_event) -> List[Dict[str, Any]]:
    posts = []
    burst_frac = rng.uniform(0.3, 0.8) if news_event else 0.0
    n_posts = max(1, int(round(n_total / (1.0 + burst_frac))))
    # smooth intensity: random linear trend across the window
    slope = rng.uniform(-0.5, 0.5)
    offsets = []
    while len(offsets) < n_posts:
        x = rng.uniform(0, WINDOW_MINUTES)
        if rng.random() < 0.5 + slope * (x / WINDOW_MINUTES - 0.5):
            offsets.append(x)
    headline = str(rng.choice(_HEADLINES)).format(tag=tag)
    news_time = rng.uniform(10, WINDOW_MINUTES - 30)
    if news_event:
        # burst of reactions decaying exponentially after the headline
        n_burst = n_total - n_posts
        offsets += list(np.minimum(news_time + rng.exponential(8.0, n_burst), WINDOW_MINUTES - 0.01))
    for k, off in enumerate(sorted(offsets)):
        reacting = news_event and off >= news_time and rng.random() < 0.35
        text = headline if (reacting and rng.random() < 0.6) else _organic_text(rng, tag)
        posts.append({
            "post_id": f"o{k}",
            "account_id": f"user{int(rng.integers(0, 50_000))}",
            "raw_text": text,
            "minute": float(off),
            "is_bot": 0,
        })
    return posts


def _campaign_posts(rng, tag, n_bots, period, jitter, paraphrase_rate, n_templates, synced) -> List[Dict[str, Any]]:
    templates = list(rng.choice(_PROMO_TEMPLATES, size=n_templates, replace=False))
    posts = []
    start_phase = rng.uniform(0, period)
    for b in range(n_bots):
        phase = start_phase if synced else rng.uniform(0, period)
        t = phase + rng.uniform(0, 2.0 if synced else 0.0)
        k = 0
        while t < WINDOW_MINUTES:
            posts.append({
                "post_id": f"b{b}_{k}",
                "account_id": f"bot{b}_{int(rng.integers(0, 10**6))}",
                "raw_text": _paraphrase(rng, str(rng.choice(templates)), tag, paraphrase_rate),
                "minute": float(t),
                "is_bot": 1,
            })
            t += period * (1.0 + rng.normal(0, jitter))
            k += 1
    return posts


def simulate_window(rng: np.random.Generator, coordinated: bool, base: Optional[datetime] = None) -> SimWindow:
    base = base or datetime(2026, 1, 5, 14, 0, tzinfo=timezone.utc)
    start = base + timedelta(days=int(rng.integers(0, 300)))
    tag = str(rng.choice(_CASHTAGS))
    news_event = bool(rng.random() < 0.4)
    n_total = int(rng.integers(40, 200))
    target_share = float(rng.uniform(0.05, 0.5)) if coordinated else 0.0
    n_bot_target = int(round(target_share * n_total))
    posts = _organic_posts(rng, start, tag, n_total - n_bot_target, news_event)
    meta: Dict[str, Any] = {"n_organic": len(posts), "news_event": news_event}

    if coordinated:
        period = float(rng.uniform(5, 30))
        cfg = {
            "n_bots": max(2, int(round(n_bot_target / (WINDOW_MINUTES / period)))),
            "period": period,
            "jitter": float(rng.uniform(0.02, 0.5)),
            "paraphrase_rate": float(rng.uniform(0.1, 0.9)),
            "n_templates": int(rng.integers(1, 4)),
            "synced": bool(rng.random() < 0.5),
        }
        bots = _campaign_posts(rng, tag, **cfg)
        posts += bots
        meta.update(cfg)
        meta["bot_share"] = round(len(bots) / len(posts), 4)
    else:
        meta["bot_share"] = 0.0

    posts.sort(key=lambda p: p["minute"])
    seen_accounts = set()
    prev = None
    for p in posts:
        ts = start + timedelta(minutes=p["minute"])
        p["timestamp_utc"] = ts.isoformat()
        p["delta_seconds"] = None if prev is None else (ts - prev).total_seconds()
        p["is_first_mention"] = 0 if p["account_id"] in seen_accounts else 1
        seen_accounts.add(p["account_id"])
        prev = ts
    return SimWindow(posts, int(coordinated), start, start + timedelta(minutes=WINDOW_MINUTES), news_event, meta)


def simulate_dataset(n_windows: int, positive_rate: float = 0.5, seed: int = 7) -> List[SimWindow]:
    rng = np.random.default_rng(seed)
    return [simulate_window(rng, bool(rng.random() < positive_rate)) for _ in range(n_windows)]
