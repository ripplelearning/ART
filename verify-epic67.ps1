$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
function Read-Text([string]$name) { Get-Content (Join-Path $root $name) -Raw }
function Assert-All([string]$name, [string]$content, [string[]]$patterns, [string]$message) {
    foreach ($pattern in $patterns) {
        if ($content -notmatch $pattern) { throw "FAIL: [$name] $message Missing pattern: $pattern" }
    }
}
$focus = Read-Text 'focusManagement.js'
$dashboardFramework = Read-Text 'dashboardWidgetFramework.js'
$dashboard = Read-Text 'dashboard.js'
$tasks = Read-Text 'taskFramework.js'
$workingViews = Read-Text 'reportViewsFramework.js'
$help = Read-Text 'HELP.md'
$userGuide = Read-Text 'USER-GUIDE.md'
$checks = @()
$checks += [pscustomobject]@{ Name = 'Central focus utilities'; Script = {
    Assert-All 'focusManagement.js' $focus @('resolveFocusTarget', 'focusElement', 'restoreFocus', 'preventScroll') 'Central focus management utilities are incomplete.'
} }
$checks += [pscustomobject]@{ Name = 'Dashboard focus preservation'; Script = {
    Assert-All 'dashboardWidgetFramework.js' $dashboardFramework @('captureDashboardFocus', 'restoreDashboardFocus', 'CSS.escape', 'preventScroll') 'Dashboard rerender focus preservation is incomplete.'
    Assert-All 'dashboard.js' $dashboard @('data-dashboard-task-complete', 'nextTask', 'preventScroll') 'Dashboard task focus fallback is incomplete.'
} }
$checks += [pscustomobject]@{ Name = 'Tasks and working-view focus preservation'; Script = {
    Assert-All 'taskFramework.js' $tasks @('focusState', 'data-task-status', 'data-task-complete', 'preventScroll') 'Tasks rerender focus preservation is incomplete.'
    Assert-All 'reportViewsFramework.js' $workingViews @('activeElementBeforeRender', 'preserveFocusId') 'Working-view focus preservation is incomplete.'
} }
$checks += [pscustomobject]@{ Name = 'Accessible interaction foundations'; Script = {
    Assert-All 'focusManagement.js' $focus @('candidate.focus', 'document.activeElement') 'Focus verification is incomplete.'
    Assert-All 'taskFramework.js' $tasks @('Escape', 'aria-live', 'role="tablist"') 'Task keyboard and announcement foundations are incomplete.'
} }
$checks += [pscustomobject]@{ Name = 'Accessibility documentation'; Script = {
    Assert-All 'HELP.md' $help @('Keyboard Focus', 'focus', 'screen reader') 'Help accessibility guidance is incomplete.'
    Assert-All 'USER-GUIDE.md' $userGuide @('Keyboard Focus', 'focus') 'User Guide accessibility guidance is incomplete.'
} }
Write-Host 'Epic 67 Verification'
Write-Host '--------------------'
$passed = 0
foreach ($check in $checks) { & $check.Script; Write-Host "PASS: $($check.Name)"; $passed++ }
Write-Host '--------------------'
Write-Host "Passed $passed of $($checks.Count) checks."
