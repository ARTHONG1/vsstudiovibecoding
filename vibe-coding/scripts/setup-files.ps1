function Get-VibeContentHash([string]$Path) {
  $stream = [IO.File]::OpenRead($Path)
  $sha = [Security.Cryptography.SHA256]::Create()
  try { return [BitConverter]::ToString($sha.ComputeHash($stream)).Replace('-','') }
  finally { $sha.Dispose(); $stream.Dispose() }
}
function Backup-VibeFile([string]$Path, [string]$Directory) {
  if (!(Test-Path -LiteralPath $Path -PathType Leaf)) { return }
  $sha = [Security.Cryptography.SHA256]::Create()
  try { $id = [BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes([IO.Path]::GetFullPath($Path).ToLowerInvariant()))).Replace('-','') }
  finally { $sha.Dispose() }
  $target = Join-Path $Directory ($id + '-' + [IO.Path]::GetFileName($Path))
  if (!(Test-Path -LiteralPath $target)) { Copy-Item -LiteralPath $Path -Destination $target -ErrorAction Stop }
  return $target
}

function Test-VibeExtensionContent([string]$SourceDir, [string]$InstalledDir) {
  if (!(Test-Path -LiteralPath $SourceDir -PathType Container)) { return $false }
  if (!(Test-Path -LiteralPath $InstalledDir -PathType Container)) { return $false }
  $sourceCanonical = (Get-Item -LiteralPath $SourceDir).FullName.TrimEnd('\', '/')
  $installedCanonical = (Get-Item -LiteralPath $InstalledDir).FullName.TrimEnd('\', '/')
  $sourceUri = New-Object Uri ($sourceCanonical + '/')
  foreach ($file in Get-ChildItem -LiteralPath $sourceCanonical -File -Recurse) {
    $fileCanonical = (Get-Item -LiteralPath $file.FullName).FullName
    $fileUri = New-Object Uri $fileCanonical
    $relative = [Uri]::UnescapeDataString($sourceUri.MakeRelativeUri($fileUri).ToString()).Replace('/', '\')
    $target = Join-Path $installedCanonical $relative
    if (!(Test-Path -LiteralPath $target -PathType Leaf)) { return $false }
    if ($relative -eq 'package.json') {
      try {
        $expected = [IO.File]::ReadAllText($fileCanonical) | ConvertFrom-Json
        $actual = [IO.File]::ReadAllText($target) | ConvertFrom-Json
        if ($expected.PSObject.Properties['__metadata']) { $expected.PSObject.Properties.Remove('__metadata') }
        if ($actual.PSObject.Properties['__metadata']) { $actual.PSObject.Properties.Remove('__metadata') }
        $expectedProps = @($expected.PSObject.Properties | Select-Object -ExpandProperty Name | Sort-Object)
        $actualProps = @($actual.PSObject.Properties | Select-Object -ExpandProperty Name | Sort-Object)
        if (($expectedProps -join ',') -ne ($actualProps -join ',')) { return $false }
        foreach ($prop in $expectedProps) {
          $expVal = $expected.$prop | ConvertTo-Json -Depth 100 -Compress
          $actVal = $actual.$prop | ConvertTo-Json -Depth 100 -Compress
          if ($expVal -ne $actVal) { return $false }
        }
      } catch { return $false }
    } elseif ((Get-VibeContentHash $fileCanonical) -ne (Get-VibeContentHash $target)) { return $false }
  }
  return $true
}
