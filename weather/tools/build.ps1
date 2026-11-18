$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Push-Location $projectRoot
try {
    node tools/build.js
    if ($LASTEXITCODE -ne 0) { throw 'HTML build failed' }
    Write-Output 'Build complete. Double-click 启动本地天气.cmd to start v2.'
} finally { Pop-Location }
