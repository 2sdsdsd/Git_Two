$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$oldExecutable = Join-Path $projectRoot '天气查询系统.exe'
foreach ($oldProcess in @(Get-Process | Where-Object { $_.Path -eq $oldExecutable })) {
    Stop-Process -Id $oldProcess.Id
    $oldProcess.WaitForExit()
}
if (Test-Path -LiteralPath $oldExecutable) { Move-Item -LiteralPath $oldExecutable -Destination (Join-Path $projectRoot 'versions\天气查询系统_第一版.exe') -Force }
$weatherProcess = Start-Process -FilePath (Join-Path $projectRoot 'tools\runtime\node.exe') -ArgumentList @((Join-Path $projectRoot 'server\server.cjs'),'--no-browser','--port','8787') -WorkingDirectory $projectRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $projectRoot '.runtime\weather.stdout.log') -RedirectStandardError (Join-Path $projectRoot '.runtime\weather.stderr.log') -PassThru
@{weatherPid=$weatherProcess.Id;version='2.0.0'} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $projectRoot '.runtime\v2-service.json') -Encoding UTF8
Write-Output "Weather process: $($weatherProcess.Id)"

