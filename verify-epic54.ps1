$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
function Read-Text([string]$name) { Get-Content (Join-Path $root $name) -Raw }
function Assert-All([string]$name, [string]$content, [string[]]$patterns, [string]$message) { foreach ($pattern in $patterns) { if ($content -notmatch $pattern) { throw "FAIL: [$name] $message Missing pattern: $pattern" } } }
$oneDrive = Read-Text 'oneDriveStorageProvider.js'
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
$checks += [pscustomobject]@{ Name = 'Microsoft OneDrive OAuth and least-privilege scope'; Script = {
    Assert-All 'oneDriveStorageProvider.js' $oneDrive @('connectOneDrive', 'disconnectOneDrive', 'getOneDriveConnectionStatus', 'Files\.ReadWrite\.AppFolder', 'sessionStorage') 'OneDrive OAuth foundation is incomplete.'
} }
$checks += [pscustomobject]@{ Name = 'Microsoft Graph Files API wrapper'; Script = {
    Assert-All 'oneDriveStorageProvider.js' $oneDrive @('listArtFiles', 'downloadArtFileContent', 'createArtFile', 'updateArtFile') 'OneDrive file operations are incomplete.'
} }
$checks += [pscustomobject]@{ Name = 'No hard-coded client credentials'; Script = {
    Assert-All 'oneDriveStorageProvider.js' $oneDrive @('getOneDriveClientId', 'setOneDriveClientId') 'OneDrive Client ID must be user/administrator-configured, not hard-coded.'
    if ($oneDrive -match "clientId:\s*'[A-Za-z0-9]") { throw 'FAIL: [oneDriveStorageProvider.js] A Microsoft Application (Client) ID appears to be hard-coded.' }
} }
$checks += [pscustomobject]@{ Name = 'Wired into Storage Provider Architecture (Epic 52)'; Script = {
    Assert-All 'storageProviderFramework.js' $storage @('connectOneDrive', 'disconnectOneDrive', 'refreshOneDriveProviderStatus', 'isStorageProviderConnected') 'OneDrive is not wired into the Epic 52 storage provider registry.'
} }
$checks += [pscustomobject]@{ Name = 'Settings UI integration'; Script = {
    Assert-All 'index.html' $indexHtml @('settings-onedrive-client-id', 'btn-settings-onedrive-connect', 'btn-settings-onedrive-disconnect') 'OneDrive Settings UI is missing.'
    Assert-All 'settings.js' $settings @('renderStorageProviderSettings', 'connectOneDrive', 'disconnectOneDrive', 'setOneDriveClientId') 'Settings wiring for OneDrive is incomplete.'
} }
$checks += [pscustomobject]@{ Name = 'Open/Save OneDrive project commands'; Script = {
    Assert-All 'dashboard.js' $dashboard @('openDashboardProjectFromOneDriveFromCommand', 'saveDashboardProjectToOneDriveFromCommand', 'listOneDriveArtFiles', 'downloadOneDriveArtFileContent', 'createOneDriveArtFile', 'updateOneDriveArtFile') 'OneDrive open/save workflow is not wired into the Dashboard.'
    Assert-All 'index.html' $indexHtml @('btn-open-project-onedrive', 'btn-save-project-onedrive', 'onedrive-open-dialog') 'OneDrive open/save Dashboard controls are missing.'
    Assert-All 'commandCatalog.js' $commandCatalog @("action:\s*'openProjectFromOneDrive'", "action:\s*'saveProjectToOneDrive'") 'OneDrive open/save commands are not registered.'
    Assert-All 'state.js' $state @('openProjectFromOneDrive', 'saveProjectToOneDrive') 'OneDrive open/save actions are missing from the Keyboard Shortcut Manager.'
} }
$checks += [pscustomobject]@{ Name = 'Cloud providers are opt-in (hidden until connected)'; Script = {
    Assert-All 'index.html' $indexHtml @('id="btn-open-project-google-drive" type="button" hidden', 'id="btn-open-project-onedrive" type="button" hidden') 'Cloud storage Dashboard buttons must start hidden until connected.'
    Assert-All 'dashboard.js' $dashboard @('refreshStorageProviderButtonVisibility', "art-storage-providers-updated") 'Dashboard does not react to storage provider connection changes.'
    Assert-All 'commandCatalog.js' $commandCatalog @("visible:\s*\(\)\s*=>\s*isStorageProviderConnected\('google-drive'\)", "visible:\s*\(\)\s*=>\s*isStorageProviderConnected\('onedrive'\)") 'Cloud storage commands must stay hidden from menus until connected.'
    Assert-All 'state.js' $state @('STORAGE_PROVIDER_GATED_ACTIONS') 'Keyboard Shortcut Manager does not gate cloud storage actions by connection status.'
} }
$checks += [pscustomobject]@{ Name = 'Help and User Guide coverage'; Script = {
    Assert-All 'HELP.md' $help @('### Microsoft OneDrive', 'Files.ReadWrite.AppFolder', 'entirely optional') 'OneDrive Help coverage is incomplete.'
    Assert-All 'USER-GUIDE.md' $userGuide @('Connecting Microsoft OneDrive', 'Application \(Client\) ID', 'opt-in') 'OneDrive User Guide coverage is incomplete.'
    Assert-All 'help.js' $inAppHelp @('Microsoft OneDrive are optional cloud providers') 'OneDrive in-app Help is missing.'
} }
Write-Host 'Epic 54 Verification'
Write-Host '--------------------'
$passed = 0
foreach ($check in $checks) { & $check.Script; Write-Host "PASS: $($check.Name)"; $passed++ }
Write-Host '--------------------'
Write-Host "Passed $passed of $($checks.Count) checks."
