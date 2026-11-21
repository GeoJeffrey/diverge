"""The serving-database snapshot used for real-world labelling."""

import os
import sqlite3
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from diverge import config, pull_serving


def _post(pid, platform="stocktwits", ticker="AAA"):
    return (pid, f"acct_{pid}", "2026-11-20T09:00:00+00:00", "", ticker, f"text {pid}", 0, platform, "2026-11-20T09:05:00+00:00")


class TestPullServing(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        d = Path(self.tmp.name)
        self.source = d / "serving.db"
        self.snapshot = d / "snapshot.db"
        con = sqlite3.connect(self.source)
        con.execute(f"CREATE TABLE raw_posts ({', '.join(pull_serving.COLUMNS)})")
        con.executemany(f"INSERT INTO raw_posts VALUES ({', '.join('?' * 9)})",
                        [_post("1"), _post("2"), _post("3", platform="rss_news"), _post("4", ticker=None)])
        con.commit()
        con.close()

    def tearDown(self):
        self.tmp.cleanup()

    def test_copies_posts_and_counts_social_ones(self):
        counts = pull_serving.pull(f"sqlite:///{self.source.as_posix()}", self.snapshot)
        self.assertEqual(counts, {"copied": 4, "social_posts_in_snapshot": 2})
        con = sqlite3.connect(self.snapshot)
        self.assertEqual(con.execute("SELECT raw_text FROM raw_posts WHERE post_id='2'").fetchone()[0], "text 2")
        con.close()

    def test_running_twice_does_not_duplicate(self):
        url = f"sqlite:///{self.source.as_posix()}"
        pull_serving.pull(url, self.snapshot)
        pull_serving.pull(url, self.snapshot)
        con = sqlite3.connect(self.snapshot)
        self.assertEqual(con.execute("SELECT COUNT(*) FROM raw_posts").fetchone()[0], 4)
        con.close()

    def test_refuses_without_a_serving_url(self):
        with mock.patch.dict(os.environ, {}, clear=True):
            self.assertEqual(pull_serving.main(["--out", str(self.snapshot)]), 2)
        self.assertFalse(self.snapshot.exists())

    def test_never_overwrites_the_local_pipeline_store(self):
        with mock.patch.dict(os.environ, {"DATABASE_URL": "postgresql://u:p@example.invalid/db"}):
            self.assertEqual(pull_serving.main(["--out", str(config.DB_PATH)]), 2)


if __name__ == "__main__":
    unittest.main()
