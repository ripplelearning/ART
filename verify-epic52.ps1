$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
function Read-Text([string]$name) { Get-Content (Join-Path $root $name) -Raw }
function Assert-All([string]$name, [string]$content, [string[]]$patterns, [string]$message) { foreach ($pattern in $patterns) { if ($content -notmatch $pattern) { throw "FAIL: [$name] $message Missing pattern: $pattern" } } }
$storage = Read-Text 'storageProviderFramework.js'
$settings = Read-Text 'settings.js'
$indexHtml = Read-Text 'index.html'
$loader = Read-Text 'loader.js'
$help = Read-Text 'HELP.md'
$userGuide = Read-Text 'USER-GUIDE.md'
$inAppHelp = Read-Text 'help.js'
$checks = @()
$checks += [pscustomobject]@{ Name = 'Provider-independent storage interface'; Script = {
    Assert-All 'storageProviderFramework.js' $storage @('registerStorageProvider', 'getStorageProviders', 'getStorageProvider', 'connectStorageProvider', 'disconnectStorageProvider', 'getStorageConfig', 'updateStorageConfig') 'Storage provider interface is incomplete.'
} }
$checks += [pscustomobject]@{ Name = 'Local file provider and future provider placeholders'; Script = {
    Assert-All 'storageProviderFramework.js' $storage @("id: 'local'", "id: 'network-folder'", "id: 'google-drive'", "id: 'onedrive'", "id: 'dropbox'", "id: 'art-server'") 'Baseline storage providers are incomplete.'
} }
$checks += [pscustomobject]@{ Name = 'Settings UI integration'; Script = {
    Assert-All 'index.html' $indexHtml @('settings-storage-provider-list', 'settings-storage-default-provider') 'Storage Providers Settings UI is missing.'
    Assert-All 'settings.js' $settings @('renderStorageProviderSettings', 'bindStorageProviderSettings') 'Settings wiring for storage providers is incomplete.'
} }
$checks += [pscustomobject]@{ Name = 'Startup initialization'; Script = {
    Assert-All 'loader.js' $loader @('initializeStorageProviderFramework') 'Storage provider framework is not initialized at startup.'
} }
$checks += [pscustomobject]@{ Name = 'Help and User Guide coverage'; Script = {
    Assert-All 'HELP.md' $help @('## Storage Providers', 'Network or Shared Folder') 'Storage Providers Help coverage is incomplete.'
    Assert-All 'USER-GUIDE.md' $userGuide @('## Storage Providers', 'Default storage provider') 'Storage Providers User Guide coverage is incomplete.'
    Assert-All 'help.js' $inAppHelp @('help-storage-providers', 'Storage Providers') 'Storage Providers in-app Help is missing.'
} }
Write-Host 'Epic 52 Verification'
Write-Host '--------------------'
$passed = 0
foreach ($check in $checks) { & $check.Script; Write-Host "PASS: $($check.Name)"; $passed++ }
Write-Host '--------------------'
Write-Host "Passed $passed of $($checks.Count) checks."
