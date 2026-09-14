[CmdletBinding()]
param(
  [string]$ProjectPath,
  [string]$EntryFile,
  [string]$PreviewUrl,
  [string]$Root = (Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'VibeCoding'),
  [string]$CodePath,
  [string]$CodexPath,
  [string]$OpenCodePath,
  [string]$DesktopPath = [Environment]::GetFolderPath('Desktop'),
  [string]$SkillRoot,
  [switch]$CreateSample,
  [switch]$Apply,
  [switch]$Launch,
  [switch]$RegisterContextMenu
)
$ErrorActionPreference = 'Stop'
try { [Console]::InputEncoding = [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
if (!$SkillRoot) {
  $scriptDir = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
  $SkillRoot = Split-Path -Parent $scriptDir
}
function Find-Executable([string[]]$Candidates) {
  foreach ($candidate in $Candidates) { if ($candidate -and (Test-Path -LiteralPath $candidate -PathType Leaf)) { return [IO.Path]::GetFullPath($candidate) } }
  return $null
}
if ($env:OS -ne 'Windows_NT') { throw 'This setup helper supports Windows only.' }
if ($CreateSample -and $ProjectPath) { throw 'Choose an existing ProjectPath OR CreateSample.' }
if (!$ProjectPath -and !$CreateSample) { throw 'Specify ProjectPath, or CreateSample for a new demo.' }
$Root = [IO.Path]::GetFullPath($Root)
if ($CreateSample) { $ProjectPath = Join-Path $Root 'SampleProject' }
$ProjectPath = [IO.Path]::GetFullPath($ProjectPath)
if (!$CreateSample -and !(Test-Path -LiteralPath $ProjectPath -PathType Container)) { throw "Project does not exist: $ProjectPath" }
if (!$EntryFile) {
  $candidates = @('index.html', 'public\index.html', 'src\index.html', 'src\App.tsx', 'src\App.jsx', 'src\App.vue', 'src\main.ts', 'src\main.js', 'app\page.tsx')
  foreach ($c in $candidates) {
    if (Test-Path -LiteralPath (Join-Path $ProjectPath $c) -PathType Leaf) {
      $EntryFile = $c
      break
    }
  }
  if (!$EntryFile) { $EntryFile = 'index.html' }
}
$entryPath = [IO.Path]::GetFullPath((Join-Path $ProjectPath $EntryFile))
if (!$entryPath.StartsWith($ProjectPath.TrimEnd('\') + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'EntryFile must stay within the project.' }
if (!$CreateSample -and !(Test-Path -LiteralPath $entryPath -PathType Leaf)) { throw "Entry file does not exist: $entryPath" }
if (!$PreviewUrl -and (Test-Path -LiteralPath (Join-Path $ProjectPath 'package.json') -PathType Leaf)) {
  try {
    $pkgText = Get-Content -Raw -Encoding UTF8 -LiteralPath (Join-Path $ProjectPath 'package.json')
    if ($pkgText -match '"vite"') { $PreviewUrl = 'http://localhost:5173' }
    elseif ($pkgText -match '"next"' -or $pkgText -match '"react-scripts"') { $PreviewUrl = 'http://localhost:3000' }
    elseif ($pkgText -match '"astro"') { $PreviewUrl = 'http://localhost:4321' }
  } catch {}
}
if ($PreviewUrl) {
  $url = [uri]$PreviewUrl
  if ($url.Scheme -notin @('http','https') -or $url.Host -notin @('localhost','127.0.0.1','::1','[::1]')) { throw 'PreviewUrl must be a localhost HTTP(S) development server.' }
}
if (!$CodePath) {
  $x86Prog = [Environment]::GetFolderPath('ProgramFilesX86')
  $CodePath = Find-Executable @((Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'Programs\Microsoft VS Code\Code.exe'), (Join-Path $env:ProgramFiles 'Microsoft VS Code\Code.exe'), $(if ($x86Prog) { Join-Path $x86Prog 'Microsoft VS Code\Code.exe' }))
  if (!$CodePath) { $command = Get-Command code.cmd -ErrorAction SilentlyContinue; if ($command) { $CodePath = Find-Executable @((Join-Path (Split-Path (Split-Path $command.Source)) 'Code.exe')) } }
}
if (!$CodexPath) {
  $cmd = Get-Command codex.exe -ErrorAction SilentlyContinue
  if (!$cmd) { $cmd = Get-Command codex.cmd -ErrorAction SilentlyContinue }
  if (!$cmd) { $cmd = Get-Command codex -ErrorAction SilentlyContinue }
  $localApp = [Environment]::GetFolderPath('LocalApplicationData')
  $appData = [Environment]::GetFolderPath('ApplicationData')
  $codexBin = Join-Path $localApp 'OpenAI\Codex\bin'
  $deepExe = if (Test-Path -LiteralPath $codexBin) { (Get-ChildItem -Path $codexBin -Filter 'codex.exe' -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty FullName) } else { $null }
  $CodexPath = Find-Executable @(
    $(if ($cmd) { $cmd.Source }),
    $deepExe,
    (Join-Path $appData 'npm\codex.cmd'),
    (Join-Path $env:ProgramFiles 'OpenAI\Codex\codex.exe')
  )
}
if (!$OpenCodePath) {
  $command = Get-Command opencode.exe -ErrorAction SilentlyContinue
  $OpenCodePath = Find-Executable @($(if ($command) {$command.Source}), (Join-Path ([Environment]::GetFolderPath('ApplicationData')) 'npm\node_modules\opencode-ai\bin\opencode.exe'), (Join-Path $env:USERPROFILE '.opencode\bin\opencode.exe'), (Join-Path $env:USERPROFILE 'scoop\shims\opencode.exe'))
}
$agentExe = if ($CodexPath) { $CodexPath } else { $OpenCodePath }
$agentName = if ($CodexPath) { 'Codex' } else { 'OpenCode' }
if (!$agentExe -and $Apply) {
  $npm = Get-Command npm.cmd -ErrorAction SilentlyContinue
  if (!$npm) { $npm = Get-Command npm -ErrorAction SilentlyContinue }
  if ($npm) {
    & $npm.Source install -g opencode-ai
    $command = Get-Command opencode.exe -ErrorAction SilentlyContinue
    $OpenCodePath = Find-Executable @($(if ($command) {$command.Source}), (Join-Path ([Environment]::GetFolderPath('ApplicationData')) 'npm\node_modules\opencode-ai\bin\opencode.exe'), (Join-Path $env:USERPROFILE '.opencode\bin\opencode.exe'), (Join-Path $env:USERPROFILE 'scoop\shims\opencode.exe'))
    $agentExe = $OpenCodePath
    $agentName = 'OpenCode'
  }
}
$missing = @()
if (!$CodePath -or !(Test-Path -LiteralPath $CodePath -PathType Leaf)) { $missing += 'VS Code executable' }
if (!$agentExe -or !(Test-Path -LiteralPath $agentExe -PathType Leaf)) { $missing += 'AI Agent executable (Codex or OpenCode)' }
$sha = [Security.Cryptography.SHA256]::Create()
try { $id = ([BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($ProjectPath.ToLowerInvariant())))).Replace('-','').Substring(0,10).ToLowerInvariant() } finally { $sha.Dispose() }
$name = (Split-Path -Leaf $ProjectPath) -replace '[<>:"/\\|?*]', '_'
$workspaceDir = Join-Path $Root 'Workspaces'
$workspacePath = Join-Path $workspaceDir ('vibe-' + $id + '.code-workspace')
$shortcutPath = Join-Path $DesktopPath ('Vibe Coding - ' + $name + '-' + $id + '.lnk')
$plan = [ordered]@{ project=$ProjectPath; entry=$entryPath; previewUrl=$PreviewUrl; root=$Root; code=$CodePath; agent=$agentName; codex=$CodexPath; openCode=$OpenCodePath; workspace=$workspacePath; shortcut=$shortcutPath; registerContextMenu=[bool]$RegisterContextMenu; missing=$missing; applied=$false }
if (!$Apply) { $plan | ConvertTo-Json -Depth 5; return }
if ($missing.Count) { throw ('Install/discover prerequisites first: ' + ($missing -join ', ')) }
. ([scriptblock]::Create([IO.File]::ReadAllText((Join-Path $SkillRoot 'scripts\native-files.ps1'))))
. ([scriptblock]::Create([IO.File]::ReadAllText((Join-Path $SkillRoot 'scripts\setup-files.ps1'))))
New-Item -ItemType Directory -Force -Path $Root | Out-Null
$visibilityProbe = Join-Path $Root ('.visibility-' + [guid]::NewGuid().ToString() + '.txt')
[IO.File]::WriteAllText($visibilityProbe, [guid]::NewGuid().ToString())
try { Assert-VibeNativeFiles @($visibilityProbe, $CodePath, $agentExe) }
finally { Remove-Item -LiteralPath $visibilityProbe -Force }
$version = & $agentExe --version
if ($LASTEXITCODE -ne 0) { throw "$agentName --version failed." }
$userDir = Join-Path $Root 'VSCodeUserData'
$extensionsDir = Join-Path $Root 'VSCodeExtensions'
$backup = Join-Path $Root ('Backups\setup-' + (Get-Date -Format 'yyyyMMdd-HHmmss-fff'))
$utf8 = New-Object Text.UTF8Encoding($false)
function Read-Object([string]$Path) {
  if (!(Test-Path -LiteralPath $Path)) { return [pscustomobject]@{} }
  try { $value = Get-Content -Raw -Encoding UTF8 -LiteralPath $Path | ConvertFrom-Json } catch { throw "Cannot parse $Path. Preserve it and use a JSONC-aware edit; do not overwrite." }
  if ($null -eq $value -or $value -is [array] -or $value -is [string]) { throw "Expected a JSON object: $Path" }
  return $value
}
function Set-Key($Object, [string]$Key, $Value) { $Object | Add-Member -Force NoteProperty $Key $Value }
function Save-Json([string]$Path, $Value) {
  Backup-VibeFile $Path $backup | Out-Null
  [IO.File]::WriteAllText($Path, (ConvertTo-Json -InputObject $Value -Depth 30), $utf8)
}
$settingsPath = Join-Path $userDir 'User\settings.json'
$keybindingsPath = Join-Path $userDir 'User\keybindings.json'
$settings = Read-Object $settingsPath
$keys = @()
if (Test-Path -LiteralPath $keybindingsPath) {
  try { $parsedKeys = Get-Content -Raw -Encoding UTF8 -LiteralPath $keybindingsPath | ConvertFrom-Json; $keys = @($parsedKeys) } catch { throw 'Keybindings cannot be parsed. Preserve and repair JSONC before continuing.' }
  if (@($keys | Where-Object { !$_.key -or !$_.command }).Count) { throw 'Existing keybindings contain invalid entries. Preserve and repair before applying.' }
}
$workspace = Read-Object $workspacePath
New-Item -ItemType Directory -Force -Path (Join-Path $userDir 'User'),$extensionsDir,$workspaceDir,$backup | Out-Null
if ($CreateSample) {
  New-Item -ItemType Directory -Force -Path $ProjectPath | Out-Null
  if (!(Test-Path -LiteralPath $entryPath)) { Copy-Item -LiteralPath (Join-Path $SkillRoot 'assets\sample.html') -Destination $entryPath }
}
if (!(Test-Path -LiteralPath $entryPath -PathType Leaf)) { throw 'Entry file is not a file.' }
$profiles = $settings.'terminal.integrated.profiles.windows'
if (!$profiles) { $profiles = [pscustomobject]@{} }
$startup = '[Console]::InputEncoding = [Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false); chcp 65001 | Out-Null; $env:PYTHONIOENCODING = "utf-8"; $env:LANG = "ko_KR.UTF-8"'
$tokens=$null; $errors=$null
[void][Management.Automation.Language.Parser]::ParseInput($startup,[ref]$tokens,[ref]$errors)
if ($errors.Count) { throw 'Invalid terminal startup command.' }
Set-Key $profiles 'Vibe PowerShell' @{path=(Join-Path $env:WINDIR 'System32\WindowsPowerShell\v1.0\powershell.exe');args=@('-NoLogo','-NoProfile','-NoExit','-Command',$startup)}
Set-Key $settings 'terminal.integrated.profiles.windows' $profiles
Set-Key $settings 'terminal.integrated.defaultProfile.windows' 'Vibe PowerShell'
$skip = @($settings.'terminal.integrated.commandsToSkipShell' | Where-Object { $_ -and $_ -notin @('-vibe.toggleTerminal','-vibe.restoreLayout') })
Set-Key $settings 'terminal.integrated.commandsToSkipShell' @($skip + @('vibe.toggleTerminal','vibe.restoreLayout','vibe.togglePreview','vibe.openExternalBrowser','vibe.pasteImage') | Select-Object -Unique)
Set-Key $settings 'workbench.panel.opensMaximized' 'never'
Set-Key $settings 'workbench.panel.defaultLocation' 'right'
Set-Key $settings 'terminal.integrated.enablePersistentSessions' $true
Set-Key $settings 'terminal.integrated.tabs.enabled' $false
Set-Key $settings 'terminal.integrated.copyOnSelection' $true
Set-Key $settings 'livePreview.openPreviewTarget' 'Embedded Preview'
Set-Key $settings 'livePreview.debugOnExternalPreview' $true
Set-Key $settings 'livePreview.autoRefreshPreview' 'On All Changes in Editor'
Set-Key $settings 'workbench.startupEditor' 'none'
Set-Key $settings 'locale' 'ko'
Set-Key $settings 'files.autoSave' 'afterDelay'
Set-Key $settings 'files.autoSaveDelay' 500
Set-Key $settings 'vibe.enabled' $true
Set-Key $settings 'vibe.codexPath' $(if ($CodexPath) {$CodexPath} else {''})
Set-Key $settings 'vibe.opencodePath' $(if ($OpenCodePath) {$OpenCodePath} else {''})
Set-Key $settings 'vibe.entryFile' $EntryFile
Set-Key $settings 'vibe.previewUrl' $(if ($PreviewUrl) {$PreviewUrl} else {''})
Set-Key $settings 'chat.commandCenter.enabled' $false
Save-Json $settingsPath $settings
$argvPath = Join-Path $userDir 'argv.json'
$argv = Read-Object $argvPath
Set-Key $argv 'locale' 'ko'
Save-Json $argvPath $argv
$keys = @($keys | Where-Object { $_ -and $_.command -notin @('vibe.toggleTerminal','vibe.restoreLayout','workbench.action.terminal.paste','workbench.action.terminal.copySelection') })
$keys += @{ key='ctrl+v'; command='workbench.action.terminal.paste'; when='terminalFocus' }
$keys += @{ key='ctrl+c'; command='workbench.action.terminal.copySelection'; when='terminalFocus && terminalHasSelection' }
Save-Json $keybindingsPath $keys
$wsSettings = $workspace.settings
if (!$wsSettings) { $wsSettings = [pscustomobject]@{} }
Set-Key $wsSettings 'vibe.enabled' $true
Set-Key $wsSettings 'vibe.codexPath' $(if ($CodexPath) {$CodexPath} else {''})
Set-Key $wsSettings 'vibe.opencodePath' $(if ($OpenCodePath) {$OpenCodePath} else {''})
Set-Key $wsSettings 'vibe.entryFile' $EntryFile
Set-Key $wsSettings 'vibe.previewUrl' $(if ($PreviewUrl) {$PreviewUrl} else {''})
Set-Key $wsSettings 'window.title' 'Vibe Coding - ${activeEditorShort}${separator}${rootName}'
$otherFolders = @($workspace.folders | Where-Object { $_ -and $_.path -ne $ProjectPath })
Set-Key $workspace 'folders' (@(@{path=$ProjectPath}) + $otherFolders)
Set-Key $workspace 'settings' $wsSettings
Save-Json $workspacePath $workspace
$packageSource = Join-Path $SkillRoot 'assets\workspace-extension'
$manifest = Get-Content -Raw -Encoding UTF8 (Join-Path $packageSource 'extension\package.json') | ConvertFrom-Json
$installedLayout = Join-Path $extensionsDir ($manifest.publisher + '.' + $manifest.name + '-' + $manifest.version)
$packagePath = Join-Path $backup ('vibe-workspace-' + $manifest.version + '.vsix')
Add-Type -AssemblyName System.IO.Compression.FileSystem
[IO.Compression.ZipFile]::CreateFromDirectory($packageSource, $packagePath)
$cli = Join-Path (Split-Path -Parent $CodePath) 'bin\code.cmd'
if (!(Test-Path -LiteralPath $cli)) { throw 'VS Code CLI was not found beside Code.exe.' }
function Invoke-VibeCode {
  # Windows PowerShell can turn a harmless native stderr warning into a
  # terminating error. Decide success from the CLI exit code instead.
  $ErrorActionPreference = 'Continue'
  & $cli @args
  if ($LASTEXITCODE -ne 0) { throw "VS Code CLI failed with exit code $LASTEXITCODE" }
}
$installed = @(Invoke-VibeCode --user-data-dir $userDir --extensions-dir $extensionsDir --list-extensions --show-versions)
if ($LASTEXITCODE -ne 0) { throw 'Cannot inspect installed extensions.' }
foreach ($extension in @('MS-CEINTL.vscode-language-pack-ko','ms-vscode.live-server',$packagePath)) {
  if ($extension -eq $packagePath) { if (('local-vibe.vibe-workspace@'+$manifest.version) -in $installed -and (Test-VibeExtensionContent (Join-Path $packageSource 'extension') $installedLayout)) { continue } }
  elseif (@($installed | Where-Object { $_ -like ($extension+'@*') }).Count) { continue }
  Invoke-VibeCode --user-data-dir $userDir --extensions-dir $extensionsDir --install-extension $extension --force
  if ($LASTEXITCODE -ne 0) { throw "Extension installation failed: $extension. Configuration backup: $backup" }
}
try {
  if (!(@($installed | Where-Object { $_ -like 'sst-dev.opencode@*' }).Count)) {
    Invoke-VibeCode --user-data-dir $userDir --extensions-dir $extensionsDir --install-extension 'sst-dev.opencode' --force 2>$null
  }
} catch {}
if (!(Test-Path -LiteralPath $DesktopPath -PathType Container)) { throw 'Desktop directory not found; provide the real DesktopPath.' }
if (!(Test-VibeExtensionContent (Join-Path $packageSource 'extension') $installedLayout)) {
  throw 'Installed layout extension differs from the skill source. Preserve the existing installation and inspect the CLI result before creating a shortcut.'
}
$installedFiles = @(Get-ChildItem -LiteralPath $installedLayout -File -Recurse | Select-Object -ExpandProperty FullName)
Assert-VibeNativeFiles (@($workspacePath, $entryPath, $settingsPath) + $installedFiles)
if (Test-Path -LiteralPath $shortcutPath) { Copy-Item -LiteralPath $shortcutPath -Destination $backup }
$shell = New-Object -ComObject WScript.Shell
$link = $shell.CreateShortcut($shortcutPath)
$link.TargetPath = $CodePath
$link.Arguments = '--new-window --skip-release-notes --locale ko --user-data-dir "' + $userDir + '" --extensions-dir "' + $extensionsDir + '" "' + $workspacePath + '"'
$link.WorkingDirectory = $ProjectPath
$link.IconLocation = $CodePath + ',0'
$link.Save()
if ($RegisterContextMenu) {
  try {
    $regScript = Join-Path $SkillRoot 'scripts\setup.ps1'
    $cmdStr = 'powershell.exe -WindowStyle Hidden -ExecutionPolicy Bypass -Command "& ''' + $regScript + ''' -ProjectPath ''%V'' -Apply -Launch"'
    $bgCmdStr = 'powershell.exe -WindowStyle Hidden -ExecutionPolicy Bypass -Command "& ''' + $regScript + ''' -ProjectPath ''%W'' -Apply -Launch"'
    $regDirs = @("HKCU:\Software\Classes\Directory\shell\VibeCoding", "HKCU:\Software\Classes\Directory\Background\shell\VibeCoding")
    foreach ($regPath in $regDirs) {
      New-Item -Path $regPath -Force | Out-Null
      Set-ItemProperty -Path $regPath -Name "(Default)" -Value "Vibe Coding으로 열기" -Force
      Set-ItemProperty -Path $regPath -Name "Icon" -Value "$CodePath,0" -Force
      New-Item -Path "$regPath\command" -Force | Out-Null
      $val = if ($regPath -like "*Background*") { $bgCmdStr } else { $cmdStr }
      Set-ItemProperty -Path "$regPath\command" -Name "(Default)" -Value $val -Force
    }
  } catch {}
}
if ($Launch -and (Test-Path -LiteralPath $shortcutPath)) {
  Start-Process $shortcutPath
}
$plan.applied=$true
$plan['backup']=$backup
$plan['agentVersion']=($version -join ' ')
$plan['openCodeVersion']=($version -join ' ')
$plan['uiVerification']='PENDING: agent must launch shortcut and complete references/verification.md'
$plan | ConvertTo-Json -Depth 5
