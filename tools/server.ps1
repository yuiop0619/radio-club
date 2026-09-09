param([int]$Port = 8080)
$env:PORT = [string]$Port
& node (Join-Path $PSScriptRoot 'server.cjs')
exit $LASTEXITCODE
