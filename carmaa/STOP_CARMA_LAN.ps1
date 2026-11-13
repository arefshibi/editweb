$ErrorActionPreference = 'Continue'
$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$pidFile = Join-Path $ProjectRoot '.carmaa-frontend.pid'
if (Test-Path $pidFile) {
  $serverPid = Get-Content $pidFile -ErrorAction SilentlyContinue
  if ($serverPid) { Stop-Process -Id ([int]$serverPid) -Force -ErrorAction SilentlyContinue }
  Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
}
Push-Location (Join-Path $ProjectRoot 'backend')
docker compose down
Pop-Location
Write-Host 'CarMaa LAN test services stopped. Database volumes were preserved.' -ForegroundColor Green
