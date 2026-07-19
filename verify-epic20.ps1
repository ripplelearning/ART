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

$state = Read-Text 'state.js'
$dashboard = Read-Text 'dashboard.js'
$navigation = Read-Text 'navigation.js'
$viewer = Read-Text 'reportViewer.js'
$help = Read-Text 'help.js'
$index = Read-Text 'index.html'
$projectDoc = Read-Text 'docs/ART-Project-Format-and-Portability.md'
$projectSchema = Read-Text 'art-project.schema.json'
$templateSchema = Read-Text 'art-template.schema.json'

$checks = @()

$checks += [pscustomobject]@{ Name = 'Project payload and validation contracts'; Script = {
	Assert-All 'state.js' $state @(
		'const ART_PROJECT_FORMAT_VERSION = ''1\.0''',
		'const ART_PROJECT_SCHEMA_VERSION = ''1\.0''',
		'export function createArtProjectPayload\(',
		'format:\s*''ART Project''',
		'formatVersion:\s*ART_PROJECT_FORMAT_VERSION',
		'schemaVersion:\s*ART_PROJECT_SCHEMA_VERSION',
		'export function validateArtProjectPayload\(',
		'missing-format-version',
		'missing-schema-version',
		'unsupported-format-version',
		'unsupported-schema-version',
		'export function importArtProjectPayload\('
	) 'ART project payload validation contract is incomplete.'
}}

$checks += [pscustomobject]@{ Name = 'Template payload and validation contracts'; Script = {
	Assert-All 'state.js' $state @(
		'const ART_TEMPLATE_FORMAT_VERSION = ''1\.0''',
		'const ART_TEMPLATE_SCHEMA_VERSION = ''1\.0''',
		'export function createArtxTemplatePayload\(',
		'format:\s*''ART Template''',
		'formatVersion:\s*ART_TEMPLATE_FORMAT_VERSION',
		'schemaVersion:\s*ART_TEMPLATE_SCHEMA_VERSION',
		'export function validateArtxTemplatePayload\(',
		'missing-format-version',
		'missing-schema-version',
		'unsupported-format-version',
		'unsupported-schema-version',
		'export function serializeArtxTemplatePayload\('
	) 'ARTX template payload validation contract is incomplete.'
}}

$checks += [pscustomobject]@{ Name = 'Dashboard project workflow wiring'; Script = {
	Assert-All 'dashboard.js' $dashboard @(
		'validateArtProjectPayload',
		'importArtProjectPayload',
		'serializeArtProjectPayload',
		'Open ART Project',
		'Save As cancelled or failed\. Your work remains in local recovery storage\.',
		'missing-format-version',
		'unsupported-format-version',
		'missing-schema-version',
		'unsupported-schema-version'
	) 'Dashboard project open/save workflow is incomplete.'
}}

$checks += [pscustomobject]@{ Name = 'Dashboard template workflow wiring'; Script = {
	Assert-All 'dashboard.js' $dashboard @(
		'validateArtxTemplatePayload',
		'validateTemplateJsonPayload',
		'Template import failed',
		'missing-template-header',
		'missing-format-version',
		'missing-schema-version',
		'unsupported-format-version',
		'unsupported-schema-version',
		'Template file validated\.'
	) 'Dashboard template import/export workflow is incomplete.'
}}

$checks += [pscustomobject]@{ Name = 'Navigation shortcuts for project workflow'; Script = {
	Assert-All 'navigation.js' $navigation @(
		'action:\s*''openProject''',
		'action:\s*''saveProject''',
		'action:\s*''saveProjectAs''',
		'action:\s*''importData'''
	) 'Project workflow shortcuts are not fully wired in navigation.'
}}

$checks += [pscustomobject]@{ Name = 'Report export includes editable project payload'; Script = {
	Assert-All 'reportViewer.js' $viewer @(
		'serializeArtProjectPayload',
		'serializeArtJsonPayload',
		'buildZipExportBlob',
		'_ART\.json',
		'\.art',
		'zip'
	) 'Report ZIP export does not include expected project payload artifacts.'
}}

$checks += [pscustomobject]@{ Name = 'Help and UI project labels'; Script = {
	Assert-All 'index.html' $index @(
		'Open ART Project\.\.\.',
		'Save Project',
		'Save Project As\.\.\.',
		'Import\.\.\.'
	) 'Dashboard labels for project workflow are incomplete.'

	Assert-All 'help.js' $help @(
		'\.art \(project\)',
		'\.artx \(template\)',
		'formatVersion or schemaVersion is missing or not supported',
		'ZIP exports include.*editable \.art project file'
	) 'Help documentation for project/template portability is incomplete.'
}}

$checks += [pscustomobject]@{ Name = 'Schema and portability documentation'; Script = {
	Assert-All 'art-project.schema.json' $projectSchema @(
		'"title"\s*:\s*"ART Project File"',
		'"format"',
		'"ART Project"',
		'"formatVersion"',
		'"schemaVersion"',
		'"metadata"',
		'"project"'
	) 'Project schema is incomplete.'

	Assert-All 'art-template.schema.json' $templateSchema @(
		'"ART Template"',
		'"formatVersion"',
		'"schemaVersion"',
		'"template"'
	) 'Template schema is incomplete.'

	Assert-All 'docs/ART-Project-Format-and-Portability.md' $projectDoc @(
		'# ART Project Format and Portability',
		'Open ART Project',
		'Save Project As',
		'ART validates `format`, `formatVersion`, and `schemaVersion` before import'
	) 'Project portability documentation is incomplete.'
}}

Write-Host 'Epic 20 Verification'
Write-Host '--------------------'

$passed = 0
foreach ($check in $checks) {
	& $check.Script
	Write-Host "PASS: $($check.Name)"
	$passed += 1
}

Write-Host '--------------------'
Write-Host "Passed $passed of $($checks.Count) checks."
