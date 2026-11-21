"""Exit-code policy of the pipeline: a blocked scraper must not fail a scheduled run,
but a failure in features, outlook or publish must."""

import unittest

from diverge.pipeline import CRITICAL_PHASES, failed_phases

OK = "ok (1.0s)"


def status(**overrides):
    s = {p: OK for p in ["1_ingest", "2_features", "3_indices", "4_integrity", "5_composite",
                         "6_explainability", "7_outlook", "8_publish"]}
    s.update(overrides)
    return s


class TestPipelinePolicy(unittest.TestCase):
    def test_all_ok_never_fails(self):
        self.assertEqual(failed_phases(status(), "any"), [])
        self.assertEqual(failed_phases(status(), "critical"), [])

    def test_ingest_failure_is_not_critical(self):
        s = status(**{"1_ingest": "failed: HTTP 403"})
        self.assertEqual(failed_phases(s, "critical"), [])
        self.assertEqual(failed_phases(s, "any"), ["1_ingest"])  # local default stays strict

    def test_non_critical_analytics_failure_does_not_fail_scheduled_run(self):
        self.assertEqual(failed_phases(status(**{"3_indices": "failed: VAR"}), "critical"), [])

    def test_each_critical_phase_fails_the_run(self):
        self.assertEqual(set(CRITICAL_PHASES), {"2_features", "7_outlook", "8_publish"})
        for phase in CRITICAL_PHASES:
            with self.subTest(phase=phase):
                self.assertEqual(failed_phases(status(**{phase: "failed: boom"}), "critical"), [phase])

    def test_skipped_for_no_posts_is_not_a_failure(self):
        s = {"1_ingest": OK, "2_features": "skipped: no posts"}
        self.assertEqual(failed_phases(s, "critical"), [])

    def test_unknown_mode_rejected(self):
        with self.assertRaises(ValueError):
            failed_phases(status(), "some")


if __name__ == "__main__":
    unittest.main()
