$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Error 'Node.js is required (v24+ or v26+). Install Node.js and try again.'
    exit 1
}

if (-not (Test-Path (Join-Path $PSScriptRoot 'node_modules'))) {
    Write-Host 'Installing dependencies...'
    & npm install
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

& node (Join-Path $PSScriptRoot 'scripts/dev.ts') @args
exit $LASTEXITCODE
