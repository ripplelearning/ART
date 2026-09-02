$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
function Read-Text([string]$name) { Get-Content (Join-Path $root $name) -Raw }
function Assert-All([string]$name, [string]$content, [string[]]$patterns, [string]$message) {
    foreach ($pattern in $patterns) {
        if ($content -notmatch $pattern) { throw "FAIL: [$name] $message Missing pattern: $pattern" }
    }
}
$welcome = Read-Text 'welcome.js'
$help = Read-Text 'help.js'
$helpDoc = Read-Text 'HELP.md'
$userGuide = Read-Text 'USER-GUIDE.md'
$checks = @()
$checks += [pscustomobject]@{ Name = 'Actionable first-run onboarding'; Script = {
    Assert-All 'welcome.js' $welcome @('New Report', 'Open ART Project', 'Builder', 'Help', 'welcome-open-setup-wizard', 'bindWelcomeOnboardingActions') 'Welcome onboarding guidance is incomplete.'
    if ($welcome -match 'id="welcome-new-report"|id="welcome-open-project"|id="welcome-explore-builder"|id="welcome-open-help"') { throw 'FAIL: [welcome.js] Welcome duplicates primary ART controls.' }
} }
$checks += [pscustomobject]@{ Name = 'Central in-app Help coverage'; Script = {
    Assert-All 'help.js' $help @('help-getting-started', 'help-organization-statistics', 'Keyboard Shortcuts', 'Accessibility') 'In-app Help coverage is incomplete.'
} }
$checks += [pscustomobject]@{ Name = 'Task-oriented documentation'; Script = {
    Assert-All 'HELP.md' $helpDoc @('Getting Started', 'Tasks and To-Do', 'Performance and Scalability', 'Keyboard Focus', 'Organization Statistics') 'HELP.md task-oriented coverage is incomplete.'
    Assert-All 'USER-GUIDE.md' $userGuide @('Getting Started', 'Tasks and To-Do', 'Performance and Scalability', 'Keyboard Focus', 'Organization Statistics') 'USER-GUIDE.md task-oriented coverage is incomplete.'
} }
$checks += [pscustomobject]@{ Name = 'Local-first and platform boundaries'; Script = {
    Assert-All 'HELP.md' $helpDoc @('without an account', 'desktop', 'server', 'file-based') 'HELP.md platform boundary guidance is incomplete.'
    Assert-All 'USER-GUIDE.md' $userGuide @('without an account', 'Electron', 'server', 'shared') 'USER-GUIDE.md platform boundary guidance is incomplete.'
} }
$checks += [pscustomobject]@{ Name = 'Version and maintenance guidance'; Script = {
    Assert-All 'help.js' $help @('Version 1.5') 'In-app Help version label is missing.'
    Assert-All 'HELP.md' $helpDoc @('Version 1.5', 'Release Notes', 'Troubleshooting') 'HELP.md maintenance guidance is incomplete.'
} }
Write-Host 'Epic 68 Verification'
Write-Host '--------------------'
$passed = 0
foreach ($check in $checks) { & $check.Script; Write-Host "PASS: $($check.Name)"; $passed++ }
Write-Host '--------------------'
Write-Host "Passed $passed of $($checks.Count) checks."
