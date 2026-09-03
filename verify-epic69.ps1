$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
function Read-Text([string]$name) { Get-Content (Join-Path $root $name) -Raw }
function Assert-All([string]$name, [string]$content, [string[]]$patterns, [string]$message) {
    foreach ($pattern in $patterns) {
        if ($content -notmatch $pattern) { throw "FAIL: [$name] $message Missing pattern: $pattern" }
    }
}
$feedback = Read-Text 'feedbackFramework.js'
$commands = Read-Text 'commandCatalog.js'
$help = Read-Text 'help.js'
$helpDoc = Read-Text 'HELP.md'
$userGuide = Read-Text 'USER-GUIDE.md'
$checks = @()
$checks += [pscustomobject]@{ Name = 'Categorized local feedback intake'; Script = {
    Assert-All 'feedbackFramework.js' $feedback @('FEEDBACK_CATEGORIES', 'openCommunityFeedback', 'Save Feedback Locally', 'localStorage', 'Nothing was transmitted') 'Community feedback intake is incomplete.'
} }
$checks += [pscustomobject]@{ Name = 'Separate persistent issue tracker'; Script = {
    Assert-All 'feedbackFramework.js' $feedback @('ISSUES_KEY', 'createIssueFromFeedback', 'ISSUE_STATUSES', 'Deferred', 'feedback-issue-metadata', 'documentationUrl', 'importIssuesFile', 'Import Feedback Issues File', 'Created', 'updatedAt', 'Export Feedback Issues File', 'Save Issue Update', 'Tasks and To-Do') 'Feedback issue tracking is incomplete.'
} }
$checks += [pscustomobject]@{ Name = 'Accessible feedback dialog'; Script = {
    Assert-All 'feedbackFramework.js' $feedback @('community-feedback-heading', 'aria-modal', 'aria-live', 'Escape', "event.key !== 'Tab'") 'Feedback dialog accessibility is incomplete.'
} }
$checks += [pscustomobject]@{ Name = 'Help and command access'; Script = {
    Assert-All 'help.js' $help @('help-open-community-feedback', 'openCommunityFeedback') 'Help feedback entry point is incomplete.'
    Assert-All 'commandCatalog.js' $commands @('openCommunityFeedback', 'Help.OpenCommunityFeedback', "menuLocation: 'Help'") 'Help menu feedback command is incomplete.'
} }
$checks += [pscustomobject]@{ Name = 'Security and privacy boundary'; Script = {
    Assert-All 'feedbackFramework.js' $feedback @('Do not submit an undisclosed security vulnerability', 'passwords', 'tokens', 'private report content') 'Feedback privacy guidance is incomplete.'
    Assert-All 'HELP.md' $helpDoc @('SECURITY.md', 'not the general feedback form', 'voluntary community beta') 'Security reporting boundary is undocumented.'
} }
$checks += [pscustomobject]@{ Name = 'Beta documentation'; Script = {
    Assert-All 'USER-GUIDE.md' $userGuide @('Community Beta Feedback', 'does not require an account', 'steps to reproduce') 'Beta feedback documentation is incomplete.'
} }
Write-Host 'Epic 69 Verification'
Write-Host '--------------------'
$passed = 0
foreach ($check in $checks) { & $check.Script; Write-Host "PASS: $($check.Name)"; $passed++ }
Write-Host '--------------------'
Write-Host "Passed $passed of $($checks.Count) checks."
