$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
function Read-Text([string]$name) { Get-Content (Join-Path $root $name) -Raw }
function Assert-All([string]$name, [string]$content, [string[]]$patterns, [string]$message) {
    foreach ($pattern in $patterns) {
        if ($content -notmatch $pattern) { throw "FAIL: [$name] $message Missing pattern: $pattern" }
    }
}
$i18n = Read-Text 'internationalizationFramework.js'
$settings = Read-Text 'settings.js'
$index = Read-Text 'index.html'
$loader = Read-Text 'loader.js'
$guide = Read-Text 'DEFERRED-WORK-AND-DESKTOP-READINESS-GUIDE.md'
$checks = @()
$checks += [pscustomobject]@{ Name = 'Locale catalog and persistence'; Script = {
    Assert-All 'internationalizationFramework.js' $i18n @('SUPPORTED_LOCALES', 'LOCALE_PREFERENCE_KEY', 'getLocalePreference', 'updateLocalePreference', 'localStorage') 'Locale catalog or persistence is incomplete.'
} }
$checks += [pscustomobject]@{ Name = 'Locale-aware formatting and language metadata'; Script = {
    Assert-All 'internationalizationFramework.js' $i18n @('Intl.DateTimeFormat', 'Intl.NumberFormat', 'document.documentElement.lang', 'document.documentElement.dir') 'Locale formatting or language metadata is incomplete.'
} }
$checks += [pscustomobject]@{ Name = 'Accessible Settings language control'; Script = {
    Assert-All 'index.html' $index @('settings-locale', 'settings-locale-help', 'Language and regional format') 'Settings locale control is incomplete.'
    Assert-All 'settings.js' $settings @('SUPPORTED_LOCALES', 'getLocalePreference', 'updateLocalePreference', 'settings-locale') 'Settings locale wiring is incomplete.'
} }
$checks += [pscustomobject]@{ Name = 'Startup integration'; Script = {
    Assert-All 'loader.js' $loader @('initializeInternationalizationFramework') 'Internationalization framework is not initialized at startup.'
} }
$checks += [pscustomobject]@{ Name = 'Honest support documentation'; Script = {
    Assert-All 'DEFERRED-WORK-AND-DESKTOP-READINESS-GUIDE.md' $guide @('Epic 73', 'Translation resources', 'human review', 'RTL') 'Epic 73 deferred documentation is incomplete.'
} }
Write-Host 'Epic 73 Verification'
Write-Host '--------------------'
$passed = 0
foreach ($check in $checks) { & $check.Script; Write-Host "PASS: $($check.Name)"; $passed++ }
Write-Host '--------------------'
Write-Host "Passed $passed of $($checks.Count) checks."
