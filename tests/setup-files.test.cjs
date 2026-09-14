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
