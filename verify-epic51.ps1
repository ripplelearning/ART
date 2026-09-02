$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
function Read-Text([string]$name) { Get-Content (Join-Path $root $name) -Raw }
function Assert-All([string]$name, [string]$content, [string[]]$patterns, [string]$message) { foreach ($pattern in $patterns) { if ($content -notmatch $pattern) { throw "FAIL: [$name] $message Missing pattern: $pattern" } } }
$auth = Read-Text 'authorizationFramework.js'
$settings = Read-Text 'settings.js'
$indexHtml = Read-Text 'index.html'
$loader = Read-Text 'loader.js'
$orgDashboard = Read-Text 'organizationDashboard.js'
$help = Read-Text 'HELP.md'
$userGuide = Read-Text 'USER-GUIDE.md'
$inAppHelp = Read-Text 'help.js'
$checks = @()
$checks += [pscustomobject]@{ Name = 'Organization roles and Authorization Policy Service'; Script = {
    Assert-All 'authorizationFramework.js' $auth @('ORGANIZATION_ROLES', 'canPerformAction', 'getRolePermissions', 'addOrganizationMembership', 'updateOrganizationMembershipRole', 'removeOrganizationMembership') 'Authorization Policy Service is incomplete.'
} }
$checks += [pscustomobject]@{ Name = 'Personal identity code and device linking'; Script = {
    Assert-All 'authorizationFramework.js' $auth @('getPersonalIdentityCode', 'regeneratePersonalIdentityCode', 'getLinkedDevices', 'unlinkDevice', 'linkDeviceWithCode') 'Device identity linking foundation is incomplete.'
} }
$checks += [pscustomobject]@{ Name = 'Settings UI integration'; Script = {
    Assert-All 'index.html' $indexHtml @('settings-identity-code-value', 'settings-identity-link-code-input', 'settings-org-roles-list', 'settings-linked-devices-list') 'Organizations/roles/device-linking Settings UI is missing.'
    Assert-All 'settings.js' $settings @('renderIdentityCodeSettings', 'bindIdentityCodeSettings', 'renderOrganizationRolesSettings', 'bindOrganizationRolesSettings') 'Settings wiring for organizations/roles/device-linking is incomplete.'
} }
$checks += [pscustomobject]@{ Name = 'Startup initialization'; Script = {
    Assert-All 'loader.js' $loader @('initializeAuthorizationFramework') 'Authorization framework is not initialized at startup.'
} }
$checks += [pscustomobject]@{ Name = 'Authorization Policy Service gates a real workflow'; Script = {
    Assert-All 'organizationDashboard.js' $orgDashboard @('canManageSelectedOrganization', 'getOrganizationMemberships', 'getRolePermissions', "includes\('manageOrganization'\)") 'Organization Statistics does not enforce recorded organization roles.'
} }
$checks += [pscustomobject]@{ Name = 'Help and User Guide coverage'; Script = {
    Assert-All 'HELP.md' $help @('## Organizations, Roles, and Device Identity', 'Authorization Policy Service') 'Organizations/Roles Help coverage is incomplete.'
    Assert-All 'USER-GUIDE.md' $userGuide @('## Organizations, Roles, and Device Identity', 'Personal ART Identity Code') 'Organizations/Roles User Guide coverage is incomplete.'
    Assert-All 'help.js' $inAppHelp @('help-organizations-and-roles', 'Organizations, Roles, and Device Identity') 'Organizations/Roles in-app Help is missing.'
} }
Write-Host 'Epic 51 Verification'
Write-Host '--------------------'
$passed = 0
foreach ($check in $checks) { & $check.Script; Write-Host "PASS: $($check.Name)"; $passed++ }
Write-Host '--------------------'
Write-Host "Passed $passed of $($checks.Count) checks."
