$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $MyInvocation.MyCommand.Path

function Run-VerifyScript([string]$name) {
    $path = Join-Path $root $name
    if (-not (Test-Path $path)) {
        throw "FAIL: Missing verification script $name"
    }

    Write-Host "Running $name"
    Write-Host ('-' * (8 + $name.Length))
    powershell -ExecutionPolicy Bypass -File $path
    if ($LASTEXITCODE -ne 0) {
        throw "FAIL: $name exited with code $LASTEXITCODE"
    }
    Write-Host ''
}

Write-Host 'ART Verification Bundle'
Write-Host '======================='
Run-VerifyScript 'verify-epic13.ps1'
Run-VerifyScript 'verify-epic20.ps1'
Run-VerifyScript 'verify-epic21.ps1'
Write-Host 'All verification scripts passed.'
