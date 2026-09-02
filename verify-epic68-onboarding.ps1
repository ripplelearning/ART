$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
function Read-Text([string]$name) { Get-Content (Join-Path $root $name) -Raw }
function Assert-All([string]$name, [string]$content, [string[]]$patterns, [string]$message) {
    foreach ($pattern in $patterns) {
        if ($content -notmatch $pattern) { throw "FAIL: [$name] $message Missing pattern: $pattern" }
    }
}
$wizard = Read-Text 'onboardingWizard.js'
$welcome = Read-Text 'welcome.js'
$help = Read-Text 'help.js'
$commands = Read-Text 'commandCatalog.js'
$settings = Read-Text 'settings.js'
$checks = @()
$checks += [pscustomobject]@{ Name = 'Shared optional setup wizard'; Script = {
    Assert-All 'onboardingWizard.js' $wizard @('openOnboardingWizard', 'closeOnboardingWizard', 'ART Setup Wizard', 'aria-modal', 'Escape') 'The setup wizard is incomplete.'
} }
$checks += [pscustomobject]@{ Name = 'Direct first-run Settings access'; Script = {
    Assert-All 'onboardingWizard.js' $wizard @('Account and Identity', 'Storage Providers', 'External Integrations', 'Accessibility and Appearance', 'Organization and Metrics', 'Collaboration') 'Wizard setup steps are incomplete.'
    Assert-All 'settings.js' $settings @('openSettingsAccountSectionFromCommand', 'openSettingsStorageSectionFromCommand', 'openSettingsExternalIntegrationsSectionFromCommand', 'openSettingsOrganizationSectionFromCommand') 'Settings section entry points are incomplete.'
} }
$checks += [pscustomobject]@{ Name = 'Welcome and Help entry points'; Script = {
    Assert-All 'welcome.js' $welcome @('welcome-open-setup-wizard', 'Open Optional ART Setup Wizard') 'Welcome wizard entry point is incomplete.'
    Assert-All 'help.js' $help @('help-open-setup-wizard', 'openOnboardingWizard') 'Help wizard entry point is incomplete.'
    Assert-All 'commandCatalog.js' $commands @('openOnboardingWizard', 'Help.OpenOnboardingWizard', "menuLocation: 'Help'") 'Help menu wizard command is incomplete.'
} }
$checks += [pscustomobject]@{ Name = 'No duplicated primary commands'; Script = {
    Assert-All 'welcome.js' $welcome @('New Report', 'Open ART Project', 'Builder', 'Help') 'Welcome directions do not identify existing interface controls.'
    if ($welcome -match 'id="welcome-new-report"|id="welcome-open-project"|id="welcome-explore-builder"|id="welcome-open-help"') { throw 'FAIL: [welcome.js] Welcome duplicates primary ART controls.' }
} }
$checks += [pscustomobject]@{ Name = 'Onboarding documentation'; Script = {
    Assert-All 'HELP.md' (Read-Text 'HELP.md') @('ART Setup Wizard', 'Open Optional ART Setup Wizard', 'Account and Identity') 'Help onboarding documentation is incomplete.'
    Assert-All 'USER-GUIDE.md' (Read-Text 'USER-GUIDE.md') @('ART Setup Wizard', 'Open Optional ART Setup Wizard', 'Storage Providers') 'User Guide onboarding documentation is incomplete.'
} }
Write-Host 'Epic 68 Onboarding Verification'
Write-Host '------------------------------'
$passed = 0
foreach ($check in $checks) { & $check.Script; Write-Host "PASS: $($check.Name)"; $passed++ }
Write-Host '------------------------------'
Write-Host "Passed $passed of $($checks.Count) checks."
