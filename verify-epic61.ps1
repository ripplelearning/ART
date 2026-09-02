$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
function Read-Text([string]$name) { Get-Content (Join-Path $root $name) -Raw }
function Assert-All([string]$name, [string]$content, [string[]]$patterns, [string]$message) { foreach ($pattern in $patterns) { if ($content -notmatch $pattern) { throw "FAIL: [$name] $message Missing pattern: $pattern" } } }
$collaboration = Read-Text 'advancedCollaborationFramework.js'
$dashboard = Read-Text 'dashboard.js'
$loader = Read-Text 'loader.js'
$help = Read-Text 'HELP.md'
$userGuide = Read-Text 'USER-GUIDE.md'
$inAppHelp = Read-Text 'help.js'
$checks = @()
$checks += [pscustomobject]@{ Name = 'Local collaboration sessions and attribution'; Script = {
    Assert-All 'advancedCollaborationFramework.js' $collaboration @('startCollaborationSession', 'endCollaborationSession', 'currentActor', 'userId', 'deviceId', 'participants') 'Local collaboration session model is incomplete.'
} }
$checks += [pscustomobject]@{ Name = 'Revision history and recoverable operation queue'; Script = {
    Assert-All 'advancedCollaborationFramework.js' $collaboration @('recordLocalCollaborationRevision', 'contentHash', 'parentRevisionId', 'queueCollaborationOperation', 'getPendingCollaborationOperations', 'resolveCollaborationOperation') 'Collaboration revision or operation queue is incomplete.'
} }
$checks += [pscustomobject]@{ Name = 'Conflict and synchronization status propagation'; Script = {
    Assert-All 'advancedCollaborationFramework.js' $collaboration @('markStorageConflict', 'markStorageSyncFailure', 'markStorageSynchronized', 'markLocalStorageChangesPending') 'Collaboration status propagation is incomplete.'
} }
$checks += [pscustomobject]@{ Name = 'ART project workflow integration'; Script = {
    Assert-All 'dashboard.js' $dashboard @('startCollaborationSession', 'recordLocalCollaborationRevision', 'openProjectFromText') 'Project opening does not initialize collaboration attribution/revision tracking.'
    Assert-All 'loader.js' $loader @('initializeAdvancedCollaborationFramework') 'Advanced collaboration framework is not initialized at startup.'
} }
$checks += [pscustomobject]@{ Name = 'Help and User Guide coverage'; Script = {
    Assert-All 'HELP.md' $help @('## Advanced Collaboration and Synchronization', 'content hashes', 'pending operations') 'Collaboration Help coverage is incomplete.'
    Assert-All 'USER-GUIDE.md' $userGuide @('## Advanced Collaboration and Synchronization', 'local collaboration session') 'Collaboration User Guide coverage is incomplete.'
    Assert-All 'help.js' $inAppHelp @('help-advanced-collaboration', 'local collaboration session') 'Collaboration in-app Help is missing.'
} }
Write-Host 'Epic 61 Verification'
Write-Host '--------------------'
$passed = 0
foreach ($check in $checks) { & $check.Script; Write-Host "PASS: $($check.Name)"; $passed++ }
Write-Host '--------------------'
Write-Host "Passed $passed of $($checks.Count) checks."
