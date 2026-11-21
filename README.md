# Diverge: financial narrative intelligence

[![CI](https://github.com/GeoJeffrey/diverge/actions/workflows/ci.yml/badge.svg)](https://github.com/GeoJeffrey/diverge/actions/workflows/ci.yml)
![Python 3.11](https://img.shields.io/badge/python-3.11-blue) ![FastAPI](https://img.shields.io/badge/API-FastAPI-009688) ![React](https://img.shields.io/badge/UI-React%20%2B%20Vite-61dafb) ![License: MIT](https://img.shields.io/badge/license-MIT-green)

**Diverge tracks how stories about a stock spread across retail social media and news. It tells you whether a story is organic or coordinated, and it measures whether those signals carry information that prices don't.**

It collects posts from Reddit, StockTwits, Telegram, financial news RSS and Google Trends. It scores them with a FinBERT model fine-tuned on finance tweets. It then computes narrative indices such as an epidemiological *reproduction number* for how fast a story is recruiting new posters. Each signal is passed through an integrity layer that flags bot-like coordinated campaigns. Everything is served through a JWT-secured FastAPI backend and a React dashboard. Every model and index is checked by a reproducible evaluation suite.

---

## Results

Every number below is reproduced by `python -m diverge.evaluation.run_all`. The full tables are in **[reports/RESULTS.md](reports/RESULTS.md)**.

**Coordinated-campaign detection**: 4,000 simulated 2-hour windows / 491k posts. Half contain an injected bot campaign (5-50% of traffic, paraphrased promo templates, scheduled posting with jitter). The negatives include organic news bursts with shared headline text.

| Scorer | ROC-AUC | Precision | Recall | F1 |
|---|---|---|---|---|
| Original hand-weighted score | 0.657 | 1.000 | 0.005 | 0.010 |
| **Learned scorer (now in the pipeline)** | **0.960** | **0.930** | **0.912** | **0.921** |

- **MinHash + LSH near-duplicate search** (written from scratch, no dependency): **42× faster** than exhaustive comparison on 4,000 posts, with 100% pair recall.
- The ablation shows that cross-account near-duplicate text carries almost all of the detection signal. The timing tests (KS vs Poisson, ACF) added nothing measurable.
- Main failure mode: 17% false positives on organic news bursts. See [limitations](docs/architecture.md#known-limitations).

**Sentiment model** (held-out finance tweets) and **predictive backtest** (~1.7M tweets, 2015-2019, walk-forward against a price-only baseline): run `python -m diverge.evaluation.run_all` on a GPU machine. The results are written to `reports/RESULTS.md`.

---

## What's inside

```mermaid
flowchart LR
    A[Reddit · StockTwits · Telegram · RSS · Trends] --> B[(raw posts)]
    B --> C[FinBERT sentiment<br/>timing features]
    C --> D[Narrative indices<br/>Rn · CLI · VDI · CIRG · CASSI]
    C --> E[Integrity layer<br/>MinHash-LSH · learned bot scorer]
    D & E --> F[Trust-weighted composite<br/>+ explainability traces]
    F --> G[FastAPI + JWT<br/>PostgreSQL]
    G --> H[React dashboard]
```

| Signal | What it measures | How |
|---|---|---|
| **Rn**, contagion | Is the story recruiting new posters faster than it loses them? | Renewal-equation estimator (Cori et al. 2013) on first-mention onsets, with a 95% credible interval |
| **CLI**, capitulation | Share of "I'm out, sold everything" posts | Lexicon classifier |
| **VDI**, language divergence | English vs Hinglish sentiment gap | Pooled z-scores |
| **CIRG**, reality check | Investor hype vs consumer reviews | Pooled z-scores |
| **CASSI**, spillover | How much one stock's sentiment is driven by others | VAR forecast-error variance decomposition |
| **Coordination** | Probability that the window contains a coordinated campaign | Logistic model on duplicate, timing and variance features |

Every index returns a real value or `null` with a coverage note. No placeholder values are filled in.

Full methodology, evaluation design and limitations: **[docs/architecture.md](docs/architecture.md)**.

## Tech stack

Python · PyTorch · Hugging Face Transformers · scikit-learn · statsmodels · pandas · FastAPI · SQLAlchemy · Alembic · PostgreSQL · JWT/bcrypt · APScheduler · React 19 · TypeScript · Vite · Tailwind · Recharts · Docker · GitHub Actions · Railway · Vercel

## Quick start

```bash
git clone https://github.com/GeoJeffrey/diverge.git && cd diverge
python -m venv .venv && source .venv/bin/activate     # Windows: .venv\Scripts\activate
pip install -r requirements.txt && pip install -e .

python run_all.py                 # scrape → features → indices → integrity → composite
python run_server.py --port 8000  # API on http://localhost:8000/docs
cd frontend && npm install && npm run dev               # dashboard on http://localhost:5173
```

Or run everything in containers: `docker compose up --build`. Without `DATABASE_URL`, the app uses a local SQLite file.

## Reproduce the evaluation

```bash
pip install -r requirements-eval.txt
python -m diverge.evaluation.run_all            # full run, ~1 h on a laptop GPU
python -m diverge.evaluation.run_all --quick    # CPU smoke run, ~10 min

# API latency (with the server running in another terminal)
python scripts/bench_api.py --requests 2000 --concurrency 32
python -m diverge.evaluation.run_all --render   # adds the latency table to RESULTS.md
```

| Step | Module | Data |
|---|---|---|
| Bot-campaign detection | `evaluation/coordination_benchmark.py` | Simulated, with ground truth (offline) |
| FinBERT fine-tuning | `evaluation/finetune_sentiment.py` | `zeroshot/twitter-financial-news-sentiment` train |
| Sentiment benchmark | `evaluation/sentiment_benchmark.py` | Same dataset, held-out validation split |
| Predictive backtest | `evaluation/backtest.py` | `mjw/stock_market_tweets` + Yahoo Finance; or `--source db` for your own scraped data |

## API

| Method | Endpoint | Auth |
|---|---|:-:|
| `GET` | `/health` | |
| `GET` | `/tickers`: monitored tickers with composite score and trust badge | |
| `GET` | `/ticker/{symbol}/simple`: plain-language summary card | |
| `POST` | `/auth/signup`, `/auth/login`, `/auth/refresh` | |
| `GET` | `/auth/me` | ✓ |
| `GET` | `/ticker/{symbol}`: all indices, coordination score, risk flags | ✓ |
| `GET` | `/ticker/{symbol}/reasoning`: post-level reasoning traces | ✓ |

The contract is frozen in [`docs/openapi.json`](docs/openapi.json); `scripts/diff_openapi.py` detects drift.

## Tests

```bash
pytest -q     # 77 tests: index maths, Rn recovery, LSH vs brute force, backtest leakage checks, API storage
```

CI runs a secret scan, the test suite, an offline benchmark smoke test and the frontend build on every push.

## Project layout

```
src/diverge/
  scrapers/        ingest (Reddit, StockTwits, Telegram, RSS, Trends, reviews)
  features/        sentiment, capitulation, sarcasm, language, timing/periodicity
  indices/         Rn, CLI, VDI, CIRG, CASSI
  integrity/       MinHash-LSH, coordination scorer (+ learned weights)
  aggregation/     composite score
  explainability/  reasoning traces, narrative phylogeny
  evaluation/      benchmarks, backtest, report generator
  api/ db/ auth/   FastAPI app, SQLAlchemy models, JWT
frontend/          React + Vite dashboard
reports/           generated results (RESULTS.md + JSON)
```

## License

MIT
