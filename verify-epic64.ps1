$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
function Read-Text([string]$name) { Get-Content (Join-Path $root $name) -Raw }
function Assert-All([string]$name, [string]$content, [string[]]$patterns, [string]$message) { foreach ($pattern in $patterns) { if ($content -notmatch $pattern) { throw "FAIL: [$name] $message Missing pattern: $pattern" } } }
$admin = Read-Text 'authorizationAdministrationFramework.js'
$auth = Read-Text 'authorizationFramework.js'
$settings = Read-Text 'settings.js'
$indexHtml = Read-Text 'index.html'
$loader = Read-Text 'loader.js'
$help = Read-Text 'HELP.md'
$userGuide = Read-Text 'USER-GUIDE.md'
$inAppHelp = Read-Text 'help.js'
$checks = @()
$checks += [pscustomobject]@{ Name = 'Authorized organization administration service'; Script = {
    Assert-All 'authorizationAdministrationFramework.js' $admin @('getAdministrableOrganizations', 'getOrganizationAdministration', 'canPerformAction', 'updateOrganizationProfile', 'addOrganizationMember', 'removeOrganizationMember') 'Organization administration service is incomplete.'
} }
$checks += [pscustomobject]@{ Name = 'Invitations and administrative audit trail'; Script = {
    Assert-All 'authorizationAdministrationFramework.js' $admin @('createOrganizationInvitation', 'revokeOrganizationInvitation', 'auditLog', 'Organization invitation created', 'Organization invitation revoked') 'Invitation or audit functionality is incomplete.'
} }
$checks += [pscustomobject]@{ Name = 'Settings administration UI'; Script = {
    Assert-All 'index.html' $indexHtml @('settings-org-admin-heading', 'settings-org-admin-select', 'settings-org-admin-members-list', 'settings-org-admin-invitations-list', 'settings-org-admin-audit-list') 'Organization Administration Settings UI is incomplete.'
    Assert-All 'index.html' $indexHtml @('Save Organization Profile', 'Create Invitation Record') 'Organization Administration Settings labels are incomplete.'
    Assert-All 'settings.js' $settings @('renderOrganizationAdministrationSettings', 'bindOrganizationAdministrationSettings') 'Organization Administration Settings wiring is incomplete.'
} }
$checks += [pscustomobject]@{ Name = 'Startup initialization'; Script = {
    Assert-All 'loader.js' $loader @('initializeAuthorizationAdministrationFramework') 'Organization administration is not initialized at startup.'
} }
$checks += [pscustomobject]@{ Name = 'Documentation coverage'; Script = {
    Assert-All 'HELP.md' $help @('## Organization Administration', 'Local invitation records do not send email') 'Organization Administration Help coverage is incomplete.'
    Assert-All 'USER-GUIDE.md' $userGuide @('## Organization Administration', 'administrative audit log') 'Organization Administration User Guide coverage is incomplete.'
    Assert-All 'help.js' $inAppHelp @('help-organization-administration', 'Organization Administration') 'Organization Administration in-app Help is incomplete.'
} }
Write-Host 'Epic 64 Verification'
Write-Host '--------------------'
$passed = 0
foreach ($check in $checks) { & $check.Script; Write-Host "PASS: $($check.Name)"; $passed++ }
Write-Host '--------------------'
Write-Host "Passed $passed of $($checks.Count) checks."
