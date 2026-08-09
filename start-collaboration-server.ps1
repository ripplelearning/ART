param(
    [string]$HostName = '0.0.0.0',
    [int]$Port = 8787,
    [string]$WebSocketPath = '/art-live',
    [string]$SharedFolder = '',
    [string]$Token = '',
    [switch]$SkipInstall
)

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$serverDir = Join-Path $root 'collaboration-server'

if (-not (Test-Path $serverDir)) {
    throw "Missing collaboration server directory: $serverDir"
}

function Require-Command([string]$name) {
    $cmd = Get-Command $name -ErrorAction SilentlyContinue
    if (-not $cmd) {
        throw "Required command '$name' is not available. Install Node.js (includes npm), then retry."
    }
}

Require-Command 'node'
Require-Command 'npm'

Push-Location $serverDir
try {
    if (-not $SkipInstall -and -not (Test-Path (Join-Path $serverDir 'node_modules'))) {
        Write-Host 'Installing collaboration server dependencies...' -ForegroundColor Yellow
        npm install
    }

    $env:ART_COLLAB_HOST = $HostName
    $env:ART_COLLAB_PORT = [string]$Port
    $env:ART_COLLAB_WS_PATH = $WebSocketPath

    if ([string]::IsNullOrWhiteSpace($SharedFolder)) {
        Remove-Item Env:ART_COLLAB_SHARED_FOLDER -ErrorAction SilentlyContinue
    } else {
        $env:ART_COLLAB_SHARED_FOLDER = $SharedFolder
    }

    if ([string]::IsNullOrWhiteSpace($Token)) {
        Remove-Item Env:ART_COLLAB_TOKEN -ErrorAction SilentlyContinue
    } else {
        $env:ART_COLLAB_TOKEN = $Token
    }

    $sharedModeLabel = if ([string]::IsNullOrWhiteSpace($SharedFolder)) { 'disabled' } else { $SharedFolder }
    $tokenModeLabel = if ([string]::IsNullOrWhiteSpace($Token)) { 'no' } else { 'yes' }

    Write-Host 'Starting ART Collaboration Server...' -ForegroundColor Green
    Write-Host "  Host: $HostName"
    Write-Host "  Port: $Port"
    Write-Host "  WebSocket path: $WebSocketPath"
    Write-Host "  Shared-folder mode: $sharedModeLabel"
    Write-Host "  Token required: $tokenModeLabel"

    npm start
}
finally {
    Pop-Location
}
