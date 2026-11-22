"""End-to-end test of the real-world labelling tool on a database filled with simulated windows."""

import builtins
import csv
import tempfile
import unittest
from pathlib import Path

import numpy as np

from diverge import storage
from diverge.evaluation import label_windows, simulate


def _fill_db(db: Path, n_windows: int = 40):
    rng = np.random.default_rng(1)
    conn = storage.get_connection(db)
    truth = {}
    for k in range(n_windows):
        w = simulate.simulate_window(rng, coordinated=k % 2 == 0)
        for p in w.posts:
            conn.execute(
                "INSERT OR IGNORE INTO raw_posts VALUES (?,?,?,?,?,?,?,?,?)",
                (f"{k}_{p['post_id']}", p["account_id"], p["timestamp_utc"], "c", f"T{k}", p["raw_text"], 0,
                 "stocktwits", p["timestamp_utc"]),
            )
        truth[f"T{k}"] = w.label
    conn.commit()
    conn.close()
    return truth


class TestLabelWindows(unittest.TestCase):
    def test_label_then_evaluate(self):
        with tempfile.TemporaryDirectory() as tmp:
            db, out = Path(tmp) / "x.db", Path(tmp) / "labels.csv"
            truth = _fill_db(db)
            windows = label_windows.build_windows(label_windows.load_posts(db), db)
            self.assertGreaterEqual(len(windows), 30)  # windows may split across a 2h boundary

            # Answer like an oracle that knows the simulated ground truth.
            shown = []
            real_show = label_windows._show
            label_windows._show = lambda w, i, total, max_posts=25: shown.append(w.meta["ticker"])
            real_input = builtins.input
            builtins.input = lambda prompt="": "c" if truth[shown[-1]] else "o"
            try:
                label_windows.label(db, n=30, out=out)
            finally:
                builtins.input, label_windows._show = real_input, real_show

            with out.open(encoding="utf-8") as f:
                rows = list(csv.DictReader(f))
            self.assertEqual(len(rows), 30)
            self.assertEqual({r["stratum"] for r in rows}, {"top_scored", "random"})

            res = label_windows.evaluate(out, Path(tmp))
            self.assertEqual(res["labelled_windows"], 30)
            self.assertEqual(res["candidate_windows"], len(windows))  # recorded by label()
            self.assertEqual(res["usable_labels"], 30)
            strata = res["strata"]
            self.assertEqual(strata["top_scored"]["labelled"] + strata["random"]["labelled"], 30)
            self.assertEqual(strata["top_scored"]["unsure"] + strata["random"]["unsure"], 0)
            self.assertGreater(res["roc_auc"], 0.7)
            self.assertTrue((Path(tmp) / "real_world_validation.json").exists())


if __name__ == "__main__":
    unittest.main()
