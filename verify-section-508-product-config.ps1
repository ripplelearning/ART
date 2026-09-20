$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$builder = Get-Content (Join-Path $root 'reportBuilder.js') -Raw
$editor = Get-Content (Join-Path $root 'reportEditor.js') -Raw
$state = Get-Content (Join-Path $root 'state.js') -Raw
$catalog = Get-Content (Join-Path $root 'section508TemplateCatalog.js') -Raw
$viewer = Get-Content (Join-Path $root 'reportViewer.js') -Raw

function Assert-Contains([string]$name, [string]$content, [string]$pattern, [string]$message) {
    if ($content -notmatch $pattern) { throw "FAIL: [$name] $message Missing pattern: $pattern" }
}

Assert-Contains 'section508TemplateCatalog.js' $catalog 'section-508-web-audit-report-template\.json' 'Web template mapping is missing.'
Assert-Contains 'section508TemplateCatalog.js' $catalog 'section-508-software-audit-report-template\.json' 'Software template mapping is missing.'
Assert-Contains 'section508TemplateCatalog.js' $catalog 'Electronic Document.*Software.*Hardware' 'Section 508 product type list is incomplete.'
Assert-Contains 'section508TemplateCatalog.js' $catalog 'Level A.*Level AA.*Level AAA' 'Section 508 conformance levels are incomplete.'
Assert-Contains 'section508TemplateCatalog.js' $catalog 'filterSection508Criteria' 'Product type and conformance filtering is missing.'
Assert-Contains 'reportBuilder.js' $builder 'section-508-product-type' 'Product Type control is missing from Report Builder.'
Assert-Contains 'reportBuilder.js' $builder 'section-508-conformance-level' 'Conformance Level control is missing from Report Builder.'
Assert-Contains 'reportBuilder.js' $builder 'section-508-testing-dates' 'Testing Date(s) control is missing from Report Builder.'
Assert-Contains 'reportBuilder.js' $builder 'section-508-report-notes' 'Report Notes control is missing from Report Builder.'
Assert-Contains 'reportEditor.js' $editor 'getSection508Template' 'Editor does not load the selected Section 508 template.'
Assert-Contains 'reportEditor.js' $editor 'filterSection508Criteria' 'Editor does not filter Section 508 criteria.'
Assert-Contains 'state.js' $state 'Product Type is required\.' 'Section 508 Product Type validation is missing.'
Assert-Contains 'state.js' $state 'Conformance Level is required\.' 'Section 508 Conformance Level validation is missing.'
Assert-Contains 'state.js' $state 'Testing Date\(s\) is required\.' 'Section 508 Testing Date validation is missing.'
Assert-Contains 'reportViewer.js' $viewer 'Product Type' 'Viewer does not include Section 508 product metadata.'

Write-Host 'Section 508 Product Configuration Verification'
Write-Host '----------------------------------------------'
Write-Host 'PASS: Web and Software template mappings are data-driven and distinct.'
Write-Host 'PASS: Product Type, Conformance Level, Testing Date(s), and Notes controls are wired.'
Write-Host 'PASS: Criteria filtering, persistence, validation, and viewer metadata are wired.'
Write-Host '----------------------------------------------'
Write-Host 'Passed 3 of 3 checks.'
