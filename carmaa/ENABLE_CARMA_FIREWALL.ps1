$ErrorActionPreference = 'Stop'
$principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) { throw 'روی فایل راست‌کلیک کن و Run with PowerShell را با دسترسی Administrator اجرا کن.' }
$profile = Get-NetConnectionProfile | Where-Object { $_.IPv4Connectivity -ne 'Disconnected' } | Select-Object -First 1
if (-not $profile -or $profile.NetworkCategory -ne 'Private') { throw 'ابتدا شبکه Wi-Fi ویندوز را روی Private بگذار؛ روی شبکه عمومی این Rule را نساز.' }
Get-NetFirewallRule -DisplayName 'CarMaa LAN Frontend (Private)' -ErrorAction SilentlyContinue | Remove-NetFirewallRule
Get-NetFirewallRule -DisplayName 'CarMaa LAN API (Private)' -ErrorAction SilentlyContinue | Remove-NetFirewallRule
New-NetFirewallRule -DisplayName 'CarMaa LAN Frontend (Private)' -Direction Inbound -Action Allow -Protocol TCP -LocalPort 8080 -RemoteAddress LocalSubnet -Profile Private | Out-Null
New-NetFirewallRule -DisplayName 'CarMaa LAN API (Private)' -Direction Inbound -Action Allow -Protocol TCP -LocalPort 3000 -RemoteAddress LocalSubnet -Profile Private | Out-Null
Write-Host 'Firewall rules enabled for local subnet on Private networks only.' -ForegroundColor Green
