$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$packagePath = Join-Path $root 'packages/accessibility-standards/section-508.package.json'
$defaultStandardsPath = Join-Path $root 'defaultStandards.js'

if (-not (Test-Path $packagePath)) { throw 'FAIL: Missing Section 508 package.' }
$package = Get-Content $packagePath -Raw | ConvertFrom-Json
$standard = @($package.standards)[0]

function Assert-True([bool]$condition, [string]$message) {
    if (-not $condition) { throw "FAIL: $message" }
}

Assert-True ($package.artAccessibilityStandardsVersion -eq '1.0') 'Package format version is not supported.'
Assert-True ($package.package.packageType -eq 'accessibility-standards') 'Package type is incorrect.'
Assert-True ($package.package.supportedArtVersion -eq '2.0') 'Package does not declare ART Version 2.0 support.'
Assert-True ($package.package.optional -eq $true) 'Package is not marked optional.'
Assert-True ($package.package.includedInCoreStandards -eq $false) 'Package must remain outside core standards.'
Assert-True ($package.package.officialSource -match '^https://www\.access-board\.gov/') 'Official Access Board source is missing.'
Assert-True ($package.package.testingSource -match '^https://www\.section508\.gov/test/') 'Section508.gov testing source is missing.'
Assert-True ($package.package.trustedTesterSource -match '^https://www\.section508\.gov/test/trusted-tester/') 'Trusted Tester source is missing.'
Assert-True ($standard.officialSource -match '^https://www\.access-board\.gov/') 'Standard official source is missing.'
Assert-True (@($standard.chapters).Count -eq 7) 'Revised 508 Chapters 1 through 7 are incomplete.'
Assert-True (@($standard.ictTypes).Count -ge 5) 'ICT scope categories are incomplete.'
Assert-True (@($standard.testingLifecycle).Count -eq 4) 'Testing lifecycle is incomplete.'
Assert-True ($standard.trustedTester.currentWebVersion -eq '5.1.3') 'Trusted Tester version metadata is missing.'
Assert-True (@($standard.criteria).Count -ge 7) 'Representative Section 508 criteria foundation is incomplete.'
Assert-True (@($standard.criteria | Where-Object { $_.number -eq '302.9' }).Count -eq 1) 'Speech functional performance criterion is missing.'
Assert-True (@($standard.criteria | Where-Object { $_.number -eq 'software-interoperability' }).Count -eq 1) 'Software interoperability criterion is missing.'
Assert-True (@($standard.criteria | Where-Object { $_.number -eq 'support-documentation' }).Count -eq 1) 'Support documentation criterion is missing.'
Assert-True ($package.package.legalScope -match 'not.*legal|legal.*not') 'Legal applicability limitation is missing.'
Assert-True ($package.package.notes -match 'Human') 'Human review limitation is missing.'
$defaultStandards = Get-Content $defaultStandardsPath -Raw
Assert-True ($defaultStandards -notmatch 'section-508|Section 508') 'Section 508 was merged into default standards.'

Write-Host 'Section 508 Package Verification'
Write-Host '-------------------------------'
Write-Host 'PASS: Optional ART 2.0 package metadata is valid.'
Write-Host 'PASS: Revised 508 scope, chapters, lifecycle, and representative criteria are present.'
Write-Host 'PASS: Official Access Board, Section508.gov, and Trusted Tester links are present.'
Write-Host 'PASS: Package remains separate from defaultStandards.js.'
Write-Host '-------------------------------'
Write-Host 'Passed 4 of 4 checks.'
