# Run EAS CLI with caches on D: (avoids ENOSPC on nearly-full C:)
$ErrorActionPreference = 'Stop'

$cacheRoot = 'D:\dev-cache'
@(
  "$cacheRoot\npm",
  "$cacheRoot\temp",
  "$cacheRoot\npm-global",
  "$cacheRoot\.expo"
) | ForEach-Object { New-Item -ItemType Directory -Path $_ -Force | Out-Null }

$env:TEMP = "$cacheRoot\temp"
$env:TMP = "$cacheRoot\temp"
$env:NPM_CONFIG_CACHE = "$cacheRoot\npm"
$env:npm_config_cache = "$cacheRoot\npm"
$env:EXPO_HOME = "$cacheRoot\.expo"

$easBin = Join-Path $cacheRoot 'npm-global\eas.cmd'
if (-not (Test-Path $easBin)) {
  Write-Host 'Installing eas-cli onto D: ...'
  npm install -g eas-cli --prefix (Join-Path $cacheRoot 'npm-global')
}

$env:Path = "$(Join-Path $cacheRoot 'npm-global');$(Join-Path $cacheRoot 'npm-global\node_modules\.bin');$env:Path"

Set-Location $PSScriptRoot
if ($args.Count -eq 0) {
  & eas --version
  Write-Host ''
  Write-Host 'Examples:'
  Write-Host '  .\eas-on-d.ps1 login'
  Write-Host '  .\eas-on-d.ps1 init'
  Write-Host '  .\eas-on-d.ps1 build --platform android --profile apk'
} else {
  & eas @args
}
