$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
function Read-Text([string]$name) { Get-Content (Join-Path $root $name) -Raw }
function Assert-All([string]$name, [string]$content, [string[]]$patterns, [string]$message) { foreach ($pattern in $patterns) { if ($content -notmatch $pattern) { throw "FAIL: [$name] $message Missing pattern: $pattern" } } }
$package = Read-Text 'package.json'
$main = Read-Text 'desktop/main.cjs'
$preload = Read-Text 'desktop/preload.cjs'
$dashboard = Read-Text 'dashboard.js'
$help = Read-Text 'HELP.md'
$userGuide = Read-Text 'USER-GUIDE.md'
$inAppHelp = Read-Text 'help.js'
$checks = @()
$checks += [pscustomobject]@{ Name = 'Electron desktop shell'; Script = {
    Assert-All 'package.json' $package @('"main": "desktop/main.cjs"', 'electron', 'electron-builder', 'desktop:start') 'Electron packaging metadata is incomplete.'
    Assert-All 'desktop/main.cjs' $main @('BrowserWindow', 'contextIsolation: true', 'nodeIntegration: false', 'sandbox: true', 'requestSingleInstanceLock', 'setWindowOpenHandler') 'Desktop shell security or lifecycle controls are incomplete.'
    Assert-All 'desktop/preload.cjs' $preload @('contextBridge', 'isDesktop', 'readArtFile', 'chooseOpenArtFile') 'Desktop preload bridge is incomplete.'
} }
$checks += [pscustomobject]@{ Name = 'Windows installer and .art association'; Script = {
    Assert-All 'package.json' $package @('"target": \["nsis"\]', 'ART-Setup-\$\{version\}', 'fileAssociations', '"ext": "art"', 'createDesktopShortcut', 'createStartMenuShortcut') 'Windows packaging or .art association is incomplete.'
} }
$checks += [pscustomobject]@{ Name = 'Desktop .art launch uses shared ART import pipeline'; Script = {
    Assert-All 'desktop/main.cjs' $main @('art-open-art-file', 'art-read-art-file') 'Desktop file launch bridge is incomplete.'
    Assert-All 'desktop/preload.cjs' $preload @('onOpenArtFile', 'readArtFile') 'Desktop file launch preload bridge is incomplete.'
    Assert-All 'dashboard.js' $dashboard @('artDesktop', 'openDesktopArtifact', 'openProjectFromText') 'Desktop files do not use the shared ART import pipeline.'
} }
$checks += [pscustomobject]@{ Name = 'Desktop documentation'; Script = {
    Assert-All 'HELP.md' $help @('## ART Desktop Application', 'ART-Setup\.exe', 'file association') 'Desktop Help coverage is incomplete.'
    Assert-All 'USER-GUIDE.md' $userGuide @('## ART Desktop Application', 'ART-Setup\.exe', 'Electron') 'Desktop User Guide coverage is incomplete.'
    Assert-All 'help.js' $inAppHelp @('help-desktop-application', 'ART.s Electron desktop shell') 'Desktop in-app Help is missing.'
} }
Write-Host 'Epic 58 Verification'
Write-Host '--------------------'
$passed = 0
foreach ($check in $checks) { & $check.Script; Write-Host "PASS: $($check.Name)"; $passed++ }
Write-Host '--------------------'
Write-Host "Passed $passed of $($checks.Count) checks."
