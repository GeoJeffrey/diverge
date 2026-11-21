"""
outlook.py

Next-day outlook endpoints (public):
  GET /outlook                  latest outlook for every ticker
  GET /ticker/{symbol}/outlook  latest outlook for one ticker
  GET /outlook/model            model card: features, weights, walk-forward track record
"""

import json
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from ...outlook.model import FEATURE_LABELS, NARRATIVE_SET, load_model
from ..deps import get_db
from ..schemas import (
    OutlookDriver,
    OutlookListResponse,
    OutlookModelFeature,
    OutlookModelResponse,
    TickerOutlookResponse,
)
from ..ticker_metadata import get_ticker_name

router = APIRouter(tags=["Next-day outlook"])

DISCLAIMER = (
    "Statistical estimate from public social-media data and prices, with its historical accuracy "
    "shown alongside. Not investment advice."
)


def _to_response(row: Optional[Dict[str, Any]], symbol: str) -> TickerOutlookResponse:
    base = {"symbol": symbol.upper(), "name": get_ticker_name(symbol), "disclaimer": DISCLAIMER}
    if row is None:
        return TickerOutlookResponse(**base, available=False,
                                     coverage_note="No outlook has been computed for this ticker yet.")
    meta = {"as_of_day": row["as_of_day"], "model_version": row.get("model_version"),
            "generated_at": row.get("generated_at")}
    if not row.get("available") or not row.get("payload"):
        return TickerOutlookResponse(**base, **meta, available=False, coverage_note=row.get("coverage_note"))
    p = json.loads(row["payload"])
    return TickerOutlookResponse(
        **base, **meta, available=True,
        prob_up=p["prob_up"], lean=p["lean"], lean_strength=p["lean_strength"],
        expected_move_pct=p["expected_move_pct"], typical_move_pct=p["typical_move_pct"],
        move_label=p["move_label"],
        direction_drivers=[OutlookDriver(**d) for d in p.get("direction_drivers", [])],
        move_drivers=[OutlookDriver(**d) for d in p.get("move_drivers", [])],
        coordination_flag=p.get("coordination_flag"),
        coordination_dampened=bool(p.get("coordination_dampened")),
        posts_today=p.get("posts_today"),
    )


@router.get("/outlook", response_model=OutlookListResponse)
def list_outlooks(db: Session = Depends(get_db)):
    rows = db.execute(text("""
        SELECT o.* FROM ticker_outlook o
        JOIN (SELECT ticker, MAX(as_of_day) AS d FROM ticker_outlook GROUP BY ticker) m
          ON m.ticker = o.ticker AND m.d = o.as_of_day
        ORDER BY o.ticker
    """)).mappings().fetchall()
    items = [_to_response(dict(r), r["ticker"]) for r in rows]
    return OutlookListResponse(total=len(items), outlooks=items)


@router.get("/ticker/{symbol}/outlook", response_model=TickerOutlookResponse)
def ticker_outlook(symbol: str, db: Session = Depends(get_db)):
    row = db.execute(
        text("SELECT * FROM ticker_outlook WHERE ticker = :t ORDER BY as_of_day DESC, generated_at DESC LIMIT 1"),
        {"t": symbol.upper()},
    ).mappings().first()
    return _to_response(dict(row) if row else None, symbol)


@router.get("/outlook/model", response_model=OutlookModelResponse)
def outlook_model_card():
    spec = load_model()
    if spec is None:
        return OutlookModelResponse(available=False, disclaimer=DISCLAIMER)
    d, m = spec["direction"], spec["move"]
    move_w = dict(zip(m["features"], m["coef"]))
    features: List[OutlookModelFeature] = [
        OutlookModelFeature(
            feature=f, label=FEATURE_LABELS.get(f, f), kind="narrative" if f in NARRATIVE_SET else "price",
            direction_weight=round(c, 5), move_weight=round(move_w.get(f, 0.0), 6),
        )
        for f, c in zip(d["features"], d["coef"])
    ]
    return OutlookModelResponse(
        available=True, version=spec.get("version"), trained_at=spec.get("trained_at"),
        training_data=spec.get("training_data", {}), track_record=spec.get("track_record", {}),
        features=features, disclaimer=DISCLAIMER,
    )
