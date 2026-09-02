$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
function Read-Text([string]$name) { Get-Content (Join-Path $root $name) -Raw }
function Assert-All([string]$name, [string]$content, [string[]]$patterns, [string]$message) { foreach ($pattern in $patterns) { if ($content -notmatch $pattern) { throw "FAIL: [$name] $message Missing pattern: $pattern" } } }
$integration = Read-Text 'externalIntegrationFramework.js'
$settings = Read-Text 'settings.js'
$indexHtml = Read-Text 'index.html'
$loader = Read-Text 'loader.js'
$help = Read-Text 'HELP.md'
$userGuide = Read-Text 'USER-GUIDE.md'
$inAppHelp = Read-Text 'help.js'
$checks = @()
$checks += [pscustomobject]@{ Name = 'Modular integration architecture'; Script = {
    Assert-All 'externalIntegrationFramework.js' $integration @('registerExternalIntegration', 'getExternalIntegrations', 'getExternalIntegration', 'initializeExternalIntegrationFramework') 'External integration architecture is incomplete.'
} }
$checks += [pscustomobject]@{ Name = 'Optional integration catalog and state'; Script = {
    Assert-All 'externalIntegrationFramework.js' $integration @("id: 'jira'", "id: 'github-issues'", "id: 'azure-devops'", "id: 'google-workspace'", 'INTEGRATION_STATUSES', 'getExternalIntegrationState', 'updateExternalIntegrationState') 'Integration catalog or state model is incomplete.'
} }
$checks += [pscustomobject]@{ Name = 'Connection and sharing controls'; Script = {
    Assert-All 'externalIntegrationFramework.js' $integration @('connectExternalIntegration', 'disconnectExternalIntegration', 'testExternalIntegration', 'setExternalIntegrationShareScopes', 'SHARE_SCOPES', 'configuration-incomplete') 'Integration connection or sharing controls are incomplete.'
    Assert-All 'settings.js' $settings @('renderExternalIntegrationSettings', 'Connect', 'Disconnect', 'Test Connection', 'setExternalIntegrationShareScopes') 'Integration Settings controls are incomplete.'
    Assert-All 'index.html' $indexHtml @('settings-external-integrations-heading', 'settings-external-integrations-list') 'External Integrations Settings section is missing.'
} }
$checks += [pscustomobject]@{ Name = 'Startup initialization'; Script = {
    Assert-All 'loader.js' $loader @('initializeExternalIntegrationFramework') 'External integration framework is not initialized at startup.'
} }
$checks += [pscustomobject]@{ Name = 'Documentation coverage'; Script = {
    Assert-All 'HELP.md' $help @('## External Integrations', 'Selected findings', 'Configuration incomplete') 'External Integrations Help coverage is incomplete.'
    Assert-All 'USER-GUIDE.md' $userGuide @('## External Integrations', 'Selected tasks') 'External Integrations User Guide coverage is incomplete.'
    Assert-All 'help.js' $inAppHelp @('help-external-integrations', 'External Integrations are separate') 'External Integrations in-app Help is incomplete.'
} }
Write-Host 'Epic 63 Verification'
Write-Host '--------------------'
$passed = 0
foreach ($check in $checks) { & $check.Script; Write-Host "PASS: $($check.Name)"; $passed++ }
Write-Host '--------------------'
Write-Host "Passed $passed of $($checks.Count) checks."
