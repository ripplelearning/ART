$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
function Read-Text([string]$name) { Get-Content (Join-Path $root $name) -Raw }
function Assert-All([string]$name, [string]$content, [string[]]$patterns, [string]$message) { foreach ($pattern in $patterns) { if ($content -notmatch $pattern) { throw "FAIL: [$name] $message Missing pattern: $pattern" } } }
$main = Read-Text 'desktop/main.cjs'
$preload = Read-Text 'desktop/preload.cjs'
$dashboard = Read-Text 'dashboard.js'
$package = Read-Text 'package.json'
$help = Read-Text 'HELP.md'
$userGuide = Read-Text 'USER-GUIDE.md'
$inAppHelp = Read-Text 'help.js'
$checks = @()
$checks += [pscustomobject]@{ Name = 'Shared native command architecture'; Script = {
    Assert-All 'desktop/main.cjs' $main @('Menu', 'art-desktop-command', 'Open ART Project', 'Save Project', 'Open ART Help') 'Native desktop command menu is incomplete.'
    Assert-All 'desktop/preload.cjs' $preload @('onCommand', 'art-desktop-command', 'contextBridge') 'Native command bridge is incomplete.'
    Assert-All 'dashboard.js' $dashboard @('artDesktop', 'executeDashboardAction', 'desktopCommandEventBound') 'Desktop commands are not routed to the shared ART command layer.'
} }
$checks += [pscustomobject]@{ Name = 'Window state persistence'; Script = {
    Assert-All 'desktop/main.cjs' $main @('window-state.json', 'loadWindowState', 'saveWindowState', 'getBounds', 'getPath\(') 'Desktop window state persistence is incomplete.'
} }
$checks += [pscustomobject]@{ Name = 'Desktop file association parity'; Script = {
    Assert-All 'package.json' $package @('fileAssociations', '"ext": "art"') 'Desktop .art association metadata is missing.'
    Assert-All 'desktop/main.cjs' $main @('getArtifactPath', 'art-open-art-file') 'Desktop .art launch handling is incomplete.'
    Assert-All 'dashboard.js' $dashboard @('openProjectFromText') 'Desktop launch does not use the shared import pipeline.'
} }
$checks += [pscustomobject]@{ Name = 'Parity documentation'; Script = {
    Assert-All 'HELP.md' $help @('### Desktop Parity and Native Behavior', 'native File, View, and Help menus') 'Desktop parity Help coverage is incomplete.'
    Assert-All 'USER-GUIDE.md' $userGuide @('same ART renderer', 'native File, View, and Help menus') 'Desktop parity User Guide coverage is incomplete.'
    Assert-All 'help.js' $inAppHelp @('native File, View, and Help menus') 'Desktop parity in-app Help is incomplete.'
} }
Write-Host 'Epic 62 Verification'
Write-Host '--------------------'
$passed = 0
foreach ($check in $checks) { & $check.Script; Write-Host "PASS: $($check.Name)"; $passed++ }
Write-Host '--------------------'
Write-Host "Passed $passed of $($checks.Count) checks."
