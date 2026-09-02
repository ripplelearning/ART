$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
function Read-Text([string]$name) { Get-Content (Join-Path $root $name) -Raw }
function Assert-All([string]$name, [string]$content, [string[]]$patterns, [string]$message) {
    foreach ($pattern in $patterns) {
        if ($content -notmatch $pattern) { throw "FAIL: [$name] $message Missing pattern: $pattern" }
    }
}
$metrics = Read-Text 'organizationMetricsFramework.js'
$dashboard = Read-Text 'organizationDashboard.js'
$dashboardView = Read-Text 'dashboard.js'
$help = Read-Text 'help.js'
$userGuide = Read-Text 'USER-GUIDE.md'
$checks = @()
$checks += [pscustomobject]@{ Name = 'Authorized organization metric calculation'; Script = {
    Assert-All 'organizationMetricsFramework.js' $metrics @('buildOrganizationIndex', 'authorize', 'calculateOrganizationMetrics', 'METRIC_AVAILABILITY', 'taskSummary') 'Authorized metric calculation is incomplete.'
} }
$checks += [pscustomobject]@{ Name = 'Task and finding metrics'; Script = {
    Assert-All 'organizationMetricsFramework.js' $metrics @('tasksByStatus', 'tasksByPriority', 'totalFindings', 'findingsByStatus', 'remediationProgress') 'Task or finding metrics are incomplete.'
} }
$checks += [pscustomobject]@{ Name = 'Accessible dashboard controls and tables'; Script = {
    Assert-All 'organizationDashboard.js' $dashboard @('organization-statistics-dialog', 'organization-tablist', 'organization-metrics-table', 'aria-live', 'btn-organization-export-csv') 'Organization Metrics dashboard accessibility or export support is incomplete.'
    Assert-All 'dashboard.js' $dashboardView @('taskSummary', 'Open Organization Statistics') 'Dashboard summary integration is incomplete.'
} }
$checks += [pscustomobject]@{ Name = 'Freshness, snapshots, and saved views'; Script = {
    Assert-All 'organizationDashboard.js' $dashboard @('recordOrganizationMetricSnapshot', 'getOrganizationMetricSnapshots', 'getOrganizationSavedViews', 'Save View', 'Record Snapshot') 'Metric freshness or working-view support is incomplete.'
} }
$checks += [pscustomobject]@{ Name = 'Documentation coverage'; Script = {
    Assert-All 'help.js' $help @('help-organization-statistics', 'Organization Statistics') 'In-app Organization Metrics documentation is incomplete.'
    Assert-All 'USER-GUIDE.md' $userGuide @('Organization Statistics', 'Data Quality') 'User Guide Organization Metrics documentation is incomplete.'
} }
Write-Host 'Epic 65 Verification'
Write-Host '--------------------'
$passed = 0
foreach ($check in $checks) { & $check.Script; Write-Host "PASS: $($check.Name)"; $passed++ }
Write-Host '--------------------'
Write-Host "Passed $passed of $($checks.Count) checks."
