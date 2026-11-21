"""
prices.py

Daily closing prices for the live outlook (Yahoo Finance via yfinance).

Indian (NSE) tickers use the NIFTY 50 index as their market factor; US tickers use SPY,
matching the market factor the model was trained with.
"""

from datetime import datetime, timezone
from typing import Dict, List, Optional

import pandas as pd

from .. import utils

logger = utils.setup_logger("outlook_prices")

NSE_TICKERS = {"RELIANCE", "TCS", "INFY", "HDFCBANK", "ICICIBANK", "SBIN", "BHARTIARTL", "ITC", "LT",
               "WIPRO", "TATASTEEL"}
MARKET_INDEX = {"IN": "^NSEI", "US": "SPY"}
MARKET_CLOSE_UTC_HOUR = {"IN": 10, "US": 21}  # NSE closes 15:30 IST; NYSE 16:00 ET (incl. DST margin)


def market_of(ticker: str) -> str:
    return "IN" if ticker in NSE_TICKERS else "US"


def yahoo_symbol(ticker: str) -> str:
    return f"{ticker}.NS" if market_of(ticker) == "IN" else ticker


def group_by_market(tickers: List[str]) -> Dict[str, List[str]]:
    groups: Dict[str, List[str]] = {}
    for t in tickers:
        groups.setdefault(market_of(t), []).append(t)
    return groups


def drop_unfinished_session(closes: pd.DataFrame, market: str, now: Optional[datetime] = None) -> pd.DataFrame:
    """Remove today's bar while the market is still open (it would be a partial, moving 'close')."""
    now = now or datetime.now(timezone.utc)
    if closes.empty or now.hour >= MARKET_CLOSE_UTC_HOUR[market]:
        return closes
    return closes[closes.index < pd.Timestamp(now.date())]


def fetch_closes(tickers: List[str], market: str, days: int = 200) -> pd.DataFrame:
    """Columns = tickers + 'MKT', index = completed trading days (naive dates). Empty on failure."""
    import yfinance as yf

    symbols = {yahoo_symbol(t): t for t in tickers}
    symbols[MARKET_INDEX[market]] = "MKT"
    try:
        data = yf.download(list(symbols), period=f"{days}d", auto_adjust=True, progress=False)
    except Exception as e:  # network, rate limiting
        logger.warning(f"Price download failed for {market}: {e}")
        return pd.DataFrame()
    if data is None or data.empty:
        return pd.DataFrame()
    closes = data["Close"].rename(columns=symbols)
    closes.index = pd.to_datetime(closes.index).tz_localize(None).normalize()
    return drop_unfinished_session(closes.dropna(how="all"), market)
