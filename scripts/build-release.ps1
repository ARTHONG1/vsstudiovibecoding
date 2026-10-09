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
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
# Add entries one by one: Windows PowerShell's CreateFromDirectory stores
# backslashes, which macOS extracts as literal file names. Every entry sits
# under a top-level vibe-coding/ folder on both platforms.
$skillFull = (Resolve-Path -LiteralPath $SkillDir).Path.TrimEnd('\', '/')
$stream = [IO.File]::Open($zipPath, [IO.FileMode]::CreateNew)
try {
  $archive = New-Object IO.Compression.ZipArchive($stream, [IO.Compression.ZipArchiveMode]::Create)
  try {
    foreach ($file in (Get-ChildItem -LiteralPath $skillFull -File -Recurse | Sort-Object FullName)) {
      $relative = $file.FullName.Substring($skillFull.Length + 1).Replace('\', '/')
      [void][IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, $file.FullName, 'vibe-coding/' + $relative, [IO.Compression.CompressionLevel]::Optimal)
    }
  } finally { $archive.Dispose() }
} finally { $stream.Dispose() }

if (!(Test-Path -LiteralPath $zipPath)) {
  throw "Failed to create zip archive."
}

$check = [IO.Compression.ZipFile]::OpenRead($zipPath)
try {
  $names = @($check.Entries | ForEach-Object { $_.FullName })
  if (@($names | Where-Object { $_.Contains('\') }).Count) { throw 'Archive contains backslash entry names.' }
  foreach ($required in @('vibe-coding/SKILL.md', 'vibe-coding/scripts/setup.ps1', 'vibe-coding/scripts/setup-macos.sh', 'vibe-coding/scripts/setup-macos.cjs')) {
    if ($names -notcontains $required) { throw "Archive is missing $required" }
  }
  $reader = New-Object IO.StreamReader(($check.GetEntry('vibe-coding/scripts/setup-macos.sh')).Open())
  try { if ($reader.ReadToEnd().Contains([string][char]13)) { throw 'setup-macos.sh must use LF line endings.' } } finally { $reader.Dispose() }
} finally { $check.Dispose() }

$item = Get-Item -LiteralPath $zipPath
$hash = (Get-FileHash -LiteralPath $zipPath -Algorithm SHA256).Hash

Write-Host ""
Write-Host "[SUCCESS] Release package successfully built!" -ForegroundColor Green
Write-Host "  File: $zipName"
Write-Host "  Path: $zipPath"
Write-Host "  Size: $($item.Length) bytes"
Write-Host "  SHA256: $hash"
Write-Host ""
