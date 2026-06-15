param(
  [string]$OutputDir = "dist"
)

$ErrorActionPreference = "Stop"

$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$Out = Join-Path $Root $OutputDir
New-Item -ItemType Directory -Force -Path $Out | Out-Null

function Set-EditionEnv {
  param([string]$Edition)

  $script:PreviousEdition = $env:VITE_EDITION
  $env:VITE_EDITION = $Edition
}

function Restore-EditionEnv {
  if ($null -eq $script:PreviousEdition) {
    Remove-Item Env:VITE_EDITION -ErrorAction SilentlyContinue
  } else {
    $env:VITE_EDITION = $script:PreviousEdition
  }
}

function Invoke-Native {
  param(
    [string]$FilePath,
    [string[]]$Arguments = @()
  )

  & $FilePath @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "$FilePath failed with exit code $LASTEXITCODE"
  }
}

function Build-Web {
  param([string]$Edition)

  Write-Host "Building $Edition frontend..."
  Set-EditionEnv $Edition
  $webOutput = Join-Path (Join-Path $Root "web") "dist-$Edition"
  New-Item -ItemType Directory -Force -Path $webOutput | Out-Null
  Get-ChildItem -LiteralPath $webOutput -Force | Where-Object { $_.Name -ne "placeholder.txt" } | ForEach-Object {
    Remove-Item -LiteralPath $_.FullName -Recurse -Force
  }
  Push-Location (Join-Path $Root "web")
  try {
    Invoke-Native "yarn.cmd" @("build")
  } finally {
    Pop-Location
    Restore-EditionEnv
  }
}

function Build-Go {
  param(
    [string]$BinaryName,
    [string[]]$Tags = @()
  )

  $goArgs = @("build", "-o", (Join-Path $Out $BinaryName))
  if ($Tags.Count -gt 0) {
    $goArgs += @("-tags", ($Tags -join ","))
  }
  $goArgs += "."

  Write-Host "Building $BinaryName..."
  Push-Location $Root
  try {
    Invoke-Native "go" $goArgs
  } finally {
    Pop-Location
  }
}

Build-Web "community"
Build-Go "flai-community.exe"

Build-Web "premium"
Build-Go "flai-premium.exe" @("premium")

Write-Host "Done. Binaries are in $Out"
