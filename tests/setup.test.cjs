const test = require('node:test');
const assert = require('node:assert/strict');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const ROOT = path.resolve(__dirname, '..');
const SETUP_SCRIPT = path.join(ROOT, 'vibe-coding/scripts/setup.ps1');
const WINDOWS_ONLY = { skip: process.platform !== 'win32' && 'setup.ps1 runs on Windows only' };

function runPowerShell(args) {
  const cmd = `powershell -ExecutionPolicy Bypass -NoProfile -File "${SETUP_SCRIPT}" ${args}`;
  return execSync(cmd, { cwd: ROOT, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
}

test('setup.ps1 dry-run with -CreateSample returns valid JSON plan', WINDOWS_ONLY, () => {
  const output = runPowerShell('-CreateSample');
  const plan = JSON.parse(output);
  assert.equal(plan.applied, false);
  assert.equal(plan.registerContextMenu, false);
  assert.ok(plan.project.includes('SampleProject'));
  assert.ok(plan.shortcut.includes('.lnk'));
  assert.ok(Array.isArray(plan.missing));
});

test('setup.ps1 honors -RegisterContextMenu flag in plan', WINDOWS_ONLY, () => {
  const output = runPowerShell('-CreateSample -RegisterContextMenu');
  const plan = JSON.parse(output);
  assert.equal(plan.registerContextMenu, true);
});

test('setup.ps1 throws when neither ProjectPath nor CreateSample is specified', WINDOWS_ONLY, () => {
  assert.throws(() => {
    runPowerShell('');
  });
});

test('setup.ps1 prevents path traversal in EntryFile', WINDOWS_ONLY, () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-test-traversal-'));
  try {
    fs.writeFileSync(path.join(tempDir, 'index.html'), '<html></html>');
    assert.throws(() => {
      runPowerShell(`-ProjectPath "${tempDir}" -EntryFile "../outside.html"`);
    });
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('setup.ps1 auto-detects framework dev server port from package.json', WINDOWS_ONLY, () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-test-vite-'));
  try {
    fs.writeFileSync(path.join(tempDir, 'index.html'), '<html></html>');
    fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify({ dependencies: { vite: '^5.0.0' } }));
    const output = runPowerShell(`-ProjectPath "${tempDir}"`);
    const plan = JSON.parse(output);
    assert.equal(plan.previewUrl, 'http://localhost:5173');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('setup.ps1 preserves existing project and does not touch project .vscode/settings.json', WINDOWS_ONLY, () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-test-clean-project-'));
  try {
    fs.writeFileSync(path.join(tempDir, 'index.html'), '<html><body>clean</body></html>');
    const output = runPowerShell(`-ProjectPath "${tempDir}"`);
    const plan = JSON.parse(output);
    assert.equal(plan.applied, false);
    assert.equal(fs.existsSync(path.join(tempDir, '.vscode')), false, '.vscode folder must not be created');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('setup retains saved preview route when PreviewUrl is omitted', WINDOWS_ONLY, () => {
  const tempDir=fs.mkdtempSync(path.join(os.tmpdir(),'vibe-saved-preview-'));
  try {
    fs.writeFileSync(path.join(tempDir,'index.html'),'<html></html>');
    fs.writeFileSync(path.join(tempDir,'package.json'),JSON.stringify({dependencies:{vite:'^5.0.0'}}));
    fs.mkdirSync(path.join(tempDir,'.vibe'));
    fs.writeFileSync(path.join(tempDir,'.vibe','remote-config.json'),JSON.stringify({previewUrl:'http://127.0.0.1:8080/studio'}));
    assert.equal(JSON.parse(runPowerShell(`-ProjectPath "${tempDir}"`)).previewUrl,'http://127.0.0.1:8080/studio');
    assert.equal(JSON.parse(runPowerShell(`-ProjectPath "${tempDir}" -PreviewUrl "http://127.0.0.1:9090"`)).previewUrl,'http://127.0.0.1:9090');
  } finally { fs.rmSync(tempDir,{recursive:true,force:true}); }
});
