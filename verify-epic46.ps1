$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
function Read-Text([string]$name) { Get-Content (Join-Path $root $name) -Raw }
function Assert-All([string]$name, [string]$content, [string[]]$patterns, [string]$message) {
    foreach ($pattern in $patterns) {
        if ($content -notmatch $pattern) { throw "FAIL: [$name] $message Missing pattern: $pattern" }
    }
}
$state = Read-Text 'state.js'
$tasks = Read-Text 'taskFramework.js'
$dashboard = Read-Text 'dashboard.js'
$catalog = Read-Text 'commandCatalog.js'
$menu = Read-Text 'menuBar.js'
$help = Read-Text 'HELP.md'
$userGuide = Read-Text 'USER-GUIDE.md'
$inAppHelp = Read-Text 'help.js'
$checks = @()
$checks += [pscustomobject]@{ Name = 'Unified local task data model'; Script = {
    Assert-All 'state.js' $state @('taskManager', 'normalizeTask\(', 'createTask', 'updateTask', 'setTaskCompleted', 'deleteTask', 'deferredUntil', 'reminderAt') 'Local task model is incomplete.'
}}
$checks += [pscustomobject]@{ Name = 'Accessible Tasks and To-Do dialog'; Script = {
    Assert-All 'taskFramework.js' $tasks @('tasks-dialog', 'role="tablist"', 'role="tabpanel"', 'data-task-complete', 'data-task-status', 'data-task-priority', 'data-task-comments', 'Completed Tasks') 'Tasks dialog is incomplete.'
}}
$checks += [pscustomobject]@{ Name = 'Command and Dashboard integration'; Script = {
    Assert-All 'commandCatalog.js' $catalog @('action:\s*''openTasks''', 'Tools>Tasks and To-Do') 'Tasks command is missing.'
    Assert-All 'menuBar.js' $menu @('openTasks') 'Tasks menu location is missing.'
    Assert-All 'state.js' $state @('openTasks:\s*''''') 'Tasks shortcut registration is missing.'
    Assert-All 'dashboard.js' $dashboard @('renderTasksWidget', 'To-Do List', 'btn-dashboard-open-tasks') 'Dashboard To-Do widget is missing.'
}}
$checks += [pscustomobject]@{ Name = 'Help and User Guide coverage'; Script = {
    Assert-All 'HELP.md' $help @('## Tasks and To-Do', 'Deferred', 'Epics 49, 50, and 51') 'Tasks Help coverage is incomplete.'
    Assert-All 'USER-GUIDE.md' $userGuide @('## Tasks and To-Do', 'Managing Local Tasks', 'Dashboard To-Do List') 'Tasks User Guide coverage is incomplete.'
    Assert-All 'help.js' $inAppHelp @('help-tasks-and-todo', 'Tasks and To-Do') 'Tasks in-app Help is missing.'
}}
Write-Host 'Epic 46 Verification'
Write-Host '--------------------'
$passed = 0
foreach ($check in $checks) { & $check.Script; Write-Host "PASS: $($check.Name)"; $passed++ }
Write-Host '--------------------'
Write-Host "Passed $passed of $($checks.Count) checks."
