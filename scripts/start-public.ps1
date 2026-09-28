# Clear Money - production-ish LAN host (0.0.0.0) for phones / other devices.
# Usage: pnpm start:public

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

function Get-LanIPv4 {
  $addrs = @(Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object {
      $_.IPAddress -notlike '127.*' -and
      $_.IPAddress -notlike '169.254.*' -and
      $_.PrefixOrigin -ne 'WellKnown'
    } |
    Sort-Object {
      if ($_.IPAddress -like '192.168.*') { 0 }
      elseif ($_.IPAddress -like '10.*') { 1 }
      elseif ($_.IPAddress -like '172.1[6-9].*' -or $_.IPAddress -like '172.2*.*' -or $_.IPAddress -like '172.3[0-1].*') { 2 }
      else { 9 }
    }, IPAddress)
  if ($addrs.Count -eq 0) { throw 'No LAN IPv4 address found.' }
  return $addrs[0].IPAddress
}

function Stop-PortListeners([int[]]$Ports) {
  foreach ($port in $Ports) {
    $conns = @(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue)
    foreach ($c in $conns) {
      $procId = $c.OwningProcess
      if ($procId -and $procId -ne 0) {
        Write-Host "Stopping PID $procId on port $port"
        Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
      }
    }
  }
}

function Set-EnvKey([string]$Path, [string]$Key, [string]$Value) {
  if (-not (Test-Path $Path)) {
    New-Item -ItemType File -Path $Path -Force | Out-Null
  }
  $lines = @(Get-Content $Path -ErrorAction SilentlyContinue)
  $found = $false
  $out = foreach ($line in $lines) {
    if ($line -match ("^\s*" + [regex]::Escape($Key) + "\s*=")) {
      $found = $true
      "$Key=$Value"
    } else {
      $line
    }
  }
  if (-not $found) { $out += "$Key=$Value" }
  $ok = $false
  for ($i = 0; $i -lt 8; $i++) {
    try {
      Set-Content -Path $Path -Value $out -Encoding utf8 -ErrorAction Stop
      $ok = $true
      break
    } catch {
      Start-Sleep -Milliseconds (200 * ($i + 1))
    }
  }
  if (-not $ok) {
    Write-Host "Warning: could not update $Key in $Path (file locked); continuing with existing value."
  }
}

$LanIp = if ($env:CM_LAN_IP) { $env:CM_LAN_IP } else { Get-LanIPv4 }
$WebUrl = "http://${LanIp}:8259"
$ApiUrl = "http://${LanIp}:3011"

Write-Host ""
Write-Host "Clear Money public host"
Write-Host "  LAN IP : $LanIp"
Write-Host "  Web    : $WebUrl"
Write-Host "  API    : $ApiUrl"
Write-Host ""

Write-Host "Stopping old listeners on 8259 / 3011..."
Stop-PortListeners @(8259, 3011)
Start-Sleep -Seconds 1

Write-Host "Starting Postgres + Minio (compose)..."
docker compose up -d

$rootEnv = Join-Path $Root '.env'
$webEnv = Join-Path $Root 'apps\web\.env.local'

Set-EnvKey $rootEnv 'WEB_URL' $WebUrl
Set-EnvKey $rootEnv 'BETTER_AUTH_URL' $WebUrl
Set-EnvKey $rootEnv 'API_PORT' '3011'
Set-EnvKey $rootEnv 'API_HOST' '0.0.0.0'
Set-EnvKey $rootEnv 'EXTRA_WEB_ORIGINS' $WebUrl
Set-EnvKey $rootEnv 'APP_ENV' 'production'

Set-EnvKey $webEnv 'NEXT_PUBLIC_API_URL' '/cm-api'
Set-EnvKey $webEnv 'API_INTERNAL_URL' 'http://127.0.0.1:3011'
Set-EnvKey $webEnv 'NEXT_PUBLIC_BETA_FREE_MODE' 'true'
Set-EnvKey $webEnv 'NEXT_PUBLIC_PLAN_PLUS_ENABLED' 'true'

Write-Host "Ensuring DB schema + seed..."
$env:DATABASE_URL = 'postgresql://clearmoney:clearmoney@localhost:5433/clearmoney'
pnpm db:migrate
if ($LASTEXITCODE -ne 0) { throw 'db:migrate failed' }
pnpm db:seed
if ($LASTEXITCODE -ne 0) { throw 'db:seed failed' }

Write-Host "Building API + web (production)..."
pnpm --filter @clear-money/domain build
pnpm --filter @clear-money/db build
pnpm --filter @clear-money/api build
pnpm --filter @clear-money/web build

$logs = Join-Path $Root '.lan-logs'
New-Item -ItemType Directory -Force -Path $logs | Out-Null
$apiLog = Join-Path $logs 'api.log'
$webLog = Join-Path $logs 'web.log'

Write-Host "Starting API on 0.0.0.0:3011..."
$apiProc = Start-Process -FilePath 'cmd.exe' `
  -ArgumentList '/c','pnpm --filter @clear-money/api start > .lan-logs\api.log 2>&1' `
  -WorkingDirectory $Root -PassThru -WindowStyle Hidden

Write-Host "Starting web on 0.0.0.0:8259..."
$webProc = Start-Process -FilePath 'cmd.exe' `
  -ArgumentList '/c','pnpm --filter @clear-money/web start > .lan-logs\web.log 2>&1' `
  -WorkingDirectory $Root -PassThru -WindowStyle Hidden

Write-Host ""
Write-Host "Ready - open on this PC or phone (same Wi-Fi):"
Write-Host "  $WebUrl"
Write-Host ""
Write-Host "Logs: $logs"
Write-Host "Press Ctrl+C to stop."
Write-Host ""

try {
  while ($true) {
    if ($apiProc.HasExited -or $webProc.HasExited) {
      Write-Host 'A service exited - last log lines:'
      if (Test-Path $apiLog) { Get-Content $apiLog -Tail 20 }
      if (Test-Path $webLog) { Get-Content $webLog -Tail 20 }
      break
    }
    Start-Sleep -Seconds 3
  }
} finally {
  Write-Host 'Shutting down...'
  if (-not $apiProc.HasExited) { Stop-Process -Id $apiProc.Id -Force -ErrorAction SilentlyContinue }
  if (-not $webProc.HasExited) { Stop-Process -Id $webProc.Id -Force -ErrorAction SilentlyContinue }
  Stop-PortListeners @(8259, 3011)
}
