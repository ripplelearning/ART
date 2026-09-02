$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
function Read-Text([string]$name) { Get-Content (Join-Path $root $name) -Raw }
function Assert-All([string]$name, [string]$content, [string[]]$patterns, [string]$message) { foreach ($pattern in $patterns) { if ($content -notmatch $pattern) { throw "FAIL: [$name] $message Missing pattern: $pattern" } } }
$dropbox = Read-Text 'dropboxStorageProvider.js'
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
$checks += [pscustomobject]@{ Name = 'Dropbox OAuth PKCE and app-folder boundary'; Script = {
    Assert-All 'dropboxStorageProvider.js' $dropbox @('connectDropbox', 'disconnectDropbox', 'getDropboxConnectionStatus', 'code_challenge', 'App folder', 'sessionStorage') 'Dropbox OAuth foundation is incomplete.'
} }
$checks += [pscustomobject]@{ Name = 'Dropbox Files API wrapper'; Script = {
    Assert-All 'dropboxStorageProvider.js' $dropbox @('listArtFiles', 'downloadArtFileContent', 'createArtFile', 'updateArtFile', 'files/list_folder', 'files/upload') 'Dropbox file operations are incomplete.'
} }
$checks += [pscustomobject]@{ Name = 'No hard-coded Dropbox app credentials'; Script = {
    Assert-All 'dropboxStorageProvider.js' $dropbox @('getDropboxClientId', 'setDropboxClientId') 'Dropbox App Key must be user/administrator-configured, not hard-coded.'
    if ($dropbox -match "client_id\s*=\s*'[A-Za-z0-9]" -or $dropbox -match "clientId\s*:\s*'[A-Za-z0-9]") { throw 'FAIL: [dropboxStorageProvider.js] A Dropbox App Key appears to be hard-coded.' }
} }
$checks += [pscustomobject]@{ Name = 'Wired into Storage Provider Architecture (Epic 52)'; Script = {
    Assert-All 'storageProviderFramework.js' $storage @('connectDropbox', 'disconnectDropbox', 'refreshDropboxProviderStatus', "id: 'dropbox'") 'Dropbox is not wired into the Epic 52 storage provider registry.'
} }
$checks += [pscustomobject]@{ Name = 'Settings UI integration'; Script = {
    Assert-All 'index.html' $indexHtml @('settings-dropbox-client-id', 'btn-settings-dropbox-connect', 'btn-settings-dropbox-disconnect') 'Dropbox Settings UI is missing.'
    Assert-All 'settings.js' $settings @('renderStorageProviderSettings', 'connectDropbox', 'disconnectDropbox', 'setDropboxClientId') 'Settings wiring for Dropbox is incomplete.'
} }
$checks += [pscustomobject]@{ Name = 'Open/Save Dropbox project commands'; Script = {
    Assert-All 'dashboard.js' $dashboard @('openDashboardProjectFromDropboxFromCommand', 'saveDashboardProjectToDropboxFromCommand', 'listDropboxArtFiles', 'downloadDropboxArtFileContent', 'createDropboxArtFile', 'updateDropboxArtFile') 'Dropbox open/save workflow is not wired into the Dashboard.'
    Assert-All 'index.html' $indexHtml @('btn-open-project-dropbox', 'btn-save-project-dropbox', 'dropbox-open-dialog') 'Dropbox open/save Dashboard controls are missing.'
    Assert-All 'commandCatalog.js' $commandCatalog @("action:\s*'openProjectFromDropbox'", "action:\s*'saveProjectToDropbox'") 'Dropbox open/save commands are not registered.'
    Assert-All 'state.js' $state @('openProjectFromDropbox', 'saveProjectToDropbox') 'Dropbox open/save actions are missing from the Keyboard Shortcut Manager.'
} }
$checks += [pscustomobject]@{ Name = 'Dropbox is opt-in (hidden until connected)'; Script = {
    Assert-All 'index.html' $indexHtml @('id="btn-open-project-dropbox" type="button" hidden', 'id="btn-save-project-dropbox" type="button" hidden') 'Dropbox Dashboard buttons must start hidden until connected.'
    Assert-All 'dashboard.js' $dashboard @('refreshStorageProviderButtonVisibility', "dropboxConnected") 'Dashboard does not react to Dropbox connection changes.'
    Assert-All 'commandCatalog.js' $commandCatalog @("visible:\s*\(\)\s*=>\s*isStorageProviderConnected\('dropbox'\)") 'Dropbox commands must stay hidden from menus until connected.'
    Assert-All 'state.js' $state @("openProjectFromDropbox: 'dropbox'", "saveProjectToDropbox: 'dropbox'") 'Keyboard Shortcut Manager does not gate Dropbox actions by connection status.'
} }
$checks += [pscustomobject]@{ Name = 'Help and User Guide coverage'; Script = {
    Assert-All 'HELP.md' $help @('### Dropbox', 'App folder') 'Dropbox Help coverage is incomplete.'
    Assert-All 'USER-GUIDE.md' $userGuide @('Connecting Dropbox', 'App folder') 'Dropbox User Guide coverage is incomplete.'
    Assert-All 'help.js' $inAppHelp @('Dropbox is also optional') 'Dropbox in-app Help is missing.'
} }
Write-Host 'Epic 55 Verification'
Write-Host '--------------------'
$passed = 0
foreach ($check in $checks) { & $check.Script; Write-Host "PASS: $($check.Name)"; $passed++ }
Write-Host '--------------------'
Write-Host "Passed $passed of $($checks.Count) checks."
