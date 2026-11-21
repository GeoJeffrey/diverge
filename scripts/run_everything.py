"""
run_everything.py

One command that reproduces every number in reports/RESULTS.md and checks the whole system:

  0. preflight    Python version, GPU, free disk, internet access to Hugging Face / Yahoo Finance
  1. tests        pytest
  2. evaluation   bot benchmark, FinBERT fine-tune, sentiment benchmark, backtest, outlook training
  3. pipeline     one live run: scrape -> features -> indices -> integrity -> outlook (fills the dashboard)
  4. api          start the API locally and load-test it
  5. frontend     npm ci + production build
  6. report       render reports/RESULTS.md

A failing step is recorded and the run continues. Logs go to reports/run_logs/.

    python scripts/run_everything.py            # full run (~2 h on a laptop GPU)
    python scripts/run_everything.py --quick    # smoke run (~15 min, CPU is fine)
    python scripts/run_everything.py --only api report
"""

import argparse
import os
import shutil
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LOGS = ROOT / "reports" / "run_logs"
PY = sys.executable
STEPS = ["preflight", "tests", "evaluation", "pipeline", "api", "frontend", "report"]


def run(name: str, cmd, cwd: Path = ROOT, env=None, timeout=None) -> bool:
    LOGS.mkdir(parents=True, exist_ok=True)
    log = LOGS / f"{name}.log"
    print(f"    $ {' '.join(map(str, cmd))}   (log: {log.relative_to(ROOT)})")
    with log.open("w", encoding="utf-8") as f:
        proc = subprocess.run(cmd, cwd=cwd, stdout=f, stderr=subprocess.STDOUT, env=env, timeout=timeout,
                              shell=os.name == "nt" and str(cmd[0]).startswith("npm"))
    if proc.returncode != 0:
        tail = log.read_text(encoding="utf-8", errors="replace").splitlines()[-15:]
        print("    " + "\n    ".join(tail))
    return proc.returncode == 0


def _reachable(url: str) -> bool:
    try:
        urllib.request.urlopen(urllib.request.Request(url, method="HEAD"), timeout=10)
        return True
    except urllib.error.HTTPError:
        return True  # reached the server
    except Exception:
        return False


def preflight(quick: bool) -> bool:
    ok = True
    v = sys.version_info
    print(f"    Python {v.major}.{v.minor}", "OK" if v >= (3, 10) else "-- need 3.10+")
    ok &= v >= (3, 10)
    try:
        import torch

        gpu = torch.cuda.get_device_name(0) if torch.cuda.is_available() else None
        print(f"    PyTorch {torch.__version__}, GPU: {gpu or 'none (CPU only)'}")
        if not gpu and not quick:
            print("    !! No CUDA GPU: the full run will be very slow. Install the CUDA build of PyTorch "
                  "or use --quick.")
    except ImportError:
        print("    !! PyTorch not installed (pip install torch --index-url https://download.pytorch.org/whl/cu121)")
        ok &= quick
    free_gb = shutil.disk_usage(ROOT).free / 1e9
    print(f"    Free disk: {free_gb:.0f} GB", "OK" if free_gb >= 10 else "-- need about 10 GB")
    ok &= free_gb >= 10
    for host in ["https://huggingface.co", "https://query1.finance.yahoo.com"]:
        r = _reachable(host)
        print(f"    {host}: {'reachable' if r else 'NOT reachable'}")
        ok &= r
    print(f"    npm: {'found' if shutil.which('npm') else 'not found (frontend step will be skipped)'}")
    return ok


def api_benchmark() -> bool:
    port = "8765"
    env = {**os.environ, "PYTHONPATH": str(ROOT / "src")}
    LOGS.mkdir(parents=True, exist_ok=True)
    server_log = (LOGS / "api_server.log").open("w", encoding="utf-8")
    server = subprocess.Popen([PY, "run_server.py", "--port", port], cwd=ROOT, stdout=server_log,
                              stderr=subprocess.STDOUT, env=env)
    try:
        for _ in range(60):
            if _reachable(f"http://127.0.0.1:{port}/health"):
                break
            time.sleep(1)
        else:
            print("    API did not start; see reports/run_logs/api_server.log")
            return False
        return run("api_bench", [PY, "scripts/bench_api.py", "--base-url", f"http://127.0.0.1:{port}",
                                 "--requests", "2000", "--concurrency", "32"], env=env)
    finally:
        server.terminate()
        server.wait(timeout=30)
        server_log.close()


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--quick", action="store_true")
    ap.add_argument("--only", nargs="*", choices=STEPS)
    a = ap.parse_args()
    steps = a.only or STEPS
    env = {**os.environ, "PYTHONPATH": str(ROOT / "src"), "PYTHONIOENCODING": "utf-8"}
    quick = ["--quick"] if a.quick else []

    status = {}
    t_all = time.perf_counter()
    for step in steps:
        print(f"\n==> {step}")
        t0 = time.perf_counter()
        if step == "preflight":
            ok = preflight(a.quick)
            if not ok and "evaluation" in steps:
                print("    Preflight found problems; fix them for a complete run (continuing anyway).")
        elif step == "tests":
            ok = run("tests", [PY, "-m", "pytest", "-q"], env=env)
        elif step == "evaluation":
            ok = run("evaluation", [PY, "-m", "diverge.evaluation.run_all", *quick], env=env)
        elif step == "pipeline":
            ok = run("pipeline", [PY, "run_all.py"], env=env, timeout=3 * 3600)
        elif step == "api":
            ok = api_benchmark()
        elif step == "frontend":
            if not shutil.which("npm"):
                status[step] = "skipped (npm not installed)"
                continue
            ok = run("frontend_install", ["npm", "ci"], cwd=ROOT / "frontend") and \
                run("frontend_build", ["npm", "run", "build"], cwd=ROOT / "frontend")
        else:  # report
            ok = run("report", [PY, "-m", "diverge.evaluation.run_all", "--render"], env=env)
        status[step] = f"{'OK' if ok else 'FAILED'} ({(time.perf_counter() - t0) / 60:.1f} min)"

    print("\n" + "=" * 60)
    for step, s in status.items():
        print(f"  {step:<11} {s}")
    print(f"  total       {(time.perf_counter() - t_all) / 60:.0f} min")
    print("=" * 60)
    print("\nResults: reports/RESULTS.md")
    print("Next (about 40 min, the step that lifts the bot detector to 'validated on real data'):")
    print("  python -m diverge.evaluation.label_windows")
    print("  python -m diverge.evaluation.label_windows --evaluate")
    print("  python -m diverge.evaluation.run_all --render")
    print("Then commit: reports/  src/diverge/outlook/outlook_model.json  src/diverge/integrity/learned_coordination_weights.json")


if __name__ == "__main__":
    main()
