"""reports/RESULTS.md must never turn an undefined metric into a number, or describe a sample that didn't exist."""

import json
import os
import tempfile
import unittest
from pathlib import Path

from diverge.evaluation import run_all

TINY_SAMPLE = {
    "candidate_windows": 4, "usable_labels": 2,
    "strata": {"top_scored": {"labelled": 2, "unsure": 2}, "random": {"labelled": 0, "unsure": 0}},
    "labelled_windows": 2, "unsure_excluded": 2, "coordinated_found": 0, "threshold": 0.35,
    "precision_when_flagged": None, "flagged_windows": 0, "recall_within_sample": None,
    "random_sample": {"windows": 0, "coordinated_prevalence": None, "false_alarm_rate": None},
}

LARGE_SAMPLE = {
    "candidate_windows": 240, "usable_labels": 30,
    "strata": {"top_scored": {"labelled": 18, "unsure": 1}, "random": {"labelled": 12, "unsure": 2}},
    "labelled_windows": 30, "unsure_excluded": 3, "coordinated_found": 9, "threshold": 0.35,
    "precision_when_flagged": None, "flagged_windows": 0, "recall_within_sample": None,
    "random_sample": {"windows": 12, "coordinated_prevalence": None, "false_alarm_rate": None},
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

    def test_small_sample_reports_progress_only(self):
        md = self._render(TINY_SAMPLE)
        self.assertIn("Real-world validation: in progress (2 usable labels so far; target 100).", md)
        self.assertNotIn("| Precision when flagged |", md)          # no metrics table
        self.assertNotIn("half highest-scored, half random", md)
        bullets = md.split("## Resume bullets")[1].split("## Not CV headline material")[0]
        self.assertNotIn("bot detector on", bullets)                  # nothing for the CV
        self.assertNotIn("Real-world bot check", md)

    def test_large_sample_describes_the_real_strata(self):
        md = self._render(LARGE_SAMPLE)
        self.assertIn("240 candidate 2-hour windows from the live scrapers; 30 labelled without seeing the model's score "
                      "(18 from the highest-scored, 12 at random), 3 marked unsure and excluded.", md)
        self.assertIn("| Precision when flagged | n/a (no flagged windows among the labelled ones) |", md)
        self.assertIn("| False-alarm rate (random windows) | n/a (12 labelled random windows) |", md)
        self.assertNotIn("| False-alarm rate (random windows) | 0% |", md)
        self.assertIn("Real-world bot check: too few flagged windows", md)  # stays out of the resume bullets

    def test_defined_metrics_still_render_as_percentages(self):
        real = {**LARGE_SAMPLE, "precision_when_flagged": 0.8, "flagged_windows": 12,
                "random_sample": {"windows": 20, "coordinated_prevalence": 0.1, "false_alarm_rate": 0.05}}
        md = self._render(real)
        self.assertIn("| Precision when flagged | 80% of 12 flagged windows |", md)
        self.assertIn("| False-alarm rate (random windows) | 5% |", md)


class TestReportWording(unittest.TestCase):
    def test_no_calibrated_claim_in_the_report_generator(self):
        import inspect

        self.assertNotIn("calibrated", inspect.getsource(run_all.render).lower())

    def test_no_postgresql_claim_in_the_latency_bullet(self):
        import inspect

        self.assertNotIn("FastAPI + PostgreSQL backend at p95", inspect.getsource(run_all.render))


if __name__ == "__main__":
    unittest.main()
