$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $MyInvocation.MyCommand.Path

function Read-Text([string]$name) {
    return Get-Content (Join-Path $root $name) -Raw
}

function Assert-Contains([string]$name, [string]$content, [string]$pattern, [string]$message) {
    if ($content -notmatch $pattern) {
        throw "FAIL: [$name] $message"
    }
}

function Assert-All([string]$name, [string]$content, [string[]]$patterns, [string]$message) {
    foreach ($pattern in $patterns) {
        if ($content -notmatch $pattern) {
            throw "FAIL: [$name] $message Missing pattern: $pattern"
        }
    }
}

$index = Read-Text 'index.html'
$settings = Read-Text 'settings.js'
$state = Read-Text 'state.js'
$navigation = Read-Text 'navigation.js'
$builder = Read-Text 'reportBuilder.js'
$lookup = Read-Text 'lookupTool.js'
$catalog = Read-Text 'wcagCatalog.js'
$loader = Read-Text 'loader.js'
$welcome = Read-Text 'welcome.js'

$checks = @()

$checks += [pscustomobject]@{ Name = 'Settings button and dialog markup'; Script = {
    Assert-All 'index.html' $index @(
        'btn-app-settings',
        'id="app-settings-dialog"',
        'role="dialog"',
        'aria-modal="true"',
        'settings-shortcuts-heading',
        'settings-standards-heading',
        'settings-reset-heading',
        'settings-about-heading'
    ) 'Settings dialog structure is incomplete.'
}}

$checks += [pscustomobject]@{ Name = 'Settings focus management'; Script = {
    Assert-All 'settings.js' $settings @(
        'function openSettingsDialog',
        'function closeSettingsDialog',
        'function trapSettingsFocus',
        'lastTrigger\.focus\(\)',
        'event\.key === ''Escape''',
        'event\.key !== ''Tab'''
    ) 'Settings focus management behavior is incomplete.'
}}

$checks += [pscustomobject]@{ Name = 'Shortcut manager behaviors'; Script = {
    Assert-All 'settings.js' $settings @(
        'getShortcutDefinitions',
        'pendingShortcutUpdate',
        'getShortcutFromEvent',
        'updateShortcut\(',
        'result\.reason === ''conflict''',
        'Shortcut changed\.',
        'resetShortcutsToDefault'
    ) 'Shortcut manager behavior is incomplete.'

    Assert-All 'state.js' $state @(
        'SHORTCUT_DEFINITIONS',
        'export function updateShortcut',
        'export function resetShortcutsToDefault',
        'export function findShortcutConflict'
    ) 'Shortcut persistence APIs are incomplete.'
}}

$checks += [pscustomobject]@{ Name = 'Navigation uses configurable shortcuts'; Script = {
    Assert-All 'navigation.js' $navigation @(
        'findShortcutAction',
        'eventToShortcut',
        'art-shortcuts-updated',
        'action === ''newReportFromTemplate''',
        'action === ''exportReport'''
    ) 'Navigation is not fully wired to configurable shortcuts.'
}}

$checks += [pscustomobject]@{ Name = 'Accessibility standards import and naming flow'; Script = {
    Assert-All 'index.html' $index @(
        'settings-standard-name-dialog',
        'settings-standard-overwrite-dialog',
        'settings-standard-name-input',
        'This name will be used throughout ART'
    ) 'Standards dialogs are incomplete.'

    Assert-All 'settings.js' $settings @(
        'validateAccessibilityStandardPayload',
        'findImportedStandardConflict',
        'addImportedAccessibilityStandard',
        'Imported accessibility standard'
    ) 'Standards import flow is incomplete.'

    Assert-All 'state.js' $state @(
        'importedStandards:',
        'export function validateAccessibilityStandardPayload',
        'export function addImportedAccessibilityStandard',
        'export function removeImportedAccessibilityStandard'
    ) 'Imported standard state model is incomplete.'
}}

$checks += [pscustomobject]@{ Name = 'Imported standards propagate to Builder and Lookup'; Script = {
    Assert-All 'reportBuilder.js' $builder @(
        'getAvailableWcagStandards',
        'standardOptions',
        'standard-select'
    ) 'Builder does not use dynamic standards.'

    Assert-All 'lookupTool.js' $lookup @(
        'getAvailableWcagStandards',
        'art-accessibility-standards-updated',
        'Version: All'
    ) 'Lookup tool does not refresh imported standards.'

    Assert-All 'wcagCatalog.js' $catalog @(
        'getImportedAccessibilityStandards',
        'buildMergedCatalog',
        'normalizeImportedCatalogEntry'
    ) 'WCAG catalog does not merge imported standards.'
}}

$checks += [pscustomobject]@{ Name = 'Reset workflows'; Script = {
    Assert-All 'index.html' $index @(
        'settings-reset-dialog',
        'Reset user preferences only',
        'Reset all application data'
    ) 'Reset dialog options are incomplete.'

    Assert-All 'settings.js' $settings @(
        'resetUserPreferences\(',
        'resetAllApplicationData\(',
        'Application settings restored\.',
        'ART has been reset to its default state\.',
        'openSubDialog\(resetDialog, defaultOption \|\| resetConfirm, resetButton\)'
    ) 'Reset dialog behavior is incomplete.'

    Assert-All 'state.js' $state @(
        'export function resetUserPreferences',
        'export function resetAllApplicationData',
        'localStorage\.clear\(\)'
    ) 'Reset state APIs are incomplete.'
}}

$checks += [pscustomobject]@{ Name = 'About section'; Script = {
    Assert-All 'state.js' $state @(
        'const APP_INFO',
        'export function getApplicationInfo'
    ) 'Application info state is incomplete.'

    Assert-All 'settings.js' $settings @(
        'function renderAbout',
        'Build Date',
        'Data Schema Version',
        'Imported Accessibility Standards'
    ) 'About rendering is incomplete.'
}}

$checks += [pscustomobject]@{ Name = 'Persistence and initialization'; Script = {
    Assert-All 'state.js' $state @(
        'const storedState = JSON\.parse\(localStorage\.getItem\(''art-state''\)\) \|\| \{\}',
        'shortcuts: normalizeShortcuts\(storedState\.shortcuts\)',
        'importedStandards: normalizeImportedStandards\(storedState\.importedStandards\)'
    ) 'Stored state persistence for settings is incomplete.'

    Assert-All 'loader.js' $loader @(
        'import \{ initSettings \} from ''\./settings\.js'';',
        'initSettings\(\);'
    ) 'Settings module is not initialized on load.'
}}

$checks += [pscustomobject]@{ Name = 'User-facing shortcut documentation updates'; Script = {
    Assert-All 'welcome.js' $welcome @(
        'getShortcutForAction',
        'openBuilder',
        'newReport',
        'nextLandmark'
    ) 'Welcome shortcut documentation is not dynamic.'
}}

Write-Host 'Epic 13 Verification'
Write-Host '--------------------'

$passed = 0
foreach ($check in $checks) {
    & $check.Script
    Write-Host "PASS: $($check.Name)"
    $passed += 1
}

Write-Host "--------------------"
Write-Host "Passed $passed of $($checks.Count) checks."