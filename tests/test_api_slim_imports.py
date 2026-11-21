"""The API image (Dockerfile.api / requirements-api.txt) ships without the ML and scraping stack.
Guard that importing the app and building its OpenAPI schema never needs any of it."""

import subprocess
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# Packages that are in requirements.txt but deliberately NOT in requirements-api.txt.
NOT_IN_API_IMAGE = [
    "torch", "transformers", "pandas", "numpy", "scipy", "statsmodels", "sklearn", "yfinance",
    "requests", "bs4", "lxml", "feedparser", "pytrends", "langdetect", "apscheduler",
]

SCRIPT = f"""
import sys
for name in {NOT_IN_API_IMAGE!r}:
    sys.modules[name] = None  # any import of these now raises ImportError
import diverge.api.app as m
import diverge.db.models  # what alembic's env.py loads
assert m.app.openapi()["paths"], "empty OpenAPI schema"
print("ok")
"""


class TestApiSlimImports(unittest.TestCase):
    def test_api_imports_without_ml_or_scraping_stack(self):
        proc = subprocess.run([sys.executable, "-c", SCRIPT], cwd=ROOT, capture_output=True, text=True,
                              env={**__import__("os").environ, "PYTHONPATH": str(ROOT / "src")}, timeout=120)
        self.assertEqual(proc.returncode, 0, proc.stderr[-2000:])
        self.assertIn("ok", proc.stdout)

    def test_api_requirements_exclude_heavy_packages(self):
        reqs = (ROOT / "requirements-api.txt").read_text(encoding="utf-8").lower()
        names = {line.split("==")[0].split("[")[0].strip() for line in reqs.splitlines()
                 if line.strip() and not line.startswith("#")}
        for heavy in ["torch", "transformers", "pandas", "numpy", "scipy", "yfinance"]:
            self.assertNotIn(heavy, names)


if __name__ == "__main__":
    unittest.main()
