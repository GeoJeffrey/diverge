"""
No invented coordination readings.

A window without a coordination measurement must stay unmeasured all the way to the API:
no placeholder score (formerly 32.5), no assumed "high_trust", no "High confidence" label.
Narrative intensity itself is unchanged: with no evidence of coordination there is nothing to
dampen, so its value equals the undampened composite.
"""

import os
import tempfile
import unittest
from pathlib import Path

from diverge import storage
from diverge.aggregation.aggregate_composite import aggregate_composite_row


def _index_row(ticker, start, end):
    return {"ticker": ticker, "window_start_utc": start, "window_end_utc": end, "rn": 1.4,
            "rn_confidence": 0.8, "cirg": None, "cli": 0.1, "cassi": 0.6, "vdi": None}


def _coord_row(ticker, start, end, score, flag):
    return {"ticker": ticker, "window_start_utc": start, "window_end_utc": end, "ks_component": 0.1,
            "acf_component": 0.1, "onset_component": 0.1, "duplicate_ratio": 0.0, "sentiment_variance": 0.2,
            "coordination_score": score, "confidence_flag": flag}


class TestStorageHasNoPlaceholder(unittest.TestCase):
    def setUp(self):
        fd, path = tempfile.mkstemp(suffix=".db")
        os.close(fd)
        self.db = Path(path)

    def tearDown(self):
        if self.db.exists():
            os.unlink(self.db)

    def test_unmeasured_window_stays_unmeasured(self):
        storage.insert_index_values([_index_row("AAA", "2026-11-20T08:00:00+00:00", "2026-11-20T10:00:00+00:00")], db_path=self.db)
        rows = storage.get_index_values_and_coordination_for_window(ticker="AAA", db_path=self.db)
        self.assertEqual(len(rows), 1)
        self.assertIsNone(rows[0]["coordination_score"])
        self.assertIsNone(rows[0]["confidence_flag"])

    def test_latest_real_measurement_is_still_used(self):
        storage.insert_coordination_scores([_coord_row("BBB", "2026-11-19T08:00:00+00:00", "2026-11-19T10:00:00+00:00", 61.0, "moderate")], db_path=self.db)
        storage.insert_index_values([_index_row("BBB", "2026-11-20T08:00:00+00:00", "2026-11-20T10:00:00+00:00")], db_path=self.db)
        row = storage.get_index_values_and_coordination_for_window(ticker="BBB", db_path=self.db)[0]
        self.assertEqual(row["coordination_score"], 61.0)
        self.assertEqual(row["confidence_flag"], "moderate")


class TestAggregationDoesNotAssumeTrust(unittest.TestCase):
    def test_unmeasured_keeps_intensity_but_not_a_trust_label(self):
        base = _index_row("AAA", "w0", "w1")
        measured = aggregate_composite_row({**base, "coordination_score": 10.0, "confidence_flag": "high_trust"})
        unmeasured = aggregate_composite_row({**base, "coordination_score": None, "confidence_flag": None})
        self.assertEqual(unmeasured["composite_score"], measured["composite_score"])  # intensity unchanged
        self.assertIsNone(unmeasured["confidence_flag"])
        self.assertIsNone(unmeasured["coordination_score"])
        self.assertEqual(unmeasured["aggregation_confidence"], "insufficient_data")

    def test_real_flags_behave_as_before(self):
        base = {**_index_row("AAA", "w0", "w1"), "coordination_score": 80.0}
        high = aggregate_composite_row({**base, "confidence_flag": "high_trust"})
        low = aggregate_composite_row({**base, "confidence_flag": "low_trust"})
        self.assertEqual(high["aggregation_confidence"], "high_trust")
        self.assertLess(abs(low["composite_score"] - 50), abs(high["composite_score"] - 50))
        self.assertIsNone(aggregate_composite_row({**base, "confidence_flag": "insufficient_data"})["composite_score"])


class TestApiLabel(unittest.TestCase):
    def test_unmeasured_is_labelled_not_enough_data(self):
        from diverge.api.routers.tickers import _build_simple_item

        row = {"composite_score": 70.0, "dominant_index": "rn", "confidence_flag": None, "risk_flags": "[]",
               "rn": 1.4, "window_start_utc": "2026-11-20T08:00:00+00:00"}
        self.assertEqual(_build_simple_item(row, "AAA").trust_label, "Not enough data")
        self.assertEqual(_build_simple_item({**row, "confidence_flag": "something_new"}, "AAA").trust_label, "Not enough data")
        self.assertEqual(_build_simple_item({**row, "confidence_flag": "high_trust"}, "AAA").trust_label, "High confidence")


if __name__ == "__main__":
    unittest.main()
