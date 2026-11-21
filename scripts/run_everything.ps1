# One-shot setup + full run on Windows (PowerShell). From the repository root:
#   powershell -ExecutionPolicy Bypass -File scripts\run_everything.ps1
#   powershell -ExecutionPolicy Bypass -File scripts\run_everything.ps1 -Quick
param([switch]$Quick)
$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)
$env:PYTHONIOENCODING = "utf-8"

if (-not (Test-Path ".venv")) {
    Write-Host "Creating virtual environment (.venv)..."
    python -m venv .venv
}
$py = ".\.venv\Scripts\python.exe"
& $py -m pip install --upgrade pip | Out-Null

# CUDA build of PyTorch for the RTX GPU (skipped if a CUDA build >= 2.6 is already installed;
# transformers 5 refuses to load models with older torch, and the cu121 channel stops at 2.5.1).
# Must not write to stderr when torch is missing: Windows PowerShell 5.1 + "Stop" turns native stderr into a fatal error.
$hasCuda = & $py -c "import importlib.util,sys; t=importlib.util.find_spec('torch') and __import__('torch'); sys.stdout.write(str(bool(t) and t.cuda.is_available() and tuple(map(int, t.__version__.split('+')[0].split('.')[:2])) >= (2, 6)))"
if ($hasCuda -ne "True") {
    Write-Host "Installing PyTorch with CUDA 12.6..."
    & $py -m pip install --upgrade "torch>=2.6" --index-url https://download.pytorch.org/whl/cu126
}
Write-Host "Installing project + evaluation dependencies..."
& $py -m pip install -r requirements-eval.txt
& $py -m pip install -e .

if ($Quick) { & $py scripts\run_everything.py --quick } else { & $py scripts\run_everything.py }
