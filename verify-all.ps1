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
Run-VerifyScript 'verify-epic34.ps1'
Run-VerifyScript 'verify-epic39.ps1'
Run-VerifyScript 'verify-epic40.ps1'
Run-VerifyScript 'verify-epic43.ps1'
Run-VerifyScript 'verify-epic44.ps1'
Run-VerifyScript 'verify-epic45.ps1'
Run-VerifyScript 'verify-epic46.ps1'
Run-VerifyScript 'verify-epic47.ps1'
Run-VerifyScript 'verify-epic48.ps1'
Run-VerifyScript 'verify-epic51.ps1'
Run-VerifyScript 'verify-epic52.ps1'
Run-VerifyScript 'verify-epic53.ps1'
Run-VerifyScript 'verify-epic54.ps1'
Run-VerifyScript 'verify-epic55.ps1'
Run-VerifyScript 'verify-epic56.ps1'
Run-VerifyScript 'verify-epic57.ps1'
Run-VerifyScript 'verify-epic58.ps1'
Run-VerifyScript 'verify-epic59.ps1'
Run-VerifyScript 'verify-epic61.ps1'
Run-VerifyScript 'verify-epic62.ps1'
Run-VerifyScript 'verify-epic63.ps1'
Write-Host 'All verification scripts passed.'
