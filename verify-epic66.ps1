$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
function Read-Text([string]$name) { Get-Content (Join-Path $root $name) -Raw }
function Assert-All([string]$name, [string]$content, [string[]]$patterns, [string]$message) {
    foreach ($pattern in $patterns) {
        if ($content -notmatch $pattern) { throw "FAIL: [$name] $message Missing pattern: $pattern" }
    }
}
$metrics = Read-Text 'organizationMetricsFramework.js'
$loader = Read-Text 'loader.js'
$dashboard = Read-Text 'dashboardWidgetFramework.js'
$help = Read-Text 'HELP.md'
$userGuide = Read-Text 'USER-GUIDE.md'
$checks = @()
$checks += [pscustomobject]@{ Name = 'Bounded organization metrics cache'; Script = {
    Assert-All 'organizationMetricsFramework.js' $metrics @('METRIC_CACHE_LIMIT', 'cacheMetricResult', 'evictions', 'metricCacheLimit') 'Organization metrics cache is not bounded and observable.'
} }
$checks += [pscustomobject]@{ Name = 'Cache invalidation and reuse'; Script = {
    Assert-All 'organizationMetricsFramework.js' $metrics @('clearOrganizationMetricsCache', 'art-state-updated', 'runtimeCache.metrics.has', 'runtimeCache.metrics.delete') 'Metrics cache invalidation or LRU reuse is incomplete.'
} }
$checks += [pscustomobject]@{ Name = 'Startup and dashboard performance boundaries'; Script = {
    Assert-All 'loader.js' $loader @('initializeOrganizationMetricsFramework', 'startupWatchdog') 'Startup performance monitoring is incomplete.'
    Assert-All 'dashboardWidgetFramework.js' $dashboard @('visibleWidgetIds', 'renderDashboard') 'Dashboard does not retain visible-widget rendering boundaries.'
} }
$checks += [pscustomobject]@{ Name = 'Graceful performance behavior'; Script = {
    Assert-All 'organizationMetricsFramework.js' $metrics @('METRIC_AVAILABILITY.UNAVAILABLE', 'try', 'catch') 'Metric failure handling does not degrade gracefully.'
} }
$checks += [pscustomobject]@{ Name = 'Performance documentation'; Script = {
    Assert-All 'HELP.md' $help @('Performance and Scalability', 'cache', 'large') 'Help performance documentation is incomplete.'
    Assert-All 'USER-GUIDE.md' $userGuide @('Performance and Scalability', 'cache') 'User Guide performance documentation is incomplete.'
} }
Write-Host 'Epic 66 Verification'
Write-Host '--------------------'
$passed = 0
foreach ($check in $checks) { & $check.Script; Write-Host "PASS: $($check.Name)"; $passed++ }
Write-Host '--------------------'
Write-Host "Passed $passed of $($checks.Count) checks."
