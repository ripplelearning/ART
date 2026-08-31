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

$identity = Read-Text 'identityFramework.js'
$loader = Read-Text 'loader.js'
$settings = Read-Text 'settings.js'
$html = Read-Text 'index.html'
$architecture = Read-Text 'ARCHITECTURE.md'
$help = Read-Text 'HELP.md'
$userGuide = Read-Text 'USER-GUIDE.md'
$inAppHelp = Read-Text 'help.js'

$checks = @()

$checks += [pscustomobject]@{ Name = 'Central identity session service'; Script = {
    Assert-All 'identityFramework.js' $identity @(
        'AUTHENTICATION_STATES',
        'getCurrentAuthenticatedUser',
        'getAuthenticationSession',
        'getLocalUserProfile',
        'getDeviceIdentity',
        'registerAuthenticationProvider',
        'establishAuthenticatedSession',
        'signOutAuthenticatedSession',
        'sessionStorage'
    ) 'Identity/session service is incomplete.'
}}

$checks += [pscustomobject]@{ Name = 'No credential persistence'; Script = {
    Assert-All 'identityFramework.js' $identity @(
        'never receives, stores, or exposes their tokens',
        'Credential and token storage',
        'never receives, stores, or exposes their tokens'
    ) 'Credential and token protection boundary is missing.'
}}

$checks += [pscustomobject]@{ Name = 'Startup and Settings integration'; Script = {
    Assert-All 'loader.js' $loader @('initializeIdentityFramework') 'Identity framework startup initialization is missing.'
    Assert-All 'settings.js' $settings @('renderAccountIdentitySettings', 'bindAccountIdentitySettings', 'signOutAuthenticatedSession') 'Account Settings workflow is incomplete.'
    Assert-All 'index.html' $html @('settings-account-heading', 'settings-local-profile-name', 'btn-settings-auth-sign-out') 'Account Settings markup is missing.'
}}

$checks += [pscustomobject]@{ Name = 'Documentation coverage'; Script = {
    Assert-All 'ARCHITECTURE.md' $architecture @('Identity and Session Framework', 'Authentication and authorization remain separate') 'Developer identity architecture documentation is missing.'
    Assert-All 'HELP.md' $help @('## Account and Identity', 'ART does not store passwords') 'Account Help documentation is missing.'
    Assert-All 'USER-GUIDE.md' $userGuide @('## Account and Identity Foundation', 'Current Authentication Boundary') 'Account User Guide documentation is missing.'
    Assert-All 'help.js' $inAppHelp @('help-account-and-identity', 'Account and Identity') 'In-app account Help topic is missing.'
}}

Write-Host 'Epic 45 Verification'
Write-Host '--------------------'
$passed = 0
foreach ($check in $checks) {
    & $check.Script
    Write-Host "PASS: $($check.Name)"
    $passed++
}
Write-Host '--------------------'
Write-Host "Passed $passed of $($checks.Count) checks."
