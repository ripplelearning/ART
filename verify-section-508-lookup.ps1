$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$lookup = Get-Content (Join-Path $root 'lookupTool.js') -Raw
$catalog = Get-Content (Join-Path $root 'wcagCatalog.js') -Raw
$templateCatalog = Get-Content (Join-Path $root 'section508TemplateCatalog.js') -Raw

function Assert-Contains([string]$name, [string]$content, [string]$pattern, [string]$message) {
    if ($content -notmatch $pattern) {
        throw "FAIL: [$name] $message Missing pattern: $pattern"
    }
}

Assert-Contains 'lookupTool.js' $lookup 'let data = await loadWcagCatalog\(\)' 'Lookup catalog is not reloadable.'
Assert-Contains 'lookupTool.js' $lookup 'art-accessibility-standards-updated' 'Lookup Tool does not observe imported standard changes.'
Assert-Contains 'lookupTool.js' $lookup 'data = await loadWcagCatalog\(\)' 'Lookup Tool does not refresh criteria after standard changes.'
Assert-Contains 'lookupTool.js' $lookup 'applyFilters\(\)' 'Lookup Tool does not reapply the selected standard filter after refresh.'
Assert-Contains 'wcagCatalog.js' $catalog 'getImportedAccessibilityStandards' 'Merged catalog does not include imported standards.'
Assert-Contains 'wcagCatalog.js' $catalog 'normalizeImportedCatalogEntry' 'Imported criteria are not normalized for lookup.'
Assert-Contains 'lookupTool.js' $lookup 'getSection508LookupCriteria' 'Supplied Section 508 template tests are not merged into lookup.'
Assert-Contains 'lookupTool.js' $lookup 'data-lookup-category' 'Section 508 tests are not grouped by category.'
Assert-Contains 'lookupTool.js' $lookup 'How to test:' 'Lookup entries do not display test procedures.'
Assert-Contains 'lookupTool.js' $lookup 'Result guidance:' 'Lookup entries do not display result guidance.'
Assert-Contains 'lookupTool.js' $lookup 'How to document results:' 'Lookup entries do not display documentation guidance.'
Assert-Contains 'section508TemplateCatalog.js' $templateCatalog 'LOOKUP_CATEGORIES' 'Section 508 lookup category list is missing.'

Write-Host 'Section 508 Lookup Verification'
Write-Host '-------------------------------'
Write-Host 'PASS: Lookup Tool reloads the merged catalog when standards change.'
Write-Host 'PASS: Imported Section 508 criteria remain filterable by standard.'
Write-Host '-------------------------------'
Write-Host 'Passed 2 of 2 checks.'
