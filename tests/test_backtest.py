"""
Backtest harness tests on synthetic data:
  - a planted signal (attention shocks precede volatility) must be detected
  - pure-noise narrative features must NOT look predictive (guards against look-ahead leakage)
"""

import unittest

import numpy as np
import pandas as pd

from diverge.evaluation import backtest


def synthetic_panel(planted: bool, seed: int = 0, years: int = 4):
    rng = np.random.default_rng(seed)
    days = pd.bdate_range("2015-01-01", periods=252 * years)
    tickers = ["AAA", "BBB", "CCC"]
    prices, rows = {}, []
    mkt = np.cumsum(rng.normal(0, 0.008, len(days)))
    prices["MKT"] = 100 * np.exp(mkt)
    for t in tickers:
        shock = rng.random(len(days)) < 0.08                    # attention-shock days
        vol = np.where(np.roll(shock, 1) & planted, 0.04, 0.012)  # shock at t -> high vol at t+1
        vol[0] = 0.012
        prices[t] = 100 * np.exp(np.cumsum(rng.normal(0, vol)))
        for i, d in enumerate(days):
            n = int(rng.poisson(60 if shock[i] else 15))
            for k in range(n):
                rows.append({
                    "ticker": t, "author": f"u{rng.integers(0, 3000)}", "date": d,
                    "text": f"post {k} about {t} " + ("buy rally" if rng.random() < 0.5 else "sell drop"),
                    "engagement": int(rng.integers(0, 5)), "sentiment": float(rng.choice([-1.0, 0.0, 1.0])),
                })
    return pd.DataFrame(rows), pd.DataFrame(prices, index=days)


class TestBacktest(unittest.TestCase):
    def test_planted_signal_is_detected(self):
        posts, prices = synthetic_panel(planted=True)
        res = backtest.run_backtest(posts, prices, with_duplicates=False)
        lin = res["volatility"]["linear"]
        self.assertGreater(lin["mse_reduction_pct"], 5.0)
        self.assertLess(lin["dm_p_value"], 0.01)
        self.assertGreater(res["attention_shock_event_study"]["volatility_ratio"], 1.5)

    def test_noise_features_do_not_leak(self):
        posts, prices = synthetic_panel(planted=False, seed=1)
        res = backtest.run_backtest(posts, prices, with_duplicates=False)
        self.assertLess(res["volatility"]["linear"]["mse_reduction_pct"], 2.0)
        ci = res["attention_shock_event_study"]["ratio_95ci"]
        self.assertTrue(ci[0] <= 1.0 <= ci[1] or ci[0] < 1.1)

    def test_weekend_posts_roll_back_to_previous_trading_day(self):
        days = pd.bdate_range("2026-01-05", periods=10)
        mapped = backtest._to_trading_day(pd.Series(pd.to_datetime(["2026-01-10", "2026-01-12"])), days)
        self.assertEqual(list(mapped.dt.strftime("%Y-%m-%d")), ["2026-01-09", "2026-01-12"])

    def test_diebold_mariano_sign(self):
        rng = np.random.default_rng(0)
        y = rng.normal(size=2000)
        good, bad = y + rng.normal(0, 0.1, 2000), y + rng.normal(0, 1.0, 2000)
        stat, p = backtest.diebold_mariano(y - bad, y - good)
        self.assertGreater(stat, 0)
        self.assertLess(p, 0.01)


if __name__ == "__main__":
    unittest.main()
