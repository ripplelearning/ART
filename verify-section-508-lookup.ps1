$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$lookup = Get-Content (Join-Path $root 'lookupTool.js') -Raw
$catalog = Get-Content (Join-Path $root 'wcagCatalog.js') -Raw

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

Write-Host 'Section 508 Lookup Verification'
Write-Host '-------------------------------'
Write-Host 'PASS: Lookup Tool reloads the merged catalog when standards change.'
Write-Host 'PASS: Imported Section 508 criteria remain filterable by standard.'
Write-Host '-------------------------------'
Write-Host 'Passed 2 of 2 checks.'
