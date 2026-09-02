$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
function Read-Text([string]$name) { Get-Content (Join-Path $root $name) -Raw }
function Assert-All([string]$name, [string]$content, [string[]]$patterns, [string]$message) { foreach ($pattern in $patterns) { if ($content -notmatch $pattern) { throw "FAIL: [$name] $message Missing pattern: $pattern" } } }
$googleDrive = Read-Text 'googleDriveStorageProvider.js'
$storage = Read-Text 'storageProviderFramework.js'
$settings = Read-Text 'settings.js'
$indexHtml = Read-Text 'index.html'
$dashboard = Read-Text 'dashboard.js'
$commandCatalog = Read-Text 'commandCatalog.js'
$state = Read-Text 'state.js'
$help = Read-Text 'HELP.md'
$userGuide = Read-Text 'USER-GUIDE.md'
$inAppHelp = Read-Text 'help.js'
$checks = @()
$checks += [pscustomobject]@{ Name = 'Google Drive OAuth and least-privilege scope'; Script = {
    Assert-All 'googleDriveStorageProvider.js' $googleDrive @('connectGoogleDrive', 'disconnectGoogleDrive', 'getGoogleDriveConnectionStatus', "drive\.file", 'sessionStorage') 'Google Drive OAuth foundation is incomplete.'
} }
$checks += [pscustomobject]@{ Name = 'Google Drive Files API wrapper'; Script = {
    Assert-All 'googleDriveStorageProvider.js' $googleDrive @('listArtFiles', 'downloadArtFileContent', 'createArtFile', 'updateArtFile') 'Google Drive file operations are incomplete.'
} }
$checks += [pscustomobject]@{ Name = 'No hard-coded client credentials'; Script = {
    Assert-All 'googleDriveStorageProvider.js' $googleDrive @('getGoogleDriveClientId', 'setGoogleDriveClientId') 'Google Drive Client ID must be user/administrator-configured, not hard-coded.'
    if ($googleDrive -match "client_id\s*:\s*'[A-Za-z0-9]") { throw 'FAIL: [googleDriveStorageProvider.js] A Google OAuth Client ID appears to be hard-coded.' }
} }
$checks += [pscustomobject]@{ Name = 'Wired into Storage Provider Architecture (Epic 52)'; Script = {
    Assert-All 'storageProviderFramework.js' $storage @('connectGoogleDrive', 'disconnectGoogleDrive', 'refreshGoogleDriveProviderStatus') 'Google Drive is not wired into the Epic 52 storage provider registry.'
} }
$checks += [pscustomobject]@{ Name = 'Settings UI integration'; Script = {
    Assert-All 'index.html' $indexHtml @('settings-google-drive-client-id', 'btn-settings-google-drive-connect', 'btn-settings-google-drive-disconnect') 'Google Drive Settings UI is missing.'
    Assert-All 'settings.js' $settings @('renderStorageProviderSettings', 'connectGoogleDrive', 'disconnectGoogleDrive', 'setGoogleDriveClientId') 'Settings wiring for Google Drive is incomplete.'
} }
$checks += [pscustomobject]@{ Name = 'Open/Save Google Drive project commands'; Script = {
    Assert-All 'dashboard.js' $dashboard @('openDashboardProjectFromGoogleDriveFromCommand', 'saveDashboardProjectToGoogleDriveFromCommand', 'listArtFiles', 'downloadArtFileContent', 'createArtFile', 'updateArtFile') 'Google Drive open/save workflow is not wired into the Dashboard.'
    Assert-All 'index.html' $indexHtml @('btn-open-project-google-drive', 'btn-save-project-google-drive', 'google-drive-open-dialog') 'Google Drive open/save Dashboard controls are missing.'
    Assert-All 'commandCatalog.js' $commandCatalog @("action:\s*'openProjectFromGoogleDrive'", "action:\s*'saveProjectToGoogleDrive'") 'Google Drive open/save commands are not registered.'
    Assert-All 'state.js' $state @('openProjectFromGoogleDrive', 'saveProjectToGoogleDrive') 'Google Drive open/save actions are missing from the Keyboard Shortcut Manager.'
} }
$checks += [pscustomobject]@{ Name = 'Help and User Guide coverage'; Script = {
    Assert-All 'HELP.md' $help @('### Google Drive', 'drive.file') 'Google Drive Help coverage is incomplete.'
    Assert-All 'USER-GUIDE.md' $userGuide @('Connecting Google Drive', 'OAuth Client ID') 'Google Drive User Guide coverage is incomplete.'
    Assert-All 'help.js' $inAppHelp @('Google Drive and Microsoft OneDrive are optional cloud providers') 'Google Drive in-app Help is missing.'
} }
$checks += [pscustomobject]@{ Name = 'Google Drive is opt-in (hidden until connected)'; Script = {
    Assert-All 'index.html' $indexHtml @('id="btn-open-project-google-drive" type="button" hidden', 'id="btn-save-project-google-drive" type="button" hidden') 'Google Drive Dashboard buttons must start hidden until connected.'
    Assert-All 'commandCatalog.js' $commandCatalog @("visible:\s*\(\)\s*=>\s*isStorageProviderConnected\('google-drive'\)") 'Google Drive commands must stay hidden from menus until connected.'
    Assert-All 'storageProviderFramework.js' $storage @('isStorageProviderConnected') 'Storage provider connection-status helper is missing.'
} }
Write-Host 'Epic 53 Verification'
Write-Host '--------------------'
$passed = 0
foreach ($check in $checks) { & $check.Script; Write-Host "PASS: $($check.Name)"; $passed++ }
Write-Host '--------------------'
Write-Host "Passed $passed of $($checks.Count) checks."
