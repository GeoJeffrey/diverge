"""Tests for the next-day outlook: train -> serve parity, unavailable states, wording rules."""

import json
import unittest
from datetime import datetime, timezone

import pandas as pd

from diverge.evaluation.train_outlook import train
from diverge.outlook import model as outlook_model
from diverge.outlook.features import build_daily_features
from diverge.outlook.prices import drop_unfinished_session, market_of
from diverge.outlook.run_outlook import outlook_rows, posts_frame
from tests.test_backtest import synthetic_panel


class TestOutlook(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.posts, cls.prices = synthetic_panel(planted=True, seed=3)
        cls.spec = train(build_daily_features(cls.posts, cls.prices, with_duplicates=False), "synthetic", "test")

    def test_spec_is_json_serialisable_and_has_track_record(self):
        spec = json.loads(json.dumps(self.spec))
        self.assertIn("auc", spec["track_record"]["direction"])
        self.assertNotIn("engagement", spec["direction"]["features"])

    def test_served_probability_matches_sklearn(self):
        from diverge.evaluation.train_outlook import _direction_model

        df = build_daily_features(self.posts, self.prices, with_duplicates=False)
        feats = self.spec["direction"]["features"]
        sk = _direction_model().fit(df[feats], (df["y_ret_next"] > 0).astype(int))
        row = df.iloc[-1].to_dict()
        ours = outlook_model.predict(self.spec, row)["prob_up_raw"]
        self.assertAlmostEqual(ours, float(sk.predict_proba(df[feats].iloc[[-1]])[0, 1]), places=3)

    def test_live_rows_for_latest_day(self):
        rows = outlook_rows(self.posts, self.prices, ["AAA", "ZZZ"], self.spec, {"AAA": "low_trust"},
                            "2030-01-01T00:00:00+00:00")
        by = {r["ticker"]: r for r in rows}
        self.assertEqual(by["AAA"]["available"], 1)
        self.assertEqual(by["AAA"]["as_of_day"], str(self.prices.index.max().date()))
        payload = json.loads(by["AAA"]["payload"])
        self.assertTrue(payload["coordination_dampened"])
        self.assertLessEqual(abs(payload["prob_up"] - 0.5), abs(payload["prob_up_raw"] - 0.5))
        self.assertEqual(by["ZZZ"]["available"], 0)

    def test_unavailable_without_model_or_prices(self):
        r = outlook_rows(self.posts, self.prices, ["AAA"], None, {}, "2030-01-01T00:00:00")[0]
        self.assertEqual(r["available"], 0)
        self.assertIn("not been trained", r["coverage_note"])
        r = outlook_rows(self.posts, pd.DataFrame(), ["AAA"], self.spec, {}, "2030-01-01T00:00:00")[0]
        self.assertIn("Price data", r["coverage_note"])

    def test_stale_ticker_is_unavailable(self):
        stale = self.posts[self.posts["date"] < self.prices.index[-10]]
        r = outlook_rows(stale, self.prices, ["AAA"], self.spec, {}, "2030-01-01T00:00:00")[0]
        self.assertEqual(r["available"], 0)
        self.assertIn("No social posts", r["coverage_note"])

    def test_lean_wording_thresholds(self):
        spec = json.loads(json.dumps(self.spec))
        row = build_daily_features(self.posts, self.prices, with_duplicates=False).iloc[-1].to_dict()
        for intercept_shift, expected in [(0.0, None), (3.0, "up"), (-3.0, "down")]:
            s = json.loads(json.dumps(spec))
            s["direction"]["intercept"] += intercept_shift
            out = outlook_model.predict(s, row)
            if expected:
                self.assertEqual(out["lean"], expected)
                self.assertEqual(out["lean_strength"], "lean")

    def test_posts_frame_maps_labels(self):
        df = posts_frame([{"ticker": "INFY", "account_id": "a", "timestamp_utc": "2026-01-05T10:00:00+00:00",
                           "raw_text": "x", "upvotes": 0, "sentiment_label": "bearish"}])
        self.assertEqual(df["sentiment"].iloc[0], -1.0)
        self.assertEqual(str(df["date"].iloc[0].date()), "2026-01-05")

    def test_partial_session_dropped(self):
        idx = pd.to_datetime(["2026-01-05", "2026-01-06"])
        closes = pd.DataFrame({"X": [1.0, 2.0]}, index=idx)
        during = drop_unfinished_session(closes, "IN", datetime(2026, 1, 6, 6, tzinfo=timezone.utc))
        after = drop_unfinished_session(closes, "IN", datetime(2026, 1, 6, 12, tzinfo=timezone.utc))
        self.assertEqual(len(during), 1)
        self.assertEqual(len(after), 2)
        self.assertEqual(market_of("INFY"), "IN")
        self.assertEqual(market_of("NVDA"), "US")

    def test_pool_workers_start_with_single_threaded_blas(self):
        # Regression: 15 workers each reserving 16-thread BLAS buffers exhausted the Windows page file.
        import os
        from concurrent.futures import ProcessPoolExecutor

        from diverge.outlook.features import _single_threaded_blas_env

        before = os.environ.get("OPENBLAS_NUM_THREADS")
        with _single_threaded_blas_env(), ProcessPoolExecutor(max_workers=1) as pool:
            seen = pool.submit(os.getenv, "OPENBLAS_NUM_THREADS").result()
        self.assertEqual(seen, "1")
        self.assertEqual(os.environ.get("OPENBLAS_NUM_THREADS"), before)


if __name__ == "__main__":
    unittest.main()
