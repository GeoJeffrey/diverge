"""
Regression tests for the "no fabricated values" rule and the renewal-equation Rn estimator.
"""

import unittest

import numpy as np

from diverge.indices import capitulation_language as cli_index
from diverge.indices import narrative_reproduction as rn
from diverge.indices import vernacular_divergence as vdi


def simulate_renewal(R: float, days: int, seed: int, seed_cases: int = 30) -> list:
    rng = np.random.default_rng(seed)
    w = rn.serial_interval_weights()
    onsets = [seed_cases]
    for t in range(1, days):
        lam = sum(onsets[t - s] * w[s - 1] for s in range(1, len(w) + 1) if t - s >= 0)
        onsets.append(int(rng.poisson(R * lam)))
    return onsets


class TestRenewalRn(unittest.TestCase):
    def test_recovers_known_reproduction_number(self):
        # The 95% credible interval should contain the true R in the vast majority of runs.
        hits, runs = 0, 40
        for seed in range(runs):
            post = rn.estimate_rn_posterior(simulate_renewal(1.2, 21, seed))
            self.assertIsNotNone(post)
            hits += post["lower"] <= 1.2 <= post["upper"]
        self.assertGreaterEqual(hits / runs, 0.85)

    def test_serial_interval_is_a_distribution(self):
        w = rn.serial_interval_weights()
        self.assertAlmostEqual(float(w.sum()), 1.0, places=9)
        self.assertTrue(np.all(w >= 0))

    def test_sparse_history_returns_none_not_a_guess(self):
        self.assertEqual(rn.compute_rn_from_onset_counts([3, 4]), (None, 0.0))
        self.assertEqual(rn.compute_rn_from_onset_counts([0, 0, 1, 0, 0, 0, 1]), (None, 0.0))

    def test_daily_series_fills_missing_days_with_zero(self):
        rows = [
            {"is_first_mention": 1, "timestamp_utc": "2026-01-01T10:00:00Z"},
            {"is_first_mention": 1, "timestamp_utc": "2026-01-03T10:00:00Z"},
            {"is_first_mention": 0, "timestamp_utc": "2026-01-03T11:00:00Z"},
        ]
        self.assertEqual(rn.daily_onset_series(rows), [1, 0, 1])


class TestNoFabricatedValues(unittest.TestCase):
    def test_cli_is_zero_when_no_capitulation(self):
        posts = [{"capitulation_flag": 0, "capitulation_confidence": 0.3, "sentiment_score": -0.9}] * 10
        self.assertEqual(cli_index.compute_cli_for_posts(posts), 0.0)

    def test_vdi_needs_both_language_groups(self):
        self.assertIsNone(vdi.compute_vdi_from_scores([0.1] * 50, [0.2] * 3))


if __name__ == "__main__":
    unittest.main()
