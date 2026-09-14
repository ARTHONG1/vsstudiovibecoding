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
  if (!(Test-Path -LiteralPath $InstalledDir -PathType Container)) { return $false }
  foreach ($file in Get-ChildItem -LiteralPath $SourceDir -File -Recurse) {
    $relative = $file.FullName.Substring($SourceDir.TrimEnd('\').Length).TrimStart('\')
    $target = Join-Path $InstalledDir $relative
    if (!(Test-Path -LiteralPath $target -PathType Leaf)) { return $false }
    if ($relative -eq 'package.json') {
      try {
        $expected = [IO.File]::ReadAllText($file.FullName) | ConvertFrom-Json
        $actual = [IO.File]::ReadAllText($target) | ConvertFrom-Json
        $expected.PSObject.Properties.Remove('__metadata')
        $actual.PSObject.Properties.Remove('__metadata')
        if (($expected | ConvertTo-Json -Depth 100 -Compress) -cne ($actual | ConvertTo-Json -Depth 100 -Compress)) { return $false }
      } catch { return $false }
    } elseif ((Get-VibeContentHash $file.FullName) -ne (Get-VibeContentHash $target)) { return $false }
  }
  return $true
}
