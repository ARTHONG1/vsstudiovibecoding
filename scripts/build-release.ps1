[CmdletBinding()]
param(
  [string]$OutputDir
)

$ErrorActionPreference = 'Stop'
$ScriptDir = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
$RepoRoot = Split-Path -Parent $ScriptDir
if (!$OutputDir) { $OutputDir = Join-Path $RepoRoot 'dist' }
$SkillDir = Join-Path $RepoRoot 'vibe-coding'
$PkgPath = Join-Path $RepoRoot 'package.json'

if (!(Test-Path -LiteralPath $SkillDir)) {
  throw "Skill directory not found: $SkillDir"
}

if (!(Test-Path -LiteralPath $PkgPath)) {
  throw "package.json not found: $PkgPath"
}

$pkg = Get-Content -Raw -Encoding UTF8 -LiteralPath $PkgPath | ConvertFrom-Json
$version = $pkg.version

if (!$version) {
  throw "Could not determine version from package.json"
}

$OutputDir = [IO.Path]::GetFullPath($OutputDir)
if (!(Test-Path -LiteralPath $OutputDir)) {
  New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
}

$zipName = "vibe-coding-$version.zip"
$zipPath = Join-Path $OutputDir $zipName

if (Test-Path -LiteralPath $zipPath) {
  Remove-Item -LiteralPath $zipPath -Force
}

Write-Host "Creating release archive: $zipPath..." -ForegroundColor Cyan
Add-Type -AssemblyName System.IO.Compression.FileSystem
[IO.Compression.ZipFile]::CreateFromDirectory($SkillDir, $zipPath)

if (!(Test-Path -LiteralPath $zipPath)) {
  throw "Failed to create zip archive."
}

$item = Get-Item -LiteralPath $zipPath
$hash = (Get-FileHash -LiteralPath $zipPath -Algorithm SHA256).Hash

Write-Host ""
Write-Host "[SUCCESS] Release package successfully built!" -ForegroundColor Green
Write-Host "  File: $zipName"
Write-Host "  Path: $zipPath"
Write-Host "  Size: $($item.Length) bytes"
Write-Host "  SHA256: $hash"
Write-Host ""
