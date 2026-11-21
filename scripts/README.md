# Scripts

| Script | Purpose |
|---|---|
| `bench_api.py` | Load-test a running API; writes p50/p95/p99 latency and throughput to `reports/api_latency.json`. |
| `smoke_test_api.py` | End-to-end check of every endpoint, including 401 protection on authenticated routes. |
| `validate_endpoints.py` | Validate live responses against the OpenAPI contract. |
| `diff_openapi.py` | Detect drift between the live schema and `docs/openapi.json`. |
| `verify_data_distribution.py` | Per-ticker / per-platform distribution of collected posts and computed indices. |
| `daily_volume_report.py` | Daily post volume per platform (scraper health). |
| `migrate_sqlite_to_pg.py` | One-time migration of the local SQLite store into PostgreSQL. |
| `sync_sqlite_to_postgres.py` | Copy computed tables into a PostgreSQL instance given by `DATABASE_URL` (never hard-coded). |

All scripts are run from the repository root, e.g. `python scripts/bench_api.py --requests 2000 --concurrency 32`.
