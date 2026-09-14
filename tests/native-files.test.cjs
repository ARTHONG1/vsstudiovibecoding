const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

test('native Windows process sees the same setup source bytes', { skip: process.platform !== 'win32' }, () => {
  const helper = path.resolve(__dirname, '../vibe-coding/scripts/native-files.ps1');
  const literal = helper.replaceAll("'", "''");
  const code = `. ([scriptblock]::Create([IO.File]::ReadAllText('${literal}'))); Assert-VibeNativeFiles @('${literal}'); 'VERIFIED'`;
  const result = spawnSync('powershell.exe', ['-NoProfile', '-EncodedCommand', Buffer.from(code, 'utf16le').toString('base64')], { encoding: 'utf8', timeout: 30000 });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /VERIFIED/);
});
