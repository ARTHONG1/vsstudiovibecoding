const test = require('node:test');
const assert = require('node:assert/strict');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const ROOT = path.resolve(__dirname, '..');
const SETUP_SCRIPT = path.join(ROOT, 'vibe-coding/scripts/setup.ps1');

function runPowerShell(args) {
  const cmd = `powershell -ExecutionPolicy Bypass -NoProfile -File "${SETUP_SCRIPT}" ${args}`;
  return execSync(cmd, { cwd: ROOT, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
}

test('setup.ps1 dry-run with -CreateSample returns valid JSON plan', () => {
  const output = runPowerShell('-CreateSample');
  const plan = JSON.parse(output);
  assert.equal(plan.applied, false);
  assert.equal(plan.registerContextMenu, false);
  assert.ok(plan.project.includes('SampleProject'));
  assert.ok(plan.shortcut.includes('.lnk'));
  assert.ok(Array.isArray(plan.missing));
});

test('setup.ps1 honors -RegisterContextMenu flag in plan', () => {
  const output = runPowerShell('-CreateSample -RegisterContextMenu');
  const plan = JSON.parse(output);
  assert.equal(plan.registerContextMenu, true);
});

test('setup.ps1 throws when neither ProjectPath nor CreateSample is specified', () => {
  assert.throws(() => {
    runPowerShell('');
  });
});

test('setup.ps1 prevents path traversal in EntryFile', () => {
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

test('setup.ps1 auto-detects framework dev server port from package.json', () => {
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

test('setup.ps1 preserves existing project and does not touch project .vscode/settings.json', () => {
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
