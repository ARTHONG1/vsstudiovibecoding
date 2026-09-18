const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const os = require('node:os');
const { execSync } = require('node:child_process');

test('createShadowCheckpoint does NOT pollute user git index or modify staged files', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-tm-test-'));
  try {
    execSync('git init', { cwd: tempDir, stdio: 'ignore' });
    execSync('git config user.name "Vibe Test"', { cwd: tempDir, stdio: 'ignore' });
    execSync('git config user.email "test@local"', { cwd: tempDir, stdio: 'ignore' });

    // User creates a staged file and an untracked file
    fs.writeFileSync(path.join(tempDir, 'staged.txt'), 'staged content');
    execSync('git add staged.txt', { cwd: tempDir, stdio: 'ignore' });
    fs.writeFileSync(path.join(tempDir, 'unstaged.txt'), 'unstaged content');

    const statusBefore = execSync('git status --porcelain', { cwd: tempDir, encoding: 'utf8' }).trim();
    assert.ok(statusBefore.includes('A  staged.txt'), 'staged.txt must be staged in user index');
    assert.ok(statusBefore.includes('?? unstaged.txt'), 'unstaged.txt must be untracked');

    // Load extension module with mocked vscode
    const vscode = {
      workspace: {
        getConfiguration: () => ({ get: () => '' }),
        workspaceFolders: [{ uri: { fsPath: tempDir } }]
      },
      window: {
        createOutputChannel: () => ({ appendLine() {} }),
        createStatusBarItem: () => ({ show() {}, dispose() {} }),
        showErrorMessage: () => {},
        showInformationMessage: () => {},
        showInputBox: async () => '테스트 체크포인트',
        terminals: [],
        onDidCloseTerminal: () => ({ dispose() {} })
      },
      commands: {
        registerCommand: (name, fn) => {
          commands.set(name, fn);
          return { dispose() {} };
        }
      },
      StatusBarAlignment: { Right: 2 },
      env: {}
    };

    const commands = new Map();
    const module = { exports: {} };
    const code = fs.readFileSync(path.join(__dirname, '../vibe-coding/assets/workspace-extension/extension/extension.js'), 'utf8');
    vm.runInNewContext(code, {
      module, exports: module.exports,
      require: name => (name === 'vscode' ? vscode : name.startsWith('.') ? require(path.join(__dirname, '../vibe-coding/assets/workspace-extension/extension', name)) : require(name)),
      setTimeout: fn => fn(),
      clearTimeout: () => {},
      process, console, Buffer, URL
    });

    const subscriptions = [];
    const storageDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-storage-'));
    await module.exports.activate({ subscriptions, globalStorageUri: { fsPath: storageDir } });
    await commands.get('vibe.createCheckpoint')();

    // Check status after checkpoint creation
    const statusAfter = execSync('git status --porcelain', { cwd: tempDir, encoding: 'utf8' }).trim();
    assert.equal(statusBefore, statusAfter, 'User git index must be 100% identical before and after checkpoint creation');

    // Checkpoints file should exist
    const checkpointsFile = path.join(tempDir, '.vibe', 'checkpoints.json');
    assert.ok(fs.existsSync(checkpointsFile), 'checkpoints.json must be created in .vibe');
    const list = JSON.parse(fs.readFileSync(checkpointsFile, 'utf8'));
    assert.ok(list.length > 0, 'At least one checkpoint must be recorded');
    fs.rmSync(storageDir, { recursive: true, force: true });
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('extension dispose lifecycle executes cleanly without ReferenceError', async () => {
  const vscode = {
    workspace: {
      getConfiguration: () => ({ get: () => '' }),
      workspaceFolders: [{ uri: { fsPath: 'C:/mock' } }]
    },
    window: {
      createOutputChannel: () => ({ appendLine() {} }),
      createStatusBarItem: () => ({ show() {}, dispose() {} }),
      showErrorMessage: () => {},
      terminals: [],
      onDidCloseTerminal: () => ({ dispose() {} })
    },
    commands: { registerCommand: () => ({ dispose() {} }) },
    StatusBarAlignment: { Right: 2 },
    env: {}
  };

  const module = { exports: {} };
  const code = fs.readFileSync(path.join(__dirname, '../vibe-coding/assets/workspace-extension/extension/extension.js'), 'utf8');
  vm.runInNewContext(code, {
    module, exports: module.exports,
    require: name => (name === 'vscode' ? vscode : name === 'fs' ? { existsSync: () => true, mkdirSync() {}, appendFileSync() {} } : name.startsWith('.') ? require(path.join(__dirname, '../vibe-coding/assets/workspace-extension/extension', name)) : require(name)),
    setTimeout: fn => fn(),
    clearTimeout: () => {},
    process, console, Buffer, URL
  });

  const subscriptions = [];
  await module.exports.activate({ subscriptions, globalStorageUri: { fsPath: 'C:/test' } });

  assert.doesNotThrow(() => {
    for (const s of subscriptions) {
      if (s && typeof s.dispose === 'function') {
        s.dispose();
      }
    }
  }, 'All subscriptions must dispose without throwing ReferenceError');
});
