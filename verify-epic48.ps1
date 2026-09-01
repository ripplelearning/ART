$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
function Read-Text([string]$name) { Get-Content (Join-Path $root $name) -Raw }
function Assert-All([string]$name, [string]$content, [string[]]$patterns, [string]$message) { foreach ($pattern in $patterns) { if ($content -notmatch $pattern) { throw "FAIL: [$name] $message Missing pattern: $pattern" } } }
$security = Read-Text 'SECURITY.md'
$readme = Read-Text 'README.md'
$guide = Read-Text 'USER-GUIDE.md'
$help = Read-Text 'HELP.md'
$architecture = Read-Text 'ARCHITECTURE.md'
$identity = Read-Text 'identityFramework.js'
$checks = @()
$checks += [pscustomobject]@{ Name = 'Security boundary and disclosure guidance'; Script = { Assert-All 'SECURITY.md' $security @('Current Security Boundary', 'Report a Vulnerability', 'Security Release Checklist', 'Future Hosted and Self-Hosted Requirements') 'Security boundary documentation is incomplete.' } }
$checks += [pscustomobject]@{ Name = 'No credential persistence boundary'; Script = { Assert-All 'identityFramework.js' $identity @('never receives, stores, or exposes their tokens', 'sessionStorage') 'Identity service token protection boundary is incomplete.' } }
$checks += [pscustomobject]@{ Name = 'Documentation links and local-first guidance'; Script = { Assert-All 'README.md' $readme @('\[Security and Privacy\]\(SECURITY\.md\)') 'README security link is missing.'; Assert-All 'USER-GUIDE.md' $guide @('## Security and Privacy', 'Privacy Mode') 'User Guide security guidance is missing.'; Assert-All 'HELP.md' $help @('## Security and Privacy', 'ART Security and Privacy') 'Help security guidance is missing.'; Assert-All 'ARCHITECTURE.md' $architecture @('### Security Boundary', 'SECURITY\.md') 'Architecture security boundary is missing.' } }
Write-Host 'Epic 48 Verification'; Write-Host '--------------------'; $passed = 0; foreach ($check in $checks) { & $check.Script; Write-Host "PASS: $($check.Name)"; $passed++ }; Write-Host '--------------------'; Write-Host "Passed $passed of $($checks.Count) checks."
