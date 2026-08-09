param(
    [string]$HostName = '0.0.0.0',
    [int]$Port = 8787,
    [string]$WebSocketPath = '/art-live',
    [string]$SharedFolder = '',
    [string]$Token = '',
    [switch]$SkipInstall,
    [int]$HealthTimeoutSeconds = 30,
    [switch]$NoOpenBrowser
)

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$launcherPath = Join-Path $root 'start-collaboration-server.ps1'

if (-not (Test-Path $launcherPath)) {
    throw "Missing launcher script: $launcherPath"
}

function Quote-Argument([string]$value) {
    if ($null -eq $value) {
        return '""'
    }

    return '"' + ($value -replace '"', '""') + '"'
}

$argParts = @(
    '-ExecutionPolicy Bypass',
    "-File $(Quote-Argument $launcherPath)",
    "-HostName $(Quote-Argument $HostName)",
    "-Port $Port",
    "-WebSocketPath $(Quote-Argument $WebSocketPath)"
)

if ($SkipInstall) {
    $argParts += '-SkipInstall'
}

if (-not [string]::IsNullOrWhiteSpace($SharedFolder)) {
    $argParts += "-SharedFolder $(Quote-Argument $SharedFolder)"
}

if (-not [string]::IsNullOrWhiteSpace($Token)) {
    $argParts += "-Token $(Quote-Argument $Token)"
}

$argumentList = $argParts -join ' '
$launcherProcess = Start-Process -FilePath 'powershell' -ArgumentList $argumentList -WorkingDirectory $root -PassThru

$healthHost = if ($HostName -eq '0.0.0.0' -or $HostName -eq '::' -or $HostName -eq '[::]') { 'localhost' } else { $HostName }
$healthUrl = "http://$healthHost`:$Port/health"

Write-Host "Launched collaboration server window (PID: $($launcherProcess.Id))." -ForegroundColor Green
Write-Host "Waiting for health endpoint: $healthUrl"

$deadline = (Get-Date).AddSeconds([Math]::Max(1, $HealthTimeoutSeconds))
$healthy = $false

while ((Get-Date) -lt $deadline) {
    try {
        $response = Invoke-RestMethod -Uri $healthUrl -Method Get -TimeoutSec 2
        if ($response -and $response.ok -eq $true) {
            $healthy = $true
            break
        }
    }
    catch {
        # Keep polling until timeout.
    }

    Start-Sleep -Seconds 1
}

if (-not $healthy) {
    Write-Warning "Server did not report healthy within $HealthTimeoutSeconds seconds."
    Write-Host 'The server may still be starting; keep the launched window open and retry the health URL shortly.' -ForegroundColor Yellow
    return
}

Write-Host "Collaboration server is healthy: $healthUrl" -ForegroundColor Green

if (-not $NoOpenBrowser) {
    Start-Process $healthUrl | Out-Null
    Write-Host 'Opened browser tab for health endpoint.'
}
