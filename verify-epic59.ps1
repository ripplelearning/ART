$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
function Read-Text([string]$name) { Get-Content (Join-Path $root $name) -Raw }
function Assert-All([string]$name, [string]$content, [string[]]$patterns, [string]$message) { foreach ($pattern in $patterns) { if ($content -notmatch $pattern) { throw "FAIL: [$name] $message Missing pattern: $pattern" } } }
$privacy = Read-Text 'privacyFramework.js'
$settings = Read-Text 'settings.js'
$indexHtml = Read-Text 'index.html'
$loader = Read-Text 'loader.js'
$help = Read-Text 'HELP.md'
$userGuide = Read-Text 'USER-GUIDE.md'
$inAppHelp = Read-Text 'help.js'
$checks = @()
$checks += [pscustomobject]@{ Name = 'Local privacy configuration and inventory'; Script = {
    Assert-All 'privacyFramework.js' $privacy @('getPrivacyConfig', 'updatePrivacyConfig', 'getLocalDataInventory', 'telemetryEnabled', 'art-state') 'Privacy configuration or data inventory is incomplete.'
} }
$checks += [pscustomobject]@{ Name = 'Credential-free user data export'; Script = {
    Assert-All 'privacyFramework.js' $privacy @('createUserDataExport', 'serializeUserDataExport', 'credentialFreeProfile', 'excludes authentication/provider session tokens') 'Credential-free data export is incomplete.'
} }
$checks += [pscustomobject]@{ Name = 'Explicit local data deletion'; Script = {
    Assert-All 'privacyFramework.js' $privacy @('clearLocalUserData', 'resetAllApplicationData', 'sessionStorage.clear') 'Local data deletion is incomplete.'
} }
$checks += [pscustomobject]@{ Name = 'Settings UI integration'; Script = {
    Assert-All 'index.html' $indexHtml @('settings-privacy-heading', 'settings-privacy-inventory', 'btn-settings-privacy-export', 'btn-settings-privacy-clear') 'Privacy Settings UI is missing.'
    Assert-All 'settings.js' $settings @('renderPrivacySettings', 'bindPrivacySettings', 'downloadUserDataExport', 'clearLocalUserData') 'Privacy Settings wiring is incomplete.'
} }
$checks += [pscustomobject]@{ Name = 'Startup initialization'; Script = {
    Assert-All 'loader.js' $loader @('initializePrivacyFramework') 'Privacy framework is not initialized at startup.'
} }
$checks += [pscustomobject]@{ Name = 'Help and User Guide coverage'; Script = {
    Assert-All 'HELP.md' $help @('## Privacy and User Data', 'Export My ART Data', 'Clear Local ART Data') 'Privacy Help coverage is incomplete.'
    Assert-All 'USER-GUIDE.md' $userGuide @('## Privacy and User Data', 'Optional telemetry') 'Privacy User Guide coverage is incomplete.'
    Assert-All 'help.js' $inAppHelp @('help-privacy-and-user-data', 'credential-free JSON') 'Privacy in-app Help is missing.'
} }
Write-Host 'Epic 59 Verification'
Write-Host '--------------------'
$passed = 0
foreach ($check in $checks) { & $check.Script; Write-Host "PASS: $($check.Name)"; $passed++ }
Write-Host '--------------------'
Write-Host "Passed $passed of $($checks.Count) checks."
