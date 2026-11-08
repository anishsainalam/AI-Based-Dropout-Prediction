$ErrorActionPreference = 'Stop'
$continuumRoot = Split-Path -Parent $PSScriptRoot
$continuumPidFile = Join-Path $continuumRoot 'logs/server.pid'
if (-not (Test-Path -LiteralPath $continuumPidFile)) { Write-Host 'No saved Continuum server process.'; exit }
$continuumPid = [int](Get-Content -LiteralPath $continuumPidFile)
$continuumProcess = Get-CimInstance Win32_Process -Filter "ProcessId = $continuumPid"
if ($continuumProcess -and $continuumProcess.CommandLine -like "*$continuumRoot*uvicorn*app.main:app*") {
    $continuumChildren = Get-CimInstance Win32_Process -Filter "ParentProcessId = $continuumPid"
    foreach ($continuumChild in $continuumChildren) {
        if ($continuumChild.CommandLine -like '*uvicorn*app.main:app*') { Stop-Process -Id $continuumChild.ProcessId -ErrorAction SilentlyContinue }
    }
    Stop-Process -Id $continuumPid -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $continuumPidFile
    Write-Host 'Continuum stopped.'
} else { Write-Host 'Saved process is no longer this workspace server. No processes were stopped.' }
