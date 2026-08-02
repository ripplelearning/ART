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

$state = Read-Text 'state.js'
$commands = Read-Text 'commandCatalog.js'
$explorer = Read-Text 'explorerFramework.js'
$settings = Read-Text 'settings.js'
$menuBar = Read-Text 'menuBar.js'
$contextMenu = Read-Text 'globalContextMenuFramework.js'
$indexHtml = Read-Text 'index.html'
$style = Read-Text 'style.css'
$help = Read-Text 'help.js'
$readme = Read-Text 'README.md'

$checks = @()

$checks += [pscustomobject]@{ Name = 'Workspace view state and shortcut model'; Script = {
    Assert-All 'state.js' $state @(
        'workspaceView',
        'showDashboard',
        'showExplorer',
        'toggleWorkspaceView',
        'getWorkspaceViewConfig',
        'setActiveWorkspaceView',
        'updateWorkspaceViewConfig'
    ) 'Workspace view model is incomplete.'
}}

$checks += [pscustomobject]@{ Name = 'Explorer command registration'; Script = {
    Assert-All 'commandCatalog.js' $commands @(
        "action:\s*'showDashboard'",
        "action:\s*'showExplorer'",
        "action:\s*'toggleWorkspaceView'",
        "menuItemRole:\s*'menuitemradio'",
        'focusExplorerNavigationFromCommand',
        'focusExplorerSearchFromCommand',
        'revealExplorerResourceFromCommand'
    ) 'Explorer commands are not fully registered.'
}}

$checks += [pscustomobject]@{ Name = 'Explorer framework service and rendering'; Script = {
    Assert-All 'explorerFramework.js' $explorer @(
        "explorer\.id\s*=\s*'art-explorer-view'",
        'Explorer Navigation',
        'role="tree"',
        'runUniversalSearch',
        'showExplorerView',
        'showDashboardView',
        'toggleWorkspaceView',
        'revealExplorerResource',
        'getExplorerState'
    ) 'Explorer framework rendering/service APIs are incomplete.'
}}

$checks += [pscustomobject]@{ Name = 'Settings and menu integrations'; Script = {
    Assert-All 'index.html' $indexHtml @(
        'settings-workspace-default-view',
        'settings-workspace-remember-last',
        'settings-explorer-width',
        'btn-settings-workspace-apply'
    ) 'Workspace view settings markup is incomplete.'

    Assert-All 'settings.js' $settings @(
        'renderWorkspaceViewSettings',
        'bindWorkspaceViewSettings',
        'updateWorkspaceViewConfig'
    ) 'Workspace view settings behavior is incomplete.'

    Assert-All 'menuBar.js' $menuBar @(
        'menuitemradio',
        'Workspace View',
        'showDashboard',
        'showExplorer'
    ) 'Menu Bar workspace view radio integration is incomplete.'

    Assert-All 'globalContextMenuFramework.js' $contextMenu @(
        "'explorer'",
        'global-context-menu__radio',
        'showDashboard',
        'showExplorer',
        'toggleWorkspaceView'
    ) 'Global context menu explorer integration is incomplete.'
}}

$checks += [pscustomobject]@{ Name = 'Documentation and styling coverage'; Script = {
    Assert-All 'style.css' $style @(
        '\.art-explorer',
        '\.art-explorer__resource',
        '\.art-explorer__badge'
    ) 'Explorer styles are incomplete.'

    Assert-All 'help.js' $help @(
        'Workspace Views: Dashboard and Explorer',
        'Explorer Search'
    ) 'Help updates for Explorer are incomplete.'

    Assert-All 'README.md' $readme @(
        'Explorer Framework',
        'Show Dashboard',
        'Show Explorer'
    ) 'README Explorer coverage is incomplete.'
}}

Write-Host 'Epic 31 Verification'
Write-Host '--------------------'

$passed = 0
foreach ($check in $checks) {
    & $check.Script
    Write-Host "PASS: $($check.Name)"
    $passed += 1
}

Write-Host '--------------------'
Write-Host "Passed $passed of $($checks.Count) checks."
