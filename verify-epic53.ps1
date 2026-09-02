$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
function Read-Text([string]$name) { Get-Content (Join-Path $root $name) -Raw }
function Assert-All([string]$name, [string]$content, [string[]]$patterns, [string]$message) { foreach ($pattern in $patterns) { if ($content -notmatch $pattern) { throw "FAIL: [$name] $message Missing pattern: $pattern" } } }
$googleDrive = Read-Text 'googleDriveStorageProvider.js'
$storage = Read-Text 'storageProviderFramework.js'
$settings = Read-Text 'settings.js'
$indexHtml = Read-Text 'index.html'
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
$checks += [pscustomobject]@{ Name = 'Help and User Guide coverage'; Script = {
    Assert-All 'HELP.md' $help @('### Google Drive', 'drive.file') 'Google Drive Help coverage is incomplete.'
    Assert-All 'USER-GUIDE.md' $userGuide @('Connecting Google Drive', 'OAuth Client ID') 'Google Drive User Guide coverage is incomplete.'
    Assert-All 'help.js' $inAppHelp @('Google Drive is the first cloud provider') 'Google Drive in-app Help is missing.'
} }
Write-Host 'Epic 53 Verification'
Write-Host '--------------------'
$passed = 0
foreach ($check in $checks) { & $check.Script; Write-Host "PASS: $($check.Name)"; $passed++ }
Write-Host '--------------------'
Write-Host "Passed $passed of $($checks.Count) checks."
