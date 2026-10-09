const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

test('installation detects stale same-version code and preserves colliding backup names', {skip:process.platform !== 'win32'}, () => {
  const helper = path.resolve(__dirname, '../vibe-coding/scripts/setup-files.ps1').replaceAll("'", "''");
  const code = `
$ErrorActionPreference='Stop'
. ([scriptblock]::Create([IO.File]::ReadAllText('${helper}')))
$root=Join-Path $env:TEMP ('vibe-files-test-'+[guid]::NewGuid())
try {
  foreach ($dir in @('source','installed','user','project','backup')) { New-Item -ItemType Directory -Path (Join-Path $root $dir) -Force | Out-Null }
  $src=Join-Path $root 'source'; $dst=Join-Path $root 'installed'; $back=Join-Path $root 'backup'
  [IO.File]::WriteAllText((Join-Path $src 'package.json'),'{"version":"1.0.0","name":"test"}')
  [IO.File]::WriteAllText((Join-Path $dst 'package.json'),'{"version":"1.0.0","name":"test","__metadata":{"installedTimestamp":1}}')
  [IO.File]::WriteAllText((Join-Path $src 'extension.js'),'new code')
  [IO.File]::WriteAllText((Join-Path $dst 'extension.js'),'old code')
  if (Test-VibeExtensionContent $src $dst) { throw 'Stale same-version code accepted' }
  Copy-Item (Join-Path $src 'extension.js') (Join-Path $dst 'extension.js')
  if (!(Test-VibeExtensionContent $src $dst)) { throw 'Matching content rejected due to installation metadata' }
  $a=Join-Path $root 'user/settings.json'; $b=Join-Path $root 'project/settings.json'
  [IO.File]::WriteAllText($a,'user settings'); [IO.File]::WriteAllText($b,'project settings')
  $ba=Backup-VibeFile $a $back; $bb=Backup-VibeFile $b $back
  [IO.File]::WriteAllText($a,'changed'); $again=Backup-VibeFile $a $back
  if ($ba -eq $bb -or [IO.File]::ReadAllText($ba) -ne 'user settings' -or [IO.File]::ReadAllText($bb) -ne 'project settings') { throw 'Original backups overwritten' }
  'VERIFIED'
} finally { if ($root -and (Split-Path $root -Leaf) -like 'vibe-files-test-*' -and (Split-Path $root -Parent) -eq $env:TEMP) { Remove-Item -LiteralPath $root -Recurse -Force -ErrorAction SilentlyContinue } }
`;
  const r=spawnSync('powershell.exe',['-NoProfile','-EncodedCommand',Buffer.from(code,'utf16le').toString('base64')],{encoding:'utf8',timeout:30000});
  assert.equal(r.status,0,r.stderr); assert.match(r.stdout,/VERIFIED/);
});

test('Windows setup registers the Korean language pack with VS Code\'s hash', {skip:process.platform !== 'win32'}, () => {
  const helper = path.resolve(__dirname, '../vibe-coding/scripts/setup-files.ps1').replaceAll("'", "''");
  const code = `
$ErrorActionPreference='Stop'
. ([scriptblock]::Create([IO.File]::ReadAllText('${helper}')))
$root=Join-Path $env:TEMP ('vibe-files-test-'+[guid]::NewGuid())
try {
  $ext=Join-Path $root 'ext'; $user=Join-Path $root 'user'; $rel='ms-ceintl.vscode-language-pack-ko-1.131.2026090407'
  $pack=Join-Path $ext $rel; $translations=Join-Path $pack 'translations'
  New-Item -ItemType Directory -Path $translations,$user -Force | Out-Null
  [IO.File]::WriteAllText((Join-Path $pack 'package.json'),'{"name":"vscode-language-pack-ko","version":"1.131.2026090407","contributes":{"localizations":[{"languageId":"ko","languageName":"Korean","localizedLanguageName":"Korean","translations":[{"id":"vscode","path":"./translations/main.i18n.json"}]}]}}')
  [IO.File]::WriteAllText((Join-Path $ext 'extensions.json'),'[{"identifier":{"id":"ms-ceintl.vscode-language-pack-ko"},"version":"1.131.2026090407","relativeLocation":"ms-ceintl.vscode-language-pack-ko-1.131.2026090407","metadata":{"id":"7c15d326-cfdd-4932-9409-634b512daebe"}}]')
  if (!(Write-VibeLanguagePacks $user $ext)) { throw 'Language pack not written' }
  $packs=[IO.File]::ReadAllText((Join-Path $user 'languagepacks.json')) | ConvertFrom-Json
  if ($packs.ko.hash -ne 'd7d556079a3b7c73bd10ddac55bcb029') { throw ('Hash ' + $packs.ko.hash) }
  # GetFullPath expands 8.3 names such as RUNNER~1 in TEMP on CI runners.
  if ($packs.ko.translations.vscode -ne [IO.Path]::GetFullPath((Join-Path $translations 'main.i18n.json'))) { throw ('Path ' + $packs.ko.translations.vscode) }
  if ($packs.ko.extensions[0].extensionIdentifier.uuid -ne '7c15d326-cfdd-4932-9409-634b512daebe') { throw 'uuid' }
  if (Write-VibeLanguagePacks $user $ext) { throw 'Up-to-date file rewritten' }
  'VERIFIED'
} finally { if ($root -and (Split-Path $root -Leaf) -like 'vibe-files-test-*' -and (Split-Path $root -Parent) -eq $env:TEMP) { Remove-Item -LiteralPath $root -Recurse -Force -ErrorAction SilentlyContinue } }
`;
  const r=spawnSync('powershell.exe',['-NoProfile','-EncodedCommand',Buffer.from(code,'utf16le').toString('base64')],{encoding:'utf8',timeout:30000});
  assert.equal(r.status,0,r.stderr+r.stdout); assert.match(r.stdout,/VERIFIED/);
});
