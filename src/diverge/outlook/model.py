"""
model.py

The "next-day outlook" served by the API, built from two linear models trained by
diverge.evaluation.train_outlook and stored as plain JSON (outlook_model.json):

  direction   logistic regression -> P(next-day close > today's close)
  move size   ridge regression    -> expected next-day |log return|

Linear models were chosen on purpose: in the walk-forward backtest they performed on par with
gradient boosting at this signal-to-noise ratio, they need no ML runtime in the API container,
and every prediction decomposes exactly into per-feature contributions (coef * standardised
value), which is what the dashboard shows as "what is driving this".
"""

import json
import math
from pathlib import Path
from typing import Any, Dict, List, Optional

MODEL_PATH = Path(__file__).resolve().parent / "outlook_model.json"
Z_CLIP = 5.0

FEATURE_LABELS: Dict[str, str] = {
    "abs_ret": "Today's price move size",
    "abs_ret_5": "Recent volatility (5 days)",
    "abs_ret_22": "Volatility (1 month)",
    "mkt_abs_ret": "Market-wide move today",
    "ret": "Today's return",
    "ret_5": "5-day price momentum",
    "log_volume": "Post volume",
    "volume_z": "Attention spike vs usual",
    "mean_sentiment": "Average sentiment",
    "bull_share": "Share of bullish posts",
    "sentiment_z": "Sentiment shift vs usual",
    "disagreement": "Bull/bear disagreement",
    "new_author_share": "New voices joining",
    "rn": "Narrative contagion (Rn)",
    "capitulation_share": "Capitulation language",
    "duplicate_share": "Copy-paste (coordinated) posts",
    "engagement": "Engagement",
    "divergence": "Sentiment vs price divergence",
}
NARRATIVE_SET = {
    "log_volume", "volume_z", "mean_sentiment", "bull_share", "sentiment_z", "disagreement",
    "new_author_share", "rn", "capitulation_share", "duplicate_share", "engagement", "divergence",
}

# Outlook wording. Thresholds on |p - 0.5|; the track record reports how often each tier was right.
LEAN_THRESHOLD = 0.05
SLIGHT_THRESHOLD = 0.02
# Coordination dampening: shrink the lean toward 50/50 when the conversation looks inorganic.
COORDINATION_SHRINK = {"low_trust": 0.5, "moderate": 0.75}


class LinearModel:
    def __init__(self, spec: Dict[str, Any]):
        self.features: List[str] = spec["features"]
        self.mean: List[float] = spec["mean"]
        self.scale: List[float] = spec["scale"]
        self.coef: List[float] = spec["coef"]
        self.intercept: float = spec["intercept"]

    def contributions(self, row: Dict[str, float]) -> Dict[str, float]:
        out = {}
        for f, mu, sd, c in zip(self.features, self.mean, self.scale, self.coef):
            z = (float(row[f]) - mu) / (sd or 1.0)
            out[f] = c * max(-Z_CLIP, min(Z_CLIP, z))
        return out

    def linear(self, row: Dict[str, float]) -> float:
        return self.intercept + sum(self.contributions(row).values())


def load_model(path: Path = MODEL_PATH) -> Optional[Dict[str, Any]]:
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else None


def missing_features(spec: Dict[str, Any], row: Dict[str, Any]) -> List[str]:
    needed = set(spec["direction"]["features"]) | set(spec["move"]["features"])
    return sorted(
        f for f in needed
        if row.get(f) is None or (isinstance(row.get(f), float) and math.isnan(row[f]))
    )


def _drivers(contrib: Dict[str, float], top: int = 4) -> List[Dict[str, Any]]:
    ranked = sorted(contrib.items(), key=lambda kv: -abs(kv[1]))[:top]
    return [
        {
            "feature": f,
            "label": FEATURE_LABELS.get(f, f),
            "kind": "narrative" if f in NARRATIVE_SET else "price",
            "contribution": round(v, 4),
            "pushes": "up" if v > 0 else "down",
        }
        for f, v in ranked if abs(v) > 1e-6
    ]


def predict(spec: Dict[str, Any], row: Dict[str, float], confidence_flag: Optional[str] = None) -> Dict[str, Any]:
    """
    row: one day's feature values (see outlook.features). Returns the outlook payload stored in
    ticker_outlook and served by the API.
    """
    direction, move = LinearModel(spec["direction"]), LinearModel(spec["move"])

    z = direction.linear(row)
    raw_p = 1.0 / (1.0 + math.exp(-z))
    shrink = COORDINATION_SHRINK.get(confidence_flag or "", 1.0)
    p_up = 0.5 + (raw_p - 0.5) * shrink

    edge = abs(p_up - 0.5)
    if edge >= LEAN_THRESHOLD:
        lean = "up" if p_up > 0.5 else "down"
        strength = "lean"
    elif edge >= SLIGHT_THRESHOLD:
        lean = "up" if p_up > 0.5 else "down"
        strength = "slight"
    else:
        lean, strength = "neutral", "none"

    expected = max(0.0, move.linear(row))
    typical = float(row["abs_ret_22"])
    ratio = expected / typical if typical > 0 else None
    if ratio is None:
        move_label = "unknown"
    elif ratio >= spec["move"].get("large_ratio", 1.25):
        move_label = "larger_than_usual"
    elif ratio <= spec["move"].get("small_ratio", 0.8):
        move_label = "smaller_than_usual"
    else:
        move_label = "typical"

    return {
        "prob_up": round(p_up, 4),
        "prob_up_raw": round(raw_p, 4),
        "lean": lean,
        "lean_strength": strength,
        "expected_move_pct": round(100 * expected, 3),
        "typical_move_pct": round(100 * typical, 3),
        "move_label": move_label,
        "direction_drivers": _drivers(direction.contributions(row)),
        "move_drivers": _drivers(move.contributions(row)),
        "coordination_flag": confidence_flag,
        "coordination_dampened": shrink < 1.0,
    }
