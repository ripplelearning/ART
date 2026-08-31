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
$framework = Read-Text 'sharedProgressLogFramework.js'
$catalog = Read-Text 'commandCatalog.js'
$menuBar = Read-Text 'menuBar.js'
$help = Read-Text 'HELP.md'
$userGuide = Read-Text 'USER-GUIDE.md'
$inAppHelp = Read-Text 'help.js'

$checks = @()

$checks += [pscustomobject]@{ Name = 'Stable shared Progress Log data model'; Script = {
    Assert-All 'state.js' $state @(
        'sharedProgressLogs',
        'normalizeSharedProgressLog',
        'normalizeSharedProgressTask',
        'normalizeSharedProgressComment',
        'createSharedProgressLog',
        'addSharedProgressTask',
        'addSharedProgressComment',
        'setSharedProgressLogReportAssociations'
    ) 'Shared Progress Log state APIs or stable record identifiers are incomplete.'
}}

$checks += [pscustomobject]@{ Name = 'Local file-based portability'; Script = {
    Assert-All 'state.js' $state @(
        'sharedProgressLogs: appState\.sharedProgressLogs',
        'createArtProjectPayload',
        'importArtProjectPayload'
    ) 'Shared Progress Logs are not retained in portable project data.'
}}

$checks += [pscustomobject]@{ Name = 'Accessible Shared Progress Log dialog'; Script = {
    Assert-All 'sharedProgressLogFramework.js' $framework @(
        'shared-progress-log-dialog',
        'aria-modal',
        'aria-live',
        'Associated Reports',
        'data-shared-progress-status',
        'data-shared-progress-add-comment',
        'closeSharedProgressLogs'
    ) 'Shared Progress Log dialog behavior is incomplete.'
}}

$checks += [pscustomobject]@{ Name = 'Command and shortcut integration'; Script = {
    Assert-All 'commandCatalog.js' $catalog @(
        'action:\s*''openSharedProgressLogs''',
        'Tools>Progress Log'
    ) 'Shared Progress Logs command is incomplete.'
    Assert-All 'menuBar.js' $menuBar @('openSharedProgressLogs') 'Shared Progress Logs menu location is missing.'
    Assert-All 'state.js' $state @('openSharedProgressLogs:\s*''''') 'Shared Progress Logs shortcut registration is missing.'
}}

$checks += [pscustomobject]@{ Name = 'Help and User Guide coverage'; Script = {
    Assert-All 'HELP.md' $help @('## Shared Progress Logs', 'local/file-based', 'Epics 45, 49, 50, and 51') 'Shared Progress Log Help coverage is incomplete.'
    Assert-All 'USER-GUIDE.md' $userGuide @('## Shared Progress Logs', 'Creating and Managing a Shared Progress Log', 'Current Collaboration Boundary') 'Shared Progress Log User Guide coverage is incomplete.'
    Assert-All 'help.js' $inAppHelp @('help-shared-progress-logs', 'Shared Progress Logs') 'Shared Progress Log in-app help is missing.'
}}

Write-Host 'Epic 44 Verification'
Write-Host '--------------------'
$passed = 0
foreach ($check in $checks) {
    & $check.Script
    Write-Host "PASS: $($check.Name)"
    $passed++
}
Write-Host '--------------------'
Write-Host "Passed $passed of $($checks.Count) checks."
