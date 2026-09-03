$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
function Read-Text([string]$name) { Get-Content (Join-Path $root $name) -Raw }
function Assert-All([string]$name, [string]$content, [string[]]$patterns, [string]$message) {
    foreach ($pattern in $patterns) {
        if ($content -notmatch $pattern) { throw "FAIL: [$name] $message Missing pattern: $pattern" }
    }
}
$settings = Read-Text 'settings.js'
$style = Read-Text 'style.css'
$checks = @()
$checks += [pscustomobject]@{ Name = 'Settings tab model and ordering'; Script = {
    Assert-All 'settings.js' $settings @('SETTINGS_TAB_ORDER', 'settings-account-heading', 'settings-about-heading', 'settings-admin-tools-summary', 'initializeSettingsTabs') 'Settings tab ordering is incomplete.'
} }
$checks += [pscustomobject]@{ Name = 'Accessible tab semantics'; Script = {
    Assert-All 'settings.js' $settings @('tablist.setAttribute', 'tab.setAttribute', 'aria-controls', 'aria-selected', 'panel.setAttribute', 'aria-labelledby') 'Settings tab semantics are incomplete.'
} }
$checks += [pscustomobject]@{ Name = 'Keyboard tab navigation'; Script = {
    Assert-All 'settings.js' $settings @('handleSettingsTabKeydown', 'ArrowRight', 'ArrowLeft', 'Home', 'End', 'tabIndex') 'Settings keyboard tab navigation is incomplete.'
} }
$checks += [pscustomobject]@{ Name = 'Section command integration'; Script = {
    Assert-All 'settings.js' $settings @('focusSettingsSectionByHeadingId', 'activateSettingsTab', 'scrollIntoView') 'Settings section command integration is incomplete.'
} }
$checks += [pscustomobject]@{ Name = 'Responsive visible focus styling'; Script = {
    Assert-All 'style.css' $style @('#settings-tablist', 'aria-selected', 'flex-wrap', 'min-width: 0') 'Settings tab styling is incomplete.'
} }
Write-Host 'Settings Tabs Verification'
Write-Host '-------------------------'
$passed = 0
foreach ($check in $checks) { & $check.Script; Write-Host "PASS: $($check.Name)"; $passed++ }
Write-Host '-------------------------'
Write-Host "Passed $passed of $($checks.Count) checks."
