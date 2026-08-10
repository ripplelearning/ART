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
$loader = Read-Text 'loader.js'
$builder = Read-Text 'reportBuilder.js'
$viewer = Read-Text 'reportViewer.js'
$presentation = Read-Text 'reportPresentationFramework.js'
$catalog = Read-Text 'commandCatalog.js'
$menuBar = Read-Text 'menuBar.js'
$relationships = Read-Text 'resourceRelationshipFramework.js'
$style = Read-Text 'style.css'
$commands = Read-Text 'COMMANDS.md'
$help = Read-Text 'HELP.md'
$readme = Read-Text 'README.md'
$userGuide = Read-Text 'USER-GUIDE.md'
$architecture = Read-Text 'ARCHITECTURE.md'

$checks = @()

$checks += [pscustomobject]@{ Name = 'Presentation state and startup integration'; Script = {
    Assert-All 'state.js' $state @(
        'presentation:\s*\{',
        'resourceLibrary:',
        'layouts:',
        'themes:',
        'brandings:',
        'publishingProfiles:',
        'reportPresentation:',
        'layoutOverride:',
        'themeOverride:',
        'brandingOverride:'
    ) 'Presentation state model is incomplete.'

    Assert-All 'loader.js' $loader @(
        'initializeReportPresentationFramework',
        'runStartupStage\(''initializeReportPresentationFramework'''
    ) 'Presentation framework is not initialized at startup.'
}}

$checks += [pscustomobject]@{ Name = 'Reusable presentation framework'; Script = {
    Assert-All 'reportPresentationFramework.js' $presentation @(
        'BUILT_IN_LAYOUTS',
        'BUILT_IN_THEMES',
        'BUILT_IN_BRANDINGS',
        'BUILT_IN_PUBLISHING_PROFILES',
        'getPresentationValidation',
        'getResolvedReportPresentation',
        'savePresentationResource',
        'duplicatePresentationResource',
        'renamePresentationResource',
        'deletePresentationResource',
        'buildPresentationPreviewModel',
        'saveBrandingAsWorkspaceDefault'
    ) 'Reusable presentation framework APIs are incomplete.'
}}

$checks += [pscustomobject]@{ Name = 'Builder presentation controls'; Script = {
    Assert-All 'reportBuilder.js' $builder @(
        'Publishing Presentation',
        'presentation-layout-select',
        'presentation-theme-select',
        'presentation-branding-select',
        'presentation-profile-select',
        'presentation-preview-mode',
        'presentation-allow-overrides',
        'presentation-layout-section-enabled',
        'Make this the default branding for new reports in this Project Workspace\.',
        'buildPresentationPreviewMarkup',
        'buildPresentationValidationMarkup'
    ) 'Builder presentation UI is incomplete.'
}}

$checks += [pscustomobject]@{ Name = 'Viewer and export presentation integration'; Script = {
    Assert-All 'reportViewer.js' $viewer @(
        'buildPresentationSectionModels',
        'renderPresentationDocumentHtml',
        'buildPresentationCssVariables',
        'getResolvedReportPresentation',
        'viewer-presentation-document',
        'buildDocxDocumentXml',
        'buildHtmlSummary',
        'buildTextSummary'
    ) 'Viewer/export presentation integration is incomplete.'
}}

$checks += [pscustomobject]@{ Name = 'Command and menu integration'; Script = {
    Assert-All 'commandCatalog.js' $catalog @(
        'action:\s*''openPresentationDesigner''',
        'action:\s*''presentationApplyDetailedAuditLayout''',
        'action:\s*''presentationApplyExecutiveLayout''',
        'action:\s*''presentationApplyDefaultTheme''',
        'action:\s*''presentationApplyHighContrastTheme''',
        'action:\s*''presentationApplyDefaultBranding''',
        'action:\s*''presentationCyclePreviewMode''',
        'action:\s*''presentationValidate'''
    ) 'Presentation commands are missing from the command catalog.'

    Assert-All 'state.js' $state @(
        'openPresentationDesigner:\s*''''',
        'presentationApplyDetailedAuditLayout:\s*''''',
        'presentationApplyExecutiveLayout:\s*''''',
        'presentationApplyDefaultTheme:\s*''''',
        'presentationApplyHighContrastTheme:\s*''''',
        'presentationApplyDefaultBranding:\s*''''',
        'presentationCyclePreviewMode:\s*''''',
        'presentationValidate:\s*'''''
    ) 'Presentation shortcut actions are missing from shared state.'

    Assert-All 'menuBar.js' $menuBar @(
        'Presentation'
    ) 'Presentation menu is missing from menu bar ordering.'
}}

$checks += [pscustomobject]@{ Name = 'Workspace resource catalog integration'; Script = {
    Assert-All 'resourceRelationshipFramework.js' $relationships @(
        'getPresentationResourceLibrary',
        'report-layout',
        'report-theme',
        'report-branding',
        'publishing-profile'
    ) 'Presentation resources are not exposed through workspace resource catalogs.'
}}

$checks += [pscustomobject]@{ Name = 'Presentation styling'; Script = {
    Assert-All 'style.css' $style @(
        'presentation-config',
        'presentation-config__panel',
        'presentation-validation-list',
        'presentation-preview-page',
        'viewer-presentation-document',
        'presentation-chip'
    ) 'Presentation styling is incomplete.'
}}

$checks += [pscustomobject]@{ Name = 'Documentation coverage'; Script = {
    Assert-All 'COMMANDS.md' $commands @(
        '### Presentation',
        'openPresentationDesigner',
        'presentationValidate'
    ) 'Command documentation is missing presentation commands.'

    Assert-All 'HELP.md' $help @(
        'Publishing Presentation in Report Builder',
        'Report Layouts',
        'Report Themes',
        'Branding resources',
        'Make this the default branding for new reports in this Project Workspace'
    ) 'Help documentation is missing presentation guidance.'

    Assert-All 'README.md' $readme @(
        'Publishing Presentation Framework',
        'reusable Report Layouts',
        'Publishing Profiles',
        'Presentation menu'
    ) 'README is missing presentation framework coverage.'

    Assert-All 'USER-GUIDE.md' $userGuide @(
        '## Publishing Presentation',
        'Report Layouts',
        'Report Themes',
        'Report Branding',
        'Publishing Profiles'
    ) 'User guide is missing presentation workflows.'

    Assert-All 'ARCHITECTURE.md' $architecture @(
        '### Report Presentation Framework',
        'Publishing Profiles',
        'presentation configuration separate from underlying report findings',
        'workspace resource catalogs'
    ) 'Architecture documentation is missing presentation framework details.'
}}

$failed = $false

foreach ($check in $checks) {
    try {
        & $check.Script
        Write-Host "PASS: $($check.Name)" -ForegroundColor Green
    } catch {
        $failed = $true
        Write-Host $_.Exception.Message -ForegroundColor Red
    }
}

if ($failed) {
    throw 'Epic 40 verification failed.'
}

Write-Host 'Epic 40 verification passed.' -ForegroundColor Green
