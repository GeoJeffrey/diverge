"""API tests for the outlook endpoints (skipped when FastAPI isn't installed)."""

import json
import os
import tempfile
import unittest
from pathlib import Path

import pytest

pytest.importorskip("fastapi")
pytest.importorskip("sqlalchemy")

_tmp = tempfile.TemporaryDirectory()
_DB = Path(_tmp.name) / "api_test.db"
os.environ["DATABASE_URL"] = f"sqlite:///{_DB.as_posix()}"

from fastapi.testclient import TestClient  # noqa: E402

from diverge import storage  # noqa: E402
from diverge.api.app import app  # noqa: E402
from diverge.db import base as db_base  # noqa: E402


@unittest.skipUnless(str(db_base.engine.url).endswith("api_test.db"), "another test configured the engine first")
class TestOutlookAPI(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        payload = {
            "prob_up": 0.57, "prob_up_raw": 0.57, "lean": "up", "lean_strength": "lean",
            "expected_move_pct": 2.1, "typical_move_pct": 1.4, "move_label": "larger_than_usual",
            "direction_drivers": [{"feature": "sentiment_z", "label": "Sentiment shift vs usual", "kind": "narrative",
                                   "contribution": 0.12, "pushes": "up"}],
            "move_drivers": [], "coordination_flag": "high_trust", "coordination_dampened": False, "posts_today": 42,
        }
        storage.insert_outlooks([
            {"ticker": "INFY", "as_of_day": "2026-11-19", "available": 1, "coverage_note": None,
             "payload": json.dumps({**payload, "prob_up": 0.4}), "model_version": "1", "generated_at": "2026-11-19T12:00:00"},
            {"ticker": "INFY", "as_of_day": "2026-11-20", "available": 1, "coverage_note": None,
             "payload": json.dumps(payload), "model_version": "1", "generated_at": "2026-11-20T12:00:00"},
            {"ticker": "TCS", "as_of_day": "2026-11-20", "available": 0, "coverage_note": "No social posts in the last 3 trading days.",
             "payload": None, "model_version": "1", "generated_at": "2026-11-20T12:00:00"},
        ], db_path=_DB)
        cls.client = TestClient(app)

    def test_latest_outlook_for_ticker(self):
        r = self.client.get("/ticker/infy/outlook").json()
        self.assertTrue(r["available"])
        self.assertEqual(r["as_of_day"], "2026-11-20")
        self.assertEqual(r["prob_up"], 0.57)
        self.assertEqual(r["direction_drivers"][0]["pushes"], "up")
        self.assertIn("Not investment advice", r["disclaimer"])

    def test_unavailable_and_unknown(self):
        self.assertFalse(self.client.get("/ticker/TCS/outlook").json()["available"])
        r = self.client.get("/ticker/NOPE/outlook").json()
        self.assertFalse(r["available"])
        self.assertIn("No outlook", r["coverage_note"])

    def test_list(self):
        r = self.client.get("/outlook").json()
        self.assertEqual(r["total"], 2)
        self.assertEqual({o["symbol"] for o in r["outlooks"]}, {"INFY", "TCS"})

    def test_model_card(self):
        r = self.client.get("/outlook/model")
        self.assertEqual(r.status_code, 200)
        self.assertIn("disclaimer", r.json())
