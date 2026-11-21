"""
bench_api.py

Load-tests a running Diverge API and writes latency percentiles to reports/api_latency.json.

    python run_server.py --port 8000          # in one terminal (workers default to 1)
    python scripts/bench_api.py --requests 2000 --concurrency 32

Endpoints exercised: /health, /tickers, /ticker/{symbol}/simple (public) and
/ticker/{symbol} (JWT-protected). Uses only the standard library.
"""

import argparse
import json
import statistics
import sys
import time
import urllib.request
import uuid
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))
from diverge.evaluation.report import save_json  # noqa: E402


def _request(url, token=None, data=None):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(url, data=json.dumps(data).encode() if data else None, headers=headers)
    t0 = time.perf_counter()
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            body = resp.read()
            return resp.status, (time.perf_counter() - t0) * 1000, body
    except urllib.error.HTTPError as e:
        return e.code, (time.perf_counter() - t0) * 1000, b""
    except Exception:
        return 0, (time.perf_counter() - t0) * 1000, b""


def _pct(values, q):
    values = sorted(values)
    return round(values[min(len(values) - 1, int(q / 100 * len(values)))], 2)


def main(base, n, concurrency, symbol):
    email = f"bench-{uuid.uuid4().hex[:8]}@example.com"
    status, _, body = _request(f"{base}/auth/signup", data={"email": email, "password": "Bench-pass-123", "full_name": "Bench"})
    if status not in (200, 201):
        sys.exit(f"signup failed with HTTP {status}; is the API running at {base}?")
    token = json.loads(body)["access_token"]

    endpoints = {
        "GET /health": (f"{base}/health", None),
        "GET /tickers": (f"{base}/tickers", None),
        f"GET /ticker/{symbol}/simple": (f"{base}/ticker/{symbol}/simple", None),
        f"GET /ticker/{symbol} (auth)": (f"{base}/ticker/{symbol}", token),
    }
    results = {"base_url": base, "requests_per_endpoint": n, "concurrency": concurrency, "endpoints": {}}
    for name, (url, tok) in endpoints.items():
        for _ in range(20):  # warm-up
            _request(url, tok)
        t0 = time.perf_counter()
        with ThreadPoolExecutor(concurrency) as pool:
            out = list(pool.map(lambda _: _request(url, tok), range(n)))
        wall = time.perf_counter() - t0
        lat = [ms for code, ms, _ in out if code == 200]
        results["endpoints"][name] = {
            "p50_ms": _pct(lat, 50), "p95_ms": _pct(lat, 95), "p99_ms": _pct(lat, 99),
            "mean_ms": round(statistics.mean(lat), 2) if lat else None,
            "throughput_rps": round(n / wall, 1),
            "error_rate": round(1 - len(lat) / n, 4),
        }
        print(name, results["endpoints"][name])
    save_json(results, Path("reports") / "api_latency.json")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--base-url", default="http://localhost:8000")
    ap.add_argument("--requests", type=int, default=2000)
    ap.add_argument("--concurrency", type=int, default=32)
    ap.add_argument("--symbol", default="AAPL")
    a = ap.parse_args()
    main(a.base_url.rstrip("/"), a.requests, a.concurrency, a.symbol)
