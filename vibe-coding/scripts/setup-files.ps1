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

# VS Code writes languagepacks.json only after its window starts, when the
# display language has already been chosen, so a new profile opened in English
# once. Write the same file (format and hash as in VS Code's LanguagePacksCache)
# right after the CLI installs the Korean language pack.
function Write-VibeLanguagePacks([string]$UserDir, [string]$ExtensionsDir) {
  $registryPath = Join-Path $ExtensionsDir 'extensions.json'
  if (!(Test-Path -LiteralPath $registryPath -PathType Leaf)) { return $false }
  try { $registry = [IO.File]::ReadAllText($registryPath, [Text.Encoding]::UTF8) | ConvertFrom-Json } catch { return $false }
  $packs = [ordered]@{}
  foreach ($entry in @($registry | ForEach-Object { $_ })) {
    if (!$entry -or !$entry.identifier -or !$entry.identifier.id -or !$entry.relativeLocation) { continue }
    $dir = Join-Path $ExtensionsDir $entry.relativeLocation
    try { $manifest = [IO.File]::ReadAllText((Join-Path $dir 'package.json'), [Text.Encoding]::UTF8) | ConvertFrom-Json } catch { continue }
    if (!$manifest.contributes -or !$manifest.contributes.localizations) { continue }
    foreach ($localization in @($manifest.contributes.localizations)) {
      if (!($localization.languageId -is [string]) -or !$localization.translations) { continue }
      $language = $localization.languageId
      if (!$packs.Contains($language)) {
        $label = if ($localization.localizedLanguageName) { $localization.localizedLanguageName } else { $localization.languageName }
        $packs[$language] = [ordered]@{ hash = ''; label = $label; extensions = New-Object System.Collections.ArrayList; translations = [ordered]@{} }
      }
      $uuid = if ($entry.identifier.uuid) { $entry.identifier.uuid } elseif ($entry.metadata -and $entry.metadata.id) { $entry.metadata.id } else { $null }
      $identifier = if ($uuid) { [ordered]@{ id = $entry.identifier.id; uuid = $uuid } } else { [ordered]@{ id = $entry.identifier.id } }
      [void]$packs[$language].extensions.Add([ordered]@{ extensionIdentifier = $identifier; version = $manifest.version })
      foreach ($translation in @($localization.translations)) {
        if (($translation.id -is [string]) -and ($translation.path -is [string])) {
          $packs[$language].translations[$translation.id] = [IO.Path]::GetFullPath((Join-Path $dir $translation.path))
        }
      }
    }
  }
  if (!$packs.Contains('ko')) { return $false }
  foreach ($language in @($packs.Keys)) {
    $text = ''
    foreach ($extension in $packs[$language].extensions) {
      $text += $(if ($extension.extensionIdentifier.uuid) { $extension.extensionIdentifier.uuid } else { $extension.extensionIdentifier.id }) + $extension.version
    }
    $md5 = [Security.Cryptography.MD5]::Create()
    try { $packs[$language].hash = ([BitConverter]::ToString($md5.ComputeHash([Text.Encoding]::UTF8.GetBytes($text)))).Replace('-', '').ToLowerInvariant() } finally { $md5.Dispose() }
  }
  $file = Join-Path $UserDir 'languagepacks.json'
  $current = [ordered]@{}
  if (Test-Path -LiteralPath $file -PathType Leaf) {
    try {
      $existing = [IO.File]::ReadAllText($file, [Text.Encoding]::UTF8) | ConvertFrom-Json
      foreach ($property in $existing.PSObject.Properties) { $current[$property.Name] = $property.Value }
    } catch {}
  }
  if ($current.Contains('ko') -and $current['ko'].hash -eq $packs['ko'].hash) { return $false }
  foreach ($language in @($packs.Keys)) { $current[$language] = $packs[$language] }
  [IO.File]::WriteAllText($file, (ConvertTo-Json -InputObject $current -Depth 10 -Compress), (New-Object Text.UTF8Encoding($false)))
  return $true
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
