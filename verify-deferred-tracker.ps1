$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$path = Join-Path $root 'art-feedback-issues.json'
if (-not (Test-Path $path)) { throw 'FAIL: Missing art-feedback-issues.json.' }
$payload = Get-Content $path -Raw | ConvertFrom-Json
$issues = @($payload.issues)
if ($issues.Count -ne 33) { throw "FAIL: Expected 33 deferred epic issues, found $($issues.Count)." }
$missing = @($issues | Where-Object { ($_.status -notin @('Deferred', 'In Progress')) -or [string]::IsNullOrWhiteSpace($_.documentationUrl) -or [string]::IsNullOrWhiteSpace($_.id) -or [string]::IsNullOrWhiteSpace($_.summary) })
if ($missing.Count -gt 0) { throw "FAIL: $($missing.Count) deferred issues lack a stable ID, Deferred status, summary, or documentation link." }
$epicNumbers = @($issues | ForEach-Object { if ($_.id -match '^deferred-epic-(\d+)$') { [int]$Matches[1] } }) | Sort-Object
$expected = 41..73
$actualCoverage = @($epicNumbers) -join ','
$expectedCoverage = @($expected) -join ','
if ($actualCoverage -ne $expectedCoverage) { throw 'FAIL: Deferred issue IDs do not cover every Epic 41 through Epic 73.' }
Write-Host 'Deferred Tracker Verification'
Write-Host '----------------------------'
Write-Host 'PASS: 33 issues cover Epics 41 through 73.'
Write-Host 'PASS: Every issue has Deferred or In Progress status, a stable ID, and a documentation link.'
Write-Host 'PASS: Repository tracker JSON is valid.'
Write-Host '----------------------------'
Write-Host 'Passed 3 of 3 checks.'
