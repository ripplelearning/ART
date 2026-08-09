param(
    [int]$Port = 8787,
    [switch]$Force
)

$ErrorActionPreference = 'Stop'

Write-Host "Stopping ART Collaboration Server processes on port $Port..."

$connections = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
if (-not $connections) {
    Write-Host "No listening process found on port $Port."
    exit 0
}

$processIds = $connections | Select-Object -ExpandProperty OwningProcess -Unique

foreach ($pid in $processIds) {
    try {
        $process = Get-Process -Id $pid -ErrorAction Stop
        $isNode = $process.ProcessName -ieq 'node'

        if (-not $isNode -and -not $Force) {
            Write-Host "Skipping PID $pid ($($process.ProcessName)). Use -Force to stop non-node listeners."
            continue
        }

        Stop-Process -Id $pid -Force -ErrorAction Stop
        Write-Host "Stopped PID $pid ($($process.ProcessName))."
    } catch {
        Write-Host "Unable to stop PID $pid: $($_.Exception.Message)"
    }
}

Write-Host 'Stop operation complete.'
