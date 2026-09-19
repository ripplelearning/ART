$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$editor = Get-Content (Join-Path $root 'reportEditor.js') -Raw
$style = Get-Content (Join-Path $root 'style.css') -Raw

function Assert-Contains([string]$name, [string]$content, [string]$pattern, [string]$message) {
    if ($content -notmatch $pattern) {
        throw "FAIL: [$name] $message Missing pattern: $pattern"
    }
}

Assert-Contains 'reportEditor.js' $editor 'editor-field-cell-label-\$\{entryIndex\}-\$\{fieldIndex\}' 'Multi-entry audit fields do not render visible field labels.'
Assert-Contains 'reportEditor.js' $editor 'class="editor-field-cell-label"' 'Multi-entry audit labels do not use the visible label class.'
Assert-Contains 'reportEditor.js' $editor 'audit-col-\$\{fieldIndex\} editor-field-cell-label-\$\{entryIndex\}-\$\{fieldIndex\}' 'Multi-entry controls are not programmatically associated with their visible labels.'
Assert-Contains 'reportEditor.js' $editor 'id="\$\{labelId\}" for="editor-field-0-\$\{index\}"' 'Single-entry fields are missing explicit label-for associations.'
Assert-Contains 'style.css' $style '\.editor-field-cell-label\s*\{[^}]*display:\s*block' 'Visible audit field labels are not styled as visible block labels.'

Write-Host 'Section 508 Field Label Verification'
Write-Host '-------------------------------------'
Write-Host 'PASS: Multi-entry audit controls have visible labels and programmatic associations.'
Write-Host 'PASS: Single-entry controls have explicit label-for associations.'
Write-Host 'PASS: Visible audit field labels have stable styling.'
Write-Host '-------------------------------------'
Write-Host 'Passed 3 of 3 checks.'
