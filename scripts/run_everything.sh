#!/usr/bin/env bash
# One-shot setup + full run on Linux/macOS. Usage: bash scripts/run_everything.sh [--quick]
set -euo pipefail
cd "$(dirname "$0")/.."
[ -d .venv ] || python3 -m venv .venv
PY=.venv/bin/python
$PY -m pip install --upgrade pip >/dev/null
$PY -c "import torch" 2>/dev/null || $PY -m pip install torch
$PY -m pip install -r requirements-eval.txt
$PY -m pip install -e .
$PY scripts/run_everything.py "$@"
