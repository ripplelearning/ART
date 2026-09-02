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
$checks += [pscustomobject]@{ Name = 'Provider-independent integration interface'; Script = {
    Assert-All 'externalIntegrationFramework.js' $integration @('registerExternalIntegration', 'getExternalIntegrations', 'getExternalIntegration', 'connectExternalIntegration', 'disconnectExternalIntegration', 'testExternalIntegration', 'synchronizeExternalIntegration') 'External integration interface is incomplete.'
} }
$checks += [pscustomobject]@{ Name = 'Built-in external integration catalog'; Script = {
    Assert-All 'externalIntegrationFramework.js' $integration @("id: 'jira'", "id: 'github-issues'", "id: 'azure-devops'", "id: 'google-workspace'") 'Built-in integrations are incomplete.'
} }
$checks += [pscustomobject]@{ Name = 'Connection and data-sharing state'; Script = {
    Assert-All 'externalIntegrationFramework.js' $integration @('INTEGRATION_STATUSES', 'SHARE_SCOPES', 'getExternalIntegrationState', 'setExternalIntegrationShareScopes', 'configuration-incomplete', 'localStorage') 'Integration state or sharing scope model is incomplete.'
} }
$checks += [pscustomobject]@{ Name = 'Settings UI integration'; Script = {
    Assert-All 'index.html' $indexHtml @('settings-external-integrations-heading', 'settings-external-integrations-list', 'External integrations are optional') 'External Integrations Settings UI is missing.'
    Assert-All 'settings.js' $settings @('renderExternalIntegrationSettings', 'bindExternalIntegrationSettings', 'Connect', 'Test Connection', 'setExternalIntegrationShareScopes') 'Settings wiring for external integrations is incomplete.'
} }
$checks += [pscustomobject]@{ Name = 'Startup initialization'; Script = {
    Assert-All 'loader.js' $loader @('initializeExternalIntegrationFramework') 'External integration framework is not initialized at startup.'
} }
$checks += [pscustomobject]@{ Name = 'Help and User Guide coverage'; Script = {
    Assert-All 'HELP.md' $help @('## External Integrations', 'Jira', 'Selected findings', 'Configuration incomplete') 'External Integrations Help coverage is incomplete.'
    Assert-All 'USER-GUIDE.md' $userGuide @('## External Integrations', 'GitHub Issues', 'Selected tasks') 'External Integrations User Guide coverage is incomplete.'
    Assert-All 'help.js' $inAppHelp @('help-external-integrations', 'External Integrations are separate') 'External Integrations in-app Help is missing.'
} }
Write-Host 'Epic 57 Verification'
Write-Host '--------------------'
$passed = 0
foreach ($check in $checks) { & $check.Script; Write-Host "PASS: $($check.Name)"; $passed++ }
Write-Host '--------------------'
Write-Host "Passed $passed of $($checks.Count) checks."
