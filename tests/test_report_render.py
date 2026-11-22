"""reports/RESULTS.md must never turn an undefined metric into a number."""

import json
import os
import tempfile
import unittest
from pathlib import Path

from diverge.evaluation import run_all

TINY_SAMPLE = {
    "labelled_windows": 2, "unsure_excluded": 2, "coordinated_found": 0, "threshold": 0.35,
    "precision_when_flagged": None, "flagged_windows": 0, "recall_within_sample": None,
    "random_sample": {"windows": 0, "coordinated_prevalence": None, "false_alarm_rate": None},
}


class TestRealWorldRender(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.cwd = os.getcwd()
        os.chdir(self.tmp.name)
        Path("reports").mkdir()

    def tearDown(self):
        os.chdir(self.cwd)
        self.tmp.cleanup()

    def _render(self, real):
        Path("reports/real_world_validation.json").write_text(json.dumps(real), encoding="utf-8")
        return run_all.render().read_text(encoding="utf-8")

    def test_undefined_metrics_are_na_not_zero(self):
        md = self._render(TINY_SAMPLE)
        self.assertIn("| Precision when flagged | n/a (no flagged windows among the labelled ones) |", md)
        self.assertIn("| False-alarm rate (random windows) | n/a (0 labelled random windows) |", md)
        self.assertIn("| Coordinated share of random windows | n/a (0 labelled random windows) |", md)
        self.assertNotIn("| False-alarm rate (random windows) | 0% |", md)
        self.assertIn("Real-world bot check: too few flagged windows", md)  # stays out of the resume bullets

    def test_defined_metrics_still_render_as_percentages(self):
        real = {**TINY_SAMPLE, "precision_when_flagged": 0.8, "flagged_windows": 12,
                "random_sample": {"windows": 20, "coordinated_prevalence": 0.1, "false_alarm_rate": 0.05}}
        md = self._render(real)
        self.assertIn("| Precision when flagged | 80% of 12 flagged windows |", md)
        self.assertIn("| False-alarm rate (random windows) | 5% |", md)


class TestReportWording(unittest.TestCase):
    def test_price_feature_list_matches_the_model(self):
        from diverge.outlook.features import PRICE_FEATURES

        self.assertEqual(run_all._PRICE_FEATURES, set(PRICE_FEATURES))

    def test_no_postgresql_claim_in_the_latency_bullet(self):
        import inspect

        src = inspect.getsource(run_all.render)
        self.assertNotIn("FastAPI + PostgreSQL backend at p95", src)


if __name__ == "__main__":
    unittest.main()
