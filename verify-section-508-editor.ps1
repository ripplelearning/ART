$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$editor = Get-Content (Join-Path $root 'reportEditor.js') -Raw
$viewer = Get-Content (Join-Path $root 'reportViewer.js') -Raw
$state = Get-Content (Join-Path $root 'state.js') -Raw
$package = Get-Content (Join-Path $root 'packages/accessibility-standards/section-508.package.json') -Raw | ConvertFrom-Json

function Assert-Contains([string]$name, [string]$content, [string]$pattern, [string]$message) {
    if ($content -notmatch $pattern) {
        throw "FAIL: [$name] $message Missing pattern: $pattern"
    }
}

function Assert-NotContains([string]$name, [string]$content, [string]$pattern, [string]$message) {
    if ($content -match $pattern) {
        throw "FAIL: [$name] $message Unexpected pattern: $pattern"
    }
}

Assert-Contains 'reportEditor.js' $editor 'isSection508Report\(\)' 'Section 508 editor mode is missing.'
Assert-Contains 'reportEditor.js' $editor 'OpenACR Section 508 Accessibility Conformance Report' 'OpenACR report heading is missing.'
Assert-Contains 'reportEditor.js' $editor 'Fillable Report Information' 'Fillable ACR information section is missing.'
Assert-Contains 'reportEditor.js' $editor 'Informative Sections and Sources' 'Informative ACR section is missing.'
Assert-Contains 'reportEditor.js' $editor 'data-section-508-acr-field' 'ACR fields are not wired to persisted state.'
Assert-Contains 'reportEditor.js' $editor 'acreditor\.section508\.gov' 'Official OpenACR Editor source link is missing.'
Assert-Contains 'reportEditor.js' $editor 'Section 508 Official Report Template' 'Section 508 official report template heading is missing.'
Assert-Contains 'reportEditor.js' $editor 'getSection508Criteria\(section508Template\)' 'Editor does not include individual FPC records with product tests.'
Assert-Contains 'reportEditor.js' $editor 'testingRequirements' 'Editor does not display FPC testing requirements.'
Assert-Contains 'reportEditor.js' $editor 'expectedResult' 'Editor does not display FPC expected results.'
Assert-Contains 'reportEditor.js' $editor 'data-section-508-field="result"' 'Section 508 result controls are missing.'
Assert-Contains 'reportEditor.js' $editor 'data-section-508-field="comments"' 'Section 508 comments controls are missing.'
Assert-Contains 'reportEditor.js' $editor 'data-section-508-add-issue' 'Section 508 Add Issue controls are missing.'
Assert-Contains 'reportEditor.js' $editor 'Add a row for \$\{escapeHtml\(baseCriterionName\)\}' 'Section 508 Add Issue labels are not criterion-specific.'
Assert-Contains 'reportEditor.js' $editor 'const occurrence = entries' 'Repeated Section 508 rows do not calculate an occurrence number.'
Assert-Contains 'reportEditor.js' $editor '\$\{baseCriterionName\} \(\$\{occurrence\}\)' 'Repeated Section 508 rows do not receive numbered labels.'
Assert-Contains 'reportEditor.js' $editor 'Add a row for \$\{escapeHtml\(baseCriterionName\)\}' 'Repeated Section 508 Add Issue labels do not retain the base criterion name.'
Assert-Contains 'reportEditor.js' $editor 'fixedResult.*disabled aria-disabled' 'Fixed Section 508 results are not locked.'
Assert-Contains 'reportEditor.js' $editor 'section-508-report-notes' 'Report Notes is not in the Section 508 Editor.'
Assert-NotContains 'reportEditor.js' $editor "field\('reportDate'" 'The duplicate Editor Report Date field must be removed.'
Assert-Contains 'reportEditor.js' $editor 'aria-labelledby="\$\{criterionLabelId\} section-508-result-label' 'Result controls are not associated with criterion and visible result labels.'
Assert-Contains 'reportEditor.js' $editor 'aria-labelledby="\$\{criterionLabelId\} section-508-comments-label' 'Comments controls are not associated with criterion and visible comments labels.'
Assert-Contains 'reportEditor.js' $editor 'fieldValues: \[sourceEntry\.fieldValues\?\.\[0\], sourceEntry\.fieldValues\?\.\[0\]\?\.fixedResult \|\| '''', ''''\]' 'Add Issue does not preserve fixed results while blanking optional comments.'
Assert-Contains 'state.js' $state 'resultOptions: Array\.isArray\(standard\?\.resultOptions\)' 'Approved Section 508 result options are not preserved in state.'
Assert-Contains 'state.js' $state 'auditDateStart.*Audit Start is required' 'Section 508 Audit Start validation is missing.'
Assert-Contains 'state.js' $state 'auditDateEnd.*Audit End is required' 'Section 508 Audit End validation is missing.'
Assert-Contains 'reportViewer.js' $viewer 'renderSection508AcrReportBlock' 'ACR information is missing from report output.'
Assert-Contains 'reportViewer.js' $viewer 'renderSection508CriteriaReportBlock' 'Section 508 criteria results are missing from report output.'

$expectedResults = @('Supports', 'Supports with Exceptions', 'Does Not Support', 'Not Applicable', 'Not Evaluated')
$actualResults = @($package.standards[0].resultOptions | ForEach-Object { $_.label })
if ((@($actualResults) -join '|') -ne (@($expectedResults) -join '|')) {
    throw "FAIL: Package result options do not match the approved Section 508 values."
}

Write-Host 'Section 508 Editor Verification'
Write-Host '-------------------------------'
Write-Host 'PASS: Official criteria template, result controls, comments, and Add Issue actions are present.'
Write-Host 'PASS: Editor controls include programmatic label associations.'
Write-Host 'PASS: Approved Section 508 result options are preserved and validated.'
Write-Host '-------------------------------'
Write-Host 'Passed 3 of 3 checks.'
