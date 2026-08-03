$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $MyInvocation.MyCommand.Path

function Read-Text([string]$name) {
    return Get-Content (Join-Path $root $name) -Raw
}

function Assert-All([string]$name, [string]$content, [string[]]$patterns, [string]$message) {
    foreach ($pattern in $patterns) {
        if ($content -notmatch $pattern) {
            throw "FAIL: [$name] $message Missing pattern: $pattern"
        }
    }
}

$pluginFramework = Read-Text 'pluginFramework.js'
$settings = Read-Text 'settings.js'
$state = Read-Text 'state.js'
$commandCatalog = Read-Text 'commandCatalog.js'
$commandsDoc = Read-Text 'COMMANDS.md'
$helpDoc = Read-Text 'HELP.md'
$userGuide = Read-Text 'USER-GUIDE.md'
$pluginGuide = Read-Text 'PLUGIN-DEVELOPER-GUIDE.md'
$packageGuide = Read-Text 'PACKAGE-AUTHORING-GUIDE.md'
$index = Read-Text 'index.html'
$helpShell = Read-Text 'art-help/index.html'
$packagesReadme = Read-Text 'packages/README.md'
$loader = Read-Text 'loader.js'

$checks = @()

$checks += [pscustomobject]@{ Name = 'Plugin framework lifecycle and validation surface'; Script = {
    Assert-All 'pluginFramework.js' $pluginFramework @(
        'const EXTENSION_POINTS = Object\.freeze\(',
        'const PACKAGE_TYPES = Object\.freeze\(',
        'function normalizeDependencyEntry\(',
        'function checkPluginDependencyIssues\(',
        'function findDependents\(',
        'export function validatePluginManifest\(',
        'export function registerPluginManifest\(',
        'export function enablePlugin\(',
        'export function disablePlugin\(',
        'export function uninstallPlugin\(',
        'export function updatePluginManifest\(',
        'export function validateRegisteredExtensions\(',
        'export function exportPluginFrameworkState\(',
        'export function importPluginFrameworkState\('
    ) 'Plugin framework lifecycle surface is incomplete.'
}}

$checks += [pscustomobject]@{ Name = 'Startup and settings integration'; Script = {
    Assert-All 'loader.js' $loader @(
        'initPluginFramework',
        'Plugin framework initialization failed'
    ) 'Plugin framework startup integration is incomplete.'

    Assert-All 'settings.js' $settings @(
        'function renderPluginManager\(',
        'startSettingsPluginInstallFromCommand',
        'validateSettingsPluginExtensionsFromCommand',
        'refreshSettingsPluginManagerFromCommand',
        'exportSettingsPluginFrameworkConfigFromCommand',
        'importSettingsPluginFrameworkConfigFromCommand',
        'settings-plugin-manager-status'
    ) 'Settings plugin manager integration is incomplete.'
}}

$checks += [pscustomobject]@{ Name = 'Settings UI controls and shell parity'; Script = {
    Assert-All 'index.html' $index @(
        'settings-plugin-manager-heading',
        'btn-settings-plugin-install',
        'btn-settings-plugin-validate',
        'btn-settings-plugin-refresh',
        'btn-settings-plugin-export-config',
        'btn-settings-plugin-import-config',
        'settings-plugin-import-config-input'
    ) 'Main settings shell is missing plugin manager controls.'

    Assert-All 'art-help/index.html' $helpShell @(
        'settings-plugin-manager-heading',
        'btn-settings-plugin-install',
        'btn-settings-plugin-validate',
        'btn-settings-plugin-refresh',
        'btn-settings-plugin-export-config',
        'btn-settings-plugin-import-config',
        'settings-plugin-import-config-input'
    ) 'Help settings shell is missing plugin manager controls.'
}}

$checks += [pscustomobject]@{ Name = 'Command and shortcut coverage'; Script = {
    Assert-All 'state.js' $state @(
        'settingsPluginInstall',
        'settingsPluginValidate',
        'settingsPluginRefresh',
        'settingsPluginExportConfig',
        'settingsPluginImportConfig'
    ) 'Shortcut model does not include plugin manager actions.'

    Assert-All 'commandCatalog.js' $commandCatalog @(
        'action:\s*''settingsPluginInstall''',
        'action:\s*''settingsPluginValidate''',
        'action:\s*''settingsPluginRefresh''',
        'action:\s*''settingsPluginExportConfig''',
        'action:\s*''settingsPluginImportConfig'''
    ) 'Command catalog does not include plugin manager actions.'

    Assert-All 'COMMANDS.md' $commandsDoc @(
        'settingsPluginInstall',
        'settingsPluginValidate',
        'settingsPluginRefresh',
        'settingsPluginExportConfig',
        'settingsPluginImportConfig'
    ) 'Command documentation is missing plugin manager actions.'
}}

$checks += [pscustomobject]@{ Name = 'Documentation and package directory coverage'; Script = {
    Assert-All 'HELP.md' $helpDoc @(
        'Plugin and Package Manager',
        'Dependency and Permission Behavior',
        'export plugin framework configuration',
        'import plugin framework configuration'
    ) 'Help documentation coverage is incomplete.'

    Assert-All 'USER-GUIDE.md' $userGuide @(
        'Plugin Lifecycle Controls',
        'Framework Configuration',
        'dependency'
    ) 'User guide plugin coverage is incomplete.'

    Assert-All 'PLUGIN-DEVELOPER-GUIDE.md' $pluginGuide @(
        'pluginDependencies',
        'requiredPermissions',
        'Configuration Portability'
    ) 'Plugin developer guide coverage is incomplete.'

    Assert-All 'PACKAGE-AUTHORING-GUIDE.md' $packageGuide @(
        'documentation-packages',
        'integration-providers',
        'Directory Conventions'
    ) 'Package authoring guide coverage is incomplete.'

    Assert-All 'packages/README.md' $packagesReadme @(
        'documentation-packages',
        'integration-providers'
    ) 'Package directory categories are incomplete.'

    if (-not (Test-Path (Join-Path $root 'packages/integration-providers'))) {
        throw 'FAIL: Missing packages/integration-providers directory.'
    }

    if (-not (Test-Path (Join-Path $root 'packages/documentation-packages'))) {
        throw 'FAIL: Missing packages/documentation-packages directory.'
    }
}
}

Write-Host 'Epic 34 Verification'
Write-Host '--------------------'

$passed = 0
foreach ($check in $checks) {
    & $check.Script
    Write-Host "PASS: $($check.Name)"
    $passed += 1
}

Write-Host '--------------------'
Write-Host "Passed $passed of $($checks.Count) checks."
