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
$builder = Read-Text 'reportBuilder.js'
$editor = Read-Text 'reportEditor.js'
$viewer = Read-Text 'reportViewer.js'
$dashboard = Read-Text 'dashboard.js'
$navigation = Read-Text 'navigation.js'
$help = Read-Text 'help.js'
$style = Read-Text 'style.css'

$checks = @()

$checks += [pscustomobject]@{ Name = 'Progress Log state model and field validation'; Script = {
	Assert-All 'state.js' $state @(
		'progressLogEnabled',
		'progressLogAppendixEnabled',
		'progressItems',
		'getProgressStatuses',
		'getDefaultProgressItemTypes',
		'isProgressLogEnabled',
		'isProgressLogAppendixEnabled',
		'getProgressItems',
		'getProgressItemNames',
		'updateProgressLogSettings',
		'addProgressItem',
		'updateProgressItem',
		'updateProgressItemStatus',
		'removeProgressItem',
		'getProgressLogMetrics',
		'evaluation-item-selection'
	) 'Progress Log state support is incomplete.'
}}

$checks += [pscustomobject]@{ Name = 'Builder Progress Log controls'; Script = {
	Assert-All 'reportBuilder.js' $builder @(
		'progress-log-builder-region',
		'progress-log-enabled',
		'progress-log-appendix-enabled',
		'progress-log-config-list',
		'evaluation-item-selection',
		'Progress Log Configuration'
	) 'Builder Progress Log configuration is incomplete.'
}}

$checks += [pscustomobject]@{ Name = 'Editor and viewer Progress Log actions'; Script = {
	Assert-All 'reportEditor.js' $editor @(
		'btn-editor-progress-log',
		'openProgressLogDialog',
		'isProgressLogEnabled'
	) 'Editor Progress Log access is incomplete.'

	Assert-All 'reportViewer.js' $viewer @(
		'btn-viewer-progress-log',
		'openProgressLogDialog',
		'isProgressLogEnabled',
		'isProgressLogAppendixEnabled',
		'buildProgressAppendixText',
		'buildProgressAppendixMarkdown',
		'renderProgressAppendixHtmlSection',
		'renderProgressAppendixViewer'
	) 'Viewer Progress Log access and appendix export are incomplete.'
}}

$checks += [pscustomobject]@{ Name = 'Dashboard and navigation integration'; Script = {
	Assert-All 'dashboard.js' $dashboard @(
		'getProgressLogMetrics',
		'art-progress-log-updated'
	) 'Dashboard Progress Log metrics are incomplete.'

	Assert-All 'navigation.js' $navigation @(
		'action:\s*''openProgressLog''',
		'btn-editor-progress-log',
		'btn-viewer-progress-log'
	) 'Navigation Progress Log routing is incomplete.'
}}

$checks += [pscustomobject]@{ Name = 'Help and styling coverage'; Script = {
	Assert-All 'help.js' $help @(
		'Progress Log Workflow',
		'Evaluation Item Selection Box',
		'Progress Log Appendix'
	) 'Help documentation for Progress Log is incomplete.'

	Assert-All 'style.css' $style @(
		'#progress-log-dialog',
		'\.progress-log-header',
		'\.progress-log-actions',
		'\.progress-log-table-wrapper',
		'\.progress-log-table',
		'\.progress-log-notes'
	) 'Progress Log styling is incomplete.'
}}

Write-Host 'Epic 21 Verification'
Write-Host '--------------------'

$passed = 0
foreach ($check in $checks) {
	& $check.Script
	Write-Host "PASS: $($check.Name)"
	$passed += 1
}

Write-Host '--------------------'
Write-Host "Passed $passed of $($checks.Count) checks."