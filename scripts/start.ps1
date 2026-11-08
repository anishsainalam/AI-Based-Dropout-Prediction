param([switch]$SkipBuild, [switch]$NoBrowser)
$ErrorActionPreference = 'Stop'
$continuumRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $continuumRoot
function Save-ContinuumPid {
    $continuumListener = Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($continuumListener) {
        $continuumActual = Get-CimInstance Win32_Process -Filter "ProcessId = $($continuumListener.OwningProcess)"
        if ($continuumActual.CommandLine -like "*$continuumRoot*uvicorn*app.main:app*") {
            New-Item -ItemType Directory -Force logs | Out-Null
            $continuumActual.ProcessId | Set-Content -LiteralPath 'logs/server.pid'
        }
    }
}
if (Test-Path -LiteralPath '.env') {
    foreach ($continuumLine in Get-Content -LiteralPath '.env') {
        if ($continuumLine -match '^\s*([A-Z_][A-Z0-9_]*)\s*=(.*)$') {
            [Environment]::SetEnvironmentVariable($matches[1], $matches[2].Trim().Trim('"').Trim("'"), 'Process')
        }
    }
}
try {
    $continuumHealth = Invoke-RestMethod 'http://127.0.0.1:8000/api/health' -TimeoutSec 2
    if ($continuumHealth.service -eq 'continuum') {
        Save-ContinuumPid
        Write-Host 'Continuum is already running at http://127.0.0.1:8000' -ForegroundColor Green
        if (-not $NoBrowser) { Start-Process 'http://127.0.0.1:8000' }
        exit 0
    }
} catch { }
if (-not (Test-Path -LiteralPath '.venv/Scripts/python.exe')) {
    python -m venv .venv
    if ($LASTEXITCODE -ne 0) { throw 'Python 3.11–3.13 is required.' }
    & '.venv/Scripts/python.exe' -m pip install -r backend/requirements-lock.txt
    if ($LASTEXITCODE -ne 0) { throw 'Python dependency installation failed.' }
}
if (-not $SkipBuild -or -not (Test-Path -LiteralPath 'frontend/dist/index.html')) {
    Push-Location frontend
    try {
        if (-not (Test-Path -LiteralPath 'node_modules')) {
            npm.cmd ci
            if ($LASTEXITCODE -ne 0) { throw 'Frontend dependency installation failed.' }
        }
        npm.cmd run build
        if ($LASTEXITCODE -ne 0) { throw 'Frontend build failed.' }
    } finally { Pop-Location }
}
New-Item -ItemType Directory -Force logs | Out-Null
$continuumPython = (Resolve-Path -LiteralPath '.venv/Scripts/python.exe').Path
$continuumServer = Start-Process -FilePath $continuumPython -ArgumentList '-m','uvicorn','app.main:app','--app-dir','backend','--host','127.0.0.1','--port','8000' -WorkingDirectory $continuumRoot -WindowStyle Hidden -RedirectStandardOutput 'logs/server.log' -RedirectStandardError 'logs/server-error.log' -PassThru
$continuumServer.Id | Set-Content -LiteralPath 'logs/server.pid'
for ($continuumTry=0; $continuumTry -lt 90; $continuumTry++) {
    try {
        $continuumHealth = Invoke-RestMethod 'http://127.0.0.1:8000/api/health' -TimeoutSec 2
        if ($continuumHealth.service -eq 'continuum') {
            Save-ContinuumPid
            Write-Host 'Continuum is ready at http://127.0.0.1:8000' -ForegroundColor Green
            if (-not $NoBrowser) { Start-Process 'http://127.0.0.1:8000' }
            exit 0
        }
    } catch { }
    Start-Sleep -Seconds 1
}
throw 'Startup took too long. Check logs/server-error.log.'
