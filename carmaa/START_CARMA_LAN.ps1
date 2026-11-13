$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$Backend = Join-Path $ProjectRoot 'backend'
$EnvFile = Join-Path $Backend '.env'
$FrontendRoot = Join-Path $ProjectRoot '_lan_frontend'
$FrontendPort = 8080

function Set-EnvValue([string]$Path, [string]$Name, [string]$Value) {
  $lines = [System.Collections.Generic.List[string]]::new()
  if (Test-Path $Path) { Get-Content $Path | ForEach-Object { $lines.Add($_) } }
  $pattern = '^' + [regex]::Escape($Name) + '=' 
  $found = $false
  for ($i = 0; $i -lt $lines.Count; $i++) {
    if ($lines[$i] -match $pattern) { $lines[$i] = "$Name=$Value"; $found = $true }
  }
  if (-not $found) { $lines.Add("$Name=$Value") }
  [System.IO.File]::WriteAllLines($Path, $lines, [System.Text.UTF8Encoding]::new($false))
}
function New-Secret { $b = New-Object byte[] 32; $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create(); try { $rng.GetBytes($b) } finally { $rng.Dispose() }; return ([BitConverter]::ToString($b) -replace '-', '').ToLowerInvariant() }

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) { throw 'Docker پیدا نشد. ابتدا Docker Desktop را نصب و اجرا کن.' }
if (-not (Get-Command python -ErrorAction SilentlyContinue) -and -not (Get-Command py -ErrorAction SilentlyContinue)) { throw 'Python پیدا نشد. Python 3 را نصب کن و گزینه Add Python to PATH را فعال کن.' }
if (-not (Test-Path (Join-Path $Backend 'docker-compose.yml'))) { throw 'پوشه backend یا docker-compose.yml پیدا نشد.' }
if (-not (Test-Path $EnvFile)) {
  Copy-Item (Join-Path $Backend '.env.example') $EnvFile
  Set-EnvValue $EnvFile 'POSTGRES_PASSWORD' (New-Secret)
  Set-EnvValue $EnvFile 'REDIS_PASSWORD' (New-Secret)
  Set-EnvValue $EnvFile 'OTP_PEPPER' (New-Secret)
  Set-EnvValue $EnvFile 'SESSION_PEPPER' (New-Secret)
}

# Prefer the interface used by the default IPv4 route.
$route = Get-NetRoute -DestinationPrefix '0.0.0.0/0' -ErrorAction SilentlyContinue | Sort-Object RouteMetric | Select-Object -First 1
$ip = $null
if ($route) { $ip = Get-NetIPAddress -AddressFamily IPv4 -InterfaceIndex $route.InterfaceIndex -ErrorAction SilentlyContinue | Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' } | Select-Object -ExpandProperty IPAddress -First 1 }
if (-not $ip) { $ip = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object { $_.IPAddress -like '192.168.*' -or $_.IPAddress -like '10.*' -or $_.IPAddress -like '172.16.*' -or $_.IPAddress -like '172.17.*' -or $_.IPAddress -like '172.18.*' -or $_.IPAddress -like '172.19.*' -or $_.IPAddress -like '172.2*.*' -or $_.IPAddress -like '172.30.*' -or $_.IPAddress -like '172.31.*' } | Select-Object -ExpandProperty IPAddress -First 1 }
if (-not $ip) { throw 'IP شبکه پیدا نشد. لپ‌تاپ را به Wi-Fi وصل کن و دوباره اجرا کن.' }

# Update only local testing URLs; secrets are generated once and preserved on later runs.
Set-EnvValue $EnvFile 'CARMA_LAN_IP' $ip
Set-EnvValue $EnvFile 'PUBLIC_BASE_URL' "http://${ip}:3000"
Set-EnvValue $EnvFile 'FRONTEND_URL' "http://${ip}:8080"
Set-EnvValue $EnvFile 'ALLOWED_ORIGINS' "http://${ip}:8080,http://localhost:8080,http://127.0.0.1:8080"
Set-EnvValue $EnvFile 'PAYMENT_CALLBACK_BASE_URL' "http://${ip}:3000/api/v1/payments/zarinpal/callback"
Set-EnvValue $EnvFile 'MEDIA_PUBLIC_BASE_URL' "http://${ip}:3000/media"
Set-EnvValue $EnvFile 'NODE_ENV' 'development'
Set-EnvValue $EnvFile 'PAYMENT_SANDBOX' 'true'

Write-Host "Laptop LAN IP: $ip" -ForegroundColor Cyan
Write-Host 'Starting API, PostgreSQL and Redis with Docker Compose...' -ForegroundColor Cyan
Push-Location $Backend
try {
  docker compose config | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'docker compose config ناموفق بود؛ فایل backend/.env را بررسی کن.' }
  docker compose up --build -d
  if ($LASTEXITCODE -ne 0) { throw 'اجرای Docker Compose ناموفق بود؛ از docker compose logs کمک بگیر.' }
  docker compose exec -T api node src/migrate.js
  if ($LASTEXITCODE -ne 0) { throw 'Migration ناموفق بود؛ لاگ API را بررسی کن.' }
} finally { Pop-Location }

