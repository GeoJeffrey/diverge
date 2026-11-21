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

# CUDA build of PyTorch for the RTX GPU (skipped if a CUDA build is already installed)
$hasCuda = & $py -c "import torch,sys; sys.stdout.write(str(torch.cuda.is_available()))" 2>$null
if ($hasCuda -ne "True") {
    Write-Host "Installing PyTorch with CUDA 12.1..."
    & $py -m pip install torch --index-url https://download.pytorch.org/whl/cu121
}
Write-Host "Installing project + evaluation dependencies..."
& $py -m pip install -r requirements-eval.txt
& $py -m pip install -e .

if ($Quick) { & $py scripts\run_everything.py --quick } else { & $py scripts\run_everything.py }
