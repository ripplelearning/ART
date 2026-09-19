$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path

function Read-Text([string]$name) {
    return Get-Content (Join-Path $root $name) -Raw
}

function Assert-Contains([string]$name, [string]$content, [string]$pattern, [string]$message) {
    if ($content -notmatch $pattern) {
        throw "FAIL: [$name] $message Missing pattern: $pattern"
    }
}

$state = Read-Text 'state.js'
$menuBar = Read-Text 'menuBar.js'
$dashboard = Read-Text 'dashboard.js'
$reportBuilder = Read-Text 'reportBuilder.js'
$help = Read-Text 'help.js'
$userGuide = Read-Text 'USER-GUIDE.md'

Assert-Contains 'state.js' $state 'builtin-section-508-review' 'Section 508 template is missing from the built-in catalog.'
Assert-Contains 'state.js' $state 'Section 508 Accessibility Review' 'Section 508 template name is missing.'
Assert-Contains 'state.js' $state 'ICT Scope and Applicability' 'Section 508 scope field is missing.'
Assert-Contains 'state.js' $state 'Test Method and Assistive Technology' 'Section 508 testing field is missing.'
Assert-Contains 'state.js' $state 'Remediation and Evidence' 'Section 508 remediation field is missing.'
Assert-Contains 'menuBar.js' $menuBar 'getBuiltInTemplates\(\)' 'Menubar does not use the shared built-in template catalog.'
Assert-Contains 'dashboard.js' $dashboard 'getBuiltInTemplates\(\)' 'Dashboard does not use the shared built-in template catalog.'
Assert-Contains 'reportBuilder.js' $reportBuilder 'getBuiltInTemplates\(\)' 'Report Builder does not use the shared built-in template catalog.'
Assert-Contains 'help.js' $help 'Section 508 Accessibility Review' 'In-app Help does not document the Section 508 template.'
Assert-Contains 'USER-GUIDE.md' $userGuide 'Section 508 Accessibility Review' 'User Guide does not document the Section 508 template.'

Write-Host 'Section 508 Template Verification'
Write-Host '---------------------------------'
Write-Host 'PASS: Section 508 review template is present in the shared built-in catalog.'
Write-Host 'PASS: Menubar, Dashboard, and Report Builder consume the shared catalog.'
Write-Host 'PASS: Template fields and documentation are present.'
Write-Host '---------------------------------'
Write-Host 'Passed 3 of 3 checks.'