# Build a frontend-only copy so backend/.env and server source are never served by Python.
if (Test-Path $FrontendRoot) { Remove-Item $FrontendRoot -Recurse -Force }
New-Item -ItemType Directory -Path $FrontendRoot | Out-Null
$excludeDirs = @('backend','security','.git','node_modules','_lan_frontend')
Get-ChildItem $ProjectRoot -Force | Where-Object { $excludeDirs -notcontains $_.Name -and $_.Name -notin @('START_CARMA_LAN.ps1','ENABLE_CARMA_FIREWALL.ps1','STOP_CARMA_LAN.ps1','README_LAN_TEST_FA.md') } | ForEach-Object {
  Copy-Item $_.FullName $FrontendRoot -Recurse -Force
}
$indexPath = Join-Path $FrontendRoot 'index.html'
if (-not (Test-Path $indexPath)) { throw 'index.html در ریشه پروژه پیدا نشد.' }
$html = [System.IO.File]::ReadAllText($indexPath)
$apiScript = '<script src="js/00-api-client.js?v=2-social-stories-stats"></script>'
if (-not $html.Contains($apiScript)) { throw 'تگ API client در index.html پیدا نشد؛ فایل فرانت‌اند به‌روزرسانی شده است.' }
$configScript = "<script>window.CARMA_API_BASE='http://${ip}:3000/api/v1';</script>`r`n    " + $apiScript
$html = $html.Replace($apiScript, $configScript)
[System.IO.File]::WriteAllText($indexPath, $html, [System.Text.UTF8Encoding]::new($false))

# Start static frontend server and save its PID for the stop script.
$pythonExe = if (Get-Command python -ErrorAction SilentlyContinue) { (Get-Command python).Source } else { (Get-Command py).Source }
$pythonArgs = if ((Split-Path $pythonExe -Leaf) -eq 'py.exe') { @('-3','-m','http.server',"$FrontendPort",'--bind','0.0.0.0') } else { @('-m','http.server',"$FrontendPort",'--bind','0.0.0.0') }
$stdout = Join-Path $ProjectRoot 'carmaa-frontend.log'
$stderr = Join-Path $ProjectRoot 'carmaa-frontend-error.log'
$p = Start-Process -FilePath $pythonExe -ArgumentList $pythonArgs -WorkingDirectory $FrontendRoot -RedirectStandardOutput $stdout -RedirectStandardError $stderr -PassThru
Set-Content (Join-Path $ProjectRoot '.carmaa-frontend.pid') $p.Id

Write-Host ''
Write-Host 'CarMaa LAN test services started.' -ForegroundColor Green
Write-Host "Website: http://${ip}:8080" -ForegroundColor Green
Write-Host "API health: http://${ip}:3000/health/ready" -ForegroundColor Green
Write-Host 'API and frontend are reachable only on the laptop LAN IP, subject to Windows Firewall.'
Write-Host 'If the phone cannot connect, run ENABLE_CARMA_FIREWALL.ps1 as Administrator on a trusted Private Wi-Fi.'
Write-Host 'SMS login requires your own valid Kavenegar key in backend/.env. Do not share that file.'
Write-Host 'To stop, run STOP_CARMA_LAN.ps1.'
