param(
  [string]$OutputDir = "community"
)

$ErrorActionPreference = "Stop"

$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$OutputFullPath = [System.IO.Path]::GetFullPath((Join-Path $Root $OutputDir))
$RootWithSeparator = $Root.TrimEnd([System.IO.Path]::DirectorySeparatorChar, [System.IO.Path]::AltDirectorySeparatorChar) + [System.IO.Path]::DirectorySeparatorChar
$OutputWithSeparator = $OutputFullPath.TrimEnd([System.IO.Path]::DirectorySeparatorChar, [System.IO.Path]::AltDirectorySeparatorChar) + [System.IO.Path]::DirectorySeparatorChar

if (-not $OutputFullPath.StartsWith($RootWithSeparator, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "OutputDir must stay inside the repository: $OutputFullPath"
}
if ($OutputFullPath.TrimEnd([System.IO.Path]::DirectorySeparatorChar, [System.IO.Path]::AltDirectorySeparatorChar) -eq $Root.TrimEnd([System.IO.Path]::DirectorySeparatorChar, [System.IO.Path]::AltDirectorySeparatorChar)) {
  throw "OutputDir cannot be the repository root"
}

function Get-RelativePath {
  param([string]$Path)

  $fullPath = [System.IO.Path]::GetFullPath($Path)
  if ($fullPath.Equals($Root, [System.StringComparison]::OrdinalIgnoreCase)) {
    return "."
  }
  if (-not $fullPath.StartsWith($RootWithSeparator, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Path is outside the repository: $fullPath"
  }
  return $fullPath.Substring($RootWithSeparator.Length).Replace("\", "/")
}

function Should-SkipPath {
  param([string]$RelativePath)

  if ($RelativePath -eq "web/dist-community/placeholder.txt") {
    return $false
  }

  $blockedPrefixes = @(
    ".git/",
    ".claude/",
    "dist/",
    "web/.yarn/",
    "web/dist/",
    "web/dist-community/",
    "web/dist-premium/",
    "web/node_modules/"
  )
  foreach ($prefix in $blockedPrefixes) {
    if ($RelativePath.StartsWith($prefix, [System.StringComparison]::OrdinalIgnoreCase)) {
      return $true
    }
  }

  $fileName = [System.IO.Path]::GetFileName($RelativePath)
  if ($fileName -in @(".env", "flai.db", "flai.exe", "flai.exe~")) {
    return $true
  }
  if ($fileName.EndsWith(".log", [System.StringComparison]::OrdinalIgnoreCase)) {
    return $true
  }
  if ($fileName.EndsWith(".exe", [System.StringComparison]::OrdinalIgnoreCase)) {
    return $true
  }
  return $false
}

function Is-PremiumFile {
  param([string]$Path)

  $extension = [System.IO.Path]::GetExtension($Path).ToLowerInvariant()
  if ($extension -notin @(".go", ".ts", ".tsx", ".js", ".jsx")) {
    return $false
  }

  $header = Get-Content -LiteralPath $Path -TotalCount 12 -ErrorAction Stop
  foreach ($line in $header) {
    if ($line -match '^\s*//go:build\s+premium(\s|$)') {
      return $true
    }
    if ($line -match '^\s*//\s*@edition\s+premium(\s|$)') {
      return $true
    }
  }
  return $false
}

New-Item -ItemType Directory -Force -Path $OutputFullPath | Out-Null

Get-ChildItem -LiteralPath $OutputFullPath -Force | Where-Object { $_.Name -ne ".git" } | ForEach-Object {
  Remove-Item -LiteralPath $_.FullName -Recurse -Force
}

$copied = 0
$skippedPremium = 0

Get-ChildItem -LiteralPath $Root -Recurse -File -Force | ForEach-Object {
  if ($_.FullName.StartsWith($OutputWithSeparator, [System.StringComparison]::OrdinalIgnoreCase)) {
    return
  }
  $relativePath = Get-RelativePath $_.FullName
  if (Should-SkipPath $relativePath) {
    return
  }
  if (Is-PremiumFile $_.FullName) {
    $skippedPremium++
    return
  }

  $targetPath = Join-Path $OutputFullPath $relativePath
  $targetDir = Split-Path -Parent $targetPath
  New-Item -ItemType Directory -Force -Path $targetDir | Out-Null
  Copy-Item -LiteralPath $_.FullName -Destination $targetPath -Force
  $copied++
}

$leaks = Get-ChildItem -LiteralPath $OutputFullPath -Recurse -File -Force |
  Select-String -Pattern '^\s*//go:build\s+premium(\s|$)', '^\s*//\s*@edition\s+premium(\s|$)' -List
if ($leaks) {
  $paths = $leaks | ForEach-Object { Get-RelativePath $_.Path }
  throw "Premium markers remain in community export: $($paths -join ', ')"
}

Write-Host "Community source synced to $OutputFullPath"
Write-Host "Copied files: $copied"
Write-Host "Skipped premium files: $skippedPremium"
