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

$index = Read-Text 'index.html'
$settings = Read-Text 'settings.js'
$state = Read-Text 'state.js'
$catalog = Read-Text 'commandCatalog.js'
$commands = Read-Text 'COMMANDS.md'
$helpDoc = Read-Text 'HELP.md'
$helpShell = Read-Text 'art-help/index.html'
$architecture = Read-Text 'ARCHITECTURE.md'
$readme = Read-Text 'README.md'
$userGuide = Read-Text 'USER-GUIDE.md'
$serverGuide = Read-Text 'collaboration-server/README.md'
$serverLauncher = Read-Text 'start-collaboration-server.ps1'
$serverLauncherWithHealth = Read-Text 'start-collaboration-server-and-open-health.ps1'
$serverStopper = Read-Text 'stop-collaboration-server.ps1'

$checks = @()

$checks += [pscustomobject]@{ Name = 'Collaboration settings UI controls and guidance'; Script = {
    Assert-All 'index.html' $index @(
        'settings-collaboration-preset-summary',
        'btn-settings-collaboration-preset-solo',
        'btn-settings-collaboration-preset-team',
        'btn-settings-collaboration-reset-baseline',
        'settings-collaboration-live-server-url',
        'btn-settings-collaboration-live-quickstart',
        'btn-settings-collaboration-live-connect',
        'btn-settings-collaboration-live-disconnect',
        'btn-settings-collaboration-live-start-session',
        'btn-settings-collaboration-live-publish',
        'btn-settings-collaboration-live-pull',
        'settings-collaboration-discovery-scope',
        'settings-collaboration-conflict-strategy',
        'Use Resource for private/local workflows',
        'Manual Review keeps local data unchanged'
    ) 'Main settings shell is missing collaboration controls or helper copy.'

    Assert-All 'art-help/index.html' $helpShell @(
        'settings-collaboration-preset-summary',
        'btn-settings-collaboration-preset-solo',
        'btn-settings-collaboration-preset-team',
        'btn-settings-collaboration-reset-baseline',
        'settings-collaboration-live-server-url',
        'btn-settings-collaboration-live-quickstart',
        'btn-settings-collaboration-live-publish',
        'btn-settings-collaboration-live-pull',
        'The preset summary line shows Solo or Team',
        'Reset to Baseline reapplies the closest preset',
        'Live Collaboration Quick Start'
    ) 'Help shell is missing collaboration control parity.'
}}

$checks += [pscustomobject]@{ Name = 'Collaboration settings runtime behavior'; Script = {
    Assert-All 'settings.js' $settings @(
        'function getCollaborationPresetLabel\(',
        'function getCollaborationBaselinePreset\(',
        'function resetCollaborationBaselineFromSettings\(',
        'Current collaboration preset: \$\{presetLabel\}',
        'btn-settings-collaboration-reset-baseline',
        'Reset collaboration to \$\{isTeam \? ''team'' : ''solo''\} baseline',
        'export function applySoloCollaborationPresetFromCommand\(',
        'export function applyTeamCollaborationPresetFromCommand\(',
        'export function resetCollaborationBaselineFromCommand\(',
        'export function recordCollaborationSyncCheckpointFromCommand\(',
        'export function generateCollaborationDiscoverySnapshotFromCommand\(',
        'export function queueCollaborationTestConflictFromCommand\(',
        'export function resolveOldestCollaborationConflictFromCommand\(',
        'export function registerCollaborationPresenceSessionFromCommand\(',
        'export function clearCollaborationSessionsFromCommand\(',
        'export async function quickStartLiveCollaborationFromCommand\(',
        'export async function connectLiveCollaborationFromCommand\(',
        'export function disconnectLiveCollaborationFromCommand\(',
        'export function startLiveCollaborationSessionFromCommand\(',
        'export function publishAsyncCollaborationSnapshotFromCommand\(',
        'export async function pullAsyncCollaborationSnapshotFromCommand\('
    ) 'Collaboration settings runtime or command wrappers are incomplete.'
}}

$checks += [pscustomobject]@{ Name = 'Command and shortcut coverage'; Script = {
    Assert-All 'commandCatalog.js' $catalog @(
        'action:\s*''settingsCustomizeCollaboration''',
        'action:\s*''toggleCollaboration''',
        'action:\s*''toggleCollaborationToolbar''',
        'action:\s*''settingsCollaborationApplySoloDefaults''',
        'action:\s*''settingsCollaborationApplyTeamDefaults''',
        'action:\s*''settingsCollaborationResetBaseline''',
        'action:\s*''settingsCollaborationRecordSyncCheckpoint''',
        'action:\s*''settingsCollaborationGenerateDiscoverySnapshot''',
        'action:\s*''settingsCollaborationQueueTestConflict''',
        'action:\s*''settingsCollaborationResolveOldestConflict''',
        'action:\s*''settingsCollaborationRegisterPresenceSession''',
        'action:\s*''settingsCollaborationClearSessions''',
        'action:\s*''settingsCollaborationLiveQuickStart''',
        'action:\s*''settingsCollaborationLiveConnect''',
        'action:\s*''settingsCollaborationLiveDisconnect''',
        'action:\s*''settingsCollaborationLiveStartSession''',
        'action:\s*''settingsCollaborationPublishAsyncSnapshot''',
        'action:\s*''settingsCollaborationPullAsyncSnapshot'''
    ) 'Command catalog is missing collaboration commands.'

    Assert-All 'state.js' $state @(
        'settingsCustomizeCollaboration:\s*''''',
        'toggleCollaboration:\s*''''',
        'toggleCollaborationToolbar:\s*''''',
        'settingsCollaborationApplySoloDefaults:\s*''''',
        'settingsCollaborationApplyTeamDefaults:\s*''''',
        'settingsCollaborationResetBaseline:\s*''''',
        'settingsCollaborationRecordSyncCheckpoint:\s*''''',
        'settingsCollaborationGenerateDiscoverySnapshot:\s*''''',
        'settingsCollaborationQueueTestConflict:\s*''''',
        'settingsCollaborationResolveOldestConflict:\s*''''',
        'settingsCollaborationRegisterPresenceSession:\s*''''',
        'settingsCollaborationClearSessions:\s*''''',
        'settingsCollaborationLiveQuickStart:\s*''''',
        'settingsCollaborationLiveConnect:\s*''''',
        'settingsCollaborationLiveDisconnect:\s*''''',
        'settingsCollaborationLiveStartSession:\s*''''',
        'settingsCollaborationPublishAsyncSnapshot:\s*''''',
        'settingsCollaborationPullAsyncSnapshot:\s*'''''
    ) 'Shortcut defaults are missing collaboration action keys.'
}}

