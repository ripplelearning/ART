$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
function Read-Text([string]$name) { Get-Content (Join-Path $root $name) -Raw }
function Assert-All([string]$name, [string]$content, [string[]]$patterns, [string]$message) { foreach ($pattern in $patterns) { if ($content -notmatch $pattern) { throw "FAIL: [$name] $message Missing pattern: $pattern" } } }
$sync = Read-Text 'storageSynchronizationFramework.js'
$dashboard = Read-Text 'dashboard.js'
$indexHtml = Read-Text 'index.html'
$loader = Read-Text 'loader.js'
$help = Read-Text 'HELP.md'
$userGuide = Read-Text 'USER-GUIDE.md'
$inAppHelp = Read-Text 'help.js'
$checks = @()
$checks += [pscustomobject]@{ Name = 'Provider-neutral synchronization state machine'; Script = {
    Assert-All 'storageSynchronizationFramework.js' $sync @('SYNC_STATES', 'getStorageSyncStatus', 'updateStorageSyncStatus', 'markStorageSynchronized', 'markStorageConflict', 'markStorageSyncFailure') 'Synchronization state machine is incomplete.'
} }
$checks += [pscustomobject]@{ Name = 'Safe Refresh and Synchronize workflows'; Script = {
    Assert-All 'storageSynchronizationFramework.js' $sync @('refreshActiveStorage', 'synchronizeActiveStorage', 'hasUnsavedProjectChanges', 'Your local work is unchanged') 'Safe storage workflows are incomplete.'
} }
$checks += [pscustomobject]@{ Name = 'Offline and reconnection handling'; Script = {
    Assert-All 'storageSynchronizationFramework.js' $sync @("addEventListener\('online'", "addEventListener\('offline'", "status: 'offline'", 'Connection restored') 'Offline handling is incomplete.'
} }
$checks += [pscustomobject]@{ Name = 'Dashboard status and controls'; Script = {
    Assert-All 'index.html' $indexHtml @('storage-sync-status-panel', 'storage-sync-status', 'btn-storage-refresh', 'btn-storage-synchronize') 'Dashboard synchronization controls are missing.'
    Assert-All 'dashboard.js' $dashboard @('renderStorageSynchronizationPanel', 'refreshActiveStorage', 'synchronizeActiveStorage', 'art-storage-sync-updated') 'Dashboard synchronization wiring is incomplete.'
} }
$checks += [pscustomobject]@{ Name = 'Startup initialization'; Script = {
    Assert-All 'loader.js' $loader @('initializeStorageSynchronizationFramework') 'Synchronization framework is not initialized at startup.'
} }
$checks += [pscustomobject]@{ Name = 'Help and User Guide coverage'; Script = {
    Assert-All 'HELP.md' $help @('## Storage and Synchronization', 'Offline') 'Storage synchronization Help coverage is incomplete.'
    Assert-All 'USER-GUIDE.md' $userGuide @('## Storage and Synchronization', 'Refresh Storage') 'Storage synchronization User Guide coverage is incomplete.'
    Assert-All 'help.js' $inAppHelp @('Storage and Synchronization section identifies') 'Storage synchronization in-app Help is missing.'
} }
Write-Host 'Epic 56 Verification'
Write-Host '--------------------'
$passed = 0
foreach ($check in $checks) { & $check.Script; Write-Host "PASS: $($check.Name)"; $passed++ }
Write-Host '--------------------'
Write-Host "Passed $passed of $($checks.Count) checks."
