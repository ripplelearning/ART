$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
function Read-Text([string]$name) { Get-Content (Join-Path $root $name) -Raw }
function Assert-All([string]$name, [string]$content, [string[]]$patterns, [string]$message) { foreach ($pattern in $patterns) { if ($content -notmatch $pattern) { throw "FAIL: [$name] $message Missing pattern: $pattern" } } }
$merge = Read-Text 'mergeConflictFramework.js'
$catalog = Read-Text 'commandCatalog.js'
$menu = Read-Text 'menuBar.js'
$state = Read-Text 'state.js'
$help = Read-Text 'HELP.md'
$userGuide = Read-Text 'USER-GUIDE.md'
$inAppHelp = Read-Text 'help.js'
$checks = @()
$checks += [pscustomobject]@{ Name = 'Three-way merge foundation'; Script = { Assert-All 'mergeConflictFramework.js' $merge @('threeWayMerge', 'mergeEntityCollections', 'MERGE_STATES', 'RESOLUTION_REQUIRED', 'automaticChanges') 'Three-way merge service is incomplete.' } }
$checks += [pscustomobject]@{ Name = 'Accessible conflict dialog'; Script = { Assert-All 'mergeConflictFramework.js' $merge @('merge-conflict-dialog', 'aria-modal', 'role="tablist"', 'Keep my version', 'Keep other version', 'Apply Merge', 'closeMergeConflictDialog') 'Conflict dialog is incomplete.' } }
$checks += [pscustomobject]@{ Name = 'Command integration'; Script = { Assert-All 'commandCatalog.js' $catalog @('openMergeConflicts', 'Tools>Collaboration') 'Merge conflict command is missing.'; Assert-All 'menuBar.js' $menu @('openMergeConflicts') 'Merge conflict menu entry is missing.'; Assert-All 'state.js' $state @('openMergeConflicts:\s*''''') 'Merge conflict shortcut registration is missing.' } }
$checks += [pscustomobject]@{ Name = 'Documentation coverage'; Script = { Assert-All 'HELP.md' $help @('## Merge Conflict Resolution', 'three-way merge') 'Merge conflict Help coverage is missing.'; Assert-All 'USER-GUIDE.md' $userGuide @('## Merge Conflict Resolution', 'Keep my version') 'Merge conflict User Guide coverage is missing.'; Assert-All 'help.js' $inAppHelp @('help-merge-conflicts', 'Merge Conflict Resolution') 'Merge conflict in-app Help is missing.' } }
Write-Host 'Epic 47 Verification'; Write-Host '--------------------'; $passed = 0; foreach ($check in $checks) { & $check.Script; Write-Host "PASS: $($check.Name)"; $passed++ }; Write-Host '--------------------'; Write-Host "Passed $passed of $($checks.Count) checks."