$checks += [pscustomobject]@{ Name = 'Documentation coverage'; Script = {
    Assert-All 'COMMANDS.md' $commands @(
        'settingsCollaborationApplySoloDefaults',
        'settingsCollaborationApplyTeamDefaults',
        'settingsCollaborationResetBaseline',
        'settingsCollaborationRecordSyncCheckpoint',
        'settingsCollaborationGenerateDiscoverySnapshot',
        'settingsCollaborationQueueTestConflict',
        'settingsCollaborationResolveOldestConflict',
        'settingsCollaborationRegisterPresenceSession',
        'settingsCollaborationClearSessions',
        'settingsCollaborationLiveQuickStart',
        'settingsCollaborationLiveConnect',
        'settingsCollaborationLiveDisconnect',
        'settingsCollaborationLiveStartSession',
        'settingsCollaborationPublishAsyncSnapshot',
        'settingsCollaborationPullAsyncSnapshot'
    ) 'Command docs are missing collaboration command entries.'

    Assert-All 'HELP.md' $helpDoc @(
        'Preset summary',
        'Reset to Baseline',
        'Open Collaboration Settings Section',
        'Apply Collaboration Solo Defaults',
        'Generate Collaboration Discovery Snapshot',
        'Resolve Oldest Collaboration Conflict',
        'Live collaboration server URL',
        'Quick Start Live Collaboration',
        'Publish Async Snapshot',
        'Pull Async Snapshot',
        'start-collaboration-server-and-open-health.ps1'
    ) 'Help documentation is missing collaboration guidance.'

    Assert-All 'README.md' $readme @(
        'Collaboration Server \(Live and Asynchronous\)',
        'Quick Start Live Collaboration',
        'Publish Async Snapshot',
        'Pull Async Snapshot',
        'start-collaboration-server.ps1',
        'start-collaboration-server-and-open-health.ps1',
        'stop-collaboration-server.ps1'
    ) 'Repository README is missing collaboration server setup guidance.'

    Assert-All 'USER-GUIDE.md' $userGuide @(
        'Collaboration Setup and Usage',
        'Quick Start Live Collaboration',
        'Disconnect Server',
        'Publish Async Snapshot',
        'Pull Async Snapshot',
        'start-collaboration-server.ps1',
        'start-collaboration-server-and-open-health.ps1',
        'stop-collaboration-server.ps1'
    ) 'User guide is missing collaboration operation guidance.'

    Assert-All 'collaboration-server/README.md' $serverGuide @(
        'Windows one-command launcher',
        'start-collaboration-server.ps1',
        'start-collaboration-server-and-open-health.ps1',
        'stop-collaboration-server.ps1',
        'Asynchronous Shared-Folder Workflow',
        'Disconnect and Session End'
    ) 'Collaboration server guide is missing setup or operations detail.'

    Assert-All 'ARCHITECTURE.md' $architecture @(
        'Collaboration Framework',
        'Collaboration Server Layer',
        'collaborationFramework.js',
        'collaboration-server/server.js'
    ) 'Architecture documentation is missing collaboration system coverage.'

    Assert-All 'start-collaboration-server.ps1' $serverLauncher @(
        'ART_COLLAB_SHARED_FOLDER',
        'ART_COLLAB_TOKEN',
        'npm start'
    ) 'Collaboration server launcher script is missing required runtime wiring.'

    Assert-All 'start-collaboration-server-and-open-health.ps1' $serverLauncherWithHealth @(
        'start-collaboration-server.ps1',
        'Invoke-RestMethod',
        '/health',
        'Start-Process'
    ) 'Collaboration server health launcher script is missing startup or health-check logic.'

    Assert-All 'stop-collaboration-server.ps1' $serverStopper @(
        'Get-NetTCPConnection',
        '-LocalPort',
        'Stop-Process',
        'node'
    ) 'Collaboration server stop script is missing required shutdown logic.'
}}

$failed = $false

foreach ($check in $checks) {
    try {
        & $check.Script
        Write-Host "PASS: $($check.Name)" -ForegroundColor Green
    } catch {
        $failed = $true
        Write-Host $_.Exception.Message -ForegroundColor Red
    }
}

if ($failed) {
    throw 'Epic 39 verification failed.'
}

Write-Host 'Epic 39 verification passed.' -ForegroundColor Green