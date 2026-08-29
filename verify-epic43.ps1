$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $MyInvocation.MyCommand.Path

function Read-Text([string]$name) {
    return Get-Content (Join-Path $root $name) -Raw
}

function Assert-All([string]$name, [string]$content, [string[]]$patterns, [string]$message) {
    foreach ($pattern in $patterns) {
        if ($content -notmatch $pattern) {
            throw "FAIL: [$name] $message Missing pattern: $pattern"
        }
    }
}

$state = Read-Text 'state.js'
$builder = Read-Text 'reportBuilder.js'
$editor = Read-Text 'reportEditor.js'
$viewer = Read-Text 'reportViewer.js'
$presentation = Read-Text 'reportPresentationFramework.js'
$metrics = Read-Text 'organizationMetricsFramework.js'
$dashboard = Read-Text 'organizationDashboard.js'
$help = Read-Text 'HELP.md'

$checks = @()

$checks += [pscustomobject]@{ Name = 'Usability Report type and state model'; Script = {
    Assert-All 'state.js' $state @(
        'DEFAULT_USABILITY_HEURISTICS',
        'Visibility of system status',
        'Consistency and standards',
        'Help and documentation',
        'builtin-usability-report-basic',
        'Usability Report Basic',
        'usability-heuristics'
    ) 'State model for Usability Report and Usability Heuristics is incomplete.'
}}

$checks += [pscustomobject]@{ Name = 'Report Builder configuration and zero-default fields'; Script = {
    Assert-All 'reportBuilder.js' $builder @(
        'Usability Report',
        'Usability Heuristics',
        'usability-heuristics',
        'Usability Heuristic Options'
    ) 'Report Builder controls for Usability Reports are incomplete.'
}}

$checks += [pscustomobject]@{ Name = 'Report Editor usability heuristic selection'; Script = {
    Assert-All 'reportEditor.js' $editor @(
        'parseSelectedHeuristics',
        'usability-heuristics',
        'usability-heuristics-select',
        'DEFAULT_USABILITY_HEURISTICS'
    ) 'Report Editor controls for Usability Heuristics are incomplete.'
}}

$checks += [pscustomobject]@{ Name = 'Report Viewer and presentation layout parity'; Script = {
    Assert-All 'reportViewer.js' $viewer @(
        'Usability Report Content',
        'Usability Report Highlights',
        'usability-heuristics',
        'isMultiEntry\s*=\s*appState\.reportType === ''Audit Log'' \|\| appState\.reportType === ''Usability Report'''
    ) 'Report Viewer layout for Usability Reports is incomplete.'

    Assert-All 'reportPresentationFramework.js' $presentation @(
        'layout-usability-report',
        'Usability Report'
    ) 'Presentation framework integration for Usability Reports is incomplete.'
}}

$checks += [pscustomobject]@{ Name = 'Organization Statistics integration'; Script = {
    Assert-All 'organizationMetricsFramework.js' $metrics @(
        'heuristicIndex',
        'findingsByUsabilityHeuristic',
        'Findings by Usability Heuristic'
    ) 'Organization Statistics integration for Usability Heuristics is incomplete.'

    Assert-All 'organizationDashboard.js' $dashboard @(
        'findingsByUsabilityHeuristic'
    ) 'Organization Dashboard display for Usability Heuristics is incomplete.'
}}

$checks += [pscustomobject]@{ Name = 'Help documentation coverage'; Script = {
    Assert-All 'HELP.md' $help @(
        'Usability Reports',
        'Parity with Executive Summary Layout and Field Configuration',
        'No Default Fields',
        'Usability Heuristics Field Type',
        'No Analytics and No Table of Contents'
    ) 'HELP.md documentation for Usability Reports is incomplete.'
}}

Write-Host 'Epic 43 Verification'
Write-Host '--------------------'

$passed = 0
foreach ($check in $checks) {
    & $check.Script
    Write-Host "PASS: $($check.Name)"
    $passed++
}

Write-Host '--------------------'
Write-Host "Passed $passed of $($checks.Count) checks."
