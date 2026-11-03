$ErrorActionPreference = "Stop"

$backendRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$python = Join-Path $backendRoot ".venv\Scripts\python.exe"

if (-not (Test-Path -LiteralPath $python)) {
    throw "Ambiente virtual não encontrado em $python. Crie-o com: py -3.12 -m venv .venv"
}

Set-Location $backendRoot
& $python app.py
